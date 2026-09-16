import { pool, transacao } from "@/lib/db/pool";
import { registrarHistorico } from "@/lib/db/repo/historico";
import type { PoolClient } from "pg";

export interface VendaRegistro {
  id: string;
  cliente_id: string | null;
  vendedor_id: string;
  tipo: "VENDA" | "DEMONSTRACAO" | "BONIFICACAO";
  justificativa: string | null;
  total_centavos: number;
  desconto_centavos: number;
  situacao_pagamento: "PENDENTE" | "PARCIAL" | "QUITADA" | "CANCELADA";
  observacoes: string | null;
  chave_idempotencia: string | null;
  criado_em: Date;
}

export interface ItemVendaDetalhe {
  id: string;
  venda_id: string;
  placa_id: string;
  placa_codigo: string;
  preco_centavos: number;
  custo_centavos: number;
}

export interface PagamentoRegistro {
  id: string;
  venda_id: string;
  forma: "PIX" | "DINHEIRO" | "CARTAO" | "OUTRO";
  valor_centavos: number;
  data_pagamento: Date;
  observacoes: string | null;
  estornado_em: Date | null;
}

export interface VendaDetalhe extends VendaRegistro {
  cliente_nome: string | null;
  vendedor_nome: string;
  itens: ItemVendaDetalhe[];
  pagamentos: PagamentoRegistro[];
}

/**
 * Cria uma venda com um ou mais itens (placas). Preço e custo são
 * congelados no momento da venda (colunas próprias em itens_venda), então
 * uma mudança futura no preço padrão não altera vendas já registradas.
 *
 * Idempotência: se `chaveIdempotencia` já existir, retorna a venda existente
 * em vez de criar uma duplicata — protege contra duplo toque / retry de rede
 * no fluxo de ativação no iPhone.
 */
export async function criarVendaComItens(
  dados: {
    clienteId: string | null;
    vendedorId: string;
    tipo: "VENDA" | "DEMONSTRACAO" | "BONIFICACAO";
    justificativa?: string;
    itens: { placaId: string; precoCentavos: number; custoCentavos: number }[];
    descontoCentavos?: number;
    observacoes?: string;
    chaveIdempotencia: string;
  },
  clientExterno?: PoolClient
) {
  const executar = async (client: PoolClient) => {
    const existente = await client.query<VendaRegistro>(
      "SELECT * FROM vendas WHERE chave_idempotencia = $1",
      [dados.chaveIdempotencia]
    );
    if (existente.rows[0]) {
      return { venda: existente.rows[0], duplicada: true };
    }

    const totalCentavos =
      dados.itens.reduce((acc, i) => acc + i.precoCentavos, 0) - (dados.descontoCentavos ?? 0);

    const { rows: vendaRows } = await client.query<VendaRegistro>(
      `INSERT INTO vendas (cliente_id, vendedor_id, tipo, justificativa, total_centavos, desconto_centavos, observacoes, chave_idempotencia)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        dados.clienteId,
        dados.vendedorId,
        dados.tipo,
        dados.justificativa ?? null,
        Math.max(totalCentavos, 0),
        dados.descontoCentavos ?? 0,
        dados.observacoes ?? null,
        dados.chaveIdempotencia,
      ]
    );
    const venda = vendaRows[0];

    for (const item of dados.itens) {
      await client.query(
        `INSERT INTO itens_venda (venda_id, placa_id, preco_centavos, custo_centavos)
         VALUES ($1,$2,$3,$4)`,
        [venda.id, item.placaId, item.precoCentavos, item.custoCentavos]
      );
    }

    await registrarHistorico(
      { tipo: "OUTRO", usuarioId: dados.vendedorId, detalhes: { evento: "venda_criada", vendaId: venda.id, tipo: dados.tipo } },
      client
    );

    return { venda, duplicada: false };
  };

  if (clientExterno) return executar(clientExterno);
  return transacao(executar);
}

export async function registrarPagamento(dados: {
  vendaId: string;
  forma: "PIX" | "DINHEIRO" | "CARTAO" | "OUTRO";
  valorCentavos: number;
  observacoes?: string;
  usuarioId: string;
}) {
  return transacao(async (client) => {
    await client.query(
      `INSERT INTO pagamentos (venda_id, forma, valor_centavos, observacoes)
       VALUES ($1,$2,$3,$4)`,
      [dados.vendaId, dados.forma, dados.valorCentavos, dados.observacoes ?? null]
    );

    const { rows } = await client.query<{ total_centavos: number; pago_centavos: string }>(
      `SELECT v.total_centavos,
              coalesce((SELECT sum(p.valor_centavos) FROM pagamentos p WHERE p.venda_id = v.id AND p.estornado_em IS NULL), 0)::text AS pago_centavos
       FROM vendas v WHERE v.id = $1`,
      [dados.vendaId]
    );
    const { total_centavos, pago_centavos } = rows[0];
    const pago = Number(pago_centavos);
    const situacao = pago <= 0 ? "PENDENTE" : pago >= total_centavos ? "QUITADA" : "PARCIAL";

    await client.query("UPDATE vendas SET situacao_pagamento = $2, atualizado_em = now() WHERE id = $1", [
      dados.vendaId,
      situacao,
    ]);

    await registrarHistorico(
      { tipo: "ALTERACAO_PAGAMENTO", usuarioId: dados.usuarioId, detalhes: { vendaId: dados.vendaId, valorCentavos: dados.valorCentavos, situacaoResultante: situacao } },
      client
    );

    return { situacao, pagoCentavos: pago, totalCentavos: total_centavos };
  });
}

export async function listarVendas(filtro: { vendedorId?: string }) {
  const condicoes: string[] = ["1=1"];
  const params: unknown[] = [];
  if (filtro.vendedorId) {
    params.push(filtro.vendedorId);
    condicoes.push(`v.vendedor_id = $${params.length}`);
  }
  const { rows } = await pool.query(
    `SELECT v.*, c.nome AS cliente_nome, u.nome AS vendedor_nome,
            coalesce((SELECT sum(p.valor_centavos) FROM pagamentos p WHERE p.venda_id = v.id AND p.estornado_em IS NULL), 0) AS pago_centavos,
            (SELECT count(*) FROM itens_venda iv WHERE iv.venda_id = v.id) AS quantidade_itens
     FROM vendas v
     LEFT JOIN clientes c ON c.id = v.cliente_id
     JOIN usuarios u ON u.id = v.vendedor_id
     WHERE ${condicoes.join(" AND ")} AND v.cancelada_em IS NULL
     ORDER BY v.criado_em DESC
     LIMIT 300`,
    params
  );
  return rows;
}

export async function listarVendasPorCliente(clienteId: string) {
  const { rows } = await pool.query(
    `SELECT v.*, u.nome AS vendedor_nome,
            coalesce((SELECT sum(p.valor_centavos) FROM pagamentos p WHERE p.venda_id = v.id AND p.estornado_em IS NULL), 0) AS pago_centavos
     FROM vendas v
     JOIN usuarios u ON u.id = v.vendedor_id
     WHERE v.cliente_id = $1
     ORDER BY v.criado_em DESC`,
    [clienteId]
  );
  return rows;
}

export async function buscarVendaComDetalhes(id: string) {
  const { rows } = await pool.query<VendaRegistro & { cliente_nome: string | null; vendedor_nome: string }>(
    `SELECT v.*, c.nome AS cliente_nome, u.nome AS vendedor_nome
     FROM vendas v
     LEFT JOIN clientes c ON c.id = v.cliente_id
     JOIN usuarios u ON u.id = v.vendedor_id
     WHERE v.id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  const { rows: itens } = await pool.query<ItemVendaDetalhe>(
    `SELECT iv.*, p.codigo AS placa_codigo FROM itens_venda iv JOIN placas p ON p.id = iv.placa_id WHERE iv.venda_id = $1`,
    [id]
  );
  const { rows: pagamentos } = await pool.query<PagamentoRegistro>(
    `SELECT * FROM pagamentos WHERE venda_id = $1 ORDER BY data_pagamento`,
    [id]
  );
  return { ...rows[0], itens, pagamentos } satisfies VendaDetalhe;
}
