import type { NextRequest } from "next/server";
import { buscarPlacaPorToken } from "@/lib/db/repo/placas";
import { registrarEventoAcesso, type CanalAcesso } from "@/lib/db/repo/eventos";
import { ipDaRequisicao } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function pagina(titulo: string, mensagem: string, status: number): Response {
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${titulo}</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; min-height:100dvh; display:flex; align-items:center; justify-content:center;
         font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         background:#f8f9fb; color:#1a1a1a; padding: 24px; box-sizing:border-box; }
  .cartao { max-width: 420px; text-align:center; }
  h1 { font-size: 1.25rem; margin-bottom: 8px; }
  p { color:#555; line-height:1.5; }
</style>
</head>
<body>
  <div class="cartao">
    <h1>${titulo}</h1>
    <p>${mensagem}</p>
  </div>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function canalDoParametro(via: string | null): CanalAcesso {
  if (via === "qr") return "QR";
  if (via === "nfc") return "NFC";
  return "DESCONHECIDO";
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const canal = canalDoParametro(request.nextUrl.searchParams.get("via"));

  let placa;
  try {
    placa = await buscarPlacaPorToken(token);
  } catch (err) {
    console.error("[/p/token] falha ao consultar banco:", err);
    return pagina(
      "Falha temporária",
      "Não conseguimos carregar esta placa agora. Aguarde um instante e tente novamente."
    ,
      503
    );
  }

  if (!placa) {
    return pagina("Página não encontrada", "Este código não corresponde a nenhuma placa.", 404);
  }

  // Registro de acesso: melhor esforço, nunca bloqueia o redirecionamento.
  // Qualquer falha aqui é apenas logada — a indisponibilidade da coleta de
  // métricas não pode impedir a função principal da placa.
  void registrarEventoAcesso({
    placaId: placa.id,
    estabelecimentoId: placa.estabelecimento_id,
    canal,
    ip: ipDaRequisicao(request.headers),
    userAgent: request.headers.get("user-agent"),
  }).catch((err) => {
    console.error("[/p/token] falha ao registrar evento de acesso (ignorada):", err);
  });

  switch (placa.estado_comercial) {
    case "ATIVA": {
      if (!placa.destino_url) {
        return pagina(
          "Esta placa ainda não foi ativada",
          "Peça ao lojista para concluir a configuração desta placa no painel."
        , 200);
      }
      return new Response(null, {
        status: 307,
        headers: {
          location: placa.destino_url,
          "cache-control": "no-store, must-revalidate",
        },
      });
    }
    case "DISPONIVEL":
    case "RESERVADA":
      return pagina(
        "Esta placa ainda não foi ativada",
        "Peça ao lojista para concluir a configuração desta placa no painel.",
        200
      );
    case "DESATIVADA":
    case "SUBSTITUIDA":
    case "PERDIDA":
      return pagina(
        "Placa indisponível",
        "Esta placa não está mais em uso.",
        200
      );
    default:
      return pagina("Falha temporária", "Estado da placa desconhecido. Tente novamente.", 503);
  }
}
