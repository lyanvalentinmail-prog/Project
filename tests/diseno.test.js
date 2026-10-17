/**
 * 𓆩 ☕ 𓆪  Tests · diseño de mensajes
 * ────────────────────────────────────────────────────────────────
 * Verifica que TODAS las plantillas rendericen sin explotar y que
 * cada acción tenga un diseño propio (requisito explícito del brief).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { VIEWS, render } from '../src/design/index.js';
import { mainMenu, sectionHelp, commandHelp, availableSections, fullHelp } from '../src/design/menu.js';
import { registry } from '../src/commands/index.js';
import { IDENTITY } from '../src/config/identity.js';
import { KAOMOJI, SYM, RULE, mention } from '../src/design/theme.js';
import { maskPhone } from '../src/utils/ids.js';

const ARRAY_KEYS = new Set([
  'mentions', 'adminMentions', 'list', 'entries', 'roles', 'reserved', 'admins',
  'requests', 'members', 'inactives', 'commands', 'aliases', 'notes',
]);
const TIME_KEY = /(_at|At|until|Until|since|Since|date|Date|ts|activity|time|Timestamp)$/;
const NUMBER_KEYS = new Set([
  'id', 'age', 'count', 'total', 'percent', 'max', 'warns', 'ms', 'uptime', 'free',
  'hours', 'ttl', 'days', 'groups', 'users', 'rolesTaken', 'rolesTotal', 'registered',
  'couples', 'afk', 'size', 'n', 'active', 'withRole', 'instances', 'requestId', 'index',
]);

/** Datos sintéticos que nunca revientan una plantilla. */
function fakeData() {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        // se comporta como string cuando una plantilla lo interpola
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

test('todas las vistas del catálogo renderizan texto sin errores', () => {
  const special = {
    'menu.main': {},
    'menu.full': { commands: registry.list },
    'menu.sections': { commands: registry.list },
    'menu.section': { section: 'roles', commands: registry.list },
    'menu.command': { ...registry.get('reg') },
  };

  const failed = [];
  for (const view of Object.keys(VIEWS)) {
    const data = special[view] ?? fakeData();
    const text = render(view, data);
    if (!text || typeof text !== 'string') failed.push(`${view}: vacío`);
    else if (text.includes('no tiene plantilla')) failed.push(`${view}: sin plantilla`);
    else if (text.includes('No se pudo componer')) failed.push(`${view}: ${text.split('\n')[2] ?? ''}`);
  }
  assert.deepEqual(failed, [], `vistas que fallaron:\n${failed.join('\n')}`);
  assert.ok(Object.keys(VIEWS).length >= 40, `hay ${Object.keys(VIEWS).length} vistas`);
});

test('cada acción importante tiene un diseño distinto', () => {
  const actions = {
    'reg.success': { name: 'Moon', age: 17, phone: '5215512345678@s.whatsapp.net', date: Date.now(), total: 3, groupName: 'Team' },
    'reg.rejected': { reason: 'Falta la edad' },
    'reg.duplicate': { name: 'Moon', since: Date.now() },
    'role.assigned': { roleName: 'Felix', userName: 'Moon', approvedBy: 'Admin' },
    'role.occupied': { roleName: 'Felix', ownerName: 'Moon', since: Date.now() },
    'role.request.created': { roleName: 'Felix', requestId: 1, admins: 2 },
    'role.rejected': { roleName: 'Felix', reason: 'No', rejectedBy: 'Admin' },
    'mod.warn': { userName: 'Moon', userMention: '@1', reason: 'Spam', adminName: 'Admin', count: 1, max: 3 },
    'mod.kick': { userName: 'Moon', adminName: 'Admin', reason: 'Raid' },
    'group.welcome': { name: 'Moon', groupName: 'Team', total: 4, mention: '@1' },
    'group.farewell': { name: 'Moon', groupName: 'Team', total: 3 },
    'team.afk.set': { name: 'Moon', reason: 'Clases', since: Date.now() },
    'team.afk.clear': { name: 'Moon', duration: '2h' },
    'couple.proposal': { fromName: 'Moon', toName: 'Luna', toMention: '@1', groupName: 'Team' },
    'couple.accepted': { a: 'Moon', b: 'Luna' },
    'couple.broken': { a: 'Moon', b: 'Luna' },
    'sys.rateLimited': { retryIn: 5, max: 6, windowSec: 10 },
    'sys.noPermission': { required: 'admin', command: 'warn' },
  };

  const heads = new Map();
  for (const [view, data] of Object.entries(actions)) {
    const text = render(view, data);
    const head = text.split('\n').slice(0, 3).join('|');
    if (heads.has(head)) {
      assert.fail(`"${view}" comparte cabecera con "${heads.get(head)}":\n${head}`);
    }
    heads.set(head, view);
  }
  assert.equal(heads.size, Object.keys(actions).length, 'cada acción abre con un diseño propio');
});

test('los mensajes decorados llevan ୨ৎ antes de los comandos', () => {
  const samples = [
    render('reg.rejected', { reason: 'x' }),
    render('reg.duplicate', { name: 'Moon', since: Date.now() }),
    render('role.occupied', { roleName: 'Felix', ownerName: 'Moon', since: Date.now() }),
    render('group.welcome', { name: 'Moon', groupName: 'Team', total: 2, mention: '@1' }),
    render('user.notRegistered', { command: 'rol' }),
  ].join('\n');
  assert.ok(samples.includes(`${SYM.clover} ${IDENTITY.prefix}`), 'usa ୨ৎ delante del prefijo');
  assert.ok(samples.includes('.reg'), 'muestra el comando de registro');
});

test('el menú reproduce el diseño oficial del team', () => {
  const menu = mainMenu({});
  for (const expected of [
    '𝑽 𝑬́ 𝑹 𝑺 𝑶 𝑽 𝑨',
    IDENTITY.team,
    '𝓜𝓮𝓷𝓾 𝓭𝓮 𝓬𝓸𝓶𝓪𝓷𝓭𝓸𝓼',
    '~𝕴𝐍𝐅𝐎𝐑𝐌𝐀𝐂𝐈𝐎𝐍~',
    '~𝕽𝐄𝐆𝐈𝐒𝐓𝐑𝐎~',
    '~𝕲𝐄𝐒𝐓𝐈𝐎𝐍~',
    '~𝕻𝐄𝐑𝐒𝐎𝐍𝐀𝐉𝐄𝐒~',
    '~𝕴𝐍𝐓𝐄𝐑𝐀𝐂𝐂𝐈𝐎𝐍~',
    '~𝕬𝐃𝐌𝐈𝐍𝐈𝐒𝐓𝐑𝐀𝐂𝐈𝐎𝐍~',
    '~𝕰𝐍𝐃 𝐎𝐅 𝐌𝐄𝐍𝐔~',
    '𝖾𝗌𝗍.ㅤ𝟐𝟎𝟐𝟔',
    '.reg <nombre.edad>',
    '.acceptrol',
    '.close',
  ]) {
    assert.ok(menu.includes(expected), `al menú le falta: ${expected}`);
  }
  assert.ok(menu.length > 1500, 'el menú está completo');
});

test('la ayuda por sección y por comando se genera desde el registro', () => {
  const sections = availableSections({ commands: registry.list });
  for (const category of ['registro', 'roles', 'team', 'social', 'admin', 'info', 'anime', 'economy', 'download', 'perfil', 'stickers', 'tools', 'logos']) {
    assert.ok(sections.includes(category), `falta la sección ${category}`);
  }

  const help = sectionHelp({ section: 'registro', commands: registry.list });
  assert.ok(help.includes('.reg'), 'lista el comando .reg');
  assert.ok(help.includes('REGISTRO'));

  const one = commandHelp(registry.get('reservar'));
  assert.ok(one.includes('.reservar'));
  assert.ok(one.includes('24'), 'explica la reserva');
});

test('.help explica todos los comandos del registro', () => {
  const full = fullHelp({ commands: registry.list });
  for (const command of registry.list.filter((c) => !c.hidden)) {
    assert.ok(full.includes(`${IDENTITY.prefix}${command.name}`), `falta ${command.name} en la ayuda completa`);
    assert.ok(full.includes(command.description), `falta la explicación de ${command.name}`);
  }
  assert.ok(full.includes('ejemplo:'), 'la ayuda completa incluye ejemplos');

  const help = registry.get('help');
  assert.equal(help.run({ argList: [] }).view, 'menu.full', 'sin argumentos explica todos los comandos');
  assert.equal(help.run({ argList: ['reg'] }).view, 'menu.command');
  assert.equal(help.run({ argList: ['registro'] }).view, 'menu.section');
  assert.equal(help.run({ argList: ['noexiste'] }).view, 'menu.sections');
});

test('la estética usa los símbolos y kaomojis pedidos', () => {
  const all = Object.values(KAOMOJI).join(' ');
  assert.ok(all.length > 50);
  for (const symbol of ['禊', '禍', '𓆩', '𓆪', '☕', '୨ৎ']) {
    assert.ok(Object.values(SYM).join('').includes(symbol), `falta el símbolo ${symbol}`);
  }
  assert.ok(Object.values(RULE).join('\n').includes('☕'), 'hay separadores con café');
});

test('las menciones y el enmascarado se formatean bien', () => {
  assert.equal(mention('5215512345678@s.whatsapp.net'), '@5215512345678');
  assert.ok(!maskPhone('5215512345678@s.whatsapp.net').includes('5215512345678'));
});

test('los perfiles públicos nunca muestran el número completo', () => {
  const phone = '5215598765432';
  for (const view of ['user.card', 'user.profile']) {
    const text = render(view, { ...fakeData(), phone: `${phone}@s.whatsapp.net`, jid: `${phone}@s.whatsapp.net` });
    assert.ok(!text.includes(phone), `${view} filtra el número`);
    assert.ok(text.includes('•••'), `${view} lo enmascara`);
  }
});
