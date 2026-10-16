/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · vincular un sub-bot desde la terminal
 * ────────────────────────────────────────────────────────────────
 * Pensado para Termux o un VPS por SSH, donde no siempre hay un
 * navegador a mano. Crea (o elige) un sub-bot, pide a WhatsApp el
 * pairing code REAL (o dibuja el QR) y espera a que quede conectado.
 * Después se arranca el bot normal con `npm run termux` / `npm start`.
 *
 *   npm run vincular
 *   npm run vincular -- --numero 5215512345678 --nombre "Mi bot" --prefijo . [--qr]
 */
import process from 'node:process';
import readline from 'node:readline/promises';
import { env } from '../src/config/env.js';
import { banner } from '../src/core/logger.js';
import { maskPhone } from '../src/utils/ids.js';

const PREFIXES = ['#', '-', '+', '.', '/'];
const STOP_SIGNALS = process.platform === 'win32' ? ['SIGINT'] : ['SIGINT', 'SIGTERM', 'SIGHUP'];
const TIMEOUT_MS = Math.max(60_000, Number(process.env.LINK_TIMEOUT_MS) || 5 * 60_000);

/* ── argumentos ─────────────────────────────────────────────────── */
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const [key, inline] = arg.slice(2).split('=', 2);
    if (['qr', 'codigo', 'code', 'help', 'ayuda'].includes(key)) out[key] = true;
    else out[key] = inline ?? argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.ayuda) {
  process.stdout.write(`
Vincula un sub-bot de VÉRSOVA con WhatsApp desde la terminal.

  npm run vincular                        asistente interactivo
  npm run vincular -- --numero 52155…     crea/elige el sub-bot de ese número
       [--nombre "Mi bot"] [--prefijo .] [--qr]

Por defecto usa el pairing code (8 caracteres): ideal si Termux corre en el
mismo teléfono del bot. Con --qr dibuja el QR para escanearlo desde otro equipo.
`);
  process.exit(0);
}

/* ── ¿ya hay un VÉRSOVA corriendo? (dos procesos con la misma sesión se pelean) ── */
async function runningPanel() {
  try {
    const response = await fetch(`http://127.0.0.1:${env.webPort}/api/health`, { signal: AbortSignal.timeout(1500) });
    const data = await response.json().catch(() => null);
    return Boolean(response.ok && data?.ok && data?.bot);
  } catch {
    return false;
  }
}

async function main() {
  banner.title('𓆩 ☕ 𓆪  VÉRSOVA · vincular con WhatsApp');

  if (await runningPanel()) {
    banner.warn(`VÉRSOVA ya está en marcha en este equipo (panel en http://localhost:${env.webPort}).`);
    banner.info('Vincula desde el panel, o detén el bot (Ctrl+C) y vuelve a ejecutar: npm run vincular');
    process.exit(1);
  }

  const { acquireInstanceLock, lockFileFor } = await import('../src/utils/instance-lock.js');
  const lock = acquireInstanceLock(lockFileFor(env.dbPath));
  if (!lock.ok) {
    banner.warn(`VÉRSOVA ya está en marcha con estos mismos datos (PID ${lock.holder.pid}).`);
    banner.info('Detén el bot (Ctrl+C en su terminal) y vuelve a ejecutar: npm run vincular');
    process.exit(1);
  }
  process.on('exit', lock.release);

  const { initDatabase, closeDatabase, instancesRepo } = await import('../src/db/index.js');
  const { BotManager, normalizePhone } = await import('../src/core/bot-manager.js');
  const { attachTerminalLinking } = await import('../src/core/terminal-link.js');

  initDatabase();
  const interactive = Boolean(process.stdin.isTTY) && !args.numero;
  const rl = interactive ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
  const ask = async (question, fallback = '') => {
    if (!rl) return fallback;
    const answer = (await rl.question(question)).trim();
    return answer || fallback;
  };

  const manager = new BotManager();
  let instance = null;

  try {
    /* ── elegir o crear el sub-bot ─────────────────────────────── */
    const existing = instancesRepo.all();
    if (args.numero) {
      const phone = normalizePhone(args.numero);
      if (!phone.ok) throw new Error(phone.reason);
      instance = instancesRepo.byPhone(phone.value);
    } else if (existing.length === 1 && !interactive) {
      [instance] = existing;
    } else if (existing.length && interactive) {
      banner.info('Sub-bots guardados:');
      existing.forEach((row, index) => {
        process.stdout.write(`   ${index + 1}) ${row.name} · ${maskPhone(row.phone)} · ${row.pairing_mode === 'pairing' ? 'código' : 'QR'} · último estado: ${row.status}\n`);
      });
      const canCreate = existing.length < manager.maxInstances;
      if (canCreate) process.stdout.write('   n) Crear uno nuevo\n');
      const choice = (await ask(`¿Cuál vinculo? [${canCreate ? 'n' : '1'}]: `, canCreate ? 'n' : '1')).toLowerCase();
      if (choice !== 'n') {
        instance = existing[Number.parseInt(choice, 10) - 1] ?? null;
        if (!instance) throw new Error('Opción no válida.');
      }
    }

    if (!instance) {
      if (instancesRepo.count() >= manager.maxInstances) {
        throw new Error(`Ya hay ${manager.maxInstances} sub-bots (el máximo). Borra uno desde el panel para crear otro.`);
      }
      let phoneInput = args.numero ?? '';
      while (!phoneInput) {
        if (!rl) throw new Error('Falta el número: npm run vincular -- --numero 5215512345678');
        phoneInput = await ask('Número del bot con código de país (ej. 5215512345678): ');
        const check = normalizePhone(phoneInput);
        if (!check.ok) {
          banner.warn(check.reason);
          phoneInput = '';
        }
      }
      const name = args.nombre ?? (await ask(`Nombre del bot [VÉRSOVA ${instancesRepo.count() + 1}]: `, `VÉRSOVA ${instancesRepo.count() + 1}`));
      let prefix = args.prefijo ?? (await ask(`Prefijo de comandos (${PREFIXES.join(' ')}) [.]: `, '.'));
      if (!PREFIXES.includes(prefix)) {
        banner.warn(`Prefijo «${prefix}» no válido: se usa «.»`);
        prefix = '.';
      }
      let mode = args.qr ? 'qr' : 'pairing';
      if (!args.qr && !args.codigo && !args.code && rl) {
        process.stdout.write('   1) Código de 8 caracteres (recomendado si Termux está en el teléfono del bot)\n   2) QR (para escanearlo con el teléfono del bot desde otra pantalla)\n');
        mode = (await ask('¿Cómo vinculo? [1]: ', '1')) === '2' ? 'qr' : 'pairing';
      }
      const created = manager.createInstance({ name, phone: phoneInput, pairingMode: mode, prefix });
      if (!created.ok) throw new Error(created.error);
      instance = created.instance;
      banner.ok(`Sub-bot «${instance.name}» creado (prefijo ${instance.prefix}).`);
    }
    rl?.close();

    /* ── conectar y esperar ─────────────────────────────────────── */
    const wantsQr = instance.pairing_mode !== 'pairing';
    const detach = attachTerminalLinking(manager, wantsQr ? { qr: true } : {});
    banner.info(`Conectando «${instance.name}» con WhatsApp… (Ctrl+C para cancelar)`);

    const outcome = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, reason: 'timeout' }), TIMEOUT_MS);
      const finish = (result) => {
        clearTimeout(timer);
        manager.off('status', onStatus);
        for (const signal of STOP_SIGNALS) process.off(signal, onSigint);
        resolve(result);
      };
      const onStatus = (snapshot) => {
        if (snapshot.instanceId !== instance.id) return;
        if (snapshot.status === 'open') finish({ ok: true, jid: snapshot.jid });
        else if (snapshot.status === 'loggedOut') finish({ ok: false, reason: 'loggedOut' });
      };
      const onSigint = () => finish({ ok: false, reason: 'cancelado' });
      manager.on('status', onStatus);
      // Ctrl+C, kill o cerrar la sesión de Termux: se cancela limpiamente
      for (const signal of STOP_SIGNALS) process.on(signal, onSigint);
      manager.start(instance.id).then((started) => {
        if (!started.ok) finish({ ok: false, reason: started.error });
        else if (started.alreadyRunning || started.client?.status === 'open') finish({ ok: true, jid: started.client?.jid });
      });
    });

    if (outcome.ok) {
      // margen para que WhatsApp termine de guardar las credenciales
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }
    detach();
    await manager.stopAll();
    closeDatabase();

    if (outcome.ok) {
      banner.ok(`«${instance.name}» quedó vinculado${outcome.jid ? ` (+${String(outcome.jid).split('@')[0]})` : ''}.`);
      banner.info('Arranca el bot con: npm run termux   (en un PC/VPS: npm start)');
      process.exit(0);
    }
    const reasons = {
      timeout: `No se completó la vinculación en ${Math.round(TIMEOUT_MS / 60_000)} min. Vuelve a intentarlo: npm run vincular`,
      loggedOut: 'WhatsApp rechazó la sesión. Vuelve a intentarlo y escribe el código nuevo dentro de su minuto de validez.',
      cancelado: 'Vinculación cancelada.',
    };
    banner.warn(reasons[outcome.reason] ?? `No se pudo vincular: ${outcome.reason}`);
    process.exit(outcome.reason === 'cancelado' ? 130 : 1);
  } catch (error) {
    rl?.close();
    await manager.stopAll().catch(() => null);
    closeDatabase();
    banner.error(error?.message ?? String(error));
    process.exit(1);
  }
}

main().catch((error) => {
  banner.error(`El asistente falló: ${error?.stack ?? error}`);
  process.exit(1);
});
