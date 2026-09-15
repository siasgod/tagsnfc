import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Validação do link de avaliação do Google que será configurado em uma
 * placa. Requisitos da especificação (seção 4):
 *  - aceitar somente HTTPS;
 *  - aceitar formatos legítimos e documentados de link de avaliação Google;
 *  - bloquear javascript:, data: e redirecionamento arbitrário para outros
 *    sites;
 *  - ao expandir links curtos, proteger contra SSRF, redirecionamentos
 *    abusivos e acesso a endereços internos;
 *  - se não for possível confirmar que é um link de avaliação, informar isso
 *    e exigir conferência manual antes da ativação — nunca inventar uma
 *    confirmação.
 *
 * Formatos de link de avaliação Google conhecidos e documentados
 * publicamente pela Google (Business Profile / Maps) no momento desta
 * implementação:
 *  - https://search.google.com/local/writereview?placeid=...
 *  - https://g.page/r/<id>/review
 *  - https://g.page/<nome>/review
 *  - https://maps.app.goo.gl/<codigo>  (link curto, precisa expansão)
 *  - https://goo.gl/maps/<codigo>      (link curto legado)
 *  - https://www.google.com/maps/place/... (link de local; válido para o
 *    perfil, mas não é comprovadamente um link de "escrever avaliação" —
 *    exige conferência manual)
 */

const HOSTS_CONFIRMADOS_AVALIACAO = new Set([
  "search.google.com",
  "g.page",
]);

const HOSTS_LINK_CURTO_GOOGLE = new Set(["maps.app.goo.gl", "goo.gl"]);

const HOSTS_GOOGLE_SEM_CONFIRMACAO = new Set([
  "www.google.com",
  "google.com",
  "maps.google.com",
]);

export type ResultadoValidacaoDestino =
  | { status: "valido_confirmado"; urlFinal: string }
  | { status: "valido_requer_conferencia"; urlFinal: string; motivo: string }
  | { status: "invalido"; motivo: string };

function ehEnderecoPrivadoOuLoopback(host: string): boolean {
  if (isIP(host)) {
    return (
      host === "127.0.0.1" ||
      host === "::1" ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host.startsWith("169.254.") ||
      host === "0.0.0.0"
    );
  }
  return host === "localhost" || host.endsWith(".local") || host.endsWith(".internal");
}

async function hostResolveParaEnderecoInterno(host: string): Promise<boolean> {
  if (ehEnderecoPrivadoOuLoopback(host)) return true;
  try {
    const { address } = await lookup(host);
    return ehEnderecoPrivadoOuLoopback(address);
  } catch {
    // Falha de DNS: trate como não confiável.
    return true;
  }
}

/**
 * Expande um link curto seguindo redirects manualmente, hop a hop, validando
 * cada Location contra um allowlist e contra endereços internos antes de
 * seguir. Limite de 5 saltos e timeout curto.
 */
async function expandirLinkCurto(
  urlInicial: string
): Promise<{ ok: true; urlFinal: string } | { ok: false; motivo: string }> {
  let atual = urlInicial;
  for (let salto = 0; salto < 5; salto++) {
    const url = new URL(atual);
    if (url.protocol !== "https:") {
      return { ok: false, motivo: "Redirecionamento para protocolo não-HTTPS." };
    }
    if (await hostResolveParaEnderecoInterno(url.hostname)) {
      return { ok: false, motivo: "Redirecionamento aponta para endereço interno/privado." };
    }

    let resposta: Response;
    try {
      resposta = await fetch(url, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      return { ok: false, motivo: "Falha de rede ao tentar expandir o link curto." };
    }

    if (resposta.status >= 300 && resposta.status < 400) {
      const local = resposta.headers.get("location");
      if (!local) return { ok: false, motivo: "Redirecionamento sem destino." };
      atual = new URL(local, url).toString();
      continue;
    }

    // Não é mais um redirect: este é o destino final.
    return { ok: true, urlFinal: atual };
  }
  return { ok: false, motivo: "Excesso de redirecionamentos ao expandir o link." };
}

export async function validarDestino(
  entrada: string
): Promise<ResultadoValidacaoDestino> {
  let url: URL;
  try {
    url = new URL(entrada.trim());
  } catch {
    return { status: "invalido", motivo: "URL inválida." };
  }

  if (url.protocol === "javascript:" || url.protocol === "data:") {
    return { status: "invalido", motivo: "Esquema de URL não permitido." };
  }
  if (url.protocol !== "https:") {
    return { status: "invalido", motivo: "Apenas links HTTPS são aceitos." };
  }

  if (await hostResolveParaEnderecoInterno(url.hostname)) {
    return { status: "invalido", motivo: "Destino resolve para um endereço interno/privado." };
  }

  if (HOSTS_CONFIRMADOS_AVALIACAO.has(url.hostname)) {
    return { status: "valido_confirmado", urlFinal: url.toString() };
  }

  if (HOSTS_LINK_CURTO_GOOGLE.has(url.hostname)) {
    const expandido = await expandirLinkCurto(url.toString());
    if (!expandido.ok) {
      return {
        status: "valido_requer_conferencia",
        urlFinal: url.toString(),
        motivo: `Não foi possível confirmar automaticamente o destino final do link curto (${expandido.motivo}). Confira manualmente antes de ativar.`,
      };
    }
    const hostFinal = new URL(expandido.urlFinal).hostname;
    if (HOSTS_CONFIRMADOS_AVALIACAO.has(hostFinal)) {
      return { status: "valido_confirmado", urlFinal: expandido.urlFinal };
    }
    return {
      status: "valido_requer_conferencia",
      urlFinal: expandido.urlFinal,
      motivo: `O link curto aponta para "${hostFinal}", que não é um formato de avaliação confirmado. Confira manualmente.`,
    };
  }

  if (HOSTS_GOOGLE_SEM_CONFIRMACAO.has(url.hostname)) {
    return {
      status: "valido_requer_conferencia",
      urlFinal: url.toString(),
      motivo:
        "É um domínio do Google, mas não um formato de link de avaliação confirmado (ex.: link de perfil/local). Confira manualmente antes de ativar.",
    };
  }

  return {
    status: "invalido",
    motivo:
      "Domínio não reconhecido como link de avaliação do Google. Use o link fornecido pelo Google (Business Profile → Compartilhar) ou confira manualmente.",
  };
}
