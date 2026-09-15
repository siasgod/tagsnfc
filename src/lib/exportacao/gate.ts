import { obterConfiguracao } from "@/lib/db/repo/configuracoes";
import { pareceOrigemNaoProdutiva } from "@/lib/origem-publica";

/**
 * Portão de liberação para exportação "pronta para produção" (seção 3 e 11
 * da especificação): só libera se a origem do lote bater com a origem
 * atualmente configurada E essa origem tiver sido explicitamente validada
 * por um administrador (ver Configurações → "Validar origem pública").
 * Exportação de demonstração nunca passa por aqui — é sempre permitida,
 * porém visivelmente marcada como teste no próprio arquivo.
 */
export async function verificarLiberacaoProducao(
  origemDoLote: string
): Promise<{ liberado: boolean; motivo?: string }> {
  const heuristica = pareceOrigemNaoProdutiva(origemDoLote);
  if (heuristica.suspeita) {
    return { liberado: false, motivo: `Origem não parece definitiva: ${heuristica.motivo}` };
  }

  const config = await obterConfiguracao();
  if (!config.origem_validada_em || config.origem_publica_atual !== origemDoLote) {
    return {
      liberado: false,
      motivo:
        "A origem pública deste lote ainda não foi confirmada como definitiva por um administrador em Configurações.",
    };
  }

  return { liberado: true };
}
