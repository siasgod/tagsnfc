import Link from "next/link";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { podeVerTudo, temPermissao } from "@/lib/auth/autorizacao";
import { listarVendas } from "@/lib/db/repo/vendas";
import { formatarBRL } from "@/lib/dinheiro";
import { formatarDataHora } from "@/lib/tempo";
import { Badge, CabecalhoPagina, EstadoVazio, Secao } from "@/components/painel/PainelUI";

export default async function PaginaVendas() {
  const usuario = (await obterUsuarioAtual())!;
  const vendas = await listarVendas({ vendedorId: podeVerTudo(usuario) ? undefined : usuario.id });
  return (
    <div className="space-y-5">
      <CabecalhoPagina titulo="Vendas" descricao="Acompanhe valores, pagamentos e responsáveis por cada negociação." acao={temPermissao(usuario, "ATIVAR_PLACA") ? <Link href="/painel/ativar" className="button button-primary">+ Nova ativação/venda</Link> : undefined} />
      <Secao titulo={`${vendas.length} venda${vendas.length === 1 ? "" : "s"}`}>
        {vendas.length ? <div className="table-wrap"><table><thead><tr><th>Data</th><th>Cliente</th><th>Tipo</th><th>Placas</th><th>Total</th><th>Pago</th><th>Situação</th><th>Responsável</th></tr></thead><tbody>{vendas.map((v) => <tr key={v.id}><td data-label="Data"><Link href={`/painel/vendas/${v.id}`}>{formatarDataHora(v.criado_em)}</Link></td><td data-label="Cliente">{v.cliente_nome ?? "—"}</td><td data-label="Tipo">{v.tipo}</td><td data-label="Placas">{v.quantidade_itens}</td><td data-label="Total"><strong>{formatarBRL(v.total_centavos)}</strong></td><td data-label="Pago">{formatarBRL(Number(v.pago_centavos))}</td><td data-label="Situação"><Badge tom={v.situacao_pagamento}>{v.situacao_pagamento}</Badge></td><td data-label="Responsável">{v.vendedor_nome}</td></tr>)}</tbody></table></div> : <EstadoVazio titulo="Nenhuma venda registrada" descricao="As vendas surgem durante o fluxo de ativação da placa." href={temPermissao(usuario, "ATIVAR_PLACA") ? "/painel/ativar" : undefined} acao="Ativar placa" />}
      </Secao>
    </div>
  );
}
