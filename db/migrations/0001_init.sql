-- 0001_init.sql
-- Schema inicial do sistema de gestão de placas de avaliação Google (QR + NFC).
-- Todos os horários são armazenados em UTC (timestamptz); a apresentação na
-- interface converte para America/Sao_Paulo (ver src/lib/tempo.ts).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================================
-- Enums
-- =========================================================================

CREATE TYPE papel_usuario AS ENUM ('ADMIN', 'VENDEDOR');
CREATE TYPE estado_producao AS ENUM ('CRIADA', 'IMPRESSA', 'MONTADA', 'NFC_GRAVADO', 'TESTADA');
CREATE TYPE estado_comercial AS ENUM ('DISPONIVEL', 'RESERVADA', 'ATIVA', 'DESATIVADA', 'SUBSTITUIDA', 'PERDIDA');
CREATE TYPE situacao_pagamento AS ENUM ('PENDENTE', 'PARCIAL', 'QUITADA', 'CANCELADA');
CREATE TYPE tipo_venda AS ENUM ('VENDA', 'DEMONSTRACAO', 'BONIFICACAO');
CREATE TYPE forma_pagamento AS ENUM ('PIX', 'DINHEIRO', 'CARTAO', 'OUTRO');
CREATE TYPE canal_acesso AS ENUM ('QR', 'NFC', 'DESCONHECIDO');
CREATE TYPE tipo_evento_historico AS ENUM (
  'CRIACAO_LOTE', 'ATRIBUICAO_PLACA', 'ATIVACAO', 'MUDANCA_DESTINO',
  'MUDANCA_VINCULO', 'DESATIVACAO', 'SUBSTITUICAO', 'ALTERACAO_PAGAMENTO',
  'TRANSFERENCIA_VENDEDOR', 'OUTRO'
);

-- =========================================================================
-- Usuários, sessões e convites
-- =========================================================================

CREATE TABLE usuarios (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           text NOT NULL,
  email          text NOT NULL UNIQUE,
  senha_hash     text NOT NULL,
  papel          papel_usuario NOT NULL,
  ativo          boolean NOT NULL DEFAULT true,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessoes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  expira_em    timestamptz NOT NULL,
  user_agent   text,
  ip           text,
  revogado_em  timestamptz
);
CREATE INDEX idx_sessoes_usuario ON sessoes(usuario_id);

CREATE TABLE convites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  papel         papel_usuario NOT NULL,
  token_hash    text NOT NULL UNIQUE,
  criado_por_id uuid REFERENCES usuarios(id),
  criado_em     timestamptz NOT NULL DEFAULT now(),
  expira_em     timestamptz NOT NULL,
  usado_em      timestamptz
);

-- =========================================================================
-- Clientes e estabelecimentos
-- =========================================================================

CREATE TABLE clientes (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                     text NOT NULL,
  responsavel              text,
  telefone                 text,
  email                    text,
  observacoes              text,
  arquivado_em             timestamptz,
  vendedor_responsavel_id  uuid REFERENCES usuarios(id),
  criado_em                timestamptz NOT NULL DEFAULT now(),
  atualizado_em            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_clientes_vendedor ON clientes(vendedor_responsavel_id);

CREATE TABLE estabelecimentos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id         uuid NOT NULL REFERENCES clientes(id),
  nome               text NOT NULL,
  endereco           text,
  link_perfil_google text,
  link_avaliacao     text,
  observacoes        text,
  arquivado_em       timestamptz,
  criado_em          timestamptz NOT NULL DEFAULT now(),
  atualizado_em      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_estabelecimentos_cliente ON estabelecimentos(cliente_id);

-- =========================================================================
-- Lotes e placas
-- =========================================================================

CREATE TABLE lotes (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                   text NOT NULL UNIQUE,
  quantidade               integer NOT NULL CHECK (quantidade > 0),
  origem_publica_usada     text NOT NULL,
  template_versao          text NOT NULL,
  parametros_impressao     jsonb NOT NULL,
  custo_unitario_centavos  integer,
  criado_por_id            uuid REFERENCES usuarios(id),
  criado_em                timestamptz NOT NULL DEFAULT now(),
  observacoes              text
);

CREATE TABLE placas (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo   text NOT NULL UNIQUE,
  token    text NOT NULL UNIQUE,

  lote_id  uuid NOT NULL REFERENCES lotes(id),

  estado_producao  estado_producao NOT NULL DEFAULT 'CRIADA',
  estado_comercial estado_comercial NOT NULL DEFAULT 'DISPONIVEL',

  origem_publica_producao text NOT NULL,
  url_qr  text NOT NULL,
  url_nfc text NOT NULL,

  vendedor_atribuido_id uuid REFERENCES usuarios(id),
  estabelecimento_id    uuid REFERENCES estabelecimentos(id),

  destino_url          text,
  destino_validado_em  timestamptz,
  destino_validado_por text,

  conferencia_impressao_em timestamptz,
  conferencia_qr_em        timestamptz,
  conferencia_nfc_em       timestamptz,
  conferencia_montagem_em  timestamptz,

  nfc_modelo                    text,
  nfc_uid                       text,
  nfc_gravacao_concluida_em     timestamptz,
  nfc_gravacao_concluida_por    text,
  nfc_leitura_conferida_em      timestamptz,
  nfc_leitura_conferida_por     text,

  ativada_em  timestamptz,
  ativada_por text,

  versao integer NOT NULL DEFAULT 0,

  substituida_por_id uuid UNIQUE REFERENCES placas(id),

  observacoes text,

  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_placas_lote ON placas(lote_id);
CREATE INDEX idx_placas_estabelecimento ON placas(estabelecimento_id);
CREATE INDEX idx_placas_vendedor ON placas(vendedor_atribuido_id);
CREATE INDEX idx_placas_estado_comercial ON placas(estado_comercial);

-- =========================================================================
-- Vendas, itens e pagamentos
-- =========================================================================

CREATE TABLE vendas (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id           uuid REFERENCES clientes(id),
  vendedor_id          uuid NOT NULL REFERENCES usuarios(id),
  tipo                 tipo_venda NOT NULL DEFAULT 'VENDA',
  justificativa        text,
  total_centavos       integer NOT NULL CHECK (total_centavos >= 0),
  desconto_centavos    integer NOT NULL DEFAULT 0 CHECK (desconto_centavos >= 0),
  situacao_pagamento   situacao_pagamento NOT NULL DEFAULT 'PENDENTE',
  observacoes          text,
  cancelada_em         timestamptz,
  criado_em            timestamptz NOT NULL DEFAULT now(),
  atualizado_em        timestamptz NOT NULL DEFAULT now(),
  chave_idempotencia   text UNIQUE,
  CONSTRAINT justificativa_obrigatoria_se_nao_venda
    CHECK (tipo = 'VENDA' OR justificativa IS NOT NULL)
);
CREATE INDEX idx_vendas_cliente ON vendas(cliente_id);
CREATE INDEX idx_vendas_vendedor ON vendas(vendedor_id);

CREATE TABLE itens_venda (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id        uuid NOT NULL REFERENCES vendas(id),
  placa_id        uuid NOT NULL REFERENCES placas(id),
  preco_centavos  integer NOT NULL CHECK (preco_centavos >= 0),
  custo_centavos  integer NOT NULL CHECK (custo_centavos >= 0),
  UNIQUE (venda_id, placa_id)
);

CREATE TABLE pagamentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id        uuid NOT NULL REFERENCES vendas(id),
  forma           forma_pagamento NOT NULL,
  valor_centavos  integer NOT NULL CHECK (valor_centavos > 0),
  data_pagamento  timestamptz NOT NULL DEFAULT now(),
  observacoes     text,
  estornado_em    timestamptz,
  criado_em       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pagamentos_venda ON pagamentos(venda_id);

-- =========================================================================
-- Eventos de acesso (métricas públicas)
-- =========================================================================

CREATE TABLE eventos_acesso (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placa_id            uuid NOT NULL REFERENCES placas(id),
  estabelecimento_id  uuid REFERENCES estabelecimentos(id),
  canal               canal_acesso NOT NULL,
  data_hora           timestamptz NOT NULL DEFAULT now(),
  ip_hash             text,
  user_agent_resumo   text,
  eh_teste            boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_eventos_placa ON eventos_acesso(placa_id);
CREATE INDEX idx_eventos_estabelecimento ON eventos_acesso(estabelecimento_id);
CREATE INDEX idx_eventos_data ON eventos_acesso(data_hora);

-- =========================================================================
-- Histórico de alterações (auditoria)
-- =========================================================================

CREATE TABLE historico_alteracoes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placa_id       uuid REFERENCES placas(id),
  usuario_id     uuid REFERENCES usuarios(id),
  tipo           tipo_evento_historico NOT NULL,
  detalhes_json  jsonb NOT NULL,
  criado_em      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_historico_placa ON historico_alteracoes(placa_id);
CREATE INDEX idx_historico_usuario ON historico_alteracoes(usuario_id);

-- =========================================================================
-- Configuração geral (singleton)
-- =========================================================================

CREATE TABLE configuracoes (
  id                      integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nome_operacao           text NOT NULL DEFAULT '',
  logo_url                text,
  preco_padrao_centavos   integer,
  custo_padrao_centavos   integer,
  origem_publica_atual    text,
  origem_validada_em      timestamptz,
  politica_retencao_dias  integer NOT NULL DEFAULT 365,
  atualizado_em           timestamptz NOT NULL DEFAULT now()
);
INSERT INTO configuracoes (id) VALUES (1);
