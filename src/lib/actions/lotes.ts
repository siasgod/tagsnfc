"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirAdmin } from "@/lib/auth/autorizacao";
import { criarLoteComPlacas } from "@/lib/db/repo/lotes";
import { parametrosImpressaoPadrao, TEMPLATE_VERSAO_ATUAL } from "@/lib/pdf/cartao";
import { origemAtualConfigurada } from "@/lib/origem-publica";
import type { EstadoFormulario } from "@/lib/actions/auth";

const esquemaLote = z.object({
  quantidade: z.coerce.number().int().min(1).max(2000),
  observacoes: z.string().optional(),
});

export async function criarLoteAction(_estado: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await exigirAdmin();
  const dados = esquemaLote.safeParse(Object.fromEntries(formData));
  if (!dados.success) return { erro: dados.error.issues[0]?.message };

  const origemPublica = origemAtualConfigurada();
  if (!origemPublica) {
    return { erro: "Configure a origem pública (NEXT_PUBLIC_ORIGEM_PUBLICA) antes de gerar um lote." };
  }

  const { lote } = await criarLoteComPlacas({
    quantidade: dados.data.quantidade,
    origemPublica,
    templateVersao: TEMPLATE_VERSAO_ATUAL,
    parametrosImpressao: { ...parametrosImpressaoPadrao() },
    observacoes: dados.data.observacoes,
    criadoPorId: usuario.id,
  });

  redirect(`/painel/lotes/${lote.id}`);
}
