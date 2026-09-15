import { pool } from "@/lib/db/pool";
import type { PoolClient } from "pg";

export type TipoEventoHistorico =
  | "CRIACAO_LOTE"
  | "ATRIBUICAO_PLACA"
  | "ATIVACAO"
  | "MUDANCA_DESTINO"
  | "MUDANCA_VINCULO"
  | "DESATIVACAO"
  | "SUBSTITUICAO"
  | "ALTERACAO_PAGAMENTO"
  | "TRANSFERENCIA_VENDEDOR"
  | "OUTRO";

export async function registrarHistorico(
  dados: {
    tipo: TipoEventoHistorico;
    usuarioId?: string | null;
    placaId?: string | null;
    detalhes: Record<string, unknown>;
  },
  db: PoolClient | typeof pool = pool
) {
  await db.query(
    `INSERT INTO historico_alteracoes (placa_id, usuario_id, tipo, detalhes_json)
     VALUES ($1,$2,$3,$4)`,
    [dados.placaId ?? null, dados.usuarioId ?? null, dados.tipo, JSON.stringify(dados.detalhes)]
  );
}

export async function listarHistoricoDaPlaca(placaId: string) {
  const { rows } = await pool.query(
    `SELECT h.*, u.nome AS usuario_nome
     FROM historico_alteracoes h
     LEFT JOIN usuarios u ON u.id = h.usuario_id
     WHERE h.placa_id = $1
     ORDER BY h.criado_em DESC`,
    [placaId]
  );
  return rows;
}
