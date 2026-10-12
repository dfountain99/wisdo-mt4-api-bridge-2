import {
  createDraft,
  normalizeDraft,
  validateDraft,
  describeFlow,
  generateMql4,
  exportDraftJson,
  DRAFT_KEY
} from './robot-studio-core.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const fields = $$('[data-key]');
let draft = createDraft();

function showStatus(message, isError = false) {
  const element = $('#studio-status');
  element.textContent = message;
  element.classList.toggle('error', isError);
}
function setDraft(data, message) {
  draft = normalizeDraft(data);
  fields.forEach((element) => {
    const value = draft[element.dataset.key];
    if (element.type === 'checkbox') element.checked = Boolean(value);
    else element.value = String(value);
  });
  render();
  if (message) showStatus(message);
}
function persist() {
  try {
    localStorage.setItem(DRAFT_KEY, exportDraftJson(draft));
    return true;
  } catch (error) {
    showStatus('Could not save in this browser: ' + error.message, true);
    return false;
  }
}
function filename(extension) {
  const clean = draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 45);
  return (clean || 'wisdo_robot') + '.' + extension;
}
function download(filenameValue, content, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filenameValue;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function renderGraph() {
  const graph = $('#flow-graph');
  graph.replaceChildren();
  describeFlow(draft).forEach((step, index) => {
    if (index) {
      const connector = document.createElement('div');
      connector.className = 'line';
      connector.textContent = '↓';
      connector.setAttribute('aria-hidden', 'true');
      graph.append(connector);
    }
    const node = document.createElement('article');
    node.className = 'node';
    const number = document.createElement('div');
    number.className = 'num';
    number.textContent = 'Block ' + String(index + 1).padStart(2, '0');
    const title = document.createElement('h3');
    title.textContent = step.title;
    const detail = document.createElement('p');
    detail.textContent = step.detail;
    node.append(number, title, detail);
    graph.append(node);
  });
}
function render() {
  $('#rsi-settings').hidden = !draft.rsiEnabled;
  $('#session-settings').hidden = !draft.sessionEnabled;
  $('#risk-field').hidden = draft.moneyMode !== 'risk';
  $('#lots-field').hidden = draft.moneyMode !== 'fixed';
  $('#toggle-rsi').setAttribute('aria-pressed', String(draft.rsiEnabled));
  $('#toggle-rsi').textContent = draft.rsiEnabled ? '− Remove RSI filter' : '+ RSI filter';
  $('#toggle-session').setAttribute('aria-pressed', String(draft.sessionEnabled));
  $('#toggle-session').textContent = draft.sessionEnabled ? '− Remove time filter' : '+ Time filter';
  renderGraph();
  const errors = validateDraft(draft);
  for (const button of ['#download-mq4', '#download-json', '#copy-code', '#save-draft']) $(button).disabled = errors.length > 0;
  if (errors.length) {
    $('#code-preview').value = '// Fix the following before export:\n// ' + errors.join('\n// ');
    showStatus('Please correct:\n• ' + errors.join('\n• '), true);
    return;
  }
  $('#code-preview').value = generateMql4(draft);
  showStatus('Strategy is valid for source export. Not compiled, backtested, or connected to a trading account.');
}
fields.forEach((element) => {
  element.addEventListener('input', () => {
    const key = element.dataset.key;
    let value = element.type === 'checkbox' ? element.checked : element.value;
    if (element.type === 'number' && value !== '') value = Number(value);
    draft = normalizeDraft({ ...draft, [key]: value });
    render();
  });
});
$('#toggle-rsi').addEventListener('click', () => setDraft({ ...draft, rsiEnabled: !draft.rsiEnabled }));
$('#toggle-session').addEventListener('click', () => setDraft({ ...draft, sessionEnabled: !draft.sessionEnabled }));
const presets = {
  balanced: { fastEma: 9, slowEma: 21, rsiEnabled: false, sessionEnabled: false, moneyMode: 'risk', riskPercent: 1, stopPips: 25, takePips: 50 },
  conservative: { fastEma: 20, slowEma: 50, rsiEnabled: true, rsiPeriod: 14, buyRsiMin: 55, sellRsiMax: 45, moneyMode: 'risk', riskPercent: 0.5, stopPips: 30, takePips: 60 },
  fast: { fastEma: 5, slowEma: 13, rsiEnabled: false, moneyMode: 'risk', riskPercent: 0.5, stopPips: 15, takePips: 30 }
};
$$('[data-preset]').forEach((button) => button.addEventListener('click', () => {
  const preset = presets[button.dataset.preset];
  if (!preset) return;
  setDraft({ ...draft, ...preset }, 'Loaded the ' + button.dataset.preset + ' example. Test it before any trading use.');
}));
$('#start-new').addEventListener('click', () => {
  if (!confirm('Start a new robot? Unsaved edits to this browser draft will be lost.')) return;
  const next = createDraft();
  next.magic = 930000 + Math.floor(Math.random() * 100000);
  setDraft(next, 'New robot ready. No trades or server actions have occurred.');
});
$('#save-draft').addEventListener('click', () => {
  if (persist()) showStatus('Saved this strategy to this browser only. Use Export project for a portable copy.');
});
$('#download-mq4').addEventListener('click', () => {
  try {
    download(filename('mq4'), generateMql4(draft), 'text/plain;charset=utf-8');
    showStatus('MQL4 source downloaded. Compile it in MetaEditor and backtest on a demo account before considering live use.');
  } catch (error) { showStatus(error.message, true); }
});
$('#download-json').addEventListener('click', () => {
  try {
    download(filename('json'), exportDraftJson(draft), 'application/json;charset=utf-8');
    showStatus('Editable robot project exported. No account or trading connection was changed.');
  } catch (error) { showStatus(error.message, true); }
});
$('#copy-code').addEventListener('click', async () => {
  try {
    const source = generateMql4(draft);
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(source);
    else {
      $('#code-preview').focus();
      $('#code-preview').select();
      if (!document.execCommand('copy')) throw new Error('Copy is unavailable; download the MQ4 instead.');
    }
    showStatus('Source copied. Compile and test it locally before running.');
  } catch (error) { showStatus(error.message, true); }
});
$('#import-json').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (file.size > 65536) return showStatus('Project file is too large (64 KB maximum).', true);
  try {
    const parsed = JSON.parse(await file.text());
    if (parsed.generator !== 'wisdo-robot-studio' || parsed.version !== 1) throw new Error('Only WISDO Robot Studio v1 projects are supported.');
    const loaded = normalizeDraft(parsed);
    const errors = validateDraft(loaded);
    if (errors.length) throw new Error(errors.join('; '));
    setDraft(loaded, 'Imported editable project. Review each setting before exporting.');
  } catch (error) { showStatus('Import failed: ' + error.message, true); }
});
try {
  const saved = localStorage.getItem(DRAFT_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    const loaded = normalizeDraft(parsed);
    if (parsed.version === 1 && validateDraft(loaded).length === 0) {
      setDraft(loaded, 'Loaded your previously saved local project.');
    } else setDraft(createDraft(), 'Saved project was invalid or used an unsupported version; defaults loaded.');
  } else setDraft(createDraft(), 'Choose a preset or edit the fields to build your first robot.');
} catch {
  setDraft(createDraft(), 'Local storage is unavailable. You can still export your strategy.');
}
