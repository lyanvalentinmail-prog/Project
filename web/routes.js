/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · API REST del panel web
 * ────────────────────────────────────────────────────────────────
 * Todo responde JSON `{ ok, ... }`. Los endpoints públicos no
 * requieren autenticación. Los endpoints protegidos usan auth
 * solo si DASHBOARD_PASSWORD está configurada.
 */
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
} from '../src/db/index.js';
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

export function createRouter({ manager, auth }) {
  const router = express.Router();

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

  // Login solo si hay contraseña configurada
  router.post('/login', (req, res) => {
    if (!auth.hasPassword) {
      return res.json({ ok: true, token: 'open', expiresAt: Date.now() + 86_400_000, noPassword: true });
    }
    const ip = req.ip ?? 'unknown';
    if (auth.isLocked(ip)) {
      return res.status(429).json({ ok: false, error: 'Demasiados intentos fallidos. Espera 5 minutos.' });
    }
    const { password } = req.body ?? {};
    if (!auth.verifyPassword(password)) {
      auth.registerFailure(ip);
      return res.status(401).json({ ok: false, error: 'Contraseña incorrecta.' });
    }
    auth.clearFailures(ip);
    const { token, expiresAt } = auth.issueToken();
    return res.json({ ok: true, token, expiresAt });
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
      authRequired: auth.hasPassword,
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
    });
  });

  /* ── sub-bots ───────────────────────────────────────────── */

  const publicInstance = (row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    phoneMasked: maskPhone(row.phone),
    pairingMode: row.pairing_mode,
    status: row.status,
    waJid: row.wa_jid,
    pushName: row.push_name,
    autostart: Boolean(row.autostart),
    createdAt: row.created_at,
    lastConnectedAt: row.last_connected_at,
    lastError: row.last_error,
    groups: groupsRepo.all(row.id).length,
  });

  router.get('/instances', (_req, res) => {
    res.json({
      ok: true,
      maxInstances: manager.maxInstances,
      instances: manager.list().map((row) => ({
        ...publicInstance(row),
        status: row.status,
        live: row.live,
        uptimeMs: row.uptimeMs ?? 0,
      })),
    });
  });

  router.post('/instances', (req, res) => {
    const { name, phone, pairingMode } = req.body ?? {};
    const result = manager.createInstance({ name, phone, pairingMode });
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    return res.status(201).json({ ok: true, instance: publicInstance(result.instance) });
  });

  router.patch('/instances/:id', (req, res) => {
    const instance = instancesRepo.byId(req.params.id);
    if (!instance) return res.status(404).json({ ok: false, error: 'Sub-bot no encontrado.' });
    const { name, autostart } = req.body ?? {};
    if (typeof name === 'string' && name.trim()) instancesRepo.rename(req.params.id, name.trim());
    if (typeof autostart === 'boolean') instancesRepo.setAutostart(req.params.id, autostart);
    return res.json({ ok: true, instance: publicInstance(instancesRepo.byId(req.params.id)) });
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

    return res.json({
      ok: true,
      id: instance.id,
      name: instance.name,
      pairingMode: instance.pairing_mode,
      status: snapshot.status ?? instance.status,
      qr: snapshot.qr ?? null,
      qrDataUrl,
      pairingCode: snapshot.pairingCode ?? null,
      pairingFormatted: formatPairingCode(snapshot.pairingCode),
      lastError: snapshot.lastError ?? instance.last_error ?? null,
      jid: snapshot.jid ?? instance.wa_jid ?? null,
      pushName: snapshot.pushName ?? instance.push_name ?? null,
    });
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