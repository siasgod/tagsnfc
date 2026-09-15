import type { NextRequest } from "next/server";
import { exigirUsuario } from "@/lib/auth/autorizacao";
import { validarDestino } from "@/lib/validacao/destino";
import { comTratamentoDeErros } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  return comTratamentoDeErros(async () => {
    await exigirUsuario();
    const url = request.nextUrl.searchParams.get("url");
    if (!url) return Response.json({ erro: "Informe uma URL." }, { status: 400 });

    const resultado = await validarDestino(url);
    return Response.json(resultado);
  });
}
