/**
 * Tests · activación de sub-bots con `.key` + prefijos por bot
 * ────────────────────────────────────────────────────────────────
 * Flujo real: el bot nace desconectado/sin activar, `.key` en WhatsApp
 * entrega una clave de un solo uso y el panel la canjea para activarlo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { say, person, includes, plain, instancesRepo, GROUP } from './_harness.js';
import { parseCommand, prefixesFor } from '../src/core/router.js';
import { activationKeysRepo, normalizeKey, formatKey, statsRepo } from '../src/db/index.js';
import { BotManager, normalizePhone } from '../src/core/bot-manager.js';

/* ── comando `.key` ──────────────────────────────────────────── */

test('.key devuelve una clave de activación con formato ABCD-1234', async () => {
  const who = person('KeyUser');
  const { all } = await say(who.jid, '.key');
  assert.ok(includes({ all }, 'clave'), `responde con la clave: ${plain(all)}`);
  const match = plain(all).match(/[A-Z2-9]{4}-[A-Z2-9]{4}/);
  assert.ok(match, `la clave tiene formato XXXX-XXXX: ${plain(all)}`);
  assert.ok(activationKeysRepo.findValid(match[0]), 'la clave queda guardada en la BD');
});

test('.key funciona con cualquiera de los prefijos permitidos (# - + . /)', async () => {
  const who = person('KeyUser2');
  for (const prefix of ['#', '-', '+', '/']) {
    const { all } = await say(who.jid, `${prefix}key`);
    assert.ok(includes({ all }, 'clave'), `responde a ${prefix}key: ${plain(all)}`);
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

/* ── bot sin activar ─────────────────────────────────────────── */

test('un bot sin activar solo responde .key y avisa cómo activarlo', async () => {
  const instance = instancesRepo.all()[0];
  instancesRepo.setActivated(instance.id, false);
  const who = person('InactiveUser');

  const bloqueado = await say(who.jid, '.menu');
  assert.ok(includes(bloqueado, 'sin activar'), `avisa que falta activar: ${plain(bloqueado.all)}`);
  assert.ok(includes(bloqueado, 'key'), 'explica el comando .key');

  const todavia = await say(who.jid, '.reg Nombre.20');
  assert.ok(includes(todavia, 'sin activar'), 'otros comandos quedan bloqueados');

  const key = await say(who.jid, '.key');
  assert.ok(includes(key, 'clave'), '.key sigue funcionando para activar');

  instancesRepo.setActivated(instance.id, true);
  const ok = await say(who.jid, '.menu');
  assert.ok(includes(ok, 'Menu') || includes(ok, 'menú') || includes(ok, 'REGISTRO'), `con la clave el bot responde: ${plain(ok.all).slice(0, 80)}`);
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

test('canje de clave: un solo uso, vinculada a la instancia', () => {
  const instance = instancesRepo.all()[0];
  instancesRepo.setActivated(instance.id, false);
  instancesRepo.setAutostart(instance.id, false);

  const created = activationKeysRepo.create({ creatorJid: '5215599999999@s.whatsapp.net' });
  assert.ok(created.formatted, 'clave generada');

  const manager = new BotManager({ maxInstances: 3 });
  const activado = manager.activate(instance.id, created.formatted);
  assert.equal(activado.ok, true);
  const row = instancesRepo.byId(instance.id);
  assert.equal(row.activated, 1, 'activado tras canjear la clave');
  assert.equal(row.autostart, 1, 'arrancará solo en los reinicios');

  const other = instancesRepo.all()[0];
  instancesRepo.setActivated(other.id, false);
  const otra = activationKeysRepo.create({ creatorJid: '5215588888888@s.whatsapp.net' });
  activationKeysRepo.redeem(otra.formatted, 'instancia-x');
  const reuso = manager.activate(other.id, otra.formatted);
  assert.equal(reuso.ok, false, 'una clave usada no vuelve a servir');
  assert.match(reuso.error, /usada/i);
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
