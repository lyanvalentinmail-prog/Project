/**
 * 𓆩 🪷 𓆪  VÉRSOVA · servicio de economía (paquete Raiden)
 * ────────────────────────────────────────────────────────────────
 * Moneda: ¥enes. Cartera + banco, racha diaria, trabajos, crímenes,
 * apuestas y robos. Cooldowns y montos inspirados en Raiden-WaBot,
 * con la estética y las reglas de VÉRSOVA.
 */
import { economyRepo, usersRepo, groupsRepo, auditRepo } from '../db/index.js';
import { ok, fail } from './result.js';
import { resolveTarget, validateUserJid } from '../security/validation.js';
import { maskPhone } from '../utils/ids.js';
import { mention as mentionOf } from '../design/theme.js';

export const COIN = '¥enes';
export const MIN_BET = 200;

const COOLDOWNS = Object.freeze({
  last_work: 60 * 1000,
  last_slut: 4 * 60 * 1000,
  last_crime: 5 * 60 * 1000,
  last_rob: 10 * 60 * 1000,
  last_daily: 24 * 60 * 60 * 1000,
});

const fmt = (n) => Number(n || 0).toLocaleString('es-MX');

function displayName(ctx, jid) {
  if (!jid) return 'Alguien';
  if (jid === ctx.author.jid) return ctx.author.name;
  const row = usersRepo.get(ctx.group.groupId, jid);
  return row?.name ?? ctx.client?.contactName?.(jid) ?? maskPhone(jid);
}

function adminOnlyBlock(ctx, command) {
  if (ctx.group.config.adminonly && !ctx.author.isAdmin) {
    return fail('sys.invalid', {
      command,
      message: 'Este grupo está en modo solo administradores.',
      hint: `Un admin puede desactivarlo con ${ctx.prefix ?? '.'}onlyadmin off`,
    });
  }
  return null;
}

function cooldownLeft(account, field) {
  const last = Number(account[field] || 0);
  if (!last) return 0;
  return Math.max(0, COOLDOWNS[field] - (Date.now() - last));
}

function cooldownFail(command, field, leftMs) {
  const totalSec = Math.ceil(leftMs / 1000);
  const parts = [];
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days) parts.push(`${days} d`);
  if (hours) parts.push(`${hours} h`);
  if (minutes) parts.push(`${minutes} min`);
  if (seconds || !parts.length) parts.push(`${seconds} s`);
  return fail('sys.invalid', {
    command,
    message: `Debes esperar ${parts.join(' ')} para volver a usarlo.`,
  });
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ═══════════════════════════════════════════════════════════════
   Consultas
   ═══════════════════════════════════════════════════════════════ */

export function balance(ctx, arg = null) {
  const blocked = adminOnlyBlock(ctx, 'bal');
  if (blocked) return blocked;
  let targetJid = ctx.author.jid;
  if (arg !== null || (ctx.mentions ?? []).length) {
    const resolved = resolveTarget(ctx, { arg, allowQuoted: false });
    if (!resolved.ok) return fail('sys.invalid', { command: 'bal', message: resolved.reason });
    const jid = validateUserJid(resolved.value);
    if (!jid.ok) return fail('sys.invalid', { command: 'bal', message: jid.reason });
    targetJid = jid.value;
  }
  const account = economyRepo.ensure(ctx.group.groupId, targetJid);
  const coins = Number(account.coins) || 0;
  const bank = Number(account.bank) || 0;
  return ok('eco.balance', {
    userName: displayName(ctx, targetJid),
    coins,
    coinsFmt: fmt(coins),
    bank,
    bankFmt: fmt(bank),
    totalFmt: fmt(coins + bank),
    streak: Number(account.streak) || 0,
    coin: COIN,
    isSelf: targetJid === ctx.author.jid,
    mentions: targetJid === ctx.author.jid ? [] : [targetJid],
    command: 'bal',
  });
}

export function baltop(ctx) {
  const blocked = adminOnlyBlock(ctx, 'baltop');
  if (blocked) return blocked;
  const rows = economyRepo.top(ctx.group.groupId, 10).map((row, index) => ({
    rank: index + 1,
    jid: row.jid,
    name: displayName(ctx, row.jid),
    coins: Number(row.coins) || 0,
    bank: Number(row.bank) || 0,
    total: Number(row.total) || 0,
    totalFmt: fmt(row.total),
  }));
  return ok('eco.top', {
    entries: rows,
    groupName: ctx.group.name,
    coin: COIN,
    command: 'baltop',
  });
}

export function einfo(ctx, arg = null) {
  const blocked = adminOnlyBlock(ctx, 'einfo');
  if (blocked) return blocked;
  let targetJid = ctx.author.jid;
  if (arg !== null || (ctx.mentions ?? []).length) {
    const resolved = resolveTarget(ctx, { arg, allowQuoted: false });
    if (!resolved.ok) return fail('sys.invalid', { command: 'einfo', message: resolved.reason });
    const jid = validateUserJid(resolved.value);
    if (!jid.ok) return fail('sys.invalid', { command: 'einfo', message: jid.reason });
    targetJid = jid.value;
  }
  const account = economyRepo.get(ctx.group.groupId, targetJid);
  if (!account) {
    return fail('sys.invalid', {
      command: 'einfo',
      message: 'Ese usuario no tiene cuenta de economía en este grupo todavía.',
      hint: 'Gana tus primeros ¥enes con .work o .daily',
    });
  }
  const labels = [
    ['Work', 'last_work'],
    ['Slut', 'last_slut'],
    ['Crime', 'last_crime'],
    ['Rob', 'last_rob'],
    ['Daily', 'last_daily'],
  ];
  const rows = labels.map(([label, field]) => {
    const left = cooldownLeft(account, field);
    if (left <= 0) return { label, ready: true, text: 'listo ahora' };
    const totalSec = Math.ceil(left / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const parts = [];
    if (days) parts.push(`${days} d`);
    if (hours) parts.push(`${hours} h`);
    if (minutes) parts.push(`${minutes} min`);
    if (seconds || !parts.length) parts.push(`${seconds} s`);
    return { label, ready: false, text: parts.join(' ') };
  });
  const total = (Number(account.coins) || 0) + (Number(account.bank) || 0);
  return ok('eco.einfo', {
    userName: displayName(ctx, targetJid),
    rows,
    totalFmt: fmt(total),
    coin: COIN,
    mentions: [targetJid],
    command: 'einfo',
  });
}

/* ═══════════════════════════════════════════════════════════════
   Ganancias con cooldown
   ═══════════════════════════════════════════════════════════════ */

const WORK_WIN = [
  'Trabajaste para el gran sistema capitalista y te pagaron',
  'Cargaste cajas en el mercado toda la tarde y ganaste',
  'Repartiste pizzas bajo la lluvia y recibiste',
  'Programaste toda la noche y tu jefe te pagó',
  'Vendiste limonada en el parque y juntaste',
  'Ayudaste a cruzar a una anciana y te dio',
  'Ganaste un mini torneo de barrio y te llevaste',
  'Tradujiste un texto larguísimo y cobraste',
];
const WORK_LOSE = [
  'Tu jefe te estafó la quincena y perdiste',
  'Te robaron la cartera camino al trabajo y perdiste',
  'Invertiste en un negocio trucho y perdiste',
  'Te multaron por estacionar mal y perdiste',
  'Un cliente no te pagó y perdiste',
  'El banco te cobró comisiones y perdiste',
];

export function work(ctx) {
  const blocked = adminOnlyBlock(ctx, 'work');
  if (blocked) return blocked;
  const account = economyRepo.ensure(ctx.group.groupId, ctx.author.jid);
  const left = cooldownLeft(account, 'last_work');
  if (left > 0) return cooldownFail('work', 'last_work', left);

  let delta;
  let phrase;
  if (Math.random() < 0.25) {
    delta = -Math.min(Number(account.coins) || 0, Math.floor(Math.random() * 5000) + 1000);
    phrase = pick(WORK_LOSE);
  } else {
    delta = Math.floor(Math.random() * 10000) + 1;
    phrase = pick(WORK_WIN);
  }
  economyRepo.addCoins(ctx.group.groupId, ctx.author.jid, delta);
  economyRepo.touch(ctx.group.groupId, ctx.author.jid, 'last_work');
  const updated = economyRepo.get(ctx.group.groupId, ctx.author.jid);
  return ok('eco.result', {
    title: 'Trabajo completado',
    userName: ctx.author.name,
    phrase,
    amountFmt: fmt(Math.abs(delta)),
    won: delta >= 0,
    balanceFmt: fmt(updated.coins),
    coin: COIN,
    command: 'work',
  });
}

const CRIME_WIN = [
  'Asaltaste el banco del rol sin dejar huellas y huiste con',
  'Hackeaste la bóveda digital y sacaste',
  'Robaste la caja fuerte del casino y conseguiste',
  'Vendiste información secreta al mejor postor por',
];
const CRIME_LOSE = [
  'Te atraparon en pleno atraco y la fianza costó',
  'La alarma sonó antes de tiempo y perdiste',
  'Tu cómplice te delató y perdiste',
  'Te metieron preso una noche y la multa fue de',
];

export function crime(ctx) {
  const blocked = adminOnlyBlock(ctx, 'crime');
  if (blocked) return blocked;
  const account = economyRepo.ensure(ctx.group.groupId, ctx.author.jid);
  const left = cooldownLeft(account, 'last_crime');
  if (left > 0) return cooldownFail('crime', 'last_crime', left);

  let delta;
  let phrase;
  if (Math.random() < 0.4) {
    delta = -Math.min(Number(account.coins) || 0, Math.floor(Math.random() * 8000) + 2000);
    phrase = pick(CRIME_LOSE);
  } else {
    delta = Math.floor(Math.random() * 15000) + 3000;
    phrase = pick(CRIME_WIN);
  }
  economyRepo.addCoins(ctx.group.groupId, ctx.author.jid, delta);
  economyRepo.touch(ctx.group.groupId, ctx.author.jid, 'last_crime');
  const updated = economyRepo.get(ctx.group.groupId, ctx.author.jid);
  return ok('eco.result', {
    title: 'Crimen nocturno',
    userName: ctx.author.name,
    phrase,
    amountFmt: fmt(Math.abs(delta)),
    won: delta >= 0,
    balanceFmt: fmt(updated.coins),
    coin: COIN,
    command: 'crime',
  });
}

const SLUT_WIN = [
  'Trabajaste toda la noche en el club y ganaste',
  'Fuiste la estrella del cabaret y recibiste',
  'Tus fans te llenaron de propinas:',
  'Conseguiste un cliente generoso que pagó',
];
const SLUT_LOSE = [
  'El club cerró temprano y solo perdiste tiempo… y',
  'Te estafaron con billetes falsos y perdiste',
  'La policía clausuró el local y la multa fue de',
];

export function slut(ctx) {
  const blocked = adminOnlyBlock(ctx, 'slut');
  if (blocked) return blocked;
  const account = economyRepo.ensure(ctx.group.groupId, ctx.author.jid);
  const left = cooldownLeft(account, 'last_slut');
  if (left > 0) return cooldownFail('slut', 'last_slut', left);

  let delta;
  let phrase;
  if (Math.random() < 0.35) {
    delta = -Math.min(Number(account.coins) || 0, Math.floor(Math.random() * 5000) + 1000);
    phrase = pick(SLUT_LOSE);
  } else {
    delta = Math.floor(Math.random() * 10000) + 1000;
    phrase = pick(SLUT_WIN);
  }
  economyRepo.addCoins(ctx.group.groupId, ctx.author.jid, delta);
  economyRepo.touch(ctx.group.groupId, ctx.author.jid, 'last_slut');
  const updated = economyRepo.get(ctx.group.groupId, ctx.author.jid);
  return ok('eco.result', {
    title: 'Turno nocturno',
    userName: ctx.author.name,
    phrase,
    amountFmt: fmt(Math.abs(delta)),
    won: delta >= 0,
    balanceFmt: fmt(updated.coins),
    coin: COIN,
    command: 'slut',
  });
}

export function daily(ctx) {
  const blocked = adminOnlyBlock(ctx, 'daily');
  if (blocked) return blocked;
  const account = economyRepo.ensure(ctx.group.groupId, ctx.author.jid);
  const left = cooldownLeft(account, 'last_daily');
  if (left > 0) return cooldownFail('daily', 'last_daily', left);

  const last = Number(account.last_daily) || 0;
  const streakLost = last > 0 && Date.now() - last > 48 * 60 * 60 * 1000;
  const streak = streakLost ? 1 : (Number(account.streak) || 0) + 1;
  const baseReward = 5000;
  const reward = baseReward + (streak - 1) * 5000;
  const nextReward = baseReward + streak * 5000;

  economyRepo.addCoins(ctx.group.groupId, ctx.author.jid, reward);
  economyRepo.touch(ctx.group.groupId, ctx.author.jid, 'last_daily');
  economyRepo.setStreak(ctx.group.groupId, ctx.author.jid, streak);
  const updated = economyRepo.get(ctx.group.groupId, ctx.author.jid);
  return ok('eco.daily', {
    userName: ctx.author.name,
    rewardFmt: fmt(reward),
    streak,
    nextStreak: streak + 1,
    nextRewardFmt: fmt(nextReward),
    streakLost,
    balanceFmt: fmt(updated.coins),
    coin: COIN,
    command: 'daily',
  });
}

/* ═══════════════════════════════════════════════════════════════
   Apuestas y transferencias
   ═══════════════════════════════════════════════════════════════ */

function parseAmount(raw) {
  const digits = String(raw ?? '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  const value = Number.parseInt(digits, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function coinflip(ctx, rawAmount = null, guessRaw = null) {
  const blocked = adminOnlyBlock(ctx, 'cf');
  if (blocked) return blocked;
  const amount = parseAmount(rawAmount);
  if (!amount) {
    return fail('sys.invalid', {
      command: 'cf',
      message: 'Debes apostar una cantidad válida.',
      hint: `Ejemplo: ${ctx.prefix ?? '.'}cf 500 cara`,
    });
  }
  if (amount < MIN_BET) {
    return fail('sys.invalid', { command: 'cf', message: `Debes apostar al menos ${fmt(MIN_BET)} ${COIN}.` });
  }
  const account = economyRepo.ensure(ctx.group.groupId, ctx.author.jid);
  if (amount > (Number(account.coins) || 0)) {
    return fail('sys.invalid', {
      command: 'cf',
      message: `No tienes suficientes ¥enes (tienes ${fmt(account.coins)}).`,
      hint: 'Gana más con .work o .daily',
    });
  }
  const guess = String(guessRaw ?? 'cara').toLowerCase();
  const wantsHeads = ['cara', 'c', 'heads', 'head'].includes(guess);
  const result = Math.random() < 0.5 ? 'cara' : 'cruz';
  const won = (result === 'cara') === wantsHeads;
  economyRepo.addCoins(ctx.group.groupId, ctx.author.jid, won ? amount : -amount);
  const updated = economyRepo.get(ctx.group.groupId, ctx.author.jid);
  return ok('eco.bet', {
    game: 'Cara o cruz',
    userName: ctx.author.name,
    result,
    choice: wantsHeads ? 'cara' : 'cruz',
    amountFmt: fmt(amount),
    won,
    balanceFmt: fmt(updated.coins),
    coin: COIN,
    command: 'cf',
  });
}

export function roulette(ctx, colorRaw = null, rawAmount = null) {
  const blocked = adminOnlyBlock(ctx, 'rt');
  if (blocked) return blocked;
  const colorText = String(colorRaw ?? '').toLowerCase();
  const wantsRed = ['rojo', 'red', 'r'].includes(colorText);
  const wantsBlack = ['negro', 'black', 'n'].includes(colorText);
  if (!wantsRed && !wantsBlack) {
    return fail('sys.invalid', {
      command: 'rt',
      message: 'Elige un color: rojo o negro.',
      hint: `Ejemplo: ${ctx.prefix ?? '.'}rt rojo 500`,
    });
  }
  const amount = parseAmount(rawAmount);
  if (!amount) {
    return fail('sys.invalid', { command: 'rt', message: 'Debes apostar una cantidad válida.' });
  }
  if (amount < MIN_BET) {
    return fail('sys.invalid', { command: 'rt', message: `Debes apostar al menos ${fmt(MIN_BET)} ${COIN}.` });
  }
  const account = economyRepo.ensure(ctx.group.groupId, ctx.author.jid);
  if (amount > (Number(account.coins) || 0)) {
    return fail('sys.invalid', {
      command: 'rt',
      message: `No tienes suficientes ¥enes (tienes ${fmt(account.coins)}).`,
    });
  }
  const result = Math.random() < 0.5 ? 'rojo' : 'negro';
  const won = (result === 'rojo') === wantsRed;
  economyRepo.addCoins(ctx.group.groupId, ctx.author.jid, won ? amount : -amount);
  const updated = economyRepo.get(ctx.group.groupId, ctx.author.jid);
  return ok('eco.bet', {
    game: 'Ruleta',
    userName: ctx.author.name,
    result,
    choice: wantsRed ? 'rojo' : 'negro',
    amountFmt: fmt(amount),
    won,
    balanceFmt: fmt(updated.coins),
    coin: COIN,
    command: 'rt',
  });
}

export function pay(ctx, targetArg = null, rawAmount = null) {
  const blocked = adminOnlyBlock(ctx, 'pay');
  if (blocked) return blocked;
  const resolved = resolveTarget(ctx, { arg: targetArg, allowQuoted: true });
  if (!resolved.ok) return fail('sys.invalid', { command: 'pay', message: resolved.reason });
  const jid = validateUserJid(resolved.value);
  if (!jid.ok) return fail('sys.invalid', { command: 'pay', message: jid.reason });
  if (jid.value === ctx.author.jid) {
    return fail('sys.invalid', { command: 'pay', message: 'No puedes pagarte a ti mismo.' });
  }
  const amount = parseAmount(rawAmount);
  if (!amount) {
    return fail('sys.invalid', {
      command: 'pay',
      message: 'Indica una cantidad válida.',
      hint: `Ejemplo: ${ctx.prefix ?? '.'}pay @usuario 500`,
    });
  }
  const account = economyRepo.ensure(ctx.group.groupId, ctx.author.jid);
  if (amount > (Number(account.coins) || 0)) {
    return fail('sys.invalid', {
      command: 'pay',
      message: `No tienes suficientes ¥enes (tienes ${fmt(account.coins)}).`,
    });
  }
  const { moved } = economyRepo.transfer(ctx.group.groupId, ctx.author.jid, jid.value, amount);
  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId: ctx.group.groupId,
    actorJid: ctx.author.jid,
    action: 'eco.pay',
    targetJid: jid.value,
    detail: { amount: moved },
  });
  return ok('eco.transfer', {
    fromName: ctx.author.name,
    toName: displayName(ctx, jid.value),
    amountFmt: fmt(moved),
    coin: COIN,
    mentions: [jid.value],
    command: 'pay',
  });
}

export function steal(ctx, targetArg = null) {
  const blocked = adminOnlyBlock(ctx, 'rob');
  if (blocked) return blocked;
  const resolved = resolveTarget(ctx, { arg: targetArg, allowQuoted: true });
  if (!resolved.ok) return fail('sys.invalid', { command: 'rob', message: resolved.reason });
  const jid = validateUserJid(resolved.value);
  if (!jid.ok) return fail('sys.invalid', { command: 'rob', message: jid.reason });
  if (jid.value === ctx.author.jid) {
    return fail('sys.invalid', { command: 'rob', message: 'No puedes robarte a ti mismo.' });
  }
  const account = economyRepo.ensure(ctx.group.groupId, ctx.author.jid);
  const left = cooldownLeft(account, 'last_rob');
  if (left > 0) return cooldownFail('rob', 'last_rob', left);

  const victim = economyRepo.ensure(ctx.group.groupId, jid.value);
  const victimCoins = Number(victim.coins) || 0;
  if (victimCoins <= 0) {
    economyRepo.touch(ctx.group.groupId, ctx.author.jid, 'last_rob');
    return fail('sys.invalid', {
      command: 'rob',
      message: `${displayName(ctx, jid.value)} no tiene ¥enes en la cartera.`,
      hint: 'Solo se puede robar la cartera, no el banco.',
    });
  }
  // 55 % de éxito; si fallas, pagas una multa de tu cartera.
  if (Math.random() < 0.55) {
    const stolen = Math.min(victimCoins, Math.floor(Math.random() * victimCoins * 0.4) + 100);
    economyRepo.transfer(ctx.group.groupId, jid.value, ctx.author.jid, stolen);
    economyRepo.touch(ctx.group.groupId, ctx.author.jid, 'last_rob');
    return ok('eco.steal', {
      thiefName: ctx.author.name,
      victimName: displayName(ctx, jid.value),
      amountFmt: fmt(stolen),
      success: true,
      coin: COIN,
      mentions: [jid.value],
      command: 'rob',
    });
  }
  const fine = Math.min(Number(account.coins) || 0, Math.floor(Math.random() * 3000) + 500);
  economyRepo.addCoins(ctx.group.groupId, ctx.author.jid, -fine);
  economyRepo.touch(ctx.group.groupId, ctx.author.jid, 'last_rob');
  return ok('eco.steal', {
    thiefName: ctx.author.name,
    victimName: displayName(ctx, jid.value),
    amountFmt: fmt(fine),
    success: false,
    coin: COIN,
    mentions: [jid.value],
    command: 'rob',
  });
}

/* ═══════════════════════════════════════════════════════════════
   Banco
   ═══════════════════════════════════════════════════════════════ */

export function deposit(ctx, rawAmount = null) {
  const blocked = adminOnlyBlock(ctx, 'deposit');
  if (blocked) return blocked;
  const account = economyRepo.ensure(ctx.group.groupId, ctx.author.jid);
  const all = ['all', 'todo', 'todas'].includes(String(rawAmount ?? '').toLowerCase());
  const amount = all ? Number(account.coins) || 0 : parseAmount(rawAmount);
  if (!amount || amount <= 0) {
    return fail('sys.invalid', {
      command: 'deposit',
      message: all ? 'No tienes ¥enes en la cartera para depositar.' : 'Indica una cantidad válida o usa "all".',
      hint: `Ejemplo: ${ctx.prefix ?? '.'}deposit 1000`,
    });
  }
  if (amount > (Number(account.coins) || 0)) {
    return fail('sys.invalid', {
      command: 'deposit',
      message: `Solo tienes ${fmt(account.coins)} ${COIN} en la cartera.`,
    });
  }
  const updated = economyRepo.moveToBank(ctx.group.groupId, ctx.author.jid, amount);
  return ok('eco.bank', {
    userName: ctx.author.name,
    action: 'deposit',
    amountFmt: fmt(updated.moved),
    coinsFmt: fmt(updated.coins),
    bankFmt: fmt(updated.bank),
    coin: COIN,
    command: 'deposit',
  });
}

export function withdraw(ctx, rawAmount = null) {
  const blocked = adminOnlyBlock(ctx, 'with');
  if (blocked) return blocked;
  const account = economyRepo.ensure(ctx.group.groupId, ctx.author.jid);
  const all = ['all', 'todo', 'todas'].includes(String(rawAmount ?? '').toLowerCase());
  const amount = all ? Number(account.bank) || 0 : parseAmount(rawAmount);
  if (!amount || amount <= 0) {
    return fail('sys.invalid', {
      command: 'with',
      message: all ? 'No tienes ¥enes en el banco para retirar.' : 'Indica una cantidad válida o usa "all".',
      hint: `Ejemplo: ${ctx.prefix ?? '.'}with 1000`,
    });
  }
  if (amount > (Number(account.bank) || 0)) {
    return fail('sys.invalid', {
      command: 'with',
      message: `Solo tienes ${fmt(account.bank)} ${COIN} en el banco.`,
    });
  }
  const updated = economyRepo.moveFromBank(ctx.group.groupId, ctx.author.jid, amount);
  return ok('eco.bank', {
    userName: ctx.author.name,
    action: 'withdraw',
    amountFmt: fmt(updated.moved),
    coinsFmt: fmt(updated.coins),
    bankFmt: fmt(updated.bank),
    coin: COIN,
    command: 'with',
  });
}

export { mentionOf };
