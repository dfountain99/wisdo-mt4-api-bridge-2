import path from 'node:path';
import express from 'express';

import { getSessionUser } from './security.js';
import { createWisdoPhase1Repository, ensureWisdoPhase1State } from '../services/repositories/wisdoPhase1Repository.js';

const WORLD_TIERS = Object.freeze([
  { key: 'member', label: 'Member', level: 0 },
  { key: 'sovereign', label: 'Sovereign', level: 1 },
  { key: 'elite', label: 'Elite', level: 2 },
  { key: 'commander', label: 'Commander', level: 3 },
]);

const WORLD_DESTINATIONS = Object.freeze([
  { id: 'trading-tower', name: 'Trading Tower', short: 'TRADE', minLevel: 0, route: '/member/command-center', icon: '↗', x: 50, y: 12, description: 'Live account command, protection, copy controls, and operator context.' },
  { id: 'academy', name: 'WISDO Academy', short: 'LEARN', minLevel: 0, route: '/member/education', icon: '▤', x: 19, y: 23, description: 'Education, practice, readiness, and strategy learning.' },
  { id: 'vault', name: 'The Vault', short: 'OWN', minLevel: 1, route: '/member/bots', icon: '◇', x: 11, y: 48, description: 'Owned bots, licenses, presets, and premium systems.' },
  { id: 'bot-arena', name: 'Bot Arena', short: 'BUILD', minLevel: 0, route: '/member/bots', icon: '⬡', x: 22, y: 73, description: 'Explore bot families and choose systems for your account.' },
  { id: 'switch-lab', name: 'Switch Lab', short: 'TUNE', minLevel: 1, route: '/member/wisdo', icon: '⌁', x: 42, y: 83, description: 'Tune WISDO capabilities and account-control behavior.' },
  { id: 'growth-chamber', name: 'Growth Chamber', short: 'GROW', minLevel: 0, route: '/member/accounts', icon: '△', x: 63, y: 81, description: 'Account growth, health, history, and milestones.' },
  { id: 'strategy-lab', name: 'Strategy Lab', short: 'ANALYZE', minLevel: 2, route: '/member/simulator', icon: '⌬', x: 85, y: 51, description: 'Simulation, research, review, and strategy experiments.' },
  { id: 'coach-center', name: 'Coach Center', short: 'COACH', minLevel: 0, route: '/member/wisdo', icon: '◉', x: 78, y: 25, description: 'WISDO intelligence, coaching, and guided operator actions.' },
  { id: 'culture-arena', name: 'Culture Arena', short: 'BELONG', minLevel: 0, route: '/member/social', icon: '◎', x: 91, y: 27, description: 'Community, social trading, competition, and shared progress.' },
  { id: 'marketplace', name: 'Marketplace', short: 'UNLOCK', minLevel: 0, route: '/pricing', icon: '▣', x: 8, y: 72, description: 'Plans, products, bots, and access upgrades.' },
  { id: 'vps-forge', name: 'VPS Forge', short: 'RUN', minLevel: 1, route: '/member/command-center', icon: '▦', x: 83, y: 77, description: 'Runtime operations and always-on trading infrastructure.' },
  { id: 'private-rooms', name: 'Private Rooms', short: 'COMMAND', minLevel: 3, route: '/member/home', icon: '♛', x: 65, y: 8, description: 'Commander-only identity, trophies, and private headquarters.' },
  { id: 'war-room', name: 'War Room', short: 'OPERATE', minLevel: 3, route: '/member/admin-wisdo', icon: '◆', x: 34, y: 8, description: 'High-authority WISDO operations. Existing role gates remain authoritative.' },
]);

const AVATAR_STYLES = new Set(['vanguard', 'architect', 'sentinel', 'scholar']);

function nowIso() {
  return new Date().toISOString();
}

function clean(value, max = 80) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function roleTokens(user = {}, state = {}) {
  const tokens = new Set();
  const push = (value) => {
    if (Array.isArray(value)) return value.forEach(push);
    if (value && typeof value === 'object') return Object.values(value).forEach(push);
    const token = clean(value, 80).toLowerCase();
    if (token) tokens.add(token);
  };
  push(user.role);
  push(user.roles);
  push(user.discordRoles);
  const synced = state.roleSyncByUserId?.[String(user.id)] || {};
  push(synced.accessLevel);
  push(synced.wisdoRoles);
  push(synced.internalRoles);
  push(synced.discordRoles);
  return tokens;
}

function hasActivePaidAccess(state, userId) {
  const subscriptions = [
    ...Object.values(state.subscriptionsById || {}),
    ...Object.values(state.subscriptions || {}),
    ...Object.values(state.memberships || {}),
  ];
  return subscriptions.some((row) => {
    const owner = String(row?.userId ?? row?.user_id ?? row?.memberId ?? '');
    if (owner !== String(userId)) return false;
    return ['active', 'paid', 'trialing'].includes(String(row?.status || '').toLowerCase());
  });
}

export function resolveWorldTier(user = {}, state = {}) {
  const roles = roleTokens(user, state);
  const has = (...needles) => needles.some((needle) => roles.has(needle));
  if (has('owner', 'super_admin', 'admin', 'wisdo_core', 'wisdo')) return WORLD_TIERS[3];
  if (has('elite', 'vip_member', 'creator', 'strategy_provider')) return WORLD_TIERS[2];
  if (has('premium', 'premium_member', 'paid_member', 'copier_eligible', 'culture coin member+') || hasActivePaidAccess(state, user.id)) return WORLD_TIERS[1];
  return WORLD_TIERS[0];
}

function ensureWorldState(state = {}) {
  const next = ensureWisdoPhase1State(state);
  next.worldProfilesByUserId ||= {};
  next.worldEntitlementsByUserId ||= {};
  next.worldAuditLogsById ||= {};
  return next;
}

function defaultProfile(user = {}) {
  return {
    userId: String(user.id),
    callsign: clean(user.global_name || user.globalName || user.username || 'Operator', 48) || 'Operator',
    title: 'World Explorer',
    avatarStyle: 'vanguard',
    xp: 0,
    visitedDestinations: [],
    achievements: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function profileFor(state, user) {
  const key = String(user.id);
  const existing = state.worldProfilesByUserId[key];
  if (!existing) {
    state.worldProfilesByUserId[key] = defaultProfile(user);
  }
  const profile = state.worldProfilesByUserId[key];
  if (!Array.isArray(profile.visitedDestinations)) profile.visitedDestinations = [];
  if (!Array.isArray(profile.achievements)) profile.achievements = [];
  if (!Number.isFinite(Number(profile.xp))) profile.xp = 0;
  return profile;
}

function grantsFor(state, userId) {
  const rows = state.worldEntitlementsByUserId?.[String(userId)] || [];
  return new Set((Array.isArray(rows) ? rows : []).filter((row) => row?.status !== 'revoked').map((row) => clean(row?.destinationId || row?.key, 80)));
}

function destinationAccess(state, user, profile) {
  const tier = resolveWorldTier(user, state);
  const grants = grantsFor(state, user.id);
  return WORLD_DESTINATIONS.map((destination) => ({
    ...destination,
    minTier: WORLD_TIERS.find((item) => item.level === destination.minLevel)?.label || 'Member',
    unlocked: tier.level >= destination.minLevel || grants.has(destination.id),
    source: grants.has(destination.id) ? 'entitlement' : tier.level >= destination.minLevel ? 'tier' : 'locked',
    visited: profile.visitedDestinations.includes(destination.id),
  }));
}

function publicAccount(account = {}) {
  return {
    accountId: clean(account.accountId || account.id || account.linkId, 100),
    accountNumber: clean(account.accountNumber || account.login, 80),
    nickname: clean(account.nickname || account.accountName || account.name, 100),
    broker: clean(account.broker, 100),
    server: clean(account.server || account.brokerServer, 120),
    platform: clean(account.platform || 'MT4', 16),
    accountType: clean(account.accountType || account.type, 30),
    status: clean(account.status || 'unknown', 40),
    lastSyncAt: account.lastSyncAt || account.updatedAt || account.receivedAt || null,
  };
}

async function getAccounts(mt4SyncService, userId) {
  const repository = mt4SyncService?.repository;
  if (!repository) return [];
  if (typeof repository.getAccessibleMt4Accounts === 'function') {
    const rows = await repository.getAccessibleMt4Accounts(String(userId));
    return (Array.isArray(rows) ? rows : []).map(publicAccount);
  }
  return [];
}

function reporterNodeFromAccount(account) {
  const seenAt = account.lastSyncAt ? new Date(account.lastSyncAt).getTime() : 0;
  const online = Number.isFinite(seenAt) && seenAt > 0 && Date.now() - seenAt < 180_000;
  return {
    id: `reporter:${account.accountId || account.accountNumber || 'unknown'}`,
    tradingAccountId: account.accountId,
    name: account.nickname || `${account.platform} ${account.accountNumber}`,
    type: 'MT_REPORTER',
    status: online ? 'online' : account.status || 'offline',
    lastSeen: account.lastSyncAt,
    canReport: true,
    canReceiveSignals: true,
    canExecuteTrades: false,
  };
}

function worldSnapshot(state, user, profile, accounts) {
  const tier = resolveWorldTier(user, state);
  const destinations = destinationAccess(state, user, profile);
  const nodes = accounts.map(reporterNodeFromAccount);
  return {
    ok: true,
    member: {
      id: String(user.id),
      username: clean(user.username || user.global_name || user.globalName, 80),
    },
    worldProfile: {
      ...profile,
      level: Math.max(1, Math.floor(Number(profile.xp || 0) / 250) + 1),
    },
    access: {
      tierKey: tier.key,
      worldLabel: tier.label,
      level: tier.level,
      destinations,
    },
    mesh: {
      accounts,
      nodes,
      routes: [],
      summary: {
        accounts: accounts.length,
        nodes: nodes.length,
        onlineNodes: nodes.filter((node) => node.status === 'online').length,
        executionRoutes: 0,
        executableRoutes: 0,
      },
      safetyNotice: 'WISDO World observes existing linked accounts. Trade execution is not enabled from the World layer.',
    },
    persistence: 'wisdo-phase-1-repository',
    updatedAt: profile.updatedAt,
  };
}

function sessionUser(req) {
  const user = getSessionUser(req);
  if (user?.id) return user;
  if ((process.env.NODE_ENV === 'test' || String(process.env.WISDO_ALLOW_TEST_IDENTITY || '').toLowerCase() === 'true') && req.headers['x-wisdo-test-user']) {
    return { id: String(req.headers['x-wisdo-test-user']), username: 'Test Operator', roles: ['admin'] };
  }
  return null;
}

function requireWorldUser(req, res, next) {
  const user = sessionUser(req);
  if (!user) {
    return res.status(401).json({
      ok: false,
      error: 'Authentication required.',
      loginUrl: `/login?returnTo=${encodeURIComponent(req.originalUrl || '/world/')}`,
    });
  }
  req.worldUser = user;
  next();
}

export function worldCatalog() {
  return {
    ok: true,
    version: '1.0.0-native',
    tiers: WORLD_TIERS,
    destinations: WORLD_DESTINATIONS.map((item) => ({
      ...item,
      minTier: WORLD_TIERS.find((tier) => tier.level === item.minLevel)?.label || 'Member',
    })),
    billingConnected: false,
    executionFromWorldEnabled: false,
    note: 'World access is derived from the existing WISDO identity and entitlement state. Existing server-side route guards remain authoritative.',
  };
}

export function registerWisdoWorldRoutes(app, {
  config = {},
  logger = console,
  mt4SyncService = null,
  publicRoot,
} = {}) {
  if (!app?.get || !app?.post || !app?.use) throw new TypeError('Express app is required.');
  const repository = createWisdoPhase1Repository(config);
  const worldRoot = path.join(publicRoot, 'app', 'world');
  const indexFile = path.join(worldRoot, 'index.html');

  app.get('/world', (_req, res) => res.redirect(302, '/world/'));
  app.get('/wisdo-world.html', (_req, res) => res.redirect(302, '/world/'));
  app.get('/world/', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('X-Wisdo-Workspace', 'world');
    res.sendFile(indexFile);
  });
  app.use('/world/assets', express.static(worldRoot, {
    index: false,
    redirect: false,
    fallthrough: true,
    maxAge: '1h',
  }));

  app.get('/api/world/catalog', (_req, res) => res.json(worldCatalog()));

  app.get('/api/world/me', requireWorldUser, async (req, res, next) => {
    try {
      const state = ensureWorldState(await repository.loadState());
      const profile = profileFor(state, req.worldUser);
      const accounts = await getAccounts(mt4SyncService, req.worldUser.id);
      res.json(worldSnapshot(state, req.worldUser, profile, accounts));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/world/mesh', requireWorldUser, async (req, res, next) => {
    try {
      const accounts = await getAccounts(mt4SyncService, req.worldUser.id);
      const nodes = accounts.map(reporterNodeFromAccount);
      res.json({
        ok: true,
        accounts,
        nodes,
        routes: [],
        summary: {
          accounts: accounts.length,
          nodes: nodes.length,
          onlineNodes: nodes.filter((node) => node.status === 'online').length,
          executionRoutes: 0,
          executableRoutes: 0,
        },
        safetyNotice: 'Existing account/reporting state is visible here. Execution authority remains in the established WISDO command and MT4 services.',
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/world/profile', requireWorldUser, async (req, res, next) => {
    try {
      const callsign = clean(req.body?.callsign, 48);
      const title = clean(req.body?.title, 64);
      const avatarStyle = clean(req.body?.avatarStyle || 'vanguard', 24).toLowerCase();
      if (!callsign || !title || !AVATAR_STYLES.has(avatarStyle)) {
        return res.status(400).json({ ok: false, error: 'Valid callsign, title, and avatarStyle are required.' });
      }
      let snapshot;
      await repository.updateState(async (raw) => {
        const state = ensureWorldState(raw);
        const profile = profileFor(state, req.worldUser);
        profile.callsign = callsign;
        profile.title = title;
        profile.avatarStyle = avatarStyle;
        profile.updatedAt = nowIso();
        const accounts = await getAccounts(mt4SyncService, req.worldUser.id);
        snapshot = worldSnapshot(state, req.worldUser, profile, accounts);
        return state;
      });
      res.json(snapshot);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/world/visit', requireWorldUser, async (req, res, next) => {
    try {
      const destinationId = clean(req.body?.destinationId, 80);
      const destination = WORLD_DESTINATIONS.find((item) => item.id === destinationId);
      if (!destination) return res.status(400).json({ ok: false, error: 'Unknown destination.' });

      let result;
      await repository.updateState(async (raw) => {
        const state = ensureWorldState(raw);
        const profile = profileFor(state, req.worldUser);
        const access = destinationAccess(state, req.worldUser, profile).find((item) => item.id === destinationId);
        if (!access?.unlocked) {
          result = { denied: true, access };
          return state;
        }
        const firstVisit = !profile.visitedDestinations.includes(destinationId);
        if (firstVisit) {
          profile.visitedDestinations.push(destinationId);
          profile.xp = Number(profile.xp || 0) + 50;
          profile.updatedAt = nowIso();
        }
        state.worldAuditLogsById[`world_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`] = {
          userId: String(req.worldUser.id),
          action: 'world.destination.visited',
          destinationId,
          firstVisit,
          createdAt: nowIso(),
        };
        const accounts = await getAccounts(mt4SyncService, req.worldUser.id);
        result = { firstVisit, xpAwarded: firstVisit ? 50 : 0, state: worldSnapshot(state, req.worldUser, profile, accounts) };
        return state;
      });

      if (result?.denied) {
        return res.status(403).json({ ok: false, error: `Requires ${result.access?.minTier || 'higher'} access.`, access: result.access });
      }
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  });

  app.get('/health/world', async (_req, res) => {
    try {
      await repository.loadState();
      res.json({ ok: true, service: 'wisdo-world', version: '1.0.0-native', staticRoot: '/world/', executionFromWorldEnabled: false });
    } catch (error) {
      logger?.error?.('WISDO World health check failed.', { message: error.message });
      res.status(503).json({ ok: false, service: 'wisdo-world', error: error.message });
    }
  });

  return {
    route: '/world/',
    api: '/api/world',
    executionFromWorldEnabled: false,
  };
}
