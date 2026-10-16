/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · identidades LID ↔ número
 * ────────────────────────────────────────────────────────────────
 * WhatsApp está migrando a los LID («123456789012345@lid»): en muchos
 * grupos los mensajes, las menciones, la lista de participantes y los
 * eventos de entrada/salida llegan con el LID y no con el número.
 *
 * El bot guarda a cada persona por su NÚMERO (…@s.whatsapp.net) cuando
 * lo conoce —así coinciden el owner del .env, las fichas y los admins—
 * y por su LID solo si WhatsApp todavía no reveló el número.
 *
 * Este módulo NO importa nada del proyecto salvo utils/ids (cero ciclos).
 */
import { normalizeJid } from './ids.js';

export const isLidJid = (jid) => typeof jid === 'string' && /@lid$/i.test(jid.trim());
export const isPnJid = (jid) => typeof jid === 'string' && /@s\.whatsapp\.net$/i.test(jid.trim());

/** Memoria acotada de equivalencias LID ↔ número de un sub-bot. */
export class LidMap {
  constructor({ max = 5000 } = {}) {
    this.max = max;
    this.lidToPn = new Map();
    this.pnToLid = new Map();
  }

  get size() {
    return this.lidToPn.size;
  }

  /** Aprende una pareja (en cualquier orden). Devuelve true si era válida. */
  learn(a, b) {
    const ja = normalizeJid(a);
    const jb = normalizeJid(b);
    const lid = isLidJid(ja) ? ja : isLidJid(jb) ? jb : null;
    const pn = isPnJid(ja) ? ja : isPnJid(jb) ? jb : null;
    if (!lid || !pn) return false;
    if (this.lidToPn.get(lid) === pn) return true;
    // si el LID estaba asociado a otro número, se olvida la pareja vieja
    const oldPn = this.lidToPn.get(lid);
    if (oldPn) this.pnToLid.delete(oldPn);
    const oldLid = this.pnToLid.get(pn);
    if (oldLid) this.lidToPn.delete(oldLid);
    this.lidToPn.set(lid, pn);
    this.pnToLid.set(pn, lid);
    while (this.lidToPn.size > this.max) {
      const [firstLid, firstPn] = this.lidToPn.entries().next().value;
      this.lidToPn.delete(firstLid);
      if (this.pnToLid.get(firstPn) === firstLid) this.pnToLid.delete(firstPn);
    }
    return true;
  }

  /** Participante de grupo / contacto: { id, phoneNumber?, lid?, jid? }. */
  learnEntry(entry) {
    if (!entry || typeof entry !== 'object') return false;
    const id = entry.id ?? entry.jid;
    return this.learn(id, entry.phoneNumber) || this.learn(id, entry.lid);
  }

  /** Clave de mensaje: participant/participantAlt y remoteJid/remoteJidAlt. */
  learnKey(key) {
    if (!key) return;
    this.learn(key.participant, key.participantAlt);
    this.learn(key.remoteJid, key.remoteJidAlt);
  }

  /** Número equivalente (o el mismo jid si no se conoce). */
  toPn(jid) {
    const normalized = normalizeJid(jid);
    if (!normalized) return null;
    return isLidJid(normalized) ? this.lidToPn.get(normalized) ?? normalized : normalized;
  }

  /** LID equivalente (o null si no se conoce). */
  toLid(jid) {
    const normalized = normalizeJid(jid);
    if (!normalized) return null;
    return isLidJid(normalized) ? normalized : this.pnToLid.get(normalized) ?? null;
  }

  /** ¿Son la misma persona (por número, por LID o por la pareja conocida)? */
  same(a, b) {
    const pa = this.toPn(a);
    const pb = this.toPn(b);
    return Boolean(pa && pb && pa === pb);
  }
}

/**
 * Jid canónico de una entrada de participante (texto u objeto de Baileys 7):
 * el número si se conoce; si no, el LID.
 * @param {string|{id?:string,jid?:string,phoneNumber?:string,lid?:string}} entry
 * @param {{toPn?: (jid:string) => string|null}} [resolver] normalmente el BotClient
 */
export function participantJid(entry, resolver = null) {
  if (!entry) return null;
  if (typeof entry === 'string') return resolver?.toPn ? resolver.toPn(entry) : normalizeJid(entry);
  const id = normalizeJid(entry.id ?? entry.jid);
  if (isPnJid(id)) return id;
  const phone = normalizeJid(entry.phoneNumber);
  if (isPnJid(phone)) return phone;
  if (!id) return null;
  return resolver?.toPn ? resolver.toPn(id) : id;
}

/** Admins de un GroupMetadata con su jid canónico (para groupsRepo.syncAdmins). */
export function adminsFromMetadata(metadata, resolver = null) {
  const admins = [];
  for (const participant of metadata?.participants ?? []) {
    if (!participant?.admin) continue;
    const jid = participantJid(participant, resolver);
    if (jid) admins.push({ jid, admin: participant.admin });
  }
  return admins;
}

/**
 * ¿El bot es admin en el grupo? Compara contra el número y el LID del bot
 * (en los grupos con LID los participantes no traen el número).
 * @param {object} metadata GroupMetadata
 * @param {{isMe?: (jid:string) => boolean, jid?: string}} client
 */
export function botIsAdminIn(metadata, client) {
  const isMe = typeof client?.isMe === 'function'
    ? (jid) => client.isMe(jid)
    : (jid) => Boolean(jid) && normalizeJid(jid) === normalizeJid(client?.jid);
  return (metadata?.participants ?? []).some((participant) =>
    Boolean(participant?.admin) &&
    (isMe(participant.id ?? participant.jid) || isMe(participant.phoneNumber) || isMe(participant.lid)));
}
