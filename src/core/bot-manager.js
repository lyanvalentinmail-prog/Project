/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · orquestador de sub-bots
 * ────────────────────────────────────────────────────────────────
 * Maneja hasta MAX_INSTANCES sesiones de WhatsApp en el mismo
 * proceso, cada una con su carpeta de credenciales y su número.
 * Es la única puerta que usa el panel web para controlar los bots.
 */
import { EventEmitter } from 'node:events';
import path from 'node:path';
import fs from 'node:fs';
import { env } from '../config/env.js';
import { BotClient } from './bot-client.js';
import { instancesRepo, groupsRepo, auditRepo } from '../db/index.js';
import { scoped } from './logger.js';

const log = scoped('manager');

/** Validación de número internacional (sin "+"): 8 a 20 dígitos. */
export function normalizePhone(input) {
  const digits = String(input ?? '').replace(/[^\d]/g, '');
  if (digits.length < 8) return { ok: false, reason: 'El número es demasiado corto. Usa formato internacional, por ejemplo 5215512345678.' };
  if (digits.length > 20) return { ok: false, reason: 'El número es demasiado largo.' };
  if (digits.startsWith('0')) return { ok: false, reason: 'Quita el 0 inicial y usa el código de país (ej. 52 para México, 34 para España).' };
  return { ok: true, value: digits };
}

export class BotManager extends EventEmitter {
  constructor({ maxInstances = env.maxInstances } = {}) {
    super();
    this.setMaxListeners(40);
    this.maxInstances = Math.min(3, Math.max(1, maxInstances));
    /** @type {Map<string, BotClient>} */
    this.clients = new Map();
    this.started = false;
  }

  /* ── consultas ─────────────────────────────────────────────── */

  /** Instancias con su estado en vivo (o el último guardado si están apagadas). */
  list() {
    return instancesRepo.all().map((row) => {
      const client = this.clients.get(row.id);
      if (!client) {
        return {
          ...row,
          live: false,
          status: row.status === 'open' ? 'closed' : row.status,
          qr: null,
          pairingCode: null,
          uptimeMs: 0,
          groups: groupsRepo.all(row.id).length,
        };
      }
      return { ...row, ...client.snapshot(), live: true, groups: groupsRepo.all(row.id).length };
    });
  }

  get(id) {
    return instancesRepo.byId(id) ?? null;
  }

  client(id) {
    return this.clients.get(id) ?? null;
  }

  stats() {
    const instances = instancesRepo.all();
    const groups = groupsRepo.all();
    return {
      instances: instances.length,
      maxInstances: this.maxInstances,
      connected: [...this.clients.values()].filter((c) => c.status === 'open').length,
      pending: [...this.clients.values()].filter((c) => ['qr', 'pairing', 'connecting', 'starting'].includes(c.status)).length,
      groups: groups.length,
    };
  }

  /* ── ciclo de vida ─────────────────────────────────────────── */

  /** Crea un sub-bot (máximo 3). No lo conecta todavía. */
  createInstance({ name, phone, pairingMode = 'qr' }) {
    if (instancesRepo.count() >= this.maxInstances) {
      return { ok: false, error: `Ya tienes el máximo de sub-bots permitidos (${this.maxInstances}). Borra uno para crear otro.` };
    }
    const phoneCheck = normalizePhone(phone);
    if (!phoneCheck.ok) return { ok: false, error: phoneCheck.reason };
    if (!['qr', 'pairing'].includes(pairingMode)) {
      return { ok: false, error: 'El modo de vinculación debe ser "qr" o "pairing".' };
    }
    if (instancesRepo.byPhone(phoneCheck.value)) {
      return { ok: false, error: 'Ese número ya tiene un sub-bot creado. Un número no puede estar vinculado dos veces.' };
    }

    const cleanName = String(name ?? '').trim().slice(0, 40) || `Versova ${instancesRepo.count() + 1}`;
    const sessionDir = path.join(env.sessionsDir, cleanName.replace(/[^\w\-]+/g, '_').toLowerCase() + '-' + Date.now().toString(36));
    fs.mkdirSync(sessionDir, { recursive: true, mode: 0o700 });

    try {
      const instance = instancesRepo.create({
        name: cleanName,
        phone: phoneCheck.value,
        pairingMode,
        sessionDir,
      });
      auditRepo.log({ instanceId: instance.id, action: 'instance.created', detail: { name: cleanName, pairingMode } });
      return { ok: true, instance };
    } catch (error) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      return { ok: false, error: `No se pudo crear el sub-bot: ${error.message}` };
    }
  }

  /** Arranca (o reinicia) la conexión de un sub-bot. */
  async start(id) {
    const instance = instancesRepo.byId(id);
    if (!instance) return { ok: false, error: 'Ese sub-bot no existe.' };

    let client = this.clients.get(id);
    if (client) {
      if (client.status === 'open') return { ok: true, client: client.snapshot(), alreadyRunning: true };
      await client.stop({ reason: 'restart' }).catch(() => null);
      this.clients.delete(id);
    }

    fs.mkdirSync(instance.session_dir, { recursive: true, mode: 0o700 });
    client = new BotClient(instance);
    client.on('status', (snapshot) => this.emit('status', { instanceId: id, ...snapshot }));
    client.on('log', (entry) => this.emit('log', { instanceId: id, ...entry }));
    this.clients.set(id, client);

    try {
      await client.start();
      instancesRepo.setStatus(id, client.status);
      auditRepo.log({ instanceId: id, action: 'instance.start', detail: { pairingMode: instance.pairing_mode } });
      return { ok: true, client: client.snapshot() };
    } catch (error) {
      log.error({ err: error, id }, 'no se pudo arrancar el sub-bot');
      this.clients.delete(id);
      instancesRepo.setStatus(id, 'error', { lastError: String(error?.message ?? error) });
      return { ok: false, error: `No se pudo iniciar la conexión: ${error?.message ?? error}` };
    }
  }

  async stop(id) {
    const client = this.clients.get(id);
    if (!client) return { ok: true, stopped: false };
    await client.stop({ reason: 'detenido desde el panel' });
    this.clients.delete(id);
    auditRepo.log({ instanceId: id, action: 'instance.stop', detail: {} });
    return { ok: true, stopped: true };
  }

  /** Cierra la sesión de WhatsApp y borra las credenciales. */
  async logout(id) {
    const instance = instancesRepo.byId(id);
    if (!instance) return { ok: false, error: 'Ese sub-bot no existe.' };
    const client = this.clients.get(id);
    if (client) {
      await client.logout().catch((error) => log.warn({ err: error }, 'logout con error'));
      this.clients.delete(id);
    } else {
      fs.rmSync(instance.session_dir, { recursive: true, force: true });
      instancesRepo.setStatus(id, 'loggedOut', { lastError: 'credenciales borradas' });
    }
    auditRepo.log({ instanceId: id, action: 'instance.logout', detail: {} });
    return { ok: true };
  }

  /** Elimina el sub-bot y TODOS sus datos (grupos, fichas, roles…). */
  async remove(id) {
    const instance = instancesRepo.byId(id);
    if (!instance) return { ok: false, error: 'Ese sub-bot no existe.' };
    await this.stop(id).catch(() => null);
    fs.rmSync(instance.session_dir, { recursive: true, force: true });
    instancesRepo.remove(id); // cascade borra groups → users/roles/requests
    auditRepo.log({ instanceId: null, action: 'instance.removed', detail: { id, name: instance.name } });
    return { ok: true };
  }

  async refreshPairingCode(id) {
    const client = this.clients.get(id);
    if (!client) return { ok: false, error: 'El sub-bot no está en marcha.' };
    if (!client.pairingMode) return { ok: false, error: 'Este sub-bot se vincula por QR, no por código.' };
    const code = await client.refreshPairingCode();
    return code ? { ok: true, code } : { ok: false, error: 'WhatsApp no devolvió un código nuevo.' };
  }

  /* ── arranque global ───────────────────────────────────────── */

  /** Arranca todas las instancias con autostart y credenciales guardadas. */
  async startAll() {
    this.started = true;
    const instances = instancesRepo.all().filter((i) => i.autostart);
    const results = [];
    for (const instance of instances) {
      // eslint-disable-next-line no-await-in-loop
      const result = await this.start(instance.id);
      results.push({ id: instance.id, name: instance.name, ...result });
    }
    return results;
  }

  async stopAll() {
    this.started = false;
    for (const id of [...this.clients.keys()]) {
      // eslint-disable-next-line no-await-in-loop
      await this.stop(id).catch(() => null);
    }
  }
}

export default BotManager;
