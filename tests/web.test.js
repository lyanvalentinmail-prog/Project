/**
 * 𓆩 ☕ 𓆪  Tests · panel web (API REST + SSE + estáticos)
 * ────────────────────────────────────────────────────────────────
 * Se levanta un servidor real en un puerto efímero y se ejercita con
 * fetch. No se inicia ninguna conexión a WhatsApp (en CI no hay ruta
 * a sus servidores): se valida la API, la autenticación y el puente
 * con los servicios del bot.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';

import { createWebServer } from '../web/server.js';
import { formatPairingCode } from '../web/routes.js';
import { BotManager, normalizePhone } from '../src/core/bot-manager.js';
import { say, person, registerPerson, includes, plain, sim, GROUP, requestsRepo, rolesRepo, instancesRepo } from './_harness.js';

const PASSWORD = 'cafe-con-leche-2026';
let web;
let base;
let token;
let manager;

const api = async (path, { method = 'GET', body = null, auth = true, raw = false } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (raw) return res;
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
};

before(async () => {
  manager = new BotManager();
  web = await createWebServer({ manager, password: PASSWORD, port: 0, host: '127.0.0.1' });
  base = `http://127.0.0.1:${web.port}`;
});

after(async () => {
  await web?.stop();
});

/* ── salud y autenticación ──────────────────────────────────── */

test('GET /api/health es público y describe el bot', async () => {
  const { status, data } = await api('/api/health', { auth: false });
  assert.equal(status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.bot.name, 'VÉRSOVA');
  assert.ok(data.commands >= 40);
});

test('el login rechaza contraseñas incorrectas', async () => {
  const { status, data } = await api('/api/login', { method: 'POST', body: { password: 'incorrecta' }, auth: false });
  assert.equal(status, 401);
  assert.equal(data.ok, false);
});

test('el login devuelve un token y protege el resto de la API', async () => {
  const { status, data } = await api('/api/login', { method: 'POST', body: { password: PASSWORD }, auth: false });
  assert.equal(status, 200);
  assert.ok(data.token?.length > 20);
  token = data.token;

  const sinToken = await fetch(`${base}/api/stats`);
  assert.equal(sinToken.status, 401);

  const conToken = await api('/api/stats');
  assert.equal(conToken.status, 200);
  assert.equal(conToken.data.ok, true);
});

test('GET /api/me devuelve identidad y límites', async () => {
  const { data } = await api('/api/me');
  assert.equal(data.bot.team, '◢禍◣ Versova ࿙☕࿚');
  assert.equal(data.limits.maxInstances, 3);
});

/* ── sub-bots ───────────────────────────────────────────────── */

test('valida el número antes de crear un sub-bot', async () => {
  const corto = await api('/api/instances', { method: 'POST', body: { name: 'x', phone: '123', pairingMode: 'qr' } });
  assert.equal(corto.status, 400);
  assert.match(corto.data.error, /internacional|corto/i);

  const modo = await api('/api/instances', { method: 'POST', body: { name: 'x', phone: '5215510000001', pairingMode: 'sms' } });
  assert.equal(modo.status, 400);
  assert.match(modo.data.error, /qr|pairing/i);
});

test('crea sub-bots hasta el límite de 3 y no permite duplicar número', async () => {
  // el sub-bot del arnés ya ocupa una plaza: se llega al máximo con dos más
  const inicial = await api('/api/instances');
  assert.ok(inicial.data.instances.length >= 1, 'el arnés ya registró su sub-bot');
  assert.equal(inicial.data.maxInstances, 3);

  const uno = await api('/api/instances', { method: 'POST', body: { name: 'Versova QR', phone: '5215520000001', pairingMode: 'qr' } });
  assert.equal(uno.status, 201);
  assert.equal(uno.data.instance.pairingMode, 'qr');
  assert.ok(uno.data.instance.phoneMasked.includes('•'), 'la lista no muestra el número crudo');

  const dos = await api('/api/instances', { method: 'POST', body: { name: 'Versova Pairing', phone: '5215520000002', pairingMode: 'pairing' } });
  assert.equal(dos.status, 201);
  assert.equal(dos.data.instance.pairingMode, 'pairing');

  const llena = await api('/api/instances');
  assert.equal(llena.data.instances.length, 3, 'tres sub-bots como máximo');

  const duplicado = await api('/api/instances', { method: 'POST', body: { name: 'Repetido', phone: '5215520000001', pairingMode: 'qr' } });
  assert.equal(duplicado.status, 400);
  assert.match(duplicado.data.error, /ya tiene un sub-bot|máximo/i);

  const cuarto = await api('/api/instances', { method: 'POST', body: { name: 'Cuarto', phone: '5215520000004', pairingMode: 'qr' } });
  assert.equal(cuarto.status, 400);
  assert.match(cuarto.data.error, /máximo/i);
});

test('el estado de vinculación existe aunque el sub-bot esté apagado', async () => {
  const { data: lista } = await api('/api/instances');
  const id = lista.instances[0].id;
  const { status, data } = await api(`/api/instances/${id}/link`);
  assert.equal(status, 200);
  assert.equal(data.qr, null, 'sin conexión no hay QR');
  assert.equal(data.qrDataUrl, null);
  assert.ok(['created', 'closed', 'loggedOut', 'error'].includes(data.status), data.status);
});

test('detener y eliminar un sub-bot limpia sus datos', async () => {
  const { data: lista } = await api('/api/instances');
  const id = lista.instances[2].id;

  const stop = await api(`/api/instances/${id}/stop`, { method: 'POST' });
  assert.equal(stop.data.ok, true);

  const removed = await api(`/api/instances/${id}`, { method: 'DELETE' });
  assert.equal(removed.data.ok, true);
  assert.equal(instancesRepo.byId(id), null, 'se borró de la base de datos');

  const despues = await api('/api/instances');
  assert.equal(despues.data.instances.length, 2);
});

test('el código de emparejamiento se muestra como XXXX-XXXX y el QR se genera', async () => {
  assert.equal(formatPairingCode('ABCD1234'), 'ABCD-1234');
  assert.equal(formatPairingCode(null), null);

  const dataUrl = await QRCode.toDataURL('2@AABBCCDD,5215512345678@s.whatsapp.net', { width: 200 });
  assert.ok(dataUrl.startsWith('data:image/png;base64,'), 'QR renderizable en el navegador');

  assert.deepEqual(normalizePhone('+52 (1) 55-1234-5678'), { ok: true, value: '5215512345678' });
  assert.equal(normalizePhone('00521').ok, false, 'rechaza números con 0 inicial');
});

/* ── grupos y solicitudes desde la web ──────────────────────── */

test('lista los grupos con sus contadores', async () => {
  const { status, data } = await api('/api/groups');
  assert.equal(status, 200);
  assert.ok(data.groups.length >= 1);
  const group = data.groups.find((g) => g.groupId === GROUP);
  assert.ok(group, 'aparece el grupo del arnés');
  assert.ok(group.size >= 1, 'conoce a sus integrantes');
  assert.equal(typeof group.registered, 'number');
  assert.equal(typeof group.rolesTaken, 'number');
  assert.equal(typeof group.admins, 'number');
});

test('el detalle del grupo trae miembros, personajes, solicitudes y auditoría', async () => {
  const admin = person('WebAdmin', { admin: 'admin' });
  await say(admin.jid, '.reg WebAdmin.34');
  const member = await registerPerson('WebUser');
  await say(member.jid, '.rol PersonajeWeb');

  const { status, data } = await api(`/api/groups/${encodeURIComponent(GROUP)}`);
  assert.equal(status, 200);
  assert.equal(data.group.groupId, GROUP);
  assert.ok(data.members.some((m) => m.name === 'WebUser'));
  assert.ok(data.requests.some((r) => r.roleName === 'PersonajeWeb'), 'muestra la solicitud pendiente');
  assert.ok(data.audit.length > 0);
  assert.ok(data.roles.some((r) => r.name === 'PersonajeWeb'));
  // privacidad: el panel enmascara los números en las listas
  assert.ok(data.members.every((m) => !m.phone || m.phone.includes('•')));
});

test('aprobar una solicitud desde la web asigna el personaje', async () => {
  const pending = requestsRepo.listPending(GROUP, 'role').find((r) => r.role_name === 'PersonajeWeb');
  assert.ok(pending, 'existe la solicitud');

  const { status, data } = await api(`/api/groups/${encodeURIComponent(GROUP)}/requests/${pending.id}/resolve`, {
    method: 'POST',
    body: { decision: 'approve' },
  });
  assert.equal(status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.delivered, false, 'sin sub-bot conectado no se puede avisar a WhatsApp');
  assert.ok(plain(data.message).includes('asignado'), data.message);
  assert.ok(plain(data.message).includes('Panel web'), 'queda constancia de quién aprobó');

  const role = rolesRepo.findByName(GROUP, 'PersonajeWeb');
  assert.equal(role.status, 'taken');
  assert.equal(requestsRepo.get(pending.id).status, 'approved');
});

test('rechazar desde la web deja la solicitud en rejected', async () => {
  const member = await registerPerson('WebUser2');
  await say(member.jid, '.rol OtroPersonaje');
  const pending = requestsRepo.pendingForUser(GROUP, member.jid, 'role');

  const { data } = await api(`/api/groups/${encodeURIComponent(GROUP)}/requests/${pending.id}/resolve`, {
    method: 'POST',
    body: { decision: 'deny', reason: 'Ya está en otro team' },
  });
  assert.equal(data.ok, true);
  assert.equal(requestsRepo.get(pending.id).status, 'rejected');
  assert.equal(rolesRepo.findByName(GROUP, 'OtroPersonaje').status, 'free');
});

test('la API valida las entradas de resolución', async () => {
  const bad = await api(`/api/groups/${encodeURIComponent(GROUP)}/requests/1/resolve`, {
    method: 'POST',
    body: { decision: 'quizá' },
  });
  assert.equal(bad.status, 400);

  const missing = await api(`/api/groups/${encodeURIComponent(GROUP)}/requests/999999/resolve`, {
    method: 'POST',
    body: { decision: 'approve' },
  });
  assert.equal(missing.status, 404);
});

/* ── comandos, auditoría, SSE y estáticos ───────────────────── */

test('expone el catálogo de comandos y la auditoría global', async () => {
  const commands = await api('/api/commands');
  assert.equal(commands.data.ok, true);
  assert.ok(commands.data.commands.some((c) => c.name === 'reg'));
  assert.equal(commands.data.prefix, '.');

  const audit = await api('/api/audit?limit=10');
  assert.equal(audit.data.ok, true);
  assert.ok(audit.data.entries.length > 0);
  assert.ok(audit.data.entries.every((e) => !e.actor || e.actor.includes('•')), 'enmascara los números');
});

test('el stream SSE exige token y responde con text/event-stream', async () => {
  const sinToken = await fetch(`${base}/api/stream`);
  assert.equal(sinToken.status, 401);
  await sinToken.body?.cancel();

  const res = await fetch(`${base}/api/stream?token=${encodeURIComponent(token)}`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/event-stream/);

  const reader = res.body.getReader();
  const { value } = await reader.read();
  const chunk = new TextDecoder().decode(value);
  assert.match(chunk, /event: hello/);
  await reader.cancel();
});

test('sirve la interfaz y sus recursos', async () => {
  const index = await fetch(`${base}/`);
  assert.equal(index.status, 200);
  const html = await index.text();
  assert.ok(html.includes('VÉRSOVA'), 'la portada lleva la marca');
  assert.ok(html.includes('Pairing code') && html.includes('Código QR'), 'ofrece los dos métodos');

  for (const asset of ['/styles.css', '/app.js']) {
    const res = await fetch(`${base}${asset}`);
    assert.equal(res.status, 200, `${asset} disponible`);
    assert.ok((await res.text()).length > 500, `${asset} no está vacío`);
  }

  const spa = await fetch(`${base}/ruta/cualquiera`);
  assert.equal(spa.status, 200, 'el SPA responde en cualquier ruta');
  await spa.text();
});

test('cerrar sesión invalida el token', async () => {
  const out = await api('/api/logout', { method: 'POST' });
  assert.equal(out.data.ok, true);

  const after = await fetch(`${base}/api/stats`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(after.status, 401);
});

test('el panel no arranca sin contraseña', async () => {
  await assert.rejects(() => createWebServer({ manager: new BotManager(), password: '', port: 0, host: '127.0.0.1' }));
});

test('la sesión del arnés sigue viva para el resto de pruebas', async () => {
  // el sub-bot del simulador no debe haber sido tocado por las pruebas web
  assert.ok(sim.client.metadata.participants.length > 1);
});
