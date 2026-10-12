/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · confirmaciones
 * ────────────────────────────────────────────────────────────────
 * WhatsApp ya no renderiza botones en cuentas normales, así que la
 * confirmación es por TEXTO y con expiración:
 *
 *   .unreg            → guarda la intención y pide `.confirmar`
 *   .confirmar        → ejecuta el handler registrado (una sola vez)
 *   .cancelar         → descarta
 *
 * Los handlers se registran desde los comandos y reciben el ctx
 * fresco + el payload guardado. Requisito de seguridad #8.
 */
import { confirmationsRepo } from '../db/index.js';

export const CONFIRM_TTL_MS = 60_000;

/** action → (ctx, payload) => resultado de servicio */
const handlers = new Map();

/** Registra el ejecutor de una acción confirmable. */
export function registerConfirmAction(action, handler) {
  if (typeof handler !== 'function') throw new TypeError(`handler inválido para "${action}"`);
  handlers.set(action, handler);
}

export const hasConfirmAction = (action) => handlers.has(action);
export const confirmActions = () => [...handlers.keys()];

/**
 * Pide confirmación: guarda la intención en la BD y devuelve la vista.
 * @returns {{ok:boolean, view?:string, data?:object, replaced?:boolean}}
 */
export function requestConfirmation({ ctx, action, payload = {}, description, ttlMs = CONFIRM_TTL_MS }) {
  if (!handlers.has(action)) {
    return { ok: false, view: 'sys.error', data: { command: action, message: 'Esta acción no admite confirmación.' } };
  }
  const created = confirmationsRepo.create({
    groupId: ctx.group.groupId,
    userJid: ctx.author.jid,
    action,
    payload,
    ttlMs,
  });
  return {
    ok: true,
    view: 'sys.confirm.ask',
    data: { action, description, ttl: Math.round(ttlMs / 1000), replaced: created.replaced > 0 },
  };
}

/** Ejecuta la confirmación pendiente del autor. */
export function runConfirmation(ctx) {
  const groupId = ctx.group?.groupId;
  if (!groupId) return { ok: false, view: 'sys.groupOnly', data: { command: 'confirmar' } };

  const pending = confirmationsRepo.getFor(groupId, ctx.author.jid);
  if (!pending) return { ok: false, view: 'sys.confirm.nothing', data: {} };

  const handler = handlers.get(pending.action);
  if (!handler) {
    confirmationsRepo.cancel(groupId, ctx.author.jid);
    return {
      ok: false,
      view: 'sys.error',
      data: { command: pending.action, message: 'La acción pendiente ya no existe en esta versión del bot.' },
    };
  }

  // se consume ANTES de ejecutar: imposible correrla dos veces
  confirmationsRepo.consume(groupId, ctx.author.jid);
  return handler(ctx, pending.payload ?? {});
}

/** Descarta la confirmación pendiente. */
export function cancelConfirmation(ctx) {
  const groupId = ctx.group?.groupId;
  if (!groupId) return { ok: false, view: 'sys.confirm.nothing', data: {} };
  const removed = confirmationsRepo.cancel(groupId, ctx.author.jid);
  if (!removed) return { ok: false, view: 'sys.confirm.nothing', data: {} };
  return { ok: true, view: 'sys.confirm.cancelled', data: {} };
}

/** ¿Tiene el usuario una confirmación pendiente? (para avisos contextuales) */
export function pendingConfirmation(ctx) {
  if (!ctx.group?.groupId) return null;
  return confirmationsRepo.getFor(ctx.group.groupId, ctx.author.jid);
}

export function purgeExpired() {
  return confirmationsRepo.purgeExpired();
}
