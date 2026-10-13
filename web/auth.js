/**
 * VÉRSOVA · autenticación del panel web (OPCIONAL)
 * ────────────────────────────────────────────────────────────────
 * La autenticación es opcional. Si no hay DASHBOARD_PASSWORD configurada,
 * todos los endpoints son accesibles sin restricción.
 */
import crypto from 'node:crypto';

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const LOCK_MS = 5 * 60_000;

const tokens = new Map();
const attempts = new Map();

export function createAuth({ password }) {
  const hasPassword = Boolean(password && String(password).trim().length > 0);
  const expected = hasPassword ? Buffer.from(String(password), 'utf8') : null;

  function verifyPassword(candidate) {
    if (!hasPassword) return true; // sin contraseña = siempre válido
    const given = Buffer.from(String(candidate ?? ''), 'utf8');
    if (given.length !== expected.length) return false;
    return crypto.timingSafeEqual(given, expected);
  }

  function issueToken() {
    const token = crypto.randomBytes(32).toString('base64url');
    tokens.set(token, Date.now() + TOKEN_TTL_MS);
    return { token, expiresAt: Date.now() + TOKEN_TTL_MS };
  }

  function isValid(token) {
    if (!hasPassword) return true; // sin contraseña = siempre válido
    if (!token) return false;
    const expiresAt = tokens.get(token);
    if (!expiresAt) return false;
    if (expiresAt <= Date.now()) {
      tokens.delete(token);
      return false;
    }
    return true;
  }

  function revoke(token) {
    tokens.delete(token);
  }

  function sweep() {
    const now = Date.now();
    for (const [token, expiresAt] of tokens) if (expiresAt <= now) tokens.delete(token);
  }

  function registerFailure(ip) {
    const entry = attempts.get(ip) ?? { count: 0, lockedUntil: 0 };
    entry.count += 1;
    if (entry.count >= MAX_ATTEMPTS) {
      entry.lockedUntil = Date.now() + LOCK_MS;
      entry.count = 0;
    }
    attempts.set(ip, entry);
    return entry;
  }

  function isLocked(ip) {
    const entry = attempts.get(ip);
    return Boolean(entry && entry.lockedUntil > Date.now());
  }

  function clearFailures(ip) {
    attempts.delete(ip);
  }

  function extractToken(req) {
    const header = req.get?.('authorization') ?? '';
    if (header.startsWith('Bearer ')) return header.slice(7).trim();
    if (req.query?.token) return String(req.query.token);
    return null;
  }

  // Si no hay contraseña, requireAuth deja pasar a todos
  function requireAuth(req, res, next) {
    if (!hasPassword) {
      req.token = null;
      return next();
    }
    const token = extractToken(req);
    if (!isValid(token)) {
      return res.status(401).json({ ok: false, error: 'Sesión no válida. Vuelve a iniciar sesión.' });
    }
    req.token = token;
    return next();
  }

  setInterval(sweep, 10 * 60_000).unref?.();

  return {
    hasPassword,
    verifyPassword,
    issueToken,
    isValid,
    revoke,
    isLocked,
    registerFailure,
    clearFailures,
    requireAuth,
    extractToken,
    sessions: () => tokens.size,
  };
}

export default createAuth;