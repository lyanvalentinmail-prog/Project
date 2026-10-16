/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · motor SQLite
 * ────────────────────────────────────────────────────────────────
 * Elige el motor disponible y lo expone SIEMPRE con la misma API
 * (la de better-sqlite3), así el resto del proyecto no cambia:
 *
 *   1. better-sqlite3 → nativo y el más rápido. Se usa si está instalado
 *      y su binario carga en esta plataforma (PC, VPS, Render…).
 *   2. node:sqlite    → incluido en Node ≥ 22.13. No compila nada, por
 *      eso es el motor de Termux/Android, donde better-sqlite3 no trae
 *      binario precompilado.
 *
 * `DB_DRIVER` permite forzarlo: auto (por defecto) | better-sqlite3 | node.
 * Solo se implementa lo que usa el proyecto: prepare/run/get/all/iterate,
 * exec, pragma, transaction (con anidamiento por SAVEPOINT) y close.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/* ═══════════════════════════════════════════════════════════════
   Carga de los motores
   ═══════════════════════════════════════════════════════════════ */

/** node:sqlite avisa "ExperimentalWarning" al cargarse: se silencia SOLO ese aviso. */
function requireQuietly(id) {
  const original = process.emitWarning;
  process.emitWarning = function emitWarning(warning, ...args) {
    const type = typeof args[0] === 'string' ? args[0] : args[0]?.type;
    const text = String(warning?.message ?? warning ?? '');
    if ((type === 'ExperimentalWarning' || warning?.name === 'ExperimentalWarning') && /sqlite/i.test(text)) return;
    return original.call(this, warning, ...args);
  };
  try {
    return require(id);
  } finally {
    process.emitWarning = original;
  }
}

function loadBetterSqlite() {
  const Database = require('better-sqlite3');
  // `require` funciona aunque falte el binario: hay que abrir una BD para comprobarlo.
  const probe = new Database(':memory:');
  const sqliteVersion = probe.prepare('SELECT sqlite_version() AS v').get()?.v ?? null;
  probe.close();
  let version = null;
  try {
    version = require('better-sqlite3/package.json').version;
  } catch {
    /* sin package.json legible: no es grave */
  }
  return { name: 'better-sqlite3', version, sqliteVersion, open: (file) => new Database(file) };
}

function loadNodeSqlite() {
  const sqlite = requireQuietly('node:sqlite');
  if (typeof sqlite?.DatabaseSync !== 'function') throw new Error('node:sqlite no expone DatabaseSync');
  const probe = new sqlite.DatabaseSync(':memory:');
  const sqliteVersion = probe.prepare('SELECT sqlite_version() AS v').get()?.v ?? null;
  probe.close();
  return {
    name: 'node:sqlite',
    version: process.versions.node,
    sqliteVersion,
    open: (file) => new NodeSqliteDatabase(sqlite.DatabaseSync, file),
  };
}

const DRIVER_ALIASES = {
  auto: 'auto',
  '': 'auto',
  'better-sqlite3': 'better-sqlite3',
  better: 'better-sqlite3',
  native: 'better-sqlite3',
  node: 'node:sqlite',
  'node:sqlite': 'node:sqlite',
  'node-sqlite': 'node:sqlite',
  builtin: 'node:sqlite',
  sqlite: 'node:sqlite',
};

const short = (error) => String(error?.message ?? error).split('\n')[0].slice(0, 220);

let selected = null;

/**
 * Devuelve el motor elegido (se decide una sola vez por proceso).
 * @returns {{name:string, version:string|null, sqliteVersion:string|null, fallbackReason:string|null, open:(file:string)=>object}}
 */
export function getDriver() {
  if (selected) return selected;
  const requested = String(process.env.DB_DRIVER ?? 'auto').trim().toLowerCase();
  const preference = DRIVER_ALIASES[requested] ?? 'auto';

  if (preference === 'better-sqlite3') {
    try {
      selected = { ...loadBetterSqlite(), fallbackReason: null };
      return selected;
    } catch (error) {
      throw new Error(`DB_DRIVER=better-sqlite3 pero no se pudo cargar: ${short(error)}. ` +
        'Ejecuta "npm install" (necesita compilador en plataformas sin binario) o usa DB_DRIVER=auto.');
    }
  }

  if (preference === 'node:sqlite') {
    try {
      selected = { ...loadNodeSqlite(), fallbackReason: null };
      return selected;
    } catch (error) {
      throw new Error(`DB_DRIVER=node pero node:sqlite no está disponible en Node ${process.versions.node}: ${short(error)}. ` +
        'Actualiza Node a 22.13 o superior (en Termux: pkg install nodejs-lts).');
    }
  }

  let betterError = null;
  try {
    selected = { ...loadBetterSqlite(), fallbackReason: null };
    return selected;
  } catch (error) {
    betterError = error;
  }
  try {
    selected = { ...loadNodeSqlite(), fallbackReason: `better-sqlite3 no disponible (${short(betterError)})` };
    return selected;
  } catch (nodeError) {
    throw new Error(
      'No hay ningún motor SQLite disponible.\n' +
      `  · better-sqlite3: ${short(betterError)}\n` +
      `  · node:sqlite: ${short(nodeError)}\n` +
      'Solución: usa Node 22.13 o superior (incluye node:sqlite; en Termux: pkg install nodejs-lts) ' +
      'o ejecuta "npm install" para compilar better-sqlite3.'
    );
  }
}

/** Abre (o crea) una base de datos con el motor elegido. */
export function openDatabase(file) {
  return getDriver().open(file);
}

/** Resumen apto para el panel, el doctor y el banner (nunca lanza). */
export function driverInfo() {
  try {
    const { name, version, sqliteVersion, fallbackReason } = getDriver();
    return { ok: true, name, version, sqliteVersion, fallbackReason };
  } catch (error) {
    return { ok: false, name: null, version: null, sqliteVersion: null, fallbackReason: null, error: short(error) };
  }
}

/** Solo para tests: olvida el motor elegido para volver a decidir. */
export function resetDriverForTests() {
  selected = null;
}

/* ═══════════════════════════════════════════════════════════════
   Adaptador node:sqlite → API de better-sqlite3
   ═══════════════════════════════════════════════════════════════ */

const PLAIN_PROTO = Object.prototype;

/** Las filas de node:sqlite no tienen prototipo: se devuelven objetos normales. */
function toPlainRow(row) {
  if (row == null || typeof row !== 'object' || Object.getPrototypeOf(row) === PLAIN_PROTO) return row;
  return Object.assign({}, row);
}

/** better-sqlite3 enlaza `undefined` como NULL; node:sqlite lo rechaza. */
function toSqlValue(value) {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.getTime();
  return value;
}

const isNamedObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value) &&
  !ArrayBuffer.isView(value) && !(value instanceof ArrayBuffer) && !(value instanceof Date);

/** Nombres de parámetros (`@x`, `:x`, `$x`) fuera de literales y comentarios. */
function namedParameters(sql) {
  const names = new Set();
  const clean = String(sql)
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  for (const match of clean.matchAll(/[@:$]([A-Za-z_][A-Za-z0-9_]*)/g)) names.add(match[1]);
  return names;
}

class NodeSqliteStatement {
  constructor(statement, source) {
    this._statement = statement;
    this.source = source;
    this.reader = /^\s*(select|pragma|with|values|explain)\b/i.test(source) || /\breturning\b/i.test(source);
    this._filterNames = null;
    if (typeof statement.setAllowUnknownNamedParameters === 'function') {
      // Igual que better-sqlite3: las claves sobrantes del objeto se ignoran.
      statement.setAllowUnknownNamedParameters(true);
    } else {
      this._filterNames = namedParameters(source);
    }
  }

  /** Traduce los argumentos estilo better-sqlite3 (posicionales, arrays u objeto). */
  _bind(args) {
    let named = null;
    const positional = [];
    for (const arg of args) {
      if (Array.isArray(arg)) {
        for (const value of arg) positional.push(toSqlValue(value));
      } else if (isNamedObject(arg)) {
        named ??= {};
        for (const [key, value] of Object.entries(arg)) {
          const bare = key.replace(/^[@:$]/, '');
          if (this._filterNames && !this._filterNames.has(bare)) continue;
          named[key] = toSqlValue(value);
        }
      } else {
        positional.push(toSqlValue(arg));
      }
    }
    return named ? [named, ...positional] : positional;
  }

  run(...args) {
    const info = this._statement.run(...this._bind(args));
    return { changes: Number(info.changes), lastInsertRowid: info.lastInsertRowid };
  }

  get(...args) {
    const row = this._statement.get(...this._bind(args));
    return row === undefined ? undefined : toPlainRow(row);
  }

  all(...args) {
    return this._statement.all(...this._bind(args)).map(toPlainRow);
  }

  *iterate(...args) {
    if (typeof this._statement.iterate === 'function') {
      for (const row of this._statement.iterate(...this._bind(args))) yield toPlainRow(row);
      return;
    }
    yield* this.all(...args);
  }
}

class NodeSqliteDatabase {
  constructor(DatabaseSync, file) {
    this.name = file;
    this.memory = file === ':memory:' || file === '';
    this.readonly = false;
    this.driver = 'node:sqlite';
    this._db = new DatabaseSync(file);
    this._open = true;
    this._depth = 0;
  }

  get open() {
    return this._open;
  }

  get inTransaction() {
    if (typeof this._db.isTransaction === 'boolean') return this._db.isTransaction;
    return this._depth > 0;
  }

  prepare(source) {
    return new NodeSqliteStatement(this._db.prepare(source), source);
  }

  exec(source) {
    this._db.exec(source);
    return this;
  }

  /** `pragma('journal_mode = WAL')` → filas; `{ simple: true }` → primer valor. */
  pragma(source, options = {}) {
    if (typeof source !== 'string') throw new TypeError('pragma() espera un texto');
    const rows = this._db.prepare(`PRAGMA ${source}`).all().map(toPlainRow);
    if (options?.simple) {
      const first = rows[0];
      return first ? Object.values(first)[0] : undefined;
    }
    return rows;
  }

  /**
   * Igual que better-sqlite3: devuelve una función que ejecuta `fn` en una
   * transacción (BEGIN/COMMIT) o, si ya hay una abierta, en un SAVEPOINT.
   */
  transaction(fn) {
    if (typeof fn !== 'function') throw new TypeError('transaction() espera una función');
    const database = this;
    const make = (begin) =>
      function sqliteTransaction(...args) {
        const nested = database.inTransaction;
        const before = nested ? 'SAVEPOINT versova_tx' : begin;
        const after = nested ? 'RELEASE versova_tx' : 'COMMIT';
        const undo = nested ? 'ROLLBACK TO versova_tx' : 'ROLLBACK';
        database._db.exec(before);
        database._depth += 1;
        try {
          const result = fn.apply(this, args);
          if (result && typeof result.then === 'function') {
            throw new TypeError('Transaction function cannot return a promise');
          }
          database._db.exec(after);
          return result;
        } catch (error) {
          if (database.inTransaction) {
            try {
              database._db.exec(undo);
              if (nested) database._db.exec(after);
            } catch {
              /* SQLite ya deshizo la transacción por su cuenta */
            }
          }
          throw error;
        } finally {
          database._depth -= 1;
        }
      };
    const run = make('BEGIN');
    run.deferred = run;
    run.immediate = make('BEGIN IMMEDIATE');
    run.exclusive = make('BEGIN EXCLUSIVE');
    return run;
  }

  close() {
    if (!this._open) return this;
    this._open = false;
    this._db.close();
    return this;
  }
}

export { NodeSqliteDatabase };
