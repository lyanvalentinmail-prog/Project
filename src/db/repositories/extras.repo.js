/**
 * 𓆩 💐 𓆪  VÉRSOVA · repositorios extra (paquete Raiden)
 * ────────────────────────────────────────────────────────────────
 * Muteos, metadatos de stickers, matrimonios y campos extra de perfil.
 */
import { getDb } from '../connection.js';
import { normalizeJid } from '../../utils/ids.js';

const now = () => Date.now();

/* ── muteos ─────────────────────────────────────────────────── */

export const mutedRepo = {
  mute(groupId, userJid, { reason = '', mutedBy = null } = {}) {
    getDb()
      .prepare(`INSERT INTO group_muted (group_id, user_jid, reason, muted_by, muted_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(group_id, user_jid) DO UPDATE SET
                  reason = excluded.reason, muted_by = excluded.muted_by, muted_at = excluded.muted_at`)
      .run(normalizeJid(groupId), normalizeJid(userJid), String(reason).slice(0, 200), mutedBy, now());
  },

  unmute(groupId, userJid) {
    return getDb()
      .prepare('DELETE FROM group_muted WHERE group_id = ? AND user_jid = ?')
      .run(normalizeJid(groupId), normalizeJid(userJid)).changes;
  },

  isMuted(groupId, userJid) {
    if (!groupId || !userJid) return false;
    return Boolean(
      getDb()
        .prepare('SELECT 1 AS ok FROM group_muted WHERE group_id = ? AND user_jid = ?')
        .get(normalizeJid(groupId), normalizeJid(userJid))
    );
  },

  list(groupId) {
    return getDb()
      .prepare('SELECT * FROM group_muted WHERE group_id = ? ORDER BY muted_at DESC')
      .all(normalizeJid(groupId));
  },

  count(groupId) {
    return Number(
      getDb().prepare('SELECT COUNT(*) AS n FROM group_muted WHERE group_id = ?').get(normalizeJid(groupId)).n
    );
  },
};

/* ── metadatos de stickers ──────────────────────────────────── */

export const stickerMetaRepo = {
  get(groupId, jid) {
    return getDb()
      .prepare('SELECT * FROM sticker_meta WHERE group_id = ? AND jid = ?')
      .get(normalizeJid(groupId), normalizeJid(jid)) ?? null;
  },

  set(groupId, jid, { pack = '', author = '' } = {}) {
    getDb()
      .prepare(`INSERT INTO sticker_meta (group_id, jid, pack, author, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(group_id, jid) DO UPDATE SET
                  pack = excluded.pack, author = excluded.author, updated_at = excluded.updated_at`)
      .run(normalizeJid(groupId), normalizeJid(jid), String(pack).slice(0, 60), String(author).slice(0, 60), now());
    return this.get(groupId, jid);
  },

  clear(groupId, jid) {
    return getDb()
      .prepare('DELETE FROM sticker_meta WHERE group_id = ? AND jid = ?')
      .run(normalizeJid(groupId), normalizeJid(jid)).changes;
  },
};

/* ── matrimonios ────────────────────────────────────────────── */

function pairKey(a, b) {
  const [x, y] = [normalizeJid(a), normalizeJid(b)].sort();
  return { x, y };
}

export const marriageRepo = {
  /** Matrimonio vigente de un usuario (o null). */
  currentOf(groupId, jid) {
    const ujid = normalizeJid(jid);
    return getDb()
      .prepare(`SELECT * FROM marriages WHERE group_id = ? AND divorced_at IS NULL
                AND (a_jid = ? OR b_jid = ?) ORDER BY married_at DESC LIMIT 1`)
      .get(normalizeJid(groupId), ujid, ujid) ?? null;
  },

  currentBetween(groupId, aJid, bJid) {
    const { x, y } = pairKey(aJid, bJid);
    return getDb()
      .prepare(`SELECT * FROM marriages WHERE group_id = ? AND divorced_at IS NULL
                AND ((a_jid = ? AND b_jid = ?) OR (a_jid = ? AND b_jid = ?)) LIMIT 1`)
      .get(normalizeJid(groupId), x, y, y, x) ?? null;
  },

  marry(groupId, aJid, bJid) {
    const { x, y } = pairKey(aJid, bJid);
    const result = getDb()
      .prepare('INSERT INTO marriages (group_id, a_jid, b_jid, married_at) VALUES (?, ?, ?, ?)')
      .run(normalizeJid(groupId), x, y, now());
    return getDb().prepare('SELECT * FROM marriages WHERE id = ?').get(Number(result.lastInsertRowid));
  },

  divorce(groupId, aJid, bJid) {
    const { x, y } = pairKey(aJid, bJid);
    return getDb()
      .prepare(`UPDATE marriages SET divorced_at = ? WHERE group_id = ? AND divorced_at IS NULL
                AND ((a_jid = ? AND b_jid = ?) OR (a_jid = ? AND b_jid = ?))`)
      .run(now(), normalizeJid(groupId), x, y, y, x).changes;
  },

  /** Historial matrimonial de un usuario (vigentes + pasados). */
  historyOf(groupId, jid, limit = 10) {
    const ujid = normalizeJid(jid);
    return getDb()
      .prepare(`SELECT * FROM marriages WHERE group_id = ? AND (a_jid = ? OR b_jid = ?)
                ORDER BY married_at DESC LIMIT ?`)
      .all(normalizeJid(groupId), ujid, ujid, Math.max(1, Math.min(25, Number(limit) || 10)));
  },

  countActive(groupId) {
    return Number(
      getDb()
        .prepare('SELECT COUNT(*) AS n FROM marriages WHERE group_id = ? AND divorced_at IS NULL')
        .get(normalizeJid(groupId)).n
    );
  },
};

/* ── campos extra de perfil (birth / desc / genre en users) ─── */

export const profileExtrasRepo = {
  get(groupId, jid) {
    const row = getDb()
      .prepare('SELECT profile_birth, profile_desc, profile_genre FROM users WHERE group_id = ? AND jid = ?')
      .get(normalizeJid(groupId), normalizeJid(jid));
    if (!row) return null;
    return { birth: row.profile_birth ?? '', desc: row.profile_desc ?? '', genre: row.profile_genre ?? '' };
  },

  set(groupId, jid, { birth, desc, genre }) {
    const patch = {};
    if (birth !== undefined) patch.profile_birth = String(birth).slice(0, 40);
    if (desc !== undefined) patch.profile_desc = String(desc).slice(0, 180);
    if (genre !== undefined) patch.profile_genre = String(genre).slice(0, 16);
    if (!Object.keys(patch).length) return this.get(groupId, jid);
    const sets = Object.keys(patch).map((k) => `${k} = @${k}`).join(', ');
    getDb()
      .prepare(`UPDATE users SET ${sets}, updated_at = @ts WHERE group_id = @gid AND jid = @jid`)
      .run({ ...patch, ts: now(), gid: normalizeJid(groupId), jid: normalizeJid(jid) });
    return this.get(groupId, jid);
  },
};

export default { mutedRepo, stickerMetaRepo, marriageRepo, profileExtrasRepo };
