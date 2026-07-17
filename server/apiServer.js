import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { registerDeadshotCommandCenterRoutes } from './deadshotSite.js';
import { registerMajorUpgradeRoutes } from './majorUpgradeRoutes.js';
import { registerExtendedProductRoutes } from './extendedProductRoutes.js';
import { encodeSignedSession, decodeSignedSession } from './security.js';
import {
  createWisdoPhase1Repository,
  ensureWisdoPhase1State,
} from '../services/repositories/wisdoPhase1Repository.js';
import { AffiliateService } from '../services/affiliateService.js';
import { DiscordRoleSyncService } from '../services/discordRoleSyncService.js';
import { SignalGridService } from '../services/signalGridService.js';
import { SignalCopyService } from '../services/signalCopyService.js';
import { DiscordSignalGridService } from '../services/discordSignalGridService.js';
import { NotificationDeliveryService } from '../services/notificationDeliveryService.js';
import { closeNotificationText, finalizeCloseTracker, isCloseCommand, queueCloseEmail } from '../services/tradeCloseIntelligence.js';
import { createRedisCommandBridge } from '../services/redisCommandBridge.js';
import {
  DISCORD_ROLE_MAP,
  FUTURE_DISCORD_ROLE_MAP,
  canAccessAdmin,
  canAccessEducationModule,
  canRequestCopy,
  canSeeMarketplaceBot,
  canUseCopier,
  hasPermission,
} from '../config/discordRoleMap.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let wisdoPhase1Repository = null;

function getWisdoPhase1Repository(config = {}) {
  if (!wisdoPhase1Repository) {
    wisdoPhase1Repository = createWisdoPhase1Repository(config);
  }
  return wisdoPhase1Repository;
}

function rangeFromPeriod(period = 'today') {
  const now = new Date();
  const start = new Date(now);
  if (period === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    start.setDate(now.getDate() - 7);
  } else {
    start.setHours(0, 0, 0, 0);
  }
  return { start: start.toISOString(), end: now.toISOString() };
}

function getClientBaseUrl(req, config) {
  return config.api.publicBaseUrl || `${req.protocol}://${req.get('host')}`;
}

function asNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function money(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(value) {
  const n = Number(value || 0);
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function slugify(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item';
}

function botPrice(bot, config) {
  if (Number.isFinite(Number(bot?.priceUsd))) return Number(bot.priceUsd);
  if (bot.recommended) return 3000;
  if (String(bot.category || '').toLowerCase().includes('copy')) return 397;
  if (String(bot.risk || '').toLowerCase().includes('high')) return Number(config.store.basePriceUsd || 997);
  return Number(config.store.negotiationFloorUsd || 297);
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}


function getOAuthBaseUrl(req, config) {
  return String(process.env.PUBLIC_BASE_URL || config?.api?.publicBaseUrl || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

function getAuthHealth(req, config) {
  const publicBaseUrl = getOAuthBaseUrl(req, config);
  const clientId = process.env.CLIENT_ID || config?.discord?.clientId || config?.clientId || '';
  const clientSecret = process.env.CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET || '';
  const expectedRedirectUri = `${publicBaseUrl}/auth/discord/callback`;
  return {
    ok: true,
    publicBaseUrl,
    publicBaseUrlConfigured: Boolean(publicBaseUrl),
    clientIdConfigured: Boolean(clientId),
    clientSecretConfigured: Boolean(clientSecret),
    expectedRedirectUri,
    loginReady: Boolean(publicBaseUrl && clientId && clientSecret),
    setup: {
      renderEnvironment: ['PUBLIC_BASE_URL', 'CLIENT_ID', 'CLIENT_SECRET'],
      discordRedirect: expectedRedirectUri,
    },
  };
}

function parseCookies(req) {
  const header = req.headers?.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(value);
  }
  return out;
}

function setCookie(res, name, value, options = {}) {
  const attrs = [`${name}=${encodeURIComponent(value)}`];
  attrs.push('Path=/');
  attrs.push('HttpOnly');
  attrs.push('SameSite=Lax');
  if (options.maxAge !== undefined) attrs.push(`Max-Age=${options.maxAge}`);
  if (options.secure !== false) attrs.push('Secure');
  res.append('Set-Cookie', attrs.join('; '));
}

function clearCookie(res, name) {
  res.append('Set-Cookie', `${name}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`);
}

function encodeSession(user) {
  return encodeSignedSession(user);
}


function decodeSession(value) {
  return decodeSignedSession(value);
}

function getCurrentUser(req) {
  const cookies = parseCookies(req);
  return decodeSession(cookies.cc_user || cookies.wisdo_user || '');
}

function safeReturnPath(value = '', fallback = '/member/command-center') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('://')) return fallback;
  if (raw === '/member' || raw === '/member/home') return '/member/command-center';
  return raw;
}

function loginHealthPanel(req, config, error = '') {
  const health = getAuthHealth(req, config);
  const user = getCurrentUser(req);
  const returnTo = safeReturnPath(req.query?.returnTo || req.query?.next || req.query?.redirect, '/member/command-center');
  const missing = [];
  if (!health.publicBaseUrlConfigured) missing.push('PUBLIC_BASE_URL');
  if (!health.clientIdConfigured) missing.push('CLIENT_ID');
  if (!health.clientSecretConfigured) missing.push('CLIENT_SECRET');
  const rows = [
    ['PUBLIC_BASE_URL', health.publicBaseUrlConfigured ? 'Configured' : 'Missing', health.publicBaseUrl],
    ['CLIENT_ID', health.clientIdConfigured ? 'Configured' : 'Missing', health.clientIdConfigured ? 'Hidden for safety' : 'Add CLIENT_ID in Render'],
    ['CLIENT_SECRET', health.clientSecretConfigured ? 'Configured' : 'Missing', health.clientSecretConfigured ? 'Hidden for safety' : 'Add CLIENT_SECRET in Render'],
    ['Expected Redirect', 'Use this exact URL', health.expectedRedirectUri],
    ['Session', user ? 'Logged in' : 'Not logged in', user ? `${user.username || user.global_name || user.id} (${user.id})` : 'No active Discord session'],
  ].map(([k,s,v])=>`<tr><td>${esc(k)}</td><td>${esc(s)}</td><td><code>${esc(v)}</code></td></tr>`).join('');
  const errorBox = error ? `<section class="card warn"><h3>Login Error</h3><p>${esc(error)}</p><p>If this is a redirect mismatch, add this exact redirect in Discord Developer Portal:</p><code>${esc(health.expectedRedirectUri)}</code></section>` : '';
  const action = health.loginReady ? `<a class="btn primary" href="/auth/discord?returnTo=${encodeURIComponent(returnTo)}">Login with Discord</a>` : '<button class="btn primary" disabled>Login disabled until setup is complete</button>';
  return `${sectionHero('CultureCoin Login', 'Discord OAuth login with built-in setup checks. This page will tell you exactly what is missing instead of failing silently.', '<a class="btn" href="/auth/debug">OAuth Debug</a><a class="btn" href="/setup/oauth">Setup Guide</a>')}${errorBox}<section class="card full"><h3>OAuth Health</h3><table><thead><tr><th>Check</th><th>Status</th><th>Value / Fix</th></tr></thead><tbody>${rows}</tbody></table><div style="margin-top:16px">${action}<a class="btn" href="/login">Try Again</a><a class="btn" href="/public">Continue Public Website</a>${user ? '<a class="btn" href="/member/home">Go to Member Home</a><a class="btn" href="/logout">Logout</a>' : ''}</div></section>${missing.length ? `<section class="card warn full"><h3>Missing Render Environment</h3><p>Add these variables in Render → Environment:</p><pre>${missing.map((m)=>`${m}=`).join('\n')}</pre></section>` : ''}`;
}

function oauthDebugPage(req, config) {
  const health = getAuthHealth(req, config);
  const user = getCurrentUser(req);
  return `${sectionHero('OAuth Debug', 'Use this page when Discord login does not work. No secrets are displayed.', '<a class="btn primary" href="/login">Back to Login</a>')}<div class="grid2"><section class="card"><h3>Expected Discord Redirect</h3><p><code>${esc(health.expectedRedirectUri)}</code></p><p>Add this exact URL in Discord Developer Portal → OAuth2 → Redirects.</p></section><section class="card"><h3>Readiness</h3><p>Login ready: <strong>${health.loginReady ? 'YES' : 'NO'}</strong></p><p>PUBLIC_BASE_URL: ${health.publicBaseUrlConfigured ? 'Configured' : 'Missing'}</p><p>CLIENT_ID: ${health.clientIdConfigured ? 'Configured' : 'Missing'}</p><p>CLIENT_SECRET: ${health.clientSecretConfigured ? 'Configured' : 'Missing'}</p></section><section class="card full"><h3>Current Session</h3><pre>${esc(JSON.stringify({ user: user ? { id: user.id, username: user.username, global_name: user.global_name } : null, expectedRedirectUri: health.expectedRedirectUri, publicBaseUrl: health.publicBaseUrl }, null, 2))}</pre></section></div>`;
}

function oauthSetupPage(req, config) {
  const health = getAuthHealth(req, config);
  return `${sectionHero('Discord OAuth Setup', 'Follow these steps to make /login work for every member.', '<a class="btn primary" href="/login">Test Login</a><a class="btn" href="/auth/debug">Debug</a>')}<div class="grid2"><section class="card"><h3>1. Render Environment</h3><pre>PUBLIC_BASE_URL=${esc(health.publicBaseUrl)}\nCLIENT_ID=your_discord_app_client_id\nCLIENT_SECRET=your_discord_client_secret</pre><p>Do not put CLIENT_SECRET in GitHub, Discord, screenshots, or frontend code.</p></section><section class="card"><h3>2. Discord Redirect</h3><p>Add this exact redirect:</p><code>${esc(health.expectedRedirectUri)}</code><p>Discord Developer Portal → Your App → OAuth2 → Redirects.</p></section><section class="card"><h3>3. Redeploy Render</h3><p>After saving environment variables, Render should redeploy. Then open /auth/debug.</p></section><section class="card"><h3>4. Success Route</h3><p>After login, WISDO sends users to <code>/member/home</code> so the dashboard can load their own accounts.</p></section></div>`;
}


let ecosystemStateCache = null;
let ecosystemStateLoadPromise = null;
let ecosystemStateSaveQueue = Promise.resolve();

async function loadEcosystemState() {
  if (ecosystemStateCache) return ecosystemStateCache;
  if (ecosystemStateLoadPromise) return ecosystemStateLoadPromise;
  ecosystemStateLoadPromise = (async () => {
    const repository = getWisdoPhase1Repository();
    try {
      const state = ensureWisdoStateCollections(ensureWisdoPhase1State(await repository.loadState()));
      let seeded = ensureWisdoEducationSeeds(state);
      seeded = ensureWisdoAcademySeeds(state) || seeded;
      ecosystemStateCache = state;
      if (seeded) await repository.saveState(state);
      return ecosystemStateCache;
    } catch (error) {
      if (ecosystemStateCache) return ecosystemStateCache;
      throw error;
    } finally {
      ecosystemStateLoadPromise = null;
    }
  })();
  return ecosystemStateLoadPromise;
}

async function saveEcosystemState(state) {
  ecosystemStateCache = ensureWisdoStateCollections(ensureWisdoPhase1State(state || ecosystemStateCache || {}));
  const operation = ecosystemStateSaveQueue.then(() => getWisdoPhase1Repository().saveState(ecosystemStateCache));
  ecosystemStateSaveQueue = operation.catch(() => undefined);
  return operation;
}

function ensureWisdoStateCollections(state = {}) {
  const objectBuckets = [
    'usersById',
    'ordersById',
    'licensesByUserId',
    'videosByUserId',
    'referralCodesByUserId',
    'referralLinksById',
    'commissionRulesById',
    'commissionLedgerById',
    'payoutsById',
    'subscriptionsById',
    'paymentPlansById',
    'vpsAssignmentsById',
    'paidLinkAccessById',
    'paidLinkAccessByUserId',
    'wisdoDesksByUserId',
    'deskPreferencesByUserId',
    'botVersionsBySlug',
    'botFilesById',
    'botAccessByUserId',
    'botPresetsById',
    'botEducationModulesByBotSlug',
    'lessonsById',
    'lessonProgressByUserId',
    'quizzesById',
    'academyTracksById',
    'academyLessonsById',
    'academyQuizzesById',
    'academyProgressByUserId',
    'academyQuizAttemptsByUserId',
    'academyUnlocksByUserId',
    'aiCoachLogsByUserId',
    'aiInsightsById',
    'simulationScenariosById',
    'copyRequestsById',
    'copyRelationshipsById',
    'copyRiskProfilesByUserId',
    'copyTradeLogsById',
    'socialPostsById',
    'commentsById',
    'likesByUserId',
    'followsByUserId',
    'notificationsByUserId',
    'themePreferencesByUserId',
    'adminAuditLogsById',
    'roleSyncByUserId',
    'roleOverridesByUserId',
    'signalGridChannelsById',
    'signalSourcesById',
    'signalGridCellsById',
    'signalBasketsById',
    'signalGridInteractionLogsById',
    'copyBotSubscriptionsById',
    'signalGridSettings',
    'affiliatesById',
    'affiliateReferralsById',
    'affiliateCommissionsById',
    'affiliatePayoutsById',
    'affiliateCampaignsById',
    'affiliateSettings',
    'creatorPayoutsById',
    'paymentsById',
    'serverAnnouncementsById',
    'featureFlagsById',
    'notificationOutboxById',
    'notificationDeliveryLogById',
    'notificationPreferencesByUserId',
    'funnelCampaignsById',
    'funnelVisitsById',
    'funnelLeadsById',
  ];
  for (const key of objectBuckets) state[key] ||= {};
  state.referralVisits ||= [];
  state.conversions ||= [];
  state.funnelEvents ||= [];
  state.leads ||= [];
  return state;
}

function ensureWisdoEducationSeeds(state = {}) {
  const botSlug = 'df-sauce-final-ai';
  const now = new Date().toISOString();
  const note = 'Educational starter content - admin can replace/edit later.';
  state.botEducationModulesByBotSlug ||= {};
  state.lessonsById ||= {};
  state.quizzesById ||= {};
  let changed = false;
  const lesson = (id, title, summary, track) => {
    if (!state.lessonsById[id]) {
      state.lessonsById[id] = {
        lessonId: id,
        botSlug,
        title,
        summary,
        track,
        type: 'starter_lesson',
        durationMinutes: 6,
        seedNote: note,
        seedData: true,
        createdAt: now,
      };
      changed = true;
    }
    return id;
  };
  const modules = [
    {
      moduleId: 'df_sauce_final_ai_overview',
      title: 'Module 1: Bot Overview',
      track: 'Bot-specific education',
      lessons: [
        lesson('df_sauce_lesson_what_it_does', 'What DF Sauce Final AI is designed to do', 'Understand the bot mission, trade style, and where it belongs in a Wisdo account plan.', 'Bot Overview'),
        lesson('df_sauce_lesson_best_symbols_sessions', 'Best symbols and sessions', 'Review preferred instruments, London/New York behavior, and when to avoid thin liquidity.', 'Bot Overview'),
        lesson('df_sauce_lesson_market_conditions', 'Market conditions it prefers', 'Learn how trend, pullback, consolidation, and high-impact news change bot quality.', 'Bot Overview'),
      ],
    },
    {
      moduleId: 'df_sauce_final_ai_risk_setup',
      title: 'Module 2: Risk Setup',
      track: 'Copy trading safety education',
      lessons: [
        lesson('df_sauce_lesson_risk_per_trade', 'Risk per trade', 'Set risk from account equity and personal tolerance before thinking about lot size.', 'Risk Setup'),
        lesson('df_sauce_lesson_lot_sizing', 'Lot sizing', 'Translate stop distance, pip value, and account size into controlled exposure.', 'Risk Setup'),
        lesson('df_sauce_lesson_drawdown_control', 'Drawdown control', 'Use max lot, daily loss, and pause rules to keep a bad session contained.', 'Risk Setup'),
        lesson('df_sauce_lesson_no_blind_copy_lots', 'Why Wisdo does not blind-copy lot sizes', 'Understand why copied trades are recalculated through a risk passport instead of mirroring master lots.', 'Risk Setup'),
      ],
    },
    {
      moduleId: 'df_sauce_final_ai_market_flow',
      title: 'Module 3: Market Flow',
      track: 'FLOW section',
      lessons: [
        lesson('df_sauce_lesson_trend_behavior', 'Trend behavior', 'Spot when DF Sauce has cleaner continuation conditions.', 'Market Flow'),
        lesson('df_sauce_lesson_pullback_behavior', 'Pullback behavior', 'Learn how pullbacks can help entries without becoming reversal traps.', 'Market Flow'),
        lesson('df_sauce_lesson_consolidation_behavior', 'Consolidation behavior', 'Recognize chop, range compression, and conditions where patience beats entry frequency.', 'Market Flow'),
        lesson('df_sauce_lesson_news_spread_protection', 'News/spread protection', 'Review spread, volatility, and news filters that can block or reduce exposure.', 'Market Flow'),
      ],
    },
    {
      moduleId: 'df_sauce_final_ai_signal_grid',
      title: 'Module 4: Signal Grid Usage',
      track: 'Signal Grid education',
      lessons: [
        lesson('df_sauce_lesson_color_grid', 'Reading the color grid', 'Use grid color, basket growth, direction, and freshness before copying.', 'Signal Grid Usage'),
        lesson('df_sauce_lesson_grid_states', 'Green, red, yellow, grey, protected, expired states', 'Know what each Signal Grid state means and when copy should slow down.', 'Signal Grid Usage'),
        lesson('df_sauce_lesson_copy_basket_vs_bot', 'Copy basket vs copy bot', 'Choose between one basket action and a bot subscription with clear risk boundaries.', 'Signal Grid Usage'),
        lesson('df_sauce_lesson_paper_copy_first', 'Paper copy first', 'Practice with paper copy before allowing live account exposure.', 'Signal Grid Usage'),
      ],
    },
    {
      moduleId: 'df_sauce_final_ai_simulator_practice',
      title: 'Module 5: Simulator Practice',
      track: 'PIP DRILL section',
      lessons: [
        lesson('df_sauce_lesson_running_simulation', 'Running a simulation', 'Use the simulator to test symbol, session, volatility, and protection settings.', 'Simulator Practice'),
        lesson('df_sauce_lesson_bot_brain', 'Understanding the bot brain explanation', 'Read the plain-English reason behind a simulated bot decision.', 'Simulator Practice'),
        lesson('df_sauce_lesson_decision_timeline', 'Reading the decision timeline', 'Follow each gate from setup to risk translation.', 'Simulator Practice'),
        lesson('df_sauce_lesson_slider_safety', 'Adjusting sliders safely', 'Change one risk control at a time and compare scenario outcomes.', 'Simulator Practice'),
      ],
    },
    {
      moduleId: 'df_sauce_final_ai_copy_safety',
      title: 'Module 6: Copy Trading Safety',
      track: 'Copy trading safety education',
      lessons: [
        lesson('df_sauce_lesson_membership_requirements', 'Membership requirements', 'Know which Wisdo/Discord access levels can view, request, or copy.', 'Copy Trading Safety'),
        lesson('df_sauce_lesson_risk_passport', 'Risk passport requirements', 'Keep max lot, daily loss, and exposure limits current before copy is enabled.', 'Copy Trading Safety'),
        lesson('df_sauce_lesson_copy_blocked', 'Why copy can be blocked', 'Understand role, stale sync, account, risk, expired signal, and safety blocks.', 'Copy Trading Safety'),
        lesson('df_sauce_lesson_when_to_stop_copying', 'When to stop copying', 'Pause when drawdown, news, account mismatch, or emotional pressure breaks the plan.', 'Copy Trading Safety'),
      ],
    },
  ].map((module, index) => ({
    moduleId: module.moduleId,
    botSlug,
    title: module.title,
    type: 'starter_path',
    track: module.track,
    required: true,
    accessLevel: 'standard',
    order: index + 1,
    lessons: module.lessons,
    seedNote: note,
    seedData: true,
    createdAt: now,
  }));
  if (!Array.isArray(state.botEducationModulesByBotSlug[botSlug]) || state.botEducationModulesByBotSlug[botSlug].length === 0) {
    state.botEducationModulesByBotSlug[botSlug] = modules;
    changed = true;
  }
  const quizzes = [
    ['df_sauce_quiz_beginner_bot_safety', 'Beginner bot safety quiz'],
    ['df_sauce_quiz_risk_based_copy', 'Risk-based copy quiz'],
    ['df_sauce_quiz_signal_grid', 'Signal Grid quiz'],
  ];
  for (const [quizId, title] of quizzes) {
    if (!state.quizzesById[quizId]) {
      state.quizzesById[quizId] = {
        quizId,
        botSlug,
        title,
        status: 'placeholder',
        seedNote: note,
        seedData: true,
        createdAt: now,
      };
      changed = true;
    }
  }
  return changed;
}

const ACADEMY_DISCLAIMER = 'Wisdo Academy is educational only. Trading involves risk. Results are not guaranteed. Nothing here is financial advice.';

function academyTrackDefinitions() {
  return [
    { trackId: 'trading-basics', slug: 'beginner', title: 'Trading Basics', level: 'beginner', topic: 'Beginner Trading Foundation', requiredBeforeCopy: false, lessons: ['What trading is', 'Forex, indices, gold, and crypto', 'Brokers and trading accounts', 'Demo vs live accounts', 'Balance, equity, margin, spread, pips, lots, orders, sessions'] },
    { trackId: 'candlesticks', slug: 'candlesticks', title: 'Candlesticks', level: 'beginner', topic: 'Candlestick Academy', requiredBeforeCopy: false, lessons: ['What a candlestick is', 'Open, high, low, close', 'Bullish, bearish, wick, and body reads', 'Doji, engulfing, pin bar, inside bar, breakout, and fakeout candles', 'Why bots care about candle movement'] },
    { trackId: 'market-structure', slug: 'market-structure', title: 'Market Structure', level: 'intermediate', topic: 'Market Structure Academy', requiredBeforeCopy: false, lessons: ['Trend, range, and consolidation', 'Higher highs, higher lows, lower highs, lower lows', 'Break of structure and change of character', 'Support, resistance, supply, and demand', 'Pullbacks, retests, breakouts, reversals, continuation, and multi-timeframe analysis'] },
    { trackId: 'liquidity-smart-money', slug: 'liquidity', title: 'Liquidity and Smart Money', level: 'intermediate', topic: 'Liquidity and Smart Money Concepts', requiredBeforeCopy: false, lessons: ['Liquidity pools and equal highs/lows', 'Buy-side and sell-side liquidity', 'Fair value gaps, imbalances, and order blocks', 'Mitigation, displacement, premium, and discount', 'Session highs/lows, sweeps, reversals, and why bots may wait'] },
    { trackId: 'risk-management', slug: 'risk', title: 'Risk Management', level: 'beginner', topic: 'Risk Management Academy', requiredBeforeCopy: true, lessons: ['Why risk matters more than entries', 'Risk per trade, dollar risk, and percent risk', 'Position sizing and lot size calculation', 'Max daily loss, weekly loss, drawdown, and overleverage', 'Risk-based copy, paper mode first, and warning signs'] },
    { trackId: 'copy-trading-safety', slug: 'copy-trading', title: 'Copy Trading Safety', level: 'beginner', topic: 'Copy Trading Safety', requiredBeforeCopy: true, lessons: ['What copy trading is', 'Copy this trade vs copy this bot', 'Provider risk vs follower risk', 'Signal expiration, slippage, spread, account mismatch, and broker mismatch', 'Why Wisdo blocks unsafe copy attempts'] },
    { trackId: 'signal-grid-training', slug: 'signal-grid', title: 'Signal Grid Training', level: 'beginner', topic: 'Signal Grid Academy', requiredBeforeCopy: true, lessons: ['How the Wisdo Signal Grid works', 'Grey, green, red, yellow, protected, offline, and expired states', 'Basket growth percentage and signal detail', 'Preview copy, paper copy, copy bot, and stop copy', 'Why no-spam Discord grid beats signal spam'] },
    { trackId: 'bot-training', slug: 'bot-training', title: 'Bot Training', level: 'intermediate', topic: 'Bot Training Academy', requiredBeforeCopy: false, lessons: ['What trading bots can and cannot do', 'Why bots lose sometimes', 'Aggression, risk, lot cap, spread, session, news, profit lock, and drawdown protection', 'Bot DNA and behavior reading', 'Use the simulator before live copy'] },
    { trackId: 'news-trading', slug: 'news', title: 'News Trading', level: 'intermediate', topic: 'News Trading Academy', requiredBeforeCopy: false, lessons: ['Why news matters', 'CPI, NFP, FOMC, rates, and speeches', 'Gold volatility during news', 'Spread expansion and slippage', 'Why bots may pause near news'] },
    { trackId: 'trading-psychology', slug: 'psychology', title: 'Trading Psychology', level: 'beginner', topic: 'Trading Psychology Academy', requiredBeforeCopy: false, lessons: ['FOMO and fear of missing moves', 'Revenge trading and overtrading', 'Moving stop loss and closing too early', 'Risk discipline, patience, and following a plan', 'Why automation still needs discipline'] },
    { trackId: 'df-sauce-final-ai-training', slug: 'df-sauce-final-ai', title: 'DF Sauce Final AI Training', level: 'intermediate', topic: 'Bot-Specific Learning Paths', botSlug: 'df-sauce-final-ai', requiredBeforeCopy: true, lessons: ['What DF Sauce Final AI is designed to do', 'Best markets and sessions', 'Trend, pullback, consolidation, and news behavior', 'Recommended risk setup and Signal Grid behavior', 'Simulator practice and copy safety quiz'] },
    { trackId: 'pip-drill-training', slug: 'pip-drill', title: 'PIP DRILL Training', level: 'beginner', topic: 'Wisdo Simulator Lessons', requiredBeforeCopy: false, lessons: ['Run a trend simulation', 'Run a consolidation simulation', 'Change risk percent and max lot', 'Change aggression and stop distance', 'Read the bot brain, timeline, and compare safe vs aggressive settings'] },
    { trackId: 'flow-training', slug: 'flow', title: 'FLOW Training', level: 'intermediate', topic: 'FLOW Training', requiredBeforeCopy: false, lessons: ['Read market flow before entry', 'Separate trend flow from chop', 'Combine candles with market structure', 'Use liquidity grabs with patience', 'Build a pre-copy flow checklist'] },
  ];
}

function academyLessonId(trackId, index) {
  return `${trackId}_lesson_${String(index + 1).padStart(2, '0')}`;
}

function ensureWisdoAcademySeeds(state = {}) {
  const now = new Date().toISOString();
  state.academyTracksById ||= {};
  state.academyLessonsById ||= {};
  state.academyQuizzesById ||= {};
  state.academyProgressByUserId ||= {};
  state.academyQuizAttemptsByUserId ||= {};
  state.academyUnlocksByUserId ||= {};
  let changed = false;
  const definitions = academyTrackDefinitions();
  definitions.forEach((track, trackIndex) => {
    const lessonIds = track.lessons.map((title, lessonIndex) => {
      const lessonId = academyLessonId(track.trackId, lessonIndex);
      if (!state.academyLessonsById[lessonId]) {
        state.academyLessonsById[lessonId] = {
          lessonId,
          trackId: track.trackId,
          botSlug: track.botSlug || '',
          title,
          level: track.level,
          estimatedMinutes: lessonIndex === 0 ? 8 : 6,
          learningGoals: [
            `Understand ${title.toLowerCase()}.`,
            `Know how this affects trading decisions inside Wisdo.`,
            'Practice without treating education as financial advice.',
          ],
          explanation: `${title} is part of the ${track.title} path. This starter lesson explains the concept in plain language, connects it to account safety, and prepares the member to use Wisdo tools with more context.`,
          keyTerms: title.split(/,| and | vs | to /).map((term) => term.trim()).filter(Boolean).slice(0, 6),
          example: `Example: before copying a bot or basket, a member reviews ${title.toLowerCase()} and checks whether current market conditions match the lesson.`,
          commonMistakes: ['Skipping risk review', 'Copying before understanding context', 'Treating one setup as a guarantee'],
          wisdoTip: 'Use the simulator and paper mode before increasing risk.',
          riskWarning: ACADEMY_DISCLAIMER,
          relatedSimulator: '/member/simulator',
          relatedSignalGrid: '/member/signal-grid',
          relatedBot: track.botSlug || '',
          quizId: `${track.trackId}_checkpoint`,
          status: 'published',
          seedNote: 'Educational starter content - admin can replace/edit later.',
          seedData: true,
          createdAt: now,
        };
        changed = true;
      }
      return lessonId;
    });
    if (!state.academyTracksById[track.trackId]) {
      state.academyTracksById[track.trackId] = {
        trackId: track.trackId,
        slug: track.slug,
        title: track.title,
        topic: track.topic,
        level: track.level,
        botSlug: track.botSlug || '',
        requiredBeforeCopy: Boolean(track.requiredBeforeCopy),
        requiredBeforeBotActivation: Boolean(track.botSlug),
        lessonIds,
        order: trackIndex + 1,
        estimatedMinutes: lessonIds.length * 7,
        status: 'published',
        seedNote: 'Educational starter content - admin can replace/edit later.',
        seedData: true,
        createdAt: now,
      };
      changed = true;
    }
  });
  const quizSeeds = [
    ['risk-management-checkpoint', 'risk-management', 'Risk quiz before live copy'],
    ['copy-trading-safety-checkpoint', 'copy-trading-safety', 'Copy trading quiz before copy bot subscription'],
    ['signal-grid-training-checkpoint', 'signal-grid-training', 'Signal Grid quiz before copy basket'],
    ['df-sauce-final-ai-training-checkpoint', 'df-sauce-final-ai-training', 'Bot safety quiz before high-risk bots'],
  ];
  for (const [quizId, trackId, title] of quizSeeds) {
    if (!state.academyQuizzesById[quizId]) {
      state.academyQuizzesById[quizId] = {
        quizId,
        trackId,
        title,
        passingScore: 70,
        requiredFor: trackId.includes('risk') ? 'live_copy' : trackId.includes('signal') ? 'copy_basket' : trackId.includes('bot') || trackId.includes('df-sauce') ? 'copy_bot' : 'education',
        questions: [
          { id: `${quizId}_q1`, type: 'true_false', prompt: 'Trading involves risk and results are not guaranteed.', answer: 'true' },
          { id: `${quizId}_q2`, type: 'multiple_choice', prompt: 'What is the safest first step before live copy?', options: ['Use education and paper mode first', 'Increase lot size immediately', 'Ignore spread and slippage'], answer: 'Use education and paper mode first' },
          { id: `${quizId}_q3`, type: 'safest_action', prompt: 'Choose the safest action after a warning appears.', options: ['Pause and review risk settings', 'Double risk to recover', 'Copy without checking account size'], answer: 'Pause and review risk settings' },
        ],
        status: 'published',
        seedNote: 'Educational starter quiz placeholder - admin can replace/edit later.',
        seedData: true,
        createdAt: now,
      };
      changed = true;
    }
  }
  return changed;
}

function academyProgressSummary(state = {}, userId = '') {
  const progress = state.academyProgressByUserId?.[String(userId)] || {};
  const attempts = state.academyQuizAttemptsByUserId?.[String(userId)] || {};
  const completedLessons = Object.values(progress).filter((item) => item.status === 'completed');
  const passedQuizzes = Object.values(attempts).filter((item) => item.passed);
  const tracks = Object.values(state.academyTracksById || {}).map((track) => {
    const lessonIds = track.lessonIds || [];
    const done = lessonIds.filter((lessonId) => progress[lessonId]?.status === 'completed').length;
    return { trackId: track.trackId, completedLessons: done, totalLessons: lessonIds.length, percent: lessonIds.length ? Math.round((done / lessonIds.length) * 100) : 0 };
  });
  return { completedLessons: completedLessons.length, passedQuizzes: passedQuizzes.length, tracks, progress, attempts };
}

function academyRequiredEducationStatus(state = {}, userId = '', scope = 'copy_basket') {
  const progress = academyProgressSummary(state, userId);
  const attempts = progress.attempts || {};
  const completed = progress.progress || {};
  const requiredTrackIds = scope === 'copy_bot'
    ? ['risk-management', 'copy-trading-safety', 'df-sauce-final-ai-training']
    : scope === 'live_copy'
      ? ['risk-management', 'copy-trading-safety']
      : ['risk-management', 'signal-grid-training'];
  const missingTracks = requiredTrackIds.filter((trackId) => {
    const track = state.academyTracksById?.[trackId];
    return !(track?.lessonIds || []).every((lessonId) => completed[lessonId]?.status === 'completed');
  });
  const requiredQuizIds = scope === 'copy_bot'
    ? ['risk-management-checkpoint', 'copy-trading-safety-checkpoint', 'df-sauce-final-ai-training-checkpoint']
    : scope === 'live_copy'
      ? ['risk-management-checkpoint', 'copy-trading-safety-checkpoint']
      : ['risk-management-checkpoint', 'signal-grid-training-checkpoint'];
  const missingQuizzes = requiredQuizIds.filter((quizId) => !attempts[quizId]?.passed);
  return {
    ok: missingTracks.length === 0 && missingQuizzes.length === 0,
    scope,
    missingTracks,
    missingQuizzes,
    requiredTrackIds,
    requiredQuizIds,
    progress,
    message: missingTracks.length || missingQuizzes.length ? 'Required Wisdo Academy education is incomplete.' : 'Required Wisdo Academy education is complete.',
  };
}

function publicAcademyPayload(state = {}, userId = '', selectedTrackId = '') {
  const tracks = Object.values(state.academyTracksById || {}).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const lessons = state.academyLessonsById || {};
  const quizzes = state.academyQuizzesById || {};
  const progress = academyProgressSummary(state, userId);
  const selectedTrack = tracks.find((track) => track.trackId === selectedTrackId || track.slug === selectedTrackId) || tracks[0] || null;
  return {
    ok: true,
    name: 'Wisdo Trading Academy',
    disclaimer: ACADEMY_DISCLAIMER,
    tracks,
    lessons,
    quizzes,
    selectedTrack,
    progress,
    requiredCopyEducation: academyRequiredEducationStatus(state, userId, 'copy_basket'),
  };
}

const WISDO_AI_DISCLAIMER = 'Educational only. Trading involves risk. Results are not guaranteed. This is not financial advice.';

const WISDO_AI_MODES = {
  global: 'General Wisdo copilot for navigation, education, risk context, and next-step support.',
  command_center: 'Explain account status, safe command actions, role sync, risk profile, and what to check next.',
  academy: 'Tutor the member through Wisdo Trading Academy lessons and quizzes without financial advice.',
  education: 'Explain bot-specific education modules and help users prepare before simulator/copy actions.',
  simulator: 'Explain simulator results, risk math, decision timelines, and safer practice settings.',
  signal_grid: 'Explain Signal Grid states, copy previews, paper copy, expiration, and risk translation.',
  risk: 'Coach risk settings, drawdown limits, lot caps, and paper-first copy safety.',
  marketplace: 'Compare bots by market, risk, education, and simulator readiness without profit claims.',
  admin: 'Summarize operational health, seeded content, audit needs, and safe admin next steps.',
  support: 'Route support issues to setup, roles, MT4 connection, payments, education, or account doctor.',
};

function wisdoAiFallback({ mode = 'global', prompt = '', page = '', context = {} } = {}) {
  const cleanPrompt = String(prompt || '').trim();
  const modeText = WISDO_AI_MODES[mode] || WISDO_AI_MODES.global;
  const pageHint = page ? `I am looking at ${page}. ` : '';
  const lower = `${cleanPrompt} ${page}`.toLowerCase();
  const actions = [];
  if (lower.includes('risk') || mode === 'risk' || mode === 'signal_grid') actions.push('Open Risk Profile and confirm risk percent, max lot, max daily loss, and paper mode.');
  if (lower.includes('copy') || mode === 'signal_grid') actions.push('Complete required academy gates, preview copy, then paper copy before live copy.');
  if (lower.includes('bot') || mode === 'marketplace' || mode === 'education') actions.push('Open bot education, run the simulator for that bot, and check supported markets/sessions.');
  if (lower.includes('mt4') || lower.includes('connect') || mode === 'command_center') actions.push('Check Trade Link, Account Doctor, and the latest MT4 sync status before changing settings.');
  if (lower.includes('academy') || lower.includes('learn') || mode === 'academy') actions.push('Start Trading Basics, Risk Management, Copy Trading Safety, and Signal Grid Training.');
  if (!actions.length) actions.push('Use Command Center for account status, Academy for learning, Simulator for practice, and Signal Grid for controlled copy decisions.');
  const insight = [
    `${pageHint}Wisdo AI mode: ${modeText}`,
    cleanPrompt ? `Question: ${cleanPrompt}` : 'Ask a question about the current Wisdo page and I will route you to the safest next step.',
    `Current access: ${context.access?.accessLevel || 'unknown'}${context.access?.stale ? ' (role sync may be stale)' : ''}.`,
    'Recommended next steps:',
    ...actions.slice(0, 4).map((item) => `- ${item}`),
    `Safety: ${WISDO_AI_DISCLAIMER}`,
  ].join('\n');
  return { provider: 'wisdo_fallback', model: 'rules_v1', answer: insight, actions, disclaimer: WISDO_AI_DISCLAIMER };
}

async function askWisdoAi({ mode = 'global', prompt = '', page = '', context = {}, logger = null } = {}) {
  const providerDisabled = ['1', 'true', 'yes', 'on'].includes(String(process.env.WISDO_AI_DISABLE_PROVIDER || '').toLowerCase());
  const apiKey = providerDisabled ? '' : (process.env.OPENAI_API_KEY || process.env.WISDO_AI_API_KEY || '');
  const model = process.env.WISDO_AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const system = [
    'You are Wisdo AI, a trading education and platform copilot.',
    'You explain Wisdo pages, risk controls, academy lessons, simulator results, bot education, Signal Grid states, and admin summaries.',
    'Never promise profit. Never give financial advice. Encourage demo, paper mode, risk limits, and education gates.',
    'Use concise, practical steps. If data is missing, say what to check inside Wisdo.',
  ].join(' ');
  if (!apiKey) return wisdoAiFallback({ mode, prompt, page, context });
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        max_tokens: 650,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify({ mode, page, prompt, context, disclaimer: WISDO_AI_DISCLAIMER }) },
        ],
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error?.message || `AI provider failed with ${res.status}`);
    const rawAnswer = json.choices?.[0]?.message?.content || '';
    const answer = rawAnswer.includes(WISDO_AI_DISCLAIMER) ? rawAnswer : `${rawAnswer || wisdoAiFallback({ mode, prompt, page, context }).answer}\n\nSafety: ${WISDO_AI_DISCLAIMER}`;
    return { provider: 'openai_compatible', model, answer, disclaimer: WISDO_AI_DISCLAIMER };
  } catch (error) {
    logger?.warn?.('Wisdo AI provider fallback used', { message: error.message });
    return { ...wisdoAiFallback({ mode, prompt, page, context }), providerError: error.message };
  }
}

function buildWisdoAiContext({ state = {}, mt4 = {}, userId = '', access = {}, page = '' } = {}) {
  const academy = academyProgressSummary(state, userId);
  const roleSync = state.roleSyncByUserId?.[String(userId)] || {};
  const accounts = Object.values(mt4.connectionsByAccountId || mt4.connections || {}).filter((account) => String(account.discordUserId) === String(userId));
  return {
    userId: String(userId || ''),
    page,
    access,
    roleSync: {
      accessLevel: roleSync.accessLevel || access.accessLevel || '',
      stale: Boolean(roleSync.stale || access.stale),
      source: roleSync.source || access.source || '',
    },
    academy: {
      completedLessons: academy.completedLessons,
      passedQuizzes: academy.passedQuizzes,
      requiredCopyEducation: academyRequiredEducationStatus(state, userId, 'copy_basket'),
    },
    counts: {
      accounts: accounts.length,
      notifications: (state.notificationsByUserId?.[String(userId)] || []).length,
      signalCells: Object.keys(state.signalGridCellsById || {}).length,
      bots: EA_CATALOG.length,
      academyTracks: Object.keys(state.academyTracksById || {}).length,
      botEducationModules: Object.values(state.botEducationModulesByBotSlug || {}).flat().length,
    },
    disclaimer: WISDO_AI_DISCLAIMER,
  };
}

const WISDO_MODEL_REGISTRY = [
  'User',
  'Desk',
  'TradingAccount',
  'Bot',
  'BotVersion',
  'BotFile',
  'BotPurchase',
  'BotAccess',
  'BotPreset',
  'BotEducationModule',
  'Lesson',
  'LessonProgress',
  'Quiz',
  'SimulationScenario',
  'CopyRequest',
  'CopyRelationship',
  'CopyRiskProfile',
  'CopyTradeLog',
  'SocialPost',
  'Comment',
  'Like',
  'Follow',
  'Notification',
  'ThemePreference',
  'AdminAuditLog',
  'DiscordRoleSync',
  'RoleOverride',
  'SignalGridChannel',
  'SignalSource',
  'SignalGridCell',
  'SignalBasket',
  'SignalGridInteractionLog',
  'CopyBotSubscription',
  'Affiliate',
  'AffiliateReferral',
  'AffiliateCommission',
  'AffiliatePayout',
  'AffiliateCampaign',
  'CreatorPayout',
  'Subscription',
  'Payment',
  'ServerAnnouncement',
  'FeatureFlag',
];

const WISDO_THEMES = {
  neon: { label: 'Dark neon default', accent: '#f0aa2b' },
  blue: { label: 'Blue command center', accent: '#6cb6ff' },
  green: { label: 'Green profit terminal', accent: '#46d17b' },
  purple: { label: 'Purple premium', accent: '#af8cff' },
  red: { label: 'Red alert mode', accent: '#ff6767' },
  gold: { label: 'Gold pro mode', accent: '#f0aa2b' },
  black: { label: 'Minimal black', accent: '#d7e6f7' },
  light: { label: 'Light mode option', accent: '#1a6cff' },
};

const WISDO_VOICE_INTENTS = [
  { intent: 'SHOW_FLOATING_PROFIT', phrase: 'Wisdo, show my floating profit.', dangerous: false, confirmationRequired: false, api: '/api/wisdo/desks/me' },
  { intent: 'PAUSE_BOT', phrase: 'Wisdo, pause my gold bot.', dangerous: true, confirmationRequired: true, api: '/api/wisdo/voice/execute' },
  { intent: 'CLOSE_PROFITABLE_TRADES', phrase: 'Wisdo, close profitable trades.', dangerous: true, confirmationRequired: true, api: '/api/wisdo/voice/execute' },
  { intent: 'SHOW_COPY_RISK', phrase: 'Wisdo, show my copy risk.', dangerous: false, confirmationRequired: false, api: '/api/wisdo/copy-risk/me' },
  { intent: 'EXPLAIN_BOT_ENTRY', phrase: 'Wisdo, explain why the bot entered.', dangerous: false, confirmationRequired: false, api: '/api/wisdo/simulator/explain' },
];

function normalizeAccountForDesk(account = {}) {
  const snapshot = account.latestSnapshot?.snapshot || account.snapshot || {};
  return {
    accountId: String(account.accountId || account.id || snapshot.accountId || account.accountNumber || ''),
    ownerUserId: String(account.ownerUserId || account.discordUserId || account.userId || ''),
    nickname: account.nickname || account.accountNickname || snapshot.nickname || '',
    accountNumber: String(account.accountNumber || snapshot.accountNumber || ''),
    broker: account.broker || snapshot.broker || '',
    server: account.server || account.brokerServer || snapshot.brokerServer || '',
    platform: account.platform || snapshot.platform || 'MT4',
    accountType: account.accountType || snapshot.demoLive || snapshot.accountType || 'demo',
    accountRole: account.accountRole || 'private',
    connectionStatus: account.connectionStatus || (account.latestSnapshot || snapshot.accountNumber ? 'online' : 'pending'),
    riskMode: account.copyRisk?.mode || account.riskMode || 'fixed_risk',
    copyPermission: account.copyPermission || 'private',
    balance: Number(snapshot.balance || account.balance || 0),
    equity: Number(snapshot.equity || account.equity || 0),
    floatingPL: Number(snapshot.floatingPL || snapshot.floatingProfit || account.floatingPL || 0),
    openTrades: Number(snapshot.openTradeCount || account.openTradeCount || 0),
    closedTrades: Number(snapshot.closedTradeCount || account.closedTradeCount || 0),
    lastSyncAt: account.lastSyncAt || account.latestSnapshot?.receivedAt || snapshot.receivedAt || '',
    copyRisk: account.copyRisk || {},
  };
}

function defaultWisdoDesk(userId, accounts = [], state = {}) {
  const normalizedAccounts = accounts.map(normalizeAccountForDesk).filter((a) => a.accountId);
  const existing = state.wisdoDesksByUserId?.[String(userId)] || {};
  const preference = state.deskPreferencesByUserId?.[String(userId)] || {};
  const selectedAccountId = preference.selectedAccountId || existing.selectedAccountId || normalizedAccounts[0]?.accountId || '';
  return {
    deskId: existing.deskId || `desk_${String(userId || 'website-buyer')}`,
    userId: String(userId || 'website-buyer'),
    name: existing.name || 'Wisdo Desk',
    tagline: 'Connect. Copy. Control.',
    selectedAccountId,
    accountCount: normalizedAccounts.length,
    accounts: normalizedAccounts,
    permissions: {
      canTradeCommand: true,
      canCopy: true,
      canUploadBot: false,
      dangerousActionsRequireConfirmation: true,
      ...(existing.permissions || {}),
    },
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function persistDeskPreference(state, userId, patch = {}) {
  state.deskPreferencesByUserId ||= {};
  const key = String(userId || 'website-buyer');
  state.deskPreferencesByUserId[key] = {
    ...(state.deskPreferencesByUserId[key] || {}),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  return state.deskPreferencesByUserId[key];
}

function upsertNotification(state, userId, notification = {}) {
  const key = String(userId || 'website-buyer');
  state.notificationsByUserId ||= {};
  state.notificationsByUserId[key] ||= [];
  const item = {
    notificationId: notification.notificationId || makeId('note'),
    type: notification.type || 'system',
    title: notification.title || 'Wisdo notification',
    message: notification.message || '',
    status: notification.status || 'unread',
    severity: notification.severity || 'info',
    createdAt: notification.createdAt || new Date().toISOString(),
    ...notification,
  };
  state.notificationsByUserId[key].unshift(item);
  state.notificationsByUserId[key] = state.notificationsByUserId[key].slice(0, 100);
  return item;
}

function auditAdminAction(state, actorUserId, action, targetType, targetId, metadata = {}) {
  state.adminAuditLogsById ||= {};
  const log = {
    auditLogId: makeId('audit'),
    actorUserId: String(actorUserId || 'system'),
    action,
    targetType,
    targetId: String(targetId || ''),
    metadata,
    createdAt: new Date().toISOString(),
  };
  state.adminAuditLogsById[log.auditLogId] = log;
  return log;
}

function marketplaceBotRecord(bot = {}, state = {}) {
  const slug = slugify(bot.name || bot.slug);
  const versions = state.botVersionsBySlug?.[slug] || [{
    versionId: `${slug}_seed_v1`,
    botSlug: slug,
    version: bot.version || '1.0.0',
    status: bot.active === false ? 'archived' : 'live',
    releaseNotes: 'Seed catalog version generated from uploaded EA inventory.',
    forceUpdateRequired: false,
    educationRequiredBeforeActivation: String(bot.risk || '').toLowerCase().includes('high'),
    createdAt: new Date().toISOString(),
    source: 'seed/demo_catalog',
  }];
  return {
    botId: slug,
    slug,
    name: bot.name,
    creator: bot.creator || 'Wisdo',
    strategyType: bot.category || 'Strategy',
    riskLevel: bot.risk || 'Medium',
    supportedMarkets: bot.symbols || [bot.bestMarket || 'Multi-symbol'],
    priceUsd: bot.priceUsd || 0,
    rating: bot.rating || 0,
    version: versions[0]?.version || '1.0.0',
    screenshots: bot.screenshots || [],
    videos: bot.videos || [],
    educationLink: `/member/education?bot=${encodeURIComponent(slug)}`,
    changelog: versions.map((v) => v.releaseNotes).filter(Boolean),
    status: bot.active === false ? 'archived' : 'live',
    accessLevel: bot.accessLevel || (bot.priceUsd > 0 ? 'paid' : 'free'),
    tags: bot.tags || [],
    fileMetadata: { file: bot.file, source: bot.source, platform: bot.platform || 'MT4' },
    versions,
    seedData: true,
  };
}

function calculateWisdoRisk(body = {}) {
  const balance = Number(body.balance || body.accountBalance || 0);
  const equity = Number(body.equity || balance || 0);
  const riskMode = String(body.riskMode || body.mode || 'percent');
  const riskPercent = Math.max(0, Number(body.riskPercent || 1));
  const riskUsd = riskMode === 'fixed_usd' ? Math.max(0, Number(body.riskUsd || 0)) : equity * (riskPercent / 100);
  const stopDistancePips = Math.max(0.1, Number(body.stopDistancePips || body.stopPips || 50));
  const pipValuePerLot = Math.max(0.01, Number(body.pipValuePerLot || 10));
  const minLot = Math.max(0.01, Number(body.minLot || 0.01));
  const maxLot = Math.max(minLot, Number(body.maxLot || 1));
  const step = Math.max(0.01, Number(body.lotStep || body.brokerStepSize || 0.01));
  const rawLot = riskUsd / (stopDistancePips * pipValuePerLot);
  const steppedLot = Math.floor(rawLot / step) * step;
  const lot = clamp(Math.max(minLot, steppedLot), minLot, maxLot);
  const marginLevel = Number(body.marginLevel || 0);
  const spread = Number(body.spread || 0);
  const maxSpread = Number(body.maxSpread || 50);
  const slippage = Number(body.slippage || 0);
  const maxSlippage = Number(body.maxSlippage || 20);
  const warnings = [];
  if (riskPercent > 2) warnings.push('Risk per trade is above 2%. Confirm this is intentional.');
  if (lot >= maxLot && rawLot > maxLot) warnings.push('Calculated lot was capped by maxLot.');
  if (marginLevel > 0 && marginLevel < 200) warnings.push('Margin level is below the recommended safety zone.');
  if (spread > maxSpread) warnings.push('Spread is above the configured protection limit.');
  if (slippage > maxSlippage) warnings.push('Slippage is above the configured protection limit.');
  return {
    riskMode,
    riskPercent,
    riskUsd: Number(riskUsd.toFixed(2)),
    rawLot: Number(rawLot.toFixed(4)),
    lot: Number(lot.toFixed(2)),
    minLot,
    maxLot,
    lotStep: step,
    stopDistancePips,
    pipValuePerLot,
    warnings,
    explanation: `Risk ${money(riskUsd)} divided by ${stopDistancePips} pips at ${money(pipValuePerLot)} per pip gives ${rawLot.toFixed(4)} lots, rounded to broker step ${step} and capped between ${minLot} and ${maxLot}.`,
    compliance: 'Educational calculation only. Trading involves risk and there is no guaranteed profit.',
    createdAt: new Date().toISOString(),
  };
}

function discordDisplayName(user = {}) {
  return String(user.global_name || user.globalName || user.displayName || user.username || user.id || 'CultureCoin Member').trim();
}

function discordAvatarUrl(user = {}) {
  if (!user?.id || !user?.avatar) return '/media/logo_transparent_background.png';
  const ext = String(user.avatar).startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
}

function getIdentity(req) {
  const user = getCurrentUser(req) || {};
  const id = String(user.id || req.user?.id || req.session?.user?.id || req.session?.discordUser?.id || req.query.userId || req.query.discordUserId || req.body?.userId || 'website-buyer').trim();
  const displayName = discordDisplayName(user.id ? user : { id, username: req.query.username || 'CultureCoin Member' });
  return {
    userId: id,
    discordId: id,
    username: user.username || req.query.username || displayName,
    globalName: user.global_name || user.globalName || '',
    displayName,
    avatarUrl: discordAvatarUrl(user),
    role: 'member',
    membershipTier: 'Culture Member',
    loggedIn: Boolean(user.id),
  };
}

function currentUserId(req) {
  return getIdentity(req).userId;
}

function currentUserName(req) {
  return getIdentity(req).displayName;
}

function normalizeBotKey(value = '') {
  return slugify(value);
}

async function grantBotLicense({ userId, bot, orderId = null, source = 'manual' }) {
  const state = await loadEcosystemState();
  const key = String(userId || 'website-buyer');
  state.licensesByUserId ||= {};
  state.licensesByUserId[key] ||= [];
  const slug = normalizeBotKey(bot.name || bot.slug);
  const existing = state.licensesByUserId[key].find((license) => license.botSlug === slug);
  if (existing) return existing;
  const license = {
    licenseId: makeId('lic'),
    userId: key,
    botSlug: slug,
    botName: bot.name,
    tier: bot.tier || bot.skillTier || 'Core',
    priceUsd: bot.priceUsd || 0,
    orderId,
    source,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  state.licensesByUserId[key].push(license);
  await saveEcosystemState(state);
  return license;
}

function botInstallSteps(bot) {
  return `<ol><li>Buy or unlock ${esc(bot.name)}.</li><li>Download the EA from your licensed bot library.</li><li>Place the EA in MetaTrader: File → Open Data Folder → MQL4 → Experts.</li><li>Restart MetaTrader, attach the EA, then connect the account with WISDO Trade Link.</li><li>Confirm the bot appears in Copier Engine and your private Discord desk.</li></ol>`;
}

function flattenCommandRecord(record) {
  const payload = record?.payload || {};
  const globals = payload.globals || {};
  return {
    hasCommand: true,
    commandId: record.id,
    command: record.command,
    ...payload,
    ...globals,
  };
}


function uniqueMt4DeliveryIds(ids = []) {
  return [...new Set(ids.map((v) => String(v || '').trim()).filter(Boolean))];
}

async function resolveMt4DeliveryUserIds(loadEcosystemState, pairing = {}) {
  const ids = [
    pairing.discordUserId,
    pairing.requestedByUserId,
    pairing.userId,
    pairing.websiteUserId,
  ];
  try {
    const state = await loadEcosystemState();
    const discordId = String(pairing.discordUserId || '').trim();
    if (discordId && state?.discord_connections) {
      for (const [websiteUserId, connection] of Object.entries(state.discord_connections)) {
        if (String(connection?.discordUserId || '') === discordId) ids.push(websiteUserId);
      }
    }
    const requestedId = String(pairing.requestedByUserId || '').trim();
    if (requestedId && state?.usersById?.[requestedId]) ids.push(requestedId);
  } catch {
    // The MT4 command bridge must stay online even if the optional website state lookup fails.
  }
  return uniqueMt4DeliveryIds(ids);
}

async function findMt4QueuedCommand(mt4CommandService, userIds = [], scope = {}) {
  for (const userId of uniqueMt4DeliveryIds(userIds)) {
    const command = await mt4CommandService.getPendingCommand(userId, scope);
    if (command) return { userId, command };
  }
  return { userId: '', command: null };
}

async function markMt4CommandCompleteForAnyOwner(mt4CommandService, userIds = [], commandId, result = {}, accountId = null) {
  for (const userId of uniqueMt4DeliveryIds(userIds)) {
    const command = result?.success === false
      ? await mt4CommandService.markCommandFailed(userId, commandId, result?.message || 'MT4 command failed', accountId)
      : await mt4CommandService.markCommandCompleted(userId, commandId, result, accountId);
    if (command) return { userId, command };
  }
  return { userId: '', command: null };
}

export async function reconcileCopiedTradeCompletion(loadEcosystemState, saveEcosystemState, command, result = {}) {
  if (!command || !['COPY_OPEN_TRADE', 'COPY_CLOSE_TRADE'].includes(String(command.command || '').toUpperCase())) return;
  const payload = command.payload || {};
  const routeId = String(payload.routeId || '');
  const followerAccountId = String(payload.followerAccountId || command.accountId || '');
  const leaderTicket = String(payload.sourceTicket || payload.leaderTicket || payload.masterTicket || '');
  if (!routeId || !followerAccountId || !leaderTicket) return;

  try {
    const state = await loadEcosystemState();
    state.trades ||= {};
    const masterTrade = Object.values(state.trades).find((trade) =>
      !trade?.copier_rule_id &&
      String(trade.account_id || '') === String(payload.leaderAccountId || '') &&
      String(trade.external_ticket || trade.id || '') === leaderTicket
    ) || Object.values(state.trades).find((trade) =>
      !trade?.copier_rule_id && String(trade.external_ticket || '') === leaderTicket
    );
    if (!masterTrade) return;

    const copiedTrade = Object.values(state.trades).find((trade) =>
      String(trade.copier_rule_id || '') === routeId &&
      String(trade.source_trade_id || '') === String(masterTrade.id || '') &&
      String(trade.account_id || '') === followerAccountId
    );
    if (!copiedTrade) return;

    const succeeded = result?.success !== false;
    if (String(command.command).toUpperCase() === 'COPY_OPEN_TRADE') {
      if (succeeded && (result?.ticket || result?.followerTicket)) {
        copiedTrade.external_ticket = String(result.ticket || result.followerTicket);
        copiedTrade.status = 'open';
        copiedTrade.open_confirmed_at = new Date().toISOString();
        copiedTrade.open_command_id = command.id;
      } else if (!succeeded) {
        copiedTrade.status = 'error';
        copiedTrade.execution_error = String(result?.message || 'Follower open failed');
      }
    } else if (succeeded) {
      copiedTrade.status = 'closed';
      copiedTrade.closed_at ||= new Date().toISOString();
      copiedTrade.close_confirmed_at = new Date().toISOString();
      copiedTrade.close_command_id = command.id;
      if (result?.ticket || result?.followerTicket) copiedTrade.external_ticket = String(result.ticket || result.followerTicket);
      delete copiedTrade.execution_error;
    } else {
      copiedTrade.status = 'open';
      copiedTrade.close_failed_at = new Date().toISOString();
      copiedTrade.execution_error = String(result?.message || 'Follower close failed');
    }
    await saveEcosystemState(state);
  } catch {
    // Command completion must still be acknowledged even if optional analytics
    // reconciliation cannot be written during a transient storage error.
  }
}

const SPECIAL_UPGRADES = [
  {
    name: 'WISDO Voice Commander',
    tag: 'Alexa-style trading control',
    minPrice: 297,
    retail: 497,
    description: 'Voice-triggered WISDO commands for pause, resume, sells-only, close profits, reduce risk, and emergency account protection.',
    includes: ['Natural-language command layer', 'MT4 global-variable control', 'Command audit trail', 'Coach-safe confirmations'],
  },
  {
    name: 'MT4 Tablet Operator Kit',
    tag: 'Plug-and-run field device',
    minPrice: 397,
    retail: 697,
    description: 'Tablet setup package for CultureCoin members who need MT4, reporter pairing, WISDO dashboard, and desk onboarding preconfigured.',
    includes: ['MT4 install guide', 'Reporter setup', 'Pairing checklist', 'Desk welcome workflow'],
  },
  {
    name: 'Profit Lock Shield',
    tag: 'Walk-away protection',
    minPrice: 197,
    retail: 397,
    description: 'WISDO safety upgrade that helps protect green accounts with profit trim rules, drawdown alerts, and emergency close commands.',
    includes: ['Daily giveback limits', 'Profit trim presets', 'Drawdown alerts', 'Close-all emergency command'],
  },
  {
    name: 'VPS Forge Setup',
    tag: 'Keep bots running',
    minPrice: 297,
    retail: 597,
    description: 'Remote MetaTrader hosting setup lane for users who want their EA and reporter running without leaving their laptop on.',
    includes: ['VPS checklist', 'MT4 migration flow', 'WebRequest validation', 'WISDO health check'],
  },
  {
    name: 'Copy Desk Access',
    tag: 'Mirror-trading ready lane',
    minPrice: 497,
    retail: 997,
    description: 'Prepares the user desk for copy-trading workflows, account identity, permission levels, and risk-based copy controls.',
    includes: ['Copy-role readiness', 'Risk caps', 'Account mapping', 'Coach review flow'],
  },
  {
    name: 'Coach Review Pro',
    tag: 'Weekly operator audit',
    minPrice: 97,
    retail: 197,
    description: 'A structured review layer for trading behavior, drawdown habits, bot settings, and weekly improvement notes.',
    includes: ['Weekly notes', 'Bot setting review', 'Risk behavior scorecard', 'Action list'],
  },
  {
    name: 'Bot Store Premium Pass',
    tag: 'Unlock bot catalog sales',
    minPrice: 197,
    retail: 497,
    description: 'A sales-ready bot store upgrade so CultureCoin members can offer approved bots above the minimum price and earn spread.',
    includes: ['Catalog cards', 'Minimum price guardrails', 'Sales script', 'License tracking'],
  },
  {
    name: 'White Label Partner Desk',
    tag: 'Build your sub-brand',
    minPrice: 997,
    retail: 1997,
    description: 'Partner-level upgrade for leaders who want their own branded desk lane, custom onboarding, and team tracking.',
    includes: ['Partner desk group', 'Custom onboarding copy', 'Team dashboard', 'Admin audit trail'],
  },
];

const ACADEMY_STEPS = [
  ['01', 'Connect', 'Pair Discord, MT4, and the CultureCoin Reporter before any advanced control is enabled.'],
  ['02', 'Verify', 'Confirm balance, equity, server, EA name, and snapshot freshness inside the member portal.'],
  ['03', 'Protect', 'Set max trades, direction mode, daily risk, profit lock, and drawdown emergency rules.'],
  ['04', 'Operate', 'Use WISDO commands only after reading the account state and letting the bot confirm the queued action.'],
  ['05', 'Review', 'Use account history, coach notes, and weekly reviews to correct behavior before scaling capital.'],
];

const EA_CATALOG = [
  {
    'name': 'DF SAUCE FINAL AI',
    'status': 'Recommended Today',
    'tier': 'Flagship',
    'category': 'Mean Reversion',
    'priceUsd': 3000,
    'monthlyPriceUsd': 300,
    'lifetimePriceUsd': 3000,
    'file': 'Experts/DF SAUCE FINAL AI.ex4',
    'source': 'Experts/DF SAUCE FINAL AI.mq4',
    'bestMarket': 'XAUUSD / Gold',
    'platform': 'MT4',
    'symbols': [
      'XAUUSD',
      'Gold'
    ],
    'risk': 'Medium to High - use WISDO protection',
    'description': 'Top recommended CultureCoin EA for today. Premium Sauce-family build for the WISDO workflow, account linking, Copier Engine visibility, and coach-controlled execution.',
    'strategy': 'Mean Reversion strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'WISDO Recommended',
      'Top Bot',
      'Copier Engine Ready',
      'Premium',
      'Flagship',
      'Mean Reversion',
      'Gold-ready'
    ],
    'recommended': true,
    'active': true
  },
  {
    'name': 'DJ VERSION - ULTIMATE PACKAGE (1) (1)',
    'status': 'Premium Package',
    'tier': 'Elite',
    'category': 'Premium / Advanced',
    'priceUsd': 2500,
    'monthlyPriceUsd': 250,
    'lifetimePriceUsd': 2500,
    'file': 'Experts/Imported_From_KOT4X/DJ VERSION - ULTIMATE PACKAGE (1) (1).ex4',
    'source': 'Experts/Imported_From_KOT4X/DJ VERSION - ULTIMATE PACKAGE (1) (1).mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Medium to High - advanced bot risk',
    'description': 'Elite CultureCoin EA listed from the uploaded Expert Advisor folders with WISDO marketplace checkout support.',
    'strategy': 'Premium / Advanced strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Elite',
      'Premium / Advanced'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'KINGDOM MANNER - ULTIMATE PACKAGE',
    'status': 'Premium Package',
    'tier': 'Elite',
    'category': 'Grid / Ladder',
    'priceUsd': 2500,
    'monthlyPriceUsd': 250,
    'lifetimePriceUsd': 2500,
    'file': 'Experts/Imported_From_KOT4X/KINGDOM MANNER - ULTIMATE PACKAGE.ex4',
    'source': 'Experts/Imported_From_KOT4X/KINGDOM MANNER - ULTIMATE PACKAGE.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'High - ladder/grid controls required',
    'description': 'Grid/ladder growth EA. Stronger skill tier because it needs max-trade, drawdown, and harvest protection rules.',
    'strategy': 'Grid / Ladder strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Elite',
      'Grid / Ladder',
      'Scale-in'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF_HIGHTOWER_V10_FULL',
    'status': 'Advanced Engine',
    'tier': 'Elite',
    'category': 'Trend',
    'priceUsd': 2000,
    'monthlyPriceUsd': 200,
    'lifetimePriceUsd': 2000,
    'file': 'Experts/DF_HIGHTOWER_V10_FULL.ex4',
    'source': 'Experts/DF_HIGHTOWER_V10_FULL.mq4',
    'bestMarket': 'XAUUSD / Gold',
    'platform': 'MT4',
    'symbols': [
      'XAUUSD',
      'Gold'
    ],
    'risk': 'Medium - trend confirmation required',
    'description': 'Trend-focused EA designed for directional movement, structure confirmation, and leaderboard-style performance tracking.',
    'strategy': 'Trend strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Elite',
      'Trend',
      'Gold-ready'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF_Handsfree V10.6',
    'status': 'Advanced Engine',
    'tier': 'Elite',
    'category': 'Experimental',
    'priceUsd': 2000,
    'monthlyPriceUsd': 200,
    'lifetimePriceUsd': 2000,
    'file': 'Experts/FOW/DF_Handsfree V10.6.ex4',
    'source': 'Experts/FOW/DF_Handsfree V10.6.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Medium to High - advanced bot risk',
    'description': 'Elite CultureCoin EA listed from the uploaded Expert Advisor folders with WISDO marketplace checkout support.',
    'strategy': 'Experimental strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Elite',
      'Experimental'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'FOUNTAIN OF WEALTH',
    'status': 'Advanced Engine',
    'tier': 'Elite',
    'category': 'Premium / Advanced',
    'priceUsd': 2000,
    'monthlyPriceUsd': 200,
    'lifetimePriceUsd': 2000,
    'file': 'Experts/FOUNTAIN OF WEALTH.ex4',
    'source': 'Experts/FOUNTAIN OF WEALTH.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Medium to High - advanced bot risk',
    'description': 'Elite CultureCoin EA listed from the uploaded Expert Advisor folders with WISDO marketplace checkout support.',
    'strategy': 'Premium / Advanced strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Elite',
      'Premium / Advanced'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF SAUCE FINAL',
    'status': 'Advanced Engine',
    'tier': 'Pro',
    'category': 'Mean Reversion',
    'priceUsd': 1500,
    'monthlyPriceUsd': 150,
    'lifetimePriceUsd': 1500,
    'file': 'Experts/DF SAUCE FINAL.ex4',
    'source': 'Experts/DF SAUCE FINAL.mq4',
    'bestMarket': 'XAUUSD / Gold',
    'platform': 'MT4',
    'symbols': [
      'XAUUSD',
      'Gold'
    ],
    'risk': 'Medium to High - use WISDO protection',
    'description': 'Sauce-family EA built for mean-reversion and gold-focused automation. Best used with WISDO risk controls and account tracking.',
    'strategy': 'Mean Reversion strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Pro',
      'Mean Reversion',
      'Gold-ready'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF TREND GHOST',
    'status': 'Advanced Engine',
    'tier': 'Pro',
    'category': 'Trend',
    'priceUsd': 1500,
    'monthlyPriceUsd': 150,
    'lifetimePriceUsd': 1500,
    'file': 'Experts/DF TREND GHOST.ex4',
    'source': 'Experts/DF TREND GHOST.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Medium - trend confirmation required',
    'description': 'Trend-focused EA designed for directional movement, structure confirmation, and leaderboard-style performance tracking.',
    'strategy': 'Trend strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Pro',
      'Trend'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF_HIGHTOWER_ADAPTIVE_V7',
    'status': 'Advanced Engine',
    'tier': 'Pro',
    'category': 'Trend',
    'priceUsd': 1500,
    'monthlyPriceUsd': 150,
    'lifetimePriceUsd': 1500,
    'file': 'Experts/DF_HIGHTOWER_ADAPTIVE_V7.ex4',
    'source': 'Experts/DF_HIGHTOWER_ADAPTIVE_V7.mq4',
    'bestMarket': 'XAUUSD / Gold',
    'platform': 'MT4',
    'symbols': [
      'XAUUSD',
      'Gold'
    ],
    'risk': 'Medium - trend confirmation required',
    'description': 'Trend-focused EA designed for directional movement, structure confirmation, and leaderboard-style performance tracking.',
    'strategy': 'Trend strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Pro',
      'Trend',
      'Gold-ready'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'CC GROW',
    'status': 'Growth Engine',
    'tier': 'Pro',
    'category': 'Grid / Ladder',
    'priceUsd': 1200,
    'monthlyPriceUsd': 120,
    'lifetimePriceUsd': 1200,
    'file': 'Experts/Imported_From_KOT4X/CC GROW.ex4',
    'source': 'Experts/Imported_From_KOT4X/CC GROW.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'High - ladder/grid controls required',
    'description': 'Grid/ladder growth EA. Stronger skill tier because it needs max-trade, drawdown, and harvest protection rules.',
    'strategy': 'Grid / Ladder strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Pro',
      'Grid / Ladder'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF 5.1',
    'status': 'Growth Engine',
    'tier': 'Pro',
    'category': 'Experimental',
    'priceUsd': 1200,
    'monthlyPriceUsd': 120,
    'lifetimePriceUsd': 1200,
    'file': 'Experts/DF 5.1.ex4',
    'source': 'Experts/DF 5.1.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Medium - test on demo first',
    'description': 'Pro CultureCoin EA listed from the uploaded Expert Advisor folders with WISDO marketplace checkout support.',
    'strategy': 'Experimental strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Pro',
      'Experimental'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF ORIGINAL',
    'status': 'Growth Engine',
    'tier': 'Pro',
    'category': 'Premium / Advanced',
    'priceUsd': 1200,
    'monthlyPriceUsd': 120,
    'lifetimePriceUsd': 1200,
    'file': 'Experts/DF ORIGINal/DF ORIGINAL .ex4',
    'source': 'Experts/DF ORIGINal/DF ORIGINAL .mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Medium - test on demo first',
    'description': 'Pro CultureCoin EA listed from the uploaded Expert Advisor folders with WISDO marketplace checkout support.',
    'strategy': 'Premium / Advanced strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Pro',
      'Premium / Advanced'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'Kingdom Manner + Scale',
    'status': 'Growth Engine',
    'tier': 'Pro',
    'category': 'Grid / Ladder',
    'priceUsd': 1200,
    'monthlyPriceUsd': 120,
    'lifetimePriceUsd': 1200,
    'file': 'Experts/Imported_From_KOT4X/Kingdom Manner + Scale.ex4',
    'source': 'Experts/Imported_From_KOT4X/Kingdom Manner + Scale.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'High - ladder/grid controls required',
    'description': 'Grid/ladder growth EA. Stronger skill tier because it needs max-trade, drawdown, and harvest protection rules.',
    'strategy': 'Grid / Ladder strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Pro',
      'Grid / Ladder',
      'Scale-in'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF HIGHTOWER V3',
    'status': 'Tested Bot',
    'tier': 'Pro',
    'category': 'Trend',
    'priceUsd': 997,
    'monthlyPriceUsd': 100,
    'lifetimePriceUsd': 997,
    'file': 'Experts/DF HIGHTOWER V3.ex4',
    'source': 'Experts/DF HIGHTOWER V3.mq4',
    'bestMarket': 'XAUUSD / Gold',
    'platform': 'MT4',
    'symbols': [
      'XAUUSD',
      'Gold'
    ],
    'risk': 'Medium - trend confirmation required',
    'description': 'Trend-focused EA designed for directional movement, structure confirmation, and leaderboard-style performance tracking.',
    'strategy': 'Trend strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Pro',
      'Trend',
      'Gold-ready'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF LADDER - MOTION V3',
    'status': 'Tested Bot',
    'tier': 'Pro',
    'category': 'Grid / Ladder',
    'priceUsd': 997,
    'monthlyPriceUsd': 100,
    'lifetimePriceUsd': 997,
    'file': 'Experts/DF LADDER - MOTION V3.ex4',
    'source': 'Experts/DF LADDER - MOTION V3.mq4',
    'bestMarket': 'XAUUSD / Gold',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'High - ladder/grid controls required',
    'description': 'Grid/ladder growth EA. Stronger skill tier because it needs max-trade, drawdown, and harvest protection rules.',
    'strategy': 'Grid / Ladder strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Pro',
      'Grid / Ladder',
      'Scale-in'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF LADDER- MOTION V2',
    'status': 'Tested Bot',
    'tier': 'Pro',
    'category': 'Grid / Ladder',
    'priceUsd': 997,
    'monthlyPriceUsd': 100,
    'lifetimePriceUsd': 997,
    'file': 'Experts/DF LADDER- MOTION V2.ex4',
    'source': 'Experts/DF LADDER- MOTION V2.mq4',
    'bestMarket': 'XAUUSD / Gold',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'High - ladder/grid controls required',
    'description': 'Grid/ladder growth EA. Stronger skill tier because it needs max-trade, drawdown, and harvest protection rules.',
    'strategy': 'Grid / Ladder strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Pro',
      'Grid / Ladder',
      'Scale-in'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DFHIGHTOWERV6',
    'status': 'Tested Bot',
    'tier': 'Pro',
    'category': 'Trend',
    'priceUsd': 997,
    'monthlyPriceUsd': 100,
    'lifetimePriceUsd': 997,
    'file': 'Experts/DFHIGHTOWERV6.ex4',
    'source': 'Experts/DFHIGHTOWERV6.mq4',
    'bestMarket': 'XAUUSD / Gold',
    'platform': 'MT4',
    'symbols': [
      'XAUUSD',
      'Gold'
    ],
    'risk': 'Medium - trend confirmation required',
    'description': 'Trend-focused EA designed for directional movement, structure confirmation, and leaderboard-style performance tracking.',
    'strategy': 'Trend strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Pro',
      'Trend',
      'Gold-ready'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF LADDER - MOTION',
    'status': 'Core Bot',
    'tier': 'Builder',
    'category': 'Grid / Ladder',
    'priceUsd': 797,
    'monthlyPriceUsd': 80,
    'lifetimePriceUsd': 797,
    'file': 'Experts/DF LADDER - MOTION.ex4',
    'source': 'Experts/DF LADDER - MOTION.mq4',
    'bestMarket': 'XAUUSD / Gold',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'High - ladder/grid controls required',
    'description': 'Grid/ladder growth EA. Stronger skill tier because it needs max-trade, drawdown, and harvest protection rules.',
    'strategy': 'Grid / Ladder strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Builder',
      'Grid / Ladder',
      'Scale-in'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF LADDER RV',
    'status': 'Core Bot',
    'tier': 'Builder',
    'category': 'Grid / Ladder',
    'priceUsd': 797,
    'monthlyPriceUsd': 80,
    'lifetimePriceUsd': 797,
    'file': 'Experts/DF LADDER RV.ex4',
    'source': 'Experts/DF LADDER RV.mq4',
    'bestMarket': 'XAUUSD / Gold',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'High - ladder/grid controls required',
    'description': 'Grid/ladder growth EA. Stronger skill tier because it needs max-trade, drawdown, and harvest protection rules.',
    'strategy': 'Grid / Ladder strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Builder',
      'Grid / Ladder',
      'Scale-in'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF SAUCE',
    'status': 'Core Bot',
    'tier': 'Builder',
    'category': 'Mean Reversion',
    'priceUsd': 797,
    'monthlyPriceUsd': 80,
    'lifetimePriceUsd': 797,
    'file': 'Experts/DF SAUCE.ex4',
    'source': 'Experts/DF SAUCE.mq4',
    'bestMarket': 'XAUUSD / Gold',
    'platform': 'MT4',
    'symbols': [
      'XAUUSD',
      'Gold'
    ],
    'risk': 'Medium to High - use WISDO protection',
    'description': 'Sauce-family EA built for mean-reversion and gold-focused automation. Best used with WISDO risk controls and account tracking.',
    'strategy': 'Mean Reversion strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Builder',
      'Mean Reversion',
      'Gold-ready'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF SAUCE 2.0',
    'status': 'Core Bot',
    'tier': 'Builder',
    'category': 'Mean Reversion',
    'priceUsd': 797,
    'monthlyPriceUsd': 80,
    'lifetimePriceUsd': 797,
    'file': 'Experts/DF SAUCE 2.0.ex4',
    'source': 'Experts/DF SAUCE 2.0.mq4',
    'bestMarket': 'XAUUSD / Gold',
    'platform': 'MT4',
    'symbols': [
      'XAUUSD',
      'Gold'
    ],
    'risk': 'Medium to High - use WISDO protection',
    'description': 'Sauce-family EA built for mean-reversion and gold-focused automation. Best used with WISDO risk controls and account tracking.',
    'strategy': 'Mean Reversion strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Builder',
      'Mean Reversion',
      'Gold-ready'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF_SAUCE',
    'status': 'Core Bot',
    'tier': 'Builder',
    'category': 'Mean Reversion',
    'priceUsd': 797,
    'monthlyPriceUsd': 80,
    'lifetimePriceUsd': 797,
    'file': 'Experts/DF_SAUCE.ex4',
    'source': 'Experts/DF_SAUCE.mq4',
    'bestMarket': 'XAUUSD / Gold',
    'platform': 'MT4',
    'symbols': [
      'XAUUSD',
      'Gold'
    ],
    'risk': 'Medium to High - use WISDO protection',
    'description': 'Sauce-family EA built for mean-reversion and gold-focused automation. Best used with WISDO risk controls and account tracking.',
    'strategy': 'Mean Reversion strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Builder',
      'Mean Reversion',
      'Gold-ready'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF_Sauce_EA',
    'status': 'Core Bot',
    'tier': 'Builder',
    'category': 'Mean Reversion',
    'priceUsd': 797,
    'monthlyPriceUsd': 80,
    'lifetimePriceUsd': 797,
    'file': 'Experts/Imported_From_KOT4X/DF_Sauce_EA.ex4',
    'source': 'Experts/Imported_From_KOT4X/DF_Sauce_EA.mq4',
    'bestMarket': 'XAUUSD / Gold',
    'platform': 'MT4',
    'symbols': [
      'XAUUSD',
      'Gold'
    ],
    'risk': 'Medium to High - use WISDO protection',
    'description': 'Sauce-family EA built for mean-reversion and gold-focused automation. Best used with WISDO risk controls and account tracking.',
    'strategy': 'Mean Reversion strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Builder',
      'Mean Reversion',
      'Gold-ready'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF_Sauce_EA_FIXED',
    'status': 'Core Bot',
    'tier': 'Builder',
    'category': 'Mean Reversion',
    'priceUsd': 797,
    'monthlyPriceUsd': 80,
    'lifetimePriceUsd': 797,
    'file': 'Experts/Imported_From_KOT4X/DF_Sauce_EA_FIXED.ex4',
    'source': 'Experts/Imported_From_KOT4X/DF_Sauce_EA_FIXED.mq4',
    'bestMarket': 'XAUUSD / Gold',
    'platform': 'MT4',
    'symbols': [
      'XAUUSD',
      'Gold'
    ],
    'risk': 'Medium to High - use WISDO protection',
    'description': 'Sauce-family EA built for mean-reversion and gold-focused automation. Best used with WISDO risk controls and account tracking.',
    'strategy': 'Mean Reversion strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Builder',
      'Mean Reversion',
      'Gold-ready'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'AVA',
    'status': 'Core Bot',
    'tier': 'Builder',
    'category': 'Experimental',
    'priceUsd': 697,
    'monthlyPriceUsd': 70,
    'lifetimePriceUsd': 697,
    'file': 'Experts/AVA.ex4',
    'source': 'Experts/AVA.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Medium - test on demo first',
    'description': 'Builder CultureCoin EA listed from the uploaded Expert Advisor folders with WISDO marketplace checkout support.',
    'strategy': 'Experimental strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Builder',
      'Experimental'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF LADDER',
    'status': 'Core Bot',
    'tier': 'Builder',
    'category': 'Grid / Ladder',
    'priceUsd': 697,
    'monthlyPriceUsd': 70,
    'lifetimePriceUsd': 697,
    'file': 'Experts/DF LADDER.ex4',
    'source': 'Experts/DF LADDER.mq4',
    'bestMarket': 'XAUUSD / Gold',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'High - ladder/grid controls required',
    'description': 'Grid/ladder growth EA. Stronger skill tier because it needs max-trade, drawdown, and harvest protection rules.',
    'strategy': 'Grid / Ladder strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Builder',
      'Grid / Ladder',
      'Scale-in'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'GOLDSETUP',
    'status': 'Core Bot',
    'tier': 'Builder',
    'category': 'Premium / Advanced',
    'priceUsd': 697,
    'monthlyPriceUsd': 70,
    'lifetimePriceUsd': 697,
    'file': 'Experts/Imported_From_KOT4X/GOLDSETUP.ex4',
    'source': 'Experts/Imported_From_KOT4X/GOLDSETUP.mq4',
    'bestMarket': 'XAUUSD / Gold',
    'platform': 'MT4',
    'symbols': [
      'XAUUSD',
      'Gold'
    ],
    'risk': 'Medium - test on demo first',
    'description': 'Builder CultureCoin EA listed from the uploaded Expert Advisor folders with WISDO marketplace checkout support.',
    'strategy': 'Premium / Advanced strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Builder',
      'Premium / Advanced',
      'Gold-ready'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'KINGDOM MANNER - VERSION 3',
    'status': 'Core Bot',
    'tier': 'Builder',
    'category': 'Grid / Ladder',
    'priceUsd': 697,
    'monthlyPriceUsd': 70,
    'lifetimePriceUsd': 697,
    'file': 'Experts/Imported_From_KOT4X/KINGDOM MANNER - VERSION 3.ex4',
    'source': 'Experts/Imported_From_KOT4X/KINGDOM MANNER - VERSION 3.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'High - ladder/grid controls required',
    'description': 'Grid/ladder growth EA. Stronger skill tier because it needs max-trade, drawdown, and harvest protection rules.',
    'strategy': 'Grid / Ladder strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Builder',
      'Grid / Ladder',
      'Scale-in'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'KINGDOM MANNER - VERSION 4',
    'status': 'Core Bot',
    'tier': 'Builder',
    'category': 'Grid / Ladder',
    'priceUsd': 697,
    'monthlyPriceUsd': 70,
    'lifetimePriceUsd': 697,
    'file': 'Experts/Imported_From_KOT4X/KINGDOM MANNER - VERSION 4.ex4',
    'source': 'Experts/Imported_From_KOT4X/KINGDOM MANNER - VERSION 4.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'High - ladder/grid controls required',
    'description': 'Grid/ladder growth EA. Stronger skill tier because it needs max-trade, drawdown, and harvest protection rules.',
    'strategy': 'Grid / Ladder strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Builder',
      'Grid / Ladder',
      'Scale-in'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'Kingdom Manner',
    'status': 'Core Bot',
    'tier': 'Builder',
    'category': 'Grid / Ladder',
    'priceUsd': 697,
    'monthlyPriceUsd': 70,
    'lifetimePriceUsd': 697,
    'file': 'Experts/Imported_From_KOT4X/Kingdom Manner.ex4',
    'source': 'Experts/Imported_From_KOT4X/Kingdom Manner.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'High - ladder/grid controls required',
    'description': 'Grid/ladder growth EA. Stronger skill tier because it needs max-trade, drawdown, and harvest protection rules.',
    'strategy': 'Grid / Ladder strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Builder',
      'Grid / Ladder',
      'Scale-in'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF KNOT',
    'status': 'Strategy Bot',
    'tier': 'Starter+',
    'category': 'Mean Reversion',
    'priceUsd': 497,
    'monthlyPriceUsd': 50,
    'lifetimePriceUsd': 497,
    'file': 'Experts/DF KNOT.ex4',
    'source': 'Experts/DF KNOT.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Medium - test on demo first',
    'description': 'Starter+ CultureCoin EA listed from the uploaded Expert Advisor folders with WISDO marketplace checkout support.',
    'strategy': 'Mean Reversion strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Starter+',
      'Mean Reversion'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF KNOT +AUTOFLIP',
    'status': 'Strategy Bot',
    'tier': 'Starter+',
    'category': 'Mean Reversion',
    'priceUsd': 497,
    'monthlyPriceUsd': 50,
    'lifetimePriceUsd': 497,
    'file': 'Experts/DF KNOT +AUTOFLIP.ex4',
    'source': 'Experts/DF KNOT +AUTOFLIP.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Medium - test on demo first',
    'description': 'Starter+ CultureCoin EA listed from the uploaded Expert Advisor folders with WISDO marketplace checkout support.',
    'strategy': 'Mean Reversion strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Starter+',
      'Mean Reversion'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF KNOT +AUTOFLIP_E733F041',
    'status': 'Strategy Bot',
    'tier': 'Starter+',
    'category': 'Mean Reversion',
    'priceUsd': 497,
    'monthlyPriceUsd': 50,
    'lifetimePriceUsd': 497,
    'file': 'Experts/ALL_EAs_BY_FUNCTION/MeanReversion/DF KNOT +AUTOFLIP_E733F041.ex4',
    'source': 'Experts/ALL_EAs_BY_FUNCTION/MeanReversion/DF KNOT +AUTOFLIP_E733F041.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Medium - test on demo first',
    'description': 'Starter+ CultureCoin EA listed from the uploaded Expert Advisor folders with WISDO marketplace checkout support.',
    'strategy': 'Mean Reversion strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Starter+',
      'Mean Reversion'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF KNOT_647F42D4',
    'status': 'Strategy Bot',
    'tier': 'Starter+',
    'category': 'Mean Reversion',
    'priceUsd': 497,
    'monthlyPriceUsd': 50,
    'lifetimePriceUsd': 497,
    'file': 'Experts/ALL_EAs_BY_FUNCTION/MeanReversion/DF KNOT_647F42D4.ex4',
    'source': 'Experts/ALL_EAs_BY_FUNCTION/MeanReversion/DF KNOT_647F42D4.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Medium - test on demo first',
    'description': 'Starter+ CultureCoin EA listed from the uploaded Expert Advisor folders with WISDO marketplace checkout support.',
    'strategy': 'Mean Reversion strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Starter+',
      'Mean Reversion'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF_QUANTUM',
    'status': 'Strategy Bot',
    'tier': 'Starter+',
    'category': 'Premium / Advanced',
    'priceUsd': 497,
    'monthlyPriceUsd': 50,
    'lifetimePriceUsd': 497,
    'file': 'Experts/DF_QUANTUM/DF_QUANTUM.ex4',
    'source': 'Experts/DF_QUANTUM/DF_QUANTUM.mq4',
    'bestMarket': 'XAUUSD / Gold',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Medium - test on demo first',
    'description': 'Starter+ CultureCoin EA listed from the uploaded Expert Advisor folders with WISDO marketplace checkout support.',
    'strategy': 'Premium / Advanced strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Starter+',
      'Premium / Advanced'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'SORO + IMB SCALER',
    'status': 'Strategy Bot',
    'tier': 'Starter+',
    'category': 'Grid / Ladder',
    'priceUsd': 497,
    'monthlyPriceUsd': 50,
    'lifetimePriceUsd': 497,
    'file': 'Experts/Imported_From_KOT4X/SORO + IMB SCALER.ex4',
    'source': 'Experts/Imported_From_KOT4X/SORO + IMB SCALER.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'High - ladder/grid controls required',
    'description': 'Starter+ CultureCoin EA listed from the uploaded Expert Advisor folders with WISDO marketplace checkout support.',
    'strategy': 'Grid / Ladder strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Starter+',
      'Grid / Ladder'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'CCREACT',
    'status': 'Bot',
    'tier': 'Starter',
    'category': 'Experimental',
    'priceUsd': 397,
    'monthlyPriceUsd': 49,
    'lifetimePriceUsd': 397,
    'file': 'Experts/CCREACT.ex4',
    'source': 'Experts/CCREACT.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Medium - test on demo first',
    'description': 'Starter CultureCoin EA listed from the uploaded Expert Advisor folders with WISDO marketplace checkout support.',
    'strategy': 'Experimental strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Starter',
      'Experimental'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'CEM BOT COPIER',
    'status': 'Copy Utility',
    'tier': 'Utility',
    'category': 'Copy Utility',
    'priceUsd': 397,
    'monthlyPriceUsd': 49,
    'lifetimePriceUsd': 397,
    'file': 'Experts/CEM BOT COPIER.ex4',
    'source': 'Experts/CEM BOT COPIER.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Depends on leader and follower settings',
    'description': 'Copy trading utility lane for leader/follower workflows and WISDO copy-link execution.',
    'strategy': 'Copy Utility strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Utility',
      'Copy Utility',
      'Copy Trading'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF HIGHTOWER',
    'status': 'Bot',
    'tier': 'Starter',
    'category': 'Trend',
    'priceUsd': 397,
    'monthlyPriceUsd': 49,
    'lifetimePriceUsd': 397,
    'file': 'Experts/DF HIGHTOWER.ex4',
    'source': 'Experts/DF HIGHTOWER.mq4',
    'bestMarket': 'XAUUSD / Gold',
    'platform': 'MT4',
    'symbols': [
      'XAUUSD',
      'Gold'
    ],
    'risk': 'Medium - trend confirmation required',
    'description': 'Trend-focused EA designed for directional movement, structure confirmation, and leaderboard-style performance tracking.',
    'strategy': 'Trend strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Starter',
      'Trend',
      'Gold-ready'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF HIGHTOWER V2',
    'status': 'Bot',
    'tier': 'Starter',
    'category': 'Trend',
    'priceUsd': 397,
    'monthlyPriceUsd': 49,
    'lifetimePriceUsd': 397,
    'file': 'Experts/DF HIGHTOWER V2.ex4',
    'source': 'Experts/DF HIGHTOWER V2.mq4',
    'bestMarket': 'XAUUSD / Gold',
    'platform': 'MT4',
    'symbols': [
      'XAUUSD',
      'Gold'
    ],
    'risk': 'Medium - trend confirmation required',
    'description': 'Trend-focused EA designed for directional movement, structure confirmation, and leaderboard-style performance tracking.',
    'strategy': 'Trend strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Starter',
      'Trend',
      'Gold-ready'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF_Handsfree',
    'status': 'Bot',
    'tier': 'Starter',
    'category': 'Experimental',
    'priceUsd': 397,
    'monthlyPriceUsd': 49,
    'lifetimePriceUsd': 397,
    'file': 'Experts/FOW/DF_Handsfree.ex4',
    'source': 'Experts/FOW/DF_Handsfree.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Medium - test on demo first',
    'description': 'Starter CultureCoin EA listed from the uploaded Expert Advisor folders with WISDO marketplace checkout support.',
    'strategy': 'Experimental strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Starter',
      'Experimental'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'DF_Handsfree V9',
    'status': 'Bot',
    'tier': 'Starter',
    'category': 'Experimental',
    'priceUsd': 397,
    'monthlyPriceUsd': 49,
    'lifetimePriceUsd': 397,
    'file': 'Experts/FOW/DF_Handsfree V9.ex4',
    'source': 'Experts/FOW/DF_Handsfree V9.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Medium - test on demo first',
    'description': 'Starter CultureCoin EA listed from the uploaded Expert Advisor folders with WISDO marketplace checkout support.',
    'strategy': 'Experimental strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Starter',
      'Experimental'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'HALO',
    'status': 'Starter Bot',
    'tier': 'Starter',
    'category': 'Scalper',
    'priceUsd': 297,
    'monthlyPriceUsd': 49,
    'lifetimePriceUsd': 297,
    'file': 'Experts/Imported_From_KOT4X/HALO.ex4',
    'source': 'Experts/Imported_From_KOT4X/HALO.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Medium - test on demo first',
    'description': 'Starter CultureCoin EA listed from the uploaded Expert Advisor folders with WISDO marketplace checkout support.',
    'strategy': 'Scalper strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Starter',
      'Scalper'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'IMB',
    'status': 'Starter Bot',
    'tier': 'Starter',
    'category': 'Scalper',
    'priceUsd': 297,
    'monthlyPriceUsd': 49,
    'lifetimePriceUsd': 297,
    'file': 'Experts/Imported_From_KOT4X/IMB/IMB.ex4',
    'source': 'Experts/Imported_From_KOT4X/IMB/IMB.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Medium - test on demo first',
    'description': 'Starter CultureCoin EA listed from the uploaded Expert Advisor folders with WISDO marketplace checkout support.',
    'strategy': 'Scalper strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Starter',
      'Scalper'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'Manner',
    'status': 'Starter Bot',
    'tier': 'Starter',
    'category': 'Grid / Ladder',
    'priceUsd': 297,
    'monthlyPriceUsd': 49,
    'lifetimePriceUsd': 297,
    'file': 'Experts/Imported_From_KOT4X/Manner.ex4',
    'source': 'Experts/Imported_From_KOT4X/Manner.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'High - ladder/grid controls required',
    'description': 'Grid/ladder growth EA. Stronger skill tier because it needs max-trade, drawdown, and harvest protection rules.',
    'strategy': 'Grid / Ladder strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Starter',
      'Grid / Ladder',
      'Scale-in'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'SORO',
    'status': 'Starter Bot',
    'tier': 'Starter',
    'category': 'Scalper',
    'priceUsd': 297,
    'monthlyPriceUsd': 49,
    'lifetimePriceUsd': 297,
    'file': 'Experts/Imported_From_KOT4X/SORO.ex4',
    'source': 'Experts/Imported_From_KOT4X/SORO.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Medium - test on demo first',
    'description': 'Starter CultureCoin EA listed from the uploaded Expert Advisor folders with WISDO marketplace checkout support.',
    'strategy': 'Scalper strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Starter',
      'Scalper'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'MACD Sample',
    'status': 'Basic EA',
    'tier': 'Basic',
    'category': 'Trend',
    'priceUsd': 97,
    'monthlyPriceUsd': 49,
    'lifetimePriceUsd': 97,
    'file': 'Experts/Imported_From_KOT4X/MACD Sample.ex4',
    'source': 'Experts/Imported_From_KOT4X/MACD Sample.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Low - basic strategy risk',
    'description': 'Basic classic MT4 sample-style EA listed as a starter/testing bot, not a flagship recommendation.',
    'strategy': 'Trend strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Basic',
      'Trend',
      'Starter/Test'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'MACD Sample_44D4FBE6',
    'status': 'Basic EA',
    'tier': 'Basic',
    'category': 'Trend',
    'priceUsd': 97,
    'monthlyPriceUsd': 49,
    'lifetimePriceUsd': 97,
    'file': 'Experts/ALL_EAs_BY_FUNCTION/Trend/MACD Sample_44D4FBE6.ex4',
    'source': 'Experts/ALL_EAs_BY_FUNCTION/Trend/MACD Sample_44D4FBE6.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Low - basic strategy risk',
    'description': 'Basic classic MT4 sample-style EA listed as a starter/testing bot, not a flagship recommendation.',
    'strategy': 'Trend strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Basic',
      'Trend',
      'Starter/Test'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'Moving Average',
    'status': 'Basic EA',
    'tier': 'Basic',
    'category': 'Trend',
    'priceUsd': 97,
    'monthlyPriceUsd': 49,
    'lifetimePriceUsd': 97,
    'file': 'Experts/Imported_From_KOT4X/Moving Average.ex4',
    'source': 'Experts/Imported_From_KOT4X/Moving Average.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Low - basic strategy risk',
    'description': 'Basic classic MT4 sample-style EA listed as a starter/testing bot, not a flagship recommendation.',
    'strategy': 'Trend strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Basic',
      'Trend',
      'Starter/Test'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'Moving Average_3BDBF483',
    'status': 'Basic EA',
    'tier': 'Basic',
    'category': 'Trend',
    'priceUsd': 97,
    'monthlyPriceUsd': 49,
    'lifetimePriceUsd': 97,
    'file': 'Experts/ALL_EAs_BY_FUNCTION/Trend/Moving Average_3BDBF483.ex4',
    'source': 'Experts/ALL_EAs_BY_FUNCTION/Trend/Moving Average_3BDBF483.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Low - basic strategy risk',
    'description': 'Basic classic MT4 sample-style EA listed as a starter/testing bot, not a flagship recommendation.',
    'strategy': 'Trend strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Basic',
      'Trend',
      'Starter/Test'
    ],
    'recommended': false,
    'active': true
  },
  {
    'name': 'CultureCoin_MT4_Reporter',
    'status': 'Bridge Utility',
    'tier': 'Utility',
    'category': 'Bridge Utility',
    'priceUsd': 0,
    'monthlyPriceUsd': 0,
    'lifetimePriceUsd': 0,
    'file': 'Experts/REACTOR/CultureCoin_MT4_Reporter.ex4',
    'source': 'Experts/REACTOR/CultureCoin_MT4_Reporter.mq4',
    'bestMarket': 'Multi-symbol after testing',
    'platform': 'MT4',
    'symbols': [
      'All supported symbols'
    ],
    'risk': 'Medium - test on demo first',
    'description': 'Utility CultureCoin EA listed from the uploaded Expert Advisor folders with WISDO marketplace checkout support.',
    'strategy': 'Bridge Utility strategy. Install on demo first, verify broker settings, then connect to WISDO for tracking, copy visibility, and safety controls.',
    'tags': [
      'Utility',
      'Bridge Utility'
    ],
    'recommended': false,
    'active': false
  }
];


function htmlShell(title, body, active = 'home', options = {}) {
  const showAdmin = Boolean(options.adminAccess || options.showAdmin);
  const nav = [
    ['home', '/member', 'Member Portal'],
    ['command', '/member/command-center', 'Command Center'],
    ['education', '/member/education', 'Education'],
    ['ai', '/member/ai', 'Wisdo AI'],
    ['simulator', '/member/simulator', 'Simulator'],
    ['social', '/member/social', 'Social'],
    ['signals', '/member/signal-grid', 'Signal Grid'],
    ['link', '/member/link-account', 'Trade Link'],
    ['advancedlink', '/member/advanced-link', 'Advanced Link'],
    ['accounts', '/member/accounts', 'My Accounts'],
    ['profile', '/member/profile', 'My Profile'],
    ['linkaccess', '/member/link-access', 'Link Access'],
    ['linkedaccess', '/member/linked-access', 'Linked Access'],
    ['onboarding', '/member/onboarding', 'Onboarding'],
    ['doctor', '/member/account-doctor', 'Account Doctor'],
    ['risk', '/member/risk-profile', 'Risk Profile'],
    ['results', '/member/trade-results', 'Trade Results'],
    ['tickets', '/member/support/tickets', 'Support Tickets'],
    ['health', '/admin/health', 'Admin Health'],
    ['mybots', '/member/my-bots', 'My Bots'],
    ['content', '/member/content', 'Content Hub'],
    ['wallet', '/member/wallet', 'Wallet'],
    ['referrals', '/member/referrals', 'Referrals'],
    ['refbuilder', '/member/referral-builder', 'Referral Builder'],
    ['copypro', '/member/copy-pro', 'Copier Engine'],
    ['storefront', '/member/store', 'Store'],
    ['leaderboard', '/member/leaderboard', 'Leaderboard'],
    ['marketplace', '/member/marketplace', 'Marketplace'],
    ['bots', '/member/bots', 'Bots'],
    ['devices', '/member/devices', 'Devices'],
    ['upgrades', '/member/upgrades', 'Special Upgrades'],
    ['sales', '/member/sales', 'Sales'],
    ['academy', '/member/academy', 'Academy'],
    ['subscriptions', '/member/subscriptions', 'Subscriptions'],
    ['plans', '/member/payment-plans', 'Payment Plans'],
    ['vps', '/member/vps', 'VPS Forge'],
    ['payouts', '/member/payouts', 'Payouts'],
    ['support', '/member/support', 'Support'],
    ['settings', '/member/settings', 'Settings'],
    ['adminfinance', '/admin/finance', 'Admin Finance'],
    ['adminvps', '/admin/vps', 'Admin VPS'],
    ['admincommerce', '/admin/commerce', 'Admin Commerce'],
    ['adminwisdo', '/member/admin-wisdo', 'Admin Wisdo'],
  ].filter(([key]) => showAdmin || !String(key).startsWith('admin')).map(([key, href, label]) => `<a class="${active === key ? 'active' : ''}" href="${href}">${label}</a>`).join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(title)}</title><style>
    :root{--bg:#050b12;--card:#0b1a2a;--card2:#10263b;--line:#b9781c;--gold:#f0aa2b;--text:#f6f7fb;--muted:#9fb0c3;--green:#46d17b;--red:#ff6767;--blue:#6cb6ff;--purple:#af8cff}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#050b12;color:var(--text);font-family:Inter,Segoe UI,Arial,sans-serif;position:relative;overflow-x:hidden}.bg-video{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:-3;filter:saturate(1.05) brightness(.5);opacity:0;transition:opacity 1.4s ease}.bg-video.active{opacity:1}.background-switcher{position:fixed;right:18px;bottom:18px;z-index:20;background:rgba(5,11,18,.72);border:1px solid rgba(240,170,43,.42);border-radius:999px;padding:8px 10px;backdrop-filter:blur(14px)}.bot-card.recommended{border-color:rgba(70,209,123,.72);box-shadow:0 0 45px rgba(70,209,123,.12),0 20px 55px rgba(0,0,0,.3)}.bot-banner{background:linear-gradient(135deg,rgba(70,209,123,.16),rgba(240,170,43,.12));border:1px solid rgba(70,209,123,.42)}.bg-overlay{position:fixed;inset:0;background:radial-gradient(circle at 20% 0%,rgba(240,170,43,.18),transparent 29%),radial-gradient(circle at 90% 15%,rgba(108,182,255,.16),transparent 30%),linear-gradient(145deg,rgba(5,11,18,.85),rgba(8,21,37,.74) 52%,rgba(5,11,18,.9));z-index:-2}.wrap{display:grid;grid-template-columns:260px 1fr;min-height:100vh}.side{border-right:1px solid rgba(240,170,43,.35);padding:22px;background:rgba(2,10,18,.62);backdrop-filter:blur(16px);position:sticky;top:0;height:100vh}.brand{font-weight:950;font-size:22px;margin-bottom:12px;letter-spacing:-.04em;display:flex;align-items:center;gap:10px}.brand-logo{width:46px;height:46px;object-fit:contain;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(240,170,43,.24)}.brand span{color:var(--gold)}.pill{display:inline-flex;gap:8px;align-items:center;border:1px solid rgba(240,170,43,.35);background:rgba(240,170,43,.08);border-radius:999px;color:#ffd58b;padding:7px 10px;font-size:12px;margin-bottom:18px}.nav a{display:block;color:var(--text);text-decoration:none;padding:12px 14px;border-radius:12px;margin:7px 0;font-weight:750}.nav a.active,.nav a:hover{background:linear-gradient(90deg,var(--gold),#8b520e);color:#07111e}.main{padding:30px;max-width:1600px}.hero{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:22px}.title{font-size:40px;font-weight:950;letter-spacing:-.055em;line-height:1}.sub{color:var(--muted);margin-top:9px;max-width:920px;line-height:1.6}.grid{display:grid;grid-template-columns:repeat(4,minmax(190px,1fr));gap:16px}.grid3{display:grid;grid-template-columns:repeat(3,minmax(220px,1fr));gap:16px}.grid2{display:grid;grid-template-columns:repeat(2,minmax(260px,1fr));gap:16px}.card{background:linear-gradient(180deg,rgba(17,39,61,.88),rgba(6,18,31,.88));border:1px solid rgba(240,170,43,.34);border-radius:18px;padding:19px;box-shadow:0 20px 55px rgba(0,0,0,.28);backdrop-filter:blur(10px)}.card h3{margin:0 0 8px;font-size:15px;color:#fff}.card p{color:var(--muted);line-height:1.55}.metric{font-size:28px;font-weight:950;letter-spacing:-.04em}.muted{color:var(--muted)}.green{color:var(--green)}.red{color:var(--red)}.gold{color:var(--gold)}.blue{color:var(--blue)}.wide{grid-column:span 2}.full{grid-column:1/-1}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid rgba(255,255,255,.08);padding:11px;text-align:left;vertical-align:top}th{color:#ffd58b;font-size:13px}select,input,textarea,.btn{background:#0b1a2a;color:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 12px}.btn{display:inline-flex;gap:8px;align-items:center;text-decoration:none;margin:4px 8px 4px 0;font-weight:850;cursor:pointer}.btn.primary{background:linear-gradient(90deg,var(--gold),#8b520e);color:#07111e}.btn.ghost{border-color:rgba(255,255,255,.18)}.spark{height:240px;width:100%;background:#06111d;border-radius:12px;border:1px solid rgba(255,255,255,.08)}.tag{display:inline-flex;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);border-radius:999px;padding:6px 9px;color:#d7e6f7;font-size:12px;margin:3px}.upgrade{position:relative;overflow:hidden}.upgrade:before{content:'';position:absolute;inset:-1px;border-radius:18px;background:linear-gradient(135deg,rgba(240,170,43,.28),transparent 40%,rgba(108,182,255,.18));pointer-events:none}.price{font-size:26px;font-weight:950}.strike{text-decoration:line-through;color:#6f8194;font-size:14px}.step{display:flex;gap:14px;align-items:flex-start}.num{min-width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,var(--gold),#84500f);color:#06111d;display:grid;place-items:center;font-weight:950}.status-dot{width:10px;height:10px;border-radius:50%;display:inline-block;background:var(--green);box-shadow:0 0 16px var(--green)}.warn{background:rgba(255,103,103,.08);border-color:rgba(255,103,103,.36)}.ok{background:rgba(70,209,123,.08);border-color:rgba(70,209,123,.35)}.footer-note{margin-top:22px;color:var(--muted);font-size:13px}.gauge-wrap{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:12px;align-items:stretch;overflow:visible}.gauge{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center}.gauge .ring{--val:50;--tone: var(--gold);width:92px;height:92px;border-radius:50%;background:conic-gradient(var(--tone) calc(var(--val)*1%),rgba(255,255,255,.08) 0);display:grid;place-items:center;position:relative;box-shadow:inset 0 0 30px rgba(0,0,0,.25)}.gauge .ring:before{content:'';position:absolute;inset:9px;background:rgba(7,17,30,.92);border-radius:50%;border:1px solid rgba(255,255,255,.06)}.gauge .ring > span{position:relative;z-index:2;font-size:15px;font-weight:900}.gauge small{color:var(--muted)}.speedometer{height:150px;position:relative}.speedometer .dial{width:190px;height:95px;border-radius:190px 190px 0 0;background:conic-gradient(from 180deg,var(--green),var(--gold),var(--red));clip-path:inset(0 0 50% 0);margin:0 auto;position:relative;overflow:hidden}.speedometer .dial:after{content:'';position:absolute;left:50%;bottom:-58px;transform:translateX(-50%);width:130px;height:130px;border-radius:50%;background:rgba(7,17,30,.96);border:1px solid rgba(255,255,255,.08)}.speedometer .needle{--deg:0deg;position:absolute;left:50%;bottom:17px;width:4px;height:80px;background:linear-gradient(#fff,var(--gold));transform-origin:bottom center;transform:translateX(-50%) rotate(var(--deg));border-radius:999px;box-shadow:0 0 18px rgba(240,170,43,.5)}.speedometer .hub{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 0 14px rgba(255,255,255,.6)}.speedometer .label{margin-top:6px;text-align:center;font-weight:900}.leader-card{position:relative;overflow:visible}.leader-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.avatar{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--gold),#784509);display:grid;place-items:center;font-weight:900;color:#07111e}.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.social-feed .post{padding:14px 0;border-bottom:1px solid rgba(255,255,255,.08)}.social-feed .post:last-child{border-bottom:none}.mini-chart{height:120px}.progress-bar{height:12px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden}.progress-bar > span{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--green));border-radius:999px}.copy-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(330px,.85fr);gap:16px;align-items:start}.copy-grid>div{min-width:0}.logo-hero{max-width:360px;width:100%;height:auto;object-fit:contain}.purchase-panel{display:none;margin-top:14px}.purchase-panel.active{display:block}.checkout-result{white-space:pre-wrap;background:#06111d;border:1px solid rgba(255,255,255,.1);padding:14px;border-radius:14px;margin-top:14px;display:none}.sticky-card{position:sticky;top:24px}.disclaimer{font-size:12px;color:#9fb0c3;line-height:1.6} @media(max-width:1200px){.wrap{grid-template-columns:1fr}.side{position:relative;height:auto}.grid,.grid2,.grid3,.copy-grid,.gauge-wrap{grid-template-columns:1fr}.wide,.full{grid-column:auto}.logo-hero{max-width:260px}}
  </style></head><body><video id="bgVideoA" class="bg-video active" autoplay muted loop playsinline><source src="/media/14683743_3840_2160_30fps.mp4" type="video/mp4"></video><video id="bgVideoB" class="bg-video" autoplay muted loop playsinline><source src="/media/14250431_1920_1080_30fps.mp4" type="video/mp4"></video><div class="bg-overlay"></div><div class="background-switcher"><button class="btn ghost" id="bgSwitch" type="button">Switch Motion</button></div><div class="wrap"><aside class="side"><div class="brand"><img class="brand-logo" src="/media/logo_transparent_background.png" alt="CEM Culture logo">WISDO <span>Command Center</span></div><div class="pill"><span class="status-dot"></span>Live portal</div><a class="btn primary" href="/member/command-center" style="width:100%;margin:0 0 12px">Open Member Portal</a><nav class="nav">${nav}</nav><p class="footer-note">CultureCoin member ecosystem: desks, MT4 telemetry, copy trading, upgrades, sales, and operator support.</p></aside><main class="main">${body}</main></div>${wisdoAiDock(title, active)}<script>document.getElementById('bgSwitch')?.addEventListener('click',()=>{const a=document.getElementById('bgVideoA');const b=document.getElementById('bgVideoB');a.classList.toggle('active');b.classList.toggle('active');try{a.play();b.play();}catch(e){}});</script>${wisdoAiDockScript()}</body></html>`;
}

function wisdoAiDock(title = 'Wisdo', active = 'global') {
  return `<section id="wisdoAiDock" data-page="${esc(active || 'global')}" data-title="${esc(title || 'Wisdo')}" style="position:fixed;right:18px;bottom:84px;width:min(420px,calc(100vw - 28px));z-index:40;background:linear-gradient(180deg,rgba(11,26,42,.96),rgba(4,12,22,.98));border:1px solid rgba(240,170,43,.42);border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.48);backdrop-filter:blur(16px);overflow:hidden">
    <button id="wisdoAiToggle" type="button" style="width:100%;display:flex;justify-content:space-between;align-items:center;border:0;border-bottom:1px solid rgba(255,255,255,.08);background:linear-gradient(90deg,rgba(240,170,43,.18),rgba(108,182,255,.1));color:#fff;padding:12px 14px;font-weight:900;cursor:pointer"><span>Wisdo AI</span><span class="tag">Ask this page</span></button>
    <div id="wisdoAiPanel" style="display:none;padding:14px">
      <p class="muted" style="margin-top:0">Page-aware coach for education, risk, bots, signals, simulator, setup, and admin summaries.</p>
      <textarea id="wisdoAiPrompt" rows="3" placeholder="Ask Wisdo AI what to do on this page..." style="width:100%;resize:vertical"></textarea>
      <div class="row" style="margin-top:10px"><button class="btn primary" id="wisdoAiAsk" type="button">Ask Wisdo AI</button><button class="btn" id="wisdoAiExplain" type="button">Explain Page</button><a class="btn" href="/member/ai">Open AI Center</a></div>
      <pre id="wisdoAiOut" class="checkout-result" style="display:block;min-height:72px;max-height:260px;overflow:auto">Wisdo AI is ready. Educational only. Trading involves risk.</pre>
    </div>
  </section>`;
}

function wisdoAiDockScript() {
  return `<script>
  (()=>{const dock=document.getElementById('wisdoAiDock');if(!dock)return;const panel=document.getElementById('wisdoAiPanel');const out=document.getElementById('wisdoAiOut');const prompt=document.getElementById('wisdoAiPrompt');const page=dock.dataset.page||'global';const title=dock.dataset.title||document.title;document.getElementById('wisdoAiToggle')?.addEventListener('click',()=>{panel.style.display=panel.style.display==='none'?'block':'none';});async function ask(kind){panel.style.display='block';out.textContent='Thinking through '+title+'...';try{const body={mode:page,page:title,prompt:kind==='explain'?'Explain this Wisdo page and give safe next steps.':prompt.value};const res=await fetch('/api/wisdo/ai/ask',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body)});const json=await res.json();out.textContent=json.answer||json.error||'No AI answer returned.';}catch(error){out.textContent='Wisdo AI failed to answer: '+(error.message||error);}}document.getElementById('wisdoAiAsk')?.addEventListener('click',()=>ask('ask'));document.getElementById('wisdoAiExplain')?.addEventListener('click',()=>ask('explain'));})();
  </script>`;
}

function sectionHero(title, sub, right = '') {
  return `<div class="hero"><div><div class="title">${esc(title)}</div><div class="sub">${sub}</div></div><div>${right}</div></div>`;
}

function accountCards(snapshotRecord, baseUrl) {
  const s = snapshotRecord?.snapshot || {};
  const account = s.accountNumber || 'No account';
  const equity = Number(s.equity || 0);
  const balance = Number(s.balance || 0);
  const daily = Number(s.dailyClosedPL || s.closedPLToday || 0);
  const growth = balance > 0 ? ((equity - balance) / balance) * 100 : 0;
  const symbols = Array.isArray(s.symbols) ? s.symbols : String(s.symbols || '').split(',').filter(Boolean);

  return `${sectionHero(
    'WISDO Command Center',
    'Centralized trading desks, MT4 account status, bot control, special upgrades, member sales, and operator support in one portal.',
    `<a class="btn primary" href="${baseUrl}/member/upgrades">View Special Upgrades</a><a class="btn" href="${baseUrl}/member/accounts/${account}/history">Account History</a>`,
  )}<div class="grid"><section class="card"><h3>Live Account Tracker</h3><div class="metric">${esc(account)}</div><div class="muted">${esc(s.brokerServer || 'Connect MT4')}</div></section><section class="card"><h3>Equity / Balance</h3><div class="metric">${money(equity)}</div><div class="muted">Balance ${money(balance)}</div></section><section class="card"><h3>Daily Closed P/L</h3><div class="metric ${daily >= 0 ? 'green' : 'red'}">${money(daily)}</div><div class="muted">Growth ${pct(growth)}</div></section><section class="card"><h3>Device Status</h3><div class="metric">${snapshotRecord ? 'Online' : 'Offline'}</div><div class="muted">Terminal ${s.terminalConnected === false ? 'Disconnected' : 'Connected'}</div></section><section class="card wide"><h3>Active Pairs</h3><div>${symbols.map((x) => `<span class="tag">${esc(x)}</span>`).join('') || '<span class="muted">No symbols yet</span>'}</div></section><section class="card"><h3>Bot Performance</h3><div class="metric">${esc(s.eaName || 'EA')}</div><div class="muted">${esc(s.eaVersion || 'version pending')}</div></section><section class="card"><h3>Open Trades</h3><div class="metric">${s.openTradeCount || 0}</div><div class="muted">Buy ${s.buyTradeCount || 0} / Sell ${s.sellTradeCount || 0}</div></section><section class="card full"><img class="logo-hero" src="/media/white_logo_transparent_background.png" alt="CEM Culture"><h3>Quick Launch</h3><a class="btn primary" href="/member/link-account">Trade Link</a><a class="btn" href="/member/accounts">Accounts</a><a class="btn" href="/member/wallet">Wallet</a><a class="btn primary" href="/member/copy-pro">Copier Engine</a><a class="btn" href="/member/bots">Bot Arena</a><a class="btn" href="/member/devices">Device Forge</a><a class="btn" href="/member/upgrades">Special Upgrades</a><a class="btn" href="/member/sales">Sales Desk</a><a class="btn" href="/member/academy">Academy</a></section></div>`;
}

function upgradesPage() {
  const cards = SPECIAL_UPGRADES.map((u) => `<section class="card upgrade"><h3>${esc(u.name)}</h3><div class="tag gold">${esc(u.tag)}</div><p>${esc(u.description)}</p><div class="price">Min ${money(u.minPrice)} <span class="strike">Retail ${money(u.retail)}</span></div><div style="margin-top:10px">${u.includes.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</div><a class="btn primary" href="/member/sales">Build Offer</a><a class="btn ghost" href="/member/support">Request Setup</a></section>`).join('');
  return `${sectionHero('Special Upgrades', 'These are the premium CultureCoin/WISDO add-ons members can sell, request, or unlock. Minimum price protects the brand. Sellers can charge higher when they add value, setup, coaching, or support.', '<a class="btn primary" href="/api/upgrades">JSON Catalog</a>')}<div class="grid3">${cards}</div>`;
}

function botsPage(config) {
  const recommended = EA_CATALOG.find((bot) => bot.recommended) || EA_CATALOG[0];
  const categories = [...new Set(EA_CATALOG.map((bot) => bot.category))].sort();
  const paidBots = EA_CATALOG.filter((bot) => bot.priceUsd > 0);
  const cards = EA_CATALOG.map((bot) => {
    const slug = slugify(bot.name);
    const price = botPrice(bot, config);
    const checkoutLabel = price > 0 ? 'Buy Bot' : 'Get Utility';
    return `<section class="card bot-card ${bot.recommended ? 'recommended' : ''}" data-category="${esc(bot.category)}"><div class="row" style="justify-content:space-between"><h3>${bot.recommended ? '⭐ ' : ''}${esc(bot.name)}</h3><span class="tag ${bot.recommended ? 'green' : 'gold'}">${esc(bot.tier || bot.status)}</span></div><p>${esc(bot.description)}</p><div class="price">${price > 0 ? money(price) : 'Free Utility'}</div><div class="muted">${price > 0 ? 'Lifetime marketplace price' : 'Bridge/support utility'}</div><div class="row"><span class="tag">${esc(bot.category)}</span><span class="tag">${esc(bot.bestMarket || 'Multi-symbol')}</span><span class="tag">${esc(bot.platform || 'MT4')}</span></div><p class="muted" style="margin-top:10px">Risk: ${esc(bot.risk)}</p><div style="margin-top:10px">${bot.tags.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</div><p class="muted" style="margin-top:12px">Delivery after purchase: ${esc(bot.file)}</p><div class="row"><button class="btn primary buy-bot" data-bot="${esc(bot.name)}" data-price="${price}" data-slug="${slug}">${checkoutLabel}</button><a class="btn" href="/member/bots/${slug}">Details</a><a class="btn" href="/member/link-account?selectedBot=${encodeURIComponent(bot.name)}">Link Account</a><a class="btn ghost" href="/member/copy-pro?bot=${encodeURIComponent(bot.name)}">Use in Copier Engine</a></div><div id="checkout-${slug}" class="checkout-result" style="display:none;white-space:pre-wrap;background:#06111d;border:1px solid rgba(255,255,255,.1);padding:12px;border-radius:12px;margin-top:12px"></div></section>`;
  }).join('');
  const categoryTags = categories.map((cat) => `<span class="tag">${esc(cat)}</span>`).join('');
  return `${sectionHero('Bot Arena Marketplace', 'Every Expert Advisor found in your uploaded folders is listed as its own product card with a skill-based price, checkout action, WISDO compatibility, and Copier Engine connection path.', '<a class="btn primary" href="#all-bots">Shop All Bots</a><a class="btn" href="/member/copy-pro">View Copier Engine</a>')}
  <section class="card bot-banner full"><div class="row" style="justify-content:space-between;align-items:center"><div><img class="logo-hero" src="/media/white_logo_transparent_background.png" alt="CEM Culture"><h3>Recommended Today</h3><div class="title" style="font-size:34px">${esc(recommended.name)}</div><p>${esc(recommended.description)}</p><div>${recommended.tags.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</div></div><div><div class="metric green">${money(botPrice(recommended, config))}</div><p class="muted">Top bot recommendation. This is the flagship product card, not a generic EA-pack download.</p><button class="btn primary buy-bot" data-bot="${esc(recommended.name)}" data-price="${botPrice(recommended, config)}" data-slug="${slugify(recommended.name)}">Buy DF SAUCE FINAL AI</button><a class="btn" href="/member/bots/${slugify(recommended.name)}">View Details</a><div id="checkout-${slugify(recommended.name)}" class="checkout-result" style="display:none;white-space:pre-wrap;background:#06111d;border:1px solid rgba(255,255,255,.1);padding:12px;border-radius:12px;margin-top:12px"></div></div></div></section>
  <div class="grid3" style="margin-top:16px"><section class="card"><h3>Bots Listed</h3><div class="metric">${EA_CATALOG.length}</div><p>Each uploaded EA is now displayed as a marketplace product.</p></section><section class="card"><h3>Paid Products</h3><div class="metric">${paidBots.length}</div><p>Products can create Square checkout or manual quotes.</p></section><section class="card"><h3>Top Price</h3><div class="metric green">${money(botPrice(recommended, config))}</div><p>DF SAUCE FINAL AI flagship price.</p></section><section class="card full"><h3>Bot Categories</h3>${categoryTags}</section><section class="card full"><h3>What Buyer Gets</h3><span class="tag">EA delivery after purchase</span><span class="tag">Install guide</span><span class="tag">WISDO link-account flow</span><span class="tag">Copier Engine visibility</span><span class="tag">Support desk record</span><span class="tag">Risk disclaimer</span></section></div>
  <div id="all-bots" class="grid3" style="margin-top:16px">${cards}</div><script>document.querySelectorAll('.buy-bot').forEach(btn=>btn.addEventListener('click',async()=>{const slug=btn.dataset.slug;const out=document.getElementById('checkout-'+slug);out.style.display='block';out.textContent='Creating checkout...';const res=await fetch('/api/bot-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botName:btn.dataset.bot,priceUsd:Number(btn.dataset.price||0)})});const json=await res.json();if(json.checkoutUrl){out.innerHTML='Checkout ready: <a class="btn primary" href="'+json.checkoutUrl+'">Open Square Checkout</a>'; } else if(json.ok){out.textContent='Manual quote created for '+json.botName+' at $'+json.priceUsd+'. Add SQUARE_ACCESS_TOKEN on Render to turn this into live checkout.';} else {out.textContent='Checkout error: '+(json.error||'Unknown error');}}));</script>`;
}
function devicesPage() {
  return `${sectionHero('Device Forge', 'The hardware roadmap for MT4 tablets and handheld WISDO devices. Start with tablets, then move into dedicated voice devices once the software is stable.')}
  <div class="grid3"><section class="card"><h3>Phase 1: Tablet Kit</h3><p>Windows tablet or mini PC with MT4, CultureCoin Reporter, WISDO portal bookmark, and member desk pairing.</p><span class="tag">Fastest launch</span><span class="tag">Low cost</span></section><section class="card"><h3>Phase 2: VPS + Tablet</h3><p>MT4 runs on VPS. Tablet becomes the dashboard and command controller instead of the main trading machine.</p><span class="tag">More stable</span><span class="tag">Remote access</span></section><section class="card"><h3>Phase 3: WISDO Handheld</h3><p>Small voice-first controller that sends command intents to WISDO. Use only after command safety is proven.</p><span class="tag">Voice commander</span><span class="tag">Future product</span></section><section class="card full"><h3>Device Checklist</h3><table><tr><th>Item</th><th>Purpose</th><th>Status</th></tr><tr><td>MT4 terminal</td><td>Runs EA and account connection</td><td>Required</td></tr><tr><td>CultureCoin Reporter</td><td>Sends snapshots and polls WISDO commands</td><td>Required</td></tr><tr><td>WISDO Desk</td><td>Private support and command history</td><td>Required</td></tr><tr><td>VPS</td><td>Keeps bot running when device is off</td><td>Recommended</td></tr></table></section></div>`;
}

function salesPage(config) {
  const rows = SPECIAL_UPGRADES.map((u) => `<tr><td>${esc(u.name)}</td><td>${money(u.minPrice)}</td><td>${money(u.retail)}</td><td>You may sell above retail when setup/support is included. Never sell below minimum.</td></tr>`).join('');
  return `${sectionHero('CultureCoin Sales Desk', 'A simple sales lane for members: sell approved bots, devices, setup, and WISDO upgrades. Minimum price protects the floor; added service lets sellers charge more.')}
  <div class="grid2"><section class="card"><h3>Sales Rule</h3><div class="metric gold">Minimum price first</div><p>Members can sell higher based on setup, support, coaching, travel, custom install, or premium service. They cannot sell below the minimum price.</p></section><section class="card"><h3>Example Commission Thinking</h3><p>If a seller adds setup and support, the spread above the minimum price becomes their service margin. Keep records in the student desk.</p><span class="tag">No undercutting</span><span class="tag">Record every sale</span><span class="tag">Support included</span></section><section class="card full"><h3>Upgrade Price Sheet</h3><table><thead><tr><th>Offer</th><th>Minimum</th><th>Retail Anchor</th><th>Seller Note</th></tr></thead><tbody>${rows}</tbody></table></section><section class="card full"><h3>Bot Price Guardrails</h3><table><tr><th>Product</th><th>Floor</th><th>Member</th><th>Retail</th></tr><tr><td>Approved Bot</td><td>${money(config.store.negotiationFloorUsd)}</td><td>${money(config.store.cultureCoinPriceUsd)}</td><td>${money(config.store.basePriceUsd)}</td></tr></table></section></div>`;
}

function academyPage() {
  const steps = ACADEMY_STEPS.map(([n, title, copy]) => `<section class="card step"><div class="num">${n}</div><div><h3>${esc(title)}</h3><p>${esc(copy)}</p></div></section>`).join('');
  return `${sectionHero('WISDO Academy', 'Train the operator before scaling the account. This page turns the system into a repeatable onboarding course.')}
  <div class="grid2">${steps}</div><section class="card full"><h3>Operator Covenant</h3><p>Do not chase. Do not revenge trade. Do not increase risk after losses. Confirm account state before commands. Protect profits before pursuing larger goals.</p></section>`;
}

function payoutsPage() {
  return `${sectionHero('Payouts', 'Simple payout and reinvestment structure for trading profits, product sales, and member services.')}
  <div class="grid3"><section class="card"><h3>Protect</h3><div class="metric">30%</div><p>Move a portion of realized gains away from trading risk.</p></section><section class="card"><h3>Reinvest</h3><div class="metric">40%</div><p>Fund bot improvements, VPS, devices, and trading capital.</p></section><section class="card"><h3>Operate</h3><div class="metric">30%</div><p>Cover software, support, admin, marketing, and business needs.</p></section><section class="card full"><h3>Payout Log</h3><table><tr><th>Date</th><th>Source</th><th>Gross</th><th>Protected</th><th>Reinvested</th><th>Operating</th></tr><tr><td colspan="6">Payout data will appear here when connected to orders and account rules.</td></tr></table></section></div>`;
}

function supportPage() {
  return `${sectionHero('Support Center', 'Use this page to guide members before they ask for help. It separates MT4, Discord desk, device, and sales issues.')}
  <div class="grid2"><section class="card"><h3>MT4 Not Connecting</h3><p>Check WebRequest URL, pairing code, API key, EA enabled, terminal connected, and reporter logs.</p><span class="tag">/connect-mt4</span><span class="tag">/account-status</span></section><section class="card"><h3>Desk Missing</h3><p>Run create-all dry run, rebuild solo desk, then rename desks from records. Use multi-category desk support for more than 50 members.</p><span class="tag">/desk-status</span><span class="tag">/create-all-desks</span></section><section class="card"><h3>Command Did Not Fire</h3><p>Check command polling endpoint, API key, pairing code, Magic Number filter, and EA global-variable reader.</p><span class="tag">/wisdo-review</span><span class="tag">Command queue</span></section><section class="card"><h3>Sales / Upgrade Help</h3><p>Use the sales page, minimum prices, and support notes before promising custom work.</p><span class="tag">Special upgrades</span><span class="tag">Quote first</span></section></div>`;
}

function settingsPage(config) {
  return `${sectionHero('Settings', 'Runtime status and environment guidance for the WISDO portal.')}
  <div class="grid2"><section class="card ${config.api.publicBaseUrl ? 'ok' : 'warn'}"><h3>Public Base URL</h3><div class="metric">${config.api.publicBaseUrl ? 'Set' : 'Missing'}</div><p>${esc(config.api.publicBaseUrl || 'Set PUBLIC_BASE_URL on Render so MT4 can reach the API.')}</p></section><section class="card"><h3>MT4 Sync Path</h3><div class="metric">${esc(config.api.mt4SyncPath || '/mt4-sync')}</div><p>Reporter posts snapshots here.</p></section><section class="card"><h3>Desk Category Base</h3><p>${esc(config.categoryName)}</p><p>WISDO can create numbered categories from this base when the server has more than 50 desks.</p></section><section class="card"><h3>Archive Category</h3><p>${esc(config.archiveCategoryName)}</p><p>Archived desks keep history and should not block active desk repair.</p></section></div>`;
}
function makeId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function makePairingCode() {
  return `CEM-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function hashSecret(value = '') {
  const text = String(value || '').trim();
  if (!text) return null;
  return crypto.createHash('sha256').update(text).digest('hex');
}

function maskSecret(value = '') {
  const text = String(value || '').trim();
  if (!text) return null;
  return text.length <= 4 ? '****' : `${text.slice(0, 2)}***${text.slice(-2)}`;
}

function normalizeTradeLinkBody(body = {}) {
  return {
    userId: String(body.userId || body.discordUserId || '').trim(),
    deskChannelId: String(body.deskChannelId || body.channelId || '').trim() || null,
    broker: String(body.broker || '').trim(),
    server: String(body.server || body.brokerServer || '').trim(),
    accountNumber: String(body.accountNumber || body.account || '').replace(/[^0-9]/g, ''),
    platform: String(body.platform || 'MT4').trim().toUpperCase(),
    accountType: String(body.accountType || 'Demo').trim(),
    nickname: String(body.nickname || '').trim(),
    investorPassword: String(body.investorPassword || body.readOnlyKey || '').trim(),
    referrerCode: String(body.referrerCode || '').trim(),
  };
}


function computeLeaderMetrics(connection = {}, snapshotRecord = {}, historyRows = []) {
  const s = snapshotRecord?.snapshot || connection || {};
  const balance = Number(s.balance || 0);
  const equity = Number(s.equity || balance || 0);
  const daily = Number(s.dailyClosedPL || s.closedPL || 0);
  const floating = Number(s.floatingPL || 0);
  const basis = Math.max(balance - daily, 1);
  const growth = clamp((daily / basis) * 100, -999, 999);
  const net = daily + floating;
  const harvest = clamp((Math.max(net, 0) / Math.max(equity * 0.08, 1)) * 100, 0, 100);
  const speed = clamp((Math.abs(daily) / Math.max(balance * 0.015, 1)) * 100, 0, 100);
  const kpi = clamp((Math.max(growth, 0) * 0.45) + (harvest * 0.35) + (clamp((s.marginLevel || 150) / 4, 0, 100) * 0.2), 0, 100);
  const topRank = clamp((Math.max(growth, 0) / 25) * 100, 0, 100);
  const progress = clamp((Math.max(equity - balance, 0) / Math.max(balance * 0.1, 1)) * 100, 0, 100);
  const rank = growth >= 20 ? 'Legend' : growth >= 10 ? 'Elite' : growth >= 5 ? 'Pro' : growth >= 1 ? 'Rising' : 'Starter';
  const history = historyRows.slice(0, 48).reverse().map((r) => ({
    t: new Date(r.receivedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    equity: Number(r.snapshot?.equity || 0),
    balance: Number(r.snapshot?.balance || 0),
  }));
  return { balance, equity, daily, floating, growth, harvest, speed, kpi, topRank, progress, rank, history };
}

function makeLeaderCard(leader) {
  const m = leader.metrics;
  const growthTone = m.growth >= 0 ? 'var(--green)' : 'var(--red)';
  const speedDeg = `${-90 + (clamp(m.speed, 0, 100) * 1.8)}deg`;
  return `<section class="card leader-card"><div class="leader-head"><div class="row"><div class="avatar">${esc((leader.ownerName || 'U').slice(0,1).toUpperCase())}</div><div><h3>${esc(leader.ownerName)}</h3><div class="muted">${esc(leader.accountNumber)} • ${esc(leader.server || 'Unknown server')}</div><div class="row"><span class="tag">${esc(leader.eaName || 'EA')}</span><span class="tag">${esc(leader.eaVersion || 'v pending')}</span><span class="tag">${esc(leader.accountType || 'Live')}</span><span class="tag">Rank ${esc(m.rank)}</span></div></div></div><div><div class="metric ${m.daily >= 0 ? 'green' : 'red'}">${pct(m.growth)}</div><div class="muted">daily growth</div></div></div><div class="gauge-wrap" style="margin-top:14px"><div class="gauge"><div class="ring" style="--val:${clamp(Math.abs(m.growth)*4,0,100)};--tone:${growthTone}"><span>${pct(m.growth)}</span></div><strong>Growth Gauge</strong><small>Daily performance</small></div><div class="gauge"><div class="ring" style="--val:${m.progress};--tone:var(--blue)"><span>${Math.round(m.progress)}%</span></div><strong>Progress Gauge</strong><small>Move to next target</small></div><div class="gauge"><div class="ring" style="--val:${m.topRank};--tone:var(--purple)"><span>${Math.round(m.topRank)}%</span></div><strong>Top Rank</strong><small>Progress to legend</small></div><div class="gauge"><div class="ring" style="--val:${m.kpi};--tone:var(--gold)"><span>${Math.round(m.kpi)}</span></div><strong>KPI Gauge</strong><small>Composite quality score</small></div><div class="gauge"><div class="ring" style="--val:${m.harvest};--tone:var(--green)"><span>${Math.round(m.harvest)}%</span></div><strong>Harvest Gauge</strong><small>Profit harvest readiness</small></div></div><div class="grid2" style="margin-top:16px"><div class="card" style="padding:14px"><h3>Live Tracker</h3><div class="metric">${money(m.equity)}</div><p>Balance ${money(m.balance)} • Daily closed ${money(m.daily)} • Floating ${money(m.floating)}</p><div class="progress-bar"><span style="width:${m.progress}%"></span></div><div class="row" style="margin-top:8px"><span class="tag">Open trades ${leader.openTrades}</span><span class="tag">Buys ${leader.buyTrades}</span><span class="tag">Sells ${leader.sellTrades}</span></div></div><div class="card" style="padding:14px"><h3>Growth Speedometer</h3><div class="speedometer"><div class="dial"></div><div class="needle" style="--deg:${speedDeg}"></div><div class="hub"></div><div class="label">${Math.round(m.speed)} / 100 speed</div></div></div></div><div class="row" style="margin-top:10px"><button class="btn primary invest-btn" data-leader='${JSON.stringify({ leaderUserId: leader.userId, leaderName: leader.ownerName, leaderAccountNumber: leader.accountNumber, leaderServer: leader.server, eaName: leader.eaName }).replace(/'/g, '&#39;')}'>Invest / Mirror</button><span class="tag gold">Open to connect</span><a class="btn ghost" href="/member/accounts/${encodeURIComponent(leader.userId)}/history?period=week">Historical Tracking</a><span class="tag">Last sync ${esc(leader.lastSyncAt || '')}</span></div></section>`;
}

function copyHubPage(model = {}, baseUrl = '') {
  const leaders = model.leaders || [];
  const liveRows = leaders.map((leader) => `<tr><td>${esc(leader.ownerName)}</td><td>${esc(leader.eaName || 'EA')}</td><td>${esc(leader.accountNumber)}</td><td>${money(leader.metrics.equity)}</td><td class="${leader.metrics.growth >= 0 ? 'green' : 'red'}">${pct(leader.metrics.growth)}</td><td>${leader.metrics.rank}</td><td><a class="btn ghost" href="/member/accounts/${encodeURIComponent(leader.userId)}/history?period=today">Live tracker</a></td></tr>`).join('');
  const posts = (model.feed || []).map((post) => `<div class="post"><div class="row" style="justify-content:space-between"><strong>${esc(post.author)}</strong><span class="muted">${esc(post.time)}</span></div><p style="margin:8px 0 6px">${esc(post.text)}</p><div class="row"><span class="tag">${esc(post.tag)}</span><span class="tag">${esc(post.metric)}</span></div></div>`).join('');
  const cards = leaders.map(makeLeaderCard).join('');
  const top = leaders[0];
  const chartLabels = JSON.stringify((top?.metrics.history || []).map((x) => x.t));
  const chartEquity = JSON.stringify((top?.metrics.history || []).map((x) => x.equity));
  const chartBalance = JSON.stringify((top?.metrics.history || []).map((x) => x.balance));
  return `${sectionHero('CEM Culture Relay Engine', 'Social-style copy trading lane with live leaderboards, account growth gauges, speedometer progress, historical tracking, and one-click invest / mirror setup.', '<a class="btn primary" href="#leaders">See live leaders</a><a class="btn" href="#invest-lane">Open invest lane</a>')}
  <div class="copy-grid"><div><section class="card full"><h3>Live EA Feed</h3><table><thead><tr><th>Trader</th><th>Running EA</th><th>Account</th><th>Equity</th><th>Growth</th><th>Rank</th><th></th></tr></thead><tbody>${liveRows || '<tr><td colspan="7">No connected leader accounts yet. Link MT4 accounts first.</td></tr>'}</tbody></table></section><section id="leaders" class="grid2" style="margin-top:16px">${cards || '<section class="card full"><h3>No leaders yet</h3><p>Once linked accounts are syncing, this section will show live EAs, growth gauges, and copy-ready invest actions.</p></section>'}</section><section class="card full" style="margin-top:16px"><h3>Historical Tracking</h3><p class="muted">Top leader balance and equity history. Use this section to judge consistency before mirroring.</p><canvas id="copyHubChart" class="spark"></canvas></section></div><aside id="invest-lane" class="sticky-card"><section class="card"><h3>Invest / Mirror Account</h3><p>Pick a live-performing account, click <strong>Invest / Mirror</strong>, then enter your follower account details. WISDO generates a pairing code for the follower account so the bridge can begin copy setup.</p><form id="investForm" class="grid" style="grid-template-columns:1fr"><input name="leaderUserId" placeholder="Leader User ID" required><input name="leaderName" placeholder="Leader Name" required><input name="leaderAccountNumber" placeholder="Leader Account Number" required><input name="leaderServer" placeholder="Leader Server" required><input name="userId" placeholder="Your Discord User ID" required><input name="broker" placeholder="Your Broker e.g. Coinexx"><input name="server" placeholder="Your Server e.g. Coinexx-Live" required><input name="accountNumber" placeholder="Your MT4 Account Number" required><select name="platform"><option>MT4</option><option>MT5</option></select><select name="accountType"><option>Demo</option><option>Live</option></select><input name="nickname" placeholder="Follower nickname"><input name="setupNote" placeholder="Setup note optional - no broker passwords"><input name="mirrorScale" type="number" step="0.01" placeholder="Mirror scale e.g. 1.00"><input name="maxDrawdownPct" type="number" step="0.1" placeholder="Max drawdown %"><button class="btn primary" type="submit">Start Copy Invest</button></form><pre id="investResult" style="white-space:pre-wrap;background:#06111d;border:1px solid rgba(255,255,255,.1);padding:14px;border-radius:14px;margin-top:14px;display:none"></pre><p class="disclaimer">Safe flow: WISDO stores a copy-link request and generates a follower pairing code. Paste that code into the follower MT4 Reporter / EA bridge. Live trade mirroring should only activate after the bridge confirms both leader and follower are verified.</p></section><section class="card social-feed" style="margin-top:16px"><h3>Culture Feed</h3>${posts || '<div class="post"><p>No live feed posts yet.</p></div>'}</section></aside></div><script src="https://cdn.jsdelivr.net/npm/chart.js"></script><script>
  const chartEl=document.getElementById('copyHubChart');
  if(chartEl){ new Chart(chartEl,{type:'line',data:{labels:${chartLabels},datasets:[{label:'Equity',data:${chartEquity},tension:.35,borderColor:'#46d17b'},{label:'Balance',data:${chartBalance},tension:.35,borderColor:'#f0aa2b'}]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{ticks:{color:'#9fb0c3'}},y:{ticks:{color:'#9fb0c3'}}},plugins:{legend:{labels:{color:'#fff'}}}}}); }
  document.querySelectorAll('.invest-btn').forEach(btn=>btn.addEventListener('click',()=>{const data=JSON.parse(btn.dataset.leader);for(const [k,v] of Object.entries(data)){ const input=document.querySelector('#investForm [name="'+k+'"]'); if(input) input.value=v || ''; } window.scrollTo({top:document.getElementById('invest-lane').offsetTop-20,behavior:'smooth'});}));
  document.getElementById('investForm')?.addEventListener('submit',async(e)=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target).entries());const out=document.getElementById('investResult');out.style.display='block';out.textContent='Creating live copy-invest bridge...';const res=await fetch('/api/copy-links',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const json=await res.json();out.textContent=json.ok?('Copy Link Status: '+json.copyLink.status+'\nFollower Pairing Code: '+json.copyLink.followerPairingCode+'\nLeader: '+json.copyLink.leaderName+' ('+json.copyLink.leaderAccountNumber+')'+'\nFollower: '+json.copyLink.followerAccountNumber+'\n\nPaste the follower pairing code into the follower MT4 Reporter / EA bridge to finish the mirror setup.'):('Error: '+(json.error||'Unknown error'));});
  setInterval(async()=>{try{const res=await fetch('/api/copy-hub');const json=await res.json();if(json.ok){/* future live refresh hook */}}catch(e){}},15000);
  </script>`;
}

function buildCopyHubModel(mt4 = {}) {
  const latest = mt4.latestSnapshots || {};
  const history = mt4.snapshotHistory || [];
  const leaders = Object.values(latest).map((record) => {
    const discordUserId = String(record.discordUserId || record.snapshot?.discordUserId || record.userId || '');
    const connection = mt4.connections?.[discordUserId] || {};
    const rows = history.filter((r) => String(r.discordUserId) === discordUserId).sort((a,b)=>new Date(a.receivedAt)-new Date(b.receivedAt));
    const snapshot = record.snapshot || {};
    const metrics = computeLeaderMetrics(connection, record, rows);
    return {
      userId: discordUserId,
      ownerName: connection.discordTag || connection.displayName || connection.discordUserId || `Trader ${discordUserId.slice(-4)}`,
      accountNumber: String(snapshot.accountNumber || connection.accountNumber || ''),
      server: snapshot.brokerServer || connection.brokerServer || '',
      accountType: snapshot.demoLive || connection.demoLive || 'Live',
      eaName: snapshot.eaName || connection.eaName || 'EA',
      eaVersion: snapshot.eaVersion || connection.eaVersion || '',
      openTrades: snapshot.openTradeCount || connection.openTradeCount || 0,
      buyTrades: snapshot.buyTradeCount || connection.buyTradeCount || 0,
      sellTrades: snapshot.sellTradeCount || connection.sellTradeCount || 0,
      lastSyncAt: record.receivedAt || connection.lastSyncAt || '',
      metrics,
    };
  }).filter((x)=>x.userId && x.accountNumber).sort((a,b)=>b.metrics.growth-a.metrics.growth);
  const feed = leaders.slice(0,6).map((leader, idx) => ({
    author: leader.ownerName,
    time: leader.lastSyncAt ? new Date(leader.lastSyncAt).toLocaleString() : 'just now',
    text: leader.metrics.growth >= 0 ? `${leader.eaName} is pressing higher with ${pct(leader.metrics.growth)} daily growth on account ${leader.accountNumber}. Equity now ${money(leader.metrics.equity)}.` : `${leader.eaName} is cooling off. Current growth is ${pct(leader.metrics.growth)} and the account is being watched for a cleaner recovery setup.`,
    tag: idx === 0 ? 'Trending leader' : 'Live update',
    metric: `Harvest ${Math.round(leader.metrics.harvest)}%`,
  }));
  return { leaders, feed, createdAt: new Date().toISOString() };
}

function tradeLinkStatusBadge(status) {
  const s = String(status || 'PENDING').toUpperCase();
  const klass = s === 'CONNECTED' ? 'green' : s === 'REVOKED' || s === 'ERROR' ? 'red' : 'gold';
  return `<span class="tag ${klass}">${esc(s)}</span>`;
}

function linkedAccountsTable(links = []) {
  const rows = links.map((l) => `<tr><td>${esc(l.nickname || l.accountNumber || 'Account')}</td><td>${esc(l.accountNumber || '')}</td><td>${esc(l.server || l.brokerServer || '')}</td><td>${esc(l.platform || 'MT4')}</td><td>${tradeLinkStatusBadge(l.status)}</td><td><code>${esc(l.pairingCode || '')}</code></td><td>${esc(l.lastSyncAt || l.createdAt || '')}</td></tr>`).join('');
  return `<table><thead><tr><th>Name</th><th>Account</th><th>Server</th><th>Platform</th><th>Status</th><th>Pairing Code</th><th>Last Update</th></tr></thead><tbody>${rows || '<tr><td colspan="7">No trade links yet.</td></tr>'}</tbody></table>`;
}

function tradeLinkPage(baseUrl) {
  return `${sectionHero('Trade Link', 'Connect an MT4/MT5 account to WISDO the safe way. Create a pairing code here, then paste it into the CultureCoin MT4 Reporter or EA bridge.', '<a class="btn primary" href="/member/accounts">View Accounts</a>')}
  <div class="grid2"><section class="card warn"><h3>Credential Safety</h3><p>Do not submit your broker master password. Use an investor/read-only password for tracking when available. For automation, use the approved WISDO MT4 Reporter/EA bridge.</p><span class="tag">No master password</span><span class="tag">User-controlled terminal</span></section><section class="card"><h3>How It Works</h3><p>1) Enter account identity. 2) WISDO creates a pairing code. 3) Paste the code into MT4 Reporter. 4) First valid sync marks the link connected.</p><span class="tag">CEM code</span><span class="tag">Reporter sync</span></section><section class="card full"><h3>Create Trade Link</h3><form id="tradeLinkForm" class="grid3"><input name="userId" placeholder="Discord User ID" required><input name="broker" placeholder="Broker e.g. Coinexx"><input name="server" placeholder="Server e.g. Coinexx-Demo" required><input name="accountNumber" placeholder="MT4 Account Number" required><select name="platform"><option>MT4</option><option>MT5</option></select><select name="accountType"><option>Demo</option><option>Live</option></select><input name="nickname" placeholder="Nickname e.g. D.Fountain Demo"><input name="setupNote" placeholder="Setup note optional - no broker passwords"><input name="referrerCode" placeholder="Referral code optional"><button class="btn primary" type="submit">Generate Pairing Code</button></form><pre id="tradeLinkResult" style="white-space:pre-wrap;background:#06111d;border:1px solid rgba(255,255,255,.1);padding:14px;border-radius:14px;margin-top:14px;display:none"></pre></section></div><script>document.getElementById('tradeLinkForm').addEventListener('submit',async(e)=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target).entries());const out=document.getElementById('tradeLinkResult');out.style.display='block';out.textContent='Creating live pending account + pairing code...';const res=await fetch('/api/trade-link/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const json=await res.json();out.textContent=json.ok?'Pairing Code: '+json.pairingCode+'\nStatus: '+json.link.status+'\n\nPaste this pairing code into MT4 Reporter.':('Error: '+(json.error||'Unknown error'));});</script>`;
}

function walletPage() {
  return `${sectionHero('Commission Wallet', 'Track commissions from upgrades, bot sales, device setup, VPS services, copy access, and partner referrals.')}
  <div class="grid3"><section class="card"><h3>Total Earned</h3><div class="metric green">$0.00</div><p>Live ledger will calculate this from approved orders.</p></section><section class="card"><h3>Pending</h3><div class="metric gold">$0.00</div><p>Pending commissions wait for approval, delivery, or chargeback window.</p></section><section class="card"><h3>Available</h3><div class="metric blue">$0.00</div><p>Available balance is ready for payout.</p></section><section class="card full"><h3>Commission Ledger</h3><table><tr><th>Date</th><th>Customer</th><th>Product</th><th>Sale</th><th>Commission</th><th>Status</th></tr><tr><td colspan="6">No commission records yet.</td></tr></table></section></div>`;
}

function referralsPage(baseUrl) {
  const sample = 'CEM-DFOUNTAIN';
  return `${sectionHero('Referral / Seller Desk', 'Every CultureCoin member can use a referral code to sell approved upgrades, bots, and setup services.', '<a class="btn primary" href="/join/CEM-DFOUNTAIN">Sample Join Page</a>')}<div class="grid2"><section class="card"><h3>Your Referral Code</h3><div class="metric">${sample}</div><p>Use this format for members: CEM-NAME. The order system can attach commission to the seller code.</p></section><section class="card"><h3>Join Link</h3><p><code>${esc(baseUrl)}/join/${sample}</code></p><span class="tag">Seller tracking</span><span class="tag">Upgrade sales</span></section><section class="card full"><h3>Referral Pipeline</h3><table><tr><th>Lead</th><th>Product</th><th>Status</th><th>Commission</th></tr><tr><td colspan="4">No referral leads yet.</td></tr></table></section></div>`;
}

function storeFrontPage() {
  const rows = SPECIAL_UPGRADES.map((u)=>`<tr><td>${esc(u.name)}</td><td>${money(u.minPrice)}</td><td>${money(u.retail)}</td><td><a class="btn" href="/member/upgrades">Details</a></td></tr>`).join('');
  return `${sectionHero('CultureCoin Store', 'Approved products, upgrades, bot access, and setup services. Sellers may charge above the minimum when they add value.') }<section class="card full"><table><thead><tr><th>Product</th><th>Minimum</th><th>Retail</th><th></th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function leaderboardPage() {
  return `${sectionHero('Seller Leaderboard', 'Rank members by approved sales, active linked accounts, support quality, and payout history.') }<div class="grid3"><section class="card"><h3>Top Seller</h3><div class="metric">Awaiting Orders</div><p>Connect orders to activate.</p></section><section class="card"><h3>Linked Accounts</h3><div class="metric">Live</div><p>Accounts count updates through trade links.</p></section><section class="card"><h3>Coach Score</h3><div class="metric">Data Ready</div><p>Quality and discipline score reads from reviews, tickets, and connected-account behavior when records exist.</p></section></div>`;
}


const PLATFORM_PRODUCTS = [
  ...EA_CATALOG.map((bot) => ({
    type: 'bot',
    name: bot.name,
    slug: slugify(bot.name),
    priceMonthly: bot.monthlyPrice || 97,
    priceLifetime: bot.lifetimePrice || bot.retail || 497,
    minimumResalePrice: bot.minPrice || 197,
    maximumSuggestedPrice: bot.retail || 997,
    commissionRate: 0.25,
    active: true,
  })),
  { type: 'video_review', name: 'Extra WISDO Film Room Review', slug: 'extra-film-room-review', priceMonthly: 0, priceLifetime: 25, minimumResalePrice: 25, maximumSuggestedPrice: 75, commissionRate: 0.15, active: true },
  { type: 'coaching', name: 'Priority Coaching Call', slug: 'priority-coaching-call', priceMonthly: 0, priceLifetime: 150, minimumResalePrice: 150, maximumSuggestedPrice: 300, commissionRate: 0.15, active: true },
  { type: 'membership', name: 'CultureCoin Operator Membership', slug: 'operator-membership', priceMonthly: 97, priceLifetime: 997, minimumResalePrice: 97, maximumSuggestedPrice: 199, commissionRate: 0.25, active: true },
];

function riskDisclosureBlock() {
  return `<section class="card warn full"><h3>Risk Disclosure</h3><p>Trading involves risk. Past performance does not guarantee future results. Copy trading, bots, and signals can result in losses. Users are responsible for their own trading decisions, risk settings, and account management.</p></section>`;
}

function publicHomePage() {
  const botPreview = EA_CATALOG.slice(0, 4).map((bot) => `<section class="card"><h3>${bot.recommended ? '⭐ ' : ''}${esc(bot.name)}</h3><p>${esc(bot.description || 'CultureCoin approved EA for MT4/MT5 workflows.')}</p><div class="price">${money(botPrice(bot, { store: { basePriceUsd: 497 } }))}</div><a class="btn primary" href="/member/bots">View Bot</a><a class="btn" href="/pricing">Pricing</a></section>`).join('');
  return `${sectionHero('Scroll the market. Copy the move. Let WISDO protect your account.', 'CultureCoin is a social copy trading platform built for bots, signals, live account tracking, AI-powered trading coaching, Discord desks, and MT4 account linking.', '<a class="btn primary" href="/member/command-center">Open Member Portal</a><a class="btn" href="/join/CEM-PUBLIC">Join CultureCoin</a><a class="btn" href="/member/link-account">Connect MT4</a><a class="btn" href="/results">View Public Results</a>')}
  <section class="card full" style="margin-bottom:16px"><div class="row" style="justify-content:space-between;align-items:center"><div><span class="tag gold">Wisdo Member Portal</span><h2 style="margin:10px 0 6px">Enter Wisdo Command Center</h2><p class="sub" style="margin:0">Connect. Copy. Control.</p></div><div class="row"><a class="btn primary" href="/member/command-center">Open Member Portal</a><a class="btn" href="/member/education">View Education</a></div></div></section>
  <div class="grid3"><section class="card"><h3>1. Connect</h3><p>Generate a pairing code, install the Reporter, enable WebRequest, and verify your live or demo account.</p></section><section class="card"><h3>2. Scroll</h3><p>Watch trading posts, bot results, WISDO notes, signal recaps, and student reviews in a social feed.</p></section><section class="card"><h3>3. Copy Safely</h3><p>Use copy controls, risk caps, WISDO protection, and emergency stop logic before mirroring any trader.</p></section></div>
  <section class="card full" style="margin-top:16px"><h3>Bot Marketplace Preview</h3><div class="grid3">${botPreview}</div></section>
  <div class="grid2" style="margin-top:16px"><section class="card"><h3>WISDO Protection</h3><p>Pause bot, close profits, harvest, buy-only, sell-only, reduce risk, set daily goal, and stop trading today from one command center.</p><span class="tag">AI coach</span><span class="tag">MT4 global variables</span><span class="tag">Audit trail</span></section><section class="card"><h3>WISDO Film Room</h3><p>Students can submit long trading videos through Telegram, Discord, website upload, Drive, YouTube, Loom, or Dropbox for timestamp coaching.</p><span class="tag">Video reviews</span><span class="tag">Coach notes</span><span class="tag">Trade matching</span></section></div>${riskDisclosureBlock()}`;
}

function memberPortalPreviewPage(req, access = {}) {
  const loginHref = `/auth/discord?returnTo=${encodeURIComponent('/member/command-center')}`;
  const adminLink = canAccessAdmin(access) ? '<a class="btn" href="/member/admin-wisdo">Admin Wisdo</a>' : '';
  return `${sectionHero('Enter Wisdo Command Center', 'Connect. Copy. Control. The member portal brings command center, education, simulator, social trading, and signal grid into one Wisdo operator lane.', `<a class="btn primary" href="/member/command-center">Open Member Portal</a><a class="btn" href="/member/education">View Education</a><a class="btn ghost" href="${loginHref}">Login with Discord</a>${adminLink}`)}
  <section class="card full"><h3>Member Portal</h3><p class="muted">Log in to load your Discord identity and private account data. Visitors still get a clear preview instead of a blank or legacy route.</p><div class="row"><a class="btn primary" href="/member/command-center">Command Center</a><a class="btn" href="/member/education">Education</a><a class="btn" href="/member/simulator">Simulator</a><a class="btn" href="/member/social">Social</a><a class="btn" href="/member/signal-grid">Signal Grid</a></div></section>
  <div class="grid3" style="margin-top:16px"><section class="card"><h3>Command Center</h3><p>Account switching, safe MT4 commands, copy controls, marketplace, and role sync live here.</p></section><section class="card"><h3>Education</h3><p>Bot-specific learning paths, simulations, and readiness checks keep operators prepared before scaling risk.</p></section><section class="card"><h3>Signal Grid</h3><p>No-spam basket visibility with controlled copy actions and role-aware access.</p></section></div>${riskDisclosureBlock()}`;
}

function connectionOnboardingPage() {
  return `${sectionHero('Unlock the Trading Social App', 'Connect MT4, Discord, or Telegram to unlock Feed, Copier Engine, live dashboard, WISDO commands, and Film Room reviews.', '<a class="btn primary" href="/member/link-account">Generate Pairing Code</a><a class="btn" href="/downloads/CultureCoin_MT4_Reporter_Package.zip">Download MT4 Reporter</a>')}
  <div class="grid3"><section class="card"><h3>1. Pair MT4</h3><p>Create a pairing code and paste it into CultureCoin MT4 Reporter.</p></section><section class="card"><h3>2. Enable WebRequest</h3><p>Allow your Render URL in MT4 WebRequest settings so snapshots can sync.</p></section><section class="card"><h3>3. Choose Visibility</h3><p>Private, stats-only, show in Copier Engine, copy after approval, copy after 100% growth, or signal-only.</p></section><section class="card full"><h3>Locked Preview</h3><p>Culture Feed, Copier Engine, WISDO Control Center, and Film Room unlock after connection.</p><span class="tag">Feed locked</span><span class="tag">Copy locked</span><span class="tag">Reviews locked</span></section></div>`;
}


function feedStorePaths() {
  const base = path.join(process.env.WISDO_STORAGE_PATH || process.env.DATA_DIR || path.join(process.cwd(), 'data', 'operator-desks'), 'uploads', 'feed');
  return { base, media: path.join(base, 'media'), index: path.join(base, 'feed-posts.json') };
}

async function loadFeedPosts() {
  const paths = feedStorePaths();
  try {
    const raw = await fs.readFile(paths.index, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.posts) ? parsed.posts : [];
  } catch {
    return [];
  }
}

async function saveFeedPosts(posts) {
  const paths = feedStorePaths();
  await fs.mkdir(paths.base, { recursive: true });
  await fs.writeFile(paths.index, JSON.stringify({ posts: posts.slice(0, 500) }, null, 2));
}

function feedUploadPage() {
  return `${sectionHero('Upload to Culture Feed', 'Post a trading video, bot result, chart recap, WISDO review, or educational clip so other members can scroll and watch.', '<a class="btn" href="/member/feed">View Feed</a>')}
  <section class="card full"><h3>Create Video Post</h3><p class="muted">Upload MP4, MOV, or WEBM. For large long-form reviews, use WISDO Film Room or a Drive/Loom/YouTube link.</p><form id="feedUploadForm" class="grid3"><input name="trader" placeholder="Trader username" required><input name="caption" placeholder="Caption" required><input name="bot" placeholder="Bot used e.g. DF SAUCE FINAL AI"><input name="symbol" placeholder="Symbol e.g. XAUUSD"><input name="growthPercent" placeholder="Growth % e.g. 12.5"><select name="riskLevel"><option>Safe</option><option>Moderate</option><option>Aggressive</option><option>High Risk</option></select><textarea name="wisdoNote" placeholder="WISDO note" style="grid-column:1/-1;min-height:90px"></textarea><input id="videoFile" type="file" accept="video/mp4,video/webm,video/quicktime" required><button class="btn primary" type="submit">Upload Video Post</button></form><pre id="uploadResult" style="white-space:pre-wrap;background:#06111d;border:1px solid rgba(255,255,255,.1);padding:14px;border-radius:14px;margin-top:14px;display:none"></pre></section><script>
  document.getElementById('feedUploadForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const out=document.getElementById('uploadResult');
    const file=document.getElementById('videoFile').files[0];
    out.style.display='block';
    if(!file){out.textContent='Choose a video first.';return;}
    if(file.size>120*1024*1024){out.textContent='This video is too large for direct upload right now. Use a smaller file under 120MB or send a Drive/Loom/YouTube link.';return;}
    out.textContent='Reading video...';
    const data=Object.fromEntries(new FormData(e.target).entries());
    const reader=new FileReader();
    reader.onload=async()=>{
      out.textContent='Uploading video...';
      const res=await fetch('/api/feed/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,fileName:file.name,mimeType:file.type,videoDataUrl:reader.result})});
      const json=await res.json();
      out.textContent=json.ok?'Posted to Culture Feed: '+json.post.mediaUrl+'\nOpen /member/feed to view it.':'Upload failed: '+(json.error||'Unknown error');
    };
    reader.onerror=()=>{out.textContent='Could not read video file.'};
    reader.readAsDataURL(file);
  });
</script>`;
}

function renderCultureFeed(posts = []) {
  const fallback = [
    { trader: 'D.Fountain', bot: 'DF SAUCE FINAL AI', symbol: 'XAUUSD', type: 'Bot performance post', growthPercent: '+12.40%', wisdoNote: 'WISDO note: protect gains and avoid late laddering.', caption: 'DF Sauce live result preview', mediaUrl: null },
    { trader: 'WISDO Film Room', bot: 'Review', symbol: 'Student clip', type: 'Student clip', growthPercent: 'Coach Ready', wisdoNote: 'Timestamp notes can turn mistakes into assignments.', caption: 'Film Room preview', mediaUrl: null },
  ];
  const feedPosts = posts.length ? posts : fallback;
  return feedPosts.map((post) => `<section class="card" style="min-height:620px;display:flex;flex-direction:column;justify-content:flex-end;position:relative;overflow:hidden">${post.mediaUrl ? `<video src="${esc(post.mediaUrl)}" controls playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.72"></video><div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.1),rgba(0,0,0,.72))"></div>` : ''}<div style="position:relative;z-index:2"><div class="tag">${esc(post.type || 'Video post')}</div><h2>${esc(post.trader || 'CultureCoin Trader')}</h2><p>${esc(post.caption || '')}</p><p>${esc(post.bot || 'Bot')} • ${esc(post.symbol || 'Market')} • ${esc(post.growthPercent || '0%')}</p><p>${esc(post.wisdoNote || '')}</p><div class="row"><a class="btn primary" href="/member/link-account">Copy Setup</a><a class="btn" href="/member/bots">View Bot</a><a class="btn" href="/member/copy-pro">Copy</a><a class="btn" href="/member/wisdo">Ask WISDO</a></div></div></section>`).join('');
}

async function cultureFeedPage() {
  const posts = await loadFeedPosts();
  return `${sectionHero('Culture Feed', 'TikTok-style trading feed for connected users: uploads, bot posts, chart posts, signal alerts, win recaps, education clips, WISDO reviews, and trader replays.', '<a class="btn primary" href="/member/upload">Upload Video</a><a class="btn" href="/member/link-account">Connect Account</a>')}
  <section class="card full"><div class="row"><span class="tag">For You</span><span class="tag">Following</span><span class="tag">Live Now</span><span class="tag">Top Growth</span><span class="tag">Low Drawdown</span><span class="tag">Gold Only</span><span class="tag">Bot Battles</span><span class="tag">Education</span><span class="tag">Student Reviews</span></div></section>
  <div class="grid3" style="margin-top:16px">${renderCultureFeed(posts)}</div>${riskDisclosureBlock()}`;
}


function legacyWisdoCommandIntent(action = '', rawText = '') {
  const phrase = `${action} ${rawText}`.toLowerCase();
  const globals = {};
  const basePayload = { immediate: true, priority: 130, ttlMinutes: 5, source: 'legacy_member_wisdo' };
  if (phrase.includes('close') && (phrase.includes('profit') || phrase.includes('green'))) return { command: 'CLOSE_ALL_PROFITS', payload: basePayload };
  if (phrase.includes('close all') || phrase.includes('emergency')) return { command: 'CLOSE_ALL_TRADES', payload: { ...basePayload, priority: 200 } };
  if (phrase.includes('loser') || phrase.includes('loss') || phrase.includes('cut losses')) return { command: 'CLOSE_ALL_LOSERS', payload: basePayload };
  if (phrase.includes('harvest 25')) return { command: 'HARVEST_PROFIT', payload: { ...basePayload, harvestPercent: 25 } };
  if (phrase.includes('harvest 50') || phrase.includes('take 50')) return { command: 'HARVEST_PROFIT', payload: { ...basePayload, harvestPercent: 50 } };
  if (phrase.includes('harvest 100') || phrase.includes('take 100')) return { command: 'HARVEST_PROFIT', payload: { ...basePayload, harvestPercent: 100 } };
  if (phrase.includes('pause bot')) globals['CEM.WISDO.GLOBAL.0.BotPaused'] = 1;
  if (phrase.includes('resume bot')) globals['CEM.WISDO.GLOBAL.0.BotPaused'] = 0;
  if (phrase.includes('buy only')) globals['CEM.WISDO.GLOBAL.0.DirectionMode'] = 1;
  if (phrase.includes('sell only')) globals['CEM.WISDO.GLOBAL.0.DirectionMode'] = 2;
  if (phrase.includes('allow hedge')) globals['CEM.WISDO.GLOBAL.0.HedgeAllowed'] = 1;
  if (phrase.includes('block hedge')) globals['CEM.WISDO.GLOBAL.0.HedgeAllowed'] = 0;
  if (phrase.includes('reduce risk')) globals['CEM.WISDO.GLOBAL.0.RiskShift'] = -1;
  if (phrase.includes('increase risk')) globals['CEM.WISDO.GLOBAL.0.RiskShift'] = 1;
  if (phrase.includes('protect') || phrase.includes('walk away')) globals['CEM.WISDO.GLOBAL.0.ProtectMode'] = 1;
  if (phrase.includes('stop trading')) globals['CEM.WISDO.GLOBAL.0.TradingPaused'] = 1;
  if (phrase.includes('allow another anchor')) globals['CEM.WISDO.GLOBAL.0.AllowAnotherAnchor'] = 1;
  if (phrase.includes('limit ladder')) globals['CEM.WISDO.GLOBAL.0.LimitLadderEntries'] = 1;
  if (phrase.includes('max drawdown')) globals['CEM.WISDO.GLOBAL.0.MaxDrawdownPrompt'] = 1;
  if (phrase.includes('daily goal')) globals['CEM.WISDO.GLOBAL.0.DailyGoalPrompt'] = 1;
  if (Object.keys(globals).length) return { command: 'CEM_SET_GLOBALS', payload: { ...basePayload, globals } };
  return { command: 'WISDO_TEXT_COMMAND', payload: basePayload };
}

function wisdoControlPage(query = {}) {
  const userId = String(query.userId || '').trim();
  const accountId = String(query.accountId || '').trim();
  const controls = ['Pause Bot','Resume Bot','Close Profits','Close All','Cut Losses','Harvest 25%','Harvest 50%','Harvest 100%','Buy Only','Sell Only','Allow Hedge','Block Hedge','Reduce Risk','Increase Risk','Protect My Account','Stop Trading Today','Allow Another Anchor','Limit Ladder Entries','Set Max Drawdown','Set Daily Goal'];
  return `${sectionHero('WISDO Control Center', 'Control connected accounts through safe queued commands and natural language instructions. Every button below posts to /api/wisdo/command and is delivered through the MT4 Reporter command queue.', '<a class="btn primary" href="/member/link-account">Connect Account</a><a class="btn" href="/member/mt4-webrequest-guide">MT4 Reporter Guide</a>')}
  <section class="card full"><h3>Command Identity</h3><div class="grid3"><input id="wisdoUserId" value="${esc(userId)}" placeholder="Discord / website user ID required"><input id="wisdoAccountId" value="${esc(accountId)}" placeholder="Account ID optional"><a class="btn" href="/member/link-account${userId ? `?userId=${encodeURIComponent(userId)}` : ''}">Generate / refresh pairing code</a></div><p class="disclaimer">If a user ID is missing, the button returns a clear setup warning instead of silently doing nothing.</p></section>
  <section class="card full"><h3>Command Buttons</h3><div class="grid4">${controls.map((c)=>`<button type="button" class="btn wisdo-command-btn" data-action="${esc(c)}">${esc(c)}</button>`).join('')}</div></section>
  <section class="card full"><h3>Tell WISDO what to do...</h3><textarea id="wisdoRawText" style="width:100%;min-height:110px" placeholder="Protect my account while I’m away. Take 50% of profits when equity grows 100%. Allow sells only. Close all profitable trades."></textarea><br/><button type="button" id="wisdoQueueButton" class="btn primary">Queue WISDO Command</button><pre id="wisdoCommandOut" class="checkout-result" style="white-space:pre-wrap;display:none"></pre><p class="disclaimer">Command payload stores commandId, userId, accountId, rawText, parsed intent, priority, status, createdAt, delivery state, and completion result.</p></section><script>
  async function sendLegacyWisdo(action, rawText){
    const out=document.getElementById('wisdoCommandOut');
    const userId=document.getElementById('wisdoUserId').value.trim();
    const accountId=document.getElementById('wisdoAccountId').value.trim();
    out.style.display='block';
    if(!userId){ out.textContent='Missing user ID. Open Connect Account, pair Discord/website, or paste the Discord user ID here.'; return; }
    out.textContent='Queueing command...';
    const res=await fetch('/api/wisdo/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,accountId,action,rawCommand:rawText})});
    const json=await res.json().catch(()=>({ok:false,error:'Invalid JSON response'}));
    out.textContent=json.ok?('Queued: '+json.command.command+'\nCommand ID: '+json.command.id+'\nStatus: '+json.command.status+'\nMT4 Reporter will execute on next poll.'):('Command failed: '+(json.error||'Unknown error'));
  }
  document.querySelectorAll('.wisdo-command-btn').forEach((btn)=>btn.addEventListener('click',()=>sendLegacyWisdo(btn.dataset.action,'')));
  document.getElementById('wisdoQueueButton')?.addEventListener('click',()=>sendLegacyWisdo('natural_text',document.getElementById('wisdoRawText').value));
</script>`;
}

function filmRoomPage() {
  return `${sectionHero('WISDO Film Room', 'Long-video student review system for Telegram, website uploads, Discord desks, Drive, YouTube, Loom, and Dropbox links.', '<a class="btn primary" href="/member/reviews/new">Submit Review</a><a class="btn" href="/member/reviews/queue">Review Queue</a>')}
  <div class="grid3"><section class="card"><h3>Free Member</h3><p>1 short video review per month. Max 5 minutes.</p></section><section class="card"><h3>Culture Member</h3><p>2 reviews per month. Max 15 minutes.</p></section><section class="card"><h3>Operator</h3><p>4 reviews per month. Max 45 minutes.</p></section><section class="card"><h3>Extra Review</h3><div class="metric">$25</div><a class="btn primary" href="/pricing?product=extra-film-room-review">Buy Credit</a></section><section class="card"><h3>Priority Review</h3><div class="metric">$75</div><a class="btn primary" href="/pricing?product=extra-film-room-review&priority=1">Buy Priority</a></section><section class="card"><h3>Live Coaching Call</h3><div class="metric">$150</div><a class="btn primary" href="/member/support?type=coaching-call">Book Call</a></section></div>
  <section class="card full"><h3>Review Queue</h3><table><tr><th>Student</th><th>Video Length</th><th>Source</th><th>Bot Used</th><th>Account Connected</th><th>Status</th><th>Priority</th><th>Coach</th></tr><tr><td colspan="8">Review tickets will appear here after Telegram/web uploads are connected.</td></tr></table></section>`;
}

function adminPanelPage() {
  const items = [
    ['Command Health', 'MT4 Reporter health, command bridge status, OAuth setup, and WebRequest URLs.', '/admin/health'],
    ['Member Ecosystem', 'Users, linked accounts, desk activity, signals, and operator state.', '/admin/ecosystem'],
    ['Commerce', 'Orders, bot licenses, checkout records, subscriptions, and product grants.', '/admin/commerce'],
    ['Finance', 'Payouts, commission wallet, subscriptions, VPS records, and payment-plan status.', '/admin/finance'],
    ['Paid Link Access', 'Paid profile links, copy access products, grants, and access status.', '/admin/link-access'],
    ['VPS Desk', 'VPS setup requests, assigned bots, account mapping, and setup status.', '/admin/vps'],
  ];
  return `${sectionHero('Admin Control Panel', 'Operator controls for users, accounts, bot store, copy approvals, reviews, desks, commands, orders, and risk alerts.')}
  <div class="grid3">${items.map(([item, desc, href])=>`<section class="card"><h3>${esc(item)}</h3><p>${esc(desc)}</p><a class="btn" href="${esc(href)}">Open</a></section>`).join('')}</div>`;
}

function publicPricingPage() {
  const checkoutHref = (product) => product.type === 'bot' ? `/member/bots/${encodeURIComponent(product.slug)}` : product.type === 'membership' ? '/member/billing' : product.type === 'coaching' ? '/member/support?type=coaching-call' : `/pricing?product=${encodeURIComponent(product.slug)}`;
  return `${sectionHero('Pricing', 'Bots, memberships, video reviews, coaching, VPS, devices, and signal access.', '<a class="btn primary" href="/member/bots">Buy Bots</a>')}
  <section class="card full"><table><thead><tr><th>Product</th><th>Type</th><th>Monthly</th><th>Lifetime / One-Time</th><th>Commission</th><th></th></tr></thead><tbody>${PLATFORM_PRODUCTS.map((p)=>`<tr><td>${esc(p.name)}</td><td>${esc(p.type)}</td><td>${p.priceMonthly ? money(p.priceMonthly) : '-'}</td><td>${money(p.priceLifetime)}</td><td>${Math.round(p.commissionRate*100)}%</td><td><a class="btn primary" href="${esc(checkoutHref(p))}">Checkout</a></td></tr>`).join('')}</tbody></table></section>${riskDisclosureBlock()}`;
}

function botDetailPage(slug, config) {
  const bot = EA_CATALOG.find((item) => slugify(item.name) === slug) || EA_CATALOG[0];
  const price = botPrice(bot, config);
  return `${sectionHero(bot.name, bot.description || 'CultureCoin approved trading bot.', '<a class="btn primary" href="/member/install/'+slugify(bot.name)+'">Setup Free</a><a class="btn" href="#checkout">Checkout</a><a class="btn" href="/member/link-account?selectedBot='+encodeURIComponent(bot.name)+'">Link MT4</a><a class="btn" href="/member/copy-pro?bot='+encodeURIComponent(bot.name)+'">Copy Live Account Running This Bot</a>')}
  <div class="grid2"><section class="card"><h3>Strategy</h3><p>${esc(bot.strategy || 'EA strategy details, setup guide, and risk notes.')}</p><span class="tag">${esc(bot.bestMarket || 'XAUUSD')}</span><span class="tag">${esc(bot.platform || 'MT4')}</span><span class="tag">WISDO Compatible</span><span class="tag">${esc(bot.category)}</span><span class="tag">${esc(bot.tier || bot.status)}</span></section><section class="card"><h3>Marketplace Price</h3><div class="metric">${price > 0 ? money(price) : 'Free Utility'}</div><p>${price > 0 ? 'Checkout creates a bot purchase quote and opens Square hosted checkout when Square is configured.' : 'Utility is part of the connection/support stack.'}</p><p class="muted">Delivery file after purchase: ${esc(bot.file || '')}</p></section></div>
  <section class="card full"><h3>Bot Details</h3><p>${esc(bot.risk)}</p>${(bot.tags || []).map((x)=>`<span class="tag">${esc(x)}</span>`).join('')}<div style="margin-top:12px"><span class="tag">Overview</span><span class="tag">Strategy Explanation</span><span class="tag">Performance Chart</span><span class="tag">Risk Notes</span><span class="tag">Setup Instructions</span><span class="tag">Compatible Commands</span><span class="tag">User Reviews</span><span class="tag">Download After Purchase</span></div></section>
  <section id="checkout" class="card full"><h3>Checkout Options</h3><p class="muted">Choose how to access this bot. Payment plans and rentals use CultureCoin VPS until ownership is complete.</p><div class="grid3"><section class="card ok"><h3>Pay in Full</h3><div class="metric">${money(price)}</div><p>Lifetime access. Download unlocks immediately after payment clears.</p><button class="btn primary finance-checkout" data-plan="paid_in_full" data-bot="${esc(bot.name)}" data-price="${price}" data-slug="${slugify(bot.name)}">Pay in Full</button></section><section class="card"><h3>Pay Monthly Until Owned</h3><div class="metric">${money(Math.ceil(price/6))}/mo</div><p>6-month plan. VPS required until paid in full. Download unlocks after final payment.</p><button class="btn primary finance-checkout" data-plan="payment_plan" data-bot="${esc(bot.name)}" data-price="${price}" data-slug="${slugify(bot.name)}">Start Payment Plan</button></section><section class="card"><h3>Rent Monthly</h3><div class="metric">${money(bot.recommended ? 497 : Math.max(97, Math.round(price*.16)))}/mo</div><p>VPS-only access. Download remains locked while renting.</p><button class="btn primary finance-checkout" data-plan="rental" data-bot="${esc(bot.name)}" data-price="${price}" data-slug="${slugify(bot.name)}">Rent Monthly</button></section><section class="card bot-banner full"><h3>VPS Bundle</h3><div class="metric">${money(bot.recommended ? 597 : Math.max(147, Math.round(price*.2)))}/mo</div><p>Bot access + Operator VPS + monitoring support. Best for monthly users and copy trading.</p><button class="btn primary finance-checkout" data-plan="vps_bundle" data-bot="${esc(bot.name)}" data-price="${price}" data-slug="${slugify(bot.name)}">Bundle with VPS</button></section></div><pre id="checkout-${slugify(bot.name)}" style="display:none;white-space:pre-wrap;background:#06111d;border:1px solid rgba(255,255,255,.1);padding:12px;border-radius:12px"></pre></section>${riskDisclosureBlock()}<script>document.querySelectorAll('.finance-checkout').forEach(btn=>btn.addEventListener('click',async()=>{const slug=btn.dataset.slug;const out=document.getElementById('checkout-'+slug);out.style.display='block';out.textContent='Creating '+btn.dataset.plan+' checkout...';const res=await fetch('/api/bots/'+slug+'/checkout-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botName:btn.dataset.bot,planType:btn.dataset.plan,priceUsd:Number(btn.dataset.price||0)})});const json=await res.json();out.textContent=json.ok?('Plan created: '+json.planType+' for '+json.productName+'\nStatus: '+json.status+(json.checkoutUrl?'\nOpen: '+json.checkoutUrl:'\nManual/dev mode record created.')):('Checkout error: '+(json.error||'Unknown error'));}));</script>`;
}
function traderProfilePage() {
  return `${sectionHero('Trader Profile', 'TikTok/Instagram-style trader profile with rank, verified badge, main EA, copiers, growth, harvested profit, max drawdown, and WISDO safety score.')}
  <section class="card full"><div class="row"><img src="/media/logo_transparent_background.png" style="max-width:160px;border-radius:18px;background:rgba(255,255,255,.04)"/><div><h2>Culture Trader</h2><p class="muted">Rank • Verified • Demo/Live badge • Main EA</p><a class="btn primary" href="/member/referrals">Follow</a><a class="btn" href="/member/copy-pro">Copy Trader</a><a class="btn" href="/member/support?type=join-desk">Join Desk</a></div></div></section>
  <section class="card full"><span class="tag">Videos</span><span class="tag">Live Trades</span><span class="tag">Results</span><span class="tag">Bots</span><span class="tag">Signals</span><span class="tag">Reviews</span></section>`;
}


function memberProfilePage(userId, state, mt4State = {}) {
  const user = state.usersById?.[userId] || { userId, username: userId === 'website-buyer' ? 'Website Member' : `Member ${String(userId).slice(-4)}`, role: 'member', membershipTier: 'Culture Member' };
  const licenses = state.licensesByUserId?.[userId] || [];
  const orders = Object.values(state.ordersById || {}).filter((order) => String(order.userId) === String(userId));
  const connections = Object.values(mt4State.connections || {}).filter((c) => String(c.discordUserId) === String(userId));
  return `${sectionHero('My Profile', 'Your CultureCoin trading identity, linked accounts, licenses, uploads, and purchases.', '<a class="btn primary" href="/member/link-account">Link Account</a><a class="btn" href="/member/my-bots">My Bots</a>')}
  <div class="grid3"><section class="card"><h3>Member</h3><div class="metric">${esc(user.username || userId)}</div><p>${esc(user.membershipTier || 'Culture Member')} • ${esc(user.role || 'member')}</p></section><section class="card"><h3>Linked Accounts</h3><div class="metric">${connections.length}</div><p>Connected through WISDO Reporter or Trade Link.</p></section><section class="card"><h3>Bot Licenses</h3><div class="metric">${licenses.length}</div><p>Unlocked bots ready for install/link.</p></section><section class="card full"><h3>Recent Orders</h3><table><tr><th>Order</th><th>Product</th><th>Amount</th><th>Status</th><th>Created</th></tr>${orders.map((o)=>`<tr><td>${esc(o.orderId)}</td><td>${esc(o.productName)}</td><td>${money(o.amountUsd)}</td><td>${esc(o.status)}</td><td>${esc(o.createdAt)}</td></tr>`).join('') || '<tr><td colspan="5">No orders yet.</td></tr>'}</table></section></div>`;
}

function myBotsPage(userId, state) {
  const licenses = state.licensesByUserId?.[userId] || [];
  const cards = licenses.map((license) => `<section class="card"><h3>${esc(license.botName)}</h3><span class="tag green">Licensed</span><span class="tag">${esc(license.tier || 'Core')}</span><p>Unlocked for this member. Install, link account, then use it in Copier Engine.</p><a class="btn primary" href="/member/bots/${esc(license.botSlug)}?userId=${encodeURIComponent(userId)}">Open Bot</a><a class="btn" href="/member/link-account?bot=${encodeURIComponent(license.botName)}&userId=${encodeURIComponent(userId)}">Link Account</a><a class="btn" href="/member/copy-pro?bot=${encodeURIComponent(license.botName)}&userId=${encodeURIComponent(userId)}">Use in Copier Engine</a></section>`).join('');
  return `${sectionHero('My Bots', 'Purchased and unlocked bots for this member. Downloads should only appear after license unlock.', '<a class="btn primary" href="/member/bots">Shop Bots</a>')}
  <div class="grid3">${cards || '<section class="card full"><h3>No paid bot licenses yet</h3><p>You can still connect MT4, install the free Reporter bridge, set risk profile, and prepare copy trading. Paid bot downloads unlock after purchase/license.</p><a class="btn primary" href="/member/setup">Start Free Setup</a><a class="btn" href="/member/bots">Open Bot Marketplace</a></section>'}</div>`;
}

function purchasesPage(userId, state) {
  const orders = Object.values(state.ordersById || {}).filter((order) => String(order.userId) === String(userId)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  return `${sectionHero('My Purchases', 'Order ledger for bots, memberships, reviews, upgrades, VPS, and device products.', '<a class="btn primary" href="/member/bots">Buy Bots</a>')}
  <section class="card full"><table><tr><th>Order</th><th>Type</th><th>Product</th><th>Amount</th><th>Status</th><th>Access</th></tr>${orders.map((o)=>`<tr><td>${esc(o.orderId)}</td><td>${esc(o.productType)}</td><td>${esc(o.productName)}</td><td>${money(o.amountUsd)}</td><td>${esc(o.status)}</td><td>${o.accessGranted ? '<span class="tag green">Granted</span>' : '<span class="tag gold">Pending</span>'}</td></tr>`).join('') || '<tr><td colspan="6">No purchases yet.</td></tr>'}</table></section>`;
}

async function contentHubPage(userId, state) {
  const videos = state.videosByUserId?.[userId] || [];
  const rows = videos.map((v)=>`<tr><td>${esc(v.title || v.caption || 'Video')}</td><td>${esc(v.type || 'feed')}</td><td>${esc(v.visibility || 'members')}</td><td>${esc(v.createdAt || '')}</td></tr>`).join('');
  return `${sectionHero('Content Hub', 'Upload short social videos, long Film Room videos, and manage your trading content.', '<a class="btn primary" href="/member/upload">Upload Short Video</a><a class="btn" href="/member/reviews/new">Submit Film Room Review</a>')}
  <div class="grid3"><section class="card"><h3>Short Culture Feed</h3><p>Post wins, losses, lessons, bot results, and quick education clips.</p><a class="btn primary" href="/member/upload">Upload Feed Clip</a></section><section class="card"><h3>Long Film Room</h3><p>Submit longer trade reviews or coaching videos.</p><a class="btn primary" href="/member/reviews/new">Submit Review</a></section><section class="card"><h3>Browse Feed</h3><p>Watch other users and filter by bot, symbol, growth, and account type.</p><a class="btn primary" href="/member/feed">Open Feed</a></section><section class="card full"><h3>My Uploads</h3><table><tr><th>Title</th><th>Type</th><th>Visibility</th><th>Date</th></tr>${rows || '<tr><td colspan="4">No uploads connected to this profile yet.</td></tr>'}</table></section></div>`;
}


function financeState(state = {}) {
  state.subscriptionsById ||= {};
  state.paymentPlansById ||= {};
  state.vpsAssignmentsById ||= {};
  state.payoutsById ||= {};
  state.commissionLedgerById ||= {};
  return state;
}

const VPS_PRODUCTS = [
  { planName: 'Starter VPS', slug: 'starter-vps', monthlyPrice: 49, terminals: 1, description: '1 MT4 terminal, basic monitoring, good for demo/testing.' },
  { planName: 'Operator VPS', slug: 'operator-vps', monthlyPrice: 97, terminals: 3, description: '3 MT4 terminals, WISDO bridge monitoring, restart help.' },
  { planName: 'Commander VPS', slug: 'commander-vps', monthlyPrice: 197, terminals: 10, description: '10 MT4 terminals, priority support, copy trading optimized.' },
  { planName: 'White Label VPS', slug: 'white-label-vps', monthlyPrice: 497, terminals: 25, description: 'Team/seller/coach deployment with custom onboarding.' },
];

function subscriptionStatusTag(status) {
  const s = String(status || 'active');
  const cls = ['active','trialing','complete','paid_in_full'].includes(s) ? 'green' : ['past_due','unpaid','paused'].includes(s) ? 'gold' : 'red';
  return `<span class="tag ${cls}">${esc(s)}</span>`;
}

function financeWidgetCards(userId, state) {
  state = financeState(state);
  const subscriptions = Object.values(state.subscriptionsById).filter((x)=>String(x.userId)===String(userId));
  const plans = Object.values(state.paymentPlansById).filter((x)=>String(x.userId)===String(userId));
  const vps = Object.values(state.vpsAssignmentsById).filter((x)=>String(x.userId)===String(userId));
  const payouts = Object.values(state.payoutsById).filter((x)=>String(x.userId)===String(userId));
  const commissions = Object.values(state.commissionLedgerById).filter((x)=>String(x.referrerUserId)===String(userId));
  const available = commissions.filter((x)=>x.status==='available').reduce((sum,x)=>sum+Number(x.commissionAmount||0),0);
  return `<div class="grid3"><section class="card"><h3>Active Subscriptions</h3><div class="metric">${subscriptions.length}</div><p>Bot rentals, signal rooms, copy access, memberships, and VPS.</p></section><section class="card"><h3>Payment Plans</h3><div class="metric">${plans.length}</div><p>Monthly-until-owned bot plans. VPS required until paid in full.</p></section><section class="card"><h3>VPS Assignments</h3><div class="metric">${vps.length}</div><p>Hosted MT4 environments for rentals, plans, and copy trading.</p></section><section class="card"><h3>Available Commission</h3><div class="metric green">${money(available)}</div><p>Approved and available for payout request.</p></section><section class="card"><h3>Payout Requests</h3><div class="metric">${payouts.length}</div><p>Requested, approved, paid, rejected, or held payout records.</p></section><section class="card"><h3>Finance Engine</h3><span class="tag green">Square Ready</span><span class="tag gold">Manual fallback</span><span class="tag">VPS access rules</span></section></div>`;
}

function subscriptionsPage(userId, state) {
  state = financeState(state);
  const subscriptions = Object.values(state.subscriptionsById).filter((x)=>String(x.userId)===String(userId));
  const plans = Object.values(state.paymentPlansById).filter((x)=>String(x.userId)===String(userId));
  const rows = subscriptions.map((s)=>`<tr><td>${esc(s.productName)}</td><td>${esc(s.productType)}</td><td>${money(s.amountMonthly)}</td><td>${subscriptionStatusTag(s.status)}</td><td>${esc(s.currentPeriodEnd || s.nextDueAt || '')}</td></tr>`).join('');
  const planRows = plans.map((p)=>`<tr><td>${esc(p.productName)}</td><td>${money(p.totalPrice)}</td><td>${money(p.amountPaid)}</td><td>${money(p.balanceRemaining)}</td><td>${money(p.monthlyAmount)}</td><td>${subscriptionStatusTag(p.status)}</td></tr>`).join('');
  return `${sectionHero('Subscriptions', 'Bot rentals, payment plans, signal memberships, copy access, VPS hosting, and membership billing.', '<a class="btn primary" href="/member/bots">Shop Bots</a><a class="btn" href="/member/vps">VPS Forge</a>')}<section class="card full"><h3>Active Subscriptions</h3><table><tr><th>Product</th><th>Type</th><th>Monthly</th><th>Status</th><th>Next Due</th></tr>${rows || '<tr><td colspan="5">No active subscriptions yet.</td></tr>'}</table></section><section class="card full"><h3>Payment Plans</h3><table><tr><th>Product</th><th>Total</th><th>Paid</th><th>Remaining</th><th>Monthly</th><th>Status</th></tr>${planRows || '<tr><td colspan="6">No payment plans yet.</td></tr>'}</table></section>${riskDisclosureBlock()}`;
}

function paymentPlansPage(userId, state) {
  state = financeState(state);
  const plans = Object.values(state.paymentPlansById).filter((x)=>String(x.userId)===String(userId));
  const cards = plans.map((p)=>{ const progress = p.totalPrice ? clamp((Number(p.amountPaid||0)/Number(p.totalPrice))*100,0,100) : 0; return `<section class="card"><h3>${esc(p.productName)}</h3><div class="metric">${Math.round(progress)}%</div><div class="progress-bar"><span style="width:${progress}%"></span></div><p>Total ${money(p.totalPrice)} • Paid ${money(p.amountPaid)} • Remaining ${money(p.balanceRemaining)}</p><p>Monthly ${money(p.monthlyAmount)} • Payments ${esc(p.paymentsMade || 0)}/${esc((p.paymentsMade||0)+(p.paymentsRemaining||0))}</p><p>Download: ${p.downloadUnlocked ? '<span class="tag green">Unlocked</span>' : '<span class="tag gold">Locked until paid in full</span>'} VPS: ${p.vpsRequired ? '<span class="tag gold">Required</span>' : '<span class="tag green">Optional</span>'}</p></section>`; }).join('');
  return `${sectionHero('Payment Plans', 'Monthly-until-owned bot access. Users run bots on CultureCoin VPS until the final payment clears.', '<a class="btn primary" href="/member/bots/df-sauce-final-ai">Start DF Sauce Plan</a>')}<div class="grid3">${cards || '<section class="card full"><h3>No payment plans</h3><p>Open a bot detail page and choose Pay Monthly Until Owned.</p></section>'}</div>`;
}

function vpsForgePage(userId, state) {
  state = financeState(state);
  const myVps = Object.values(state.vpsAssignmentsById).filter((x)=>String(x.userId)===String(userId));
  const productCards = VPS_PRODUCTS.map((v)=>`<section class="card"><h3>${esc(v.planName)}</h3><div class="metric">${money(v.monthlyPrice)}/mo</div><p>${esc(v.description)}</p><span class="tag">${v.terminals} MT4 terminal${v.terminals===1?'':'s'}</span><button class="btn primary vps-checkout" data-plan="${esc(v.slug)}">Buy VPS</button></section>`).join('');
  const rows = myVps.map((v)=>`<tr><td>${esc(v.vpsId)}</td><td>${esc(v.planName)}</td><td>${subscriptionStatusTag(v.status)}</td><td>${esc(v.assignedBotSlug || 'Not assigned')}</td><td>${esc(v.assignedAccountId || 'Not assigned')}</td><td>${esc(v.lastHeartbeatAt || 'Pending')}</td></tr>`).join('');
  return `${sectionHero('VPS Forge', 'Use CultureCoin VPS for payment plans, rentals, signal/copy stability, and protected bot delivery.', '<a class="btn" href="/member/support/tickets">Request Setup</a>')}<div class="grid3">${productCards}</div><section class="card full"><h3>My VPS Assignments</h3><table><tr><th>VPS ID</th><th>Plan</th><th>Status</th><th>Bot</th><th>Account</th><th>Last Online</th></tr>${rows || '<tr><td colspan="6">No VPS assignments yet.</td></tr>'}</table></section><pre id="vpsOut" class="checkout-result"></pre><script>document.querySelectorAll('.vps-checkout').forEach(btn=>btn.addEventListener('click',async()=>{const out=document.getElementById('vpsOut');out.style.display='block';out.textContent='Creating VPS checkout...';const res=await fetch('/api/vps/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planSlug:btn.dataset.plan})});const json=await res.json();out.textContent=json.ok?('VPS checkout/assignment created: '+json.vps.planName+'\\nStatus: '+json.vps.status+(json.checkoutUrl?'\\nOpen: '+json.checkoutUrl:'')):'Error: '+(json.error||'unknown');}));</script>`;
}

function payoutRequestPage(userId, state) {
  state = financeState(state);
  const payouts = Object.values(state.payoutsById).filter((x)=>String(x.userId)===String(userId));
  const commissions = Object.values(state.commissionLedgerById).filter((x)=>String(x.referrerUserId)===String(userId));
  const pending = commissions.filter((x)=>x.status==='pending').reduce((sum,x)=>sum+Number(x.commissionAmount||0),0);
  const available = commissions.filter((x)=>x.status==='available').reduce((sum,x)=>sum+Number(x.commissionAmount||0),0);
  const paid = payouts.filter((x)=>x.status==='paid').reduce((sum,x)=>sum+Number(x.amount||0),0);
  const rows = payouts.map((p)=>`<tr><td>${esc(p.payoutId)}</td><td>${money(p.amount)}</td><td>${esc(p.method)}</td><td>${esc(p.status)}</td><td>${esc(p.requestedAt)}</td></tr>`).join('');
  return `${sectionHero('Payouts', 'Request payouts for available commissions. Payment-plan commissions are earned monthly as payments clear.', '<a class="btn" href="/member/how-commissions-work">How commissions work</a>')}<div class="grid3"><section class="card"><h3>Pending</h3><div class="metric gold">${money(pending)}</div></section><section class="card"><h3>Available</h3><div class="metric green">${money(available)}</div></section><section class="card"><h3>Paid</h3><div class="metric">${money(paid)}</div></section></div><section class="card full"><h3>Request Payout</h3><form id="payoutForm" class="grid3"><input name="amount" type="number" step="0.01" placeholder="Amount" required><select name="method"><option>CashApp</option><option>PayPal</option><option>Bank transfer</option><option>Zelle</option><option>Manual</option></select><input name="destination" placeholder="Handle/email/account note" required><button class="btn primary">Request Payout</button></form><pre id="payoutOut" class="checkout-result"></pre></section><section class="card full"><h3>Payout Requests</h3><table><tr><th>ID</th><th>Amount</th><th>Method</th><th>Status</th><th>Requested</th></tr>${rows || '<tr><td colspan="5">No payout requests yet.</td></tr>'}</table></section><script>document.getElementById('payoutForm')?.addEventListener('submit',async(e)=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target).entries());const out=document.getElementById('payoutOut');out.style.display='block';out.textContent='Submitting payout request...';const res=await fetch('/api/me/payouts/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const json=await res.json();out.textContent=json.ok?'Payout requested: '+json.payout.payoutId:'Error: '+(json.error||'unknown');});</script>`;
}

function purchaseResultPage(success = true) {
  return `${sectionHero(success ? 'Purchase Success' : 'Purchase Cancelled', success ? 'Your checkout was completed or recorded. WISDO will unlock the correct access after payment confirmation.' : 'Checkout was cancelled. You can return to the marketplace anytime.', '<a class="btn primary" href="/member/my-bots">My Bots</a><a class="btn" href="/member/subscriptions">Subscriptions</a><a class="btn" href="/member/bots">Bot Store</a>')}<section class="card full"><h3>${success ? 'Next Steps' : 'No problem'}</h3><p>${success ? 'Check My Bots, Subscriptions, Payment Plans, or VPS Forge. If the Square webhook is configured, paid orders can unlock automatically.' : 'No payment was completed. Your account was not charged by this page.'}</p></section>`;
}

function adminFinancePage(state) {
  state = financeState(state);
  const orders = Object.values(state.ordersById || {});
  const subs = Object.values(state.subscriptionsById || {});
  const plans = Object.values(state.paymentPlansById || {});
  const payouts = Object.values(state.payoutsById || {});
  const revenue = orders.reduce((sum,o)=>sum+Number(o.amountUsd||o.grossAmount||0),0);
  return `${sectionHero('Admin Finance', 'Revenue, subscriptions, payment plans, payouts, refunds, chargebacks, and manual finance controls.', '<a class="btn" href="/admin/vps">Admin VPS</a><a class="btn" href="/admin/commerce">Commerce</a>')}<div class="grid3"><section class="card"><h3>Recorded Revenue</h3><div class="metric green">${money(revenue)}</div></section><section class="card"><h3>Active Subscriptions</h3><div class="metric">${subs.filter((s)=>s.status==='active').length}</div></section><section class="card"><h3>Past Due</h3><div class="metric red">${subs.filter((s)=>s.status==='past_due').length}</div></section><section class="card"><h3>Payment Plans</h3><div class="metric">${plans.length}</div></section><section class="card"><h3>Payout Requests</h3><div class="metric gold">${payouts.filter((p)=>p.status==='requested').length}</div></section><section class="card"><h3>VPS Users</h3><div class="metric">${Object.keys(state.vpsAssignmentsById||{}).length}</div></section></div><section class="card full"><h3>Payout Queue</h3><table><tr><th>Payout</th><th>User</th><th>Amount</th><th>Method</th><th>Status</th><th>Actions</th></tr>${payouts.map((p)=>`<tr><td>${esc(p.payoutId)}</td><td>${esc(p.userId)}</td><td>${money(p.amount)}</td><td>${esc(p.method)}</td><td>${esc(p.status)}</td><td><button class="btn approve-payout" data-id="${esc(p.payoutId)}">Approve</button><button class="btn mark-paid" data-id="${esc(p.payoutId)}">Mark Paid</button></td></tr>`).join('') || '<tr><td colspan="6">No payout requests.</td></tr>'}</table></section><script>document.querySelectorAll('.approve-payout,.mark-paid').forEach(btn=>btn.addEventListener('click',async()=>{const path=btn.classList.contains('approve-payout')?'approve':'mark-paid';const res=await fetch('/api/admin/payouts/'+btn.dataset.id+'/'+path,{method:'POST'});alert((await res.json()).ok?'Updated':'Failed');location.reload();}));</script>`;
}

function adminVpsPage(state) {
  state = financeState(state);
  const rows = Object.values(state.vpsAssignmentsById || {}).map((v)=>`<tr><td>${esc(v.vpsId)}</td><td>${esc(v.userId)}</td><td>${esc(v.planName)}</td><td>${money(v.monthlyPrice)}</td><td>${esc(v.status)}</td><td>${esc(v.assignedBotSlug || '')}</td><td>${esc(v.assignedAccountId || '')}</td><td>${esc(v.lastHeartbeatAt || 'pending')}</td></tr>`).join('');
  return `${sectionHero('Admin VPS', 'Create, monitor, pause, resume, and manage VPS assignments for bot payment plans and rentals.', '<a class="btn" href="/member/vps">VPS Forge</a><a class="btn" href="/admin/finance">Admin Finance</a>')}<section class="card full"><h3>VPS Assignments</h3><table><tr><th>VPS ID</th><th>User</th><th>Plan</th><th>Monthly</th><th>Status</th><th>Bot</th><th>Account</th><th>Last Heartbeat</th></tr>${rows || '<tr><td colspan="8">No VPS assignments yet.</td></tr>'}</table></section><section class="card full"><h3>Available VPS Products</h3><div class="grid3">${VPS_PRODUCTS.map((v)=>`<section class="card"><h3>${esc(v.planName)}</h3><p>${esc(v.description)}</p><div class="metric">${money(v.monthlyPrice)}/mo</div></section>`).join('')}</div></section>`;
}

function adminEcosystemPage(state) {
  const users = Object.keys(state.usersById || {}).length;
  const orders = Object.values(state.ordersById || {});
  const licenses = Object.values(state.licensesByUserId || {}).flat();
  return `${sectionHero('Admin Ecosystem Control', 'Manage users, bot licenses, orders, copy approvals, Film Room tickets, and content moderation.', '<a class="btn primary" href="/member/bots">Bot Marketplace</a>')}
  <div class="grid3"><section class="card"><h3>Users</h3><div class="metric">${users}</div></section><section class="card"><h3>Orders</h3><div class="metric">${orders.length}</div></section><section class="card"><h3>Licenses</h3><div class="metric">${licenses.length}</div></section><section class="card full"><h3>Grant Bot License</h3><form id="grantForm" class="grid3"><input name="userId" placeholder="Discord User ID" required><select name="botSlug">${EA_CATALOG.map((b)=>`<option value="${slugify(b.name)}">${esc(b.name)} - ${money(botPrice(b, { store: {} }))}</option>`).join('')}</select><button class="btn primary">Grant License</button></form><pre id="grantOut" class="checkout-result"></pre></section></div><script>document.getElementById('grantForm')?.addEventListener('submit',async(e)=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target).entries());const out=document.getElementById('grantOut');out.style.display='block';out.textContent='Granting...';const res=await fetch('/api/admin/licenses/grant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const json=await res.json();out.textContent=json.ok?'Granted '+json.license.botName+' to '+json.license.userId:'Error: '+(json.error||'unknown');});</script>`;
}


function referralCodeForUser(userId, username = '') {
  const clean = String(username || userId || 'MEMBER')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 24) || 'MEMBER';
  return clean.startsWith('CEM') ? clean : `CEM-${clean}`;
}

function findReferralOwner(state, referralCode = '') {
  const code = String(referralCode || '').trim().toUpperCase();
  if (!code) return null;
  for (const [userId, record] of Object.entries(state.referralCodesByUserId || {})) {
    if (String(record.code || '').toUpperCase() === code) return { userId, ...record };
  }
  if (code === 'CEM-DFOUNTAIN' || code === 'CEM-D.FOUNTAIN') return { userId: '518140439489019906', code: 'CEM-DFOUNTAIN', username: 'D.Fountain' };
  return null;
}

async function ensureReferralProfile(userId, username = '') {
  const state = await loadEcosystemState();
  state.referralCodesByUserId ||= {};
  state.usersById ||= {};
  const key = String(userId || 'website-buyer');
  if (!state.referralCodesByUserId[key]) {
    const user = state.usersById[key] || {};
    state.referralCodesByUserId[key] = {
      userId: key,
      code: referralCodeForUser(key, username || user.username || user.displayName || key),
      username: username || user.username || user.displayName || `Member ${key.slice(-4)}`,
      active: true,
      createdAt: new Date().toISOString(),
    };
    await saveEcosystemState(state);
  }
  return state.referralCodesByUserId[key];
}

function commissionRateForProduct(productType = 'bot') {
  const type = String(productType || '').toLowerCase();
  if (type === 'bot') return 0.20;
  if (type === 'copy_access') return 0.30;
  if (type === 'signal_access') return 0.25;
  if (type === 'membership') return 0.25;
  if (type === 'film_room' || type === 'video_review') return 0.15;
  if (type === 'coaching') return 0.15;
  if (type === 'vps' || type === 'device') return 0.20;
  return 0.20;
}

async function createCommissionFromOrder(order, referralCode = '') {
  const state = await loadEcosystemState();
  const owner = findReferralOwner(state, referralCode || order.referralCode);
  if (!owner || String(owner.userId) === String(order.userId)) return null;
  const amount = Number(order.amountUsd || order.grossAmount || 0);
  if (!amount) return null;
  const rate = commissionRateForProduct(order.productType);
  const commission = {
    commissionId: makeId('comm'),
    orderId: order.orderId,
    referrerUserId: owner.userId,
    buyerUserId: order.userId,
    productType: order.productType,
    productId: order.productId,
    grossAmount: amount,
    commissionRatePercent: rate * 100,
    commissionAmount: Number((amount * rate).toFixed(2)),
    platformAmount: Number((amount * (1 - rate)).toFixed(2)),
    status: 'pending',
    holdUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  };
  state.commissionLedgerById ||= {};
  state.commissionLedgerById[commission.commissionId] = commission;
  state.conversions ||= [];
  state.conversions.push({ conversionId: makeId('conv'), referralCode: owner.code, referrerUserId: owner.userId, convertedUserId: order.userId, convertedOrderId: order.orderId, conversionStatus: 'purchased', createdAt: new Date().toISOString() });
  await saveEcosystemState(state);
  return commission;
}

function referralStatsForUser(state, userId) {
  const code = state.referralCodesByUserId?.[userId]?.code || referralCodeForUser(userId);
  const visits = (state.referralVisits || []).filter((v) => String(v.referrerUserId) === String(userId) || String(v.referralCode).toUpperCase() === String(code).toUpperCase());
  const conversions = (state.conversions || []).filter((v) => String(v.referrerUserId) === String(userId));
  const ledger = Object.values(state.commissionLedgerById || {}).filter((c) => String(c.referrerUserId) === String(userId));
  const totals = ledger.reduce((acc, c) => {
    const amt = Number(c.commissionAmount || 0);
    acc.lifetime += amt;
    acc[c.status] = (acc[c.status] || 0) + amt;
    return acc;
  }, { lifetime: 0, pending: 0, approved: 0, available: 0, paid: 0, cancelled: 0, chargeback: 0 });
  return { code, visits: visits.length, conversions: conversions.length, purchases: ledger.length, totals };
}

function megaReferralLinks(baseUrl, code) {
  const safe = encodeURIComponent(code);
  return [
    ['General Join', `${baseUrl}/r/${safe}`],
    ['DF Sauce Final AI', `${baseUrl}/r/${safe}/bot/df-sauce-final-ai`],
    ['Copy D.Fountain', `${baseUrl}/r/${safe}/copy/518140439489019906`],
    ['XAUUSD Signals', `${baseUrl}/r/${safe}/signals/xauusd`],
    ['Film Room', `${baseUrl}/r/${safe}/film-room`],
  ];
}

function megaReferralDashboardPage(baseUrl, userId, state) {
  const profile = state.referralCodesByUserId?.[userId] || { code: referralCodeForUser(userId), username: `Member ${String(userId).slice(-4)}` };
  const stats = referralStatsForUser(state, userId);
  const links = megaReferralLinks(baseUrl, profile.code).map(([label, url]) => `<tr><td>${esc(label)}</td><td><code>${esc(url)}</code></td><td><button class="btn" onclick="navigator.clipboard?.writeText('${esc(url)}')">Copy</button><a class="btn" href="${esc(url)}">Open</a></td></tr>`).join('');
  const ledgerRows = Object.values(state.commissionLedgerById || {}).filter((c)=>String(c.referrerUserId)===String(userId)).map((c)=>`<tr><td>${esc(c.productType)}</td><td>${esc(c.productId)}</td><td>${money(c.grossAmount)}</td><td>${money(c.commissionAmount)}</td><td>${esc(c.status)}</td><td>${esc(c.createdAt)}</td></tr>`).join('');
  return `${sectionHero('Referral Business Center', 'Create shareable CultureCoin referral links for bots, copy traders, signals, Film Room, VPS, devices, and memberships.', '<a class="btn primary" href="/member/referral-builder?userId='+encodeURIComponent(userId)+'">Build Referral Link</a><a class="btn" href="/member/wallet?userId='+encodeURIComponent(userId)+'">Commission Wallet</a>')}
  <div class="grid4 grid"><section class="card"><h3>Your Code</h3><div class="metric gold">${esc(profile.code)}</div><p>${esc(profile.username || '')}</p></section><section class="card"><h3>Clicks</h3><div class="metric">${stats.visits}</div><p>30-day tracking concept</p></section><section class="card"><h3>Purchases</h3><div class="metric green">${stats.purchases}</div><p>Orders tied to your code</p></section><section class="card"><h3>Pending Commission</h3><div class="metric gold">${money(stats.totals.pending)}</div><p>Admin approval/payout next</p></section></div>
  <section class="card full" style="margin-top:16px"><h3>Referral Links</h3><table><thead><tr><th>Type</th><th>Link</th><th>Action</th></tr></thead><tbody>${links}</tbody></table></section>
  <section class="card full"><h3>Commission Ledger</h3><table><thead><tr><th>Type</th><th>Product</th><th>Gross</th><th>Commission</th><th>Status</th><th>Created</th></tr></thead><tbody>${ledgerRows || '<tr><td colspan="6">No commissions yet.</td></tr>'}</tbody></table></section>`;
}

function referralBuilderPage(baseUrl, userId, state) {
  const code = state.referralCodesByUserId?.[userId]?.code || referralCodeForUser(userId);
  const botOptions = EA_CATALOG.slice(0, 20).map((bot)=>`<option value="${slugify(bot.name)}">${esc(bot.name)}</option>`).join('');
  return `${sectionHero('Referral Link Builder', 'Build product-specific links that track clicks, signups, connected accounts, purchases, and commissions.', '<a class="btn" href="/member/referrals?userId='+encodeURIComponent(userId)+'">Back to Referrals</a>')}
  <section class="card full"><h3>Create Link</h3><div class="grid3"><select id="refType"><option value="general">General Join</option><option value="bot">Bot</option><option value="copy">Copy Trader</option><option value="signals">Signal Room</option><option value="film-room">Film Room</option></select><select id="botSlug">${botOptions}</select><input id="campaign" placeholder="Campaign name e.g. DF Sauce Launch"><button class="btn primary" onclick="buildRef()">Generate</button></div><pre id="refOut" style="white-space:pre-wrap;background:#06111d;border:1px solid rgba(255,255,255,.1);padding:12px;border-radius:12px;margin-top:12px"></pre></section><script>function buildRef(){const type=document.getElementById('refType').value;const bot=document.getElementById('botSlug').value;const camp=encodeURIComponent(document.getElementById('campaign').value||'');let url='${esc(baseUrl)}/r/${esc(code)}';if(type==='bot') url+='/bot/'+bot;if(type==='copy') url+='/copy/${encodeURIComponent(userId)}';if(type==='signals') url+='/signals/xauusd';if(type==='film-room') url+='/film-room';if(camp) url+='?campaign='+camp;document.getElementById('refOut').textContent=url;navigator.clipboard?.writeText(url);}</script>`;
}

function referralLandingPage(baseUrl, referralCode, targetType = 'general', targetId = '') {
  const bot = targetType === 'bot' ? EA_CATALOG.find((b)=>slugify(b.name) === String(targetId)) : null;
  const title = bot ? `${referralCode} invited you to ${bot.name}` : `${referralCode} invited you to CultureCoin`;
  const cta = bot ? `<a class="btn primary" href="/member/bots/${slugify(bot.name)}?ref=${encodeURIComponent(referralCode)}">Buy ${esc(bot.name)}</a>` : '<a class="btn primary" href="/member/link-account">Join / Connect MT4</a>';
  return `${sectionHero(title, 'Watch trades, copy winners, buy bots, connect MT4, and let WISDO protect the account.', cta+'<a class="btn" href="/member/bots">View Bots</a><a class="btn" href="/results">View Results</a>')}
  <div class="grid3"><section class="card"><h3>Referral Code</h3><div class="metric gold">${esc(referralCode)}</div><p>30-day attribution concept. Last valid referral click wins by default.</p></section><section class="card"><h3>Recommended Product</h3><div class="metric">${esc(bot?.name || 'CultureCoin Membership')}</div><p>${bot ? money(botPrice(bot, { store: { basePriceUsd: 997 } })) : 'Start with MT4 connection and member onboarding.'}</p></section><section class="card"><h3>What unlocks</h3><p>Bot access, install guide, WISDO support, account tracking, copy hub, signals, Film Room, and Discord desk.</p></section></div>${riskDisclosureBlock()}`;
}

function enhancedWalletPage(userId, state) {
  const stats = referralStatsForUser(state, userId);
  const rows = Object.values(state.commissionLedgerById || {}).filter((c)=>String(c.referrerUserId)===String(userId)).map((c)=>`<tr><td>${esc(c.productType)}</td><td>${esc(c.productId)}</td><td>${money(c.grossAmount)}</td><td>${c.commissionRatePercent}%</td><td>${money(c.commissionAmount)}</td><td>${esc(c.status)}</td></tr>`).join('');
  return `${sectionHero('Commission Wallet', 'Trades prove value. Square collects payment. WISDO tracks commission. Admin approves payout.', '<button class="btn primary" onclick="requestPayout()">Request Payout</button><a class="btn" href="/member/referrals?userId='+encodeURIComponent(userId)+'">Referral Links</a>')}
  <div class="grid"><section class="card"><h3>Lifetime Earned</h3><div class="metric green">${money(stats.totals.lifetime)}</div></section><section class="card"><h3>Pending</h3><div class="metric gold">${money(stats.totals.pending)}</div></section><section class="card"><h3>Available</h3><div class="metric blue">${money(stats.totals.available)}</div></section><section class="card"><h3>Paid</h3><div class="metric">${money(stats.totals.paid)}</div></section></div>
  <section class="card full" style="margin-top:16px"><h3>Commission Ledger</h3><table><thead><tr><th>Type</th><th>Product</th><th>Gross</th><th>Rate</th><th>Commission</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No commission records yet.</td></tr>'}</tbody></table></section>
  <script>async function requestPayout(){const amount=prompt('Amount to request payout for?');if(!amount)return;const res=await fetch('/api/payouts/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:'${esc(userId)}',amount:Number(amount),payoutMethod:'manual'})});alert(JSON.stringify(await res.json(),null,2));}</script>`;
}

function adminCommercePage(state) {
  const orders = Object.values(state.ordersById || {});
  const commissions = Object.values(state.commissionLedgerById || {});
  const payouts = Object.values(state.payoutsById || {});
  const rows = commissions.map((c)=>`<tr><td>${esc(c.commissionId)}</td><td>${esc(c.referrerUserId)}</td><td>${esc(c.productId)}</td><td>${money(c.commissionAmount)}</td><td>${esc(c.status)}</td><td><button class="btn" onclick="approveComm('${esc(c.commissionId)}')">Approve</button></td></tr>`).join('');
  return `${sectionHero('Admin Commerce Engine', 'Manage referral visits, conversions, bot orders, licenses, commission ledger, and payout requests.', '<a class="btn" href="/admin/ecosystem">Admin Ecosystem</a>')}
  <div class="grid"><section class="card"><h3>Orders</h3><div class="metric">${orders.length}</div></section><section class="card"><h3>Commission Rows</h3><div class="metric">${commissions.length}</div></section><section class="card"><h3>Payout Requests</h3><div class="metric">${payouts.length}</div></section><section class="card"><h3>Bot Products</h3><div class="metric">${EA_CATALOG.length}</div></section></div>
  <section class="card full" style="margin-top:16px"><h3>Commission Approval Queue</h3><table><thead><tr><th>ID</th><th>Referrer</th><th>Product</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="6">No commissions yet.</td></tr>'}</tbody></table></section>
  <script>async function approveComm(id){const res=await fetch('/api/admin/commissions/'+id+'/approve',{method:'POST'});alert(JSON.stringify(await res.json(),null,2));location.reload();}</script>`;
}


function ytdStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1).toISOString();
}

function normalizeRiskBody(body = {}) {
  const splitSymbols = (value) => String(value || '').split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
  const checkboxOn = (value, fallback = false) => {
    if (value === undefined) return fallback;
    return !(value === false || value === 'false' || value === 'off' || value === '0' || value === '');
  };
  const mode = String(body.mode || body.riskMode || 'fixed_lot');
  return {
    enabled: checkboxOn(body.enabled, true),
    mode,
    fixedLot: Number(body.fixedLot || body.targetFixedLot || body.followerFixedLot || 0.01),
    multiplier: Number(body.multiplier || body.riskSetting || 1),
    riskSettingPercent: Number(body.riskSettingPercent || body.riskSetting || (Number(body.multiplier || 1) * 100)),
    riskPercent: Number(body.riskPercent || body.targetRiskPercent || body.followerRiskPercent || 1),
    masterRiskPercent: Number(body.masterRiskPercent || body.sourceRiskPercent || 1),
    targetRiskPercent: Number(body.targetRiskPercent || body.followerRiskPercent || body.riskPercent || 1),
    masterFixedLot: Number(body.masterFixedLot || body.sourceFixedLot || 0),
    targetFixedLot: Number(body.targetFixedLot || body.followerFixedLot || body.fixedLot || 0.01),
    maxLot: Number(body.maxLot || 0.05),
    minLot: Number(body.minLot || 0.01),
    lotStep: Number(body.lotStep || body.brokerStepSize || 0.01),
    riskUsd: Number(body.riskUsd || 25),
    maxOpenTrades: Number(body.maxOpenTrades || 5),
    maxDailyLossPercent: Number(body.maxDailyLossPercent || 0),
    maxWeeklyLossPercent: Number(body.maxWeeklyLossPercent || 0),
    maxDrawdownPercent: Number(body.maxDrawdownPercent || 0),
    maxSymbolExposure: Number(body.maxSymbolExposure || 0),
    maxSpread: Number(body.maxSpread || 0),
    maxSlippage: Number(body.maxSlippage || 0),
    allowedSymbols: Array.isArray(body.allowedSymbols) ? body.allowedSymbols : splitSymbols(body.allowedSymbolsCsv || body.allowedSymbols),
    blockedSymbols: Array.isArray(body.blockedSymbols) ? body.blockedSymbols : splitSymbols(body.blockedSymbolsCsv || body.blockedSymbols),
    copyBuys: checkboxOn(body.copyBuys, true),
    copySells: checkboxOn(body.copySells, true),
    copySLTP: checkboxOn(body.copySLTP, false),
    copyPendingOrders: checkboxOn(body.copyPendingOrders, false),
    reverseCopy: checkboxOn(body.reverseCopy, false),
    copierPaused: checkboxOn(body.copierPaused, false),
    paperModeDefault: checkboxOn(body.paperModeDefault, false),
    liveCopyRequiresConfirmation: checkboxOn(body.liveCopyRequiresConfirmation, true),
    acceptedRiskDisclaimer: checkboxOn(body.acceptedRiskDisclaimer, false),
    equityFloor: Number(body.equityFloor || 0),
  };
}

function accountSelectOptions(accounts = [], selected = '') {
  return accounts.map((a) => `<option value="${esc(a.accountId)}" ${String(selected) === String(a.accountId) ? 'selected' : ''}>${esc(accountOptionLabel(a))}${a.shared ? ' · shared' : ''}${a.discoverable ? ' · active reporter' : ''}</option>`).join('');
}

function copyHubProPage(userId = '', accounts = [], routes = [], shares = [], discoverableAccounts = [], accessRequests = [], brokerLinkRequests = [], access = {}) {
  const ownedAccounts = accounts.filter((a) => !a.shared);
  const leaderAccounts = accounts.filter((a) => ['leader','both','private'].includes(String(a.accountRole || 'private').toLowerCase()) || ['copy_allowed','control_allowed','admin','signal_only'].includes(String(a.sharePermission || '')) || a.shared);
  const followerAccounts = ownedAccounts.filter((a) => ['follower','both','private'].includes(String(a.accountRole || 'private').toLowerCase()));
  const leaderPool = [...leaderAccounts, ...discoverableAccounts];
  const leaderOptions = accountSelectOptions(leaderPool, routes[0]?.leaderAccountId || '');
  const followerOptions = accountSelectOptions(followerAccounts, routes[0]?.followerAccountId || '');
  const discoverableOptions = accountSelectOptions(discoverableAccounts, '');
  const ownedShareOptions = accountSelectOptions(ownedAccounts, '');
  const copierUnlocked = canUseCopier(access);
  const accessBanner = copierUnlocked
    ? `<section class="card ok full"><h3>Copier role unlocked</h3><p>${(access.matchedDiscordRoles || []).map((role) => `<span class="tag green">${esc(role)}</span>`).join('') || '<span class="tag green">Premium/Admin access</span>'}</p></section>`
    : `<section class="card warn full"><h3>Copier preview mode</h3><p>You can explore the Culture Relay Engine and request access, but active copy relationships require the <strong>CULTURE COIN MEMBER+</strong>, <strong>WISDO</strong>, or <strong>OWNER</strong> Discord role.</p><a class="btn" href="/api/wisdo/me/roles">Check Role Sync</a></section>`;
  const stat = (label, value, tone = '') => `<section class="card"><h3>${esc(label)}</h3><div class="metric ${tone}">${esc(value)}</div></section>`;
  const roleLabel = (role = 'private') => role === 'leader' ? 'Culture Lead' : role === 'follower' ? 'Mirror Receiver' : role === 'both' ? 'Dual Lane' : 'Private Desk';
  const modeName = (mode = 'fixed_lot') => mode === 'risk_percent' ? 'Culture % Risk' : mode === 'multiplier' ? 'Lane Multiplier' : mode === 'same_lot' ? 'Match Leader Lot' : mode === 'equity_ratio' ? 'Balance Bridge' : 'Fixed Culture Lot';
  const accountKind = (a = {}) => a.shared ? 'Shared Reporter' : a.discoverable ? 'Community Reporter' : 'My Desk Reporter';
  const roleSelect = (accountId, selected) => `<select id="role-${esc(accountId)}"><option value="private" ${selected==='private'?'selected':''}>Private Desk</option><option value="leader" ${selected==='leader'?'selected':''}>Culture Lead</option><option value="follower" ${selected==='follower'?'selected':''}>Mirror Receiver</option><option value="both" ${selected==='both'?'selected':''}>Dual Lane</option></select><button class="btn" onclick="saveRole('${esc(accountId)}')">Save Role</button>`;
  const routeRows = routes.map((r) => {
    const leader = [...accounts, ...discoverableAccounts].find((a) => String(a.accountId) === String(r.leaderAccountId));
    const follower = accounts.find((a) => String(a.accountId) === String(r.followerAccountId));
    const risk = r.risk || {};
    return `<tr><td>${esc(leader ? accountOptionLabel(leader) : r.leaderAccountId)}</td><td>${esc(follower ? accountOptionLabel(follower) : r.followerAccountId)}</td><td><span class="tag ${r.status === 'active' ? 'green' : 'gold'}">${esc(r.status || 'active')}</span></td><td>${esc(modeName(risk.mode))}<br><span class="muted">fixed ${Number(risk.fixedLot || risk.targetFixedLot || 0.01).toFixed(2)} · mult ${Number(risk.multiplier || 1).toFixed(2)} · max lot ${Number(risk.maxLot || 0.05).toFixed(2)} · max trades ${Number(risk.maxOpenTrades || 5)} · SL/TP ${risk.copySLTP ? 'on' : 'off'} · pending ${risk.copyPendingOrders ? 'on' : 'off'}</span></td><td><button class="btn" onclick="deleteRoute('${esc(r.routeId)}')">Delete</button></td></tr>`;
  }).join('');
  const shareRows = shares.map((s) => {
    const acct = accounts.find((a) => String(a.accountId) === String(s.accountId)) || discoverableAccounts.find((a) => String(a.accountId) === String(s.accountId));
    const side = String(s.ownerUserId) === String(userId) ? 'Shared out' : 'Shared to me';
    const other = side === 'Shared out' ? s.targetUserId : s.ownerUserId;
    return `<tr><td>${esc(side)}</td><td>${esc(acct ? accountOptionLabel(acct) : s.accountId)}</td><td>${esc(other)}</td><td><span class="tag">${esc(s.permission || 'view_only')}</span></td><td>${String(s.ownerUserId) === String(userId) ? `<button class="btn" onclick="deleteShare('${esc(s.shareId)}')">Remove</button>` : '<span class="muted">Owner controlled</span>'}</td></tr>`;
  }).join('');
  const requestRows = accessRequests.map((r) => {
    const acct = [...accounts, ...discoverableAccounts].find((a) => String(a.accountId) === String(r.accountId));
    const inbound = String(r.ownerUserId) === String(userId);
    return `<tr><td>${inbound ? 'Inbound approval' : 'My request'}</td><td>${esc(acct ? accountOptionLabel(acct) : r.accountId)}</td><td>${esc(inbound ? r.requesterUserId : r.ownerUserId)}</td><td><span class="tag">${esc(r.permission || 'copy_allowed')}</span></td><td><span class="tag ${r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'gold'}">${esc(r.status || 'pending')}</span></td><td>${inbound && String(r.status || 'pending') === 'pending' ? `<button class="btn primary" onclick="approveRequest('${esc(r.requestId)}')">Approve</button><button class="btn" onclick="rejectRequest('${esc(r.requestId)}')">Reject</button>` : '<span class="muted">No action</span>'}</td></tr>`;
  }).join('');
  const brokerRows = brokerLinkRequests.map((r) => `<tr><td>${esc(r.platform || 'MT4')}</td><td>${esc(r.brokerName || '')}</td><td>${esc(r.brokerLogin || '')}<br><span class="muted">${esc(r.brokerServer || '')}</span></td><td>${esc(r.desiredRole || '')}</td><td><span class="tag gold">${esc(r.status || 'pairing_required')}</span><br><span class="muted">${r.accountId ? 'Dropdown-ready pending account' : 'Pair Reporter to activate'}</span></td><td>${esc(r.pairingCode || '')}<br>${r.requestId ? `<button class="btn" onclick="cancelBrokerLink('${esc(r.requestId)}')">Cancel</button>` : ''}</td></tr>`).join('');
  const accountCards = accounts.map((a) => {
    const risk = a.copyRisk || {};
    const snap = a.latestSnapshot?.snapshot || {};
    const role = String(a.accountRole || 'private').toLowerCase();
    const tone = role === 'leader' ? 'green' : role === 'follower' ? 'blue' : role === 'both' ? 'purple' : 'gold';
    return `<section class="card"><div class="row" style="justify-content:space-between"><span class="tag ${tone}">${esc(roleLabel(role))}</span><span class="tag">${a.pendingReporter ? 'Pending Reporter' : esc(accountKind(a))}</span></div><h3>${esc(a.nickname || a.accountNumber || a.accountId)}</h3><p>${esc(a.server || a.brokerServer || '')} · ${esc(a.type || '')}</p><div class="metric">${a.pendingReporter ? 'Pairing Needed' : money(snap.equity ?? a.equity)}</div><p class="muted">${a.pendingReporter ? `Pairing code ${esc(a.pairingCode || '')} · waiting for Reporter sync` : `Balance ${money(snap.balance ?? a.balance)} · Open ${Number(snap.openTradeCount || a.openTrades || 0)} · Floating ${money(snap.floatingPL ?? a.floatingPL)}`}</p><p class="muted">Risk Dial: ${esc(modeName(risk.mode || 'fixed_lot'))} · fixed ${Number(risk.fixedLot || risk.targetFixedLot || 0.01).toFixed(2)} · max ${Number(risk.maxLot || 0.05).toFixed(2)} · SL/TP ${risk.copySLTP ? 'on' : 'off'} · pending ${risk.copyPendingOrders ? 'on' : 'off'}</p>${!a.shared ? `<div>${roleSelect(a.accountId, role)}</div><button class="btn" onclick="loadAccountRisk('${esc(a.accountId)}')">Edit Culture Risk</button>` : `<button class="btn" onclick="selectLead('${esc(a.accountId)}')">Use Shared Lead</button>`}</section>`;
  }).join('');
  const discoverCards = discoverableAccounts.slice(0, 12).map((a) => {
    const snap = a.latestSnapshot?.snapshot || {};
    return `<section class="card"><div class="row" style="justify-content:space-between"><span class="tag green">Active Reporter</span><span class="tag">Owner ${esc(String(a.ownerUserId || '').slice(-6) || 'member')}</span></div><h3>${esc(a.nickname || a.maskedAccountNumber || a.accountId)}</h3><p>${esc(a.server || a.brokerServer || '')} · ${esc(roleLabel(String(a.accountRole || 'leader').toLowerCase()))}</p><p class="muted">Equity ${money(snap.equity ?? a.equity)} · Open ${Number(snap.openTradeCount || a.openTrades || 0)} · Last sync ${esc(a.lastSyncAt || '')}</p><button class="btn primary" onclick="selectDiscover('${esc(a.accountId)}','${esc(a.ownerUserId || a.discordUserId || '')}')">Request Culture Access</button></section>`;
  }).join('');
  const botLanes = accounts.flatMap((a) => {
    const snap = a.latestSnapshot?.snapshot || {};
    const rawBots = Array.isArray(snap.adaptiveBots) ? snap.adaptiveBots : Array.isArray(snap.adaptiveBotRegistry) ? snap.adaptiveBotRegistry : Array.isArray(snap.bots) ? snap.bots : [];
    const bots = rawBots.length ? rawBots : [{ botKey: snap.eaName || a.eaName || 'Reporter Lane', botNickname: snap.eaVersion || a.nickname || 'Account reporter', symbol: snap.symbol || a.symbol || 'Multi-symbol', status: snap.terminalConnected === false ? 'offline' : 'online', openTrades: snap.openTradeCount || a.openTrades || 0, magicNumber: snap.magicNumber || a.magicNumber || '' }];
    return bots.map((b) => `<tr><td>${esc(a.nickname || a.accountNumber || a.accountId)}<br><span class="muted">${esc(a.server || a.brokerServer || '')}</span></td><td>${esc(b.botNickname || b.name || b.botKey || 'CEM Bot')}</td><td>${esc(b.symbol || b.symbols || snap.symbol || 'Multi')}</td><td>${esc(b.magicNumber || b.magic || '')}</td><td><span class="tag ${String(b.status || 'online').toLowerCase().includes('off') ? 'red' : 'green'}">${esc(b.status || 'online')}</span></td><td>${Number(b.openTrades || b.openTradeCount || 0)}</td></tr>`);
  }).join('');
  return `${sectionHero('CEM Culture Relay Engine', 'Live advanced portal for multi-account desks, community reporters, bot lanes, risk dialing, broker-link requests, and TraderConnect-style copy setup using CEM Culture language.', '<a class="btn primary" href="#add-lane">Add Culture Lane</a><a class="btn" href="#discover">Find Active Reporters</a><a class="btn" href="#broker-link">Broker Login Link</a><a class="btn" href="/member/trade-results">YTD Equity Line</a>')}
  ${accessBanner}
  <section class="card full"><h3>Advanced Copier Path</h3><div class="grid3"><div class="step"><div class="num">1</div><div><h3>Link every account</h3><p>One desk can hold many live/demo reporters from the same Discord user.</p></div></div><div class="step"><div class="num">2</div><div><h3>Discover active reporters</h3><p>Other users with active public/copy-ready reporters can appear for access requests.</p></div></div><div class="step"><div class="num">3</div><div><h3>Choose Culture Lead</h3><p>Pick your own, shared, or approved community copy-from account.</p></div></div><div class="step"><div class="num">4</div><div><h3>Choose Mirror Receiver</h3><p>Pick one of your linked live/demo receiver accounts.</p></div></div><div class="step"><div class="num">5</div><div><h3>Use WISDO Risk Dial</h3><p>Percentage risk, lot based risk, fixed lot, multiplier, balance bridge.</p></div></div><div class="step"><div class="num">6</div><div><h3>Protect the lane</h3><p>SL/TP and pending orders stay off by default; max lot, max trades, equity floor stay on the receiver.</p></div></div></div></section>
  <div class="grid3" style="margin-top:16px">${stat('Linked Desk Accounts', String(ownedAccounts.length), ownedAccounts.length ? 'green' : 'gold')}${stat('Accessible Leads', String(leaderAccounts.length), leaderAccounts.length ? 'green' : 'gold')}${stat('Community Active Reporters', String(discoverableAccounts.length), discoverableAccounts.length ? 'blue' : '')}</div>
  <div class="grid3" style="margin-top:16px">${accountCards || '<section class="card full"><h3>No accounts connected</h3><p>Connect at least one Culture Lead and one Mirror Receiver reporter first.</p><a class="btn primary" href="/member/link-account">Connect MT4</a></section>'}</div>
  <section class="card full" id="add-lane" style="margin-top:16px"><h3>Add Culture Lane</h3><p class="muted">This is the CEM version of “add master copier.” The dropdowns include every account linked to this Discord desk plus every approved shared reporter. Community reporters must be requested/approved before they can be used as a lead.</p><form id="routeForm" class="grid3"><label>Copy From — Culture Lead<select name="leaderAccountId" id="leaderSelect"><optgroup label="My linked desk + approved shared reporters">${leaderOptions || '<option value="">No accessible lead yet</option>'}</optgroup></select></label><label>Copy To — Mirror Receiver<select name="followerAccountId">${followerOptions || '<option value="">Connect/select a receiver</option>'}</select></label><label>Culture Lane Status<select name="status"><option value="active">Active</option><option value="paused">Paused</option></select></label><label>Risk Mode<select name="mode" id="routeMode"><option value="fixed_lot">Fixed Culture Lot</option><option value="multiplier">Lane Multiplier</option><option value="same_lot">Match Leader Lot</option><option value="equity_ratio">Balance Bridge</option><option value="risk_percent">Culture % Risk</option></select></label><label>Fixed lot<input name="fixedLot" id="routeFixedLot" type="number" step="0.01" value="0.01"></label><label>Lane multiplier<input name="multiplier" id="routeMultiplier" type="number" step="0.01" value="1"></label><label>Risk setting %<input name="riskSettingPercent" id="routeRiskSettingPercent" type="number" step="0.01" value="100"></label><label>Max lot<input name="maxLot" type="number" step="0.01" value="0.05"></label><label>Max open trades<input name="maxOpenTrades" type="number" step="1" value="5"></label><label>Allowed symbols CSV<input name="allowedSymbolsCsv" placeholder="XAUUSD,US30,NAS100"></label><label>Equity floor<input name="equityFloor" type="number" step="1" value="0"></label><label>Max daily loss %<input name="maxDailyLossPercent" type="number" step="0.1" value="0"></label><label>Max drawdown %<input name="maxDrawdownPercent" type="number" step="0.1" value="0"></label><label><input type="checkbox" name="copySLTP"> Copy SL/TP <small class="muted">off by default</small></label><label><input type="checkbox" name="copyPendingOrders"> Copy pending orders <small class="muted">off by default</small></label><label><input type="checkbox" name="copyBuys" checked> Copy buys</label><label><input type="checkbox" name="copySells" checked> Copy sells</label><button class="btn primary" type="submit">Save Culture Lane</button></form><pre id="routeOut" style="display:none"></pre></section>
  <section class="card full" style="margin-top:16px"><h3>WISDO Risk Dial</h3><p class="muted">Use this like the TraderConnect calculator: enter lead risk/lot and receiver target, then apply the recommended CEM risk mode.</p><div class="grid3"><label>Risk style<select id="riskDialType"><option value="percent">Percentage based</option><option value="lot">Lot based</option><option value="fixed">Fixed lot every trade</option></select></label><label>Lead risk %<input id="leadRiskPct" type="number" step="0.01" value="1"></label><label>Receiver risk %<input id="receiverRiskPct" type="number" step="0.01" value="1"></label><label>Lead lot<input id="leadLot" type="number" step="0.01" value="0.03"></label><label>Receiver lot<input id="receiverLot" type="number" step="0.01" value="0.01"></label><label>Receiver balance<input id="receiverBalance" type="number" step="1" value="1000"></label><button class="btn primary" onclick="applyRiskDial();return false;">Apply to form</button></div><div class="grid2" style="margin-top:12px"><section class="card"><h3>Recommended Mode</h3><div class="metric green" id="calcAnswer">Fixed Culture Lot</div><p id="calcExplain" class="muted"></p></section><section class="card"><h3>Default Safety</h3><span class="tag green">Close receiver when lead closes</span><span class="tag gold">Copy SL/TP off</span><span class="tag gold">Copy pending off</span><span class="tag">Symbol map required per broker</span></section></div></section>
  <section class="card full" style="margin-top:16px"><h3>Bot Lane Matrix</h3><p class="muted">Every linked reporter can represent one account, one bot, one symbol lane, or many adaptive bot lanes. This is the desk view for many bots running from you or the community.</p><table><thead><tr><th>Account</th><th>Bot / Lane</th><th>Symbol</th><th>Magic</th><th>Status</th><th>Open</th></tr></thead><tbody>${botLanes || '<tr><td colspan="6">No bot lanes detected yet. Reporter snapshots will fill this in.</td></tr>'}</tbody></table></section>
  <section class="card full" id="discover" style="margin-top:16px"><h3>Community Active Reporter Discovery</h3><p class="muted">Other users can appear here when their reporter is active and their account is set to Culture Lead, Dual Lane, signal-only, or copy-ready. Request access first; approval creates a shared reporter on your desk.</p><form id="requestForm" class="grid3"><label>Other Active Reporter<select name="accountId" id="discoverSelect">${discoverableOptions || '<option value="">No community reporters visible yet</option>'}</select></label><input name="ownerUserId" id="discoverOwner" placeholder="Owner Discord ID auto-filled or paste"><select name="permission"><option value="copy_allowed">Copy Allowed</option><option value="signal_only">Signal Only</option><option value="view_only">View Only</option><option value="control_allowed">Control Allowed</option></select><input name="note" placeholder="Message to owner e.g. Let me copy XAU bot"><button class="btn primary" type="submit">Request Culture Access</button></form><pre id="requestOut" style="display:none"></pre><div class="grid3" style="margin-top:16px">${discoverCards || '<section class="card full"><h3>No public reporters yet</h3><p>Once another user marks an account as Culture Lead / Dual Lane / copy-ready and it syncs recently, it appears here.</p></section>'}</div></section>
  <section class="card full" id="broker-link" style="margin-top:16px"><h3>Live Broker Account Link</h3><p class="muted">Members can type broker login/account info, WISDO creates a live pending reporter record, generates a pairing code, and the account immediately appears in desk dropdowns. For safety, broker passwords are rejected; verification completes when the MT4 Reporter syncs.</p><form id="brokerLinkForm" class="grid3"><select name="platform"><option>MT4</option><option>MT5</option></select><input name="brokerName" placeholder="Broker e.g. Coinexx"><input name="brokerServer" placeholder="Server e.g. Coinexx-Demo"><input name="brokerLogin" placeholder="Broker login / account number"><select name="accountType"><option value="demo">Demo</option><option value="live">Live</option></select><select name="desiredRole"><option value="leader">Culture Lead</option><option value="follower">Mirror Receiver</option><option value="both">Dual Lane</option><option value="private">Private Desk</option></select><select name="connectionMode"><option value="reporter_pairing">Reporter pairing</option><option value="vps_assisted">VPS assisted setup</option><option value="manual_review">Manual review</option></select><input name="botName" placeholder="Bot name on this account"><input name="note" placeholder="Notes for setup"><button class="btn primary" type="submit">Create Live Pending Account + Pairing</button></form><pre id="brokerOut" style="display:none"></pre><table style="margin-top:16px"><thead><tr><th>Platform</th><th>Broker</th><th>Login</th><th>Role</th><th>Status</th><th>Pairing / Action</th></tr></thead><tbody>${brokerRows || '<tr><td colspan="6">No broker link requests yet.</td></tr>'}</tbody></table></section>
  <section class="card full" style="margin-top:16px"><h3>Active Culture Lanes</h3><table><thead><tr><th>Culture Lead</th><th>Mirror Receiver</th><th>Status</th><th>Risk</th><th></th></tr></thead><tbody>${routeRows || '<tr><td colspan="5">No Culture Lanes yet.</td></tr>'}</tbody></table></section>
  <section class="card full" style="margin-top:16px"><h3>Reporter Shares + Access Requests</h3><div class="grid2"><div><h3>Share one of my reporters</h3><form id="shareForm" class="grid3"><label>My reporter<select name="accountId">${ownedShareOptions || '<option value="">No owned accounts yet</option>'}</select></label><input name="targetUserId" placeholder="Target Discord User ID"><select name="permission"><option value="view_only">View Only</option><option value="signal_only">Signal Only</option><option value="copy_allowed">Copy Allowed</option><option value="control_allowed">Control Allowed</option><option value="admin">Admin</option></select><button class="btn primary" type="submit">Share Reporter</button></form><pre id="shareOut" style="display:none"></pre></div><div><h3>Access Requests</h3><table><thead><tr><th>Type</th><th>Account</th><th>Other User</th><th>Permission</th><th>Status</th><th>Action</th></tr></thead><tbody>${requestRows || '<tr><td colspan="6">No access requests yet.</td></tr>'}</tbody></table></div></div><h3>Active Shares</h3><table><thead><tr><th>Side</th><th>Account</th><th>Other User</th><th>Permission</th><th></th></tr></thead><tbody>${shareRows || '<tr><td colspan="5">No shared reporters yet.</td></tr>'}</tbody></table></section>
  <section class="card full" style="margin-top:16px"><h3>Edit Receiver Risk Profile</h3><form id="riskForm" class="grid3"><label>Account<select name="accountId" id="riskAccount">${accountSelectOptions(ownedAccounts, '')}</select></label><select name="mode"><option value="fixed_lot">Fixed Culture Lot</option><option value="multiplier">Lane Multiplier</option><option value="same_lot">Match Leader Lot</option><option value="equity_ratio">Balance Bridge</option><option value="risk_percent">Culture % Risk</option></select><input name="fixedLot" placeholder="Fixed lot" value="0.01"><input name="multiplier" placeholder="Multiplier" value="1"><input name="maxLot" placeholder="Max lot" value="0.05"><input name="maxOpenTrades" placeholder="Max open trades" value="5"><input name="equityFloor" placeholder="Equity floor" value="0"><input name="allowedSymbolsCsv" placeholder="Allowed symbols"><label><input type="checkbox" name="copySLTP"> Copy SL/TP</label><label><input type="checkbox" name="copyPendingOrders"> Copy pending orders</label><button class="btn primary" type="submit">Save Receiver Risk</button></form><pre id="riskOut" style="display:none"></pre></section>
  <script>
  const discoverOwners = ${JSON.stringify(Object.fromEntries(discoverableAccounts.map((a) => [String(a.accountId), String(a.ownerUserId || a.discordUserId || '')])))};
  const byId=(id)=>document.getElementById(id); const formJson=(form)=>Object.fromEntries(new FormData(form).entries());
  function applyRiskDial(){const type=byId('riskDialType')?.value||'fixed';const leadRisk=Number(byId('leadRiskPct')?.value||1);const recvRisk=Number(byId('receiverRiskPct')?.value||1);const leadLot=Number(byId('leadLot')?.value||0.01);const recvLot=Number(byId('receiverLot')?.value||0.01);let mode='fixed_lot',mult=1,fixed=recvLot,answer='Fixed Culture Lot',explain='Use a fixed receiver lot for every mirrored trade.';if(type==='percent'){mode='equity_ratio';mult=leadRisk>0?recvRisk/leadRisk:1;answer='Balance Bridge';explain='Lead risk '+leadRisk+'% → receiver risk '+recvRisk+'%. Risk setting '+(mult*100).toFixed(2)+'%.';}if(type==='lot'){mode='multiplier';mult=leadLot>0?recvLot/leadLot:1;answer='Lane Multiplier';explain='Lead lot '+leadLot+' → receiver lot '+recvLot+'. Multiplier '+(mult*100).toFixed(2)+'%.';}if(type==='fixed'){mode='fixed_lot';fixed=recvLot;answer='Fixed Culture Lot';explain='Every receiver trade uses '+fixed.toFixed(2)+' lots unless max lot blocks it.';}byId('routeMode').value=mode;byId('routeMultiplier').value=mult.toFixed(4);byId('routeRiskSettingPercent').value=(mult*100).toFixed(2);byId('routeFixedLot').value=fixed.toFixed(2);byId('calcAnswer').textContent=answer;byId('calcExplain').textContent=explain;}
  function selectLead(id){byId('leaderSelect').value=id;byId('add-lane').scrollIntoView({behavior:'smooth'});} function selectDiscover(id,owner){byId('discoverSelect').value=id;byId('discoverOwner').value=owner||discoverOwners[id]||'';byId('requestForm').scrollIntoView({behavior:'smooth'});} byId('discoverSelect')?.addEventListener('change',(e)=>{byId('discoverOwner').value=discoverOwners[e.target.value]||'';});
  async function saveRole(id){const role=byId('role-'+id).value;const res=await fetch('/api/me/accounts/'+encodeURIComponent(id)+'/settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountRole:role,copyPermission:role==='leader'?'signal_only':role==='follower'?'copy_allowed':role==='both'?'copy_allowed':'private',visibility:role==='private'?'private':'desk'})});alert(JSON.stringify(await res.json(),null,2));location.reload();}
  byId('routeForm')?.addEventListener('submit',async(e)=>{e.preventDefault();const raw=formJson(e.target);const communityOwner=discoverOwners[raw.leaderAccountId]||'';if(communityOwner){const req=await fetch('/api/me/access-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountId:raw.leaderAccountId,ownerUserId:communityOwner,permission:'copy_allowed',note:'Requested from Add Culture Lane dropdown'})});const json=await req.json();byId('routeOut').style.display='block';byId('routeOut').textContent=JSON.stringify({ok:json.ok,message:json.ok?'Culture access request sent. After the owner approves, this reporter becomes a live selectable Culture Lead for routing.':'Access request failed',result:json},null,2);if(json.ok)setTimeout(()=>location.reload(),900);return;}const body={leaderAccountId:raw.leaderAccountId,followerAccountId:raw.followerAccountId,status:raw.status,risk:raw};const res=await fetch('/api/me/copy-routes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const json=await res.json();byId('routeOut').style.display='block';byId('routeOut').textContent=JSON.stringify(json,null,2);if(json.ok)setTimeout(()=>location.reload(),600);});
  byId('shareForm')?.addEventListener('submit',async(e)=>{e.preventDefault();const raw=formJson(e.target);const res=await fetch('/api/me/account-shares',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(raw)});const json=await res.json();byId('shareOut').style.display='block';byId('shareOut').textContent=JSON.stringify(json,null,2);if(json.ok)setTimeout(()=>location.reload(),600);});
  byId('requestForm')?.addEventListener('submit',async(e)=>{e.preventDefault();const raw=formJson(e.target);if(!raw.ownerUserId)raw.ownerUserId=discoverOwners[raw.accountId]||'';const res=await fetch('/api/me/access-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(raw)});const json=await res.json();byId('requestOut').style.display='block';byId('requestOut').textContent=JSON.stringify(json,null,2);if(json.ok)setTimeout(()=>location.reload(),800);});
  byId('brokerLinkForm')?.addEventListener('submit',async(e)=>{e.preventDefault();const raw=formJson(e.target);const res=await fetch('/api/me/broker-link-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(raw)});const json=await res.json();byId('brokerOut').style.display='block';byId('brokerOut').textContent=JSON.stringify(json,null,2);if(json.ok)setTimeout(()=>location.reload(),900);});
  byId('riskForm')?.addEventListener('submit',async(e)=>{e.preventDefault();const raw=formJson(e.target);const accountId=raw.accountId;delete raw.accountId;const res=await fetch('/api/me/accounts/'+encodeURIComponent(accountId)+'/copy-risk',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(raw)});const json=await res.json();byId('riskOut').style.display='block';byId('riskOut').textContent=JSON.stringify(json,null,2);});
  async function deleteRoute(id){const res=await fetch('/api/me/copy-routes/'+encodeURIComponent(id),{method:'DELETE'});alert(JSON.stringify(await res.json(),null,2));location.reload();}
  async function deleteShare(id){const res=await fetch('/api/me/account-shares/'+encodeURIComponent(id),{method:'DELETE'});alert(JSON.stringify(await res.json(),null,2));location.reload();}
  async function approveRequest(id){const res=await fetch('/api/me/access-requests/'+encodeURIComponent(id)+'/approve',{method:'POST'});alert(JSON.stringify(await res.json(),null,2));location.reload();}
  async function rejectRequest(id){const res=await fetch('/api/me/access-requests/'+encodeURIComponent(id)+'/reject',{method:'POST'});alert(JSON.stringify(await res.json(),null,2));location.reload();}
  async function cancelBrokerLink(id){const res=await fetch('/api/me/broker-link-requests/'+encodeURIComponent(id),{method:'DELETE'});alert(JSON.stringify(await res.json(),null,2));location.reload();}
  function loadAccountRisk(id){byId('riskAccount').value=id;byId('riskForm').scrollIntoView({behavior:'smooth'});} applyRiskDial();
  </script>`;
}



function getMyMt4Rows(mt4 = {}, userId = '') {
  const uid = String(userId || 'website-buyer');
  return Object.values(mt4.connections || {})
    .filter((c) => String(c.discordUserId || c.userId || '') === uid)
    .map((c) => ({ ...c, latest: mt4.latestSnapshots?.[uid] || null }));
}

function setupPercent(checks = []) {
  if (!checks.length) return 0;
  return Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
}


function universalSetupPage(userId, mt4 = {}, state = {}) {
  const accounts = getMyMt4Rows(mt4, userId);
  const pending = Object.values(mt4.pairingCodes || {}).filter((p)=>String(p.discordUserId || p.userId || '')===String(userId) && String(p.status||'')==='pending');
  return `${sectionHero('Free Setup Center', 'Connect MT4, prepare WISDO commands, set risk, and become copy-ready before buying any bot.', '<a class="btn primary" href="/member/link-account">Generate / View Pairing</a><a class="btn" href="/member/mt4-webrequest-guide">WebRequest Guide</a>')}
  <section class="card ok full"><h3>No bot purchase required</h3><p>Users can set up the CultureCoin Reporter, connect MT4, use account dashboards, prepare copy trading, upload content, and run WISDO health checks without buying a paid bot. Bot purchases only unlock protected EA downloads, rentals, payment plans, VPS bundles, and licenses.</p></section>
  <div class="grid3"><section class="card"><h3>Connected Accounts</h3><div class="metric">${accounts.length}</div><p>${accounts.length ? 'MT4 is connected for this user.' : 'Connect your first MT4 account.'}</p><a class="btn primary" href="/member/link-account">Trade Link</a></section><section class="card"><h3>Pending Pairings</h3><div class="metric">${pending.length}</div><p>${pending[0] ? `Latest code: ${esc(pending[0].pairingCode)}` : 'No pending code yet.'}</p><a class="btn" href="/member/link-account">View Code</a></section><section class="card"><h3>Risk Profile</h3><p>Set default lot, max lot, max trades, and copy rules.</p><a class="btn" href="/member/risk-profile">Set Risk</a></section><section class="card"><h3>Leader Setup</h3><p>Report trades, post signals, appear in Copier Engine, and let followers request access.</p><a class="btn" href="/member/accounts">My Accounts</a></section><section class="card"><h3>Follower Setup</h3><p>Prepare a follower account for signal buttons and copy commands.</p><a class="btn" href="/member/copy-pro">Copy Readiness</a></section><section class="card"><h3>Paid Bots Optional</h3><p>When ready, buy, rent, or finance premium bots like DF SAUCE FINAL AI.</p><a class="btn" href="/member/bots">Browse Bots</a></section></div>`;
}

function operatorAutomationHomePage(userId, mt4 = {}, state = {}) {
  const accounts = getMyMt4Rows(mt4, userId);
  const licenses = state.licensesByUserId?.[String(userId)] || [];
  const videos = state.videosByUserId?.[String(userId)] || [];
  const checks = [
    { label: 'Discord login/profile', ok: !!userId && userId !== 'website-buyer' },
    { label: 'MT4 account connected', ok: accounts.length > 0 },
    { label: 'Setup unlocked', ok: true },
    { label: 'Risk profile created', ok: !!state.riskProfilesByUserId?.[String(userId)] },
    { label: 'Video/content uploaded', ok: videos.length > 0 },
  ];
  const percent = setupPercent(checks);
  const next = checks.find((c) => !c.ok)?.label || 'You are ready to operate.';
  return `${sectionHero('Operator Automation Home', 'Your guided CultureCoin setup center. WISDO shows what is connected, what is missing, and the next best action.', '<a class="btn primary" href="/member/onboarding">Continue Setup</a><a class="btn" href="/member/account-doctor">Run Account Doctor</a>')}
  <section class="card full"><h3>Setup Progress</h3><div class="metric">${percent}%</div><div class="progress-bar"><span style="width:${percent}%"></span></div><p class="muted">Next best action: ${esc(next === 'Setup unlocked' ? 'Connect MT4 or choose your setup path.' : next)}</p></section>
  <div class="grid3"><section class="card"><h3>Connected Accounts</h3><div class="metric">${accounts.length}</div><a class="btn" href="/member/link-account">Add Account</a></section><section class="card"><h3>Owned Bots</h3><div class="metric">${licenses.length}</div><a class="btn" href="/member/my-bots">My Bots</a></section><section class="card"><h3>Uploaded Videos</h3><div class="metric">${videos.length}</div><a class="btn" href="/member/content">Content Hub</a></section></div>
  <section class="card full" style="margin-top:16px"><h3>Checklist</h3><table><tr><th>Step</th><th>Status</th><th>Action</th></tr>${checks.map((c)=>`<tr><td>${esc(c.label)}</td><td>${c.ok ? '<span class="tag green">Complete</span>' : '<span class="tag gold">Needs Action</span>'}</td><td>${c.ok ? 'Done' : '<a class="btn" href="/member/onboarding">Fix</a>'}</td></tr>`).join('')}</table></section>`;
}

function onboardingWizardPage(userId, mt4 = {}, state = {}) {
  const accounts = getMyMt4Rows(mt4, userId);
  const licenses = state.licensesByUserId?.[String(userId)] || [];
  const steps = [
    ['01', 'Verify Discord Login', !!userId && userId !== 'website-buyer', '/login'],
    ['02', 'Choose Free Setup Path', true, '/member/setup'],
    ['03', 'Connect MT4 Account', accounts.length > 0, '/member/link-account'],
    ['04', 'Install Free Reporter / Bridge', true, '/member/mt4-webrequest-guide'],
    ['05', 'Set Risk Profile', !!state.riskProfilesByUserId?.[String(userId)], '/member/risk-profile'],
    ['06', 'Run Account Doctor', accounts.length > 0, '/member/account-doctor'],
    ['07', 'Shop Bots When Ready', true, '/member/bots'],
    ['08', 'Upload First Result', (state.videosByUserId?.[String(userId)] || []).length > 0, '/member/content'],
  ];
  return `${sectionHero('Smart Onboarding Wizard', 'WISDO guides every member from login to MT4 sync, risk settings, copy readiness, content, and bot shopping. Bot purchase is optional, not required for setup.', '<a class="btn primary" href="/member/home">Dashboard</a><a class="btn" href="/member/setup">Free Setup</a>')}
  <div class="grid2">${steps.map(([n,title,done,href])=>`<section class="card step"><div class="num">${n}</div><div><h3>${esc(title)}</h3><p>${done ? 'Complete.' : 'This step needs attention before the user is fully ready.'}</p><span class="tag ${done ? 'green' : 'gold'}">${done ? 'Complete' : 'Needs Action'}</span><a class="btn" href="${href}">${done ? 'Review' : 'Start'}</a></div></section>`).join('')}</div>`;
}

function mt4WebRequestGuidePage(config) {
  const base = config.api.publicBaseUrl || 'https://wisdo-mt4-api-bridge.onrender.com';
  return `${sectionHero('MT4 WebRequest Guide', 'Add your CultureCoin API URL in MT4 so the Reporter can sync snapshots and receive WISDO/copy commands.')}
  <div class="grid2"><section class="card"><h3>Allowed URL</h3><p><code>${esc(base)}</code></p><p>MT4: Tools → Options → Expert Advisors → Allow WebRequest for listed URL.</p></section><section class="card"><h3>Reporter URLs</h3><p>Sync: <code>${esc(base)}/mt4-sync</code></p><p>Command poll: <code>${esc(base)}/mt4-command-poll</code></p><p>Command complete: <code>${esc(base)}/mt4-command-complete</code></p></section></div>`;
}

function accountDoctorPage(userId, mt4 = {}) {
  const accounts = getMyMt4Rows(mt4, userId);
  const latest = accounts[0]?.latest;
  const s = latest?.snapshot || {};
  const age = latest?.receivedAt ? Math.round((Date.now() - new Date(latest.receivedAt).getTime()) / 1000) : null;
  const checks = [
    { name: 'Account connected', ok: accounts.length > 0, fix: 'Generate a pairing code and attach the Reporter.' },
    { name: 'Last sync fresh', ok: age !== null && age < 60, fix: 'Check WebRequest URL, API key, and terminal connection.' },
    { name: 'Terminal connected', ok: s.terminalConnected !== false && accounts.length > 0, fix: 'Reconnect internet/broker terminal.' },
    { name: 'Expert enabled', ok: s.expertEnabled !== false && accounts.length > 0, fix: 'Turn on AutoTrading and allow live trading in EA settings.' },
    { name: 'Margin healthy', ok: !s.marginLevel || Number(s.marginLevel) === 0 || Number(s.marginLevel) > 200, fix: 'Reduce exposure or add margin before copying.' },
  ];
  return `${sectionHero('Account Doctor', 'Quick health scan for MT4 sync, command readiness, and copy-trading preparation.', '<a class="btn" href="/member/mt4-webrequest-guide">WebRequest Guide</a>')}
  <section class="card full"><h3>Active Account</h3><p>${accounts[0] ? `${esc(accounts[0].accountNumber)} - ${esc(accounts[0].brokerServer || '')}` : 'No connected account found for this user.'}</p><p class="muted">Last sync age: ${age === null ? 'never' : `${age}s ago`}</p></section>
  <section class="card full"><h3>Doctor Results</h3><table><tr><th>Check</th><th>Status</th><th>Fix</th></tr>${checks.map((c)=>`<tr><td>${esc(c.name)}</td><td>${c.ok ? '<span class="tag green">Healthy</span>' : '<span class="tag red">Needs Fix</span>'}</td><td>${esc(c.fix)}</td></tr>`).join('')}</table></section>`;
}

function installWizardPage(slug, state = {}) {
  const bot = EA_CATALOG.find((b)=>slugify(b.name)===slug) || EA_CATALOG.find((b)=>b.recommended) || EA_CATALOG[0];
  const steps = [
    'Start free setup — no bot purchase required',
    'Download / install the free CultureCoin Reporter bridge',
    'Generate a pairing code from Discord or website Trade Link',
    'Enable WebRequest and AutoTrading in MT4',
    'Attach Reporter to a chart and paste the PairingCode',
    'Choose role: Leader, Follower, Both, or Private',
    'Run Account Doctor and verify sync',
    'Optional: buy/rent this bot or use a free/existing EA when ready',
    'After purchase/license unlock, download protected bot files from My Bots'
  ];
  return `${sectionHero(`Setup Wizard: ${esc(bot.name)}`, 'Free account setup, pairing, WebRequest, and copy-mode preparation. Buying a bot is optional and separate from connecting MT4.', `<a class="btn primary" href="/member/setup">Free Setup</a><a class="btn" href="/member/bots/${slugify(bot.name)}">Bot Detail</a>`)}<section class="card ok full"><h3>Setup is not locked behind purchase</h3><p>Every member can connect MT4, use the Reporter bridge, set risk profile, run Account Doctor, and prepare copy trading before buying any bot. Paid bots only control protected download/license access.</p><a class="btn primary" href="/member/link-account">Connect MT4</a><a class="btn" href="/member/account-doctor">Run Account Doctor</a></section><div class="grid2">${steps.map((s,i)=>`<section class="card step"><div class="num">${String(i+1).padStart(2,'0')}</div><div><h3>${esc(s)}</h3><p class="muted">Mark complete in your operations checklist after this is done.</p></div></section>`).join('')}</div>`;
}

function riskProfilePage(userId, state = {}) {
  const profile = state.copyRiskProfilesByUserId?.[String(userId)] || state.riskProfilesByUserId?.[String(userId)] || {};
  const checked = (value) => value ? 'checked' : '';
  return `${sectionHero('Risk Settings', 'Your Wisdo risk passport for Signal Grid, copy trading, and bot controls. Safe defaults are prefilled for beginner accounts.', '<a class="btn primary" href="/member/signal-grid">Signal Grid</a><a class="btn" href="/member/simulator">Simulator</a>')}
  <section class="card full"><h3>Copy Eligibility Checklist</h3><div class="grid3"><section class="card"><h3>Risk Profile</h3><div class="metric ${profile.acceptedRiskDisclaimer ? 'green' : 'gold'}">${profile.acceptedRiskDisclaimer ? 'Ready' : 'Needs Review'}</div><p>Accept the risk disclaimer before live copy.</p></section><section class="card"><h3>Paper Mode Default</h3><div class="metric">${profile.paperModeDefault ? 'On' : 'Off'}</div><p>Paper mode is safest while testing signal copy flows.</p></section><section class="card"><h3>Max Lot</h3><div class="metric">${esc(profile.maxLot || '0.05')}</div><p>No copy action can exceed this local setting.</p></section></div></section>
  <section class="card full" style="margin-top:16px"><form id="riskForm" class="grid3">
    <input name="userId" value="${esc(userId)}" placeholder="User ID">
    <select name="mode"><option value="fixed_lot" ${profile.mode === 'fixed_lot' ? 'selected' : ''}>Fixed lot</option><option value="risk_percent" ${profile.mode === 'risk_percent' ? 'selected' : ''}>Risk percent</option><option value="multiplier" ${profile.mode === 'multiplier' ? 'selected' : ''}>Multiplier</option><option value="equity_ratio" ${profile.mode === 'equity_ratio' ? 'selected' : ''}>Equity ratio</option></select>
    <input name="fixedLot" value="${esc(profile.fixedLot || profile.defaultLot || '0.01')}" placeholder="Fixed lot">
    <input name="riskPercent" value="${esc(profile.riskPercent || '1')}" placeholder="Risk per trade %">
    <input name="riskUsd" value="${esc(profile.riskUsd || '25')}" placeholder="Risk per trade $">
    <input name="maxDailyLossPercent" value="${esc(profile.maxDailyLossPercent || profile.maxDailyLoss || '5')}" placeholder="Max daily loss %">
    <input name="maxWeeklyLossPercent" value="${esc(profile.maxWeeklyLossPercent || '10')}" placeholder="Max weekly loss %">
    <input name="maxOpenTrades" value="${esc(profile.maxOpenTrades || '5')}" placeholder="Max open trades">
    <input name="maxSymbolExposure" value="${esc(profile.maxSymbolExposure || '2')}" placeholder="Max symbol exposure">
    <input name="maxDrawdownPercent" value="${esc(profile.maxDrawdownPercent || '10')}" placeholder="Max floating drawdown %">
    <input name="maxSpread" value="${esc(profile.maxSpread || '30')}" placeholder="Max spread">
    <input name="maxSlippage" value="${esc(profile.maxSlippage || '10')}" placeholder="Max slippage">
    <input name="minLot" value="${esc(profile.minLot || '0.01')}" placeholder="Min lot">
    <input name="maxLot" value="${esc(profile.maxLot || '0.05')}" placeholder="Max lot">
    <input name="lotStep" value="${esc(profile.lotStep || '0.01')}" placeholder="Lot step">
    <input name="allowedSymbolsCsv" value="${esc((profile.allowedSymbols || []).join(',') || 'XAUUSD')}" placeholder="Allowed symbols CSV">
    <label><input type="checkbox" name="paperModeDefault" ${checked(profile.paperModeDefault)}> Paper mode by default</label>
    <label><input type="checkbox" name="liveCopyRequiresConfirmation" ${checked(profile.liveCopyRequiresConfirmation !== false)}> Live copy requires confirmation</label>
    <label><input type="checkbox" name="acceptedRiskDisclaimer" ${checked(profile.acceptedRiskDisclaimer)}> I understand trading and copy trading can lose money.</label>
    <button class="btn primary" type="submit">Save Risk Settings</button>
    <button class="btn" type="button" id="safePreset">Safe Preset</button>
    <button class="btn" type="button" id="goldPreset">Gold/XAU Preset</button>
  </form><pre id="riskResult" class="checkout-result"></pre></section>${riskDisclosureBlock()}<script>
  const riskForm=document.getElementById('riskForm');
  function setRisk(values){for(const [k,v] of Object.entries(values)){const el=riskForm.elements[k];if(!el)continue;if(el.type==='checkbox')el.checked=Boolean(v);else el.value=v;}}
  document.getElementById('safePreset')?.addEventListener('click',()=>setRisk({mode:'risk_percent',riskPercent:0.5,riskUsd:10,maxDailyLossPercent:3,maxWeeklyLossPercent:6,maxOpenTrades:3,maxSymbolExposure:1,maxDrawdownPercent:6,maxSpread:25,maxSlippage:8,minLot:0.01,maxLot:0.03,lotStep:0.01,paperModeDefault:true,liveCopyRequiresConfirmation:true,allowedSymbolsCsv:'XAUUSD,EURUSD,GBPUSD'}));
  document.getElementById('goldPreset')?.addEventListener('click',()=>setRisk({mode:'risk_percent',riskPercent:0.75,riskUsd:20,maxDailyLossPercent:4,maxWeeklyLossPercent:8,maxOpenTrades:4,maxSymbolExposure:2,maxDrawdownPercent:8,maxSpread:35,maxSlippage:10,minLot:0.01,maxLot:0.05,lotStep:0.01,paperModeDefault:true,liveCopyRequiresConfirmation:true,allowedSymbolsCsv:'XAUUSD'}));
  riskForm?.addEventListener('submit',async(e)=>{e.preventDefault();const out=document.getElementById('riskResult');out.style.display='block';const data=Object.fromEntries(new FormData(e.target).entries());data.paperModeDefault=Boolean(e.target.paperModeDefault.checked);data.liveCopyRequiresConfirmation=Boolean(e.target.liveCopyRequiresConfirmation.checked);data.acceptedRiskDisclaimer=Boolean(e.target.acceptedRiskDisclaimer.checked);const res=await fetch('/api/me/risk-profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});out.textContent=JSON.stringify(await res.json(),null,2);});
  </script>`;
}

function wisdoAccountSwitcher(desk = {}) {
  const options = (desk.accounts || []).map((account) => `<option value="${esc(account.accountId)}" ${String(desk.selectedAccountId) === String(account.accountId) ? 'selected' : ''}>${esc(account.nickname || account.accountNumber || account.accountId)} - ${esc(account.accountType)} - ${esc(account.connectionStatus)}</option>`).join('');
  return `<section class="card full" style="border-color:rgba(108,182,255,.5)"><div class="row" style="justify-content:space-between;align-items:center"><div><h3>Wisdo Desk Account Switcher</h3><p class="muted">Selected account persists across dashboard, copier, education, simulator, marketplace, and mobile pages.</p></div><div class="row"><select id="wisdoAccountSelect">${options || '<option value="">Connect an account</option>'}</select><button class="btn primary" id="saveWisdoAccount">Use Account</button></div></div></section>`;
}

function accountSummaryCards(desk = {}) {
  const account = (desk.accounts || []).find((a) => String(a.accountId) === String(desk.selectedAccountId)) || desk.accounts?.[0] || {};
  return `<div class="grid">
    <section class="card"><h3>Balance</h3><div class="metric">${money(account.balance)}</div><p>${esc(account.broker || account.server || 'Broker pending')}</p></section>
    <section class="card"><h3>Equity</h3><div class="metric ${Number(account.equity || 0) >= Number(account.balance || 0) ? 'green' : 'red'}">${money(account.equity)}</div><p>Floating ${money(account.floatingPL)}</p></section>
    <section class="card"><h3>Open / Closed</h3><div class="metric">${Number(account.openTrades || 0)} / ${Number(account.closedTrades || 0)}</div><p>${esc(account.platform || 'MT4')} ${esc(account.accountType || '')}</p></section>
    <section class="card"><h3>Status</h3><div class="metric">${esc(account.connectionStatus || 'pending')}</div><p>Risk mode ${esc(account.riskMode || 'fixed_risk')}</p></section>
  </div>`;
}

function wisdoCommandCenterPage({ userId, desk, state, config }) {
  const selected = (desk.accounts || []).find((a) => String(a.accountId) === String(desk.selectedAccountId)) || desk.accounts?.[0] || {};
  const theme = state.themePreferencesByUserId?.[String(userId)]?.theme || 'neon';
  const notifications = (state.notificationsByUserId?.[String(userId)] || []).slice(0, 6);
  const noteRows = notifications.map((n) => `<tr><td>${esc(n.title)}</td><td>${esc(n.type)}</td><td>${esc(n.status)}</td><td>${esc(n.createdAt)}</td></tr>`).join('');
  const themeOptions = Object.entries(WISDO_THEMES).map(([key, item]) => `<option value="${esc(key)}" ${theme === key ? 'selected' : ''}>${esc(item.label)}</option>`).join('');
  const botOptions = EA_CATALOG.slice(0, 60).map((bot) => `<option value="${slugify(bot.name)}">${esc(bot.name)}</option>`).join('');
  const roleSync = state.roleSyncByUserId?.[String(userId)] || {};
  const roleTags = (roleSync.wisdoRoles || roleSync.internalRoles || ['guest']).map((role) => `<span class="tag">${esc(role)}</span>`).join('');
  const discordRoleTags = (roleSync.matchedDiscordRoles || []).map((role) => `<span class="tag green">${esc(role)}</span>`).join('');
  return `${sectionHero('Wisdo Command Center', 'Connect. Copy. Control. A live trading desk with persistent account switching, safe commands, copy risk, marketplace, education, simulator, and voice-ready intent architecture.', '<a class="btn primary" href="/member/link-account">Connect Account</a><a class="btn" href="/member/copy-pro">Copy Center</a>')}
  ${wisdoAccountSwitcher(desk)}
  ${accountSummaryCards(desk)}
  <div class="grid2" style="margin-top:16px">
    <section class="card warn"><h3>Safe Account Actions</h3><p class="muted">Trade-affecting actions queue through the MT4 command bridge and require confirmation in the UI flow.</p><div class="grid3">
      ${['close_all','close_profitable','close_losing','pause_bot','resume_bot','sync_account','refresh_bridge','disconnect_account'].map((action) => `<button class="btn ${action.includes('close') || action.includes('disconnect') ? 'primary' : ''}" data-safe-action="${action}">${esc(action.replaceAll('_', ' '))}</button>`).join('')}
    </div><pre id="commandOut" class="checkout-result"></pre></section>
    <section class="card"><h3>Discord Role Sync</h3><p class="muted">Access level: <strong>${esc(roleSync.accessLevel || 'none')}</strong>${roleSync.stale ? ' • stale/cache fallback' : ''}</p><p>${discordRoleTags || '<span class="tag gold">No mapped Discord roles synced</span>'}</p><p>${roleTags}</p><button class="btn primary" id="refreshRoles">Refresh Roles</button><a class="btn" href="/api/wisdo/me/roles">Role API</a><pre id="rolesOut" class="checkout-result"></pre></section>
    <section class="card"><h3>User Theme</h3><p class="muted">Theme preference is saved per user and returned to every Wisdo module API.</p><select id="themeSelect">${themeOptions}</select><button class="btn primary" id="saveTheme">Save Theme</button><pre id="themeOut" class="checkout-result"></pre></section>
  </div>
  <section class="card full" style="margin-top:16px"><h3>Risk-Based Copy Calculator</h3><form id="riskCalcForm" class="grid3">
    <input name="balance" value="${Number(selected.balance || 1000)}" placeholder="Balance">
    <input name="equity" value="${Number(selected.equity || selected.balance || 1000)}" placeholder="Equity">
    <select name="riskMode"><option value="percent">Percent risk</option><option value="fixed_usd">Fixed dollar risk</option></select>
    <input name="riskPercent" value="1" placeholder="Risk %">
    <input name="riskUsd" value="25" placeholder="Risk USD">
    <input name="stopDistancePips" value="50" placeholder="Stop distance pips">
    <input name="pipValuePerLot" value="10" placeholder="Pip value per 1.00 lot">
    <input name="minLot" value="0.01" placeholder="Min lot">
    <input name="maxLot" value="0.05" placeholder="Max lot">
    <input name="lotStep" value="0.01" placeholder="Broker step">
    <input name="maxSpread" value="30" placeholder="Max spread">
    <input name="maxSlippage" value="10" placeholder="Max slippage">
    <button class="btn primary" type="submit">Calculate Copy Size</button>
  </form><pre id="riskCalcOut" class="checkout-result"></pre></section>
  <div class="grid3" style="margin-top:16px">
    <section class="card"><h3>Marketplace Quick Filter</h3><select id="botSelect">${botOptions}</select><div class="row"><a class="btn primary" href="/member/bots">Open Marketplace</a><a class="btn" href="/member/education">Learn Bot</a><a class="btn" href="/member/simulator">Simulate</a></div></section>
    <section class="card"><h3>Voice Foundation</h3>${WISDO_VOICE_INTENTS.map((i) => `<span class="tag ${i.confirmationRequired ? 'gold' : 'green'}">${esc(i.intent)}</span>`).join('')}<p class="muted">Dangerous future voice actions require confirmation and permissions.</p><a class="btn" href="/api/wisdo/voice/intents">Voice API</a></section>
    <section class="card"><h3>Model Registry</h3><div class="metric">${WISDO_MODEL_REGISTRY.length}</div><p>Backend-ready model names are exposed at <code>/api/wisdo/models</code>.</p></section>
  </div>
  <section class="card full" style="margin-top:16px"><h3>Notifications</h3><table><thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Created</th></tr></thead><tbody>${noteRows || '<tr><td colspan="4">No notifications yet.</td></tr>'}</tbody></table></section>${riskDisclosureBlock()}
  <script>
  const userId=${JSON.stringify(userId)};
  const selectedAccount=()=>document.getElementById('wisdoAccountSelect')?.value||'';
  function show(id,data){const out=document.getElementById(id);out.style.display='block';out.textContent=typeof data==='string'?data:JSON.stringify(data,null,2);}
  document.getElementById('saveWisdoAccount')?.addEventListener('click',async()=>{const res=await fetch('/api/wisdo/account-selection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountId:selectedAccount()})});show('commandOut',await res.json());});
  document.getElementById('saveTheme')?.addEventListener('click',async()=>{const res=await fetch('/api/wisdo/theme',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({theme:document.getElementById('themeSelect').value})});show('themeOut',await res.json());});
  document.getElementById('refreshRoles')?.addEventListener('click',async()=>{const res=await fetch('/api/wisdo/me/roles/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});show('rolesOut',await res.json());});
  document.querySelectorAll('[data-safe-action]').forEach((btn)=>btn.addEventListener('click',async()=>{const action=btn.dataset.safeAction;const destructive=['close_all','close_profitable','close_losing','disconnect_account'].includes(action);if(destructive&&!confirm('Confirm '+action.replaceAll('_',' ')+' for selected account?'))return;const res=await fetch('/api/wisdo/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,accountId:selectedAccount(),action,confirmation:destructive?'confirmed':'not_required'})});show('commandOut',await res.json());}));
  document.getElementById('riskCalcForm')?.addEventListener('submit',async(e)=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target).entries());data.accountId=selectedAccount();const res=await fetch('/api/wisdo/risk/calculate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});show('riskCalcOut',await res.json());});
  </script>`;
}

function wisdoEducationPage(state = {}, userId = '', botSlug = '') {
  const slug = botSlug || slugify(EA_CATALOG.find((b) => b.recommended)?.name || EA_CATALOG[0]?.name || 'wisdo');
  const progressCount = Object.keys(state.lessonProgressByUserId?.[String(userId)] || {}).length;
  return `${sectionHero('Wisdo Education Portal', 'Bot education, Signal Grid safety, PIP DRILL practice, FLOW reading, and copy-trading readiness all render inside the member portal.', '<a class="btn primary" href="/member/academy">Open Trading Academy</a><a class="btn" href="/member/simulator?bot='+encodeURIComponent(slug)+'">Open Simulator</a><a class="btn" href="/member/signal-grid">Signal Grid</a>')}
  <section class="card full"><div class="row" style="justify-content:space-between;align-items:center"><div><span class="tag gold">Education dashboard</span><h3>Wisdo Academy</h3><p class="muted">Educational starter content - admin can replace/edit later.</p></div><div class="row"><button id="refreshRolesEducation" class="btn" type="button">Refresh Discord Roles</button><a class="btn" href="/member/command-center">Command Center</a></div></div></section>
  <section class="card full"><h3>Bot Education Selector</h3><form id="educationFilters" class="grid3" novalidate>
    <div class="field"><label>Bot education path</label><select id="educationBot" name="bot">${EA_CATALOG.map((bot) => `<option value="${slugify(bot.name)}" ${slugify(bot.name) === slug ? 'selected' : ''}>${esc(bot.name)}</option>`).join('')}<option value="unknown-empty-bot" ${slug === 'unknown-empty-bot' ? 'selected' : ''}>Unknown empty bot</option></select></div>
    <div class="field"><label>Search/filter</label><input id="educationSearch" name="q" placeholder="Search modules, lessons, risk, Signal Grid"></div>
    <div class="field"><label>Track</label><select id="educationTrack" name="track"><option value="">All tracks</option><option>PIP DRILL section</option><option>FLOW section</option><option>Signal Grid education</option><option>Copy trading safety education</option><option>Bot-specific education</option></select></div>
  </form></section>
  <div class="grid3"><section class="card"><h3>Progress</h3><div class="metric">${progressCount}</div><p>Lesson progress placeholders are ready for completion events.</p></section><section class="card"><h3>Required Education</h3><p>High-risk bots can require education before activation or copy approval.</p></section><section class="card"><h3>Core Tracks</h3><span class="tag">PIP DRILL</span><span class="tag">FLOW</span><span class="tag">Signal Grid</span><span class="tag">Copy Safety</span></section></div>
  <section id="educationAccess" class="card full" style="margin-top:16px"></section>
  <section id="educationStatus" class="card full" style="margin-top:16px;display:none"></section>
  <section id="educationOverview" class="full" style="margin-top:16px"></section>
  <section id="educationModules" class="full" style="margin-top:16px"></section>
  <section id="educationQuizzes" class="card full" style="margin-top:16px"></section>
  <section id="educationEmpty" class="card full" style="margin-top:16px;display:none"></section>
  ${riskDisclosureBlock()}
  <script>
  const educationBot=document.getElementById('educationBot');
  const educationSearch=document.getElementById('educationSearch');
  const educationTrack=document.getElementById('educationTrack');
  const accessEl=document.getElementById('educationAccess');
  const statusEl=document.getElementById('educationStatus');
  const overviewEl=document.getElementById('educationOverview');
  const modulesEl=document.getElementById('educationModules');
  const quizzesEl=document.getElementById('educationQuizzes');
  const emptyEl=document.getElementById('educationEmpty');
  let educationPayload=null;
  const escHtml=(v)=>String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function showEducationStatus(kind,msg){statusEl.style.display='block';statusEl.className='card full '+(kind==='error'?'warn':kind==='ok'?'ok':'');statusEl.innerHTML='<h3>'+escHtml(kind==='loading'?'Loading education...':kind==='error'?'Education Error':'Education Loaded')+'</h3><p>'+escHtml(msg)+'</p>';}
  function normalizeModules(payload){const raw=payload?.modules;if(Array.isArray(raw))return raw;if(raw&&typeof raw==='object')return Object.values(raw).flat();return [];}
  function lessonTitle(id,payload){const lesson=payload?.lessons?.[id];return lesson?.title||id;}
  function lessonSummary(id,payload){return payload?.lessons?.[id]?.summary||'Lesson placeholder ready for admin content.';}
  function accessCard(access={}){const gates=access.gates||{};const stale=access.stale?'<section class="card warn full" style="margin-top:12px"><h3>Discord role sync is using cached/local access.</h3><p>Refresh roles to verify current membership.</p></section>':'';accessEl.innerHTML='<div class="row" style="justify-content:space-between;align-items:center"><div><h3>Access Status</h3><p>Access level: <strong>'+escHtml(access.accessLevel||'none')+'</strong></p><p><span class="tag '+(gates.admin?'green':'')+'">Admin access: '+(gates.admin?'unlocked':'locked')+'</span><span class="tag '+(gates.copier?'green':'')+'">Copier access: '+(gates.copier?'unlocked':'locked')+'</span><span class="tag '+(gates.copyRequest?'green':'')+'">Copy request access: '+(gates.copyRequest?'unlocked':'locked')+'</span></p></div><div><span class="tag">'+escHtml(access.source||'unknown')+'</span><span class="tag">'+escHtml(access.lastSyncedAt||'not synced')+'</span></div></div>'+stale;}
  function overviewCard(botSlug){overviewEl.innerHTML='<div class="grid3"><section class="card"><h3>DF Sauce Final AI education path</h3><p>How the bot reads the market, which conditions it likes, what settings change, and where Signal Grid fits before copy activation.</p></section><section class="card"><h3>PIP DRILL section</h3><p>Practice simulator reads, risk math, and decision timeline review before trading live.</p></section><section class="card"><h3>FLOW section</h3><p>Learn trend, pullback, consolidation, news, and spread behavior as a repeatable operator routine.</p></section></div>';}
  function moduleCard(module,payload){const lessons=(module.lessons||[]).map((id)=>'<li><strong>'+escHtml(lessonTitle(id,payload))+'</strong><p class="muted">'+escHtml(lessonSummary(id,payload))+'</p></li>').join('');const lock=module.locked?'<span class="tag gold">Locked</span>':'<span class="tag green">Unlocked</span>';return '<section class="card"><div class="row" style="justify-content:space-between"><span class="tag">'+escHtml(module.track||module.type||'Track')+'</span>'+lock+'</div><h3>'+escHtml(module.title)+'</h3><p class="muted">'+escHtml(module.seedNote||'Educational starter content - admin can replace/edit later.')+'</p><ul>'+lessons+'</ul><div class="row"><button class="btn" type="button">Quiz/progress placeholder</button><a class="btn" href="/member/simulator?bot='+encodeURIComponent(module.botSlug||educationBot.value)+'">Open simulator</a></div></section>';}
  function renderEducation(){if(!educationPayload)return;const payload=educationPayload;const access=payload.access||{};accessCard(access);overviewCard(payload.botSlug);const q=educationSearch.value.trim().toLowerCase();const track=educationTrack.value;let modules=normalizeModules(payload);modules=modules.filter((m)=>{const hay=[m.title,m.track,m.type,(m.lessons||[]).map((id)=>lessonTitle(id,payload)).join(' ')].join(' ').toLowerCase();return (!q||hay.includes(q))&&(!track||m.track===track);});modulesEl.innerHTML=modules.length?'<div class="grid2">'+modules.map((m)=>moduleCard(m,payload)).join('')+'</div>':'';const quizzes=Object.values(payload.quizzes||{}).filter((quiz)=>!payload.botSlug||quiz.botSlug===payload.botSlug);quizzesEl.innerHTML='<h3>Quiz/progress placeholders</h3><div class="grid3">'+(quizzes.length?quizzes.map((quiz)=>'<section class="card"><h3>'+escHtml(quiz.title)+'</h3><p>'+escHtml(quiz.status||'placeholder')+'</p><p class="muted">'+escHtml(quiz.seedNote||'Ready for quiz questions.')+'</p></section>').join(''):'<section class="card"><h3>No quizzes yet</h3><p>Quiz placeholders will appear when admin content is added.</p></section>')+'</div>';const empty=!normalizeModules(payload).length;emptyEl.style.display=empty?'block':'none';if(empty){emptyEl.innerHTML='<h3>No education modules found for this bot yet.</h3><p>Select another bot or use the simulator while an admin adds this path.</p><div class="row"><a class="btn primary" href="/member/simulator?bot='+encodeURIComponent(payload.botSlug||educationBot.value)+'">Open simulator</a><a class="btn" href="/member/education">Back to education dashboard</a>'+(access.gates?.admin?'<a class="btn" href="/admin/wisdo">Create starter education</a>':'')+'</div>';}showEducationStatus('ok','Education rendered inside the Wisdo member portal.');}
  async function loadEducation(){const bot=educationBot.value;const url=new URL(window.location.href);url.searchParams.set('bot',bot);history.replaceState(null,'',url.pathname+'?'+url.searchParams.toString());showEducationStatus('loading','Loading bot education modules...');try{const res=await fetch('/api/wisdo/education?bot='+encodeURIComponent(bot),{headers:{'Accept':'application/json'}});const json=await res.json();if(!res.ok||!json.ok)throw new Error(json.error||'Education API failed.');educationPayload=json;renderEducation();}catch(error){showEducationStatus('error',error.message||'Unable to load education.');}}
  async function refreshRoles(){try{showEducationStatus('loading','Refreshing Discord roles...');const res=await fetch('/api/wisdo/me/roles/refresh',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({})});const json=await res.json().catch(()=>({ok:false,error:'Discord role refresh returned invalid JSON.'}));if(json.access){educationPayload={...(educationPayload||{}),access:json.access};renderEducation();}if(!res.ok||!json.ok)throw new Error(json.error||'Discord API unavailable.');showEducationStatus('ok','Role refresh completed.');}catch(error){showEducationStatus('error',(error.message||'Role refresh failed.')+' Keeping current access on screen.');if(educationPayload)renderEducation();}}
  educationBot.addEventListener('change',loadEducation);
  educationSearch.addEventListener('input',renderEducation);
  educationTrack.addEventListener('change',renderEducation);
  document.getElementById('refreshRolesEducation')?.addEventListener('click',refreshRoles);
  loadEducation();
  </script>`;
}

function wisdoAcademyPage(selectedTrack = '') {
  const trackLinks = academyTrackDefinitions().map((track) => `<a class="btn" href="/member/academy/${encodeURIComponent(track.slug)}">${esc(track.title)}</a>`).join('');
  return `${sectionHero('Wisdo Trading Academy', 'Learn trading foundations, candles, market structure, liquidity, risk, copy safety, Signal Grid, bots, news, psychology, PIP DRILL, FLOW, and DF Sauce before activating live copy.', '<a class="btn primary" href="/member/simulator">Simulator</a><a class="btn" href="/member/signal-grid">Signal Grid</a><a class="btn" href="/member/bots">Bot Marketplace</a>')}
  <section class="card full"><div class="row" style="justify-content:space-between;align-items:center"><div><span class="tag gold">Educational only</span><h3>Learn first. Practice second. Copy last.</h3><p class="muted">${esc(ACADEMY_DISCLAIMER)}</p></div><div class="row"><a class="btn" href="/member/education">Bot Education</a><a class="btn" href="/member/academy/risk">Required Risk Track</a></div></div></section>
  <section class="card full"><h3>Academy Navigation</h3><div class="row">${trackLinks}</div></section>
  <section class="card full"><h3>Search and Filters</h3><form id="academyFilters" class="grid3" novalidate>
    <input id="academySearch" placeholder="Search lessons, topics, bots, risk">
    <select id="academyLevel"><option value="">All levels</option><option>beginner</option><option>intermediate</option><option>advanced</option></select>
    <select id="academyTopic"><option value="">All topics</option><option>Beginner Trading Foundation</option><option>Candlestick Academy</option><option>Market Structure Academy</option><option>Risk Management Academy</option><option>Copy Trading Safety</option><option>Signal Grid Academy</option><option>Bot Training Academy</option><option>Trading Psychology Academy</option></select>
    <select id="academyBot"><option value="">All bots</option><option value="df-sauce-final-ai">DF Sauce Final AI</option></select>
  </form></section>
  <div class="grid3"><section class="card"><h3>Lesson Progress</h3><div id="academyCompleted" class="metric">0</div><p>Completed lessons persist per user.</p></section><section class="card"><h3>Quiz Passes</h3><div id="academyQuizzesPassed" class="metric">0</div><p>Risk and copy gates use quiz scores.</p></section><section class="card"><h3>Required Before Copy</h3><div id="academyGate" class="metric">Checking</div><p id="academyGateText" class="muted">Loading education gate...</p></section></div>
  <section id="academyStatus" class="card full" style="margin-top:16px;display:none"></section>
  <section id="academyTracks" class="full" style="margin-top:16px"></section>
  <section id="academyLessons" class="full" style="margin-top:16px"></section>
  <section id="academyLessonDetail" class="card full" style="margin-top:16px;display:none"></section>
  <section class="card full" style="margin-top:16px"><h3>Academy Disclaimer</h3><p>${esc(ACADEMY_DISCLAIMER)}</p></section>
  <script>
  const selectedTrackFromServer=${JSON.stringify(selectedTrack || '')};
  const statusEl=document.getElementById('academyStatus');
  const tracksEl=document.getElementById('academyTracks');
  const lessonsEl=document.getElementById('academyLessons');
  const detailEl=document.getElementById('academyLessonDetail');
  let academy=null;
  const escHtml=(v)=>String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function showAcademyStatus(kind,msg){statusEl.style.display='block';statusEl.className='card full '+(kind==='error'?'warn':kind==='ok'?'ok':'');statusEl.innerHTML='<h3>'+escHtml(kind==='loading'?'Loading Academy...':kind==='error'?'Academy Error':'Academy Ready')+'</h3><p>'+escHtml(msg)+'</p>';}
  function filters(){return {q:document.getElementById('academySearch').value.trim().toLowerCase(),level:document.getElementById('academyLevel').value,topic:document.getElementById('academyTopic').value,bot:document.getElementById('academyBot').value};}
  function progressForTrack(track){const item=(academy.progress?.tracks||[]).find((p)=>p.trackId===track.trackId)||{};return item.percent||0;}
  function trackCard(track){const pct=progressForTrack(track);return '<section class="card"><div class="row" style="justify-content:space-between"><span class="tag">'+escHtml(track.level)+'</span>'+(track.requiredBeforeCopy?'<span class="tag gold">Required before copy</span>':'<span class="tag">Optional</span>')+'</div><h3>'+escHtml(track.title)+'</h3><p class="muted">'+escHtml(track.topic)+'</p><div class="progress"><span style="width:'+pct+'%"></span></div><p>'+pct+'% complete | '+escHtml(track.estimatedMinutes)+' min</p><div class="row"><button class="btn primary" data-track="'+escHtml(track.trackId)+'">Start lesson</button><a class="btn" href="/member/academy/'+encodeURIComponent(track.slug||track.trackId)+'">Continue</a></div></section>';}
  function lessonCard(lesson){const completed=academy.progress?.progress?.[lesson.lessonId]?.status==='completed';return '<section class="card"><div class="row" style="justify-content:space-between"><span class="tag">'+escHtml(lesson.level)+'</span>'+(completed?'<span class="tag green">Completed</span>':'<span class="tag gold">Start lesson</span>')+'</div><h3>'+escHtml(lesson.title)+'</h3><p>'+escHtml(lesson.explanation)+'</p><p class="muted">'+escHtml(lesson.estimatedMinutes)+' min | '+escHtml(lesson.trackId)+'</p><div class="row"><button class="btn primary" data-lesson="'+escHtml(lesson.lessonId)+'">Open Lesson</button><button class="btn" data-complete="'+escHtml(lesson.lessonId)+'">Mark Complete</button><a class="btn" href="'+escHtml(lesson.relatedSimulator||'/member/simulator')+'">Simulator</a></div></section>';}
  function renderAcademy(){if(!academy)return;const f=filters();document.getElementById('academyCompleted').textContent=academy.progress?.completedLessons||0;document.getElementById('academyQuizzesPassed').textContent=academy.progress?.passedQuizzes||0;document.getElementById('academyGate').textContent=academy.requiredCopyEducation?.ok?'Unlocked':'Locked';document.getElementById('academyGateText').textContent=academy.requiredCopyEducation?.message||'';let tracks=academy.tracks||[];tracks=tracks.filter((track)=>{const hay=[track.title,track.topic,track.level,track.botSlug].join(' ').toLowerCase();return (!f.q||hay.includes(f.q))&&(!f.level||track.level===f.level)&&(!f.topic||track.topic===f.topic)&&(!f.bot||track.botSlug===f.bot);});tracksEl.innerHTML='<div class="grid3">'+tracks.map(trackCard).join('')+'</div>';const selected=academy.selectedTrack||tracks[0]||null;const lessons=selected?(selected.lessonIds||[]).map((id)=>academy.lessons?.[id]).filter(Boolean):[];lessonsEl.innerHTML='<section class="card full"><h3>'+escHtml(selected?.title||'Academy Lessons')+'</h3><p class="muted">'+escHtml(selected?.seedNote||'Select a track to view lessons.')+'</p></section><div class="grid2" style="margin-top:16px">'+lessons.map(lessonCard).join('')+'</div>';document.querySelectorAll('[data-track]').forEach((btn)=>btn.onclick=()=>{academy.selectedTrack=academy.tracks.find((track)=>track.trackId===btn.dataset.track);renderAcademy();});document.querySelectorAll('[data-lesson]').forEach((btn)=>btn.onclick=()=>openLesson(btn.dataset.lesson));document.querySelectorAll('[data-complete]').forEach((btn)=>btn.onclick=()=>completeLesson(btn.dataset.complete));showAcademyStatus('ok','Wisdo Trading Academy rendered inside the member portal.');}
  async function loadAcademy(){showAcademyStatus('loading','Loading starter tracks and progress...');try{const path=selectedTrackFromServer?'/api/wisdo/academy/track/'+encodeURIComponent(selectedTrackFromServer):'/api/wisdo/academy';const json=await (await fetch(path,{headers:{'Accept':'application/json'}})).json();if(!json.ok)throw new Error(json.error||'Academy API failed.');academy=json.academy||json;renderAcademy();}catch(error){showAcademyStatus('error',error.message||'Academy failed to load.');}}
  async function openLesson(id){const json=await (await fetch('/api/wisdo/academy/lesson/'+encodeURIComponent(id))).json();if(!json.ok)return showAcademyStatus('error',json.error||'Lesson not found.');const l=json.lesson;detailEl.style.display='block';detailEl.innerHTML='<h3>'+escHtml(l.title)+'</h3><p><span class="tag">'+escHtml(l.level)+'</span><span class="tag">'+escHtml(l.estimatedMinutes)+' min</span></p><h3>Learning Goals</h3><ul>'+l.learningGoals.map((g)=>'<li>'+escHtml(g)+'</li>').join('')+'</ul><h3>Main Explanation</h3><p>'+escHtml(l.explanation)+'</p><h3>Key Terms</h3><p>'+l.keyTerms.map((t)=>'<span class="tag">'+escHtml(t)+'</span>').join('')+'</p><h3>Example</h3><p>'+escHtml(l.example)+'</p><h3>Common Mistakes</h3><ul>'+l.commonMistakes.map((m)=>'<li>'+escHtml(m)+'</li>').join('')+'</ul><h3>Wisdo Tip</h3><p>'+escHtml(l.wisdoTip)+'</p><section class="card warn full"><h3>Risk Warning</h3><p>'+escHtml(l.riskWarning)+'</p></section><div class="row"><button class="btn primary" data-complete="'+escHtml(l.lessonId)+'">Complete Lesson</button><a class="btn" href="'+escHtml(l.relatedSimulator||'/member/simulator')+'">Related Simulator</a><a class="btn" href="/member/signal-grid">Signal Grid</a></div>';detailEl.querySelector('[data-complete]').onclick=()=>completeLesson(l.lessonId);detailEl.scrollIntoView({behavior:'smooth',block:'start'});}
  async function completeLesson(id){const res=await fetch('/api/wisdo/academy/lesson/'+encodeURIComponent(id)+'/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});const json=await res.json();if(!json.ok)return showAcademyStatus('error',json.error||'Could not complete lesson.');await loadAcademy();}
  ['academySearch','academyLevel','academyTopic','academyBot'].forEach((id)=>document.getElementById(id).addEventListener('input',renderAcademy));
  loadAcademy();
  </script>`;
}

function wisdoAiCenterPage() {
  const cards = [
    ['command_center', 'Command Center Copilot', 'Summarize account status, safe commands, role sync, and next setup steps.'],
    ['academy', 'Academy Tutor', 'Explain trading basics, quiz gates, lessons, and required education.'],
    ['education', 'Bot Education Coach', 'Explain bot modules and prepare users before simulator or copy actions.'],
    ['simulator', 'Simulator Interpreter', 'Explain bot brain, risk math, timeline, and safer practice changes.'],
    ['signal_grid', 'Signal Grid Coach', 'Explain grid states, copy preview, paper copy, expiration, and risk translation.'],
    ['risk', 'Risk Guardian', 'Review risk profile settings, lot caps, drawdown limits, and warning signs.'],
    ['marketplace', 'Bot Matchmaker', 'Compare bots by strategy, education path, simulator practice, and risk.'],
    ['admin', 'Admin AI Summary', 'Summarize health, seed content, audits, role sync, and operational next steps.'],
  ].map(([mode, title, body]) => `<section class="card"><span class="tag">${esc(mode)}</span><h3>${esc(title)}</h3><p>${esc(body)}</p><button class="btn primary" data-ai-mode="${esc(mode)}">Ask ${esc(title)}</button></section>`).join('');
  return `${sectionHero('Wisdo AI Center', 'AI is now available across the member portal for education, simulator interpretation, Signal Grid coaching, risk context, bot selection, support routing, and admin summaries.', '<a class="btn primary" href="/member/academy">Academy</a><a class="btn" href="/member/simulator">Simulator</a><a class="btn" href="/member/signal-grid">Signal Grid</a>')}
  <section class="card full"><h3>Ask Wisdo AI</h3><p class="muted">${esc(WISDO_AI_DISCLAIMER)}</p><form id="aiCenterForm" class="grid3" novalidate><select name="mode"><option value="global">General</option><option value="command_center">Command Center</option><option value="academy">Academy</option><option value="education">Bot Education</option><option value="simulator">Simulator</option><option value="signal_grid">Signal Grid</option><option value="risk">Risk</option><option value="marketplace">Marketplace</option><option value="admin">Admin</option><option value="support">Support</option></select><input name="page" value="Wisdo AI Center" placeholder="Page context"><button class="btn primary" type="submit">Ask</button><textarea name="prompt" style="grid-column:1/-1" rows="4" placeholder="Example: What should a beginner complete before live copy?"></textarea></form><pre id="aiCenterOut" class="checkout-result"></pre></section>
  <div class="grid2" style="margin-top:16px">${cards}</div>
  <script>
  const out=document.getElementById('aiCenterOut');
  async function askAi(payload){out.style.display='block';out.textContent='Wisdo AI is thinking...';const res=await fetch('/api/wisdo/ai/ask',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload)});const json=await res.json();out.textContent=json.answer||json.error||'No answer returned.';}
  document.getElementById('aiCenterForm')?.addEventListener('submit',(e)=>{e.preventDefault();askAi(Object.fromEntries(new FormData(e.target).entries()));});
  document.querySelectorAll('[data-ai-mode]').forEach((btn)=>btn.addEventListener('click',()=>askAi({mode:btn.dataset.aiMode,page:'Wisdo AI Center',prompt:'Explain what this AI mode does and give safe next steps.'})));
  </script>${riskDisclosureBlock()}`;
}

function signalGridPage(userId = '', state = {}) {
  const roleSync = state.roleSyncByUserId?.[String(userId)] || {};
  const accessTags = (roleSync.wisdoRoles || roleSync.internalRoles || ['guest']).map((role) => `<span class="tag">${esc(role)}</span>`).join('');
  return `${sectionHero('Wisdo Signal Grid', 'One live no-spam grid for active baskets, bot pairs, basket growth, risk translation, and safe copy actions.', '<a class="btn primary" href="/member/copy-pro">Copy Center</a><a class="btn" href="/member/risk-profile">Risk Settings</a>')}
  <section class="card full"><div class="row" style="justify-content:space-between;align-items:center"><div><h3>Access</h3><p class="muted">Copy requires CULTURE COIN MEMBER+ or copier eligibility. Viewing stays open for previews.</p><p>${accessTags}</p></div><div class="row"><select id="accountSelect"><option value="">Selected account</option></select><select id="riskSelect"><option value="fixed_lot">Fixed lot</option><option value="risk_percent">Risk percent</option><option value="multiplier">Multiplier</option></select><button class="btn" id="refreshAccess">Refresh Access</button></div></div></section>
  <section class="card full"><div class="grid3"><input id="gridSearch" placeholder="Search bot, pair, status"><select id="marketFilter"><option value="">All markets</option><option>Gold Bots</option><option>Forex Flow</option><option>Indices</option></select><select id="sessionFilter"><option value="">All sessions</option><option>Asia</option><option>London</option><option>New York</option></select><select id="riskFilter"><option value="">All risk modes</option><option value="risk_based">Risk based</option><option value="fixed_lot">Fixed lot</option><option value="risk_percent">Risk percent</option></select><label><input id="activeOnly" type="checkbox"> Active only</label><button class="btn primary" id="reloadGrid">Reload Grid</button></div></section>
  <section class="card full"><div class="row" style="justify-content:space-between"><h3>Live Basket Grid</h3><div><span class="tag">Grey inactive</span><span class="tag green">Green healthy</span><span class="tag red">Red negative</span><span class="tag gold">Yellow upper profit</span><span class="tag blue">Blue protected</span></div></div><div id="signalGridCards" class="grid3" style="margin-top:16px"></div></section>
  <section class="card full"><h3>Copy Subscriptions</h3><div id="copySubscriptions" class="grid3"></div></section>
  <dialog id="signalDialog" style="max-width:900px;width:92%;background:#07111d;color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:0"><div class="card full" style="margin:0;border:0"><div class="row" style="justify-content:space-between"><h3 id="detailTitle">Signal Detail</h3><button class="btn" id="closeSignalDialog">Close</button></div><div id="detailBody"></div><pre id="copyPreviewOut" class="checkout-result"></pre><div class="row"><button class="btn primary" id="copyBasket">Copy this basket</button><button class="btn" id="paperCopy">Paper copy</button><button class="btn" id="subscribeBot">Copy future trades from bot</button><button class="btn" id="stopBot">Stop copying bot</button><a class="btn" id="educationLink" href="/member/education">Education</a><a class="btn" id="simLink" href="/member/simulator">Simulator</a></div></div></dialog>
  <script>
  let selectedSignal=null;
  const cards=document.getElementById('signalGridCards');
  const dialog=document.getElementById('signalDialog');
  const toneClass=(tone)=>tone==='red'?'warn':tone==='yellow'?'gold':tone==='blue'?'ok':tone==='green'?'ok':'';
  const money=(v)=>'$'+Number(v||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const pct=(v)=>{const n=Number(v||0);return (n>=0?'+':'')+n.toFixed(1)+'%';};
  function filters(){const p=new URLSearchParams(); const q=document.getElementById('gridSearch').value; if(q)p.set('q',q); const market=document.getElementById('marketFilter').value; if(market)p.set('market',market); const session=document.getElementById('sessionFilter').value; if(session)p.set('session',session); const risk=document.getElementById('riskFilter').value; if(risk)p.set('risk',risk); if(document.getElementById('activeOnly').checked)p.set('activeOnly','true'); return p.toString();}
  async function loadGrid(){cards.innerHTML='<section class="card full"><h3>Loading grid...</h3></section>'; const res=await fetch('/api/wisdo/signal-grid?'+filters()); const json=await res.json(); const cells=json.cells||[]; cards.innerHTML=cells.map(cell=>'<section class="card '+toneClass(cell.tone)+' signal-cell" data-id="'+cell.id+'"><div class="row" style="justify-content:space-between"><span class="tag">'+cell.symbol+'</span><span class="tag">'+cell.status+'</span></div><h3>'+cell.botName+'</h3><div class="metric">'+pct(cell.basketGrowthPercent)+'</div><p>'+cell.direction+' • '+Number(cell.openTradeCount||0)+' trades • '+money(cell.floatingPnl)+'</p><p class="muted">'+(cell.session||'Session n/a')+' • '+(cell.volatilityState||'normal')+' • '+(cell.riskMode||'risk_based')+'</p><p class="muted">Updated '+(cell.lastUpdateAt||'')+'</p></section>').join('') || '<section class="card full"><h3>No signals yet</h3><p>The grid will populate when MT4 Reporter sends active baskets.</p></section>'; document.querySelectorAll('.signal-cell').forEach(el=>el.addEventListener('click',()=>openDetail(el.dataset.id))); const copies=await (await fetch('/api/wisdo/signal-grid/my-copies')).json(); document.getElementById('copySubscriptions').innerHTML=(copies.copies||[]).map(c=>'<section class="card"><h3>'+c.botId+'</h3><p>'+c.status+' • '+(c.paperMode?'paper':'live')+'</p></section>').join('')||'<section class="card"><h3>No bot subscriptions</h3><p>Use a signal detail drawer to subscribe.</p></section>'; }
  async function openDetail(id){const json=await (await fetch('/api/wisdo/signal-grid/detail/'+encodeURIComponent(id))).json(); selectedSignal=json.detail?.signal||null; if(!selectedSignal)return; document.getElementById('detailTitle').textContent=selectedSignal.botName+' · '+selectedSignal.symbol; document.getElementById('detailBody').innerHTML='<div class="grid3"><section class="card"><h3>Basket</h3><div class="metric">'+pct(selectedSignal.basketGrowthPercent)+'</div><p>'+money(selectedSignal.floatingPnl)+'</p></section><section class="card"><h3>Trades</h3><div class="metric">'+Number(selectedSignal.openTradeCount||0)+'</div><p>Direction '+selectedSignal.direction+'</p></section><section class="card"><h3>Copy Gate</h3><p>'+selectedSignal.copyRequirement+'</p><p class="muted">'+json.detail.riskWarning+'</p></section></div>'; document.getElementById('educationLink').href='/member/education?bot='+encodeURIComponent(selectedSignal.botId); document.getElementById('simLink').href='/member/simulator?bot='+encodeURIComponent(selectedSignal.botId); dialog.showModal(); previewCopy(false);}
  async function previewCopy(paper){if(!selectedSignal)return; const accountId=document.getElementById('accountSelect').value; const res=await fetch('/api/wisdo/signal-grid/preview-copy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({signalId:selectedSignal.id,accountId,riskSettings:{mode:document.getElementById('riskSelect').value,paperMode:paper}})}); document.getElementById('copyPreviewOut').style.display='block'; document.getElementById('copyPreviewOut').textContent=JSON.stringify(await res.json(),null,2);}
  async function copyBasket(paper){if(!selectedSignal)return; const accountId=document.getElementById('accountSelect').value; const res=await fetch('/api/wisdo/signal-grid/copy-basket',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({signalId:selectedSignal.id,accountId,riskSettings:{mode:document.getElementById('riskSelect').value,paperMode:paper}})}); document.getElementById('copyPreviewOut').textContent=JSON.stringify(await res.json(),null,2);}
  async function subscribe(){if(!selectedSignal)return; const res=await fetch('/api/wisdo/signal-grid/subscribe-bot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:selectedSignal.botId,accountId:document.getElementById('accountSelect').value,riskSettings:{mode:document.getElementById('riskSelect').value}})}); document.getElementById('copyPreviewOut').textContent=JSON.stringify(await res.json(),null,2); loadGrid();}
  async function stopBot(){if(!selectedSignal)return; const res=await fetch('/api/wisdo/signal-grid/unsubscribe-bot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:selectedSignal.botId})}); document.getElementById('copyPreviewOut').textContent=JSON.stringify(await res.json(),null,2); loadGrid();}
  document.getElementById('reloadGrid').onclick=loadGrid; document.getElementById('gridSearch').oninput=()=>setTimeout(loadGrid,150); document.getElementById('closeSignalDialog').onclick=()=>dialog.close(); document.getElementById('copyBasket').onclick=()=>copyBasket(false); document.getElementById('paperCopy').onclick=()=>copyBasket(true); document.getElementById('subscribeBot').onclick=subscribe; document.getElementById('stopBot').onclick=stopBot; document.getElementById('refreshAccess').onclick=async()=>alert(JSON.stringify(await (await fetch('/api/wisdo/me/roles/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).json(),null,2)); loadGrid();
  </script>${riskDisclosureBlock()}`;
}

function wisdoSimulatorPage(botSlug = '') {
  const slug = botSlug || slugify(EA_CATALOG.find((b) => b.recommended)?.name || EA_CATALOG[0]?.name || 'wisdo');
  return `${sectionHero('Interactive Bot Simulator', 'Run an educational Wisdo bot scenario without leaving the page. Results render as cards, timeline, risk math, and bot-brain explanation instead of raw JSON.', '<a class="btn primary" href="/member/education">Education</a><a class="btn" href="/member/signal-grid">Signal Grid</a>')}
  <section class="card full"><h3>Scenario Controls</h3><form id="simForm" class="grid3" novalidate>
    <div class="field"><label>Bot</label><select name="botSlug">${EA_CATALOG.map((bot) => `<option value="${slugify(bot.name)}" ${slugify(bot.name) === slug ? 'selected' : ''}>${esc(bot.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Symbol</label><select name="symbol"><option>XAUUSD</option><option>NAS100</option><option>GBPJPY</option><option>EURUSD</option><option>US30</option></select></div>
    <div class="field"><label>Session</label><select name="session"><option>London</option><option>New York</option><option>Asia</option><option>Overlap</option></select></div>
    <div class="field"><label>Market Condition</label><select name="marketCondition"><option>Trend</option><option>Consolidation</option><option>Reversal</option><option>High-impact news</option></select></div>
    <div class="field"><label>Risk Mode</label><select name="riskMode"><option value="risk_percent">Risk percent</option><option value="fixed_usd">Fixed USD</option><option value="fixed_lot">Fixed lot</option></select></div>
    <div class="field"><label>Risk Percent <span id="riskPercentValue" class="tag">1%</span></label><input type="range" name="riskPercent" min="0.1" max="5" step="0.1" value="1"></div>
    <div class="field"><label>Stop Distance Pips</label><input name="stopDistancePips" type="number" min="1" step="1" value="50"></div>
    <div class="field"><label>Max Lot</label><input name="maxLot" type="number" min="0.01" step="0.01" value="0.05"></div>
    <div class="field"><label>Aggression <span id="aggressionValue" class="tag">40</span></label><input type="range" name="aggression" min="0" max="100" value="40"></div>
    <div class="field"><label>Volatility <span id="volatilityValue" class="tag">55</span></label><input type="range" name="volatility" min="0" max="100" value="55"></div>
    <div class="field"><label>News Protection <span id="newsProtectionValue" class="tag">80</span></label><input type="range" name="newsProtection" min="0" max="100" value="80"></div>
    <div class="field"><label>Spread Protection <span id="spreadProtectionValue" class="tag">70</span></label><input type="range" name="spreadProtection" min="0" max="100" value="70"></div>
    <button id="runSimulation" class="btn primary" type="submit">Run Simulation</button>
    <button id="retrySimulation" class="btn" type="button" style="display:none">Retry</button>
  </form><noscript><section class="card warn full" style="margin-top:16px"><h3>JavaScript Required</h3><p>The simulator renders API results inside this page with JavaScript. Enable JavaScript to run scenarios without opening raw JSON.</p></section></noscript></section>
  <section id="simStatus" class="card full" style="margin-top:16px;display:none"></section>
  <section id="simResult" class="full" style="margin-top:16px;display:none"></section>
  <section id="simHistoryPanel" class="card full" style="margin-top:16px;display:none"><h3>Recent Simulations</h3><div id="simHistory" class="grid3"></div></section>
  ${riskDisclosureBlock()}
  <script>
  const simHistory=[];
  const form=document.getElementById('simForm');
  const runBtn=document.getElementById('runSimulation');
  const retryBtn=document.getElementById('retrySimulation');
  const statusEl=document.getElementById('simStatus');
  const resultEl=document.getElementById('simResult');
  const historyPanel=document.getElementById('simHistoryPanel');
  const historyEl=document.getElementById('simHistory');
  const escHtml=(v)=>String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=(v)=>'$'+Number(v||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const pct=(v)=>Number(v||0).toFixed(2)+'%';
  function syncSliders(){['riskPercent','aggression','volatility','newsProtection','spreadProtection'].forEach((name)=>{const input=form.elements[name];const label=document.getElementById(name+'Value');if(input&&label)label.textContent=input.value+(name==='riskPercent'?'%':'');});}
  form?.addEventListener('input',syncSliders); syncSliders();
  function showStatus(kind,msg){statusEl.style.display='block';statusEl.className='card full '+(kind==='error'?'warn':kind==='ok'?'ok':'');statusEl.innerHTML='<h3>'+escHtml(kind==='loading'?'Running bot simulation...':kind==='error'?'Simulation Error':'Simulation Ready')+'</h3><p>'+escHtml(msg)+'</p>';}
  function riskCard(risk={}){const warnings=(risk.warnings||[]).map((w)=>'<span class="tag gold">'+escHtml(w)+'</span>').join('')||'<span class="tag green">No simulator warnings</span>';return '<section class="card full"><h3>Risk Calculation</h3><div class="grid3"><section class="card"><h3>Risk Mode</h3><div class="metric">'+escHtml(risk.riskMode||'n/a')+'</div><p>Risk '+escHtml(risk.riskPercent??'n/a')+'% / '+money(risk.riskUsd)+'</p></section><section class="card"><h3>Lot Translation</h3><div class="metric">'+escHtml(risk.lot??risk.projectedLot??'n/a')+'</div><p>Raw '+escHtml(risk.rawLot??'n/a')+' | min '+escHtml(risk.minLot??'n/a')+' | max '+escHtml(risk.maxLot??'n/a')+' | step '+escHtml(risk.lotStep??'n/a')+'</p></section><section class="card"><h3>Stop Math</h3><p>Stop distance '+escHtml(risk.stopDistancePips??'n/a')+' pips</p><p>Pip value per lot '+money(risk.pipValuePerLot)+'</p></section></div><p>'+escHtml(risk.explanation||'Risk explanation unavailable for this scenario.')+'</p><p class="muted">'+escHtml(risk.compliance||'Educational calculation only. Trading involves risk and there is no guaranteed profit.')+'</p><div>'+warnings+'</div></section>';}
  function timelineCard(items=[]){return '<section class="card full"><h3>Decision Timeline</h3><div class="grid2">'+(items.length?items:['Loaded bot metadata and account risk.','Checked session and symbol.','Trade passed educational simulator filters.','Risk calculation explanation.']).map((item,i)=>'<section class="card step"><div class="num">'+String(i+1).padStart(2,'0')+'</div><div><p>'+escHtml(item)+'</p></div></section>').join('')+'</div></section>';}
  function renderScenario(scenario){const entry=scenario.simulatedEntry||{};const exit=scenario.simulatedExit||{};const blocked=!scenario.simulatedEntry;const seed=scenario.seedData?'<section class="card warn full"><h3>Educational demo scenario</h3><p>Educational demo scenario - not a live trading signal.</p></section>':'';resultEl.style.display='block';resultEl.innerHTML=seed+'<div class="grid3"><section class="card '+(blocked?'warn':'ok')+'"><h3>Main Result</h3><div class="metric">'+escHtml(entry.direction||'blocked')+'</div><p>'+escHtml(scenario.botSlug||'bot')+' | '+escHtml(scenario.symbol)+' | '+escHtml(scenario.session)+'</p><p>Market: '+escHtml(scenario.marketCondition||'n/a')+'</p></section><section class="card"><h3>Lot Size</h3><div class="metric">'+escHtml(entry.lot??'n/a')+'</div><p>'+escHtml(entry.reason||scenario.blockedReason||'No entry produced by simulator settings.')+'</p></section><section class="card"><h3>Exit Model</h3><div class="metric">'+escHtml(exit.targetR??'n/a')+'R</div><p>Max drawdown '+escHtml(exit.maxDrawdownPercent??'n/a')+'%</p><p>Created '+escHtml(scenario.createdAt||'now')+'</p></section></div><section class="card full" style="margin-top:16px"><h3>Bot Brain Explanation</h3><p>'+escHtml(scenario.botBrainExplanation||'Wisdo explanation unavailable.')+'</p></section><div style="margin-top:16px">'+riskCard(scenario.risk||{})+'</div><div style="margin-top:16px">'+timelineCard(scenario.decisionTimeline||[])+'</div>';showStatus('ok','Simulation rendered inside the Wisdo simulator.');addHistory(scenario);}
  function addHistory(scenario){simHistory.unshift(scenario);simHistory.splice(6);historyPanel.style.display='block';historyEl.innerHTML=simHistory.map((s,idx)=>'<section class="card"><h3>'+escHtml(s.symbol)+' | '+escHtml(s.botSlug)+'</h3><p>'+escHtml(s.session)+' | '+escHtml(s.simulatedEntry?.direction||'blocked')+' | lot '+escHtml(s.simulatedEntry?.lot??'n/a')+'</p><p class="muted">'+escHtml(s.createdAt||'')+'</p><button class="btn" type="button" data-history="'+idx+'">View Result</button></section>').join('');historyEl.querySelectorAll('[data-history]').forEach((btn)=>btn.addEventListener('click',()=>renderScenario(simHistory[Number(btn.dataset.history)])));}
  async function runSimulation(){runBtn.disabled=true;retryBtn.style.display='none';resultEl.style.display='none';showStatus('loading','Running bot simulation...');try{const data=Object.fromEntries(new FormData(form).entries());const res=await fetch('/api/wisdo/simulator/run',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(data)});const json=await res.json().catch(()=>({ok:false,error:'Simulator returned an invalid response.'}));if(!res.ok||!json.ok)throw new Error(json.error||'Simulation failed.');if(!json.scenario)throw new Error('Simulator response did not include a scenario.');renderScenario(json.scenario);}catch(error){showStatus('error',error.message||'Simulation failed. Please retry.');retryBtn.style.display='inline-flex';}finally{runBtn.disabled=false;}}
  form?.addEventListener('submit',(e)=>{e.preventDefault();runSimulation();});
  retryBtn?.addEventListener('click',runSimulation);
  </script>`;
}

function wisdoSocialPage(state = {}, userId = '') {
  const posts = Object.values(state.socialPostsById || {}).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 30);
  const rows = posts.map((p) => `<section class="card"><div class="row"><span class="tag">${esc(p.type || 'post')}</span><span class="tag">${esc(p.visibility || 'public')}</span></div><h3>${esc(p.title || p.authorName || 'Wisdo Post')}</h3><p>${esc(p.body || '')}</p><button class="btn" data-like="${esc(p.postId)}">Like</button><button class="btn" data-save="${esc(p.postId)}">Save</button><a class="btn" href="/member/copy-pro">Copy Request</a></section>`).join('');
  return `${sectionHero('Wisdo Social Trading', 'Profiles, activity feed, creator updates, strategy journals, watchlists, copy requests, and moderation-ready post actions.', '<a class="btn primary" href="/api/wisdo/social/posts">Feed API</a>')}
  <section class="card full"><h3>Create Strategy Note</h3><form id="postForm" class="grid3"><input name="title" placeholder="Post title"><select name="type"><option>strategy_note</option><option>bot_update</option><option>education_win</option><option>admin_announcement</option></select><select name="visibility"><option>public</option><option>private</option></select><textarea name="body" placeholder="Share a setup, risk lesson, watchlist, or bot update" style="grid-column:1/-1"></textarea><button class="btn primary" type="submit">Post</button></form><pre id="postOut" class="checkout-result"></pre></section>
  <div class="grid3" style="margin-top:16px">${rows || '<section class="card full"><h3>No social posts yet</h3><p>Create the first strategy note. It will be stored in the Wisdo social model.</p></section>'}</div>
  <script>function out(id,data){const el=document.getElementById(id);el.style.display='block';el.textContent=JSON.stringify(data,null,2);}document.getElementById('postForm')?.addEventListener('submit',async(e)=>{e.preventDefault();const res=await fetch('/api/wisdo/social/posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(e.target).entries()))});out('postOut',await res.json());location.reload();});document.querySelectorAll('[data-like]').forEach(btn=>btn.addEventListener('click',async()=>alert(JSON.stringify(await (await fetch('/api/wisdo/social/posts/'+btn.dataset.like+'/like',{method:'POST'})).json(),null,2))));</script>`;
}

function adminWisdoPage(state = {}) {
  const customBots = Object.values(state.botVersionsBySlug || {}).flat().length;
  const auditRows = Object.values(state.adminAuditLogsById || {}).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20).map((a) => `<tr><td>${esc(a.action)}</td><td>${esc(a.targetType)}</td><td>${esc(a.targetId)}</td><td>${esc(a.actorUserId)}</td><td>${esc(a.createdAt)}</td></tr>`).join('');
  const roleRows = Object.values(state.roleSyncByUserId || {}).sort((a, b) => String(b.lastSyncedAt || '').localeCompare(String(a.lastSyncedAt || ''))).slice(0, 40).map((r) => `<tr><td>${esc(r.userId)}</td><td>${(r.matchedDiscordRoles || []).map((role) => `<span class="tag green">${esc(role)}</span>`).join('') || '<span class="tag gold">None</span>'}</td><td>${(r.wisdoRoles || []).map((role) => `<span class="tag">${esc(role)}</span>`).join('')}</td><td><span class="tag ${r.stale ? 'gold' : 'green'}">${esc(r.accessLevel || 'none')}</span></td><td>${esc(r.source || '')}</td><td>${esc(r.lastSyncedAt || '')}</td></tr>`).join('');
  const signalCells = Object.values(state.signalGridCellsById || {});
  const signalChannels = Object.values(state.signalGridChannelsById || {});
  const signalSettings = state.signalGridSettings || {};
  return `${sectionHero('Admin Wisdo Control Center', 'Bot uploads, version control, education uploads, copy approvals, feature flags, audit logs, emergency shutoff, and voice-readiness controls.', '<a class="btn primary" href="/api/admin/wisdo/overview">Admin API</a>')}
  <div class="grid"><section class="card"><h3>Seed Marketplace Bots</h3><div class="metric">${EA_CATALOG.length}</div></section><section class="card"><h3>Version Records</h3><div class="metric">${customBots}</div></section><section class="card"><h3>Feature Flags</h3><div class="metric">${Object.keys(state.featureFlagsById || {}).length}</div></section><section class="card"><h3>Audit Logs</h3><div class="metric">${Object.keys(state.adminAuditLogsById || {}).length}</div></section></div>
  <section class="card full" style="margin-top:16px"><h3>Trading Academy Builder</h3><p class="muted">Create tracks, create lessons, set level/roles, publish drafts, and keep starter content admin editable.</p><div class="grid2"><form id="academyTrackForm" class="grid"><input name="title" placeholder="Track title"><input name="topic" placeholder="Topic"><select name="level"><option>beginner</option><option>intermediate</option><option>advanced</option></select><input name="botSlug" placeholder="Bot slug optional"><label><input type="checkbox" name="requiredBeforeCopy"> Required before copy</label><button class="btn primary" type="submit">Create Track</button></form><form id="academyLessonForm" class="grid"><input name="trackId" placeholder="Track ID e.g. risk-management"><input name="title" placeholder="Lesson title"><select name="level"><option>beginner</option><option>intermediate</option><option>advanced</option></select><input name="estimatedMinutes" placeholder="Estimated minutes"><textarea name="explanation" placeholder="Main explanation"></textarea><button class="btn primary" type="submit">Create Lesson</button></form></div><pre id="academyAdminOut" class="checkout-result"></pre></section>
  <section class="card full" style="margin-top:16px"><h3>Wisdo Signal Grid</h3><div class="grid3"><section class="card"><h3>Grid Cells</h3><div class="metric">${signalCells.length}</div><p>${signalCells.filter((cell) => !['inactive','expired','offline'].includes(String(cell.status))).length} active</p></section><section class="card"><h3>Pinned Channels</h3><div class="metric">${signalChannels.length}</div><p>${signalChannels[0]?.pinnedMessageId ? 'Pinned message stored' : 'No pinned message yet'}</p></section><section class="card"><h3>Percent Mode</h3><div class="metric">${esc(signalSettings.percentMode || process.env.SIGNAL_GRID_PERCENT_MODE || 'balance')}</div><p>Balance, equity, allocated, or basket risk.</p></section></div><form id="signalGridAdminForm" class="grid3" style="margin-top:16px"><input name="channelId" value="${esc(signalChannels[0]?.channelId || process.env.SIGNAL_CHANNEL_ID || process.env.TRADE_SIGNAL_CHANNEL_ID || '')}" placeholder="Discord signal channel ID"><select name="percentMode"><option value="balance">balance</option><option value="equity">equity</option><option value="allocated">allocated</option><option value="basket_risk">basket_risk</option></select><input name="expirationMinutes" value="${esc(signalSettings.expirationMinutes || process.env.SIGNAL_GRID_EXPIRATION_MINUTES || 45)}" placeholder="Expiration minutes"><label><input type="checkbox" name="copyButtonsEnabled" ${signalSettings.copyButtonsEnabled === false ? '' : 'checked'}> Copy buttons</label><label><input type="checkbox" name="websiteEnabled" ${signalSettings.websiteEnabled === false ? '' : 'checked'}> Website grid</label><label><input type="checkbox" name="discordEnabled" ${signalSettings.discordEnabled === false ? '' : 'checked'}> Discord grid</label><button class="btn primary" data-signal-admin="setup" type="button">Create / Repair Pinned Grid</button><button class="btn" data-signal-admin="refresh" type="button">Force Refresh</button><button class="btn" data-signal-admin="settings" type="button">Save Settings</button></form><pre id="signalGridAdminOut" class="checkout-result"></pre></section>
  <section class="card full" style="margin-top:16px"><h3>Discord Role Sync</h3><div class="row"><a class="btn" href="/api/wisdo/admin/role-map">Role Map API</a><a class="btn" href="/api/wisdo/admin/role-sync">Role Sync API</a></div><table><thead><tr><th>User</th><th>Discord Roles</th><th>Wisdo Roles</th><th>Access</th><th>Source</th><th>Synced</th></tr></thead><tbody>${roleRows || '<tr><td colspan="6">No role sync records yet.</td></tr>'}</tbody></table></section>
  <section class="card full" style="margin-top:16px"><h3>Upload / Update Bot Metadata</h3><form id="adminBotForm" class="grid3">
    <input name="name" placeholder="Bot name" required>
    <input name="version" placeholder="Version e.g. 1.2.0" required>
    <input name="creator" placeholder="Creator">
    <input name="priceUsd" placeholder="Price USD">
    <select name="status"><option>draft</option><option>testing</option><option>live</option><option>deprecated</option><option>archived</option></select>
    <select name="accessLevel"><option>free</option><option>paid</option><option>private</option><option>invite_only</option><option>trial</option></select>
    <input name="category" placeholder="Category">
    <input name="allowedSymbols" placeholder="Allowed symbols CSV">
    <input name="minimumAccountSize" placeholder="Minimum account size">
    <input name="maxRiskWarning" placeholder="Max risk warning">
    <input name="fileName" placeholder="EA file name">
    <input name="fileSha256" placeholder="File sha256 / scan token">
    <label><input type="checkbox" name="forceUpdateRequired"> Force update required</label>
    <label><input type="checkbox" name="educationRequiredBeforeActivation"> Education required</label>
    <textarea name="releaseNotes" placeholder="Release notes, setup steps, broker notes" style="grid-column:1/-1"></textarea>
    <button class="btn primary" type="submit">Save Bot Version</button>
  </form><pre id="adminBotOut" class="checkout-result"></pre></section>
  <section class="card full"><h3>Audit Trail</h3><table><thead><tr><th>Action</th><th>Type</th><th>Target</th><th>Actor</th><th>Created</th></tr></thead><tbody>${auditRows || '<tr><td colspan="5">No audit logs yet.</td></tr>'}</tbody></table></section>
  <script>function adminShow(id,data){const out=document.getElementById(id);out.style.display='block';out.textContent=JSON.stringify(data,null,2);}document.getElementById('academyTrackForm')?.addEventListener('submit',async(e)=>{e.preventDefault();const raw=Object.fromEntries(new FormData(e.target).entries());raw.requiredBeforeCopy=Boolean(e.target.requiredBeforeCopy?.checked);const res=await fetch('/api/wisdo/admin/academy/tracks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(raw)});adminShow('academyAdminOut',await res.json());});document.getElementById('academyLessonForm')?.addEventListener('submit',async(e)=>{e.preventDefault();const raw=Object.fromEntries(new FormData(e.target).entries());raw.estimatedMinutes=Number(raw.estimatedMinutes||6);const res=await fetch('/api/wisdo/admin/academy/lessons',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(raw)});adminShow('academyAdminOut',await res.json());});document.getElementById('adminBotForm')?.addEventListener('submit',async(e)=>{e.preventDefault();const raw=Object.fromEntries(new FormData(e.target).entries());raw.forceUpdateRequired=Boolean(raw.forceUpdateRequired);raw.educationRequiredBeforeActivation=Boolean(raw.educationRequiredBeforeActivation);const res=await fetch('/api/admin/wisdo/bots',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(raw)});adminShow('adminBotOut',await res.json());});document.querySelectorAll('[data-signal-admin]').forEach(btn=>btn.addEventListener('click',async()=>{const form=document.getElementById('signalGridAdminForm');const raw=Object.fromEntries(new FormData(form).entries());raw.copyButtonsEnabled=Boolean(raw.copyButtonsEnabled);raw.websiteEnabled=Boolean(raw.websiteEnabled);raw.discordEnabled=Boolean(raw.discordEnabled);raw.expirationMinutes=Number(raw.expirationMinutes||45);const action=btn.dataset.signalAdmin;let path='/api/wisdo/admin/signal-grid/setup',method='POST',body={channelId:raw.channelId,settings:raw};if(action==='refresh'){path='/api/wisdo/admin/signal-grid/refresh';body={clearExpired:true};}if(action==='settings'){path='/api/wisdo/admin/signal-grid/settings';method='PATCH';body=raw;}const res=await fetch(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});adminShow('signalGridAdminOut',await res.json());}));</script>`;
}

function tradeResultsPage(userId, mt4 = {}, accessibleAccounts = null) {
  const accounts = Array.isArray(accessibleAccounts) ? accessibleAccounts : getMyConnectedAccounts(mt4, userId);
  const accountOptions = accountSelectOptions(accounts);
  return `${sectionHero('Trade Results + YTD Equity', 'See every connected reporter on your desk, compare accounts, and track YTD equity/balance curve from MT4 snapshots.', '<a class="btn primary" href="/member/copy-pro">Culture Relay Engine</a>')}${globalAccountBar(userId, accounts)}
  <section class="card full"><div class="row" style="justify-content:space-between"><h3>YTD Equity Line Graph</h3><div><select id="equityAccount">${accountOptions || '<option value="">No account connected</option>'}</select><button class="btn" onclick="loadEquity()">Refresh</button></div></div><canvas id="equityChart" class="spark"></canvas></section>
  <section class="card full" style="margin-top:16px"><h3>Reporter Results</h3><table><thead><tr><th>Account</th><th>Role</th><th>Balance</th><th>Equity</th><th>Floating</th><th>Open</th><th>Last Sync</th></tr></thead><tbody>${accounts.map((a)=>`<tr><td>${esc(a.nickname || a.accountNumber)}<br><span class="muted">${esc(a.server || a.brokerServer || '')}</span></td><td><span class="tag">${esc(a.accountRole || 'private')}</span></td><td>${money(a.balance)}</td><td>${money(a.equity)}</td><td>${money(a.floatingPL)}</td><td>${Number(a.openTrades || 0)}</td><td>${esc(a.lastSyncAt || '')}</td></tr>`).join('') || '<tr><td colspan="7">No reporters connected yet.</td></tr>'}</tbody></table></section>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script><script>
  let equityChart;
  async function loadEquity(){const accountId=document.getElementById('equityAccount')?.value||'';if(!accountId)return;const res=await fetch('/api/me/equity-history?period=ytd&accountId='+encodeURIComponent(accountId));const json=await res.json();const rows=json.points||[];const labels=rows.map(r=>r.label);const equity=rows.map(r=>r.equity);const balance=rows.map(r=>r.balance);const ctx=document.getElementById('equityChart');if(equityChart)equityChart.destroy();equityChart=new Chart(ctx,{type:'line',data:{labels,datasets:[{label:'Equity',data:equity,tension:.35},{label:'Balance',data:balance,tension:.35}]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{ticks:{color:'#9fb0c3',maxTicksLimit:12}},y:{ticks:{color:'#9fb0c3'}}},plugins:{legend:{labels:{color:'#fff'}},tooltip:{mode:'index',intersect:false}}}});} loadEquity();
  </script>`;
}

function supportTicketsPage(userId, state = {}) {
  const tickets = Object.values(state.supportTicketsById || {}).filter((t)=>String(t.userId)===String(userId));
  return `${sectionHero('Support Tickets', 'Request help for bot installs, MT4 connection issues, copy trade failures, payment problems, and video reviews.')}
  <section class="card full"><form id="ticketForm" class="grid3"><input name="userId" value="${esc(userId)}"><select name="type"><option>Bot install help</option><option>MT4 connection issue</option><option>Copy trade failed</option><option>Payment issue</option><option>Video review question</option></select><input name="subject" placeholder="Subject"><textarea name="message" placeholder="What happened? Include account, bot, and error." style="grid-column:1/-1"></textarea><button class="btn primary" type="submit">Create Ticket</button></form><pre id="ticketResult" class="checkout-result"></pre></section><section class="card full"><h3>My Tickets</h3><table><tr><th>Created</th><th>Type</th><th>Subject</th><th>Status</th></tr>${tickets.map((t)=>`<tr><td>${esc(t.createdAt)}</td><td>${esc(t.type)}</td><td>${esc(t.subject)}</td><td>${esc(t.status)}</td></tr>`).join('') || '<tr><td colspan="4">No tickets yet.</td></tr>'}</table></section><script>document.getElementById('ticketForm')?.addEventListener('submit',async(e)=>{e.preventDefault();const out=document.getElementById('ticketResult');out.style.display='block';const data=Object.fromEntries(new FormData(e.target).entries());const res=await fetch('/api/support/tickets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});out.textContent=JSON.stringify(await res.json(),null,2);location.reload();});</script>`;
}

function adminHealthPage(config, mt4 = {}, state = {}) {
  const connections = Object.values(mt4.connections || {});
  const snapshots = Object.values(mt4.latestSnapshots || {});
  const stale = snapshots.filter((s)=>Date.now()-new Date(s.receivedAt).getTime()>60000).length;
  return `${sectionHero('Admin System Health', 'Operational view for Render, Discord, MT4 sync, command queues, Square, signals, OAuth, and storage preparation.')}
  <div class="grid3"><section class="card"><h3>Connected Accounts</h3><div class="metric">${connections.length}</div></section><section class="card"><h3>Latest Snapshots</h3><div class="metric">${snapshots.length}</div></section><section class="card"><h3>Stale Snapshots</h3><div class="metric ${stale?'red':'green'}">${stale}</div></section><section class="card"><h3>Square</h3><div class="metric">${process.env.SQUARE_ACCESS_TOKEN?'Set':'Missing'}</div></section><section class="card"><h3>OAuth Client Secret</h3><div class="metric">${process.env.CLIENT_SECRET?'Set':'Missing'}</div></section><section class="card"><h3>Signal Channel</h3><div class="metric">${process.env.SIGNAL_CHANNEL_ID?'Set':'Missing'}</div></section></div>
  <section class="card full" style="margin-top:16px"><h3>Storage Upgrade Prep</h3><p>Current storage provider: <code>${esc(process.env.STORAGE_PROVIDER || 'local')}</code></p><p class="muted">For large videos, prepare Cloudflare R2/S3 env vars later: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL.</p></section>`;
}


function accountIdFor(connection = {}) {
  return `${connection.accountNumber || ''}:${connection.brokerServer || connection.server || ''}`;
}

function getMyConnectedAccounts(mt4 = {}, userId = '') {
  const latestByAccount = mt4.latestSnapshotsByAccountId || {};
  const settingsByAccount = mt4.accountSettingsByAccountId || {};
  return Object.values(mt4.connectionsByAccountId || mt4.connections || {})
    .filter((connection) => String(connection.discordUserId) === String(userId))
    .map((connection) => {
      const accountId = connection.accountId || accountIdFor(connection);
      const latestRecord = latestByAccount[accountId] || mt4.latestSnapshots?.[connection.discordUserId] || null;
      const latest = latestRecord?.snapshot || latestRecord || {};
      const settings = settingsByAccount[accountId] || {};
      const accountNumber = String(latest.accountNumber || connection.accountNumber || '');
      const server = latest.brokerServer || connection.brokerServer || connection.server || '';
      return {
        ...connection,
        ...settings,
        accountId,
        discordUserId: connection.discordUserId,
        accountNumber,
        server,
        type: latest.isDemo ? 'Demo' : 'Live',
        eaName: latest.eaName || connection.eaName || '',
        eaVersion: latest.eaVersion || connection.eaVersion || '',
        balance: Number(latest.balance || 0),
        equity: Number(latest.equity || 0),
        floatingPL: Number(latest.floatingPL || 0),
        dailyClosedPL: Number(latest.dailyClosedPL || 0),
        openTrades: latest.openTradeCount || 0,
        terminalConnected: latest.terminalConnected !== false,
        expertEnabled: latest.expertEnabled !== false,
        lastSyncAt: latestRecord?.receivedAt || latest.timestamp || connection.lastSyncAt || '',
        status: latestRecord ? 'connected' : 'stale',
        latestSnapshot: latestRecord,
      };
    })
    .sort((a, b) => new Date(b.lastSyncAt || 0) - new Date(a.lastSyncAt || 0));
}

function getMyPendingPairings(mt4 = {}, userId = '') {
  return Object.values(mt4.pairingCodes || {})
    .filter((pairing) => String(pairing.discordUserId) === String(userId) && pairing.status === 'pending')
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function accountOptionLabel(account = {}) {
  const status = account.pendingReporter ? 'Pending Reporter' : account.discoverable ? 'Community Reporter' : account.shared ? 'Shared Reporter' : (account.status || 'Live');
  const number = account.maskedAccountNumber || account.accountNumber || account.brokerLogin || 'Account';
  return `${number} - ${account.server || account.brokerServer || 'Server'} - ${account.type || account.platform || 'MT4'} - ${status}${account.eaName ? ' - ' + account.eaName : account.botName ? ' - ' + account.botName : ''}`;
}

function globalAccountBar(userId, accounts = [], activeAccountId = '') {
  const active = accounts.find((a) => a.accountId === activeAccountId) || accounts[0] || null;
  const options = accounts.map((account) => `<option value="${esc(account.accountId)}" ${active?.accountId === account.accountId ? 'selected' : ''}>${esc(accountOptionLabel(account))}</option>`).join('');
  return `<section class="card full" style="margin-bottom:16px"><div class="row" style="justify-content:space-between;align-items:center"><div><strong>Logged in as:</strong> <span class="tag">${esc(userId)}</span> ${active ? `<span class="tag green">Active: ${esc(accountOptionLabel(active))}</span>` : '<span class="tag red">No connected MT4 account</span>'}</div><form method="get" class="row"><input type="hidden" name="userId" value="${esc(userId)}"><select name="accountId" onchange="this.form.submit()">${options || '<option>No accounts yet</option>'}</select><a class="btn" href="/member/link-account?userId=${encodeURIComponent(userId)}">Add / Reconnect</a></form></div></section>`;
}

function smartStatusBanner(userId, accounts = [], pairings = []) {
  const account = accounts[0] || null;
  const pairing = pairings[0] || null;
  if (account) {
    return `<section class="card ok full"><h3>Connected Account Found</h3><div class="metric">${esc(account.accountNumber)}</div><p>${esc(account.server)} • ${esc(account.eaName || 'EA pending')} • Last sync ${esc(account.lastSyncAt || 'pending')}</p><a class="btn primary" href="/member/home?userId=${encodeURIComponent(userId)}&accountId=${encodeURIComponent(account.accountId)}">View Dashboard</a><a class="btn" href="/member/copy-pro?userId=${encodeURIComponent(userId)}&accountId=${encodeURIComponent(account.accountId)}">Use in Copier Engine</a><a class="btn" href="/member/account-doctor?userId=${encodeURIComponent(userId)}&accountId=${encodeURIComponent(account.accountId)}">Account Doctor</a><a class="btn" href="/member/link-account?userId=${encodeURIComponent(userId)}&mode=new">Connect Another Account</a></section>`;
  }
  if (pairing) {
    return `<section class="card warn full"><h3>Waiting on MT4 Reporter</h3><div class="metric"><code>${esc(pairing.pairingCode)}</code></div><p>You already have a pending Discord pairing code. Paste this into CultureCoin MT4 Reporter, then refresh this page.</p><button class="btn primary" onclick="navigator.clipboard?.writeText('${esc(pairing.pairingCode)}')">Copy Pairing Code</button><a class="btn" href="/member/mt4-webrequest-guide?userId=${encodeURIComponent(userId)}">Open WebRequest Guide</a><a class="btn" href="/member/link-account?userId=${encodeURIComponent(userId)}">Refresh Status</a><form style="display:inline" method="post" action="/api/me/pairing-code"><input type="hidden" name="userId" value="${esc(userId)}"><button class="btn" type="submit">Generate New Code</button></form></section>`;
  }
  return `<section class="card full"><h3>Connect MT4 to unlock the live app</h3><p>Connect MT4 to unlock live dashboard, Copier Engine, WISDO commands, signal taking, dropdown prefills, bot setup, and account-specific uploads.</p><form method="post" action="/api/me/pairing-code"><input type="hidden" name="userId" value="${esc(userId)}"><button class="btn primary" type="submit">Generate Pairing Code</button></form><a class="btn" href="/member/mt4-webrequest-guide?userId=${encodeURIComponent(userId)}">Open MT4 Guide</a></section>`;
}

function stateAwareTradeLinkPage({ userId, accounts = [], pairings = [], baseUrl }) {
  const accountRows = accounts.map((a) => `<tr><td>${esc(a.accountNumber)}</td><td>${esc(a.server)}</td><td>${esc(a.type)}</td><td>${esc(a.eaName || '')}</td><td>${money(a.equity)}</td><td>${esc(a.lastSyncAt || '')}</td><td><a class="btn" href="/member/copy-pro?userId=${encodeURIComponent(userId)}&accountId=${encodeURIComponent(a.accountId)}">Copier Engine</a><a class="btn" href="/member/wisdo?userId=${encodeURIComponent(userId)}&accountId=${encodeURIComponent(a.accountId)}">WISDO</a></td></tr>`).join('');
  const pairingRows = pairings.map((p) => `<tr><td><code>${esc(p.pairingCode)}</code></td><td>${esc(p.status)}</td><td>${esc(p.createdAt || '')}</td><td>${esc(p.expiresAt || '')}</td></tr>`).join('');
  return `${sectionHero('Trade Link', 'WISDO now reads the pairing codes and MT4 accounts already connected to your Discord user. No more typing what WISDO already knows.', '<a class="btn primary" href="/member/accounts">My Accounts</a><a class="btn" href="/member/mt4-webrequest-guide">MT4 Guide</a>')}${globalAccountBar(userId, accounts)}${smartStatusBanner(userId, accounts, pairings)}<div class="grid2" style="margin-top:16px"><section class="card"><h3>Setup Checklist</h3><div class="step"><div class="num">1</div><p>Generate a pairing code from Discord <code>/connect-mt4</code> or this page.</p></div><div class="step"><div class="num">2</div><p>Paste the code into CultureCoin MT4 Reporter.</p></div><div class="step"><div class="num">3</div><p>Add <code>${esc(baseUrl)}</code> to MT4 WebRequest allowed URLs.</p></div><div class="step"><div class="num">4</div><p>Wait for first sync. The account will appear in dropdowns automatically.</p></div></section><section class="card"><h3>Smart Dropdown Rules</h3><p>Copier Engine, WISDO commands, upload pages, bot setup, and Account Doctor now use your available accounts instead of blank typing fields.</p><span class="tag">Owner checked</span><span class="tag">Discord scoped</span><span class="tag">Multi-account ready</span></section></div><section class="card full" style="margin-top:16px"><h3>My Connected Accounts</h3><table><thead><tr><th>Account</th><th>Server</th><th>Type</th><th>EA</th><th>Equity</th><th>Last Sync</th><th>Actions</th></tr></thead><tbody>${accountRows || '<tr><td colspan="7">No connected accounts yet.</td></tr>'}</tbody></table></section><section class="card full" style="margin-top:16px"><h3>Pending Pairing Codes</h3><table><thead><tr><th>Pairing Code</th><th>Status</th><th>Created</th><th>Expires</th></tr></thead><tbody>${pairingRows || '<tr><td colspan="4">No pending pairing codes.</td></tr>'}</tbody></table></section>`;
}

function myAccountsV2Page(userId, accounts = [], pairings = []) {
  const rows = accounts.map((a, idx) => `<tr><td>${idx === 0 ? '<span class="tag green">Primary</span>' : '<span class="tag">Secondary</span>'}</td><td>${esc(a.accountNumber)}</td><td>${esc(a.server)}</td><td>${esc(a.type)}</td><td>${esc(a.eaName || '')}</td><td>${a.terminalConnected ? '<span class="green">Connected</span>' : '<span class="red">Disconnected</span>'}</td><td>${a.expertEnabled ? '<span class="green">Expert On</span>' : '<span class="red">Expert Off</span>'}</td><td>${esc(a.lastSyncAt || '')}</td><td><select><option>Private</option><option>Stats only</option><option>Show in Copier Engine</option><option>Signal only</option><option>Allow copy</option><option>Require approval</option></select><select><option>Leader</option><option>Follower</option><option>Both</option><option>Private</option></select></td><td><a class="btn" href="/member/account-doctor?userId=${encodeURIComponent(userId)}&accountId=${encodeURIComponent(a.accountId)}">Doctor</a><a class="btn" href="/member/link-account?userId=${encodeURIComponent(userId)}&reconnect=${encodeURIComponent(a.accountId)}">Reconnect</a></td></tr>`).join('');
  return `${sectionHero('My Accounts V2', 'Every account on this page belongs to your logged-in Discord user. Use this as the source for every dropdown in the website.', '<a class="btn primary" href="/member/link-account">Add Account</a>')}${globalAccountBar(userId, accounts)}<section class="card full"><h3>Account Switcher + Privacy</h3><table><thead><tr><th>Primary</th><th>Account</th><th>Server</th><th>Type</th><th>EA</th><th>Terminal</th><th>Expert</th><th>Last Sync</th><th>Visibility / Role</th><th>Actions</th></tr></thead><tbody>${rows || '<tr><td colspan="10">No accounts yet. Generate a pairing code to connect MT4.</td></tr>'}</tbody></table></section><section class="card full" style="margin-top:16px"><h3>Pairing Recovery</h3>${pairings.map((p)=>`<span class="tag"><code>${esc(p.pairingCode)}</code> ${esc(p.status)}</span>`).join('') || '<p class="muted">No pending pairing codes. Create one from Trade Link or Discord /connect-mt4.</p>'}</section>`;
}

function smartCopyFollowerSelect(userId, accounts = []) {
  const options = accounts.map((a)=>`<option value="${esc(a.accountId)}">${esc(accountOptionLabel(a))}</option>`).join('');
  return `<section class="card full" style="margin-bottom:16px"><h3>Follower Account Dropdown</h3><p>When copying a leader, choose one of your already connected accounts instead of typing account/server again.</p><select>${options || '<option>Connect MT4 first</option>'}</select><a class="btn" href="/member/link-account?userId=${encodeURIComponent(userId)}">Connect a new account instead</a></section>`;
}


const PAID_LINK_PRODUCTS = [
  { productId: 'dfountain-copy-access', name: 'D.Fountain Copy Access', targetType: 'copy_leader', targetUserId: '518140439489019906', price: 197, billingType: 'monthly', badge: 'Featured Trader', description: 'Copy signals, Copier Engine access, and private desk updates from a featured CultureCoin leader.' },
  { productId: 'df-sauce-operator-link', name: 'DF SAUCE FINAL AI Operator Link', targetType: 'bot_owner', targetUserId: 'df-sauce-team', price: 497, billingType: 'monthly', badge: 'Bot Owner', description: 'Follow DF Sauce live account activity, approved signals, setup support, and bot-owner updates.' },
  { productId: 'wisdo-film-room-coach', name: 'WISDO Film Room Coach Link', targetType: 'coach', targetUserId: 'wisdo-coach', price: 75, billingType: 'one_time', badge: 'Coach', description: 'Submit trading videos and receive timestamp correction, coaching notes, and a WISDO review plan.' },
  { productId: 'xauusd-signal-room', name: 'XAUUSD Signal Room', targetType: 'signal_room', targetUserId: 'gold-room', price: 49, billingType: 'monthly', badge: 'Signal Room', description: 'Gold-only signal posts with short-lived Take This Trade buttons for connected accounts.' },
  { productId: 'vps-setup-link', name: 'VPS Setup Link', targetType: 'vps_operator', targetUserId: 'vps-forge', price: 97, billingType: 'one_time', badge: 'VPS Operator', description: 'Get bot installation, WebRequest setup, MT4 Reporter setup, and VPS monitoring help.' },
];

function identityBar(req) {
  const identity = getIdentity(req);
  return `<section class="card ok full"><div class="row" style="justify-content:space-between"><div class="row"><img src="${esc(identity.avatarUrl)}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:1px solid rgba(240,170,43,.5)"/><div><h3 style="margin:0">Logged in as @${esc(identity.displayName)}</h3><div class="muted">Discord ID: ${esc(identity.discordId)} • ${esc(identity.membershipTier)} • ${identity.loggedIn ? 'OAuth verified' : 'Fallback mode'}</div></div></div><a class="btn ghost" href="/member/profile">My Profile</a></div></section>`;
}

function linkAccessPage(req) {
  const identity = getIdentity(req);
  const cards = PAID_LINK_PRODUCTS.map((p) => `<section class="card upgrade"><div class="row" style="justify-content:space-between"><span class="tag">${esc(p.badge)}</span><span class="tag">${esc(p.billingType)}</span></div><h3>${esc(p.name)}</h3><div class="price">${money(p.price)}${p.billingType === 'monthly' ? '/mo' : ''}</div><p>${esc(p.description)}</p><div class="row"><span class="tag">${esc(p.targetType)}</span><span class="tag">Paid Link Access</span><span class="tag">Commission trackable</span></div><form method="post" action="/api/link-access/checkout" style="margin-top:12px"><input type="hidden" name="productId" value="${esc(p.productId)}"><input type="hidden" name="buyerUserId" value="${esc(identity.userId)}"><button class="btn primary" type="submit">Pay to Link</button><a class="btn ghost" href="/u/${encodeURIComponent(p.targetUserId)}">View Profile</a></form></section>`).join('');
  return `${sectionHero('Paid Link Access', 'Pay to link to traders, coaches, bot owners, signal rooms, private desks, and VPS setup operators. This turns relationships into trackable access, subscriptions, and commissions.', '<a class="btn primary" href="/member/linked-access">My Linked Access</a>')}${identityBar(req)}<section class="grid3">${cards}</section><section class="card full"><h3>How Paid Link Works</h3><p>User chooses who or what they want to link to → Square/manual checkout starts → access record is created → signals, desks, copy setup, or coaching access unlocks → referral commission can be tracked.</p></section>`;
}

function linkedAccessPage(req, state) {
  const identity = getIdentity(req);
  const ids = state.paidLinkAccessByUserId?.[identity.userId] || [];
  const rows = ids.map((id) => state.paidLinkAccessById?.[id]).filter(Boolean).map((a) => `<tr><td>${esc(a.productName)}</td><td>${esc(a.targetType)}</td><td>${money(a.price)} ${esc(a.billingType)}</td><td><span class="tag">${esc(a.status)}</span></td><td>${esc(a.createdAt || '')}</td></tr>`).join('');
  return `${sectionHero('My Linked Access', 'Track the traders, coaches, signal rooms, bot owners, and VPS operators you have paid to link with.', '<a class="btn primary" href="/member/link-access">Browse Link Access</a>')}${identityBar(req)}<section class="card full"><h3>Linked Access Records</h3><table><thead><tr><th>Access</th><th>Type</th><th>Price</th><th>Status</th><th>Created</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No paid link access yet.</td></tr>'}</tbody></table></section>`;
}

function publicProfilePage(username, state) {
  const profileName = String(username || 'culturecoin').replace(/-/g, ' ');
  const featured = PAID_LINK_PRODUCTS.filter((p) => String(p.targetUserId).toLowerCase().includes(String(username).toLowerCase()) || String(username).toLowerCase().includes('dfountain'));
  const cards = (featured.length ? featured : PAID_LINK_PRODUCTS.slice(0, 3)).map((p) => `<section class="card"><span class="tag">${esc(p.badge)}</span><h3>${esc(p.name)}</h3><div class="price">${money(p.price)}${p.billingType === 'monthly' ? '/mo' : ''}</div><p>${esc(p.description)}</p><form method="post" action="/api/link-access/checkout"><input type="hidden" name="productId" value="${esc(p.productId)}"><button class="btn primary" type="submit">Pay to Link</button></form></section>`).join('');
  return `${sectionHero(profileName, 'Public CultureCoin profile with paid links, copy access, signal access, bot-owner access, and coaching offers.', '<span class="tag">Verified Trader</span><span class="tag">Copy Leader</span><span class="tag">Signal Provider</span>')}<div class="grid3"><section class="card ok"><h3>Status</h3><div class="metric green">Trading Live</div><p>Bot running • Copy enabled • Signal provider</p></section><section class="card"><h3>Badges</h3><span class="tag">Verified Trader</span><span class="tag">Bot Owner</span><span class="tag">Top Seller</span></section><section class="card"><h3>CTA</h3><a class="btn primary" href="/member/link-access">Browse Paid Links</a><a class="btn primary" href="/member/copy-pro">Copier Engine</a></section></div><h2>Paid Link Offers</h2><section class="grid3">${cards}</section>`;
}

function adminLinkAccessPage(state) {
  const rows = Object.values(state.paidLinkAccessById || {}).map((a) => `<tr><td>${esc(a.linkAccessId)}</td><td>${esc(a.buyerUserId)}</td><td>${esc(a.productName)}</td><td>${esc(a.targetType)}</td><td>${esc(a.status)}</td><td>${money(a.price)}</td></tr>`).join('');
  return `${sectionHero('Admin Link Access', 'Manage paid links, grants, revokes, subscriptions, and access records.', '<a class="btn primary" href="/member/link-access">Member View</a>')}<section class="card full"><h3>Access Records</h3><table><thead><tr><th>ID</th><th>Buyer</th><th>Product</th><th>Type</th><th>Status</th><th>Price</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No paid link access records yet.</td></tr>'}</tbody></table></section><section class="card full"><h3>Manual Admin Actions</h3><p>Use the API to grant or revoke access while checkout/webhooks are being finalized.</p><pre>POST /api/admin/link-access/grant\nPOST /api/admin/link-access/revoke</pre></section>`;
}

function createPaidLinkAccess({ buyerUserId, productId, status = 'pending_payment', source = 'checkout' }) {
  const product = PAID_LINK_PRODUCTS.find((p) => p.productId === productId) || PAID_LINK_PRODUCTS[0];
  const now = new Date().toISOString();
  const linkAccessId = `linkacc_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  return {
    linkAccessId,
    buyerUserId: String(buyerUserId || 'website-buyer'),
    targetUserId: product.targetUserId,
    targetType: product.targetType,
    productId: product.productId,
    productName: product.name,
    price: product.price,
    billingType: product.billingType,
    status,
    source,
    squareSubscriptionId: null,
    createdAt: now,
    expiresAt: product.billingType === 'one_time' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

export async function startApiServer({ config, mt4SyncService, mt4CommandService, copyTradingService, tradeSignalService, deskDashboardService, rankService, announcementService, paymentService, logger, client = null, signalGridService: providedSignalGridService = null, signalCopyService: providedSignalCopyService = null, discordSignalGridService: providedDiscordSignalGridService = null }) {
  ecosystemStateCache = null;
  ecosystemStateLoadPromise = null;
  ecosystemStateSaveQueue = Promise.resolve();
  wisdoPhase1Repository = createWisdoPhase1Repository(config);
  await wisdoPhase1Repository.seedDevelopmentData();
  const redisCommandBridge = createRedisCommandBridge(config, logger);
  await redisCommandBridge.connect();
  redisCommandBridge.decorate(mt4CommandService);
  const affiliateService = new AffiliateService({ config, repository: wisdoPhase1Repository });
  const roleSyncService = new DiscordRoleSyncService({ config, client, repository: wisdoPhase1Repository, logger });
  const signalGridService = providedSignalGridService || new SignalGridService({ config, repository: wisdoPhase1Repository, logger });
  const signalCopyService = providedSignalCopyService || new SignalCopyService({ repository: wisdoPhase1Repository, signalGridService, mt4SyncService, mt4CommandService, roleSyncService, logger });
  const discordSignalGridService = providedDiscordSignalGridService || new DiscordSignalGridService({ client, signalGridService, signalCopyService, logger });
  const commandNotificationDeliveryService = new NotificationDeliveryService({ loadEcosystemState, saveEcosystemState, logger, publicBaseUrl: String(config?.api?.publicBaseUrl || process.env.PUBLIC_BASE_URL || '') });
  const app = express();
  app.set('trust proxy', true);

  // Route source of truth:
  // 1) webhook/raw integrations, 2) core middleware/static assets,
  // 3) exact Wisdo premium /member routes, 4) Deadshot portal aliases/fallbacks,
  // 5) public/auth/API/member/admin routes. Keep exact Wisdo routes before
  // registerDeadshotCommandCenterRoutes so broad legacy /member/* redirects do
  // not intercept /member/command-center, /education, /simulator, /social, etc.
  app.use(express.json({ limit: '200mb', verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); } }));

  app.get('/api/copier-infrastructure-health', async (_req, res) => {
    const redis = await redisCommandBridge.health();
    let postgres = { connected: false, mode: String(config?.persistenceMode || config?.persistence?.mode || 'json') };
    try {
      const adapter = wisdoPhase1Repository?.adapter;
      if (adapter?.getPool) {
        const pool = await adapter.getPool();
        const result = await pool.query('select now() as server_time');
        postgres = { connected: true, mode: 'postgres', serverTime: result.rows[0]?.server_time || null };
      }
    } catch (error) { postgres = { connected: false, mode: 'postgres', error: error.message }; }
    res.status(postgres.connected && (!redis.enabled || redis.connected) ? 200 : 503).json({
      ok: postgres.connected && (!redis.enabled || redis.connected),
      postgres,
      redis,
      noLazyLoading: true,
      persistenceStrategy: 'eager sectioned PostgreSQL state plus Redis command delivery',
    });
  });

  app.get('/api/signal-health', async (req, res) => {
    const configuredChannel = process.env.SIGNAL_CHANNEL_ID || process.env.TRADE_SIGNAL_CHANNEL_ID || '';
    const state = await loadEcosystemState();
    const savedGlobal = state.discordGlobalChannels?.tradingSignalsChannelId || '';
    const savedUserCount = Object.values(state.discordChannelSettingsByUserId || {}).filter((item) => item?.tradingSignalsChannelId).length;
    const effectiveChannel = configuredChannel || savedGlobal;
    const signalReady = Boolean(tradeSignalService);
    res.json({
      ok: true,
      signalServiceAttached: signalReady,
      signalChannelIdConfigured: Boolean(effectiveChannel),
      signalChannelSource: configuredChannel ? 'env' : savedGlobal ? 'website_saved_global' : 'leader_desk_fallback',
      signalChannelId: effectiveChannel ? `${effectiveChannel.slice(0, 4)}...${effectiveChannel.slice(-4)}` : null,
      savedUserSignalChannelCount: savedUserCount,
      signalsFromAllConnected: String(process.env.WISDO_SIGNALS_FROM_ALL_CONNECTED || 'true').toLowerCase() !== 'false',
      buttonTtlSeconds: Number(process.env.SIGNAL_BUTTON_TTL_SECONDS || 180),
      note: effectiveChannel ? 'Signals will post to configured/saved trading signal channel.' : 'No global signal channel; signals fall back to the leader desk channel when available.',
    });
  });

  app.use(express.urlencoded({ extended: true }));
  app.use('/media', express.static(path.join(__dirname, '..', 'public', 'media')));
  app.use('/platforms', express.static(path.join(__dirname, '..', 'public', 'platforms')));
  app.use('/js', express.static(path.join(__dirname, '..', 'public', 'js')));
  app.use('/downloads', express.static(path.join(__dirname, '..', 'public', 'downloads')));
  app.get('/service-worker.js', (_req, res) => {
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, '..', 'public', 'service-worker.js'));
  });
  app.use('/uploads', express.static(path.join(config.dataDir, 'uploads')));

  registerMajorUpgradeRoutes(app, {
    config,
    loadEcosystemState,
    saveEcosystemState,
    mt4SyncService,
    mt4CommandService,
    copyTradingService,
    logger,
  });

  registerExtendedProductRoutes(app, {
    config,
    loadEcosystemState,
    saveEcosystemState,
    logger,
    paymentService,
  });

  async function getRequestAccess(req) {
    const identity = getIdentity(req);
    const status = await roleSyncService.getRoleSyncStatus(identity.userId);
    return { identity, status, access: roleSyncService.publicAccess(status) };
  }

  async function auditDenied(actorUserId, action, targetType, targetId, metadata = {}) {
    await wisdoPhase1Repository.addAuditLog({
      adminId: actorUserId || 'system',
      action,
      targetType,
      targetId,
      data: metadata,
    });
  }

  function forbiddenPage(title, message, access = {}) {
    return `${sectionHero(title, message, '<a class="btn primary" href="/member/command-center">Command Center</a><a class="btn" href="/api/wisdo/me/roles">My Role Status</a>')}
    <section class="card warn full"><h3>Discord role sync required</h3><p>Your current access level is <strong>${esc(access.accessLevel || 'none')}</strong>. Ask an OWNER or WISDO admin to refresh your role sync if this looks wrong.</p><p>${(access.matchedDiscordRoles || []).map((role) => `<span class="tag">${esc(role)}</span>`).join('') || '<span class="tag">No mapped Discord roles found</span>'}</p></section>`;
  }

  async function renderAdminWisdoPage(req, res, title = 'Admin Wisdo') {
    const { identity, access } = await getRequestAccess(req);
    if (!canAccessAdmin(access)) {
      await auditDenied(identity.userId, 'admin_page.denied', 'Route', req.path, { required: 'OWNER or WISDO', access });
      return res.status(403).send(htmlShell('Admin Access Required', forbiddenPage('Admin Access Required', 'OWNER or WISDO Discord role is required for this workspace.', access), 'adminwisdo'));
    }
    const state = await loadEcosystemState();
    res.send(htmlShell(title, adminWisdoPage(state), 'adminwisdo', { adminAccess: true }));
  }

  async function requireWisdoAdmin(req, res, next) {
    const { identity, access } = await getRequestAccess(req);
    if (canAccessAdmin(access)) return next();
    await auditDenied(identity.userId, 'api_admin.denied', 'Route', req.path, { required: 'OWNER or WISDO', access });
    return res.status(403).json({ ok: false, error: 'OWNER or WISDO Discord role is required.', access });
  }

  function renderLogin(req, res) {
    res.send(htmlShell('Login', loginHealthPanel(req, config, String(req.query?.error || '')), 'home'));
  }

  function authSuccess(req, res) {
    const cookies = parseCookies(req);
    const target = safeReturnPath(req.query?.returnTo || cookies.login_return_to, '/member/command-center');
    clearCookie(res, 'login_return_to');
    res.redirect(target);
  }

  function startDiscordLogin(req, res) {
    const health = getAuthHealth(req, config);
    if (!health.loginReady) return res.redirect('/login?error=missing_oauth_config');
    const state = crypto.randomBytes(16).toString('hex');
    const returnTo = safeReturnPath(req.query?.returnTo || req.query?.next || req.query?.redirect, '/member/command-center');
    setCookie(res, 'oauth_state', state, { maxAge: 600 });
    setCookie(res, 'login_return_to', returnTo, { maxAge: 600 });
    const clientId = process.env.CLIENT_ID || config?.discord?.clientId || config?.clientId || '';
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: health.expectedRedirectUri, response_type: 'code', scope: 'identify', state });
    res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
  }

  async function finishDiscordLogin(req, res) {
    try {
      const health = getAuthHealth(req, config);
      if (!health.loginReady) return res.redirect('/login?error=missing_oauth_config');
      const code = String(req.query?.code || '');
      const state = String(req.query?.state || '');
      const cookies = parseCookies(req);
      if (!code) return res.redirect('/login?error=missing_discord_code');
      if (!state || !cookies.oauth_state || state !== cookies.oauth_state) return res.redirect('/login?error=invalid_oauth_state');
      const clientId = process.env.CLIENT_ID || config?.discord?.clientId || config?.clientId || '';
      const clientSecret = process.env.CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET || '';
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: health.expectedRedirectUri }),
      });
      const tokenJson = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !tokenJson.access_token) {
        logger.warn('Discord OAuth token exchange failed', { status: tokenRes.status, error: tokenJson.error, description: tokenJson.error_description });
        return res.redirect(`/login?error=${encodeURIComponent(tokenJson.error_description || tokenJson.error || 'discord_token_error')}`);
      }
      const userRes = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${tokenJson.access_token}` } });
      const discordUser = await userRes.json().catch(() => ({}));
      if (!userRes.ok || !discordUser.id) return res.redirect('/login?error=discord_user_fetch_failed');
      setCookie(res, 'cc_user', encodeSession(discordUser), { maxAge: 60 * 60 * 24 * 30 });
      clearCookie(res, 'oauth_state');
      clearCookie(res, 'login_return_to');
      res.redirect(safeReturnPath(cookies.login_return_to, '/member/command-center'));
    } catch (error) {
      logger.error('Discord OAuth callback failed', { message: error.message, stack: error.stack });
      res.redirect(`/login?error=${encodeURIComponent(error.message || 'oauth_callback_failed')}`);
    }
  }

  app.get('/login', renderLogin);
  app.get('/auth/success', authSuccess);
  app.get('/auth/discord', startDiscordLogin);
  app.get('/auth/discord/callback', finishDiscordLogin);
  // Public '/' is owned by registerDeadshotCommandCenterRoutes / tcLandingPage. Legacy publicHomePage route disabled.

  app.get('/member', async (req, res) => {
    const { identity, access } = await getRequestAccess(req);
    const hasExplicitMemberIdentity = Boolean(req.query?.userId || req.query?.discordUserId);
    if (identity.loggedIn || hasExplicitMemberIdentity) return res.redirect('/member/command-center');
    res.send(htmlShell('Wisdo Member Portal', memberPortalPreviewPage(req, access), 'home', { adminAccess: canAccessAdmin(access) }));
  });

  // Exact Wisdo premium routes must register before the Deadshot portal aliases,
  // which intentionally gate legacy /member/* paths behind the app login shell.
  app.get('/member/command-center', async (req, res) => {
    const userId = currentUserId(req);
    const { access } = await getRequestAccess(req);
    const mt4 = await mt4SyncService.repository.loadMt4State();
    const state = await loadEcosystemState();
    const accounts = mt4SyncService.repository.getAccessibleMt4Accounts ? await mt4SyncService.repository.getAccessibleMt4Accounts(userId) : getMyConnectedAccounts(mt4, userId);
    const desk = defaultWisdoDesk(userId, accounts, state);
    res.send(htmlShell('Wisdo Command Center', wisdoCommandCenterPage({ userId, desk, state, config }), 'command', { adminAccess: canAccessAdmin(access) }));
  });
  app.get('/member/education', async (req, res) => { const userId = currentUserId(req); const state = await loadEcosystemState(); res.send(htmlShell('Wisdo Education', wisdoEducationPage(state, userId, String(req.query?.bot || req.query?.botSlug || '')), 'education')); });
  app.get('/member/ai', (_req, res) => res.send(htmlShell('Wisdo AI Center', wisdoAiCenterPage(), 'ai')));
  app.get('/member/academy', (_req, res) => res.send(htmlShell('Wisdo Trading Academy', wisdoAcademyPage(''), 'education')));
  app.get('/member/academy/lesson/:lessonId', (req, res) => res.send(htmlShell('Wisdo Academy Lesson', wisdoAcademyPage(String(req.params.lessonId || '')), 'education')));
  app.get('/member/academy/:trackSlug', (req, res) => res.send(htmlShell('Wisdo Trading Academy', wisdoAcademyPage(String(req.params.trackSlug || '')), 'education')));
  app.get('/member/signal-grid', async (req, res) => { const userId = currentUserId(req); const state = await loadEcosystemState(); res.send(htmlShell('Wisdo Signal Grid', signalGridPage(userId, state), 'signals')); });
  app.get('/member/risk-settings', async (req, res) => { const userId = currentUserId(req); const state = await loadEcosystemState(); res.send(htmlShell('Risk Settings', riskProfilePage(userId, state), 'risk')); });
  app.get('/member/marketplace', (req, res) => res.send(htmlShell('Bot Marketplace', botsPage(config), 'marketplace')));
  app.get('/member/simulator', (req, res) => res.send(htmlShell('Wisdo Simulator', wisdoSimulatorPage(String(req.query?.bot || '')), 'simulator')));
  app.get('/member/social', async (req, res) => { const userId = currentUserId(req); const state = await loadEcosystemState(); res.send(htmlShell('Wisdo Social', wisdoSocialPage(state, userId), 'social')); });
  app.get('/admin/wisdo', async (req, res) => renderAdminWisdoPage(req, res, 'Admin Wisdo'));
  app.get('/member/admin-wisdo', async (req, res) => renderAdminWisdoPage(req, res, 'Admin Wisdo Workbench'));
  app.post('/api/wisdo/command', async (req, res) => {
    const requester = await getRequestAccess(req);
    const bodyUserId = String(req.body?.userId || '').trim();
    if (bodyUserId && bodyUserId !== requester.identity.userId && !canAccessAdmin(requester.access)) {
      await auditDenied(requester.identity.userId, 'mt4_command.denied_user_spoof', 'User', bodyUserId, { path: req.path, access: requester.access });
      return res.status(403).json({ ok: false, error: 'You cannot queue MT4 commands for another user.', access: requester.access });
    }
    if (!hasPermission(requester.access, 'portal.member') && !hasPermission(requester.access, 'accounts.connect')) {
      await auditDenied(requester.identity.userId, 'mt4_command.denied_role_gate', 'Route', req.path, { access: requester.access });
      return res.status(403).json({ ok: false, error: 'Member access is required before MT4 commands can be queued.', access: requester.access });
    }
    const userId = bodyUserId || requester.identity.userId;
    const accountId = String(req.body?.accountId || '').trim();
    if (accountId && !canAccessAdmin(requester.access)) {
      const accounts = mt4SyncService.repository.getAccessibleMt4Accounts ? await mt4SyncService.repository.getAccessibleMt4Accounts(userId) : getMyConnectedAccounts(await mt4SyncService.repository.loadMt4State(), userId);
      if (!accounts.some((account) => String(account.accountId) === accountId)) {
        await auditDenied(requester.identity.userId, 'mt4_command.denied_account_access', 'MT4Account', accountId, { userId, access: requester.access });
        return res.status(403).json({ ok: false, error: 'Selected account is not owned/shared with this user.', access: requester.access });
      }
    }
    const rawText = String(req.body?.rawCommand || req.body?.text || '').trim();
    const action = String(req.body?.action || '').trim();
    const mapped = legacyWisdoCommandIntent(action, rawText);
    const payload = {
      ...mapped.payload,
      ...(req.body || {}),
      rawText,
      action,
      parsedIntent: mapped.command,
      accountId: accountId || undefined,
      globals: mapped.payload?.globals || req.body?.globals,
    };
    let command;
    try {
      command = accountId
        ? await mt4CommandService.queueCommandForAccount(userId, accountId, mapped.command, payload)
        : await mt4CommandService.queueCommand(userId, mapped.command, payload);
    } catch (error) {
      return res.status(400).json({ ok: false, error: error.message, validation: error.validation || null, mapped });
    }
    const state = await loadEcosystemState();
    auditAdminAction(state, userId, command.requiresConfirmation || command.confirmationRequired ? 'dangerous_mt4_command_requested' : 'mt4_command_created', 'MT4Command', command.id, { command: mapped.command, accountId });
    await saveEcosystemState(state);
    res.json({ ok: true, command, mapped });
  });

  registerDeadshotCommandCenterRoutes(app, {
    config,
    loadEcosystemState,
    saveEcosystemState,
    mt4SyncService,
    mt4CommandService,
    logger,
  });

  // Public '/' is owned by registerDeadshotCommandCenterRoutes / tcLandingPage. Legacy publicHomePage route disabled.
  app.get('/health', (req, res) => {
    const publicBaseUrl = String(config.api.publicBaseUrl || '').trim();
    let publicOriginOk = true;
    if (publicBaseUrl) {
      try {
        const parsed = new URL(publicBaseUrl);
        publicOriginOk = `${parsed.origin}` === publicBaseUrl.replace(/\/$/, '');
      } catch {
        publicOriginOk = false;
      }
    }
    res.json({
      ok: true,
      service: 'CultureCoin WISDO Member Portal',
      portal: '/member',
      commandCenter: '/member/command-center',
      signalGrid: '/member/signal-grid',
      persistenceMode: config.persistence?.mode || 'json',
      storagePathConfigured: Boolean(config.persistence?.storagePath),
      databaseUrlConfigured: Boolean(config.persistence?.databaseUrl),
      publicBaseUrlConfigured: Boolean(publicBaseUrl),
      publicBaseUrlOriginOnly: publicOriginOk,
      mt4SyncPath: config.api.mt4SyncPath || '/mt4-sync',
    });
  });
  app.get('/health/mt4', async (req, res) => {
    const publicBaseUrl = String(config.api.publicBaseUrl || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const syncPath = config.api.mt4SyncPath || '/mt4-sync';
    const state = await mt4SyncService.repository.loadMt4State().catch(() => ({}));
    const pairingCodes = Object.values(state.pairingCodes || {});
    const latestSnapshots = Object.values(state.latestSnapshotsByAccountId || state.latestSnapshots || {});
    res.json({
      ok: true,
      publicBaseUrl,
      syncUrl: `${publicBaseUrl}${syncPath}`,
      commandPollUrl: `${publicBaseUrl}/mt4-command-poll`,
      commandCompleteUrl: `${publicBaseUrl}/mt4-command-complete`,
      mt4SyncApiKeyRequired: Boolean(config.api.mt4SyncApiKey),
      pendingPairingCodes: pairingCodes.filter((code) => code?.status === 'pending').length,
      connectedPairingCodes: pairingCodes.filter((code) => code?.status === 'connected').length,
      latestSnapshotCount: latestSnapshots.length,
      notes: [
        'Reporter SyncUrl must equal syncUrl.',
        'MT4 Tools -> Options -> Expert Advisors must allow WebRequest for publicBaseUrl only.',
        'If mt4SyncApiKeyRequired is true, Reporter ApiKey must match MT4_SYNC_API_KEY.',
      ],
    });
  });

  app.get('/api/upgrades', (req, res) => {
    res.json({ ok: true, upgrades: SPECIAL_UPGRADES });
  });

  app.get('/api/bots', (req, res) => {
    res.json({ ok: true, recommended: EA_CATALOG.find((bot) => bot.recommended)?.name || null, bots: EA_CATALOG });
  });

  app.get('/api/wisdo/models', (_req, res) => {
    res.json({ ok: true, project: 'Wisdo', tagline: 'Connect. Copy. Control.', models: WISDO_MODEL_REGISTRY });
  });

  app.get('/api/wisdo/signal-grid', async (req, res) => {
    const userId = currentUserId(req);
    const grid = await signalGridService.getWebsiteGrid(userId, req.query || {});
    res.json({ ok: true, ...grid });
  });

  app.get('/api/wisdo/signal-grid/detail/:signalId', async (req, res) => {
    const detail = await signalGridService.getSignalDetail(currentUserId(req), req.params.signalId);
    if (!detail) return res.status(404).json({ ok: false, error: 'Signal not found.' });
    res.json({ ok: true, detail });
  });

  app.post('/api/wisdo/signal-grid/preview-copy', async (req, res) => {
    const userId = String(req.body?.userId || currentUserId(req));
    const preview = await signalCopyService.previewCopySignal(userId, req.body?.accountId || '', req.body?.signalId || req.body?.id || '', req.body?.riskSettings || req.body?.risk || {});
    res.json({ ok: true, preview });
  });

  app.post('/api/wisdo/signal-grid/copy-basket', async (req, res) => {
    const userId = String(req.body?.userId || currentUserId(req));
    const state = await loadEcosystemState();
    const gate = academyRequiredEducationStatus(state, userId, 'copy_basket');
    const requester = await getRequestAccess(req);
    const adminOverride = Boolean(req.body?.educationOverride) && canAccessAdmin(requester.access);
    const paperMode = Boolean(req.body?.paperMode || req.body?.riskSettings?.paperMode || req.body?.risk?.paperMode);
    if (!paperMode && !gate.ok && !adminOverride) return res.status(409).json({ ok: false, educationRequired: true, gate, error: gate.message, academyUrl: '/member/academy' });
    if (!paperMode && adminOverride && !gate.ok) {
      auditAdminAction(state, requester.identity.userId, 'academy_copy_gate_override', 'SignalGridCopy', req.body?.signalId || req.body?.id || '', { userId, gate });
      await saveEcosystemState(state);
    }
    const result = await signalCopyService.copySignalBasket(userId, req.body?.accountId || '', req.body?.signalId || req.body?.id || '', req.body?.riskSettings || req.body?.risk || {});
    res.status(result.ok ? 200 : 403).json(result);
  });

  app.post('/api/wisdo/signal-grid/subscribe-bot', async (req, res) => {
    try {
      const userId = String(req.body?.userId || currentUserId(req));
      const state = await loadEcosystemState();
      const gate = academyRequiredEducationStatus(state, userId, 'copy_bot');
      const requester = await getRequestAccess(req);
      const adminOverride = Boolean(req.body?.educationOverride) && canAccessAdmin(requester.access);
      if (!gate.ok && !adminOverride) return res.status(409).json({ ok: false, educationRequired: true, gate, error: gate.message, academyUrl: '/member/academy/bot-training' });
      if (adminOverride && !gate.ok) {
        auditAdminAction(state, requester.identity.userId, 'academy_bot_copy_gate_override', 'CopyBotSubscription', req.body?.botId || '', { userId, gate });
        await saveEcosystemState(state);
      }
      const subscription = await signalCopyService.subscribeToBotSignals(userId, req.body?.accountId || '', req.body?.botId || '', req.body?.riskSettings || req.body?.risk || {});
      res.json({ ok: true, subscription });
    } catch (error) {
      res.status(403).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/wisdo/signal-grid/unsubscribe-bot', async (req, res) => {
    const userId = String(req.body?.userId || currentUserId(req));
    const subscription = await signalCopyService.unsubscribeFromBotSignals(userId, req.body?.botId || '');
    res.json({ ok: Boolean(subscription), subscription, error: subscription ? null : 'Subscription not found.' });
  });

  app.get('/api/wisdo/signal-grid/my-copies', async (req, res) => {
    const userId = String(req.query?.userId || currentUserId(req));
    const copies = await signalCopyService.listUserCopies(userId);
    res.json({ ok: true, copies });
  });

  app.get('/api/wisdo/me/roles', async (req, res) => {
    const { identity, status, access } = await getRequestAccess(req);
    res.json({ ok: true, identity, roleSync: status, access });
  });

  app.post('/api/wisdo/me/roles/refresh', async (req, res) => {
    try {
      const identity = getIdentity(req);
      const discordUserId = req.body?.discordUserId || identity.discordId || identity.userId;
      const roleSync = await roleSyncService.syncUserRolesFromDiscord(identity.userId, discordUserId, { actorUserId: identity.userId, manual: true });
      res.json({ ok: true, roleSync, access: roleSyncService.publicAccess(roleSync) });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.get('/api/wisdo/ai/context', async (req, res) => {
    const state = await loadEcosystemState();
    const mt4 = await mt4SyncService.repository.loadMt4State();
    const { access } = await getRequestAccess(req);
    const userId = currentUserId(req);
    res.json({ ok: true, context: buildWisdoAiContext({ state, mt4, userId, access, page: String(req.query?.page || '') }), modes: WISDO_AI_MODES, disclaimer: WISDO_AI_DISCLAIMER });
  });

  app.post('/api/wisdo/ai/ask', async (req, res) => {
    const state = await loadEcosystemState();
    const mt4 = await mt4SyncService.repository.loadMt4State();
    const { access } = await getRequestAccess(req);
    const userId = String(req.body?.userId || currentUserId(req));
    const mode = String(req.body?.mode || 'global');
    const page = String(req.body?.page || req.body?.route || '');
    const prompt = String(req.body?.prompt || req.body?.question || '');
    const context = buildWisdoAiContext({ state, mt4, userId, access, page });
    const result = await askWisdoAi({ mode, prompt, page, context, logger });
    const log = { logId: makeId('ai'), userId, mode, page, prompt: prompt.slice(0, 2000), provider: result.provider, model: result.model, answerPreview: String(result.answer || '').slice(0, 500), createdAt: new Date().toISOString() };
    state.aiCoachLogsByUserId ||= {};
    state.aiCoachLogsByUserId[userId] ||= [];
    state.aiCoachLogsByUserId[userId].unshift(log);
    state.aiCoachLogsByUserId[userId] = state.aiCoachLogsByUserId[userId].slice(0, 100);
    await saveEcosystemState(state);
    res.json({ ok: true, ...result, contextSummary: context.counts, logId: log.logId });
  });

  app.post('/api/wisdo/ai/explain', async (req, res) => {
    const state = await loadEcosystemState();
    const mt4 = await mt4SyncService.repository.loadMt4State();
    const { access } = await getRequestAccess(req);
    const userId = String(req.body?.userId || currentUserId(req));
    const page = String(req.body?.page || 'Wisdo');
    const mode = String(req.body?.mode || 'global');
    const context = buildWisdoAiContext({ state, mt4, userId, access, page });
    const result = await askWisdoAi({ mode, page, prompt: `Explain ${page} and give safe next steps.`, context, logger });
    res.json({ ok: true, ...result, contextSummary: context.counts });
  });

  app.get('/api/wisdo/ai/insights', async (req, res) => {
    const userId = String(req.query?.userId || currentUserId(req));
    const state = await loadEcosystemState();
    res.json({ ok: true, logs: state.aiCoachLogsByUserId?.[userId] || [], insights: Object.values(state.aiInsightsById || {}).filter((item) => !item.userId || String(item.userId) === userId) });
  });

  app.get('/api/wisdo/marketplace', async (req, res) => {
    const state = await loadEcosystemState();
    const { access } = await getRequestAccess(req);
    const bots = EA_CATALOG.map((bot) => {
      const record = marketplaceBotRecord(bot, state);
      const accessAllowed = canSeeMarketplaceBot(access, record);
      return {
        ...record,
        accessAllowed,
        locked: !accessAllowed,
        lockedReason: accessAllowed ? '' : 'CULTURE COIN MEMBER+ or admin role required for this marketplace section.',
      };
    });
    const requestedBot = String(req.query?.bot || req.query?.slug || '').trim();
    if (requestedBot) {
      const lockedBot = bots.find((bot) => String(bot.slug) === requestedBot || String(bot.botId) === requestedBot);
      if (lockedBot?.locked) {
        await auditDenied(access.userId, 'marketplace_bot_access.denied', 'Bot', lockedBot.botId, { accessLevel: lockedBot.accessLevel, access });
      }
    }
    const sections = {
      recentlyUpdated: bots.slice().sort((a, b) => String(b.versions?.[0]?.createdAt || '').localeCompare(String(a.versions?.[0]?.createdAt || ''))).slice(0, 12),
      mostCopied: bots.filter((bot) => bot.tags.includes('Copy Trading') || String(bot.strategyType).toLowerCase().includes('copy')).slice(0, 12),
      bestForBeginners: bots.filter((bot) => !String(bot.riskLevel).toLowerCase().includes('high')).slice(0, 12),
      highVolatility: bots.filter((bot) => String(bot.riskLevel).toLowerCase().includes('high')).slice(0, 12),
      goldBots: bots.filter((bot) => String(bot.supportedMarkets).toLowerCase().includes('xau') || String(bot.supportedMarkets).toLowerCase().includes('gold')).slice(0, 12),
      newsBots: bots.filter((bot) => String(bot.strategyType).toLowerCase().includes('news')).slice(0, 12),
      scalpers: bots.filter((bot) => String(bot.strategyType).toLowerCase().includes('scalp')).slice(0, 12),
      swingBots: bots.filter((bot) => String(bot.strategyType).toLowerCase().includes('swing') || String(bot.strategyType).toLowerCase().includes('trend')).slice(0, 12),
      experimentalLab: bots.filter((bot) => String(bot.strategyType).toLowerCase().includes('experimental')).slice(0, 12),
    };
    res.json({ ok: true, access, bots, sections, seedDataNote: 'EA_CATALOG records are seed/server inventory until admin uploads replace or enrich metadata.' });
  });

  app.get('/api/wisdo/desks/me', async (req, res) => {
    const userId = currentUserId(req);
    const state = await loadEcosystemState();
    const mt4 = await mt4SyncService.repository.loadMt4State();
    const accounts = mt4SyncService.repository.getAccessibleMt4Accounts ? await mt4SyncService.repository.getAccessibleMt4Accounts(userId) : getMyConnectedAccounts(mt4, userId);
    const desk = defaultWisdoDesk(userId, accounts, state);
    state.wisdoDesksByUserId[String(userId)] = { ...(state.wisdoDesksByUserId[String(userId)] || {}), ...desk, accounts: undefined };
    await saveEcosystemState(state);
    res.json({ ok: true, desk, theme: state.themePreferencesByUserId?.[String(userId)] || { theme: 'neon' } });
  });

  app.post('/api/wisdo/account-selection', async (req, res) => {
    const userId = currentUserId(req);
    const accountId = String(req.body?.accountId || '').trim();
    const mt4 = await mt4SyncService.repository.loadMt4State();
    const accounts = mt4SyncService.repository.getAccessibleMt4Accounts ? await mt4SyncService.repository.getAccessibleMt4Accounts(userId) : getMyConnectedAccounts(mt4, userId);
    if (accountId && !accounts.some((a) => String(a.accountId) === accountId)) {
      return res.status(404).json({ ok: false, error: 'Account not found for this Wisdo Desk.' });
    }
    const state = await loadEcosystemState();
    const preference = persistDeskPreference(state, userId, { selectedAccountId: accountId || accounts[0]?.accountId || '' });
    auditAdminAction(state, userId, 'account_selection_changed', 'UserDesk', userId, { selectedAccountId: preference.selectedAccountId || '' });
    upsertNotification(state, userId, { type: 'account_selected', title: 'Account switch saved', message: `Selected account ${preference.selectedAccountId || 'none'} now follows you across Wisdo.` });
    await saveEcosystemState(state);
    res.json({ ok: true, preference });
  });

  app.get('/api/wisdo/theme', async (req, res) => {
    const userId = currentUserId(req);
    const state = await loadEcosystemState();
    res.json({ ok: true, themes: WISDO_THEMES, preference: state.themePreferencesByUserId?.[String(userId)] || { theme: 'neon' } });
  });

  app.post('/api/wisdo/theme', async (req, res) => {
    const userId = currentUserId(req);
    const theme = String(req.body?.theme || 'neon');
    if (!WISDO_THEMES[theme]) return res.status(400).json({ ok: false, error: 'Unknown Wisdo theme.' });
    const state = await loadEcosystemState();
    state.themePreferencesByUserId[String(userId)] = { userId, theme, accent: WISDO_THEMES[theme].accent, updatedAt: new Date().toISOString() };
    auditAdminAction(state, userId, 'theme_changed', 'ThemePreference', userId, { theme, accent: WISDO_THEMES[theme].accent });
    upsertNotification(state, userId, { type: 'theme_updated', title: 'Theme updated', message: `Wisdo theme changed to ${WISDO_THEMES[theme].label}.` });
    await saveEcosystemState(state);
    res.json({ ok: true, preference: state.themePreferencesByUserId[String(userId)], themes: WISDO_THEMES });
  });

  app.post('/api/wisdo/risk/calculate', async (req, res) => {
    const userId = currentUserId(req);
    const state = await loadEcosystemState();
    const calculation = calculateWisdoRisk(req.body || {});
    state.copyTradeLogsById ||= {};
    const log = { logId: makeId('riskcalc'), userId, accountId: req.body?.accountId || '', type: 'risk_calculation', input: req.body || {}, calculation, createdAt: new Date().toISOString() };
    state.copyTradeLogsById[log.logId] = log;
    await saveEcosystemState(state);
    res.json({ ok: true, calculation, log });
  });

  app.get('/api/wisdo/copy-risk/me', async (req, res) => {
    const userId = currentUserId(req);
    const state = await loadEcosystemState();
    res.json({ ok: true, profile: state.copyRiskProfilesByUserId?.[String(userId)] || state.riskProfilesByUserId?.[String(userId)] || null });
  });

  app.post('/api/me/risk-profile', async (req, res) => {
    const userId = String(req.body?.userId || currentUserId(req));
    const profile = {
      userId,
      ...normalizeRiskBody(req.body || {}),
      updatedAt: new Date().toISOString(),
    };
    const state = await loadEcosystemState();
    state.riskProfilesByUserId ||= {};
    state.copyRiskProfilesByUserId ||= {};
    state.riskProfilesByUserId[userId] = profile;
    state.copyRiskProfilesByUserId[userId] = profile;
    auditAdminAction(state, userId, 'risk_profile.saved', 'CopyRiskProfile', userId, { mode: profile.mode, acceptedRiskDisclaimer: profile.acceptedRiskDisclaimer });
    await saveEcosystemState(state);
    res.json({ ok: true, profile, checklist: {
      riskSettingsComplete: Boolean(profile.mode && profile.maxLot && profile.maxOpenTrades),
      disclaimerAccepted: Boolean(profile.acceptedRiskDisclaimer),
      liveCopyRequiresConfirmation: profile.liveCopyRequiresConfirmation !== false,
    } });
  });

  app.get('/api/me/risk-profile', async (req, res) => {
    const userId = currentUserId(req);
    const state = await loadEcosystemState();
    res.json({ ok: true, profile: state.copyRiskProfilesByUserId?.[String(userId)] || state.riskProfilesByUserId?.[String(userId)] || null });
  });

  app.post('/api/wisdo/copy-requests', async (req, res) => {
    const userId = currentUserId(req);
    const { access } = await getRequestAccess(req);
    if (!canRequestCopy(access)) {
      await auditDenied(userId, 'copy_request.denied', 'Route', req.path, { required: 'copy.request', access });
      return res.status(403).json({ ok: false, error: 'Culture member or higher role is required to request copy access.', access });
    }
    const state = await loadEcosystemState();
    const request = {
      requestId: makeId('copyreq'),
      requesterUserId: userId,
      providerUserId: String(req.body?.providerUserId || req.body?.ownerUserId || ''),
      sourceType: String(req.body?.sourceType || 'trader'),
      sourceId: String(req.body?.sourceId || req.body?.accountId || ''),
      status: 'pending_approval',
      riskProfile: normalizeRiskBody(req.body?.riskProfile || req.body || {}),
      note: String(req.body?.note || ''),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    state.copyRequestsById[request.requestId] = request;
    upsertNotification(state, request.providerUserId || userId, { type: 'copy_request_received', title: 'Copy request received', message: `${userId} requested copy access.` });
    await saveEcosystemState(state);
    res.json({ ok: true, request });
  });

  app.patch('/api/wisdo/copy-requests/:requestId', async (req, res) => {
    const reviewer = await getRequestAccess(req);
    if (!canAccessAdmin(reviewer.access)) {
      await auditDenied(reviewer.identity.userId, 'copy_request_review.denied', 'CopyRequest', req.params.requestId, { required: 'OWNER or WISDO', access: reviewer.access });
      return res.status(403).json({ ok: false, error: 'OWNER or WISDO Discord role is required to review copy requests.', access: reviewer.access });
    }
    const state = await loadEcosystemState();
    const request = state.copyRequestsById?.[req.params.requestId];
    if (!request) return res.status(404).json({ ok: false, error: 'Copy request not found.' });
    const status = String(req.body?.status || '').trim();
    if (!['approved', 'denied', 'paused', 'expired', 'error'].includes(status)) return res.status(400).json({ ok: false, error: 'Invalid copy request status.' });
    request.status = status;
    request.reviewedAt = new Date().toISOString();
    request.reviewNote = String(req.body?.reviewNote || '');
    if (status === 'approved') {
      const requesterAccess = await roleSyncService.getAccessForUser(request.requesterUserId);
      if (!canUseCopier(requesterAccess)) {
        auditAdminAction(state, currentUserId(req), 'copy_activation.denied_role_gate', 'CopyRequest', request.requestId, { requesterUserId: request.requesterUserId, required: 'CULTURE COIN MEMBER+', access: requesterAccess });
        await saveEcosystemState(state);
        return res.status(403).json({ ok: false, error: 'CULTURE COIN MEMBER+ is required before copy access can become active.', access: requesterAccess });
      }
      const relationship = { relationshipId: makeId('copyrel'), requestId: request.requestId, providerUserId: request.providerUserId, followerUserId: request.requesterUserId, sourceId: request.sourceId, status: 'active', riskProfile: request.riskProfile, createdAt: new Date().toISOString() };
      state.copyRelationshipsById[relationship.relationshipId] = relationship;
      auditAdminAction(state, currentUserId(req), 'copy_request_approved', 'CopyRequest', request.requestId, { relationshipId: relationship.relationshipId });
      upsertNotification(state, request.requesterUserId, { type: 'copy_request_approved', title: 'Copy request approved', message: 'Your copy relationship is active with risk controls.' });
    } else if (status === 'denied') {
      auditAdminAction(state, currentUserId(req), 'copy_request_denied', 'CopyRequest', request.requestId, { reason: request.reviewNote });
    }
    await saveEcosystemState(state);
    res.json({ ok: true, request });
  });

  app.get('/api/wisdo/education', async (req, res) => {
    const state = await loadEcosystemState();
    const { access } = await getRequestAccess(req);
    const botSlug = String(req.query?.bot || req.query?.botSlug || '').trim();
    const annotateModule = (module) => {
      const accessAllowed = canAccessEducationModule(access, module);
      return { ...module, accessAllowed, locked: !accessAllowed, lockedReason: accessAllowed ? '' : 'This lesson path requires a matching Wisdo Discord role.' };
    };
    const modules = botSlug
      ? (state.botEducationModulesByBotSlug?.[botSlug] || []).map(annotateModule)
      : Object.fromEntries(Object.entries(state.botEducationModulesByBotSlug || {}).map(([slug, list]) => [slug, (list || []).map(annotateModule)]));
    res.json({ ok: true, access, botSlug: botSlug || null, modules, lessons: state.lessonsById, quizzes: state.quizzesById });
  });

  app.post('/api/wisdo/education/progress', async (req, res) => {
    const userId = currentUserId(req);
    const state = await loadEcosystemState();
    const lessonId = String(req.body?.lessonId || req.body?.id || makeId('lesson'));
    const progress = {
      id: String(req.body?.progressId || lessonId),
      userId,
      lessonId,
      moduleId: String(req.body?.moduleId || ''),
      botId: String(req.body?.botId || req.body?.botSlug || ''),
      status: String(req.body?.status || 'in_progress'),
      progress: Number(req.body?.progress || 0),
      score: req.body?.score === undefined ? null : Number(req.body.score),
      completedAt: req.body?.completedAt || (String(req.body?.status || '') === 'completed' ? new Date().toISOString() : null),
      updatedAt: new Date().toISOString(),
    };
    state.lessonProgressByUserId[userId] ||= {};
    state.lessonProgressByUserId[userId][progress.id] = progress;
    auditAdminAction(state, userId, 'education_progress_updated', 'LessonProgress', progress.id, progress);
    await saveEcosystemState(state);
    res.json({ ok: true, progress });
  });

  app.get('/api/wisdo/academy', async (req, res) => {
    const state = await loadEcosystemState();
    const userId = currentUserId(req);
    res.json(publicAcademyPayload(state, userId, String(req.query?.track || '')));
  });

  app.get('/api/wisdo/academy/tracks', async (req, res) => {
    const state = await loadEcosystemState();
    const userId = currentUserId(req);
    const academy = publicAcademyPayload(state, userId);
    res.json({ ok: true, tracks: academy.tracks, progress: academy.progress, disclaimer: academy.disclaimer });
  });

  app.get('/api/wisdo/academy/track/:trackId', async (req, res) => {
    const state = await loadEcosystemState();
    const userId = currentUserId(req);
    const academy = publicAcademyPayload(state, userId, String(req.params.trackId || ''));
    if (!academy.selectedTrack) return res.status(404).json({ ok: false, error: 'Academy track not found.' });
    res.json({ ok: true, academy, track: academy.selectedTrack, lessons: (academy.selectedTrack.lessonIds || []).map((id) => academy.lessons[id]).filter(Boolean) });
  });

  app.get('/api/wisdo/academy/lesson/:lessonId', async (req, res) => {
    const state = await loadEcosystemState();
    const lesson = state.academyLessonsById?.[String(req.params.lessonId || '')];
    if (!lesson) return res.status(404).json({ ok: false, error: 'Academy lesson not found.' });
    const track = state.academyTracksById?.[lesson.trackId] || null;
    const nextLessonId = track?.lessonIds?.[Math.min((track.lessonIds || []).indexOf(lesson.lessonId) + 1, (track.lessonIds || []).length - 1)] || '';
    res.json({ ok: true, lesson: { ...lesson, nextLessonId }, track, quiz: state.academyQuizzesById?.[lesson.quizId] || null, disclaimer: ACADEMY_DISCLAIMER });
  });

  app.post('/api/wisdo/academy/lesson/:lessonId/start', async (req, res) => {
    const userId = currentUserId(req);
    const state = await loadEcosystemState();
    const lesson = state.academyLessonsById?.[String(req.params.lessonId || '')];
    if (!lesson) return res.status(404).json({ ok: false, error: 'Academy lesson not found.' });
    state.academyProgressByUserId[userId] ||= {};
    const existing = state.academyProgressByUserId[userId][lesson.lessonId] || {};
    state.academyProgressByUserId[userId][lesson.lessonId] = { ...existing, lessonId: lesson.lessonId, trackId: lesson.trackId, status: existing.status === 'completed' ? 'completed' : 'started', startedAt: existing.startedAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    await saveEcosystemState(state);
    res.json({ ok: true, progress: state.academyProgressByUserId[userId][lesson.lessonId], summary: academyProgressSummary(state, userId) });
  });

  app.post('/api/wisdo/academy/lesson/:lessonId/complete', async (req, res) => {
    const userId = currentUserId(req);
    const state = await loadEcosystemState();
    const lesson = state.academyLessonsById?.[String(req.params.lessonId || '')];
    if (!lesson) return res.status(404).json({ ok: false, error: 'Academy lesson not found.' });
    state.academyProgressByUserId[userId] ||= {};
    state.academyProgressByUserId[userId][lesson.lessonId] = { lessonId: lesson.lessonId, trackId: lesson.trackId, status: 'completed', startedAt: state.academyProgressByUserId[userId][lesson.lessonId]?.startedAt || new Date().toISOString(), completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await saveEcosystemState(state);
    res.json({ ok: true, progress: state.academyProgressByUserId[userId][lesson.lessonId], summary: academyProgressSummary(state, userId), requiredCopyEducation: academyRequiredEducationStatus(state, userId, 'copy_basket') });
  });

  app.post('/api/wisdo/academy/quiz/:quizId/submit', async (req, res) => {
    const userId = currentUserId(req);
    const state = await loadEcosystemState();
    const quiz = state.academyQuizzesById?.[String(req.params.quizId || '')];
    if (!quiz) return res.status(404).json({ ok: false, error: 'Academy quiz not found.' });
    const answers = req.body?.answers || {};
    const questions = quiz.questions || [];
    const correct = questions.filter((q) => String(answers[q.id] ?? answers[q.prompt] ?? '').trim().toLowerCase() === String(q.answer || '').trim().toLowerCase()).length;
    const score = questions.length ? Math.round((correct / questions.length) * 100) : Number(req.body?.score || 0);
    const passed = score >= Number(quiz.passingScore || 70);
    const attempt = { attemptId: makeId('quiz'), quizId: quiz.quizId, trackId: quiz.trackId, userId, score, passed, answers, submittedAt: new Date().toISOString() };
    state.academyQuizAttemptsByUserId[userId] ||= {};
    state.academyQuizAttemptsByUserId[userId][quiz.quizId] = attempt;
    await saveEcosystemState(state);
    res.json({ ok: true, attempt, score, passed, requiredCopyEducation: academyRequiredEducationStatus(state, userId, quiz.requiredFor || 'copy_basket') });
  });

  app.get('/api/wisdo/academy/progress', async (req, res) => {
    const state = await loadEcosystemState();
    const userId = String(req.query?.userId || currentUserId(req));
    res.json({ ok: true, userId, progress: academyProgressSummary(state, userId) });
  });

  app.get('/api/wisdo/academy/required-copy-education', async (req, res) => {
    const state = await loadEcosystemState();
    const userId = String(req.query?.userId || currentUserId(req));
    const scope = String(req.query?.scope || 'copy_basket');
    res.json({ ok: true, userId, education: academyRequiredEducationStatus(state, userId, scope) });
  });

  app.use('/api/admin', requireWisdoAdmin);

  app.post('/api/admin/wisdo/education/modules', async (req, res) => {
    const state = await loadEcosystemState();
    const botSlug = slugify(req.body?.botSlug || req.body?.botName || 'general');
    const module = { moduleId: makeId('edumod'), botSlug, title: String(req.body?.title || 'Untitled lesson module'), type: String(req.body?.type || 'text'), required: Boolean(req.body?.required), lessons: Array.isArray(req.body?.lessons) ? req.body.lessons : String(req.body?.lessons || '').split(',').map((x) => x.trim()).filter(Boolean), createdAt: new Date().toISOString() };
    state.botEducationModulesByBotSlug[botSlug] ||= [];
    state.botEducationModulesByBotSlug[botSlug].unshift(module);
    auditAdminAction(state, currentUserId(req), 'education_module_created', 'BotEducationModule', module.moduleId, { botSlug });
    await saveEcosystemState(state);
    res.json({ ok: true, module });
  });

  app.get('/api/wisdo/simulator/scenarios', async (_req, res) => {
    const state = await loadEcosystemState();
    res.json({ ok: true, scenarios: Object.values(state.simulationScenariosById || {}) });
  });

  app.post('/api/wisdo/simulator/run', async (req, res) => {
    const state = await loadEcosystemState();
    const body = req.body || {};
    const risk = calculateWisdoRisk({ ...body, balance: body.balance || 1000, equity: body.equity || 1000, stopDistancePips: body.stopDistancePips || (String(body.symbol).includes('XAU') ? 80 : 35), maxLot: body.maxLot || 0.05 });
    const aggression = Number(body.aggression || 40);
    const volatility = Number(body.volatility || 55);
    const newsProtection = Number(body.newsProtection || 80);
    const skipped = String(body.marketCondition || '').toLowerCase().includes('news') && newsProtection > 50;
    const scenario = {
      scenarioId: makeId('sim'),
      botSlug: String(body.botSlug || 'wisdo'),
      symbol: String(body.symbol || 'XAUUSD'),
      session: String(body.session || 'London'),
      marketCondition: String(body.marketCondition || 'Trend'),
      simulatedEntry: skipped ? null : { direction: aggression >= 50 ? 'buy' : 'wait_for_pullback', lot: risk.lot, reason: 'Settings allowed a trade under simulated volatility and risk caps.' },
      simulatedExit: skipped ? null : { targetR: Number((1 + aggression / 100).toFixed(2)), maxDrawdownPercent: Number((volatility / 25).toFixed(2)) },
      decisionTimeline: [
        'Loaded bot metadata and account risk.',
        `Checked session ${body.session || 'London'} and symbol ${body.symbol || 'XAUUSD'}.`,
        skipped ? 'Skipped trade because news protection blocked high-impact conditions.' : 'Trade passed educational simulator filters.',
        risk.explanation,
      ],
      botBrainExplanation: skipped ? 'The bot would stand down because news protection is stronger than the current opportunity.' : 'The bot would look for confirmation, size down through risk rules, then execute only if spread/slippage stay inside limits.',
      risk,
      seedData: true,
      createdAt: new Date().toISOString(),
    };
    state.simulationScenariosById[scenario.scenarioId] = scenario;
    await saveEcosystemState(state);
    res.json({ ok: true, scenario });
  });

  app.post('/api/wisdo/simulator/explain', (req, res) => {
    res.json({ ok: true, explanation: 'Wisdo explains entries from bot metadata, current simulator conditions, account risk profile, and copied-trade logs. This endpoint is voice-ready and read-only.', input: req.body || {} });
  });

  app.get('/api/wisdo/social/posts', async (_req, res) => {
    const state = await loadEcosystemState();
    res.json({ ok: true, posts: Object.values(state.socialPostsById || {}).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
  });

  app.post('/api/wisdo/social/posts', async (req, res) => {
    const userId = currentUserId(req);
    const state = await loadEcosystemState();
    const post = { postId: makeId('post'), authorUserId: userId, authorName: currentUserName(req), title: String(req.body?.title || 'Wisdo strategy note'), body: String(req.body?.body || ''), type: String(req.body?.type || 'strategy_note'), visibility: String(req.body?.visibility || 'public'), status: 'published', createdAt: new Date().toISOString() };
    state.socialPostsById[post.postId] = post;
    await saveEcosystemState(state);
    res.json({ ok: true, post });
  });

  app.post('/api/wisdo/social/posts/:postId/like', async (req, res) => {
    const userId = currentUserId(req);
    const state = await loadEcosystemState();
    if (!state.socialPostsById?.[req.params.postId]) return res.status(404).json({ ok: false, error: 'Post not found.' });
    state.likesByUserId[userId] ||= [];
    if (!state.likesByUserId[userId].includes(req.params.postId)) state.likesByUserId[userId].push(req.params.postId);
    await saveEcosystemState(state);
    res.json({ ok: true, postId: req.params.postId, liked: true });
  });

  app.get('/api/wisdo/notifications', async (req, res) => {
    const userId = currentUserId(req);
    const state = await loadEcosystemState();
    res.json({ ok: true, notifications: state.notificationsByUserId?.[String(userId)] || [] });
  });

  app.post('/api/wisdo/notifications', async (req, res) => {
    const userId = String(req.body?.userId || currentUserId(req));
    const state = await loadEcosystemState();
    const notification = upsertNotification(state, userId, req.body || {});
    await saveEcosystemState(state);
    res.json({ ok: true, notification });
  });

  app.get('/api/wisdo/voice/intents', (_req, res) => {
    res.json({ ok: true, futureProduct: 'Wisdo Voice', intents: WISDO_VOICE_INTENTS, safety: 'Dangerous actions require confirmation and account permissions.' });
  });

  app.post('/api/wisdo/voice/execute', async (req, res) => {
    const intent = WISDO_VOICE_INTENTS.find((item) => item.intent === String(req.body?.intent || ''));
    if (!intent) return res.status(400).json({ ok: false, error: 'Unknown voice intent.' });
    if (intent.confirmationRequired && req.body?.confirmation !== 'confirmed') return res.status(409).json({ ok: false, confirmationRequired: true, intent });
    res.json({ ok: true, queued: false, intent, message: 'Voice execution foundation is ready. Trading actions remain disabled until explicit command bridge confirmation is supplied.' });
  });

  app.get('/api/wisdo/affiliate/dashboard', async (req, res) => {
    try {
      const userId = currentUserId(req);
      const affiliateId = String(req.query?.affiliateId || '').trim();
      const affiliate = affiliateId ? await affiliateService.getAffiliate(affiliateId) : await affiliateService.getAffiliateByUserId(userId);
      const dashboard = affiliate ? await affiliateService.getAffiliateDashboard(affiliate.affiliateId) : null;
      res.json({ ok: true, dashboard, affiliate: dashboard?.affiliate || null });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.get('/api/wisdo/affiliate/referral-code/:referralCode', async (req, res) => {
    const affiliate = await affiliateService.getAffiliateByReferralCode(req.params.referralCode);
    if (!affiliate) return res.status(404).json({ ok: false, error: 'Referral code not found.' });
    res.json({ ok: true, affiliate: affiliateService.publicAffiliate(affiliate) });
  });

  app.post('/api/wisdo/affiliate/referrals', async (req, res) => {
    try {
      const affiliateKey = String(req.body?.affiliateId || req.body?.referralCode || '').trim();
      if (!affiliateKey) return res.status(400).json({ ok: false, error: 'affiliateId or referralCode is required.' });
      const referral = await affiliateService.createReferral(affiliateKey, {
        ...req.body,
        userId: req.body?.referredUserId || req.body?.userId || '',
        email: req.body?.referredEmail || req.body?.email || '',
        source: 'wisdo_affiliate_api',
      });
      res.json({ ok: true, referral });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.get('/api/wisdo/affiliate/referrals', async (req, res) => {
    try {
      const userId = currentUserId(req);
      const affiliate = await affiliateService.getAffiliateByUserId(userId);
      const referrals = affiliate ? await affiliateService.listAffiliateReferrals(affiliate.affiliateId) : [];
      res.json({ ok: true, affiliate: affiliate ? affiliateService.publicAffiliate(affiliate) : null, referrals });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.get('/api/wisdo/affiliate/commissions', async (req, res) => {
    try {
      const userId = currentUserId(req);
      const affiliate = await affiliateService.getAffiliateByUserId(userId);
      const commissions = affiliate ? await affiliateService.listAffiliateCommissions(affiliate.affiliateId) : [];
      res.json({ ok: true, affiliate: affiliate ? affiliateService.publicAffiliate(affiliate) : null, commissions });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.use('/api/wisdo/admin', requireWisdoAdmin);

  app.get('/api/wisdo/admin/academy', async (req, res) => {
    const state = await loadEcosystemState();
    res.json({
      ok: true,
      tracks: Object.values(state.academyTracksById || {}).sort((a, b) => Number(a.order || 0) - Number(b.order || 0)),
      lessons: state.academyLessonsById || {},
      quizzes: state.academyQuizzesById || {},
      seedNote: 'Starter academy content is seed/admin editable.',
    });
  });

  app.post('/api/wisdo/admin/academy/tracks', async (req, res) => {
    const state = await loadEcosystemState();
    const trackId = slugify(req.body?.trackId || req.body?.title || makeId('track'));
    const track = {
      trackId,
      slug: slugify(req.body?.slug || trackId),
      title: String(req.body?.title || 'Untitled Academy Track'),
      topic: String(req.body?.topic || req.body?.title || 'Academy'),
      level: String(req.body?.level || 'beginner'),
      botSlug: String(req.body?.botSlug || ''),
      requiredBeforeCopy: Boolean(req.body?.requiredBeforeCopy),
      requiredBeforeBotActivation: Boolean(req.body?.requiredBeforeBotActivation),
      lessonIds: Array.isArray(req.body?.lessonIds) ? req.body.lessonIds : [],
      order: Number(req.body?.order || Object.keys(state.academyTracksById || {}).length + 1),
      status: String(req.body?.status || 'draft'),
      seedNote: 'Admin-created academy track.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.academyTracksById[trackId] = track;
    auditAdminAction(state, currentUserId(req), 'academy_track_created', 'AcademyTrack', trackId, track);
    await saveEcosystemState(state);
    res.json({ ok: true, track });
  });

  app.post('/api/wisdo/admin/academy/lessons', async (req, res) => {
    const state = await loadEcosystemState();
    const trackId = String(req.body?.trackId || 'trading-basics');
    const lessonId = slugify(req.body?.lessonId || `${trackId}-${req.body?.title || makeId('lesson')}`);
    const lesson = {
      lessonId,
      trackId,
      botSlug: String(req.body?.botSlug || ''),
      title: String(req.body?.title || 'Untitled Academy Lesson'),
      level: String(req.body?.level || 'beginner'),
      estimatedMinutes: Number(req.body?.estimatedMinutes || 6),
      learningGoals: Array.isArray(req.body?.learningGoals) ? req.body.learningGoals : String(req.body?.learningGoals || '').split('\n').map((x) => x.trim()).filter(Boolean),
      explanation: String(req.body?.explanation || 'Admin lesson draft.'),
      keyTerms: Array.isArray(req.body?.keyTerms) ? req.body.keyTerms : String(req.body?.keyTerms || '').split(',').map((x) => x.trim()).filter(Boolean),
      example: String(req.body?.example || ''),
      commonMistakes: Array.isArray(req.body?.commonMistakes) ? req.body.commonMistakes : String(req.body?.commonMistakes || '').split('\n').map((x) => x.trim()).filter(Boolean),
      wisdoTip: String(req.body?.wisdoTip || ''),
      riskWarning: String(req.body?.riskWarning || ACADEMY_DISCLAIMER),
      relatedSimulator: String(req.body?.relatedSimulator || '/member/simulator'),
      relatedBot: String(req.body?.relatedBot || req.body?.botSlug || ''),
      status: String(req.body?.status || 'draft'),
      seedNote: 'Admin-created academy lesson.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.academyLessonsById[lessonId] = lesson;
    state.academyTracksById[trackId] ||= { trackId, slug: slugify(trackId), title: trackId, topic: 'Academy', level: lesson.level, lessonIds: [], status: 'draft', createdAt: new Date().toISOString() };
    if (!state.academyTracksById[trackId].lessonIds.includes(lessonId)) state.academyTracksById[trackId].lessonIds.push(lessonId);
    auditAdminAction(state, currentUserId(req), 'academy_lesson_created', 'AcademyLesson', lessonId, { trackId });
    await saveEcosystemState(state);
    res.json({ ok: true, lesson, track: state.academyTracksById[trackId] });
  });

  app.patch('/api/wisdo/admin/academy/lessons/:lessonId', async (req, res) => {
    const state = await loadEcosystemState();
    const lessonId = String(req.params.lessonId || '');
    const existing = state.academyLessonsById?.[lessonId];
    if (!existing) return res.status(404).json({ ok: false, error: 'Academy lesson not found.' });
    state.academyLessonsById[lessonId] = { ...existing, ...req.body, lessonId, updatedAt: new Date().toISOString() };
    auditAdminAction(state, currentUserId(req), 'academy_lesson_updated', 'AcademyLesson', lessonId, { patch: req.body || {} });
    await saveEcosystemState(state);
    res.json({ ok: true, lesson: state.academyLessonsById[lessonId] });
  });

  app.get('/api/wisdo/admin/signal-grid', async (_req, res) => {
    const grid = await signalGridService.getGridState({});
    const state = await loadEcosystemState();
    res.json({
      ok: true,
      settings: grid.settings,
      cells: grid.allCells,
      channels: state.signalGridChannelsById || {},
      interactionLogs: Object.values(state.signalGridInteractionLogsById || {}).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 100),
      subscriptions: Object.values(state.copyBotSubscriptionsById || {}),
    });
  });

  app.post('/api/wisdo/admin/signal-grid/setup', async (req, res) => {
    try {
      const channelId = String(req.body?.channelId || process.env.SIGNAL_CHANNEL_ID || process.env.TRADE_SIGNAL_CHANNEL_ID || '').trim();
      const channel = await signalGridService.configureChannel({ guildId: req.body?.guildId || config.guildId || '', channelId, settings: req.body?.settings || {}, actorUserId: req.body?.actorUserId || currentUserId(req) });
      let pinned = null;
      if (discordSignalGridService && channelId) {
        pinned = await discordSignalGridService.ensurePinnedGridMessage(channel.guildId, channel.channelId).catch((error) => ({ error: error.message }));
      }
      res.json({ ok: true, channel, pinnedMessageId: pinned?.id || channel.pinnedMessageId || '', pinned });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/wisdo/admin/signal-grid/refresh', async (req, res) => {
    const expired = req.body?.clearExpired ? await signalGridService.expireOldSignals() : { expired: 0 };
    const state = await loadEcosystemState();
    const channels = Object.values(state.signalGridChannelsById || {});
    const updates = [];
    for (const channel of channels) {
      if (discordSignalGridService) updates.push(await discordSignalGridService.updatePinnedGridMessage(channel.channelId).catch((error) => ({ ok: false, channelId: channel.channelId, error: error.message })));
    }
    res.json({ ok: true, expired, updates });
  });

  app.post('/api/wisdo/admin/signal-grid/repair', async (req, res) => {
    const channelId = String(req.body?.channelId || process.env.SIGNAL_CHANNEL_ID || process.env.TRADE_SIGNAL_CHANNEL_ID || '').trim();
    if (!channelId) return res.status(400).json({ ok: false, error: 'channelId is required.' });
    const repaired = await discordSignalGridService.repairMissingPinnedMessage(channelId).catch((error) => ({ ok: false, error: error.message }));
    res.status(repaired.ok ? 200 : 400).json(repaired);
  });

  app.patch('/api/wisdo/admin/signal-grid/settings', async (req, res) => {
    const allowedModes = ['balance', 'equity', 'allocated', 'basket_risk'];
    const patch = { ...(req.body || {}) };
    if (patch.percentMode && !allowedModes.includes(String(patch.percentMode))) return res.status(400).json({ ok: false, error: 'Invalid percentMode.' });
    let settings;
    await wisdoPhase1Repository.updateState((state) => {
      state.signalGridSettings = { ...signalGridService.settings(state), ...patch, updatedAt: new Date().toISOString() };
      settings = state.signalGridSettings;
      wisdoPhase1Repository.addAuditToState(state, { adminId: currentUserId(req), action: 'signal_grid.settings_changed', targetType: 'SignalGridSettings', targetId: 'global', data: patch });
      return state;
    });
    res.json({ ok: true, settings });
  });

  app.get('/api/wisdo/admin/role-sync', async (_req, res) => {
    const statuses = await roleSyncService.listRoleSyncStatuses();
    res.json({ ok: true, statuses });
  });

  app.get('/api/wisdo/admin/role-map', async (_req, res) => {
    res.json({ ok: true, active: DISCORD_ROLE_MAP, future: FUTURE_DISCORD_ROLE_MAP });
  });

  app.post('/api/wisdo/admin/users/:userId/roles/refresh', async (req, res) => {
    try {
      const actorUserId = currentUserId(req);
      const targetUserId = String(req.params.userId || '').trim();
      const discordUserId = String(req.body?.discordUserId || targetUserId).trim();
      const roleSync = await roleSyncService.syncUserRolesFromDiscord(targetUserId, discordUserId, { actorUserId, manual: true });
      res.json({ ok: true, roleSync, access: roleSyncService.publicAccess(roleSync) });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/wisdo/admin/users/:userId/roles/override', async (req, res) => {
    try {
      const actorUserId = currentUserId(req);
      const targetUserId = String(req.params.userId || '').trim();
      const wisdoRoles = Array.isArray(req.body?.wisdoRoles) ? req.body.wisdoRoles.map(String) : [];
      const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions.map(String) : [];
      const reason = String(req.body?.reason || '').slice(0, 500);
      let status;
      await wisdoPhase1Repository.updateState((state) => {
        state.roleOverridesByUserId ||= {};
        state.roleSyncByUserId ||= {};
        const previous = state.roleOverridesByUserId[targetUserId] || {};
        state.roleOverridesByUserId[targetUserId] = {
          userId: targetUserId,
          wisdoRoles,
          permissions,
          reason,
          updatedByUserId: actorUserId,
          updatedAt: new Date().toISOString(),
          createdAt: previous.createdAt || new Date().toISOString(),
        };
        wisdoPhase1Repository.addAuditToState(state, {
          adminId: actorUserId,
          action: 'admin_role_override.changed',
          targetType: 'UserRoleOverride',
          targetId: targetUserId,
          data: { previous, next: state.roleOverridesByUserId[targetUserId], reason },
        });
        return state;
      });
      status = await roleSyncService.refreshDiscordRoleCache(targetUserId, { actorUserId, manual: true });
      res.json({ ok: true, override: (await wisdoPhase1Repository.loadState()).roleOverridesByUserId?.[targetUserId], roleSync: status, access: roleSyncService.publicAccess(status) });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.get('/api/wisdo/admin/affiliates', async (_req, res) => {
    const state = await loadEcosystemState();
    res.json({
      ok: true,
      settings: affiliateService.settings(state),
      affiliates: Object.values(state.affiliatesById || {}).map((affiliate) => affiliateService.publicAffiliate(affiliate)),
      referrals: Object.values(state.affiliateReferralsById || {}),
      commissions: Object.values(state.affiliateCommissionsById || {}),
      payouts: Object.values(state.affiliatePayoutsById || {}),
      campaigns: Object.values(state.affiliateCampaignsById || {}),
    });
  });

  app.post('/api/wisdo/admin/affiliate-settings', async (req, res) => {
    try {
      const settings = await affiliateService.updateSettings(currentUserId(req), req.body || {});
      res.json({ ok: true, settings });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/wisdo/admin/affiliates', async (req, res) => {
    try {
      const affiliate = await affiliateService.createAffiliate(currentUserId(req), req.body || {});
      res.json({ ok: true, affiliate: affiliateService.publicAffiliate(affiliate) });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.patch('/api/wisdo/admin/affiliates/:affiliateId', async (req, res) => {
    try {
      const affiliate = await affiliateService.updateAffiliate(currentUserId(req), req.params.affiliateId, req.body || {});
      res.json({ ok: true, affiliate: affiliateService.publicAffiliate(affiliate) });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/wisdo/admin/affiliate-campaigns', async (req, res) => {
    try {
      const campaign = await affiliateService.createCampaign(currentUserId(req), req.body || {});
      res.json({ ok: true, campaign });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.patch('/api/wisdo/admin/affiliate-campaigns/:campaignId', async (req, res) => {
    try {
      const campaign = await affiliateService.updateCampaign(currentUserId(req), req.params.campaignId, req.body || {});
      res.json({ ok: true, campaign });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/wisdo/admin/affiliate-referrals/:referralId/signed-up', async (req, res) => {
    try {
      const referral = await affiliateService.markReferralSignedUp(req.params.referralId, req.body?.userId || req.body?.referredUserId || currentUserId(req));
      res.json({ ok: true, referral });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/wisdo/admin/affiliate-referrals/:referralId/activation-payment', async (req, res) => {
    try {
      const result = await affiliateService.recordActivationPayment(
        req.params.referralId,
        req.body?.paymentRef || req.body?.paymentReference || '',
        req.body?.amount,
        req.body?.currency || 'usd',
      );
      res.json({ ok: true, ...result });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/wisdo/admin/affiliate-referrals/:referralId/calculate-commission', async (req, res) => {
    try {
      const commission = await affiliateService.calculateActivationCommission(req.params.referralId);
      res.json({ ok: true, commission });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/wisdo/admin/affiliate-commissions/:commissionId/approve', async (req, res) => {
    try {
      const commission = await affiliateService.approveCommission(currentUserId(req), req.params.commissionId);
      res.json({ ok: true, commission });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/wisdo/admin/affiliate-commissions/:commissionId/hold', async (req, res) => {
    try {
      const commission = await affiliateService.holdCommission(currentUserId(req), req.params.commissionId, req.body?.reason || '');
      res.json({ ok: true, commission });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/wisdo/admin/affiliate-commissions/:commissionId/payable', async (req, res) => {
    try {
      const commission = await affiliateService.markCommissionPayable(currentUserId(req), req.params.commissionId);
      res.json({ ok: true, commission });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/wisdo/admin/affiliate-payouts', async (req, res) => {
    try {
      const payout = await affiliateService.createAffiliatePayout(
        currentUserId(req),
        String(req.body?.affiliateId || ''),
        Array.isArray(req.body?.commissionIds) ? req.body.commissionIds : String(req.body?.commissionIds || '').split(',').map((id) => id.trim()).filter(Boolean),
      );
      res.json({ ok: true, payout });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/wisdo/admin/affiliate-payouts/:payoutId/paid', async (req, res) => {
    try {
      const payout = await affiliateService.markPayoutPaid(currentUserId(req), req.params.payoutId, req.body?.payoutReference || '');
      res.json({ ok: true, payout });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.get('/api/admin/wisdo/overview', async (_req, res) => {
    const state = await loadEcosystemState();
    res.json({ ok: true, models: WISDO_MODEL_REGISTRY, counts: Object.fromEntries(Object.entries(ensureWisdoStateCollections(state)).filter(([, value]) => value && typeof value === 'object').map(([key, value]) => [key, Array.isArray(value) ? value.length : Object.keys(value).length])) });
  });

  app.post('/api/admin/wisdo/bots', async (req, res) => {
    const state = await loadEcosystemState();
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ ok: false, error: 'Bot name is required.' });
    const slug = slugify(name);
    const version = {
      versionId: makeId('botver'),
      botSlug: slug,
      name,
      version: String(req.body?.version || '1.0.0'),
      creator: String(req.body?.creator || 'Wisdo'),
      priceUsd: Number(req.body?.priceUsd || 0),
      status: String(req.body?.status || 'draft'),
      accessLevel: String(req.body?.accessLevel || 'paid'),
      category: String(req.body?.category || 'Strategy'),
      allowedSymbols: String(req.body?.allowedSymbols || '').split(',').map((x) => x.trim()).filter(Boolean),
      minimumAccountSize: Number(req.body?.minimumAccountSize || 0),
      maxRiskWarning: String(req.body?.maxRiskWarning || ''),
      releaseNotes: String(req.body?.releaseNotes || ''),
      forceUpdateRequired: Boolean(req.body?.forceUpdateRequired),
      educationRequiredBeforeActivation: Boolean(req.body?.educationRequiredBeforeActivation),
      securityScan: { status: 'pending_hook', note: 'File validation hook placeholder. No uploaded executable is trusted until scanner integration passes.' },
      createdAt: new Date().toISOString(),
    };
    state.botVersionsBySlug[slug] ||= [];
    state.botVersionsBySlug[slug].unshift(version);
    if (req.body?.fileName || req.body?.fileSha256) {
      const file = { fileId: makeId('botfile'), botSlug: slug, versionId: version.versionId, fileName: String(req.body?.fileName || ''), fileSha256: String(req.body?.fileSha256 || ''), status: 'pending_scan', createdAt: new Date().toISOString() };
      state.botFilesById[file.fileId] = file;
      version.fileId = file.fileId;
    }
    auditAdminAction(state, currentUserId(req), 'bot_version_added', 'BotVersion', version.versionId, { slug });
    await saveEcosystemState(state);
    res.json({ ok: true, botSlug: slug, version, versions: state.botVersionsBySlug[slug] });
  });

  app.post('/api/admin/wisdo/bots/:slug/rollback', async (req, res) => {
    const state = await loadEcosystemState();
    const versions = state.botVersionsBySlug?.[req.params.slug] || [];
    const target = versions.find((v) => String(v.versionId) === String(req.body?.versionId)) || versions[1];
    if (!target) return res.status(404).json({ ok: false, error: 'Rollback target not found.' });
    const rollback = { ...target, versionId: makeId('botver'), status: 'testing', rollbackOfVersionId: target.versionId, releaseNotes: `Rollback candidate from ${target.version}`, createdAt: new Date().toISOString() };
    state.botVersionsBySlug[req.params.slug].unshift(rollback);
    auditAdminAction(state, currentUserId(req), 'bot_rollback', 'BotVersion', rollback.versionId, { slug: req.params.slug, targetVersionId: target.versionId });
    await saveEcosystemState(state);
    res.json({ ok: true, rollback });
  });

  app.get('/api/auth/health', (req, res) => res.json(getAuthHealth(req, config)));
  app.get('/api/me', (req, res) => {
    const rawUser = getCurrentUser(req);
    const identity = getIdentity(req);
    res.json({ ok: true, user: { ...rawUser, ...identity }, state: rawUser ? 'connected_discord_user' : 'public_visitor' });
  });
  app.get('/login', (req, res) => res.send(htmlShell('Login', loginHealthPanel(req, config, String(req.query?.error || '')), 'home')));
  app.get('/auth/debug', (req, res) => res.send(htmlShell('OAuth Debug', oauthDebugPage(req, config), 'settings')));
  app.get('/setup/oauth', (req, res) => res.send(htmlShell('OAuth Setup', oauthSetupPage(req, config), 'settings')));
  app.get('/logout', (req, res) => { clearCookie(res, 'cc_user'); clearCookie(res, 'oauth_state'); res.redirect('/login'); });
  app.post('/api/login', (req, res) => res.json({ ok: false, error: 'Use /auth/discord for Discord OAuth login.' }));
  app.post('/api/logout', (req, res) => { clearCookie(res, 'cc_user'); clearCookie(res, 'oauth_state'); res.json({ ok: true }); });
  app.get('/auth/discord', (req, res) => {
    const health = getAuthHealth(req, config);
    if (!health.loginReady) return res.redirect('/login?error=missing_oauth_config');
    const state = crypto.randomBytes(16).toString('hex');
    setCookie(res, 'oauth_state', state, { maxAge: 600 });
    const clientId = process.env.CLIENT_ID || config?.discord?.clientId || config?.clientId || '';
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: health.expectedRedirectUri, response_type: 'code', scope: 'identify', state });
    res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
  });
  app.get('/auth/discord/callback', async (req, res) => {
    try {
      const health = getAuthHealth(req, config);
      if (!health.loginReady) return res.redirect('/login?error=missing_oauth_config');
      const code = String(req.query?.code || '');
      const state = String(req.query?.state || '');
      const cookies = parseCookies(req);
      if (!code) return res.redirect('/login?error=missing_discord_code');
      if (!state || !cookies.oauth_state || state !== cookies.oauth_state) return res.redirect('/login?error=invalid_oauth_state');
      const clientId = process.env.CLIENT_ID || config?.discord?.clientId || config?.clientId || '';
      const clientSecret = process.env.CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET || '';
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: health.expectedRedirectUri }),
      });
      const tokenJson = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !tokenJson.access_token) {
        logger.warn('Discord OAuth token exchange failed', { status: tokenRes.status, error: tokenJson.error, description: tokenJson.error_description });
        return res.redirect(`/login?error=${encodeURIComponent(tokenJson.error_description || tokenJson.error || 'discord_token_error')}`);
      }
      const userRes = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${tokenJson.access_token}` } });
      const discordUser = await userRes.json().catch(() => ({}));
      if (!userRes.ok || !discordUser.id) return res.redirect('/login?error=discord_user_fetch_failed');
      setCookie(res, 'cc_user', encodeSession(discordUser), { maxAge: 60 * 60 * 24 * 30 });
      clearCookie(res, 'oauth_state');
      res.redirect('/auth/success?provider=discord');
    } catch (error) {
      logger.error('Discord OAuth callback failed', { message: error.message, stack: error.stack });
      res.redirect(`/login?error=${encodeURIComponent(error.message || 'oauth_callback_failed')}`);
    }
  });
  app.patch('/api/profile', (req, res) => res.json({ ok: true, profile: req.body || {} }));
  app.get('/api/feed', (req, res) => res.json({ ok: true, posts: [] }));
  app.post('/api/feed', (req, res) => res.json({ ok: true, post: { id: makeId('post'), ...(req.body || {}) } }));
  app.post('/api/feed/:id/like', (req, res) => res.json({ ok: true, id: req.params.id, action: 'like' }));
  app.post('/api/feed/:id/save', (req, res) => res.json({ ok: true, id: req.params.id, action: 'save' }));
  app.post('/api/feed/:id/share', (req, res) => res.json({ ok: true, id: req.params.id, action: 'share' }));
  app.post('/api/feed/:id/comment', (req, res) => res.json({ ok: true, id: req.params.id, comment: req.body || {} }));
  app.post('/api/wisdo/command', async (req, res) => {
    const requester = await getRequestAccess(req);
    const bodyUserId = String(req.body?.userId || '').trim();
    if (bodyUserId && bodyUserId !== requester.identity.userId && !canAccessAdmin(requester.access)) {
      await auditDenied(requester.identity.userId, 'mt4_command.denied_user_spoof', 'User', bodyUserId, { path: req.path, access: requester.access });
      return res.status(403).json({ ok: false, error: 'You cannot queue MT4 commands for another user.', access: requester.access });
    }
    if (!hasPermission(requester.access, 'portal.member') && !hasPermission(requester.access, 'accounts.connect')) {
      await auditDenied(requester.identity.userId, 'mt4_command.denied_role_gate', 'Route', req.path, { access: requester.access });
      return res.status(403).json({ ok: false, error: 'Member access is required before MT4 commands can be queued.', access: requester.access });
    }
    const userId = bodyUserId || requester.identity.userId;
    const accountId = String(req.body?.accountId || '').trim();
    if (!userId) return res.status(400).json({ ok: false, error: 'Missing userId' });
    const rawText = String(req.body?.rawCommand || req.body?.text || '').trim();
    const action = String(req.body?.action || '').trim();
    const mapped = legacyWisdoCommandIntent(action, rawText);
    const payload = {
      ...mapped.payload,
      ...(req.body || {}),
      rawText,
      action,
      parsedIntent: mapped.command,
      accountId: accountId || undefined,
      globals: mapped.payload?.globals || req.body?.globals,
    };
    let command;
    try {
      command = accountId
        ? await mt4CommandService.queueCommandForAccount(userId, accountId, mapped.command, payload)
        : await mt4CommandService.queueCommand(userId, mapped.command, payload);
    } catch (error) {
      return res.status(400).json({ ok: false, error: error.message, validation: error.validation || null, mapped });
    }
    const state = await loadEcosystemState();
    auditAdminAction(state, userId, command.requiresConfirmation || command.confirmationRequired ? 'dangerous_mt4_command_requested' : 'mt4_command_created', 'MT4Command', command.id, { command: mapped.command, accountId });
    await saveEcosystemState(state);
    res.json({ ok: true, command, mapped });
  });
  app.get('/api/wisdo/commands', async (req, res) => {
    const requester = await getRequestAccess(req);
    const queryUserId = String(req.query?.userId || '').trim();
    if (queryUserId && queryUserId !== requester.identity.userId && !canAccessAdmin(requester.access)) {
      await auditDenied(requester.identity.userId, 'mt4_commands_read.denied_user_spoof', 'User', queryUserId, { path: req.path, access: requester.access });
      return res.status(403).json({ ok: false, error: 'You cannot read MT4 commands for another user.', access: requester.access });
    }
    const userId = queryUserId || requester.identity.userId;
    const accountId = String(req.query?.accountId || '').trim();
    if (!userId) return res.status(400).json({ ok: false, error: 'Missing userId' });
    const status = await mt4CommandService.getQueueStatus(userId, accountId || null);
    res.json({ ok: true, status, commands: status.recent || [] });
  });
  app.post('/api/wisdo/protect', async (req, res) => {
    const requester = await getRequestAccess(req);
    const bodyUserId = String(req.body?.userId || '').trim();
    if (bodyUserId && bodyUserId !== requester.identity.userId && !canAccessAdmin(requester.access)) {
      await auditDenied(requester.identity.userId, 'mt4_protect.denied_user_spoof', 'User', bodyUserId, { path: req.path, access: requester.access });
      return res.status(403).json({ ok: false, error: 'You cannot queue protection commands for another user.', access: requester.access });
    }
    const command = await mt4CommandService.queueCommand(bodyUserId || requester.identity.userId, 'PROTECT_ACCOUNT', req.body || {});
    res.json({ ok: true, command });
  });
  app.post('/api/wisdo/harvest', async (req, res) => {
    const command = await mt4CommandService.queueCommand(String(req.body?.userId || ''), 'HARVEST_PROFIT', req.body || {});
    res.json({ ok: true, command });
  });
  app.post('/api/reviews/upload', (req, res) => res.json({ ok: true, review: { reviewId: makeId('review'), status: 'uploaded', ...(req.body || {}) } }));
  app.post('/api/reviews/telegram-webhook', (req, res) => res.json({ ok: true, received: true }));
  app.get('/api/reviews', (req, res) => res.json({ ok: true, reviews: [] }));
  app.patch('/api/reviews/:id', (req, res) => res.json({ ok: true, reviewId: req.params.id, patch: req.body || {} }));
  app.post('/api/reviews/:id/timestamp-note', (req, res) => res.json({ ok: true, reviewId: req.params.id, note: req.body || {} }));
  app.post('/api/reviews/:id/send-response', (req, res) => res.json({ ok: true, reviewId: req.params.id, status: 'sent' }));
  app.get('/api/admin/dashboard', (req, res) => res.json({ ok: true, modules: ['users','accounts','copy approvals','bot store','orders','reviews','desks','signals','commands','risk alerts'] }));
  app.get('/api/admin/users', (req, res) => res.json({ ok: true, users: [] }));
  app.get('/api/admin/accounts', async (req, res) => res.json({ ok: true, mt4: await mt4SyncService.repository.loadMt4State() }));
  app.get('/api/admin/reviews', (req, res) => res.json({ ok: true, reviews: [] }));
  app.patch('/api/admin/reviews/:id/assign', (req, res) => res.json({ ok: true, reviewId: req.params.id, assigned: req.body || {} }));
  app.patch('/api/admin/copy-hub/:accountId/approve', (req, res) => res.json({ ok: true, accountId: req.params.accountId, approved: true }));
  app.patch('/api/admin/copy-hub/:accountId/remove', (req, res) => res.json({ ok: true, accountId: req.params.accountId, removed: true }));


  app.get('/api/member/summary', async (req, res) => {
    const mt4 = await mt4SyncService.repository.loadMt4State();
    const latest = Object.values(mt4.latestSnapshots || {}).sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt))[0] || null;
    const connections = Object.values(mt4.connections || {});
    res.json({ ok: true, connectionCount: connections.length, latestSnapshot: latest, upgrades: SPECIAL_UPGRADES.length });
  });

  app.get('/api/me/accounts', async (req, res) => {
    const userId = currentUserId(req);
    const mt4 = await mt4SyncService.repository.getMt4State();
    const accounts = mt4SyncService.repository.getAccessibleMt4Accounts
      ? await mt4SyncService.repository.getAccessibleMt4Accounts(userId)
      : mt4SyncService.repository.getMt4Accounts
        ? await mt4SyncService.repository.getMt4Accounts(userId)
        : getMyConnectedAccounts(mt4, userId);
    const pendingPairings = getMyPendingPairings(mt4, userId);
    const primary = accounts.find((a) => a.isPrimary) || accounts[0] || null;
    res.json({ ok: true, user: { discordId: userId, username: currentUserName(req) }, primaryAccountId: primary?.accountId || null, accounts, pendingPairings });
  });

  app.get('/api/me/pairing-codes', async (req, res) => {
    const userId = currentUserId(req);
    const mt4 = await mt4SyncService.repository.loadMt4State();
    res.json({ ok: true, userId, pairingCodes: getMyPendingPairings(mt4, userId) });
  });

  app.post('/api/me/pairing-code', async (req, res) => {
    try {
      const userId = currentUserId(req);
      const channelId = String(req.body?.channelId || req.query.channelId || '').trim();
      const pairing = await mt4SyncService.issuePairingCode({
        discordUserId: userId,
        channelId,
        requestedByUserId: userId,
        accountNickname: req.body?.accountNickname || req.body?.nickname || '',
        accountRole: req.body?.accountRole || req.body?.role || 'private',
        copyPermission: req.body?.copyPermission || 'private',
        forceNew: true,
      });
      if ((req.headers.accept || '').includes('text/html')) {
        return res.redirect(`/member/link-account?userId=${encodeURIComponent(userId)}`);
      }
      return res.json({ ok: true, pairing });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/me/accounts/:accountId/set-primary', async (req, res) => {
    const userId = currentUserId(req);
    const selected = mt4SyncService.repository.setPrimaryMt4Account
      ? await mt4SyncService.repository.setPrimaryMt4Account(userId, req.params.accountId)
      : null;
    if (!selected) return res.status(404).json({ ok: false, error: 'Account not found for this user.' });
    res.json({ ok: true, userId, primaryAccountId: req.params.accountId, account: selected });
  });

  app.post('/api/me/accounts/:accountId/reconnect', async (req, res) => {
    const userId = currentUserId(req);
    const pairing = await mt4SyncService.issuePairingCode({ discordUserId: userId, channelId: '', requestedByUserId: userId });
    res.json({ ok: true, userId, accountId: req.params.accountId, pairing });
  });

  async function disconnectMemberAccount(req, res) {
    const userId = currentUserId(req);
    const removed = mt4SyncService.repository.removeMt4Account ? await mt4SyncService.repository.removeMt4Account(userId, req.params.accountId) : null;
    if (!removed) return res.status(404).json({ ok: false, error: 'Account not found for this member.' });
    res.json({ ok: true, accountId: req.params.accountId, status: 'disconnected', removed });
  }

  app.post('/api/me/accounts/:accountId/disconnect', disconnectMemberAccount);
  app.delete('/api/me/accounts/:accountId', disconnectMemberAccount);

  app.patch('/api/me/accounts/:accountId/settings', async (req, res) => {
    const userId = currentUserId(req);
    const updated = mt4SyncService.repository.updateMt4AccountSettings
      ? await mt4SyncService.repository.updateMt4AccountSettings(userId, req.params.accountId, req.body || {})
      : null;
    if (!updated) return res.status(404).json({ ok: false, error: 'Account not found for this user.' });
    res.json({ ok: true, account: updated });
  });


  app.patch('/api/me/accounts/:accountId/copy-risk', async (req, res) => {
    const userId = currentUserId(req);
    const copyRisk = normalizeRiskBody(req.body || {});
    const updated = mt4SyncService.repository.updateMt4AccountCopyRisk
      ? await mt4SyncService.repository.updateMt4AccountCopyRisk(userId, req.params.accountId, copyRisk)
      : await mt4SyncService.repository.updateMt4AccountSettings(userId, req.params.accountId, { copyRisk });
    if (!updated) return res.status(404).json({ ok: false, error: 'Account not found for this user.' });
    res.json({ ok: true, account: updated, copyRisk: updated.copyRisk });
  });



  app.get('/api/me/account-shares', async (req, res) => {
    const userId = currentUserId(req);
    const shares = mt4SyncService.repository.getAccountSharesForUser ? await mt4SyncService.repository.getAccountSharesForUser(userId) : [];
    res.json({ ok: true, shares });
  });

  app.post('/api/me/account-shares', async (req, res) => {
    const userId = currentUserId(req);
    const share = mt4SyncService.repository.createAccountShare
      ? await mt4SyncService.repository.createAccountShare({ ownerUserId: userId, targetUserId: req.body?.targetUserId, accountId: req.body?.accountId, permission: req.body?.permission || 'view_only' })
      : null;
    if (!share) return res.status(400).json({ ok: false, error: 'Could not create reporter share. Confirm the account belongs to this desk and target user ID is correct.' });
    res.json({ ok: true, share });
  });

  app.delete('/api/me/account-shares/:shareId', async (req, res) => {
    const userId = currentUserId(req);
    const removed = mt4SyncService.repository.deleteAccountShare ? await mt4SyncService.repository.deleteAccountShare(userId, req.params.shareId) : null;
    if (!removed) return res.status(404).json({ ok: false, error: 'Share not found for this desk owner.' });
    res.json({ ok: true, removed });
  });

  app.get('/api/me/discoverable-reporters', async (req, res) => {
    const userId = currentUserId(req);
    const accounts = mt4SyncService.repository.getDiscoverableMt4Accounts ? await mt4SyncService.repository.getDiscoverableMt4Accounts(userId) : [];
    res.json({ ok: true, accounts });
  });

  app.get('/api/me/access-requests', async (req, res) => {
    const userId = currentUserId(req);
    const requests = mt4SyncService.repository.getAccountAccessRequestsForUser ? await mt4SyncService.repository.getAccountAccessRequestsForUser(userId) : [];
    res.json({ ok: true, requests });
  });

  app.post('/api/me/access-requests', async (req, res) => {
    const userId = currentUserId(req);
    const { access } = await getRequestAccess(req);
    if (!canRequestCopy(access)) {
      await auditDenied(userId, 'account_access_request.denied', 'Route', req.path, { required: 'copy.request', access });
      return res.status(403).json({ ok: false, error: 'Culture member or higher role is required to request copy access.', access });
    }
    const request = mt4SyncService.repository.createAccountAccessRequest
      ? await mt4SyncService.repository.createAccountAccessRequest({ requesterUserId: userId, ownerUserId: req.body?.ownerUserId, accountId: req.body?.accountId, permission: req.body?.permission || 'copy_allowed', note: req.body?.note || '' })
      : null;
    if (!request) return res.status(400).json({ ok: false, error: 'Could not request access. The reporter must be active/discoverable and owned by the selected Discord user.' });
    res.json({ ok: true, request });
  });

  app.post('/api/me/access-requests/:requestId/approve', async (req, res) => {
    const userId = currentUserId(req);
    const result = mt4SyncService.repository.approveAccountAccessRequest ? await mt4SyncService.repository.approveAccountAccessRequest(userId, req.params.requestId) : null;
    if (!result) return res.status(404).json({ ok: false, error: 'Request not found or you are not the reporter owner.' });
    res.json({ ok: true, ...result });
  });

  app.post('/api/me/access-requests/:requestId/reject', async (req, res) => {
    const userId = currentUserId(req);
    const request = mt4SyncService.repository.rejectAccountAccessRequest ? await mt4SyncService.repository.rejectAccountAccessRequest(userId, req.params.requestId) : null;
    if (!request) return res.status(404).json({ ok: false, error: 'Request not found or you are not the reporter owner.' });
    res.json({ ok: true, request });
  });

  app.get('/api/me/broker-link-requests', async (req, res) => {
    const userId = currentUserId(req);
    const requests = mt4SyncService.repository.getBrokerLinkRequestsForUser ? await mt4SyncService.repository.getBrokerLinkRequestsForUser(userId) : [];
    res.json({ ok: true, requests });
  });

  app.post('/api/me/broker-link-requests', async (req, res) => {
    const userId = currentUserId(req);
    const blocked = ['password', 'masterPassword', 'tradingPassword', 'investorPassword'].some((key) => String(req.body?.[key] || '').trim());
    if (blocked) return res.status(400).json({ ok: false, error: 'Do not send broker passwords to the member portal. Stage the account by login/server, then verify through Reporter or VPS setup.' });
    const desiredRole = String(req.body?.desiredRole || req.body?.accountRole || 'private').toLowerCase();
    const pairing = await mt4SyncService.issuePairingCode({
      discordUserId: userId,
      channelId: String(req.body?.channelId || ''),
      requestedByUserId: userId,
      accountNickname: req.body?.nickname || req.body?.brokerLogin || req.body?.botName || 'Broker Link',
      accountRole: desiredRole,
      copyPermission: desiredRole === 'leader' ? 'signal_only' : desiredRole === 'follower' ? 'copy_allowed' : desiredRole === 'both' ? 'copy_allowed' : 'private',
      forceNew: true,
    });
    const request = mt4SyncService.repository.createBrokerLinkRequest
      ? await mt4SyncService.repository.createBrokerLinkRequest(userId, { ...(req.body || {}), pairingCode: pairing.pairingCode })
      : null;
    res.json({ ok: true, pairing, request });
  });

  app.get('/api/me/copy-routes', async (req, res) => {
    const userId = currentUserId(req);
    const routes = mt4SyncService.repository.getCopyRoutesForUser ? await mt4SyncService.repository.getCopyRoutesForUser(userId) : [];
    res.json({ ok: true, routes });
  });


  app.delete('/api/me/broker-link-requests/:requestId', async (req, res) => {
    const userId = currentUserId(req);
    const cancelled = mt4SyncService.repository.cancelBrokerLinkRequest ? await mt4SyncService.repository.cancelBrokerLinkRequest(userId, req.params.requestId) : null;
    if (!cancelled) return res.status(404).json({ ok: false, error: 'Broker link request not found for this member.' });
    res.json({ ok: true, cancelled });
  });

  app.post('/api/me/copy-routes', async (req, res) => {
    const userId = currentUserId(req);
    const { access } = await getRequestAccess(req);
    if (!canUseCopier(access)) {
      await auditDenied(userId, 'copy_route.denied_role_gate', 'Route', req.path, { required: 'CULTURE COIN MEMBER+', access });
      return res.status(403).json({ ok: false, error: 'CULTURE COIN MEMBER+ is required before a live copy route can be created.', access });
    }
    const route = await mt4SyncService.repository.upsertCopyRoute?.(userId, { ...(req.body || {}), risk: normalizeRiskBody(req.body?.risk || req.body || {}) });
    if (!route) return res.status(400).json({ ok: false, error: 'Could not create route. Leader must be owned/shared to you and follower must be owned by you.' });
    res.json({ ok: true, route });
  });

  app.delete('/api/me/copy-routes/:routeId', async (req, res) => {
    const userId = currentUserId(req);
    const removed = await mt4SyncService.repository.deleteCopyRoute?.(userId, req.params.routeId);
    if (!removed) return res.status(404).json({ ok: false, error: 'Route not found.' });
    res.json({ ok: true, removed });
  });

  app.get('/api/me/equity-history', async (req, res) => {
    const userId = currentUserId(req);
    const accountId = String(req.query.accountId || '').trim();
    const period = String(req.query.period || 'ytd');
    const start = period === 'ytd' ? ytdStartIso() : rangeFromPeriod(period).start;
    const state = await mt4SyncService.repository.getMt4State();
    const accessibleAccounts = mt4SyncService.repository.getAccessibleMt4Accounts
      ? await mt4SyncService.repository.getAccessibleMt4Accounts(userId)
      : getMyConnectedAccounts(state, userId);
    const allowedAccountIds = new Set(accessibleAccounts.map((account) => String(account.accountId)));
    if (accountId && !allowedAccountIds.has(accountId)) {
      return res.status(403).json({ ok: false, error: 'Account is not owned/shared to this desk.' });
    }
    const rows = (state.snapshotHistory || [])
      .filter((record) => allowedAccountIds.has(String(record.accountId)))
      .filter((record) => !accountId || String(record.accountId) === accountId)
      .filter((record) => new Date(record.receivedAt).getTime() >= new Date(start).getTime())
      .sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt));
    const points = rows.map((record) => ({
      receivedAt: record.receivedAt,
      accountId: record.accountId,
      label: new Date(record.receivedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      balance: Number(record.snapshot?.balance || 0),
      equity: Number(record.snapshot?.equity || 0),
      floatingPL: Number(record.snapshot?.floatingPL || 0),
      openTradeCount: Number(record.snapshot?.openTradeCount || 0),
    }));
    res.json({ ok: true, period, start, accountId, points, accessibleAccounts: accessibleAccounts.length });
  });

  app.post(config.api.mt4SyncPath || '/mt4-sync', async (req, res) => {
    try {
      const result = await mt4SyncService.receiveSnapshot(req.body, req.headers);
      if (result?.coalesced) return res.status(202).json(result);
      if (result?.discordUserId && rankService && announcementService) {
        rankService.processSnapshot(result.discordUserId)
          .then((events) => announcementService.postRankEvents(events))
          .catch((error) => logger?.warn?.('Rank processing failed after MT4 sync', { discordUserId: result.discordUserId, message: error.message }));
      }
      if (result?.discordUserId && deskDashboardService) {
        deskDashboardService.updateDashboardForUser(result.discordUserId).catch((error) => {
          logger?.error?.('Desk dashboard auto-update failed after MT4 sync', {
            discordUserId: result.discordUserId,
            message: error.message,
            stack: error.stack,
          });
        });
      }
      res.json(result);
    }
    catch (error) { res.status(error.statusCode || 500).json({ ok: false, error: error.message }); }
  });

  app.post('/mt4-command-poll', async (req, res) => {
    try {
      mt4SyncService.validateApiKey(req.headers);
      const pairingCode = String(req.body?.pairingCode || '').trim();
      const pairing = await mt4SyncService.repository.getPairingCode(pairingCode);
      if (!pairing?.discordUserId) return res.status(400).json({ ok: false, error: 'Unknown pairing code' });
      const accountId = pairing.accountId || null;
      const accountNumber = String(req.body?.accountNumber || pairing.accountNumber || '').trim();
      await redisCommandBridge.heartbeat({
        userId: pairing.discordUserId || pairing.requestedByUserId || '',
        accountId,
        terminal: String(req.body?.terminal || req.body?.platform || 'MT4'),
        receiverId: String(req.body?.receiverId || req.body?.terminalId || pairingCode),
        meta: { accountNumber, reporterVersion: req.body?.reporterVersion || '', poll: true },
      }).catch(() => undefined);
      const deliveryUserIds = await resolveMt4DeliveryUserIds(loadEcosystemState, pairing);
      const { userId: commandOwnerId, command } = await findMt4QueuedCommand(mt4CommandService, deliveryUserIds, { accountId, accountNumber, pairingCode });
      if (command) {
        await mt4CommandService.markCommandDelivered(commandOwnerId, command.id, accountId);
        return res.json({ ...flattenCommandRecord(command), deliveryUserId: commandOwnerId, deliveryUserIds });
      }
      let copyCommand = null;
      let copyOwnerId = '';
      if (copyTradingService) {
        for (const candidateUserId of deliveryUserIds) {
          copyCommand = await copyTradingService.getPendingCopyCommand(candidateUserId, accountId);
          if (copyCommand) { copyOwnerId = candidateUserId; break; }
        }
      }
      if (!copyCommand) return res.json({ ok: true, hasCommand: false, deliveryUserIds });
      await copyTradingService.markCopyCommandDelivered(copyOwnerId || pairing.discordUserId, copyCommand.id, accountId);
      return res.json({ ...flattenCommandRecord(copyCommand), deliveryUserId: copyOwnerId || pairing.discordUserId, deliveryUserIds });
    } catch (error) { res.status(error.statusCode || 500).json({ ok: false, error: error.message }); }
  });

  app.post('/mt4-command-complete', async (req, res) => {
    try {
      mt4SyncService.validateApiKey(req.headers);
      const pairing = await mt4SyncService.repository.getPairingCode(String(req.body?.pairingCode || '').trim());
      if (!pairing?.discordUserId) return res.status(400).json({ ok: false, error: 'Unknown pairing code' });
      const accountId = pairing.accountId || null;
      await redisCommandBridge.heartbeat({
        userId: pairing.discordUserId || pairing.requestedByUserId || '',
        accountId,
        terminal: String(req.body?.terminal || req.body?.platform || 'MT4'),
        receiverId: String(req.body?.receiverId || req.body?.terminalId || req.body?.pairingCode || ''),
        meta: { commandComplete: true, commandId: req.body?.commandId || '' },
      }).catch(() => undefined);
      const deliveryUserIds = await resolveMt4DeliveryUserIds(loadEcosystemState, pairing);
      const completed = await markMt4CommandCompleteForAnyOwner(mt4CommandService, deliveryUserIds, req.body?.commandId, req.body?.result || {}, accountId);
      let command = completed.command;
      let commandOwnerId = completed.userId;
      if (!command && copyTradingService) {
        for (const candidateUserId of deliveryUserIds) {
          command = await copyTradingService.markCopyCommandCompleted(candidateUserId, req.body?.commandId, req.body?.result || {}, accountId);
          if (command) { commandOwnerId = candidateUserId; break; }
        }
      }
      await reconcileCopiedTradeCompletion(loadEcosystemState, saveEcosystemState, command, req.body?.result || {});
      try {
        const state = await loadEcosystemState();
        state.notification_events ||= [];
        state.sync_events ||= [];
        const websiteUserId = commandOwnerId || Object.entries(state.discord_connections || {}).find(([, conn]) => String(conn.discordUserId) === String(pairing.discordUserId))?.[0] || String(pairing.requestedByUserId || pairing.discordUserId);
        const success = req.body?.result?.success !== false;
        const closeTracker = finalizeCloseTracker(state,{command,result:req.body?.result||{},userId:websiteUserId,accountId:accountId||command?.accountId||''});
        const profileEmail = state.profiles?.[websiteUserId]?.email || state.usersById?.[websiteUserId]?.email || '';
        const closeEmail = closeTracker ? queueCloseEmail(state,{userId:websiteUserId,email:profileEmail,tracker:closeTracker,command,result:req.body?.result||{}}) : null;
        const gifPool = String(process.env.WISDO_WIN_GIF_URLS || '').split(',').map((v) => v.trim()).filter(Boolean);
        const winGifUrl = success && gifPool.length ? gifPool[Math.floor(Math.random() * gifPool.length)] : '';
        const notice = {
          id: makeId('notice'),
          userId: websiteUserId,
          tradingAccountId: accountId || '',
          type: success ? 'Command Executed Alert' : 'Risk Warning Alert',
          title: success ? 'MT4 Command Complete' : 'MT4 Command Failed',
          message: req.body?.result?.message || (success ? 'MT4 reporter completed the command.' : 'MT4 reporter rejected or failed the command.'),
          severity: success ? 'success' : 'danger',
          source: 'mt4_reporter',
          read_status: 'unread',
          metadata: { commandId: req.body?.commandId, command: command?.command || '', result: req.body?.result || {}, winGifUrl, ...(closeTracker ? { compoundTrackerId: closeTracker.id, closeMode: closeTracker.mode, compoundAnalysis: closeTracker.after } : {}) },
          createdAt: new Date().toISOString(),
        };
        state.notification_events.push(notice);
        state.alerts ||= {};
        state.alerts[websiteUserId] ||= [];
        const alertType = success
          ? (String(command?.command || '').toUpperCase() === 'COPY_OPEN_TRADE' ? 'trade_opened' : String(command?.command || '').toUpperCase() === 'COPY_CLOSE_TRADE' ? 'trade_closed' : 'system')
          : 'system';
        state.alerts[websiteUserId].unshift({
          id: makeId('alert'),
          user_id: String(websiteUserId),
          type: alertType,
          title: notice.title,
          body: notice.message,
          metadata: notice.metadata,
          read_at: null,
          created_at: notice.createdAt,
        });
        state.alerts[websiteUserId] = state.alerts[websiteUserId].slice(0, 1000);
        state.sync_events.push({ id: makeId('sync'), userId: websiteUserId, source: 'mt4_reporter', target: 'website_discord', action: 'command_complete', payload: notice, status: success ? 'completed' : 'failed', createdAt: new Date().toISOString() });
        await saveEcosystemState(state);
        if(closeEmail) commandNotificationDeliveryService.deliverDueByIds([closeEmail.id]).catch((error)=>logger?.warn?.('Close-result email delivery failed',{message:error.message,notificationId:closeEmail.id}));
        if(closeTracker&&isCloseCommand(command?.command)){
          const content=closeNotificationText(closeTracker);
          const discordUserId=String(pairing.discordUserId||'');
          if(client&&discordUserId){
            const discordUser=await client.users.fetch(discordUserId).catch(()=>null);
            if(discordUser) await discordUser.send({content}).catch((error)=>logger?.warn?.('Close-result Discord DM failed',{discordUserId,message:error.message}));
            const guildId=config.discordGuildId||config.guildId;
            if(guildId&&deskDashboardService?.operatorDeskService){
              const guild=await client.guilds.fetch(guildId).catch(()=>null);
              const deskChannel=guild?await deskDashboardService.operatorDeskService.getDeskChannelForUser(guild,discordUserId).catch(()=>null):null;
              if(deskChannel) await deskChannel.send({content}).catch((error)=>logger?.warn?.('Close-result desk message failed',{discordUserId,message:error.message}));
            }
          }
        }
        const webhook = process.env.DISCORD_NOTIFICATION_WEBHOOK_URL || process.env.WISDO_NOTIFICATION_WEBHOOK_URL || '';
        if (webhook) {
          fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Wisdo Command Center', content: `${success ? '✅' : '⚠️'} **${notice.title}** — ${notice.message}`, embeds: [{ title: notice.title, description: notice.message, color: success ? 5763719 : 15548997, ...(winGifUrl ? { image: { url: winGifUrl } } : {}) }] }) }).catch(() => {});
        }
      } catch (notifyError) {
        logger?.warn?.('Could not write MT4 command completion notification', { message: notifyError.message });
      }
      return res.json({ ok: true, commandId: req.body?.commandId, status: command?.status || 'not-found' });
    } catch (error) { res.status(error.statusCode || 500).json({ ok: false, error: error.message }); }
  });
  app.post('/api/trade-link/start', async (req, res) => {
    try {
      const blocked = ['password', 'masterPassword', 'tradingPassword', 'investorPassword'].some((key) => String(req.body?.[key] || '').trim());
      if (blocked) return res.status(400).json({ ok: false, error: 'Do not submit broker passwords. Use account number/server and verify with the MT4 Reporter pairing code.' });
      const input = normalizeTradeLinkBody(req.body || {});
      if (!input.userId) return res.status(400).json({ ok: false, error: 'Missing Discord user ID' });
      if (!input.server) return res.status(400).json({ ok: false, error: 'Missing broker server' });
      if (!input.accountNumber) return res.status(400).json({ ok: false, error: 'Missing account number' });
      let pairingCode = makePairingCode();
      while (await mt4SyncService.repository.getPairingCode(pairingCode)) pairingCode = makePairingCode();
      const now = new Date().toISOString();
      const link = await mt4SyncService.repository.saveTradeLink({
        linkId: makeId('link'),
        userId: input.userId,
        deskChannelId: input.deskChannelId,
        broker: input.broker,
        server: input.server,
        brokerServer: input.server,
        accountNumber: input.accountNumber,
        platform: input.platform || 'MT4',
        accountType: input.accountType || 'Demo',
        nickname: input.nickname || `${input.platform || 'MT4'} ${input.accountNumber}`,
        pairingCode,
        status: 'PENDING',
        createdAt: now,
        linkedAt: null,
        lastSyncAt: null,
        referrerCode: input.referrerCode || null,
        setupNote: String(input.setupNote || req.body?.setupNote || '').slice(0, 500),
        credentialMode: 'reporter-pairing-only',
      });
      return res.json({ ok: true, pairingCode, link });
    } catch (error) {
      logger.error('Trade link start failed', { message: error.message, stack: error.stack });
      return res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get('/api/trade-link/:userId', async (req, res) => {
    const links = await mt4SyncService.repository.getTradeLinksForUser(req.params.userId);
    res.json({ ok: true, links });
  });

  app.post('/api/trade-link/revoke', async (req, res) => {
    const link = await mt4SyncService.repository.revokeTradeLink(req.body?.linkId, req.body?.reason || 'portal_revoke');
    if (!link) return res.status(404).json({ ok: false, error: 'Trade link not found' });
    res.json({ ok: true, link });
  });

  app.get('/api/products', (req, res) => res.json({ ok: true, products: PLATFORM_PRODUCTS }));

  app.get('/api/referrals/:userId', async (req, res) => {
    const profile = await ensureReferralProfile(req.params.userId, req.query.username || '');
    const state = await loadEcosystemState();
    res.json({ ok: true, profile, stats: referralStatsForUser(state, req.params.userId), links: megaReferralLinks(getClientBaseUrl(req, config), profile.code) });
  });

  app.post('/api/referrals/link', async (req, res) => {
    const userId = String(req.body?.userId || 'website-buyer');
    const profile = await ensureReferralProfile(userId, req.body?.username || '');
    const type = String(req.body?.type || 'general');
    const targetId = String(req.body?.targetId || '');
    const state = await loadEcosystemState();
    const link = { referralLinkId: makeId('reflink'), referralCode: profile.code, ownerUserId: userId, type, targetId, campaignName: String(req.body?.campaignName || ''), active: true, createdAt: new Date().toISOString() };
    state.referralLinksById ||= {};
    state.referralLinksById[link.referralLinkId] = link;
    await saveEcosystemState(state);
    res.json({ ok: true, link });
  });

  app.post('/api/referrals/visit', async (req, res) => {
    const state = await loadEcosystemState();
    const owner = findReferralOwner(state, req.body?.referralCode);
    const visit = { referralVisitId: makeId('visit'), referralCode: String(req.body?.referralCode || ''), referrerUserId: owner?.userId || null, targetType: req.body?.targetType || 'general', targetId: req.body?.targetId || null, landingUrl: req.body?.landingUrl || '', conversionStatus: 'visited', firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() };
    state.referralVisits ||= [];
    state.referralVisits.push(visit);
    await saveEcosystemState(state);
    res.json({ ok: true, visit });
  });

  app.post('/api/referrals/convert', async (req, res) => {
    const state = await loadEcosystemState();
    const owner = findReferralOwner(state, req.body?.referralCode);
    const conversion = { conversionId: makeId('conv'), referralCode: String(req.body?.referralCode || ''), referrerUserId: owner?.userId || null, convertedUserId: req.body?.convertedUserId || null, convertedOrderId: req.body?.convertedOrderId || null, conversionStatus: req.body?.conversionStatus || 'signed_up', createdAt: new Date().toISOString() };
    state.conversions ||= [];
    state.conversions.push(conversion);
    await saveEcosystemState(state);
    res.json({ ok: true, conversion });
  });

  app.get('/api/commissions/:userId', async (req, res) => {
    const state = await loadEcosystemState();
    const ledger = Object.values(state.commissionLedgerById || {}).filter((c)=>String(c.referrerUserId)===String(req.params.userId));
    res.json({ ok: true, commissions: ledger, stats: referralStatsForUser(state, req.params.userId) });
  });

  app.post('/api/admin/commissions/:commissionId/approve', async (req, res) => {
    const state = await loadEcosystemState();
    const row = state.commissionLedgerById?.[req.params.commissionId];
    if (!row) return res.status(404).json({ ok: false, error: 'Commission not found' });
    row.status = 'available';
    row.approvedAt = new Date().toISOString();
    await saveEcosystemState(state);
    res.json({ ok: true, commission: row });
  });

  app.post('/api/payouts/request', async (req, res) => {
    const state = await loadEcosystemState();
    const payout = { payoutId: makeId('payout'), userId: String(req.body?.userId || 'website-buyer'), requestedAmount: Number(req.body?.amount || 0), payoutMethod: req.body?.payoutMethod || 'manual', status: 'requested', requestedAt: new Date().toISOString() };
    state.payoutsById ||= {};
    state.payoutsById[payout.payoutId] = payout;
    await saveEcosystemState(state);
    res.json({ ok: true, payout });
  });

  app.post('/api/admin/payouts/:payoutId/approve', async (req, res) => {
    const state = await loadEcosystemState();
    const payout = state.payoutsById?.[req.params.payoutId];
    if (!payout) return res.status(404).json({ ok: false, error: 'Payout not found' });
    payout.status = 'approved';
    payout.approvedAt = new Date().toISOString();
    await saveEcosystemState(state);
    res.json({ ok: true, payout });
  });

  app.get('/api/member/:userId/profile', async (req, res) => {
    const state = await loadEcosystemState();
    const mt4 = await mt4SyncService.repository.loadMt4State();
    const userId = req.params.userId;
    res.json({ ok: true, user: state.usersById?.[userId] || { userId }, licenses: state.licensesByUserId?.[userId] || [], orders: Object.values(state.ordersById || {}).filter((o)=>String(o.userId)===String(userId)), connections: Object.values(mt4.connections || {}).filter((c)=>String(c.discordUserId)===String(userId)) });
  });

  app.post('/api/member/profile', async (req, res) => {
    const state = await loadEcosystemState();
    const userId = currentUserId(req);
    state.usersById ||= {};
    state.usersById[userId] = { ...(state.usersById[userId] || {}), userId, username: req.body?.username || state.usersById[userId]?.username || `Member ${String(userId).slice(-4)}`, role: req.body?.role || state.usersById[userId]?.role || 'member', membershipTier: req.body?.membershipTier || state.usersById[userId]?.membershipTier || 'Culture Member', updatedAt: new Date().toISOString(), createdAt: state.usersById[userId]?.createdAt || new Date().toISOString() };
    await saveEcosystemState(state);
    res.json({ ok: true, user: state.usersById[userId] });
  });

  app.get('/api/licenses/:userId', async (req, res) => {
    const state = await loadEcosystemState();
    res.json({ ok: true, licenses: state.licensesByUserId?.[req.params.userId] || [] });
  });

  app.post('/api/admin/licenses/grant', async (req, res) => {
    const bot = EA_CATALOG.find((b)=>slugify(b.name) === slugify(req.body?.botSlug || req.body?.botName || ''));
    if (!bot) return res.status(404).json({ ok: false, error: 'Bot not found' });
    const license = await grantBotLicense({ userId: String(req.body?.userId || 'website-buyer'), bot, source: 'admin_grant' });
    res.json({ ok: true, license });
  });


  app.post('/api/bot-checkout', async (req, res) => {
    try {
      const botName = String(req.body?.botName || '').trim();
      const bot = EA_CATALOG.find((item) => item.name.toLowerCase() === botName.toLowerCase()) || EA_CATALOG.find((item) => slugify(item.name) === slugify(botName));
      if (!bot) return res.status(404).json({ ok: false, error: 'Bot not found' });
      const priceUsd = Number(req.body?.priceUsd || botPrice(bot, config));
      const quote = {
        quoteId: makeId('quote'),
        discordUserId: String(req.body?.userId || 'website-buyer'),
        botIds: [slugify(bot.name)],
        botNames: [bot.name],
        finalPriceUsd: priceUsd,
        createdAt: new Date().toISOString(),
        source: 'website-bot-arena',
      };
      if (mt4SyncService.repository.saveQuote) await mt4SyncService.repository.saveQuote(quote);
      const state = await loadEcosystemState();
      const order = {
        orderId: makeId('order'),
        userId: quote.discordUserId,
        productType: 'bot',
        productId: slugify(bot.name),
        productName: bot.name,
        amountUsd: priceUsd,
        status: paymentService?.isConfigured() ? 'checkout_created' : 'manual_invoice_pending',
        accessGranted: false,
        referralCode: String(req.body?.referralCode || req.query?.ref || ''),
        quoteId: quote.quoteId,
        createdAt: new Date().toISOString(),
      };
      state.ordersById ||= {};
      state.ordersById[order.orderId] = order;
      await saveEcosystemState(state);
      const commission = order.referralCode ? await createCommissionFromOrder(order, order.referralCode) : null;
      let license = null;
      if (paymentService?.isConfigured()) {
        const session = await paymentService.createCheckoutSession({ quote, member: { user: { id: quote.discordUserId } }, guildId: config.guildId || '' });
        order.checkoutUrl = session.url;
        const next = await loadEcosystemState();
        next.ordersById[order.orderId] = order;
        await saveEcosystemState(next);
        return res.json({ ok: true, botName: bot.name, priceUsd, quote, order, commission, checkoutUrl: session.url });
      }
      return res.json({ ok: true, botName: bot.name, priceUsd, quote, order, commission, license, checkoutUrl: null, checkoutMode: 'manual_invoice_pending', message: 'Live price and order saved. Square is not configured, so no license is granted until admin marks payment received or Square checkout is connected.' });
    } catch (error) {
      logger.error('Website bot checkout failed', { message: error.message, stack: error.stack });
      return res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get('/api/me/subscriptions', async (req, res) => {
    const userId = currentUserId(req);
    const state = financeState(await loadEcosystemState());
    res.json({ ok: true, subscriptions: Object.values(state.subscriptionsById).filter((x)=>String(x.userId)===String(userId)) });
  });

  app.get('/api/me/payment-plans', async (req, res) => {
    const userId = currentUserId(req);
    const state = financeState(await loadEcosystemState());
    res.json({ ok: true, paymentPlans: Object.values(state.paymentPlansById).filter((x)=>String(x.userId)===String(userId)) });
  });

  app.get('/api/me/payouts', async (req, res) => {
    const userId = currentUserId(req);
    const state = financeState(await loadEcosystemState());
    res.json({ ok: true, payouts: Object.values(state.payoutsById).filter((x)=>String(x.userId)===String(userId)) });
  });

  app.post('/api/me/payouts/request', async (req, res) => {
    const userId = currentUserId(req);
    const state = financeState(await loadEcosystemState());
    const payout = { payoutId: makeId('payout'), userId, amount: Number(req.body?.amount || 0), method: String(req.body?.method || 'manual'), destination: String(req.body?.destination || ''), status: 'requested', requestedAt: new Date().toISOString(), adminNote: '' };
    if (payout.amount <= 0) return res.status(400).json({ ok: false, error: 'Amount must be greater than zero' });
    state.payoutsById[payout.payoutId] = payout;
    await saveEcosystemState(state);
    res.json({ ok: true, payout });
  });

  app.get('/api/me/vps', async (req, res) => {
    const userId = currentUserId(req);
    const state = financeState(await loadEcosystemState());
    res.json({ ok: true, products: VPS_PRODUCTS, vps: Object.values(state.vpsAssignmentsById).filter((x)=>String(x.userId)===String(userId)) });
  });

  app.post('/api/vps/checkout', async (req, res) => {
    const userId = currentUserId(req);
    const plan = VPS_PRODUCTS.find((v)=>v.slug === String(req.body?.planSlug || '')) || VPS_PRODUCTS[1];
    const state = financeState(await loadEcosystemState());
    const subscription = { subscriptionId: makeId('sub'), userId, productType: 'vps', productId: plan.slug, productName: plan.planName, squareSubscriptionId: null, status: paymentService?.isConfigured() ? 'checkout_created' : 'manual_invoice_pending', amountMonthly: plan.monthlyPrice, currentPeriodStart: new Date().toISOString(), currentPeriodEnd: '', cancelAtPeriodEnd: false, createdAt: new Date().toISOString() };
    const vps = { vpsId: makeId('vps'), userId, planName: plan.planName, monthlyPrice: plan.monthlyPrice, status: 'setup_requested', assignedBotSlug: String(req.body?.assignedBotSlug || ''), assignedAccountId: String(req.body?.assignedAccountId || ''), squareSubscriptionId: null, lastHeartbeatAt: null, setupStatus: 'requested', createdAt: new Date().toISOString() };
    state.subscriptionsById[subscription.subscriptionId] = subscription;
    state.vpsAssignmentsById[vps.vpsId] = vps;
    await saveEcosystemState(state);
    res.json({ ok: true, subscription, vps, checkoutUrl: null, message: paymentService?.isConfigured() ? 'VPS live checkout record created.' : 'Live VPS order saved as manual invoice pending. No active paid access is granted until payment is confirmed.' });
  });

  app.post('/api/bots/:slug/checkout-plan', async (req, res) => {
    const userId = currentUserId(req);
    const slug = String(req.params.slug || '').trim();
    const bot = EA_CATALOG.find((item)=>slugify(item.name)===slug) || EA_CATALOG.find((item)=>slugify(item.name)==='df-sauce-final-ai') || EA_CATALOG[0];
    const fullPrice = Number(req.body?.priceUsd || botPrice(bot, config));
    const planType = String(req.body?.planType || 'paid_in_full');
    const state = financeState(await loadEcosystemState());
    const now = new Date().toISOString();
    const order = { orderId: makeId('order'), userId, productType: 'bot', productId: slugify(bot.name), productName: bot.name, grossAmount: fullPrice, amountUsd: fullPrice, currency: 'usd', paymentProvider: paymentService?.isConfigured() ? 'square' : 'manual', paymentStatus: 'pending', status: 'pending', checkoutSessionId: null, referralCode: String(req.body?.referralCode || ''), referrerUserId: '', licenseGranted: false, planType, createdAt: now, paidAt: null };
    state.ordersById ||= {}; state.ordersById[order.orderId] = order;
    let subscription = null; let paymentPlan = null; let vps = null; let license = null;
    if (planType === 'paid_in_full') {
      order.paymentStatus = paymentService?.isConfigured() ? 'checkout_created' : 'manual_invoice_pending';
      order.status = order.paymentStatus;
      if (!paymentService?.isConfigured()) {
        order.licenseGranted = false;
      }
    } else if (planType === 'payment_plan') {
      const monthly = Math.ceil(fullPrice / 6);
      paymentPlan = { planId: makeId('plan'), userId, productType: 'bot', productId: slugify(bot.name), productName: bot.name, totalPrice: fullPrice, amountPaid: 0, balanceRemaining: fullPrice, monthlyAmount: monthly, paymentsMade: 0, paymentsRemaining: 6, squareSubscriptionId: null, status: paymentService?.isConfigured() ? 'checkout_created' : 'manual_invoice_pending', vpsRequired: true, downloadUnlocked: false, paidInFullAt: null, createdAt: now, nextDueAt: '' };
      state.paymentPlansById[paymentPlan.planId] = paymentPlan;
      vps = { vpsId: makeId('vps'), userId, planName: 'Operator VPS', monthlyPrice: 97, status: 'active', assignedBotSlug: slugify(bot.name), assignedAccountId: '', squareSubscriptionId: null, lastHeartbeatAt: null, setupStatus: 'payment_plan_required', createdAt: now };
      state.vpsAssignmentsById[vps.vpsId] = vps;
    } else {
      const monthly = planType === 'vps_bundle' ? (bot.recommended ? 597 : Math.max(147, Math.round(fullPrice*.2))) : (bot.recommended ? 497 : Math.max(97, Math.round(fullPrice*.16)));
      subscription = { subscriptionId: makeId('sub'), userId, productType: planType === 'vps_bundle' ? 'bot_vps_bundle' : 'bot_rental', productId: slugify(bot.name), productName: bot.name, squareSubscriptionId: null, status: paymentService?.isConfigured() ? 'checkout_created' : 'manual_invoice_pending', amountMonthly: monthly, currentPeriodStart: now, currentPeriodEnd: '', cancelAtPeriodEnd: false, createdAt: now };
      state.subscriptionsById[subscription.subscriptionId] = subscription;
      vps = { vpsId: makeId('vps'), userId, planName: planType === 'vps_bundle' ? 'Operator VPS Bundle' : 'Rental VPS', monthlyPrice: planType === 'vps_bundle' ? 97 : 0, status: 'active', assignedBotSlug: slugify(bot.name), assignedAccountId: '', squareSubscriptionId: null, lastHeartbeatAt: null, setupStatus: 'bot_access_vps_only', createdAt: now };
      state.vpsAssignmentsById[vps.vpsId] = vps;
    }
    await saveEcosystemState(state);
    res.json({ ok: true, planType, productName: bot.name, status: order.status, order, subscription, paymentPlan, vps, license, checkoutUrl: null, message: paymentService?.isConfigured() ? 'Live finance record created; connect checkout session for payment collection.' : 'Live finance record saved as manual invoice pending. No bot download/license unlock occurs until payment is confirmed.' });
  });




  app.post('/api/admin/orders/:orderId/mark-paid', async (req, res) => {
    const state = financeState(await loadEcosystemState());
    const order = state.ordersById?.[req.params.orderId];
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
    order.paymentStatus = 'paid';
    order.status = 'paid';
    order.paidAt = new Date().toISOString();
    let license = null;
    if (order.productType === 'bot' && !order.licenseGranted) {
      const bot = EA_CATALOG.find((item) => slugify(item.name) === String(order.productId || '')) || EA_CATALOG.find((item) => item.name === order.productName);
      if (bot) {
        license = await grantBotLicense({ userId: order.userId, bot, orderId: order.orderId, source: 'admin_mark_paid' });
        order.licenseGranted = true;
      }
    }
    await saveEcosystemState(state);
    res.json({ ok: true, order, license });
  });

  app.post('/api/admin/link-access/:linkAccessId/mark-paid', async (req, res) => {
    const state = await loadEcosystemState();
    const access = state.paidLinkAccessById?.[req.params.linkAccessId];
    if (!access) return res.status(404).json({ ok: false, error: 'Link access record not found' });
    access.status = 'active';
    access.paidAt = new Date().toISOString();
    access.source = 'admin_mark_paid';
    await saveEcosystemState(state);
    res.json({ ok: true, access });
  });

  app.post('/api/admin/subscriptions/:subscriptionId/activate', async (req, res) => {
    const state = financeState(await loadEcosystemState());
    const subscription = state.subscriptionsById?.[req.params.subscriptionId];
    if (!subscription) return res.status(404).json({ ok: false, error: 'Subscription not found' });
    subscription.status = 'active';
    subscription.activatedAt = new Date().toISOString();
    await saveEcosystemState(state);
    res.json({ ok: true, subscription });
  });

  app.get('/api/admin/finance', async (req, res) => { const state = financeState(await loadEcosystemState()); res.json({ ok: true, orders: Object.values(state.ordersById||{}), subscriptions: Object.values(state.subscriptionsById), paymentPlans: Object.values(state.paymentPlansById), payouts: Object.values(state.payoutsById) }); });
  app.get('/api/admin/vps', async (req, res) => { const state = financeState(await loadEcosystemState()); res.json({ ok: true, products: VPS_PRODUCTS, vps: Object.values(state.vpsAssignmentsById) }); });
  app.post('/api/admin/payouts/:payoutId/approve', async (req, res) => { const state = financeState(await loadEcosystemState()); const p = state.payoutsById[req.params.payoutId]; if (!p) return res.status(404).json({ ok:false,error:'Payout not found' }); p.status='approved'; p.approvedAt=new Date().toISOString(); await saveEcosystemState(state); res.json({ ok:true,payout:p }); });
  app.post('/api/admin/payouts/:payoutId/mark-paid', async (req, res) => { const state = financeState(await loadEcosystemState()); const p = state.payoutsById[req.params.payoutId]; if (!p) return res.status(404).json({ ok:false,error:'Payout not found' }); p.status='paid'; p.paidAt=new Date().toISOString(); await saveEcosystemState(state); res.json({ ok:true,payout:p }); });
  app.post('/api/admin/licenses/:licenseId/pause', async (req, res) => { const state = await loadEcosystemState(); for (const list of Object.values(state.licensesByUserId||{})) { const lic = list.find((x)=>x.licenseId===req.params.licenseId); if (lic) { lic.status='paused'; await saveEcosystemState(state); return res.json({ ok:true,license:lic }); } } res.status(404).json({ ok:false,error:'License not found' }); });
  app.post('/api/admin/licenses/:licenseId/resume', async (req, res) => { const state = await loadEcosystemState(); for (const list of Object.values(state.licensesByUserId||{})) { const lic = list.find((x)=>x.licenseId===req.params.licenseId); if (lic) { lic.status='active'; await saveEcosystemState(state); return res.json({ ok:true,license:lic }); } } res.status(404).json({ ok:false,error:'License not found' }); });

  app.get('/api/copy-hub', async (req, res) => {
    const mt4 = await mt4SyncService.repository.loadMt4State();
    const copyLinks = mt4SyncService.repository.getAllCopyLinks ? await mt4SyncService.repository.getAllCopyLinks() : [];
    res.json({ ok: true, ...buildCopyHubModel(mt4), copyLinks });
  });

  app.get('/api/copy-links', async (req, res) => {
    const copyLinks = mt4SyncService.repository.getAllCopyLinks ? await mt4SyncService.repository.getAllCopyLinks() : [];
    res.json({ ok: true, copyLinks });
  });

  app.get('/api/copy-status/:discordUserId', async (req, res) => {
    const status = copyTradingService ? await copyTradingService.getCopyStatus(req.params.discordUserId) : { master: null, following: [], pendingCommands: [] };
    res.json({ ok: true, status });
  });

  app.post('/api/copy-links', async (req, res) => {
    try {
      const blocked = ['password', 'masterPassword', 'tradingPassword', 'investorPassword'].some((key) => String(req.body?.[key] || '').trim());
      if (blocked) return res.status(400).json({ ok: false, error: 'Do not submit broker passwords. Use follower account number/server and verify with MT4 Reporter pairing.' });
      const body = normalizeTradeLinkBody(req.body || {});
      if (!req.body?.leaderUserId) return res.status(400).json({ ok: false, error: 'Missing leader user ID' });
      if (!body.userId) return res.status(400).json({ ok: false, error: 'Missing follower Discord user ID' });
      if (!body.server) return res.status(400).json({ ok: false, error: 'Missing follower server' });
      if (!body.accountNumber) return res.status(400).json({ ok: false, error: 'Missing follower account number' });
      let pairingCode = makePairingCode();
      while (await mt4SyncService.repository.getPairingCode(pairingCode)) pairingCode = makePairingCode();
      const now = new Date().toISOString();
      const followerLink = await mt4SyncService.repository.saveTradeLink({
        linkId: makeId('link'),
        userId: body.userId,
        deskChannelId: body.deskChannelId,
        broker: body.broker,
        server: body.server,
        brokerServer: body.server,
        accountNumber: body.accountNumber,
        platform: body.platform || 'MT4',
        accountType: body.accountType || 'Demo',
        nickname: body.nickname || `${body.platform || 'MT4'} ${body.accountNumber}`,
        pairingCode,
        status: 'PENDING',
        createdAt: now,
        linkedAt: null,
        lastSyncAt: null,
        setupNote: String(body.setupNote || req.body?.setupNote || '').slice(0, 500),
        credentialMode: 'reporter-pairing-only',
        copyMode: true,
      });
      const leaderUserId = String(req.body.leaderUserId);
      const copyLink = mt4SyncService.repository.saveCopyLink ? await mt4SyncService.repository.saveCopyLink({
        copyLinkId: makeId('copy'),
        leaderUserId,
        leaderName: String(req.body.leaderName || 'Leader'),
        leaderAccountNumber: String(req.body.leaderAccountNumber || ''),
        leaderServer: String(req.body.leaderServer || ''),
        leaderEaName: String(req.body.eaName || ''),
        followerUserId: body.userId,
        followerAccountNumber: body.accountNumber,
        followerServer: body.server,
        followerPairingCode: pairingCode,
        mirrorScale: Number(req.body.mirrorScale || 1),
        maxDrawdownPct: Number(req.body.maxDrawdownPct || 0),
        status: 'PENDING_FOLLOWER_PAIR',
        createdAt: now,
        followerLinkId: followerLink.linkId,
      }) : { status: 'PENDING_FOLLOWER_PAIR', followerPairingCode: pairingCode, leaderName: req.body.leaderName || 'Leader', leaderAccountNumber: req.body.leaderAccountNumber || '', followerAccountNumber: body.accountNumber };
      if (copyTradingService) {
        await copyTradingService.registerMaster({
          discordUserId: leaderUserId,
          accountNumber: String(req.body.leaderAccountNumber || ''),
          displayName: String(req.body.leaderName || leaderUserId),
          allowedSymbols: [],
        });
        await copyTradingService.followMaster({
          followerUserId: body.userId,
          masterUserId: leaderUserId,
          followerAccountNumber: body.accountNumber,
          riskMode: 'multiplier',
          fixedLot: 0.01,
          multiplier: Number(req.body.mirrorScale || 1),
          maxLot: 5,
          maxOpenTrades: 50,
          copySLTP: true,
          symbolFilter: [],
        });
      }
      res.json({ ok: true, copyLink });
    } catch (error) {
      logger.error('Copy link create failed', { message: error.message, stack: error.stack });
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get('/api/accounts/:discordUserId/snapshots', async (req, res) => {
    const period = req.query.period || 'today';
    const range = rangeFromPeriod(period);
    const rows = await mt4SyncService.repository.getMt4SnapshotHistory(req.params.discordUserId, asNumber(req.query.limit, 500), range);
    res.json({ ok: true, period, range, snapshots: rows.reverse() });
  });

  app.get('/api/accounts/:discordUserId/session-rules', async (req, res) => {
    res.json({ ok: true, rules: await mt4SyncService.repository.getSessionRules(req.params.discordUserId) });
  });

  app.post('/api/accounts/:discordUserId/session-rules', async (req, res) => {
    const rule = { session: req.body.session || 'custom', symbol: req.body.symbol || '', startMinutes: asNumber(req.body.startMinutes, 0), endMinutes: asNumber(req.body.endMinutes, 1439), directionMode: req.body.directionMode || 'BOTH', enabled: req.body.enabled !== false };
    await mt4SyncService.repository.saveSessionRule(req.params.discordUserId, rule);
    const command = await mt4CommandService.queueCommand(req.params.discordUserId, 'SET_SESSION_RULE', { ...rule, globals: { WISDO_COMMAND_ID: Date.now(), WISDO_SESSION_ENABLED: rule.enabled ? 1 : 0, WISDO_SESSION_START_MINUTES: rule.startMinutes, WISDO_SESSION_END_MINUTES: rule.endMinutes, WISDO_SESSION_DIRECTION_MODE: rule.directionMode === 'BUY_ONLY' ? 1 : rule.directionMode === 'SELL_ONLY' ? 2 : 0 } });
    res.json({ ok: true, rule, command });
  });

  app.get('/member', async (req, res) => {
    const { identity, access } = await getRequestAccess(req);
    const hasExplicitMemberIdentity = Boolean(req.query?.userId || req.query?.discordUserId);
    if (identity.loggedIn || hasExplicitMemberIdentity) return res.redirect('/member/command-center');
    res.send(htmlShell('Wisdo Member Portal', memberPortalPreviewPage(req, access), 'home', { adminAccess: canAccessAdmin(access) }));
  });

  app.get('/member/home', async (req, res) => {
    const userId = currentUserId(req);
    const mt4 = await mt4SyncService.repository.loadMt4State();
    const state = await loadEcosystemState();
    const accounts = mt4SyncService.repository.getAccessibleMt4Accounts ? await mt4SyncService.repository.getAccessibleMt4Accounts(userId) : getMyConnectedAccounts(mt4, userId);
    const pairings = getMyPendingPairings(mt4, userId);
    const body = `${globalAccountBar(userId, accounts, req.query.accountId || '')}${smartStatusBanner(userId, accounts, pairings)}${operatorAutomationHomePage(userId, mt4, state)}`;
    res.send(htmlShell('Operator Automation Home', body, 'home'));
  });

  app.get('/member/command-center', async (req, res) => {
    const userId = currentUserId(req);
    const { access } = await getRequestAccess(req);
    const mt4 = await mt4SyncService.repository.loadMt4State();
    const state = await loadEcosystemState();
    const accounts = mt4SyncService.repository.getAccessibleMt4Accounts ? await mt4SyncService.repository.getAccessibleMt4Accounts(userId) : getMyConnectedAccounts(mt4, userId);
    const desk = defaultWisdoDesk(userId, accounts, state);
    res.send(htmlShell('Wisdo Command Center', wisdoCommandCenterPage({ userId, desk, state, config }), 'command', { adminAccess: canAccessAdmin(access) }));
  });

  app.get('/member/accounts', async (req, res) => {
    const userId = currentUserId(req);
    const mt4 = await mt4SyncService.repository.loadMt4State();
    const accounts = mt4SyncService.repository.getAccessibleMt4Accounts ? await mt4SyncService.repository.getAccessibleMt4Accounts(userId) : getMyConnectedAccounts(mt4, userId);
    const pairings = getMyPendingPairings(mt4, userId);
    res.send(htmlShell('My Accounts', myAccountsV2Page(userId, accounts, pairings), 'accounts'));
  });

  app.get('/member/accounts/:discordUserId/history', async (req, res) => {
    const period = req.query.period || 'today';
    const range = rangeFromPeriod(period);
    const rows = (await mt4SyncService.repository.getMt4SnapshotHistory(req.params.discordUserId, 500, range)).reverse();
    const labels = rows.map((r) => new Date(r.receivedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
    const equity = rows.map((r) => Number(r.snapshot?.equity || 0));
    const balance = rows.map((r) => Number(r.snapshot?.balance || 0));
    const table = rows.slice(-120).reverse().map((r) => `<tr><td>${new Date(r.receivedAt).toLocaleString()}</td><td>${money(r.snapshot?.balance)}</td><td>${money(r.snapshot?.equity)}</td><td>${money(r.snapshot?.floatingPL)}</td><td>${r.snapshot?.openTradeCount || 0}</td></tr>`).join('');
    res.send(htmlShell('Account History', `${sectionHero('Account Balance History', 'Use this to see exact timestamps for balance, equity, floating P/L, and open trades.', `<form><select name="period" onchange="this.form.submit()"><option value="today" ${period === 'today' ? 'selected' : ''}>Today</option><option value="week" ${period === 'week' ? 'selected' : ''}>This Week</option><option value="month" ${period === 'month' ? 'selected' : ''}>This Month</option></select></form>`)}<section class="card full"><canvas id="chart" class="spark"></canvas></section><section class="card full"><h3>Timestamp History</h3><table><thead><tr><th>Time</th><th>Balance</th><th>Equity</th><th>Floating P/L</th><th>Open Trades</th></tr></thead><tbody>${table || '<tr><td colspan="5">No snapshots for this period yet.</td></tr>'}</tbody></table></section><script src="https://cdn.jsdelivr.net/npm/chart.js"></script><script>new Chart(document.getElementById('chart'),{type:'line',data:{labels:${JSON.stringify(labels)},datasets:[{label:'Equity',data:${JSON.stringify(equity)},tension:.35},{label:'Balance',data:${JSON.stringify(balance)},tension:.35}]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{ticks:{color:'#9fb0c3'}},y:{ticks:{color:'#9fb0c3'}}},plugins:{legend:{labels:{color:'#fff'}}}}});</script>`, 'accounts'));
  });
  app.get('/r/:referralCode', async (req, res) => {
    const state = await loadEcosystemState();
    const owner = findReferralOwner(state, req.params.referralCode);
    state.referralVisits ||= [];
    state.referralVisits.push({ referralVisitId: makeId('visit'), referralCode: req.params.referralCode, referrerUserId: owner?.userId || null, targetType: 'general', landingUrl: req.originalUrl, conversionStatus: 'visited', firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() });
    await saveEcosystemState(state);
    res.send(htmlShell('Referral Landing', referralLandingPage(getClientBaseUrl(req, config), req.params.referralCode, 'general'), 'referrals'));
  });
  app.get('/r/:referralCode/bot/:botSlug', async (req, res) => {
    const state = await loadEcosystemState();
    const owner = findReferralOwner(state, req.params.referralCode);
    state.referralVisits ||= [];
    state.referralVisits.push({ referralVisitId: makeId('visit'), referralCode: req.params.referralCode, referrerUserId: owner?.userId || null, targetType: 'bot', targetId: req.params.botSlug, landingUrl: req.originalUrl, conversionStatus: 'visited', firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() });
    await saveEcosystemState(state);
    res.send(htmlShell('Bot Referral', referralLandingPage(getClientBaseUrl(req, config), req.params.referralCode, 'bot', req.params.botSlug), 'referrals'));
  });
  app.get('/r/:referralCode/copy/:leaderUserId', async (req, res) => res.send(htmlShell('Copy Referral', referralLandingPage(getClientBaseUrl(req, config), req.params.referralCode, 'copy', req.params.leaderUserId), 'referrals')));
  app.get('/r/:referralCode/signals/:symbol', async (req, res) => res.send(htmlShell('Signal Referral', referralLandingPage(getClientBaseUrl(req, config), req.params.referralCode, 'signals', req.params.symbol), 'referrals')));
  app.get('/r/:referralCode/film-room', async (req, res) => res.send(htmlShell('Film Room Referral', referralLandingPage(getClientBaseUrl(req, config), req.params.referralCode, 'film_room'), 'referrals')));

  app.get('/member/link-account', async (req, res) => {
    const userId = currentUserId(req);
    const mt4 = await mt4SyncService.repository.loadMt4State();
    const accounts = getMyConnectedAccounts(mt4, userId);
    const pairings = getMyPendingPairings(mt4, userId);
    res.send(htmlShell('Trade Link', stateAwareTradeLinkPage({ userId, accounts, pairings, baseUrl: getClientBaseUrl(req, config) }), 'link'));
  });
  app.get('/member/wallet', async (req, res) => { const userId = currentUserId(req); const state = await loadEcosystemState(); res.send(htmlShell('Commission Wallet', enhancedWalletPage(userId, state), 'wallet')); });
  app.get('/member/referrals', async (req, res) => { const userId = currentUserId(req); const profile = await ensureReferralProfile(userId, req.query.username || ''); const state = await loadEcosystemState(); res.send(htmlShell('Referral Center', megaReferralDashboardPage(getClientBaseUrl(req, config), userId, state), 'referrals')); });
  app.get('/member/referral-builder', async (req, res) => { const userId = currentUserId(req); await ensureReferralProfile(userId, req.query.username || ''); const state = await loadEcosystemState(); res.send(htmlShell('Referral Builder', referralBuilderPage(getClientBaseUrl(req, config), userId, state), 'refbuilder')); });
  app.get('/member/copy-pro', async (req, res) => { const userId = currentUserId(req); const { access } = await getRequestAccess(req); const accounts = mt4SyncService.repository.getAccessibleMt4Accounts ? await mt4SyncService.repository.getAccessibleMt4Accounts(userId) : getMyConnectedAccounts(await mt4SyncService.repository.loadMt4State(), userId); const routes = mt4SyncService.repository.getCopyRoutesForUser ? await mt4SyncService.repository.getCopyRoutesForUser(userId) : []; const shares = mt4SyncService.repository.getAccountSharesForUser ? await mt4SyncService.repository.getAccountSharesForUser(userId) : []; const discoverable = mt4SyncService.repository.getDiscoverableMt4Accounts ? await mt4SyncService.repository.getDiscoverableMt4Accounts(userId) : []; const accessRequests = mt4SyncService.repository.getAccountAccessRequestsForUser ? await mt4SyncService.repository.getAccountAccessRequestsForUser(userId) : []; const brokerRequests = mt4SyncService.repository.getBrokerLinkRequestsForUser ? await mt4SyncService.repository.getBrokerLinkRequestsForUser(userId) : []; res.send(htmlShell('CEM Culture Relay Engine', copyHubProPage(userId, accounts, routes, shares, discoverable, accessRequests, brokerRequests, access), 'copypro')); });
  app.get('/admin/commerce', async (req, res) => { const state = await loadEcosystemState(); res.send(htmlShell('Admin Commerce', adminCommercePage(state), 'admincommerce')); });

  app.get('/member/copy', async (req, res) => {
    const query = new URLSearchParams(req.query || {}).toString();
    res.redirect(`/member/copy-pro${query ? '?' + query : ''}`);
  });

  app.get('/member/advanced-link', async (req, res) => {
    res.redirect('/member/copy-pro#broker-link');
  });

  app.get('/member/community-reporters', async (req, res) => {
    res.redirect('/member/copy-pro#discover');
  });
  app.get('/member/store', (req, res) => res.send(htmlShell('CultureCoin Store', storeFrontPage(), 'storefront')));
  app.get('/member/leaderboard', (req, res) => res.send(htmlShell('Leaderboard', leaderboardPage(), 'leaderboard')));
  app.get('/join/:code', (req, res) => res.send(htmlShell('Join CultureCoin', `${sectionHero('Join CultureCoin', `You were invited with referral code <strong>${esc(req.params.code)}</strong>. Create a member desk, link your trading account, and choose your upgrade lane.`)}<section class="card full"><a class="btn primary" href="/member/link-account">Start Trade Link</a><a class="btn" href="/member/upgrades">View Upgrades</a></section>`, 'referrals')));

  app.get('/member/wisdo', (req, res) => res.send(htmlShell('WISDO Control', wisdoControlPage(req.query || {}), 'home')));
  app.get('/member/reviews', (req, res) => res.send(htmlShell('WISDO Film Room', filmRoomPage(), 'content')));
  app.get('/member/reviews/new', (req, res) => res.redirect('/member/long-videos/upload'));
  app.get('/member/reviews/queue', (req, res) => res.send(htmlShell('Review Queue', filmRoomPage(), 'content')));
  app.get('/member/marketplace', (req, res) => res.send(htmlShell('Bot Marketplace', botsPage(config), 'marketplace')));
  app.get('/member/bots', (req, res) => res.send(htmlShell('Bot Arena', botsPage(config), 'bots')));
  app.get('/member/bots/:slug', (req, res) => res.send(htmlShell('Bot Detail', botDetailPage(req.params.slug, config), 'bots')));
  app.get('/member/devices', (req, res) => res.send(htmlShell('Device Forge', devicesPage(), 'devices')));
  app.get('/member/upgrades', (req, res) => res.send(htmlShell('Special Upgrades', upgradesPage(), 'upgrades')));
  app.get('/member/special-upgrades', (req, res) => res.redirect('/member/upgrades'));
  app.get('/member/sales', (req, res) => res.send(htmlShell('Sales Desk', salesPage(config), 'sales')));
  app.get('/member/ai', (_req, res) => res.send(htmlShell('Wisdo AI Center', wisdoAiCenterPage(), 'ai')));
  app.get('/member/academy', (_req, res) => res.send(htmlShell('Wisdo Trading Academy', wisdoAcademyPage(''), 'education')));
  app.get('/member/academy/lesson/:lessonId', (req, res) => res.send(htmlShell('Wisdo Academy Lesson', wisdoAcademyPage(String(req.params.lessonId || '')), 'education')));
  app.get('/member/academy/:trackSlug', (req, res) => res.send(htmlShell('Wisdo Trading Academy', wisdoAcademyPage(String(req.params.trackSlug || '')), 'education')));
  app.get('/member/education', async (req, res) => { const userId = currentUserId(req); const state = await loadEcosystemState(); res.send(htmlShell('Wisdo Education', wisdoEducationPage(state, userId, String(req.query?.bot || req.query?.botSlug || '')), 'education')); });
  app.get('/member/signal-grid', async (req, res) => { const userId = currentUserId(req); const state = await loadEcosystemState(); res.send(htmlShell('Wisdo Signal Grid', signalGridPage(userId, state), 'signals')); });
  app.get('/member/simulator', (req, res) => res.send(htmlShell('Wisdo Simulator', wisdoSimulatorPage(String(req.query?.bot || '')), 'simulator')));
  app.get('/member/social', async (req, res) => { const userId = currentUserId(req); const state = await loadEcosystemState(); res.send(htmlShell('Wisdo Social', wisdoSocialPage(state, userId), 'social')); });
  app.get('/member/payouts', async (req, res) => { const userId=currentUserId(req); const state=await loadEcosystemState(); res.send(htmlShell('Payouts', payoutRequestPage(userId,state), 'payouts')); });
  app.get('/member/link-access', async (req, res) => res.send(htmlShell('Paid Link Access', linkAccessPage(req), 'linkaccess')));
  app.get('/member/linked-access', async (req, res) => { const state = await loadEcosystemState(); res.send(htmlShell('My Linked Access', linkedAccessPage(req, state), 'linkedaccess')); });
  app.get('/u/:username', async (req, res) => { const state = await loadEcosystemState(); res.send(htmlShell('Trader Profile', publicProfilePage(req.params.username, state), 'profile')); });
  app.get('/admin/link-access', async (req, res) => { const state = await loadEcosystemState(); res.send(htmlShell('Admin Link Access', adminLinkAccessPage(state), 'admincommerce')); });

  app.get('/api/link-access/products', (req, res) => res.json({ ok: true, products: PAID_LINK_PRODUCTS }));
  app.get('/api/me/linked-access', async (req, res) => { const state = await loadEcosystemState(); const identity = getIdentity(req); const ids = state.paidLinkAccessByUserId?.[identity.userId] || []; res.json({ ok: true, linkedAccess: ids.map((id) => state.paidLinkAccessById?.[id]).filter(Boolean) }); });
  app.post('/api/link-access/checkout', async (req, res) => {
    try {
      const state = await loadEcosystemState();
      const identity = getIdentity(req);
      const buyerUserId = String(req.body?.buyerUserId || identity.userId || 'website-buyer');
      const access = createPaidLinkAccess({ buyerUserId, productId: String(req.body?.productId || ''), status: paymentService?.isConfigured() ? 'pending_payment' : 'manual_invoice_pending', source: paymentService?.isConfigured() ? 'square_pending' : 'manual_invoice' });
      state.paidLinkAccessById ||= {};
      state.paidLinkAccessByUserId ||= {};
      state.paidLinkAccessById[access.linkAccessId] = access;
      state.paidLinkAccessByUserId[buyerUserId] ||= [];
      state.paidLinkAccessByUserId[buyerUserId] = [access.linkAccessId, ...state.paidLinkAccessByUserId[buyerUserId].filter((id) => id !== access.linkAccessId)];
      await saveEcosystemState(state);
      if (paymentService?.isConfigured()) {
        const checkout = await paymentService.createOneTimeCheckout({
          name: access.productName,
          amountCents: Math.round(Number(access.price || 0) * 100),
          type: 'link_access',
          payload: { a: access.linkAccessId, u: buyerUserId },
          buyerEmail: identity.email || undefined,
          redirectPath: `/member/linked-access?created=${encodeURIComponent(access.linkAccessId)}`,
        });
        access.squarePaymentLinkId = checkout.id;
        access.squareOrderId = checkout.orderId;
        const nextState = await loadEcosystemState();
        if (nextState.paidLinkAccessById?.[access.linkAccessId]) nextState.paidLinkAccessById[access.linkAccessId] = access;
        await saveEcosystemState(nextState);
        if (String(req.headers.accept || '').includes('text/html')) return res.redirect(checkout.url);
        return res.json({ ok: true, provider: 'square', access, checkoutReady: true, checkoutUrl: checkout.url });
      }
      if (String(req.headers.accept || '').includes('text/html')) return res.redirect(`/member/linked-access?created=${encodeURIComponent(access.linkAccessId)}`);
      res.json({ ok: true, provider: 'manual', access, checkoutReady: false, message: 'Live price/access record saved as manual invoice pending. Access remains locked until payment is confirmed.' });
    } catch (error) {
      logger.error('Paid link Square checkout failed', { message: error.message });
      res.status(error.expose ? 400 : 500).json({ ok: false, error: error.message });
    }
  });
  app.post('/api/admin/link-access/grant', async (req, res) => { const state = await loadEcosystemState(); const access = createPaidLinkAccess({ buyerUserId: req.body?.buyerUserId, productId: req.body?.productId, status: 'active', source: 'admin_grant' }); state.paidLinkAccessById ||= {}; state.paidLinkAccessByUserId ||= {}; state.paidLinkAccessById[access.linkAccessId] = access; state.paidLinkAccessByUserId[access.buyerUserId] ||= []; state.paidLinkAccessByUserId[access.buyerUserId].unshift(access.linkAccessId); await saveEcosystemState(state); res.json({ ok: true, access }); });
  app.post('/api/admin/link-access/revoke', async (req, res) => { const state = await loadEcosystemState(); const id = String(req.body?.linkAccessId || ''); if (state.paidLinkAccessById?.[id]) state.paidLinkAccessById[id].status = 'revoked'; await saveEcosystemState(state); res.json({ ok: true, linkAccessId: id, status: state.paidLinkAccessById?.[id]?.status || 'not_found' }); });

  app.get('/member/support', (req, res) => res.send(htmlShell('Support', supportPage(), 'support')));
  app.get('/member/settings', (req, res) => res.send(htmlShell('Settings', settingsPage(config), 'settings')));
  app.get('/member/upload', (req, res) => res.send(htmlShell('Upload Video', feedUploadPage(), 'home')));
  app.get('/member/feed', async (req, res) => res.send(htmlShell('Culture Feed', await cultureFeedPage(), 'home')));
  app.get('/feed', async (req, res) => res.send(htmlShell('Culture Feed', await cultureFeedPage(), 'home')));

  app.get('/member/profile', async (req, res) => {
    const userId = currentUserId(req);
    const state = await loadEcosystemState();
    const mt4 = await mt4SyncService.repository.loadMt4State();
    res.send(htmlShell('My Profile', memberProfilePage(userId, state, mt4), 'profile'));
  });
  app.get('/member/my-bots', async (req, res) => {
    const userId = currentUserId(req);
    const state = await loadEcosystemState();
    res.send(htmlShell('My Bots', myBotsPage(userId, state), 'mybots'));
  });
  app.get('/member/purchases', async (req, res) => {
    const userId = currentUserId(req);
    const state = await loadEcosystemState();
    res.send(htmlShell('My Purchases', purchasesPage(userId, state), 'mybots'));
  });
  app.get('/member/content', async (req, res) => {
    const userId = currentUserId(req);
    const state = await loadEcosystemState();
    res.send(htmlShell('Content Hub', await contentHubPage(userId, state), 'content'));
  });
  app.get('/admin/ecosystem', async (req, res) => {
    const state = await loadEcosystemState();
    res.send(htmlShell('Admin Ecosystem', adminEcosystemPage(state), 'settings'));
  });
  app.get('/admin/wisdo', async (req, res) => renderAdminWisdoPage(req, res, 'Admin Wisdo'));
  app.get('/member/admin-wisdo', async (req, res) => renderAdminWisdoPage(req, res, 'Admin Wisdo Workbench'));

  app.get('/member/setup', async (req, res) => { const userId = currentUserId(req); const mt4 = await mt4SyncService.repository.loadMt4State(); const state = await loadEcosystemState(); res.send(htmlShell('Free Setup Center', universalSetupPage(userId, mt4, state), 'setup')); });

  app.get('/member/onboarding', async (req, res) => { const userId = currentUserId(req); const mt4 = await mt4SyncService.repository.loadMt4State(); const state = await loadEcosystemState(); res.send(htmlShell('Smart Onboarding', onboardingWizardPage(userId, mt4, state), 'onboarding')); });
  app.get('/member/mt4-webrequest-guide', (req, res) => res.send(htmlShell('MT4 WebRequest Guide', mt4WebRequestGuidePage(config), 'doctor')));
  app.get('/member/account-doctor', async (req, res) => { const userId = currentUserId(req); const mt4 = await mt4SyncService.repository.loadMt4State(); res.send(htmlShell('Account Doctor', accountDoctorPage(userId, mt4), 'doctor')); });
  app.get('/member/install/:botSlug', async (req, res) => { const state = await loadEcosystemState(); res.send(htmlShell('Bot Install Wizard', installWizardPage(req.params.botSlug, state), 'mybots')); });
  app.get('/member/risk-settings', async (req, res) => { const userId = currentUserId(req); const state = await loadEcosystemState(); res.send(htmlShell('Risk Settings', riskProfilePage(userId, state), 'risk')); });
  app.get('/member/risk-profile', async (req, res) => { const userId = currentUserId(req); const state = await loadEcosystemState(); res.send(htmlShell('Risk Profile', riskProfilePage(userId, state), 'risk')); });
  app.get('/member/trade-results', async (req, res) => { const userId = currentUserId(req); const mt4 = await mt4SyncService.repository.loadMt4State(); const accounts = mt4SyncService.repository.getAccessibleMt4Accounts ? await mt4SyncService.repository.getAccessibleMt4Accounts(userId) : getMyConnectedAccounts(mt4, userId); res.send(htmlShell('Trade Results', tradeResultsPage(userId, mt4, accounts), 'results')); });
  app.get('/member/support/tickets', async (req, res) => { const userId = currentUserId(req); const state = await loadEcosystemState(); res.send(htmlShell('Support Tickets', supportTicketsPage(userId, state), 'tickets')); });
  app.get('/admin/health', async (req, res) => { const mt4 = await mt4SyncService.repository.loadMt4State(); const state = await loadEcosystemState(); res.send(htmlShell('Admin Health', adminHealthPage(config, mt4, state), 'health')); });


  app.get('/member/subscriptions', async (req, res) => { const userId=currentUserId(req); const state=await loadEcosystemState(); res.send(htmlShell('Subscriptions', subscriptionsPage(userId,state), 'subscriptions')); });
  app.get('/member/payment-plans', async (req, res) => { const userId=currentUserId(req); const state=await loadEcosystemState(); res.send(htmlShell('Payment Plans', paymentPlansPage(userId,state), 'plans')); });
  app.get('/member/vps', async (req, res) => { const userId=currentUserId(req); const state=await loadEcosystemState(); res.send(htmlShell('VPS Forge', vpsForgePage(userId,state), 'vps')); });
  app.get('/member/purchase-success', (req, res) => res.send(htmlShell('Purchase Success', purchaseResultPage(true), 'mybots')));
  app.get('/member/purchase-cancelled', (req, res) => res.send(htmlShell('Purchase Cancelled', purchaseResultPage(false), 'mybots')));
  app.get('/admin/finance', async (req, res) => { const state=await loadEcosystemState(); res.send(htmlShell('Admin Finance', adminFinancePage(state), 'adminfinance')); });
  app.get('/admin/vps', async (req, res) => { const state=await loadEcosystemState(); res.send(htmlShell('Admin VPS', adminVpsPage(state), 'adminvps')); });
  app.get('/admin/payouts', async (req, res) => { const state=await loadEcosystemState(); res.send(htmlShell('Admin Payouts', adminFinancePage(state), 'adminfinance')); });
  app.get('/admin/subscriptions', async (req, res) => { const state=await loadEcosystemState(); res.send(htmlShell('Admin Subscriptions', adminFinancePage(state), 'adminfinance')); });
  app.get('/member/:page', (req, res) => res.status(404).send(htmlShell('Not Found', `${sectionHero('Page not found', `The module <strong>${esc(req.params.page)}</strong> is not registered yet.`)}<section class="card full"><a class="btn primary" href="/member">Return Home</a></section>`, 'home')));

  const server = app.listen(config.api.port, () => logger.info('API/member portal listening', { port: config.api.port }));
  server.on('close', () => {
    redisCommandBridge.close().catch(() => undefined);
    wisdoPhase1Repository?.adapter?.close?.().catch?.(() => undefined);
  });
  return server;
}
