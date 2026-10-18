/**
 * 𓆩 ⭐ 𓆪  VÉRSOVA · servicio de stickers (paquete Raiden)
 * ────────────────────────────────────────────────────────────────
 * Metadatos por defecto (pack/autor) + guías de uso. El bot envía
 * texto: los pasos para crear el sticker se explican con el estilo
 * de VÉRSOVA y los metadatos guardados.
 */
import { stickerMetaRepo } from '../db/index.js';
import { ok, fail } from './result.js';
import { sanitizeText } from '../utils/text.js';
import { fetchJson, fetchBuffer } from '../utils/net.js';

function currentMeta(ctx) {
  return stickerMetaRepo.get(ctx.group.groupId, ctx.author.jid) ?? { pack: '', author: '' };
}

export function stickerGuide(ctx) {
  const meta = currentMeta(ctx);
  return ok('sticker.guide', {
    userName: ctx.author.name,
    pack: meta.pack || null,
    author: meta.author || null,
    command: 's',
  });
}

export function brat(ctx, raw = null) {
  const text = sanitizeText(raw, 120);
  if (!text) {
    return fail('sys.invalid', {
      command: 'brat',
      message: 'Escribe el texto del sticker.',
      hint: `Ejemplo: ${ctx.prefix ?? '.'}brat hola mundo`,
    });
  }
  const meta = currentMeta(ctx);
  // Versión texto del estilo BRAT: fondo verde legible en el chat.
  const banner = `🟩 𝙱𝚁𝙰𝚃 🟩\n${text.toLowerCase()}`;
  return ok('sticker.brat', {
    userName: ctx.author.name,
    text,
    banner,
    pack: meta.pack || null,
    author: meta.author || null,
    command: 'brat',
  });
}

export function setMeta(ctx, raw = null) {
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

export default { stickerGuide, brat, setMeta, delMeta, ssearch };
