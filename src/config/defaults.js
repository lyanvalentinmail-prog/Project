/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · valores por defecto
 * ────────────────────────────────────────────────────────────────
 * Cada grupo guarda su propia configuración en `groups.config` (JSON).
 * Aquí se define la plantilla inicial y las reglas del team.
 */
import { env } from './env.js';

/** Configuración por defecto de un grupo recién registrado. */
export function defaultGroupConfig() {
  return {
    prefix: env.botPrefix,
    inactivity_days: env.inactivityDays,
    reserve_hours: env.reserveHours,
    max_warnings: env.maxWarnings,
    welcome: env.welcomeEnabled,
    farewell: env.welcomeEnabled,
    afk_mentions: true,
    commands_in_private: env.privateCommands,
    only_registered_roles: true,
    couple_enabled: true,
    rules: DEFAULT_RULES,
  };
}

/** Claves de configuración editables desde `.config` y su validación. */
export const CONFIG_KEYS = Object.freeze({
  inactividad: { field: 'inactivity_days', type: 'int', min: 1, max: 365, label: 'días de inactividad' },
  reserva: { field: 'reserve_hours', type: 'int', min: 1, max: 720, label: 'horas de reserva' },
  warns: { field: 'max_warnings', type: 'int', min: 1, max: 20, label: 'advertencias máximas' },
  prefijo: { field: 'prefix', type: 'char', label: 'prefijo' },
  bienvenida: { field: 'welcome', type: 'bool', label: 'bienvenida automática' },
  despedida: { field: 'farewell', type: 'bool', label: 'despedida automática' },
  afk: { field: 'afk_mentions', type: 'bool', label: 'aviso de menciones AFK' },
  parejas: { field: 'couple_enabled', type: 'bool', label: 'sistema de parejas' },
});

export const DEFAULT_RULES = `☕ REGLAS DEL TEAM ◢禍◣ Versova

𖦹 01 · Respeta a todos los integrantes. Cero insultos, cero drama.
𖦹 02 · Regístrate con ୨ৎ .reg <nombre.edad> antes de pedir personaje.
𖦹 03 · Un personaje por persona. Si lo vas a dejar, usa ୨ৎ .liberar.
𖦹 04 · No reserves personajes que no vas a usar (24 h y se libera solo).
𖦹 05 · Sin spam, sin flood y sin cadenas. 3 advertencias = expulsión.
𖦹 06 · Si vas a estar ausente, avisa con ୨ৎ .afk <motivo>.
𖦹 07 · Los cambios de personaje se piden con ୨ৎ .cambiarol y los aprueba un admin.
𖦹 08 · El rol se juega: entrar y desaparecer sin avisar te marca como inactivo.
𖦹 09 · Nada de contenido +18 ni gore en el rol general.
𖦹 10 · Lo que decida el staff es definitivo. Apelaciones al owner del bot.

𓆩 禊 𓆪  Romper las reglas = warn. Romperlas dos veces = adiós.`;
