import fs from 'node:fs/promises';
import path from 'node:path';

const dataDir = process.env.WISDO_STORAGE_PATH || process.env.DATA_DIR || './data/operator-desks';
const quarantineBytes = Math.max(32, Number(process.env.WISDO_STATE_QUARANTINE_MB || 96)) * 1024 * 1024;
const globalHistoryLimit = Math.max(50, Number(process.env.WISDO_MT4_HISTORY_GLOBAL_LIMIT || 500));
const accountHistoryLimit = Math.max(10, Number(process.env.WISDO_MT4_HISTORY_ACCOUNT_LIMIT || 100));
const signalLimit = Math.max(100, Number(process.env.WISDO_SIGNAL_HISTORY_LIMIT || 500));

function compactHistorySnapshot(snapshot = {}) {
  return {
    accountNumber: String(snapshot.accountNumber || ''), accountName: String(snapshot.accountName || ''), brokerServer: String(snapshot.brokerServer || ''),
    isDemo: Boolean(snapshot.isDemo), eaName: String(snapshot.eaName || ''), eaVersion: String(snapshot.eaVersion || ''),
    balance: Number(snapshot.balance || 0), equity: Number(snapshot.equity || 0), margin: Number(snapshot.margin || 0), freeMargin: Number(snapshot.freeMargin || 0),
    marginLevel: Number(snapshot.marginLevel || 0), floatingPL: Number(snapshot.floatingPL || 0), dailyClosedPL: Number(snapshot.dailyClosedPL || 0),
    openTradeCount: Number(snapshot.openTradeCount || 0), buyTradeCount: Number(snapshot.buyTradeCount || 0), sellTradeCount: Number(snapshot.sellTradeCount || 0),
    totalLots: Number(snapshot.totalLots || 0), symbols: Array.isArray(snapshot.symbols) ? snapshot.symbols.slice(0, 50).map(String) : [],
    timestamp: snapshot.timestamp || null, terminalConnected: snapshot.terminalConnected !== false, expertEnabled: snapshot.expertEnabled !== false,
  };
}

function compactHistory(history = []) {
  const result = [];
  const counts = new Map();
  for (const raw of Array.isArray(history) ? history : []) {
    if (result.length >= globalHistoryLimit) break;
    const accountId = String(raw?.accountId || '');
    const key = accountId || `user:${raw?.discordUserId || ''}`;
    const count = counts.get(key) || 0;
    if (count >= accountHistoryLimit) continue;
    counts.set(key, count + 1);
    result.push({
      discordUserId: String(raw?.discordUserId || ''), channelId: String(raw?.channelId || ''), accountId,
      pairingCode: String(raw?.pairingCode || ''), receivedAt: raw?.receivedAt || new Date().toISOString(),
      copySignalsOpened: Number(raw?.copySignalsOpened || 0), copySignalsClosed: Number(raw?.copySignalsClosed || 0),
      signalSkipped: Boolean(raw?.signalSkipped), signalSkipReason: raw?.signalSkipReason || null,
      snapshot: compactHistorySnapshot(raw?.snapshot || {}),
    });
  }
  return result;
}

function compactTracking(input = {}) {
  const rows = Object.entries(input && typeof input === 'object' ? input : {})
    .sort(([, a], [, b]) => new Date(b?.updatedAt || 0) - new Date(a?.updatedAt || 0))
    .slice(0, Math.max(10, Number(process.env.WISDO_MT4_SIGNAL_TRACKING_ACCOUNT_LIMIT || 250)));
  return Object.fromEntries(rows.map(([accountId, raw]) => {
    const openKeys = Array.isArray(raw?.openKeys) ? raw.openKeys.map(String).filter(Boolean).slice(0, 1000) : [];
    const sourceMap = raw?.tradeKeyToSignalId && typeof raw.tradeKeyToSignalId === 'object' ? raw.tradeKeyToSignalId : {};
    const tradeKeyToSignalId = Object.fromEntries(openKeys.filter((key) => sourceMap[key]).map((key) => [key, String(sourceMap[key])]));
    return [accountId, { openKeys, tradeKeyToSignalId, updatedAt: raw?.updatedAt || null }];
  }));
}

async function atomicWrite(filePath, value) {
  const temp = `${filePath}.${process.pid}.repair.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(value)}\n`, 'utf8');
  await fs.rename(temp, filePath);
}

async function quarantine(filePath, reason) {
  const backup = `${filePath}.quarantined-${Date.now()}`;
  await fs.rename(filePath, backup);
  console.warn(`[prestart] Quarantined ${path.basename(filePath)} (${reason}) -> ${path.basename(backup)}`);
  return backup;
}

async function repairMt4() {
  const filePath = path.join(dataDir, 'mt4.json');
  let stat;
  try { stat = await fs.stat(filePath); } catch { return; }
  if (stat.size > quarantineBytes) {
    await quarantine(filePath, `${(stat.size / 1024 / 1024).toFixed(1)} MB exceeds safe startup threshold`);
    return;
  }
  try {
    const state = JSON.parse(await fs.readFile(filePath, 'utf8'));
    state.snapshotHistory = compactHistory(state.snapshotHistory);
    state.signalTrackingByAccountId = compactTracking(state.signalTrackingByAccountId);
    await atomicWrite(filePath, state);
    const next = await fs.stat(filePath);
    console.log(`[prestart] Repaired mt4.json ${(stat.size / 1024 / 1024).toFixed(2)} MB -> ${(next.size / 1024 / 1024).toFixed(2)} MB`);
  } catch (error) {
    await quarantine(filePath, `parse/repair failure: ${error.message}`);
  }
}

async function repairSignals() {
  const filePath = path.join(dataDir, 'trade-signals.json');
  let stat;
  try { stat = await fs.stat(filePath); } catch { return; }
  if (stat.size > quarantineBytes) {
    await quarantine(filePath, `${(stat.size / 1024 / 1024).toFixed(1)} MB exceeds safe startup threshold`);
    return;
  }
  try {
    const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
    const source = data?.signalsById && typeof data.signalsById === 'object' ? data.signalsById : {};
    const ids = [...new Set([...(Array.isArray(data.signalIds) ? data.signalIds : []), ...Object.keys(source)])]
      .sort((a, b) => new Date(source[b]?.updatedAt || source[b]?.createdAt || 0) - new Date(source[a]?.updatedAt || source[a]?.createdAt || 0))
      .slice(0, signalLimit);
    const signalsById = Object.fromEntries(ids.filter((id) => source[id]).map((id) => [id, source[id]]));
    await atomicWrite(filePath, { signalsById, signalIds: ids.filter((id) => signalsById[id]) });
    const next = await fs.stat(filePath);
    console.log(`[prestart] Repaired trade-signals.json ${(stat.size / 1024 / 1024).toFixed(2)} MB -> ${(next.size / 1024 / 1024).toFixed(2)} MB`);
  } catch (error) {
    await quarantine(filePath, `parse/repair failure: ${error.message}`);
  }
}

await fs.mkdir(dataDir, { recursive: true });
await repairMt4();
await repairSignals();
