import { obterConfiguracao } from "@/lib/db/repo/configuracoes";
import { AtivarPlacaClient } from "./AtivarPlacaClient";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { temPermissao } from "@/lib/auth/autorizacao";
import { redirect } from "next/navigation";
import { CabecalhoPagina, Secao } from "@/components/painel/PainelUI";

export default async function PaginaAtivar() {
  const usuario = await obterUsuarioAtual();
  if (!usuario || !temPermissao(usuario, "ATIVAR_PLACA")) redirect("/painel");
  const config = await obterConfiguracao();

  return (
    <div className="mx-auto max-w-4xl">
      <CabecalhoPagina titulo="Ativar placa" descricao="Siga o fluxo guiado para vincular cliente, estabelecimento, destino, NFC e venda." />
      <Secao className="p-5 sm:p-8"><AtivarPlacaClient
        precoPadraoCentavos={config.preco_padrao_centavos ?? 0}
        custoPadraoCentavos={config.custo_padrao_centavos ?? 0}
      /></Secao>
    </div>
  );
}
