// 1mm = 72/25.4 pt. pdfkit trabalha em pontos (pt).
export const PT_POR_MM = 72 / 25.4;

export function mm(valor: number): number {
  return valor * PT_POR_MM;
}
