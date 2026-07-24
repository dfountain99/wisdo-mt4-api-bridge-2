import { buildAdminCommands } from './admin.js';
import { buildMt4Commands } from './mt4.js';
import { buildProfileCommands } from './profile.js';
import { buildStoreCommands } from './store.js';
import { buildTradingCommands } from './trading.js';
import { buildWisdoCommands } from './wisdo.js';
import { buildWisdoReviewCommands } from './wisdoReview.js';
import { buildWisdoEaControlCommands } from './wisdoEaControl.js';
import { buildWisdoSettingsCommands } from './wisdoSettings.js';
import { buildWisdoPortalCommands } from './wisdoPortal.js';
import { buildWisdoBotRegistryCommands } from './wisdoBotRegistry.js';
import { buildWisdoCommandCenterCommands } from './wisdoCommandCenter.js';
import { buildSignalGridCommands } from './signalGrid.js';
import { buildWisdoPhaseTwoCommands } from './wisdoPhaseTwo.js';
import { validateCommandRegistry, wrapCommandWithInteractionGuard } from '../utils/discordInteractionGuard.js';

// Canonical Discord slash-command registry. Production root index.js and
// scripts/registerCommands.js import this file; src/ and nested commands/
// copies are historical duplicates and should not receive new command work.
export function createCommandRegistry(context) {
  const modules = [
    buildAdminCommands(context),
    buildMt4Commands(context),
    buildProfileCommands(context),
    buildStoreCommands(context),
    buildTradingCommands(context),
    buildWisdoCommands(context),
    buildWisdoEaControlCommands(context),
    buildWisdoReviewCommands(context),
    buildWisdoSettingsCommands(context),
    buildWisdoPortalCommands(context),
    buildWisdoBotRegistryCommands(context),
    buildWisdoCommandCenterCommands(context),
    buildSignalGridCommands(context),
    buildWisdoPhaseTwoCommands(context),
  ];

  const commands = [];
  const commandMap = new Map();
  const modalMap = new Map();

  const modalFirstCommands = new Set([
    'coach-note',
    'setup-profile',
    'edit-profile',
    'clock-in',
    'log-ea',
    'clock-out',
    'weekly-review',
  ]);

  for (const module of modules) {
    for (const command of module.commands) {
      const name = command.data.name;
      if (commandMap.has(name)) {
        throw new Error(`Duplicate Discord slash command detected: /${name}`);
      }
      const guarded = wrapCommandWithInteractionGuard(command, {
        modalFirst: modalFirstCommands.has(name),
        logger: context?.logger,
      });
      commands.push(guarded);
      commandMap.set(name, guarded);
    }

    for (const [key, handler] of module.modalHandlers.entries()) {
      if (modalMap.has(key)) {
        throw new Error(`Duplicate Discord modal handler detected: ${key}`);
      }
      modalMap.set(key, handler);
    }
  }

  const audit = validateCommandRegistry(commands);

  return {
    commands,
    commandMap,
    modalMap,
    audit,
  };
}
