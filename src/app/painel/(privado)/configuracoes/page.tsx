import { redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { obterConfiguracao } from "@/lib/db/repo/configuracoes";
import { listarCategorias } from "@/lib/db/repo/categorias";
import { origemAtualConfigurada } from "@/lib/origem-publica";
import { atualizarCategoriaAction, excluirCategoriaAction } from "@/lib/actions/categorias";
import { ConfigGeralForm, NovaCategoriaForm, ValidarOrigemForm } from "./ConfigForms";
import { Badge, CabecalhoPagina, Secao } from "@/components/painel/PainelUI";
import Link from "next/link";

export default async function PaginaConfiguracoes() {
  const usuario = await obterUsuarioAtual();
  if (usuario?.papel !== "ADMIN") redirect("/painel");

  const [config, categorias] = await Promise.all([obterConfiguracao(), listarCategorias(true)]);
  const origemAtual = origemAtualConfigurada();

  return (
    <div className="space-y-6">
      <CabecalhoPagina titulo="Configurações" descricao="Parâmetros gerais, origem pública e categorias da carteira." acao={<Link href="/painel/equipe" className="button button-secondary">Gerenciar equipe</Link>} />

      <Secao titulo="Operação" descricao="Valores padrão utilizados no fluxo comercial" className="p-5 pt-0">
        <ConfigGeralForm
          nomeOperacao={config.nome_operacao}
          precoPadrao={config.preco_padrao_centavos ?? 0}
          custoPadrao={config.custo_padrao_centavos ?? 0}
        />
      </Secao>

      <Secao titulo="Origem pública" descricao="Endereço definitivo usado em QR e NFC" className="p-5 pt-0">
        <ValidarOrigemForm origemAtual={origemAtual} jaValidada={!!config.origem_validada_em && config.origem_publica_atual === origemAtual} />
      </Secao>

      <Secao titulo="Categorias de cliente" descricao="Crie, renomeie, colore ou desative categorias usadas na carteira">
        <div className="p-5"><NovaCategoriaForm /></div>
        {categorias.length ? <div className="table-wrap border-t border-slate-100"><table><thead><tr><th>Categoria</th><th>Clientes</th><th>Configuração</th><th>Ações</th></tr></thead><tbody>{categorias.map((categoria) => <tr key={categoria.id}><td data-label="Categoria"><Badge tom={categoria.cor}>{categoria.nome}</Badge></td><td data-label="Clientes">{categoria.total_clientes}</td><td data-label="Configuração"><form id={`categoria-${categoria.id}`} action={atualizarCategoriaAction.bind(null, categoria.id)} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]"><input name="nome" defaultValue={categoria.nome} required /><select name="cor" defaultValue={categoria.cor}><option value="AZUL">Azul</option><option value="VERDE">Verde</option><option value="VIOLETA">Violeta</option><option value="AMBAR">Âmbar</option><option value="ROSA">Rosa</option><option value="CINZA">Cinza</option></select><label className="flex items-center gap-2"><input name="ativo" type="checkbox" defaultChecked={categoria.ativo} /> Ativa</label></form></td><td data-label="Ações"><div className="flex gap-2"><button form={`categoria-${categoria.id}`} className="button button-secondary button-small">Salvar</button>{Number(categoria.total_clientes) === 0 ? <form action={excluirCategoriaAction.bind(null, categoria.id)}><button className="button button-danger button-small">Excluir</button></form> : null}</div></td></tr>)}</tbody></table></div> : null}
      </Secao>
    </div>
  );
}
