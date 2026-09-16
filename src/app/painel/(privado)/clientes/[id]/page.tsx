import Link from "next/link";
import { notFound } from "next/navigation";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { exigirAcessoCliente, podeVerTudo, temPermissao } from "@/lib/auth/autorizacao";
import { buscarClientePerfil } from "@/lib/db/repo/clientes";
import { listarEstabelecimentosPorCliente } from "@/lib/db/repo/estabelecimentos";
import { listarPlacasPorCliente } from "@/lib/db/repo/placas";
import { listarVendasPorCliente } from "@/lib/db/repo/vendas";
import { listarCategorias } from "@/lib/db/repo/categorias";
import { listarResponsaveisComerciais } from "@/lib/db/repo/usuarios";
import { formatarBRL } from "@/lib/dinheiro";
import { formatarData, formatarDataHora } from "@/lib/tempo";
import { Badge, CabecalhoPagina, CartaoMetrica, EstadoVazio, Secao } from "@/components/painel/PainelUI";
import { NovoEstabelecimentoForm } from "./NovoEstabelecimentoForm";
import { EditarClienteForm } from "./EditarClienteForm";

export default async function PaginaClienteDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = (await obterUsuarioAtual())!;
  await exigirAcessoCliente(usuario, id);
  const cliente = await buscarClientePerfil(id);
  if (!cliente) notFound();

  const [estabelecimentos, placas, vendas, categorias, responsaveis] = await Promise.all([
    listarEstabelecimentosPorCliente(id), listarPlacasPorCliente(id), listarVendasPorCliente(id), listarCategorias(),
    podeVerTudo(usuario) ? listarResponsaveisComerciais() : Promise.resolve([]),
  ]);
  const podeEditar = temPermissao(usuario, "CLIENTES_EDITAR");

  return (
    <div className="space-y-6">
      <CabecalhoPagina titulo={cliente.nome} descricao="Perfil do cliente, vínculos comerciais e desempenho das placas." acao={<Link href="/painel/clientes" className="button button-secondary">← Clientes</Link>} />

      <section className="stats-grid">
        <CartaoMetrica rotulo="Interações totais" valor={cliente.total_interacoes} detalhe="Todas as placas" tom="azul" />
        <CartaoMetrica rotulo="Via QR" valor={cliente.interacoes_qr} detalhe="Aberturas por câmera" tom="verde" />
        <CartaoMetrica rotulo="Via NFC" valor={cliente.interacoes_nfc} detalhe="Aproximações" tom="violeta" />
        <CartaoMetrica rotulo="Placas vinculadas" valor={placas.length} detalhe={`${estabelecimentos.length} estabelecimentos`} tom="ambar" />
      </section>

      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <Secao titulo="Dados do cliente">
          <dl className="grid gap-4 p-5 text-sm sm:grid-cols-2 lg:grid-cols-1">
            <div><dt className="text-xs text-slate-400">Categoria</dt><dd className="mt-1">{cliente.categoria_nome ? <Badge tom={cliente.categoria_cor}>{cliente.categoria_nome}</Badge> : "Sem categoria"}</dd></div>
            <div><dt className="text-xs text-slate-400">Responsável comercial</dt><dd className="mt-1 font-medium text-slate-700">{cliente.responsavel_comercial_nome ?? "Não definido"}</dd></div>
            <div><dt className="text-xs text-slate-400">Contato principal</dt><dd className="mt-1 text-slate-700">{cliente.responsavel ?? "—"}</dd></div>
            <div><dt className="text-xs text-slate-400">Telefone</dt><dd className="mt-1 text-slate-700">{cliente.telefone ?? "—"}</dd></div>
            <div><dt className="text-xs text-slate-400">E-mail</dt><dd className="mt-1 text-slate-700">{cliente.email ?? "—"}</dd></div>
            <div><dt className="text-xs text-slate-400">Desde</dt><dd className="mt-1 text-slate-700">{formatarData(cliente.criado_em)}</dd></div>
          </dl>
        </Secao>
        {podeEditar ? <Secao titulo="Editar perfil" descricao="Mantenha categoria, responsável e dados de contato atualizados"><div className="p-5"><EditarClienteForm cliente={cliente} categorias={categorias} responsaveis={responsaveis} podeReatribuir={podeVerTudo(usuario)} /></div></Secao> : null}
      </div>

      <Secao titulo="Estabelecimentos" descricao="Locais pertencentes a este cliente" acao={podeEditar ? <details><summary className="button button-secondary button-small">+ Adicionar</summary><div className="absolute right-8 z-20 mt-2 w-[min(90vw,28rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-xl"><NovoEstabelecimentoForm clienteId={id} /></div></details> : undefined}>
        {estabelecimentos.length ? <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{estabelecimentos.map((e) => <article key={e.id} className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold text-slate-800">{e.nome}</h3><p className="mt-1 text-xs text-slate-500">{e.endereco ?? "Endereço não informado"}</p>{e.link_avaliacao ? <a href={e.link_avaliacao} target="_blank" rel="noreferrer" className="mt-3 block truncate text-xs text-blue-600">Abrir destino ↗</a> : null}</article>)}</div> : <EstadoVazio titulo="Nenhum estabelecimento" descricao="Adicione o primeiro local deste cliente para vincular uma placa." />}
      </Secao>

      <Secao titulo="Placas e interações" descricao="Desempenho individual de cada unidade">
        {placas.length ? <div className="table-wrap"><table><thead><tr><th>Placa</th><th>Estabelecimento</th><th>Status</th><th>QR</th><th>NFC</th><th>Total</th><th>Última interação</th></tr></thead><tbody>{placas.map((p) => <tr key={p.id}><td data-label="Placa"><Link href={`/painel/placas/${p.id}`}>{p.codigo}</Link></td><td data-label="Estabelecimento">{p.estabelecimento_nome}</td><td data-label="Status"><Badge tom={p.estado_comercial}>{p.estado_comercial}</Badge></td><td data-label="QR">{p.interacoes_qr}</td><td data-label="NFC">{p.interacoes_nfc}</td><td data-label="Total"><strong>{p.total_interacoes}</strong></td><td data-label="Última interação">{formatarDataHora(p.ultima_interacao)}</td></tr>)}</tbody></table></div> : <EstadoVazio titulo="Nenhuma placa vinculada" descricao="As placas ativadas para este cliente aparecerão aqui." />}
      </Secao>

      <Secao titulo="Vendas e pagamentos" descricao="Histórico comercial do cliente">
        {vendas.length ? <div className="table-wrap"><table><thead><tr><th>Data</th><th>Tipo</th><th>Total</th><th>Pago</th><th>Situação</th></tr></thead><tbody>{vendas.map((v) => <tr key={v.id}><td data-label="Data"><Link href={`/painel/vendas/${v.id}`}>{formatarData(v.criado_em)}</Link></td><td data-label="Tipo">{v.tipo}</td><td data-label="Total">{formatarBRL(v.total_centavos)}</td><td data-label="Pago">{formatarBRL(Number(v.pago_centavos))}</td><td data-label="Situação"><Badge tom={v.situacao_pagamento}>{v.situacao_pagamento}</Badge></td></tr>)}</tbody></table></div> : <EstadoVazio titulo="Nenhuma venda registrada" descricao="As vendas vinculadas a este cliente aparecerão aqui." />}
      </Secao>
      <p className="muted-note">Interações representam acessos ao destino da placa, não avaliações publicadas.</p>
    </div>
  );
}
