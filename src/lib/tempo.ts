/**
 * Helpers de data/hora. Tudo é armazenado no banco em UTC (timestamptz);
 * a apresentação ao usuário sempre converte para America/Sao_Paulo.
 */

const FUSO = "America/Sao_Paulo";

export function formatarDataHora(data: Date | string | null | undefined): string {
  if (!data) return "—";
  const d = typeof data === "string" ? new Date(data) : data;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export function formatarData(data: Date | string | null | undefined): string {
  if (!data) return "—";
  const d = typeof data === "string" ? new Date(data) : data;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    dateStyle: "short",
  }).format(d);
}

/** Retorna início e fim (UTC) do dia informado, interpretado em America/Sao_Paulo. */
export function limitesDoDiaEmSaoPaulo(data: Date): { inicio: Date; fim: Date } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const partes = fmt.formatToParts(data);
  const get = (t: string) => partes.find((p) => p.type === t)!.value;
  const isoDia = `${get("year")}-${get("month")}-${get("day")}`;
  // America/Sao_Paulo não observa horário de verão desde 2019 (UTC-03:00 fixo).
  const inicio = new Date(`${isoDia}T00:00:00-03:00`);
  const fim = new Date(`${isoDia}T23:59:59.999-03:00`);
  return { inicio, fim };
}

export const FUSO_HORARIO = FUSO;
