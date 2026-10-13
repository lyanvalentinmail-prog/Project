/* Stellar Wa · SPA vanilla: landing + panel responsive de SubBots/API.
 * Solo datos REALES: lo que muestra la página sale del servidor
 * (base de datos, telemetría del sistema, QR/pairing codes de Baileys).
 */
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
const formatBytes = (value) => {
  const bytes = number(value, 0);
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};
const formatUptime = (ms) => {
  const total = Math.max(0, Math.floor(number(ms, 0) / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days) return `${days}d ${hours}h ${minutes}m`;
  if (hours) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};
const initials = (value) => String(value || 'SW').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'SW';
const PREFIXES = ['#', '-', '+', '.', '/'];

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

const state = {
  view: routeFromPath(),
  apiUser: safeRead('sw_user'),
  me: null,
  health: null,
  stats: null,
  system: null,
  instances: [],
  groups: [],
  tickets: [],
  ticketCounts: null,
  endpoints: [],
  endpointTotal: 0,
  apiPlans: [],
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
  authMode: 'api-login',
  pendingPlan: '',
  newTicketOpen: false,
  theme: localStorage.getItem('stellar_theme') || 'dark',
  connectTarget: null,
  connectKey: '',
  connectError: '',
  connectLoading: false,
  editTarget: null,
  flow: {
    step: 1,
    name: '',
    prefix: '.',
    phone: '',
    pairingMode: 'pairing',
    instanceId: null,
    linkData: null,
    loading: false,
    error: '',
    poller: null,
    connectKey: '',
    connectError: '',
    connectLoading: false,
  },
};

function routeFromPath() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  if ((pathname === '/home' || pathname === '/') && window.location.hash.toLowerCase() === '#store') return 'store';
  return routeMap[pathname] || 'landing';
}

async function request(path, options = {}) {
  const { method = 'GET', body = null, apiKey = true, headers = {} } = options;
  const requestHeaders = { 'Content-Type': 'application/json', ...headers };
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

/* ── datos reales de instancia ───────────────────────────────── */

function instanceState(instance) {
  const status = String(instance.status || 'created').toLowerCase();
  const open = status === 'open' || instance.live === true;
  const linking = ['starting', 'qr', 'pairing', 'connecting'].includes(status);
  const isError = status === 'error' || status === 'loggedout';
  const activated = Boolean(instance.activated);
  if (isError) return { key: 'error', label: 'Revisar', className: 'status-error' };
  if (open && activated) return { key: 'online', label: 'En línea', className: '' };
  if (open && !activated) return { key: 'inactive', label: 'Conectado · Sin activar', className: 'status-offline' };
  if (linking && activated) return { key: 'linking', label: 'Vinculando…', className: 'status-offline' };
  if (linking && !activated) return { key: 'linking', label: 'Vinculando · Sin activar', className: 'status-offline' };
  if (activated) return { key: 'offline', label: 'Desconectado', className: 'status-offline' };
  return { key: 'created', label: 'Desconectado · Sin activar', className: 'status-offline' };
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
        <a class="header-link" href="#faq">Preguntas frecuentes</a>
      </nav>
      <div class="header-actions">
        <span class="service-pill"><span class="pulse-dot"></span><span id="header-service-copy">${state.health?.ok === false ? 'Verificando servicios' : 'Servicio operativo'}</span></span>
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
      <button class="icon-button notification-button" type="button" data-action="notifications" aria-label="Notificaciones">${icon('bell')}</button>
      <button class="profile-button" type="button" data-action="open-drawer" aria-label="Abrir menú de usuario">
        <span class="avatar">${escapeHtml(initials(state.apiUser?.username || 'Invitado'))}</span><span class="profile-name">${escapeHtml(state.apiUser?.username || 'Invitado')}</span>${icon('chevron')}
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

/* ── landing (valores reales del servidor) ───────────────────── */

function renderLanding() {
  const host = $('#main-content');
  const totalBots = state.stats?.instances ?? state.instances.length ?? 0;
  const connected = state.stats?.connected ?? state.instances.filter((i) => i.status === 'open').length;
  const commands = state.health?.commands ?? 0;
  const groups = state.stats?.groups ?? 0;
  const uptime = state.system ? formatUptime(state.system.server.uptimeMs) : '—';
  const questions = [
    { q: '¿Es seguro vincular mi número?', a: 'Sí. Usamos el protocolo oficial WhatsApp Multi-Device con cifrado de extremo a extremo. Tu sesión se guarda cifrada en el servidor y no tenemos acceso a tus chats.' },
    { q: '¿Cómo activo mi bot?', a: 'Al crear un bot queda desconectado. En Conectar escribes .key desde WhatsApp, el bot te da una clave y la pegas en la página: ahí queda activado.' },
    { q: '¿Qué prefijos puedo usar?', a: 'Al crear cada bot eliges su prefijo de comandos: # - + . / (por defecto el punto). Puedes cambiarlo después desde Mis Bots.' },
    { q: '¿Qué datos muestra el panel?', a: 'Solo datos reales: el estado de tus sesiones, los QR y pairing codes que emite WhatsApp, los grupos sincronizados y la telemetría real del servidor.' },
    { q: '¿Qué pasa si el bot se desconecta?', a: 'El sistema detecta la caída y reconecta automáticamente con reintentos progresivos. Puedes ver el estado en vivo en Métricas.' },
    { q: '¿Necesito un servidor propio?', a: 'No para probar: todo corre en el servidor donde despliegues el panel. Vos vinculás tu número y usás los comandos.' },
    { q: '¿Puedo usar el mismo número en varios bots?', a: 'No. Cada número puede estar vinculado a un solo SubBot a la vez. Podés desvincularlo desde el panel si es necesario.' },
    { q: '¿Cuántos bots puedo crear?', a: `Hasta ${state.me?.limits?.maxInstances ?? 3} sub-bots con números distintos, cada uno con su propio prefijo y sus propios datos en la base de datos.` },
  ].map((item, index) => `<details class="faq-item" ${index === 0 ? 'open' : ''}><summary><span><span class="purple mono">${String(index + 1).padStart(2, '0')}</span>　${escapeHtml(item.q)}</span></summary><div class="faq-answer">${escapeHtml(item.a)}</div></details>`).join('');
  host.innerHTML = `
    <div class="page-content landing-page" id="top">
      <section class="landing-hero" aria-labelledby="landing-title">
        <div class="landing-hero-copy">
          <span class="hero-version"><span class="pulse-dot"></span> Plataforma oficial · panel en vivo</span>
          <h1 class="landing-title" id="landing-title"><span class="title-line">Automatiza WhatsApp</span><span class="title-line">con <span class="gradient-text">Stellar Intelligence</span></span></h1>
          <p class="landing-lede">Gestión de <strong>SubBots</strong> con conexión real por QR o pairing code, activación con clave <code>.key</code> y panel unificado para todos tus números.</p>
          <div class="landing-actions">
            <a class="btn btn-primary btn-large" href="/home" data-page="home">Ir al Panel ${icon('arrow-right')}</a>
            <a class="btn btn-outline btn-large" href="/register" data-page="register">Crear Bot ${icon('plus')}</a>
          </div>
          <div class="hero-footnote"><span>${icon('shield')} Sesión cifrada</span><span>${icon('clock')} Configuración en minutos</span><span>${icon('check')} Sin contraseña de panel</span></div>
        </div>
        <div class="hero-showcase" aria-label="Estado real de la plataforma">
          <div class="orbit"><span class="orbit-dot"></span></div>
          <div class="float-chip float-chip-one">${icon('bolt')} Datos en vivo</div>
          <div class="float-chip float-chip-two">${icon('server')} ${escapeHtml(state.system?.server?.hostname || 'Servidor')}</div>
          <div class="showcase-window">
            <div class="showcase-top"><span class="showcase-title">${icon('spark')} STELLAR · NETWORK</span><span class="window-dots"><i></i><i></i><i></i></span></div>
            <div class="showcase-body">
              <div class="showcase-bot"><span class="bot-orb">${icon('bot')}</span><span><strong>SubBots registrados</strong><small>WhatsApp Multi-Device</small></span><span class="status-tag"><i class="pulse-dot"></i> ${connected} en línea</span></div>
              <div class="showcase-stats"><div class="showcase-stat"><b>${formatNumber(totalBots)}</b><span>Bots creados</span></div><div class="showcase-stat"><b>${formatNumber(groups)}</b><span>Grupos</span></div><div class="showcase-stat"><b>${formatNumber(commands)}</b><span>Comandos</span></div></div>
              <div class="showcase-connection">${icon('shield')}<span><b>Activación con .key</b> · clave de un solo uso desde WhatsApp</span></div>
            </div>
          </div>
        </div>
      </section>

      <div class="landing-proof" aria-label="Estadísticas reales de la plataforma">
        <div class="proof-card"><span class="icon-wrap">${icon('bot')}</span><span><strong>${formatNumber(totalBots)}</strong><span>Total Bots</span></span></div>
        <div class="proof-card"><span class="icon-wrap">${icon('server')}</span><span><strong>${state.system ? '1' : '—'}</strong><span>Servidor</span></span></div>
        <div class="proof-card"><span class="icon-wrap">${icon('users')}</span><span><strong>${formatNumber(state.stats?.registered ?? 0)}</strong><span>Integrantes</span></span></div>
        <div class="proof-card"><span class="icon-wrap">${icon('globe')}</span><span><strong>${escapeHtml(uptime)}</strong><span>Uptime</span></span></div>
      </div>

      <section class="section-block" id="how">
        <div class="section-heading center"><span class="section-kicker">${icon('spark')} Cómo funciona</span><h2 class="section-title">Listo en <span class="gradient-text">3 simples pasos</span></h2><p class="section-copy">Setup en menos de 2 minutos. Sin servidores propios, sin configuración compleja.</p></div>
        <div class="steps-grid">
          <article class="card card-hover step-card"><span class="step-number">01</span><h3>Crea tu bot</h3><p>Elige nombre, número y prefijo de comandos (# - + . /). El bot nace desconectado hasta que lo actives.</p></article>
          <article class="card card-hover step-card"><span class="step-number">02</span><h3>Actívalo con .key</h3><p>Escribe .key desde WhatsApp, copia la clave que te devuelve el bot y pégala en el panel para activarlo.</p></article>
          <article class="card card-hover step-card"><span class="step-number">03</span><h3>Vincula y usa</h3><p>Escanea el QR o escribe el pairing code real de WhatsApp. Luego usa tus comandos en los grupos.</p></article>
        </div>
      </section>

      <section class="section-block" id="benefits">
        <div class="section-heading center"><span class="section-kicker">${icon('shield')} ¿Por qué Stellar?</span><h2 class="section-title">Una plataforma que <span class="gradient-text">trabaja contigo</span></h2><p class="section-copy">Herramientas y controles pensados para que tus bots sigan disponibles y sean fáciles de administrar.</p></div>
        <div class="benefits-grid">
          <article class="card card-hover benefit-card"><span class="benefit-icon">${icon('shield')}</span><h3>Activación con .key</h3><p>Cada bot se activa con una clave de un solo uso generada desde WhatsApp.</p></article>
          <article class="card card-hover benefit-card"><span class="benefit-icon">${icon('hash')}</span><h3>Prefijo por bot</h3><p>Elige # - + . / al crear tu bot y cámbialo cuando quieras desde el panel.</p></article>
          <article class="card card-hover benefit-card"><span class="benefit-icon">${icon('link')}</span><h3>Reconexión automática</h3><p>Si la conexión cae, tu bot reintenta con reintentos progresivos sin perder la sesión.</p></article>
          <article class="card card-hover benefit-card"><span class="benefit-icon">${icon('chart')}</span><h3>Datos reales</h3><p>Estado de sesiones, grupos y telemetría del servidor en tiempo real. Nada inventado.</p></article>
          <article class="card card-hover benefit-card"><span class="benefit-icon">${icon('lock')}</span><h3>Base de datos</h3><p>Los bots y el panel guardan todo en la base de datos: sobrevive reinicios y despliegues.</p></article>
          <article class="card card-hover benefit-card"><span class="benefit-icon">${icon('spark')}</span><h3>QR y pairing reales</h3><p>Los códigos de vinculación salen directamente de WhatsApp, renovados al instante.</p></article>
        </div>
      </section>

      <section class="section-block" id="faq">
        <div class="section-heading center"><span class="section-kicker">${icon('headset')} Preguntas frecuentes</span><h2 class="section-title">Respuestas <span class="gradient-text">sin vueltas</span></h2><p class="section-copy">Información clara para vincular tu número y gestionar tus bots.</p></div>
        <div class="faq-list">${questions}</div>
      </section>

      <section class="section-block landing-cta"><span class="section-kicker">${icon('bolt')} Empieza hoy</span><h2 style="margin-top:12px">Automatiza WhatsApp en minutos</h2><p>Crea tu bot, actívalo con .key y vincula tu número. Sin servidor propio para comenzar.</p><div class="landing-actions"><a class="btn btn-primary btn-large" href="/home" data-page="home">Ir al Panel ${icon('arrow-right')}</a><a class="btn btn-outline btn-large" href="/register" data-page="register">Crear Bot ${icon('plus')}</a></div></section>
      <footer class="site-footer"><a class="site-footer-brand" href="/">${brandMarkup()}<span>Stellar Wa</span></a><span>© 2025–2026 Stellar The Best's Corp. Todos los derechos reservados.</span><div class="footer-links"><a href="#how">Cómo empezar</a><a href="#faq">Soporte</a></div></footer>
    </div>`;
}

function renderMetricCard({ label, value, note, icon: iconName, indicator = false, color = '' }) {
  return `<article class="card card-hover metric-card"><span class="metric-label">${icon(iconName)}${escapeHtml(label)}</span>${indicator ? '<i class="metric-indicator"></i>' : ''}<strong class="metric-value ${color}">${escapeHtml(value)}</strong><span class="metric-note">${escapeHtml(note)}</span></article>`;
}

/* ── inicio ──────────────────────────────────────────────────── */

function renderHome() {
  const user = escapeHtml(state.apiUser?.username || 'Invitado');
  const connected = state.instances.filter((item) => item.status === 'open').length;
  const activated = state.instances.filter((item) => item.activated).length;
  const counts = [
    { label: 'Tus Bots', value: formatNumber(state.instances.length), note: `de ${state.me?.limits?.maxInstances ?? 3} permitidos`, icon: 'bot', indicator: true },
    { label: 'Activados', value: formatNumber(activated), note: 'con clave .key', icon: 'shield' },
    { label: 'En línea', value: formatNumber(connected), note: 'sesiones conectadas', icon: 'bolt', indicator: true },
    { label: 'Grupos', value: formatNumber(state.stats?.groups ?? 0), note: 'sincronizados', icon: 'users' },
    { label: 'Integrantes', value: formatNumber(state.stats?.registered ?? 0), note: 'registrados', icon: 'crown' },
    { label: 'Comandos', value: formatNumber(state.health?.commands ?? 0), note: 'disponibles', icon: 'code' },
  ];
  return `<div class="page-content">
    <section class="welcome-hero">
      <div class="welcome-copy"><span class="section-kicker">${icon('spark')} Información · Panel central</span><h1>Hola, <span class="gradient-text">${user}</span></h1><p>Controla tus sesiones, activa tus SubBots con .key y revisa el estado real de la plataforma desde un solo lugar.</p><div class="welcome-actions"><a class="btn btn-primary" href="/register" data-page="register">${icon('plus')} Registrar bot</a><a class="btn btn-outline" href="/bots" data-page="bots">${icon('bot')} Mis Bots</a></div></div>
      <div class="welcome-emblem" aria-hidden="true">${icon('spark')}</div>
    </section>

    <section class="info-banner"><span class="info-symbol">${icon('shield')}</span><div><h2>Activación con .key</h2><p>Al crear un bot queda desconectado. Para activarlo, escribe <strong>.key</strong> desde WhatsApp, copia la clave que te devuelve y pégala en Conectar bot.</p></div><a class="btn btn-primary btn-small" href="/register" data-page="register">Crear bot ${icon('arrow-right')}</a></section>

    <section class="section-block" style="margin-top:34px"><div class="section-heading"><div><span class="section-kicker">${icon('chart')} Resumen</span><h2 class="section-title">Tu plataforma, de un vistazo</h2><p class="section-copy">Datos reales de la base de datos y de tus sesiones.</p></div><button class="btn btn-outline btn-small" type="button" data-action="refresh-data">${icon('link')} Actualizar datos</button></div><div class="metrics-grid">${counts.map(renderMetricCard).join('')}</div></section>

    <section class="section-block"><div class="section-heading"><div><span class="section-kicker">${icon('bolt')} Accesos rápidos</span><h2 class="section-title">¿Qué quieres hacer?</h2></div></div><div class="shortcut-grid"><a class="card card-hover shortcut-card" href="/register" data-page="register"><span class="shortcut-icon">${icon('plus')}</span><span><strong>Crear un bot</strong><small>Número, prefijo y activación con .key</small></span><span class="shortcut-arrow">${icon('arrow-right')}</span></a><a class="card card-hover shortcut-card" href="/cmds" data-page="commands"><span class="shortcut-icon">${icon('code')}</span><span><strong>Comandos</strong><small>Referencia completa del bot</small></span><span class="shortcut-arrow">${icon('arrow-right')}</span></a></div></section>

    <section class="section-block"><div class="section-heading"><div><span class="section-kicker">${icon('users')} Comunidad</span><h2 class="section-title">Siempre cerca</h2></div></div><div class="shortcut-grid"><a class="card card-hover shortcut-card" href="https://web.stellarwa.xyz/channel/api" target="_blank" rel="noreferrer"><span class="shortcut-icon">${icon('whatsapp')}</span><span><strong>Canal de WhatsApp</strong><small>Avisos sobre futuras actualizaciones</small></span><span class="shortcut-arrow">${icon('arrow-right')}</span></a><a class="card card-hover shortcut-card" href="/tickets" data-page="tickets"><span class="shortcut-icon">${icon('headset')}</span><span><strong>Abrir ticket</strong><small>Contactar soporte directo</small></span><span class="shortcut-arrow">${icon('arrow-right')}</span></a></div></section>
    ${pageFooter()}
  </div>`;
}

/* ── bots ────────────────────────────────────────────────────── */

function renderBotCard(instance) {
  const status = instanceState(instance);
  const name = escapeHtml(instance.name || 'SubBot');
  const id = escapeHtml(instance.id || '');
  const phone = escapeHtml(instance.phoneMasked || 'Número oculto');
  const mode = instance.pairingMode === 'pairing' ? 'Código de 8 dígitos' : 'Código QR';
  const prefix = escapeHtml(instance.prefix || '.');
  return `<article class="card bot-card"><span class="bot-card-icon">${icon('bot')}</span><div class="bot-card-main"><div class="bot-card-title"><h3>${name}</h3><span class="status-badge ${status.className}"><i class="pulse-dot"></i>${status.label}</span></div><p>${phone}</p><div class="bot-card-meta"><span>${icon('hash')} prefijo <strong>${prefix}</strong></span><span>${icon('link')}${escapeHtml(mode)}</span><span>${icon('users')}${formatNumber(instance.groups || 0)} grupos</span><span>${icon('shield')}${instance.activated ? 'Activado' : 'Sin activar'}</span></div></div><div class="bot-card-actions"><button class="btn ${status.key === 'online' ? 'btn-outline' : 'btn-primary'} btn-small" type="button" data-action="open-connect" data-id="${id}">${icon('whatsapp')} Conectar en WhatsApp</button><button class="btn btn-outline btn-small" type="button" data-action="edit-instance" data-id="${id}">Editar</button>${status.key === 'online' || status.key === 'inactive' ? `<button class="btn btn-outline btn-small" type="button" data-action="stop-instance" data-id="${id}">Detener</button>` : ''}<button class="btn btn-outline btn-small" type="button" data-action="delete-instance" data-id="${id}">Eliminar</button></div></article>`;
}

function renderBots() {
  const instances = state.instances;
  const connected = instances.filter((instance) => instance.status === 'open').length;
  const activated = instances.filter((instance) => instance.activated).length;
  return `<div class="page-content"><div class="page-heading"><div><span class="section-kicker">${icon('bot')} Sesiones</span><h1>Mis Bots</h1><p>Gestiona tus sesiones: actívalas con la clave de .key, vincula números y cambia su prefijo.</p></div><div class="page-heading-actions"><a class="btn btn-primary" href="/register" data-page="register">${icon('plus')} Crear Bot</a></div></div>
    <div class="bots-summary"><article class="card summary-tile"><span>Bots registrados</span><strong>${instances.length}</strong></article><article class="card summary-tile"><span>Activados</span><strong class="green">${activated}</strong></article><article class="card summary-tile"><span>En línea</span><strong class="green">${connected}</strong></article><article class="card summary-tile"><span>Límite de instancias</span><strong>${state.me?.limits?.maxInstances ?? 3}</strong></article></div>
    ${instances.length ? `<div class="bot-list">${instances.map(renderBotCard).join('')}</div>` : `<div class="empty-state"><span class="empty-state-icon">${icon('bot')}</span><h2>No tienes bots registrados aún</h2><p>Crea tu primer bot: elige nombre, número y prefijo. Nace desconectado y lo activas con la clave de .key.</p><button class="btn btn-primary" type="button" data-page="register">${icon('plus')} Crear Bot</button></div>`}
    ${pageFooter()}</div>`;
}

/* ── asistente de creación + conexión (datos reales) ─────────── */

function renderWizard() {
  const flow = state.flow;
  const step = flow.step;
  let content = '';
  let title = '';
  let description = '';
  const regularStep = step >= 1 && step <= 3;

  if (step === 1) {
    title = 'Nombre y prefijo';
    description = 'Ponle un nombre a tu bot y elige el prefijo de sus comandos.';
    content = `<div class="wizard-form"><label class="field"><span class="field-label">Nombre / etiqueta</span><input class="text-input" type="text" name="flow-name" data-flow="name" value="${escapeHtml(flow.name)}" placeholder="Ej: Mi Bot Stellar" maxlength="42" autocomplete="off" /></label><div class="field"><span class="field-label">Prefijo de comandos</span><div class="pairing-methods">${PREFIXES.map((prefix) => `<button class="pairing-option ${flow.prefix === prefix ? 'is-selected' : ''}" type="button" data-action="select-prefix" data-prefix="${prefix}"><span class="pairing-option-icon">${icon('hash')}</span><span><strong>${escapeHtml(prefix)}</strong><small>${escapeHtml(prefix)}menu · ${escapeHtml(prefix)}reg …</small></span></button>`).join('')}</div><span class="field-hint">Con este prefijo se escriben los comandos del bot. Puedes cambiarlo después.</span></div></div>`;
  } else if (step === 2) {
    title = 'Número y vinculación';
    description = 'Ingresa el número del bot y elige cómo vincularlo con WhatsApp.';
    const phoneValue = escapeHtml(flow.phone);
    content = `<div class="wizard-form"><label class="field"><span class="field-label">Número del bot</span><input class="text-input" type="tel" inputmode="tel" name="flow-phone" data-flow="phone" value="${phoneValue}" placeholder="+57 301 944 8245" autocomplete="tel" /><span class="field-hint">WhatsApp enviará el código de vinculación a este número.</span></label><div class="field"><span class="field-label">Cómo quieres vincularlo</span><div class="pairing-methods"><button class="pairing-option ${flow.pairingMode === 'qr' ? 'is-selected' : ''}" type="button" data-action="select-method" data-method="qr"><span class="pairing-option-icon">${icon('qr')}</span><span><strong>Código QR</strong><small>Escaneas un código desde el dispositivo del bot.</small></span></button><button class="pairing-option ${flow.pairingMode === 'pairing' ? 'is-selected' : ''}" type="button" data-action="select-method" data-method="pairing"><span class="pairing-option-icon">${icon('hash')}</span><span><strong>Código de 8 dígitos <span class="visually-hidden">Pairing code</span></strong><small>Lo escribes en el dispositivo del bot.</small></span></button></div></div></div>`;
  } else if (step === 3) {
    title = 'Resumen';
    description = 'Revisa los datos. El bot se creará desconectado: la activación es con .key.';
    const server = state.system?.server;
    content = `<div class="wizard-form"><div class="callout">${icon('bulb')}<span><strong>Este es el servidor real donde correrá tu bot.</strong><br />${escapeHtml(server?.hostname || 'Servidor')} · ${escapeHtml(server?.platform || '—')} · Node ${escapeHtml(server?.node || '—')}</span></div><div class="profile-details"><div class="profile-detail"><span>Nombre</span><strong>${escapeHtml(flow.name || '—')}</strong></div><div class="profile-detail"><span>Prefijo</span><strong class="mono">${escapeHtml(flow.prefix)}</strong></div><div class="profile-detail"><span>Número</span><strong>${escapeHtml(flow.phone || '—')}</strong></div><div class="profile-detail"><span>Vinculación</span><strong>${flow.pairingMode === 'qr' ? 'Código QR' : 'Código de 8 dígitos'}</strong></div></div></div>`;
  } else if (step === 4) {
    return renderConnectStep();
  } else if (step === 5) {
    title = 'Tu bot está en línea';
    description = 'La instancia está activada y conectada.';
    content = `<div class="success-panel"><span class="success-icon">${icon('check')}</span><h2>¡Listo!</h2><p>Tu bot está <strong>activado y vinculado</strong>. Escríbele <strong>${escapeHtml(flow.prefix)}menu</strong> en un grupo para ver todo lo que puede hacer.</p><div class="wizard-actions"><button class="btn btn-outline" type="button" data-action="reset-flow">Crear otro</button><button class="btn btn-primary" type="button" data-page="bots">Ir a Mis Bots ${icon('arrow-right')}</button></div></div>`;
    return `<div class="page-content"><div class="wizard-wrap"><section class="wizard-card wizard-step-6" aria-labelledby="wizard-title"><span class="wizard-step-label">COMPLETADO</span><h1 class="wizard-title" id="wizard-title">${escapeHtml(title)}</h1><p class="wizard-description">${escapeHtml(description)}</p>${content}</section>${pageFooter()}</div></div>`;
  }

  const progress = regularStep ? `<div class="stepper" aria-label="Paso ${step} de 3"><span class="stepper-track"><span class="stepper-fill" style="width:${((step - 1) / 2) * 100}%"></span></span>${[1, 2, 3].map((numberStep) => `<span class="stepper-item ${numberStep === step ? 'is-active' : ''} ${numberStep < step ? 'is-complete' : ''}" aria-current="${numberStep === step ? 'step' : 'false'}">${numberStep < step ? icon('check') : numberStep}</span>`).join('')}</div>` : '';
  const stepLabel = `PASO ${step}`;
  let actionButtons = '';
  if (step === 1) {
    actionButtons = `<div class="wizard-actions is-single"><button class="btn btn-primary" type="button" data-action="wizard-next">Continuar ${icon('arrow-right')}</button></div>`;
  } else if (step === 2 || step === 3) {
    actionButtons = `<div class="wizard-actions"><button class="btn btn-outline" type="button" data-action="wizard-back">${icon('arrow-left')} Atrás</button><button class="btn btn-primary" type="button" data-action="${step === 3 ? 'generate-link' : 'wizard-next'}" ${flow.loading ? 'disabled' : ''}>${step === 3 ? `${icon('plus')} Crear bot` : `Continuar ${icon('arrow-right')}`}</button></div>`;
  }
  const flowError = flow.error ? `<p class="link-error" role="alert">${escapeHtml(flow.error)}</p>` : '';
  return `<div class="page-content"><div class="wizard-wrap">${progress}<section class="wizard-card wizard-step-${step}" aria-labelledby="wizard-title"><span class="wizard-step-label">${stepLabel}</span><h1 class="wizard-title" id="wizard-title">${escapeHtml(title)}</h1><p class="wizard-description">${escapeHtml(description)}</p>${content}${flowError}${actionButtons}</section><p class="wizard-footer-note">© 2026 <span class="purple">Stellar The Best's Corp.</span> All rights reserved.</p>${pageFooter()}</div></div>`;
}

/** Panel de conexión: activación con `.key` + QR/pairing REAL de WhatsApp. */
function renderConnectStep() {
  const flow = state.flow;
  const link = flow.linkData ?? {};
  const target = state.instances.find((item) => item.id === flow.instanceId) ?? {};
  const activated = Boolean(target.activated ?? link.activated);
  const connected = ['open', 'connected'].includes(String(link.status || '').toLowerCase());
  const qrTtl = link.qrExpiresInSec ?? state.me?.qrExpiresInSec ?? 60;
  return `<div class="page-content"><div class="wizard-wrap"><section class="wizard-card wizard-step-5" aria-labelledby="wizard-title"><span class="wizard-step-label">CONECTAR EN WHATSAPP</span><h1 class="wizard-title" id="wizard-title">Conecta tu bot</h1><p class="wizard-description">${escapeHtml(flow.name || target.name || 'Tu bot')} fue creado <strong>desconectado</strong>. Actívalo con <code>.key</code> y vincúlalo con WhatsApp.</p>

    <div class="bots-summary" style="margin:14px 0"><article class="card summary-tile"><span>Activado</span><strong class="${activated ? 'green' : ''}">${activated ? 'Sí' : 'No'}</strong></article><article class="card summary-tile"><span>Vinculado</span><strong class="${connected ? 'green' : ''}">${connected ? 'Sí' : 'No'}</strong></article><article class="card summary-tile"><span>Prefijo</span><strong class="mono">${escapeHtml(target.prefix || flow.prefix || '.')}</strong></article></div>

    <div class="callout">${icon('shield')}<span><strong>Paso 1 · Pide tu clave en WhatsApp</strong><br />Escribe <code>.key</code> desde WhatsApp a este bot (o a cualquier bot conectado de la plataforma). El bot te responderá con una clave de un solo uso. También funciona con # - + . /</span></div>

    <form class="wizard-form" id="activate-key-form" data-id="${escapeHtml(flow.instanceId || '')}"><label class="field"><span class="field-label">Clave de activación</span><input class="text-input mono" type="text" name="activation-key" value="${escapeHtml(flow.connectKey || '')}" placeholder="ABCD-2345" autocomplete="off" maxlength="20" /><span class="field-hint">Paso 2 · Pega aquí la clave que te dio el bot para activarlo.</span></label><button class="btn btn-primary btn-full" type="submit" ${flow.connectLoading ? 'disabled' : ''}>${icon('check')} Activar bot</button></form>
    ${flow.connectError ? `<p class="link-error" role="alert">${escapeHtml(flow.connectError)}</p>` : ''}

    <div class="callout" style="margin-top:18px">${icon('link')}<span><strong>Paso 3 · Vincula con WhatsApp</strong><br />${flow.pairingMode === 'qr' ? 'Escanea el QR desde el teléfono del bot: WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo.' : 'En el teléfono del bot: WhatsApp → Ajustes → Dispositivos vinculados → Vincular con el número de teléfono.'}</span></div>

    ${flow.loading ? `<div class="loading-panel"><span class="loading-spinner"></span><span>Generando vinculación real…</span></div>` : ''}
    ${!flow.loading && flow.pairingMode === 'qr' && link.qrDataUrl ? `<div class="qr-frame"><img src="${escapeHtml(link.qrDataUrl)}" alt="Código QR real de WhatsApp para vincular el bot" /></div><span class="expiry-label">QR real de WhatsApp · se renueva cada ${qrTtl}s</span>` : ''}
    ${!flow.loading && flow.pairingMode !== 'qr' && (link.pairingFormatted || link.pairingCode) ? `<div class="qr-frame" style="display:flex;align-items:center;justify-content:center"><strong class="mono" style="font-size:30px;letter-spacing:6px">${escapeHtml(String(link.pairingFormatted || link.pairingCode))}</strong></div><span class="expiry-label">Pairing code real de WhatsApp · caduca en ~60s</span>` : ''}
    ${!flow.loading && !link.qrDataUrl && !(link.pairingFormatted || link.pairingCode) ? `<div class="callout">${icon('bulb')}<span>${connected ? 'Ya está vinculado con WhatsApp.' : 'Pulsa Generar para pedir a WhatsApp el QR o el código de vinculación.'}</span></div>` : ''}

    ${flow.connectError === '' && link.lastError ? `<p class="link-error" role="alert">${escapeHtml(link.lastError)}</p>` : ''}
    <div class="wizard-actions"><button class="btn btn-outline" type="button" data-action="wizard-back">${icon('arrow-left')} Cambiar datos</button>${connected && activated ? `<button class="btn btn-primary" type="button" data-action="finish-flow">Finalizar ${icon('arrow-right')}</button>` : `<button class="btn btn-primary" type="button" data-action="refresh-link" ${flow.loading ? 'disabled' : ''}>${icon('link')} ${link.qrDataUrl || link.pairingCode ? 'Reintentar' : 'Generar vinculación'}</button>`}</div>
    </section>${pageFooter()}</div></div>`;
}

/* ── modal de conexión desde Mis Bots ────────────────────────── */

function renderConnectModal() {
  const instance = state.connectTarget;
  if (!instance) return;
  const link = instance.linkData ?? {};
  const activated = Boolean(instance.activated);
  const connected = ['open', 'connected'].includes(String(link.status || instance.status || '').toLowerCase());
  const qrTtl = link.qrExpiresInSec ?? state.me?.qrExpiresInSec ?? 60;
  const content = $('#modal-content');
  content.innerHTML = `<button class="icon-button modal-close" type="button" data-action="close-modal" aria-label="Cerrar">${icon('close')}</button>
    <span class="section-kicker">${icon('whatsapp')} Conectar en WhatsApp</span>
    <h2 id="modal-title" style="margin-top:11px">${escapeHtml(instance.name || 'SubBot')}</h2>
    <p class="modal-description">${escapeHtml(instance.phoneMasked || '')} · prefijo <strong class="mono">${escapeHtml(instance.prefix || '.')}</strong> · ${activated ? 'Activado' : 'Sin activar'} · ${connected ? 'Vinculado' : 'Sin vincular'}</p>

    <div class="callout">${icon('shield')}<span><strong>Activa tu bot con .key</strong><br />Escribe <code>.key</code> desde WhatsApp a este bot (o a cualquier bot conectado) y pega aquí la clave que te devuelve.</span></div>
    <form class="modal-form" id="activate-key-form" data-id="${escapeHtml(instance.id)}"><label class="field"><span class="field-label">Clave de activación</span><input class="text-input mono" type="text" name="activation-key" value="${escapeHtml(state.connectKey || '')}" placeholder="ABCD-2345" autocomplete="off" maxlength="20" ${activated ? 'disabled' : ''} /></label>${activated ? `<p class="field-hint">Este bot ya está activado.</p>` : `<button class="btn btn-primary btn-full" type="submit" ${state.connectLoading ? 'disabled' : ''}>${icon('check')} Activar bot</button>`}</form>
    ${state.connectError ? `<p class="link-error" role="alert">${escapeHtml(state.connectError)}</p>` : ''}

    <div class="callout" style="margin-top:14px">${icon('link')}<span><strong>Vinculación real con WhatsApp</strong><br />${instance.pairingMode === 'qr' ? 'Escanea el QR con el teléfono del bot.' : 'Escribe el pairing code en el teléfono del bot.'}</span></div>
    ${instance.pairingMode === 'qr' && link.qrDataUrl ? `<div class="qr-frame"><img src="${escapeHtml(link.qrDataUrl)}" alt="Código QR real de WhatsApp" /></div><span class="expiry-label">QR real · se renueva cada ${qrTtl}s</span>` : ''}
    ${instance.pairingMode !== 'qr' && (link.pairingFormatted || link.pairingCode) ? `<div class="qr-frame" style="display:flex;align-items:center;justify-content:center"><strong class="mono" style="font-size:28px;letter-spacing:6px">${escapeHtml(String(link.pairingFormatted || link.pairingCode))}</strong></div><span class="expiry-label">Pairing code real · caduca en ~60s</span>` : ''}
    ${!link.qrDataUrl && !(link.pairingFormatted || link.pairingCode) ? `<div class="callout">${icon('bulb')}<span>${connected ? 'Ya está vinculado con WhatsApp.' : 'Pulsa Generar para pedir a WhatsApp el QR o el código.'}</span></div>` : ''}

    <div class="wizard-actions" style="margin-top:14px"><button class="btn btn-outline" type="button" data-action="refresh-connect-link">${icon('link')} ${link.qrDataUrl || link.pairingCode ? 'Reintentar' : 'Generar vinculación'}</button>${connected && activated ? `<button class="btn btn-primary" type="button" data-action="close-modal">Listo ${icon('check')}</button>` : ''}</div>`;
}

function openConnect(instance) {
  state.connectTarget = { ...instance, linkData: null };
  state.connectKey = '';
  state.connectError = '';
  state.connectLoading = false;
  renderConnectModal();
  $('#modal-layer').hidden = false;
  document.body.classList.add('modal-open');
  request(`/instances/${encodeURIComponent(instance.id)}/link`).then((data) => {
    if (state.connectTarget?.id === instance.id) {
      state.connectTarget = { ...state.connectTarget, ...data, linkData: data };
      renderConnectModal();
      if (!['open', 'connected'].includes(String(data.status || ''))) pollConnect(instance.id);
    }
  }).catch((error) => showToast(error.message, 'error'));
}

function pollConnect(id) {
  let attempts = 0;
  const timer = setInterval(async () => {
    attempts += 1;
    if (!state.connectTarget || state.connectTarget.id !== id || attempts > 20) { clearInterval(timer); return; }
    try {
      const data = await request(`/instances/${encodeURIComponent(id)}/link`);
      if (!state.connectTarget || state.connectTarget.id !== id) { clearInterval(timer); return; }
      state.connectTarget = { ...state.connectTarget, ...data, linkData: data };
      renderConnectModal();
      if (['open', 'connected'].includes(String(data.status || ''))) {
        clearInterval(timer);
        showToast('¡Sesión vinculada con WhatsApp!', 'success');
        loadAdminData({ quiet: true });
      }
    } catch { /* reintenta en el próximo tick */ }
  }, 4000);
}

/* ── métricas (telemetría real del servidor) ─────────────────── */

function renderMetrics() {
  const sys = state.system;
  const server = sys?.server;
  const db = sys?.database;
  const wa = sys?.whatsapp;
  const serverCards = [
    { label: 'Uptime', value: server ? formatUptime(server.uptimeMs) : '—', note: 'Servidor del panel', icon: 'clock' },
    { label: 'CPU', value: server ? `${server.cpu.usagePercent}%` : '—', note: server ? `${server.cpu.cores} cores · carga ${server.cpu.loadAvg}` : '—', icon: 'cpu', progress: server ? Math.min(100, server.cpu.usagePercent) : 0 },
    { label: 'RAM', value: server ? `${server.memory.usagePercent}%` : '—', note: server ? `${formatBytes(server.memory.usedBytes)} / ${formatBytes(server.memory.totalBytes)}` : '—', icon: 'server', progress: server ? Math.min(100, server.memory.usagePercent) : 0, green: true },
    { label: 'Base de datos', value: db ? formatBytes(db.sizeBytes) : '—', note: db ? escapeHtml(db.path) : '—', icon: 'code' },
    { label: 'Mensajes', value: formatNumber(db?.counters?.messages ?? 0), note: 'Procesados por los bots', icon: 'bolt', indicator: true },
    { label: 'Comandos', value: formatNumber(db?.commandsExecuted ?? 0), note: 'Ejecutados (real)', icon: 'code', indicator: true },
    { label: 'Peticiones API', value: formatNumber(db?.counters?.apiRequests ?? 0), note: 'Al panel web', icon: 'server', indicator: true },
    { label: 'Instancias', value: formatNumber(wa?.instances ?? 0), note: `${wa?.connected ?? 0} conectadas · ${wa?.activated ?? 0} activadas`, icon: 'bot' },
  ];
  const topCommands = (db?.topCommands || []);
  const maxCount = Math.max(1, ...topCommands.map((entry) => entry.count));
  const tableRows = Object.entries(db?.tables || {});
  return `<div class="page-content"><div class="page-heading"><div><span class="section-kicker">${icon('chart')} Monitor del sistema</span><h1>Telemetría y Rendimiento</h1><p>Datos reales del servidor, la base de datos y tus sesiones de WhatsApp.</p></div><button class="btn btn-outline btn-small" type="button" data-action="refresh-data">${icon('link')} Actualizar</button></div>
    <div class="metrics-grid metrics-grid-large">${serverCards.map((metric) => `<article class="card telemetry-card"><span class="metric-label">${icon(metric.icon)}${escapeHtml(metric.label)}</span>${metric.indicator ? '<i class="metric-indicator"></i>' : ''}<strong class="metric-value">${escapeHtml(metric.value)}</strong><span class="metric-note">${metric.note}</span>${metric.progress != null ? `<div class="progress-track"><div class="progress-value ${metric.green ? 'green-fill' : ''}" style="width:${metric.progress}%"></div></div>` : ''}</article>`).join('')}</div>

    <section class="section-block"><div class="section-heading"><div><span class="section-kicker">${icon('cpu')} Servidor</span><h2 class="section-title">Dónde corre tu bot</h2></div></div><div class="card service-list"><div class="service-row"><span class="service-info"><span class="green">●</span>${escapeHtml(server?.hostname || 'Servidor')}</span><span class="mono">${escapeHtml(server?.platform || '—')}</span><span class="service-meta"><span>${escapeHtml(server?.arch || '')}</span><span>Node ${escapeHtml(server?.node || '—')}</span></span></div><div class="service-row"><span class="service-info"><span class="green">●</span>Base de datos</span><span class="mono">${escapeHtml(db?.path || '—')}</span><span class="service-meta"><span>${db ? formatBytes(db.sizeBytes) : '—'}</span><span>SQLite (WAL)</span></span></div><div class="service-row"><span class="service-info"><span class="green">●</span>WhatsApp</span><span class="mono">${wa?.connected ?? 0}/${wa?.instances ?? 0} conectadas</span><span class="service-meta"><span>${wa?.groups ?? 0} grupos</span><span>Multi-Device</span></span></div></div></section>

    <section class="section-block"><div class="section-heading"><div><span class="section-kicker">${icon('bolt')} Uso real</span><h2 class="section-title">Top comandos</h2><p class="section-copy">Contados en la base de datos cada vez que se ejecutan.</p></div></div><div class="card ranking-list">${topCommands.length ? topCommands.map((entry, index) => `<div class="ranking-row"><span class="rank-number">#${index + 1}</span><span><code>${escapeHtml(entry.command)}</code><span class="ranking-bar-wrap"><i class="ranking-bar" style="display:block;width:${Math.round((entry.count / maxCount) * 100)}%"></i></span></span><strong class="mono">${formatNumber(entry.count)}</strong></div>`).join('') : '<div class="endpoint-empty">Todavía no se ejecutó ningún comando.</div>'}</div></section>

    <section class="section-block"><div class="section-heading"><div><span class="section-kicker">${icon('code')} Base de datos</span><h2 class="section-title">Registros guardados</h2><p class="section-copy">Conteo real de filas por tabla.</p></div></div><div class="card service-list">${tableRows.map(([table, count]) => `<div class="service-row"><span class="service-info"><span class="green">●</span>${escapeHtml(table)}</span><span class="mono">${formatNumber(count)}</span></div>`).join('')}</div></section>
    ${pageFooter()}</div>`;
}

/* ── tienda (planes reales de la base de datos) ──────────────── */

function renderStore() {
  const plans = state.apiPlans || [];
  const cards = plans.map((plan, index) => {
    const palette = ['#9b5cf6', '#a05cf3', '#f0b62b', '#e4548b'][index % 4];
    const features = Array.isArray(plan.features) ? plan.features : [];
    return `<article class="card plan-card ${plan.popular ? 'is-popular' : ''}" style="--plan-color:${palette}">${plan.popular ? '<span class="plan-ribbon">MÁS POPULAR</span>' : ''}<div class="plan-head"><span class="plan-icon">${icon(index === 0 ? 'bolt' : index === 1 ? 'gem' : index === 2 ? 'crown' : 'briefcase')}</span><span><span class="plan-name"><h2>${escapeHtml(plan.name)}</h2><span class="plan-tier">${escapeHtml(plan.name)}</span></span></span></div><p class="plan-description">${escapeHtml(features[0] || 'Más potencia y flexibilidad para tus proyectos.')}</p><ul class="plan-features"><li><span class="plan-feature-icon">${icon('bolt')}</span><span><strong>${formatNumber(plan.credits)}</strong> créditos</span></li>${features.slice(1, 4).map((feature, featureIndex) => `<li><span class="plan-feature-icon">${icon(['lock', 'clock', 'server'][featureIndex])}</span><span>${escapeHtml(feature)}</span></li>`).join('')}</ul><div class="plan-price"><span>${plan.price === 0 ? 'Gratis' : `$${Number(plan.price).toFixed(2)}`}</span>${plan.price > 0 ? '<small>USD</small>' : ''}</div><button class="btn btn-primary btn-full" type="button" data-action="purchase-plan" data-plan="${escapeHtml(plan.id || plan.name.toLowerCase())}">Contratar</button></article>`;
  }).join('');
  return `<div class="page-content"><section class="store-hero"><span class="section-kicker">${icon('spark')} Créditos para tu API</span><h1>Hola, <span class="gradient-text">${escapeHtml(state.apiUser?.username || 'bienvenido')}</span></h1><p>Planes y precios guardados en la base de datos del panel.</p></section>${plans.length ? `<div class="plan-grid">${cards}</div>` : `<div class="empty-state"><span class="empty-state-icon">${icon('crown')}</span><h2>No hay planes configurados</h2><p>Los planes se cargan desde la base de datos del panel.</p></div>`}<form class="coupon-inline" id="store-coupon-form"><input class="text-input" type="text" name="coupon" placeholder="¿Tienes un código de regalo?" autocomplete="off"/><button class="btn btn-outline" type="submit">${icon('gift')} Canjear</button></form><p class="field-hint" id="store-coupon-message" style="text-align:center"></p>${pageFooter()}</div>`;
}

/* ── endpoints (catálogo del backend) ────────────────────────── */

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
    <div class="catalog-toolbar"><label class="search-box">${icon('search')}<input id="endpoint-search" class="text-input" type="search" value="${escapeHtml(state.endpointQuery)}" placeholder="Buscar endpoint… (ej: Spotify, TikTok, AI)" autocomplete="off" /></label><div class="filter-row"><button class="filter-chip ${state.endpointMethod === 'all' ? 'is-active' : ''}" type="button" data-action="endpoint-method" data-method="all">Todos</button>${['get', 'post', 'put', 'delete', 'patch'].map((method) => `<button class="filter-chip ${state.endpointMethod === method ? 'is-active' : ''}" type="button" data-action="endpoint-method" data-method="${method}">${method}</button>`).join('')}</div><div class="category-select-row"><select id="endpoint-category" class="select-input" aria-label="Categoría">${['all', ...state.endpoints.map((category) => category.name)].map((category) => `<option value="${escapeHtml(category)}" ${state.endpointCategory === category ? 'selected' : ''}>${category === 'all' ? 'Todas las categorías' : escapeHtml(category)}</option>`).join('')}</select><div class="filter-row"><button class="filter-chip ${state.endpointTier === 'all' ? 'is-active' : ''}" type="button" data-action="endpoint-tier" data-tier="all">Todos</button><button class="filter-chip ${state.endpointTier === 'free' ? 'is-active' : ''}" type="button" data-action="endpoint-tier" data-tier="free">Free</button><button class="filter-chip ${state.endpointTier === 'premium' ? 'is-active' : ''}" type="button" data-action="endpoint-tier" data-tier="premium">Premium</button><button class="filter-chip ${state.endpointTier === 'hybrid' ? 'is-active' : ''}" type="button" data-action="endpoint-tier" data-tier="hybrid">Híbrido</button></div></div></div>
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
  $('#endpoint-modal').innerHTML = `<div class="endpoint-modal-head"><span class="bot-orb">${icon('code')}</span><span><h2 id="endpoint-modal-title">${escapeHtml(endpoint.name)}</h2><p>${escapeHtml(endpoint.description || endpoint.path)}</p></span><div class="endpoint-modal-actions"><button class="icon-button" type="button" data-action="copy-endpoint-url" aria-label="Copiar URL">${icon('link')}</button><button class="icon-button" type="button" data-action="close-endpoint" aria-label="Cerrar">${icon('close')}</button></div></div><div class="endpoint-modal-body"><section class="endpoint-url-box"><div class="endpoint-url-label"><span>${icon('bolt')} Endpoint URL</span><button class="key-switch ${state.endpointWithKey ? 'is-on' : ''}" type="button" data-action="toggle-endpoint-key"><span>Con key</span><i></i></button></div><div class="endpoint-url-line"><span class="method-badge">${escapeHtml(endpoint.method || 'GET')}</span><code id="endpoint-url-text">https://api.stellarwa.xyz${escapeHtml(path)}</code><button class="icon-button" type="button" data-action="copy-endpoint-url" aria-label="Copiar URL">${icon('copy')}</button><a class="icon-button" href="https://api.stellarwa.xyz${escapeHtml(path)}" target="_blank" rel="noreferrer" aria-label="Abrir endpoint">${icon('external')}</a></div></section><div><span class="endpoint-url-label">Código de ejemplo</span><div class="code-tabs">${[['curl', 'cURL'], ['javascript', 'JavaScript'], ['typescript', 'TypeScript'], ['python', 'Python']].map(([key, label]) => `<button class="${state.endpointCodeTab === key ? 'is-active' : ''}" type="button" data-action="endpoint-code-tab" data-tab="${key}">${label}</button>`).join('')}</div></div><section class="code-window"><div class="code-window-top"><span><i class="traffic-lights"><i></i><i></i><i></i></i> example.${state.endpointCodeTab === 'python' ? 'py' : state.endpointCodeTab === 'curl' ? 'sh' : 'js'}</span><button class="btn btn-outline btn-small" type="button" data-action="copy-endpoint-code">${icon('copy')} Copiar</button></div><pre><code>${escapeHtml(codeSnippet(endpoint))}</code></pre></section><form id="endpoint-playground-form" class="endpoint-params"><h3>${icon('chart')} Parámetros de entrada</h3><label class="field"><span class="field-label">${escapeHtml(param.name)} <span class="red">*</span></span><input class="text-input" name="endpoint-value" required placeholder="${escapeHtml(param.placeholder)}" /></label><button class="btn btn-primary btn-full" type="submit">${icon('bolt')} Realizar petición</button><p class="field-hint" id="endpoint-playground-message">Prueba visual del formulario. Las llamadas al catálogo externo no se ejecutan desde este panel.</p></form></div>`;
  $('#endpoint-layer').hidden = false;
  document.body.classList.add('modal-open');
}

/* ── tickets (guardados en la base de datos) ────────────────── */

function renderTickets() {
  const tickets = state.tickets || [];
  const counts = state.ticketCounts || { total: tickets.length, Abierto: 0, Respondido: 0, Cerrado: 0 };
  const rows = tickets.length ? tickets.map((ticket) => `<article class="ticket-row"><span class="drawer-item-icon">${icon('ticket')}</span><span><strong>${escapeHtml(ticket.title)}</strong><small class="muted">${escapeHtml(ticket.id)} · ${new Date(ticket.created_at).toLocaleDateString('es')}</small></span><span class="status-badge ${ticket.status === 'Cerrado' ? 'status-offline' : ''}">${escapeHtml(ticket.status)}</span></article>`).join('') : `<div class="ticket-empty">${icon('search')}<strong>No hay tickets</strong><p>Cuando abras un ticket, quedará guardado en la base de datos del panel.</p></div>`;
  return `<div class="page-content"><section class="ticket-hero"><div><span class="section-kicker">${icon('headset')} Soporte</span><h1>Centro de Tickets</h1><p>Reporta incidencias y consulta su estado. Los tickets se guardan en la base de datos.</p></div><button class="btn btn-primary btn-large" type="button" data-action="toggle-ticket-form">${icon('plus')} Nuevo ticket</button></section><div class="ticket-stats"><article class="card ticket-stat"><span class="stat-icon">${icon('ticket')}</span><strong>${counts.total}</strong><span>Total</span></article><article class="card ticket-stat"><span class="stat-icon" style="color:var(--blue);background:rgba(85,169,255,.12)">${icon('folder')}</span><strong class="blue">${counts.Abierto}</strong><span>Abiertos</span></article><article class="card ticket-stat"><span class="stat-icon" style="color:var(--yellow);background:rgba(244,189,56,.12)">${icon('users')}</span><strong class="yellow">${counts.Respondido}</strong><span>Respondidos</span></article><article class="card ticket-stat"><span class="stat-icon" style="color:var(--green);background:var(--green-tint)">${icon('check')}</span><strong class="green">${counts.Cerrado}</strong><span>Cerrados</span></article></div>${state.newTicketOpen ? `<form id="ticket-form" class="card profile-card" style="margin-bottom:18px"><h2>Crear un ticket</h2><div class="wizard-form"><label class="field"><span class="field-label">Asunto</span><input class="text-input" name="ticket-title" required maxlength="90" placeholder="Describe brevemente tu consulta" /></label><label class="field"><span class="field-label">Mensaje</span><textarea class="text-area" name="ticket-message" required maxlength="1200" placeholder="Cuéntanos qué ocurrió…"></textarea></label><div class="page-heading-actions"><button class="btn btn-outline" type="button" data-action="toggle-ticket-form">Cancelar</button><button class="btn btn-primary" type="submit">Enviar ticket ${icon('arrow-right')}</button></div></div></form>` : ''}<section class="section-block" style="margin-top:0"><div class="section-heading"><div><span class="section-kicker">${icon('ticket')} Historial</span><h2 class="section-title">Mis solicitudes</h2><p class="section-copy">Historial y seguimiento de tus consultas (base de datos).</p></div></div><div class="ticket-toolbar"><label class="search-box">${icon('search')}<input class="text-input" id="ticket-search" type="search" placeholder="Buscar…" /></label><button class="btn btn-outline" type="button" data-action="toggle-ticket-form">${icon('plus')} Crear</button></div><div class="card" id="ticket-list">${rows}</div></section>${pageFooter()}</div>`;
}

/* ── perfil ──────────────────────────────────────────────────── */

function renderProfile() {
  const user = state.apiUser;
  const sys = state.system;
  const db = sys?.database;
  return `<div class="page-content"><div class="page-heading"><div><span class="section-kicker">${icon('users')} Cuenta</span><h1>Mi Perfil</h1><p>Tu cuenta de la tienda y el estado real de la plataforma.</p></div></div><div class="profile-grid"><section class="card profile-card"><h2>Cuenta de Stellar</h2>${user ? `<div class="profile-details"><div class="profile-detail"><span>Usuario</span><strong>${escapeHtml(user.username || '—')}</strong></div><div class="profile-detail"><span>Email</span><strong>${escapeHtml(user.email || '—')}</strong></div><div class="profile-detail"><span>Plan</span><strong>${escapeHtml(user.plan || 'Free')}</strong></div><div class="profile-detail"><span>Créditos</span><strong>${formatNumber(user.credits || 0)}</strong></div></div><p class="field-hint" style="margin-top:16px">Tu API key es privada. No la compartas en repositorios públicos.</p>` : `<p class="section-copy" style="font-size:13px">Crea una cuenta para consultar créditos y tus transacciones de la tienda.</p><button class="btn btn-primary" type="button" data-action="open-api-auth">${icon('users')} Iniciar sesión</button>`}</section><section class="card profile-card"><h2>Plataforma</h2><div class="profile-details"><div class="profile-detail"><span>Producto</span><strong>${escapeHtml(state.me?.bot?.name || 'Stellar Wa')}</strong></div><div class="profile-detail"><span>Servidor</span><strong>${escapeHtml(sys?.server?.hostname || '—')}</strong></div><div class="profile-detail"><span>Base de datos</span><strong>${escapeHtml(db?.path || '—')}</strong></div><div class="profile-detail"><span>Instancias máximas</span><strong>${state.me?.limits?.maxInstances ?? 3}</strong></div><div class="profile-detail"><span>Panel</span><strong class="green">Abierto (sin contraseña)</strong></div></div></section>${user ? `<section class="card profile-card"><h2>Tu API Key</h2><div class="profile-key"><code>${escapeHtml(user.apiKey || user.api_key || '—')}</code><button class="icon-button" type="button" data-action="copy-api-key" aria-label="Copiar API key">${icon('copy')}</button></div></section><section class="card profile-card"><h2>Créditos</h2><p class="section-copy" style="font-size:13px">Balance actual: <strong class="purple">${formatNumber(user.credits || 0)}</strong></p><a class="btn btn-primary" href="/store" data-page="store">Ver tienda ${icon('arrow-right')}</a></section>` : ''}</div>${pageFooter()}</div>`;
}

/* ── comandos ────────────────────────────────────────────────── */

const commandExamples = [
  { group: 'Activación', names: ['key'] },
  { group: 'Información', names: ['menu', 'help', 'ping', 'botinfo', 'owner'] },
  { group: 'Registro', names: ['reg', 'unreg', 'editar', 'ficha'] },
  { group: 'Personajes', names: ['rol', 'cambiarol', 'roles', 'mirol', 'reservar'] },
  { group: 'Gestión', names: ['team', 'miembros', 'afk', 'afks', 'inactivos'] },
  { group: 'Administración', names: ['add', 'expulsar', 'ban', 'unban', 'warn', 'pendientes'] },
];
function renderCommands() {
  return `<div class="page-content"><div class="page-heading"><div><span class="section-kicker">${icon('code')} Referencia</span><h1>Comandos</h1><p>Cada bot usa el prefijo que elegiste al crearlo: <code>#</code> <code>-</code> <code>+</code> <code>.</code> <code>/</code>. El comando de activación <code>.key</code> funciona con cualquiera de ellos.</p></div><label class="search-box" style="max-width:360px;flex:1">${icon('search')}<input class="text-input" id="command-search" type="search" placeholder="Buscar comando…" autocomplete="off" /></label></div><div class="command-grid">${commandExamples.map((group) => `<section class="card command-card"><h2>${escapeHtml(group.group)}</h2><div class="command-pills">${group.names.map((name) => `<button class="command-pill" type="button" data-action="copy-command" data-command="${escapeHtml(name)}"><code>${escapeHtml(name)}</code></button>`).join('')}</div></section>`).join('')}</div>${pageFooter()}</div>`;
}

/* ── router de páginas ───────────────────────────────────────── */

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
  if (view === 'tickets') loadTickets();
  if (view === 'profile') loadSystem({ quiet: true });
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
  $('#menu-drawer').innerHTML = `<div class="drawer-profile"><span class="avatar">${escapeHtml(initials(state.apiUser?.username || 'Invitado'))}</span><span class="drawer-profile-copy"><strong>${escapeHtml(state.apiUser?.username || 'Invitado')}</strong><small>${escapeHtml(String(state.apiUser?.plan || 'FREE').toUpperCase())}</small></span><button class="icon-button drawer-close" type="button" data-action="close-drawer" aria-label="Cerrar menú">${icon('close')}</button></div><div class="drawer-section"><p class="drawer-section-label">Navegación <span>01 — 06</span></p>${item('home', 'Inicio', 'Panel principal', 'home')}${item('register', 'Registrar Bot', 'Crea y activa un bot', 'plus')}${item('bots', 'Mis Bots', 'Gestiona tus sesiones', 'bot')}${item('endpoints', 'Endpoints', 'Catálogo completo', 'code')}${item('favorites', 'Favoritos', 'Tus accesos guardados', 'star')}${item('metrics', 'Métricas', 'Telemetría real', 'chart')}${item('store', 'Tienda', 'Planes y productos', 'crown')}${item('tickets', 'Soporte', 'Abrir un ticket', 'headset')}</div><div class="drawer-section"><p class="drawer-section-label">Cuenta</p>${item('profile', 'Mi Perfil', 'Datos y API key', 'users')}${item('commands', 'Comandos', 'Ayuda y referencia', 'spark')}</div><div class="drawer-bottom"><p>© 2026 Stellar The Best's Corp. · Powered by VÉRSOVA</p></div>`;
}

/* ── modales ─────────────────────────────────────────────────── */

function openAuth() {
  state.authMode = state.authMode === 'api-register' ? 'api-register' : 'api-login';
  renderAuthModal();
  $('#modal-layer').hidden = false;
  document.body.classList.add('modal-open');
  setTimeout(() => $('#modal-content input')?.focus(), 40);
}
function closeModal() {
  $('#modal-layer').hidden = true;
  state.connectTarget = null;
  document.body.classList.remove('modal-open');
}
function renderAuthModal() {
  const isRegister = state.authMode === 'api-register';
  const content = $('#modal-content');
  content.innerHTML = `<button class="icon-button modal-close" type="button" data-action="close-modal" aria-label="Cerrar">${icon('close')}</button><div class="modal-brand">${brandMarkup()}</div><span class="section-kicker">${icon('users')} Mi cuenta</span><h2 id="modal-title" style="margin-top:11px">${isRegister ? 'Crea tu cuenta' : 'Inicia sesión'}</h2><p class="modal-description">Guarda tus créditos y accede a tu API key desde cualquier dispositivo.</p><div class="modal-tabs"><button type="button" class="${!isRegister ? 'is-active' : ''}" data-action="auth-mode" data-mode="api-login">Iniciar sesión</button><button type="button" class="${isRegister ? 'is-active' : ''}" data-action="auth-mode" data-mode="api-register">Crear cuenta</button></div><form class="modal-form" id="api-auth-form"><label class="field"><span class="field-label">Email</span><input class="text-input" name="email" type="email" required autocomplete="email" placeholder="tu@email.com" /></label>${isRegister ? `<label class="field"><span class="field-label">Nombre de usuario</span><input class="text-input" name="username" type="text" required maxlength="32" autocomplete="username" placeholder="tu_usuario" /></label>` : ''}<label class="field"><span class="field-label">Contraseña</span><input class="text-input" name="password" type="password" required minlength="6" autocomplete="${isRegister ? 'new-password' : 'current-password'}" placeholder="${isRegister ? 'Mínimo 6 caracteres' : 'Tu contraseña'}" /></label><p class="modal-error" id="api-auth-error" aria-live="polite"></p><button class="btn btn-primary btn-full" type="submit">${isRegister ? 'Crear cuenta' : 'Iniciar sesión'} ${icon('arrow-right')}</button></form><p class="modal-switch">La cuenta es solo para la tienda de créditos.</p>`;
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

/* ── flujo de creación ───────────────────────────────────────── */

function nextWizardStep() {
  const flow = state.flow;
  flow.error = '';
  if (flow.step === 1) {
    if (!flow.name.trim()) { flow.error = 'Escribe un nombre para identificar tu bot.'; renderPage(); return; }
    flow.step = 2;
  } else if (flow.step === 2) {
    const digits = flow.phone.replace(/\D/g, '');
    if (digits.length < 8) { flow.error = 'Ingresa un número de WhatsApp válido con código de país.'; renderPage(); return; }
    flow.step = 3;
  }
  renderPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function previousWizardStep() {
  const flow = state.flow;
  if (flow.step === 4) flow.step = 3;
  else if (flow.step > 1 && flow.step <= 3) flow.step -= 1;
  flow.error = '';
  renderPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function resetWizard() {
  if (state.flow.poller) clearInterval(state.flow.poller);
  state.flow = { step: 1, name: '', prefix: '.', phone: '', pairingMode: 'pairing', instanceId: null, linkData: null, loading: false, error: '', poller: null, connectKey: '', connectError: '', connectLoading: false };
  navigate('register');
}

/** Crea el bot (desconectado) y abre la pantalla de conexión con .key. */
async function generateLink() {
  const flow = state.flow;
  if (flow.loading) return;
  flow.error = '';
  const phone = flow.phone.replace(/\D/g, '');
  if (phone.length < 8) { flow.step = 2; flow.error = 'Ingresa un número de WhatsApp válido antes de crear el bot.'; renderPage(); return; }
  if (!flow.name.trim()) { flow.step = 1; flow.error = 'Escribe un nombre para identificar la instancia.'; renderPage(); return; }
  flow.loading = true;
  renderPage();
  try {
    if (!flow.instanceId) {
      const created = await request('/instances', {
        method: 'POST',
        body: { name: flow.name.trim(), phone, pairingMode: flow.pairingMode, prefix: flow.prefix },
      });
      flow.instanceId = created.instance?.id;
      if (created.instance) state.instances = [created.instance, ...state.instances.filter((item) => item.id !== created.instance.id)];
      if (!flow.instanceId) throw new Error('El servidor no devolvió la instancia creada.');
      showToast('Bot creado (desconectado). Actívalo con .key.', 'success');
    }
    // inicia la sesión de vinculación: el QR/pairing code son REALES (Baileys)
    try {
      await request(`/instances/${encodeURIComponent(flow.instanceId)}/start`, { method: 'POST' });
    } catch (error) {
      flow.error = error.message || 'No se pudo iniciar la sesión de vinculación.';
    }
    const link = await request(`/instances/${encodeURIComponent(flow.instanceId)}/link`);
    flow.linkData = link;
    flow.loading = false;
    flow.step = 4;
    renderPage();
    showToast(flow.pairingMode === 'qr' ? 'QR real generado' : 'Pairing code real generado', 'success');
    pollForLink();
    loadAdminData({ quiet: true });
  } catch (error) {
    flow.loading = false;
    flow.error = error.message || 'No se pudo crear el bot.';
    renderPage();
    showToast(flow.error, 'error');
  }
}

function pollForLink() {
  if (state.flow.poller) clearInterval(state.flow.poller);
  let attempts = 0;
  state.flow.poller = setInterval(async () => {
    attempts += 1;
    if (state.view !== 'register' || !state.flow.instanceId || attempts > 30) { clearInterval(state.flow.poller); state.flow.poller = null; return; }
    try {
      const link = await request(`/instances/${encodeURIComponent(state.flow.instanceId)}/link`);
      state.flow.linkData = link;
      const target = state.instances.find((item) => item.id === state.flow.instanceId);
      const connected = ['open', 'connected'].includes(String(link.status || '').toLowerCase());
      if (connected && (target?.activated ?? link.activated)) {
        clearInterval(state.flow.poller);
        state.flow.poller = null;
        state.flow.step = 5;
        showToast('¡Sesión conectada y activada!', 'success');
      }
      if (state.view === 'register') renderPage();
    } catch { /* reintenta en el próximo tick */ }
  }, 4000);
}

async function refreshLink() {
  const flow = state.flow;
  if (!flow.instanceId) { await generateLink(); return; }
  flow.loading = true;
  flow.error = '';
  renderPage();
  try {
    await request(`/instances/${encodeURIComponent(flow.instanceId)}/start`, { method: 'POST' }).catch(() => null);
    if (flow.pairingMode === 'pairing') await request(`/instances/${encodeURIComponent(flow.instanceId)}/pairing/refresh`, { method: 'POST' }).catch(() => null);
    const link = await request(`/instances/${encodeURIComponent(flow.instanceId)}/link`);
    flow.linkData = link;
    flow.loading = false;
    renderPage();
    showToast('Vinculación real actualizada', 'success');
    pollForLink();
  } catch (error) {
    flow.loading = false;
    flow.error = error.message;
    renderPage();
    showToast(error.message, 'error');
  }
}

/** Canjea la clave de `.key` para activar el bot (flujo del panel). */
async function activateInstance(id, key) {
  if (!id) return;
  const clean = String(key || '').trim();
  if (!clean) {
    const message = 'Escribe la clave que te dio el bot con el comando .key.';
    if (state.connectTarget) { state.connectError = message; renderConnectModal(); }
    else { state.flow.connectError = message; renderPage(); }
    return;
  }
  if (state.connectTarget) { state.connectLoading = true; state.connectError = ''; renderConnectModal(); }
  else { state.flow.connectLoading = true; state.flow.connectError = ''; renderPage(); }
  try {
    await request(`/instances/${encodeURIComponent(id)}/activate`, { method: 'POST', body: { key: clean } });
    showToast('¡Bot activado! Ya puede usar todos sus comandos.', 'success');
    if (state.connectTarget) { state.connectLoading = false; state.connectKey = ''; }
    else { state.flow.connectLoading = false; state.flow.connectKey = ''; }
    await loadAdminData({ quiet: true });
    if (state.connectTarget) {
      const updated = state.instances.find((item) => item.id === id);
      if (updated) state.connectTarget = { ...state.connectTarget, ...updated };
      renderConnectModal();
    } else {
      renderPage();
      pollForLink();
    }
  } catch (error) {
    const message = error.message || 'No se pudo activar el bot.';
    if (state.connectTarget) { state.connectLoading = false; state.connectError = message; renderConnectModal(); }
    else { state.flow.connectLoading = false; state.flow.connectError = message; renderPage(); }
    showToast(message, 'error');
  }
}

async function refreshConnectLink() {
  const instance = state.connectTarget;
  if (!instance) return;
  try {
    await request(`/instances/${encodeURIComponent(instance.id)}/start`, { method: 'POST' }).catch(() => null);
    if (instance.pairingMode === 'pairing') await request(`/instances/${encodeURIComponent(instance.id)}/pairing/refresh`, { method: 'POST' }).catch(() => null);
    const data = await request(`/instances/${encodeURIComponent(instance.id)}/link`);
    if (state.connectTarget?.id === instance.id) {
      state.connectTarget = { ...state.connectTarget, ...data, linkData: data };
      renderConnectModal();
      showToast('Vinculación real actualizada', 'success');
      pollConnect(instance.id);
    }
  } catch (error) {
    showToast(error.message || 'No se pudo generar la vinculación.', 'error');
  }
}

function openEditInstance(instance) {
  state.editTarget = instance;
  const content = $('#modal-content');
  content.innerHTML = `<button class="icon-button modal-close" type="button" data-action="close-modal" aria-label="Cerrar">${icon('close')}</button><span class="section-kicker">${icon('bot')} Editar bot</span><h2 id="modal-title" style="margin-top:11px">${escapeHtml(instance.name || 'SubBot')}</h2><p class="modal-description">Cambia el nombre o el prefijo de comandos (# - + . /).</p><form class="modal-form" id="edit-instance-form" data-id="${escapeHtml(instance.id)}"><label class="field"><span class="field-label">Nombre</span><input class="text-input" type="text" name="instance-name" value="${escapeHtml(instance.name || '')}" maxlength="40" required /></label><div class="field"><span class="field-label">Prefijo de comandos</span><div class="pairing-methods">${PREFIXES.map((prefix) => `<button class="pairing-option ${(instance.prefix || '.') === prefix ? 'is-selected' : ''}" type="button" data-action="edit-prefix" data-prefix="${prefix}"><span class="pairing-option-icon">${icon('hash')}</span><span><strong>${escapeHtml(prefix)}</strong><small>${escapeHtml(prefix)}menu</small></span></button>`).join('')}</div></div><input type="hidden" name="instance-prefix" value="${escapeHtml(instance.prefix || '.')}" /><button class="btn btn-primary btn-full" type="submit">${icon('check')} Guardar cambios</button></form>`;
  $('#modal-layer').hidden = false;
  document.body.classList.add('modal-open');
}

/* ── datos del servidor ──────────────────────────────────────── */

async function loadAdminData({ quiet = false } = {}) {
  try {
    const results = await Promise.allSettled([
      request('/me'), request('/stats'), request('/instances'), request('/groups'), request('/system'),
    ]);
    if (results[0].status === 'fulfilled') state.me = results[0].value;
    if (results[1].status === 'fulfilled') state.stats = results[1].value;
    if (results[2].status === 'fulfilled') state.instances = results[2].value.instances || [];
    if (results[3].status === 'fulfilled') state.groups = results[3].value.groups || [];
    if (results[4].status === 'fulfilled') state.system = results[4].value;
    if (state.view !== 'landing') renderPage();
    if (!quiet) showToast('Datos actualizados', 'success');
  } catch (error) {
    if (!quiet) showToast(error.message || 'No se pudieron actualizar los datos', 'error');
  }
}

async function loadHealth() {
  try {
    state.health = await request('/health', { apiKey: false });
  } catch { state.health = { ok: false }; }
  updateHeaderStatus();
}
async function loadSystem({ quiet = true } = {}) {
  try {
    state.system = await request('/system', { apiKey: false });
    if (!quiet && state.view === 'metrics') renderPage();
  } catch { /* sin telemetría */ }
}
async function loadCatalog() {
  try {
    const data = await request('/endpoints/catalog', { apiKey: false });
    if (data.ok && Array.isArray(data.categories)) {
      state.endpoints = data.categories;
      state.endpointTotal = data.total || allEndpoints().length;
      if (state.view === 'endpoints' || state.view === 'favorites') { renderPage(); }
    }
  } catch { /* catálogo vacío */ }
}
async function loadPlans({ quiet = false } = {}) {
  try {
    const data = await request('/credits/plans', { apiKey: false });
    if (data.ok && Array.isArray(data.plans)) state.apiPlans = data.plans;
    if (state.view === 'store') renderPage();
  } catch {
    if (!quiet) showToast('No se pudieron cargar los planes', 'info');
  }
}
async function loadTickets() {
  try {
    const data = await request('/tickets', { apiKey: false });
    if (data.ok) {
      state.tickets = data.tickets || [];
      state.ticketCounts = data.counts || null;
      if (state.view === 'tickets') renderPage();
    }
  } catch { /* sin tickets */ }
}
async function loadApiAccount() {
  if (!state.apiUser?.apiKey) return;
  try {
    const data = await request('/credits/me', { apiKey: true });
    if (data.ok) {
      state.apiUser = { ...state.apiUser, ...data.user, apiKey: state.apiUser.apiKey || data.user.api_key };
      safeWrite('sw_user', state.apiUser);
    }
  } catch {
    state.apiUser = null;
    try { localStorage.removeItem('sw_user'); } catch {}
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
    const data = await request(`/credits/${isRegister ? 'register' : 'login'}`, { method: 'POST', body, apiKey: false });
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
  if (!state.apiUser?.apiKey) { state.pendingPlan = planId; openAuth(); return; }
  try {
    const data = await request('/credits/purchase', { method: 'POST', body: { planId }, apiKey: true });
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
  if (!state.apiUser?.apiKey) { openAuth(); showToast('Inicia sesión para canjear tu código.', 'info'); return; }
  const message = $('#store-coupon-message');
  try {
    const result = await request('/credits/redeem', { method: 'POST', body: { code }, apiKey: true });
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
  if (action === 'delete' && !window.confirm('¿Eliminar este SubBot? Esta acción también borra sus datos de la base de datos.')) return;
  try {
    if (action === 'delete') await request(`/instances/${encodeURIComponent(id)}`, { method: 'DELETE' });
    else await request(`/instances/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
    showToast(action === 'stop' ? 'Sesión detenida' : action === 'start' ? 'Sesión iniciada' : 'Sub-bot eliminado', 'success');
    await loadAdminData({ quiet: true });
  } catch (error) {
    showToast(error.message || 'No se pudo actualizar el SubBot.', 'error');
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
async function submitTicket(form) {
  const data = new FormData(form);
  const title = String(data.get('ticket-title') || '').trim();
  const message = String(data.get('ticket-message') || '').trim();
  if (!title || !message) return;
  try {
    await request('/tickets', { method: 'POST', body: { title, message }, apiKey: false });
    state.newTicketOpen = false;
    await loadTickets();
    renderPage();
    showToast('Ticket guardado en la base de datos.', 'success');
  } catch (error) {
    showToast(error.message || 'No se pudo guardar el ticket.', 'error');
  }
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

/* ── eventos ─────────────────────────────────────────────────── */

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
  else if (action === 'open-api-auth') openAuth();
  else if (action === 'auth-mode') { state.authMode = actionTarget.dataset.mode; renderAuthModal(); }
  else if (action === 'wizard-next') nextWizardStep();
  else if (action === 'wizard-back') previousWizardStep();
  else if (action === 'select-prefix') { state.flow.prefix = actionTarget.dataset.prefix; renderPage(); }
  else if (action === 'select-method') { state.flow.pairingMode = actionTarget.dataset.method; renderPage(); }
  else if (action === 'generate-link') generateLink();
  else if (action === 'refresh-link') refreshLink();
  else if (action === 'reset-flow') resetWizard();
  else if (action === 'finish-flow') { state.flow.step = 5; renderPage(); }
  else if (action === 'copy-pairing-code') copyText(actionTarget.dataset.code || '', 'Código copiado');
  else if (action === 'refresh-data') loadAdminData();
  else if (action === 'open-connect') {
    const instance = state.instances.find((item) => item.id === actionTarget.dataset.id);
    if (instance) openConnect(instance);
  }
  else if (action === 'refresh-connect-link') refreshConnectLink();
  else if (action === 'edit-instance') {
    const instance = state.instances.find((item) => item.id === actionTarget.dataset.id);
    if (instance) openEditInstance(instance);
  }
  else if (action === 'edit-prefix') {
    const form = $('#edit-instance-form');
    if (form) {
      form.querySelector('[name="instance-prefix"]').value = actionTarget.dataset.prefix;
      form.querySelectorAll('.pairing-option').forEach((button) => button.classList.toggle('is-selected', button.dataset.prefix === actionTarget.dataset.prefix));
    }
  }
  else if (action === 'start-instance') runInstanceAction('start', actionTarget.dataset.id);
  else if (action === 'stop-instance') runInstanceAction('stop', actionTarget.dataset.id);
  else if (action === 'delete-instance') runInstanceAction('delete', actionTarget.dataset.id);
  else if (action === 'purchase-plan') purchasePlan(actionTarget.dataset.plan);
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
    const filtered = (state.tickets || []).filter((ticket) => `${ticket.id} ${ticket.title} ${ticket.status}`.toLowerCase().includes(query));
    const list = $('#ticket-list');
    if (list) list.innerHTML = filtered.length ? filtered.map((ticket) => `<article class="ticket-row"><span class="drawer-item-icon">${icon('ticket')}</span><span><strong>${escapeHtml(ticket.title)}</strong><small class="muted">${escapeHtml(ticket.id)} · ${new Date(ticket.created_at).toLocaleDateString('es')}</small></span><span class="status-badge">${escapeHtml(ticket.status)}</span></article>`).join('') : '<div class="ticket-empty">No hay coincidencias con esa búsqueda.</div>';
  }
  if (target.id === 'command-search') {
    const query = target.value.trim().toLowerCase();
    $$('.command-pill').forEach((pill) => { pill.hidden = query && !pill.textContent.toLowerCase().includes(query); });
    $$('.command-card').forEach((card) => { card.hidden = query && ![...card.querySelectorAll('.command-pill')].some((pill) => !pill.hidden); });
  }
  if (target.name === 'activation-key') {
    if (state.connectTarget) state.connectKey = target.value;
    else state.flow.connectKey = target.value;
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
  if (form.id === 'api-auth-form') { event.preventDefault(); submitApiAuth(form); }
  else if (form.id === 'activate-key-form') {
    event.preventDefault();
    const key = new FormData(form).get('activation-key');
    activateInstance(form.dataset.id, key);
  }
  else if (form.id === 'edit-instance-form') {
    event.preventDefault();
    const data = new FormData(form);
    const id = form.dataset.id;
    const name = String(data.get('instance-name') || '').trim();
    const prefix = String(data.get('instance-prefix') || '.');
    request(`/instances/${encodeURIComponent(id)}`, { method: 'PATCH', body: { name, prefix } })
      .then(() => {
        closeModal();
        showToast('Cambios guardados', 'success');
        loadAdminData({ quiet: true });
      })
      .catch((error) => showToast(error.message || 'No se pudieron guardar los cambios.', 'error'));
  }
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

/** Estado en vivo vía SSE: solo datos reales del servidor. */
function connectStream() {
  try {
    const source = new EventSource('/api/stream');
    source.addEventListener('status', (event) => {
      try {
        const snapshot = JSON.parse(event.data);
        if (!snapshot?.id) return;
        const index = state.instances.findIndex((item) => item.id === snapshot.id);
        if (index >= 0) {
          state.instances[index] = { ...state.instances[index], ...snapshot, live: true };
          if (state.view === 'bots' || state.view === 'register' || state.view === 'home') renderPage();
          if (state.connectTarget?.id === snapshot.id) {
            state.connectTarget = { ...state.connectTarget, ...snapshot };
            renderConnectModal();
          }
        }
      } catch { /* evento malformado */ }
    });
  } catch { /* sin SSE */ }
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
    if (['home', 'bots', 'metrics'].includes(state.view)) loadAdminData({ quiet: true });
    if (state.view === 'tickets') loadTickets();
  });

  await Promise.allSettled([loadHealth(), loadCatalog(), loadPlans({ quiet: true }), loadApiAccount(), loadAdminData({ quiet: true })]);
  if (state.view !== 'landing') renderPage();
  connectStream();
}

boot();
