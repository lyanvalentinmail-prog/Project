/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · servicio de registro
 * ────────────────────────────────────────────────────────────────
 * Reglas que se cumplen aquí (y no en los comandos):
 *  · identificador único = número de WhatsApp dentro del grupo
 *  · sin duplicados (doble protección: consulta + clave primaria)
 *  · nombre no vacío y edad numérica
 *  · `.unreg` exige confirmación y limpia TODO en una transacción
 *  · `.editar` nunca toca el personaje
 *  · al salir del grupo se sincroniza la ficha (seguridad #12)
 */
import { usersRepo, rolesRepo, requestsRepo, auditRepo, confirmationsRepo, tx, groupsRepo } from '../db/index.js';
import { ok, fail, action } from './result.js';
import { parseNameAge } from '../utils/text.js';
import { registerConfirmAction } from '../security/confirm.js';
import { daysSince, formatDate } from '../utils/time.js';

const CONFIRM_TTL_MS = 60_000;

/** `.reg <nombre.edad>` */
export function register(ctx, rawArgs) {
  const parsed = parseNameAge(rawArgs);
  if (!parsed.ok) {
    return fail('reg.rejected', {
      reason: parsed.reason,
      hint: parsed.code === 'FORMAT' ? 'Separa el nombre y la edad con un punto.' : null,
      command: 'reg',
    });
  }

  const existing = usersRepo.get(ctx.group.groupId, ctx.author.jid);
  if (existing) {
    return fail('reg.duplicate', { name: existing.name, since: existing.registered_at, command: 'reg' });
  }

  let user;
  try {
    user = usersRepo.create({
      groupId: ctx.group.groupId,
      jid: ctx.author.jid,
      name: parsed.name,
      age: parsed.age,
      pushName: ctx.author.pushName ?? null,
    });
  } catch (error) {
    if (error.code === 'DUPLICATE') {
      const current = usersRepo.get(ctx.group.groupId, ctx.author.jid);
      return fail('reg.duplicate', {
        name: current?.name ?? parsed.name,
        since: current?.registered_at,
        command: 'reg',
      });
    }
    throw error;
  }

  const counts = usersRepo.counts(ctx.group.groupId);
  return ok(
    'reg.success',
    {
      name: user.name,
      age: user.age,
      phone: user.jid,
      date: user.registered_at,
      total: counts.active,
      groupName: ctx.group.name,
      command: 'reg',
    },
    {
      actions: [
        action.audit({
          action: 'user.register',
          targetJid: user.jid,
          detail: { name: user.name, age: user.age, total: counts.active },
        }),
      ],
    }
  );
}

/** `.unreg` → pide confirmación; todavía no borra nada. */
export function unregisterAsk(ctx) {
  const groupId = ctx.group.groupId;
  const user = usersRepo.get(groupId, ctx.author.jid);
  if (!user) return fail('user.notRegistered', { command: 'unreg', name: null });

  const role = user.role_name ?? null;
  const couple = user.partner_name ?? null;
  const created = confirmationsRepo.create({
    groupId,
    userJid: ctx.author.jid,
    action: 'unreg',
    payload: { name: user.name, role },
    ttlMs: CONFIRM_TTL_MS,
  });

  return ok('reg.unreg.ask', {
    name: user.name,
    role,
    couple,
    ttl: Math.round(CONFIRM_TTL_MS / 1000),
    replaced: created.replaced > 0,
    command: 'unreg',
  });
}

/** Handler real de la confirmación: borra ficha y libera recursos. */
export function unregisterExecute(ctx) {
  const groupId = ctx.group.groupId;
  const user = usersRepo.get(groupId, ctx.author.jid);
  if (!user) return fail('user.notRegistered', { command: 'unreg', name: null });

  const summary = tx(() => {
    const role = user.role_id ? rolesRepo.findById(user.role_id) : null;
    const reservation = rolesRepo.reservationOf(groupId, user.jid);
    const cancelled = requestsRepo.cancelAllForUser(groupId, user.jid, 'registro eliminado');

    if (role?.id) rolesRepo.release(role.id);
    if (reservation?.id) rolesRepo.unreserve(reservation.id);
    if (user.partner_jid) usersRepo.breakCouple(groupId, user.jid, user.partner_jid);

    usersRepo.remove(groupId, user.jid);
    return {
      name: user.name,
      role: role?.name ?? null,
      reservation: reservation?.name ?? null,
      couple: user.partner_name ?? null,
      requests: cancelled,
    };
  });

  return ok('reg.unreg.success', { ...summary, command: 'unreg' }, {
    actions: [
      action.audit({ action: 'user.unregister', targetJid: ctx.author.jid, detail: summary }),
      action.refreshGroup(),
    ],
  });
}

registerConfirmAction('unreg', (ctx) => unregisterExecute(ctx));

/** `.editar <nombre.edad>` — el personaje no se modifica. */
export function editProfile(ctx, rawArgs) {
  const groupId = ctx.group.groupId;
  const user = usersRepo.get(groupId, ctx.author.jid);
  if (!user) return fail('user.notRegistered', { command: 'editar', name: null });

  const parsed = parseNameAge(rawArgs);
  if (!parsed.ok) {
    return fail('reg.rejected', { reason: parsed.reason, hint: 'Ejemplo: .editar Luna.18', command: 'editar' });
  }
  if (parsed.name === user.name && parsed.age === user.age) {
    return fail('sys.invalid', { command: 'editar', message: 'Los datos nuevos son iguales a los actuales.' });
  }

  const before = { name: user.name, age: user.age };
  const after = usersRepo.update(groupId, ctx.author.jid, { name: parsed.name, age: parsed.age });

  return ok(
    'reg.edit.success',
    { before, after: { name: after.name, age: after.age, role: after.role_name ?? null }, command: 'editar' },
    {
      actions: [
        action.audit({
          action: 'user.edit',
          targetJid: ctx.author.jid,
          detail: { before, after: { name: after.name, age: after.age } },
        }),
      ],
    }
  );
}

/** `.ficha` — información propia (con número enmascarado por la plantilla). */
export function card(ctx) {
  const groupId = ctx.group.groupId;
  const user = usersRepo.get(groupId, ctx.author.jid);
  if (!user) return fail('user.notRegistered', { command: 'ficha', name: null });

  const reservation = rolesRepo.reservationOf(groupId, ctx.author.jid);
  const roleRow = user.role_id ? rolesRepo.findById(user.role_id) : null;

  return ok('user.card', {
    name: user.name,
    age: user.age,
    phone: user.jid,
    role: user.role_name,
    roleSince: roleRow?.taken_at ?? null,
    registeredAt: user.registered_at,
    lastActivity: user.last_activity,
    status: user.status,
    warns: user.warn_count,
    maxWarns: ctx.group.config.max_warnings,
    afk: user.afk_reason ? { reason: user.afk_reason, since: user.afk_since } : null,
    partner: user.partner_name ?? null,
    reserved: reservation ? reservation.name : null,
    command: 'ficha',
  });
}

/* ── sincronización de pertenencia al grupo ───────────────────── */

/**
 * Alguien salió / fue expulsado / baneado: libera personaje, reservas,
 * solicitudes, pareja y AFK; conserva la ficha marcada como `left`.
 */
export function syncMemberLeft(ctx, targetJid, reason = 'leave') {
  const groupId = ctx.group?.groupId ?? ctx.groupId;
  const user = usersRepo.get(groupId, targetJid);
  if (!user) return null;

  const summary = tx(() => {
    const role = user.role_id ? rolesRepo.findById(user.role_id) : null;
    const reservation = rolesRepo.reservationOf(groupId, user.jid);
    const cancelled = requestsRepo.cancelAllForUser(groupId, user.jid, `abandonó el grupo (${reason})`);

    if (role?.id) rolesRepo.release(role.id);
    if (reservation?.id) rolesRepo.unreserve(reservation.id);
    if (user.partner_jid) usersRepo.breakCouple(groupId, user.jid, user.partner_jid);

    usersRepo.update(groupId, user.jid, {
      role_id: null,
      afk_reason: null,
      afk_since: null,
      partner_jid: null,
    });
    usersRepo.markLeft(groupId, user.jid, reason === 'ban' ? 'banned' : reason === 'kick' ? 'kicked' : 'left');
    return { name: user.name, role: role?.name ?? null, cancelled };
  });

  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId,
    actorJid: ctx.author?.jid ?? targetJid,
    action: 'user.leave',
    targetJid: user.jid,
    detail: { ...summary, reason },
  });

  return summary;
}

/** Alguien volvió al grupo: reactiva su ficha anterior si existía. */
export function syncMemberReturned(ctx, targetJid) {
  const groupId = ctx.group?.groupId ?? ctx.groupId;
  const user = usersRepo.get(groupId, targetJid);
  if (!user) return null;
  if (user.status === 'active') {
    usersRepo.touch(groupId, user.jid);
    return { name: user.name, restored: false };
  }
  usersRepo.reactivate(groupId, targetJid);
  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId,
    action: 'user.reactivate',
    targetJid: user.jid,
    detail: { previousStatus: user.status },
  });
  return { name: user.name, restored: true, previousStatus: user.status };
}

/* ── helpers ─────────────────────────────────────────────────── */

export const inactivityOf = (user) => daysSince(user?.last_activity);
export const registeredOn = (user) => formatDate(user?.registered_at);

/** Contadores agregados del grupo (los usa `.team`). */
export function groupSummary(ctx) {
  const groupId = ctx.group.groupId;
  return {
    group: groupsRepo.get(groupId),
    users: usersRepo.counts(groupId),
    roles: rolesRepo.counts(groupId),
    admins: groupsRepo.adminCount(groupId),
  };
}
