/**
 * 𓆩 𖤐 𓆪  VÉRSOVA · comandos de gestión del team
 */
import * as team from '../services/team.service.js';
import * as registration from '../services/registration.service.js';
import { groupsRepo, usersRepo } from '../db/index.js';
import { fail, ok } from '../services/result.js';
import { checkPermission } from '../security/permissions.js';

export const teamCommands = [
  {
    name: 'team',
    category: 'team',
    permission: 'all',
    description: 'Información general del team: integrantes, registrados, personajes y admins.',
    example: '.team',
    run: (ctx) => team.teamInfo(ctx),
  },
  {
    name: 'miembros',
    category: 'team',
    permission: 'all',
    description: 'Lista de integrantes registrados con su personaje.',
    example: '.miembros',
    run: (ctx) => team.members(ctx),
  },
  {
    name: 'afk',
    category: 'team',
    permission: 'registered',
    args: '<motivo>',
    description: 'Activa tu estado AFK. Al escribir cualquier mensaje sales del AFK.',
    example: '.afk Estoy estudiando',
    run: (ctx) => team.setAfk(ctx, ctx.args),
  },
  {
    name: 'afks',
    category: 'team',
    permission: 'all',
    description: 'Lista quién está AFK ahora mismo y por qué.',
    example: '.afks',
    run: (ctx) => {
      const list = usersRepo.listAfk(ctx.group.groupId);
      if (!list.length) return fail('sys.invalid', { command: 'afks', message: 'Nadie está AFK en este momento.' });
      return ok('team.afk.list', { list, groupName: ctx.group.name, command: 'afks' });
    },
  },
  {
    name: 'inactivos',
    category: 'team',
    permission: 'registered',
    description: 'Muestra quién lleva tiempo sin escribir, ordenado de mayor a menor inactividad.',
    example: '.inactivos',
    notes: 'El umbral se configura con .config inactividad <días>.',
    run: (ctx) => team.inactives(ctx),
  },
  {
    name: 'config',
    category: 'team',
    permission: 'all',
    args: '[clave] [valor]',
    description: 'Consulta (todos) o ajusta (admins) la configuración del grupo.',
    example: '.config inactividad 10',
    notes: 'Claves: inactividad, reserva, warns, prefijo, bienvenida, despedida, afk, parejas.',
    run: (ctx) => {
      if (!ctx.argList.length) return team.showConfig(ctx);
      const allowed = checkPermission(ctx, 'admin');
      if (!allowed.ok) return fail('sys.noPermission', { required: 'admin', command: 'config' });
      const [key, ...rest] = ctx.argList;
      return team.setConfig(ctx, key, rest.join(' '));
    },
  },
  {
    name: 'auditoria',
    category: 'team',
    permission: 'admin',
    description: 'Últimos eventos administrativos del grupo.',
    example: '.auditoria',
    run: (ctx) => team.auditList(ctx),
  },
  {
    name: 'sync',
    category: 'team',
    permission: 'admin',
    description: 'Fuerza la sincronización de admins y miembros desde WhatsApp.',
    example: '.sync',
    run: async (ctx) => {
      const metadata = await ctx.client.groupMetadata(ctx.group.groupId).catch(() => null);
      if (!metadata) return fail('sys.error', { command: 'sync', message: 'WhatsApp no devolvió los datos del grupo.' });
      const participants = metadata.participants ?? [];
      groupsRepo.upsert({
        groupId: ctx.group.groupId,
        instanceId: ctx.instance.id,
        name: metadata.subject,
        waCreatedAt: metadata.creation ? Number(metadata.creation) * 1000 : null,
        size: participants.length,
      });
      groupsRepo.syncAdmins(ctx.group.groupId, participants.filter((p) => p.admin));
      groupsRepo.markSynced(ctx.group.groupId);
      for (const participant of participants) {
        registration.syncMemberReturned(ctx, participant.id ?? participant.jid);
      }
      return ok('team.config.updated', {
        key: 'Sincronización',
        value: `${participants.length} miembros · ${participants.filter((p) => p.admin).length} admins`,
        adminName: ctx.author.name,
        command: 'sync',
      });
    },
  },
];

export default teamCommands;
