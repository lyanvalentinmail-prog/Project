/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · repositorio de integrantes
 * ────────────────────────────────────────────────────────────────
 * La clave primaria compuesta (group_id, jid) es la que impide los
 * registros duplicados: el mismo número puede existir en grupos
 * distintos, pero nunca dos veces en el mismo grupo.
 */
import { getDb, tx } from '../connection.js';
import { normalizeJid, jidToPhone } from '../../utils/ids.js';

const now = () => Date.now();

const WITH_ROLE = `
  SELECT u.*, r.name AS role_name, r.status AS role_status, r.id AS role_id_fk,
         p.name AS partner_name
  FROM users u
  LEFT JOIN roles r ON r.id = u.role_id
  LEFT JOIN users p ON p.group_id = u.group_id AND p.jid = u.partner_jid
`;

export const usersRepo = {
  /**
   * Crea el registro. Lanza un error con `code:'DUPLICATE'` si ya existía
   * (doble protección: comprobación previa + restricción de clave primaria).
   */
  create({ groupId, jid, name, age, pushName = null }) {
    const group = normalizeJid(groupId);
    const user = normalizeJid(jid);
    const ts = now();
    try {
      getDb()
        .prepare(
          `INSERT INTO users
             (group_id, jid, phone, name, age, registered_at, last_activity, status, push_name, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
        )
        .run(group, user, jidToPhone(user), String(name).slice(0, 24), Number(age), ts, ts, pushName, ts);
    } catch (error) {
      if (String(error?.message ?? '').includes('UNIQUE')) {
        const err = new Error('El usuario ya está registrado en este grupo.');
        err.code = 'DUPLICATE';
        throw err;
      }
      throw error;
    }
    return this.get(group, user);
  },

  get(groupId, jid) {
    return (
      getDb()
        .prepare(`${WITH_ROLE} WHERE u.group_id = ? AND u.jid = ?`)
        .get(normalizeJid(groupId), normalizeJid(jid)) ?? null
    );
  },

  exists(groupId, jid) {
    return Boolean(
      getDb()
        .prepare('SELECT 1 AS ok FROM users WHERE group_id = ? AND jid = ?')
        .get(normalizeJid(groupId), normalizeJid(jid))
    );
  },

  list(groupId, { status = 'active', includeLeft = false } = {}) {
    const jid = normalizeJid(groupId);
    if (includeLeft) {
      return getDb().prepare(`${WITH_ROLE} WHERE u.group_id = ? ORDER BY u.name ASC`).all(jid);
    }
    return getDb()
      .prepare(`${WITH_ROLE} WHERE u.group_id = ? AND u.status = ? ORDER BY u.name ASC`)
      .all(jid, status);
  },

  /** Actualización parcial de columnas permitidas. */
  update(groupId, jid, patch) {
    const allowed = {
      name: (v) => String(v).slice(0, 24),
      age: (v) => Number(v),
      role_id: (v) => (v === null ? null : Number(v)),
      afk_reason: (v) => (v === null ? null : String(v).slice(0, 120)),
      afk_since: (v) => (v === null ? null : Number(v)),
      partner_jid: (v) => (v ? normalizeJid(v) : null),
      warn_count: (v) => Number(v),
      status: (v) => String(v),
      left_at: (v) => (v === null ? null : Number(v)),
      last_activity: (v) => Number(v),
      push_name: (v) => (v === null ? null : String(v).slice(0, 60)),
    };
    const entries = Object.entries(patch).filter(([k]) => allowed[k] !== undefined);
    if (!entries.length) return this.get(groupId, jid);
    const sets = entries.map(([k]) => `${k} = @${k}`).join(', ');
    const params = { group_id: normalizeJid(groupId), jid: normalizeJid(jid), updated_at: now() };
    for (const [k, v] of entries) params[k] = allowed[k](v);
    getDb().prepare(`UPDATE users SET ${sets}, updated_at = @updated_at WHERE group_id = @group_id AND jid = @jid`).run(params);
    return this.get(groupId, jid);
  },

  remove(groupId, jid) {
    return getDb()
      .prepare('DELETE FROM users WHERE group_id = ? AND jid = ?')
      .run(normalizeJid(groupId), normalizeJid(jid)).changes;
  },

  /* ── actividad / AFK ────────────────────────────────────────── */

  touch(groupId, jid, ts = Date.now()) {
    getDb()
      .prepare('UPDATE users SET last_activity = ?, updated_at = ? WHERE group_id = ? AND jid = ?')
      .run(ts, ts, normalizeJid(groupId), normalizeJid(jid));
  },

  setAfk(groupId, jid, reason) {
    return this.update(groupId, jid, { afk_reason: reason, afk_since: now() });
  },

  clearAfk(groupId, jid) {
    return this.update(groupId, jid, { afk_reason: null, afk_since: null });
  },

  listAfk(groupId) {
    return getDb()
      .prepare(`${WITH_ROLE} WHERE u.group_id = ? AND u.afk_reason IS NOT NULL ORDER BY u.afk_since ASC`)
      .all(normalizeJid(groupId));
  },

  /** Integrantes sin actividad desde hace `days` días o más, de mayor a menor. */
  listInactives(groupId, days) {
    const cutoff = Date.now() - Number(days) * 86_400_000;
    return getDb()
      .prepare(
        `${WITH_ROLE} WHERE u.group_id = ? AND u.status = 'active' AND u.last_activity <= ?
         ORDER BY u.last_activity ASC`
      )
      .all(normalizeJid(groupId), cutoff);
  },

  /* ── parejas ────────────────────────────────────────────────── */

  /** Establece la relación en ambos sentidos dentro de una transacción. */
  setCouple(groupId, aJid, bJid) {
    const group = normalizeJid(groupId);
    const a = normalizeJid(aJid);
    const b = normalizeJid(bJid);
    return tx(() => {
      const stmt = getDb().prepare('UPDATE users SET partner_jid = ?, updated_at = ? WHERE group_id = ? AND jid = ?');
      const r1 = stmt.run(b, now(), group, a);
      const r2 = stmt.run(a, now(), group, b);
      if (r1.changes !== 1 || r2.changes !== 1) throw new Error('No se pudo registrar la pareja.');
      return { a: this.get(group, a), b: this.get(group, b) };
    });
  },

  /** Rompe la relación en ambos sentidos (tolera que un lado ya no exista). */
  breakCouple(groupId, jid, partnerJid) {
    const group = normalizeJid(groupId);
    return tx(() => {
      getDb().prepare('UPDATE users SET partner_jid = NULL, updated_at = ? WHERE group_id = ? AND jid = ?').run(now(), group, normalizeJid(jid));
      if (partnerJid) {
        getDb()
          .prepare('UPDATE users SET partner_jid = NULL, updated_at = ? WHERE group_id = ? AND jid = ?')
          .run(now(), group, normalizeJid(partnerJid));
      }
      return true;
    });
  },

  /* ── estado de pertenencia al grupo ─────────────────────────── */

  /** Marca a alguien como fuera del grupo (conserva su historial). */
  markLeft(groupId, jid, status = 'left') {
    getDb()
      .prepare('UPDATE users SET status = ?, left_at = ?, updated_at = ? WHERE group_id = ? AND jid = ?')
      .run(status, now(), now(), normalizeJid(groupId), normalizeJid(jid));
  },

  reactivate(groupId, jid) {
    getDb()
      .prepare(`UPDATE users SET status = 'active', left_at = NULL, last_activity = ?, updated_at = ? WHERE group_id = ? AND jid = ?`)
      .run(now(), now(), normalizeJid(groupId), normalizeJid(jid));
  },

  /* ── contadores ─────────────────────────────────────────────── */

  counts(groupId) {
    const jid = normalizeJid(groupId);
    const active = Number(getDb().prepare(`SELECT COUNT(*) AS n FROM users WHERE group_id = ? AND status = 'active'`).get(jid).n);
    const total = Number(getDb().prepare('SELECT COUNT(*) AS n FROM users WHERE group_id = ?').get(jid).n);
    const withRole = Number(
      getDb().prepare(`SELECT COUNT(*) AS n FROM users WHERE group_id = ? AND role_id IS NOT NULL AND status = 'active'`).get(jid).n
    );
    const afk = Number(
      getDb().prepare(`SELECT COUNT(*) AS n FROM users WHERE group_id = ? AND afk_reason IS NOT NULL AND status = 'active'`).get(jid).n
    );
    const couples = Number(
      getDb().prepare(`SELECT COUNT(*) AS n FROM users WHERE group_id = ? AND partner_jid IS NOT NULL AND status = 'active'`).get(jid).n
    );
    return { active, total, withRole, afk, couples: Math.floor(couples / 2) };
  },

  /** Recalcula `warn_count` desde la tabla de advertencias (fuente de verdad). */
  recalcWarnings(groupId, jid) {
    const group = normalizeJid(groupId);
    const user = normalizeJid(jid);
    const { n } = getDb()
      .prepare('SELECT COUNT(*) AS n FROM warnings WHERE group_id = ? AND user_jid = ? AND revoked_at IS NULL')
      .get(group, user);
    getDb().prepare('UPDATE users SET warn_count = ?, updated_at = ? WHERE group_id = ? AND jid = ?').run(Number(n), now(), group, user);
    return Number(n);
  },
};
