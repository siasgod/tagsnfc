"use client";

import { useFormStatus } from "react-dom";

export function BotaoEnviar({
  children,
  variante = "primario",
  className = "",
}: {
  children: React.ReactNode;
  variante?: "primario" | "secundario" | "perigo";
  className?: string;
}) {
  const { pending } = useFormStatus();

  const cores =
    variante === "primario"
      ? "bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-300"
      : variante === "perigo"
      ? "bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300"
      : "bg-slate-200 hover:bg-slate-300 text-slate-900 disabled:opacity-60";

  return (
    <button
      type="submit"
      disabled={pending}
      className={`botao-toque inline-flex items-center justify-center rounded-lg px-4 py-2.5 font-medium transition-colors disabled:cursor-not-allowed ${cores} ${className}`}
    >
      {pending ? "Enviando..." : children}
    </button>
  );
}
