"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAdmin } from "@/lib/auth/autorizacao";
import { atualizarConfiguracao, validarOrigemPublica } from "@/lib/db/repo/configuracoes";
import { criarUsuario } from "@/lib/db/repo/usuarios";
import { gerarHashSenha, senhaEhForte } from "@/lib/auth/senha";
import { pareceOrigemNaoProdutiva, origemAtualConfigurada } from "@/lib/origem-publica";
import { paraCentavos } from "@/lib/dinheiro";
import type { EstadoFormulario } from "@/lib/actions/auth";

const esquemaConfig = z.object({
  nomeOperacao: z.string().optional(),
  precoPadrao: z.coerce.number().min(0).optional(),
  custoPadrao: z.coerce.number().min(0).optional(),
});

export async function atualizarConfiguracaoGeralAction(_e: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  await exigirAdmin();
  const dados = esquemaConfig.safeParse(Object.fromEntries(formData));
  if (!dados.success) return { erro: dados.error.issues[0]?.message };

  await atualizarConfiguracao({
    nome_operacao: dados.data.nomeOperacao,
    preco_padrao_centavos: dados.data.precoPadrao !== undefined ? paraCentavos(dados.data.precoPadrao) : undefined,
    custo_padrao_centavos: dados.data.custoPadrao !== undefined ? paraCentavos(dados.data.custoPadrao) : undefined,
  });
  revalidatePath("/painel/configuracoes");
  return {};
}

export async function validarOrigemPublicaAction(): Promise<EstadoFormulario> {
  await exigirAdmin();
  const origem = origemAtualConfigurada();
  if (!origem) return { erro: "NEXT_PUBLIC_ORIGEM_PUBLICA não está definida." };

  const heuristica = pareceOrigemNaoProdutiva(origem);
  if (heuristica.suspeita) {
    return { erro: `Esta origem não pode ser validada como definitiva: ${heuristica.motivo}` };
  }

  await validarOrigemPublica(origem);
  revalidatePath("/painel/configuracoes");
  return {};
}

const esquemaVendedor = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  senha: z.string(),
});

export async function criarVendedorAction(_e: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  await exigirAdmin();
  const dados = esquemaVendedor.safeParse(Object.fromEntries(formData));
  if (!dados.success) return { erro: dados.error.issues[0]?.message };

  const forca = senhaEhForte(dados.data.senha);
  if (!forca.ok) return { erro: forca.motivo };

  await criarUsuario({ nome: dados.data.nome, email: dados.data.email, senhaHash: await gerarHashSenha(dados.data.senha), papel: "VENDEDOR" });
  revalidatePath("/painel/configuracoes");
  return {};
}
