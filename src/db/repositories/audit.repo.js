/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · repositorio de auditoría
 * ────────────────────────────────────────────────────────────────
 * Todo evento administrativo queda registrado: quién, qué, a quién,
 * cuándo y con qué detalle. Requisito técnico del proyecto.
 */
import { getDb } from '../connection.js';
import { normalizeJid } from '../../utils/ids.js';

/** Acciones auditadas (lista cerrada para poder filtrar en el panel). */
export const AUDIT_ACTIONS = Object.freeze([
  'user.register',
  'user.unregister',
  'user.edit',
  'user.leave',
  'user.join',
  'user.reactivate',
  'role.request',
  'role.approved',
  'role.rejected',
  'role.assigned',
  'role.released',
  'role.reset',
  'role.reserved',
  'role.unreserved',
  'role.expired',
  'couple.propose',
  'couple.accept',
  'couple.reject',
  'couple.break',
  'afk.set',
  'afk.clear',
  'warn.add',
  'warn.remove',
  'mod.kick',
  'mod.ban',
  'mod.unban',
  'group.close',
  'group.open',
  'group.announce',
  'group.config',
  'group.sync',
  'instance.start',
  'instance.stop',
  'instance.paired',
  'instance.logout',
  'security.ratelimit',
  'security.denied',
  'error.command',
]);

export const auditRepo = {
  /**
   * @param {object} entry
   * @param {string} entry.action una de AUDIT_ACTIONS (se acepta cualquiera, pero se valida el formato)
   */
  log({ instanceId = null, groupId = null, actorJid = null, action, targetJid = null, detail = {} }) {
    if (!action || typeof action !== 'string') return null;
    try {
      return getDb()
        .prepare(
          `INSERT INTO audit_log (instance_id, group_id, actor_jid, action, target_jid, detail, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          instanceId,
          groupId ? normalizeJid(groupId) : null,
          actorJid ? normalizeJid(actorJid) : null,
          action.slice(0, 40),
          targetJid ? normalizeJid(targetJid) : null,
          JSON.stringify(detail ?? {}).slice(0, 4000),
          Date.now()
        ).lastInsertRowid;
    } catch {
      // la auditoría nunca debe tumbar una operación principal
      return null;
    }
  },

  list(groupId, { limit = 25, action = null } = {}) {
    const params = [normalizeJid(groupId)];
    let sql = 'SELECT * FROM audit_log WHERE group_id = ?';
    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }
    params.push(Number(limit));
    return getDb().prepare(`${sql} ORDER BY created_at DESC LIMIT ?`).all(...params).map(parseDetail);
  },

  /** Actividad global para el panel web. */
  recent(limit = 50, instanceId = null) {
    const sql = instanceId
      ? 'SELECT * FROM audit_log WHERE instance_id = ? ORDER BY created_at DESC LIMIT ?'
      : 'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?';
    const params = instanceId ? [instanceId, Number(limit)] : [Number(limit)];
    return getDb().prepare(sql).all(...params).map(parseDetail);
  },

  purgeOlderThan(ms) {
    return getDb().prepare('DELETE FROM audit_log WHERE created_at <= ?').run(Date.now() - Number(ms)).changes;
  },

  count(groupId = null) {
    const row = groupId
      ? getDb().prepare('SELECT COUNT(*) AS n FROM audit_log WHERE group_id = ?').get(normalizeJid(groupId))
      : getDb().prepare('SELECT COUNT(*) AS n FROM audit_log').get();
    return Number(row.n);
  },
};

function parseDetail(row) {
  try {
    return { ...row, detail: JSON.parse(row.detail || '{}') };
  } catch {
    return { ...row, detail: {} };
  }
}
