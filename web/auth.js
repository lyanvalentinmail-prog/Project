/**
 * VÉRSOVA · autenticación del panel web
 * ────────────────────────────────────────────────────────────────
 * El panel web NO pide contraseña: está abierto por diseño (decisión
 * de producto). Se mantiene este módulo como puerta neutra para que
 * las rutas puedan seguir montando `auth.requireAuth` sin cambios.
 */
export function createAuth(_options = {}) {
  const noop = () => {};

  return {
    /** Nunca hay contraseña: el dashboard es accesible sin clave. */
    hasPassword: false,
    verifyPassword: () => true,
    issueToken: () => ({ token: 'open', expiresAt: Date.now() + 86_400_000 }),
    isValid: () => true,
    revoke: noop,
    isLocked: () => false,
    registerFailure: () => ({ count: 0, lockedUntil: 0 }),
    clearFailures: noop,
    /** Middleware que deja pasar a todo el mundo. */
    requireAuth(_req, _res, next) {
      return next();
    },
    extractToken: () => null,
    sessions: () => 0,
  };
}

export default createAuth;
