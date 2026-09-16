"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAcessoVenda, exigirPermissao } from "@/lib/auth/autorizacao";
import { registrarPagamento } from "@/lib/db/repo/vendas";
import { paraCentavos } from "@/lib/dinheiro";
import type { EstadoFormulario } from "@/lib/actions/auth";

const esquema = z.object({
  forma: z.enum(["PIX", "DINHEIRO", "CARTAO", "OUTRO"]),
  valor: z.coerce.number().positive("Informe um valor maior que zero."),
  observacoes: z.string().optional(),
});

export async function registrarPagamentoAction(vendaId: string, _e: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("VENDAS_EDITAR");
  await exigirAcessoVenda(usuario, vendaId);
  const dados = esquema.safeParse(Object.fromEntries(formData));
  if (!dados.success) return { erro: dados.error.issues[0]?.message };

  await registrarPagamento({
    vendaId,
    forma: dados.data.forma,
    valorCentavos: paraCentavos(dados.data.valor),
    observacoes: dados.data.observacoes,
    usuarioId: usuario.id,
  });
  revalidatePath(`/painel/vendas/${vendaId}`);
  return {};
}
