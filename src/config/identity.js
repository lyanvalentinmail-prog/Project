/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · identidad del bot
 * ────────────────────────────────────────────────────────────────
 * Todo lo que define "quién es" el bot vive aquí, para que cambiar
 * de nombre/team/prefijo sea tocar un solo archivo (o el .env).
 */
import { env } from './env.js';

export const IDENTITY = Object.freeze({
  name: env.botName,
  team: env.botTeam,
  prefix: env.botPrefix,
  version: env.botVersion,
  year: 2026,
  language: 'es',
  platform: 'WhatsApp',
  ownerNumbers: env.ownerNumbers,
  /** Browser description que verá WhatsApp al vincular el dispositivo. */
  browser: Object.freeze(['Ubuntu', 'Chrome', '22.04.05']),
});

/** Alias de comando: permite varias formas de escribir lo mismo. */
export const ALIASES = Object.freeze({
  menu: ['ayuda', 'comandos', 'start', 'menucompleto'],
  reg: ['registrar', 'registrarme'],
  unreg: ['delreg', 'borrar'],
  editar: ['edit'],
  ficha: ['miperfil', 'info'],
  rol: ['role', 'pedirrol'],
  roles: ['rolesocupados', 'listarol'],
  mirol: ['myrol'],
  cambiarol: ['cambiarpersonaje'],
  reservar: ['reserve'],
  liberar: ['soltarrol'],
  team: ['equipo', 'groupinfo', 'teaminfo'],
  miembros: ['members', 'lista'],
  afk: ['ausente'],
  inactivos: ['inactivo', 'ausencias'],
  perfil: ['profile'],
  pareja: ['parejacon', 'proponer'],
  ship: ['shipeo', 'compatibilidad'],
  reglas: ['rules', 'normas'],
  admins: ['admines', 'staff'],
  expulsar: ['kick'],
  warn: ['advertir'],
  unwarn: ['quitarwarn'],
  acceptrol: ['aprobarrol', 'aprobar'],
  denyrol: ['rechazarrol', 'denegar'],
  anuncio: ['announce'],
  close: ['cerrar'],
  open: ['abrir'],
  confirmar: ['si', 'sí', 'yes', 'y'],
  cancelar: ['no', 'cancel'],
});

export default IDENTITY;
