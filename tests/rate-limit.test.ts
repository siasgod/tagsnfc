import { test } from "node:test";
import assert from "node:assert/strict";
import { limitarTaxa } from "@/lib/rate-limit";

test("bloqueia após exceder o limite na janela de tempo", () => {
  const chave = "teste-" + Math.random();
  for (let i = 0; i < 5; i++) {
    const r = limitarTaxa(chave, 5, 60_000);
    assert.equal(r.permitido, true);
  }
  const bloqueado = limitarTaxa(chave, 5, 60_000);
  assert.equal(bloqueado.permitido, false);
});
