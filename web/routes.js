/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · API REST del panel web
 * ────────────────────────────────────────────────────────────────
 * Todo responde JSON `{ ok, ... }`. El panel está abierto: no se pide
 * contraseña para usar la API (decisión de producto).
 */
import os from 'node:os';
import fs from 'node:fs';
import express from 'express';
import QRCode from 'qrcode';
import {
  instancesRepo,
  groupsRepo,
  usersRepo,
  rolesRepo,
  requestsRepo,
  warningsRepo,
  auditRepo,
  ticketsRepo,
  statsRepo,
  normalizePrefix,
  driverInfo,
  currentJournalMode,
} from '../src/db/index.js';
import { platformLabel } from '../src/utils/platform.js';
import { IDENTITY } from '../src/config/identity.js';
import { env } from '../src/config/env.js';
import { registry } from '../src/commands/index.js';
import * as rolesService from '../src/services/roles.service.js';
import { buildWebContext, applyWebResult } from './service-bridge.js';
import { maskPhone } from '../src/utils/ids.js';
import { formatDuration } from '../src/utils/time.js';
import { createEndpointsRouter } from './api/index.js';
import { createCreditsRouter } from './api/credits.js';

/** Formatea el código de emparejamiento como XXXX-XXXX. */
export const formatPairingCode = (code) =>
  code ? `${String(code).slice(0, 4)}-${String(code).slice(4, 8)}` : null;

/** Recuento real de filas por tabla (nada de datos inventados). */
const dbCounts = () => statsRepo.tableCounts();

/**
 * CPU real del proceso: `os.cpus()` devuelve el acumulado desde el
 * arranque, así que se mide por diferencia entre dos lecturas.
 */
function sampleCpu() {
  const cpus = os.cpus();
  let used = 0;
  let total = 0;
  for (const cpu of cpus) {
    const times = cpu.times;
    used += times.user + times.nice + times.sys + times.irq;
    total += times.user + times.nice + times.sys + times.irq + times.idle;
  }
  // en Android os.cpus() puede venir vacío (/proc/stat restringido): los núcleos salen de availableParallelism
  const cores = cpus.length || (typeof os.availableParallelism === 'function' ? os.availableParallelism() : 0);
  return { used, total, at: Date.now(), cores, model: cpus[0]?.model?.trim() || 'desconocido' };
}

/** Sub-bot en formato público (sin datos sensibles). */
export const publicInstance = (row) => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  phoneMasked: maskPhone(row.phone),
  pairingMode: row.pairing_mode ?? (row.pairingMode ? 'pairing' : 'qr'),
  prefix: row.prefix ?? '.',
  activated: Boolean(row.activated),
  activatedAt: row.activated_at ?? null,
  status: row.status,
  waJid: row.wa_jid ?? row.jid ?? null,
  pushName: row.push_name ?? row.pushName ?? null,
  live: Boolean(row.live),
  autostart: Boolean(row.autostart),
  createdAt: row.created_at ?? null,
  lastConnectedAt: row.last_connected_at ?? null,
  lastError: row.last_error ?? row.lastError ?? null,
  uptimeMs: row.uptimeMs ?? 0,
  reconnectAttempts: row.reconnectAttempts ?? 0,
  pairingCode: row.pairingCode ?? null,
  pairingFormatted: formatPairingCode(row.pairingCode),
  pairingCodeAt: row.pairingCodeAt ?? null,
  qr: row.qr ?? null,
  groups: row.groups ?? groupsRepo.all(row.id).length,
});

/**
 * Estado compacto y estable del panel. Se usa en el SSE (evento
 * `snapshot`) y en `GET /api/state` para que el cliente pueda comparar
 * `revision` y NO volver a pintar si nada cambió.
 */
export function buildStateSnapshot(manager) {
  const instances = manager.list().map((row) => publicInstance({ ...row, live: row.live }));
  const stats = manager.stats();
  const grouped = groupsRepo.all();
  const payload = {
    ok: true,
    revision: '',
    instances,
    stats: {
      ...stats,
      groups: grouped.length,
      pendingPairing: manager.pendingPairingCodes({ onlyFresh: true }).length,
    },
    at: Date.now(),
  };
  payload.revision = `${instances.map((i) => `${i.id}:${i.status}:${i.activated ? 1 : 0}:${i.pairingCode ? 'c' : '-'}${i.uptimeMs ? 'u' : '-'}`).join(',')}|${stats.connected}|${stats.pending}|${payload.stats.pendingPairing}`;
  return payload;
}

let lastCpuSample = null;

/** Uso de CPU desde la última llamada (%, 1 decimal). */
function cpuUsagePercent() {
  const now = sampleCpu();
  const previous = lastCpuSample;
  lastCpuSample = now;
  if (!previous) return 0;
  const usedDelta = now.used - previous.used;
  const totalDelta = now.total - previous.total;
  if (totalDelta <= 0) return 0;
  return Math.min(100, Math.round((usedDelta / totalDelta) * 1000) / 10);
}

export function createRouter({ manager, auth }) {
  const router = express.Router();

  // contador real de peticiones al panel (se muestra en Métricas)
  router.use((_req, _res, next) => {
    statsRepo.bump('apiRequests');
    next();
  });

  /* ── públicas (sin auth) ─────────────────────────────────── */

  router.get('/health', (_req, res) => {
    res.json({
      ok: true,
      bot: { name: IDENTITY.name, team: IDENTITY.team, version: IDENTITY.version, prefix: IDENTITY.prefix },
      uptime: formatDuration(process.uptime() * 1000),
      database: env.dbPath,
      commands: registry.count(),
    });
  });

  // El panel no pide contraseña (decisión de producto): siempre abierto.
  router.post('/login', (_req, res) => {
    return res.json({ ok: true, token: 'open', expiresAt: Date.now() + 86_400_000, noPassword: true });
  });

  // Montar sub-routers de API y créditos (públicos)
  router.use('/endpoints', createEndpointsRouter());
  router.use('/credits', createCreditsRouter());

  /* ── protegidas (requieren auth solo si hay password) ────── */

  router.use(auth.requireAuth);

  router.post('/logout', (req, res) => {
    if (req.token) auth.revoke(req.token);
    res.json({ ok: true });
  });

  router.get('/me', (_req, res) => {
    res.json({
      ok: true,
      bot: { name: IDENTITY.name, team: IDENTITY.team, version: IDENTITY.version, prefix: IDENTITY.prefix },
      limits: { maxInstances: manager.maxInstances },
      owner: env.ownerNumbers.map((n) => maskPhone(n)),
      authRequired: false,
      prefixes: ['#', '-', '+', '.', '/'],
      qrExpiresInSec: Math.round(env.qrTimeoutMs / 1000),
      database: { path: env.dbPath, tables: dbCounts() },
    });
  });

  router.get('/stats', (_req, res) => {
    const groups = groupsRepo.all();
    let registered = 0;
    let withRole = 0;
    let afk = 0;
    let couples = 0;
    for (const group of groups) {
      const counts = usersRepo.counts(group.group_id);
      registered += counts.active;
      withRole += counts.withRole;
      afk += counts.afk;
      couples += counts.couples;
    }
    const roleStats = rolesService.globalRoleStats();
    res.json({
      ok: true,
      ...manager.stats(),
      registered,
      withRole,
      afk,
      couples,
      rolesTaken: roleStats.taken,
      rolesReserved: roleStats.reserved,
      rolesFree: roleStats.free,
      pendingRequests: groups.reduce((total, g) => total + requestsRepo.counts(g.group_id).pending, 0),
      auditEvents: auditRepo.count(),
      // datos reales, sin inventar: contadores y base de datos
      commandsExecuted: statsRepo.totalCommands(),
      messagesHandled: statsRepo.get('messages'),
      apiRequests: statsRepo.get('apiRequests'),
      dbPath: env.dbPath,
      dbTables: dbCounts(),
    });
  });

  /* ── sistema real (servidor, base de datos, conexiones) ────── */

  router.get('/system', (_req, res) => {
    const cpuInfo = sampleCpu();
    const usagePercent = cpuUsagePercent();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    let dbSize = null;
    try {
      dbSize = fs.statSync(env.dbPath).size;
    } catch {
      dbSize = null;
    }
    const instances = manager.list();
    res.json({
      ok: true,
      server: {
        hostname: os.hostname(),
        platform: `${os.type()} ${os.release()}`,
        environment: platformLabel(),
        arch: os.arch(),
        node: process.version,
        uptimeMs: Math.round(process.uptime() * 1000),
        cpu: {
          model: cpuInfo.model,
          cores: cpuInfo.cores,
          usagePercent,
          loadAvg: Math.round(os.loadavg()[0] * 100) / 100,
        },
        memory: {
          totalBytes: totalMem,
          freeBytes: freeMem,
          usedBytes: totalMem - freeMem,
          usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 10000) / 100,
        },
      },
      database: {
        path: env.dbPath,
        sizeBytes: dbSize,
        engine: (() => {
          const info = driverInfo();
          return info.ok ? { name: info.name, version: info.version ?? null, sqlite: info.sqliteVersion ?? null } : null;
        })(),
        journalMode: currentJournalMode(),
        tables: dbCounts(),
        commandsExecuted: statsRepo.totalCommands(),
        topCommands: statsRepo.topCommands(8),
        counters: statsRepo.all(),
      },
      whatsapp: {
        instances: instances.length,
        connected: instances.filter((i) => i.status === 'open').length,
        activated: instances.filter((i) => i.activated).length,
        groups: groupsRepo.all().length,
        statuses: instances.map((i) => ({ id: i.id, name: i.name, status: i.status, activated: Boolean(i.activated) })),
      },
    });
  });

  /* ── sub-bots ───────────────────────────────────────────── */

  router.get('/instances', (_req, res) => {
    res.json({
      ok: true,
      maxInstances: manager.maxInstances,
      instances: manager.list().map((row) => publicInstance(row)),
    });
  });

  /** Estado compacto: el panel lo usa para decidir si hay algo que repintar. */
  router.get('/state', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(buildStateSnapshot(manager));
  });

  router.post('/instances', (req, res) => {
    const { name, phone, pairingMode, prefix } = req.body ?? {};
    const result = manager.createInstance({ name, phone, pairingMode, prefix });
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    return res.status(201).json({ ok: true, instance: publicInstance(result.instance) });
  });

  router.patch('/instances/:id', (req, res) => {
    const instance = instancesRepo.byId(req.params.id);
    if (!instance) return res.status(404).json({ ok: false, error: 'Sub-bot no encontrado.' });
    const { name, autostart, prefix } = req.body ?? {};
    if (typeof name === 'string' && name.trim()) instancesRepo.rename(req.params.id, name.trim());
    if (typeof autostart === 'boolean') instancesRepo.setAutostart(req.params.id, autostart);
    if (prefix !== undefined) {
      const check = normalizePrefix(prefix, instance.prefix);
      if (!check.ok) return res.status(400).json({ ok: false, error: check.reason });
      instancesRepo.setPrefix(req.params.id, check.value);
    }
    return res.json({ ok: true, instance: publicInstance(instancesRepo.byId(req.params.id)) });
  });

  /** Endpoint antiguo: habilita sin clave, no sustituye la vinculación de WhatsApp. */
  router.post('/instances/:id/activate', (req, res) => {
    const result = manager.activate(req.params.id);
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    return res.json({ ok: true, instance: publicInstance(result.instance), already: Boolean(result.already) });
  });

  router.post('/instances/:id/start', async (req, res) => {
    const result = await manager.start(req.params.id);
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    return res.json({ ok: true, client: result.client });
  });

  router.post('/instances/:id/stop', async (req, res) => {
    const result = await manager.stop(req.params.id);
    res.json({ ok: result.ok, stopped: result.stopped });
  });

  router.post('/instances/:id/logout', async (req, res) => {
    const result = await manager.logout(req.params.id);
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    return res.json({ ok: true });
  });

  router.post('/instances/:id/pairing/refresh', async (req, res) => {
    const result = await manager.refreshPairingCode(req.params.id);
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    return res.json({ ok: true, pairingCode: result.code, formatted: formatPairingCode(result.code) });
  });

  /**
   * Entrega un pairing code REAL de WhatsApp para el sub-bot.
   * Si la sesión aún no está abierta, la abre y espera el código:
   * el panel nunca muestra un código inventado.
   */
  router.post('/instances/:id/pairing', async (req, res) => {
    const instance = instancesRepo.byId(req.params.id);
    if (!instance) return res.status(404).json({ ok: false, error: 'Sub-bot no encontrado.' });
    if (instance.pairing_mode !== 'pairing') {
      return res.status(400).json({ ok: false, error: 'Este sub-bot se vincula por QR. Crea otro con vinculación por código.' });
    }
    let client = manager.client(req.params.id);
    if (!client) {
      const started = await manager.start(req.params.id);
      if (!started.ok) return res.status(400).json({ ok: false, error: started.error });
      client = manager.client(req.params.id);
    }
    const force = req.body?.force === true;
    const result = await manager.ensurePairingCode(req.params.id, {
      force,
      waitMs: Number(req.body?.waitMs ?? 15_000),
    });
    if (!result.ok) return res.status(409).json({ ok: false, error: result.error, retryInSec: 5 });
    return res.json({ ok: true, ...result });
  });

  /** Pairing codes reales pendientes (los mismos que entrega el bot con `.key`). */
  router.get('/pairing/pending', (_req, res) => {
    res.json({ ok: true, codes: manager.pendingPairingCodes({ onlyFresh: false }), linking: manager.linkingInstances() });
  });

  router.delete('/instances/:id', async (req, res) => {
    const result = await manager.remove(req.params.id);
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    return res.json({ ok: true });
  });

  router.get('/instances/:id/link', async (req, res) => {
    const instance = instancesRepo.byId(req.params.id);
    if (!instance) return res.status(404).json({ ok: false, error: 'Sub-bot no encontrado.' });
    const client = manager.client(req.params.id);
    const snapshot = client?.snapshot() ?? { ...publicInstance(instance), qr: null, pairingCode: null };

    let qrDataUrl = null;
    if (snapshot.qr) {
      qrDataUrl = await QRCode.toDataURL(String(snapshot.qr), {
        margin: 1,
        width: 360,
        errorCorrectionLevel: 'M',
        color: { dark: '#0b0b10ff', light: '#f6e7d3ff' },
      }).catch(() => null);
    }

    const pairingAgeSec = snapshot.pairingCodeAt ? Math.round((Date.now() - snapshot.pairingCodeAt) / 1000) : null;
    return res.json({
      ok: true,
      id: instance.id,
      name: instance.name,
      pairingMode: instance.pairing_mode,
      prefix: instance.prefix ?? '.',
      activated: Boolean(instance.activated),
      activatedAt: instance.activated_at ?? null,
      status: snapshot.status ?? instance.status,
      qr: snapshot.qr ?? null,
      qrDataUrl,
      qrExpiresInSec: Math.round(env.qrTimeoutMs / 1000),
      qrIssuedAt: snapshot.qrAt ?? null,
      pairingCode: snapshot.pairingCode ?? null,
      pairingFormatted: formatPairingCode(snapshot.pairingCode),
      pairingCodeAt: snapshot.pairingCodeAt ?? null,
      pairingAgeSec,
      // WhatsApp invalida el código ~60 s después de emitirlo
      pairingExpiresInSec: pairingAgeSec == null ? null : Math.max(0, 60 - pairingAgeSec),
      lastError: snapshot.lastError ?? instance.last_error ?? null,
      jid: snapshot.jid ?? instance.wa_jid ?? null,
      pushName: snapshot.pushName ?? instance.push_name ?? null,
    });
  });

  /* ── tickets del panel (persistidos en la base de datos) ───── */

  router.get('/tickets', (_req, res) => {
    res.json({ ok: true, tickets: ticketsRepo.all(), counts: ticketsRepo.counts() });
  });

  router.post('/tickets', (req, res) => {
    const { title, message } = req.body ?? {};
    const cleanTitle = String(title ?? '').trim();
    const cleanMessage = String(message ?? '').trim();
    if (!cleanTitle || !cleanMessage) {
      return res.status(400).json({ ok: false, error: 'El asunto y el mensaje son obligatorios.' });
    }
    const ticket = ticketsRepo.create({ title: cleanTitle, message: cleanMessage });
    auditRepo.log({ instanceId: null, action: 'web.ticket.created', detail: { id: ticket.id } });
    return res.status(201).json({ ok: true, ticket });
  });

  router.post('/tickets/:id/status', (req, res) => {
    const { status } = req.body ?? {};
    const changed = ticketsRepo.setStatus(req.params.id, status);
    if (!changed) return res.status(404).json({ ok: false, error: 'Ticket no encontrado o estado inválido.' });
    return res.json({ ok: true, ticket: ticketsRepo.byId(req.params.id) });
  });

  /* ── grupos ─────────────────────────────────────────────── */

  router.get('/groups', (req, res) => {
    const instanceId = req.query.instanceId ? String(req.query.instanceId) : null;
    const groups = groupsRepo.all(instanceId).map((group) => ({
      groupId: group.group_id,
      name: group.name,
      instanceId: group.instance_id,
      size: group.size,
      locked: group.locked,
      welcome: group.welcome,
      farewell: group.farewell,
      joinedAt: group.joined_at,
      lastSyncAt: group.last_sync_at,
      registered: usersRepo.counts(group.group_id).active,
      rolesTaken: rolesRepo.counts(group.group_id).taken,
      admins: groupsRepo.adminCount(group.group_id),
      pending: requestsRepo.counts(group.group_id).pending,
    }));
    res.json({ ok: true, groups });
  });

  router.get('/groups/:groupId', (req, res) => {
    const group = groupsRepo.get(req.params.groupId);
    if (!group) return res.status(404).json({ ok: false, error: 'Grupo no encontrado.' });
    const groupId = group.group_id;

    return res.json({
      ok: true,
      group: {
        groupId,
        name: group.name,
        size: group.size,
        locked: group.locked,
        welcome: group.welcome,
        farewell: group.farewell,
        config: group.config,
        waCreatedAt: group.wa_created_at,
        joinedAt: group.joined_at,
        lastSyncAt: group.last_sync_at,
        instance: instancesRepo.byId(group.instance_id),
      },
      counts: usersRepo.counts(groupId),
      members: usersRepo.list(groupId, { status: 'active' }).map((u) => ({
        jid: u.jid,
        phone: maskPhone(u.jid),
        name: u.name,
        age: u.age,
        role: u.role_name,
        registeredAt: u.registered_at,
        lastActivity: u.last_activity,
        afk: u.afk_reason ? { reason: u.afk_reason, since: u.afk_since } : null,
        partner: u.partner_name,
        warns: u.warn_count,
        status: u.status,
      })),
      roles: rolesRepo.list(groupId).map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        owner: r.owner_name ?? null,
        ownerJid: r.owner_jid ? maskPhone(r.owner_jid) : null,
        reservedBy: r.reserved_by_name ?? null,
        reservedUntil: r.reserved_until,
        takenAt: r.taken_at,
      })),
      requests: requestsRepo.listPending(groupId).map((r) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        user: r.user_name ?? maskPhone(r.user_jid),
        userJid: r.user_jid,
        target: r.target_name ?? (r.target_jid ? maskPhone(r.target_jid) : null),
        roleName: r.role_name,
        prevRoleName: r.prev_role_name,
        createdAt: r.created_at,
        waMessageId: r.wa_message_id,
      })),
      admins: groupsRepo.listAdmins(groupId).map((a) => ({
        jid: a.user_jid,
        phone: maskPhone(a.user_jid),
        super: Boolean(a.is_super),
        name: usersRepo.get(groupId, a.user_jid)?.name ?? null,
      })),
      blocked: groupsRepo.listBlocked(groupId).map((b) => ({
        jid: b.user_jid,
        phone: maskPhone(b.user_jid),
        reason: b.reason,
        bannedAt: b.banned_at,
      })),
      inactives: usersRepo.listInactives(groupId, group.config.inactivity_days).slice(0, 20).map((u) => ({
        name: u.name,
        days: Math.floor((Date.now() - u.last_activity) / 86_400_000),
        role: u.role_name,
      })),
      audit: auditRepo.list(groupId, { limit: 20 }).map((e) => ({
        action: e.action,
        actor: e.actor_jid ? maskPhone(e.actor_jid) : null,
        target: e.target_jid ? maskPhone(e.target_jid) : null,
        detail: e.detail,
        createdAt: e.created_at,
      })),
    });
  });

  router.post('/groups/:groupId/requests/:requestId/resolve', async (req, res) => {
    const { decision, reason = null } = req.body ?? {};
    if (!['approve', 'deny'].includes(decision)) {
      return res.status(400).json({ ok: false, error: 'decision debe ser "approve" o "deny".' });
    }
    const request = requestsRepo.get(req.params.requestId);
    if (!request) return res.status(404).json({ ok: false, error: 'Solicitud no encontrada.' });
    if (request.group_id !== req.params.groupId) {
      return res.status(400).json({ ok: false, error: 'La solicitud no pertenece a ese grupo.' });
    }

    try {
      const ctx = await buildWebContext({ manager, groupId: request.group_id, actorJid: null });
      const result = rolesService.resolveRequest(ctx, {
        arg: `#${request.id}`,
        decision: decision === 'approve' ? 'approve' : 'deny',
        reason,
        command: decision === 'approve' ? 'acceptrol' : 'denyrol',
      });
      const applied = await applyWebResult(ctx, result);
      return res.json({ ok: Boolean(result.ok), result, delivered: applied.delivered, message: applied.text });
    } catch (error) {
      if (error.code === 'GROUP_NOT_FOUND') return res.status(404).json({ ok: false, error: error.message });
      return res.status(500).json({ ok: false, error: `No se pudo resolver la solicitud: ${error.message}` });
    }
  });

  /* ── auditoría y comandos ───────────────────────────────── */

  router.get('/audit', (req, res) => {
    const limit = Math.min(200, Number(req.query.limit ?? 50));
    const instanceId = req.query.instanceId ? String(req.query.instanceId) : null;
    res.json({
      ok: true,
      entries: auditRepo.recent(limit, instanceId).map((e) => ({
        id: e.id,
        action: e.action,
        groupId: e.group_id,
        groupName: e.group_id ? groupsRepo.get(e.group_id)?.name ?? null : null,
        actor: e.actor_jid ? maskPhone(e.actor_jid) : null,
        target: e.target_jid ? maskPhone(e.target_jid) : null,
        detail: e.detail,
        createdAt: e.created_at,
      })),
    });
  });

  router.get('/commands', (_req, res) => {
    res.json({
      ok: true,
      prefix: IDENTITY.prefix,
      commands: registry.list.map((c) => ({
        name: c.name,
        category: c.category,
        permission: c.permission,
        args: c.args ?? null,
        description: c.description,
        example: c.example ?? null,
        aliases: c.aliases,
        hidden: Boolean(c.hidden),
      })),
    });
  });

  router.get('/warnings/:groupId', (req, res) => {
    res.json({ ok: true, top: warningsRepo.topWarned(req.params.groupId, 20) });
  });

  return router;
}

export default createRouter;