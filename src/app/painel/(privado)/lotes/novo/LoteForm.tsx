"use client";

import { useActionState, useState } from "react";
import { criarLoteAction } from "@/lib/actions/lotes";
import { Campo } from "@/components/ui/Campo";
import { BotaoEnviar } from "@/components/ui/BotaoEnviar";
import type { EstadoFormulario } from "@/lib/actions/auth";

const estadoInicial: EstadoFormulario = {};
const TAMANHOS_SUGERIDOS = [5, 10, 50, 100];

export function LoteForm({ origemAtual }: { origemAtual: string }) {
  const [estado, acao] = useActionState(criarLoteAction, estadoInicial);
  const [quantidade, setQuantidade] = useState<number | "">("");

  return (
    <form action={acao} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Quantidade</label>
        <div className="mt-1 flex flex-wrap gap-2">
          {TAMANHOS_SUGERIDOS.map((q) => (
            <button
              type="button"
              key={q}
              onClick={() => setQuantidade(q)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${quantidade === q ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-600"}`}
            >
              {q}
            </button>
          ))}
        </div>
        <input
          type="number"
          name="quantidade"
          min={1}
          max={2000}
          required
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="Ou digite uma quantidade personalizada"
          className="botao-toque mt-2 block w-full rounded-lg border border-slate-300 px-3"
        />
      </div>
      <Campo label="Observações" name="observacoes" />
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Origem pública usada nas URLs deste lote: <span className="font-mono">{origemAtual || "(não configurada)"}</span>.
        {" "}Isso é gravado permanentemente nas placas geradas — para trocar depois, configure em Configurações antes
        de gerar o próximo lote.
      </p>
      {estado.erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{estado.erro}</p>}
      <BotaoEnviar className="w-full">Gerar lote</BotaoEnviar>
    </form>
  );
}
