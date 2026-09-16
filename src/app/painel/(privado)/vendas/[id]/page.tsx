import { notFound } from "next/navigation";
import { buscarVendaComDetalhes } from "@/lib/db/repo/vendas";
import { formatarBRL } from "@/lib/dinheiro";
import { formatarDataHora } from "@/lib/tempo";
import { PagamentoForm } from "./PagamentoForm";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { exigirAcessoVenda, temPermissao } from "@/lib/auth/autorizacao";
import { Badge, CabecalhoPagina, CartaoMetrica, EstadoVazio, Secao } from "@/components/painel/PainelUI";
import Link from "next/link";

export default async function PaginaVendaDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = (await obterUsuarioAtual())!;
  await exigirAcessoVenda(usuario, id);
  const venda = await buscarVendaComDetalhes(id);
  if (!venda) notFound();

  const pago = venda.pagamentos.filter((p) => !p.estornado_em).reduce((acc, p) => acc + p.valor_centavos, 0);

  return (
    <div className="space-y-6">
      <CabecalhoPagina titulo={`Venda de ${formatarDataHora(venda.criado_em)}`} descricao={`${venda.cliente_nome ?? "Sem cliente"} · responsável ${venda.vendedor_nome} · ${venda.tipo}`} acao={<Link href="/painel/vendas" className="button button-secondary">← Vendas</Link>} />

      <section className="stats-grid"><CartaoMetrica rotulo="Total" valor={formatarBRL(venda.total_centavos)} tom="azul" /><CartaoMetrica rotulo="Pago" valor={formatarBRL(pago)} tom="verde" /><CartaoMetrica rotulo="A receber" valor={formatarBRL(Math.max(0, venda.total_centavos - pago))} tom="ambar" /><article className="stat-card"><p className="stat-label">Situação</p><div className="mt-5"><Badge tom={venda.situacao_pagamento}>{venda.situacao_pagamento}</Badge></div></article></section>

      <Secao titulo="Itens" descricao="Placas incluídas nesta negociação">
        <ul className="space-y-1 text-sm">
          {venda.itens.map((i) => (
            <li key={i.id} className="rounded-lg border border-slate-200 bg-white p-2">
              {i.placa_codigo} — preço {formatarBRL(i.preco_centavos)} · custo {formatarBRL(i.custo_centavos)}
            </li>
          ))}
        </ul>
      </Secao>

      <Secao titulo="Pagamentos" descricao={venda.justificativa ? `Justificativa: ${venda.justificativa}` : undefined}>
        <ul className="mb-3 space-y-1 text-sm">
          {venda.pagamentos.map((p) => (
            <li key={p.id} className="rounded-lg border border-slate-200 bg-white p-2">
              {formatarDataHora(p.data_pagamento)} · {p.forma} · {formatarBRL(p.valor_centavos)}
              {p.estornado_em && " (estornado)"}
            </li>
          ))}
          {venda.pagamentos.length === 0 && <EstadoVazio titulo="Nenhum pagamento" descricao="Registre o primeiro recebimento desta venda." />}
        </ul>
        {temPermissao(usuario, "VENDAS_EDITAR") && venda.situacao_pagamento !== "QUITADA" ? <div className="border-t border-slate-100 p-4"><PagamentoForm vendaId={id} /></div> : null}
      </Secao>
    </div>
  );
}
