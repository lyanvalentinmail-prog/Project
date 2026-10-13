/**
 * Catálogo de endpoints disponibles
 * ────────────────────────────────────────────────────────────────
 * Cada categoría contiene sus endpoints con metadata.
 */
export const endpoints = [
  {
    category: 'Shorten',
    icon: '🔗',
    items: [
      { name: 'TinyURL', path: '/short/tinyurl', method: 'GET', tier: 'free', description: 'Acorta URLs con TinyURL' },
      { name: 'Nexray', path: '/short/nexray', method: 'GET', tier: 'free', description: 'Acorta URLs con Nexray' },
    ],
  },
  {
    category: 'Downloaders',
    icon: '⬇️',
    items: [
      { name: 'YouTube Play', path: '/dl/youtubeplay', method: 'GET', tier: 'premium', description: 'Descarga video/audio de YouTube' },
      { name: 'YouTube MP4', path: '/dl/ytmp4', method: 'GET', tier: 'premium', description: 'Descarga YouTube como MP4' },
      { name: 'YouTube MP3', path: '/dl/ytmp3', method: 'GET', tier: 'premium', description: 'Descarga YouTube como MP3' },
      { name: 'MediaFire', path: '/dl/mediafire', method: 'GET', tier: 'premium', description: 'Descarga archivos de MediaFire' },
      { name: 'SoundCloud', path: '/dl/soundcloud', method: 'GET', tier: 'premium', description: 'Descarga pistas de SoundCloud' },
      { name: 'Instagram', path: '/dl/instagram', method: 'GET', tier: 'premium', description: 'Descarga contenido de Instagram' },
      { name: 'Spotify', path: '/dl/spotify', method: 'GET', tier: 'premium', description: 'Descarga pistas de Spotify' },
      { name: 'Facebook', path: '/dl/facebook', method: 'GET', tier: 'premium', description: 'Descarga videos de Facebook' },
      { name: 'Twitter (X)', path: '/dl/twitter', method: 'GET', tier: 'premium', description: 'Descarga tweets multimedia' },
      { name: 'TikTok', path: '/dl/tiktok', method: 'GET', tier: 'premium', description: 'Descarga videos de TikTok' },
      { name: 'TikTok MP3', path: '/dl/tiktokmp3', method: 'GET', tier: 'premium', description: 'Descarga audio de TikTok' },
      { name: 'Threads', path: '/dl/threads', method: 'GET', tier: 'hybrid', description: 'Descarga contenido de Threads' },
      { name: 'Deezer', path: '/dl/deezer', method: 'GET', tier: 'free', description: 'Descarga pistas de Deezer' },
    ],
  },
  {
    category: 'StickerLy',
    icon: '🎨',
    items: [
      { name: 'Buscar paquetes', path: '/stickerly/search', method: 'GET', tier: 'premium', description: 'Busca paquetes de stickers' },
      { name: 'Detalle de paquete', path: '/stickerly/detail', method: 'GET', tier: 'premium', description: 'Detalle de un paquete de stickers' },
    ],
  },
  {
    category: 'Stalking',
    icon: '🔍',
    items: [
      { name: 'GitHub Profile', path: '/stalking/github', method: 'GET', tier: 'free', description: 'Info pública de perfil de GitHub' },
      { name: 'Telegram Channel', path: '/stalking/telegram', method: 'GET', tier: 'free', description: 'Info de canal de Telegram' },
      { name: 'TikTok Profile', path: '/stalking/tiktok', method: 'GET', tier: 'free', description: 'Info de perfil de TikTok' },
    ],
  },
  {
    category: 'Searches',
    icon: '🔎',
    items: [
      { name: 'YouTube Search', path: '/search/yt', method: 'GET', tier: 'premium', description: 'Busca videos en YouTube' },
      { name: 'Spotify Search', path: '/search/spotify', method: 'GET', tier: 'premium', description: 'Busca pistas en Spotify' },
      { name: 'Instagram Search', path: '/search/instagram', method: 'GET', tier: 'premium', description: 'Busca en Instagram' },
      { name: 'Pinterest Search', path: '/search/pinterest', method: 'GET', tier: 'premium', description: 'Busca imágenes en Pinterest' },
      { name: 'TikTok Search', path: '/search/tiktok', method: 'GET', tier: 'premium', description: 'Busca videos en TikTok' },
      { name: 'Deezer Search', path: '/search/deezer', method: 'GET', tier: 'free', description: 'Busca pistas en Deezer' },
      { name: 'SoundCloud Search', path: '/search/soundcloud', method: 'GET', tier: 'premium', description: 'Busca en SoundCloud' },
      { name: 'Facebook Search', path: '/search/facebook', method: 'GET', tier: 'premium', description: 'Busca en Facebook' },
      { name: 'APK Search', path: '/search/apk', method: 'GET', tier: 'premium', description: 'Busca aplicaciones APK' },
    ],
  },
  {
    category: 'Utilidades',
    icon: '🛠️',
    items: [
      { name: 'Brat', path: '/tools/brat', method: 'GET', tier: 'free', description: 'Genera imagen estilo Brat' },
      { name: 'Lyrics', path: '/tools/lyrics', method: 'GET', tier: 'premium', description: 'Busca letras de canciones' },
      { name: 'Translate', path: '/tools/translate', method: 'GET', tier: 'hybrid', description: 'Traduce textos entre idiomas' },
      { name: 'Remove Background', path: '/tools/removebg', method: 'GET', tier: 'premium', description: 'Elimina fondo de imágenes' },
      { name: 'NpmJs Search', path: '/tools/npmjs', method: 'GET', tier: 'free', description: 'Busca paquetes en NPM' },
      { name: 'Emoji Mix', path: '/tools/emojimix', method: 'GET', tier: 'free', description: 'Mezcla dos emojis' },
      { name: 'Screenshot', path: '/tools/ssweb', method: 'GET', tier: 'free', description: 'Captura de pantalla web' },
      { name: 'WhatMusic', path: '/tools/whatmusic', method: 'GET', tier: 'hybrid', description: 'Identifica canciones' },
      { name: 'Country Info', path: '/tools/country', method: 'GET', tier: 'free', description: 'Info de países' },
      { name: 'WhatsApp Channel', path: '/tools/newsletter', method: 'GET', tier: 'free', description: 'Info de canal de WhatsApp' },
      { name: 'Image Upscaler', path: '/tools/upscale', method: 'GET', tier: 'premium', description: 'Mejora resolución de imágenes' },
      { name: 'Image OCR', path: '/tools/ocr', method: 'GET', tier: 'premium', description: 'Extrae texto de imágenes' },
      { name: 'Quote Sticker', path: '/tools/quotesticker', method: 'GET', tier: 'free', description: 'Genera sticker de cita' },
      { name: 'Host Info', path: '/tools/hostinfo', method: 'GET', tier: 'premium', description: 'Info de dominio/host' },
      { name: 'Vocal Remover', path: '/tools/vocalremover', method: 'GET', tier: 'free', description: 'Elimina voces de audio' },
    ],
  },
  {
    category: 'Anime',
    icon: '🌸',
    items: [
      { name: 'Interaction', path: '/sfw/interaction', method: 'GET', tier: 'free', description: 'Imágenes SFW de interacciones' },
      { name: 'AnimeDL', path: '/anime/dl/anime', method: 'GET', tier: 'premium', description: 'Descarga anime' },
      { name: 'AnimeEpisodeDL', path: '/anime/dl/episode', method: 'GET', tier: 'premium', description: 'Descarga episodio de anime' },
      { name: 'BlueArchive', path: '/anime/bluearchive', method: 'GET', tier: 'free', description: 'Imágenes de Blue Archive' },
      { name: 'Waifu', path: '/anime/waifu', method: 'GET', tier: 'free', description: 'Imágenes de waifu aleatorias' },
    ],
  },
  {
    category: 'Generadores',
    icon: '✨',
    items: [
      { name: 'Level Up', path: '/generate/levelup', method: 'GET', tier: 'free', description: 'Genera tarjeta de nivel' },
      { name: 'Rank', path: '/generate/rank', method: 'GET', tier: 'free', description: 'Genera tarjeta de rango' },
      { name: 'Ship', path: '/generate/ship', method: 'GET', tier: 'free', description: 'Genera imagen de compatibilidad' },
      { name: 'Welcome Image', path: '/generate/welcome-image', method: 'GET', tier: 'free', description: 'Genera imagen de bienvenida' },
      { name: 'Bye Image', path: '/generate/bye-image', method: 'GET', tier: 'free', description: 'Genera imagen de despedida' },
      { name: 'Tweet', path: '/generate/tweet', method: 'GET', tier: 'free', description: 'Genera imagen de tweet falso' },
      { name: 'Instagram', path: '/generate/instagram', method: 'GET', tier: 'free', description: 'Genera post de Instagram falso' },
      { name: 'Profile Discord', path: '/generate/profilediscord', method: 'GET', tier: 'free', description: 'Genera perfil de Discord' },
      { name: 'Security', path: '/generate/security', method: 'GET', tier: 'free', description: 'Genera imagen de seguridad' },
      { name: 'Delete Image', path: '/generate/delete', method: 'GET', tier: 'free', description: 'Genera imagen de eliminación' },
      { name: 'Rank2', path: '/generate/rank2', method: 'GET', tier: 'free', description: 'Genera tarjeta de rango v2' },
      { name: 'LevelUp2', path: '/generate/levelup2', method: 'GET', tier: 'free', description: 'Genera tarjeta de nivel v2' },
      { name: 'Horny', path: '/generate/horny', method: 'GET', tier: 'free', description: 'Genera imagen humorística' },
      { name: 'Welcome 2', path: '/generate/welcome2', method: 'GET', tier: 'free', description: 'Genera bienvenida v2' },
    ],
  },
  {
    category: 'AI',
    icon: '🤖',
    items: [
      { name: 'ChatGPT', path: '/ai/chatgpt', method: 'GET', tier: 'premium', description: 'Chat con GPT' },
      { name: 'ChatGPT Prompt', path: '/ai/gptprompt', method: 'GET', tier: 'premium', description: 'GPT con prompt personalizado' },
      { name: 'Copilot', path: '/ai/copilot', method: 'GET', tier: 'free', description: 'Chat con Copilot' },
      { name: 'DeepSeek', path: '/ai/deepseek', method: 'GET', tier: 'premium', description: 'Chat con DeepSeek' },
      { name: 'Gemini', path: '/ai/gemini', method: 'GET', tier: 'premium', description: 'Chat con Gemini' },
    ],
  },
];

/** Cuenta total de endpoints. */
export function totalEndpoints() {
  return endpoints.reduce((sum, cat) => sum + cat.items.length, 0);
}

/** Cuenta por tier. */
export function countByTier() {
  const counts = { free: 0, premium: 0, hybrid: 0 };
  for (const cat of endpoints) {
    for (const item of cat.items) {
      counts[item.tier] = (counts[item.tier] || 0) + 1;
    }
  }
  return counts;
}