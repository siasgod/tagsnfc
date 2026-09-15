import { obterConfiguracao } from "@/lib/db/repo/configuracoes";
import { AtivarPlacaClient } from "./AtivarPlacaClient";

export default async function PaginaAtivar() {
  const config = await obterConfiguracao();

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Ativar placa</h1>
      <AtivarPlacaClient
        precoPadraoCentavos={config.preco_padrao_centavos ?? 0}
        custoPadraoCentavos={config.custo_padrao_centavos ?? 0}
      />
    </div>
  );
}
