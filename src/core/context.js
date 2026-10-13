/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · contexto de mensaje
 * ────────────────────────────────────────────────────────────────
 * Traduce un mensaje crudo de Baileys a un `ctx` limpio y neutro,
 * y es el ÚNICO lugar que ejecuta efectos sobre WhatsApp
 * (enviar mensajes, expulsar, cambiar ajustes del grupo).
 */
import { usersRepo, groupsRepo, requestsRepo, auditRepo, instancesRepo } from '../db/index.js';
import { isBotOwner, rankOf, RANK, RANK_LABEL } from '../security/permissions.js';
import { normalizeJid, isGroupJid, maskPhone } from '../utils/ids.js';
import { chunkText } from '../utils/text.js';
import { ensureGroup, invalidateGroupCache } from './group-sync.js';
import { renderResult, setRenderPrefix } from '../design/index.js';

/* ═══════════════════════════════════════════════════════════════
   Lectura del mensaje de WhatsApp
   ═══════════════════════════════════════════════════════════════ */

/** Desenvuelve mensajes efímeros / de una sola vista. */
export function unwrapMessage(rawMessage) {
  let m = rawMessage?.message;
  if (!m) return null;
  if (m.ephemeralMessage?.message) m = m.ephemeralMessage.message;
  if (m.viewOnceMessage?.message) m = m.viewOnceMessage.message;
  if (m.viewOnceMessageV2?.message) m = m.viewOnceMessageV2.message;
  return m ?? null;
}

/** Tipos que el bot ignora por completo (no son texto útil). */
const IGNORED_TYPES = [
  'protocolMessage',
  'reactionMessage',
  'stickerMessage',
  'contactMessage',
  'locationMessage',
  'productMessage',
  'orderMessage',
  'paymentMessage',
  'pollCreationMessage',
  'pollUpdateMessage',
  'callLogMessage',
];

export function extractText(m) {
  if (!m) return '';
  const text =
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    m.documentMessage?.caption ??
    m.locationMessage?.name ??
    '';
  return String(text ?? '');
}

export function extractMentions(m) {
  const list = [
    ...(m?.extendedTextMessage?.contextInfo?.mentionedJid ?? []),
    ...(m?.messageContextInfo?.messageContextInfo?.mentionedJid ?? []),
    ...(m?.contextInfo?.mentionedJid ?? []),
  ];
  // menciones ocultas en el texto (@123456@s.whatsapp.net aparece como número)
  return [...new Set(list.map(normalizeJid).filter(Boolean))];
}

export function extractQuoted(m) {
  const info = m?.extendedTextMessage?.contextInfo;
  if (!info?.quotedMessage) return null;
  const quotedInner = unwrapMessage({ message: info.quotedMessage }) ?? info.quotedMessage;
  return {
    messageId: info.stanzaId ?? null,
    participant: normalizeJid(info.participant ?? null),
    text: extractText(quotedInner),
    fromMe: Boolean(info.fromMe),
  };
}

export const isIgnorableType = (m) => Boolean(m) && IGNORED_TYPES.some((type) => m[type]);

/* ═══════════════════════════════════════════════════════════════
   Construcción del contexto
   ═══════════════════════════════════════════════════════════════ */

/**
 * @param {object} params
 * @param {object} params.raw mensaje WAMessage de Baileys
 * @param {object} params.instance fila de bot_instances
 * @param {object} params.client adaptador de WhatsApp (bot-client.js)
 */
export async function createContext({ raw, instance, client }) {
  const m = unwrapMessage(raw);
  const chatJid = normalizeJid(raw.key?.remoteJid);
  const isGroup = isGroupJid(chatJid);
  const authorJid = normalizeJid(isGroup ? raw.participant ?? raw.key?.participant : chatJid);
  const messageId = raw.key?.id ?? null;
  const fromMe = Boolean(raw.key?.fromMe);

  // fila fresca de la instancia: el panel puede activarla/cambiar su
  // prefijo mientras el bot está conectado y el contexto lo refleja
  const instanceRow = (instance?.id ? instancesRepo.byId(instance.id) : null) ?? instance;

  const text = extractText(m);
  const mentions = extractMentions(m);
  const quoted = extractQuoted(m);

  let groupCtx = null;
  if (isGroup) {
    const synced = await ensureGroup({ client, instanceId: instanceRow.id, groupJid: chatJid });
    const row = synced.group;
    groupCtx = {
      groupId: row.group_id ?? chatJid,
      name: row.name || 'Grupo del team',
      config: row.config ?? {},
      locked: Boolean(row.locked),
      size: synced.size,
      botIsAdmin: synced.botIsAdmin,
      row,
    };
  }

  const userRow = groupCtx ? usersRepo.get(groupCtx.groupId, authorJid) : null;
  const isAdmin = groupCtx ? groupsRepo.isAdmin(groupCtx.groupId, authorJid) : false;
  const authorIsBotOwner = isBotOwner(authorJid);
  const pushName = raw.pushName ?? raw.notify ?? userRow?.push_name ?? null;
  const displayName = userRow?.name ?? pushName ?? maskPhone(authorJid);

  const ctx = {
    // mensaje
    raw,
    message: m,
    messageId,
    text,
    isGroup,
    isPrivate: !isGroup,
    fromMe,
    mentions,
    quoted,
    // autor
    author: {
      jid: authorJid,
      pushName,
      name: displayName,
      user: userRow,
      isRegistered: Boolean(userRow) && userRow.status === 'active',
      isAdmin: isAdmin || authorIsBotOwner,
      isGroupAdmin: isAdmin,
      isBotOwner: authorIsBotOwner,
    },
    // grupo
    group: groupCtx,
    // bot
    instance: instanceRow,
    bot: { jid: normalizeJid(client.jid), pushName: client.pushName },
    client,
    // helpers
    reply: (payload, options = {}) => sendMessage(ctx, options.to ?? 'reply', payload, options),
    send: (to, payload, options = {}) => sendMessage(ctx, to, payload, options),
  };

  ctx.author.rank = rankOf(ctx);
  ctx.author.rankLabel = RANK_LABEL[ctx.author.rank];
  ctx.author.rankValue = RANK;
  return ctx;
}

/* ═══════════════════════════════════════════════════════════════
   Envío de mensajes y ejecución de efectos
   ═══════════════════════════════════════════════════════════════ */

/** Resuelve el destino simbólico ('group' | 'author' | 'reply' | jid). */
export function resolveTarget(ctx, to) {
  if (!to || to === 'reply' || to === 'group') return ctx.group?.groupId ?? ctx.author.jid;
  if (to === 'author') return ctx.author.jid;
  if (to === 'private') return ctx.author.jid;
  return normalizeJid(to);
}

/**
 * Envía texto (o un resultado de servicio) a un destino.
 * Parte automáticamente los mensajes largos.
 */
export async function sendMessage(ctx, to, payload, options = {}) {
  // cada sub-bot puede tener su propio prefijo: se fija antes de renderizar
  setRenderPrefix(ctx?.instance?.prefix ?? ctx?.prefix);
  const text = typeof payload === 'string' ? payload : renderResult(payload);
  if (!text) return null;

  const target = resolveTarget(ctx, to);
  const mentions = [...new Set([...(options.mentions ?? []), ...(payload?.data?.mentions ?? [])].map(normalizeJid).filter(Boolean))];
  const quoted = options.quoted === false ? null : options.quotedMessage ?? (to === 'reply' ? ctx.raw : null);

  const sent = [];
  for (const chunk of chunkText(text)) {
    const content = { text: chunk };
    if (mentions.length) content.mentions = mentions;
    const result = await ctx.client.sendMessage(target, content, quoted ? { quoted } : {});
    if (result) sent.push(result);
  }
  return sent[0] ?? null;
}

/**
 * Ejecuta el resultado completo de un servicio:
 * respuesta principal + mensajes extra + efectos sobre WhatsApp.
 */
export async function applyResult(ctx, result) {
  if (!result) return null;

  const sent = await sendMessage(ctx, 'reply', result);

  // vincula la solicitud con el id del mensaje principal (si aplica)
  if (result.linkRequest && sent?.key?.id) {
    requestsRepo.setWaMessageId(result.linkRequest, sent.key.id);
  }

  // vincula la solicitud con el id del mensaje avisado a los admins
  for (const extra of result.extra ?? []) {
    const sentExtra = await sendMessage(ctx, extra.to, { view: extra.view, data: extra.data }, {
      mentions: extra.mentions ?? [],
      quoted: false,
    });
    if (extra.linkRequest && sentExtra?.key?.id) {
      requestsRepo.setWaMessageId(extra.linkRequest, sentExtra.key.id);
    }
  }

  for (const effect of result.actions ?? []) {
    await applyAction(ctx, effect);
  }

  return sent;
}

/** Ejecuta un efecto sobre WhatsApp sin que un fallo tumbe el bot. */
export async function applyAction(ctx, effect) {
  try {
    switch (effect.kind) {
      case 'kick': {
        if (!ctx.group?.botIsAdmin) return { ok: false, reason: 'bot-no-admin' };
        const out = await ctx.client.groupParticipantsUpdate(ctx.group.groupId, [effect.jid], 'remove');
        auditRepo.log({
          instanceId: ctx.instance.id,
          groupId: ctx.group.groupId,
          actorJid: ctx.author.jid,
          action: 'mod.kick',
          targetJid: effect.jid,
          detail: { status: out?.[0]?.status ?? 'unknown' },
        });
        return { ok: true, out };
      }
      case 'add': {
        if (!ctx.group?.botIsAdmin) return { ok: false, reason: 'bot-no-admin' };
        const out = await ctx.client.groupParticipantsUpdate(ctx.group.groupId, [effect.jid], 'add');
        return { ok: true, out };
      }
      case 'groupSetting': {
        if (!ctx.group?.botIsAdmin) return { ok: false, reason: 'bot-no-admin' };
        await ctx.client.groupSettingUpdate(ctx.group.groupId, effect.setting);
        invalidateGroupCache(ctx.group.groupId);
        return { ok: true };
      }
      case 'audit': {
        auditRepo.log({
          instanceId: ctx.instance.id,
          groupId: ctx.group?.groupId ?? null,
          actorJid: ctx.author?.jid ?? null,
          action: effect.action,
          targetJid: effect.targetJid ?? null,
          detail: effect.detail ?? {},
        });
        return { ok: true };
      }
      case 'refreshGroup': {
        if (ctx.group) invalidateGroupCache(ctx.group.groupId);
        return { ok: true };
      }
      case 'refreshAdmins': {
        if (ctx.group) {
          const metadata = await ctx.client.groupMetadata(ctx.group.groupId).catch(() => null);
          if (metadata) groupsRepo.syncAdmins(ctx.group.groupId, (metadata.participants ?? []).filter((p) => p.admin));
          invalidateGroupCache(ctx.group.groupId);
        }
        return { ok: true };
      }
      default:
        return { ok: false, reason: `acción desconocida: ${effect?.kind}` };
    }
  } catch (error) {
    return { ok: false, reason: error?.message ?? String(error) };
  }
}
