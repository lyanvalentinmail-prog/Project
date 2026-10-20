/**
 * 𓆩 🌊 𓆪  Tests · personalidad Tomioka (todas las plantillas)
 * ────────────────────────────────────────────────────────────────
 * Cuando un bot usa el estilo `tomioka`, CADA vista (salvo menu.*
 * y mod.warn, que ya tienen su propio camino) debe renderizarse
 * con la variante de agua de src/design/tomioka.js, y cuando el
 * estilo es otro deben seguir usándose las plantillas clásicas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { VIEWS, render } from '../src/design/index.js';
import { setRenderStyle } from '../src/design/theme.js';
import { TOMIOKA_VIEWS } from '../src/design/tomioka.js';
import { registry } from '../src/commands/index.js';

const ARRAY_KEYS = new Set([
  'mentions', 'adminMentions', 'list', 'entries', 'roles', 'reserved', 'admins',
  'requests', 'members', 'inactives', 'commands', 'aliases', 'notes', 'lines',
  'rows', 'warnings', 'options', 'results', 'steps', 'rolls', 'lines',
]);
const TIME_KEY = /(_at|At|until|Until|since|Since|date|Date|ts|activity|time|Timestamp)$/;
const NUMBER_KEYS = new Set([
  'id', 'age', 'count', 'total', 'percent', 'max', 'warns', 'ms', 'uptime', 'free',
  'hours', 'ttl', 'days', 'groups', 'users', 'rolesTaken', 'rolesTotal', 'registered',
  'couples', 'afk', 'size', 'n', 'active', 'withRole', 'instances', 'requestId', 'index',
  'minutes', 'seconds', 'limit', 'window', 'streak', 'added', 'failures', 'sent',
]);

/** Datos sintéticos que nunca revientan una plantilla (igual que diseno.test.js). */
function fakeData() {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === Symbol.toPrimitive) return () => 'Prueba';
        if (prop === Symbol.iterator) return undefined;
        if (typeof prop === 'symbol') return undefined;
        const key = String(prop);
        if (key === 'toString' || key === 'valueOf') return () => 'Prueba';
        if (ARRAY_KEYS.has(key)) return [fakeData()];
        if (TIME_KEY.test(key)) return Date.now();
        if (NUMBER_KEYS.has(key)) return 5;
        if (key === 'jid' || key === 'user_jid' || key === 'phone' || key === 'owner_jid') return '5215512345678@s.whatsapp.net';
        if (key === 'status') return 'taken';
        if (key === 'is_super') return 1;
        return 'Prueba';
      },
    }
  );
}

/** Vistas que NO van por la tabla Tomioka (menús y advertencia). */
const excluded = (view) => view.startsWith('menu.') || view === 'mod.warn';

test('toda vista del catálogo tiene su variante Tomioka (salvo menús y .warn)', () => {
  const missing = Object.keys(VIEWS).filter(
    (view) => !excluded(view) && typeof TOMIOKA_VIEWS[view] !== 'function'
  );
  assert.deepEqual(missing, [], `sin variante Tomioka: ${missing.join(', ')}`);
  assert.ok(Object.keys(TOMIOKA_VIEWS).length >= 100, `hay ${Object.keys(TOMIOKA_VIEWS).length} variantes`);
});

test('todas las variantes Tomioka renderizan sin errores con datos genéricos', () => {
  const failed = [];
  setRenderStyle('tomioka');
  try {
    for (const view of Object.keys(TOMIOKA_VIEWS)) {
      const text = render(view, fakeData());
      if (!text || typeof text !== 'string') failed.push(`${view}: vacío`);
      else if (text.includes('no tiene plantilla')) failed.push(`${view}: sin plantilla`);
      else if (text.includes('No se pudo componer')) failed.push(`${view}: ${text.split('\n')[2] ?? text}`);
    }
  } finally {
    setRenderStyle(null);
  }
  assert.deepEqual(failed, [], `vistas Tomioka que fallaron:\n${failed.join('\n')}`);
});

test('con estilo tomioka los mensajes salen en formato agua; con otro, en el clásico', () => {
  const data = { name: 'Moon', age: 17, phone: '5215512345678@s.whatsapp.net', date: Date.now(), total: 3, groupName: 'Team' };

  setRenderStyle('tomioka');
  let water;
  try {
    water = render('reg.success', data);
  } finally {
    setRenderStyle(null);
  }
  assert.ok(/💧|🌊|🫧/.test(water), 'la variante debe sonar a Tomioka');
  assert.ok(water.includes('Moon'), 'conserva los datos reales');

  const classic = render('reg.success', data);
  assert.notEqual(water, classic, 'el estilo clásico no debe cambiar');
  assert.ok(!classic.includes('𝐓'), 'sin marca Tomioka en el estilo clásico');
});

test('las vistas de menú no se ven afectadas por la tabla Tomioka', () => {
  setRenderStyle('tomioka');
  try {
    for (const [view, data] of Object.entries({
      'menu.main': {},
      'menu.full': { commands: registry.list },
      'menu.sections': { commands: registry.list },
      'menu.section': { section: 'roles', commands: registry.list },
      'menu.command': { ...registry.get('reg') },
    })) {
      const text = render(view, data);
      assert.ok(text && typeof text === 'string', `${view} debe seguir renderizando`);
      assert.ok(!text.includes('No se pudo componer'), `${view} sin errores`);
    }
  } finally {
    setRenderStyle(null);
  }
});
