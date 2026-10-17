/**
 * 𓆩 💐 𓆪  VÉRSOVA · servicio de herramientas (paquete Raiden)
 * ────────────────────────────────────────────────────────────────
 * IA con modo en línea (si hay internet) y respuestas locales de
 * respaldo, más utilidades de medios con guía paso a paso.
 */
import { ok, fail } from './result.js';
import { sanitizeText } from '../utils/text.js';
import { IDENTITY } from '../config/identity.js';

/** Respuestas locales cuando no hay conexión a la IA en línea. */
function offlineAnswer(question) {
  const text = question.toLowerCase();
  if (/(hola|buenas|qué tal|como estas|cómo estás)/.test(text)) {
    return '¡Hola! Soy VÉRSOVA, el bot del team. Pídeme el menú con .menu y te muestro todo lo que puedo hacer.';
  }
  if (/(menu|comando|ayuda|help)/.test(text)) {
    return 'Puedes ver todos mis comandos con .menu y el detalle con .help <comando>. ¿Qué quieres hacer: registrarte, pedir rol o jugar economía?';
  }
  if (/(registrar|registro|reg\b)/.test(text)) {
    return 'Para registrarte usa .reg <nombre.edad>, por ejemplo: .reg Moon.17. Después pide tu personaje con .rol <nombre>.';
  }
  if (/(rol\b|personaje)/.test(text)) {
    return 'Los personajes se piden con .rol <nombre> y los aprueba un admin. Mira los ocupados con .roles y reserva uno libre con .reservar.';
  }
  if (/(econom|yenes|moneda|coins|dinero)/.test(text)) {
    return 'La economía usa ¥enes: gana con .work y .daily, apuesta con .cf y .rt, y guarda en el banco con .deposit. Mira tu saldo con .bal.';
  }
  if (/(pareja|marry|casar|amor|ship)/.test(text)) {
    return 'Puedes proponer pareja con .pareja @usuario o casarte con .marry @usuario. ¡El amor también se rolea!';
  }
  if (/(gracias|thanks)/.test(text)) {
    return '¡De nada! Aquí estaré para lo que necesite el team.';
  }
  if (/(adios|adiós|chao|bye)/.test(text)) {
    return '¡Nos vemos! Que el rol te acompañe.';
  }
  if (/(quien eres|quién eres|tu nombre|como te llamas|cómo te llamas)/.test(text)) {
    return `Soy ${IDENTITY.name}, el bot del team ${IDENTITY.team}. Administro registros, roles, economía y diversión del grupo.`;
  }
  if (/(hora|fecha|dia|día)/.test(text)) {
    return `Ahora mismo es ${new Date().toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'short' })}.`;
  }
  return null;
}

async function onlineAnswer(question) {
  const systemPrompt = `Eres ${IDENTITY.name}, el bot del team ${IDENTITY.team}. Eres amable y breve: responde en español, en máximo 3 líneas, sin emojis.`;
  const endpoint = `https://api.delirius.online/ia/gptprompt?text=${encodeURIComponent(question)}&prompt=${encodeURIComponent(systemPrompt)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: { 'User-Agent': 'VersovaBot/1.0', Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    const text = data?.data ?? data?.result ?? data?.response ?? data?.data?.response;
    if (!text || typeof text !== 'string') return null;
    return text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim().slice(0, 1200) || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function ia(ctx, raw = null) {
  const question = sanitizeText(raw, 500);
  if (!question) {
    return fail('sys.invalid', {
      command: 'ia',
      message: 'Escríbeme una pregunta o mensaje.',
      hint: `Ejemplo: ${ctx.prefix ?? '.'}ia ¿cómo me registro?`,
    });
  }
  const local = offlineAnswer(question);
  if (local) {
    return ok('tool.ia', { question, answer: local, mode: 'local', userName: ctx.author.name, command: 'ia' });
  }
  const online = await onlineAnswer(question);
  if (online) {
    return ok('tool.ia', { question, answer: online, mode: 'online', userName: ctx.author.name, command: 'ia' });
  }
  return ok('tool.ia', {
    question,
    answer: 'Ahora mismo no tengo conexión con la IA en línea, pero sigo aquí para ayudarte con el menú (.menu), el registro (.reg) y la economía (.bal). ¿Probamos con eso?',
    mode: 'offline',
    userName: ctx.author.name,
    command: 'ia',
  });
}

export function viewOnce(ctx) {
  const quoted = ctx.quoted;
  if (!quoted?.text) {
    return fail('sys.invalid', {
      command: 'ver',
      message: 'Responde al mensaje de una sola vista que quieres reabrir.',
      hint: `Responde al mensaje efímero con ${ctx.prefix ?? '.'}ver`,
    });
  }
  return ok('tool.ver', {
    userName: ctx.author.name,
    excerpt: quoted.text.slice(0, 600),
    command: 'ver',
  });
}

export function toimg(ctx) {
  const hasQuoted = Boolean(ctx.quoted);
  if (!hasQuoted) {
    return fail('sys.invalid', {
      command: 'toimg',
      message: 'Responde al sticker que quieres convertir en imagen.',
      hint: `Responde a un sticker con ${ctx.prefix ?? '.'}toimg`,
    });
  }
  return ok('tool.convert', {
    kind: 'sticker → imagen',
    userName: ctx.author.name,
    steps: [
      'Mantén presionado el sticker en WhatsApp',
      'Elige “Añadir a favoritos” o reenvíalo',
      'WhatsApp lo guarda como imagen en tu galería',
    ],
    command: 'toimg',
  });
}

export function tomp3(ctx) {
  const hasQuoted = Boolean(ctx.quoted);
  if (!hasQuoted) {
    return fail('sys.invalid', {
      command: 'tomp3',
      message: 'Responde al video o nota de voz que quieres pasar a audio.',
      hint: `Responde a un video con ${ctx.prefix ?? '.'}tomp3`,
    });
  }
  return ok('tool.convert', {
    kind: 'video → MP3',
    userName: ctx.author.name,
    steps: [
      'Reenvía el video a un chat contigo mismo',
      'Ábrelo y usa “Guardar” para tener el archivo',
      'Pide el audio de cualquier canción con .play <título>',
    ],
    command: 'tomp3',
  });
}

export default { ia, viewOnce, toimg, tomp3 };
