import Link from "next/link";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { podeVerTudo } from "@/lib/auth/autorizacao";
import { listarEstabelecimentos } from "@/lib/db/repo/estabelecimentos";
import { CabecalhoPagina, EstadoVazio, Secao } from "@/components/painel/PainelUI";

export default async function PaginaEstabelecimentos({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const usuario = (await obterUsuarioAtual())!;
  const estabelecimentos = await listarEstabelecimentos({ vendedorId: podeVerTudo(usuario) ? undefined : usuario.id, busca: q });
  return (
    <div className="space-y-5">
      <CabecalhoPagina titulo="Estabelecimentos" descricao="Locais dos clientes, placas vinculadas e volume total de interações." />
      <form className="surface flex gap-2 p-4"><input name="q" defaultValue={q} placeholder="Buscar por local, endereço ou cliente" /><button className="button button-primary">Buscar</button></form>
      <Secao titulo={`${estabelecimentos.length} estabelecimento${estabelecimentos.length === 1 ? "" : "s"}`}>
        {estabelecimentos.length ? <div className="table-wrap"><table><thead><tr><th>Estabelecimento</th><th>Cliente</th><th>Endereço</th><th>Placas</th><th>Interações</th></tr></thead><tbody>{estabelecimentos.map((item) => <tr key={item.id}><td data-label="Estabelecimento"><strong>{item.nome}</strong></td><td data-label="Cliente"><Link href={`/painel/clientes/${item.cliente_id}`}>{item.cliente_nome}</Link></td><td data-label="Endereço">{item.endereco ?? "—"}</td><td data-label="Placas">{item.total_placas}</td><td data-label="Interações"><strong>{item.total_interacoes}</strong></td></tr>)}</tbody></table></div> : <EstadoVazio titulo="Nenhum estabelecimento encontrado" descricao="Cadastre estabelecimentos dentro do perfil de cada cliente." href="/painel/clientes" acao="Ver clientes" />}
      </Secao>
    </div>
  );
}
