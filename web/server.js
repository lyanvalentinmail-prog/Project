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
import { createRouter } from './routes.js';
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
 * @param {object} params
 * @param {import('../src/core/bot-manager.js').BotManager} params.manager
 * @param {string} params.password
 * @param {number} [params.port]
 * @param {string} [params.host]
 */
export async function createWebServer({ manager, password, port = env.webPort, host = env.webHost }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(express.json({ limit: '256kb' }));

  const auth = createAuth({ password });

  /* ── SSE: estado en vivo de los sub-bots ────────────────────── */
  app.get('/api/stream', auth.requireAuth, (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(`event: hello\ndata: ${JSON.stringify({ ok: true, at: Date.now() })}\n\n`);
    clients.add(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(`event: ping\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`);
      } catch {
        /* el cliente ya se fue */
      }
    }, 25_000);
    heartbeat.unref?.();

    req.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(res);
    });
  });

  /* ── API ────────────────────────────────────────────────────── */
  app.use('/api', createRouter({ manager, auth }));

  /* ── estáticos ──────────────────────────────────────────────── */
  app.use(express.static(PUBLIC_DIR, { extensions: ['html'], index: 'index.html' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    const indexFile = path.join(PUBLIC_DIR, 'index.html');
    if (!fs.existsSync(indexFile)) return next();
    return res.sendFile(indexFile);
  });

  /* ── manejo de errores: nunca tiran el proceso ──────────────── */
  app.use((error, _req, res, _next) => {
    log.error({ err: error }, 'error en el panel web');
    if (res.headersSent) return;
    res.status(500).json({ ok: false, error: `Error interno: ${error?.message ?? 'desconocido'}` });
  });

  /* ── eventos del manager → SSE ──────────────────────────────── */
  manager.on('status', (snapshot) => broadcast('status', snapshot));
  manager.on('log', (entry) => broadcast('log', { ...entry, at: Date.now() }));

  /* ── listen con fallback de puerto ──────────────────────────── */
  const server = await listen(app, port, host);
  const actualPort = server.address().port;

  const url = `http://${host === '0.0.0.0' ? 'localhost' : host}:${actualPort}`;
  log.info({ url, clients: clients.size }, 'panel web listo');

  return {
    app,
    server,
    port: actualPort,
    url,
    broadcast,
    stop: () =>
      new Promise((resolve) => {
        clients.clear();
        server.close(() => resolve());
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
        return reject(error);
      });
    };
    tryPort(startPort);
  });
}

export default createWebServer;
