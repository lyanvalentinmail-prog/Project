/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · servicio social
 * ────────────────────────────────────────────────────────────────
 * Perfiles, parejas, ship, reglas y staff.
 * Las parejas se escriben SIEMPRE en los dos sentidos dentro de una
 * transacción: no puede quedar una relación a medias.
 */
import { usersRepo, groupsRepo, requestsRepo, confirmationsRepo, auditRepo, tx } from '../db/index.js';
import { ok, fail, msg } from './result.js';
import { registerConfirmAction } from '../security/confirm.js';
import { resolveTarget, validateUserJid } from '../security/validation.js';
import { compatibility, shipVerdict } from '../utils/misc.js';
import { mention as mentionOf } from '../design/theme.js';
import { maskPhone } from '../utils/ids.js';
import { DEFAULT_RULES } from '../config/defaults.js';
import { IDENTITY } from '../config/identity.js';
import { env } from '../config/env.js';
import { isBotOwner } from '../security/permissions.js';

/** Nombre visible de un jid en un grupo (usa la ficha si existe). */
export function displayName(groupId, jid) {
  const user = usersRepo.get(groupId, jid);
  if (user?.name) return user.name;
  return maskPhone(jid);
}

/* ═══════════════════════════════════════════════════════════════
   Perfiles
   ═══════════════════════════════════════════════════════════════ */

/** `.perfil <@usuario>` — sin argumento muestra el propio. */
export function profile(ctx, arg = null) {
  const groupId = ctx.group.groupId;
  let targetJid = ctx.author.jid;

  if (arg !== null || (ctx.mentions ?? []).length) {
    const resolved = resolveTarget(ctx, { arg, allowQuoted: false });
    if (!resolved.ok) return fail('sys.invalid', { command: 'perfil', message: resolved.reason });
    targetJid = resolved.value;
  }

  const user = usersRepo.get(groupId, targetJid);
  if (!user) {
    return fail('sys.invalid', {
      command: 'perfil',
      message: targetJid === ctx.author.jid
        ? 'Todavía no tienes ficha en este grupo. Regístrate con .reg <nombre.edad>.'
        : 'Esa persona no está registrada en este grupo.',
    });
  }

  return ok('user.profile', {
    name: user.name,
    age: user.age,
    role: user.role_name ?? null,
    registeredAt: user.registered_at,
    partner: user.partner_name ?? null,
    afk: user.afk_reason ? { reason: user.afk_reason, since: user.afk_since } : null,
    phone: user.jid,
    warns: user.warn_count,
    isSelf: targetJid === ctx.author.jid,
    command: 'perfil',
  });
}

/* ═══════════════════════════════════════════════════════════════
   Parejas
   ═══════════════════════════════════════════════════════════════ */

/** `.pareja <@usuario>` — envía la propuesta. */
export function proposeCouple(ctx, arg = null) {
  const groupId = ctx.group.groupId;
  if (!ctx.group.config.couple_enabled) {
    return fail('couple.error', { reason: 'El sistema de parejas está desactivado en este grupo.', command: 'pareja' });
  }

  const author = usersRepo.get(groupId, ctx.author.jid);
  if (!author) return fail('user.notRegistered', { command: 'pareja', name: null });

  const resolved = resolveTarget(ctx, { arg, allowQuoted: false });
  if (!resolved.ok) return fail('couple.error', { reason: resolved.reason, command: 'pareja' });

  const targetJid = validateUserJid(resolved.value);
  if (!targetJid.ok) return fail('couple.error', { reason: targetJid.reason, command: 'pareja' });
  if (targetJid.value === ctx.author.jid) {
    return fail('couple.error', { reason: 'No puedes proponerte pareja a ti mismo/a ☕', command: 'pareja' });
  }

  const target = usersRepo.get(groupId, targetJid.value);
  if (!target || target.status !== 'active') {
    return fail('couple.error', {
      reason: 'Esa persona no está registrada en el team. Ambos necesitan ficha.',
      command: 'pareja',
    });
  }
  if (author.partner_jid) {
    return fail('couple.error', { reason: `Ya tienes pareja: ${author.partner_name}.`, command: 'pareja' });
  }
  if (target.partner_jid) {
    return fail('couple.error', { reason: `${target.name} ya tiene pareja: ${target.partner_name}.`, command: 'pareja' });
  }

  const existing = requestsRepo.pendingForTarget(groupId, targetJid.value, 'couple');
  if (existing) {
    return fail('couple.error', {
      reason: `${target.name} ya tiene una propuesta pendiente de ${existing.user_name ?? 'otra persona'}.`,
      command: 'pareja',
    });
  }
  const ownPending = requestsRepo.pendingForUser(groupId, ctx.author.jid, 'couple');
  if (ownPending) {
    return fail('couple.error', {
      reason: `Ya enviaste una propuesta a ${ownPending.target_name ?? 'otra persona'}. Espera su respuesta o usa .cancelarsolicitud.`,
      command: 'pareja',
    });
  }

  const request = requestsRepo.create({
    groupId,
    userJid: ctx.author.jid,
    targetJid: targetJid.value,
    type: 'couple',
  });
  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId,
    actorJid: ctx.author.jid,
    action: 'couple.propose',
    targetJid: targetJid.value,
    detail: { requestId: request.id },
  });

  return ok(
    'couple.proposal',
    {
      fromName: author.name,
      toName: target.name,
      toMention: mentionOf(targetJid.value),
      groupName: ctx.group.name,
      requestId: request.id,
      mentions: [targetJid.value, ctx.author.jid],
      command: 'pareja',
    },
    { linkRequest: request.id }
  );
}

/** `.aceptar` — confirma la propuesta dirigida al autor. */
export function acceptCouple(ctx) {
  const groupId = ctx.group.groupId;
  const request = requestsRepo.pendingForTarget(groupId, ctx.author.jid, 'couple');
  if (!request) {
    return fail('couple.error', { reason: 'No tienes ninguna propuesta de pareja pendiente.', command: 'aceptar' });
  }

  const proposer = usersRepo.get(groupId, request.user_jid);
  const target = usersRepo.get(groupId, request.target_jid);
  if (!proposer || !target || proposer.partner_jid || target.partner_jid) {
    requestsRepo.resolve(request.id, 'cancelled', ctx.author.jid, { reason: 'ya no se cumplen las condiciones' });
    return fail('couple.error', {
      reason: 'La propuesta ya no es válida (alguien tiene pareja o dejó el grupo).',
      command: 'aceptar',
    });
  }

  let summary;
  try {
    summary = tx(() => {
      const claimed = requestsRepo.resolve(request.id, 'approved', ctx.author.jid);
      if (!claimed) {
        const conflict = new Error('already');
        conflict.code = 'ALREADY_RESOLVED';
        throw conflict;
      }
      usersRepo.setCouple(groupId, proposer.jid, target.jid);
      auditRepo.log({
        instanceId: ctx.instance?.id ?? null,
        groupId,
        actorJid: ctx.author.jid,
        action: 'couple.accept',
        targetJid: proposer.jid,
        detail: { requestId: request.id },
      });
      return { a: proposer.name, b: target.name, aJid: proposer.jid, bJid: target.jid };
    });
  } catch (error) {
    if (error.code === 'ALREADY_RESOLVED') {
      return fail('couple.error', { reason: 'Esa propuesta ya fue respondida.', command: 'aceptar' });
    }
    throw error;
  }

  return ok('couple.accepted', {
    a: summary.a,
    b: summary.b,
    mentions: [summary.aJid, summary.bJid],
    command: 'aceptar',
  });
}

/** `.rechazar` — descarta la propuesta dirigida al autor. */
export function rejectCouple(ctx) {
  const groupId = ctx.group.groupId;
  const request = requestsRepo.pendingForTarget(groupId, ctx.author.jid, 'couple');
  if (!request) {
    return fail('couple.error', { reason: 'No tienes ninguna propuesta de pareja pendiente.', command: 'rechazar' });
  }

  const claimed = requestsRepo.resolve(request.id, 'rejected', ctx.author.jid, { reason: 'propuesta rechazada' });
  if (!claimed) return fail('couple.error', { reason: 'Esa propuesta ya fue respondida.', command: 'rechazar' });

  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId,
    actorJid: ctx.author.jid,
    action: 'couple.reject',
    targetJid: request.user_jid,
    detail: { requestId: request.id },
  });

  const fromName = displayName(groupId, request.user_jid);
  const toName = displayName(groupId, request.target_jid);

  return ok('couple.rejected', {
    fromName,
    toName,
    mentions: [request.user_jid],
    command: 'rechazar',
  });
}

/** `.terminar` → pide confirmación. */
export function breakCoupleAsk(ctx) {
  const groupId = ctx.group.groupId;
  const user = usersRepo.get(groupId, ctx.author.jid);
  if (!user) return fail('user.notRegistered', { command: 'terminar', name: null });
  if (!user.partner_jid) {
    return fail('couple.error', { reason: 'No tienes ninguna relación que terminar.', command: 'terminar' });
  }
  confirmationsRepo.create({
    groupId,
    userJid: ctx.author.jid,
    action: 'terminar',
    payload: { partnerJid: user.partner_jid, partnerName: user.partner_name },
  });
  return ok('sys.confirm.ask', {
    action: 'terminar',
    description: `Vas a terminar tu relación con ${user.partner_name}. Ambos perfiles quedarán sin pareja.`,
    ttl: 60,
    command: 'terminar',
  });
}

/** Handler de `.confirmar` para `.terminar`. */
export function breakCoupleExecute(ctx, payload = {}) {
  const groupId = ctx.group.groupId;
  const user = usersRepo.get(groupId, ctx.author.jid);
  if (!user?.partner_jid) {
    return fail('couple.error', { reason: 'No tienes ninguna relación que terminar.', command: 'terminar' });
  }
  const partnerJid = payload.partnerJid ?? user.partner_jid;
  const partnerName = user.partner_name ?? displayName(groupId, partnerJid);

  usersRepo.breakCouple(groupId, ctx.author.jid, partnerJid);
  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId,
    actorJid: ctx.author.jid,
    action: 'couple.break',
    targetJid: partnerJid,
    detail: { partnerName },
  });

  return ok('couple.broken', {
    a: user.name,
    b: partnerName,
    mentions: [partnerJid],
    command: 'terminar',
  });
}

registerConfirmAction('terminar', (ctx, payload) => breakCoupleExecute(ctx, payload));

/* ═══════════════════════════════════════════════════════════════
   Ship (no modifica nada)
   ═══════════════════════════════════════════════════════════════ */

/** `.ship <@usuario> <@usuario>` — con una mención, se shipea con el autor. */
export function ship(ctx) {
  const groupId = ctx.group.groupId;
  const mentions = ctx.mentions ?? [];

  let aJid;
  let bJid;
  if (mentions.length >= 2) {
    [aJid, bJid] = mentions;
  } else if (mentions.length === 1) {
    aJid = ctx.author.jid;
    bJid = mentions[0];
  } else {
    return fail('sys.invalid', {
      command: 'ship',
      message: 'Menciona a una o dos personas. Ejemplo: .ship @persona1 @persona2',
    });
  }

  if (aJid === bJid) {
    return fail('sys.invalid', { command: 'ship', message: 'No puedes shipear a la misma persona consigo misma.' });
  }

  const aName = displayName(groupId, aJid);
  const bName = displayName(groupId, bJid);
  const percent = compatibility(aJid, bJid);

  return ok('social.ship', {
    aName,
    bName,
    percent,
    verdict: shipVerdict(percent),
    mentions: [aJid, bJid],
    command: 'ship',
  });
}

/* ═══════════════════════════════════════════════════════════════
   Información del grupo
   ═══════════════════════════════════════════════════════════════ */

/** `.reglas` */
export function rules(ctx) {
  return ok('social.rules', {
    text: ctx.group.config.rules || DEFAULT_RULES,
    groupName: ctx.group.name,
    command: 'reglas',
  });
}

/** `.admins` — staff real del grupo, sincronizado desde WhatsApp. */
export function admins(ctx) {
  const groupId = ctx.group.groupId;
  const rows = groupsRepo.listAdmins(groupId).map((admin) => {
    const user = usersRepo.get(groupId, admin.user_jid);
    return {
      user_jid: admin.user_jid,
      is_super: admin.is_super,
      name: user?.name ?? (admin.is_super ? 'Owner del grupo' : 'Sin ficha'),
      role_name: user?.role_name ?? null,
      is_bot_owner: isBotOwner(admin.user_jid),
    };
  });

  return ok('social.admins', {
    admins: rows,
    count: rows.length,
    groupName: ctx.group.name,
    botIsAdmin: Boolean(ctx.group.botIsAdmin),
    ownerMention: ctx.bot?.jid ? mentionOf(ctx.bot.jid) : null,
    command: 'admins',
  });
}

/** `.owner` — quién es el dueño del bot (número enmascarado por privacidad). */
export function ownerCard(ctx) {
  const ownerNumber = env.ownerNumbers[0] ?? null;
  return ok('sys.owner', {
    ownerMasked: ownerNumber ? maskPhone(ownerNumber) : 'no configurado en .env',
    team: IDENTITY.team,
    botName: IDENTITY.name,
    version: IDENTITY.version,
    isOwner: isBotOwner(ctx.author.jid),
    command: 'owner',
  });
}
