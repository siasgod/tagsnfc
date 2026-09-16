import Link from "next/link";
import { listarLotes } from "@/lib/db/repo/lotes";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { formatarDataHora } from "@/lib/tempo";
import { temPermissao } from "@/lib/auth/autorizacao";
import { CabecalhoPagina, EstadoVazio, Secao } from "@/components/painel/PainelUI";

export default async function PaginaLotes() {
  const usuario = await obterUsuarioAtual();
  const lotes = await listarLotes();

  return (
    <div className="space-y-4">
      <CabecalhoPagina titulo="Lotes" descricao="Produção, estoque e arquivos prontos para impressão." acao={usuario && temPermissao(usuario, "LOTES_CRIAR") ? <Link href="/painel/lotes/novo" className="button button-primary">+ Novo lote</Link> : undefined} />

      <Secao titulo={`${lotes.length} lote${lotes.length === 1 ? "" : "s"}`}>
        {lotes.length ? <div className="table-wrap"><table>
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Quantidade</th>
              <th className="px-3 py-2">Disponíveis</th>
              <th className="px-3 py-2">Ativas</th>
              <th className="px-3 py-2">Criado em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lotes.map((l) => (
              <tr key={l.id}>
                <td data-label="Código" className="px-3 py-2">
                  <Link href={`/painel/lotes/${l.id}`} className="font-medium text-blue-600">
                    {l.codigo}
                  </Link>
                </td>
                <td data-label="Quantidade" className="px-3 py-2">{l.quantidade}</td>
                <td data-label="Disponíveis" className="px-3 py-2">{l.disponiveis}</td>
                <td data-label="Ativas" className="px-3 py-2">{l.ativas}</td>
                <td data-label="Criado em" className="px-3 py-2">{formatarDataHora(l.criado_em)}</td>
              </tr>
            ))}
          </tbody>
        </table></div> : <EstadoVazio titulo="Nenhum lote criado" descricao="Crie o primeiro lote para gerar placas e arquivos de impressão." href={usuario && temPermissao(usuario, "LOTES_CRIAR") ? "/painel/lotes/novo" : undefined} acao="Criar lote" />}
      </Secao>
    </div>
  );
}
