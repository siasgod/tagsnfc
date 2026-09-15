"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { buscarUsuarioPorEmail, criarUsuario, contarUsuarios } from "@/lib/db/repo/usuarios";
import { verificarSenha, gerarHashSenha, senhaEhForte } from "@/lib/auth/senha";
import { criarSessao, encerrarSessaoAtual } from "@/lib/auth/sessao";
import { limitarTaxa, ipDaRequisicao } from "@/lib/rate-limit";

const esquemaLogin = z.object({
  email: z.string().email("E-mail inválido."),
  senha: z.string().min(1, "Informe a senha."),
  proximo: z.string().optional(),
});

export interface EstadoFormulario {
  erro?: string;
}

export async function entrar(_estado: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const dados = esquemaLogin.safeParse(Object.fromEntries(formData));
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const h = await headers();
  const ip = ipDaRequisicao(h);
  const { permitido } = limitarTaxa(`login:${ip}`, 10, 5 * 60 * 1000);
  if (!permitido) {
    return { erro: "Muitas tentativas de login. Aguarde alguns minutos e tente novamente." };
  }

  const usuario = await buscarUsuarioPorEmail(dados.data.email);
  if (!usuario || !usuario.ativo) {
    return { erro: "E-mail ou senha incorretos." };
  }

  const senhaOk = await verificarSenha(dados.data.senha, usuario.senha_hash);
  if (!senhaOk) {
    return { erro: "E-mail ou senha incorretos." };
  }

  await criarSessao(usuario.id, { userAgent: h.get("user-agent"), ip });

  redirect(dados.data.proximo && dados.data.proximo.startsWith("/painel") ? dados.data.proximo : "/painel");
}

export async function sair(): Promise<void> {
  await encerrarSessaoAtual();
  redirect("/painel/login");
}

const esquemaSetup = z.object({
  setupToken: z.string(),
  nome: z.string().min(2, "Informe seu nome."),
  email: z.string().email("E-mail inválido."),
  senha: z.string(),
});

/**
 * Criação segura do primeiro administrador (seção 5 da especificação).
 * Só funciona quando:
 *  1. Não existe nenhum usuário no banco ainda; e
 *  2. O token enviado bate com SETUP_TOKEN (variável de ambiente, definida
 *     apenas para essa operação única e que deve ser trocada/removida
 *     depois — ver README).
 * Depois do primeiro admin criado, esta ação sempre falha — não há
 * cadastro público aberto.
 */
export async function criarPrimeiroAdmin(
  _estado: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const total = await contarUsuarios();
  if (total > 0) {
    return { erro: "Já existe um administrador configurado. Peça um convite a ele." };
  }

  const dados = esquemaSetup.safeParse(Object.fromEntries(formData));
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (dados.data.setupToken !== process.env.SETUP_TOKEN || !process.env.SETUP_TOKEN) {
    return { erro: "Token de configuração inválido." };
  }

  const forca = senhaEhForte(dados.data.senha);
  if (!forca.ok) return { erro: forca.motivo };

  const senhaHash = await gerarHashSenha(dados.data.senha);
  const usuario = await criarUsuario({ nome: dados.data.nome, email: dados.data.email, senhaHash, papel: "ADMIN" });

  const h = await headers();
  await criarSessao(usuario.id, { userAgent: h.get("user-agent"), ip: ipDaRequisicao(h) });
  redirect("/painel");
}
