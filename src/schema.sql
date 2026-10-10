-- Estrutura própria do sistema; não modifica tabelas de outros projetos.
CREATE TABLE IF NOT EXISTS hm_entries (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('entrada','saida')),
  entry_date DATE NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents BETWEEN 1 AND 99999999999),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 2000),
  contact TEXT NOT NULL DEFAULT '' CHECK (length(contact) <= 160),
  weight_grams NUMERIC(12,2) CHECK (weight_grams > 0 AND weight_grams <= 99999999.99),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS hm_entries_date_idx ON hm_entries(entry_date DESC, created_at DESC) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS hm_audit (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entry_id UUID NOT NULL REFERENCES hm_entries(id),
  action TEXT NOT NULL CHECK (action IN ('create','update','delete')),
  actor TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS hm_sessions (
  token_hash TEXT PRIMARY KEY,
  csrf_token TEXT NOT NULL,
  auth_version TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS hm_sessions_expiry_idx ON hm_sessions(expires_at);
CREATE TABLE IF NOT EXISTS hm_login_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Atualização 1.1: aditiva e idempotente, preserva os lançamentos existentes.
CREATE TABLE IF NOT EXISTS hm_orders (
  id UUID PRIMARY KEY,
  description TEXT NOT NULL CHECK(length(description) BETWEEN 1 AND 2000),
  contact TEXT NOT NULL DEFAULT '' CHECK(length(contact) <= 160),
  status TEXT NOT NULL DEFAULT 'orcamento' CHECK(status IN ('orcamento','aprovado','imprimindo','entregue')),
  amount_cents BIGINT CHECK(amount_cents BETWEEN 1 AND 99999999999),
  weight_grams NUMERIC(12,2) CHECK(weight_grams > 0 AND weight_grams <= 99999999.99),
  due_date DATE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS hm_orders_status_idx ON hm_orders(status,created_at DESC);

-- v1.2: migração aditiva, preserva todos os lançamentos anteriores.
ALTER TABLE hm_entries ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Sem categoria' CHECK(length(category) BETWEEN 1 AND 80);
