"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirPermissao } from "@/lib/auth/autorizacao";
import { gerarHashSenha, senhaEhForte } from "@/lib/auth/senha";
import { criarUsuario, definirAtivo } from "@/lib/db/repo/usuarios";
import type { EstadoFormulario } from "@/lib/actions/auth";

const esquemaUsuario = z.object({
  nome: z.string().trim().min(2, "Informe o nome."),
  email: z.string().trim().email("Informe um e-mail válido."),
  senha: z.string(),
  papel: z.enum(["ADMIN", "GERENTE", "VENDEDOR", "VISUALIZADOR"]),
});

export async function criarMembroEquipeAction(_estado: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  await exigirPermissao("EQUIPE_EDITAR");
  const dados = esquemaUsuario.safeParse(Object.fromEntries(formData));
  if (!dados.success) return { erro: dados.error.issues[0]?.message };
  const forca = senhaEhForte(dados.data.senha);
  if (!forca.ok) return { erro: forca.motivo };

  try {
    await criarUsuario({
      nome: dados.data.nome,
      email: dados.data.email,
      senhaHash: await gerarHashSenha(dados.data.senha),
      papel: dados.data.papel,
    });
  } catch (erro) {
    if ((erro as { code?: string }).code === "23505") return { erro: "Já existe uma conta com este e-mail." };
    throw erro;
  }
  revalidatePath("/painel/equipe");
  return {};
}

export async function definirMembroAtivoAction(usuarioId: string, ativo: boolean): Promise<void> {
  const atual = await exigirPermissao("EQUIPE_EDITAR");
  if (atual.id === usuarioId && !ativo) {
    throw new Error("Você não pode desativar a própria conta.");
  }
  await definirAtivo(usuarioId, ativo);
  revalidatePath("/painel/equipe");
}
