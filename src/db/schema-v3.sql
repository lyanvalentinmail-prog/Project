-- ═══════════════════════════════════════════════════════════════
--  𓆩 ☕ 𓆪  VÉRSOVA · esquema v3
--  · Activación de bots por clave generada con `.key` en WhatsApp
--  · Prefijo configurable por sub-bot (# - + . /)
--  · Datos web persistidos (tickets) y métricas reales (contadores)
-- ═══════════════════════════════════════════════════════════════

-- ── sub-bots: prefijo propio y activación ──────────────────────
ALTER TABLE bot_instances ADD COLUMN prefix TEXT NOT NULL DEFAULT '.';
ALTER TABLE bot_instances ADD COLUMN activated INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bot_instances ADD COLUMN activated_at INTEGER;

-- Los sub-bots ya existentes se consideran activados (grandfather):
-- solo los creados a partir de ahora exigen la clave `.key`.
UPDATE bot_instances SET activated = 1 WHERE activated = 0;

-- ── claves de activación generadas por `.key` en WhatsApp ──────
CREATE TABLE IF NOT EXISTS activation_keys (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  code              TEXT NOT NULL UNIQUE,
  creator_jid       TEXT,
  creator_instance  TEXT,
  created_at        INTEGER NOT NULL,
  expires_at        INTEGER NOT NULL,
  used_at           INTEGER,
  used_by_instance  TEXT
);
CREATE INDEX IF NOT EXISTS ix_activation_keys_expires ON activation_keys(expires_at);

-- ── estadísticas reales de comandos (para el panel) ────────────
CREATE TABLE IF NOT EXISTS command_stats (
  command      TEXT PRIMARY KEY,
  count        INTEGER NOT NULL DEFAULT 0,
  last_used_at INTEGER NOT NULL
);

-- ── contadores reales del sistema (mensajes, peticiones API…) ──
CREATE TABLE IF NOT EXISTS counters (
  name       TEXT PRIMARY KEY,
  value      INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- ── tickets del panel web (persistidos en la base de datos) ────
CREATE TABLE IF NOT EXISTS web_tickets (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'Abierto'
             CHECK (status IN ('Abierto','Respondido','Cerrado')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- ── planes de la tienda: filas reales en la BD ─────────────────
INSERT OR IGNORE INTO plans (id, name, price, credits, features, popular, active, created_at) VALUES
  ('starter',    'Starter',     4.99,   500, '["500 créditos incluidos","Acceso a endpoints Free y Híbridos","1 clave API","Soporte por email"]', 0, 1, 0),
  ('pro',        'Pro',         9.99,  1500, '["1,500 créditos incluidos","Acceso a endpoints Premium","5 cambios de clave","Soporte prioritario"]', 1, 1, 0),
  ('business',   'Business',   24.99,  5000, '["5,000 créditos incluidos","Límites ampliados","IP whitelist","Soporte 24/7"]', 0, 1, 0),
  ('enterprise', 'Enterprise', 49.99, 15000, '["15,000 créditos incluidos","Endpoints exclusivos","Claves múltiples","SLA prioritario"]', 0, 1, 0);
