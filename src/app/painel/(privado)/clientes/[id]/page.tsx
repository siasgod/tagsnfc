import { notFound } from "next/navigation";
import { buscarClientePorId } from "@/lib/db/repo/clientes";
import { listarEstabelecimentosPorCliente } from "@/lib/db/repo/estabelecimentos";
import { listarPlacasPorCliente } from "@/lib/db/repo/placas";
import { listarVendasPorCliente } from "@/lib/db/repo/vendas";
import { formatarBRL } from "@/lib/dinheiro";
import { formatarData } from "@/lib/tempo";
import Link from "next/link";
import { NovoEstabelecimentoForm } from "./NovoEstabelecimentoForm";

export default async function PaginaClienteDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cliente = await buscarClientePorId(id);
  if (!cliente) notFound();

  const [estabelecimentos, placas, vendas] = await Promise.all([
    listarEstabelecimentosPorCliente(id),
    listarPlacasPorCliente(id),
    listarVendasPorCliente(id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">{cliente.nome}</h1>
        <p className="text-sm text-slate-500">
          {cliente.telefone ?? "sem telefone"} {cliente.email ? `· ${cliente.email}` : ""}
        </p>
        {cliente.observacoes && <p className="mt-1 text-sm text-slate-600">{cliente.observacoes}</p>}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-500">Estabelecimentos</h2>
        <ul className="space-y-2">
          {estabelecimentos.map((e) => (
            <li key={e.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="font-medium">{e.nome}</p>
              {e.endereco && <p className="text-xs text-slate-500">{e.endereco}</p>}
              {e.link_avaliacao && <p className="truncate text-xs text-blue-600">{e.link_avaliacao}</p>}
            </li>
          ))}
        </ul>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-blue-600">+ Adicionar estabelecimento</summary>
          <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
            <NovoEstabelecimentoForm clienteId={id} />
          </div>
        </details>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-500">Placas vinculadas</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[400px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Estabelecimento</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {placas.map((p: any) => (
                <tr key={p.id}>
                  <td data-label="Código" className="px-3 py-2">
                    <Link href={`/painel/placas/${p.id}`} className="text-blue-600">
                      {p.codigo}
                    </Link>
                  </td>
                  <td data-label="Estabelecimento" className="px-3 py-2">{p.estabelecimento_nome}</td>
                  <td data-label="Estado" className="px-3 py-2">{p.estado_comercial}</td>
                </tr>
              ))}
              {placas.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-slate-400">
                    Nenhuma placa vinculada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-500">Vendas e pagamentos</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[500px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Data</th>
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
                      {formatarData(v.criado_em)}
                    </Link>
                  </td>
                  <td data-label="Tipo" className="px-3 py-2">{v.tipo}</td>
                  <td data-label="Total" className="px-3 py-2">{formatarBRL(v.total_centavos)}</td>
                  <td data-label="Pago" className="px-3 py-2">{formatarBRL(Number(v.pago_centavos))}</td>
                  <td data-label="Situação" className="px-3 py-2">{v.situacao_pagamento}</td>
                </tr>
              ))}
              {vendas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                    Nenhuma venda registrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
