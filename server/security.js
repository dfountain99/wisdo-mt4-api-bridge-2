import crypto from 'node:crypto';

const VERSION = 'v1';

function secret() {
  return String(
    process.env.SESSION_SECRET ||
    process.env.ENCRYPTION_KEY ||
    process.env.DISCORD_CLIENT_SECRET ||
    process.env.CLIENT_SECRET ||
    process.env.MT4_SYNC_API_KEY ||
    'wisdo-development-session-secret-change-me',
  );
}

function b64(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function unb64(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function encodeSignedSession(user, options = {}) {
  const payload = b64(JSON.stringify({
    user,
    issuedAt: new Date().toISOString(),
    expiresAt: options.expiresAt || new Date(Date.now() + Number(options.maxAgeSeconds || 60 * 60 * 24 * 30) * 1000).toISOString(),
  }));
  return `${VERSION}.${payload}.${sign(`${VERSION}.${payload}`)}`;
}

export function decodeSignedSession(value, options = {}) {
  if (!value) return null;
  const raw = String(value);
  if (raw.startsWith(`${VERSION}.`)) {
    const [version, payload, signature] = raw.split('.');
    if (!payload || !signature || !safeEqual(signature, sign(`${version}.${payload}`))) return null;
    try {
      const decoded = JSON.parse(unb64(payload));
      if (!options.allowExpired && decoded.expiresAt && new Date(decoded.expiresAt).getTime() < Date.now()) return null;
      return decoded.user || null;
    } catch {
      return null;
    }
  }

  // One-release compatibility path for sessions created by the original source ZIP.
  try {
    return JSON.parse(unb64(raw))?.user || null;
  } catch {
    return null;
  }
}

export function parseCookies(req) {
  const header = req?.headers?.cookie || '';
  const output = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    try { output[key] = decodeURIComponent(value); } catch { output[key] = value; }
  }
  return output;
}

export function getSessionUser(req) {
  const cookies = parseCookies(req);
  return decodeSignedSession(cookies.cc_user || cookies.wisdo_user || cookies.wisdo_session || '');
}

export function setHttpOnlyCookie(res, name, value, options = {}) {
  const attrs = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', `SameSite=${options.sameSite || 'Lax'}`];
  if (options.maxAge !== undefined) attrs.push(`Max-Age=${Number(options.maxAge)}`);
  const secure = options.secure === true || (options.secure !== false && (process.env.NODE_ENV === 'production' || String(process.env.PUBLIC_BASE_URL || '').startsWith('https://')));
  if (secure) attrs.push('Secure');
  res.append('Set-Cookie', attrs.join('; '));
}

export function clearHttpOnlyCookie(res, name) {
  res.append('Set-Cookie', `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}

export function safeReturnPath(value = '', fallback = '/app/dashboard') {
  const raw = String(value || '').trim();
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('://') || raw.includes('\\')) return fallback;
  return raw;
}

export function verifyHmacSha256({ rawBody, signature, secretValue }) {
  const key = String(secretValue || '');
  if (!key || !signature) return false;
  const expectedHex = crypto.createHmac('sha256', key).update(rawBody).digest('hex');
  const expectedB64 = crypto.createHmac('sha256', key).update(rawBody).digest('base64');
  const supplied = String(signature).replace(/^sha256=/i, '').trim();
  return safeEqual(supplied, expectedHex) || safeEqual(supplied, expectedB64);
}

export function encryptCredential(value, keyValue = process.env.ENCRYPTION_KEY) {
  if (!value) return '';
  const keyText = String(keyValue || '');
  if (keyText.length < 32) throw new Error('ENCRYPTION_KEY must be at least 32 characters before broker credentials can be stored.');
  const key = crypto.createHash('sha256').update(keyText).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `gcm1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptCredential(value, keyValue = process.env.ENCRYPTION_KEY) {
  if (!value) return null;
  const [version, ivText, tagText, bodyText] = String(value).split('.');
  if (version !== 'gcm1') throw new Error('Unsupported encrypted credential format.');
  const keyText = String(keyValue || '');
  if (keyText.length < 32) throw new Error('ENCRYPTION_KEY is not configured.');
  const key = crypto.createHash('sha256').update(keyText).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  const decoded = Buffer.concat([decipher.update(Buffer.from(bodyText, 'base64url')), decipher.final()]).toString('utf8');
  return JSON.parse(decoded);
}

export function sessionSecurityStatus() {
  const configured = Boolean(process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY || process.env.DISCORD_CLIENT_SECRET || process.env.CLIENT_SECRET);
  return {
    signedSessions: true,
    productionSecretConfigured: configured,
    credentialEncryptionConfigured: String(process.env.ENCRYPTION_KEY || '').length >= 32,
  };
}
