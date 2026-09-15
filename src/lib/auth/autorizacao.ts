import "server-only";
import { obterUsuarioAtual, type UsuarioSessao } from "@/lib/auth/sessao";

/**
 * Erro lançado quando uma ação é bloqueada por falta de autenticação ou
 * permissão. Toda Server Action e Route Handler sensível deve chamar
 * `exigirUsuario()` ou `exigirAdmin()` no início — a autorização é sempre
 * resolvida no servidor, nunca apenas ocultando botões na interface.
 */
export class ErroAutorizacao extends Error {
  status: number;
  constructor(mensagem: string, status = 403) {
    super(mensagem);
    this.status = status;
  }
}

export async function exigirUsuario(): Promise<UsuarioSessao> {
  const usuario = await obterUsuarioAtual();
  if (!usuario) throw new ErroAutorizacao("Não autenticado.", 401);
  return usuario;
}

export async function exigirAdmin(): Promise<UsuarioSessao> {
  const usuario = await exigirUsuario();
  if (usuario.papel !== "ADMIN") {
    throw new ErroAutorizacao("Apenas administradores podem executar esta ação.");
  }
  return usuario;
}

/**
 * Um vendedor só pode consultar/alterar clientes, vendas e placas que lhe
 * pertencem (cadastrados por ele, ou placas explicitamente atribuídas a
 * ele). Administradores têm acesso completo. Esta função central evita que a
 * regra de escopo seja reimplementada (e possivelmente esquecida) em cada
 * rota.
 */
export function podeVerTudo(usuario: UsuarioSessao): boolean {
  return usuario.papel === "ADMIN";
}
