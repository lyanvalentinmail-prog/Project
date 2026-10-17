/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · repositorio de sub-bots (instancias)
 */
import { getDb } from '../connection.js';
import { newId } from '../../utils/ids.js';

const TABLE = 'bot_instances';

/** Prefijos de comando que un sub-bot puede elegir. */
export const ALLOWED_PREFIXES = Object.freeze(['#', '-', '+', '.', '/']);

/** Normaliza y valida un prefijo. Devuelve `{ ok, value }` o `{ ok, reason }`. */
export function normalizePrefix(input, fallback = '.') {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: true, value: fallback };
  if (ALLOWED_PREFIXES.includes(raw)) return { ok: true, value: raw };
  return {
    ok: false,
    reason: `El prefijo debe ser uno de: ${ALLOWED_PREFIXES.join('  ')} (recibido "${raw.slice(0, 4)}").`,
  };
}

/** Máximo de números con acceso staff por sub-bot. */
export const MAX_INSTANCE_ADMINS = 50;

/**
 * Números internacionales (8–20 dígitos, sin 0 inicial).
 * Acepta una lista de textos o números separados por comas/saltos de línea.
 * Solo se quita formato telefónico: nunca letras, JIDs ni extensiones.
 */
export function normalizeAdminNumbers(input) {
  if (typeof input !== 'string' && !Array.isArray(input)) {
    return { ok: false, reason: 'Los admins deben ser una lista de números o texto separado por comas o saltos de línea.' };
  }
  const entries = Array.isArray(input) ? input : input.split(/[,;\r\n]+/);
  const numbers = new Set();
  for (const [index, entry] of entries.entries()) {
    if (typeof entry !== 'string') {
      return { ok: false, reason: `El número de admin en la entrada ${index + 1} debe ser texto con código de país.` };
    }
    const raw = entry.trim();
    if (!raw) continue;
    const digits = raw.replace(/\D/g, '');
    if (!/^\+?[\d ().\t-]+$/.test(raw) || !/^[1-9]\d{7,19}$/.test(digits)) {
      return {
        ok: false,
        reason: `Número de admin inválido en la entrada ${index + 1}. Usa de 8 a 20 dígitos con código de país, sin 0 inicial (ej. +598 99 123 456).`,
      };
    }
    numbers.add(digits);
    if (numbers.size > MAX_INSTANCE_ADMINS) {
      return { ok: false, reason: `Puedes agregar hasta ${MAX_INSTANCE_ADMINS} números de admins por bot.` };
    }
  }
  return { ok: true, value: [...numbers] };
}

/** El repositorio expone una lista, no JSON crudo; datos corruptos no dan permisos. */
function withAdminNumbers(row) {
  if (!row) return null;
  let adminNumbers = [];
  try {
    const stored = JSON.parse(row.admin_numbers ?? '[]');
    const check = Array.isArray(stored) ? normalizeAdminNumbers(stored) : null;
    if (check?.ok) adminNumbers = check.value;
  } catch { /* lista inválida: sin admins configurados */ }
  // menu_style y custom_config (nuevo en v6) con defaults seguros
  const menu_style = row.menu_style || 'versova';
  let custom_config = '{}';
  try {
    // si es null o inválido, normalizar
    if (row.custom_config == null) custom_config = '{}';
    else {
      JSON.parse(row.custom_config);
      custom_config = row.custom_config;
    }
  } catch { custom_config = '{}'; }
  return { ...row, admin_numbers: adminNumbers, menu_style, custom_config };
}

export const instancesRepo = {
  /**
   * Crea una instancia habilitada, pendiente de vincular con WhatsApp.
   */
  create({
    name,
    phone,
    pairingMode = 'qr',
    sessionDir,
    prefix = '.',
    activated = true,
    autostart = false,
  }) {
    const id = newId(10);
    const now = Date.now();
    getDb()
      .prepare(
        `INSERT INTO ${TABLE}
           (id, name, phone, pairing_mode, status, session_dir, prefix, activated, activated_at, autostart, created_at, updated_at)
         VALUES (@id, @name, @phone, @pairingMode, 'created', @sessionDir, @prefix, @activated, @activatedAt, @autostart, @now, @now)`
      )
      .run({
        id,
        name,
        phone,
        pairingMode,
        sessionDir,
        prefix,
        activated: activated ? 1 : 0,
        activatedAt: activated ? now : null,
        autostart: autostart ? 1 : 0,
        now,
      });
    return this.byId(id);
  },

  byId(id) {
    return withAdminNumbers(getDb().prepare(`SELECT * FROM ${TABLE} WHERE id = ?`).get(id));
  },

  byPhone(phone) {
    return withAdminNumbers(getDb().prepare(`SELECT * FROM ${TABLE} WHERE phone = ?`).get(String(phone)));
  },

  all() {
    return getDb().prepare(`SELECT * FROM ${TABLE} ORDER BY created_at ASC`).all().map(withAdminNumbers);
  },

  count() {
    return Number(getDb().prepare(`SELECT COUNT(*) AS n FROM ${TABLE}`).get().n);
  },

  /** Estado de conexión en vivo (created|starting|qr|pairing|connecting|open|closed|error|loggedOut). */
  setStatus(id, status, extra = {}) {
    getDb()
      .prepare(
        `UPDATE ${TABLE} SET status = @status, updated_at = @now,
           wa_jid = COALESCE(@waJid, wa_jid),
           push_name = COALESCE(@pushName, push_name),
           last_error = COALESCE(@lastError, last_error),
           last_connected_at = CASE WHEN @connected = 1 THEN @now ELSE last_connected_at END
         WHERE id = @id`
      )
      .run({
        id,
        status,
        now: Date.now(),
        waJid: extra.waJid ?? null,
        pushName: extra.pushName ?? null,
        lastError: extra.lastError ?? null,
        connected: status === 'open' ? 1 : 0,
      });
  },

  setAutostart(id, value) {
    getDb()
      .prepare(`UPDATE ${TABLE} SET autostart = ?, updated_at = ? WHERE id = ?`)
      .run(value ? 1 : 0, Date.now(), id);
  },

  rename(id, name) {
    getDb()
      .prepare(`UPDATE ${TABLE} SET name = ?, updated_at = ? WHERE id = ?`)
      .run(String(name).slice(0, 40), Date.now(), id);
  },

  setPrefix(id, prefix) {
    getDb()
      .prepare(`UPDATE ${TABLE} SET prefix = ?, updated_at = ? WHERE id = ?`)
      .run(prefix, Date.now(), id);
  },

  /** Reemplaza el staff del sub-bot; una lista vacía revoca solo estos permisos. */
  setAdminNumbers(id, numbers) {
    const check = normalizeAdminNumbers(numbers);
    if (!check.ok) throw new TypeError(check.reason);
    getDb()
      .prepare(`UPDATE ${TABLE} SET admin_numbers = ?, updated_at = ? WHERE id = ?`)
      .run(JSON.stringify(check.value), Date.now(), id);
  },

  /** Actualiza el indicador de habilitación (compatibilidad con instancias antiguas). */
  setActivated(id, value = true) {
    getDb()
      .prepare(
        `UPDATE ${TABLE} SET activated = ?, activated_at = CASE WHEN ? = 1 THEN ? ELSE activated_at END, updated_at = ? WHERE id = ?`
      )
      .run(value ? 1 : 0, value ? 1 : 0, Date.now(), Date.now(), id);
  },

  remove(id) {
    return getDb().prepare(`DELETE FROM ${TABLE} WHERE id = ?`).run(id).changes;
  },

  setMenuStyle(id, style) {
    getDb().prepare(`UPDATE ${TABLE} SET menu_style = ?, updated_at = ? WHERE id = ?`).run(String(style), Date.now(), id);
  },
  setCustomConfig(id, json) {
    const str = typeof json === 'string' ? json : JSON.stringify(json);
    getDb().prepare(`UPDATE ${TABLE} SET custom_config = ?, updated_at = ? WHERE id = ?`).run(str, Date.now(), id);
  },
  getCustomConfig(id) {
    const row = this.byId(id);
    if (!row) return null;
    try { return JSON.parse(row.custom_config || '{}'); } catch { return {}; }
  },
};
