declare module "svg-to-pdfkit" {
  import type PDFDocument from "pdfkit";

  interface OpcoesSvgToPdf {
    width?: number;
    height?: number;
    preserveAspectRatio?: string;
    useCSS?: boolean;
    fontCallback?: (family: string, bold: boolean, italic: boolean) => string;
    colorCallback?: (color: string) => [string, number] | undefined;
  }

  export default function SVGtoPDF(
    doc: InstanceType<typeof PDFDocument>,
    svg: string,
    x: number,
    y: number,
    options?: OpcoesSvgToPdf
  ): void;
}
