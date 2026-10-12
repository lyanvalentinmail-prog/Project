/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · repositorio de personajes (roles)
 * ────────────────────────────────────────────────────────────────
 * Invariantes garantizados por el motor de SQLite:
 *  · UNIQUE(group_id, name_key)            → no hay dos personajes iguales
 *  · UNIQUE(group_id, owner_jid) parcial   → un usuario no ocupa dos personajes
 *  · UNIQUE(group_id, reserved_by) parcial → un usuario no reserva dos personajes
 */
import { getDb, tx } from '../connection.js';
import { normalizeJid } from '../../utils/ids.js';

const now = () => Date.now();

/** Clave canónica: minúsculas, sin acentos y con espacios colapsados. */
export function roleKey(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const withOwnerName = `
  SELECT r.*, u.name AS owner_name, u.age AS owner_age, r2.name AS reserved_by_name
  FROM roles r
  LEFT JOIN users u  ON u.group_id = r.group_id AND u.jid = r.owner_jid
  LEFT JOIN users r2 ON r2.group_id = r.group_id AND r2.jid = r.reserved_by
`;

export const rolesRepo = {
  roleKey,

  /** Busca por nombre (insensible a mayúsculas/acentos). */
  findByName(groupId, name) {
    return (
      getDb()
        .prepare(`${withOwnerName} WHERE r.group_id = ? AND r.name_key = ?`)
        .get(normalizeJid(groupId), roleKey(name)) ?? null
    );
  },

  findById(id) {
    return getDb().prepare(`${withOwnerName} WHERE r.id = ?`).get(Number(id)) ?? null;
  },

  /** Crea el personaje en estado libre si no existe; si existe, lo devuelve. */
  ensure(groupId, name) {
    const jid = normalizeJid(groupId);
    const key = roleKey(name);
    const display = String(name).trim().slice(0, 32);
    return tx(() => {
      const existing = getDb().prepare('SELECT * FROM roles WHERE group_id = ? AND name_key = ?').get(jid, key);
      if (existing) return this.findById(existing.id);
      const ts = now();
      const info = getDb()
        .prepare(
          `INSERT INTO roles (group_id, name, name_key, status, created_at, updated_at)
           VALUES (?, ?, ?, 'free', ?, ?)`
        )
        .run(jid, display, key, ts, ts);
      return this.findById(info.lastInsertRowid);
    });
  },

  list(groupId, { status = null } = {}) {
    const jid = normalizeJid(groupId);
    return status
      ? getDb().prepare(`${withOwnerName} WHERE r.group_id = ? AND r.status = ? ORDER BY r.name ASC`).all(jid, status)
      : getDb().prepare(`${withOwnerName} WHERE r.group_id = ? ORDER BY r.status ASC, r.name ASC`).all(jid);
  },

  /** Personajes ocupados con los datos de quien los usa. */
  listTaken(groupId) {
    return getDb()
      .prepare(
        `SELECT r.*, u.name AS owner_name, u.age AS owner_age
         FROM roles r LEFT JOIN users u ON u.group_id = r.group_id AND u.jid = r.owner_jid
         WHERE r.group_id = ? AND r.status = 'taken' ORDER BY r.name ASC`
      )
      .all(normalizeJid(groupId));
  },

  listReserved(groupId) {
    return getDb()
      .prepare(
        `SELECT r.*, u.name AS reserved_name
         FROM roles r LEFT JOIN users u ON u.group_id = r.group_id AND u.jid = r.reserved_by
         WHERE r.group_id = ? AND r.status = 'reserved' ORDER BY r.reserved_until ASC`
      )
      .all(normalizeJid(groupId));
  },

  /**
   * Asigna el personaje a un usuario (liberando cualquier reserva previa).
   * Última barrera del invariante "un personaje, un dueño": si ya pertenece a
   * OTRA persona, no hace nada y devuelve false (nunca lo "roba").
   */
  assign(roleId, userJid) {
    const ts = now();
    const info = getDb()
      .prepare(
        `UPDATE roles SET status = 'taken', owner_jid = @jid, taken_at = @ts, updated_at = @ts,
                reserved_by = NULL, reserved_at = NULL, reserved_until = NULL, released_at = NULL
         WHERE id = @id AND (status != 'taken' OR owner_jid IS NULL OR owner_jid = @jid)`
      )
      .run({ id: Number(roleId), jid: normalizeJid(userJid), ts });
    return info.changes > 0;
  },

  /** Libera un personaje: vuelve al pool como libre. */
  release(roleId) {
    const ts = now();
    const info = getDb()
      .prepare(
        `UPDATE roles SET status = 'free', owner_jid = NULL, taken_at = NULL, updated_at = ?,
                reserved_by = NULL, reserved_at = NULL, reserved_until = NULL, released_at = ?
         WHERE id = ?`
      )
      .run(ts, ts, Number(roleId));
    return info.changes > 0;
  },

  reserve(roleId, userJid, untilTs) {
    const ts = now();
    const info = getDb()
      .prepare(
        `UPDATE roles SET status = 'reserved', reserved_by = ?, reserved_at = ?, reserved_until = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(normalizeJid(userJid), ts, Number(untilTs), ts, Number(roleId));
    return info.changes > 0;
  },

  unreserve(roleId) {
    const ts = now();
    const info = getDb()
      .prepare(
        `UPDATE roles SET status = 'free', reserved_by = NULL, reserved_at = NULL,
                reserved_until = NULL, updated_at = ?, released_at = ?
         WHERE id = ? AND status = 'reserved'`
      )
      .run(ts, ts, Number(roleId));
    return info.changes > 0;
  },

  /** Libera todas las reservas vencidas. Devuelve las filas afectadas. */
  releaseExpired(at = Date.now()) {
    const info = getDb()
      .prepare(
        `UPDATE roles SET status = 'free', reserved_by = NULL, reserved_at = NULL,
                reserved_until = NULL, released_at = ?, updated_at = ?
         WHERE status = 'reserved' AND reserved_until IS NOT NULL AND reserved_until <= ?`
      )
      .run(at, at, at);
    return info.changes;
  },

  listExpired(at = Date.now()) {
    return getDb()
      .prepare(`SELECT * FROM roles WHERE status = 'reserved' AND reserved_until <= ?`)
      .all(at);
  },

  /** Reserva activa de un usuario (máximo una por grupo). */
  reservationOf(groupId, userJid) {
    return (
      getDb()
        .prepare(`${withOwnerName} WHERE r.group_id = ? AND r.reserved_by = ? AND r.status = 'reserved'`)
        .get(normalizeJid(groupId), normalizeJid(userJid)) ?? null
    );
  },

  /** Personaje que ocupa un usuario. */
  ownedBy(groupId, userJid) {
    return (
      getDb()
        .prepare(`${withOwnerName} WHERE r.group_id = ? AND r.owner_jid = ?`)
        .get(normalizeJid(groupId), normalizeJid(userJid)) ?? null
    );
  },

  counts(groupId) {
    const jid = normalizeJid(groupId);
    const rows = getDb()
      .prepare('SELECT status, COUNT(*) AS n FROM roles WHERE group_id = ? GROUP BY status')
      .all(jid);
    const out = { total: 0, free: 0, taken: 0, reserved: 0 };
    for (const row of rows) {
      out[row.status] = Number(row.n);
      out.total += Number(row.n);
    }
    return out;
  },
};
