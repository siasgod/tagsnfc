"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function LinkNavegacao({ href, children, simbolo }: { href: string; children: React.ReactNode; simbolo?: string }) {
  const pathname = usePathname();
  const ativo = href === "/painel" ? pathname === href : pathname.startsWith(`${href}/`) || pathname === href;
  return (
    <Link href={href} aria-current={ativo ? "page" : undefined} className={`nav-link ${ativo ? "nav-link-active" : ""}`}>
      {simbolo ? <span className="nav-symbol" aria-hidden="true">{simbolo}</span> : null}
      <span>{children}</span>
    </Link>
  );
}
