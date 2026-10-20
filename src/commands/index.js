/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · registro de comandos
 * ────────────────────────────────────────────────────────────────
 * Reúne todos los módulos, valida que no haya duplicados y expone
 * un mapa nombre/alias → comando. Añadir un comando nuevo es crear
 * un objeto aquí: el router, el menú y la ayuda lo recogen solos.
 */
import { ALIASES, IDENTITY } from '../config/identity.js';
import { registroCommands } from './registro.js';
import { rolesCommands } from './roles.js';
import { teamCommands } from './team.js';
import { socialCommands } from './social.js';
import { adminCommands } from './admin.js';
import { adminExtraCommands } from './adminextras.js';
import { infoCommands, setRegistry } from './info.js';
import { sysCommands } from './sysinfo.js';
import { activationCommands } from './activation.js';
import { animeCommands } from './anime.js';
import { economyCommands } from './economy.js';
import { downloadCommands } from './download.js';
import { perfilCommands } from './perfil.js';
import { stickersCommands } from './stickers.js';
import { toolsCommands } from './tools.js';
import { logosCommands } from './logos.js';
import { funCommands } from './fun.js';

const MODULES = [
  ['info', infoCommands],
  ['info', sysCommands],
  ['activation', activationCommands],
  ['registro', registroCommands],
  ['roles', rolesCommands],
  ['team', teamCommands],
  ['social', socialCommands],
  ['admin', adminCommands],
  ['admin', adminExtraCommands],
  ['anime', animeCommands],
  ['economy', economyCommands],
  ['download', downloadCommands],
  ['perfil', perfilCommands],
  ['stickers', stickersCommands],
  ['tools', toolsCommands],
  ['logos', logosCommands],
  ['social', funCommands],
];

const list = [];
const map = new Map();

for (const [source, commands] of MODULES) {
  for (const command of commands) {
    if (!command?.name) throw new Error(`Comando sin nombre en ${source}`);
    if (typeof command.run !== 'function') throw new Error(`El comando "${command.name}" no tiene run()`);
    if (map.has(command.name)) throw new Error(`Comando duplicado: "${command.name}"`);

    const normalized = {
      hidden: false,
      groupOnly: true,
      confirm: false,
      permission: 'all',
      category: source,
      aliases: [],
      ...command,
      aliases: [...(command.aliases ?? []), ...(ALIASES[command.name] ?? [])],
      prefix: IDENTITY.prefix,
    };

    list.push(normalized);
    map.set(normalized.name, normalized);
    for (const alias of normalized.aliases) {
      if (map.has(alias) && map.get(alias) !== normalized) {
        throw new Error(`Alias duplicado: "${alias}" (${normalized.name} vs ${map.get(alias).name})`);
      }
      map.set(alias, normalized);
    }
  }
}

setRegistry({ list, map, get: (name) => map.get(String(name ?? '').toLowerCase()) ?? null });

/** Para validación de alias/custom sin colisión */
export const GLOBAL_COMMAND_NAMES = Object.freeze([...new Set([...map.keys(), ...list.map((c)=>c.name)])]);
export const GLOBAL_ALIASES = ALIASES;

export const registry = Object.freeze({
  /** Todos los comandos (sin alias duplicados). */
  get list() {
    return list;
  },
  /** Busca por nombre o alias. */
  get(name) {
    return map.get(String(name ?? '').toLowerCase()) ?? null;
  },
  /** Comandos visibles de una categoría. */
  byCategory(category) {
    return list.filter((c) => c.category === category && !c.hidden);
  },
  categories() {
    return [...new Set(list.map((c) => c.category))];
  },
  count() {
    return list.length;
  },
  /** Sugerencia por distancia de edición simple (para comandos mal escritos). */
  suggest(input) {
    const raw = String(input ?? '').toLowerCase();
    if (!raw) return null;
    let best = null;
    for (const command of list) {
      if (command.hidden) continue;
      const distance = levenshtein(raw, command.name);
      if (distance <= 2 && (!best || distance < best.distance)) best = { name: command.name, distance };
    }
    return best?.name ?? null;
  },
});

/** Distancia de Levenshtein (implementación corta y sin dependencias). */
function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[a.length][b.length];
}

export default registry;
