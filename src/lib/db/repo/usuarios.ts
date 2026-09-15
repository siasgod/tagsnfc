import { pool } from "@/lib/db/pool";
import type { PapelUsuario } from "@/lib/auth/sessao";

export interface UsuarioRegistro {
  id: string;
  nome: string;
  email: string;
  senha_hash: string;
  papel: PapelUsuario;
  ativo: boolean;
  criado_em: Date;
}

export async function contarUsuarios(): Promise<number> {
  const { rows } = await pool.query<{ total: string }>("SELECT count(*)::text AS total FROM usuarios");
  return Number(rows[0].total);
}

export async function buscarUsuarioPorEmail(email: string) {
  const { rows } = await pool.query<UsuarioRegistro>(
    "SELECT * FROM usuarios WHERE lower(email) = lower($1)",
    [email]
  );
  return rows[0] ?? null;
}

export async function buscarUsuarioPorId(id: string) {
  const { rows } = await pool.query<UsuarioRegistro>("SELECT * FROM usuarios WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function criarUsuario(dados: {
  nome: string;
  email: string;
  senhaHash: string;
  papel: PapelUsuario;
}) {
  const { rows } = await pool.query<UsuarioRegistro>(
    `INSERT INTO usuarios (nome, email, senha_hash, papel)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [dados.nome, dados.email, dados.senhaHash, dados.papel]
  );
  return rows[0];
}

export async function listarVendedores() {
  const { rows } = await pool.query<Pick<UsuarioRegistro, "id" | "nome" | "email" | "papel" | "ativo">>(
    "SELECT id, nome, email, papel, ativo FROM usuarios WHERE papel = 'VENDEDOR' ORDER BY nome"
  );
  return rows;
}

export async function listarUsuarios() {
  const { rows } = await pool.query<Pick<UsuarioRegistro, "id" | "nome" | "email" | "papel" | "ativo" | "criado_em">>(
    "SELECT id, nome, email, papel, ativo, criado_em FROM usuarios ORDER BY criado_em"
  );
  return rows;
}

export async function definirAtivo(id: string, ativo: boolean) {
  await pool.query("UPDATE usuarios SET ativo = $2, atualizado_em = now() WHERE id = $1", [id, ativo]);
}
