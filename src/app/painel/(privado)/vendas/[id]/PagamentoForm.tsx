"use client";

import { useActionState } from "react";
import { registrarPagamentoAction } from "@/lib/actions/vendas";
import { BotaoEnviar } from "@/components/ui/BotaoEnviar";
import type { EstadoFormulario } from "@/lib/actions/auth";

const estadoInicial: EstadoFormulario = {};

export function PagamentoForm({ vendaId }: { vendaId: string }) {
  const [estado, acao] = useActionState(registrarPagamentoAction.bind(null, vendaId), estadoInicial);
  return (
    <form action={acao} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex gap-2">
        <select name="forma" className="botao-toque rounded-lg border border-slate-300 px-3">
          <option value="PIX">Pix</option>
          <option value="DINHEIRO">Dinheiro</option>
          <option value="CARTAO">Cartão</option>
          <option value="OUTRO">Outro</option>
        </select>
        <input name="valor" type="number" step="0.01" placeholder="Valor (R$)" required className="botao-toque flex-1 rounded-lg border border-slate-300 px-3" />
      </div>
      <input name="observacoes" placeholder="Observações (opcional)" className="botao-toque w-full rounded-lg border border-slate-300 px-3" />
      {estado.erro && <p className="text-sm text-red-700">{estado.erro}</p>}
      <BotaoEnviar>Registrar pagamento</BotaoEnviar>
    </form>
  );
}
