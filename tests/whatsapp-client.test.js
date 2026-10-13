/** Regresiones del adaptador real: el simulador no pasa por messages.upsert. */
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { sim, GROUP, person, plain, usersRepo } from './_harness.js';
import { BotClient } from '../src/core/bot-client.js';
import { createContext, resolveTarget, unwrapMessage, extractText } from '../src/core/context.js';
import { clearGroupCache } from '../src/core/group-sync.js';
import { resetUser } from '../src/security/rate-limit.js';

let sequence = 0;
beforeEach(() => {
  clearGroupCache();
  resetUser(GROUP, sim.client.jid);
  resetUser(null, sim.client.jid);
});

function incoming({ text = '.ping', chat = GROUP, author = sim.client.jid, fromMe = false, message } = {}) {
  return {
    key: { remoteJid: chat, participant: author, fromMe, id: `WA-TEST-${++sequence}` },
    messageTimestamp: Math.floor(Date.now() / 1000),
    message: message ?? { conversation: text },
  };
}

function fixture() {
  const client = new BotClient(sim.instance);
  client.jid = sim.client.jid;
  client.status = 'open';
  const sent = [];
  let metadataCalls = 0;
  client.sock = {
    ev: new EventEmitter(),
    groupMetadata: async () => {
      metadataCalls += 1;
      return sim.client.metadata;
    },
    sendMessage: async (jid, content, options) => {
      const message = {
        key: { remoteJid: jid, fromMe: true, id: `WA-OUT-${++sequence}` },
        message: { conversation: content.text },
        messageTimestamp: Math.floor(Date.now() / 1000),
      };
      sent.push({ jid, content, options, message });
      return message;
    },
  };
  client._bindEvents(client.sock);
  // Await the actual listener, unlike EventEmitter.emit which discards promises.
  const upsert = (messages, type = 'notify') => client.sock.ev.listeners('messages.upsert')[0]({ messages, type });
  return { client, sent, upsert, metadataCalls: () => metadataCalls };
}

test('messages.upsert responde a .menu de otro usuario en un grupo', async () => {
  const { upsert, sent } = fixture();
  const who = person('WhatsAppMenu');
  await upsert([incoming({ text: '.menu', author: who.jid })]);
  assert.ok(sent.length > 0);
  assert.ok(sent.every((m) => m.jid === GROUP));
  assert.match(plain(sent.map((m) => m.content.text).join('\n')), /menu|menú|registro/i);
});

test('el teléfono vinculado puede registrarse desde un grupo (fromMe)', async () => {
  const { upsert, sent } = fixture();
  const raw = incoming({ text: '.reg Vinculado.20', fromMe: true });
  delete raw.key.participant; // En mensajes propios puede no estar presente.
  await upsert([raw]);
  assert.equal(usersRepo.get(GROUP, sim.client.jid)?.name, 'Vinculado');
  assert.ok(sent.length > 0);
  assert.equal(sent[0].jid, GROUP);
});

test('fromMe en privado conserva el autor, pero responde al chat original', async () => {
  const { client, upsert, sent } = fixture();
  const peer = person('PrivatePeer');
  const raw = incoming({ chat: peer.jid, fromMe: true });
  const ctx = await createContext({ raw, instance: sim.instance, client });
  assert.equal(ctx.author.jid, client.jid);
  assert.equal(ctx.chatJid, peer.jid);
  assert.equal(resolveTarget(ctx, 'reply'), peer.jid);
  assert.equal(resolveTarget(ctx, 'author'), client.jid);
  await upsert([raw]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].jid, peer.jid);
});

test('responde a comandos entrantes en privado y en el chat consigo mismo', async () => {
  const { upsert, sent } = fixture();
  const who = person('PrivateIncoming');
  await upsert([incoming({ chat: who.jid, author: who.jid })]);
  await upsert([incoming({ chat: sim.client.jid, fromMe: true })]);
  assert.deepEqual(sent.map((m) => m.jid), [who.jid, sim.client.jid]);
});

test('fromMe no concede permisos de owner ni del destinatario', async () => {
  const { client } = fixture();
  client.jid = person('NotOwner').jid;
  const ctx = await createContext({ raw: incoming({ fromMe: true }), instance: sim.instance, client });
  assert.equal(ctx.author.jid, client.jid);
  assert.equal(ctx.author.isAdmin, false);
  assert.equal(ctx.author.isBotOwner, false);
});

test('append reciente recibido offline se procesa una sola vez aunque llegue notify concurrente', async () => {
  const { upsert, sent } = fixture();
  const who = person('OfflineUser');
  const raw = incoming({ text: '.reg OfflineUser.19', author: who.jid });
  await Promise.all([upsert([raw], 'append'), upsert([raw], 'notify')]);
  assert.equal(sent.length, 1);
  assert.equal(usersRepo.get(GROUP, who.jid)?.name, 'OfflineUser');
});

test('append antiguo, sin fecha o con fecha inválida no ejecuta comandos', async () => {
  const { upsert, sent } = fixture();
  for (const timestamp of [Math.floor(Date.now() / 1000) - 3600, undefined, 'invalid', Math.floor(Date.now() / 1000) + 3600]) {
    const raw = incoming();
    raw.messageTimestamp = timestamp;
    await upsert([raw], 'append');
  }
  assert.equal(sent.length, 0);
});

test('no responde a estados, broadcasts, newsletters ni mensajes sin contenido', async () => {
  const { upsert, sent, metadataCalls } = fixture();
  await upsert([
    incoming({ chat: 'status@broadcast' }),
    incoming({ chat: '123@broadcast' }),
    incoming({ chat: '123@newsletter' }),
    { key: { remoteJid: GROUP } },
  ]);
  assert.equal(sent.length, 0);
  assert.equal(metadataCalls(), 0);
});

test('los mensajes propios normales y los ecos de envíos no producen bucles', async () => {
  const { client, upsert, sent } = fixture();
  await upsert([incoming({ text: 'Hola desde mi teléfono', fromMe: true })]);
  assert.equal(sent.length, 0);
  // Incluso si un envío del bot empieza por un comando, su eco no se ejecuta.
  const echo = await client.sendMessage(GROUP, { text: '.ping' });
  await upsert([echo]);
  await upsert([echo], 'append');
  assert.equal(sent.length, 1);
});

test('un lote procesa todos los comandos y omite ids duplicados', async () => {
  const { upsert, sent } = fixture();
  const who = person('BatchUser');
  const first = incoming({ author: who.jid });
  await upsert([first, first, incoming({ author: who.jid })]);
  assert.equal(sent.length, 2);
});

test('comandos en wrappers anidados y documentos con caption llegan al router', async () => {
  const { upsert, sent } = fixture();
  const who = person('WrappedUser');
  await upsert([incoming({ author: who.jid, message: {
    viewOnceMessageV2Extension: { message: {
      ephemeralMessage: { message: {
        documentWithCaptionMessage: { message: { documentMessage: { caption: '.ping' } } },
      } },
    } },
  } })]);
  assert.equal(sent.length, 1);
});

test('unwrapMessage acepta wrappers normales y no trata ediciones como comandos nuevos', () => {
  for (const wrapper of ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'documentWithCaptionMessage']) {
    assert.equal(extractText(unwrapMessage({ message: { [wrapper]: { message: { conversation: '.menu' } } } })), '.menu');
  }
  assert.equal(extractText(unwrapMessage({ message: { protocolMessage: { editedMessage: { conversation: '.ban' } } } })), '');
  assert.equal(unwrapMessage({}), null);
});

test('la caché para Baileys devuelve GroupMetadata directamente y respeta el TTL', async () => {
  const { client, metadataCalls } = fixture();
  assert.equal(client.cachedGroupMetadata(GROUP), undefined);
  const data = await client.groupMetadata(GROUP);
  assert.equal(client.cachedGroupMetadata(GROUP), data);
  assert.ok(Array.isArray(client.cachedGroupMetadata(GROUP).participants));
  assert.equal(await client.groupMetadata(GROUP), data);
  assert.equal(metadataCalls(), 1);
  client._metadataCache.get(GROUP).at = Date.now() - 60_001;
  assert.equal(client.cachedGroupMetadata(GROUP), undefined);
  await client.groupMetadata(GROUP);
  assert.equal(metadataCalls(), 2);
});

test('cambios de grupo y de participantes invalidan la caché de envío', async () => {
  const { client } = fixture();
  await client.groupMetadata(GROUP);
  await client.sock.ev.listeners('groups.update')[0]([{ id: GROUP, subject: 'Nuevo nombre' }]);
  assert.equal(client.cachedGroupMetadata(GROUP), undefined);
  await client.groupMetadata(GROUP);
  await client.sock.ev.listeners('group-participants.update')[0]({ id: GROUP, participants: [], action: 'remove' });
  assert.equal(client.cachedGroupMetadata(GROUP), undefined);
});

test('la deduplicación está acotada, caduca y separa chats', () => {
  const { client } = fixture();
  const key = { remoteJid: GROUP, id: 'same', fromMe: false };
  assert.equal(client._rememberMessage(key), true);
  assert.equal(client._rememberMessage(key), false);
  assert.equal(client._rememberMessage({ ...key, remoteJid: sim.client.jid }), true);
  for (const id of client._seenMessages.keys()) client._seenMessages.set(id, Date.now() - 600_001);
  assert.equal(client._rememberMessage(key), true);
  for (let i = 0; i < 2100; i += 1) client._rememberMessage({ ...key, id: `bounded-${i}` });
  assert.equal(client._seenMessages.size, 2000);
});
