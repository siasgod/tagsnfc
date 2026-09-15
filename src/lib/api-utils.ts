import { ErroAutorizacao } from "@/lib/auth/autorizacao";

/**
 * Envolve o corpo de uma Route Handler para que erros de autenticação/
 * autorização (`ErroAutorizacao`, lançado por `exigirUsuario`/`exigirAdmin`)
 * virem respostas HTTP corretas (401/403) em vez de um 500 genérico — sem
 * isso, uma chamada não autenticada a uma rota sensível derrubava como erro
 * interno em vez de ser corretamente recusada.
 */
export async function comTratamentoDeErros(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (err) {
    if (err instanceof ErroAutorizacao) {
      return Response.json({ erro: err.message }, { status: err.status });
    }
    console.error("[api] erro não tratado:", err);
    return Response.json({ erro: "Falha inesperada no servidor." }, { status: 500 });
  }
}
