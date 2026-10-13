/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · router de comandos
 * ────────────────────────────────────────────────────────────────
 * Único camino entre un mensaje y un comando:
 *   prefijo → parseo → existencia → grupo → rate-limit → permisos → run
 * Cualquier fallo se responde con un mensaje decorado y se registra;
 * NUNCA se propaga hacia arriba (el bot sigue vivo).
 */
import { registry } from '../commands/index.js';
import { IDENTITY } from '../config/identity.js';
import { env } from '../config/env.js';
import { checkRateLimit } from '../security/rate-limit.js';
import { checkPermission } from '../security/permissions.js';
import { applyResult } from './context.js';
import { ok, fail } from '../services/result.js';
import { splitArgs } from '../utils/text.js';
import { auditRepo, statsRepo, ALLOWED_PREFIXES } from '../db/index.js';
import { scoped } from './logger.js';

const log = scoped('router');

/** Comandos universales: se aceptan con CUALQUIERA de los prefijos (# - + . /). */
const UNIVERSAL_COMMANDS = new Set(['key', 'clave', 'pairing', 'codigo', 'código', 'pairingcode', 'vincular']);

/** Prefijos aceptados: el del sub-bot, el del grupo (config) y el global. */
export function prefixesFor(ctx) {
  const instancePrefix = ctx.instance?.prefix;
  const groupPrefix = ctx.group?.config?.prefix;
  const list = [instancePrefix, groupPrefix].filter(Boolean);
  return [...new Set(list.length ? list : [IDENTITY.prefix])];
}

/** ¿El texto es un comando? Devuelve `{ prefix, name, args, argList }` o null. */
export function parseCommand(text, ctx) {
  const raw = String(text ?? '').trim();
  if (!raw) return null;
  let prefix = prefixesFor(ctx).find((p) => raw.startsWith(p));

  // `.key` (y alias) funciona con cualquier prefijo permitido, incluso
  // antes de que el bot esté activado: es el comando de activación.
  if (!prefix) {
    prefix = ALLOWED_PREFIXES.find((p) => {
      if (!raw.startsWith(p)) return false;
      const head = raw.slice(p.length).trim().split(/\s+/)[0]?.toLowerCase() ?? '';
      return UNIVERSAL_COMMANDS.has(head);
    });
  }
  if (!prefix) return null;

  const withoutPrefix = raw.slice(prefix.length).trim();
  if (!withoutPrefix) return null;

  const [nameRaw, ...rest] = withoutPrefix.split(/\s+/);
  const name = String(nameRaw).toLowerCase();
  // Un punto suelto o ".3" no es un comando: se ignora en silencio.
  if (!/^[\p{L}ñ][\p{L}\p{N}_-]{0,24}$/u.test(name)) return null;

  const args = rest.join(' ');
  return { prefix, name, args, argList: splitArgs(args) };
}

/**
 * Ejecuta un comando ya parseado.
 * @returns {Promise<boolean>} true si se respondió algo
 */
export async function dispatch(ctx, parsed) {
  const command = registry.get(parsed.name);

  if (!command) {
    const suggestion = registry.suggest(parsed.name);
    await applyResult(ctx, fail('sys.unknownCommand', { command: parsed.name, suggestion }));
    return true;
  }

  // comandos que solo tienen sentido dentro de un grupo
  if (command.groupOnly && !ctx.isGroup) {
    await applyResult(ctx, fail('sys.groupOnly', { command: command.name }));
    return true;
  }

  // grupo cerrado (.close): los miembros no reciben respuesta,
  // igual que en WhatsApp, donde ni siquiera pueden escribir.
  if (ctx.isGroup && ctx.group?.locked && !ctx.author.isAdmin) {
    log.debug({ command: command.name, group: ctx.group.groupId }, 'comando ignorado: grupo cerrado');
    return false;
  }

  // rate limit (seguridad #9)
  const limit = checkRateLimit({
    groupId: ctx.group?.groupId ?? null,
    jid: ctx.author.jid,
    command: command.name,
  });
  if (!limit.allowed) {
    auditRepo.log({
      instanceId: ctx.instance?.id ?? null,
      groupId: ctx.group?.groupId ?? null,
      actorJid: ctx.author.jid,
      action: 'security.ratelimit',
      detail: { command: command.name, blocked: limit.blocked, retryInMs: limit.retryInMs },
    });
    await applyResult(
      ctx,
      fail('sys.rateLimited', {
        retryIn: Math.ceil(limit.retryInMs / 1000),
        max: env.rateLimitMax,
        windowSec: Math.round(env.rateLimitWindowMs / 1000),
        command: command.name,
      })
    );
    return true;
  }

  // permisos (seguridad #1)
  const permission = checkPermission(ctx, command.permission);
  if (!permission.ok) {
    auditRepo.log({
      instanceId: ctx.instance?.id ?? null,
      groupId: ctx.group?.groupId ?? null,
      actorJid: ctx.author.jid,
      action: 'security.denied',
      detail: { command: command.name, required: command.permission, rank: ctx.author.rank },
    });
    await applyResult(ctx, fail('sys.noPermission', { required: command.permission, command: command.name }));
    return true;
  }

  // ejecución
  ctx.command = command.name;
  ctx.args = parsed.args;
  ctx.argList = parsed.argList;
  ctx.prefix = parsed.prefix;

  try {
    const result = await command.run(ctx);
    if (!result) return false;
    statsRepo.bumpCommand(command.name);
    await applyResult(ctx, result);
    return true;
  } catch (error) {
    log.error({ err: error, command: command.name, group: ctx.group?.groupId }, 'fallo en comando');
    auditRepo.log({
      instanceId: ctx.instance?.id ?? null,
      groupId: ctx.group?.groupId ?? null,
      actorJid: ctx.author.jid,
      action: 'error.command',
      detail: { command: command.name, error: String(error?.message ?? error).slice(0, 300) },
    });
    await applyResult(
      ctx,
      fail('sys.error', {
        command: command.name,
        message: 'Algo falló al procesar tu comando. No se modificó ningún dato.',
      })
    ).catch(() => null);
    return true;
  }
}

/** Punto de entrada desde el adaptador: devuelve true si el mensaje era un comando. */
export async function handleCommandMessage(ctx) {
  const parsed = parseCommand(ctx.text, ctx);
  if (!parsed) return false;

  return dispatch(ctx, parsed);
}

/** Ejecuta un comando "a mano" (panel web, simulador, tests). */
export async function executeCommand(ctx, name, args = '') {
  const parsed = { prefix: IDENTITY.prefix, name: String(name).toLowerCase(), args, argList: splitArgs(args) };
  return dispatch(ctx, parsed);
}

export { ok };
