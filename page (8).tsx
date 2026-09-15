import { contarUsuarios } from "@/lib/db/repo/usuarios";
import { SetupForm } from "./SetupForm";

// Força renderização dinâmica: esta página consulta o banco a cada acesso.
// Sem isso, o Next tenta pré-renderizar estaticamente no build — e além de
// depender de conseguir conectar ao banco no momento exato da compilação,
// arriscaria "congelar" para sempre a contagem de usuários vista no momento
// do build.
export const dynamic = "force-dynamic";

export default async function PaginaSetup() {
  const total = await contarUsuarios();

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-xl font-semibold text-slate-900">Configuração inicial</h1>
        <p className="mb-6 text-center text-sm text-slate-500">Criação do primeiro administrador do sistema.</p>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {total > 0 ? (
            <p className="text-sm text-slate-600">
              Já existe um administrador configurado. Esta página só funciona uma vez. Peça um convite ao
              administrador atual ou acesse <a className="text-blue-600 underline" href="/painel/login">a tela de login</a>.
            </p>
          ) : (
            <SetupForm />
          )}
        </div>
      </div>
    </div>
  );
}
