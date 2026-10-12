/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · comandos de información y confirmaciones
 */
import { IDENTITY } from '../config/identity.js';
import { env } from '../config/env.js';
import { groupsRepo, usersRepo, rolesRepo, instancesRepo } from '../db/index.js';
import { ok, fail } from '../services/result.js';
import { runConfirmation, cancelConfirmation } from '../security/confirm.js';
import { mainMenu, sectionHelp, commandHelp, availableSections } from '../design/menu.js';
import { globalRoleStats } from '../services/roles.service.js';

/** Busca un comando por nombre o alias dentro del registro (se inyecta). */
let registryRef = null;
export const setRegistry = (registry) => {
  registryRef = registry;
};

export const infoCommands = [
  {
    name: 'menu',
    category: 'info',
    permission: 'all',
    description: 'Muestra el menú oficial de comandos de VÉRSOVA.',
    example: '.menu',
    groupOnly: false,
    run: () =>
      ok('menu.main', {
        status: 'ᴏɴʟɪɴᴇ',
        prefix: IDENTITY.prefix,
        name: IDENTITY.name,
        team: IDENTITY.team,
        version: IDENTITY.version,
      }),
  },
  {
    name: 'help',
    category: 'info',
    permission: 'all',
    args: '[sección | comando]',
    description: 'Ayuda detallada por sección o por comando.',
    example: '.help roles',
    groupOnly: false,
    run: (ctx) => {
      const registry = registryRef;
      const all = registry ? registry.list : [];
      const query = (ctx.argList[0] ?? '').toLowerCase();
      if (!query) return ok('menu.sections', { commands: all });

      const command = registry?.get(query);
      if (command) return ok('menu.command', { ...command });

      const section = all.find((c) => c.category === query)?.category;
      if (section) return ok('menu.section', { section, commands: all });

      return ok('menu.sections', { commands: all });
    },
  },
  {
    name: 'ping',
    category: 'info',
    permission: 'all',
    description: 'Latencia del bot y resumen de actividad.',
    example: '.ping',
    groupOnly: false,
    run: (ctx) => {
      const groups = groupsRepo.all().length;
      let users = 0;
      let rolesTaken = 0;
      for (const group of groupsRepo.all()) {
        users += usersRepo.counts(group.group_id).active;
      }
      rolesTaken = globalRoleStats().taken;
      return ok('sys.ping', {
        ms: Math.max(1, Date.now() - (ctx.raw?.messageTimestamp ? Number(ctx.raw.messageTimestamp) * 1000 : Date.now())),
        uptime: process.uptime() * 1000,
        groups,
        users,
        roles: rolesTaken,
        command: 'ping',
      });
    },
  },
  {
    name: 'botinfo',
    category: 'info',
    permission: 'all',
    description: 'Información técnica del bot: versión, grupos, fichas y sub-bots activos.',
    example: '.botinfo',
    groupOnly: false,
    run: () => {
      const groups = groupsRepo.all();
      let users = 0;
      for (const group of groups) users += usersRepo.counts(group.group_id).active;
      const stats = globalRoleStats();
      return ok('sys.botInfo', {
        name: IDENTITY.name,
        team: IDENTITY.team,
        version: IDENTITY.version,
        prefix: IDENTITY.prefix,
        groups: groups.length,
        users,
        roles: stats.taken,
        instances: instancesRepo.count(),
        uptime: process.uptime() * 1000,
        owner: env.ownerNumbers[0] ?? null,
        command: 'botinfo',
      });
    },
  },
  {
    name: 'confirmar',
    category: 'info',
    permission: 'all',
    hidden: true,
    description: 'Confirma la acción pendiente (.unreg, .liberar, .expulsar, .ban, .terminar).',
    example: '.confirmar',
    run: (ctx) => runConfirmation(ctx),
  },
  {
    name: 'cancelar',
    category: 'info',
    permission: 'all',
    hidden: true,
    description: 'Cancela la acción pendiente.',
    example: '.cancelar',
    run: (ctx) => cancelConfirmation(ctx),
  },
];

export default infoCommands;
export { availableSections, sectionHelp, commandHelp, mainMenu };
