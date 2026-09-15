import { test } from "node:test";
import assert from "node:assert/strict";
import { gerarPdfCartaoIndividual, gerarPdfMultipagina, gerarPdfImposicaoA4 } from "@/lib/pdf/exportar";
import { parametrosImpressaoPadrao } from "@/lib/pdf/cartao";

const placas = Array.from({ length: 30 }, (_, i) => ({ codigo: `PL-${String(i + 1).padStart(6, "0")}`, urlQr: `https://example.com/p/unidade-${i}?via=qr` }));

test("lote de 30 unidades exporta 30 páginas de 106 mm", async () => {
  const pdf = (await gerarPdfMultipagina(placas, parametrosImpressaoPadrao())).toString("latin1");
  assert.equal((pdf.match(/\/Type \/Page\b/g) ?? []).length, 30);
  const caixas = [...pdf.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)];
  assert.equal(caixas.length, 30);
  for (const caixa of caixas) {
    assert.ok(Math.abs(Number(caixa[1]) * 25.4 / 72 - 106) < 0.001);
    assert.equal(caixa[1], caixa[2]);
  }
});

test("PDF individual mantém uma página e imposição A4 não reduz as placas", async () => {
  const parametros = parametrosImpressaoPadrao();
  const individual = (await gerarPdfCartaoIndividual(placas[0], parametros)).toString("latin1");
  assert.equal((individual.match(/\/Type \/Page\b/g) ?? []).length, 1);
  const a4 = await gerarPdfImposicaoA4(placas, parametros);
  assert.equal(a4.porFolha, 2);
  assert.equal(a4.totalFolhas, 15);
  assert.equal((a4.buffer.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length, 15);
});
