/**
 * 𓆩 🌊 𓆪  VÉRSOVA · tests del bot/estilo Tomioka
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { renderByStyle, listStyles, renderTomioka } from '../src/design/menu-styles.js';
import { ALLOWED_MENU_STYLES } from '../src/db/repositories/bot-customization.repo.js';
import { renderResult } from '../src/design/index.js';
import { setRenderStyle } from '../src/design/theme.js';
import { ok } from '../src/services/result.js';

const menuData = {
  status: 'ᴏɴʟɪɴᴇ',
  prefix: '.',
  name: 'Tomioka',
  team: 'Tomika',
  version: '1.0',
  categories: [
    {
      meta: { id: 'info', title: '𝕴𝐍𝐅𝐎𝐑𝐌𝐀𝐂𝐈𝐎𝐍', icon: '🥢', sub: '𝖻𝗈𝗍 𝗂𝗇𝖿𝗈𝗋𝗆𝖺𝗍𝗂𝗈𝗇', kaomoji: '( ᵕ ᴗ ᵕ )', index: 1 },
      commands: [{ name: 'menu', args: '[categoría]' }, { name: 'ping', args: '' }],
    },
    {
      meta: { id: 'admin', title: '𝕬𝐃𝐌𝐈𝐍𝐈𝐒𝐓𝐑𝐀𝐂𝐈𝐎𝐍', icon: '⛓️', sub: '𝗌𝗍𝖺𝖿𝖿 𝗈𝗇𝗅𝗒', kaomoji: '( ¬_¬)', index: 6 },
      commands: [{ name: 'warn', args: '<@usuario> [motivo]' }],
    },
    {
      meta: { id: 'social', title: '𝕴𝐍𝐓𝐄𝐑𝐀𝐂𝐂𝐈𝐎𝐍', icon: '🥢', sub: '𝗌𝗈𝖼𝗂𝖺𝗅 & 𝖿𝗎𝗇', kaomoji: '(˶ᵔ ᵕ ᵔ˶)', index: 5 },
      commands: [{ name: 'dado', args: '[caras|NdF]' }],
    },
  ],
};

/* ── registro del estilo ───────────────────────────────────────── */

test('tomioka está registrado como estilo elegible y listado para el panel', () => {
  assert.ok(ALLOWED_MENU_STYLES.includes('tomioka'));
  const entry = listStyles().find((style) => style.id === 'tomioka');
  assert.ok(entry, 'debe aparecer en listStyles');
  assert.equal(entry.label, 'Tomioka');
  assert.ok(entry.description.length > 10);
});

/* ── menú ──────────────────────────────────────────────────────── */

test('el menú Tomioka reproduce su marca, bloques numerados y cierre', () => {
  const menu = renderByStyle('tomioka', menuData);
  assert.equal(menu, renderTomioka(menuData));
  assert.match(menu, /꒰♯🌊⸝⸝@/);
  assert.match(menu, /🌊ㅤ׃ㅤ 𝕴𝐍𝐅𝐎𝐑𝐌𝐀𝐂𝐈𝐎𝐍 ㅤ׃/);
  assert.match(menu, /𝖭𝖺𝗆𝖾ㅤ⁙ {4}@/);
  assert.match(menu, /◢🌊◣ 𝕿𝖔𝖒𝖎𝖐𝖆 ࿙💧࿚/);
  assert.ok(!menu.includes('@VÉRSOVA'), 'la identidad del bloque INFO es Tomioka, no la global');
  assert.match(menu, /𝖵𝖾𝗋𝗌𝗂𝗈𝗇ㅤ⁙ㅤ𝟏\.𝟎/);
  assert.match(menu, /◢ 𝟎𝟏 ◣/);
  assert.match(menu, /◢ 𝟎𝟐 ◣/);
  assert.match(menu, /◢ 𝟎𝟑 ◣/);
  assert.match(menu, /🫧ㅤ׃ㅤ 𝕴𝐍𝐅𝐎𝐑𝐌𝐀𝐂𝐈𝐎𝐍 ㅤ׃/);
  assert.match(menu, /🌀ㅤ׃ㅤ 𝕬𝐃𝐌𝐈𝐍𝐈𝐒𝐓𝐑𝐀𝐂𝐈𝐎𝐍 ㅤ׃/);
  assert.match(menu, /୨ৎㅤ\.menu \[categoría\]/);
  assert.match(menu, /୨ৎㅤ\.warn <@usuario> \[motivo\]/);
  assert.match(menu, /𝕰𝐍𝐃 𝐎𝐅 𝐌𝐄𝐍𝐔/);
  assert.match(menu, /𝖾𝗌𝗍\.ㅤ𝟐𝟎𝟐𝟔/);
  assert.match(menu, /Que la calma del agua guíe/);
});

/* ── aviso de .warn ────────────────────────────────────────────── */

test('con estilo tomioka, el warn lista el historial con fechas', () => {
  setRenderStyle('tomioka');
  try {
    const ts = new Date(2026, 9, 19, 14, 32).getTime(); // 19 de octubre del 2026, 14:32 (local)
    const out = renderResult(ok('mod.warn', {
      userName: 'Moon',
      userMention: '@59899111222',
      reason: 'habló al privado',
      adminName: 'Admin',
      count: 2,
      max: 3,
      warnings: [
        { reason: 'spam en el grupo', createdAt: ts - 86_400_000 },
        { reason: 'habló al privado', createdAt: ts },
      ],
    }));
    assert.match(out, /꒰♯🌊⸝⸝@/);
    assert.match(out, /🌊ㅤ⁙ㅤ 𝕬𝐃𝐕𝐄𝐑𝐓𝐄𝐍𝐂𝐈𝐀 ㅤ׃/);
    assert.match(out, /✐ Se ha añadido una advertencia a @59899111222\./);
    assert.match(out, /❖ Advertencias totales `\(2\)`:/);
    assert.match(out, /`#1` » spam en el grupo/);
    assert.match(out, /`#2` » habló al privado/);
    assert.match(out, /> » Fecha: 18 de octubre del 2026, 14:32/);
    assert.match(out, /> » Fecha: 19 de octubre del 2026, 14:32/);
  } finally {
    setRenderStyle('versova');
  }
});

test('con estilo tomioka y sin historial, el warn usa el motivo actual', () => {
  setRenderStyle('tomioka');
  try {
    const out = renderResult(ok('mod.warn', {
      userName: 'Moon', userMention: '@1', reason: 'habló al privado', adminName: 'Admin', count: 1, max: 3,
    }));
    assert.match(out, /❖ Advertencias totales `\(1\)`:/);
    assert.match(out, /`#1` » habló al privado/);
    assert.match(out, /> » Fecha: \d{1,2} de [a-z]+ del \d{4}, \d{2}:\d{2}/);
  } finally {
    setRenderStyle('versova');
  }
});

test('sin estilo tomioka, el warn mantiene el formato clásico', () => {
  setRenderStyle('versova');
  const out = renderResult(ok('mod.warn', {
    userName: 'Moon', userMention: '@1', reason: 'Spam', adminName: 'Admin', count: 1, max: 3,
  }));
  assert.match(out, /𝐴𝑑𝑣𝑒𝑟𝑡𝑒𝑛𝑐𝑖𝑎/);
  assert.ok(!out.includes('Advertencias totales'));
});
