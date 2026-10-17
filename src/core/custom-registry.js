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
export function resolveCommandForInstance(instance, nameRaw) {
  const name = String(nameRaw || '').toLowerCase().trim();
  if (!name) return null;
  const custom = instance ? customRepo.get(instance.id) : null;
  const disabled = new Set((custom?.disabled || []).map((s) => s.toLowerCase()));
  if (disabled.has(name)) return { disabled: true, name };

  // 1. Built-in directo o alias global
  let builtin = registry.get(name);
  if (builtin && !disabled.has(builtin.name.toLowerCase())) {
    return { command: builtin, isCustom: false };
  }
  // 2. Aliases extra por instancia
  if (custom?.aliases) {
    for (const [cmdName, aliases] of Object.entries(custom.aliases)) {
      if (disabled.has(cmdName.toLowerCase())) continue;
      if (aliases.map((a) => a.toLowerCase()).includes(name)) {
        const target = registry.get(cmdName);
        if (target) return { command: target, isCustom: false, viaAlias: name };
      }
    }
  }
  // 3. Custom commands (nombre directo o alias)
  if (custom?.customCommands) {
    for (const cc of custom.customCommands) {
      if (disabled.has(cc.name.toLowerCase())) continue;
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

/** Verifica si un comando está deshabilitado */
export function isDisabled(instance, commandName) {
  if (!instance) return false;
  const custom = customRepo.get(instance.id);
  return (custom.disabled || []).map((s)=>s.toLowerCase()).includes(String(commandName).toLowerCase());
}

/** Lista todos los comandos visibles para una instancia (built-in + custom) */
export function listCommandsForInstance(instance) {
  const custom = instance ? customRepo.get(instance.id) : { aliases: {}, disabled: [], customCommands: [], categoryOverrides: {}, categories: [] };
  const disabled = new Set((custom.disabled || []).map((s)=>s.toLowerCase()));
  const aliasExtra = custom.aliases || {};
  const overrides = custom.categoryOverrides || {};
  const out = [];
  for (const c of registry.list) {
    if (c.hidden) continue;
    if (disabled.has(c.name.toLowerCase())) continue;
    const cat = overrides[c.name.toLowerCase()] || c.category;
    out.push({
      name: c.name,
      category: cat,
      description: c.description,
      args: c.args || '',
      permission: c.permission,
      aliases: [...(c.aliases||[]), ...(aliasExtra[c.name.toLowerCase()]||[])],
      isCustom: false,
      disabled: false,
      groupOnly: c.groupOnly,
      hidden: c.hidden,
    });
  }
  for (const cc of (custom.customCommands||[])) {
    if (disabled.has(cc.name.toLowerCase())) continue;
    if (cc.hidden) continue; // hide hidden customs from menu? but still executable
    // We'll still include hidden? For menu we filter hidden, but for listing we include flag
    // To keep menu clean, we filter hidden here too? Let's filter hidden for menuData but keep for API
    out.push({
      name: cc.name,
      category: cc.category,
      description: cc.description,
      args: cc.args || '',
      permission: cc.permission,
      aliases: cc.aliases || [],
      isCustom: true,
      disabled: false,
      groupOnly: cc.groupOnly,
      hidden: cc.hidden,
      response: cc.response,
    });
  }
  // Also include disabled but mark? For UI we need disabled list, so we include separately via custom.disabled
  return out;
}
