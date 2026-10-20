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
import { usersRepo, groupsRepo, warningsRepo, requestsRepo, rolesRepo, confirmationsRepo, auditRepo, mutedRepo, tx } from '../db/index.js';
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
  // historial activo en orden cronológico (la plantilla Tomioka lo lista)
  const history = warningsRepo
    .list(ctx.group.groupId, prepared.jid)
    .reverse()
    .map((entry) => ({ reason: entry.reason || 'sin especificar', createdAt: entry.created_at }));
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
      warnings: history,
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

/* ═══════════════════════════════════════════════════════════════
   Paquete Raiden: rangos, menciones, muteos y toggles del grupo
   ═══════════════════════════════════════════════════════════════ */

const ENABLE_WORDS = new Set(['on', '1', 'enable', 'encendido', 'encender', 'activar', 'activado', 'si', 'sí', 'true']);
const DISABLE_WORDS = new Set(['off', '0', 'disable', 'apagado', 'apagar', 'desactivar', 'desactivado', 'no', 'false']);

function parseToggle(raw) {
  const input = String(raw ?? '').trim().toLowerCase();
  if (!input) return null;
  if (ENABLE_WORDS.has(input)) return true;
  if (DISABLE_WORDS.has(input)) return false;
  return null;
}

function targetName(ctx, jid) {
  const row = usersRepo.get(ctx.group.groupId, jid);
  return row?.name ?? ctx.client?.contactName?.(jid) ?? maskPhone(jid);
}

/** `.promote <@usuario>` — lo hace admin del grupo en WhatsApp. */
export async function promote(ctx, arg = null) {
  const prepared = prepareModeration(ctx, { arg, command: 'promote', needBotAdmin: true });
  if (prepared.error) return prepared.error;
  if (prepared.targetIsAdmin) {
    return fail('sys.invalid', {
      command: 'promote',
      message: `${prepared.targetName} ya es administrador del grupo.`,
    });
  }
  await ctx.client.groupParticipantsUpdate(ctx.group.groupId, [prepared.jid], 'promote').catch(() => null);
  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId: ctx.group.groupId,
    actorJid: ctx.author.jid,
    action: 'mod.promote',
    targetJid: prepared.jid,
    detail: {},
  });
  return ok('mod.promote', {
    userName: prepared.targetName,
    adminName: ctx.author.name,
    mentions: [prepared.jid],
    command: 'promote',
  }, { actions: [action.refreshAdmins()] });
}

/** `.demote <@usuario>` — le quita el admin en WhatsApp. */
export async function demote(ctx, arg = null) {
  const resolved = resolveTarget(ctx, { arg, allowQuoted: true });
  if (!resolved.ok) return fail('mod.denied', { reason: resolved.reason, command: 'demote' });
  const jid = validateUserJid(resolved.value);
  if (!jid.ok) return fail('mod.denied', { reason: jid.reason, command: 'demote' });

  const botAdmin = requireBotAdmin(ctx, 'quitar administradores');
  if (!botAdmin.ok) return fail('mod.denied', { reason: botAdmin.reason, need: botAdmin.need, command: 'demote' });

  const targetIsAdmin = groupsRepo.isAdmin(ctx.group.groupId, jid.value);
  if (!targetIsAdmin) {
    return fail('sys.invalid', {
      command: 'demote',
      message: `${targetName(ctx, jid.value)} no es administrador del grupo.`,
    });
  }
  // No degradar al owner del bot ni al creador del grupo.
  const admins = groupsRepo.listAdmins(ctx.group.groupId);
  const entry = admins.find((a) => a.user_jid === jid.value);
  if (entry?.is_super) {
    return fail('mod.denied', { reason: 'No puedes degradar al creador del grupo.', command: 'demote' });
  }
  if (isBotOwner(jid.value)) {
    return fail('mod.denied', { reason: 'El owner del bot está fuera de tu alcance.', command: 'demote' });
  }

  await ctx.client.groupParticipantsUpdate(ctx.group.groupId, [jid.value], 'demote').catch(() => null);
  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId: ctx.group.groupId,
    actorJid: ctx.author.jid,
    action: 'mod.demote',
    targetJid: jid.value,
    detail: {},
  });
  return ok('mod.demote', {
    userName: targetName(ctx, jid.value),
    adminName: ctx.author.name,
    mentions: [jid.value],
    command: 'demote',
  }, { actions: [action.refreshAdmins()] });
}

/** Participantes reales del grupo desde WhatsApp (ids normalizados). */
export async function groupParticipantJids(ctx) {
  const metadata = await ctx.client.groupMetadata(ctx.group.groupId).catch(() => null);
  const raw = metadata?.participants ?? [];
  const jids = [];
  for (const entry of raw) {
    const id = typeof entry === 'string' ? entry : entry?.id ?? entry?.jid;
    if (!id) continue;
    const normalized = String(id).toLowerCase().replace(/:\d+@/, '@');
    if (normalized && !jids.includes(normalized)) jids.push(normalized);
  }
  // Sin el bot: no tiene sentido mencionarse a sí mismo.
  const botJid = ctx.bot?.jid ? String(ctx.bot.jid).toLowerCase() : null;
  return jids.filter((jid) => jid !== botJid);
}

/** `.tagall [mensaje]` — menciona a todos los participantes. */
export async function tagAll(ctx, rawText = null) {
  const text = String(rawText ?? '').trim() || 'Sin mensaje';
  const jids = await groupParticipantJids(ctx);
  if (!jids.length) {
    return fail('sys.error', { command: 'tagall', message: 'No pude leer la lista de participantes del grupo.' });
  }
  const shown = jids.slice(0, 60).map((jid) => ({ jid, mention: mentionOf(jid), name: targetName(ctx, jid) }));
  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId: ctx.group.groupId,
    actorJid: ctx.author.jid,
    action: 'mod.tagall',
    detail: { total: jids.length, length: text.length },
  });
  return ok('mod.tagall', {
    authorName: ctx.author.name,
    text: text.slice(0, 500),
    total: jids.length,
    shown,
    hidden: Math.max(0, jids.length - shown.length),
    groupName: ctx.group.name,
    mentions: jids,
    command: 'tagall',
  });
}

/** `.notify <mensaje>` — aviso con mención oculta a todos. */
export async function notifyAll(ctx, rawText = null) {
  const text = String(rawText ?? '').trim();
  if (!text) {
    return fail('sys.invalid', {
      command: 'notify',
      message: 'Escribe el mensaje de la notificación.',
      hint: `Ejemplo: ${ctx.prefix ?? '.'}notify Hoy hay evento a las 21:00`,
    });
  }
  const jids = await groupParticipantJids(ctx);
  if (!jids.length) {
    return fail('sys.error', { command: 'notify', message: 'No pude leer la lista de participantes del grupo.' });
  }
  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId: ctx.group.groupId,
    actorJid: ctx.author.jid,
    action: 'mod.notify',
    detail: { total: jids.length, length: text.length },
  });
  return ok('mod.notify', {
    authorName: ctx.author.name,
    text: text.slice(0, 1000),
    total: jids.length,
    groupName: ctx.group.name,
    mentions: jids,
    command: 'notify',
  });
}

/** `.revoke` — revoca el enlace de invitación y genera uno nuevo. */
export async function revokeLink(ctx) {
  const botAdmin = requireBotAdmin(ctx, 'revocar el enlace de invitación');
  if (!botAdmin.ok) return fail('mod.denied', { reason: botAdmin.reason, need: botAdmin.need, command: 'revoke' });
  if (typeof ctx.client?.groupRevokeInvite !== 'function') {
    return fail('sys.error', {
      command: 'revoke',
      message: 'Este cliente de WhatsApp no soporta revocar enlaces.',
    });
  }
  const code = await ctx.client.groupRevokeInvite(ctx.group.groupId).catch(() => null);
  if (!code) {
    return fail('sys.error', { command: 'revoke', message: 'WhatsApp no devolvió el enlace nuevo.' });
  }
  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId: ctx.group.groupId,
    actorJid: ctx.author.jid,
    action: 'mod.revoke',
    detail: {},
  });
  return ok('mod.revoke', {
    link: `https://chat.whatsapp.com/${code}`,
    groupName: ctx.group.name,
    adminName: ctx.author.name,
    command: 'revoke',
  });
}

/* ── muteos ─────────────────────────────────────────────────── */

export function mute(ctx, arg = null, reasonRaw = null) {
  const prepared = prepareModeration(ctx, { arg, command: 'mute', needBotAdmin: false });
  if (prepared.error) return prepared.error;
  const reason = String(reasonRaw ?? '').trim().slice(0, 160) || null;
  mutedRepo.mute(ctx.group.groupId, prepared.jid, { reason: reason ?? '', mutedBy: ctx.author.jid });
  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId: ctx.group.groupId,
    actorJid: ctx.author.jid,
    action: 'mod.mute',
    targetJid: prepared.jid,
    detail: { reason },
  });
  return ok('mod.mute', {
    userName: prepared.targetName,
    reason,
    adminName: ctx.author.name,
    mentions: [prepared.jid],
    command: 'mute',
  });
}

export function unmute(ctx, arg = null) {
  const resolved = resolveTarget(ctx, { arg, allowQuoted: true });
  if (!resolved.ok) return fail('mod.denied', { reason: resolved.reason, command: 'unmute' });
  const jid = validateUserJid(resolved.value);
  if (!jid.ok) return fail('mod.denied', { reason: jid.reason, command: 'unmute' });
  const changed = mutedRepo.unmute(ctx.group.groupId, jid.value);
  if (!changed) {
    return fail('sys.invalid', {
      command: 'unmute',
      message: `${targetName(ctx, jid.value)} no estaba silenciado.`,
    });
  }
  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId: ctx.group.groupId,
    actorJid: ctx.author.jid,
    action: 'mod.unmute',
    targetJid: jid.value,
    detail: {},
  });
  return ok('mod.unmute', {
    userName: targetName(ctx, jid.value),
    adminName: ctx.author.name,
    mentions: [jid.value],
    command: 'unmute',
  });
}

export function muteList(ctx) {
  const entries = mutedRepo.list(ctx.group.groupId).map((m) => ({
    jid: m.user_jid,
    name: targetName(ctx, m.user_jid),
    reason: m.reason || null,
    mutedAt: m.muted_at,
  }));
  return ok('mod.mutelist', {
    entries,
    total: entries.length,
    groupName: ctx.group.name,
    command: 'mutelist',
  });
}

/* ── toggles y textos ───────────────────────────────────────── */

function toggleFeature(ctx, { command, label, get, set, hint }) {
  const raw = ctx.args ?? '';
  const wanted = parseToggle(raw.split(/\s+/)[0] ?? '');
  if (wanted === null) {
    const enabled = Boolean(get());
    return ok('mod.toggle', {
      feature: label,
      enabled,
      statusOnly: true,
      command,
      hint: hint ?? `Usa ${ctx.prefix ?? '.'}${command} on / off`,
    });
  }
  set(wanted);
  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId: ctx.group.groupId,
    actorJid: ctx.author.jid,
    action: 'group.config',
    detail: { key: command, value: wanted },
  });
  return ok('mod.toggle', {
    feature: label,
    enabled: wanted,
    statusOnly: false,
    adminName: ctx.author.name,
    command,
  });
}

export function welcomeToggle(ctx) {
  return toggleFeature(ctx, {
    command: 'welcome',
    label: 'bienvenida automática',
    get: () => ctx.group.config.welcome,
    set: (value) => {
      groupsRepo.setFlag(ctx.group.groupId, 'welcome', value);
      groupsRepo.updateConfig(ctx.group.groupId, { welcome: value });
      ctx.group.config.welcome = value;
    },
  });
}

export function byeToggle(ctx) {
  return toggleFeature(ctx, {
    command: 'bye',
    label: 'despedida automática',
    get: () => ctx.group.config.farewell,
    set: (value) => {
      groupsRepo.setFlag(ctx.group.groupId, 'farewell', value);
      groupsRepo.updateConfig(ctx.group.groupId, { farewell: value });
      ctx.group.config.farewell = value;
    },
  });
}

export function onlyAdminToggle(ctx) {
  return toggleFeature(ctx, {
    command: 'onlyadmin',
    label: 'modo solo administradores',
    get: () => ctx.group.config.adminonly,
    set: (value) => {
      groupsRepo.updateConfig(ctx.group.groupId, { adminonly: value });
      ctx.group.config.adminonly = value;
    },
    hint: `Con el modo activo, solo los admins usan los comandos. Usa ${ctx.prefix ?? '.'}onlyadmin off para abrirlo.`,
  });
}

export function alertsToggle(ctx) {
  return toggleFeature(ctx, {
    command: 'alertas',
    label: 'alertas y avisos del grupo',
    get: () => ctx.group.config.alerts !== false,
    set: (value) => {
      groupsRepo.updateConfig(ctx.group.groupId, { alerts: value });
      ctx.group.config.alerts = value;
    },
  });
}

export function antilinkToggle(ctx) {
  return toggleFeature(ctx, {
    command: 'antilink',
    label: 'protección antienlaces',
    get: () => ctx.group.config.antilink === true,
    set: (value) => {
      groupsRepo.updateConfig(ctx.group.groupId, { antilink: value });
      ctx.group.config.antilink = value;
    },
    hint: `Con el antilink activo se borran los enlaces de no-admins. Usa ${ctx.prefix ?? '.'}antilink off para quitarlo.`,
  });
}

export function setWelcomeText(ctx, raw = null) {
  const text = String(raw ?? '').trim().slice(0, 400);
  if (!text) {
    const current = String(ctx.group.config.welcome_text ?? '').trim();
    return ok('mod.settext', {
      feature: 'mensaje de bienvenida',
      text: current || null,
      statusOnly: true,
      command: 'setwelcome',
      hint: `Ejemplo: ${ctx.prefix ?? '.'}setwelcome ¡Bienvenido al team, {user}! Lee las reglas con {prefix}reglas`,
    });
  }
  groupsRepo.updateConfig(ctx.group.groupId, { welcome_text: text });
  ctx.group.config.welcome_text = text;
  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId: ctx.group.groupId,
    actorJid: ctx.author.jid,
    action: 'group.config',
    detail: { key: 'welcome_text', length: text.length },
  });
  return ok('mod.settext', {
    feature: 'mensaje de bienvenida',
    text,
    statusOnly: false,
    adminName: ctx.author.name,
    command: 'setwelcome',
  });
}

export function setByeText(ctx, raw = null) {
  const text = String(raw ?? '').trim().slice(0, 400);
  if (!text) {
    const current = String(ctx.group.config.bye_text ?? '').trim();
    return ok('mod.settext', {
      feature: 'mensaje de despedida',
      text: current || null,
      statusOnly: true,
      command: 'setbye',
      hint: `Ejemplo: ${ctx.prefix ?? '.'}setbye {user} dejó el team. ¡Suerte!`,
    });
  }
  groupsRepo.updateConfig(ctx.group.groupId, { bye_text: text });
  ctx.group.config.bye_text = text;
  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId: ctx.group.groupId,
    actorJid: ctx.author.jid,
    action: 'group.config',
    detail: { key: 'bye_text', length: text.length },
  });
  return ok('mod.settext', {
    feature: 'mensaje de despedida',
    text,
    statusOnly: false,
    adminName: ctx.author.name,
    command: 'setbye',
  });
}

/** `.testwelcome` — vista previa con tus propios datos. */
export function testWelcome(ctx) {
  return ok('group.welcome', {
    name: ctx.author.name,
    groupName: ctx.group.name,
    total: ctx.group.size || 0,
    mention: mentionOf(ctx.author.jid),
    registered: Boolean(ctx.author.user),
    customText: String(ctx.group.config.welcome_text ?? '').trim() || null,
    preview: true,
    mentions: [ctx.author.jid],
    command: 'testwelcome',
  });
}

/** `.testbye` — vista previa con tus propios datos. */
export function testBye(ctx) {
  return ok('group.farewell', {
    name: ctx.author.name,
    groupName: ctx.group.name,
    role: ctx.author.user?.role_name ?? null,
    total: Math.max(0, (ctx.group.size || 1) - 1),
    reason: 'leave',
    customText: String(ctx.group.config.bye_text ?? '').trim() || null,
    preview: true,
    command: 'testbye',
  });
}

/** Aplica variables {user} {group} {prefix} a un texto custom. */
export function renderCustomText(template, { user, group, prefix } = {}) {
  return String(template ?? '')
    .replace(/\{user\}/gi, String(user ?? ''))
    .replace(/\{group\}/gi, String(group ?? ''))
    .replace(/\{prefix\}/gi, String(prefix ?? '.'))
    .trim();
}
