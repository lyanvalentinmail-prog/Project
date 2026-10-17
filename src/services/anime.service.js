/**
 * 𓆩 🧈 𓆪  VÉRSOVA · servicio de reacciones anime (paquete Raiden)
 * ────────────────────────────────────────────────────────────────
 * 42 interacciones de rol: con mención actúan sobre alguien, sin
 * mención actúan en solitario. Todo queda en texto decorado con la
 * estética de VÉRSOVA (menciones reales de WhatsApp).
 */
import { ok } from './result.js';
import { usersRepo } from '../db/index.js';
import { maskPhone } from '../utils/ids.js';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Frases [en solitario, con alguien]. */
export const ANIME_ACTIONS = Object.freeze({
  angry: { emoji: '💢', self: ['se enoja muchísimo', 'hierve de rabia', 'aprieta los puños de enojo'], together: ['mira con furia a', 'se enoja muchísimo con', 'le gruñe de rabia a'] },
  bath: { emoji: '🛁', self: ['se da un baño relajante', 'se remoja en agua caliente'], together: ['se baña junto a', 'comparte un baño relajante con'] },
  bite: { emoji: '🦷', self: ['se muerde el labio', 'se muerde a sí mismo de nervios'], together: ['muerde con cariño a', 'le da un mordisco a', 'muerde juguetonamente a'] },
  bleh: { emoji: '😝', self: ['saca la lengua con desagrado', 'hace una mueca de asco'], together: ['le saca la lengua a', 'le hace bleh a'] },
  blush: { emoji: '😳', self: ['se sonroja intensamente', 'se pone rojo como tomate'], together: ['se sonroja por culpa de', 'se pone nervioso frente a'] },
  bored: { emoji: '🥱', self: ['se aburre en una esquina', 'bosteza de aburrimiento'], together: ['se aburre junto a', 'bosteza al lado de'] },
  coffee: { emoji: '☕', self: ['toma café en soledad', 'disfruta un café tranquilo'], together: ['toma café con', 'comparte un café con'] },
  cry: { emoji: '😭', self: ['llora desconsoladamente', 'solloza en silencio'], together: ['llora por', 'derrama lágrimas por'] },
  cuddle: { emoji: '🤗', self: ['se acurruca solito', 'se hace bolita para dormir'], together: ['se acurruca con', 'se apapacha junto a'] },
  dance: { emoji: '💃', self: ['baila sin parar', 'se echa unos pasos prohibidos'], together: ['baila con', 'saca a bailar a'] },
  drunk: { emoji: '🥴', self: ['anda tambaleándose de borracho', 'tomó de más y lo sabe'], together: ['se emborracha con', 'brinda una copa más con'] },
  eat: { emoji: '🍜', self: ['come con muchas ganas', 'devora su comida favorita'], together: ['come junto a', 'comparte su comida con'] },
  handhold: { emoji: '🤝', self: ['se toma de las manos a sí mismo', 'entrelaza sus propios dedos'], together: ['toma de la mano a', 'camina de la mano con'] },
  happy: { emoji: '😄', self: ['sonríe de felicidad', 'está radiante de alegría'], together: ['celebra feliz con', 'comparte su alegría con'] },
  highfive: { emoji: '🙏', self: ['choca los cinco consigo mismo', 'se da una palmada de ánimo'], together: ['choca los cinco con', 'le da un high-five a'] },
  hug: { emoji: '🫂', self: ['se abraza con fuerza', 'se envuelve en sus brazos'], together: ['abraza con amor a', 'da un abrazo fuerte a', 'envuelve en sus brazos a'] },
  jump: { emoji: '🦘', self: ['salta de emoción', 'da saltitos por todos lados'], together: ['salta junto a', 'salta de alegría con'] },
  kill: { emoji: '🔪', self: ['finge su propia muerte dramática', 'se sacrifica por el bien del rol'], together: ['elimina (en broma) a', 'acaba dramáticamente con'] },
  kiss: { emoji: '💋', self: ['se lanza un beso al espejo', 'se da un beso en la mano'], together: ['besa apasionadamente a', 'le planta un beso a', 'besa con ternura a'] },
  kisscheek: { emoji: '😘', self: ['se da un beso en la mejilla', 'recibe su propio beso esquimal'], together: ['besa en la mejilla a', 'le da un besito en el cachete a'] },
  laugh: { emoji: '🤣', self: ['se ríe a carcajadas', 'no puede parar de reír'], together: ['se ríe junto a', 'se parte de risa con'] },
  lick: { emoji: '👅', self: ['se lame los labios', 'se lame la herida como un gato'], together: ['lame a', 'le da un lengüetazo a'] },
  love: { emoji: '❤️', self: ['se ama a sí mismo primero', 'se declara amor eterno'], together: ['declara su amor a', 'ama profundamente a'] },
  nope: { emoji: '🙅', self: ['niega con la cabeza', 'dice que no rotundamente'], together: ['le dice que no a', 'rechaza la idea de'] },
  pat: { emoji: '🐾', self: ['se acaricia la cabeza', 'se da palmaditas de ánimo'], together: ['acaricia la cabeza de', 'le da palmaditas a'] },
  pout: { emoji: '😤', self: ['hace pucheros', 'infla los cachetes de enojo'], together: ['le hace pucheros a', 'le hace un mohín a'] },
  punch: { emoji: '👊', self: ['golpea al aire para entrenar', 'practica su gancho al vacío'], together: ['golpea con fuerza a', 'le suelta un puñetazo a'] },
  push: { emoji: '🫷', self: ['se empuja a seguir adelante', 'se da ánimos solo'], together: ['empuja juguetonamente a', 'aleja de un empujón a'] },
  run: { emoji: '🏃', self: ['corre a toda velocidad', 'huye corriendo de sus problemas'], together: ['corre junto a', 'persigue corriendo a'] },
  sad: { emoji: '😢', self: ['está triste en un rincón', 'suspira con melancolía'], together: ['se entristece por', 'llora en silencio por'] },
  scared: { emoji: '😱', self: ['tiembla de miedo', 'se esconde asustado'], together: ['se asusta por culpa de', 'tiembla frente a'] },
  seduce: { emoji: '😏', self: ['se seduce frente al espejo', 'practica su mirada seductora'], together: ['intenta seducir a', 'le guiña con coquetería a'] },
  shy: { emoji: '🫣', self: ['se esconde de vergüenza', 'no se atreve a mirar'], together: ['se pone tímido frente a', 'se esconde detrás de'] },
  slap: { emoji: '👋', self: ['se da una cachetada para despertar', 'se abofetea de arrepentimiento'], together: ['abofetea a', 'le planta una cachetada a'] },
  sleep: { emoji: '😴', self: ['se queda dormido', 'ronca tranquilamente'], together: ['duerme abrazado a', 'se queda dormido junto a'] },
  smile: { emoji: '😊', self: ['sonríe dulcemente', 'muestra su mejor sonrisa'], together: ['sonríe a', 'le dedica una sonrisa a'] },
  smoke: { emoji: '🚬', self: ['fuma en soledad', 'exhala el humo pensativo'], together: ['fuma junto a', 'comparte un cigarro con'] },
  spit: { emoji: '💦', self: ['escupe al suelo', 'escupe con desprecio'], together: ['escupe hacia', 'le escupe (de mentira) a'] },
  step: { emoji: '🦶', self: ['se pisa su propio pie', 'tropieza consigo mismo'], together: ['pisa sin querer a', 'le pisa el pie a'] },
  think: { emoji: '🤔', self: ['piensa profundamente', 'medita sobre la vida'], together: ['piensa en', 'no deja de pensar en'] },
  walk: { emoji: '🚶', self: ['camina sin rumbo', 'pasea tranquilamente'], together: ['camina junto a', 'pasea de la mano con'] },
  wave: { emoji: '👋', self: ['saluda al mundo', 'agita la mano al vacío'], together: ['saluda alegremente a', 'agita la mano hacia'] },
  wink: { emoji: '😉', self: ['guiña un ojo al espejo', 'practica su guiño perfecto'], together: ['guiña un ojo a', 'le guiña con picardía a'] },
});

function displayName(ctx, jid) {
  if (!jid) return 'Alguien';
  if (jid === ctx.author.jid) return ctx.author.name;
  const row = ctx.isGroup ? usersRepo.get(ctx.group.groupId, jid) : null;
  return row?.name ?? ctx.client?.contactName?.(jid) ?? maskPhone(jid);
}

/**
 * Ejecuta una reacción anime.
 * @param {object} ctx contexto del mensaje
 * @param {string} action clave de ANIME_ACTIONS
 * @param {string|null} rawTarget mención, número o null (solitario)
 */
export function react(ctx, action, rawTarget = null) {
  const def = ANIME_ACTIONS[action];
  if (!def) return null;

  let targetJid = null;
  const mentions = ctx.mentions ?? [];
  if (mentions.length === 1) {
    targetJid = mentions[0];
  } else if (rawTarget) {
    const digits = String(rawTarget).replace(/[^0-9]/g, '');
    if (digits.length >= 6) targetJid = `${digits}@s.whatsapp.net`;
  } else if (ctx.quoted?.participant) {
    targetJid = ctx.quoted.participant;
  }

  // Mencionarse a sí mismo cuenta como acción en solitario.
  const self = !targetJid || targetJid === ctx.author.jid;
  const phrase = self ? pick(def.self) : pick(def.together);
  const targetName = self ? null : displayName(ctx, targetJid);

  return ok('anime.react', {
    emoji: def.emoji,
    action,
    actorName: ctx.author.name,
    phrase,
    targetName,
    self,
    mentions: self ? [] : [targetJid],
    command: action,
  });
}

export default { ANIME_ACTIONS, react };
