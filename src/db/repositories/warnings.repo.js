/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · repositorio de advertencias
 * ────────────────────────────────────────────────────────────────
 * Se guarda el historial completo (quién, por qué, cuándo) y el
 * contador del usuario se recalcula desde aquí: nunca se "inventa".
 */
import { getDb } from '../connection.js';
import { normalizeJid } from '../../utils/ids.js';
import { usersRepo } from './users.repo.js';

const now = () => Date.now();

export const warningsRepo = {
  /** Añade una advertencia y devuelve el total activo del usuario. */
  add(groupId, userJid, { reason = '', adminJid = null } = {}) {
    const group = normalizeJid(groupId);
    const user = normalizeJid(userJid);
    getDb()
      .prepare(
        `INSERT INTO warnings (group_id, user_jid, reason, admin_jid, created_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run(group, user, String(reason).slice(0, 200), adminJid ? normalizeJid(adminJid) : null, now());
    const total = usersRepo.recalcWarnings(group, user);
    const last = getDb()
      .prepare('SELECT * FROM warnings WHERE group_id = ? AND user_jid = ? ORDER BY id DESC LIMIT 1')
      .get(group, user);
    return { warning: last, total };
  },

  /** Revoca la advertencia activa más reciente. Devuelve null si no había ninguna. */
  revokeLast(groupId, userJid, revokedBy = null) {
    const group = normalizeJid(groupId);
    const user = normalizeJid(userJid);
    const last = getDb()
      .prepare(
        `SELECT * FROM warnings WHERE group_id = ? AND user_jid = ? AND revoked_at IS NULL ORDER BY id DESC LIMIT 1`
      )
      .get(group, user);
    if (!last) return null;
    getDb()
      .prepare('UPDATE warnings SET revoked_at = ?, revoked_by = ? WHERE id = ?')
      .run(now(), revokedBy ? normalizeJid(revokedBy) : null, last.id);
    const total = usersRepo.recalcWarnings(group, user);
    return { warning: last, total };
  },

  list(groupId, userJid, { includeRevoked = false } = {}) {
    const params = [normalizeJid(groupId), normalizeJid(userJid)];
    let sql = 'SELECT * FROM warnings WHERE group_id = ? AND user_jid = ?';
    if (!includeRevoked) sql += ' AND revoked_at IS NULL';
    return getDb().prepare(`${sql} ORDER BY created_at DESC`).all(...params);
  },

  activeCount(groupId, userJid) {
    const { n } = getDb()
      .prepare('SELECT COUNT(*) AS n FROM warnings WHERE group_id = ? AND user_jid = ? AND revoked_at IS NULL')
      .get(normalizeJid(groupId), normalizeJid(userJid));
    return Number(n);
  },

  /** Ranking de advertidos (para reportes de administración). */
  topWarned(groupId, limit = 10) {
    return getDb()
      .prepare(
        `SELECT u.jid, u.name, u.warn_count FROM users u
         WHERE u.group_id = ? AND u.warn_count > 0 ORDER BY u.warn_count DESC, u.name ASC LIMIT ?`
      )
      .all(normalizeJid(groupId), Number(limit));
  },
};
