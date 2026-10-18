/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · renderizador de vistas
 * ────────────────────────────────────────────────────────────────
 * Los servicios devuelven `{ view, data }`; este módulo traduce esa
 * vista a texto decorado. Si una vista no existe, se cae en un
 * mensaje de error genérico (nunca un crash).
 */
import * as T from './templates.js';
import * as E from './extras.js';
import { mainMenu, sectionHelp, commandHelp, availableSections, fullHelp } from './menu.js';
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
  'sys.pairing': T.pairingCodeCard,
  'sys.inactive': T.botInactive,

  // menú
  'menu.main': mainMenu,
  'menu.full': fullHelp,
  'menu.section': sectionHelp,
  'menu.command': commandHelp,
  'menu.sections': availableSections,

  // anime (paquete Raiden)
  'anime.react': E.animeReact,

  // economía (paquete Raiden)
  'eco.balance': E.ecoBalance,
  'eco.top': E.ecoTop,
  'eco.einfo': E.ecoEinfo,
  'eco.result': E.ecoResult,
  'eco.daily': E.ecoDaily,
  'eco.bet': E.ecoBet,
  'eco.transfer': E.ecoTransfer,
  'eco.steal': E.ecoSteal,
  'eco.bank': E.ecoBank,

  // descargas (paquete Raiden)
  'dl.music': E.dlMusic,
  'dl.link': E.dlLink,
  'dl.lyrics': E.dlLyrics,
  'dl.tiktok': E.dlTiktok,
  'dl.instagram': E.dlInstagram,
  'dl.spotify': E.dlSpotify,
  'dl.pinterest': E.dlPinterest,

  // perfil extendido (paquete Raiden)
  'perfil.proposal': E.perfilProposal,
  'perfil.wedding': E.perfilWedding,
  'perfil.divorce': E.perfilDivorce,
  'perfil.history': E.perfilHistory,
  'perfil.pfp': E.perfilPfp,
  'perfil.field': E.perfilField,

  // stickers (paquete Raiden)
  'sticker.guide': E.stickerGuide,
  'sticker.brat': E.stickerBrat,
  'sticker.meta': E.stickerMeta,
  'sticker.search': E.stickerSearch,

  // herramientas (paquete Raiden)
  'tool.ia': E.toolIa,
  'tool.ver': E.toolVer,
  'tool.convert': E.toolConvert,

  // logos (paquete Raiden)
  'logo.card': E.logoCard,

  // moderación extra (paquete Raiden)
  'mod.promote': E.modPromote,
  'mod.demote': E.modDemote,
  'mod.tagall': E.modTagall,
  'mod.notify': E.modNotify,
  'mod.revoke': E.modRevoke,
  'mod.mute': E.modMute,
  'mod.unmute': E.modUnmute,
  'mod.mutelist': E.modMutelist,
  'mod.toggle': E.modToggle,
  'mod.settext': E.modSettext,

  // sistema extra (paquete Raiden)
  'sys.status': E.sysStatus,
  'sys.userid': E.sysUserid,
};

/**
 * Renderiza una vista.
 * @param {string} view clave del mapa VIEWS
 * @param {any} data datos para la plantilla
 * @returns {string}
 */
export function render(view, data = {}) {
  if (view === 'custom.response') {
    return data?.text ? String(data.text) : '';
  }
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
export { mainMenu, sectionHelp, commandHelp, availableSections, fullHelp } from './menu.js';
