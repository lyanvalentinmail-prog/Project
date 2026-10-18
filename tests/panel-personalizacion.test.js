/**
 * 𓆩 ☕ 𓆪  Tests · API de personalización del panel
 * ────────────────────────────────────────────────────────────────
 * Levanta el servidor web real sobre UNA base de datos temporal
 * (aislada) y ejercita: banner del menú, modo lista, quitar/poner
 * categorías y validaciones.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fsp from 'node:fs/promises';

const TMP_DB = path.join(os.tmpdir(), `versova-panel-test-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = TMP_DB;

let createWebServer;
let BotManager;
let web;
let base;
let manager;
let instanceId;

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const api = async (path, { method = 'GET', body = null } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
};

before(async () => {
  ({ createWebServer } = await import('../web/server.js'));
  ({ BotManager } = await import('../src/core/bot-manager.js'));
  manager = new BotManager();
  web = await createWebServer({ manager, port: 0, host: '127.0.0.1' });
  base = `http://127.0.0.1:${web.port}`;
});

after(async () => {
  await web?.stop();
  await fsp.rm(`${TMP_DB}`, { force: true }).catch(() => {});
});

test('setup: crear el sub-bot de trabajo', async () => {
  const { status, data } = await api('/api/instances', {
    method: 'POST',
    body: { name: 'Bot Pru', phone: '59899111222', pairingMode: 'qr', prefix: '.' },
  });
  assert.ok([200, 201].includes(status), JSON.stringify(data));
  instanceId = data.instance?.id;
  assert.ok(instanceId);
});

test('PUT customization acepta banner, modo lista y categorías apagadas', async () => {
  const payload = {
    menuStyle: 'minimal',
    menuMode: 'list',
    banner: { dataUrl: TINY_PNG },
    aliases: {},
    disabled: [],
    disabledCategories: ['anime', 'logos'],
    categories: [{ id: 'juegos', title: 'JUEGOS', icon: '🎮', sub: 'juegos', kaomoji: '(^_^)' }],
    customCommands: [],
    categoryOverrides: {},
  };
  const { status, data } = await api(`/api/instances/${encodeURIComponent(instanceId)}/customization`, { method: 'PUT', body: payload });
  assert.equal(status, 200, JSON.stringify(data));
  assert.equal(data.ok, true);
  assert.equal(data.customization.menuMode, 'list');
  assert.deepEqual(data.customization.disabledCategories, ['anime', 'logos']);
  assert.equal(data.customization.banner.dataUrl, TINY_PNG);
  assert.equal(data.instance.customSummary.hasBanner, true);
  assert.equal(data.instance.customSummary.menuMode, 'list');
  assert.equal(data.instance.customSummary.disabledCategoryCount, 2);
});

test('GET commands marca comandos apagados y los de categoría apagada', async () => {
  const { status, data } = await api(`/api/instances/${encodeURIComponent(instanceId)}/commands`);
  assert.equal(status, 200);
  const kiss = data.commands.find((c) => c.name === 'kiss');
  const logo = data.commands.find((c) => c.name === 'logoneon');
  const reg = data.commands.find((c) => c.name === 'reg');
  assert.equal(kiss.categoryDisabled, true);
  assert.equal(logo.categoryDisabled, true);
  assert.equal(reg.categoryDisabled, false);
});

test('GET preview oculta las categorías apagadas y muestra la custom', async () => {
  const { data } = await api(`/api/instances/${encodeURIComponent(instanceId)}/preview`);
  assert.equal(data.ok, true);
  assert.ok(!data.preview.includes('.logoneon'), 'los logos no aparecen');
  assert.ok(!data.preview.includes('.kiss'), 'anime no aparece');
  assert.ok(data.preview.includes('juegos'), 'la categoría custom aparece (aunque esté vacía)');
});

test('PUT customization rechaza banner inválido y modo inválido', async () => {
  const badBanner = await api(`/api/instances/${encodeURIComponent(instanceId)}/customization`, {
    method: 'PUT',
    body: { banner: { url: 'javascript:alert(1)' } },
  });
  assert.equal(badBanner.status, 400);
  assert.ok(badBanner.data.error);

  const badMode = await api(`/api/instances/${encodeURIComponent(instanceId)}/customization`, {
    method: 'PUT',
    body: { menuMode: 'carrusel' },
  });
  assert.equal(badMode.status, 400);
});

test('quitar el banner con banner:null y volver a modo texto', async () => {
  const { status, data } = await api(`/api/instances/${encodeURIComponent(instanceId)}/customization`, {
    method: 'PUT',
    body: { menuMode: 'text', banner: null, disabledCategories: [] },
  });
  assert.equal(status, 200);
  assert.equal(data.customization.banner, null);
  assert.equal(data.customization.menuMode, 'text');
  assert.deepEqual(data.customization.disabledCategories, []);
  assert.equal(data.instance.customSummary.hasBanner, false);
});
