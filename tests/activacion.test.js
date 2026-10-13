/** Pruebas de vinculación sin clave y prefijos por bot. */
import test from 'node:test';
import assert from 'node:assert/strict';

import { say, person, includes, plain, instancesRepo, GROUP } from './_harness.js';
import { parseCommand, prefixesFor } from '../src/core/router.js';
import { activationKeysRepo, normalizeKey, formatKey, statsRepo } from '../src/db/index.js';
import { BotManager, normalizePhone } from '../src/core/bot-manager.js';

/* ── comando `.key` ──────────────────────────────────────────── */

test('.key es un alias opcional de pairing y no inventa claves', async () => {
  const who = person('KeyUser');
  for (const prefix of ['.', '#', '-', '+', '/']) {
    const response = await say(who.jid, `${prefix}key`);
    assert.match(plain(response.all), /pairing|vincul/i);
    assert.ok(!/[A-Z2-9]{4}-[A-Z2-9]{4}/.test(plain(response.all)));
  }
});

test('una clave vencida o inventada no activa nada', () => {
  assert.equal(normalizeKey('abcd-2345'), 'ABCD2345');
  assert.equal(normalizeKey('KEY-ABCD-2345'), 'ABCD2345');
  assert.equal(normalizeKey('muy-corta'), null);
  assert.equal(normalizeKey('ABCD-1234'), null, 'sin letras/niños confusos: no existe el 1 ni el 0');
  assert.equal(formatKey('ABCD2345'), 'ABCD-2345');
  assert.equal(activationKeysRepo.findValid('ZZZZ-9999'), null);
});

/* ── pairing code real (`.pairing` / `.key`) ─────────────────── */

test('.pairing explica que no hay código pendiente si no hay vinculación', async () => {
  const who = person('PairingUser');
  const { all } = await say(who.jid, '.pairing');
  const text = plain(all);
  assert.ok(
    /pairing|vincul/i.test(text),
    `la respuesta habla de la vinculación real: ${text}`,
  );
  assert.ok(!/[A-Z2-9]{4}-[A-Z2-9]{4}/.test(text), 'no inventa ningún código');
});

test('.pairing funciona con cualquier prefijo (# - + . /)', async () => {
  const who = person('PairingUser2');
  for (const prefix of ['#', '-', '+', '/']) {
    const { all } = await say(who.jid, `${prefix}pairing`);
    assert.ok(plain(all).length > 20, `responde a ${prefix}pairing`);
  }
});

/* ── bot sin activar ─────────────────────────────────────────── */

test('un bot antiguo sin activar ya responde a los comandos', async () => {
  const instance = instancesRepo.all()[0];
  instancesRepo.setActivated(instance.id, false);
  try {
    const who = person('DirectUser');
    const menu = await say(who.jid, '.menu');
    assert.ok(!includes(menu, 'sin activar'));
    assert.match(plain(menu.all), /menu|menú|registro/i);
    const registro = await say(who.jid, '.reg DirectUser.20');
    assert.ok(!includes(registro, 'sin activar'));
    assert.match(plain(registro.all), /DirectUser/);
  } finally {
    instancesRepo.setActivated(instance.id, true);
  }
});

/* ── prefijos por bot ────────────────────────────────────────── */

test('cada bot acepta su propio prefijo (# - + . /)', () => {
  const ctxHash = { instance: { prefix: '#' }, group: null };
  assert.equal(prefixesFor(ctxHash).includes('#'), true);
  assert.equal(parseCommand('#menu', ctxHash)?.name, 'menu');
  assert.equal(parseCommand('.menu', ctxHash), null, 'con prefijo # el punto ya no comanda');

  const ctxSlash = { instance: { prefix: '/' }, group: { config: {} } };
  assert.equal(parseCommand('/team', ctxSlash)?.name, 'team');
  assert.equal(parseCommand('+key', ctxSlash)?.name, 'key', '.key es universal');

  const ctxGroup = { instance: { prefix: '#' }, group: { config: { prefix: '.' } } };
  assert.equal(parseCommand('.ficha', ctxGroup)?.name, 'ficha', 'el prefijo del grupo también vale');
});

test('el prefijo del bot se puede cambiar y queda en la BD', () => {
  const manager = new BotManager({ maxInstances: 3 });
  const instance = instancesRepo.all()[0];
  const cambio = manager.setPrefix(instance.id, '/');
  assert.equal(cambio.ok, true);
  assert.equal(instancesRepo.byId(instance.id).prefix, '/');

  const malo = manager.setPrefix(instance.id, '!');
  assert.equal(malo.ok, false);
  assert.match(malo.error, /prefijo/i);

  manager.setPrefix(instance.id, '.');
});

/* ── activación completa (BD) ────────────────────────────────── */

test('compatibilidad: habilita instancias antiguas sin clave y sin arrancarlas', () => {
  const instance = instancesRepo.all()[0];
  instancesRepo.setActivated(instance.id, false);
  instancesRepo.setAutostart(instance.id, false);
  const manager = new BotManager();
  const result = manager.activate(instance.id);
  assert.equal(result.ok, true);
  assert.equal(result.instance.activated, 1);
  assert.equal(result.instance.autostart, 0);
  assert.equal(manager.activate(instance.id).already, true);
  assert.equal(manager.activate('no-existe').ok, false);
});

test('startAll respeta autostart, no la antigua clave de activación', async (t) => {
  const instance = instancesRepo.all()[0];
  instancesRepo.setActivated(instance.id, false);
  instancesRepo.setAutostart(instance.id, true);
  const manager = new BotManager();
  const start = t.mock.method(manager, 'start', async () => ({ ok: true }));
  try {
    await manager.startAll();
    assert.deepEqual(start.mock.calls.map((call) => call.arguments[0]), [instance.id]);
    instancesRepo.setAutostart(instance.id, false);
    start.mock.resetCalls();
    await manager.startAll();
    assert.equal(start.mock.callCount(), 0);
  } finally {
    instancesRepo.setActivated(instance.id, true);
  }
});

test('las estadísticas cuentan comandos reales', () => {
  const before = statsRepo.totalCommands();
  assert.ok(before >= 1, 'los tests ya ejecutaron comandos');
  const top = statsRepo.topCommands(5);
  assert.ok(top.length >= 1);
  assert.ok(top.every((entry) => typeof entry.count === 'number' && entry.count > 0));
});

test('normalizePhone sigue validando números', () => {
  assert.deepEqual(normalizePhone('+52 (1) 55-1234-5678'), { ok: true, value: '5215512345678' });
  assert.equal(normalizePhone('00521').ok, false);
});
