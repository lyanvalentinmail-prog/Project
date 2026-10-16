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
import { spawnSync } from 'node:child_process';
import { env, ROOT } from '../src/config/env.js';
import { IDENTITY } from '../src/config/identity.js';
import { banner } from '../src/core/logger.js';
import { isTermux, isSharedStorage, platformLabel, nodeHasBuiltinSqlite } from '../src/utils/platform.js';

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
  const termux = isTermux();
  const [major] = process.versions.node.split('.').map(Number);
  check('plataforma', true, `${platformLabel()} · ${process.platform}/${process.arch}`);
  check('Node.js ≥ 22', major >= 22, `versión instalada: ${process.versions.node}`, true);

  /* ── dependencias ────────────────────────────────────────── */
  for (const dep of ['@whiskeysockets/baileys', 'express', 'qrcode', 'dotenv', 'pino']) {
    const mod = await tryImport(dep);
    check(`dependencia ${dep}`, !mod?.__error, mod?.__error ?? 'importable', true);
  }

  /* ── motor SQLite: better-sqlite3 (opcional) o node:sqlite ── */
  const { driverInfo } = await import('../src/db/driver.js');
  const driver = driverInfo();
  if (driver.ok) {
    const engine = driver.name === 'node:sqlite' ? 'node:sqlite (integrado en Node)' : `${driver.name} ${driver.version ?? ''}`.trim();
    let why = '';
    if (driver.name === 'node:sqlite' && driver.fallbackReason) {
      why = /Cannot find module|MODULE_NOT_FOUND/.test(driver.fallbackReason)
        ? ' · better-sqlite3 no está instalado (normal en Termux; no hace falta)'
        : ` · ${driver.fallbackReason}`;
    }
    check('motor SQLite', true, `${engine} · SQLite ${driver.sqliteVersion ?? '?'}${why}`, true);
  } else {
    const hint = nodeHasBuiltinSqlite()
      ? 'reinstala las dependencias (npm install)'
      : `actualiza Node a 22.13 o superior (tienes ${process.versions.node}) o instala better-sqlite3`;
    check('motor SQLite', false, `${driver.error ?? 'no hay motor disponible'} — ${hint}`, true);
  }

  /* ── Termux (Android) ────────────────────────────────────── */
  if (termux) {
    check(
      'Termux · ubicación del proyecto',
      !isSharedStorage(ROOT),
      isSharedStorage(ROOT)
        ? `${ROOT} está en el almacenamiento compartido: muévelo al HOME de Termux (cd ~ && git clone …)`
        : `${ROOT} · fuera del almacenamiento compartido`,
      true
    );
    const wakeLock = spawnSync('sh', ['-c', 'command -v termux-wake-lock'], { encoding: 'utf8' }).status === 0;
    check('Termux · termux-wake-lock', wakeLock, wakeLock ? 'disponible (npm run termux lo activa)' : 'no encontrado: ejecuta pkg upgrade (viene en termux-tools)');
    check(
      'Termux · puerto del panel',
      env.webPort >= 1024,
      env.webPort >= 1024 ? `${env.webPort}` : `${env.webPort} necesita root en Android: usa PORT=3000`,
      true
    );
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
    const { currentJournalMode } = await import('../src/db/index.js');
    const journal = String(currentJournalMode() ?? '?').toUpperCase();
    check('base de datos SQLite', true, `${path.relative(ROOT, env.dbPath) || env.dbPath} · esquema v${meta.get('schema_version', '?')} · diario ${journal}`, true);

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
  check('prefijo', Boolean(IDENTITY.prefix), `por defecto "${IDENTITY.prefix}" (cada bot elige: # - + . /)`);
  check('acceso del panel', true, 'abierto (sin contraseña) · bots listos al vincular WhatsApp');
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
