/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · reinicio de datos
 * ────────────────────────────────────────────────────────────────
 * Borra la base de datos (y opcionalmente las sesiones de WhatsApp).
 * Exige confirmación explícita: no hace nada sin `--yes`.
 *
 *   npm run db:reset -- --dry              solo muestra qué borraría
 *   npm run db:reset -- --yes              borra la base de datos
 *   npm run db:reset -- --yes --sessions   borra también las credenciales
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { env } from '../src/config/env.js';
import { banner } from '../src/core/logger.js';

const args = process.argv.slice(2);
const confirmed = args.includes('--yes');
const dryRun = args.includes('--dry') || !confirmed;
const withSessions = args.includes('--sessions');

const targets = [];

for (const file of [env.dbPath, `${env.dbPath}-wal`, `${env.dbPath}-shm`]) {
  if (fs.existsSync(file)) targets.push({ path: file, kind: 'base de datos' });
}
if (withSessions && fs.existsSync(env.sessionsDir)) {
  for (const entry of fs.readdirSync(env.sessionsDir)) {
    targets.push({ path: path.join(env.sessionsDir, entry), kind: 'sesión de WhatsApp' });
  }
}

banner.title('\n𓆩 禊 𓆪  VÉRSOVA · reinicio de datos\n');

if (!targets.length) {
  banner.info('No hay nada que borrar: la base de datos todavía no existe.');
  process.exit(0);
}

for (const target of targets) {
  const size = fs.statSync(target.path).isDirectory() ? '(carpeta)' : `${fs.statSync(target.path).size} bytes`;
  banner.warn(`${target.kind.padEnd(20)} ${path.relative(env.root, target.path)} · ${size}`);
}

if (dryRun) {
  banner.info(`\nEsto se borraría. Para ejecutarlo de verdad:`);
  banner.info(`  npm run db:reset -- --yes${withSessions ? ' --sessions' : ''}`);
  if (withSessions) banner.warn('Incluir --sessions obliga a volver a vincular cada número con QR o pairing code.');
  process.exit(0);
}

for (const target of targets) {
  fs.rmSync(target.path, { recursive: true, force: true });
}
banner.ok(`Borrados ${targets.length} elemento(s). Al arrancar, el bot creará una base de datos limpia.`);
process.exit(0);
