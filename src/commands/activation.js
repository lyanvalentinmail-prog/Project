/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · activación de sub-bots (comando `.key`)
 * ────────────────────────────────────────────────────────────────
 * Flujo real de activación:
 *   1 · El sub-bot se crea DESCONECTADO desde el panel.
 *   2 · Para activarlo hay que enviar `.key` desde WhatsApp
 *       (a este bot o a cualquier bot conectado de la plataforma).
 *   3 · El bot devuelve una clave de un solo uso (10 min).
 *   4 · Esa clave se pega en el panel web → el bot queda activado.
 *
 * `.key` se acepta con cualquiera de los prefijos permitidos
 * (# - + . /), sea cual sea el prefijo configurado del sub-bot.
 */
import { activationKeysRepo, KEY_TTL_MS, instancesRepo } from '../db/index.js';
import { ok } from '../services/result.js';
import { auditRepo } from '../db/index.js';

export const activationCommands = [
  {
    name: 'key',
    category: 'info',
    permission: 'all',
    groupOnly: false,
    hidden: false,
    description: 'Genera tu clave de activación para conectar el bot desde el panel web.',
    example: '.key',
    aliases: ['clave'],
    run: (ctx) => {
      const created = activationKeysRepo.create({
        creatorJid: ctx.author?.jid ?? null,
        instanceId: ctx.instance?.id ?? null,
        ttlMs: KEY_TTL_MS,
      });
      if (!created) {
        return ok('sys.error', {
          command: 'key',
          message: 'No se pudo generar la clave en este momento. Inténtalo de nuevo en unos segundos.',
        });
      }
      auditRepo.log({
        instanceId: ctx.instance?.id ?? null,
        groupId: ctx.group?.groupId ?? null,
        actorJid: ctx.author?.jid ?? null,
        action: 'activation.key.issued',
        detail: { reused: created.reused },
      });
      return ok('sys.key', {
        key: created.formatted,
        expiresInMin: Math.round(KEY_TTL_MS / 60_000),
        instanceName: ctx.instance?.name ?? null,
      });
    },
  },
];

export default activationCommands;
