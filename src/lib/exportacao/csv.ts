import { stringify } from "csv-stringify/sync";

export interface PlacaParaCsv {
  codigo: string;
  token: string;
  url_qr: string;
  url_nfc: string;
  estado_producao: string;
  estado_comercial: string;
  estabelecimento_nome?: string | null;
  cliente_nome?: string | null;
  vendedor_nome?: string | null;
}

export function gerarCsvLote(placas: PlacaParaCsv[]): string {
  return stringify(placas, {
    header: true,
    columns: [
      { key: "codigo", header: "codigo" },
      { key: "token", header: "token" },
      { key: "url_qr", header: "url_qr" },
      { key: "url_nfc", header: "url_nfc" },
      { key: "estado_producao", header: "estado_producao" },
      { key: "estado_comercial", header: "estado_comercial" },
      { key: "estabelecimento_nome", header: "estabelecimento" },
      { key: "cliente_nome", header: "cliente" },
      { key: "vendedor_nome", header: "vendedor" },
    ],
  });
}
