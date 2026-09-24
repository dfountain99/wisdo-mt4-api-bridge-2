import { WorldSessionService, createWorldGpuAllocator } from '../services/worldSessionService.js';
import { validateWorldManifest } from '../services/worldSpatialPlanner.js';
import path from 'node:path';
import express from 'express';

import { getSessionUser } from './security.js';
import { createWisdoPhase1Repository, ensureWisdoPhase1State } from '../services/repositories/wisdoPhase1Repository.js';
import { WorldDataAdapterService } from '../services/worldDataAdapterService.js';
import { createDefaultWorldDNA, applyWorldDNAUpdate, worldRuntimeManifest } from '../services/worldDNAService.js';
import { compileWorldPrompt } from '../services/worldArchitectService.js';
import { applyMutation, undoWorldMutation, redoWorldMutation } from '../services/worldMutationService.js';
import { createWorldBlueprint, reviseBlueprint, branchBlueprint, simulateBlueprint, approveBlueprint, blueprintManifest } from '../services/worldBlueprintService.js';
import { compileApprovedBlueprint } from '../services/worldCompilerService.js';
import { compileHolographicPreview } from '../services/holographicBlueprintService.js';
import { createUnrealWorldManifest } from '../services/unrealWorldManifestService.js';

const WORLD_VERSION = '2.0.0-smart-home';
const HOME_SCHEMA_VERSION = 1;
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

const HOME_ROOMS = Object.freeze([
  { id: 'foyer', name: 'Entry Foyer', purpose: 'Identity, arrival summary, privacy status, and notifications.' },
  { id: 'living-hub', name: 'Central Smart Living Hub', purpose: 'Coach, account summary, primary chart, city view, and quick navigation.' },
  { id: 'trading-room', name: 'Trading Room', purpose: 'Live positions, floating P/L, market context, and account-aware inspection.' },
  { id: 'reporter-room', name: 'Reporter / System Room', purpose: 'Reporter Mesh, connection health, linked platforms, and infrastructure state.' },
  { id: 'performance-room', name: 'Performance Room', purpose: 'Equity history, trading analytics, comparisons, and campaign review.' },
  { id: 'account-vault', name: 'Account Vault', purpose: 'Authorized account switching and account identity.' },
  { id: 'growth-room', name: 'Growth Room', purpose: 'XP, education, levels, achievements, and unlocked access.' },
  { id: 'trophy-room', name: 'Trophy Room', purpose: 'Persistent milestones and selected achievements.' },
  { id: 'wardrobe', name: 'Identity / Wardrobe', purpose: 'Avatar identity and supported cosmetic choices.' },
]);

const AVATAR_STYLES = new Set(['vanguard', 'architect', 'sentinel', 'scholar']);
const HOME_THEMES = new Set(['obsidian', 'midnight', 'glass', 'warm-modern']);
const HOME_VISIBILITY = new Set(['private', 'friends', 'invite_only', 'public']);
const FINANCIAL_VISIBILITY = new Set(['owner_only', 'hidden_when_visitors', 'authorized_visitors']);

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
  next.worldHomesByUserId ||= {};
  next.worldEntitlementsByUserId ||= {};
  next.worldAuditLogsById ||= {};
  next.worldDNAByUserId ||= {};
  next.worldDraftsByUserId ||= {};
  next.personalWorldsByUserId ||= {};
  return next;
}

function defaultProfile(user = {}) {
  return {
    schemaVersion: 1,
    userId: String(user.id),
    callsign: clean(user.global_name || user.globalName || user.username || 'Operator', 48) || 'Operator',
    title: 'World Explorer',
    avatarStyle: 'vanguard',
    xp: 0,
    visitedDestinations: [],
    achievements: [],
    spawnPreference: 'home',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function profileFor(state, user) {
  const key = String(user.id);
  if (!state.worldProfilesByUserId[key]) state.worldProfilesByUserId[key] = defaultProfile(user);
  const profile = state.worldProfilesByUserId[key];
  profile.schemaVersion ||= 1;
  profile.spawnPreference ||= 'home';
  if (!Array.isArray(profile.visitedDestinations)) profile.visitedDestinations = [];
  if (!Array.isArray(profile.achievements)) profile.achievements = [];
  if (!Number.isFinite(Number(profile.xp))) profile.xp = 0;
  return profile;
}

function defaultHome(user = {}) {
  const userId = String(user.id);
  return {
    schemaVersion: HOME_SCHEMA_VERSION,
    homeId: `home:${userId}`,
    ownerUserId: userId,
    tier: 'starter_residence',
    template: 'operator-house-v1',
    displayName: 'WISDO Starter Residence',
    spawn: { roomId: 'foyer', x: 0, y: 0, z: 10.5, yaw: Math.PI },
    unlockedRooms: HOME_ROOMS.map((room) => room.id),
    roomLayoutVersion: 1,
    cosmetics: {
      theme: 'obsidian',
      accent: 'cyan-gold',
      chartWallMode: 'active_account',
      displayedTrophyIds: [],
    },
    privacy: {
      homeVisibility: 'private',
      financialVisibility: 'owner_only',
      showAccountNumbers: false,
      showTradeSizeToVisitors: false,
    },
    preferences: {
      greetingEnabled: true,
      primaryRoom: 'living-hub',
      primaryChartSymbol: '',
    },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function homeFor(state, user) {
  const key = String(user.id);
  if (!state.worldHomesByUserId[key]) state.worldHomesByUserId[key] = defaultHome(user);
  const home = state.worldHomesByUserId[key];
  home.schemaVersion ||= HOME_SCHEMA_VERSION;
  home.ownerUserId = key;
  home.homeId ||= `home:${key}`;
  home.tier ||= 'starter_residence';
  home.template ||= 'operator-house-v1';
  if (!Array.isArray(home.unlockedRooms)) home.unlockedRooms = HOME_ROOMS.map((room) => room.id);
  home.cosmetics ||= defaultHome(user).cosmetics;
  home.privacy ||= defaultHome(user).privacy;
  home.preferences ||= defaultHome(user).preferences;
  return home;
}

function worldDNAFor(state, user) {
  const key = String(user.id);
  if (!state.worldDNAByUserId[key]) state.worldDNAByUserId[key] = createDefaultWorldDNA(user);
  return state.worldDNAByUserId[key];
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

function reporterMeshFromLive(live = {}) {
  const accounts = Array.isArray(live.accounts) ? live.accounts : [];
  const nodes = (Array.isArray(live.reporters) ? live.reporters : []).map((node) => ({
    id: node.id,
    tradingAccountId: node.accountId,
    name: node.name,
    type: 'MT_REPORTER',
    status: node.status === 'live' ? 'online' : node.status,
    lastSeen: node.lastSeenAt,
    latencyMs: node.latencyMs,
    terminalConnected: node.terminalConnected,
    expertEnabled: node.expertEnabled,
    canReport: true,
    canReceiveSignals: true,
    canExecuteTrades: false,
  }));
  return {
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
    safetyNotice: 'WISDO World reads authorized Reporter state. Trade execution remains outside the World presentation layer.',
  };
}

function growthSummary(state, userId, profile) {
  const lessons = Object.values(state.lessonProgressByUserId?.[String(userId)] || {});
  const completedLessons = lessons.filter((item) => String(item?.status || '').toLowerCase() === 'completed').length;
  return {
    level: Math.max(1, Math.floor(Number(profile.xp || 0) / 250) + 1),
    xp: Number(profile.xp || 0),
    achievements: Array.isArray(profile.achievements) ? profile.achievements : [],
    education: { completedLessons, totalTrackedLessons: lessons.length },
  };
}

function unreadNotificationCount(state, userId) {
  const rows = state.notificationsByUserId?.[String(userId)] || [];
  return (Array.isArray(rows) ? rows : []).filter((item) => !item?.readAt && String(item?.status || 'unread').toLowerCase() !== 'read').length;
}

function homeRuntime(home, live, growth, state, userId) {
  return {
    instanceId: `${home.homeId}:private`,
    instanceType: 'private_home',
    template: home.template,
    rooms: HOME_ROOMS.filter((room) => home.unlockedRooms.includes(room.id)),
    live: {
      account: live.activeAccount,
      financial: live.financial,
      positions: live.positions,
      history: live.history,
      reporters: live.reporters,
      reporterSummary: live.reporterSummary,
      selectedSymbol: live.selectedSymbol,
      stale: Boolean(live.activeAccount?.freshness?.stale),
      generatedAt: live.generatedAt,
    },
    growth,
    coach: {
      available: true,
      route: '/member/wisdo',
      executionFromWorldEnabled: false,
    },
    notifications: { unread: unreadNotificationCount(state, userId), route: '/member/home' },
    cityExit: { scene: 'wisdo-central', route: '/world/?scene=central' },
    fastMode: { route: '/member/home' },
  };
}

async function worldSnapshot({ state, user, profile, home, dataAdapter }) {
  const tier = resolveWorldTier(user, state);
  const destinations = destinationAccess(state, user, profile);
  const live = await dataAdapter.snapshot(user.id, { includePrivate: true });
  const mesh = reporterMeshFromLive(live);
  const growth = growthSummary(state, user.id, profile);
  return {
    ok: true,
    version: WORLD_VERSION,
    member: {
      id: String(user.id),
      username: clean(user.username || user.global_name || user.globalName, 80),
    },
    worldProfile: { ...profile, level: growth.level },
    home,
    homeRuntime: homeRuntime(home, live, growth, state, user.id),
    worldData: live,
    growth,
    access: {
      tierKey: tier.key,
      worldLabel: tier.label,
      level: tier.level,
      destinations,
    },
    mesh,
    scene: profile.spawnPreference === 'central' ? 'central' : 'home',
    persistence: 'wisdo-phase-1-repository',
    executionFromWorldEnabled: false,
    updatedAt: nowIso(),
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

function addWorldAudit(state, userId, action, data = {}) {
  const id = `world_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  state.worldAuditLogsById[id] = { id, userId: String(userId), action, data, createdAt: nowIso() };
  return id;
}

async function ensureMemberContext(repository, user) {
  let context = null;
  const current = ensureWorldState(await repository.loadState());
  const key = String(user.id);
  if (current.worldProfilesByUserId[key] && current.worldHomesByUserId[key]) {
    return { state: current, profile: profileFor(current, user), home: homeFor(current, user) };
  }
  await repository.updateState((raw) => {
    const state = ensureWorldState(raw);
    const profile = profileFor(state, user);
    const home = homeFor(state, user);
    addWorldAudit(state, user.id, 'world.home.initialized', { homeId: home.homeId, template: home.template });
    context = { state, profile, home };
    return state;
  });
  return context;
}

function applyHomeUpdate(home, body = {}) {
  const theme = clean(body.theme ?? body.cosmetics?.theme, 32).toLowerCase();
  if (theme && HOME_THEMES.has(theme)) home.cosmetics.theme = theme;
  const accent = clean(body.accent ?? body.cosmetics?.accent, 40);
  if (accent) home.cosmetics.accent = accent;
  const primaryChartSymbol = clean(body.primaryChartSymbol ?? body.preferences?.primaryChartSymbol, 32).toUpperCase();
  if (primaryChartSymbol) home.preferences.primaryChartSymbol = primaryChartSymbol;
  if (Array.isArray(body.displayedTrophyIds ?? body.cosmetics?.displayedTrophyIds)) {
    home.cosmetics.displayedTrophyIds = [...new Set((body.displayedTrophyIds ?? body.cosmetics.displayedTrophyIds).map((item) => clean(item, 100)).filter(Boolean))].slice(0, 24);
  }
  const homeVisibility = clean(body.homeVisibility ?? body.privacy?.homeVisibility, 32).toLowerCase();
  if (HOME_VISIBILITY.has(homeVisibility)) home.privacy.homeVisibility = homeVisibility;
  const financialVisibility = clean(body.financialVisibility ?? body.privacy?.financialVisibility, 40).toLowerCase();
  if (FINANCIAL_VISIBILITY.has(financialVisibility)) home.privacy.financialVisibility = financialVisibility;
  if (typeof (body.showAccountNumbers ?? body.privacy?.showAccountNumbers) === 'boolean') home.privacy.showAccountNumbers = Boolean(body.showAccountNumbers ?? body.privacy.showAccountNumbers);
  if (typeof (body.greetingEnabled ?? body.preferences?.greetingEnabled) === 'boolean') home.preferences.greetingEnabled = Boolean(body.greetingEnabled ?? body.preferences.greetingEnabled);
  home.updatedAt = nowIso();
  return home;
}

export function worldCatalog() {
  return {
    ok: true,
    version: WORLD_VERSION,
    architecture: 'persistent-smart-home-civilization',
    defaultSpawn: 'home',
    homeSchemaVersion: HOME_SCHEMA_VERSION,
    homeRooms: HOME_ROOMS,
    tiers: WORLD_TIERS,
    destinations: WORLD_DESTINATIONS.map((item) => ({ ...item, minTier: WORLD_TIERS.find((tier) => tier.level === item.minLevel)?.label || 'Member' })),
    billingConnected: false,
    executionFromWorldEnabled: false,
    note: 'World, Fast Mode, MT4 Reporter data, identity, and entitlements share existing WISDO services. The World layer does not own financial truth or execution authority.',
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
  const dataAdapter = new WorldDataAdapterService({ mt4SyncService, logger });
  const worldRoot = path.join(publicRoot, 'app', 'world');
  const indexFile = path.join(worldRoot, 'index.html');

  // Canonical live WISDO World routes. Keep /app/world as the permanent browser entry.
  app.get('/app/world', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('X-Wisdo-Workspace', 'world');
    res.sendFile(indexFile);
  });
  app.use('/app/world', express.static(worldRoot, { index: 'index.html', redirect: false, fallthrough: true, maxAge: '5m' }));

  app.get('/world', (_req, res) => res.redirect(302, '/app/world'));
  app.get('/wisdo-world.html', (_req, res) => res.redirect(302, '/world/'));
  app.get('/world/', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('X-Wisdo-Workspace', 'world');
    res.sendFile(indexFile);
  });
  app.use('/world/assets', express.static(worldRoot, { index: false, redirect: false, fallthrough: true, maxAge: '1h' }));

  app.get('/api/world/catalog', (_req, res) => res.json(worldCatalog()));
  app.get('/api/world/build-info', (_req, res) => res.json({
    ok: true,
    service: 'wisdo-world',
    version: WORLD_VERSION,
    release: 'genesis-v4-world-foundry',
    gitSha: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || process.env.COMMIT_SHA || null,
    canonicalUrl: '/app/world',
    genesisUrl: '/app/world?scene=genesis',
    genesisRuntime: '/app/world/babylon-city/genesis-v4.html',
    centralUrl: '/app/world?scene=central',
  }));

  const sendMemberState = async (req, res, next) => {
    try {
      const { state, profile, home } = await ensureMemberContext(repository, req.worldUser);
      res.json(await worldSnapshot({ state, user: req.worldUser, profile, home, dataAdapter }));
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/world/me', requireWorldUser, sendMemberState);
  app.get('/api/world/state', requireWorldUser, sendMemberState);

  app.get('/api/world/home', requireWorldUser, async (req, res, next) => {
    try {
      const { state, profile, home } = await ensureMemberContext(repository, req.worldUser);
      const snapshot = await worldSnapshot({ state, user: req.worldUser, profile, home, dataAdapter });
      res.json({ ok: true, home: snapshot.home, runtime: snapshot.homeRuntime, worldProfile: snapshot.worldProfile, access: snapshot.access });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/world/home', requireWorldUser, async (req, res, next) => {
    try {
      let captured;
      await repository.updateState((raw) => {
        const state = ensureWorldState(raw);
        const profile = profileFor(state, req.worldUser);
        const home = applyHomeUpdate(homeFor(state, req.worldUser), req.body || {});
        addWorldAudit(state, req.worldUser.id, 'world.home.updated', { theme: home.cosmetics.theme, privacy: home.privacy, primaryChartSymbol: home.preferences.primaryChartSymbol });
        captured = { state, profile, home };
        return state;
      });
      res.json(await worldSnapshot({ ...captured, user: req.worldUser, dataAdapter }));
    } catch (error) {
      next(error);
    }
  });

  // GPU provisioning is opt-in. No stream or runtime credential is returned until
  // the allocator and trusted runtime complete the readiness handshake.
  const worldSessions = new WorldSessionService({allocator:createWorldGpuAllocator(),streamOrigin:process.env.WISDO_WORLD_STREAM_ORIGIN});
  const sessionError = (res,error) => res.status(error.status||500).json({ok:false,error:error.message});
  app.post('/api/worlds/:worldId/enter', requireWorldUser, async (req,res)=>{try{
    let world;await repository.updateState(raw=>{const state=ensureWorldState(raw);world=state.personalWorldsByUserId[String(req.worldUser.id)]||null;return state});
    if(!world||world.worldId!==req.params.worldId)return res.status(404).json({ok:false,error:'world_not_found'});
    const session=await worldSessions.enter({world,userId:req.worldUser.id});res.status(202).set('Cache-Control','no-store').json({ok:true,...session});
  }catch(error){sessionError(res,error)}});
  app.get('/api/world-sessions/:sessionId',requireWorldUser,(req,res)=>{try{res.set('Cache-Control','no-store').json({ok:true,...worldSessions.owner(req.params.sessionId,req.worldUser.id)})}catch(error){sessionError(res,error)}});
  app.post('/api/world-sessions/:sessionId/disconnect',requireWorldUser,(req,res)=>{try{res.json({ok:true,...worldSessions.disconnect(req.params.sessionId,req.worldUser.id)})}catch(error){sessionError(res,error)}});
  const runtimeToken=req=>/^Bearer (\S+)$/i.exec(String(req.get('Authorization')||''))?.[1];
  app.get('/internal/world-sessions/:sessionId/manifest',(req,res)=>{try{res.set('Cache-Control','no-store').json({ok:true,manifest:worldSessions.manifest(req.params.sessionId,runtimeToken(req))})}catch(error){sessionError(res,error)}});
  app.post('/internal/world-sessions/:sessionId/step',(req,res)=>{try{res.json({ok:true,...worldSessions.confirm(req.params.sessionId,runtimeToken(req),req.body?.step)})}catch(error){sessionError(res,error)}});
  app.post('/internal/world-sessions/:sessionId/phase',(req,res)=>{try{res.json({ok:true,...worldSessions.report(req.params.sessionId,runtimeToken(req),req.body||{})})}catch(error){sessionError(res,error)}});

  // Genesis V4 World Foundry: durable draft -> approval -> forge. Creation never routes to Commons.
  app.get('/api/world/foundry', requireWorldUser, async (req,res,next)=>{try{let draft,world;await repository.updateState(raw=>{const state=ensureWorldState(raw);const uid=String(req.worldUser.id);draft=state.worldDraftsByUserId[uid]||null;world=state.personalWorldsByUserId[uid]||null;return state});res.json({ok:true,draft,world});}catch(e){next(e)}});
  app.post('/api/world/foundry/draft', requireWorldUser, async (req,res,next)=>{try{const prompt=clean(req.body?.prompt,1200);if(!prompt)return res.status(400).json({ok:false,error:'prompt is required.'});let draft;await repository.updateState(raw=>{const state=ensureWorldState(raw),uid=String(req.worldUser.id),preview=compileHolographicPreview(prompt,req.body?.context||{}),prior=state.worldDraftsByUserId[uid];draft={draftId:prior?.draftId||`draft:${uid}`,ownerId:uid,name:clean(req.body?.name||prior?.name||prompt.split(/[,.]/)[0],72)||'My World',description:prompt,stage:'visualize',approved:false,revision:Number(prior?.revision||0)+1,preview,permissions:{visibility:req.body?.visibility||prior?.permissions?.visibility||'private',invitedUsers:prior?.permissions?.invitedUsers||[]},updatedAt:nowIso(),createdAt:prior?.createdAt||nowIso()};state.worldDraftsByUserId[uid]=draft;addWorldAudit(state,uid,'world.foundry.draft',{draftId:draft.draftId,revision:draft.revision});return state});res.json({ok:true,draft});}catch(e){next(e)}});
  app.post('/api/world/foundry/approve', requireWorldUser, async (req,res,next)=>{try{let draft;await repository.updateState(raw=>{const state=ensureWorldState(raw),uid=String(req.worldUser.id);draft=state.worldDraftsByUserId[uid];if(!draft)throw new Error('world_draft_required');draft={...draft,stage:'approved',approved:true,approvedAt:nowIso(),updatedAt:nowIso()};state.worldDraftsByUserId[uid]=draft;return state});res.json({ok:true,draft,summary:{worldName:draft.name,estimatedZones:4,startingResources:['wood','stone','energy'],firstBuilding:'Personal Home',visibility:draft.permissions.visibility,invitedUsers:draft.permissions.invitedUsers,forgeStatus:'ready'}});}catch(e){res.status(400).json({ok:false,error:e.message})}});
  app.post('/api/world/foundry/forge', requireWorldUser, async (req,res,next)=>{try{let world;await repository.updateState(raw=>{const state=ensureWorldState(raw),uid=String(req.worldUser.id),d=state.worldDraftsByUserId[uid];if(!d?.approved)throw new Error('approved_blueprint_required');const old=state.personalWorldsByUserId[uid];if(!d.preview?.truth?.valid)throw new Error('forge_incomplete: '+JSON.stringify(d.preview?.truth?.errors||[{code:'MISSING_TRUTH_REPORT'}]));world={worldId:old?.worldId||`world:${uid}`,ownerId:uid,name:d.name,description:d.description,theme:d.preview?.themeIdentity?.id||d.preview?.theme||'custom',themeIdentity:d.preview?.themeIdentity,seed:d.preview?.seed,assetCatalog:d.preview?.assetCatalog,fidelityVersion:d.preview?.fidelityVersion,terrain:{type:'spawn-island'},buildings:(d.preview?.operations||[]).filter(o=>['CREATE_CASTLE','CREATE_CITY_ZONE','CREATE_TOWER','CREATE_HOME','CREATE_CRAFTING_LAB'].includes(o.type)).map((o,i)=>({id:`structure-${i}`,type:o.type.replace('CREATE_','').toLowerCase(),name:o.payload?.name||'Structure',position:o.payload?.position||{x:i*8,y:0,z:-8},height:o.payload?.height})),zones:[{id:'spawn',type:'spawn-island',walkable:true}],objects:[],portals:(d.preview?.operations||[]).filter(o=>o.type==='CREATE_PORTAL').map((o,i)=>({id:`portal-${i}`,status:'inactive',destination:null,position:o.payload?.position})),forgeOperations:d.preview?.operations||[],world:d.preview?.world,intent:{ideas:d.preview?.ideas||[]},revision:d.revision,permissions:d.permissions,progression:{level:1,resources:{wood:25,stone:25,energy:10}},buildStatus:'forged',spawn:{x:0,y:1.8,z:600},updatedAt:nowIso(),createdAt:old?.createdAt||nowIso()};const report=validateWorldManifest({...world,operations:world.forgeOperations});if(!report.valid)throw new Error('forge_incomplete: '+JSON.stringify(report.errors));world.forgeTruth=report;state.personalWorldsByUserId[uid]=world;state.worldDraftsByUserId[uid]={...d,stage:'forged',forgedWorldId:world.worldId,updatedAt:nowIso()};addWorldAudit(state,uid,'world.foundry.forged',{worldId:world.worldId});return state});res.json({ok:true,status:'WORLD FORGED',world,enterUrl:'/app/world?scene=personal'});}catch(e){res.status(400).json({ok:false,error:e.message})}});
  app.get('/api/world/personal/unreal-manifest', requireWorldUser, async (req,res,next)=>{try{let world;await repository.updateState(raw=>{const state=ensureWorldState(raw);world=state.personalWorldsByUserId[String(req.worldUser.id)]||null;return state});if(!world)return res.status(404).json({ok:false,error:'personal_world_not_forged'});res.set('Cache-Control','no-store');res.json({ok:true,manifest:createUnrealWorldManifest(world)});}catch(e){next(e)}});
  app.get('/api/world/personal', requireWorldUser, async (req,res,next)=>{try{let world;await repository.updateState(raw=>{const state=ensureWorldState(raw);world=state.personalWorldsByUserId[String(req.worldUser.id)]||null;return state});if(!world)return res.status(404).json({ok:false,error:'personal_world_not_forged',genesisUrl:'/app/world?scene=genesis'});res.json({ok:true,world});}catch(e){next(e)}});

  // Personal Planet / World Forge API. World DNA is renderer-neutral and can feed Babylon today or Unreal later.
  app.post('/api/world/blueprint/preview', requireWorldUser, (req,res)=>{const prompt=clean(req.body?.prompt,1200);if(!prompt)return res.status(400).json({ok:false,error:'prompt is required.'});res.json({ok:true,preview:compileHolographicPreview(prompt,req.body?.context||{})});});

  app.get('/api/world/blueprint', requireWorldUser, (req, res) => {
    const uid=String(req.worldUser.id); let bp=worldBlueprintByUserId.get(uid); if(!bp){bp=createWorldBlueprint(uid);worldBlueprintByUserId.set(uid,bp)}
    res.json({ok:true,blueprint:bp,manifest:blueprintManifest(bp)});
  });
  app.post('/api/world/blueprint', requireWorldUser, (req, res) => {
    const uid=String(req.worldUser.id); const current=worldBlueprintByUserId.get(uid)||createWorldBlueprint(uid); const bp=reviseBlueprint(current,req.body||{},uid); worldBlueprintByUserId.set(uid,bp); res.json({ok:true,blueprint:bp,manifest:blueprintManifest(bp)});
  });
  app.post('/api/world/blueprint/branch', requireWorldUser, (req,res)=>{const uid=String(req.worldUser.id);const current=worldBlueprintByUserId.get(uid)||createWorldBlueprint(uid);const bp=branchBlueprint(current,req.body?.label);worldBlueprintByUserId.set(uid,bp);res.json({ok:true,blueprint:bp});});
  app.post('/api/world/blueprint/simulate', requireWorldUser, (req,res)=>{const uid=String(req.worldUser.id);const current=worldBlueprintByUserId.get(uid)||createWorldBlueprint(uid);const result=simulateBlueprint(current,req.body||{});worldBlueprintByUserId.set(uid,result.blueprint);res.json({ok:true,...result});});
  app.post('/api/world/blueprint/approve', requireWorldUser, (req,res)=>{try{const uid=String(req.worldUser.id);const current=worldBlueprintByUserId.get(uid)||createWorldBlueprint(uid);const bp=approveBlueprint(current);worldBlueprintByUserId.set(uid,bp);res.json({ok:true,blueprint:bp,forgePlan:compileApprovedBlueprint(bp)});}catch(error){res.status(400).json({ok:false,error:error.message});}});
  app.post('/api/world/blueprint/forge', requireWorldUser, (req,res)=>{try{const uid=String(req.worldUser.id);const bp=worldBlueprintByUserId.get(uid);const forgePlan=compileApprovedBlueprint(bp);res.json({ok:true,status:'ready-to-forge',forgePlan});}catch(error){res.status(400).json({ok:false,error:error.message});}});

  app.get('/api/world/dna', requireWorldUser, async (req, res, next) => {
    try {
      let dna;
      await repository.updateState((raw) => {
        const state = ensureWorldState(raw);
        dna = worldDNAFor(state, req.worldUser);
        return state;
      });
      res.json({ ok: true, dna, runtime: worldRuntimeManifest(dna) });
    } catch (error) { next(error); }
  });

  app.post('/api/world/dna', requireWorldUser, async (req, res, next) => {
    try {
      let dna;
      await repository.updateState((raw) => {
        const state = ensureWorldState(raw);
        const current = worldDNAFor(state, req.worldUser);
        dna = applyWorldDNAUpdate(current, req.body || {});
        state.worldDNAByUserId[String(req.worldUser.id)] = dna;
        addWorldAudit(state, req.worldUser.id, 'world.dna.updated', { worldId: dna.worldId, revision: dna.generation.revision });
        return state;
      });
      res.json({ ok: true, dna, runtime: worldRuntimeManifest(dna) });
    } catch (error) { next(error); }
  });

  app.post('/api/world/architect', requireWorldUser, async (req, res, next) => {
    try {
      const prompt = clean(req.body?.prompt, 1200);
      if (!prompt) return res.status(400).json({ ok: false, error: 'prompt is required.' });
      let dna;
      let plan;
      await repository.updateState((raw) => {
        const state = ensureWorldState(raw);
        const current = worldDNAFor(state, req.worldUser);
        plan = compileWorldPrompt(prompt, current);
        dna = applyWorldDNAUpdate(current, plan.patch);
        dna.architect.onboardingComplete = true;
        dna.generation.status = plan.requiresAssetGeneration ? 'asset_generation_pending' : 'ready';
        state.worldDNAByUserId[String(req.worldUser.id)] = dna;
        addWorldAudit(state, req.worldUser.id, 'world.architect.command', { worldId: dna.worldId, revision: dna.generation.revision, understood: plan.understood });
        return state;
      });
      res.json({ ok: true, plan, dna, runtime: worldRuntimeManifest(dna) });
    } catch (error) { next(error); }
  });

  app.post('/api/world/mutate', requireWorldUser, async (req, res, next) => {
    try {
      let result;
      await repository.updateState((raw) => {
        const state = ensureWorldState(raw);
        result = applyMutation(worldDNAFor(state, req.worldUser), req.body || {}, { userId: req.worldUser.id });
        state.worldDNAByUserId[String(req.worldUser.id)] = result.dna;
        addWorldAudit(state, req.worldUser.id, 'world.mutation.applied', { type: result.mutation.type, objectId: result.mutation.objectId, revisionId: result.revision.revisionId });
        return state;
      });
      res.json({ ok: true, ...result, runtime: worldRuntimeManifest(result.dna) });
    } catch (error) {
      if (['unsupported_world_mutation','world_object_not_found'].includes(error.message)) return res.status(400).json({ ok: false, error: error.message });
      next(error);
    }
  });

  app.post('/api/world/history/:action', requireWorldUser, async (req, res, next) => {
    try {
      const action = clean(req.params.action, 16).toLowerCase();
      if (!['undo','redo'].includes(action)) return res.status(400).json({ ok: false, error: 'invalid_history_action' });
      let result;
      await repository.updateState((raw) => {
        const state = ensureWorldState(raw);
        result = action === 'undo' ? undoWorldMutation(worldDNAFor(state, req.worldUser)) : redoWorldMutation(worldDNAFor(state, req.worldUser));
        state.worldDNAByUserId[String(req.worldUser.id)] = result.dna;
        addWorldAudit(state, req.worldUser.id, `world.history.${action}`, { changed: result.changed });
        return state;
      });
      res.json({ ok: true, ...result, runtime: worldRuntimeManifest(result.dna) });
    } catch (error) { next(error); }
  });

  app.get('/api/world/mesh', requireWorldUser, async (req, res, next) => {
    try {
      const live = await dataAdapter.snapshot(req.worldUser.id, { includePrivate: true });
      res.json({ ok: true, ...reporterMeshFromLive(live) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/world/account/select', requireWorldUser, async (req, res, next) => {
    try {
      const accountId = clean(req.body?.accountId, 120);
      if (!accountId) return res.status(400).json({ ok: false, error: 'accountId is required.' });
      await dataAdapter.selectAccount(req.worldUser.id, accountId);
      let captured;
      await repository.updateState((raw) => {
        const state = ensureWorldState(raw);
        const profile = profileFor(state, req.worldUser);
        const home = homeFor(state, req.worldUser);
        addWorldAudit(state, req.worldUser.id, 'world.account.selected', { accountId });
        captured = { state, profile, home };
        return state;
      });
      res.json(await worldSnapshot({ ...captured, user: req.worldUser, dataAdapter }));
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
      let captured;
      await repository.updateState((raw) => {
        const state = ensureWorldState(raw);
        const profile = profileFor(state, req.worldUser);
        const home = homeFor(state, req.worldUser);
        profile.callsign = callsign;
        profile.title = title;
        profile.avatarStyle = avatarStyle;
        profile.updatedAt = nowIso();
        addWorldAudit(state, req.worldUser.id, 'world.profile.updated', { callsign, title, avatarStyle });
        captured = { state, profile, home };
        return state;
      });
      res.json(await worldSnapshot({ ...captured, user: req.worldUser, dataAdapter }));
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
      await repository.updateState((raw) => {
        const state = ensureWorldState(raw);
        const profile = profileFor(state, req.worldUser);
        const home = homeFor(state, req.worldUser);
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
        addWorldAudit(state, req.worldUser.id, 'world.destination.visited', { destinationId, firstVisit });
        result = { firstVisit, xpAwarded: firstVisit ? 50 : 0, state, profile, home };
        return state;
      });
      if (result?.denied) return res.status(403).json({ ok: false, error: `Requires ${result.access?.minTier || 'higher'} access.`, access: result.access });
      const snapshot = await worldSnapshot({ state: result.state, user: req.worldUser, profile: result.profile, home: result.home, dataAdapter });
      res.json({ ok: true, firstVisit: result.firstVisit, xpAwarded: result.xpAwarded, state: snapshot });
    } catch (error) {
      next(error);
    }
  });

  app.get('/health/world', async (_req, res) => {
    try {
      await repository.loadState();
      res.json({ ok: true, service: 'wisdo-world', version: WORLD_VERSION, architecture: 'smart-home-first', staticRoot: '/world/', executionFromWorldEnabled: false });
    } catch (error) {
      logger?.error?.('WISDO World health check failed.', { message: error.message });
      res.status(503).json({ ok: false, service: 'wisdo-world', error: error.message });
    }
  });

  return {
    route: '/app/world',
    api: '/api/world',
    defaultSpawn: 'home',
    architecture: 'persistent-smart-home-civilization',
    executionFromWorldEnabled: false,
  };
}
