import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "@/lib/db/pool";
import { criarUsuario } from "@/lib/db/repo/usuarios";
import { gerarHashSenha } from "@/lib/auth/senha";
import { criarLoteComPlacas } from "@/lib/db/repo/lotes";
import { criarCliente } from "@/lib/db/repo/clientes";
import { criarEstabelecimento } from "@/lib/db/repo/estabelecimentos";
import { ativarPlaca, ErroAtivacao, substituirPlaca, novaChaveIdempotencia } from "@/lib/db/repo/ativacao";
import { registrarPagamento } from "@/lib/db/repo/vendas";
import { parametrosImpressaoPadrao, TEMPLATE_VERSAO_ATUAL } from "@/lib/pdf/cartao";
import { listarHistoricoDaPlaca } from "@/lib/db/repo/historico";

const sufixo = Date.now().toString(36);

async function criarCenario(qtdPlacas: number) {
  const vendedor = await criarUsuario({
    nome: `Teste Vendedor ${sufixo}`,
    email: `vendedor-${sufixo}-${Math.random().toString(36).slice(2)}@teste.local`,
    senhaHash: await gerarHashSenha("SenhaForte123"),
    papel: "VENDEDOR",
  });
  const cliente = await criarCliente({ nome: `Cliente Teste ${sufixo}`, vendedorResponsavelId: vendedor.id });
  const estabelecimento = await criarEstabelecimento({ clienteId: cliente.id, nome: `Loja Teste ${sufixo}` });
  const { placas } = await criarLoteComPlacas({
    quantidade: qtdPlacas,
    origemPublica: "http://localhost:3000",
    templateVersao: TEMPLATE_VERSAO_ATUAL,
    parametrosImpressao: { ...parametrosImpressaoPadrao() },
    criadoPorId: vendedor.id,
  });
  return { vendedor, cliente, estabelecimento, placas };
}

test("ativação bem-sucedida persiste cliente, destino e venda", async () => {
  const { vendedor, cliente, estabelecimento, placas } = await criarCenario(1);
  const { placa, venda } = await ativarPlaca({
    identificadorPlaca: placas[0].codigo,
    usuarioId: vendedor.id,
    usuarioNome: vendedor.nome,
    clienteId: cliente.id,
    estabelecimentoId: estabelecimento.id,
    destinoUrl: "https://g.page/r/CTESTE000000000000000/review",
    destinoConfirmado: true,
    venda: { tipo: "VENDA", precoCentavos: 5000, custoCentavos: 343 },
    chaveIdempotencia: novaChaveIdempotencia(),
  });

  assert.equal(placa.estado_comercial, "ATIVA");
  assert.equal(placa.estabelecimento_id, estabelecimento.id);
  assert.ok(venda?.venda);
  assert.equal(venda!.venda.total_centavos, 5000);
});

test("impede ativação de placa já ativa (dupla ativação sequencial)", async () => {
  const { vendedor, cliente, estabelecimento, placas } = await criarCenario(1);
  const entrada = {
    identificadorPlaca: placas[0].codigo,
    usuarioId: vendedor.id,
    usuarioNome: vendedor.nome,
    clienteId: cliente.id,
    estabelecimentoId: estabelecimento.id,
    destinoUrl: "https://g.page/r/CTESTE000000000000001/review",
    destinoConfirmado: true,
    chaveIdempotencia: novaChaveIdempotencia(),
  };
  await ativarPlaca(entrada);
  await assert.rejects(() => ativarPlaca({ ...entrada, chaveIdempotencia: novaChaveIdempotencia() }), (err: unknown) => {
    assert.ok(err instanceof ErroAtivacao);
    assert.equal((err as ErroAtivacao).codigo, "ja_ativa");
    return true;
  });
});

test("impede ativação concorrente da mesma placa (duas requisições simultâneas)", async () => {
  const { vendedor, cliente, estabelecimento, placas } = await criarCenario(1);
  const base = {
    identificadorPlaca: placas[0].codigo,
    usuarioId: vendedor.id,
    usuarioNome: vendedor.nome,
    clienteId: cliente.id,
    estabelecimentoId: estabelecimento.id,
    destinoUrl: "https://g.page/r/CTESTE000000000000002/review",
    destinoConfirmado: true,
  };

  const resultados = await Promise.allSettled([
    ativarPlaca({ ...base, chaveIdempotencia: novaChaveIdempotencia() }),
    ativarPlaca({ ...base, chaveIdempotencia: novaChaveIdempotencia() }),
  ]);

  const sucesso = resultados.filter((r) => r.status === "fulfilled");
  const falha = resultados.filter((r) => r.status === "rejected");
  assert.equal(sucesso.length, 1, "exatamente uma das duas ativações concorrentes deve ter sucesso");
  assert.equal(falha.length, 1, "a outra deve ser rejeitada");
});

test("venda com mesma chave de idempotência não duplica (proteção contra duplo toque)", async () => {
  const { vendedor, cliente, estabelecimento, placas } = await criarCenario(1);
  const chave = novaChaveIdempotencia();
  const entrada = {
    identificadorPlaca: placas[0].codigo,
    usuarioId: vendedor.id,
    usuarioNome: vendedor.nome,
    clienteId: cliente.id,
    estabelecimentoId: estabelecimento.id,
    destinoUrl: "https://g.page/r/CTESTE000000000000003/review",
    destinoConfirmado: true,
    venda: { tipo: "VENDA" as const, precoCentavos: 3000, custoCentavos: 343 },
    chaveIdempotencia: chave,
  };

  await ativarPlaca(entrada);

  // Segunda tentativa falha por "já ativa" antes de chegar na venda — o teste
  // relevante de idempotência de venda é feito diretamente no repositório:
  const { criarVendaComItens } = await import("@/lib/db/repo/vendas");
  const r1 = await criarVendaComItens({
    clienteId: cliente.id,
    vendedorId: vendedor.id,
    tipo: "VENDA",
    itens: [{ placaId: placas[0].id, precoCentavos: 1000, custoCentavos: 100 }],
    chaveIdempotencia: "chave-fixa-teste-" + sufixo,
  });
  const r2 = await criarVendaComItens({
    clienteId: cliente.id,
    vendedorId: vendedor.id,
    tipo: "VENDA",
    itens: [{ placaId: placas[0].id, precoCentavos: 1000, custoCentavos: 100 }],
    chaveIdempotencia: "chave-fixa-teste-" + sufixo,
  });
  assert.equal(r1.venda.id, r2.venda.id);
  assert.equal(r2.duplicada, true);
});

test("pagamento parcial calcula situação corretamente e substituição preserva histórico", async () => {
  const { vendedor, cliente, estabelecimento, placas } = await criarCenario(2);
  const { venda } = await ativarPlaca({
    identificadorPlaca: placas[0].codigo,
    usuarioId: vendedor.id,
    usuarioNome: vendedor.nome,
    clienteId: cliente.id,
    estabelecimentoId: estabelecimento.id,
    destinoUrl: "https://g.page/r/CTESTE000000000000004/review",
    destinoConfirmado: true,
    venda: { tipo: "VENDA", precoCentavos: 10000, custoCentavos: 343 },
    chaveIdempotencia: novaChaveIdempotencia(),
  });

  const parcial = await registrarPagamento({
    vendaId: venda!.venda.id,
    forma: "PIX",
    valorCentavos: 4000,
    usuarioId: vendedor.id,
  });
  assert.equal(parcial.situacao, "PARCIAL");

  const quitado = await registrarPagamento({
    vendaId: venda!.venda.id,
    forma: "DINHEIRO",
    valorCentavos: 6000,
    usuarioId: vendedor.id,
  });
  assert.equal(quitado.situacao, "QUITADA");

  // Substituição de placa preserva histórico de ambas
  await substituirPlaca({
    placaAntigaId: placas[0].id,
    placaNovaId: placas[1].id,
    usuarioId: vendedor.id,
    motivo: "Placa danificada em teste automatizado",
  });

  const { rows: antigaRows } = await pool.query("SELECT * FROM placas WHERE id = $1", [placas[0].id]);
  const { rows: novaRows } = await pool.query("SELECT * FROM placas WHERE id = $1", [placas[1].id]);
  assert.equal(antigaRows[0].estado_comercial, "SUBSTITUIDA");
  assert.equal(antigaRows[0].substituida_por_id, placas[1].id);
  assert.equal(novaRows[0].estado_comercial, "ATIVA");
  assert.equal(novaRows[0].estabelecimento_id, estabelecimento.id);

  const historicoAntiga = await listarHistoricoDaPlaca(placas[0].id);
  const historicoNova = await listarHistoricoDaPlaca(placas[1].id);
  assert.ok(historicoAntiga.some((h: any) => h.tipo === "SUBSTITUICAO"));
  assert.ok(historicoNova.some((h: any) => h.tipo === "SUBSTITUICAO"));
});

after(async () => {
  await pool.end();
});
