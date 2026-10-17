-- ═══════════════════════════════════════════════════════════════
--  VÉRSOVA · esquema v7 — paquete Raiden (economía, muteos, stickers, bodas)
--  Tablas nuevas por grupo. Idempotente (CREATE TABLE IF NOT EXISTS).
-- ═══════════════════════════════════════════════════════════════

-- ── economía del grupo (¥enes): cartera + banco + racha + cooldowns ─
CREATE TABLE IF NOT EXISTS economy (
  group_id   TEXT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  jid        TEXT NOT NULL,
  coins      INTEGER NOT NULL DEFAULT 0,
  bank       INTEGER NOT NULL DEFAULT 0,
  streak     INTEGER NOT NULL DEFAULT 0,
  last_daily INTEGER NOT NULL DEFAULT 0,
  last_work  INTEGER NOT NULL DEFAULT 0,
  last_crime INTEGER NOT NULL DEFAULT 0,
  last_slut  INTEGER NOT NULL DEFAULT 0,
  last_rob   INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, jid)
);
CREATE INDEX IF NOT EXISTS ix_economy_total ON economy(group_id, coins, bank);

-- ── usuarios silenciados: el bot borra sus mensajes ────────────────
CREATE TABLE IF NOT EXISTS group_muted (
  group_id TEXT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  user_jid TEXT NOT NULL,
  reason   TEXT NOT NULL DEFAULT '',
  muted_by TEXT,
  muted_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_jid)
);

-- ── metadatos de stickers por usuario (pack / autor) ───────────────
CREATE TABLE IF NOT EXISTS sticker_meta (
  group_id   TEXT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  jid        TEXT NOT NULL,
  pack       TEXT NOT NULL DEFAULT '',
  author     TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, jid)
);

-- ── matrimonios del grupo (propuestas + historial) ─────────────────
CREATE TABLE IF NOT EXISTS marriages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id    TEXT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  a_jid       TEXT NOT NULL,
  b_jid       TEXT NOT NULL,
  married_at  INTEGER NOT NULL,
  divorced_at INTEGER
);
CREATE INDEX IF NOT EXISTS ix_marriages_group ON marriages(group_id, divorced_at);
CREATE INDEX IF NOT EXISTS ix_marriages_pair ON marriages(group_id, a_jid, b_jid);
