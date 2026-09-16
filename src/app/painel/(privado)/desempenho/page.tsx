import Link from "next/link";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { podeVerTudo } from "@/lib/auth/autorizacao";
import { obterDesempenho } from "@/lib/db/repo/desempenho";
import { listarCategorias } from "@/lib/db/repo/categorias";
import { listarResponsaveisComerciais } from "@/lib/db/repo/usuarios";
import { limitesDoDiaEmSaoPaulo } from "@/lib/tempo";
import { Badge, CabecalhoPagina, CartaoMetrica, EstadoVazio, Secao } from "@/components/painel/PainelUI";

export default async function PaginaDesempenho({ searchParams }: {
  searchParams: Promise<{ dias?: string; categoria?: string; responsavel?: string }>;
}) {
  const usuario = (await obterUsuarioAtual())!;
  const filtros = await searchParams;
  const dias = [7, 30, 90].includes(Number(filtros.dias)) ? Number(filtros.dias) : 30;
  const fim = new Date();
  const inicioHoje = limitesDoDiaEmSaoPaulo(fim).inicio;
  const vendedorId = podeVerTudo(usuario) ? undefined : usuario.id;
  const base = {
    fim,
    vendedorId,
    categoriaId: filtros.categoria || undefined,
    responsavelId: vendedorId ? undefined : filtros.responsavel || undefined,
  };

  const [resultado, hoje, seteDias, trintaDias, categorias, responsaveis] = await Promise.all([
    obterDesempenho({ ...base, inicio: new Date(fim.getTime() - dias * 86_400_000) }),
    obterDesempenho({ ...base, inicio: inicioHoje }),
    obterDesempenho({ ...base, inicio: new Date(fim.getTime() - 7 * 86_400_000) }),
    obterDesempenho({ ...base, inicio: new Date(fim.getTime() - 30 * 86_400_000) }),
    listarCategorias(),
    podeVerTudo(usuario) ? listarResponsaveisComerciais() : Promise.resolve([]),
  ]);
  const maximo = Math.max(1, ...resultado.serie.map((item) => item.total));

  return (
    <div className="space-y-6">
      <CabecalhoPagina titulo="Desempenho" descricao="Entenda quando, como e em quais clientes as placas estão gerando mais interações." />

      <form className="surface grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="form-field">Período<select name="dias" defaultValue={String(dias)}><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select></label>
        <label className="form-field">Categoria<select name="categoria" defaultValue={filtros.categoria ?? ""}><option value="">Todas</option>{categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        {podeVerTudo(usuario) ? <label className="form-field">Responsável<select name="responsavel" defaultValue={filtros.responsavel ?? ""}><option value="">Todos</option>{responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select></label> : <div />}
        <div className="flex items-end"><button className="button button-primary w-full">Aplicar filtros</button></div>
      </form>

      <section className="stats-grid">
        <CartaoMetrica rotulo="Hoje" valor={hoje.totais.total} detalhe={`${hoje.totais.qr} QR · ${hoje.totais.nfc} NFC`} tom="azul" />
        <CartaoMetrica rotulo="Últimos 7 dias" valor={seteDias.totais.total} detalhe={`${seteDias.totais.qr} QR · ${seteDias.totais.nfc} NFC`} tom="verde" />
        <CartaoMetrica rotulo="Últimos 30 dias" valor={trintaDias.totais.total} detalhe={`${trintaDias.totais.qr} QR · ${trintaDias.totais.nfc} NFC`} tom="violeta" />
        <CartaoMetrica rotulo={`Período (${dias}d)`} valor={resultado.totais.total} detalhe={`${resultado.totais.qr} QR · ${resultado.totais.nfc} NFC`} tom="ambar" />
      </section>

      <Secao titulo="Interações ao longo do tempo" descricao="Aberturas registradas por dia">
        {resultado.serie.length > 1 ? (
          <div className="bar-chart" role="img" aria-label="Gráfico de interações diárias">
            {resultado.serie.map((item, indice) => (
              <div className="bar-column" key={new Date(item.dia).toISOString()} title={`${item.total} interações`}>
                <div className="bar" style={{ height: `${Math.max(3, (item.total / maximo) * 160)}px` }} />
                {(resultado.serie.length <= 14 || indice % Math.ceil(resultado.serie.length / 10) === 0) ? <small>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(item.dia))}</small> : <small>&nbsp;</small>}
              </div>
            ))}
          </div>
        ) : <EstadoVazio titulo="Série temporal ainda insuficiente" descricao="O gráfico será exibido quando houver interações em mais de um dia." />}
      </Secao>

      <div className="grid gap-5 lg:grid-cols-2">
        <Secao titulo="Clientes com mais interações" descricao={`Ranking dos últimos ${dias} dias`}>
          {resultado.clientes.length ? <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>QR</th><th>NFC</th><th>Total</th></tr></thead><tbody>{resultado.clientes.map((item) => <tr key={item.id ?? item.nome}><td data-label="Cliente">{item.id ? <Link href={`/painel/clientes/${item.id}`}>{item.nome}</Link> : item.nome}</td><td data-label="QR">{item.qr}</td><td data-label="NFC">{item.nfc}</td><td data-label="Total"><Badge tom="AZUL">{item.total}</Badge></td></tr>)}</tbody></table></div> : <EstadoVazio titulo="Sem dados de clientes" descricao="Nenhuma interação corresponde aos filtros atuais." />}
        </Secao>
        <Secao titulo="Placas com mais interações" descricao={`Ranking dos últimos ${dias} dias`}>
          {resultado.placas.length ? <div className="table-wrap"><table><thead><tr><th>Placa</th><th>Cliente</th><th>QR</th><th>NFC</th><th>Total</th></tr></thead><tbody>{resultado.placas.map((item) => <tr key={item.id}><td data-label="Placa"><Link href={`/painel/placas/${item.id}`}>{item.codigo}</Link></td><td data-label="Cliente">{item.cliente_nome ?? "—"}</td><td data-label="QR">{item.qr}</td><td data-label="NFC">{item.nfc}</td><td data-label="Total"><Badge tom="VIOLETA">{item.total}</Badge></td></tr>)}</tbody></table></div> : <EstadoVazio titulo="Sem dados de placas" descricao="Nenhuma interação corresponde aos filtros atuais." />}
        </Secao>
      </div>
      <p className="muted-note">Interações são acessos ao link da placa; não representam avaliações concluídas.</p>
    </div>
  );
}
