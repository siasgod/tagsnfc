import { transacao } from "@/lib/db/pool";
import { criarCliente } from "@/lib/db/repo/clientes";
import { criarEstabelecimento } from "@/lib/db/repo/estabelecimentos";
import { criarVendaComItens } from "@/lib/db/repo/vendas";
import { registrarHistorico } from "@/lib/db/repo/historico";
import { gerarTokenAleatorio } from "@/lib/tokens";
import type { PoolClient } from "pg";

export class ErroAtivacao extends Error {
  codigo: string;
  constructor(codigo: string, mensagem: string) {
    super(mensagem);
    this.codigo = codigo;
  }
}

export interface EntradaAtivacao {
  identificadorPlaca: string; // código humano ou token
  usuarioId: string;
  usuarioNome: string;
  clienteId?: string;
  novoCliente?: { nome: string; responsavel?: string; telefone?: string; email?: string; observacoes?: string };
  estabelecimentoId?: string;
  novoEstabelecimento?: { nome: string; endereco?: string; linkPerfilGoogle?: string; linkAvaliacao?: string };
  destinoUrl: string;
  destinoConfirmado: boolean; // resultado de validarDestino() calculado ANTES desta transação
  venda?: {
    tipo: "VENDA" | "DEMONSTRACAO" | "BONIFICACAO";
    justificativa?: string;
    precoCentavos: number;
    custoCentavos: number;
    descontoCentavos?: number;
    observacoes?: string;
  };
  chaveIdempotencia: string;
}

/**
 * Ativação de placa: operação transacional e atômica.
 *
 * Prevenção de dupla ativação concorrente: `SELECT ... FOR UPDATE` bloqueia
 * a linha da placa até o fim da transação. Se duas ativações da mesma
 * unidade chegarem ao mesmo tempo, a segunda espera a primeira terminar e,
 * ao continuar, encontra `estado_comercial = 'ATIVA'` e é rejeitada com
 * `ErroAtivacao('ja_ativa', ...)`. Um campo `versao` (concorrência otimista)
 * é mantido como segunda camada de proteção.
 *
 * Confirmação só depois de persistir: esta função só retorna sucesso após o
 * COMMIT da transação — o chamador (rota/Server Action) não deve informar
 * "ativado" antes de receber o retorno desta função.
 */
export async function ativarPlaca(entrada: EntradaAtivacao) {
  return transacao(async (client: PoolClient) => {
    const { rows: placas } = await client.query(
      "SELECT * FROM placas WHERE (codigo = $1 OR token = $1) FOR UPDATE",
      [entrada.identificadorPlaca.trim()]
    );
    const placa = placas[0];
    if (!placa) throw new ErroAtivacao("placa_nao_encontrada", "Placa não encontrada.");

    if (placa.estado_comercial === "ATIVA") {
      throw new ErroAtivacao(
        "ja_ativa",
        "Esta placa já está ativa. Para trocar o vínculo, use a ação explícita de mudança de vínculo."
      );
    }
    if (placa.estado_comercial === "PERDIDA" || placa.estado_comercial === "SUBSTITUIDA") {
      throw new ErroAtivacao("estado_invalido", `Placa está com estado "${placa.estado_comercial}" e não pode ser ativada.`);
    }

    let clienteId = entrada.clienteId ?? null;
    if (!clienteId && entrada.novoCliente) {
      const cliente = await criarCliente(
        { ...entrada.novoCliente, vendedorResponsavelId: entrada.usuarioId },
        client
      );
      clienteId = cliente.id;
    }
    if (!clienteId) throw new ErroAtivacao("cliente_ausente", "Informe um cliente existente ou os dados de um novo cliente.");

    let estabelecimentoId = entrada.estabelecimentoId ?? null;
    if (!estabelecimentoId && entrada.novoEstabelecimento) {
      const estabelecimento = await criarEstabelecimento(
        { ...entrada.novoEstabelecimento, clienteId, linkAvaliacao: entrada.destinoUrl },
        client
      );
      estabelecimentoId = estabelecimento.id;
    }
    if (!estabelecimentoId) {
      throw new ErroAtivacao("estabelecimento_ausente", "Informe um estabelecimento existente ou os dados de um novo.");
    }

    const { rows: atualizadas } = await client.query(
      `UPDATE placas SET
         estabelecimento_id = $2,
         destino_url = $3,
         destino_validado_em = now(),
         destino_validado_por = $4,
         estado_comercial = 'ATIVA',
         ativada_em = now(),
         ativada_por = $4,
         versao = versao + 1,
         atualizado_em = now()
       WHERE id = $1 AND versao = $5
       RETURNING *`,
      [placa.id, estabelecimentoId, entrada.destinoUrl, entrada.usuarioNome, placa.versao]
    );
    if (!atualizadas[0]) {
      // Só pode acontecer se outra transação alterou a versão entre o lock e
      // este UPDATE, o que na prática o FOR UPDATE já impede — mantido como
      // rede de segurança defensiva.
      throw new ErroAtivacao("conflito_concorrencia", "A placa foi alterada por outra operação. Tente novamente.");
    }
    const placaAtualizada = atualizadas[0];

    await registrarHistorico(
      {
        tipo: "ATIVACAO",
        usuarioId: entrada.usuarioId,
        placaId: placa.id,
        detalhes: {
          estabelecimentoId,
          clienteId,
          destinoUrl: entrada.destinoUrl,
          destinoConfirmadoAutomaticamente: entrada.destinoConfirmado,
        },
      },
      client
    );

    let resultadoVenda = null;
    if (entrada.venda) {
      resultadoVenda = await criarVendaComItens(
        {
          clienteId,
          vendedorId: entrada.usuarioId,
          tipo: entrada.venda.tipo,
          justificativa: entrada.venda.justificativa,
          itens: [{ placaId: placa.id, precoCentavos: entrada.venda.precoCentavos, custoCentavos: entrada.venda.custoCentavos }],
          descontoCentavos: entrada.venda.descontoCentavos,
          observacoes: entrada.venda.observacoes,
          chaveIdempotencia: entrada.chaveIdempotencia,
        },
        client
      );
    }

    return { placa: placaAtualizada, venda: resultadoVenda };
  });
}

/**
 * Mudança explícita de destino ou vínculo de uma placa já ativa. Requer ação
 * deliberada (nunca acontece como efeito colateral de outra operação) e é
 * sempre registrada no histórico com o valor anterior.
 */
export async function alterarVinculoPlacaAtiva(entrada: {
  placaId: string;
  usuarioId: string;
  usuarioNome: string;
  novoEstabelecimentoId?: string;
  novoDestinoUrl?: string;
  destinoConfirmado: boolean;
  motivo: string;
}) {
  return transacao(async (client) => {
    const { rows } = await client.query("SELECT * FROM placas WHERE id = $1 FOR UPDATE", [entrada.placaId]);
    const placa = rows[0];
    if (!placa) throw new ErroAtivacao("placa_nao_encontrada", "Placa não encontrada.");

    const antes = { estabelecimentoId: placa.estabelecimento_id, destinoUrl: placa.destino_url };

    const sets: string[] = ["versao = versao + 1", "atualizado_em = now()"];
    const params: unknown[] = [entrada.placaId];
    if (entrada.novoEstabelecimentoId) {
      params.push(entrada.novoEstabelecimentoId);
      sets.push(`estabelecimento_id = $${params.length}`);
    }
    if (entrada.novoDestinoUrl) {
      params.push(entrada.novoDestinoUrl, entrada.usuarioNome);
      sets.push(`destino_url = $${params.length - 1}`, `destino_validado_em = now()`, `destino_validado_por = $${params.length}`);
    }

    await client.query(`UPDATE placas SET ${sets.join(", ")} WHERE id = $1`, params);

    await registrarHistorico(
      {
        tipo: entrada.novoEstabelecimentoId ? "MUDANCA_VINCULO" : "MUDANCA_DESTINO",
        usuarioId: entrada.usuarioId,
        placaId: entrada.placaId,
        detalhes: {
          antes,
          depois: { estabelecimentoId: entrada.novoEstabelecimentoId ?? antes.estabelecimentoId, destinoUrl: entrada.novoDestinoUrl ?? antes.destinoUrl },
          motivo: entrada.motivo,
          destinoConfirmadoAutomaticamente: entrada.destinoConfirmado,
        },
      },
      client
    );
  });
}

export async function desativarPlaca(entrada: { placaId: string; usuarioId: string; motivo: string }) {
  return transacao(async (client) => {
    await client.query(
      "UPDATE placas SET estado_comercial = 'DESATIVADA', atualizado_em = now(), versao = versao + 1 WHERE id = $1",
      [entrada.placaId]
    );
    await registrarHistorico(
      { tipo: "DESATIVACAO", usuarioId: entrada.usuarioId, placaId: entrada.placaId, detalhes: { motivo: entrada.motivo } },
      client
    );
  });
}

/**
 * Substitui uma placa danificada por uma nova unidade física, preservando o
 * histórico de ambas (a antiga nunca é apagada, apenas marcada como
 * SUBSTITUIDA e ligada à nova via `substituida_por_id`). O vínculo comercial
 * (cliente/estabelecimento/destino) migra para a nova placa.
 */
export async function substituirPlaca(entrada: {
  placaAntigaId: string;
  placaNovaId: string;
  usuarioId: string;
  motivo: string;
}) {
  return transacao(async (client) => {
    const { rows } = await client.query("SELECT * FROM placas WHERE id = $1 FOR UPDATE", [entrada.placaAntigaId]);
    const antiga = rows[0];
    if (!antiga) throw new ErroAtivacao("placa_nao_encontrada", "Placa antiga não encontrada.");

    const { rows: novaRows } = await client.query("SELECT * FROM placas WHERE id = $1 FOR UPDATE", [entrada.placaNovaId]);
    const nova = novaRows[0];
    if (!nova) throw new ErroAtivacao("placa_nao_encontrada", "Placa nova não encontrada.");
    if (nova.estado_comercial !== "DISPONIVEL") {
      throw new ErroAtivacao("estado_invalido", "A placa nova precisa estar disponível.");
    }

    await client.query(
      `UPDATE placas SET
         estabelecimento_id = $2, destino_url = $3, destino_validado_em = now(), destino_validado_por = $4,
         estado_comercial = 'ATIVA', ativada_em = now(), ativada_por = $4, versao = versao + 1, atualizado_em = now()
       WHERE id = $1`,
      [nova.id, antiga.estabelecimento_id, antiga.destino_url, "sistema:substituicao"]
    );

    await client.query(
      "UPDATE placas SET estado_comercial = 'SUBSTITUIDA', substituida_por_id = $2, versao = versao + 1, atualizado_em = now() WHERE id = $1",
      [antiga.id, nova.id]
    );

    await registrarHistorico(
      { tipo: "SUBSTITUICAO", usuarioId: entrada.usuarioId, placaId: antiga.id, detalhes: { substituidaPorId: nova.id, motivo: entrada.motivo } },
      client
    );
    await registrarHistorico(
      { tipo: "SUBSTITUICAO", usuarioId: entrada.usuarioId, placaId: nova.id, detalhes: { substituiA: antiga.id, motivo: entrada.motivo } },
      client
    );
  });
}

export function novaChaveIdempotencia(): string {
  return gerarTokenAleatorio();
}
