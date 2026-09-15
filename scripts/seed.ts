/**
 * Dados de demonstração — sempre prefixados com "[DEMO]" para ficarem
 * claramente separados de dados reais de produção, conforme exigido. Seguro
 * de rodar em ambiente de desenvolvimento; não deve ser usado em produção.
 */
import "dotenv/config";
import { buscarUsuarioPorEmail, criarUsuario } from "@/lib/db/repo/usuarios";
import { gerarHashSenha } from "@/lib/auth/senha";
import { criarLoteComPlacas } from "@/lib/db/repo/lotes";
import { criarCliente } from "@/lib/db/repo/clientes";
import { criarEstabelecimento } from "@/lib/db/repo/estabelecimentos";
import { ativarPlaca, novaChaveIdempotencia } from "@/lib/db/repo/ativacao";
import { registrarPagamento } from "@/lib/db/repo/vendas";
import { parametrosImpressaoPadrao, TEMPLATE_VERSAO_ATUAL } from "@/lib/pdf/cartao";
import { origemAtualConfigurada } from "@/lib/origem-publica";
import { pool } from "@/lib/db/pool";

async function main() {
  console.log("Semeando dados de demonstração...\n");

  let admin = await buscarUsuarioPorEmail("demo.admin@exemplo.com");
  if (!admin) {
    admin = await criarUsuario({
      nome: "[DEMO] Administrador",
      email: "demo.admin@exemplo.com",
      senhaHash: await gerarHashSenha("DemoSenha123"),
      papel: "ADMIN",
    });
    console.log(`Admin demo criado: ${admin.email} / senha: DemoSenha123`);
  } else {
    console.log(`Admin demo já existia: ${admin.email}`);
  }

  let vendedor = await buscarUsuarioPorEmail("demo.vendedor@exemplo.com");
  if (!vendedor) {
    vendedor = await criarUsuario({
      nome: "[DEMO] Vendedor de Campo",
      email: "demo.vendedor@exemplo.com",
      senhaHash: await gerarHashSenha("DemoSenha123"),
      papel: "VENDEDOR",
    });
    console.log(`Vendedor demo criado: ${vendedor.email} / senha: DemoSenha123`);
  } else {
    console.log(`Vendedor demo já existia: ${vendedor.email}`);
  }

  const cliente = await criarCliente({
    nome: "[DEMO] Padaria Modelo",
    telefone: "+55 71 90000-0000",
    responsavel: "Fulano de Tal",
    vendedorResponsavelId: vendedor.id,
  });

  const estabelecimento = await criarEstabelecimento({
    clienteId: cliente.id,
    nome: "[DEMO] Padaria Modelo — Loja Centro",
    endereco: "Rua Exemplo, 123 — Lauro de Freitas/BA",
    linkAvaliacao: "https://g.page/r/CQAAAAAAAAAAAAAAAAAAAAA/review",
  });

  const origemPublica = origemAtualConfigurada() || "http://localhost:3000";
  const { lote, placas } = await criarLoteComPlacas({
    quantidade: 3,
    origemPublica,
    templateVersao: TEMPLATE_VERSAO_ATUAL,
    parametrosImpressao: { ...parametrosImpressaoPadrao() },
    criadoPorId: admin.id,
    observacoes: "Lote de demonstração gerado por scripts/seed.ts",
  });
  console.log(`Lote demo criado: ${lote.codigo} (${placas.length} placas)`);

  const { placa, venda } = await ativarPlaca({
    identificadorPlaca: placas[0].codigo,
    usuarioId: vendedor.id,
    usuarioNome: vendedor.nome,
    clienteId: cliente.id,
    estabelecimentoId: estabelecimento.id,
    destinoUrl: estabelecimento.link_avaliacao!,
    destinoConfirmado: true,
    venda: { tipo: "VENDA", precoCentavos: 8990, custoCentavos: 343 },
    chaveIdempotencia: novaChaveIdempotencia(),
  });
  console.log(`Placa demo ativada: ${placa.codigo}`);

  if (venda?.venda) {
    await registrarPagamento({
      vendaId: venda.venda.id,
      forma: "PIX",
      valorCentavos: 5000,
      observacoes: "Pagamento parcial de demonstração",
      usuarioId: vendedor.id,
    });
    console.log("Pagamento parcial de demonstração registrado (situação deve ficar PARCIAL).");
  }

  console.log("\nSeed concluído.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
