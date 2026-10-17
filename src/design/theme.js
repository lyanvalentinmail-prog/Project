/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · tema visual
 * ────────────────────────────────────────────────────────────────
 * Estética: dark, elegante, minimalista, con símbolos japoneses,
 * kaomojis, detalles de café y decoraciones Unicode.
 *
 * De aquí salen TODOS los adornos. Las plantillas (templates.js)
 * los combinan de forma distinta según la acción, para que ningún
 * mensaje del bot se vea igual que otro.
 */
import { IDENTITY } from '../config/identity.js';

/* ── símbolos base ───────────────────────────────────────────── */

export const SYM = Object.freeze({
  crown: '࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙',
  crownSmall: '࿙ׄ࿚',
  bracketL: '𓆩',
  bracketR: '𓆪',
  purify: '禊',
  curse: '禍',
  coffee: '☕',
  chopsticks: '🥢',
  chain: '⛓️',
  heart: '♡',
  clover: '୨ৎ',
  star: '𖤐',
  leaf: '𖦹',
  scroll: '𓂃',
  moon: '☾',
  sun: '☀',
  arrow: '➢',
  diamond: '◈',
  cross: '⸸',
  dot: '⁙',
  bar: 'ㅤ',
  corner: ['◢', '◣'],
  kana: ['禍', '禊', '乂', '卍', '零', '夜', '夢', '影', '愛', '珈'],
});

/** Adornos de una sola línea para separar bloques. */
export const RULE = Object.freeze({
  thin: '──────────────────────',
  dotted: '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈',
  wave: '︵‿︵‿︵‿︵‿︵‿︵‿︵',
  coffee: '༘⋆ ☕ ༘⋆ ☕ ༘⋆ ☕ ༘⋆',
  chain: '⛓️┄┄┄┄┄┄┄┄┄┄⛓️',
  sakura: '✿┈┈┈┈┈┈┈┈┈┈┈┈✿',
  night: '☾ ⋆ ⁺ ₊ ⋆ ☁︎ ⋆ ⁺ ₊ ⋆ ☾',
  blade: '╰┈➤ ┈┈┈┈┈┈┈ ┈➤╮',
});

/** Kaomojis agrupados por emoción (uno distinto por plantilla). */
export const KAOMOJI = Object.freeze({
  happy: '( ᵕ ᴗ ᵕ )♡',
  wink: '(｡•̀ᴗ-)✧',
  cheer: '(๑˃̵ᴗ˂̵)و',
  cat: '( ੭ ˙ᗜ˙ )੭',
  hug: '(づ๑•ᴗ•๑)づ♡',
  soft: '(˶ᵔ ᵕ ᵔ˶) .ᐟ',
  shy: '(˶˃ ᵕ ˂˶)',
  cozy: '(っ˘ω˘ς)',
  serious: '( •̀ - •́ )✧',
  sad: '(˘･_･˘)',
  dead: '(x_x)',
  cool: '(⌐■_■)',
  sleep: '(。-ω-)zzz',
  sparkle: '(*˘︶˘*).｡*:♡',
  angry: '(╬ Ò﹏Ó)',
  neutral: '( ᴗ͈ˬᴗ͈)',
  love: '(⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)',
  smug: '(¬‿¬)',
  panic: '(°ロ°) !',
});

/* ── constructores reutilizables ─────────────────────────────── */

/**
 * Prefijo con el que se renderiza el mensaje actual. Cada sub-bot
 * puede elegir su prefijo (# - + . /); el router lo fija antes de
 * componer la respuesta para que los mensajes lo muestren real.
 */
let renderPrefix = IDENTITY.prefix;
export function setRenderPrefix(prefix) {
  renderPrefix = prefix ? String(prefix) : IDENTITY.prefix;
  return renderPrefix;
}
export function currentPrefix() {
  return renderPrefix;
}

/** Encabezado oficial del bot (el que definiste para VÉRSOVA). */
export function versovaHeader({ subtitle = '( ᵕ ᴗ ᵕ )♡', symbol = SYM.purify } = {}) {
  return [
    `ㅤㅤ${SYM.crown}`,
    `ㅤㅤㅤ${SYM.bracketL}ㅤ${symbol}ㅤ${SYM.bracketR}`,
    `ㅤㅤ𝑽 𝑬́ 𝑹 𝑺 𝑶 𝑽 𝑨`,
    `ㅤㅤㅤ${subtitle}`,
  ].join('\n');
}

/** Cabecera compacta para respuestas cortas. */
export function miniHeader(title, icon = SYM.coffee) {
  return `${SYM.bracketL} ${icon} ${SYM.bracketR}  ${title}`;
}

/** Etiqueta de sección: `⸸ 〃 ~REGISTRO~ 〃` */
export function section(title, mark = SYM.cross) {
  return `${mark}ㅤ׃ㅤ ~${title}~ ㅤ׃`;
}

/** Línea clave-valor con el adorno del menú. */
export const kv = (label, value) => `ㅤ${SYM.leaf}ㅤ${label}ㅤ${SYM.dot}ㅤ${value ?? '—'}`;

/** Fila de una lista numerada o con viñeta. */
export const bullet = (text, icon = SYM.leaf) => `ㅤ${icon}ㅤ${text}`;

/** Comando decorado: `୨ৎ .reg <nombre.edad>` (con el prefijo real del bot) */
export const cmd = (name, args = '') => `ㅤ${SYM.clover}ㅤ${renderPrefix}${name}${args ? ` ${args}` : ''}`;

/** Comando sin sangrado (para líneas sueltas dentro de un bloque). */
export const inlineCmd = (name, args = '') => `${SYM.clover} ${renderPrefix}${name}${args ? ` ${args}` : ''}`;

/** Pie de página con la firma del team. */
export function footer({ kaomoji = KAOMOJI.neutral, note = null } = {}) {
  const lines = [];
  if (note) lines.push(`ㅤㅤ${note}`);
  lines.push(`ㅤㅤ${kaomoji}`);
  lines.push(`ㅤㅤ${SYM.crown}`);
  return lines.join('\n');
}

/** Firma corta para cerrar mensajes pequeños. */
export const signature = (kaomoji = KAOMOJI.neutral) =>
  `ㅤ⌞ㅤ≪⁹⁹ㅤ⁙ㅤ𝐕𝐄́𝐑𝐒𝐎𝐕𝐀ㅤ${kaomoji}`;

/** Marco completo: encabezado + cuerpo + pie. */
export function frame({ title, icon = SYM.coffee, body, kaomoji = KAOMOJI.neutral, footerNote = null, top = SYM.crown }) {
  return [
    `ㅤㅤ${top}`,
    `ㅤㅤ${SYM.bracketL} ${icon} ${SYM.bracketR}`,
    title ? `ㅤㅤ${title}` : null,
    RULE.thin,
    body,
    RULE.thin,
    footer({ kaomoji, note: footerNote }),
  ]
    .filter((line) => line !== null && line !== undefined)
    .join('\n');
}

/** Bloque de estado (éxito / error / aviso) con icono propio. */
export function statusLine(kind, text) {
  const icons = {
    ok: '𓆩 ✓ 𓆪',
    error: '𓆩 ✗ 𓆪',
    warn: '𓆩 ⚠ 𓆪',
    info: '𓆩 ☕ 𓆪',
    wait: '𓆩 ⏳ 𓆪',
    love: '𓆩 ♡ 𓆪',
    ban: '𓆩 禊 𓆪',
    night: '𓆩 ☾ 𓆪',
    sun: '𓆩 ☀ 𓆪',
    role: '𓆩 🥢 𓆪',
    staff: '𓆩 ⛓️ 𓆪',
  };
  return `${icons[kind] ?? icons.info} ${text}`;
}

/** Progreso visual en bloques (para compatibilidad, carga, warns…). */
export function bar(value, total = 10, filled = '█', empty = '░') {
  const ratio = Math.max(0, Math.min(1, Number(value) / Number(total)));
  const size = Math.round(ratio * total);
  return filled.repeat(size) + empty.repeat(total - size);
}

/** Números estilizados para títulos de sección del menú. */
export function fancyNumber(n) {
  const digits = { 0: '𝟎', 1: '𝟏', 2: '𝟐', 3: '𝟑', 4: '𝟒', 5: '𝟓', 6: '𝟔', 7: '𝟕', 8: '𝟖', 9: '𝟗' };
  const value = Math.max(1, Number(n) || 1);
  const padded = value < 10 ? `0${value}` : String(value);
  return [...padded].map((d) => digits[d] ?? d).join('');
}

/** Letra capitular decorativa para títulos. */
export const gothic = (text) => `~${String(text).toUpperCase()}~`;

/** Mención de WhatsApp (el cliente la convierte en @nombre). */
export const mention = (jid) => `@${String(jid ?? '').split('@')[0]}`;

export default { SYM, RULE, KAOMOJI, versovaHeader, miniHeader, section, kv, bullet, cmd, inlineCmd, footer, signature, frame, statusLine, bar, fancyNumber, gothic, mention };
