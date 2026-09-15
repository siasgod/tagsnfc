"use client";

import { useActionState } from "react";
import { criarEstabelecimentoAction } from "@/lib/actions/clientes";
import { Campo } from "@/components/ui/Campo";
import { BotaoEnviar } from "@/components/ui/BotaoEnviar";
import type { EstadoFormulario } from "@/lib/actions/auth";

const estadoInicial: EstadoFormulario = {};

export function NovoEstabelecimentoForm({ clienteId }: { clienteId: string }) {
  const acaoComCliente = criarEstabelecimentoAction.bind(null, clienteId);
  const [estado, acao] = useActionState(acaoComCliente, estadoInicial);
  return (
    <form action={acao} className="space-y-3">
      <Campo label="Nome do estabelecimento" name="nome" required />
      <Campo label="Endereço" name="endereco" />
      <Campo label="Link do perfil no Google (opcional)" name="linkPerfilGoogle" />
      <Campo label="Link de avaliação" name="linkAvaliacao" />
      {estado.erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{estado.erro}</p>}
      <BotaoEnviar>Adicionar</BotaoEnviar>
    </form>
  );
}
