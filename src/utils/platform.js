/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · plataforma
 * ────────────────────────────────────────────────────────────────
 * Detecta dónde corre el bot (Termux/Android, Render, PC/VPS) para
 * dar indicaciones útiles en el arranque y en el doctor.
 * Este módulo NO importa nada del proyecto (cero ciclos) y nunca lanza.
 */
import os from 'node:os';
import path from 'node:path';

/** ¿Corre dentro de Termux (Android)? */
export function isTermux(env = process.env, platform = process.platform) {
  return Boolean(
    env.TERMUX_VERSION ||
      env.TERMUX_APP__PACKAGE_NAME ||
      String(env.PREFIX ?? '').includes('/com.termux/') ||
      (platform === 'android' && String(env.HOME ?? '').includes('com.termux'))
  );
}

/** ¿Android (Termux u otro entorno Android)? */
export function isAndroid(env = process.env, platform = process.platform) {
  return platform === 'android' || isTermux(env, platform);
}

/** ¿Render.com? */
export const isRender = (env = process.env) => Boolean(env.RENDER || env.RENDER_EXTERNAL_URL || env.RENDER_SERVICE_ID);

/** Nombre legible de la plataforma. */
export function platformLabel(env = process.env, platform = process.platform) {
  if (isTermux(env, platform)) return 'Termux (Android)';
  if (platform === 'android') return 'Android';
  if (isRender(env)) return 'Render';
  return { linux: 'Linux', darwin: 'macOS', win32: 'Windows' }[platform] ?? platform;
}

/**
 * Carpetas del almacenamiento compartido de Android (/sdcard): ahí npm
 * no puede crear enlaces y SQLite no puede usar WAL. El proyecto debe
 * vivir en el HOME de Termux.
 */
export function isSharedStorage(dir) {
  const resolved = path.resolve(String(dir ?? ''));
  return /^\/(sdcard|storage)(\/|$)/.test(resolved) || resolved.startsWith('/mnt/sdcard') ||
    /\/storage\/(shared|emulated|downloads)(\/|$)/.test(resolved);
}

/**
 * IPv4 de la red local (para abrir el panel desde otro dispositivo).
 * En Android 11+ `os.networkInterfaces()` puede lanzar EACCES: se ignora.
 */
export function lanAddresses() {
  try {
    const found = [];
    for (const list of Object.values(os.networkInterfaces() ?? {})) {
      for (const net of list ?? []) {
        const family = typeof net.family === 'string' ? net.family : `IPv${net.family}`;
        // 169.254.x.x es autoasignada (sin red real): no sirve para abrir el panel
        if (family === 'IPv4' && !net.internal && net.address && !net.address.startsWith('169.254.')) found.push(net.address);
      }
    }
    return [...new Set(found)];
  } catch {
    return [];
  }
}

/** URLs para abrir el panel: localhost primero y luego la red local. */
export function panelUrls({ host = '0.0.0.0', port = 3000, publicUrl = null } = {}) {
  if (publicUrl) return [publicUrl];
  const urls = [];
  if (host === '0.0.0.0' || host === '::' || host === '') {
    urls.push(`http://localhost:${port}`);
    for (const address of lanAddresses()) urls.push(`http://${address}:${port}`);
  } else {
    urls.push(`http://${host.includes(':') ? `[${host}]` : host}:${port}`);
  }
  return urls;
}

/** ¿El panel puede comprobarse con una versión de Node que incluya node:sqlite? */
export function nodeHasBuiltinSqlite(version = process.versions.node) {
  const [major, minor] = String(version).split('.').map((n) => Number.parseInt(n, 10) || 0);
  return major > 22 || (major === 22 && minor >= 13);
}
