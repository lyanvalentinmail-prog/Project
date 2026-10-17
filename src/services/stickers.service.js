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

export function ssearch(ctx, raw = null) {
  const query = sanitizeText(raw, 80);
  if (!query) {
    return fail('sys.invalid', {
      command: 'ssearch',
      message: 'Escribe qué stickers quieres buscar.',
      hint: `Ejemplo: ${ctx.prefix ?? '.'}ssearch gatos`,
    });
  }
  return ok('sticker.search', {
    query,
    url: `https://sticker.ly/s/${encodeURIComponent(query)}`,
    command: 'ssearch',
  });
}

export default { stickerGuide, brat, setMeta, delMeta, ssearch };
