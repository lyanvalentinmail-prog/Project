/**
 * 𓆩 🌸 𓆪  VÉRSOVA · servicio de perfil extendido (paquete Raiden)
 * ────────────────────────────────────────────────────────────────
 * Matrimonios con propuesta y aceptación mutua, historial, foto de
 * perfil y datos extra (cumpleaños, descripción, género).
 */
import { usersRepo, marriageRepo, profileExtrasRepo, auditRepo } from '../db/index.js';
import { ok, fail } from './result.js';
import { resolveTarget, validateUserJid } from '../security/validation.js';
import { sanitizeText } from '../utils/text.js';
import { maskPhone } from '../utils/ids.js';
import { formatDate } from '../utils/time.js';

function displayName(ctx, jid) {
  if (!jid) return 'Alguien';
  if (jid === ctx.author.jid) return ctx.author.name;
  const row = usersRepo.get(ctx.group.groupId, jid);
  return row?.name ?? ctx.client?.contactName?.(jid) ?? maskPhone(jid);
}

/** Propuestas pendientes en memoria: targetJid -> { fromJid, at } por grupo. */
const proposals = new Map();
const PROPOSAL_TTL_MS = 5 * 60 * 1000;

function proposalKey(groupId, targetJid) {
  return `${groupId}‖${targetJid}`;
}

function getProposal(groupId, targetJid) {
  const entry = proposals.get(proposalKey(groupId, targetJid));
  if (!entry) return null;
  if (Date.now() - entry.at > PROPOSAL_TTL_MS) {
    proposals.delete(proposalKey(groupId, targetJid));
    return null;
  }
  return entry;
}

/* ═══════════════════════════════════════════════════════════════
   Matrimonio
   ═══════════════════════════════════════════════════════════════ */

export function marry(ctx, arg = null) {
  const groupId = ctx.group.groupId;
  const mine = marriageRepo.currentOf(groupId, ctx.author.jid);
  if (mine) {
    const partnerJid = mine.a_jid === ctx.author.jid ? mine.b_jid : mine.a_jid;
    return fail('sys.invalid', {
      command: 'marry',
      message: `Ya estás casado con ${displayName(ctx, partnerJid)}.`,
      hint: `Puedes divorciarte con ${ctx.prefix ?? '.'}divorce`,
    });
  }

  const resolved = resolveTarget(ctx, { arg, allowQuoted: true });
  if (!resolved.ok) {
    return fail('sys.invalid', {
      command: 'marry',
      message: 'Debes mencionar o responder al usuario con quien quieres casarte.',
      hint: `Ejemplo: ${ctx.prefix ?? '.'}marry @usuario`,
    });
  }
  const jid = validateUserJid(resolved.value);
  if (!jid.ok) return fail('sys.invalid', { command: 'marry', message: jid.reason });
  const targetJid = jid.value;

  if (targetJid === ctx.author.jid) {
    return fail('sys.invalid', { command: 'marry', message: 'No puedes casarte contigo mismo.' });
  }
  if (marriageRepo.currentOf(groupId, targetJid)) {
    return fail('sys.invalid', {
      command: 'marry',
      message: 'Esa persona ya está casada.',
    });
  }

  // ¿La otra persona ya me lo propuso? → boda inmediata.
  const reciprocal = getProposal(groupId, ctx.author.jid);
  if (reciprocal && reciprocal.fromJid === targetJid) {
    proposals.delete(proposalKey(groupId, ctx.author.jid));
    const wedding = marriageRepo.marry(groupId, ctx.author.jid, targetJid);
    auditRepo.log({
      instanceId: ctx.instance?.id ?? null,
      groupId,
      actorJid: ctx.author.jid,
      action: 'perfil.marry',
      targetJid,
      detail: { marriageId: wedding.id },
    });
    return ok('perfil.wedding', {
      aName: displayName(ctx, targetJid),
      bName: displayName(ctx, ctx.author.jid),
      date: formatDate(wedding.married_at),
      mentions: [targetJid, ctx.author.jid],
      command: 'marry',
    });
  }

  proposals.set(proposalKey(groupId, targetJid), { fromJid: ctx.author.jid, at: Date.now() });
  return ok('perfil.proposal', {
    fromName: ctx.author.name,
    toName: displayName(ctx, targetJid),
    minutes: Math.round(PROPOSAL_TTL_MS / 60000),
    mentions: [targetJid, ctx.author.jid],
    command: 'marry',
  });
}

export function divorce(ctx) {
  const groupId = ctx.group.groupId;
  const mine = marriageRepo.currentOf(groupId, ctx.author.jid);
  if (!mine) {
    return fail('sys.invalid', {
      command: 'divorce',
      message: 'No estás casado con nadie en este grupo.',
      hint: `Propón matrimonio con ${ctx.prefix ?? '.'}marry @usuario`,
    });
  }
  const partnerJid = mine.a_jid === ctx.author.jid ? mine.b_jid : mine.a_jid;
  marriageRepo.divorce(groupId, ctx.author.jid, partnerJid);
  auditRepo.log({
    instanceId: ctx.instance?.id ?? null,
    groupId,
    actorJid: ctx.author.jid,
    action: 'perfil.divorce',
    targetJid: partnerJid,
    detail: { marriageId: mine.id },
  });
  return ok('perfil.divorce', {
    aName: displayName(ctx, ctx.author.jid),
    bName: displayName(ctx, partnerJid),
    since: formatDate(mine.married_at),
    command: 'divorce',
  });
}

export function history(ctx, arg = null) {
  const groupId = ctx.group.groupId;
  let targetJid = ctx.author.jid;
  if (arg !== null || (ctx.mentions ?? []).length) {
    const resolved = resolveTarget(ctx, { arg, allowQuoted: true });
    if (!resolved.ok) return fail('sys.invalid', { command: 'history', message: resolved.reason });
    const jid = validateUserJid(resolved.value);
    if (!jid.ok) return fail('sys.invalid', { command: 'history', message: jid.reason });
    targetJid = jid.value;
  }
  const rows = marriageRepo.historyOf(groupId, targetJid, 10).map((m) => {
    const partnerJid = m.a_jid === targetJid ? m.b_jid : m.a_jid;
    return {
      partnerName: displayName(ctx, partnerJid),
      since: formatDate(m.married_at),
      until: m.divorced_at ? formatDate(m.divorced_at) : null,
      active: !m.divorced_at,
    };
  });
  const current = marriageRepo.currentOf(groupId, targetJid);
  return ok('perfil.history', {
    userName: displayName(ctx, targetJid),
    entries: rows,
    married: Boolean(current),
    isSelf: targetJid === ctx.author.jid,
    command: 'history',
  });
}

export async function pfp(ctx, arg = null) {
  let targetJid = ctx.author.jid;
  if (arg !== null || (ctx.mentions ?? []).length) {
    const resolved = resolveTarget(ctx, { arg, allowQuoted: true });
    if (!resolved.ok) return fail('sys.invalid', { command: 'pfp', message: resolved.reason });
    const jid = validateUserJid(resolved.value);
    if (!jid.ok) return fail('sys.invalid', { command: 'pfp', message: jid.reason });
    targetJid = jid.value;
  }
  let photoUrl = null;
  try {
    photoUrl = typeof ctx.client?.profilePictureUrl === 'function'
      ? await ctx.client.profilePictureUrl(targetJid).catch(() => null)
      : null;
  } catch {
    photoUrl = null;
  }
  return ok('perfil.pfp', {
    userName: displayName(ctx, targetJid),
    photoUrl,
    masked: maskPhone(targetJid),
    isSelf: targetJid === ctx.author.jid,
    command: 'pfp',
  });
}

/* ═══════════════════════════════════════════════════════════════
   Datos extra
   ═══════════════════════════════════════════════════════════════ */

const MONTHS = {
  january: 1, jan: 1, enero: 1, february: 2, feb: 2, febrero: 2, march: 3, mar: 3, marzo: 3,
  april: 4, apr: 4, abril: 4, may: 5, mayo: 5, june: 6, jun: 6, junio: 6,
  july: 7, jul: 7, julio: 7, august: 8, aug: 8, agosto: 8, september: 9, sep: 9, septiembre: 9,
  october: 10, oct: 10, octubre: 10, november: 11, nov: 11, noviembre: 11,
  december: 12, dec: 12, diciembre: 12,
};
const MONTH_NAMES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function birthHelp(ctx) {
  return fail('sys.invalid', {
    command: 'setbirth',
    message: 'Indica tu cumpleaños en formato mes/día (año opcional).',
    hint: `Ejemplos: ${ctx.prefix ?? '.'}setbirth 12/25 · ${ctx.prefix ?? '.'}setbirth 12/25/2000 · ${ctx.prefix ?? '.'}setbirth 25 diciembre`,
  });
}

export function setBirth(ctx, raw = null) {
  const text = sanitizeText(raw, 40);
  if (!text) return birthHelp(ctx);

  let day = null;
  let month = null;
  let year = null;
  const numeric = text.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/);
  if (numeric) {
    month = Number(numeric[1]);
    day = Number(numeric[2]);
    year = numeric[3] ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]) : null;
  } else {
    const words = text.toLowerCase().split(/[\s,/\-.]+/).filter(Boolean);
    for (const word of words) {
      if (MONTHS[word]) month = MONTHS[word];
      else if (/^\d{1,2}$/.test(word) && day === null) day = Number(word);
      else if (/^\d{4}$/.test(word)) year = Number(word);
    }
  }
  if (!day || !month || day < 1 || day > 31 || month < 1 || month > 12) return birthHelp(ctx);
  if (year && (year < 1900 || year > new Date().getFullYear())) return birthHelp(ctx);

  const label = year ? `${day} de ${MONTH_NAMES[month]} de ${year}` : `${day} de ${MONTH_NAMES[month]}`;
  profileExtrasRepo.set(ctx.group.groupId, ctx.author.jid, { birth: label });
  return ok('perfil.field', {
    field: 'cumpleaños',
    value: label,
    userName: ctx.author.name,
    command: 'setbirth',
  });
}

export function setDesc(ctx, raw = null) {
  const text = sanitizeText(raw, 180);
  if (!text) {
    const current = profileExtrasRepo.get(ctx.group.groupId, ctx.author.jid);
    if (current?.desc) {
      profileExtrasRepo.set(ctx.group.groupId, ctx.author.jid, { desc: '' });
      return ok('perfil.field', {
        field: 'descripción',
        value: null,
        removed: true,
        userName: ctx.author.name,
        command: 'setdesc',
      });
    }
    return fail('sys.invalid', {
      command: 'setdesc',
      message: 'Escribe el texto de tu descripción (máx. 180 caracteres).',
      hint: `Ejemplo: ${ctx.prefix ?? '.'}setdesc Amante del rol nocturno`,
    });
  }
  const withName = text.replace(/\{name\}/gi, ctx.author.name);
  profileExtrasRepo.set(ctx.group.groupId, ctx.author.jid, { desc: withName });
  return ok('perfil.field', {
    field: 'descripción',
    value: withName,
    userName: ctx.author.name,
    command: 'setdesc',
  });
}

const GENRES = ['hombre', 'mujer', 'otro'];

export function setGenre(ctx, raw = null) {
  const value = sanitizeText(raw, 16).toLowerCase();
  if (!GENRES.includes(value)) {
    return fail('sys.invalid', {
      command: 'setgenre',
      message: 'Género no válido. Usa: hombre, mujer u otro.',
      hint: `Ejemplo: ${ctx.prefix ?? '.'}setgenre mujer`,
    });
  }
  profileExtrasRepo.set(ctx.group.groupId, ctx.author.jid, { genre: value });
  const label = value.charAt(0).toUpperCase() + value.slice(1);
  return ok('perfil.field', {
    field: 'género',
    value: label,
    userName: ctx.author.name,
    command: 'setgenre',
  });
}

export default { marry, divorce, history, pfp, setBirth, setDesc, setGenre };
