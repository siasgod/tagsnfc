import type { NextRequest } from "next/server";
import { exigirAcessoPlaca, exigirPermissao } from "@/lib/auth/autorizacao";
import { buscarPlacaPorCodigoOuToken } from "@/lib/db/repo/placas";
import { comTratamentoDeErros } from "@/lib/api-utils";

/**
 * Ao ler a URL da placa (QR), o cliente extrai apenas o token e valida sua
 * origem antes de chamar esta rota — nunca envia a URL inteira para cá,
 * evitando qualquer ambiguidade sobre "origem" da leitura.
 */
export async function GET(request: NextRequest) {
  return comTratamentoDeErros(async () => {
    const usuario = await exigirPermissao("PLACAS_VER");
    const identificador = request.nextUrl.searchParams.get("identificador")?.trim();
    if (!identificador) return Response.json({ erro: "Informe um código ou token." }, { status: 400 });

    const placa = await buscarPlacaPorCodigoOuToken(identificador);
    if (!placa) return Response.json({ erro: "Placa não encontrada." }, { status: 404 });
    await exigirAcessoPlaca(usuario, placa.id);

    return Response.json({
      id: placa.id,
      codigo: placa.codigo,
      estadoComercial: placa.estado_comercial,
      estadoProducao: placa.estado_producao,
      estabelecimentoId: placa.estabelecimento_id,
      destinoUrl: placa.destino_url,
      urlQr: placa.url_qr,
      urlNfc: placa.url_nfc,
    });
  });
}
