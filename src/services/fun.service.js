/**
 * 𓆩 🎲 𓆪  VÉRSOVA · servicio de azar y juegos rápidos
 * ────────────────────────────────────────────────────────────────
 * Dados, moneda, bola 8, decisiones, sorteos entre el team,
 * encuestas nativas de WhatsApp y texto invertido.
 * Todo es lógica pura y testeable: el azar se puede inyectar.
 */
import { ok, fail } from './result.js';
import { usersRepo } from '../db/repositories/users.repo.js';
import { mention } from '../design/theme.js';

const MAX_DICE = 10;
const MAX_FACES = 100;
const MAX_OPTIONS = 10;
const MAX_POLL_OPTIONS = 12;

const pick = (length, rng = Math.random) => Math.floor(rng() * length);

/* ── dados ─────────────────────────────────────────────────────── */

/**
 * Acepta: '' → 1d6 · '20' → 1d20 · '3d6' → 3 dados de 6 caras.
 * Devuelve { count, faces } o null si es inválido.
 */
export function parseDice(args = '') {
  const raw = String(args ?? '').trim().toLowerCase();
  if (!raw) return { count: 1, faces: 6 };
  const full = raw.match(/^(\d{1,2})\s*d\s*(\d{1,3})$/);
  if (full) {
    const count = Number(full[1]);
    const faces = Number(full[2]);
    return count >= 1 && count <= MAX_DICE && faces >= 2 && faces <= MAX_FACES ? { count, faces } : null;
  }
  if (/^\d{1,3}$/.test(raw)) {
    const faces = Number(raw);
    return faces >= 2 && faces <= MAX_FACES ? { count: 1, faces } : null;
  }
  return null;
}

export function rollDice({ count, faces }, rng = Math.random) {
  return Array.from({ length: count }, () => 1 + pick(faces, rng));
}

export function dado(ctx, rng = Math.random) {
  const spec = parseDice(ctx.args);
  if (!spec) {
    return fail('sys.invalid', {
      command: 'dado',
      message: `Formato: .dado, .dado 20 o .dado 3d6 (máx. ${MAX_DICE} dados de ${MAX_FACES} caras).`,
    });
  }
  const rolls = rollDice(spec, rng);
  const total = rolls.reduce((sum, roll) => sum + roll, 0);
  return ok('fun.dado', { ...spec, rolls, total });
}

/* ── moneda ────────────────────────────────────────────────────── */

export function moneda(ctx, rng = Math.random) {
  return ok('fun.moneda', { side: rng() < 0.5 ? 'Cara' : 'Cruz' });
}

/* ── bola 8 ────────────────────────────────────────────────────── */

export const BALL_ANSWERS = [
  'Es un hecho. ✔',
  'Sin ninguna duda.',
  'Sí, definitivamente.',
  'Todo apunta a que sí.',
  'Puedes contar con ello.',
  'La respuesta es borrosa… pregunta otra vez.',
  'Ahora no puedo predecirlo.',
  'Concéntrate y vuelve a preguntar.',
  'No cuentes con ello.',
  'Mi respuesta es no.',
  'Las perspectivas no son buenas.',
  'Muy dudoso.',
];

/** Hash simple y estable: la misma pregunta del mismo autor en el día recibe la misma respuesta. */
export function ballAnswer(question, seedText = '') {
  const key = `${seedText}|${String(question).trim().toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return BALL_ANSWERS[hash % BALL_ANSWERS.length];
}

export function bola8(ctx) {
  const question = String(ctx.args ?? '').trim();
  if (question.length < 4) {
    return fail('sys.invalid', { command: '8ball', message: 'Hazme una pregunta. Ejemplo: .8ball ¿aprobaré el examen?' });
  }
  const day = new Date().toISOString().slice(0, 10);
  return ok('fun.8ball', { question, answer: ballAnswer(question, `${ctx.author?.jid ?? ''}|${day}`) });
}

/* ── elegir ────────────────────────────────────────────────────── */

/** Separa opciones con «|». Devuelve [] si no hay al menos 2 válidas. */
export function parseOptions(args = '', max = MAX_OPTIONS) {
  const options = String(args ?? '')
    .split('|')
    .map((option) => option.trim())
    .filter(Boolean)
    .slice(0, max);
  return options.length >= 2 ? options : [];
}

export function elegir(ctx, rng = Math.random) {
  const options = parseOptions(ctx.args);
  if (!options.length) {
    return fail('sys.invalid', {
      command: 'elegir',
      message: 'Separa las opciones con |. Ejemplo: .elegir pizza | sushi | tacos',
    });
  }
  return ok('fun.elegir', { options, chosen: options[pick(options.length, rng)] });
}

/* ── sorteo ────────────────────────────────────────────────────── */

/**
 * Sortea entre los mencionados; sin menciones, entre los integrantes
 * registrados y activos del grupo.
 */
export function sorteo(ctx, rng = Math.random) {
  const groupId = ctx.group?.groupId;
  const mentions = ctx.mentions ?? [];

  let candidates;
  if (mentions.length >= 2) {
    candidates = mentions.map((jid) => ({ jid, name: mention(jid) }));
  } else {
    const active = usersRepo.list(groupId, { status: 'active' });
    candidates = active.map((user) => ({ jid: user.jid, name: user.name || mention(user.jid) }));
  }

  if (candidates.length < 2) {
    return fail('sys.invalid', {
      command: 'sorteo',
      message: 'Necesito al menos 2 participantes: menciona a 2+ personas o espera a que haya más registros.',
    });
  }

  const winner = candidates[pick(candidates.length, rng)];
  return ok('fun.sorteo', {
    winnerName: winner.name,
    pool: candidates.length,
    mentions: [winner.jid],
  });
}

/* ── encuesta (nativa de WhatsApp) ─────────────────────────────── */

/**
 * Formato: .encuesta ¿Pregunta? | opción 1 | opción 2 [| …]
 * El adaptador envía `data.poll` como encuesta nativa; la plantilla
 * queda como texto de respaldo (simulador, registros, clientes viejos).
 */
export function encuesta(ctx) {
  const parts = String(ctx.args ?? '')
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
  const [question, ...options] = parts;
  const values = options.slice(0, MAX_POLL_OPTIONS);

  if (!question || values.length < 2) {
    return fail('sys.invalid', {
      command: 'encuesta',
      message: 'Formato: .encuesta ¿Pregunta? | opción 1 | opción 2 (de 2 a 12 opciones).',
    });
  }

  return ok('fun.encuesta', {
    question,
    options: values,
    poll: { name: question.slice(0, 255), values, selectableCount: 1 },
  });
}

/* ── invertir ──────────────────────────────────────────────────── */

export function reverseText(value = '') {
  return [...String(value)].reverse().join('');
}

export function invertir(ctx) {
  const original = String(ctx.args ?? '').trim();
  if (!original) {
    return fail('sys.invalid', { command: 'invertir', message: 'Escribe un texto. Ejemplo: .invertir hola team' });
  }
  return ok('fun.invertir', { original: original.slice(0, 300), reversed: reverseText(original.slice(0, 300)) });
}
