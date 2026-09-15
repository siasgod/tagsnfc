/**
 * Rate limiting simples em memória, por chave (ex.: IP + rota).
 *
 * Limitação conhecida e documentada: como o estado vive na memória do
 * processo, isso protege uma única instância. Em um deploy serverless com
 * múltiplas instâncias (ex.: Vercel Functions escalando horizontalmente), o
 * limite efetivo é multiplicado pelo número de instâncias ativas. Para um
 * limite rígido e global entre instâncias, é necessário um armazenamento
 * compartilhado (ex.: Upstash Redis) — não incluído nesta entrega por não
 * termos credenciais de um serviço externo configuradas. Ver README.
 */

type Balde = { contagem: number; iniciadoEm: number };

const baldes = new Map<string, Balde>();

export function limitarTaxa(
  chave: string,
  limite: number,
  janelaMs: number
): { permitido: boolean; restante: number } {
  const agora = Date.now();
  const atual = baldes.get(chave);

  if (!atual || agora - atual.iniciadoEm > janelaMs) {
    baldes.set(chave, { contagem: 1, iniciadoEm: agora });
    return { permitido: true, restante: limite - 1 };
  }

  if (atual.contagem >= limite) {
    return { permitido: false, restante: 0 };
  }

  atual.contagem += 1;
  return { permitido: true, restante: limite - atual.contagem };
}

// Limpeza periódica para não crescer indefinidamente em processos long-lived.
setInterval(() => {
  const agora = Date.now();
  for (const [chave, balde] of baldes) {
    if (agora - balde.iniciadoEm > 10 * 60 * 1000) baldes.delete(chave);
  }
}, 5 * 60 * 1000).unref?.();

export function ipDaRequisicao(headers: Headers): string {
  const encaminhado = headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "desconhecido";
}
