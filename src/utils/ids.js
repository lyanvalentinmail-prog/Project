/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · utilidades de identificadores
 * ────────────────────────────────────────────────────────────────
 * Este módulo NO importa nada del proyecto (cero ciclos).
 */
import crypto from 'node:crypto';

export const S_WHATSAPP = '@s.whatsapp.net';
export const G_US = '@g.us';
export const LID = '@lid';
export const BROADCAST = '@broadcast';

/** ¿Es el jid de un grupo? */
export const isGroupJid = (jid) => typeof jid === 'string' && jid.endsWith(G_US);

/** ¿Es un chat privado (1 a 1)? */
export const isUserJid = (jid) => typeof jid === 'string' && jid.endsWith(S_WHATSAPP);

/** Quita ruido y devuelve el jid en su forma canónica. */
export function normalizeJid(jid) {
  if (!jid) return null;
  let raw = String(jid).trim();
  if (!raw) return null;
  if (!raw.includes('@')) raw = `${raw.replace(/[^\d]/g, '')}${S_WHATSAPP}`;
  return raw.toLowerCase().replace(/:\d+@/, '@');
}

/** Convierte un número ("+52 1 55 1234 5678") en jid de WhatsApp. */
export function phoneToJid(input) {
  if (!input) return null;
  const raw = String(input).trim();
  if (raw.includes('@')) return normalizeJid(raw);
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length < 6 || digits.length > 20) return null;
  return `${digits}${S_WHATSAPP}`;
}

/** Extrae los dígitos del teléfono desde un jid (null si es grupo). */
export function jidToPhone(jid) {
  const normalized = normalizeJid(jid);
  if (!normalized || !isUserJid(normalized)) return null;
  return normalized.split('@')[0];
}

/**
 * Enmascara un número para mensajes públicos: `52•••••••78`.
 * Requisito de seguridad #11: nunca exponer el teléfono completo en el grupo.
 */
export function maskPhone(jidOrPhone, visibleStart = 2, visibleEnd = 2) {
  const phone = jidToPhone(jidOrPhone) ?? String(jidOrPhone ?? '').replace(/[^\d]/g, '');
  if (!phone) return '—';
  if (phone.length <= visibleStart + visibleEnd + 1) {
    return `${phone.slice(0, 2)}${'•'.repeat(Math.max(2, phone.length - 2))}`;
  }
  const hidden = Math.max(3, phone.length - visibleStart - visibleEnd);
  return `${phone.slice(0, visibleStart)}${'•'.repeat(hidden)}${phone.slice(-visibleEnd)}`;
}

/** Nombre corto legible para logs y perfiles (nunca el número completo). */
export function shortJid(jid) {
  const normalized = normalizeJid(jid) ?? '';
  if (isGroupJid(normalized)) return `grupo:${normalized.slice(0, 8)}…`;
  return maskPhone(normalized);
}

/** Identificador aleatorio corto y URL-safe (para instancias y confirmaciones). */
export function newId(size = 12) {
  return crypto.randomBytes(size).readUintBE(0, 6).toString(36).padStart(10, '0').slice(0, size);
}

/** Compara dos jids ignorando el sufijo de dispositivo. */
export function sameUser(a, b) {
  const na = normalizeJid(a);
  const nb = normalizeJid(b);
  if (!na || !nb) return false;
  return na.split('@')[0] === nb.split('@')[0] && na.split('@')[1] === nb.split('@')[1];
}
