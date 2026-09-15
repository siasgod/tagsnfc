"use client";

import { useActionState } from "react";
import { criarPrimeiroAdmin, type EstadoFormulario } from "@/lib/actions/auth";
import { Campo } from "@/components/ui/Campo";
import { BotaoEnviar } from "@/components/ui/BotaoEnviar";

const estadoInicial: EstadoFormulario = {};

export function SetupForm() {
  const [estado, acaoFormulario] = useActionState(criarPrimeiroAdmin, estadoInicial);

  return (
    <form action={acaoFormulario} className="space-y-4">
      <Campo label="Token de configuração (SETUP_TOKEN)" name="setupToken" type="password" required />
      <Campo label="Seu nome" name="nome" required autoComplete="name" />
      <Campo label="E-mail" name="email" type="email" required autoComplete="username" />
      <Campo label="Senha (mín. 10 caracteres, com maiúscula/minúscula/número)" name="senha" type="password" required autoComplete="new-password" />
      {estado.erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{estado.erro}</p>}
      <BotaoEnviar className="w-full">Criar administrador</BotaoEnviar>
    </form>
  );
}
