/**
 * 𓆩 𖤐 𓆪  Tests · gestión del team + interacción social
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { say, person, includes, registerPerson, registerWithRole, usersRepo, groupsRepo, GROUP } from './_harness.js';
import * as teamService from '../src/services/team.service.js';
import { getDb } from '../src/db/index.js';
import { compatibility } from '../src/utils/misc.js';

const has = (reply, text) => assert.ok(includes(reply, text), `se esperaba "${text}" en:\n${reply.all}`);
const hasNot = (reply, text) => assert.ok(!includes(reply, text), `no se esperaba "${text}" en:\n${reply.all}`);

async function adminPerson(name = 'Admin') {
  const admin = person(name, { admin: 'admin' });
  await say(admin.jid, `.reg ${name}.30`);
  return admin;
}

/* ── gestión del team ────────────────────────────────────────── */

test('.team muestra nombre, integrantes, registrados, personajes y admins', async () => {
  const admin = await adminPerson('TeamA');
  await registerPerson('TeamB');

  const reply = await say(admin.jid, '.team');
  has(reply, '◢禍◣ Versova');
  has(reply, 'Info del team');
  has(reply, 'Integrantes');
  has(reply, 'Registrados');
  has(reply, 'Personajes');
  has(reply, 'Admins');
  hasNot(reply, admin.phone, 'no filtra números completos');
});

test('.miembros lista solo a los registrados', async () => {
  const registered = await registerPerson('MiemA');
  const ghost = person('MiemGhost');

  const reply = await say(registered.jid, '.miembros');
  has(reply, 'MiemA');
  hasNot(reply, 'MiemGhost');
  assert.equal(usersRepo.get(GROUP, ghost.jid), null);
});

test('.afk guarda motivo e inicio, y avisa cuando mencionan al ausente', async () => {
  const sleepy = await registerPerson('Sleepy');
  const friend = await registerPerson('Friend');

  const set = await say(sleepy.jid, '.afk Estoy en clases');
  has(set, 'AFK');
  has(set, 'Estoy en clases');

  const stored = usersRepo.get(GROUP, sleepy.jid);
  assert.equal(stored.afk_reason, 'Estoy en clases');
  assert.ok(stored.afk_since > 0);

  const mention = await say(friend.jid, '¿vienes?', [sleepy.jid]);
  has(mention, 'está AFK');
  has(mention, 'Estoy en clases');
});

test('el aviso de AFK tiene enfriamiento y no spamea el grupo', async () => {
  const sleepy = await registerPerson('Cool');
  const friend = await registerPerson('Down');
  await say(sleepy.jid, '.afk Durmiendo');

  const first = await say(friend.jid, 'oye', [sleepy.jid]);
  has(first, 'está AFK');

  const second = await say(friend.jid, 'oye otra vez', [sleepy.jid]);
  hasNot(second, 'está AFK');
});

test('escribir un mensaje normal quita el AFK y lo anuncia', async () => {
  const who = await registerPerson('Vuelvo');
  await say(who.jid, '.afk Comer');
  assert.ok(usersRepo.get(GROUP, who.jid).afk_reason);

  const back = await say(who.jid, 'ya regresé, ¿qué me perdí?');
  has(back, 'volvió al rol');
  assert.equal(usersRepo.get(GROUP, who.jid).afk_reason, null);
});

test('.inactivos usa el umbral del grupo y ordena de mayor a menor', async () => {
  const admin = await adminPerson('InacAdmin');
  const old = await registerPerson('Old');
  const mid = await registerPerson('Mid');
  const fresh = await registerPerson('Fresh');

  const day = 86_400_000;
  getDb().prepare('UPDATE users SET last_activity = ? WHERE jid = ?').run(Date.now() - 10 * day, old.jid);
  getDb().prepare('UPDATE users SET last_activity = ? WHERE jid = ?').run(Date.now() - 8 * day, mid.jid);

  const reply = await say(admin.jid, '.inactivos');
  has(reply, 'Old');
  has(reply, 'Mid');
  hasNot(reply, 'Fresh');
  assert.ok(reply.all.indexOf('Old') < reply.all.indexOf('Mid'), 'ordenados de mayor a menor inactividad');

  await say(admin.jid, '.config inactividad 20');
  const after = await say(admin.jid, '.inactivos');
  has(after, 'Todo');
});

test('.config es solo para admins y valida claves y valores', async () => {
  const admin = await adminPerson('ConfAdmin');
  const member = await registerPerson('ConfMember');

  const denied = await say(member.jid, '.config inactividad 30');
  has(denied, 'Acceso restringido');

  const badKey = await say(admin.jid, '.config nada 3');
  has(badKey, 'Clave desconocida');

  const badValue = await say(admin.jid, '.config inactividad mucho');
  has(badValue, 'número entero');

  const good = await say(admin.jid, '.config reserva 48');
  has(good, '48');
  assert.equal(groupsRepo.get(GROUP).config.reserve_hours, 48);

  const list = await say(member.jid, '.config');
  has(list, 'reserva');
  has(list, '48');
});

/* ── interacción social ──────────────────────────────────────── */

test('.perfil muestra los datos de otro integrante sin su número completo', async () => {
  const viewer = await registerPerson('Viewer');
  const target = await registerPerson('Target', { age: 24 });

  const reply = await say(viewer.jid, '.perfil', [target.jid]);
  has(reply, 'Target');
  has(reply, '24 años');
  hasNot(reply, target.phone);
});

test('.perfil de alguien no registrado lo informa', async () => {
  const viewer = await registerPerson('Viewer2');
  const ghost = person('Ghost2');
  const reply = await say(viewer.jid, '.perfil', [ghost.jid]);
  has(reply, 'no está registrada');
});

test('.pareja exige que ambos estén registrados y libres', async () => {
  const a = await registerPerson('ParA');
  const ghost = person('ParGhost');

  const unregistered = await say(a.jid, '.pareja', [ghost.jid]);
  has(unregistered, 'no está registrada');

  const b = await registerPerson('ParB');
  const self = await say(a.jid, '.pareja', [a.jid]);
  has(self, 'ti mismo');

  const proposal = await say(a.jid, '.pareja', [b.jid]);
  has(proposal, 'Propuesta de pareja');
  has(proposal, '.aceptar');
});

test('.aceptar crea la relación en ambos perfiles', async () => {
  const a = await registerPerson('AcepA');
  const b = await registerPerson('AcepB');

  await say(a.jid, '.pareja', [b.jid]);
  const reply = await say(b.jid, '.aceptar');
  has(reply, 'Pareja');

  assert.equal(usersRepo.get(GROUP, a.jid).partner_jid, b.jid);
  assert.equal(usersRepo.get(GROUP, b.jid).partner_jid, a.jid);

  const profile = await say(a.jid, '.perfil', [b.jid]);
  has(profile, 'AcepA');
});

test('nadie con pareja puede recibir otra propuesta', async () => {
  const a = await registerPerson('FielA');
  const b = await registerPerson('FielB');
  const c = await registerPerson('FielC');

  await say(a.jid, '.pareja', [b.jid]);
  await say(b.jid, '.aceptar');

  const reply = await say(c.jid, '.pareja', [a.jid]);
  has(reply, 'ya tiene pareja');
});

test('.rechazar cierra la propuesta sin crear pareja', async () => {
  const a = await registerPerson('RechA');
  const b = await registerPerson('RechB');

  await say(a.jid, '.pareja', [b.jid]);
  const reply = await say(b.jid, '.rechazar');
  has(reply, 'rechazada');

  assert.equal(usersRepo.get(GROUP, a.jid).partner_jid, null);
  assert.equal(usersRepo.get(GROUP, b.jid).partner_jid, null);
});

test('.terminar pide confirmación y actualiza ambos perfiles', async () => {
  const a = await registerPerson('TermA');
  const b = await registerPerson('TermB');
  await say(a.jid, '.pareja', [b.jid]);
  await say(b.jid, '.aceptar');

  const ask = await say(a.jid, '.terminar');
  has(ask, '.confirmar');
  assert.equal(usersRepo.get(GROUP, a.jid).partner_jid, b.jid, 'todavía son pareja');

  const done = await say(a.jid, '.confirmar');
  has(done, 'terminada');
  assert.equal(usersRepo.get(GROUP, a.jid).partner_jid, null);
  assert.equal(usersRepo.get(GROUP, b.jid).partner_jid, null);
});

test('.ship es determinista, simétrico y no modifica parejas', async () => {
  const admin = await adminPerson('Shipper');
  const a = await registerPerson('ShipA');
  const b = await registerPerson('ShipB');
  await say(a.jid, '.pareja', [b.jid]);
  await say(b.jid, '.aceptar');

  const first = await say(admin.jid, '.ship', [a.jid, b.jid]);
  const second = await say(admin.jid, '.ship', [b.jid, a.jid]);

  const percent = (reply) => Number(/(\d{1,3})%/.exec(reply.all)?.[1]);
  assert.ok(Number.isFinite(percent(first)), 'muestra un porcentaje');
  assert.equal(percent(first), percent(second), 'el mismo par da el mismo resultado');
  assert.equal(percent(first), compatibility(a.jid, b.jid));

  assert.equal(usersRepo.get(GROUP, a.jid).partner_jid, b.jid, 'no altera la pareja registrada');
});

test('.ship con una sola mención shipea con el autor', async () => {
  const a = await registerPerson('SoloA');
  const b = await registerPerson('SoloB');
  const reply = await say(a.jid, '.ship', [b.jid]);
  has(reply, 'SoloA');
  has(reply, 'SoloB');
});

test('.reglas y .admins responden con la información del grupo', async () => {
  const admin = await adminPerson('ReglasA');
  const member = await registerPerson('ReglasB');

  const rules = await say(member.jid, '.reglas');
  has(rules, 'REGLAS');
  has(rules, '.reg');

  const staff = await say(member.jid, '.admins');
  has(staff, 'Staff');
  has(staff, 'Administradores');
});

test('la actividad se registra y alimenta .inactivos', async () => {
  const who = await registerPerson('Activo');
  const before = usersRepo.get(GROUP, who.jid).last_activity;
  teamService.resetMemory();
  await say(who.jid, 'hola a todos, mensaje normal');
  const after = usersRepo.get(GROUP, who.jid).last_activity;
  assert.ok(after >= before, 'la última actividad se actualiza');
});
