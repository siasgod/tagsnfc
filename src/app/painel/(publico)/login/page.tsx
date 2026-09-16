import { LoginForm } from "./LoginForm";

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string }>;
}) {
  const { proximo } = await searchParams;

  return (
    <div className="grid min-h-dvh flex-1 bg-white lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-[#111a2e] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-28 -top-28 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-600 text-lg font-bold shadow-xl shadow-blue-900/30">T</span><div><strong className="block tracking-wide">TAGS NFC</strong><span className="text-xs text-slate-400">Gestão inteligente</span></div></div>
        <div className="relative max-w-xl"><p className="text-xs font-semibold uppercase tracking-[.18em] text-blue-300">Operação em um só lugar</p><h1 className="mt-4 text-4xl font-bold leading-tight tracking-[-.04em]">Da placa produzida à interação do cliente.</h1><p className="mt-5 max-w-lg text-base leading-7 text-slate-300">Controle vendas, equipe, clientes e o desempenho de cada QR e NFC com clareza.</p></div>
        <p className="relative text-xs text-slate-500">Painel seguro · acesso restrito à equipe</p>
      </section>
      <section className="flex items-center justify-center bg-[#f4f6f9] px-5 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 font-bold text-white">T</span><strong>TAGS NFC</strong></div>
          <p className="text-xs font-bold uppercase tracking-[.15em] text-blue-600">Bem-vindo de volta</p>
          <h2 className="mt-2 text-3xl font-bold tracking-[-.04em] text-slate-900">Acesse o painel</h2>
          <p className="mb-7 mt-2 text-sm text-slate-500">Entre com sua conta de equipe para continuar.</p>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_#17203310] sm:p-8">
            <LoginForm proximo={proximo} />
          </div>
        </div>
      </section>
    </div>
  );
}
