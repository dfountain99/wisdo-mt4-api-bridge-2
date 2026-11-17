/**
 * WISDO local loopback smoke diagnostic.
 * Uses only 127.0.0.1 and GET /health + /ready; never calls the public origin,
 * a trading-command endpoint, or an authenticated route.
 *
 * Run after the web server is listening: npm run diagnose:loopback
 * Optionally set PORT (Render injects it) and LOOPBACK_TIMEOUT_MS.
 */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function validPort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError('PORT must be an integer between 1 and 65535');
  }
  return port;
}

function failureHint(code) {
  switch (code) {
    case 'ECONNREFUSED':
      return 'Nothing accepted the local connection: check service startup, PORT, and the listening interface.';
    case 'ETIMEDOUT':
      return 'The local request timed out: check event-loop pressure, stalled startup, and /health handling.';
    case 'EADDRNOTAVAIL':
    case 'ENETUNREACH':
      return 'The local address is unavailable: check the container network and listener binding.';
    default:
      return 'Inspect startup logs, the port configuration, and the listener before retrying.';
  }
}

export function checkLocalEndpoint({ port, endpoint, timeoutMs = 3000 } = {}) {
  const safePort = validPort(port);
  if (!['/health', '/ready'].includes(endpoint)) {
    throw new RangeError('Only the public read-only /health and /ready endpoints are supported');
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) {
    throw new RangeError('timeoutMs must be between 1 and 30000');
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve({ endpoint, ...result });
    };

    const req = http.get({
      hostname: '127.0.0.1',
      port: safePort,
      path: endpoint,
      family: 4,
      timeout: timeoutMs,
      headers: { Accept: 'application/json' },
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        if (body.length < 8192) body += chunk.slice(0, 8192 - body.length);
      });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch { /* Non-JSON response is still classified by HTTP status. */ }
        const statusCode = res.statusCode || 0;
        const ok = statusCode >= 200 && statusCode < 300 && parsed?.ok !== false;
        finish({
          ok,
          statusCode,
          category: ok ? 'healthy' : 'http-unhealthy',
          code: ok ? 'OK' : 'HTTP_' + statusCode,
          hint: ok ? 'Endpoint answered locally.' : 'The service answered but reported an unhealthy endpoint; inspect readiness/dependencies and logs.',
        });
      });
      res.on('error', (error) => finish({ ok: false, category: 'transport', code: error.code || 'RESPONSE_ERROR', hint: failureHint(error.code) }));
    });

    req.on('timeout', () => {
      const error = new Error('Loopback request timed out');
      error.code = 'ETIMEDOUT';
      req.destroy(error);
    });
    req.on('error', (error) => {
      finish({ ok: false, category: 'transport', code: error.code || 'REQUEST_ERROR', hint: failureHint(error.code) });
    });
  });
}

export async function diagnoseLoopback({ port = process.env.PORT || process.env.API_PORT || 3000, timeoutMs = 3000 } = {}) {
  const safePort = validPort(port);
  const [health, ready] = await Promise.all([
    checkLocalEndpoint({ port: safePort, endpoint: '/health', timeoutMs }),
    checkLocalEndpoint({ port: safePort, endpoint: '/ready', timeoutMs }),
  ]);
  const code = !health.ok ? 1 : !ready.ok ? 2 : 0;
  const diagnosis = code === 0
    ? 'local-listener-and-dependencies-ready'
    : code === 2
      ? 'local-listener-alive-but-application-not-ready'
      : 'local-liveness-failed';
  return { ok: code === 0, port: safePort, host: '127.0.0.1', diagnosis, health, ready, exitCode: code };
}

const invokedAsCli = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsCli) {
  const timeoutMs = process.env.LOOPBACK_TIMEOUT_MS ? Number(process.env.LOOPBACK_TIMEOUT_MS) : 3000;
  diagnoseLoopback({ timeoutMs })
    .then((result) => {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      process.exitCode = result.exitCode;
    })
    .catch((error) => {
      process.stderr.write('Loopback diagnostic configuration error: ' + error.message + '\n');
      process.exitCode = 3;
    });
}
