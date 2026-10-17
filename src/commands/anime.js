/**
 * 𓆩 🧈 𓆪  VÉRSOVA · comandos de reacciones anime (paquete Raiden)
 * ────────────────────────────────────────────────────────────────
 * 42 interacciones de rol. Con @usuario actúan sobre alguien, sin
 * argumento actúan en solitario. Nombres y alias de Raiden-WaBot.
 */
import { react } from '../services/anime.service.js';

const DEFINITIONS = [
  ['angry', ['enojar'], 'Muestra enojo hacia alguien o a ti mismo.'],
  ['bath', [], 'Se baña solo o con alguien.'],
  ['bite', ['morder'], 'Muerde a alguien o a ti mismo.'],
  ['bleh', [], 'Hace una mueca de desagrado.'],
  ['blush', [], 'Se sonroja por alguien o por algo.'],
  ['bored', ['aburrido'], 'Está aburrido solo o con alguien.'],
  ['coffee', ['cafe'], 'Toma café solo o con alguien.'],
  ['cry', ['llorar'], 'Llora por alguien o por ti mismo.'],
  ['cuddle', [], 'Se acurruca solo o con alguien.'],
  ['dance', ['bailar'], 'Baila solo o con alguien.'],
  ['drunk', [], 'Está borracho solo o con alguien.'],
  ['eat', ['comer'], 'Come solo o con alguien.'],
  ['handhold', [], 'Toma la mano de alguien o de sí mismo.'],
  ['happy', ['feliz'], 'Está feliz solo o con alguien.'],
  ['highfive', [], 'Choca los cinco con alguien o consigo mismo.'],
  ['hug', ['abrazo'], 'Envía un abrazo a alguien o a ti mismo.'],
  ['jump', [], 'Salta solo o con alguien.'],
  ['kill', ['matar'], 'Elimina a alguien o a ti mismo (en broma).'],
  ['kiss', ['muak'], 'Envía un beso a alguien o a ti mismo.'],
  ['kisscheek', ['beso'], 'Da un beso en la mejilla a alguien o a ti mismo.'],
  ['laugh', [], 'Ríe solo o con alguien.'],
  ['lick', [], 'Lame a alguien o a sí mismo.'],
  ['love', ['amor'], 'Declara tu amor a alguien o a ti mismo.'],
  ['nope', [], 'Dice que no con un gesto.'],
  ['pat', [], 'Acaricia a alguien o a sí mismo.'],
  ['pout', [], 'Hace pucheros solo o por alguien.'],
  ['punch', ['pegar'], 'Golpea a alguien o a ti mismo.'],
  ['push', [], 'Empuja a alguien o a sí mismo.'],
  ['run', ['correr'], 'Corre solo o con alguien.'],
  ['sad', ['triste'], 'Está triste solo o por alguien.'],
  ['scared', [], 'Está asustado solo o por alguien.'],
  ['seduce', ['seducir'], 'Intenta seducir a alguien o a sí mismo.'],
  ['shy', ['timido'], 'Está tímido solo o por alguien.'],
  ['slap', [], 'Da una bofetada a alguien o a ti mismo.'],
  ['sleep', [], 'Duerme solo o con alguien.'],
  ['smile', ['sonreir'], 'Sonríe a alguien o a ti mismo.'],
  ['smoke', ['fumar'], 'Fuma solo o con alguien.'],
  ['spit', ['escupir'], 'Escupe a alguien o al suelo.'],
  ['step', ['pisar'], 'Pisa a alguien o algo accidentalmente.'],
  ['think', [], 'Piensa solo o en alguien.'],
  ['walk', [], 'Camina solo o con alguien.'],
  ['wave', ['hola'], 'Saluda a alguien o al mundo.'],
  ['wink', [], 'Guiña un ojo a alguien o a sí mismo.'],
];

export const animeCommands = DEFINITIONS.map(([name, aliases, description]) => ({
  name,
  aliases,
  category: 'anime',
  permission: 'all',
  args: '[@usuario]',
  description,
  example: `.${name} @usuario`,
  run: (ctx) => react(ctx, name, ctx.argList[0] ?? null),
}));

export default animeCommands;
