/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · conexión SQLite
 * ────────────────────────────────────────────────────────────────
 * Una única conexión compartida (mejor-sqlite3 es síncrono y seguro
 * dentro de un proceso), en modo WAL para que el panel web pueda leer
 * mientras el bot escribe. Las credenciales de WhatsApp NO van aquí:
 * viven en sesiones cifradas por Signal dentro de `sessions/`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { env, ensurePrivateDir } from '../config/env.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {Database.Database | null} */
let db = null;

/** Versiones de esquema aplicadas en orden. Cada una debe ser idempotente. */
const MIGRATIONS = [
  {
    version: 1,
    name: 'esquema inicial',
    up(database) {
      const schema = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');
      database.exec(schema);
    },
  },
  {
    version: 2,
    name: 'sistema de créditos',
    up(database) {
      const schema = fs.readFileSync(path.join(here, 'schema-credits.sql'), 'utf8');
      database.exec(schema);
    },
  },
  {
    version: 3,
    name: 'activación por clave, prefijo por bot, tickets y métricas',
    up(database) {
      const schema = fs.readFileSync(path.join(here, 'schema-v3.sql'), 'utf8');
      database.exec(schema);
    },
  },
  {
    version: 4,
    name: 'bots habilitados sin clave de activación',
    up(database) {
      // No cambia autostart: los bots detenidos siguen detenidos.
      database.prepare(`UPDATE bot_instances
        SET activated = 1, activated_at = COALESCE(activated_at, ?), updated_at = ?
        WHERE activated = 0`).run(Date.now(), Date.now());
    },
  },
];

/** Devuelve la conexión activa (la crea si aún no existe). */
export function getDb() {
  if (!db) initDatabase();
  return db;
}

/** Abre la BD, aplica pragmas y migraciones. Idempotente. */
export function initDatabase(dbPath = env.dbPath) {
  if (db) return db;

  ensurePrivateDir(path.dirname(dbPath));
  const database = new Database(dbPath);

  database.pragma('journal_mode = WAL');
  database.pragma('synchronous = NORMAL');
  database.pragma('foreign_keys = ON');
  database.pragma('busy_timeout = 5000');

  database.exec(`CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL
  );`);

  const get = database.prepare('SELECT value FROM meta WHERE key = ?');
  const set = database.prepare(
    `INSERT INTO meta (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  );

  const applied = Number(get.get('schema_version')?.value ?? 0);
  const now = Date.now();

  for (const migration of MIGRATIONS) {
    if (migration.version <= applied) continue;
    database.transaction(() => {
      migration.up(database);
      set.run('schema_version', String(migration.version), Date.now());
    })();
  }

  set.run('installed_at', get.get('installed_at')?.value ?? String(now), now);
  db = database;
  return db;
}

/** Cierra la conexión de forma limpia (flush de WAL). */
export function closeDatabase() {
  if (!db) return;
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
  } catch {
    /* ya cerrada */
  }
  db = null;
}

/**
 * Ejecuta `fn` dentro de una transacción y la confirma solo si no lanza.
 * Cualquier error hace rollback automático → invariantes intactos.
 */
export function tx(fn) {
  const database = getDb();
  return database.transaction(fn)();
}

/** Lee/escribe claves sueltas en `meta`. */
export const meta = {
  get(key, fallback = null) {
    const row = getDb().prepare('SELECT value FROM meta WHERE key = ?').get(key);
    return row ? row.value : fallback;
  },
  set(key, value) {
    getDb()
      .prepare(
        `INSERT INTO meta (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
      .run(key, String(value), Date.now());
  },
};
