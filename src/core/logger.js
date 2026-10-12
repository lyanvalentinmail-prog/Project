/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · logger
 * ────────────────────────────────────────────────────────────────
 * pino con dos destinos: consola legible (con la estética del bot)
 * y archivo JSON en logs/ para auditoría técnica.
 * También sirve como logger de Baileys (implementa ILogger).
 */
import { Writable } from 'node:stream';
import pino from 'pino';
import { env } from '../config/env.js';

const COLORS = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  debug: '\x1b[90m',
  trace: '\x1b[90m',
  fatal: '\x1b[35m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

const clock = () => new Date().toLocaleTimeString('es-MX', { hour12: false });

/** Salida bonita para consola. */
const prettyStream = new Writable({
  write(chunk, _encoding, callback) {
    try {
      const entry = JSON.parse(chunk.toString());
      const { level, time, msg, scope, ...rest } = entry;
      const levelName = pino.levels.labels[level] ?? 'info';
      const color = COLORS[levelName] ?? '';
      const extras = Object.keys(rest).length
        ? ` ${COLORS.dim}${JSON.stringify(rest).slice(0, 240)}${COLORS.reset}`
        : '';
      process.stdout.write(
        `${COLORS.dim}${clock()}${COLORS.reset} ${color}${levelName.toUpperCase().padEnd(5)}${COLORS.reset} ` +
          `${scope ? `${COLORS.dim}[${scope}]${COLORS.reset} ` : ''}${msg ?? ''}${extras}\n`
      );
    } catch {
      process.stdout.write(chunk);
    }
    callback();
  },
});

const streams = [{ level: env.logLevel, stream: prettyStream }];
if (env.logToFile) {
  // Escritura síncrona: con `sync:false` pino deja un worker pendiente y
  // un `process.exit()` temprano revienta con "sonic boom is not ready yet".
  streams.push({
    level: env.logLevel,
    stream: pino.destination({ dest: env.logFile, sync: true, mkdir: true }),
  });
}

export const logger = pino({ level: env.logLevel, base: undefined }, pino.multistream(streams));

/** Logger etiquetado por sub-bot / módulo. */
export const scoped = (scope) => logger.child({ scope });

/** Logger silencioso para Baileys (evita inundar la consola). */
export function baileysLogger(scope, level = 'silent') {
  return pino({ level, base: undefined }, pino.multistream([{ level, stream: prettyStream }]));
}

/** Mensajes de arranque con la estética de VÉRSOVA. */
export const banner = {
  info: (text) => process.stdout.write(`\x1b[36m☕\x1b[0m ${text}\n`),
  ok: (text) => process.stdout.write(`\x1b[32m✓\x1b[0m ${text}\n`),
  warn: (text) => process.stdout.write(`\x1b[33m⚠\x1b[0m ${text}\n`),
  error: (text) => process.stdout.write(`\x1b[31m✗\x1b[0m ${text}\n`),
  title: (text) => process.stdout.write(`\n\x1b[1m${text}\x1b[0m\n`),
};

export default logger;
