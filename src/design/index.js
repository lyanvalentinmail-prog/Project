/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · renderizador de vistas
 * ────────────────────────────────────────────────────────────────
 * Los servicios devuelven `{ view, data }`; este módulo traduce esa
 * vista a texto decorado. Si una vista no existe, se cae en un
 * mensaje de error genérico (nunca un crash).
 */
import * as T from './templates.js';
import { mainMenu, sectionHelp, commandHelp, availableSections } from './menu.js';
import { error as errorTemplate } from './templates.js';

/** Mapa vista → plantilla. Cada clave es lo que devuelven los servicios. */
export const VIEWS = {
  // registro
  'reg.success': T.regSuccess,
  'reg.rejected': T.regRejected,
  'reg.duplicate': T.regDuplicate,
  'reg.edit.success': T.editSuccess,
  'reg.unreg.ask': T.unregAsk,
  'reg.unreg.success': T.unregSuccess,

  // fichas
  'user.card': T.card,
  'user.profile': T.profileCard,
  'user.notRegistered': T.notRegistered,

  // roles
  'role.request.created': T.roleRequestCreated,
  'role.request.notifyAdmins': T.adminRoleNotify,
  'role.assigned': T.roleAssigned,
  'role.occupied': T.roleOccupied,
  'role.released': T.roleReleased,
  'role.rejected': T.roleRequestRejected,
  'role.list': T.rolesList,
  'role.mine': T.myRole,
  'role.reserve.success': T.reserveSuccess,
  'role.reserve.rejected': T.reserveRejected,
  'role.reservations': T.reservationsList,
  'role.pending': T.pendingList,

  // team
  'team.info': T.teamInfo,
  'team.members': T.membersList,
  'team.afk.set': T.afkSet,
  'team.afk.clear': T.afkCleared,
  'team.afk.mention': T.afkMention,
  'team.inactives': T.inactivesList,
  'team.afk.list': T.afkList,
  'team.config.updated': T.configUpdated,
  'team.config.list': T.configList,
  'team.audit': T.auditList,

  // social
  'couple.proposal': T.coupleProposal,
  'couple.accepted': T.coupleAccepted,
  'couple.rejected': T.coupleRejected,
  'couple.broken': T.coupleBroken,
  'couple.error': T.coupleError,
  'social.ship': T.ship,
  'social.rules': T.rules,
  'social.admins': T.adminsList,

  // moderación
  'mod.warn': T.warnNotice,
  'mod.unwarn': T.unwarnNotice,
  'mod.unban': T.unbanNotice,
  'mod.warnHistory': T.warnHistory,
  'mod.blockedList': T.blockedList,
  'mod.kick': T.kickNotice,
  'mod.denied': T.modDenied,
  'mod.bannedRejoin': T.bannedRejoin,
  'mod.announcement': T.announcement,
  'mod.groupClosed': T.groupClosed,
  'mod.groupOpened': T.groupOpened,
  'mod.addResult': T.addResult,
  'mod.invite': T.inviteLinkCard,
  'sys.invalid': T.invalidInput,

  // grupo
  'group.welcome': T.welcome,
  'group.farewell': T.farewell,

  // sistema
  'sys.noPermission': T.noPermission,
  'sys.rateLimited': T.rateLimited,
  'sys.groupOnly': T.groupOnly,
  'sys.confirm.ask': T.confirmAsk,
  'sys.confirm.cancelled': T.confirmCancelled,
  'sys.confirm.nothing': T.confirmNothing,
  'sys.confirm.expired': T.confirmExpired,
  'sys.error': T.error,
  'sys.unknownCommand': T.unknownCommand,
  'sys.ping': T.ping,
  'sys.owner': T.ownerCard,
  'sys.botInfo': T.botInfo,
  'sys.key': T.activationKey,
  'sys.inactive': T.botInactive,

  // menú
  'menu.main': mainMenu,
  'menu.section': sectionHelp,
  'menu.command': commandHelp,
  'menu.sections': availableSections,
};

/**
 * Renderiza una vista.
 * @param {string} view clave del mapa VIEWS
 * @param {any} data datos para la plantilla
 * @returns {string}
 */
export function render(view, data = {}) {
  const template = VIEWS[view];
  if (typeof template !== 'function') {
    return errorTemplate({
      command: data.command ?? '?',
      message: `La vista "${view}" no tiene plantilla asignada.`,
    });
  }
  try {
    return template(data);
  } catch (templateError) {
    return errorTemplate({
      command: data.command ?? view,
      message: `No se pudo componer el mensaje (${templateError.message}).`,
    });
  }
}

/**
 * Resultado de un servicio → mensaje listo para enviar.
 * Acepta `{ view, data }`, `{ text }` o un string directo.
 */
export function renderResult(result) {
  if (!result) return null;
  if (typeof result === 'string') return result;
  if (result.text) return result.text;
  if (result.view) return render(result.view, result.data ?? {});
  return null;
}

export * from './theme.js';
export * from './templates.js';
export { mainMenu, sectionHelp, commandHelp, availableSections } from './menu.js';
