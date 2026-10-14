import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { DisconnectReason } from '@whiskeysockets/baileys';
import { sim } from './_harness.js';
import { BotClient } from '../src/core/bot-client.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture(requestPairingCode = async () => 'ABCD1234') {
  const client = new BotClient({ ...sim.instance, pairing_mode: 'pairing', phone: '+57 301 944 8245' });
  client.status = 'connecting';
  client.authState = { creds: { registered: false } };
  const calls = [];
  const sock = {
    ev: new EventEmitter(),
    requestPairingCode: async (phone) => { calls.push(phone); return requestPairingCode(); },
  };
  client.sock = sock;
  client._bindEvents(sock);
  const update = (data) => sock.ev.listeners('connection.update')[0](data);
  return { client, sock, calls, update };
}

test('espera al handshake y comparte la petición entre QR inicial, panel y renovación', async () => {
  const pending = deferred();
  const { client, calls, update } = fixture(() => pending.promise);
  const first = client.ensurePairingCode();
  const second = client.ensurePairingCode({ force: true });
  await Promise.resolve();
  assert.equal(calls.length, 0, 'no pedir antes del QR');
  const qr = update({ qr: 'handshake-ready' });
  const refresh = client.refreshPairingCode();
  await Promise.resolve();
  assert.deepEqual(calls, ['573019448245']);
  pending.resolve('ABCD1234');
  const results = await Promise.all([first, second]);
  await qr;
  assert.equal(await refresh, 'ABCD1234');
  assert.ok(results.every((r) => r.ok && r.code === 'ABCD1234'));
  assert.equal(client.listenerCount('status'), 0);
  await update({ qr: 'next-qr' });
  assert.equal(calls.length, 1, 'otro QR no invalida el código vigente');
});

test('reutiliza el código vigente, pero force genera uno nuevo', async () => {
  let count = 0;
  const { client, calls, update } = fixture(async () => ++count === 1 ? 'ABCD1234' : 'EFGH5678');
  await update({ qr: 'ready' });
  const cached = await client.ensurePairingCode();
  assert.equal(cached.cached, true);
  assert.equal(calls.length, 1);
  const fresh = await client.ensurePairingCode({ force: true });
  assert.equal(fresh.code, 'EFGH5678');
  assert.equal(fresh.cached, false);
  assert.equal(calls.length, 2);
});

test('un error de renovación nunca entrega el código anterior como éxito', async () => {
  const { client, sock, update } = fixture();
  await update({ qr: 'ready' });
  sock.requestPairingCode = async () => { throw new Error('rechazo de WhatsApp'); };
  const result = await client.ensurePairingCode({ force: true });
  assert.equal(result.ok, false);
  assert.match(result.reason, /rechazo de WhatsApp/);
  assert.equal(client.pairingCode, null);
  assert.equal(client.pairingCodeAt, null);
  assert.equal(client.listenerCount('status'), 0);
});

test('el timeout cubre una petición bloqueada y no deja listeners', async () => {
  const { client, calls } = fixture(() => new Promise(() => {}));
  client._pairingReady = true;
  const result = await client.ensurePairingCode({ waitMs: 10 });
  assert.equal(result.ok, false);
  assert.match(result.reason, /a tiempo/);
  assert.equal(calls.length, 1);
  assert.equal(client.listenerCount('status'), 0);
});

test('sin handshake expira la espera sin intentar pedir un código', async () => {
  const { client, calls } = fixture();
  assert.equal((await client.ensurePairingCode({ waitMs: 10 })).ok, false);
  assert.equal(calls.length, 0);
  assert.equal(client.listenerCount('status'), 0);
});

test('detener invalida el código y descarta respuestas y eventos tardíos', async () => {
  const pending = deferred();
  const { client, update } = fixture(() => pending.promise);
  const qr = update({ qr: 'ready' });
  const result = client.ensurePairingCode();
  await client.stop();
  assert.equal((await result).ok, false);
  pending.resolve('ABCD1234');
  await qr;
  await update({ qr: 'late-qr' });
  assert.equal(client.status, 'closed');
  assert.equal(client.pairingCode, null);
  assert.equal(client.qr, null);
});

test('una respuesta del socket anterior no sobrescribe el nuevo código', async () => {
  const pending = deferred();
  const { client, update } = fixture(() => pending.promise);
  const qr = update({ qr: 'ready' });
  await client.stop();
  client.stopping = false;
  client.status = 'pairing';
  client._pairingReady = true;
  client.sock = { requestPairingCode: async () => 'EFGH5678' };
  await client.refreshPairingCode();
  pending.resolve('ABCD1234');
  await qr;
  assert.equal(client.pairingCode, 'EFGH5678');
});

test('logout remoto borra el socket y los códigos', async () => {
  const { client, update } = fixture();
  await update({ qr: 'ready' });
  await update({ connection: 'close', lastDisconnect: { error: { output: { statusCode: DisconnectReason.loggedOut } } } });
  assert.equal(client.status, 'loggedOut');
  assert.equal(client.sock, null);
  assert.equal(client.pairingCode, null);
  assert.equal(client.pairingCodeFresh(), false);
});

test('reconexión borra el código antes del backoff', async (t) => {
  const { client, update } = fixture();
  await update({ qr: 'ready' });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const close = update({ connection: 'close', lastDisconnect: { error: { output: { statusCode: DisconnectReason.restartRequired } } } });
  assert.equal(client.pairingCode, null);
  assert.equal(client.sock, null);
  assert.equal(client.pairingCodeFresh(), false);
  client.stopping = true; // No abrir transporte real al terminar el backoff.
  t.mock.timers.tick(60_000);
  await close;
});

test('una sesión vinculada no pide códigos ni conserva el anterior', async () => {
  const { client, calls, update } = fixture();
  await update({ qr: 'ready' });
  client._setStatus('open');
  assert.equal(client.pairingCode, null);
  assert.equal(await client.refreshPairingCode(), null);
  assert.equal((await client.ensurePairingCode()).ok, false);
  client.status = 'connecting';
  client.authState.creds.registered = true;
  assert.equal(await client.refreshPairingCode(), null);
  assert.equal((await client.ensurePairingCode()).ok, false);
  assert.equal(calls.length, 1);
});

test('no publica respuestas malformadas ni registra códigos en los logs', async () => {
  const { client, update } = fixture(async () => 'no-válido');
  const logs = [];
  client.on('log', (entry) => logs.push(entry.message));
  await update({ qr: 'ready' });
  assert.equal(client.pairingCode, null);
  client.sock.requestPairingCode = async () => 'ABCD1234';
  await client.refreshPairingCode();
  assert.equal(client.pairingCode, 'ABCD1234');
  assert.ok(logs.every((message) => !message.includes('ABCD1234')));
});

test('la frescura depende de la sesión activa y de la fecha, no solo del código', async () => {
  const { client, update } = fixture();
  await update({ qr: 'ready' });
  assert.equal(client.pairingCodeFresh(), true);
  client.pairingCodeAt = Date.now() - 61_000;
  assert.equal(client.pairingCodeFresh(Infinity), false);
  client.pairingCodeAt = Date.now();
  client.sock = null;
  assert.equal(client.pairingCodeFresh(), false);
});
