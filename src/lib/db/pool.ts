import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * Pool de conexões Postgres compartilhado.
 *
 * Em desenvolvimento, o Next.js recarrega módulos a cada mudança; guardamos o
 * pool em `globalThis` para não abrir uma nova conexão a cada hot-reload.
 */
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function criarPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL não configurada.");
  }
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
}

export const pool = globalThis.__pgPool ?? criarPool();
if (process.env.NODE_ENV !== "production") {
  globalThis.__pgPool = pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  return pool.query<T>(text, params);
}

/**
 * Executa uma função dentro de uma transação. Faz ROLLBACK automático em caso
 * de erro. Usado para operações que precisam de atomicidade real (ativação de
 * placa, registro de venda), conforme exigido pela especificação.
 */
export async function transacao<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const resultado = await fn(client);
    await client.query("COMMIT");
    return resultado;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
