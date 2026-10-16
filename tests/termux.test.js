/**
 * Soporte de Termux (Android): detección de plataforma, URLs del panel,
 * vinculación desde la terminal y scripts de instalación/arranque.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isTermux,
  isAndroid,
  platformLabel,
  isSharedStorage,
  lanAddresses,
  panelUrls,
  nodeHasBuiltinSqlite,
} from '../src/utils/platform.js';
import { attachTerminalLinking, terminalQrEnabled, formatCode, pairingBlock } from '../src/core/terminal-link.js';
import { acquireInstanceLock, lockFileFor, isLiveNodeProcess, EXIT_ALREADY_RUNNING } from '../src/utils/instance-lock.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TERMUX_PREFIX = '/data/data/com.termux/files/usr';
const hasBash = spawnSync('bash', ['--version']).status === 0;
const plainText = (text) => String(text).replace(/\x1b\[[0-9;]*m/g, '');

/* ── plataforma ───────────────────────────────────────────────── */

test('detecta Termux por TERMUX_VERSION, por PREFIX o por Android + HOME de Termux', () => {
  assert.equal(isTermux({ TERMUX_VERSION: '0.118.3' }, 'linux'), true);
  assert.equal(isTermux({ PREFIX: TERMUX_PREFIX }, 'linux'), true);
  assert.equal(isTermux({ HOME: '/data/data/com.termux/files/home' }, 'android'), true);
  assert.equal(isTermux({ HOME: '/home/user', PREFIX: '/usr/local' }, 'linux'), false);
  assert.equal(isAndroid({}, 'android'), true);
  assert.equal(isAndroid({}, 'linux'), false);
  assert.equal(platformLabel({ TERMUX_VERSION: '1' }, 'android'), 'Termux (Android)');
  assert.equal(platformLabel({ RENDER: 'true' }, 'linux'), 'Render');
  assert.equal(platformLabel({}, 'linux'), 'Linux');
  assert.equal(platformLabel({}, 'win32'), 'Windows');
});

test('reconoce el almacenamiento compartido de Android (ahí no puede vivir el proyecto)', () => {
  assert.equal(isSharedStorage('/sdcard/versova'), true);
  assert.equal(isSharedStorage('/storage/emulated/0/Download/versova'), true);
  assert.equal(isSharedStorage('/data/data/com.termux/files/home/storage/shared/versova'), true);
  assert.equal(isSharedStorage('/data/data/com.termux/files/home/versova'), false);
  assert.equal(isSharedStorage('/home/user/Project'), false);
});

test('lanAddresses nunca lanza aunque Android niegue os.networkInterfaces()', () => {
  const original = os.networkInterfaces;
  try {
    os.networkInterfaces = () => {
      const error = new Error('A system error occurred: uv_interface_addresses returned Unknown system error 13');
      error.code = 'ERR_SYSTEM_ERROR';
      throw error;
    };
    assert.deepEqual(lanAddresses(), []);
    os.networkInterfaces = () => ({
      lo: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
      wlan0: [{ family: 'IPv4', address: '192.168.1.40', internal: false }, { family: 'IPv6', address: 'fe80::1', internal: false }],
      dummy0: [{ family: 4, address: '169.254.3.3', internal: false }],
    });
    assert.deepEqual(lanAddresses(), ['192.168.1.40']);
  } finally {
    os.networkInterfaces = original;
  }
});

test('panelUrls ofrece localhost primero y respeta WEB_HOST o la URL pública', () => {
  assert.equal(panelUrls({ host: '0.0.0.0', port: 3000 })[0], 'http://localhost:3000');
  assert.deepEqual(panelUrls({ host: '127.0.0.1', port: 8080 }), ['http://127.0.0.1:8080']);
  assert.deepEqual(panelUrls({ host: '::1', port: 3000 }), ['http://[::1]:3000']);
  assert.deepEqual(panelUrls({ publicUrl: 'https://versova.onrender.com' }), ['https://versova.onrender.com']);
});

test('node:sqlite existe sin flags desde Node 22.13', () => {
  assert.equal(nodeHasBuiltinSqlite('22.12.0'), false);
  assert.equal(nodeHasBuiltinSqlite('22.13.0'), true);
  assert.equal(nodeHasBuiltinSqlite('24.11.1'), true);
  assert.equal(nodeHasBuiltinSqlite('26.4.0'), true);
});

/* ── vinculación desde la terminal ────────────────────────────── */

test('TERMINAL_QR: auto según la terminal, true lo fuerza y false lo apaga', () => {
  assert.equal(terminalQrEnabled({}, { isTTY: true }), true);
  assert.equal(terminalQrEnabled({}, { isTTY: false }), false);
  assert.equal(terminalQrEnabled({ TERMINAL_QR: 'true' }, { isTTY: false }), true);
  assert.equal(terminalQrEnabled({ TERMINAL_QR: 'false' }, { isTTY: true }), false);
  assert.equal(terminalQrEnabled({ TERMINAL_QR: 'auto' }, { isTTY: true }), true);
});

test('el pairing code se muestra como en WhatsApp, con los pasos para usarlo', () => {
  assert.equal(formatCode('abcd1234'), 'ABCD-1234');
  assert.equal(formatCode('ABCD-1234'), 'ABCD-1234');
  const block = plainText(pairingBlock({ name: 'Mi bot', code: 'ZXCV5678', phoneMasked: '+52••••78' }));
  assert.match(block, /ZXCV-5678/);
  assert.match(block, /Dispositivos vinculados/);
  assert.match(block, /número de teléfono/);
});

function captureLinking(options = {}) {
  const manager = new EventEmitter();
  const output = [];
  const detach = attachTerminalLinking(manager, { write: (text) => output.push(text), columns: 120, ...options });
  const emit = (snapshot) => manager.emit('status', { instanceId: 'bot1', name: 'Mi bot', phone: '5215512345678', ...snapshot });
  return { manager, output, detach, emit, text: () => plainText(output.join('')) };
}

test('imprime cada pairing code una sola vez y avisa al conectar', async () => {
  const { emit, text, output, detach } = captureLinking({ qr: false });
  emit({ status: 'pairing', pairingMode: true, pairingCode: 'ABCD1234', qr: 'QR-1' });
  emit({ status: 'pairing', pairingMode: true, pairingCode: 'ABCD1234', qr: 'QR-1' });
  assert.equal(text().split('ABCD-1234').length - 1, 1, 'el mismo código no se repite');
  emit({ status: 'pairing', pairingMode: true, pairingCode: 'EFGH5678', qr: 'QR-2' });
  assert.match(text(), /EFGH-5678/);
  emit({ status: 'open', jid: '5215512345678@s.whatsapp.net', pairingCode: null, qr: null });
  assert.match(text(), /«Mi bot» conectado a WhatsApp como \+5215512345678/);
  const before = output.length;
  detach();
  emit({ status: 'pairing', pairingMode: true, pairingCode: 'IJKL9012' });
  assert.equal(output.length, before, 'después de detach no imprime nada');
});

test('dibuja el QR en modo QR (y nunca en modo código)', async () => {
  const qrMode = captureLinking({ qr: true });
  qrMode.emit({ status: 'qr', pairingMode: false, qr: '2@abc,def,ghi,jkl' });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.match(qrMode.text(), /QR para vincular «Mi bot»/);
  assert.match(qrMode.text(), /[▀▄█]/, 'el QR se dibuja con medios bloques');

  const codeMode = captureLinking({ qr: true });
  codeMode.emit({ status: 'pairing', pairingMode: true, qr: '2@abc,def,ghi,jkl' });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.doesNotMatch(codeMode.text(), /[▀▄█]/);

  const disabled = captureLinking({ qr: false });
  disabled.emit({ status: 'qr', pairingMode: false, qr: '2@abc,def,ghi,jkl' });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(disabled.text(), '');
});

test('si la terminal es estrecha avisa cómo ver el QR completo', async () => {
  const narrow = captureLinking({ qr: true, columns: 20 });
  narrow.emit({ status: 'qr', pairingMode: false, qr: '2@abc,def,ghi,jkl' });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.match(narrow.text(), /terminal es estrecha/);
});

test('las reconexiones fallidas se avisan en algunos intentos, no en todos', () => {
  const { emit, text } = captureLinking({ qr: false });
  for (let attempt = 0; attempt <= 12; attempt += 1) {
    emit({ status: 'starting', reconnectAttempts: attempt });
    emit({ status: 'closed', reconnectAttempts: attempt, lastError: '408 · sin red' });
  }
  const notices = text().split('sin conexión con WhatsApp').length - 1;
  assert.equal(notices, 3, 'intentos 1, 3 y 10');
  assert.match(text(), /¿Hay internet en este dispositivo\?/);
});

test('avisa si la sesión se cerró desde el teléfono', () => {
  const { emit, text } = captureLinking({ qr: false });
  emit({ status: 'loggedOut', lastError: 'loggedOut' });
  assert.match(text(), /la sesión se cerró desde el teléfono/);
  assert.match(text(), /npm run vincular/);
});

test('si otra copia abrió la misma sesión (440) no promete reconectar', () => {
  const { emit, text } = captureLinking({ qr: false });
  emit({ status: 'open', jid: '5215512345678@s.whatsapp.net' });
  emit({ status: 'closed', reconnectAttempts: 0, lastError: '440 · La sesión se abrió en otro lugar' });
  assert.match(text(), /la sesión se abrió en otro lugar \(440\)/);
  assert.doesNotMatch(text(), /Reconectando/);
});

/* ── paquete y scripts ────────────────────────────────────────── */

test('package.json: better-sqlite3 es opcional y existen los scripts de Termux', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies['better-sqlite3'], undefined, 'no debe ser obligatoria (no compila en Android)');
  assert.ok(pkg.optionalDependencies?.['better-sqlite3']);
  assert.equal(pkg.engines.node, '>=22.13.0');
  for (const [script, file] of [['termux', 'scripts/termux-start.sh'], ['termux:setup', 'scripts/termux-setup.sh'], ['vincular', 'scripts/link.js']]) {
    assert.ok(pkg.scripts[script]?.includes(file), `script ${script}`);
    assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} existe`);
  }
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  assert.equal(lock.packages['node_modules/better-sqlite3']?.optional, true, 'el lockfile también la marca como opcional');
  assert.equal(lock.packages['']?.dependencies?.['better-sqlite3'], undefined);
});

test('los scripts de Termux tienen sintaxis bash válida', { skip: !hasBash && 'bash no disponible' }, () => {
  for (const file of ['scripts/termux-setup.sh', 'scripts/termux-start.sh']) {
    const result = spawnSync('bash', ['-n', path.join(ROOT, file)], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${file}: ${result.stderr}`);
  }
});

test('termux-setup.sh se niega a correr fuera de Termux (no toca nada)', { skip: !hasBash && 'bash no disponible' }, () => {
  const env = { ...process.env };
  delete env.TERMUX_VERSION;
  delete env.FORCE;
  env.PREFIX = '/usr';
  const result = spawnSync('bash', [path.join(ROOT, 'scripts/termux-setup.sh')], { encoding: 'utf8', env, timeout: 20_000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr + result.stdout, /Este script es para Termux/);
});

function fakeNodeDir(exitCode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'versova-fake-node-'));
  const log = path.join(dir, 'calls.log');
  fs.writeFileSync(path.join(dir, 'node'), `#!/bin/sh\necho "$@" >> "${log}"\nexit ${exitCode}\n`, { mode: 0o755 });
  return { dir, log };
}

test('termux-start.sh no reinicia tras un apagado limpio (Ctrl+C)', { skip: !hasBash && 'bash no disponible' }, () => {
  const fake = fakeNodeDir(0);
  try {
    const result = spawnSync('bash', [path.join(ROOT, 'scripts/termux-start.sh'), '--no-web'], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${fake.dir}:${process.env.PATH}`, RESTART_DELAY: '0' },
      timeout: 20_000,
    });
    assert.equal(result.status, 0);
    const calls = fs.readFileSync(fake.log, 'utf8').trim().split('\n');
    assert.deepEqual(calls, ['src/index.js --no-web'], 'arranca una vez y pasa los argumentos');
  } finally {
    fs.rmSync(fake.dir, { recursive: true, force: true });
  }
});

test('termux-start.sh reinicia si el bot se cae y se rinde tras 5 fallos seguidos', { skip: !hasBash && 'bash no disponible' }, () => {
  const fake = fakeNodeDir(1);
  try {
    const result = spawnSync('bash', [path.join(ROOT, 'scripts/termux-start.sh')], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${fake.dir}:${process.env.PATH}`, RESTART_DELAY: '0' },
      timeout: 20_000,
    });
    assert.equal(result.status, 1);
    assert.equal(fs.readFileSync(fake.log, 'utf8').trim().split('\n').length, 5);
    assert.match(result.stdout, /Reiniciando/);
    assert.match(result.stdout, /falló 5 veces seguidas/);
  } finally {
    fs.rmSync(fake.dir, { recursive: true, force: true });
  }
});

test('termux-start.sh no reinicia si ya hay otra copia de VÉRSOVA en marcha', { skip: !hasBash && 'bash no disponible' }, () => {
  const fake = fakeNodeDir(EXIT_ALREADY_RUNNING);
  try {
    const result = spawnSync('bash', [path.join(ROOT, 'scripts/termux-start.sh')], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${fake.dir}:${process.env.PATH}`, RESTART_DELAY: '0' },
      timeout: 20_000,
    });
    assert.equal(result.status, EXIT_ALREADY_RUNNING);
    assert.equal(fs.readFileSync(fake.log, 'utf8').trim().split('\n').length, 1, 'no lo vuelve a lanzar');
    assert.match(result.stdout, /Ya hay otro VÉRSOVA en marcha/);
  } finally {
    fs.rmSync(fake.dir, { recursive: true, force: true });
  }
});

/* ── una sola copia por carpeta de datos ──────────────────────── */

function sleeperProcess() {
  return spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60_000)'], { stdio: 'ignore' });
}

test('candado de instancia única: bloquea a una segunda copia y se recupera si la primera murió', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'versova-lock-'));
  const file = lockFileFor(path.join(dir, 'versova.db'));
  assert.equal(file, path.join(dir, 'versova.pid'), 'vive junto a la base de datos');
  const other = sleeperProcess();
  try {
    fs.writeFileSync(file, JSON.stringify({ pid: other.pid }));
    assert.equal(isLiveNodeProcess(other.pid), true);
    const blocked = acquireInstanceLock(file);
    assert.equal(blocked.ok, false, 'otra copia viva tiene el candado');
    assert.equal(blocked.holder.pid, other.pid);
  } finally {
    other.kill('SIGKILL');
    await once(other, 'exit');
  }
  // la otra copia murió sin borrar el archivo (SIGKILL, batería…): se recupera solo
  const mine = acquireInstanceLock(file);
  assert.equal(mine.ok, true);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).pid, process.pid);
  assert.equal(acquireInstanceLock(file).ok, true, 'el mismo proceso puede volver a pedirlo');
  mine.release();
  assert.equal(fs.existsSync(file), false, 'se borra al salir');

  // release nunca borra el candado de otro proceso
  fs.writeFileSync(file, JSON.stringify({ pid: 999_999_999 }));
  mine.release();
  assert.equal(fs.existsSync(file), true);
  // PID inexistente o archivo corrupto → candado abandonado
  assert.equal(isLiveNodeProcess(999_999_999), false);
  assert.equal(acquireInstanceLock(file).ok, true);
  fs.writeFileSync(file, 'basura{');
  const again = acquireInstanceLock(file);
  assert.equal(again.ok, true);
  again.release();
  fs.rmSync(dir, { recursive: true, force: true });
});

function runEntry(args, dir, extraEnv = {}) {
  return spawnSync(process.execPath, [path.join(ROOT, 'src/index.js'), ...args], {
    encoding: 'utf8',
    timeout: 30_000,
    env: {
      ...process.env,
      DATA_DIR: path.join(dir, 'data'),
      SESSIONS_DIR: path.join(dir, 'sessions'),
      LOG_DIR: path.join(dir, 'logs'),
      DB_PATH: '',
      LOG_FILE: '',
      WEB_PORT: '0',
      OWNER_NUMBERS: '5215512345678',
      TERMINAL_QR: 'false',
      ...extraEnv,
    },
  });
}

test('npm start se niega a abrir una segunda copia con los mismos datos', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'versova-entry-'));
  const other = sleeperProcess();
  try {
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'data', 'versova.pid'), JSON.stringify({ pid: other.pid }));
    const result = runEntry(['--no-web'], dir);
    assert.equal(result.status, EXIT_ALREADY_RUNNING, result.stderr);
    assert.match(plainText(result.stdout), new RegExp(`ya está en marcha.*PID ${other.pid}`));
    assert.equal(fs.existsSync(path.join(dir, 'data', 'versova.db')), false, 'ni siquiera abre la base de datos');
  } finally {
    other.kill('SIGKILL');
    await once(other, 'exit');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('modo solo bot sin sub-bots: explica qué hacer y sale limpio (sin colgarse ni cerrarse en silencio)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'versova-entry-'));
  try {
    const result = runEntry(['--no-web'], dir);
    assert.equal(result.status, 0, result.stderr);
    const out = plainText(result.stdout);
    assert.match(out, /no hay sub-bots vinculados/);
    assert.match(out, /npm run vincular/);
    assert.equal(fs.existsSync(path.join(dir, 'data', 'versova.pid')), false, 'libera el candado al salir');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
