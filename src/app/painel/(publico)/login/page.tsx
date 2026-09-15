import { LoginForm } from "./LoginForm";

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string }>;
}) {
  const { proximo } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-xl font-semibold text-slate-900">Painel de Placas</h1>
        <p className="mb-6 text-center text-sm text-slate-500">Entre com sua conta de equipe.</p>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm proximo={proximo} />
        </div>
      </div>
    </div>
  );
}
