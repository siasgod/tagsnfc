/**
 * Todo valor monetário é armazenado e manipulado em centavos (inteiro) para
 * evitar erros de ponto flutuante, conforme exigido pela especificação.
 */

export function paraCentavos(reais: number): number {
  return Math.round(reais * 100);
}

export function formatarBRL(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

export function somarCentavos(...valores: number[]): number {
  return valores.reduce((acc, v) => acc + v, 0);
}
