/**
 * 𓆩 ☕ 𓆪  Tests · editor del panel (UI)
 * ────────────────────────────────────────────────────────────────
 * Carga app.js en una VM con DOM mínimo (mismo enfoque que
 * connect-ui.test.js) y renderiza el editor de personalización:
 * pestaña Estilo (modo de entrega + banner), Categorías y Comandos.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function panel() {
  const source = fs.readFileSync(new URL('../web/public/app.js', import.meta.url), 'utf8');
  const context = vm.createContext({
    localStorage: { getItem: () => null },
    window: { location: { pathname: '/', hash: '' } },
    setTimeout: () => 1,
    clearTimeout: () => {},
  });
  vm.runInContext(
    source.replace(/boot\(\);\s*$/, '') +
      '\nglobalThis.panelState = state;' +
      '\nglobalThis.renderEditModalFn = renderEditModal;' +
      '\nglobalThis.handleClickFn = handleClick;',
    context
  );
  return context;
}

function fakeDom() {
  const modal = { innerHTML: '' };
  const classList = { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false };
  return {
    modal,
    classList,
    querySelector: (sel) => (sel === '#modal-content' ? modal : null),
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => ({ getContext: () => null, classList }),
    documentElement: { classList, style: {} },
    body: { classList },
  };
}

function readyEditor(ui, draftOverrides = {}) {
  const dom = fakeDom();
  ui.document = dom;
  ui.panelState.editTarget = { id: 'demo', name: 'Mi bot', prefix: '.', phoneMasked: '59••23', adminNumbers: [] };
  ui.panelState.editDraft = {
    menuStyle: 'versova',
    menuMode: 'list',
    banner: { url: 'https://img.example/banner.jpg' },
    aliases: {},
    disabled: [],
    disabledCategories: ['anime'],
    categories: [{ id: 'juegos', title: 'JUEGOS', icon: '🎮', sub: 'juegos', kaomoji: '(^_^)' }],
    customCommands: [],
    categoryOverrides: {},
    ...draftOverrides,
  };
  ui.panelState.editStyles = [{ id: 'versova', label: 'Versova', description: 'clásico', preview: 'x' }];
  ui.panelState.editCommandsData = {
    commands: [
      { name: 'reg', category: 'registro', description: 'Registro', permission: 'all', aliases: [] },
      { name: 'kiss', category: 'anime', description: 'Beso', permission: 'all', aliases: [] },
      { name: 'warn', category: 'admin', description: 'Aviso', permission: 'admin', aliases: [] },
    ],
    customization: ui.panelState.editDraft,
    prefix: '.',
  };
  ui.panelState.editPreview = '(preview)';
  return dom;
}

test('pestaña Estilo: modo de entrega (lista) y tarjeta de banner se renderizan', () => {
  const ui = panel();
  const dom = readyEditor(ui);
  ui.panelState.editTab = 'estilo';
  ui.renderEditModalFn();
  const html = dom.modal.innerHTML;
  assert.match(html, /Modo de entrega del menú/);
  assert.match(html, /Lista interactiva/);
  assert.match(html, /data-action="set-menu-mode" data-mode="list"/);
  assert.match(html, /Banner del menú/);
  assert.match(html, /https:\/\/img\.example\/banner\.jpg/);
  assert.match(html, /data-action="remove-banner"/);
  assert.match(html, /id="banner-upload"/);
});

test('pestaña Categorías: interruptores para quitar/poner categorías del sistema', () => {
  const ui = panel();
  const dom = readyEditor(ui);
  ui.panelState.editTab = 'categorias';
  ui.renderEditModalFn();
  const html = dom.modal.innerHTML;
  assert.match(html, /data-action="toggle-menu-category" data-cat="anime"/);
  assert.match(html, /quitada/); // anime aparece apagada
  assert.match(html, /Crear categoría/);
});

test('pestaña Comandos: cabecera con interruptor maestro y fila CATEGORÍA OFF', () => {
  const ui = panel();
  const dom = readyEditor(ui);
  ui.panelState.editTab = 'comandos';
  ui.renderEditModalFn();
  const html = dom.modal.innerHTML;
  assert.match(html, /data-action="toggle-menu-category" data-cat="anime"/);
  assert.match(html, /CATEGORÍA OFF/); // fila de kiss marcada por su categoría
  assert.match(html, /toggle-command/);
});

test('acciones: toggle-category quita y pone; set-menu-mode y remove-banner actualizan el borrador', () => {
  const ui = panel();
  readyEditor(ui);
  ui.showToast = () => {};
  ui.renderPage = () => {};
  // la acción usa el botón con dataset; simulamos objetos mínimos
  const act = (dataset) =>
    ui.handleClickFn({
      preventDefault: () => {},
      target: { closest: (sel) => (sel === '[data-action]' ? { dataset } : null) },
    });
  act({ action: 'toggle-menu-category', cat: 'anime' });
  assert.deepEqual(ui.panelState.editDraft.disabledCategories, []);
  act({ action: 'toggle-menu-category', cat: 'logos' });
  assert.deepEqual(ui.panelState.editDraft.disabledCategories, ['logos']);
  act({ action: 'set-menu-mode', mode: 'text' });
  assert.equal(ui.panelState.editDraft.menuMode, 'text');
  act({ action: 'set-menu-mode', mode: 'list' });
  assert.equal(ui.panelState.editDraft.menuMode, 'list');
  act({ action: 'remove-banner' });
  assert.equal(ui.panelState.editDraft.banner, null);
});
