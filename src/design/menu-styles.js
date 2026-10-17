/**
 * VÉRSOVA · estilos de menú
 * Seis estilos renderizables. Cada función recibe:
 * { status, prefix, name, team, version, categories: [{ meta, commands }] }
 * donde meta = { id, title, icon, sub, kaomoji, index }
 * y commands = [{ name, aliases, description, args, response? }]
 */

import { SYM, RULE, KAOMOJI, fancyNumber } from './theme.js';

function versovaHeader(name, team, prefix, status, version) {
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
ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙`;
}

function versovaFooter() {
  return `
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

export function renderVersova({ status, prefix, name, team, version, categories }) {
  const header = versovaHeader(name, team, prefix, status, version);
  const footer = versovaFooter();
  const blocks = categories.map((cat, idx) => {
    const meta = cat.meta;
    const number = fancyNumber(idx + 1);
    const cmds = cat.commands.map((c) => {
      const arg = c.args ? ` ${c.args}` : '';
      return `ㅤ୨ৎㅤ${prefix}${c.name}${arg}`;
    }).join('\n');
    return `
ㅤㅤㅤ◢ ${number} ◣
${meta.icon}ㅤ׃ㅤ ~${meta.title}~ ㅤ׃
ㅤㅤ𓂃 ${meta.sub} 𓂃
ㅤㅤㅤ${meta.kaomoji}

${cmds}

ㅤㅤ࿙${meta.icon === '⸸' ? '☕' : meta.icon === '𖤐' ? '🥢' : meta.icon === '☕' ? '𖤐' : '☕'}࿚ㅤ𓆩 ♱ 𓆪
ㅤㅤㅤ( ᴗ͈ˬᴗ͈)ㅤ⁙
ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙`;
  }).join('\n\n');
  return `${header}\n\n${blocks}\n\n${footer}`;
}

export function renderMinimal({ status, prefix, name, team, version, categories }) {
  let out = [];
  out.push(`🤖 ${name} · ${team} · v${version}`);
  out.push(`┌─ Prefix: ${prefix}  Status: ${status} ─────────────`);
  out.push(``);
  for (const cat of categories) {
    const m = cat.meta;
    out.push(`${m.icon} ${m.title} — ${m.sub} (${cat.commands.length})`);
    for (const c of cat.commands) {
      const args = c.args ? ` ${c.args}` : '';
      const alias = c.aliases?.length ? ` 〔alias: ${c.aliases.join(', ')}〕` : '';
      out.push(`  • ${prefix}${c.name}${args}${alias} — ${c.description || ''}`);
    }
    out.push(``);
  }
  out.push(`─────────────────────────────`);
  out.push(`Usa ${prefix}help <comando> para detalle · ${prefix}menu`);
  out.push(`© VÉRSOVA est. 2026`);
  return out.join('\n');
}

export function renderElegant({ status, prefix, name, team, version, categories }) {
  let out = [];
  out.push(`╭─ VÉRSOVA ────────────────────────╮`);
  out.push(`│ ${name} · ${team} │ Prefix ${prefix} │ ${status} │ v${version} │`);
  out.push(`╰──────────────────────────────────╯`);
  out.push(``);
  for (const cat of categories) {
    const m = cat.meta;
    out.push(`┌─ ${m.icon} ${m.title} ─┐  ${m.sub}  ${m.kaomoji}`);
    for (const c of cat.commands) {
      const args = c.args ? ` ${c.args}` : '';
      out.push(`│ • ${prefix}${c.name}${args}`.padEnd(38) + `│ ${c.description?.slice(0,30) || ''}`);
    }
    out.push(`└${'─'.repeat(38)}┘`);
    out.push(``);
  }
  out.push(`♦ Usa ${prefix}help <sección> · ${prefix}menu ♦`);
  return out.join('\n');
}

export function renderCyber({ status, prefix, name, team, version, categories }) {
  let out = [];
  out.push(`▓▓▓ VERSOVA SYSTEM ▓▓▓`);
  out.push(`>> BOT: ${name.toUpperCase()} | TEAM: ${team} | PREFIX: ${prefix} | STATUS: ${status.toUpperCase()} | v${version}`);
  out.push(`>> ${'─'.repeat(38)}`);
  for (const cat of categories) {
    const m = cat.meta;
    out.push(``);
    out.push(`[${m.title}] ▶ ${m.sub} ${m.kaomoji}`);
    for (const c of cat.commands) {
      const args = c.args ? ` ${c.args}` : '';
      out.push(`  ▸ ${prefix}${c.name}${args} :: ${c.description?.slice(0,45) || ''}`);
    }
  }
  out.push(``);
  out.push(`>> END OF LINE >> ${prefix}menu | ${prefix}help`);
  out.push(`▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓`);
  return out.join('\n');
}

export function renderCompact({ status, prefix, name, team, version, categories }) {
  let out = [];
  out.push(`${name} (${prefix}) · ${status} · v${version}`);
  out.push(``);
  for (const cat of categories) {
    const cmds = cat.commands.map((c) => `${prefix}${c.name}`).join(', ');
    out.push(`${cat.meta.icon} ${cat.meta.title}: ${cmds}`);
  }
  out.push(``);
  out.push(`${prefix}menu · ${prefix}help`);
  return out.join('\n');
}

export function renderRetro({ status, prefix, name, team, version, categories }) {
  let out = [];
  out.push(`╔══════════ VÉRSOVA MENU ══════════╗`);
  out.push(`║ ${name.padEnd(16)} ${team.slice(0,16).padEnd(16)}║`);
  out.push(`║ Prefix: ${prefix.padEnd(6)} Status: ${status.padEnd(8)} v${version.padEnd(5)}║`);
  out.push(`╠════════════════════════════════════╣`);
  for (const cat of categories) {
    const m = cat.meta;
    out.push(`║ [ ${m.title} ] ${m.icon} ${m.sub.padEnd(18)}║`);
    for (const c of cat.commands) {
      const args = c.args ? ` ${c.args}` : '';
      const line = `> ${prefix}${c.name}${args}`;
      out.push(`║ ${line.padEnd(36)}║`);
    }
    out.push(`║${'─'.repeat(36)}║`);
  }
  out.push(`║ Use ${prefix}help <cmd> for details     ║`);
  out.push(`╚════════════════════════════════════╝`);
  out.push(`  (˶ᵔ ᵕ ᵔ˶)  Your role is your identity.`);
  return out.join('\n');
}

export const STYLES = {
  versova: { id: 'versova', label: 'Versova (Oficial)', description: 'El diseño clásico de VÉRSOVA, con kaomojis y bloques decorados.', render: renderVersova, preview: 'Elaborado · con encabezado, 5 bloques y footer' },
  minimal: { id: 'minimal', label: 'Minimal', description: 'Limpio y directo: lista plana con viñetas.', render: renderMinimal, preview: 'Limpio · lista por categorías' },
  elegant: { id: 'elegant', label: 'Elegant', description: 'Cajas unicode finas, como una carta.', render: renderElegant, preview: 'Cajas finas · elegante' },
  cyber: { id: 'cyber', label: 'Cyber', description: 'Bloques y flechas neón, estilo terminal hack.', render: renderCyber, preview: 'Terminal · neón · ▓▓▓' },
  compact: { id: 'compact', label: 'Compact', description: 'Una línea por categoría: máximo ahorro.', render: renderCompact, preview: 'Ultra corto · una línea' },
  retro: { id: 'retro', label: 'Retro', description: 'ASCII box art nostálgico, tipo BBS 90s.', render: renderRetro, preview: 'ASCII art · retro box' },
};

export function renderByStyle(styleId, data) {
  const entry = STYLES[styleId] || STYLES.versova;
  return entry.render(data);
}

export function listStyles() {
  return Object.values(STYLES).map((s) => ({ id: s.id, label: s.label, description: s.description, preview: s.preview }));
}
