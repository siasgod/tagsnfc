"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/**
 * Leitor de QR via câmera usando `getUserMedia` + `jsQR`, em vez da API
 * nativa `BarcodeDetector` — que não está disponível no Safari/iPhone no
 * momento desta implementação. Isso satisfaz o requisito de "scanner
 * compatível com Safari no iPhone, com biblioteca alternativa quando APIs
 * nativas não estiverem disponíveis". Sempre existe também a entrada manual
 * abaixo, para quando a câmera for negada ou indisponível.
 */
function extrairTokenDeTexto(texto: string): string {
  try {
    const url = new URL(texto);
    const partes = url.pathname.split("/").filter(Boolean);
    const idx = partes.indexOf("p");
    if (idx >= 0 && partes[idx + 1]) return partes[idx + 1];
  } catch {
    // não é uma URL — pode já ser o token ou código puro.
  }
  return texto.trim();
}

export function LeitorQr({ onDetectado }: { onDetectado: (identificador: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"iniciando" | "ativo" | "negado" | "indisponivel">("iniciando");
  const [manual, setManual] = useState("");

  useEffect(() => {
    let streamAtual: MediaStream | null = null;
    let animId = 0;
    let cancelado = false;

    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("indisponivel");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamAtual = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("ativo");
        loop();
      } catch {
        setStatus("negado");
      }
    }

    function loop() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animId = requestAnimationFrame(loop);
        return;
      }
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imagem = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const resultado = jsQR(imagem.data, imagem.width, imagem.height);
      if (resultado?.data) {
        onDetectado(extrairTokenDeTexto(resultado.data));
        return; // para o loop após detectar
      }
      animId = requestAnimationFrame(loop);
    }

    iniciar();
    return () => {
      cancelado = true;
      cancelAnimationFrame(animId);
      streamAtual?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      {status !== "negado" && status !== "indisponivel" && (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
          {status === "iniciando" && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-white">
              Ligando a câmera…
            </p>
          )}
        </div>
      )}
      {status === "negado" && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Acesso à câmera negado ou indisponível. Use a entrada manual abaixo.
        </p>
      )}
      {status === "indisponivel" && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Este navegador não oferece acesso à câmera. Use a entrada manual abaixo.
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) onDetectado(extrairTokenDeTexto(manual.trim()));
        }}
        className="flex gap-2"
      >
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Digite o código (PL-000001) ou cole o link"
          className="botao-toque flex-1 rounded-lg border border-slate-300 px-3 text-base"
        />
        <button type="submit" className="botao-toque rounded-lg bg-slate-800 px-4 font-medium text-white">
          Buscar
        </button>
      </form>
    </div>
  );
}
