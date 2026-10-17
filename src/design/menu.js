/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · menú y ayuda
 * ────────────────────────────────────────────────────────────────
 * El menú principal es EXACTAMENTE el diseño que definiste para el
 * team. La ayuda detallada (`.help <sección>`) se construye sola a
 * partir del registro de comandos, así nunca se desincroniza.
 */
import { IDENTITY } from '../config/identity.js';
import { SYM, RULE, KAOMOJI, fancyNumber, currentPrefix } from './theme.js';

/** Prefijo real del sub-bot (mutable por mensaje). */
const P = { toString: () => currentPrefix() };

/** Menú principal ahora es dinámico: delega en menu.service + estilos */
import { buildMenuData } from '../services/menu.service.js';
import { renderByStyle } from './menu-styles.js';

export function mainMenu({ status = 'ᴏɴʟɪɴᴇ', prefix = P, name = IDENTITY.name, team = IDENTITY.team, version = IDENTITY.version, instance = null, style = null, userName = null, filter = null } = {}) {
  // Si hay instancia, usa su custom_config
  try {
    if (instance) {
      const data = buildMenuData(instance, String(prefix));
      const chosen = style || data.style || 'versova';
      return renderByStyle(chosen, { ...data, status, prefix: String(prefix), name, team, version, userName, filter });
    }
  } catch {}
  // Fallback 100% idéntico al diseño original para tests y sin instancia
  const Pstr = String(prefix);
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
ㅤ𖦹ㅤ𝖯𝗋𝖾𝖿𝗂𝗑ㅤ⁙ㅤ${Pstr}
ㅤ𖦹ㅤ𝖲𝗍𝖺𝗍𝗎𝗌ㅤ⁙ㅤ${status}
ㅤ𖦹ㅤ𝖵𝖾𝗋𝗌𝗂𝗈𝗇ㅤ⁙ㅤ${version}

ㅤㅤㅤ(˶ᵔ ᵕ ᵔ˶) .ᐟ
ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙



ㅤㅤㅤ◢ ${fancyNumber(1)} ◣
⸸ㅤ׃ㅤ ~𝕽𝐄𝐆𝐈𝐒𝐓𝐑𝐎~ ㅤ׃
ㅤㅤ𓂃 𝗆𝖾𝗆𝖻𝖾𝗋 𝗋𝖾𝗀𝗂𝗌𝗍𝗋𝖺𝗍𝗂𝗈𝗇 𓂃
ㅤㅤㅤ(｡•̀ᴗ-)✧

ㅤ୨ৎㅤ${Pstr}reg <nombre.edad>
ㅤ୨ৎㅤ${Pstr}unreg
ㅤ୨ৎㅤ${Pstr}rol <personaje>
    ୨ৎㅤ${Pstr}roles - muestra roles ocupados
ㅤ୨ৎㅤ${Pstr}ficha
ㅤ୨ৎㅤ${Pstr}editar <nombre.edad>
ㅤ୨ৎㅤ${Pstr}mirol
ㅤ୨ৎㅤ${Pstr}cambiarol <personaje>

ㅤㅤ࿙☕࿚ㅤ𓆩 ♱ 𓆪
ㅤㅤㅤ( ᴗ͈ˬᴗ͈)ㅤ⁙
ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙



ㅤㅤㅤ◢ ${fancyNumber(2)} ◣
𖤐ㅤ׃ㅤ ~𝕲𝐄𝐒𝐓𝐈𝐎𝐍~ ㅤ׃
ㅤㅤ𓂃 𝗍𝖾𝖺𝗆 𝗆𝖺𝗇𝖺𝗀𝖾𝗆𝖾𝗇𝗍 𓂃
ㅤㅤㅤ(๑˃̵ᴗ˂̵)و

ㅤ୨ৎㅤ${Pstr}team
ㅤ୨ৎㅤ${Pstr}miembros
ㅤ୨ৎㅤ${Pstr}afk <motivo> (si manda mensaje despues de este comando sale del afk)
ㅤ୨ৎㅤ${Pstr}inactivos

ㅤㅤ࿙🥢࿚ㅤ𓆩 ♱ 𓆪
ㅤㅤㅤ(˶˃ ᵕ ˂˶)ㅤ⁙
ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙



ㅤㅤㅤ◢ ${fancyNumber(3)} ◣
☕ㅤ׃ㅤ ~𝕻𝐄𝐑𝐒𝐎𝐍𝐀𝐉𝐄𝐒~ ㅤ׃
ㅤㅤ𓂃 𝗋𝗈𝗅𝖾 𝗌𝗒𝗌𝗍𝖾𝗆 𓂃
ㅤㅤㅤ( ੭ ˙ᗜ˙ )੭

ㅤ୨ৎㅤ${Pstr}reservar
ㅤ୨ৎㅤ${Pstr}liberar - libera su rol

ㅤㅤ࿙𖤐࿚ㅤ𓆩 ♱ 𓆪
ㅤㅤㅤ( ᵕ ᴗ ᵕ )ㅤ⁙
ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙



ㅤㅤㅤ◢ ${fancyNumber(4)} ◣
🥢ㅤ׃ㅤ ~𝕴𝐍𝐓𝐄𝐑𝐀𝐂𝐂𝐈𝐎𝐍~ ㅤ׃
ㅤㅤ𓂃 𝗌𝗈𝖼𝗂𝖺𝗅 & 𝖿𝗎𝗇 𓂃
ㅤㅤㅤ(づ๑•ᴗ•๑)づ♡

ㅤ୨ৎㅤ${Pstr}perfil <@usuario>
ㅤ୨ৎㅤ${Pstr}pareja <@usuario>
ㅤ୨ৎㅤ${Pstr}rechazar
ㅤ୨ৎㅤ${Pstr}ship <@usuario> <@usuario>
ㅤ୨ৎㅤ${Pstr}reglas
ㅤ୨ৎㅤ${Pstr}admins

ㅤㅤ࿙☕࿚ㅤ𓆩 ♱ 𓆪
ㅤㅤㅤ(っ˘ω˘ς)ㅤ⁙
ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙



ㅤㅤㅤ◢ ${fancyNumber(5)} ◣
⛓️ㅤ׃ㅤ ~𝕬𝐃𝐌𝐈𝐍𝐈𝐒𝐓𝐑𝐀𝐂𝐈𝐎𝐍~ ㅤ׃
ㅤㅤ𓂃 𝗌𝗍𝖺𝖿𝖿 𝗈𝗇𝗅𝗒 𓂃
ㅤㅤㅤ( •̀ - •́ )✧

ㅤ୨ৎㅤ${Pstr}add
ㅤ୨ৎㅤ${Pstr}expulsar
ㅤ୨ৎㅤ${Pstr}ban
ㅤ୨ৎㅤ${Pstr}unban
ㅤ୨ৎㅤ${Pstr}resetrol
ㅤ୨ৎㅤ${Pstr}warn
ㅤ୨ৎㅤ${Pstr}unwarn
ㅤ୨ৎㅤ${Pstr}acceptrol
ㅤ୨ৎㅤ${Pstr}denyrol
ㅤ୨ৎㅤ${Pstr}anuncio
ㅤ୨ৎㅤ${Pstr}close - hace q solo admins puedan hablar
ㅤ୨ৎㅤ${Pstr}open


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

/** Alias para compat: algunos tests importan mainMenu directamente */
export const legacyMainMenu = mainMenu;

/* ── ayuda detallada generada desde el registro de comandos ───── */

const SECTION_META = {
  info: { title: 'INFORMACIÓN', icon: '🥢', sub: '𝖻𝗈𝗍 𝗂𝗇𝖿𝗈𝗋𝗆𝖺𝗍𝗂𝗈𝗇', kaomoji: KAOMOJI.happy, index: 1 },
  registro: { title: 'REGISTRO', icon: '⸸', sub: '𝗆𝖾𝗆𝖻𝖾𝗋 𝗋𝖾𝗀𝗂𝗌𝗍𝗋𝖺𝗍𝗂𝗈𝗇', kaomoji: KAOMOJI.wink, index: 2 },
  roles: { title: 'PERSONAJES', icon: '☕', sub: '𝗋𝗈𝗅𝖾 𝗌𝗒𝗌𝗍𝖾𝗆', kaomoji: KAOMOJI.cat, index: 3 },
  team: { title: 'GESTIÓN', icon: '𖤐', sub: '𝗍𝖾𝖺𝗆 𝗆𝖺𝗇𝖺𝗀𝖾𝗆𝖾𝗇𝗍', kaomoji: KAOMOJI.cheer, index: 4 },
  social: { title: 'INTERACCIÓN', icon: '🥢', sub: '𝗌𝗈𝖼𝗂𝖺𝗅 & 𝖿𝗎𝗇', kaomoji: KAOMOJI.hug, index: 5 },
  admin: { title: 'ADMINISTRACIÓN', icon: '⛓️', sub: '𝗌𝗍𝖺𝖿𝖿 𝗈𝗇𝗅𝗒', kaomoji: KAOMOJI.serious, index: 6 },
  anime: { title: 'ANIME', icon: '🧈', sub: '𝖺𝗇𝗂𝗆𝖾 𝗋𝖾𝖺𝖼𝗍𝗂𝗈𝗇𝗌', kaomoji: KAOMOJI.hug, index: 7 },
  economy: { title: 'ECONOMÍA', icon: '🪷', sub: '𝗒𝖾𝗇𝖾𝗌 & 𝗀𝖺𝗆𝖻𝗅𝖾', kaomoji: KAOMOJI.smug, index: 8 },
  download: { title: 'DESCARGAS', icon: '🛍️', sub: '𝗆𝗎𝗌𝗂𝖼 & 𝗆𝖾𝖽𝗂𝖺', kaomoji: KAOMOJI.cool, index: 9 },
  perfil: { title: 'PERFIL', icon: '🌸', sub: '𝗅𝗈𝗏𝖾 & 𝖽𝖺𝗍𝗈𝗌', kaomoji: KAOMOJI.love, index: 10 },
  stickers: { title: 'STICKERS', icon: '⭐', sub: '𝗌𝗍𝗂𝖼𝗄𝖾𝗋 𝗆𝖺𝗄𝖾𝗋', kaomoji: KAOMOJI.wink, index: 11 },
  tools: { title: 'HERRAMIENTAS', icon: '💐', sub: '𝗂𝖺 & 𝗎𝗍𝗂𝗅𝗂𝖽𝖺𝖽𝖾𝗌', kaomoji: KAOMOJI.cool, index: 12 },
  logos: { title: 'LOGOS', icon: '🍰', sub: '𝗅𝗈𝗀𝗈 𝗆𝖺𝗄𝖾𝗋', kaomoji: KAOMOJI.sparkle, index: 13 },
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

/** `.help` — explicación de TODOS los comandos, generada desde el registro. */
export function fullHelp(data = {}) {
  const commands = Array.isArray(data) ? data : data.commands ?? [];
  const visible = commands.filter((c) => !c.hidden);
  const blocks = [];

  for (const [key, meta] of Object.entries(SECTION_META)) {
    const list = visible.filter((c) => c.category === key);
    if (!list.length) continue;
    const body = list
      .map((c) => {
        const args = c.args ? ` ${c.args}` : '';
        const notes = [];
        if (c.example) notes.push(`ejemplo: ${c.example}`);
        notes.push(`permiso: ${PERMISSION_LABEL[c.permission] ?? c.permission}`);
        return [
          `ㅤ${SYM.clover}ㅤ${P}${c.name}${args}`,
          `ㅤㅤㅤ${c.description}`,
          `ㅤㅤㅤ${SYM.leaf} ${notes.join(` ${SYM.dot} `)}`,
        ].join('\n');
      })
      .join('\n');
    blocks.push(
      [
        `ㅤㅤ◢ ${fancyNumber(meta.index)} ◣`,
        `${meta.icon}ㅤ׃ㅤ ~${meta.title}~ ㅤ׃`,
        `ㅤㅤ${SYM.scroll} ${meta.sub} ${SYM.scroll}`,
        RULE.thin,
        body,
      ].join('\n'),
    );
  }

  if (!blocks.length) return availableSections({ commands });

  return [
    `${SYM.bracketL} ${SYM.scroll} ${SYM.bracketR} ㅤ𝐸𝑥𝑝𝑙𝑖𝑐𝑎𝑐𝑖𝑜𝑛 𝑑𝑒 𝑡𝑜𝑑𝑜𝑠 𝑙𝑜𝑠 𝑐𝑜𝑚𝑎𝑛𝑑𝑜𝑠`,
    RULE.dotted,
    blocks.join(`\n${RULE.dotted}\n`),
    RULE.thin,
    `ㅤDetalle de un comando: ㅤ${SYM.clover} ${P}help <comando>`,
    `ㅤPor sección: ㅤ${SYM.clover} ${P}help <sección> · menú: ${SYM.clover} ${P}menu`,
    `ㅤ${SYM.crown}`,
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
