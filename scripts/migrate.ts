/**
 * Executor de migrações SQL simples e idempotente.
 *
 * Por que não usamos o CLI do Prisma: o ambiente de desenvolvimento usado para
 * construir este projeto bloqueia o download dos binários de engine do Prisma
 * (hospedados em binaries.prisma.sh), tornando `prisma migrate` inutilizável
 * ali. Em vez de depender de um binário externo, aplicamos migrações SQL puras
 * com node-postgres, o que funciona em qualquer ambiente (local, CI, Vercel,
 * Supabase) sem downloads adicionais.
 *
 * Uso:
 *   npm run db:migrate
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL não configurada (.env).");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        nome text PRIMARY KEY,
        aplicada_em timestamptz NOT NULL DEFAULT now()
      );
    `);

    const arquivos = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const { rows: aplicadas } = await client.query<{ nome: string }>(
      "SELECT nome FROM _migrations"
    );
    const jaAplicadas = new Set(aplicadas.map((r) => r.nome));

    for (const arquivo of arquivos) {
      if (jaAplicadas.has(arquivo)) {
        console.log(`[skip] ${arquivo} (já aplicada)`);
        continue;
      }
      const sql = readFileSync(path.join(MIGRATIONS_DIR, arquivo), "utf-8");
      console.log(`[apply] ${arquivo}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _migrations (nome) VALUES ($1)", [arquivo]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Falha ao aplicar ${arquivo}: ${(err as Error).message}`);
      }
    }

    console.log("Migrações em dia.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
