/**
 * Regras sobre a "origem pública" (domínio) usada para montar as URLs das
 * placas. A especificação exige impedir que um lote seja exportado como
 * "pronto para produção" enquanto a origem for localhost, um domínio
 * fictício, ou um domínio de preview temporário — e exige confirmação
 * explícita da origem definitiva antes da impressão real.
 *
 * Duas camadas de proteção:
 *  1. Heurística automática: rejeita padrões obviamente não-produtivos
 *     (localhost, IP local, *.local/.test/.internal, previews do Vercel com
 *     hash/branch no nome, túneis ngrok/localtunnel).
 *  2. Confirmação manual: mesmo passando na heurística, a origem só é
 *     considerada "validada para produção" depois que um administrador
 *     confirma explicitamente em Configurações (grava
 *     `configuracoes.origem_validada_em`). Isso satisfaz a exigência de
 *     "validar a origem pública definitiva" antes do primeiro lote real.
 */

export function pareceOrigemNaoProdutiva(origem: string): { suspeita: boolean; motivo?: string } {
  let host: string;
  try {
    host = new URL(origem).hostname.toLowerCase();
  } catch {
    return { suspeita: true, motivo: "URL de origem inválida." };
  }

  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return { suspeita: true, motivo: "Origem é localhost." };
  }
  if (host.endsWith(".local") || host.endsWith(".test") || host.endsWith(".internal") || host.endsWith(".example")) {
    return { suspeita: true, motivo: "Domínio reservado/fictício (.local/.test/.internal/.example)." };
  }
  if (host.includes("ngrok") || host.includes("localtunnel") || host.includes("trycloudflare")) {
    return { suspeita: true, motivo: "Domínio de túnel temporário." };
  }
  if (host.endsWith(".vercel.app") && (host.includes("-git-") || /-[a-z0-9]{6,}-/.test(host))) {
    return {
      suspeita: true,
      motivo: "Parece uma URL de preview do Vercel (contém hash/branch), não o domínio de produção do projeto.",
    };
  }
  return { suspeita: false };
}

export function origemAtualConfigurada(): string {
  return process.env.NEXT_PUBLIC_ORIGEM_PUBLICA ?? "";
}
