/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · comandos de registro
 */
import * as registration from '../services/registration.service.js';

export const registroCommands = [
  {
    name: 'reg',
    category: 'registro',
    permission: 'all',
    args: '<nombre.edad>',
    description: 'Registra tu ficha en el team usando tu número como identificador.',
    example: '.reg Moon.17',
    notes: 'No puedes elegir personaje sin registrarte antes.',
    run: (ctx) => registration.register(ctx, ctx.args),
  },
  {
    name: 'unreg',
    category: 'registro',
    permission: 'registered',
    confirm: true,
    description: 'Elimina tu registro, libera tu personaje y cancela tus reservas.',
    example: '.unreg',
    notes: 'Pide confirmación: responde con .confirmar dentro de 60 segundos.',
    run: (ctx) => registration.unregisterAsk(ctx),
  },
  {
    name: 'editar',
    category: 'registro',
    permission: 'registered',
    args: '<nombre.edad>',
    description: 'Modifica tu nombre y tu edad. Tu personaje no se toca.',
    example: '.editar Luna.18',
    run: (ctx) => registration.editProfile(ctx, ctx.args),
  },
  {
    name: 'ficha',
    category: 'registro',
    permission: 'registered',
    description: 'Muestra tu información personal: nombre, edad, personaje, registro, estado y warns.',
    example: '.ficha',
    run: (ctx) => registration.card(ctx),
  },
];

export default registroCommands;
