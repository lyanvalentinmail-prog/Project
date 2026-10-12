/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · validación de datos
 * ────────────────────────────────────────────────────────────────
 * Todo lo que entra desde WhatsApp pasa por aquí antes de tocar la
 * base de datos (seguridad #5). Ninguna función lanza: devuelven
 * `{ ok, value | reason }` para que el comando pueda responder bonito.
 */
import { CONFIG_KEYS } from '../config/defaults.js';
import { IDENTITY } from '../config/identity.js';
import { sanitizeText } from '../utils/text.js';
import { normalizeJid, isUserJid, isGroupJid } from '../utils/ids.js';

const ROLE_NAME_MAX = 32;
const REASON_MAX = 200;
const ANNOUNCEMENT_MAX = 1500;
const AFK_REASON_MAX = 120;

/** Nombre de personaje: letras, números, espacios y puntuación ligera. */
export function validateRoleName(input) {
  const raw = sanitizeText(input, ROLE_NAME_MAX + 10);
  if (!raw) return { ok: false, reason: 'Escribe el nombre del personaje.' };
  if (raw.length > ROLE_NAME_MAX) {
    return { ok: false, reason: `El nombre del personaje no puede superar ${ROLE_NAME_MAX} caracteres.` };
  }
  if (raw.startsWith(IDENTITY.prefix)) {
    return { ok: false, reason: 'El nombre del personaje no puede empezar con el prefijo.' };
  }
  if (!/^[\p{L}\p{N}\s._\-·'’]+$/u.test(raw)) {
    return { ok: false, reason: 'El personaje solo admite letras, números, espacios y . _ - ’' };
  }
  return { ok: true, value: raw.replace(/\s+/g, ' ').trim() };
}

/** Motivo libre (warn, afk, rechazo). */
export function validateReason(input, { max = REASON_MAX, required = false, label = 'motivo' } = {}) {
  const raw = sanitizeText(input, max);
  if (!raw) {
    return required ? { ok: false, reason: `Debes indicar un ${label}.` } : { ok: true, value: null };
  }
  return { ok: true, value: raw };
}

export const validateAfkReason = (input) => validateReason(input, { max: AFK_REASON_MAX, required: true, label: 'motivo de ausencia' });
export const validateAnnouncement = (input) => validateReason(input, { max: ANNOUNCEMENT_MAX, required: true, label: 'mensaje del anuncio' });

/** Motivo de rechazo de solicitud (opcional, se muestra al usuario). */
export const validateDenyReason = (input) => validateReason(input, { max: REASON_MAX, required: false, label: 'motivo' });

/** Valida un jid de usuario. */
export function validateUserJid(jid) {
  const normalized = normalizeJid(jid);
  if (!normalized) return { ok: false, reason: 'No pude identificar al usuario.' };
  if (!isUserJid(normalized)) return { ok: false, reason: 'Ese identificador no es un usuario de WhatsApp.' };
  return { ok: true, value: normalized };
}

export function validateGroupJid(jid) {
  const normalized = normalizeJid(jid);
  if (!normalized || !isGroupJid(normalized)) return { ok: false, reason: 'Ese identificador no es un grupo.' };
  return { ok: true, value: normalized };
}

/**
 * Resuelve el objetivo de un comando desde las menciones o desde un
 * argumento de texto (`@user`, número o respuesta a un mensaje).
 */
export function resolveTarget(ctx, { arg = null, allowQuoted = true } = {}) {
  const mentions = ctx.mentions ?? [];
  if (mentions.length === 1) return { ok: true, value: mentions[0], source: 'mention' };
  if (mentions.length > 1) return { ok: false, reason: 'Menciona a una sola persona para este comando.', code: 'MULTIPLE' };

  if (arg) {
    const digits = String(arg).replace(/[^\d]/g, '');
    if (digits.length >= 6) {
      const jid = normalizeJid(`${digits}@s.whatsapp.net`);
      return { ok: true, value: jid, source: 'number' };
    }
  }

  if (allowQuoted && ctx.quoted?.participant) {
    return { ok: true, value: normalizeJid(ctx.quoted.participant), source: 'quoted' };
  }

  return { ok: false, reason: 'Menciona a la persona con @ o responde a uno de sus mensajes.', code: 'NO_TARGET' };
}

/** Valida y convierte un valor de `.config <clave> <valor>`. */
export function validateConfigValue(key, rawValue) {
  const alias = String(key ?? '').toLowerCase().trim();
  const spec = CONFIG_KEYS[alias];
  if (!spec) {
    return { ok: false, reason: `Clave desconocida: ${key}. Usa .config sin argumentos para ver las disponibles.` };
  }
  const raw = String(rawValue ?? '').trim();

  if (spec.type === 'int') {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return { ok: false, reason: `${spec.label} debe ser un número entero.` };
    if (n < spec.min || n > spec.max) {
      return { ok: false, reason: `${spec.label} debe estar entre ${spec.min} y ${spec.max}.` };
    }
    return { ok: true, field: spec.field, value: n, label: spec.label, display: String(n) };
  }

  if (spec.type === 'bool') {
    const lower = raw.toLowerCase();
    if (!['on', 'off', 'true', 'false', '1', '0', 'si', 'no', 'sí'].includes(lower)) {
      return { ok: false, reason: `${spec.label} acepta: si / no.` };
    }
    const value = ['on', 'true', '1', 'si', 'sí'].includes(lower);
    return { ok: true, field: spec.field, value, label: spec.label, display: value ? 'activado' : 'desactivado' };
  }

  if (spec.type === 'char') {
    const value = raw.charAt(0);
    if (!value || /[\p{L}\p{N}]/u.test(value)) {
      return { ok: false, reason: 'El prefijo debe ser un símbolo (por ejemplo . , ! # $ )' };
    }
    return { ok: true, field: spec.field, value, label: spec.label, display: value };
  }

  return { ok: false, reason: 'Tipo de configuración no soportado.' };
}

/** Sanitiza texto que se mostrará dentro de un mensaje del bot (evita romper el diseño). */
export function safeInline(input, max = 60) {
  return sanitizeText(input, max).replace(/[│├╰╭─┈]/g, ' ');
}
