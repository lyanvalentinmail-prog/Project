/**
 * 𓆩 ☕ 𓆪  Una sola copia de VÉRSOVA por carpeta de datos
 * ────────────────────────────────────────────────────────────────
 * Dos procesos con la misma base de datos y las mismas sesiones se
 * pelean por la conexión de WhatsApp (error 440 «connectionReplaced»)
 * y escriben a la vez en SQLite. Pasa con facilidad en Termux: se abre
 * otra sesión de la terminal y se vuelve a lanzar `npm run termux`.
 *
 * Se guarda el PID en `data/versova.pid`. Si el archivo existe pero ese
 * proceso ya no vive (el sistema lo mató, se apagó el teléfono…), el
 * candado se considera abandonado y se recupera solo.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/** Código de salida cuando ya hay otra copia en marcha (termux-start.sh no reinicia). */
export const EXIT_ALREADY_RUNNING = 3;

function readHolder(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8').trim();
    if (!raw) return null;
    if (/^\d+$/.test(raw)) return { pid: Number(raw) };
    const data = JSON.parse(raw);
    return Number.isInteger(data?.pid) && data.pid > 0 ? data : null;
  } catch {
    return null;
  }
}

/**
 * ¿Sigue vivo ese PID y es un proceso de Node de este mismo usuario?
 * (Un PID reutilizado por otra app no cuenta: Android los recicla.)
 */
export function isLiveNodeProcess(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
  } catch (error) {
    // ESRCH: no existe · EPERM: es de otro usuario/app, no puede ser nuestro bot
    return false;
  }
  try {
    const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
    if (!cmdline) return true;
    return /node|bun|deno/i.test(cmdline);
  } catch {
    return true; // sin /proc (macOS, Windows): basta con que el PID exista
  }
}

/**
 * Intenta tomar el candado. Devuelve `{ ok: true, release }` o
 * `{ ok: false, holder }` si otra copia viva lo tiene.
 * Si el sistema de archivos no deja crear el archivo, no bloquea el arranque.
 */
export function acquireInstanceLock(file, { pid = process.pid, label = process.argv.slice(1).join(' ') } = {}) {
  const target = path.resolve(file);
  const release = () => {
    try {
      if (readHolder(target)?.pid === pid) fs.unlinkSync(target);
    } catch {
      /* ya no existe */
    }
  };

  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
  } catch {
    /* lo resolverá quien abra la base de datos */
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const fd = fs.openSync(target, 'wx', 0o600);
      try {
        fs.writeSync(fd, JSON.stringify({ pid, startedAt: Date.now(), cmd: label }));
      } finally {
        fs.closeSync(fd);
      }
      return { ok: true, file: target, release };
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        return { ok: true, file: target, release() {}, warning: error?.message ?? String(error) };
      }
      const holder = readHolder(target);
      if (holder?.pid === pid) return { ok: true, file: target, release };
      if (holder && isLiveNodeProcess(holder.pid)) return { ok: false, file: target, holder };
      // abandonado (o ilegible): se borra y se vuelve a intentar
      try {
        fs.unlinkSync(target);
      } catch {
        /* otro proceso lo borró antes */
      }
    }
  }
  const holder = readHolder(target);
  return holder && holder.pid !== pid ? { ok: false, file: target, holder } : { ok: true, file: target, release };
}

/** Ruta del candado para una base de datos dada (junto a ella). */
export function lockFileFor(dbPath) {
  return path.join(path.dirname(path.resolve(dbPath)), 'versova.pid');
}
