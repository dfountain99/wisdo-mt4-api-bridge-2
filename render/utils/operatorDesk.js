export function formatCurrency(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '$0.00';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00%';
  return `${n.toFixed(2)}%`;
}

export function normalizeYesNo(value) {
  const s = String(value || '').trim().toLowerCase();
  if (['yes', 'y', 'true', '1', 'on'].includes(s)) return true;
  if (['no', 'n', 'false', '0', 'off'].includes(s)) return false;
  return null;
}

export function parseNumericValue(value, fallback = null) {
  const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!match) return fallback;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : fallback;
}

export function parseStructuredInput(input = '', schema = null) {
  if (Array.isArray(schema)) {
    const lines = String(input || '').replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
    const result = Object.fromEntries(schema.map((item) => [item.key, '']));
    const unmatched = [];

    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (!match) {
        unmatched.push(line);
        continue;
      }
      const label = match[1].trim().toLowerCase();
      const value = match[2].trim();
      const target = schema.find((item) => item.labels.some((known) => known.toLowerCase() === label));
      if (target) result[target.key] = value;
      else unmatched.push(line);
    }

    if (unmatched.length > 0) {
      for (const item of schema) {
        if (!result[item.key]) result[item.key] = unmatched.shift() || '';
      }
    }
    return result;
  }

  const result = {};
  for (const line of String(input || '').split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    result[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
  }
  return result;
}

export function sanitizeChannelSegment(input, fallback = 'student') {
  const normalized = String(input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (normalized || fallback).slice(0, 80);
}

function getNameFromMemberLike(memberOrName, userId) {
  if (memberOrName && typeof memberOrName === 'object') {
    return memberOrName.displayName || memberOrName.user?.globalName || memberOrName.user?.username || memberOrName.username || memberOrName.tag?.split('#')[0] || memberOrName.id || userId;
  }
  return memberOrName || userId;
}

export function buildDeskChannelName(memberOrName, userId = '') {
  const name = getNameFromMemberLike(memberOrName, userId);
  const resolvedUserId = (memberOrName && typeof memberOrName === 'object' ? memberOrName.id : userId) || '';
  const fallback = `student-${String(resolvedUserId).slice(-4) || 'member'}`;
  const segment = sanitizeChannelSegment(name, fallback);
  return `cc-desk-${segment}`.slice(0, 100);
}

export function buildVoiceChannelName(memberOrName, userId = '') {
  const name = getNameFromMemberLike(memberOrName, userId);
  const resolvedUserId = (memberOrName && typeof memberOrName === 'object' ? memberOrName.id : userId) || '';
  const fallback = `student-${String(resolvedUserId).slice(-4) || 'member'}`;
  const segment = sanitizeChannelSegment(name, fallback);
  return `live-bot-${segment}`.slice(0, 100);
}

export function buildArchivedChannelName(nameOrMember) {
  const base = typeof nameOrMember === 'string' ? nameOrMember : buildDeskChannelName(nameOrMember);
  return `archived-${base}`.slice(0, 100);
}

export function buildDeskTopic(userId) {
  return `Culture Coin Desk | userId:${userId}`;
}

export function extractDeskUserId(input = '') {
  const topic = typeof input === 'string' ? input : input?.topic || '';
  const match = String(topic).match(/userId:(\d{5,25})/i) || String(topic).match(/user:([0-9]{5,25})/i) || String(topic).match(/deskUserId=([0-9]{5,25})/i);
  return match?.[1] || null;
}

export function chunkNames(names = [], maxLength = 900) {
  const chunks = [];
  let current = '';
  for (const name of names) {
    const next = current ? `${current}, ${name}` : String(name);
    if (next.length > maxLength) {
      if (current) chunks.push(current);
      current = String(name);
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
