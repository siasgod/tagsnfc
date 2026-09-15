"use client";

import { useActionState } from "react";
import {
  atualizarConfiguracaoGeralAction,
  validarOrigemPublicaAction,
  criarVendedorAction,
} from "@/lib/actions/configuracoes";
import { Campo } from "@/components/ui/Campo";
import { BotaoEnviar } from "@/components/ui/BotaoEnviar";
import type { EstadoFormulario } from "@/lib/actions/auth";

const estadoInicial: EstadoFormulario = {};

export function ConfigGeralForm({
  nomeOperacao,
  precoPadrao,
  custoPadrao,
}: {
  nomeOperacao: string;
  precoPadrao: number;
  custoPadrao: number;
}) {
  const [estado, acao] = useActionState(atualizarConfiguracaoGeralAction, estadoInicial);
  return (
    <form action={acao} className="space-y-4">
      <Campo label="Nome da operação" name="nomeOperacao" defaultValue={nomeOperacao} />
      <Campo label="Preço padrão (R$)" name="precoPadrao" type="number" step="0.01" defaultValue={String(precoPadrao / 100)} />
      <Campo label="Custo padrão (R$)" name="custoPadrao" type="number" step="0.01" defaultValue={String(custoPadrao / 100)} />
      {estado.erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{estado.erro}</p>}
      <BotaoEnviar>Salvar</BotaoEnviar>
    </form>
  );
}

export function ValidarOrigemForm({ origemAtual, jaValidada }: { origemAtual: string; jaValidada: boolean }) {
  const [estado, acao] = useActionState(async (): Promise<EstadoFormulario> => validarOrigemPublicaAction(), estadoInicial);
  return (
    <form action={acao} className="space-y-2">
      <p className="text-sm text-slate-600">
        Origem configurada: <span className="font-mono">{origemAtual || "(não configurada)"}</span>
      </p>
      <p className={`text-sm ${jaValidada ? "text-green-700" : "text-amber-700"}`}>
        {jaValidada ? "✓ Validada como definitiva." : "Ainda não validada — exportações ficam em modo demonstração."}
      </p>
      {estado.erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{estado.erro}</p>}
      <BotaoEnviar variante="secundario">Confirmar que esta origem é definitiva</BotaoEnviar>
    </form>
  );
}

export function NovoVendedorForm() {
  const [estado, acao] = useActionState(criarVendedorAction, estadoInicial);
  return (
    <form action={acao} className="space-y-3">
      <Campo label="Nome" name="nome" required />
      <Campo label="E-mail" name="email" type="email" required />
      <Campo label="Senha temporária" name="senha" type="password" required />
      {estado.erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{estado.erro}</p>}
      <BotaoEnviar>Criar conta de vendedor</BotaoEnviar>
    </form>
  );
}
