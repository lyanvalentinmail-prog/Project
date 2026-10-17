/**
 *  VÉRSOVA · personalización por bot
 * ────────────────────────────────────────────────────────────────
 * Alias extra, comandos habilitados/deshabilitados, categorías
 * custom, comandos custom y estilo de menú.
 */

import { getDb } from '../connection.js';

export const ALLOWED_MENU_STYLES = Object.freeze(['versova', 'minimal', 'elegant', 'cyber', 'compact', 'retro']);
export const DEFAULT_MENU_STYLE = 'versova';

const DEFAULT_CUSTOM = Object.freeze({
  menuStyle: 'versova',
  aliases: {}, // { reg: ["registrar2"] }
  disabled: [], // ["warn", "ban"]
  categories: [], // [{ id, title, icon, sub, kaomoji }]
  customCommands: [], // [{ name, category, description, response, permission, aliases, args, hidden }]
  categoryOverrides: {}, // { reg: "diversion" }
});

function isValidAliasName(name) {
  return /^[a-z0-9][a-z0-9_-]{1,23}$/i.test(String(name || '').trim());
}
function isValidCategoryId(id) {
  return /^[a-z0-9][a-z0-9_-]{1,19}$/i.test(String(id || '').trim());
}
function isValidCommandName(name) {
  return /^[\p{L}ñ][\p{L}\p{N}_-]{0,24}$/u.test(String(name || '').toLowerCase());
}

/** Normaliza y valida menu_style */
export function normalizeMenuStyle(input, fallback = DEFAULT_MENU_STYLE) {
  const raw = String(input ?? '').trim().toLowerCase();
  if (!raw) return { ok: true, value: fallback };
  if (ALLOWED_MENU_STYLES.includes(raw)) return { ok: true, value: raw };
  return { ok: false, reason: `Estilo no válido. Elige entre: ${ALLOWED_MENU_STYLES.join(', ')}` };
}

/** Parsea JSON de custom_config de forma segura */
export function parseCustomConfig(raw) {
  let parsed = {};
  if (!raw) parsed = {};
  else if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  } else if (typeof raw === 'object') parsed = raw;
  if (!parsed || typeof parsed !== 'object') parsed = {};
  // merge with defaults
  const out = {
    menuStyle: typeof parsed.menuStyle === 'string' && ALLOWED_MENU_STYLES.includes(parsed.menuStyle) ? parsed.menuStyle : DEFAULT_MENU_STYLE,
    aliases: {},
    disabled: [],
    categories: [],
    customCommands: [],
    categoryOverrides: {},
  };
  // aliases: object map command -> array strings
  if (parsed.aliases && typeof parsed.aliases === 'object' && !Array.isArray(parsed.aliases)) {
    for (const [cmd, arr] of Object.entries(parsed.aliases)) {
      if (!isValidCommandName(cmd)) continue;
      const list = Array.isArray(arr) ? arr : [arr];
      const clean = [...new Set(list.map((a) => String(a).trim().toLowerCase()).filter((a) => a && isValidCommandName(a)))];
      if (clean.length) out.aliases[cmd.toLowerCase()] = clean.slice(0, 10);
    }
  }
  // disabled: array of command names
  if (Array.isArray(parsed.disabled)) {
    out.disabled = [...new Set(parsed.disabled.map((c) => String(c).trim().toLowerCase()).filter((c) => c && isValidCommandName(c)))].slice(0, 100);
  }
  // categories
  if (Array.isArray(parsed.categories)) {
    out.categories = parsed.categories.filter((cat) => cat && typeof cat === 'object').map((cat) => ({
      id: String(cat.id || '').trim().toLowerCase(),
      title: String(cat.title || '').trim().slice(0, 30) || 'CUSTOM',
      icon: String(cat.icon || '✦').slice(0, 4) || '✦',
      sub: String(cat.sub || 'custom').trim().slice(0, 30) || 'custom',
      kaomoji: String(cat.kaomoji || '( ᵕ ᴗ ᵕ )♡').slice(0, 20) || '( ᵕ ᴗ ᵕ )♡',
    })).filter((cat) => cat.id && isValidCategoryId(cat.id)).slice(0, 20);
    // dedup by id
    const seen = new Set();
    out.categories = out.categories.filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
  }
  // customCommands
  if (Array.isArray(parsed.customCommands)) {
    out.customCommands = parsed.customCommands.filter((c) => c && typeof c === 'object').map((c) => {
      const name = String(c.name || '').trim().toLowerCase();
      if (!name || !isValidCommandName(name)) return null;
      const category = String(c.category || 'custom').trim().toLowerCase();
      const description = String(c.description || '').trim().slice(0, 200) || `Comando personalizado ${name}`;
      const response = String(c.response || '').trim().slice(0, 4000) || `¡Hola! Usaste ${name}`;
      const permission = ['all','registered','admin','owner'].includes(String(c.permission)) ? String(c.permission) : 'all';
      const aliases = Array.isArray(c.aliases) ? [...new Set(c.aliases.map((a)=>String(a).trim().toLowerCase()).filter((a)=>a && isValidCommandName(a)))].slice(0,5) : [];
      const args = String(c.args || '').trim().slice(0, 40);
      const hidden = Boolean(c.hidden);
      const groupOnly = c.groupOnly !== undefined ? Boolean(c.groupOnly) : true;
      return { name, category, description, response, permission, aliases, args, hidden, groupOnly };
    }).filter(Boolean).slice(0, 50);
    // dedup name
    const seenN = new Set();
    out.customCommands = out.customCommands.filter((c) => { if (seenN.has(c.name)) return false; seenN.add(c.name); return true; });
  }
  // categoryOverrides
  if (parsed.categoryOverrides && typeof parsed.categoryOverrides === 'object' && !Array.isArray(parsed.categoryOverrides)) {
    for (const [cmd, cat] of Object.entries(parsed.categoryOverrides)) {
      if (!isValidCommandName(cmd)) continue;
      const catId = String(cat || '').trim().toLowerCase();
      if (!catId || !isValidCategoryId(catId)) continue;
      out.categoryOverrides[cmd.toLowerCase()] = catId;
    }
  }
  // Also handle legacy: if raw had menu_style field
  if (parsed.menu_style && ALLOWED_MENU_STYLES.includes(String(parsed.menu_style).toLowerCase())) {
    out.menuStyle = String(parsed.menu_style).toLowerCase();
  }
  return out;
}

/** Valida un payload completo antes de guardar */
export function validateCustomization(payload, { globalCommands = [] } = {}) {
  const errors = [];
  const data = parseCustomConfig(payload);
  // check aliases don't collide with global command names or custom commands
  const globalNames = new Set(globalCommands.map((c) => String(c.name).toLowerCase()));
  const customNames = new Set(data.customCommands.map((c) => c.name.toLowerCase()));
  for (const [cmd, aliases] of Object.entries(data.aliases)) {
    if (!globalNames.has(cmd) && !customNames.has(cmd)) {
      // allow alias for unknown? but warn
      // errors.push(`El comando "${cmd}" no existe para añadir alias.`);
    }
    for (const alias of aliases) {
      if (globalNames.has(alias) || customNames.has(alias)) {
        errors.push(`El alias "${alias}" ya es un comando existente.`);
      }
      if (alias.length < 2) errors.push(`Alias muy corto: "${alias}"`);
    }
  }
  // disabled should be known commands (or custom)
  for (const name of data.disabled) {
    if (!globalNames.has(name) && !customNames.has(name)) {
      // allow disabling unknown? skip
    }
  }
  // customCommands validation already done, check duplicates with global
  for (const cmd of data.customCommands) {
    if (globalNames.has(cmd.name)) errors.push(`El comando custom "${cmd.name}" ya existe como comando del sistema.`);
    if (!cmd.response || cmd.response.length < 1) errors.push(`El comando "${cmd.name}" necesita una respuesta.`);
  }
  // categories id must not collide with global categories
  const globalCats = new Set(['info','registro','roles','team','social','admin']);
  for (const cat of data.categories) {
    if (globalCats.has(cat.id)) errors.push(`La categoría "${cat.id}" ya existe como global. Usa otro id.`);
  }
  return { ok: errors.length === 0, errors, data };
}

export const customRepo = {
  /** Obtiene la config normalizada de un bot */
  get(instanceId) {
    if (!instanceId) return parseCustomConfig({});
    const row = getDb().prepare('SELECT menu_style, custom_config FROM bot_instances WHERE id = ?').get(instanceId);
    if (!row) return parseCustomConfig({});
    const menuStyle = row.menu_style || DEFAULT_MENU_STYLE;
    let cfg = {};
    try { cfg = row.custom_config ? JSON.parse(row.custom_config) : {}; } catch { cfg = {}; }
    if (menuStyle && ALLOWED_MENU_STYLES.includes(menuStyle)) cfg.menuStyle = menuStyle;
    return parseCustomConfig(cfg);
  },

  /** Guarda la config validada */
  set(instanceId, payload) {
    const normalized = parseCustomConfig(payload);
    const menuStyle = normalized.menuStyle || DEFAULT_MENU_STYLE;
    const json = JSON.stringify(normalized);
    const now = Date.now();
    getDb().prepare('UPDATE bot_instances SET menu_style = ?, custom_config = ?, updated_at = ? WHERE id = ?').run(menuStyle, json, now, instanceId);
    // espejo opcional
    try {
      getDb().prepare(`INSERT INTO bot_customizations (instance_id, menu_style, config, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(instance_id) DO UPDATE SET menu_style=excluded.menu_style, config=excluded.config, updated_at=excluded.updated_at`)
        .run(instanceId, menuStyle, json, now);
    } catch {}
    return normalized;
  },

  /** Actualiza solo el estilo */
  setStyle(instanceId, style) {
    const check = normalizeMenuStyle(style);
    if (!check.ok) throw new Error(check.reason);
    const cfg = this.get(instanceId);
    cfg.menuStyle = check.value;
    return this.set(instanceId, cfg);
  }
};
