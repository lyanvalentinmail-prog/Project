/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · acceso a datos
 * ────────────────────────────────────────────────────────────────
 * Fachada única: el resto del proyecto importa `db` desde aquí y
 * nunca toca SQL directamente.
 */
export { getDb, initDatabase, closeDatabase, tx, meta } from './connection.js';

export { instancesRepo } from './repositories/instances.repo.js';
export { groupsRepo } from './repositories/groups.repo.js';
export { rolesRepo, roleKey } from './repositories/roles.repo.js';
export { usersRepo } from './repositories/users.repo.js';
export { requestsRepo } from './repositories/requests.repo.js';
export { warningsRepo } from './repositories/warnings.repo.js';
export { confirmationsRepo, DEFAULT_TTL_MS as CONFIRM_TTL_MS } from './repositories/confirmations.repo.js';
export { auditRepo, AUDIT_ACTIONS } from './repositories/audit.repo.js';
