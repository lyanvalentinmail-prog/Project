/**
 * 𓆩 💐 𓆪  VÉRSOVA · comandos de herramientas (paquete Raiden)
 * ────────────────────────────────────────────────────────────────
 * IA conversacional, vista única y conversiones. Nombres y alias
 * exactos de Raiden-WaBot, más algunos alias extra en español.
 */
import * as tools from '../services/tools.service.js';

export const toolsCommands = [
  {
    name: 'ia',
    aliases: ['chat', 'bot', 'gpt', 'chatgpt', 'gemini'],
    category: 'tools',
    permission: 'all',
    args: '<pregunta>',
    groupOnly: false,
    description: 'Pregunta a la inteligencia artificial del bot y recibe una respuesta.',
    example: '.ia quién eres',
    run: (ctx) => tools.ia(ctx, ctx.args || null),
  },
  {
    name: 'ver',
    aliases: ['read', 'view', 'readviewonce', 'vv'],
    category: 'tools',
    permission: 'all',
    groupOnly: false,
    description: 'Revela el mensaje de vista única que citaste (solo texto).',
    example: '.ver (citando el mensaje)',
    run: (ctx) => tools.viewOnce(ctx),
  },
  {
    name: 'toimg',
    aliases: ['toimage', 'img', 'tophoto'],
    category: 'tools',
    permission: 'all',
    groupOnly: false,
    description: 'Convierte el sticker citado en una imagen.',
    example: '.toimg (citando un sticker)',
    run: (ctx) => tools.toimg(ctx),
  },
  {
    name: 'tomp3',
    aliases: ['toaudio', 'mp3'],
    category: 'tools',
    permission: 'all',
    groupOnly: false,
    description: 'Convierte el video o nota de voz citada en audio MP3.',
    example: '.tomp3 (citando un video)',
    run: (ctx) => tools.tomp3(ctx),
  },
];

export default toolsCommands;
