-- ═══════════════════════════════════════════════════════════════
--  Sistema de créditos para compras en la web
-- ═══════════════════════════════════════════════════════════════

-- Usuarios del panel web (distintos a los usuarios de WhatsApp)
CREATE TABLE IF NOT EXISTS web_users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  username      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  credits       INTEGER NOT NULL DEFAULT 0,
  plan          TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','premium','enterprise')),
  api_key       TEXT UNIQUE NOT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  last_login_at INTEGER
);
CREATE INDEX IF NOT EXISTS ix_web_users_email ON web_users(email);
CREATE INDEX IF NOT EXISTS ix_web_users_apikey ON web_users(api_key);

-- Historial de transacciones de créditos
CREATE TABLE IF NOT EXISTS credit_transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES web_users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('purchase','usage','gift','refund','bonus')),
  amount      INTEGER NOT NULL,
  balance     INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reference   TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_credits_user ON credit_transactions(user_id, created_at DESC);

-- Planes disponibles
CREATE TABLE IF NOT EXISTS plans (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  price       REAL NOT NULL,
  credits     INTEGER NOT NULL,
  features    TEXT NOT NULL DEFAULT '[]',
  popular     INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);

-- Cupones / códigos de regalo
CREATE TABLE IF NOT EXISTS coupons (
  code        TEXT PRIMARY KEY,
  credits     INTEGER NOT NULL,
  max_uses    INTEGER NOT NULL DEFAULT 1,
  used_count  INTEGER NOT NULL DEFAULT 0,
  expires_at  INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_coupons_expires ON coupons(expires_at);

-- Uso de cupones
CREATE TABLE IF NOT EXISTS coupon_uses (
  coupon_code TEXT NOT NULL REFERENCES coupons(code) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES web_users(id) ON DELETE CASCADE,
  used_at     INTEGER NOT NULL,
  PRIMARY KEY (coupon_code, user_id)
);