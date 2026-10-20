/**
 * 𓆩 🌐 𓆪  Tests · endpoints «en línea» de /api/v1
 * ────────────────────────────────────────────────────────────────
 * Sin servidor ni cuentas: se llaman los handlers directos.
 * La validación (400) es determinista; la red, si no está, debe
 * degradar con 502 (descargas/IA) o resultados vacíos (búsquedas),
 * nunca con un error sin tipo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { FUNCTIONAL_ENDPOINTS } from '../web/api/v1.js';

const byPath = (path) => FUNCTIONAL_ENDPOINTS.find((ep) => ep.path === path);
const ONLINE_PATHS = [
  '/download/media', '/download/ytmp3', '/download/ytmp4', '/download/tiktok', '/download/instagram',
  '/search/youtube', '/search/spotify', '/search/lyrics', '/search/anime', '/search/wikipedia', '/search/weather',
  '/ai/chat', '/ai/translate',
  '/web/shorten',
];

test('el catálogo incluye las categorías Descargas, Búsquedas, IA y Web', () => {
  const categories = new Set(FUNCTIONAL_ENDPOINTS.map((ep) => ep.category));
  for (const category of ['Descargas', 'Búsquedas', 'IA', 'Web']) {
    assert.ok(categories.has(category), category);
  }
  for (const path of ONLINE_PATHS) {
    const ep = byPath(path);
    assert.ok(ep, path);
    assert.equal(ep.online, true, `${path}: debe marcarse online`);
    for (const param of ep.params.filter((item) => item.required)) {
      assert.ok(param.example, `${path}: el parámetro requerido «${param.name}» necesita ejemplo`);
    }
  }
});

test('sin parámetros obligatorios o con URL inválida responden 400', async () => {
  for (const path of ['/download/media', '/download/ytmp3', '/download/ytmp4', '/download/tiktok', '/download/instagram', '/web/shorten']) {
    await assert.rejects(() => byPath(path).handler({}, null, {}), (error) => error.status === 400, path);
    await assert.rejects(() => byPath(path).handler({ url: 'no-es-una-url' }, null, {}), (error) => error.status === 400, `${path} url`);
  }
  await assert.rejects(() => byPath('/ai/chat').handler({}, null, {}), (error) => error.status === 400);
  await assert.rejects(() => byPath('/ai/translate').handler({ text: 'hola', to: 'x!' }, null, {}), (error) => error.status === 400);
  await assert.rejects(() => byPath('/search/youtube').handler({}, null, {}), (error) => error.status === 400);
  await assert.rejects(() => byPath('/search/youtube').handler({ q: 'x', limit: '99' }, null, {}), (error) => error.status === 400);
  await assert.rejects(() => byPath('/search/weather').handler({}, null, {}), (error) => error.status === 400);
});

test('las búsquedas degradan sin red con resultados (posiblemente vacíos)', async () => {
  for (const path of ['/search/youtube', '/search/spotify', '/search/anime']) {
    const out = await byPath(path).handler({ q: 'prueba versova', limit: '2' }, null, {});
    assert.ok(Array.isArray(out.results), path);
    assert.equal(out.total, out.results.length, path);
  }
  const lyrics = await byPath('/search/lyrics').handler({ q: 'zzzz no existe esto' }, null, {});
  assert.equal(typeof lyrics.found, 'boolean');
  const wiki = await byPath('/search/wikipedia').handler({ q: 'Montevideo', lang: 'es' }, null, {});
  assert.equal(typeof wiki.found, 'boolean');
});

test('descargas e IA degradan sin red con 502, nunca con 500', async () => {
  const cases = [
    ['/download/ytmp3', { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }],
    ['/download/tiktok', { url: 'https://www.tiktok.com/@tiktok/video/7106594312292453675' }],
    ['/ai/chat', { prompt: 'hola' }],
    ['/ai/translate', { text: 'hola', to: 'en' }],
    ['/web/shorten', { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }],
    ['/search/weather', { city: 'Montevideo' }],
  ];
  for (const [path, query] of cases) {
    try {
      const out = await byPath(path).handler(query, null, {});
      assert.ok(out && typeof out === 'object', `${path}: con red debe devolver datos`);
    } catch (error) {
      assert.equal(error.status, 502, `${path}: sin red debe ser 502 (fue ${error.status ?? error.message})`);
    }
  }
});
