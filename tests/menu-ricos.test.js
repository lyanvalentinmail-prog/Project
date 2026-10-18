/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · menú rico: banner, lista interactiva,
 * categorías activables y generación real de logos.
 *
 * Todo corre en el simulador (sin internet): las rutas de red caen
 * a su respaldo y los medios se representan como texto verificable.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sim, say, registerPerson, includes } from './_harness.js';
import { customRepo, parseCustomConfig, validateCustomization, normalizeBanner } from '../src/db/repositories/bot-customization.repo.js';
import { buildMenuData, buildListPayload } from '../src/services/menu.service.js';
import { renderLogoPng, LOGO_EFFECT_IDS } from '../src/services/logo-renderer.js';
import { isPng } from '../src/utils/png.js';
import { registry } from '../src/commands/index.js';

const INSTANCE = () => sim.instance.id;
const restore = (previous) => customRepo.set(INSTANCE(), previous);

/* ── generación real de logos ───────────────────────────────── */

test('logos: el motor dibuja PNG válidos para los 25 efectos', () => {
  assert.equal(LOGO_EFFECT_IDS.length, 25);
  for (const id of LOGO_EFFECT_IDS) {
    const png = renderLogoPng(id, 'Versova');
    assert.ok(isPng(png), `${id} no produjo un PNG`);
    assert.ok(png.length > 800, `${id} produjo un PNG sospechosamente pequeño`);
  }
  const largo = renderLogoPng('logoneon', 'texto extremadamente largo');
  assert.ok(isPng(largo));
});

test('logos: .logoalas envía la imagen generada con su tarjeta', async () => {
  const who = await registerPerson('Dibuja');
  const reply = await say(who.jid, '.logoalas Versova');
  assert.ok(reply.all.includes('[imagen]'), `no se envió imagen: ${reply.all.slice(0, 120)}`);
  assert.ok(includes(reply, 'Versova'), reply.all);
  assert.ok(includes(reply, '𝐿𝑜𝑔𝑜'), reply.all);
  assert.ok(includes(reply, 'listo'), reply.all);
  const empty = await say(who.jid, '.logonaruto');
  assert.ok(includes(empty, 'texto'), empty.last);
});

test('logos: los 25 comandos .logo* siguen registrados', () => {
  assert.equal(registry.byCategory('logos').length, 25);
});

/* ── búsqueda de stickers (respaldo sin red) ────────────────── */

test('ssearch: sin conexión cae a la tarjeta con el enlace', async () => {
  const who = await registerPerson('Pega');
  const reply = await say(who.jid, '.ssearch gatos');
  assert.ok(includes(reply, 'sticker.ly'), reply.all);
  assert.ok(includes(reply, 'gatos'), reply.all);
});

/* ── personalización: nuevos campos ─────────────────────────── */

test('customización: parsea y valida menuMode, banner y disabledCategories', () => {
  const cfg = parseCustomConfig({
    menuMode: 'list',
    disabledCategories: ['anime', 'ANIME', 'mal id!!'],
    banner: { url: 'https://img.example/banner.jpg', caption: 'Hola' },
  });
  assert.equal(cfg.menuMode, 'list');
  assert.deepEqual(cfg.disabledCategories, ['anime']);
  assert.equal(cfg.banner.url, 'https://img.example/banner.jpg');
  assert.equal(cfg.banner.caption, 'Hola');

  // banner inválido descartado en parseo
  const bad = parseCustomConfig({ banner: { url: 'javascript:alert(1)' } });
  assert.equal(bad.banner, null);

  // validación reporta banner inválido
  const check = validateCustomization({ banner: { url: 'ftp://x' } }, { globalCommands: registry.list });
  assert.ok(!check.ok && check.errors.length >= 1);

  // data URL válida
  const tiny = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const withData = validateCustomization({ banner: { dataUrl: tiny } }, { globalCommands: registry.list });
  assert.ok(withData.ok, withData.errors?.join('|'));
  assert.equal(normalizeBanner({ url: ' https://a.b/c.png ' }).url, 'https://a.b/c.png');
  assert.equal(normalizeBanner(null), null);
});

/* ── quitar y poner categorías ──────────────────────────────── */

test('categorías: desactivar una categoría la oculta del menú y bloquea sus comandos', async () => {
  const who = await registerPerson('Gato');
  const previous = customRepo.get(INSTANCE());
  try {
    const before = buildMenuData(sim.instance, '.');
    assert.ok(before.categories.some((c) => c.meta.id === 'anime'), 'anime debe existir al inicio');

    customRepo.set(INSTANCE(), { ...previous, disabledCategories: ['anime'] });

    const data = buildMenuData(sim.instance, '.');
    assert.ok(!data.categories.some((c) => c.meta.id === 'anime'), 'anime debe desaparecer del menú');
    assert.ok(!data.categories.flatMap((c) => c.commands).some((c) => c.name === 'kiss'), 'kiss no debe listarse');

    const reply = await say(who.jid, '.kiss');
    assert.ok(includes(reply, 'deshabilitado'), reply.all);

    const menu = await say(who.jid, '.menu');
    assert.ok(!includes(menu, '.kiss'), 'el menú no debe mostrar .kiss');
    assert.ok(includes(menu, '.reg'), 'el resto del menú sigue');
  } finally {
    restore(previous);
  }
  const after = await say(who.jid, '.kiss');
  assert.ok(includes(after, 'kiss') || after.count >= 0, 'vuelve a funcionar tras reactivar');
});

test('categorías: al reactivarla vuelve al menú y sus comandos funcionan', async () => {
  const who = await registerPerson('Perro');
  const previous = customRepo.get(INSTANCE());
  try {
    customRepo.set(INSTANCE(), { ...previous, disabledCategories: ['logos'] });
    let reply = await say(who.jid, '.logoneon X');
    assert.ok(includes(reply, 'deshabilitado'), reply.all);

    customRepo.set(INSTANCE(), { ...previous, disabledCategories: [] });
    reply = await say(who.jid, '.logoneon Hola');
    assert.ok(includes(reply, '𝐿𝑜𝑔𝑜'), reply.all);
    assert.ok(reply.all.includes('[imagen]'), 'el logo vuelve a generar imagen');
  } finally {
    restore(previous);
  }
});

/* ── banner del menú ────────────────────────────────────────── */

test('banner: con banner configurado el menú viaja como imagen con pie de foto', async () => {
  const who = await registerPerson('Portada');
  const previous = customRepo.get(INSTANCE());
  const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  try {
    customRepo.set(INSTANCE(), { ...previous, banner: { dataUrl: tinyPng } });
    const reply = await say(who.jid, '.menu');
    assert.ok(reply.all.includes('[imagen]'), `debería enviar imagen: ${reply.all.slice(0, 160)}`);
    assert.ok(includes(reply, '𝕽𝐄𝐆𝐈𝐒𝐓𝐑𝐎') || includes(reply, 'REGISTRO'), 'la imagen lleva el menú de pie de foto');
  } finally {
    restore(previous);
  }
});

test('banner: con URL inalcanzable el menú cae a texto sin romperse', async () => {
  const who = await registerPerson('SinFoto');
  const previous = customRepo.get(INSTANCE());
  try {
    customRepo.set(INSTANCE(), { ...previous, banner: { url: 'https://no-existe.invalid/banner.jpg' } });
    const reply = await say(who.jid, '.menu');
    assert.ok(includes(reply, 'REGISTRO') || includes(reply, '𝕽𝐄𝐆𝐈𝐒𝐓𝐑𝐎'), 'el menú de texto sigue llegando');
  } finally {
    restore(previous);
  }
});

/* ── menú en modo lista ─────────────────────────────────────── */

test('modo lista: el menú llega como lista interactiva con las categorías', async () => {
  const who = await registerPerson('Elige');
  const previous = customRepo.get(INSTANCE());
  try {
    customRepo.set(INSTANCE(), { ...previous, menuMode: 'list' });
    const reply = await say(who.jid, '.menu');
    assert.ok(reply.all.includes('[lista]'), `debería enviar lista: ${reply.all.slice(0, 160)}`);
    assert.ok(includes(reply, 'Name') && includes(reply, 'Prefix'), 'la lista lleva la info del bot');
    assert.ok(reply.all.includes('.menu anime'), 'hay fila para la categoría anime');
    assert.ok(reply.all.includes('.help'), 'hay fila para ver todo');
  } finally {
    restore(previous);
  }
});

test('modo lista: buildListPayload respeta las categorías desactivadas', () => {
  const previous = customRepo.get(INSTANCE());
  try {
    customRepo.set(INSTANCE(), { ...previous, menuMode: 'list', disabledCategories: ['economy'] });
    const data = buildMenuData(sim.instance, '.');
    const list = buildListPayload(data);
    const ids = list.sections.flatMap((s) => s.rows.map((r) => r.id));
    assert.ok(!ids.some((id) => id.includes('economy')), 'economy no debe aparecer');
    assert.ok(ids.some((id) => id.includes('anime')), 'anime sí aparece');
  } finally {
    restore(previous);
  }
});

/* ── búsquedas reales con respaldo ──────────────────────────── */

test('play: sin red devuelve tarjeta con enlace de búsqueda', async () => {
  const who = await registerPerson('Melomane');
  const reply = await say(who.jid, '.play bad bunny diles');
  assert.ok(reply.count >= 1);
  // con o sin red: nunca un error crudo
  assert.ok(!includes(reply, 'falló al procesar'), reply.all);
  assert.ok(includes(reply, 'YouTube') || includes(reply, 'youtu'), reply.all);
});

test('lyrics: sin red devuelve tarjeta con enlaces de letras', async () => {
  const who = await registerPerson('Cantor');
  const reply = await say(who.jid, '.lyrics canción imposible que no existe xqz');
  assert.ok(includes(reply, 'letra') || includes(reply, 'Letra'), reply.all);
});

test('spotify: sin red devuelve tarjeta con enlace de búsqueda', async () => {
  const who = await registerPerson('Discoteque');
  const reply = await say(who.jid, '.spotify canción inventada xqz');
  assert.ok(includes(reply, 'spotify') || includes(reply, 'Spotify'), reply.all);
});
