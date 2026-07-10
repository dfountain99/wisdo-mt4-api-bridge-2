import { SlashCommandBuilder } from 'discord.js';

function apiBase(config = {}) {
  return String(process.env.PUBLIC_BASE_URL || config?.api?.publicBaseUrl || `http://localhost:${config?.api?.port || 3000}`).replace(/\/$/, '');
}

async function apiJson(config, path, options = {}) {
  const res = await fetch(`${apiBase(config)}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.DISCORD_COMMAND_API_SECRET ? { 'X-Discord-Command-Secret': process.env.DISCORD_COMMAND_API_SECRET } : {}),
      ...(options.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({ ok: false, error: `Bad response ${res.status}` }));
  return { res, json };
}

function money(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function signedMoney(value) {
  const n = Number(value || 0);
  return `${n >= 0 ? '+' : '-'}${money(Math.abs(n)).slice(1)}`;
}

function statusLine(json) {
  const membership = json.membership || {};
  const connection = json.connection || json.discordConnection || null;
  const live = json.liveAccount || {};
  const metrics = live.metrics || {};
  return [
    `Website paired: **${connection ? 'yes' : 'no'}**`,
    `Role: **${membership.role || 'unknown'}**`,
    `Subscription: **${membership.subscription_status || 'unknown'}**`,
    `Reporter: **available**`,
    `Copier: **${membership.canCopyTrades ? 'unlocked' : 'locked'}**`,
    `Bridge: **${live.live ? (live.stale ? 'stale' : 'live') : 'waiting'}**`,
    `Balance: **${money(metrics.balance)}** | Equity: **${money(metrics.equity)}** | Floating: **${signedMoney(metrics.floatingPL)}**`,
    `Open trades: **${Number(metrics.openTradeCount || 0)}**`,
  ].join('\n');
}


export function buildWisdoCommandCenterCommands({ config }) {
  const commands = [
    {
      data: new SlashCommandBuilder()
        .setName('pair')
        .setDescription('Pair Discord with the Culture Coin / Deadshot website.')
        .addSubcommand((sub) => sub.setName('generate').setDescription('Generate a 15-minute pairing code from Discord.'))
        .addSubcommand((sub) => sub.setName('connect').setDescription('Connect Discord using a website-generated code.').addStringOption((o) => o.setName('code').setDescription('Example: CEM-ABCD-1234').setRequired(true)))
        .addSubcommand((sub) => sub.setName('status').setDescription('Show Discord + website pairing status.'))
        .addSubcommand((sub) => sub.setName('sync').setDescription('Force a website + Discord sync event.'))
        .addSubcommand((sub) => sub.setName('disconnect').setDescription('Disconnect Discord from the website account.')),
      async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const sub = interaction.options.getSubcommand();
        if (sub === 'generate') {
          const { json } = await apiJson(config, '/api/discord/pairing-code', { method: 'POST', body: JSON.stringify({ discordUserId: interaction.user.id, discordUsername: interaction.user.username, guildId: interaction.guildId }) });
          await interaction.editReply(json.ok ? `🔗 **Pairing Code Generated**\nCode: \`${json.code}\`\nExpires: ${json.expiresAt}\nEnter this on the website Account Connection page.` : `⚠️ ${json.error || 'Could not generate pairing code.'}`);
          return;
        }
        if (sub === 'connect') {
          const code = interaction.options.getString('code', true);
          const { json } = await apiJson(config, '/api/discord/connect', { method: 'POST', body: JSON.stringify({ code, discordUserId: interaction.user.id, discordUsername: interaction.user.username, guildId: interaction.guildId }) });
          await interaction.editReply(json.ok ? '✅ **Discord connected.** Website will show Discord connected and sync events will flow both ways.' : `⚠️ ${json.error || 'Pairing failed.'}`);
          return;
        }
        if (sub === 'status') {
          const { json } = await apiJson(config, `/api/discord/status?discordUserId=${encodeURIComponent(interaction.user.id)}`);
          await interaction.editReply(json.ok ? `📡 **Wisdo Pair Status**\n${statusLine(json)}` : `⚠️ ${json.error || 'Status unavailable.'}`);
          return;
        }
        if (sub === 'sync') {
          const { json } = await apiJson(config, '/api/discord/sync', { method: 'POST', body: JSON.stringify({ discordUserId: interaction.user.id, source: 'discord', target: 'website', action: 'manual_discord_sync', payload: { guildId: interaction.guildId } }) });
          await interaction.editReply(json.ok ? '🔄 **Sync completed.** Website notification chat has been updated.' : `⚠️ ${json.error || 'Sync failed.'}`);
          return;
        }
        if (sub === 'disconnect') {
          const { json } = await apiJson(config, '/api/discord/disconnect', { method: 'POST', body: JSON.stringify({ discordUserId: interaction.user.id }) });
          await interaction.editReply(json.ok ? '🔌 **Discord disconnected** from website sync.' : `⚠️ ${json.error || 'Disconnect failed.'}`);
        }
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('account')
        .setDescription('View or sync trading account configuration.')
        .addSubcommand((sub) => sub.setName('status').setDescription('Show account, membership, reporter, and copier status.'))
        .addSubcommand((sub) => sub.setName('config').setDescription('Sync account configuration from Discord to website.').addStringOption((o) => o.setName('risk-mode').setDescription('normal, conservative, aggressive')).addStringOption((o) => o.setName('bot-mode').setDescription('trend_protect, consolidation, protect, manual_assist')).addNumberOption((o) => o.setName('daily-goal').setDescription('Daily profit target percent')).addNumberOption((o) => o.setName('max-drawdown').setDescription('Max daily drawdown percent'))),
      async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const sub = interaction.options.getSubcommand();
        if (sub === 'status') {
          const { json } = await apiJson(config, `/api/discord/status?discordUserId=${encodeURIComponent(interaction.user.id)}`);
          await interaction.editReply(json.ok ? `📊 **Account Status**\n${statusLine(json)}` : `⚠️ ${json.error || 'Account status unavailable.'}`);
          return;
        }
        const payload = {
          risk_mode: interaction.options.getString('risk-mode') || undefined,
          bot_mode: interaction.options.getString('bot-mode') || undefined,
          daily_profit_target: interaction.options.getNumber('daily-goal') ?? undefined,
          max_daily_drawdown: interaction.options.getNumber('max-drawdown') ?? undefined,
        };
        const { json } = await apiJson(config, '/api/discord/sync', { method: 'POST', body: JSON.stringify({ discordUserId: interaction.user.id, source: 'discord', target: 'website', action: 'account_configuration_updated', payload }) });
        await interaction.editReply(json.ok ? '🌐 **Discord Control:** account configuration synced to the website.' : `⚠️ ${json.error || 'Config sync failed.'}`);
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('copier')
        .setDescription('Control or inspect Culture Coin Copier Engine access.')
        .addSubcommand((sub) => sub.setName('status').setDescription('Show copier locked/unlocked state.'))
        .addSubcommand((sub) => sub.setName('pause').setDescription('Pause copier if active membership gate passes.'))
        .addSubcommand((sub) => sub.setName('resume').setDescription('Resume copier if active membership gate passes.'))
        .addSubcommand((sub) => sub.setName('close-profitable').setDescription('Close all profitable trades through the MT4 reporter.'))
        .addSubcommand((sub) => sub.setName('close-all').setDescription('Close all trades through the MT4 reporter.'))
        .addSubcommand((sub) => sub.setName('emergency-close').setDescription('Emergency close all trades through the MT4 reporter.')),
      async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const sub = interaction.options.getSubcommand();
        if (sub === 'status') {
          const { json } = await apiJson(config, `/api/discord/status?discordUserId=${encodeURIComponent(interaction.user.id)}`);
          await interaction.editReply(json.ok ? `🧬 **Copier Engine**\n${statusLine(json)}\n\nReporter remains available even when copier is locked.` : `⚠️ ${json.error || 'Copier status unavailable.'}`);
          return;
        }
        const actionMap = {
          pause: 'copier_pause',
          resume: 'copier_resume',
          'close-profitable': 'close_profitable',
          'close-all': 'close_all',
          'emergency-close': 'emergency_close',
        };
        const action = actionMap[sub] || sub;
        const { json } = await apiJson(config, '/api/discord/command-event', { method: 'POST', body: JSON.stringify({ discordUserId: interaction.user.id, action, payload: { requestedBy: interaction.user.username, guildId: interaction.guildId } }) });
        await interaction.editReply(json.ok ? `⚡ **Command Queued:** ${action} mapped to **${json.mt4Command || action}**. Waiting for MT4 reporter poll/completion. Command ID: \`${json.commandId || 'sync-only'}\`` : `🔒 **Copier Blocked:** ${json.error || 'Active Culture Coin membership is required.'}`);
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('wisdo-coach')
        .setDescription('Send a wake-word style Wisdo command to the website + MT4 reporter bridge.')
        .addStringOption((o) => o.setName('command').setDescription('Example: hey coach close all profitable trades').setRequired(true)),
      async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const rawText = interaction.options.getString('command', true);
        const { json } = await apiJson(config, '/api/wisdo/command', { method: 'POST', body: JSON.stringify({ discordUserId: interaction.user.id, rawText, source: 'discord_wake_word', guildId: interaction.guildId }) });
        await interaction.editReply(json.ok ? `🧠 **Wisdo deciphered:** \`${rawText}\` → **${json.mt4Command}**
Command ID: \`${json.commandId}\`
Waiting for MT4 reporter completion.` : `🔒 **Wisdo blocked:** ${json.error || 'Active Culture Coin membership, copier enabled, and connected bridge required.'}`);
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('reporter')
        .setDescription('Show Culture Coin Reporter status.')
        .addSubcommand((sub) => sub.setName('status').setDescription('Reporter status for free, inactive, and active users.')),
      async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const { json } = await apiJson(config, `/api/discord/status?discordUserId=${encodeURIComponent(interaction.user.id)}`);
        await interaction.editReply(json.ok ? `🟣 **Culture Coin Reporter**\nReporter: **available**\nCopier: **${json.membership?.canCopyTrades ? 'unlocked' : 'locked'}**\n${json.membership?.canCopyTrades ? 'Active member execution gate passed.' : 'Reporter remains on. Trade copying requires active Culture Coin membership.'}` : `Reporter is available in the website after login. Pair Discord for synced alerts.`);
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('wisdo-notifications')
        .setDescription('Show recent Wisdo website + Discord notification events.'),
      async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const { json } = await apiJson(config, `/api/discord/notifications?discordUserId=${encodeURIComponent(interaction.user.id)}&limit=5`);
        if (!json.ok) return interaction.editReply(`⚠️ ${json.error || 'No paired notifications found.'}`);
        const lines = json.notifications?.length ? json.notifications.map((event) => event.discordMessage).join('\n\n') : 'No notifications yet.';
        await interaction.editReply(`🔔 **Wisdo Live Notification Chat**\n\n${lines}`);
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('wisdo-help')
        .setDescription('Show website + Discord command center commands.'),
      async execute(interaction) {
        await interaction.reply({ ephemeral: true, content: [
          '🤖 **Wisdo Website + Discord Command Center**',
          '`/pair generate` — create Discord pairing code',
          '`/pair connect code:<code>` — connect website-generated code',
          '`/pair status` — view sync state',
          '`/account status` — view account/membership status',
          '`/account config` — sync account settings to website',
          '`/copier status|pause|resume|close-profitable|close-all|emergency-close` — gated copier commands',
          '`/reporter status` — Reporter access status',
          '`/wisdo-coach command:<text>` — wake-word trading command',
          '`/wisdo-notifications` — recent synced alerts',
        ].join('\n') });
      },
    },
  ];
  return { commands, modalHandlers: new Map() };
}
