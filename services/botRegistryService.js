import fs from 'node:fs/promises';
import path from 'node:path';

import { atomicWriteJson } from '../storage/atomicJsonFile.js';

function clean(value = '') {
  return String(value || '').trim();
}

function normalizeToken(value = '') {
  return clean(value).toUpperCase().replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function makeLaneKey({ accountNumber, brokerServer = '', botKey, symbol, magicNumber }) {
  return [accountNumber, brokerServer, botKey, symbol, magicNumber].map((v) => clean(v)).join('|');
}

function isFreshLane(lane, maxAgeMinutes = 30) {
  const ts = new Date(lane?.lastSeen || 0).getTime();
  if (!ts) return false;
  return (Date.now() - ts) <= maxAgeMinutes * 60_000;
}

export class BotRegistryService {
  constructor(config = {}) {
    this.dataDir = config.dataDir || 'data/operator-desks';
    this.filePath = path.join(this.dataDir, 'cem-bot-registry.json');
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const data = JSON.parse(raw);
      data.lanesByUserId ||= {};
      data.nicknamesByUserId ||= {};
      return data;
    } catch {
      return { lanesByUserId: {}, nicknamesByUserId: {} };
    }
  }

  async save(data) {
    await atomicWriteJson(this.filePath, data);
  }

  normalizeLane(input = {}) {
    const botKey = normalizeToken(input.botKey || input.bot || input.eaName || 'UNKNOWN_BOT');
    const accountNumber = clean(input.accountNumber);
    const brokerServer = clean(input.brokerServer);
    const symbol = normalizeToken(input.symbol || input.chartSymbol || '');
    const magicNumber = Number.parseInt(String(input.magicNumber ?? input.magic ?? 0), 10) || 0;
    const lanePrefix = input.lanePrefix || `CEM.${botKey}.${accountNumber || '__ACCOUNT__'}.${symbol}.${magicNumber}`;
    const key = input.laneKey || makeLaneKey({ accountNumber, brokerServer, botKey, symbol, magicNumber });
    const nickname = clean(input.botNickname || input.nickname || '');
    return {
      laneKey: key,
      accountId: clean(input.accountId),
      accountNumber,
      brokerServer,
      botKey,
      botLabel: clean(input.botLabel || input.eaName || botKey),
      botNickname: nickname,
      symbol,
      magicNumber,
      lanePrefix,
      openTrades: Number(input.openTrades || input.openTradeCount || 0),
      buyTrades: Number(input.buyTrades || input.buyTradeCount || 0),
      sellTrades: Number(input.sellTrades || input.sellTradeCount || 0),
      totalLots: Number(input.totalLots || 0),
      floatingPL: Number(input.floatingPL || 0),
      adaptiveValues: input.adaptiveValues && typeof input.adaptiveValues === 'object' ? input.adaptiveValues : {},
      lastSeen: input.lastSeen || new Date().toISOString(),
    };
  }

  async updateFromSnapshot({ discordUserId, accountId, snapshot, connectionRecord }) {
    const userId = clean(discordUserId);
    if (!userId || !snapshot) return { updated: 0, lanes: [] };

    const rawLanes = Array.isArray(snapshot.adaptiveBots) ? snapshot.adaptiveBots : [];
    const fallbackLanes = [];
    if (!rawLanes.length) {
      const symbols = Array.isArray(snapshot.symbols) && snapshot.symbols.length ? snapshot.symbols : [snapshot.symbolFilter || ''];
      const magicNumbers = Array.isArray(snapshot.magicNumbersSeen) && snapshot.magicNumbersSeen.length ? snapshot.magicNumbersSeen : [snapshot.magicNumberFilter || 0];
      const botKey = snapshot.cemBotKey || snapshot.eaName || 'UNKNOWN_BOT';
      for (const symbol of symbols) {
        for (const magicNumber of magicNumbers) {
          if (!symbol && !magicNumber) continue;
          fallbackLanes.push({ botKey, symbol, magicNumber });
        }
      }
    }

    const lanes = (rawLanes.length ? rawLanes : fallbackLanes).map((lane) => this.normalizeLane({
      accountId,
      accountNumber: snapshot.accountNumber,
      brokerServer: snapshot.brokerServer,
      eaName: snapshot.eaName,
      botKey: lane.botKey || snapshot.cemBotKey || snapshot.eaName,
      botLabel: lane.botLabel || snapshot.eaName,
      botNickname: lane.botNickname || snapshot.cemBotNickname || '',
      symbol: lane.symbol,
      magicNumber: lane.magicNumber,
      lanePrefix: lane.lanePrefix,
      openTrades: lane.openTrades,
      buyTrades: lane.buyTrades,
      sellTrades: lane.sellTrades,
      totalLots: lane.totalLots,
      floatingPL: lane.floatingPL,
      adaptiveValues: lane.adaptiveValues,
      lastSeen: new Date().toISOString(),
    })).filter((lane) => lane.accountNumber && lane.symbol && lane.magicNumber >= 0);

    const data = await this.load();
    data.lanesByUserId[userId] ||= {};
    data.nicknamesByUserId[userId] ||= {};

    for (const lane of lanes) {
      const existing = data.lanesByUserId[userId][lane.laneKey] || {};
      const savedNickname = data.nicknamesByUserId[userId][lane.laneKey];
      data.lanesByUserId[userId][lane.laneKey] = {
        ...existing,
        ...lane,
        botNickname: savedNickname || lane.botNickname || existing.botNickname || '',
      };
    }

    await this.save(data);
    return { updated: lanes.length, lanes };
  }

  async listLanes(discordUserId, { includeStale = true } = {}) {
    const data = await this.load();
    const lanes = Object.values(data.lanesByUserId?.[clean(discordUserId)] || {});
    return lanes
      .filter((lane) => includeStale || isFreshLane(lane))
      .sort((a, b) => String(a.botNickname || a.botKey).localeCompare(String(b.botNickname || b.botKey)) || String(a.symbol).localeCompare(String(b.symbol)));
  }

  async setNickname(discordUserId, laneKey, nickname) {
    const userId = clean(discordUserId);
    const data = await this.load();
    const lane = data.lanesByUserId?.[userId]?.[laneKey];
    if (!lane) return null;
    data.nicknamesByUserId[userId] ||= {};
    data.nicknamesByUserId[userId][laneKey] = clean(nickname);
    lane.botNickname = clean(nickname);
    await this.save(data);
    return lane;
  }

  async findLanes(discordUserId, target = '', { symbol = '', onlyFresh = false } = {}) {
    const query = normalizeToken(target);
    const symbolQuery = normalizeToken(symbol);
    const lanes = await this.listLanes(discordUserId, { includeStale: !onlyFresh });
    return lanes.filter((lane) => {
      if (symbolQuery && symbolQuery !== 'ALL' && lane.symbol !== symbolQuery) return false;
      if (!query || query === 'ALL') return true;
      const hay = [lane.botKey, lane.botLabel, lane.botNickname, lane.symbol, String(lane.magicNumber)].map(normalizeToken).join(' ');
      return hay.includes(query);
    });
  }
}
