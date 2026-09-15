import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { pool } from "@/lib/db/pool";

const NOME_COOKIE = "sessao";
const DURACAO_SESSAO_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export type PapelUsuario = "ADMIN" | "VENDEDOR";

export interface UsuarioSessao {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Autenticação própria (sessão em banco de dados) em vez de Supabase Auth.
 *
 * Motivo da adaptação: a especificação pede preferencialmente Supabase Auth,
 * mas este ambiente de desenvolvimento não possui uma conta/projeto Supabase
 * configurado (sem credenciais disponíveis) — ver README, seção "Adaptações
 * de arquitetura". Implementamos autenticação por sessão persistida no
 * próprio Postgres: senha com bcrypt, token de sessão aleatório de 256 bits
 * cujo hash (nunca o valor bruto) é guardado no banco, cookie httpOnly +
 * Secure + SameSite=Lax, e revogação real (permite logout e expiração
 * verificáveis no servidor, diferente de um JWT stateless). Migrar para
 * Supabase Auth mais tarde é possível sem reestruturar o restante do app,
 * pois toda a autorização é resolvida a partir de `obterUsuarioAtual()`.
 */
export async function criarSessao(
  usuarioId: string,
  contexto: { userAgent?: string | null; ip?: string | null }
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiraEm = new Date(Date.now() + DURACAO_SESSAO_MS);

  await pool.query(
    `INSERT INTO sessoes (usuario_id, token_hash, expira_em, user_agent, ip)
     VALUES ($1, $2, $3, $4, $5)`,
    [usuarioId, tokenHash, expiraEm, contexto.userAgent ?? null, contexto.ip ?? null]
  );

  const store = await cookies();
  store.set(NOME_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiraEm,
  });

  return token;
}

export async function encerrarSessaoAtual(): Promise<void> {
  const store = await cookies();
  const token = store.get(NOME_COOKIE)?.value;
  if (token) {
    await pool.query(
      "UPDATE sessoes SET revogado_em = now() WHERE token_hash = $1",
      [hashToken(token)]
    );
  }
  store.delete(NOME_COOKIE);
}

export async function obterUsuarioAtual(): Promise<UsuarioSessao | null> {
  const store = await cookies();
  const token = store.get(NOME_COOKIE)?.value;
  if (!token) return null;

  const { rows } = await pool.query<{
    id: string;
    nome: string;
    email: string;
    papel: PapelUsuario;
    ativo: boolean;
  }>(
    `SELECT u.id, u.nome, u.email, u.papel, u.ativo
     FROM sessoes s
     JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.token_hash = $1
       AND s.revogado_em IS NULL
       AND s.expira_em > now()`,
    [hashToken(token)]
  );

  const usuario = rows[0];
  if (!usuario || !usuario.ativo) return null;

  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
  };
}
