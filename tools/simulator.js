/**
 * ════════════════════════════════════════════════════════════════
 *  𓆩 ☕ 𓆪  VÉRSOVA · SIMULADOR DE WHATSAPP (herramienta de pruebas)
 * ════════════════════════════════════════════════════════════════
 *  ⚠ ESTO NO ES EL BOT CONECTADO A WHATSAPP.
 *
 *  Es un banco de pruebas que sustituye el adaptador de Baileys por
 *  uno de juguete para que puedas escribir comandos en la terminal y
 *  ver exactamente qué respondería el bot, con la MISMA base de
 *  datos, los mismos servicios y las mismas plantillas.
 *
 *  Sirve para:
 *   · probar flujos completos sin vincular un número real
 *   · verificar la estética de los mensajes
 *   · ejecutar la demo automática: `node tools/simulator.js --demo`
 *
 *  Para el bot real: `npm start` (panel web + QR/pairing code).
 */
import readline from 'node:readline';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { initDatabase, closeDatabase, instancesRepo, groupsRepo, usersRepo } from '../src/db/index.js';
import { createContext, applyResult } from '../src/core/context.js';
import { handleCommandMessage } from '../src/core/router.js';
import * as events from '../src/core/events.js';
import { registry } from '../src/commands/index.js';
import { resetUser as resetRateLimit } from '../src/security/rate-limit.js';
import { IDENTITY } from '../src/config/identity.js';
import { env } from '../src/config/env.js';
import { phoneToJid, normalizeJid } from '../src/utils/ids.js';

const DEMO_GROUP = '120363000000000001@g.us';
const DEMO_INSTANCE_PHONE = '5215500000000';

/* ── adaptador falso (solo para el simulador) ────────────────── */

class FakeClient {
  constructor({ jid, pushName }) {
    this.jid = jid;
    this.pushName = pushName;
    this.sent = [];
    this.metadata = {
      subject: '◢禍◣ Versova · Team de Rol',
      creation: Math.floor(Date.now() / 1000) - 86_400 * 40,
      participants: [],
    };
  }

  addParticipant(jid, { admin = null, name = null } = {}) {
    const normalized = normalizeJid(jid);
    const existing = this.metadata.participants.find((p) => p.id === normalized);
    if (existing) {
      if (admin !== null) existing.admin = admin;
      if (name) existing.notify = name;
      return normalized;
    }
    this.metadata.participants.push({ id: normalized, admin, notify: name });
    return normalized;
  }

  async sendMessage(jid, content) {
    const message = { key: { id: `SIM${Date.now()}${this.sent.length}`, remoteJid: jid }, content };
    this.sent.push(message);
    return message;
  }

  async groupMetadata() {
    return this.metadata;
  }

  async groupParticipantsUpdate(_jid, participants, action) {
    if (action === 'remove') {
      this.metadata.participants = this.metadata.participants.filter(
        (p) => !participants.map(normalizeJid).includes(p.id)
      );
    }
    // WhatsApp casi siempre devuelve 403 al añadir por privacidad del destino:
    // el simulador reproduce ese comportamiento real (ver docs/LIMITACIONES.md).
    return participants.map((jid) => ({ jid, status: action === 'add' ? 403 : 200 }));
  }

  async groupSettingUpdate() {
    return {};
  }

  async groupInviteCode() {
    return 'SIMULADO_NO_REAL';
  }

  async groupFetchAllParticipating() {
    return { [DEMO_GROUP]: this.metadata };
  }

  async isBotAdmin() {
    return this.metadata.participants.some((p) => p.id === normalizeJid(this.jid) && Boolean(p.admin));
  }

  contactName(jid) {
    return this.metadata.participants.find((p) => p.id === normalizeJid(jid))?.notify ?? null;
  }
}

/* ── montaje del entorno de simulación ───────────────────────── */

export async function createSimulation({ dbPath = ':memory:', groupJid = DEMO_GROUP } = {}) {
  if (dbPath !== ':memory:') process.env.DB_PATH = dbPath;
  initDatabase(dbPath === ':memory:' ? ':memory:' : dbPath);

  const botPhone = env.ownerNumbers[0] ?? DEMO_INSTANCE_PHONE;
  const instanceRow = instancesRepo.byPhone(botPhone) ??
    instancesRepo.create({
      name: 'VÉRSOVA (simulador)',
      phone: botPhone,
      pairingMode: 'qr',
      sessionDir: '/tmp/versova-simulator-session',
      prefix: '.',
      activated: true,
      autostart: true,
    });

  const client = new FakeClient({ jid: phoneToJid(botPhone), pushName: IDENTITY.name });
  client.addParticipant(client.jid, { admin: 'superadmin', name: IDENTITY.name });

  const instance = instanceRow;
  groupsRepo.upsert({
    groupId: groupJid,
    instanceId: instance.id,
    name: client.metadata.subject,
    waCreatedAt: client.metadata.creation * 1000,
    size: client.metadata.participants.length,
  });

  /** Añade un participante de mentira. */
  function addPerson(phone, { name = null, admin = null } = {}) {
    const jid = phoneToJid(phone);
    client.addParticipant(jid, { admin, name });
    groupsRepo.upsert({
      groupId: groupJid,
      instanceId: instance.id,
      name: client.metadata.subject,
      waCreatedAt: client.metadata.creation * 1000,
      size: client.metadata.participants.length,
    });
    if (admin) groupsRepo.syncAdmins(groupJid, client.metadata.participants.filter((p) => p.admin));
    return jid;
  }

  /** Envía un mensaje como si viniera de WhatsApp y devuelve las respuestas. */
  async function say(fromJid, text, { mentions = [], quoted = null } = {}) {
    const before = client.sent.length;
    const raw = {
      key: { remoteJid: groupJid, fromMe: false, id: `SIMIN${Date.now()}${Math.floor(Math.random() * 1e4)}` },
      pushName: client.contactName(fromJid) ?? undefined,
      participant: fromJid,
      messageTimestamp: Math.floor(Date.now() / 1000),
      message: {
        extendedTextMessage: {
          text,
          contextInfo: {
            mentionedJid: mentions,
            ...(quoted
              ? { stanzaId: quoted.key.id, participant: quoted.key.remoteJid, quotedMessage: { conversation: '(mensaje citado)' } }
              : {}),
          },
        },
      },
    };

    // El simulador lanza decenas de comandos por segundo; se limpia el
    // rate-limit de este usuario para poder recorrer el flujo completo.
    // (En producción el límite sigue activo: es la medida anti-spam #9.)
    resetRateLimit(groupJid, fromJid);

    const ctx = await createContext({ raw, instance, client });
    const wasCommand = await handleCommandMessage(ctx);
    if (!wasCommand) await events.onMessage(ctx);

    return client.sent.slice(before).map((m) => m.content.text);
  }

  return { client, instance, groupJid, addPerson, say, registry };
}

/* ── demo guiada ─────────────────────────────────────────────── */

const line = (char = '─', n = 62) => char.repeat(n);

async function demo() {
  const sim = await createSimulation();
  const owner = env.ownerNumbers[0] ? phoneToJid(env.ownerNumbers[0]) : sim.addPerson('5215500000000', { name: 'Owner', admin: 'superadmin' });
  const admin = sim.addPerson('5215511112222', { name: 'Kaito', admin: 'admin' });
  const moon = sim.addPerson('5215533334444', { name: 'Moon' });
  const luna = sim.addPerson('5215555556666', { name: 'Luna' });

  const stranger = sim.addPerson('5215577778888', { name: 'Nadia' });
  const victim = sim.addPerson('5215599990000', { name: 'Raid' });
  const spammer = sim.addPerson('5215544445555', { name: 'Spammer' });

  const steps = [
    /* ── registro ─────────────────────────────────────────── */
    [moon, '.reg Moon.17', 'registro de Moon'],
    [luna, '.reg Luna.18', 'registro de Luna'],
    [stranger, '.rol Felix', 'quien NO está registrado intenta pedir personaje'],
    [moon, '.reg Moon.17', 'registro duplicado'],
    [moon, '.reg Moon', 'formato inválido (falta la edad)'],
    [moon, '.reg Moon.catorce', 'edad no numérica'],
    [luna, '.editar Luna.19', 'edita su edad (no toca el personaje)'],

    /* ── personajes ───────────────────────────────────────── */
    [moon, '.rol Felix', 'Moon pide el personaje Felix'],
    [admin, '.pendientes', 'admin ve las solicitudes pendientes'],
    [admin, '.acceptrol Felix', 'admin aprueba (por nombre)'],
    [luna, '.rol Felix', 'Luna intenta el mismo personaje (ocupado)'],
    [luna, '.reservar Nagi', 'Luna reserva Nagi 24 h'],
    [luna, '.reservar Nagi', 'reserva duplicada'],
    [luna, '.reservar Bachira', 'segunda reserva (no se permite)'],
    [moon, '.cambiarol Nagi', 'Moon pide cambio a un personaje reservado'],
    [luna, '.rol Nagi', 'Luna pide el personaje que reservó'],
    [admin, '.acceptrol #' + 'PENDIENTE', 'admin aprueba por folio (se sustituye abajo)'],
    [moon, '.mirol', 'personaje actual de Moon'],
    [moon, '.roles', 'personajes ocupados'],
    [admin, '.reservas', 'reservas activas'],

    /* ── fichas y team ────────────────────────────────────── */
    [moon, '.ficha', 'ficha de Moon'],
    [moon, '.perfil @Luna', `perfil de Luna (${luna})`, [luna]],
    [moon, '.team', 'resumen del team'],
    [moon, '.miembros', 'lista de integrantes'],
    [admin, '.inactivos', 'inactivos (umbral por defecto)'],
    [admin, '.config inactividad 3', 'admin cambia el umbral a 3 días'],
    [moon, '.config', 'consulta de configuración'],
    [moon, '.config inactividad 20', 'un miembro intenta configurar (sin permiso)'],
    [admin, '.config inactividad', 'valor inválido'],
    [admin, '.config prefijo !', 'cambia el prefijo del grupo'],
    [moon, '!team', 'el bot responde con el prefijo nuevo'],
    [admin, '!config prefijo .', 'restaura el prefijo'],

    /* ── AFK ──────────────────────────────────────────────── */
    [moon, '.afk Estoy estudiando', 'Moon se pone AFK'],
    [luna, 'oye @Moon ¿roleros hoy?', `Luna menciona a Moon (${moon})`, [moon]],
    [luna, '@Moon te hablo', 'segunda mención (enfriamiento: no repite)', [moon]],
    [admin, '.afks', 'quién está AFK'],
    [moon, 'ya volví', 'Moon escribe → sale del AFK'],

    /* ── parejas ──────────────────────────────────────────── */
    [moon, '.pareja @Luna', `propuesta de pareja (${luna})`, [luna]],
    [moon, '.pareja @Luna', 'propuesta duplicada'],
    [luna, '.aceptar', 'Luna acepta'],
    [moon, '.perfil', 'perfil propio con pareja'],
    [admin, `.ship @Moon @Luna`, `ship (${moon}, ${luna})`, [moon, luna]],
    [moon, '.terminar', 'Moon quiere terminar (pide confirmación)'],
    [moon, '.cancelar', 'Moon se arrepiente y cancela'],
    [moon, '.terminar', 'Moon vuelve a intentarlo'],
    [moon, '.confirmar', 'y confirma: relación terminada'],

    /* ── moderación ───────────────────────────────────────── */
    [admin, '.warn @Luna Spam en el grupo', `warn 1 a Luna (${luna})`, [luna]],
    [admin, '.warns @Luna', 'historial de warns'],
    [admin, '.unwarn @Luna', `unwarn a Luna (${luna})`, [luna]],
    [moon, '.warn @Luna Spam', 'un miembro intenta advertir (sin permiso)'],
    [admin, '.warn @Kaito autowarn', 'un admin intenta advertir a otro admin'],
    [admin, `.warn @Spammer 1`, `warn 1 a Spammer (${spammer})`, [spammer]],
    [admin, `.warn @Spammer 2`, `warn 2 a Spammer (${spammer})`, [spammer]],
    [admin, `.warn @Spammer 3`, `warn 3 → expulsión automática (${spammer})`, [spammer]],
    [admin, `.expulsar @Nadia Fuera del team`, `expulsar a Nadia (${stranger})`, [stranger]],
    [admin, '.confirmar', 'admin confirma la expulsión'],
    [admin, `.ban @Raid Entró a hacer raid`, `banear a Raid (${victim})`, [victim]],
    [admin, '.confirmar', 'admin confirma el ban'],
    [admin, '.bloqueados', 'lista negra'],
    [admin, `.unban ${victim.split('@')[0]}`, 'unban por número'],
    [admin, '.resetrol @Luna', `admin libera el personaje de Luna (${luna})`, [luna]],
    [admin, '.close', 'cierra el grupo (solo admins hablan)'],
    [moon, '.team', 'un miembro escribe un comando con el grupo cerrado'],
    [admin, '.open', 'abre el grupo'],
    [admin, '.add 5215566667777', 'añadir a alguien por número (limitación de WhatsApp)'],
    [admin, '.invite', 'enlace de invitación'],
    [admin, '.anuncio @todos Evento de rol el sábado 21:00', 'anuncio con mención a todos'],
    [admin, '.auditoria', 'registro administrativo'],

    /* ── información y errores ────────────────────────────── */
    [moon, '.reglas', 'reglas del team'],
    [moon, '.admins', 'staff del grupo'],
    [moon, '.botinfo', 'información técnica'],
    [moon, '.ping', 'latencia'],
    [moon, '.owner', 'owner del bot'],
    [moon, '.help roles', 'ayuda de la sección de personajes'],
    [moon, '.help reservar', 'ayuda de un comando'],
    [moon, '.reservarr', 'comando mal escrito (sugerencia)'],
    [moon, '.liberar', 'libera su personaje (pide confirmación)'],
    [moon, '.confirmar', 'confirma'],
    [moon, '.unreg', 'borra su ficha'],
    [moon, '.confirmar', 'confirma el borrado'],
    [moon, '.menu', 'menú completo'],
  ];

  // sustituye el folio real de la solicitud pendiente de Luna
  const pendingLuna = steps.findIndex(([jid, text]) => jid === admin && text === '.acceptrol #PENDIENTE');
  if (pendingLuna >= 0) steps[pendingLuna] = [admin, '.acceptrol Nagi', 'admin aprueba por nombre (libera la reserva)'];

  console.log(`\n${line('═')}`);
  console.log('  𓆩 ☕ 𓆪  VÉRSOVA · demo automática del simulador');
  console.log('  ⚠ No hay conexión real con WhatsApp: es una prueba de lógica y diseño.');
  console.log(`  ${steps.length} escenarios · misma base de datos, servicios y plantillas del bot real.`);
  console.log(line('═'));

  let failures = 0;
  for (const [jid, text, label, mentions] of steps) {
    console.log(`\n${line('┈')}`);
    console.log(`▶ ${label}`);
    console.log(`  ${usersRepo.get(sim.groupJid, jid)?.name ?? jid.split('@')[0]} escribe: ${text}`);
    let replies = [];
    try {
      replies = await sim.say(jid, text, { mentions: mentions ?? [] });
    } catch (error) {
      failures += 1;
      console.log(`  ✗ EXCEPCIÓN: ${error.message}`);
      continue;
    }
    if (!replies.length) console.log('  (el bot no respondió)');
    for (const reply of replies) {
      console.log(`\n${reply.split('\n').map((l) => `  │ ${l}`).join('\n')}`);
    }
  }

  console.log(`\n${line('═')}`);
  console.log(`  Demo terminada · ${steps.length} escenarios · ${failures} excepciones.`);
  console.log('  Base de datos del simulador: en memoria (no toca tus datos reales).');
  console.log(`${line('═')}\n`);
  closeDatabase();
  if (failures) process.exitCode = 1;
}

/* ── modo interactivo ────────────────────────────────────────── */

async function interactive() {
  const sim = await createSimulation();
  const me = env.ownerNumbers[0] ? phoneToJid(env.ownerNumbers[0]) : sim.addPerson('5215500000000', { name: 'Owner', admin: 'superadmin' });
  sim.addParticipant?.(me);
  sim.client.addParticipant(me, { admin: 'superadmin', name: 'Tú (owner)' });
  groupsRepo.syncAdmins(sim.groupJid, sim.client.metadata.participants.filter((p) => p.admin));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(`\n${line('═')}`);
  console.log('  𓆩 ☕ 𓆪  VÉRSOVA · simulador interactivo');
  console.log('  ⚠ No conecta con WhatsApp: prueba comandos y diseña mensajes.');
  console.log(`  Escribe como si estuvieras en el grupo (prefijo "${IDENTITY.prefix}").`);
  console.log('  Comandos especiales del simulador:');
  console.log('    :user <teléfono> [nombre]   → cambiar de usuario');
  console.log('    :add <teléfono> [nombre]    → añadir participante');
  console.log('    :admin <teléfono>           → hacerlo admin del grupo');
  console.log('    :who                        → participantes');
  console.log('    :help                       → comandos del bot');
  console.log('    :exit                       → salir');
  console.log(`${line('═')}\n`);

  let current = me;

  const ask = () =>
    rl.question(`${usersRepo.get(sim.groupJid, current)?.name ?? current.split('@')[0]} › `, async (input) => {
      const text = input.trim();
      if (!text) return ask();

      if (text === ':exit') {
        rl.close();
        closeDatabase();
        return;
      }
      if (text === ':who') {
        console.log(sim.client.metadata.participants.map((p) => `  · ${p.id} ${p.admin ? `(admin${p.admin === 'superadmin' ? ' super' : ''})` : ''}`).join('\n'));
        return ask();
      }
      if (text === ':help') {
        console.log(
          registry.list
            .filter((c) => !c.hidden)
            .map((c) => `  ${IDENTITY.prefix}${c.name}${c.args ? ` ${c.args}` : ''} — ${c.description}`)
            .join('\n')
        );
        return ask();
      }
      if (text.startsWith(':add')) {
        const [, phone, ...rest] = text.split(/\s+/);
        const jid = sim.addPerson(phone, { name: rest.join(' ') || null });
        console.log(`  añadido ${jid}`);
        return ask();
      }
      if (text.startsWith(':admin')) {
        const [, phone] = text.split(/\s+/);
        sim.addPerson(phone, { admin: 'admin' });
        console.log(`  ${phone} ahora es admin`);
        return ask();
      }
      if (text.startsWith(':user')) {
        const [, phone, ...rest] = text.split(/\s+/);
        current = sim.addPerson(phone, { name: rest.join(' ') || null });
        console.log(`  ahora escribes como ${current}`);
        return ask();
      }

      try {
        const replies = await sim.say(current, text);
        if (!replies.length) console.log('  (sin respuesta)');
        for (const reply of replies) console.log(`\n${reply}\n`);
      } catch (error) {
        console.error(`  ✗ ${error.message}`);
      }
      return ask();
    });

  ask();
}

/** ¿Se ejecutó este archivo directamente? (no cuando lo importa un test) */
const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  if (process.argv.includes('--demo')) {
    demo().catch((error) => {
      console.error('Demo falló:', error);
      process.exit(1);
    });
  } else {
    interactive();
  }
}

export { demo, interactive, FakeClient };
