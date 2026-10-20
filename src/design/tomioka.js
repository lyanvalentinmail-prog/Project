/**
 * 𓆩 🌊 𓆪  VÉRSOVA · plantillas Tomioka (el bot del agua)
 * ────────────────────────────────────────────────────────────────
 * Variante acuática de TODAS las vistas de mensajes: mismos datos
 * que las plantillas clásicas, con la marca, reglas y kaomojis de
 * Tomioka. `render()` elige esta tabla cuando el bot usa el estilo
 * `tomioka` (ver context.js → setRenderStyle).
 *
 * Fuera de esta tabla: `mod.warn` (ya ramifica en templates.js con
 * su formato propio) y `menu.*` (los menús van por menu-styles.js).
 */
import { SYM, RULE, KAOMOJI, kv, bullet, cmd, inlineCmd, bar, mention, currentPrefix } from './theme.js';
import { formatDate, formatDateLong, formatDateTime, formatDuration, timeAgo } from '../utils/time.js';
import { maskPhone } from '../utils/ids.js';

const P = { toString: () => currentPrefix() };
const BRAND = '@𝐓͠ᨵ꯭꯭ׁׅׅ𝐌𝐈𖣠꙰𝐊𝐀';
const WR = '🌊┈┈┈┈┈┈┈┈┈┈┈┈🌊'; // regla del agua (seria)
const BR = '🫧┈┈┈┈┈┈┈┈┈┈┈┈🫧'; // burbujas (suave)
const CROWN = '࿙ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ׄ࿚';
const head = (emoji, title) => `${SYM.bracketL} ${emoji} ${SYM.bracketR} ㅤ${title}`;
const bigHead = (title) => [`ㅤ⌞ㅤ≪⁹⁹ㅤ⁙ㅤ${BRAND}ㅤ◌`, `ㅤㅤㅤ𓆩 💧 𓆪`, `ㅤㅤ${title}`];
const sign = () => `ㅤ࿙💧࿚ㅤ${BRAND}`;
const join = (lines) => lines.filter(Boolean).join('\n');
const str = (value, fallback = '—') => {
  const text = String(value ?? '').trim();
  return text ? text : fallback;
};
const num = (value) => Number(value) || 0;
const listOf = (value) => (Array.isArray(value) ? value : []);
const isTrue = (value) => Boolean(value) && String(value) !== 'false' && value !== 0 && value !== '0';
const tags = (mentions) => listOf(mentions).map((jid) => mention(jid)).join(' ');
const time2 = (ts) => {
  const d = new Date(Number(ts));
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/* ═══════════════════════════════════════════════════════════════
   ① REGISTRO
   ═══════════════════════════════════════════════════════════════ */

export function tRegSuccess({ name, age, phone, date, total, groupName }) {
  return join([
    `ㅤ${SYM.bracketL} 💧 ${SYM.bracketR} ㅤ𝑅𝑒𝑔𝑖𝑠𝑡𝑟𝑜 ㅤ𝑒𝑥𝑖𝑡𝑜𝑠𝑜`,
    BR,
    `ㅤ${SYM.arrow}ㅤBienvenida al team, ㅤ${KAOMOJI.wink}`,
    '',
    kv('Nombre', name),
    kv('Edad', `${age} años`),
    kv('Número', maskPhone(phone)),
    kv('Grupo', groupName),
    kv('Fecha', formatDate(date)),
    kv('Miembro №', `${total}`),
    '',
    `ㅤ${SYM.scroll}ㅤTu personaje está libre. Pídelo con:`,
    cmd('rol', '<personaje>'),
    BR,
    `ㅤ( ᵕ ᴗ ᵕ )♡`,
    sign(),
  ]);
}

export function tRegRejected({ reason, hint = null }) {
  return join([
    `${SYM.bracketL} ✗ ${SYM.bracketR} ㅤ𝑅𝑒𝑔𝑖𝑠𝑡𝑟𝑜 ㅤ𝑟𝑒𝑐ℎ𝑎𝑧𝑎𝑑𝑜`,
    WR,
    `ㅤ🌊ㅤ${reason}`,
    hint ? `ㅤ${SYM.leaf}ㅤ${hint}` : null,
    '',
    `ㅤFormato válido:`,
    cmd('reg', '<nombre.edad>'),
    `ㅤEjemplo: ㅤ${inlineCmd('reg', 'Moon.17')}`,
    WR,
    `ㅤ${KAOMOJI.sad}`,
  ]);
}

export function tRegDuplicate({ name, since }) {
  return join([
    `𓆩 🌀 𓆪 ㅤ𝒀𝒂 ㅤ𝒆𝒔𝒕𝒂́𝒔 ㅤ𝒓𝒆𝒈𝒊𝒔𝒕𝒓𝒂𝒅𝒐`,
    BR,
    `ㅤ${SYM.leaf}ㅤ${name} ya tiene ficha en este grupo.`,
    `ㅤ${SYM.leaf}ㅤRegistrado ${timeAgo(since)}.`,
    '',
    `ㅤ¿Quieres corregir tus datos?`,
    cmd('editar', '<nombre.edad>'),
    `ㅤ¿Prefieres empezar de cero?`,
    cmd('unreg'),
    BR,
    `ㅤ${KAOMOJI.smug}`,
  ]);
}

export function tEditSuccess({ before, after }) {
  return join([
    head('✎', '𝐹𝑖𝑐ℎ𝑎 ㅤ𝑎𝑐𝑡𝑢𝑎𝑙𝑖𝑧𝑎𝑑𝑎'),
    BR,
    `ㅤ${SYM.arrow}ㅤAntes ⁙ ${before?.name} · ${before?.age} años`,
    `ㅤ${SYM.arrow}ㅤAhora ⁙ ${after?.name} · ${after?.age} años`,
    '',
    `ㅤ${SYM.leaf}ㅤTu personaje no se modificó: ${after?.role ?? 'ninguno'}`,
    BR,
    `ㅤ(˶ᵔ ᵕ ᵔ˶)`,
  ]);
}

export function tUnregAsk({ name, role, couple, ttl = 60 }) {
  return join([
    head('🌊', '𝐶𝑜𝑛𝑓𝑖𝑟𝑚𝑎 ㅤ𝑡𝑢 ㅤ𝑠𝑎𝑙𝑖𝑑𝑎'),
    WR,
    `ㅤ🌊ㅤVas a borrar la ficha de ㅤ${name}.`,
    role ? `ㅤ${SYM.leaf}ㅤSe liberará tu personaje: ㅤ${role}` : null,
    couple ? `ㅤ${SYM.leaf}ㅤSe terminará tu relación con: ㅤ${couple}` : null,
    `ㅤ${SYM.leaf}ㅤSe cancelarán tus reservas y solicitudes.`,
    '',
    `ㅤPara confirmar ⁙ ${inlineCmd('confirmar')}`,
    `ㅤPara cancelar ⁙ㅤ ${inlineCmd('cancelar')}`,
    `ㅤExpira en ${ttl} segundos. ㅤ${KAOMOJI.serious}`,
    WR,
  ]);
}

export function tUnregSuccess({ name, role, couple, requests, reservation }) {
  return join([
    `𓆩 ☾ 𓆪 ㅤ𝑅𝑒𝑔𝑖𝑠𝑡𝑟𝑜 ㅤ𝑒𝑙𝑖𝑚𝑖𝑛𝑎𝑑𝑜`,
    RULE.night,
    `ㅤ${SYM.leaf}ㅤFicha borrada ⁙ ${name}`,
    role ? `ㅤ${SYM.leaf}ㅤPersonaje liberado ⁙ ${role}` : null,
    reservation ? `ㅤ${SYM.leaf}ㅤReserva cancelada ⁙ ${reservation}` : null,
    couple ? `ㅤ${SYM.leaf}ㅤRelación terminada ⁙ ${couple}` : null,
    requests ? `ㅤ${SYM.leaf}ㅤSolicitudes canceladas ⁙ ${requests}` : null,
    '',
    `ㅤCuando quieras volver: ㅤ${inlineCmd('reg', '<nombre.edad>')}`,
    RULE.night,
    `ㅤ( ᴗ͈ˬᴗ͈)ㅤ⁙`,
  ]);
}

/* ═══════════════════════════════════════════════════════════════
   ② FICHAS Y PERFILES
   ═══════════════════════════════════════════════════════════════ */

export function tCard({ name, age, role, roleSince, registeredAt, status, warns, maxWarns, afk, partner, phone, lastActivity, reserved }) {
  const statusLabel = { active: 'ᴏɴʟɪɴᴇ', left: 'ꜰᴜᴇʀᴀ ᴅᴇʟ ɢʀᴜᴘᴏ', kicked: 'ᴇxᴘᴜʟsᴀᴅᴏ', banned: 'ʙʟᴏqᴜᴇᴀᴅᴏ' }[status] ?? status;
  return join([
    `ㅤ╭─────── ${SYM.bracketL} 💧 ${SYM.bracketR} ───────╮`,
    `ㅤ│ㅤ𝐅𝐈𝐂𝐇𝐀 ㅤ·ㅤ ${name}`,
    `ㅤ├${'─'.repeat(26)}`,
    `ㅤ│ㅤ${SYM.leaf} Nombre ㅤ⁙ㅤ ${name}`,
    `ㅤ│ㅤ${SYM.leaf} Edad ㅤㅤ⁙ㅤ ${age} años`,
    `ㅤ│ㅤ${SYM.leaf} Número ㅤ⁙ㅤ ${maskPhone(phone)}`,
    `ㅤ│ㅤ${SYM.leaf} Rol ㅤㅤㅤ⁙ㅤ ${role ?? '✧ sin personaje'}`,
    roleSince ? `ㅤ│ㅤ${SYM.leaf} Desde ㅤㅤ⁙ㅤ ${formatDate(roleSince)}` : null,
    reserved ? `ㅤ│ㅤ${SYM.leaf} Reserva ⁙ㅤ ${reserved} (${formatDuration(reserved)} restantes)` : null,
    `ㅤ│ㅤ${SYM.leaf} Alta ㅤㅤㅤ⁙ㅤ ${formatDate(registeredAt)}`,
    `ㅤ│ㅤ${SYM.leaf} Actividad ⁙ㅤ ${timeAgo(lastActivity)}`,
    `ㅤ│ㅤ${SYM.leaf} Estado ㅤ⁙ㅤ ${statusLabel}`,
    afk ? `ㅤ│ㅤ${SYM.leaf} AFK ㅤㅤㅤ⁙ㅤ ${afk.reason} (${timeAgo(afk.since)})` : null,
    partner ? `ㅤ│ㅤ${SYM.leaf} Pareja ㅤ⁙ㅤ ${SYM.heart} ${partner}` : null,
    `ㅤ│ㅤ${SYM.leaf} Warns ㅤㅤ⁙ㅤ ${warns}/${maxWarns} ㅤ${bar(warns, maxWarns, '💧', '·')}`,
    `ㅤ╰─────── ${SYM.bracketL} 🌊 ${SYM.bracketR} ───────╯`,
    `ㅤㅤ(˶ᵔ ᵕ ᵔ˶)`,
  ]);
}

export function tProfileCard({ name, age, role, registeredAt, partner, afk, phone, warns, isSelf }) {
  return join([
    head('🫧', `𝑃𝑒𝑟𝑓𝑖𝑙 ㅤ𝑑𝑒 ㅤ${name}`),
    RULE.wave,
    kv('Nombre', name),
    kv('Edad', `${age} años`),
    kv('Personaje', role ? `🌊 ${role}` : 'sin asignar'),
    kv('Registro', formatDateLong(registeredAt)),
    kv('Pareja', partner ? `${SYM.heart} ${partner}` : 'soltero/a 💧'),
    kv('Estado', afk ? `${SYM.moon} AFK · ${afk.reason}` : 'activo/a'),
    kv('Warns', String(warns)),
    kv('Contacto', maskPhone(phone)),
    RULE.wave,
    `ㅤ${isSelf ? 'Este eres tú ' : 'Ficha pública '}( ᵕ ᴗ ᵕ )`,
  ]);
}

export function tNotRegistered({ command = null, name = null } = {}) {
  return join([
    head('✗', `𝑁𝑜 ㅤ𝑒𝑠𝑡𝑎́𝑠 ㅤ𝑟𝑒𝑔𝑖𝑠𝑡𝑟𝑎𝑑${name ? ` (${name})` : 'o/a'}`),
    BR,
    command ? `ㅤ🌊ㅤ${command} requiere ficha en el team.` : null,
    `ㅤ${SYM.scroll}ㅤRegístrate primero:`,
    cmd('reg', '<nombre.edad>'),
    `ㅤEjemplo: ㅤ${inlineCmd('reg', 'Moon.17')}`,
    BR,
    `ㅤ${KAOMOJI.serious}`,
  ]);
}

/* ═══════════════════════════════════════════════════════════════
   ③ PERSONAJES / ROLES
   ═══════════════════════════════════════════════════════════════ */

export function tRoleRequestCreated({ roleName, requestId, admins, type = 'role', prevRole = null }) {
  const title = type === 'role_change' ? '𝑆𝑜𝑙𝑖𝑐𝑖𝑡𝑢𝑑 ㅤ𝑑𝑒 ㅤ𝑐𝑎𝑚𝑏𝑖𝑜' : '𝑆𝑜𝑙𝑖𝑐𝑖𝑡𝑢𝑑 ㅤ𝑝𝑒𝑛𝑑𝑖𝑒𝑛𝑡𝑒';
  return join([
    `ㅤㅤ⏳ ㅤ${title}`,
    BR,
    `ㅤ${SYM.leaf}ㅤPersonaje ⁙ 🌊 ${roleName}`,
    prevRole ? `ㅤ${SYM.leaf}ㅤDejas ㅤㅤ⁙ ${prevRole}` : null,
    `ㅤ${SYM.leaf}ㅤFolio ㅤㅤ⁙ #${requestId}`,
    `ㅤ${SYM.leaf}ㅤEstado ㅤ⁙ ᴘᴇɴᴅɪᴇɴᴛᴇ`,
    '',
    `ㅤ${SYM.scroll}ㅤSe avisó a ${admins} admin${admins === 1 ? '' : 's'} del grupo.`,
    `ㅤEspera su respuesta ㅤ${KAOMOJI.shy}`,
    BR,
    `ㅤPuedes anularla con ㅤ${inlineCmd('cancelarsolicitud')}`,
  ]);
}

export function tAdminRoleNotify({ requestId, userName, userMention, roleName, type, prevRole, adminMentions }) {
  return join([
    head('🌊', `𝑁𝑢𝑒𝑣𝑎 ㅤ𝑠𝑜𝑙𝑖𝑐𝑖𝑡𝑢𝑑 ㅤ#${requestId}`),
    WR,
    `ㅤ${SYM.leaf}ㅤTipo ㅤㅤㅤ⁙ ${type === 'role_change' ? 'cambio de personaje' : 'asignación de personaje'}`,
    `ㅤ${SYM.leaf}ㅤQuien ㅤㅤ⁙ ${userName} ${userMention}`,
    `ㅤ${SYM.leaf}ㅤPide ㅤㅤㅤ⁙ 🌊 ${roleName}`,
    prevRole ? `ㅤ${SYM.leaf}ㅤLibera ㅤㅤ⁙ ${prevRole}` : null,
    WR,
    `ㅤPara aprobar ⁙ ${inlineCmd('acceptrol', `#${requestId}`)}`,
    `ㅤPara rechazar ⁙ ${inlineCmd('denyrol', `#${requestId}`)}`,
    `ㅤTambién funciona respondiendo a este mensaje.`,
    '',
    `ㅤ${listOf(adminMentions).join(' ')}`,
  ]);
}

export function tRoleAssigned({ roleName, userName, approvedBy, type, prevRole, mentions = [] }) {
  return join([
    `ㅤ${SYM.bracketL} 🌊 ${SYM.bracketR} ㅤ𝑃𝑒𝑟𝑠𝑜𝑛𝑎𝑗𝑒 ㅤ𝑎𝑠𝑖𝑔𝑛𝑎𝑑𝑜`,
    `ㅤ${RULE.wave}`,
    `ㅤ${SYM.arrow}ㅤ${userName} ahora interpreta a:`,
    `ㅤㅤ◢🌊◣ ㅤ${roleName}`,
    prevRole ? `ㅤ${SYM.leaf}ㅤPersonaje liberado ⁙ ${prevRole}` : null,
    `ㅤ${SYM.leaf}ㅤAprobado por ⁙ ${approvedBy}`,
    `ㅤ${RULE.wave}`,
    `ㅤ${tags(mentions) ? `${tags(mentions)}ㅤ` : ''}(˶˃ ᵕ ˂˶)`,
  ]);
}

export function tRoleOccupied({ roleName, ownerName, since, reserved = false, until = null }) {
  return join([
    head('⛔', '𝑃𝑒𝑟𝑠𝑜𝑛𝑎𝑗𝑒 ㅤ𝑜𝑐𝑢𝑝𝑎𝑑𝑜'),
    WR,
    `ㅤ🌊ㅤ${roleName} ya tiene dueño/a.`,
    `ㅤ${SYM.leaf}ㅤLo interpreta ⁙ ${ownerName}`,
    reserved
      ? `ㅤ${SYM.leaf}ㅤReservado hasta ⁙ ${formatDateTime(until)} (${formatDuration(until - Date.now())})`
      : `ㅤ${SYM.leaf}ㅤDesde ⁙ ${formatDate(since)}`,
    '',
    `ㅤElige otro personaje libre con ㅤ${inlineCmd('rol', '<personaje>')}`,
    WR,
    `ㅤ${KAOMOJI.sad}`,
  ]);
}

export function tRoleReleased({ roleName, byAdmin = false, adminName = null, userName = null }) {
  return join([
    head('💧', '𝑃𝑒𝑟𝑠𝑜𝑛𝑎𝑗𝑒 ㅤ𝑙𝑖𝑏𝑒𝑟𝑎𝑑𝑜'),
    RULE.wave,
    `ㅤ${SYM.leaf}ㅤ🌊 ${roleName} vuelve a estar disponible.`,
    byAdmin ? `ㅤ${SYM.leaf}ㅤLiberado por ${adminName} (reset de rol)` : null,
    userName ? `ㅤ${SYM.leaf}ㅤAntes lo interpretaba ⁙ ${userName}` : null,
    `ㅤ${SYM.leaf}ㅤCualquiera puede pedirlo con ㅤ${inlineCmd('rol', roleName)}`,
    RULE.wave,
    `ㅤ( ᵕ ᴗ ᵕ )`,
  ]);
}

export function tRoleRequestRejected({ roleName, reason, rejectedBy, keptRole = null }) {
  return join([
    head('✗', '𝑆𝑜𝑙𝑖𝑐𝑖𝑡𝑢𝑑 ㅤ𝑟𝑒𝑐ℎ𝑎𝑧𝑎𝑑𝑎'),
    WR,
    `ㅤ🌊ㅤ${roleName} no te fue asignado.`,
    `ㅤ${SYM.leaf}ㅤMotivo ⁙ ${reason ?? 'sin especificar'}`,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${rejectedBy}`,
    keptRole ? `ㅤ${SYM.leaf}ㅤConservas tu personaje ⁙ ${keptRole}` : null,
    WR,
    `ㅤ${KAOMOJI.serious}`,
  ]);
}

export function tRolesList({ roles, reserved, total, free, groupName }) {
  const taken = listOf(roles);
  const reservedList = listOf(reserved);
  const takenBlock = taken.length
    ? taken.map((r, i) => `ㅤ${String(i + 1).padStart(2, '0')} 🌊 ${String(r?.name ?? '—').padEnd(14, ' ')} ⁙ ${r?.owner_name ?? '—'}`).join('\n')
    : 'ㅤTodavía nadie interpreta un personaje.';
  const reservedBlock = reservedList.length
    ? reservedList.map((r) => `ㅤ⏳ ${r?.name} ⁙ ${r?.reserved_name ?? '—'} · ${formatDuration((r?.reserved_until ?? 0) - Date.now())}`).join('\n')
    : null;
  return join([
    head('🌊', '𝑃𝑒𝑟𝑠𝑜𝑛𝑎𝑗𝑒𝑠 ㅤ𝑜𝑐𝑢𝑝𝑎𝑑𝑜𝑠'),
    `ㅤ${groupName}`,
    BR,
    takenBlock,
    reservedBlock ? [BR, 'ㅤReservas activas', reservedBlock].join('\n') : null,
    BR,
    kv('Ocupados', String(total)),
    kv('Libres', String(free)),
    kv('Reservados', String(reservedList.length)),
    `ㅤ( ੭ ˙ᗜ˙ )੭`,
  ]);
}

export function tMyRole({ name, roleName, since, reserved }) {
  if (!roleName) {
    return join([
      head(SYM.moon, '𝑆𝑖𝑛 ㅤ𝑝𝑒𝑟𝑠𝑜𝑛𝑎𝑗𝑒'),
      RULE.night,
      `ㅤ${name}, todavía no interpretas a nadie.`,
      `ㅤPide uno con ㅤ${inlineCmd('rol', '<personaje>')}`,
      `ㅤO reserva uno 24 h con ㅤ${inlineCmd('reservar', '<personaje>')}`,
      RULE.night,
      `ㅤ${KAOMOJI.shy}`,
    ]);
  }
  return join([
    head('🌊', '𝑇𝑢 ㅤ𝑝𝑒𝑟𝑠𝑜𝑛𝑎𝑗𝑒'),
    RULE.wave,
    `ㅤ${SYM.arrow}ㅤ${name} ⁙ ${roleName}`,
    since ? `ㅤ${SYM.leaf}ㅤAsignado ${timeAgo(since)}` : null,
    reserved ? `ㅤ${SYM.leaf}ㅤReserva de ${reserved.name} hasta ${formatDateTime(reserved.until)} (${formatDuration(reserved.until - Date.now())})` : null,
    RULE.wave,
    `ㅤPara soltarlo ⁙ ${inlineCmd('liberar')}`,
    `ㅤ(˶˃ ᵕ ˂˶)`,
  ]);
}

export function tReserveSuccess({ roleName, until, hours, userName }) {
  return join([
    head('⏳', '𝑅𝑒𝑠𝑒𝑟𝑣𝑎 ㅤ𝑐𝑜𝑛𝑓𝑖𝑟𝑚𝑎𝑑𝑎'),
    BR,
    `ㅤ${SYM.leaf}ㅤPersonaje ⁙ 🌊 ${roleName}`,
    `ㅤ${SYM.leaf}ㅤReserva ㅤ⁙ ${userName}`,
    `ㅤ${SYM.leaf}ㅤVence ㅤㅤ⁙ ${formatDateTime(until)}`,
    `ㅤ${SYM.leaf}ㅤDuración ⁙ ${hours} h`,
    `ㅤ${SYM.leaf}ㅤRestante ⁙ ${formatDuration(until - Date.now())}`,
    '',
    `ㅤCuando venza se libera automáticamente.`,
    `ㅤHazlo tuyo con ㅤ${inlineCmd('rol', roleName)}`,
    BR,
    `ㅤ${KAOMOJI.smug}`,
  ]);
}

export function tReserveRejected({ reason, roleName = null }) {
  return join([
    head('✗', '𝑅𝑒𝑠𝑒𝑟𝑣𝑎 ㅤ𝑟𝑒𝑐ℎ𝑎𝑧𝑎𝑑𝑎'),
    WR,
    roleName ? `ㅤ🌊ㅤ${roleName}: ${reason}` : `ㅤ🌊ㅤ${reason}`,
    WR,
    `ㅤ${KAOMOJI.sad}`,
  ]);
}

export function tReservationsList({ list, groupName }) {
  const rows = listOf(list);
  if (!rows.length) {
    return join([
      head('⏳', '𝑆𝑖𝑛 ㅤ𝑟𝑒𝑠𝑒𝑟𝑣𝑎𝑠'),
      BR,
      `ㅤNo hay personajes reservados en ${groupName}.`,
      `ㅤReserva uno con ㅤ${inlineCmd('reservar', '<personaje>')}`,
      BR,
    ]);
  }
  return join([
    head('⏳', '𝑅𝑒𝑠𝑒𝑟𝑣𝑎𝑠 ㅤ𝑎𝑐𝑡𝑖𝑣𝑎𝑠'),
    BR,
    ...rows.map((r) => `ㅤ⏳ ${String(r?.name ?? '—').padEnd(14, ' ')} ⁙ ${r?.reserved_name ?? '—'}ㅤ·ㅤ${formatDuration((r?.reserved_until ?? 0) - Date.now())}`),
    BR,
    kv('Total', String(rows.length)),
    `ㅤ${KAOMOJI.neutral}`,
  ]);
}

export function tPendingList({ requests, isAdmin }) {
  const rows = listOf(requests);
  if (!rows.length) {
    return join([
      head('⏳', '𝑁𝑎𝑑𝑎 ㅤ𝑝𝑒𝑛𝑑𝑖𝑒𝑛𝑡𝑒'),
      BR,
      `ㅤNo hay solicitudes en espera.`,
      BR,
      `ㅤ( ੭ ˙ᗜ˙ )੭`,
    ]);
  }
  const labels = { role: 'rol', role_change: 'cambio', couple: 'pareja' };
  return join([
    head('⏳', '𝑆𝑜𝑙𝑖𝑐𝑖𝑡𝑢𝑑𝑒𝑠 ㅤ𝑝𝑒𝑛𝑑𝑖𝑒𝑛𝑡𝑒𝑠'),
    BR,
    ...rows.map((r) => `ㅤ#${String(r?.id ?? '').padEnd(4, ' ')} ${labels[r?.type] ?? r?.type} ⁙ ${r?.user_name ?? '—'} → ${r?.role_name ?? r?.target_name ?? '—'}ㅤ·ㅤ${timeAgo(r?.created_at)}`),
    BR,
    kv('Total', String(rows.length)),
    isAdmin ? `ㅤAprueba con ㅤ${inlineCmd('acceptrol', '#id')} ㅤo responde al mensaje.` : null,
    `ㅤ${KAOMOJI.serious}`,
  ]);
}

/* ═══════════════════════════════════════════════════════════════
   ④ GESTIÓN DEL TEAM
   ═══════════════════════════════════════════════════════════════ */

export function tTeamInfo({ name, groupName, createdAt, members, registered, rolesTaken, rolesTotal, admins, couples, afk, instance, version }) {
  return join([
    ...bigHead(`𓆩 💧 𓆪 ㅤ𝐼𝑛𝑓𝑜 ㅤ𝑑𝑒𝑙 ㅤ𝑡𝑒𝑎𝑚`),
    BR,
    kv('Team', name),
    kv('Grupo', groupName),
    kv('Creado', createdAt ? formatDateLong(createdAt) : '—'),
    kv('Integrantes', `${members} en el grupo`),
    kv('Registrados', `${registered} con ficha`),
    kv('Personajes', `${rolesTaken} ocupados · ${rolesTotal - rolesTaken} libres`),
    kv('Admins', String(admins)),
    kv('Parejas', String(couples)),
    kv('AFK ahora', String(afk)),
    BR,
    kv('Bot', `${instance} · v${version}`),
    `ㅤㅤ(˶ᵔ ᵕ ᵔ˶) .ᐟ`,
    sign(),
  ]);
}

export function tMembersList({ members, total, groupName, max = 40 }) {
  const rows = listOf(members);
  if (!rows.length) {
    return join([
      head(SYM.leaf, '𝑆𝑖𝑛 ㅤ𝑟𝑒𝑔𝑖𝑠𝑡𝑟𝑜𝑠'),
      BR,
      `ㅤNadie se ha registrado todavía en ${groupName}.`,
      `ㅤEmpieza tú: ㅤ${inlineCmd('reg', '<nombre.edad>')}`,
      BR,
      `ㅤ${KAOMOJI.wink}`,
    ]);
  }
  const shown = rows.slice(0, max);
  return join([
    head(SYM.leaf, '𝐼𝑛𝑡𝑒𝑔𝑟𝑎𝑛𝑡𝑒𝑠 ㅤ𝑑𝑒𝑙 ㅤ𝑡𝑒𝑎𝑚'),
    `ㅤ${groupName}`,
    BR,
    ...shown.map((m, i) => {
      const idx = String(i + 1).padStart(2, '0');
      const role = m?.role_name ? `🌊 ${m.role_name}` : '· sin rol';
      const afkMark = m?.afk_reason ? ` ${SYM.moon}` : '';
      return `ㅤ${idx} ⁙ ${String(m?.name ?? '—').padEnd(12, ' ')} ${role}${afkMark}`;
    }),
    total > shown.length ? `ㅤ… y ${total - shown.length} más` : null,
    BR,
    kv('Registrados', String(total)),
    `ㅤ${KAOMOJI.hug}`,
  ]);
}

export function tAfkSet({ name, reason, since }) {
  return join([
    head(SYM.moon, '𝐴𝐹𝐾 ㅤ𝑎𝑐𝑡𝑖𝑣𝑎𝑑𝑜'),
    RULE.night,
    `ㅤ${SYM.moon}ㅤ${name} está ausente.`,
    `ㅤ${SYM.leaf}ㅤMotivo ⁙ ${reason}`,
    `ㅤ${SYM.leaf}ㅤDesde ⁙ ${time2(since)}`,
    '',
    `ㅤSi alguien te menciona, el bot avisará.`,
    `ㅤVuelve a escribir cualquier cosa y sales del AFK.`,
    RULE.night,
    `ㅤ${KAOMOJI.sleep}`,
  ]);
}

export function tAfkCleared({ name, duration }) {
  return join([
    head(SYM.sun, '𝐴𝐹𝐾 ㅤ𝑑𝑒𝑠𝑎𝑐𝑡𝑖𝑣𝑎𝑑𝑜'),
    `ㅤ${BR}`,
    `ㅤ${SYM.sun}ㅤ${name} volvió al rol.`,
    `ㅤ${SYM.leaf}ㅤAusente durante ${duration}`,
    `ㅤ${BR}`,
    `ㅤ(˶˃ ᵕ ˂˶)`,
  ]);
}

export function tAfkMention({ name, reason, since, mentioned }) {
  return join([
    `${SYM.moon} ㅤ${mentioned} ㅤ${name} está AFK`,
    `ㅤ${SYM.leaf}ㅤMotivo ⁙ ${reason}`,
    `ㅤ${SYM.leaf}ㅤDesde ⁙ ${timeAgo(since)}`,
    `ㅤ${KAOMOJI.sleep}`,
  ]);
}

export function tAfkList({ list, groupName }) {
  const rows = listOf(list);
  return join([
    head(SYM.moon, `𝐴𝑢𝑠𝑒𝑛𝑡𝑒𝑠 ㅤ𝑎ℎ𝑜𝑟𝑎 ㅤ·ㅤ ${groupName}`),
    RULE.night,
    ...rows.slice(0, 20).map((u) => `ㅤ${SYM.moon}ㅤ${String(u?.name ?? '—').padEnd(12, ' ')} ⁙ ${u?.afk_reason}ㅤ·ㅤ${timeAgo(u?.afk_since)}`),
    RULE.night,
    kv('En AFK', String(rows.length)),
    `ㅤ${KAOMOJI.sleep}`,
  ]);
}

export function tInactivesList({ list, days, groupName }) {
  const rows = listOf(list);
  if (!rows.length) {
    return join([
      head('✨', '𝑇𝑜𝑑𝑜𝑠 ㅤ𝑎𝑐𝑡𝑖𝑣𝑜𝑠'),
      RULE.wave,
      `ㅤNadie lleva ${days} días o más sin escribir en ${groupName}.`,
      RULE.wave,
      `ㅤ(˶ᵔ ᵕ ᵔ˶)`,
    ]);
  }
  return join([
    head(SYM.moon, `𝐼𝑛𝑎𝑐𝑡𝑖𝑣𝑜𝑠 ㅤ·ㅤ${days}+ días`),
    BR,
    ...rows.slice(0, 30).map((u, i) => {
      const d = Math.floor((Date.now() - (u?.last_activity ?? 0)) / 86_400_000);
      return `ㅤ${String(i + 1).padStart(2, '0')} ⁙ ${String(u?.name ?? '—').padEnd(12, ' ')} ${String(d).padStart(3, ' ')} d ㅤ·ㅤ ${u?.role_name ?? 'sin rol'}`;
    }),
    BR,
    kv('Total', String(rows.length)),
    `ㅤUmbral editable: ㅤ${inlineCmd('config', 'inactividad <días>')}`,
    `ㅤ${KAOMOJI.serious}`,
  ]);
}

export function tConfigUpdated({ key, value, adminName }) {
  return join([
    head('⚙', '𝐶𝑜𝑛𝑓𝑖𝑔𝑢𝑟𝑎𝑐𝑖𝑜́𝑛'),
    BR,
    `ㅤ${SYM.arrow}ㅤ${key} ⁙ ${value}`,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${adminName}`,
    BR,
    `ㅤ${KAOMOJI.wink}`,
  ]);
}

export function tConfigList({ config, groupName }) {
  const cfg = config && typeof config === 'object' ? config : {};
  const rows = [
    ['prefijo', cfg.prefix],
    ['inactividad', `${cfg.inactivity_days} días`],
    ['reserva', `${cfg.reserve_hours} h`],
    ['warns', `${cfg.max_warnings}`],
    ['bienvenida', cfg.welcome ? 'activada' : 'desactivada'],
    ['despedida', cfg.farewell ? 'activada' : 'desactivada'],
    ['aviso AFK', cfg.afk_mentions ? 'activado' : 'desactivado'],
    ['parejas', cfg.couple_enabled ? 'activadas' : 'desactivadas'],
    ['solo admins', cfg.adminonly ? 'activado' : 'desactivado'],
    ['antilink', cfg.antilink ? 'activado' : 'desactivado'],
    ['alertas', cfg.alerts !== false ? 'activadas' : 'desactivadas'],
  ];
  return join([
    head('⚙', `𝐶𝑜𝑛𝑓𝑖𝑔 ㅤ·ㅤ ${groupName}`),
    BR,
    ...rows.map(([k, v]) => kv(k, String(v))),
    BR,
    `ㅤCambia un valor: ㅤ${inlineCmd('config', '<clave> <valor>')}`,
    `ㅤ( ᵕ ᴗ ᵕ )`,
  ]);
}

export function tAuditList({ entries, groupName }) {
  const rows = listOf(entries);
  if (!rows.length) return `${SYM.bracketL} ${SYM.scroll} ${SYM.bracketR} ㅤSin eventos registrados en ${groupName}.`;
  return join([
    head(SYM.scroll, '𝑅𝑒𝑔𝑖𝑠𝑡𝑟𝑜 ㅤ𝑎𝑑𝑚𝑖𝑛𝑖𝑠𝑡𝑟𝑎𝑡𝑖𝑣𝑜'),
    BR,
    ...rows.slice(0, 15).map((e) => `ㅤ${time2(e?.created_at)} ⁙ ${String(e?.action ?? '').padEnd(18, ' ')} ${e?.target_jid ? mention(e.target_jid) : ''}`),
    BR,
    `ㅤ${KAOMOJI.cool}`,
  ]);
}

/* ═══════════════════════════════════════════════════════════════
   ⑤ INTERACCIÓN SOCIAL
   ═══════════════════════════════════════════════════════════════ */

export function tCoupleProposal({ fromName, toName, toMention, groupName }) {
  return join([
    `ㅤ${SYM.bracketL} ${SYM.heart} ${SYM.bracketR} ㅤ𝑃𝑟𝑜𝑝𝑢𝑒𝑠𝑡𝑎 ㅤ𝑑𝑒 ㅤ𝑝𝑎𝑟𝑒𝑗𝑎`,
    `ㅤ${RULE.wave}`,
    `ㅤ${fromName} quiere formar pareja con ${toName}`,
    `ㅤ${toMention}`,
    '',
    `ㅤ${SYM.leaf}ㅤAceptar ⁙ ${inlineCmd('aceptar')}`,
    `ㅤ${SYM.leaf}ㅤRechazar ⁙ ${inlineCmd('rechazar')}`,
    `ㅤ${RULE.wave}`,
    `ㅤ${KAOMOJI.love}`,
  ]);
}

export function tCoupleAccepted({ a, b, mentions = [] }) {
  return join([
    `ㅤ${SYM.bracketL} ${SYM.heart}${SYM.heart} ${SYM.bracketR}`,
    `ㅤㅤ𝑃𝑎𝑟𝑒𝑗𝑎 ㅤ𝑐𝑜𝑛𝑓𝑖𝑟𝑚𝑎𝑑𝑎`,
    `ㅤ${RULE.wave}`,
    `ㅤㅤ${a} ㅤ${SYM.heart}ㅤ ${b}`,
    `ㅤ${RULE.wave}`,
    `ㅤ${tags(mentions) ? `${tags(mentions)}ㅤ` : ''}${KAOMOJI.hug}`,
    `ㅤQue la corriente los lleve juntos 🌊`,
  ]);
}

export function tCoupleRejected({ fromName, toName }) {
  return join([
    head('✗', '𝑃𝑟𝑜𝑝𝑢𝑒𝑠𝑡𝑎 ㅤ𝑟𝑒𝑐ℎ𝑎𝑧𝑎𝑑𝑎'),
    WR,
    `ㅤ${toName} no aceptó la propuesta de ${fromName}.`,
    `ㅤSin dramas: el río sigue su curso 💧`,
    WR,
    `ㅤ${KAOMOJI.neutral}`,
  ]);
}

export function tCoupleBroken({ a, b }) {
  return join([
    head('🌀', '𝑅𝑒𝑙𝑎𝑐𝑖𝑜́𝑛 ㅤ𝑡𝑒𝑟𝑚𝑖𝑛𝑎𝑑𝑎'),
    WR,
    `ㅤ${a} y ${b} ya no son pareja.`,
    `ㅤAmbos perfiles quedaron actualizados.`,
    WR,
    `ㅤ${KAOMOJI.sad}`,
  ]);
}

export function tCoupleError({ reason }) {
  return join([
    head('✗', '𝑁𝑜 ㅤ𝑠𝑒 ㅤ𝑝𝑢𝑒𝑑𝑒'),
    BR,
    `ㅤ🌊ㅤ${reason}`,
    BR,
    `ㅤ${KAOMOJI.sad}`,
  ]);
}

export function tShip({ aName, bName, percent, verdict, mentions = [] }) {
  return join([
    head(SYM.heart, `𝑆ℎ𝑖𝑝 ㅤ·ㅤ ${str(aName)} × ${str(bName)}`),
    RULE.wave,
    `ㅤ${bar(percent, 10, '💧', '·')} ㅤ${percent}%`,
    '',
    verdict ? `ㅤ${str(verdict)}` : null,
    RULE.wave,
    `ㅤ${tags(mentions) ? `${tags(mentions)}ㅤ` : ''}${KAOMOJI.smug}`,
    sign(),
  ]);
}

export function tRules({ text, groupName }) {
  return join([
    head(SYM.scroll, `𝑅𝑒𝑔𝑙𝑎𝑠 ㅤ·ㅤ ${groupName}`),
    BR,
    text,
    BR,
    `ㅤ${KAOMOJI.serious}`,
  ]);
}

export function tAdminsList({ admins, count, groupName, botIsAdmin, ownerMention }) {
  const rows = listOf(admins);
  const body = rows.length
    ? rows.map((a) => `ㅤ${a?.is_super ? SYM.star : '💧'}ㅤ${a?.name ?? 'Admin'} ㅤ${mention(a?.user_jid)}${a?.is_super ? ' ㅤ·ㅤᴏᴡɴᴇʀ ᴅᴇʟ ɢʀᴜᴘᴏ' : ''}`).join('\n')
    : 'ㅤNo hay administradores registrados.';
  return join([
    head('🌊', '𝑆𝑡𝑎𝑓𝑓 ㅤ𝑑𝑒𝑙 ㅤ𝑔𝑟𝑢𝑝𝑜'),
    `ㅤ${groupName}`,
    WR,
    body,
    WR,
    kv('Administradores', String(count)),
    kv('Bot es admin', botIsAdmin ? 'sí ✓ (puedo expulsar/cerrar)' : 'no ✗ (necesito permisos)'),
    ownerMention ? `ㅤOwner del bot ⁙ ${ownerMention}` : null,
    `ㅤ${KAOMOJI.cool}`,
  ]);
}

/* ═══════════════════════════════════════════════════════════════
   ⑨ AZAR & JUEGOS
   ═══════════════════════════════════════════════════════════════ */

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function tDado({ count, faces, rolls, total }) {
  const rows = listOf(rolls);
  const shown = faces === 6 ? rows.map((roll) => DICE_FACES[roll - 1]).join(' ') : rows.join(' · ');
  return join([
    head('🎲', `𝐷𝑎𝑑𝑜${count > 1 ? '𝑠' : ''} ㅤ·ㅤ ${count}d${faces}`),
    RULE.night,
    `ㅤ${shown}`,
    count > 1 ? kv('Suma', `${total}`) : kv('Resultado', `${total}`),
    RULE.night,
    `ㅤ🫧ㅤ${KAOMOJI.smug}`,
    sign(),
  ]);
}

export function tMoneda({ side }) {
  return join([
    head('🪙', '𝑀𝑜𝑛𝑒𝑑𝑎 ㅤ𝑎𝑙 ㅤ𝑎𝑖𝑟𝑒'),
    RULE.wave,
    `ㅤ🌊ㅤSalió *${side}*.`,
    RULE.wave,
    `ㅤ${KAOMOJI.wink}`,
    sign(),
  ]);
}

export function tBola8({ question, answer }) {
  return join([
    head('🎱', '𝐵𝑜𝑙𝑎 ㅤ𝑚𝑎𝑔𝑖𝑐𝑎'),
    RULE.night,
    `ㅤ🫧ㅤ«${question}»`,
    '',
    `ㅤ🌊ㅤ${answer}`,
    RULE.night,
    sign(),
  ]);
}

export function tElegir({ options, chosen }) {
  const rows = listOf(options);
  return join([
    head('🌀', '𝐿𝑎 ㅤ𝑐𝑜𝑟𝑟𝑖𝑒𝑛𝑡𝑒 ㅤ𝑑𝑒𝑐𝑖𝑑𝑒'),
    RULE.wave,
    ...rows.map((option) => bullet(option === chosen ? `*${option}*` : option, option === chosen ? '🌊' : SYM.leaf)),
    '',
    `ㅤ${SYM.arrow}ㅤMe quedo con *${chosen}*.`,
    RULE.wave,
    sign(),
  ]);
}

export function tSorteo({ winnerName, pool, mentions = [] }) {
  const jids = listOf(mentions);
  return join([
    head('🎁', '𝑆𝑜𝑟𝑡𝑒𝑜 ㅤ𝑑𝑒𝑙 ㅤ𝑡𝑒𝑎𝑚'),
    BR,
    kv('Participantes', `${pool}`),
    kv('Ganador/a', winnerName),
    '',
    `ㅤ${jids.length ? `${mention(jids[0])}ㅤ` : ''}¡Felicidades! 🫧`,
    sign(),
  ]);
}

export function tEncuesta({ question, options }) {
  const rows = listOf(options);
  return join([
    head('🗳️', '𝐸𝑛𝑐𝑢𝑒𝑠𝑡𝑎'),
    BR,
    `ㅤ*${question}*`,
    ...rows.map((option, index) => bullet(`${index + 1}. ${option}`)),
    BR,
    `ㅤVota en la encuesta de WhatsApp. 🌊`,
    sign(),
  ]);
}

export function tInvertir({ reversed }) {
  return join([
    head('🔁', '𝑇𝑒𝑥𝑡𝑜 ㅤ𝑎𝑙 ㅤ𝑟𝑒𝑣𝑒𝑠'),
    BR,
    `ㅤ${reversed}`,
    BR,
    sign(),
  ]);
}

/* ═══════════════════════════════════════════════════════════════
   ⑥ MODERACIÓN Y ADMINISTRACIÓN
   ═══════════════════════════════════════════════════════════════ */

export function tUnwarnNotice({ userName, count, adminName }) {
  return join([
    head('💧', '𝐴𝑑𝑣𝑒𝑟𝑡𝑒𝑛𝑐𝑖𝑎 ㅤ𝑟𝑒𝑡𝑖𝑟𝑎𝑑𝑎'),
    RULE.wave,
    `ㅤ${SYM.leaf}ㅤ${userName} queda con ${count} warn${count === 1 ? '' : 's'}.`,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${adminName}`,
    RULE.wave,
    `ㅤ(˶ᵔ ᵕ ᵔ˶)`,
  ]);
}

export function tUnbanNotice({ userName, adminName }) {
  return join([
    head('🔓', '𝑈𝑠𝑢𝑎𝑟𝑖𝑜 ㅤ𝑑𝑒𝑠𝑏𝑙𝑜𝑞𝑢𝑒𝑎𝑑𝑜'),
    RULE.wave,
    `ㅤ${SYM.leaf}ㅤ${userName} salió de la lista negra.`,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${adminName}`,
    `ㅤ${SYM.leaf}ㅤSi vuelve al grupo ya no será expulsado.`,
    RULE.wave,
    `ㅤ${KAOMOJI.wink}`,
  ]);
}

export function tWarnHistory({ userName, entries, active }) {
  const rows = listOf(entries);
  const body = rows.length
    ? rows.slice(0, 10).map((w) => `ㅤ${w?.revoked_at ? '✗' : '🌊'}ㅤ${String(w?.reason || 'sin motivo').slice(0, 40)}ㅤ·ㅤ${formatDate(w?.created_at)}`).join('\n')
    : 'ㅤSin advertencias registradas.';
  return join([
    head(SYM.scroll, `𝐻𝑖𝑠𝑡𝑜𝑟𝑖𝑎𝑙 ㅤ·ㅤ ${userName}`),
    WR,
    body,
    WR,
    kv('Activas', String(active)),
    `ㅤ${KAOMOJI.cool}`,
  ]);
}

export function tBlockedList({ entries, total, groupName }) {
  const rows = listOf(entries);
  return join([
    head('🌊', `𝐿𝑖𝑠𝑡𝑎 ㅤ𝑛𝑒𝑔𝑟𝑎 ㅤ·ㅤ ${groupName}`),
    WR,
    ...rows.slice(0, 20).map((b) => `ㅤ🌊ㅤ${String(b?.name ?? '—').padEnd(14, ' ')} ⁙ ${b?.reason || 'sin motivo'}`),
    WR,
    kv('Bloqueados', String(total)),
    `ㅤSi vuelven a entrar, se les expulsa automáticamente.`,
    `ㅤ${KAOMOJI.serious}`,
  ]);
}

export function tKickNotice({ userName, adminName, reason, banned = false }) {
  return join([
    `ㅤ${SYM.bracketL} 🌊 ${SYM.bracketR} ㅤ${banned ? '𝐵𝑎𝑛' : '𝐸𝑥𝑝𝑢𝑙𝑠𝑖𝑜́𝑛'}`,
    `ㅤ${WR}`,
    `ㅤ🌊ㅤ${userName} fue ${banned ? 'baneado' : 'expulsado'} del grupo.`,
    `ㅤ${SYM.leaf}ㅤMotivo ⁙ ${reason ?? 'decisión del staff'}`,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${adminName}`,
    banned ? `ㅤ${SYM.leaf}ㅤSi vuelve a entrar, será expulsado otra vez.` : null,
    `ㅤ${WR}`,
    `ㅤ${KAOMOJI.serious}`,
  ]);
}

export function tModDenied({ reason, need = null }) {
  return join([
    head('⛔', '𝐴𝑐𝑐𝑖𝑜́𝑛 ㅤ𝑏𝑙𝑜𝑞𝑢𝑒𝑎𝑑𝑎'),
    WR,
    `ㅤ🌊ㅤ${reason}`,
    need ? `ㅤ${SYM.leaf}ㅤ${need}` : null,
    WR,
    `ㅤ${KAOMOJI.angry}`,
  ]);
}

export function tBannedRejoin({ userName, reason, groupName }) {
  return join([
    head('🌊', '𝑅𝑒𝑖𝑛𝑔𝑟𝑒𝑠𝑜 ㅤ𝑏𝑙𝑜𝑞𝑢𝑒𝑎𝑑𝑜'),
    WR,
    `ㅤ🌊ㅤ${userName} está en la lista negra de ${groupName}.`,
    `ㅤ${SYM.leaf}ㅤMotivo del ban ⁙ ${reason ?? '—'}`,
    `ㅤ${SYM.leaf}ㅤAcción ⁙ expulsión automática.`,
    WR,
  ]);
}

export function tAnnouncement({ title, text, authorName, groupName, mentions = [] }) {
  return join([
    `ㅤㅤ${CROWN}`,
    `ㅤㅤ${SYM.bracketL} 🌊 ${SYM.bracketR}`,
    `ㅤㅤ𝐀𝐍𝐔𝐍𝐂𝐈𝐎 ㅤ𝐎𝐅𝐈𝐂𝐈𝐀𝐋`,
    `ㅤㅤ${groupName}`,
    BR,
    title ? `ㅤ${SYM.star}ㅤ${title}` : null,
    '',
    text,
    '',
    BR,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${authorName}`,
    listOf(mentions).length ? `ㅤ${listOf(mentions).join(' ')}` : null,
    `ㅤㅤ${SYM.bracketL} 💧 ${SYM.bracketR} ㅤ◢🌊◣ 𝕿𝖔𝖒𝖎𝖐𝖆 ࿙💧࿚`,
    `ㅤㅤ${CROWN}`,
  ]);
}

export function tGroupClosed({ adminName }) {
  return join([
    head('🔒', '𝐺𝑟𝑢𝑝𝑜 ㅤ𝑐𝑒𝑟𝑟𝑎𝑑𝑜'),
    WR,
    `ㅤ🌊ㅤAhora solo los administradores pueden escribir.`,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${adminName}`,
    `ㅤ${SYM.leaf}ㅤPara reabrir ⁙ ${inlineCmd('open')}`,
    WR,
    `ㅤ${KAOMOJI.serious}`,
  ]);
}

export function tGroupOpened({ adminName }) {
  return join([
    head('🔓', '𝐺𝑟𝑢𝑝𝑜 ㅤ𝑎𝑏𝑖𝑒𝑟𝑡𝑜'),
    RULE.wave,
    `ㅤ${SYM.arrow}ㅤTodos pueden escribir de nuevo.`,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${adminName}`,
    RULE.wave,
    `ㅤ(˶˃ ᵕ ˂˶)`,
  ]);
}

export function tAddResult({ targetName, ok: added, detail, inviteLink = null }) {
  return join([
    head(added ? '✓' : '✗', added ? '𝑈𝑠𝑢𝑎𝑟𝑖𝑜 ㅤ𝑎ñ𝑎𝑑𝑖𝑑𝑜' : '𝑁𝑜 ㅤ𝑠𝑒 ㅤ𝑝𝑢𝑑𝑜 ㅤ𝑎ñ𝑎𝑑𝑖𝑟'),
    BR,
    `ㅤ${SYM.leaf}ㅤObjetivo ⁙ ${targetName}`,
    detail ? `ㅤ🌊ㅤ${detail}` : null,
    inviteLink ? `ㅤ${SYM.leaf}ㅤInvítalo con el enlace del grupo:\n${inviteLink}` : null,
    `ㅤ${SYM.leaf}ㅤRecuerda: no se registra solo, debe usar ${inlineCmd('reg', '<nombre.edad>')}`,
    BR,
    `ㅤ${added ? KAOMOJI.wink : KAOMOJI.neutral}`,
  ]);
}

export function tInviteLinkCard({ link, groupName, adminName }) {
  return join([
    head('🔗', '𝐸𝑛𝑙𝑎𝑐𝑒 ㅤ𝑑𝑒𝑙 ㅤ𝑔𝑟𝑢𝑝𝑜'),
    BR,
    `ㅤ${SYM.leaf}ㅤ${groupName}`,
    '',
    link,
    '',
    `ㅤ${SYM.scroll}ㅤEs la vía fiable para meter gente al team:`,
    `ㅤWhatsApp suele bloquear el añadido directo por privacidad.`,
    `ㅤQuien entre debe registrarse con ㅤ${inlineCmd('reg', '<nombre.edad>')}`,
    BR,
    `ㅤ${SYM.leaf}ㅤGenerado por ⁙ ${adminName}`,
    `ㅤ${KAOMOJI.wink}`,
  ]);
}

export function tModPromote({ userName, adminName, mentions = [] } = {}) {
  const t = tags(mentions);
  return join([
    `ㅤ${SYM.bracketL} ⬆ ${SYM.bracketR} ㅤ𝑁𝑢𝑒𝑣𝑜 ㅤ𝑎𝑑𝑚𝑖𝑛`,
    `ㅤ${BR}`,
    t ? `ㅤ${t}` : null,
    `ㅤ🌊ㅤ${str(userName)} ahora es administrador del grupo.`,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${str(adminName)}`,
    `ㅤ${BR}`,
    `ㅤ(˶˃ ᵕ ˂˶)`,
  ]);
}

export function tModDemote({ userName, adminName, mentions = [] } = {}) {
  const t = tags(mentions);
  return join([
    `ㅤ${SYM.bracketL} ⬇ ${SYM.bracketR} ㅤ𝐴𝑑𝑚𝑖𝑛 ㅤ𝑟𝑒𝑡𝑖𝑟𝑎𝑑𝑜`,
    `ㅤ${WR}`,
    t ? `ㅤ${t}` : null,
    `ㅤ🌊ㅤ${str(userName)} ya no es administrador del grupo.`,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${str(adminName)}`,
    `ㅤ${WR}`,
    `ㅤ${KAOMOJI.serious}`,
  ]);
}

export function tModTagall({ authorName, text, total, shown, hidden, groupName, mentions = [] } = {}) {
  const rows = listOf(shown);
  const t = tags(mentions);
  return join([
    `*! ㅤ𝑀𝐸𝑁𝐶𝐼𝑂𝑁 ㅤ𝐺𝐸𝑁𝐸𝑅𝐴𝐿 ㅤ!* 🌊`,
    `ㅤ𝑃𝐴𝑅𝐴 ${num(total)} 𝑀𝐼𝐸𝑀𝐵𝑅𝑂𝑆 🗣️`,
    '',
    `ㅤ» Mensaje ⁙ ${str(text)}`,
    '',
    `╭ ┄ ${str(groupName)} ┄`,
    ...rows.map((row) => `ㅤ│ㅤ${str(row?.mention)}ㅤ·ㅤ${str(row?.name)}`),
    num(hidden) > 0 ? `ㅤ│ㅤ… y ${num(hidden)} más` : null,
    `╰ ┄ ${SYM.bracketL} 🌊 ${SYM.bracketR} ┄`,
    '',
    `ㅤPor ⁙ ${str(authorName)}`,
    t ? `ㅤ${t}` : null,
  ]);
}

export function tModNotify({ authorName, text, total, groupName, mentions = [] } = {}) {
  const t = tags(mentions);
  return join([
    `ㅤㅤ${CROWN}`,
    `ㅤㅤ${SYM.bracketL} 📢 ${SYM.bracketR}`,
    `ㅤㅤ𝑁𝑂𝑇𝐼𝐹𝐼𝐶𝐴𝐶𝐼𝑂́𝑁`,
    `ㅤㅤ${str(groupName)}`,
    BR,
    str(text),
    '',
    BR,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${str(authorName)} · para ${num(total)} miembros`,
    t ? `ㅤ${t}` : null,
    `ㅤㅤ${CROWN}`,
  ]);
}

export function tModRevoke({ link, groupName, adminName } = {}) {
  return join([
    head('🔗', '𝐸𝑛𝑙𝑎𝑐𝑒 ㅤ𝑟𝑒𝑛𝑜𝑣𝑎𝑑𝑜'),
    WR,
    `ㅤ${SYM.leaf}ㅤ${str(groupName)}`,
    '',
    str(link),
    '',
    `ㅤ🌊ㅤEl enlace anterior ya no funciona.`,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${str(adminName)}`,
    WR,
    `ㅤ${KAOMOJI.cool}`,
  ]);
}

export function tModMute({ userName, reason, adminName, mentions = [] } = {}) {
  const t = tags(mentions);
  return join([
    head('🔇', '𝑈𝑠𝑢𝑎𝑟𝑖𝑜 ㅤ𝑠𝑖𝑙𝑒𝑛𝑐𝑖𝑎𝑑𝑜'),
    WR,
    t ? `ㅤ${t}` : null,
    `ㅤ🌊ㅤ${str(userName)} fue silenciado: sus mensajes se borrarán.`,
    reason ? `ㅤ${SYM.leaf}ㅤMotivo ⁙ ${str(reason)}` : null,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${str(adminName)}`,
    WR,
    `ㅤ${KAOMOJI.serious}`,
  ]);
}

export function tModUnmute({ userName, adminName, mentions = [] } = {}) {
  const t = tags(mentions);
  return join([
    head('🔊', '𝑆𝑖𝑙𝑒𝑛𝑐𝑖𝑜 ㅤ𝑙𝑒𝑣𝑎𝑛𝑡𝑎𝑑𝑜'),
    RULE.wave,
    t ? `ㅤ${t}` : null,
    `ㅤ${SYM.arrow}ㅤ${str(userName)} puede escribir de nuevo.`,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${str(adminName)}`,
    RULE.wave,
    `ㅤ(˶˃ ᵕ ˂˶)`,
  ]);
}

export function tModMutelist({ entries, total, groupName } = {}) {
  const rows = listOf(entries);
  return join([
    head('🔇', `𝑆𝑖𝑙𝑒𝑛𝑐𝑖𝑎𝑑𝑜𝑠 ㅤ·ㅤ ${str(groupName)}`),
    WR,
    ...(rows.length
      ? rows.slice(0, 20).map((row) => `ㅤ🔇ㅤ${str(row?.name).padEnd(14, ' ')} ⁙ ${str(row?.reason, 'sin motivo')}`)
      : ['ㅤNadie está silenciado.']),
    WR,
    kv('Silenciados', String(num(total) || rows.length)),
    `ㅤSilencia con ㅤ${inlineCmd('mute', '@usuario [motivo]')}`,
    `ㅤ${KAOMOJI.serious}`,
  ]);
}

export function tModToggle({ feature, enabled, statusOnly, adminName, hint } = {}) {
  const on = isTrue(enabled);
  const only = isTrue(statusOnly);
  return join([
    head(on ? '✓' : '✗', str(feature, 'Opción')),
    BR,
    only
      ? `ㅤ${SYM.leaf}ㅤEstado actual ⁙ *${on ? 'activado' : 'desactivado'}*`
      : `ㅤ${SYM.arrow}ㅤAhora está *${on ? 'activado' : 'desactivado'}*.`,
    !only && adminName ? `ㅤ${SYM.leaf}ㅤPor ⁙ ${str(adminName)}` : null,
    hint ? `ㅤ${SYM.scroll}ㅤ${str(hint)}` : null,
    BR,
    `ㅤ${on ? KAOMOJI.wink : KAOMOJI.neutral}`,
  ]);
}

export function tModSettext({ feature, text, statusOnly, adminName, hint } = {}) {
  const only = isTrue(statusOnly);
  const current = String(text ?? '').trim();
  return join([
    head('✎', str(feature, 'Mensaje')),
    BR,
    current ? `ㅤ${SYM.arrow}ㅤ${current}` : `ㅤ${SYM.leaf}ㅤTodavía no hay un mensaje personalizado.`,
    !only && adminName ? `ㅤ${SYM.leaf}ㅤGuardado por ⁙ ${str(adminName)}` : null,
    hint ? `ㅤ${SYM.scroll}ㅤ${str(hint)}` : null,
    `ㅤVariables ⁙ {user} {group} {prefix}`,
    BR,
    `ㅤ( ᵕ ᴗ ᵕ )`,
  ]);
}

/* ═══════════════════════════════════════════════════════════════
   ⑦ BIENVENIDA / DESPEDIDA
   ═══════════════════════════════════════════════════════════════ */

export function tWelcome({ name, groupName, total, mention, registered, customText = null, preview = false }) {
  const custom = String(customText ?? '').trim();
  return join([
    `ㅤㅤ${CROWN}`,
    `ㅤㅤ${SYM.bracketL} 💧 ${SYM.bracketR}`,
    `ㅤㅤ𝐁𝐈𝐄𝐍𝐕𝐄𝐍𝐈𝐃${registered ? '𝐎 𝐃𝐄 𝐕𝐔𝐄𝐋𝐓𝐀' : '𝐈𝐃𝐎/𝐀'}${preview ? ' ㅤ·ㅤ𝑣𝑖𝑠𝑡𝑎 𝑝𝑟𝑒𝑣𝑖𝑎' : ''}`,
    `ㅤㅤ${groupName}`,
    BR,
    `ㅤ${mention}`,
    `ㅤ${SYM.arrow}ㅤ${name} se unió al team. 🌊`,
    custom ? `ㅤ${SYM.star}ㅤ${custom}` : null,
    registered ? `ㅤ${SYM.leaf}ㅤTu ficha anterior fue restaurada.` : `ㅤ${SYM.leaf}ㅤRegístrate para empezar a rolear:`,
    registered ? null : cmd('reg', '<nombre.edad>'),
    `ㅤ${SYM.leaf}ㅤLee las reglas con ㅤ${inlineCmd('reglas')}`,
    `ㅤ${SYM.leaf}ㅤMira el menú con ㅤ${inlineCmd('menu')}`,
    BR,
    kv('Integrante №', String(total)),
    `ㅤㅤ( ᵕ ᴗ ᵕ )♡`,
    `ㅤㅤ${CROWN}`,
  ]);
}

export function tFarewell({ name, groupName, role, total, reason = 'leave', customText = null, preview = false }) {
  const titles = { leave: '𝐀𝐃𝐈𝐎́𝐒', kick: '𝐄𝐗𝐏𝐔𝐋𝐒𝐀𝐃𝐎/𝐀', ban: '𝐁𝐀𝐍𝐄𝐀𝐃𝐎/𝐀' };
  const custom = String(customText ?? '').trim();
  return join([
    `ㅤ${SYM.bracketL} ${SYM.moon} ${SYM.bracketR} ㅤ${titles[reason] ?? titles.leave}${preview ? ' ㅤ·ㅤ𝑣𝑖𝑠𝑡𝑎 𝑝𝑟𝑒𝑣𝑖𝑎' : ''}`,
    RULE.night,
    `ㅤ${SYM.leaf}ㅤ${name} dejó ${groupName}.`,
    custom ? `ㅤ${SYM.star}ㅤ${custom}` : null,
    role ? `ㅤ${SYM.leaf}ㅤSu personaje 🌊 ${role} quedó libre.` : null,
    `ㅤ${SYM.leaf}ㅤQuedan ${total} integrantes registrados.`,
    RULE.night,
    `ㅤ${reason === 'leave' ? KAOMOJI.sad : KAOMOJI.serious}`,
  ]);
}

/* ═══════════════════════════════════════════════════════════════
   ⑧ SISTEMA
   ═══════════════════════════════════════════════════════════════ */

export function tNoPermission({ required, command }) {
  const who = { admin: 'administradores del grupo o del bot', owner: 'el owner del bot', registered: 'integrantes registrados' }[required] ?? required;
  return join([
    head('🌊', '𝐴𝑐𝑐𝑒𝑠𝑜 ㅤ𝑟𝑒𝑠𝑡𝑟𝑖𝑛𝑔𝑖𝑑𝑜'),
    WR,
    `ㅤ🌊ㅤ${P}${command} es solo para ${who}.`,
    `ㅤ${SYM.leaf}ㅤTu rango actual no alcanza.`,
    WR,
    `ㅤ${KAOMOJI.angry}`,
  ]);
}

export function tRateLimited({ retryIn, max, windowSec }) {
  return join([
    head('⏳', '𝑇𝑟𝑎𝑛𝑞𝑢𝑖𝑙𝑜/𝑎'),
    BR,
    `ㅤ🫧ㅤDemasiados comandos seguidos (${max} cada ${windowSec}s).`,
    `ㅤ${SYM.leaf}ㅤPodrás usar comandos en ${retryIn}s.`,
    BR,
    `ㅤ${KAOMOJI.sad}`,
  ]);
}

export function tGroupOnly({ command }) {
  return join([
    head('⛔', '𝑆𝑜𝑙𝑜 ㅤ𝑒𝑛 ㅤ𝑔𝑟𝑢𝑝𝑜𝑠'),
    BR,
    `ㅤ🌊ㅤ${P}${command} funciona dentro de un grupo del team.`,
    BR,
    `ㅤ${KAOMOJI.neutral}`,
  ]);
}

export function tConfirmAsk({ action, description, ttl = 60 }) {
  return join([
    head('💧', '𝐶𝑜𝑛𝑓𝑖𝑟𝑚𝑎𝑐𝑖𝑜́𝑛 ㅤ𝑟𝑒𝑞𝑢𝑒𝑟𝑖𝑑𝑎'),
    WR,
    `ㅤ🌊ㅤ${description}`,
    '',
    `ㅤ${SYM.leaf}ㅤConfirmar ⁙ ${inlineCmd('confirmar')}`,
    `ㅤ${SYM.leaf}ㅤCancelar ㅤ⁙ ${inlineCmd('cancelar')}`,
    `ㅤ${SYM.leaf}ㅤExpira en ${ttl}s`,
    WR,
    `ㅤ${KAOMOJI.serious}`,
  ]);
}

export function tConfirmCancelled() {
  return [`${SYM.bracketL} ✗ ${SYM.bracketR} ㅤAcción cancelada.`, `ㅤNo se modificó nada ㅤ( ᵕ ᴗ ᵕ )`].join('\n');
}

export function tConfirmNothing() {
  return join([
    head('?', '𝑁𝑎𝑑𝑎 ㅤ𝑝𝑜𝑟 ㅤ𝑐𝑜𝑛𝑓𝑖𝑟𝑚𝑎𝑟'),
    BR,
    `ㅤNo tienes ninguna acción pendiente.`,
    `ㅤLas confirmaciones expiran en 60 segundos.`,
    BR,
  ]);
}

export function tConfirmExpired({ action }) {
  return join([
    head('⏳', '𝐶𝑜𝑛𝑓𝑖𝑟𝑚𝑎𝑐𝑖𝑜́𝑛 ㅤ𝑒𝑥𝑝𝑖𝑟𝑎𝑑𝑎'),
    BR,
    `ㅤLa acción "${action}" venció. Vuelve a intentarlo.`,
    BR,
    `ㅤ${KAOMOJI.neutral}`,
  ]);
}

export function tInvalidInput({ command, message, hint = null }) {
  return join([
    `${SYM.bracketL} 💧 ${SYM.bracketR} ㅤ${P}${command} ㅤ𝑛𝑜 ㅤ𝑎𝑝𝑙𝑖𝑐𝑎`,
    BR,
    `ㅤ${SYM.leaf}ㅤ${message}`,
    hint ? `ㅤ${SYM.leaf}ㅤ${hint}` : null,
    BR,
    `ㅤNo se modificó ningún dato. ㅤ${KAOMOJI.neutral}`,
  ]);
}

export function tError({ command, message, ref = null }) {
  return join([
    head('✗', `𝐸𝑟𝑟𝑜𝑟 ㅤ𝑒𝑛 ㅤ${P}${command}`),
    WR,
    `ㅤ🌊ㅤ${message}`,
    ref ? `ㅤ${SYM.leaf}ㅤReferencia ⁙ ${ref}` : null,
    WR,
    `ㅤEl bot sigue funcionando. Reporta al owner si se repite.`,
    `ㅤ${KAOMOJI.panic}`,
  ]);
}

export function tUnknownCommand({ command, suggestion = null }) {
  return join([
    head('?', '𝐶𝑜𝑚𝑎𝑛𝑑𝑜 ㅤ𝑛𝑜 ㅤ𝑒𝑥𝑖𝑠𝑡𝑒'),
    BR,
    `ㅤ${P}${command} no es un comando de Tomioka.`,
    suggestion ? `ㅤ${SYM.leaf}ㅤ¿Quisiste decir ㅤ${inlineCmd(suggestion)}?` : null,
    `ㅤ${SYM.leaf}ㅤMira la lista con ㅤ${inlineCmd('menu')}`,
    BR,
  ]);
}

export function tActivationKey({ key, expiresInMin = 10, instanceName = null, pairingCodes = [], linking = [] }) {
  const codes = listOf(pairingCodes).filter((row) => row?.formatted);
  const pendientes = listOf(linking);
  return join([
    head(SYM.star, '𝐶𝑙𝑎𝑣𝑒 ㅤ𝑑𝑒 ㅤ𝑎𝑐𝑡𝑖𝑣𝑎𝑐𝑖𝑜́𝑛'),
    RULE.night,
    `ㅤ${SYM.leaf}ㅤTu clave ㅤ⁙ㅤ ${key}`,
    instanceName ? `ㅤ${SYM.leaf}ㅤBot ㅤ⁙ㅤ ${instanceName}` : null,
    '',
    `ㅤ${SYM.scroll}ㅤPégala en el panel web para activar el bot.`,
    `ㅤ${SYM.leaf}ㅤCaduca en ${expiresInMin} min · un solo uso.`,
    ...codes.map((row) => [
      '',
      `ㅤ${SYM.bracketL} 🔑 ${SYM.bracketR} ㅤ𝑃𝑎𝑖𝑟𝑖𝑛𝑔 ㅤ𝑐𝑜𝑑𝑒 ㅤ𝑟𝑒𝑎𝑙`,
      `ㅤ${SYM.leaf}ㅤBot ㅤ⁙ㅤ ${row.name} ${row.phoneMasked ? `(${row.phoneMasked})` : ''}`,
      `ㅤ🌊ㅤCódigo ㅤ⁙ㅤ ${row.formatted}`,
      `ㅤ${SYM.arrow}ㅤEn ese teléfono: WhatsApp › Dispositivos vinculados ›`,
      `ㅤㅤVincular con el número de teléfono.`,
      `ㅤ${SYM.leaf}ㅤCaduca en ~${Math.max(1, Number(row.expiresInSec ?? 60))} s · pide otro con ${inlineCmd('pairing')}`,
    ].join('\n')),
    !codes.length && pendientes.length
      ? ['', `ㅤ🌊ㅤVinculación en marcha: ${pendientes.map((row) => row?.name).join(', ')}.`, `ㅤ${SYM.leaf}ㅤPide el código con ${inlineCmd('pairing')} en unos segundos.`].join('\n')
      : null,
    '',
    `ㅤ${SYM.leaf}ㅤTambién sirve ㅤ${inlineCmd('key')} ㅤcon # - + . /`,
    RULE.night,
    `ㅤ(˶ᵔ ᵕ ᵔ˶)`,
  ]);
}

export function tPairingCodeCard({ pairingCodes = [], linking = [] }) {
  const codes = listOf(pairingCodes).filter((row) => row?.formatted);
  if (!codes.length) {
    const pendientes = listOf(linking).length ? listOf(linking).map((row) => row?.name).join(', ') : null;
    return join([
      head('🔑', '𝑆𝑖𝑛 ㅤ𝑐𝑜́𝑑𝑖𝑔𝑜 ㅤ𝑝𝑒𝑛𝑑𝑖𝑒𝑛𝑡𝑒'),
      WR,
      pendientes ? `ㅤ🌊ㅤHay una vinculación en marcha (${pendientes}).` : `ㅤ🌊ㅤAhora mismo ningún sub-bot está vinculándose por código.`,
      `ㅤ${SYM.leaf}ㅤCrea el bot en el panel y pulsa "Generar vinculación".`,
      `ㅤ${SYM.leaf}ㅤDespués pide el código aquí con ${inlineCmd('pairing')}.`,
      WR,
      `ㅤ${KAOMOJI.serious}`,
    ]);
  }
  return join([
    head('🔑', '𝑃𝑎𝑖𝑟𝑖𝑛𝑔 ㅤ𝑐𝑜𝑑𝑒'),
    RULE.night,
    ...codes.flatMap((row) => [
      `ㅤ${SYM.leaf}ㅤBot ㅤ⁙ㅤ ${row.name} ${row.phoneMasked ? `(${row.phoneMasked})` : ''}`,
      `ㅤ${SYM.scroll}ㅤCódigo ㅤ⁙ㅤ ${row.formatted}`,
      `ㅤ${SYM.arrow}ㅤEn ese teléfono: WhatsApp › Dispositivos vinculados ›`,
      `ㅤㅤVincular con el número de teléfono ㅤ${SYM.leaf}ㅤcaduca en ~${Math.max(1, Number(row.expiresInSec ?? 60))} s`,
      '',
    ]),
    `ㅤ${SYM.leaf}ㅤ¿Ya lo usaste? Pide otro con ${inlineCmd('pairing')}`,
    RULE.night,
    `ㅤ${KAOMOJI.wink}`,
  ]);
}

export function tBotInactive({ instanceName = null } = {}) {
  return join([
    head('🔒', '𝐵𝑜𝑡 ㅤ𝑠𝑖𝑛 ㅤ𝑎𝑐𝑡𝑖𝑣𝑎𝑟'),
    WR,
    instanceName ? `ㅤ${SYM.leaf}ㅤ${instanceName} todavía no está activado.` : `ㅤ${SYM.leaf}ㅤEste bot todavía no está activado.`,
    `ㅤ🌊ㅤEnvía ㅤ${inlineCmd('key')}ㅤ para recibir tu clave.`,
    `ㅤ🌊ㅤLuego pégala en el panel web → Conectar bot.`,
    WR,
    `ㅤ${KAOMOJI.serious}`,
  ]);
}

export function tOwnerCard({ ownerMasked, team, botName, version, isOwner }) {
  return join([
    head('🌊', '𝑂𝑤𝑛𝑒𝑟 ㅤ𝑑𝑒𝑙 ㅤ𝑏𝑜𝑡'),
    WR,
    kv('Bot', `${botName} · v${version}`),
    kv('Team', team),
    kv('Owner', ownerMasked ?? '—'),
    kv('Tú', isOwner ? 'eres el owner ✓' : 'no eres el owner'),
    WR,
    `ㅤPara soporte, reportes o apelaciones escríbele por privado.`,
    `ㅤ${KAOMOJI.cool}`,
  ]);
}

export function tPing({ ms, uptime, groups, users }) {
  return join([
    head('💧', '𝑃𝑜𝑛𝑔'),
    RULE.wave,
    kv('Latencia', `${num(ms)} ms`),
    kv('Activo', formatDuration(uptime)),
    kv('Grupos', str(groups, '0')),
    kv('Fichas', str(users, '0')),
    RULE.wave,
    `ㅤ${ms < 200 ? '(˶˃ ᵕ ˂˶)' : ms < 600 ? KAOMOJI.neutral : KAOMOJI.sleep}`,
  ]);
}

export function tBotInfo({ name, team, version, prefix, groups, users, roles, instances, uptime, owner }) {
  return join([
    ...bigHead('𝐵𝑜𝑡 ㅤ𝑖𝑛𝑓𝑜𝑟𝑚𝑎𝑡𝑖𝑜𝑛'),
    BR,
    kv('Name', name),
    kv('Team', team),
    kv('Prefix', prefix),
    kv('Version', version),
    kv('Status', 'ᴏɴʟɪɴᴇ'),
    kv('Uptime', formatDuration(uptime)),
    kv('Grupos', String(groups)),
    kv('Registrados', String(users)),
    kv('Personajes', String(roles)),
    kv('Sub-bots', String(instances)),
    kv('Owner', owner ? maskPhone(owner) : '—'),
    BR,
    `ㅤㅤ( Que la calma del agua guíe cada uno de tus pasos. )`,
    `ㅤㅤ(˶ᵔ ᵕ ᵔ˶)`,
    sign(),
  ]);
}

export function tSysStatus({ botName, team, version, uptime, heapUsed, heapTotal, rss, memUsed, memTotal, memPercent, cpuCores, load, platform, node, pid, groups, users } = {}) {
  return join([
    `「🌊」Estado de *${str(botName)}*`,
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
    `> *${str(botName)} está funcionando correctamente* 💧`,
    `ㅤ${KAOMOJI.cool}`,
  ]);
}

export function tSysUserid({ pushName, jid, masked, isOwner, isAdmin, isRegistered, rankLabel } = {}) {
  return join([
    head('🆔', '𝐼𝑛𝑓𝑜𝑟𝑚𝑎𝑐𝑖𝑜́𝑛 ㅤ𝑑𝑒 ㅤ𝑢𝑠𝑢𝑎𝑟𝑖𝑜'),
    RULE.night,
    kv('Nombre', str(pushName)),
    kv('JID', `\`${str(jid)}\``),
    kv('Contacto', str(masked)),
    kv('Owner', isTrue(isOwner) ? 'sí 👑' : 'no'),
    kv('Admin', isTrue(isAdmin) ? 'sí 🛡️' : 'no'),
    kv('Registrado', isTrue(isRegistered) ? 'sí ✓' : 'no'),
    kv('Rango', str(rankLabel)),
    RULE.night,
    `ㅤ${KAOMOJI.neutral}`,
  ]);
}

/* ═══════════════════════════════════════════════════════════════
   ANIME · reacciones de rol
   ═══════════════════════════════════════════════════════════════ */

export function tAnimeReact({ emoji, actorName, phrase, targetName, self, mentions = [] } = {}) {
  const actor = str(actorName, 'Alguien');
  const action = str(phrase, 'hace algo');
  const target = self ? '' : ` ${str(targetName, 'alguien')}`;
  const t = tags(mentions);
  return join([
    `ㅤ${SYM.bracketL} ${emoji ?? '🌊'} ${SYM.bracketR} ㅤ𝑅𝑒𝑎𝑐𝑐𝑖𝑜́𝑛`,
    `ㅤ${RULE.wave}`,
    `ㅤ${SYM.arrow}ㅤ${actor} ${action}${target}.`,
    t ? `ㅤ${t}` : null,
    `ㅤ${RULE.wave}`,
    `ㅤ${KAOMOJI.hug}`,
  ]);
}

/* ═══════════════════════════════════════════════════════════════
   ECONOMÍA · ¥enes
   ═══════════════════════════════════════════════════════════════ */

export function tEcoBalance({ userName, coinsFmt, bankFmt, totalFmt, streak, coin, isSelf } = {}) {
  return join([
    head('🫧', `𝐵𝑎𝑙𝑎𝑛𝑐𝑒 ㅤ·ㅤ ${str(userName)}`),
    BR,
    kv('Cartera', `⛁ ${str(coinsFmt, '0')} ${str(coin, '¥enes')}`),
    kv('Banco', `🏦 ${str(bankFmt, '0')} ${str(coin, '¥enes')}`),
    kv('Total', `${str(totalFmt, '0')} ${str(coin, '¥enes')}`),
    num(streak) > 0 ? kv('Racha diaria', `🔥 ${num(streak)} día${num(streak) === 1 ? '' : 's'}`) : null,
    BR,
    isSelf ? `ㅤGana más con ㅤ${inlineCmd('work')} ㅤo ㅤ${inlineCmd('daily')}` : `ㅤRegálale con ㅤ${inlineCmd('pay', '@usuario <cantidad>')}`,
    `ㅤ${KAOMOJI.smug}`,
  ]);
}

export function tEcoTop({ entries, groupName, coin } = {}) {
  const rows = listOf(entries);
  const medals = ['🥇', '🥈', '🥉'];
  const body = rows.length
    ? rows.map((row, index) => {
        const medal = medals[index] ?? `${String(num(row?.rank) || index + 1).padStart(2, '0')}`;
        return `ㅤ${medal}ㅤ${str(row?.name).padEnd(14, ' ')} ⁙ ${str(row?.totalFmt, '0')} ${str(coin, '¥enes')}`;
      }).join('\n')
    : 'ㅤNadie tiene ¥enes todavía. ¡Sé el primero con .daily!';
  return join([
    head('🏆', `𝑇𝑜𝑝 ㅤ𝑟𝑖𝑐𝑜𝑠 ㅤ·ㅤ ${str(groupName)}`),
    BR,
    body,
    BR,
    kv('Fortunas', String(rows.length)),
    `ㅤ${KAOMOJI.cool}`,
  ]);
}

export function tEcoEinfo({ userName, rows, totalFmt, coin, mentions = [] } = {}) {
  const lines = listOf(rows).map((row) => {
    const mark = row?.ready ? '✓' : '⏳';
    return `ㅤ${mark}ㅤ${str(row?.label).padEnd(7, ' ')} ⁙ ${str(row?.text)}`;
  });
  const t = tags(mentions);
  return join([
    head('⏳', `𝐸𝑐𝑜𝑛𝑜𝑚𝑖́𝑎 ㅤ·ㅤ ${str(userName)}`),
    BR,
    ...lines,
    BR,
    kv('Total', `⛁ ${str(totalFmt, '0')} ${str(coin, '¥enes')}`),
    t ? `ㅤ${t}` : null,
    `ㅤ${KAOMOJI.neutral}`,
  ]);
}

export function tEcoResult({ title, userName, phrase, amountFmt, won, balanceFmt, coin } = {}) {
  const success = isTrue(won);
  return join([
    head(success ? '💧' : '✗', str(title, 'Economía')),
    success ? RULE.wave : WR,
    `ㅤ${SYM.leaf}ㅤ${str(userName)}: ${str(phrase)} *${str(amountFmt, '0')} ${str(coin, '¥enes')}*.`,
    `ㅤ${SYM.leaf}ㅤBalance ⁙ ⛁ ${str(balanceFmt, '0')} ${str(coin, '¥enes')}`,
    success ? RULE.wave : WR,
    `ㅤ${success ? '(˶˃ ᵕ ˂˶)' : KAOMOJI.sad}`,
  ]);
}

export function tEcoDaily({ userName, rewardFmt, streak, nextStreak, nextRewardFmt, streakLost, balanceFmt, coin } = {}) {
  return join([
    `ㅤ${SYM.bracketL} 🎁 ${SYM.bracketR} ㅤ𝑅𝑒𝑐𝑜𝑚𝑝𝑒𝑛𝑠𝑎 ㅤ𝑑𝑖𝑎𝑟𝑖𝑎`,
    `ㅤ${BR}`,
    `ㅤ${SYM.arrow}ㅤ${str(userName)} reclamó *${str(rewardFmt, '0')} ${str(coin, '¥enes')}* (día ${num(streak) || 1}).`,
    `ㅤ${SYM.leaf}ㅤDía ${num(nextStreak) || 2} ⁙ +${str(nextRewardFmt, '0')} ${str(coin, '¥enes')}`,
    streakLost ? `ㅤ🌊ㅤPerdiste tu racha anterior. ¡A empezar de nuevo!` : null,
    `ㅤ${SYM.leaf}ㅤBalance ⁙ ⛁ ${str(balanceFmt, '0')} ${str(coin, '¥enes')}`,
    `ㅤ${BR}`,
    `ㅤ(˶ᵔ ᵕ ᵔ˶)`,
  ]);
}

export function tEcoBet({ game, userName, result, choice, amountFmt, won, balanceFmt, coin } = {}) {
  const success = isTrue(won);
  return join([
    head('🎲', str(game, 'Apuesta')),
    RULE.wave,
    `ㅤ${SYM.arrow}ㅤSalió *${str(result)}* · elegiste *${str(choice)}*.`,
    success
      ? `ㅤ${SYM.leaf}ㅤ${str(userName)} ganó *${str(amountFmt, '0')} ${str(coin, '¥enes')}* (˶˃ ᵕ ˂˶)`
      : `ㅤ🌊ㅤ${str(userName)} perdió *${str(amountFmt, '0')} ${str(coin, '¥enes')}* ${KAOMOJI.sad}`,
    `ㅤ${SYM.leaf}ㅤBalance ⁙ ⛁ ${str(balanceFmt, '0')} ${str(coin, '¥enes')}`,
    RULE.wave,
    `ㅤApuesta mínima ⁙ 200 ${str(coin, '¥enes')}`,
  ]);
}

export function tEcoTransfer({ fromName, toName, amountFmt, coin, mentions = [] } = {}) {
  const t = tags(mentions);
  return join([
    head('💸', '𝑇𝑟𝑎𝑛𝑠𝑓𝑒𝑟𝑒𝑛𝑐𝑖𝑎'),
    BR,
    `ㅤ${SYM.arrow}ㅤ${str(fromName)} → ${str(toName)}`,
    `ㅤ${SYM.leaf}ㅤMonto ⁙ *${str(amountFmt, '0')} ${str(coin, '¥enes')}*`,
    t ? `ㅤ${t}` : null,
    BR,
    `ㅤ${KAOMOJI.wink}`,
  ]);
}

export function tEcoSteal({ thiefName, victimName, amountFmt, success, coin, mentions = [] } = {}) {
  const win = isTrue(success);
  const t = tags(mentions);
  return join([
    head(win ? '🥷' : '🚨', win ? '𝑅𝑜𝑏𝑜 ㅤ𝑒𝑥𝑖𝑡𝑜𝑠𝑜' : '𝑅𝑜𝑏𝑜 ㅤ𝑓𝑟𝑢𝑠𝑡𝑟𝑎𝑑𝑜'),
    win ? RULE.night : WR,
    win
      ? `ㅤ${SYM.arrow}ㅤ${str(thiefName)} le robó *${str(amountFmt, '0')} ${str(coin, '¥enes')}* a ${str(victimName)}.`
      : `ㅤ🌊ㅤ¡Atraparon a ${str(thiefName)}! Pagó *${str(amountFmt, '0')} ${str(coin, '¥enes')}* de multa.`,
    t ? `ㅤ${t}` : null,
    win ? RULE.night : WR,
    `ㅤ${win ? KAOMOJI.smug : KAOMOJI.angry}`,
  ]);
}

export function tEcoBank({ userName, action, amountFmt, coinsFmt, bankFmt, coin } = {}) {
  const deposit = String(action) !== 'withdraw';
  return join([
    head('🏦', deposit ? '𝐷𝑒𝑝𝑜́𝑠𝑖𝑡𝑜' : '𝑅𝑒𝑡𝑖𝑟𝑜'),
    BR,
    `ㅤ${SYM.arrow}ㅤ${str(userName)} ${deposit ? 'guardó' : 'retiró'} *${str(amountFmt, '0')} ${str(coin, '¥enes')}*.`,
    kv('Cartera', `⛁ ${str(coinsFmt, '0')}`),
    kv('Banco', `🏦 ${str(bankFmt, '0')}`),
    BR,
    `ㅤ${SYM.scroll}ㅤLo del banco no te lo pueden robar.`,
    `ㅤ( ᵕ ᴗ ᵕ )`,
  ]);
}

/* ═══════════════════════════════════════════════════════════════
   DESCARGAS
   ═══════════════════════════════════════════════════════════════ */

export function tDlMusic({ kind, query, searchUrl, results = [], top = null, downloaded = false } = {}) {
  const isVideo = String(kind) === 'video';
  const rows = listOf(results);
  const topData = top && typeof top === 'object' ? top : null;
  const header = head(isVideo ? '🎬' : '🎧', `${isVideo ? '𝑉𝑖𝑑𝑒𝑜' : '𝑀𝑢́𝑠𝑖𝑐𝑎'} ㅤ·ㅤ YouTube`);
  if (topData) {
    const others = rows.slice(1).map((r) => `ㅤ${SYM.clover}ㅤ${str(r?.title)}\nㅤㅤㅤ${str(r?.channel)}${r?.duration ? ` · ${str(r.duration)}` : ''} · ${str(r?.url)}`);
    return join([
      header,
      BR,
      kv('Resultado', str(topData.title)),
      topData.channel ? kv('Canal', str(topData.channel)) : null,
      topData.duration ? kv('Duración', str(topData.duration)) : null,
      topData.views ? kv('Vistas', str(topData.views)) : null,
      '',
      str(topData.url),
      downloaded ? `ㅤ${SYM.leaf}ㅤAudio descargado y enviado 💧` : null,
      ...(others.length ? ['', 'ㅤotros resultados ⁙', ...others] : []),
      BR,
      `ㅤ(˶ᵔ ᵕ ᵔ˶)`,
    ]);
  }
  return join([
    header,
    BR,
    kv('Búsqueda', str(query)),
    '',
    str(searchUrl),
    '',
    `ㅤ${SYM.leaf}ㅤSin conexión a YouTube ahora. Abre el enlace y elige tu resultado favorito.`,
    BR,
    `ㅤ(˶ᵔ ᵕ ᵔ˶)`,
  ]);
}

export function tDlTiktok({ title, author, downloaded } = {}) {
  return join([
    head('🎵', '𝑇𝑖𝑘𝑇𝑜𝑘'),
    BR,
    kv('Video', str(title)),
    kv('Autor', str(author)),
    downloaded ? `ㅤ${SYM.leaf}ㅤVideo descargado y enviado 💧` : null,
    BR,
    `ㅤ${KAOMOJI.wink}`,
  ]);
}

export function tDlInstagram({ url, downloaded } = {}) {
  return join([
    head('📸', '𝐼𝑛𝑠𝑡𝑎𝑔𝑟𝑎𝑚'),
    BR,
    str(url),
    downloaded ? `ㅤ${SYM.leaf}ㅤContenido descargado y enviado 💧` : null,
    BR,
    `ㅤ${KAOMOJI.wink}`,
  ]);
}

export function tDlSpotify({ title, author, album, url, preview } = {}) {
  return join([
    head('🎧', '𝑆𝑝𝑜𝑡𝑖𝑓𝑦'),
    BR,
    kv('Título', str(title)),
    kv('Artista', str(author)),
    album ? kv('Álbum', str(album)) : null,
    '',
    str(url),
    preview ? `ㅤ${SYM.leaf}ㅤTe envío una vista previa de 30 segundos 💧` : null,
    BR,
    `ㅤ(˶ᵔ ᵕ ᵔ˶)`,
  ]);
}

export function tDlPinterest({ query, count } = {}) {
  return join([
    head('📌', `𝑃𝑖𝑛𝑡𝑒𝑟𝑒𝑠𝑡 ㅤ·ㅤ ${str(query)}`),
    BR,
    `ㅤ${SYM.leaf}ㅤTe envío ${count} imagen${count === 1 ? '' : 'es'} encontrada${count === 1 ? '' : 's'} 💧`,
    `ㅤ${SYM.leaf}ㅤMánda cualquiera de vuelta con .s para hacer sticker.`,
    BR,
    `ㅤ${KAOMOJI.wink}`,
  ]);
}

export function tDlLink({ network, icon, url, hint } = {}) {
  return join([
    head(icon ?? '🔗', str(network, 'Enlace')),
    BR,
    str(url),
    '',
    hint ? `ㅤ${SYM.scroll}ㅤ${str(hint)}` : null,
    BR,
    `ㅤ${KAOMOJI.wink}`,
  ]);
}

export function tDlLyrics({ query, artist, title, lyrics, truncated, geniusUrl, letrasUrl } = {}) {
  if (lyrics) {
    return join([
      head('🎤', `𝐿𝑒𝑡𝑟𝑎 ㅤ·ㅤ ${str(title)}`),
      `ㅤ◢🌊◣ ㅤ${str(artist)}`,
      RULE.wave,
      str(lyrics),
      truncated ? `ㅤ…ㅤ(letra recortada) ㅤ${str(letrasUrl)}` : null,
      RULE.wave,
      `ㅤCanta bonito 🌊 ㅤ(˶˃ ᵕ ˂˶)`,
    ]);
  }
  return join([
    head('🎤', `𝐿𝑒𝑡𝑟𝑎 ㅤ·ㅤ ${str(query)}`),
    RULE.wave,
    `ㅤ${SYM.leaf}ㅤNo encontré la letra en línea. PruebM.leaf}ㅤGenius ⁙ ${str(geniusUrl)}`,
    `ㅤ${SYM.leaf}ㅤLetras ⁙ ${str(letrasUrl)}`,
    RULE.wave,
    `ㅤCanta bonito 🌊 ㅤ(˶˃ ᵕ ˂˶)`,
  ]);
}

/* ═══════════════════════════════════════════════════════════════
   PERFIL · matrimonios y datos
   ═══════════════════════════════════════════════════════════════ */

export function tPerfilProposal({ fromName, toName, minutes, mentions = [] } = {}) {
  const t = tags(mentions);
  return join([
    `ㅤ${SYM.bracketL} 💍 ${SYM.bracketR} ㅤ𝑃𝑟𝑜𝑝𝑢𝑒𝑠𝑡𝑎 ㅤ𝑑𝑒 ㅤ𝑚𝑎𝑡𝑟𝑖𝑚𝑜𝑛𝑖𝑜`,
    `ㅤ${RULE.wave}`,
    `ㅤ${str(fromName)} le propone matrimonio a ${str(toName)}`,
    t ? `ㅤ${t}` : null,
    '',
    `ㅤ${SYM.leaf}ㅤPara aceptar ⁙ ${inlineCmd('marry', '@usuario')} (mutuo)`,
    `ㅤ${SYM.leaf}ㅤExpira en ${num(minutes) || 5} minutos`,
    `ㅤ${RULE.wave}`,
    `ㅤ${KAOMOJI.love}`,
  ]);
}

export function tPerfilWedding({ aName, bName, date, mentions = [] } = {}) {
  const t = tags(mentions);
  return join([
    `ㅤ🌊.･:｡≻───── ⋆♡⋆ ─────.•:｡💧`,
    `ㅤㅤ¡Se han casado!`,
    '',
    `ㅤㅤ♡ ${str(aName)} ♡`,
    `ㅤㅤ♡ ${str(bName)} ♡`,
    '',
    `ㅤㅤ${str(date)}`,
    t ? `ㅤ${t}` : null,
    `ㅤDisfruten su luna de miel 🌊`,
    `ㅤ🌊.･:｡≻───── ⋆♡⋆ ─────.•:｡💧`,
    `ㅤ${KAOMOJI.hug}`,
  ]);
}

export function tPerfilDivorce({ aName, bName, since } = {}) {
  return join([
    head('🌀', '𝐷𝑖𝑣𝑜𝑟𝑐𝑖𝑜'),
    WR,
    `ㅤ${str(aName)} y ${str(bName)} terminaron su matrimonio.`,
    `ㅤ${SYM.leaf}ㅤJuntos desde ⁙ ${str(since)}`,
    WR,
    `ㅤ${KAOMOJI.sad}`,
  ]);
}

export function tPerfilHistory({ userName, entries, married, isSelf } = {}) {
  const rows = listOf(entries);
  const body = rows.length
    ? rows.map((row) => {
        const mark = row?.active ? '💍' : '🌊';
        const span = row?.active ? `desde ${str(row.since)} · vigente` : `${str(row?.since)} → ${str(row?.until)}`;
        return `ㅤ${mark}ㅤ${str(row?.partnerName)}ㅤ·ㅤ${span}`;
      }).join('\n')
    : 'ㅤSin matrimonios registrados todavía.';
  return join([
    head(SYM.scroll, `𝐻𝑖𝑠𝑡𝑜𝑟𝑖𝑎𝑙 ㅤ·ㅤ ${str(userName)}`),
    BR,
    body,
    BR,
    kv('Estado', married ? 'casado/a 💍' : 'soltero/a 💧'),
    isSelf ? `ㅤCásate con ㅤ${inlineCmd('marry', '@usuario')}` : null,
    `ㅤ${KAOMOJI.neutral}`,
  ]);
}

export function tPerfilPfp({ userName, photoUrl, masked, isSelf } = {}) {
  const url = String(photoUrl ?? '').trim();
  return join([
    head('🖼️', `𝐹𝑜𝑡𝑜 ㅤ·ㅤ ${str(userName)}`),
    BR,
    url ? str(photoUrl) : `ㅤ🌊ㅤ${isSelf ? 'No tienes' : 'No tiene'} foto de perfil visible o es privada.`,
    '',
    kv('Contacto', str(masked, '—')),
    BR,
    `ㅤ${KAOMOJI.wink}`,
  ]);
}

export function tPerfilField({ field, value, removed, userName } = {}) {
  const gone = isTrue(removed);
  return join([
    head('✎', '𝑃𝑒𝑟𝑓𝑖𝑙 ㅤ𝑎𝑐𝑡𝑢𝑎𝑙𝑖𝑧𝑎𝑑𝑜'),
    RULE.wave,
    gone ? `ㅤ${SYM.leaf}ㅤSe eliminó tu ${str(field)}.` : `ㅤ${SYM.arrow}ㅤ${str(field, 'Campo')} ⁙ ${str(value)}`,
    `ㅤ${SYM.leaf}ㅤDe ⁙ ${str(userName)}`,
    RULE.wave,
    `ㅤ(˶ᵔ ᵕ ᵔ˶)`,
  ]);
}

/* ═══════════════════════════════════════════════════════════════
   STICKERS
   ═══════════════════════════════════════════════════════════════ */

export function tStickerGuide({ userName, pack, author } = {}) {
  return join([
    head('⭐', '𝐶𝑟𝑒𝑎𝑟 ㅤ𝑠𝑡𝑖𝑐𝑘𝑒𝑟'),
    BR,
    `ㅤ${SYM.arrow}ㅤ${str(userName)}, responde a una imagen, video o sticker con:`,
    cmd('s', '[pack | autor]'),
    '',
    pack || author ? kv('Tus metadatos', `${str(pack, '—')} · ${str(author, '—')}`) : `ㅤGuarda tus metadatos con ㅤ${inlineCmd('setmeta', 'pack | autor')}`,
    BR,
    `ㅤ(˶ᵔ ᵕ ᵔ˶)`,
  ]);
}

export function tStickerBrat({ userName, banner, pack, author } = {}) {
  return join([
    head('🟩', '𝐵𝑅𝐴𝑇'),
    BR,
    str(banner),
    BR,
    pack || author ? kv('Firma', `${str(pack, '—')} · ${str(author, '—')}`) : null,
    `ㅤPedido por ⁙ ${str(userName)}`,
    `ㅤ${KAOMOJI.smug}`,
  ]);
}

export function tStickerMeta({ userName, pack, author, cleared } = {}) {
  const gone = isTrue(cleared);
  return join([
    head('🏷️', '𝑀𝑒𝑡𝑎𝑑𝑎𝑡𝑜𝑠'),
    BR,
    gone ? `ㅤ${SYM.leaf}ㅤ${str(userName)} eliminó sus metadatos de stickers.` : `ㅤ${SYM.arrow}ㅤGuardados para ${str(userName)}:`,
    gone ? null : kv('Pack', str(pack, '—')),
    gone ? null : kv('Autor', str(author, '—')),
    BR,
    `ㅤ${KAOMOJI.wink}`,
  ]);
}

export function tStickerSearch({ query, url, results = [], sent = 0 } = {}) {
  const packs = listOf(results);
  if (packs.length) {
    const rows = packs.map((pack) => `ㅤ${SYM.clover}ㅤ${str(pack?.name)} ⁙ ${str(pack?.author)} · ${pack?.count} stickers`);
    return join([
      head('🔍', `𝑆𝑡𝑖𝑐𝑘𝑒𝑟𝑠 ㅤ·ㅤ ${str(query)}`),
      BR,
      ...rows,
      '',
      `ㅤ${SYM.leaf}ㅤTe envío ${sent} sticker${sent === 1 ? '' : 's'} de esos paquetes a continuación.`,
      `ㅤ${SYM.leaf}ㅤMás en ⁙ ${str(url)}`,
      BR,
      `ㅤ(˶ᵔ ᵕ ᵔ˶)`,
    ]);
  }
  return join([
    head('🔍', `𝑆𝑡𝑖𝑐𝑘𝑒𝑟𝑠 ㅤ·ㅤ ${str(query)}`),
    BR,
    str(url),
    '',
    `ㅤ${SYM.leaf}ㅤAhora mismo no pude traer stickers en línea; abre el enlace y reenvía el paquete al chat.`,
    BR,
    `ㅤ(˶ᵔ ᵕ ᵔ˶)`,
  ]);
}

/* ═══════════════════════════════════════════════════════════════
   HERRAMIENTAS Y LOGOS
   ═══════════════════════════════════════════════════════════════ */

export function tToolIa({ question, answer, mode, userName } = {}) {
  const badge = String(mode) === 'online' ? 'en línea' : String(mode) === 'local' ? 'local' : 'sin conexión';
  return join([
    head('🌀', `𝐼𝐴 ㅤ·ㅤ ${badge}`),
    RULE.night,
    `ㅤ${SYM.scroll}ㅤ${str(userName)} ⁙ ${str(question)}`,
    '',
    str(answer),
    '',
    RULE.night,
    sign(),
  ]);
}

export function tToolVer({ userName, excerpt } = {}) {
  return join([
    head('👁️', '𝑉𝑖𝑠𝑡𝑎 ㅤ𝑢́𝑛𝑖𝑐𝑎'),
    BR,
    `ㅤ${SYM.arrow}ㅤContenido citado por ${str(userName)}:`,
    '',
    str(excerpt, '(vacío)'),
    '',
    BR,
    `ㅤ${SYM.scroll}ㅤSolo puedo reabrir texto: las fotos y videos efímeros se ven una vez.`,
    `ㅤ${KAOMOJI.neutral}`,
  ]);
}

export function tToolConvert({ kind, userName, steps } = {}) {
  const lines = listOf(steps);
  return join([
    head('🔁', str(kind, 'Conversión')),
    BR,
    `ㅤ${SYM.arrow}ㅤ${str(userName)}, sigue estos pasos:`,
    ...lines.map((step, index) => `ㅤ${index + 1}.ㅤ${str(step)}`),
    BR,
    `ㅤ${KAOMOJI.wink}`,
  ]);
}

export function tLogoCard({ title, emoji, text, userName, generated = true } = {}) {
  return join([
    head(emoji ?? '💧', `𝐿𝑜𝑔𝑜 ㅤ·ㅤ ${str(title)}`),
    RULE.wave,
    `ㅤ◢🌊◣ ㅤ${str(text)}`,
    '',
    `ㅤ${SYM.leaf}ㅤEfecto ⁙ ${str(title)}`,
    `ㅤ${SYM.leaf}ㅤPedido por ⁙ ${str(userName)}`,
    RULE.wave,
    generated ? `ㅤ${SYM.scroll}ㅤTu logo está listo 💧 generado al momento por el bot.` : `ㅤ${SYM.scroll}ㅤNo pude dibujar la imagen ahora; inténtalo otra vez.`,
    `ㅤ(˶ᵔ ᵕ ᵔ˶)`,
  ]);
}

/* ═══════════════════════════════════════════════════════════════
   Mapa vista → plantilla Tomioka (sin mod.warn ni menu.*)
   ═══════════════════════════════════════════════════════════════ */

export const TOMIOKA_VIEWS = {
  'reg.success': tRegSuccess,
  'reg.rejected': tRegRejected,
  'reg.duplicate': tRegDuplicate,
  'reg.edit.success': tEditSuccess,
  'reg.unreg.ask': tUnregAsk,
  'reg.unreg.success': tUnregSuccess,
  'user.card': tCard,
  'user.profile': tProfileCard,
  'user.notRegistered': tNotRegistered,
  'role.request.created': tRoleRequestCreated,
  'role.request.notifyAdmins': tAdminRoleNotify,
  'role.assigned': tRoleAssigned,
  'role.occupied': tRoleOccupied,
  'role.released': tRoleReleased,
  'role.rejected': tRoleRequestRejected,
  'role.list': tRolesList,
  'role.mine': tMyRole,
  'role.reserve.success': tReserveSuccess,
  'role.reserve.rejected': tReserveRejected,
  'role.reservations': tReservationsList,
  'role.pending': tPendingList,
  'team.info': tTeamInfo,
  'team.members': tMembersList,
  'team.afk.set': tAfkSet,
  'team.afk.clear': tAfkCleared,
  'team.afk.mention': tAfkMention,
  'team.inactives': tInactivesList,
  'team.afk.list': tAfkList,
  'team.config.updated': tConfigUpdated,
  'team.config.list': tConfigList,
  'team.audit': tAuditList,
  'couple.proposal': tCoupleProposal,
  'couple.accepted': tCoupleAccepted,
  'couple.rejected': tCoupleRejected,
  'couple.broken': tCoupleBroken,
  'couple.error': tCoupleError,
  'social.ship': tShip,
  'social.rules': tRules,
  'social.admins': tAdminsList,
  'fun.dado': tDado,
  'fun.moneda': tMoneda,
  'fun.8ball': tBola8,
  'fun.elegir': tElegir,
  'fun.sorteo': tSorteo,
  'fun.encuesta': tEncuesta,
  'fun.invertir': tInvertir,
  'mod.unwarn': tUnwarnNotice,
  'mod.unban': tUnbanNotice,
  'mod.warnHistory': tWarnHistory,
  'mod.blockedList': tBlockedList,
  'mod.kick': tKickNotice,
  'mod.denied': tModDenied,
  'mod.bannedRejoin': tBannedRejoin,
  'mod.announcement': tAnnouncement,
  'mod.groupClosed': tGroupClosed,
  'mod.groupOpened': tGroupOpened,
  'mod.addResult': tAddResult,
  'mod.invite': tInviteLinkCard,
  'mod.promote': tModPromote,
  'mod.demote': tModDemote,
  'mod.tagall': tModTagall,
  'mod.notify': tModNotify,
  'mod.revoke': tModRevoke,
  'mod.mute': tModMute,
  'mod.unmute': tModUnmute,
  'mod.mutelist': tModMutelist,
  'mod.toggle': tModToggle,
  'mod.settext': tModSettext,
  'group.welcome': tWelcome,
  'group.farewell': tFarewell,
  'sys.invalid': tInvalidInput,
  'sys.confirm.ask': tConfirmAsk,
  'sys.confirm.cancelled': tConfirmCancelled,
  'sys.confirm.nothing': tConfirmNothing,
  'sys.confirm.expired': tConfirmExpired,
  'sys.error': tError,
  'sys.ping': tPing,
  'sys.owner': tOwnerCard,
  'sys.key': tActivationKey,
  'sys.pairing': tPairingCodeCard,
  'sys.inactive': tBotInactive,
  'sys.noPermission': tNoPermission,
  'sys.rateLimited': tRateLimited,
  'sys.groupOnly': tGroupOnly,
  'sys.unknownCommand': tUnknownCommand,
  'sys.botInfo': tBotInfo,
  'sys.status': tSysStatus,
  'sys.userid': tSysUserid,
  'anime.react': tAnimeReact,
  'eco.balance': tEcoBalance,
  'eco.top': tEcoTop,
  'eco.einfo': tEcoEinfo,
  'eco.result': tEcoResult,
  'eco.daily': tEcoDaily,
  'eco.bet': tEcoBet,
  'eco.transfer': tEcoTransfer,
  'eco.steal': tEcoSteal,
  'eco.bank': tEcoBank,
  'dl.music': tDlMusic,
  'dl.tiktok': tDlTiktok,
  'dl.instagram': tDlInstagram,
  'dl.spotify': tDlSpotify,
  'dl.pinterest': tDlPinterest,
  'dl.link': tDlLink,
  'dl.lyrics': tDlLyrics,
  'perfil.proposal': tPerfilProposal,
  'perfil.wedding': tPerfilWedding,
  'perfil.divorce': tPerfilDivorce,
  'perfil.history': tPerfilHistory,
  'perfil.pfp': tPerfilPfp,
  'perfil.field': tPerfilField,
  'sticker.guide': tStickerGuide,
  'sticker.brat': tStickerBrat,
  'sticker.meta': tStickerMeta,
  'sticker.search': tStickerSearch,
  'tool.ia': tToolIa,
  'tool.ver': tToolVer,
  'tool.convert': tToolConvert,
  'logo.card': tLogoCard,
};

export default TOMIOKA_VIEWS;
