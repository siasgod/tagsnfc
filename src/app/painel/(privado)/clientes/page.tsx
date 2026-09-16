import Link from "next/link";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { podeVerTudo, temPermissao } from "@/lib/auth/autorizacao";
import { listarClientes } from "@/lib/db/repo/clientes";
import { listarCategorias } from "@/lib/db/repo/categorias";
import { listarResponsaveisComerciais } from "@/lib/db/repo/usuarios";
import { Badge, CabecalhoPagina, EstadoVazio, Secao } from "@/components/painel/PainelUI";

export default async function PaginaClientes({ searchParams }: {
  searchParams: Promise<{ q?: string; categoria?: string; responsavel?: string }>;
}) {
  const filtros = await searchParams;
  const usuario = (await obterUsuarioAtual())!;
  const [clientes, categorias, responsaveis] = await Promise.all([
    listarClientes({ vendedorId: podeVerTudo(usuario) ? undefined : usuario.id, busca: filtros.q, categoriaId: filtros.categoria, responsavelId: podeVerTudo(usuario) ? filtros.responsavel : undefined }),
    listarCategorias(),
    podeVerTudo(usuario) ? listarResponsaveisComerciais() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <CabecalhoPagina titulo="Clientes" descricao="Carteira comercial, categorias, responsáveis e desempenho consolidado." acao={temPermissao(usuario, "CLIENTES_EDITAR") ? <Link href="/painel/clientes/novo" className="button button-primary">+ Novo cliente</Link> : undefined} />
      <form className="surface grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="form-field lg:col-span-2">Buscar<input name="q" defaultValue={filtros.q} placeholder="Nome, telefone ou e-mail" /></label>
        <label className="form-field">Categoria<select name="categoria" defaultValue={filtros.categoria ?? ""}><option value="">Todas</option>{categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        {podeVerTudo(usuario) ? <label className="form-field">Responsável<select name="responsavel" defaultValue={filtros.responsavel ?? ""}><option value="">Todos</option>{responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select></label> : null}
        <div className="flex gap-2 lg:col-span-4"><button className="button button-primary">Aplicar filtros</button><Link href="/painel/clientes" className="button button-secondary">Limpar</Link></div>
      </form>
      <Secao titulo={`${clientes.length} cliente${clientes.length === 1 ? "" : "s"}`} descricao="Clique em um cliente para abrir o perfil completo">
        {clientes.length ? <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Categoria</th><th>Responsável</th><th>Estabelecimentos</th><th>Placas</th><th>Interações</th></tr></thead><tbody>{clientes.map((c) => <tr key={c.id}><td data-label="Cliente"><Link href={`/painel/clientes/${c.id}`}>{c.nome}</Link><div className="mt-1 text-[11px] text-slate-400">{c.telefone ?? c.email ?? "Sem contato"}</div></td><td data-label="Categoria">{c.categoria_nome ? <Badge tom={c.categoria_cor}>{c.categoria_nome}</Badge> : "—"}</td><td data-label="Responsável">{c.vendedor_nome ?? "—"}</td><td data-label="Estabelecimentos">{c.total_estabelecimentos}</td><td data-label="Placas">{c.total_placas}</td><td data-label="Interações"><strong>{c.total_interacoes}</strong></td></tr>)}</tbody></table></div> : <EstadoVazio titulo="Nenhum cliente encontrado" descricao="Ajuste os filtros ou cadastre o primeiro cliente da carteira." href={temPermissao(usuario, "CLIENTES_EDITAR") ? "/painel/clientes/novo" : undefined} acao="Cadastrar cliente" />}
      </Secao>
    </div>
  );
}
