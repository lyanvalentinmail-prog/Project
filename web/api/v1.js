/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · API funcional (/api/v1)
 * ────────────────────────────────────────────────────────────────
 * Endpoints REALES que se ejecutan en este mismo servidor (sin APIs
 * externas ni internet). Todos exigen una API key válida y vigente
 * (`?key=vsk_…` o cabecera `X-API-Key`), que se crea desde la pestaña
 * «Funcionales» de la página de endpoints tras iniciar sesión.
 *
 * Cada definición describe sus parámetros: el panel genera con ellos
 * el formulario de prueba y los ejemplos de código.
 */
import crypto from 'node:crypto';
import express from 'express';
import QRCode from 'qrcode';
import { getDb } from '../../src/db/index.js';
import { renderLogoPng, LOGO_EFFECT_IDS } from '../../src/services/logo-renderer.js';
import { registry } from '../../src/commands/index.js';
import { IDENTITY } from '../../src/config/identity.js';
import { findKeyByPlaintext, findUserById, keyStatus, roleOf } from './accounts.js';

export const RATE_LIMIT_PER_MINUTE = 60;

/* ═══════════════════════════════════════════════════════════════
   Utilidades
   ═══════════════════════════════════════════════════════════════ */

class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const bad = (message) => new ApiError(message, 400);

function text(q, name = 'text', { max = 2000, required = true } = {}) {
  const value = q[name];
  const str = Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
  if (required && !str.trim()) throw bad(`Falta el parámetro «${name}».`);
  if (str.length > max) throw bad(`«${name}» admite como máximo ${max} caracteres.`);
  return str;
}

function int(q, name, { min, max, fallback }) {
  const raw = q[name];
  if (raw === undefined || raw === '') {
    if (fallback === undefined) throw bad(`Falta el parámetro «${name}».`);
    return fallback;
  }
  const n = Number(raw);
  if (!Number.isInteger(n)) throw bad(`«${name}» debe ser un número entero.`);
  if (n < min || n > max) throw bad(`«${name}» debe estar entre ${min} y ${max}.`);
  return n;
}

function num(q, name) {
  const raw = q[name];
  if (raw === undefined || raw === '') throw bad(`Falta el parámetro «${name}».`);
  const n = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(n)) throw bad(`«${name}» debe ser un número.`);
  return n;
}

function pick(q, name, options, fallback) {
  const value = String(q[name] ?? fallback ?? '').toLowerCase();
  if (!options.includes(value)) throw bad(`«${name}» debe ser uno de: ${options.join(', ')}.`);
  return value;
}

const seededPercent = (seed) => crypto.createHash('sha256').update(seed).digest().readUInt32BE(0) % 101;
const randomInt = (min, max) => crypto.randomInt(min, max + 1);

/* ── texto decorado (unicode) ────────────────────────────────── */

const MATH_STYLES = {
  bold: [0x1d400, 0x1d41a, 0x1d7ce],
  italic: [0x1d434, 0x1d44e, null, { h: 0x210e }],
  bolditalic: [0x1d468, 0x1d482],
  script: [0x1d49c, 0x1d4b6, null, { B: 0x212c, E: 0x2130, F: 0x2131, H: 0x210b, I: 0x2110, L: 0x2112, M: 0x2133, R: 0x211b, e: 0x212f, g: 0x210a, o: 0x2134 }],
  boldscript: [0x1d4d0, 0x1d4ea],
  fraktur: [0x1d504, 0x1d51e, null, { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 }],
  double: [0x1d538, 0x1d552, 0x1d7d8, { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 }],
  sans: [0x1d5a0, 0x1d5ba, 0x1d7e2],
  sansbold: [0x1d5d4, 0x1d5ee, 0x1d7ec],
  sansitalic: [0x1d608, 0x1d622],
  mono: [0x1d670, 0x1d68a, 0x1d7f6],
  fullwidth: [0xff21, 0xff41, 0xff10],
};
const SMALLCAPS = 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ';
export const FANCY_STYLES = [...Object.keys(MATH_STYLES), 'smallcaps', 'bubble', 'squared'];

export function fancyText(input, style) {
  return [...input].map((ch) => {
    const code = ch.codePointAt(0);
    const upper = code >= 65 && code <= 90;
    const lower = code >= 97 && code <= 122;
    const digit = code >= 48 && code <= 57;
    if (style === 'smallcaps') return upper || lower ? SMALLCAPS[(code | 32) - 97] : ch;
    if (style === 'bubble') {
      if (upper) return String.fromCodePoint(0x24b6 + code - 65);
      if (lower) return String.fromCodePoint(0x24d0 + code - 97);
      if (digit) return code === 48 ? '⓪' : String.fromCodePoint(0x2460 + code - 49);
      return ch;
    }
    if (style === 'squared') return upper || lower ? String.fromCodePoint(0x1f130 + (code & ~32) - 65) : ch;
    const [up, low, dig, exceptions = {}] = MATH_STYLES[style];
    if (exceptions[ch]) return String.fromCodePoint(exceptions[ch]);
    if (upper) return String.fromCodePoint(up + code - 65);
    if (lower) return String.fromCodePoint(low + code - 97);
    if (digit && dig) return String.fromCodePoint(dig + code - 48);
    return ch;
  }).join('');
}

/* ── morse ───────────────────────────────────────────────────── */

const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
  ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.', '@': '.--.-.', Ñ: '--.--',
};
const MORSE_REVERSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
const stripAccents = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/* ── calculadora segura (sin eval) ───────────────────────────── */

const CALC_FUNCS = {
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  log: Math.log10, ln: Math.log, exp: Math.exp,
};
const CALC_CONSTS = { pi: Math.PI, e: Math.E };

export function calculate(expression) {
  const src = String(expression).replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '.');
  if (!src) throw bad('La expresión está vacía.');
  let pos = 0;
  const peek = () => src[pos];
  const eat = (ch) => {
    if (src[pos] === ch) { pos += 1; return true; }
    return false;
  };
  const parseExpr = () => {
    let value = parseTerm();
    for (;;) {
      if (eat('+')) value += parseTerm();
      else if (eat('-')) value -= parseTerm();
      else return value;
    }
  };
  const parseTerm = () => {
    let value = parseFactor();
    for (;;) {
      if (eat('*')) value *= parseFactor();
      else if (eat('/')) {
        const divisor = parseFactor();
        if (divisor === 0) throw bad('División entre cero.');
        value /= divisor;
      } else if (eat('%')) value %= parseFactor();
      else return value;
    }
  };
  const parseFactor = () => {
    const base = parseUnary();
    if (eat('^')) return base ** parseFactor(); // asociativa por la derecha
    return base;
  };
  const parseUnary = () => {
    if (eat('-')) return -parseUnary();
    if (eat('+')) return parseUnary();
    return parsePrimary();
  };
  const parsePrimary = () => {
    if (eat('(')) {
      const value = parseExpr();
      if (!eat(')')) throw bad('Falta cerrar un paréntesis.');
      return value;
    }
    const numMatch = /^\d*\.?\d+(e[+-]?\d+)?/i.exec(src.slice(pos));
    if (numMatch) {
      pos += numMatch[0].length;
      return Number(numMatch[0]);
    }
    const idMatch = /^[a-z]+/i.exec(src.slice(pos));
    if (idMatch) {
      const id = idMatch[0].toLowerCase();
      pos += idMatch[0].length;
      if (id in CALC_CONSTS) return CALC_CONSTS[id];
      if (id in CALC_FUNCS) {
        if (!eat('(')) throw bad(`La función ${id} necesita paréntesis: ${id}(…)`);
        const arg = parseExpr();
        if (!eat(')')) throw bad('Falta cerrar un paréntesis.');
        return CALC_FUNCS[id](arg);
      }
      throw bad(`Función o constante desconocida: ${id}`);
    }
    throw bad(peek() ? `Carácter inesperado «${peek()}» en la posición ${pos + 1}.` : 'La expresión está incompleta.');
  };
  const result = parseExpr();
  if (pos < src.length) throw bad(`Carácter inesperado «${src[pos]}» en la posición ${pos + 1}.`);
  if (!Number.isFinite(result)) throw bad('El resultado no es un número finito.');
  return Number(result.toPrecision(15));
}

/* ── conversión de unidades ──────────────────────────────────── */

const UNITS = {
  length: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 },
  mass: { mg: 0.000001, g: 0.001, kg: 1, t: 1000, oz: 0.028349523125, lb: 0.45359237 },
  data: { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 },
  time: { ms: 0.001, s: 1, min: 60, h: 3600, d: 86400, week: 604800 },
  speed: { 'm/s': 1, 'km/h': 1 / 3.6, mph: 0.44704, knot: 0.514444 },
};
const TEMPERATURE = ['c', 'f', 'k'];

function convertTemperature(value, from, to) {
  const celsius = from === 'c' ? value : from === 'f' ? (value - 32) * 5 / 9 : value - 273.15;
  if (to === 'c') return celsius;
  if (to === 'f') return celsius * 9 / 5 + 32;
  return celsius + 273.15;
}

/* ── romanos ─────────────────────────────────────────────────── */

const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
const toRoman = (n) => ROMAN.reduce((out, [v, s]) => { while (n >= v) { out += s; n -= v; } return out; }, '');
function fromRoman(str) {
  const s = str.toUpperCase();
  if (!/^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(s) || !s) throw bad('Número romano no válido.');
  let total = 0;
  let i = 0;
  for (const [v, sym] of ROMAN) {
    while (s.startsWith(sym, i)) { total += v; i += sym.length; }
  }
  return total;
}

/* ── colores ─────────────────────────────────────────────────── */

function parseColor(q) {
  let raw = String(q.hex ?? q.color ?? '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(raw)) raw = raw.split('').map((c) => c + c).join('');
  if (/^[0-9a-f]{6}$/i.test(raw)) return [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16));
  const rgb = String(q.rgb ?? '').split(/[,\s]+/).filter(Boolean).map(Number);
  if (rgb.length === 3 && rgb.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) return rgb;
  throw bad('Indica un color en «hex» (ej. 9554f5) o en «rgb» (ej. 149,84,245).');
}
const toHex = (rgb) => `#${rgb.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`;
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}
function hslToRgb([h, s, l]) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255].map(Math.round);
}

/* ── teléfonos (prefijos de país) ────────────────────────────── */

const COUNTRY_PREFIXES = [
  ['1809', 'República Dominicana'], ['1829', 'República Dominicana'], ['1849', 'República Dominicana'], ['1787', 'Puerto Rico'],
  ['598', 'Uruguay'], ['595', 'Paraguay'], ['593', 'Ecuador'], ['591', 'Bolivia'], ['507', 'Panamá'], ['506', 'Costa Rica'],
  ['505', 'Nicaragua'], ['504', 'Honduras'], ['503', 'El Salvador'], ['502', 'Guatemala'], ['351', 'Portugal'],
  ['58', 'Venezuela'], ['57', 'Colombia'], ['56', 'Chile'], ['55', 'Brasil'], ['54', 'Argentina'], ['53', 'Cuba'],
  ['52', 'México'], ['51', 'Perú'], ['49', 'Alemania'], ['44', 'Reino Unido'], ['39', 'Italia'], ['34', 'España'],
  ['33', 'Francia'], ['91', 'India'], ['81', 'Japón'], ['7', 'Rusia'], ['1', 'Estados Unidos / Canadá'],
];

/* ── email ───────────────────────────────────────────────────── */

const DISPOSABLE = new Set(['mailinator.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com', 'yopmail.com', 'trashmail.com', 'temp-mail.org', 'getnada.com', 'dispostable.com', 'sharklasers.com']);
const COMMON_DOMAINS = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'live.com', 'protonmail.com'];
function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

/* ── signos / tiempo ─────────────────────────────────────────── */

const ZODIAC = [
  [120, 'Capricornio'], [219, 'Acuario'], [320, 'Piscis'], [420, 'Aries'], [521, 'Tauro'], [621, 'Géminis'],
  [722, 'Cáncer'], [823, 'Leo'], [923, 'Virgo'], [1023, 'Libra'], [1122, 'Escorpio'], [1222, 'Sagitario'], [1231, 'Capricornio'],
];
const zodiacOf = (month, day) => ZODIAC.find(([limit]) => month * 100 + day <= limit)[1];

function parseDate(value, name) {
  const str = String(value ?? '').trim();
  if (!str) throw bad(`Falta el parámetro «${name}».`);
  const date = /^\d+$/.test(str) ? new Date(Number(str) * (str.length <= 10 ? 1000 : 1)) : new Date(str);
  if (Number.isNaN(date.getTime())) throw bad(`«${name}» no es una fecha válida (usa AAAA-MM-DD o ISO 8601).`);
  return date;
}

function validTimeZone(tz) {
  try {
    new Intl.DateTimeFormat('es', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/* ── identicon SVG ───────────────────────────────────────────── */

function identiconSvg(seed, size) {
  const hash = crypto.createHash('sha256').update(seed).digest();
  const hue = Math.round((hash[0] / 255) * 360);
  const color = `hsl(${hue} 65% 58%)`;
  const cell = size / 6;
  let rects = '';
  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 3; x += 1) {
      if (hash[1 + y * 3 + x] % 2 === 0) continue;
      for (const xx of new Set([x, 4 - x])) {
        rects += `<rect x="${(cell / 2 + xx * cell).toFixed(2)}" y="${(cell / 2 + y * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" rx="${Math.round(size / 8)}" fill="#0d0c11"/><g fill="${color}">${rects}</g></svg>`;
}

const LOREM = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
  'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  'Curabitur pretium tincidunt lacus, nulla gravida orci a odio, nullam varius turpis et commodo pharetra.',
  'Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae, donec velit neque.',
];

const EIGHT_BALL = [
  'Sí, definitivamente.', 'Es cierto.', 'Sin duda.', 'Puedes confiar en ello.', 'Como yo lo veo, sí.', 'Lo más probable.',
  'Las señales apuntan a que sí.', 'Respuesta confusa, vuelve a intentarlo.', 'Pregunta más tarde.', 'Mejor no decírtelo ahora.',
  'No puedo predecirlo ahora.', 'Concéntrate y vuelve a preguntar.', 'No cuentes con ello.', 'Mi respuesta es no.',
  'Mis fuentes dicen que no.', 'Las perspectivas no son buenas.', 'Muy dudoso.',
];

/* ═══════════════════════════════════════════════════════════════
   Definición de endpoints
   ═══════════════════════════════════════════════════════════════ */

const P = (name, { required = false, example = '', description = '', options = null } = {}) => ({ name, required, example, description, options });

/**
 * @type {Array<{ path, name, category, icon, description, params, response?, handler }>}
 * `handler(query, req, deps)` devuelve un objeto JSON o `{ __binary: { type, body } }`.
 */
export const FUNCTIONAL_ENDPOINTS = [
  /* ── Texto ─────────────────────────────────────────────── */
  {
    path: '/text/reverse', name: 'Invertir texto', category: 'Texto', icon: '🔁',
    description: 'Devuelve el texto al revés (respeta emojis y acentos).',
    params: [P('text', { required: true, example: 'Versova café', description: 'Texto a invertir' })],
    handler: (q) => { const t = text(q); return { input: t, result: [...t].reverse().join('') }; },
  },
  {
    path: '/text/case', name: 'Mayúsculas y estilos de nombre', category: 'Texto', icon: '🔠',
    description: 'Convierte a mayúsculas, minúsculas, Título, camelCase, snake_case o kebab-case.',
    params: [P('text', { required: true, example: 'hola mundo del rol' }), P('mode', { example: 'title', options: ['upper', 'lower', 'title', 'camel', 'snake', 'kebab', 'swap'] })],
    handler: (q) => {
      const t = text(q);
      const mode = pick(q, 'mode', ['upper', 'lower', 'title', 'camel', 'snake', 'kebab', 'swap'], 'upper');
      const words = stripAccents(t).toLowerCase().match(/[a-z0-9ñ]+/gi) ?? [];
      const result = {
        upper: () => t.toLocaleUpperCase('es'),
        lower: () => t.toLocaleLowerCase('es'),
        title: () => t.toLocaleLowerCase('es').replace(/(^|\s)(\p{L})/gu, (m, s, c) => s + c.toLocaleUpperCase('es')),
        camel: () => words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join(''),
        snake: () => words.join('_'),
        kebab: () => words.join('-'),
        swap: () => [...t].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join(''),
      }[mode]();
      return { input: t, mode, result };
    },
  },
  {
    path: '/text/count', name: 'Contador de texto', category: 'Texto', icon: '🔢',
    description: 'Cuenta caracteres, palabras, líneas, vocales y tiempo estimado de lectura.',
    params: [P('text', { required: true, example: 'Tu rol es tu identidad.\nTu team es tu historia.' })],
    handler: (q) => {
      const t = text(q, 'text', { max: 20000 });
      const words = t.trim() ? t.trim().split(/\s+/).length : 0;
      return {
        characters: [...t].length,
        charactersNoSpaces: [...t.replace(/\s/g, '')].length,
        words,
        lines: t.split(/\r?\n/).length,
        sentences: (t.match(/[.!?…]+(\s|$)/g) ?? []).length || (t.trim() ? 1 : 0),
        vowels: (stripAccents(t).match(/[aeiou]/gi) ?? []).length,
        readingTimeSec: Math.max(1, Math.round((words / 200) * 60)),
      };
    },
  },
  {
    path: '/text/slug', name: 'Generar slug', category: 'Texto', icon: '🔗',
    description: 'Convierte un título en un slug apto para URLs.',
    params: [P('text', { required: true, example: '¡Bienvenidos al Team Versova 2026!' })],
    handler: (q) => {
      const t = text(q);
      const slug = stripAccents(t).toLowerCase().replace(/ñ/g, 'n').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
      return { input: t, result: slug };
    },
  },
  {
    path: '/text/fancy', name: 'Letras decoradas', category: 'Texto', icon: '✨',
    description: 'Transforma el texto con fuentes unicode (como las del menú del bot). Sin «style» devuelve todas.',
    params: [P('text', { required: true, example: 'Versova' }), P('style', { example: 'boldscript', options: FANCY_STYLES })],
    handler: (q) => {
      const t = text(q, 'text', { max: 500 });
      if (q.style) {
        const style = pick(q, 'style', FANCY_STYLES);
        return { input: t, style, result: fancyText(t, style) };
      }
      return { input: t, styles: Object.fromEntries(FANCY_STYLES.map((s) => [s, fancyText(t, s)])) };
    },
  },
  {
    path: '/text/leet', name: 'Texto leet (1337)', category: 'Texto', icon: '👾',
    description: 'Convierte el texto a lenguaje leet.',
    params: [P('text', { required: true, example: 'elite gamer' })],
    handler: (q) => {
      const t = text(q);
      const map = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7', g: '9', b: '8', l: '1', z: '2' };
      return { input: t, result: [...stripAccents(t)].map((c) => map[c.toLowerCase()] ?? c).join('') };
    },
  },
  {
    path: '/text/morse', name: 'Código morse', category: 'Texto', icon: '📡',
    description: 'Codifica texto a morse o decodifica morse a texto.',
    params: [P('text', { required: true, example: 'SOS cafe' }), P('mode', { example: 'encode', options: ['encode', 'decode'] })],
    handler: (q) => {
      const t = text(q);
      const mode = pick(q, 'mode', ['encode', 'decode'], 'encode');
      if (mode === 'encode') {
        const result = stripAccents(t.toUpperCase().replace(/Ñ/g, '\u0000')).replace(/\u0000/g, 'Ñ').split(/\s+/)
          .map((word) => [...word].map((c) => MORSE[c] ?? '').filter(Boolean).join(' ')).filter(Boolean).join(' / ');
        return { input: t, mode, result };
      }
      const result = t.trim().split(/\s*\/\s*|\s{2,}/).map((word) => word.split(/\s+/).map((code) => MORSE_REVERSE[code] ?? '?').join('')).join(' ');
      return { input: t, mode, result };
    },
  },
  {
    path: '/text/palindrome', name: '¿Es palíndromo?', category: 'Texto', icon: '🪞',
    description: 'Comprueba si una frase se lee igual al derecho y al revés.',
    params: [P('text', { required: true, example: 'Anita lava la tina' })],
    handler: (q) => {
      const t = text(q);
      const clean = stripAccents(t).toLowerCase().replace(/[^a-z0-9ñ]/g, '');
      return { input: t, normalized: clean, isPalindrome: clean.length > 0 && clean === [...clean].reverse().join('') };
    },
  },

  /* ── Codificación y seguridad ──────────────────────────── */
  {
    path: '/encode/base64', name: 'Base64', category: 'Codificación', icon: '🧬',
    description: 'Codifica o decodifica Base64 (UTF-8).',
    params: [P('text', { required: true, example: 'Hola VÉRSOVA' }), P('mode', { example: 'encode', options: ['encode', 'decode'] })],
    handler: (q) => {
      const t = text(q, 'text', { max: 10000 });
      const mode = pick(q, 'mode', ['encode', 'decode'], 'encode');
      if (mode === 'encode') return { mode, result: Buffer.from(t, 'utf8').toString('base64') };
      if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(t.trim())) throw bad('El texto no es Base64 válido.');
      return { mode, result: Buffer.from(t.trim(), 'base64').toString('utf8') };
    },
  },
  {
    path: '/encode/url', name: 'Codificar URL', category: 'Codificación', icon: '🌐',
    description: 'Aplica o revierte la codificación de URL (percent-encoding).',
    params: [P('text', { required: true, example: 'café con leche & azúcar' }), P('mode', { example: 'encode', options: ['encode', 'decode'] })],
    handler: (q) => {
      const t = text(q, 'text', { max: 10000 });
      const mode = pick(q, 'mode', ['encode', 'decode'], 'encode');
      try {
        return { mode, result: mode === 'encode' ? encodeURIComponent(t) : decodeURIComponent(t) };
      } catch {
        throw bad('El texto no tiene una codificación de URL válida.');
      }
    },
  },
  {
    path: '/encode/hex', name: 'Hexadecimal', category: 'Codificación', icon: '🔣',
    description: 'Convierte texto a hexadecimal y viceversa.',
    params: [P('text', { required: true, example: 'rol' }), P('mode', { example: 'encode', options: ['encode', 'decode'] })],
    handler: (q) => {
      const t = text(q, 'text', { max: 10000 });
      const mode = pick(q, 'mode', ['encode', 'decode'], 'encode');
      if (mode === 'encode') return { mode, result: Buffer.from(t, 'utf8').toString('hex') };
      const clean = t.replace(/\s+/g, '');
      if (!/^([0-9a-f]{2})*$/i.test(clean)) throw bad('El texto no es hexadecimal válido.');
      return { mode, result: Buffer.from(clean, 'hex').toString('utf8') };
    },
  },
  {
    path: '/encode/binary', name: 'Binario', category: 'Codificación', icon: '💾',
    description: 'Convierte texto a binario (bytes UTF-8) y viceversa.',
    params: [P('text', { required: true, example: 'Hi' }), P('mode', { example: 'encode', options: ['encode', 'decode'] })],
    handler: (q) => {
      const t = text(q, 'text', { max: 4000 });
      const mode = pick(q, 'mode', ['encode', 'decode'], 'encode');
      if (mode === 'encode') return { mode, result: [...Buffer.from(t, 'utf8')].map((b) => b.toString(2).padStart(8, '0')).join(' ') };
      const bytes = t.trim().split(/\s+/);
      if (!bytes.every((b) => /^[01]{1,8}$/.test(b))) throw bad('El texto no es binario válido (grupos de 8 bits).');
      return { mode, result: Buffer.from(bytes.map((b) => parseInt(b, 2))).toString('utf8') };
    },
  },
  {
    path: '/crypto/hash', name: 'Hash', category: 'Codificación', icon: '#️⃣',
    description: 'Calcula el hash MD5, SHA-1, SHA-256 o SHA-512 de un texto.',
    params: [P('text', { required: true, example: 'versova' }), P('algo', { example: 'sha256', options: ['md5', 'sha1', 'sha256', 'sha512'] })],
    handler: (q) => {
      const t = text(q, 'text', { max: 20000 });
      const algo = pick(q, 'algo', ['md5', 'sha1', 'sha256', 'sha512'], 'sha256');
      return { algo, result: crypto.createHash(algo).update(t, 'utf8').digest('hex') };
    },
  },
  {
    path: '/crypto/uuid', name: 'UUID v4', category: 'Codificación', icon: '🆔',
    description: 'Genera identificadores UUID v4 criptográficamente seguros.',
    params: [P('count', { example: '3', description: 'Cantidad (1-50)' })],
    handler: (q) => ({ result: Array.from({ length: int(q, 'count', { min: 1, max: 50, fallback: 1 }) }, () => crypto.randomUUID()) }),
  },
  {
    path: '/crypto/password', name: 'Generador de contraseñas', category: 'Codificación', icon: '🔐',
    description: 'Genera contraseñas seguras con crypto.randomInt y calcula su entropía.',
    params: [P('length', { example: '16', description: '8 a 128' }), P('symbols', { example: 'true', options: ['true', 'false'] }), P('count', { example: '1', description: '1 a 20' })],
    handler: (q) => {
      const length = int(q, 'length', { min: 8, max: 128, fallback: 16 });
      const count = int(q, 'count', { min: 1, max: 20, fallback: 1 });
      const symbols = String(q.symbols ?? 'true') !== 'false';
      const charset = `ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789${symbols ? '!@#$%&*?-_=+' : ''}`;
      const make = () => Array.from({ length }, () => charset[crypto.randomInt(charset.length)]).join('');
      return { length, symbols, entropyBits: Math.round(length * Math.log2(charset.length)), result: Array.from({ length: count }, make) };
    },
  },

  /* ── Matemáticas ───────────────────────────────────────── */
  {
    path: '/math/calc', name: 'Calculadora', category: 'Matemáticas', icon: '🧮',
    description: 'Evalúa expresiones de forma segura: + - * / % ^, paréntesis, sqrt, sin, log, ln, pi, e…',
    params: [P('expr', { required: true, example: '(2+3)^2 * sqrt(16) / 4' })],
    handler: (q) => { const expr = text(q, 'expr', { max: 300 }); return { expression: expr, result: calculate(expr) }; },
  },
  {
    path: '/math/random', name: 'Número aleatorio', category: 'Matemáticas', icon: '🎲',
    description: 'Genera números enteros aleatorios dentro de un rango.',
    params: [P('min', { example: '1' }), P('max', { example: '100' }), P('count', { example: '1', description: '1 a 100' })],
    handler: (q) => {
      const min = int(q, 'min', { min: -1e12, max: 1e12, fallback: 1 });
      const max = int(q, 'max', { min: -1e12, max: 1e12, fallback: 100 });
      if (min >= max) throw bad('«min» debe ser menor que «max».');
      if (max - min > 2 ** 47) throw bad('El rango es demasiado grande.');
      const count = int(q, 'count', { min: 1, max: 100, fallback: 1 });
      return { min, max, result: Array.from({ length: count }, () => randomInt(min, max)) };
    },
  },
  {
    path: '/math/prime', name: 'Números primos', category: 'Matemáticas', icon: '🔍',
    description: 'Indica si un número es primo y lo descompone en factores primos.',
    params: [P('n', { required: true, example: '360' })],
    handler: (q) => {
      const n = int(q, 'n', { min: 2, max: 1e12 });
      const factors = [];
      let rest = n;
      for (let d = 2; d * d <= rest; d += d === 2 ? 1 : 2) {
        while (rest % d === 0) { factors.push(d); rest /= d; }
      }
      if (rest > 1) factors.push(rest);
      return { n, isPrime: factors.length === 1, factors };
    },
  },
  {
    path: '/convert/roman', name: 'Números romanos', category: 'Matemáticas', icon: '🏛️',
    description: 'Convierte entre números arábigos (1-3999) y romanos, en ambos sentidos.',
    params: [P('value', { required: true, example: '2026' })],
    handler: (q) => {
      const value = text(q, 'value', { max: 20 }).trim();
      if (/^\d+$/.test(value)) {
        const n = Number(value);
        if (n < 1 || n > 3999) throw bad('Solo se admiten números del 1 al 3999.');
        return { input: value, result: toRoman(n) };
      }
      return { input: value, result: fromRoman(value) };
    },
  },

  /* ── Conversión ────────────────────────────────────────── */
  {
    path: '/convert/units', name: 'Conversor de unidades', category: 'Conversión', icon: '📏',
    description: 'Longitud, masa, temperatura, datos, tiempo y velocidad.',
    params: [P('value', { required: true, example: '10' }), P('from', { required: true, example: 'km' }), P('to', { required: true, example: 'mi' })],
    handler: (q) => {
      const value = num(q, 'value');
      const from = text(q, 'from', { max: 10 }).toLowerCase();
      const to = text(q, 'to', { max: 10 }).toLowerCase();
      if (TEMPERATURE.includes(from) && TEMPERATURE.includes(to)) {
        return { value, from, to, kind: 'temperature', result: Number(convertTemperature(value, from, to).toFixed(4)) };
      }
      const kind = Object.keys(UNITS).find((k) => from in UNITS[k] && to in UNITS[k]);
      if (!kind) {
        const all = [...Object.values(UNITS).flatMap((u) => Object.keys(u)), ...TEMPERATURE];
        throw bad(`Unidades incompatibles o desconocidas. Disponibles: ${all.join(', ')}.`);
      }
      return { value, from, to, kind, result: Number(((value * UNITS[kind][from]) / UNITS[kind][to]).toPrecision(12)) };
    },
  },
  {
    path: '/convert/base', name: 'Bases numéricas', category: 'Conversión', icon: '🔀',
    description: 'Convierte números enteros entre bases 2 y 36 (binario, octal, decimal, hex…).',
    params: [P('value', { required: true, example: 'ff' }), P('from', { example: '16' }), P('to', { example: '2' })],
    handler: (q) => {
      const value = text(q, 'value', { max: 64 }).trim().toLowerCase();
      const from = int(q, 'from', { min: 2, max: 36, fallback: 10 });
      const to = int(q, 'to', { min: 2, max: 36, fallback: 2 });
      const digits = '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, from);
      const negative = value.startsWith('-');
      const body = negative ? value.slice(1) : value;
      if (!body || ![...body].every((c) => digits.includes(c))) throw bad(`«${value}» no es un número válido en base ${from}.`);
      let n = 0n;
      for (const c of body) n = n * BigInt(from) + BigInt(digits.indexOf(c));
      return { input: value, from, to, result: `${negative ? '-' : ''}${n.toString(to)}`, decimal: `${negative ? '-' : ''}${n.toString(10)}` };
    },
  },
  {
    path: '/convert/color', name: 'Colores', category: 'Conversión', icon: '🎨',
    description: 'Convierte un color HEX/RGB a RGB, HSL y genera su complementario y una paleta.',
    params: [P('hex', { example: '9554f5', description: 'o usa «rgb=149,84,245»' })],
    handler: (q) => {
      const rgb = parseColor(q);
      const [h, s, l] = rgbToHsl(rgb);
      const shade = (dl) => toHex(hslToRgb([h, s, Math.max(0, Math.min(100, l + dl))]));
      return {
        hex: toHex(rgb),
        rgb: { r: rgb[0], g: rgb[1], b: rgb[2] },
        hsl: { h, s, l },
        complementary: toHex(hslToRgb([(h + 180) % 360, s, l])),
        palette: [shade(-30), shade(-15), toHex(rgb), shade(15), shade(30)],
        luminance: Number(((0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255).toFixed(3)),
      };
    },
  },

  /* ── Tiempo ────────────────────────────────────────────── */
  {
    path: '/time/now', name: 'Hora mundial', category: 'Tiempo', icon: '🕒',
    description: 'Fecha y hora actual en cualquier zona horaria IANA.',
    params: [P('tz', { example: 'America/Montevideo', description: 'Zona horaria IANA' })],
    handler: (q) => {
      const tz = String(q.tz || 'UTC');
      if (!validTimeZone(tz)) throw bad(`Zona horaria desconocida: ${tz}`);
      const date = new Date();
      const formatted = new Intl.DateTimeFormat('es', { timeZone: tz, dateStyle: 'full', timeStyle: 'long' }).format(date);
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date).map((p) => [p.type, p.value]));
      return { timezone: tz, iso: date.toISOString(), unix: Math.floor(date.getTime() / 1000), local: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`, formatted };
    },
  },
  {
    path: '/time/age', name: 'Calcular edad', category: 'Tiempo', icon: '🎂',
    description: 'Edad exacta, días vividos, próximo cumpleaños y signo zodiacal.',
    params: [P('birth', { required: true, example: '2005-08-17', description: 'AAAA-MM-DD' })],
    handler: (q) => {
      const raw = text(q, 'birth', { max: 10 }).trim();
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
      if (!m) throw bad('«birth» debe tener el formato AAAA-MM-DD.');
      const [y, mo, d] = m.slice(1).map(Number);
      const birth = new Date(Date.UTC(y, mo - 1, d));
      if (birth.getUTCMonth() !== mo - 1 || birth.getUTCDate() !== d) throw bad('La fecha de nacimiento no existe.');
      const today = new Date();
      const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      if (birth > todayUtc) throw bad('La fecha de nacimiento está en el futuro.');
      let years = todayUtc.getUTCFullYear() - y;
      let months = todayUtc.getUTCMonth() - (mo - 1);
      let days = todayUtc.getUTCDate() - d;
      if (days < 0) { months -= 1; days += new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), 0)).getUTCDate(); }
      if (months < 0) { years -= 1; months += 12; }
      let next = new Date(Date.UTC(todayUtc.getUTCFullYear(), mo - 1, d));
      if (next < todayUtc) next = new Date(Date.UTC(todayUtc.getUTCFullYear() + 1, mo - 1, d));
      return {
        birth: raw,
        age: { years, months, days },
        daysLived: Math.floor((todayUtc - birth) / 86_400_000),
        nextBirthdayInDays: Math.round((next - todayUtc) / 86_400_000),
        weekday: new Intl.DateTimeFormat('es', { weekday: 'long', timeZone: 'UTC' }).format(birth),
        zodiac: zodiacOf(mo, d),
      };
    },
  },
  {
    path: '/time/diff', name: 'Diferencia entre fechas', category: 'Tiempo', icon: '⏳',
    description: 'Tiempo entre dos fechas en días, horas, minutos y segundos.',
    params: [P('from', { required: true, example: '2026-01-01' }), P('to', { example: '2026-12-31', description: 'Por defecto: ahora' })],
    handler: (q) => {
      const from = parseDate(q.from, 'from');
      const to = q.to ? parseDate(q.to, 'to') : new Date();
      const ms = to - from;
      const abs = Math.abs(ms);
      return {
        from: from.toISOString(), to: to.toISOString(), direction: ms >= 0 ? 'futuro' : 'pasado',
        totals: { days: Number((abs / 86_400_000).toFixed(2)), hours: Math.floor(abs / 3_600_000), minutes: Math.floor(abs / 60_000), seconds: Math.floor(abs / 1000) },
        breakdown: { days: Math.floor(abs / 86_400_000), hours: Math.floor(abs / 3_600_000) % 24, minutes: Math.floor(abs / 60_000) % 60, seconds: Math.floor(abs / 1000) % 60 },
      };
    },
  },

  /* ── Diversión (rol) ───────────────────────────────────── */
  {
    path: '/fun/ship', name: 'Ship de compatibilidad', category: 'Diversión', icon: '💞',
    description: 'Porcentaje de compatibilidad entre dos nombres (siempre el mismo para la misma pareja).',
    params: [P('a', { required: true, example: 'Raiden' }), P('b', { required: true, example: 'Yae' })],
    handler: (q) => {
      const a = text(q, 'a', { max: 60 }).trim();
      const b = text(q, 'b', { max: 60 }).trim();
      const percent = seededPercent([a.toLowerCase(), b.toLowerCase()].sort().join('♡'));
      const verdict = percent >= 90 ? 'Almas gemelas 💍' : percent >= 70 ? 'Pareja ideal 💖' : percent >= 50 ? 'Hay química ✨' : percent >= 30 ? 'Amistad bonita 🤝' : 'Mejor como rivales ⚔️';
      const half = (s) => s.slice(0, Math.ceil(s.length / 2));
      return { a, b, percent, verdict, shipName: half(a) + b.slice(Math.floor(b.length / 2)).toLowerCase(), bar: `${'█'.repeat(Math.round(percent / 10))}${'░'.repeat(10 - Math.round(percent / 10))}` };
    },
  },
  {
    path: '/fun/dice', name: 'Tirar dados', category: 'Diversión', icon: '🎲',
    description: 'Lanza dados de N caras (ideal para partidas de rol).',
    params: [P('sides', { example: '20', description: '2 a 1000' }), P('count', { example: '2', description: '1 a 50' })],
    handler: (q) => {
      const sides = int(q, 'sides', { min: 2, max: 1000, fallback: 6 });
      const count = int(q, 'count', { min: 1, max: 50, fallback: 1 });
      const rolls = Array.from({ length: count }, () => randomInt(1, sides));
      return { notation: `${count}d${sides}`, rolls, total: rolls.reduce((s, n) => s + n, 0) };
    },
  },
  {
    path: '/fun/8ball', name: 'Bola 8 mágica', category: 'Diversión', icon: '🎱',
    description: 'Responde a una pregunta de sí o no.',
    params: [P('question', { required: true, example: '¿Ganaremos el torneo de rol?' })],
    handler: (q) => ({ question: text(q, 'question', { max: 300 }), answer: EIGHT_BALL[crypto.randomInt(EIGHT_BALL.length)] }),
  },
  {
    path: '/fun/coin', name: 'Cara o cruz', category: 'Diversión', icon: '🪙',
    description: 'Lanza una o varias monedas.',
    params: [P('count', { example: '1', description: '1 a 100' })],
    handler: (q) => {
      const count = int(q, 'count', { min: 1, max: 100, fallback: 1 });
      const flips = Array.from({ length: count }, () => (crypto.randomInt(2) ? 'cara' : 'cruz'));
      return { result: count === 1 ? flips[0] : flips, cara: flips.filter((f) => f === 'cara').length, cruz: flips.filter((f) => f === 'cruz').length };
    },
  },
  {
    path: '/generate/lorem', name: 'Lorem ipsum', category: 'Diversión', icon: '📝',
    description: 'Genera párrafos de texto de relleno.',
    params: [P('paragraphs', { example: '2', description: '1 a 10' })],
    handler: (q) => {
      const count = int(q, 'paragraphs', { min: 1, max: 10, fallback: 1 });
      return { result: Array.from({ length: count }, (_, i) => [0, 1, 2, 3].map((j) => LOREM[(i + j) % LOREM.length]).join(' ')) };
    },
  },

  /* ── Imágenes ──────────────────────────────────────────── */
  {
    path: '/generate/qr', name: 'Código QR', category: 'Imágenes', icon: '🔳',
    description: 'Genera un código QR en PNG o SVG.',
    response: 'image',
    params: [P('text', { required: true, example: 'https://github.com/lyanvalentinmail-prog/Project' }), P('size', { example: '400', description: '128 a 1024 px' }), P('format', { example: 'png', options: ['png', 'svg'] })],
    handler: async (q) => {
      const t = text(q, 'text', { max: 1500 });
      const size = int(q, 'size', { min: 128, max: 1024, fallback: 400 });
      const format = pick(q, 'format', ['png', 'svg'], 'png');
      const options = { width: size, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0d0c11', light: '#ffffff' } };
      if (format === 'svg') return { __binary: { type: 'image/svg+xml; charset=utf-8', body: await QRCode.toString(t, { ...options, type: 'svg' }) } };
      return { __binary: { type: 'image/png', body: await QRCode.toBuffer(t, options) } };
    },
  },
  {
    path: '/generate/logo', name: 'Logo con efecto', category: 'Imágenes', icon: '🖼️',
    description: `Genera un logo PNG con uno de los ${LOGO_EFFECT_IDS.length} efectos de los comandos .logo del bot.`,
    response: 'image',
    params: [P('text', { required: true, example: 'VERSOVA' }), P('effect', { example: 'logoneon', options: LOGO_EFFECT_IDS })],
    handler: (q) => {
      const t = text(q, 'text', { max: 40 });
      const effect = pick(q, 'effect', LOGO_EFFECT_IDS, 'logoneon');
      return { __binary: { type: 'image/png', body: renderLogoPng(effect, t) } };
    },
  },
  {
    path: '/generate/avatar', name: 'Avatar identicon', category: 'Imágenes', icon: '👤',
    description: 'Avatar SVG único y simétrico a partir de cualquier texto (nombre, email…).',
    response: 'image',
    params: [P('seed', { required: true, example: 'lyan' }), P('size', { example: '256', description: '64 a 1024 px' })],
    handler: (q) => ({ __binary: { type: 'image/svg+xml; charset=utf-8', body: identiconSvg(text(q, 'seed', { max: 200 }), int(q, 'size', { min: 64, max: 1024, fallback: 256 })) } }),
  },

  /* ── Validación e información ──────────────────────────── */
  {
    path: '/validate/email', name: 'Validar email', category: 'Validación', icon: '📧',
    description: 'Comprueba la sintaxis, detecta correos temporales y sugiere correcciones de dominio.',
    params: [P('email', { required: true, example: 'usuario@gmial.com' })],
    handler: (q) => {
      const email = text(q, 'email', { max: 254 }).trim().toLowerCase();
      const valid = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(email);
      const domain = email.split('@')[1] ?? '';
      let suggestion = null;
      if (valid && !COMMON_DOMAINS.includes(domain)) {
        const close = COMMON_DOMAINS.map((d) => [d, levenshtein(domain, d)]).sort((a, b) => a[1] - b[1])[0];
        if (close && close[1] <= 2) suggestion = `${email.split('@')[0]}@${close[0]}`;
      }
      return { email, valid, domain, disposable: DISPOSABLE.has(domain), suggestion };
    },
  },
  {
    path: '/validate/phone', name: 'Analizar teléfono', category: 'Validación', icon: '📱',
    description: 'Normaliza un número internacional, detecta el país y lo enmascara como hace el bot.',
    params: [P('number', { required: true, example: '+598 99 123 456' })],
    handler: (q) => {
      const raw = text(q, 'number', { max: 30 });
      const digits = raw.replace(/\D/g, '');
      const valid = digits.length >= 8 && digits.length <= 15;
      const match = COUNTRY_PREFIXES.find(([prefix]) => digits.startsWith(prefix));
      const masked = digits.length > 5 ? `${digits.slice(0, 2)}${'•'.repeat(digits.length - 4)}${digits.slice(-2)}` : digits;
      return { input: raw, valid, e164: valid ? `+${digits}` : null, countryCode: match ? `+${match[0]}` : null, country: match?.[1] ?? null, masked, whatsappJid: valid ? `${digits}@s.whatsapp.net` : null };
    },
  },
  {
    path: '/info/ip', name: 'Mi IP y navegador', category: 'Validación', icon: '🛰️',
    description: 'Devuelve la IP desde la que llamas, tu user-agent e idioma.',
    params: [],
    handler: (_q, req) => ({ ip: req.ip, userAgent: req.get('user-agent') ?? null, language: req.get('accept-language')?.split(',')[0] ?? null, protocol: req.protocol }),
  },

  /* ── Bot ───────────────────────────────────────────────── */
  {
    path: '/bot/status', name: 'Estado del bot', category: 'Bot VÉRSOVA', icon: '🤖',
    description: 'Estado real de la plataforma: sub-bots conectados, grupos y comandos (sin datos privados).',
    params: [],
    handler: (_q, _req, { manager }) => {
      const stats = manager?.stats?.() ?? {};
      return {
        bot: { name: IDENTITY.name, team: IDENTITY.team, version: IDENTITY.version },
        subBots: { total: stats.instances ?? 0, connected: stats.connected ?? 0, max: stats.maxInstances ?? 3 },
        groups: stats.groups ?? 0,
        commands: registry.count(),
        uptimeSec: Math.round(process.uptime()),
      };
    },
  },
  {
    path: '/bot/commands', name: 'Comandos del bot', category: 'Bot VÉRSOVA', icon: '📜',
    description: 'Lista de comandos de WhatsApp del bot, filtrable por categoría o búsqueda.',
    params: [P('category', { example: '', description: 'Categoría (opcional)' }), P('q', { example: 'rol', description: 'Búsqueda (opcional)' })],
    handler: (q) => {
      const category = String(q.category ?? '').trim().toLowerCase();
      const search = String(q.q ?? '').trim().toLowerCase();
      const list = registry.list
        .filter((c) => !c.hidden)
        .filter((c) => !category || String(c.category).toLowerCase() === category)
        .filter((c) => !search || `${c.name} ${(c.aliases ?? []).join(' ')} ${c.description ?? ''}`.toLowerCase().includes(search))
        .map((c) => ({ name: c.name, category: c.category, aliases: c.aliases ?? [], description: c.description ?? '' }));
      return { categories: registry.categories(), total: list.length, commands: list };
    },
  },
];

/** Metadatos públicos (sin handlers) para el panel. */
export function functionalCatalog() {
  const categories = new Map();
  for (const ep of FUNCTIONAL_ENDPOINTS) {
    if (!categories.has(ep.category)) categories.set(ep.category, { name: ep.category, icon: ep.icon, items: [] });
    categories.get(ep.category).items.push({
      name: ep.name,
      path: `/api/v1${ep.path}`,
      method: 'GET',
      icon: ep.icon,
      description: ep.description,
      response: ep.response ?? 'json',
      params: ep.params,
    });
  }
  return [...categories.values()].map((c) => ({ ...c, count: c.items.length }));
}

/* ═══════════════════════════════════════════════════════════════
   Autenticación por API key + límite de peticiones + registro
   ═══════════════════════════════════════════════════════════════ */

const windows = new Map();

function rateLimit(keyId) {
  const minute = Math.floor(Date.now() / 60_000);
  const entry = windows.get(keyId);
  if (!entry || entry.minute !== minute) {
    windows.set(keyId, { minute, count: 1 });
    if (windows.size > 10_000) windows.delete(windows.keys().next().value);
    return { remaining: RATE_LIMIT_PER_MINUTE - 1, allowed: true };
  }
  entry.count += 1;
  return { remaining: Math.max(0, RATE_LIMIT_PER_MINUTE - entry.count), allowed: entry.count <= RATE_LIMIT_PER_MINUTE };
}

export function apiKeyFrom(req) {
  const header = req.get('x-api-key');
  if (header) return header.trim();
  const auth = req.get('authorization') ?? '';
  if (auth.startsWith('Bearer vsk_')) return auth.slice(7).trim();
  const query = req.query.key ?? req.query.apikey;
  return query ? String(query).trim() : null;
}

export function requireApiKey(req, res, next) {
  const plain = apiKeyFrom(req);
  if (!plain) {
    return res.status(401).json({ ok: false, error: 'Falta la API key. Envíala como ?key=vsk_… o en la cabecera X-API-Key.', code: 'NO_KEY' });
  }
  const key = findKeyByPlaintext(plain);
  if (!key) return res.status(401).json({ ok: false, error: 'API key inválida.', code: 'INVALID_KEY' });
  const status = keyStatus(key);
  if (status === 'revoked') return res.status(401).json({ ok: false, error: 'Esta API key fue revocada.', code: 'REVOKED_KEY' });
  if (status === 'expired') {
    return res.status(401).json({ ok: false, error: `Esta API key caducó el ${new Date(key.expires_at).toISOString().slice(0, 10)}. Crea o renueva una (máximo 100 días).`, code: 'EXPIRED_KEY' });
  }
  const user = findUserById(key.user_id);
  if (!user) return res.status(401).json({ ok: false, error: 'La cuenta de esta API key ya no existe.', code: 'INVALID_KEY' });

  const isOwner = roleOf(user) === 'owner';
  if (!isOwner) {
    const limit = rateLimit(key.id);
    res.set('X-RateLimit-Limit', String(RATE_LIMIT_PER_MINUTE));
    res.set('X-RateLimit-Remaining', String(limit.remaining));
    if (!limit.allowed) {
      res.set('Retry-After', String(60 - (Math.floor(Date.now() / 1000) % 60)));
      return res.status(429).json({ ok: false, error: `Límite de ${RATE_LIMIT_PER_MINUTE} peticiones por minuto alcanzado.`, code: 'RATE_LIMIT' });
    }
  } else {
    res.set('X-RateLimit-Limit', 'unlimited');
  }

  req.apiKey = key;
  req.apiUser = user;
  const startedAt = Date.now();
  res.on('finish', () => {
    try {
      const db = getDb();
      db.prepare('UPDATE api_keys SET requests = requests + 1, last_used_at = ? WHERE id = ?').run(Date.now(), key.id);
      db.prepare('INSERT INTO api_usage (key_id, user_id, endpoint, status, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(key.id, user.id, `${req.baseUrl}${req.path}`, res.statusCode, Date.now() - startedAt, Date.now());
    } catch { /* el registro de uso nunca rompe la respuesta */ }
  });
  return next();
}

/* ═══════════════════════════════════════════════════════════════
   Router
   ═══════════════════════════════════════════════════════════════ */

export function createV1Router({ manager = null } = {}) {
  const router = express.Router();

  // CORS: la API se puede llamar desde cualquier web/bot con su API key
  router.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  });

  // índice público: qué endpoints hay y cómo autenticarse
  router.get('/', (_req, res) => {
    const categories = functionalCatalog();
    res.json({
      ok: true,
      name: `${IDENTITY.name} API`,
      version: 'v1',
      auth: 'API key obligatoria: ?key=vsk_… o cabecera X-API-Key. Créala en /endpoints → pestaña «Funcionales» (máx. 100 días).',
      rateLimitPerMinute: RATE_LIMIT_PER_MINUTE,
      total: FUNCTIONAL_ENDPOINTS.length,
      categories,
    });
  });

  for (const ep of FUNCTIONAL_ENDPOINTS) {
    router.get(ep.path, requireApiKey, async (req, res) => {
      try {
        const out = await ep.handler(req.query ?? {}, req, { manager });
        if (out?.__binary) {
          res.set('Content-Type', out.__binary.type);
          res.set('Cache-Control', 'no-store');
          return res.send(out.__binary.body);
        }
        return res.json({ ok: true, endpoint: `/api/v1${ep.path}`, ...out });
      } catch (error) {
        const status = error instanceof ApiError ? error.status : 500;
        return res.status(status).json({ ok: false, endpoint: `/api/v1${ep.path}`, error: status === 500 ? `Error interno: ${error?.message ?? 'desconocido'}` : error.message });
      }
    });
  }

  return router;
}

export default createV1Router;
