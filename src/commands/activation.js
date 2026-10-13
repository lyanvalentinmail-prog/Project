/**
 * Códigos reales de vinculación de WhatsApp (consulta opcional).
 * El panel los obtiene directamente; no hay activación por clave.
 * `.key` se conserva como alias de `.pairing` por compatibilidad.
 */
import { instancesRepo } from '../db/index.js';
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
    name: 'pairing',
    category: 'info',
    permission: 'all',
    groupOnly: false,
    hidden: false,
    description: 'Devuelve el pairing code REAL de WhatsApp del sub-bot que estás vinculando.',
    example: '.pairing',
    aliases: ['key', 'clave', 'codigo', 'código', 'pairingcode', 'vincular'],
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
