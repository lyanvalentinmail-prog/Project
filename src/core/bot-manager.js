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
import { BotClient, PAIRING_CODE_TTL_MS } from './bot-client.js';
import { instancesRepo, groupsRepo, auditRepo, normalizePrefix } from '../db/index.js';
import { maskPhone } from '../utils/ids.js';
import { scoped } from './logger.js';

const log = scoped('manager');

/** `ABCD1234` → `ABCD-1234` (así lo muestra WhatsApp). */
const formatPairing = (code) => (code ? `${String(code).slice(0, 4)}-${String(code).slice(4, 8)}` : null);

/** Validación de número internacional (sin "+"): 8 a 20 dígitos. */
export function normalizePhone(input) {
  const digits = String(input ?? '').replace(/[^\d]/g, '');
  if (digits.length < 8) return { ok: false, reason: 'El número es demasiado corto. Usa formato internacional, por ejemplo 5215512345678.' };
  if (digits.length > 20) return { ok: false, reason: 'El número es demasiado largo.' };
  if (digits.startsWith('0')) return { ok: false, reason: 'Quita el 0 inicial y usa el código de país (ej. 52 para México, 34 para España).' };
  return { ok: true, value: digits };
}

/* ── registro del manager activo ────────────────────────────────
 * El comando `.key` (y `.pairing`) necesita ver los pairing codes
 * REALES de los sub-bots que están vinculándose, sin importar qué bot
 * de la plataforma haya recibido el mensaje.
 */
let activeManager = null;

export function setActiveManager(manager) {
  activeManager = manager ?? null;
  return activeManager;
}

export function getActiveManager() {
  return activeManager;
}

export { normalizePrefix };

export class BotManager extends EventEmitter {
  constructor({ maxInstances = env.maxInstances } = {}) {
    super();
    setActiveManager(this); // `.key` / `.pairing` consultan este manager
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

  /**
   * Crea un sub-bot habilitado (máximo 3), pendiente de vinculación.
   */
  createInstance({ name, phone, pairingMode = 'qr', prefix = '.' }) {
    const phoneCheck = normalizePhone(phone);
    if (!phoneCheck.ok) return { ok: false, error: phoneCheck.reason };
    const prefixCheck = normalizePrefix(prefix);
    if (!prefixCheck.ok) return { ok: false, error: prefixCheck.reason };
    if (!['qr', 'pairing'].includes(pairingMode)) {
      return { ok: false, error: 'El modo de vinculación debe ser "qr" o "pairing".' };
    }
    if (instancesRepo.byPhone(phoneCheck.value)) {
      return { ok: false, error: 'Ese número ya tiene un sub-bot creado. Un número no puede estar vinculado dos veces.' };
    }
    if (instancesRepo.count() >= this.maxInstances) {
      return { ok: false, error: `Ya tienes el máximo de sub-bots permitidos (${this.maxInstances}). Borra uno para crear otro.` };
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
        prefix: prefixCheck.value,
        activated: true,
        autostart: false,
      });
      auditRepo.log({
        instanceId: instance.id,
        action: 'instance.created',
        detail: { name: cleanName, pairingMode, prefix: prefixCheck.value, activated: true },
      });
      return { ok: true, instance };
    } catch (error) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      return { ok: false, error: `No se pudo crear el sub-bot: ${error.message}` };
    }
  }

  /** Compatibilidad con clientes antiguos: ya no se requiere ninguna clave. */
  activate(id) {
    const instance = instancesRepo.byId(id);
    if (!instance) return { ok: false, error: 'Ese sub-bot no existe.' };
    if (instance.activated) return { ok: true, instance, already: true };
    instancesRepo.setActivated(id, true);
    return { ok: true, instance: instancesRepo.byId(id) };
  }

  /** Arranca (o reinicia) la conexión de un sub-bot. */
  async start(id) {
    const instance = instancesRepo.byId(id);
    if (!instance) return { ok: false, error: 'Ese sub-bot no existe.' };

    let client = this.clients.get(id);
    if (client) {
      if (client.status === 'open') return { ok: true, client: client.snapshot(), alreadyRunning: true };
      // Vinculación en curso: derribar el socket mataría el pairing code
      // que la persona está escribiendo en el teléfono. Un «start» de más
      // (el panel lo repite al abrir el asistente) no debe invalidarlo.
      if (client.isLinking) return { ok: true, client: client.snapshot(), alreadyRunning: true };
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
      instancesRepo.setAutostart(id, true);
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

  /**
   * Código vigente del sub-bot. Sin `force` reutiliza el que ya se está
   * mostrando: regenerar invalidaría al instante el código anterior en
   * WhatsApp, aunque todavía le quedara vigencia anunciada. Solo una
   * petición explícita de «código nuevo» (`force`) lo sustituye.
   */
  async refreshPairingCode(id, { force = false } = {}) {
    const client = this.clients.get(id);
    if (!client) return { ok: false, error: 'El sub-bot no está en marcha.' };
    if (!client.pairingMode) return { ok: false, error: 'Este sub-bot se vincula por QR, no por código.' };
    if (!force) {
      const result = await client.ensurePairingCode();
      return result.ok
        ? { ok: true, code: result.code, cached: Boolean(result.cached) }
        : { ok: false, error: result.reason };
    }
    const code = await client.refreshPairingCode();
    return code ? { ok: true, code, cached: false } : { ok: false, error: 'WhatsApp no devolvió un código nuevo.' };
  }

  /**
   * Pide a WhatsApp un pairing code REAL para un sub-bot en vinculación.
   * Reutiliza el vigente si todavía sirve (WhatsApp los invalida a ~60 s).
   */
  async ensurePairingCode(id, options = {}) {
    const instance = instancesRepo.byId(id);
    if (!instance) return { ok: false, error: 'Ese sub-bot no existe.' };
    const client = this.clients.get(id);
    if (!client) return { ok: false, error: 'La sesión de vinculación no está abierta. Pulsa "Generar vinculación" en el panel.' };
    const result = await client.ensurePairingCode(options);
    if (!result.ok) return { ok: false, error: result.reason };
    const ageSec = result.issuedAt ? Math.round((Date.now() - result.issuedAt) / 1000) : 0;
    return {
      ok: true,
      id,
      name: instance.name,
      code: result.code,
      formatted: formatPairing(result.code),
      issuedAt: result.issuedAt ?? null,
      ageSec,
      expiresInSec: Math.max(0, Math.round(PAIRING_CODE_TTL_MS / 1000) - ageSec),
      cached: Boolean(result.cached),
    };
  }

  /**
   * Pairing codes REALES pendientes de todos los sub-bots en vinculación.
   * Es lo que el bot entrega por WhatsApp cuando escribes `.key`.
   */
  pendingPairingCodes({ phone = null, onlyFresh = true } = {}) {
    const digits = phone ? String(phone).replace(/[^\d]/g, '') : null;
    const rows = [];
    for (const row of instancesRepo.all()) {
      const client = this.clients.get(row.id);
      const pairingMode = (client?.pairingMode ?? row.pairing_mode === 'pairing');
      if (!pairingMode) continue;
      const status = client?.status ?? row.status;
      if (status === 'open') continue;
      const code = client?.pairingCode ?? null;
      const issuedAt = client?.pairingCodeAt ?? null;
      const ageMs = issuedAt ? Date.now() - issuedAt : null;
      if (onlyFresh && !client?.pairingCodeFresh(PAIRING_CODE_TTL_MS)) continue;
      rows.push({
        id: row.id,
        name: row.name,
        phone: row.phone,
        phoneMasked: maskPhone(row.phone),
        status,
        activated: Boolean(row.activated),
        live: Boolean(client),
        code,
        formatted: formatPairing(code),
        ageSec: ageMs == null ? null : Math.round(ageMs / 1000),
        expiresInSec: ageMs == null ? null : Math.max(0, Math.round((PAIRING_CODE_TTL_MS - ageMs) / 1000)),
        isOwnNumber: Boolean(digits && String(row.phone).replace(/[^\d]/g, '') === digits),
      });
    }
    // primero el sub-bot cuyo número coincide con quien pregunta
    rows.sort((a, b) => Number(b.isOwnNumber) - Number(a.isOwnNumber));
    return rows;
  }

  /** Sub-bots en vinculación (aunque todavía no tengan código generado). */
  linkingInstances() {
    return instancesRepo
      .all()
      .map((row) => {
        const client = this.clients.get(row.id);
        return {
          id: row.id,
          name: row.name,
          phoneMasked: maskPhone(row.phone),
          pairingMode: client?.pairingMode ?? row.pairing_mode === 'pairing',
          status: client?.status ?? row.status,
          live: Boolean(client),
          activated: Boolean(row.activated),
          hasCode: Boolean(client?.pairingCode),
        };
      })
      .filter((row) => ['starting', 'connecting', 'qr', 'pairing'].includes(String(row.status)));
  }

  /** Cambia el prefijo de comandos del sub-bot (# - + . /). */
  setPrefix(id, prefix) {
    const instance = instancesRepo.byId(id);
    if (!instance) return { ok: false, error: 'Ese sub-bot no existe.' };
    const check = normalizePrefix(prefix, instance.prefix);
    if (!check.ok) return { ok: false, error: check.reason };
    instancesRepo.setPrefix(id, check.value);
    auditRepo.log({ instanceId: id, action: 'instance.prefix', detail: { from: instance.prefix, to: check.value } });
    return { ok: true, instance: instancesRepo.byId(id), prefix: check.value };
  }

  /* ── arranque global ───────────────────────────────────────── */

  /** Arranca las instancias con autostart (los bots nacen desconectados). */
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
