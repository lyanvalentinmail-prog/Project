/**
 * 𓆩 ♡ 𓆪  VÉRSOVA · comandos de interacción
 */
import * as social from '../services/social.service.js';

export const socialCommands = [
  {
    name: 'perfil',
    category: 'social',
    permission: 'all',
    args: '[@usuario]',
    description: 'Muestra tu perfil o el de otro integrante (número enmascarado).',
    example: '.perfil @usuario',
    run: (ctx) => social.profile(ctx, ctx.args || null),
  },
  {
    name: 'pareja',
    category: 'social',
    permission: 'registered',
    args: '<@usuario>',
    description: 'Envía una propuesta de pareja. La otra persona debe aceptarla.',
    example: '.pareja @usuario',
    notes: 'Ambos deben estar registrados y ninguno puede tener pareja.',
    run: (ctx) => social.proposeCouple(ctx, ctx.args || null),
  },
  {
    name: 'aceptar',
    category: 'social',
    permission: 'registered',
    description: 'Acepta la propuesta de pareja que tienes pendiente.',
    example: '.aceptar',
    run: (ctx) => social.acceptCouple(ctx),
  },
  {
    name: 'rechazar',
    category: 'social',
    permission: 'registered',
    description: 'Rechaza la propuesta de pareja que tienes pendiente.',
    example: '.rechazar',
    run: (ctx) => social.rejectCouple(ctx),
  },
  {
    name: 'terminar',
    category: 'social',
    permission: 'registered',
    confirm: true,
    description: 'Termina tu relación actual y actualiza ambos perfiles.',
    example: '.terminar',
    notes: 'Pide confirmación con .confirmar.',
    run: (ctx) => social.breakCoupleAsk(ctx),
  },
  {
    name: 'ship',
    category: 'social',
    permission: 'all',
    args: '<@usuario> [@usuario2]',
    description: 'Calcula la compatibilidad entre dos personas. No modifica parejas.',
    example: '.ship @persona1 @persona2',
    notes: 'Con una sola mención, te shipea contigo.',
    run: (ctx) => social.ship(ctx),
  },
  {
    name: 'reglas',
    category: 'social',
    permission: 'all',
    description: 'Muestra las reglas del team.',
    example: '.reglas',
    run: (ctx) => social.rules(ctx),
  },
  {
    name: 'admins',
    category: 'social',
    permission: 'all',
    description: 'Muestra los administradores del grupo.',
    example: '.admins',
    run: (ctx) => social.admins(ctx),
  },
  {
    name: 'owner',
    category: 'info',
    permission: 'all',
    description: 'Muestra al owner del bot (número enmascarado).',
    example: '.owner',
    run: (ctx) => social.ownerCard(ctx),
  },
];

export default socialCommands;
