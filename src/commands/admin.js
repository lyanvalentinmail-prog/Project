/**
 * 𓆩 ⛓️ 𓆪  VÉRSOVA · comandos de administración
 * ────────────────────────────────────────────────────────────────
 * Todos pasan por el filtro de permisos del router ANTES de ejecutar.
 * Los destructivos (expulsar, ban) exigen confirmación por texto.
 */
import * as moderation from '../services/moderation.service.js';
import { resolveTarget, validateUserJid } from '../security/validation.js';
import { requireBotAdmin } from '../security/permissions.js';
import { fail, ok } from '../services/result.js';
import { auditRepo } from '../db/index.js';
import { maskPhone } from '../utils/ids.js';

/** Resuelve el objetivo de un comando de moderación o devuelve el error. */
function target(ctx, command, { allowQuoted = true } = {}) {
  const resolved = resolveTarget(ctx, { arg: ctx.argList[0] ?? null, allowQuoted });
  if (!resolved.ok) return { error: fail('mod.denied', { reason: resolved.reason, command }) };
  const jid = validateUserJid(resolved.value);
  if (!jid.ok) return { error: fail('mod.denied', { reason: jid.reason, command }) };
  return { jid: jid.value };
}

export const adminCommands = [
  {
    name: 'add',
    category: 'admin',
    permission: 'admin',
    args: '<@usuario | número>',
    description: 'Intenta añadir a alguien al grupo. No lo registra automáticamente.',
    example: '.add 5215512345678',
    notes: 'WhatsApp puede impedírselo según la privacidad del destino; el bot informa el motivo real.',
    run: async (ctx) => {
      const found = target(ctx, 'add', { allowQuoted: false });
      if (found.error) return found.error;

      const botAdmin = requireBotAdmin(ctx, 'añadir integrantes');
      if (!botAdmin.ok) return fail('mod.denied', { reason: botAdmin.reason, need: botAdmin.need, command: 'add' });

      let out;
      try {
        out = await ctx.client.groupParticipantsUpdate(ctx.group.groupId, [found.jid], 'add');
      } catch (error) {
        out = [{ status: error?.output?.statusCode ?? 'error', error: error?.message ?? String(error) }];
      }

      const status = out?.[0]?.status ?? 'error';
      const success = Number(status) === 200;
      let inviteLink = null;
      if (!success) {
        inviteLink = await ctx.client.groupInviteCode(ctx.group.groupId).catch(() => null);
        inviteLink = inviteLink ? `https://chat.whatsapp.com/${inviteLink}` : null;
      }

      auditRepo.log({
        instanceId: ctx.instance.id,
        groupId: ctx.group.groupId,
        actorJid: ctx.author.jid,
        action: 'mod.add',
        targetJid: found.jid,
        detail: { status: String(status), success },
      });

      return (success ? ok : fail)('mod.addResult', {
        targetName: maskPhone(found.jid),
        ok: success,
        detail: success
          ? 'Ya está en el grupo. Recuérdale registrarse con .reg <nombre.edad>'
          : `${moderation.explainAddStatus(status)}${out?.[0]?.error ? ` (${out[0].error})` : ''}`,
        inviteLink,
        command: 'add',
      });
    },
  },
  {
    name: 'expulsar',
    category: 'admin',
    permission: 'admin',
    args: '<@usuario> [motivo]',
    confirm: true,
    description: 'Expulsa a un integrante del grupo tras confirmar.',
    example: '.expulsar @usuario Spam en el rol',
    run: (ctx) => moderation.kickAsk(ctx, ctx.argList[0] ?? null, ctx.argList.slice(1).join(' ') || null),
  },
  {
    name: 'ban',
    category: 'admin',
    permission: 'admin',
    args: '<@usuario> [motivo]',
    confirm: true,
    description: 'Expulsa y añade a la lista negra. Si vuelve a entrar, se le expulsa otra vez.',
    example: '.ban @usuario Raid',
    run: (ctx) => moderation.banAsk(ctx, ctx.argList[0] ?? null, ctx.argList.slice(1).join(' ') || null),
  },
  {
    name: 'unban',
    category: 'admin',
    permission: 'admin',
    args: '<@usuario | número>',
    description: 'Saca a alguien de la lista de bloqueados.',
    example: '.unban 5215512345678',
    run: (ctx) => moderation.unban(ctx, ctx.argList[0] ?? null),
  },
  {
    name: 'bloqueados',
    category: 'admin',
    permission: 'admin',
    description: 'Muestra la lista negra del grupo.',
    example: '.bloqueados',
    run: (ctx) => moderation.blockedList(ctx),
  },
  {
    name: 'warn',
    category: 'admin',
    permission: 'admin',
    args: '<@usuario> <motivo>',
    description: 'Añade una advertencia. Con 3 (configurable) se expulsa automáticamente.',
    example: '.warn @usuario Spam',
    run: (ctx) => moderation.warn(ctx, ctx.argList[0] ?? null, ctx.argList.slice(1).join(' ') || null),
  },
  {
    name: 'unwarn',
    category: 'admin',
    permission: 'admin',
    args: '<@usuario>',
    description: 'Retira la advertencia más reciente de un integrante.',
    example: '.unwarn @usuario',
    run: (ctx) => moderation.unwarn(ctx, ctx.argList[0] ?? null),
  },
  {
    name: 'warns',
    category: 'admin',
    permission: 'admin',
    args: '<@usuario>',
    description: 'Historial de advertencias de un integrante.',
    example: '.warns @usuario',
    run: (ctx) => moderation.warnHistory(ctx, ctx.argList[0] ?? null),
  },
  {
    name: 'anuncio',
    category: 'admin',
    permission: 'admin',
    args: '<mensaje>',
    description: 'Publica un anuncio con formato decorado. Usa "@todos" al inicio para mencionar.',
    example: '.anuncio @todos Hoy hay evento de rol a las 21:00',
    run: (ctx) => moderation.announce(ctx, ctx.args),
  },
  {
    name: 'close',
    category: 'admin',
    permission: 'admin',
    description: 'Cierra el grupo: solo los administradores pueden escribir.',
    example: '.close',
    run: (ctx) => moderation.closeGroup(ctx),
  },
  {
    name: 'open',
    category: 'admin',
    permission: 'admin',
    description: 'Abre el grupo: todos pueden escribir de nuevo.',
    example: '.open',
    run: (ctx) => moderation.openGroup(ctx),
  },
  {
    name: 'invite',
    category: 'admin',
    permission: 'admin',
    description: 'Genera el enlace de invitación del grupo (la vía fiable para añadir gente).',
    example: '.invite',
    run: (ctx) => moderation.inviteLink(ctx),
  },
];

export default adminCommands;
