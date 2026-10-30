import { createHash } from 'node:crypto';

const validNumber = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const iso = (value) => {
  const time = Date.parse(String(value || ''));
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
};

/**
 * An observation is a read-only, provenance-carrying projection of MT4 state.
 * Grade B is a fresh Reporter observation, never a broker execution receipt.
 * No trading decisions or synthetic balances are produced here.
 */
export function buildAetherObservation(snapshot = {}) {
  const account = snapshot.account || null;
  const health = snapshot.executionHealth || {};
  const receivedAt = iso(health.lastSyncAt);
  const ageMs = receivedAt ? Math.max(0, Date.now() - Date.parse(receivedAt)) : null;
  const connection = !account || ageMs === null ? 'UNAVAILABLE'
    : health.reporter === 'LIVE' && ageMs <= 90_000 ? 'LIVE'
    : ageMs <= 300_000 ? 'STALE' : 'OFFLINE';
  const grade = connection === 'LIVE' ? 'B' : connection === 'STALE' ? 'D' : 'U';
  const financial = snapshot.financial || {};
  const fields = Object.fromEntries(
    ['balance', 'equity', 'floatingPL', 'margin', 'freeMargin', 'marginLevel'].map((key) => [key, {
      value: validNumber(financial[key]) ? Number(financial[key]) : null,
      source: validNumber(financial[key]) ? 'mt4_reporter' : 'unavailable',
      grade: validNumber(financial[key]) ? grade : 'U',
    }]),
  );
  const campaigns = (Array.isArray(snapshot.campaigns) ? snapshot.campaigns : []).map((row) => ({
    campaignId: String(row.campaignId || ''),
    symbol: String(row.symbol || ''),
    direction: String(row.direction || ''),
    identitySource: row.campaignIdentitySource === 'backend_campaign' ? 'ea_explicit' : 'derived_grouping',
    identityVerified: row.campaignIdentitySource === 'backend_campaign',
    positionCount: Number(row.positionCount || 0),
    tickets: (row.positions || []).map((position) => String(position.ticket || '')).filter(Boolean).sort(),
  }));
  const fingerprintPayload = JSON.stringify({
    accountId: account?.accountId || null,
    receivedAt,
    campaigns: campaigns.map(({ campaignId, tickets }) => ({ campaignId, tickets })),
  });
  const fingerprint = createHash('sha256').update(fingerprintPayload).digest('hex');
  return {
    version: 1,
    accountId: account?.accountId || null,
    receivedAt,
    ageMs,
    connection,
    confidenceGrade: grade,
    authority: 'reporter_observation_not_broker_receipt',
    commandLinkReady: health.commandLinkReady === true && connection === 'LIVE',
    eaReceiverReady: health.commandLinkReady === true && connection === 'LIVE' && snapshot.campaignControl?.live === true,
    fields,
    campaigns,
    fingerprint,
    missingCriticalFields: ['balance', 'equity', 'marginLevel'].filter((key) => fields[key].value === null),
  };
}
