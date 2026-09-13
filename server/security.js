import crypto from 'node:crypto';

const VERSION = 'v1';
const MIN_SECRET_LENGTH = 32;
const MAX_SESSION_BYTES = 16 * 1024;
const DEVELOPMENT_SESSION_SECRET = 'wisdo-development-session-secret-change-me';
const ALLOWED_SAME_SITE = new Map([
  ['lax', 'Lax'],
  ['strict', 'Strict'],
  ['none', 'None'],
]);

function isProduction() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function secret() {
  const configured = String(process.env.SESSION_SECRET || '');
  if (configured.length >= MIN_SECRET_LENGTH) return configured;
  if (isProduction()) {
    throw new Error(`SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production.`);
  }
  return configured || DEVELOPMENT_SESSION_SECRET;
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

function normalizedSameSite(value) {
  return ALLOWED_SAME_SITE.get(String(value || 'Lax').toLowerCase()) || 'Lax';
}

function shouldSecureCookie(options = {}) {
  if (options.secure === true) return true;
  if (options.secure === false) return false;
  return isProduction() || String(process.env.PUBLIC_BASE_URL || '').startsWith('https://');
}

export function encodeSignedSession(user, options = {}) {
  if (!user || typeof user !== 'object') throw new TypeError('A session user object is required.');
  const maxAgeSeconds = Number(options.maxAgeSeconds || 60 * 60 * 24 * 30);
  if (!Number.isFinite(maxAgeSeconds) || maxAgeSeconds <= 0) throw new TypeError('maxAgeSeconds must be a positive number.');
  const payload = b64(JSON.stringify({
    user,
    issuedAt: new Date().toISOString(),
    expiresAt: options.expiresAt || new Date(Date.now() + maxAgeSeconds * 1000).toISOString(),
  }));
  if (payload.length > MAX_SESSION_BYTES) throw new Error('Session payload is too large.');
  return `${VERSION}.${payload}.${sign(`${VERSION}.${payload}`)}`;
}

export function decodeSignedSession(value, options = {}) {
  if (!value) return null;
  const raw = String(value);
  if (raw.length > MAX_SESSION_BYTES + 256) return null;

  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  const [version, payload, signature] = parts;
  if (version !== VERSION || !payload || !signature) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]+$/.test(signature)) return null;

  let expectedSignature;
  try {
    expectedSignature = sign(`${version}.${payload}`);
  } catch {
    return null;
  }
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const decoded = JSON.parse(unb64(payload));
    if (!decoded || typeof decoded !== 'object' || !decoded.user || typeof decoded.user !== 'object') return null;
    const expiresAtMs = decoded.expiresAt ? new Date(decoded.expiresAt).getTime() : NaN;
    if (!options.allowExpired && (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now())) return null;
    if (decoded.issuedAt && !Number.isFinite(new Date(decoded.issuedAt).getTime())) return null;
    return decoded.user;
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
    if (!key || key.length > 256) continue;
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
  const cookieName = String(name || '').trim();
  if (!cookieName || /[=;\s]/.test(cookieName)) throw new TypeError('Invalid cookie name.');
  const sameSite = normalizedSameSite(options.sameSite);
  const secure = sameSite === 'None' ? true : shouldSecureCookie(options);
  const attrs = [`${cookieName}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', `SameSite=${sameSite}`];
  if (options.maxAge !== undefined) {
    const maxAge = Number(options.maxAge);
    if (!Number.isFinite(maxAge) || maxAge < 0) throw new TypeError('Cookie maxAge must be a non-negative number.');
    attrs.push(`Max-Age=${Math.floor(maxAge)}`);
  }
  if (secure) attrs.push('Secure');
  res.append('Set-Cookie', attrs.join('; '));
}

export function clearHttpOnlyCookie(res, name, options = {}) {
  const cookieName = String(name || '').trim();
  if (!cookieName || /[=;\s]/.test(cookieName)) throw new TypeError('Invalid cookie name.');
  const sameSite = normalizedSameSite(options.sameSite);
  const secure = sameSite === 'None' ? true : shouldSecureCookie(options);
  res.append('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0${secure ? '; Secure' : ''}`);
}

export function safeReturnPath(value = '', fallback = '/app/dashboard') {
  const raw = String(value || '').trim();
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('://') || raw.includes('\\')) return fallback;
  if (/[%]0[0ad]/i.test(raw) || /[\u0000-\u001F\u007F]/.test(raw)) return fallback;
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
  if (keyText.length < MIN_SECRET_LENGTH) throw new Error(`ENCRYPTION_KEY must be at least ${MIN_SECRET_LENGTH} characters before broker credentials can be stored.`);
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
  if (keyText.length < MIN_SECRET_LENGTH) throw new Error('ENCRYPTION_KEY is not configured.');
  const key = crypto.createHash('sha256').update(keyText).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  const decoded = Buffer.concat([decipher.update(Buffer.from(bodyText, 'base64url')), decipher.final()]).toString('utf8');
  return JSON.parse(decoded);
}

export function sessionSecurityStatus() {
  const sessionSecretConfigured = String(process.env.SESSION_SECRET || '').length >= 32;
  return {
    signedSessions: true,
    strictSignedSessions: true,
    legacyUnsignedSessionsAccepted: false,
    isolatedSessionSecret: true,
    productionSecretConfigured: sessionSecretConfigured,
    sessionSecretConfigured,
    credentialEncryptionConfigured: String(process.env.ENCRYPTION_KEY || '').length >= MIN_SECRET_LENGTH,
  };
}
