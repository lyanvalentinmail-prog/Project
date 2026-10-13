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
import { initDatabase, closeDatabase } from './db/index.js';
import { env } from './config/env.js';
import { IDENTITY } from './config/identity.js';
import { BotManager } from './core/bot-manager.js';
import { startMaintenance, runMaintenance } from './core/maintenance.js';
import { registry } from './commands/index.js';
import { banner, scoped } from './core/logger.js';

const log = scoped('boot');

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const withWeb = !hasFlag('--no-web');
const withBot = !hasFlag('--web-only');

function printBanner({ url }) {
  banner.title(`
ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙
ㅤㅤㅤ𓆩ㅤ禊ㅤ𓆪
ㅤㅤ𝑽 𝑬́ 𝑹 𝑺 𝑶 𝑽 𝑨
ㅤㅤ◢禍◣ Versova ࿙☕࿚
`);
  banner.ok(`Bot ${IDENTITY.name} v${IDENTITY.version} · prefijos # - + . / (por sub-bot)`);
  banner.info(`Base de datos  ⁙ ${env.dbPath}`);
  banner.info(`Sesiones       ⁙ ${env.sessionsDir}`);
  banner.info(`Comandos       ⁙ ${registry.count()} registrados`);
  if (withWeb) {
    banner.info(`Panel web      ⁙ ${url}`);
    banner.info(`Panel web      ⁙ Abierto (sin contraseña)`);
  }
  if (env.ownerNumbers.length) banner.info(`Owner          ⁙ ${env.ownerNumbers.join(', ')}`);
  else banner.warn('OWNER_NUMBERS está vacío: nadie tendrá rango de owner. Edita tu .env');
}

async function main() {
  initDatabase();
  const manager = new BotManager();

  let stopWeb = null;
  let url = null;

  if (withWeb) {
    const { createWebServer } = await import('../web/server.js');
    const web = await createWebServer({ manager });
    stopWeb = web.stop;
    url = web.url;
  }

  printBanner({ url });

  if (withBot) {
    const results = await manager.startAll();
    if (!results.length) {
      banner.warn('No hay sub-bots con inicio automático. Abre el panel web y vincula uno con WhatsApp.');
    }
    for (const result of results) {
      if (result.ok) banner.ok(`Sub-bot "${result.client?.name ?? result.id}" iniciado → ${result.client?.status}`);
      else banner.error(`Sub-bot "${result.id}" no arrancó: ${result.error}`);
    }
  }

  const stopMaintenance = startMaintenance({ manager });
  runMaintenance({ manager, notify: false }).catch(() => null);

  // ── apagado limpio ───────────────────────────────────────────
  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    banner.info(`\n${signal} recibido · cerrando VÉRSOVA…`);
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
