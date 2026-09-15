import Link from "next/link";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { podeVerTudo } from "@/lib/auth/autorizacao";
import { listarVendas } from "@/lib/db/repo/vendas";
import { formatarBRL } from "@/lib/dinheiro";
import { formatarDataHora } from "@/lib/tempo";

export default async function PaginaVendas() {
  const usuario = await obterUsuarioAtual();
  const vendas = await listarVendas({ vendedorId: podeVerTudo(usuario!) ? undefined : usuario!.id });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Vendas</h1>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Pago</th>
              <th className="px-3 py-2">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vendas.map((v: any) => (
              <tr key={v.id}>
                <td data-label="Data" className="px-3 py-2">
                  <Link href={`/painel/vendas/${v.id}`} className="text-blue-600">
                    {formatarDataHora(v.criado_em)}
                  </Link>
                </td>
                <td data-label="Cliente" className="px-3 py-2">{v.cliente_nome ?? "—"}</td>
                <td data-label="Tipo" className="px-3 py-2">{v.tipo}</td>
                <td data-label="Total" className="px-3 py-2">{formatarBRL(v.total_centavos)}</td>
                <td data-label="Pago" className="px-3 py-2">{formatarBRL(Number(v.pago_centavos))}</td>
                <td data-label="Situação" className="px-3 py-2">{v.situacao_pagamento}</td>
              </tr>
            ))}
            {vendas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                  Nenhuma venda registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
