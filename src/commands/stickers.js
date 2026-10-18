/**
 * 𓆩 ⭐ 𓆪  VÉRSOVA · comandos de stickers (paquete Raiden)
 * ────────────────────────────────────────────────────────────────
 * Conversión de imágenes a sticker WebP, metadatos, brat y búsqueda.
 * Nombres y alias exactos de Raiden-WaBot, más alias en español.
 */
import * as stickers from '../services/stickers.service.js';

export const stickersCommands = [
  {
    name: 's',
    aliases: ['sticker', 'stiker', 'wm'],
    category: 'stickers',
    permission: 'all',
    args: '[pack | autor]',
    groupOnly: false,
    description: 'Convierte una imagen adjunta o citada en un sticker WebP y lo envía al chat.',
    example: '.s (con una imagen adjunta o citada; también puedes responder a ella)',
    run: (ctx) => stickers.createSticker(ctx, ctx.args || null),
  },
  {
    name: 'spack',
    aliases: [],
    category: 'stickers',
    permission: 'all',
    args: '<nombre del pack>',
    groupOnly: false,
    description: 'Crea y envía un sticker por cada foto del álbum al que respondas; el autor es el nombre del bot.',
    example: '.spack Mis fotos',
    run: (ctx) => stickers.stickerPack(ctx, ctx.args || null),
  },
  {
    name: 'setmeta',
    aliases: ['sm', 'setpack', 'mimetadatos'],
    category: 'stickers',
    permission: 'all',
    args: '<pack | autor>',
    groupOnly: true,
    description: 'Guarda por grupo tus metadatos predeterminados de nombre de pack y autor para tus stickers.',
    example: '.setmeta mi pack | yo',
    run: (ctx) => stickers.setMeta(ctx, ctx.args || null),
  },
  {
    name: 'delmeta',
    aliases: ['dm', 'delpack'],
    category: 'stickers',
    permission: 'all',
    groupOnly: true,
    description: 'Elimina tus metadatos de stickers guardados.',
    example: '.delmeta',
    run: (ctx) => stickers.delMeta(ctx),
  },
  {
    name: 'brat',
    aliases: ['bratv', 'bratty'],
    category: 'stickers',
    permission: 'all',
    args: '<texto>',
    groupOnly: false,
    description: 'Genera y envía un sticker WebP tipo BRAT con el texto que escribas.',
    example: '.brat hola mundo',
    run: (ctx) => stickers.brat(ctx, ctx.args || null),
  },
  {
    name: 'attp',
    aliases: [],
    category: 'stickers',
    permission: 'all',
    args: '<texto>',
    groupOnly: false,
    description: 'Genera y envía un sticker WebP animado con texto de colores.',
    example: '.attp hola mundo',
    run: (ctx) => stickers.attp(ctx, ctx.args || null),
  },
  {
    name: 'ttp',
    aliases: [],
    category: 'stickers',
    permission: 'all',
    args: '<texto>',
    groupOnly: false,
    description: 'Genera y envía un sticker WebP con texto y contorno.',
    example: '.ttp hola mundo',
    run: (ctx) => stickers.ttp(ctx, ctx.args || null),
  },
  {
    name: 'ssearch',
    aliases: ['stickerly', 'stickers', 'buscarsticker', 'ss'],
    category: 'stickers',
    permission: 'all',
    args: '<búsqueda>',
    groupOnly: false,
    description: 'Busca paquetes de stickers por palabra clave en Sticker.ly.',
    example: '.ssearch gatos',
    run: (ctx) => stickers.ssearch(ctx, ctx.args || null),
  },
];

export default stickersCommands;
