/**
 * Sistema de créditos · Rutas y lógica
 * ────────────────────────────────────────────────────────────────
 * Gestión de créditos, planes, cupones y transacciones.
 */
import express from 'express';
import crypto from 'node:crypto';
import { getDb } from '../../src/db/index.js';

const now = () => Date.now();

/** Genera un API key única. */
function generateApiKey() {
  return `sw_${crypto.randomBytes(24).toString('hex')}`;
}

/** Hash simple para contraseñas (SHA-256 con salt). */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const check = crypto.createHash('sha256').update(salt + password).digest('hex');
  return check === hash;
}

export function createCreditsRouter() {
  const router = express.Router();

  // ── Registro de usuario web ─────────────────────────────────
  router.post('/register', (req, res) => {
    const { email, username, password } = req.body ?? {};
    if (!email || !username || !password) {
      return res.status(400).json({ ok: false, error: 'Email, usuario y contraseña son requeridos.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const existing = getDb().prepare('SELECT id FROM web_users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ ok: false, error: 'Este email ya está registrado.' });
    }

    const id = crypto.randomUUID();
    const apiKey = generateApiKey();
    const passwordHash = hashPassword(password);
    const ts = now();

    getDb().prepare(`
      INSERT INTO web_users (id, email, username, password_hash, credits, plan, api_key, created_at, updated_at)
      VALUES (?, ?, ?, ?, 50, 'free', ?, ?, ?)
    `).run(id, email, username, passwordHash, apiKey, ts, ts);

    // Créditos de bienvenida
    getDb().prepare(`
      INSERT INTO credit_transactions (user_id, type, amount, balance, description, created_at)
      VALUES (?, 'bonus', 50, 50, 'Créditos de bienvenida', ?)
    `).run(id, ts);

    return res.json({ ok: true, user: { id, email, username, credits: 50, plan: 'free', apiKey } });
  });

  // ── Login de usuario web ────────────────────────────────────
  router.post('/login', (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email y contraseña son requeridos.' });
    }

    const user = getDb().prepare('SELECT * FROM web_users WHERE email = ?').get(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ ok: false, error: 'Credenciales incorrectas.' });
    }

    getDb().prepare('UPDATE web_users SET last_login_at = ? WHERE id = ?').run(now(), user.id);

    return res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        credits: user.credits,
        plan: user.plan,
        apiKey: user.api_key,
      },
    });
  });

  // ── Info de usuario (por API key) ───────────────────────────
  router.get('/me', (req, res) => {
    const apiKey = req.headers['x-api-key'] || req.query.key;
    if (!apiKey) return res.status(401).json({ ok: false, error: 'API key requerida.' });

    const user = getDb().prepare('SELECT id, email, username, credits, plan, api_key, created_at FROM web_users WHERE api_key = ?').get(apiKey);
    if (!user) return res.status(401).json({ ok: false, error: 'API key inválida.' });

    const recentTransactions = getDb().prepare(`
      SELECT type, amount, balance, description, created_at
      FROM credit_transactions WHERE user_id = ?
      ORDER BY created_at DESC LIMIT 10
    `).all(user.id);

    return res.json({ ok: true, user, recentTransactions });
  });

  // ── Historial de transacciones ──────────────────────────────
  router.get('/transactions', (req, res) => {
    const apiKey = req.headers['x-api-key'] || req.query.key;
    if (!apiKey) return res.status(401).json({ ok: false, error: 'API key requerida.' });

    const user = getDb().prepare('SELECT id FROM web_users WHERE api_key = ?').get(apiKey);
    if (!user) return res.status(401).json({ ok: false, error: 'API key inválida.' });

    const limit = Math.min(100, Number(req.query.limit ?? 20));
    const transactions = getDb().prepare(`
      SELECT id, type, amount, balance, description, reference, created_at
      FROM credit_transactions WHERE user_id = ?
      ORDER BY created_at DESC LIMIT ?
    `).all(user.id, limit);

    return res.json({ ok: true, transactions });
  });

  // ── Canjear cupón ───────────────────────────────────────────
  router.post('/redeem', (req, res) => {
    const apiKey = req.headers['x-api-key'] || req.query.key;
    const { code } = req.body ?? {};
    if (!apiKey) return res.status(401).json({ ok: false, error: 'API key requerida.' });
    if (!code) return res.status(400).json({ ok: false, error: 'Código de cupón requerido.' });

    const user = getDb().prepare('SELECT * FROM web_users WHERE api_key = ?').get(apiKey);
    if (!user) return res.status(401).json({ ok: false, error: 'API key inválida.' });

    const coupon = getDb().prepare('SELECT * FROM coupons WHERE code = ?').get(code.toUpperCase());
    if (!coupon) return res.status(404).json({ ok: false, error: 'Cupón no encontrado.' });
    if (coupon.expires_at && coupon.expires_at < now()) {
      return res.status(400).json({ ok: false, error: 'Este cupón ha expirado.' });
    }
    if (coupon.used_count >= coupon.max_uses) {
      return res.status(400).json({ ok: false, error: 'Este cupón ya fue agotado.' });
    }

    const alreadyUsed = getDb().prepare('SELECT 1 FROM coupon_uses WHERE coupon_code = ? AND user_id = ?').get(coupon.code, user.id);
    if (alreadyUsed) {
      return res.status(400).json({ ok: false, error: 'Ya usaste este cupón.' });
    }

    const ts = now();
    const newBalance = user.credits + coupon.credits;

    getDb().prepare('UPDATE web_users SET credits = ?, updated_at = ? WHERE id = ?').run(newBalance, ts, user.id);
    getDb().prepare('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?').run(coupon.code);
    getDb().prepare('INSERT INTO coupon_uses (coupon_code, user_id, used_at) VALUES (?, ?, ?)').run(coupon.code, user.id, ts);
    getDb().prepare(`
      INSERT INTO credit_transactions (user_id, type, amount, balance, description, reference, created_at)
      VALUES (?, 'gift', ?, ?, ?, ?, ?)
    `).run(user.id, coupon.credits, newBalance, `Cupón canjeado: ${coupon.code}`, coupon.code, ts);

    return res.json({ ok: true, creditsAdded: coupon.credits, newBalance });
  });

  // ── Comprar créditos (planes) ───────────────────────────────
  router.get('/plans', (_req, res) => {
    const rows = getDb().prepare('SELECT * FROM plans WHERE active = 1 ORDER BY price ASC').all();
    const plans = rows.map((row) => {
      let features = [];
      try {
        features = JSON.parse(row.features ?? '[]');
      } catch {
        features = [];
      }
      return {
        id: row.id,
        name: row.name,
        price: row.price,
        credits: row.credits,
        features,
        popular: row.popular,
      };
    });
    // Sin planes en la BD: la tienda queda vacía (nada de inventar)
    if (!plans.length) {
      return res.json({ ok: true, plans: [] });
    }
    return res.json({ ok: true, plans });
  });

  // Simular compra (sin pasarela de pago real)
  router.post('/purchase', (req, res) => {
    const apiKey = req.headers['x-api-key'] || req.query.key;
    const { planId } = req.body ?? {};
    if (!apiKey) return res.status(401).json({ ok: false, error: 'API key requerida.' });
    if (!planId) return res.status(400).json({ ok: false, error: 'Plan requerido.' });

    const user = getDb().prepare('SELECT * FROM web_users WHERE api_key = ?').get(apiKey);
    if (!user) return res.status(401).json({ ok: false, error: 'API key inválida.' });

    const defaultPlans = {
      starter: { credits: 500, price: 4.99, name: 'Starter' },
      pro: { credits: 1500, price: 9.99, name: 'Pro' },
      business: { credits: 5000, price: 24.99, name: 'Business' },
      enterprise: { credits: 15000, price: 49.99, name: 'Enterprise' },
    };

    let plan = getDb().prepare('SELECT * FROM plans WHERE id = ? AND active = 1').get(planId);
    if (!plan) {
      const dp = defaultPlans[planId];
      if (!dp) return res.status(404).json({ ok: false, error: 'Plan no encontrado.' });
      plan = { id: planId, ...dp };
    }

    const ts = now();
    const newBalance = user.credits + plan.credits;

    getDb().prepare('UPDATE web_users SET credits = ?, plan = ?, updated_at = ? WHERE id = ?')
      .run(newBalance, planId === 'enterprise' ? 'enterprise' : planId === 'business' ? 'premium' : user.plan === 'free' ? 'premium' : user.plan, ts, user.id);

    getDb().prepare(`
      INSERT INTO credit_transactions (user_id, type, amount, balance, description, reference, created_at)
      VALUES (?, 'purchase', ?, ?, ?, ?, ?)
    `).run(user.id, plan.credits, newBalance, `Compra del plan ${plan.name}`, planId, ts);

    return res.json({ ok: true, creditsAdded: plan.credits, newBalance, plan: plan.name });
  });

  // ── Admin: crear cupón ──────────────────────────────────────
  router.post('/admin/coupons', (req, res) => {
    const { credits, maxUses = 1, expiresInDays = 30, code: customCode } = req.body ?? {};
    if (!credits || credits < 1) {
      return res.status(400).json({ ok: false, error: 'Créditos del cupón requeridos.' });
    }

    const code = (customCode || crypto.randomBytes(4).toString('hex')).toUpperCase();
    const expiresAt = now() + expiresInDays * 86_400_000;

    try {
      getDb().prepare('INSERT INTO coupons (code, credits, max_uses, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(code, credits, maxUses, expiresAt, now());
      return res.json({ ok: true, coupon: { code, credits, maxUses, expiresAt } });
    } catch (error) {
      return res.status(409).json({ ok: false, error: 'Ese código de cupón ya existe.' });
    }
  });

  // ── Descuento de créditos por uso de API ────────────────────
  router.post('/use', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    const { cost = 1, endpoint } = req.body ?? {};
    if (!apiKey) return res.status(401).json({ ok: false, error: 'API key requerida.' });

    const user = getDb().prepare('SELECT * FROM web_users WHERE api_key = ?').get(apiKey);
    if (!user) return res.status(401).json({ ok: false, error: 'API key inválida.' });
    if (user.credits < cost) {
      return res.status(402).json({ ok: false, error: 'Créditos insuficientes.', credits: user.credits, required: cost });
    }

    const ts = now();
    const newBalance = user.credits - cost;

    getDb().prepare('UPDATE web_users SET credits = ?, updated_at = ? WHERE id = ?').run(newBalance, ts, user.id);
    getDb().prepare(`
      INSERT INTO credit_transactions (user_id, type, amount, balance, description, reference, created_at)
      VALUES (?, 'usage', ?, ?, ?, ?, ?)
    `).run(user.id, -cost, newBalance, `Uso de API: ${endpoint || 'desconocido'}`, endpoint, ts);

    return res.json({ ok: true, creditsRemaining: newBalance });
  });

  return router;
}