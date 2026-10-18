-- ═══════════════════════════════════════════════════════════════
--  𓆩 ☕ 𓆪  VÉRSOVA · esquema v8
--  · Sesiones de las cuentas web (login / registro)
--  · API keys con caducidad (máximo 100 días) para /api/v1
--  · Registro de uso de la API funcional
--  (La columna web_users.role se añade desde connection.js para que
--   la migración sea idempotente.)
-- ═══════════════════════════════════════════════════════════════

-- ── sesiones del panel de cuentas (token guardado como hash) ───
CREATE TABLE IF NOT EXISTS web_sessions (
  token_hash   TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES web_users(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  user_agent   TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_web_sessions_user ON web_sessions(user_id);
CREATE INDEX IF NOT EXISTS ix_web_sessions_expires ON web_sessions(expires_at);

-- ── API keys (solo se guarda el hash SHA-256 de la clave) ──────
CREATE TABLE IF NOT EXISTS api_keys (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES web_users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  key_prefix   TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at   INTEGER,
  requests     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_api_keys_user ON api_keys(user_id, created_at DESC);

-- ── uso de la API funcional (/api/v1) ──────────────────────────
CREATE TABLE IF NOT EXISTS api_usage (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key_id      TEXT,
  user_id     TEXT,
  endpoint    TEXT NOT NULL,
  status      INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_api_usage_user ON api_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_api_usage_created ON api_usage(created_at);
