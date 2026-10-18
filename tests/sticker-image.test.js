import test from 'node:test';
import assert from 'node:assert/strict';
import WebP from 'node-webpmux';
import {
  imageToSticker,
  textToSticker,
  MAX_STICKER_OUTPUT_BYTES,
  StickerImageError,
} from '../src/services/sticker-image.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/wp8AAAAASUVORK5CYII=',
  'base64',
);
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAYGBgYHBgcICAcKCwoLCg8ODAwODxYQERAREBYiFRkVFRkVIh4kHhweJB42KiYmKjY+NDI0PkxERExfWl98fKcBBgYGBgcGBwgIBwoLCgsKDw4MDA4PFhAREBEQFiIVGRUVGRUiHiQeHB4kHjYqJiYqNj40MjQ+TERETF9aX3x8p//CABEIAAEAAQMBIQACEQEDEQH/xAAoAAEBAAAAAAAAAAAAAAAAAAAABgEBAQAAAAAAAAAAAAAAAAAABgj/2gAMAwEAAhADEAAAAJYCpf8A/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPwB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwB//9k=',
  'base64',
);

async function decodeWebp(buffer) {
  const image = new WebP.Image();
  await image.load(buffer);
  return image;
}

test('la conversión produce un sticker WebP cuadrado y dentro del límite de WhatsApp', async () => {
  const sticker = await imageToSticker(PNG);
  const image = await decodeWebp(sticker);

  assert.equal(image.width, 512);
  assert.equal(image.height, 512);
  assert.ok(sticker.length <= MAX_STICKER_OUTPUT_BYTES, `pesa ${sticker.length} bytes`);
  assert.equal(sticker.toString('ascii', 0, 4), 'RIFF');
  assert.equal(sticker.toString('ascii', 8, 12), 'WEBP');
});

test('decodifica JPEG y WebP además de PNG', async () => {
  const jpegSticker = await imageToSticker(JPEG);
  assert.equal((await decodeWebp(jpegSticker)).width, 512);

  const webpInput = await imageToSticker(PNG);
  const webpSticker = await imageToSticker(webpInput);
  assert.equal((await decodeWebp(webpSticker)).height, 512);
});

test('la conversión puede incrustar los metadatos de pack y autor', async () => {
  const sticker = await imageToSticker(PNG, { pack: 'Mi pack', author: 'VÉRSOVA' });
  const image = await decodeWebp(sticker);
  const exif = image.exif.toString('utf8');
  const metadata = JSON.parse(exif.slice(exif.indexOf('{'), exif.lastIndexOf('}') + 1));

  assert.equal(metadata['sticker-pack-name'], 'Mi pack');
  assert.equal(metadata['sticker-pack-publisher'], 'VÉRSOVA');
  assert.ok(metadata['sticker-pack-id']);
});

test('rechaza formatos que no son JPEG, PNG o WebP', async () => {
  await assert.rejects(
    imageToSticker(Buffer.from('no es una imagen')),
    (error) => error instanceof StickerImageError && error.code === 'UNSUPPORTED_IMAGE',
  );
});

test('rechaza imágenes con dimensiones excesivas antes de decodificarlas', async () => {
  const oversized = Buffer.from(PNG);
  oversized.writeUInt32BE(100_000, 16);
  oversized.writeUInt32BE(100_000, 20);

  await assert.rejects(
    imageToSticker(oversized),
    (error) => error instanceof StickerImageError && error.code === 'IMAGE_TOO_LARGE',
  );
});

test('brat y ttp renderizan stickers WebP estáticos con metadatos', async () => {
  for (const style of ['brat', 'ttp']) {
    const sticker = await textToSticker('Hola, VÉRSOVA!', style, { pack: 'Texto', author: 'Bot' });
    const image = await decodeWebp(sticker);
    const exif = image.exif.toString('utf8');
    const metadata = JSON.parse(exif.slice(exif.indexOf('{'), exif.lastIndexOf('}') + 1));

    assert.equal(image.width, 512);
    assert.equal(image.height, 512);
    assert.equal(image.hasAnim, false);
    assert.equal(metadata['sticker-pack-name'], 'Texto');
    assert.equal(metadata['sticker-pack-publisher'], 'Bot');
  }
});

test('attp renderiza un WebP animado de cuatro frames', async () => {
  const sticker = await textToSticker('Hola mundo', 'attp', { pack: 'Texto animado', author: 'Bot' });
  const image = await decodeWebp(sticker);
  const exif = image.exif.toString('utf8');
  const metadata = JSON.parse(exif.slice(exif.indexOf('{'), exif.lastIndexOf('}') + 1));

  assert.equal(image.width, 512);
  assert.equal(image.height, 512);
  assert.equal(image.hasAnim, true);
  assert.equal(image.frames.length, 4);
  assert.equal(metadata['sticker-pack-name'], 'Texto animado');
});
