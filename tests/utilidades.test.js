/**
 * 𓆩 ☕ 𓆪  Tests · utilidades, validadores y registro de comandos
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { parseNameAge, sanitizeText, isSafeName, splitArgs, joinArgs, chunkText, truncate, byName } from '../src/utils/text.js';
import { formatDuration, timeAgo, daysSince, formatDate, formatDateTime, hoursFromNow, DAY, HOUR, MINUTE } from '../src/utils/time.js';
import { maskPhone, phoneToJid, normalizeJid, sameUser, jidToPhone, isGroupJid, isUserJid, newId, shortJid } from '../src/utils/ids.js';
import { compatibility, shipVerdict, backoff, groupBy, plural, stableHash, sleep } from '../src/utils/misc.js';
import { validateRoleName, validateReason, validateConfigValue, resolveTarget, validateUserJid, safeInline } from '../src/security/validation.js';
import { roleKey } from '../src/db/repositories/roles.repo.js';
import { registry } from '../src/commands/index.js';
import { ALIASES, IDENTITY } from '../src/config/identity.js';
import { env } from '../src/config/env.js';
import { defaultGroupConfig, CONFIG_KEYS, DEFAULT_RULES } from '../src/config/defaults.js';

/* ── parser de registro ─────────────────────────────────────── */

test('parseNameAge acepta los casos válidos', () => {
  assert.deepEqual(parseNameAge('Moon.17'), { ok: true, name: 'Moon', age: 17 });
  assert.deepEqual(parseNameAge('Ana.Sofia.18'), { ok: true, name: 'Ana.Sofia', age: 18 });
  assert.deepEqual(parseNameAge('  Nagi  .  21 '), { ok: true, name: 'Nagi', age: 21 });
  assert.deepEqual(parseNameAge('María José.19'), { ok: true, name: 'María José', age: 19 });
  assert.deepEqual(parseNameAge('K-9.10'), { ok: true, name: 'K-9', age: 10 });
  assert.deepEqual(parseNameAge('Moon .17'), { ok: true, name: 'Moon', age: 17 });
  assert.deepEqual(parseNameAge('Moon. 17'), { ok: true, name: 'Moon', age: 17 });
  assert.deepEqual(parseNameAge('Moon.17.18'), { ok: true, name: 'Moon.17', age: 18 });
});

test('parseNameAge rechaza todo lo inválido', () => {
  for (const bad of ['', '   ', 'Moon', 'Moon.', '.17', 'Moon.diecisiete', 'Moon.0', 'Moon.200', '.', '17']) {
    assert.equal(parseNameAge(bad).ok, false, `"${bad}" debería rechazarse`);
  }
  assert.equal(parseNameAge(`${'a'.repeat(25)}.17`).code, 'NAME_TOO_LONG');
  assert.equal(parseNameAge('Moon\nHack.17').ok, false, 'sin saltos de línea en el nombre');
  assert.equal(parseNameAge('.comando.17').ok, false, 'un nombre no puede parecer un comando');
});

test('sanitizeText limpia caracteres de control y bidireccionales', () => {
  assert.equal(sanitizeText('hola\u0000mundo'), 'holamundo');
  assert.equal(sanitizeText('a\u202Eb'), 'ab');
  assert.equal(sanitizeText('  muchos   espacios  '), 'muchos espacios');
  assert.equal(sanitizeText('x'.repeat(500), 10), 'x'.repeat(10));
  assert.equal(sanitizeText(null), '');
  assert.equal(isSafeName('Luna ♡'), true);
  assert.equal(isSafeName('<b>x</b>'), false);
});

test('splitArgs respeta comillas y joinArgs sanitiza', () => {
  assert.deepEqual(splitArgs('hola "mundo cruel" fin'), ['hola', 'mundo cruel', 'fin']);
  assert.deepEqual(splitArgs("'uno dos' tres"), ['uno dos', 'tres']);
  assert.deepEqual(splitArgs(''), []);
  assert.equal(joinArgs(['a', 'b']), 'a b');
  assert.equal(safeInline('texto│con├bordes'), 'texto con bordes');
});

test('chunkText parte los mensajes largos sin cortarlos a la mitad', () => {
  const long = Array.from({ length: 400 }, (_, i) => `línea ${i}`).join('\n');
  const parts = chunkText(long, 500);
  assert.ok(parts.length > 1);
  assert.ok(parts.every((p) => p.length <= 500));
  assert.equal(parts.join('').replace(/\n/g, '').length, long.replace(/\n/g, '').length);
  assert.deepEqual(chunkText('corto'), ['corto']);
});

test('truncate y byName ayudan a ordenar listados', () => {
  assert.equal(truncate('abcdefghijkl', 6), 'abcde…');
  assert.equal(truncate('abc', 6), 'abc');
  const sorted = [{ name: 'b' }, { name: 'A' }, { name: 'c' }].sort(byName);
  assert.deepEqual(sorted.map((x) => x.name), ['A', 'b', 'c']);
});

/* ── tiempo ─────────────────────────────────────────────────── */

test('las duraciones se formatean en español y sin ceros inútiles', () => {
  assert.equal(formatDuration(0), '0s');
  assert.equal(formatDuration(45_000), '45s');
  assert.equal(formatDuration(5 * MINUTE), '5m');
  assert.equal(formatDuration(5 * MINUTE + 30_000), '5m 30s');
  assert.equal(formatDuration(3 * HOUR), '3h');
  assert.equal(formatDuration(3 * HOUR + 12 * MINUTE), '3h 12m');
  assert.equal(formatDuration(24 * HOUR), '1d');
  assert.equal(formatDuration(2 * DAY + 4 * HOUR), '2d 4h');
  assert.equal(formatDuration(-5), '0s');
});

test('las fechas y el tiempo relativo son estables', () => {
  const ts = new Date(2026, 9, 12, 14, 5).getTime(); // 12/oct/2026 14:05
  assert.equal(formatDate(ts), '12/10/2026');
  assert.equal(formatDateTime(ts), '12/10/2026 · 14:05');
  assert.equal(formatDate(null), '—');

  assert.equal(timeAgo(Date.now() - 30_000), 'hace unos segundos');
  assert.equal(timeAgo(Date.now() - 5 * MINUTE), 'hace 5 minutos');
  assert.equal(timeAgo(Date.now() - 2 * HOUR), 'hace 2 horas');
  assert.equal(timeAgo(Date.now() - 1 * DAY), 'hace 1 día');
  assert.equal(timeAgo(Date.now() - 40 * DAY), 'hace 1 mes');
  assert.equal(timeAgo(null), 'nunca');

  assert.equal(daysSince(Date.now() - 3 * DAY), 3);
  assert.equal(daysSince(null), Infinity);
  assert.ok(hoursFromNow(24) - Date.now() <= 24 * HOUR);
});

/* ── identificadores y privacidad ───────────────────────────── */

test('jid: normalizado, teléfono y comparación', () => {
  assert.equal(phoneToJid('+52 1 55 1234 5678'), '5215512345678@s.whatsapp.net');
  assert.equal(phoneToJid('5215512345678'), '5215512345678@s.whatsapp.net');
  assert.equal(phoneToJid('123'), null, 'números demasiado cortos');
  assert.equal(jidToPhone('5215512345678@s.whatsapp.net'), '5215512345678');
  assert.equal(jidToPhone('120363000000000000@g.us'), null);
  assert.equal(normalizeJid('USER@S.WHATSAPP.NET'), 'user@s.whatsapp.net');
  assert.equal(isGroupJid('120363000000000000@g.us'), true);
  assert.equal(isUserJid('120363000000000000@g.us'), false);
  assert.equal(sameUser('5215512345678@s.whatsapp.net', '5215512345678:12@s.whatsapp.net'), true);
  assert.equal(sameUser('5215512345678@s.whatsapp.net', '5215512345679@s.whatsapp.net'), false);
});

test('maskPhone nunca expone el número completo', () => {
  const masked = maskPhone('5215512345678@s.whatsapp.net');
  assert.equal(masked, '52•••••••••78');
  assert.ok(!masked.includes('5215512345678'));
  assert.equal(maskPhone(''), '—');
  assert.ok(shortJid('5215512345678@s.whatsapp.net').includes('•'));
  assert.ok(shortJid('120363000000000000@g.us').startsWith('grupo:'));
  assert.notEqual(newId(), newId(), 'los ids son únicos');
  assert.equal(newId(8).length, 8);
});

/* ── misceláneos ────────────────────────────────────────────── */

test('compatibilidad: determinista, simétrica y acotada', () => {
  const a = 'a@s.whatsapp.net';
  const b = 'b@s.whatsapp.net';
  const first = compatibility(a, b);
  assert.equal(first, compatibility(b, a), 'simétrica');
  assert.equal(first, compatibility(a, b), 'estable entre llamadas');
  assert.ok(first >= 0 && first <= 100);
  assert.notEqual(compatibility(a, b), compatibility(a, 'c@s.whatsapp.net'));
  assert.equal(stableHash('x'), stableHash('x'));
  assert.ok(shipVerdict(99).length > 5);
  assert.ok(shipVerdict(1).length > 5);
  for (const value of [0, 30, 60, 90, 100]) assert.ok(shipVerdict(value));
});

test('backoff crece con tope y groupBy/plural funcionan', () => {
  assert.ok(backoff(1) >= 1000 && backoff(1) < 2000);
  assert.ok(backoff(5) > backoff(2));
  assert.ok(backoff(50, 1000, 60_000) <= 61_000);
  const grouped = groupBy([{ t: 'a' }, { t: 'b' }, { t: 'a' }], (x) => x.t);
  assert.equal(grouped.get('a').length, 2);
  assert.equal(plural(1, 'día'), 'día');
  assert.equal(plural(2, 'día'), 'días');
  assert.equal(plural(2, 'advertencia', 'advertencias'), 'advertencias');
});

test('sleep resuelve tras el tiempo pedido', async () => {
  const start = Date.now();
  await sleep(20);
  assert.ok(Date.now() - start >= 15);
});

/* ── validadores ────────────────────────────────────────────── */

test('validateRoleName y validateReason filtran entradas', () => {
  assert.equal(validateRoleName('Felix').ok, true);
  assert.equal(validateRoleName('  Felix  ').value, 'Felix');
  assert.equal(validateRoleName('').ok, false);
  assert.equal(validateRoleName('.menu').ok, false);
  assert.equal(validateRoleName('a'.repeat(40)).ok, false);
  assert.equal(validateRoleName('Felix<script>').ok, false);
  assert.equal(validateRoleName('Nagi Seishiro').ok, true);

  assert.equal(validateReason('motivo').value, 'motivo');
  assert.equal(validateReason('').value, null);
  assert.equal(validateReason('', { required: true }).ok, false);
  assert.equal(validateReason('x'.repeat(500), { max: 20 }).value.length, 20);
});

test('validateConfigValue cubre todas las claves configurables', () => {
  for (const key of Object.keys(CONFIG_KEYS)) {
    const spec = CONFIG_KEYS[key];
    const sample = spec.type === 'int' ? String(spec.min) : spec.type === 'bool' ? 'si' : '!';
    assert.equal(validateConfigValue(key, sample).ok, true, `${key} debería aceptarse`);
  }
  assert.equal(validateConfigValue('reserva', '0').ok, false, 'por debajo del mínimo');
  assert.equal(validateConfigValue('warns', 'x').ok, false);
  assert.equal(validateConfigValue('bienvenida', 'quizá').ok, false);
  assert.equal(validateConfigValue('prefijo', 'a').ok, false, 'el prefijo no puede ser una letra');
  assert.equal(validateConfigValue('inexistente', '1').ok, false);
});

test('resolveTarget usa menciones, números y mensajes citados', () => {
  const base = { mentions: [], quoted: null };
  assert.equal(resolveTarget({ ...base, mentions: ['a@s.whatsapp.net'] }).value, 'a@s.whatsapp.net');
  assert.equal(resolveTarget({ ...base, mentions: ['a@x', 'b@x'] }).ok, false, 'más de una mención');
  assert.equal(resolveTarget({ ...base }, { arg: '5215512345678' }).value, '5215512345678@s.whatsapp.net');
  assert.equal(
    resolveTarget({ ...base, quoted: { participant: 'q@s.whatsapp.net' } }).value,
    'q@s.whatsapp.net'
  );
  assert.equal(resolveTarget(base).ok, false);
  assert.equal(validateUserJid('grupo@g.us').ok, false);
});

test('roleKey normaliza mayúsculas, acentos y espacios', () => {
  assert.equal(roleKey('  Félix   Álvarez '), 'felix alvarez');
  assert.equal(roleKey('NAGI'), 'nagi');
  assert.equal(roleKey('Nagi'), roleKey('nagi'));
  assert.notEqual(roleKey('Nagi'), roleKey('Nagi Seishiro'));
});

/* ── configuración ──────────────────────────────────────────── */

test('la configuración por defecto es coherente con el entorno', () => {
  const config = defaultGroupConfig();
  assert.equal(config.prefix, IDENTITY.prefix);
  assert.equal(config.inactivity_days, env.inactivityDays);
  assert.equal(config.reserve_hours, env.reserveHours);
  assert.equal(config.max_warnings, env.maxWarnings);
  assert.ok(DEFAULT_RULES.length > 200);
  assert.ok(config.rules.includes('.reg'));
});

/* ── registro de comandos ───────────────────────────────────── */

test('todos los comandos están completos y sin duplicados', () => {
  const names = new Set();
  for (const command of registry.list) {
    assert.ok(command.name, 'nombre');
    assert.ok(command.description?.length > 10, `${command.name}: descripción`);
    assert.ok(command.category, `${command.name}: categoría`);
    assert.ok(['all', 'registered', 'admin', 'owner'].includes(command.permission), `${command.name}: permiso válido`);
    assert.equal(typeof command.run, 'function', `${command.name}: run()`);
    assert.equal(names.has(command.name), false, `duplicado: ${command.name}`);
    names.add(command.name);
  }
  assert.ok(registry.count() >= 40, `hay ${registry.count()} comandos`);
});

test('los comandos pedidos en el brief existen', () => {
  const required = [
    'reg', 'unreg', 'editar', 'ficha',
    'rol', 'roles', 'mirol', 'cambiarol', 'reservar', 'liberar',
    'team', 'miembros', 'afk', 'inactivos',
    'perfil', 'pareja', 'aceptar', 'rechazar', 'terminar', 'ship', 'reglas', 'admins',
    'add', 'expulsar', 'ban', 'unban', 'resetrol', 'warn', 'unwarn', 'acceptrol', 'denyrol',
    'anuncio', 'close', 'open', 'menu', 'confirmar', 'cancelar',
  ];
  const missing = required.filter((name) => !registry.get(name));
  assert.deepEqual(missing, [], `faltan comandos: ${missing.join(', ')}`);
});

test('los alias resuelven al comando correcto y no chocan', () => {
  for (const [name, aliases] of Object.entries(ALIASES)) {
    const command = registry.get(name);
    assert.ok(command, `el comando "${name}" de ALIASES no existe`);
    for (const alias of aliases) {
      assert.equal(registry.get(alias), command, `el alias "${alias}" debería apuntar a ${name}`);
    }
  }
  assert.equal(registry.get('kick'), registry.get('expulsar'));
  assert.equal(registry.get('help'), registry.get('help'), 'help es su propio comando');
});

test('las categorías del menú cubren todos los comandos visibles', () => {
  const categories = registry.categories();
  for (const category of ['info', 'registro', 'roles', 'team', 'social', 'admin']) {
    assert.ok(categories.includes(category), `falta la categoría ${category}`);
  }
  const orphans = registry.list.filter((c) => !categories.includes(c.category));
  assert.deepEqual(orphans, []);
});

test('suggest propone el comando correcto ante un error de tipeo', () => {
  assert.equal(registry.suggest('regg'), 'reg');
  assert.equal(registry.suggest('reservarr'), 'reservar');
  assert.equal(registry.suggest('menuu'), 'menu');
  assert.equal(registry.suggest('zzzzzzzzz'), null);
});
