import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getSessionUser } from './security.js';

const MAX_DEVICES = 5;
const MAX_SPOKEN_CHARS = 500;
const PAIRING_LIFETIME_DAYS = 30;
const REQUESTS_PER_MINUTE = 20;
const DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function bearerToken(req) {
  const match = /^Bearer\s+([A-Za-z0-9_-]{32,256})$/i.exec(String(req.headers?.authorization || ''));
  return match?.[1] || '';
}

function noStore(res) {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  return res;
}

function sameSiteRequest(req) {
  const origin = req.headers?.origin;
  if (!origin) return true; // Apple Shortcuts sends no browser Origin header.
  const base = process.env.PUBLIC_BASE_URL || process.env.WISDO_PUBLIC_BASE_URL;
  if (!base) return false; // Fail closed unless production's public origin is configured.
  try { return new URL(origin).origin === new URL(base).origin; } catch { return false; }
}

function requireBrowserUser(req, res, next) {
  const user = getSessionUser(req);
  if (!user?.id) return noStore(res).status(401).json({ ok: false, error: 'Sign in to WISDO before pairing your iPhone.' });
  if (!sameSiteRequest(req)) return noStore(res).status(403).json({ ok: false, error: 'Untrusted request origin.' });
  req.siriUser = user;
  next();
}

function currency(value, code = 'USD') {
  if (value == null || value === '') return 'unavailable';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'unavailable';
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${amount.toFixed(2)} ${code}`; }
}

export function formatTradingStatus(snapshot) {
  if (!snapshot?.account) {
    const count = snapshot?.accounts?.length || 0;
    if (count > 1) return `I found ${count} accessible MT4 accounts but no primary account is selected. Choose a primary account on your WISDO Accounts page.`;
    return 'There is no connected primary MT4 account with a verified Reporter snapshot. Open WISDO Accounts to link your account.';
  }
  const name = snapshot.account.nickname || 'MT4';
  const reporter = snapshot.executionHealth?.reporter || 'DISCONNECTED';
  if (reporter !== 'LIVE') return `${name}: the Reporter is ${reporter.toLowerCase()}. I cannot confirm live equity or positions until fresh MT4 data arrives.`;
  const positionCount = Array.isArray(snapshot.campaigns)
    ? snapshot.campaigns.reduce((sum, campaign) => sum + Number(campaign.positionCount || 0), 0) : 0;
  const financial = snapshot.financial || {};
  const code = financial.currency || 'USD';
  const equity = currency(financial.equity, code);
  const floating = currency(financial.floatingPL, code);
  return `${name}: Reporter is live. Last reported equity ${equity}, floating profit and loss ${floating}, and ${positionCount} open ${positionCount === 1 ? 'position' : 'positions'}. This is a snapshot, not an execution receipt.`;
}

export function classifySiriCommand(text) {
  const said = String(text || '').trim().replace(/\s+/g, ' ');
  if (!said || said.length > MAX_SPOKEN_CHARS) return { kind: 'INVALID' };
  // Never allow unreviewed Siri language to enter the trading or home-action execution pipeline.
  // Read-only commands containing an action verb still fail closed.
  if (/\b(?:buy|sell|close|liquidate|place|execute|pause|resume|arm|disarm|unlock|lock|withdraw|transfer|hedge|delete|deploy|stop|start|enable|disable|reset|cancel|add|remove|adjust|modify|change|set)\b|\bturn\s+(?:on|off)\b/i.test(said)) {
    return { kind: 'APPROVAL_REQUIRED' };
  }
  if (/\b(?:camera|cameras|surveillance|front door video|backyard video|security feed)\b/i.test(said)) return { kind: 'CAMERAS' };
  if (/\b(?:prism|holo|hologram|aether|world)\b/i.test(said) && /\b(?:open|show|launch|view|go to|display)\b/i.test(said)) return { kind: 'PRISM' };
  if (/\b(?:home dashboard|smart home|home control)\b/i.test(said)) return { kind: 'SMART_HOME' };
  if (/\b(?:open|show|launch|view|go to)\b/i.test(said) && /\b(?:trading|trade|mt4|account|command center)\b/i.test(said)) return { kind: 'TRADING_DASHBOARD' };
  if (/\b(?:equity|balance|profit|loss|p\s*(?:and|&)\s*l|pnl|positions?|exposure|drawdown|account|trades?|trading|reporter|gold|xauusd|status)\b/i.test(said)) return { kind: 'TRADING_STATUS' };
  if (/\b(?:open|show|launch|view|go to)\b/i.test(said) && /\b(?:wisdo|dashboard|website|portal)\b/i.test(said)) return { kind: 'WISDO_DASHBOARD' };
  if (/\b(?:hello|hey|help|what can you do|commands)\b/i.test(said)) return { kind: 'HELP' };
  return { kind: 'UNSUPPORTED' };
}

function baseUrl() {
  const configured = String(process.env.PUBLIC_BASE_URL || process.env.WISDO_PUBLIC_BASE_URL || '').trim();
  try { return configured && new URL(configured).protocol === 'https:' ? new URL(configured).origin : ''; }
  catch { return ''; }
}

function routeUrl(path) {
  const origin = baseUrl();
  return origin ? `${origin}${path}` : null;
}

function htmlPage() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WISDO Siri Control</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:640px;margin:36px auto;padding:0 18px;color:#eaf6ff;background:#091624}article{border:1px solid #31516b;border-radius:14px;padding:20px;background:#122439}button{border:0;background:#61e6d0;color:#082025;padding:12px 16px;border-radius:10px;font-weight:700;margin:6px 6px 6px 0}code,pre{display:block;white-space:pre-wrap;overflow-wrap:anywhere;background:#071321;padding:14px;border-radius:8px}input{background:#091624;border:1px solid #53728c;color:#fff;padding:10px;width:90%;border-radius:8px}small{color:#bdd6e7}a{color:#64dfcf}</style></head><body><h1>WISDO Siri Control</h1><p>Pair this iPhone to ask Siri for verified MT4 status and open WISDO dashboards. Trade execution and security changes require on-screen approval.</p><article><h2>Pair your iPhone</h2><label>Device name <input id="name" value="My iPhone" maxlength="80"></label><p><button id="pair">Generate 30-day device credentials</button></p><div id="result" role="status">No device credentials created.</div><p><small>Save the Device ID and Access Token privately in your Apple Shortcut. The token is displayed only once. Never share screenshots of it.</small></p><h3>Paired devices</h3><div id="devices"></div></article><h2>iPhone setup</h2><p>In Apple Shortcuts, create <strong>WISDO Control</strong>. Add <strong>Dictate Text</strong>, then <strong>Get Contents of URL</strong> as POST with a JSON body containing <code>text = Dictated Text</code>. Use URL <code>${routeUrl('/api/siri/v1/command') || 'Your HTTPS WISDO origin + /api/siri/v1/command'}</code> and headers <code>Authorization: Bearer [your access token]\nX-WISDO-Siri-Device: [your device ID]</code>. Then get dictionary value <strong>spokenText</strong> from the response and use <strong>Speak Text</strong>.</p><p><a href="/member/command-center">Trading Command Center</a></p><script>const out=document.querySelector('#result');async function refresh(){const r=await fetch('/api/siri/v1/devices',{credentials:'same-origin'});const j=await r.json();document.querySelector('#devices').textContent=j.ok?(j.devices.length?j.devices.map(d=>d.name+' — expires '+new Date(d.expiresAt).toLocaleDateString()+' — '+(d.revokedAt?'revoked':'active')).join(' | '):'No devices paired yet.'):(j.error||'Unavailable');}document.querySelector('#pair').onclick=async()=>{out.textContent='Pairing...';try{const r=await fetch('/api/siri/v1/pair',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({name:document.querySelector('#name').value})});const j=await r.json();if(!r.ok)throw Error(j.error||'Could not pair');out.textContent='Device ID: '+j.deviceId+'\\nAccess Token: '+j.accessToken+'\\nExpires: '+j.expiresAt;out.style.whiteSpace='pre-wrap';refresh();}catch(e){out.textContent=e.message;}};refresh();</script></body></html>`;
}

/**
 * iPhone-only, read-only voice boundary. Tokens are separate from WISDO desktop/Pi
 * devices and cannot authenticate against /api/device/v1 or /api/voice/v1.
 */
export function registerSiriControlRoutes(app, { pool, worldCommandService, logger = console } = {}) {
  if (!app?.get || !app?.post || !app?.delete) throw new TypeError('Express app is required.');
  if (!pool?.query) throw new TypeError('WISDO PostgreSQL connection is required.');
  let preparePromise = null;
  const ensureTable = () => {
    if (!preparePromise) preparePromise = pool.query(`CREATE TABLE IF NOT EXISTS wisdo_siri_devices (
      device_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, name TEXT NOT NULL,
      token_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ, last_used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`).catch(error => { preparePromise = null; throw error; });
    return preparePromise;
  };
  const rate = new Map();
  const allowedRate = id => {
    const now = Date.now();
    if (rate.size > 2000) rate.clear();
    const item = rate.get(id);
    const next = item && item.until > now ? item : { count: 0, until: now + 60_000 };
    next.count++; rate.set(id, next);
    return next.count <= REQUESTS_PER_MINUTE;
  };
  const failure = (res, error) => {
    logger?.warn?.('WISDO Siri Control request failed', { code: error.code || 'internal_error', message: error.message });
    return noStore(res).status(error.statusCode || 503).json({ ok: false, spokenText: 'WISDO Siri Control is unavailable. No actions were taken.', code: error.code || 'siri_unavailable' });
  };
  const requireJson = (req, res, next) => {
    if (!/^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type'] || ''))) {
      return noStore(res).status(415).json({ ok: false, error: 'JSON request required.' });
    }
    next();
  };
  app.get('/member/siri-control', (req, res) => {
    if (!getSessionUser(req)?.id) return res.status(401).type('html').send('<h1>Please sign in to WISDO before pairing Siri.</h1>');
    if (!baseUrl()) return res.status(503).type('html').send('<h1>Configure PUBLIC_BASE_URL with your WISDO HTTPS origin first.</h1>');
    noStore(res).set('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'").type('html').send(htmlPage());
  });
  app.get('/api/siri/v1/health', (_req, res) => noStore(res).json({ ok: true, name: 'WISDO Siri Control', mode: 'read-only', pairing: 'signed-in-browser', liveTradeExecution: false, homeSecurityExecution: false }));
  app.post('/api/siri/v1/pair', requireBrowserUser, requireJson, async (req, res) => {
    try {
      await ensureTable();
      const name = String(req.body?.name || 'My iPhone').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 80) || 'My iPhone';
      const count = await pool.query('SELECT COUNT(*)::int AS count FROM wisdo_siri_devices WHERE owner_user_id=$1 AND revoked_at IS NULL AND expires_at>NOW()', [String(req.siriUser.id)]);
      if (Number(count.rows[0]?.count || 0) >= MAX_DEVICES) return noStore(res).status(409).json({ ok: false, error: `Maximum ${MAX_DEVICES} active iPhones. Revoke an older device first.` });
      const deviceId = randomUUID();
      const accessToken = randomBytes(32).toString('base64url');
      const expiry = new Date(Date.now() + PAIRING_LIFETIME_DAYS * 86400_000).toISOString();
      await pool.query('INSERT INTO wisdo_siri_devices (device_id,owner_user_id,name,token_hash,expires_at) VALUES($1,$2,$3,$4,$5)', [deviceId, String(req.siriUser.id), name, hashToken(accessToken), expiry]);
      noStore(res).status(201).json({ ok: true, deviceId, accessToken, expiresAt: expiry, name });
    } catch (error) { failure(res, error); }
  });
  app.get('/api/siri/v1/devices', requireBrowserUser, async (req, res) => {
    try {
      await ensureTable();
      const result = await pool.query('SELECT device_id,name,expires_at,revoked_at,last_used_at,created_at FROM wisdo_siri_devices WHERE owner_user_id=$1 ORDER BY created_at DESC LIMIT 20', [String(req.siriUser.id)]);
      noStore(res).json({ ok: true, devices: result.rows.map(r => ({ deviceId: r.device_id, name: r.name, expiresAt: r.expires_at, revokedAt: r.revoked_at, lastUsedAt: r.last_used_at, createdAt: r.created_at })) });
    } catch (error) { failure(res, error); }
  });
  app.delete('/api/siri/v1/devices/:deviceId', requireBrowserUser, async (req, res) => {
    try {
      await ensureTable();
      if (!DEVICE_ID_PATTERN.test(req.params.deviceId)) return noStore(res).status(400).json({ ok: false, error: 'Invalid device ID.' });
      const result = await pool.query('UPDATE wisdo_siri_devices SET revoked_at=NOW() WHERE device_id=$1 AND owner_user_id=$2 AND revoked_at IS NULL RETURNING device_id', [req.params.deviceId, String(req.siriUser.id)]);
      noStore(res).json({ ok: true, revoked: result.rowCount > 0 });
    } catch (error) { failure(res, error); }
  });
  app.post('/api/siri/v1/command', requireJson, async (req, res) => {
    try {
      if (!baseUrl()) return noStore(res).status(503).json({ ok: false, spokenText: 'WISDO public HTTPS URL is not configured.' });
      const deviceId = String(req.headers['x-wisdo-siri-device'] || '');
      const token = bearerToken(req);
      if (!DEVICE_ID_PATTERN.test(deviceId) || !token) return noStore(res).status(401).json({ ok: false, spokenText: 'Pair your iPhone with WISDO before using Siri.' });
      await ensureTable();
      const found = await pool.query('SELECT device_id,owner_user_id,name FROM wisdo_siri_devices WHERE device_id=$1 AND token_hash=$2 AND revoked_at IS NULL AND expires_at>NOW() LIMIT 1', [deviceId, hashToken(token)]);
      const device = found.rows[0];
      if (!device) return noStore(res).status(401).json({ ok: false, spokenText: 'Your WISDO Siri pairing has expired or was revoked. Pair it again on the website.' });
      if (!allowedRate(deviceId)) return noStore(res).status(429).json({ ok: false, spokenText: 'Too many requests. Please try again in a minute.' });
      const text = req.body?.text;
      if (typeof text !== 'string') return noStore(res).status(400).json({ ok: false, spokenText: 'I could not understand the spoken command.' });
      const intent = classifySiriCommand(text);
      if (intent.kind === 'INVALID') return noStore(res).status(400).json({ ok: false, spokenText: 'Try a shorter voice command.' });
      await pool.query('UPDATE wisdo_siri_devices SET last_used_at=NOW() WHERE device_id=$1', [deviceId]).catch(() => undefined);
      const url = kind => routeUrl({ APPROVAL_REQUIRED: '/member/command-center', CAMERAS: '/app/world', PRISM: '/app/world', SMART_HOME: '/app/world', TRADING_DASHBOARD: '/member/command-center', WISDO_DASHBOARD: '/member/command-center', TRADING_STATUS: '/member/accounts' }[kind]);
      const reply = (kind, spokenText, extras = {}) => noStore(res).json({ ok: true, kind, spokenText, openUrl: url(kind) || null, executed: false, ...extras });
      if (intent.kind === 'APPROVAL_REQUIRED') return reply('APPROVAL_REQUIRED', 'I can open WISDO for you to review this request. No trading or home security changes were made.');
      if (intent.kind === 'CAMERAS') return reply('CAMERAS', 'Opening your WISDO world. Camera viewing requires an authorized connected camera feed; I cannot confirm that one is available.');
      if (intent.kind === 'PRISM') return reply('PRISM', 'Opening the WISDO world for PRISM.');
      if (intent.kind === 'SMART_HOME') return reply('SMART_HOME', 'Opening the WISDO smart home view. I have not changed any devices.');
      if (intent.kind === 'TRADING_DASHBOARD') return reply('TRADING_DASHBOARD', 'Opening your WISDO trading command center.');
      if (intent.kind === 'WISDO_DASHBOARD') return reply('WISDO_DASHBOARD', 'Opening WISDO.');
      if (intent.kind === 'TRADING_STATUS') {
        if (!worldCommandService?.state) return noStore(res).status(503).json({ ok: false, spokenText: 'The trading status service is unavailable. No trading actions were taken.' });
        const snapshot = await worldCommandService.state(String(device.owner_user_id), {});
        return reply('TRADING_STATUS', formatTradingStatus(snapshot), { reporterStatus: snapshot?.executionHealth?.reporter || 'DISCONNECTED' });
      }
      if (intent.kind === 'HELP') return reply('HELP', 'Try: check my MT4 status, open PRISM, show my trading dashboard, or open my cameras. Trades and security changes require confirmation in WISDO.');
      return reply('UNSUPPORTED', 'I can check your MT4 account status and open WISDO dashboards. This request is not connected yet. No actions were taken.');
    } catch (error) { failure(res, error); }
  });
  return { api: '/api/siri/v1', pairingPage: '/member/siri-control', mode: 'read-only' };
}
