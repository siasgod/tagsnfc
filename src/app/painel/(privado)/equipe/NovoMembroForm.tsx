"use client";

import { useActionState } from "react";
import { criarMembroEquipeAction } from "@/lib/actions/equipe";
import { BotaoEnviar } from "@/components/ui/BotaoEnviar";
import type { EstadoFormulario } from "@/lib/actions/auth";

export function NovoMembroForm() {
  const [estado, acao] = useActionState(criarMembroEquipeAction, {} as EstadoFormulario);
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-2">
      <label className="form-field"><span>Nome</span><input name="nome" required /></label>
      <label className="form-field"><span>E-mail</span><input name="email" type="email" required /></label>
      <label className="form-field"><span>Senha temporária</span><input name="senha" type="password" required /></label>
      <label className="form-field"><span>Função</span><select name="papel" defaultValue="VENDEDOR"><option value="ADMIN">Administrador</option><option value="GERENTE">Gerente</option><option value="VENDEDOR">Vendedor</option><option value="VISUALIZADOR">Visualizador</option></select></label>
      {estado.erro ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{estado.erro}</p> : null}
      <div className="sm:col-span-2"><BotaoEnviar>Adicionar à equipe</BotaoEnviar></div>
    </form>
  );
}
