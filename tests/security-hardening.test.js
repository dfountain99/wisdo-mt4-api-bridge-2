import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  clearHttpOnlyCookie,
  decodeSignedSession,
  decryptCredential,
  encodeSignedSession,
  encryptCredential,
  parseCookies,
  safeReturnPath,
  sessionSecurityStatus,
  setHttpOnlyCookie,
  verifyHmacSha256,
} from '../server/security.js';

function withEnv(values, callback) {
  const before = {};
  for (const [key, value] of Object.entries(values)) {
    before[key] = process.env[key];
    if (value === undefined || value === null) delete process.env[key];
    else process.env[key] = String(value);
  }
  try {
    return callback();
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const TEST_SESSION_SECRET = 'session-secret-for-tests-that-is-long-enough-123';
const TEST_ENCRYPTION_KEY = 'encryption-key-for-tests-that-is-long-enough-123';

test('signed sessions round-trip and tampering fails closed', () => {
  withEnv({ NODE_ENV: 'test', SESSION_SECRET: TEST_SESSION_SECRET }, () => {
    const token = encodeSignedSession({ id: 'user-1', username: 'operator' }, { maxAgeSeconds: 60 });
    assert.deepEqual(decodeSignedSession(token), { id: 'user-1', username: 'operator' });

    const [version, payload, signature] = token.split('.');
    const replacement = signature.endsWith('A') ? `${signature.slice(0, -1)}B` : `${signature.slice(0, -1)}A`;
    assert.equal(decodeSignedSession(`${version}.${payload}.${replacement}`), null);
    assert.equal(decodeSignedSession(`${version}.${payload}`), null);
  });
});

test('legacy unsigned session payloads are rejected', () => {
  withEnv({ NODE_ENV: 'test', SESSION_SECRET: TEST_SESSION_SECRET }, () => {
    const legacy = Buffer.from(JSON.stringify({ user: { id: 'attacker' } }), 'utf8').toString('base64url');
    assert.equal(decodeSignedSession(legacy), null);
  });
});

test('expired sessions fail closed unless an explicit diagnostic override is used', () => {
  withEnv({ NODE_ENV: 'test', SESSION_SECRET: TEST_SESSION_SECRET }, () => {
    const token = encodeSignedSession(
      { id: 'user-2' },
      { expiresAt: new Date(Date.now() - 10_000).toISOString(), maxAgeSeconds: 60 },
    );
    assert.equal(decodeSignedSession(token), null);
    assert.deepEqual(decodeSignedSession(token, { allowExpired: true }), { id: 'user-2' });
  });
});

test('production session signing requires a dedicated strong SESSION_SECRET', () => {
  withEnv({ NODE_ENV: 'production', SESSION_SECRET: 'short', ENCRYPTION_KEY: TEST_ENCRYPTION_KEY, CLIENT_SECRET: 'another-long-secret-that-must-not-be-used' }, () => {
    assert.throws(() => encodeSignedSession({ id: 'user-3' }), /SESSION_SECRET must be at least 32 characters/);
    assert.equal(decodeSignedSession('v1.e30.invalid'), null);
    const status = sessionSecurityStatus();
    assert.equal(status.sessionSecretConfigured, false);
    assert.equal(status.legacyUnsignedSessionsAccepted, false);
    assert.equal(status.isolatedSessionSecret, true);
  });
});

test('cookie helpers enforce safe names, HttpOnly, SameSite and production Secure', () => {
  withEnv({ NODE_ENV: 'production', PUBLIC_BASE_URL: 'https://wisdo.example', SESSION_SECRET: TEST_SESSION_SECRET }, () => {
    const headers = [];
    const res = { append(name, value) { headers.push([name, value]); } };
    setHttpOnlyCookie(res, 'wisdo_user', 'abc 123', { maxAge: 120, sameSite: 'Strict' });
    clearHttpOnlyCookie(res, 'wisdo_user');

    assert.match(headers[0][1], /^wisdo_user=abc%20123;/);
    assert.match(headers[0][1], /HttpOnly/);
    assert.match(headers[0][1], /SameSite=Strict/);
    assert.match(headers[0][1], /Secure/);
    assert.match(headers[0][1], /Max-Age=120/);
    assert.match(headers[1][1], /Max-Age=0/);
    assert.match(headers[1][1], /Secure/);
    assert.throws(() => setHttpOnlyCookie(res, 'bad;name', 'x'), /Invalid cookie name/);
  });
});

test('SameSite=None cookies are always Secure even outside production', () => {
  withEnv({ NODE_ENV: 'test', PUBLIC_BASE_URL: '', SESSION_SECRET: TEST_SESSION_SECRET }, () => {
    const headers = [];
    const res = { append(_name, value) { headers.push(value); } };
    setHttpOnlyCookie(res, 'wisdo_user', 'value', { sameSite: 'None', secure: false });
    assert.match(headers[0], /SameSite=None/);
    assert.match(headers[0], /Secure/);
  });
});

test('cookie parsing tolerates malformed encoding and rejects absurd cookie names', () => {
  const parsed = parseCookies({ headers: { cookie: `normal=value; encoded=hello%20world; ${'x'.repeat(300)}=ignored; malformed=%E0%A4%A` } });
  assert.equal(parsed.normal, 'value');
  assert.equal(parsed.encoded, 'hello world');
  assert.equal(parsed.malformed, '%E0%A4%A');
  assert.equal(Object.keys(parsed).some((key) => key.length > 256), false);
});

test('safe return paths reject external, backslash and control-character redirects', () => {
  assert.equal(safeReturnPath('/member/command-center'), '/member/command-center');
  assert.equal(safeReturnPath('//evil.example'), '/app/dashboard');
  assert.equal(safeReturnPath('https://evil.example'), '/app/dashboard');
  assert.equal(safeReturnPath('/\\evil.example'), '/app/dashboard');
  assert.equal(safeReturnPath('/ok%0d%0aLocation:evil'), '/app/dashboard');
});

test('credential encryption round-trips with AES-GCM and rejects weak keys', () => {
  const value = { account: 'demo', token: 'sensitive' };
  const encrypted = encryptCredential(value, TEST_ENCRYPTION_KEY);
  assert.match(encrypted, /^gcm1\./);
  assert.deepEqual(decryptCredential(encrypted, TEST_ENCRYPTION_KEY), value);
  assert.throws(() => encryptCredential(value, 'short'), /at least 32 characters/);
});

test('HMAC verifier accepts hex and base64 signatures and rejects mismatches', () => {
  const rawBody = Buffer.from('{"event":"test"}');
  const secretValue = 'webhook-secret';
  const hex = crypto.createHmac('sha256', secretValue).update(rawBody).digest('hex');
  const base64 = crypto.createHmac('sha256', secretValue).update(rawBody).digest('base64');
  assert.equal(verifyHmacSha256({ rawBody, signature: `sha256=${hex}`, secretValue }), true);
  assert.equal(verifyHmacSha256({ rawBody, signature: base64, secretValue }), true);
  assert.equal(verifyHmacSha256({ rawBody, signature: 'wrong', secretValue }), false);
});
