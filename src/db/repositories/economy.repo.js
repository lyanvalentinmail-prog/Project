/**
 * 𓆩 🪷 𓆪  VÉRSOVA · repositorio de economía (paquete Raiden)
 * ────────────────────────────────────────────────────────────────
 * Cartera + banco + racha diaria + cooldowns por grupo y usuario.
 * Moneda: ¥enes.
 */
import { getDb } from '../connection.js';
import { normalizeJid } from '../../utils/ids.js';

const now = () => Date.now();

function blank(groupId, jid) {
  return {
    group_id: groupId,
    jid,
    coins: 0,
    bank: 0,
    streak: 0,
    last_daily: 0,
    last_work: 0,
    last_crime: 0,
    last_slut: 0,
    last_rob: 0,
    updated_at: now(),
  };
}

export const economyRepo = {
  /** Cuenta del usuario (la crea en ceros si no existe). */
  ensure(groupId, jid) {
    const gid = normalizeJid(groupId);
    const ujid = normalizeJid(jid);
    const row = getDb().prepare('SELECT * FROM economy WHERE group_id = ? AND jid = ?').get(gid, ujid);
    if (row) return row;
    const fresh = blank(gid, ujid);
    getDb()
      .prepare(`INSERT INTO economy (group_id, jid, coins, bank, streak, last_daily, last_work, last_crime, last_slut, last_rob, updated_at)
                VALUES (@group_id, @jid, 0, 0, 0, 0, 0, 0, 0, 0, @updated_at)`)
      .run(fresh);
    return { ...fresh, coins: 0, bank: 0, streak: 0, last_daily: 0, last_work: 0, last_crime: 0, last_slut: 0, last_rob: 0 };
  },

  get(groupId, jid) {
    return getDb()
      .prepare('SELECT * FROM economy WHERE group_id = ? AND jid = ?')
      .get(normalizeJid(groupId), normalizeJid(jid)) ?? null;
  },

  /** Suma (o resta) monedas de la cartera. Nunca baja de 0. Devuelve la fila. */
  addCoins(groupId, jid, delta) {
    const current = this.ensure(groupId, jid);
    const next = Math.max(0, (Number(current.coins) || 0) + Math.trunc(Number(delta) || 0));
    getDb()
      .prepare('UPDATE economy SET coins = ?, updated_at = ? WHERE group_id = ? AND jid = ?')
      .run(next, now(), current.group_id, current.jid);
    return { ...current, coins: next };
  },

  /** Mueve monedas entre cartera y banco. */
  moveToBank(groupId, jid, amount) {
    const current = this.ensure(groupId, jid);
    const qty = Math.min(Math.max(0, Math.trunc(Number(amount) || 0)), Number(current.coins) || 0);
    getDb()
      .prepare('UPDATE economy SET coins = coins - ?, bank = bank + ?, updated_at = ? WHERE group_id = ? AND jid = ?')
      .run(qty, qty, now(), current.group_id, current.jid);
    return { ...current, coins: current.coins - qty, bank: current.bank + qty, moved: qty };
  },

  moveFromBank(groupId, jid, amount) {
    const current = this.ensure(groupId, jid);
    const qty = Math.min(Math.max(0, Math.trunc(Number(amount) || 0)), Number(current.bank) || 0);
    getDb()
      .prepare('UPDATE economy SET coins = coins + ?, bank = bank - ?, updated_at = ? WHERE group_id = ? AND jid = ?')
      .run(qty, qty, now(), current.group_id, current.jid);
    return { ...current, coins: current.coins + qty, bank: current.bank - qty, moved: qty };
  },

  /** Marca un cooldown (last_work, last_daily…). */
  touch(groupId, jid, field, ts = now()) {
    const allowed = ['last_daily', 'last_work', 'last_crime', 'last_slut', 'last_rob'];
    if (!allowed.includes(field)) throw new Error(`cooldown inválido: ${field}`);
    const current = this.ensure(groupId, jid);
    getDb()
      .prepare(`UPDATE economy SET ${field} = ?, updated_at = ? WHERE group_id = ? AND jid = ?`)
      .run(ts, now(), current.group_id, current.jid);
    return { ...current, [field]: ts };
  },

  setStreak(groupId, jid, streak) {
    const current = this.ensure(groupId, jid);
    getDb()
      .prepare('UPDATE economy SET streak = ?, updated_at = ? WHERE group_id = ? AND jid = ?')
      .run(Math.max(0, Math.trunc(Number(streak) || 0)), now(), current.group_id, current.jid);
    return this.get(current.group_id, current.jid);
  },

  /** Ranking por total (cartera + banco). */
  top(groupId, limit = 10) {
    return getDb()
      .prepare(`SELECT jid, coins, bank, (coins + bank) AS total FROM economy
                WHERE group_id = ? ORDER BY total DESC, coins DESC LIMIT ?`)
      .all(normalizeJid(groupId), Math.max(1, Math.min(25, Number(limit) || 10)));
  },

  transfer(groupId, fromJid, toJid, amount) {
    const from = this.ensure(groupId, fromJid);
    const qty = Math.min(Math.max(0, Math.trunc(Number(amount) || 0)), Number(from.coins) || 0);
    if (qty <= 0) return { moved: 0, from, to: this.ensure(groupId, toJid) };
    getDb()
      .prepare('UPDATE economy SET coins = coins - ?, updated_at = ? WHERE group_id = ? AND jid = ?')
      .run(qty, now(), from.group_id, from.jid);
    const to = this.ensure(groupId, toJid);
    getDb()
      .prepare('UPDATE economy SET coins = coins + ?, updated_at = ? WHERE group_id = ? AND jid = ?')
      .run(qty, now(), to.group_id, to.jid);
    return { moved: qty, from: { ...from, coins: from.coins - qty }, to: { ...to, coins: to.coins + qty } };
  },
};

export default economyRepo;
