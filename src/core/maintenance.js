/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · mantenimiento periódico
 * ────────────────────────────────────────────────────────────────
 * Cada minuto:
 *   · libera reservas de personaje vencidas (y avisa en privado)
 *   · expira solicitudes abandonadas
 *   · limpia confirmaciones caducadas
 *   · libera memoria del rate-limit
 * Cada día: purga la auditoría antigua.
 */
import { confirmationsRepo, auditRepo, groupsRepo, usersRepo } from '../db/index.js';
import * as rolesService from '../services/roles.service.js';
import { sweep as sweepRateLimit } from '../security/rate-limit.js';
import { renderResult } from '../design/index.js';
import { scoped } from './logger.js';

const log = scoped('maintenance');

const AUDIT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/** Ejecuta una pasada de mantenimiento y devuelve el resumen. */
export async function runMaintenance({ manager = null, notify = true } = {}) {
  const summary = { reservations: 0, requests: 0, confirmations: 0, rateLimitKeys: 0, notified: 0 };

  try {
    const roleWork = rolesService.maintenance();
    summary.reservations = roleWork.releasedReservations;
    summary.requests = roleWork.expiredRequests;
    summary.confirmations = confirmationsRepo.purgeExpired();
    summary.rateLimitKeys = sweepRateLimit();

    if (notify && manager && roleWork.expiredReservations.length) {
      summary.notified = await notifyExpiredReservations(manager, roleWork.expiredReservations);
    }
  } catch (error) {
    log.error({ err: error }, 'fallo en mantenimiento');
  }

  return summary;
}

/** Aviso privado (best effort) de que la reserva expiró. */
async function notifyExpiredReservations(manager, expired) {
  let notified = 0;
  for (const reservation of expired) {
    const client = [...manager.clients.values()].find((c) => c.status === 'open');
    if (!client || !reservation.reserved_by) continue;
    const group = groupsRepo.get(reservation.group_id);
    const user = usersRepo.get(reservation.group_id, reservation.reserved_by);
    const text = renderResult({
      view: 'role.reserve.rejected',
      data: {
        roleName: reservation.name,
        reason: `Tu reserva expiró y ${reservation.name} volvió a estar disponible${group ? ` en ${group.name}` : ''}.`,
      },
    });
    try {
      // eslint-disable-next-line no-await-in-loop
      await client.sendMessage(reservation.reserved_by, { text });
      notified += 1;
    } catch (error) {
      log.debug({ err: error, to: reservation.reserved_by }, 'no se pudo avisar de la reserva expirada');
    }
    if (user?.name) log.debug(`reserva expirada: ${user.name} · ${reservation.name}`);
  }
  return notified;
}

/** Arranca los temporizadores. Devuelve una función para detenerlos. */
export function startMaintenance(options = {}) {
  const intervalMs = options.intervalMs ?? 60_000;
  const dailyMs = options.dailyMs ?? 24 * 60 * 60 * 1000;

  const shortTimer = setInterval(() => {
    runMaintenance(options).catch((error) => log.error({ err: error }, 'mantenimiento falló'));
  }, intervalMs);

  const longTimer = setInterval(() => {
    const removed = auditRepo.purgeOlderThan(AUDIT_RETENTION_MS);
    if (removed) log.info({ removed }, 'auditoría antigua purgada');
  }, dailyMs);

  shortTimer.unref?.();
  longTimer.unref?.();

  return () => {
    clearInterval(shortTimer);
    clearInterval(longTimer);
  };
}

export default { runMaintenance, startMaintenance };
