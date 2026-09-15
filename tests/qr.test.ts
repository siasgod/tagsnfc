import { test } from "node:test";
import assert from "node:assert/strict";
import { conferirDecodificacaoQr } from "@/lib/qrcode/gerar";

test("QR gerado decodifica exatamente para a URL original", async () => {
  const url = "https://exemplo-teste.local/p/abc123XYZ?via=qr";
  const { ok, decodificado } = await conferirDecodificacaoQr(url);
  assert.equal(ok, true);
  assert.equal(decodificado, url);
});
