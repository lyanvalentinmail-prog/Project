/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · estadísticas reales (nada de datos inventados)
 * ────────────────────────────────────────────────────────────────
 * Contadores persistidos en la base de datos: comandos ejecutados,
 * mensajes procesados y peticiones al panel. Lo que muestra la web
 * sale de aquí (o de consultas directas), nunca de valores fijos.
 */
import { getDb } from '../connection.js';

export const statsRepo = {
  /** Registra una ejecución de comando. */
  bumpCommand(command) {
    const name = String(command ?? 'unknown').toLowerCase().slice(0, 32);
    getDb()
      .prepare(
        `INSERT INTO command_stats (command, count, last_used_at) VALUES (?, 1, ?)
         ON CONFLICT(command) DO UPDATE SET count = count + 1, last_used_at = excluded.last_used_at`
      )
      .run(name, Date.now());
  },

  topCommands(limit = 10) {
    return getDb()
      .prepare(`SELECT command, count, last_used_at FROM command_stats ORDER BY count DESC LIMIT ?`)
      .all(limit)
      .map((row) => ({ command: row.command, count: Number(row.count), lastUsedAt: row.last_used_at }));
  },

  totalCommands() {
    return Number(getDb().prepare(`SELECT COALESCE(SUM(count), 0) AS n FROM command_stats`).get().n);
  },

  /** Incrementa un contador libre (messages, apiRequests…). */
  bump(name, by = 1) {
    const key = String(name).slice(0, 40);
    getDb()
      .prepare(
        `INSERT INTO counters (name, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET value = value + ?, updated_at = excluded.updated_at`
      )
      .run(key, by, Date.now(), by);
  },

  get(name, fallback = 0) {
    const row = getDb().prepare(`SELECT value FROM counters WHERE name = ?`).get(String(name));
    return row ? Number(row.value) : fallback;
  },

  all() {
    const out = {};
    for (const row of getDb().prepare(`SELECT name, value FROM counters`).all()) out[row.name] = Number(row.value);
    return out;
  },

  /** Recuento REAL de filas de cada tabla principal (para el panel). */
  tableCounts() {
    const tables = [
      'bot_instances',
      'groups',
      'users',
      'roles',
      'requests',
      'warnings',
      'activation_keys',
      'command_stats',
      'web_tickets',
      'web_users',
      'api_keys',
      'audit_log',
    ];
    const out = {};
    for (const table of tables) {
      try {
        out[table] = Number(getDb().prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n);
      } catch {
        out[table] = 0;
      }
    }
    return out;
  },
};

export default statsRepo;
