/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · permisos
 * ────────────────────────────────────────────────────────────────
 * Jerarquía única y explícita:
 *
 *   owner del bot  >  admin del grupo  >  registrado  >  miembro
 *
 * Todos los comandos declaran el permiso mínimo que necesitan y el
 * router lo comprueba ANTES de ejecutar nada (seguridad #1).
 * Además: un admin no puede moderar a otro admin ni al owner.
 */
import { env } from '../config/env.js';
import { normalizeJid, sameUser } from '../utils/ids.js';

export const RANK = Object.freeze({
  member: 0,
  registered: 1,
  admin: 2,
  owner: 3,
});

/** ¿Es el número uno de los dueños del bot definidos en `.env`? */
export function isBotOwner(jid) {
  if (!jid) return false;
  const target = normalizeJid(jid);
  return env.ownerNumbers.some((phone) => sameUser(target, `${phone}@s.whatsapp.net`));
}

/** Rango efectivo de un autor dentro de un grupo. */
export function rankOf(ctx) {
  if (isBotOwner(ctx.author?.jid)) return RANK.owner;
  if (ctx.author?.isAdmin) return RANK.admin;
  if (ctx.author?.isRegistered) return RANK.registered;
  return RANK.member;
}

export const RANK_LABEL = Object.freeze({
  [RANK.owner]: 'owner del bot',
  [RANK.admin]: 'admin del grupo',
  [RANK.registered]: 'integrante registrado',
  [RANK.member]: 'miembro',
});

/** Permiso mínimo requerido → rango numérico. */
const REQUIRED_RANK = Object.freeze({
  all: RANK.member,
  registered: RANK.registered,
  admin: RANK.admin,
  owner: RANK.owner,
});

/**
 * Comprueba si `ctx` satisface el permiso pedido.
 * @returns {{ok:boolean, required:string, reason?:string}}
 */
export function checkPermission(ctx, permission = 'all') {
  const required = REQUIRED_RANK[permission] ?? RANK.member;
  const rank = rankOf(ctx);
  if (rank >= required) return { ok: true, required: permission };
  return {
    ok: false,
    required: permission,
    reason: `Necesitas ser ${RANK_LABEL[required]} para usar este comando.`,
  };
}

/**
 * ¿Puede `actor` moderar (warn/kick/ban/resetrol) a `target`?
 * Reglas:
 *  · El owner del bot puede con todos.
 *  · Un admin puede con registrados y miembros, nunca con otro admin ni con el owner.
 *  · Nadie puede moderarse a sí mismo con ban/expulsar (evita accidentes).
 *  · El bot nunca se modera a sí mismo.
 */
export function canModerate(ctx, target) {
  const actorJid = normalizeJid(ctx.author?.jid);
  const targetJid = normalizeJid(target?.jid ?? target);

  if (!actorJid || !targetJid) return { ok: false, reason: 'No identifiqué al objetivo.' };
  if (ctx.bot?.jid && sameUser(targetJid, ctx.bot.jid)) {
    return { ok: false, reason: 'No puedo moderarme a mí mismo.' };
  }
  if (isBotOwner(actorJid)) return { ok: true };
  if (sameUser(actorJid, targetJid)) return { ok: false, reason: 'No puedes moderarte a ti mismo.' };
  if (isBotOwner(targetJid)) return { ok: false, reason: 'El owner del bot está fuera de tu alcance.' };
  if (target?.isAdmin) return { ok: false, reason: 'No puedes moderar a otro administrador.' };
  if (!ctx.author?.isAdmin) return { ok: false, reason: 'Solo los administradores pueden moderar.' };
  return { ok: true };
}

/** Comprobaciones previas a cualquier acción de grupo (kick/close/add…). */
export function requireBotAdmin(ctx, action = 'esta acción') {
  if (ctx.group?.botIsAdmin) return { ok: true };
  return {
    ok: false,
    reason: `No soy administrador del grupo, así que no puedo ejecutar ${action}.`,
    need: 'Pídeme admin y vuelve a intentarlo.',
  };
}

/** ¿El grupo permite escribir a todos? (para detectar `.open`/`.close`) */
export const isAnnouncement = (ctx) => Boolean(ctx.group?.locked);

export { normalizeJid };
