/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · repositorio de sub-bots (instancias)
 */
import { getDb } from '../connection.js';
import { newId } from '../../utils/ids.js';

const TABLE = 'bot_instances';

export const instancesRepo = {
  /** Crea una instancia. Lanza si el número ya está en uso. */
  create({ name, phone, pairingMode = 'qr', sessionDir }) {
    const id = newId(10);
    const now = Date.now();
    getDb()
      .prepare(
        `INSERT INTO ${TABLE}
           (id, name, phone, pairing_mode, status, session_dir, autostart, created_at, updated_at)
         VALUES (@id, @name, @phone, @pairingMode, 'created', @sessionDir, 1, @now, @now)`
      )
      .run({ id, name, phone, pairingMode, sessionDir, now });
    return this.byId(id);
  },

  byId(id) {
    return getDb().prepare(`SELECT * FROM ${TABLE} WHERE id = ?`).get(id) ?? null;
  },

  byPhone(phone) {
    return getDb().prepare(`SELECT * FROM ${TABLE} WHERE phone = ?`).get(String(phone)) ?? null;
  },

  all() {
    return getDb().prepare(`SELECT * FROM ${TABLE} ORDER BY created_at ASC`).all();
  },

  count() {
    return Number(getDb().prepare(`SELECT COUNT(*) AS n FROM ${TABLE}`).get().n);
  },

  /** Estado de conexión en vivo (created|starting|qr|pairing|connecting|open|closed|error|loggedOut). */
  setStatus(id, status, extra = {}) {
    getDb()
      .prepare(
        `UPDATE ${TABLE} SET status = @status, updated_at = @now,
           wa_jid = COALESCE(@waJid, wa_jid),
           push_name = COALESCE(@pushName, push_name),
           last_error = COALESCE(@lastError, last_error),
           last_connected_at = CASE WHEN @connected = 1 THEN @now ELSE last_connected_at END
         WHERE id = @id`
      )
      .run({
        id,
        status,
        now: Date.now(),
        waJid: extra.waJid ?? null,
        pushName: extra.pushName ?? null,
        lastError: extra.lastError ?? null,
        connected: status === 'open' ? 1 : 0,
      });
  },

  setAutostart(id, value) {
    getDb()
      .prepare(`UPDATE ${TABLE} SET autostart = ?, updated_at = ? WHERE id = ?`)
      .run(value ? 1 : 0, Date.now(), id);
  },

  rename(id, name) {
    getDb()
      .prepare(`UPDATE ${TABLE} SET name = ?, updated_at = ? WHERE id = ?`)
      .run(String(name).slice(0, 40), Date.now(), id);
  },

  remove(id) {
    return getDb().prepare(`DELETE FROM ${TABLE} WHERE id = ?`).run(id).changes;
  },
};
