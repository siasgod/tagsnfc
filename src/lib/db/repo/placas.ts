import { pool } from "@/lib/db/pool";

export interface PlacaRegistro {
  id: string;
  codigo: string;
  token: string;
  lote_id: string;
  estado_producao: string;
  estado_comercial: string;
  origem_publica_producao: string;
  url_qr: string;
  url_nfc: string;
  vendedor_atribuido_id: string | null;
  estabelecimento_id: string | null;
  destino_url: string | null;
  destino_validado_em: Date | null;
  destino_validado_por: string | null;
  conferencia_impressao_em: Date | null;
  conferencia_qr_em: Date | null;
  conferencia_nfc_em: Date | null;
  conferencia_montagem_em: Date | null;
  nfc_modelo: string | null;
  nfc_uid: string | null;
  nfc_gravacao_concluida_em: Date | null;
  nfc_gravacao_concluida_por: string | null;
  nfc_leitura_conferida_em: Date | null;
  nfc_leitura_conferida_por: string | null;
  ativada_em: Date | null;
  ativada_por: string | null;
  versao: number;
  substituida_por_id: string | null;
  observacoes: string | null;
  criado_em: Date;
  atualizado_em: Date;
}

/** Usado pela rota pública. Consulta simples, sem lock (leitura). */
export async function buscarPlacaPorToken(token: string) {
  const { rows } = await pool.query<PlacaRegistro>("SELECT * FROM placas WHERE token = $1", [token]);
  return rows[0] ?? null;
}

export async function buscarPlacaPorCodigoOuToken(entrada: string) {
  const { rows } = await pool.query<PlacaRegistro>(
    "SELECT * FROM placas WHERE codigo = $1 OR token = $1",
    [entrada.trim()]
  );
  return rows[0] ?? null;
}

export async function buscarPlacaComDetalhes(id: string) {
  const { rows } = await pool.query(
    `SELECT p.*, e.nome AS estabelecimento_nome, c.id AS cliente_id, c.nome AS cliente_nome,
            v.nome AS vendedor_nome, l.codigo AS lote_codigo
     FROM placas p
     LEFT JOIN estabelecimentos e ON e.id = p.estabelecimento_id
     LEFT JOIN clientes c ON c.id = e.cliente_id
     LEFT JOIN usuarios v ON v.id = p.vendedor_atribuido_id
     JOIN lotes l ON l.id = p.lote_id
     WHERE p.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function listarPlacas(filtro: {
  vendedorId?: string;
  estadoComercial?: string;
  busca?: string;
}) {
  const condicoes: string[] = ["1=1"];
  const params: unknown[] = [];

  if (filtro.vendedorId) {
    params.push(filtro.vendedorId);
    condicoes.push(`p.vendedor_atribuido_id = $${params.length}`);
  }
  if (filtro.estadoComercial) {
    params.push(filtro.estadoComercial);
    condicoes.push(`p.estado_comercial = $${params.length}`);
  }
  if (filtro.busca) {
    params.push(`%${filtro.busca}%`);
    condicoes.push(`(p.codigo ILIKE $${params.length} OR e.nome ILIKE $${params.length} OR c.telefone ILIKE $${params.length})`);
  }

  const { rows } = await pool.query(
    `SELECT p.*, e.nome AS estabelecimento_nome, c.nome AS cliente_nome, v.nome AS vendedor_nome
     FROM placas p
     LEFT JOIN estabelecimentos e ON e.id = p.estabelecimento_id
     LEFT JOIN clientes c ON c.id = e.cliente_id
     LEFT JOIN usuarios v ON v.id = p.vendedor_atribuido_id
     WHERE ${condicoes.join(" AND ")}
     ORDER BY p.criado_em DESC
     LIMIT 300`,
    params
  );
  return rows;
}

export async function listarPlacasPorCliente(clienteId: string) {
  const { rows } = await pool.query(
    `SELECT p.*, e.nome AS estabelecimento_nome
     FROM placas p
     JOIN estabelecimentos e ON e.id = p.estabelecimento_id
     WHERE e.cliente_id = $1
     ORDER BY p.codigo`,
    [clienteId]
  );
  return rows;
}

export async function atribuirVendedor(placaId: string, vendedorId: string | null) {
  await pool.query(
    "UPDATE placas SET vendedor_atribuido_id = $2, atualizado_em = now() WHERE id = $1",
    [placaId, vendedorId]
  );
}

export async function atualizarConferenciaProducao(
  placaId: string,
  campo: "conferencia_impressao_em" | "conferencia_qr_em" | "conferencia_montagem_em",
  usuarioNome: string
) {
  await pool.query(
    `UPDATE placas SET ${campo} = now(), atualizado_em = now() WHERE id = $1`,
    [placaId]
  );
}

export async function registrarConfiguracaoNfc(
  placaId: string,
  dados: { modelo?: string; uid?: string; usuarioNome: string; marcarGravado?: boolean; marcarLeituraConferida?: boolean }
) {
  const sets: string[] = ["atualizado_em = now()"];
  const params: unknown[] = [placaId];
  if (dados.modelo !== undefined) {
    params.push(dados.modelo);
    sets.push(`nfc_modelo = $${params.length}`);
  }
  if (dados.uid !== undefined) {
    params.push(dados.uid);
    sets.push(`nfc_uid = $${params.length}`);
  }
  if (dados.marcarGravado) {
    params.push(dados.usuarioNome);
    sets.push(`nfc_gravacao_concluida_em = now()`, `nfc_gravacao_concluida_por = $${params.length}`);
  }
  if (dados.marcarLeituraConferida) {
    params.push(dados.usuarioNome);
    sets.push(`nfc_leitura_conferida_em = now()`, `nfc_leitura_conferida_por = $${params.length}`);
  }
  await pool.query(`UPDATE placas SET ${sets.join(", ")} WHERE id = $1`, params);
}
