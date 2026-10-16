import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '../src/db/driver.js';
import { initDatabase, closeDatabase } from '../src/db/connection.js';

test('v4 habilita bots antiguos sin alterar sesiones ni autostart y es idempotente', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'versova-v4-'));
  const dbPath = path.join(dir, 'migration.db');
  try {
    const old = openDatabase(dbPath);
    for (const schema of ['schema.sql', 'schema-credits.sql', 'schema-v3.sql']) {
      old.exec(fs.readFileSync(new URL(`../src/db/${schema}`, import.meta.url), 'utf8'));
    }
    old.prepare('INSERT INTO meta VALUES (?, ?, ?)').run('schema_version', '3', 1);
    const insert = old.prepare(`INSERT INTO bot_instances
      (id, name, phone, session_dir, status, activated, activated_at, autostart, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'closed', ?, ?, ?, 1, 1)`);
    insert.run('stopped', 'Detenido', '5215512345678', '/sessions/stopped', 0, null, 0);
    insert.run('auto', 'Automático', '5215512345679', '/sessions/auto', 0, null, 1);
    insert.run('ready', 'Habilitado', '5215512345680', '/sessions/ready', 1, 123, 1);
    old.close();

    let db = initDatabase(dbPath);
    const rows = db.prepare('SELECT * FROM bot_instances ORDER BY id').all();
    assert.ok(rows.every((row) => row.activated === 1 && row.activated_at > 0));
    assert.equal(rows.find((row) => row.id === 'stopped').autostart, 0);
    assert.equal(rows.find((row) => row.id === 'auto').autostart, 1);
    assert.equal(rows.find((row) => row.id === 'ready').activated_at, 123);
    assert.ok(rows.every((row) => row.status === 'closed' && row.session_dir === `/sessions/${row.id}`));
    assert.ok(Number(db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get().value) >= 4);
    closeDatabase();
    db = initDatabase(dbPath);
    assert.deepEqual(db.prepare('SELECT * FROM bot_instances ORDER BY id').all(), rows);
  } finally {
    closeDatabase();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
