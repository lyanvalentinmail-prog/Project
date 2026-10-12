/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · utilidades de texto y parseo
 * ────────────────────────────────────────────────────────────────
 * Aquí vive el parser de `.reg <nombre.edad>` y la limpieza de todo
 * texto que entra desde WhatsApp (requisito de seguridad #5).
 */

/** Límite práctico de WhatsApp; dejamos margen por si se añade texto. */
export const WA_MESSAGE_LIMIT = 3800;

const NAME_MAX = 24;
const AGE_MIN = 5;
const AGE_MAX = 99;

/** Elimina caracteres de control y normaliza espacios. */
export function sanitizeText(input, max = 200) {
  if (input === null || input === undefined) return '';
  return String(input)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

/** Rechaza texto que parezca inyección de comandos o spam de símbolos. */
export function isSafeName(name) {
  if (!name) return false;
  if (name.length > NAME_MAX) return false;
  if (/[\n\r\t]/.test(name)) return false;
  if (name.startsWith('.')) return false; // evitar nombres que parezcan comandos
  // letras (incluye acentos/ñ), dígitos, espacios y puntuación decorativa básica
  return /^[\p{L}\p{N}\s._\-·'’♡☆*+]+$/u.test(name);
}

/**
 * Parsea `<nombre>.<edad>`.
 * `Moon.17` → { name: 'Moon', age: 17 }
 * `Ana.Sofia.18` → { name: 'Ana.Sofia', age: 18 }  (se corta por el ÚLTIMO punto)
 *
 * @returns {{ok:true,name:string,age:number}|{ok:false,reason:string,code:string}}
 */
export function parseNameAge(rawInput) {
  const input = sanitizeText(rawInput, 60);
  if (!input) return { ok: false, code: 'EMPTY', reason: 'No enviaste nada después del comando.' };

  // corta por el último punto: "Ana.Sofia.18" → nombre "Ana.Sofia", edad 18
  const match = /^(.+?)\s*\.\s*(\d{1,3})$/.exec(input);
  if (!match) {
    return {
      ok: false,
      code: 'FORMAT',
      reason: 'El formato correcto es nombre.edad (ejemplo: Moon.17).',
    };
  }

  if (match[1].trim().length > NAME_MAX) {
    return {
      ok: false,
      code: 'NAME_TOO_LONG',
      reason: `El nombre no puede superar ${NAME_MAX} caracteres.`,
    };
  }

  const name = sanitizeText(match[1], NAME_MAX);
  const age = Number.parseInt(match[2], 10);

  if (!name) return { ok: false, code: 'EMPTY_NAME', reason: 'El nombre no puede estar vacío.' };
  if (!isSafeName(name)) {
    return {
      ok: false,
      code: 'INVALID_NAME',
      reason: `El nombre solo admite letras, números y espacios (máx. ${NAME_MAX} caracteres).`,
    };
  }
  if (!Number.isFinite(age) || age < AGE_MIN || age > AGE_MAX) {
    return {
      ok: false,
      code: 'INVALID_AGE',
      reason: `La edad debe ser un número entre ${AGE_MIN} y ${AGE_MAX}.`,
    };
  }

  return { ok: true, name, age };
}

/** Divide el argumento de un comando respetando comillas: `.anuncio "hola a todos" x` */
export function splitArgs(input) {
  const text = String(input ?? '').trim();
  if (!text) return [];
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

/** Une argumentos sueltos en una sola frase (para motivos/anuncios). */
export const joinArgs = (args) => sanitizeText((args ?? []).join(' '), 500);

/** Corta un texto largo en fragmentos seguros para WhatsApp. */
export function chunkText(text, max = WA_MESSAGE_LIMIT) {
  const full = String(text ?? '');
  if (full.length <= max) return [full];
  const chunks = [];
  let rest = full;
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max);
    if (cut < max * 0.5) cut = max;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n+/, '');
  }
  if (rest.length) chunks.push(rest);
  return chunks;
}

/** Trunca con puntos suspensivos. */
export function truncate(text, max = 30) {
  const s = String(text ?? '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Ordena por nombre ignorando mayúsculas. */
export const byName = (a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'es', { sensitivity: 'base' });
