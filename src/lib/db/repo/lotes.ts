import { pool, transacao } from "@/lib/db/pool";
import { gerarCodigoHumano, gerarCodigoLote, gerarTokenAleatorio } from "@/lib/tokens";
import { registrarHistorico } from "@/lib/db/repo/historico";
import type { PoolClient } from "pg";
import type { PlacaRegistro } from "@/lib/db/repo/placas";

export interface LoteRegistro {
  id: string;
  codigo: string;
  quantidade: number;
  origem_publica_usada: string;
  template_versao: string;
  parametros_impressao: Record<string, unknown>;
  custo_unitario_centavos: number | null;
  criado_por_id: string | null;
  criado_em: Date;
  observacoes: string | null;
}

async function proximoSequencial(client: PoolClient, tabela: "lotes" | "placas"): Promise<number> {
  const { rows } = await client.query<{ total: string }>(`SELECT count(*)::text AS total FROM ${tabela}`);
  return Number(rows[0].total) + 1;
}

/**
 * Cria um lote e todas as suas placas em uma única transação. Códigos e
 * tokens são gerados com verificação de unicidade dentro da própria
 * transação (a constraint UNIQUE do banco é a garantia final contra
 * duplicidade — mesmo sob concorrência).
 */
export async function criarLoteComPlacas(dados: {
  quantidade: number;
  origemPublica: string;
  templateVersao: string;
  parametrosImpressao: Record<string, unknown>;
  custoUnitarioCentavos?: number;
  criadoPorId: string;
  observacoes?: string;
}) {
  return transacao(async (client) => {
    const seqLote = await proximoSequencial(client, "lotes");
    const codigoLote = gerarCodigoLote(seqLote);

    const { rows: loteRows } = await client.query<LoteRegistro>(
      `INSERT INTO lotes (codigo, quantidade, origem_publica_usada, template_versao, parametros_impressao, custo_unitario_centavos, criado_por_id, observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        codigoLote,
        dados.quantidade,
        dados.origemPublica,
        dados.templateVersao,
        JSON.stringify(dados.parametrosImpressao),
        dados.custoUnitarioCentavos ?? null,
        dados.criadoPorId,
        dados.observacoes ?? null,
      ]
    );
    const lote = loteRows[0];

    let seqPlaca = await proximoSequencial(client, "placas");
    const placas = [];
    for (let i = 0; i < dados.quantidade; i++) {
      const codigo = gerarCodigoHumano(seqPlaca++);
      const token = gerarTokenAleatorio();
      const urlQr = `${dados.origemPublica}/p/${token}?via=qr`;
      const urlNfc = `${dados.origemPublica}/p/${token}?via=nfc`;

      const { rows } = await client.query(
        `INSERT INTO placas (codigo, token, lote_id, origem_publica_producao, url_qr, url_nfc)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [codigo, token, lote.id, dados.origemPublica, urlQr, urlNfc]
      );
      placas.push(rows[0]);
    }

    await registrarHistorico(
      { tipo: "CRIACAO_LOTE", usuarioId: dados.criadoPorId, detalhes: { loteId: lote.id, codigo: lote.codigo, quantidade: dados.quantidade } },
      client
    );

    return { lote, placas };
  });
}

export async function listarLotes() {
  const { rows } = await pool.query<LoteRegistro & { criado_por_nome: string | null; disponiveis: string; ativas: string }>(
    `SELECT l.*, u.nome AS criado_por_nome,
            (SELECT count(*) FROM placas p WHERE p.lote_id = l.id AND p.estado_comercial = 'DISPONIVEL') AS disponiveis,
            (SELECT count(*) FROM placas p WHERE p.lote_id = l.id AND p.estado_comercial = 'ATIVA') AS ativas
     FROM lotes l
     LEFT JOIN usuarios u ON u.id = l.criado_por_id
     ORDER BY l.criado_em DESC`
  );
  return rows;
}

export async function buscarLotePorId(id: string) {
  const { rows } = await pool.query<LoteRegistro>("SELECT * FROM lotes WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function listarPlacasDoLote(loteId: string) {
  const { rows } = await pool.query<PlacaRegistro & { estabelecimento_nome: string | null; cliente_nome: string | null; vendedor_nome: string | null }>(
    `SELECT p.*, e.nome AS estabelecimento_nome, c.nome AS cliente_nome, v.nome AS vendedor_nome
     FROM placas p
     LEFT JOIN estabelecimentos e ON e.id = p.estabelecimento_id
     LEFT JOIN clientes c ON c.id = e.cliente_id
     LEFT JOIN usuarios v ON v.id = p.vendedor_atribuido_id
     WHERE p.lote_id = $1
     ORDER BY p.codigo`,
    [loteId]
  );
  return rows;
}
