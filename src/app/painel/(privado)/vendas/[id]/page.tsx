import { notFound } from "next/navigation";
import { buscarVendaComDetalhes } from "@/lib/db/repo/vendas";
import { formatarBRL } from "@/lib/dinheiro";
import { formatarDataHora } from "@/lib/tempo";
import { PagamentoForm } from "./PagamentoForm";

export default async function PaginaVendaDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venda = await buscarVendaComDetalhes(id);
  if (!venda) notFound();

  const pago = (venda.pagamentos as any[]).filter((p) => !p.estornado_em).reduce((acc, p) => acc + p.valor_centavos, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Venda de {formatarDataHora(venda.criado_em)}</h1>
        <p className="text-sm text-slate-500">
          {venda.cliente_nome ?? "sem cliente"} · vendedor {venda.vendedor_nome} · tipo {venda.tipo}
        </p>
        {venda.justificativa && <p className="text-sm text-slate-500">Justificativa: {venda.justificativa}</p>}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <p className="text-xs text-slate-500">Total</p>
          <p className="font-semibold">{formatarBRL(venda.total_centavos)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <p className="text-xs text-slate-500">Pago</p>
          <p className="font-semibold">{formatarBRL(pago)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <p className="text-xs text-slate-500">Situação</p>
          <p className="font-semibold">{venda.situacao_pagamento}</p>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-500">Itens</h2>
        <ul className="space-y-1 text-sm">
          {(venda.itens as any[]).map((i) => (
            <li key={i.id} className="rounded-lg border border-slate-200 bg-white p-2">
              {i.placa_codigo} — preço {formatarBRL(i.preco_centavos)} · custo {formatarBRL(i.custo_centavos)}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-500">Pagamentos</h2>
        <ul className="mb-3 space-y-1 text-sm">
          {(venda.pagamentos as any[]).map((p) => (
            <li key={p.id} className="rounded-lg border border-slate-200 bg-white p-2">
              {formatarDataHora(p.data_pagamento)} · {p.forma} · {formatarBRL(p.valor_centavos)}
              {p.estornado_em && " (estornado)"}
            </li>
          ))}
          {(venda.pagamentos as any[]).length === 0 && <p className="text-slate-400">Nenhum pagamento registrado.</p>}
        </ul>
        {venda.situacao_pagamento !== "QUITADA" && <PagamentoForm vendaId={id} />}
      </section>
    </div>
  );
}
