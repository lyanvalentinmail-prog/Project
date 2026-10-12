/**
 * 𓆩 🥢 𓆪  VÉRSOVA · comandos de personajes (roles)
 */
import * as roles from '../services/roles.service.js';
import { resolveTarget } from '../security/validation.js';
import { fail } from '../services/result.js';

export const rolesCommands = [
  {
    name: 'rol',
    category: 'roles',
    permission: 'registered',
    args: '<personaje>',
    description: 'Solicita un personaje. Un admin debe aprobarlo.',
    example: '.rol Felix',
    notes: 'Un personaje no puede pertenecer a dos personas a la vez.',
    run: (ctx) => roles.requestRole(ctx, ctx.args, { type: 'role' }),
  },
  {
    name: 'cambiarol',
    category: 'roles',
    permission: 'registered',
    args: '<personaje>',
    description: 'Pide cambiar tu personaje actual por otro. Requiere aprobación.',
    example: '.cambiarol Nagi',
    notes: 'Si se rechaza, conservas tu personaje anterior.',
    run: (ctx) => roles.requestRole(ctx, ctx.args, { type: 'role_change' }),
  },
  {
    name: 'roles',
    category: 'roles',
    permission: 'all',
    description: 'Muestra los personajes ocupados y quién los interpreta.',
    example: '.roles',
    run: (ctx) => roles.listRoles(ctx),
  },
  {
    name: 'mirol',
    category: 'roles',
    permission: 'registered',
    description: 'Muestra tu personaje actual y tus reservas activas.',
    example: '.mirol',
    run: (ctx) => roles.myRole(ctx),
  },
  {
    name: 'reservar',
    category: 'roles',
    permission: 'registered',
    args: '<personaje>',
    description: 'Reserva un personaje libre durante 24 horas (configurable).',
    example: '.reservar Bachira',
    notes: 'No se puede reservar un personaje ocupado ni tener dos reservas.',
    run: (ctx) => roles.reserve(ctx, ctx.args),
  },
  {
    name: 'reservas',
    category: 'roles',
    permission: 'all',
    description: 'Lista las reservas activas del grupo con su tiempo restante.',
    example: '.reservas',
    run: (ctx) => roles.listReservations(ctx),
  },
  {
    name: 'liberarreserva',
    category: 'roles',
    permission: 'registered',
    description: 'Cancela tu reserva activa antes de que venza.',
    example: '.liberarreserva',
    run: (ctx) => roles.cancelReservation(ctx),
  },
  {
    name: 'liberar',
    category: 'roles',
    permission: 'registered',
    confirm: true,
    description: 'Libera tu propio personaje y lo deja disponible para el team.',
    example: '.liberar',
    notes: 'Pide confirmación con .confirmar.',
    run: (ctx) => roles.releaseAsk(ctx),
  },
  {
    name: 'cancelarsolicitud',
    category: 'roles',
    permission: 'registered',
    description: 'Retira tu solicitud de personaje pendiente.',
    example: '.cancelarsolicitud',
    run: (ctx) => roles.cancelOwnRequest(ctx),
  },
  {
    name: 'pendientes',
    category: 'roles',
    permission: 'admin',
    description: 'Lista todas las solicitudes pendientes del grupo.',
    example: '.pendientes',
    run: (ctx) => roles.pendingRequests(ctx),
  },
  {
    name: 'acceptrol',
    category: 'admin',
    permission: 'admin',
    args: '[#id | personaje]',
    description: 'Aprueba una solicitud de personaje (responde al aviso o indica el folio).',
    example: '.acceptrol #12',
    notes: 'También funciona respondiendo al mensaje del aviso de solicitud.',
    run: (ctx) => roles.resolveRequest(ctx, { arg: ctx.args, decision: 'approve', command: 'acceptrol' }),
  },
  {
    name: 'denyrol',
    category: 'admin',
    permission: 'admin',
    args: '[#id | personaje] [motivo]',
    description: 'Rechaza una solicitud de personaje. No modifica el personaje anterior.',
    example: '.denyrol #12 Ese personaje es para otro team',
    run: (ctx) => {
      const [head, ...rest] = ctx.argList;
      const isId = /^#?\d+$/.test(head ?? '');
      const arg = isId ? head : null;
      const reason = isId ? rest.join(' ') : ctx.args;
      return roles.resolveRequest(ctx, { arg, decision: 'deny', reason, command: 'denyrol' });
    },
  },
  {
    name: 'resetrol',
    category: 'admin',
    permission: 'admin',
    args: '<@usuario>',
    description: 'Libera el personaje de otro integrante sin borrar su registro.',
    example: '.resetrol @usuario',
    run: (ctx) => {
      const resolved = resolveTarget(ctx, { allowQuoted: true });
      if (!resolved.ok) return fail('mod.denied', { reason: resolved.reason, command: 'resetrol' });
      return roles.resetRole(ctx, resolved.value);
    },
  },
];

export default rolesCommands;
