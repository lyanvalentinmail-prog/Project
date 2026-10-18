/**
 * 𓆩 🍰 𓆪  VÉRSOVA · servicio de logos (paquete Raiden)
 * ────────────────────────────────────────────────────────────────
 * 25 efectos de texto. El bot GENERA la imagen del logo aquí mismo
 * (motor propio por software, ver logo-renderer.js) y la envía como
 * mensaje de imagen con su tarjeta. Sin APIs externas: nunca falla
 * por culpa de terceros.
 */
import { ok, fail } from './result.js';
import { sanitizeText } from '../utils/text.js';
import { renderLogoPng } from './logo-renderer.js';

export const LOGO_EFFECTS = Object.freeze({
  logoalas: { title: 'Alas de ángel galácticas', emoji: '👼' },
  logoamongus: { title: 'Among Us', emoji: '🚀' },
  logoangel: { title: 'Alas de ángel', emoji: '😇' },
  logoarmy: { title: 'Militar FPS', emoji: '🎖️' },
  logochicagamer: { title: 'Chica gamer', emoji: '🎮' },
  logochristmas: { title: 'Navidad', emoji: '🎄' },
  logocielo: { title: 'Nubes en el cielo', emoji: '☁️' },
  logocorazon: { title: 'Corazón y linterna', emoji: '❤️' },
  logodragonball: { title: 'Dragon Ball', emoji: '🐉' },
  logofuturista: { title: 'Luz futurista', emoji: '🤖' },
  logogaming: { title: 'Equipo esports', emoji: '🏆' },
  logogatito: { title: 'Vidrio empañado', emoji: '🐱' },
  logoglitch: { title: 'Glitch digital', emoji: '📺' },
  logograffiti3d: { title: 'Graffiti 3D', emoji: '🎨' },
  logohorror: { title: 'Escritura de sangre', emoji: '🩸' },
  logolol: { title: 'League of Legends', emoji: '⚔️' },
  logomatrix: { title: 'Código Matrix', emoji: '💻' },
  logonaruto: { title: 'Naruto Shippuden', emoji: '🍥' },
  logoneon: { title: 'Neón glitch', emoji: '💡' },
  logonube: { title: 'Texto en las nubes', emoji: '🌤️' },
  logopareja: { title: 'Sombra y luz solar', emoji: '🌅' },
  logopubg: { title: 'PUBG tierno', emoji: '🪖' },
  logopubgfem: { title: 'Mascota PUBG esports', emoji: '🎯' },
  logosad: { title: 'Vidrio mojado', emoji: '🌧️' },
  logosolitario: { title: 'Tipografía en pavimento', emoji: '🛣️' },
});

export async function make(ctx, effect, raw = null) {
  const def = LOGO_EFFECTS[effect];
  if (!def) return null;
  const text = sanitizeText(raw, 30);
  if (!text) {
    return fail('sys.invalid', {
      command: effect,
      message: `Escribe el texto del logo (${def.title}).`,
      hint: `Ejemplo: ${ctx.prefix ?? '.'}${effect} Versova`,
    });
  }
  // Generación real de la imagen (PNG dibujado por el motor propio).
  let png = null;
  try {
    png = renderLogoPng(effect, text);
  } catch {
    png = null;
  }
  return ok('logo.card', {
    effect,
    title: def.title,
    emoji: def.emoji,
    text,
    userName: ctx.author.name,
    command: effect,
    ...(png ? { media: { kind: 'image', buffer: png, mimetype: 'image/png' } } : {}),
    generated: Boolean(png),
  });
}

export default { LOGO_EFFECTS, make };
