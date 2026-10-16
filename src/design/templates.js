/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · plantillas de mensajes
 * ────────────────────────────────────────────────────────────────
 * Cada acción tiene SU PROPIO diseño: marcos, iconos, kaomojis y
 * separadores distintos. Ningún mensaje se repite visualmente.
 *
 * Las funciones reciben datos ya saneados por los servicios y
 * devuelven texto plano listo para WhatsApp.
 */
import { IDENTITY } from '../config/identity.js';
import { SYM, RULE, KAOMOJI, kv, bullet, cmd, inlineCmd, footer, signature, frame, statusLine, bar, fancyNumber, section, versovaHeader, mention, miniHeader, currentPrefix } from './theme.js';
import { formatDate, formatDateLong, formatDateTime, formatDuration, timeAgo } from '../utils/time.js';
import { maskPhone } from '../utils/ids.js';

/** Prefijo del sub-bot que está renderizando (se fija antes de cada mensaje). */
const P = { toString: () => currentPrefix() };
const line = (n = 22) => '─'.repeat(n);

/* ═══════════════════════════════════════════════════════════════
   ① REGISTRO
   ═══════════════════════════════════════════════════════════════ */

export function regSuccess({ name, age, phone, date, total, groupName }) {
  return [
    `ㅤ${SYM.bracketL} ${SYM.coffee} ${SYM.bracketR} ㅤ𝑅𝑒𝑔𝑖𝑠𝑡𝑟𝑜 ㅤ𝑒𝑥𝑖𝑡𝑜𝑠𝑜`,
    RULE.coffee,
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
    '',
    `ㅤ${KAOMOJI.soft}`,
    `ㅤ${signature()}`,
  ].join('\n');
}

export function regRejected({ reason, hint = null }) {
  return [
    `${SYM.bracketL} ✗ ${SYM.bracketR} ㅤ𝑅𝑒𝑔𝑖𝑠𝑡𝑟𝑜 ㅤ𝑟𝑒𝑐ℎ𝑎𝑧𝑎𝑑𝑜`,
    RULE.chain,
    `ㅤ${SYM.chain}ㅤ${reason}`,
    hint ? `ㅤ${SYM.leaf}ㅤ${hint}` : null,
    '',
    `ㅤFormato válido:`,
    cmd('reg', '<nombre.edad>'),
    `ㅤEjemplo: ㅤ${inlineCmd('reg', 'Moon.17')}`,
    RULE.chain,
    `ㅤ${KAOMOJI.sad}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function regDuplicate({ name, since }) {
  return [
    `𓆩 ⛓️ 𓆪 ㅤ𝒀𝒂 ㅤ𝒆𝒔𝒕𝒂́𝒔 ㅤ𝒓𝒆𝒈𝒊𝒔𝒕𝒓𝒂𝒅𝒐`,
    RULE.dotted,
    `ㅤ${SYM.leaf}ㅤ${name} ya tiene ficha en este grupo.`,
    `ㅤ${SYM.leaf}ㅤRegistrado ${timeAgo(since)}.`,
    '',
    `ㅤ¿Quieres corregir tus datos?`,
    cmd('editar', '<nombre.edad>'),
    `ㅤ¿Prefieres empezar de cero?`,
    cmd('unreg'),
    RULE.dotted,
    `ㅤ${KAOMOJI.smug}`,
  ].join('\n');
}

export function editSuccess({ before, after }) {
  return [
    `${SYM.bracketL} ✎ ${SYM.bracketR} ㅤ𝐹𝑖𝑐ℎ𝑎 ㅤ𝑎𝑐𝑡𝑢𝑎𝑙𝑖𝑧𝑎𝑑𝑎`,
    `ㅤ${RULE.thin}`,
    `ㅤ${SYM.arrow}ㅤAntes ⁙ ${before.name} · ${before.age} años`,
    `ㅤ${SYM.arrow}ㅤAhora ⁙ ${after.name} · ${after.age} años`,
    '',
    `ㅤ${SYM.leaf}ㅤTu personaje no se modificó: ${after.role ?? 'ninguno'}`,
    `ㅤ${KAOMOJI.sparkle}`,
  ].join('\n');
}

export function unregAsk({ name, role, couple, ttl = 60 }) {
  return [
    `${SYM.bracketL} ${SYM.purify} ${SYM.bracketR} ㅤ𝐶𝑜𝑛𝑓𝑖𝑟𝑚𝑎 ㅤ𝑡𝑢 ㅤ𝑠𝑎𝑙𝑖𝑑𝑎`,
    RULE.blade,
    `ㅤ${SYM.chain}ㅤVas a borrar la ficha de ㅤ${name}.`,
    role ? `ㅤ${SYM.leaf}ㅤSe liberará tu personaje: ㅤ${role}` : null,
    couple ? `ㅤ${SYM.leaf}ㅤSe terminará tu relación con: ㅤ${couple}` : null,
    `ㅤ${SYM.leaf}ㅤSe cancelarán tus reservas y solicitudes.`,
    '',
    `ㅤPara confirmar ⁙ ${inlineCmd('confirmar')}`,
    `ㅤPara cancelar ⁙ㅤ ${inlineCmd('cancelar')}`,
    `ㅤExpira en ${ttl} segundos. ㅤ${KAOMOJI.serious}`,
    RULE.blade,
  ]
    .filter(Boolean)
    .join('\n');
}

export function unregSuccess({ name, role, couple, requests, reservation }) {
  return [
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
    `ㅤ${KAOMOJI.sleep}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/* ═══════════════════════════════════════════════════════════════
   ② FICHAS Y PERFILES
   ═══════════════════════════════════════════════════════════════ */

/** Ficha propia (`.ficha`) — tarjeta compacta con marco. */
export function card({ name, age, role, roleSince, registeredAt, status, warns, maxWarns, afk, partner, phone, lastActivity, reserved }) {
  const statusLabel = { active: 'ᴏɴʟɪɴᴇ', left: 'ꜰᴜᴇʀᴀ ᴅᴇʟ ɢʀᴜᴘᴏ', kicked: 'ᴇxᴘᴜʟsᴀᴅᴏ', banned: 'ʙʟᴏqᴜᴇᴀᴅᴏ' }[status] ?? status;
  return [
    `ㅤ╭─────── ${SYM.bracketL} ${SYM.coffee} ${SYM.bracketR} ───────╮`,
    `ㅤ│ㅤ𝐅𝐈𝐂𝐇𝐀 ㅤ·ㅤ ${name}`,
    `ㅤ├${line(26)}`,
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
    `ㅤ│ㅤ${SYM.leaf} Warns ㅤㅤ⁙ㅤ ${warns}/${maxWarns} ㅤ${bar(warns, maxWarns, '⛓', '·')}`,
    `ㅤ╰─────── ${SYM.crownSmall} ${SYM.bracketR} ───────╯`,
    `ㅤㅤ${KAOMOJI.cozy}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Perfil público de otra persona (`.perfil @user`) — número enmascarado. */
export function profileCard({ name, age, role, registeredAt, partner, afk, phone, warns, isSelf }) {
  return [
    `${SYM.bracketL} ${SYM.star} ${SYM.bracketR} ㅤ𝑃𝑒𝑟𝑓𝑖𝑙 ㅤ𝑑𝑒 ㅤ${name}`,
    RULE.sakura,
    kv('Nombre', name),
    kv('Edad', `${age} años`),
    kv('Personaje', role ? `${SYM.chopsticks} ${role}` : 'sin asignar'),
    kv('Registro', formatDateLong(registeredAt)),
    kv('Pareja', partner ? `${SYM.heart} ${partner}` : 'soltero/a ☕'),
    kv('Estado', afk ? `${SYM.moon} AFK · ${afk.reason}` : 'activo/a'),
    kv('Warns', String(warns)),
    kv('Contacto', maskPhone(phone)),
    RULE.sakura,
    `ㅤ${isSelf ? 'Este eres tú ' : 'Ficha pública '}${KAOMOJI.wink}`,
  ].join('\n');
}

export function notRegistered({ command = null, name = null } = {}) {
  return [
    `${SYM.bracketL} ✗ ${SYM.bracketR} ㅤ𝑁𝑜 ㅤ𝑒𝑠𝑡𝑎́𝑠 ㅤ𝑟𝑒𝑔𝑖𝑠𝑡𝑟𝑎𝑑${name ? ` (${name})` : 'o/a'}`,
    RULE.thin,
    command ? `ㅤ${SYM.chain}ㅤ${command} requiere ficha en el team.` : null,
    `ㅤ${SYM.scroll}ㅤRegístrate primero:`,
    cmd('reg', '<nombre.edad>'),
    `ㅤEjemplo: ㅤ${inlineCmd('reg', 'Moon.17')}`,
    RULE.thin,
    `ㅤ${KAOMOJI.serious}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/* ═══════════════════════════════════════════════════════════════
   ③ PERSONAJES / ROLES
   ═══════════════════════════════════════════════════════════════ */

export function roleRequestCreated({ roleName, requestId, admins, type = 'role', prevRole = null }) {
  const title = type === 'role_change' ? '𝑆𝑜𝑙𝑖𝑐𝑖𝑡𝑢𝑑 ㅤ𝑑𝑒 ㅤ𝑐𝑎𝑚𝑏𝑖𝑜' : '𝑆𝑜𝑙𝑖𝑐𝑖𝑡𝑢𝑑 ㅤ𝑝𝑒𝑛𝑑𝑖𝑒𝑛𝑡𝑒';
  return [
    `ㅤㅤ⏳ ㅤ${title}`,
    RULE.dotted,
    `ㅤ${SYM.leaf}ㅤPersonaje ⁙ ${SYM.chopsticks} ${roleName}`,
    prevRole ? `ㅤ${SYM.leaf}ㅤDejas ㅤㅤ⁙ ${prevRole}` : null,
    `ㅤ${SYM.leaf}ㅤFolio ㅤㅤ⁙ #${requestId}`,
    `ㅤ${SYM.leaf}ㅤEstado ㅤ⁙ ᴘᴇɴᴅɪᴇɴᴛᴇ`,
    '',
    `ㅤ${SYM.scroll}ㅤSe avisó a ${admins} admin${admins === 1 ? '' : 's'} del grupo.`,
    `ㅤEspera su respuesta ㅤ${KAOMOJI.shy}`,
    RULE.dotted,
    `ㅤPuedes anularla con ㅤ${inlineCmd('cancelarsolicitud')}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Aviso a los administradores (menciona a todos los admins). */
export function adminRoleNotify({ requestId, userName, userMention, roleName, type, prevRole, adminMentions }) {
  return [
    `${SYM.bracketL} ${SYM.chain} ${SYM.bracketR} ㅤ𝑁𝑢𝑒𝑣𝑎 ㅤ𝑠𝑜𝑙𝑖𝑐𝑖𝑡𝑢𝑑 ㅤ#${requestId}`,
    RULE.chain,
    `ㅤ${SYM.leaf}ㅤTipo ㅤㅤㅤ⁙ ${type === 'role_change' ? 'cambio de personaje' : 'asignación de personaje'}`,
    `ㅤ${SYM.leaf}ㅤQuien ㅤㅤ⁙ ${userName} ${userMention}`,
    `ㅤ${SYM.leaf}ㅤPide ㅤㅤㅤ⁙ ${SYM.chopsticks} ${roleName}`,
    prevRole ? `ㅤ${SYM.leaf}ㅤLibera ㅤㅤ⁙ ${prevRole}` : null,
    RULE.chain,
    `ㅤPara aprobar ⁙ ${inlineCmd('acceptrol', `#${requestId}`)}`,
    `ㅤPara rechazar ⁙ ${inlineCmd('denyrol', `#${requestId}`)}`,
    `ㅤTambién funciona respondiendo a este mensaje.`,
    '',
    `ㅤ${adminMentions.join(' ')}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function roleAssigned({ roleName, userName, approvedBy, type, prevRole, mentions = [] }) {
  return [
    `ㅤ${SYM.bracketL} ${SYM.chopsticks} ${SYM.bracketR} ㅤ𝑃𝑒𝑟𝑠𝑜𝑛𝑎𝑗𝑒 ㅤ𝑎𝑠𝑖𝑔𝑛𝑎𝑑𝑜`,
    `ㅤ${RULE.wave}`,
    `ㅤ${SYM.arrow}ㅤ${userName} ahora interpreta a:`,
    `ㅤㅤ◢${SYM.curse}◣ ㅤ${roleName}`,
    prevRole ? `ㅤ${SYM.leaf}ㅤPersonaje liberado ⁙ ${prevRole}` : null,
    `ㅤ${SYM.leaf}ㅤAprobado por ⁙ ${approvedBy}`,
    `ㅤ${RULE.wave}`,
    `ㅤ${mentions.length ? `${mentions.map(mention).join(' ')}ㅤ` : ''}${KAOMOJI.cheer}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function roleOccupied({ roleName, ownerName, since, reserved = false, until = null }) {
  return [
    `${SYM.bracketL} ⛔ ${SYM.bracketR} ㅤ𝑃𝑒𝑟𝑠𝑜𝑛𝑎𝑗𝑒 ㅤ𝑜𝑐𝑢𝑝𝑎𝑑𝑜`,
    RULE.chain,
    `ㅤ${SYM.chain}ㅤ${SYM.chopsticks} ${roleName} ya tiene dueño/a.`,
    `ㅤ${SYM.leaf}ㅤLo interpreta ⁙ ${ownerName}`,
    reserved
      ? `ㅤ${SYM.leaf}ㅤReservado hasta ⁙ ${formatDateTime(until)} (${formatDuration(until - Date.now())})`
      : `ㅤ${SYM.leaf}ㅤDesde ⁙ ${formatDate(since)}`,
    '',
    `ㅤElige otro personaje libre con ㅤ${inlineCmd('rol', '<personaje>')}`,
    RULE.chain,
    `ㅤ${KAOMOJI.sad}`,
  ].join('\n');
}

export function roleReleased({ roleName, byAdmin = false, adminName = null, userName = null }) {
  return [
    `${SYM.bracketL} ${SYM.purify} ${SYM.bracketR} ㅤ𝑃𝑒𝑟𝑠𝑜𝑛𝑎𝑗𝑒 ㅤ𝑙𝑖𝑏𝑒𝑟𝑎𝑑𝑜`,
    RULE.sakura,
    `ㅤ${SYM.leaf}ㅤ${SYM.chopsticks} ${roleName} vuelve a estar disponible.`,
    byAdmin ? `ㅤ${SYM.leaf}ㅤLiberado por ${adminName} (reset de rol)` : null,
    userName ? `ㅤ${SYM.leaf}ㅤAntes lo interpretaba ⁙ ${userName}` : null,
    `ㅤ${SYM.leaf}ㅤCualquiera puede pedirlo con ㅤ${inlineCmd('rol', roleName)}`,
    RULE.sakura,
    `ㅤ${KAOMOJI.neutral}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function roleRequestRejected({ roleName, reason, rejectedBy, keptRole = null }) {
  return [
    `${SYM.bracketL} ✗ ${SYM.bracketR} ㅤ𝑆𝑜𝑙𝑖𝑐𝑖𝑡𝑢𝑑 ㅤ𝑟𝑒𝑐ℎ𝑎𝑧𝑎𝑑𝑎`,
    RULE.blade,
    `ㅤ${SYM.chain}ㅤ${roleName} no te fue asignado.`,
    `ㅤ${SYM.leaf}ㅤMotivo ⁙ ${reason ?? 'sin especificar'}`,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${rejectedBy}`,
    keptRole ? `ㅤ${SYM.leaf}ㅤConservas tu personaje ⁙ ${keptRole}` : null,
    RULE.blade,
    `ㅤ${KAOMOJI.serious}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function rolesList({ roles, reserved, total, free, groupName }) {
  const takenBlock = roles.length
    ? roles.map((r, i) => `ㅤ${String(i + 1).padStart(2, '0')} ${SYM.chopsticks} ${r.name.padEnd(14, ' ')} ⁙ ${r.owner_name ?? '—'}`).join('\n')
    : 'ㅤTodavía nadie interpreta un personaje.';
  const reservedBlock = reserved.length
    ? reserved
        .map((r) => `ㅤ⏳ ${r.name} ⁙ ${r.reserved_name ?? '—'} · ${formatDuration(r.reserved_until - Date.now())}`)
        .join('\n')
    : null;
  return [
    `${SYM.bracketL} ${SYM.chopsticks} ${SYM.bracketR} ㅤ𝑃𝑒𝑟𝑠𝑜𝑛𝑎𝑗𝑒𝑠 ㅤ𝑜𝑐𝑢𝑝𝑎𝑑𝑜𝑠`,
    `ㅤ${groupName}`,
    RULE.thin,
    takenBlock,
    reservedBlock ? [RULE.dotted, 'ㅤReservas activas', reservedBlock].join('\n') : null,
    RULE.thin,
    kv('Ocupados', String(total)),
    kv('Libres', String(free)),
    kv('Reservados', String(reserved.length)),
    `ㅤ${KAOMOJI.cat}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function myRole({ name, roleName, since, reserved }) {
  if (!roleName) {
    return [
      `${SYM.bracketL} ${SYM.moon} ${SYM.bracketR} ㅤ𝑆𝑖𝑛 ㅤ𝑝𝑒𝑟𝑠𝑜𝑛𝑎𝑗𝑒`,
      RULE.night,
      `ㅤ${name}, todavía no interpretas a nadie.`,
      `ㅤPide uno con ㅤ${inlineCmd('rol', '<personaje>')}`,
      `ㅤO reserva uno 24 h con ㅤ${inlineCmd('reservar', '<personaje>')}`,
      RULE.night,
      `ㅤ${KAOMOJI.shy}`,
    ].join('\n');
  }
  return [
    `${SYM.bracketL} ${SYM.chopsticks} ${SYM.bracketR} ㅤ𝑇𝑢 ㅤ𝑝𝑒𝑟𝑠𝑜𝑛𝑎𝑗𝑒`,
    RULE.wave,
    `ㅤ${SYM.arrow}ㅤ${name} ⁙ ${roleName}`,
    since ? `ㅤ${SYM.leaf}ㅤAsignado ${timeAgo(since)}` : null,
    reserved ? `ㅤ${SYM.leaf}ㅤReserva de ${reserved.name} hasta ${formatDateTime(reserved.until)} (${formatDuration(reserved.until - Date.now())})` : null,
    RULE.wave,
    `ㅤPara soltarlo ⁙ ${inlineCmd('liberar')}`,
    `ㅤ${KAOMOJI.cool}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function reserveSuccess({ roleName, until, hours, userName }) {
  return [
    `${SYM.bracketL} ⏳ ${SYM.bracketR} ㅤ𝑅𝑒𝑠𝑒𝑟𝑣𝑎 ㅤ𝑐𝑜𝑛𝑓𝑖𝑟𝑚𝑎𝑑𝑎`,
    RULE.coffee,
    `ㅤ${SYM.leaf}ㅤPersonaje ⁙ ${SYM.chopsticks} ${roleName}`,
    `ㅤ${SYM.leaf}ㅤReserva ㅤ⁙ ${userName}`,
    `ㅤ${SYM.leaf}ㅤVence ㅤㅤ⁙ ${formatDateTime(until)}`,
    `ㅤ${SYM.leaf}ㅤDuración ⁙ ${hours} h`,
    `ㅤ${SYM.leaf}ㅤRestante ⁙ ${formatDuration(until - Date.now())}`,
    '',
    `ㅤCuando venza se libera automáticamente.`,
    `ㅤHazlo tuyo con ㅤ${inlineCmd('rol', roleName)}`,
    RULE.coffee,
    `ㅤ${KAOMOJI.smug}`,
  ].join('\n');
}

export function reserveRejected({ reason, roleName = null }) {
  return [
    `${SYM.bracketL} ✗ ${SYM.bracketR} ㅤ𝑅𝑒𝑠𝑒𝑟𝑣𝑎 ㅤ𝑟𝑒𝑐ℎ𝑎𝑧𝑎𝑑𝑎`,
    RULE.chain,
    roleName ? `ㅤ${SYM.chain}ㅤ${roleName}: ${reason}` : `ㅤ${SYM.chain}ㅤ${reason}`,
    RULE.chain,
    `ㅤ${KAOMOJI.sad}`,
  ].join('\n');
}

export function reservationsList({ list, groupName }) {
  if (!list.length) {
    return [
      `${SYM.bracketL} ⏳ ${SYM.bracketR} ㅤ𝑆𝑖𝑛 ㅤ𝑟𝑒𝑠𝑒𝑟𝑣𝑎𝑠`,
      RULE.dotted,
      `ㅤNo hay personajes reservados en ${groupName}.`,
      `ㅤReserva uno con ㅤ${inlineCmd('reservar', '<personaje>')}`,
      RULE.dotted,
    ].join('\n');
  }
  return [
    `${SYM.bracketL} ⏳ ${SYM.bracketR} ㅤ𝑅𝑒𝑠𝑒𝑟𝑣𝑎𝑠 ㅤ𝑎𝑐𝑡𝑖𝑣𝑎𝑠`,
    RULE.dotted,
    ...list.map(
      (r) => `ㅤ⏳ ${r.name.padEnd(14, ' ')} ⁙ ${r.reserved_name ?? '—'}ㅤ·ㅤ${formatDuration(r.reserved_until - Date.now())}`
    ),
    RULE.dotted,
    kv('Total', String(list.length)),
    `ㅤ${KAOMOJI.neutral}`,
  ].join('\n');
}

export function pendingList({ requests, isAdmin }) {
  if (!requests.length) {
    return [
      `${SYM.bracketL} ⏳ ${SYM.bracketR} ㅤ𝑁𝑎𝑑𝑎 ㅤ𝑝𝑒𝑛𝑑𝑖𝑒𝑛𝑡𝑒`,
      RULE.thin,
      `ㅤNo hay solicitudes en espera.`,
      RULE.thin,
      `ㅤ${KAOMOJI.cat}`,
    ].join('\n');
  }
  const labels = { role: 'rol', role_change: 'cambio', couple: 'pareja' };
  return [
    `${SYM.bracketL} ⏳ ${SYM.bracketR} ㅤ𝑆𝑜𝑙𝑖𝑐𝑖𝑡𝑢𝑑𝑒𝑠 ㅤ𝑝𝑒𝑛𝑑𝑖𝑒𝑛𝑡𝑒𝑠`,
    RULE.dotted,
    ...requests.map(
      (r) =>
        `ㅤ#${String(r.id).padEnd(4, ' ')} ${labels[r.type] ?? r.type} ⁙ ${r.user_name ?? '—'} → ${r.role_name ?? r.target_name ?? '—'}ㅤ·ㅤ${timeAgo(r.created_at)}`
    ),
    RULE.dotted,
    kv('Total', String(requests.length)),
    isAdmin ? `ㅤAprueba con ㅤ${inlineCmd('acceptrol', '#id')} ㅤo responde al mensaje.` : null,
    `ㅤ${KAOMOJI.serious}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/* ═══════════════════════════════════════════════════════════════
   ④ GESTIÓN DEL TEAM
   ═══════════════════════════════════════════════════════════════ */

export function teamInfo({ name, groupName, createdAt, members, registered, rolesTaken, rolesTotal, admins, couples, afk, instance, version }) {
  return [
    versovaHeader({ subtitle: `${KAOMOJI.happy}` }),
    `ㅤㅤ${SYM.bracketL} ${SYM.coffee} ${SYM.bracketR} ㅤ𝐼𝑛𝑓𝑜 ㅤ𝑑𝑒𝑙 ㅤ𝑡𝑒𝑎𝑚`,
    RULE.coffee,
    kv('Team', name),
    kv('Grupo', groupName),
    kv('Creado', createdAt ? formatDateLong(createdAt) : '—'),
    kv('Integrantes', `${members} en el grupo`),
    kv('Registrados', `${registered} con ficha`),
    kv('Personajes', `${rolesTaken} ocupados · ${rolesTotal - rolesTaken} libres`),
    kv('Admins', String(admins)),
    kv('Parejas', String(couples)),
    kv('AFK ahora', String(afk)),
    RULE.coffee,
    kv('Bot', `${instance} · v${version}`),
    `ㅤㅤ${KAOMOJI.cozy}`,
    `ㅤㅤ${SYM.crown}`,
  ].join('\n');
}

export function membersList({ members, total, groupName, max = 40 }) {
  if (!members.length) {
    return [
      `${SYM.bracketL} ${SYM.leaf} ${SYM.bracketR} ㅤ𝑆𝑖𝑛 ㅤ𝑟𝑒𝑔𝑖𝑠𝑡𝑟𝑜𝑠`,
      RULE.dotted,
      `ㅤNadie se ha registrado todavía en ${groupName}.`,
      `ㅤEmpieza tú: ㅤ${inlineCmd('reg', '<nombre.edad>')}`,
      RULE.dotted,
      `ㅤ${KAOMOJI.wink}`,
    ].join('\n');
  }
  const shown = members.slice(0, max);
  return [
    `${SYM.bracketL} ${SYM.leaf} ${SYM.bracketR} ㅤ𝐼𝑛𝑡𝑒𝑔𝑟𝑎𝑛𝑡𝑒𝑠 ㅤ𝑑𝑒𝑙 ㅤ𝑡𝑒𝑎𝑚`,
    `ㅤ${groupName}`,
    RULE.thin,
    ...shown.map((m, i) => {
      const idx = String(i + 1).padStart(2, '0');
      const role = m.role_name ? `${SYM.chopsticks} ${m.role_name}` : '· sin rol';
      const afk = m.afk_reason ? ` ${SYM.moon}` : '';
      return `ㅤ${idx} ⁙ ${m.name.padEnd(12, ' ')} ${role}${afk}`;
    }),
    total > shown.length ? `ㅤ… y ${total - shown.length} más` : null,
    RULE.thin,
    kv('Registrados', String(total)),
    `ㅤ${KAOMOJI.hug}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function afkSet({ name, reason, since }) {
  return [
    `${SYM.bracketL} ${SYM.moon} ${SYM.bracketR} ㅤ𝐴𝐹𝐾 ㅤ𝑎𝑐𝑡𝑖𝑣𝑎𝑑𝑜`,
    RULE.night,
    `ㅤ${SYM.moon}ㅤ${name} está ausente.`,
    `ㅤ${SYM.leaf}ㅤMotivo ⁙ ${reason}`,
    `ㅤ${SYM.leaf}ㅤDesde ⁙ ${formatTime2(since)}`,
    '',
    `ㅤSi alguien te menciona, el bot avisará.`,
    `ㅤVuelve a escribir cualquier cosa y sales del AFK.`,
    RULE.night,
    `ㅤ${KAOMOJI.sleep}`,
  ].join('\n');
}

export function afkCleared({ name, duration }) {
  return [
    `${SYM.bracketL} ${SYM.sun} ${SYM.bracketR} ㅤ𝐴𝐹𝐾 ㅤ𝑑𝑒𝑠𝑎𝑐𝑡𝑖𝑣𝑎𝑑𝑜`,
    `ㅤ${RULE.coffee}`,
    `ㅤ${SYM.sun}ㅤ${name} volvió al rol.`,
    `ㅤ${SYM.leaf}ㅤAusente durante ${duration}`,
    `ㅤ${RULE.coffee}`,
    `ㅤ${KAOMOJI.cheer}`,
  ].join('\n');
}

export function afkMention({ name, reason, since, mentioned }) {
  return [
    `${SYM.moon} ㅤ${mentioned} ㅤ${name} está AFK`,
    `ㅤ${SYM.leaf}ㅤMotivo ⁙ ${reason}`,
    `ㅤ${SYM.leaf}ㅤDesde ⁙ ${timeAgo(since)}`,
    `ㅤ${KAOMOJI.sleep}`,
  ].join('\n');
}

export function afkList({ list, groupName }) {
  return [
    `${SYM.bracketL} ${SYM.moon} ${SYM.bracketR} ㅤ𝐴𝑢𝑠𝑒𝑛𝑡𝑒𝑠 ㅤ𝑎ℎ𝑜𝑟𝑎 ㅤ·ㅤ ${groupName}`,
    RULE.night,
    ...list.slice(0, 20).map((u) => `ㅤ${SYM.moon}ㅤ${u.name.padEnd(12, ' ')} ⁙ ${u.afk_reason}ㅤ·ㅤ${timeAgo(u.afk_since)}`),
    RULE.night,
    kv('En AFK', String(list.length)),
    `ㅤ${KAOMOJI.sleep}`,
  ].join('\n');
}

export function inactivesList({ list, days, groupName }) {
  if (!list.length) {
    return [
      `${SYM.bracketL} ✨ ${SYM.bracketR} ㅤ𝑇𝑜𝑑𝑜𝑠 ㅤ𝑎𝑐𝑡𝑖𝑣𝑜𝑠`,
      RULE.sakura,
      `ㅤNadie lleva ${days} días o más sin escribir en ${groupName}.`,
      RULE.sakura,
      `ㅤ${KAOMOJI.sparkle}`,
    ].join('\n');
  }
  return [
    `${SYM.bracketL} ${SYM.moon} ${SYM.bracketR} ㅤ𝐼𝑛𝑎𝑐𝑡𝑖𝑣𝑜𝑠 ㅤ·ㅤ${days}+ días`,
    RULE.dotted,
    ...list.slice(0, 30).map((u, i) => {
      const d = Math.floor((Date.now() - u.last_activity) / 86_400_000);
      return `ㅤ${String(i + 1).padStart(2, '0')} ⁙ ${u.name.padEnd(12, ' ')} ${String(d).padStart(3, ' ')} d ㅤ·ㅤ ${u.role_name ?? 'sin rol'}`;
    }),
    RULE.dotted,
    kv('Total', String(list.length)),
    `ㅤUmbral editable: ㅤ${inlineCmd('config', 'inactividad <días>')}`,
    `ㅤ${KAOMOJI.serious}`,
  ].join('\n');
}

/* ═══════════════════════════════════════════════════════════════
   ⑤ INTERACCIÓN SOCIAL
   ═══════════════════════════════════════════════════════════════ */

export function coupleProposal({ fromName, toName, toMention, groupName }) {
  return [
    `ㅤ${SYM.bracketL} ${SYM.heart} ${SYM.bracketR} ㅤ𝑃𝑟𝑜𝑝𝑢𝑒𝑠𝑡𝑎 ㅤ𝑑𝑒 ㅤ𝑝𝑎𝑟𝑒𝑗𝑎`,
    `ㅤ${RULE.sakura}`,
    `ㅤ${fromName} quiere formar pareja con ${toName}`,
    `ㅤ${toMention}`,
    '',
    `ㅤ${SYM.leaf}ㅤAceptar ⁙ ${inlineCmd('aceptar')}`,
    `ㅤ${SYM.leaf}ㅤRechazar ⁙ ${inlineCmd('rechazar')}`,
    `ㅤ${RULE.sakura}`,
    `ㅤ${KAOMOJI.love}`,
  ].join('\n');
}

export function coupleAccepted({ a, b, mentions = [] }) {
  return [
    `ㅤ${SYM.bracketL} ${SYM.heart}${SYM.heart} ${SYM.bracketR}`,
    `ㅤㅤ𝑃𝑎𝑟𝑒𝑗𝑎 ㅤ𝑐𝑜𝑛𝑓𝑖𝑟𝑚𝑎𝑑𝑎`,
    `ㅤ${RULE.sakura}`,
    `ㅤㅤ${a} ㅤ${SYM.heart}ㅤ ${b}`,
    `ㅤ${RULE.sakura}`,
    `ㅤ${mentions.length ? `${mentions.map(mention).join(' ')}ㅤ` : ''}${KAOMOJI.hug}`,
    `ㅤQue el rol los acompañe ☕`,
  ].join('\n');
}

export function coupleRejected({ fromName, toName }) {
  return [
    `${SYM.bracketL} ✗ ${SYM.bracketR} ㅤ𝑃𝑟𝑜𝑝𝑢𝑒𝑠𝑡𝑎 ㅤ𝑟𝑒𝑐ℎ𝑎𝑧𝑎𝑑𝑎`,
    RULE.blade,
    `ㅤ${toName} no aceptó la propuesta de ${fromName}.`,
    `ㅤSin dramas: aquí se sigue rolando ☕`,
    RULE.blade,
    `ㅤ${KAOMOJI.neutral}`,
  ].join('\n');
}

export function coupleBroken({ a, b }) {
  return [
    `${SYM.bracketL} ${SYM.chain} ${SYM.bracketR} ㅤ𝑅𝑒𝑙𝑎𝑐𝑖𝑜́𝑛 ㅤ𝑡𝑒𝑟𝑚𝑖𝑛𝑎𝑑𝑎`,
    RULE.chain,
    `ㅤ${a} y ${b} ya no son pareja.`,
    `ㅤAmbos perfiles quedaron actualizados.`,
    RULE.chain,
    `ㅤ${KAOMOJI.sad}`,
  ].join('\n');
}

export function coupleError({ reason }) {
  return [
    `${SYM.bracketL} ✗ ${SYM.bracketR} ㅤ𝑁𝑜 ㅤ𝑠𝑒 ㅤ𝑝𝑢𝑒𝑑𝑒`,
    RULE.thin,
    `ㅤ${SYM.chain}ㅤ${reason}`,
    RULE.thin,
    `ㅤ${KAOMOJI.sad}`,
  ].join('\n');
}

export function ship({ aName, bName, percent, verdict, mentions = [] }) {
  return [
    `${SYM.bracketL} ${SYM.heart} ${SYM.bracketR} ㅤ𝑆ℎ𝑖𝑝 ㅤ·ㅤ ${aName} × ${bName}`,
    RULE.wave,
    `ㅤ${bar(percent, 10, '█', '░')} ㅤ${percent}%`,
    '',
    `ㅤ${verdict}`,
    RULE.wave,
    `ㅤ${mentions.length ? `${mentions.map(mention).join(' ')}ㅤ` : ''}${KAOMOJI.smug}`,
    `ㅤ${signature()}`,
  ].join('\n');
}

export function rules({ text, groupName }) {
  return [
    `${SYM.bracketL} ${SYM.scroll} ${SYM.bracketR} ㅤ𝑅𝑒𝑔𝑙𝑎𝑠 ㅤ·ㅤ ${groupName}`,
    RULE.thin,
    text,
    RULE.thin,
    `ㅤ${KAOMOJI.serious}`,
  ].join('\n');
}

export function adminsList({ admins, count, groupName, botIsAdmin, ownerMention }) {
  const list = admins.length
    ? admins
        .map((a) => `ㅤ${a.is_super ? SYM.star : SYM.chain}ㅤ${a.name ?? 'Admin'} ㅤ${mention(a.user_jid)}${a.is_super ? ' ㅤ·ㅤᴏᴡɴᴇʀ ᴅᴇʟ ɢʀᴜᴘᴏ' : ''}`)
        .join('\n')
    : 'ㅤNo hay administradores registrados.';
  return [
    `${SYM.bracketL} ${SYM.chain} ${SYM.bracketR} ㅤ𝑆𝑡𝑎𝑓𝑓 ㅤ𝑑𝑒𝑙 ㅤ𝑔𝑟𝑢𝑝𝑜`,
    `ㅤ${groupName}`,
    RULE.chain,
    list,
    RULE.chain,
    kv('Administradores', String(count)),
    kv('Bot es admin', botIsAdmin ? 'sí ✓ (puedo expulsar/cerrar)' : 'no ✗ (necesito permisos)'),
    ownerMention ? `ㅤOwner del bot ⁙ ${ownerMention}` : null,
    `ㅤ${KAOMOJI.cool}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/* ═══════════════════════════════════════════════════════════════
   ⑥ MODERACIÓN Y ADMINISTRACIÓN
   ═══════════════════════════════════════════════════════════════ */

export function warnNotice({ userName, userMention, reason, adminName, count, max }) {
  const last = count >= max;
  return [
    `ㅤ${SYM.bracketL} ⚠ ${SYM.bracketR} ㅤ𝐴𝑑𝑣𝑒𝑟𝑡𝑒𝑛𝑐𝑖𝑎 ㅤ${count}/${max}`,
    `ㅤ${RULE.chain}`,
    `ㅤ${userMention}`,
    `ㅤ${SYM.chain}ㅤ${userName} recibió un warn.`,
    `ㅤ${SYM.leaf}ㅤMotivo ⁙ ${reason ?? 'sin especificar'}`,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${adminName}`,
    `ㅤ${SYM.leaf}ㅤAcumulado ⁙ ${bar(count, max, '⛓', '·')} ${count}/${max}`,
    '',
    last
      ? `ㅤ${SYM.purify}ㅤLímite alcanzado: expulsión automática.`
      : `ㅤTe quedan ${max - count} oportunidad${max - count === 1 ? '' : 'es'}.`,
    `ㅤ${RULE.chain}`,
    `ㅤ${last ? KAOMOJI.dead : KAOMOJI.serious}`,
  ].join('\n');
}

export function unbanNotice({ userName, adminName }) {
  return [
    `${SYM.bracketL} 🔓 ${SYM.bracketR} ㅤ𝑈𝑠𝑢𝑎𝑟𝑖𝑜 ㅤ𝑑𝑒𝑠𝑏𝑙𝑜𝑞𝑢𝑒𝑎𝑑𝑜`,
    RULE.sakura,
    `ㅤ${SYM.leaf}ㅤ${userName} salió de la lista negra.`,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${adminName}`,
    `ㅤ${SYM.leaf}ㅤSi vuelve al grupo ya no será expulsado.`,
    RULE.sakura,
    `ㅤ${KAOMOJI.wink}`,
  ].join('\n');
}

export function warnHistory({ userName, entries, active }) {
  const rows = entries.length
    ? entries
        .slice(0, 10)
        .map((w) => `ㅤ${w.revoked_at ? '✗' : '⛓️'}ㅤ${(w.reason || 'sin motivo').slice(0, 40)}ㅤ·ㅤ${formatDate(w.created_at)}`)
        .join('\n')
    : 'ㅤSin advertencias registradas.';
  return [
    `${SYM.bracketL} ${SYM.scroll} ${SYM.bracketR} ㅤ𝐻𝑖𝑠𝑡𝑜𝑟𝑖𝑎𝑙 ㅤ·ㅤ ${userName}`,
    RULE.chain,
    rows,
    RULE.chain,
    kv('Activas', String(active)),
    `ㅤ${KAOMOJI.cool}`,
  ].join('\n');
}

export function blockedList({ entries, total, groupName }) {
  return [
    `${SYM.bracketL} ⛓️ ${SYM.bracketR} ㅤ𝐿𝑖𝑠𝑡𝑎 ㅤ𝑛𝑒𝑔𝑟𝑎 ㅤ·ㅤ ${groupName}`,
    RULE.chain,
    ...entries.slice(0, 20).map((b) => `ㅤ⛓️ㅤ${b.name.padEnd(14, ' ')} ⁙ ${b.reason || 'sin motivo'}`),
    RULE.chain,
    kv('Bloqueados', String(total)),
    `ㅤSi vuelven a entrar, se les expulsa automáticamente.`,
    `ㅤ${KAOMOJI.serious}`,
  ].join('\n');
}

export function unwarnNotice({ userName, count, adminName }) {
  return [
    `${SYM.bracketL} ${SYM.purify} ${SYM.bracketR} ㅤ𝐴𝑑𝑣𝑒𝑟𝑡𝑒𝑛𝑐𝑖𝑎 ㅤ𝑟𝑒𝑡𝑖𝑟𝑎𝑑𝑎`,
    RULE.sakura,
    `ㅤ${SYM.leaf}ㅤ${userName} queda con ${count} warn${count === 1 ? '' : 's'}.`,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${adminName}`,
    RULE.sakura,
    `ㅤ${KAOMOJI.sparkle}`,
  ].join('\n');
}

export function kickNotice({ userName, adminName, reason, banned = false }) {
  return [
    `ㅤ${SYM.bracketL} ${SYM.purify} ${SYM.bracketR} ㅤ${banned ? '𝐵𝑎𝑛' : '𝐸𝑥𝑝𝑢𝑙𝑠𝑖𝑜́𝑛'}`,
    `ㅤ${RULE.blade}`,
    `ㅤ${SYM.chain}ㅤ${userName} fue ${banned ? 'baneado' : 'expulsado'} del grupo.`,
    `ㅤ${SYM.leaf}ㅤMotivo ⁙ ${reason ?? 'decisión del staff'}`,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${adminName}`,
    banned ? `ㅤ${SYM.leaf}ㅤSi vuelve a entrar, será expulsado otra vez.` : null,
    `ㅤ${RULE.blade}`,
    `ㅤ${KAOMOJI.serious}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function modDenied({ reason, need = null }) {
  return [
    `${SYM.bracketL} ⛔ ${SYM.bracketR} ㅤ𝐴𝑐𝑐𝑖𝑜́𝑛 ㅤ𝑏𝑙𝑜𝑞𝑢𝑒𝑎𝑑𝑎`,
    RULE.chain,
    `ㅤ${SYM.chain}ㅤ${reason}`,
    need ? `ㅤ${SYM.leaf}ㅤ${need}` : null,
    RULE.chain,
    `ㅤ${KAOMOJI.angry}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function bannedRejoin({ userName, reason, groupName }) {
  return [
    `${SYM.bracketL} ${SYM.purify} ${SYM.bracketR} ㅤ𝑅𝑒𝑖𝑛𝑔𝑟𝑒𝑠𝑜 ㅤ𝑏𝑙𝑜𝑞𝑢𝑒𝑎𝑑𝑜`,
    RULE.chain,
    `ㅤ${SYM.chain}ㅤ${userName} está en la lista negra de ${groupName}.`,
    `ㅤ${SYM.leaf}ㅤMotivo del ban ⁙ ${reason ?? '—'}`,
    `ㅤ${SYM.leaf}ㅤAcción ⁙ expulsión automática.`,
    RULE.chain,
  ].join('\n');
}

export function announcement({ title, text, authorName, groupName, mentions = [] }) {
  return [
    `ㅤㅤ${SYM.crown}`,
    `ㅤㅤ${SYM.bracketL} ${SYM.curse} ${SYM.bracketR}`,
    `ㅤㅤ𝐀𝐍𝐔𝐍𝐂𝐈𝐎 ㅤ𝐎𝐅𝐈𝐂𝐈𝐀𝐋`,
    `ㅤㅤ${groupName}`,
    RULE.coffee,
    title ? `ㅤ${SYM.star}ㅤ${title}` : null,
    '',
    text,
    '',
    RULE.coffee,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${authorName}`,
    mentions.length ? `ㅤ${mentions.join(' ')}` : null,
    `ㅤㅤ${SYM.bracketL} ${SYM.coffee} ${SYM.bracketR} ㅤ◢${SYM.curse}◣ Versova ࿙☕࿚`,
    `ㅤㅤ${SYM.crown}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function groupClosed({ adminName }) {
  return [
    `${SYM.bracketL} 🔒 ${SYM.bracketR} ㅤ𝐺𝑟𝑢𝑝𝑜 ㅤ𝑐𝑒𝑟𝑟𝑎𝑑𝑜`,
    RULE.chain,
    `ㅤ${SYM.chain}ㅤAhora solo los administradores pueden escribir.`,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${adminName}`,
    `ㅤ${SYM.leaf}ㅤPara reabrir ⁙ ${inlineCmd('open')}`,
    RULE.chain,
    `ㅤ${KAOMOJI.serious}`,
  ].join('\n');
}

export function groupOpened({ adminName }) {
  return [
    `${SYM.bracketL} 🔓 ${SYM.bracketR} ㅤ𝐺𝑟𝑢𝑝𝑜 ㅤ𝑎𝑏𝑖𝑒𝑟𝑡𝑜`,
    RULE.wave,
    `ㅤ${SYM.arrow}ㅤTodos pueden escribir de nuevo.`,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${adminName}`,
    RULE.wave,
    `ㅤ${KAOMOJI.cheer}`,
  ].join('\n');
}

export function addResult({ targetName, ok, detail, inviteLink = null }) {
  return [
    `${SYM.bracketL} ${ok ? '✓' : '✗'} ${SYM.bracketR} ㅤ${ok ? '𝑈𝑠𝑢𝑎𝑟𝑖𝑜 ㅤ𝑎ñ𝑎𝑑𝑖𝑑𝑜' : '𝑁𝑜 ㅤ𝑠𝑒 ㅤ𝑝𝑢𝑑𝑜 ㅤ𝑎ñ𝑎𝑑𝑖𝑟'}`,
    RULE.dotted,
    `ㅤ${SYM.leaf}ㅤObjetivo ⁙ ${targetName}`,
    detail ? `ㅤ${SYM.chain}ㅤ${detail}` : null,
    inviteLink ? `ㅤ${SYM.leaf}ㅤInvítalo con el enlace del grupo:\n${inviteLink}` : null,
    `ㅤ${SYM.leaf}ㅤRecuerda: no se registra solo, debe usar ${inlineCmd('reg', '<nombre.edad>')}`,
    RULE.dotted,
    `ㅤ${ok ? KAOMOJI.wink : KAOMOJI.neutral}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/* ═══════════════════════════════════════════════════════════════
   ⑦ BIENVENIDA / DESPEDIDA
   ═══════════════════════════════════════════════════════════════ */

export function welcome({ name, groupName, total, mention, registered }) {
  return [
    `ㅤㅤ${SYM.crown}`,
    `ㅤㅤ${SYM.bracketL} ${SYM.coffee} ${SYM.bracketR}`,
    `ㅤㅤ𝐁𝐈𝐄𝐍𝐕𝐄𝐍𝐈𝐃${registered ? '𝐎 𝐃𝐄 𝐕𝐔𝐄𝐋𝐓𝐀' : '𝐈𝐃𝐎/𝐀'}`,
    `ㅤㅤ${groupName}`,
    RULE.coffee,
    `ㅤ${mention}`,
    `ㅤ${SYM.arrow}ㅤ${name} se unió al team.`,
    registered
      ? `ㅤ${SYM.leaf}ㅤTu ficha anterior fue restaurada.`
      : `ㅤ${SYM.leaf}ㅤRegístrate para empezar a rolear:`,
    registered ? null : cmd('reg', '<nombre.edad>'),
    `ㅤ${SYM.leaf}ㅤLee las reglas con ㅤ${inlineCmd('reglas')}`,
    `ㅤ${SYM.leaf}ㅤMira el menú con ㅤ${inlineCmd('menu')}`,
    RULE.coffee,
    kv('Integrante №', String(total)),
    `ㅤㅤ${KAOMOJI.hug}`,
    `ㅤㅤ${SYM.crown}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function farewell({ name, groupName, role, total, reason = 'leave' }) {
  const titles = { leave: '𝐀𝐃𝐈𝐎́𝐒', kick: '𝐄𝐗𝐏𝐔𝐋𝐒𝐀𝐃𝐎/𝐀', ban: '𝐁𝐀𝐍𝐄𝐀𝐃𝐎/𝐀' };
  return [
    `ㅤ${SYM.bracketL} ${SYM.moon} ${SYM.bracketR} ㅤ${titles[reason] ?? titles.leave}`,
    RULE.night,
    `ㅤ${SYM.leaf}ㅤ${name} dejó ${groupName}.`,
    role ? `ㅤ${SYM.leaf}ㅤSu personaje ${SYM.chopsticks} ${role} quedó libre.` : null,
    `ㅤ${SYM.leaf}ㅤQuedan ${total} integrantes registrados.`,
    RULE.night,
    `ㅤ${reason === 'leave' ? KAOMOJI.sad : KAOMOJI.serious}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/* ═══════════════════════════════════════════════════════════════
   ⑧ SISTEMA: errores, permisos, límites, confirmaciones
   ═══════════════════════════════════════════════════════════════ */

export function noPermission({ required, command }) {
  const who = { admin: 'administradores del grupo o del bot', owner: 'el owner del bot', registered: 'integrantes registrados' }[required] ?? required;
  return [
    `${SYM.bracketL} ⛓️ ${SYM.bracketR} ㅤ𝐴𝑐𝑐𝑒𝑠𝑜 ㅤ𝑟𝑒𝑠𝑡𝑟𝑖𝑛𝑔𝑖𝑑𝑜`,
    RULE.chain,
    `ㅤ${SYM.chain}ㅤ${P}${command} es solo para ${who}.`,
    `ㅤ${SYM.leaf}ㅤTu rango actual no alcanza.`,
    RULE.chain,
    `ㅤ${KAOMOJI.angry}`,
  ].join('\n');
}

export function rateLimited({ retryIn, max, windowSec }) {
  return [
    `${SYM.bracketL} ⏳ ${SYM.bracketR} ㅤ𝑇𝑟𝑎𝑛𝑞𝑢𝑖𝑙𝑜/𝑎`,
    RULE.dotted,
    `ㅤ${SYM.chain}ㅤDemasiados comandos seguidos (${max} cada ${windowSec}s).`,
    `ㅤ${SYM.leaf}ㅤPodrás usar comandos en ${retryIn}s.`,
    RULE.dotted,
    `ㅤ${KAOMOJI.sad}`,
  ].join('\n');
}

export function groupOnly({ command }) {
  return [
    `${SYM.bracketL} ⛔ ${SYM.bracketR} ㅤ𝑆𝑜𝑙𝑜 ㅤ𝑒𝑛 ㅤ𝑔𝑟𝑢𝑝𝑜𝑠`,
    RULE.thin,
    `ㅤ${SYM.chain}ㅤ${P}${command} funciona dentro de un grupo del team.`,
    RULE.thin,
    `ㅤ${KAOMOJI.neutral}`,
  ].join('\n');
}

export function confirmAsk({ action, description, ttl = 60 }) {
  return [
    `${SYM.bracketL} ${SYM.purify} ${SYM.bracketR} ㅤ𝐶𝑜𝑛𝑓𝑖𝑟𝑚𝑎𝑐𝑖𝑜́𝑛 ㅤ𝑟𝑒𝑞𝑢𝑒𝑟𝑖𝑑𝑎`,
    RULE.blade,
    `ㅤ${SYM.chain}ㅤ${description}`,
    '',
    `ㅤ${SYM.leaf}ㅤConfirmar ⁙ ${inlineCmd('confirmar')}`,
    `ㅤ${SYM.leaf}ㅤCancelar ㅤ⁙ ${inlineCmd('cancelar')}`,
    `ㅤ${SYM.leaf}ㅤExpira en ${ttl}s`,
    RULE.blade,
    `ㅤ${KAOMOJI.serious}`,
  ].join('\n');
}

export function confirmCancelled() {
  return [`${SYM.bracketL} ✗ ${SYM.bracketR} ㅤAcción cancelada.`, `ㅤNo se modificó nada ㅤ${KAOMOJI.cozy}`].join('\n');
}

export function confirmNothing() {
  return [
    `${SYM.bracketL} ? ${SYM.bracketR} ㅤ𝑁𝑎𝑑𝑎 ㅤ𝑝𝑜𝑟 ㅤ𝑐𝑜𝑛𝑓𝑖𝑟𝑚𝑎𝑟`,
    RULE.thin,
    `ㅤNo tienes ninguna acción pendiente.`,
    `ㅤLas confirmaciones expiran en 60 segundos.`,
    RULE.thin,
  ].join('\n');
}

export function confirmExpired({ action }) {
  return [
    `${SYM.bracketL} ⏳ ${SYM.bracketR} ㅤ𝐶𝑜𝑛𝑓𝑖𝑟𝑚𝑎𝑐𝑖𝑜́𝑛 ㅤ𝑒𝑥𝑝𝑖𝑟𝑎𝑑𝑎`,
    RULE.dotted,
    `ㅤLa acción "${action}" venció. Vuelve a intentarlo.`,
    RULE.dotted,
    `ㅤ${KAOMOJI.neutral}`,
  ].join('\n');
}

/** Entrada incorrecta / regla de negocio no cumplida (no es un fallo del bot). */
export function invalidInput({ command, message, hint = null }) {
  return [
    `${SYM.bracketL} ${SYM.purify} ${SYM.bracketR} ㅤ${P}${command} ㅤ𝑛𝑜 ㅤ𝑎𝑝𝑙𝑖𝑐𝑎`,
    RULE.dotted,
    `ㅤ${SYM.leaf}ㅤ${message}`,
    hint ? `ㅤ${SYM.leaf}ㅤ${hint}` : null,
    RULE.dotted,
    `ㅤNo se modificó ningún dato. ㅤ${KAOMOJI.neutral}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function inviteLinkCard({ link, groupName, adminName }) {
  return [
    `${SYM.bracketL} 🔗 ${SYM.bracketR} ㅤ𝐸𝑛𝑙𝑎𝑐𝑒 ㅤ𝑑𝑒𝑙 ㅤ𝑔𝑟𝑢𝑝𝑜`,
    RULE.coffee,
    `ㅤ${SYM.leaf}ㅤ${groupName}`,
    '',
    link,
    '',
    `ㅤ${SYM.scroll}ㅤEs la vía fiable para meter gente al team:`,
    `ㅤWhatsApp suele bloquear el añadido directo por privacidad.`,
    `ㅤQuien entre debe registrarse con ㅤ${inlineCmd('reg', '<nombre.edad>')}`,
    RULE.coffee,
    `ㅤ${SYM.leaf}ㅤGenerado por ⁙ ${adminName}`,
    `ㅤ${KAOMOJI.wink}`,
  ].join('\n');
}

export function error({ command, message, ref = null }) {
  return [
    `${SYM.bracketL} ✗ ${SYM.bracketR} ㅤ𝐸𝑟𝑟𝑜𝑟 ㅤ𝑒𝑛 ㅤ${P}${command}`,
    RULE.chain,
    `ㅤ${SYM.chain}ㅤ${message}`,
    ref ? `ㅤ${SYM.leaf}ㅤReferencia ⁙ ${ref}` : null,
    RULE.chain,
    `ㅤEl bot sigue funcionando. Reporta al owner si se repite.`,
    `ㅤ${KAOMOJI.panic}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function unknownCommand({ command, suggestion = null }) {
  return [
    `${SYM.bracketL} ? ${SYM.bracketR} ㅤ𝐶𝑜𝑚𝑎𝑛𝑑𝑜 ㅤ𝑛𝑜 ㅤ𝑒𝑥𝑖𝑠𝑡𝑒`,
    RULE.dotted,
    `ㅤ${P}${command} no es un comando de ${IDENTITY.name}.`,
    suggestion ? `ㅤ${SYM.leaf}ㅤ¿Quisiste decir ㅤ${inlineCmd(suggestion)}?` : null,
    `ㅤ${SYM.leaf}ㅤMira la lista con ㅤ${inlineCmd('menu')}`,
    RULE.dotted,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Clave de activación generada por `.key` (flujo del panel web). */
export function activationKey({ key, expiresInMin = 10, instanceName = null, pairingCodes = [], linking = [] }) {
  const codes = Array.isArray(pairingCodes) ? pairingCodes.filter((row) => row?.formatted) : [];
  const pendientes = Array.isArray(linking) ? linking : [];
  return [
    `${SYM.bracketL} ${SYM.star} ${SYM.bracketR} ㅤ𝐶𝑙𝑎𝑣𝑒 ㅤ𝑑𝑒 ㅤ𝑎𝑐𝑡𝑖𝑣𝑎𝑐𝑖𝑜́𝑛`,
    RULE.night,
    `ㅤ${SYM.leaf}ㅤTu clave ㅤ⁙ㅤ ${key}`,
    instanceName ? `ㅤ${SYM.leaf}ㅤBot ㅤ⁙ㅤ ${instanceName}` : null,
    '',
    `ㅤ${SYM.scroll}ㅤPégala en el panel web para activar el bot.`,
    `ㅤ${SYM.leaf}ㅤCaduca en ${expiresInMin} min · un solo uso.`,
    ...codes.map(
      (row) => [
        '',
        `ㅤ${SYM.bracketL} 🔑 ${SYM.bracketR} ㅤ𝑃𝑎𝑖𝑟𝑖𝑛𝑔 ㅤ𝑐𝑜𝑑𝑒 ㅤ𝑟𝑒𝑎𝑙`,
        `ㅤ${SYM.leaf}ㅤBot ㅤ⁙ㅤ ${row.name} ${row.phoneMasked ? `(${row.phoneMasked})` : ''}`,
        `ㅤ${SYM.chain}ㅤCódigo ㅤ⁙ㅤ ${row.formatted}`,
        `ㅤ${SYM.arrow}ㅤEn ese teléfono: WhatsApp › Dispositivos vinculados ›`,
        `ㅤㅤVincular con el número de teléfono.`,
        `ㅤ${SYM.leaf}ㅤCaduca en ~${Math.max(1, Number(row.expiresInSec ?? 60))} s · pide otro con ${inlineCmd('pairing')}`,
      ].join('\n')
    ),
    !codes.length && pendientes.length
      ? [
          '',
          `ㅤ${SYM.chain}ㅤVinculación en marcha: ${pendientes.map((row) => row.name).join(', ')}.`,
          `ㅤ${SYM.leaf}ㅤPide el código con ${inlineCmd('pairing')} en unos segundos.`,
        ].join('\n')
      : null,
    '',
    `ㅤ${SYM.leaf}ㅤTambién sirve ㅤ${inlineCmd('key')} ㅤcon # - + . /`,
    RULE.night,
    `ㅤ${KAOMOJI.sparkle}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Pairing code REAL de WhatsApp pedido con `.pairing`. */
export function pairingCodeCard({ pairingCodes = [], linking = [] }) {
  const codes = Array.isArray(pairingCodes) ? pairingCodes.filter((row) => row?.formatted) : [];
  if (!codes.length) {
    const pendientes = Array.isArray(linking) && linking.length ? linking.map((row) => row.name).join(', ') : null;
    return [
      `${SYM.bracketL} 🔑 ${SYM.bracketR} ㅤ𝑆𝑖𝑛 ㅤ𝑐𝑜́𝑑𝑖𝑔𝑜 ㅤ𝑝𝑒𝑛𝑑𝑖𝑒𝑛𝑡𝑒`,
      RULE.chain,
      pendientes
        ? `ㅤ${SYM.chain}ㅤHay una vinculación en marcha (${pendientes}).`
        : `ㅤ${SYM.chain}ㅤAhora mismo ningún sub-bot está vinculándose por código.`,
      `ㅤ${SYM.leaf}ㅤCrea el bot en el panel y pulsa "Generar vinculación".`,
      `ㅤ${SYM.leaf}ㅤDespués pide el código aquí con ${inlineCmd('pairing')}.`,
      RULE.chain,
      `ㅤ${KAOMOJI.serious}`,
    ].join('\n');
  }

  return [
    `${SYM.bracketL} 🔑 ${SYM.bracketR} ㅤ𝑃𝑎𝑖𝑟𝑖𝑛𝑔 ㅤ𝑐𝑜𝑑𝑒`,
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
  ].join('\n');
}


/** El bot existe pero está SIN ACTIVAR: solo responde `.key`. */
export function botInactive({ instanceName = null } = {}) {
  return [
    `${SYM.bracketL} 🔒 ${SYM.bracketR} ㅤ𝐵𝑜𝑡 ㅤ𝑠𝑖𝑛 ㅤ𝑎𝑐𝑡𝑖𝑣𝑎𝑟`,
    RULE.blade,
    instanceName ? `ㅤ${SYM.leaf}ㅤ${instanceName} todavía no está activado.` : `ㅤ${SYM.leaf}ㅤEste bot todavía no está activado.`,
    `ㅤ${SYM.chain}ㅤEnvía ㅤ${inlineCmd('key')}ㅤ para recibir tu clave.`,
    `ㅤ${SYM.chain}ㅤLuego pégala en el panel web → Conectar bot.`,
    RULE.blade,
    `ㅤ${KAOMOJI.serious}`,
  ].join('\n');
}

export function ownerCard({ ownerMasked, team, botName, version, isOwner }) {
  return [
    `${SYM.bracketL} ${SYM.curse} ${SYM.bracketR} ㅤ𝑂𝑤𝑛𝑒𝑟 ㅤ𝑑𝑒𝑙 ㅤ𝑏𝑜𝑡`,
    RULE.chain,
    kv('Bot', `${botName} · v${version}`),
    kv('Team', team),
    kv('Owner', ownerMasked ?? '—'),
    kv('Tú', isOwner ? 'eres el owner ✓' : 'no eres el owner'),
    RULE.chain,
    `ㅤPara soporte, reportes o apelaciones escríbele por privado.`,
    `ㅤ${KAOMOJI.cool}`,
  ].join('\n');
}

export function ping({ ms, uptime, groups, users }) {
  return [
    `${SYM.bracketL} ${SYM.coffee} ${SYM.bracketR} ㅤ𝑃𝑜𝑛𝑔`,
    RULE.wave,
    kv('Latencia', `${ms} ms`),
    kv('Activo', formatDuration(uptime)),
    kv('Grupos', String(groups)),
    kv('Fichas', String(users)),
    RULE.wave,
    `ㅤ${ms < 200 ? KAOMOJI.cheer : ms < 600 ? KAOMOJI.neutral : KAOMOJI.sleep}`,
  ].join('\n');
}

export function botInfo({ name, team, version, prefix, groups, users, roles, instances, uptime, owner }) {
  return [
    versovaHeader({ symbol: SYM.curse, subtitle: KAOMOJI.happy }),
    `ㅤ${miniHeader('𝐵𝑜𝑡 ㅤ𝑖𝑛𝑓𝑜𝑟𝑚𝑎𝑡𝑖𝑜𝑛', SYM.coffee)}`,
    RULE.coffee,
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
    RULE.coffee,
    `ㅤㅤ𝖸𝗈𝗎𝗋 𝗋𝗈𝗅𝖾 𝗂𝗌 𝗒𝗈𝗎𝗋 𝗂𝖽𝖾𝗇𝗍𝗂𝗍𝗒.`,
    `ㅤㅤ𝖸𝗈𝗎𝗋 𝗍𝖾𝖺𝗆 𝗂𝗌 𝗒𝗈𝗎𝗋 𝗌𝗍𝗈𝗋𝗒.`,
    `ㅤㅤ${KAOMOJI.cozy}`,
    `ㅤㅤ${SYM.crown}`,
  ].join('\n');
}

export function configUpdated({ key, value, adminName }) {
  return [
    `${SYM.bracketL} ⚙ ${SYM.bracketR} ㅤ𝐶𝑜𝑛𝑓𝑖𝑔𝑢𝑟𝑎𝑐𝑖𝑜́𝑛`,
    RULE.dotted,
    `ㅤ${SYM.arrow}ㅤ${key} ⁙ ${value}`,
    `ㅤ${SYM.leaf}ㅤPor ⁙ ${adminName}`,
    RULE.dotted,
    `ㅤ${KAOMOJI.wink}`,
  ].join('\n');
}

export function configList({ config, groupName }) {
  const rows = [
    ['prefijo', config.prefix],
    ['inactividad', `${config.inactivity_days} días`],
    ['reserva', `${config.reserve_hours} h`],
    ['warns', `${config.max_warnings}`],
    ['bienvenida', config.welcome ? 'activada' : 'desactivada'],
    ['despedida', config.farewell ? 'activada' : 'desactivada'],
    ['aviso AFK', config.afk_mentions ? 'activado' : 'desactivado'],
    ['parejas', config.couple_enabled ? 'activadas' : 'desactivadas'],
  ];
  return [
    `${SYM.bracketL} ⚙ ${SYM.bracketR} ㅤ𝐶𝑜𝑛𝑓𝑖𝑔 ㅤ·ㅤ ${groupName}`,
    RULE.thin,
    ...rows.map(([k, v]) => kv(k, String(v))),
    RULE.thin,
    `ㅤCambia un valor: ㅤ${inlineCmd('config', '<clave> <valor>')}`,
    `ㅤ${KAOMOJI.cozy}`,
  ].join('\n');
}

export function auditList({ entries, groupName }) {
  if (!entries.length) return `${SYM.bracketL} ${SYM.scroll} ${SYM.bracketR} ㅤSin eventos registrados en ${groupName}.`;
  return [
    `${SYM.bracketL} ${SYM.scroll} ${SYM.bracketR} ㅤ𝑅𝑒𝑔𝑖𝑠𝑡𝑟𝑜 ㅤ𝑎𝑑𝑚𝑖𝑛𝑖𝑠𝑡𝑟𝑎𝑡𝑖𝑣𝑜`,
    RULE.dotted,
    ...entries.slice(0, 15).map(
      (e) => `ㅤ${formatTime2(e.created_at)} ⁙ ${e.action.padEnd(18, ' ')} ${e.target_jid ? mention(e.target_jid) : ''}`
    ),
    RULE.dotted,
    `ㅤ${KAOMOJI.cool}`,
  ].join('\n');
}

/* ── helper local (evita importar formatTime con nombre ambiguo) ── */
function formatTime2(ts) {
  const d = new Date(Number(ts));
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export { frame, section, fancyNumber, kv, bullet, cmd, inlineCmd, footer, signature, statusLine, mention, miniHeader };
