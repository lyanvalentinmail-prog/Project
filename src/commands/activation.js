/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · activación de sub-bots (comando `.key`)
 * ────────────────────────────────────────────────────────────────
 * Flujo real de activación:
 *   1 · El sub-bot se crea DESCONECTADO desde el panel.
 *   2 · Para activarlo hay que enviar `.key` desde WhatsApp
 *       (a este bot o a cualquier bot conectado de la plataforma).
 *   3 · El bot devuelve una clave de un solo uso (10 min) y, si el
 *       sub-bot está vinculándose, el PAIRING CODE REAL que WhatsApp
 *       acaba de emitir para ese número (`ABCD-1234`).
 *   4 · Esa clave se pega en el panel web → el bot queda activado.
 *
 * `.key` se acepta con cualquiera de los prefijos permitidos
 * (# - + . /), sea cual sea el prefijo configurado del sub-bot.
 * `.pairing` (alias `.codigo`, `.vincular`…) devuelve solo el código.
 */
import { activationKeysRepo, KEY_TTL_MS, instancesRepo } from '../db/index.js';
import { ok, fail } from '../services/result.js';
import { auditRepo } from '../db/index.js';
import { getActiveManager } from '../core/bot-manager.js';

/** Número (solo dígitos) del autor del mensaje, si se puede conocer. */
function authorPhone(ctx) {
  const raw = ctx?.author?.jid ? String(ctx.author.jid).split('@')[0].split(':')[0] : '';
  return /^\d{8,20}$/.test(raw) ? raw : null;
}

/** Busca el sub-bot en vinculación cuyo número coincide con quien escribe. */
function targetInstance(ctx) {
  const arg = ctx?.args ? String(ctx.args).trim() : '';
  const all = instancesRepo.all();
  if (arg) {
    const needle = arg.toLowerCase();
    return (
      all.find((row) => String(row.name).toLowerCase() === needle) ??
      all.find((row) => String(row.name).toLowerCase().includes(needle)) ??
      all.find((row) => String(row.phone).includes(arg.replace(/[^\d]/g, ''))) ??
      null
    );
  }
  const phone = authorPhone(ctx);
  if (phone) {
    const own = all.find((row) => String(row.phone) === phone);
    if (own) return own;
  }
  return ctx?.instance ?? null;
}

/** Códigos reales pendientes, priorizando el sub-bot objetivo. */
async function collectPairingCodes(ctx, { force = false } = {}) {
  const manager = getActiveManager();
  if (!manager) return [];
  const target = targetInstance(ctx);
  let codes = manager.pendingPairingCodes({ phone: authorPhone(ctx) });

  const needsCode =
    target &&
    !['open'].includes(String(manager.client(target.id)?.status ?? target.status)) &&
    (target.pairing_mode === 'pairing' || manager.client(target.id)?.pairingMode) &&
    manager.client(target.id);

  if (needsCode && (!codes.some((row) => row.id === target.id) || force)) {
    const fresh = await manager.ensurePairingCode(target.id, { force });
    if (fresh.ok) {
      codes = manager.pendingPairingCodes({ phone: authorPhone(ctx) });
    }
  }

  if (target) {
    codes = [...codes].sort((a, b) => Number(b.id === target.id) - Number(a.id === target.id));
  }
  return codes;
}

export const activationCommands = [
  {
    name: 'key',
    category: 'info',
    permission: 'all',
    groupOnly: false,
    hidden: false,
    description: 'Genera tu clave de activación y muestra el pairing code REAL de WhatsApp.',
    example: '.key',
    aliases: ['clave'],
    run: async (ctx) => {
      const created = activationKeysRepo.create({
        creatorJid: ctx.author?.jid ?? null,
        instanceId: ctx.instance?.id ?? null,
        ttlMs: KEY_TTL_MS,
      });
      if (!created) {
        return fail('sys.error', {
          command: 'key',
          message: 'No se pudo generar la clave en este momento. Inténtalo de nuevo en unos segundos.',
        });
      }

      // Pairing code REAL pedido a WhatsApp para el sub-bot que está vinculándose
      const codes = await collectPairingCodes(ctx).catch(() => []);

      auditRepo.log({
        instanceId: ctx.instance?.id ?? null,
        groupId: ctx.group?.groupId ?? null,
        actorJid: ctx.author?.jid ?? null,
        action: 'activation.key.issued',
        detail: { reused: created.reused, pairingCodes: codes.length },
      });

      return ok('sys.key', {
        key: created.formatted,
        expiresInMin: Math.round(KEY_TTL_MS / 60_000),
        instanceName: ctx.instance?.name ?? null,
        pairingCodes: codes,
        linking: (getActiveManager()?.linkingInstances?.() ?? []).slice(0, 3),
      });
    },
  },
  {
    name: 'pairing',
    category: 'info',
    permission: 'all',
    groupOnly: false,
    hidden: false,
    description: 'Devuelve el pairing code REAL de WhatsApp del sub-bot que estás vinculando.',
    example: '.pairing',
    aliases: ['codigo', 'código', 'pairingcode', 'vincular'],
    run: async (ctx) => {
      const codes = await collectPairingCodes(ctx, { force: false }).catch(() => []);
      auditRepo.log({
        instanceId: ctx.instance?.id ?? null,
        groupId: ctx.group?.groupId ?? null,
        actorJid: ctx.author?.jid ?? null,
        action: 'activation.pairing.requested',
        detail: { codes: codes.length },
      });
      if (!codes.length) {
        const linking = (getActiveManager()?.linkingInstances?.() ?? []).filter((row) => row.pairingMode);
        return fail('sys.pairing', { pairingCodes: [], linking, requestedBy: authorPhone(ctx) });
      }
      return ok('sys.pairing', { pairingCodes: codes, linking: [] });
    },
  },
];

export default activationCommands;
