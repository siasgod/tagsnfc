import type PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { mm } from "@/lib/pdf/mm";
import { desenharCincoEstrelas, desenharIconeNfc } from "@/lib/pdf/formas";

type Doc = InstanceType<typeof PDFDocument>;

export const TEMPLATE_VERSAO_ATUAL = "balcao-v2";

export interface ParametrosImpressao {
  tamanhoTrimMm: number; // 100
  sangriaMm: number; // 3 por padrão
  ladoQrMm: number; // ~30
  marcasDeCorte: boolean;
}

export function parametrosImpressaoPadrao(): ParametrosImpressao {
  return { tamanhoTrimMm: 100, sangriaMm: 3, ladoQrMm: 35, marcasDeCorte: true };
}

export interface DadosCartao {
  codigo: string;
  qrSvg: string;
  nomeOperacao?: string;
  marcaDagua?: string;
}

const COR_TEXTO = "#111318";
const COR_SECUNDARIA = "#4b5563";
const COR_ACENTO = "#1a73e8"; // azul Google

/**
 * Desenha um cartão completo (fundo + arte + QR) dentro do documento pdfkit,
 * com o canto superior-esquerdo da área de sangria em (origemXPt, origemYPt).
 * Todas as medidas de layout vêm de `parametros` (mm), convertidas para
 * pontos apenas no momento do desenho — reexportar um lote com os mesmos
 * parâmetros produz o mesmo arquivo (determinístico).
 */
export function desenharCartao(
  doc: Doc,
  origemXPt: number,
  origemYPt: number,
  parametros: ParametrosImpressao,
  dados: DadosCartao
) {
  const { tamanhoTrimMm, sangriaMm, ladoQrMm, marcasDeCorte } = parametros;
  const boxPt = mm(tamanhoTrimMm + 2 * sangriaMm);
  const trimX = origemXPt + mm(sangriaMm);
  const trimY = origemYPt + mm(sangriaMm);
  const trimPt = mm(tamanhoTrimMm);

  // Fundo cobre toda a sangria (evita borda branca indesejada após o corte).
  doc.rect(origemXPt, origemYPt, boxPt, boxPt).fill("#ffffff");

  const cx = trimX + trimPt / 2;

  // Cabeçalho com curva, em vetor; fundo azul cobre a sangria superior.
  doc.moveTo(origemXPt, trimY + mm(48))
    .bezierCurveTo(trimX + mm(40), trimY + mm(29), trimX + mm(68), trimY + mm(53), origemXPt + boxPt, trimY + mm(43))
    .lineTo(origemXPt + boxPt, origemYPt).lineTo(origemXPt, origemYPt).closePath().fill(COR_ACENTO);
  const google = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="white"/><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-1.9 4.6-4.1 6v5h6.6c3.9-3.6 6.1-8.7 6.1-14.7z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2C9.2 39.5 16.1 44 24 44z"/><path fill="#FBBC05" d="M12.6 27.7a12 12 0 0 1 0-7.4v-5.2H5.8a20 20 0 0 0 0 17.8z"/><path fill="#EA4335" d="M24 11.9c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6 29.5 4 24 4 16.1 4 9.2 8.5 5.8 15.1l6.8 5.2C14.2 15.5 18.7 11.9 24 11.9z"/></svg>';
  SVGtoPDF(doc, google, trimX + mm(7), trimY + mm(8), { width: mm(29), height: mm(29) });
  doc.font("Poppins-Medium").fontSize(19).fillColor("#ffffff")
    .text("Avalie-nos", trimX + mm(40), trimY + mm(8), { width: mm(56), align: "center" })
    .font("Poppins-Bold").fontSize(21)
    .text("no Google", trimX + mm(39), trimY + mm(19), { width: mm(58), align: "center" });
  desenharCincoEstrelas(doc, trimX + mm(68), trimY + mm(35), mm(2.7), mm(8));
  const colTopoY = trimY + mm(52);
  const colAlturaY = mm(36);
  const meioX = trimX + trimPt / 2;
  doc.font("Poppins-Bold").fontSize(11).fillColor(COR_TEXTO).text("ou", meioX - mm(4), trimY + mm(73), { width: mm(8), align: "center" });

  // --- Coluna esquerda: NFC ---
  const colEsqCx = trimX + trimPt * 0.25;
  doc
    .font("Poppins-Medium")
    .fontSize(9)
    .fillColor(COR_SECUNDARIA)
    .text("Aproxime seu celular", trimX + mm(3), colTopoY, {
      width: trimPt / 2 - mm(6),
      align: "center",
    });
  desenharIconeNfc(doc, colEsqCx, trimY + mm(77), mm(1.3), COR_ACENTO);

  // --- Coluna direita: QR ---
  const colDirX = meioX;
  doc
    .font("Poppins-Medium")
    .fontSize(9)
    .fillColor(COR_SECUNDARIA)
    .text("Escaneie o QR Code", colDirX + mm(3), colTopoY, {
      width: trimPt / 2 - mm(6),
      align: "center",
    });

  const qrLadoPt = mm(ladoQrMm);
  const qrX = colDirX + (trimPt / 2 - qrLadoPt) / 2;
  const qrY = trimY + mm(60);
  // Fundo branco atrás do QR garante contraste mesmo se o fundo do cartão mudar no futuro.
  doc.rect(qrX, qrY, qrLadoPt, qrLadoPt).fill("#ffffff");
  SVGtoPDF(doc, dados.qrSvg, qrX, qrY, { width: qrLadoPt, height: qrLadoPt, preserveAspectRatio: "xMidYMid meet" });

  // Rodapé: código humano da placa (referência interna, não é senha nem URL)
  doc
    .font("Poppins-Regular")
    .fontSize(7)
    .fillColor("#9ca3af")
    .text(dados.codigo, trimX, trimY + trimPt - mm(3), { width: trimPt - mm(6), align: "right" });

  if (dados.nomeOperacao) {
    doc
      .font("Poppins-Regular")
      .fontSize(7)
      .fillColor("#9ca3af")
      .text(dados.nomeOperacao, trimX + mm(3), trimY + trimPt - mm(7), {
        width: trimPt / 2,
        align: "left",
      });
  }

  if (dados.marcaDagua) {
    doc.save();
    doc.rotate(-30, { origin: [cx, trimY + trimPt / 2] });
    doc
      .font("Poppins-Bold")
      .fontSize(13)
      .fillOpacity(0.28)
      .fillColor("#dc2626")
      .text(dados.marcaDagua, trimX - mm(20), trimY + trimPt / 2 - mm(5), {
        width: trimPt + mm(40),
        align: "center",
      });
    doc.fillOpacity(1);
    doc.restore();
  }

  if (marcasDeCorte && sangriaMm > 0) {
    const comprimento = Math.min(mm(sangriaMm) * 0.9, mm(4));
    doc.save().lineWidth(0.35).strokeColor("#000000");
    for (const [x, y, dx, dy] of [[trimX, trimY, -1, -1], [trimX + trimPt, trimY, 1, -1], [trimX, trimY + trimPt, -1, 1], [trimX + trimPt, trimY + trimPt, 1, 1]]) {
      doc.moveTo(x + dx * mm(0.5), y).lineTo(x + dx * comprimento, y).stroke();
      doc.moveTo(x, y + dy * mm(0.5)).lineTo(x, y + dy * comprimento).stroke();
    }
    doc.restore();
  }
}

export function ladoCaixaMm(parametros: ParametrosImpressao): number {
  return parametros.tamanhoTrimMm + 2 * parametros.sangriaMm;
}
