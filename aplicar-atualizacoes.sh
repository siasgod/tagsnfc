#!/usr/bin/env bash
set -euo pipefail
echo "Aplicando atualizacoes do painel TAGS NFC..."

mkdir -p "src/app/api/lotes/[id]/exportar"
mkdir -p "src/app"
mkdir -p "src/app/painel/(privado)/ativar"
mkdir -p "src/app/painel/(privado)/clientes/[id]"
mkdir -p "src/app/painel/(privado)/clientes"
mkdir -p "src/app/painel/(privado)"
mkdir -p "src/app/painel/(privado)/lotes/[id]"
mkdir -p "src/app/painel/(privado)/lotes/novo"
mkdir -p "src/app/painel/(privado)/lotes"
mkdir -p "src/app/painel/(privado)/placas"
mkdir -p "src/app/painel/(privado)/vendas"
mkdir -p "src/app/painel/(publico)/setup"
mkdir -p "src/components/painel"
mkdir -p "src/lib/pdf"
mkdir -p "tests"

cat > "src/app/api/lotes/[id]/exportar/route.ts" << 'TAGSNFC_HEREDOC_EOF_9f3a1c'
import type { NextRequest } from "next/server";
import { exigirUsuario } from "@/lib/auth/autorizacao";
import { buscarLotePorId, listarPlacasDoLote } from "@/lib/db/repo/lotes";
import { obterConfiguracao } from "@/lib/db/repo/configuracoes";
import { verificarLiberacaoProducao } from "@/lib/exportacao/gate";
import { parametrosImpressaoPadrao } from "@/lib/pdf/cartao";
import {
  gerarPdfCartaoIndividual,
  gerarPdfMultipagina,
  gerarPdfImposicaoA4,
} from "@/lib/pdf/exportar";
import { gerarCsvLote } from "@/lib/exportacao/csv";
import { gerarZip } from "@/lib/exportacao/zip";
import { comTratamentoDeErros } from "@/lib/api-utils";

export const runtime = "nodejs";

/**
 * GET /api/lotes/:id/exportar?tipo=pdf-individual|multipagina|a4|csv|zip
 *                             &modo=producao|demo
 *                             &placaCodigo=PL-000001 (obrigatório para pdf-individual)
 *
 * `modo=producao` só é aceito se a origem pública do lote já tiver sido
 * validada em Configurações (ver src/lib/exportacao/gate.ts). Caso
 * contrário, a exportação é sempre servida como demonstração, com marca
 * d'água visível — nunca falha silenciosamente nem finge estar pronta para
 * produção.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return comTratamentoDeErros(async () => exportarLote(request, context));
}

async function exportarLote(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  await exigirUsuario();
  const { id } = await context.params;
  const { searchParams } = request.nextUrl;
  const tipo = searchParams.get("tipo") ?? "multipagina";
  const modoSolicitado = searchParams.get("modo") === "producao" ? "producao" : "demo";
  const placaCodigo = searchParams.get("placaCodigo");

  const lote = await buscarLotePorId(id);
  if (!lote) return Response.json({ erro: "Lote não encontrado." }, { status: 404 });

  let modoEfetivo: "producao" | "demo" = "demo";
  let motivoDemo: string | undefined;
  if (modoSolicitado === "producao") {
    const liberacao = await verificarLiberacaoProducao(lote.origem_publica_usada);
    if (liberacao.liberado) {
      modoEfetivo = "producao";
    } else {
      motivoDemo = liberacao.motivo;
    }
  }

  const placas = await listarPlacasDoLote(id);
  if (placas.length === 0) return Response.json({ erro: "Lote sem placas." }, { status: 404 });

  const config = await obterConfiguracao();
  const parametros = parametrosImpressaoPadrao();
  const opcoes = {
    nomeOperacao: config.nome_operacao || undefined,
    marcaDagua: modoEfetivo === "demo" ? "DEMONSTRAÇÃO — NÃO IMPRIMIR" : undefined,
  };

  const nomeArquivoBase = `${lote.codigo}${modoEfetivo === "demo" ? "-DEMO" : ""}`;

  try {
    if (tipo === "pdf-individual") {
      const placa = placas.find((p) => p.codigo === placaCodigo);
      if (!placa) return Response.json({ erro: "Informe placaCodigo válido para este lote." }, { status: 400 });
      const buffer = await gerarPdfCartaoIndividual({ codigo: placa.codigo, urlQr: placa.url_qr }, parametros, opcoes);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="${placa.codigo}${modoEfetivo === "demo" ? "-DEMO" : ""}.pdf"`,
          "x-modo-exportacao": modoEfetivo,
          ...(motivoDemo ? { "x-motivo-demo": encodeURIComponent(motivoDemo) } : {}),
        },
      });
    }

    if (tipo === "multipagina") {
      const buffer = await gerarPdfMultipagina(
        placas.map((p) => ({ codigo: p.codigo, urlQr: p.url_qr })),
        parametros,
        opcoes
      );
      return new Response(new Uint8Array(buffer), {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="${nomeArquivoBase}-multipagina.pdf"`,
          "x-modo-exportacao": modoEfetivo,
        },
      });
    }

    if (tipo === "a4") {
      const resultado = await gerarPdfImposicaoA4(
        placas.map((p) => ({ codigo: p.codigo, urlQr: p.url_qr })),
        parametros,
        opcoes
      );
      return new Response(new Uint8Array(resultado.buffer), {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="${nomeArquivoBase}-a4.pdf"`,
          "x-modo-exportacao": modoEfetivo,
          "x-imposicao": `${resultado.colunas}x${resultado.linhas} por folha (${resultado.porFolha}); ${resultado.totalFolhas} folha(s)`,
        },
      });
    }

    if (tipo === "csv") {
      const csv = gerarCsvLote(placas);
      return new Response(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${lote.codigo}.csv"`,
        },
      });
    }

    if (tipo === "zip") {
      const [multi, csv] = await Promise.all([
        gerarPdfMultipagina(
          placas.map((p) => ({ codigo: p.codigo, urlQr: p.url_qr })),
          parametros,
          opcoes
        ),
        Promise.resolve(gerarCsvLote(placas)),
      ]);
      let a4Buffer: Buffer | null = null;
      try {
        a4Buffer = (
          await gerarPdfImposicaoA4(
            placas.map((p) => ({ codigo: p.codigo, urlQr: p.url_qr })),
            parametros,
            opcoes
          )
        ).buffer;
      } catch {
        // Parâmetros incompatíveis com A4 — o ZIP ainda é útil sem esse arquivo.
      }
      const arquivos: Record<string, Buffer | string> = {
        [`${nomeArquivoBase}-multipagina.pdf`]: multi,
        [`${lote.codigo}.csv`]: csv,
      };
      if (a4Buffer) arquivos[`${nomeArquivoBase}-a4.pdf`] = a4Buffer;
      for (const placa of placas) {
        arquivos[`individuais/${placa.codigo}${modoEfetivo === "demo" ? "-DEMO" : ""}.pdf`] = await gerarPdfCartaoIndividual({ codigo: placa.codigo, urlQr: placa.url_qr }, parametros, opcoes);
      }
      const zip = await gerarZip(arquivos);
      return new Response(new Uint8Array(zip), {
        headers: {
          "content-type": "application/zip",
          "content-disposition": `attachment; filename="${nomeArquivoBase}.zip"`,
          "x-modo-exportacao": modoEfetivo,
        },
      });
    }

    return Response.json({ erro: "Tipo de exportação desconhecido." }, { status: 400 });
  } catch (err) {
    console.error("[exportar lote] erro:", err);
    return Response.json({ erro: (err as Error).message }, { status: 500 });
  }
}
TAGSNFC_HEREDOC_EOF_9f3a1c

cat > "src/app/globals.css" << 'TAGSNFC_HEREDOC_EOF_9f3a1c'
@import "tailwindcss";

:root {
  --background: #f8fafc;
  --foreground: #0f172a;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

/* Alvo de toque confortável em telas de celular, conforme especificação. */
.botao-toque {
  min-height: 48px;
}

/* Superfícies operacionais compartilhadas pelo painel. */
.painel { background: #f3f6fb; }
.painel main { min-width: 0; }
.painel h1 { font-size: clamp(1.4rem, 2.5vw, 1.9rem); letter-spacing: -.035em; }
.painel table th { padding: 1rem; font-size: .68rem; letter-spacing: .06em; }
.painel table td { padding: 1rem; }
.painel table tbody tr:hover { background: #f8faff; }
.painel input:not([type=checkbox]), .painel select, .painel textarea { background: white; min-width: 0; max-width: 100%; }
.painel :is(button, a, input, select, textarea):focus-visible { outline: 3px solid #93c5fd; outline-offset: 3px; }
.painel button:not(:disabled), .painel a { cursor: pointer; }
.painel button:disabled { cursor: not-allowed; opacity: .65; }
.painel .overflow-x-auto { box-shadow: 0 4px 24px #0f172a05; }
@media (max-width: 1023px) { .painel main { padding-bottom: 7rem; } }
@media (max-width: 639px) {
 .painel table { min-width: 0; }
 .painel table thead { display: none; }
 .painel table, .painel table tbody { display: block; width: 100%; }
 .painel table tr { display: grid; grid-template-columns: 1fr 1fr; padding: .8rem; gap: .4rem; }
 .painel table td { display: block; padding: .3rem; overflow-wrap: anywhere; }
 .painel table td:first-child { grid-column: 1 / -1; font-weight: 600; }
 .painel table td[data-label]::before { content: attr(data-label); display: block; font-size: .65rem; color: #64748b; margin-bottom: .2rem; }
}
TAGSNFC_HEREDOC_EOF_9f3a1c

cat > "src/app/painel/(privado)/ativar/AtivarPlacaClient.tsx" << 'TAGSNFC_HEREDOC_EOF_9f3a1c'
"use client";

import { useRef, useState } from "react";
import { LeitorQr } from "@/components/ativacao/LeitorQr";

type Etapa = "buscar" | "situacao" | "cliente" | "estabelecimento" | "destino" | "nfc" | "venda" | "revisao" | "sucesso";

interface PlacaInfo {
  id: string;
  codigo: string;
  estadoComercial: string;
  estabelecimentoId: string | null;
  destinoUrl: string | null;
  urlQr: string;
  urlNfc: string;
}

interface EstabelecimentoBusca {
  id: string;
  nome: string;
}

interface ClienteBusca {
  id: string;
  nome: string;
  telefone: string | null;
  estabelecimentos: EstabelecimentoBusca[];
}

function gerarChaveIdempotencia(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AtivarPlacaClient({
  precoPadraoCentavos,
  custoPadraoCentavos,
}: {
  precoPadraoCentavos: number;
  custoPadraoCentavos: number;
}) {
  const [etapa, setEtapa] = useState<Etapa>("buscar");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [placa, setPlaca] = useState<PlacaInfo | null>(null);

  const [buscaCliente, setBuscaCliente] = useState("");
  const [resultadosClientes, setResultadosClientes] = useState<ClienteBusca[]>([]);
  const [clienteEscolhido, setClienteEscolhido] = useState<ClienteBusca | null>(null);
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const [novoClienteTelefone, setNovoClienteTelefone] = useState("");
  const [criandoNovoCliente, setCriandoNovoCliente] = useState(false);

  const [estabelecimentoEscolhidoId, setEstabelecimentoEscolhidoId] = useState<string | null>(null);
  const [novoEstabelecimentoNome, setNovoEstabelecimentoNome] = useState("");
  const [criandoNovoEstabelecimento, setCriandoNovoEstabelecimento] = useState(false);

  const [destinoUrl, setDestinoUrl] = useState("");
  const [checagemDestino, setChecagemDestino] = useState<{
    status: string;
    motivo?: string;
    urlFinal?: string;
  } | null>(null);
  const [aceitarConferenciaManual, setAceitarConferenciaManual] = useState(false);

  const [tipoVenda, setTipoVenda] = useState<"VENDA" | "DEMONSTRACAO" | "BONIFICACAO">("VENDA");
  const [justificativa, setJustificativa] = useState("");
  const [precoCentavos, setPrecoCentavos] = useState(precoPadraoCentavos);
  const [custoCentavos, setCustoCentavos] = useState(custoPadraoCentavos);

  const [resultado, setResultado] = useState<{ codigo: string; urlQr: string; urlNfc: string } | null>(null);

  const chaveIdempotencia = useRef(gerarChaveIdempotencia());

  async function buscarPlaca(identificador: string) {
    setCarregando(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/placas/consulta?identificador=${encodeURIComponent(identificador)}`);
      const dados = await resp.json();
      if (!resp.ok) {
        setErro(dados.erro ?? "Placa não encontrada.");
        return;
      }
      setPlaca(dados);
      setEtapa("situacao");
    } catch {
      setErro("Não foi possível consultar a placa. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  async function buscarClientes(q: string) {
    setBuscaCliente(q);
    if (q.trim().length < 2) {
      setResultadosClientes([]);
      return;
    }
    try {
      const resp = await fetch(`/api/clientes/busca?q=${encodeURIComponent(q)}`);
      if (resp.ok) setResultadosClientes(await resp.json());
      else setErro("Não foi possível buscar clientes.");
    } catch { setErro("Não foi possível buscar clientes. Verifique a conexão."); }
  }

  async function conferirDestino() {
    setCarregando(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/destino/validar?url=${encodeURIComponent(destinoUrl)}`);
      const dados = await resp.json();
      if (!resp.ok) {
        setErro(dados.erro ?? "Não foi possível validar o destino.");
        return;
      }
      setChecagemDestino(dados);
      if (dados.status === "invalido") {
        setErro(dados.motivo);
        return;
      }
      setEtapa(dados.status === "valido_requer_conferencia" ? "destino" : "nfc");
    } catch {
      setErro("Não foi possível conferir o destino. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  async function confirmarAtivacao() {
    setCarregando(true);
    setErro(null);
    try {
      const corpo = {
        identificadorPlaca: placa!.codigo,
        clienteId: criandoNovoCliente ? undefined : clienteEscolhido?.id,
        novoCliente: criandoNovoCliente
          ? { nome: novoClienteNome, telefone: novoClienteTelefone || undefined }
          : undefined,
        estabelecimentoId: criandoNovoEstabelecimento ? undefined : estabelecimentoEscolhidoId ?? undefined,
        novoEstabelecimento: criandoNovoEstabelecimento ? { nome: novoEstabelecimentoNome } : undefined,
        destinoUrl,
        venda: {
          tipo: tipoVenda,
          justificativa: tipoVenda !== "VENDA" ? justificativa : undefined,
          precoCentavos: tipoVenda === "VENDA" ? precoCentavos : 0,
          custoCentavos,
        },
        chaveIdempotencia: chaveIdempotencia.current,
        confirmarMesmoComConferenciaManualPendente: aceitarConferenciaManual,
      };

      const resp = await fetch("/api/ativacao", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const dados = await resp.json();

      if (resp.status === 409 && dados.exigeConferenciaManual) {
        setChecagemDestino({ status: "valido_requer_conferencia", motivo: dados.motivo, urlFinal: dados.urlFinal });
        setAceitarConferenciaManual(false);
        setEtapa("destino");
        setErro(null);
        return;
      }
      if (!resp.ok) {
        setErro(dados.erro ?? "Falha ao ativar.");
        return;
      }

      // Só exibimos sucesso depois de receber confirmação persistida do servidor.
      setResultado(dados.placa);
      setEtapa("sucesso");
    } catch {
      setErro("Sem conexão. Verifique a internet e tente novamente — nada foi confirmado.");
    } finally {
      setCarregando(false);
    }
  }

  const etapas = ["Placa", "Cliente", "Estabelecimento", "Google", "NFC", "Venda"];
  const indice = { buscar: 0, situacao: 0, cliente: 1, estabelecimento: 2, destino: 3, nfc: 4, venda: 5, revisao: 5, sucesso: 5 }[etapa];
  const anteriores: Partial<Record<Etapa, Etapa>> = { cliente: "situacao", estabelecimento: "cliente", destino: "estabelecimento", nfc: "destino", venda: "nfc" };
  const progresso = <div className="mb-6 space-y-4">
    <ol aria-label="Etapas da ativação" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {etapas.map((nome, i) => <li key={nome} aria-current={i === indice ? "step" : undefined} className={i === indice ? "rounded-xl bg-blue-600 p-3 text-xs font-semibold text-white" : "rounded-xl bg-slate-100 p-3 text-xs text-slate-600"}>{i + 1}. {nome}</li>)}
    </ol>
    <p className="text-sm text-slate-500">Etapa {indice + 1} de 6 · {placa?.codigo ?? "Identifique a unidade impressa"}</p>
    {anteriores[etapa] && <button disabled={carregando} className="botao-toque text-sm text-blue-700" onClick={() => { setErro(null); setEtapa(anteriores[etapa]!); }}>← Voltar</button>}
  </div>;

  if (etapa === "nfc" && placa) return <div className="space-y-4">{progresso}
    <h2 className="text-xl font-semibold">Prepare o NFC</h2>
    <p className="text-sm text-slate-600">Copie esta URL e grave um registro de URL no chip usando o NFC Tools. O navegador apenas fornece o endereço. Teste a placa física após concluir a venda.</p>
    <label className="block text-sm font-medium">URL NFC<input readOnly value={placa.urlNfc} onFocus={e => e.target.select()} className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm" /></label>
    <button className="botao-toque w-full rounded-lg border border-blue-600 text-blue-700" onClick={async () => { try { await navigator.clipboard.writeText(placa.urlNfc); setErro("URL copiada."); } catch { setErro("Selecione a URL acima e copie manualmente."); } }}>Copiar URL NFC</button>
    {erro && <p role="status" className="text-sm">{erro}</p>}
    <button className="botao-toque w-full rounded-lg bg-blue-600 text-white" onClick={() => { setErro(null); setEtapa("venda"); }}>Continuar para venda</button>
  </div>;

  if (etapa === "buscar") {
    return (
      <div className="space-y-4">
        {progresso}
        <p className="text-sm text-slate-500">Escaneie o QR da placa ou digite o código.</p>
        <LeitorQr onDetectado={buscarPlaca} />
        {carregando && <p className="text-sm text-slate-500">Buscando…</p>}
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      </div>
    );
  }

  if (!placa) return null;

  if (etapa === "situacao") {
    const jaAtiva = ["ATIVA", "PERDIDA", "SUBSTITUIDA"].includes(placa.estadoComercial);
    return (
      <div className="space-y-4">
        {progresso}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Placa</p>
          <p className="text-lg font-semibold">{placa.codigo}</p>
          <p className="mt-1 text-sm">
            Situação: <span className="font-medium">{placa.estadoComercial}</span>
          </p>
        </div>
        {jaAtiva ? (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Esta placa não permite primeira ativação neste estado. Para trocar o vínculo ou destino, acesse a página da placa em
            &ldquo;Placas&rdquo; e use a ação explícita de mudança de vínculo — este fluxo é só para primeira
            ativação.
          </div>
        ) : (
          <button
            className="botao-toque w-full rounded-lg bg-blue-600 px-4 font-medium text-white"
            onClick={() => setEtapa("cliente")}
          >
            Continuar ativação
          </button>
        )}
        <button className="text-sm text-slate-500 underline" onClick={() => setEtapa("buscar")}>
          Escanear outra placa
        </button>
      </div>
    );
  }

  if (etapa === "cliente") {
    return (
      <div className="space-y-4">
        {progresso}
        <h2 className="font-medium">Cliente</h2>
        {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
        {!criandoNovoCliente ? (
          <>
            <input
              value={buscaCliente}
              onChange={(e) => buscarClientes(e.target.value)}
              aria-label="Buscar por nome ou telefone" placeholder="Buscar por nome ou telefone"
              className="botao-toque w-full rounded-lg border border-slate-300 px-3"
            />
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              {resultadosClientes.map((c) => (
                <li key={c.id}>
                  <button
                    className="w-full px-3 py-2 text-left hover:bg-slate-50"
                    onClick={() => {
                      setClienteEscolhido(c);
                      setEstabelecimentoEscolhidoId(null);
                      setCriandoNovoEstabelecimento(false);
                      setEtapa("estabelecimento");
                    }}
                  >
                    <p className="font-medium">{c.nome}</p>
                    <p className="text-xs text-slate-500">{c.telefone ?? "sem telefone"}</p>
                  </button>
                </li>
              ))}
            </ul>
            <button className="text-sm text-blue-600 underline" onClick={() => { setCriandoNovoCliente(true); setClienteEscolhido(null); setEstabelecimentoEscolhidoId(null); setCriandoNovoEstabelecimento(true); }}>
              + Cadastrar novo cliente
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <input
              value={novoClienteNome}
              onChange={(e) => setNovoClienteNome(e.target.value)}
              aria-label="Nome do cliente/comércio" placeholder="Nome do cliente/comércio"
              className="botao-toque w-full rounded-lg border border-slate-300 px-3"
            />
            <input
              value={novoClienteTelefone}
              onChange={(e) => setNovoClienteTelefone(e.target.value)}
              aria-label="Telefone/WhatsApp" placeholder="Telefone/WhatsApp"
              className="botao-toque w-full rounded-lg border border-slate-300 px-3"
            />
            <button
              disabled={novoClienteNome.trim().length < 2}
              className="botao-toque w-full rounded-lg bg-blue-600 px-4 font-medium text-white disabled:bg-blue-300"
              onClick={() => setEtapa("estabelecimento")}
            >
              Continuar
            </button>
            <button className="text-sm text-slate-500 underline" onClick={() => setCriandoNovoCliente(false)}>
              Buscar cliente existente
            </button>
          </div>
        )}
      </div>
    );
  }

  if (etapa === "estabelecimento") {
    const estabelecimentosDoCliente = clienteEscolhido?.estabelecimentos ?? [];
    return (
      <div className="space-y-4">
        {progresso}
        <h2 className="font-medium">Estabelecimento</h2>
        {!criandoNovoEstabelecimento ? (
          <>
            {estabelecimentosDoCliente.length > 0 ? (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                {estabelecimentosDoCliente.map((e) => (
                  <li key={e.id}>
                    <button
                      className="w-full px-3 py-2 text-left hover:bg-slate-50"
                      onClick={() => {
                        setEstabelecimentoEscolhidoId(e.id);
                        setEtapa("destino");
                      }}
                    >
                      {e.nome}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Nenhum estabelecimento cadastrado ainda para este cliente.</p>
            )}
            <button className="text-sm text-blue-600 underline" onClick={() => setCriandoNovoEstabelecimento(true)}>
              + Cadastrar novo estabelecimento
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <input
              value={novoEstabelecimentoNome}
              onChange={(e) => setNovoEstabelecimentoNome(e.target.value)}
              aria-label="Nome do estabelecimento" placeholder="Nome do estabelecimento"
              className="botao-toque w-full rounded-lg border border-slate-300 px-3"
            />
            <button
              disabled={novoEstabelecimentoNome.trim().length < 2}
              className="botao-toque w-full rounded-lg bg-blue-600 px-4 font-medium text-white disabled:bg-blue-300"
              onClick={() => setEtapa("destino")}
            >
              Continuar
            </button>
          </div>
        )}
      </div>
    );
  }

  if (etapa === "destino") {
    return (
      <div className="space-y-4">
        {progresso}
        <h2 className="font-medium">Link de avaliação do Google</h2>
        <input
          value={destinoUrl}
          onChange={(e) => { setDestinoUrl(e.target.value); setChecagemDestino(null); setAceitarConferenciaManual(false); }}
          aria-label="https://g.page/r/.../review" placeholder="https://g.page/r/.../review"
          className="botao-toque w-full rounded-lg border border-slate-300 px-3"
        />
        {checagemDestino?.status === "valido_requer_conferencia" && (
          <div className="space-y-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <p>{checagemDestino.motivo}</p>
            {checagemDestino.urlFinal && <p className="break-all text-xs">Destino final: {checagemDestino.urlFinal}</p>}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={aceitarConferenciaManual}
                onChange={(e) => setAceitarConferenciaManual(e.target.checked)}
              />
              Conferi manualmente e confirmo que este é o link correto de avaliação.
            </label>
          </div>
        )}
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <button
          disabled={
            carregando ||
            destinoUrl.trim().length < 5 ||
            (checagemDestino?.status === "valido_requer_conferencia" && !aceitarConferenciaManual)
          }
          className="botao-toque w-full rounded-lg bg-blue-600 px-4 font-medium text-white disabled:bg-blue-300"
          onClick={() =>
            checagemDestino?.status === "valido_requer_conferencia" && aceitarConferenciaManual
              ? setEtapa("nfc")
              : conferirDestino()
          }
        >
          {carregando ? "Conferindo…" : "Conferir destino"}
        </button>
      </div>
    );
  }

  if (etapa === "venda") {
    return (
      <div className="space-y-4">
        {progresso}
        <h2 className="font-medium">Venda</h2>
        <div className="flex gap-2">
          {(["VENDA", "DEMONSTRACAO", "BONIFICACAO"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTipoVenda(t)}
              className={`botao-toque flex-1 rounded-lg border px-2 text-sm ${tipoVenda === t ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-600"}`}
            >
              {t === "VENDA" ? "Venda" : t === "DEMONSTRACAO" ? "Demonstração" : "Bonificação"}
            </button>
          ))}
        </div>
        {tipoVenda === "VENDA" ? (
          <>
            <label className="block text-sm">
              Preço (R$)
              <input
                type="number"
                step="0.01"
                value={(precoCentavos / 100).toFixed(2)}
                onChange={(e) => setPrecoCentavos(Math.round(Number(e.target.value) * 100))}
                className="botao-toque mt-1 w-full rounded-lg border border-slate-300 px-3"
              />
            </label>
            <label className="block text-sm">
              Custo (R$)
              <input
                type="number"
                step="0.01"
                value={(custoCentavos / 100).toFixed(2)}
                onChange={(e) => setCustoCentavos(Math.round(Number(e.target.value) * 100))}
                className="botao-toque mt-1 w-full rounded-lg border border-slate-300 px-3"
              />
            </label>
          </>
        ) : (
          <input
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            aria-label="Justificativa (obrigatória)" placeholder="Justificativa (obrigatória)"
            className="botao-toque w-full rounded-lg border border-slate-300 px-3"
          />
        )}
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <button
          disabled={carregando || (tipoVenda !== "VENDA" && justificativa.trim().length < 3)}
          className="botao-toque w-full rounded-lg bg-blue-600 px-4 font-medium text-white disabled:bg-blue-300"
          onClick={confirmarAtivacao}
        >
          {carregando ? "Ativando…" : "Confirmar ativação"}
        </button>
      </div>
    );
  }

  if (etapa === "sucesso" && resultado) {
    return (
      <div className="space-y-4 text-center">
        {progresso}
        <div className="rounded-xl bg-green-50 p-6">
          <p className="text-lg font-semibold text-green-800">Placa {resultado.codigo} ativada!</p>
          <p className="mt-1 text-sm text-green-700">Confirmado e salvo no servidor.</p>
        </div>
        <p className="text-sm text-slate-600">Teste o QR e o NFC antes de deixar o local:</p>
        <div className="flex flex-col gap-2">
          <a
            href={resultado.urlQr}
            target="_blank"
            rel="noreferrer"
            className="botao-toque rounded-lg border border-slate-300 px-4 py-2 font-medium"
          >
            Testar link do QR
          </a>
          <a
            href={resultado.urlNfc}
            target="_blank"
            rel="noreferrer"
            className="botao-toque rounded-lg border border-slate-300 px-4 py-2 font-medium"
          >
            Testar link do NFC
          </a>
        </div>
        <button
          className="botao-toque w-full rounded-lg bg-blue-600 px-4 font-medium text-white"
          onClick={() => window.location.reload()}
        >
          Ativar outra placa
        </button>
      </div>
    );
  }

  return null;
}
TAGSNFC_HEREDOC_EOF_9f3a1c

cat > "src/app/painel/(privado)/ativar/page.tsx" << 'TAGSNFC_HEREDOC_EOF_9f3a1c'
import { obterConfiguracao } from "@/lib/db/repo/configuracoes";
import { AtivarPlacaClient } from "./AtivarPlacaClient";

export default async function PaginaAtivar() {
  const config = await obterConfiguracao();

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 sm:p-8">
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Ativar placa</h1>
      <AtivarPlacaClient
        precoPadraoCentavos={config.preco_padrao_centavos ?? 0}
        custoPadraoCentavos={config.custo_padrao_centavos ?? 0}
      />
    </div>
  );
}
TAGSNFC_HEREDOC_EOF_9f3a1c

cat > "src/app/painel/(privado)/clientes/[id]/page.tsx" << 'TAGSNFC_HEREDOC_EOF_9f3a1c'
import { notFound } from "next/navigation";
import { buscarClientePorId } from "@/lib/db/repo/clientes";
import { listarEstabelecimentosPorCliente } from "@/lib/db/repo/estabelecimentos";
import { listarPlacasPorCliente } from "@/lib/db/repo/placas";
import { listarVendasPorCliente } from "@/lib/db/repo/vendas";
import { formatarBRL } from "@/lib/dinheiro";
import { formatarData } from "@/lib/tempo";
import Link from "next/link";
import { NovoEstabelecimentoForm } from "./NovoEstabelecimentoForm";

export default async function PaginaClienteDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cliente = await buscarClientePorId(id);
  if (!cliente) notFound();

  const [estabelecimentos, placas, vendas] = await Promise.all([
    listarEstabelecimentosPorCliente(id),
    listarPlacasPorCliente(id),
    listarVendasPorCliente(id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">{cliente.nome}</h1>
        <p className="text-sm text-slate-500">
          {cliente.telefone ?? "sem telefone"} {cliente.email ? `· ${cliente.email}` : ""}
        </p>
        {cliente.observacoes && <p className="mt-1 text-sm text-slate-600">{cliente.observacoes}</p>}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-500">Estabelecimentos</h2>
        <ul className="space-y-2">
          {estabelecimentos.map((e) => (
            <li key={e.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="font-medium">{e.nome}</p>
              {e.endereco && <p className="text-xs text-slate-500">{e.endereco}</p>}
              {e.link_avaliacao && <p className="truncate text-xs text-blue-600">{e.link_avaliacao}</p>}
            </li>
          ))}
        </ul>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-blue-600">+ Adicionar estabelecimento</summary>
          <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
            <NovoEstabelecimentoForm clienteId={id} />
          </div>
        </details>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-500">Placas vinculadas</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[400px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Estabelecimento</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {placas.map((p: any) => (
                <tr key={p.id}>
                  <td data-label="Código" className="px-3 py-2">
                    <Link href={`/painel/placas/${p.id}`} className="text-blue-600">
                      {p.codigo}
                    </Link>
                  </td>
                  <td data-label="Estabelecimento" className="px-3 py-2">{p.estabelecimento_nome}</td>
                  <td data-label="Estado" className="px-3 py-2">{p.estado_comercial}</td>
                </tr>
              ))}
              {placas.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-slate-400">
                    Nenhuma placa vinculada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-500">Vendas e pagamentos</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[500px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Pago</th>
                <th className="px-3 py-2">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendas.map((v: any) => (
                <tr key={v.id}>
                  <td data-label="Data" className="px-3 py-2">
                    <Link href={`/painel/vendas/${v.id}`} className="text-blue-600">
                      {formatarData(v.criado_em)}
                    </Link>
                  </td>
                  <td data-label="Tipo" className="px-3 py-2">{v.tipo}</td>
                  <td data-label="Total" className="px-3 py-2">{formatarBRL(v.total_centavos)}</td>
                  <td data-label="Pago" className="px-3 py-2">{formatarBRL(Number(v.pago_centavos))}</td>
                  <td data-label="Situação" className="px-3 py-2">{v.situacao_pagamento}</td>
                </tr>
              ))}
              {vendas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                    Nenhuma venda registrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
TAGSNFC_HEREDOC_EOF_9f3a1c

cat > "src/app/painel/(privado)/clientes/page.tsx" << 'TAGSNFC_HEREDOC_EOF_9f3a1c'
import Link from "next/link";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { podeVerTudo } from "@/lib/auth/autorizacao";
import { listarClientes } from "@/lib/db/repo/clientes";

export default async function PaginaClientes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const usuario = await obterUsuarioAtual();
  const clientes = await listarClientes({
    vendedorId: podeVerTudo(usuario!) ? undefined : usuario!.id,
    busca: q,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Clientes</h1>
        <Link href="/painel/clientes/novo" className="botao-toque rounded-lg bg-blue-600 px-3 text-sm font-medium text-white flex items-center">
          + Novo cliente
        </Link>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome ou telefone"
          className="botao-toque flex-1 rounded-lg border border-slate-300 px-3"
        />
        <button className="botao-toque rounded-lg bg-slate-800 px-4 text-sm font-medium text-white">Buscar</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[500px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Telefone</th>
              <th className="px-3 py-2">Estabelecimentos</th>
              <th className="px-3 py-2">Placas</th>
              <th className="px-3 py-2">Vendedor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clientes.map((c: any) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td data-label="Nome" className="px-3 py-2">
                  <Link href={`/painel/clientes/${c.id}`} className="font-medium text-blue-600">
                    {c.nome}
                  </Link>
                </td>
                <td data-label="Telefone" className="px-3 py-2">{c.telefone ?? "—"}</td>
                <td data-label="Estabelecimentos" className="px-3 py-2">{c.total_estabelecimentos}</td>
                <td data-label="Placas" className="px-3 py-2">{c.total_placas}</td>
                <td data-label="Vendedor" className="px-3 py-2">{c.vendedor_nome ?? "—"}</td>
              </tr>
            ))}
            {clientes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
TAGSNFC_HEREDOC_EOF_9f3a1c

cat > "src/app/painel/(privado)/layout.tsx" << 'TAGSNFC_HEREDOC_EOF_9f3a1c'
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
    <div className="painel flex min-h-dvh flex-1 flex-col">
      <NavPainel usuario={usuario} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-8 sm:pb-8">{children}</main>
    </div>
  );
}
TAGSNFC_HEREDOC_EOF_9f3a1c

cat > "src/app/painel/(privado)/lotes/[id]/page.tsx" << 'TAGSNFC_HEREDOC_EOF_9f3a1c'
import { notFound } from "next/navigation";
import { buscarLotePorId, listarPlacasDoLote } from "@/lib/db/repo/lotes";
import { verificarLiberacaoProducao } from "@/lib/exportacao/gate";
import { formatarDataHora } from "@/lib/tempo";
import Link from "next/link";

export default async function PaginaLoteDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lote = await buscarLotePorId(id);
  if (!lote) notFound();

  const [placas, liberacao] = await Promise.all([
    listarPlacasDoLote(id),
    verificarLiberacaoProducao(lote.origem_publica_usada),
  ]);

  const base = `/api/lotes/${id}/exportar`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">{lote.codigo}</h1>
        <p className="text-sm text-slate-500">
          {lote.quantidade} placas · origem: <span className="font-mono">{lote.origem_publica_usada}</span> · gerado em{" "}
          {formatarDataHora(lote.criado_em)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[["Total", placas.length], ["Disponíveis", placas.filter(p => p.estado_comercial === "DISPONIVEL").length], ["Ativas", placas.filter(p => p.estado_comercial === "ATIVA").length]].map(([nome, valor]) => <div key={nome} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{nome}</p><p className="mt-2 text-2xl font-semibold">{valor}</p></div>)}
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-slate-700">Exportar para impressão</h2>
        {!liberacao.liberado && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Exportação "pronta para produção" bloqueada: {liberacao.motivo} As exportações abaixo serão geradas como
            <strong> demonstração</strong>, com marca d&apos;água, até que isso seja resolvido em Configurações.
          </p>
        )}
        <p className="mb-4 text-sm text-slate-500">Placas de 100 × 100 mm · arquivo de 106 × 106 mm com sangria · QR individual de 35 mm. Baixe diretamente por aqui e imprima em escala 100%. PDF em RGB; confirme o perfil de cor com a gráfica.</p>
        <div className="flex flex-wrap gap-2">
          {(["multipagina", "a4", "csv", "zip"] as const).map((tipo) => (
            <a
              key={tipo}
              href={`${base}?tipo=${tipo}&modo=${liberacao.liberado ? "producao" : "demo"}`}
              className="botao-toque flex items-center rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50"
            >
              {tipo === "multipagina" && "Baixar PDF para gráfica"}
              {tipo === "a4" && "Baixar PDF em folhas A4"}
              {tipo === "csv" && "CSV do lote"}
              {tipo === "zip" && "Baixar ZIP com PDFs individuais"}
            </a>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-500">Placas do lote</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Produção</th>
                <th className="px-3 py-2">Comercial</th>
                <th className="px-3 py-2">Estabelecimento</th>
                <th className="px-3 py-2">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {placas.map((p: any) => (
                <tr key={p.id}>
                  <td data-label="Código" className="px-3 py-2">
                    <Link href={`/painel/placas/${p.id}`} className="font-medium text-blue-600">
                      {p.codigo}
                    </Link>
                  </td>
                  <td data-label="Produção" className="px-3 py-2">{p.estado_producao}</td>
                  <td data-label="Comercial" className="px-3 py-2">{p.estado_comercial}</td>
                  <td data-label="Estabelecimento" className="px-3 py-2">{p.estabelecimento_nome ?? "—"}</td>
                  <td data-label="PDF" className="px-3 py-2">
                    <a
                      className="text-blue-600"
                      href={`${base}?tipo=pdf-individual&placaCodigo=${p.codigo}&modo=${liberacao.liberado ? "producao" : "demo"}`}
                    >
                      baixar
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
TAGSNFC_HEREDOC_EOF_9f3a1c

cat > "src/app/painel/(privado)/lotes/novo/LoteForm.tsx" << 'TAGSNFC_HEREDOC_EOF_9f3a1c'
"use client";

import { useActionState, useState } from "react";
import { criarLoteAction } from "@/lib/actions/lotes";
import { Campo } from "@/components/ui/Campo";
import { BotaoEnviar } from "@/components/ui/BotaoEnviar";
import type { EstadoFormulario } from "@/lib/actions/auth";

const estadoInicial: EstadoFormulario = {};
const TAMANHOS_SUGERIDOS = [10, 30, 50, 100];

export function LoteForm({ origemAtual }: { origemAtual: string }) {
  const [estado, acao] = useActionState(criarLoteAction, estadoInicial);
  const [quantidade, setQuantidade] = useState<number | "">("");

  return (
    <form action={acao} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Quantidade</label>
        <div className="mt-1 flex flex-wrap gap-2">
          {TAMANHOS_SUGERIDOS.map((q) => (
            <button
              type="button"
              key={q}
              onClick={() => setQuantidade(q)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${quantidade === q ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-600"}`}
            >
              {q}
            </button>
          ))}
        </div>
        <input
          type="number"
          name="quantidade"
          min={1}
          max={2000}
          required
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="Ou digite uma quantidade personalizada"
          className="botao-toque mt-2 block w-full rounded-lg border border-slate-300 px-3"
        />
      </div>
      <Campo label="Observações" name="observacoes" />
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Origem pública usada nas URLs deste lote: <span className="font-mono">{origemAtual || "(não configurada)"}</span>.
        {" "}Isso é gravado permanentemente nas placas geradas — para trocar depois, configure em Configurações antes
        de gerar o próximo lote.
      </p>
      {estado.erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{estado.erro}</p>}
      <BotaoEnviar className="w-full">Gerar lote</BotaoEnviar>
    </form>
  );
}
TAGSNFC_HEREDOC_EOF_9f3a1c

cat > "src/app/painel/(privado)/lotes/page.tsx" << 'TAGSNFC_HEREDOC_EOF_9f3a1c'
import Link from "next/link";
import { listarLotes } from "@/lib/db/repo/lotes";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { formatarDataHora } from "@/lib/tempo";

export default async function PaginaLotes() {
  const usuario = await obterUsuarioAtual();
  const lotes = await listarLotes();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Lotes</h1>
        {usuario?.papel === "ADMIN" && (
          <Link href="/painel/lotes/novo" className="botao-toque flex items-center rounded-lg bg-blue-600 px-3 text-sm font-medium text-white">
            + Novo lote
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[500px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Quantidade</th>
              <th className="px-3 py-2">Disponíveis</th>
              <th className="px-3 py-2">Ativas</th>
              <th className="px-3 py-2">Criado em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lotes.map((l: any) => (
              <tr key={l.id}>
                <td data-label="Código" className="px-3 py-2">
                  <Link href={`/painel/lotes/${l.id}`} className="font-medium text-blue-600">
                    {l.codigo}
                  </Link>
                </td>
                <td data-label="Quantidade" className="px-3 py-2">{l.quantidade}</td>
                <td data-label="Disponíveis" className="px-3 py-2">{l.disponiveis}</td>
                <td data-label="Ativas" className="px-3 py-2">{l.ativas}</td>
                <td data-label="Criado em" className="px-3 py-2">{formatarDataHora(l.criado_em)}</td>
              </tr>
            ))}
            {lotes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  Nenhum lote criado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
TAGSNFC_HEREDOC_EOF_9f3a1c

cat > "src/app/painel/(privado)/page.tsx" << 'TAGSNFC_HEREDOC_EOF_9f3a1c'
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { obterIndicadores } from "@/lib/db/repo/indicadores";
import { formatarBRL } from "@/lib/dinheiro";
import { limitesDoDiaEmSaoPaulo } from "@/lib/tempo";
import Link from "next/link";

function Cartao({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{valor}</p>
      {nota && <p className="mt-0.5 text-xs text-slate-400">{nota}</p>}
    </div>
  );
}

export default async function PaginaDashboard({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const usuario = await obterUsuarioAtual();
  const { dias: diasParam } = await searchParams;
  const dias = [7, 30, 90].includes(Number(diasParam)) ? Number(diasParam) : 30;

  const fim = new Date();
  const inicioBase = new Date(fim.getTime() - dias * 24 * 60 * 60 * 1000);
  const { inicio } = limitesDoDiaEmSaoPaulo(inicioBase);

  const escopoVendedor = usuario!.papel === "VENDEDOR" ? usuario!.id : undefined;
  const indicadores = await obterIndicadores({ inicio, fim, vendedorId: escopoVendedor });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Visão geral</h1>
        <div className="flex gap-2 text-sm">
          {[7, 30, 90].map((d) => (
            <Link
              key={d}
              href={`/painel?dias=${d}`}
              className={`rounded-full px-3 py-1 ${dias === d ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}
            >
              {d} dias
            </Link>
          ))}
        </div>
      </div>

      <section className="rounded-2xl bg-slate-900 p-6 text-white sm:p-8">
        <p className="text-xs uppercase tracking-widest text-blue-200">Operação TAGS NFC</p>
        <h2 className="mt-2 text-2xl font-semibold">Da produção à primeira avaliação.</h2>
        <p className="mt-2 max-w-xl text-sm text-slate-300">Acompanhe o estoque, organize seus clientes e ative cada unidade no momento da venda.</p>
        <div className="mt-6 flex flex-wrap gap-3"><Link href="/painel/ativar" className="botao-toque flex items-center rounded-xl bg-blue-600 px-5 font-medium">Ativar placa →</Link><Link href="/painel/lotes" className="botao-toque flex items-center rounded-xl border border-slate-600 px-5">Produção e downloads</Link><Link href="/painel/clientes/novo" className="botao-toque flex items-center px-3">Novo cliente</Link></div>
      </section>
      <section className="space-y-3">
        <h2 className="mb-2 text-sm font-medium text-slate-500">Placas</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Cartao titulo="Produzidas" valor={String(indicadores.placasProduzidas)} />
          <Cartao titulo="Disponíveis" valor={String(indicadores.placasDisponiveis)} />
          <Cartao titulo="Reservadas" valor={String(indicadores.placasReservadas)} />
          <Cartao titulo="Ativas" valor={String(indicadores.placasAtivas)} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-500">Comercial (período selecionado)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Cartao titulo="Clientes cadastrados" valor={String(indicadores.clientesCadastrados)} />
          <Cartao titulo="Vendas no período" valor={String(indicadores.vendasNoPeriodo)} />
          <Cartao titulo="Valor vendido" valor={formatarBRL(indicadores.valorVendidoCentavos)} />
          <Cartao titulo="Valor recebido" valor={formatarBRL(indicadores.valorRecebidoCentavos)} />
          <Cartao titulo="Valores pendentes" valor={formatarBRL(indicadores.valorPendenteCentavos)} nota="total em aberto, não só do período" />
          <Cartao titulo="Custos no período" valor={formatarBRL(indicadores.custosNoPeriodoCentavos)} />
          <Cartao
            titulo="Margem bruta estimada"
            valor={formatarBRL(indicadores.margemBrutaEstimadaCentavos)}
            nota="não é lucro líquido: não desconta impostos, frete ou outras despesas"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-500">Acessos públicos (período selecionado)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Cartao titulo="Acessos via QR" valor={String(indicadores.acessosQr)} />
          <Cartao titulo="Acessos via NFC" valor={String(indicadores.acessosNfc)} />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Acessos não são avaliações confirmadas — o sistema não consegue verificar se o cliente realmente publicou
          uma avaliação, apenas que o QR ou o NFC foi aberto. Bots, pré-visualizações e recarregamentos também podem
          contar como acesso.
        </p>
      </section>
    </div>
  );
}
TAGSNFC_HEREDOC_EOF_9f3a1c

cat > "src/app/painel/(privado)/placas/page.tsx" << 'TAGSNFC_HEREDOC_EOF_9f3a1c'
import Link from "next/link";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { podeVerTudo } from "@/lib/auth/autorizacao";
import { listarPlacas } from "@/lib/db/repo/placas";

export default async function PaginaPlacas({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const { q, estado } = await searchParams;
  const usuario = await obterUsuarioAtual();
  const placas = await listarPlacas({
    vendedorId: podeVerTudo(usuario!) ? undefined : usuario!.id,
    busca: q,
    estadoComercial: estado,
  });

  const ESTADOS = ["DISPONIVEL", "RESERVADA", "ATIVA", "DESATIVADA", "SUBSTITUIDA", "PERDIDA"];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Placas</h1>

      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Código, estabelecimento, telefone" className="botao-toque flex-1 min-w-[180px] rounded-lg border border-slate-300 px-3" />
        <select name="estado" defaultValue={estado ?? ""} className="botao-toque rounded-lg border border-slate-300 px-3">
          <option value="">Todos os estados</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <button className="botao-toque rounded-lg bg-slate-800 px-4 text-sm font-medium text-white">Filtrar</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Estabelecimento</th>
              <th className="px-3 py-2">Vendedor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {placas.map((p: any) => (
              <tr key={p.id}>
                <td data-label="Código" className="px-3 py-2">
                  <Link href={`/painel/placas/${p.id}`} className="font-medium text-blue-600">
                    {p.codigo}
                  </Link>
                </td>
                <td data-label="Estado" className="px-3 py-2">{p.estado_comercial}</td>
                <td data-label="Estabelecimento" className="px-3 py-2">{p.estabelecimento_nome ?? "—"}</td>
                <td data-label="Vendedor" className="px-3 py-2">{p.vendedor_nome ?? "—"}</td>
              </tr>
            ))}
            {placas.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                  Nenhuma placa encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
TAGSNFC_HEREDOC_EOF_9f3a1c

cat > "src/app/painel/(privado)/vendas/page.tsx" << 'TAGSNFC_HEREDOC_EOF_9f3a1c'
import Link from "next/link";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { podeVerTudo } from "@/lib/auth/autorizacao";
import { listarVendas } from "@/lib/db/repo/vendas";
import { formatarBRL } from "@/lib/dinheiro";
import { formatarDataHora } from "@/lib/tempo";

export default async function PaginaVendas() {
  const usuario = await obterUsuarioAtual();
  const vendas = await listarVendas({ vendedorId: podeVerTudo(usuario!) ? undefined : usuario!.id });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Vendas</h1>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Pago</th>
              <th className="px-3 py-2">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vendas.map((v: any) => (
              <tr key={v.id}>
                <td data-label="Data" className="px-3 py-2">
                  <Link href={`/painel/vendas/${v.id}`} className="text-blue-600">
                    {formatarDataHora(v.criado_em)}
                  </Link>
                </td>
                <td data-label="Cliente" className="px-3 py-2">{v.cliente_nome ?? "—"}</td>
                <td data-label="Tipo" className="px-3 py-2">{v.tipo}</td>
                <td data-label="Total" className="px-3 py-2">{formatarBRL(v.total_centavos)}</td>
                <td data-label="Pago" className="px-3 py-2">{formatarBRL(Number(v.pago_centavos))}</td>
                <td data-label="Situação" className="px-3 py-2">{v.situacao_pagamento}</td>
              </tr>
            ))}
            {vendas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                  Nenhuma venda registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
TAGSNFC_HEREDOC_EOF_9f3a1c

cat > "src/app/painel/(publico)/setup/page.tsx" << 'TAGSNFC_HEREDOC_EOF_9f3a1c'
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
TAGSNFC_HEREDOC_EOF_9f3a1c

cat > "src/components/painel/LinkNavegacao.tsx" << 'TAGSNFC_HEREDOC_EOF_9f3a1c'
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function LinkNavegacao({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const ativo = href === "/painel" ? pathname === href : pathname.startsWith(`${href}/`) || pathname === href;
  return <Link href={href} aria-current={ativo ? "page" : undefined} className={`flex min-h-12 items-center justify-center rounded-lg px-2 text-center text-xs sm:text-sm ${ativo ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}>{children}</Link>;
}
TAGSNFC_HEREDOC_EOF_9f3a1c

cat > "src/components/painel/NavPainel.tsx" << 'TAGSNFC_HEREDOC_EOF_9f3a1c'
import Link from "next/link";
import { LinkNavegacao } from "./LinkNavegacao";
import { sair } from "@/lib/actions/auth";
import type { UsuarioSessao } from "@/lib/auth/sessao";

const LINKS = [
  { href: "/painel", label: "Início" },
  { href: "/painel/placas", label: "Placas" },
  { href: "/painel/lotes", label: "Lotes" },
  { href: "/painel/clientes", label: "Clientes" },
  { href: "/painel/vendas", label: "Vendas" },
];

export function NavPainel({ usuario }: { usuario: UsuarioSessao }) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/painel" className="font-semibold text-slate-900">
            TAGS NFC
          </Link>
          <nav className="hidden gap-3 text-sm text-slate-600 lg:flex">
            {LINKS.map((l) => (
              <LinkNavegacao key={l.href} href={l.href}>{l.label}</LinkNavegacao>
            ))}
            {usuario.papel === "ADMIN" && (
              <Link href="/painel/configuracoes" className="hover:text-blue-600">
                Configurações
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-3">
            {usuario.papel === "ADMIN" && <Link href="/painel/configuracoes" className="botao-toque flex items-center text-xs text-slate-600 lg:hidden">Configurações</Link>}
            <Link
              href="/painel/ativar"
              className="botao-toque hidden items-center rounded-lg bg-blue-600 px-4 font-medium text-white hover:bg-blue-700 lg:inline-flex"
            >
              Ativar placa
            </Link>
            <span className="hidden text-sm text-slate-500 md:inline">{usuario.nome}</span>
            <form action={sair}>
              <button className="text-sm text-slate-500 hover:text-slate-800" type="submit">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Barra inferior fixa para celular: acesso rápido + botão de ativação em destaque. */}
      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-6 items-stretch border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom,0px)] lg:hidden">
        {LINKS.slice(0, 3).map((l) => (
          <LinkNavegacao key={l.href} href={l.href}>{l.label}</LinkNavegacao>
        ))}
        <Link
          href="/painel/ativar"
          className="botao-toque -mt-4 flex flex-1 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white shadow-lg"
        >
          Ativar
        </Link>
        {LINKS.slice(3).map((l) => (
          <LinkNavegacao key={l.href} href={l.href}>{l.label}</LinkNavegacao>
        ))}
      </nav>
    </>
  );
}
TAGSNFC_HEREDOC_EOF_9f3a1c

cat > "src/lib/pdf/cartao.ts" << 'TAGSNFC_HEREDOC_EOF_9f3a1c'
import type PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { mm } from "@/lib/pdf/mm";
import { desenharCincoEstrelas, desenharIconeNfc } from "@/lib/pdf/formas";

type Doc = InstanceType<typeof PDFDocument>;

export const TEMPLATE_VERSAO_ATUAL = "balcao-v2";

export interface ParametrosImpressao {
  tamanhoTrimMm: number; // 100
  sangriaMm: number; // 3 por padrão
  ladoQrMm: number; // ~30
  marcasDeCorte: boolean;
}

export function parametrosImpressaoPadrao(): ParametrosImpressao {
  return { tamanhoTrimMm: 100, sangriaMm: 3, ladoQrMm: 35, marcasDeCorte: true };
}

export interface DadosCartao {
  codigo: string;
  qrSvg: string;
  nomeOperacao?: string;
  marcaDagua?: string;
}

const COR_TEXTO = "#111318";
const COR_SECUNDARIA = "#4b5563";
const COR_ACENTO = "#1a73e8"; // azul Google

/**
 * Desenha um cartão completo (fundo + arte + QR) dentro do documento pdfkit,
 * com o canto superior-esquerdo da área de sangria em (origemXPt, origemYPt).
 * Todas as medidas de layout vêm de `parametros` (mm), convertidas para
 * pontos apenas no momento do desenho — reexportar um lote com os mesmos
 * parâmetros produz o mesmo arquivo (determinístico).
 */
export function desenharCartao(
  doc: Doc,
  origemXPt: number,
  origemYPt: number,
  parametros: ParametrosImpressao,
  dados: DadosCartao
) {
  const { tamanhoTrimMm, sangriaMm, ladoQrMm, marcasDeCorte } = parametros;
  const boxPt = mm(tamanhoTrimMm + 2 * sangriaMm);
  const trimX = origemXPt + mm(sangriaMm);
  const trimY = origemYPt + mm(sangriaMm);
  const trimPt = mm(tamanhoTrimMm);

  // Fundo cobre toda a sangria (evita borda branca indesejada após o corte).
  doc.rect(origemXPt, origemYPt, boxPt, boxPt).fill("#ffffff");

  const cx = trimX + trimPt / 2;

  // Cabeçalho com curva, em vetor; fundo azul cobre a sangria superior.
  doc.moveTo(origemXPt, trimY + mm(48))
    .bezierCurveTo(trimX + mm(40), trimY + mm(29), trimX + mm(68), trimY + mm(53), origemXPt + boxPt, trimY + mm(43))
    .lineTo(origemXPt + boxPt, origemYPt).lineTo(origemXPt, origemYPt).closePath().fill(COR_ACENTO);
  const google = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="white"/><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-1.9 4.6-4.1 6v5h6.6c3.9-3.6 6.1-8.7 6.1-14.7z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2C9.2 39.5 16.1 44 24 44z"/><path fill="#FBBC05" d="M12.6 27.7a12 12 0 0 1 0-7.4v-5.2H5.8a20 20 0 0 0 0 17.8z"/><path fill="#EA4335" d="M24 11.9c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6 29.5 4 24 4 16.1 4 9.2 8.5 5.8 15.1l6.8 5.2C14.2 15.5 18.7 11.9 24 11.9z"/></svg>';
  SVGtoPDF(doc, google, trimX + mm(7), trimY + mm(8), { width: mm(29), height: mm(29) });
  doc.font("Poppins-Medium").fontSize(19).fillColor("#ffffff")
    .text("Avalie-nos", trimX + mm(40), trimY + mm(8), { width: mm(56), align: "center" })
    .font("Poppins-Bold").fontSize(21)
    .text("no Google", trimX + mm(39), trimY + mm(19), { width: mm(58), align: "center" });
  desenharCincoEstrelas(doc, trimX + mm(68), trimY + mm(35), mm(2.7), mm(8));
  const colTopoY = trimY + mm(52);
  const colAlturaY = mm(36);
  const meioX = trimX + trimPt / 2;
  doc.font("Poppins-Bold").fontSize(11).fillColor(COR_TEXTO).text("ou", meioX - mm(4), trimY + mm(73), { width: mm(8), align: "center" });

  // --- Coluna esquerda: NFC ---
  const colEsqCx = trimX + trimPt * 0.25;
  doc
    .font("Poppins-Medium")
    .fontSize(9)
    .fillColor(COR_SECUNDARIA)
    .text("Aproxime seu celular", trimX + mm(3), colTopoY, {
      width: trimPt / 2 - mm(6),
      align: "center",
    });
  desenharIconeNfc(doc, colEsqCx, trimY + mm(77), mm(1.3), COR_ACENTO);

  // --- Coluna direita: QR ---
  const colDirX = meioX;
  doc
    .font("Poppins-Medium")
    .fontSize(9)
    .fillColor(COR_SECUNDARIA)
    .text("Escaneie o QR Code", colDirX + mm(3), colTopoY, {
      width: trimPt / 2 - mm(6),
      align: "center",
    });

  const qrLadoPt = mm(ladoQrMm);
  const qrX = colDirX + (trimPt / 2 - qrLadoPt) / 2;
  const qrY = trimY + mm(60);
  // Fundo branco atrás do QR garante contraste mesmo se o fundo do cartão mudar no futuro.
  doc.rect(qrX, qrY, qrLadoPt, qrLadoPt).fill("#ffffff");
  SVGtoPDF(doc, dados.qrSvg, qrX, qrY, { width: qrLadoPt, height: qrLadoPt, preserveAspectRatio: "xMidYMid meet" });

  // Rodapé: código humano da placa (referência interna, não é senha nem URL)
  doc
    .font("Poppins-Regular")
    .fontSize(7)
    .fillColor("#9ca3af")
    .text(dados.codigo, trimX, trimY + trimPt - mm(3), { width: trimPt - mm(6), align: "right" });

  if (dados.nomeOperacao) {
    doc
      .font("Poppins-Regular")
      .fontSize(7)
      .fillColor("#9ca3af")
      .text(dados.nomeOperacao, trimX + mm(3), trimY + trimPt - mm(7), {
        width: trimPt / 2,
        align: "left",
      });
  }

  if (dados.marcaDagua) {
    doc.save();
    doc.rotate(-30, { origin: [cx, trimY + trimPt / 2] });
    doc
      .font("Poppins-Bold")
      .fontSize(13)
      .fillOpacity(0.28)
      .fillColor("#dc2626")
      .text(dados.marcaDagua, trimX - mm(20), trimY + trimPt / 2 - mm(5), {
        width: trimPt + mm(40),
        align: "center",
      });
    doc.fillOpacity(1);
    doc.restore();
  }

  if (marcasDeCorte && sangriaMm > 0) {
    const comprimento = Math.min(mm(sangriaMm) * 0.9, mm(4));
    doc.save().lineWidth(0.35).strokeColor("#000000");
    for (const [x, y, dx, dy] of [[trimX, trimY, -1, -1], [trimX + trimPt, trimY, 1, -1], [trimX, trimY + trimPt, -1, 1], [trimX + trimPt, trimY + trimPt, 1, 1]]) {
      doc.moveTo(x + dx * mm(0.5), y).lineTo(x + dx * comprimento, y).stroke();
      doc.moveTo(x, y + dy * mm(0.5)).lineTo(x, y + dy * comprimento).stroke();
    }
    doc.restore();
  }
}

export function ladoCaixaMm(parametros: ParametrosImpressao): number {
  return parametros.tamanhoTrimMm + 2 * parametros.sangriaMm;
}
TAGSNFC_HEREDOC_EOF_9f3a1c

cat > "tests/impressao.test.ts" << 'TAGSNFC_HEREDOC_EOF_9f3a1c'
import { test } from "node:test";
import assert from "node:assert/strict";
import { gerarPdfCartaoIndividual, gerarPdfMultipagina, gerarPdfImposicaoA4 } from "@/lib/pdf/exportar";
import { parametrosImpressaoPadrao } from "@/lib/pdf/cartao";

const placas = Array.from({ length: 30 }, (_, i) => ({ codigo: `PL-${String(i + 1).padStart(6, "0")}`, urlQr: `https://example.com/p/unidade-${i}?via=qr` }));

test("lote de 30 unidades exporta 30 páginas de 106 mm", async () => {
  const pdf = (await gerarPdfMultipagina(placas, parametrosImpressaoPadrao())).toString("latin1");
  assert.equal((pdf.match(/\/Type \/Page\b/g) ?? []).length, 30);
  const caixas = [...pdf.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)];
  assert.equal(caixas.length, 30);
  for (const caixa of caixas) {
    assert.ok(Math.abs(Number(caixa[1]) * 25.4 / 72 - 106) < 0.001);
    assert.equal(caixa[1], caixa[2]);
  }
});

test("PDF individual mantém uma página e imposição A4 não reduz as placas", async () => {
  const parametros = parametrosImpressaoPadrao();
  const individual = (await gerarPdfCartaoIndividual(placas[0], parametros)).toString("latin1");
  assert.equal((individual.match(/\/Type \/Page\b/g) ?? []).length, 1);
  const a4 = await gerarPdfImposicaoA4(placas, parametros);
  assert.equal(a4.porFolha, 2);
  assert.equal(a4.totalFolhas, 15);
  assert.equal((a4.buffer.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length, 15);
});
TAGSNFC_HEREDOC_EOF_9f3a1c

echo "Arquivos escritos. Preparando commit..."
rm -f -- "$0" 2>/dev/null || true
git add -A
git commit -m "Atualiza painel, ativacao, exportacao e testes de impressao"
git push
echo "Concluido! Push enviado para o GitHub."
