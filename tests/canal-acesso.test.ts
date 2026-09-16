import test from "node:test";
import assert from "node:assert/strict";
import { canalDoParametro } from "../src/lib/canal-acesso";

test("usa QR como canal padrão", () => {
  assert.equal(canalDoParametro(null), "QR");
  assert.equal(canalDoParametro("qr"), "QR");
  assert.equal(canalDoParametro("desconhecido"), "QR");
});

test("registra NFC somente quando solicitado explicitamente", () => {
  assert.equal(canalDoParametro("nfc"), "NFC");
  assert.equal(canalDoParametro("NFC"), "NFC");
});
