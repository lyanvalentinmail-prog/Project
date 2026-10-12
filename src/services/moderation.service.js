/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · servicio de moderación
 * ────────────────────────────────────────────────────────────────
 * warn / unwarn / expulsar / ban / unban / anuncio / close / open.
 *
 * Todo pasa por tres filtros antes de tocar WhatsApp:
 *   1. ¿quién lo pide tiene rango suficiente?
 *   2. ¿el objetivo es moderable por esa persona?
 *   3. ¿el bot es admin del grupo?
 * Y las acciones destructivas piden confirmación por texto.
 */
import { usersRepo, groupsRepo, warningsRepo, requestsRepo, rolesRepo, confirmationsRepo, auditRepo, tx } from '../db/index.js';
import { ok, fail, msg, action } from './result.js';
import { registerConfirmAction } from '../security/confirm.js';
import { canModerate, requireBotAdmin, isBotOwner } from '../security/permissions.js';
import { resolveTarget, validateReason, validateAnnouncement, validateUserJid, safeInline } from '../security/validation.js';
import { mention as mentionOf } from '../design/theme.js';
import { maskPhone } from '../utils/ids.js';
import { syncMemberLeft } from './registration.service.js';
import { IDENTITY } from '../config/identity.js';

/** Resuelve objetivo + validaciones comunes de moderación. */
function prepareModeration(ctx, { arg, command, needBotAdmin = true }) {
  const resolved = resolveTarget(ctx, { arg, allowQuoted: true });
  if (!resolved.ok) return { error: fail('mod.denied', { reason: resolved.reason, command }) };

  const jid = validateUserJid(resolved.value);
  if (!jid.ok) return { error: fail('mod.denied', { reason: jid.reason, command }) };

  const target = usersRepo.get(ctx.group.groupId, jid.value);
  const targetIsAdmin = groupsRepo.isAdmin(ctx.group.groupId, jid.value);

  const allowed = canModerate(ctx, { jid: jid.value, isAdmin: targetIsAdmin });
  if (!allowed.ok) return { error: fail('mod.denied', { reason: allowed.reason, command }) };

  if (needBotAdmin) {
    const botAdmin = requireBotAdmin(ctx, command === 'ban' ? 'banear' : 'expulsar');
    if (!botAdmin.ok) return { error: fail('mod.denied', { reason: botAdmin.reason, need: botAdmin.need, command }) };
  }

  return {
    jid: jid.value,
    target,
    targetIsAdmin,
    targetName: target?.name ?? (safeInline(ctx.quoted?.pushName ?? '', 24) || maskPhone(jid.value)),
  };
}

/* ═══════════════════════════════════════════════════════════════
   Advertencias
   ═══════════════════════════════════════════════════════════════ */

/** `.warn <@usuario> <motivo>` — a las 3 (configurable) expulsa solo. */
export function warn(ctx, arg = null, reasonRaw = null) {
  const prepared = prepareModeration(ctx, { arg, command: 'warn', needBotAdmin: false });
  if (prepared.error) return prepared.error;

  const reason = validateReason(reasonRaw, { max: 160, required: true, label: 'motivo del warn' });
  if (!reason.ok) {
    return fail('sys.invalid', {
      command: 'warn',
      message: reason.reason,
      hint: 'Ejemplo: .warn @usuario Spam en el grupo',
    });
  }

  // Se puede advertir a cualquier participante, tenga ficha o no:
  // la tabla warnings vive independiente de users.
  const targetUser = usersRepo.get(ctx.group.groupId, prepared.jid);
  const targetName = targetUser?.name ?? prepared.targetName;
  const max = ctx.group.config.max_warnings;
  const { warning, total } = warningsRepo.add(ctx.group.groupId, prepared.jid, {
    reason: reason.value,
    adminJid: ctx.author.jid,
  });
  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId: ctx.group.groupId,
    actorJid: ctx.author.jid,
    action: 'warn.add',
    targetJid: prepared.jid,
    detail: { reason: reason.value, total, warningId: warning.id },
  });

  // el aviso principal ya se envía al grupo con la mención: no se duplica
  const extra = [];
  const actions = [action.refreshGroup()];

  if (total >= max) {
    const botAdmin = requireBotAdmin(ctx, 'ejecutar la expulsión automática');
    if (botAdmin.ok) {
      actions.push(action.kick(prepared.jid));
      syncMemberLeft(ctx, prepared.jid, 'kick');
      auditRepo.log({
        instanceId: ctx.instance?.id ?? null,
        groupId: ctx.group.groupId,
        actorJid: ctx.author.jid,
        action: 'mod.kick',
        targetJid: prepared.jid,
        detail: { reason: `acumuló ${total} advertencias`, automatic: true },
      });
      extra.push(
        msg('group', 'mod.kick', {
          userName: targetName,
          adminName: `${IDENTITY.name} (automático)`,
          reason: `Acumuló ${total}/${max} advertencias.`,
          banned: false,
        })
      );
    } else {
      extra.push(
        msg('group', 'mod.denied', {
          reason: `${targetName} llegó a ${total}/${max} advertencias, pero no soy admin del grupo y no puedo expulsarle.`,
          need: 'Dame permisos de administrador para aplicar la sanción automática.',
        })
      );
    }
  }

  return ok(
    'mod.warn',
    {
      userName: targetName,
      userMention: mentionOf(prepared.jid),
      reason: safeInline(reason.value, 120),
      adminName: ctx.author.name,
      count: total,
      max,
      mentions: [prepared.jid],
      command: 'warn',
    },
    { extra, actions }
  );
}

/** `.unwarn <@usuario>` — quita la advertencia más reciente. */
export function unwarn(ctx, arg = null) {
  const prepared = prepareModeration(ctx, { arg, command: 'unwarn', needBotAdmin: false });
  if (prepared.error) return prepared.error;

  const result = warningsRepo.revokeLast(ctx.group.groupId, prepared.jid, ctx.author.jid);
  if (!result) {
    return fail('sys.invalid', { command: 'unwarn', message: `${prepared.targetName} no tiene advertencias activas.` });
  }

  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId: ctx.group.groupId,
    actorJid: ctx.author.jid,
    action: 'warn.remove',
    targetJid: prepared.jid,
    detail: { warningId: result.warning.id, total: result.total },
  });

  return ok('mod.unwarn', {
    userName: prepared.targetName,
    count: result.total,
    adminName: ctx.author.name,
    mentions: [prepared.jid],
    command: 'unwarn',
  });
}

/** `.warns <@usuario>` — historial de advertencias. */
export function warnHistory(ctx, arg = null) {
  const prepared = prepareModeration(ctx, { arg, command: 'warns', needBotAdmin: false });
  if (prepared.error) return prepared.error;
  const list = warningsRepo.list(ctx.group.groupId, prepared.jid, { includeRevoked: true });
  if (!list.length) {
    return fail('sys.invalid', { command: 'warns', message: `${prepared.targetName} no tiene advertencias registradas.` });
  }
  return ok('mod.warnHistory', {
    userName: prepared.targetName,
    entries: list,
    active: list.filter((w) => !w.revoked_at).length,
    command: 'warns',
  });
}

/* ═══════════════════════════════════════════════════════════════
   Expulsión y ban (con confirmación)
   ═══════════════════════════════════════════════════════════════ */

/** `.expulsar <@usuario> [motivo]` → pide confirmación. */
export function kickAsk(ctx, arg = null, reasonRaw = null) {
  const prepared = prepareModeration(ctx, { arg, command: 'expulsar' });
  if (prepared.error) return prepared.error;
  const reason = validateReason(reasonRaw, { max: 160 }).value ?? 'decisión del staff';

  confirmationsRepo.create({
    groupId: ctx.group.groupId,
    userJid: ctx.author.jid,
    action: 'moderate',
    payload: { mode: 'kick', targetJid: prepared.jid, targetName: prepared.targetName, reason },
  });

  return ok('sys.confirm.ask', {
    action: 'expulsar',
    description: `Vas a expulsar a ${prepared.targetName} del grupo. Motivo: ${safeInline(reason, 80)}`,
    ttl: 60,
    command: 'expulsar',
  });
}

/** `.ban <@usuario> [motivo]` → pide confirmación. */
export function banAsk(ctx, arg = null, reasonRaw = null) {
  const prepared = prepareModeration(ctx, { arg, command: 'ban' });
  if (prepared.error) return prepared.error;
  const reason = validateReason(reasonRaw, { max: 160 }).value ?? 'baneado por el staff';

  confirmationsRepo.create({
    groupId: ctx.group.groupId,
    userJid: ctx.author.jid,
    action: 'moderate',
    payload: { mode: 'ban', targetJid: prepared.jid, targetName: prepared.targetName, reason },
  });

  return ok('sys.confirm.ask', {
    action: 'ban',
    description: `Vas a banear a ${prepared.targetName}: expulsión + lista negra (si vuelve, se le expulsa otra vez). Motivo: ${safeInline(reason, 80)}`,
    ttl: 60,
    command: 'ban',
  });
}

/** Handler de `.confirmar` para expulsar/banear. */
export function moderateExecute(ctx, payload = {}) {
  const { mode = 'kick', targetJid, targetName, reason = 'decisión del staff' } = payload;
  if (!targetJid) return fail('mod.denied', { reason: 'La confirmación no incluye objetivo.', command: mode });

  const botAdmin = requireBotAdmin(ctx, mode === 'ban' ? 'banear' : 'expulsar');
  if (!botAdmin.ok) return fail('mod.denied', { reason: botAdmin.reason, need: botAdmin.need, command: mode });

  const targetIsAdmin = groupsRepo.isAdmin(ctx.group.groupId, targetJid);
  const allowed = canModerate(ctx, { jid: targetJid, isAdmin: targetIsAdmin });
  if (!allowed.ok) return fail('mod.denied', { reason: allowed.reason, command: mode });

  const groupId = ctx.group.groupId;
  const user = usersRepo.get(groupId, targetJid);
  const name = user?.name ?? targetName ?? 'ese integrante';

  tx(() => {
    if (mode === 'ban') {
      groupsRepo.block(groupId, targetJid, { reason, bannedBy: ctx.author.jid });
      if (user) usersRepo.update(groupId, targetJid, { status: 'banned' });
    }
    syncMemberLeft(ctx, targetJid, mode === 'ban' ? 'ban' : 'kick');
    auditRepo.log({
      instanceId: ctx.instance?.id ?? null,
      groupId,
      actorJid: ctx.author.jid,
      action: mode === 'ban' ? 'mod.ban' : 'mod.kick',
      targetJid,
      detail: { reason, name },
    });
  });

  return ok(
    'mod.kick',
    {
      userName: name,
      adminName: ctx.author.name,
      reason: safeInline(reason, 120),
      banned: mode === 'ban',
      mentions: [targetJid],
      command: mode,
    },
    { actions: [action.kick(targetJid), action.refreshGroup(), action.refreshAdmins()] }
  );
}

registerConfirmAction('moderate', (ctx, payload) => moderateExecute(ctx, payload));

/** `.unban <@usuario o número>` — quita de la lista negra. */
export function unban(ctx, arg = null) {
  const groupId = ctx.group.groupId;
  const resolved = resolveTarget(ctx, { arg, allowQuoted: false });
  if (!resolved.ok) return fail('mod.denied', { reason: resolved.reason, command: 'unban' });
  const jid = validateUserJid(resolved.value);
  if (!jid.ok) return fail('mod.denied', { reason: jid.reason, command: 'unban' });

  if (!groupsRepo.isBlocked(groupId, jid.value)) {
    return fail('sys.invalid', { command: 'unban', message: 'Ese usuario no está en la lista de bloqueados.' });
  }
  groupsRepo.unblock(groupId, jid.value);
  const user = usersRepo.get(groupId, jid.value);
  if (user && user.status === 'banned') usersRepo.update(groupId, jid.value, { status: 'left' });

  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId,
    actorJid: ctx.author.jid,
    action: 'mod.unban',
    targetJid: jid.value,
    detail: { name: user?.name ?? null },
  });

  const name = user?.name ?? mentionOf(jid.value);
  return ok('mod.unban', { userName: name, adminName: ctx.author.name, mentions: [jid.value], command: 'unban' });
}

/** `.bloqueados` — lista negra del grupo. */
export function blockedList(ctx) {
  const groupId = ctx.group.groupId;
  const list = groupsRepo.listBlocked(groupId);
  if (!list.length) {
    return fail('sys.invalid', { command: 'bloqueados', message: 'La lista de bloqueados está vacía.' });
  }
  const entries = list.map((b) => {
    const user = usersRepo.get(groupId, b.user_jid);
    return { name: user?.name ?? mentionOf(b.user_jid), reason: b.reason, jid: b.user_jid };
  });
  return ok('mod.blockedList', { entries, total: entries.length, groupName: ctx.group.name, command: 'bloqueados' });
}

/** Se llama desde los eventos cuando alguien entra al grupo. */
export function checkBannedRejoin(ctx, participantJid) {
  const groupId = ctx.group.groupId;
  if (!groupsRepo.isBlocked(groupId, participantJid)) return null;
  const blocked = groupsRepo.listBlocked(groupId).find((b) => b.user_jid === participantJid);
  return { blocked: true, reason: blocked?.reason ?? '—', jid: participantJid };
}

/* ═══════════════════════════════════════════════════════════════
   Anuncios y ajustes del grupo
   ═══════════════════════════════════════════════════════════════ */

/** `.anuncio <mensaje>` — con `@todos` al inicio menciona a los registrados. */
export function announce(ctx, rawArgs) {
  const groupId = ctx.group.groupId;
  let text = String(rawArgs ?? '').trim();
  let mentionAll = false;

  if (/^@(todos|all|everyone)\b/i.test(text)) {
    mentionAll = true;
    text = text.replace(/^@(todos|all|everyone)\b\s*/i, '');
  }

  const validated = validateAnnouncement(text);
  if (!validated.ok) return fail('sys.invalid', { command: 'anuncio', message: validated.reason });

  const [firstLine, ...rest] = validated.value.split('\n');
  const title = firstLine.length <= 60 && rest.length ? firstLine : null;
  const body = title ? rest.join('\n').trim() : validated.value;

  const members = mentionAll ? usersRepo.list(groupId, { status: 'active' }) : [];
  const mentions = members.slice(0, 100).map((m) => m.jid);

  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId,
    actorJid: ctx.author.jid,
    action: 'group.announce',
    detail: { title, length: validated.value.length, mentionAll },
  });

  return ok(
    'mod.announcement',
    {
      title,
      text: body,
      authorName: ctx.author.name,
      groupName: ctx.group.name,
      mentions: mentions.map(mentionOf),
      command: 'anuncio',
    },
    { extra: [] }
  );
}

/** `.close` — solo admins pueden escribir. */
export function closeGroup(ctx) {
  const botAdmin = requireBotAdmin(ctx, 'cerrar el grupo');
  if (!botAdmin.ok) return fail('mod.denied', { reason: botAdmin.reason, need: botAdmin.need, command: 'close' });
  if (ctx.group.locked) {
    return fail('sys.invalid', { command: 'close', message: 'El grupo ya está cerrado.' });
  }
  groupsRepo.setLocked(ctx.group.groupId, true);
  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId: ctx.group.groupId,
    actorJid: ctx.author.jid,
    action: 'group.close',
    detail: {},
  });
  return ok('mod.groupClosed', { adminName: ctx.author.name, command: 'close' }, {
    actions: [action.groupSetting('announcement')],
  });
}

/** `.open` — todos pueden escribir de nuevo. */
export function openGroup(ctx) {
  const botAdmin = requireBotAdmin(ctx, 'abrir el grupo');
  if (!botAdmin.ok) return fail('mod.denied', { reason: botAdmin.reason, need: botAdmin.need, command: 'open' });
  if (!ctx.group.locked) {
    return fail('sys.invalid', { command: 'open', message: 'El grupo ya está abierto.' });
  }
  groupsRepo.setLocked(ctx.group.groupId, false);
  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId: ctx.group.groupId,
    actorJid: ctx.author.jid,
    action: 'group.open',
    detail: {},
  });
  return ok('mod.groupOpened', { adminName: ctx.author.name, command: 'open' }, {
    actions: [action.groupSetting('not_announcement')],
  });
}

/** Traduce los códigos de error reales de WhatsApp al añadir participantes. */
export function explainAddStatus(status) {
  const map = {
    200: 'Se añadió correctamente.',
    403: 'WhatsApp lo impide: esa persona no admite que la añadan a grupos (privacidad) o el grupo requiere aprobación.',
    408: 'El usuario salió del grupo hace poco y WhatsApp bloquea reañadirlo temporalmente.',
    409: 'Ya es miembro del grupo.',
    500: 'Error del servidor de WhatsApp. Intenta más tarde.',
    501: 'Esta función no está disponible para el grupo (restricción de la plataforma).',
  };
  return map[Number(status)] ?? `WhatsApp respondió con el código ${status}.`;
}

/** Enlace de invitación real del grupo (la vía fiable para añadir gente). */
export async function inviteLink(ctx) {
  const botAdmin = requireBotAdmin(ctx, 'obtener el enlace de invitación');
  if (!botAdmin.ok) return fail('mod.denied', { reason: botAdmin.reason, need: botAdmin.need, command: 'invite' });
  const link = await ctx.client.groupInviteCode(ctx.group.groupId).catch(() => null);
  if (!link) {
    return fail('sys.error', { command: 'invite', message: 'WhatsApp no devolvió el enlace del grupo.' });
  }
  return ok('mod.invite', {
    link: `https://chat.whatsapp.com/${link}`,
    groupName: ctx.group.name,
    adminName: ctx.author.name,
    command: 'invite',
  });
}

/** ¿El autor es el owner del bot? (lo usan varios comandos) */
export const authorIsBotOwner = (ctx) => isBotOwner(ctx.author?.jid);
