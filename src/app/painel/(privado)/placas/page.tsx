import Link from "next/link";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { podeVerTudo, temPermissao } from "@/lib/auth/autorizacao";
import { listarPlacas } from "@/lib/db/repo/placas";
import { formatarDataHora } from "@/lib/tempo";
import { Badge, CabecalhoPagina, EstadoVazio, Secao } from "@/components/painel/PainelUI";

const ESTADOS = ["DISPONIVEL", "RESERVADA", "ATIVA", "DESATIVADA", "SUBSTITUIDA", "PERDIDA"];

export default async function PaginaPlacas({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string }> }) {
  const { q, estado } = await searchParams;
  const usuario = (await obterUsuarioAtual())!;
  const placas = await listarPlacas({ vendedorId: podeVerTudo(usuario) ? undefined : usuario.id, busca: q, estadoComercial: estado });
  return (
    <div className="space-y-5">
      <CabecalhoPagina titulo="Placas" descricao="Estoque, vínculos, status e uso de cada unidade." acao={temPermissao(usuario, "ATIVAR_PLACA") ? <Link href="/painel/ativar" className="button button-primary">+ Ativar placa</Link> : undefined} />
      <form className="surface grid gap-3 p-4 sm:grid-cols-[1fr_14rem_auto]">
        <label className="form-field">Buscar<input name="q" defaultValue={q} placeholder="Código, estabelecimento ou telefone" /></label>
        <label className="form-field">Status<select name="estado" defaultValue={estado ?? ""}><option value="">Todos</option>{ESTADOS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <div className="flex items-end"><button className="button button-primary w-full">Filtrar</button></div>
      </form>
      <Secao titulo={`${placas.length} placa${placas.length === 1 ? "" : "s"}`}>
        {placas.length ? <div className="table-wrap"><table><thead><tr><th>Placa</th><th>Status</th><th>Cliente / local</th><th>Responsável</th><th>Interações</th><th>Último acesso</th></tr></thead><tbody>{placas.map((p) => <tr key={p.id}><td data-label="Placa"><Link href={`/painel/placas/${p.id}`}>{p.codigo}</Link></td><td data-label="Status"><Badge tom={p.estado_comercial}>{p.estado_comercial}</Badge></td><td data-label="Cliente / local"><strong className="font-medium">{p.cliente_nome ?? "Sem cliente"}</strong><div className="mt-1 text-[11px] text-slate-400">{p.estabelecimento_nome ?? "Sem estabelecimento"}</div></td><td data-label="Responsável">{p.vendedor_nome ?? "—"}</td><td data-label="Interações"><strong>{p.total_interacoes}</strong></td><td data-label="Último acesso">{formatarDataHora(p.ultima_interacao)}</td></tr>)}</tbody></table></div> : <EstadoVazio titulo="Nenhuma placa encontrada" descricao="Ajuste os filtros ou gere um novo lote de placas." href="/painel/lotes" acao="Ver lotes" />}
      </Secao>
    </div>
  );
}
