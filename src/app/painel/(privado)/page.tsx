import Link from "next/link";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { obterIndicadores, obterResumoOperacionalHoje } from "@/lib/db/repo/indicadores";
import { listarUltimasInteracoes } from "@/lib/db/repo/eventos";
import { formatarBRL } from "@/lib/dinheiro";
import { formatarDataHora, limitesDoDiaEmSaoPaulo } from "@/lib/tempo";
import { podeVerTudo, temPermissao } from "@/lib/auth/autorizacao";
import { Badge, CabecalhoPagina, CartaoMetrica, EstadoVazio, Secao } from "@/components/painel/PainelUI";

export default async function PaginaDashboard({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const usuario = (await obterUsuarioAtual())!;
  const { dias: diasParam } = await searchParams;
  const dias = [7, 30, 90].includes(Number(diasParam)) ? Number(diasParam) : 30;
  const fim = new Date();
  const inicio = new Date(fim.getTime() - dias * 86_400_000);
  const hoje = limitesDoDiaEmSaoPaulo(fim);
  const escopoVendedor = podeVerTudo(usuario) ? undefined : usuario.id;

  const [indicadores, resumoHoje, interacoes] = await Promise.all([
    obterIndicadores({ inicio, fim, vendedorId: escopoVendedor }),
    obterResumoOperacionalHoje(hoje.inicio, hoje.fim, escopoVendedor),
    listarUltimasInteracoes(10, escopoVendedor),
  ]);
  const totalInteracoes = indicadores.acessosQr + indicadores.acessosNfc;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo={`Olá, ${usuario.nome.split(" ")[0]}`}
        descricao="Uma visão clara do financeiro, da operação e das interações das placas."
        acao={temPermissao(usuario, "ATIVAR_PLACA") ? <Link href="/painel/ativar" className="button button-primary">+ Ativar placa</Link> : undefined}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[.08em] text-slate-500">Resumo dos últimos {dias} dias</p>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 text-xs">
          {[7, 30, 90].map((d) => <Link key={d} href={`/painel?dias=${d}`} className={`rounded-lg px-3 py-2 ${dias === d ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>{d}d</Link>)}
        </div>
      </div>

      <section className="stats-grid">
        <CartaoMetrica rotulo="Faturamento" valor={formatarBRL(indicadores.valorVendidoCentavos)} detalhe={`${indicadores.vendasNoPeriodo} vendas no período`} tom="azul" />
        <CartaoMetrica rotulo="Recebido" valor={formatarBRL(indicadores.valorRecebidoCentavos)} detalhe="Pagamentos confirmados" tom="verde" />
        <CartaoMetrica rotulo="A receber" valor={formatarBRL(indicadores.valorPendenteCentavos)} detalhe="Saldo pendente total" tom="ambar" />
        <CartaoMetrica rotulo="Lucro estimado" valor={formatarBRL(indicadores.margemBrutaEstimadaCentavos)} detalhe="Faturamento menos custo" tom="violeta" />
        <CartaoMetrica rotulo="Placas ativas" valor={indicadores.placasAtivas} detalhe={`${indicadores.placasDisponiveis} disponíveis`} tom="verde" />
        <CartaoMetrica rotulo="Interações" valor={totalInteracoes} detalhe={`${indicadores.acessosQr} QR · ${indicadores.acessosNfc} NFC`} tom="azul" />
        <CartaoMetrica rotulo="Clientes" valor={indicadores.clientesCadastrados} detalhe="Carteira ativa" />
        <CartaoMetrica rotulo="Placas produzidas" valor={indicadores.placasProduzidas} detalhe={`${indicadores.placasReservadas} reservadas`} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <Secao titulo="Operação de hoje" descricao="Movimentação desde 00:00 em São Paulo">
          <div className="grid grid-cols-2 gap-px bg-slate-100">
            {[
              ["Vendas", resumoHoje.vendas],
              ["Placas ativadas", resumoHoje.placasAtivadas],
              ["Interações QR", resumoHoje.interacoesQr],
              ["Interações NFC", resumoHoje.interacoesNfc],
            ].map(([rotulo, valor]) => <div key={String(rotulo)} className="bg-white p-5"><p className="text-xs text-slate-500">{rotulo}</p><p className="mt-2 text-2xl font-bold tracking-tight text-slate-800">{valor}</p></div>)}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-slate-100 p-4">
            <Link href="/painel/desempenho" className="button button-secondary button-small">Ver desempenho</Link>
            <Link href="/painel/clientes/novo" className="button button-secondary button-small">Novo cliente</Link>
          </div>
        </Secao>

        <Secao titulo="Últimas interações" descricao="Qual placa foi acessada, por qual canal e quando" acao={<Link href="/painel/desempenho" className="text-xs font-semibold text-blue-600">Ver todas →</Link>}>
          {interacoes.length ? (
            <ul className="feed-list">
              {interacoes.map((item) => (
                <li key={item.id} className="feed-item">
                  <span className="feed-dot" />
                  <div className="feed-main">
                    <strong><Link href={`/painel/placas/${item.placa_id}`}>{item.placa_codigo}</Link> · {item.cliente_nome ?? "Sem cliente"}</strong>
                    <span>{item.estabelecimento_nome ?? "Sem estabelecimento vinculado"}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1"><Badge tom={item.canal}>{item.canal}</Badge><time className="feed-time">{formatarDataHora(item.data_hora)}</time></div>
                </li>
              ))}
            </ul>
          ) : <EstadoVazio titulo="Nenhuma interação no período" descricao="Assim que uma placa for acessada por QR ou NFC, ela aparecerá aqui." />}
        </Secao>
      </div>

      <p className="muted-note">Interações representam aberturas do QR ou NFC. Elas não confirmam que uma avaliação foi publicada.</p>
    </div>
  );
}
