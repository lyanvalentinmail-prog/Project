/**
 * Grupos con LID (Baileys 7): WhatsApp entrega «123…@lid» en vez del número
 * en mensajes, menciones, participantes y eventos de entrada/salida.
 * El bot debe seguir reconociendo al owner, saberse admin, expulsar a la
 * persona correcta y dar la bienvenida con la mención bien formada.
 */
// El primer número lo usa el simulador como número del bot; el segundo es el owner humano.
process.env.OWNER_NUMBERS = '5215599990000,5215599990001';

const { default: test } = await import('node:test');
const { default: assert } = await import('node:assert/strict');
const { EventEmitter } = await import('node:events');
const os = await import('node:os');
const fs = await import('node:fs');
const path = await import('node:path');
const { sim, plain } = await import('./_harness.js');
const { BotClient, resolveVersion } = await import('../src/core/bot-client.js');
const { createContext } = await import('../src/core/context.js');
const { clearGroupCache } = await import('../src/core/group-sync.js');
const { groupsRepo } = await import('../src/db/index.js');
const { LidMap, participantJid, adminsFromMetadata, botIsAdminIn, isLidJid } = await import('../src/utils/lid.js');

const LGROUP = '120363999999999999@g.us';
const BOT_PN = sim.client.jid;
const BOT_LID = '900000000000001@lid';
const OWNER_PN = '5215599990001@s.whatsapp.net';
const OWNER_LID = '900000000000002@lid';
const MEMBER_PN = '5215599990002@s.whatsapp.net';
const MEMBER_LID = '900000000000003@lid';
const HIDDEN_LID = '900000000000004@lid'; // sin número en la metadata
const HIDDEN_PN = '5215599990004@s.whatsapp.net';
const UNKNOWN_LID = '900000000000005@lid'; // nadie conoce su número
const ADMIN_PN = '5215599990006@s.whatsapp.net';
const ADMIN_LID = '900000000000006@lid';

let sequence = 0;

function lidFixture() {
  clearGroupCache();
  const client = new BotClient(sim.instance);
  client.jid = BOT_PN;
  client.lid = BOT_LID;
  client.status = 'open';
  const sent = [];
  const updates = [];
  const metadata = {
    id: LGROUP,
    subject: 'Team con LID',
    addressingMode: 'lid',
    creation: Math.floor(Date.now() / 1000) - 3600,
    participants: [
      { id: BOT_LID, admin: 'admin' }, // el propio bot: solo su LID
      { id: OWNER_LID, phoneNumber: OWNER_PN, admin: null },
      { id: MEMBER_LID, phoneNumber: MEMBER_PN, admin: null },
      { id: ADMIN_LID, phoneNumber: ADMIN_PN, admin: 'superadmin' },
      { id: HIDDEN_LID, admin: null },
      { id: UNKNOWN_LID, admin: null },
    ],
  };
  client.sock = {
    ev: new EventEmitter(),
    groupMetadata: async () => metadata,
    groupParticipantsUpdate: async (jid, targets, action) => {
      updates.push({ jid, targets, action });
      return targets.map((target) => ({ jid: target, status: '200' }));
    },
    sendMessage: async (jid, content) => {
      sent.push({ jid, content });
      return { key: { remoteJid: jid, fromMe: true, id: `LID-OUT-${++sequence}` } };
    },
    // almacén de Baileys: conoce el número de HIDDEN_LID (con sufijo de dispositivo)
    signalRepository: { lidMapping: { getPNForLID: async (lid) => (lid === HIDDEN_LID ? '5215599990004:0@s.whatsapp.net' : null) } },
  };
  client._bindEvents(client.sock);
  const participantsUpdate = (event) => client.sock.ev.listeners('group-participants.update')[0](event);
  return { client, sent, updates, metadata, participantsUpdate };
}

const groupMessage = ({ participant, participantAlt, text = '.ping', contextInfo = null }) => ({
  key: { remoteJid: LGROUP, participant, ...(participantAlt ? { participantAlt } : {}), fromMe: false, id: `LID-IN-${++sequence}` },
  messageTimestamp: Math.floor(Date.now() / 1000),
  message: contextInfo ? { extendedTextMessage: { text, contextInfo } } : { conversation: text },
});

/* ── utilidades puras ─────────────────────────────────────────── */

test('LidMap aprende parejas en cualquier orden, normaliza dispositivos y olvida las viejas', () => {
  const map = new LidMap({ max: 2 });
  assert.equal(map.learn('5215511111111:3@s.whatsapp.net', '111:7@lid'), true);
  assert.equal(map.toPn('111@lid'), '5215511111111@s.whatsapp.net');
  assert.equal(map.toLid('5215511111111@s.whatsapp.net'), '111@lid');
  assert.equal(map.learn('222@lid', '5215522222222@s.whatsapp.net'), true);
  assert.equal(map.learn('5215533333333@s.whatsapp.net', 'texto'), false, 'sin LID no hay pareja');
  assert.equal(map.same('111@lid', '5215511111111@s.whatsapp.net'), true);
  // acotado: el más viejo sale al superar el máximo
  map.learn('333@lid', '5215533333333@s.whatsapp.net');
  assert.equal(map.size, 2);
  assert.equal(map.toPn('111@lid'), '111@lid', 'sin pareja conocida devuelve el mismo LID');
  // un jid que no es LID se devuelve normalizado
  assert.equal(map.toPn('5215544444444:2@s.whatsapp.net'), '5215544444444@s.whatsapp.net');
});

test('participantJid prefiere el número y acepta textos u objetos de Baileys 7', () => {
  assert.equal(participantJid('5215511111111@s.whatsapp.net'), '5215511111111@s.whatsapp.net');
  assert.equal(participantJid({ id: '111@lid', phoneNumber: '5215511111111@s.whatsapp.net' }), '5215511111111@s.whatsapp.net');
  assert.equal(participantJid({ id: '5215511111111@s.whatsapp.net', lid: '111@lid' }), '5215511111111@s.whatsapp.net');
  assert.equal(participantJid({ id: '999@lid' }), '999@lid');
  const resolver = { toPn: (jid) => (jid === '999@lid' ? '5215599999999@s.whatsapp.net' : jid) };
  assert.equal(participantJid({ id: '999@lid' }, resolver), '5215599999999@s.whatsapp.net');
  assert.equal(participantJid(null), null);
  assert.equal(isLidJid('999@lid'), true);
});

test('adminsFromMetadata y botIsAdminIn funcionan con participantes LID', () => {
  const { client, metadata } = lidFixture();
  const admins = adminsFromMetadata(metadata, client);
  // el LID propio del bot se traduce a su número; sin cliente quedaría el LID
  assert.deepEqual(admins.map((a) => a.jid).sort(), [ADMIN_PN, BOT_PN].sort());
  assert.deepEqual(adminsFromMetadata(metadata).map((a) => a.jid).sort(), [ADMIN_PN, BOT_LID].sort());
  assert.equal(botIsAdminIn(metadata, client), true, 'el bot figura como admin por su LID');
  const notAdmin = { participants: metadata.participants.map((p) => (p.id === BOT_LID ? { ...p, admin: null } : p)) };
  assert.equal(botIsAdminIn(notAdmin, client), false);
});

/* ── contexto de mensajes ─────────────────────────────────────── */

test('en un grupo con LID el owner conserva su rango y el bot se sabe admin', async () => {
  const { client } = lidFixture();
  const ctx = await createContext({ raw: groupMessage({ participant: OWNER_LID, participantAlt: OWNER_PN }), instance: sim.instance, client });
  assert.equal(ctx.author.jid, OWNER_PN);
  assert.equal(ctx.author.isBotOwner, true);
  assert.equal(ctx.group.botIsAdmin, true);
  assert.equal(await client.isBotAdmin(LGROUP), true);
});

test('sin participantAlt, el LID se traduce con la lista de participantes', async () => {
  const { client } = lidFixture();
  const ctx = await createContext({ raw: groupMessage({ participant: MEMBER_LID }), instance: sim.instance, client });
  assert.equal(ctx.author.jid, MEMBER_PN);
});

test('si la metadata no trae el número, se consulta el almacén de LIDs de Baileys', async () => {
  const { client } = lidFixture();
  const ctx = await createContext({ raw: groupMessage({ participant: HIDDEN_LID }), instance: sim.instance, client });
  assert.equal(ctx.author.jid, HIDDEN_PN);
});

test('si nadie conoce el número se usa el LID (no se inventa uno)', async () => {
  const { client } = lidFixture();
  const ctx = await createContext({ raw: groupMessage({ participant: UNKNOWN_LID }), instance: sim.instance, client });
  assert.equal(ctx.author.jid, UNKNOWN_LID);
  assert.equal(ctx.author.isBotOwner, false);
});

test('menciones y mensajes citados con LID se traducen al número', async () => {
  const { client } = lidFixture();
  const raw = groupMessage({
    participant: OWNER_LID,
    participantAlt: OWNER_PN,
    text: '.ficha @900000000000003',
    contextInfo: {
      mentionedJid: [MEMBER_LID],
      stanzaId: 'CITA-1',
      participant: MEMBER_LID,
      quotedMessage: { conversation: 'hola' },
    },
  });
  const ctx = await createContext({ raw, instance: sim.instance, client });
  assert.deepEqual(ctx.mentions, [MEMBER_PN]);
  assert.equal(ctx.quoted.participant, MEMBER_PN);
});

test('los admins se guardan por número aunque el grupo use LID', async () => {
  const { client } = lidFixture();
  await createContext({ raw: groupMessage({ participant: MEMBER_LID }), instance: sim.instance, client });
  const admins = groupsRepo.listAdmins(LGROUP).map((a) => a.user_jid);
  assert.ok(admins.includes(ADMIN_PN), 'el admin humano queda con su número');
  assert.ok(admins.includes(BOT_PN), 'el bot queda con su número (aprendido de su propio LID)');
  assert.equal(groupsRepo.isAdmin(LGROUP, ADMIN_PN), true);
});

/* ── acciones sobre WhatsApp ──────────────────────────────────── */

test('expulsar en un grupo con LID usa el id con el que la persona figura en el grupo', async () => {
  const { client, updates } = lidFixture();
  await client.groupParticipantsUpdate(LGROUP, [MEMBER_PN], 'remove');
  assert.deepEqual(updates.at(-1), { jid: LGROUP, targets: [MEMBER_LID], action: 'remove' });
  await client.groupParticipantsUpdate(LGROUP, [ADMIN_PN], 'demote');
  assert.deepEqual(updates.at(-1).targets, [ADMIN_LID]);
  // añadir siempre es por número
  await client.groupParticipantsUpdate(LGROUP, [MEMBER_LID], 'add');
  assert.deepEqual(updates.at(-1).targets, [MEMBER_PN]);
  // alguien que no está en el grupo se envía tal cual
  await client.groupParticipantsUpdate(LGROUP, ['5215500000077@s.whatsapp.net'], 'remove');
  assert.deepEqual(updates.at(-1).targets, ['5215500000077@s.whatsapp.net']);
});

/* ── eventos de participantes (objetos de Baileys 7) ──────────── */

test('la bienvenida con participantes-objeto menciona al número correcto', async () => {
  const { sent, participantsUpdate } = lidFixture();
  const NEW_LID = '900000000000010@lid';
  const NEW_PN = '5215599990010@s.whatsapp.net';
  await participantsUpdate({
    id: LGROUP,
    author: ADMIN_LID,
    authorPn: ADMIN_PN,
    participants: [{ id: NEW_LID, phoneNumber: NEW_PN, admin: null }],
    action: 'add',
  });
  const welcome = sent.find((m) => m.jid === LGROUP && m.content.mentions?.length);
  assert.ok(welcome, 'se envió la bienvenida');
  assert.deepEqual(welcome.content.mentions, [NEW_PN]);
  assert.match(plain(welcome.content.text), /@5215599990010/);
  assert.ok(sent.every((m) => !(m.content.mentions ?? []).includes('@s.whatsapp.net')), 'ninguna mención rota');
});

test('el bot no se da la bienvenida a sí mismo cuando entra por LID', async () => {
  const { sent, participantsUpdate } = lidFixture();
  await participantsUpdate({ id: LGROUP, author: ADMIN_LID, authorPn: ADMIN_PN, participants: [{ id: BOT_LID, admin: null }], action: 'add' });
  assert.equal(sent.length, 0);
});

test('salida voluntaria con participantes-objeto envía la despedida', async () => {
  const { sent, participantsUpdate } = lidFixture();
  await participantsUpdate({
    id: LGROUP,
    author: MEMBER_LID,
    authorPn: MEMBER_PN,
    participants: [{ id: MEMBER_LID, phoneNumber: MEMBER_PN, admin: null }],
    action: 'remove',
  });
  assert.ok(sent.some((m) => m.jid === LGROUP), 'se envió la despedida al grupo');
});

test('los avisos de eventos van al grupo, no a «@s.whatsapp.net» (regresión)', async () => {
  const { eventTarget, onParticipantsUpdate } = await import('../src/core/events.js');
  const ctx = { group: { groupId: LGROUP }, author: { jid: MEMBER_PN } };
  assert.equal(eventTarget(ctx, 'group'), LGROUP);
  assert.equal(eventTarget(ctx, 'author'), MEMBER_PN);
  assert.equal(eventTarget(ctx, '5215599990002@s.whatsapp.net'), MEMBER_PN);
  assert.equal(eventTarget({}, 'group'), null);
  assert.equal(eventTarget(ctx, 'grupo-inventado'), null, 'un texto sin @ no es un destino');

  // camino completo con el cliente del simulador (participantes como texto)
  const before = sim.client.sent.length;
  await onParticipantsUpdate({
    client: sim.client,
    instance: sim.instance,
    event: { id: sim.groupJid, participants: ['5215599990020@s.whatsapp.net'], action: 'add' },
  });
  const delivered = sim.client.sent.slice(before);
  assert.ok(delivered.length > 0, 'se envió la bienvenida');
  assert.ok(delivered.every((m) => m.key.remoteJid === sim.groupJid));
});

/* ── conexión ─────────────────────────────────────────────────── */

test('440 (sesión abierta en otro lugar) no entra en un bucle de reconexión', async () => {
  const { client } = lidFixture();
  let restarted = false;
  client.start = async () => {
    restarted = true;
  };
  const listener = client.sock.ev.listeners('connection.update')[0];
  await listener({ connection: 'close', lastDisconnect: { error: { message: 'Stream Errored (conflict)', output: { statusCode: 440 } } } });
  assert.equal(client.status, 'closed');
  assert.match(client.lastError, /440/);
  assert.equal(client.reconnectAttempts, 0, 'no se programa ninguna reconexión');
  assert.equal(restarted, false);
});

test('stop() durante el arranque no deja un socket «zombi»', async () => {
  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'versova-start-race-'));
  const client = new BotClient({ ...sim.instance, session_dir: sessionDir });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('sin red en las pruebas', { status: 503 });
  try {
    const pending = client.start();
    await client.stop({ reason: 'prueba' });
    await pending;
    assert.equal(client.sock, null);
    assert.equal(client.status, 'closed');
  } finally {
    globalThis.fetch = originalFetch;
    await client.stop({ reason: 'limpieza' }).catch(() => null);
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
});

test('resolveVersion nunca lanza: devuelve una versión válida o null', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('sin red', { status: 503 });
  try {
    const version = await resolveVersion();
    assert.ok(version === null || (Array.isArray(version) && version.length === 3 && version.every(Number.isInteger)));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
