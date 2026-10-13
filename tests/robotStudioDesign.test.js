import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const base = new URL('../public/app/robot-studio/', import.meta.url);
const html = fs.readFileSync(new URL('index.html', base), 'utf8');
const css = fs.readFileSync(new URL('robot-studio-v2.css', base), 'utf8');
const script = fs.readFileSync(new URL('../public/js/robot-studio-workspace.js', import.meta.url), 'utf8');

test('command deck has two accessible workbenches and retains working robot controls', () => {
  for (const attribute of [
    'id="mode-create-tab"', 'id="mode-import-tab"',
    'id="builder-view"', 'id="import-rebuild"',
    'role="tablist"', 'aria-controls="builder-view"',
    'aria-controls="import-rebuild"', 'role="tabpanel"',
    'id="studio-module-count"'
  ]) assert.ok(html.includes(attribute), 'Expected ' + attribute);
  for (const original of [
    'id="start-new"', 'id="save-draft"', 'id="flow-graph"',
    'id="download-mq4"', 'id="download-json"', 'id="code-preview"',
    'id="reverse-file"', 'id="reverse-canvas"', 'id="reverse-download"',
    'id="reverse-source-preview"', 'id="reverse-output"',
    'id="toggle-rsi"', 'id="toggle-session"'
  ]) assert.ok(html.includes(original), 'Preserve existing UI control: ' + original);
  assert.match(html, /robot-studio-v2\.css/);
  assert.match(html, /robot-studio-workspace\.js/);
  assert.match(css, /@media\s*\(max-width:\s*720px\)/);
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none!important/);
});

test('tab switching updates visibility, accessible state and deep links', () => {
  const panels = { 'builder-view': { hidden: true }, 'import-rebuild': { hidden: true } };
  const eventMap = new Map();
  const count = { textContent: '—', setAttribute() {} };
  const graph = { querySelectorAll: () => [{}, {}, {}] };
  const switcher = { scrollIntoView() {} };
  const makeControl = (mode) => {
    const listeners = new Map();
    return {
      dataset: { studioView: mode },
      tabIndex: -1,
      selected: '',
      focus() {},
      listeners,
      setAttribute(name, value) { if (name === 'aria-selected') this.selected = value; },
      addEventListener(name, cb) { listeners.set(name, cb); }
    };
  };
  const builder = makeControl('builder');
  const importer = makeControl('import');
  const newButton = makeControl('new');
  const goImport = makeControl('import-anchor');
  const els = {
    ...panels, 'mode-switch': switcher, 'studio-module-count': count,
    'flow-graph': graph, 'start-new': newButton
  };
  const loc = { hash: '' };
  const context = {
    document: {
      getElementById(id) { return els[id] ?? null; },
      querySelectorAll(q) {
        if (q === '[data-studio-view]') return [builder, importer];
        if (q === '[data-studio-go="import"]') return [goImport];
        return [];
      }
    },
    location: loc,
    history: { pushState(_a, _b, hash) { loc.hash = hash; } },
    addEventListener(name, cb) { eventMap.set(name, cb); },
    MutationObserver: class { constructor() {} observe() {} },
  };
  vm.runInNewContext(script, context);
  assert.equal(panels['builder-view'].hidden, false);
  assert.equal(panels['import-rebuild'].hidden, true);
  assert.equal(builder.selected, 'true');
  assert.equal(count.textContent, '03');
  importer.listeners.get('click')();
  assert.equal(panels['builder-view'].hidden, true);
  assert.equal(panels['import-rebuild'].hidden, false);
  assert.equal(importer.selected, 'true');
  assert.equal(loc.hash, '#import-rebuild');
  builder.listeners.get('click')();
  assert.equal(panels['builder-view'].hidden, false);
  goImport.listeners.get('click')({ preventDefault() {} });
  assert.equal(panels['import-rebuild'].hidden, false);
  loc.hash = '#builder-view';
  eventMap.get('popstate')();
  assert.equal(panels['builder-view'].hidden, false);
});
