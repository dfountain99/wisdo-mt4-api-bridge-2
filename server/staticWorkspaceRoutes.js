import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_WISDO_WORKSPACES = Object.freeze([
  { slug: 'intelligence', title: 'Wisdo Intelligence', required: true },
  { slug: 'kernel-control', title: 'Wisdo Kernel Control', required: true },
  { slug: 'voice-studio', title: 'Wisdo Voice Studio', required: true },
  { slug: 'studio', title: 'Wisdo Studio', required: false },
]);

function normalizeWorkspace(entry) {
  const slug = String(entry?.slug || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    throw new Error(`Invalid workspace slug: ${slug || '<empty>'}`);
  }
  return {
    slug,
    title: String(entry?.title || slug),
    required: entry?.required !== false,
  };
}

export function registerStaticWorkspaceRoutes(app, {
  publicRoot = path.join(__dirname, '..', 'public'),
  workspaces = DEFAULT_WISDO_WORKSPACES,
  logger = console,
} = {}) {
  if (!app?.use || !app?.get) throw new TypeError('Express app is required.');

  const appRoot = path.join(publicRoot, 'app');
  const registered = [];
  const missing = [];

  for (const raw of workspaces) {
    const workspace = normalizeWorkspace(raw);
    const directory = path.join(appRoot, workspace.slug);
    const indexFile = path.join(directory, 'index.html');
    const exists = fs.existsSync(indexFile);

    if (!exists) {
      missing.push({ ...workspace, directory, indexFile });
      if (workspace.required) {
        logger?.warn?.('Required Wisdo workspace is missing.', {
          workspace: workspace.slug,
          indexFile,
        });
      }
      continue;
    }

    const route = `/app/${workspace.slug}`;
    const sendIndex = (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('X-Wisdo-Workspace', workspace.slug);
      res.sendFile(indexFile);
    };

    // Exact routes are registered explicitly so Express does not depend on
    // directory redirect behavior and Render returns 200 for both forms.
    app.get(route, sendIndex);
    app.get(`${route}/`, sendIndex);

    // Workspace-owned assets remain cacheable while index.html stays fresh.
    app.use(route, express.static(directory, {
      index: false,
      redirect: false,
      fallthrough: true,
      maxAge: '1h',
      immutable: false,
    }));

    registered.push({ ...workspace, route, directory, indexFile });
  }

  app.get('/health/workspaces', (_req, res) => {
    const requiredMissing = missing.filter((item) => item.required);
    res.status(requiredMissing.length ? 503 : 200).json({
      ok: requiredMissing.length === 0,
      service: 'wisdo-static-workspaces',
      version: '3.2.0',
      registered: registered.map(({ slug, title, route }) => ({ slug, title, route })),
      missing: missing.map(({ slug, title, required }) => ({ slug, title, required })),
    });
  });

  app.locals.wisdoWorkspaces = { registered, missing };
  return app.locals.wisdoWorkspaces;
}
