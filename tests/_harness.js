/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · arnés de pruebas
 * ────────────────────────────────────────────────────────────────
 * Reutiliza el mismo adaptador de juguete que el simulador, así los
 * tests recorren el camino REAL: mensaje → contexto → router →
 * permisos → servicio → base de datos → plantilla → envío.
 *
 * La base de datos es en memoria: cada archivo de tests corre en su
 * propio proceso (node --test) y no toca datos reales.
 */
import { createSimulation } from '../tools/simulator.js';
import {
  usersRepo,
  rolesRepo,
  requestsRepo,
  groupsRepo,
  warningsRepo,
  confirmationsRepo,
  auditRepo,
  instancesRepo,
} from '../src/db/index.js';

export const sim = await createSimulation();
export const GROUP = sim.groupJid;

let counter = 5_215_500_100_000;
/** Teléfonos únicos para que los tests no colisionen entre sí. */
export const nextPhone = () => String(counter++);

/** Crea un participante del grupo (sin registrar). */
export function person(name, { admin = null } = {}) {
  const phone = nextPhone();
  const jid = sim.addPerson(phone, { name, admin });
  return { jid, phone, name, admin: Boolean(admin) };
}

/** Envía un mensaje como si viniera de WhatsApp y devuelve las respuestas. */
export async function say(jid, text, options = []) {
  const opts = Array.isArray(options) ? { mentions: options } : options ?? {};
  const replies = await sim.say(jid, text, opts);
  return {
    replies,
    all: replies.join('\n'),
    last: replies[replies.length - 1] ?? '',
    first: replies[0] ?? '',
    count: replies.length,
  };
}

/** Cita un mensaje real del bot (para `.acceptrol` respondiendo al aviso). */
export const quoting = (messageId, remoteJid = GROUP) => ({ quoted: { key: { id: messageId, remoteJid } } });

/** Registra a alguien con `.reg` y devuelve su ficha. */
export async function registerPerson(name, { age = 18, admin = null } = {}) {
  const who = person(name, { admin });
  await say(who.jid, `.reg ${name}.${age}`);
  return who;
}

/** Registra, pide un personaje y lo hace aprobar por un admin. */
export async function registerWithRole(name, roleName, admin) {
  const who = await registerPerson(name);
  await say(who.jid, `.rol ${roleName}`);
  const pending = requestsRepo.listPending(GROUP, 'role').find((r) => r.user_jid === who.jid);
  await say(admin.jid, `.acceptrol #${pending.id}`);
  return who;
}

/**
 * Normaliza el texto decorado a ASCII legible: los títulos del bot usan
 * caracteres matemáticos de Unicode (𝑅𝑒𝑔𝑖𝑠𝑡𝑟𝑜) y NFKD los descompone a
 * su letra base, lo que permite afirmar sobre el contenido sin pelearse
 * con la estética.
 */
export const plain = (text) =>
  String(text ?? '')
    .normalize('NFKD')
    // separadores invisibles del diseño (hangul filler, braille vacío, ZWSP…)
    .replace(/[\u3164\u1160\uFFA0\u2800\u2000-\u200F\u2060\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** ¿La respuesta contiene este texto? (insensible a mayúsculas y adornos) */
export function includes(reply, text) {
  return plain(reply.all).toLowerCase().includes(plain(text).toLowerCase());
}

/** Última solicitud pendiente de un usuario. */
export const pendingOf = (jid, type = null) => requestsRepo.pendingForUser(GROUP, jid, type);

export { usersRepo, rolesRepo, requestsRepo, groupsRepo, warningsRepo, confirmationsRepo, auditRepo, instancesRepo };
