import type { NextRequest } from "next/server";
import { exigirPermissao, podeVerTudo } from "@/lib/auth/autorizacao";
import { listarClientes } from "@/lib/db/repo/clientes";
import { listarEstabelecimentosPorCliente } from "@/lib/db/repo/estabelecimentos";
import { comTratamentoDeErros } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  return comTratamentoDeErros(async () => {
    const usuario = await exigirPermissao("CLIENTES_VER");
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const clientes = await listarClientes({
      vendedorId: podeVerTudo(usuario) ? undefined : usuario.id,
      busca: q || undefined,
    });

    const comEstabelecimentos = await Promise.all(
      clientes.slice(0, 15).map(async (c) => ({
        id: c.id,
        nome: c.nome,
        telefone: c.telefone,
        estabelecimentos: await listarEstabelecimentosPorCliente(c.id),
      }))
    );

    return Response.json(comEstabelecimentos);
  });
}
