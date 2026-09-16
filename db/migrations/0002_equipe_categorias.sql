-- 0002_equipe_categorias.sql
-- Evolucao aditiva para RBAC ampliado e categorizacao configuravel de clientes.
-- Nao remove nem reescreve dados existentes.

ALTER TYPE papel_usuario ADD VALUE IF NOT EXISTS 'GERENTE';
ALTER TYPE papel_usuario ADD VALUE IF NOT EXISTS 'VISUALIZADOR';

CREATE TABLE IF NOT EXISTS categorias_clientes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL,
  cor           text NOT NULL DEFAULT 'AZUL',
  ativo         boolean NOT NULL DEFAULT true,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categorias_clientes_nome_unico
  ON categorias_clientes (lower(nome));

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS categoria_id uuid REFERENCES categorias_clientes(id);

CREATE INDEX IF NOT EXISTS idx_clientes_categoria ON clientes(categoria_id);
