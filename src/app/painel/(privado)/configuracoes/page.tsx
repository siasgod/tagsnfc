import { redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { obterConfiguracao } from "@/lib/db/repo/configuracoes";
import { listarUsuarios } from "@/lib/db/repo/usuarios";
import { origemAtualConfigurada } from "@/lib/origem-publica";
import { ConfigGeralForm, ValidarOrigemForm, NovoVendedorForm } from "./ConfigForms";

export default async function PaginaConfiguracoes() {
  const usuario = await obterUsuarioAtual();
  if (usuario?.papel !== "ADMIN") redirect("/painel");

  const [config, usuarios] = await Promise.all([obterConfiguracao(), listarUsuarios()]);
  const origemAtual = origemAtualConfigurada();

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Configurações</h1>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-700">Operação</h2>
        <ConfigGeralForm
          nomeOperacao={config.nome_operacao}
          precoPadrao={config.preco_padrao_centavos ?? 0}
          custoPadrao={config.custo_padrao_centavos ?? 0}
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-700">Origem pública</h2>
        <ValidarOrigemForm origemAtual={origemAtual} jaValidada={!!config.origem_validada_em && config.origem_publica_atual === origemAtual} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-700">Usuários</h2>
        <ul className="mb-4 divide-y divide-slate-100 text-sm">
          {usuarios.map((u) => (
            <li key={u.id} className="flex justify-between py-2">
              <span>
                {u.nome} · {u.email}
              </span>
              <span className="text-slate-500">
                {u.papel} {!u.ativo && "(inativo)"}
              </span>
            </li>
          ))}
        </ul>
        <details>
          <summary className="cursor-pointer text-sm text-blue-600">+ Criar conta de vendedor</summary>
          <div className="mt-3">
            <NovoVendedorForm />
          </div>
        </details>
      </section>
    </div>
  );
}
