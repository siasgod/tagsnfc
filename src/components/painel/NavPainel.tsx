import Link from "next/link";
import { LinkNavegacao } from "./LinkNavegacao";
import { sair } from "@/lib/actions/auth";
import type { UsuarioSessao } from "@/lib/auth/sessao";
import { temPermissao } from "@/lib/auth/autorizacao";

const LINKS = [
  { href: "/painel", label: "Visão geral", simbolo: "⌂", permissao: "DASHBOARD_VER" as const },
  { href: "/painel/desempenho", label: "Desempenho", simbolo: "↗", permissao: "DESEMPENHO_VER" as const },
  { href: "/painel/placas", label: "Placas", simbolo: "▣", permissao: "PLACAS_VER" as const },
  { href: "/painel/clientes", label: "Clientes", simbolo: "◉", permissao: "CLIENTES_VER" as const },
  { href: "/painel/estabelecimentos", label: "Estabelecimentos", simbolo: "⌂", permissao: "CLIENTES_VER" as const },
  { href: "/painel/vendas", label: "Vendas", simbolo: "$", permissao: "VENDAS_VER" as const },
  { href: "/painel/lotes", label: "Lotes", simbolo: "▦", permissao: "LOTES_VER" as const },
  { href: "/painel/equipe", label: "Equipe", simbolo: "◎", permissao: "EQUIPE_VER" as const },
];

export function NavPainel({ usuario }: { usuario: UsuarioSessao }) {
  return (
    <>
      <aside className="sidebar hidden lg:flex">
        <Link href="/painel" className="brand">
          <span className="brand-mark">T</span>
          <span><strong>TAGS NFC</strong><small>Gestão inteligente</small></span>
        </Link>
        <form action="/painel/busca" className="global-search">
          <span aria-hidden="true">⌕</span>
          <input name="q" aria-label="Busca global" placeholder="Buscar cliente, local ou placa" />
        </form>
        <nav className="sidebar-nav" aria-label="Navegação principal">
          {LINKS.filter((l) => temPermissao(usuario, l.permissao)).map((l) => (
            <LinkNavegacao key={l.href} href={l.href} simbolo={l.simbolo}>{l.label}</LinkNavegacao>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {temPermissao(usuario, "CONFIGURACOES_VER") ? (
            <LinkNavegacao href="/painel/configuracoes" simbolo="⚙">Configurações</LinkNavegacao>
          ) : null}
          <div className="user-card">
            <span className="user-avatar">{usuario.nome.slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0 flex-1"><strong>{usuario.nome}</strong><small>{usuario.papel}</small></span>
            <form action={sair}><button type="submit" aria-label="Sair">↪</button></form>
          </div>
        </div>
      </aside>

      <header className="mobile-header lg:hidden">
        <Link href="/painel" className="brand"><span className="brand-mark">T</span><strong>TAGS NFC</strong></Link>
        <div className="flex items-center gap-2">
          <Link href="/painel/busca" className="icon-button" aria-label="Buscar">⌕</Link>
          {temPermissao(usuario, "ATIVAR_PLACA") ? <Link href="/painel/ativar" className="button button-primary button-small">Ativar</Link> : null}
        </div>
      </header>

      <nav className="mobile-nav lg:hidden" aria-label="Navegação móvel">
        {LINKS.filter((l) => ["/painel", "/painel/desempenho", "/painel/placas", "/painel/clientes"].includes(l.href)).map((l) => (
          <LinkNavegacao key={l.href} href={l.href} simbolo={l.simbolo}>{l.label}</LinkNavegacao>
        ))}
        <LinkNavegacao href="/painel/equipe" simbolo="•••">Mais</LinkNavegacao>
      </nav>
    </>
  );
}
