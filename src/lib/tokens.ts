import { customAlphabet } from "nanoid";

// Alfabeto sem caracteres ambíguos (0/O, 1/I/l) para reduzir erro de digitação
// na entrada manual do código humano durante a ativação.
const ALFABETO_CODIGO = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const gerarSufixoCodigo = customAlphabet(ALFABETO_CODIGO, 6);

// Token público: alta entropia, não deve servir como senha nem ser adivinhável,
// mas também não é tratado como segredo de autorização — apenas identifica a
// placa publicamente (ver seção 3 da especificação).
const gerarTokenPublico = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  24
);

export function gerarCodigoHumano(sequencial: number): string {
  // Código previsível e legível para produção em lote: PL-000001, PL-000002...
  return `PL-${String(sequencial).padStart(6, "0")}`;
}

export function gerarCodigoLote(sequencial: number): string {
  return `LOTE-${String(sequencial).padStart(4, "0")}`;
}

export function gerarTokenAleatorio(): string {
  return gerarTokenPublico();
}

export function gerarSufixoAleatorio(): string {
  return gerarSufixoCodigo();
}
