/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · repositorio de solicitudes
 * ────────────────────────────────────────────────────────────────
 * Rol, cambio de rol y pareja viven en la misma tabla con `type`.
 * La resolución es ATÓMICA: `UPDATE ... WHERE status='pending'` y se
 * comprueba `changes === 1`, así dos admins que pulsen a la vez no
 * pueden ejecutar la misma solicitud dos veces.
 */
import { getDb } from '../connection.js';
import { normalizeJid } from '../../utils/ids.js';

const now = () => Date.now();

const WITH_USER = `
  SELECT rq.*, u.name AS user_name, t.name AS target_name,
         ru.name AS resolver_name
  FROM requests rq
  LEFT JOIN users u  ON u.group_id = rq.group_id AND u.jid = rq.user_jid
  LEFT JOIN users t  ON t.group_id = rq.group_id AND t.jid = rq.target_jid
  LEFT JOIN users ru ON ru.group_id = rq.group_id AND ru.jid = rq.resolved_by
`;

export const requestsRepo = {
  create({ groupId, userJid, targetJid = null, roleName = null, prevRoleName = null, type, waMessageId = null, reason = null }) {
    const info = getDb()
      .prepare(
        `INSERT INTO requests
           (group_id, user_jid, target_jid, role_name, prev_role_name, type, status, wa_message_id, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
      )
      .run(
        normalizeJid(groupId),
        normalizeJid(userJid),
        targetJid ? normalizeJid(targetJid) : null,
        roleName ? String(roleName).slice(0, 32) : null,
        prevRoleName ? String(prevRoleName).slice(0, 32) : null,
        type,
        waMessageId ? String(waMessageId) : null,
        reason ? String(reason).slice(0, 200) : null,
        now()
      );
    return this.get(info.lastInsertRowid);
  },

  get(id) {
    return getDb().prepare(`${WITH_USER} WHERE rq.id = ?`).get(Number(id)) ?? null;
  },

  byMessageId(waMessageId) {
    if (!waMessageId) return null;
    return getDb().prepare(`${WITH_USER} WHERE rq.wa_message_id = ?`).get(String(waMessageId)) ?? null;
  },

  /** Solicitud pendiente de un usuario (por tipo o de cualquier tipo de rol). */
  pendingForUser(groupId, userJid, type = null) {
    const params = [normalizeJid(groupId), normalizeJid(userJid)];
    let sql = `${WITH_USER} WHERE rq.group_id = ? AND rq.user_jid = ? AND rq.status = 'pending'`;
    if (type) {
      if (Array.isArray(type)) {
        sql += ` AND rq.type IN (${type.map(() => '?').join(',')})`;
        params.push(...type);
      } else {
        sql += ' AND rq.type = ?';
        params.push(type);
      }
    }
    return getDb().prepare(`${sql} ORDER BY rq.created_at DESC LIMIT 1`).get(...params) ?? null;
  },

  /** Propuesta de pareja pendiente dirigida a `targetJid`. */
  pendingForTarget(groupId, targetJid, type = 'couple') {
    return (
      getDb()
        .prepare(
          `${WITH_USER} WHERE rq.group_id = ? AND rq.target_jid = ? AND rq.type = ? AND rq.status = 'pending'
           ORDER BY rq.created_at DESC LIMIT 1`
        )
        .get(normalizeJid(groupId), normalizeJid(targetJid), type) ?? null
    );
  },

  listPending(groupId, type = null) {
    const jid = normalizeJid(groupId);
    return type
      ? getDb()
          .prepare(`${WITH_USER} WHERE rq.group_id = ? AND rq.status = 'pending' AND rq.type = ? ORDER BY rq.created_at ASC`)
          .all(jid, type)
      : getDb()
          .prepare(`${WITH_USER} WHERE rq.group_id = ? AND rq.status = 'pending' ORDER BY rq.created_at ASC`)
          .all(jid);
  },

  list(groupId, { limit = 15, status = null } = {}) {
    const params = [normalizeJid(groupId)];
    let sql = `${WITH_USER} WHERE rq.group_id = ?`;
    if (status) {
      sql += ' AND rq.status = ?';
      params.push(status);
    }
    params.push(Number(limit));
    return getDb().prepare(`${sql} ORDER BY rq.created_at DESC LIMIT ?`).all(...params);
  },

  /**
   * Resuelve una solicitud de forma atómica.
   * @returns {object|null} la solicitud resuelta, o null si ya no estaba pendiente.
   */
  resolve(id, status, resolvedBy = null, extra = {}) {
    const info = getDb()
      .prepare(
        `UPDATE requests
            SET status = @status, resolved_at = @ts, resolved_by = @by,
                reason = COALESCE(@reason, reason)
          WHERE id = @id AND status = 'pending'`
      )
      .run({ id: Number(id), status, ts: now(), by: resolvedBy ? normalizeJid(resolvedBy) : null, reason: extra.reason ?? null });
    if (info.changes !== 1) return null;
    return this.get(id);
  },

  setWaMessageId(id, waMessageId) {
    getDb().prepare('UPDATE requests SET wa_message_id = ? WHERE id = ?').run(String(waMessageId), Number(id));
  },

  /** Cancela en lote las solicitudes pendientes de un usuario (al hacer .unreg o salir). */
  cancelAllForUser(groupId, userJid, reason = 'usuario eliminado') {
    return getDb()
      .prepare(
        `UPDATE requests SET status = 'cancelled', resolved_at = ?, reason = ?
         WHERE group_id = ? AND status = 'pending' AND (user_jid = ? OR target_jid = ?)`
      )
      .run(now(), reason, normalizeJid(groupId), normalizeJid(userJid), normalizeJid(userJid)).changes;
  },

  /** Marca como expiradas las solicitudes demasiado antiguas. */
  expireOlderThan(maxAgeMs, types = null) {
    const cutoff = now() - Number(maxAgeMs);
    let sql = `UPDATE requests SET status = 'expired', resolved_at = @ts
               WHERE status = 'pending' AND created_at <= @cutoff`;
    if (types?.length) sql += ` AND type IN (${types.map((_t, i) => `@t${i}`).join(',')})`;
    const bind = { ts: now(), cutoff };
    (types ?? []).forEach((type, i) => {
      bind[`t${i}`] = type;
    });
    return getDb().prepare(sql).run(bind).changes;
  },

  counts(groupId) {
    const rows = getDb()
      .prepare('SELECT status, COUNT(*) AS n FROM requests WHERE group_id = ? GROUP BY status')
      .all(normalizeJid(groupId));
    const out = { pending: 0, approved: 0, rejected: 0, cancelled: 0, expired: 0, total: 0 };
    for (const row of rows) {
      out[row.status] = Number(row.n);
      out.total += Number(row.n);
    }
    return out;
  },
};
