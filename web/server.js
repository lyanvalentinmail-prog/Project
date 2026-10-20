/**
 * 𓆩 ☕ 𓆪  VÉRSOVA · servidor del panel web
 * ────────────────────────────────────────────────────────────────
 * Express + SSE. Se ata a 0.0.0.0 para funcionar también dentro de
 * vistas previas/contenedores, y si el puerto está ocupado prueba el
 * siguiente (hasta 10 intentos) en vez de fallar.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createAuth } from './auth.js';
import { createRouter, buildStateSnapshot } from './routes.js';
import { scoped } from '../src/core/logger.js';
import { env } from '../src/config/env.js';

const log = scoped('web');
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');

/** Clientes SSE conectados. */
const clients = new Set();

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}

/**
 * Deduplica los eventos `status`: Baileys emite varias actualizaciones
 * por reconexión y antes el panel se redibujaba en todas. Solo se
 * reenvía lo que cambió de verdad.
 */
const lastStatusPayload = new Map();
function broadcastStatus(snapshot) {
  const id = snapshot?.id ?? snapshot?.instanceId;
  if (!id) return;
  const signature = JSON.stringify([snapshot.status, snapshot.qr ?? null, snapshot.pairingCode ?? null, snapshot.lastError ?? null, snapshot.jid ?? null, Boolean(snapshot.activated)]);
  if (lastStatusPayload.get(id) === signature) return;
  lastStatusPayload.set(id, signature);
  broadcast('status', snapshot);
}

/**
 * @param {object} params
 * @param {import('../src/core/bot-manager.js').BotManager} params.manager
 * @param {number} [params.port]
 * @param {string} [params.host]
 */
export async function createWebServer({ manager, port = env.webPort, host = env.webHost }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  // 2 MB: el banner del menú viaja como data URL dentro del JSON de personalización
  app.use(express.json({ limit: '2mb' }));

  // El panel está abierto por diseño: auth es una puerta neutra.
  const auth = createAuth();

  /* ── health check estándar (/health y /api/health) ────────── */
  app.get('/health', (_req, res) => {
    res.json({ ok: true, status: 'healthy', uptime: process.uptime() });
  });

  /* ── SSE: estado en vivo de los sub-bots ────────────────────── */
  app.get('/api/stream', auth.requireAuth, (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });
    // `retry` evita que el navegador reconecte cada 3 s por defecto.
    res.write('retry: 15000\n\n');
    res.write(`event: hello\ndata: ${JSON.stringify({ ok: true, at: Date.now() })}\n\n`);
    // Estado completo al conectar: el panel no necesita pedirlo por su cuenta.
    try {
      res.write(`event: snapshot\ndata: ${JSON.stringify(buildStateSnapshot(manager))}\n\n`);
    } catch {
      /* el cliente se fue antes del primer snapshot */
    }
    clients.add(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(`event: ping\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`);
      } catch {
        /* el cliente ya se fue */
      }
    }, 25_000);
    heartbeat.unref?.();

    const close = () => {
      clearInterval(heartbeat);
      clients.delete(res);
    };
    req.on('close', close);
    res.on('close', close);
  });

  /* ── API ────────────────────────────────────────────────────── */
  app.use('/api', createRouter({ manager, auth }));
  // rutas de la API que no existen: JSON (no la página HTML de Express)
  app.use('/api', (req, res) => {
    res.status(404).json({ ok: false, error: `Ruta no encontrada: ${req.method} /api${req.path}` });
  });

  /* ── estáticos ──────────────────────────────────────────────── */
  app.use(express.static(PUBLIC_DIR, {
    extensions: ['html'],
    index: 'index.html',
    setHeaders(res, filePath) {
      // PWA: MIME correcto del manifiesto y service worker siempre fresco
      if (filePath.endsWith('.webmanifest')) res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      if (filePath.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
    },
  }));
  
  // SPA: todas las rutas que no sean /api devuelven index.html
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    if (req.path.includes('.')) return next(); // archivos estáticos ya manejados
    const indexFile = path.join(PUBLIC_DIR, 'index.html');
    if (!fs.existsSync(indexFile)) return next();
    return res.sendFile(indexFile);
  });

  /* ── manejo de errores: nunca tiran el proceso ──────────────── */
  app.use((error, _req, res, _next) => {
    if (res.headersSent) return;
    // errores del cliente (JSON mal formado, cuerpo demasiado grande): no son fallos del servidor
    if (error?.type === 'entity.parse.failed') return res.status(400).json({ ok: false, error: 'El cuerpo de la petición no es JSON válido.' });
    if (error?.type === 'entity.too.large') return res.status(413).json({ ok: false, error: 'La petición es demasiado grande.' });
    log.error({ err: error }, 'error en el panel web');
    res.status(500).json({ ok: false, error: `Error interno: ${error?.message ?? 'desconocido'}` });
  });

  /* ── eventos del manager → SSE (deduplicados) ───────────────── */
  manager.on('status', (snapshot) => broadcastStatus(snapshot));
  manager.on('log', (entry) => broadcast('log', { ...entry, at: Date.now() }));

  /* ── listen con fallback de puerto ──────────────────────────── */
  const server = await listen(app, port, host);
  const actualPort = server.address().port;

  const url = process.env.RENDER_EXTERNAL_URL || `http://${host === '0.0.0.0' ? 'localhost' : host}:${actualPort}`;
  log.info({ url, clients: clients.size }, 'panel web listo');

  return {
    app,
    server,
    host,
    port: actualPort,
    url,
    broadcast,
    stop: () =>
      new Promise((resolve) => {
        // cierra primero los streams SSE abiertos: si no, `server.close()`
        // se queda esperando conexiones vivas (apagado lento en producción).
        for (const res of clients) {
          try {
            res.write('event: bye\ndata: {}\n\n');
            res.end();
          } catch { /* conexión ya cerrada */ }
        }
        clients.clear();
        server.close(() => resolve());
        server.closeAllConnections?.();
        setTimeout(() => resolve(), 1500).unref?.();
      }),
  };
}

function listen(app, startPort, host) {
  return new Promise((resolve, reject) => {
    let attempt = 0;
    const tryPort = (port) => {
      const server = app.listen(port, host);
      server.once('listening', () => resolve(server));
      server.once('error', (error) => {
        server.close(() => {});
        if (error.code === 'EADDRINUSE' && attempt < 10) {
          attempt += 1;
          log.warn(`puerto ${port} ocupado, probando ${port + 1}`);
          return tryPort(port + 1);
        }
        if (error.code === 'EACCES' || error.code === 'EPERM') {
          // Android/Termux (y Linux sin root) no permiten puertos < 1024
          const variable = process.env.PORT ? 'PORT' : 'WEB_PORT';
          error.message = `sin permiso para usar el puerto ${port}${port < 1024 ? ` (los puertos menores que 1024 necesitan root; usa ${variable}=3000)` : ''}`;
        } else if (error.code === 'EADDRNOTAVAIL') {
          error.message = `la dirección WEB_HOST=${host} no existe en este equipo (usa WEB_HOST=0.0.0.0)`;
        } else if (error.code === 'EADDRINUSE') {
          error.message = `los puertos ${startPort}–${port} están ocupados (¿VÉRSOVA ya está en marcha?)`;
        }
        return reject(error);
      });
    };
    tryPort(startPort);
  });
}

export default createWebServer;
