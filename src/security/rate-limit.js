/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · límites de uso (anti-spam)
 * ────────────────────────────────────────────────────────────────
 * Dos capas:
 *   1. Cubeta por usuario/grupo: N comandos cada X ms.
 *   2. Enfriamiento por comando concreto (los caros, como .team).
 * Además se limpia sola la memoria de claves viejas.
 * Requisito de seguridad #9.
 */
import { env } from '../config/env.js';

/** Enfriamientos especiales por comando (ms). El resto usa 0. */
const COMMAND_COOLDOWN = Object.freeze({
  team: 10_000,
  miembros: 8_000,
  roles: 8_000,
  inactivos: 10_000,
  reglas: 8_000,
  menu: 5_000,
  ship: 4_000,
  anuncio: 20_000,
  add: 15_000,
  expulsar: 10_000,
  ban: 10_000,
});

const BLOCK_MS = 30_000;
const buckets = new Map(); // key → { tokens, updatedAt, blockedUntil, strikes }
const cooldowns = new Map(); // key → lastRunAt

const bucketKey = (groupId, jid) => `${groupId ?? 'dm'}:${jid}`;
const cooldownKey = (groupId, jid, command) => `${groupId ?? 'dm'}:${jid}:${command}`;

/**
 * Comprueba (y consume) el permiso para ejecutar un comando.
 * @returns {{allowed:boolean, retryInMs:number, blocked:boolean, reason?:string}}
 */
export function checkRateLimit({ groupId, jid, command, max = env.rateLimitMax, windowMs = env.rateLimitWindowMs }) {
  const now = Date.now();
  const key = bucketKey(groupId, jid);
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: max, updatedAt: now, blockedUntil: 0, strikes: 0 };
    buckets.set(key, bucket);
  }

  // bloqueo temporal vigente
  if (bucket.blockedUntil > now) {
    return { allowed: false, blocked: true, retryInMs: bucket.blockedUntil - now };
  }

  // regeneración de tokens
  const elapsed = now - bucket.updatedAt;
  if (elapsed > 0) {
    const refill = (elapsed / windowMs) * max;
    bucket.tokens = Math.min(max, bucket.tokens + refill);
    bucket.updatedAt = now;
  }

  if (bucket.tokens < 1) {
    bucket.strikes += 1;
    if (bucket.strikes >= 2) {
      bucket.blockedUntil = now + BLOCK_MS;
      bucket.strikes = 0;
      return { allowed: false, blocked: true, retryInMs: BLOCK_MS };
    }
    const retryInMs = Math.ceil(((1 - bucket.tokens) / max) * windowMs);
    return { allowed: false, blocked: false, retryInMs };
  }

  bucket.tokens -= 1;

  // enfriamiento específico del comando
  const cdMs = COMMAND_COOLDOWN[command] ?? 0;
  if (cdMs) {
    const last = cooldowns.get(cooldownKey(groupId, jid, command)) ?? 0;
    if (now - last < cdMs) {
      bucket.tokens += 1; // no se gasta el token si el comando está en cooldown
      return { allowed: false, blocked: false, retryInMs: cdMs - (now - last) };
    }
    cooldowns.set(cooldownKey(groupId, jid, command), now);
  }

  return { allowed: true, retryInMs: 0, blocked: false };
}

/** Reinicia cubeta y enfriamientos de un usuario (p. ej. tras un warn). */
export function resetUser(groupId, jid) {
  buckets.delete(bucketKey(groupId, jid));
  const prefix = `${bucketKey(groupId, jid)}:`;
  for (const key of cooldowns.keys()) {
    if (key.startsWith(prefix)) cooldowns.delete(key);
  }
}

/** Liberación de memoria: borra claves inactivas. */
export function sweep(idleMs = 5 * 60_000) {
  const cutoff = Date.now() - idleMs;
  let removed = 0;
  for (const [key, bucket] of buckets) {
    if (bucket.updatedAt < cutoff && bucket.blockedUntil < Date.now()) {
      buckets.delete(key);
      removed += 1;
    }
  }
  for (const [key, ts] of cooldowns) {
    if (ts < cutoff) {
      cooldowns.delete(key);
      removed += 1;
    }
  }
  return removed;
}

export const stats = () => ({ buckets: buckets.size, cooldowns: cooldowns.size });

export default { checkRateLimit, resetUser, sweep, stats, COMMAND_COOLDOWN };
