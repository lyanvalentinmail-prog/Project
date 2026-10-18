/**
 * VÉRSOVA · resolución de comandos con personalización por bot
 */
import { registry } from '../commands/index.js';
import { customRepo } from '../db/repositories/bot-customization.repo.js';
import { ok } from '../services/result.js';

function interpolateResponse(template, ctx) {
  let text = String(template);
  const vars = {
    user: ctx.author?.name || ctx.author?.jid?.split('@')[0] || 'usuario',
    botName: ctx.instance?.name || 'Bot',
    prefix: ctx.prefix || '.',
    groupName: ctx.group?.name || 'grupo',
    team: ctx.group?.name || 'team',
    date: new Date().toLocaleDateString('es'),
  };
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{{${k}}}`, String(v));
    text = text.replaceAll(`{{ ${k} }}`, String(v));
  }
  return text;
}

/**
 * Resuelve un comando para una instancia específica con aliases y customs.
 * Devuelve { command, isCustom, customDef } o null si no existe / deshabilitado
 */
/** ¿La categoría efectiva del comando está apagada para esta instancia? */
function categoryIsDisabled(custom, commandName, baseCategory) {
  const cats = new Set((custom?.disabledCategories || []).map((s) => s.toLowerCase()));
  if (!cats.size) return false;
  const overrides = custom?.categoryOverrides || {};
  const effective = String(overrides[String(commandName).toLowerCase()] || baseCategory || '').toLowerCase();
  return cats.has(effective);
}

export function resolveCommandForInstance(instance, nameRaw) {
  const name = String(nameRaw || '').toLowerCase().trim();
  if (!name) return null;
  const custom = instance ? customRepo.get(instance.id) : null;
  const disabled = new Set((custom?.disabled || []).map((s) => s.toLowerCase()));
  if (disabled.has(name)) return { disabled: true, name };

  // 1. Built-in directo o alias global
  let builtin = registry.get(name);
  if (builtin && !disabled.has(builtin.name.toLowerCase())) {
    if (categoryIsDisabled(custom, builtin.name, builtin.category)) return { disabled: true, name, viaCategory: true };
    return { command: builtin, isCustom: false };
  }
  // 2. Aliases extra por instancia
  if (custom?.aliases) {
    for (const [cmdName, aliases] of Object.entries(custom.aliases)) {
      if (disabled.has(cmdName.toLowerCase())) continue;
      if (aliases.map((a) => a.toLowerCase()).includes(name)) {
        const target = registry.get(cmdName);
        if (target) {
          if (categoryIsDisabled(custom, target.name, target.category)) return { disabled: true, name, viaCategory: true };
          return { command: target, isCustom: false, viaAlias: name };
        }
      }
    }
  }
  // 3. Custom commands (nombre directo o alias)
  if (custom?.customCommands) {
    for (const cc of custom.customCommands) {
      if (disabled.has(cc.name.toLowerCase())) continue;
      if (categoryIsDisabled(custom, cc.name, cc.category)) continue;
      if (cc.name.toLowerCase() === name) return { command: buildCustomCommand(cc), isCustom: true, customDef: cc };
      const aliasMatch = (cc.aliases || []).some((a) => a.toLowerCase() === name);
      if (aliasMatch) return { command: buildCustomCommand(cc), isCustom: true, customDef: cc };
    }
  }
  return null;
}

function buildCustomCommand(def) {
  return {
    name: def.name,
    category: def.category,
    aliases: def.aliases || [],
    permission: def.permission || 'all',
    groupOnly: def.groupOnly !== undefined ? def.groupOnly : true,
    hidden: Boolean(def.hidden),
    description: def.description,
    args: def.args || '',
    // run dinámico
    async run(ctx) {
      const text = interpolateResponse(def.response, ctx);
      return ok('custom.response', { text, command: def.name });
    },
    isCustom: true,
    isCustomDef: def,
  };
}

/** Verifica si un comando está deshabilitado (directamente o por su categoría) */
export function isDisabled(instance, commandName) {
  if (!instance) return false;
  const custom = customRepo.get(instance.id);
  if ((custom.disabled || []).map((s)=>s.toLowerCase()).includes(String(commandName).toLowerCase())) return true;
  const builtin = registry.get(commandName);
  if (builtin && categoryIsDisabled(custom, builtin.name, builtin.category)) return true;
  return false;
}

/**
 * Lista TODOS los comandos visibles (built-in + custom) con banderas de
 * estado para el panel: disabled (apagado a mano) y categoryDisabled
 * (su categoría completa está apagada). El menú filtra ambos casos.
 */
export function listCommandsForInstance(instance) {
  const custom = instance ? customRepo.get(instance.id) : { aliases: {}, disabled: [], disabledCategories: [], customCommands: [], categoryOverrides: {}, categories: [] };
  const disabled = new Set((custom.disabled || []).map((s)=>s.toLowerCase()));
  const aliasExtra = custom.aliases || {};
  const overrides = custom.categoryOverrides || {};
  const out = [];
  for (const c of registry.list) {
    if (c.hidden) continue;
    const cat = overrides[c.name.toLowerCase()] || c.category;
    out.push({
      name: c.name,
      category: cat,
      description: c.description,
      args: c.args || '',
      permission: c.permission,
      aliases: [...(c.aliases||[]), ...(aliasExtra[c.name.toLowerCase()]||[])],
      isCustom: false,
      disabled: disabled.has(c.name.toLowerCase()),
      categoryDisabled: categoryIsDisabled(custom, c.name, c.category),
      groupOnly: c.groupOnly,
      hidden: c.hidden,
    });
  }
  for (const cc of (custom.customCommands||[])) {
    if (cc.hidden) continue;
    out.push({
      name: cc.name,
      category: cc.category,
      description: cc.description,
      args: cc.args || '',
      permission: cc.permission,
      aliases: cc.aliases || [],
      isCustom: true,
      disabled: disabled.has(cc.name.toLowerCase()),
      categoryDisabled: categoryIsDisabled(custom, cc.name, cc.category),
      groupOnly: cc.groupOnly,
      hidden: cc.hidden,
      response: cc.response,
    });
  }
  return out;
}
