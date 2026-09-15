import { pool } from "@/lib/db/pool";
import type { PoolClient } from "pg";

export interface EstabelecimentoRegistro {
  id: string;
  cliente_id: string;
  nome: string;
  endereco: string | null;
  link_perfil_google: string | null;
  link_avaliacao: string | null;
  observacoes: string | null;
  arquivado_em: Date | null;
  criado_em: Date;
}

export async function criarEstabelecimento(
  dados: {
    clienteId: string;
    nome: string;
    endereco?: string;
    linkPerfilGoogle?: string;
    linkAvaliacao?: string;
    observacoes?: string;
  },
  db: PoolClient | typeof pool = pool
) {
  const { rows } = await db.query<EstabelecimentoRegistro>(
    `INSERT INTO estabelecimentos (cliente_id, nome, endereco, link_perfil_google, link_avaliacao, observacoes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [
      dados.clienteId,
      dados.nome,
      dados.endereco ?? null,
      dados.linkPerfilGoogle ?? null,
      dados.linkAvaliacao ?? null,
      dados.observacoes ?? null,
    ]
  );
  return rows[0];
}

export async function listarEstabelecimentosPorCliente(clienteId: string) {
  const { rows } = await pool.query<EstabelecimentoRegistro>(
    "SELECT * FROM estabelecimentos WHERE cliente_id = $1 AND arquivado_em IS NULL ORDER BY nome",
    [clienteId]
  );
  return rows;
}

export async function buscarEstabelecimentoPorId(id: string) {
  const { rows } = await pool.query<EstabelecimentoRegistro>(
    "SELECT * FROM estabelecimentos WHERE id = $1",
    [id]
  );
  return rows[0] ?? null;
}
