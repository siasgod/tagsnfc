import { notFound } from "next/navigation";
import { buscarLotePorId, listarPlacasDoLote } from "@/lib/db/repo/lotes";
import { verificarLiberacaoProducao } from "@/lib/exportacao/gate";
import { formatarDataHora } from "@/lib/tempo";
import Link from "next/link";

export default async function PaginaLoteDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lote = await buscarLotePorId(id);
  if (!lote) notFound();

  const [placas, liberacao] = await Promise.all([
    listarPlacasDoLote(id),
    verificarLiberacaoProducao(lote.origem_publica_usada),
  ]);

  const base = `/api/lotes/${id}/exportar`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">{lote.codigo}</h1>
        <p className="text-sm text-slate-500">
          {lote.quantidade} placas · origem: <span className="font-mono">{lote.origem_publica_usada}</span> · gerado em{" "}
          {formatarDataHora(lote.criado_em)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[["Total", placas.length], ["Disponíveis", placas.filter(p => p.estado_comercial === "DISPONIVEL").length], ["Ativas", placas.filter(p => p.estado_comercial === "ATIVA").length]].map(([nome, valor]) => <div key={nome} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{nome}</p><p className="mt-2 text-2xl font-semibold">{valor}</p></div>)}
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-slate-700">Exportar para impressão</h2>
        {!liberacao.liberado && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Exportação "pronta para produção" bloqueada: {liberacao.motivo} As exportações abaixo serão geradas como
            <strong> demonstração</strong>, com marca d&apos;água, até que isso seja resolvido em Configurações.
          </p>
        )}
        <p className="mb-4 text-sm text-slate-500">Placas de 100 × 100 mm · arquivo de 106 × 106 mm com sangria · QR individual de 35 mm. Baixe diretamente por aqui e imprima em escala 100%. PDF em RGB; confirme o perfil de cor com a gráfica.</p>
        <div className="flex flex-wrap gap-2">
          {(["multipagina", "a4", "csv", "zip"] as const).map((tipo) => (
            <a
              key={tipo}
              href={`${base}?tipo=${tipo}&modo=${liberacao.liberado ? "producao" : "demo"}`}
              className="botao-toque flex items-center rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50"
            >
              {tipo === "multipagina" && "Baixar PDF para gráfica"}
              {tipo === "a4" && "Baixar PDF em folhas A4"}
              {tipo === "csv" && "CSV do lote"}
              {tipo === "zip" && "Baixar ZIP com PDFs individuais"}
            </a>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-500">Placas do lote</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Produção</th>
                <th className="px-3 py-2">Comercial</th>
                <th className="px-3 py-2">Estabelecimento</th>
                <th className="px-3 py-2">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {placas.map((p: any) => (
                <tr key={p.id}>
                  <td data-label="Código" className="px-3 py-2">
                    <Link href={`/painel/placas/${p.id}`} className="font-medium text-blue-600">
                      {p.codigo}
                    </Link>
                  </td>
                  <td data-label="Produção" className="px-3 py-2">{p.estado_producao}</td>
                  <td data-label="Comercial" className="px-3 py-2">{p.estado_comercial}</td>
                  <td data-label="Estabelecimento" className="px-3 py-2">{p.estabelecimento_nome ?? "—"}</td>
                  <td data-label="PDF" className="px-3 py-2">
                    <a
                      className="text-blue-600"
                      href={`${base}?tipo=pdf-individual&placaCodigo=${p.codigo}&modo=${liberacao.liberado ? "producao" : "demo"}`}
                    >
                      baixar
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
