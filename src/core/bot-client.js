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
} from '@whiskeysockets/baileys';

import { env } from '../config/env.js';
import { IDENTITY } from '../config/identity.js';
import { baileysLogger, scoped } from './logger.js';
import { createContext } from './context.js';
import { handleCommandMessage, parseCommand } from './router.js';
import * as events from './events.js';
import { instancesRepo, statsRepo } from '../db/index.js';
import { normalizeJid, isGroupJid } from '../utils/ids.js';
import { backoff, sleep } from '../utils/misc.js';

const log = scoped('client');

/** Versión de WhatsApp Web conocida (fallback si no hay red). */
const FALLBACK_VERSION = [2, 3000, 1025124219];
let cachedVersion = null;

async function resolveVersion() {
  if (cachedVersion && Date.now() - cachedVersion.at < env.waVersionCacheTtlMs) return cachedVersion.version;
  try {
    const { version } = await fetchLatestBaileysVersion();
    if (Array.isArray(version) && version.length === 3) {
      cachedVersion = { version, at: Date.now() };
      return version;
    }
  } catch (error) {
    log.debug({ err: error }, 'no se pudo obtener la última versión de WA Web, usando la local');
  }
  cachedVersion = { version: FALLBACK_VERSION, at: Date.now() };
  return FALLBACK_VERSION;
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
    this.connectedAt = null;
    this.startedAt = Date.now();

    /** Firma del último estado emitido: evita eventos duplicados (y renders basura en el panel). */
    this._lastSignature = null;
    /** Petición de pairing code en curso (evita pedir varios a la vez a WhatsApp). */
    this._pairingRequest = null;

    this._sendQueue = Promise.resolve();
    this._metadataCache = new Map();
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
    this.stopping = false;
    this.pairingRequested = false;
    this._setStatus('starting');

    fs.mkdirSync(this.sessionDir, { recursive: true, mode: 0o700 });

    const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);
    const version = await resolveVersion();

    this.saveCreds = saveCreds;
    this.authState = state;

    const sock = makeWASocket({
      version,
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
    const sock = this.sock;
    this.sock = null;
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
    sock.ev.on('creds.update', () => {
      this.saveCreds?.().catch((error) => log.error({ err: error }, 'no se pudieron guardar las credenciales'));
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this._setStatus(this.pairingMode ? 'pairing' : 'qr', { qr });
        if (this.pairingMode && !this.pairingRequested) {
          this.pairingRequested = true;
          try {
            const code = await sock.requestPairingCode(this.phone.replace(/[^\d]/g, ''));
            this._setStatus('pairing', { pairingCode: code, qr: null });
            this.emit('log', { level: 'info', message: `pairing code generado: ${code}` });
          } catch (error) {
            this._setStatus('qr', { error: `No se pudo generar el pairing code: ${error?.message ?? error}` });
          }
        }
      }

      if (connection === 'open') {
        this.reconnectAttempts = 0;
        this.connectedAt = Date.now();
        const userJid = sock.user?.id ? normalizeJid(jidNormalizedUser(sock.user.id)) : null;
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

        if (statusCode === DisconnectReason.loggedOut) {
          this._setStatus('loggedOut', { qr: null, pairingCode: null, error: 'Sesión cerrada desde el teléfono (loggedOut).' });
          this.emit('log', { level: 'warn', message: 'sesión cerrada: hay que volver a vincular' });
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
        if (!this.stopping) {
          this.sock = null;
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

    sock.ev.on('contacts.update', (updates) => {
      for (const contact of updates ?? []) {
        if (contact.id && (contact.name || contact.notify)) {
          this._contacts.set(normalizeJid(contact.id), contact.notify ?? contact.name?.slice(-1)?.data ?? null);
        }
      }
    });
  }

  /** Contactos conocidos (para nombres en la bienvenida). */
  _contacts = new Map();

  contactName(jid) {
    return this._contacts.get(normalizeJid(jid)) ?? null;
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
    this._metadataCache.set(key, { at: Date.now(), data });
    return data;
  }

  async groupParticipantsUpdate(jid, participants, action) {
    return this.sock.groupParticipantsUpdate(normalizeJid(jid), participants.map(normalizeJid), action);
  }

  async groupSettingUpdate(jid, setting) {
    this._metadataCache.delete(normalizeJid(jid));
    return this.sock.groupSettingUpdate(normalizeJid(jid), setting);
  }

  async groupInviteCode(jid) {
    return this.sock.groupInviteCode(normalizeJid(jid));
  }

  async groupFetchAllParticipating() {
    return this.sock.groupFetchAllParticipating();
  }

  /** Reintenta el pairing code si el usuario no lo usó a tiempo. */
  async refreshPairingCode() {
    if (!this.pairingMode || !this.sock) return null;
    // Una sola petición a la vez: WhatsApp limita cuántos códigos se piden.
    if (this._pairingRequest) return this._pairingRequest;
    this._pairingRequest = (async () => {
      this.pairingRequested = false;
      try {
        const code = await this.sock.requestPairingCode(this.phone.replace(/[^\d]/g, ''));
        if (code) this._setStatus('pairing', { pairingCode: code });
        return code ?? null;
      } catch (error) {
        this._setStatus(this.status === 'open' ? 'open' : 'error', { error: `pairing code: ${error?.message ?? error}` });
        return null;
      } finally {
        this._pairingRequest = null;
      }
    })();
    return this._pairingRequest;
  }

  /** ¿El código actual sigue siendo utilizable? (WhatsApp los invalida ~60 s). */
  pairingCodeFresh(maxAgeMs = 45_000) {
    if (!this.pairingCode || this.status === 'open') return false;
    return this.pairingCodeAt != null && Date.now() - this.pairingCodeAt <= maxAgeMs;
  }

  /**
   * Devuelve un pairing code REAL y utilizable: reutiliza el vigente o pide
   * uno nuevo a WhatsApp y espera a tenerlo (`waitMs` como máximo).
   */
  async ensurePairingCode({ waitMs = 12_000, maxAgeMs = 45_000, force = false } = {}) {
    if (!this.pairingMode) return { ok: false, reason: 'Este sub-bot se vincula por QR, no por código.' };
    if (this.status === 'open') return { ok: false, reason: 'Ese sub-bot ya está vinculado con WhatsApp.' };
    if (this.sock && !force && this.pairingCodeFresh(maxAgeMs)) {
      return { ok: true, code: this.pairingCode, issuedAt: this.pairingCodeAt, cached: true };
    }
    if (!this.sock) {
      return { ok: false, reason: 'La sesión de vinculación no está abierta todavía. Genera la vinculación desde el panel.' };
    }

    const pending = new Promise((resolve) => {
      const onStatus = (snapshot) => {
        if (snapshot?.pairingCode) {
          this.off('status', onStatus);
          clearTimeout(timer);
          resolve({ ok: true, code: snapshot.pairingCode, issuedAt: snapshot.pairingCodeAt ?? Date.now(), cached: false });
        }
      };
      const timer = setTimeout(() => {
        this.off('status', onStatus);
        resolve({ ok: false, reason: 'WhatsApp no devolvió el código a tiempo. Inténtalo otra vez en unos segundos.' });
      }, waitMs);
      timer.unref?.();
      this.on('status', onStatus);
    });

    await this.refreshPairingCode();
    return pending;
  }

  /** ¿El bot es admin en este grupo? (consulta fresca) */
  async isBotAdmin(groupJid) {
    if (!isGroupJid(groupJid)) return false;
    const metadata = await this.groupMetadata(groupJid).catch(() => null);
    if (!metadata) return false;
    const me = normalizeJid(this.jid);
    return (metadata.participants ?? []).some((p) => normalizeJid(p.id) === me && Boolean(p.admin));
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
