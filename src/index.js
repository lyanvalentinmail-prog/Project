/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · punto de entrada
 * ────────────────────────────────────────────────────────────────
 *   npm start            → bot + panel web
 *   npm run bot          → solo bot (--no-web)
 *   npm run web          → solo panel (--web-only)
 *
 * Maneja señales de apagado, errores no capturados y reconexión.
 */
import process from 'node:process';
import { initDatabase, closeDatabase, driverInfo, currentJournalMode } from './db/index.js';
import { env } from './config/env.js';
import { IDENTITY } from './config/identity.js';
import { BotManager } from './core/bot-manager.js';
import { startMaintenance, runMaintenance } from './core/maintenance.js';
import { registry } from './commands/index.js';
import { banner, scoped } from './core/logger.js';
import { attachTerminalLinking } from './core/terminal-link.js';
import { isTermux, platformLabel, panelUrls } from './utils/platform.js';
import { acquireInstanceLock, lockFileFor, EXIT_ALREADY_RUNNING } from './utils/instance-lock.js';

const log = scoped('boot');

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const withWeb = !hasFlag('--no-web');
const withBot = !hasFlag('--web-only');

/** Motor SQLite en una línea: «node:sqlite (integrado en Node) · SQLite 3.51.3 · WAL». */
function databaseEngine() {
  const info = driverInfo();
  if (!info?.ok) return 'sin motor SQLite';
  const engine = info.name === 'node:sqlite' ? 'node:sqlite (integrado en Node)' : `${info.name} ${info.version ?? ''}`.trim();
  const journal = currentJournalMode();
  return [engine, info.sqliteVersion ? `SQLite ${info.sqliteVersion}` : null, journal ? journal.toUpperCase() : null].filter(Boolean).join(' · ');
}

function printBanner({ url, host, port }) {
  banner.title(`
ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙
ㅤㅤㅤ𓆩ㅤ禊ㅤ𓆪
ㅤㅤ𝑽 𝑬́ 𝑹 𝑺 𝑶 𝑽 𝑨
ㅤㅤ◢禍◣ Versova ࿙☕࿚
`);
  banner.ok(`Bot ${IDENTITY.name} v${IDENTITY.version} · prefijos # - + . / (por sub-bot)`);
  banner.info(`Plataforma     ⁙ ${platformLabel()} · Node ${process.version} · ${process.arch}`);
  banner.info(`Base de datos  ⁙ ${env.dbPath}`);
  banner.info(`Motor          ⁙ ${databaseEngine()}`);
  banner.info(`Sesiones       ⁙ ${env.sessionsDir}`);
  banner.info(`Comandos       ⁙ ${registry.count()} registrados`);
  if (withWeb) {
    const urls = process.env.RENDER_EXTERNAL_URL ? [url] : panelUrls({ host, port });
    banner.info(`Panel web      ⁙ ${urls[0] ?? url}`);
    for (const extra of urls.slice(1)) banner.info(`En tu red      ⁙ ${extra}`);
    banner.info(`Panel web      ⁙ Abierto (sin contraseña)`);
  }
  if (env.ownerNumbers.length) banner.info(`Owner          ⁙ ${env.ownerNumbers.join(', ')}`);
  else banner.warn('OWNER_NUMBERS está vacío: nadie tendrá rango de owner. Edita tu .env');
  if (isTermux()) {
    banner.info('Termux         ⁙ deja Termux abierto o en segundo plano y desactiva la optimización de batería');
    if (!process.env.VERSOVA_SUPERVISED) {
      banner.warn('Arráncalo con «npm run termux»: mantiene el teléfono despierto y reinicia el bot si se cae.');
    }
  }
}

async function main() {
  // una sola copia por carpeta de datos: dos procesos con la misma sesión se desconectan entre sí (440)
  const lock = acquireInstanceLock(lockFileFor(env.dbPath));
  if (!lock.ok) {
    banner.error(`VÉRSOVA ya está en marcha con estos mismos datos (PID ${lock.holder.pid}).`);
    banner.info('Dos copias a la vez se pelean por la sesión de WhatsApp. Usa la que ya está abierta');
    banner.info(`o ciérrala antes (Ctrl+C en su terminal, o: kill ${lock.holder.pid}).`);
    process.exit(EXIT_ALREADY_RUNNING);
  }
  if (lock.warning) log.warn({ warning: lock.warning }, 'no se pudo crear el candado de instancia única');
  process.on('exit', lock.release);

  initDatabase();
  const manager = new BotManager();

  let stopWeb = null;
  let url = null;
  let host = env.webHost;
  let port = env.webPort;

  if (withWeb) {
    const { createWebServer } = await import('../web/server.js');
    const web = await createWebServer({ manager });
    stopWeb = web.stop;
    url = web.url;
    host = web.host ?? host;
    port = web.port ?? port;
  }

  printBanner({ url, host, port });

  if (withBot) {
    // pairing codes, QR y estados de conexión también en la consola (Termux/SSH)
    attachTerminalLinking(manager);
    const results = await manager.startAll();
    if (!results.length && withWeb) {
      banner.warn('No hay sub-bots con inicio automático. Abre el panel web y vincula uno con WhatsApp.');
    }
    for (const result of results) {
      if (result.ok) banner.ok(`Sub-bot "${result.client?.name ?? result.id}" iniciado → ${result.client?.status}`);
      else banner.error(`Sub-bot "${result.id}" no arrancó: ${result.error}`);
    }
    if (!withWeb) {
      // Sin panel no hay forma de vincular ni de arrancar bots: en vez de quedarse
      // colgado (o cerrarse sin decir nada) se explica qué hacer.
      if (!results.some((result) => result.ok)) {
        banner.warn(results.length
          ? 'Modo solo bot (--no-web): ningún sub-bot pudo arrancar.'
          : 'Modo solo bot (--no-web): no hay sub-bots vinculados que arrancar.');
        banner.info('Vincula uno con «npm run vincular», o arranca con el panel web: «npm run termux» (Termux) o «npm start».');
        closeDatabase();
        process.exit(results.length ? 1 : 0);
      }
      // sin el servidor web nada mantiene vivo el proceso: que no se cierre solo
      // si todos los bots quedan en pausa (sesión cerrada, reemplazada…)
      setInterval(() => {}, 2 ** 31 - 1);
    }
  }

  const stopMaintenance = startMaintenance({ manager });
  runMaintenance({ manager, notify: false }).catch(() => null);

  // ── apagado limpio ───────────────────────────────────────────
  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    process.stdout.write('\n');
    banner.info(`${signal} recibido · cerrando VÉRSOVA…`);
    stopMaintenance();
    try {
      await manager.stopAll();
    } catch (error) {
      log.warn({ err: error }, 'error al detener los sub-bots');
    }
    try {
      await stopWeb?.();
    } catch (error) {
      log.warn({ err: error }, 'error al detener el panel web');
    }
    closeDatabase();
    banner.ok('Sesión guardada. Los datos quedan en la base de datos.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  // cerrar la sesión de Termux (o la terminal SSH) envía SIGHUP
  if (process.platform !== 'win32') process.on('SIGHUP', () => shutdown('SIGHUP'));

  // ── errores no capturados: se registran, el bot sigue vivo ───
  process.on('unhandledRejection', (reason) => {
    log.error({ reason: String(reason?.message ?? reason) }, 'promesa rechazada sin manejar');
  });
  process.on('uncaughtException', (error) => {
    log.error({ err: error }, 'excepción no capturada (el bot continúa)');
  });

  return manager;
}

main().catch((error) => {
  banner.error(`VÉRSOVA no pudo arrancar: ${error?.message ?? error}`);
  log.error({ err: error }, 'arranque fallido');
  process.exit(1);
});
