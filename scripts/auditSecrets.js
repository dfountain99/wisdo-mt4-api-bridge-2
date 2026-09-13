import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ignored = new Set(['node_modules', '.git', 'docs', 'render', '.venv', 'tests', 'coverage']);
const findings = [];
const suspicious = [
  ['OpenAI-style API key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g],
  ['Square access token', /\bEAAA[A-Za-z0-9_-]{20,}\b/g],
  ['GitHub classic token', /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g],
  ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['AWS access key id', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g],
  ['Telegram bot token', /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/g],
  ['Discord bot token', /\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}\b/g],
  ['Stripe secret key', /\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b/g],
  ['Twilio auth token assignment', /TWILIO_AUTH_TOKEN\s*[:=]\s*["']?[a-fA-F0-9]{32}["']?/g],
  ['Private key material', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ['Database/cache URL with embedded password', /(?:postgres(?:ql)?|mysql|mariadb|redis|rediss):\/\/[^\s:@/]+:[^\s@/]+@[^\s/]+/gi],
];
const auditableExtension = /\.(?:c?js|mjs|json|ya?ml|txt|toml|ini|conf|sh|ps1)$/i;

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
    if (!auditableExtension.test(entry.name)) continue;
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
  for (const item of [...new Set(findings)].slice(0, 100)) console.error(`- ${item}`);
  if (findings.length > 100) console.error(`- ...and ${findings.length - 100} additional finding(s)`);
  process.exit(1);
}
console.log(`Secret audit passed: scanned supported runtime text files for ${suspicious.length} high-confidence credential patterns and runtime .env files.`);
