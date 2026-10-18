/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · adaptador de WhatsApp (Baileys)
 * ────────────────────────────────────────────────────────────────
 * Un BotClient = un número de WhatsApp = un sub-bot.
 * Se encarga de:
 *   · conectar con QR o pairing code
 *   · reconectarse sola con backoff (salvo logout real)
 *   · serializar los envíos (evita floods y bloqueos de WhatsApp)
 *   · traducir eventos de Baileys a contexto del bot y a eventos del panel
 *
 * Emite eventos para el panel web:
 *   'status'  { status, qr, pairingCode, error, jid, pushName }
 *   'log'     { level, message, data }
 */
import { EventEmitter } from 'node:events';
import path from 'node:path';
import fs from 'node:fs';
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidBroadcast,
  isJidStatusBroadcast,
  isJidNewsletter,
  jidNormalizedUser,
  generateWAMessageFromContent,
  proto,
} from '@whiskeysockets/baileys';

import { env } from '../config/env.js';
import { IDENTITY } from '../config/identity.js';
import { baileysLogger, scoped } from './logger.js';
import { createContext } from './context.js';
import { handleCommandMessage, parseCommand } from './router.js';
import * as events from './events.js';
import { instancesRepo, statsRepo } from '../db/index.js';
import { normalizeJid, isGroupJid } from '../utils/ids.js';
import { LidMap, isLidJid, participantJid, botIsAdminIn } from '../utils/lid.js';
import { backoff, sleep } from '../utils/misc.js';

const log = scoped('client');

/**
 * Sin red no se fija ninguna versión: Baileys usa la que trae incluida
 * (siempre más nueva que cualquier número escrito a mano aquí).
 */
const FALLBACK_VERSION = null;
const VERSION_LOOKUP_TIMEOUT_MS = 8000;
let cachedVersion = null;

/** Última versión de WhatsApp Web publicada por Baileys (o null → la incluida). */
async function resolveVersion() {
  if (cachedVersion && Date.now() - cachedVersion.at < cachedVersion.ttl) return cachedVersion.version;
  // fetchLatestBaileysVersion no tiene timeout propio: una red lenta no debe frenar el arranque
  let timer = null;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), VERSION_LOOKUP_TIMEOUT_MS);
    timer.unref?.();
  });
  const result = await Promise.race([fetchLatestBaileysVersion().catch(() => null), timeout]);
  clearTimeout(timer);
  const valid = Array.isArray(result?.version) && result.version.length === 3 && result.version.every(Number.isInteger);
  const latest = valid && result.isLatest !== false;
  if (!latest) log.debug({ error: result?.error?.message }, 'sin versión remota de WA Web: se usa la incluida en Baileys');
  cachedVersion = {
    version: valid ? result.version : FALLBACK_VERSION,
    at: Date.now(),
    // si falló, se reintenta pronto; si no, se respeta la caché configurada
    ttl: latest ? env.waVersionCacheTtlMs : 10 * 60_000,
  };
  return cachedVersion.version;
}

export class BotClient extends EventEmitter {
  /**
   * @param {object} instance fila de bot_instances
   */
  constructor(instance) {
    super();
    this.setMaxListeners(30);
    this.instance = instance;
    this.id = instance.id;
    this.name = instance.name;
    this.phone = instance.phone;
    this.pairingMode = instance.pairing_mode === 'pairing';
    this.sessionDir = instance.session_dir;

    this.sock = null;
    this.status = instance.status ?? 'created';
    this.qr = null;
    this.qrAt = null;
    this.pairingCode = null;
    this.pairingCodeAt = null;
    this.jid = null;
    this.pushName = null;
    this.lastError = null;

    this.stopping = false;
    this.reconnectAttempts = 0;
    this.pairingRequested = false;
    this._pairingReady = false;
    this.connectedAt = null;
    this.startedAt = Date.now();

    /** Firma del último estado emitido: evita eventos duplicados (y renders basura en el panel). */
    this._lastSignature = null;
    /** Petición de pairing code en curso (evita pedir varios a la vez a WhatsApp). */
    this._pairingRequest = null;

    this._sendQueue = Promise.resolve();
    this._metadataCache = new Map();
    /** Equivalencias LID ↔ número que WhatsApp va revelando. */
    this.lids = new LidMap();
    /** LID propio del bot (en grupos con LID aparece así en la lista de participantes). */
    this.lid = null;
    /** Cada start() recibe un número: un stop() o un start() posterior invalida los anteriores. */
    this._startAttempt = 0;
    // También deduplica notify/append y los ecos de nuestros propios envíos.
    this._seenMessages = new Map();
    this._logger = baileysLogger(`wa:${this.id}`);
  }

  /* ── estado público (para el panel web) ─────────────────────── */

  snapshot() {
    return {
      id: this.id,
      name: this.name,
      phone: this.phone,
      pairingMode: this.pairingMode,
      status: this.status,
      qr: this.qr,
      pairingCode: this.pairingCode,
      pairingCodeAt: this.pairingCodeAt,
      pairingAgeMs: this.pairingCodeAt ? Date.now() - this.pairingCodeAt : null,
      jid: this.jid,
      pushName: this.pushName,
      lastError: this.lastError,
      connectedAt: this.connectedAt,
      uptimeMs: this.status === 'open' && this.connectedAt ? Date.now() - this.connectedAt : 0,
      reconnectAttempts: this.reconnectAttempts,
      groups: this._metadataCache.size,
    };
  }

  /**
   * Cambia el estado y lo emite SOLO si algo cambió de verdad.
   * Antes se emitía en cada `connection.update` de Baileys: el panel se
   * redibujaba sin parar (parecía que la página "se recargaba sola").
   */
  _setStatus(status, extra = {}) {
    this.status = status;
    if (['starting', 'connecting', 'closed', 'loggedOut', 'open', 'error'].includes(status)) {
      extra = { ...extra, qr: null, pairingCode: null };
    }
    if (extra.qr !== undefined) {
      this.qr = extra.qr;
      this.qrAt = extra.qr ? Date.now() : null;
    }
    if (extra.pairingCode !== undefined) {
      this.pairingCode = extra.pairingCode;
      this.pairingCodeAt = extra.pairingCode ? Date.now() : null;
    }
    if (extra.error !== undefined) this.lastError = extra.error;
    if (extra.jid) this.jid = extra.jid;
    if (extra.pushName) this.pushName = extra.pushName;

    const signature = [status, this.qr ?? '', this.pairingCode ?? '', this.lastError ?? '', this.jid ?? ''].join('|');
    if (signature === this._lastSignature) return; // nada nuevo: ni BD ni eventos
    this._lastSignature = signature;

    instancesRepo.setStatus(this.id, status, {
      waJid: extra.jid ?? null,
      pushName: extra.pushName ?? null,
      lastError: extra.error ?? null,
    });
    this.emit('status', this.snapshot());
    this.emit('log', { level: 'info', message: `estado → ${status}`, data: { id: this.id } });
  }

  /** Fuerza la emisión del estado actual (lo usa el panel al abrir una ventana). */
  emitStatus() {
    this.emit('status', this.snapshot());
    return this.snapshot();
  }

  /* ── ciclo de vida ──────────────────────────────────────────── */

  async start() {
    if (this.sock) return this.snapshot();
    const attempt = ++this._startAttempt;
    this.stopping = false;
    this.pairingRequested = false;
    this._pairingReady = false;
    this._pairingRequest = null;
    this._setStatus('starting');

    fs.mkdirSync(this.sessionDir, { recursive: true, mode: 0o700 });

    const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);
    const version = await resolveVersion();

    // Mientras se leían las credenciales pudo llegar un stop() (o un start()
    // más nuevo): no se abre un socket «zombi» que nadie va a cerrar.
    if (attempt !== this._startAttempt || this.stopping || this.sock) return this.snapshot();

    this.saveCreds = saveCreds;
    this.authState = state;
    const myLid = state.creds?.me?.lid ? normalizeJid(state.creds.me.lid) : null;
    if (myLid) {
      this.lid = myLid;
      this.lids.learn(myLid, state.creds?.me?.id);
    }

    const sock = makeWASocket({
      // sin versión remota se omite la clave: `version: undefined` anularía la de Baileys
      ...(version ? { version } : {}),
      auth: state,
      logger: this._logger,
      browser: IDENTITY.browser,
      connectTimeoutMs: env.connectTimeoutMs,
      qrTimeout: env.qrTimeoutMs,
      markOnlineOnConnect: true,
      syncFullHistory: false,
      emitOwnEvents: false,
      shouldSyncHistoryMessage: () => false,
      shouldIgnoreJid: (jid) => isJidBroadcast(jid) || isJidStatusBroadcast(jid) || isJidNewsletter(jid),
      cachedGroupMetadata: async (jid) => this.cachedGroupMetadata(jid),
      getMessage: async () => undefined,
      options: {},
    });

    this.sock = sock;
    this._bindEvents(sock);
    return this.snapshot();
  }

  async stop({ reason = 'manual' } = {}) {
    this.stopping = true;
    this._startAttempt += 1;
    const sock = this.sock;
    this.sock = null;
    this._pairingReady = false;
    this._pairingRequest = null;
    this._metadataCache.clear();
    if (!sock) {
      this._setStatus('closed', { error: reason });
      return;
    }
    try {
      await sock.end?.(reason === 'logout' ? undefined : new Error(reason));
    } catch {
      try {
        sock.ws?.close();
      } catch {
        /* ya cerrado */
      }
    }
    this._setStatus('closed', { error: reason });
  }

  /** Cierra sesión en WhatsApp y borra las credenciales locales. */
  async logout() {
    const sock = this.sock;
    try {
      await sock?.logout?.();
    } catch (error) {
      log.warn({ err: error, id: this.id }, 'logout remoto falló (se borran las credenciales locales igual)');
    }
    await this.stop({ reason: 'logout' });
    fs.rmSync(this.sessionDir, { recursive: true, force: true });
    fs.mkdirSync(this.sessionDir, { recursive: true, mode: 0o700 });
    this._setStatus('loggedOut', { error: 'sesión cerrada desde el panel' });
  }

  /* ── eventos de Baileys ─────────────────────────────────────── */

  _bindEvents(sock) {
    sock.ev.on('creds.update', (update) => {
      if (this.sock !== sock) return;
      if (update?.me?.lid) {
        this.lid = normalizeJid(update.me.lid);
        this.lids.learn(this.lid, update.me.id ?? this.jid);
      }
      this.saveCreds?.().catch((error) => log.error({ err: error }, 'no se pudieron guardar las credenciales'));
    });

    // WhatsApp revela equivalencias LID ↔ número a medida que las conoce
    sock.ev.on('lid-mapping.update', (mapping) => {
      for (const pair of [].concat(mapping ?? [])) this.lids.learn(pair?.lid, pair?.pn);
    });

    sock.ev.on('connection.update', async (update) => {
      // Eventos tardíos de un socket anterior no pertenecen a esta sesión.
      if (this.sock !== sock || this.stopping) return;
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        // El QR confirma que terminó el handshake. Antes de esto no se puede
        // pedir el código, aunque el WebSocket ya exista.
        this._pairingReady = true;
        this._setStatus(this.pairingMode ? 'pairing' : 'qr', { qr });
        if (this.pairingMode && !this.pairingRequested) {
          await this.refreshPairingCode();
          if (this.sock !== sock || this.stopping) return;
        }
      }

      if (connection === 'open') {
        this.reconnectAttempts = 0;
        this.connectedAt = Date.now();
        const userJid = sock.user?.id ? normalizeJid(jidNormalizedUser(sock.user.id)) : null;
        const ownLid = sock.user?.lid ?? this.authState?.creds?.me?.lid ?? null;
        if (ownLid) {
          this.lid = normalizeJid(ownLid);
          this.lids.learn(this.lid, userJid);
        }
        this._setStatus('open', {
          qr: null,
          jid: userJid,
          pushName: sock.user?.name ?? sock.user?.verifiedName ?? IDENTITY.name,
          error: null,
        });
        this.emit('log', { level: 'info', message: 'conectado a WhatsApp' });
        events.resyncAllGroups({ client: this, instance: this.instance }).catch((error) => {
          log.warn({ err: error }, 'resync tras conexión falló');
        });
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const message = lastDisconnect?.error?.message ?? 'conexión cerrada';
        this.connectedAt = null;
        this.sock = null;
        this._pairingReady = false;
        this._pairingRequest = null;

        if (statusCode === DisconnectReason.loggedOut) {
          this._setStatus('loggedOut', { qr: null, pairingCode: null, error: 'Sesión cerrada desde el teléfono (loggedOut).' });
          this.emit('log', { level: 'warn', message: 'sesión cerrada: hay que volver a vincular' });
          return;
        }

        if (statusCode === DisconnectReason.connectionReplaced) {
          // 440: otra copia del bot (otro PC, Termux, Render…) abrió esta misma
          // sesión. Reconectar solo haría que se expulsen mutuamente sin fin.
          this._setStatus('closed', {
            qr: null,
            error: '440 · La sesión se abrió en otro lugar (otra copia del bot usa estas credenciales). Detén la otra copia y vuelve a conectar este sub-bot.',
          });
          this.emit('log', { level: 'warn', message: 'sesión reemplazada por otra conexión: no se reconecta automáticamente' });
          return;
        }

        this._setStatus(statusCode === DisconnectReason.restartRequired ? 'connecting' : 'closed', {
          qr: null,
          error: `${statusCode ?? '?'} · ${message}`,
        });

        if (this.stopping) return;
        this.reconnectAttempts += 1;
        // `restartRequired` (515) es normal al vincular un dispositivo nuevo,
        // pero antes reconectaba cada 1 s: eso hacía que el panel se
        // redibujara sin parar. Ahora usa el mismo backoff progresivo.
        const base = statusCode === DisconnectReason.restartRequired ? backoff(this.reconnectAttempts, 2500, 15_000) : backoff(this.reconnectAttempts, 2000, 60_000);
        const wait = Math.round(base * (0.85 + Math.random() * 0.3));
        this.emit('log', { level: 'info', message: `reconectando en ${Math.round(wait / 1000)}s (intento ${this.reconnectAttempts})` });
        await sleep(wait);
        if (!this.stopping && !this.sock) {
          this.start().catch((error) => {
            log.error({ err: error, id: this.id }, 'fallo al reconectar');
            this._setStatus('error', { error: String(error?.message ?? error) });
          });
        }
      }

      if (connection === 'connecting') {
        this._setStatus('connecting');
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      for (const raw of messages ?? []) {
        try {
          await this._handleMessage(raw, type);
        } catch (error) {
          log.error({ err: error, id: this.id }, 'error procesando mensaje');
        }
      }
    });

    sock.ev.on('group-participants.update', async (event) => {
      this._metadataCache.delete(normalizeJid(event.id));
      this.learnParticipants(event.participants);
      this.lids.learn(event.author, event.authorPn);
      try {
        await events.onParticipantsUpdate({ client: this, instance: this.instance, event });
      } catch (error) {
        log.error({ err: error, id: this.id }, 'error en evento de participantes');
      }
    });

    sock.ev.on('groups.update', async (updates) => {
      for (const update of updates ?? []) this._metadataCache.delete(normalizeJid(update.id));
      try {
        await events.onGroupUpdate({ client: this, instance: this.instance, updates });
      } catch (error) {
        log.error({ err: error, id: this.id }, 'error en groups.update');
      }
    });

    sock.ev.on('groups.upsert', (groups) => {
      for (const group of groups ?? []) this.learnParticipants(group?.participants);
    });

    const onContacts = (contacts) => {
      for (const contact of contacts ?? []) {
        if (!contact?.id) continue;
        this.lids.learnEntry(contact);
        const name = contact.notify ?? contact.name ?? contact.verifiedName ?? null;
        if (name) this._contacts.set(this.toPn(contact.id), String(name));
      }
    };
    sock.ev.on('contacts.upsert', onContacts);
    sock.ev.on('contacts.update', onContacts);
  }

  /** Contactos conocidos (para nombres en la bienvenida). */
  _contacts = new Map();

  contactName(jid) {
    return this._contacts.get(this.toPn(jid)) ?? this._contacts.get(normalizeJid(jid)) ?? null;
  }

  /* ── identidades: LID ↔ número ──────────────────────────────── */

  /** Número equivalente a un LID si se conoce (cualquier otro jid se normaliza). */
  toPn(jid) {
    const pn = this.lids.toPn(jid);
    // el LID propio siempre equivale al número del bot
    if (pn && this.lid && pn === this.lid && this.jid) return normalizeJid(this.jid);
    return pn;
  }

  /** Como toPn, consultando además el almacén de Baileys (en disco, sin red). */
  async resolveUser(jid) {
    const known = this.lids.toPn(jid);
    if (!known || !isLidJid(known)) return known;
    try {
      const pn = await this.sock?.signalRepository?.lidMapping?.getPNForLID?.(known);
      if (pn && this.lids.learn(known, pn)) return this.lids.toPn(known);
    } catch {
      /* sin equivalencia conocida: se usa el LID */
    }
    return known;
  }

  /** ¿Ese jid (número o LID) es el propio bot? */
  isMe(jid) {
    const normalized = normalizeJid(jid);
    if (!normalized) return false;
    const me = normalizeJid(this.jid);
    if (me && (normalized === me || this.lids.toPn(normalized) === me)) return true;
    return Boolean(this.lid) && normalized === this.lid;
  }

  /** Aprende equivalencias de una lista de participantes (texto u objetos). */
  learnParticipants(list) {
    for (const entry of list ?? []) this.lids.learnEntry(entry);
  }

  async _handleMessage(raw, type) {
    if (!raw?.message) return;
    const chat = raw.key?.remoteJid;
    if (!chat || isJidBroadcast(chat) || isJidStatusBroadcast(chat) || isJidNewsletter(chat)) return;
    if (type !== 'notify' && type !== 'append') return;

    // Baileys también usa append para mensajes recibidos estando offline.
    // Aceptar solo los recientes evita ejecutar comandos viejos al reconectar.
    if (type === 'append') {
      const timestamp = Number(raw.messageTimestamp) * 1000;
      const age = Date.now() - timestamp;
      if (!Number.isFinite(timestamp) || age < -30_000 || age > 120_000) return;
    }
    if (!this._rememberMessage(raw.key)) return;
    this.lids.learnKey(raw.key);

    statsRepo.bump('messages');

    const ctx = await createContext({ raw, instance: this.instance, client: this });

    // (el filtro de grupo cerrado vive en el router: único punto de control)
    // El teléfono vinculado también puede dar comandos. Sus mensajes normales
    // (incluidas las respuestas del bot) no deben disparar eventos ni bucles.
    if (ctx.fromMe && !parseCommand(ctx.text, ctx)) return;
    const wasCommand = await handleCommandMessage(ctx);
    if (!wasCommand && !ctx.fromMe) await events.onMessage(ctx);
  }

  /** Reserva el id ANTES del primer await: dos upserts concurrentes no se repiten. */
  _rememberMessage(key) {
    if (!key?.id) return true;
    const now = Date.now();
    for (const [id, at] of this._seenMessages) {
      if (now - at < 10 * 60_000) break;
      this._seenMessages.delete(id);
    }
    const id = JSON.stringify([key.remoteJid, Boolean(key.fromMe), key.id]);
    if (this._seenMessages.has(id)) return false;
    this._seenMessages.set(id, now);
    if (this._seenMessages.size > 2000) {
      this._seenMessages.delete(this._seenMessages.keys().next().value);
    }
    return true;
  }

  /* ── API usada por el resto del bot ─────────────────────────── */

  /** Envío serializado con reintento y pausa anti-flood. */
  async sendMessage(jid, content, options = {}) {
    const task = this._sendQueue.then(() => this._rawSend(jid, content, options));
    this._sendQueue = task.catch(() => null);
    return task;
  }

  async _rawSend(jid, content, options, attempt = 1) {
    if (!this.sock || this.status !== 'open') {
      const error = new Error('El bot no está conectado.');
      error.code = 'NOT_CONNECTED';
      throw error;
    }
    try {
      const sent = options?.quoted
        ? await this.sock.sendMessage(normalizeJid(jid), content, { quoted: options.quoted })
        : await this.sock.sendMessage(normalizeJid(jid), content);
      if (sent?.key) this._rememberMessage({ ...sent.key, fromMe: true });
      await sleep(350); // separación entre envíos: evita rate limits de WhatsApp
      return sent ?? null;
    } catch (error) {
      const status = error?.output?.statusCode ?? error?.output?.payload?.statusCode;
      const retryable = !status || status >= 500 || status === 408;
      if (retryable && attempt < 2) {
        await sleep(1200 * attempt);
        return this._rawSend(jid, content, options, attempt + 1);
      }
      log.warn({ err: error, jid, attempt }, 'no se pudo enviar el mensaje');
      throw error;
    }
  }

  /**
   * Menú de lista interactivo (native flow `single_select`):
   * info del bot arriba y debajo un botón que despliega las categorías.
   *
   * @param {string} jid chat destino
   * @param {object} list { title, body, footer, buttonText, sections:[{ title, rows:[{ id, title, description }] }] }
   * @param {object} options { quoted }
   * @returns {Promise<object|null>} mensaje generado (o null si falló)
   */
  async sendList(jid, list, options = {}) {
    const target = normalizeJid(jid);
    const sections = (list.sections ?? []).slice(0, 10).map((section) => ({
      title: String(section.title ?? '').slice(0, 60),
      highlight_label: '',
      rows: (section.rows ?? []).slice(0, 20).map((row, index) => ({
        header: '',
        title: String(row.title ?? `Opción ${index + 1}`).slice(0, 24),
        description: String(row.description ?? '').slice(0, 72),
        id: String(row.id ?? `${index + 1}`).slice(0, 256),
      })),
    })).filter((section) => section.rows.length);
    if (!sections.length) return null;

    const task = this._sendQueue.then(async () => {
      const interactive = proto.Message.InteractiveMessage.create({
        body: proto.Message.InteractiveMessage.Body.create({ text: String(list.body ?? '') }),
        footer: proto.Message.InteractiveMessage.Footer.create({ text: String(list.footer ?? '') }),
        header: proto.Message.InteractiveMessage.Header.create({
          title: String(list.title ?? '').slice(0, 60),
          subtitle: '',
          hasMediaAttachment: false,
        }),
        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
          buttons: [{
            name: 'single_select',
            buttonParamsJson: JSON.stringify({
              title: String(list.buttonText ?? 'Ver opciones').slice(0, 40),
              sections,
            }),
          }],
          messageParamsJson: JSON.stringify({ limited_time_offer: {}, bottom_sheet: { in_thread_buttons_limit: 1 } }),
        }),
        contextInfo: { forwardingScore: 1, isForwarded: true },
      });
      const message = generateWAMessageFromContent(target, {
        viewOnceMessage: { message: { interactiveMessage: interactive } },
      }, { quoted: options.quoted, userJid: this.jid });
      await this.sock.relayMessage(target, message.message, { messageId: message.key.id });
      this._rememberMessage({ ...message.key, fromMe: true });
      await sleep(350);
      return message;
    }).catch((error) => {
      log.warn({ err: error, jid: target }, 'no se pudo enviar el menú de lista');
      return null;
    });
    this._sendQueue = task.catch(() => null);
    return task;
  }

  /** Baileys espera GroupMetadata, NO el contenedor interno { at, data }. */
  cachedGroupMetadata(jid) {
    const cached = this._metadataCache.get(normalizeJid(jid));
    return cached && Date.now() - cached.at < 60_000 ? cached.data : undefined;
  }

  async groupMetadata(jid) {
    const key = normalizeJid(jid);
    const cached = this.cachedGroupMetadata(key);
    if (cached) return cached;
    const data = await this.sock.groupMetadata(key);
    this.learnParticipants(data?.participants);
    this._metadataCache.set(key, { at: Date.now(), data });
    return data;
  }

  /**
   * Añadir se hace por número. Para expulsar/promover/degradar, en los grupos
   * con LID WhatsApp espera el id con el que la persona figura en el grupo.
   */
  async groupParticipantsUpdate(jid, participants, action) {
    const groupJid = normalizeJid(jid);
    let targets = (participants ?? [])
      .map((entry) => normalizeJid(typeof entry === 'string' ? entry : entry?.id ?? entry?.jid))
      .filter(Boolean);
    if (action === 'add') {
      targets = targets.map((target) => this.toPn(target));
    } else {
      const metadata = await this.groupMetadata(groupJid).catch(() => null);
      const members = metadata?.participants ?? [];
      targets = targets.map((target) => {
        const canonical = this.toPn(target);
        const match = members.find((member) => {
          const id = normalizeJid(member?.id ?? member?.jid);
          return id === target || participantJid(member, this) === canonical;
        });
        return match ? normalizeJid(match.id ?? match.jid) : target;
      });
    }
    this._metadataCache.delete(groupJid);
    return this.sock.groupParticipantsUpdate(groupJid, targets, action);
  }

  async groupSettingUpdate(jid, setting) {
    this._metadataCache.delete(normalizeJid(jid));
    return this.sock.groupSettingUpdate(normalizeJid(jid), setting);
  }

  async groupInviteCode(jid) {
    return this.sock.groupInviteCode(normalizeJid(jid));
  }

  /** Revoca el enlace de invitación y devuelve el código nuevo. */
  async groupRevokeInvite(jid) {
    this._metadataCache.delete(normalizeJid(jid));
    return this.sock.groupRevokeInvite(normalizeJid(jid));
  }

  /** Foto de perfil de un contacto (null si es privada o no existe). */
  async profilePictureUrl(jid) {
    try {
      return await this.sock.profilePictureUrl(normalizeJid(jid), 'image');
    } catch {
      return null;
    }
  }

  /** Borra un mensaje del chat (requiere ser admin en grupos). */
  async deleteMessage(jid, key) {
    if (!key?.id) return null;
    return this.sendMessage(normalizeJid(jid), {
      delete: {
        id: key.id,
        remoteJid: normalizeJid(key.remoteJid ?? jid),
        fromMe: Boolean(key.fromMe),
      },
    });
  }

  async groupFetchAllParticipating() {
    const all = await this.sock.groupFetchAllParticipating();
    for (const metadata of Object.values(all ?? {})) this.learnParticipants(metadata?.participants);
    return all;
  }

  /** Todas las rutas (QR inicial, panel y comandos) comparten una petición. */
  async refreshPairingCode() {
    const sock = this.sock;
    if (!this.pairingMode || !sock || !this._pairingReady || this.stopping ||
        this.status === 'open' || this.authState?.creds?.registered) return null;
    if (this._pairingRequest) return this._pairingRequest;

    this.pairingRequested = true;
    // Renovar invalida el anterior incluso si WhatsApp rechaza la petición.
    this._setStatus('pairing', { pairingCode: null, qr: null, error: null });
    const request = (async () => {
      // Reserva _pairingRequest antes de llamar a Baileys (puede emitir eventos).
      await Promise.resolve();
      try {
        if (this.sock !== sock || this.stopping) return null;
        const code = await sock.requestPairingCode(this.phone.replace(/[^\d]/g, ''));
        if (this.sock !== sock || this.stopping || !this._pairingReady ||
            this.status === 'open' || this.authState?.creds?.registered) return null;
        if (!/^[A-Z0-9]{8}$/.test(code ?? '')) throw new Error('Respuesta de vinculación inválida.');
        this._setStatus('pairing', { pairingCode: code, qr: null, error: null });
        this.emit('log', { level: 'info', message: 'pairing code generado' });
        return code;
      } catch (error) {
        if (this.sock === sock && !this.stopping && this.status !== 'open') {
          this.pairingRequested = false;
          this._setStatus('error', { error: `pairing code: ${error?.message ?? error}` });
        }
        return null;
      } finally {
        if (this._pairingRequest === request) this._pairingRequest = null;
      }
    })();
    this._pairingRequest = request;
    return request;
  }

  /** Ventana local conservadora; la validez final la decide WhatsApp. */
  pairingCodeFresh(maxAgeMs = 45_000) {
    if (!this.sock || !this._pairingReady || this.stopping || this.status !== 'pairing' ||
        this.authState?.creds?.registered || !this.pairingCode) return false;
    const age = Date.now() - this.pairingCodeAt;
    return this.pairingCodeAt != null && age >= 0 && age <= Math.min(maxAgeMs, 60_000);
  }

  /** Espera al handshake o a la petición compartida, sin devolver códigos viejos. */
  async ensurePairingCode({ waitMs = 12_000, maxAgeMs = 45_000, force = false } = {}) {
    if (!this.pairingMode) return { ok: false, reason: 'Este sub-bot se vincula por QR, no por código.' };
    if (this.status === 'open' || this.authState?.creds?.registered) {
      return { ok: false, reason: 'Ese sub-bot ya está vinculado con WhatsApp.' };
    }
    if (!force && this.pairingCodeFresh(maxAgeMs)) {
      return { ok: true, code: this.pairingCode, issuedAt: this.pairingCodeAt, cached: true };
    }
    if (!this.sock || this.stopping) {
      return { ok: false, reason: 'La sesión de vinculación no está abierta todavía. Genera la vinculación desde el panel.' };
    }

    const sock = this.sock;
    const timeout = Number.isFinite(Number(waitMs)) ? Math.max(1, Math.min(Number(waitMs), 30_000)) : 12_000;
    return new Promise((resolve) => {
      const finish = (result) => {
        this.off('status', onStatus);
        clearTimeout(timer);
        resolve(result);
      };
      const onStatus = () => {
        if (this.sock !== sock || this.stopping || ['closed', 'loggedOut', 'open', 'error'].includes(this.status)) {
          finish({ ok: false, reason: this.lastError || 'La sesión cambió. Vuelve a solicitar la vinculación.' });
        } else if (this.pairingCodeFresh(maxAgeMs)) {
          finish({ ok: true, code: this.pairingCode, issuedAt: this.pairingCodeAt, cached: false });
        }
      };
      const timer = setTimeout(() => {
        finish({ ok: false, reason: 'WhatsApp no devolvió el código a tiempo. Inténtalo otra vez en unos segundos.' });
      }, timeout);
      this.on('status', onStatus);
      // Si aún no llegó el QR, connection.update iniciará la petición.
      // No esperar este await: el timeout también debe cubrir una red bloqueada.
      void this.refreshPairingCode();
    });
  }

  /** ¿El bot es admin en este grupo? (consulta fresca) */
  async isBotAdmin(groupJid) {
    if (!isGroupJid(groupJid)) return false;
    const metadata = await this.groupMetadata(groupJid).catch(() => null);
    if (!metadata) return false;
    return botIsAdminIn(metadata, this);
  }

  /** Ruta de la carpeta de credenciales (para borrarla desde el panel). */
  get credentialsPath() {
    return path.join(this.sessionDir, 'creds.json');
  }

  get hasCredentials() {
    return fs.existsSync(this.credentialsPath);
  }
}

export { resolveVersion, FALLBACK_VERSION };
export default BotClient;
