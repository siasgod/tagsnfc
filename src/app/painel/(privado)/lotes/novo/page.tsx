import { redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { origemAtualConfigurada } from "@/lib/origem-publica";
import { LoteForm } from "./LoteForm";

export default async function PaginaNovoLote() {
  const usuario = await obterUsuarioAtual();
  if (usuario?.papel !== "ADMIN") redirect("/painel/lotes");

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-lg font-semibold">Novo lote</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <LoteForm origemAtual={origemAtualConfigurada()} />
      </div>
    </div>
  );
}
