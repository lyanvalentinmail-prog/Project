import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function panel() {
  const source = fs.readFileSync(new URL('../web/public/app.js', import.meta.url), 'utf8');
  const context = vm.createContext({
    localStorage: { getItem: () => null },
    window: { location: { pathname: '/', hash: '' } },
  });
  // Carga el SPA sin iniciar red/DOM; ejercita sus renderizadores reales.
  vm.runInContext(source.replace(/boot\(\);\s*$/, '') + '\nglobalThis.panelState = state;', context);
  return context;
}

test('el asistente y el modal no piden clave y permiten finalizar al vincular', () => {
  const ui = panel();
  const instance = { id: 'demo', name: 'Mi bot', activated: false, status: 'open', pairingMode: 'pairing', prefix: '#' };
  ui.panelState.instances = [instance];
  ui.panelState.flow = { ...ui.panelState.flow, instanceId: instance.id, linkData: { status: 'open' } };
  ui.panelState.connectTarget = instance;
  const wizard = ui.renderConnectStep();
  const modal = { innerHTML: '' };
  ui.renderConnectModalInto(modal);
  for (const html of [wizard, modal.innerHTML]) {
    assert.doesNotMatch(html, /activate-key-form|activation-key|Sin activar/);
    assert.match(html, /Ya puedes usar los comandos/);
  }
  assert.match(wizard, /data-action="finish-flow"/);
  assert.match(modal.innerHTML, /Listo/);
});

test('el código aparece en el panel sin activación y una sesión en vinculación no figura en línea', () => {
  const ui = panel();
  ui.panelState.pairing = { id: 'demo', formatted: 'ABCD-1234', issuedAt: Date.now(), lifetimeSec: 60 };
  const html = ui.pairingCard({ id: 'demo', mode: 'pairing' });
  assert.match(html, /ABCD-1234/);
  assert.match(html, /Copiar código/);
  assert.doesNotMatch(html, /activate-key-form|activation-key/);
  assert.equal(ui.instanceState({ status: 'pairing', live: true }).key, 'linking');
  assert.equal(ui.instanceState({ status: 'open', activated: false }).key, 'online');
});

function linkingPanel() {
  const ui = panel();
  ui.document = { querySelectorAll: () => [] };
  ui.setInterval = () => 1;
  ui.clearInterval = () => {};
  ui.scheduleRender = () => {};
  ui.paintConnectModal = () => {};
  ui.showToast = () => {};
  ui.panelState.pairing.id = 'demo';
  return ui;
}

test('consultar un código de 20 segundos no descuenta su edad dos veces', async () => {
  const ui = linkingPanel();
  const issuedAt = Date.now() - 20_000;
  ui.request = async () => ({ id: 'demo', status: 'pairing', pairingFormatted: 'ABCD-1234', pairingCodeAt: issuedAt, pairingExpiresInSec: 40 });
  await ui.syncLink('demo');
  assert.equal(ui.panelState.pairing.issuedAt, issuedAt);
  assert.equal(ui.panelState.pairing.lifetimeSec, 60);
  assert.ok(ui.pairingSecondsLeft() >= 39 && ui.pairingSecondsLeft() <= 40);
});

test('SSE y polling eliminan códigos invalidados y no mezclan sub-bots', async () => {
  const ui = linkingPanel();
  ui.rememberPairing({ id: 'demo', formatted: 'ABCD-1234', issuedAt: Date.now() });
  ui.applyInstanceState({ id: 'otro', status: 'pairing', pairingCode: 'EFGH5678', pairingCodeAt: Date.now() });
  assert.equal(ui.panelState.pairing.formatted, 'ABCD-1234');
  ui.applyInstanceState({ id: 'demo', status: 'closed', pairingCode: null, pairingCodeAt: null });
  assert.equal(ui.panelState.pairing.formatted, '');
  ui.rememberPairing({ id: 'demo', formatted: 'ABCD-1234', issuedAt: Date.now() });
  ui.request = async () => ({ id: 'demo', status: 'closed', pairingFormatted: null, pairingCodeAt: null });
  await ui.syncLink('demo');
  assert.equal(ui.panelState.pairing.formatted, '');
  assert.equal(ui.panelState.pairing.issuedAt, null);
});

test('un código caducado no se presenta como activo ni se puede copiar', () => {
  const ui = linkingPanel();
  ui.rememberPairing({ id: 'demo', formatted: 'ABCD-1234', issuedAt: Date.now() - 61_000 });
  const html = ui.pairingCard({ id: 'demo' });
  assert.doesNotMatch(html, />ABCD-1234<|Código disponible/);
  assert.match(html, /Código caducado/);
  assert.match(html, /data-action="copy-pairing" disabled/);
});

test('el contador caducado no solicita renovaciones automáticas', () => {
  const ui = linkingPanel();
  ui.panelState.pairing = { id: 'demo', formatted: 'ABCD-1234', issuedAt: Date.now() - 61_000, lifetimeSec: 60 };
  let requests = 0;
  const node = { textContent: '', closest: () => null };
  ui.document.querySelectorAll = () => [node];
  ui.requestPairing = () => { requests += 1; };
  ui.updatePairingCountdown();
  assert.match(node.textContent, /expirado/);
  assert.equal(requests, 0);
});

test('renovación manual envía force y bloquea peticiones duplicadas', async () => {
  const ui = linkingPanel();
  const requests = [];
  let complete;
  ui.request = (url, options) => {
    requests.push({ url, options });
    return new Promise((resolve) => { complete = resolve; });
  };
  const pending = ui.requestPairing('demo', { force: true });
  // SSE no desbloquea la petición HTTP todavía en curso.
  ui.applyInstanceState({ id: 'demo', status: 'pairing', pairingCode: null });
  await ui.requestPairing('demo', { force: true });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.body.force, true);
  complete({ formatted: 'EFGH-5678', issuedAt: Date.now() });
  await pending;
  assert.equal(ui.panelState.pairing.formatted, 'EFGH-5678');
  assert.equal(ui.panelState.pairing.loading, false);
});

/* ── editor de bot: números de staff ─────────────────────────── */

function editingPanel(instance = { id: 'demo', name: 'Mi bot', prefix: '#', adminNumbers: ['59899123456', '5215512345678'] }) {
  const ui = panel();
  const modal = { innerHTML: '' };
  const layer = { hidden: true };
  const button = { innerHTML: 'Guardar cambios', textContent: '', disabled: false };
  const error = { hidden: true, textContent: '' };
  class Form {
    id = 'edit-instance-form';
    dataset = { id: instance.id };
    fields = { 'instance-name': instance.name, 'instance-prefix': instance.prefix, 'instance-admin-numbers': (instance.adminNumbers || []).join('\n') };
    querySelector(selector) { return selector === 'button[type="submit"]' ? button : error; }
    setAttribute() {}
    removeAttribute() {}
  }
  const form = new Form();
  const toasts = [];
  ui.HTMLFormElement = Form;
  ui.FormData = class { constructor(form) { this.form = form; } get(name) { return this.form.fields[name]; } };
  ui.document = {
    querySelector: (selector) => ({ '#modal-content': modal, '#modal-layer': layer, '#edit-instance-form': form }[selector]),
    body: { classList: { add() {}, remove() {} } },
  };
  ui.showToast = (message, type) => toasts.push({ message, type });
  ui.loadAdminData = async () => {};
  ui.scheduleRender = () => {};
  ui.stopLinkWatch = () => {};
  ui.panelState.instances = [instance];
  ui.openEditInstance(instance);
  return { ui, modal, layer, button, error, form, toasts };
}

test('Editar bot muestra una lista de admins precargada y explica el alcance del permiso', () => {
  const { modal, layer } = editingPanel();
  assert.equal(layer.hidden, false);
  assert.match(modal.innerHTML, /name="instance-admin-numbers"/);
  assert.match(modal.innerHTML, />59899123456\n5215512345678<\/textarea>/);
  assert.match(modal.innerHTML, /código de país/);
  assert.match(modal.innerHTML, /staff only/);
  assert.match(modal.innerHTML, /No otorga permisos de owner/);
  assert.match(modal.innerHTML, /borra el número y guarda/);
  assert.match(modal.innerHTML, /role="alert" hidden/);
  const legacy = editingPanel({ id: 'legacy', name: 'Antiguo', prefix: '.' });
  assert.match(legacy.modal.innerHTML, /><\/textarea>/);
  assert.doesNotMatch(legacy.modal.innerHTML, /undefined/);
  const escaped = editingPanel({ id: 'safe', name: '<script>', prefix: '.', adminNumbers: ['</textarea><script>'] });
  assert.doesNotMatch(escaped.modal.innerHTML, /<script>/);
  assert.match(escaped.modal.innerHTML, /&lt;\/textarea&gt;&lt;script&gt;/);
});

test('guardar envía números junto al nombre y prefijo y actualiza el editor sin recargar', async () => {
  const { ui, form, layer } = editingPanel();
  form.fields['instance-name'] = '  Nuevo nombre  ';
  form.fields['instance-prefix'] = '+';
  form.fields['instance-admin-numbers'] = '+598 99 123 456, 5215512345678';
  let request;
  ui.request = async (url, options) => {
    request = { url, options };
    return { instance: { id: 'demo', name: 'Nuevo nombre', prefix: '+', adminNumbers: ['59899123456', '5215512345678'] } };
  };
  let prevented = false;
  await ui.handleSubmit({ target: form, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(request.url, '/instances/demo');
  assert.equal(request.options.method, 'PATCH');
  assert.deepEqual(JSON.parse(JSON.stringify(request.options.body)), { name: 'Nuevo nombre', prefix: '+', adminNumbers: '+598 99 123 456, 5215512345678' });
  assert.equal(layer.hidden, true);
  assert.equal(ui.panelState.instances[0].name, 'Nuevo nombre');
  assert.equal(ui.panelState.instances[0].prefix, '+');
  ui.openEditInstance(ui.panelState.instances[0]);
  assert.equal(layer.hidden, false);
});

test('vaciar los números envía un valor explícito para revocar el staff', async () => {
  const { ui, form, modal } = editingPanel();
  form.fields['instance-admin-numbers'] = '';
  ui.request = async (_url, { body }) => {
    assert.equal(body.adminNumbers, '');
    return { instance: { id: 'demo', adminNumbers: [] } };
  };
  await ui.submitEditInstance(form);
  ui.openEditInstance(ui.panelState.instances[0]);
  assert.match(modal.innerHTML, /><\/textarea>/);
  assert.doesNotMatch(modal.innerHTML, />59899123456/);
});

test('si un número es inválido no cierra el formulario ni pierde lo escrito', async () => {
  const { ui, form, layer, button, error, toasts } = editingPanel();
  form.fields['instance-admin-numbers'] = '123';
  ui.request = async () => { throw new Error('Número de admin inválido en la entrada 1.'); };
  await ui.submitEditInstance(form);
  assert.equal(layer.hidden, false);
  assert.equal(form.fields['instance-admin-numbers'], '123');
  assert.equal(error.hidden, false);
  assert.match(error.textContent, /Número de admin inválido/);
  assert.equal(button.disabled, false);
  assert.equal(form.dataset.saving, undefined);
  assert.equal(toasts.at(-1).type, 'error');
  assert.deepEqual(ui.panelState.instances[0].adminNumbers, ['59899123456', '5215512345678']);
});

test('el editor bloquea guardados duplicados mientras espera al servidor', async () => {
  const { ui, form, button } = editingPanel();
  let complete;
  let requests = 0;
  ui.request = () => {
    requests += 1;
    return new Promise((resolve) => { complete = resolve; });
  };
  const pending = ui.submitEditInstance(form);
  assert.equal(button.disabled, true);
  await ui.submitEditInstance(form);
  assert.equal(requests, 1);
  complete({ instance: { id: 'demo', adminNumbers: ['59899123456'] } });
  await pending;
  assert.equal(button.disabled, false);
  assert.equal(button.innerHTML, 'Guardar cambios');
});

test('un snapshot nuevo actualiza los números al volver a abrir Editar bot', () => {
  const { ui, modal } = editingPanel();
  ui.panelState.revision = 'before';
  ui.mergeSnapshot({ ok: true, revision: 'after', instances: [{ id: 'demo', name: 'Mi bot', prefix: '.', adminNumbers: ['59899000001'] }] });
  ui.openEditInstance(ui.panelState.instances[0]);
  assert.match(modal.innerHTML, />59899000001<\/textarea>/);
  assert.doesNotMatch(modal.innerHTML, />59899123456/);
});
