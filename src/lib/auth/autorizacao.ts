import "server-only";
import { obterUsuarioAtual, type UsuarioSessao } from "@/lib/auth/sessao";
import { pool } from "@/lib/db/pool";

export type Permissao =
  | "DASHBOARD_VER"
  | "DESEMPENHO_VER"
  | "CLIENTES_VER"
  | "CLIENTES_EDITAR"
  | "PLACAS_VER"
  | "PLACAS_EDITAR"
  | "LOTES_VER"
  | "LOTES_CRIAR"
  | "VENDAS_VER"
  | "VENDAS_EDITAR"
  | "ATIVAR_PLACA"
  | "EQUIPE_VER"
  | "EQUIPE_EDITAR"
  | "CONFIGURACOES_VER"
  | "CONFIGURACOES_EDITAR";

const TODAS: Permissao[] = [
  "DASHBOARD_VER", "DESEMPENHO_VER", "CLIENTES_VER", "CLIENTES_EDITAR",
  "PLACAS_VER", "PLACAS_EDITAR", "LOTES_VER", "LOTES_CRIAR", "VENDAS_VER",
  "VENDAS_EDITAR", "ATIVAR_PLACA", "EQUIPE_VER", "EQUIPE_EDITAR",
  "CONFIGURACOES_VER", "CONFIGURACOES_EDITAR",
];

const PERMISSOES: Record<UsuarioSessao["papel"], ReadonlySet<Permissao>> = {
  ADMIN: new Set(TODAS),
  GERENTE: new Set([
    "DASHBOARD_VER", "DESEMPENHO_VER", "CLIENTES_VER", "CLIENTES_EDITAR",
    "PLACAS_VER", "PLACAS_EDITAR", "LOTES_VER", "LOTES_CRIAR", "VENDAS_VER",
    "VENDAS_EDITAR", "ATIVAR_PLACA", "EQUIPE_VER",
  ]),
  VENDEDOR: new Set([
    "DASHBOARD_VER", "DESEMPENHO_VER", "CLIENTES_VER", "CLIENTES_EDITAR",
    "PLACAS_VER", "PLACAS_EDITAR", "LOTES_VER", "VENDAS_VER", "VENDAS_EDITAR",
    "ATIVAR_PLACA",
  ]),
  VISUALIZADOR: new Set([
    "DASHBOARD_VER", "DESEMPENHO_VER", "CLIENTES_VER", "PLACAS_VER", "LOTES_VER",
    "VENDAS_VER", "EQUIPE_VER",
  ]),
};

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

export function temPermissao(usuario: UsuarioSessao, permissao: Permissao): boolean {
  return PERMISSOES[usuario.papel].has(permissao);
}

export async function exigirPermissao(permissao: Permissao): Promise<UsuarioSessao> {
  const usuario = await exigirUsuario();
  if (!temPermissao(usuario, permissao)) {
    throw new ErroAutorizacao("Você não tem permissão para executar esta ação.");
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
  return usuario.papel !== "VENDEDOR";
}

export async function exigirAcessoCliente(usuario: UsuarioSessao, clienteId: string): Promise<void> {
  if (podeVerTudo(usuario)) return;
  const { rowCount } = await pool.query(
    "SELECT 1 FROM clientes WHERE id = $1 AND vendedor_responsavel_id = $2",
    [clienteId, usuario.id]
  );
  if (!rowCount) throw new ErroAutorizacao("Cliente fora do seu escopo comercial.");
}

export async function exigirAcessoPlaca(usuario: UsuarioSessao, placaId: string): Promise<void> {
  if (podeVerTudo(usuario)) return;
  const { rowCount } = await pool.query(
    `SELECT 1 FROM placas p
     LEFT JOIN estabelecimentos e ON e.id = p.estabelecimento_id
     LEFT JOIN clientes c ON c.id = e.cliente_id
     WHERE p.id = $1 AND (p.vendedor_atribuido_id = $2 OR c.vendedor_responsavel_id = $2)`,
    [placaId, usuario.id]
  );
  if (!rowCount) throw new ErroAutorizacao("Placa fora do seu escopo comercial.");
}

export async function exigirAcessoVenda(usuario: UsuarioSessao, vendaId: string): Promise<void> {
  if (podeVerTudo(usuario)) return;
  const { rowCount } = await pool.query(
    "SELECT 1 FROM vendas WHERE id = $1 AND vendedor_id = $2",
    [vendaId, usuario.id]
  );
  if (!rowCount) throw new ErroAutorizacao("Venda fora do seu escopo comercial.");
}
