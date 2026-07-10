import { existsSync } from 'node:fs';
import path from 'node:path';

import { AttachmentBuilder, EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import { formatCurrency } from '../utils/operatorDesk.js';
import { safeSendUserMessage } from '../services/safeDiscordDelivery.js';
import { getDateLabel, getTimeLabel, getTimestampLabel } from '../utils/time.js';

async function resolveMember(interaction, optionName) {
  const cached = interaction.options.getMember(optionName);
  if (cached) {
    return cached;
  }

  const user = interaction.options.getUser(optionName);
  if (!user) {
    return null;
  }

  return interaction.guild.members.fetch(user.id).catch(() => null);
}

function yesNo(value) {
  return value ? 'Yes' : 'No';
}

function formatStatusText(value) {
  return String(value || 'unknown')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getFreshnessLabel(status) {
  if (!status.latestSnapshot) {
    return 'No snapshot received yet';
  }

  if (status.freshness.isFresh) {
    return 'Fresh';
  }

  if (typeof status.freshness.ageMinutes === 'number') {
    return `Stale (${status.freshness.ageMinutes.toFixed(1)} minutes old)`;
  }

  return 'Stale';
}

function buildWarningSection(status) {
  if (!Array.isArray(status.warnings) || status.warnings.length === 0) {
    return [];
  }

  return ['', '**Warnings:**', ...status.warnings.map((warning) => `- ${warning}`)];
}

function getReporterDelivery() {
  const reporterDir = path.resolve(process.cwd(), 'mql4');
  const packagePath = path.join(reporterDir, 'CultureCoin_MT4_Reporter_Package.zip');
  const compiledPath = path.join(reporterDir, 'CultureCoin_MT4_Reporter.ex4');
  const sourcePath = path.join(reporterDir, 'CultureCoin_MT4_Reporter.mq4');
  const setupPath = path.join(reporterDir, 'CultureCoin_MT4_Reporter_SETUP.txt');
  const files = [];
  const notes = [];

  if (existsSync(packagePath)) {
    files.push(
      new AttachmentBuilder(packagePath, {
        name: 'CultureCoin_MT4_Reporter_Package.zip',
      }),
    );
  }

  if (existsSync(compiledPath)) {
    files.push(
      new AttachmentBuilder(compiledPath, {
        name: 'CultureCoin_MT4_Reporter.ex4',
      }),
    );
  }

  if (existsSync(sourcePath)) {
    files.push(
      new AttachmentBuilder(sourcePath, {
        name: 'CultureCoin_MT4_Reporter.mq4',
      }),
    );
  }

  if (existsSync(setupPath)) {
    files.push(
      new AttachmentBuilder(setupPath, {
        name: 'CultureCoin_MT4_Reporter_SETUP.txt',
      }),
    );
  }

  if (existsSync(packagePath) && existsSync(compiledPath) && existsSync(sourcePath)) {
    notes.push('Reporter package is attached below: a zip bundle, the compiled `.ex4`, the editable `.mq4` source, and a quick setup guide.');
  } else if (existsSync(compiledPath) && existsSync(sourcePath)) {
    notes.push('Reporter files are attached below: the compiled `.ex4`, the editable `.mq4` source, and the setup guide.');
  } else if (existsSync(compiledPath)) {
    notes.push('Reporter file is attached below: `CultureCoin_MT4_Reporter.ex4`.');
  } else if (existsSync(sourcePath)) {
    notes.push(
      'Reporter v1.55 source is attached below: `CultureCoin_MT4_Reporter.mq4`. Compile it in MetaEditor, replace the older Reporter on every follower terminal, and confirm the chart dashboard says v1.55 before testing lead-close relay.',
    );
  } else {
    notes.push('Reporter files are not bundled in this bot workspace yet, so ask staff for the MT4 reporter package.');
  }

  return {
    files,
    note: notes.join('\n'),
  };
}

function buildNoSnapshotEmbed(status, mt4SyncService) {
  const pairing = status.pairing;
  const setupWarnings = buildWarningSection(status);
  const setupSteps = [
    '1. Run /connect-mt4 if you still need a pairing code.',
    '2. Compile the attached CultureCoin_MT4_Reporter.mq4 in MetaEditor and install the resulting v1.55 EX4 into MQL4 -> Experts.',
    '3. Remove the older Reporter, then attach the newly compiled Reporter v1.55 to any chart.',
    `4. Set SyncUrl to ${mt4SyncService.getSyncUrl()}.`,
  ];

  if (mt4SyncService.requiresApiKey()) {
    setupSteps.push('5. Paste the MT4 sync API key into the Reporter EA ApiKey input.');
    setupSteps.push(`6. Allow WebRequest for ${mt4SyncService.getPublicBaseUrl()}.`);
    setupSteps.push('7. Make sure AutoTrading is ON.');
  } else {
    setupSteps.push(`5. Allow WebRequest for ${mt4SyncService.getPublicBaseUrl()}.`);
    setupSteps.push('6. Make sure AutoTrading is ON.');
  }

  return new EmbedBuilder()
    .setTitle('\u{1F4CA} MT4 ACCOUNT STATUS')
    .setColor(0x95a5a6)
    .setDescription(
      [
        '**No MT4 snapshot has been received yet.**',
        '',
        `**Connection Status:** ${formatStatusText(status.connectionState)}`,
        `**Last Pairing Status:** ${pairing ? formatStatusText(pairing.status) : 'No pairing code issued yet'}`,
        pairing?.pairingCode ? `**Pairing Code:** ${pairing.pairingCode}` : null,
        pairing?.expiresAt ? `**Pairing Expires:** ${getTimestampLabel(new Date(pairing.expiresAt))}` : null,
        status.connection?.lastSyncAt
          ? `**Last Successful Sync:** ${getTimestampLabel(new Date(status.connection.lastSyncAt))}`
          : null,
        '',
        'Setup checklist:',
        ...setupSteps,
        ...setupWarnings,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .setTimestamp(new Date());
}

function buildSnapshotEmbed(student, status) {
  const snapshot = status.latestSnapshot.snapshot;
  const syncedAt = new Date(status.latestSnapshot.receivedAt);
  const warningSection = buildWarningSection(status);

  return new EmbedBuilder()
    .setTitle('\u{1F4CA} MT4 ACCOUNT STATUS')
    .setColor(status.freshness.isFresh ? 0x2ecc71 : 0xf39c12)
    .setDescription(
      [
        `**Student:** ${student.mention}`,
        `**Date:** ${getDateLabel(syncedAt)}`,
        `**Time:** ${getTimeLabel(syncedAt)}`,
        `**Connection Status:** ${formatStatusText(status.connectionState)}`,
        `**Pairing Status:** ${formatStatusText(status.pairing?.status || 'connected')}`,
        `**Snapshot Freshness:** ${getFreshnessLabel(status)}`,
        `**Account:** ${status.connection?.accountNumber || snapshot.accountNumber || 'N/A'}`,
        `**Server:** ${snapshot.brokerServer || 'N/A'}`,
        `**Demo/Live:** ${snapshot.isDemo ? 'Demo' : 'Live'}`,
        `**EA:** ${snapshot.eaName || 'N/A'}`,
        `**EA Version:** ${snapshot.eaVersion || 'N/A'}`,
        `**Magic Number Filter:** ${snapshot.magicNumberFilter || 0}`,
        `**Symbol Filter:** ${snapshot.symbolFilter || 'All symbols'}`,
        '',
        `**Balance:** ${formatCurrency(snapshot.balance)}`,
        `**Equity:** ${formatCurrency(snapshot.equity)}`,
        `**Floating P/L:** ${formatCurrency(snapshot.floatingPL)}`,
        `**Daily Closed P/L:** ${formatCurrency(snapshot.dailyClosedPL)}`,
        `**Margin:** ${formatCurrency(snapshot.margin)}`,
        `**Free Margin:** ${formatCurrency(snapshot.freeMargin)}`,
        `**Margin Level:** ${snapshot.marginLevel !== null && snapshot.marginLevel !== undefined ? `${snapshot.marginLevel.toFixed(2)}%` : 'N/A'}`,
        `**Open Trades:** ${snapshot.openTradeCount}`,
        `**Buy Trades:** ${snapshot.buyTradeCount}`,
        `**Sell Trades:** ${snapshot.sellTradeCount}`,
        `**Total Lots:** ${snapshot.totalLots ?? 'N/A'}`,
        `**Symbols:** ${snapshot.symbols.length ? snapshot.symbols.join(', ') : 'N/A'}`,
        `**Last Sync:** ${getTimestampLabel(syncedAt)}${status.freshness.isFresh || typeof status.freshness.ageMinutes !== 'number' ? '' : ` (${status.freshness.ageMinutes.toFixed(1)} minutes old)`}`,
        `**Terminal Connected:** ${yesNo(snapshot.terminalConnected)}`,
        `**Expert Enabled:** ${yesNo(snapshot.expertEnabled)}`,
        ...warningSection,
      ].join('\n'),
    )
    .setTimestamp(syncedAt);
}


async function safeDeferReply(interaction, options = { ephemeral: true }) {
  if (interaction.deferred || interaction.replied) return true;
  try {
    await interaction.deferReply(options);
    return true;
  } catch (error) {
    // DiscordAPIError[10062] Unknown interaction means Discord already expired the token.
    // Returning false prevents the command from continuing and causing noisy follow-up failures.
    if (error?.code === 10062 || String(error?.message || '').includes('Unknown interaction')) {
      return false;
    }
    throw error;
  }
}


async function resolveConnectContext(interaction, service) {
  // Pairing must not silently fail just because the user is outside an
  // operator desk. When a desk exists, use the desk owner. Otherwise tie the
  // code directly to the Discord user who ran the command.
  try {
    if (service?.findDeskContextByChannel && interaction?.channel) {
      const deskContext = await service.findDeskContextByChannel(interaction.channel);
      if (deskContext?.deskUserId) {
        const isStaff = service.isStaff?.(interaction.member) || false;
        const isDeskOwner = String(interaction.user?.id || '') === String(deskContext.deskUserId || '');
        if (isDeskOwner || isStaff) {
          return {
            ...deskContext,
            isStaff,
            isDeskOwner,
            source: 'operator_desk',
            fallback: false,
          };
        }
      }
    }
  } catch {
    // Fall through to direct user pairing. The connect command should remain
    // available even if desk lookup is temporarily unavailable.
  }

  return {
    deskUserId: String(interaction.user?.id || '').trim(),
    deskChannel: interaction.channel || null,
    isStaff: false,
    isDeskOwner: true,
    source: 'direct_discord_user',
    fallback: true,
  };
}

async function executeConnectMt4(interaction, { service, mt4SyncService }) {
  if (!(await safeDeferReply(interaction, { ephemeral: true }))) return;
  const context = await resolveConnectContext(interaction, service);
  if (!context?.deskUserId) {
    await interaction.editReply('I could not read your Discord user ID. Try the command again from Discord.');
    return;
  }
  const role = interaction.options.getString('role') || 'private';
  const pairing = await mt4SyncService.issuePairingCode({
    discordUserId: context.deskUserId,
    channelId: interaction.channel?.id || '',
    requestedByUserId: interaction.user.id,
    accountNickname: interaction.options.getString('name') || '',
    accountRole: role,
    copyPermission: role === 'leader' || role === 'both' ? 'signal_only' : 'private',
    forceNew: true,
  });
  const delivery = getReporterDelivery();
  const content = [
    context.fallback
      ? '✅ MT4 pairing code generated directly for your Discord user. You can run this from any channel; private desks are optional for initial connection.'
      : null,
    mt4SyncService.buildConnectInstructions(pairing),
    delivery.files.length ? 'I also posted the MT4 reporter download package in this channel so it stays available from channel history.' : delivery.note,
  ].filter(Boolean).join('\n\n');
  await interaction.editReply({ content });
  await safeSendUserMessage({
    user: interaction.user,
    userId: context.deskUserId,
    guild: interaction.guild,
    client: interaction.client,
    operatorDeskService: service,
    interaction,
    content,
    ephemeralFallbackContent: 'I could not DM the pairing code, so I kept it here. Please enable DMs from this server or use your private operator desk.',
    logger: service?.logger,
    logContext: {
      source: 'connect-pairing-code',
      command: interaction.commandName,
    },
  });
  if (delivery.files.length) {
    await interaction.followUp({ content: delivery.note, files: delivery.files, ephemeral: false });
  }
}

export function buildMt4Commands({ service, mt4SyncService }) {
  const commands = [
    {
      data: new SlashCommandBuilder()
        .setName('connect')
        .setDescription('Generate a pairing code to connect one MT4 account to this desk.')
        .addStringOption((option) => option.setName('name').setDescription('Nickname for this account, e.g. Demo Lead or Live Follower').setRequired(false))
        .addStringOption((option) => option.setName('role').setDescription('Account role').setRequired(false).addChoices(
          { name: 'Leader', value: 'leader' },
          { name: 'Follower', value: 'follower' },
          { name: 'Both', value: 'both' },
          { name: 'Private', value: 'private' },
        )),
      async execute(interaction) {
        return executeConnectMt4(interaction, { service, mt4SyncService });
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('connect-mt4')
        .setDescription('Generate a pairing code to connect one MT4 account to this desk.')
        .addStringOption((option) => option.setName('name').setDescription('Nickname for this account, e.g. Live Copier').setRequired(false))
        .addStringOption((option) => option.setName('role').setDescription('Account role').setRequired(false).addChoices(
          { name: 'Leader', value: 'leader' },
          { name: 'Follower', value: 'follower' },
          { name: 'Both', value: 'both' },
          { name: 'Private', value: 'private' },
        )),
      async execute(interaction) {
        if (!(await safeDeferReply(interaction, { ephemeral: true }))) return;

        const context = await resolveConnectContext(interaction, service);
        if (!context?.deskUserId) {
          await interaction.editReply('I could not read your Discord user ID. Try the command again from Discord.');
          return;
        }
        const pairing = await mt4SyncService.issuePairingCode({
          discordUserId: context.deskUserId,
          channelId: interaction.channel?.id || '',
          requestedByUserId: interaction.user.id,
          accountNickname: interaction.options.getString('name') || '',
          accountRole: interaction.options.getString('role') || 'private',
          copyPermission: interaction.options.getString('role') === 'leader' ? 'signal_only' : 'private',
          forceNew: true,
        });

        const delivery = getReporterDelivery();
        const content = [
          context.fallback
            ? '✅ MT4 pairing code generated directly for your Discord user. You can run this from any channel; private desks are optional for initial connection.'
            : null,
          mt4SyncService.buildConnectInstructions(pairing),
          delivery.files.length
            ? 'I also posted the MT4 reporter download package in this channel so it stays available from channel history.'
            : delivery.note,
        ]
          .filter(Boolean)
          .join('\n\n');

        await interaction.editReply({ content });
        await safeSendUserMessage({
          user: interaction.user,
          userId: context.deskUserId,
          guild: interaction.guild,
          client: interaction.client,
          operatorDeskService: service,
          interaction,
          content,
          ephemeralFallbackContent: 'I could not DM the pairing code, so I kept it here. Please enable DMs from this server or use your private operator desk.',
          logger: service?.logger,
          logContext: {
            source: 'connect-pairing-code',
            command: interaction.commandName,
          },
        });

        if (delivery.files.length) {
          await interaction.followUp({
            content: delivery.note,
            files: delivery.files,
            ephemeral: false,
          });
        }
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('mt4-status')
        .setDescription('Show the latest MT4 snapshot for this desk.'),
      async execute(interaction) {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply();
        }

        const context = await service.requireDeskContext(interaction, { allowStaff: true });
        if (!context) {
          return;
        }
        const [student, status] = await Promise.all([
          service.getStudentDisplay(interaction.guild, context.deskUserId),
          mt4SyncService.getDeskMt4Status(context.deskUserId),
        ]);

        const embed = status.latestSnapshot
          ? buildSnapshotEmbed(student, status)
          : buildNoSnapshotEmbed(status, mt4SyncService);

        await interaction.editReply({
          embeds: [embed],
        });
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('sync-mt4')
        .setDescription('Show the latest MT4 snapshot for a student.')
        .addUserOption((option) =>
          option.setName('member').setDescription('Student to review').setRequired(true),
        ),
      async execute(interaction) {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ ephemeral: true });
        }

        if (!(await service.assertAdminOrCoach(interaction))) {
          return;
        }

        const member = await resolveMember(interaction, 'member');
        if (!member) {
          await interaction.editReply({
            content: 'That member could not be found in this server.',
          });
          return;
        }
        const status = await mt4SyncService.getDeskMt4Status(member.id);

        const embed = status.latestSnapshot
          ? buildSnapshotEmbed(await service.getStudentDisplay(interaction.guild, member.id), status)
          : buildNoSnapshotEmbed(status, mt4SyncService);

        await interaction.editReply({
          embeds: [embed],
        });
      },
    },

    {
      data: new SlashCommandBuilder()
        .setName('my-accounts')
        .setDescription('Show all MT4 accounts connected to your Discord login.'),
      async execute(interaction) {
        if (!(await safeDeferReply(interaction, { ephemeral: true }))) return;

        const context = await service.requireDeskContext(interaction, { allowStaff: true });
        if (!context) return;
        const accounts = mt4SyncService.repository.getMt4Accounts
          ? await mt4SyncService.repository.getMt4Accounts(context.deskUserId)
          : [];
        if (!accounts.length) {
          await interaction.editReply('No MT4 accounts are connected yet. Run `/connect-mt4` for each MT4 terminal/account.');
          return;
        }
        await interaction.editReply(accounts.map((account, index) => [
          `**${index + 1}. ${account.nickname || account.accountNickname || account.accountNumber}**${account.isPrimary ? ' ⭐ active' : ''}`,
          `Account: \`${account.accountNumber}\``,
          `Server: ${account.brokerServer || 'unknown'}`,
          `Role: ${account.accountRole || 'private'}`,
          `Last sync: ${account.lastSyncAt || 'never'}`,
          `Account ID: \`${account.accountId}\``,
        ].join('\n')).join('\n\n'));
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('set-account-role')
        .setDescription('Set one of your MT4 accounts as leader, follower, both, or private.')
        .addStringOption((option) => option.setName('account_id').setDescription('Use /my-accounts to copy the Account ID').setRequired(true))
        .addStringOption((option) => option.setName('role').setDescription('Account role').setRequired(true).addChoices(
          { name: 'Leader - creates trade signals', value: 'leader' },
          { name: 'Follower - receives copied trades', value: 'follower' },
          { name: 'Both - can create and receive', value: 'both' },
          { name: 'Private - no public/copy signals', value: 'private' },
        )),
      async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const accountId = interaction.options.getString('account_id');
        const role = interaction.options.getString('role');
        const updated = await mt4SyncService.repository.updateMt4AccountSettings(interaction.user.id, accountId, {
          accountRole: role,
          copyPermission: role === 'leader' || role === 'both' ? 'signal_only' : 'private',
        });
        if (!updated) {
          await interaction.editReply('That account ID was not found under your Discord login. Run `/my-accounts` and copy the exact Account ID.');
          return;
        }
        await interaction.editReply(`✅ Account role updated.
Account: **${updated.nickname || updated.accountNumber}**
Role: **${role}**
Signals: ${role === 'leader' || role === 'both' ? 'enabled' : 'disabled'}`);
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('set-active-account')
        .setDescription('Set the MT4 account WISDO should use by default for Discord commands/buttons.')
        .addStringOption((option) => option.setName('account_id').setDescription('Use /my-accounts to copy the Account ID').setRequired(true)),
      async execute(interaction) {
        if (!(await safeDeferReply(interaction, { ephemeral: true }))) return;

        const context = await service.requireDeskContext(interaction, { allowStaff: true });
        if (!context) return;
        const accountId = interaction.options.getString('account_id');
        const selected = mt4SyncService.repository.setPrimaryMt4Account
          ? await mt4SyncService.repository.setPrimaryMt4Account(context.deskUserId, accountId)
          : null;
        if (!selected) {
          await interaction.editReply('That account ID was not found under your Discord login. Run `/my-accounts` and copy the exact Account ID.');
          return;
        }
        await interaction.editReply(`✅ Active MT4 account set to **${selected.nickname || selected.accountNumber}** (${selected.brokerServer || 'server unknown'}).`);
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('my-id')
        .setDescription('Show your Discord user ID privately.'),
      async execute(interaction) {
        await interaction.reply({
          content: `Your Discord user ID is: ${interaction.user.id}`,
          ephemeral: true,
        });
      },
    },
  ];

  return {
    commands,
    modalHandlers: new Map(),
  };
}
