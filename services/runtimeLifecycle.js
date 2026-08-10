function asError(value) {
  return value instanceof Error ? value : new Error(String(value || 'Unknown runtime failure'));
}

function closeServer(server) {
  if (!server?.close) return Promise.resolve();
  return new Promise((resolve, reject) => {
    try {
      server.close((error) => {
        if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
        else resolve();
      });
      server.closeIdleConnections?.();
    } catch (error) {
      if (error?.code === 'ERR_SERVER_NOT_RUNNING') resolve();
      else reject(error);
    }
  });
}

export function createRuntimeLifecycle({
  server,
  client,
  logger = console,
  timers = [],
  timeoutMs = Number(process.env.WISDO_SHUTDOWN_TIMEOUT_MS || 10_000),
  exit = (code) => process.exit(code),
} = {}) {
  let shutdownPromise = null;

  function shutdown(signal = 'shutdown', exitCode = 0) {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      const boundedTimeoutMs = Math.max(1_000, Math.min(30_000, Number(timeoutMs) || 10_000));
      logger.info?.('Shutdown requested', { signal, exitCode, timeoutMs: boundedTimeoutMs });
      for (const timer of timers) {
        clearTimeout(timer);
        clearInterval(timer);
      }

      let deadline;
      const deadlineReached = new Promise((resolve) => {
        deadline = setTimeout(() => resolve('deadline'), boundedTimeoutMs);
        deadline.unref?.();
      });
      const drain = Promise.allSettled([
        closeServer(server),
        Promise.resolve().then(() => server?.wisdo?.closeResources?.()),
        Promise.resolve().then(() => client?.destroy?.()),
      ]).then((results) => {
        for (const result of results) {
          if (result.status === 'rejected') logger.error?.('Shutdown resource failed', { message: result.reason?.message || String(result.reason) });
        }
        return 'drained';
      });

      const outcome = await Promise.race([drain, deadlineReached]);
      clearTimeout(deadline);
      if (outcome === 'deadline') {
        logger.error?.('Graceful shutdown deadline exceeded; forcing open connections closed.', { timeoutMs: boundedTimeoutMs });
        server?.closeAllConnections?.();
      }
      exit(exitCode);
      return { signal, exitCode, outcome };
    })();
    return shutdownPromise;
  }

  function fatal(reason, origin = 'fatal runtime error') {
    const error = asError(reason);
    logger.error?.(origin, { message: error.message, stack: error.stack });
    return shutdown(origin, 1);
  }

  return { shutdown, fatal };
}
