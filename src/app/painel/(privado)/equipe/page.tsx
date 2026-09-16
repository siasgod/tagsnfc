import { redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { temPermissao } from "@/lib/auth/autorizacao";
import { listarUsuarios } from "@/lib/db/repo/usuarios";
import { definirMembroAtivoAction } from "@/lib/actions/equipe";
import { formatarDataHora } from "@/lib/tempo";
import { Badge, CabecalhoPagina, EstadoVazio, Secao } from "@/components/painel/PainelUI";
import { NovoMembroForm } from "./NovoMembroForm";

export default async function PaginaEquipe() {
  const usuario = (await obterUsuarioAtual())!;
  if (!temPermissao(usuario, "EQUIPE_VER")) redirect("/painel");
  const usuarios = await listarUsuarios();
  const podeEditar = temPermissao(usuario, "EQUIPE_EDITAR");
  return (
    <div className="space-y-5">
      <CabecalhoPagina titulo="Equipe" descricao="Contas, funções, status de acesso e último login registrado." />
      {podeEditar ? <Secao titulo="Adicionar pessoa" descricao="Administradores podem criar qualquer função, inclusive outro administrador"><div className="p-5"><NovoMembroForm /></div></Secao> : null}
      <Secao titulo={`${usuarios.length} pessoa${usuarios.length === 1 ? "" : "s"}`}>
        {usuarios.length ? <div className="table-wrap"><table><thead><tr><th>Nome</th><th>Função</th><th>Status</th><th>Último acesso</th>{podeEditar ? <th>Ação</th> : null}</tr></thead><tbody>{usuarios.map((item) => <tr key={item.id}><td data-label="Nome"><strong>{item.nome}</strong><div className="mt-1 text-[11px] text-slate-400">{item.email}</div></td><td data-label="Função"><Badge tom={item.papel}>{item.papel}</Badge></td><td data-label="Status"><Badge tom={item.ativo ? "VERDE" : "CINZA"}>{item.ativo ? "Ativo" : "Inativo"}</Badge></td><td data-label="Último acesso">{item.ultimo_acesso ? formatarDataHora(item.ultimo_acesso) : "Nunca acessou"}</td>{podeEditar ? <td data-label="Ação"><form action={definirMembroAtivoAction.bind(null, item.id, !item.ativo)}><button className={`button button-small ${item.ativo ? "button-danger" : "button-secondary"}`} disabled={item.id === usuario.id && item.ativo}>{item.ativo ? "Desativar" : "Reativar"}</button></form></td> : null}</tr>)}</tbody></table></div> : <EstadoVazio titulo="Equipe vazia" descricao="Adicione a primeira pessoa para compartilhar a operação." />}
      </Secao>
    </div>
  );
}
