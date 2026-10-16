/** Staff del panel: API real → SQLite → contexto → permisos → comandos. */
import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createWebServer } from '../web/server.js';
import { buildWebContext } from '../web/service-bridge.js';
import { BotManager } from '../src/core/bot-manager.js';
import { createContext } from '../src/core/context.js';
import { clearGroupCache, ensureGroup } from '../src/core/group-sync.js';
import { handleCommandMessage } from '../src/core/router.js';
import { checkPermission, isInstanceAdmin, RANK } from '../src/security/permissions.js';
import { getDb, normalizeAdminNumbers, MAX_INSTANCE_ADMINS } from '../src/db/index.js';
import {
  sim, GROUP, person, say, includes, registerPerson,
  instancesRepo, groupsRepo, requestsRepo, rolesRepo, warningsRepo, auditRepo,
} from './_harness.js';

let web;
let manager;
let sequence = 0;

before(async () => {
  manager = new BotManager();
  web = await createWebServer({ manager, port: 0, host: '127.0.0.1' });
});
after(async () => { await web?.stop(); });
afterEach(() => {
  instancesRepo.setAdminNumbers(sim.instance.id, []);
  instancesRepo.rename(sim.instance.id, sim.instance.name);
  instancesRepo.setPrefix(sim.instance.id, '.');
  instancesRepo.setAutostart(sim.instance.id, Boolean(sim.instance.autostart));
  clearGroupCache();
});

async function api(path, body) {
  const response = await fetch(`http://127.0.0.1:${web.port}/api${path}`, {
    method: body === undefined ? 'GET' : 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}
const edit = (body, id = sim.instance.id) => api(`/instances/${id}`, body);
const contextFor = (jid, { instance = sim.instance, group = GROUP, text = '.ping', client = sim.client } = {}) => createContext({
  instance, client,
  raw: {
    key: { remoteJid: group, participant: jid, fromMe: false, id: `STAFF-${++sequence}` },
    message: { conversation: text },
  },
});

test('normaliza formato internacional, separadores y duplicados sin aceptar basura', () => {
  const expected = ['59899123456', '5215512345678'];
  assert.deepEqual(normalizeAdminNumbers(' +598 (99) 123-456\r\n5215512345678, +59899123456;\n').value, expected);
  assert.deepEqual(normalizeAdminNumbers(['+598 99 123 456', '52.155.12345678', '59899123456']).value, expected);
  assert.deepEqual(normalizeAdminNumbers(' \n,;\r\n ').value, []);
  assert.deepEqual(normalizeAdminNumbers([]).value, []);
  for (const input of [null, {}, 59899123456, true, [null], [59899123456], [['59899123456']], 'hola59899123456', '59899123456@s.whatsapp.net', '59899123456@lid', '123', '059899123456', '+59899123456 ext 1', '1'.repeat(21)]) {
    assert.equal(normalizeAdminNumbers(input).ok, false, JSON.stringify(input));
  }
  const full = Array.from({ length: MAX_INSTANCE_ADMINS }, (_, i) => String(59899000000 + i));
  assert.equal(normalizeAdminNumbers(full).ok, true);
  assert.equal(normalizeAdminNumbers([...full, full[0]]).ok, true, 'los duplicados no consumen cupos');
  assert.equal(normalizeAdminNumbers([...full, '5215512345678']).ok, false);
});

test('el panel guarda y devuelve números normalizados, con auditoría sin teléfonos', async () => {
  const initial = await api('/instances');
  assert.deepEqual(initial.data.instances.find((i) => i.id === sim.instance.id).adminNumbers, []);
  const result = await edit({ name: 'Staff del team', prefix: '#', adminNumbers: '+598 99 123 456\n5215512345678,59899123456' });
  assert.equal(result.status, 200);
  assert.equal(result.data.instance.name, 'Staff del team');
  assert.equal(result.data.instance.prefix, '#');
  assert.deepEqual(result.data.instance.adminNumbers, ['59899123456', '5215512345678']);
  const row = instancesRepo.byId(sim.instance.id);
  assert.deepEqual(row.admin_numbers, result.data.instance.adminNumbers);
  assert.deepEqual(instancesRepo.byPhone(row.phone).admin_numbers, row.admin_numbers);
  assert.deepEqual(instancesRepo.all().find((i) => i.id === row.id).admin_numbers, row.admin_numbers);
  assert.equal(getDb().prepare('SELECT admin_numbers FROM bot_instances WHERE id = ?').get(row.id).admin_numbers, JSON.stringify(row.admin_numbers));
  const saved = await api('/instances');
  assert.deepEqual(saved.data.instances.find((i) => i.id === row.id).adminNumbers, row.admin_numbers);
  const audit = auditRepo.recent(20, row.id).find((event) => event.action === 'instance.admins.updated');
  assert.deepEqual(audit.detail, { source: 'web', previousCount: 0, count: 2 });
});

test('validación atómica: números o prefijo inválidos no guardan ningún cambio', async () => {
  await edit({ adminNumbers: ['59899123456'] });
  const before = instancesRepo.byId(sim.instance.id);
  for (const adminNumbers of [null, {}, true, [5215512345678], ['59899123456', 'abc'], '123', Array.from({ length: 51 }, (_, i) => String(59899000000 + i))]) {
    const result = await edit({ name: 'No guardar', prefix: '+', autostart: !before.autostart, adminNumbers });
    assert.equal(result.status, 400, JSON.stringify(adminNumbers));
    assert.match(result.data.error, /admin/i);
    assert.deepEqual(instancesRepo.byId(sim.instance.id), before);
  }
  const invalidPrefix = await edit({ name: 'Tampoco guardar', prefix: '?', adminNumbers: ['5215512345678'] });
  assert.equal(invalidPrefix.status, 400);
  assert.deepEqual(instancesRepo.byId(sim.instance.id), before);
  assert.equal((await edit({ adminNumbers: [] }, 'no-existe')).status, 404);
});

test('omitir los admins conserva la lista; texto vacío o [] elimina solo esa lista', async () => {
  for (const empty of ['', []]) {
    await edit({ adminNumbers: ['59899123456'] });
    const rename = await edit({ name: 'Nombre nuevo', prefix: '/' });
    assert.deepEqual(rename.data.instance.adminNumbers, ['59899123456']);
    const removed = await edit({ adminNumbers: empty });
    assert.deepEqual(removed.data.instance.adminNumbers, []);
    assert.equal(removed.data.instance.name, 'Nombre nuevo');
    assert.equal(removed.data.instance.prefix, '/');
  }
});

test('el snapshot cambia al editar staff aunque el bot siga conectado', async () => {
  // Un cliente ya arrancado conserva la fila antigua: la configuración debe venir de SQLite.
  const client = { name: sim.instance.name, status: 'open', snapshot() { return { name: this.name, status: 'open', uptimeMs: 1000 }; } };
  manager.clients.set(sim.instance.id, client);
  try {
    const before = await api('/state');
    await edit({ adminNumbers: ['59899123456'] });
    const after = await api('/state');
    assert.notEqual(before.data.revision, after.data.revision);
    const instance = after.data.instances.find((i) => i.id === sim.instance.id);
    assert.deepEqual(instance.adminNumbers, ['59899123456']);
    assert.equal(instance.live, true);
    assert.equal(instance.status, 'open');
    assert.equal((await api('/state')).data.revision, after.data.revision, 'sin cambios no repinta');
    await edit({ adminNumbers: [] });
    assert.notEqual((await api('/state')).data.revision, after.data.revision);
  } finally {
    manager.clients.delete(sim.instance.id);
  }
});

test('un miembro pasa a staff sin reiniciar y pierde ese acceso al quitar su número', async () => {
  const staff = person('StaffPanel');
  const denied = await say(staff.jid, '.anuncio Aviso del staff');
  assert.ok(includes(denied, 'solo para administradores'), denied.all);
  await edit({ adminNumbers: [staff.phone] });
  assert.deepEqual(sim.instance.admin_numbers, [], 'la instancia arrancada sigue siendo la fila antigua');
  const ctx = await contextFor(staff.jid);
  assert.equal(ctx.author.isAdmin, true);
  assert.equal(ctx.author.isInstanceAdmin, true);
  assert.equal(ctx.author.isGroupAdmin, false);
  assert.equal(ctx.author.isRegistered, false);
  assert.equal(ctx.author.isBotOwner, false);
  assert.equal(ctx.author.rank, RANK.admin);
  assert.equal(checkPermission(ctx, 'admin').ok, true);
  assert.equal(checkPermission(ctx, 'owner').ok, false);
  const allowed = await say(staff.jid, '.anuncio Aviso del staff');
  assert.ok(includes(allowed, 'Aviso del staff'), allowed.all);
  assert.ok(!includes(allowed, 'solo para administradores'), allowed.all);
  await edit({ adminNumbers: '' });
  const revoked = await say(staff.jid, '.anuncio No publicar');
  assert.ok(includes(revoked, 'solo para administradores'), revoked.all);
  assert.equal((await contextFor(staff.jid)).author.rank, RANK.member);
});

test('staff puede aprobar roles y advertir, pero no moderar a otros admins', async () => {
  const staff = person('AprobadorPanel');
  const colleague = person('OtroStaffPanel');
  const groupAdmin = person('AdminWhatsApp', { admin: 'admin' });
  const member = await registerPerson('SolicitantePanel');
  await say(member.jid, '.rol PersonajePanel');
  const request = requestsRepo.pendingForUser(GROUP, member.jid, 'role');
  await edit({ adminNumbers: [staff.phone, colleague.phone] });
  await say(staff.jid, `.acceptrol #${request.id}`);
  assert.equal(requestsRepo.get(request.id).status, 'approved');
  assert.equal(rolesRepo.findByName(GROUP, 'PersonajePanel').owner_jid, member.jid);
  await say(staff.jid, '.warn @usuario Prueba de moderación', [member.jid]);
  assert.equal(warningsRepo.activeCount(GROUP, member.jid), 1);
  for (const [actor, target] of [[staff, colleague], [staff, groupAdmin], [groupAdmin, staff]]) {
    const reply = await say(actor.jid, '.warn @usuario No permitido', [target.jid]);
    assert.ok(includes(reply, 'otro administrador'), reply.all);
    assert.equal(warningsRepo.activeCount(GROUP, target.jid), 0);
  }
});

test('quitar el permiso antes de confirmar una expulsión impide ejecutarla', async () => {
  const staff = person('StaffTemporal');
  const member = person('NoExpulsar');
  await edit({ adminNumbers: [staff.phone] });
  const ask = await say(staff.jid, '.expulsar @usuario Prueba', [member.jid]);
  assert.ok(includes(ask, 'confirmar'), ask.all);
  await edit({ adminNumbers: [] });
  const denied = await say(staff.jid, '.confirmar');
  assert.ok(includes(denied, 'Solo los administradores'), denied.all);
  assert.ok(sim.client.metadata.participants.some((p) => p.id === member.jid));
});

test('agregar al objetivo como staff también bloquea una expulsión pendiente', async () => {
  const admin = person('Expulsor', { admin: 'admin' });
  const member = person('NuevoStaff');
  await say(admin.jid, '.expulsar @usuario Prueba', [member.jid]);
  await edit({ adminNumbers: [member.phone] });
  const denied = await say(admin.jid, '.confirmar');
  assert.ok(includes(denied, 'otro administrador'), denied.all);
  assert.ok(sim.client.metadata.participants.some((p) => p.id === member.jid));
});

test('el staff pertenece solo al sub-bot elegido y no al espejo de admins del grupo', async () => {
  const staff = person('StaffAislado');
  const other = instancesRepo.create({ name: 'Otro bot', phone: '59899009999', sessionDir: '/tmp/versova-staff-other' });
  const otherGroup = '120363000000987654@g.us';
  try {
    await edit({ adminNumbers: [staff.phone] });
    await ensureGroup({ client: sim.client, instanceId: sim.instance.id, groupJid: GROUP, force: true });
    assert.equal(groupsRepo.isAdmin(GROUP, staff.jid), false, 'no asciende en WhatsApp');
    assert.equal((await contextFor(staff.jid)).author.isAdmin, true, 'resincronizar no borra el staff');
    const elsewhere = await contextFor(staff.jid, { instance: other, group: otherGroup });
    assert.equal(checkPermission(elsewhere, 'admin').ok, false);
    assert.equal(elsewhere.author.isAdmin, false);
    const sameBot = await contextFor(staff.jid, { group: '120363000000987655@g.us' });
    assert.equal(checkPermission(sameBot, 'admin').ok, true, 'funciona en los grupos de ese bot');
  } finally {
    instancesRepo.remove(other.id);
    groupsRepo.remove('120363000000987655@g.us');
  }
});

test('admins de WhatsApp mantienen sus permisos y el puente web reconoce el staff', async () => {
  const admin = person('AdminPermanente', { admin: 'admin' });
  const staff = person('StaffWeb');
  await edit({ adminNumbers: [admin.phone, staff.phone] });
  const ctx = await buildWebContext({ manager, groupId: GROUP, actorJid: staff.jid });
  assert.equal(ctx.author.isAdmin, true);
  assert.equal(ctx.author.isGroupAdmin, false);
  assert.equal(ctx.author.isInstanceAdmin, true);
  assert.equal(checkPermission(ctx, 'owner').ok, false);
  await edit({ adminNumbers: [] });
  const realAdmin = await contextFor(admin.jid);
  assert.equal(realAdmin.author.isAdmin, true);
  assert.equal(realAdmin.author.isGroupAdmin, true);
  assert.equal(realAdmin.author.isInstanceAdmin, false);
});

test('agregar números no sustituye el permiso de admin del bot en WhatsApp', async () => {
  const staff = person('StaffSinBotAdmin');
  const metadata = { ...sim.client.metadata, participants: sim.client.metadata.participants.map((p) => p.id === sim.client.jid ? { ...p, admin: null } : p) };
  const client = Object.create(sim.client);
  client.groupMetadata = async () => metadata;
  await edit({ adminNumbers: [staff.phone, sim.instance.phone] });
  clearGroupCache();
  const ctx = await contextFor(staff.jid, { client, text: '.close' });
  assert.equal(ctx.author.isAdmin, true);
  assert.equal(ctx.group.botIsAdmin, false);
  const before = sim.client.sent.length;
  await handleCommandMessage(ctx);
  assert.match(sim.client.sent.slice(before).map((m) => m.content.text).join('\n'), /No soy administrador/);
  assert.equal(groupsRepo.get(GROUP).locked, false);
});

test('compara JIDs canónicos sin confundir un LID con un número del staff', () => {
  const instance = { admin_numbers: ['59899123456'] };
  assert.equal(isInstanceAdmin(instance, '59899123456:12@s.whatsapp.net'), true);
  assert.equal(isInstanceAdmin(instance, '59899123456@lid'), false);
  assert.equal(isInstanceAdmin(instance, '59899123456@g.us'), false);
  assert.equal(isInstanceAdmin(instance, null), false);
  assert.equal(isInstanceAdmin({ admin_numbers: '59899123456' }, '59899123456@s.whatsapp.net'), false);
});
