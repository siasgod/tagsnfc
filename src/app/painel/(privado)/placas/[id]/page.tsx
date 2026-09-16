import { notFound } from "next/navigation";
import { buscarPlacaComDetalhes } from "@/lib/db/repo/placas";
import { listarHistoricoDaPlaca } from "@/lib/db/repo/historico";
import { listarVendedores } from "@/lib/db/repo/usuarios";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { exigirAcessoPlaca, temPermissao } from "@/lib/auth/autorizacao";
import { formatarDataHora } from "@/lib/tempo";
import { marcarConferenciaAction, atribuirVendedorAction, registrarNfcAction } from "@/lib/actions/placas";
import { DesativarForm, AlterarVinculoForm, SubstituirForm } from "./AcoesPlaca";
import { Badge, CabecalhoPagina, CartaoMetrica, Secao } from "@/components/painel/PainelUI";
import Link from "next/link";

export default async function PaginaPlacaDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = (await obterUsuarioAtual())!;
  await exigirAcessoPlaca(usuario, id);
  const [placa, historico] = await Promise.all([
    buscarPlacaComDetalhes(id),
    listarHistoricoDaPlaca(id),
  ]);
  if (!placa) notFound();

  const vendedores = usuario.papel === "ADMIN" ? await listarVendedores() : [];
  const podeEditar = temPermissao(usuario, "PLACAS_EDITAR");

  return (
    <div className="space-y-6">
      <CabecalhoPagina titulo={placa.codigo} descricao={`Lote ${placa.lote_codigo} · produção ${placa.estado_producao}`} acao={<div className="flex gap-2"><Badge tom={placa.estado_comercial}>{placa.estado_comercial}</Badge><Link href="/painel/placas" className="button button-secondary button-small">← Placas</Link></div>} />

      <section className="stats-grid">
        <CartaoMetrica rotulo="Interações" valor={placa.total_interacoes} detalhe="Total registrado" tom="azul" />
        <CartaoMetrica rotulo="Via QR" valor={placa.interacoes_qr} detalhe="Aberturas por câmera" tom="verde" />
        <CartaoMetrica rotulo="Via NFC" valor={placa.interacoes_nfc} detalhe="Aproximações" tom="violeta" />
        <CartaoMetrica rotulo="Último acesso" valor={placa.ultima_interacao ? formatarDataHora(placa.ultima_interacao) : "—"} detalhe="QR ou NFC" tom="ambar" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="surface p-4 text-sm">
          <p className="font-medium text-slate-700">Vínculo atual</p>
          <p className="mt-1">Cliente: {placa.cliente_nome ?? "—"}</p>
          <p>Estabelecimento: {placa.estabelecimento_nome ?? "—"}</p>
          <p className="break-all">Destino: {placa.destino_url ?? "—"}</p>
          <p>Vendedor: {placa.vendedor_nome ?? "—"}</p>
        </div>
        <div className="surface p-4 text-sm">
          <p className="font-medium text-slate-700">URLs públicas</p>
          <p className="break-all">
            QR:{" "}
            <a className="text-blue-600" href={placa.url_qr} target="_blank" rel="noreferrer">
              {placa.url_qr}
            </a>
          </p>
          <p className="break-all">
            NFC:{" "}
            <a className="text-blue-600" href={placa.url_nfc} target="_blank" rel="noreferrer">
              {placa.url_nfc}
            </a>
          </p>
        </div>
      </section>

      {usuario?.papel === "ADMIN" && (
        <section className="surface p-4">
          <p className="mb-2 text-sm font-medium text-slate-700">Conferências de produção</p>
          <div className="flex flex-wrap gap-2 text-sm">
            <form action={marcarConferenciaAction.bind(null, id, "conferencia_impressao_em")}>
              <button className="rounded-lg border border-slate-300 px-3 py-1.5">
                {placa.conferencia_impressao_em ? "✓ Impressão conferida" : "Marcar impressão conferida"}
              </button>
            </form>
            <form action={marcarConferenciaAction.bind(null, id, "conferencia_qr_em")}>
              <button className="rounded-lg border border-slate-300 px-3 py-1.5">
                {placa.conferencia_qr_em ? "✓ QR conferido" : "Marcar QR conferido"}
              </button>
            </form>
            <form action={marcarConferenciaAction.bind(null, id, "conferencia_montagem_em")}>
              <button className="rounded-lg border border-slate-300 px-3 py-1.5">
                {placa.conferencia_montagem_em ? "✓ Montagem conferida" : "Marcar montagem conferida"}
              </button>
            </form>
          </div>

          <p className="mb-2 mt-4 text-sm font-medium text-slate-700">Configuração NFC</p>
          <form action={registrarNfcAction.bind(null, id)} className="space-y-2 text-sm">
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Copie a URL do NFC acima e grave pelo app NFC Tools no iPhone. O painel não grava a etiqueta
              diretamente — só fornece o link e registra a confirmação manual.
            </div>
            <div className="flex flex-wrap gap-3">
              <input name="modelo" placeholder="Modelo da etiqueta (opcional)" defaultValue={placa.nfc_modelo ?? ""} className="botao-toque rounded-lg border border-slate-300 px-3" />
              <input name="uid" placeholder="UID (opcional)" defaultValue={placa.nfc_uid ?? ""} className="botao-toque rounded-lg border border-slate-300 px-3" />
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="marcarGravado" defaultChecked={!!placa.nfc_gravacao_concluida_em} /> Gravação concluída
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="marcarLeituraConferida" defaultChecked={!!placa.nfc_leitura_conferida_em} /> Leitura conferida
            </label>
            <button className="botao-toque rounded-lg bg-slate-800 px-4 text-white">Salvar</button>
          </form>

          <p className="mb-2 mt-4 text-sm font-medium text-slate-700">Vendedor atribuído</p>
          <form action={atribuirVendedorAction.bind(null, id)} className="flex gap-2">
            <select name="vendedorId" defaultValue={placa.vendedor_atribuido_id ?? ""} className="botao-toque rounded-lg border border-slate-300 px-3">
              <option value="">Nenhum</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                </option>
              ))}
            </select>
            <button className="botao-toque rounded-lg bg-slate-800 px-4 text-white">Salvar</button>
          </form>
        </section>
      )}

      {podeEditar ? <section className="surface space-y-2 p-4">
        <p className="text-sm font-medium text-slate-700">Ações</p>
        {placa.estado_comercial === "ATIVA" && <AlterarVinculoForm placaId={id} estabelecimentoAtualId={placa.estabelecimento_id} />}
        {placa.estado_comercial !== "DESATIVADA" && <div><DesativarForm placaId={id} /></div>}
        <div>
          <SubstituirForm placaId={id} />
        </div>
      </section> : null}

      <Secao titulo="Histórico" descricao="Auditoria das alterações da placa">
        <ul className="space-y-2 text-sm">
          {historico.map((h) => (
            <li key={h.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="font-medium">{h.tipo}</p>
              <p className="text-xs text-slate-500">
                {formatarDataHora(h.criado_em)} · {h.usuario_nome ?? "sistema"}
              </p>
              <pre className="mt-1 overflow-x-auto text-xs text-slate-400">{JSON.stringify(h.detalhes_json)}</pre>
            </li>
          ))}
          {historico.length === 0 && <p className="text-slate-400">Sem eventos registrados.</p>}
        </ul>
      </Secao>
      <p className="muted-note">Interações são acessos ao link da placa; não confirmam a publicação de uma avaliação.</p>
    </div>
  );
}
