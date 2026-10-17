/**
 * 𓆩 ⭐ 𓆪  VÉRSOVA · comandos de stickers (paquete Raiden)
 * ────────────────────────────────────────────────────────────────
 * Creación, metadatos, brat y búsqueda. Nombres y alias exactos
 * de Raiden-WaBot, más algunos alias extra en español.
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
    description: 'Crea un sticker desde la imagen, video o sticker citado, con metadatos opcionales.',
    example: '.s mi pack | yo',
    run: (ctx) => stickers.stickerGuide(ctx),
  },
  {
    name: 'setmeta',
    aliases: ['sm', 'setpack', 'mimetadatos'],
    category: 'stickers',
    permission: 'all',
    args: '<pack | autor>',
    groupOnly: false,
    description: 'Guarda tus metadatos predeterminados de nombre de pack y autor para tus stickers.',
    example: '.setmeta mi pack | yo',
    run: (ctx) => stickers.setMeta(ctx, ctx.args || null),
  },
  {
    name: 'delmeta',
    aliases: ['dm', 'delpack'],
    category: 'stickers',
    permission: 'all',
    groupOnly: false,
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
    description: 'Genera un sticker tipo "brat" con el texto que escribas.',
    example: '.brat hola mundo',
    run: (ctx) => stickers.brat(ctx, ctx.args || null),
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
