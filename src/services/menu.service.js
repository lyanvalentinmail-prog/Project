/**
 * VÉRSOVA · servicio de menú dinámico
 * Construye el menú por bot según su custom_config
 */
import { IDENTITY } from '../config/identity.js';
import { registry } from '../commands/index.js';
import { customRepo } from '../db/repositories/bot-customization.repo.js';
import { renderByStyle, STYLES } from '../design/menu-styles.js';
import { KAOMOJI } from '../design/theme.js';

const BUILTIN_META = {
  info: { id: 'info', title: '𝕴𝐍𝐅𝐎𝐑𝐌𝐀𝐂𝐈𝐎𝐍', icon: '🥢', sub: '𝖻𝗈𝗍 𝗂𝗇𝖿𝗈𝗋𝗆𝖺𝗍𝗂𝗈𝗇', kaomoji: KAOMOJI.happy, index: 1 },
  registro: { id: 'registro', title: '𝕽𝐄𝐆𝐈𝐒𝐓𝐑𝐎', icon: '⸸', sub: '𝗆𝖾𝗆𝖻𝖾𝗋 𝗋𝖾𝗀𝗂𝗌𝗍𝗋𝖺𝗍𝗂𝗈𝗇', kaomoji: KAOMOJI.wink, index: 2 },
  roles: { id: 'roles', title: '𝕻𝐄𝐑𝐒𝐎𝐍𝐀𝐉𝐄𝐒', icon: '☕', sub: '𝗋𝗈𝗅𝖾 𝗌𝗒𝗌𝗍𝖾𝗆', kaomoji: KAOMOJI.cat, index: 3 },
  team: { id: 'team', title: '𝕲𝐄𝐒𝐓𝐈𝐎𝐍', icon: '𖤐', sub: '𝗍𝖾𝖺𝗆 𝗆𝖺𝗇𝖺𝗀𝖾𝗆𝖾𝗇𝗍', kaomoji: KAOMOJI.cheer, index: 4 },
  social: { id: 'social', title: '𝕴𝐍𝐓𝐄𝐑𝐀𝐂𝐂𝐈𝐎𝐍', icon: '🥢', sub: '𝗌𝗈𝖼𝗂𝖺𝗅 & 𝖿𝗎𝗇', kaomoji: KAOMOJI.hug, index: 5 },
  admin: { id: 'admin', title: '𝕬𝐃𝐌𝐈𝐍𝐈𝐒𝐓𝐑𝐀𝐂𝐈𝐎𝐍', icon: '⛓️', sub: '𝗌𝗍𝖺𝖿𝖿 𝗈𝗇𝗅𝗒', kaomoji: KAOMOJI.serious, index: 6 },
  anime: { id: 'anime', title: '𝕬𝐍𝐈𝐌𝐄', icon: '🧈', sub: '𝖺𝗇𝗂𝗆𝖾 𝗋𝖾𝖺𝖼𝗍𝗂𝗈𝗇𝗌', kaomoji: KAOMOJI.hug, index: 7 },
  economy: { id: 'economy', title: '𝕰𝐂𝐎𝐍𝐎𝐌𝐈𝐀', icon: '🪷', sub: '𝗒𝖾𝗇𝖾𝗌 & 𝗀𝖺𝗆𝖻𝗅𝖾', kaomoji: KAOMOJI.smug, index: 8 },
  download: { id: 'download', title: '𝕯𝐄𝐒𝐂𝐀𝐑𝐆𝐀𝐒', icon: '🛍️', sub: '𝗆𝗎𝗌𝗂𝖼 & 𝗆𝖾𝖽𝗂𝖺', kaomoji: KAOMOJI.cool, index: 9 },
  perfil: { id: 'perfil', title: '𝕻𝐄𝐑𝐅𝐈𝐋', icon: '🌸', sub: '𝗅𝗈𝗏𝖾 & 𝖽𝖺𝗍𝗈𝗌', kaomoji: KAOMOJI.love, index: 10 },
  stickers: { id: 'stickers', title: '𝕾𝐓𝐈𝐂𝐊𝐄𝐑𝐒', icon: '⭐', sub: '𝗌𝗍𝗂𝖼𝗄𝖾𝗋 𝗆𝖺𝗄𝖾𝗋', kaomoji: KAOMOJI.wink, index: 11 },
  tools: { id: 'tools', title: '𝕳𝐄𝐑𝐑𝐀𝐌𝐈𝐄𝐍𝐓𝐀𝐒', icon: '💐', sub: '𝗂𝖺 & 𝗎𝗍𝗂𝗅𝗂𝖽𝖺𝖽𝖾𝗌', kaomoji: KAOMOJI.cool, index: 12 },
  logos: { id: 'logos', title: '𝕷𝐎𝐆𝐎𝐒', icon: '🍰', sub: '𝗅𝗈𝗀𝗈 𝗆𝖺𝗄𝖾𝗋', kaomoji: KAOMOJI.sparkle, index: 13 },
};

function getMetaForCategory(id, customCategories) {
  if (BUILTIN_META[id]) return BUILTIN_META[id];
  const custom = customCategories.find((c) => c.id === id);
  if (custom) return {
    id: custom.id,
    title: custom.title.toUpperCase(),
    icon: custom.icon,
    sub: custom.sub,
    kaomoji: custom.kaomoji,
    index: 99,
  };
  // fallback
  return { id, title: id.toUpperCase(), icon: '✦', sub: 'custom', kaomoji: KAOMOJI.neutral, index: 99 };
}

/**
 * Construye datos del menú para un bot
 */
export function buildMenuData(instance, prefix) {
  const custom = instance ? customRepo.get(instance.id) : { menuStyle: 'versova', aliases: {}, disabled: [], categories: [], customCommands: [], categoryOverrides: {} };
  // lista base
  const disabledSet = new Set((custom.disabled || []).map((s) => s.toLowerCase()));
  const aliasExtra = custom.aliases || {};
  const overrides = custom.categoryOverrides || {};

  // commands filtrados
  const visibleBuiltin = registry.list.filter((c) => !c.hidden && !disabledSet.has(c.name.toLowerCase()));

  const allCommands = [];

  for (const c of visibleBuiltin) {
    const extraAliases = aliasExtra[c.name.toLowerCase()] || [];
    const cat = overrides[c.name.toLowerCase()] || c.category;
    allCommands.push({
      name: c.name,
      aliases: [...(c.aliases || []), ...extraAliases],
      description: c.description,
      args: c.args || '',
      category: cat,
      permission: c.permission,
      hidden: c.hidden,
    });
  }

  // custom commands
  for (const cc of (custom.customCommands || [])) {
    if (disabledSet.has(cc.name.toLowerCase())) continue;
    allCommands.push({
      name: cc.name,
      aliases: cc.aliases || [],
      description: cc.description,
      args: cc.args || '',
      category: cc.category,
      permission: cc.permission,
      hidden: cc.hidden,
      isCustom: true,
    });
  }

  // Agrupar por categoría
  const byCat = new Map();
  const customCats = custom.categories || [];
  // ensure all categories present
  const allCatIds = new Set(allCommands.map((c) => c.category));
  // also include custom empty categories? show them even if empty? yes if user created
  for (const cc of customCats) allCatIds.add(cc.id);

  for (const catId of allCatIds) {
    const meta = getMetaForCategory(catId, customCats);
    const cmds = allCommands.filter((c) => c.category === catId);
    // if custom category with no commands, still show empty with placeholder?
    // We'll include it anyway if it is custom, to allow preview.
    if (!cmds.length && !customCats.find((c) => c.id === catId)) continue;
    if (!byCat.has(catId)) byCat.set(catId, { meta, commands: [] });
    byCat.get(catId).commands.push(...cmds);
  }

  // Ordenar categorías: builtin order first, then custom alphabetical
  const ordered = [...byCat.values()].sort((a, b) => {
    const ai = a.meta.index ?? 99;
    const bi = b.meta.index ?? 99;
    if (ai !== bi) return ai - bi;
    return a.meta.id.localeCompare(b.meta.id);
  });

  return {
    status: 'ᴏɴʟɪɴᴇ',
    prefix: prefix || instance?.prefix || IDENTITY.prefix,
    name: IDENTITY.name,
    team: IDENTITY.team,
    version: IDENTITY.version,
    categories: ordered,
    style: custom.menuStyle || 'versova',
  };
}

/** Renderiza el menú para un bot */
export function renderMenuFor(instance, opts = {}) {
  const data = buildMenuData(instance, opts.prefix);
  const style = opts.style || data.style || 'versova';
  return renderByStyle(style, data);
}

/** Preview con estilo forzado */
export function previewMenu(instance, styleId) {
  const data = buildMenuData(instance, instance?.prefix);
  return renderByStyle(styleId || data.style, data);
}

export function getAvailableStyles() {
  return Object.values(STYLES).map((s) => ({ id: s.id, label: s.label, description: s.description, preview: s.preview }));
}

export { BUILTIN_META };
