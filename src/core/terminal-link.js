/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · vinculación desde la terminal
 * ────────────────────────────────────────────────────────────────
 * En Termux (o en un VPS por SSH) no siempre hay un navegador a mano.
 * Este módulo escucha al BotManager y muestra en la consola:
 *   · el pairing code REAL de WhatsApp (siempre), con los pasos;
 *   · el QR dibujado con caracteres, si la salida es una terminal
 *     (TERMINAL_QR=true lo fuerza y TERMINAL_QR=false lo apaga);
 *   · los cambios de estado importantes: conectado, sesión cerrada,
 *     reconexiones (sin repetir líneas en cada intento).
 * Cada código, QR o estado se imprime una sola vez.
 */
import QRCode from 'qrcode';

const PAIRING_STEPS = [
  'Abre WhatsApp en el teléfono del bot',
  'Ajustes → Dispositivos vinculados → Vincular un dispositivo',
  'Toca «Vincular con el número de teléfono» y escribe el código',
];
const QR_STEPS = [
  'Abre WhatsApp en el teléfono del bot',
  'Ajustes → Dispositivos vinculados → Vincular un dispositivo',
  'Escanea este QR (WhatsApp lo renueva cada ~20 s)',
];

/** Intentos de reconexión en los que se avisa (no en todos). */
const RETRY_NOTICES = new Set([1, 3, 10, 25, 50, 100]);

const color = {
  bold: (t) => `\x1b[1m${t}\x1b[0m`,
  dim: (t) => `\x1b[2m${t}\x1b[0m`,
  green: (t) => `\x1b[32m${t}\x1b[0m`,
  yellow: (t) => `\x1b[33m${t}\x1b[0m`,
  red: (t) => `\x1b[31m${t}\x1b[0m`,
  cyan: (t) => `\x1b[36m${t}\x1b[0m`,
};

/** ¿Hay que dibujar el QR en la terminal? */
export function terminalQrEnabled(env = process.env, stdout = process.stdout) {
  const flag = String(env.TERMINAL_QR ?? '').trim().toLowerCase();
  if (['0', 'false', 'no', 'off'].includes(flag)) return false;
  if (['1', 'true', 'yes', 'si', 'sí', 'on'].includes(flag)) return true;
  return Boolean(stdout?.isTTY);
}

/** `abcd1234` → `ABCD-1234` (así lo muestra WhatsApp). */
export function formatCode(code) {
  const clean = String(code ?? '').replace(/[^0-9a-z]/gi, '').toUpperCase();
  return clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

/** Bloque de texto con el pairing code y los pasos para usarlo. */
export function pairingBlock({ name, code, phoneMasked = null }) {
  const lines = [
    '',
    color.cyan(`╭─ Vincular «${name}»${phoneMasked ? ` · ${phoneMasked}` : ''}`),
    `${color.cyan('│')}  Código:  ${color.bold(color.green(formatCode(code)))}   ${color.dim('(caduca en ~60 s; se renueva solo)')}`,
    ...PAIRING_STEPS.map((step, index) => `${color.cyan('│')}  ${index + 1}. ${step}`),
    color.cyan('╰─ También lo ves en el panel web y con .key desde WhatsApp'),
    '',
  ];
  return lines.join('\n');
}

/** Dibuja el QR con medios bloques (ocupa ~55 columnas). */
export async function renderQr(text) {
  return QRCode.toString(String(text), { type: 'terminal', small: true, errorCorrectionLevel: 'L' });
}

/** Ancho visible de un texto con secuencias ANSI. */
const visibleWidth = (line) => [...String(line).replace(/\x1b\[[0-9;]*m/g, '')].length;

/**
 * Conecta la salida de la terminal a los eventos del manager.
 * @param {import('node:events').EventEmitter} manager  emite `status` ({ instanceId, ...snapshot })
 * @param {object} [options]
 * @param {boolean} [options.qr]      dibujar QR (por defecto: terminalQrEnabled())
 * @param {(text: string) => void} [options.write]
 * @param {number} [options.columns]  ancho de la terminal (para avisar si el QR no entra)
 * @returns {() => void} función para desconectarse
 */
export function attachTerminalLinking(manager, options = {}) {
  const drawQr = options.qr ?? terminalQrEnabled();
  const write = options.write ?? ((text) => process.stdout.write(text));
  const columns = () => options.columns ?? process.stdout.columns ?? 80;
  const seen = new Map();

  const onStatus = (snapshot) => {
    const id = snapshot?.instanceId ?? snapshot?.id;
    if (!id) return;
    const prev = seen.get(id) ?? { status: null, code: null, qr: null, everOpen: false, notified: new Set() };
    const next = {
      status: snapshot.status ?? prev.status,
      code: snapshot.pairingCode ?? null,
      qr: snapshot.qr ?? null,
      everOpen: prev.everOpen || snapshot.status === 'open',
      notified: prev.notified,
    };
    seen.set(id, next);
    const name = snapshot.name ?? id;
    const pairingMode = snapshot.pairingMode === true || snapshot.pairingMode === 'pairing';

    if (next.code && next.code !== prev.code) {
      write(pairingBlock({ name, code: next.code, phoneMasked: maskDigits(snapshot.phone) }));
    }

    if (drawQr && !pairingMode && next.qr && next.qr !== prev.qr) {
      const qrText = next.qr;
      renderQr(qrText)
        .then((art) => {
          // si mientras se dibujaba llegó otro QR (o se conectó), no se imprime el viejo
          if (seen.get(id)?.qr !== qrText) return;
          const width = Math.max(...art.split('\n').map(visibleWidth));
          const tooNarrow = width > columns();
          write(
            [
              '',
              color.cyan(`╭─ QR para vincular «${name}»`),
              ...QR_STEPS.map((step, index) => `${color.cyan('│')}  ${index + 1}. ${step}`),
              tooNarrow
                ? color.yellow(`│  La terminal es estrecha (${columns()} col.): aleja el zoom (pellizca) o usa el panel web.`)
                : color.cyan('╰─'),
              art,
            ].join('\n')
          );
        })
        .catch(() => null);
    }

    if (next.status !== prev.status) {
      if (next.status === 'open') {
        next.notified.clear();
        const number = String(snapshot.jid ?? '').split('@')[0].split(':')[0];
        write(`${color.green('✓')} «${name}» conectado a WhatsApp${number ? ` como +${number}` : ''}\n`);
      } else if (next.status === 'loggedOut') {
        write(`${color.yellow('⚠')} «${name}»: la sesión se cerró desde el teléfono. Vuelve a vincularlo (panel web o ${color.bold('npm run vincular')}).\n`);
      } else if (next.status === 'error') {
        write(`${color.red('✗')} «${name}»: ${snapshot.lastError ?? 'error al conectar'}\n`);
      } else if (next.status === 'closed' && /^440\b/.test(String(snapshot.lastError ?? ''))) {
        // connectionReplaced: el cliente NO reconecta (se expulsarían mutuamente sin fin)
        write(`${color.yellow('⚠')} «${name}»: la sesión se abrió en otro lugar (440). No se reconecta solo para no pelearse: deja una sola copia del bot en marcha y vuelve a conectarlo (panel web, o reinicia VÉRSOVA).\n`);
      } else if (next.status === 'closed' && prev.status === 'open') {
        write(`${color.yellow('⚠')} «${name}» se desconectó (${snapshot.lastError ?? 'sin detalle'}). Reconectando…\n`);
      }
    }

    // reconexiones fallidas: aviso en algunos intentos, nunca en todos
    const attempts = Number(snapshot.reconnectAttempts ?? 0);
    if (next.status === 'closed' && attempts && RETRY_NOTICES.has(attempts) && !next.notified.has(attempts)) {
      next.notified.add(attempts);
      const hint = next.everOpen ? '' : ' ¿Hay internet en este dispositivo?';
      write(`${color.yellow('⚠')} «${name}»: sin conexión con WhatsApp (intento ${attempts}: ${snapshot.lastError ?? 'sin detalle'}).${hint}\n`);
    }
  };

  manager.on('status', onStatus);
  return () => manager.off('status', onStatus);
}

function maskDigits(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length < 6) return null;
  return `+${digits.slice(0, 2)}${'•'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-2)}`;
}

export default attachTerminalLinking;
