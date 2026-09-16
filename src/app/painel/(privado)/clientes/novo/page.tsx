import { ClienteForm } from "./ClienteForm";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { podeVerTudo, temPermissao } from "@/lib/auth/autorizacao";
import { listarCategorias } from "@/lib/db/repo/categorias";
import { listarResponsaveisComerciais } from "@/lib/db/repo/usuarios";
import { CabecalhoPagina, Secao } from "@/components/painel/PainelUI";
import { redirect } from "next/navigation";

export default async function PaginaNovoCliente() {
  const usuario = (await obterUsuarioAtual())!;
  if (!temPermissao(usuario, "CLIENTES_EDITAR")) redirect("/painel/clientes");
  const [categorias, responsaveis] = await Promise.all([listarCategorias(), podeVerTudo(usuario) ? listarResponsaveisComerciais() : Promise.resolve([])]);
  return (
    <div className="mx-auto max-w-2xl">
      <CabecalhoPagina titulo="Novo cliente" descricao="Cadastre os dados comerciais e organize a carteira desde o início." />
      <Secao className="p-5"><ClienteForm categorias={categorias} responsaveis={responsaveis} mostrarResponsavel={podeVerTudo(usuario)} /></Secao>
    </div>
  );
}
