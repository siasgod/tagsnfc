"use client";

import { useActionState, useState } from "react";
import { desativarPlacaAction, alterarVinculoAction, substituirPlacaAction } from "@/lib/actions/placas";
import { BotaoEnviar } from "@/components/ui/BotaoEnviar";
import type { EstadoFormulario } from "@/lib/actions/auth";

const estadoInicial: EstadoFormulario = {};

export function DesativarForm({ placaId }: { placaId: string }) {
  const [estado, acao] = useActionState(desativarPlacaAction.bind(null, placaId), estadoInicial);
  const [aberto, setAberto] = useState(false);
  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="text-sm text-red-600 underline">
        Desativar placa
      </button>
    );
  }
  return (
    <form action={acao} className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
      <input name="motivo" placeholder="Motivo da desativação" required className="botao-toque w-full rounded-lg border border-slate-300 px-3" />
      {estado.erro && <p className="text-sm text-red-700">{estado.erro}</p>}
      <div className="flex gap-2">
        <BotaoEnviar variante="perigo">Confirmar desativação</BotaoEnviar>
        <button type="button" onClick={() => setAberto(false)} className="text-sm text-slate-500">
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function AlterarVinculoForm({ placaId, estabelecimentoAtualId }: { placaId: string; estabelecimentoAtualId: string | null }) {
  const [estado, acao] = useActionState(alterarVinculoAction.bind(null, placaId), estadoInicial);
  const [aberto, setAberto] = useState(false);
  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="text-sm text-blue-600 underline">
        Mudar destino / vínculo
      </button>
    );
  }
  return (
    <form action={acao} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <input name="novoDestinoUrl" placeholder="Novo link de avaliação (opcional)" className="botao-toque w-full rounded-lg border border-slate-300 px-3" />
      <input name="novoEstabelecimentoId" placeholder="ID do novo estabelecimento (opcional)" className="botao-toque w-full rounded-lg border border-slate-300 px-3" />
      <input name="motivo" placeholder="Motivo da mudança" required className="botao-toque w-full rounded-lg border border-slate-300 px-3" />
      {estado.erro && <p className="text-sm text-red-700">{estado.erro}</p>}
      <div className="flex gap-2">
        <BotaoEnviar>Confirmar mudança</BotaoEnviar>
        <button type="button" onClick={() => setAberto(false)} className="text-sm text-slate-500">
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function SubstituirForm({ placaId }: { placaId: string }) {
  const [estado, acao] = useActionState(substituirPlacaAction.bind(null, placaId), estadoInicial);
  const [aberto, setAberto] = useState(false);
  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="text-sm text-slate-600 underline">
        Substituir placa danificada
      </button>
    );
  }
  return (
    <form action={acao} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <input name="placaNovaCodigoOuToken" placeholder="Código da placa nova (disponível)" required className="botao-toque w-full rounded-lg border border-slate-300 px-3" />
      <input name="motivo" placeholder="Motivo (ex.: placa quebrada)" required className="botao-toque w-full rounded-lg border border-slate-300 px-3" />
      {estado.erro && <p className="text-sm text-red-700">{estado.erro}</p>}
      <div className="flex gap-2">
        <BotaoEnviar>Confirmar substituição</BotaoEnviar>
        <button type="button" onClick={() => setAberto(false)} className="text-sm text-slate-500">
          Cancelar
        </button>
      </div>
    </form>
  );
}
