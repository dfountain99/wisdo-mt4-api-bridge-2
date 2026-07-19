import { SlashCommandBuilder } from 'discord.js';


async function settleForModal(promise, fallback, timeoutMs = 650) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise((resolve) => { timer = setTimeout(() => resolve(fallback), timeoutMs); }),
    ]);
  } catch {
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

import { getDateKey, getWeekRange } from '../utils/time.js';

export function buildTradingCommands({ service, wisdoAnalysisService }) {
  const commands = [
    {
      data: new SlashCommandBuilder()
        .setName('clock-in')
        .setDescription('Clock in for today\'s trading session.'),
      async execute(interaction) {
        const context = await service.requireDeskContext(interaction, { allowStaff: true });
        if (!context) {
          return;
        }

        const [profile, existing, mt4Snapshot] = await Promise.all([
          settleForModal(service.repository.getProfile(context.deskUserId), null),
          settleForModal(service.getDailyLog(context.deskUserId, getDateKey(), 'clock-in'), null),
          settleForModal(service.getFreshMt4SnapshotForUser(context.deskUserId), null),
        ]);

        await interaction.showModal(service.buildClockInModal(profile || {}, existing, mt4Snapshot));
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('log-ea')
        .setDescription('Log a key EA or bot action during the session.'),
      async execute(interaction) {
        const context = await service.requireDeskContext(interaction, { allowStaff: true });
        if (!context) {
          return;
        }

        const mt4Snapshot = await settleForModal(service.getFreshMt4SnapshotForUser(context.deskUserId), null);
        await interaction.showModal(service.buildLogEaModal(null, mt4Snapshot));
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('clock-out')
        .setDescription('Clock out and capture the end of your trading session.'),
      async execute(interaction) {
        const context = await service.requireDeskContext(interaction, { allowStaff: true });
        if (!context) {
          return;
        }

        const [existing, mt4Snapshot] = await Promise.all([
          settleForModal(service.getDailyLog(context.deskUserId, getDateKey(), 'clock-out'), null),
          settleForModal(service.getFreshMt4SnapshotForUser(context.deskUserId), null),
        ]);

        await interaction.showModal(service.buildClockOutModal(existing, mt4Snapshot));
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('weekly-review')
        .setDescription('Create this week\'s compound review from your desk logs.'),
      async execute(interaction) {
        const context = await service.requireDeskContext(interaction, { allowStaff: true });
        if (!context) {
          return;
        }

        const week = getWeekRange();
        const existing = await settleForModal(service.getWeeklyReviewLog(context.deskUserId, week.startKey), null);
        await interaction.showModal(service.buildWeeklyReviewModal(existing));
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('template')
        .setDescription('Show the full manual operator desk template.'),
      async execute(interaction) {
        const context = await service.requireDeskContext(interaction, { allowStaff: true });
        if (!context) {
          return;
        }

        await interaction.reply({
          content: service.getTemplateMessage(),
          ephemeral: true,
        });
      },
    },
  ];

  async function postAuto(trigger, interaction, result) {
    if (!result?.record || !wisdoAnalysisService) {
      return;
    }

    await wisdoAnalysisService.maybePostAutoAnalysis({
      guild: interaction.guild,
      channel: interaction.channel,
      discordUserId: result.record.discordUserId,
      trigger,
    });
  }

  const modalHandlers = new Map([
    [
      'clock-in',
      async (interaction) => {
        await interaction.deferReply({ ephemeral: true });
        const result = await service.submitClockIn(interaction);
        if (!result) {
          return;
        }

        await interaction.editReply(
          result.updated
            ? 'Today\'s clock-in was updated in this desk.'
            : 'Today\'s clock-in was recorded in this desk.',
        );

        await postAuto('clock-in', interaction, result);
      },
    ],
    [
      'log-ea',
      async (interaction) => {
        await interaction.deferReply({ ephemeral: true });
        const result = await service.submitEaLog(interaction);
        if (!result) {
          return;
        }

        await interaction.editReply('EA activity was logged in this desk.');
        await postAuto('ea-log', interaction, { record: result });
      },
    ],
    [
      'clock-out',
      async (interaction) => {
        await interaction.deferReply({ ephemeral: true });
        const result = await service.submitClockOut(interaction);
        if (!result) {
          return;
        }

        await interaction.editReply(
          result.updated
            ? 'Today\'s clock-out was updated in this desk.'
            : 'Today\'s clock-out was recorded in this desk.',
        );

        await postAuto('clock-out', interaction, result);
      },
    ],
    [
      'weekly-review',
      async (interaction) => {
        await interaction.deferReply({ ephemeral: true });
        const result = await service.submitWeeklyReview(interaction);
        if (!result) {
          return;
        }

        await interaction.editReply(
          result.updated
            ? 'This week\'s review was updated in this desk.'
            : 'This week\'s review was posted in this desk.',
        );

        await postAuto('weekly-review', interaction, result);
      },
    ],
  ]);

  return { commands, modalHandlers };
}
