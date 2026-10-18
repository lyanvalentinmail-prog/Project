import test from 'node:test';
import assert from 'node:assert/strict';
import { BotClient } from '../src/core/bot-client.js';

const GROUP = '120363000000000000@g.us';
const PARENT = 'ALBUM-PARENT-KEY';

function albumPhoto(id, index) {
  return {
    key: { remoteJid: GROUP, id },
    message: {
      imageMessage: { mimetype: 'image/jpeg' },
      messageContextInfo: {
        messageAssociation: {
          associationType: 1,
          parentMessageKey: { remoteJid: GROUP, id: PARENT },
          messageIndex: index,
        },
      },
    },
  };
}

test('BotClient conserva las fotos del álbum y las devuelve en el orden de WhatsApp', () => {
  const client = new BotClient({
    id: 'sticker-album-cache-test',
    name: 'prueba',
    phone: '598000000000',
    session_dir: '/tmp/sticker-album-cache-test',
    status: 'created',
  });

  client._rememberAlbumMedia(albumPhoto('ALBUM-PHOTO-3', 2));
  client._rememberAlbumMedia(albumPhoto('ALBUM-PHOTO-1', 0));
  client._rememberAlbumMedia(albumPhoto('ALBUM-PHOTO-2', 1));

  const images = client.getAlbumImages(GROUP, PARENT);
  assert.deepEqual(images.map((image) => image.key.id), [
    'ALBUM-PHOTO-1',
    'ALBUM-PHOTO-2',
    'ALBUM-PHOTO-3',
  ]);
  assert.deepEqual(client.getAlbumImages(GROUP, 'OTHER-ALBUM'), []);
});

test('la caché de álbum ignora mensajes que no son fotos asociadas a un álbum', () => {
  const client = new BotClient({
    id: 'sticker-album-cache-filter-test',
    name: 'prueba',
    phone: '598000000001',
    session_dir: '/tmp/sticker-album-cache-filter-test',
    status: 'created',
  });
  const textMessage = albumPhoto('ALBUM-TEXT', 0);
  textMessage.message = {
    conversation: 'no es una foto',
    messageContextInfo: textMessage.message.messageContextInfo,
  };
  const unrelatedImage = albumPhoto('UNRELATED-PHOTO', 0);
  unrelatedImage.message.messageContextInfo.messageAssociation.associationType = 0;

  client._rememberAlbumMedia(textMessage);
  client._rememberAlbumMedia(unrelatedImage);
  assert.deepEqual(client.getAlbumImages(GROUP, PARENT), []);
});
