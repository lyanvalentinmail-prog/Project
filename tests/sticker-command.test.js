import test from 'node:test';
import assert from 'node:assert/strict';
import WebP from 'node-webpmux';
import { createContext } from '../src/core/context.js';
import { handleCommandMessage } from '../src/core/router.js';
import { resetUser } from '../src/security/rate-limit.js';
import { sim, GROUP, person } from './_harness.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/wp8AAAAASUVORK5CYII=',
  'base64',
);
let messageCounter = 0;

async function dispatchIncoming(jid, message) {
  const before = sim.client.sent.length;
  const raw = {
    key: {
      remoteJid: GROUP,
      fromMe: false,
      id: `STICKER-TEST-${++messageCounter}`,
    },
    participant: jid,
    pushName: sim.client.contactName(jid) ?? 'Pegatina',
    messageTimestamp: Math.floor(Date.now() / 1000),
    message,
  };
  resetUser(GROUP, jid);
  const ctx = await createContext({ raw, instance: sim.instance, client: sim.client });
  await handleCommandMessage(ctx);
  return { raw, sent: sim.client.sent.slice(before) };
}

function sentSticker(messages) {
  const entry = messages.find((message) => message.content?.sticker);
  assert.ok(entry, 'el comando debe enviar un mensaje de tipo sticker');
  assert.equal(entry.content.sticker.toString('ascii', 0, 4), 'RIFF');
  assert.equal(entry.content.sticker.toString('ascii', 8, 12), 'WEBP');
  return entry.content.sticker;
}

test('una imagen con .s o cualquiera de sus alias en el caption se convierte y se envía', async () => {
  const who = person('Sticker caption');
  const client = sim.client;
  const previousDownload = client.downloadMediaBuffer;
  const downloaded = [];
  client.downloadMediaBuffer = async (message, options) => {
    downloaded.push({ message, options });
    return PNG;
  };

  try {
    for (const alias of ['s', 'sticker', 'stiker', 'wm']) {
      const { raw, sent } = await dispatchIncoming(who.jid, {
        imageMessage: {
          caption: `.${alias}`,
          mimetype: 'image/png',
          fileLength: PNG.length,
          url: 'https://media.example.test/image',
        },
      });
      assert.ok(sent.some((message) => /sticker/i.test(message.content?.text ?? '')));
      sentSticker(sent);
      assert.equal(downloaded.at(-1).message, raw, 'descarga el mensaje de imagen actual');
      assert.ok(downloaded.at(-1).options.maxBytes > PNG.length);
    }
  } finally {
    if (previousDownload === undefined) delete client.downloadMediaBuffer;
    else client.downloadMediaBuffer = previousDownload;
  }
});

test('responder con .sticker a una imagen citada descarga la cita y envía el WebP', async () => {
  const who = person('Sticker reply');
  const client = sim.client;
  const previousDownload = client.downloadMediaBuffer;
  let downloaded = null;
  client.downloadMediaBuffer = async (message) => {
    downloaded = message;
    return PNG;
  };

  try {
    const quotedId = 'QUOTED-IMAGE-STICKER-TEST';
    const { sent } = await dispatchIncoming(who.jid, {
      extendedTextMessage: {
        text: '.sticker',
        contextInfo: {
          stanzaId: quotedId,
          participant: who.jid,
          quotedMessage: {
            imageMessage: {
              mimetype: 'image/png',
              fileLength: PNG.length,
              url: 'https://media.example.test/quoted-image',
            },
          },
        },
      },
    });

    assert.equal(downloaded?.key?.id, quotedId, 'usa el id de la imagen citada para descargarla');
    assert.equal(downloaded?.key?.remoteJid, GROUP);
    assert.ok(downloaded?.message?.imageMessage, 'entrega a Baileys el mensaje de imagen citado');
    sentSticker(sent);
  } finally {
    if (previousDownload === undefined) delete client.downloadMediaBuffer;
    else client.downloadMediaBuffer = previousDownload;
  }
});

test('.brat y su alias .bratv envían stickers reales', async () => {
  const who = person('Brat sticker');
  for (const command of ['brat', 'bratv']) {
    const { sent } = await dispatchIncoming(who.jid, {
      extendedTextMessage: { text: `.${command} hola mundo` },
    });
    sentSticker(sent);
  }
});

test('.ttp envía sticker estático y .attp envía WebP animado', async () => {
  const who = person('Text sticker');
  const ttpResult = await dispatchIncoming(who.jid, {
    extendedTextMessage: { text: '.ttp buenas noches' },
  });
  const ttpSticker = sentSticker(ttpResult.sent);
  const staticImage = new WebP.Image();
  await staticImage.load(ttpSticker);
  assert.equal(staticImage.hasAnim, false);

  const attpResult = await dispatchIncoming(who.jid, {
    extendedTextMessage: { text: '.attp buen día' },
  });
  const attpSticker = sentSticker(attpResult.sent);
  const animatedImage = new WebP.Image();
  await animatedImage.load(attpSticker);
  assert.equal(animatedImage.hasAnim, true);
  assert.equal(animatedImage.frames.length, 4);
  assert.equal(attpResult.sent.find((message) => message.content?.sticker)?.content?.isAnimated, true);
});

test('.spack convierte en pack las fotos del álbum citado y usa el nombre del bot como autor', async () => {
  const who = person('Pack sticker');
  const client = sim.client;
  const previousDownload = client.downloadMediaBuffer;
  const previousAlbumLookup = client.getAlbumImages;
  const albumId = 'STICKER-ALBUM-PARENT';
  const albumImages = [
    { key: { remoteJid: GROUP, id: 'STICKER-ALBUM-2' }, message: { imageMessage: { mimetype: 'image/png', fileLength: PNG.length, url: 'album-2' } } },
    { key: { remoteJid: GROUP, id: 'STICKER-ALBUM-1' }, message: { imageMessage: { mimetype: 'image/png', fileLength: PNG.length, url: 'album-1' } } },
  ];
  const downloadedIds = [];
  client.getAlbumImages = (chatJid, parentId) => {
    assert.equal(chatJid, GROUP);
    assert.equal(parentId, albumId);
    return albumImages;
  };
  client.downloadMediaBuffer = async (message) => {
    downloadedIds.push(message.key.id);
    return PNG;
  };

  try {
    const { sent } = await dispatchIncoming(who.jid, {
      extendedTextMessage: {
        text: '.spack Viaje',
        contextInfo: {
          stanzaId: 'STICKER-ALBUM-2',
          participant: who.jid,
          quotedMessage: {
            imageMessage: {
              mimetype: 'image/png',
              fileLength: PNG.length,
              url: 'album-2',
            },
            messageContextInfo: {
              messageAssociation: {
                associationType: 1,
                parentMessageKey: { remoteJid: GROUP, id: albumId },
                messageIndex: 1,
              },
            },
          },
        },
      },
    });

    const stickers = sent.filter((message) => message.content?.sticker);
    assert.equal(stickers.length, 2);
    assert.equal(downloadedIds.length, 2);
    const botName = sim.client.pushName;
    for (const entry of stickers) {
      const image = new WebP.Image();
      await image.load(entry.content.sticker);
      const exif = image.exif.toString('utf8');
      const metadata = JSON.parse(exif.slice(exif.indexOf('{'), exif.lastIndexOf('}') + 1));
      assert.equal(metadata['sticker-pack-name'], 'Viaje');
      assert.equal(metadata['sticker-pack-publisher'], botName);
    }
  } finally {
    if (previousDownload === undefined) delete client.downloadMediaBuffer;
    else client.downloadMediaBuffer = previousDownload;
    if (previousAlbumLookup === undefined) delete client.getAlbumImages;
    else client.getAlbumImages = previousAlbumLookup;
  }
});
