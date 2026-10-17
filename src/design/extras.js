/**
 * 𓆩 🧈 𓆪  VÉRSOVA · plantillas del paquete Raiden
 * ────────────────────────────────────────────────────────────────
 * anime · economía · descargas · perfil · stickers · herramientas
 * logos · moderación extra · estado. Misma estética de VÉRSOVA,
 * cada mensaje con su propio diseño.
 */
import { SYM, RULE, KAOMOJI, kv, bullet, cmd, inlineCmd, footer, signature, frame, statusLine, bar, fancyNumber, section, versovaHeader, mention, miniHeader, currentPrefix } from './theme.js';
import { formatDate, formatDateTime, formatDuration, timeAgo } from '../utils/time.js';
import { maskPhone } from '../utils/ids.js';

/** Prefijo del sub-bot que está renderizando. */
const P = { toString: () => currentPrefix() };
const str = (value, fallback = '—') => {
  const text = String(value ?? '').trim();
  return text ? text : fallback;
};
const num = (value) => Number(value) || 0;
const list = (value) => (Array.isArray(value) ? value : []);
const mentionOf = (jid) => mention(jid);

/* ═══════════════════════════════════════════════════════════════
   ANIME · reacciones de rol
   ═══════════════════════════════════════════════════════════════ */

export function animeReact({ emoji, actorName, phrase, targetName, self, mentions = [] } = {}) {
  const actor = str(actorName, 'Alguien');
  const action = str(phrase, 'hace algo');
  const target = self ? '' : ` ${str(targetName, 'alguien')}`;
  const tags = list(mentions).map(mentionOf).join(' ');
  return [
    `ㅤ${SYM.bracketL} ${emoji ?? '🌸'} ${SYM.bracketR} ㅤ𝑅𝑒𝑎𝑐𝑐𝑖𝑜́𝑛`,
    `ㅤ${RULE.wave}`,
    `ㅤ${SYM.arrow}ㅤ${actor} ${action}${target}.`,
    tags ? `ㅤ${tags}` : null,
    `ㅤ${RULE.wave}`,
    `ㅤ${KAOMOJI.hug}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/* ═══════════════════════════════════════════════════════════════
   ECONOMÍA · ¥enes
   ═══════════════════════════════════════════════════════════════ */

export function ecoBalance({ userName, coinsFmt, bankFmt, totalFmt, streak, coin, isSelf } = {}) {
  return [
    `${SYM.bracketL} 🪷 ${SYM.bracketR} ㅤ𝐵𝑎𝑙𝑎𝑛𝑐𝑒 ㅤ·ㅤ ${str(userName)}`,
    RULE.coffee,
    kv('Cartera', `⛁ ${str(coinsFmt, '0')} ${str(coin, '¥enes')}`),
    kv('Banco', `🏦 ${str(bankFmt, '0')} ${str(coin, '¥enes')}`),
    kv('Total', `${str(totalFmt, '0')} ${str(coin, '¥enes')}`),
    num(streak) > 0 ? kv('Racha diaria', `🔥 ${num(streak)} día${num(streak) === 1 ? '' : 's'}`) : null,
    RULE.coffee,
    isSelf ? `ㅤGana más con ㅤ${inlineCmd('work')} ㅤo ㅤ${inlineCmd('daily')}` : `ㅤRegálale con ㅤ${inlineCmd('pay', '@usuario <cantidad>')}`,
    `ㅤ${KAOMOJI.smug}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function ecoTop({ entries, groupName, coin } = {}) {
  const rows = list(entries);
  const medals = ['🥇', '🥈', '🥉'];
  const body = rows.length
    ? rows
        .map((row, index) => {
          const medal = medals[index] ?? `${String(num(row.rank) || index + 1).padStart(2, '0')}`;
          return `ㅤ${medal}ㅤ${str(row.name).padEnd(14, ' ')} ⁙ ${str(row.totalFmt, '0')} ${str(coin, '¥enes')}`;
        })
        .join('\n')
    : 'ㅤNadie tiene ¥enes todavía. ¡Sé el primero con .daily!';
  return [
    `${SYM.bracketL} 🏆 ${SYM.bracketR} ㅤ𝑇𝑜𝑝 ㅤ𝑟𝑖𝑐𝑜𝑠 ㅤ·ㅤ ${str(groupName)}`,
    RULE.thin,
    body,
    RULE.thin,
    kv('Fortunas', String(rows.length)),
    `ㅤ${KAOMOJI.cool}`,
  ].join('\n');
}

export function ecoEinfo({ userName, rows, totalFmt, coin, mentions = [] } = {}) {
  const lines = list(rows).map((row) => {
    const mark = row.ready ? '✓' : '⏳';
    return `ㅤ${mark}ㅤ${str(row.label).padEnd(7, ' ')} ⁙ ${str(row.text)}`;
  });
  const tags = list(mentions).map(mentionOf).join(' ');
  return [
    `${SYM.bracketL} ⏳ ${SYM.bracketR} ㅤ𝐸𝑐𝑜𝑛𝑜𝑚𝑖́𝑎 ㅤ·ㅤ ${str(userName)}`,
    RULE.dotted,
    ...lines,
    RULE.dotted,
    kv('Total', `⛁ ${str(totalFmt, '0')} ${str(coin, '¥enes')}`),
    tags ? `ㅤ${tags}` : null,
    `ㅤ${KAOMOJI.neutral}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function ecoResult({ title, userName, phrase, amountFmt, won, balanceFmt, coin } = {}) {
  const success = Boolean(won) && String(won) !== 'false' && won !== 0 && won !== '0';
  return [
    `${SYM.bracketL} ${success ? '✿' : '✗'} ${SYM.bracketR} ㅤ${str(title, 'Economía')}`,
    success ? RULE.sakura : RULE.chain,
    `ㅤ${SYM.leaf}ㅤ${str(userName)}: ${str(phrase)} *${str(amountFmt, '0')} ${str(coin, '¥enes')}*.`,
    `ㅤ${SYM.leaf}ㅤBalance ⁙ ⛁ ${str(balanceFmt, '0')} ${str(coin, '¥enes')}`,
    success ? RULE.sakura : RULE.chain,
    `ㅤ${success ? KAOMOJI.cheer : KAOMOJI.sad}`,
  ].join('\n');
}

export function ecoDaily({ userName, rewardFmt, streak, nextStreak, nextRewardFmt, streakLost, balanceFmt, coin } = {}) {
  return [
    `ㅤ${SYM.bracketL} 🎁 ${SYM.bracketR} ㅤ𝑅𝑒𝑐𝑜𝑚𝑝𝑒𝑛𝑠𝑎 ㅤ𝑑𝑖𝑎𝑟𝑖𝑎`,
    `ㅤ${RULE.coffee}`,
    `ㅤ${SYM.arrow}ㅤ${str(userName)} reclamó *${str(rewardFmt, '0')} ${str(coin, '¥enes')}* (día ${num(streak) || 1}).`,
    `ㅤ${SYM.leaf}ㅤDía ${num(nextStreak) || 2} ⁙ +${str(nextRewardFmt, '0')} ${str(coin, '¥enes')}`,
    streakLost ? `ㅤ${SYM.chain}ㅤPerdiste tu racha anterior. ¡A empezar de nuevo!` : null,
    `ㅤ${SYM.leaf}ㅤBalance ⁙ ⛁ ${str(balanceFmt, '0')} ${str(coin, '¥enes')}`,
    `ㅤ${RULE.coffee}`,
    `ㅤ${KAOMOJI.sparkle}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function ecoBet({ game, userName, result, choice, amountFmt, won, balanceFmt, coin } = {}) {
  const success = Boolean(won) && String(won) !== 'false' && won !== 0 && won !== '0';
  return [
    `${SYM.bracketL} 🎲 ${SYM.bracketR} ㅤ${str(game, 'Apuesta')}`,
    RULE.wave,
    `ㅤ${SYM.arrow}ㅤSalió *${str(result)}* · elegiste *${str(choice)}*.`,
    success
      ? `ㅤ${SYM.leaf}ㅤ${str(userName)} ganó *${str(amountFmt, '0')} ${str(coin, '¥enes')}* ${KAOMOJI.cheer}`
      : `ㅤ${SYM.chain}ㅤ${str(userName)} perdió *${str(amountFmt, '0')} ${str(coin, '¥enes')}* ${KAOMOJI.sad}`,
    `ㅤ${SYM.leaf}ㅤBalance ⁙ ⛁ ${str(balanceFmt, '0')} ${str(coin, '¥enes')}`,
    RULE.wave,
    `ㅤApuesta mínima ⁙ 200 ${str(coin, '¥enes')}`,
  ].join('\n');
}

export function ecoTransfer({ fromName, toName, amountFmt, coin, mentions = [] } = {}) {
  const tags = list(mentions).map(mentionOf).join(' ');
  return [
    `${SYM.bracketL} 💸 ${SYM.bracketR} ㅤ𝑇𝑟𝑎𝑛𝑠𝑓𝑒𝑟𝑒𝑛𝑐𝑖𝑎`,
    RULE.thin,
    `ㅤ${SYM.arrow}ㅤ${str(fromName)} → ${str(toName)}`,
    `ㅤ${SYM.leaf}ㅤMonto ⁙ *${str(amountFmt, '0')} ${str(coin, '¥enes')}*`,
    tags ? `ㅤ${tags}` : null,
    RULE.thin,
    `ㅤ${KAOMOJI.wink}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function ecoSteal({ thiefName, victimName, amountFmt, success, coin, mentions = [] } = {}) {
  const win = Boolean(success) && String(success) !== 'false' && success !== 0 && success !== '0';
  const tags = list(mentions).map(mentionOf).join(' ');
  return [
    `${SYM.bracketL} ${win ? '🥷' : '🚨'} ${SYM.bracketR} ㅤ${win ? '𝑅𝑜𝑏𝑜 ㅤ𝑒𝑥𝑖𝑡𝑜𝑠𝑜' : '𝑅𝑜𝑏𝑜 ㅤ𝑓𝑟𝑢𝑠𝑡𝑟𝑎𝑑𝑜'}`,
    win ? RULE.night : RULE.chain,
    win
      ? `ㅤ${SYM.arrow}ㅤ${str(thiefName)} le robó *${str(amountFmt, '0')} ${str(coin, '¥enes')}* a ${str(victimName)}.`
      : `ㅤ${SYM.chain}ㅤ¡Atraparon a ${str(thiefName)}! Pagó *${str(amountFmt, '0')} ${str(coin, '¥enes')}* de multa.`,
    tags ? `ㅤ${tags}` : null,
    win ? RULE.night : RULE.chain,
    `ㅤ${win ? KAOMOJI.smug : KAOMOJI.angry}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function ecoBank({ userName, action, amountFmt, coinsFmt, bankFmt, coin } = {}) {
  const deposit = String(action) !== 'withdraw';
  return [
    `${SYM.bracketL} 🏦 ${SYM.bracketR} ㅤ${deposit ? '𝐷𝑒𝑝𝑜́𝑠𝑖𝑡𝑜' : '𝑅𝑒𝑡𝑖𝑟𝑜'}`,
    RULE.dotted,
    `ㅤ${SYM.arrow}ㅤ${str(userName)} ${deposit ? 'guardó' : 'retiró'} *${str(amountFmt, '0')} ${str(coin, '¥enes')}*.`,
    kv('Cartera', `⛁ ${str(coinsFmt, '0')}`),
    kv('Banco', `🏦 ${str(bankFmt, '0')}`),
    RULE.dotted,
    `ㅤ${SYM.scroll}ㅤLo del banco no te lo pueden robar.`,
    `ㅤ${KAOMOJI.cozy}`,
  ].join('\n');
}

/* ═══════════════════════════════════════════════════════════════
   DESCARGAS
   ═══════════════════════════════════════════════════════════════ */

export function dlMusic({ kind, query, searchUrl } = {}) {
  const isVideo = String(kind) === 'video';
  return [
    `${SYM.bracketL} ${isVideo ? '🎬' : '🎧'} ${SYM.bracketR} ㅤ${isVideo ? '𝑉𝑖𝑑𝑒𝑜' : '𝑀𝑢́𝑠𝑖𝑐𝑎'} ㅤ·ㅤ YouTube`,
    RULE.coffee,
    kv('Búsqueda', str(query)),
    '',
    str(searchUrl),
    '',
    `ㅤ${SYM.leaf}ㅤAbre el enlace y elige tu resultado favorito.`,
    `ㅤ${SYM.leaf}ㅤLímite sugerido ⁙ audios de hasta 7 minutos.`,
    RULE.coffee,
    `ㅤ${KAOMOJI.happy}`,
  ].join('\n');
}

export function dlLink({ network, icon, url, hint } = {}) {
  return [
    `${SYM.bracketL} ${icon ?? '🔗'} ${SYM.bracketR} ㅤ${str(network, 'Enlace')}`,
    RULE.thin,
    str(url),
    '',
    hint ? `ㅤ${SYM.scroll}ㅤ${str(hint)}` : null,
    RULE.thin,
    `ㅤ${KAOMOJI.wink}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function dlLyrics({ query, geniusUrl, letrasUrl } = {}) {
  return [
    `${SYM.bracketL} 🎤 ${SYM.bracketR} ㅤ𝐿𝑒𝑡𝑟𝑎 ㅤ·ㅤ ${str(query)}`,
    RULE.sakura,
    `ㅤ${SYM.leaf}ㅤGenius ⁙ ${str(geniusUrl)}`,
    `ㅤ${SYM.leaf}ㅤLetras ⁙ ${str(letrasUrl)}`,
    RULE.sakura,
    `ㅤCanta bonito ☕ ㅤ${KAOMOJI.cheer}`,
  ].join('\n');
}

/* ═══════════════════════════════════════════════════════════════
   PERFIL · matrimonios y datos
   ═══════════════════════════════════════════════════════════════ */

export function perfilProposal({ fromName, toName, minutes, mentions = [] } = {}) {
  const tags = list(mentions).map(mentionOf).join(' ');
  return [
    `ㅤ${SYM.bracketL} 💍 ${SYM.bracketR} ㅤ𝑃𝑟𝑜𝑝𝑢𝑒𝑠𝑡𝑎 ㅤ𝑑𝑒 ㅤ𝑚𝑎𝑡𝑟𝑖𝑚𝑜𝑛𝑖𝑜`,
    `ㅤ${RULE.sakura}`,
    `ㅤ${str(fromName)} le propone matrimonio a ${str(toName)}`,
    tags ? `ㅤ${tags}` : null,
    '',
    `ㅤ${SYM.leaf}ㅤPara aceptar ⁙ ${inlineCmd('marry', '@usuario')} (mutuo)`,
    `ㅤ${SYM.leaf}ㅤExpira en ${num(minutes) || 5} minutos`,
    `ㅤ${RULE.sakura}`,
    `ㅤ${KAOMOJI.love}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function perfilWedding({ aName, bName, date, mentions = [] } = {}) {
  const tags = list(mentions).map(mentionOf).join(' ');
  return [
    `ㅤ✩.･:｡≻───── ⋆♡⋆ ─────.•:｡✩`,
    `ㅤㅤ¡Se han casado!`,
    '',
    `ㅤㅤ♡ ${str(aName)} ♡`,
    `ㅤㅤ♡ ${str(bName)} ♡`,
    '',
    `ㅤㅤ${str(date)}`,
    tags ? `ㅤ${tags}` : null,
    `ㅤDisfruten su luna de miel ☕`,
    `ㅤ✩.･:｡≻───── ⋆♡⋆ ─────.•:｡✩`,
    `ㅤ${KAOMOJI.hug}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function perfilDivorce({ aName, bName, since } = {}) {
  return [
    `${SYM.bracketL} ${SYM.chain} ${SYM.bracketR} ㅤ𝐷𝑖𝑣𝑜𝑟𝑐𝑖𝑜`,
    RULE.chain,
    `ㅤ${str(aName)} y ${str(bName)} terminaron su matrimonio.`,
    `ㅤ${SYM.leaf}ㅤJuntos desde ⁙ ${str(since)}`,
    RULE.chain,
    `ㅤ${KAOMOJI.sad}`,
  ].join('\n');
}

export function perfilHistory({ userName, entries, married, isSelf } = {}) {
  const rows = list(entries);
  const body = rows.length
    ? rows
        .map((row) => {
          const mark = row.active ? '💍' : '⛓️';
          const span = row.active ? `desde ${str(row.since)} · vigente` : `${str(row.since)} → ${str(row.until)}`;
          return `ㅤ${mark}ㅤ${str(row.partnerName)}ㅤ·ㅤ${span}`;
        })
        .join('\n')
    : 'ㅤSin matrimonios registrados todavía.';
  return [
    `${SYM.bracketL} ${SYM.scroll} ${SYM.bracketR} ㅤ𝐻𝑖𝑠𝑡𝑜𝑟𝑖𝑎𝑙 ㅤ·ㅤ ${str(userName)}`,
    RULE.dotted,
    body,
    RULE.dotted,
    kv('Estado', married ? 'casado/a 💍' : 'soltero/a ☕'),
    isSelf ? `ㅤCásate con ㅤ${inlineCmd('marry', '@usuario')}` : null,
    `ㅤ${KAOMOJI.neutral}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function perfilPfp({ userName, photoUrl, masked, isSelf } = {}) {
  const url = String(photoUrl ?? '').trim();
  return [
    `${SYM.bracketL} 🖼️ ${SYM.bracketR} ㅤ𝐹𝑜𝑡𝑜 ㅤ·ㅤ ${str(userName)}`,
    RULE.thin,
    url ? str(photoUrl) : `ㅤ${SYM.chain}ㅤ${isSelf ? 'No tienes' : 'No tiene'} foto de perfil visible o es privada.`,
    '',
    kv('Contacto', str(masked, '—')),
    RULE.thin,
    `ㅤ${KAOMOJI.wink}`,
  ].join('\n');
}

export function perfilField({ field, value, removed, userName } = {}) {
  const gone = Boolean(removed) && String(removed) !== 'false';
  return [
    `${SYM.bracketL} ✎ ${SYM.bracketR} ㅤ𝑃𝑒𝑟𝑓𝑖𝑙 ㅤ𝑎𝑐𝑡𝑢𝑎𝑙𝑖𝑧𝑎𝑑𝑜`,
    RULE.sakura,
    gone
      ? `ㅤ${SYM.leaf}ㅤSe eliminó tu ${str(field)}.`
      : `ㅤ${SYM.arrow}ㅤ${str(field, 'Campo')} ⁙ ${str(value)}`,
    `ㅤ${SYM.leaf}ㅤDe ⁙ ${str(userName)}`,
    RULE.sakura,
    `ㅤ${KAOMOJI.sparkle}`,
  ].join('\n');
}

/* ═══════════════════════════════════════════════════════════════
   STICKERS
   ═══════════════════════════════════════════════════════════════ */

export function stickerGuide({ userName, pack, author } = {}) {
  return [
    `${SYM.bracketL} ⭐ ${SYM.bracketR} ㅤ𝐶𝑟𝑒𝑎𝑟 ㅤ𝑠𝑡𝑖𝑐𝑘𝑒𝑟`,
    RULE.thin,
    `ㅤ${SYM.arrow}ㅤ${str(userName)}, responde a una imagen, video o sticker con:`,
    cmd('s', '[pack | autor]'),
    '',
    pack || author ? kv('Tus metadatos', `${str(pack, '—')} · ${str(author, '—')}`) : `ㅤGuarda tus metadatos con ㅤ${inlineCmd('setmeta', 'pack | autor')}`,
    RULE.thin,
    `ㅤ${KAOMOJI.happy}`,
  ].join('\n');
}

export function stickerBrat({ userName, banner, pack, author } = {}) {
  return [
    `${SYM.bracketL} 🟩 ${SYM.bracketR} ㅤ𝐵𝑅𝐴𝑇`,
    RULE.dotted,
    str(banner),
    RULE.dotted,
    pack || author ? kv('Firma', `${str(pack, '—')} · ${str(author, '—')}`) : null,
    `ㅤPedido por ⁙ ${str(userName)}`,
    `ㅤ${KAOMOJI.smug}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function stickerMeta({ userName, pack, author, cleared } = {}) {
  const gone = Boolean(cleared) && String(cleared) !== 'false';
  return [
    `${SYM.bracketL} 🏷️ ${SYM.bracketR} ㅤ𝑀𝑒𝑡𝑎𝑑𝑎𝑡𝑜𝑠`,
    RULE.thin,
    gone
      ? `ㅤ${SYM.leaf}ㅤ${str(userName)} eliminó sus metadatos de stickers.`
      : `ㅤ${SYM.arrow}ㅤGuardados para ${str(userName)}:`,
    gone ? null : kv('Pack', str(pack, '—')),
    gone ? null : kv('Autor', str(author, '—')),
    RULE.thin,
    `ㅤ${KAOMOJI.wink}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function stickerSearch({ query, url } = {}) {
  return [
    `${SYM.bracketL} 🔍 ${SYM.bracketR} ㅤ𝑆𝑡𝑖𝑐𝑘𝑒𝑟𝑠 ㅤ·ㅤ ${str(query)}`,
    RULE.thin,
    str(url),
    '',
    `ㅤ${SYM.leaf}ㅤDescarga el paquete en Sticker.ly y reenvíalo al chat.`,
    RULE.thin,
    `ㅤ${KAOMOJI.happy}`,
  ].join('\n');
}

/* ═══════════════════════════════════════════════════════════════
   HERRAMIENTAS
   ═══════════════════════════════════════════════════════════════ */

export function toolIa({ question, answer, mode, userName } = {}) {
  const badge = String(mode) === 'online' ? 'en línea' : String(mode) === 'local' ? 'local' : 'sin conexión';
  return [
    `${SYM.bracketL} 💐 ${SYM.bracketR} ㅤ𝐼𝐴 ㅤ·ㅤ ${badge}`,
    RULE.night,
    `ㅤ${SYM.scroll}ㅤ${str(userName)} ⁙ ${str(question)}`,
    '',
    str(answer),
    '',
    RULE.night,
    `ㅤ${KAOMOJI.cool}`,
  ].join('\n');
}

export function toolVer({ userName, excerpt } = {}) {
  return [
    `${SYM.bracketL} 👁️ ${SYM.bracketR} ㅤ𝑉𝑖𝑠𝑡𝑎 ㅤ𝑢́𝑛𝑖𝑐𝑎`,
    RULE.thin,
    `ㅤ${SYM.arrow}ㅤContenido citado por ${str(userName)}:`,
    '',
    str(excerpt, '(vacío)'),
    '',
    RULE.thin,
    `ㅤ${SYM.scroll}ㅤSolo puedo reabrir texto: las fotos y videos efímeros se ven una vez.`,
    `ㅤ${KAOMOJI.neutral}`,
  ].join('\n');
}

export function toolConvert({ kind, userName, steps } = {}) {
  const lines = list(steps);
  return [
    `${SYM.bracketL} 🔁 ${SYM.bracketR} ㅤ${str(kind, 'Conversión')}`,
    RULE.dotted,
    `ㅤ${SYM.arrow}ㅤ${str(userName)}, sigue estos pasos:`,
    ...lines.map((step, index) => `ㅤ${index + 1}.ㅤ${str(step)}`),
    RULE.dotted,
    `ㅤ${KAOMOJI.wink}`,
  ].join('\n');
}

/* ═══════════════════════════════════════════════════════════════
   LOGOS
   ═══════════════════════════════════════════════════════════════ */

export function logoCard({ title, emoji, text, userName } = {}) {
  return [
    `${SYM.bracketL} ${emoji ?? '🍰'} ${SYM.bracketR} ㅤ𝐿𝑜𝑔𝑜 ㅤ·ㅤ ${str(title)}`,
    RULE.sakura,
    `ㅤ◢◣ ㅤ${str(text)}`,
    '',
    `ㅤ${SYM.leaf}ㅤEfecto ⁙ ${str(title)}`,
    `ㅤ${SYM.leaf}ㅤPedido por ⁙ ${str(userName)}`,
    RULE.sakura,
    `ㅤ${SYM.scroll}ㅤGenera la imagen con este texto en tu editor favorito y presúmela.`,
    `ㅤ${KAOMOJI.sparkle}`,
  ].join('\n');
}

/* ═══════════════════════════════════════════════════════════════
   MODERACIÓN EXTRA
   ═══════════════════════════════════════════════════════════════ */

export function modPromote({ userName, adminName, mentions = [] } = {}) {
  const tags = list(mentions).map(mentionOf).join(' ');
  return [
    `ㅤ${SYM.bracketL} ⬆ ${SYM.bracketR} ㅤ𝑁𝑢𝑒𝑣𝑜 ㅤ𝑎𝑑𝑚𝑖𝑛`,
    `ㅤ${RULE.coffee}`,
    tags ? `ㅤ${tags}` : null,
    `ㅤ${SYM.chain}ㅤ${str(userName)} ahora es administrador del grupo.`,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${str(adminName)}`,
    `ㅤ${RULE.coffee}`,
    `ㅤ${KAOMOJI.cheer}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function modDemote({ userName, adminName, mentions = [] } = {}) {
  const tags = list(mentions).map(mentionOf).join(' ');
  return [
    `ㅤ${SYM.bracketL} ⬇ ${SYM.bracketR} ㅤ𝐴𝑑𝑚𝑖𝑛 ㅤ𝑟𝑒𝑡𝑖𝑟𝑎𝑑𝑜`,
    `ㅤ${RULE.chain}`,
    tags ? `ㅤ${tags}` : null,
    `ㅤ${SYM.chain}ㅤ${str(userName)} ya no es administrador del grupo.`,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${str(adminName)}`,
    `ㅤ${RULE.chain}`,
    `ㅤ${KAOMOJI.serious}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function modTagall({ authorName, text, total, shown, hidden, groupName, mentions = [] } = {}) {
  const rows = list(shown);
  const tags = list(mentions).map(mentionOf).join(' ');
  return [
    `*! ㅤ𝑀𝐸𝑁𝐶𝐼𝑂𝑁 ㅤ𝐺𝐸𝑁𝐸𝑅𝐴𝐿 ㅤ!*`,
    `ㅤ𝑃𝐴𝑅𝐴 ${num(total)} 𝑀𝐼𝐸𝑀𝐵𝑅𝑂𝑆 🗣️`,
    '',
    `ㅤ» Mensaje ⁙ ${str(text)}`,
    '',
    `╭ ┄ ${str(groupName)} ┄`,
    ...rows.map((row) => `ㅤ│ㅤ${str(row.mention)}ㅤ·ㅤ${str(row.name)}`),
    num(hidden) > 0 ? `ㅤ│ㅤ… y ${num(hidden)} más` : null,
    `╰ ┄ ${SYM.crownSmall} ${SYM.bracketR} ┄`,
    '',
    `ㅤPor ⁙ ${str(authorName)}`,
    tags ? `ㅤ${tags}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function modNotify({ authorName, text, total, groupName, mentions = [] } = {}) {
  const tags = list(mentions).map(mentionOf).join(' ');
  return [
    `ㅤㅤ${SYM.crown}`,
    `ㅤㅤ${SYM.bracketL} 📢 ${SYM.bracketR}`,
    `ㅤㅤ𝑁𝑂𝑇𝐼𝐹𝐼𝐶𝐴𝐶𝐼𝑂́𝑁`,
    `ㅤㅤ${str(groupName)}`,
    RULE.coffee,
    str(text),
    '',
    RULE.coffee,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${str(authorName)} · para ${num(total)} miembros`,
    tags ? `ㅤ${tags}` : null,
    `ㅤㅤ${SYM.crown}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function modRevoke({ link, groupName, adminName } = {}) {
  return [
    `${SYM.bracketL} 🔗 ${SYM.bracketR} ㅤ𝐸𝑛𝑙𝑎𝑐𝑒 ㅤ𝑟𝑒𝑛𝑜𝑣𝑎𝑑𝑜`,
    RULE.chain,
    `ㅤ${SYM.leaf}ㅤ${str(groupName)}`,
    '',
    str(link),
    '',
    `ㅤ${SYM.chain}ㅤEl enlace anterior ya no funciona.`,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${str(adminName)}`,
    RULE.chain,
    `ㅤ${KAOMOJI.cool}`,
  ].join('\n');
}

export function modMute({ userName, reason, adminName, mentions = [] } = {}) {
  const tags = list(mentions).map(mentionOf).join(' ');
  return [
    `${SYM.bracketL} 🔇 ${SYM.bracketR} ㅤ𝑈𝑠𝑢𝑎𝑟𝑖𝑜 ㅤ𝑠𝑖𝑙𝑒𝑛𝑐𝑖𝑎𝑑𝑜`,
    RULE.chain,
    tags ? `ㅤ${tags}` : null,
    `ㅤ${SYM.chain}ㅤ${str(userName)} fue silenciado: sus mensajes se borrarán.`,
    reason ? `ㅤ${SYM.leaf}ㅤMotivo ⁙ ${str(reason)}` : null,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${str(adminName)}`,
    RULE.chain,
    `ㅤ${KAOMOJI.serious}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function modUnmute({ userName, adminName, mentions = [] } = {}) {
  const tags = list(mentions).map(mentionOf).join(' ');
  return [
    `${SYM.bracketL} 🔊 ${SYM.bracketR} ㅤ𝑆𝑖𝑙𝑒𝑛𝑐𝑖𝑜 ㅤ𝑙𝑒𝑣𝑎𝑛𝑡𝑎𝑑𝑜`,
    RULE.wave,
    tags ? `ㅤ${tags}` : null,
    `ㅤ${SYM.arrow}ㅤ${str(userName)} puede escribir de nuevo.`,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${str(adminName)}`,
    RULE.wave,
    `ㅤ${KAOMOJI.cheer}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function modMutelist({ entries, total, groupName } = {}) {
  const rows = list(entries);
  return [
    `${SYM.bracketL} 🔇 ${SYM.bracketR} ㅤ𝑆𝑖𝑙𝑒𝑛𝑐𝑖𝑎𝑑𝑜𝑠 ㅤ·ㅤ ${str(groupName)}`,
    RULE.chain,
    ...(rows.length
      ? rows.slice(0, 20).map((row) => `ㅤ🔇ㅤ${str(row.name).padEnd(14, ' ')} ⁙ ${str(row.reason, 'sin motivo')}`)
      : ['ㅤNadie está silenciado.']),
    RULE.chain,
    kv('Silenciados', String(num(total) || rows.length)),
    `ㅤSilencia con ㅤ${inlineCmd('mute', '@usuario [motivo]')}`,
    `ㅤ${KAOMOJI.serious}`,
  ].join('\n');
}

export function modToggle({ feature, enabled, statusOnly, adminName, hint } = {}) {
  const on = Boolean(enabled) && String(enabled) !== 'false';
  const only = Boolean(statusOnly) && String(statusOnly) !== 'false';
  return [
    `${SYM.bracketL} ${on ? '✓' : '✗'} ${SYM.bracketR} ㅤ${str(feature, 'Opción')}`,
    RULE.dotted,
    only
      ? `ㅤ${SYM.leaf}ㅤEstado actual ⁙ *${on ? 'activado' : 'desactivado'}*`
      : `ㅤ${SYM.arrow}ㅤAhora está *${on ? 'activado' : 'desactivado'}*.`,
    !only && adminName ? `ㅤ${SYM.leaf}ㅤPor ⁙ ${str(adminName)}` : null,
    hint ? `ㅤ${SYM.scroll}ㅤ${str(hint)}` : null,
    RULE.dotted,
    `ㅤ${on ? KAOMOJI.wink : KAOMOJI.neutral}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function modSettext({ feature, text, statusOnly, adminName, hint } = {}) {
  const only = Boolean(statusOnly) && String(statusOnly) !== 'false';
  const current = String(text ?? '').trim();
  return [
    `${SYM.bracketL} ✎ ${SYM.bracketR} ㅤ${str(feature, 'Mensaje')}`,
    RULE.coffee,
    current ? `ㅤ${SYM.arrow}ㅤ${current}` : `ㅤ${SYM.leaf}ㅤTodavía no hay un mensaje personalizado.`,
    !only && adminName ? `ㅤ${SYM.leaf}ㅤGuardado por ⁙ ${str(adminName)}` : null,
    hint ? `ㅤ${SYM.scroll}ㅤ${str(hint)}` : null,
    `ㅤVariables ⁙ {user} {group} {prefix}`,
    RULE.coffee,
    `ㅤ${KAOMOJI.cozy}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/* ═══════════════════════════════════════════════════════════════
   SISTEMA · estado e identidad ( Raiden: status / id )
   ═══════════════════════════════════════════════════════════════ */

export function sysStatus({ botName, team, version, uptime, heapUsed, heapTotal, rss, memUsed, memTotal, memPercent, cpuCores, load, platform, node, pid, groups, users } = {}) {
  return [
    `「✦」Estado de *${str(botName)}*`,
    '',
    `❒ Equipo » ${str(team)} · v${str(version)}`,
    `❒ RAM » *${str(memUsed)}* / ${str(memTotal)} (${str(memPercent)}%)`,
    `❒ CPU (x${str(cpuCores)}) » *${str(load)}*`,
    `❒ Heap Node » *${str(heapUsed)}* / ${str(heapTotal)}`,
    `❒ RSS » *${str(rss)}*`,
    `❒ SO » ${str(platform)}`,
    `❒ Node.js » ${str(node)}`,
    `❒ Grupos » ${str(groups, '0')} · Fichas » ${str(users, '0')}`,
    `❒ Uptime » ${str(uptime)}`,
    `❒ PID » ${str(pid)}`,
    '',
    `> *${str(botName)} está funcionando correctamente*`,
    `ㅤ${KAOMOJI.cool}`,
  ].join('\n');
}

export function sysUserid({ pushName, jid, masked, isOwner, isAdmin, isRegistered, rankLabel } = {}) {
  const owner = Boolean(isOwner) && String(isOwner) !== 'false';
  const admin = Boolean(isAdmin) && String(isAdmin) !== 'false';
  const registered = Boolean(isRegistered) && String(isRegistered) !== 'false';
  return [
    `${SYM.bracketL} 🆔 ${SYM.bracketR} ㅤ𝐼𝑛𝑓𝑜𝑟𝑚𝑎𝑐𝑖𝑜́𝑛 ㅤ𝑑𝑒 ㅤ𝑢𝑠𝑢𝑎𝑟𝑖𝑜`,
    RULE.night,
    kv('Nombre', str(pushName)),
    kv('JID', `\`${str(jid)}\``),
    kv('Contacto', str(masked)),
    kv('Owner', owner ? 'sí 👑' : 'no'),
    kv('Admin', admin ? 'sí 🛡️' : 'no'),
    kv('Registrado', registered ? 'sí ✓' : 'no'),
    kv('Rango', str(rankLabel)),
    RULE.night,
    `ㅤ${KAOMOJI.neutral}`,
  ].join('\n');
}

export default {
  animeReact,
  ecoBalance, ecoTop, ecoEinfo, ecoResult, ecoDaily, ecoBet, ecoTransfer, ecoSteal, ecoBank,
  dlMusic, dlLink, dlLyrics,
  perfilProposal, perfilWedding, perfilDivorce, perfilHistory, perfilPfp, perfilField,
  stickerGuide, stickerBrat, stickerMeta, stickerSearch,
  toolIa, toolVer, toolConvert,
  logoCard,
  modPromote, modDemote, modTagall, modNotify, modRevoke, modMute, modUnmute, modMutelist, modToggle, modSettext,
  sysStatus, sysUserid,
};
