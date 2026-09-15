import { pool } from "@/lib/db/pool";
import type { PoolClient } from "pg";

export interface ClienteRegistro {
  id: string;
  nome: string;
  responsavel: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  arquivado_em: Date | null;
  vendedor_responsavel_id: string | null;
  criado_em: Date;
  atualizado_em: Date;
}

export async function criarCliente(
  dados: {
    nome: string;
    responsavel?: string;
    telefone?: string;
    email?: string;
    observacoes?: string;
    vendedorResponsavelId: string;
  },
  db: PoolClient | typeof pool = pool
) {
  const { rows } = await db.query<ClienteRegistro>(
    `INSERT INTO clientes (nome, responsavel, telefone, email, observacoes, vendedor_responsavel_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [
      dados.nome,
      dados.responsavel ?? null,
      dados.telefone ?? null,
      dados.email ?? null,
      dados.observacoes ?? null,
      dados.vendedorResponsavelId,
    ]
  );
  return rows[0];
}

export async function listarClientes(escopo: { vendedorId?: string; busca?: string }) {
  const condicoes: string[] = ["c.arquivado_em IS NULL"];
  const params: unknown[] = [];

  if (escopo.vendedorId) {
    params.push(escopo.vendedorId);
    condicoes.push(`c.vendedor_responsavel_id = $${params.length}`);
  }
  if (escopo.busca) {
    params.push(`%${escopo.busca}%`);
    condicoes.push(`(c.nome ILIKE $${params.length} OR c.telefone ILIKE $${params.length})`);
  }

  const { rows } = await pool.query(
    `SELECT c.*, u.nome AS vendedor_nome,
            (SELECT count(*) FROM estabelecimentos e WHERE e.cliente_id = c.id AND e.arquivado_em IS NULL) AS total_estabelecimentos,
            (SELECT count(*) FROM placas p JOIN estabelecimentos e ON e.id = p.estabelecimento_id WHERE e.cliente_id = c.id) AS total_placas
     FROM clientes c
     LEFT JOIN usuarios u ON u.id = c.vendedor_responsavel_id
     WHERE ${condicoes.join(" AND ")}
     ORDER BY c.criado_em DESC
     LIMIT 200`,
    params
  );
  return rows;
}

export async function buscarClientePorId(id: string) {
  const { rows } = await pool.query<ClienteRegistro>("SELECT * FROM clientes WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function atualizarCliente(
  id: string,
  dados: Partial<Pick<ClienteRegistro, "nome" | "responsavel" | "telefone" | "email" | "observacoes">>
) {
  const campos = Object.keys(dados);
  if (campos.length === 0) return;
  const sets = campos.map((c, i) => `${c} = $${i + 2}`).join(", ");
  await pool.query(
    `UPDATE clientes SET ${sets}, atualizado_em = now() WHERE id = $1`,
    [id, ...campos.map((c) => (dados as Record<string, unknown>)[c])]
  );
}

export async function arquivarCliente(id: string) {
  await pool.query("UPDATE clientes SET arquivado_em = now() WHERE id = $1", [id]);
}
