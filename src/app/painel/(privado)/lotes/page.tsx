import Link from "next/link";
import { listarLotes } from "@/lib/db/repo/lotes";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { formatarDataHora } from "@/lib/tempo";

export default async function PaginaLotes() {
  const usuario = await obterUsuarioAtual();
  const lotes = await listarLotes();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Lotes</h1>
        {usuario?.papel === "ADMIN" && (
          <Link href="/painel/lotes/novo" className="botao-toque flex items-center rounded-lg bg-blue-600 px-3 text-sm font-medium text-white">
            + Novo lote
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[500px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Quantidade</th>
              <th className="px-3 py-2">Disponíveis</th>
              <th className="px-3 py-2">Ativas</th>
              <th className="px-3 py-2">Criado em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lotes.map((l: any) => (
              <tr key={l.id}>
                <td className="px-3 py-2">
                  <Link href={`/painel/lotes/${l.id}`} className="font-medium text-blue-600">
                    {l.codigo}
                  </Link>
                </td>
                <td className="px-3 py-2">{l.quantidade}</td>
                <td className="px-3 py-2">{l.disponiveis}</td>
                <td className="px-3 py-2">{l.ativas}</td>
                <td className="px-3 py-2">{formatarDataHora(l.criado_em)}</td>
              </tr>
            ))}
            {lotes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  Nenhum lote criado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
