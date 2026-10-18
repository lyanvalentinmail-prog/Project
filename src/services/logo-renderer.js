/**
 * 𓆩 🍰 𓆪  VÉRSOVA · motor de logos por software
 * ────────────────────────────────────────────────────────────────
 * Genera imágenes PNG reales para los 25 comandos `.logo*`
 * SIN dependencias externas y SIN internet: rasterizador propio
 * (gradientes, brillo neón, extrusión 3D, glitch, reflejos,
 * patrones y decoraciones) más una fuente pixel de 5×7.
 *
 * Salida: Buffer PNG (utils/png.js) listo para enviar por WhatsApp.
 */
import { encodePng } from '../utils/png.js';

/* ── fuente pixel 5×7 (mayúsculas, dígitos y signos) ─────────── */

const GLYPHS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '#####'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['#####', '...#.', '..#..', '..##.', '....#', '#...#', '.###.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '..#..', '..#..', '..#..'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '..##.', '..##.', '..#..'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '..##.', '..##.', '..#..'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.#.#.', '.....', '.....', '.....', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '*': ['.....', '..#..', '.#.#.', '..#..', '.#.#.', '..#..', '.....'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '\\': ['#....', '.#...', '.#...', '..#..', '...#.', '...#.', '....#'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.###.'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '.#.##', '#..##'],
  '~': ['.....', '.....', '.##.#', '#..#.', '.....', '.....', '.....'],
  '|': ['..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '$': ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '¡': ['..#..', '.....', '..#..', '..#..', '..#..', '..#..', '..#..'],
  '¿': ['..#..', '.....', '..#..', '.##..', '.#...', '#...#', '.###.'],
  '♥': ['.#.#.', '#####', '#####', '#####', '.###.', '..#..', '.....'],
  '★': ['..#..', '..#..', '.###.', '#####', '.###.', '.#.#.', '.....'],
};

const ACCENTS = { Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', Ü: 'U', Ñ: 'N', Ç: 'C' };
const normalizeGlyph = (ch) => GLYPHS[ch] ? ch : (ACCENTS[ch] ?? '?');

/* ── utilidades numéricas ────────────────────────────────────── */

export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;

/** Color interpolado entre paradas [[t, [r,g,b]], …] con t∈[0,1]. */
export function gradientColor(stops, t) {
  const tt = clamp(t, 0, 1);
  let prev = stops[0];
  for (let i = 1; i < stops.length; i += 1) {
    const next = stops[i];
    if (tt <= next[0] || i === stops.length - 1) {
      const span = next[0] - prev[0] || 1;
      const local = clamp((tt - prev[0]) / span, 0, 1);
      return [
        Math.round(lerp(prev[1][0], next[1][0], local)),
        Math.round(lerp(prev[1][1], next[1][1], local)),
        Math.round(lerp(prev[1][2], next[1][2], local)),
      ];
    }
    prev = next;
  }
  return stops[stops.length - 1][1];
}

/* ── raster ──────────────────────────────────────────────────── */

function createImage(width, height) {
  return { w: width, h: height, px: new Uint8ClampedArray(width * height * 4) };
}

function setPixel(img, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  const i = (y * img.w + x) * 4;
  const sa = clamp(a ?? 255, 0, 255) / 255;
  const da = img.px[i + 3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) return;
  img.px[i] = Math.round((r * sa + img.px[i] * da * (1 - sa)) / outA);
  img.px[i + 1] = Math.round((g * sa + img.px[i + 1] * da * (1 - sa)) / outA);
  img.px[i + 2] = Math.round((b * sa + img.px[i + 2] * da * (1 - sa)) / outA);
  img.px[i + 3] = Math.round(outA * 255);
}

function fillBackground(img, stops, direction = 'v') {
  for (let y = 0; y < img.h; y += 1) {
    for (let x = 0; x < img.w; x += 1) {
      let t;
      if (direction === 'h') t = x / (img.w - 1);
      else if (direction === 'diag') t = (x / (img.w - 1) + y / (img.h - 1)) / 2;
      else if (direction === 'radial') {
        const dx = (x - img.w / 2) / (img.w / 2);
        const dy = (y - img.h / 2) / (img.h / 2);
        t = clamp(Math.sqrt(dx * dx + dy * dy) / 1.4142, 0, 1);
      } else t = y / (img.h - 1);
      const [r, g, b] = gradientColor(stops, t);
      setPixel(img, x, y, r, g, b, 255);
    }
  }
}

/* ── patrones de fondo ───────────────────────────────────────── */

function drawPattern(img, pattern, rng) {
  const { type, color = [255, 255, 255], alpha = 40 } = pattern;
  if (type === 'stars') {
    const count = pattern.count ?? Math.round((img.w * img.h) / 2600);
    for (let i = 0; i < count; i += 1) {
      const x = Math.floor(rng() * img.w);
      const y = Math.floor(rng() * img.h);
      const bright = 120 + Math.floor(rng() * 135);
      const size = rng() < 0.16 ? 2 : 1;
      for (let dy = -size; dy <= size; dy += 1) {
        for (let dx = -size; dx <= size; dx += 1) {
          if (Math.abs(dx) + Math.abs(dy) > size + (size > 1 ? 1 : 0)) continue;
          setPixel(img, x + dx, y + dy, bright, bright, Math.min(255, bright + 20), alpha * 2.2);
        }
      }
    }
  } else if (type === 'grid') {
    const step = pattern.step ?? 22;
    for (let x = 0; x < img.w; x += step) for (let y = 0; y < img.h; y += 1) setPixel(img, x, y, ...color, alpha);
    for (let y = 0; y < img.h; y += step) for (let x = 0; x < img.w; x += 1) setPixel(img, x, y, ...color, alpha);
  } else if (type === 'scan') {
    for (let y = 0; y < img.h; y += 1) if (y % 3 === 0) for (let x = 0; x < img.w; x += 1) setPixel(img, x, y, ...color, alpha);
  } else if (type === 'dots') {
    const step = pattern.step ?? 16;
    for (let y = step / 2; y < img.h; y += step) {
      for (let x = step / 2; x < img.w; x += step) {
        setPixel(img, x, y, ...color, alpha * 2);
        setPixel(img, x + 1, y, ...color, alpha * 2);
        setPixel(img, x, y + 1, ...color, alpha * 2);
      }
    }
  } else if (type === 'rain') {
    const columns = Math.round(img.w / 14);
    for (let c = 0; c < columns; c += 1) {
      const x = Math.floor(rng() * img.w);
      const length = 8 + Math.floor(rng() * (img.h * 0.4));
      const start = Math.floor(rng() * img.h);
      const speedAlpha = alpha * (0.5 + rng());
      for (let i = 0; i < length; i += 1) {
        const y = (start + i) % img.h;
        const fade = 1 - i / length;
        setPixel(img, x, y, ...color, speedAlpha * fade * 2);
      }
    }
  } else if (type === 'stripes') {
    const width = pattern.width ?? 10;
    for (let y = 0; y < img.h; y += 1) {
      for (let x = 0; x < img.w; x += 1) {
        if (Math.floor((x + y) / width) % 2 === 0) setPixel(img, x, y, ...color, alpha);
      }
    }
  } else if (type === 'checker') {
    const step = pattern.step ?? 18;
    for (let y = 0; y < img.h; y += step) {
      for (let x = 0; x < img.w; x += step) {
        if ((Math.floor(x / step) + Math.floor(y / step)) % 2 === 0) continue;
        for (let dy = 0; dy < step; dy += 1) for (let dx = 0; dx < step; dx += 1) setPixel(img, x + dx, y + dy, ...color, alpha);
      }
    }
  } else if (type === 'snow') {
    const count = Math.round((img.w * img.h) / 1600);
    for (let i = 0; i < count; i += 1) {
      const x = Math.floor(rng() * img.w);
      const y = Math.floor(rng() * img.h);
      const a = alpha + rng() * 120;
      setPixel(img, x, y, 255, 255, 255, a);
      if (rng() < 0.3) { setPixel(img, x + 1, y, 255, 255, 255, a * 0.6); setPixel(img, x, y + 1, 255, 255, 255, a * 0.6); }
    }
  } else if (type === 'hearts') {
    const glyph = GLYPHS['♥'];
    const count = Math.round((img.w * img.h) / 26000) + 2;
    for (let i = 0; i < count; i += 1) {
      const size = rng() < 0.5 ? 1 : 2;
      const ox = Math.floor(rng() * (img.w - 8 * size));
      const oy = Math.floor(rng() * (img.h - 9 * size));
      blitGlyph(img, glyph, ox, oy, size, () => color, alpha * 3);
    }
  } else if (type === 'clouds') {
    const puffs = Math.round(img.w / 90) + 3;
    for (let i = 0; i < puffs; i += 1) {
      const cx = rng() * img.w;
      const cy = rng() * img.h;
      const rx = 26 + rng() * 44;
      const ry = 10 + rng() * 16;
      for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) {
        for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
          const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
          if (d <= 1) setPixel(img, x, y, ...color, alpha * (1 - d) * 2);
        }
      }
    }
  } else if (type === 'streaks') {
    const lines = Math.round((img.w * img.h) / 9000);
    for (let i = 0; i < lines; i += 1) {
      const x = Math.floor(rng() * img.w);
      const start = Math.floor(rng() * img.h);
      const length = 12 + rng() * 40;
      for (let dy = 0; dy < length; dy += 1) setPixel(img, x + Math.floor(dy / 6), start + dy, ...color, alpha * (1 - dy / length) * 2);
    }
  }
}

/* ── máscaras de texto ───────────────────────────────────────── */

function glyphAdvance(scale) { return 6 * scale; }

/** Construye la máscara alfa de una línea de texto (Uint8Array). */
function buildLineMask(text, scale, { shear = 0 } = {}) {
  const width = Math.max(1, (text.length * 6 - 1) * scale + Math.abs(shear) * 7 * scale + 2 * scale);
  const height = 7 * scale;
  const mask = new Uint8Array(width * height);
  let cursor = scale;
  for (const rawCh of text.toUpperCase()) {
    const glyph = GLYPHS[normalizeGlyph(rawCh)] ?? GLYPHS['?'];
    for (let gy = 0; gy < 7; gy += 1) {
      for (let gx = 0; gx < 5; gx += 1) {
        if (glyph[gy][gx] !== '#') continue;
        const baseX = cursor + gx * scale + Math.round((6 - gy) * shear * scale);
        const baseY = gy * scale;
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) {
            const x = baseX + dx;
            const y = baseY + dy;
            if (x >= 0 && x < width && y < height) mask[y * width + x] = 255;
          }
        }
      }
    }
    cursor += glyphAdvance(scale);
  }
  return { mask, w: width, h: height };
}

function blitGlyph(img, glyph, ox, oy, scale, colorAt, alpha = 255) {
  for (let gy = 0; gy < 7; gy += 1) {
    for (let gx = 0; gx < 5; gx += 1) {
      if (glyph[gy][gx] !== '#') continue;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const [r, g, b] = colorAt(gx, gy);
          setPixel(img, ox + gx * scale + dx, oy + gy * scale + dy, r, g, b, alpha);
        }
      }
    }
  }
}

/** Dibuja una máscara en la imagen; colorAt(x, yGlobal) → [r,g,b]. */
function blitMask(img, mask, ox, oy, colorAt, { alpha = 255, flip = false, fade = 1 } = {}) {
  for (let sy = 0; sy < mask.h; sy += 1) {
    const y = flip ? oy + (mask.h - 1 - sy) : oy + sy;
    for (let sx = 0; sx < mask.w; sx += 1) {
      const m = mask.mask[sy * mask.w + sx];
      if (!m) continue;
      const localAlpha = (m / 255) * alpha * (flip ? fade * (1 - sy / mask.h) : 1);
      if (localAlpha < 2) continue;
      const [r, g, b] = colorAt(sx, y - oy, sy);
      setPixel(img, ox + sx, y, r, g, b, localAlpha);
    }
  }
}

function dilateMask(mask, radius = 1) {
  const out = new Uint8Array(mask.w * mask.h);
  for (let y = 0; y < mask.h; y += 1) {
    for (let x = 0; x < mask.w; x += 1) {
      if (!mask.mask[y * mask.w + x]) continue;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < mask.w && ny >= 0 && ny < mask.h) out[ny * mask.w + nx] = 255;
        }
      }
    }
  }
  return { mask: out, w: mask.w, h: mask.h };
}

function blurMask(mask, radius = 3) {
  const tmp = new Float32Array(mask.w * mask.h);
  const out = new Uint8Array(mask.w * mask.h);
  for (let y = 0; y < mask.h; y += 1) {
    let acc = 0;
    for (let x = -radius; x <= radius; x += 1) acc += mask.mask[y * mask.w + clamp(x, 0, mask.w - 1)];
    for (let x = 0; x < mask.w; x += 1) {
      tmp[y * mask.w + x] = acc / (2 * radius + 1);
      const remove = mask.mask[y * mask.w + clamp(x - radius, 0, mask.w - 1)];
      const add = mask.mask[y * mask.w + clamp(x + radius + 1, 0, mask.w - 1)];
      acc += add - remove;
    }
  }
  for (let x = 0; x < mask.w; x += 1) {
    let acc = 0;
    for (let y = -radius; y <= radius; y += 1) acc += tmp[clamp(y, 0, mask.h - 1) * mask.w + x];
    for (let y = 0; y < mask.h; y += 1) {
      out[y * mask.w + x] = clamp(Math.round(acc / (2 * radius + 1)), 0, 255);
      const remove = tmp[clamp(y - radius, 0, mask.h - 1) * mask.w + x];
      const add = tmp[clamp(y + radius + 1, 0, mask.h - 1) * mask.w + x];
      acc += add - remove;
    }
  }
  return { mask: out, w: mask.w, h: mask.h };
}

/* ── textos: medición y división en líneas ───────────────────── */

function layoutText(text, maxWidth, scale) {
  const single = buildLineMask(text, scale);
  if (single.w <= maxWidth || !text.includes(' ') || text.length <= 12) return [single];
  const words = text.split(/\s+/);
  let best = null;
  for (let i = 1; i < words.length; i += 1) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const lineA = buildLineMask(a, scale);
    const lineB = buildLineMask(b, scale);
    const width = Math.max(lineA.w, lineB.w);
    if (!best || width < best.width) best = { lines: [lineA, lineB], width };
  }
  if (best && best.width <= maxWidth) return best.lines;
  return [single];
}

/* ── efectos individuales ────────────────────────────────────── */

/**
 * Cada efecto describe: fondo, patrones, relleno del texto,
 * contorno, brillo, extrusión y extras (glitch, reflejo, marco…).
 */
const EFFECTS = {
  logoalas: {
    bg: { stops: [[0, [6, 6, 28]], [0.6, [24, 10, 60]], [1, [60, 20, 90]]], direction: 'v' },
    patterns: [{ type: 'stars', alpha: 60 }],
    text: { fill: [[0, [255, 255, 255]], [1, [140, 220, 255]]], outline: [16, 24, 60], glow: [120, 180, 255] },
    decor: ['wings'],
  },
  logoamongus: {
    bg: { stops: [[0, [150, 12, 20]], [1, [90, 6, 12]]], direction: 'v' },
    patterns: [{ type: 'stripes', color: [60, 0, 0], alpha: 30, width: 14 }],
    text: { fill: [[0, [255, 240, 240]], [1, [255, 190, 190]]], outline: [40, 0, 4], extrude: [26, 26, 34] },
    decor: ['visor'],
  },
  logoangel: {
    bg: { stops: [[0, [128, 200, 255]], [1, [240, 250, 255]]], direction: 'v' },
    patterns: [{ type: 'clouds', color: [255, 255, 255], alpha: 60 }],
    text: { fill: [[0, [255, 255, 255]], [1, [255, 232, 160]]], outline: [90, 130, 190], glow: [255, 244, 190] },
    decor: ['halo'],
  },
  logoarmy: {
    bg: { stops: [[0, [56, 66, 34]], [1, [30, 36, 18]]], direction: 'v' },
    patterns: [{ type: 'checker', color: [70, 84, 40], alpha: 70, step: 26 }, { type: 'dots', color: [20, 24, 10], alpha: 30 }],
    text: { fill: [[0, [255, 220, 60]], [1, [204, 164, 22]]], outline: [18, 20, 8], extrude: [22, 26, 10] },
    decor: ['hazard'],
  },
  logochicagamer: {
    bg: { stops: [[0, [40, 8, 60]], [1, [96, 16, 90]]], direction: 'v' },
    patterns: [{ type: 'stars', alpha: 70 }, { type: 'grid', color: [255, 90, 200], alpha: 16, step: 26 }],
    text: { fill: [[0, [255, 150, 240]], [1, [255, 60, 180]]], outline: [46, 6, 50], glow: [255, 90, 220] },
    decor: ['sparkles'],
  },
  logochristmas: {
    bg: { stops: [[0, [12, 64, 30]], [0.75, [20, 84, 38]], [1, [120, 18, 24]]], direction: 'v' },
    patterns: [{ type: 'snow', alpha: 110 }],
    text: { fill: [[0, [255, 255, 255]], [1, [210, 255, 222]]], outline: [110, 14, 20], glow: [130, 255, 160] },
    decor: ['frame'],
  },
  logocielo: {
    bg: { stops: [[0, [90, 170, 250]], [1, [200, 235, 255]]], direction: 'v' },
    patterns: [{ type: 'clouds', color: [255, 255, 255], alpha: 90 }],
    text: { fill: [[0, [255, 255, 255]], [1, [200, 235, 255]]], outline: [60, 120, 200], glow: [255, 255, 255] },
  },
  logocorazon: {
    bg: { stops: [[0, [30, 4, 12]], [1, [90, 10, 30]]], direction: 'v' },
    patterns: [{ type: 'hearts', color: [255, 60, 100], alpha: 50 }],
    text: { fill: [[0, [255, 120, 150]], [1, [220, 20, 70]]], outline: [60, 4, 20], glow: [255, 70, 120] },
    decor: ['sparkles'],
  },
  logodragonball: {
    bg: { stops: [[0, [255, 190, 40]], [0.55, [250, 130, 16]], [1, [200, 60, 8]]], direction: 'radial' },
    patterns: [{ type: 'stars', alpha: 50 }],
    text: { fill: [[0, [255, 250, 120]], [1, [255, 150, 20]]], outline: [130, 40, 6], extrude: [60, 20, 4] },
    decor: ['stars4'],
  },
  logofuturista: {
    bg: { stops: [[0, [4, 20, 34]], [1, [8, 60, 80]]], direction: 'v' },
    patterns: [{ type: 'grid', color: [40, 220, 255], alpha: 26, step: 20 }, { type: 'scan', color: [255, 255, 255], alpha: 8 }],
    text: { fill: [[0, [200, 255, 255]], [1, [20, 200, 255]]], outline: [4, 30, 44], glow: [60, 220, 255] },
    decor: ['frame'],
  },
  logogaming: {
    bg: { stops: [[0, [16, 10, 24]], [0.6, [44, 14, 50]], [1, [90, 20, 40]]], direction: 'radial' },
    patterns: [{ type: 'stars', alpha: 60 }, { type: 'scan', color: [0, 0, 0], alpha: 24 }],
    text: { fill: [[0, [255, 226, 120]], [1, [255, 170, 30]]], outline: [40, 20, 6], glow: [255, 190, 70] },
    decor: ['underline', 'sparkles'],
  },
  logogatito: {
    bg: { stops: [[0, [90, 110, 130]], [1, [190, 205, 215]]], direction: 'v' },
    patterns: [{ type: 'streaks', color: [255, 255, 255], alpha: 40 }, { type: 'dots', color: [255, 255, 255], alpha: 30, step: 14 }],
    text: { fill: [[0, [255, 255, 255]], [1, [225, 235, 240]]], outline: [110, 130, 150] },
    decor: ['paws'],
  },
  logoglitch: {
    bg: { stops: [[0, [10, 10, 14]], [1, [30, 10, 34]]], direction: 'v' },
    patterns: [{ type: 'scan', color: [255, 0, 120], alpha: 14 }, { type: 'grid', color: [0, 255, 220], alpha: 10, step: 24 }],
    text: { fill: [[0, [255, 255, 255]], [1, [190, 255, 250]]], outline: [8, 8, 10], glitch: true },
  },
  logograffiti3d: {
    bg: { stops: [[0, [52, 24, 56]], [1, [22, 12, 36]]], direction: 'v' },
    patterns: [{ type: 'checker', color: [90, 40, 90], alpha: 50, step: 22 }, { type: 'dots', color: [255, 255, 255], alpha: 14 }],
    text: { fill: [[0, [120, 240, 120]], [0.5, [40, 200, 220]], [1, [180, 80, 255]]], outline: [10, 6, 16], extrude: [16, 10, 40], extrudeDepth: 6 },
  },
  logohorror: {
    bg: { stops: [[0, [8, 4, 6]], [1, [70, 6, 10]]], direction: 'v' },
    patterns: [{ type: 'scan', color: [0, 0, 0], alpha: 60 }, { type: 'streaks', color: [120, 10, 14], alpha: 40 }],
    text: { fill: [[0, [255, 40, 40]], [1, [140, 6, 10]]], outline: [24, 0, 2], drip: true, glow: [160, 10, 16] },
  },
  logolol: {
    bg: { stops: [[0, [10, 20, 44]], [1, [16, 34, 70]]], direction: 'v' },
    patterns: [{ type: 'grid', color: [90, 140, 220], alpha: 14, step: 30 }],
    text: { fill: [[0, [250, 220, 130]], [0.5, [214, 170, 70]], [1, [250, 226, 140]]], outline: [30, 22, 8], glow: [120, 100, 40] },
    decor: ['frame'],
  },
  logomatrix: {
    bg: { stops: [[0, [2, 10, 4]], [1, [4, 24, 8]]], direction: 'v' },
    patterns: [{ type: 'rain', color: [40, 220, 80], alpha: 70 }],
    text: { fill: [[0, [170, 255, 170]], [1, [30, 220, 80]]], outline: [2, 26, 8], glow: [60, 255, 110] },
  },
  logonaruto: {
    bg: { stops: [[0, [16, 44, 110]], [1, [8, 20, 60]]], direction: 'v' },
    patterns: [{ type: 'stripes', color: [255, 140, 20], alpha: 40, width: 18 }, { type: 'stars', alpha: 40 }],
    text: { fill: [[0, [255, 240, 200]], [1, [255, 170, 40]]], outline: [16, 30, 80], extrude: [10, 20, 60] },
    decor: ['underline'],
  },
  logoneon: {
    bg: { stops: [[0, [16, 6, 28]], [1, [40, 10, 52]]], direction: 'v' },
    patterns: [{ type: 'grid', color: [255, 60, 200], alpha: 14, step: 28 }],
    text: { fill: [[0, [255, 160, 255]], [1, [255, 40, 200]]], outline: [40, 6, 44], glow: [255, 60, 220], glowRadius: 5 },
  },
  logonube: {
    bg: { stops: [[0, [120, 190, 250]], [0.7, [190, 225, 255]], [1, [240, 248, 255]]], direction: 'v' },
    patterns: [{ type: 'clouds', color: [255, 255, 255], alpha: 120 }],
    text: { fill: [[0, [255, 255, 255]], [1, [205, 230, 250]]], outline: [90, 140, 200] },
  },
  logopareja: {
    bg: { stops: [[0, [255, 150, 90]], [0.5, [250, 90, 130]], [1, [90, 30, 110]]], direction: 'v' },
    patterns: [{ type: 'hearts', color: [255, 200, 220], alpha: 40 }, { type: 'stars', alpha: 40 }],
    text: { fill: [[0, [255, 245, 230]], [1, [255, 200, 170]]], outline: [110, 30, 60], glow: [255, 150, 150] },
    decor: ['sparkles'],
  },
  logopubg: {
    bg: { stops: [[0, [92, 80, 48]], [1, [44, 40, 26]]], direction: 'v' },
    patterns: [{ type: 'checker', color: [70, 62, 36], alpha: 60, step: 24 }],
    text: { fill: [[0, [255, 214, 40]], [1, [224, 170, 20]]], outline: [26, 22, 8], extrude: [20, 18, 6] },
    decor: ['hazard'],
  },
  logopubgfem: {
    bg: { stops: [[0, [94, 24, 70]], [1, [40, 10, 40]]], direction: 'v' },
    patterns: [{ type: 'grid', color: [255, 120, 200], alpha: 18, step: 26 }],
    text: { fill: [[0, [255, 180, 230]], [1, [240, 80, 170]]], outline: [40, 8, 34], extrude: [30, 10, 30] },
    decor: ['hazardPink'],
  },
  logosad: {
    bg: { stops: [[0, [40, 52, 70]], [1, [90, 105, 125]]], direction: 'v' },
    patterns: [{ type: 'streaks', color: [200, 215, 235], alpha: 60 }, { type: 'rain', color: [160, 180, 205], alpha: 40 }],
    text: { fill: [[0, [230, 240, 250]], [1, [170, 190, 210]]], outline: [50, 62, 80], mirror: true },
  },
  logosolitario: {
    bg: { stops: [[0, [28, 28, 32]], [1, [60, 58, 60]]], direction: 'v' },
    patterns: [{ type: 'scan', color: [0, 0, 0], alpha: 30 }, { type: 'dots', color: [0, 0, 0], alpha: 30, step: 12 }],
    text: { fill: [[0, [245, 245, 240]], [1, [200, 200, 195]]], outline: [16, 16, 18], extrude: [10, 12, 12] },
    decor: ['road'],
  },
};

/* ── decoraciones ────────────────────────────────────────────── */

function drawDecor(img, name, layout, rng) {
  const { tx, ty, tw, th } = layout;
  if (name === 'wings') {
    const glyph = ['.', '#', '#', '#', '.'];
    for (let i = 0; i < 4; i += 1) {
      const y1 = ty + Math.floor(th / 2) - 2 - i * 3;
      const y2 = ty + Math.floor(th / 2) + i * 3;
      for (let j = 0; j < 5; j += 1) {
        const shade = 200 - i * 30 + j * 10;
        setPixel(img, tx - 14 - i * 7 + j, y1 + j, shade, shade, 255, 220);
        setPixel(img, tx - 14 - i * 7 + j, y2 - j, shade, shade, 255, 220);
        setPixel(img, tx + tw + 9 + i * 7 - j, y1 + j, shade, shade, 255, 220);
        setPixel(img, tx + tw + 9 + i * 7 - j, y2 - j, shade, shade, 255, 220);
      }
    }
    void glyph;
  } else if (name === 'visor') {
    const y = ty - 14;
    for (let x = tx - 6; x < tx + tw + 6; x += 1) {
      for (let dy = 0; dy < 8; dy += 1) setPixel(img, x, y + dy, 90, 220, 240, 150);
    }
    for (let x = tx; x < tx + tw; x += 1) setPixel(img, x, y - 2, 200, 250, 255, 200);
  } else if (name === 'halo') {
    const cx = tx + Math.floor(tw / 2);
    const cy = ty - 10;
    const rx = Math.max(18, Math.floor(tw / 5));
    const ry = Math.max(4, Math.floor(rx / 4));
    for (let a = 0; a < Math.PI * 2; a += 0.01) {
      const x = Math.round(cx + Math.cos(a) * rx);
      const y = Math.round(cy + Math.sin(a) * ry);
      setPixel(img, x, y, 255, 236, 150, 230);
      setPixel(img, x, y + 1, 255, 236, 150, 140);
    }
  } else if (name === 'hazard' || name === 'hazardPink') {
    const [c1, c2] = name === 'hazard' ? [[250, 200, 30], [20, 20, 20]] : [[255, 110, 190], [24, 8, 24]];
    const y0 = img.h - 16;
    for (let y = y0; y < img.h; y += 1) {
      for (let x = 0; x < img.w; x += 1) {
        const on = Math.floor((x + (img.h - y) * 2) / 10) % 2 === 0;
        const c = on ? c1 : c2;
        setPixel(img, x, y, ...c, 210);
      }
    }
  } else if (name === 'underline') {
    const y = ty + th + 8;
    for (let x = tx - 4; x < tx + tw + 4; x += 1) {
      for (let dy = 0; dy < 3; dy += 1) setPixel(img, x, y + dy, 255, 200, 90, 220);
    }
    setPixel(img, tx - 10, y + 1, 255, 200, 90, 255);
    setPixel(img, tx + tw + 9, y + 1, 255, 200, 90, 255);
  } else if (name === 'frame') {
    for (let x = 4; x < img.w - 4; x += 1) {
      for (let dy = 0; dy < 3; dy += 1) { setPixel(img, x, 4 + dy, 220, 190, 100, 190); setPixel(img, x, img.h - 7 + dy, 220, 190, 100, 190); }
    }
    for (let y = 4; y < img.h - 4; y += 1) {
      for (let dx = 0; dx < 3; dx += 1) { setPixel(img, 4 + dx, y, 220, 190, 100, 190); setPixel(img, img.w - 7 + dx, y, 220, 190, 100, 190); }
    }
  } else if (name === 'sparkles') {
    const glyph = GLYPHS['★'];
    const spots = [[tx - 16, ty - 12], [tx + tw + 6, ty - 10], [tx - 20, ty + th + 2], [tx + tw + 10, ty + th - 2]];
    for (const [x, y] of spots) blitGlyph(img, glyph, x, y, 1, () => [255, 240, 255], 230);
  } else if (name === 'stars4') {
    const glyph = GLYPHS['★'];
    const cx = tx + Math.floor(tw / 2);
    const offsets = [-30, -10, 10, 30];
    for (const off of offsets) blitGlyph(img, glyph, cx + off, ty - 16, 1, () => [220, 20, 20], 255);
  } else if (name === 'paws') {
    const spots = [[tx - 18, ty - 10], [tx + tw + 8, ty + th - 4]];
    for (const [px, py] of spots) {
      for (let a = 0; a < Math.PI * 2; a += 0.4) {
        setPixel(img, px + Math.round(Math.cos(a) * 3), py + Math.round(Math.sin(a) * 3), 255, 255, 255, 160);
      }
      setPixel(img, px, py - 5, 255, 255, 255, 160);
      setPixel(img, px - 4, py - 4, 255, 255, 255, 160);
      setPixel(img, px + 4, py - 4, 255, 255, 255, 160);
    }
  } else if (name === 'road') {
    const cy = img.h - 20;
    for (let x = 0; x < img.w; x += 22) {
      for (let dx = 0; dx < 12; dx += 1) for (let dy = 0; dy < 3; dy += 1) setPixel(img, x + dx, cy + dy, 240, 200, 60, 200);
    }
  }
  void rng;
}

/* ── render principal ────────────────────────────────────────── */

const MAX_MASK_WIDTH = 900;

/**
 * Renderiza un logo y devuelve el PNG.
 * @param {string} effectId clave de EFFECTS (los 25 `.logo*`)
 * @param {string} rawText texto del logo (ya saneado)
 * @returns {Buffer}
 */
export function renderLogoPng(effectId, rawText) {
  const effect = EFFECTS[effectId];
  if (!effect) throw new Error(`Efecto desconocido: ${effectId}`);
  const text = String(rawText ?? '').trim() || 'VÉRSOVA';
  const rng = mulberry32(hashSeed(`${effectId}:${text.toUpperCase()}`));

  // escala: cuanto más largo el texto, menor el pixel para que quepa
  let scale = effect.text.scale ?? 8;
  let lines = layoutText(text, MAX_MASK_WIDTH, scale);
  while (scale > 3 && lines.some((l) => l.w > MAX_MASK_WIDTH)) {
    scale -= 1;
    lines = layoutText(text, MAX_MASK_WIDTH, scale);
  }

  const lineGap = Math.round(3.2 * scale);
  const mirrorExtra = effect.text.mirror ? Math.round(lines.reduce((a, l) => a + l.h, 0) * 0.6) : 0;
  const marginX = Math.round(scale * 4.4);
  const marginTop = Math.round(scale * 3.6) + (effect.decor?.includes('halo') || effect.decor?.includes('stars4') ? 22 : 0);
  const marginBottom = Math.round(scale * 3.6) + (effect.decor?.some((d) => d.startsWith('hazard')) ? 18 : 0) + mirrorExtra;

  const maskW = Math.max(...lines.map((l) => l.w));
  const maskH = lines.reduce((a, l) => a + l.h, 0) + lineGap * (lines.length - 1);

  const width = clamp(maskW + marginX * 2, 220, 1024);
  const height = clamp(maskH + marginTop + marginBottom, 140, 720);
  const img = createImage(width, height);

  // fondo + patrones
  fillBackground(img, effect.bg.stops, effect.bg.direction);
  for (const pattern of effect.patterns ?? []) drawPattern(img, pattern, rng);

  // posición de cada línea (centrada)
  let cursorY = marginTop;
  const placed = lines.map((mask) => {
    const pos = { mask, x: Math.round((width - mask.w) / 2), y: cursorY };
    cursorY += mask.h + lineGap;
    return pos;
  });
  const layout = { tx: placed[0].x, ty: placed[0].y, tw: maskW, th: maskH };

  const fillSpec = effect.text.fill;
  const colorAt = (sx, sy, sh) => {
    if (Array.isArray(fillSpec[0])) return gradientColor(fillSpec, sh ? sy / (sh - 1) : sy);
    return fillSpec;
  };

  for (const { mask, x, y } of placed) {
    // reflejo (antes del texto, debajo)
    if (effect.text.mirror) blitMask(img, mask, x, y + mask.h + 2, colorAt, { flip: true, fade: 90, alpha: 90 });
    // extrusión 3D
    if (effect.text.extrude) {
      const [r, g, b] = effect.text.extrude;
      const depth = effect.text.extrudeDepth ?? 3;
      for (let d = depth; d >= 1; d -= 1) {
        blitMask(img, mask, x + d, y + d, () => [r, g, b], { alpha: 235 });
      }
    }
    // goteo (sangre que baja)
    if (effect.text.drip) {
      for (let d = 1; d <= scale * 2; d += 1) {
        blitMask(img, mask, x, y + d, () => [110, 4, 8], { alpha: 170 * (1 - d / (scale * 2)) });
      }
    }
    // brillo neón
    if (effect.text.glow) {
      const glowMask = blurMask(dilateMask(mask, 1), effect.text.glowRadius ?? 3);
      const [r, g, b] = effect.text.glow;
      blitMask(img, glowMask, x - 1, y - 1, () => [r, g, b], { alpha: 150 });
    }
    // contorno
    if (effect.text.outline) {
      const outlineMask = dilateMask(mask, Math.max(1, Math.round(scale / 5)));
      const [r, g, b] = effect.text.outline;
      blitMask(img, outlineMask, x, y, () => [r, g, b], { alpha: 255 });
    }
    // relleno
    blitMask(img, mask, x, y, (sx, gy) => colorAt(sx, gy, mask.h));
    // glitch: separación RGB y cortes
    if (effect.text.glitch) {
      blitMask(img, mask, x + Math.round(scale / 3), y, () => [255, 40, 140], { alpha: 110 });
      blitMask(img, mask, x - Math.round(scale / 3), y, () => [40, 240, 255], { alpha: 110 });
      for (let i = 0; i < 4; i += 1) {
        const sy = y + Math.floor(rng() * mask.h);
        const shift = Math.floor((rng() - 0.5) * scale * 2);
        const band = Math.max(2, Math.floor(scale / 2));
        const sliceMask = { mask: new Uint8Array(mask.w * band), w: mask.w, h: band };
        for (let yy = 0; yy < band; yy += 1) {
          for (let xx = 0; xx < mask.w; xx += 1) {
            const srcY = sy - y + yy;
            if (srcY >= 0 && srcY < mask.h) sliceMask.mask[yy * mask.w + xx] = mask.mask[srcY * mask.w + xx];
          }
        }
        blitMask(img, sliceMask, x + shift, sy, () => [255, 255, 255], { alpha: 160 });
      }
    }
  }

  for (const decor of effect.decor ?? []) drawDecor(img, decor, layout, rng);

  return encodePng(img.w, img.h, img.px);
}

export const LOGO_EFFECT_IDS = Object.freeze(Object.keys(EFFECTS));

export default { renderLogoPng, LOGO_EFFECT_IDS, hashSeed, mulberry32, gradientColor };
