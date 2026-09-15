import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Proxy (equivalente ao antigo "middleware" — renomeado a partir do Next.js
 * 16). Faz apenas uma verificação OTIMISTA: existe um cookie de sessão?
 * Isso evita mandar quem não tem cookie nenhum para páginas do painel antes
 * mesmo de consultar o banco, melhorando a percepção de velocidade.
 *
 * Importante: a documentação do Next.js recomenda explicitamente NÃO tratar
 * o Proxy como a solução completa de autorização. A verificação real —
 * validade da sessão no banco, papel do usuário, escopo sobre o recurso — é
 * sempre refeita em cada Server Action e Route Handler via
 * `exigirUsuario()`/`exigirAdmin()` (src/lib/auth/autorizacao.ts). Se este
 * arquivo for removido ou seu matcher for alterado, a segurança do sistema
 * não é afetada — apenas a experiência de redirecionamento antecipado.
 */
export function proxy(request: NextRequest) {
  const temCookieSessao = request.cookies.has("sessao");
  const { pathname } = request.nextUrl;

  const rotasPublicas = ["/painel/login", "/painel/setup"];
  const rotaProtegida = pathname.startsWith("/painel") && !rotasPublicas.includes(pathname);

  if (rotaProtegida && !temCookieSessao) {
    const destino = new URL("/painel/login", request.url);
    destino.searchParams.set("proximo", pathname);
    return NextResponse.redirect(destino);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/painel/:path*"],
};
