import type { NextRequest } from "next/server";
import { z } from "zod";
import { exigirAcessoCliente, exigirPermissao } from "@/lib/auth/autorizacao";
import { buscarEstabelecimentoPorId } from "@/lib/db/repo/estabelecimentos";
import { validarDestino } from "@/lib/validacao/destino";
import { ativarPlaca, ErroAtivacao } from "@/lib/db/repo/ativacao";
import { limitarTaxa, ipDaRequisicao } from "@/lib/rate-limit";
import { comTratamentoDeErros } from "@/lib/api-utils";

export const runtime = "nodejs";

const esquema = z.object({
  identificadorPlaca: z.string().min(3),
  clienteId: z.string().uuid().optional(),
  novoCliente: z
    .object({
      nome: z.string().min(2),
      responsavel: z.string().optional(),
      telefone: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
    })
    .optional(),
  estabelecimentoId: z.string().uuid().optional(),
  novoEstabelecimento: z
    .object({
      nome: z.string().min(2),
      endereco: z.string().optional(),
      linkPerfilGoogle: z.string().optional(),
    })
    .optional(),
  destinoUrl: z.string().min(5),
  venda: z
    .object({
      tipo: z.enum(["VENDA", "DEMONSTRACAO", "BONIFICACAO"]),
      justificativa: z.string().optional(),
      precoCentavos: z.coerce.number().int().min(0),
      custoCentavos: z.coerce.number().int().min(0),
      descontoCentavos: z.coerce.number().int().min(0).optional(),
    })
    .optional(),
  chaveIdempotencia: z.string().min(10),
  confirmarMesmoComConferenciaManualPendente: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  return comTratamentoDeErros(async () => ativarViaHttp(request));
}

async function ativarViaHttp(request: NextRequest): Promise<Response> {
  const usuario = await exigirPermissao("ATIVAR_PLACA");

  const ip = ipDaRequisicao(request.headers);
  const { permitido } = limitarTaxa(`ativacao:${usuario.id}:${ip}`, 30, 60_000);
  if (!permitido) {
    return Response.json({ erro: "Muitas tentativas em curto intervalo. Aguarde um pouco." }, { status: 429 });
  }

  const corpo = await request.json().catch(() => null);
  const dados = esquema.safeParse(corpo);
  if (!dados.success) {
    return Response.json({ erro: dados.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const entrada = dados.data;

  if (entrada.clienteId) await exigirAcessoCliente(usuario, entrada.clienteId);
  if (entrada.estabelecimentoId) {
    const estabelecimento = await buscarEstabelecimentoPorId(entrada.estabelecimentoId);
    if (!estabelecimento) return Response.json({ erro: "Estabelecimento não encontrado." }, { status: 404 });
    await exigirAcessoCliente(usuario, estabelecimento.cliente_id);
  }

  if (entrada.venda && entrada.venda.tipo !== "VENDA" && !entrada.venda.justificativa) {
    return Response.json({ erro: "Demonstração e bonificação exigem uma justificativa." }, { status: 400 });
  }

  const validacaoDestino = await validarDestino(entrada.destinoUrl);
  if (validacaoDestino.status === "invalido") {
    return Response.json({ erro: validacaoDestino.motivo }, { status: 400 });
  }
  if (
    validacaoDestino.status === "valido_requer_conferencia" &&
    !entrada.confirmarMesmoComConferenciaManualPendente
  ) {
    // Nunca inventamos uma confirmação: devolvemos o aviso e exigimos que o
    // operador confirme explicitamente que conferiu manualmente.
    return Response.json(
      {
        exigeConferenciaManual: true,
        motivo: validacaoDestino.motivo,
        urlFinal: validacaoDestino.urlFinal,
      },
      { status: 409 }
    );
  }

  try {
    const resultado = await ativarPlaca({
      identificadorPlaca: entrada.identificadorPlaca,
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      clienteId: entrada.clienteId,
      novoCliente: entrada.novoCliente,
      estabelecimentoId: entrada.estabelecimentoId,
      novoEstabelecimento: entrada.novoEstabelecimento,
      destinoUrl: validacaoDestino.status === "valido_confirmado" ? validacaoDestino.urlFinal : entrada.destinoUrl,
      destinoConfirmado: validacaoDestino.status === "valido_confirmado",
      venda: entrada.venda,
      chaveIdempotencia: entrada.chaveIdempotencia,
    });

    return Response.json({
      ok: true,
      placa: { id: resultado.placa.id, codigo: resultado.placa.codigo, urlQr: resultado.placa.url_qr, urlNfc: resultado.placa.url_nfc },
      vendaDuplicada: resultado.venda?.duplicada ?? false,
    });
  } catch (err) {
    if (err instanceof ErroAtivacao) {
      const status = err.codigo === "placa_nao_encontrada" ? 404 : 409;
      return Response.json({ erro: err.message, codigo: err.codigo }, { status });
    }
    console.error("[ativacao] erro inesperado:", err);
    return Response.json({ erro: "Falha inesperada ao ativar. Tente novamente." }, { status: 500 });
  }
}
