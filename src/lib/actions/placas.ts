"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAdmin, exigirUsuario } from "@/lib/auth/autorizacao";
import { atribuirVendedor, atualizarConferenciaProducao, registrarConfiguracaoNfc } from "@/lib/db/repo/placas";
import { alterarVinculoPlacaAtiva, desativarPlaca, substituirPlaca } from "@/lib/db/repo/ativacao";
import { validarDestino } from "@/lib/validacao/destino";
import type { EstadoFormulario } from "@/lib/actions/auth";

export async function atribuirVendedorAction(placaId: string, formData: FormData): Promise<void> {
  await exigirAdmin();
  const vendedorId = (formData.get("vendedorId") as string) || null;
  await atribuirVendedor(placaId, vendedorId);
  revalidatePath(`/painel/placas/${placaId}`);
}

export async function marcarConferenciaAction(
  placaId: string,
  campo: "conferencia_impressao_em" | "conferencia_qr_em" | "conferencia_montagem_em"
): Promise<void> {
  const usuario = await exigirUsuario();
  await atualizarConferenciaProducao(placaId, campo, usuario.nome);
  revalidatePath(`/painel/placas/${placaId}`);
}

export async function registrarNfcAction(placaId: string, formData: FormData): Promise<void> {
  const usuario = await exigirUsuario();
  await registrarConfiguracaoNfc(placaId, {
    modelo: (formData.get("modelo") as string) || undefined,
    uid: (formData.get("uid") as string) || undefined,
    usuarioNome: usuario.nome,
    marcarGravado: formData.get("marcarGravado") === "on",
    marcarLeituraConferida: formData.get("marcarLeituraConferida") === "on",
  });
  revalidatePath(`/painel/placas/${placaId}`);
}

export async function desativarPlacaAction(placaId: string, _e: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await exigirUsuario();
  const motivo = (formData.get("motivo") as string) ?? "";
  if (motivo.trim().length < 3) return { erro: "Informe o motivo da desativação." };
  await desativarPlaca({ placaId, usuarioId: usuario.id, motivo });
  revalidatePath(`/painel/placas/${placaId}`);
  return {};
}

export async function alterarVinculoAction(
  placaId: string,
  _e: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const usuario = await exigirUsuario();
  const novoDestinoUrl = (formData.get("novoDestinoUrl") as string) || undefined;
  const novoEstabelecimentoId = (formData.get("novoEstabelecimentoId") as string) || undefined;
  const motivo = (formData.get("motivo") as string) ?? "";

  if (motivo.trim().length < 3) return { erro: "Informe o motivo da mudança." };
  if (!novoDestinoUrl && !novoEstabelecimentoId) return { erro: "Informe um novo destino ou um novo estabelecimento." };

  let destinoConfirmado = false;
  let destinoFinal = novoDestinoUrl;
  if (novoDestinoUrl) {
    const validacao = await validarDestino(novoDestinoUrl);
    if (validacao.status === "invalido") return { erro: validacao.motivo };
    destinoConfirmado = validacao.status === "valido_confirmado";
    destinoFinal = validacao.urlFinal;
  }

  await alterarVinculoPlacaAtiva({
    placaId,
    usuarioId: usuario.id,
    usuarioNome: usuario.nome,
    novoEstabelecimentoId,
    novoDestinoUrl: destinoFinal,
    destinoConfirmado,
    motivo,
  });
  revalidatePath(`/painel/placas/${placaId}`);
  return {};
}

const esquemaSubstituir = z.object({ placaNovaCodigoOuToken: z.string().min(3), motivo: z.string().min(3) });

export async function substituirPlacaAction(placaAntigaId: string, _e: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await exigirUsuario();
  const dados = esquemaSubstituir.safeParse(Object.fromEntries(formData));
  if (!dados.success) return { erro: dados.error.issues[0]?.message };

  const { buscarPlacaPorCodigoOuToken } = await import("@/lib/db/repo/placas");
  const nova = await buscarPlacaPorCodigoOuToken(dados.data.placaNovaCodigoOuToken);
  if (!nova) return { erro: "Placa nova não encontrada." };

  try {
    await substituirPlaca({ placaAntigaId, placaNovaId: nova.id, usuarioId: usuario.id, motivo: dados.data.motivo });
  } catch (err) {
    return { erro: (err as Error).message };
  }
  revalidatePath(`/painel/placas/${placaAntigaId}`);
  revalidatePath(`/painel/placas/${nova.id}`);
  return {};
}
