/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · repositorio de grupos
 * ────────────────────────────────────────────────────────────────
 * Incluye el espejo de administradores de WhatsApp y la lista de
 * bloqueados (bans). Cada fila está aislada por group_id.
 */
import { getDb, tx } from '../connection.js';
import { defaultGroupConfig } from '../../config/defaults.js';
import { normalizeJid, isGroupJid } from '../../utils/ids.js';

const now = () => Date.now();

/** Mezcla la config guardada sobre los defaults (nunca devuelve undefined). */
function withConfig(row) {
  if (!row) return null;
  let stored = {};
  try {
    stored = JSON.parse(row.config || '{}');
  } catch {
    stored = {};
  }
  return {
    ...row,
    welcome: Boolean(row.welcome),
    farewell: Boolean(row.farewell),
    locked: Boolean(row.locked),
    config: { ...defaultGroupConfig(), ...stored },
  };
}

export const groupsRepo = {
  /** Registra (o actualiza) un grupo conocido por el bot. */
  upsert({ groupId, instanceId, name = '', waCreatedAt = null, size = 0 }) {
    const jid = normalizeJid(groupId);
    if (!isGroupJid(jid)) throw new Error(`groupId no es un grupo: ${groupId}`);
    getDb()
      .prepare(
        `INSERT INTO groups (group_id, instance_id, name, wa_created_at, joined_at, size, config, updated_at)
         VALUES (@jid, @instanceId, @name, @waCreatedAt, @ts, @size, @config, @ts)
         ON CONFLICT(group_id) DO UPDATE SET
           instance_id = excluded.instance_id,
           name        = CASE WHEN excluded.name != '' THEN excluded.name ELSE groups.name END,
           wa_created_at = COALESCE(excluded.wa_created_at, groups.wa_created_at),
           size        = excluded.size,
           updated_at  = excluded.updated_at`
      )
      .run({ jid, instanceId, name, waCreatedAt, size, ts: now(), config: JSON.stringify(defaultGroupConfig()) });
    return this.get(jid);
  },

  get(groupId) {
    return withConfig(getDb().prepare('SELECT * FROM groups WHERE group_id = ?').get(normalizeJid(groupId)));
  },

  all(instanceId = null) {
    const rows = instanceId
      ? getDb().prepare('SELECT * FROM groups WHERE instance_id = ? ORDER BY joined_at DESC').all(instanceId)
      : getDb().prepare('SELECT * FROM groups ORDER BY joined_at DESC').all();
    return rows.map(withConfig);
  },

  setName(groupId, name) {
    getDb()
      .prepare('UPDATE groups SET name = ?, updated_at = ? WHERE group_id = ?')
      .run(String(name).slice(0, 120), now(), normalizeJid(groupId));
  },

  setSize(groupId, size) {
    getDb()
      .prepare('UPDATE groups SET size = ?, updated_at = ? WHERE group_id = ?')
      .run(Number(size) || 0, now(), normalizeJid(groupId));
  },

  setLocked(groupId, locked) {
    getDb()
      .prepare('UPDATE groups SET locked = ?, updated_at = ? WHERE group_id = ?')
      .run(locked ? 1 : 0, now(), normalizeJid(groupId));
  },

  setFlag(groupId, field, value) {
    if (!['welcome', 'farewell'].includes(field)) throw new Error(`flag inválido: ${field}`);
    getDb()
      .prepare(`UPDATE groups SET ${field} = ?, updated_at = ? WHERE group_id = ?`)
      .run(value ? 1 : 0, now(), normalizeJid(groupId));
  },

  /** Actualiza claves sueltas de la config JSON del grupo. */
  updateConfig(groupId, patch) {
    const jid = normalizeJid(groupId);
    return tx(() => {
      const row = getDb().prepare('SELECT config FROM groups WHERE group_id = ?').get(jid);
      if (!row) return null;
      let stored = {};
      try {
        stored = JSON.parse(row.config || '{}');
      } catch {
        stored = {};
      }
      const next = { ...defaultGroupConfig(), ...stored, ...patch };
      getDb()
        .prepare('UPDATE groups SET config = ?, updated_at = ? WHERE group_id = ?')
        .run(JSON.stringify(next), now(), jid);
      return next;
    });
  },

  markSynced(groupId) {
    getDb()
      .prepare('UPDATE groups SET last_sync_at = ?, updated_at = ? WHERE group_id = ?')
      .run(now(), now(), normalizeJid(groupId));
  },

  remove(groupId) {
    return getDb().prepare('DELETE FROM groups WHERE group_id = ?').run(normalizeJid(groupId)).changes;
  },

  /* ── administradores (espejo de WhatsApp) ───────────────────── */

  /** Reemplaza la lista de admins por la que devuelve `groupMetadata`. */
  syncAdmins(groupId, admins) {
    const jid = normalizeJid(groupId);
    const ts = now();
    return tx(() => {
      getDb().prepare('DELETE FROM group_admins WHERE group_id = ?').run(jid);
      const insert = getDb().prepare(
        `INSERT INTO group_admins (group_id, user_jid, is_super, synced_at) VALUES (?, ?, ?, ?)`
      );
      for (const admin of admins ?? []) {
        const userJid = normalizeJid(admin.jid ?? admin.id);
        if (!userJid) continue;
        insert.run(jid, userJid, admin.admin === 'superadmin' ? 1 : 0, ts);
      }
      return this.listAdmins(jid);
    });
  },

  listAdmins(groupId) {
    return getDb()
      .prepare('SELECT * FROM group_admins WHERE group_id = ? ORDER BY is_super DESC, user_jid ASC')
      .all(normalizeJid(groupId));
  },

  isAdmin(groupId, userJid) {
    const row = getDb()
      .prepare('SELECT 1 AS ok FROM group_admins WHERE group_id = ? AND user_jid = ?')
      .get(normalizeJid(groupId), normalizeJid(userJid));
    return Boolean(row);
  },

  adminCount(groupId) {
    return Number(
      getDb().prepare('SELECT COUNT(*) AS n FROM group_admins WHERE group_id = ?').get(normalizeJid(groupId)).n
    );
  },

  /* ── lista de bloqueados ────────────────────────────────────── */

  block(groupId, userJid, { reason = '', bannedBy = null } = {}) {
    getDb()
      .prepare(
        `INSERT INTO group_blocked (group_id, user_jid, reason, banned_by, banned_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(group_id, user_jid) DO UPDATE SET
           reason = excluded.reason, banned_by = excluded.banned_by, banned_at = excluded.banned_at`
      )
      .run(normalizeJid(groupId), normalizeJid(userJid), String(reason).slice(0, 200), bannedBy, now());
  },

  unblock(groupId, userJid) {
    return getDb()
      .prepare('DELETE FROM group_blocked WHERE group_id = ? AND user_jid = ?')
      .run(normalizeJid(groupId), normalizeJid(userJid)).changes;
  },

  isBlocked(groupId, userJid) {
    return Boolean(
      getDb()
        .prepare('SELECT 1 AS ok FROM group_blocked WHERE group_id = ? AND user_jid = ?')
        .get(normalizeJid(groupId), normalizeJid(userJid))
    );
  },

  listBlocked(groupId) {
    return getDb()
      .prepare('SELECT * FROM group_blocked WHERE group_id = ? ORDER BY banned_at DESC')
      .all(normalizeJid(groupId));
  },
};
