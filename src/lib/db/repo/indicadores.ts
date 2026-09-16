import { pool } from "@/lib/db/pool";

export interface FiltroIndicadores {
  inicio: Date;
  fim: Date;
  vendedorId?: string;
}

export interface Indicadores {
  placasProduzidas: number;
  placasDisponiveis: number;
  placasReservadas: number;
  placasAtivas: number;
  clientesCadastrados: number;
  vendasNoPeriodo: number;
  valorVendidoCentavos: number;
  valorRecebidoCentavos: number;
  valorPendenteCentavos: number;
  custosNoPeriodoCentavos: number;
  margemBrutaEstimadaCentavos: number;
  acessosQr: number;
  acessosNfc: number;
}

export interface ResumoOperacionalHoje {
  vendas: number;
  placasAtivadas: number;
  interacoesQr: number;
  interacoesNfc: number;
}

export async function obterIndicadores(filtro: FiltroIndicadores): Promise<Indicadores> {
  const filtroVendedorPlacas = filtro.vendedorId ? "AND vendedor_atribuido_id = $1" : "";
  const paramsPlacas = filtro.vendedorId ? [filtro.vendedorId] : [];

  const { rows: estadosPlacas } = await pool.query<{ estado_comercial: string; total: string }>(
    `SELECT estado_comercial, count(*)::text AS total FROM placas WHERE 1=1 ${filtroVendedorPlacas} GROUP BY estado_comercial`,
    paramsPlacas
  );
  const contarEstado = (estado: string) => Number(estadosPlacas.find((e) => e.estado_comercial === estado)?.total ?? 0);
  const placasProduzidas = estadosPlacas.reduce((acc, e) => acc + Number(e.total), 0);

  const filtroVendedorClientes = filtro.vendedorId ? "AND vendedor_responsavel_id = $1" : "";
  const { rows: clientesRows } = await pool.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM clientes WHERE arquivado_em IS NULL ${filtroVendedorClientes}`,
    paramsPlacas
  );

  const paramsVendas: unknown[] = [filtro.inicio, filtro.fim];
  let filtroVendedorVendas = "";
  if (filtro.vendedorId) {
    paramsVendas.push(filtro.vendedorId);
    filtroVendedorVendas = `AND vendedor_id = $${paramsVendas.length}`;
  }
  const { rows: vendasRows } = await pool.query<{ total: string; valor_vendido: string }>(
    `SELECT count(*)::text AS total, coalesce(sum(total_centavos),0)::text AS valor_vendido
     FROM vendas
     WHERE criado_em BETWEEN $1 AND $2 AND cancelada_em IS NULL AND tipo = 'VENDA' ${filtroVendedorVendas}`,
    paramsVendas
  );

  const { rows: custosRows } = await pool.query<{ custo: string }>(
    `SELECT coalesce(sum(iv.custo_centavos),0)::text AS custo
     FROM itens_venda iv
     JOIN vendas v ON v.id = iv.venda_id
     WHERE v.criado_em BETWEEN $1 AND $2 AND v.cancelada_em IS NULL ${filtroVendedorVendas}`,
    paramsVendas
  );

  const { rows: recebidoRows } = await pool.query<{ recebido: string }>(
    `SELECT coalesce(sum(p.valor_centavos),0)::text AS recebido
     FROM pagamentos p
     JOIN vendas v ON v.id = p.venda_id
     WHERE p.data_pagamento BETWEEN $1 AND $2 AND p.estornado_em IS NULL AND v.cancelada_em IS NULL ${filtroVendedorVendas}`,
    paramsVendas
  );

  const paramsPendente = filtro.vendedorId ? [filtro.vendedorId] : [];
  const filtroVendedorPendente = filtro.vendedorId ? "AND vendedor_id = $1" : "";
  const { rows: pendenteRows } = await pool.query<{ pendente: string }>(
    `SELECT coalesce(sum(v.total_centavos - coalesce((SELECT sum(p.valor_centavos) FROM pagamentos p WHERE p.venda_id = v.id AND p.estornado_em IS NULL), 0)), 0)::text AS pendente
     FROM vendas v
     WHERE v.situacao_pagamento IN ('PENDENTE','PARCIAL') AND v.cancelada_em IS NULL ${filtroVendedorPendente}`,
    paramsPendente
  );

  const paramsEventos: unknown[] = [filtro.inicio, filtro.fim];
  let filtroVendedorEventos = "";
  if (filtro.vendedorId) {
    paramsEventos.push(filtro.vendedorId);
    filtroVendedorEventos = `AND p.vendedor_atribuido_id = $${paramsEventos.length}`;
  }
  const { rows: eventosRows } = await pool.query<{ canal: string; total: string }>(
    `SELECT ev.canal, count(*)::text AS total
     FROM eventos_acesso ev
     JOIN placas p ON p.id = ev.placa_id
     WHERE ev.data_hora BETWEEN $1 AND $2 AND ev.eh_teste = false ${filtroVendedorEventos}
     GROUP BY ev.canal`,
    paramsEventos
  );
  const acessosQr = Number(eventosRows.find((e) => e.canal === "QR")?.total ?? 0);
  const acessosNfc = Number(eventosRows.find((e) => e.canal === "NFC")?.total ?? 0);

  const valorVendidoCentavos = Number(vendasRows[0].valor_vendido);
  const custosNoPeriodoCentavos = Number(custosRows[0].custo);

  return {
    placasProduzidas,
    placasDisponiveis: contarEstado("DISPONIVEL"),
    placasReservadas: contarEstado("RESERVADA"),
    placasAtivas: contarEstado("ATIVA"),
    clientesCadastrados: Number(clientesRows[0].total),
    vendasNoPeriodo: Number(vendasRows[0].total),
    valorVendidoCentavos,
    valorRecebidoCentavos: Number(recebidoRows[0].recebido),
    valorPendenteCentavos: Number(pendenteRows[0].pendente),
    custosNoPeriodoCentavos,
    margemBrutaEstimadaCentavos: valorVendidoCentavos - custosNoPeriodoCentavos,
    acessosQr,
    acessosNfc,
  };
}

export async function obterResumoOperacionalHoje(inicio: Date, fim: Date, vendedorId?: string): Promise<ResumoOperacionalHoje> {
  const params: unknown[] = [inicio, fim];
  let escopoVenda = "";
  let escopoPlaca = "";
  if (vendedorId) {
    params.push(vendedorId);
    escopoVenda = `AND v.vendedor_id = $${params.length}`;
    escopoPlaca = `AND (p.vendedor_atribuido_id = $${params.length} OR c.vendedor_responsavel_id = $${params.length})`;
  }
  const [vendas, ativacoes, eventos] = await Promise.all([
    pool.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM vendas v
       WHERE v.criado_em BETWEEN $1 AND $2 AND v.cancelada_em IS NULL ${escopoVenda}`,
      params
    ),
    pool.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM placas p
       LEFT JOIN estabelecimentos e ON e.id = p.estabelecimento_id
       LEFT JOIN clientes c ON c.id = e.cliente_id
       WHERE p.ativada_em BETWEEN $1 AND $2 ${escopoPlaca}`,
      params
    ),
    pool.query<{ qr: number; nfc: number }>(
      `SELECT count(*) FILTER (WHERE ev.canal = 'QR')::int AS qr,
              count(*) FILTER (WHERE ev.canal = 'NFC')::int AS nfc
       FROM eventos_acesso ev
       JOIN placas p ON p.id = ev.placa_id
       LEFT JOIN estabelecimentos e ON e.id = ev.estabelecimento_id
       LEFT JOIN clientes c ON c.id = e.cliente_id
       WHERE ev.data_hora BETWEEN $1 AND $2 AND ev.eh_teste = false ${escopoPlaca}`,
      params
    ),
  ]);
  return {
    vendas: vendas.rows[0]?.total ?? 0,
    placasAtivadas: ativacoes.rows[0]?.total ?? 0,
    interacoesQr: eventos.rows[0]?.qr ?? 0,
    interacoesNfc: eventos.rows[0]?.nfc ?? 0,
  };
}
