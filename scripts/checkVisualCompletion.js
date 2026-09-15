import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const registryPath = path.join(root, 'public/app/world/generated-asset-registry.js');
const registry = await import(`${pathToFileURL(registryPath).href}?t=${Date.now()}`);
const assets = registry.GENERATED_WORLD_ASSETS || {};
const failures = [];
const checked = [];

function publicPathFromUrl(url) {
  const clean = String(url || '').split('?')[0];
  if (!clean.startsWith('/')) return null;
  return path.join(root, 'public', clean.slice(1));
}

for (const [target, asset] of Object.entries(assets)) {
  if (!asset) continue;
  const runtimeFile = publicPathFromUrl(asset.url);
  if (!runtimeFile || !fs.existsSync(runtimeFile)) {
    failures.push(`${target}: runtime asset missing for ${asset.url}`);
    continue;
  }
  let reportFile = null;
  if (asset.reportUrl) {
    reportFile = asset.reportUrl.startsWith('/world-assets/')
      ? publicPathFromUrl(asset.reportUrl)
      : path.join(root, String(asset.reportUrl).replace(/^\//, ''));
  }
  if (!reportFile || !fs.existsSync(reportFile)) {
    failures.push(`${target}: validation report missing for ${asset.reportUrl || '(none)'}`);
    continue;
  }
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  for (const key of ['scale', 'ground', 'transforms', 'glbExport']) {
    if (report?.checks?.[key] !== 'PASS') failures.push(`${target}: report check ${key}=${report?.checks?.[key] || 'missing'}`);
  }
  if ((asset.kind === 'operator' || target.toLowerCase().includes('player')) && report?.checks?.armature !== 'PASS') {
    failures.push(`${target}: character armature check is not PASS`);
  }
  checked.push({ target, id: asset.id, url: asset.url, reportUrl: asset.reportUrl });
}

if (failures.length) {
  console.error('[WISDO visual completion] FAIL');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, rule: 'WISDO_VISUAL_COMPLETION_RULE', checked }, null, 2));
