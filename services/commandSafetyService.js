import fs from 'node:fs/promises';
import path from 'node:path';

import { atomicWriteJson } from '../storage/atomicJsonFile.js';

function nowIso() { return new Date().toISOString(); }
function addSeconds(s) { const d = new Date(); d.setSeconds(d.getSeconds() + Number(s || 60)); return d.toISOString(); }
function normalize(value) { return String(value || '').trim().toLowerCase(); }

const RED = new Set(['CLOSE_ALL', 'EMERGENCY_STOP', 'CUT_LOSERS', 'REMOVE_ACCOUNT', 'ENABLE_LIVE_COPY', 'COPY_BASKET', 'INCREASE_RISK', 'DISABLE_EQUITY_FLOOR', 'SET_GLOBALS_RED']);
const YELLOW = new Set(['SET_GLOBALS', 'SET_CONTROL_MODE', 'SET_RISK_LIMIT', 'COPY_OPEN_TRADE', 'PAUSE_TRADING', 'RESUME_TRADING', 'SET_SELL_ONLY', 'SET_BUY_ONLY']);

export class CommandSafetyService {
  constructor(config = {}) {
    this.dataDir = config.dataDir || 'data/operator-desks';
    this.filePath = path.join(this.dataDir, 'wisdo-confirmations.json');
  }

  async load() {
    try { return { confirmations: {}, ...JSON.parse(await fs.readFile(this.filePath, 'utf8')) }; }
    catch { return { confirmations: {} }; }
  }

  async save(data) {
    await atomicWriteJson(this.filePath, data);
  }

  classify(command, payload = {}) {
    const name = String(command || '').toUpperCase();
    if (RED.has(name)) return 'red';
    if (name === 'SET_GLOBALS') {
      const g = payload?.globals || payload?.payload?.globals || {};
      if (Number(g.WISDO_CLOSE_ALL || 0) === 1) return 'red';
      if (Number(g.WISDO_CUT_LOSERS || 0) === 1) return 'red';
      if (Number(g.WISDO_RISK_PERCENT || 0) > 3) return 'red';
      if (Number(g.WISDO_MAX_TRADES || 0) > 10) return 'red';
      if (Number(g.WISDO_EQUITY_FLOOR || 1) <= 0 && Object.hasOwn(g, 'WISDO_EQUITY_FLOOR')) return 'red';
      return 'yellow';
    }
    if (/CLOSE|REMOVE|DELETE|CUT|INCREASE|LIVE_COPY/.test(name)) return 'red';
    if (YELLOW.has(name) || /SET_|COPY_|PAUSE|RESUME|RISK|BUY|SELL/.test(name)) return 'yellow';
    return 'green';
  }

  requiresConfirmation(command, payload = {}) { return this.classify(command, payload) === 'red'; }

  confirmationPhrase(action, accountLabel = '') {
    const clean = normalize(action).replace(/[^a-z0-9]+/g, ' ').trim().toUpperCase();
    const scope = normalize(accountLabel).includes('live') ? ' LIVE' : '';
    if (clean.includes('CLOSE')) return `CONFIRM CLOSE${scope}`.trim();
    if (clean.includes('COPY')) return `CONFIRM COPY${scope}`.trim();
    if (clean.includes('REMOVE')) return 'CONFIRM REMOVE';
    return `CONFIRM ${clean.split(' ')[0] || 'ACTION'}${scope}`.trim();
  }

  async createConfirmation({ userId, accountId = null, accountLabel = '', command, payload = {}, reason = '', ttlSeconds = 60 }) {
    const data = await this.load();
    const id = `confirm_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const phrase = this.confirmationPhrase(command, accountLabel);
    data.confirmations[id] = {
      id,
      userId: String(userId || ''),
      accountId,
      accountLabel,
      command,
      payload,
      reason,
      phrase,
      status: 'pending',
      createdAt: nowIso(),
      expiresAt: addSeconds(ttlSeconds),
    };
    await this.save(data);
    return data.confirmations[id];
  }

  async listPending(userId) {
    const data = await this.load();
    const now = Date.now();
    return Object.values(data.confirmations).filter((c) => c.userId === String(userId) && c.status === 'pending' && new Date(c.expiresAt).getTime() > now);
  }

  async confirm({ userId, phraseOrId }) {
    const data = await this.load();
    const input = normalize(phraseOrId);
    const now = Date.now();
    const record = Object.values(data.confirmations).find((c) => {
      if (c.userId !== String(userId)) return false;
      if (c.status !== 'pending') return false;
      if (new Date(c.expiresAt).getTime() < now) return false;
      return normalize(c.id) === input || normalize(c.phrase) === input;
    });
    if (!record) return null;
    record.status = 'confirmed';
    record.confirmedAt = nowIso();
    await this.save(data);
    return record;
  }
}
