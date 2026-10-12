/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · eventos de grupo
 * ────────────────────────────────────────────────────────────────
 * · mensajes normales  → actividad, salida de AFK, aviso de menciones
 * · entra alguien      → re-ban si está bloqueado, bienvenida, reactivar ficha
 * · sale alguien       → sincronizar registro (libera rol, pareja, reservas)
 * · promote/demote     → refrescar el espejo de administradores
 */
import { groupsRepo, usersRepo, auditRepo } from '../db/index.js';
import { ensureGroup, invalidateGroupCache, clearGroupCache } from './group-sync.js';
import { normalizeJid, sameUser } from '../utils/ids.js';
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

async function send(ctx, to, payload, options = {}) {
  const text = typeof payload === 'string' ? payload : renderResult(payload);
  if (!text) return null;
  const mentions = [...new Set((options.mentions ?? []).map(normalizeJid).filter(Boolean))];
  let sent = null;
  for (const part of chunkText(text)) {
    const content = { text: part };
    if (mentions.length) content.mentions = mentions;
    sent = await ctx.client.sendMessage(normalizeJid(to), content, {}).catch((error) => {
      log.warn({ err: error, to }, 'no se pudo enviar el mensaje del evento');
      return null;
    });
  }
  return sent;
}

/* ═══════════════════════════════════════════════════════════════
   Mensajes normales (no comando)
   ═══════════════════════════════════════════════════════════════ */

export async function onMessage(ctx) {
  if (!ctx.isGroup) return;

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
  const participants = (event.participants ?? []).map(normalizeJid).filter(Boolean);
  if (!participants.length) return;

  let ctx;
  try {
    ctx = await eventContext({ client, instance, groupJid, actorJid: event.author ?? null });
  } catch (error) {
    log.warn({ err: error, groupJid }, 'no se pudo preparar el contexto del evento de grupo');
    return;
  }

  const botJid = normalizeJid(client.jid);

  for (const jid of participants) {
    // nunca actuar sobre nosotros mismos
    if (sameUser(jid, botJid)) continue;

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
        await send(
          ctx,
          'group',
          {
            view: 'group.welcome',
            data: {
              name: returned?.name ?? client.contactName?.(jid) ?? 'Nuevo integrante',
              groupName: ctx.group.name,
              total: participantsCount,
              mention: `@${jid.split('@')[0]}`,
              registered: Boolean(returned?.restored),
            },
          },
          { mentions: [jid] }
        );
        break;
      }

      case 'remove': {
        const left = registration.syncMemberLeft(ctx, jid, event.author && !sameUser(event.author, jid) ? 'kick' : 'leave');
        if (!ctx.group.config.farewell) break;
        const remaining = usersRepo.counts(groupJid).active;
        await send(ctx, 'group', {
          view: 'group.farewell',
          data: {
            name: left?.name ?? 'Un integrante',
            groupName: ctx.group.name,
            role: left?.role ?? null,
            total: remaining,
            reason: left ? 'leave' : 'leave',
          },
        });
        break;
      }

      case 'promote':
      case 'demote': {
        const metadata = await client.groupMetadata(groupJid).catch(() => null);
        if (metadata) {
          groupsRepo.syncAdmins(groupJid, (metadata.participants ?? []).filter((p) => p.admin));
          groupsRepo.markSynced(groupJid);
        }
        invalidateGroupCache(groupJid);
        auditRepo.log({
          instanceId: instance.id,
          groupId: groupJid,
          actorJid: event.author ?? null,
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
      groupsRepo.syncAdmins(groupJid, participants.filter((p) => p.admin));
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
