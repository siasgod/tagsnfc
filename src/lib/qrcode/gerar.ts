import QRCode from "qrcode";
import jsQR from "jsqr";
import { PNG } from "pngjs";

/**
 * Geração de QR Code real via biblioteca (`qrcode`, amplamente usada e
 * auditável) — nunca por geração de imagem via IA, conforme exigido.
 * Nível de correção de erro inicial: M (conforme especificação).
 */
const NIVEL_CORRECAO_ERRO_PADRAO = "M" as const;

export async function gerarQrSvg(
  url: string,
  opcoes: { margemModulos?: number } = {}
): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: NIVEL_CORRECAO_ERRO_PADRAO,
    margin: opcoes.margemModulos ?? 4, // margem livre mínima de 4 módulos
    color: { dark: "#000000", light: "#ffffff" },
  });
}

export async function gerarQrPngBuffer(
  url: string,
  opcoes: { larguraPx?: number; margemModulos?: number } = {}
): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: NIVEL_CORRECAO_ERRO_PADRAO,
    margin: opcoes.margemModulos ?? 4,
    width: opcoes.larguraPx ?? 1024,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

/**
 * Conferência automatizada de decodificação (seção 11 / 17 da
 * especificação): gera o PNG do QR e decodifica de volta, garantindo que o
 * conteúdo decodificado é exatamente a URL esperada antes de considerar o
 * lote pronto. Usa `jsQR` (decodificador independente da biblioteca de
 * geração), sobre os pixels reais do PNG gerado — não é uma simulação.
 */
export async function conferirDecodificacaoQr(url: string): Promise<{ ok: boolean; decodificado: string | null }> {
  const buffer = await gerarQrPngBuffer(url, { larguraPx: 512 });
  const png = PNG.sync.read(buffer);
  const resultado = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return { ok: resultado?.data === url, decodificado: resultado?.data ?? null };
}
