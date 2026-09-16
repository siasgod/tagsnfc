import "server-only";
import { pool } from "@/lib/db/pool";

export interface FiltrosDesempenho {
  inicio: Date;
  fim: Date;
  vendedorId?: string;
  responsavelId?: string;
  categoriaId?: string;
}

function filtrosSql(filtro: FiltrosDesempenho) {
  const params: unknown[] = [filtro.inicio, filtro.fim];
  const condicoes = ["ev.data_hora BETWEEN $1 AND $2", "ev.eh_teste = false"];
  const responsavel = filtro.vendedorId ?? filtro.responsavelId;
  if (responsavel) {
    params.push(responsavel);
    condicoes.push(`c.vendedor_responsavel_id = $${params.length}`);
  }
  if (filtro.categoriaId) {
    params.push(filtro.categoriaId);
    condicoes.push(`c.categoria_id = $${params.length}`);
  }
  return { params, where: condicoes.join(" AND ") };
}

export async function obterDesempenho(filtro: FiltrosDesempenho) {
  const { params, where } = filtrosSql(filtro);
  const base = `FROM eventos_acesso ev
    JOIN placas p ON p.id = ev.placa_id
    LEFT JOIN estabelecimentos e ON e.id = ev.estabelecimento_id
    LEFT JOIN clientes c ON c.id = e.cliente_id
    WHERE ${where}`;

  const [totais, clientes, placas, serie] = await Promise.all([
    pool.query<{ total: number; qr: number; nfc: number }>(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE ev.canal = 'QR')::int AS qr,
              count(*) FILTER (WHERE ev.canal = 'NFC')::int AS nfc ${base}`,
      params
    ),
    pool.query<{ id: string; nome: string; total: number; qr: number; nfc: number }>(
      `SELECT c.id, coalesce(c.nome, 'Sem cliente') AS nome, count(*)::int AS total,
              count(*) FILTER (WHERE ev.canal = 'QR')::int AS qr,
              count(*) FILTER (WHERE ev.canal = 'NFC')::int AS nfc ${base}
       GROUP BY c.id, c.nome ORDER BY total DESC LIMIT 8`,
      params
    ),
    pool.query<{ id: string; codigo: string; cliente_nome: string | null; total: number; qr: number; nfc: number }>(
      `SELECT p.id, p.codigo, c.nome AS cliente_nome, count(*)::int AS total,
              count(*) FILTER (WHERE ev.canal = 'QR')::int AS qr,
              count(*) FILTER (WHERE ev.canal = 'NFC')::int AS nfc ${base}
       GROUP BY p.id, p.codigo, c.nome ORDER BY total DESC LIMIT 8`,
      params
    ),
    pool.query<{ dia: Date; total: number; qr: number; nfc: number }>(
      `SELECT date_trunc('day', ev.data_hora AT TIME ZONE 'America/Sao_Paulo') AS dia,
              count(*)::int AS total,
              count(*) FILTER (WHERE ev.canal = 'QR')::int AS qr,
              count(*) FILTER (WHERE ev.canal = 'NFC')::int AS nfc ${base}
       GROUP BY 1 ORDER BY 1`,
      params
    ),
  ]);

  return {
    totais: totais.rows[0] ?? { total: 0, qr: 0, nfc: 0 },
    clientes: clientes.rows,
    placas: placas.rows,
    serie: serie.rows,
  };
}

export async function contarInteracoesDesde(inicio: Date, vendedorId?: string) {
  const params: unknown[] = [inicio];
  let escopo = "";
  if (vendedorId) {
    params.push(vendedorId);
    escopo = `AND c.vendedor_responsavel_id = $${params.length}`;
  }
  const { rows } = await pool.query<{ total: number }>(
    `SELECT count(*)::int AS total FROM eventos_acesso ev
     JOIN placas p ON p.id = ev.placa_id
     LEFT JOIN estabelecimentos e ON e.id = ev.estabelecimento_id
     LEFT JOIN clientes c ON c.id = e.cliente_id
     WHERE ev.data_hora >= $1 AND ev.eh_teste = false ${escopo}`,
    params
  );
  return rows[0]?.total ?? 0;
}
