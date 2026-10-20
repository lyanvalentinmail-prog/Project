/**
 * 𓆩 🌐 𓆪  VÉRSOVA · servicio en línea para la API (/api/v1)
 * ────────────────────────────────────────────────────────────────
 * Resolutores de red reutilizables: descargas vía cobalt/tikwm,
 * búsquedas (YouTube, Deezer, letras, Jikan, Wikipedia, clima),
 * IA conversacional, traducción y acortador de enlaces.
 *
 * Todos devuelven datos planos o `null`/`[]` si el servicio externo
 * falla: quien llama decide el error. Nada aquí habla con WhatsApp.
 */
import { fetchJson, fetchText } from '../utils/net.js';
import { searchYouTube } from './download.service.js';

const UA = { 'User-Agent': 'VersovaBot/1.0 (+panel)', Accept: 'application/json' };

/* ═══════════════════════════════════════════════════════════════
   Descargas · cobalt (resuelve el enlace, no baja el archivo)
   ═══════════════════════════════════════════════════════════════ */

function cobaltInstances() {
  const fromEnv = String(process.env.COBALT_INSTANCES ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return fromEnv.length ? fromEnv : ['https://api.cobalt.tools/'];
}

/**
 * Pide a cobalt el enlace directo de descarga de una URL pública
 * (YouTube, TikTok, Instagram, Facebook, X, Pinterest…).
 * Devuelve { url, filename, picker, source } o null.
 */
export async function cobaltResolve(mediaUrl, { audio = false } = {}) {
  for (const base of cobaltInstances()) {
    try {
      const endpoint = base.endsWith('/') ? base : `${base}/`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...UA },
        body: JSON.stringify(audio
          ? { url: mediaUrl, downloadMode: 'audio', audioFormat: 'mp3' }
          : { url: mediaUrl, videoQuality: '720' }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response?.ok) continue;
      const data = await response.json().catch(() => null);
      const picker = Array.isArray(data?.picker)
        ? data.picker.filter((item) => item?.url).map((item) => ({ type: item.type ?? 'media', url: item.url }))
        : [];
      const url = data?.url ?? data?.audio ?? picker[0]?.url ?? null;
      if (!url || !/^https?:\/\//.test(url)) continue;
      return { url, filename: data?.filename ?? null, picker, source: 'cobalt' };
    } catch {
      /* prueba la siguiente instancia */
    }
  }
  return null;
}

/* ── TikTok · tikwm (sin marca de agua + metadatos) ────────────── */

export async function tiktokResolve(mediaUrl) {
  const data = await fetchJson(`https://www.tikwm.com/api/?url=${encodeURIComponent(mediaUrl)}&hd=1`, { timeout: 15_000, headers: UA });
  const video = data?.data;
  if (!video?.play && !video?.hdplay) return null;
  return {
    title: video.title ?? '',
    author: video.author?.nickname ?? video.author?.unique_id ?? '',
    duration: video.duration ?? null,
    cover: video.cover ?? null,
    download: video.hdplay ?? video.play,
    downloadSd: video.play ?? null,
    downloadWatermark: video.wmplay ?? null,
    music: video.music ?? null,
    source: 'tikwm',
  };
}

/* ═══════════════════════════════════════════════════════════════
   Búsquedas
   ═══════════════════════════════════════════════════════════════ */

export async function youtubeSearch(query, limit = 5) {
  return searchYouTube(query, limit);
}

export async function deezerSearch(query, limit = 5) {
  const data = await fetchJson(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`, { timeout: 12_000, headers: UA });
  return (data?.data ?? []).map((track) => ({
    title: track.title ?? '',
    artist: track.artist?.name ?? '',
    album: track.album?.title ?? '',
    duration: track.duration ?? null,
    preview: track.preview ?? null,
    cover: track.album?.cover_medium ?? null,
    url: track.link ?? null,
  }));
}

export async function lyricsSearch(query) {
  let artist = null;
  let title = null;
  const suggest = await fetchJson(`https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`, { timeout: 12_000, headers: UA });
  const first = suggest?.data?.[0] ?? null;
  if (first?.artist?.name && first?.title) {
    artist = first.artist.name;
    title = first.title;
  } else if (query.includes('-')) {
    const [a, t] = query.split('-', 2);
    artist = a.trim();
    title = t.trim();
  }
  if (!artist || !title) return null;
  const found = await fetchJson(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`, { timeout: 12_000, headers: UA });
  const lyrics = found?.lyrics?.trim();
  if (!lyrics) return null;
  return { artist, title, lyrics: lyrics.slice(0, 6000), truncated: lyrics.length > 6000 };
}

export async function animeSearch(query, limit = 5) {
  const data = await fetchJson(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=${limit}&order_by=score&sort=desc&sfw=true`, { timeout: 12_000, headers: UA });
  return (data?.data ?? []).map((anime) => ({
    title: anime.title ?? '',
    titleEnglish: anime.title_english ?? null,
    type: anime.type ?? null,
    score: anime.score ?? null,
    episodes: anime.episodes ?? null,
    year: anime.year ?? anime.aired?.prop?.from?.year ?? null,
    status: anime.status ?? null,
    synopsis: anime.synopsis ? String(anime.synopsis).slice(0, 400) : null,
    image: anime.images?.jpg?.image_url ?? null,
    url: anime.url ?? null,
  }));
}

export async function wikipediaSummary(query, lang = 'es') {
  const host = `https://${lang}.wikipedia.org`;
  const search = await fetchJson(`${host}/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json`, { timeout: 12_000, headers: UA });
  const title = search?.[1]?.[0];
  if (!title) return null;
  const fallback = { title, extract: search?.[2]?.[0] ?? null, url: search?.[3]?.[0] ?? null, thumbnail: null, lang };
  const summary = await fetchJson(`${host}/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { timeout: 12_000, headers: UA });
  if (!summary?.extract) return fallback;
  return {
    title: summary.title ?? title,
    extract: String(summary.extract).slice(0, 2000),
    url: summary.content_urls?.desktop?.page ?? fallback.url,
    thumbnail: summary.thumbnail?.source ?? null,
    lang,
  };
}

/* ── Clima · Open-Meteo (sin API key) ──────────────────────────── */

const WMO_TEXT = {
  0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
  45: 'Niebla', 48: 'Niebla', 51: 'Llovizna ligera', 53: 'Llovizna', 55: 'Llovizna intensa',
  56: 'Llovizna helada', 57: 'Llovizna helada', 61: 'Lluvia ligera', 63: 'Lluvia', 65: 'Lluvia intensa',
  66: 'Lluvia helada', 67: 'Lluvia helada', 71: 'Nieve ligera', 73: 'Nieve', 75: 'Nieve intensa', 77: 'Granos de nieve',
  80: 'Chubascos ligeros', 81: 'Chubascos', 82: 'Chubascos violentos', 85: 'Chubascos de nieve', 86: 'Chubascos de nieve',
  95: 'Tormenta', 96: 'Tormenta con granizo', 99: 'Tormenta con granizo',
};

export async function weatherNow(city) {
  const geo = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es&format=json`, { timeout: 12_000, headers: UA });
  const place = geo?.results?.[0];
  if (!place) return null;
  const current = 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m';
  const forecast = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=${current}&timezone=auto`, { timeout: 12_000, headers: UA });
  const now = forecast?.current;
  if (!now) return null;
  return {
    city: place.name,
    region: place.admin1 ?? null,
    country: place.country ?? null,
    timezone: place.timezone ?? null,
    temperature: now.temperature_2m,
    feelsLike: now.apparent_temperature,
    humidity: now.relative_humidity_2m,
    windKmh: now.wind_speed_10m,
    condition: WMO_TEXT[now.weather_code] ?? '—',
    weatherCode: now.weather_code,
    units: '°C',
  };
}

/* ═══════════════════════════════════════════════════════════════
   IA · chat y traducción
   ═══════════════════════════════════════════════════════════════ */

export async function aiChat(prompt, { system = null } = {}) {
  const systemPrompt = system || 'Eres un asistente útil y amable. Responde en el idioma del usuario, claro y directo.';
  const endpoint = `https://api.delirius.online/ia/gptprompt?text=${encodeURIComponent(prompt)}&prompt=${encodeURIComponent(systemPrompt)}`;
  const data = await fetchJson(endpoint, { timeout: 20_000, headers: UA });
  const value = data?.data ?? data?.result ?? data?.response ?? data?.data?.response;
  if (!value || typeof value !== 'string') return null;
  return { response: value.trim().slice(0, 4000), provider: 'delirius' };
}

export async function translateText(value, { from = 'autodetect', to = 'en' } = {}) {
  const endpoint = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(value)}&langpair=${encodeURIComponent(from)}|${encodeURIComponent(to)}`;
  const data = await fetchJson(endpoint, { timeout: 15_000, headers: UA });
  const translated = data?.responseData?.translatedText;
  if (!translated || typeof translated !== 'string') return null;
  return { translated, from, to, provider: 'mymemory' };
}

/* ═══════════════════════════════════════════════════════════════
   Web · acortador de enlaces
   ═══════════════════════════════════════════════════════════════ */

export async function shortenUrl(longUrl) {
  const out = await fetchText(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(longUrl)}`, { timeout: 12_000, headers: UA });
  const value = String(out ?? '').trim();
  if (!/^https?:\/\//.test(value)) return null;
  return { short: value, provider: 'is.gd' };
}

export default {
  cobaltResolve,
  tiktokResolve,
  youtubeSearch,
  deezerSearch,
  lyricsSearch,
  animeSearch,
  wikipediaSummary,
  weatherNow,
  aiChat,
  translateText,
  shortenUrl,
};
