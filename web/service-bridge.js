/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · puente web ↔ servicios del bot
 * ────────────────────────────────────────────────────────────────
 * El panel reutiliza EXACTAMENTE la misma capa de servicios que el
 * bot (nada de lógica duplicada). Aquí se construye un `ctx` válido
 * a partir de un grupo y se aplican los efectos si hay un sub-bot
 * conectado que pueda enviar los avisos a WhatsApp.
 */
import { groupsRepo, instancesRepo, usersRepo, auditRepo } from '../src/db/index.js';
import { applyResult } from '../src/core/context.js';
import { isBotOwner, rankOf, RANK, RANK_LABEL } from '../src/security/permissions.js';
import { normalizeJid } from '../src/utils/ids.js';
import { renderResult } from '../src/design/index.js';

/** Construye un contexto equivalente al de un mensaje de WhatsApp. */
export async function buildWebContext({ manager, groupId, actorJid = null }) {
  const row = groupsRepo.get(normalizeJid(groupId));
  if (!row) {
    const error = new Error('Grupo no encontrado en la base de datos.');
    error.code = 'GROUP_NOT_FOUND';
    throw error;
  }

  const instance = instancesRepo.byId(row.instance_id);
  const client = instance ? manager.client(instance.id) : null;
  const actorJidNormalized = actorJid ? normalizeJid(actorJid) : null;
  const actorRow = actorJidNormalized ? usersRepo.get(row.group_id, actorJidNormalized) : null;
  const isGroupAdmin = actorJidNormalized ? groupsRepo.isAdmin(row.group_id, actorJidNormalized) : true;

  let botIsAdmin = false;
  if (client?.status === 'open') {
    botIsAdmin = await client.isBotAdmin(row.group_id).catch(() => false);
  }

  const ctx = {
    raw: null,
    message: null,
    messageId: null,
    text: '',
    isGroup: true,
    isPrivate: false,
    fromMe: true,
    mentions: [],
    quoted: null,
    author: {
      jid: actorJidNormalized ?? normalizeJid(instance?.wa_jid ?? '0@s.whatsapp.net'),
      pushName: null,
      name: actorRow?.name ?? 'Panel web',
      user: actorRow,
      isRegistered: Boolean(actorRow),
      isAdmin: isGroupAdmin || isBotOwner(actorJidNormalized),
      isGroupAdmin,
      isBotOwner: isBotOwner(actorJidNormalized) || !actorJidNormalized,
    },
    group: {
      groupId: row.group_id,
      name: row.name,
      config: row.config,
      locked: Boolean(row.locked),
      size: row.size,
      botIsAdmin,
      row,
    },
    instance: instance ?? { id: null, name: '—' },
    bot: { jid: client?.jid ?? null, pushName: client?.pushName ?? null },
    client,
    reply: async () => null,
    send: async () => null,
  };

  ctx.author.rank = rankOf(ctx);
  ctx.author.rankLabel = RANK_LABEL[ctx.author.rank] ?? 'panel';
  ctx.author.rankValue = RANK;
  return ctx;
}

/**
 * Ejecuta el resultado de un servicio desde el panel.
 * Si no hay sub-bot conectado, se aplican igual los cambios de BD y
 * se avisa de que no se pudieron enviar los mensajes a WhatsApp.
 */
export async function applyWebResult(ctx, result) {
  if (!result) return { ok: true, delivered: false, text: null };
  const text = renderResult(result);

  if (!ctx.client || ctx.client.status !== 'open') {
    // sin conexión: registramos la intención para no perder la auditoría
    for (const effect of result.actions ?? []) {
      if (effect.kind === 'audit') {
        auditRepo.log({
          instanceId: ctx.instance?.id ?? null,
          groupId: ctx.group?.groupId ?? null,
          actorJid: ctx.author?.jid ?? null,
          action: effect.action,
          targetJid: effect.targetJid ?? null,
          detail: { ...(effect.detail ?? {}), source: 'web', undelivered: true },
        });
      }
    }
    return { ok: Boolean(result.ok), delivered: false, text, pendingDelivery: (result.extra?.length ?? 0) + 1 };
  }

  const sent = await applyResult(ctx, result);
  return { ok: Boolean(result.ok), delivered: Boolean(sent), text };
}
