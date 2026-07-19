import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

export function buildWisdoSettingsCommands({ service, config }) {
  const commands = [
    {
      data: new SlashCommandBuilder()
        .setName('wisdo-settings')
        .setDescription('Show the current WISDO settings.'),
      async execute(interaction) {
        if (!(await service.assertAdminOrCoach(interaction))) {
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('WISDO Settings')
          .setColor(0x5865f2)
          .setDescription(
            [
              `**WISDO enabled:** ${config.wisdo.enabled ? 'Yes' : 'No'}`,
              `**Tone:** ${config.wisdo.tone}`,
              `**Auto analyze clock-in:** ${config.wisdo.autoAnalyzeClockIn ? 'Yes' : 'No'}`,
              `**Auto analyze EA log:** ${config.wisdo.autoAnalyzeEaLog ? 'Yes' : 'No'}`,
              `**Auto analyze clock-out:** ${config.wisdo.autoAnalyzeClockOut ? 'Yes' : 'No'}`,
              `**Auto analyze weekly review:** ${config.wisdo.autoAnalyzeWeeklyReview ? 'Yes' : 'No'}`,
              `**Max safe open trades:** ${config.wisdo.maxSafeOpenTrades}`,
              `**Drawdown warning %:** ${config.wisdo.drawdownWarnPercent}`,
              `**Drawdown danger %:** ${config.wisdo.drawdownDangerPercent}`,
              `**Profit protect %:** ${config.wisdo.profitProtectPercent}`,
              `**Strong warnings enabled:** ${config.wisdo.strongWarningsEnabled ? 'Yes' : 'No'}`,
              `**Stale MT4 threshold:** ${config.wisdo.mt4StaleMinutes} minutes`,
            ].join('\n'),
          )
          .setTimestamp(new Date());

        await interaction.reply({
          embeds: [embed],
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
