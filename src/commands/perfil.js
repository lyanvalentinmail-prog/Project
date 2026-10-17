/**
 * 𓆩 🌸 𓆪  VÉRSOVA · comandos de perfil extendido (paquete Raiden)
 * ────────────────────────────────────────────────────────────────
 * Matrimonios, cumpleaños, descripción, género y foto. Nombres y
 * alias exactos de Raiden-WaBot, más algunos alias extra en español.
 */
import * as perfil from '../services/perfil.service.js';

export const perfilCommands = [
  {
    name: 'marry',
    aliases: ['casar', 'matrimonio', 'casarse'],
    category: 'perfil',
    permission: 'all',
    args: '<@usuario>',
    description: 'Proponle matrimonio a otro usuario. Si ambos se proponen, se casan.',
    example: '.marry @usuario',
    run: (ctx) => perfil.marry(ctx, ctx.argList[0] ?? null),
  },
  {
    name: 'divorce',
    aliases: ['divorciar', 'divorcio', 'div'],
    category: 'perfil',
    permission: 'all',
    description: 'Te divorcias de tu pareja actual y terminas el matrimonio.',
    example: '.divorce',
    run: (ctx) => perfil.divorce(ctx),
  },
  {
    name: 'history',
    aliases: ['historial', 'historialmatrimonial', 'marryhistory', 'marryhist', 'mh'],
    category: 'perfil',
    permission: 'all',
    args: '[@usuario]',
    description: 'Muestra el historial de matrimonios de un usuario del grupo.',
    example: '.history @usuario',
    run: (ctx) => perfil.history(ctx, ctx.argList[0] ?? null),
  },
  {
    name: 'setbirth',
    aliases: ['setcumple', 'setbirthday', 'setb', 'micumple'],
    category: 'perfil',
    permission: 'all',
    args: '<mes/día>',
    groupOnly: false,
    description: 'Guarda tu fecha de cumpleaños (mes/día, año opcional).',
    example: '.setbirth 12/25',
    run: (ctx) => perfil.setBirth(ctx, ctx.argList[0] ?? null),
  },
  {
    name: 'setdesc',
    aliases: ['setbio', 'setdescription', 'setd', 'midesc'],
    category: 'perfil',
    permission: 'all',
    args: '<texto>',
    groupOnly: false,
    description: 'Guarda la descripción de tu perfil (sin texto la elimina).',
    example: '.setdesc amo el rol nocturno',
    run: (ctx) => perfil.setDesc(ctx, ctx.args || null),
  },
  {
    name: 'setgenre',
    aliases: ['setgenero', 'setg', 'migenero'],
    category: 'perfil',
    permission: 'all',
    args: '<hombre|mujer|otro>',
    groupOnly: false,
    description: 'Guarda el género de tu perfil.',
    example: '.setgenre mujer',
    run: (ctx) => perfil.setGenre(ctx, ctx.argList[0] ?? null),
  },
  {
    name: 'pfp',
    aliases: ['getpfp', 'foto', 'avatar', 'pp', 'getpp', 'fotoperfil'],
    category: 'perfil',
    permission: 'all',
    args: '[@usuario|número]',
    description: 'Muestra la foto de perfil de un usuario del grupo.',
    example: '.pfp @usuario',
    run: (ctx) => perfil.pfp(ctx, ctx.argList[0] ?? null),
  },
];

export default perfilCommands;
