-- ═══════════════════════════════════════════════════════════════
--  𓆩 ☕ 𓆪  VÉRSOVA · esquema de base de datos (SQLite)  v1
--  Todo está segmentado por group_id: los datos de un grupo
--  nunca se mezclan con los de otro.
-- ═══════════════════════════════════════════════════════════════

-- ── metadatos del esquema ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS meta (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- ── sub-bots (instancias de WhatsApp) ──────────────────────────
CREATE TABLE IF NOT EXISTS bot_instances (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  phone             TEXT NOT NULL,
  pairing_mode      TEXT NOT NULL DEFAULT 'qr' CHECK (pairing_mode IN ('qr','pairing')),
  status            TEXT NOT NULL DEFAULT 'created',
  wa_jid            TEXT,
  push_name         TEXT,
  session_dir       TEXT NOT NULL,
  autostart         INTEGER NOT NULL DEFAULT 1,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  last_connected_at INTEGER,
  last_error        TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_instances_phone ON bot_instances(phone);

-- ── grupos ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  group_id      TEXT PRIMARY KEY,
  instance_id   TEXT NOT NULL REFERENCES bot_instances(id) ON DELETE CASCADE,
  name          TEXT NOT NULL DEFAULT '',
  wa_created_at INTEGER,
  joined_at     INTEGER NOT NULL,
  size          INTEGER NOT NULL DEFAULT 0,
  config        TEXT NOT NULL DEFAULT '{}',
  welcome       INTEGER NOT NULL DEFAULT 1,
  farewell      INTEGER NOT NULL DEFAULT 1,
  locked        INTEGER NOT NULL DEFAULT 0,
  last_sync_at  INTEGER,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_groups_instance ON groups(instance_id);

-- ── administradores reales del grupo (espejo de WhatsApp) ──────
CREATE TABLE IF NOT EXISTS group_admins (
  group_id  TEXT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  user_jid  TEXT NOT NULL,
  is_super  INTEGER NOT NULL DEFAULT 0,
  synced_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_jid)
);

-- ── lista de bloqueados (bans) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS group_blocked (
  group_id  TEXT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  user_jid  TEXT NOT NULL,
  reason    TEXT NOT NULL DEFAULT '',
  banned_by TEXT,
  banned_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_jid)
);

-- ── personajes / roles ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id       TEXT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  name_key       TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'free' CHECK (status IN ('free','taken','reserved')),
  owner_jid      TEXT,
  taken_at       INTEGER,
  reserved_by    TEXT,
  reserved_at    INTEGER,
  reserved_until INTEGER,
  released_at    INTEGER,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  UNIQUE (group_id, name_key)
);
-- un personaje por usuario y una reserva por usuario, garantizado por el motor
CREATE UNIQUE INDEX IF NOT EXISTS ux_roles_owner   ON roles(group_id, owner_jid)    WHERE owner_jid   IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_roles_reserve ON roles(group_id, reserved_by) WHERE reserved_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_roles_group ON roles(group_id, status);

-- ── integrantes registrados ────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  group_id      TEXT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  jid           TEXT NOT NULL,
  phone         TEXT,
  name          TEXT NOT NULL,
  age           INTEGER NOT NULL,
  role_id       INTEGER REFERENCES roles(id) ON DELETE SET NULL,
  registered_at INTEGER NOT NULL,
  last_activity INTEGER NOT NULL,
  afk_reason    TEXT,
  afk_since     INTEGER,
  partner_jid   TEXT,
  warn_count    INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','left','kicked','banned')),
  left_at       INTEGER,
  push_name     TEXT,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (group_id, jid)
);
CREATE INDEX IF NOT EXISTS ix_users_activity ON users(group_id, last_activity);
CREATE INDEX IF NOT EXISTS ix_users_role     ON users(group_id, role_id);
CREATE INDEX IF NOT EXISTS ix_users_partner  ON users(group_id, partner_jid);

-- ── solicitudes (rol, cambio de rol, pareja) ───────────────────
CREATE TABLE IF NOT EXISTS requests (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id       TEXT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  user_jid       TEXT NOT NULL,
  target_jid     TEXT,
  role_name      TEXT,
  prev_role_name TEXT,
  type           TEXT NOT NULL CHECK (type IN ('role','role_change','couple')),
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected','cancelled','expired')),
  wa_message_id  TEXT,
  reason         TEXT,
  created_at     INTEGER NOT NULL,
  resolved_at    INTEGER,
  resolved_by    TEXT
);
CREATE INDEX IF NOT EXISTS ix_requests_group  ON requests(group_id, status);
CREATE INDEX IF NOT EXISTS ix_requests_user   ON requests(group_id, user_jid);
CREATE UNIQUE INDEX IF NOT EXISTS ux_requests_msg     ON requests(wa_message_id) WHERE wa_message_id IS NOT NULL;
-- una única solicitud pendiente por usuario y tipo: imposible duplicar
CREATE UNIQUE INDEX IF NOT EXISTS ux_requests_pending ON requests(group_id, user_jid, type) WHERE status = 'pending';

-- ── advertencias ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warnings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id   TEXT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  user_jid   TEXT NOT NULL,
  reason     TEXT NOT NULL DEFAULT '',
  admin_jid  TEXT,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  revoked_by TEXT
);
CREATE INDEX IF NOT EXISTS ix_warnings_user ON warnings(group_id, user_jid);

-- ── confirmaciones pendientes (sobreviven reinicios) ───────────
CREATE TABLE IF NOT EXISTS pending_confirmations (
  id         TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL,
  user_jid   TEXT NOT NULL,
  action     TEXT NOT NULL,
  payload    TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_confirm_user ON pending_confirmations(group_id, user_jid);
CREATE INDEX IF NOT EXISTS ix_confirm_expires ON pending_confirmations(expires_at);

-- ── auditoría de eventos administrativos ───────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id TEXT,
  group_id    TEXT,
  actor_jid   TEXT,
  action      TEXT NOT NULL,
  target_jid  TEXT,
  detail      TEXT NOT NULL DEFAULT '{}',
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_audit_group ON audit_log(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_time  ON audit_log(created_at DESC);
