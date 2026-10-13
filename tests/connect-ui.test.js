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
