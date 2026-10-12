/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · inspección de la base de datos
 * ────────────────────────────────────────────────────────────────
 *   npm run db:inspect                 resumen general
 *   npm run db:inspect -- --group <id> detalle de un grupo
 *   npm run db:inspect -- --json       salida para otras herramientas
 */
import process from 'node:process';
import { env } from '../src/config/env.js';
import { initDatabase, closeDatabase, getDb, instancesRepo, groupsRepo, usersRepo, rolesRepo, requestsRepo, warningsRepo, auditRepo, confirmationsRepo } from '../src/db/index.js';
import { maskPhone } from '../src/utils/ids.js';
import { formatDateTime } from '../src/utils/time.js';
import { banner } from '../src/core/logger.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const groupArg = args.includes('--group') ? args[args.indexOf('--group') + 1] : null;

function tableCounts() {
  const db = getDb();
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((row) => row.name);
  const out = {};
  for (const table of tables) {
    out[table] = Number(db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get().n);
  }
  return out;
}

function groupDetail(groupId) {
  const group = groupsRepo.get(groupId);
  if (!group) return null;
  const members = usersRepo.list(groupId, { includeLeft: true });
  return {
    groupId,
    name: group.name,
    instance: instancesRepo.byId(group.instance_id)?.name ?? null,
    size: group.size,
    locked: group.locked,
    welcome: group.welcome,
    farewell: group.farewell,
    config: group.config,
    joinedAt: formatDateTime(group.joined_at),
    lastSync: group.last_sync_at ? formatDateTime(group.last_sync_at) : null,
    counts: usersRepo.counts(groupId),
    roles: rolesRepo.counts(groupId),
    admins: groupsRepo.listAdmins(groupId).map((a) => ({ phone: maskPhone(a.user_jid), super: Boolean(a.is_super) })),
    blocked: groupsRepo.listBlocked(groupId).map((b) => ({ phone: maskPhone(b.user_jid), reason: b.reason })),
    pendingRequests: requestsRepo.listPending(groupId).map((r) => ({ id: r.id, type: r.type, user: r.user_name ?? maskPhone(r.user_jid), role: r.role_name })),
    members: members.map((m) => ({
      name: m.name,
      age: m.age,
      phone: maskPhone(m.jid),
      role: m.role_name ?? null,
      status: m.status,
      warns: m.warn_count,
      afk: m.afk_reason ?? null,
      partner: m.partner_name ?? null,
      lastActivity: formatDateTime(m.last_activity),
    })),
    audit: auditRepo.list(groupId, { limit: 10 }).map((e) => ({ action: e.action, at: formatDateTime(e.created_at) })),
  };
}

initDatabase();

if (groupArg) {
  const detail = groupDetail(groupArg);
  if (asJson) {
    process.stdout.write(`${JSON.stringify(detail, null, 2)}\n`);
  } else if (!detail) {
    banner.error(`Grupo no encontrado: ${groupArg}`);
    banner.info('Grupos conocidos:');
    for (const group of groupsRepo.all()) banner.info(`  · ${group.group_id} — ${group.name}`);
  } else {
    banner.title(`\n𓆩 🥢 𓆪  ${detail.name}\n`);
    banner.info(`id            ⁙ ${detail.groupId}`);
    banner.info(`sub-bot       ⁙ ${detail.instance}`);
    banner.info(`miembros WA   ⁙ ${detail.size}`);
    banner.info(`fichas        ⁙ ${detail.counts.active} activas · ${detail.counts.total} históricas`);
    banner.info(`personajes    ⁙ ${detail.roles.taken} ocupados · ${detail.roles.reserved} reservados · ${detail.roles.free} libres`);
    banner.info(`parejas / AFK ⁙ ${detail.counts.couples} / ${detail.counts.afk}`);
    banner.info(`grupo         ⁙ ${detail.locked ? 'cerrado' : 'abierto'} · bienvenida ${detail.welcome ? 'on' : 'off'} · despedida ${detail.farewell ? 'on' : 'off'}`);
    banner.info(`config        ⁙ inactividad ${detail.config.inactivity_days}d · reserva ${detail.config.reserve_hours}h · warns ${detail.config.max_warnings}`);
    banner.info(`sincronizado  ⁙ ${detail.lastSync ?? 'nunca'}`);
    if (detail.pendingRequests.length) {
      banner.warn(`solicitudes pendientes ⁙ ${detail.pendingRequests.length}`);
      for (const r of detail.pendingRequests) banner.warn(`  #${r.id} ${r.type} · ${r.user} → ${r.role ?? ''}`);
    }
    if (detail.blocked.length) banner.info(`bloqueados ⁙ ${detail.blocked.map((b) => b.phone).join(', ')}`);
    banner.info(`\nIntegrantes (${detail.members.length}):`);
    for (const m of detail.members) {
      banner.info(`  · ${m.name.padEnd(14)} ${String(m.age).padStart(2)} · ${(m.role ?? 'sin rol').padEnd(14)} · ${m.phone} · ${m.status}${m.warns ? ` · ${m.warns} warns` : ''}${m.afk ? ' · AFK' : ''}`);
    }
  }
  closeDatabase();
  process.exit(detail ? 0 : 1);
}

const summary = {
  database: env.dbPath,
  schemaVersion: getDb().prepare("SELECT value FROM meta WHERE key='schema_version'").get()?.value ?? null,
  tables: tableCounts(),
  instances: instancesRepo.all().map((i) => ({ id: i.id, name: i.name, phone: maskPhone(i.phone), status: i.status, mode: i.pairing_mode })),
  groups: groupsRepo.all().map((g) => ({ id: g.group_id, name: g.name, size: g.size, registered: usersRepo.counts(g.group_id).active })),
  pendingConfirmations: confirmationsRepo.count(),
  auditEvents: auditRepo.count(),
};

if (asJson) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} else {
  banner.title('\n𓆩 ☕ 𓆪  VÉRSOVA · base de datos\n');
  banner.info(`archivo  ⁙ ${summary.database}`);
  banner.info(`esquema  ⁙ v${summary.schemaVersion ?? '?'}`);
  banner.title('Tablas');
  for (const [table, count] of Object.entries(summary.tables)) banner.info(`  ${table.padEnd(22)} ${count}`);
  banner.title('Sub-bots');
  if (!summary.instances.length) banner.warn('  ninguno creado todavía');
  for (const i of summary.instances) banner.info(`  · ${i.name} (${i.phone}) → ${i.status} · ${i.mode}`);
  banner.title('Grupos');
  if (!summary.groups.length) banner.warn('  el bot todavía no está en ningún grupo');
  for (const g of summary.groups) banner.info(`  · ${g.name || '(sin nombre)'} → ${g.registered} fichas · ${g.size} miembros · ${g.id}`);
  banner.info(`\nconfirmaciones pendientes ⁙ ${summary.pendingConfirmations}`);
  banner.info(`eventos auditados         ⁙ ${summary.auditEvents}`);
  banner.info(`\nDetalle de un grupo: npm run db:inspect -- --group <id>`);
}

closeDatabase();
process.exit(0);
