import { redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { origemAtualConfigurada } from "@/lib/origem-publica";
import { LoteForm } from "./LoteForm";
import { temPermissao } from "@/lib/auth/autorizacao";
import { CabecalhoPagina, Secao } from "@/components/painel/PainelUI";

export default async function PaginaNovoLote() {
  const usuario = await obterUsuarioAtual();
  if (!usuario || !temPermissao(usuario, "LOTES_CRIAR")) redirect("/painel/lotes");

  return (
    <div className="mx-auto max-w-md">
      <CabecalhoPagina titulo="Novo lote" descricao="Gere placas individualizadas com QR e NFC prontos para produção." />
      <Secao className="p-5"><LoteForm origemAtual={origemAtualConfigurada()} /></Secao>
    </div>
  );
}
