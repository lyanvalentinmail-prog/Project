/**
 * Motor SQLite: el adaptador de node:sqlite (Termux/Android) debe
 * comportarse como better-sqlite3 en todo lo que usa el proyecto.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { NodeSqliteDatabase, driverInfo } from '../src/db/driver.js';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function nodeSqlite() {
  const original = process.emitWarning;
  process.emitWarning = () => {};
  try {
    return require('node:sqlite');
  } finally {
    process.emitWarning = original;
  }
}

/** Motores a comparar: siempre node:sqlite y, si carga, better-sqlite3. */
function engines() {
  const list = [['node:sqlite', () => new NodeSqliteDatabase(nodeSqlite().DatabaseSync, ':memory:')]];
  try {
    const Better = require('better-sqlite3');
    new Better(':memory:').close();
    list.push(['better-sqlite3', () => new Better(':memory:')]);
  } catch {
    /* sin binario nativo (p. ej. Termux): solo se prueba node:sqlite */
  }
  return list;
}

function schema(db) {
  db.exec(`CREATE TABLE t (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    n INTEGER,
    note TEXT
  );`);
  return db;
}

for (const [label, open] of engines()) {
  test(`${label}: parámetros con nombre ignoran claves sobrantes y undefined es NULL`, () => {
    const db = schema(open());
    const info = db.prepare('INSERT INTO t (name, n, note) VALUES (@name, @n, @note)')
      .run({ name: 'a', n: 1, note: undefined, extra: 'sobra' });
    assert.equal(info.changes, 1);
    assert.equal(info.lastInsertRowid, 1);
    const row = db.prepare('SELECT * FROM t WHERE id = ?').get(1);
    assert.deepEqual(row, { id: 1, name: 'a', n: 1, note: null });
    assert.equal(Object.getPrototypeOf(row), Object.prototype, 'filas como objetos normales');
    db.close();
  });

  test(`${label}: posicionales, spread y arrays; get vacío es undefined`, () => {
    const db = schema(open());
    const insert = db.prepare('INSERT INTO t (name, n) VALUES (?, ?)');
    insert.run('x', 10);
    insert.run(...['y', 20]);
    insert.run(['z', 30]);
    assert.deepEqual(db.prepare('SELECT name FROM t ORDER BY id').all().map((r) => r.name), ['x', 'y', 'z']);
    assert.equal(db.prepare('SELECT * FROM t WHERE id = ?').get(999), undefined);
    assert.deepEqual([...db.prepare('SELECT n FROM t WHERE n >= ? ORDER BY n').iterate(20)].map((r) => r.n), [20, 30]);
    assert.equal(db.prepare('SELECT COUNT(*) AS c FROM t').get().c, 3);
    db.close();
  });

  test(`${label}: transacciones con commit, rollback y anidamiento por savepoint`, () => {
    const db = schema(open());
    const insert = db.prepare('INSERT INTO t (name) VALUES (?)');
    const count = () => db.prepare('SELECT COUNT(*) AS c FROM t').get().c;

    const ok = db.transaction((names) => {
      for (const name of names) insert.run(name);
      return names.length;
    });
    assert.equal(ok(['a', 'b']), 2);
    assert.equal(count(), 2);

    const failing = db.transaction(() => {
      insert.run('c');
      insert.run('a'); // UNIQUE → todo se deshace
    });
    assert.throws(() => failing(), /UNIQUE/);
    assert.equal(count(), 2);
    assert.equal(db.inTransaction, false);

    const outer = db.transaction(() => {
      insert.run('d');
      const inner = db.transaction(() => {
        insert.run('e');
        throw new Error('falla interna');
      });
      assert.throws(() => inner(), /falla interna/);
      assert.equal(db.inTransaction, true);
      insert.run('f');
    });
    outer();
    assert.deepEqual(db.prepare('SELECT name FROM t ORDER BY id').all().map((r) => r.name), ['a', 'b', 'd', 'f']);
    db.close();
  });

  test(`${label}: una transacción no puede devolver una promesa`, () => {
    const db = schema(open());
    assert.throws(() => db.transaction(async () => 1)(), /promise/i);
    assert.equal(db.inTransaction, false);
    db.close();
  });

  test(`${label}: pragma devuelve filas o, con simple, el valor`, () => {
    const db = open();
    assert.deepEqual(db.pragma('journal_mode = WAL'), [{ journal_mode: 'memory' }]);
    assert.deepEqual(db.pragma('foreign_keys = ON'), []);
    assert.equal(db.pragma('synchronous = NORMAL', { simple: true }), undefined);
    assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
    assert.equal(db.pragma('busy_timeout = 5000', { simple: true }), 5000);
    assert.deepEqual(db.pragma('busy_timeout = 5000'), [{ timeout: 5000 }]);
    db.close();
  });
}

test('node:sqlite: close es idempotente y open refleja el estado', () => {
  const db = new NodeSqliteDatabase(nodeSqlite().DatabaseSync, ':memory:');
  assert.equal(db.open, true);
  db.close();
  db.close();
  assert.equal(db.open, false);
});

test('driverInfo informa del motor elegido sin lanzar', () => {
  const info = driverInfo();
  assert.equal(info.ok, true);
  assert.ok(['better-sqlite3', 'node:sqlite'].includes(info.name));
  assert.match(String(info.sqliteVersion), /^3\.\d+/);
});

test('sin better-sqlite3 (como en Termux) se usa node:sqlite automáticamente', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'versova-driver-'));
  try {
    // Simula una instalación con `npm install --omit=optional`.
    const hide = path.join(dir, 'hide-better-sqlite3.cjs');
    fs.writeFileSync(hide, `
      const Module = require('node:module');
      const resolve = Module._resolveFilename;
      Module._resolveFilename = function (request, ...rest) {
        if (request === 'better-sqlite3' || request.startsWith('better-sqlite3/')) {
          const error = new Error("Cannot find module '" + request + "'");
          error.code = 'MODULE_NOT_FOUND';
          throw error;
        }
        return resolve.call(this, request, ...rest);
      };
    `);
    const script = `
      const { initDatabase, closeDatabase, driverInfo, currentJournalMode, instancesRepo } = await import('./src/db/index.js');
      initDatabase(${JSON.stringify(path.join(dir, 'termux.db'))});
      instancesRepo.create({ name: 'Termux', phone: '5215512345678', pairingMode: 'pairing', sessionDir: ${JSON.stringify(path.join(dir, 's'))}, prefix: '.' });
      const info = driverInfo();
      console.log(JSON.stringify({ name: info.name, fallback: Boolean(info.fallbackReason), journal: currentJournalMode(), bots: instancesRepo.count() }));
      closeDatabase();
    `;
    const env = { ...process.env, DB_DRIVER: 'auto', LOG_TO_FILE: 'false' };
    const out = spawnSync(process.execPath, ['--require', hide, '--input-type=module', '-e', script], { cwd: ROOT, env, encoding: 'utf8' });
    assert.equal(out.status, 0, out.stderr);
    assert.doesNotMatch(out.stderr, /ExperimentalWarning/);
    const result = JSON.parse(out.stdout.trim().split('\n').pop());
    assert.deepEqual(result, { name: 'node:sqlite', fallback: true, journal: 'wal', bots: 1 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
