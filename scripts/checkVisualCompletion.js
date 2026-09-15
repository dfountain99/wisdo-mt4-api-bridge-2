import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const registryPath = path.join(root, 'public/app/world/generated-asset-registry.js');
const registry = await import(`${pathToFileURL(registryPath).href}?t=${Date.now()}`);
const assets = registry.GENERATED_WORLD_ASSETS || {};
const failures = [];
const checked = [];
const seen = new Set();

function publicPathFromUrl(url) {
  const clean = String(url || '').split('?')[0];
  if (!clean.startsWith('/')) return null;
  return path.join(root, 'public', clean.slice(1));
}

function looksLikeAsset(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && typeof value.url === 'string' && value.url);
}

function addAsset(target, asset) {
  if (!looksLikeAsset(asset)) return;
  const identity = `${String(asset.id || '')}|${String(asset.url || '')}`;
  if (seen.has(identity)) return;
  seen.add(identity);

  const runtimeFile = publicPathFromUrl(asset.url);
  if (!runtimeFile || !fs.existsSync(runtimeFile)) {
    failures.push(`${target}: runtime asset missing for ${asset.url}`);
    return;
  }
  let reportFile = null;
  if (asset.reportUrl) {
    reportFile = asset.reportUrl.startsWith('/world-assets/')
      ? publicPathFromUrl(asset.reportUrl)
      : path.join(root, String(asset.reportUrl).replace(/^\//, ''));
  }
  if (!reportFile || !fs.existsSync(reportFile)) {
    failures.push(`${target}: validation report missing for ${asset.reportUrl || '(none)'}`);
    return;
  }
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  for (const key of ['scale', 'ground', 'transforms', 'glbExport']) {
    if (report?.checks?.[key] !== 'PASS') failures.push(`${target}: report check ${key}=${report?.checks?.[key] || 'missing'}`);
  }
  if (asset.kind === 'operator' && report?.checks?.armature !== 'PASS') {
    failures.push(`${target}: character armature check is not PASS`);
  }
  checked.push({ target, id: asset.id, url: asset.url, reportUrl: asset.reportUrl });
}

// The generated asset registry supports both legacy aliases (`playerV2`,
// `arcadeV2`) and the generalized grouped catalogs. Walk only actual asset
// records, not catalog container objects, and deduplicate aliases that point to
// the same generated GLB.
for (const [target, value] of Object.entries(assets)) {
  if (!value) continue;
  if (looksLikeAsset(value)) {
    addAsset(target, value);
    continue;
  }
  if (typeof value !== 'object' || Array.isArray(value)) continue;
  for (const [assetId, asset] of Object.entries(value)) {
    addAsset(`${target}.${assetId}`, asset);
  }
}

if (failures.length) {
  console.error('[WISDO visual completion] FAIL');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, rule: 'WISDO_VISUAL_COMPLETION_RULE', checked }, null, 2));
