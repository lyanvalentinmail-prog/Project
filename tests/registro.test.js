/**
 * 𓆩 ☕ 𓆪  Tests · sistema de registro
 * ────────────────────────────────────────────────────────────────
 * Se recorren los comandos como lo haría un integrante real del grupo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  say,
  person,
  includes,
  registerPerson,
  registerWithRole,
  usersRepo,
  rolesRepo,
  requestsRepo,
  GROUP,
} from './_harness.js';

/** Comprueba que la respuesta contiene un texto (ignorando la decoración Unicode). */
const has = (reply, text) =>
  assert.ok(includes(reply, text), `se esperaba "${text}" en:\n${reply.all}`);
const hasNot = (reply, text) =>
  assert.ok(!includes(reply, text), `no se esperaba "${text}" en:\n${reply.all}`);

test('.reg guarda nombre, edad, número, fecha y deja el personaje libre', async () => {
  const luna = await registerPerson('Luna', { age: 19 });
  const user = usersRepo.get(GROUP, luna.jid);

  assert.equal(user.name, 'Luna');
  assert.equal(user.age, 19);
  assert.equal(user.jid, luna.jid);
  assert.equal(user.status, 'active');
  assert.ok(user.registered_at > 0, 'guarda la fecha de registro');
  assert.equal(user.role_id, null, 'empieza sin personaje');
});

test('.reg acepta nombres compuestos cortando por el último punto', async () => {
  const ana = await registerPerson('Ana.Sofia', { age: 20 });
  const user = usersRepo.get(GROUP, ana.jid);
  assert.equal(user.name, 'Ana.Sofia');
  assert.equal(user.age, 20);
});

test('.reg sin argumentos se rechaza y no crea ficha', async () => {
  const nico = await registerPerson('Nico');
  const before = usersRepo.counts(GROUP).active;
  const reply = await say(nico.jid, '.reg');
  has(reply, 'No enviaste nada después del comando');
  assert.equal(usersRepo.counts(GROUP).active, before);
});

test('.reg con edad no numérica se rechaza', async () => {
  const vale = person('Vale');
  const reply = await say(vale.jid, '.reg Vale.catorce');
  has(reply, 'El formato correcto es nombre.edad');
  assert.equal(usersRepo.get(GROUP, vale.jid), null, 'no se registró');
});

test('.reg con edad fuera de rango se rechaza', async () => {
  const ed = person('Ed');
  const reply = await say(ed.jid, '.reg Ed.3');
  has(reply, 'entre 5 y 99');
  assert.equal(usersRepo.get(GROUP, ed.jid), null);
});

test('.reg con nombre vacío se rechaza', async () => {
  const nobody = person('Nadie');
  const reply = await say(nobody.jid, '.reg .18');
  has(reply, 'Registro rechazado');
  assert.equal(usersRepo.get(GROUP, nobody.jid), null);
});

test('no admite registros duplicados del mismo número', async () => {
  const dani = await registerPerson('Dani');
  const reply = await say(dani.jid, '.reg Dani.18');
  has(reply, 'ya tiene ficha');
  const rows = usersRepo.list(GROUP, { status: 'active' }).filter((u) => u.jid === dani.jid);
  assert.equal(rows.length, 1, 'una sola ficha por número');
});

test('.editar cambia nombre y edad pero nunca el personaje', async () => {
  const admin = person('Staff', { admin: 'admin' });
  await say(admin.jid, '.reg Staff.30');
  const ivan = await registerWithRole('Ivan', 'Bachira', admin);

  assert.equal(usersRepo.get(GROUP, ivan.jid).role_name, 'Bachira');

  const reply = await say(ivan.jid, '.editar Iván.21');
  has(reply, 'Ficha actualizada');

  const after = usersRepo.get(GROUP, ivan.jid);
  assert.equal(after.name, 'Iván');
  assert.equal(after.age, 21);
  assert.equal(after.role_name, 'Bachira', 'el personaje no se modifica');
});

test('.ficha enmascara el número de teléfono', async () => {
  const mia = await registerPerson('Mia', { age: 22 });
  const reply = await say(mia.jid, '.ficha');
  has(reply, 'Mia');
  has(reply, '22 años');
  hasNot(reply, mia.phone);
  assert.match(reply.all, /•{3,}/, 'muestra el número enmascarado');
});

test('.unreg pide confirmación: no borra hasta .confirmar', async () => {
  const teo = await registerPerson('Teo');

  const ask = await say(teo.jid, '.unreg');
  has(ask, '.confirmar');
  assert.ok(usersRepo.get(GROUP, teo.jid), 'sigue registrado tras el aviso');

  const cancel = await say(teo.jid, '.cancelar');
  has(cancel, 'Acción cancelada');
  assert.ok(usersRepo.get(GROUP, teo.jid), '.cancelar conserva la ficha');

  await say(teo.jid, '.unreg');
  const done = await say(teo.jid, '.confirmar');
  has(done, 'Registro eliminado');
  has(done, 'Ficha borrada ⁙ Teo');
  assert.equal(usersRepo.get(GROUP, teo.jid), null, 'ficha borrada');
});

test('.unreg libera personaje, cancela solicitudes y rompe la pareja', async () => {
  const admin = person('Jefa', { admin: 'admin' });
  await say(admin.jid, '.reg Jefa.31');

  const nora = await registerWithRole('Nora', 'Chisaki', admin);
  const rui = await registerPerson('Rui');

  await say(nora.jid, '.pareja', [rui.jid]);
  await say(rui.jid, '.aceptar');
  assert.equal(usersRepo.get(GROUP, nora.jid).partner_jid, rui.jid);

  await say(nora.jid, '.unreg');
  await say(nora.jid, '.confirmar');

  assert.equal(usersRepo.get(GROUP, nora.jid), null, 'ficha eliminada');
  assert.equal(usersRepo.get(GROUP, rui.jid).partner_jid, null, 'pareja liberada en ambos lados');
  const role = rolesRepo.findByName(GROUP, 'Chisaki');
  assert.equal(role.status, 'free', 'el personaje vuelve al pool');
  assert.equal(role.owner_jid, null);
});

test('.unreg cancela las solicitudes pendientes del usuario', async () => {
  const admin = person('AdminB', { admin: 'admin' });
  await say(admin.jid, '.reg AdminB.28');
  const sol = await registerPerson('Sol');

  await say(sol.jid, '.rol Reigen');
  assert.ok(requestsRepo.pendingForUser(GROUP, sol.jid, 'role'), 'solicitud creada');

  await say(sol.jid, '.unreg');
  await say(sol.jid, '.confirmar');

  assert.equal(requestsRepo.pendingForUser(GROUP, sol.jid, 'role'), null, 'solicitud cancelada');
});

test('los comandos de ficha exigen registro previo', async () => {
  const ghost = person('Ghost');
  for (const command of ['.ficha', '.editar Ghost.20', '.mirol', '.liberar', '.reservar Deku']) {
    const reply = await say(ghost.jid, command);
    assert.ok(
      /𝑟𝑒𝑔𝑖𝑠𝑡𝑟|registr/i.test(reply.all),
      `"${command}" debería pedir registro, respondió:\n${reply.all}`
    );
  }
});

test('no se puede elegir personaje sin estar registrado', async () => {
  const sinFicha = person('SinFicha');
  const reply = await say(sinFicha.jid, '.rol Deku');
  assert.match(reply.all, /𝑅𝑒𝑔𝑖𝑠𝑡𝑟|registr/i);
  assert.equal(
    requestsRepo.listPending(GROUP).filter((r) => r.user_jid === sinFicha.jid).length,
    0,
    'no se creó ninguna solicitud'
  );
});
