"use client";

import { useRef, useState } from "react";
import { LeitorQr } from "@/components/ativacao/LeitorQr";

type Etapa = "buscar" | "situacao" | "cliente" | "estabelecimento" | "destino" | "venda" | "revisao" | "sucesso";

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
    const resp = await fetch(`/api/clientes/busca?q=${encodeURIComponent(q)}`);
    if (resp.ok) setResultadosClientes(await resp.json());
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
      setEtapa("venda");
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

  if (etapa === "buscar") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Escaneie o QR da placa ou digite o código.</p>
        <LeitorQr onDetectado={buscarPlaca} />
        {carregando && <p className="text-sm text-slate-500">Buscando…</p>}
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      </div>
    );
  }

  if (!placa) return null;

  if (etapa === "situacao") {
    const jaAtiva = placa.estadoComercial === "ATIVA";
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Placa</p>
          <p className="text-lg font-semibold">{placa.codigo}</p>
          <p className="mt-1 text-sm">
            Situação: <span className="font-medium">{placa.estadoComercial}</span>
          </p>
        </div>
        {jaAtiva ? (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Esta placa já está ativa. Para trocar o vínculo ou destino, acesse a página da placa em
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
        <h2 className="font-medium">Cliente</h2>
        {!criandoNovoCliente ? (
          <>
            <input
              value={buscaCliente}
              onChange={(e) => buscarClientes(e.target.value)}
              placeholder="Buscar por nome ou telefone"
              className="botao-toque w-full rounded-lg border border-slate-300 px-3"
            />
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              {resultadosClientes.map((c) => (
                <li key={c.id}>
                  <button
                    className="w-full px-3 py-2 text-left hover:bg-slate-50"
                    onClick={() => {
                      setClienteEscolhido(c);
                      setEtapa("estabelecimento");
                    }}
                  >
                    <p className="font-medium">{c.nome}</p>
                    <p className="text-xs text-slate-500">{c.telefone ?? "sem telefone"}</p>
                  </button>
                </li>
              ))}
            </ul>
            <button className="text-sm text-blue-600 underline" onClick={() => setCriandoNovoCliente(true)}>
              + Cadastrar novo cliente
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <input
              value={novoClienteNome}
              onChange={(e) => setNovoClienteNome(e.target.value)}
              placeholder="Nome do cliente/comércio"
              className="botao-toque w-full rounded-lg border border-slate-300 px-3"
            />
            <input
              value={novoClienteTelefone}
              onChange={(e) => setNovoClienteTelefone(e.target.value)}
              placeholder="Telefone/WhatsApp"
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
              placeholder="Nome do estabelecimento"
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
        <h2 className="font-medium">Link de avaliação do Google</h2>
        <input
          value={destinoUrl}
          onChange={(e) => setDestinoUrl(e.target.value)}
          placeholder="https://g.page/r/.../review"
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
              ? setEtapa("venda")
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
            placeholder="Justificativa (obrigatória)"
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
