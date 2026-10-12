/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · utilidades de tiempo
 * ────────────────────────────────────────────────────────────────
 * Formateo en español sin depender del locale/ICU de la máquina:
 * los mensajes del bot se ven igual en cualquier servidor.
 */

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export const now = () => Date.now();

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const pad = (n) => String(n).padStart(2, '0');

/** `12/10/2026` */
export function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(Number(ts));
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** `12 de octubre de 2026` */
export function formatDateLong(ts) {
  if (!ts) return '—';
  const d = new Date(Number(ts));
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/** `14:05` */
export function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(Number(ts));
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `12/10/2026 · 14:05` */
export function formatDateTime(ts) {
  if (!ts) return '—';
  return `${formatDate(ts)} · ${formatTime(ts)}`;
}

/** Duración legible: `2d 4h`, `3h 12m`, `45s` */
export function formatDuration(ms) {
  const total = Math.max(0, Math.floor(Number(ms) || 0));
  if (total < 1000) return '0s';
  const days = Math.floor(total / DAY);
  const hours = Math.floor((total % DAY) / HOUR);
  const minutes = Math.floor((total % HOUR) / MINUTE);
  const seconds = Math.floor((total % MINUTE) / 1000);
  if (days) return hours ? `${days}d ${hours}h` : `${days}d`;
  if (hours) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes) return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
  return `${seconds}s`;
}

/** Tiempo transcurrido en palabras: `hace 3 días` */
export function timeAgo(ts) {
  if (!ts) return 'nunca';
  const diff = Date.now() - Number(ts);
  if (diff < 0) return 'ahora mismo';
  if (diff < MINUTE) return 'hace unos segundos';
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE);
    return `hace ${m} minuto${m === 1 ? '' : 's'}`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `hace ${h} hora${h === 1 ? '' : 's'}`;
  }
  const d = Math.floor(diff / DAY);
  if (d < 31) return `hace ${d} día${d === 1 ? '' : 's'}`;
  const months = Math.floor(d / 30);
  if (months < 12) return `hace ${months} mes${months === 1 ? '' : 'es'}`;
  const years = Math.floor(months / 12);
  return `hace ${years} año${years === 1 ? '' : 's'}`;
}

/** Días completos de inactividad (0 si fue hoy). */
export function daysSince(ts) {
  if (!ts) return Infinity;
  return Math.floor((Date.now() - Number(ts)) / DAY);
}

/** Milisegundos → fecha límite de reserva. */
export const hoursFromNow = (hours) => Date.now() + Number(hours) * HOUR;
