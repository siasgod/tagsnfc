import JSZip from "jszip";

export async function gerarZip(arquivos: Record<string, Buffer | string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    zip.file(nome, conteudo);
  }
  return zip.generateAsync({ type: "nodebuffer" });
}
