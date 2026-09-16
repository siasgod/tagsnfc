import { redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { NavPainel } from "@/components/painel/NavPainel";

/**
 * Autorização real (não apenas o Proxy otimista): toda página dentro deste
 * grupo passa por aqui, que consulta o banco para validar a sessão. Se o
 * Proxy for removido ou tiver seu matcher alterado por engano, o acesso
 * continua bloqueado no servidor.
 */
export default async function LayoutPrivado({ children }: { children: React.ReactNode }) {
  const usuario = await obterUsuarioAtual();
  if (!usuario) {
    redirect("/painel/login");
  }

  return (
    <div className="painel min-h-dvh flex-1">
      <NavPainel usuario={usuario} />
      <main className="page-shell lg:pl-[18.5rem]">{children}</main>
    </div>
  );
}
