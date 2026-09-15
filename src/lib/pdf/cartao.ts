import type PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { mm } from "@/lib/pdf/mm";
import { desenharCincoEstrelas, desenharIconeNfc, desenharMarcaDeCorte } from "@/lib/pdf/formas";

type Doc = InstanceType<typeof PDFDocument>;

export const TEMPLATE_VERSAO_ATUAL = "cartao-v1";

export interface ParametrosImpressao {
  tamanhoTrimMm: number; // 100
  sangriaMm: number; // 3 por padrão
  ladoQrMm: number; // ~30
  marcasDeCorte: boolean;
}

export function parametrosImpressaoPadrao(): ParametrosImpressao {
  return { tamanhoTrimMm: 100, sangriaMm: 3, ladoQrMm: 30, marcasDeCorte: true };
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

  // Título
  doc
    .font("Poppins-Bold")
    .fontSize(15.5)
    .fillColor(COR_TEXTO)
    .text("Avalie-nos no Google", trimX + mm(4), trimY + mm(6), {
      width: trimPt - mm(8),
      align: "center",
    });

  // Estrelas
  desenharCincoEstrelas(doc, cx, trimY + mm(19), mm(2.6), mm(7));

  // Linha divisória sutil
  doc
    .moveTo(trimX + mm(6), trimY + mm(27))
    .lineTo(trimX + trimPt - mm(6), trimY + mm(27))
    .lineWidth(0.6)
    .strokeColor("#e5e7eb")
    .stroke();

  const colTopoY = trimY + mm(33);
  const colAlturaY = mm(52);
  const meioX = trimX + trimPt / 2;

  // Divisória vertical entre as duas áreas
  doc
    .moveTo(meioX, colTopoY)
    .lineTo(meioX, colTopoY + colAlturaY)
    .lineWidth(0.6)
    .strokeColor("#e5e7eb")
    .stroke();

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
  desenharIconeNfc(doc, colEsqCx, colTopoY + colAlturaY / 2 + mm(2), mm(1.15), COR_ACENTO);

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
  const qrY = colTopoY + (colAlturaY - qrLadoPt) / 2 + mm(3);
  // Fundo branco atrás do QR garante contraste mesmo se o fundo do cartão mudar no futuro.
  doc.rect(qrX, qrY, qrLadoPt, qrLadoPt).fill("#ffffff");
  SVGtoPDF(doc, dados.qrSvg, qrX, qrY, { width: qrLadoPt, height: qrLadoPt, preserveAspectRatio: "xMidYMid meet" });

  // Rodapé: código humano da placa (referência interna, não é senha nem URL)
  doc
    .font("Poppins-Regular")
    .fontSize(7)
    .fillColor("#9ca3af")
    .text(dados.codigo, trimX, trimY + trimPt - mm(7), { width: trimPt - mm(6), align: "right" });

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
    desenharMarcaDeCorte(doc, trimX, trimY, comprimento);
    desenharMarcaDeCorte(doc, trimX + trimPt, trimY, comprimento);
    desenharMarcaDeCorte(doc, trimX, trimY + trimPt, comprimento);
    desenharMarcaDeCorte(doc, trimX + trimPt, trimY + trimPt, comprimento);
  }
}

export function ladoCaixaMm(parametros: ParametrosImpressao): number {
  return parametros.tamanhoTrimMm + 2 * parametros.sangriaMm;
}
