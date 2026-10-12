/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · menú y ayuda
 * ────────────────────────────────────────────────────────────────
 * El menú principal es EXACTAMENTE el diseño que definiste para el
 * team. La ayuda detallada (`.help <sección>`) se construye sola a
 * partir del registro de comandos, así nunca se desincroniza.
 */
import { IDENTITY } from '../config/identity.js';
import { SYM, RULE, KAOMOJI, fancyNumber } from './theme.js';

const P = IDENTITY.prefix;

/** Menú principal (`.menu`) — diseño oficial de ◢禍◣ Versova. */
export function mainMenu({ status = 'ᴏɴʟɪɴᴇ', prefix = P, name = IDENTITY.name, team = IDENTITY.team, version = IDENTITY.version } = {}) {
  return `ㅤㅤㅤㅤۖㅤㅤㅤㅤㅤۖ
ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙
ㅤㅤㅤㅤㅤ𓆩ㅤ禊ㅤ𓆪
ㅤㅤㅤ𝑽 𝑬́ 𝑹 𝑺 𝑶 𝑽 𝑨
ㅤㅤㅤㅤ𝐁𝗈𝗍 𝗌𝗒𝗌𝗍𝖾𝗆

ㅤ➢ㅤ◢𝟔𝟔 ; 𝟕𝟕◣ㅤ禍...ㅤ𝐁𝐎𝐓𝐒
ㅤ⌞ㅤ≪⁹⁹ㅤ⁙ㅤ𝐕𝐄́𝐑𝐒𝐎𝐕𝐀ㅤ◌

ㅤㅤㅤㅤ𓆩 ☕ 𓆪
ㅤㅤㅤ𝓜𝓮𝓷𝓾 𝓭𝓮 𝓬𝓸𝓶𝓪𝓷𝓭𝓸𝓼
ㅤㅤㅤㅤ( ᵕ ᴗ ᵕ )♡

ㅤㅤ࿙ׄ࿚᮫᜔۬፟֟࿙ׄ࿚

🥢ㅤ׃ㅤ ~𝕴𝐍𝐅𝐎𝐑𝐌𝐀𝐂𝐈𝐎𝐍~ ㅤ׃
ㅤㅤ𓂃 𝖻𝗈𝗍 𝗂𝗇𝖿𝗈𝗋𝗆𝖺𝗍𝗂𝗈𝗇 𓂃

ㅤ𖦹ㅤ𝖭𝖺𝗆𝖾ㅤ⁙ㅤ${name}
ㅤ𖦹ㅤ𝖳𝖾𝖺𝗆ㅤ⁙    ${team}
ㅤ𖦹ㅤ𝖯𝗋𝖾𝖿𝗂𝗑ㅤ⁙ㅤ${prefix}
ㅤ𖦹ㅤ𝖲𝗍𝖺𝗍𝗎𝗌ㅤ⁙ㅤ${status}
ㅤ𖦹ㅤ𝖵𝖾𝗋𝗌𝗂𝗈𝗇ㅤ⁙ㅤ${version}

ㅤㅤㅤ(˶ᵔ ᵕ ᵔ˶) .ᐟ
ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙



ㅤㅤㅤ◢ ${fancyNumber(1)} ◣
⸸ㅤ׃ㅤ ~𝕽𝐄𝐆𝐈𝐒𝐓𝐑𝐎~ ㅤ׃
ㅤㅤ𓂃 𝗆𝖾𝗆𝖻𝖾𝗋 𝗋𝖾𝗀𝗂𝗌𝗍𝗋𝖺𝗍𝗂𝗈𝗇 𓂃
ㅤㅤㅤ(｡•̀ᴗ-)✧

ㅤ୨ৎㅤ${P}reg <nombre.edad>
ㅤ୨ৎㅤ${P}unreg
ㅤ୨ৎㅤ${P}rol <personaje>
    ୨ৎㅤ${P}roles - muestra roles ocupados
ㅤ୨ৎㅤ${P}ficha
ㅤ୨ৎㅤ${P}editar <nombre.edad>
ㅤ୨ৎㅤ${P}mirol
ㅤ୨ৎㅤ${P}cambiarol <personaje>

ㅤㅤ࿙☕࿚ㅤ𓆩 ♱ 𓆪
ㅤㅤㅤ( ᴗ͈ˬᴗ͈)ㅤ⁙
ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙



ㅤㅤㅤ◢ ${fancyNumber(2)} ◣
𖤐ㅤ׃ㅤ ~𝕲𝐄𝐒𝐓𝐈𝐎𝐍~ ㅤ׃
ㅤㅤ𓂃 𝗍𝖾𝖺𝗆 𝗆𝖺𝗇𝖺𝗀𝖾𝗆𝖾𝗇𝗍 𓂃
ㅤㅤㅤ(๑˃̵ᴗ˂̵)و

ㅤ୨ৎㅤ${P}team
ㅤ୨ৎㅤ${P}miembros
ㅤ୨ৎㅤ${P}afk <motivo> (si manda mensaje despues de este comando sale del afk)
ㅤ୨ৎㅤ${P}inactivos

ㅤㅤ࿙🥢࿚ㅤ𓆩 ♱ 𓆪
ㅤㅤㅤ(˶˃ ᵕ ˂˶)ㅤ⁙
ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙



ㅤㅤㅤ◢ ${fancyNumber(3)} ◣
☕ㅤ׃ㅤ ~𝕻𝐄𝐑𝐒𝐎𝐍𝐀𝐉𝐄𝐒~ ㅤ׃
ㅤㅤ𓂃 𝗋𝗈𝗅𝖾 𝗌𝗒𝗌𝗍𝖾𝗆 𓂃
ㅤㅤㅤ( ੭ ˙ᗜ˙ )੭

ㅤ୨ৎㅤ${P}reservar
ㅤ୨ৎㅤ${P}liberar - libera su rol

ㅤㅤ࿙𖤐࿚ㅤ𓆩 ♱ 𓆪
ㅤㅤㅤ( ᵕ ᴗ ᵕ )ㅤ⁙
ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙



ㅤㅤㅤ◢ ${fancyNumber(4)} ◣
🥢ㅤ׃ㅤ ~𝕴𝐍𝐓𝐄𝐑𝐀𝐂𝐂𝐈𝐎𝐍~ ㅤ׃
ㅤㅤ𓂃 𝗌𝗈𝖼𝗂𝖺𝗅 & 𝖿𝗎𝗇 𓂃
ㅤㅤㅤ(づ๑•ᴗ•๑)づ♡

ㅤ୨ৎㅤ${P}perfil <@usuario>
ㅤ୨ৎㅤ${P}pareja <@usuario>
ㅤ୨ৎㅤ${P}rechazar
ㅤ୨ৎㅤ${P}ship <@usuario> <@usuario>
ㅤ୨ৎㅤ${P}reglas
ㅤ୨ৎㅤ${P}admins

ㅤㅤ࿙☕࿚ㅤ𓆩 ♱ 𓆪
ㅤㅤㅤ(っ˘ω˘ς)ㅤ⁙
ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙



ㅤㅤㅤ◢ ${fancyNumber(5)} ◣
⛓️ㅤ׃ㅤ ~𝕬𝐃𝐌𝐈𝐍𝐈𝐒𝐓𝐑𝐀𝐂𝐈𝐎𝐍~ ㅤ׃
ㅤㅤ𓂃 𝗌𝗍𝖺𝖿𝖿 𝗈𝗇𝗅𝗒 𓂃
ㅤㅤㅤ( •̀ - •́ )✧

ㅤ୨ৎㅤ${P}add
ㅤ୨ৎㅤ${P}expulsar
ㅤ୨ৎㅤ${P}ban
ㅤ୨ৎㅤ${P}unban
ㅤ୨ৎㅤ${P}resetrol
ㅤ୨ৎㅤ${P}warn
ㅤ୨ৎㅤ${P}unwarn
ㅤ୨ৎㅤ${P}acceptrol
ㅤ୨ৎㅤ${P}denyrol
ㅤ୨ৎㅤ${P}anuncio
ㅤ୨ৎㅤ${P}close - hace q solo admins puedan hablar
ㅤ୨ৎㅤ${P}open


ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙



ㅤㅤㅤ𓆩ㅤ禍ㅤ𓆪
ㅤㅤ ~𝕰𝐍𝐃 𝐎𝐅 𝐌𝐄𝐍𝐔~
ㅤㅤㅤ( ᴗ͈ˬᴗ͈) ♡



ㅤㅤ𝖸𝗈𝗎𝗋 𝗋𝗈𝗅𝖾 𝗂𝗌 𝗒𝗈𝗎𝗋 𝗂𝖽𝖾𝗇𝗍𝗂𝗍𝗒.
ㅤㅤ𝖸𝗈𝗎𝗋 𝗍𝖾𝖺𝗆 𝗂𝗌 𝗒𝗈𝗎𝗋 𝗌𝗍𝗈𝗋𝗒.


ㅤ⌞ㅤ≪⁹⁹ㅤ⁙ㅤ𝐕𝐄́𝐑𝐒𝐎𝐕𝐀
ㅤㅤㅤ𝖾𝗌𝗍.ㅤ𝟐𝟎𝟐𝟔


ㅤㅤ࿙ׄ࿚ㅤ𓆩 ☕ 𝟔𝟔 ; 𝟕𝟕𓆪ㅤ࿙ׄ࿚`;
}

/* ── ayuda detallada generada desde el registro de comandos ───── */

const SECTION_META = {
  info: { title: 'INFORMACIÓN', icon: '🥢', sub: '𝖻𝗈𝗍 𝗂𝗇𝖿𝗈𝗋𝗆𝖺𝗍𝗂𝗈𝗇', kaomoji: KAOMOJI.happy, index: 1 },
  registro: { title: 'REGISTRO', icon: '⸸', sub: '𝗆𝖾𝗆𝖻𝖾𝗋 𝗋𝖾𝗀𝗂𝗌𝗍𝗋𝖺𝗍𝗂𝗈𝗇', kaomoji: KAOMOJI.wink, index: 2 },
  roles: { title: 'PERSONAJES', icon: '☕', sub: '𝗋𝗈𝗅𝖾 𝗌𝗒𝗌𝗍𝖾𝗆', kaomoji: KAOMOJI.cat, index: 3 },
  team: { title: 'GESTIÓN', icon: '𖤐', sub: '𝗍𝖾𝖺𝗆 𝗆𝖺𝗇𝖺𝗀𝖾𝗆𝖾𝗇𝗍', kaomoji: KAOMOJI.cheer, index: 4 },
  social: { title: 'INTERACCIÓN', icon: '🥢', sub: '𝗌𝗈𝖼𝗂𝖺𝗅 & 𝖿𝗎𝗇', kaomoji: KAOMOJI.hug, index: 5 },
  admin: { title: 'ADMINISTRACIÓN', icon: '⛓️', sub: '𝗌𝗍𝖺𝖿𝖿 𝗈𝗇𝗅𝗒', kaomoji: KAOMOJI.serious, index: 6 },
};

const PERMISSION_LABEL = {
  all: 'todos',
  registered: 'registrados',
  admin: 'administradores',
  owner: 'owner del bot',
};

/** `.help <sección>` — detalle de comandos de una categoría. */
export function sectionHelp(data = {}) {
  const { section } = data;
  const commands = data.commands ?? [];
  const meta = SECTION_META[section];
  const list = commands.filter((c) => c.category === section && !c.hidden);
  if (!meta || !list.length) return availableSections({ commands });

  const body = list
    .map((c) => {
      const args = c.args ? ` ${c.args}` : '';
      const aliases = c.aliases?.length ? `ㅤ·ㅤalias: ${c.aliases.map((a) => P + a).join(', ')}` : '';
      return [
        `ㅤ${SYM.clover}ㅤ${P}${c.name}${args}`,
        `ㅤㅤㅤ${c.description}`,
        c.example ? `ㅤㅤㅤ${SYM.leaf} ejemplo: ${c.example}` : null,
        `ㅤㅤㅤ${SYM.leaf} permiso: ${PERMISSION_LABEL[c.permission] ?? c.permission}${aliases}`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join(`\n${RULE.dotted}\n`);

  return [
    `ㅤㅤ◢ ${fancyNumber(meta.index)} ◣`,
    `${meta.icon}ㅤ׃ㅤ ~${meta.title}~ ㅤ׃`,
    `ㅤㅤ${SYM.scroll} ${meta.sub} ${SYM.scroll}`,
    `ㅤㅤ${meta.kaomoji}`,
    RULE.thin,
    body,
    RULE.thin,
    `ㅤMenú completo: ㅤ${SYM.clover} ${P}menu`,
    `ㅤOtra sección: ㅤ${SYM.clover} ${P}help <sección>`,
    `ㅤ${SYM.crown}`,
  ].join('\n');
}

/** Lista de secciones disponibles para `.help`. */
export function availableSections(data = {}) {
  const commands = Array.isArray(data) ? data : data.commands ?? [];
  const counts = new Map();
  for (const c of commands) {
    if (c.hidden) continue;
    counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
  }
  const rows = Object.entries(SECTION_META)
    .filter(([key]) => counts.has(key))
    .map(([key, meta]) => `ㅤ${meta.icon}ㅤ${key.padEnd(10, ' ')} ⁙ ${counts.get(key)} comandos`)
    .join('\n');
  return [
    `${SYM.bracketL} ${SYM.scroll} ${SYM.bracketR} ㅤ𝑆𝑒𝑐𝑐𝑖𝑜𝑛𝑒𝑠 ㅤ𝑑𝑒 ㅤ𝑎𝑦𝑢𝑑𝑎`,
    RULE.dotted,
    rows,
    RULE.dotted,
    `ㅤUsa ㅤ${SYM.clover} ${P}help <sección> ㅤpara ver el detalle.`,
    `ㅤ${KAOMOJI.wink}`,
  ].join('\n');
}

/** `.help <comando>` — ficha de un comando concreto. */
export function commandHelp(command) {
  const meta = SECTION_META[command.category] ?? {};
  return [
    `${SYM.bracketL} ${meta.icon ?? SYM.coffee} ${SYM.bracketR} ㅤ${P}${command.name}`,
    RULE.thin,
    `ㅤ${SYM.leaf}ㅤ${command.description}`,
    command.args ? `ㅤ${SYM.leaf}ㅤUso ⁙ ${P}${command.name} ${command.args}` : `ㅤ${SYM.leaf}ㅤUso ⁙ ${P}${command.name}`,
    command.example ? `ㅤ${SYM.leaf}ㅤEjemplo ⁙ ${command.example}` : null,
    `ㅤ${SYM.leaf}ㅤPermiso ⁙ ${PERMISSION_LABEL[command.permission] ?? command.permission}`,
    `ㅤ${SYM.leaf}ㅤSección ⁙ ${command.category}`,
    command.aliases?.length ? `ㅤ${SYM.leaf}ㅤAlias ⁙ ${command.aliases.map((a) => P + a).join(', ')}` : null,
    command.confirm ? `ㅤ${SYM.leaf}ㅤRequiere confirmación (${P}confirmar / ${P}cancelar)` : null,
    command.notes ? `ㅤ${SYM.chain}ㅤ${command.notes}` : null,
    RULE.thin,
    `ㅤ${meta.kaomoji ?? KAOMOJI.neutral}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export { SECTION_META };
