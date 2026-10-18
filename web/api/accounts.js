/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · cuentas web, sesiones y API keys
 * ────────────────────────────────────────────────────────────────
 * Registro / inicio de sesión de las cuentas del panel de endpoints y
 * gestión de API keys para la API funcional (/api/v1).
 *
 *  · Contraseñas con scrypt (sal aleatoria). Los hashes antiguos
 *    `sal:sha256` se siguen aceptando y se migran al iniciar sesión.
 *  · Sesiones con token aleatorio; en la BD solo se guarda su hash.
 *  · API keys `vsk_…` con caducidad obligatoria de 1 a 100 días; en la
 *    BD solo queda el hash SHA-256 (la clave se muestra una sola vez).
 *  · El correo de `OWNER_EMAIL` (por defecto lyanvalentinmail@gmail.com)
 *    es el owner: sin límite de peticiones y con panel de administración.
 */
import crypto from 'node:crypto';
import express from 'express';
import { getDb } from '../../src/db/index.js';
import { env } from '../../src/config/env.js';
import { scoped } from '../../src/core/logger.js';

const log = scoped('accounts');

export const KEY_MIN_DAYS = 1;
export const KEY_MAX_DAYS = 100;
export const SESSION_DAYS = 30;
export const MAX_ACTIVE_KEYS = { user: 5, owner: 50 };
const DAY_MS = 86_400_000;
const WELCOME_CREDITS = 50;

const now = () => Date.now();
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

/* ═══════════════════════════════════════════════════════════════
   Contraseñas
   ═══════════════════════════════════════════════════════════════ */

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

/** Compara en tiempo constante. Acepta el formato antiguo `sal:sha256`. */
export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  let expected;
  let actual;
  if (stored.startsWith('scrypt$')) {
    const [, salt, hash] = stored.split('$');
    if (!salt || !hash) return false;
    expected = Buffer.from(hash, 'hex');
    actual = crypto.scryptSync(String(password), salt, expected.length);
  } else {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    expected = Buffer.from(hash, 'hex');
    actual = crypto.createHash('sha256').update(salt + String(password)).digest();
  }
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

const isLegacyHash = (stored) => typeof stored === 'string' && !stored.startsWith('scrypt$');

/* ═══════════════════════════════════════════════════════════════
   Validación
   ═══════════════════════════════════════════════════════════════ */

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const USERNAME_RE = /^[\p{L}\p{N}_.-]{3,32}$/u;

export const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase();
export const isOwnerEmail = (email) => Boolean(env.ownerEmail) && normalizeEmail(email) === env.ownerEmail;
export const roleOf = (user) => (isOwnerEmail(user?.email) ? 'owner' : 'user');

function validateRegistration({ email, username, password }) {
  if (!email || !username || !password) return 'Email, usuario y contraseña son obligatorios.';
  if (!EMAIL_RE.test(email) || email.length > 254) return 'El email no es válido.';
  if (!USERNAME_RE.test(username)) return 'El usuario debe tener de 3 a 32 caracteres (letras, números, _ . -).';
  if (String(password).length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (String(password).length > 200) return 'La contraseña es demasiado larga.';
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   Usuarios
   ═══════════════════════════════════════════════════════════════ */

export function findUserByEmail(email) {
  return getDb().prepare('SELECT * FROM web_users WHERE lower(email) = ?').get(normalizeEmail(email)) ?? null;
}

export function findUserById(id) {
  return getDb().prepare('SELECT * FROM web_users WHERE id = ?').get(id) ?? null;
}

/** Forma pública del usuario (nunca incluye el hash de la contraseña). */
export function publicUser(user) {
  if (!user) return null;
  const role = roleOf(user);
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role,
    isOwner: role === 'owner',
    plan: role === 'owner' ? 'enterprise' : user.plan,
    credits: user.credits,
    // clave de la tienda de créditos (sistema anterior, se conserva)
    apiKey: user.api_key,
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at ?? null,
  };
}

function syncRole(user) {
  const role = roleOf(user);
  if (user.role !== role) {
    try {
      getDb().prepare('UPDATE web_users SET role = ?, updated_at = ? WHERE id = ?').run(role, now(), user.id);
    } catch { /* columna aún no migrada */ }
    user.role = role;
  }
  return user;
}

/**
 * Crea una cuenta. Devuelve `{ user }` o `{ error, status }`.
 */
export function createAccount({ email, username, password }) {
  const normalized = normalizeEmail(email);
  const name = String(username ?? '').trim();
  const invalid = validateRegistration({ email: normalized, username: name, password });
  if (invalid) return { error: invalid, status: 400 };
  if (findUserByEmail(normalized)) return { error: 'Este email ya está registrado. Inicia sesión.', status: 409 };

  const id = crypto.randomUUID();
  const ts = now();
  const role = isOwnerEmail(normalized) ? 'owner' : 'user';
  const db = getDb();
  db.transaction(() => {
    db.prepare(`INSERT INTO web_users (id, email, username, password_hash, credits, plan, api_key, created_at, updated_at, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, normalized, name, hashPassword(password), WELCOME_CREDITS, role === 'owner' ? 'enterprise' : 'free',
        `sw_${crypto.randomBytes(24).toString('hex')}`, ts, ts, role);
    db.prepare(`INSERT INTO credit_transactions (user_id, type, amount, balance, description, created_at)
      VALUES (?, 'bonus', ?, ?, 'Créditos de bienvenida', ?)`).run(id, WELCOME_CREDITS, WELCOME_CREDITS, ts);
  })();
  if (role === 'owner') log.info('cuenta del owner registrada');
  return { user: findUserById(id) };
}

/** Comprueba credenciales. Devuelve el usuario o null. */
export function authenticate(email, password) {
  const user = findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) return null;
  const ts = now();
  if (isLegacyHash(user.password_hash)) {
    // migración transparente al formato scrypt
    getDb().prepare('UPDATE web_users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hashPassword(password), ts, user.id);
  }
  getDb().prepare('UPDATE web_users SET last_login_at = ? WHERE id = ?').run(ts, user.id);
  user.last_login_at = ts;
  return syncRole(user);
}

/**
 * Si se define OWNER_PASSWORD, la cuenta del owner se crea al arrancar:
 * así nadie puede adelantarse a registrarse con ese correo.
 */
export function ensureOwnerAccount() {
  try {
    if (!env.ownerEmail) return;
    const existing = findUserByEmail(env.ownerEmail);
    if (existing) {
      syncRole(existing);
      return;
    }
    if (env.ownerPassword) {
      const result = createAccount({ email: env.ownerEmail, username: 'owner', password: env.ownerPassword });
      if (result.error) log.warn({ error: result.error }, 'no se pudo crear la cuenta del owner');
    }
  } catch (error) {
    log.warn({ err: error }, 'no se pudo comprobar la cuenta del owner');
  }
}

/* ═══════════════════════════════════════════════════════════════
   Sesiones
   ═══════════════════════════════════════════════════════════════ */

export function createSession(userId, userAgent = '') {
  const token = `ses_${crypto.randomBytes(32).toString('base64url')}`;
  const ts = now();
  const expiresAt = ts + SESSION_DAYS * DAY_MS;
  const db = getDb();
  db.prepare('DELETE FROM web_sessions WHERE expires_at < ?').run(ts);
  db.prepare(`INSERT INTO web_sessions (token_hash, user_id, created_at, expires_at, last_seen_at, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)`).run(sha256(token), userId, ts, expiresAt, ts, String(userAgent ?? '').slice(0, 200));
  return { token, expiresAt };
}

export function sessionTokenFrom(req) {
  const header = req.get?.('authorization') ?? req.headers?.authorization ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const token = bearer || req.get?.('x-session-token') || '';
  return token.startsWith('ses_') ? token : null;
}

export function userFromSession(token) {
  if (!token) return null;
  const db = getDb();
  const row = db.prepare('SELECT * FROM web_sessions WHERE token_hash = ?').get(sha256(token));
  if (!row) return null;
  if (row.expires_at < now()) {
    db.prepare('DELETE FROM web_sessions WHERE token_hash = ?').run(row.token_hash);
    return null;
  }
  const user = findUserById(row.user_id);
  if (!user) return null;
  // `last_seen_at` como mucho una vez por minuto (evita escrituras por petición)
  if (now() - row.last_seen_at > 60_000) {
    db.prepare('UPDATE web_sessions SET last_seen_at = ? WHERE token_hash = ?').run(now(), row.token_hash);
  }
  return syncRole(user);
}

export function revokeSession(token) {
  if (!token) return;
  getDb().prepare('DELETE FROM web_sessions WHERE token_hash = ?').run(sha256(token));
}

/** Middleware: exige una sesión válida (`Authorization: Bearer ses_…`). */
export function requireSession(req, res, next) {
  const token = sessionTokenFrom(req);
  const user = userFromSession(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Inicia sesión para continuar.', code: 'NO_SESSION' });
  req.sessionToken = token;
  req.account = user;
  return next();
}

export function requireOwner(req, res, next) {
  return requireSession(req, res, () => {
    if (roleOf(req.account) !== 'owner') return res.status(403).json({ ok: false, error: 'Solo el owner puede hacer esto.', code: 'NOT_OWNER' });
    return next();
  });
}

/* ═══════════════════════════════════════════════════════════════
   API keys
   ═══════════════════════════════════════════════════════════════ */

export function keyStatus(row, at = now()) {
  if (row.revoked_at) return 'revoked';
  if (row.expires_at <= at) return 'expired';
  return 'active';
}

export function publicKey(row) {
  return {
    id: row.id,
    name: row.name,
    prefix: row.key_prefix,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at ?? null,
    revokedAt: row.revoked_at ?? null,
    requests: row.requests ?? 0,
    status: keyStatus(row),
    daysLeft: Math.max(0, Math.ceil((row.expires_at - now()) / DAY_MS)),
  };
}

/** Valida los días de vigencia. Devuelve `{ days }` o `{ error }`. */
export function parseKeyDays(value) {
  if (value === undefined || value === null || value === '') return { days: 30 };
  const days = Number(value);
  if (!Number.isInteger(days)) return { error: 'Los días de vigencia deben ser un número entero.' };
  if (days < KEY_MIN_DAYS) return { error: `La vigencia mínima es de ${KEY_MIN_DAYS} día.` };
  if (days > KEY_MAX_DAYS) return { error: `La vigencia máxima de una API key es de ${KEY_MAX_DAYS} días.` };
  return { days };
}

export function listKeys(userId) {
  return getDb().prepare('SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC').all(userId).map(publicKey);
}

export function activeKeyCount(userId) {
  return Number(getDb().prepare('SELECT COUNT(*) AS n FROM api_keys WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?').get(userId, now()).n);
}

/**
 * Crea una API key. Devuelve `{ key, record }` (la clave en claro solo
 * existe aquí) o `{ error, status }`.
 */
export function createApiKey(user, { name, days } = {}) {
  const parsed = parseKeyDays(days);
  if (parsed.error) return { error: parsed.error, status: 400 };
  const label = String(name ?? '').trim().slice(0, 40) || 'Mi API key';
  const role = roleOf(user);
  const limit = MAX_ACTIVE_KEYS[role] ?? MAX_ACTIVE_KEYS.user;
  if (activeKeyCount(user.id) >= limit) {
    return { error: `Alcanzaste el máximo de ${limit} API keys activas. Revoca alguna para crear otra.`, status: 409 };
  }
  const key = `vsk_${crypto.randomBytes(24).toString('base64url')}`;
  const id = crypto.randomUUID();
  const ts = now();
  const expiresAt = ts + parsed.days * DAY_MS;
  getDb().prepare(`INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, user.id, label, sha256(key), `${key.slice(0, 10)}…${key.slice(-4)}`, ts, expiresAt);
  const record = getDb().prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
  return { key, record: publicKey(record), days: parsed.days };
}

export function findKeyByPlaintext(key) {
  if (!key || typeof key !== 'string' || !key.startsWith('vsk_')) return null;
  return getDb().prepare('SELECT * FROM api_keys WHERE key_hash = ?').get(sha256(key.trim())) ?? null;
}

/* ═══════════════════════════════════════════════════════════════
   Freno de fuerza bruta en el login (memoria)
   ═══════════════════════════════════════════════════════════════ */

const LOGIN_MAX_FAILURES = 8;
const LOGIN_LOCK_MS = 15 * 60_000;
const failures = new Map();

function loginKey(req, email) {
  return `${req.ip ?? 'ip'}|${normalizeEmail(email)}`;
}
function loginLocked(key) {
  const entry = failures.get(key);
  if (!entry) return 0;
  if (entry.until && entry.until > now()) return entry.until;
  if (entry.until && entry.until <= now()) failures.delete(key);
  return 0;
}
function loginFailed(key) {
  const entry = failures.get(key) ?? { count: 0, until: 0 };
  entry.count += 1;
  if (entry.count >= LOGIN_MAX_FAILURES) {
    entry.until = now() + LOGIN_LOCK_MS;
    entry.count = 0;
  }
  failures.set(key, entry);
  if (failures.size > 5000) failures.delete(failures.keys().next().value);
}

/* ═══════════════════════════════════════════════════════════════
   Router /api/account
   ═══════════════════════════════════════════════════════════════ */

function sessionResponse(req, user, extra = {}) {
  const session = createSession(user.id, req.get?.('user-agent'));
  return { ok: true, token: session.token, expiresAt: session.expiresAt, user: publicUser(user), ...extra };
}

export function createAccountsRouter() {
  const router = express.Router();
  ensureOwnerAccount();

  router.get('/config', (_req, res) => {
    res.json({ ok: true, keyMinDays: KEY_MIN_DAYS, keyMaxDays: KEY_MAX_DAYS, sessionDays: SESSION_DAYS, maxActiveKeys: MAX_ACTIVE_KEYS.user });
  });

  router.post('/register', (req, res) => {
    const { email, username, password } = req.body ?? {};
    const result = createAccount({ email, username, password });
    if (result.error) return res.status(result.status).json({ ok: false, error: result.error });
    return res.status(201).json(sessionResponse(req, result.user, { welcomeCredits: WELCOME_CREDITS }));
  });

  router.post('/login', (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) return res.status(400).json({ ok: false, error: 'Email y contraseña son obligatorios.' });
    const key = loginKey(req, email);
    const lockedUntil = loginLocked(key);
    if (lockedUntil) {
      const minutes = Math.ceil((lockedUntil - now()) / 60_000);
      return res.status(429).json({ ok: false, error: `Demasiados intentos fallidos. Prueba de nuevo en ${minutes} min.` });
    }
    const user = authenticate(email, password);
    if (!user) {
      loginFailed(key);
      return res.status(401).json({ ok: false, error: 'Email o contraseña incorrectos.' });
    }
    failures.delete(key);
    return res.json(sessionResponse(req, user));
  });

  router.post('/logout', (req, res) => {
    revokeSession(sessionTokenFrom(req));
    res.json({ ok: true });
  });

  router.get('/me', requireSession, (req, res) => {
    const db = getDb();
    const user = req.account;
    const totals = db.prepare('SELECT COUNT(*) AS n FROM api_usage WHERE user_id = ?').get(user.id);
    const today = db.prepare('SELECT COUNT(*) AS n FROM api_usage WHERE user_id = ? AND created_at >= ?').get(user.id, now() - DAY_MS);
    res.json({
      ok: true,
      user: publicUser(user),
      limits: {
        keyMinDays: KEY_MIN_DAYS,
        keyMaxDays: KEY_MAX_DAYS,
        maxActiveKeys: MAX_ACTIVE_KEYS[roleOf(user)],
        rateLimitPerMinute: roleOf(user) === 'owner' ? null : 60,
      },
      usage: { total: Number(totals.n), last24h: Number(today.n), activeKeys: activeKeyCount(user.id) },
    });
  });

  /* ── API keys ───────────────────────────────────────────── */

  router.get('/keys', requireSession, (req, res) => {
    res.json({ ok: true, keys: listKeys(req.account.id), maxDays: KEY_MAX_DAYS });
  });

  router.post('/keys', requireSession, (req, res) => {
    const result = createApiKey(req.account, req.body ?? {});
    if (result.error) return res.status(result.status).json({ ok: false, error: result.error });
    return res.status(201).json({
      ok: true,
      key: result.key,
      apiKey: result.record,
      message: `API key creada. Caduca en ${result.days} día${result.days === 1 ? '' : 's'}. Cópiala ahora: no se volverá a mostrar.`,
    });
  });

  router.post('/keys/:id/renew', requireSession, (req, res) => {
    const parsed = parseKeyDays(req.body?.days);
    if (parsed.error) return res.status(400).json({ ok: false, error: parsed.error });
    const row = getDb().prepare('SELECT * FROM api_keys WHERE id = ? AND user_id = ?').get(req.params.id, req.account.id);
    if (!row) return res.status(404).json({ ok: false, error: 'API key no encontrada.' });
    if (row.revoked_at) return res.status(400).json({ ok: false, error: 'Una API key revocada no se puede renovar.' });
    // la nueva fecha cuenta desde hoy: nunca supera los 100 días por delante
    const expiresAt = now() + parsed.days * DAY_MS;
    getDb().prepare('UPDATE api_keys SET expires_at = ? WHERE id = ?').run(expiresAt, row.id);
    return res.json({ ok: true, apiKey: publicKey({ ...row, expires_at: expiresAt }) });
  });

  router.delete('/keys/:id', requireSession, (req, res) => {
    const row = getDb().prepare('SELECT * FROM api_keys WHERE id = ? AND user_id = ?').get(req.params.id, req.account.id);
    if (!row) return res.status(404).json({ ok: false, error: 'API key no encontrada.' });
    if (!row.revoked_at) getDb().prepare('UPDATE api_keys SET revoked_at = ? WHERE id = ?').run(now(), row.id);
    return res.json({ ok: true });
  });

  router.get('/usage', requireSession, (req, res) => {
    const db = getDb();
    const recent = db.prepare(`SELECT u.endpoint, u.status, u.duration_ms AS durationMs, u.created_at AS createdAt, k.name AS keyName
      FROM api_usage u LEFT JOIN api_keys k ON k.id = u.key_id
      WHERE u.user_id = ? ORDER BY u.created_at DESC LIMIT 50`).all(req.account.id);
    const byEndpoint = db.prepare(`SELECT endpoint, COUNT(*) AS count FROM api_usage
      WHERE user_id = ? GROUP BY endpoint ORDER BY count DESC LIMIT 15`).all(req.account.id);
    res.json({ ok: true, recent, byEndpoint });
  });

  /* ── owner ──────────────────────────────────────────────── */

  router.get('/owner/overview', requireOwner, (_req, res) => {
    const db = getDb();
    const ts = now();
    const users = db.prepare(`SELECT w.*,
        (SELECT COUNT(*) FROM api_keys k WHERE k.user_id = w.id AND k.revoked_at IS NULL AND k.expires_at > ?) AS active_keys,
        (SELECT COUNT(*) FROM api_usage u WHERE u.user_id = w.id) AS requests
      FROM web_users w ORDER BY w.created_at DESC LIMIT 200`).all(ts);
    const keys = db.prepare(`SELECT k.*, w.email FROM api_keys k JOIN web_users w ON w.id = k.user_id
      ORDER BY k.created_at DESC LIMIT 200`).all();
    const topEndpoints = db.prepare('SELECT endpoint, COUNT(*) AS count FROM api_usage GROUP BY endpoint ORDER BY count DESC LIMIT 10').all();
    res.json({
      ok: true,
      totals: {
        users: Number(db.prepare('SELECT COUNT(*) AS n FROM web_users').get().n),
        activeKeys: Number(db.prepare('SELECT COUNT(*) AS n FROM api_keys WHERE revoked_at IS NULL AND expires_at > ?').get(ts).n),
        requests: Number(db.prepare('SELECT COUNT(*) AS n FROM api_usage').get().n),
        requests24h: Number(db.prepare('SELECT COUNT(*) AS n FROM api_usage WHERE created_at >= ?').get(ts - DAY_MS).n),
      },
      users: users.map((u) => ({ ...publicUser(u), apiKey: undefined, activeKeys: Number(u.active_keys), requests: Number(u.requests) })),
      keys: keys.map((k) => ({ ...publicKey(k), email: k.email })),
      topEndpoints,
    });
  });

  router.delete('/owner/keys/:id', requireOwner, (req, res) => {
    const row = getDb().prepare('SELECT * FROM api_keys WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: 'API key no encontrada.' });
    if (!row.revoked_at) getDb().prepare('UPDATE api_keys SET revoked_at = ? WHERE id = ?').run(now(), row.id);
    return res.json({ ok: true });
  });

  router.delete('/owner/users/:id', requireOwner, (req, res) => {
    if (req.params.id === req.account.id) return res.status(400).json({ ok: false, error: 'No puedes borrar tu propia cuenta de owner.' });
    const row = findUserById(req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: 'Usuario no encontrado.' });
    getDb().prepare('DELETE FROM web_users WHERE id = ?').run(row.id);
    return res.json({ ok: true });
  });

  return router;
}

export default createAccountsRouter;
