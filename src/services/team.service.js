/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · servicio de gestión del team
 * ────────────────────────────────────────────────────────────────
 * `.team`, `.miembros`, `.afk`, `.inactivos` y `.config`.
 * Incluye la detección de AFK por menciones (con enfriamiento para
 * no spamear el grupo) y el registro de última actividad.
 */
import { usersRepo, rolesRepo, groupsRepo, requestsRepo, auditRepo } from '../db/index.js';
import { ok, fail, msg } from './result.js';
import { validateAfkReason, validateConfigValue, safeInline } from '../security/validation.js';
import { mention as mentionOf } from '../design/theme.js';
import { formatDuration, daysSince } from '../utils/time.js';
import { IDENTITY } from '../config/identity.js';

/** Escritura de actividad limitada a 1 por minuto por usuario. */
const ACTIVITY_THROTTLE_MS = 60_000;
/** Un mismo AFK solo se anuncia una vez por minuto por objetivo/grupo. */
const AFK_MENTION_COOLDOWN_MS = 60_000;

const lastActivityWrite = new Map(); // `${group}:${jid}` → ts
const afkMentionCooldown = new Map(); // `${group}:${target}` → ts

/** `.team` — resumen general. */
export function teamInfo(ctx) {
  const groupId = ctx.group.groupId;
  const group = groupsRepo.get(groupId) ?? ctx.group.group;
  const users = usersRepo.counts(groupId);
  const roles = rolesRepo.counts(groupId);
  const admins = groupsRepo.adminCount(groupId);

  return ok('team.info', {
    name: IDENTITY.team,
    groupName: group?.name || ctx.group.name,
    createdAt: group?.wa_created_at ?? null,
    members: group?.size ?? users.total,
    registered: users.active,
    rolesTaken: roles.taken,
    rolesTotal: roles.total,
    admins,
    couples: users.couples,
    afk: users.afk,
    instance: ctx.instance?.name ?? IDENTITY.name,
    version: IDENTITY.version,
    command: 'team',
  });
}

/** `.miembros` — lista de registrados. */
export function members(ctx) {
  const groupId = ctx.group.groupId;
  const list = usersRepo.list(groupId, { status: 'active' });
  return ok('team.members', {
    members: list,
    total: list.length,
    groupName: ctx.group.name,
    command: 'miembros',
  });
}

/** `.afk <motivo>` */
export function setAfk(ctx, rawArgs) {
  const groupId = ctx.group.groupId;
  const user = usersRepo.get(groupId, ctx.author.jid);
  if (!user) return fail('user.notRegistered', { command: 'afk', name: null });

  const reason = validateAfkReason(rawArgs);
  if (!reason.ok) return fail('sys.invalid', { command: 'afk', message: reason.reason });

  if (user.afk_reason) {
    usersRepo.setAfk(groupId, ctx.author.jid, reason.value);
    return ok('team.afk.set', {
      name: user.name,
      reason: safeInline(reason.value, 90),
      since: Date.now(),
      command: 'afk',
    });
  }

  usersRepo.setAfk(groupId, ctx.author.jid, reason.value);
  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId,
    actorJid: ctx.author.jid,
    action: 'afk.set',
    detail: { reason: reason.value },
  });

  return ok('team.afk.set', {
    name: user.name,
    reason: safeInline(reason.value, 90),
    since: Date.now(),
    command: 'afk',
  });
}

/**
 * Se llama con cada mensaje no-comando: si el autor estaba AFK,
 * lo saca del estado y devuelve el aviso (o null).
 */
export function clearAfkOnMessage(ctx) {
  const groupId = ctx.group?.groupId;
  if (!groupId) return null;
  const user = usersRepo.get(groupId, ctx.author.jid);
  if (!user?.afk_reason) return null;

  const duration = formatDuration(Date.now() - user.afk_since);
  usersRepo.clearAfk(groupId, ctx.author.jid);
  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId,
    actorJid: ctx.author.jid,
    action: 'afk.clear',
    detail: { duration },
  });

  return ok('team.afk.clear', { name: user.name, duration, mentions: [ctx.author.jid] });
}

/**
 * Si en el mensaje se menciona a alguien AFK, devuelve los avisos a enviar.
 * Con enfriamiento por objetivo para no repetir en cada mención.
 */
export function afkMentions(ctx) {
  const groupId = ctx.group?.groupId;
  if (!groupId || !ctx.group?.config?.afk_mentions) return [];
  const mentions = ctx.mentions ?? [];
  if (!mentions.length) return [];

  const now = Date.now();
  const out = [];

  for (const jid of mentions.slice(0, 5)) {
    if (jid === ctx.author.jid) continue;
    const target = usersRepo.get(groupId, jid);
    if (!target?.afk_reason || target.status !== 'active') continue;

    const key = `${groupId}:${jid}`;
    const last = afkMentionCooldown.get(key) ?? 0;
    if (now - last < AFK_MENTION_COOLDOWN_MS) continue;
    afkMentionCooldown.set(key, now);

    out.push(
      msg('group', 'team.afk.mention', {
        name: target.name,
        reason: safeInline(target.afk_reason, 80),
        since: target.afk_since,
        mentioned: mentionOf(jid),
      }, { mentions: [jid] })
    );
  }
  return out;
}

/** Actualiza `last_activity` con throttle (no castiga el disco). */
export function touchActivity(ctx) {
  const groupId = ctx.group?.groupId;
  if (!groupId) return false;
  const key = `${groupId}:${ctx.author.jid}`;
  const now = Date.now();
  const last = lastActivityWrite.get(key) ?? 0;
  if (now - last < ACTIVITY_THROTTLE_MS) return false;
  lastActivityWrite.set(key, now);
  const exists = usersRepo.exists(groupId, ctx.author.jid);
  if (exists) usersRepo.touch(groupId, ctx.author.jid, now);
  return exists;
}

/** `.inactivos` */
export function inactives(ctx) {
  const groupId = ctx.group.groupId;
  const days = ctx.group.config.inactivity_days;
  const list = usersRepo.listInactives(groupId, days).map((user) => ({
    ...user,
    days: daysSince(user.last_activity),
  }));
  return ok('team.inactives', { list, days, groupName: ctx.group.name, command: 'inactivos' });
}

/** `.config` sin argumentos → muestra la configuración del grupo. */
export function showConfig(ctx) {
  return ok('team.config.list', { config: ctx.group.config, groupName: ctx.group.name, command: 'config' });
}

/** `.config <clave> <valor>` (solo admins). */
export function setConfig(ctx, key, rawValue) {
  const groupId = ctx.group.groupId;
  const validated = validateConfigValue(key, rawValue);
  if (!validated.ok) return fail('sys.invalid', { command: 'config', message: validated.reason });

  const patch = { [validated.field]: validated.value };
  groupsRepo.updateConfig(groupId, patch);
  if (validated.field === 'welcome') groupsRepo.setFlag(groupId, 'welcome', validated.value);
  if (validated.field === 'farewell') groupsRepo.setFlag(groupId, 'farewell', validated.value);

  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId,
    actorJid: ctx.author.jid,
    action: 'group.config',
    detail: { key: validated.field, value: validated.value },
  });

  return ok('team.config.updated', {
    key: validated.label,
    value: validated.display,
    adminName: ctx.author.name,
    command: 'config',
  });
}

/** `.auditoria` — últimos eventos administrativos del grupo. */
export function auditList(ctx) {
  const entries = auditRepo.list(ctx.group.groupId, { limit: 15 });
  return ok('team.audit', { entries, groupName: ctx.group.name, command: 'auditoria' });
}

/** `.reservaspendientes` — solicitudes abiertas (visión de gestión). */
export function openRequestsSummary(ctx) {
  const groupId = ctx.group.groupId;
  const counts = requestsRepo.counts(groupId);
  return counts;
}

/** Limpia los mapas de throttle (tests y mantenimiento). */
export function resetMemory() {
  lastActivityWrite.clear();
  afkMentionCooldown.clear();
}
