/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · configuración de entorno
 * ────────────────────────────────────────────────────────────────
 * Carga `.env`, valida y normaliza todos los valores y garantiza que
 * las carpetas de datos/sesiones/logs existan con permisos restringidos.
 * Nada aquí lanza excepciones por valores opcionales: siempre hay default.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { phoneToJid } from '../utils/ids.js';

/** Raíz absoluta del proyecto (independiente del cwd desde el que se ejecute). */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

/* ── helpers de parseo defensivo ─────────────────────────────── */

const str = (value, fallback = '') => {
  const v = (value ?? '').toString().trim();
  return v.length ? v : fallback;
};

const int = (value, fallback, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) => {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const bool = (value, fallback = false) => {
  const v = (value ?? '').toString().trim().toLowerCase();
  if (!v) return fallback;
  return ['1', 'true', 'yes', 'si', 'sí', 'on'].includes(v);
};

const abs = (p, fallback) => {
  const raw = str(p, fallback);
  return path.isAbsolute(raw) ? raw : path.resolve(ROOT, raw);
};

/** Crea una carpeta con permisos 0700 (protege credenciales y base de datos). */
export function ensurePrivateDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(dir, 0o700);
  } catch {
    /* en Windows chmod es limitado: no es un error fatal */
  }
  return dir;
}

/* ── rutas ───────────────────────────────────────────────────── */

const DATA_DIR = ensurePrivateDir(abs(process.env.DATA_DIR, './data'));
const SESSIONS_DIR = ensurePrivateDir(abs(process.env.SESSIONS_DIR, './sessions'));
const LOG_DIR = ensurePrivateDir(abs(process.env.LOG_DIR, './logs'));

/* ── configuración congelada ─────────────────────────────────── */

export const env = Object.freeze({
  root: ROOT,

  // identidad
  botName: str(process.env.BOT_NAME, 'VÉRSOVA'),
  botTeam: str(process.env.BOT_TEAM, '◢禍◣ Versova ࿙☕࿚'),
  botPrefix: str(process.env.BOT_PREFIX, '.').charAt(0) || '.',
  botVersion: str(process.env.BOT_VERSION, '1.0'),

  // propietario: números sin "+" separados por coma
  ownerNumbers: Object.freeze(
    str(process.env.OWNER_NUMBERS, '')
      .split(/[,\s]+/)
      .map((n) => n.replace(/[^\d]/g, ''))
      .filter((n) => n.length >= 6)
  ),

  // web
  webHost: str(process.env.WEB_HOST, '0.0.0.0'),
  webPort: int(process.env.WEB_PORT, 3000, 1, 65535),
  dashboardPassword: str(process.env.DASHBOARD_PASSWORD, ''),
  maxInstances: int(process.env.MAX_INSTANCES, 3, 1, 3),

  // rutas
  dataDir: DATA_DIR,
  sessionsDir: SESSIONS_DIR,
  logDir: LOG_DIR,
  dbPath: abs(process.env.DB_PATH, './data/versova.db'),
  logFile: abs(process.env.LOG_FILE, './logs/versova.log'),

  // comportamiento por defecto (cada grupo puede sobrescribirlo en su config)
  inactivityDays: int(process.env.INACTIVITY_DAYS, 7, 1, 365),
  reserveHours: int(process.env.RESERVE_HOURS, 24, 1, 720),
  maxWarnings: int(process.env.MAX_WARNINGS, 3, 1, 20),
  rateLimitMax: int(process.env.RATE_LIMIT_MAX, 6, 1, 100),
  rateLimitWindowMs: int(process.env.RATE_LIMIT_WINDOW_MS, 10_000, 1000, 600_000),
  welcomeEnabled: bool(process.env.WELCOME_ENABLED, true),
  privateCommands: bool(process.env.PRIVATE_COMMANDS, true),

  // logs
  logLevel: str(process.env.LOG_LEVEL, 'info'),
  logToFile: bool(process.env.LOG_TO_FILE, true),

  // baileys
  waVersionCacheTtlMs: int(process.env.WA_VERSION_TTL_MS, 6 * 60 * 60 * 1000, 60_000),
  connectTimeoutMs: int(process.env.CONNECT_TIMEOUT_MS, 60_000, 5000),
  qrTimeoutMs: int(process.env.QR_TIMEOUT_MS, 60_000, 20_000),
});

/**
 * Normaliza un número de teléfono a jid de WhatsApp (`5215512345678@s.whatsapp.net`).
 * Implementación única en `src/utils/ids.js`; se re-exporta por comodidad.
 */
export { phoneToJid };

/** jid del owner principal (para mensajes de soporte). */
export const primaryOwnerJid = env.ownerNumbers.length ? phoneToJid(env.ownerNumbers[0]) : null;
