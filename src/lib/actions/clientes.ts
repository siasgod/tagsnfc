"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirUsuario } from "@/lib/auth/autorizacao";
import { criarCliente, atualizarCliente, arquivarCliente, buscarClientePorId } from "@/lib/db/repo/clientes";
import { criarEstabelecimento } from "@/lib/db/repo/estabelecimentos";
import type { EstadoFormulario } from "@/lib/actions/auth";

const esquemaCliente = z.object({
  nome: z.string().min(2, "Informe o nome do cliente."),
  responsavel: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  observacoes: z.string().optional(),
});

export async function criarClienteAction(_estado: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await exigirUsuario();
  const dados = esquemaCliente.safeParse(Object.fromEntries(formData));
  if (!dados.success) return { erro: dados.error.issues[0]?.message };

  const cliente = await criarCliente({ ...dados.data, vendedorResponsavelId: usuario.id });
  revalidatePath("/painel/clientes");
  redirect(`/painel/clientes/${cliente.id}`);
}

export async function atualizarClienteAction(clienteId: string, _estado: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  await exigirUsuario();
  const dados = esquemaCliente.safeParse(Object.fromEntries(formData));
  if (!dados.success) return { erro: dados.error.issues[0]?.message };
  await atualizarCliente(clienteId, dados.data);
  revalidatePath(`/painel/clientes/${clienteId}`);
  return {};
}

export async function arquivarClienteAction(clienteId: string): Promise<void> {
  await exigirUsuario();
  await arquivarCliente(clienteId);
  revalidatePath("/painel/clientes");
}

const esquemaEstabelecimento = z.object({
  nome: z.string().min(2, "Informe o nome do estabelecimento."),
  endereco: z.string().optional(),
  linkPerfilGoogle: z.string().optional(),
  linkAvaliacao: z.string().optional(),
});

export async function criarEstabelecimentoAction(
  clienteId: string,
  _estado: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  await exigirUsuario();
  const cliente = await buscarClientePorId(clienteId);
  if (!cliente) return { erro: "Cliente não encontrado." };

  const dados = esquemaEstabelecimento.safeParse(Object.fromEntries(formData));
  if (!dados.success) return { erro: dados.error.issues[0]?.message };

  await criarEstabelecimento({ clienteId, ...dados.data });
  revalidatePath(`/painel/clientes/${clienteId}`);
  return {};
}
