/**
 * Verificação automatizada real da geração de QR Code e dos arquivos de
 * impressão (seção 17 da especificação: "decodificar QR exportado e conferir
 * URL", "exportar PDF com dimensões corretas"). Não é uma simulação: gera os
 * arquivos de verdade, decodifica o PNG resultante com jsQR e lê o
 * /MediaBox real do PDF gerado (sem biblioteca extra — parse direto dos
 * bytes do PDF, formato bem definido e estável).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { conferirDecodificacaoQr } from "@/lib/qrcode/gerar";
import { gerarPdfCartaoIndividual, gerarPdfMultipagina, gerarPdfImposicaoA4 } from "@/lib/pdf/exportar";
import { parametrosImpressaoPadrao } from "@/lib/pdf/cartao";
import { mm } from "@/lib/pdf/mm";

const SAIDA = path.join(process.cwd(), "tmp-verificacao");
mkdirSync(SAIDA, { recursive: true });

function extrairMediaBoxPt(pdfBuffer: Buffer): [number, number, number, number] | null {
  const texto = pdfBuffer.toString("latin1");
  const m = texto.match(/\/MediaBox\s*\[\s*([\-0-9.]+)\s+([\-0-9.]+)\s+([\-0-9.]+)\s+([\-0-9.]+)\s*\]/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
}

function contarPaginas(pdfBuffer: Buffer): number {
  const texto = pdfBuffer.toString("latin1");
  const matches = texto.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 0;
}

async function main() {
  let falhas = 0;

  // 1) Geração + decodificação do QR
  const urlTeste = "http://localhost:3000/p/AbCdEf1234567890abcdEFGH?via=qr";
  const { ok, decodificado } = await conferirDecodificacaoQr(urlTeste);
  console.log(`[QR] gerado e decodificado: ${decodificado}`);
  if (!ok) {
    console.error("[FALHA] QR decodificado não corresponde à URL original.");
    falhas++;
  } else {
    console.log("[OK] QR decodifica exatamente para a URL original.");
  }

  // 2) PDF individual — dimensão deve ser (100 + 2*3) mm = 106mm em pontos
  const parametros = parametrosImpressaoPadrao();
  const pdfIndividual = await gerarPdfCartaoIndividual({ codigo: "PL-000001", urlQr: urlTeste }, parametros);
  writeFileSync(path.join(SAIDA, "cartao-individual.pdf"), pdfIndividual);
  const mediaBox = extrairMediaBoxPt(pdfIndividual);
  const esperadoPt = mm(106);
  console.log(`[PDF individual] MediaBox = ${JSON.stringify(mediaBox)} pt; esperado lado = ${esperadoPt.toFixed(2)}pt`);
  if (!mediaBox || Math.abs(mediaBox[2] - esperadoPt) > 0.5 || Math.abs(mediaBox[3] - esperadoPt) > 0.5) {
    console.error("[FALHA] Dimensão do PDF individual não bate com 100mm + 2×3mm de sangria.");
    falhas++;
  } else {
    console.log("[OK] Dimensão do PDF individual confere (100mm + sangria).");
  }

  // 3) PDF multipágina — uma placa por página
  const placasTeste = [1, 2, 3].map((n) => ({
    codigo: `PL-00000${n}`,
    urlQr: `http://localhost:3000/p/token-teste-${n}?via=qr`,
  }));
  const pdfMulti = await gerarPdfMultipagina(placasTeste, parametros);
  writeFileSync(path.join(SAIDA, "lote-multipagina.pdf"), pdfMulti);
  const paginas = contarPaginas(pdfMulti);
  console.log(`[PDF multipágina] páginas detectadas = ${paginas}`);
  if (paginas !== placasTeste.length) {
    console.error(`[FALHA] Esperado ${placasTeste.length} páginas, encontrado ${paginas}.`);
    falhas++;
  } else {
    console.log("[OK] Uma página por placa, como exigido.");
  }

  // 4) Imposição A4
  const placasA4 = Array.from({ length: 5 }, (_, i) => ({
    codigo: `PL-00010${i}`,
    urlQr: `http://localhost:3000/p/token-a4-${i}?via=qr`,
  }));
  const imposicao = await gerarPdfImposicaoA4(placasA4, parametros);
  writeFileSync(path.join(SAIDA, "lote-imposicao-a4.pdf"), imposicao.buffer);
  console.log(
    `[Imposição A4] ${imposicao.colunas}x${imposicao.linhas} = ${imposicao.porFolha} por folha; ${imposicao.totalFolhas} folha(s) para ${placasA4.length} placas.`
  );
  const paginasA4 = contarPaginas(imposicao.buffer);
  if (paginasA4 !== imposicao.totalFolhas) {
    console.error(`[FALHA] Esperado ${imposicao.totalFolhas} folha(s) A4, encontrado ${paginasA4}.`);
    falhas++;
  } else {
    console.log("[OK] Número de folhas A4 confere com o total calculado.");
  }

  console.log(`\nArquivos de verificação salvos em: ${SAIDA}`);
  if (falhas > 0) {
    console.error(`\n${falhas} verificação(ões) falharam.`);
    process.exit(1);
  }
  console.log("\nTodas as verificações de QR/PDF passaram.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
