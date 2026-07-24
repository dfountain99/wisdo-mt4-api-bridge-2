import { SlashCommandBuilder } from 'discord.js';

async function requireWisdoDesk(interaction, service) {
  const deskContext = await service.findDeskContextByChannel(interaction.channel);
  if (!deskContext) {
    await interaction.reply({
      content: 'Please use WISDO inside a private Culture Coin Operator Desk.',
      ephemeral: true,
    });
    return null;
  }

  const isStaff = service.isStaff(interaction.member);
  const isDeskOwner = interaction.user.id === deskContext.deskUserId;

  if (!isDeskOwner && !isStaff) {
    await interaction.reply({
      content: 'Please use WISDO inside a private Culture Coin Operator Desk.',
      ephemeral: true,
    });
    return null;
  }

  return {
    ...deskContext,
    isStaff,
    isDeskOwner,
  };
}

export function buildWisdoCommands({ service, wisdoAnalysisService, config }) {
  const commands = [
    {
      data: new SlashCommandBuilder()
        .setName('wisdo')
        .setDescription('Ask WISDO for a current read on this desk.'),
      async execute(interaction) {
        if (!config.wisdo.enabled) {
          await interaction.reply({
            content: 'WISDO is disabled right now.',
            ephemeral: true,
          });
          return;
        }

        const context = await requireWisdoDesk(interaction, service);
        if (!context) {
          return;
        }

        await interaction.deferReply();
        const analysis = await wisdoAnalysisService.analyzeCurrentDesk(interaction.guild, context.deskUserId);
        await interaction.editReply({
          embeds: [wisdoAnalysisService.createQuickReadEmbed(analysis)],
        });
      },
    },
  ];

  return {
    commands,
    modalHandlers: new Map(),
  };
}
