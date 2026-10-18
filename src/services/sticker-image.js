/**
 * Conversión portable de imágenes y texto a stickers WebP estáticos o animados.
 * Usa codecs WebAssembly para funcionar igual en Linux, Windows y Termux,
 * sin depender de ImageMagick ni de binarios nativos.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { simd } from 'wasm-feature-detect';

export const MAX_STICKER_INPUT_BYTES = 15 * 1024 * 1024;
export const MAX_STICKER_OUTPUT_BYTES = 100_000;
export const MAX_STICKER_IMAGE_PIXELS = 20_000_000;
export const STICKER_CANVAS_SIZE = 512;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_START = Buffer.from([0xff, 0xd8, 0xff]);
const WEBP_RIFF = Buffer.from('RIFF');
const WEBP_HEADER = Buffer.from('WEBP');
const JPEG_START_OF_FRAME = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);
const WEBP_QUALITIES = [82, 70, 58, 46, 34];
const WEBP_CONTENT_SIZES = [512, 448, 384, 320];

let codecsPromise = null;

export class StickerImageError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'StickerImageError';
    this.code = code;
  }
}

function wasmPath(specifier) {
  return fileURLToPath(import.meta.resolve(specifier));
}

async function loadCodecs() {
  if (!codecsPromise) {
    codecsPromise = (async () => {
      const [jpeg, png, webpDecoder, webpEncoder] = await Promise.all([
        import('@jsquash/jpeg/decode.js'),
        import('@jsquash/png/decode.js'),
        import('@jsquash/webp/decode.js'),
        import('@jsquash/webp/encode.js'),
      ]);
      const simdSupported = await simd().catch(() => false);
      const encoderWasmPath = simdSupported
        ? '@jsquash/webp/codec/enc/webp_enc_simd.wasm'
        : '@jsquash/webp/codec/enc/webp_enc.wasm';
      const [jpegWasm, pngWasm, webpDecoderWasm, webpEncoderWasm] = await Promise.all([
        readFile(wasmPath('@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm')),
        readFile(wasmPath('@jsquash/png/codec/pkg/squoosh_png_bg.wasm')),
        readFile(wasmPath('@jsquash/webp/codec/dec/webp_dec.wasm')),
        readFile(wasmPath(encoderWasmPath)),
      ]);

      // Emscripten intenta cargar los .wasm con fetch(file://) en Node;
      // inyectarlos como bytes evita esa diferencia entre entornos.
      await Promise.all([
        jpeg.init({ wasmBinary: jpegWasm }),
        png.init(pngWasm),
        webpDecoder.init({ wasmBinary: webpDecoderWasm }),
        webpEncoder.init({ wasmBinary: webpEncoderWasm }),
      ]);

      return {
        jpeg: jpeg.default,
        png: png.default,
        webp: webpDecoder.default,
        encodeWebp: webpEncoder.default,
      };
    })().catch((error) => {
      codecsPromise = null;
      throw error;
    });
  }
  return codecsPromise;
}

function readDimensions(buffer, format) {
  if (format === 'png') {
    if (buffer.length < 24 || buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  if (format === 'jpeg') {
    let offset = 2;
    while (offset + 4 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
      if (offset >= buffer.length) break;
      const marker = buffer[offset];
      offset += 1;

      // Estos marcadores no llevan longitud. El tamaño real suele aparecer
      // en un SOF antes del comienzo del bloque de datos comprimidos.
      if (marker === 0x00 || marker === 0x01 || marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        continue;
      }
      if (offset + 2 > buffer.length) break;
      const segmentLength = buffer.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
      if (JPEG_START_OF_FRAME.has(marker)) {
        if (segmentLength < 7) return null;
        return { height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) };
      }
      // SOS means the compressed image data starts; no SOF means malformed input.
      if (marker === 0xda) break;
      offset += segmentLength;
    }
    return null;
  }

  if (format === 'webp') {
    if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
      return null;
    }

    // Walk RIFF chunks instead of assuming optional metadata precedes the frame.
    let offset = 12;
    while (offset + 8 <= buffer.length) {
      const chunkType = buffer.toString('ascii', offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      const dataOffset = offset + 8;
      if (dataOffset + Math.min(chunkSize, 30) > buffer.length) return null;

      if (chunkType === 'VP8X' && chunkSize >= 10) {
        return {
          width: 1 + buffer.readUIntLE(dataOffset + 4, 3),
          height: 1 + buffer.readUIntLE(dataOffset + 7, 3),
        };
      }
      if (chunkType === 'VP8L' && chunkSize >= 5 && buffer[dataOffset] === 0x2f) {
        const b1 = buffer[dataOffset + 1];
        const b2 = buffer[dataOffset + 2];
        const b3 = buffer[dataOffset + 3];
        const b4 = buffer[dataOffset + 4];
        return {
          width: 1 + b1 + ((b2 & 0x3f) << 8),
          height: 1 + ((b2 & 0xc0) >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10),
        };
      }
      if (chunkType === 'VP8 ' && chunkSize >= 10 && buffer[dataOffset + 3] === 0x9d && buffer[dataOffset + 4] === 0x01 && buffer[dataOffset + 5] === 0x2a) {
        return {
          width: buffer.readUInt16LE(dataOffset + 6) & 0x3fff,
          height: buffer.readUInt16LE(dataOffset + 8) & 0x3fff,
        };
      }

      if (chunkSize > buffer.length - dataOffset) return null;
      offset = dataOffset + chunkSize + (chunkSize % 2);
    }
  }

  return null;
}

function detectFormat(buffer) {
  if (buffer.length >= PNG_SIGNATURE.length && buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return 'png';
  if (buffer.length >= JPEG_START.length && buffer.subarray(0, JPEG_START.length).equals(JPEG_START)) return 'jpeg';
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).equals(WEBP_RIFF) &&
    buffer.subarray(8, 12).equals(WEBP_HEADER)
  ) return 'webp';
  return null;
}

function validateDimensions(dimensions) {
  const { width, height } = dimensions ?? {};
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new StickerImageError('INVALID_IMAGE', 'No pude leer las dimensiones de la imagen.');
  }
  if (width * height > MAX_STICKER_IMAGE_PIXELS) {
    throw new StickerImageError('IMAGE_TOO_LARGE', 'La imagen tiene demasiados píxeles para convertirla de forma segura.');
  }
}

function asArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

/** Redimensiona con interpolación bilineal y coloca la imagen en un lienzo 512×512. */
function containImageData(image, contentSize) {
  const canvasSize = STICKER_CANVAS_SIZE;
  const { width, height, data } = image;
  let ratio = Math.min(contentSize / width, contentSize / height);
  // En los reintentos de compresión se reduce el contenido, no el lienzo:
  // WhatsApp recibe siempre un sticker de exactamente 512×512 píxeles.
  if (contentSize < canvasSize) ratio = Math.min(ratio, 1);
  const targetWidth = Math.max(1, Math.min(contentSize, Math.round(width * ratio)));
  const targetHeight = Math.max(1, Math.min(contentSize, Math.round(height * ratio)));
  const left = Math.floor((canvasSize - targetWidth) / 2);
  const top = Math.floor((canvasSize - targetHeight) / 2);
  const output = new Uint8ClampedArray(canvasSize * canvasSize * 4);
  const scaleX = width / targetWidth;
  const scaleY = height / targetHeight;

  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.max(0, Math.min(height - 1, (y + 0.5) * scaleY - 0.5));
    const y0 = Math.floor(sourceY);
    const y1 = Math.min(height - 1, y0 + 1);
    const fy = sourceY - y0;
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.max(0, Math.min(width - 1, (x + 0.5) * scaleX - 0.5));
      const x0 = Math.floor(sourceX);
      const x1 = Math.min(width - 1, x0 + 1);
      const fx = sourceX - x0;
      const weights = [
        (1 - fx) * (1 - fy),
        fx * (1 - fy),
        (1 - fx) * fy,
        fx * fy,
      ];
      const indexes = [
        (y0 * width + x0) * 4,
        (y0 * width + x1) * 4,
        (y1 * width + x0) * 4,
        (y1 * width + x1) * 4,
      ];
      let alpha = 0;
      let red = 0;
      let green = 0;
      let blue = 0;
      for (let sample = 0; sample < 4; sample += 1) {
        const a = data[indexes[sample] + 3] / 255;
        const weight = weights[sample];
        alpha += a * weight;
        red += data[indexes[sample]] * a * weight;
        green += data[indexes[sample] + 1] * a * weight;
        blue += data[indexes[sample] + 2] * a * weight;
      }
      const destination = ((top + y) * canvasSize + left + x) * 4;
      if (alpha > 0) {
        output[destination] = red / alpha;
        output[destination + 1] = green / alpha;
        output[destination + 2] = blue / alpha;
      }
      output[destination + 3] = alpha * 255;
    }
  }

  return { data: output, width: canvasSize, height: canvasSize };
}

function stickerExif({ pack = '', author = '' } = {}) {
  const packId = createHash('sha256')
    .update(`${String(pack).trim()}\u0000${String(author).trim()}`)
    .digest('hex')
    .slice(0, 32);
  const data = JSON.stringify({
    'sticker-pack-id': `com.versova.stickers.${packId}`,
    'sticker-pack-name': String(pack).slice(0, 60),
    'sticker-pack-publisher': String(author).slice(0, 60),
    emojis: [],
  });
  const json = Buffer.from(data, 'utf8');
  const header = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41,
    0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
  ]);
  header.writeUInt32LE(json.length, 14);
  return Buffer.concat([header, json]);
}

async function attachStickerMetadata(webpBuffer, metadata) {
  if (!metadata.pack && !metadata.author) return webpBuffer;
  const { default: webpmux } = await import('node-webpmux');
  const image = new webpmux.Image();
  await image.load(webpBuffer);
  image.exif = stickerExif(metadata);
  return image.save(null);
}

function normalizeStickerMetadata(metadata = {}) {
  return {
    pack: String(metadata.pack ?? '').trim().slice(0, 60),
    author: String(metadata.author ?? '').trim().slice(0, 60),
  };
}

async function encodeImageDataToSticker(decoded, metadata, codecs) {
  validateDimensions(decoded);
  if (!decoded.data || decoded.data.length !== decoded.width * decoded.height * 4) {
    throw new StickerImageError('INVALID_IMAGE', 'La imagen está dañada o no se pudo leer.');
  }

  for (const size of WEBP_CONTENT_SIZES) {
    const imageData = containImageData(decoded, size);
    for (const quality of WEBP_QUALITIES) {
      let encoded;
      try {
        encoded = Buffer.from(await codecs.encodeWebp(imageData, { quality, method: 4, alpha_quality: 90 }));
        encoded = await attachStickerMetadata(encoded, metadata);
      } catch {
        throw new StickerImageError('ENCODE_FAILED', 'No se pudo convertir la imagen a WebP.');
      }
      if (encoded.length <= MAX_STICKER_OUTPUT_BYTES) return encoded;
    }
  }

  throw new StickerImageError(
    'OUTPUT_TOO_LARGE',
    `La imagen no se pudo comprimir por debajo de ${MAX_STICKER_OUTPUT_BYTES / 1000} KB.`,
  );
}

/** Convierte píxeles RGBA en un sticker WebP estático de 512×512. */
export async function imageDataToSticker(imageData, metadata = {}) {
  const decoded = {
    width: Number(imageData?.width),
    height: Number(imageData?.height),
    data: imageData?.data,
  };
  validateDimensions(decoded);
  if (!decoded.data || decoded.data.length !== decoded.width * decoded.height * 4) {
    throw new StickerImageError('INVALID_IMAGE', 'Los píxeles de la imagen no son válidos.');
  }
  const codecs = await loadCodecs();
  return encodeImageDataToSticker(decoded, normalizeStickerMetadata(metadata), codecs);
}

/**
 * Convierte JPEG, PNG o WebP en un WebP estático de 512×512, con
 * transparencia y tamaño apropiado para un sticker de WhatsApp.
 */
export async function imageToSticker(input, metadata = {}) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input ?? []);
  if (!buffer.length) throw new StickerImageError('INVALID_IMAGE', 'La imagen está vacía.');
  if (buffer.length > MAX_STICKER_INPUT_BYTES) {
    throw new StickerImageError('INPUT_TOO_LARGE', 'La imagen supera el límite de 15 MB.');
  }

  const format = detectFormat(buffer);
  if (!format) {
    throw new StickerImageError('UNSUPPORTED_IMAGE', 'Formato no compatible. Envía una imagen JPG, PNG o WebP.');
  }
  validateDimensions(readDimensions(buffer, format));

  const codecs = await loadCodecs();
  let decoded;
  try {
    const inputData = asArrayBuffer(buffer);
    decoded = format === 'jpeg'
      ? await codecs.jpeg(inputData, { preserveOrientation: true })
      : await codecs[format](inputData);
  } catch {
    throw new StickerImageError('INVALID_IMAGE', 'La imagen está dañada o no se pudo leer.');
  }
  validateDimensions(decoded);
  return encodeImageDataToSticker(decoded, normalizeStickerMetadata(metadata), codecs);
}

const FONT_5X7 = Object.freeze({
  A: '01110/10001/10001/11111/10001/10001/10001',
  B: '11110/10001/10001/11110/10001/10001/11110',
  C: '01111/10000/10000/10000/10000/10000/01111',
  D: '11110/10001/10001/10001/10001/10001/11110',
  E: '11111/10000/10000/11110/10000/10000/11111',
  F: '11111/10000/10000/11110/10000/10000/10000',
  G: '01111/10000/10000/10111/10001/10001/01111',
  H: '10001/10001/10001/11111/10001/10001/10001',
  I: '11111/00100/00100/00100/00100/00100/11111',
  J: '00111/00010/00010/00010/10010/10010/01100',
  K: '10001/10010/10100/11000/10100/10010/10001',
  L: '10000/10000/10000/10000/10000/10000/11111',
  M: '10001/11011/10101/10101/10001/10001/10001',
  N: '10001/11001/10101/10011/10001/10001/10001',
  O: '01110/10001/10001/10001/10001/10001/01110',
  P: '11110/10001/10001/11110/10000/10000/10000',
  Q: '01110/10001/10001/10001/10101/10010/01101',
  R: '11110/10001/10001/11110/10100/10010/10001',
  S: '01111/10000/10000/01110/00001/00001/11110',
  T: '11111/00100/00100/00100/00100/00100/00100',
  U: '10001/10001/10001/10001/10001/10001/01110',
  V: '10001/10001/10001/10001/01010/01010/00100',
  W: '10001/10001/10001/10101/10101/10101/01010',
  X: '10001/01010/00100/00100/00100/01010/10001',
  Y: '10001/01010/00100/00100/00100/00100/00100',
  Z: '11111/00001/00010/00100/01000/10000/11111',
  0: '01110/10001/10011/10101/11001/10001/01110',
  1: '00100/01100/00100/00100/00100/00100/01110',
  2: '01110/10001/00001/00010/00100/01000/11111',
  3: '11110/00001/00001/01110/00001/00001/11110',
  4: '00010/00110/01010/10010/11111/00010/00010',
  5: '11111/10000/10000/11110/00001/00001/11110',
  6: '01110/10000/10000/11110/10001/10001/01110',
  7: '11111/00001/00010/00100/01000/01000/01000',
  8: '01110/10001/10001/01110/10001/10001/01110',
  9: '01110/10001/10001/01111/00001/00001/01110',
  '?': '01110/10001/00001/00010/00100/00000/00100',
  '.': '00000/00000/00000/00000/00000/00110/00110',
  ',': '00000/00000/00000/00000/00110/00110/00100',
  '!': '00100/00100/00100/00100/00100/00000/00100',
  ':': '00000/00110/00110/00000/00110/00110/00000',
  ';': '00000/00110/00110/00000/00110/00110/00100',
  '-': '00000/00000/00000/11111/00000/00000/00000',
  '_': '00000/00000/00000/00000/00000/00000/11111',
  '+': '00000/00100/00100/11111/00100/00100/00000',
  '/': '00001/00010/00010/00100/01000/01000/10000',
  '\\': '10000/01000/01000/00100/00010/00010/00001',
  '(': '00010/00100/01000/01000/01000/00100/00010',
  ')': '01000/00100/00010/00010/00010/00100/01000',
  '[': '01110/01000/01000/01000/01000/01000/01110',
  ']': '01110/00010/00010/00010/00010/00010/01110',
  '=': '00000/11111/00000/11111/00000/00000/00000',
  "'": '00100/00100/00010/00000/00000/00000/00000',
  '"': '01010/01010/00100/00000/00000/00000/00000',
  '#': '01010/11111/01010/01010/11111/01010/00000',
  '%': '11001/11010/00100/01000/10110/00110/00000',
  '&': '01100/10010/10100/01000/10101/10010/01101',
  '*': '00000/10101/01110/11111/01110/10101/00000',
  '<': '00010/00100/01000/10000/01000/00100/00010',
  '>': '01000/00100/00010/00001/00010/00100/01000',
  '@': '01110/10001/10111/10101/10111/10000/01110',
  ' ': '00000/00000/00000/00000/00000/00000/00000',
});

function normalizeStickerText(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[‘’]/gu, "'")
    .replace(/[“”]/gu, '"')
    .replace(/[–—]/gu, '-')
    .split(/\r?\n/u)
    .map((line) => line.replace(/[^\x20-\x7e]/gu, '?').replace(/[ \t]+/gu, ' ').trim().toUpperCase())
    .filter(Boolean)
    .join('\n');
}

function wrapStickerText(text, maxChars) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    const words = paragraph.split(/\s+/u).filter(Boolean);
    for (const word of words) {
      for (let offset = 0; offset < word.length; offset += maxChars) {
        const chunk = word.slice(offset, offset + maxChars);
        if (!line) {
          line = chunk;
        } else if (`${line} ${chunk}`.length <= maxChars) {
          line += ` ${chunk}`;
        } else {
          lines.push(line);
          line = chunk;
        }
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function textLayout(text) {
  const maxWidth = STICKER_CANVAS_SIZE - 64;
  const maxHeight = STICKER_CANVAS_SIZE - 96;
  for (let scale = 16; scale >= 3; scale -= 1) {
    const maxChars = Math.max(1, Math.floor(maxWidth / (6 * scale)));
    const lines = wrapStickerText(text, maxChars);
    if (!lines.length) continue;
    const width = Math.max(...lines.map((line) => line.length * 6 - 1)) * scale;
    const height = (lines.length * 9 - 2) * scale;
    if (width <= maxWidth && height <= maxHeight) return { lines, scale, width, height };
  }
  throw new StickerImageError('TEXT_TOO_LONG', 'El texto es demasiado largo para convertirlo en un sticker.');
}

function renderTextMask(layout) {
  const size = STICKER_CANVAS_SIZE;
  const mask = new Uint8Array(size * size);
  const { lines, scale, width, height } = layout;
  const left = Math.floor((size - width) / 2);
  const top = Math.floor((size - height) / 2);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    for (let charIndex = 0; charIndex < line.length; charIndex += 1) {
      const glyph = (FONT_5X7[line[charIndex]] ?? FONT_5X7['?']).split('/');
      for (let row = 0; row < 7; row += 1) {
        for (let column = 0; column < 5; column += 1) {
          if (glyph[row][column] !== '1') continue;
          const x = left + (charIndex * 6 + column) * scale;
          const y = top + (lineIndex * 9 + row) * scale;
          for (let dy = 0; dy < scale; dy += 1) {
            const offset = (y + dy) * size + x;
            mask.fill(1, offset, offset + scale);
          }
        }
      }
    }
  }
  return mask;
}

function dilateMask(mask, radius) {
  const size = STICKER_CANVAS_SIZE;
  const expanded = new Uint8Array(mask.length);
  const radiusSquared = radius * radius;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!mask[y * size + x]) continue;
      for (let dy = -radius; dy <= radius; dy += 1) {
        const targetY = y + dy;
        if (targetY < 0 || targetY >= size) continue;
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx * dx + dy * dy > radiusSquared) continue;
          const targetX = x + dx;
          if (targetX >= 0 && targetX < size) expanded[targetY * size + targetX] = 1;
        }
      }
    }
  }
  return expanded;
}

function paintMask(imageData, mask, color) {
  const pixels = imageData.data;
  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index]) continue;
    const offset = index * 4;
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
    pixels[offset + 3] = color[3];
  }
}

function renderTextImage(text, style, phase = 0) {
  const normalized = normalizeStickerText(text);
  if (!normalized) throw new StickerImageError('TEXT_EMPTY', 'Escribe el texto que quieres convertir en sticker.');
  const size = STICKER_CANVAS_SIZE;
  const imageData = { width: size, height: size, data: new Uint8ClampedArray(size * size * 4) };
  const mask = renderTextMask(textLayout(normalized));

  if (style === 'brat') {
    const pixels = imageData.data;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      pixels[offset] = 138;
      pixels[offset + 1] = 206;
      pixels[offset + 2] = 0;
      pixels[offset + 3] = 255;
    }
    paintMask(imageData, mask, [0, 0, 0, 255]);
    return imageData;
  }

  if (style === 'attp') {
    const palette = [
      [255, 65, 145, 255],
      [255, 194, 61, 255],
      [57, 204, 255, 255],
      [181, 111, 255, 255],
    ];
    paintMask(imageData, dilateMask(mask, 6), [18, 18, 22, 255]);
    paintMask(imageData, dilateMask(mask, 3), [255, 255, 255, 255]);
    paintMask(imageData, mask, palette[phase % palette.length]);
    return imageData;
  }

  paintMask(imageData, dilateMask(mask, 5), [18, 18, 22, 255]);
  paintMask(imageData, mask, [255, 255, 255, 255]);
  return imageData;
}

async function animatedTextToSticker(text, metadata) {
  const { default: webpmux } = await import('node-webpmux');
  const frames = [];
  const frameCount = 4;
  for (let index = 0; index < frameCount; index += 1) {
    const frameData = renderTextImage(text, 'attp', index);
    const webpBuffer = await imageDataToSticker(frameData);
    frames.push(await webpmux.Image.generateFrame({
      buffer: webpBuffer,
      delay: 180,
      blend: false,
      dispose: true,
    }));
  }

  let animation;
  try {
    animation = await webpmux.Image.save(null, {
      width: STICKER_CANVAS_SIZE,
      height: STICKER_CANVAS_SIZE,
      bgColor: [0, 0, 0, 0],
      loops: 0,
      frames,
    });
    const image = new webpmux.Image();
    await image.load(animation);
    const stickerMetadata = normalizeStickerMetadata(metadata);
    if (stickerMetadata.pack || stickerMetadata.author) image.exif = stickerExif(stickerMetadata);
    animation = await image.save(null);
  } catch {
    throw new StickerImageError('ANIMATION_FAILED', 'No se pudo crear el sticker animado.');
  }
  if (animation.length > 500_000) {
    throw new StickerImageError('OUTPUT_TOO_LARGE', 'El sticker animado supera el límite de 500 KB.');
  }
  return animation;
}

/** Renderiza texto como sticker brat, TTP o ATTp (animado). */
export async function textToSticker(text, style = 'ttp', metadata = {}) {
  if (!['brat', 'ttp', 'attp'].includes(style)) {
    throw new StickerImageError('INVALID_STYLE', 'El estilo de sticker de texto no es válido.');
  }
  if (!normalizeStickerText(text)) {
    throw new StickerImageError('TEXT_EMPTY', 'Escribe el texto que quieres convertir en sticker.');
  }
  if (style === 'attp') return animatedTextToSticker(text, metadata);
  return imageDataToSticker(renderTextImage(text, style), metadata);
}
