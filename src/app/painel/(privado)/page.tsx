import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { obterIndicadores } from "@/lib/db/repo/indicadores";
import { formatarBRL } from "@/lib/dinheiro";
import { limitesDoDiaEmSaoPaulo } from "@/lib/tempo";
import Link from "next/link";

function Cartao({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{valor}</p>
      {nota && <p className="mt-0.5 text-xs text-slate-400">{nota}</p>}
    </div>
  );
}

export default async function PaginaDashboard({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const usuario = await obterUsuarioAtual();
  const { dias: diasParam } = await searchParams;
  const dias = Number(diasParam ?? "30") || 30;

  const fim = new Date();
  const inicioBase = new Date(fim.getTime() - dias * 24 * 60 * 60 * 1000);
  const { inicio } = limitesDoDiaEmSaoPaulo(inicioBase);

  const escopoVendedor = usuario!.papel === "VENDEDOR" ? usuario!.id : undefined;
  const indicadores = await obterIndicadores({ inicio, fim, vendedorId: escopoVendedor });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Visão geral</h1>
        <div className="flex gap-2 text-sm">
          {[7, 30, 90].map((d) => (
            <Link
              key={d}
              href={`/painel?dias=${d}`}
              className={`rounded-full px-3 py-1 ${dias === d ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}
            >
              {d} dias
            </Link>
          ))}
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-500">Placas</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Cartao titulo="Produzidas" valor={String(indicadores.placasProduzidas)} />
          <Cartao titulo="Disponíveis" valor={String(indicadores.placasDisponiveis)} />
          <Cartao titulo="Reservadas" valor={String(indicadores.placasReservadas)} />
          <Cartao titulo="Ativas" valor={String(indicadores.placasAtivas)} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-500">Comercial (período selecionado)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Cartao titulo="Clientes cadastrados" valor={String(indicadores.clientesCadastrados)} />
          <Cartao titulo="Vendas no período" valor={String(indicadores.vendasNoPeriodo)} />
          <Cartao titulo="Valor vendido" valor={formatarBRL(indicadores.valorVendidoCentavos)} />
          <Cartao titulo="Valor recebido" valor={formatarBRL(indicadores.valorRecebidoCentavos)} />
          <Cartao titulo="Valores pendentes" valor={formatarBRL(indicadores.valorPendenteCentavos)} nota="total em aberto, não só do período" />
          <Cartao titulo="Custos no período" valor={formatarBRL(indicadores.custosNoPeriodoCentavos)} />
          <Cartao
            titulo="Margem bruta estimada"
            valor={formatarBRL(indicadores.margemBrutaEstimadaCentavos)}
            nota="não é lucro líquido: não desconta impostos, frete ou outras despesas"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-500">Acessos públicos (período selecionado)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Cartao titulo="Acessos via QR" valor={String(indicadores.acessosQr)} />
          <Cartao titulo="Acessos via NFC" valor={String(indicadores.acessosNfc)} />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Acessos não são avaliações confirmadas — o sistema não consegue verificar se o cliente realmente publicou
          uma avaliação, apenas que o QR ou o NFC foi aberto. Bots, pré-visualizações e recarregamentos também podem
          contar como acesso.
        </p>
      </section>
    </div>
  );
}
