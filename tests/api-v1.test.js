/**
 * 𓆩 ☕ 𓆪  Tests · cuentas web, API keys (máx. 100 días) y API funcional
 * ────────────────────────────────────────────────────────────────
 * Servidor real en un puerto efímero con la BD en memoria del arnés.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import './_harness.js';
import { createWebServer } from '../web/server.js';
import { BotManager } from '../src/core/bot-manager.js';
import { getDb } from '../src/db/index.js';
import { FUNCTIONAL_ENDPOINTS, calculate, fancyText } from '../web/api/v1.js';
import { hashPassword, verifyPassword, KEY_MAX_DAYS } from '../web/api/accounts.js';

let web;
let base;

const call = async (path, { method = 'GET', body, token, key, headers = {} } = {}) => {
  const h = { 'Content-Type': 'application/json', ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (key) h['X-API-Key'] = key;
  const res = await fetch(`${base}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const type = res.headers.get('content-type') ?? '';
  const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
  return { status: res.status, data, type, headers: res.headers };
};

let counter = 0;
async function account(prefix = 'user') {
  counter += 1;
  const email = `${prefix}${counter}@test.com`;
  const { status, data } = await call('/api/account/register', { method: 'POST', body: { email, username: `${prefix}_${counter}`, password: 'clave-segura-1' } });
  assert.equal(status, 201);
  return { email, token: data.token, user: data.user };
}

async function keyFor(token, days = 30) {
  const { status, data } = await call('/api/account/keys', { method: 'POST', token, body: { name: 'test', days } });
  assert.equal(status, 201, JSON.stringify(data));
  return data;
}

before(async () => {
  web = await createWebServer({ manager: new BotManager(), port: 0, host: '127.0.0.1' });
  base = `http://127.0.0.1:${web.port}`;
});

after(async () => {
  await web?.stop();
});

test('hay más de 20 endpoints funcionales y el índice /api/v1 es público', async () => {
  assert.ok(FUNCTIONAL_ENDPOINTS.length > 20);
  const { status, data } = await call('/api/v1');
  assert.equal(status, 200);
  assert.equal(data.total, FUNCTIONAL_ENDPOINTS.length);
  assert.ok(data.categories.every((c) => c.items.every((i) => i.path.startsWith('/api/v1/'))));
});

test('registro, login (email sin distinguir mayúsculas) y sesión', async () => {
  const { email, token, user } = await account();
  assert.equal(user.role, 'user');
  assert.ok(token.startsWith('ses_'));
  const me = await call('/api/account/me', { token });
  assert.equal(me.status, 200);
  assert.equal(me.data.user.email, email);
  assert.equal(me.data.limits.keyMaxDays, 100);

  const dup = await call('/api/account/register', { method: 'POST', body: { email: email.toUpperCase(), username: 'otro', password: 'clave-segura-1' } });
  assert.equal(dup.status, 409);

  const bad = await call('/api/account/login', { method: 'POST', body: { email, password: 'incorrecta' } });
  assert.equal(bad.status, 401);
  const good = await call('/api/account/login', { method: 'POST', body: { email: email.toUpperCase(), password: 'clave-segura-1' } });
  assert.equal(good.status, 200);
  assert.ok(good.data.token);

  await call('/api/account/logout', { method: 'POST', token: good.data.token });
  assert.equal((await call('/api/account/me', { token: good.data.token })).status, 401);
  assert.equal((await call('/api/account/me')).status, 401);
});

test('validación del registro: email, usuario y contraseña de 8+ caracteres', async () => {
  const short = await call('/api/account/register', { method: 'POST', body: { email: 'x@test.com', username: 'xx_user', password: '1234567' } });
  assert.equal(short.status, 400);
  const mail = await call('/api/account/register', { method: 'POST', body: { email: 'no-es-email', username: 'xx_user', password: '12345678' } });
  assert.equal(mail.status, 400);
});

test('lyanvalentinmail@gmail.com es el owner (sin límite y con panel propio)', async () => {
  const reg = await call('/api/account/register', { method: 'POST', body: { email: 'LyanValentinMail@Gmail.com', username: 'lyan', password: 'owner-clave-1' } });
  assert.equal(reg.status, 201);
  assert.equal(reg.data.user.role, 'owner');
  assert.equal(reg.data.user.isOwner, true);
  const overview = await call('/api/account/owner/overview', { token: reg.data.token });
  assert.equal(overview.status, 200);
  assert.ok(overview.data.totals.users >= 1);

  const { token } = await account();
  assert.equal((await call('/api/account/owner/overview', { token })).status, 403);
  // crear cupones (regala créditos) ya no está abierto a cualquiera
  assert.equal((await call('/api/credits/admin/coupons', { method: 'POST', body: { credits: 10 } })).status, 401);
  assert.equal((await call('/api/credits/admin/coupons', { method: 'POST', token, body: { credits: 10 } })).status, 403);
  assert.equal((await call('/api/credits/admin/coupons', { method: 'POST', token: reg.data.token, body: { credits: 10 } })).status, 200);
});

test('las API keys duran como máximo 100 días', async () => {
  const { token } = await account();
  for (const days of [101, 365, 0, -5, 2.5, 'abc']) {
    const { status } = await call('/api/account/keys', { method: 'POST', token, body: { name: 'x', days } });
    assert.equal(status, 400, `days=${days}`);
  }
  const created = await keyFor(token, KEY_MAX_DAYS);
  assert.ok(created.key.startsWith('vsk_'));
  assert.equal(created.apiKey.daysLeft, 100);
  const span = created.apiKey.expiresAt - created.apiKey.createdAt;
  assert.equal(span, 100 * 86_400_000);

  // el listado nunca devuelve la clave en claro y en la BD solo queda el hash
  const list = await call('/api/account/keys', { token });
  assert.ok(!JSON.stringify(list.data).includes(created.key));
  const row = getDb().prepare('SELECT * FROM api_keys WHERE id = ?').get(created.apiKey.id);
  assert.ok(!JSON.stringify(row).includes(created.key));

  // renovar: también con tope de 100 días desde hoy
  assert.equal((await call(`/api/account/keys/${created.apiKey.id}/renew`, { method: 'POST', token, body: { days: 150 } })).status, 400);
  const renewed = await call(`/api/account/keys/${created.apiKey.id}/renew`, { method: 'POST', token, body: { days: 10 } });
  assert.equal(renewed.data.apiKey.daysLeft, 10);
});

test('los endpoints exigen una API key válida, vigente y no revocada', async () => {
  const { token } = await account();
  const { key, apiKey } = await keyFor(token, 5);

  assert.equal((await call('/api/v1/text/reverse?text=hola')).data.code, 'NO_KEY');
  assert.equal((await call('/api/v1/text/reverse?text=hola&key=vsk_falsa')).data.code, 'INVALID_KEY');

  const ok = await call(`/api/v1/text/reverse?text=hola&key=${key}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.data.result, 'aloh');
  assert.equal((await call('/api/v1/text/reverse?text=hola', { key })).data.result, 'aloh');

  // caducada
  getDb().prepare('UPDATE api_keys SET expires_at = ? WHERE id = ?').run(Date.now() - 1000, apiKey.id);
  const expired = await call('/api/v1/text/reverse?text=hola', { key });
  assert.equal(expired.status, 401);
  assert.equal(expired.data.code, 'EXPIRED_KEY');

  // revocada
  const second = await keyFor(token, 5);
  assert.equal((await call(`/api/account/keys/${second.apiKey.id}`, { method: 'DELETE', token })).status, 200);
  assert.equal((await call('/api/v1/text/reverse?text=hola', { key: second.key })).data.code, 'REVOKED_KEY');

  // otro usuario no puede revocar keys ajenas
  const third = await keyFor(token, 5);
  const intruder = await account('intruso');
  assert.equal((await call(`/api/account/keys/${third.apiKey.id}`, { method: 'DELETE', token: intruder.token })).status, 404);
});

test('el uso queda registrado por key y por cuenta', async () => {
  const { token } = await account();
  const { key } = await keyFor(token);
  await call('/api/v1/fun/coin', { key });
  await call('/api/v1/math/calc?expr=1%2B1', { key });
  const usage = await call('/api/account/usage', { token });
  assert.equal(usage.data.recent.length, 2);
  assert.ok(usage.data.recent.some((r) => r.endpoint === '/api/v1/math/calc'));
  const keys = await call('/api/account/keys', { token });
  assert.equal(keys.data.keys[0].requests, 2);
});

test('límite de 60 peticiones por minuto para usuarios normales', async () => {
  const { token } = await account();
  const { key } = await keyFor(token);
  let last;
  for (let i = 0; i < 61; i += 1) last = await call('/api/v1/fun/coin', { key });
  assert.equal(last.status, 429);
  assert.equal(last.data.code, 'RATE_LIMIT');
});

test('todos los endpoints responden con sus ejemplos', async () => {
  const owner = await call('/api/account/login', { method: 'POST', body: { email: 'lyanvalentinmail@gmail.com', password: 'owner-clave-1' } });
  const { key } = await keyFor(owner.data.token); // el owner no tiene límite por minuto
  for (const ep of FUNCTIONAL_ENDPOINTS) {
    const qs = new URLSearchParams(ep.params.filter((p) => p.example !== '').map((p) => [p.name, p.example])).toString();
    const res = await call(`/api/v1${ep.path}${qs ? `?${qs}` : ''}`, { key });
    assert.equal(res.status, 200, `${ep.path}: ${JSON.stringify(res.data).slice(0, 200)}`);
    if (ep.response === 'image') assert.match(res.type, /^image\//, ep.path);
    else assert.equal(res.data.ok, true, ep.path);
  }
});

test('resultados concretos de varios endpoints', async () => {
  const { token } = await account();
  const { key } = await keyFor(token);
  const get = async (path) => (await call(path, { key })).data;
  assert.equal((await get('/api/v1/convert/roman?value=2026')).result, 'MMXXVI');
  assert.equal((await get('/api/v1/convert/roman?value=MMXXVI')).result, 2026);
  assert.equal((await get('/api/v1/convert/base?value=ff&from=16&to=2')).result, '11111111');
  assert.equal((await get('/api/v1/convert/units?value=100&from=c&to=f')).result, 212);
  assert.equal((await get('/api/v1/encode/base64?text=hola')).result, 'aG9sYQ==');
  assert.equal((await get('/api/v1/encode/base64?text=aG9sYQ==&mode=decode')).result, 'hola');
  assert.equal((await get('/api/v1/text/morse?text=SOS')).result, '... --- ...');
  assert.deepEqual((await get('/api/v1/math/prime?n=360')).factors, [2, 2, 2, 3, 3, 5]);
  assert.equal((await get('/api/v1/validate/email?email=a@gmial.com')).suggestion, 'a@gmail.com');
  assert.equal((await get('/api/v1/validate/phone?number=%2B59899123456')).country, 'Uruguay');
  const ship1 = await get('/api/v1/fun/ship?a=Raiden&b=Yae');
  const ship2 = await get('/api/v1/fun/ship?a=yae&b=raiden');
  assert.equal(ship1.percent, ship2.percent);
  const div0 = await call('/api/v1/math/calc?expr=2/0', { key });
  assert.equal(div0.status, 400);
  const missing = await call('/api/v1/text/reverse', { key });
  assert.equal(missing.status, 400);
});

test('calculadora segura: precedencia, funciones y sin eval', () => {
  assert.equal(calculate('2+3*4'), 14);
  assert.equal(calculate('(2+3)^2'), 25);
  assert.equal(calculate('2^3^2'), 512);
  assert.equal(calculate('-sqrt(16)+pi*0'), -4);
  assert.throws(() => calculate('process.exit(1)'));
  assert.throws(() => calculate('1+'));
  assert.throws(() => calculate('constructor'));
});

test('letras decoradas con excepciones unicode', () => {
  assert.equal(fancyText('Hello', 'script'), 'ℋℯ𝓁𝓁ℴ');
  assert.equal(fancyText('ABC', 'smallcaps'), 'ᴀʙᴄ');
  assert.equal(fancyText('a1', 'bubble'), 'ⓐ①');
});

test('contraseñas: scrypt y compatibilidad con el hash antiguo', async () => {
  const stored = hashPassword('secreta-123');
  assert.ok(stored.startsWith('scrypt$'));
  assert.equal(verifyPassword('secreta-123', stored), true);
  assert.equal(verifyPassword('otra', stored), false);

  // usuario antiguo (sal:sha256) → puede entrar y su hash se migra
  const crypto = await import('node:crypto');
  const salt = 'abcd';
  const legacy = `${salt}:${crypto.createHash('sha256').update(`${salt}vieja-clave`).digest('hex')}`;
  getDb().prepare(`INSERT INTO web_users (id, email, username, password_hash, credits, plan, api_key, created_at, updated_at)
    VALUES ('legacy-1', 'legacy@test.com', 'legacy', ?, 0, 'free', 'sw_legacy', 1, 1)`).run(legacy);
  const login = await call('/api/account/login', { method: 'POST', body: { email: 'legacy@test.com', password: 'vieja-clave' } });
  assert.equal(login.status, 200);
  const row = getDb().prepare("SELECT password_hash FROM web_users WHERE id = 'legacy-1'").get();
  assert.ok(row.password_hash.startsWith('scrypt$'));
});
