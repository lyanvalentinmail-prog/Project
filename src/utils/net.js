/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · utilidades de red
 * ────────────────────────────────────────────────────────────────
 * Peticiones HTTP con timeout, límite de tamaño y JSON seguro.
 * Todos los servicios que tocan internet pasan por aquí: si la red
 * falla, cada comando cae a su respuesta decorada de respaldo.
 */

export const DEFAULT_HEADERS = Object.freeze({
  'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
  Accept: '*/*',
});

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

/** GET/POST con timeout. Devuelve el response o lanza. */
export async function fetchRaw(url, { timeout = 10_000, headers = {}, ...init } = {}) {
  const { signal, done } = withTimeout(timeout);
  try {
    const response = await fetch(url, {
      ...init,
      signal,
      redirect: 'follow',
      headers: { ...DEFAULT_HEADERS, ...headers },
    });
    return response;
  } finally {
    done();
  }
}

/** JSON parseado o null si la red, el estado o el parseo fallan. */
export async function fetchJson(url, options = {}) {
  try {
    const response = await fetchRaw(url, { headers: { Accept: 'application/json' }, ...options });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/** Texto plano o null. */
export async function fetchText(url, options = {}) {
  try {
    const response = await fetchRaw(url, options);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Descarga binaria con tope de bytes (stream, no carga todo dos veces).
 * Devuelve Buffer o null si falla, excede el tope o no es 2xx.
 */
export async function fetchBuffer(url, { maxBytes = 15 * 1024 * 1024, timeout = 15_000, headers = {}, ...init } = {}) {
  try {
    const response = await fetchRaw(url, { timeout, headers, ...init });
    if (!response.ok) return null;
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared && declared > maxBytes) return null;
    const reader = response.body?.getReader ? response.body.getReader() : null;
    if (!reader) {
      const buf = Buffer.from(await response.arrayBuffer());
      return buf.length <= maxBytes ? buf : null;
    }
    const chunks = [];
    let total = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) { await reader.cancel().catch(() => {}); return null; }
      chunks.push(Buffer.from(value));
    }
    return chunks.length ? Buffer.concat(chunks) : null;
  } catch {
    return null;
  }
}

export default { fetchRaw, fetchJson, fetchText, fetchBuffer, DEFAULT_HEADERS };
