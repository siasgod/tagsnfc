import { pool } from "@/lib/db/pool";
import { createHash } from "node:crypto";

export type CanalAcesso = "QR" | "NFC" | "DESCONHECIDO";

/**
 * Registro de acesso "best-effort": a rota pública aguarda a tentativa de
 * persistência antes de responder, mas uma falha aqui jamais deve impedir o
 * redirecionamento (ver src/app/p/[token]/route.ts).
 * IP é hasheado (nunca guardado em texto claro) para reduzir dado pessoal
 * retido, mantendo a possibilidade de detectar repetições grosseiras.
 */
export async function registrarEventoAcesso(dados: {
  placaId: string;
  estabelecimentoId: string | null;
  canal: CanalAcesso;
  ip: string | null;
  userAgent: string | null;
  ehTeste?: boolean;
}) {
  const ipHash = dados.ip ? createHash("sha256").update(dados.ip).digest("hex").slice(0, 32) : null;
  const uaResumo = resumirUserAgent(dados.userAgent);
  await pool.query(
    `INSERT INTO eventos_acesso (placa_id, estabelecimento_id, canal, ip_hash, user_agent_resumo, eh_teste)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [dados.placaId, dados.estabelecimentoId, dados.canal, ipHash, uaResumo, dados.ehTeste ?? false]
  );
}

function resumirUserAgent(ua: string | null): string {
  if (!ua) return "desconhecido";
  const u = ua.toLowerCase();
  if (u.includes("bot") || u.includes("crawler") || u.includes("preview")) return "bot_ou_preview";
  if (u.includes("iphone")) return "iphone";
  if (u.includes("android")) return "android";
  return "outro";
}

export async function contarEventosPorPeriodo(inicio: Date, fim: Date, vendedorId?: string) {
  const params: unknown[] = [inicio, fim];
  let filtroVendedor = "";
  if (vendedorId) {
    params.push(vendedorId);
    filtroVendedor = `AND p.vendedor_atribuido_id = $${params.length}`;
  }
  const { rows } = await pool.query<{ canal: string; total: string }>(
    `SELECT ev.canal, count(*)::text AS total
     FROM eventos_acesso ev
     JOIN placas p ON p.id = ev.placa_id
     WHERE ev.data_hora BETWEEN $1 AND $2 AND ev.eh_teste = false ${filtroVendedor}
     GROUP BY ev.canal`,
    params
  );
  return rows;
}

export async function listarEventosPorDia(dias: number, vendedorId?: string) {
  const params: unknown[] = [dias];
  let filtroVendedor = "";
  if (vendedorId) {
    params.push(vendedorId);
    filtroVendedor = `AND p.vendedor_atribuido_id = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT date_trunc('day', ev.data_hora AT TIME ZONE 'America/Sao_Paulo') AS dia, count(*)::int AS total
     FROM eventos_acesso ev
     JOIN placas p ON p.id = ev.placa_id
     WHERE ev.data_hora > now() - ($1 || ' days')::interval AND ev.eh_teste = false ${filtroVendedor}
     GROUP BY 1 ORDER BY 1`,
    params
  );
  return rows;
}

export async function listarUltimasInteracoes(limite = 12, vendedorId?: string) {
  const params: unknown[] = [limite];
  let escopo = "";
  if (vendedorId) {
    params.push(vendedorId);
    escopo = `AND c.vendedor_responsavel_id = $${params.length}`;
  }
  const { rows } = await pool.query<{
    id: string;
    data_hora: Date;
    canal: CanalAcesso;
    placa_id: string;
    placa_codigo: string;
    estabelecimento_nome: string | null;
    cliente_id: string | null;
    cliente_nome: string | null;
  }>(
    `SELECT ev.id, ev.data_hora, ev.canal, p.id AS placa_id, p.codigo AS placa_codigo,
            e.nome AS estabelecimento_nome, c.id AS cliente_id, c.nome AS cliente_nome
     FROM eventos_acesso ev
     JOIN placas p ON p.id = ev.placa_id
     LEFT JOIN estabelecimentos e ON e.id = ev.estabelecimento_id
     LEFT JOIN clientes c ON c.id = e.cliente_id
     WHERE ev.eh_teste = false ${escopo}
     ORDER BY ev.data_hora DESC LIMIT $1`,
    params
  );
  return rows;
}
