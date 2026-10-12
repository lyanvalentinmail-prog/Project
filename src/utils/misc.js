/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · utilidades varias
 */
import crypto from 'node:crypto';

/** Hash estable de 32 bits (FNV-1a sobre sha1 para buena distribución). */
export function stableHash(input) {
  const digest = crypto.createHash('sha1').update(String(input)).digest();
  return digest.readUInt32BE(0);
}

/**
 * Porcentaje de compatibilidad DETERMINISTA y simétrico.
 * `.ship A B` y `.ship B A` dan el mismo resultado, y el valor no cambia
 * entre ejecuciones (evita rerolls por spam y falsas expectativas).
 */
export function compatibility(a, b) {
  const pair = [String(a), String(b)].sort().join('::');
  const value = stableHash(pair) % 101; // 0..100
  return value;
}

/** Frase divertida según el rango de compatibilidad. */
export function shipVerdict(percent) {
  if (percent >= 95) return '☕ El café ya está servido para dos. Esto es canon.';
  if (percent >= 85) return '𓆩 禍 𓆪 Destino escrito en kanji. Nadie lo puede negar.';
  if (percent >= 70) return '( ᵕ ᴗ ᵕ )♡ Buena química… solo falta que alguien se anime.';
  if (percent >= 55) return '🥢 A media asta: se quieren, pero se hacen los difíciles.';
  if (percent >= 40) return '༻ De amigos a algo más hay un abismo de por medio.';
  if (percent >= 25) return '(˘･_･˘) Ni el azúcar arregla este café.';
  return '⛓️ 禊 Compatibilidad de enemigos jurados. Puro caos.';
}

/** Espera `ms` milisegundos (para la cola de envío y el backoff). */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Backoff exponencial con tope: 1s, 2s, 4s… hasta `max`. */
export function backoff(attempt, base = 1000, max = 60_000) {
  const value = Math.min(max, base * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * Math.min(1000, value / 4));
  return value + jitter;
}

/** Agrupa una lista por una clave derivada. */
export function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

/** Pluralización simple en español. */
export const plural = (n, singular, pluralForm = `${singular}s`) => (n === 1 ? singular : pluralForm);
