/**
 * 𓆩 🥢 𓆪  VÉRSOVA · comandos de estado e identidad (paquete Raiden)
 * ────────────────────────────────────────────────────────────────
 * `.status` muestra los recursos del bot; `.id` muestra tu
 * identidad de WhatsApp. Nombres y alias exactos de Raiden-WaBot.
 */
import os from 'node:os';
import { IDENTITY } from '../config/identity.js';
import { groupsRepo, usersRepo } from '../db/index.js';
import { ok } from '../services/result.js';
import { maskPhone } from '../utils/ids.js';
import { formatDuration } from '../utils/time.js';
import { authorIsBotOwner } from '../services/moderation.service.js';

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log10(value) / 3));
  const scaled = value / 1000 ** index;
  return `${scaled >= 100 ? Math.round(scaled) : scaled.toFixed(1)} ${units[index]}`;
}

export const sysCommands = [
  {
    name: 'status',
    aliases: ['botstatus', 'estado'],
    category: 'info',
    permission: 'all',
    groupOnly: false,
    description: 'Muestra el estado del bot: memoria, CPU, grupos, fichas y tiempo activo.',
    example: '.status',
    run: () => {
      const memory = process.memoryUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const groupRows = groupsRepo.all();
      let users = 0;
      for (const group of groupRows) users += usersRepo.counts(group.group_id).active;
      return ok('sys.status', {
        botName: IDENTITY.name,
        team: IDENTITY.team,
        version: IDENTITY.version,
        uptime: formatDuration(process.uptime() * 1000),
        heapUsed: formatBytes(memory.heapUsed),
        heapTotal: formatBytes(memory.heapTotal),
        rss: formatBytes(memory.rss),
        memUsed: formatBytes(usedMem),
        memTotal: formatBytes(totalMem),
        memPercent: totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0,
        cpuCores: os.cpus()?.length ?? 1,
        load: String(os.loadavg()?.[0]?.toFixed(2) ?? '0.00'),
        pid: process.pid,
        platform: `${os.type()} ${os.release()}`,
        node: process.version,
        groups: groupRows.length,
        users,
        command: 'status',
      });
    },
  },
  {
    name: 'id',
    aliases: ['user', 'me', 'miid', 'myid', 'quien-soy'],
    category: 'info',
    permission: 'all',
    groupOnly: false,
    description: 'Muestra tu identidad de WhatsApp: nombre, JID, contacto y rangos.',
    example: '.id',
    run: (ctx) => {
      const jid = ctx.author?.jid ?? '';
      const groupId = ctx.group?.groupId ?? null;
      return ok('sys.userid', {
        pushName: ctx.author?.name ?? '—',
        jid,
        masked: maskPhone(jid),
        isOwner: authorIsBotOwner(ctx),
        isAdmin: groupId ? groupsRepo.isAdmin(groupId, ctx.author.jid) : false,
        isRegistered: Boolean(ctx.author?.user),
        rankLabel: ctx.author?.user?.role_name ?? (ctx.author?.user ? 'miembro' : 'sin ficha'),
        command: 'id',
      });
    },
  },
];

export default sysCommands;
