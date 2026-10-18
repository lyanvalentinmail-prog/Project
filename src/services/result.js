/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · contrato de resultados de servicio
 * ────────────────────────────────────────────────────────────────
 * Los servicios NO hablan con WhatsApp. Devuelven:
 *
 *   {
 *     ok:      boolean,
 *     view:    clave de plantilla (design/index.js),
 *     data:    datos para la plantilla (puede incluir `media`:
 *              { kind: 'image'|'sticker'|'video'|'audio', buffer|url, mimetype })
 *              que se envía como mensaje de medios con el texto como caption),
 *     extra:   mensajes adicionales  → { to, view, data, mentions, linkRequest }
 *     mediaExtra: archivos extra    → [{ kind, buffer|url, mimetype, caption, isAnimated }]
 *     actions: efectos sobre WhatsApp → { kind, ... }
 *   }
 *
 * El adaptador (core/context.js) es el único que ejecuta `extra` y
 * `actions`. Así la lógica es 100 % testeable sin conexión.
 */

/** Mensaje adicional a enviar. `to` puede ser 'group', 'author', 'admins' o un jid. */
export const msg = (to, view, data = {}, options = {}) => ({
  to,
  view,
  data,
  mentions: options.mentions ?? [],
  linkRequest: options.linkRequest ?? null,
});

/** Efecto sobre WhatsApp. */
export const action = {
  kick: (jid) => ({ kind: 'kick', jid }),
  add: (jid) => ({ kind: 'add', jid }),
  groupSetting: (setting) => ({ kind: 'groupSetting', setting }),
  audit: (entry) => ({ kind: 'audit', ...entry }),
  refreshGroup: () => ({ kind: 'refreshGroup' }),
  refreshAdmins: () => ({ kind: 'refreshAdmins' }),
};

export function ok(view, data = {}, { extra = [], actions = [], linkRequest = null, mediaExtra = [] } = {}) {
  return { ok: true, view, data, extra, actions, linkRequest, mediaExtra };
}

export function fail(view, data = {}, { extra = [], actions = [], linkRequest = null, mediaExtra = [] } = {}) {
  return { ok: false, view, data, extra, actions, linkRequest, mediaExtra };
}

/** Resultado de texto plano (sin plantilla). */
export const text = (value, extraOk = true) => ({
  ok: extraOk,
  text: value,
  view: null,
  data: {},
  extra: [],
  actions: [],
  mediaExtra: [],
});
