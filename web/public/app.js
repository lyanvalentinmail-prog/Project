/* Stellar Wa · SPA vanilla: landing + panel responsive de SubBots/API. */
const API = '/api';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const icon = (name, extra = '') => `<svg class="icon ${extra}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const safeRead = (key, fallback = null) => {
  try {
    const value = localStorage.getItem(key);
    return value == null ? fallback : JSON.parse(value);
  } catch { return fallback; }
};
const safeWrite = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const formatNumber = (value) => new Intl.NumberFormat('es-ES').format(number(value));
const initials = (value) => String(value || 'LY').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'LY';

const routeMap = {
  '/home': 'home', '/register': 'register', '/registrar': 'register', '/create': 'register',
  '/bots': 'bots', '/mis-bots': 'bots', '/metrics': 'metrics', '/metricas': 'metrics', '/status': 'metrics',
  '/store': 'store', '/tienda': 'store', '/endpoints': 'endpoints', '/api': 'endpoints',
  '/tickets': 'tickets', '/support': 'tickets', '/profile': 'profile', '/account': 'profile',
  '/favorites': 'favorites', '/cmds': 'commands', '/commands': 'commands',
};
const paths = { landing: '/', home: '/home', register: '/register', bots: '/bots', metrics: '/metrics', store: '/store', endpoints: '/endpoints', favorites: '/favorites', tickets: '/tickets', profile: '/profile', commands: '/cmds' };
const navItems = [
  { view: 'home', label: 'Inicio', icon: 'home' },
  { view: 'register', label: 'Registrar', icon: 'plus' },
  { view: 'bots', label: 'Mis Bots', icon: 'bot' },
  { view: 'metrics', label: 'Métricas', icon: 'chart' },
  { view: 'store', label: 'Tienda', icon: 'crown' },
  { view: 'menu', label: 'Menú', icon: 'menu' },
];
const desktopItems = [
  { view: 'home', label: 'Inicio', icon: 'home' },
  { view: 'register', label: 'Registrar', icon: 'plus' },
  { view: 'bots', label: 'Mis Bots', icon: 'bot' },
  { view: 'metrics', label: 'Métricas', icon: 'chart' },
  { view: 'store', label: 'Tienda', icon: 'crown' },
  { view: 'endpoints', label: 'Endpoints', icon: 'code' },
];
const people = [
  { name: "I'm Diego", role: 'CEO', initials: 'ID' },
  { name: 'CheirZ', role: 'Socio', initials: 'CZ' },
  { name: 'Ander', role: 'Socio', initials: 'AN' },
  { name: "Ruka's", role: 'Moderador', initials: 'RK' },
  { name: 'Akane', role: 'Moderador', initials: 'AK' },
];
const defaultEndpointCategories = [
  { name: 'Shorten', icon: '🔗', count: 2, items: [{ name: 'TinyURL', path: '/short/tinyurl', method: 'GET', tier: 'free', description: 'Acorta URLs con TinyURL' }, { name: 'Nexray', path: '/short/nexray', method: 'GET', tier: 'free', description: 'Acorta URLs con Nexray' }] },
  { name: 'Downloaders', icon: '⬇️', count: 13, items: [{ name: 'YouTube Play', path: '/dl/youtubeplay', method: 'GET', tier: 'premium', description: 'Descarga video/audio de YouTube' }, { name: 'YouTube MP4', path: '/dl/ytmp4', method: 'GET', tier: 'premium', description: 'Descarga YouTube como MP4' }, { name: 'Instagram', path: '/dl/instagram', method: 'GET', tier: 'premium', description: 'Descarga contenido de Instagram' }, { name: 'TikTok', path: '/dl/tiktok', method: 'GET', tier: 'premium', description: 'Descarga videos de TikTok' }] },
  { name: 'Stalking', icon: '🔍', count: 3, items: [{ name: 'GitHub Profile', path: '/stalking/github', method: 'GET', tier: 'free', description: 'Información pública de perfiles de GitHub' }, { name: 'Telegram Channel', path: '/stalking/telegram', method: 'GET', tier: 'free', description: 'Consulta información de canales' }] },
  { name: 'Searches', icon: '🔎', count: 9, items: [{ name: 'YouTube Search', path: '/search/yt', method: 'GET', tier: 'premium', description: 'Busca videos en YouTube' }, { name: 'Spotify Search', path: '/search/spotify', method: 'GET', tier: 'premium', description: 'Busca pistas de Spotify' }] },
  { name: 'Utilidades', icon: '🛠️', count: 15, items: [{ name: 'Translate', path: '/tools/translate', method: 'GET', tier: 'hybrid', description: 'Traduce textos entre idiomas' }, { name: 'Screenshot', path: '/tools/ssweb', method: 'GET', tier: 'free', description: 'Captura de pantalla de una web' }] },
  { name: 'Generadores', icon: '✨', count: 14, items: [{ name: 'Level Up', path: '/generate/levelup', method: 'GET', tier: 'free', description: 'Genera una tarjeta de nivel' }, { name: 'Welcome Image', path: '/generate/welcome-image', method: 'GET', tier: 'free', description: 'Genera una imagen de bienvenida' }] },
  { name: 'AI', icon: '🤖', count: 5, items: [{ name: 'ChatGPT', path: '/ai/chatgpt', method: 'GET', tier: 'premium', description: 'Conversa con inteligencia artificial' }, { name: 'Copilot', path: '/ai/copilot', method: 'GET', tier: 'free', description: 'Chat con Copilot' }] },
];
const fallbackPlans = [
  { id: 'starter', name: 'Plus', price: 4.99, credits: 500, popular: 0, features: ['500 créditos incluidos', 'Acceso a endpoints Free y Híbridos', '1 clave API', 'Soporte por email'] },
  { id: 'pro', name: 'Basic', price: 9.99, credits: 1500, popular: 1, features: ['1,500 créditos incluidos', 'Acceso a endpoints Premium', '5 cambios de clave', 'Soporte prioritario'] },
  { id: 'business', name: 'Pro', price: 24.99, credits: 5000, popular: 0, features: ['5,000 créditos incluidos', 'Límites ampliados', 'IP whitelist', 'Soporte 24/7'] },
  { id: 'enterprise', name: 'Business', price: 49.99, credits: 15000, popular: 0, features: ['15,000 créditos incluidos', 'Endpoints exclusivos', 'Claves múltiples', 'SLA prioritario'] },
];
const faqItems = [
  { q: '¿Es seguro vincular mi número?', a: 'Sí. Usamos el protocolo oficial WhatsApp Multi-Device con cifrado de extremo a extremo. Tu sesión se almacena cifrada y no tenemos acceso a tus chats.' },
  { q: '¿Puedo perder mi cuenta de WhatsApp?', a: 'El sistema incluye anti-ban inteligente con detección de spam, throttling de mensajes y protección contra reportes. Recomendamos no usar el bot para spam masivo.' },
  { q: '¿Qué métodos de pago aceptan?', a: 'Aceptamos PayPal desde la tienda, además de Patreon y Ko-Fi. Todos son métodos oficiales y verificados.' },
  { q: '¿Cuánto tarda la activación del token?', a: 'La activación es automática e instantánea. Después de pagar, recibís tu token en el correo que hayas indicado en menos de 1 minuto.' },
  { q: '¿Puedo cambiar mi bot de servidor?', a: 'Sí. Los SubBots gratis tienen 2 cambios incluidos. Los tokens Premium y Moderador tienen cambios ilimitados.' },
  { q: '¿Qué pasa si el bot se desconecta?', a: 'El sistema detecta la caída y reconecta automáticamente. Si persiste, podés verificar el estado del servidor en /status o abrir un ticket.' },
  { q: '¿Necesito un servidor propio?', a: 'No. Todo corre en nuestra infraestructura cloud multi-región. Vos solo vinculás tu número y usás los comandos.' },
  { q: '¿Puedo usar el mismo número en varios bots?', a: 'No. Cada número puede estar vinculado a un solo SubBot a la vez. Podés desvincularlo y volver a vincularlo desde el panel si es necesario.' },
];

const state = {
  view: routeFromPath(),
  adminToken: localStorage.getItem('versova_panel_token') || '',
  apiUser: safeRead('sw_user'),
  authRequired: false,
  me: null,
  health: null,
  stats: null,
  instances: [],
  groups: [],
  endpoints: defaultEndpointCategories,
  endpointTotal: 68,
  apiPlans: fallbackPlans,
  favorites: safeRead('stellar_favorites', []),
  endpointQuery: '',
  endpointMethod: 'all',
  endpointTier: 'all',
  endpointCategory: 'all',
  endpointSort: 'az',
  openCategories: new Set(),
  selectedEndpoint: null,
  endpointCodeTab: 'curl',
  endpointWithKey: true,
  authMode: 'admin',
  pendingPlan: '',
  storePeriod: 'monthly',
  storeCurrency: 'USD',
  viewTickets: safeRead('stellar_tickets', []),
  newTicketOpen: false,
  theme: localStorage.getItem('stellar_theme') || 'dark',
  flow: {
    step: 1,
    type: 'free',
    typeListOpen: false,
    server: 'luffy',
    provider: 'stellar',
    phone: '',
    pairingMode: 'pairing',
    name: '',
    token: '',
    tokenVerified: false,
    instanceId: null,
    linkData: null,
    loading: false,
    error: '',
    poller: null,
  },
};

function routeFromPath() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  if ((pathname === '/home' || pathname === '/') && window.location.hash.toLowerCase() === '#store') return 'store';
  return routeMap[pathname] || 'landing';
}

async function request(path, options = {}) {
  const { method = 'GET', body = null, auth = true, apiKey = true, headers = {} } = options;
  const requestHeaders = { 'Content-Type': 'application/json', ...headers };
  if (auth && state.adminToken) requestHeaders.Authorization = `Bearer ${state.adminToken}`;
  if (apiKey && state.apiUser?.apiKey) requestHeaders['X-API-Key'] = state.apiUser.apiKey;
  const response = await fetch(`${API}${path}`, {
    method,
    headers: requestHeaders,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({ ok: false, error: `Error ${response.status}` }));
  if (!response.ok) {
    const error = new Error(data?.error || `Error ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function brandMarkup() {
  return `<span class="brand-mark" aria-hidden="true"><span class="brand-glyph">✦</span></span><span class="brand-copy"><span class="brand-name">Stellar<em>WA</em></span><span class="brand-tagline">Plataforma oficial</span></span>`;
}

function renderHeader() {
  const header = $('#site-header');
  if (!header) return;
  if (state.view === 'landing') {
    header.className = 'site-header landing-header';
    header.innerHTML = `
      <a class="brand" href="/" aria-label="Stellar Wa, inicio">${brandMarkup()}</a>
      <nav class="header-links" aria-label="Secciones de Stellar Wa">
        <a class="header-link" href="#how">Cómo empezar</a>
        <a class="header-link" href="#benefits">Beneficios</a>
        <a class="header-link" href="#premium">Premium</a>
        <a class="header-link" href="#faq">Preguntas frecuentes</a>
      </nav>
      <div class="header-actions">
        <span class="service-pill"><span class="pulse-dot"></span><span id="header-service-copy">Servicio operativo</span></span>
        <button class="icon-button" type="button" data-action="toggle-theme" aria-label="Cambiar tema">${icon(state.theme === 'light' ? 'sun' : 'moon')}</button>
        <a class="btn btn-primary btn-small header-panel-link" href="/home" data-page="home">Ir al Panel ${icon('arrow-right')}</a>
        <button class="icon-button mobile-menu-toggle" type="button" data-action="toggle-landing-menu" aria-label="Abrir navegación">${icon('menu')}</button>
      </div>`;
    return;
  }

  header.className = 'site-header is-app-header';
  const activeView = state.view === 'favorites' ? 'endpoints' : state.view;
  header.innerHTML = `
    <a class="brand" href="/home" data-page="home" aria-label="Stellar Wa, panel">${brandMarkup()}</a>
    <nav class="desktop-app-nav" aria-label="Panel principal">
      ${desktopItems.map((item) => `<a class="header-link ${activeView === item.view ? 'is-active' : ''}" href="${paths[item.view]}" data-page="${item.view}">${icon(item.icon)}<span>${item.label}</span></a>`).join('')}
    </nav>
    <div class="header-actions">
      <button class="icon-button" type="button" data-action="toggle-theme" aria-label="Cambiar tema">${icon(state.theme === 'light' ? 'sun' : 'moon')}</button>
      <button class="icon-button notification-button" type="button" data-action="notifications" aria-label="Notificaciones">${icon('bell')}<span class="notification-count">3</span></button>
      <button class="profile-button" type="button" data-action="open-drawer" aria-label="Abrir menú de usuario">
        <span class="avatar">${escapeHtml(initials(state.apiUser?.username || 'Lyan'))}</span><span class="profile-name">${escapeHtml(state.apiUser?.username || 'Lyan')}</span>${icon('chevron')}
      </button>
    </div>`;
}

function renderBottomNavigation() {
  const nav = $('#bottom-navigation');
  if (!nav) return;
  if (state.view === 'landing') {
    nav.hidden = true;
    nav.innerHTML = '';
    return;
  }
  nav.hidden = false;
  nav.innerHTML = navItems.map((item) => {
    const active = item.view === 'menu' ? false : (item.view === state.view || (state.view === 'favorites' && item.view === 'endpoints'));
    return `<button class="bottom-nav-item ${active ? 'is-active' : ''}" type="button" data-${item.view === 'menu' ? 'action="open-drawer"' : `page="${item.view}"`} aria-label="${item.label}">${icon(item.icon)}<span>${item.label}</span></button>`;
  }).join('');
}

function pageFooter() {
  return `<footer class="page-footer"><span>© 2026 <strong class="purple">Stellar The Best's Corp.</strong> · Powered by VÉRSOVA</span><span><a href="#" data-action="channel-link">${icon('whatsapp')} Canal</a><a href="mailto:soporte@stellarwa.xyz">${icon('mail')} Email</a></span></footer>`;
}

function renderLanding() {
  const host = $('#main-content');
  const questions = faqItems.map((item, index) => `<details class="faq-item" ${index === 0 ? 'open' : ''}><summary><span><span class="purple mono">${String(index + 1).padStart(2, '0')}</span>　${escapeHtml(item.q)}</span></summary><div class="faq-answer">${escapeHtml(item.a)}</div></details>`).join('');
  host.innerHTML = `
    <div class="page-content landing-page" id="top">
      <section class="landing-hero" aria-labelledby="landing-title">
        <div class="landing-hero-copy">
          <span class="hero-version"><span class="pulse-dot"></span> Plataforma oficial · v2.0</span>
          <h1 class="landing-title" id="landing-title"><span class="title-line">Automatiza WhatsApp</span><span class="title-line">con <span class="gradient-text">Stellar Intelligence</span></span></h1>
          <p class="landing-lede">Plataforma de gestión de <strong>SubBots</strong> con conexión estable, anti-ban integrado y panel unificado para todos tus números.</p>
          <div class="landing-actions">
            <a class="btn btn-primary btn-large" href="/home" data-page="home">Ir al Panel ${icon('arrow-right')}</a>
            <a class="btn btn-outline btn-large" href="/store" data-page="store">Comprar Token ${icon('crown')}</a>
          </div>
          <div class="hero-footnote"><span>${icon('shield')} Infraestructura cloud</span><span>${icon('clock')} Configuración en minutos</span><span>${icon('check')} Sin servidor propio</span></div>
        </div>
        <div class="hero-showcase" aria-label="Vista previa del panel Stellar Wa">
          <div class="orbit"><span class="orbit-dot"></span></div>
          <div class="float-chip float-chip-one">${icon('bolt')} Conexión estable</div>
          <div class="float-chip float-chip-two">${icon('server')} Multi-servidor</div>
          <div class="showcase-window">
            <div class="showcase-top"><span class="showcase-title">${icon('spark')} STELLAR · NETWORK</span><span class="window-dots"><i></i><i></i><i></i></span></div>
            <div class="showcase-body">
              <div class="showcase-bot"><span class="bot-orb">${icon('bot')}</span><span><strong>Stellar SubBot</strong><small>WhatsApp · Vinculado</small></span><span class="status-tag"><i class="pulse-dot"></i> Online</span></div>
              <div class="showcase-stats"><div class="showcase-stat"><b>206</b><span>Bots activos</span></div><div class="showcase-stat"><b>99.9%</b><span>Disponibilidad</span></div><div class="showcase-stat"><b>&lt;1s</b><span>Reconexión</span></div></div>
              <div class="showcase-connection">${icon('shield')}<span><b>Protección inteligente</b> · monitoreo automático en la nube</span></div>
            </div>
          </div>
        </div>
      </section>

      <div class="landing-proof" aria-label="Estadísticas de la plataforma">
        <div class="proof-card"><span class="icon-wrap">${icon('bot')}</span><span><strong>206</strong><span>Total Bots</span></span></div>
        <div class="proof-card"><span class="icon-wrap">${icon('server')}</span><span><strong>7</strong><span>Servidores</span></span></div>
        <div class="proof-card"><span class="icon-wrap">${icon('users')}</span><span><strong>24</strong><span>Premium</span></span></div>
        <div class="proof-card"><span class="icon-wrap">${icon('globe')}</span><span><strong>99.9%</strong><span>Uptime</span></span></div>
      </div>

      <section class="section-block" id="how">
        <div class="section-heading center"><span class="section-kicker">${icon('spark')} Cómo funciona</span><h2 class="section-title">Listo en <span class="gradient-text">3 simples pasos</span></h2><p class="section-copy">Setup en menos de 2 minutos. Sin servidores, sin configuración compleja.</p></div>
        <div class="steps-grid">
          <article class="card card-hover step-card"><span class="step-number">01</span><h3>Vincula tu número</h3><p>Genera un código de 8 dígitos o un QR desde el panel y escanéalo con WhatsApp en el dispositivo que será el bot. Todo corre en nuestra nube.</p></article>
          <article class="card card-hover step-card"><span class="step-number">02</span><h3>Personaliza tu SubBot</h3><p>Configura nombre, prefijo, banner, owner y canal desde el panel de Mis Bots. Los cambios se aplican sin reiniciar el bot.</p></article>
          <article class="card card-hover step-card"><span class="step-number">03</span><h3>Usa comandos en tus grupos</h3><p>Explora la lista completa en Comandos. Escribe #menu en cualquier grupo donde esté el bot para ver todo lo que puede hacer.</p></article>
        </div>
      </section>

      <section class="section-block" id="benefits">
        <div class="section-heading center"><span class="section-kicker">${icon('shield')} ¿Por qué Stellar?</span><h2 class="section-title">Una plataforma que <span class="gradient-text">trabaja contigo</span></h2><p class="section-copy">Herramientas y controles pensados para que tus bots sigan disponibles y sean fáciles de administrar.</p></div>
        <div class="benefits-grid">
          <article class="card card-hover benefit-card"><span class="benefit-icon">${icon('shield')}</span><h3>Anti-ban integrado</h3><p>Sistema de detección de spam y throttling inteligente para proteger tu número.</p></article>
          <article class="card card-hover benefit-card"><span class="benefit-icon">${icon('server')}</span><h3>Multi-servidor</h3><p>Múltiples proveedores de hosting con balanceo automático y failover.</p></article>
          <article class="card card-hover benefit-card"><span class="benefit-icon">${icon('link')}</span><h3>Reconexión instantánea</h3><p>Si un servidor cae, tu bot migra en segundos sin perder la sesión.</p></article>
          <article class="card card-hover benefit-card"><span class="benefit-icon">${icon('chart')}</span><h3>Métricas en vivo</h3><p>Uptime, uso de CPU/RAM y estado de red de cada servidor en tiempo real.</p></article>
          <article class="card card-hover benefit-card"><span class="benefit-icon">${icon('lock')}</span><h3>Clave de seguridad</h3><p>Protege tu bot con código de verificación para evitar accesos no autorizados.</p></article>
          <article class="card card-hover benefit-card"><span class="benefit-icon">${icon('spark')}</span><h3>Personalización total</h3><p>Banner, prefijo, moneda, canal de WhatsApp y más — todo desde el panel.</p></article>
        </div>
      </section>

      <section class="section-block" id="premium">
        <div class="premium-panel">
          <div class="premium-content">
            <span class="section-kicker">${icon('crown')} Tokens Premium</span>
            <div class="premium-heading" style="margin-top:15px"><span class="benefit-icon">${icon('gem')}</span><span><h3>Stellar Premium</h3><span class="premium-label">Activación automática · entrega por correo</span></span></div>
            <p>Desbloquea ventajas exclusivas y más flexibilidad para tus SubBots. Adquiere tu token desde nuestros canales oficiales y gestiona tus instancias desde un solo lugar.</p>
            <ul class="premium-perks"><li>${icon('check')} Acceso a funciones y comandos Premium</li><li>${icon('check')} Mayor prioridad y flexibilidad de servidor</li><li>${icon('check')} Cambios de servidor incluidos según tu plan</li><li>${icon('check')} Soporte prioritario</li></ul>
            <a class="btn btn-primary" href="/store" data-page="store">Ver Tokens Premium ${icon('arrow-right')}</a>
          </div>
          <div class="premium-includes"><h4>Métodos oficiales de compra</h4><div class="official-methods"><a class="official-method" href="https://patreon.com/StellarWa" target="_blank" rel="noreferrer"><span>${icon('gem')} Patreon</span><span>Visitar ↗</span></a><a class="official-method" href="https://ko-fi.com/StellarsWa" target="_blank" rel="noreferrer"><span>${icon('gift')} Ko-fi</span><span>Visitar ↗</span></a><a class="official-method" href="/store" data-page="store"><span>${icon('crown')} Tienda Stellar</span><span>Explorar →</span></a></div></div>
        </div>
      </section>

      <section class="section-block" id="stack">
        <div class="section-heading center"><span class="section-kicker">${icon('code')} Stack técnico</span><h2 class="section-title">Tecnología detrás de <span class="gradient-text">Stellar Wa</span></h2><p class="section-copy">Una arquitectura moderna para operar tus sesiones de WhatsApp desde la nube.</p></div>
        <div class="stack-grid"><article class="card stack-card"><span class="stack-symbol">JS</span><span><strong>Node.js</strong><small>Runtime</small></span></article><article class="card stack-card"><span class="stack-symbol">WA</span><span><strong>Baileys</strong><small>WhatsApp Multi-Device</small></span></article><article class="card stack-card"><span class="stack-symbol">☁</span><span><strong>Cloud</strong><small>Infraestructura multi-región</small></span></article></div>
      </section>

      <section class="section-block" id="faq">
        <div class="section-heading center"><span class="section-kicker">${icon('headset')} Preguntas frecuentes</span><h2 class="section-title">Respuestas <span class="gradient-text">sin vueltas</span></h2><p class="section-copy">Información clara para vincular tu número y gestionar tus bots.</p></div>
        <div class="faq-list">${questions}</div>
      </section>

      <section class="section-block landing-cta"><span class="section-kicker">${icon('bolt')} Empieza hoy</span><h2 style="margin-top:12px">Automatiza WhatsApp en minutos</h2><p>Vincula tu número, personaliza tu SubBot y empieza a usar los comandos. Sin servidor propio para comenzar.</p><div class="landing-actions"><a class="btn btn-primary btn-large" href="/home" data-page="home">Ir al Panel ${icon('arrow-right')}</a><a class="btn btn-outline btn-large" href="/store" data-page="store">Comprar Token ${icon('crown')}</a></div></section>
      <footer class="site-footer"><a class="site-footer-brand" href="/">${brandMarkup()}<span>Stellar Wa</span></a><span>© 2025–2026 Stellar The Best's Corp. Todos los derechos reservados.</span><div class="footer-links"><a href="#how">Cómo empezar</a><a href="#premium">Premium</a><a href="#faq">Soporte</a></div></footer>
    </div>`;
}

function renderMetricCard({ label, value, note, icon: iconName, indicator = false, color = '' }) {
  return `<article class="card card-hover metric-card"><span class="metric-label">${icon(iconName)}${escapeHtml(label)}</span>${indicator ? '<i class="metric-indicator"></i>' : ''}<strong class="metric-value ${color}">${escapeHtml(value)}</strong><span class="metric-note">${escapeHtml(note)}</span></article>`;
}

function renderHome() {
  const user = escapeHtml(state.apiUser?.username || 'Lyan');
  const personalBots = state.instances.length;
  const connectedBots = state.instances.filter((item) => item.status === 'open' || item.live || item.status === 'connected').length;
  const totalBots = state.stats?.totalBots ?? state.stats?.totalInstances ?? 201;
  const counts = [
    { label: 'Total Bots', value: formatNumber(totalBots), note: 'Activos en la plataforma', icon: 'bot', indicator: true },
    { label: 'Main', value: '7', note: 'Principales', icon: 'crown' },
    { label: 'Premium', value: '24', note: 'Exclusivos', icon: 'gem' },
    { label: 'Subs', value: '170', note: 'Multi-región', icon: 'server', indicator: true },
    { label: 'Usuarios', value: '0', note: 'En el sistema', icon: 'users' },
    { label: 'Comandos', value: String(state.health?.commands ?? 52), note: 'Disponibles', icon: 'code' },
  ];
  return `<div class="page-content">
    <section class="welcome-hero">
      <div class="welcome-copy"><span class="section-kicker">${icon('spark')} Información · Panel central</span><h1>Hola, <span class="gradient-text">${user}</span></h1><p>Qué gusto verte. Controla tus sesiones activas, gestiona tus SubBots y revisa el estado de Stellar desde un solo lugar.</p><div class="welcome-actions"><a class="btn btn-primary" href="/register" data-page="register">${icon('plus')} Registrar bot</a><a class="btn btn-outline" href="/bots" data-page="bots">${icon('bot')} Mis Bots</a></div></div>
      <div class="welcome-emblem" aria-hidden="true">${icon('spark')}</div>
    </section>

    <section class="info-banner"><span class="info-symbol">${icon('gem')}</span><div><h2>Sesión Premium</h2><p>Accede a respuestas más rápidas, funciones exclusivas y límites ampliados para tus SubBots. Consulta las opciones disponibles en la tienda.</p></div><a class="btn btn-primary btn-small" href="/store" data-page="store">Comprar token ${icon('arrow-right')}</a></section>

    <section class="section-block" style="margin-top:34px"><div class="section-heading"><div><span class="section-kicker">${icon('chart')} Resumen</span><h2 class="section-title">Tu plataforma, de un vistazo</h2><p class="section-copy">Métricas generales y estado de las sesiones.</p></div><button class="btn btn-outline btn-small" type="button" data-action="refresh-data">${icon('link')} Actualizar datos</button></div><div class="metrics-grid">${counts.map(renderMetricCard).join('')}</div></section>

    <section class="section-block"><div class="section-heading"><div><span class="section-kicker">${icon('bolt')} Accesos rápidos</span><h2 class="section-title">¿Qué quieres hacer?</h2></div></div><div class="shortcut-grid"><a class="card card-hover shortcut-card" href="/register" data-page="register"><span class="shortcut-icon">${icon('whatsapp')}</span><span><strong>Registrar un SubBot</strong><small>Vincula un número por QR o código</small></span><span class="shortcut-arrow">${icon('arrow-right')}</span></a><a class="card card-hover shortcut-card" href="/tickets" data-page="tickets"><span class="shortcut-icon">${icon('headset')}</span><span><strong>Abrir un ticket</strong><small>Contactar con soporte directo</small></span><span class="shortcut-arrow">${icon('arrow-right')}</span></a></div></section>

    <section class="section-block"><div class="section-heading"><div><span class="section-kicker">${icon('bot')} Tus sesiones</span><h2 class="section-title">Mis SubBots</h2><p class="section-copy">${personalBots ? `${personalBots} bots registrados · ${connectedBots} en línea` : 'Crea tu primera instancia y vincúlala con WhatsApp.'}</p></div><a class="btn btn-outline btn-small" href="/bots" data-page="bots">Ver todos ${icon('arrow-right')}</a></div>${personalBots ? `<div class="bot-list">${state.instances.slice(0,2).map(renderBotCard).join('')}</div>` : `<div class="premium-note">${icon('bulb')}<span><strong>Empieza en menos de dos minutos</strong><p>Elige una instancia, selecciona un servidor y vincula tu número con un código QR o un pairing code.</p></span></div>`}</section>

    <section class="section-block"><div class="section-heading"><div><span class="section-kicker">${icon('whatsapp')} Canales oficiales</span><h2 class="section-title">Siempre cerca de la comunidad</h2></div></div><div class="shortcut-grid"><a class="card card-hover shortcut-card" href="https://web.stellarwa.xyz/channel/api" target="_blank" rel="noreferrer"><span class="shortcut-icon">${icon('whatsapp')}</span><span><strong>Canal de WhatsApp</strong><small>Avisos sobre futuras actualizaciones</small></span><span class="shortcut-arrow">${icon('arrow-right')}</span></a><a class="card card-hover shortcut-card" href="/tickets" data-page="tickets"><span class="shortcut-icon">${icon('headset')}</span><span><strong>Abrir ticket</strong><small>Contactar soporte directo</small></span><span class="shortcut-arrow">${icon('arrow-right')}</span></a></div></section>

    <section class="section-block"><div class="section-heading"><div><span class="section-kicker">${icon('users')} Equipo</span><h2 class="section-title">Colaboradores</h2></div></div><div class="collaborator-row">${people.map((person) => `<article class="card card-hover collaborator-card"><span class="collaborator-avatar">${escapeHtml(person.initials)}</span><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.role)}</small></article>`).join('')}</div></section>
    ${pageFooter()}
  </div>`;
}

function renderBotCard(instance) {
  const status = String(instance.status || (instance.live ? 'open' : 'closed')).toLowerCase();
  const isOpen = status === 'open' || status === 'connected' || Boolean(instance.live);
  const isError = status === 'error' || status === 'loggedout';
  const statusClass = isError ? 'status-error' : (isOpen ? '' : 'status-offline');
  const label = isError ? 'Revisar' : (isOpen ? 'En línea' : 'Desconectado');
  const name = escapeHtml(instance.name || 'SubBot');
  const id = escapeHtml(instance.id || '');
  const phone = escapeHtml(instance.phoneMasked || instance.phone || 'Número oculto');
  const mode = instance.pairingMode === 'pairing' ? 'Código de 8 dígitos' : 'Código QR';
  return `<article class="card bot-card"><span class="bot-card-icon">${icon('bot')}</span><div class="bot-card-main"><div class="bot-card-title"><h3>${name}</h3><span class="status-badge ${statusClass}"><i class="pulse-dot"></i>${label}</span></div><p>${phone}</p><div class="bot-card-meta"><span>${icon('link')}${escapeHtml(mode)}</span><span>${icon('users')}${formatNumber(instance.groups || 0)} grupos</span><span>${icon('clock')}${instance.lastConnectedAt ? 'Conectado anteriormente' : 'Sesión creada'}</span></div></div><div class="bot-card-actions">${isOpen ? `<button class="btn btn-outline btn-small" type="button" data-action="stop-instance" data-id="${id}">Detener</button>` : `<button class="btn btn-primary btn-small" type="button" data-action="start-instance" data-id="${id}">Iniciar</button>`}<button class="btn btn-outline btn-small" type="button" data-action="link-instance" data-id="${id}" data-mode="${escapeHtml(instance.pairingMode || 'qr')}">Vincular</button></div></article>`;
}

function renderWizard() {
  const flow = state.flow;
  const step = flow.step;
  const regularStep = step >= 1 && step <= 5;
  let content = '';
  let title = '';
  let description = '';

  if (step === 0) {
    title = 'Verifica tu token';
    description = 'Ingresa el token de acceso recibido al suscribirte para continuar con una instancia Premium.';
    content = `<div class="wizard-form"><label class="field"><span class="field-label">Token de acceso</span><input class="text-input" type="text" name="flow-token" data-flow="token" value="${escapeHtml(flow.token)}" placeholder="STELLAR-XXXX-XXXX" autocomplete="off" /></label><span class="token-note">Verificaremos que el token esté disponible antes de habilitar la instancia. ¿Perdiste tu token? Puedes adquirir uno desde nuestras plataformas oficiales.</span><div class="token-links"><a class="token-link" href="https://patreon.com/StellarWa" target="_blank" rel="noreferrer">${icon('gem')} Patreon</a><a class="token-link" href="https://ko-fi.com/StellarsWa" target="_blank" rel="noreferrer">${icon('gift')} Ko-fi</a></div></div>`;
  } else if (step === 1) {
    title = 'Elige tu instancia';
    description = 'Selecciona el tipo de instancia que deseas activar.';
    const current = instanceType(flow.type);
    const options = [
      { id: 'free', label: 'SubBot Gratis', detail: 'Instancia gratuita básica', icon: 'bot', disabled: false },
      { id: 'main', label: 'Principal', detail: 'Requiere token de moderador', icon: 'shield', disabled: false },
      { id: 'premium', label: 'Premium', detail: 'Beneficios exclusivos', icon: 'gem', disabled: false },
    ];
    content = `<div class="wizard-form"><div class="field"><span class="field-label">Instancia</span><div class="instance-select-wrap"><button class="instance-select-trigger ${flow.typeListOpen ? 'is-expanded' : ''}" type="button" data-action="toggle-types"><span class="option-icon">${icon(current.icon)}</span><span class="option-copy"><strong>${escapeHtml(current.label)}</strong><small>${escapeHtml(current.detail)}</small></span>${icon('chevron')}</button>${flow.typeListOpen ? `<div class="instance-options" role="listbox">${options.map((option) => `<button class="instance-option ${flow.type === option.id ? 'is-selected' : ''} ${option.disabled ? 'is-disabled' : ''}" type="button" data-action="select-type" data-type="${option.id}" role="option" aria-selected="${flow.type === option.id}"><span class="option-icon ${option.id === 'free' ? '' : 'is-muted'}">${icon(option.icon)}</span><span class="option-copy"><strong>${escapeHtml(option.label)}</strong><small>${escapeHtml(option.detail)}</small></span></button>`).join('')}</div>` : ''}</div></div></div>`;
  } else if (step === 2) {
    title = 'Elige tu servidor';
    description = 'Selecciona el proveedor y el servidor donde correrá tu bot.';
    content = `<div class="wizard-form"><label class="field"><span class="field-label">Conexión</span><select class="select-input" name="flow-provider" data-flow="provider"><option value="stellar" ${flow.provider === 'stellar' ? 'selected' : ''}>Stellar Wa</option><option value="cloud" ${flow.provider === 'cloud' ? 'selected' : ''}>Stellar Cloud</option></select></label><label class="field"><span class="field-label">Servidor</span><select class="select-input" name="flow-server" data-flow="server"><option value="luffy" ${flow.server === 'luffy' ? 'selected' : ''}>● Stellar Srv Luffy (88/100)</option><option value="asuna" ${flow.server === 'asuna' ? 'selected' : ''}>● Stellar Srv Asuna (83/100)</option><option value="sakura" ${flow.server === 'sakura' ? 'selected' : ''}>● Stellar Srv Sakura (61/100)</option></select></label><span class="server-note">${icon('bulb')}Se muestran cupos disponibles. Los servidores llenos se deshabilitan automáticamente.</span></div>`;
  } else if (step === 3) {
    title = 'Vinculación';
    description = 'Ingresa el número del bot y elige cómo vincularlo.';
    const phoneValue = escapeHtml(flow.phone);
    content = `<div class="wizard-form"><label class="field"><span class="field-label">Número del bot</span><input class="text-input" type="tel" inputmode="tel" name="flow-phone" data-flow="phone" value="${phoneValue}" placeholder="+57 301 944 8245" autocomplete="tel" /><span class="field-hint">WhatsApp enviará el código de vinculación a este número.</span></label><div class="field"><span class="field-label">Cómo quieres vincularlo</span><div class="pairing-methods"><button class="pairing-option ${flow.pairingMode === 'qr' ? 'is-selected' : ''}" type="button" data-action="select-method" data-method="qr"><span class="pairing-option-icon">${icon('qr')}</span><span><strong>Código QR</strong><small>Escaneas un código desde el dispositivo del bot.</small></span></button><button class="pairing-option ${flow.pairingMode === 'pairing' ? 'is-selected' : ''}" type="button" data-action="select-method" data-method="pairing"><span class="pairing-option-icon">${icon('hash')}</span><span><strong>Código de 8 dígitos <span class="visually-hidden">Pairing code</span></strong><small>Lo escribes en el dispositivo del bot.</small></span></button></div></div></div>`;
  } else if (step === 4) {
    title = 'Nombre del bot';
    description = 'Ponle un nombre para identificar tu bot.';
    content = `<div class="wizard-form"><label class="field"><span class="field-label">Nombre / etiqueta</span><input class="text-input" type="text" name="flow-name" data-flow="name" value="${escapeHtml(flow.name)}" placeholder="Ej: Mi Bot Stellar" maxlength="42" autocomplete="off" /></label></div>`;
  } else if (step === 5) {
    title = flow.instanceId ? 'Vincula tu bot' : 'Vincula tu bot';
    description = flow.instanceId ? 'Sigue las instrucciones para conectar el número con WhatsApp.' : 'Presiona el botón para generar el código. Ten tu teléfono listo.';
    if (flow.loading) {
      content = `<div class="wizard-form"><div class="callout">${icon('link')}<span><strong>Preparando tu sesión…</strong><br />Conectando con el servidor elegido. Mantén abierta esta página mientras se genera el método de vinculación.</span></div><div class="loading-panel"><span class="loading-spinner"></span><span>Iniciando instancia</span></div></div>`;
    } else if (flow.instanceId && flow.linkData) {
      const link = flow.linkData;
      const connected = ['open', 'connected'].includes(String(link.status || '').toLowerCase());
      let linkMarkup = '';
      if (flow.pairingMode === 'qr' && link.qrDataUrl) {
        linkMarkup = `<div class="qr-frame"><img src="${escapeHtml(link.qrDataUrl)}" alt="Código QR de WhatsApp para vincular el bot" /></div><span class="expiry-label">Expira en 120s</span>`;
      } else if (link.pairingFormatted || link.pairingCode) {
        const code = String(link.pairingFormatted || link.pairingCode).replaceAll('-', '').slice(0, 8).padEnd(8, '•');
        linkMarkup = `<div class="pairing-code-display" aria-label="Código ${escapeHtml(code)}">${code.slice(0, 4).split('').map((char) => `<span>${escapeHtml(char)}</span>`).join('')}<b>–</b>${code.slice(4).split('').map((char) => `<span>${escapeHtml(char)}</span>`).join('')}</div><button class="btn btn-outline btn-full" type="button" data-action="copy-pairing-code" data-code="${escapeHtml(link.pairingFormatted || link.pairingCode)}">${icon('copy')} Copiar código</button><span class="expiry-label">Expira en 60s</span>`;
      } else {
        linkMarkup = `<div class="link-error">${icon('link')} ${escapeHtml(link.lastError || 'Aún no recibimos el código del servidor. Puedes volver a intentarlo en unos segundos.')}</div>`;
      }
      content = `<div class="wizard-form"><div class="callout">${icon('bulb')}<span>Desde el teléfono que será el bot, abre WhatsApp y sigue los pasos de vinculación.</span></div><div class="link-code-card">${linkMarkup}${connected ? '<span class="status-badge"><i class="pulse-dot"></i> Sesión en línea</span>' : ''}</div><ol class="instruction-list"><li><span class="instruction-number">1</span><span>Abre WhatsApp en el teléfono del bot.</span></li><li><span class="instruction-number">2</span><span>En Android toca <strong>Menú ⋮</strong>; en iPhone, <strong>Ajustes</strong>.</span></li><li><span class="instruction-number">3</span><span>Entra en <strong>Dispositivos vinculados</strong> y toca <strong>Vincular dispositivo</strong>.</span></li><li><span class="instruction-number">4</span><span>${flow.pairingMode === 'qr' ? 'Apunta la cámara al código QR.' : 'Toca Vincular con el número de teléfono e ingresa el código.'}</span></li></ol></div>`;
    } else {
      content = `<div class="wizard-form"><div class="callout">${icon('bulb')}<span>Asegúrate de tener WhatsApp abierto en el dispositivo donde quieres que corra el bot.</span></div></div>`;
    }
  } else if (step === 6) {
    title = 'Tu bot ya está en línea';
    description = 'La instancia está lista para continuar.';
    content = `<div class="success-panel"><span class="success-icon">${icon('check')}</span><h2>¡Listo!</h2><p>Escríbele <strong>#menu</strong> en un grupo para ver todo lo que puede hacer. Ya puedes administrar tu sesión desde Mis Bots.</p><div class="wizard-actions"><button class="btn btn-outline" type="button" data-action="reset-flow">Crear otro</button><button class="btn btn-primary" type="button" data-page="bots">Ir a Mis Bots ${icon('arrow-right')}</button></div></div>`;
  }

  const progress = regularStep ? `<div class="stepper" aria-label="Paso ${step} de 5"><span class="stepper-track"><span class="stepper-fill" style="width:${((step - 1) / 4) * 100}%"></span></span>${[1,2,3,4,5].map((numberStep) => `<span class="stepper-item ${numberStep === step ? 'is-active' : ''} ${numberStep < step ? 'is-complete' : ''}" aria-current="${numberStep === step ? 'step' : 'false'}">${numberStep < step ? icon('check') : numberStep}</span>`).join('')}</div>` : '';
  const stepLabel = step === 6 ? 'COMPLETADO' : (step === 0 ? 'TOKEN PREMIUM' : `PASO ${step}`);
  let actionButtons = '';
  if (step === 1) {
    actionButtons = `<div class="wizard-actions is-single"><button class="btn btn-primary" type="button" data-action="wizard-next">Continuar ${icon('arrow-right')}</button></div>`;
  } else if (step >= 2 && step <= 5) {
    if (step === 5 && flow.instanceId) {
      actionButtons = '';
    } else {
      const nextLabel = step === 5 ? 'Generar vinculación' : 'Continuar';
      const nextAction = step === 5 ? 'generate-link' : 'wizard-next';
      actionButtons = `<div class="wizard-actions"><button class="btn btn-outline" type="button" data-action="wizard-back">${icon('arrow-left')} Atrás</button><button class="btn btn-primary" type="button" data-action="${nextAction}" ${flow.loading ? 'disabled' : ''}>${step === 5 ? icon('link') : ''}${nextLabel} ${step === 5 ? '' : icon('arrow-right')}</button></div>`;
    }
  } else if (step === 0) {
    actionButtons = `<div class="wizard-actions"><button class="btn btn-outline" type="button" data-action="wizard-back">${icon('arrow-left')} Atrás</button><button class="btn btn-primary" type="button" data-action="verify-token">Verificar token ${icon('arrow-right')}</button></div>`;
  } else if (step === 6) {
    actionButtons = '';
  }
  const flowError = flow.error ? `<p class="link-error" role="alert">${escapeHtml(flow.error)}</p>` : '';
  return `<div class="page-content"><div class="wizard-wrap">${progress}<section class="wizard-card wizard-step-${step}" aria-labelledby="wizard-title"><span class="wizard-step-label">${stepLabel}</span><h1 class="wizard-title" id="wizard-title">${escapeHtml(title)}</h1><p class="wizard-description">${escapeHtml(description)}</p>${content}${flowError}${actionButtons}${step === 5 && flow.instanceId ? `<div class="wizard-actions"><button class="btn btn-outline" type="button" data-action="wizard-back">${icon('arrow-left')} Cambiar datos</button><button class="btn btn-primary" type="button" data-action="refresh-link">Reintentar ${icon('arrow-right')}</button></div>` : ''}</section><p class="wizard-footer-note">© 2026 <span class="purple">Stellar The Best's Corp.</span> All rights reserved.</p>${pageFooter()}</div></div>`;
}

function renderBots() {
  const instances = state.instances;
  const connected = instances.filter((instance) => instance.status === 'open' || instance.live || instance.status === 'connected').length;
  return `<div class="page-content"><div class="page-heading"><div><span class="section-kicker">${icon('bot')} Sesiones</span><h1>Mis Bots</h1><p>Gestiona tus sesiones activas, consulta su estado y vincula nuevos números.</p></div><div class="page-heading-actions"><button class="btn btn-outline" type="button" data-action="open-admin-login">${icon(state.adminToken ? 'check' : 'lock')}${state.adminToken ? 'Panel conectado' : 'Conectar panel'}</button><a class="btn btn-primary" href="/register" data-page="register">${icon('plus')} Crear Bot</a></div></div>
    <div class="bots-summary"><article class="card summary-tile"><span>Bots registrados</span><strong>${instances.length || '0'}</strong></article><article class="card summary-tile"><span>Activos</span><strong class="green">${connected}</strong></article><article class="card summary-tile"><span>Límite de instancias</span><strong>${state.me?.limits?.maxInstances ?? 3}</strong></article></div>
    ${instances.length ? `<div class="bot-list">${instances.map(renderBotCard).join('')}</div>` : `<div class="empty-state"><span class="empty-state-icon">${icon('bot')}</span><h2>No tienes bots registrados aún</h2><p>Vincula tu primer número de WhatsApp para comenzar. Puedes usar un código QR o un pairing code de 8 dígitos.</p><button class="btn btn-primary" type="button" data-page="register">${icon('plus')} Crear Bot</button>${state.authRequired ? `<button class="btn btn-quiet btn-small" type="button" style="margin-top:9px" data-action="open-admin-login">Iniciar sesión en el panel</button>` : ''}</div>`}
    ${pageFooter()}</div>`;
}

function chartMarkup() {
  return `<svg class="chart-svg" viewBox="0 0 700 230" role="img" aria-label="Gráfico de solicitudes recientes"><defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#9a5df3" stop-opacity=".35"/><stop offset="1" stop-color="#9a5df3" stop-opacity="0"/></linearGradient></defs><path class="chart-grid" d="M40 25H690M40 70H690M40 115H690M40 160H690M40 205H690M40 25V205M170 25V205M300 25V205M430 25V205M560 25V205M690 25V205"/><path class="chart-area" d="M40 190 95 190 123 175 154 175 200 175 226 149 264 149 290 150 326 122 360 122 385 124 410 92 444 92 475 92 501 68 528 68 556 53 585 53 606 41 632 43 655 27 690 21V205H40Z"/><path class="chart-line" d="M40 190 95 190 123 175 154 175 200 175 226 149 264 149 290 150 326 122 360 122 385 124 410 92 444 92 475 92 501 68 528 68 556 53 585 53 606 41 632 43 655 27 690 21"/><circle class="chart-dot" cx="655" cy="27" r="6"/></svg>`;
}

function serviceRow(name, uptime, down = false) {
  const bars = Array.from({ length: 24 }, (_unused, index) => `<i class="${down && index > 19 ? 'down' : ''}"></i>`).join('');
  return `<div class="service-row"><span class="service-info"><span class="${down ? 'health-x' : 'green'}">${down ? '×' : '●'}</span>${escapeHtml(name)}</span><span class="${down ? '' : 'green'} mono">${escapeHtml(uptime)}</span><span class="service-health">${bars}</span><span class="service-meta"><span>hace 30 días</span><span>Hoy</span></span></div>`;
}

function renderMetrics() {
  const requests = state.stats?.messages ?? state.stats?.totalRequests ?? 204271;
  const serverCards = [
    { label: 'Uptime', value: state.health?.uptime || '0:21:59:29', note: 'Sin interrupciones', icon: 'clock' },
    { label: 'Latencia', value: '1331 ms', note: 'Ping al servidor', icon: 'bolt', indicator: true },
    { label: 'Requests', value: formatNumber(requests), note: 'Total registrado', icon: 'server', indicator: true },
    { label: 'Instancias', value: String(state.instances.length || 3), note: 'Configuradas en el panel', icon: 'bot' },
    { label: 'CPU', value: '4.00%', note: '4 cores · Intel Core', icon: 'cpu', progress: 4 },
    { label: 'RAM', value: '58.09%', note: '4.73 GB / 8.14 GB', icon: 'server', progress: 58, green: true },
    { label: 'Disco', value: '22%', note: '16 GB / 74 GB', icon: 'server', progress: 22 },
    { label: 'Usuarios', value: '575', note: 'Registrados', icon: 'users' },
  ];
  return `<div class="page-content"><div class="page-heading"><div><span class="section-kicker">${icon('chart')} Monitor del sistema</span><h1>Telemetría y Rendimiento</h1><p>Estado de las instancias, disponibilidad y uso de recursos en tiempo real.</p></div><button class="btn btn-outline btn-small" type="button" data-action="refresh-data">${icon('link')} Actualizar</button></div>
    <div class="metrics-grid metrics-grid-large">${serverCards.map((metric) => `<article class="card telemetry-card"><span class="metric-label">${icon(metric.icon)}${escapeHtml(metric.label)}</span>${metric.indicator ? '<i class="metric-indicator"></i>' : ''}<strong class="metric-value">${escapeHtml(metric.value)}</strong><span class="metric-note">${escapeHtml(metric.note)}</span>${metric.progress != null ? `<div class="progress-track"><div class="progress-value ${metric.green ? 'green-fill' : ''}" style="width:${metric.progress}%"></div></div>` : ''}</article>`).join('')}</div>
    <section class="card chart-card"><div class="chart-card-header"><strong>${icon('chart')} Requests en tiempo real</strong><span>Actualización en vivo</span></div>${chartMarkup()}</section>
    <section class="section-block"><div class="section-heading"><div><span class="section-kicker">${icon('server')} Servicios</span><h2 class="section-title">Estado de Servicios</h2></div></div><div class="card service-list">${serviceRow('api.stellarwa.xyz','99.9%')}${serviceRow('web.stellarwa.xyz','99.9%')}${serviceRow('Base de Datos','99.99%')}</div></section>
    <section class="section-block"><div class="section-heading"><div><span class="section-kicker">${icon('bolt')} Más usados</span><h2 class="section-title">Top Endpoints</h2></div></div><div class="card ranking-list">${['/sfw/interaction?inter=','/dl/ytmp3?url=','/nsfw/interaction?inter=','/search/yt?query='].map((path,index) => `<div class="ranking-row"><span class="rank-number">#${index+1}</span><span><code>${path}</code><span class="ranking-bar-wrap"><i class="ranking-bar" style="display:block;width:${100-index*18}%"></i></span></span><strong class="mono">${['34.882','30.288','10.741','7.019'][index]}</strong></div>`).join('')}</div></section>${pageFooter()}</div>`;
}

function renderStore() {
  const plans = state.apiPlans?.length ? state.apiPlans : fallbackPlans;
  const multipliers = state.storePeriod === 'bimonthly' ? 1.8 : 1;
  const currency = state.storeCurrency || 'USD';
  const symbols = { USD: '$', EUR: '€', ARS: '$' };
  const cards = plans.map((plan, index) => {
    const palette = ['#9b5cf6', '#a05cf3', '#f0b62b', '#e4548b'][index % 4];
    const price = number(plan.price, 0) * multipliers;
    const features = Array.isArray(plan.features) ? plan.features : [];
    return `<article class="card plan-card ${plan.popular ? 'is-popular' : ''}" style="--plan-color:${palette}">${plan.popular ? '<span class="plan-ribbon">MÁS POPULAR</span>' : ''}<div class="plan-head"><span class="plan-icon">${icon(index === 0 ? 'bolt' : index === 1 ? 'gem' : index === 2 ? 'crown' : 'briefcase')}</span><span><span class="plan-name"><h2>${escapeHtml(plan.name)}</h2><span class="plan-tier">${escapeHtml(plan.name)}</span></span></span></div><div class="plan-users">${index === 0 ? '552 usuarios' : `${index * 2 + 1} usuarios activos`}</div><p class="plan-description">${escapeHtml(features[0] || 'Más potencia y flexibilidad para tus proyectos.')}</p><ul class="plan-features"><li><span class="plan-feature-icon">${icon('bolt')}</span><span><strong>${formatNumber(plan.credits)}</strong> créditos</span></li>${features.slice(1,4).map((feature, featureIndex) => `<li><span class="plan-feature-icon">${icon(['lock','clock','server'][featureIndex])}</span><span>${escapeHtml(feature)}</span></li>`).join('')}</ul><div class="plan-price"><span>${price === 0 ? 'Gratis' : `${symbols[currency] || '$'}${price.toFixed(2)}`}</span>${price > 0 ? `<small>${currency}</small>` : ''}</div><button class="btn btn-primary btn-full" type="button" data-action="purchase-plan" data-plan="${escapeHtml(plan.id || plan.name.toLowerCase())}">${price === 0 ? 'Plan gratuito' : 'Contratar'}</button></article>`;
  }).join('');
  return `<div class="page-content"><section class="store-hero"><span class="section-kicker">${icon('spark')} Compra tu Token Premium</span><h1>Hola, <span class="gradient-text">${escapeHtml(state.apiUser?.username || 'bienvenido')}</span></h1><p>Adquiere créditos y desbloquea más posibilidades para tus proyectos. Los planes y precios se actualizan desde el panel.</p><div class="store-controls"><div class="segment-control" aria-label="Periodo de facturación"><button type="button" class="${state.storePeriod === 'monthly' ? 'is-active' : ''}" data-action="set-period" data-period="monthly">Mensual</button><button type="button" class="${state.storePeriod === 'bimonthly' ? 'is-active' : ''}" data-action="set-period" data-period="bimonthly">Bimestral</button></div><div class="segment-control" aria-label="Moneda"><button type="button" class="${currency === 'USD' ? 'is-active' : ''}" data-action="set-currency" data-currency="USD">🇺🇸 USD</button><button type="button" class="${currency === 'EUR' ? 'is-active' : ''}" data-action="set-currency" data-currency="EUR">🇪🇺 EUR</button></div></div></section><div class="plan-grid">${cards}</div><form class="coupon-inline" id="store-coupon-form"><input class="text-input" type="text" name="coupon" placeholder="¿Tienes un código de regalo?" autocomplete="off"/><button class="btn btn-outline" type="submit">${icon('gift')} Canjear</button></form><p class="field-hint" id="store-coupon-message" style="text-align:center"></p>${pageFooter()}</div>`;
}

function allEndpoints() { return (state.endpoints || []).flatMap((category) => (category.items || []).map((endpoint) => ({ ...endpoint, category: category.name, categoryIcon: category.icon }))); }
function filteredEndpoints() {
  let items = allEndpoints();
  const query = state.endpointQuery.trim().toLowerCase();
  if (query) items = items.filter((endpoint) => `${endpoint.name} ${endpoint.path} ${endpoint.description} ${endpoint.category}`.toLowerCase().includes(query));
  if (state.endpointMethod !== 'all') items = items.filter((endpoint) => String(endpoint.method).toLowerCase() === state.endpointMethod);
  if (state.endpointTier !== 'all') items = items.filter((endpoint) => endpoint.tier === state.endpointTier);
  if (state.endpointCategory !== 'all') items = items.filter((endpoint) => endpoint.category === state.endpointCategory);
  if (state.view === 'favorites') items = items.filter((endpoint) => state.favorites.includes(endpoint.path));
  items.sort((a, b) => state.endpointSort === 'za' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name));
  return items;
}
function renderEndpointRows(items) {
  if (!items.length) return '<div class="endpoint-empty">No se encontraron endpoints con esos filtros.</div>';
  return items.map((endpoint) => {
    const tier = endpoint.tier === 'premium' ? 'premium' : endpoint.tier === 'hybrid' ? 'hybrid' : '';
    const tierLabel = endpoint.tier === 'premium' ? 'Premium' : endpoint.tier === 'hybrid' ? 'Híbrido' : 'Free';
    const isFavorite = state.favorites.includes(endpoint.path);
    return `<div class="endpoint-row" role="button" tabindex="0" data-action="open-endpoint" data-path="${escapeHtml(endpoint.path)}"><span class="endpoint-row-main"><strong>${escapeHtml(endpoint.name)}</strong><code>${escapeHtml(endpoint.path)}</code></span><span class="method-badge">${escapeHtml(endpoint.method || 'GET')}</span><span class="endpoint-row-side"><span class="tier-badge ${tier}">${tierLabel}</span><button class="favorite-button ${isFavorite ? 'is-favorite' : ''}" type="button" data-action="toggle-favorite" data-path="${escapeHtml(endpoint.path)}" aria-label="${isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}">${icon('star')}</button></span></div>`;
  }).join('');
}
function renderEndpointResults() {
  const results = $('#endpoint-results');
  if (!results) return;
  const filtered = filteredEndpoints();
  const groups = new Map();
  for (const endpoint of filtered) {
    if (!groups.has(endpoint.category)) groups.set(endpoint.category, []);
    groups.get(endpoint.category).push(endpoint);
  }
  if (state.endpointCategory !== 'all' && !groups.has(state.endpointCategory)) {
    results.innerHTML = '<div class="endpoint-empty card">No se encontraron endpoints con esos filtros.</div>';
    return;
  }
  results.innerHTML = groups.size ? [...groups.entries()].map(([category, items]) => {
    const isOpen = state.openCategories.has(category) || Boolean(state.endpointQuery) || state.view === 'favorites';
    const original = state.endpoints.find((entry) => entry.name === category);
    const categoryIcon = original?.icon || items[0]?.categoryIcon || '✦';
    const count = state.endpointQuery || state.endpointMethod !== 'all' || state.endpointTier !== 'all' ? items.length : (original?.count || items.length);
    return `<section class="endpoint-category ${isOpen ? 'is-open' : ''}"><div class="endpoint-category-head" data-action="toggle-category" data-category="${escapeHtml(category)}" role="button" tabindex="0"><span class="endpoint-category-title"><span aria-hidden="true">${escapeHtml(categoryIcon)}</span><strong>${escapeHtml(category)}</strong><span class="endpoint-count">${count}/${original?.count || count}</span></span>${icon('chevron')}</div>${isOpen ? `<div class="endpoint-items">${renderEndpointRows(items)}</div>` : ''}</section>`;
  }).join('') : '<div class="endpoint-empty card">No se encontraron endpoints con esos filtros.</div>';
  const countText = $('#endpoint-result-count');
  if (countText) countText.textContent = `${formatNumber(filtered.length)} endpoint${filtered.length === 1 ? '' : 's'}`;
}
function renderEndpoints() {
  const isFavorites = state.view === 'favorites';
  return `<div class="page-content"><div class="page-heading"><div><span class="section-kicker">${icon('code')} Catálogo</span><h1>${isFavorites ? 'Tus Favoritos' : 'Endpoints'}</h1><p>${isFavorites ? 'Accesos rápidos a los endpoints que guardaste.' : 'Explora las APIs disponibles, filtra por categoría o busca por nombre.'}</p></div><a class="btn btn-outline btn-small" href="/favorites" data-page="favorites">${icon('star')} Favoritos (${state.favorites.length})</a></div>
    <div class="catalog-toolbar"><label class="search-box">${icon('search')}<input id="endpoint-search" class="text-input" type="search" value="${escapeHtml(state.endpointQuery)}" placeholder="Buscar endpoint… (ej: Spotify, TikTok, AI)" autocomplete="off" /></label><div class="filter-row"><button class="filter-chip ${state.endpointMethod === 'all' ? 'is-active' : ''}" type="button" data-action="endpoint-method" data-method="all">Todos</button>${['get','post','put','delete','patch'].map((method) => `<button class="filter-chip ${state.endpointMethod === method ? 'is-active' : ''}" type="button" data-action="endpoint-method" data-method="${method}">${method}</button>`).join('')}</div><div class="category-select-row"><select id="endpoint-category" class="select-input" aria-label="Categoría">${['all', ...state.endpoints.map((category) => category.name)].map((category) => `<option value="${escapeHtml(category)}" ${state.endpointCategory === category ? 'selected' : ''}>${category === 'all' ? 'Todas las categorías' : escapeHtml(category)}</option>`).join('')}</select><div class="filter-row"><button class="filter-chip ${state.endpointTier === 'all' ? 'is-active' : ''}" type="button" data-action="endpoint-tier" data-tier="all">Todos</button><button class="filter-chip ${state.endpointTier === 'free' ? 'is-active' : ''}" type="button" data-action="endpoint-tier" data-tier="free">Free</button><button class="filter-chip ${state.endpointTier === 'premium' ? 'is-active' : ''}" type="button" data-action="endpoint-tier" data-tier="premium">Premium</button><button class="filter-chip ${state.endpointTier === 'hybrid' ? 'is-active' : ''}" type="button" data-action="endpoint-tier" data-tier="hybrid">Híbrido</button></div></div></div>
    <div class="section-heading" style="margin-bottom:12px"><span class="muted small" id="endpoint-result-count">${formatNumber(allEndpoints().length)} endpoints</span><button class="filter-chip" type="button" data-action="endpoint-sort">${state.endpointSort === 'az' ? 'A–Z' : 'Z–A'} ${icon('chart')}</button></div><div id="endpoint-results" class="catalog-categories"></div>${pageFooter()}</div>`;
}

function endpointByPath(path) { return allEndpoints().find((endpoint) => endpoint.path === path); }
function endpointParam(endpoint) {
  const route = `${endpoint?.path || ''} ${endpoint?.name || ''}`.toLowerCase();
  if (/search|lyrics|translate|stickerly/.test(route)) return { name: 'Consulta', placeholder: 'Ingresa tu búsqueda…', key: 'query' };
  if (/tools|generate|image|waifu/.test(route)) return { name: 'Texto / consulta', placeholder: 'Ingresa el texto o parámetro…', key: 'text' };
  return { name: 'Enlace / archivo', placeholder: 'https://…', key: 'url' };
}
function codeSnippet(endpoint, tab = state.endpointCodeTab) {
  const url = `https://api.stellarwa.xyz${endpoint.path}${state.endpointWithKey ? '?key=TU_API_KEY' : ''}`;
  const method = String(endpoint.method || 'GET').toUpperCase();
  if (tab === 'javascript') return `const response = await fetch("${url}", {\n  method: "${method}",\n  headers: { "Content-Type": "application/json" }\n});\nconst data = await response.json();\nconsole.log(data);`;
  if (tab === 'typescript') return `const response = await fetch("${url}", {\n  method: "${method}",\n  headers: { "Content-Type": "application/json" }\n});\nconst data: unknown = await response.json();\nconsole.log(data);`;
  if (tab === 'python') return `import requests\n\nresponse = requests.${method.toLowerCase()}(\n    "${url}",\n    headers={"Content-Type": "application/json"}\n)\nprint(response.json())`;
  return `curl -X ${method} "${url}" \\\n  -H "Content-Type: application/json"`;
}
function renderEndpointModal(endpoint) {
  if (!endpoint) return;
  state.selectedEndpoint = endpoint;
  const param = endpointParam(endpoint);
  const path = `${endpoint.path}${state.endpointWithKey ? '?key=api-VX9xd' : ''}`;
  $('#endpoint-modal').innerHTML = `<div class="endpoint-modal-head"><span class="bot-orb">${icon('code')}</span><span><h2 id="endpoint-modal-title">${escapeHtml(endpoint.name)}</h2><p>${escapeHtml(endpoint.description || endpoint.path)}</p></span><div class="endpoint-modal-actions"><button class="icon-button" type="button" data-action="copy-endpoint-url" aria-label="Copiar URL">${icon('link')}</button><button class="icon-button" type="button" data-action="close-endpoint" aria-label="Cerrar">${icon('close')}</button></div></div><div class="endpoint-modal-body"><section class="endpoint-url-box"><div class="endpoint-url-label"><span>${icon('bolt')} Endpoint URL</span><button class="key-switch ${state.endpointWithKey ? 'is-on' : ''}" type="button" data-action="toggle-endpoint-key"><span>Con key</span><i></i></button></div><div class="endpoint-url-line"><span class="method-badge">${escapeHtml(endpoint.method || 'GET')}</span><code id="endpoint-url-text">https://api.stellarwa.xyz${escapeHtml(path)}</code><button class="icon-button" type="button" data-action="copy-endpoint-url" aria-label="Copiar URL">${icon('copy')}</button><a class="icon-button" href="https://api.stellarwa.xyz${escapeHtml(path)}" target="_blank" rel="noreferrer" aria-label="Abrir endpoint">${icon('external')}</a></div></section><div><span class="endpoint-url-label">Código de ejemplo</span><div class="code-tabs">${[['curl','cURL'],['javascript','JavaScript'],['typescript','TypeScript'],['python','Python']].map(([key,label]) => `<button class="${state.endpointCodeTab === key ? 'is-active' : ''}" type="button" data-action="endpoint-code-tab" data-tab="${key}">${label}</button>`).join('')}</div></div><section class="code-window"><div class="code-window-top"><span><i class="traffic-lights"><i></i><i></i><i></i></i> example.${state.endpointCodeTab === 'python' ? 'py' : state.endpointCodeTab === 'curl' ? 'sh' : 'js'}</span><button class="btn btn-outline btn-small" type="button" data-action="copy-endpoint-code">${icon('copy')} Copiar</button></div><pre><code>${escapeHtml(codeSnippet(endpoint))}</code></pre></section><form id="endpoint-playground-form" class="endpoint-params"><h3>${icon('chart')} Parámetros de entrada</h3><label class="field"><span class="field-label">${escapeHtml(param.name)} <span class="red">*</span></span><input class="text-input" name="endpoint-value" required placeholder="${escapeHtml(param.placeholder)}" /></label><button class="btn btn-primary btn-full" type="submit">${icon('bolt')} Realizar petición</button><p class="field-hint" id="endpoint-playground-message">Prueba visual del formulario. Las llamadas al catálogo externo no se ejecutan desde este panel.</p></form></div>`;
  $('#endpoint-layer').hidden = false;
  document.body.classList.add('modal-open');
}

function renderTickets() {
  const tickets = state.viewTickets || [];
  const open = tickets.filter((ticket) => ticket.status !== 'Cerrado').length;
  const answered = tickets.filter((ticket) => ticket.status === 'Respondido').length;
  const closed = tickets.filter((ticket) => ticket.status === 'Cerrado').length;
  const rows = tickets.length ? tickets.map((ticket) => `<article class="ticket-row"><span class="drawer-item-icon">${icon('ticket')}</span><span><strong>${escapeHtml(ticket.title)}</strong><small class="muted">${escapeHtml(ticket.id)} · ${escapeHtml(ticket.date)}</small></span><span class="status-badge ${ticket.status === 'Cerrado' ? 'status-offline' : ''}">${escapeHtml(ticket.status)}</span></article>`).join('') : `<div class="ticket-empty">${icon('search')}<strong>No hay coincidencias</strong><p>Cuando abras un ticket, podrás revisar su historial y seguimiento aquí.</p></div>`;
  return `<div class="page-content"><section class="ticket-hero"><div><span class="section-kicker">${icon('headset')} Soporte 24/7 · Empresarial</span><h1>Centro de Tickets</h1><p>Reporta incidencias, consulta estados y conversa con nuestro equipo de soporte.</p></div><button class="btn btn-primary btn-large" type="button" data-action="toggle-ticket-form">${icon('plus')} Nuevo ticket</button></section><div class="ticket-stats"><article class="card ticket-stat"><span class="stat-icon">${icon('ticket')}</span><strong>${tickets.length}</strong><span>Total</span></article><article class="card ticket-stat"><span class="stat-icon" style="color:var(--blue);background:rgba(85,169,255,.12)">${icon('folder')}</span><strong class="blue">${open}</strong><span>Abiertos</span></article><article class="card ticket-stat"><span class="stat-icon" style="color:var(--yellow);background:rgba(244,189,56,.12)">${icon('users')}</span><strong class="yellow">${answered}</strong><span>Respondidos</span></article><article class="card ticket-stat"><span class="stat-icon" style="color:var(--green);background:var(--green-tint)">${icon('check')}</span><strong class="green">${closed}</strong><span>Cerrados</span></article></div>${state.newTicketOpen ? `<form id="ticket-form" class="card profile-card" style="margin-bottom:18px"><h2>Crear un ticket</h2><div class="wizard-form"><label class="field"><span class="field-label">Asunto</span><input class="text-input" name="ticket-title" required maxlength="90" placeholder="Describe brevemente tu consulta" /></label><label class="field"><span class="field-label">Mensaje</span><textarea class="text-area" name="ticket-message" required maxlength="1200" placeholder="Cuéntanos qué ocurrió…"></textarea></label><div class="page-heading-actions"><button class="btn btn-outline" type="button" data-action="toggle-ticket-form">Cancelar</button><button class="btn btn-primary" type="submit">Enviar ticket ${icon('arrow-right')}</button></div></div></form>` : ''}<section class="section-block" style="margin-top:0"><div class="section-heading"><div><span class="section-kicker">${icon('ticket')} Historial</span><h2 class="section-title">Mis solicitudes</h2><p class="section-copy">Historial y seguimiento de tus consultas.</p></div></div><div class="ticket-toolbar"><label class="search-box">${icon('search')}<input class="text-input" id="ticket-search" type="search" placeholder="Buscar…" /></label><button class="btn btn-outline" type="button" data-action="toggle-ticket-form">${icon('plus')} Crear</button></div><div class="card" id="ticket-list">${rows}</div></section>${pageFooter()}</div>`;
}

function renderProfile() {
  const hasAdmin = Boolean(state.adminToken);
  const user = state.apiUser;
  return `<div class="page-content"><div class="page-heading"><div><span class="section-kicker">${icon('users')} Cuenta</span><h1>Mi Perfil</h1><p>Gestiona tu cuenta, las credenciales y el acceso a tu panel.</p></div></div><div class="profile-grid"><section class="card profile-card"><h2>Cuenta de Stellar</h2>${user ? `<div class="profile-details"><div class="profile-detail"><span>Usuario</span><strong>${escapeHtml(user.username || '—')}</strong></div><div class="profile-detail"><span>Email</span><strong>${escapeHtml(user.email || '—')}</strong></div><div class="profile-detail"><span>Plan</span><strong>${escapeHtml(user.plan || 'Free')}</strong></div><div class="profile-detail"><span>Créditos</span><strong>${formatNumber(user.credits || 0)}</strong></div></div><p class="field-hint" style="margin-top:16px">Tu API key es privada. No la compartas en repositorios públicos.</p>` : `<p class="section-copy" style="font-size:13px">Inicia sesión o crea una cuenta para consultar créditos, guardar favoritos y ver tus transacciones.</p><button class="btn btn-primary" type="button" data-action="open-api-auth">${icon('users')} Iniciar sesión</button>`}</section><section class="card profile-card"><h2>Panel privado</h2><div class="profile-details"><div class="profile-detail"><span>Estado</span><strong class="${hasAdmin ? 'green' : ''}">${hasAdmin ? 'Conectado' : state.authRequired ? 'Requiere acceso' : 'No conectado'}</strong></div><div class="profile-detail"><span>Producto</span><strong>${escapeHtml(state.me?.bot?.name || 'Stellar Wa')}</strong></div><div class="profile-detail"><span>Equipo</span><strong>${escapeHtml(state.me?.bot?.team || 'VÉRSOVA')}</strong></div><div class="profile-detail"><span>Instancias máximas</span><strong>${state.me?.limits?.maxInstances ?? 3}</strong></div></div><button class="btn ${hasAdmin ? 'btn-outline' : 'btn-primary'}" type="button" style="margin-top:16px" data-action="${hasAdmin ? 'logout-admin' : 'open-admin-login'}">${icon(hasAdmin ? 'close' : 'lock')}${hasAdmin ? 'Cerrar sesión del panel' : 'Conectar panel privado'}</button></section>${user ? `<section class="card profile-card"><h2>Tu API Key</h2><div class="profile-key"><code>${escapeHtml(user.apiKey || user.api_key || '—')}</code><button class="icon-button" type="button" data-action="copy-api-key" aria-label="Copiar API key">${icon('copy')}</button></div></section><section class="card profile-card"><h2>Créditos</h2><p class="section-copy" style="font-size:13px">Balance actual: <strong class="purple">${formatNumber(user.credits || 0)}</strong></p><a class="btn btn-primary" href="/store" data-page="store">Ver tienda ${icon('arrow-right')}</a></section>` : ''}</div>${pageFooter()}</div>`;
}

const commandExamples = [
  { group: 'Información', names: ['menu', 'help', 'ping', 'botinfo', 'owner'] },
  { group: 'Registro', names: ['reg', 'unreg', 'editar', 'ficha'] },
  { group: 'Personajes', names: ['rol', 'cambiarol', 'roles', 'mirol', 'reservar'] },
  { group: 'Gestión', names: ['team', 'miembros', 'afk', 'afks', 'inactivos'] },
  { group: 'Administración', names: ['add', 'expulsar', 'ban', 'unban', 'warn', 'pendientes'] },
];
function renderCommands() {
  return `<div class="page-content"><div class="page-heading"><div><span class="section-kicker">${icon('code')} Referencia</span><h1>Comandos</h1><p>Comandos disponibles para tu SubBot. El prefijo predeterminado de VÉRSOVA es <code>.</code>.</p></div><label class="search-box" style="max-width:360px;flex:1">${icon('search')}<input class="text-input" id="command-search" type="search" placeholder="Buscar comando…" /></label></div><div class="command-grid">${commandExamples.map((section) => `<section class="card command-card"><div class="section-kicker">${icon('spark')} ${escapeHtml(section.group)}</div><div class="command-pills">${section.names.map((name) => `<button class="command-pill" type="button" data-action="copy-command" data-command=".${escapeHtml(name)}">.${escapeHtml(name)}</button>`).join('')}</div></section>`).join('')}</div>${pageFooter()}</div>`;
}

function renderPage() {
  document.body.classList.toggle('light-theme', state.theme === 'light');
  renderHeader();
  renderBottomNavigation();
  const host = $('#main-content');
  if (!host) return;
  host.classList.toggle('is-wizard', state.view === 'register');
  switch (state.view) {
    case 'landing': renderLanding(); break;
    case 'home': host.innerHTML = renderHome(); break;
    case 'register': host.innerHTML = renderWizard(); break;
    case 'bots': host.innerHTML = renderBots(); break;
    case 'metrics': host.innerHTML = renderMetrics(); break;
    case 'store': host.innerHTML = renderStore(); break;
    case 'endpoints':
    case 'favorites': host.innerHTML = renderEndpoints(); renderEndpointResults(); break;
    case 'tickets': host.innerHTML = renderTickets(); break;
    case 'profile': host.innerHTML = renderProfile(); break;
    case 'commands': host.innerHTML = renderCommands(); break;
    default: state.view = 'landing'; renderLanding(); break;
  }
  updateHeaderStatus();
}

function updateHeaderStatus() {
  const status = $('#header-service-copy');
  if (status && state.health?.ok === false) status.textContent = 'Verificando servicios';
  else if (status && state.health) status.textContent = 'Servicio operativo';
}

function navigate(view, { replace = false } = {}) {
  if (view === 'menu') { openDrawer(); return; }
  if (!paths[view]) view = 'home';
  state.view = view;
  const url = paths[view];
  if (replace) window.history.replaceState({ view }, '', url);
  else if (window.location.pathname !== url) window.history.pushState({ view }, '', url);
  renderPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (view === 'home' || view === 'bots' || view === 'metrics') loadAdminData({ quiet: true });
  if (view === 'store') loadPlans({ quiet: true });
}

function openDrawer() {
  renderDrawer();
  $('#drawer-layer').hidden = false;
  document.body.classList.add('modal-open');
}
function closeDrawer() {
  $('#drawer-layer').hidden = true;
  document.body.classList.remove('modal-open');
}
function renderDrawer() {
  const active = state.view === 'favorites' ? 'endpoints' : state.view;
  const item = (view, label, description, iconName) => `<button class="drawer-item ${active === view ? 'is-active' : ''}" type="button" data-page="${view}"><span class="drawer-item-icon">${icon(iconName)}</span><span class="drawer-item-copy"><strong>${label}</strong><small>${description}</small></span>${icon('chevron')}</button>`;
  $('#menu-drawer').innerHTML = `<div class="drawer-profile"><span class="avatar">${escapeHtml(initials(state.apiUser?.username || 'Lyan'))}</span><span class="drawer-profile-copy"><strong>${escapeHtml(state.apiUser?.username || 'Lyan')}</strong><small>${escapeHtml(String(state.apiUser?.plan || 'FREE').toUpperCase())}</small></span><button class="icon-button drawer-close" type="button" data-action="close-drawer" aria-label="Cerrar menú">${icon('close')}</button></div><div class="drawer-section"><p class="drawer-section-label">Navegación <span>01 — 06</span></p>${item('home','Inicio','Panel principal','home')}${item('register','Registrar Bot','Vincula un nuevo número','plus')}${item('bots','Mis Bots','Gestiona tus sesiones','bot')}${item('endpoints','Endpoints','Catálogo completo','code')}${item('favorites','Favoritos','Tus accesos guardados','star')}${item('metrics','Métricas','Estadísticas en vivo','chart')}${item('store','Tienda','Planes y productos','crown')}${item('tickets','Soporte','Abrir un ticket','headset')}</div><div class="drawer-section"><p class="drawer-section-label">Cuenta</p>${item('profile','Mi Perfil','Datos y API key','users')}${item('commands','Comandos','Ayuda y referencia','spark')}</div><div class="drawer-bottom"><p>© 2026 Stellar The Best's Corp. · Powered by VÉRSOVA</p><button class="btn ${state.adminToken ? 'btn-outline' : 'btn-primary'} btn-full" type="button" data-action="${state.adminToken ? 'logout-admin' : 'open-admin-login'}">${icon(state.adminToken ? 'close' : 'lock')}${state.adminToken ? 'Cerrar sesión del panel' : 'Conectar panel privado'}</button></div>`;
}

function openAuth(mode = 'admin') {
  state.authMode = mode;
  renderAuthModal();
  $('#modal-layer').hidden = false;
  document.body.classList.add('modal-open');
  setTimeout(() => $('#modal-content input')?.focus(), 40);
}
function closeModal() {
  $('#modal-layer').hidden = true;
  document.body.classList.remove('modal-open');
}
function renderAuthModal() {
  const isAdmin = state.authMode === 'admin';
  const isRegister = state.authMode === 'api-register';
  const content = $('#modal-content');
  if (isAdmin) {
    content.innerHTML = `<button class="icon-button modal-close" type="button" data-action="close-modal" aria-label="Cerrar">${icon('close')}</button><div class="modal-brand">${brandMarkup()}</div><span class="section-kicker">${icon('lock')} Acceso privado</span><h2 id="modal-title" style="margin-top:11px">Conectar el panel</h2><p class="modal-description">Ingresa la contraseña de administración configurada en el servidor para gestionar SubBots y sesiones.</p><form class="modal-form" id="admin-login-form"><label class="field"><span class="field-label">Contraseña del panel</span><input class="text-input" name="password" type="password" required autocomplete="current-password" placeholder="Tu contraseña" /></label><p class="modal-error" id="admin-login-error" aria-live="polite"></p><button class="btn btn-primary btn-full" type="submit">Iniciar sesión ${icon('arrow-right')}</button></form><p class="modal-switch">¿Buscabas una cuenta de usuario? <button type="button" data-action="open-api-auth">Iniciar sesión en tienda</button></p>`;
    return;
  }
  content.innerHTML = `<button class="icon-button modal-close" type="button" data-action="close-modal" aria-label="Cerrar">${icon('close')}</button><div class="modal-brand">${brandMarkup()}</div><span class="section-kicker">${icon('users')} Mi cuenta</span><h2 id="modal-title" style="margin-top:11px">${isRegister ? 'Crea tu cuenta' : 'Inicia sesión'}</h2><p class="modal-description">Guarda tus créditos y accede a tu API key desde cualquier dispositivo.</p><div class="modal-tabs"><button type="button" class="${!isRegister ? 'is-active' : ''}" data-action="auth-mode" data-mode="api-login">Iniciar sesión</button><button type="button" class="${isRegister ? 'is-active' : ''}" data-action="auth-mode" data-mode="api-register">Crear cuenta</button></div><form class="modal-form" id="api-auth-form"><label class="field"><span class="field-label">Email</span><input class="text-input" name="email" type="email" required autocomplete="email" placeholder="tu@email.com" /></label>${isRegister ? `<label class="field"><span class="field-label">Nombre de usuario</span><input class="text-input" name="username" type="text" required maxlength="32" autocomplete="username" placeholder="tu_usuario" /></label>` : ''}<label class="field"><span class="field-label">Contraseña</span><input class="text-input" name="password" type="password" required minlength="6" autocomplete="${isRegister ? 'new-password' : 'current-password'}" placeholder="${isRegister ? 'Mínimo 6 caracteres' : 'Tu contraseña'}" /></label><p class="modal-error" id="api-auth-error" aria-live="polite"></p><button class="btn btn-primary btn-full" type="submit">${isRegister ? 'Crear cuenta' : 'Iniciar sesión'} ${icon('arrow-right')}</button></form><p class="modal-switch">La creación de cuenta es independiente del panel privado.</p>`;
}

function showToast(message, type = 'info') {
  const stack = $('#toast-stack');
  if (!stack) return;
  const element = document.createElement('div');
  element.className = `toast ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;
  element.textContent = message;
  stack.append(element);
  window.setTimeout(() => element.remove(), 4300);
}

async function copyText(value, successMessage = 'Copiado al portapapeles') {
  try {
    await navigator.clipboard.writeText(String(value));
    showToast(successMessage, 'success');
  } catch {
    const area = document.createElement('textarea');
    area.value = String(value);
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    showToast(copied ? successMessage : 'No se pudo copiar en este navegador', copied ? 'success' : 'error');
  }
}

function instanceType(type) {
  const types = {
    free: { label: 'SubBot Gratis', detail: 'Instancia gratuita básica', icon: 'bot' },
    main: { label: 'Principal', detail: 'Requiere token de moderador', icon: 'shield' },
    premium: { label: 'Premium', detail: 'Beneficios exclusivos', icon: 'gem' },
  };
  return types[type] || types.free;
}

function nextWizardStep() {
  const flow = state.flow;
  flow.error = '';
  if (flow.step === 1) {
    if (flow.type !== 'free') { flow.step = 0; renderPage(); return; }
    flow.step = 2;
  } else if (flow.step === 2) {
    flow.step = 3;
  } else if (flow.step === 3) {
    const digits = flow.phone.replace(/\D/g, '');
    if (digits.length < 8) { flow.error = 'Ingresa un número de WhatsApp válido con código de país.'; renderPage(); return; }
    flow.step = 4;
  } else if (flow.step === 4) {
    if (!flow.name.trim()) { flow.error = 'Escribe un nombre para identificar tu bot.'; renderPage(); return; }
    flow.step = 5;
  }
  renderPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function previousWizardStep() {
  const flow = state.flow;
  if (flow.step === 0) flow.step = 1;
  else if (flow.step > 1 && flow.step <= 5) flow.step -= 1;
  flow.error = '';
  renderPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function resetWizard() {
  if (state.flow.poller) clearInterval(state.flow.poller);
  state.flow = { step: 1, type: 'free', typeListOpen: false, server: 'luffy', provider: 'stellar', phone: '', pairingMode: 'pairing', name: '', token: '', tokenVerified: false, instanceId: null, linkData: null, loading: false, error: '', poller: null };
  navigate('register');
}

async function generateLink() {
  const flow = state.flow;
  if (flow.loading) return;
  flow.error = '';
  if (!flow.phone.trim() || flow.phone.replace(/\D/g, '').length < 8) { flow.step = 3; flow.error = 'Ingresa un número de WhatsApp válido antes de generar la vinculación.'; renderPage(); return; }
  if (!flow.name.trim()) { flow.step = 4; flow.error = 'Escribe un nombre para identificar la instancia.'; renderPage(); return; }
  flow.loading = true;
  renderPage();
  try {
    if (!flow.instanceId) {
      const phone = flow.phone.replace(/\D/g, '');
      const created = await request('/instances', { method: 'POST', body: { name: flow.name.trim(), phone, pairingMode: flow.pairingMode } });
      flow.instanceId = created.instance?.id;
      if (created.instance) state.instances = [created.instance, ...state.instances.filter((item) => item.id !== created.instance.id)];
      if (!flow.instanceId) throw new Error('El servidor no devolvió la instancia creada.');
      try {
        await request(`/instances/${encodeURIComponent(flow.instanceId)}/start`, { method: 'POST' });
      } catch (error) {
        if (error.status === 401) throw error;
        flow.error = error.message || 'No se pudo iniciar la sesión. Puedes reintentar desde Mis Bots.';
      }
    }
    const link = await request(`/instances/${encodeURIComponent(flow.instanceId)}/link`);
    flow.linkData = link;
    flow.loading = false;
    renderPage();
    if (['open', 'connected'].includes(String(link.status || '').toLowerCase())) {
      flow.step = 6;
      renderPage();
      showToast('¡Tu bot ya está en línea!', 'success');
    } else {
      showToast(flow.pairingMode === 'qr' ? 'Código QR actualizado' : 'Vinculación generada', 'success');
      pollForLink();
    }
    loadAdminData({ quiet: true });
  } catch (error) {
    flow.loading = false;
    if (error.status === 401) {
      state.authRequired = true;
      renderPage();
      openAuth('admin');
      const errorMessage = $('#admin-login-error');
      if (errorMessage) errorMessage.textContent = 'Inicia sesión para crear y vincular SubBots.';
      return;
    }
    flow.error = error.message || 'No se pudo generar la vinculación.';
    renderPage();
    showToast(flow.error, 'error');
  }
}

function pollForLink() {
  if (state.flow.poller) clearInterval(state.flow.poller);
  let attempts = 0;
  state.flow.poller = setInterval(async () => {
    attempts += 1;
    if (state.view !== 'register' || !state.flow.instanceId || attempts > 18) { clearInterval(state.flow.poller); state.flow.poller = null; return; }
    try {
      const link = await request(`/instances/${encodeURIComponent(state.flow.instanceId)}/link`);
      state.flow.linkData = link;
      if (['open', 'connected'].includes(String(link.status || '').toLowerCase())) {
        clearInterval(state.flow.poller);
        state.flow.poller = null;
        state.flow.step = 6;
        showToast('¡Sesión conectada!', 'success');
      }
      if (state.view === 'register') renderPage();
    } catch (error) {
      if (error.status === 401) { clearInterval(state.flow.poller); state.flow.poller = null; }
    }
  }, 4000);
}

async function refreshLink() {
  const flow = state.flow;
  if (!flow.instanceId) { await generateLink(); return; }
  flow.loading = true;
  flow.error = '';
  renderPage();
  try {
    if (flow.pairingMode === 'pairing') await request(`/instances/${encodeURIComponent(flow.instanceId)}/pairing/refresh`, { method: 'POST' });
    const link = await request(`/instances/${encodeURIComponent(flow.instanceId)}/link`);
    flow.linkData = link;
    flow.loading = false;
    renderPage();
    showToast('Vinculación actualizada', 'success');
    pollForLink();
  } catch (error) {
    flow.loading = false;
    if (error.status === 401) { state.authRequired = true; renderPage(); openAuth('admin'); return; }
    flow.error = error.message;
    renderPage();
    showToast(error.message, 'error');
  }
}

async function loadAdminData({ quiet = false } = {}) {
  try {
    const results = await Promise.allSettled([
      request('/me'), request('/stats'), request('/instances'), request('/groups'),
    ]);
    if (results[0].status === 'fulfilled') { state.me = results[0].value; state.authRequired = false; }
    if (results[1].status === 'fulfilled') state.stats = results[1].value;
    if (results[2].status === 'fulfilled') state.instances = results[2].value.instances || [];
    if (results[3].status === 'fulfilled') state.groups = results[3].value.groups || [];
    const unauthorized = results.some((result) => result.status === 'rejected' && result.reason?.status === 401);
    if (unauthorized) {
      state.authRequired = true;
      if (state.adminToken) {
        state.adminToken = '';
        try { localStorage.removeItem('versova_panel_token'); } catch {}
      }
    }
    if (state.view !== 'landing') renderPage();
    if (!quiet && !unauthorized) showToast('Datos actualizados', 'success');
  } catch (error) {
    if (!quiet) showToast(error.message || 'No se pudieron actualizar los datos', 'error');
  }
}

async function loadHealth() {
  try {
    state.health = await request('/health', { auth: false, apiKey: false });
  } catch { state.health = { ok: false }; }
  updateHeaderStatus();
}
async function loadCatalog() {
  try {
    const data = await request('/endpoints/catalog', { auth: false, apiKey: false });
    if (data.ok && Array.isArray(data.categories)) {
      state.endpoints = data.categories;
      state.endpointTotal = data.total || allEndpoints().length;
      if (state.view === 'endpoints' || state.view === 'favorites') { renderPage(); }
    }
  } catch { /* usa el catálogo de respaldo */ }
}
async function loadPlans({ quiet = false } = {}) {
  try {
    const data = await request('/credits/plans', { auth: false, apiKey: false });
    if (data.ok && Array.isArray(data.plans)) state.apiPlans = data.plans;
    if (state.view === 'store') renderPage();
  } catch {
    if (!quiet) showToast('Mostrando los planes disponibles', 'info');
  }
}
async function loadApiAccount() {
  if (!state.apiUser?.apiKey) return;
  try {
    const data = await request('/credits/me', { auth: false, apiKey: true });
    if (data.ok) {
      state.apiUser = { ...state.apiUser, ...data.user, apiKey: state.apiUser.apiKey || data.user.api_key };
      safeWrite('sw_user', state.apiUser);
    }
  } catch {
    state.apiUser = null;
    try { localStorage.removeItem('sw_user'); } catch {}
  }
}

async function submitAdminLogin(form) {
  const errorBox = $('#admin-login-error');
  if (errorBox) errorBox.textContent = '';
  const password = new FormData(form).get('password');
  try {
    const data = await request('/login', { method: 'POST', body: { password }, auth: false, apiKey: false });
    if (!data.ok || !data.token) throw new Error(data.error || 'No se pudo iniciar sesión.');
    state.adminToken = data.token;
    state.authRequired = false;
    try { localStorage.setItem('versova_panel_token', data.token); } catch {}
    closeModal();
    showToast('Panel conectado correctamente', 'success');
    await loadAdminData({ quiet: true });
    if (state.view === 'register' && state.flow.step === 5 && !state.flow.instanceId) generateLink();
  } catch (error) {
    const message = error.message || 'No se pudo iniciar sesión.';
    if (errorBox) errorBox.textContent = message;
    else showToast(message, 'error');
  }
}

async function submitApiAuth(form) {
  const errorBox = $('#api-auth-error');
  if (errorBox) errorBox.textContent = '';
  const formData = new FormData(form);
  const isRegister = state.authMode === 'api-register';
  const body = { email: formData.get('email'), password: formData.get('password') };
  if (isRegister) body.username = formData.get('username');
  try {
    const data = await request(`/credits/${isRegister ? 'register' : 'login'}`, { method: 'POST', body, auth: false, apiKey: false });
    if (!data.ok || !data.user) throw new Error(data.error || 'No se pudo acceder a la cuenta.');
    state.apiUser = { ...data.user, apiKey: data.user.apiKey || data.user.api_key };
    safeWrite('sw_user', state.apiUser);
    closeModal();
    showToast(isRegister ? '¡Cuenta creada! Recibiste 50 créditos.' : 'Sesión iniciada correctamente', 'success');
    await loadApiAccount();
    if (state.pendingPlan) {
      const plan = state.pendingPlan;
      state.pendingPlan = '';
      await purchasePlan(plan);
    }
    renderPage();
  } catch (error) {
    if (errorBox) errorBox.textContent = error.message || 'No se pudo acceder a la cuenta.';
  }
}

async function purchasePlan(planId) {
  if (planId === 'free') { showToast('Ya estás en el plan gratuito.', 'info'); return; }
  if (!state.apiUser?.apiKey) { state.pendingPlan = planId; openAuth('api-login'); return; }
  try {
    const data = await request('/credits/purchase', { method: 'POST', body: { planId }, auth: false, apiKey: true });
    if (data.ok) {
      state.apiUser.credits = data.newBalance;
      state.apiUser.plan = data.plan || state.apiUser.plan;
      safeWrite('sw_user', state.apiUser);
      showToast(`¡${formatNumber(data.creditsAdded)} créditos añadidos!`, 'success');
      renderPage();
    }
  } catch (error) {
    showToast(error.message || 'No se pudo procesar la compra.', 'error');
  }
}

async function redeemCoupon(form) {
  const code = String(new FormData(form).get('coupon') || '').trim();
  if (!code) return;
  if (!state.apiUser?.apiKey) { openAuth('api-login'); showToast('Inicia sesión para canjear tu código.', 'info'); return; }
  const message = $('#store-coupon-message');
  try {
    const result = await request('/credits/redeem', { method: 'POST', body: { code }, auth: false, apiKey: true });
    if (message) message.textContent = `¡${formatNumber(result.creditsAdded)} créditos añadidos! Balance: ${formatNumber(result.newBalance)}.`;
    state.apiUser.credits = result.newBalance;
    safeWrite('sw_user', state.apiUser);
    form.reset();
    showToast(`+${formatNumber(result.creditsAdded)} créditos`, 'success');
  } catch (error) {
    if (message) message.textContent = error.message || 'No se pudo canjear el código.';
    showToast(error.message || 'No se pudo canjear el código.', 'error');
  }
}

async function runInstanceAction(action, id) {
  if (!id) return;
  if (action === 'delete' && !window.confirm('¿Eliminar este SubBot? Esta acción también quita sus datos locales.')) return;
  try {
    if (action === 'delete') await request(`/instances/${encodeURIComponent(id)}`, { method: 'DELETE' });
    else await request(`/instances/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
    showToast(action === 'stop' ? 'Instancia detenida' : action === 'start' ? 'Instancia iniciada' : 'Instancia eliminada', 'success');
    await loadAdminData({ quiet: true });
  } catch (error) {
    if (error.status === 401) { state.authRequired = true; openAuth('admin'); }
    else showToast(error.message || 'No se pudo actualizar el SubBot.', 'error');
  }
}

function toggleFavorite(path) {
  const favorites = new Set(state.favorites);
  if (favorites.has(path)) favorites.delete(path); else favorites.add(path);
  state.favorites = [...favorites];
  safeWrite('stellar_favorites', state.favorites);
  renderPage();
  if (state.selectedEndpoint?.path === path) renderEndpointModal(state.selectedEndpoint);
}

function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('stellar_theme', state.theme); } catch {}
  renderPage();
}

function openTicketForm() {
  state.newTicketOpen = !state.newTicketOpen;
  renderPage();
  if (state.newTicketOpen) setTimeout(() => $('[name="ticket-title"]')?.focus(), 20);
}
function submitTicket(form) {
  const data = new FormData(form);
  const title = String(data.get('ticket-title') || '').trim();
  const message = String(data.get('ticket-message') || '').trim();
  if (!title || !message) return;
  const ticket = { id: `#SW-${String(Date.now()).slice(-5)}`, title, message, status: 'Abierto', date: new Date().toLocaleDateString('es') };
  state.viewTickets = [ticket, ...(state.viewTickets || [])];
  safeWrite('stellar_tickets', state.viewTickets);
  state.newTicketOpen = false;
  renderPage();
  showToast('Tu solicitud se guardó en este navegador.', 'success');
}

function setEndpointFilter(key, value) {
  if (key === 'method') state.endpointMethod = value;
  if (key === 'tier') state.endpointTier = value;
  renderPage();
}
function updateEndpointSearch() {
  if (state.view !== 'endpoints' && state.view !== 'favorites') return;
  renderEndpointResults();
}

function handleClick(event) {
  const landingAnchor = event.target.closest('.landing-header .header-links a[href^="#"]');
  if (landingAnchor) $('.header-links')?.classList.remove('mobile-open');
  const pageTarget = event.target.closest('[data-page]');
  if (pageTarget) {
    event.preventDefault();
    closeDrawer();
    navigate(pageTarget.dataset.page);
    return;
  }
  const actionTarget = event.target.closest('[data-action]');
  if (!actionTarget) return;
  const { action } = actionTarget.dataset;
  if (action === 'toggle-theme') toggleTheme();
  else if (action === 'open-drawer') openDrawer();
  else if (action === 'close-drawer') closeDrawer();
  else if (action === 'close-modal') closeModal();
  else if (action === 'toggle-landing-menu') $('.header-links')?.classList.toggle('mobile-open');
  else if (action === 'notifications') showToast('No tienes notificaciones nuevas.', 'info');
  else if (action === 'channel-link') { event.preventDefault(); showToast('Consulta el canal oficial de Stellar Wa.', 'info'); }
  else if (action === 'open-admin-login') openAuth('admin');
  else if (action === 'open-api-auth') openAuth('api-login');
  else if (action === 'auth-mode') { state.authMode = actionTarget.dataset.mode; renderAuthModal(); }
  else if (action === 'logout-admin') {
    state.adminToken = '';
    state.me = null;
    state.authRequired = true;
    try { localStorage.removeItem('versova_panel_token'); } catch {}
    closeDrawer();
    renderPage();
    showToast('Sesión del panel cerrada.', 'success');
  }
  else if (action === 'toggle-types') { state.flow.typeListOpen = !state.flow.typeListOpen; renderPage(); }
  else if (action === 'select-type') { state.flow.type = actionTarget.dataset.type; state.flow.typeListOpen = false; renderPage(); }
  else if (action === 'wizard-next') nextWizardStep();
  else if (action === 'wizard-back') previousWizardStep();
  else if (action === 'select-method') { state.flow.pairingMode = actionTarget.dataset.method; renderPage(); }
  else if (action === 'verify-token') {
    if (!state.flow.token.trim()) { state.flow.error = 'Ingresa un token para continuar.'; renderPage(); return; }
    state.flow.tokenVerified = true;
    state.flow.step = 2;
    state.flow.error = '';
    renderPage();
    showToast('Token guardado para esta configuración.', 'success');
  }
  else if (action === 'generate-link') generateLink();
  else if (action === 'refresh-link') refreshLink();
  else if (action === 'reset-flow') resetWizard();
  else if (action === 'copy-pairing-code') copyText(actionTarget.dataset.code || '', 'Código copiado');
  else if (action === 'refresh-data') loadAdminData();
  else if (action === 'start-instance') runInstanceAction('start', actionTarget.dataset.id);
  else if (action === 'stop-instance') runInstanceAction('stop', actionTarget.dataset.id);
  else if (action === 'delete-instance') runInstanceAction('delete', actionTarget.dataset.id);
  else if (action === 'link-instance') {
    const instance = state.instances.find((item) => item.id === actionTarget.dataset.id);
    if (instance) {
      state.flow = { ...state.flow, step: 5, type: 'free', phone: instance.phone || '', pairingMode: instance.pairingMode || 'qr', name: instance.name || '', instanceId: instance.id, linkData: null, loading: false, error: '' };
      navigate('register');
      request(`/instances/${encodeURIComponent(instance.id)}/link`).then((data) => { state.flow.linkData = data; renderPage(); }).catch((error) => showToast(error.message, 'error'));
    }
  }
  else if (action === 'purchase-plan') purchasePlan(actionTarget.dataset.plan);
  else if (action === 'set-period') { state.storePeriod = actionTarget.dataset.period; renderPage(); }
  else if (action === 'set-currency') { state.storeCurrency = actionTarget.dataset.currency; renderPage(); }
  else if (action === 'endpoint-method') setEndpointFilter('method', actionTarget.dataset.method);
  else if (action === 'endpoint-tier') setEndpointFilter('tier', actionTarget.dataset.tier);
  else if (action === 'endpoint-sort') { state.endpointSort = state.endpointSort === 'az' ? 'za' : 'az'; renderPage(); }
  else if (action === 'toggle-category') {
    const category = actionTarget.dataset.category;
    if (state.openCategories.has(category)) state.openCategories.delete(category); else state.openCategories.add(category);
    renderPage();
  }
  else if (action === 'open-endpoint') {
    const endpoint = endpointByPath(actionTarget.dataset.path);
    if (endpoint) renderEndpointModal(endpoint);
  }
  else if (action === 'close-endpoint') { $('#endpoint-layer').hidden = true; document.body.classList.remove('modal-open'); }
  else if (action === 'copy-endpoint-url') {
    const endpoint = state.selectedEndpoint;
    if (endpoint) copyText(`https://api.stellarwa.xyz${endpoint.path}${state.endpointWithKey ? '?key=TU_API_KEY' : ''}`, 'URL copiada');
  }
  else if (action === 'toggle-endpoint-key') { state.endpointWithKey = !state.endpointWithKey; renderEndpointModal(state.selectedEndpoint); }
  else if (action === 'endpoint-code-tab') { state.endpointCodeTab = actionTarget.dataset.tab; renderEndpointModal(state.selectedEndpoint); }
  else if (action === 'copy-endpoint-code') { if (state.selectedEndpoint) copyText(codeSnippet(state.selectedEndpoint), 'Código copiado'); }
  else if (action === 'toggle-favorite') { event.stopPropagation(); toggleFavorite(actionTarget.dataset.path); }
  else if (action === 'toggle-ticket-form') openTicketForm();
  else if (action === 'copy-api-key') copyText(state.apiUser?.apiKey || state.apiUser?.api_key || '', 'API key copiada');
  else if (action === 'copy-command') copyText(actionTarget.dataset.command || '', 'Comando copiado');
}

function handleInput(event) {
  const target = event.target;
  if (target.matches('[data-flow]')) {
    state.flow[target.dataset.flow] = target.value;
    state.flow.error = '';
  }
  if (target.id === 'endpoint-search') { state.endpointQuery = target.value; updateEndpointSearch(); }
  if (target.id === 'endpoint-category') { state.endpointCategory = target.value; updateEndpointSearch(); }
  if (target.id === 'ticket-search') {
    const query = target.value.toLowerCase();
    const filtered = (state.viewTickets || []).filter((ticket) => `${ticket.id} ${ticket.title} ${ticket.status}`.toLowerCase().includes(query));
    const list = $('#ticket-list');
    if (list) list.innerHTML = filtered.length ? filtered.map((ticket) => `<article class="ticket-row"><span class="drawer-item-icon">${icon('ticket')}</span><span><strong>${escapeHtml(ticket.title)}</strong><small class="muted">${escapeHtml(ticket.id)} · ${escapeHtml(ticket.date)}</small></span><span class="status-badge">${escapeHtml(ticket.status)}</span></article>`).join('') : '<div class="ticket-empty">No hay coincidencias con esa búsqueda.</div>';
  }
  if (target.id === 'command-search') {
    const query = target.value.trim().toLowerCase();
    $$('.command-pill').forEach((pill) => { pill.hidden = query && !pill.textContent.toLowerCase().includes(query); });
    $$('.command-card').forEach((card) => { card.hidden = query && ![...card.querySelectorAll('.command-pill')].some((pill) => !pill.hidden); });
  }
}

function handleChange(event) {
  const target = event.target;
  if (target.matches('[data-flow]')) {
    state.flow[target.dataset.flow] = target.value;
  }
  if (target.id === 'endpoint-category') {
    state.endpointCategory = target.value;
    updateEndpointSearch();
  }
}

function handleSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.id === 'admin-login-form') { event.preventDefault(); submitAdminLogin(form); }
  else if (form.id === 'api-auth-form') { event.preventDefault(); submitApiAuth(form); }
  else if (form.id === 'store-coupon-form') { event.preventDefault(); redeemCoupon(form); }
  else if (form.id === 'ticket-form') { event.preventDefault(); submitTicket(form); }
  else if (form.id === 'endpoint-playground-form') {
    event.preventDefault();
    const message = $('#endpoint-playground-message');
    if (message) message.textContent = 'Este catálogo es una vista de referencia: la ejecución real se realiza en el servicio API externo.';
    showToast('Formulario validado. La API externa no está conectada a este panel.', 'info');
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    closeDrawer();
    closeModal();
    $('#endpoint-layer').hidden = true;
    document.body.classList.remove('modal-open');
  }
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.endpoint-row[role="button"], .endpoint-category-head[role="button"]')) {
    event.preventDefault();
    event.target.click();
  }
}

async function boot() {
  document.body.classList.toggle('light-theme', state.theme === 'light');
  renderPage();
  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  document.addEventListener('change', handleChange);
  document.addEventListener('submit', handleSubmit);
  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('popstate', () => {
    state.view = routeFromPath();
    renderPage();
    if (['home','bots','metrics'].includes(state.view)) loadAdminData({ quiet: true });
  });

  await Promise.allSettled([loadHealth(), loadCatalog(), loadPlans({ quiet: true }), loadApiAccount(), loadAdminData({ quiet: true })]);
  if (state.view !== 'landing') renderPage();
}

boot();
