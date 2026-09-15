import { WORLD_BUILD } from './world-build.js';
import { NEXT_WORLD_BUILDS, WORLD_BUILD_PROGRAM } from './world-build-program.js';

function installBuildProgram() {
  const root = document.documentElement;
  const current = WORLD_BUILD_PROGRAM.currentBuild;
  root.dataset.worldProgram = WORLD_BUILD_PROGRAM.id;
  root.dataset.worldProgramBuild = current.id;
  root.dataset.worldBuildId = WORLD_BUILD.buildId;

  const status = document.getElementById('worldProgramStatus');
  if (status) {
    status.textContent = `NEXT 100 · ${current.id}/W100 · ${current.title.toUpperCase()}`;
    status.dataset.program = WORLD_BUILD_PROGRAM.id;
    status.dataset.current = current.id;
  }

  const version = document.getElementById('worldVersion');
  if (version) {
    version.textContent = `WISDO WORLD ${WORLD_BUILD.worldVersion}`;
  }

  const publicSnapshot = Object.freeze({
    ...WORLD_BUILD_PROGRAM,
    buildIdentity: WORLD_BUILD,
    builds: NEXT_WORLD_BUILDS,
  });

  Object.defineProperty(window, 'WISDO_WORLD_BUILD_PROGRAM', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: publicSnapshot,
  });

  window.dispatchEvent(new CustomEvent('wisdo:world-build-program-ready', {
    detail: {
      id: WORLD_BUILD_PROGRAM.id,
      totalBuilds: WORLD_BUILD_PROGRAM.totalBuilds,
      shippedBuilds: WORLD_BUILD_PROGRAM.shippedBuilds,
      currentBuild: current,
      buildIdentity: WORLD_BUILD,
    },
  }));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installBuildProgram, { once: true });
} else {
  installBuildProgram();
}
