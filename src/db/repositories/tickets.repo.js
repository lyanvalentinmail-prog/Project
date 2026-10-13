/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · tickets del panel web (persistidos en la BD)
 */
import { getDb } from '../connection.js';
import { newId } from '../../utils/ids.js';

const TABLE = 'web_tickets';

export const ticketsRepo = {
  create({ title, message = '' }) {
    const id = `SW-${newId(10).toUpperCase().slice(0, 5)}`;
    const now = Date.now();
    getDb()
      .prepare(
        `INSERT INTO ${TABLE} (id, title, message, status, created_at, updated_at)
         VALUES (?, ?, ?, 'Abierto', ?, ?)`
      )
      .run(id, String(title).slice(0, 120), String(message).slice(0, 2000), now, now);
    return this.byId(id);
  },

  byId(id) {
    return getDb().prepare(`SELECT * FROM ${TABLE} WHERE id = ?`).get(id) ?? null;
  },

  all({ limit = 100 } = {}) {
    return getDb().prepare(`SELECT * FROM ${TABLE} ORDER BY created_at DESC LIMIT ?`).all(limit);
  },

  setStatus(id, status) {
    if (!['Abierto', 'Respondido', 'Cerrado'].includes(status)) return false;
    return getDb().prepare(`UPDATE ${TABLE} SET status = ?, updated_at = ? WHERE id = ?`).run(status, Date.now(), id).changes > 0;
  },

  counts() {
    const rows = getDb().prepare(`SELECT status, COUNT(*) AS n FROM ${TABLE} GROUP BY status`).all();
    const out = { total: 0, Abierto: 0, Respondido: 0, Cerrado: 0 };
    for (const row of rows) {
      out[row.status] = Number(row.n);
      out.total += Number(row.n);
    }
    return out;
  },
};

export default ticketsRepo;
