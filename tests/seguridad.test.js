/**
 * 𓆩 ⛓️ 𓆪  Tests · las 12 medidas de seguridad
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { say, person, includes, registerPerson, sim, GROUP, usersRepo, rolesRepo, requestsRepo, groupsRepo, instancesRepo, confirmationsRepo } from './_harness.js';
import { getDb, tx } from '../src/db/index.js';
import { checkRateLimit, resetUser, sweep } from '../src/security/rate-limit.js';
import { checkPermission, canModerate, rankOf, RANK, isBotOwner } from '../src/security/permissions.js';
import { validateRoleName, validateConfigValue, resolveTarget, validateUserJid } from '../src/security/validation.js';
import { parseNameAge, sanitizeText } from '../src/utils/text.js';
import { maskPhone, phoneToJid } from '../src/utils/ids.js';
import { render } from '../src/design/index.js';
import { executeCommand } from '../src/core/router.js';
import { createContext } from '../src/core/context.js';
import { env } from '../src/config/env.js';

/* ── 1) permisos antes de ejecutar ───────────────────────────── */

test('la jerarquía owner > admin > registrado > miembro se respeta', () => {
  const member = { author: { jid: 'a@s.whatsapp.net', isAdmin: false, isRegistered: false } };
  const registered = { author: { jid: 'a@s.whatsapp.net', isAdmin: false, isRegistered: true } };
  const admin = { author: { jid: 'a@s.whatsapp.net', isAdmin: true, isRegistered: true } };

  assert.equal(rankOf(member), RANK.member);
  assert.equal(rankOf(registered), RANK.registered);
  assert.equal(rankOf(admin), RANK.admin);

  assert.equal(checkPermission(member, 'all').ok, true);
  assert.equal(checkPermission(member, 'registered').ok, false);
  assert.equal(checkPermission(registered, 'registered').ok, true);
  assert.equal(checkPermission(registered, 'admin').ok, false);
  assert.equal(checkPermission(admin, 'admin').ok, true);
  assert.equal(checkPermission(admin, 'owner').ok, false);
});

test('canModerate bloquea administradores, owner y automoderación', () => {
  const admin = { author: { jid: '1@s.whatsapp.net', isAdmin: true }, bot: { jid: '9@s.whatsapp.net' } };

  assert.equal(canModerate(admin, { jid: '2@s.whatsapp.net', isAdmin: false }).ok, true);
  assert.equal(canModerate(admin, { jid: '3@s.whatsapp.net', isAdmin: true }).ok, false);
  assert.equal(canModerate(admin, { jid: '1@s.whatsapp.net', isAdmin: false }).ok, false, 'no se modera a sí mismo');
  assert.equal(canModerate(admin, { jid: '9@s.whatsapp.net', isAdmin: false }).ok, false, 'no modera al bot');

  const member = { author: { jid: '4@s.whatsapp.net', isAdmin: false }, bot: { jid: '9@s.whatsapp.net' } };
  assert.equal(canModerate(member, { jid: '5@s.whatsapp.net', isAdmin: false }).ok, false);
});

test('isBotOwner solo reconoce los números de OWNER_NUMBERS', () => {
  if (!env.ownerNumbers.length) {
    assert.equal(isBotOwner('5215500000000@s.whatsapp.net'), false, 'sin owner configurado nadie lo es');
    return;
  }
  assert.equal(isBotOwner(phoneToJid(env.ownerNumbers[0])), true);
  assert.equal(isBotOwner('11111111111@s.whatsapp.net'), false);
});

/* ── 2) registros duplicados ─────────────────────────────────── */

test('la base de datos impide dos fichas del mismo número en el mismo grupo', () => {
  const jid = phoneToJid('5215588887777');
  usersRepo.create({ groupId: GROUP, jid, name: 'Una', age: 20 });
  assert.throws(
    () => usersRepo.create({ groupId: GROUP, jid, name: 'Dos', age: 21 }),
    (error) => error.code === 'DUPLICATE'
  );
});

/* ── 3) un personaje, un dueño ───────────────────────────────── */

test('el motor impide dos dueños para el mismo personaje y dos personajes para un usuario', () => {
  const role = rolesRepo.ensure(GROUP, 'UnicoOwner');
  const second = rolesRepo.ensure(GROUP, 'SegundoRol');
  const jid = phoneToJid('5215566665555');

  rolesRepo.assign(role.id, jid);
  assert.equal(rolesRepo.findById(role.id).owner_jid, jid);

  assert.throws(() => rolesRepo.assign(second.id, jid), /UNIQUE/i, 'un usuario no puede tener dos personajes');

  const other = phoneToJid('5215544443333');
  assert.equal(rolesRepo.assign(role.id, other), false, 'no se puede reasignar un personaje ocupado');
  assert.equal(rolesRepo.findById(role.id).owner_jid, jid, 'el dueño original se conserva');

  // reasignar al mismo dueño sí es idempotente (no rompe nada)
  assert.equal(rolesRepo.assign(role.id, jid), true);

  rolesRepo.release(role.id);
  rolesRepo.release(second.id);
});

test('los nombres de personaje son únicos por grupo (ignoran mayúsculas y acentos)', () => {
  const a = rolesRepo.ensure(GROUP, 'MismoNombre');
  const b = rolesRepo.ensure(GROUP, 'MISMONOMBRE');
  const c = rolesRepo.ensure(GROUP, '  MismoNombre  ');
  assert.equal(a.id, b.id, 'la clave canónica evita duplicados');
  assert.equal(a.id, c.id, 'los espacios sobrantes no crean otro personaje');

  const distinto = rolesRepo.ensure(GROUP, 'OtroPersonaje');
  assert.notEqual(distinto.id, a.id);
});

/* ── 4) solicitudes duplicadas ───────────────────────────────── */

test('no se pueden crear dos solicitudes pendientes iguales', () => {
  const jid = phoneToJid('5215522221111');
  usersRepo.create({ groupId: GROUP, jid, name: 'Soli', age: 22 });
  requestsRepo.create({ groupId: GROUP, userJid: jid, roleName: 'Uno', type: 'role' });
  assert.throws(() => requestsRepo.create({ groupId: GROUP, userJid: jid, roleName: 'Dos', type: 'role' }), /UNIQUE/i);
  requestsRepo.cancelAllForUser(GROUP, jid, 'limpieza');
});

test('resolver una solicitud dos veces no tiene efecto la segunda vez', () => {
  const jid = phoneToJid('521551010101');
  usersRepo.create({ groupId: GROUP, jid, name: 'Atomica', age: 23 });
  const request = requestsRepo.create({ groupId: GROUP, userJid: jid, roleName: 'Tres', type: 'role' });

  const first = requestsRepo.resolve(request.id, 'approved', jid);
  assert.ok(first);
  assert.equal(first.status, 'approved');

  assert.equal(requestsRepo.resolve(request.id, 'rejected', jid), null, 'la segunda resolución no aplica');
  assert.equal(requestsRepo.get(request.id).status, 'approved');
});

/* ── 5) validación de entradas ───────────────────────────────── */

test('valida nombres de personaje, motivos y objetivos', () => {
  assert.equal(validateRoleName('Felix').ok, true);
  assert.equal(validateRoleName('   Felix   ').value, 'Felix');
  assert.equal(validateRoleName('').ok, false);
  assert.equal(validateRoleName('.comando').ok, false);
  assert.equal(validateRoleName('a'.repeat(80)).ok, false);
  assert.equal(validateRoleName('<script>x</script>').ok, false);

  assert.equal(validateUserJid('5215512345678@s.whatsapp.net').ok, true);
  assert.equal(validateUserJid('120363000000000000@g.us').ok, false, 'un grupo no es un usuario');
  assert.equal(validateUserJid(null).ok, false);

  assert.equal(validateConfigValue('inactividad', '5').value, 5);
  assert.equal(validateConfigValue('inactividad', 'abc').ok, false);
  assert.equal(validateConfigValue('inactividad', '9999').ok, false, 'fuera de rango');
  assert.equal(validateConfigValue('bienvenida', 'si').value, true);
  assert.equal(validateConfigValue('prefijo', '!').value, '!');
  assert.equal(validateConfigValue('inexistente', '1').ok, false);
});

test('el parser de registro no deja pasar basura', () => {
  assert.deepEqual(parseNameAge('Moon.17'), { ok: true, name: 'Moon', age: 17 });
  assert.equal(parseNameAge('Moon').ok, false);
  assert.equal(parseNameAge('.17').ok, false);
  assert.equal(parseNameAge('Moon.').ok, false);
  assert.equal(parseNameAge('Moon.999').ok, false);
  assert.equal(parseNameAge(`${'x'.repeat(40)}.17`).ok, false, 'nombre demasiado largo');
  assert.equal(sanitizeText('hola\u0000\u001b[31m mundo').includes('\u0000'), false, 'elimina caracteres de control');
});

/* ── 6) errores sin tumbar el bot ────────────────────────────── */

test('un fallo al enviar no propaga la excepción fuera del router', async () => {
  const who = person('RompeEnvios');
  await say(who.jid, `.reg RompeEnvios.20`);

  const original = sim.client.sendMessage.bind(sim.client);
  let calls = 0;
  sim.client.sendMessage = async (...args) => {
    calls += 1;
    throw new Error('fallo simulado de red');
  };

  try {
    // no debe lanzar: el router captura y registra el error
    const ctx = await makeCtx(who.jid, '.ficha');
    await assert.doesNotReject(() => executeCommand(ctx, 'ficha'));
    assert.ok(calls > 0, 'intentó enviar');
  } finally {
    sim.client.sendMessage = original;
  }
});

test('una vista inexistente responde con un mensaje de error, no con un crash', () => {
  const text = render('vista.que.no.existe', { command: 'x' });
  assert.ok(text.includes('no tiene plantilla'), text);
});

async function makeCtx(jid, text) {
  const raw = {
    key: { remoteJid: GROUP, fromMe: false, id: `TEST${Date.now()}` },
    participant: jid,
    message: { extendedTextMessage: { text, contextInfo: {} } },
  };
  return createContext({ raw, instance: sim.instance, client: sim.client });
}

/* ── 7) nadie edita datos ajenos ─────────────────────────────── */

test('.editar solo modifica la ficha de quien lo ejecuta', async () => {
  const a = await registerPerson('AjenoA');
  const b = await registerPerson('AjenoB');

  await say(a.jid, `.editar ${b.name}.99`);
  assert.equal(usersRepo.get(GROUP, b.jid).age, 18, 'la ficha ajena no cambió');
  assert.equal(usersRepo.get(GROUP, b.jid).name, 'AjenoB', 'su nombre sigue intacto');
  // editar TU ficha con el nombre que quieras sí está permitido
  assert.equal(usersRepo.get(GROUP, a.jid).name, 'AjenoB');
  assert.equal(usersRepo.get(GROUP, a.jid).age, 99);
});

/* ── 8) confirmaciones ───────────────────────────────────────── */

test('las confirmaciones expiran y solo se pueden usar una vez', async () => {
  const who = await registerPerson('Confirma');
  const created = confirmationsRepo.create({ groupId: GROUP, userJid: who.jid, action: 'unreg', payload: {}, ttlMs: 50 });
  assert.ok(confirmationsRepo.getFor(GROUP, who.jid), 'pendiente vigente');

  await new Promise((resolve) => setTimeout(resolve, 70));
  assert.equal(confirmationsRepo.getFor(GROUP, who.jid), null, 'expiró sola');
  assert.equal(created.action, 'unreg');

  confirmationsRepo.create({ groupId: GROUP, userJid: who.jid, action: 'unreg', payload: {} });
  assert.ok(confirmationsRepo.consume(GROUP, who.jid), 'primer uso');
  assert.equal(confirmationsRepo.consume(GROUP, who.jid), null, 'no se puede reutilizar');
});

/* ── 9) anti-spam ────────────────────────────────────────────── */

test('el rate-limit corta el spam y se recupera con el tiempo', () => {
  const jid = 'ratelimit@test';
  resetUser(GROUP, jid);

  let allowed = 0;
  for (let i = 0; i < env.rateLimitMax + 2; i += 1) {
    if (checkRateLimit({ groupId: GROUP, jid, command: 'ping' }).allowed) allowed += 1;
  }
  assert.equal(allowed, env.rateLimitMax, 'deja pasar exactamente el máximo configurado');

  const blocked = checkRateLimit({ groupId: GROUP, jid, command: 'ping' });
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryInMs > 0);

  resetUser(GROUP, jid);
  assert.equal(checkRateLimit({ groupId: GROUP, jid, command: 'ping' }).allowed, true, 'resetUser libera');
  assert.ok(typeof sweep(0) === 'number');
});

test('los comandos caros tienen su propio enfriamiento', () => {
  const jid = 'cooldown@test';
  resetUser(GROUP, jid);
  assert.equal(checkRateLimit({ groupId: GROUP, jid, command: 'team' }).allowed, true);
  const second = checkRateLimit({ groupId: GROUP, jid, command: 'team' });
  assert.equal(second.allowed, false);
  assert.ok(second.retryInMs > 0);
  resetUser(GROUP, jid);
});

/* ── 10) datos de sesión protegidos ──────────────────────────── */

test('las sesiones y la base de datos quedan fuera del repositorio', async () => {
  const { readFileSync } = await import('node:fs');
  const gitignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
  for (const pattern of ['sessions/', 'data/', '.env', '*.db', 'logs/']) {
    assert.ok(gitignore.includes(pattern), `.gitignore debería cubrir ${pattern}`);
  }
  assert.ok(env.sessionsDir.includes('sessions'), 'las credenciales viven en sessions/');
});

/* ── 11) privacidad del número ───────────────────────────────── */

test('ningún mensaje público muestra el número completo', async () => {
  const who = await registerPerson('Privado', { age: 25 });
  const admin = person('PrivadoAdmin', { admin: 'admin' });
  await say(admin.jid, '.reg PrivadoAdmin.31');

  const outputs = [];
  for (const command of ['.ficha', '.perfil', '.team', '.miembros', '.roles', '.mirol', '.admins', '.reglas', '.botinfo', '.owner', '.ping']) {
    const reply = await say(who.jid, command);
    outputs.push(reply.all);
  }
  const adminReply = await say(admin.jid, '.perfil', [who.jid]);
  outputs.push(adminReply.all);

  const leaked = outputs.filter((text) => text.includes(who.phone));
  assert.deepEqual(leaked, [], 'ninguna respuesta filtra el número completo');

  assert.ok(outputs.join('\n').includes(maskPhone(who.jid)), 'en su lugar aparece enmascarado');
  assert.equal(maskPhone(who.jid).length >= 6, true);
  assert.ok(!maskPhone(who.jid).includes(who.phone));
});

/* ── 12) sincronización al salir del grupo ───────────────────── */

test('al salir se libera personaje, pareja, AFK y solicitudes', async () => {
  const a = await registerPerson('SaleA');
  const b = await registerPerson('SaleB');
  await say(a.jid, '.pareja', [b.jid]);
  await say(b.jid, '.aceptar');
  await say(a.jid, '.afk Viaje');
  await say(a.jid, '.rol PersonajeLibre');

  const before = requestsRepo.pendingForUser(GROUP, a.jid, 'role');
  assert.ok(before, 'tenía una solicitud pendiente');

  // el evento real de salida
  const { onParticipantsUpdate } = await import('../src/core/events.js');
  await onParticipantsUpdate({
    client: sim.client,
    instance: sim.instance,
    event: { id: GROUP, participants: [a.jid], action: 'remove' },
  });

  const user = usersRepo.get(GROUP, a.jid);
  assert.equal(user.status, 'left');
  assert.equal(user.afk_reason, null);
  assert.equal(user.partner_jid, null);
  assert.equal(usersRepo.get(GROUP, b.jid).partner_jid, null, 'la pareja queda limpia en ambos lados');
  assert.equal(requestsRepo.pendingForUser(GROUP, a.jid, 'role'), null, 'solicitud cancelada');
});

/* ── aislamiento entre grupos ────────────────────────────────── */

test('los datos de grupos distintos no se mezclan', async () => {
  const otherGroup = '120363000000000002@g.us';
  const instance = instancesRepo.create({
    name: 'Segundo grupo',
    phone: '5215500000099',
    pairingMode: 'qr',
    sessionDir: '/tmp/versova-test-session-2',
  });
  groupsRepo.upsert({ groupId: otherGroup, instanceId: instance.id, name: 'Otro team', size: 2 });

  const jid = phoneToJid('5215570707070');
  usersRepo.create({ groupId: GROUP, jid, name: 'Doble', age: 24 });
  usersRepo.create({ groupId: otherGroup, jid, name: 'DobleOtro', age: 30 });

  const roleA = rolesRepo.ensure(GROUP, 'Aislado');
  const roleB = rolesRepo.ensure(otherGroup, 'Aislado');
  assert.notEqual(roleA.id, roleB.id, 'son personajes distintos aunque se llamen igual');

  rolesRepo.assign(roleA.id, jid);
  assert.equal(rolesRepo.findByName(otherGroup, 'Aislado').status, 'free', 'en el otro grupo sigue libre');
  assert.equal(usersRepo.get(otherGroup, jid).name, 'DobleOtro');
  assert.equal(usersRepo.get(GROUP, jid).name, 'Doble');
  assert.equal(groupsRepo.get(otherGroup).instance_id, instance.id);

  instancesRepo.remove(instance.id);
  assert.equal(groupsRepo.get(otherGroup), null, 'borrar el sub-bot limpia sus grupos en cascada');
});

test('las transacciones revierten cambios si algo falla a mitad', () => {
  const jid = phoneToJid('521553131313');
  assert.throws(() =>
    tx(() => {
      usersRepo.create({ groupId: GROUP, jid, name: 'Transaccional', age: 27 });
      throw new Error('fallo a propósito');
    })
  );
  assert.equal(usersRepo.get(GROUP, jid), null, 'no quedó nada escrito');
  assert.equal(getDb().prepare('SELECT COUNT(*) n FROM users WHERE jid = ?').get(jid).n, 0);
});

test('el router no ejecuta comandos de otros grupos con folios ajenos', async () => {
  const admin = person('CrossAdmin', { admin: 'admin' });
  await say(admin.jid, '.reg CrossAdmin.33');
  const who = await registerPerson('CrossUser');
  await say(who.jid, '.rol CrossRole');
  const pending = requestsRepo.pendingForUser(GROUP, who.jid, 'role');

  // se intenta aprobar un folio inexistente
  const reply = await say(admin.jid, `.acceptrol #${pending.id + 9999}`);
  assert.ok(includes(reply, 'No encontré') || includes(reply, 'ya está'), reply.all);
  assert.equal(requestsRepo.get(pending.id).status, 'pending', 'la solicitud real sigue pendiente');
  requestsRepo.cancelAllForUser(GROUP, who.jid, 'limpieza');
});
