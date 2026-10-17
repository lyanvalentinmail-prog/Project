/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · eventos de grupo
 * ────────────────────────────────────────────────────────────────
 * · mensajes normales  → actividad, salida de AFK, aviso de menciones
 * · entra alguien      → re-ban si está bloqueado, bienvenida, reactivar ficha
 * · sale alguien       → sincronizar registro (libera rol, pareja, reservas)
 * · promote/demote     → refrescar el espejo de administradores
 */
import { groupsRepo, usersRepo, auditRepo, mutedRepo } from '../db/index.js';
import { ensureGroup, invalidateGroupCache, clearGroupCache } from './group-sync.js';
import { normalizeJid, sameUser } from '../utils/ids.js';
import { participantJid, adminsFromMetadata } from '../utils/lid.js';
import { renderResult } from '../design/index.js';
import { chunkText } from '../utils/text.js';
import * as teamService from '../services/team.service.js';
import * as registration from '../services/registration.service.js';
import * as moderation from '../services/moderation.service.js';
import { isBotOwner } from '../security/permissions.js';
import { scoped } from './logger.js';

const log = scoped('events');

/** Contexto ligero para eventos (no hay mensaje de usuario detrás). */
async function eventContext({ client, instance, groupJid, actorJid = null }) {
  const { group, botIsAdmin, size } = await ensureGroup({ client, instanceId: instance.id, groupJid });
  const actor = actorJid ? usersRepo.get(group.group_id, normalizeJid(actorJid)) : null;
  return {
    client,
    instance,
    bot: { jid: normalizeJid(client.jid), pushName: client.pushName },
    group: {
      groupId: group.group_id,
      name: group.name,
      config: group.config ?? {},
      locked: Boolean(group.locked),
      size,
      botIsAdmin,
      row: group,
    },
    author: {
      jid: normalizeJid(actorJid) ?? normalizeJid(client.jid),
      name: actor?.name ?? 'Staff',
      user: actor,
      isAdmin: actorJid ? groupsRepo.isAdmin(group.group_id, actorJid) || isBotOwner(actorJid) : true,
      isBotOwner: actorJid ? isBotOwner(actorJid) : false,
      isRegistered: Boolean(actor),
    },
  };
}

/**
 * Destino real de un aviso: los servicios usan destinos simbólicos
 * ('group', 'author'…). Antes se normalizaba 'group' como si fuera un
 * número y el aviso salía hacia «@s.whatsapp.net» (nunca llegaba).
 */
export function eventTarget(ctx, to) {
  if (!to || to === 'group' || to === 'reply') return ctx.group?.groupId ?? ctx.chatJid ?? null;
  if (to === 'author' || to === 'private') return ctx.author?.jid ?? null;
  const jid = normalizeJid(to);
  return jid && jid.includes('@') && !jid.startsWith('@') ? jid : null;
}

async function send(ctx, to, payload, options = {}) {
  const text = typeof payload === 'string' ? payload : renderResult(payload);
  if (!text) return null;
  const target = eventTarget(ctx, to);
  if (!target) {
    log.warn({ to }, 'aviso de evento sin destino válido');
    return null;
  }
  const mentions = [...new Set((options.mentions ?? []).map(normalizeJid).filter(Boolean))];
  let sent = null;
  for (const part of chunkText(text)) {
    const content = { text: part };
    if (mentions.length) content.mentions = mentions;
    sent = await ctx.client.sendMessage(target, content, {}).catch((error) => {
      log.warn({ err: error, to }, 'no se pudo enviar el mensaje del evento');
      return null;
    });
  }
  return sent;
}

/* ═══════════════════════════════════════════════════════════════
   Mensajes normales (no comando)
   ═══════════════════════════════════════════════════════════════ */

/** Enlaces que el .antilink borra cuando los envía un no-admin. */
const ANTILINK_RE = /(https?:\/\/|www\.|chat\.whatsapp\.com|wa\.me\/|t\.me\/|discord\.gg|instagram\.com|tiktok\.com)/i;

export async function onMessage(ctx) {
  if (!ctx.isGroup) return;

  // 0) moderación automática (paquete Raiden): muteos y antienlaces.
  // El staff está exento y sin bot-admin no se puede borrar nada.
  if (ctx.messageId && !ctx.author.isAdmin && ctx.group?.botIsAdmin) {
    try {
      const groupId = ctx.group.groupId;
      if (mutedRepo.isMuted(groupId, ctx.author.jid)) {
        await ctx.client.deleteMessage?.(ctx.chatJid, ctx.raw?.key).catch(() => null);
        return;
      }
      if (ctx.group.config?.antilink && ANTILINK_RE.test(ctx.text ?? '')) {
        await ctx.client.deleteMessage?.(ctx.chatJid, ctx.raw?.key).catch(() => null);
        auditRepo.log({
          instanceId: ctx.instance?.id ?? null,
          groupId,
          actorJid: ctx.author.jid,
          action: 'mod.antilink',
          detail: { length: (ctx.text ?? '').length },
        });
        return;
      }
    } catch {}
  }

  // 1) última actividad (con throttle)
  teamService.touchActivity(ctx);

  // 2) si el autor estaba AFK, sale del estado y se anuncia
  const cleared = teamService.clearAfkOnMessage(ctx);
  if (cleared) await send(ctx, 'group', cleared, { mentions: [ctx.author.jid] });

  // 3) avisos de AFK cuando alguien menciona a una persona ausente
  const mentions = teamService.afkMentions(ctx);
  for (const message of mentions) {
    await send(ctx, message.to, { view: message.view, data: message.data }, { mentions: message.mentions });
  }
}

/* ═══════════════════════════════════════════════════════════════
   Participantes del grupo
   ═══════════════════════════════════════════════════════════════ */

/**
 * @param {object} params
 * @param {{id:string, participants:string[], action:'add'|'remove'|'promote'|'demote', author?:string}} params.event
 */
export async function onParticipantsUpdate({ client, instance, event }) {
  const groupJid = normalizeJid(event.id);
  // Baileys 7 entrega objetos { id, phoneNumber?, lid?, admin } (antes, textos):
  // se trabaja con el número cuando se conoce y con el LID si no.
  const entries = (event.participants ?? []).filter(Boolean);
  client.learnParticipants?.(entries);
  const participants = [...new Set(entries.map((entry) => participantJid(entry, client)).filter(Boolean))];
  if (!participants.length) return;
  const actorJid = event.authorPn
    ? normalizeJid(event.authorPn)
    : event.author ? participantJid(event.author, client) : null;

  let ctx;
  try {
    ctx = await eventContext({ client, instance, groupJid, actorJid });
  } catch (error) {
    log.warn({ err: error, groupJid }, 'no se pudo preparar el contexto del evento de grupo');
    return;
  }

  const botJid = normalizeJid(client.jid);
  const isBot = (jid) => (typeof client.isMe === 'function' ? client.isMe(jid) : sameUser(jid, botJid));
  const botEntry = (jid) => entries.some((entry) => typeof entry === 'object' && participantJid(entry, client) === jid &&
    (isBot(entry.id) || isBot(entry.phoneNumber) || isBot(entry.lid)));

  for (const jid of participants) {
    // nunca actuar sobre nosotros mismos (por número o por LID)
    if (isBot(jid) || botEntry(jid)) continue;

    switch (event.action) {
      case 'add': {
        // lista negra: re-expulsión automática (seguridad + requisito del brief)
        const banned = moderation.checkBannedRejoin(ctx, jid);
        if (banned && ctx.group.botIsAdmin) {
          await client.groupParticipantsUpdate(groupJid, [jid], 'remove').catch((error) => {
            log.warn({ err: error, jid }, 'no se pudo re-expulsar a un usuario baneado');
            return null;
          });
          const user = usersRepo.get(groupJid, jid);
          await send(ctx, 'group', {
            view: 'mod.bannedRejoin',
            data: {
              userName: user?.name ?? 'Un usuario bloqueado',
              reason: banned.reason,
              groupName: ctx.group.name,
            },
          });
          auditRepo.log({
            instanceId: instance.id,
            groupId: groupJid,
            action: 'mod.ban',
            targetJid: jid,
            detail: { automatic: true, reason: banned.reason },
          });
          break;
        }

        const returned = registration.syncMemberReturned(ctx, jid);
        if (!ctx.group.config.welcome) break;

        const participantsCount = ctx.group.size || 0;
        const joinedName = returned?.name ?? client.contactName?.(jid) ?? 'Nuevo integrante';
        await send(
          ctx,
          'group',
          {
            view: 'group.welcome',
            data: {
              name: joinedName,
              groupName: ctx.group.name,
              total: participantsCount,
              mention: `@${jid.split('@')[0]}`,
              registered: Boolean(returned?.restored),
              customText: moderation.renderCustomText(ctx.group.config?.welcome_text, {
                user: joinedName,
                group: ctx.group.name,
                prefix: ctx.instance?.prefix ?? ctx.group.config?.prefix ?? '.',
              }) || null,
            },
          },
          { mentions: [jid] }
        );
        break;
      }

      case 'remove': {
        const samePerson = sameUser(actorJid, jid) || Boolean(client.lids?.same?.(actorJid, jid));
        const left = registration.syncMemberLeft(ctx, jid, actorJid && !samePerson ? 'kick' : 'leave');
        if (!ctx.group.config.farewell) break;
        const remaining = usersRepo.counts(groupJid).active;
        const leftName = left?.name ?? 'Un integrante';
        await send(ctx, 'group', {
          view: 'group.farewell',
          data: {
            name: leftName,
            groupName: ctx.group.name,
            role: left?.role ?? null,
            total: remaining,
            reason: left ? 'leave' : 'leave',
            customText: moderation.renderCustomText(ctx.group.config?.bye_text, {
              user: leftName,
              group: ctx.group.name,
              prefix: ctx.instance?.prefix ?? ctx.group.config?.prefix ?? '.',
            }) || null,
          },
        });
        break;
      }

      case 'promote':
      case 'demote': {
        const metadata = await client.groupMetadata(groupJid).catch(() => null);
        if (metadata) {
          groupsRepo.syncAdmins(groupJid, adminsFromMetadata(metadata, client));
          groupsRepo.markSynced(groupJid);
        }
        invalidateGroupCache(groupJid);
        auditRepo.log({
          instanceId: instance.id,
          groupId: groupJid,
          actorJid: actorJid ?? null,
          action: 'group.sync',
          targetJid: jid,
          detail: { change: event.action },
        });
        break;
      }

      default:
        break;
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   Cambios en el grupo (nombre, descripción, ajustes)
   ═══════════════════════════════════════════════════════════════ */

export async function onGroupUpdate({ client, instance, updates }) {
  for (const update of updates ?? []) {
    const groupJid = normalizeJid(update.id);
    if (!groupJid) continue;
    const row = groupsRepo.get(groupJid);
    if (!row) continue;
    if (update.subject) groupsRepo.setName(groupJid, update.subject);
    if (typeof update.announce === 'boolean') groupsRepo.setLocked(groupJid, update.announce);
    if (update.size) groupsRepo.setSize(groupJid, update.size);
    invalidateGroupCache(groupJid);
  }
}

/** Re-sincronización completa al reconectar (recupera el estado tras una caída). */
export async function resyncAllGroups({ client, instance }) {
  try {
    const participating = await client.groupFetchAllParticipating?.();
    if (!participating) return { synced: 0 };
    let synced = 0;
    for (const [jid, metadata] of Object.entries(participating)) {
      const groupJid = normalizeJid(jid);
      const participants = metadata.participants ?? [];
      groupsRepo.upsert({
        groupId: groupJid,
        instanceId: instance.id,
        name: metadata.subject ?? '',
        waCreatedAt: metadata.creation ? Number(metadata.creation) * 1000 : null,
        size: participants.length,
      });
      groupsRepo.syncAdmins(groupJid, adminsFromMetadata(metadata, client));
      groupsRepo.markSynced(groupJid);
      synced += 1;
    }
    clearGroupCache();
    log.info({ synced, instance: instance.name }, 'grupos resincronizados');
    return { synced };
  } catch (error) {
    log.warn({ err: error }, 'no se pudo resincronizar los grupos');
    return { synced: 0, error: String(error?.message ?? error) };
  }
}
