/**
 * 𓆩 ⭐ 𓆪  VÉRSOVA · servicio de stickers (paquete Raiden)
 * ────────────────────────────────────────────────────────────────
 * Descarga imágenes adjuntas o citadas, las convierte a WebP compatible
 * y envía el sticker. Conserva metadatos opcionales de pack y autor.
 */
import { stickerMetaRepo } from '../db/index.js';
import { ok, fail } from './result.js';
import { sanitizeText } from '../utils/text.js';
import { fetchJson, fetchBuffer } from '../utils/net.js';
import { IDENTITY } from '../config/identity.js';
import {
  imageToSticker,
  textToSticker,
  MAX_STICKER_INPUT_BYTES,
  StickerImageError,
} from './sticker-image.js';

const MAX_STICKERS_PER_PACK = 30;

function currentMeta(ctx) {
  const groupId = ctx.group?.groupId;
  if (!groupId) return { pack: '', author: '' };
  return stickerMetaRepo.get(groupId, ctx.author.jid) ?? { pack: '', author: '' };
}

function parseStickerMeta(raw, defaults = {}) {
  const text = sanitizeText(raw, 130);
  const meta = { pack: defaults.pack ?? '', author: defaults.author ?? '' };
  if (!text) return meta;
  if (/[|/•]/.test(text)) {
    const [pack = '', author = ''] = text.split(/[|/•]/);
    if (pack.trim()) meta.pack = pack.trim();
    if (author.trim()) meta.author = author.trim();
  } else {
    meta.pack = text;
  }
  return {
    pack: meta.pack.slice(0, 60),
    author: meta.author.slice(0, 60),
  };
}

function unwrappedContent(message) {
  let content = message?.message ?? message;
  for (let depth = 0; depth < 10; depth += 1) {
    const inner = content?.ephemeralMessage?.message ?? content?.viewOnceMessage?.message ??
      content?.viewOnceMessageV2?.message ?? content?.viewOnceMessageV2Extension?.message ??
      content?.documentWithCaptionMessage?.message;
    if (!inner) break;
    content = inner;
  }
  return content ?? null;
}

function mediaCandidate(content) {
  if (!content || typeof content !== 'object') return null;
  if (content.imageMessage) return { type: 'image', media: content.imageMessage };
  if (content.stickerMessage) return { type: 'image', media: content.stickerMessage };
  if (content.videoMessage) return { type: 'video', media: content.videoMessage };
  if (content.documentMessage) {
    const document = content.documentMessage;
    if (String(document.mimetype ?? '').toLowerCase().startsWith('image/')) {
      return { type: 'image', media: document };
    }
    if (String(document.mimetype ?? '').toLowerCase().startsWith('video/')) {
      return { type: 'video', media: document };
    }
  }
  return null;
}

function contextInfo(content) {
  for (const value of Object.values(content ?? {})) {
    if (value?.contextInfo?.quotedMessage) return value.contextInfo;
  }
  return null;
}

function quotedWAMessage(ctx, info) {
  return {
    key: {
      remoteJid: info.remoteJid ?? ctx.chatJid,
      fromMe: Boolean(info.fromMe),
      id: info.stanzaId ?? undefined,
      participant: info.participant ?? undefined,
    },
    message: info.quotedMessage,
  };
}

function stickerFailure(ctx, message, hint = null, command = 's') {
  const prefix = ctx.prefix ?? '.';
  const defaultHint = command === 'spack'
    ? `Responde al álbum con ${prefix}spack <nombre del pack>.`
    : ['brat', 'ttp', 'attp'].includes(command)
      ? `Ejemplo: ${prefix}${command} hola mundo`
      : `Envía una imagen JPG, PNG o WebP con ${prefix}s en el caption, o responde a una imagen con ese comando.`;
  return fail('sys.invalid', {
    command,
    message,
    hint: hint ?? defaultHint,
  });
}

/** Convierte la imagen actual o la imagen citada y la devuelve como sticker. */
export async function createSticker(ctx, raw = null) {
  const current = mediaCandidate(ctx.message);
  const currentImage = current?.type === 'image';
  let source = currentImage ? { ...current, message: ctx.raw } : null;

  if (!source) {
    const info = contextInfo(ctx.message);
    if (info?.quotedMessage) {
      const quoted = mediaCandidate(unwrappedContent(info.quotedMessage));
      if (quoted) source = { ...quoted, message: quotedWAMessage(ctx, info) };
    }
  }

  if (!source) {
    if (current?.type === 'video') {
      return stickerFailure(ctx, 'Por ahora puedo crear stickers desde imágenes estáticas (JPG, PNG o WebP), no desde videos.');
    }
    const info = contextInfo(ctx.message);
    if (info?.quotedMessage && mediaCandidate(unwrappedContent(info.quotedMessage))?.type === 'video') {
      return stickerFailure(ctx, 'Por ahora puedo crear stickers desde imágenes estáticas (JPG, PNG o WebP), no desde videos.');
    }
    return stickerGuide(ctx);
  }

  const declaredBytes = Number(source.media?.fileLength ?? 0);
  if (Number.isFinite(declaredBytes) && declaredBytes > MAX_STICKER_INPUT_BYTES) {
    return stickerFailure(ctx, 'La imagen supera el límite de 15 MB.');
  }
  if (typeof ctx.client?.downloadMediaBuffer !== 'function') {
    return stickerFailure(ctx, 'No pude descargar la imagen desde este chat. Inténtalo de nuevo.');
  }

  try {
    const input = await ctx.client.downloadMediaBuffer(source.message, { maxBytes: MAX_STICKER_INPUT_BYTES });
    const metadata = parseStickerMeta(raw, currentMeta(ctx));
    const sticker = await imageToSticker(input, metadata);
    return ok('sticker.created', {
      userName: ctx.author.name,
      pack: metadata.pack || null,
      author: metadata.author || null,
      command: 's',
    }, {
      mediaExtra: [{ kind: 'sticker', buffer: sticker }],
    });
  } catch (error) {
    if (error instanceof StickerImageError) {
      return stickerFailure(ctx, error.message);
    }
    if (error?.code === 'MEDIA_TOO_LARGE') {
      return stickerFailure(ctx, 'La imagen supera el límite de 15 MB.');
    }
    return stickerFailure(ctx, 'No pude descargar o convertir esa imagen. Comprueba que siga disponible e inténtalo otra vez.');
  }
}

export function stickerGuide(ctx) {
  const meta = currentMeta(ctx);
  return ok('sticker.guide', {
    userName: ctx.author.name,
    pack: meta.pack || null,
    author: meta.author || null,
    isGroup: Boolean(ctx.isGroup),
    command: 's',
  });
}

async function createTextSticker(ctx, raw, style) {
  const command = style;
  const text = sanitizeText(raw, 120);
  if (!text) {
    return fail('sys.invalid', {
      command,
      message: 'Escribe el texto que quieres convertir en sticker.',
      hint: `Ejemplo: ${ctx.prefix ?? '.'}${command} hola mundo`,
    });
  }

  const metadata = currentMeta(ctx);
  try {
    const sticker = await textToSticker(text, style, metadata);
    const data = {
      userName: ctx.author.name,
      text,
      pack: metadata.pack || null,
      author: metadata.author || null,
      style,
      isAnimated: style === 'attp',
      command,
    };
    if (style === 'brat') data.banner = `🟩 𝙱𝚁𝙰𝚃 🟩\n${text.toLowerCase()}`;
    return ok(style === 'brat' ? 'sticker.brat' : 'sticker.created', data, {
      mediaExtra: [{ kind: 'sticker', buffer: sticker, ...(style === 'attp' ? { isAnimated: true } : {}) }],
    });
  } catch (error) {
    const message = error instanceof StickerImageError
      ? error.message
      : 'No pude renderizar el texto en un sticker. Inténtalo de nuevo.';
    return stickerFailure(ctx, message, null, command);
  }
}

export function brat(ctx, raw = null) {
  return createTextSticker(ctx, raw, 'brat');
}

export function ttp(ctx, raw = null) {
  return createTextSticker(ctx, raw, 'ttp');
}

export function attp(ctx, raw = null) {
  return createTextSticker(ctx, raw, 'attp');
}

function stickerPackParentId(sourceMessage, quotedInfo) {
  const sourceContent = sourceMessage ? unwrappedContent(sourceMessage) : null;
  const association = sourceContent?.messageContextInfo?.messageAssociation;
  return association?.parentMessageKey?.id ??
    (quotedInfo && !mediaCandidate(sourceContent)?.type ? quotedInfo.stanzaId : null);
}

/** Crea un pack WebP desde las imágenes de un álbum al que se respondió. */
export async function stickerPack(ctx, raw = null) {
  const pack = sanitizeText(raw, 130).trim().slice(0, 60);
  if (!pack) {
    return stickerFailure(ctx, 'Indica el nombre del pack que quieres crear.', `Ejemplo: ${ctx.prefix ?? '.'}spack Mis fotos`, 'spack');
  }

  const current = mediaCandidate(ctx.message);
  const info = contextInfo(ctx.message);
  const quotedCandidate = info?.quotedMessage ? mediaCandidate(unwrappedContent(info.quotedMessage)) : null;
  const currentImage = current?.type === 'image';
  const sourceMessage = currentImage
    ? ctx.raw
    : info?.quotedMessage
      ? quotedWAMessage(ctx, info)
      : null;
  if (!sourceMessage && !info?.stanzaId) {
    return stickerFailure(ctx, 'Responde al álbum o a una de sus fotos con .spack y el nombre del pack.', `Responde a las fotos con ${ctx.prefix ?? '.'}spack Mi pack`, 'spack');
  }

  const parentId = stickerPackParentId(sourceMessage, info);
  let albumMessages = [];
  if (parentId && typeof ctx.client?.getAlbumImages === 'function') {
    try {
      albumMessages = await ctx.client.getAlbumImages(ctx.chatJid, parentId);
    } catch {
      albumMessages = [];
    }
  }

  const messages = [...albumMessages, ...(sourceMessage ? [sourceMessage] : [])];
  const seen = new Set();
  const images = [];
  for (const message of messages) {
    const candidate = mediaCandidate(unwrappedContent(message));
    if (candidate?.type !== 'image') continue;
    const id = message?.key?.id;
    const identity = id ? String(id) : message;
    if (seen.has(identity)) continue;
    seen.add(identity);
    images.push({ message, media: candidate.media });
  }

  if (!images.length) {
    if (current?.type === 'video' || quotedCandidate?.type === 'video') {
      return stickerFailure(ctx, 'El pack admite fotos estáticas, no videos.', null, 'spack');
    }
    return stickerFailure(ctx, 'No encontré fotos de ese álbum. Responde a una de sus imágenes y vuelve a intentarlo.', null, 'spack');
  }
  if (images.length > MAX_STICKERS_PER_PACK) {
    return stickerFailure(ctx, `El pack admite hasta ${MAX_STICKERS_PER_PACK} fotos; este álbum supera ese límite.`, null, 'spack');
  }
  if (typeof ctx.client?.downloadMediaBuffer !== 'function') {
    return stickerFailure(ctx, 'No pude descargar las fotos desde este chat. Inténtalo de nuevo.', null, 'spack');
  }

  const author = sanitizeText(ctx.bot?.pushName ?? ctx.client?.pushName ?? IDENTITY.name, 60) || IDENTITY.name;
  const mediaExtra = [];
  let skipped = 0;
  for (const image of images) {
    const declaredBytes = Number(image.media?.fileLength ?? 0);
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_STICKER_INPUT_BYTES) {
      skipped += 1;
      continue;
    }
    try {
      const input = await ctx.client.downloadMediaBuffer(image.message, { maxBytes: MAX_STICKER_INPUT_BYTES });
      const sticker = await imageToSticker(input, { pack, author });
      mediaExtra.push({ kind: 'sticker', buffer: sticker });
    } catch {
      skipped += 1;
    }
  }

  if (!mediaExtra.length) {
    return stickerFailure(ctx, 'No pude convertir ninguna de las fotos del pack. Comprueba que sigan disponibles e inténtalo otra vez.', null, 'spack');
  }
  return ok('sticker.pack.created', {
    userName: ctx.author.name,
    pack,
    author,
    count: mediaExtra.length,
    skipped,
    command: 'spack',
  }, { mediaExtra });
}

export function setMeta(ctx, raw = null) {
  if (!ctx.group?.groupId) {
    return fail('sys.invalid', {
      command: 'setmeta',
      message: 'Los metadatos predeterminados se guardan por grupo. Usa .s pack | autor al crear un sticker en privado.',
    });
  }
  const text = sanitizeText(raw, 130);
  if (!text) {
    return fail('sys.invalid', {
      command: 'setmeta',
      message: 'Indica el pack y el autor separados por |.',
      hint: `Ejemplo: ${ctx.prefix ?? '.'}setmeta Mi pack | Mi nombre`,
    });
  }
  const separator = text.match(/[|/•]/);
  let pack = '';
  let author = '';
  if (separator) {
    const parts = text.split(/[|/•]/);
    pack = (parts[0] ?? '').trim();
    author = (parts[1] ?? '').trim();
  } else {
    pack = text.trim();
  }
  if (!pack && !author) {
    return fail('sys.invalid', { command: 'setmeta', message: 'Escribe al menos el nombre del pack.' });
  }
  stickerMetaRepo.set(ctx.group.groupId, ctx.author.jid, { pack, author });
  return ok('sticker.meta', {
    userName: ctx.author.name,
    pack: pack || null,
    author: author || null,
    cleared: false,
    command: 'setmeta',
  });
}

export function delMeta(ctx) {
  if (!ctx.group?.groupId) {
    return fail('sys.invalid', {
      command: 'delmeta',
      message: 'No hay metadatos predeterminados guardados en este chat privado.',
    });
  }
  stickerMetaRepo.clear(ctx.group.groupId, ctx.author.jid);
  return ok('sticker.meta', {
    userName: ctx.author.name,
    pack: null,
    author: null,
    cleared: true,
    command: 'delmeta',
  });
}

/**
 * Búsqueda real en Sticker.ly: trae paquetes y ENVÍA stickers webp del
 * primeros resultados. Si la red o la API fallan, cae a la tarjeta con
 * el enlace de búsqueda (sin fingir envíos que no ocurrieron).
 */
const STICKERLY_UA = 'androidapp.stickerly/3.14.3 (Pixel 7; Android 13)';
const SSEARCH_MAX_PACKS = 3;
const SSEARCH_MAX_STICKERS = 5;

/** Normaliza un paquete de la API (varía levemente entre versiones). */
function normalizePack(pack) {
  if (!pack || typeof pack !== 'object') return null;
  const resourceFiles = pack.resourceFiles ?? pack.resources ?? [];
  const stickers = pack.stickers ?? [];
  const files = (resourceFiles.length ? resourceFiles : stickers.map((s) => s?.resourceUrl ?? s?.url))
    .map((u) => String(u ?? '')).filter((u) => /^https?:\/\//.test(u));
  const count = Number(pack.stickerCount ?? pack.sticker_count ?? stickers.length ?? files.length ?? 0);
  return {
    id: pack.packId ?? pack.id ?? null,
    name: String(pack.name ?? 'Paquete').slice(0, 60),
    author: String(pack.author ?? pack.user?.userName ?? 'Sticker.ly').slice(0, 40),
    count,
    files,
  };
}

async function searchStickerLy(query) {
  const url = `https://api.sticker.ly/v4/stickerPacks/search?query=${encodeURIComponent(query)}&density=xxhdpi&locale=es`;
  let data = await fetchJson(url, { timeout: 10_000, headers: { 'User-Agent': STICKERLY_UA, Host: 'api.sticker.ly' } });
  let packs = data?.result?.stickerPacks ?? data?.stickerPacks ?? null;
  if (!Array.isArray(packs)) {
    // plan B: v3 por si v4 cambia
    const alt = await fetchJson(`https://api.sticker.ly/v3/stickerPacks/search?query=${encodeURIComponent(query)}&density=xxhdpi&locale=es`, { timeout: 10_000, headers: { 'User-Agent': STICKERLY_UA, Host: 'api.sticker.ly' } });
    if (alt?.result?.stickerPacks) { data = alt; packs = alt.result.stickerPacks; }
  }
  if (!Array.isArray(packs) || !packs.length) return [];
  const normalized = packs.map(normalizePack).filter((p) => p && p.files.length);

  // si el search no trajo los archivos, pide el detalle del paquete
  const detailed = [];
  for (const pack of normalized.slice(0, SSEARCH_MAX_PACKS)) {
    if (pack.files.length) { detailed.push(pack); continue; }
    if (pack.id) {
      const detail = await fetchJson(`https://api.sticker.ly/v4/stickerPacks/${encodeURIComponent(pack.id)}`, { timeout: 8_000, headers: { 'User-Agent': STICKERLY_UA, Host: 'api.sticker.ly' } });
      const inner = normalizePack(detail?.result?.stickerPack ?? detail?.result ?? null);
      if (inner?.files.length) { detailed.push(inner); continue; }
    }
    detailed.push(pack);
  }
  return detailed;
}

export async function ssearch(ctx, raw = null) {
  const query = sanitizeText(raw, 80);
  if (!query) {
    return fail('sys.invalid', {
      command: 'ssearch',
      message: 'Escribe qué stickers quieres buscar.',
      hint: `Ejemplo: ${ctx.prefix ?? '.'}ssearch gatos`,
    });
  }
  const browseUrl = `https://sticker.ly/s/${encodeURIComponent(query)}`;

  const packs = await searchStickerLy(query).catch(() => []);
  if (!packs.length) {
    return ok('sticker.search', { query, url: browseUrl, results: [], sent: 0, command: 'ssearch' });
  }

  // Descarga los primeros stickers webp de los mejores paquetes.
  const stickerUrls = [];
  for (const pack of packs) {
    for (const fileUrl of pack.files) {
      if (stickerUrls.length >= SSEARCH_MAX_STICKERS) break;
      stickerUrls.push(fileUrl);
    }
    if (stickerUrls.length >= SSEARCH_MAX_STICKERS) break;
  }
  const downloads = await Promise.all(
    stickerUrls.map((url) => fetchBuffer(url, { maxBytes: 512 * 1024, timeout: 10_000 }))
  );
  const mediaExtra = downloads
    .filter((buffer) => Buffer.isBuffer(buffer) && buffer.length > 32)
    .map((buffer) => ({ kind: 'sticker', buffer }));

  return ok(
    'sticker.search',
    {
      query,
      url: browseUrl,
      results: packs.map((p) => ({ name: p.name, author: p.author, count: p.count })),
      sent: mediaExtra.length,
      command: 'ssearch',
    },
    { mediaExtra }
  );
}

export default { createSticker, stickerPack, stickerGuide, brat, ttp, attp, setMeta, delMeta, ssearch };
