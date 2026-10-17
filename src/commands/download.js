/**
 * 𓆩 🛍️ 𓆪  VÉRSOVA · comandos de descargas (paquete Raiden)
 * ────────────────────────────────────────────────────────────────
 * Música, videos, letras y redes. Nombres y alias de Raiden-WaBot.
 */
import * as downloads from '../services/download.service.js';

export const downloadCommands = [
  {
    name: 'play',
    aliases: ['playaudio', 'audio'],
    category: 'download',
    permission: 'all',
    args: '<título o enlace>',
    groupOnly: false,
    description: 'Busca audio de YouTube por título o enlace y devuelve el resultado.',
    example: '.play bad bunny diles',
    run: (ctx) => downloads.play(ctx, ctx.args || null, { video: false }),
  },
  {
    name: 'play2',
    aliases: ['ytmp4', 'video', 'playv'],
    category: 'download',
    permission: 'all',
    args: '<título o enlace>',
    groupOnly: false,
    description: 'Busca video de YouTube por título o enlace y devuelve el resultado.',
    example: '.play2 shakira bzrp',
    run: (ctx) => downloads.play(ctx, ctx.args || null, { video: true }),
  },
  {
    name: 'yta',
    aliases: ['ytmp3'],
    category: 'download',
    permission: 'all',
    args: '<título o enlace>',
    groupOnly: false,
    description: 'Descarga y envía audio de YouTube en formato MP3.',
    example: '.yta https://youtu.be/xxxx',
    run: (ctx) => downloads.ytmp3(ctx, ctx.args || null),
  },
  {
    name: 'tiktok',
    aliases: ['tt', 'tk'],
    category: 'download',
    permission: 'all',
    args: '<enlace>',
    groupOnly: false,
    description: 'Descarga videos de TikTok a partir de su enlace.',
    example: '.tiktok https://www.tiktok.com/…',
    run: (ctx) => downloads.tiktok(ctx, ctx.args || null),
  },
  {
    name: 'instagram',
    aliases: ['ig', 'igdl'],
    category: 'download',
    permission: 'all',
    args: '<enlace>',
    groupOnly: false,
    description: 'Descarga contenido público de Instagram (reels, fotos e historias).',
    example: '.instagram https://www.instagram.com/…',
    run: (ctx) => downloads.instagram(ctx, ctx.args || null),
  },
  {
    name: 'spotify',
    aliases: ['sp', 'spotifydl'],
    category: 'download',
    permission: 'all',
    args: '<título o enlace>',
    groupOnly: false,
    description: 'Descarga música de Spotify por título o enlace.',
    example: '.spotify https://open.spotify.com/…',
    run: (ctx) => downloads.spotify(ctx, ctx.args || null),
  },
  {
    name: 'pinterest',
    aliases: ['pin'],
    category: 'download',
    permission: 'all',
    args: '<búsqueda>',
    groupOnly: false,
    description: 'Busca imágenes de Pinterest por palabra clave.',
    example: '.pinterest gatos samurái',
    run: (ctx) => downloads.pinterest(ctx, ctx.args || null),
  },
  {
    name: 'lyrics',
    aliases: ['letra', 'lyric'],
    category: 'download',
    permission: 'all',
    args: '<canción>',
    groupOnly: false,
    description: 'Busca la letra de una canción por título y artista.',
    example: '.lyrics shakira bzrp',
    run: (ctx) => downloads.lyrics(ctx, ctx.args || null),
  },
];

export default downloadCommands;
