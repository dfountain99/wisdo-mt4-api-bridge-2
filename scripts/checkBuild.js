import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const excluded = new Set(['node_modules', '.git', 'data']);
const required = [
  'index.js',
  'server/apiServer.js',
  'server/majorUpgradeRoutes.js',
  'server/extendedProductRoutes.js',
  'server/security.js',
  'public/js/workspace.js',
  'public/service-worker.js',
  'migrations/2026-07-10-wisdo-major-production-v5.sql',
  'render.yaml',
];

for (const relative of required) {
  await fs.access(path.join(root, relative));
}

const files = [];
async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excluded.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (entry.isFile() && file.endsWith('.js')) files.push(file);
  }
}
await walk(root);
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(`Syntax check failed: ${path.relative(root, file)}\n${result.stderr}`);
    process.exit(1);
  }
}
console.log(`Build check passed: ${files.length} JavaScript files and ${required.length} required production assets.`);
