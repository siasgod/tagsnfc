"use client";

import { useActionState } from "react";
import { entrar, type EstadoFormulario } from "@/lib/actions/auth";
import { Campo } from "@/components/ui/Campo";
import { BotaoEnviar } from "@/components/ui/BotaoEnviar";

const estadoInicial: EstadoFormulario = {};

export function LoginForm({ proximo }: { proximo?: string }) {
  const [estado, acaoFormulario] = useActionState(entrar, estadoInicial);

  return (
    <form action={acaoFormulario} className="space-y-4">
      <input type="hidden" name="proximo" value={proximo ?? ""} />
      <Campo label="E-mail" name="email" type="email" required autoComplete="username" />
      <Campo label="Senha" name="senha" type="password" required autoComplete="current-password" />
      {estado.erro && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{estado.erro}</p>
      )}
      <BotaoEnviar className="w-full">Entrar</BotaoEnviar>
    </form>
  );
}
