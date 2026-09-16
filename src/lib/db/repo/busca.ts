import "server-only";
import { pool } from "@/lib/db/pool";

export interface ResultadoBusca {
  id: string;
  tipo: "CLIENTE" | "ESTABELECIMENTO" | "PLACA";
  titulo: string;
  subtitulo: string | null;
  href: string;
}

export async function buscaGlobal(termo: string, vendedorId?: string): Promise<ResultadoBusca[]> {
  const q = `%${termo.trim()}%`;
  const params: unknown[] = [q];
  let escopoCliente = "";
  let escopoPlaca = "";
  if (vendedorId) {
    params.push(vendedorId);
    escopoCliente = `AND c.vendedor_responsavel_id = $${params.length}`;
    escopoPlaca = `AND (p.vendedor_atribuido_id = $${params.length} OR c.vendedor_responsavel_id = $${params.length})`;
  }

  const { rows } = await pool.query<ResultadoBusca>(
    `(SELECT c.id, 'CLIENTE'::text AS tipo, c.nome AS titulo,
             coalesce(c.telefone, c.email) AS subtitulo,
             '/painel/clientes/' || c.id::text AS href
      FROM clientes c
      WHERE c.arquivado_em IS NULL AND (c.nome ILIKE $1 OR c.telefone ILIKE $1 OR c.email ILIKE $1) ${escopoCliente}
      LIMIT 8)
     UNION ALL
     (SELECT e.id, 'ESTABELECIMENTO'::text AS tipo, e.nome AS titulo,
             c.nome AS subtitulo,
             '/painel/clientes/' || c.id::text AS href
      FROM estabelecimentos e
      JOIN clientes c ON c.id = e.cliente_id
      WHERE e.arquivado_em IS NULL AND (e.nome ILIKE $1 OR e.endereco ILIKE $1) ${escopoCliente}
      LIMIT 8)
     UNION ALL
     (SELECT p.id, 'PLACA'::text AS tipo, p.codigo AS titulo,
             coalesce(e.nome, p.estado_comercial::text) AS subtitulo,
             '/painel/placas/' || p.id::text AS href
      FROM placas p
      LEFT JOIN estabelecimentos e ON e.id = p.estabelecimento_id
      LEFT JOIN clientes c ON c.id = e.cliente_id
      WHERE (p.codigo ILIKE $1 OR p.token ILIKE $1 OR e.nome ILIKE $1) ${escopoPlaca}
      LIMIT 8)
     ORDER BY tipo, titulo`,
    params
  );
  return rows;
}
