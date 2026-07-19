import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';

function parseTimeToMinutes(value) {
  const text = String(value || '').trim().toLowerCase();
  const match = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const suffix = match[3];
  if (suffix === 'pm' && hour < 12) hour += 12;
  if (suffix === 'am' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}
function directionValue(direction) {
  const d = String(direction || 'both').toLowerCase();
  if (d.includes('buy') || d.includes('long')) return 'BUY_ONLY';
  if (d.includes('sell') || d.includes('short')) return 'SELL_ONLY';
  if (d.includes('pause') || d.includes('off')) return 'PAUSED';
  return 'BOTH';
}
function directionCode(direction) {
  if (direction === 'BUY_ONLY') return 1;
  if (direction === 'SELL_ONLY') return 2;
  if (direction === 'PAUSED') return 3;
  return 0;
}
function sessionName(value) {
  return String(value || 'custom').trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_').slice(0, 24) || 'CUSTOM';
}
function symbolKey(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_').slice(0, 24);
}

export function buildWisdoPortalCommands({ service, config, mt4SyncService, mt4CommandService }) {
  const commands = [
    {
      data: new SlashCommandBuilder()
        .setName('member-portal')
        .setDescription('Open the CultureCoin / WISDO member portal.'),
      async execute(interaction) {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ ephemeral: true });
        }
        const base = config.api.publicBaseUrl || `http://localhost:${config.api.port}`;
        await interaction.editReply({
          content: '🟡 **CultureCoin / WISDO Member Portal**\nUse this for Trade Link, account history, bots, devices, training, support, sales, and payouts.',
          components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Open Member Portal').setStyle(ButtonStyle.Link).setURL(`${base}/member`))],
        });
      },
    },

    {
      data: new SlashCommandBuilder()
        .setName('link-trading-account')
        .setDescription('Open the Trade Link portal to connect an MT4/MT5 account.'),
      async execute(interaction) {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ ephemeral: true });
        }
        const base = config.api.publicBaseUrl || `http://localhost:${config.api.port}`;
        await interaction.editReply({
          content: '🔗 **Trade Link**\nOpen the portal, generate a CEM pairing code, then paste that code into the MT4 Reporter / EA bridge. Do not submit your broker master password.',
          components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Open Trade Link').setStyle(ButtonStyle.Link).setURL(`${base}/member/link-account`))],
        });
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('my-linked-accounts')
        .setDescription('Show your WISDO Trade Link accounts and pairing status.'),
      async execute(interaction) {
        const context = service ? await service.requireDeskContext(interaction, { allowStaff: true }) : null;
        if (!context) return;
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ ephemeral: true });
        }
        const links = mt4SyncService?.repository?.getTradeLinksForUser
          ? await mt4SyncService.repository.getTradeLinksForUser(context.deskUserId)
          : [];
        const base = config.api.publicBaseUrl || `http://localhost:${config.api.port}`;
        const lines = links.length
          ? links.slice(0, 10).map((l) => [
              `• **${l.nickname || l.accountNumber || 'Account'}**`,
              `Account: ${l.accountNumber || 'pending'}`,
              `Server: ${l.server || l.brokerServer || 'pending'}`,
              `Status: ${l.status || 'PENDING'}`,
              `Pairing: ${l.pairingCode || 'none'}`,
            ].join(' | ')).join('\n')
          : 'No linked accounts found yet.';
        await interaction.editReply({
          content: `🔗 **My Linked Accounts**\n\n${lines}`,
          components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Open Trade Link Portal').setStyle(ButtonStyle.Link).setURL(`${base}/member/link-account`))],
        });
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('mt4-history')
        .setDescription('Open the member portal balance/equity history for this MT4 account.')
        .addStringOption((o)=>o.setName('period').setDescription('today, week, or month').addChoices({name:'Today',value:'today'},{name:'This Week',value:'week'},{name:'This Month',value:'month'})),
      async execute(interaction) {
        const context = await service.requireDeskContext(interaction, { allowStaff: true });
        if (!context) return;
        const period = interaction.options.getString('period') || 'today';
        const base = config.api.publicBaseUrl || `http://localhost:${config.api.port}`;
        await interaction.editReply({
          content: `📈 **Account History**\nOpen the timestamped balance/equity chart for **${period}**.`,
          components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('View Balance History').setStyle(ButtonStyle.Link).setURL(`${base}/member/accounts/${context.deskUserId}/history?period=${period}`))],
          ephemeral: true,
        });
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('wisdo-session')
        .setDescription('Set a WISDO trading session rule and relay it to MT4 global variables.')
        .addStringOption((o)=>o.setName('session').setDescription('london, asia, new-york, custom').setRequired(true))
        .addStringOption((o)=>o.setName('symbol').setDescription('XAUUSD, EURUSD, BTCUSD, or ALL').setRequired(true))
        .addStringOption((o)=>o.setName('start').setDescription('Example: 03:00 or 3am').setRequired(true))
        .addStringOption((o)=>o.setName('end').setDescription('Example: 05:00 or 5am').setRequired(true))
        .addStringOption((o)=>o.setName('direction').setDescription('both, buy-only, sell-only, paused').addChoices({name:'Both',value:'both'},{name:'Buy Only',value:'buy-only'},{name:'Sell Only',value:'sell-only'},{name:'Paused',value:'paused'})),
      async execute(interaction) {
        const context = await service.requireDeskContext(interaction, { allowStaff: true });
        if (!context) return;
        await interaction.deferReply({ ephemeral: true });
        const session = sessionName(interaction.options.getString('session', true));
        const symbol = symbolKey(interaction.options.getString('symbol', true));
        const startMinutes = parseTimeToMinutes(interaction.options.getString('start', true));
        const endMinutes = parseTimeToMinutes(interaction.options.getString('end', true));
        const directionMode = directionValue(interaction.options.getString('direction') || 'both');
        if (startMinutes === null || endMinutes === null) return interaction.editReply('⚠️ I could not read that time. Use `03:00`, `3am`, or `15:30`.');

        const rule = { session, symbol, startMinutes, endMinutes, directionMode, enabled: true };
        if (mt4SyncService.repository.saveSessionRule) await mt4SyncService.repository.saveSessionRule(context.deskUserId, rule);
        const prefix = symbol && symbol !== 'ALL' ? `WISDO_${symbol}_` : 'WISDO_';
        const command = await mt4CommandService.queueCommand(context.deskUserId, 'SET_SESSION_RULE', {
          ...rule,
          symbol: symbol === 'ALL' ? null : symbol,
          globals: {
            WISDO_COMMAND_ID: Date.now(),
            WISDO_LAST_COMMAND: 'SET_SESSION_RULE',
            [`${prefix}SESSION_ENABLED`]: 1,
            [`${prefix}SESSION_START_MINUTES`]: startMinutes,
            [`${prefix}SESSION_END_MINUTES`]: endMinutes,
            [`${prefix}SESSION_DIRECTION_MODE`]: directionCode(directionMode),
          },
        });
        await interaction.editReply([
          '🕰️ **WISDO session rule queued.**',
          `Command ID: \`${command.id}\``,
          `Session: **${session}**`,
          `Symbol: **${symbol}**`,
          `Window: **${interaction.options.getString('start', true)} - ${interaction.options.getString('end', true)}**`,
          `Direction: **${directionMode}**`,
          '',
          'MT4 will apply this through Global Variables after the Reporter polls.',
        ].join('\n'));
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('wisdo-pair')
        .setDescription('Set pair-specific WISDO controls for one symbol.')
        .addStringOption((o)=>o.setName('symbol').setDescription('Example: XAUUSD').setRequired(true))
        .addStringOption((o)=>o.setName('direction').setDescription('both, buy-only, sell-only, paused').addChoices({name:'Both',value:'both'},{name:'Buy Only',value:'buy-only'},{name:'Sell Only',value:'sell-only'},{name:'Paused',value:'paused'}))
        .addIntegerOption((o)=>o.setName('max-trades').setDescription('Pair-specific max trades'))
        .addNumberOption((o)=>o.setName('risk').setDescription('Pair-specific risk percent')),
      async execute(interaction) {
        const context = await service.requireDeskContext(interaction, { allowStaff: true });
        if (!context) return;
        await interaction.deferReply({ ephemeral: true });
        const symbol = symbolKey(interaction.options.getString('symbol', true));
        const directionMode = directionValue(interaction.options.getString('direction') || 'both');
        const maxTrades = interaction.options.getInteger('max-trades');
        const risk = interaction.options.getNumber('risk');
        const globals = { WISDO_COMMAND_ID: Date.now(), WISDO_LAST_COMMAND: 'SET_PAIR_RULE' };
        globals[`WISDO_${symbol}_BUY_ONLY`] = directionMode === 'BUY_ONLY' ? 1 : 0;
        globals[`WISDO_${symbol}_SELL_ONLY`] = directionMode === 'SELL_ONLY' ? 1 : 0;
        globals[`WISDO_${symbol}_PAUSE_TRADING`] = directionMode === 'PAUSED' ? 1 : 0;
        if (maxTrades !== null) globals[`WISDO_${symbol}_MAX_TRADES`] = maxTrades;
        if (risk !== null) globals[`WISDO_${symbol}_RISK_PERCENT`] = risk;
        const rule = { symbol, directionMode, maxTrades, risk };
        if (mt4SyncService.repository.savePairRule) await mt4SyncService.repository.savePairRule(context.deskUserId, rule);
        const command = await mt4CommandService.queueCommand(context.deskUserId, 'SET_PAIR_RULE', { ...rule, symbol, globals });
        await interaction.editReply([
          '📌 **WISDO pair rule queued.**',
          `Command ID: \`${command.id}\``,
          `Symbol: **${symbol}**`,
          `Direction: **${directionMode}**`,
          maxTrades !== null ? `Max trades: **${maxTrades}**` : null,
          risk !== null ? `Risk: **${risk}%**` : null,
        ].filter(Boolean).join('\n'));
      },
    },
  ];
  return { commands, modalHandlers: new Map() };
}
