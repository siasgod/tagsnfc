"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirPermissao } from "@/lib/auth/autorizacao";
import { atualizarCategoria, criarCategoria, excluirCategoria } from "@/lib/db/repo/categorias";
import type { EstadoFormulario } from "@/lib/actions/auth";

const CORES = ["AZUL", "VERDE", "VIOLETA", "AMBAR", "ROSA", "CINZA"] as const;
const esquema = z.object({
  nome: z.string().trim().min(2, "Informe um nome para a categoria."),
  cor: z.enum(CORES),
});

export async function criarCategoriaAction(_estado: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  await exigirPermissao("CONFIGURACOES_EDITAR");
  const dados = esquema.safeParse(Object.fromEntries(formData));
  if (!dados.success) return { erro: dados.error.issues[0]?.message };
  try {
    await criarCategoria(dados.data);
  } catch (erro) {
    if ((erro as { code?: string }).code === "23505") return { erro: "Já existe uma categoria com este nome." };
    throw erro;
  }
  revalidatePath("/painel/configuracoes");
  return {};
}

export async function atualizarCategoriaAction(id: string, formData: FormData): Promise<void> {
  await exigirPermissao("CONFIGURACOES_EDITAR");
  const dados = esquema.parse(Object.fromEntries(formData));
  await atualizarCategoria(id, { ...dados, ativo: formData.get("ativo") === "on" });
  revalidatePath("/painel/configuracoes");
  revalidatePath("/painel/clientes");
}

export async function excluirCategoriaAction(id: string): Promise<void> {
  await exigirPermissao("CONFIGURACOES_EDITAR");
  await excluirCategoria(id);
  revalidatePath("/painel/configuracoes");
}
