/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · servicio de personajes (roles)
 * ────────────────────────────────────────────────────────────────
 * Invariantes:
 *  · un personaje no puede pertenecer a dos usuarios (índice UNIQUE)
 *  · un usuario no puede ocupar dos personajes (índice UNIQUE)
 *  · no se aceptan solicitudes duplicadas del mismo usuario
 *  · una solicitud se resuelve UNA sola vez (UPDATE ... WHERE status='pending')
 */
import { usersRepo, rolesRepo, requestsRepo, groupsRepo, confirmationsRepo, auditRepo, tx } from '../db/index.js';
import { ok, fail, msg, action } from './result.js';
import { validateRoleName, validateDenyReason } from '../security/validation.js';
import { registerConfirmAction } from '../security/confirm.js';
import { roleKey } from '../db/repositories/roles.repo.js';
import { mention as mentionOf } from '../design/theme.js';
import { hoursFromNow, formatDuration } from '../utils/time.js';

const ROLE_TYPES = ['role', 'role_change'];
const REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

/* ═══════════════════════════════════════════════════════════════
   Solicitudes de personaje
   ═══════════════════════════════════════════════════════════════ */

/** `.rol <personaje>` y `.cambiarol <personaje>` comparten este flujo. */
export function requestRole(ctx, rawArgs, { type = 'role' } = {}) {
  const groupId = ctx.group.groupId;
  const user = usersRepo.get(groupId, ctx.author.jid);
  if (!user) return fail('user.notRegistered', { command: type === 'role' ? 'rol' : 'cambiarol', name: null });

  const name = validateRoleName(rawArgs);
  if (!name.ok) return fail('role.reserve.rejected', { reason: name.reason, command: 'rol' });

  const currentRole = user.role_id ? rolesRepo.findById(user.role_id) : null;

  if (type === 'role' && currentRole) {
    return fail('sys.invalid', {
      command: 'rol',
      message: `Ya interpretas a ${currentRole.name}. Para pedir otro usa .cambiarol <personaje>.`,
    });
  }
  if (type === 'role_change' && !currentRole) {
    return fail('sys.invalid', {
      command: 'cambiarol',
      message: 'No tienes personaje que cambiar. Pide uno con .rol <personaje>.',
    });
  }
  if (type === 'role_change' && currentRole && roleKey(currentRole.name) === roleKey(name.value)) {
    return fail('sys.invalid', { command: 'cambiarol', message: `Ese ya es tu personaje (${currentRole.name}).` });
  }

  const role = rolesRepo.ensure(groupId, name.value);

  if (role.status === 'taken') {
    return fail('role.occupied', {
      roleName: role.name,
      ownerName: role.owner_name ?? 'alguien del team',
      since: role.taken_at,
      command: 'rol',
    });
  }
  if (role.status === 'reserved' && role.reserved_by !== ctx.author.jid) {
    return fail('role.occupied', {
      roleName: role.name,
      ownerName: role.reserved_name ?? 'otra persona',
      reserved: true,
      until: role.reserved_until,
      command: 'rol',
    });
  }

  const duplicate = requestsRepo.pendingForUser(groupId, ctx.author.jid, ROLE_TYPES);
  if (duplicate) {
    return fail('sys.invalid', {
      command: 'rol',
      message: `Ya tienes una solicitud pendiente (#${duplicate.id} → ${duplicate.role_name}). Espera la respuesta del staff o cancela con .cancelarsolicitud.`,
    });
  }

  const admins = groupsRepo.listAdmins(groupId).filter((a) => a.user_jid !== ctx.author.jid);
  const request = requestsRepo.create({
    groupId,
    userJid: ctx.author.jid,
    roleName: role.name,
    prevRoleName: currentRole?.name ?? null,
    type,
  });

  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId,
    actorJid: ctx.author.jid,
    action: 'role.request',
    detail: { requestId: request.id, roleName: role.name, type },
  });

  const adminMentions = admins.slice(0, 20).map((a) => mentionOf(a.user_jid));

  return ok(
    'role.request.created',
    {
      roleName: role.name,
      requestId: request.id,
      admins: admins.length,
      type,
      prevRole: currentRole?.name ?? null,
      command: type === 'role' ? 'rol' : 'cambiarol',
    },
    {
      extra: [
        msg(
          'group',
          'role.request.notifyAdmins',
          {
            requestId: request.id,
            userName: user.name,
            userMention: mentionOf(ctx.author.jid),
            roleName: role.name,
            type,
            prevRole: currentRole?.name ?? null,
            adminMentions,
          },
          { mentions: [ctx.author.jid, ...admins.map((a) => a.user_jid)], linkRequest: request.id }
        ),
      ],
      actions: [action.refreshGroup()],
    }
  );
}

/** Localiza una solicitud por #id, por nombre de personaje o por mensaje citado. */
function findRequest(ctx, arg) {
  const groupId = ctx.group.groupId;

  if (ctx.quoted?.messageId) {
    const byMessage = requestsRepo.byMessageId(ctx.quoted.messageId);
    if (byMessage && byMessage.group_id === groupId) return byMessage;
  }

  const raw = String(arg ?? '').trim();
  if (raw) {
    const idMatch = /^#?(\d{1,9})$/.exec(raw);
    if (idMatch) {
      const found = requestsRepo.get(idMatch[1]);
      return found && found.group_id === groupId ? found : null;
    }
    const key = roleKey(raw);
    return (
      requestsRepo.listPending(groupId).find((r) => r.role_name && roleKey(r.role_name) === key) ?? null
    );
  }

  // sin argumento: la solicitud pendiente más antigua del grupo
  const pending = requestsRepo.listPending(groupId);
  return pending[0] ?? null;
}

/**
 * `.acceptrol` / `.denyrol` — aprobación o rechazo por un administrador.
 * Funciona respondiendo al mensaje de la solicitud o con `#id` / nombre.
 */
export function resolveRequest(ctx, { arg = '', decision, reason = null, command = 'acceptrol' }) {
  const groupId = ctx.group.groupId;
  const request = findRequest(ctx, arg);

  if (!request) {
    return fail('sys.invalid', {
      command,
      message: 'No encontré ninguna solicitud pendiente. Usa .acceptrol #id, .acceptrol <personaje> o responde al mensaje del aviso.',
    });
  }
  if (request.status !== 'pending') {
    return fail('sys.invalid', {
      command,
      message: `La solicitud #${request.id} ya está ${request.status === 'approved' ? 'aprobada' : request.status === 'rejected' ? 'rechazada' : 'cerrada'}.`,
    });
  }
  if (request.type === 'couple') {
    return fail('sys.invalid', {
      command,
      message: 'Esa es una propuesta de pareja: la responde el integrante con .aceptar o .rechazar.',
    });
  }

  const requester = usersRepo.get(groupId, request.user_jid);
  const roleName = request.role_name;

  if (decision === 'approve') {
    if (!requester || requester.status !== 'active') {
      requestsRepo.resolve(request.id, 'cancelled', ctx.author.jid, {
        reason: 'quien pidió el personaje ya no está registrado',
      });
      return fail('sys.invalid', {
        command,
        message: `Quien pidió ${roleName} (#${request.id}) ya no está registrado en el grupo: la solicitud quedó cancelada.`,
      });
    }

    const targetRole = rolesRepo.findByName(groupId, roleName) ?? rolesRepo.ensure(groupId, roleName);

    if (targetRole.status === 'taken' && targetRole.owner_jid !== request.user_jid) {
      return fail('role.occupied', {
        roleName: targetRole.name,
        ownerName: targetRole.owner_name ?? 'otra persona',
        since: targetRole.taken_at,
        command,
      });
    }

    let summary;
    try {
      summary = tx(() => {
        const claimed = requestsRepo.resolve(request.id, 'approved', ctx.author.jid);
        if (!claimed) {
          const conflict = new Error('La solicitud ya fue procesada.');
          conflict.code = 'ALREADY_RESOLVED';
          throw conflict;
        }

        const previous = requester.role_id ? rolesRepo.findById(requester.role_id) : null;
        if (previous && previous.id !== targetRole.id) rolesRepo.release(previous.id);
        if (request.prev_role_name && previous && roleKey(previous.name) !== roleKey(request.prev_role_name)) {
          const stale = rolesRepo.findByName(groupId, request.prev_role_name);
          if (stale && stale.owner_jid === request.user_jid) rolesRepo.release(stale.id);
        }

        const assigned = rolesRepo.assign(targetRole.id, request.user_jid);
        if (!assigned) {
          const taken = new Error('El personaje ya pertenece a otra persona.');
          taken.code = 'ROLE_TAKEN';
          throw taken;
        }
        usersRepo.update(groupId, request.user_jid, { role_id: targetRole.id });

        auditRepo.log({
          instanceId: ctx.instance?.id ?? null,
          groupId,
          actorJid: ctx.author.jid,
          action: 'role.approved',
          targetJid: request.user_jid,
          detail: { requestId: request.id, roleName: targetRole.name, previous: previous?.name ?? null },
        });

        return {
          requestId: request.id,
          roleName: targetRole.name,
          userName: requester.name,
          userJid: request.user_jid,
          previous: previous?.name ?? null,
        };
      });
    } catch (error) {
      if (error.code === 'ALREADY_RESOLVED') {
        return fail('sys.invalid', { command, message: `La solicitud #${request.id} ya fue procesada por otro admin.` });
      }
      if (error.code === 'ROLE_TAKEN') {
        // rollback hecho: la solicitud sigue pendiente y nadie pierde su personaje
        return fail('role.occupied', {
          roleName,
          ownerName: rolesRepo.findByName(groupId, roleName)?.owner_name ?? 'otra persona',
          since: Date.now(),
          command,
        });
      }
      throw error;
    }

    return ok(
      'role.assigned',
      {
        roleName: summary.roleName,
        userName: summary.userName,
        approvedBy: ctx.author.name,
        type: request.type,
        prevRole: summary.previous,
        mentions: [summary.userJid],
        command,
      },
      { actions: [action.refreshGroup()] }
    );
  }

  /* ── rechazo ─────────────────────────────────────────────────── */
  const cleanReason = validateDenyReason(reason).value;
  let summary;
  try {
    summary = tx(() => {
      const claimed = requestsRepo.resolve(request.id, 'rejected', ctx.author.jid, { reason: cleanReason });
      if (!claimed) {
        const conflict = new Error('La solicitud ya fue procesada.');
        conflict.code = 'ALREADY_RESOLVED';
        throw conflict;
      }
      auditRepo.log({
        instanceId: ctx.instance?.id ?? null,
        groupId,
        actorJid: ctx.author.jid,
        action: 'role.rejected',
        targetJid: request.user_jid,
        detail: { requestId: request.id, roleName, reason: cleanReason },
      });
      return { requestId: request.id, roleName, userName: requester?.name ?? 'quien pidió el rol', userJid: request.user_jid, kept: request.prev_role_name ?? null };
    });
  } catch (error) {
    if (error.code === 'ALREADY_RESOLVED') {
      return fail('sys.invalid', { command, message: `La solicitud #${request.id} ya fue procesada por otro admin.` });
    }
    throw error;
  }

  return ok(
    'role.rejected',
    {
      roleName: summary.roleName,
      reason: cleanReason,
      rejectedBy: ctx.author.name,
      keptRole: summary.kept,
      mentions: [summary.userJid],
      command,
    }
  );
}

/** `.cancelarsolicitud` — el propio usuario retira su solicitud. */
export function cancelOwnRequest(ctx) {
  const groupId = ctx.group.groupId;
  const pending = requestsRepo.pendingForUser(groupId, ctx.author.jid, ROLE_TYPES);
  if (!pending) {
    return fail('sys.invalid', { command: 'cancelarsolicitud', message: 'No tienes solicitudes de personaje pendientes.' });
  }
  requestsRepo.resolve(pending.id, 'cancelled', ctx.author.jid, { reason: 'cancelada por el usuario' });
  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId,
    actorJid: ctx.author.jid,
    action: 'role.rejected',
    detail: { requestId: pending.id, roleName: pending.role_name, by: 'self' },
  });
  return ok('role.rejected', {
    roleName: pending.role_name,
    reason: 'Solicitud cancelada por ti.',
    rejectedBy: 'tú mismo/a',
    keptRole: pending.prev_role_name ?? null,
    command: 'cancelarsolicitud',
  });
}

/* ═══════════════════════════════════════════════════════════════
   Listados
   ═══════════════════════════════════════════════════════════════ */

/** `.roles` — personajes ocupados + reservas. */
export function listRoles(ctx) {
  const groupId = ctx.group.groupId;
  rolesRepo.releaseExpired();
  const taken = rolesRepo.listTaken(groupId);
  const reserved = rolesRepo.listReserved(groupId);
  const counts = rolesRepo.counts(groupId);
  return ok('role.list', {
    roles: taken,
    reserved,
    total: taken.length,
    free: counts.free,
    groupName: ctx.group.name,
    command: 'roles',
  });
}

/** `.mirol` */
export function myRole(ctx) {
  const groupId = ctx.group.groupId;
  const user = usersRepo.get(groupId, ctx.author.jid);
  if (!user) return fail('user.notRegistered', { command: 'mirol', name: null });

  const reservation = rolesRepo.reservationOf(groupId, ctx.author.jid);
  const role = user.role_id ? rolesRepo.findById(user.role_id) : null;

  return ok('role.mine', {
    name: user.name,
    roleName: role?.name ?? null,
    since: role?.taken_at ?? null,
    reserved: reservation ? { name: reservation.name, until: reservation.reserved_until } : null,
    command: 'mirol',
  });
}

/** `.pendientes` — solicitudes en espera (detalle para admins). */
export function pendingRequests(ctx) {
  const groupId = ctx.group.groupId;
  return ok('role.pending', {
    requests: requestsRepo.listPending(groupId),
    isAdmin: Boolean(ctx.author.isAdmin || ctx.author.isBotOwner),
    command: 'pendientes',
  });
}

/* ═══════════════════════════════════════════════════════════════
   Reservas
   ═══════════════════════════════════════════════════════════════ */

/** `.reservar <personaje>` — 24 h por defecto (configurable por grupo). */
export function reserve(ctx, rawArgs) {
  const groupId = ctx.group.groupId;
  const user = usersRepo.get(groupId, ctx.author.jid);
  if (!user) return fail('user.notRegistered', { command: 'reservar', name: null });

  const name = validateRoleName(rawArgs);
  if (!name.ok) return fail('role.reserve.rejected', { reason: name.reason, command: 'reservar' });

  if (user.role_id) {
    const current = rolesRepo.findById(user.role_id);
    return fail('role.reserve.rejected', {
      roleName: name.value,
      reason: `Ya interpretas a ${current?.name ?? 'un personaje'}. Usa .cambiarol para pedir un cambio.`,
      command: 'reservar',
    });
  }

  const existingReservation = rolesRepo.reservationOf(groupId, ctx.author.jid);
  if (existingReservation) {
    return fail('role.reserve.rejected', {
      roleName: existingReservation.name,
      reason: `Ya tienes una reserva activa (${existingReservation.name}, vence en ${formatDuration(existingReservation.reserved_until - Date.now())}). Libérala con .liberarreserva.`,
      command: 'reservar',
    });
  }

  const role = rolesRepo.ensure(groupId, name.value);

  if (role.status === 'taken') {
    return fail('role.reserve.rejected', {
      roleName: role.name,
      reason: `Ese personaje está ocupado por ${role.owner_name ?? 'otra persona'}.`,
      command: 'reservar',
    });
  }
  if (role.status === 'reserved') {
    return fail('role.reserve.rejected', {
      roleName: role.name,
      reason: role.reserved_by === ctx.author.jid
        ? 'Ya tienes reservado ese personaje.'
        : `Ese personaje está reservado por ${role.reserved_name ?? 'otra persona'} hasta ${formatDuration(role.reserved_until - Date.now())}.`,
      command: 'reservar',
    });
  }

  const hours = ctx.group.config.reserve_hours;
  const until = hoursFromNow(hours);
  rolesRepo.reserve(role.id, ctx.author.jid, until);
  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId,
    actorJid: ctx.author.jid,
    action: 'role.reserved',
    detail: { roleName: role.name, until, hours },
  });

  return ok('role.reserve.success', {
    roleName: role.name,
    until,
    hours,
    userName: user.name,
    command: 'reservar',
  });
}

/** `.reservas` — lista de reservas activas del grupo. */
export function listReservations(ctx) {
  const groupId = ctx.group.groupId;
  rolesRepo.releaseExpired();
  return ok('role.reservations', {
    list: rolesRepo.listReserved(groupId),
    groupName: ctx.group.name,
    command: 'reservas',
  });
}

/** `.liberarreserva` — cancela la propia reserva antes de que venza. */
export function cancelReservation(ctx) {
  const groupId = ctx.group.groupId;
  const reservation = rolesRepo.reservationOf(groupId, ctx.author.jid);
  if (!reservation) {
    return fail('role.reserve.rejected', { reason: 'No tienes ninguna reserva activa.', command: 'liberarreserva' });
  }
  rolesRepo.unreserve(reservation.id);
  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId,
    actorJid: ctx.author.jid,
    action: 'role.unreserved',
    detail: { roleName: reservation.name },
  });
  return ok('role.released', { roleName: reservation.name, userName: ctx.author.name, command: 'liberarreserva' });
}

/* ═══════════════════════════════════════════════════════════════
   Liberar personaje propio
   ═══════════════════════════════════════════════════════════════ */

/** `.liberar` → pide confirmación. */
export function releaseAsk(ctx) {
  const groupId = ctx.group.groupId;
  const user = usersRepo.get(groupId, ctx.author.jid);
  if (!user) return fail('user.notRegistered', { command: 'liberar', name: null });
  if (!user.role_id) {
    return fail('role.reserve.rejected', { reason: 'No tienes ningún personaje que liberar.', command: 'liberar' });
  }
  const role = rolesRepo.findById(user.role_id);
  confirmationsRepo.create({
    groupId,
    userJid: ctx.author.jid,
    action: 'liberar',
    payload: { roleId: role.id, roleName: role.name },
  });
  return ok('sys.confirm.ask', {
    action: 'liberar',
    description: `Vas a liberar tu personaje ${role.name}. Quedará disponible para todo el team.`,
    ttl: 60,
    command: 'liberar',
  });
}

/** Handler de `.confirmar` para `.liberar`. */
export function releaseExecute(ctx) {
  const groupId = ctx.group.groupId;
  const user = usersRepo.get(groupId, ctx.author.jid);
  if (!user?.role_id) {
    return fail('role.reserve.rejected', { reason: 'No tienes ningún personaje que liberar.', command: 'liberar' });
  }
  const role = rolesRepo.findById(user.role_id);
  tx(() => {
    rolesRepo.release(role.id);
    usersRepo.update(groupId, ctx.author.jid, { role_id: null });
    requestsRepo.cancelAllForUser(groupId, ctx.author.jid, 'personaje liberado por el usuario');
    auditRepo.log({
      instanceId: ctx.instance?.id ?? null,
      groupId,
      actorJid: ctx.author.jid,
      action: 'role.released',
      detail: { roleName: role.name },
    });
  });
  return ok('role.released', {
    roleName: role.name,
    userName: user.name,
    byAdmin: false,
    command: 'liberar',
  }, { actions: [action.refreshGroup()] });
}

registerConfirmAction('liberar', (ctx) => releaseExecute(ctx));

/* ═══════════════════════════════════════════════════════════════
   Administración de personajes
   ═══════════════════════════════════════════════════════════════ */

/** `.resetrol <@usuario>` — libera el personaje de otra persona. */
export function resetRole(ctx, targetJid) {
  const groupId = ctx.group.groupId;
  const target = usersRepo.get(groupId, targetJid);
  if (!target) {
    return fail('sys.invalid', {
      command: 'resetrol',
      message: 'Esa persona no está registrada en este grupo.',
    });
  }
  if (!target.role_id) {
    return fail('sys.invalid', { command: 'resetrol', message: `${target.name} no tiene personaje asignado.` });
  }

  const role = rolesRepo.findById(target.role_id);
  tx(() => {
    rolesRepo.release(role.id);
    usersRepo.update(groupId, target.jid, { role_id: null });
    auditRepo.log({
      instanceId: ctx.instance?.id ?? null,
      groupId,
      actorJid: ctx.author.jid,
      action: 'role.reset',
      targetJid: target.jid,
      detail: { roleName: role.name, admin: ctx.author.name },
    });
  });

  return ok(
    'role.released',
    {
      roleName: role.name,
      userName: target.name,
      byAdmin: true,
      adminName: ctx.author.name,
      mentions: [target.jid],
      command: 'resetrol',
    },
    { actions: [action.refreshGroup()] }
  );
}

/* ═══════════════════════════════════════════════════════════════
   Mantenimiento periódico
   ═══════════════════════════════════════════════════════════════ */

/**
 * Lo llama el temporizador del bot:
 *  · libera reservas vencidas
 *  · expira solicitudes abandonadas
 * Devuelve datos para avisar a los afectados.
 */
export function maintenance() {
  const expiredReservations = rolesRepo.listExpired();
  const released = rolesRepo.releaseExpired();
  const expiredRequests = requestsRepo.expireOlderThan(REQUEST_TTL_MS, ROLE_TYPES);

  for (const reservation of expiredReservations) {
    auditRepo.log({
      groupId: reservation.group_id,
      action: 'role.expired',
      targetJid: reservation.reserved_by,
      detail: { roleName: reservation.name, until: reservation.reserved_until },
    });
  }
  return { releasedReservations: released, expiredRequests, expiredReservations };
}

/** Total de personajes del sistema (para el panel web). */
export function globalRoleStats() {
  const groups = groupsRepo.all();
  let taken = 0;
  let free = 0;
  let reserved = 0;
  for (const group of groups) {
    const counts = rolesRepo.counts(group.group_id);
    taken += counts.taken;
    free += counts.free;
    reserved += counts.reserved;
  }
  return { taken, free, reserved, groups: groups.length };
}
