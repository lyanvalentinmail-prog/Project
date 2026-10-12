/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · repositorio de confirmaciones pendientes
 * ────────────────────────────────────────────────────────────────
 * Acción importante → confirmación obligatoria (seguridad #8).
 * Se guardan en la base de datos, así que sobreviven un reinicio,
 * y expiran solas (por defecto 60 s).
 */
import { getDb } from '../connection.js';
import { normalizeJid, newId } from '../../utils/ids.js';

export const DEFAULT_TTL_MS = 60_000;

export const confirmationsRepo = {
  /**
   * Crea (o reemplaza) la confirmación pendiente de un usuario.
   * Solo puede haber UNA por usuario y grupo: si pide otra cosa antes,
   * la anterior se descarta y se avisa.
   */
  create({ groupId, userJid, action, payload = {}, ttlMs = DEFAULT_TTL_MS }) {
    const group = normalizeJid(groupId);
    const user = normalizeJid(userJid);
    const ts = Date.now();
    const replaced = this.cancel(group, user);
    const id = newId(10);
    getDb()
      .prepare(
        `INSERT INTO pending_confirmations (id, group_id, user_jid, action, payload, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, group, user, String(action), JSON.stringify(payload ?? {}), ts, ts + Number(ttlMs));
    return { id, group_id: group, user_jid: user, action, payload, created_at: ts, expires_at: ts + Number(ttlMs), replaced };
  },

  /** Devuelve la confirmación vigente del usuario (o null). */
  getFor(groupId, userJid) {
    const row = getDb()
      .prepare('SELECT * FROM pending_confirmations WHERE group_id = ? AND user_jid = ?')
      .get(normalizeJid(groupId), normalizeJid(userJid));
    if (!row) return null;
    if (row.expires_at <= Date.now()) {
      getDb().prepare('DELETE FROM pending_confirmations WHERE id = ?').run(row.id);
      return null;
    }
    try {
      return { ...row, payload: JSON.parse(row.payload || '{}') };
    } catch {
      return { ...row, payload: {} };
    }
  },

  /** Consume la confirmación: la borra y la devuelve (solo se puede usar una vez). */
  consume(groupId, userJid, expectedAction = null) {
    const pending = this.getFor(groupId, userJid);
    if (!pending) return null;
    if (expectedAction && pending.action !== expectedAction) return null;
    getDb().prepare('DELETE FROM pending_confirmations WHERE id = ?').run(pending.id);
    return pending;
  },

  cancel(groupId, userJid) {
    return getDb()
      .prepare('DELETE FROM pending_confirmations WHERE group_id = ? AND user_jid = ?')
      .run(normalizeJid(groupId), normalizeJid(userJid)).changes;
  },

  /** Limpia confirmaciones vencidas (lo llama el temporizador de mantenimiento). */
  purgeExpired(at = Date.now()) {
    return getDb().prepare('DELETE FROM pending_confirmations WHERE expires_at <= ?').run(at).changes;
  },

  count() {
    return Number(getDb().prepare('SELECT COUNT(*) AS n FROM pending_confirmations').get().n);
  },
};
