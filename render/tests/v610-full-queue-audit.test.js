import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve('.');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'tests'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.isFile() && full.endsWith('.js')) files.push(full);
  }
  return files;
}

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('full production source audit contains no request-blocking global promise-tail queues', () => {
  const forbidden = [
    /ecosystemMutationQueue/,
    /ecosystemStateSaveQueue/,
    /commandMutationQueues/,
    /stateChain\s*=\s*Promise\.resolve\(\)/,
    /writeChain\s*=\s*Promise\.resolve\(\)/,
    /runCommandMutation\s*\(/,
  ];
  const failures = [];
  for (const file of walk(root)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of forbidden) {
      if (pattern.test(text)) failures.push(`${path.relative(root, file)} matched ${pattern}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('workspace motion videos are true lazy assets and service worker bypasses video ranges', () => {
  const routes = source('server/majorUpgradeRoutes.js');
  const workspace = source('public/js/workspace.js');
  const serviceWorker = source('public/service-worker.js');
  assert.match(routes, /preload="none" data-src="\/media\/14683743_3840_2160_30fps\.mp4"/);
  assert.doesNotMatch(routes, /<source src="\/media\/14683743_3840_2160_30fps\.mp4"/);
  assert.match(workspace, /if \(!video\.getAttribute\('src'\) && video\.dataset\.src\)/);
  assert.match(workspace, /video\.removeAttribute\('src'\)/);
  assert.match(serviceWorker, /url\.pathname\.endsWith\('\.mp4'\)/);
  assert.match(serviceWorker, /request\.headers\.has\('range'\)/);
});

test('accounts and analytics routes use bounded fail-open synchronization', () => {
  const routes = source('server/majorUpgradeRoutes.js');
  const workspace = source('public/js/workspace.js');
  assert.match(routes, /WISDO_ACCOUNTS_API_BUDGET_MS/);
  assert.match(routes, /liveLedgerSyncWithinBudget/);
  assert.match(routes, /responseMode:'hot-state-write'/);
  assert.match(workspace, /wisdo\.accountSnapshot/);
  assert.match(workspace, /retries \?\? 1/);
  assert.doesNotMatch(workspace, /retries \?\? 3/);
});

test('production state remains PostgreSQL-backed with no active JSON feed index or required Redis', () => {
  const api = source('server/apiServer.js');
  const render = source('render.yaml');
  assert.doesNotMatch(api, /feed-posts\.json/);
  assert.doesNotMatch(api, /saveFeedPosts\s*\(/);
  assert.match(api, /state\.socialPostsById\[id\] = record/);
  assert.match(api, /source: 'postgres-hot-cache'/);
  assert.match(render, /- key: REDIS_ENABLED\s+value: "false"/);
  assert.doesNotMatch(render, /disk:\s+name: wisdo-persistent-data/);
});

test('all major route mutations release HTTP requests after a bounded persistence wait', () => {
  const routes = source('server/majorUpgradeRoutes.js');
  assert.match(routes, /WISDO_MUTATION_SAVE_BUDGET_MS/);
  assert.match(routes, /persistMutationWithinBudget/);
  assert.match(routes, /settleWithin\(Promise\.resolve\(\)\.then\(persistState\),budgetMs\)/);
  assert.doesNotMatch(routes, /if\(result\.save\) await save\(state\)/);
  assert.doesNotMatch(routes, /\n  await save\(state\);\n  return result;/);
});
