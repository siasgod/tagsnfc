/**
 * Criação do primeiro administrador via linha de comando (alternativa ao
 * fluxo /painel/setup baseado em SETUP_TOKEN — útil para automação/CI ou
 * quando o operador tem acesso direto ao servidor/banco).
 *
 * Uso: npm run db:criar-admin -- "Nome Completo" email@exemplo.com "SenhaForte123"
 */
import "dotenv/config";
import { contarUsuarios, criarUsuario, buscarUsuarioPorEmail } from "@/lib/db/repo/usuarios";
import { gerarHashSenha, senhaEhForte } from "@/lib/auth/senha";
import { pool } from "@/lib/db/pool";

async function main() {
  const [nome, email, senha] = process.argv.slice(2);
  if (!nome || !email || !senha) {
    console.error('Uso: npm run db:criar-admin -- "Nome Completo" email@exemplo.com "SenhaForte123"');
    process.exit(1);
  }

  const forca = senhaEhForte(senha);
  if (!forca.ok) {
    console.error(`Senha fraca: ${forca.motivo}`);
    process.exit(1);
  }

  const existente = await buscarUsuarioPorEmail(email);
  if (existente) {
    console.error(`Já existe um usuário com o e-mail ${email}.`);
    process.exit(1);
  }

  const total = await contarUsuarios();
  const usuario = await criarUsuario({ nome, email, senhaHash: await gerarHashSenha(senha), papel: "ADMIN" });
  console.log(`Administrador criado: ${usuario.email} (id ${usuario.id}).`);
  if (total > 0) {
    console.log("Aviso: já existiam outros usuários no banco — este é um admin adicional, não o primeiro.");
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
