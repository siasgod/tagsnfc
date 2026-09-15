"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function LinkNavegacao({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const ativo = href === "/painel" ? pathname === href : pathname.startsWith(`${href}/`) || pathname === href;
  return <Link href={href} aria-current={ativo ? "page" : undefined} className={`flex min-h-12 items-center justify-center rounded-lg px-2 text-center text-xs sm:text-sm ${ativo ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}>{children}</Link>;
}
