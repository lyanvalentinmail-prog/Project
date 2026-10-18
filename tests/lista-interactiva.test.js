/**
 * 𓆩 ☕ 𓆪  Tests · menú en lista interactiva
 * ────────────────────────────────────────────────────────────────
 * Regresiones de «la lista interactiva no funciona»:
 *  1. al tocar una fila WhatsApp manda un interactiveResponseMessage
 *     (sin texto) → antes se ignoraba y no pasaba nada;
 *  2. sin el nodo <biz> WhatsApp no renderiza el native flow.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { sim } from './_harness.js';
import { BotClient, buildListContent, interactiveNodes } from '../src/core/bot-client.js';
import { extractText, extractInteractiveId, unwrapMessage } from '../src/core/context.js';
import { buildListPayload } from '../src/services/menu.service.js';

test('la selección de una fila (native flow) se lee como comando', () => {
  const m = {
    interactiveResponseMessage: {
      body: { text: '🎮 Juegos' },
      nativeFlowResponseMessage: { name: 'single_select', paramsJson: JSON.stringify({ id: '.menu juegos' }), version: 3 },
    },
  };
  assert.equal(extractInteractiveId(m), '.menu juegos');
  assert.equal(extractText(m), '.menu juegos');
});

test('respuestas de listas y botones antiguos también se leen', () => {
  assert.equal(extractText({ listResponseMessage: { title: 'Info', singleSelectReply: { selectedRowId: '#menu info' } } }), '#menu info');
  assert.equal(extractText({ buttonsResponseMessage: { selectedButtonId: '.help' } }), '.help');
  assert.equal(extractText({ templateButtonReplyMessage: { selectedId: '.ping' } }), '.ping');
  // envuelto en viewOnce / ephemeral
  const wrapped = unwrapMessage({ message: { ephemeralMessage: { message: { listResponseMessage: { singleSelectReply: { selectedRowId: '.menu' } } } } } });
  assert.equal(extractText(wrapped), '.menu');
  // paramsJson roto: no lanza
  assert.equal(extractText({ interactiveResponseMessage: { nativeFlowResponseMessage: { paramsJson: '{oops' }, body: { text: 'x' } } }), 'x');
  // el texto normal sigue teniendo prioridad
  assert.equal(extractText({ conversation: '.ping' }), '.ping');
});

test('el mensaje de lista lleva deviceListMetadata y los nodos <biz>', () => {
  const content = buildListContent({ title: 'T', body: 'B', footer: 'F', buttonText: 'Ver' }, [{ title: 'S', rows: [{ id: '.menu', title: 'Menu' }] }]);
  const inner = content.viewOnceMessage.message;
  assert.equal(inner.messageContextInfo.deviceListMetadataVersion, 2);
  const button = inner.interactiveMessage.nativeFlowMessage.buttons[0];
  assert.equal(button.name, 'single_select');
  assert.equal(JSON.parse(button.buttonParamsJson).sections[0].rows[0].id, '.menu');

  const groupNodes = interactiveNodes('123@g.us');
  assert.equal(groupNodes[0].tag, 'biz');
  assert.equal(groupNodes[0].content[0].attrs.type, 'native_flow');
  assert.equal(groupNodes.length, 1);
  const privateNodes = interactiveNodes('5215500000000@s.whatsapp.net');
  assert.deepEqual(privateNodes.map((n) => n.tag), ['biz', 'bot']);
});

test('sendList usa relayMessage con los nodos extra y respeta la conexión', async () => {
  const client = new BotClient(sim.instance);
  client.jid = sim.client.jid;
  client.status = 'open';
  const relayed = [];
  client.sock = { relayMessage: async (jid, message, opts) => { relayed.push({ jid, message, opts }); } };
  const list = buildListPayload({ prefix: '.', name: 'Bot', team: 'Team', status: 'on', version: '1', categories: [{ meta: { id: 'info', icon: 'ℹ', title: 'Info' }, commands: [1, 2] }] });
  const sent = await client.sendList('123@g.us', list);
  assert.ok(sent);
  assert.equal(relayed.length, 1);
  assert.equal(relayed[0].opts.additionalNodes[0].tag, 'biz');
  const rows = JSON.parse(relayed[0].message.viewOnceMessage.message.interactiveMessage.nativeFlowMessage.buttons[0].buttonParamsJson).sections[0].rows;
  assert.deepEqual(rows.map((r) => r.id), ['.help', '.menu info']);

  client.status = 'close';
  assert.equal(await client.sendList('123@g.us', list), null);
});
