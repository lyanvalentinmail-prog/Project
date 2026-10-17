/**
 * 𓆩 🛍️ 𓆪  VÉRSOVA · servicio de descargas (paquete Raiden)
 * ────────────────────────────────────────────────────────────────
 * Los comandos aceptan la búsqueda o enlace, validan la entrada y
 * devuelven una tarjeta con el resultado disponible: enlaces
 * directos de búsqueda y, cuando hay internet, el mejor destino.
 * Sin dependencias externas: nunca finge una descarga que no hizo.
 */
import { ok, fail } from './result.js';
import { sanitizeText } from '../utils/text.js';

function needQuery(ctx, command, label) {
  return fail('sys.invalid', {
    command,
    message: `Escribe lo que quieres buscar o el enlace.`,
    hint: `Ejemplo: ${ctx.prefix ?? '.'}${command} ${label}`,
  });
}

function ytSearchLink(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export function play(ctx, queryRaw = null, { video = false } = {}) {
  const command = video ? 'play2' : 'play';
  const query = sanitizeText(queryRaw, 120);
  if (!query) return needQuery(ctx, command, 'bad bunny diles');
  const isUrl = /youtu\.?be/.test(query);
  return ok('dl.music', {
    kind: video ? 'video' : 'audio',
    query,
    isUrl,
    searchUrl: ytSearchLink(query),
    command,
  });
}

export function ytmp3(ctx, queryRaw = null) {
  const query = sanitizeText(queryRaw, 120);
  if (!query) return needQuery(ctx, 'yta', 'https://youtu.be/…');
  return ok('dl.music', {
    kind: 'audio',
    query,
    isUrl: /youtu\.?be/.test(query),
    searchUrl: ytSearchLink(query),
    command: 'yta',
  });
}

export function tiktok(ctx, urlRaw = null) {
  const url = sanitizeText(urlRaw, 300);
  if (!url) return needQuery(ctx, 'tiktok', 'https://www.tiktok.com/…');
  if (!/tiktok\.com|vt\.tiktok/.test(url)) {
    return fail('sys.invalid', {
      command: 'tiktok',
      message: 'Ese no parece un enlace de TikTok.',
      hint: 'Pega el enlace del video: .tiktok https://www.tiktok.com/…',
    });
  }
  return ok('dl.link', {
    network: 'TikTok',
    icon: '🎵',
    url,
    hint: 'Abre el enlace y usa “Guardar video” (sin marca con apps externas).',
    command: 'tiktok',
  });
}

export function instagram(ctx, urlRaw = null) {
  const url = sanitizeText(urlRaw, 300);
  if (!url) return needQuery(ctx, 'instagram', 'https://www.instagram.com/…');
  if (!/instagram\.com|instagr\.am/.test(url)) {
    return fail('sys.invalid', {
      command: 'instagram',
      message: 'Ese no parece un enlace de Instagram.',
      hint: 'Pega el enlace del reel, foto o historia pública.',
    });
  }
  return ok('dl.link', {
    network: 'Instagram',
    icon: '📸',
    url,
    hint: 'El contenido privado no se puede descargar: pide el enlace público.',
    command: 'instagram',
  });
}

export function spotify(ctx, queryRaw = null) {
  const query = sanitizeText(queryRaw, 160);
  if (!query) return needQuery(ctx, 'spotify', 'https://open.spotify.com/…');
  const isUrl = /spotify\.com|spotify:/.test(query);
  return ok('dl.link', {
    network: 'Spotify',
    icon: '🎧',
    url: isUrl ? query : `https://open.spotify.com/search/${encodeURIComponent(query)}`,
    hint: isUrl
      ? 'Usa este enlace en tu app para guardarla; para el MP3 usa .play con el título.'
      : 'Abre el resultado en Spotify, o pide el audio con .play <título>.',
    command: 'spotify',
  });
}

export function pinterest(ctx, queryRaw = null) {
  const query = sanitizeText(queryRaw, 120);
  if (!query) return needQuery(ctx, 'pinterest', 'gatos samurái');
  return ok('dl.link', {
    network: 'Pinterest',
    icon: '📌',
    url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`,
    hint: 'Guarda la imagen desde el enlace; luego mándala al bot con .s para hacer sticker.',
    command: 'pinterest',
  });
}

export function lyrics(ctx, queryRaw = null) {
  const query = sanitizeText(queryRaw, 120);
  if (!query) return needQuery(ctx, 'lyrics', 'shakira bzrp');
  return ok('dl.lyrics', {
    query,
    geniusUrl: `https://genius.com/search?q=${encodeURIComponent(query)}`,
    letrasUrl: `https://www.letras.com/?q=${encodeURIComponent(query)}`,
    command: 'lyrics',
  });
}

export default { play, ytmp3, tiktok, instagram, spotify, pinterest, lyrics };
