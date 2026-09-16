import "server-only";
import { pool } from "@/lib/db/pool";

export interface CategoriaCliente {
  id: string;
  nome: string;
  cor: string;
  ativo: boolean;
  criado_em: Date;
  atualizado_em: Date;
  total_clientes?: number;
}

export async function listarCategorias(incluirInativas = false) {
  const { rows } = await pool.query<CategoriaCliente & { total_clientes: number }>(
    `SELECT cc.*,
            (SELECT count(*)::int FROM clientes c WHERE c.categoria_id = cc.id AND c.arquivado_em IS NULL) AS total_clientes
     FROM categorias_clientes cc
     WHERE ($1::boolean OR cc.ativo = true)
     ORDER BY cc.ativo DESC, cc.nome`,
    [incluirInativas]
  );
  return rows;
}

export async function criarCategoria(dados: { nome: string; cor: string }) {
  const { rows } = await pool.query<CategoriaCliente>(
    `INSERT INTO categorias_clientes (nome, cor) VALUES ($1, $2) RETURNING *`,
    [dados.nome, dados.cor]
  );
  return rows[0];
}

export async function atualizarCategoria(id: string, dados: { nome: string; cor: string; ativo: boolean }) {
  await pool.query(
    `UPDATE categorias_clientes SET nome = $2, cor = $3, ativo = $4, atualizado_em = now() WHERE id = $1`,
    [id, dados.nome, dados.cor, dados.ativo]
  );
}

export async function excluirCategoria(id: string) {
  const { rows } = await pool.query<{ total: number }>(
    "SELECT count(*)::int AS total FROM clientes WHERE categoria_id = $1",
    [id]
  );
  if ((rows[0]?.total ?? 0) > 0) {
    throw new Error("A categoria está vinculada a clientes. Desative-a em vez de excluir.");
  }
  await pool.query("DELETE FROM categorias_clientes WHERE id = $1", [id]);
}
