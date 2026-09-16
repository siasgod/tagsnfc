import type { NextRequest } from "next/server";
import { exigirPermissao } from "@/lib/auth/autorizacao";
import { buscarLotePorId, listarPlacasDoLote } from "@/lib/db/repo/lotes";
import { obterConfiguracao } from "@/lib/db/repo/configuracoes";
import { verificarLiberacaoProducao } from "@/lib/exportacao/gate";
import { parametrosImpressaoPadrao } from "@/lib/pdf/cartao";
import {
  gerarPdfCartaoIndividual,
  gerarPdfMultipagina,
  gerarPdfImposicaoA4,
} from "@/lib/pdf/exportar";
import { gerarCsvLote } from "@/lib/exportacao/csv";
import { gerarZip } from "@/lib/exportacao/zip";
import { comTratamentoDeErros } from "@/lib/api-utils";

export const runtime = "nodejs";

/**
 * GET /api/lotes/:id/exportar?tipo=pdf-individual|multipagina|a4|csv|zip
 *                             &modo=producao|demo
 *                             &placaCodigo=PL-000001 (obrigatório para pdf-individual)
 *
 * `modo=producao` só é aceito se a origem pública do lote já tiver sido
 * validada em Configurações (ver src/lib/exportacao/gate.ts). Caso
 * contrário, a exportação é sempre servida como demonstração, com marca
 * d'água visível — nunca falha silenciosamente nem finge estar pronta para
 * produção.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return comTratamentoDeErros(async () => exportarLote(request, context));
}

async function exportarLote(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  await exigirPermissao("LOTES_VER");
  const { id } = await context.params;
  const { searchParams } = request.nextUrl;
  const tipo = searchParams.get("tipo") ?? "multipagina";
  const modoSolicitado = searchParams.get("modo") === "producao" ? "producao" : "demo";
  const placaCodigo = searchParams.get("placaCodigo");

  const lote = await buscarLotePorId(id);
  if (!lote) return Response.json({ erro: "Lote não encontrado." }, { status: 404 });

  let modoEfetivo: "producao" | "demo" = "demo";
  let motivoDemo: string | undefined;
  if (modoSolicitado === "producao") {
    const liberacao = await verificarLiberacaoProducao(lote.origem_publica_usada);
    if (liberacao.liberado) {
      modoEfetivo = "producao";
    } else {
      motivoDemo = liberacao.motivo;
    }
  }

  const placas = await listarPlacasDoLote(id);
  if (placas.length === 0) return Response.json({ erro: "Lote sem placas." }, { status: 404 });

  const config = await obterConfiguracao();
  const parametros = parametrosImpressaoPadrao();
  const opcoes = {
    nomeOperacao: config.nome_operacao || undefined,
    marcaDagua: modoEfetivo === "demo" ? "DEMONSTRAÇÃO — NÃO IMPRIMIR" : undefined,
  };

  const nomeArquivoBase = `${lote.codigo}${modoEfetivo === "demo" ? "-DEMO" : ""}`;

  try {
    if (tipo === "pdf-individual") {
      const placa = placas.find((p) => p.codigo === placaCodigo);
      if (!placa) return Response.json({ erro: "Informe placaCodigo válido para este lote." }, { status: 400 });
      const buffer = await gerarPdfCartaoIndividual({ codigo: placa.codigo, urlQr: placa.url_qr }, parametros, opcoes);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="${placa.codigo}${modoEfetivo === "demo" ? "-DEMO" : ""}.pdf"`,
          "x-modo-exportacao": modoEfetivo,
          ...(motivoDemo ? { "x-motivo-demo": encodeURIComponent(motivoDemo) } : {}),
        },
      });
    }

    if (tipo === "multipagina") {
      const buffer = await gerarPdfMultipagina(
        placas.map((p) => ({ codigo: p.codigo, urlQr: p.url_qr })),
        parametros,
        opcoes
      );
      return new Response(new Uint8Array(buffer), {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="${nomeArquivoBase}-multipagina.pdf"`,
          "x-modo-exportacao": modoEfetivo,
        },
      });
    }

    if (tipo === "a4") {
      const resultado = await gerarPdfImposicaoA4(
        placas.map((p) => ({ codigo: p.codigo, urlQr: p.url_qr })),
        parametros,
        opcoes
      );
      return new Response(new Uint8Array(resultado.buffer), {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="${nomeArquivoBase}-a4.pdf"`,
          "x-modo-exportacao": modoEfetivo,
          "x-imposicao": `${resultado.colunas}x${resultado.linhas} por folha (${resultado.porFolha}); ${resultado.totalFolhas} folha(s)`,
        },
      });
    }

    if (tipo === "csv") {
      const csv = gerarCsvLote(placas);
      return new Response(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${lote.codigo}.csv"`,
        },
      });
    }

    if (tipo === "zip") {
      const [multi, csv] = await Promise.all([
        gerarPdfMultipagina(
          placas.map((p) => ({ codigo: p.codigo, urlQr: p.url_qr })),
          parametros,
          opcoes
        ),
        Promise.resolve(gerarCsvLote(placas)),
      ]);
      let a4Buffer: Buffer | null = null;
      try {
        a4Buffer = (
          await gerarPdfImposicaoA4(
            placas.map((p) => ({ codigo: p.codigo, urlQr: p.url_qr })),
            parametros,
            opcoes
          )
        ).buffer;
      } catch {
        // Parâmetros incompatíveis com A4 — o ZIP ainda é útil sem esse arquivo.
      }
      const arquivos: Record<string, Buffer | string> = {
        [`${nomeArquivoBase}-multipagina.pdf`]: multi,
        [`${lote.codigo}.csv`]: csv,
      };
      if (a4Buffer) arquivos[`${nomeArquivoBase}-a4.pdf`] = a4Buffer;
      for (const placa of placas) {
        arquivos[`individuais/${placa.codigo}${modoEfetivo === "demo" ? "-DEMO" : ""}.pdf`] = await gerarPdfCartaoIndividual({ codigo: placa.codigo, urlQr: placa.url_qr }, parametros, opcoes);
      }
      const zip = await gerarZip(arquivos);
      return new Response(new Uint8Array(zip), {
        headers: {
          "content-type": "application/zip",
          "content-disposition": `attachment; filename="${nomeArquivoBase}.zip"`,
          "x-modo-exportacao": modoEfetivo,
        },
      });
    }

    return Response.json({ erro: "Tipo de exportação desconhecido." }, { status: 400 });
  } catch (err) {
    console.error("[exportar lote] erro:", err);
    return Response.json({ erro: (err as Error).message }, { status: 500 });
  }
}
