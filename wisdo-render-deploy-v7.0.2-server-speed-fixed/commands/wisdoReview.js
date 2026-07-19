import { SlashCommandBuilder } from 'discord.js';

async function resolveTargetUser(interaction, service) {
  const staff = service.isStaff(interaction.member);
  const memberOption = interaction.options.getUser('member');

  if (staff && memberOption) {
    return {
      discordUserId: memberOption.id,
      ephemeral: true,
    };
  }

  const deskContext = await service.findDeskContextByChannel(interaction.channel);
  if (!deskContext) {
    await interaction.reply({
      content: 'Please use this command inside your private Culture Coin Operator Desk.',
      ephemeral: true,
    });
    return null;
  }

  const isDeskOwner = deskContext.deskUserId === interaction.user.id;
  if (!isDeskOwner && !staff) {
    await interaction.reply({
      content: 'Please use this command inside your private Culture Coin Operator Desk.',
      ephemeral: true,
    });
    return null;
  }

  if (memberOption && memberOption.id !== deskContext.deskUserId && !staff) {
    await interaction.reply({
      content: 'Only Coach/Admin can review another student.',
      ephemeral: true,
    });
    return null;
  }

  return {
    discordUserId: memberOption?.id || deskContext.deskUserId,
    ephemeral: false,
  };
}

export function buildWisdoReviewCommands({ service, wisdoAnalysisService, config }) {
  const commands = [
    {
      data: new SlashCommandBuilder()
        .setName('wisdo-review')
        .setDescription('Create a deeper WISDO review for today or this week.')
        .addStringOption((option) =>
          option
            .setName('period')
            .setDescription('Review period')
            .addChoices(
              { name: 'today', value: 'today' },
              { name: 'week', value: 'week' },
            )
            .setRequired(true),
        )
        .addUserOption((option) =>
          option
            .setName('member')
            .setDescription('Coach/Admin can review a specific student')
            .setRequired(false),
        ),
      async execute(interaction) {
        if (!config.wisdo.enabled) {
          await interaction.reply({
            content: 'WISDO is disabled right now.',
            ephemeral: true,
          });
          return;
        }

        const target = await resolveTargetUser(interaction, service);
        if (!target) {
          return;
        }

        const period = interaction.options.getString('period', true);
        await interaction.deferReply({ ephemeral: target.ephemeral });
        const review = await wisdoAnalysisService.analyzeReview(interaction.guild, target.discordUserId, period);
        await interaction.editReply({
          embeds: [wisdoAnalysisService.createReviewEmbed(review)],
        });
      },
    },
  ];

  return {
    commands,
    modalHandlers: new Map(),
  };
}
