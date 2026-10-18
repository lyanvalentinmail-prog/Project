/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · codificador PNG mínimo
 * ────────────────────────────────────────────────────────────────
 * Genera PNGs RGBA reales sin dependencias externas: cabeceras,
 * filtros 0 por scanline y compresión con el zlib integrado de Node.
 * Lo usa el motor de logos (logo-renderer.js).
 */
import zlib from 'node:zlib';

/* Tabla CRC32 (polinomio estándar PNG). */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const name = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([length, name, data, crc]);
}

/**
 * Codifica un buffer RGBA (width × height × 4 bytes) como PNG.
 * @param {number} width
 * @param {number} height
 * @param {Buffer|Uint8Array|Uint8ClampedArray} rgba
 * @returns {Buffer} archivo PNG listo para enviar
 */
export function encodePng(width, height, rgba) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('Dimensiones PNG inválidas');
  }
  if (rgba.length !== width * height * 4) throw new Error('Buffer RGBA no coincide con las dimensiones');

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profundidad: 8 bits
  ihdr[9] = 6; // color: RGBA
  ihdr[10] = 0; // compresión
  ihdr[11] = 0; // filtro
  ihdr[12] = 0; // entrelazado

  // Un byte de filtro (0 = ninguno) por línea de escaneo.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer ?? rgba, rgba.byteOffset ?? 0, rgba.length)
      .copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

export const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** ¿Este buffer empieza como un PNG? */
export function isPng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) return false;
  return PNG_SIGNATURE.every((byte, index) => buffer[index] === byte);
}

export default { encodePng, crc32, isPng, PNG_SIGNATURE };
