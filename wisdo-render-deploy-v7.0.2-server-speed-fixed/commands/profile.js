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

export function buildProfileCommands({ service }) {
  const commands = [
    {
      data: new SlashCommandBuilder()
        .setName('setup-profile')
        .setDescription('Save your default Culture Coin trading profile.'),
      async execute(interaction) {
        const context = await service.requireDeskContext(interaction, {
          requireDeskOwner: true,
        });

        if (!context) {
          return;
        }

        const existing = await settleForModal(service.repository.getProfile(context.deskUserId), null);
        await interaction.showModal(service.buildProfileModal('setup-profile', existing || {}));
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View the saved operator desk profile for this desk.'),
      async execute(interaction) {
        const result = await service.getProfileForDesk(interaction);
        if (!result) {
          return;
        }

        if (!result.profile) {
          await interaction.reply({
            content: 'No saved profile was found for this desk yet. Run /setup-profile first.',
            ephemeral: true,
          });
          return;
        }

        const student = await service.getStudentDisplay(interaction.guild, result.context.deskUserId);
        await interaction.reply({
          embeds: [service.buildProfileEmbed(result.profile, student)],
          ephemeral: true,
        });
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('edit-profile')
        .setDescription('Update your saved operator desk profile.'),
      async execute(interaction) {
        const context = await service.requireDeskContext(interaction, {
          requireDeskOwner: true,
        });

        if (!context) {
          return;
        }

        const existing = await settleForModal(service.repository.getProfile(context.deskUserId), null);
        await interaction.showModal(service.buildProfileModal('edit-profile', existing || {}));
      },
    },
  ];

  const modalHandlers = new Map([
    [
      'setup-profile',
      async (interaction) => {
        await interaction.deferReply({ ephemeral: true });
        const profile = await service.submitProfile(interaction);
        if (!profile) {
          return;
        }

        const student = await service.getStudentDisplay(interaction.guild, profile.discordUserId);
        await interaction.editReply({
          content: 'Profile saved for this operator desk.',
          embeds: [service.buildProfileEmbed(profile, student)],
        });
      },
    ],
    [
      'edit-profile',
      async (interaction) => {
        await interaction.deferReply({ ephemeral: true });
        const profile = await service.submitProfile(interaction);
        if (!profile) {
          return;
        }

        const student = await service.getStudentDisplay(interaction.guild, profile.discordUserId);
        await interaction.editReply({
          content: 'Profile updated for this operator desk.',
          embeds: [service.buildProfileEmbed(profile, student)],
        });
      },
    ],
  ]);

  return { commands, modalHandlers };
}
