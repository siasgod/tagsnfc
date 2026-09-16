"use client";

import { useActionState } from "react";
import { atualizarClienteAction } from "@/lib/actions/clientes";
import { BotaoEnviar } from "@/components/ui/BotaoEnviar";
import type { EstadoFormulario } from "@/lib/actions/auth";

export function EditarClienteForm({ cliente, categorias, responsaveis, podeReatribuir }: {
  cliente: { id: string; nome: string; responsavel: string | null; telefone: string | null; email: string | null; observacoes: string | null; categoria_id: string | null; vendedor_responsavel_id: string | null };
  categorias: { id: string; nome: string }[];
  responsaveis: { id: string; nome: string }[];
  podeReatribuir: boolean;
}) {
  const acaoServidor = atualizarClienteAction.bind(null, cliente.id);
  const [estado, acao] = useActionState(acaoServidor, {} as EstadoFormulario);
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-2">
      <label className="form-field sm:col-span-2">Nome<input name="nome" required defaultValue={cliente.nome} /></label>
      <label className="form-field">Contato principal<input name="responsavel" defaultValue={cliente.responsavel ?? ""} /></label>
      <label className="form-field">Telefone<input name="telefone" defaultValue={cliente.telefone ?? ""} /></label>
      <label className="form-field">E-mail<input name="email" type="email" defaultValue={cliente.email ?? ""} /></label>
      <label className="form-field">Categoria<select name="categoriaId" defaultValue={cliente.categoria_id ?? ""}><option value="">Sem categoria</option>{categorias.map((c) => <option value={c.id} key={c.id}>{c.nome}</option>)}</select></label>
      {podeReatribuir ? <label className="form-field sm:col-span-2">Responsável comercial<select name="responsavelComercialId" defaultValue={cliente.vendedor_responsavel_id ?? ""}><option value="">Selecione</option>{responsaveis.map((r) => <option value={r.id} key={r.id}>{r.nome}</option>)}</select></label> : null}
      <label className="form-field sm:col-span-2">Observações<textarea name="observacoes" defaultValue={cliente.observacoes ?? ""} /></label>
      {estado.erro ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{estado.erro}</p> : null}
      <div className="sm:col-span-2"><BotaoEnviar>Salvar alterações</BotaoEnviar></div>
    </form>
  );
}
