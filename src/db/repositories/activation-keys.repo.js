/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · claves de activación (`.key` en WhatsApp → panel)
 * ────────────────────────────────────────────────────────────────
 * El usuario envía `.key` a cualquier bot conectado de la plataforma;
 * el bot le devuelve una clave de un solo uso. El panel la canjea para
 * activar el sub-bot. Todo vive en la base de datos.
 */
import crypto from 'node:crypto';
import { getDb } from '../connection.js';

const TABLE = 'activation_keys';

/** 10 minutos: tiempo razonable para copiar la clave de WhatsApp al panel. */
export const KEY_TTL_MS = 10 * 60_000;

/** Alfabeto sin letras/niños confusos (sin 0/O, 1/I/L). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode() {
  let code = '';
  while (code.length < 8) {
    const byte = crypto.randomBytes(1)[0];
    if (byte >= ALPHABET.length) continue;
    code += ALPHABET[byte];
  }
  return code;
}

/** `ABCD2345` → `ABCD-2345` para mostrar/copy. */
export const formatKey = (code) => (code ? `${code.slice(0, 4)}-${code.slice(4, 8)}` : null);

/**
 * Normaliza lo que teclea el usuario: acepta `ABCD-2345`, `KEY-ABCD-2345`,
 * `abcd 2345`… Devuelve el cuerpo de 8 caracteres o null.
 */
export function normalizeKey(input) {
  let raw = String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.startsWith('KEY')) raw = raw.slice(3);
  if (raw.length !== 8) return null;
  if (![...raw].every((ch) => ALPHABET.includes(ch))) return null;
  return raw;
}

export const activationKeysRepo = {
  /** Genera una clave nueva (o devuelve la vigente del usuario si ya tiene una). */
  create({ creatorJid = null, instanceId = null, ttlMs = KEY_TTL_MS } = {}) {
    this.purgeExpired();
    if (creatorJid) {
      const existing = getDb()
        .prepare(
          `SELECT * FROM ${TABLE}
            WHERE creator_jid = ? AND used_at IS NULL AND expires_at > ?
            ORDER BY created_at DESC LIMIT 1`
        )
        .get(creatorJid, Date.now());
      if (existing) return { code: existing.code, formatted: formatKey(existing.code), expiresAt: existing.expires_at, reused: true };
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = randomCode();
      const now = Date.now();
      const expiresAt = now + ttlMs;
      try {
        getDb()
          .prepare(
            `INSERT INTO ${TABLE} (code, creator_jid, creator_instance, created_at, expires_at)
             VALUES (@code, @creatorJid, @creatorInstance, @now, @expiresAt)`
          )
          .run({ code, creatorJid, creatorInstance: instanceId, now, expiresAt });
        return { code, formatted: formatKey(code), expiresAt, reused: false };
      } catch {
        /* colisión de código: se reintenta */
      }
    }
    return null;
  },

  /** Clave válida (existe, sin usar y sin caducar) o null. */
  findValid(input) {
    const code = normalizeKey(input);
    if (!code) return null;
    return (
      getDb()
        .prepare(`SELECT * FROM ${TABLE} WHERE code = ? AND used_at IS NULL AND expires_at > ?`)
        .get(code, Date.now()) ?? null
    );
  },

  /**
   * Canjea una clave para una instancia.
   * @returns {{ok:true, row:object} | {ok:false, reason:string}}
   */
  redeem(input, instanceId) {
    const code = normalizeKey(input);
    if (!code) {
      return { ok: false, reason: 'La clave no tiene un formato válido. Copia la clave tal cual la envió el bot (ej. ABCD-2345).' };
    }
    const row = getDb().prepare(`SELECT * FROM ${TABLE} WHERE code = ?`).get(code);
    if (!row) return { ok: false, reason: 'Esa clave no existe. Envía .key desde WhatsApp para obtener una nueva.' };
    if (row.used_at) return { ok: false, reason: 'Esa clave ya fue usada. Envía .key desde WhatsApp para obtener una nueva.' };
    if (row.expires_at <= Date.now()) return { ok: false, reason: 'Esa clave caducó. Envía .key desde WhatsApp para obtener una nueva.' };

    getDb()
      .prepare(`UPDATE ${TABLE} SET used_at = ?, used_by_instance = ? WHERE code = ?`)
      .run(Date.now(), instanceId, code);
    return { ok: true, row: { ...row, used_at: Date.now(), used_by_instance: instanceId } };
  },

  /** Borra claves caducadas que nunca se usaron (limpieza). */
  purgeExpired() {
    getDb().prepare(`DELETE FROM ${TABLE} WHERE expires_at <= ? AND used_at IS NULL`).run(Date.now());
  },

  count() {
    return Number(getDb().prepare(`SELECT COUNT(*) AS n FROM ${TABLE} WHERE used_at IS NULL`).get().n);
  },
};

export default activationKeysRepo;
