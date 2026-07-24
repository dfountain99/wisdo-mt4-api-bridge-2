const EPHEMERAL_FLAG = 64;
const DEFAULT_ACK_DELAY_MS = 1400;

function normalizeEditPayload(payload) {
  if (typeof payload === 'string' || !payload || typeof payload !== 'object') return payload;
  const next = { ...payload };
  delete next.ephemeral;
  if (next.flags === EPHEMERAL_FLAG) delete next.flags;
  return next;
}

function canAutoAcknowledge(interaction) {
  return Boolean(
    interaction
      && typeof interaction.isRepliable === 'function'
      && interaction.isRepliable()
      && typeof interaction.deferReply === 'function',
  );
}

function createSafeInteractionProxy(interaction, state) {
  return new Proxy(interaction, {
    get(target, property, receiver) {
      if (property === 'reply') {
        return async (payload) => {
          if (target.deferred && !state.primaryResponseSent) {
            state.primaryResponseSent = true;
            return target.editReply(normalizeEditPayload(payload));
          }
          if (target.replied || state.primaryResponseSent) {
            return target.followUp(payload);
          }
          const result = await target.reply(payload);
          state.primaryResponseSent = true;
          return result;
        };
      }

      if (property === 'editReply') {
        return async (payload) => {
          const result = await target.editReply(normalizeEditPayload(payload));
          state.primaryResponseSent = true;
          return result;
        };
      }

      if (property === 'deferReply') {
        return async (options = {}) => {
          if (target.deferred || target.replied) return null;
          return target.deferReply(options);
        };
      }

      if (property === 'showModal') {
        return async (modal) => {
          state.modalShown = true;
          state.primaryResponseSent = true;
          return target.showModal(modal);
        };
      }

      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

export function wrapCommandWithInteractionGuard(command, {
  modalFirst = false,
  ackDelayMs = DEFAULT_ACK_DELAY_MS,
  logger = null,
} = {}) {
  if (!command || typeof command.execute !== 'function') return command;

  const originalExecute = command.execute.bind(command);

  return {
    ...command,
    async execute(interaction) {
      const state = {
        primaryResponseSent: Boolean(interaction?.replied),
        modalShown: false,
      };
      const safeInteraction = createSafeInteractionProxy(interaction, state);
      let timer = null;

      if (!modalFirst && canAutoAcknowledge(interaction)) {
        timer = setTimeout(async () => {
          if (interaction.deferred || interaction.replied || state.primaryResponseSent || state.modalShown) return;
          try {
            await interaction.deferReply({ flags: EPHEMERAL_FLAG });
          } catch (error) {
            if (![10062, 40060].includes(error?.code)) {
              logger?.warn?.('Automatic Discord interaction acknowledgement failed.', {
                command: interaction?.commandName || command?.data?.name,
                code: error?.code,
                message: error?.message,
              });
            }
          }
        }, Math.max(250, Number(ackDelayMs) || DEFAULT_ACK_DELAY_MS));
        timer.unref?.();
      }

      try {
        return await originalExecute(safeInteraction);
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}

export function validateCommandRegistry(commands = []) {
  const names = [];
  const duplicates = [];
  const invalid = [];

  for (const command of commands) {
    const json = command?.data?.toJSON?.();
    const name = String(json?.name || '').trim();
    if (!name) {
      invalid.push('unnamed-command');
      continue;
    }
    if (names.includes(name)) duplicates.push(name);
    names.push(name);
    if (name.length > 32) invalid.push(`${name}:name-too-long`);
    if (String(json?.description || '').length > 100) invalid.push(`${name}:description-too-long`);
  }

  if (duplicates.length || invalid.length || names.length > 100) {
    const error = new Error('Discord command registry validation failed.');
    error.details = {
      commandCount: names.length,
      duplicates: [...new Set(duplicates)],
      invalid,
      overDiscordLimit: names.length > 100,
    };
    throw error;
  }

  return {
    commandCount: names.length,
    names,
    duplicates: [],
    invalid: [],
  };
}
