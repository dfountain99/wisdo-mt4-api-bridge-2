import { SlashCommandBuilder } from 'discord.js';

const BOT_CHOICES = [
  { name: 'DEADSHOT', value: 'DEADSHOT' },
  { name: 'DF SAUCE FINAL AI', value: 'DF_SAUCE_FINAL_AI' },
  { name: 'DF Handsfree V10.6', value: 'DF_HANDSFREE_V10_6' },
  { name: 'DF Handsfree V9', value: 'DF_HANDSFREE_V9' },
  { name: 'DF Handsfree Core', value: 'DF_HANDSFREE' },
  { name: 'ALL CEM adaptive bots', value: 'ALL' },
];

const SETTING_CHOICES = [
  { name: 'MaxTradesPerSide', value: 'MaxTradesPerSide' },
  { name: 'BaseCooldownSeconds', value: 'BaseCooldownSeconds' },
  { name: 'LadderCooldownSeconds', value: 'LadderCooldownSeconds' },
  { name: 'BaseLadderStepPoints', value: 'BaseLadderStepPoints' },
  { name: 'MinElasticStepPoints', value: 'MinElasticStepPoints' },
  { name: 'PulseConfirmBars', value: 'PulseConfirmBars' },
  { name: 'Slippage', value: 'Slippage' },
  { name: 'InpMaxOpenTrades', value: 'InpMaxOpenTrades' },
  { name: 'InpMaxAddsPerSide', value: 'InpMaxAddsPerSide' },
  { name: 'InpSecondsBetweenEntries', value: 'InpSecondsBetweenEntries' },
  { name: 'InpSecondsBetweenAdds', value: 'InpSecondsBetweenAdds' },
  { name: 'InpBaseAddStepPoints', value: 'InpBaseAddStepPoints' },
  { name: 'InpHarvestEveryMinutes', value: 'InpHarvestEveryMinutes' },
  { name: 'MaxCampaignEntries', value: 'MaxCampaignEntries' },
  { name: 'MaxSpreadPoints', value: 'MaxSpreadPoints' },
];

const BOT_DEFAULTS = {
  DEADSHOT: {
    label: 'DEADSHOT_SNIPER',
    defense: [
      ['MaxTradesPerSide', 1],
      ['BaseCooldownSeconds', 90],
      ['LadderCooldownSeconds', 120],
      ['BaseLadderStepPoints', 700],
      ['MinElasticStepPoints', 400],
      ['PulseConfirmBars', 4],
      ['Slippage', 20],
    ],
    normal: [
      ['MaxTradesPerSide', 3],
      ['BaseCooldownSeconds', 20],
      ['LadderCooldownSeconds', 30],
      ['PulseConfirmBars', 2],
    ],
  },
  DF_SAUCE_FINAL_AI: {
    label: 'SAUCE_REACTOR',
    defense: [
      ['InpMaxOpenTrades', 2],
      ['InpMaxAddsPerSide', 1],
      ['InpSecondsBetweenEntries', 120],
      ['InpSecondsBetweenAdds', 180],
      ['InpBaseAddStepPoints', 850],
    ],
    normal: [
      ['InpMaxOpenTrades', 4],
      ['InpMaxAddsPerSide', 2],
      ['InpSecondsBetweenEntries', 30],
      ['InpSecondsBetweenAdds', 60],
    ],
  },
  DF_HANDSFREE_V10_6: {
    label: 'HANDSFREE_V10_6',
    defense: [
      ['InpMaxOpenTrades', 2],
      ['InpMaxAddsPerSide', 1],
      ['InpSecondsBetweenEntries', 120],
      ['InpSecondsBetweenAdds', 180],
      ['InpBaseAddStepPoints', 850],
      ['InpHarvestEveryMinutes', 1],
    ],
    normal: [
      ['InpMaxOpenTrades', 4],
      ['InpMaxAddsPerSide', 2],
      ['InpSecondsBetweenEntries', 30],
      ['InpSecondsBetweenAdds', 60],
    ],
  },
  DF_HANDSFREE_V9: {
    label: 'HANDSFREE_V9',
    defense: [
      ['MaxCampaignEntries', 1],
      ['MaxSpreadPoints', 120],
    ],
    normal: [
      ['MaxCampaignEntries', 3],
      ['MaxSpreadPoints', 250],
    ],
  },
  DF_HANDSFREE: {
    label: 'HANDSFREE_CORE',
    defense: [
      ['MaxCampaignEntries', 1],
      ['MaxSpreadPoints', 120],
    ],
    normal: [
      ['MaxCampaignEntries', 3],
      ['MaxSpreadPoints', 250],
    ],
  },
};

function normalizeToken(value = '') {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function normalizeSymbol(value = '') {
  const symbol = normalizeToken(value || 'XAUUSD');
  return symbol || 'XAUUSD';
}

function normalizeAccount(value = '') {
  return String(value || '').trim().replace(/[^0-9]/g, '');
}

function normalizeMagic(value) {
  if (value === undefined || value === null || value === '') return '';
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) && n >= 0 ? String(n) : '';
}

function normalizeSetting(value = '') {
  return String(value || '').trim().replace(/[^A-Za-z0-9_]/g, '');
}

function nowId() {
  return `cem_${Date.now()}`;
}

function buildCemKey({ bot, accountNumber = '', symbol = '', magic = '', setting }) {
  const cleanBot = bot === 'ALL' ? 'ALL' : normalizeToken(bot);
  // Account can be left blank from Discord. The MT4 Reporter will replace __ACCOUNT__
  // with the live AccountNumber() before writing the Global Variable.
  const cleanAccount = normalizeAccount(accountNumber) || '__ACCOUNT__';
  const cleanSymbol = normalizeSymbol(symbol);
  const cleanMagic = normalizeMagic(magic);
  const cleanSetting = normalizeSetting(setting);

  if (!cleanSetting) throw new Error('Missing CEM setting name.');
  if (!cleanSymbol) throw new Error('Missing symbol. Use symbol:XAUUSD or the exact chart symbol.');
  if (!cleanMagic) throw new Error('Missing magic number. Use the exact EA magic number for that chart.');

  return `CEM.${cleanBot}.${cleanAccount}.${cleanSymbol}.${cleanMagic}.${cleanSetting}`;
}

function makeSetGlobalsPayload({ bot, symbol, accountNumber, magic, pairs, reason = 'WISDO adaptive command' }) {
  const commandId = nowId();
  const globalPairs = pairs.map(([setting, value]) => ({
    setting: normalizeSetting(setting),
    value: Number(value),
    key: buildCemKey({ bot, accountNumber, symbol, magic, setting }),
  }));

  const payload = {
    commandId,
    commandName: 'CEM_SET_GLOBALS',
    command: 'CEM_SET_GLOBALS',
    source: 'wisdo_cem_adaptive_control',
    bot: normalizeToken(bot),
    symbol: symbol ? normalizeSymbol(symbol) : '',
    accountNumber: normalizeAccount(accountNumber),
    magicNumber: normalizeMagic(magic),
    reason,
    gvCount: globalPairs.length,
    globals: {},
  };

  globalPairs.forEach((item, index) => {
    const slot = index + 1;
    payload[`gvName${slot}`] = item.key;
    payload[`gvValue${slot}`] = item.value;
    payload.globals[item.key] = item.value;
  });

  return payload;
}

async function queueWisdoEaCommand(context, payload, interaction = null) {
  const userId = interaction?.user?.id || context?.deskUserId || context?.userId || payload.userId || null;
  const accountId = payload.accountId || context?.activeAccountId || context?.accountId || null;
  const normalizedPayload = {
    ...payload,
    accountId,
    accountNumber: payload.accountNumber || null,
    pairingCode: payload.pairingCode || null,
  };

  if (context?.mt4CommandService?.queueCommandForAccount && userId && accountId) {
    await context.mt4CommandService.queueCommandForAccount(userId, accountId, 'CEM_SET_GLOBALS', normalizedPayload);
    return true;
  }

  if (context?.mt4CommandService?.queueCommand && userId) {
    await context.mt4CommandService.queueCommand(userId, 'CEM_SET_GLOBALS', normalizedPayload);
    return true;
  }

  if (context?.queueMt4Command) {
    await context.queueMt4Command(normalizedPayload);
    return true;
  }

  return false;
}


async function safeDefer(interaction) {
  if (!interaction?.isRepliable?.()) return;
  if (interaction.deferred || interaction.replied) return;
  await interaction.deferReply({ ephemeral: true }).catch(() => null);
}

function commandLines(payload) {
  const lines = [];
  for (let i = 1; i <= Number(payload.gvCount || 0); i += 1) {
    lines.push(`${payload[`gvName${i}`]} = ${payload[`gvValue${i}`]}`);
  }
  return lines.join('\n');
}

async function replyWithPayload(interaction, context, payload, title) {
  const queued = await queueWisdoEaCommand(context, payload, interaction);
  const body = `${title}\n\nCommand ID: ${payload.commandId}\n\nCEM Global Variables queued for MT4 Reporter:\n\`\`\`\n${commandLines(payload)}\n\`\`\`\n${queued ? '✅ Queued. The connected CultureCoin Reporter will write these into MT4 Global Variables.' : '⚠️ Built, but no MT4 command service was available in this process.'}`;

  if (interaction.deferred || interaction.replied) return interaction.editReply(body);
  return interaction.reply({ content: body, ephemeral: true });
}

function addScopeOptions(builder) {
  return builder
    .addStringOption((option) => option.setName('symbol').setDescription('Required: chart symbol/pair, example XAUUSD.').setRequired(true))
    .addIntegerOption((option) => option.setName('magic').setDescription('Required: exact EA magic number for this chart/bot lane.').setRequired(true))
    .addStringOption((option) => option.setName('account').setDescription('Optional MT4 account number. Blank = Reporter fills current AccountNumber().').setRequired(false));
}

function addBotOption(builder) {
  return builder.addStringOption((option) => option.setName('bot').setDescription('Which bot lane WISDO should manage.').setRequired(true).addChoices(...BOT_CHOICES));
}

function getDefensePairs(bot, mode) {
  if (bot === 'ALL') {
    // Keep ALL safe and generic. Users can still use exact settings for deep bot-specific overrides.
    return mode === 'defense'
      ? [['MaxTradesPerSide', 1], ['InpMaxOpenTrades', 2], ['InpMaxAddsPerSide', 1], ['MaxCampaignEntries', 1]]
      : [['MaxTradesPerSide', 3], ['InpMaxOpenTrades', 4], ['InpMaxAddsPerSide', 2], ['MaxCampaignEntries', 3]];
  }

  const profile = BOT_DEFAULTS[bot];
  return profile?.[mode] || [];
}

function parseNaturalPrompt(prompt) {
  const p = String(prompt || '').toLowerCase();
  let bot = 'DEADSHOT';
  if (p.includes('sauce')) bot = 'DF_SAUCE_FINAL_AI';
  else if (p.includes('v10') || p.includes('10.6')) bot = 'DF_HANDSFREE_V10_6';
  else if (p.includes('v9')) bot = 'DF_HANDSFREE_V9';
  else if (p.includes('handsfree')) bot = 'DF_HANDSFREE';
  else if (p.includes('all bot') || p.includes('all cem')) bot = 'ALL';

  const symbolMatch = p.match(/\b(xauusd|btcusd|ethusd|us30|nas100|nasusd|eurusd|gbpusd|usdjpy|gbpjpy)\b/i);
  const symbol = symbolMatch ? symbolMatch[1].toUpperCase() : '';
  const accountMatch = p.match(/account\s*(\d{3,20})/i);
  const magicMatch = p.match(/magic\s*(\d{1,12})/i);

  if (p.includes('defense') || p.includes('slow down') || p.includes('risk down') || p.includes('margin pressure')) {
    return { bot, symbol, accountNumber: accountMatch?.[1] || '', magic: magicMatch?.[1] || '', pairs: getDefensePairs(bot, 'defense'), reason: prompt };
  }

  if (p.includes('normal') || p.includes('resume')) {
    return { bot, symbol, accountNumber: accountMatch?.[1] || '', magic: magicMatch?.[1] || '', pairs: getDefensePairs(bot, 'normal'), reason: prompt };
  }

  const maxTrades = p.match(/max\s*trades?\s*(?:to|=)?\s*(\d+)/i);
  if (maxTrades) return { bot, symbol, accountNumber: accountMatch?.[1] || '', magic: magicMatch?.[1] || '', pairs: [['MaxTradesPerSide', Number(maxTrades[1])]], reason: prompt };

  const addStep = p.match(/(?:add|ladder)\s*(?:step|spacing)?\s*(?:to|=)?\s*(\d+)/i);
  if (addStep) return { bot, symbol, accountNumber: accountMatch?.[1] || '', magic: magicMatch?.[1] || '', pairs: [['BaseLadderStepPoints', Number(addStep[1])], ['InpBaseAddStepPoints', Number(addStep[1])]], reason: prompt };

  return { bot, symbol, accountNumber: accountMatch?.[1] || '', magic: magicMatch?.[1] || '', pairs: [['MaxTradesPerSide', 1]], reason: `${prompt} | fallback: safe one-trade lane` };
}

export function buildWisdoEaControlCommands(context = {}) {
  const commands = [
    {
      data: addScopeOptions(addBotOption(new SlashCommandBuilder()
        .setName('wisdo-adaptive-set')
        .setDescription('Set one CEM adaptive number for a specific bot/symbol/account/magic lane.'))
        .addStringOption((option) => option.setName('setting').setDescription('Adaptive setting/int name.').setRequired(true).addChoices(...SETTING_CHOICES))
        .addNumberOption((option) => option.setName('value').setDescription('Number to write into MT4 Global Variables.').setRequired(true))),
      async execute(interaction) {
        await safeDefer(interaction);
        const bot = interaction.options.getString('bot', true);
        const setting = interaction.options.getString('setting', true);
        const value = interaction.options.getNumber('value', true);
        const symbol = interaction.options.getString('symbol') || '';
        const accountNumber = interaction.options.getString('account') || '';
        const magic = interaction.options.getInteger('magic') ?? '';
        const payload = makeSetGlobalsPayload({ bot, symbol, accountNumber, magic, pairs: [[setting, value]], reason: 'slash adaptive set' });
        return replyWithPayload(interaction, context, payload, `🧠 CEM adaptive override queued for ${bot}.`);
      },
    },
    {
      data: addScopeOptions(addBotOption(new SlashCommandBuilder()
        .setName('wisdo-adaptive-defense')
        .setDescription('Put one bot lane into defense without locking the bot down.'))),
      async execute(interaction) {
        await safeDefer(interaction);
        const bot = interaction.options.getString('bot', true);
        const symbol = interaction.options.getString('symbol') || '';
        const accountNumber = interaction.options.getString('account') || '';
        const magic = interaction.options.getInteger('magic') ?? '';
        const pairs = getDefensePairs(bot, 'defense');
        const payload = makeSetGlobalsPayload({ bot, symbol, accountNumber, magic, pairs, reason: 'adaptive defense preset' });
        return replyWithPayload(interaction, context, payload, `🛡️ CEM adaptive defense queued for ${bot}.`);
      },
    },
    {
      data: addScopeOptions(addBotOption(new SlashCommandBuilder()
        .setName('wisdo-adaptive-normal')
        .setDescription('Return one bot lane toward normal operating numbers.'))),
      async execute(interaction) {
        await safeDefer(interaction);
        const bot = interaction.options.getString('bot', true);
        const symbol = interaction.options.getString('symbol') || '';
        const accountNumber = interaction.options.getString('account') || '';
        const magic = interaction.options.getInteger('magic') ?? '';
        const pairs = getDefensePairs(bot, 'normal');
        const payload = makeSetGlobalsPayload({ bot, symbol, accountNumber, magic, pairs, reason: 'adaptive normal preset' });
        return replyWithPayload(interaction, context, payload, `✅ CEM adaptive normal preset queued for ${bot}.`);
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('wisdo-adaptive-lane')
        .setDescription('Preview the exact CEM Global Variable lane WISDO will write.')
        .addStringOption((option) => option.setName('bot').setDescription('Bot lane').setRequired(true).addChoices(...BOT_CHOICES))
        .addStringOption((option) => option.setName('setting').setDescription('Setting/int name').setRequired(true).addChoices(...SETTING_CHOICES))
        .addStringOption((option) => option.setName('symbol').setDescription('Required chart symbol/pair').setRequired(true))
        .addIntegerOption((option) => option.setName('magic').setDescription('Required EA magic number').setRequired(true))
        .addStringOption((option) => option.setName('account').setDescription('Optional MT4 account number. Blank = Reporter fills current AccountNumber().').setRequired(false)),
      async execute(interaction) {
        await safeDefer(interaction);
        const key = buildCemKey({
          bot: interaction.options.getString('bot', true),
          setting: interaction.options.getString('setting', true),
          symbol: interaction.options.getString('symbol') || '',
          accountNumber: interaction.options.getString('account') || '',
          magic: interaction.options.getInteger('magic') ?? '',
        });
        return interaction.editReply({ content: `CEM lane preview:\n\`\`\`\n${key}\n\`\`\`` });
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('wisdo-command')
        .setDescription('Natural-language WISDO command for CEM adaptive bot lanes.')
        .addStringOption((option) => option.setName('prompt').setDescription('Example: put DEADSHOT XAUUSD in defense magic 260408').setRequired(true)),
      async execute(interaction) {
        await safeDefer(interaction);
        const parsed = parseNaturalPrompt(interaction.options.getString('prompt', true));
        const payload = makeSetGlobalsPayload(parsed);
        return replyWithPayload(interaction, context, payload, '🧠 WISDO translated your instruction into CEM adaptive globals.');
      },
    },
  ];

  return { commands, modalHandlers: new Map() };
}
