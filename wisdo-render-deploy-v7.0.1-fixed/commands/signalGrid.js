import { SlashCommandBuilder } from 'discord.js';

function apiBase(config = {}) {
  return String(process.env.PUBLIC_BASE_URL || config?.api?.publicBaseUrl || `http://localhost:${config?.api?.port || 3000}`).replace(/\/$/, '');
}

async function apiJson(config, path, options = {}) {
  const res = await fetch(`${apiBase(config)}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const json = await res.json().catch(() => ({ ok: false, error: `Bad response ${res.status}` }));
  return { res, json };
}

export function buildSignalGridCommands({ config, discordSignalGridService }) {
  async function requireSignalGridAdmin(interaction) {
    const access = discordSignalGridService?.getUserAccess ? await discordSignalGridService.getUserAccess(interaction.user.id) : { gates: {} };
    if (access.gates?.admin) return { ok: true, access };
    return { ok: false, access, message: 'OWNER, WISDO, or admin access is required for Signal Grid admin commands.' };
  }

  const commands = [
    {
      data: new SlashCommandBuilder()
        .setName('signal-grid')
        .setDescription('Admin controls for the no-spam Wisdo Signal Grid.')
        .addSubcommand((sub) => sub.setName('setup').setDescription('Create or repair the pinned signal grid in this channel.'))
        .addSubcommand((sub) => sub.setName('refresh').setDescription('Force refresh the pinned grid message.'))
        .addSubcommand((sub) => sub.setName('repair').setDescription('Recreate the pinned grid if it is missing.'))
        .addSubcommand((sub) => sub.setName('status').setDescription('Show Signal Grid status.'))
        .addSubcommand((sub) => sub.setName('clear-expired').setDescription('Clear expired signal cells.'))
        .addSubcommand((sub) => sub.setName('set-channel').setDescription('Set this channel as the signal grid channel.'))
        .addSubcommand((sub) => sub.setName('percent-mode').setDescription('Set basket percent mode.').addStringOption((o) => o.setName('mode').setDescription('balance, equity, allocated, basket_risk').setRequired(true).addChoices(
          { name: 'balance', value: 'balance' },
          { name: 'equity', value: 'equity' },
          { name: 'allocated', value: 'allocated' },
          { name: 'basket_risk', value: 'basket_risk' },
        )))
        .addSubcommand((sub) => sub.setName('toggle-copy').setDescription('Enable or disable Signal Grid copy buttons.').addBooleanOption((o) => o.setName('enabled').setDescription('Copy buttons enabled?').setRequired(true))),
      async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const sub = interaction.options.getSubcommand();
        const channelId = interaction.channelId;
        const guildId = interaction.guildId;
        const admin = await requireSignalGridAdmin(interaction);
        if (!admin.ok) {
          await interaction.editReply(admin.message);
          return;
        }
        if (sub === 'setup' || sub === 'set-channel') {
          const { json } = await apiJson(config, '/api/wisdo/admin/signal-grid/setup', { method: 'POST', body: JSON.stringify({ userId: interaction.user.id, guildId, channelId, actorUserId: interaction.user.id }) });
          if (json.ok && discordSignalGridService) await discordSignalGridService.ensurePinnedGridMessage(guildId, channelId);
          await interaction.editReply(json.ok ? `Signal Grid channel saved. Pinned grid is ready in <#${channelId}>.` : `Could not set up Signal Grid: ${json.error || 'unknown error'}`);
          return;
        }
        if (sub === 'refresh') {
          const result = discordSignalGridService ? await discordSignalGridService.updatePinnedGridMessage(channelId).catch((error) => ({ ok: false, error: error.message })) : { ok: false, error: 'Discord service unavailable' };
          await interaction.editReply(result.ok || result.skipped ? `Signal Grid refreshed: ${result.skipped ? result.reason : result.messageId}` : `Refresh failed: ${result.error}`);
          return;
        }
        if (sub === 'repair') {
          const result = discordSignalGridService ? await discordSignalGridService.repairMissingPinnedMessage(channelId).catch((error) => ({ ok: false, error: error.message })) : { ok: false, error: 'Discord service unavailable' };
          await interaction.editReply(result.ok ? `Pinned Signal Grid repaired: ${result.messageId}` : `Repair failed: ${result.error}`);
          return;
        }
        if (sub === 'status') {
          const { json } = await apiJson(config, `/api/wisdo/admin/signal-grid?userId=${encodeURIComponent(interaction.user.id)}`);
          await interaction.editReply(json.ok ? `Signal Grid: ${json.cells?.length || 0} cells, ${Object.keys(json.channels || {}).length} channel(s), mode ${json.settings?.percentMode || 'balance'}.` : `Status failed: ${json.error || 'unknown error'}`);
          return;
        }
        if (sub === 'clear-expired') {
          const { json } = await apiJson(config, '/api/wisdo/admin/signal-grid/refresh', { method: 'POST', body: JSON.stringify({ userId: interaction.user.id, clearExpired: true }) });
          await interaction.editReply(json.ok ? `Expired signals checked. Cleared: ${json.expired?.expired || 0}` : `Clear failed: ${json.error || 'unknown error'}`);
          return;
        }
        if (sub === 'percent-mode') {
          const mode = interaction.options.getString('mode', true);
          const { json } = await apiJson(config, '/api/wisdo/admin/signal-grid/settings', { method: 'PATCH', body: JSON.stringify({ userId: interaction.user.id, percentMode: mode }) });
          await interaction.editReply(json.ok ? `Signal Grid percent mode set to ${mode}.` : `Mode update failed: ${json.error || 'unknown error'}`);
          return;
        }
        if (sub === 'toggle-copy') {
          const enabled = interaction.options.getBoolean('enabled', true);
          const { json } = await apiJson(config, '/api/wisdo/admin/signal-grid/settings', { method: 'PATCH', body: JSON.stringify({ userId: interaction.user.id, copyButtonsEnabled: enabled }) });
          await interaction.editReply(json.ok ? `Signal Grid copy buttons ${enabled ? 'enabled' : 'disabled'}.` : `Toggle failed: ${json.error || 'unknown error'}`);
        }
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('signals')
        .setDescription('Show a private Wisdo Signal Grid summary.')
        .addStringOption((o) => o.setName('pair').setDescription('Filter by pair/symbol, e.g. XAUUSD'))
        .addStringOption((o) => o.setName('bot').setDescription('Filter by bot id/name'))
        .addStringOption((o) => o.setName('category').setDescription('Filter category').addChoices(
          { name: 'Gold', value: 'Gold' },
          { name: 'Forex', value: 'Forex' },
          { name: 'Indices', value: 'Indices' },
          { name: 'FLOW', value: 'FLOW' },
          { name: 'PIP DRILL', value: 'PIP DRILL' },
          { name: 'Premium', value: 'Premium' },
        )),
      async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const params = new URLSearchParams();
        const pair = interaction.options.getString('pair');
        const bot = interaction.options.getString('bot');
        const category = interaction.options.getString('category');
        if (pair) params.set('symbol', pair);
        if (bot) params.set('bot', bot);
        if (category) params.set('market', category);
        params.set('activeOnly', 'true');
        const { json } = await apiJson(config, `/api/wisdo/signal-grid?userId=${encodeURIComponent(interaction.user.id)}&${params.toString()}`);
        const cells = (json.cells || []).slice(0, 10);
        const lines = cells.length
          ? cells.map((cell) => `${cell.emoji || '-'} ${cell.symbol} | ${cell.botName} | ${cell.direction} | ${Number(cell.basketGrowthPercent || 0).toFixed(1)}% | ${cell.openTradeCount || 0} trades`).join('\n')
          : 'No active signals matched those filters.';
        await interaction.editReply(`${lines}\n\nWebsite Grid: ${apiBase(config)}/member/signal-grid`);
      },
    },
    {
      data: new SlashCommandBuilder().setName('my-copies').setDescription('Show your Wisdo Signal Grid bot copy subscriptions.'),
      async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const { json } = await apiJson(config, `/api/wisdo/signal-grid/my-copies?userId=${encodeURIComponent(interaction.user.id)}`);
        const lines = json.copies?.length ? json.copies.map((copy) => `• ${copy.botId} · ${copy.status} · ${copy.paperMode ? 'paper' : 'live'}`).join('\n') : 'No Signal Grid bot subscriptions yet.';
        await interaction.editReply(lines);
      },
    },
    {
      data: new SlashCommandBuilder().setName('copy-status').setDescription('Show Signal Grid copy eligibility status.'),
      async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const access = discordSignalGridService?.getUserAccess ? await discordSignalGridService.getUserAccess(interaction.user.id) : { gates: {} };
        const { json } = await apiJson(config, `/api/wisdo/signal-grid/my-copies?userId=${encodeURIComponent(interaction.user.id)}`);
        await interaction.editReply([
          `Access level: ${access.accessLevel || 'none'}`,
          `Premium/copier eligible: ${access.gates?.copier ? 'yes' : 'no'}`,
          `Open subscriptions: ${(json.copies || []).filter((copy) => copy.status === 'active').length}`,
          `Selected account/risk settings: open ${apiBase(config)}/member/risk-profile to review or edit.`,
        ].join('\n'));
      },
    },
    {
      data: new SlashCommandBuilder().setName('stop-copy').setDescription('Stop copying future signals from a bot.').addStringOption((o) => o.setName('bot').setDescription('Bot id').setRequired(true)),
      async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const botId = interaction.options.getString('bot', true);
        const { json } = await apiJson(config, '/api/wisdo/signal-grid/unsubscribe-bot', { method: 'POST', body: JSON.stringify({ userId: interaction.user.id, botId }) });
        await interaction.editReply(json.ok ? `Stopped Signal Grid copy for ${botId}.` : `Stop failed: ${json.error || 'not found'}`);
      },
    },
    {
      data: new SlashCommandBuilder().setName('risk-settings').setDescription('Open Wisdo risk settings for Signal Grid copy.'),
      async execute(interaction) {
        await interaction.reply({ ephemeral: true, content: `Risk settings: ${apiBase(config)}/member/risk-profile\nCommand Center: ${apiBase(config)}/member/command-center` });
      },
    },
  ];
  return { commands, modalHandlers: new Map() };
}
