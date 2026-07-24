import { SlashCommandBuilder } from 'discord.js';

function normalizeToken(value = '') {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function laneTitle(lane) {
  const name = lane.botNickname || lane.botLabel || lane.botKey;
  return `${name} — ${lane.symbol} — Magic ${lane.magicNumber}`;
}

function shortValue(value = '', max = 80) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function formatLane(lane) {
  const laneKey = shortValue(lane.laneKey, 54);
  const lanePrefix = shortValue(lane.lanePrefix, 74);
  return `• **${shortValue(laneTitle(lane), 72)}**\n  Key: \`${laneKey}\`\n  Acct: \`${lane.accountNumber || 'unknown'}\` | Trades: **${lane.openTrades || 0}** | P/L: **${Number(lane.floatingPL || 0).toFixed(2)}**\n  Lane: \`${lanePrefix}\``;
}

function clampDiscordContent(content, limit = 1900) {
  const text = String(content || '');
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 80)}

…truncated. Use page/search/symbol/bot filters to narrow results.`;
}

function laneSearchText(lane) {
  return [
    lane.botNickname, lane.botLabel, lane.botKey, lane.symbol, lane.magicNumber,
    lane.accountNumber, lane.accountId, lane.laneKey, lane.lanePrefix,
  ].filter(Boolean).join(' ').toLowerCase();
}

function filterLanes(lanes = [], { search = '', symbol = '', bot = '' } = {}) {
  const q = String(search || '').trim().toLowerCase();
  const sym = String(symbol || '').trim().toUpperCase();
  const botQ = String(bot || '').trim().toLowerCase();
  return lanes.filter((lane) => {
    if (q && !laneSearchText(lane).includes(q)) return false;
    if (sym && sym !== 'ALL' && String(lane.symbol || '').toUpperCase() !== sym) return false;
    if (botQ) {
      const names = [lane.botNickname, lane.botLabel, lane.botKey].filter(Boolean).join(' ').toLowerCase();
      if (!names.includes(botQ)) return false;
    }
    return true;
  });
}

function formatPageHelp({ page, totalPages, filteredCount, totalCount }) {
  const next = page < totalPages ? `Next page: \`/wisdo-bot-lanes page:${page + 1}\`` : 'Last page reached.';
  return `Page **${page}/${totalPages}** • Showing **${filteredCount}** of **${totalCount}** lanes. ${next}`;
}

async function safeEditReply(interaction, content) {
  return interaction.editReply(clampDiscordContent(content));
}

async function safeDefer(interaction) {
  if (!interaction?.isRepliable?.()) return;
  if (interaction.deferred || interaction.replied) return;
  await interaction.deferReply({ ephemeral: true }).catch(() => null);
}

async function queueCommand(context, interaction, command, payload) {
  const userId = interaction.user.id;
  const accountId = payload.accountId || context?.activeAccountId || null;
  if (context?.mt4CommandService?.queueCommandForAccount && accountId) {
    return context.mt4CommandService.queueCommandForAccount(userId, accountId, command, payload);
  }
  if (context?.mt4CommandService?.queueCommand) {
    return context.mt4CommandService.queueCommand(userId, command, payload);
  }
  return { id: `local_${Date.now()}`, missingService: true };
}

function closePayloadFromLane(lane, mode = 'all', percent = 100) {
  // Registry closes must always be lane-specific.
  // Winners/losers/all are passed as closeMode, while the command remains CLOSE_BY_MAGIC.
  const command = 'CLOSE_BY_MAGIC';
  return {
    source: 'wisdo_bot_registry',
    commandName: command,
    command,
    accountId: lane.accountId || null,
    accountNumber: lane.accountNumber,
    bot: lane.botKey,
    botNickname: lane.botNickname || '',
    symbol: lane.symbol,
    magicNumber: lane.magicNumber,
    targetMagic: lane.magicNumber,
    targetSymbol: lane.symbol,
    percent,
    closeMode: mode,
    targetMode: mode,
    laneKey: lane.laneKey,
    lanePrefix: lane.lanePrefix,
    strictLane: true,
    note: `Resolved from CEM bot registry lane ${lane.laneKey}`,
  };
}

export function buildWisdoBotRegistryCommands(context = {}) {
  const commands = [
    {
      data: new SlashCommandBuilder()
        .setName('wisdo-bot-lanes')
        .setDescription('Search and page through live bot lanes auto-discovered from the MT4 Reporter.')
        .addIntegerOption((option) => option.setName('page').setDescription('Page number to view. Default 1.').setRequired(false).setMinValue(1))
        .addStringOption((option) => option.setName('search').setDescription('Search nickname, bot, symbol, magic, account, or lane key.').setRequired(false))
        .addStringOption((option) => option.setName('symbol').setDescription('Filter by symbol, example XAUUSD, EURUSD, or ALL.').setRequired(false))
        .addStringOption((option) => option.setName('bot').setDescription('Filter by bot/nickname, example Deadpool, DEADSHOT, Handsfree.').setRequired(false))
        .addIntegerOption((option) => option.setName('limit').setDescription('Lanes per page, 1-8. Default 5.').setRequired(false).setMinValue(1).setMaxValue(8)),
      async execute(interaction) {
        await safeDefer(interaction);
        const allLanes = await context.botRegistryService?.listLanes(interaction.user.id, { includeStale: true });
        if (!allLanes?.length) {
          return interaction.editReply('No CEM bot lanes registered yet. Attach the upgraded Reporter, let it sync once, then run this again.');
        }

        const search = interaction.options.getString('search') || '';
        const symbol = interaction.options.getString('symbol') || '';
        const bot = interaction.options.getString('bot') || '';
        const limit = interaction.options.getInteger('limit') || 5;
        const filtered = filterLanes(allLanes, { search, symbol, bot });
        if (!filtered.length) {
          return interaction.editReply([
            'No matching CEM bot lanes found for that filter.',
            '',
            `Total lanes available: **${allLanes.length}**`,
            'Try `/wisdo-bot-lanes` with no filters, or search by nickname, bot key, symbol, magic number, or account number.',
          ].join('\n'));
        }

        const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
        const requestedPage = interaction.options.getInteger('page') || 1;
        const page = Math.min(Math.max(requestedPage, 1), totalPages);
        const start = (page - 1) * limit;
        const pageItems = filtered.slice(start, start + limit);
        const activeFilters = [
          search ? `search=\`${shortValue(search, 35)}\`` : '',
          symbol ? `symbol=\`${shortValue(symbol, 20)}\`` : '',
          bot ? `bot=\`${shortValue(bot, 25)}\`` : '',
        ].filter(Boolean).join(' • ');

        return safeEditReply(interaction, [
          '🧠 **Connected CEM Bot Lanes**',
          activeFilters ? `Filters: ${activeFilters}` : 'Filters: none',
          formatPageHelp({ page, totalPages, filteredCount: filtered.length, totalCount: allLanes.length }),
          '',
          ...pageItems.map(formatLane),
          '',
          'Search examples: `/wisdo-bot-lanes search:Deadpool`, `/wisdo-bot-lanes symbol:XAUUSD`, `/wisdo-bot-lanes bot:DEADSHOT page:2`',
        ].join('\n'));
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('wisdo-nickname-bot')
        .setDescription('Nickname a discovered bot lane, like DEADSHOT = Deadpool.')
        .addStringOption((option) => option.setName('lane_key').setDescription('Paste lane key from /wisdo-bot-lanes.').setRequired(true))
        .addStringOption((option) => option.setName('nickname').setDescription('Nickname, example Deadpool.').setRequired(true)),
      async execute(interaction) {
        await safeDefer(interaction);
        const laneKey = interaction.options.getString('lane_key', true);
        const nickname = interaction.options.getString('nickname', true);
        const lane = await context.botRegistryService?.setNickname(interaction.user.id, laneKey, nickname);
        if (!lane) return interaction.editReply('I could not find that lane key. Run `/wisdo-bot-lanes`, copy the exact key, then try again.');
        return interaction.editReply(`✅ Nickname saved: **${nickname}** now points to **${lane.botKey} ${lane.symbol} Magic ${lane.magicNumber}**.`);
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('wisdo-close-bot')
        .setDescription('Close trades for a nicknamed or discovered bot lane without typing account/magic manually.')
        .addStringOption((option) => option.setName('bot').setDescription('Nickname or bot name, example Deadpool, DEADSHOT, Handsfree.').setRequired(true))
        .addStringOption((option) => option.setName('symbol').setDescription('Optional symbol, example XAUUSD or ALL.').setRequired(false))
        .addStringOption((option) => option.setName('mode').setDescription('What to close.').setRequired(false).addChoices(
          { name: 'All matching trades', value: 'all' },
          { name: 'Winners only', value: 'winners' },
          { name: 'Losers only', value: 'losers' },
        ))
        .addNumberOption((option) => option.setName('percent').setDescription('Close percent. Default 100.').setRequired(false)),
      async execute(interaction) {
        await safeDefer(interaction);
        const target = interaction.options.getString('bot', true);
        const symbol = interaction.options.getString('symbol') || 'ALL';
        const mode = interaction.options.getString('mode') || 'all';
        const percent = interaction.options.getNumber('percent') || 100;
        const lanes = await context.botRegistryService?.findLanes(interaction.user.id, target, { symbol });
        if (!lanes?.length) {
          return interaction.editReply(`I could not find a connected lane for **${target}**${symbol && symbol !== 'ALL' ? ` on **${symbol}**` : ''}. Run /wisdo-bot-lanes to see what WISDO currently knows.`);
        }
        const queued = [];
        for (const lane of lanes) {
          const payload = closePayloadFromLane(lane, mode, percent);
          const record = await queueCommand(context, interaction, payload.command, payload);
          queued.push({ lane, record });
        }
        return safeEditReply(interaction, [
          `🛑 **Close command queued for ${target}.**`,
          '',
          ...queued.slice(0, 12).map(({ lane, record }) => `• ${shortValue(laneTitle(lane), 90)} → Command ID: \`${record.id}\``),
          queued.length > 12 ? `\nQueued ${queued.length} total lanes; showing first 12.` : '',
          '',
          'The MT4 Reporter will execute this by symbol + magic number, so one bot nickname does not accidentally close another bot lane.',
        ].join('\n'));
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('wisdo-bot-command')
        .setDescription('Natural bot nickname command, example: close all Deadpool trades.')
        .addStringOption((option) => option.setName('prompt').setDescription('Tell WISDO what to do.').setRequired(true)),
      async execute(interaction) {
        await safeDefer(interaction);
        const prompt = interaction.options.getString('prompt', true);
        const lower = prompt.toLowerCase();
        const closeIntent = /\b(close|flatten|exit|liquidate)\b/.test(lower);
        if (!closeIntent) {
          return interaction.editReply('For now this nickname command supports close/flatten/exit. Use `/wisdo-adaptive-set` for number overrides.');
        }
        const lanes = await context.botRegistryService?.listLanes(interaction.user.id, { includeStale: true });
        const targetLane = lanes?.find((lane) => {
          const words = [lane.botNickname, lane.botKey, lane.botLabel].filter(Boolean).map((x) => x.toLowerCase());
          return words.some((word) => word && lower.includes(word.toLowerCase()));
        });
        if (!targetLane) return interaction.editReply('I heard a close command, but I could not match the bot nickname. Run `/wisdo-bot-lanes` or set one with `/wisdo-nickname-bot`.');
        const mode = lower.includes('winner') || lower.includes('profit') ? 'winners' : lower.includes('loser') || lower.includes('loss') ? 'losers' : 'all';
        const payload = closePayloadFromLane(targetLane, mode, 100);
        const record = await queueCommand(context, interaction, payload.command, payload);
        return interaction.editReply(`🧠 WISDO resolved **${prompt}** → **${laneTitle(targetLane)}**. Command queued: \`${record.id}\`.`);
      },
    },
  ];
  return { commands, modalHandlers: new Map() };
}
