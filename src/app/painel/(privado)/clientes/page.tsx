import Link from "next/link";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { podeVerTudo } from "@/lib/auth/autorizacao";
import { listarClientes } from "@/lib/db/repo/clientes";

export default async function PaginaClientes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const usuario = await obterUsuarioAtual();
  const clientes = await listarClientes({
    vendedorId: podeVerTudo(usuario!) ? undefined : usuario!.id,
    busca: q,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Clientes</h1>
        <Link href="/painel/clientes/novo" className="botao-toque rounded-lg bg-blue-600 px-3 text-sm font-medium text-white flex items-center">
          + Novo cliente
        </Link>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome ou telefone"
          className="botao-toque flex-1 rounded-lg border border-slate-300 px-3"
        />
        <button className="botao-toque rounded-lg bg-slate-800 px-4 text-sm font-medium text-white">Buscar</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[500px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Telefone</th>
              <th className="px-3 py-2">Estabelecimentos</th>
              <th className="px-3 py-2">Placas</th>
              <th className="px-3 py-2">Vendedor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clientes.map((c: any) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <Link href={`/painel/clientes/${c.id}`} className="font-medium text-blue-600">
                    {c.nome}
                  </Link>
                </td>
                <td className="px-3 py-2">{c.telefone ?? "—"}</td>
                <td className="px-3 py-2">{c.total_estabelecimentos}</td>
                <td className="px-3 py-2">{c.total_placas}</td>
                <td className="px-3 py-2">{c.vendedor_nome ?? "—"}</td>
              </tr>
            ))}
            {clientes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
