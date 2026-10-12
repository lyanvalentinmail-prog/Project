/* ═══════════════════════════════════════════════════════════════
   𓆩 ☕ 𓆪  VÉRSOVA · panel web (frontend)
   Vanilla JS, sin build step. Token en memoria + localStorage.
   ═══════════════════════════════════════════════════════════════ */

const API = '/api';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let token = null;
let stream = null;
let linkPoller = null;
let state = { instances: [], groups: [], stats: null, commands: [], selectedGroup: null };

/* ── utilidades ──────────────────────────────────────────────── */

const esc = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const time = (ts) => (ts ? new Date(Number(ts)).toLocaleString('es-MX', { hour12: false }) : '—');

const duration = (ms) => {
  if (!ms || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
};

function storeToken(value) {
  token = value;
  try {
    if (value) localStorage.setItem('versova_token', value);
    else localStorage.removeItem('versova_token');
  } catch {
    /* almacenamiento bloqueado (iframe de terceros): seguimos en memoria */
  }
}

function readStoredToken() {
  try {
    return localStorage.getItem('versova_token');
  } catch {
    return null;
  }
}

async function api(path, { method = 'GET', body = null } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = { ok: false, error: `Respuesta inválida (${res.status})` };
  }
  if (res.status === 401) {
    storeToken(null);
    showLogin();
    throw new Error(data?.error ?? 'Sesión expirada.');
  }
  if (!res.ok || data?.ok === false) throw new Error(data?.error ?? `Error ${res.status}`);
  return data;
}

function toast(message, kind = 'info') {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  box.append(el);
  setTimeout(() => el.remove(), 5200);
}

/* ── estado de conexión ──────────────────────────────────────── */

const STATUS_META = {
  open: ['pill-ok', 'conectado'],
  connecting: ['pill-info', 'conectando'],
  starting: ['pill-info', 'iniciando'],
  qr: ['pill-warn', 'esperando QR'],
  pairing: ['pill-warn', 'esperando código'],
  closed: ['pill-muted', 'detenido'],
  created: ['pill-muted', 'sin iniciar'],
  error: ['pill-danger', 'error'],
  loggedOut: ['pill-danger', 'sesión cerrada'],
};

const statusPill = (status) => {
  const [cls, label] = STATUS_META[status] ?? ['pill-muted', status ?? '—'];
  return `<span class="pill ${cls}">${esc(label)}</span>`;
};

/* ── login / logout ──────────────────────────────────────────── */

function showLogin() {
  $('#app').classList.add('hidden');
  $('#login').classList.remove('hidden');
  disconnectStream();
}

function showApp() {
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
}

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('#login-error').textContent = '';
  const password = $('#password').value;
  try {
    const data = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }).then((r) => r.json());
    if (!data.ok) throw new Error(data.error ?? 'No se pudo entrar.');
    storeToken(data.token);
    $('#password').value = '';
    await enterApp();
  } catch (error) {
    $('#login-error').textContent = error.message;
  }
});

$('#logout').addEventListener('click', async () => {
  try {
    await api('/logout', { method: 'POST' });
  } catch {
    /* no importa si el token ya expiró */
  }
  storeToken(null);
  showLogin();
  toast('Sesión cerrada. Hasta pronto ☕', 'ok');
});

/* ── SSE ─────────────────────────────────────────────────────── */

function connectStream() {
  disconnectStream();
  if (!token) return;
  stream = new EventSource(`${API}/stream?token=${encodeURIComponent(token)}`);
  stream.addEventListener('hello', () => setConnection('pill-ok', 'SSE · en vivo'));
  stream.addEventListener('ping', () => setConnection('pill-ok', 'SSE · en vivo'));
  stream.addEventListener('status', (event) => {
    const data = JSON.parse(event.data);
    appendLog({ level: 'info', message: `${data.name ?? data.id} → ${data.status}`, data });
    loadInstances();
    loadStats();
  });
  stream.addEventListener('log', (event) => appendLog(JSON.parse(event.data)));
  stream.onerror = () => setConnection('pill-warn', 'SSE · reconectando');
}

function disconnectStream() {
  if (stream) {
    stream.close();
    stream = null;
  }
}

function setConnection(cls, text) {
  const el = $('#connection');
  el.className = `pill ${cls}`;
  el.textContent = text;
}

function appendLog(entry) {
  const box = $('#live-log');
  if (!box) return;
  const line = document.createElement('div');
  const level = entry.level ?? 'info';
  line.innerHTML = `<span class="t">${new Date(entry.at ?? Date.now()).toLocaleTimeString('es-MX', { hour12: false })}</span> ` +
    `<span class="lvl-${esc(level)}">${esc(level.toUpperCase())}</span> ${esc(entry.message ?? '')}` +
    (entry.instanceId ? ` <span class="t">[${esc(entry.instanceId)}]</span>` : '');
  box.prepend(line);
  while (box.children.length > 250) box.lastElementChild.remove();
}

/* ── tabs ────────────────────────────────────────────────────── */

$$('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    $$('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    $$('.panel').forEach((panel) => panel.classList.toggle('hidden', panel.dataset.panel !== target));
    if (target === 'groups') loadGroups();
    if (target === 'activity') loadAudit();
    if (target === 'help') loadCommands();
  });
});

/* ── carga de datos ──────────────────────────────────────────── */

async function loadStats() {
  try {
    const data = await api('/stats');
    state.stats = data;
    const cards = [
      ['Sub-bots', `${data.connected}/${data.maxInstances}`, `${data.instances} creados`],
      ['Grupos', data.groups, 'con el bot dentro'],
      ['Registrados', data.registered, `${data.withRole} con personaje`],
      ['Personajes', data.rolesTaken, `${data.rolesReserved} reservados`],
      ['Solicitudes', data.pendingRequests, 'esperando aprobación'],
      ['Parejas', data.couples, `${data.afk} en AFK`],
      ['Eventos', data.auditEvents, 'en auditoría'],
    ];
    $('#stats').innerHTML = cards
      .map(
        ([label, value, note]) =>
          `<div class="stat"><span>${esc(label)}</span><strong>${esc(value)}</strong><em>${esc(note)}</em></div>`
      )
      .join('');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function loadInstances() {
  try {
    const data = await api('/instances');
    state.instances = data.instances;
    $('#max-instances').textContent = data.maxInstances;
    renderInstances();
  } catch (error) {
    toast(error.message, 'error');
  }
}

function renderInstances() {
  const box = $('#instances');
  const canCreate = state.instances.length < (state.stats?.maxInstances ?? 3);
  $('#create-card').classList.toggle('hidden', !canCreate);

  if (!state.instances.length) {
    box.innerHTML = `<div class="empty">Todavía no hay sub-bots. Crea el primero abajo y vincúlalo con QR o pairing code ☕</div>`;
    return;
  }

  box.innerHTML = state.instances
    .map((instance) => {
      const running = ['open', 'connecting', 'starting', 'qr', 'pairing'].includes(instance.status);
      const needsLink = ['qr', 'pairing', 'created', 'closed', 'loggedOut', 'error'].includes(instance.status);
      return `
      <article class="card">
        <div class="instance-head">
          <div>
            <h3>${esc(instance.name)}</h3>
            <div class="instance-phone">${esc(instance.phoneMasked)} · ${instance.pairingMode === 'pairing' ? 'pairing code' : 'QR'}</div>
          </div>
          ${statusPill(instance.status)}
        </div>
        <dl class="kv">
          <dt>Estado</dt><dd>${esc(instance.status)}</dd>
          <dt>Sesión</dt><dd>${esc(instance.waJid ? instance.phoneMasked : 'sin vincular')}</dd>
          <dt>Activo</dt><dd>${esc(duration(instance.uptimeMs))}</dd>
          <dt>Grupos</dt><dd>${esc(instance.groups)}</dd>
          ${instance.lastError ? `<dt>Último error</dt><dd>${esc(String(instance.lastError).slice(0, 120))}</dd>` : ''}
        </dl>
        <div class="card-actions">
          ${running ? '' : `<button class="btn btn-primary btn-sm" data-act="start" data-id="${esc(instance.id)}">Iniciar</button>`}
          ${needsLink ? `<button class="btn btn-sm" data-act="link" data-id="${esc(instance.id)}">Vincular ${instance.pairingMode === 'pairing' ? '(código)' : '(QR)'}</button>` : ''}
          ${running ? `<button class="btn btn-sm" data-act="stop" data-id="${esc(instance.id)}">Detener</button>` : ''}
          <button class="btn btn-sm" data-act="logout" data-id="${esc(instance.id)}">Cerrar sesión</button>
          <button class="btn btn-danger btn-sm" data-act="remove" data-id="${esc(instance.id)}">Eliminar</button>
        </div>
      </article>`;
    })
    .join('');

  $$('#instances [data-act]').forEach((btn) => btn.addEventListener('click', () => instanceAction(btn.dataset.act, btn.dataset.id)));
}

async function instanceAction(act, id) {
  const instance = state.instances.find((i) => i.id === id);
  try {
    if (act === 'start') {
      btnBusy(id, true);
      const data = await api(`/instances/${id}/start`, { method: 'POST' });
      toast(`Sub-bot iniciado → ${data.client?.status ?? 'iniciando'}`, 'ok');
      if (data.client && ['qr', 'pairing'].includes(data.client.status)) openLinkModal(id);
    } else if (act === 'stop') {
      await api(`/instances/${id}/stop`, { method: 'POST' });
      toast('Sub-bot detenido.', 'warn');
    } else if (act === 'logout') {
      if (!confirm(`¿Cerrar la sesión de WhatsApp de "${instance?.name}"? Tendrás que volver a vincularlo.`)) return;
      await api(`/instances/${id}/logout`, { method: 'POST' });
      toast('Sesión cerrada y credenciales borradas.', 'warn');
    } else if (act === 'remove') {
      if (!confirm(`¿Eliminar "${instance?.name}" y TODOS sus datos (grupos, fichas, personajes)?`)) return;
      await api(`/instances/${id}`, { method: 'DELETE' });
      toast('Sub-bot eliminado.', 'ok');
    } else if (act === 'link') {
      openLinkModal(id);
      return;
    }
    await Promise.all([loadInstances(), loadStats()]);
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    btnBusy(id, false);
  }
}

function btnBusy(id, busy) {
  $$(`#instances [data-id="${CSS.escape(id)}"]`).forEach((btn) => {
    btn.disabled = busy;
  });
}

/* ── modal de vinculación ────────────────────────────────────── */

async function openLinkModal(id) {
  const instance = state.instances.find((i) => i.id === id);
  $('#modal').classList.remove('hidden');
  $('#modal-title').textContent = `Vincular ${instance?.name ?? 'sub-bot'}`;
  $('#modal-subtitle').textContent = instance?.pairingMode === 'pairing'
    ? 'WhatsApp → Dispositivos vinculados → Vincular con el código del dispositivo'
    : 'WhatsApp → Dispositivos vinculados → Vincular un dispositivo → escanea este QR';
  $('#modal-actions').innerHTML = `<button class="btn" id="modal-refresh">Regenerar</button>
    <button class="btn btn-ghost" id="modal-stop">Cerrar modal</button>`;
  $('#modal-refresh').addEventListener('click', async () => {
    try {
      if (instance?.pairingMode === 'pairing') {
        const data = await api(`/instances/${id}/pairing/refresh`, { method: 'POST' });
        toast(`Nuevo código: ${data.formatted}`, 'ok');
      } else {
        await api(`/instances/${id}/start`, { method: 'POST' });
        toast('QR regenerado.', 'ok');
      }
      await renderLink(id);
    } catch (error) {
      toast(error.message, 'error');
    }
  });
  $('#modal-stop').addEventListener('click', closeLinkModal);
  await renderLink(id);
  clearInterval(linkPoller);
  linkPoller = setInterval(() => renderLink(id, true), 3000);
}

function closeLinkModal() {
  $('#modal').classList.add('hidden');
  clearInterval(linkPoller);
  linkPoller = null;
}

$('#modal-close').addEventListener('click', closeLinkModal);
$('#modal').addEventListener('click', (event) => {
  if (event.target.id === 'modal') closeLinkModal();
});

async function renderLink(id, silent = false) {
  try {
    const data = await api(`/instances/${id}/link`);
    const body = $('#modal-body');

    if (data.status === 'open') {
      body.innerHTML = `
        <div class="pill pill-ok" style="font-size:13px;padding:8px 14px">Vinculado correctamente</div>
        <dl class="kv" style="text-align:left">
          <dt>Número</dt><dd>${esc(data.phone ?? '')}${data.pushName ? ` · ${esc(data.pushName)}` : ''}</dd>
          <dt>Sesión</dt><dd>${esc(data.jid ?? '—')}</dd>
        </dl>
        <p class="muted">El bot ya está en línea. Añádelo a tu grupo de rol y usa <code>.menu</code>.</p>`;
      clearInterval(linkPoller);
      loadInstances();
      loadStats();
      return;
    }

    if (data.pairingMode === 'pairing' && data.pairingFormatted) {
      body.innerHTML = `
        <div class="pairing-code">${esc(data.pairingFormatted)}</div>
        <button class="btn btn-sm" id="copy-code">Copiar código</button>
        <ol class="steps">
          <li>Abre <strong>WhatsApp</strong> en el teléfono de ese número.</li>
          <li>Ve a <strong>Ajustes → Dispositivos vinculados</strong>.</li>
          <li>Toca <strong>Vincular un dispositivo</strong> y luego <strong>Vincular con el número de teléfono</strong>.</li>
          <li>Escribe el código tal cual (sin el guion).</li>
        </ol>`;
      $('#copy-code')?.addEventListener('click', () => {
        navigator.clipboard?.writeText(String(data.pairingCode)).then(
          () => toast('Código copiado.', 'ok'),
          () => toast('No se pudo copiar automáticamente.', 'warn')
        );
      });
    } else if (data.qrDataUrl) {
      body.innerHTML = `
        <div class="qr-frame"><img src="${esc(data.qrDataUrl)}" alt="Código QR de vinculación" /></div>
        <p class="muted" style="margin-top:12px">El QR se renueva solo cada ~20 s. Esta ventana lo actualiza cada 3 s.</p>`;
    } else {
      body.innerHTML = `
        <div class="pill pill-warn">Esperando a WhatsApp…</div>
        <p class="muted">${esc(data.lastError ?? 'Iniciando la conexión. Si tarda, pulsa Regenerar.')}</p>`;
    }
    if (!silent) $('#modal-subtitle').textContent = data.pairingMode === 'pairing'
      ? 'Código de 8 caracteres · válido unos 60 segundos'
      : 'Escanea con el teléfono que quieres convertir en bot';
  } catch (error) {
    if (!silent) toast(error.message, 'error');
  }
}

/* ── creación de sub-bot ─────────────────────────────────────── */

$('#create-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('#create-error').textContent = '';
  const name = $('#inst-name').value.trim();
  const phone = $('#inst-phone').value.trim();
  const pairingMode = $('input[name="mode"]:checked').value;
  try {
    const data = await api('/instances', { method: 'POST', body: { name, phone, pairingMode } });
    toast(`Sub-bot "${data.instance.name}" creado. Iniciando vinculación…`, 'ok');
    $('#create-form').reset();
    await loadInstances();
    await api(`/instances/${data.instance.id}/start`, { method: 'POST' }).catch((error) => toast(error.message, 'error'));
    await loadInstances();
    openLinkModal(data.instance.id);
  } catch (error) {
    $('#create-error').textContent = error.message;
  }
});

/* ── grupos ──────────────────────────────────────────────────── */

async function loadGroups() {
  try {
    const data = await api('/groups');
    state.groups = data.groups;
    const box = $('#groups');
    box.innerHTML = data.groups.length
      ? data.groups
          .map(
            (group) => `
        <article class="card">
          <div class="instance-head">
            <div><h3>${esc(group.name || 'Grupo sin nombre')}</h3>
            <div class="instance-phone">${esc(group.size)} miembros · ${esc(group.registered)} fichas</div></div>
            ${group.locked ? '<span class="pill pill-warn">cerrado</span>' : '<span class="pill pill-ok">abierto</span>'}
          </div>
          <dl class="kv">
            <dt>Personajes</dt><dd>${esc(group.rolesTaken)} ocupados</dd>
            <dt>Admins</dt><dd>${esc(group.admins)}</dd>
            <dt>Pendientes</dt><dd>${esc(group.pending)}</dd>
            <dt>Última sync</dt><dd>${esc(time(group.lastSyncAt))}</dd>
          </dl>
          <div class="card-actions">
            <button class="btn btn-sm" data-group="${esc(group.groupId)}">Ver detalle</button>
          </div>
        </article>`
          )
          .join('')
      : `<div class="empty">El bot todavía no está en ningún grupo. Vincula un sub-bot y añádelo a tu grupo de rol.</div>`;

    $$('#groups [data-group]').forEach((btn) => btn.addEventListener('click', () => openGroup(btn.dataset.group)));
    if (state.selectedGroup) openGroup(state.selectedGroup);
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function openGroup(groupId) {
  state.selectedGroup = groupId;
  const box = $('#group-detail');
  box.classList.remove('hidden');
  box.innerHTML = '<p class="muted">Cargando…</p>';
  try {
    const data = await api(`/groups/${encodeURIComponent(groupId)}`);
    const g = data.group;
    box.innerHTML = `
      <h3>${esc(g.name)} ${g.locked ? '<span class="pill pill-warn">cerrado</span>' : ''}</h3>
      <dl class="kv">
        <dt>Creado en WhatsApp</dt><dd>${esc(time(g.waCreatedAt))}</dd>
        <dt>Bot entró</dt><dd>${esc(time(g.joinedAt))}</dd>
        <dt>Umbral inactividad</dt><dd>${esc(g.config.inactivity_days)} días</dd>
        <dt>Reserva</dt><dd>${esc(g.config.reserve_hours)} h</dd>
        <dt>Warns máximos</dt><dd>${esc(g.config.max_warnings)}</dd>
      </dl>

      <h4>Solicitudes pendientes (${data.requests.length})</h4>
      ${
        data.requests.length
          ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>Tipo</th><th>Quién</th><th>Personaje</th><th>Hace</th><th></th></tr></thead>
             <tbody>${data.requests
               .map(
                 (r) => `<tr>
                  <td class="mono">#${esc(r.id)}</td>
                  <td>${esc(r.type === 'role_change' ? 'cambio' : r.type)}</td>
                  <td>${esc(r.user)}</td>
                  <td>${esc(r.roleName ?? r.target ?? '—')}${r.prevRoleName ? ` <span class="muted">(deja ${esc(r.prevRoleName)})</span>` : ''}</td>
                  <td class="muted">${esc(time(r.createdAt))}</td>
                  <td>${
                    r.type === 'couple'
                      ? '<span class="muted">la responde el usuario</span>'
                      : `<button class="btn btn-sm" data-resolve="approve" data-rid="${esc(r.id)}">Aprobar</button>
                         <button class="btn btn-danger btn-sm" data-resolve="deny" data-rid="${esc(r.id)}">Rechazar</button>`
                  }</td>
                 </tr>`
               )
               .join('')}</tbody></table></div>`
          : '<p class="empty">Sin solicitudes pendientes.</p>'
      }

      <h4>Personajes (${data.roles.length})</h4>
      ${
        data.roles.length
          ? `<div class="table-wrap"><table><thead><tr><th>Personaje</th><th>Estado</th><th>Quién</th><th>Reserva hasta</th></tr></thead>
             <tbody>${data.roles
               .map(
                 (r) => `<tr><td>${esc(r.name)}</td><td>${statusPill(
                   r.status === 'taken' ? 'open' : r.status === 'reserved' ? 'qr' : 'created'
                 )}</td><td>${esc(r.owner ?? r.reservedBy ?? '—')}</td><td class="muted">${
                   r.reservedUntil ? esc(time(r.reservedUntil)) : '—'
                 }</td></tr>`
               )
               .join('')}</tbody></table></div>`
          : '<p class="empty">Todavía no hay personajes creados en este grupo.</p>'
      }

      <h4>Integrantes registrados (${data.members.length})</h4>
      ${
        data.members.length
          ? `<div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Edad</th><th>Teléfono</th><th>Personaje</th><th>Pareja</th><th>Warns</th><th>Última actividad</th></tr></thead>
             <tbody>${data.members
               .map(
                 (m) => `<tr><td>${esc(m.name)}${m.afk ? ' <span class="pill pill-info">AFK</span>' : ''}</td><td>${esc(m.age)}</td>
                 <td class="mono">${esc(m.phone)}</td><td>${esc(m.role ?? '—')}</td><td>${esc(m.partner ?? '—')}</td>
                 <td>${esc(m.warns)}</td><td class="muted">${esc(time(m.lastActivity))}</td></tr>`
               )
               .join('')}</tbody></table></div>`
          : '<p class="empty">Nadie se ha registrado todavía.</p>'
      }

      <h4>Inactivos (${data.inactives.length})</h4>
      ${
        data.inactives.length
          ? `<div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Días sin escribir</th><th>Personaje</th></tr></thead>
             <tbody>${data.inactives.map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.days)}</td><td>${esc(i.role ?? '—')}</td></tr>`).join('')}</tbody></table></div>`
          : '<p class="empty">Todo el team está activo ✨</p>'
      }

      <h4>Administradores (${data.admins.length})</h4>
      <p class="muted">${data.admins.map((a) => `${esc(a.name ?? 'Sin ficha')} · ${esc(a.phone)}${a.super ? ' (super)' : ''}`).join('<br />') || '—'}</p>

      <h4>Bloqueados (${data.blocked.length})</h4>
      <p class="muted">${data.blocked.map((b) => `${esc(b.phone)} · ${esc(b.reason || 'sin motivo')}`).join('<br />') || 'Lista vacía'}</p>
    `;

    $$('[data-resolve]', box).forEach((btn) =>
      btn.addEventListener('click', async () => {
        const decision = btn.dataset.resolve;
        const reason = decision === 'deny' ? prompt('Motivo del rechazo (opcional):') ?? null : null;
        btn.disabled = true;
        try {
          const result = await api(`/groups/${encodeURIComponent(groupId)}/requests/${btn.dataset.rid}/resolve`, {
            method: 'POST',
            body: { decision, reason },
          });
          toast(result.delivered ? 'Resuelto y avisado en el grupo.' : 'Resuelto en la base de datos (el sub-bot no está conectado: no se pudo avisar en WhatsApp).', result.delivered ? 'ok' : 'warn');
          await openGroup(groupId);
          await loadStats();
        } catch (error) {
          toast(error.message, 'error');
          btn.disabled = false;
        }
      })
    );
  } catch (error) {
    box.innerHTML = `<p class="error-text">${esc(error.message)}</p>`;
  }
}

/* ── actividad y comandos ────────────────────────────────────── */

async function loadAudit() {
  try {
    const data = await api('/audit?limit=60');
    const box = $('#audit');
    box.innerHTML = data.entries.length
      ? data.entries
          .map(
            (e) =>
              `<div><span class="t">${time(e.createdAt)}</span> <span class="lvl-info">${esc(e.action)}</span>` +
              `${e.groupName ? ` · ${esc(e.groupName)}` : ''}${e.target ? ` → ${esc(e.target)}` : ''}</div>`
          )
          .join('')
      : '<div class="empty">Sin eventos todavía.</div>';
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function loadCommands() {
  try {
    const data = await api('/commands');
    $('#prefix').textContent = data.prefix;
    const visible = data.commands.filter((c) => !c.hidden);
    state.commands = visible;
    $('#commands').innerHTML = visible
      .map(
        (c) => `
      <div class="command">
        <span class="cat">${esc(c.category)}</span>
        <b>${esc(data.prefix)}${esc(c.name)}${c.args ? ` ${esc(c.args)}` : ''}</b>
        <p>${esc(c.description)}</p>
        <small>${esc(c.permission === 'all' ? 'todos' : c.permission === 'admin' ? 'solo admins' : c.permission === 'registered' ? 'registrados' : 'owner')}
        ${c.example ? ` · ${esc(c.example)}` : ''}</small>
      </div>`
      )
      .join('');
  } catch (error) {
    toast(error.message, 'error');
  }
}

/* ── arranque ────────────────────────────────────────────────── */

async function enterApp() {
  showApp();
  const me = await api('/me');
  $('#brand-sub').textContent = me.bot.team;
  document.title = `${me.bot.name} · Panel de bots`;
  connectStream();
  await Promise.all([loadStats(), loadInstances(), loadGroups()]);
}

async function boot() {
  const stored = readStoredToken();
  if (stored) {
    token = stored;
    try {
      await enterApp();
      return;
    } catch {
      storeToken(null);
    }
  }
  showLogin();
  try {
    const health = await fetch(`${API}/health`).then((r) => r.json());
    if (health.ok) $('#brand-sub').textContent = health.bot.team;
  } catch {
    /* el servidor aún no responde */
  }
}

boot();
