import type PDFDocument from "pdfkit";

type Doc = InstanceType<typeof PDFDocument>;

/** Desenha uma estrela de 5 pontas preenchida, centrada em (cx, cy). */
export function desenharEstrela(doc: Doc, cx: number, cy: number, raioExterno: number, cor: string) {
  const raioInterno = raioExterno * 0.42;
  const pontos: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const raio = i % 2 === 0 ? raioExterno : raioInterno;
    const angulo = (Math.PI / 5) * i - Math.PI / 2;
    pontos.push([cx + raio * Math.cos(angulo), cy + raio * Math.sin(angulo)]);
  }
  doc.polygon(...pontos).fill(cor);
}

export function desenharCincoEstrelas(doc: Doc, centroX: number, centroY: number, raio: number, espacamento: number, cor = "#FBBC04") {
  const total = 5;
  const larguraTotal = (total - 1) * espacamento;
  const inicioX = centroX - larguraTotal / 2;
  for (let i = 0; i < total; i++) {
    desenharEstrela(doc, inicioX + i * espacamento, centroY, raio, cor);
  }
}

/**
 * Ícone simples e reconhecível de "aproximar para NFC": um retângulo
 * arredondado representando o celular e ondas concêntricas indicando o
 * sinal, desenhado inteiramente em vetor (sem imagens externas).
 */
export function desenharIconeNfc(doc: Doc, cx: number, cy: number, escala: number, cor: string) {
  const largTelefone = 9 * escala;
  const altTelefone = 16 * escala;
  doc
    .roundedRect(cx - largTelefone / 2, cy - altTelefone / 2, largTelefone, altTelefone, 1.6 * escala)
    .lineWidth(0.9 * escala)
    .stroke(cor);
  // "botão" home simbólico
  doc.circle(cx, cy + altTelefone / 2 - 2.4 * escala, 0.9 * escala).fill(cor);

  // ondas concêntricas à direita, sugerindo aproximação/leitura.
  // pdfkit não tem um método `.arc(ângulo)` nativo — desenhamos o arco via
  // comando SVG "A" (elliptical arc) usando `.path()`, que o pdfkit suporta
  // diretamente.
  const baseX = cx + largTelefone / 2 - 1 * escala;
  const baseY = cy - altTelefone * 0.15;
  for (let i = 1; i <= 3; i++) {
    const raio = i * 3.2 * escala;
    const anguloInicial = -0.55;
    const anguloFinal = 0.55;
    const x1 = baseX + raio * Math.cos(anguloInicial);
    const y1 = baseY + raio * Math.sin(anguloInicial);
    const x2 = baseX + raio * Math.cos(anguloFinal);
    const y2 = baseY + raio * Math.sin(anguloFinal);
    doc
      .path(`M ${x1} ${y1} A ${raio} ${raio} 0 0 1 ${x2} ${y2}`)
      .lineWidth(0.9 * escala)
      .strokeOpacity(1 - i * 0.18)
      .stroke(cor);
  }
  doc.strokeOpacity(1);
}

/** Marca de corte simples: dois traços curtos em cruz, fora da área de sangria. */
export function desenharMarcaDeCorte(doc: Doc, x: number, y: number, comprimento: number) {
  doc.save();
  doc.lineWidth(0.35).strokeColor("#000000");
  doc.moveTo(x - comprimento, y).lineTo(x - comprimento * 0.25, y).stroke();
  doc.moveTo(x + comprimento * 0.25, y).lineTo(x + comprimento, y).stroke();
  doc.moveTo(x, y - comprimento).lineTo(x, y - comprimento * 0.25).stroke();
  doc.moveTo(x, y + comprimento * 0.25).lineTo(x, y + comprimento).stroke();
  doc.restore();
}
