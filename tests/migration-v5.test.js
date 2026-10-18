import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '../src/db/driver.js';
import { initDatabase, closeDatabase, instancesRepo } from '../src/db/index.js';

test('v5 conserva bots existentes y persiste el staff al reabrir la base de datos', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'versova-v5-'));
  const dbPath = path.join(dir, 'migration.db');
  try {
    const old = openDatabase(dbPath);
    for (const schema of ['schema.sql', 'schema-credits.sql', 'schema-v3.sql']) {
      old.exec(fs.readFileSync(new URL(`../src/db/${schema}`, import.meta.url), 'utf8'));
    }
    old.prepare('INSERT INTO meta VALUES (?, ?, ?)').run('schema_version', '4', 1);
    old.prepare(`INSERT INTO bot_instances
      (id, name, phone, session_dir, status, prefix, activated, autostart, created_at, updated_at)
      VALUES ('existing', 'Mi bot', '59899001122', '/sessions/existing', 'closed', '#', 1, 0, 1, 2)`).run();
    const previous = old.prepare("SELECT * FROM bot_instances WHERE id = 'existing'").get();
    old.close();

    let db = initDatabase(dbPath);
    const { admin_numbers, menu_style, custom_config, ...migrated } = db.prepare("SELECT * FROM bot_instances WHERE id = 'existing'").get();
    assert.deepEqual(migrated, previous, 'no toca sesión, prefijo, estado ni autostart');
    assert.equal(admin_numbers, '[]');
    assert.equal(menu_style, 'versova');
    assert.equal(custom_config, '{}');
    assert.deepEqual(instancesRepo.byId('existing').admin_numbers, []);
    assert.equal(db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get().value, '8');

    instancesRepo.setAdminNumbers('existing', ['+598 99 123 456', '5215512345678']);
    const saved = instancesRepo.byId('existing');
    closeDatabase();
    db = initDatabase(dbPath);
    assert.deepEqual(instancesRepo.byId('existing'), saved, 'reabrir no borra el staff ni repite la migración');
    assert.deepEqual(saved.admin_numbers, ['59899123456', '5215512345678']);
    const created = instancesRepo.create({ name: 'Nuevo', phone: '59899001123', sessionDir: '/sessions/new' });
    assert.deepEqual(created.admin_numbers, [], 'las instancias nuevas no conceden permisos por defecto');

    assert.throws(() => instancesRepo.setAdminNumbers('existing', ['basura']), /admin/);
    assert.deepEqual(instancesRepo.byId('existing'), saved, 'el repositorio tampoco guarda entradas inválidas');
    for (const corrupt of ['no-json', 'null', '{}', '"59899123456"', '[59899123456]', '["59899123456", "bad"]']) {
      db.prepare('UPDATE bot_instances SET admin_numbers = ? WHERE id = ?').run(corrupt, 'existing');
      assert.deepEqual(instancesRepo.byId('existing').admin_numbers, [], 'datos corruptos no conceden permisos');
    }
  } finally {
    closeDatabase();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
