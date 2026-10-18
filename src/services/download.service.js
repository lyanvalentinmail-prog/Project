/**
 * 𓆩 🛍️ 𓆪  VÉRSOVA · servicio de descargas y búsquedas (paquete Raiden)
 * ────────────────────────────────────────────────────────────────
 * Cada comando intenta primero su fuente REAL en línea (búsqueda de
 * YouTube, Deezer, lyrics.ovh, Pinterest, TikTok…) y, si la red o el
 * servicio fallan, responde con la tarjeta decorada de respaldo con
 * el enlace directo. Nunca finge una descarga que no hizo.
 */
import { ok, fail } from './result.js';
import { sanitizeText } from '../utils/text.js';
import { env } from '../config/env.js';
import { fetchJson, fetchText, fetchBuffer } from '../utils/net.js';

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

/* ═══════════════════════════════════════════════════════════════
   YouTube · búsqueda real leyendo ytInitialData
   ═══════════════════════════════════════════════════════════════ */

/** Extrae el JSON balanceado que sigue a `marker` en `text`. */
function extractBalancedJson(text, marker) {
  const start = text.indexOf(marker);
  if (start < 0) return null;
  let i = text.indexOf('{', start);
  if (i < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let j = i; j < text.length; j += 1) {
    const ch = text[j];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try { return JSON.parse(text.slice(i, j + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

function* walkForVideoRenderers(node) {
  if (!node || typeof node !== 'object') return;
  if (node.videoRenderer && typeof node.videoRenderer === 'object') yield node.videoRenderer;
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) for (const item of value) yield* walkForVideoRenderers(item);
    else if (value && typeof value === 'object') yield* walkForVideoRenderers(value);
  }
}

const textOf = (node) => node?.simpleText ?? node?.runs?.map((r) => r.text).join('') ?? '';

/**
 * Busca videos en YouTube. Devuelve [{ id, title, channel, duration,
 * views, thumbnail, url }] (los primeros `limit`), o [] si falla.
 */
export async function searchYouTube(query, limit = 3) {
  try {
    const html = await fetchText(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      timeout: 12_000,
      headers: { 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8', Accept: 'text/html' },
    });
    if (!html) return [];
    const data = extractBalancedJson(html, 'ytInitialData');
    if (!data) return [];
    const out = [];
    const seen = new Set();
    for (const renderer of walkForVideoRenderers(data)) {
      const id = renderer.videoId;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        title: textOf(renderer.title) || 'Sin título',
        channel: textOf(renderer.ownerText) || textOf(renderer.longBylineText) || 'YouTube',
        duration: textOf(renderer.lengthText) || '',
        views: textOf(renderer.viewCountText) || '',
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        url: `https://youtu.be/${id}`,
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

/* ═══════════════════════════════════════════════════════════════
   cobalt · intento de descarga real (instancias públicas)
   ═══════════════════════════════════════════════════════════════ */

function cobaltInstances() {
  const fromEnv = String(process.env.COBALT_INSTANCES ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return fromEnv.length ? fromEnv : ['https://api.cobalt.tools/'];
}

async function cobaltDownload(mediaUrl, { audio = false } = {}) {
  for (const base of cobaltInstances()) {
    try {
      const endpoint = base.endsWith('/') ? base : `${base}/`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'VersovaBot/1.0' },
        body: JSON.stringify(audio
          ? { url: mediaUrl, downloadMode: 'audio', audioFormat: 'mp3' }
          : { url: mediaUrl, videoQuality: '720' }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!response?.ok) continue;
      const data = await response.json().catch(() => null);
      const tunnel = data?.url ?? data?.audio ?? null;
      if (!tunnel || !/https?:\/\//.test(tunnel)) continue;
      const buffer = await fetchBuffer(tunnel, { maxBytes: 14 * 1024 * 1024, timeout: 30_000 });
      if (buffer) return { buffer, picker: data?.picker ?? null };
    } catch {
      /* prueba la siguiente instancia */
    }
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   .play / .play2 / .yta — audio y video de YouTube
   ═══════════════════════════════════════════════════════════════ */

const YT_ID_RE = /(?:youtu\.be\/|v=|shorts\/)([A-Za-z0-9_-]{11})/;

export async function play(ctx, queryRaw = null, { video = false } = {}) {
  const command = video ? 'play2' : 'play';
  const query = sanitizeText(queryRaw, 120);
  if (!query) return needQuery(ctx, command, 'bad bunny diles');

  const directId = YT_ID_RE.exec(query)?.[1] ?? null;
  const results = directId
    ? [{ id: directId, title: query, channel: 'YouTube', duration: '', views: '', thumbnail: `https://i.ytimg.com/vi/${directId}/hqdefault.jpg`, url: `https://youtu.be/${directId}` }]
    : await searchYouTube(query, 3);

  if (!results.length) {
    // respaldo sin conexión: tarjeta con enlace de búsqueda
    return ok('dl.music', {
      kind: video ? 'video' : 'audio',
      query,
      isUrl: Boolean(directId),
      searchUrl: ytSearchLink(query),
      results: [],
      command,
    });
  }

  const top = results[0];
  return ok('dl.music', {
    kind: video ? 'video' : 'audio',
    query,
    isUrl: Boolean(directId),
    searchUrl: ytSearchLink(query),
    results,
    top,
    command,
    media: { kind: 'image', url: top.thumbnail },
  });
}

export async function ytmp3(ctx, queryRaw = null) {
  const query = sanitizeText(queryRaw, 120);
  if (!query) return needQuery(ctx, 'yta', 'https://youtu.be/…');

  const directId = YT_ID_RE.exec(query)?.[1] ?? null;
  const results = directId ? [{ id: directId, url: `https://youtu.be/${directId}`, title: query }] : await searchYouTube(query, 1);
  const top = results[0] ?? null;

  if (top?.url) {
    const downloaded = await cobaltDownload(top.url, { audio: true });
    if (downloaded?.buffer) {
      return ok(
        'dl.music',
        {
          kind: 'audio',
          query,
          isUrl: Boolean(directId),
          searchUrl: ytSearchLink(query),
          results: top.title ? results : [],
          top: { ...top, title: top.title ?? query },
          command: 'yta',
          downloaded: true,
        },
        { mediaExtra: [{ kind: 'audio', buffer: downloaded.buffer, mimetype: 'audio/mpeg' }] }
      );
    }
  }

  return ok('dl.music', {
    kind: 'audio',
    query,
    isUrl: Boolean(directId),
    searchUrl: ytSearchLink(query),
    results: results.length ? results : [],
    top,
    command: 'yta',
    media: top?.thumbnail ? { kind: 'image', url: top.thumbnail } : null,
  });
}

/* ═══════════════════════════════════════════════════════════════
   .tiktok — metadatos reales (tikwm) + video sin marca de agua
   ═══════════════════════════════════════════════════════════════ */

export async function tiktok(ctx, urlRaw = null) {
  const url = sanitizeText(urlRaw, 300);
  if (!url) return needQuery(ctx, 'tiktok', 'https://www.tiktok.com/…');
  if (!/tiktok\.com|vt\.tiktok/.test(url)) {
    return fail('sys.invalid', {
      command: 'tiktok',
      message: 'Ese no parece un enlace de TikTok.',
      hint: 'Pega el enlace del video: .tiktok https://www.tiktok.com/…',
    });
  }

  const api = await fetchJson(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, { timeout: 12_000 });
  const video = api?.code === 0 ? api.data : null;
  if (video?.play) {
    const buffer = await fetchBuffer(video.play, { maxBytes: 15 * 1024 * 1024, timeout: 25_000 });
    if (buffer) {
      return ok(
        'dl.tiktok',
        {
          url,
          title: String(video.title ?? 'Video de TikTok').slice(0, 120),
          author: String(video.author?.nickname ?? video.author?.unique_id ?? 'TikTok').slice(0, 60),
          downloaded: true,
          command: 'tiktok',
          media: { kind: 'video', buffer, mimetype: 'video/mp4' },
        }
      );
    }
  }

  return ok('dl.link', {
    network: 'TikTok',
    icon: '🎵',
    url,
    hint: 'No se pudo descargar ahora mismo. Abre el enlace y usa “Guardar video”.',
    command: 'tiktok',
  });
}

/* ═══════════════════════════════════════════════════════════════
   .instagram — intento vía cobalt; respaldo con el enlace
   ═══════════════════════════════════════════════════════════════ */

export async function instagram(ctx, urlRaw = null) {
  const url = sanitizeText(urlRaw, 300);
  if (!url) return needQuery(ctx, 'instagram', 'https://www.instagram.com/…');
  if (!/instagram\.com|instagr\.am/.test(url)) {
    return fail('sys.invalid', {
      command: 'instagram',
      message: 'Ese no parece un enlace de Instagram.',
      hint: 'Pega el enlace del reel, foto o historia pública.',
    });
  }

  const downloaded = await cobaltDownload(url);
  const media = downloaded?.picker?.find?.((p) => p?.url)?.url ?? null;
  if (downloaded?.buffer) {
    return ok('dl.instagram', {
      url,
      downloaded: true,
      command: 'instagram',
      media: { kind: 'video', buffer: downloaded.buffer, mimetype: 'video/mp4' },
    });
  }
  if (media) {
    return ok('dl.instagram', { url, downloaded: true, command: 'instagram', media: { kind: 'video', url: media } });
  }

  return ok('dl.link', {
    network: 'Instagram',
    icon: '📸',
    url,
    hint: 'No se pudo descargar ahora. El contenido privado no es accesible: pide el enlace público.',
    command: 'instagram',
  });
}

/* ═══════════════════════════════════════════════════════════════
   .spotify — búsqueda real vía Deezer + preview MP3 de 30 s
   ═══════════════════════════════════════════════════════════════ */

export async function spotify(ctx, queryRaw = null) {
  const query = sanitizeText(queryRaw, 160);
  if (!query) return needQuery(ctx, 'spotify', 'https://open.spotify.com/…');
  const isUrl = /spotify\.com|spotify:/.test(query);

  // enlace directo: metadatos vía oEmbed público
  if (isUrl) {
    const meta = await fetchJson(`https://open.spotify.com/oembed?url=${encodeURIComponent(query)}`, { timeout: 10_000 });
    if (meta?.title) {
      return ok('dl.spotify', {
        query,
        title: meta.title,
        author: meta.html ? 'Spotify' : 'Spotify',
        type: meta.type ?? 'enlace',
        thumbnail: meta.thumbnail_url ?? null,
        url: query,
        command: 'spotify',
        media: meta.thumbnail_url ? { kind: 'image', url: meta.thumbnail_url } : null,
      });
    }
    return ok('dl.link', {
      network: 'Spotify',
      icon: '🎧',
      url: query,
      hint: 'Usa este enlace en tu app; para el MP3 busca el título con .play.',
      command: 'spotify',
    });
  }

  // búsqueda por título: Deezer (API pública) con preview de audio real
  const search = await fetchJson(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=3`, { timeout: 10_000 });
  const track = search?.data?.[0] ?? null;
  if (track) {
    const mediaExtra = track.preview
      ? [{ kind: 'audio', url: track.preview, mimetype: 'audio/mpeg', caption: '' }]
      : [];
    return ok(
      'dl.spotify',
      {
        query,
        title: track.title,
        author: track.artist?.name ?? 'Desconocido',
        album: track.album?.title ?? '',
        type: 'canción',
        thumbnail: track.album?.cover_medium ?? track.album?.cover ?? null,
        url: track.link ?? `https://open.spotify.com/search/${encodeURIComponent(query)}`,
        preview: Boolean(track.preview),
        command: 'spotify',
        media: track.album?.cover_medium || track.album?.cover ? { kind: 'image', url: track.album.cover_medium ?? track.album.cover } : null,
      },
      { mediaExtra }
    );
  }

  return ok('dl.link', {
    network: 'Spotify',
    icon: '🎧',
    url: `https://open.spotify.com/search/${encodeURIComponent(query)}`,
    hint: 'Abre el resultado en Spotify, o pide el audio con .play <título>.',
    command: 'spotify',
  });
}

/* ═══════════════════════════════════════════════════════════════
   .pinterest — imágenes reales (scrape → Wikimedia de respaldo)
   ═══════════════════════════════════════════════════════════════ */

async function searchPinterestImages(query, limit = 3) {
  const data = {
    options: { query, scope: 'pins', no_fetch_context_on_resource: false },
    context: {},
  };
  const url = `https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=${encodeURIComponent(`/search/pins/?q=${query}`)}&data=${encodeURIComponent(JSON.stringify(data))}`;
  const json = await fetchJson(url, { timeout: 12_000, headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }).catch(() => null);
  const results = json?.resource_response?.data?.results ?? json?.resource?.data?.results ?? [];
  return results
    .map((item) => item?.images?.orig?.url ?? item?.images?.['736x']?.url ?? null)
    .filter(Boolean)
    .slice(0, limit);
}

async function searchWikimediaImages(query, limit = 3) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=${limit}&gsrsearch=${encodeURIComponent(`filetype:bitmap ${query}`)}&prop=imageinfo&iiprop=url&iiurlwidth=800`;
  const json = await fetchJson(url, { timeout: 12_000 });
  const pages = json?.query?.pages ? Object.values(json.query.pages) : [];
  return pages
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((page) => page?.imageinfo?.[0]?.thumburl ?? page?.imageinfo?.[0]?.url ?? null)
    .filter(Boolean)
    .slice(0, limit);
}

export async function pinterest(ctx, queryRaw = null) {
  const query = sanitizeText(queryRaw, 120);
  if (!query) return needQuery(ctx, 'pinterest', 'gatos samurái');

  let images = await searchPinterestImages(query, 3).catch(() => []);
  if (!images.length) images = await searchWikimediaImages(query, 3).catch(() => []);

  if (!images.length) {
    return ok('dl.link', {
      network: 'Pinterest',
      icon: '📌',
      url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`,
      hint: 'Sin conexión ahora mismo. Abre el enlace y guarda la imagen; luego mándala con .s para hacer sticker.',
      command: 'pinterest',
    });
  }

  const buffers = await Promise.all(images.map((u) => fetchBuffer(u, { maxBytes: 6 * 1024 * 1024, timeout: 12_000 })));
  const mediaExtra = buffers
    .map((buffer, index) => (Buffer.isBuffer(buffer) && buffer.length > 256 ? { kind: 'image', buffer, caption: index === 0 ? `📌 ${query}` : '' } : null))
    .filter(Boolean);

  return ok(
    'dl.pinterest',
    { query, count: mediaExtra.length, command: 'pinterest' },
    { mediaExtra }
  );
}

/* ═══════════════════════════════════════════════════════════════
   .lyrics — letra real vía lyrics.ovh
   ═══════════════════════════════════════════════════════════════ */

export async function lyrics(ctx, queryRaw = null) {
  const query = sanitizeText(queryRaw, 120);
  if (!query) return needQuery(ctx, 'lyrics', 'shakira bzrp');

  // 1 · sugerencia: convierte "shakira bzrp" en (artista, título)
  let artist = null;
  let title = null;
  const suggest = await fetchJson(`https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`, { timeout: 10_000 });
  const first = suggest?.data?.[0] ?? null;
  if (first?.artist?.name && first?.title) {
    artist = first.artist.name;
    title = first.title;
  } else if (query.includes('-')) {
    const [a, t] = query.split('-', 2);
    artist = a.trim(); title = t.trim();
  }
  const found = artist && title
    ? await fetchJson(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`, { timeout: 12_000 })
    : null;
  const lyricsText = found?.lyrics?.trim();

  if (lyricsText) {
    return ok('dl.lyrics', {
      query,
      artist,
      title,
      lyrics: lyricsText.slice(0, 3600),
      truncated: lyricsText.length > 3600,
      geniusUrl: `https://genius.com/search?q=${encodeURIComponent(query)}`,
      letrasUrl: `https://www.letras.com/?q=${encodeURIComponent(query)}`,
      command: 'lyrics',
    });
  }

  return ok('dl.lyrics', {
    query,
    geniusUrl: `https://genius.com/search?q=${encodeURIComponent(query)}`,
    letrasUrl: `https://www.letras.com/?q=${encodeURIComponent(query)}`,
    command: 'lyrics',
  });
}

export default { play, ytmp3, tiktok, instagram, spotify, pinterest, lyrics, searchYouTube };
