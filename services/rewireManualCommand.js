import crypto from 'node:crypto';
/** Scope-checked manual WISDO campaign command for the Rewire V6.11 mailbox.
 *  Never translates ordinary commentary into a market order. */
export function normalizeRewireSonicBlast(input = {}, now = Date.now()) {
  const action = String(input.action || input.intent || input.command || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const text = String(input.rawText || input.rawCommand || input.text || input.message || '').trim();
  const voiceMatch = /\b(?:sonic|signet)\s+(?:blast|burst)(?:\s+(?:buy|sell|now))?\b/i.test(text);
  const explicit = ['sonic_blast','sonic_burst','signet_blast','signet_burst'].includes(action);
  const confirm = action === 'wisdo_campaign' && Number(input.operation) === 12 && voiceMatch;
  if (!(voiceMatch || explicit || confirm)) return null;
  const symbol = String(input.symbol || input.targetSymbol || '').trim();
  const magicNumber = Number(input.magicNumber ?? input.magic ?? 0);
  const errors = [];
  if (!symbol || !/^[A-Za-z0-9._-]{3,30}$/.test(symbol)) errors.push('Exact broker symbol is required.');
  if (!Number.isSafeInteger(magicNumber) || magicNumber <= 0) errors.push('Exact HIGHTOWER MagicNumber is required.');
  if (!String(input.accountId || '').trim()) errors.push('Select your paired WISDO account.');
  const directionText = String(input.side || input.direction || '').toLowerCase();
  const direction = directionText === 'buy' || /\bbuy\b/i.test(text) ? 1 : directionText === 'sell' || /\bsell\b/i.test(text) ? -1 : 0;
  const burstCount = Math.max(1,Math.min(3,Math.floor(Number(input.burstCount || input.count || 2)) || 2));
  const requestId = now * 1000 + crypto.randomInt(1,1000);
  return {command:'WISDO_CAMPAIGN',operation:12,burstCount,durationSeconds:30,
    requestedDirection:direction,symbol,magicNumber,eaCampaignId:0,
    requestId,expiresEpoch:Math.floor(now/1000)+60,rewireValidationError:errors.join(' ')};
}
