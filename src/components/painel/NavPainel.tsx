import Link from "next/link";
import { sair } from "@/lib/actions/auth";
import type { UsuarioSessao } from "@/lib/auth/sessao";

const LINKS = [
  { href: "/painel", label: "Início" },
  { href: "/painel/placas", label: "Placas" },
  { href: "/painel/lotes", label: "Lotes" },
  { href: "/painel/clientes", label: "Clientes" },
  { href: "/painel/vendas", label: "Vendas" },
];

export function NavPainel({ usuario }: { usuario: UsuarioSessao }) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/painel" className="font-semibold text-slate-900">
            Painel de Placas
          </Link>
          <nav className="hidden gap-4 text-sm text-slate-600 sm:flex">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-blue-600">
                {l.label}
              </Link>
            ))}
            {usuario.papel === "ADMIN" && (
              <Link href="/painel/configuracoes" className="hover:text-blue-600">
                Configurações
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/painel/ativar"
              className="botao-toque hidden items-center rounded-lg bg-blue-600 px-4 font-medium text-white hover:bg-blue-700 sm:inline-flex"
            >
              Ativar placa
            </Link>
            <span className="hidden text-sm text-slate-500 md:inline">{usuario.nome}</span>
            <form action={sair}>
              <button className="text-sm text-slate-500 hover:text-slate-800" type="submit">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Barra inferior fixa para celular: acesso rápido + botão de ativação em destaque. */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex items-stretch border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom,0px)] sm:hidden">
        {LINKS.slice(0, 2).map((l) => (
          <Link key={l.href} href={l.href} className="flex-1 py-3 text-center text-xs text-slate-600">
            {l.label}
          </Link>
        ))}
        <Link
          href="/painel/ativar"
          className="botao-toque -mt-4 flex flex-1 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white shadow-lg"
        >
          Ativar
        </Link>
        {LINKS.slice(3).map((l) => (
          <Link key={l.href} href={l.href} className="flex-1 py-3 text-center text-xs text-slate-600">
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
