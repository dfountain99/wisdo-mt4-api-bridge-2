export function slugify(value = '') {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
export function cleanBotName(value = '') { return String(value).trim().replace(/\s+/g, ' '); }
export function inferBotProfile(bot = {}) {
  const name = `${bot.name || bot.title || ''}`.toLowerCase();
  if (name.includes('gold') || name.includes('xau')) return 'Gold / XAUUSD';
  if (name.includes('scalp')) return 'Scalping';
  if (name.includes('swing')) return 'Swing';
  return 'General trading';
}
export function formatUsd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '$0.00';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
export function parseBotSelection(value = '') {
  return String(value).split(',').map(cleanBotName).filter(Boolean);
}
export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${Number(count) === 1 ? singular : plural}`;
}
