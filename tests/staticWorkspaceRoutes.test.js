import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

test('all required production workspace files exist and contain live application markup', () => {
  for (const slug of ['intelligence', 'kernel-control', 'voice-studio']) {
    const indexFile = path.join(root, 'public', 'app', slug, 'index.html');
    assert.equal(existsSync(indexFile), true, `${slug} index.html must exist`);
    const html = readFileSync(indexFile, 'utf8');
    assert.match(html, /<!doctype html>|<html/i);
    assert.ok(html.length > 100, `${slug} must not be an empty placeholder`);
  }
});

test('workspace route registry serves exact and trailing slash URLs and exposes health', () => {
  const source = readFileSync(path.join(root, 'server', 'staticWorkspaceRoutes.js'), 'utf8');
  assert.match(source, /app\.get\(route, sendIndex\)/);
  assert.match(source, /app\.get\(`\$\{route\}\/`, sendIndex\)/);
  assert.match(source, /app\.use\(route, express\.static/);
  assert.match(source, /\/health\/workspaces/);
  assert.match(source, /'intelligence'/);
  assert.match(source, /'kernel-control'/);
  assert.match(source, /'voice-studio'/);
});
