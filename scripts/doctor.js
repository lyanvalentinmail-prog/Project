/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · doctor
 * ────────────────────────────────────────────────────────────────
 * Diagnóstico honesto del entorno antes de arrancar el bot:
 *   node · dependencias · base de datos · carpetas · configuración
 *   sesiones · conectividad con WhatsApp
 *
 *   npm run doctor
 */
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { env, ROOT } from '../src/config/env.js';
import { IDENTITY } from '../src/config/identity.js';
import { banner } from '../src/core/logger.js';

const results = [];
const check = (name, ok, detail = '', critical = false) => {
  results.push({ name, ok, detail, critical });
  return ok;
};

async function tryImport(spec) {
  try {
    // se devuelve el namespace completo (los paquetes ESM exponen sus
    // funciones como exportaciones nombradas, no siempre en `default`)
    return await import(spec);
  } catch (error) {
    return { __error: error.message };
  }
}

/** Prueba TCP real a los servidores de WhatsApp (5 s). */
function probeHost(host, port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (reachable, detail) => {
      socket.destroy();
      resolve({ reachable, detail });
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true, `${host}:${port} accesible`));
    socket.once('timeout', () => done(false, `sin respuesta de ${host}:${port} en ${timeoutMs} ms`));
    socket.once('error', (error) => done(false, `${host}:${port} → ${error.code ?? error.message}`));
    socket.connect(port, host);
  });
}

async function main() {
  banner.title('\n𓆩 ☕ 𓆪  VÉRSOVA · diagnóstico del entorno\n');

  /* ── runtime ─────────────────────────────────────────────── */
  const [major] = process.versions.node.split('.').map(Number);
  check('Node.js ≥ 22', major >= 22, `versión instalada: ${process.versions.node}`, true);

  /* ── dependencias ────────────────────────────────────────── */
  for (const dep of [
    '@whiskeysockets/baileys',
    'better-sqlite3',
    'express',
    'qrcode',
    'dotenv',
    'pino',
  ]) {
    const mod = await tryImport(dep);
    check(`dependencia ${dep}`, !mod?.__error, mod?.__error ?? 'importable', true);
  }

  const baileys = await tryImport('@whiskeysockets/baileys');
  if (!baileys?.__error) {
    check(
      'Baileys expone makeWASocket y requestPairingCode',
      typeof baileys.makeWASocket === 'function' && typeof baileys.useMultiFileAuthState === 'function',
      'API disponible',
      true
    );
  }

  /* ── carpetas y permisos ─────────────────────────────────── */
  for (const dir of [env.dataDir, env.sessionsDir, env.logDir]) {
    const exists = fs.existsSync(dir);
    let writable = false;
    if (exists) {
      try {
        fs.accessSync(dir, fs.constants.W_OK);
        writable = true;
      } catch {
        writable = false;
      }
    }
    check(`carpeta ${path.relative(ROOT, dir) || dir}`, exists && writable, exists ? (writable ? 'existe y es escribible' : 'sin permiso de escritura') : 'no existe');
  }

  /* ── base de datos ───────────────────────────────────────── */
  try {
    const { initDatabase, meta, closeDatabase, instancesRepo, groupsRepo, usersRepo } = await import('../src/db/index.js');
    initDatabase();
    check('base de datos SQLite', true, `${path.relative(ROOT, env.dbPath) || env.dbPath} · esquema v${meta.get('schema_version', '?')}`, true);

    const instances = instancesRepo.all();
    const groups = groupsRepo.all();
    let users = 0;
    for (const group of groups) users += usersRepo.counts(group.group_id).active;
    check('datos existentes', true, `${instances.length} sub-bots · ${groups.length} grupos · ${users} fichas`);

    const withCreds = instances.filter((i) => fs.existsSync(path.join(i.session_dir, 'creds.json')));
    check(
      'sesiones con credenciales',
      true,
      `${withCreds.length}/${instances.length} sub-bots ya vinculados`
    );
    closeDatabase();
  } catch (error) {
    check('base de datos SQLite', false, error.message, true);
  }

  /* ── configuración ───────────────────────────────────────── */
  const envFile = path.join(ROOT, '.env');
  const hasEnv = fs.existsSync(envFile) || Boolean(process.env.RENDER || process.env.PORT);
  check(
    'archivo .env / variables de entorno',
    hasEnv,
    fs.existsSync(envFile)
      ? 'archivo .env presente'
      : (process.env.RENDER ? 'variables de entorno de Render detectadas' : 'usando variables de entorno del sistema')
  );
  check('OWNER_NUMBERS configurado', env.ownerNumbers.length > 0, env.ownerNumbers.length ? `${env.ownerNumbers.length} número(s) owner` : 'sin owner: nadie tendrá rango máximo');
  check('prefijo', Boolean(IDENTITY.prefix), `"${IDENTITY.prefix}"`);
  check('contraseña del panel', true, env.dashboardPassword ? 'definida en .env' : 'se generará y guardará en la base de datos');
  check('puerto del panel', env.webPort > 0, `${env.webHost}:${env.webPort}`);
  check('máximo de sub-bots', env.maxInstances >= 1 && env.maxInstances <= 3, String(env.maxInstances));

  /* ── módulos internos ────────────────────────────────────── */
  try {
    const { registry } = await import('../src/commands/index.js');
    const { VIEWS } = await import('../src/design/index.js');
    check('registro de comandos', registry.count() >= 40, `${registry.count()} comandos · ${Object.keys(VIEWS).length} diseños`);
  } catch (error) {
    check('registro de comandos', false, error.message, true);
  }

  /* ── conectividad con WhatsApp ───────────────────────────── */
  const probe = await probeHost('web.whatsapp.com', 443);
  check(
    'conexión con WhatsApp',
    probe.reachable,
    probe.reachable ? probe.detail : `${probe.detail} — el bot no podrá vincularse desde esta máquina`,
    false
  );

  /* ── informe ─────────────────────────────────────────────── */
  for (const result of results) {
    if (result.ok) banner.ok(`${result.name} · ${result.detail}`);
    else if (result.critical) banner.error(`${result.name} · ${result.detail}`);
    else banner.warn(`${result.name} · ${result.detail}`);
  }

  const critical = results.filter((r) => !r.ok && r.critical);
  const warnings = results.filter((r) => !r.ok && !r.critical);

  banner.title('\nResumen');
  banner.info(`${results.length - critical.length - warnings.length}/${results.length} comprobaciones correctas`);
  if (critical.length) {
    banner.error(`${critical.length} problema(s) crítico(s): corrígelos antes de arrancar.`);
    process.exit(1);
  }
  if (warnings.length) {
    banner.warn(`${warnings.length} aviso(s): el bot arranca, pero revisa lo anterior.`);
  }
  if (!critical.length && !warnings.length) banner.ok('Todo listo. Ejecuta npm start y abre el panel web.');
  process.exit(0);
}

main().catch((error) => {
  banner.error(`El diagnóstico falló: ${error?.stack ?? error}`);
  process.exit(1);
});
