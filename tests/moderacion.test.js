/**
 * 𓆩 ⛓️ 𓆪  Tests · moderación y administración
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  say,
  person,
  includes,
  registerPerson,
  registerWithRole,
  sim,
  usersRepo,
  groupsRepo,
  warningsRepo,
  rolesRepo,
  auditRepo,
  GROUP,
} from './_harness.js';
import * as events from '../src/core/events.js';

const has = (reply, text) => assert.ok(includes(reply, text), `se esperaba "${text}" en:\n${reply.all}`);
const hasNot = (reply, text) => assert.ok(!includes(reply, text), `no se esperaba "${text}" en:\n${reply.all}`);

async function adminPerson(name = 'Admin') {
  const admin = person(name, { admin: 'admin' });
  await say(admin.jid, `.reg ${name}.30`);
  return admin;
}

const inGroup = (jid) => sim.client.metadata.participants.some((p) => p.id === jid);

test('.warn guarda usuario, motivo, admin responsable, fecha y total', async () => {
  const admin = await adminPerson('WarnAdmin');
  const who = await registerPerson('Warned');

  const reply = await say(admin.jid, '.warn', [who.jid]);
  has(reply, 'Debes indicar un motivo');

  const done = await say(admin.jid, `.warn @${who.jid.split('@')[0]} Rompió la regla 5`, [who.jid]);
  has(done, 'Advertencia');
  has(done, 'Rompió la regla 5');

  const list = warningsRepo.list(GROUP, who.jid);
  assert.equal(list.length, 1);
  assert.equal(list[0].reason, 'Rompió la regla 5');
  assert.equal(list[0].admin_jid, admin.jid);
  assert.ok(list[0].created_at > 0);
  assert.equal(usersRepo.get(GROUP, who.jid).warn_count, 1);
});

test('tres advertencias provocan expulsión automática', async () => {
  const admin = await adminPerson('AutoKick');
  const who = await registerPerson('Spammer');

  await say(admin.jid, `.warn @${who.jid.split('@')[0]} uno`, [who.jid]);
  await say(admin.jid, `.warn @${who.jid.split('@')[0]} dos`, [who.jid]);
  assert.ok(inGroup(who.jid), 'sigue en el grupo con 2 warns');

  const third = await say(admin.jid, `.warn @${who.jid.split('@')[0]} tres`, [who.jid]);
  has(third, 'Límite alcanzado');
  assert.equal(warningsRepo.activeCount(GROUP, who.jid), 3);
  assert.equal(inGroup(who.jid), false, 'fue expulsado del grupo');
  assert.equal(usersRepo.get(GROUP, who.jid).status, 'kicked');
});

test('.unwarn retira la advertencia más reciente', async () => {
  const admin = await adminPerson('UnwarnA');
  const who = await registerPerson('Unwarned');

  await say(admin.jid, `.warn @${who.jid.split('@')[0]} primera`, [who.jid]);
  await say(admin.jid, `.warn @${who.jid.split('@')[0]} segunda`, [who.jid]);
  assert.equal(warningsRepo.activeCount(GROUP, who.jid), 2);

  const reply = await say(admin.jid, '.unwarn', [who.jid]);
  has(reply, 'retirada');
  assert.equal(warningsRepo.activeCount(GROUP, who.jid), 1);
  assert.equal(usersRepo.get(GROUP, who.jid).warn_count, 1);

  const none = await say(admin.jid, '.unwarn', [who.jid]);
  has(none, 'retirada');
  const empty = await say(admin.jid, '.unwarn', [who.jid]);
  has(empty, 'no tiene advertencias activas');
});

test('un miembro no puede usar comandos de administración', async () => {
  const member = await registerPerson('MiembroRaso');
  const other = await registerPerson('OtroRaso');

  for (const command of ['.warn', '.expulsar', '.ban', '.unban', '.close', '.open', '.anuncio hola', '.resetrol', '.acceptrol', '.denyrol', '.pendientes', '.auditoria']) {
    const reply = await say(member.jid, command, [other.jid]);
    assert.ok(includes(reply, 'Acceso restringido'), `"${command}" debería estar bloqueado:\n${reply.all}`);
  }
});

test('un admin no puede moderar a otro admin', async () => {
  const a = await adminPerson('AdminUno');
  const b = await adminPerson('AdminDos');

  const warn = await say(a.jid, '.warn intento', [b.jid]);
  has(warn, 'otro administrador');
  assert.equal(warningsRepo.activeCount(GROUP, b.jid), 0);

  const kick = await say(a.jid, '.expulsar', [b.jid]);
  has(kick, 'otro administrador');

  const ban = await say(a.jid, '.ban', [b.jid]);
  has(ban, 'otro administrador');
});

test('nadie puede moderarse a sí mismo', async () => {
  const admin = await adminPerson('SelfAdmin');
  const reply = await say(admin.jid, '.expulsar', [admin.jid]);
  has(reply, 'ti mismo');
});

test('.expulsar pide confirmación y solo expulsa al confirmar', async () => {
  const admin = await adminPerson('KickAdmin');
  const who = await registerPerson('Kickado');

  const ask = await say(admin.jid, '.expulsar Fuera del team', [who.jid]);
  has(ask, '.confirmar');
  assert.ok(inGroup(who.jid), 'todavía no se expulsa');

  const cancel = await say(admin.jid, '.cancelar');
  has(cancel, 'cancelada');
  assert.ok(inGroup(who.jid), 'cancelar detiene la acción');

  await say(admin.jid, '.expulsar Fuera del team', [who.jid]);
  const done = await say(admin.jid, '.confirmar');
  has(done, 'Expulsión');
  assert.equal(inGroup(who.jid), false, 'expulsado al confirmar');
  assert.equal(usersRepo.get(GROUP, who.jid).status, 'kicked');
});

test('.ban expulsa, guarda en la lista negra y re-expulsa si vuelve', async () => {
  const admin = await adminPerson('BanAdmin');
  const who = await registerPerson('Baneado');

  await say(admin.jid, '.ban Raid en el grupo', [who.jid]);
  const done = await say(admin.jid, '.confirmar');
  has(done, 'Ban');

  assert.equal(groupsRepo.isBlocked(GROUP, who.jid), true);
  assert.equal(inGroup(who.jid), false);
  assert.equal(usersRepo.get(GROUP, who.jid).status, 'banned');

  // vuelve a entrar → expulsión automática
  sim.client.addParticipant(who.jid);
  await events.onParticipantsUpdate({
    client: sim.client,
    instance: sim.instance,
    event: { id: GROUP, participants: [who.jid], action: 'add' },
  });
  assert.equal(inGroup(who.jid), false, 're-expulsado al reingresar');

  const list = await say(admin.jid, '.bloqueados');
  has(list, 'Lista negra');
});

test('.unban saca de la lista negra', async () => {
  const admin = await adminPerson('UnbanAdmin');
  const who = await registerPerson('Unbanned');

  await say(admin.jid, '.ban prueba', [who.jid]);
  await say(admin.jid, '.confirmar');
  assert.equal(groupsRepo.isBlocked(GROUP, who.jid), true);

  const reply = await say(admin.jid, `.unban ${who.phone}`);
  has(reply, 'desbloqueado');
  assert.equal(groupsRepo.isBlocked(GROUP, who.jid), false);

  const again = await say(admin.jid, `.unban ${who.phone}`);
  has(again, 'no está en la lista');
});

test('.close cierra el grupo e ignora comandos de miembros; .open lo reabre', async () => {
  const admin = await adminPerson('CloseAdmin');
  const member = await registerPerson('CloseMember');

  const close = await say(admin.jid, '.close');
  has(close, 'cerrado');
  assert.equal(groupsRepo.get(GROUP).locked, true);

  const ignored = await say(member.jid, '.team');
  assert.equal(ignored.count, 0, 'un miembro no recibe respuesta con el grupo cerrado');

  const adminStillWorks = await say(admin.jid, '.team');
  assert.ok(adminStillWorks.count > 0, 'los admins sí pueden usar comandos');

  const open = await say(admin.jid, '.open');
  has(open, 'abierto');
  assert.equal(groupsRepo.get(GROUP).locked, false);

  const after = await say(member.jid, '.team');
  assert.ok(after.count > 0, 'el miembro vuelve a recibir respuesta');
});

test('.anuncio se publica decorado y puede mencionar a todos', async () => {
  const admin = await adminPerson('AnunciaA');
  const member = await registerPerson('AnunciaB');

  const empty = await say(admin.jid, '.anuncio');
  has(empty, 'mensaje del anuncio');

  const simple = await say(admin.jid, '.anuncio Mañana hay evento de rol');
  has(simple, 'ANUNCIO');
  has(simple, 'Mañana hay evento de rol');

  const all = await say(admin.jid, '.anuncio @todos Reunión a las 21:00');
  has(all, 'Reunión a las 21:00');
  assert.ok(all.replies[0].includes(member.jid.split('@')[0]) || includes(all, member.jid.split('@')[0]), 'menciona a los registrados');
});

test('.add informa la limitación real de WhatsApp y ofrece el enlace', async () => {
  const admin = await adminPerson('AddAdmin');
  const reply = await say(admin.jid, '.add 5215512340000');

  assert.match(reply.all, /403|privacidad|No se pudo añadir/i);
  has(reply, 'chat.whatsapp.com');
  has(reply, '.reg');
});

test('.invite devuelve un enlace de invitación', async () => {
  const admin = await adminPerson('InviteAdmin');
  const reply = await say(admin.jid, '.invite');
  has(reply, 'Enlace');
});

test('.resetrol libera el personaje y conserva el registro', async () => {
  const admin = await adminPerson('ResetAdmin');
  const who = await registerWithRole('ResetUser', 'Shinobu', admin);

  const reply = await say(admin.jid, '.resetrol', [who.jid]);
  has(reply, 'liberado');

  assert.equal(rolesRepo.findByName(GROUP, 'Shinobu').status, 'free');
  const user = usersRepo.get(GROUP, who.jid);
  assert.ok(user, 'sigue registrado');
  assert.equal(user.role_id, null);
});

test('los eventos administrativos quedan auditados', async () => {
  const admin = await adminPerson('AuditAdmin');
  const who = await registerPerson('AuditUser');
  await say(admin.jid, `.warn @${who.jid.split('@')[0]} motivo de auditoría`, [who.jid]);
  await say(admin.jid, '.close');
  await say(admin.jid, '.open');

  const entries = auditRepo.list(GROUP, { limit: 50 }).map((e) => e.action);
  assert.ok(entries.includes('warn.add'), 'registra el warn');
  assert.ok(entries.includes('group.close'), 'registra el cierre');
  assert.ok(entries.includes('group.open'), 'registra la apertura');
  assert.ok(entries.includes('user.register'), 'registra los registros');
});

test('al salir del grupo se sincroniza el registro y se libera el personaje', async () => {
  const admin = await adminPerson('LeaveAdmin');
  const who = await registerWithRole('SeVa', 'Tanjiro', admin);

  await events.onParticipantsUpdate({
    client: sim.client,
    instance: sim.instance,
    event: { id: GROUP, participants: [who.jid], action: 'remove' },
  });

  const user = usersRepo.get(GROUP, who.jid);
  assert.equal(user.status, 'left');
  assert.equal(rolesRepo.findByName(GROUP, 'Tanjiro').status, 'free', 'personaje liberado');
  assert.equal(usersRepo.counts(GROUP).active, usersRepo.list(GROUP, { status: 'active' }).length);
});

test('al volver al grupo se restaura su ficha', async () => {
  const admin = await adminPerson('BackAdmin');
  const who = await registerPerson('SeFue');
  await events.onParticipantsUpdate({
    client: sim.client,
    instance: sim.instance,
    event: { id: GROUP, participants: [who.jid], action: 'remove' },
  });
  assert.equal(usersRepo.get(GROUP, who.jid).status, 'left');

  sim.client.addParticipant(who.jid);
  await events.onParticipantsUpdate({
    client: sim.client,
    instance: sim.instance,
    event: { id: GROUP, participants: [who.jid], action: 'add' },
  });
  assert.equal(usersRepo.get(GROUP, who.jid).status, 'active', 'ficha reactivada');
});

test('los cambios de admin/promote refrescan el espejo de administradores', async () => {
  const who = person('Promovido');
  sim.client.addParticipant(who.jid, { admin: 'admin' });
  await events.onParticipantsUpdate({
    client: sim.client,
    instance: sim.instance,
    event: { id: GROUP, participants: [who.jid], action: 'promote' },
  });
  assert.equal(groupsRepo.isAdmin(GROUP, who.jid), true);
});

test('un comando desconocido no ejecuta nada y sugiere el correcto', async () => {
  const who = await registerPerson('Despistado');
  const reply = await say(who.jid, '.reservarr Erwin');
  has(reply, 'no existe');
  has(reply, '.reservar');
  assert.equal(rolesRepo.reservationOf(GROUP, who.jid), null, 'no reservó nada');
});
