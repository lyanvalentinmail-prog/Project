/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · contexto de mensaje
 * ────────────────────────────────────────────────────────────────
 * Traduce un mensaje crudo de Baileys a un `ctx` limpio y neutro,
 * y es el ÚNICO lugar que ejecuta efectos sobre WhatsApp
 * (enviar mensajes, expulsar, cambiar ajustes del grupo).
 */
import { usersRepo, groupsRepo, requestsRepo, auditRepo, instancesRepo } from '../db/index.js';
import { isBotOwner, isInstanceAdmin, rankOf, RANK, RANK_LABEL } from '../security/permissions.js';
import { normalizeJid, isGroupJid, maskPhone } from '../utils/ids.js';
import { chunkText } from '../utils/text.js';
import { ensureGroup, invalidateGroupCache } from './group-sync.js';
import { isLidJid, isPnJid, adminsFromMetadata } from '../utils/lid.js';
import { renderResult, setRenderPrefix, setRenderStyle } from '../design/index.js';
import { customRepo, normalizeBanner } from '../db/repositories/bot-customization.repo.js';
import { fetchBuffer } from '../utils/net.js';
import { scoped } from './logger.js';

const log = scoped('context');

/** Límite de caption de WhatsApp para mensajes con imagen/video. */
const CAPTION_LIMIT = 1024;

/* ═══════════════════════════════════════════════════════════════
   Lectura del mensaje de WhatsApp
   ═══════════════════════════════════════════════════════════════ */

/** Desenvuelve mensajes efímeros / de una sola vista. */
export function unwrapMessage(rawMessage) {
  let m = rawMessage?.message;
  if (!m) return null;
  // Pueden venir anidados en distinto orden (documentos con caption incluidos).
  for (let depth = 0; depth < 10; depth += 1) {
    const inner = m.ephemeralMessage?.message ?? m.viewOnceMessage?.message ??
      m.viewOnceMessageV2?.message ?? m.viewOnceMessageV2Extension?.message ??
      m.documentWithCaptionMessage?.message;
    if (!inner) break;
    m = inner;
  }
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

/**
 * Id elegido en una respuesta interactiva (lista / botones / native flow).
 * Al tocar una fila de la lista del menú, WhatsApp NO manda texto: manda
 * un `interactiveResponseMessage` cuyo `paramsJson` trae `{ id }` (el id de
 * la fila, p. ej. `.menu economy`). Sin esto la selección se perdía.
 */
export function extractInteractiveId(m) {
  if (!m) return '';
  const nativeFlow = m.interactiveResponseMessage?.nativeFlowResponseMessage;
  if (nativeFlow?.paramsJson) {
    try {
      const params = JSON.parse(nativeFlow.paramsJson);
      const id = params?.id ?? params?.selectedId ?? params?.row_id ?? null;
      if (id) return String(id);
    } catch {
      /* paramsJson no es JSON: se ignora */
    }
  }
  return String(
    m.listResponseMessage?.singleSelectReply?.selectedRowId ??
    m.buttonsResponseMessage?.selectedButtonId ??
    m.templateButtonReplyMessage?.selectedId ??
    ''
  );
}

export function extractText(m) {
  if (!m) return '';
  const text =
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    m.documentMessage?.caption ??
    m.locationMessage?.name ??
    null;
  if (text) return String(text);
  return extractInteractiveId(m) || String(
    m.interactiveResponseMessage?.body?.text ??
    m.listResponseMessage?.title ??
    ''
  );
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

/**
 * Autor del mensaje tal como llega: si WhatsApp manda el número aparte
 * (participantAlt / remoteJidAlt en grupos o chats con LID), se prefiere.
 */
export function rawAuthorJid(raw, { fromMe, isGroup, client }) {
  if (fromMe) return client?.jid ?? null;
  const key = raw?.key ?? {};
  const primary = isGroup ? key.participant ?? raw?.participant : key.remoteJid;
  const alt = isGroup ? key.participantAlt : key.remoteJidAlt;
  return isPnJid(normalizeJid(alt)) ? alt : primary;
}

/** Número de la persona si se conoce; si WhatsApp solo dio el LID, el LID. */
export async function canonicalJid(client, jid) {
  const normalized = normalizeJid(jid);
  if (!normalized || !isLidJid(normalized)) return normalized;
  try {
    if (typeof client?.resolveUser === 'function') return (await client.resolveUser(normalized)) ?? normalized;
  } catch {
    /* sin equivalencia: queda el LID */
  }
  return typeof client?.toPn === 'function' ? client.toPn(normalized) ?? normalized : normalized;
}

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
  const fromMe = Boolean(raw.key?.fromMe);
  const messageId = raw.key?.id ?? null;

  // Fila fresca: los cambios de prefijo y staff desde el panel se
  // aplican al siguiente mensaje, sin reiniciar ni volver a vincular.
  const instanceRow = (instance?.id ? instancesRepo.byId(instance.id) : null) ?? instance;

  const text = extractText(m);

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

  // Con la lista de participantes ya cargada, los LID se traducen a números:
  // así el owner, las fichas y los admins coinciden aunque el grupo use LID.
  const authorJid = await canonicalJid(client, rawAuthorJid(raw, { fromMe, isGroup, client }));
  const mentions = [...new Set((await Promise.all(extractMentions(m).map((jid) => canonicalJid(client, jid)))).filter(Boolean))];
  const quoted = extractQuoted(m);
  if (quoted?.participant) quoted.participant = await canonicalJid(client, quoted.participant);

  const userRow = groupCtx ? usersRepo.get(groupCtx.groupId, authorJid) : null;
  const isAdmin = groupCtx ? groupsRepo.isAdmin(groupCtx.groupId, authorJid) : false;
  const authorIsBotOwner = isBotOwner(authorJid);
  const authorIsInstanceAdmin = isInstanceAdmin(instanceRow, authorJid);
  const pushName = raw.pushName ?? raw.notify ?? userRow?.push_name ?? null;
  const displayName = userRow?.name ?? pushName ?? maskPhone(authorJid);

  const ctx = {
    // mensaje
    raw,
    message: m,
    messageId,
    chatJid,
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
      isAdmin: isAdmin || authorIsBotOwner || authorIsInstanceAdmin,
      isGroupAdmin: isAdmin,
      isBotOwner: authorIsBotOwner,
      isInstanceAdmin: authorIsInstanceAdmin,
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
  if (!to || to === 'reply' || to === 'group') return ctx.chatJid ?? ctx.group?.groupId ?? ctx.author.jid;
  if (to === 'author') return ctx.author.jid;
  if (to === 'private') return ctx.author.jid;
  return normalizeJid(to);
}

/**
 * Envía texto (o un resultado de servicio) a un destino.
 * Parte automáticamente los mensajes largos.
 */
/* ═══════════════════════════════════════════════════════════════
   Medios: logos generados, stickers, miniaturas, banners…
   Los servicios adjuntan `data.media` o `result.mediaExtra`;
   este es el único lugar que los traduce a mensajes de WhatsApp.
   ═══════════════════════════════════════════════════════════════ */

/** Resuelve la fuente del medio: Buffer local, data URL o URL http. */
export async function resolveMediaSource(media) {
  if (!media || typeof media !== 'object') return null;
  if (Buffer.isBuffer(media.buffer)) return media.buffer;
  if (Buffer.isBuffer(media.image)) return media.image;
  if (media.stickerBuffer && Buffer.isBuffer(media.stickerBuffer)) return media.stickerBuffer;
  const dataUrl = media.dataUrl ?? (typeof media.image === 'string' && media.image.startsWith?.('data:') ? media.image : null);
  if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    try { return Buffer.from(base64, 'base64'); } catch { return null; }
  }
  const url = media.url ?? (typeof media.image === 'string' && /^https?:\/\//.test(media.image) ? media.image : null);
  if (url) {
    const buffer = await fetchBuffer(url, { maxBytes: media.maxBytes ?? 16 * 1024 * 1024, timeout: media.timeout ?? 12_000 });
    return buffer;
  }
  return null;
}

/** Convierte la descripción de un medio en contenido Baileys, o null. */
export async function mediaContent(media, captionText = '') {
  if (!media || typeof media !== 'object') return null;
  const kind = media.kind ?? (media.sticker ? 'sticker' : media.audio ? 'audio' : media.video ? 'video' : 'image');
  const caption = captionText ? String(captionText).slice(0, CAPTION_LIMIT) : undefined;
  if (kind === 'sticker') {
    const buffer = await resolveMediaSource(media);
    return buffer ? { sticker: buffer } : null;
  }
  if (kind === 'audio') {
    if (media.url && !Buffer.isBuffer(media.buffer)) {
      return { audio: { url: media.url }, mimetype: media.mimetype ?? 'audio/mpeg', ...(media.ptt ? { ptt: true } : {}) };
    }
    const buffer = await resolveMediaSource(media);
    return buffer ? { audio: buffer, mimetype: media.mimetype ?? 'audio/mpeg', ...(media.ptt ? { ptt: true } : {}) } : null;
  }
  if (kind === 'video') {
    if (media.url && !Buffer.isBuffer(media.buffer)) {
      return { video: { url: media.url }, caption, mimetype: media.mimetype ?? 'video/mp4' };
    }
    const buffer = await resolveMediaSource(media);
    return buffer ? { video: buffer, caption, mimetype: media.mimetype ?? 'video/mp4' } : null;
  }
  // imagen por defecto
  if (media.url && !Buffer.isBuffer(media.buffer)) {
    return { image: { url: media.url }, ...(caption ? { caption } : {}) };
  }
  const buffer = await resolveMediaSource(media);
  return buffer ? { image: buffer, ...(caption ? { caption } : {}) } : null;
}

/**
 * Menú enriquecido por sub-bot: lista interactiva o banner con imagen.
 * Devuelve el mensaje enviado, o null si no aplica (→ texto plano).
 */
async function sendMenuRich(ctx, payload, text, target, quoted) {
  if (payload?.view !== 'menu.main' || !ctx?.instance?.id) return null;
  // `.menu <categoría>` filtrada siempre va en texto (es una ficha)
  if (payload?.data?.filter) return null;
  let custom = null;
  try { custom = customRepo.get(ctx.instance.id); } catch { return null; }

  // 1) modo lista: info del bot + selector de categorías
  if (custom.menuMode === 'list' && typeof ctx.client?.sendList === 'function') {
    try {
      const { buildMenuData, buildListPayload } = await import('../services/menu.service.js');
      const data = buildMenuData(ctx.instance, ctx.prefix ?? ctx.instance.prefix ?? '.');
      const list = buildListPayload(data, { userName: ctx.author?.name ?? null });
      const sent = await ctx.client.sendList(target, list, { quoted: quoted ?? undefined });
      if (sent) return sent;
    } catch (error) {
      log.warn({ err: error }, 'menú en modo lista falló; se envía en texto');
    }
  }

  // 2) banner: imagen configurada en el panel + menú
  const banner = normalizeBanner(custom.banner);
  if (banner) {
    try {
      const buffer = await resolveMediaSource(banner);
      if (!buffer) throw new Error('sin imagen de banner');
      const header = banner.caption ||
        `ㅤㅤ𓆩ㅤ禊ㅤ𓆪\n` +
        `ㅤ𝑽 𝑬́ 𝑹 𝑺 𝑶 𝑽 𝑨ㅤ·ㅤ${payload?.data?.name ?? 'Bot'}\n` +
        `𖦹 𝖳𝖾𝖺𝗆 ⁙ ${payload?.data?.team ?? ''}\n` +
        `𖦹 𝖯𝗋𝖾𝖿𝗂𝗑 ⁙ ${payload?.data?.prefix ?? ctx.prefix ?? '.'}\n` +
        `𖦹 𝖲𝗍𝖺𝗍𝗎𝗌 ⁙ ${payload?.data?.status ?? 'ᴏɴʟɪɴᴇ'} · 𝖵𝖾𝗋𝗌𝗂𝗈𝗇 ⁙ ${payload?.data?.version ?? ''}`;
      const fitsCaption = String(text).length <= CAPTION_LIMIT;
      const content = { image: buffer, caption: fitsCaption ? text : header };
      const sent = await ctx.client.sendMessage(target, content, quoted ? { quoted } : {});
      // si el menú no cabe en el caption, el texto completo va debajo
      if (!fitsCaption) {
        const rest = [];
        for (const chunk of chunkText(text)) {
          const r = await ctx.client.sendMessage(target, { text: chunk });
          if (r) rest.push(r);
        }
        void rest;
      }
      return sent ?? true;
    } catch (error) {
      log.warn({ err: error }, 'banner del menú falló; se envía en texto');
    }
  }
  return null;
}

export async function sendMessage(ctx, to, payload, options = {}) {
  // cada sub-bot puede tener su propio prefijo: se fija antes de renderizar
  setRenderPrefix(ctx?.instance?.prefix ?? ctx?.prefix);
  // el estilo elegido en el panel también tiñe algunas plantillas (p. ej. el .warn de Tomioka)
  try { setRenderStyle(ctx?.instance ? customRepo.get(ctx.instance.id)?.menuStyle : null); } catch { setRenderStyle(null); }
  const text = typeof payload === 'string' ? payload : renderResult(payload);
  if (!text) return null;

  const target = resolveTarget(ctx, to);
  const mentions = [...new Set([...(options.mentions ?? []), ...(payload?.data?.mentions ?? [])].map(normalizeJid).filter(Boolean))];
  const quoted = options.quoted === false ? null : options.quotedMessage ?? (to === 'reply' ? ctx.raw : null);

  // 0 · encuesta nativa de WhatsApp (data.poll): se envía tal cual a Baileys
  if (!Array.isArray(payload) && typeof payload !== 'string' && payload?.data?.poll) {
    const poll = payload.data.poll;
    const values = (poll.values ?? []).map((value) => String(value).slice(0, 100)).filter(Boolean).slice(0, 12);
    if (values.length >= 2) {
      try {
        const sent = await ctx.client.sendMessage(
          target,
          { poll: { name: String(poll.name ?? 'Encuesta').slice(0, 255), values, selectableCount: poll.selectableCount ?? 1 } },
          quoted ? { quoted } : {},
        );
        if (sent) return sent;
      } catch (error) {
        log.warn({ err: error }, 'encuesta nativa falló; se envía en texto');
      }
    }
  }

  // 1 · entrega rica del menú (lista interactiva / banner del bot)
  if (!Array.isArray(payload) && typeof payload !== 'string') {
    const rich = await sendMenuRich(ctx, payload, text, target, quoted);
    if (rich) return rich === true ? null : rich;

    // 2 · medio adjunto en data.media (logo generado, miniatura, audio…)
    if (payload?.data?.media) {
      const media = payload.data.media;
      const kind = media.kind ?? 'image';
      if (kind === 'sticker') {
        // el sticker no lleva caption: primero el texto, luego el sticker
        for (const chunk of chunkText(text)) {
          const content = { text: chunk };
          if (mentions.length) content.mentions = mentions;
          await ctx.client.sendMessage(target, content, quoted ? { quoted } : {});
        }
        const stickerContent = await mediaContent(media, '');
        if (!stickerContent) return null;
        return ctx.client.sendMessage(target, stickerContent, quoted ? { quoted } : {});
      }
      const content = await mediaContent(media, text);
      if (content) {
        return ctx.client.sendMessage(target, content, quoted ? { quoted } : {});
      }
      // sin medio resoluble → cae a texto normal
    }
  }

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

  // archivos de medios adicionales (stickers encontrados, imágenes, audio…)
  for (const item of result.mediaExtra ?? []) {
    try {
      const content = await mediaContent(item, item.caption ?? '');
      if (!content) continue;
      const target = resolveTarget(ctx, item.to ?? 'reply');
      await ctx.client.sendMessage(target, content);
    } catch (error) {
      log.warn({ err: error }, 'no se pudo enviar un medio extra');
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
          if (metadata) groupsRepo.syncAdmins(ctx.group.groupId, adminsFromMetadata(metadata, ctx.client));
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
