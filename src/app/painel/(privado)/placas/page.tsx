import Link from "next/link";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { podeVerTudo } from "@/lib/auth/autorizacao";
import { listarPlacas } from "@/lib/db/repo/placas";

export default async function PaginaPlacas({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const { q, estado } = await searchParams;
  const usuario = await obterUsuarioAtual();
  const placas = await listarPlacas({
    vendedorId: podeVerTudo(usuario!) ? undefined : usuario!.id,
    busca: q,
    estadoComercial: estado,
  });

  const ESTADOS = ["DISPONIVEL", "RESERVADA", "ATIVA", "DESATIVADA", "SUBSTITUIDA", "PERDIDA"];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Placas</h1>

      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Código, estabelecimento, telefone" className="botao-toque flex-1 min-w-[180px] rounded-lg border border-slate-300 px-3" />
        <select name="estado" defaultValue={estado ?? ""} className="botao-toque rounded-lg border border-slate-300 px-3">
          <option value="">Todos os estados</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <button className="botao-toque rounded-lg bg-slate-800 px-4 text-sm font-medium text-white">Filtrar</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Estabelecimento</th>
              <th className="px-3 py-2">Vendedor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {placas.map((p: any) => (
              <tr key={p.id}>
                <td data-label="Código" className="px-3 py-2">
                  <Link href={`/painel/placas/${p.id}`} className="font-medium text-blue-600">
                    {p.codigo}
                  </Link>
                </td>
                <td data-label="Estado" className="px-3 py-2">{p.estado_comercial}</td>
                <td data-label="Estabelecimento" className="px-3 py-2">{p.estabelecimento_nome ?? "—"}</td>
                <td data-label="Vendedor" className="px-3 py-2">{p.vendedor_nome ?? "—"}</td>
              </tr>
            ))}
            {placas.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                  Nenhuma placa encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
