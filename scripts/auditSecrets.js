import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ignored = new Set(['node_modules', '.git', 'docs', 'render', '.venv', 'tests']);
const findings = [];
const suspicious = [
  ['OpenAI-style API key', /\bsk-[A-Za-z0-9_-]{20,}\b/g],
  ['Square access token', /\bEAAA[A-Za-z0-9_-]{20,}\b/g],
  ['PostgreSQL URL with embedded password', /postgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@[^\s/]+/gi],
];

function isRuntimeEnv(rel, name) {
  if (name === '.env.example' || name.endsWith('.env.example')) return false;
  return /(^|\/)\.env(?:\.[^/]+)?$/i.test(rel);
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).replaceAll('\\', '/');
    if (entry.isDirectory()) { walk(full); continue; }
    if (isRuntimeEnv(rel, entry.name)) findings.push(`${rel}: runtime environment file must not ship`);
    if (!/\.(js|json|ya?ml|txt)$/i.test(entry.name)) continue;
    let text = '';
    try { text = fs.readFileSync(full, 'utf8'); } catch { continue; }
    for (const [label, pattern] of suspicious) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) findings.push(`${rel}: possible ${label}`);
    }
  }
}

walk(root);
if (findings.length) {
  console.error('Secret audit failed:');
  for (const item of [...new Set(findings)].slice(0, 50)) console.error(`- ${item}`);
  process.exit(1);
}
console.log('Secret audit passed: no runtime .env files or obvious committed credentials found.');
