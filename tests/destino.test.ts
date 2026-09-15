import { test } from "node:test";
import assert from "node:assert/strict";
import { validarDestino } from "@/lib/validacao/destino";

test("bloqueia esquema javascript:", async () => {
  const r = await validarDestino("javascript:alert(1)");
  assert.equal(r.status, "invalido");
});

test("bloqueia URL não-HTTPS", async () => {
  const r = await validarDestino("http://g.page/r/exemplo/review");
  assert.equal(r.status, "invalido");
});

test("bloqueia endereço loopback/interno", async () => {
  const r = await validarDestino("https://127.0.0.1/painel");
  assert.equal(r.status, "invalido");
});

test("bloqueia localhost", async () => {
  const r = await validarDestino("https://localhost:3000/qualquer");
  assert.equal(r.status, "invalido");
});

test("aceita formato confirmado g.page", async () => {
  const r = await validarDestino("https://g.page/r/CQAAAAAAAAAAAAAAAAAAAAA/review");
  assert.equal(r.status, "valido_confirmado");
});

test("domínio Google não reconhecido exige conferência manual, nunca finge confirmação", async () => {
  const r = await validarDestino("https://www.google.com/maps/place/Exemplo");
  assert.equal(r.status, "valido_requer_conferencia");
});

test("domínio desconhecido é rejeitado", async () => {
  const r = await validarDestino("https://exemplo-qualquer-nao-google.com/pagina");
  assert.equal(r.status, "invalido");
});
