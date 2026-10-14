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
