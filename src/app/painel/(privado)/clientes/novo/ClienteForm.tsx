"use client";

import { useActionState } from "react";
import { criarClienteAction } from "@/lib/actions/clientes";
import { Campo } from "@/components/ui/Campo";
import { BotaoEnviar } from "@/components/ui/BotaoEnviar";
import type { EstadoFormulario } from "@/lib/actions/auth";

const estadoInicial: EstadoFormulario = {};

export function ClienteForm() {
  const [estado, acao] = useActionState(criarClienteAction, estadoInicial);
  return (
    <form action={acao} className="space-y-4">
      <Campo label="Nome do cliente/empresa" name="nome" required />
      <Campo label="Responsável" name="responsavel" />
      <Campo label="Telefone/WhatsApp" name="telefone" />
      <Campo label="E-mail" name="email" type="email" />
      <Campo label="Observações" name="observacoes" />
      {estado.erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{estado.erro}</p>}
      <BotaoEnviar className="w-full">Cadastrar cliente</BotaoEnviar>
    </form>
  );
}
