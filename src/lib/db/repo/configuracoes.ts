import { pool } from "@/lib/db/pool";

export interface ConfiguracaoRegistro {
  id: number;
  nome_operacao: string;
  logo_url: string | null;
  preco_padrao_centavos: number | null;
  custo_padrao_centavos: number | null;
  origem_publica_atual: string | null;
  origem_validada_em: Date | null;
  politica_retencao_dias: number;
  atualizado_em: Date;
}

export async function obterConfiguracao(): Promise<ConfiguracaoRegistro> {
  const { rows } = await pool.query<ConfiguracaoRegistro>("SELECT * FROM configuracoes WHERE id = 1");
  return rows[0];
}

export async function atualizarConfiguracao(dados: Partial<Omit<ConfiguracaoRegistro, "id" | "atualizado_em">>) {
  const campos = Object.keys(dados);
  if (campos.length === 0) return obterConfiguracao();
  const sets = campos.map((c, i) => `${c} = $${i + 1}`).join(", ");
  const { rows } = await pool.query<ConfiguracaoRegistro>(
    `UPDATE configuracoes SET ${sets}, atualizado_em = now() WHERE id = 1 RETURNING *`,
    campos.map((c) => (dados as Record<string, unknown>)[c])
  );
  return rows[0];
}

/** Confirmação explícita de admin de que a origem pública é definitiva. */
export async function validarOrigemPublica(origem: string) {
  return atualizarConfiguracao({ origem_publica_atual: origem, origem_validada_em: new Date() });
}
