import {
  MAX_SOURCE_BYTES,
  decodeMqlFile,
  encodeMqlSource,
  analyzeMqlSource,
  patchImportedSource,
  getSourceChanges
} from './robot-studio-import-core.js';

const element = (id) => document.getElementById(id);
const lanes = [
  { id: 'entry', label: '01 · Events & entry logic' },
  { id: 'filters', label: '02 · Indicators & filters' },
  { id: 'risk', label: '03 · Parameters & protection' },
  { id: 'orders', label: '04 · Trade actions' },
  { id: 'custom', label: '05 · Custom & external logic' }
];
let analysis = null;
let edits = {};
let order = [];
let activeDrag = null;
let nextOriginalFile = '';
let originalBytes = null;
let sourceCodec = { encoding: 'utf-8', bom: false };

function message(text, error = false) {
  const status = element('reverse-status');
  status.textContent = text;
  status.classList.toggle('error', error);
}
function cleanFileName(name) {
  return String(name || 'imported_robot.mq4').replace(/[^A-Za-z0-9_. -]/g, '_').slice(0, 120);
}
function exportText(name, bytes) {
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}
function sourceResult() {
  return patchImportedSource(analysis, edits);
}
function renderPreview() {
  if (!analysis) return;
  try {
    const source = sourceResult();
    const changes = getSourceChanges(analysis, edits);
    const preview = element('reverse-source-preview');
    preview.value = source;
    element('reverse-change-count').textContent = changes.length + ' source input default(s) changed';
    element('reverse-diff').replaceChildren();
    if (!changes.length) {
      element('reverse-diff').textContent = 'No code changes. Export returns your imported source unchanged.';
    } else {
      for (const c of changes) {
        const line = document.createElement('div');
        const key = document.createElement('strong');
        key.textContent = c.name + ' (line ' + c.line + ')';
        const data = document.createElement('code');
        data.textContent = c.from + ' → ' + c.to;
        line.className = 'reverse-change';
        line.append(key, data);
        element('reverse-diff').append(line);
      }
    }
    element('reverse-download').disabled = false;
    message('Source updated locally. ' + changes.length + ' mapped input(s) changed. No compilation, backtest, or live deployment occurred.');
  } catch (err) {
    element('reverse-download').disabled = true;
    message('Invalid input value: ' + err.message, true);
  }
}
function initialLane(node) {
  if (node.category === 'event') return 'entry';
  if (node.category === 'signal' || node.category === 'condition') return 'filters';
  if (node.category === 'execution') return 'orders';
  if (node.category === 'guard') return 'risk';
  if (node.category === 'parameter') return 'risk';
  return 'custom';
}
function putItem(id, lane, beforeId = null) {
  const existing = order.findIndex((x) => x.id === id);
  if (existing < 0 || !lanes.some((x) => x.id === lane)) return;
  const item = order.splice(existing, 1)[0];
  item.lane = lane;
  if (beforeId === id) {
    order.splice(existing, 0, item);
    return;
  }
  const before = order.findIndex((x) => x.id === beforeId && x.lane === lane);
  if (before >= 0) order.splice(before, 0, item);
  else order.push(item);
  renderCanvas();
  message('Block rearranged in the visual workspace. Source execution order is unchanged; only editing an input value changes source code.');
}
function moveItem(id, delta) {
  const idx = order.findIndex((x) => x.id === id);
  if (idx < 0) return;
  const current = order[idx];
  const laneItems = order.filter((x) => x.lane === current.lane);
  const pos = laneItems.findIndex((x) => x.id === id);
  const other = laneItems[pos + delta];
  if (!other) return;
  const otherIdx = order.findIndex((x) => x.id === other.id);
  order[idx] = other;
  order[otherIdx] = current;
  renderCanvas();
  message('Visual position changed; the program logic remains untouched.');
}
function paramEditor(input) {
  const holder = document.createElement('label');
  holder.className = 'reverse-control';
  const label = document.createElement('span');
  label.textContent = 'Default: ' + input.name + ' (' + input.type + ')';
  holder.append(label);
  const control = document.createElement('input');
  control.setAttribute('aria-label', 'Default value for ' + input.name);
  if (input.kind === 'bool') {
    control.type = 'checkbox';
    control.checked = Object.prototype.hasOwnProperty.call(edits, input.id) ? Boolean(edits[input.id]) : input.value;
    control.addEventListener('change', () => { edits[input.id] = control.checked; renderPreview(); });
  } else if (input.kind === 'readonly') {
    control.type = 'text';
    control.value = input.original;
    control.readOnly = true;
    control.title = 'Computed values, enums and unsupported types are kept intact to preserve meaning.';
  } else {
    control.type = input.kind === 'string' ? 'text' : 'number';
    if (input.kind === 'integer') control.step = '1';
    else if (input.kind === 'decimal') control.step = 'any';
    if (input.kind === 'string') control.maxLength = 180;
    control.value = Object.prototype.hasOwnProperty.call(edits, input.id) ? String(edits[input.id]) : String(input.value);
    control.addEventListener('input', () => {
      edits[input.id] = control.value;
      renderPreview();
    });
  }
  holder.append(control);
  return holder;
}
function conditionEditor(condition) {
  const holder = document.createElement('div');
  holder.className = 'reverse-condition-editor';
  const title = document.createElement('span');
  title.textContent = 'If ' + condition.lhs + ' …';
  const controls = document.createElement('div');
  controls.className = 'reverse-condition-fields';
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Comparison operator for ' + condition.lhs);
  for (const operator of ['>', '>=', '<', '<=', '==', '!=']) {
    const option = document.createElement('option');
    option.value = operator;
    option.textContent = operator;
    select.append(option);
  }
  const value = document.createElement('input');
  value.type = 'number';
  value.step = 'any';
  value.setAttribute('aria-label', 'Threshold for ' + condition.lhs);
  const current = edits[condition.id] || { operator: condition.operator, value: condition.value };
  select.value = current.operator;
  value.value = String(current.value);
  const setValue = () => {
    edits[condition.id] = { operator: select.value, value: value.value };
    renderPreview();
  };
  select.addEventListener('change', setValue);
  value.addEventListener('input', setValue);
  controls.append(select, value);
  holder.append(title, controls);
  return holder;
}

function makeCard(node) {
  const card = document.createElement('article');
  card.className = 'reverse-node';
  card.draggable = true;
  card.dataset.node = node.id;
  const head = document.createElement('div');
  head.className = 'reverse-node-header';
  const h = document.createElement('strong');
  h.textContent = node.label;
  const tag = document.createElement('span');
  tag.className = 'reverse-tag';
  tag.textContent = node.editable ? 'CODE-LINKED INPUT' : 'DISCOVERY';
  head.append(h, tag);
  const detail = document.createElement('p');
  detail.textContent = node.detail;
  const line = document.createElement('small');
  line.textContent = 'Source line ' + node.line;
  card.append(head, detail, line);
  if (node.category === 'parameter') {
    const input = analysis.inputs.find((x) => x.id === node.id);
    if (input) card.append(paramEditor(input));
  } else if (node.category === 'condition') {
    const condition = analysis.conditions.find((x) => x.id === node.id);
    if (condition) card.append(conditionEditor(condition));
  }
  const controls = document.createElement('div');
  controls.className = 'reverse-move-controls';
  const up = document.createElement('button');
  up.type = 'button';
  up.textContent = '↑';
  up.setAttribute('aria-label', 'Move ' + node.label + ' up');
  up.addEventListener('click', () => moveItem(node.id, -1));
  const down = document.createElement('button');
  down.type = 'button';
  down.textContent = '↓';
  down.setAttribute('aria-label', 'Move ' + node.label + ' down');
  down.addEventListener('click', () => moveItem(node.id, 1));
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Move ' + node.label + ' to a group');
  for (const lane of lanes) {
    const option = document.createElement('option');
    option.value = lane.id;
    option.textContent = lane.label.replace(/^\d\d · /, '');
    select.append(option);
  }
  select.value = order.find((x) => x.id === node.id)?.lane || initialLane(node);
  select.addEventListener('change', () => putItem(node.id, select.value));
  controls.append(up, down, select);
  card.append(controls);
  card.addEventListener('dragstart', (e) => {
    if (e.target.closest('input,select,button')) return e.preventDefault();
    activeDrag = node.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.id);
    card.classList.add('moving');
  });
  card.addEventListener('dragend', () => { activeDrag = null; card.classList.remove('moving'); });
  card.addEventListener('dragover', (e) => {
    if (!activeDrag || activeDrag === node.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });
  card.addEventListener('drop', (e) => {
    if (!activeDrag || activeDrag === node.id) return;
    e.preventDefault();
    putItem(activeDrag, order.find((x) => x.id === node.id).lane, node.id);
    activeDrag = null;
  });
  return card;
}
function renderCanvas() {
  if (!analysis) return;
  const canvas = element('reverse-canvas');
  canvas.replaceChildren();
  for (const lane of lanes) {
    const area = document.createElement('section');
    area.className = 'reverse-lane';
    area.dataset.lane = lane.id;
    const title = document.createElement('h3');
    title.textContent = lane.label;
    area.append(title);
    const nodes = order.filter((item) => item.lane === lane.id);
    if (!nodes.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Drop discovered blocks here';
      empty.className = 'reverse-empty';
      area.append(empty);
    }
    for (const item of nodes) {
      const found = analysis.nodes.find((node) => node.id === item.id);
      if (found) area.append(makeCard(found));
    }
    area.addEventListener('dragover', (e) => {
      if (activeDrag) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
    });
    area.addEventListener('drop', (e) => {
      if (!activeDrag || e.target.closest('.reverse-node')) return;
      e.preventDefault();
      putItem(activeDrag, lane.id);
      activeDrag = null;
    });
    canvas.append(area);
  }
}
function showAnalysis(result) {
  analysis = result;
  edits = {};
  nextOriginalFile = result.filename;
  order = result.nodes.map((node) => ({ id: node.id, lane: initialLane(node) }));
  element('reverse-output').hidden = false;
  element('reverse-platform').textContent = result.platform;
  element('reverse-file-label').textContent = result.filename;
  element('reverse-summary').textContent = result.stats.lines + ' lines · ' + result.stats.blocks + ' blocks · ' + result.stats.editableInputs + ' inputs · ' + result.stats.editableConditions + ' conditions editable';
  const notices = element('reverse-notices');
  notices.replaceChildren();
  result.notices.forEach((notice) => {
    const item = document.createElement('li');
    item.textContent = notice;
    notices.append(item);
  });
  renderCanvas();
  renderPreview();
  element('reverse-output').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function importFile(file) {
  if (!file) return;
  const name = file.name || '';
  if (!/\.mq[45]$/i.test(name)) return message('Choose an editable .mq4 or .mq5 source file; .ex4/.ex5 binaries cannot be imported.', true);
  if (file.size > MAX_SOURCE_BYTES) return message('This version supports source files up to 4 MB.', true);
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const decoded = decodeMqlFile(bytes);
    const result = analyzeMqlSource(decoded.text, name);
    showAnalysis(result);
    originalBytes = bytes;
    sourceCodec = { encoding: decoded.encoding, bom: decoded.bom };
    message('Analyzed ' + name + ' (' + decoded.encoding + '). Source stays on this device. Unsupported constructs are preserved.');
  } catch (error) { message('Import failed: ' + error.message, true); }
}
const chooser = element('reverse-file');
element('reverse-choose').addEventListener('click', () => chooser.click());
chooser.addEventListener('change', () => {
  const file = chooser.files?.[0];
  chooser.value = '';
  importFile(file);
});
const target = element('reverse-dropzone');
target.addEventListener('dragover', (e) => { e.preventDefault(); target.classList.add('dragging'); });
target.addEventListener('dragleave', () => target.classList.remove('dragging'));
target.addEventListener('drop', (e) => {
  e.preventDefault();
  target.classList.remove('dragging');
  importFile(e.dataTransfer?.files?.[0]);
});
element('reverse-download').addEventListener('click', () => {
  try {
    const changes = getSourceChanges(analysis, edits);
    const exported = changes.length === 0 && originalBytes ? originalBytes : encodeMqlSource(sourceResult(), sourceCodec);
    exportText(cleanFileName(nextOriginalFile), exported);
    message('Source downloaded in original ' + analysis.platform + ' format. Compile in MetaEditor and test on demo. Custom logic was retained.');
  } catch (error) { message(error.message, true); }
});
element('reverse-reset').addEventListener('click', () => {
  if (!analysis) return;
  edits = {};
  renderCanvas();
  renderPreview();
  message('All parameter edits reverted. Source restored to its imported form.');
});
element('reverse-layout-reset').addEventListener('click', () => {
  if (!analysis) return;
  order = analysis.nodes.map((node) => ({ id: node.id, lane: initialLane(node) }));
  renderCanvas();
  message('Visual workspace arrangement reset. The source was never reordered.');
});
