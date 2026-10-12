/**
 * 𓆩 🥢 𓆪  Tests · sistema de personajes (roles)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  say,
  person,
  includes,
  registerPerson,
  registerWithRole,
  quoting,
  usersRepo,
  rolesRepo,
  requestsRepo,
  GROUP,
} from './_harness.js';
import * as rolesService from '../src/services/roles.service.js';
import { getDb } from '../src/db/index.js';

const has = (reply, text) => assert.ok(includes(reply, text), `se esperaba "${text}" en:\n${reply.all}`);
const hasNot = (reply, text) => assert.ok(!includes(reply, text), `no se esperaba "${text}" en:\n${reply.all}`);

async function adminPerson(name = 'Admin') {
  const admin = person(name, { admin: 'admin' });
  await say(admin.jid, `.reg ${name}.30`);
  return admin;
}

test('.rol crea una solicitud pendiente y avisa a los admins sin asignar', async () => {
  const admin = await adminPerson('Rika');
  const who = await registerPerson('Yuno');

  const reply = await say(who.jid, '.rol Felix');
  has(reply, 'pendiente');

  const pending = requestsRepo.pendingForUser(GROUP, who.jid, 'role');
  assert.ok(pending, 'se creó la solicitud');
  assert.equal(pending.status, 'pending');
  assert.equal(pending.role_name, 'Felix');

  const role = rolesRepo.findByName(GROUP, 'Felix');
  assert.equal(role.status, 'free', 'todavía no se asigna');
  assert.equal(role.owner_jid, null);
  assert.equal(usersRepo.get(GROUP, who.jid).role_id, null);

  // el aviso a los admins va en un segundo mensaje y menciona al admin
  assert.ok(reply.count >= 2, 'responde al usuario y avisa al staff');
  assert.ok(reply.all.includes(admin.jid.split('@')[0]), 'menciona al administrador');
});

test('la solicitud queda vinculada al mensaje para aprobarla respondiendo', async () => {
  const admin = await adminPerson('Sora');
  const who = await registerPerson('Kai');
  await say(who.jid, '.rol Reigen');

  const pending = requestsRepo.pendingForUser(GROUP, who.jid, 'role');
  assert.ok(pending.wa_message_id, 'guarda el id del mensaje de WhatsApp');

  const reply = await say(admin.jid, '.acceptrol', quoting(pending.wa_message_id));
  has(reply, 'asignado');

  const role = rolesRepo.findByName(GROUP, 'Reigen');
  assert.equal(role.status, 'taken');
  assert.equal(role.owner_jid, who.jid);
  assert.equal(usersRepo.get(GROUP, who.jid).role_id, role.id);
});

test('se puede aprobar por folio y por nombre', async () => {
  const admin = await adminPerson('Tono');
  const a = await registerPerson('Aki');
  const b = await registerPerson('Ren');

  await say(a.jid, '.rol Mob');
  const pa = requestsRepo.pendingForUser(GROUP, a.jid, 'role');
  await say(admin.jid, `.acceptrol #${pa.id}`);
  assert.equal(rolesRepo.findByName(GROUP, 'Mob').owner_jid, a.jid);

  await say(b.jid, '.rol Dazai');
  await say(admin.jid, '.acceptrol Dazai');
  assert.equal(rolesRepo.findByName(GROUP, 'Dazai').owner_jid, b.jid);
});

test('una misma solicitud no se puede aprobar dos veces', async () => {
  const admin = await adminPerson('Doble');
  const who = await registerPerson('Nino');
  await say(who.jid, '.rol Osamu');
  const pending = requestsRepo.pendingForUser(GROUP, who.jid, 'role');

  const first = await say(admin.jid, `.acceptrol #${pending.id}`);
  has(first, 'asignado');

  const second = await say(admin.jid, `.acceptrol #${pending.id}`);
  has(second, 'ya está aprobada');

  assert.equal(requestsRepo.get(pending.id).status, 'approved');
});

test('un personaje no puede pertenecer a dos usuarios', async () => {
  const admin = await adminPerson('Guarda');
  const owner = await registerWithRole('Hana', 'Kurosaki', admin);
  const other = await registerPerson('Ito');

  const reply = await say(other.jid, '.rol Kurosaki');
  has(reply, 'ocupado');
  assert.equal(rolesRepo.findByName(GROUP, 'Kurosaki').owner_jid, owner.jid);
  assert.equal(requestsRepo.pendingForUser(GROUP, other.jid, 'role'), null, 'no creó solicitud');
});

test('quien ya tiene personaje debe usar .cambiarol', async () => {
  const admin = await adminPerson('Juzo');
  const who = await registerWithRole('Emi', 'Shouto', admin);

  const reply = await say(who.jid, '.rol Deku');
  has(reply, '.cambiarol');
  assert.equal(rolesRepo.findByName(GROUP, 'Shouto').owner_jid, who.jid, 'conserva su personaje');
});

test('.cambiarol aprobado libera el anterior y asigna el nuevo', async () => {
  const admin = await adminPerson('Cambia');
  const who = await registerWithRole('Leo', 'Kenma', admin);

  const reply = await say(who.jid, '.cambiarol Kuroo');
  has(reply, 'cambio');

  const pending = requestsRepo.pendingForUser(GROUP, who.jid, 'role_change');
  assert.ok(pending, 'solicitud de cambio creada');
  assert.equal(pending.prev_role_name, 'Kenma');

  await say(admin.jid, `.acceptrol #${pending.id}`);

  assert.equal(rolesRepo.findByName(GROUP, 'Kuroo').owner_jid, who.jid, 'nuevo personaje asignado');
  assert.equal(rolesRepo.findByName(GROUP, 'Kenma').status, 'free', 'el anterior quedó libre');
  assert.equal(rolesRepo.findByName(GROUP, 'Kenma').owner_jid, null);
  assert.equal(usersRepo.get(GROUP, who.jid).role_id, rolesRepo.findByName(GROUP, 'Kuroo').id);
});

test('.cambiarol rechazado conserva el personaje anterior', async () => {
  const admin = await adminPerson('Niego');
  const who = await registerWithRole('Mio', 'Akihiko', admin);

  await say(who.jid, '.cambiarol Haru');
  const pending = requestsRepo.pendingForUser(GROUP, who.jid, 'role_change');
  const reply = await say(admin.jid, `.denyrol #${pending.id} Ese personaje es de otro team`);
  has(reply, 'rechazada');
  has(reply, 'Ese personaje es de otro team');

  assert.equal(rolesRepo.findByName(GROUP, 'Akihiko').owner_jid, who.jid, 'conserva el anterior');
  assert.equal(rolesRepo.findByName(GROUP, 'Haru').status, 'free');
  assert.equal(requestsRepo.get(pending.id).status, 'rejected');
});

test('no admite solicitudes duplicadas del mismo usuario', async () => {
  const who = await registerPerson('Dupa');
  const first = await say(who.jid, '.rol Personaje1');
  has(first, 'pendiente');

  const second = await say(who.jid, '.rol Personaje2');
  has(second, 'Ya tienes una solicitud pendiente');
  assert.equal(requestsRepo.listPending(GROUP).filter((r) => r.user_jid === who.jid).length, 1);

  const cancel = await say(who.jid, '.cancelarsolicitud');
  assert.ok(cancel.all.length > 0);
  assert.equal(requestsRepo.listPending(GROUP).filter((r) => r.user_jid === who.jid).length, 0);
});

test('.roles lista ocupados con su dueño y totales', async () => {
  const admin = await adminPerson('Lista');
  await registerWithRole('Pau', 'Gon', admin);
  await registerWithRole('Vera', 'Killua', admin);

  const reply = await say(admin.jid, '.roles');
  has(reply, 'Gon');
  has(reply, 'Pau');
  has(reply, 'Killua');
  has(reply, 'Vera');
  has(reply, 'Ocupados');
});

test('.mirol muestra el personaje propio', async () => {
  const admin = await adminPerson('Mine');
  const who = await registerWithRole('Taro', 'Levi', admin);
  const reply = await say(who.jid, '.mirol');
  has(reply, 'Levi');

  const without = await registerPerson('Nulo');
  has(await say(without.jid, '.mirol'), 'Sin personaje');
});

test('.reservar guarda 24 h y muestra el tiempo restante', async () => {
  const who = await registerPerson('Reser');
  const reply = await say(who.jid, '.reservar Erwin');
  has(reply, 'Reserva');
  has(reply, 'Erwin');
  has(reply, 'Restante');
  has(reply, '24 h');

  const role = rolesRepo.findByName(GROUP, 'Erwin');
  assert.equal(role.status, 'reserved');
  assert.equal(role.reserved_by, who.jid);
  const remaining = role.reserved_until - Date.now();
  assert.ok(remaining > 23 * 3600_000 && remaining <= 24 * 3600_000, `reserva de ~24 h (${remaining} ms)`);
});

test('no permite reservas duplicadas ni sobre personajes ocupados', async () => {
  const who = await registerPerson('Dupli');
  await say(who.jid, '.reservar Hange');

  const again = await say(who.jid, '.reservar Hange');
  has(again, 'Ya tienes una reserva activa');

  const other = await registerPerson('Otro');
  const taken = await say(other.jid, '.reservar Hange');
  has(taken, 'reservado');

  // segunda reserva de otro personaje tampoco
  const second = await say(who.jid, '.reservar Levi2');
  has(second, 'Ya tienes una reserva activa');
});

test('las reservas vencidas se liberan solas', async () => {
  const who = await registerPerson('Vence');
  await say(who.jid, '.reservar Marco');
  const role = rolesRepo.findByName(GROUP, 'Marco');
  assert.equal(role.status, 'reserved');

  // se adelanta el reloj de la reserva en la base de datos
  getDb().prepare('UPDATE roles SET reserved_until = ? WHERE id = ?').run(Date.now() - 1000, role.id);

  const result = rolesService.maintenance();
  assert.ok(result.releasedReservations >= 1, 'libera al menos una reserva');

  const after = rolesRepo.findById(role.id);
  assert.equal(after.status, 'free');
  assert.equal(after.reserved_by, null);
});

test('.liberar exige confirmación y devuelve el personaje al pool', async () => {
  const admin = await adminPerson('Libera');
  const who = await registerWithRole('Nao', 'Eren', admin);

  const ask = await say(who.jid, '.liberar');
  has(ask, '.confirmar');
  assert.equal(rolesRepo.findByName(GROUP, 'Eren').owner_jid, who.jid, 'todavía no se libera');

  const done = await say(who.jid, '.confirmar');
  has(done, 'liberado');
  assert.equal(rolesRepo.findByName(GROUP, 'Eren').status, 'free');
  assert.equal(usersRepo.get(GROUP, who.jid).role_id, null);
});

test('.resetrol libera el personaje pero conserva el registro', async () => {
  const admin = await adminPerson('Reset');
  const who = await registerWithRole('Ivo', 'Bakugo', admin);

  const reply = await say(admin.jid, '.resetrol', [who.jid]);
  has(reply, 'liberado');

  assert.equal(rolesRepo.findByName(GROUP, 'Bakugo').status, 'free');
  const user = usersRepo.get(GROUP, who.jid);
  assert.ok(user, 'el registro se conserva');
  assert.equal(user.name, 'Ivo');
  assert.equal(user.role_id, null);
});

test('.pendientes muestra las solicitudes abiertas a los admins', async () => {
  const admin = await adminPerson('Pend');
  const who = await registerPerson('Nia');
  await say(who.jid, '.rol Satoru');

  const reply = await say(admin.jid, '.pendientes');
  has(reply, 'Satoru');
  has(reply, 'Nia');

  requestsRepo.cancelAllForUser(GROUP, who.jid, 'limpieza del test');
});

test('los nombres de personaje son insensibles a mayúsculas y acentos', async () => {
  const admin = await adminPerson('Acento');
  const who = await registerPerson('Féli');
  await say(who.jid, '.rol félix álvarez');
  const pending = requestsRepo.pendingForUser(GROUP, who.jid, 'role');
  await say(admin.jid, `.acceptrol FELIX ALVAREZ`);
  assert.equal(requestsRepo.get(pending.id).status, 'approved');
  assert.equal(rolesRepo.findByName(GROUP, 'Félix Álvarez').owner_jid, who.jid);
});

test('rechaza nombres de personaje inválidos', async () => {
  const who = await registerPerson('Invalido');
  for (const bad of ['.rol', '.rol <script>alert(1)</script>', '.rol a'.padEnd(60, 'b')]) {
    const reply = await say(who.jid, bad);
    assert.ok(reply.all.length > 0, 'siempre responde algo');
    assert.equal(requestsRepo.pendingForUser(GROUP, who.jid, 'role'), null, `"${bad}" no creó solicitud`);
  }
});
