import PDFDocument from "pdfkit";
import path from "node:path";
import { mm } from "@/lib/pdf/mm";
import { desenharCartao, ladoCaixaMm, type ParametrosImpressao } from "@/lib/pdf/cartao";
import { gerarQrSvg } from "@/lib/qrcode/gerar";

const DIR_FONTES = path.join(process.cwd(), "src", "assets", "fonts");

type Doc = InstanceType<typeof PDFDocument>;

function registrarFontes(doc: Doc) {
  doc.registerFont("Poppins-Regular", path.join(DIR_FONTES, "Poppins-Regular.ttf"));
  doc.registerFont("Poppins-Medium", path.join(DIR_FONTES, "Poppins-Medium.ttf"));
  doc.registerFont("Poppins-Bold", path.join(DIR_FONTES, "Poppins-Bold.ttf"));
}

function coletarBuffer(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const partes: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => partes.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(partes)));
    doc.on("error", reject);
    doc.end();
  });
}

export interface PlacaParaExportacao {
  codigo: string;
  urlQr: string;
}

/**
 * Nenhuma exportação de PDF é gerada assumindo cor CMYK ou conformidade
 * PDF/X — o pdfkit produz PDF padrão em espaço de cor RGB. Ver README para a
 * limitação. O perfil de cor efetivamente usado é sRGB (padrão de tela);
 * confira com a gráfica se uma conversão para CMYK é necessária antes da
 * impressão final.
 */
export const PERFIL_COR_EXPORTADO = "RGB (sRGB) — não é CMYK nem PDF/X";

export interface OpcoesExportacao {
  nomeOperacao?: string;
  marcaDagua?: string;
}

export async function gerarPdfCartaoIndividual(
  placa: PlacaParaExportacao,
  parametros: ParametrosImpressao,
  opcoes: OpcoesExportacao = {}
): Promise<Buffer> {
  const ladoPt = mm(ladoCaixaMm(parametros));
  const doc = new PDFDocument({ size: [ladoPt, ladoPt], margin: 0, autoFirstPage: true });
  registrarFontes(doc);
  const qrSvg = await gerarQrSvg(placa.urlQr);
  desenharCartao(doc, 0, 0, parametros, { codigo: placa.codigo, qrSvg, ...opcoes });
  return coletarBuffer(doc);
}

export async function gerarPdfMultipagina(
  placas: PlacaParaExportacao[],
  parametros: ParametrosImpressao,
  opcoes: OpcoesExportacao = {}
): Promise<Buffer> {
  const ladoPt = mm(ladoCaixaMm(parametros));
  const doc = new PDFDocument({ size: [ladoPt, ladoPt], margin: 0, autoFirstPage: false });
  registrarFontes(doc);

  for (const placa of placas) {
    doc.addPage({ size: [ladoPt, ladoPt], margin: 0 });
    const qrSvg = await gerarQrSvg(placa.urlQr);
    desenharCartao(doc, 0, 0, parametros, { codigo: placa.codigo, qrSvg, ...opcoes });
  }

  return coletarBuffer(doc);
}

const A4_LARGURA_MM = 210;
const A4_ALTURA_MM = 297;

export interface ResultadoImposicao {
  buffer: Buffer;
  colunas: number;
  linhas: number;
  porFolha: number;
  totalFolhas: number;
}

/**
 * Impõe as placas em folhas A4, uma grade de células do tamanho
 * (trim + 2×sangria) cada, sem redimensionar a arte. Se o número de colunas
 * ou linhas calculado for zero (parâmetros incompatíveis com A4), lança erro
 * em vez de gerar um PDF incorreto silenciosamente.
 */
export async function gerarPdfImposicaoA4(
  placas: PlacaParaExportacao[],
  parametros: ParametrosImpressao,
  opcoes: OpcoesExportacao & { margemMm?: number } = {}
): Promise<ResultadoImposicao> {
  const margemMm = opcoes.margemMm ?? 5;
  const ladoCelulaMm = ladoCaixaMm(parametros);
  const usavelLarguraMm = A4_LARGURA_MM - 2 * margemMm;
  const usavelAlturaMm = A4_ALTURA_MM - 2 * margemMm;

  const colunas = Math.floor(usavelLarguraMm / ladoCelulaMm);
  const linhas = Math.floor(usavelAlturaMm / ladoCelulaMm);

  if (colunas < 1 || linhas < 1) {
    throw new Error(
      `Os parâmetros de impressão (célula de ${ladoCelulaMm}mm) não cabem em uma folha A4 com margem de ${margemMm}mm. Reduza a sangria ou a margem.`
    );
  }

  const porFolha = colunas * linhas;
  const totalFolhas = Math.ceil(placas.length / porFolha);

  const larguraGradeMm = colunas * ladoCelulaMm;
  const alturaGradeMm = linhas * ladoCelulaMm;
  const offsetXMm = (A4_LARGURA_MM - larguraGradeMm) / 2;
  const offsetYMm = (A4_ALTURA_MM - alturaGradeMm) / 2;

  const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false });
  registrarFontes(doc);

  for (let folha = 0; folha < totalFolhas; folha++) {
    doc.addPage({ size: "A4", margin: 0 });
    const inicio = folha * porFolha;
    const itensDaFolha = placas.slice(inicio, inicio + porFolha);

    for (let i = 0; i < itensDaFolha.length; i++) {
      const col = i % colunas;
      const lin = Math.floor(i / colunas);
      const xPt = mm(offsetXMm + col * ladoCelulaMm);
      const yPt = mm(offsetYMm + lin * ladoCelulaMm);
      const qrSvg = await gerarQrSvg(itensDaFolha[i].urlQr);
      desenharCartao(doc, xPt, yPt, parametros, {
        codigo: itensDaFolha[i].codigo,
        qrSvg,
        nomeOperacao: opcoes.nomeOperacao,
        marcaDagua: opcoes.marcaDagua,
      });
    }
  }

  const buffer = await coletarBuffer(doc);
  return { buffer, colunas, linhas, porFolha, totalFolhas };
}
