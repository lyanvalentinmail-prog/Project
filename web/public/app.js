/* ═══════════════════════════════════════════════════════════════
   StellarWA · Frontend JS — Vanilla, sin build step
   ═══════════════════════════════════════════════════════════════ */

const API = '/api';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let state = {
  user: null,
  endpoints: [],
  faqs: [],
  health: null,
};

/* ── utilidades ──────────────────────────────────────────── */

const esc = (v) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

async function api(path, { method = 'GET', body = null, headers = {} } = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  if (state.user?.apiKey) h['X-API-Key'] = state.user.apiKey;
  const res = await fetch(`${API}${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({ ok: false, error: `Error ${res.status}` }));
  if (!res.ok && res.status !== 402) throw new Error(data?.error ?? `Error ${res.status}`);
  return data;
}

function toast(msg, kind = 'info') {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  box.append(el);
  setTimeout(() => el.remove(), 5000);
}

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K';
  return String(n);
}

function animateCounter(el, target, duration = 1200) {
  const start = 0;
  const startTime = performance.now();
  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = formatNum(Math.round(start + (target - start) * eased)).replace('.', ',');
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ── NAVBAR ──────────────────────────────────────────────── */

const navToggle = $('#nav-toggle');
const navLinks = $('#nav-links');
navToggle?.addEventListener('click', () => navLinks.classList.toggle('open'));

// Navbar scroll effect
let lastScroll = 0;
window.addEventListener('scroll', () => {
  const navbar = $('#navbar');
  if (window.scrollY > 50) navbar.style.borderBottomColor = 'var(--border)';
  else navbar.style.borderBottomColor = 'var(--border-soft)';
});

// Smooth scroll for anchor links
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#"]');
  if (!link) return;
  const target = document.querySelector(link.getAttribute('href'));
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  navLinks.classList.remove('open');
});

/* ── AUTH ────────────────────────────────────────────────── */

function showAuth() { $('#auth').classList.remove('hidden'); }
function hideAuth() { $('#auth').classList.add('hidden'); }

$('#btn-login')?.addEventListener('click', (e) => { e.preventDefault(); showAuth(); });
$('#btn-register')?.addEventListener('click', (e) => {
  e.preventDefault();
  showAuth();
  toggleAuthView('register');
});
$('#auth-close')?.addEventListener('click', hideAuth);
$('#auth')?.addEventListener('click', (e) => { if (e.target.id === 'auth') hideAuth(); });

function toggleAuthView(view) {
  $('#auth-login').classList.toggle('hidden', view === 'register');
  $('#auth-register').classList.toggle('hidden', view === 'login');
}

$('#show-register')?.addEventListener('click', (e) => { e.preventDefault(); toggleAuthView('register'); });
$('#show-login')?.addEventListener('click', (e) => { e.preventDefault(); toggleAuthView('login'); });

// Login
$('#login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-error').textContent = '';
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  try {
    const data = await fetch(`${API}/credits/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then((r) => r.json());
    if (!data.ok) throw new Error(data.error);
    state.user = data.user;
    try { localStorage.setItem('sw_user', JSON.stringify(data.user)); } catch {}
    hideAuth();
    showDashboard();
    toast('¡Bienvenido de vuelta!', 'ok');
  } catch (err) {
    $('#login-error').textContent = err.message;
  }
});

// Register
$('#register-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#register-error').textContent = '';
  const username = $('#reg-username').value.trim();
  const email = $('#reg-email').value.trim();
  const password = $('#reg-password').value;
  try {
    const data = await fetch(`${API}/credits/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    }).then((r) => r.json());
    if (!data.ok) throw new Error(data.error);
    state.user = data.user;
    try { localStorage.setItem('sw_user', JSON.stringify(data.user)); } catch {}
    hideAuth();
    showDashboard();
    toast('¡Cuenta creada! Tienes 50 créditos de bienvenida ✨', 'ok');
  } catch (err) {
    $('#register-error').textContent = err.message;
  }
});

/* ── DASHBOARD ───────────────────────────────────────────── */

function showDashboard() {
  $('#hero').classList.add('hidden');
  $('#coupon').classList.add('hidden');
  $('#features').classList.add('hidden');
  $('#pricing').classList.add('hidden');
  $('#dashboard').classList.remove('hidden');
  updateDashboard();
  updateNavAuth();
}

function showHome() {
  $('#hero').classList.remove('hidden');
  $('#coupon').classList.remove('hidden');
  $('#features').classList.remove('hidden');
  $('#dashboard').classList.add('hidden');
  updateNavAuth();
}

function updateNavAuth() {
  if (state.user) {
    $('#btn-login').textContent = 'Dashboard';
    $('#btn-login').href = '#dashboard';
    $('#btn-login').onclick = (e) => { e.preventDefault(); showDashboard(); };
    $('#btn-register').textContent = state.user.username || 'Mi cuenta';
    $('#btn-register').href = '#dashboard';
    $('#btn-register').onclick = (e) => { e.preventDefault(); showDashboard(); };
  } else {
    $('#btn-login').textContent = 'Iniciar sesión';
    $('#btn-login').href = '#auth';
    $('#btn-login').onclick = null;
    $('#btn-register').textContent = 'Registrarse';
    $('#btn-register').href = '#auth';
    $('#btn-register').onclick = null;
  }
}

async function updateDashboard() {
  if (!state.user) return;
  try {
    const data = await api('/credits/me');
    if (data.ok) {
      state.user = { ...state.user, ...data.user };
      try { localStorage.setItem('sw_user', JSON.stringify(state.user)); } catch {}
      $('#dash-credits').textContent = formatNum(data.user.credits);
      $('#dash-plan').textContent = (data.user.plan || 'free').charAt(0).toUpperCase() + (data.user.plan || 'free').slice(1);
      $('#dash-apikey').textContent = data.user.api_key || '—';

      const tbody = $('#dash-transactions tbody');
      tbody.innerHTML = '';
      if (data.recentTransactions?.length) {
        for (const tx of data.recentTransactions) {
          const tr = document.createElement('tr');
          const typeLabel = { purchase: 'Compra', usage: 'Uso', gift: 'Regalo', refund: 'Reembolso', bonus: 'Bono' };
          tr.innerHTML = `
            <td><span class="badge ${tx.type === 'purchase' || tx.type === 'bonus' || tx.type === 'gift' ? 'badge-green' : ''}">${esc(typeLabel[tx.type] || tx.type)}</span></td>
            <td style="color:${tx.amount > 0 ? 'var(--green)' : 'var(--red)'}">${tx.amount > 0 ? '+' : ''}${tx.amount}</td>
            <td>${tx.balance}</td>
            <td>${esc(tx.description)}</td>
            <td class="muted">${new Date(tx.created_at).toLocaleDateString('es')}</td>
          `;
          tbody.append(tr);
        }
      } else {
        tbody.innerHTML = '<tr><td colspan="5" class="muted" style="text-align:center;padding:20px">Sin transacciones todavía</td></tr>';
      }
    }
  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

// Dashboard coupon
$('#dash-coupon-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = $('#dash-coupon-code').value.trim();
  if (!code) return;
  const msg = $('#dash-coupon-msg');
  try {
    const data = await api('/credits/redeem', { method: 'POST', body: { code } });
    msg.textContent = `¡${data.creditsAdded} créditos añadidos! Nuevo balance: ${data.newBalance}`;
    msg.className = 'coupon-msg ok';
    $('#dash-coupon-code').value = '';
    updateDashboard();
    toast(`+${data.creditsAdded} créditos canjeados`, 'ok');
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'coupon-msg error';
  }
});

// Copy API key
$('#copy-apikey')?.addEventListener('click', () => {
  const key = $('#dash-apikey').textContent;
  if (!key || key === '—') return;
  navigator.clipboard?.writeText(key).then(
    () => toast('API key copiada', 'ok'),
    () => toast('No se pudo copiar', 'error')
  );
});

// Logout
$('#dash-logout')?.addEventListener('click', () => {
  state.user = null;
  try { localStorage.removeItem('sw_user'); } catch {}
  showHome();
  toast('Sesión cerrada', 'ok');
});

/* ── HOME COUPON ─────────────────────────────────────────── */

$('#coupon-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = $('#coupon-code').value.trim();
  if (!code) return;
  const msg = $('#coupon-msg');
  if (!state.user) {
    msg.textContent = 'Debes iniciar sesión o crear una cuenta para canjear cupones.';
    msg.className = 'coupon-msg error';
    return;
  }
  try {
    const data = await api('/credits/redeem', { method: 'POST', body: { code } });
    msg.textContent = `¡${data.creditsAdded} créditos añadidos! Nuevo balance: ${data.newBalance}`;
    msg.className = 'coupon-msg ok';
    $('#coupon-code').value = '';
    toast(`+${data.creditsAdded} créditos`, 'ok');
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'coupon-msg error';
  }
});

/* ── HERO STATS ──────────────────────────────────────────── */

function loadHeroStats() {
  animateCounter($('#stat-requests'), 204313);
  animateCounter($('#stat-today'), 81);
  animateCounter($('#stat-users'), 575);
  animateCounter($('#stat-endpoints'), 78);
}

/* ── ENDPOINTS ───────────────────────────────────────────── */

async function loadEndpoints() {
  try {
    const data = await api('/endpoints/catalog');
    if (!data.ok) return;
    state.endpoints = data.categories;
    renderEndpoints();
  } catch {
    renderEndpointsFallback();
  }
}

function renderEndpoints() {
  const box = $('#endpoints-list');
  box.innerHTML = state.endpoints.map((cat, i) => `
    <div class="endpoint-category" data-cat="${i}">
      <div class="endpoint-cat-header" data-toggle-cat="${i}">
        <div class="endpoint-cat-left">
          <span class="endpoint-cat-icon">${esc(cat.icon)}</span>
          <span class="endpoint-cat-name">${esc(cat.name)}</span>
        </div>
        <div>
          <span class="endpoint-cat-count"><strong>${cat.count}</strong> endpoints disponibles</span>
          <span class="endpoint-cat-arrow">▼</span>
        </div>
      </div>
      <div class="endpoint-cat-items">
        ${cat.items.map((ep) => `
          <div class="endpoint-item">
            <div class="endpoint-item-left">
              <span class="endpoint-method">${esc(ep.method)}</span>
              <span class="endpoint-name">${esc(ep.name)}</span>
              <span class="endpoint-path">${esc(ep.path)}</span>
            </div>
            <span class="endpoint-tier tier-${ep.tier}">${esc(ep.tier === 'hybrid' ? 'Híbrido' : ep.tier === 'premium' ? 'Premium' : 'Free')}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  $$('[data-toggle-cat]').forEach((header) => {
    header.addEventListener('click', () => {
      const cat = header.closest('.endpoint-category');
      cat.classList.toggle('open');
    });
  });
}

function renderEndpointsFallback() {
  // Fallback con datos estáticos si la API no está disponible
  const categories = [
    { icon: '🔗', name: 'Shorten', count: 2, items: [{ method: 'GET', name: 'TinyURL', path: '/short/tinyurl', tier: 'free' }, { method: 'GET', name: 'Nexray', path: '/short/nexray', tier: 'free' }] },
    { icon: '⬇️', name: 'Downloaders', count: 13, items: [{ method: 'GET', name: 'YouTube Play', path: '/dl/youtubeplay', tier: 'premium' }, { method: 'GET', name: 'TikTok', path: '/dl/tiktok', tier: 'premium' }, { method: 'GET', name: 'Instagram', path: '/dl/instagram', tier: 'premium' }, { method: 'GET', name: 'Spotify', path: '/dl/spotify', tier: 'premium' }, { method: 'GET', name: 'Deezer', path: '/dl/deezer', tier: 'free' }] },
    { icon: '🔍', name: 'Stalking', count: 3, items: [{ method: 'GET', name: 'GitHub Profile', path: '/stalking/github', tier: 'free' }, { method: 'GET', name: 'Telegram Channel', path: '/stalking/telegram', tier: 'free' }, { method: 'GET', name: 'TikTok Profile', path: '/stalking/tiktok', tier: 'free' }] },
    { icon: '🔎', name: 'Searches', count: 9, items: [{ method: 'GET', name: 'YouTube Search', path: '/search/yt', tier: 'premium' }, { method: 'GET', name: 'Spotify Search', path: '/search/spotify', tier: 'premium' }, { method: 'GET', name: 'Deezer Search', path: '/search/deezer', tier: 'free' }] },
    { icon: '🛠️', name: 'Utilidades', count: 15, items: [{ method: 'GET', name: 'Translate', path: '/tools/translate', tier: 'hybrid' }, { method: 'GET', name: 'Remove Background', path: '/tools/removebg', tier: 'premium' }, { method: 'GET', name: 'Screenshot', path: '/tools/ssweb', tier: 'free' }, { method: 'GET', name: 'Emoji Mix', path: '/tools/emojimix', tier: 'free' }] },
    { icon: '✨', name: 'Generadores', count: 14, items: [{ method: 'GET', name: 'Level Up', path: '/generate/levelup', tier: 'free' }, { method: 'GET', name: 'Rank', path: '/generate/rank', tier: 'free' }, { method: 'GET', name: 'Tweet', path: '/generate/tweet', tier: 'free' }] },
    { icon: '🤖', name: 'AI', count: 5, items: [{ method: 'GET', name: 'ChatGPT', path: '/ai/chatgpt', tier: 'premium' }, { method: 'GET', name: 'Copilot', path: '/ai/copilot', tier: 'free' }, { method: 'GET', name: 'DeepSeek', path: '/ai/deepseek', tier: 'premium' }, { method: 'GET', name: 'Gemini', path: '/ai/gemini', tier: 'premium' }] },
  ];
  state.endpoints = categories;
  renderEndpoints();
}

/* ── FAQ ─────────────────────────────────────────────────── */

function renderFAQ() {
  const faqs = [
    { q: '¿Cómo obtengo mi API key?', a: 'Regístrate gratis desde la página principal. Una vez creada tu cuenta, accede a tu panel y encontrarás tu API key lista para copiar. No necesitas tarjeta de crédito para comenzar.' },
    { q: '¿Cuántas requests puedo hacer al día?', a: 'El plan gratuito incluye un límite generoso de peticiones diarias. Si tu proyecto crece, puedes actualizar a un plan Premium para desbloquear requests ilimitadas y endpoints exclusivos.' },
    { q: '¿Qué diferencia hay entre endpoints Free, Premium e Híbridos?', a: 'Los endpoints <strong>Free</strong> están disponibles para todos sin costo. Los <strong>Premium</strong> requieren un plan de pago activo. Los <strong>Híbridos</strong> ofrecen funcionalidades mixtas: algunas gratuitas y otras premium.' },
    { q: '¿Cómo puedo proteger mi API key?', a: 'Nunca la compartas en repositorios públicos. Úsala desde variables de entorno. Configura la restricción por IP en tu perfil y rótala periódicamente desde tu panel de control.' },
    { q: '¿Puedo usar la API en mi bot de WhatsApp, Telegram o Discord?', a: '¡Por supuesto! La API está diseñada para funcionar con cualquier plataforma o lenguaje: JavaScript, Python, PHP, Go, y cualquier framework de bots. Solo necesitas hacer peticiones HTTP con tu key.' },
    { q: '¿Qué pasa si se me acaban los créditos?', a: 'Al alcanzar el límite, tus peticiones devolverán un error temporal. Puedes evitar interrupciones comprando más créditos, canjeando un cupón o esperando promociones.' },
    { q: '¿Cómo contacto al soporte?', a: 'Puedes escribirnos por WhatsApp, enviar un correo, o abrir un ticket desde tu panel. Respondemos lo antes posible.' },
    { q: '¿Hay descuentos o códigos de regalo?', a: 'Sí. Ocasionalmente publicamos códigos de regalo en nuestro canal de WhatsApp. Si tienes un código, canjéalo desde la página principal o tu panel.' },
    { q: '¿Qué métodos HTTP soporta la API?', a: 'La mayoría de endpoints usan <strong>GET</strong>. Algunos servicios usan <strong>POST</strong> con multipart/form-data. Cada endpoint indica su método en la documentación.' },
    { q: '¿Puedo cancelar mi plan en cualquier momento?', a: 'Sí, puedes cancelar desde tu perfil. Mantendrás los beneficios hasta el final del período pagado y luego volverás al plan gratuito.' },
  ];

  const box = $('#faq-list');
  box.innerHTML = faqs.map((faq, i) => `
    <div class="faq-item" data-faq="${i}">
      <div class="faq-question" data-toggle-faq="${i}">
        <span><span class="faq-num">${String(i + 1).padStart(2, '0')}</span> ${faq.q}</span>
        <span class="faq-arrow">▼</span>
      </div>
      <div class="faq-answer">
        <div class="faq-answer-inner">${faq.a}</div>
      </div>
    </div>
  `).join('');

  $$('[data-toggle-faq]').forEach((header) => {
    header.addEventListener('click', () => {
      const item = header.closest('.faq-item');
      item.classList.toggle('open');
    });
  });
}

/* ── TEAM ────────────────────────────────────────────────── */

function renderTeam() {
  const team = [
    { name: "I'm Diego", role: 'CEO', avatar: 'https://files.evogb.win/Acv4hu.jpg', url: 'https://github.com/DevZyxlJs' },
    { name: 'CheriZ', role: 'Socio', avatar: 'https://github.com/CheirZ.png', url: 'https://github.com/CheirZ' },
    { name: 'Anderson', role: 'Socio', avatar: 'https://github.com/ANDERSONTELLO.png', url: 'https://github.com/ANDERSONTELLO' },
  ];

  const box = $('#team-grid');
  box.innerHTML = team.map((m) => `
    <a href="${esc(m.url)}" target="_blank" class="team-card">
      <img class="team-avatar" src="${esc(m.avatar)}" alt="${esc(m.name)}" loading="lazy" />
      <strong>${esc(m.name)}</strong>
      <span>${esc(m.role)}</span>
    </a>
  `).join('');
}

/* ── PRICING ─────────────────────────────────────────────── */

async function loadPricing() {
  try {
    const data = await api('/credits/plans');
    if (data.ok) renderPricing(data.plans);
  } catch {
    renderPricing([
      { name: 'Starter', price: 4.99, credits: 500, features: ['500 créditos', 'Acceso a endpoints Free y Híbridos', 'Soporte por email'], popular: 0 },
      { name: 'Pro', price: 9.99, credits: 1500, features: ['1,500 créditos', 'Acceso a todos los endpoints', 'Soporte prioritario', 'Sin marca de agua'], popular: 1 },
      { name: 'Business', price: 24.99, credits: 5000, features: ['5,000 créditos', 'Acceso ilimitado', 'Soporte 24/7', 'Sin marca de agua', 'IP whitelist'], popular: 0 },
      { name: 'Enterprise', price: 49.99, credits: 15000, features: ['15,000 créditos', 'Todo incluido', 'Endpoints exclusivos', 'SLA 99.9%', 'Manager dedicado'], popular: 0 },
    ]);
  }
}

function renderPricing(plans) {
  const box = $('#pricing-grid');
  box.innerHTML = plans.map((p) => `
    <div class="pricing-card ${p.popular ? 'popular' : ''}">
      ${p.popular ? '<div class="pricing-popular-badge">Más popular</div>' : ''}
      <div class="pricing-name">${esc(p.name)}</div>
      <div class="pricing-price">$${p.price}<small>/mes</small></div>
      <div class="pricing-credits">${formatNum(p.credits)} créditos</div>
      <ul class="pricing-features">
        ${(p.features || []).map((f) => `<li>${esc(f)}</li>`).join('')}
      </ul>
      <button class="btn ${p.popular ? 'btn-primary' : 'btn-outline'} btn-full" onclick="handlePurchase('${esc(p.id || p.name.toLowerCase())}')">
        ${state.user ? 'Comprar ahora' : 'Empezar ahora'}
      </button>
    </div>
  `).join('');
}

window.handlePurchase = async function(planId) {
  if (!state.user) {
    showAuth();
    toast('Crea una cuenta o inicia sesión para comprar', 'warn');
    return;
  }
  try {
    const data = await api('/credits/purchase', { method: 'POST', body: { planId } });
    if (data.ok) {
      toast(`¡${data.creditsAdded} créditos añadidos! Plan: ${data.plan}`, 'ok');
      state.user.credits = data.newBalance;
      updateDashboard();
      showDashboard();
    }
  } catch (err) {
    toast(err.message, 'error');
  }
};

/* ── HEALTH (simulado) ───────────────────────────────────── */

async function loadHealth() {
  try {
    const data = await api('/health');
    if (data.ok) {
      $('#service-status').innerHTML = '<span class="badge-dot"></span> Servicio 100% operativo';
      $('#health-all').innerHTML = '<span class="badge-dot"></span> Todos operativos';
    }
  } catch {
    $('#service-status').innerHTML = '<span class="badge-dot" style="background:var(--yellow)"></span> Verificando...';
  }
}

/* ── BOOT ────────────────────────────────────────────────── */

async function boot() {
  // Restaurar sesión guardada
  try {
    const stored = localStorage.getItem('sw_user');
    if (stored) {
      state.user = JSON.parse(stored);
      // Verificar que sigue siendo válida
      try {
        const data = await api('/credits/me');
        if (data.ok) {
          state.user = { ...state.user, ...data.user };
          updateNavAuth();
        } else {
          state.user = null;
          localStorage.removeItem('sw_user');
        }
      } catch {
        // Mantener datos locales si la API no está disponible
      }
    }
  } catch {}

  updateNavAuth();
  loadHeroStats();
  loadEndpoints();
  renderFAQ();
  renderTeam();
  loadPricing();
  loadHealth();
}

boot();