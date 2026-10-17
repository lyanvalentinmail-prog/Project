/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · generador de docs/COMANDOS.md
 * ────────────────────────────────────────────────────────────────
 * Regenera las tablas de comandos (①–⑬) desde el registro real, así
 * la referencia nunca se desincroniza del código. Las secciones
 * escritas a mano (rangos, flujos, vinculación, confirmación,
 * límites) se conservan tal cual.
 *
 * Uso: npm run docs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registry } from '../src/commands/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DOC = path.join(here, '..', 'docs', 'COMANDOS.md');

const ORDER = [
  ['info', '①', '☕', 'INFORMACIÓN Y SISTEMA'],
  ['registro', '②', '✎', 'REGISTRO'],
  ['roles', '③', '🥢', 'PERSONAJES (ROLES)'],
  ['team', '④', '𖤐', 'GESTIÓN DEL TEAM'],
  ['social', '⑤', '♡', 'INTERACCIÓN SOCIAL'],
  ['admin', '⑥', '⛓️', 'ADMINISTRACIÓN (solo staff)'],
  ['anime', '⑦', '🧈', 'ANIME'],
  ['economy', '⑧', '🪷', 'ECONOMÍA · ¥enes'],
  ['download', '⑨', '🛍️', 'DESCARGAS'],
  ['perfil', '⑩', '🌸', 'PERFIL EXTENDIDO'],
  ['stickers', '⑪', '⭐', 'STICKERS'],
  ['tools', '⑫', '💐', 'HERRAMIENTAS'],
  ['logos', '⑬', '🍰', 'LOGOS'],
];

const PERMISSION = { all: 'todos', registered: 'registrados', admin: 'admins', owner: 'owner del bot' };

const escape = (text) => String(text ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();

function row(command) {
  const usage = command.args ? ` \`${escape(command.args)}\`` : '';
  const permission = (PERMISSION[command.permission] ?? command.permission) +
    (command.confirm ? ' · **pide confirmación**' : '');
  const parts = [escape(command.description) || 'Sin descripción.'];
  if (command.example) parts.push(`Ejemplo: \`${escape(command.example)}\``);
  if (command.aliases?.length) parts.push(`Alias: ${command.aliases.map((a) => `\`.${escape(a)}\``).join(' ')}`);
  if (!command.groupOnly) parts.push('📩 También funciona por privado.');
  if (command.notes) parts.push(`⚠ ${escape(command.notes)}`);
  return `| \`.${command.name}\`${usage} | ${permission} | ${parts.join('<br />')} |`;
}

function section(category, number, icon, title) {
  const commands = registry.byCategory(category);
  if (!commands.length) return null;
  const lines = [
    `## 𓆩 ${icon} 𓆪 ${number} ${title}`,
    '',
    '| Comando | Permiso | Qué hace |',
    '|---|---|---|',
    ...commands.map(row),
    '',
  ];
  return lines.join('\n');
}

const START = '## 𓆩 ☕ 𓆪 ① INFORMACIÓN Y SISTEMA';
const END = '## 𓆩 禊 𓆪 COMANDOS DE CONFIRMACIÓN';

const original = fs.readFileSync(DOC, 'utf8');
const startAt = original.indexOf(START);
const endAt = original.indexOf(END);
if (startAt === -1 || endAt === -1 || endAt <= startAt) {
  console.error('No se encontraron los marcadores de sección en docs/COMANDOS.md');
  process.exit(1);
}

const known = new Set(ORDER.map(([id]) => id));
const extra = registry.categories().filter((id) => !known.has(id));
const blocks = [];
for (const [id, number, icon, title] of ORDER) {
  const text = section(id, number, icon, title);
  if (text) blocks.push(text);
}
for (const id of extra) {
  const text = section(id, '✦', '✦', id.toUpperCase());
  if (text) blocks.push(text);
}

const total = blocks.reduce((sum, block) => sum + (block.match(/\n\| `\./g) ?? []).length, 0);
const updated = `${original.slice(0, startAt)}${blocks.join('\n')}\n${original.slice(endAt)}`;
fs.writeFileSync(DOC, updated);
console.log(`docs/COMANDOS.md actualizado: ${total} comandos en ${blocks.length} secciones.`);
