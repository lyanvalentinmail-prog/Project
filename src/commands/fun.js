/**
 * 𓆩 🎲 𓆪  VÉRSOVA · comandos de azar y juegos rápidos
 * ────────────────────────────────────────────────────────────────
 * Dados, moneda, bola 8, decisiones, sorteos y encuestas nativas.
 * Funcionan en grupo y por privado (salvo el sorteo, que es del team).
 */
import * as fun from '../services/fun.service.js';

export const funCommands = [
  {
    name: 'dado',
    aliases: ['dados', 'dice', 'roll'],
    category: 'social',
    permission: 'all',
    groupOnly: false,
    args: '[caras|NdF]',
    description: 'Tira uno o varios dados. Acepta .dado, .dado 20 o .dado 3d6.',
    example: '.dado 3d6',
    run: (ctx) => fun.dado(ctx),
  },
  {
    name: 'moneda',
    aliases: ['coin', 'caraocruz', 'volado'],
    category: 'social',
    permission: 'all',
    groupOnly: false,
    description: 'Lanza una moneda al aire: cara o cruz.',
    example: '.moneda',
    run: (ctx) => fun.moneda(ctx),
  },
  {
    name: '8ball',
    aliases: ['bola8', 'bolamagica'],
    category: 'social',
    permission: 'all',
    groupOnly: false,
    args: '<pregunta>',
    description: 'La bola mágica responde tu pregunta de sí o no.',
    example: '.8ball ¿hoy es mi día de suerte?',
    notes: 'La misma pregunta recibe la misma respuesta durante el día.',
    run: (ctx) => fun.bola8(ctx),
  },
  {
    name: 'elegir',
    aliases: ['elige', 'choose', 'decide'],
    category: 'tools',
    permission: 'all',
    groupOnly: false,
    args: '<opción1 | opción2 | …>',
    description: 'Elige una opción al azar entre las que separes con |.',
    example: '.elegir pizza | sushi | tacos',
    run: (ctx) => fun.elegir(ctx),
  },
  {
    name: 'sorteo',
    aliases: ['sortear', 'rifa'],
    category: 'social',
    permission: 'all',
    args: '[@u1 @u2 …]',
    description: 'Sortea un ganador entre los registrados del grupo o entre los mencionados.',
    example: '.sorteo',
    notes: 'Con 2+ menciones, el sorteo es solo entre ellas.',
    run: (ctx) => fun.sorteo(ctx),
  },
  {
    name: 'encuesta',
    aliases: ['poll', 'votacion', 'votar'],
    category: 'social',
    permission: 'all',
    groupOnly: false,
    args: '<pregunta | op1 | op2 …>',
    description: 'Crea una encuesta nativa de WhatsApp con voto único (2 a 12 opciones).',
    example: '.encuesta ¿Rol esta noche? | Sí | No | Tal vez',
    run: (ctx) => fun.encuesta(ctx),
  },
  {
    name: 'invertir',
    aliases: ['reverse', 'alreves'],
    category: 'tools',
    permission: 'all',
    groupOnly: false,
    args: '<texto>',
    description: 'Devuelve tu texto escrito completamente al revés.',
    example: '.invertir hola team',
    run: (ctx) => fun.invertir(ctx),
  },
];

export default funCommands;
