import { startWorldSignalRuntime } from './world-signal-runtime.js';
import { startOperatorIdentityRuntime } from './operator-identity-runtime.js';

let signalRuntime = null;

async function bootLivingSystems() {
  signalRuntime = startWorldSignalRuntime();
  await startOperatorIdentityRuntime();
}

bootLivingSystems().catch((error) => console.warn('WISDO living systems boot degraded', error));

window.addEventListener('pagehide', () => signalRuntime?.stop?.(), { once: true });
