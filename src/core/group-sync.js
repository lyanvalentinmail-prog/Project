/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · sincronización de grupos
 * ────────────────────────────────────────────────────────────────
 * Garantiza que el grupo exista en la base de datos y que la lista
 * de administradores sea un espejo fiel de WhatsApp. Se refresca
 * como mucho cada SYNC_TTL_MS para no martillear la API.
 */
import { groupsRepo, auditRepo } from '../db/index.js';
import { normalizeJid, isGroupJid } from '../utils/ids.js';
import { adminsFromMetadata, botIsAdminIn } from '../utils/lid.js';

const SYNC_TTL_MS = 5 * 60_000;
const metadataCache = new Map(); // groupJid → { at, botIsAdmin, size, subject }

/**
 * @param {object} params
 * @param {object} params.client adaptador de WhatsApp
 * @param {string} params.instanceId
 * @param {string} params.groupJid
 * @param {boolean} [params.force] fuerza la resincronización
 * @returns {Promise<{group: object, botIsAdmin: boolean, size: number, fresh: boolean}>}
 */
export async function ensureGroup({ client, instanceId, groupJid, force = false }) {
  const jid = normalizeJid(groupJid);
  if (!isGroupJid(jid)) throw new Error(`No es un grupo: ${groupJid}`);

  const botJid = normalizeJid(client.jid);
  const isBot = (candidate) => (typeof client.isMe === 'function' ? client.isMe(candidate) : normalizeJid(candidate) === botJid);
  const cached = metadataCache.get(jid);
  const cacheValid = cached && !force && Date.now() - cached.at < SYNC_TTL_MS;

  let row = groupsRepo.get(jid);

  if (!cacheValid || !row) {
    const metadata = await client.groupMetadata(jid).catch((error) => {
      if (!row) throw error;
      return null; // con la fila existente podemos seguir aunque WA falle
    });

    if (metadata) {
      const participants = metadata.participants ?? [];
      row = groupsRepo.upsert({
        groupId: jid,
        instanceId,
        name: metadata.subject ?? row?.name ?? '',
        waCreatedAt: metadata.creation ? Number(metadata.creation) * 1000 : row?.wa_created_at ?? null,
        size: participants.length,
      });
      // admins por su número cuando se conoce (en grupos con LID llegan como @lid)
      groupsRepo.syncAdmins(jid, adminsFromMetadata(metadata, client));
      groupsRepo.markSynced(jid);

      metadataCache.set(jid, {
        at: Date.now(),
        size: participants.length,
        subject: metadata.subject,
        botIsAdmin: botIsAdminIn(metadata, client),
      });
      if (!cached) {
        auditRepo.log({
          instanceId,
          groupId: jid,
          action: 'group.sync',
          detail: { subject: metadata.subject, participants: participants.length },
        });
      }
    }
  }

  const fromCache = metadataCache.get(jid);
  const botIsAdmin = row
    ? groupsRepo.listAdmins(jid).some((a) => isBot(a.user_jid)) || Boolean(fromCache?.botIsAdmin)
    : false;

  return {
    group: row ?? {
      group_id: jid,
      name: fromCache?.subject ?? '',
      size: fromCache?.size ?? 0,
      config: {},
      locked: false,
      welcome: true,
      farewell: true,
    },
    botIsAdmin,
    size: row?.size ?? fromCache?.size ?? 0,
    fresh: !cacheValid,
  };
}

/** Invalida la caché de un grupo (tras close/open, cambios de admins…). */
export function invalidateGroupCache(groupJid) {
  metadataCache.delete(normalizeJid(groupJid));
}

export function clearGroupCache() {
  metadataCache.clear();
}
