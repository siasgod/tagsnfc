import Link from "next/link";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { podeVerTudo } from "@/lib/auth/autorizacao";
import { buscaGlobal } from "@/lib/db/repo/busca";
import { Badge, CabecalhoPagina, EstadoVazio, Secao } from "@/components/painel/PainelUI";

export default async function PaginaBusca({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const usuario = (await obterUsuarioAtual())!;
  const resultados = q.trim().length >= 2 ? await buscaGlobal(q, podeVerTudo(usuario) ? undefined : usuario.id) : [];
  return (
    <div className="space-y-5">
      <CabecalhoPagina titulo="Busca global" descricao="Encontre clientes, estabelecimentos e placas em um só lugar." />
      <form className="surface flex gap-2 p-4"><input autoFocus name="q" defaultValue={q} placeholder="Digite ao menos 2 caracteres" /><button className="button button-primary">Buscar</button></form>
      <Secao titulo={q ? `Resultados para “${q}”` : "Resultados"}>
        {resultados.length ? <ul className="divide-y divide-slate-100">{resultados.map((item) => <li key={`${item.tipo}-${item.id}`}><Link href={item.href} className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50"><div><strong className="text-sm text-slate-800">{item.titulo}</strong><p className="mt-1 text-xs text-slate-500">{item.subtitulo ?? "Sem detalhes adicionais"}</p></div><Badge tom={item.tipo === "PLACA" ? "AZUL" : item.tipo === "CLIENTE" ? "VERDE" : "VIOLETA"}>{item.tipo}</Badge></Link></li>)}</ul> : <EstadoVazio titulo={q.length < 2 ? "Comece uma busca" : "Nada encontrado"} descricao={q.length < 2 ? "Busque por nome, telefone, estabelecimento, código ou token da placa." : "Tente outro nome, telefone ou código de placa."} />}
      </Secao>
    </div>
  );
}
