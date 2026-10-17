/**
 * 𓆩 🍰 𓆪  VÉRSOVA · comandos de logos (paquete Raiden)
 * ────────────────────────────────────────────────────────────────
 * 25 efectos de texto decorativo. Nombres exactos de Raiden-WaBot.
 */
import { make, LOGO_EFFECTS } from '../services/logos.service.js';

const DESCRIPTIONS = {
  logoalas: 'Crea un logo con efecto de alas de ángel galácticas.',
  logoamongus: 'Crea un logo estilo Among Us.',
  logoangel: 'Crea un logo con efecto de alas de ángel.',
  logoarmy: 'Crea un logo de estilo militar y FPS gaming.',
  logochicagamer: 'Crea un logo de mascota gamer femenina.',
  logochristmas: 'Crea un logo con efecto navideño.',
  logocielo: 'Crea un logo con efecto de nubes en el cielo.',
  logocorazon: 'Crea un logo con efecto de corazón y linterna.',
  logodragonball: 'Crea un logo con efecto de texto estilo Dragon Ball.',
  logofuturista: 'Crea un logo con efecto de luz tecnológica futurista.',
  logogaming: 'Crea un logo de equipo de esports y gaming.',
  logogatito: 'Crea un logo con texto escrito en vidrio empañado.',
  logoglitch: 'Crea un logo con efecto de texto glitch digital.',
  logograffiti3d: 'Crea un logo con efecto de graffiti 3D.',
  logohorror: 'Crea un logo con efecto de escritura de sangre.',
  logolol: 'Crea un logo estilo League of Legends.',
  logomatrix: 'Crea un logo con efecto de código Matrix.',
  logonaruto: 'Crea un logo con estilo de texto Naruto Shippuden.',
  logoneon: 'Crea un logo con efecto de neón glitch.',
  logonube: 'Crea un logo con efecto de texto en las nubes.',
  logopareja: 'Crea un logo con efecto de sombra y luz solar.',
  logopubg: 'Crea un logo estilo PUBG con personaje tierno.',
  logopubgfem: 'Crea un logo mascota PUBG para equipos de esports.',
  logosad: 'Crea un logo con texto escrito en vidrio mojado.',
  logosolitario: 'Crea un logo con efecto tipográfico sobre pavimento.',
};

export const logosCommands = Object.keys(LOGO_EFFECTS).map((name) => ({
  name,
  aliases: [],
  category: 'logos',
  permission: 'all',
  args: '<texto>',
  groupOnly: false,
  description: DESCRIPTIONS[name] ?? `Genera un logo ${name} con tu texto.`,
  example: `.${name} mi texto`,
  run: (ctx) => make(ctx, name, ctx.args || null),
}));

export default logosCommands;
