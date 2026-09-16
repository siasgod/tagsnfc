"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirAcessoCliente, exigirPermissao, podeVerTudo } from "@/lib/auth/autorizacao";
import { criarCliente, atualizarCliente, arquivarCliente, buscarClientePorId } from "@/lib/db/repo/clientes";
import { criarEstabelecimento } from "@/lib/db/repo/estabelecimentos";
import type { EstadoFormulario } from "@/lib/actions/auth";

const esquemaCliente = z.object({
  nome: z.string().min(2, "Informe o nome do cliente."),
  responsavel: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  observacoes: z.string().optional(),
  categoriaId: z.string().uuid().optional().or(z.literal("")),
  responsavelComercialId: z.string().uuid().optional().or(z.literal("")),
});

export async function criarClienteAction(_estado: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("CLIENTES_EDITAR");
  const dados = esquemaCliente.safeParse(Object.fromEntries(formData));
  if (!dados.success) return { erro: dados.error.issues[0]?.message };

  const cliente = await criarCliente({
    nome: dados.data.nome,
    responsavel: dados.data.responsavel,
    telefone: dados.data.telefone,
    email: dados.data.email,
    observacoes: dados.data.observacoes,
    vendedorResponsavelId: podeVerTudo(usuario) && dados.data.responsavelComercialId
      ? dados.data.responsavelComercialId
      : usuario.id,
    categoriaId: dados.data.categoriaId || undefined,
  });
  revalidatePath("/painel/clientes");
  redirect(`/painel/clientes/${cliente.id}`);
}

export async function atualizarClienteAction(clienteId: string, _estado: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("CLIENTES_EDITAR");
  await exigirAcessoCliente(usuario, clienteId);
  const dados = esquemaCliente.safeParse(Object.fromEntries(formData));
  if (!dados.success) return { erro: dados.error.issues[0]?.message };
  await atualizarCliente(clienteId, {
    nome: dados.data.nome,
    responsavel: dados.data.responsavel || null,
    telefone: dados.data.telefone || null,
    email: dados.data.email || null,
    observacoes: dados.data.observacoes || null,
    categoria_id: dados.data.categoriaId || null,
    ...(podeVerTudo(usuario) && dados.data.responsavelComercialId
      ? { vendedor_responsavel_id: dados.data.responsavelComercialId }
      : {}),
  });
  revalidatePath(`/painel/clientes/${clienteId}`);
  return {};
}

export async function arquivarClienteAction(clienteId: string): Promise<void> {
  const usuario = await exigirPermissao("CLIENTES_EDITAR");
  await exigirAcessoCliente(usuario, clienteId);
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
  const usuario = await exigirPermissao("CLIENTES_EDITAR");
  await exigirAcessoCliente(usuario, clienteId);
  const cliente = await buscarClientePorId(clienteId);
  if (!cliente) return { erro: "Cliente não encontrado." };

  const dados = esquemaEstabelecimento.safeParse(Object.fromEntries(formData));
  if (!dados.success) return { erro: dados.error.issues[0]?.message };

  await criarEstabelecimento({ clienteId, ...dados.data });
  revalidatePath(`/painel/clientes/${clienteId}`);
  return {};
}
