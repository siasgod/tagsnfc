import type { CanalAcesso } from "@/lib/db/repo/eventos";

/** QR é o canal padrão; somente o marcador explícito `via=nfc` muda o canal. */
export function canalDoParametro(via: string | null): CanalAcesso {
  return via?.toLowerCase() === "nfc" ? "NFC" : "QR";
}
