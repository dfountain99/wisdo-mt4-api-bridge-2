import { SlashCommandBuilder } from 'discord.js';

const EPHEMERAL_FLAG = 64;

async function safelyDeferInteraction(interaction) {
  if (!interaction.isRepliable()) return false;
  if (interaction.deferred || interaction.replied) return true;

  try {
    await interaction.deferReply({
      flags: EPHEMERAL_FLAG,
    });

    return true;
  } catch (error) {
    // 10062 = Unknown interaction / timed out
    if (error?.code === 10062) {
      return false;
    }

    // 40060 = Interaction already acknowledged
    // This usually means another bot instance already responded.
    if (error?.code === 40060) {
      return true;
    }

    throw error;
  }
}

async function replyOrEdit(interaction, payload) {
  const response = typeof payload === 'string'
    ? { content: payload }
    : payload;

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(response).catch(() => null);
  }

  return interaction.reply({
    ...response,
    flags: EPHEMERAL_FLAG,
  }).catch(() => null);
}

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

export function buildAdminCommands({ service }) {
  const commands = [
    {
      data: new SlashCommandBuilder()
        .setName('create-desk')
        .setDescription('Create a private Culture Coin desk for one student.')
        .addUserOption((option) =>
          option
            .setName('member')
            .setDescription('Student to create a desk for')
            .setRequired(true),
        ),

      async execute(interaction) {
        const deferred = await safelyDeferInteraction(interaction);

        if (!deferred) {
          return;
        }

        if (!(await service.assertAdminOrCoach(interaction))) {
          return;
        }

        const member = await resolveMember(interaction, 'member');

        if (!member) {
          await replyOrEdit(interaction, 'That member could not be found in this server.');
          return;
        }

        const result = await service.ensureDeskForMember(member);

        if (result.status === 'ineligible') {
          await replyOrEdit(
            interaction,
            `${member.user.username} does not have the Culture Coin role, so no desk was created.`,
          );
          return;
        }

        if (result.status === 'existing') {
          await replyOrEdit(
            interaction,
            `Desk already exists for ${member.user.username}: <#${result.channel.id}>`,
          );
          return;
        }

        if (result.status === 'archived-existing') {
          await replyOrEdit(
            interaction,
            `An archived desk already exists for ${member.user.username}: <#${result.channel.id}>`,
          );
          return;
        }

        await replyOrEdit(
          interaction,
          `Desk created for ${member.user.username}: <#${result.channel.id}>`,
        );
      },
    },

    {
      data: new SlashCommandBuilder()
        .setName('create-all-desks')
        .setDescription('Create missing desks for every Culture Coin student.')
        .addBooleanOption((option) =>
          option
            .setName('dry_run')
            .setDescription('Preview desk creation without creating channels')
            .setRequired(true),
        ),

      async execute(interaction) {
        const deferred = await safelyDeferInteraction(interaction);

        if (!deferred) {
          return;
        }

        if (!(await service.assertAdminOrCoach(interaction))) {
          return;
        }

        const dryRun = interaction.options.getBoolean('dry_run', true);
        const result = await service.createAllDesks(interaction.guild, { dryRun });

        await replyOrEdit(interaction, service.formatCreateAllResult(result));
      },
    },

    {
      data: new SlashCommandBuilder()
        .setName('desk-status')
        .setDescription('Review Culture Coin Operator Desk coverage and duplicates.'),

      async execute(interaction) {
        const deferred = await safelyDeferInteraction(interaction);

        if (!deferred) {
          return;
        }

        if (!(await service.assertAdminOrCoach(interaction))) {
          return;
        }

        const summary = await service.analyzeDeskSystem(interaction.guild);

        await replyOrEdit(interaction, service.formatDeskStatus(summary));
      },
    },

    {
      data: new SlashCommandBuilder()
        .setName('remove-desk')
        .setDescription('Archive or delete a Culture Coin desk.')
        .addUserOption((option) =>
          option
            .setName('member')
            .setDescription('Student desk to remove')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('mode')
            .setDescription('Archive is the default and safer option')
            .addChoices(
              { name: 'archive', value: 'archive' },
              { name: 'delete', value: 'delete' },
            )
            .setRequired(false),
        ),

      async execute(interaction) {
        const deferred = await safelyDeferInteraction(interaction);

        if (!deferred) {
          return;
        }

        if (!(await service.assertAdminOrCoach(interaction))) {
          return;
        }

        const member = await resolveMember(interaction, 'member');

        if (!member) {
          await replyOrEdit(interaction, 'That member could not be found in this server.');
          return;
        }

        const mode = interaction.options.getString('mode') || 'archive';
        const result = await service.removeDeskForMember(member, mode);

        if (result.status === 'not-found') {
          await replyOrEdit(interaction, `No desk was found for ${member.user.username}.`);
          return;
        }

        if (result.status === 'archived') {
          await replyOrEdit(
            interaction,
            `Archived desk access for ${member.user.username}. Logs were kept intact.`,
          );
          return;
        }

        await replyOrEdit(
          interaction,
          `Deleted desk channels for ${member.user.username}. Stored logs were not removed.`,
        );
      },
    },

    {
      data: new SlashCommandBuilder()
        .setName('coach-note')
        .setDescription('Post a structured coach note into a student desk.')
        .addUserOption((option) =>
          option
            .setName('member')
            .setDescription('Student to review')
            .setRequired(true),
        ),

      async execute(interaction) {
        // Do NOT defer before showModal.
        // Discord modals must be the first interaction response.
        if (!(await service.assertAdminOrCoach(interaction))) {
          return;
        }

        const member = await resolveMember(interaction, 'member');

        if (!member) {
          await interaction.reply({
            content: 'That member could not be found in this server.',
            flags: EPHEMERAL_FLAG,
          });
          return;
        }

        const deskChannel = await service.getDeskChannelForUser(interaction.guild, member.id);

        if (!deskChannel) {
          await interaction.reply({
            content: 'Could not find that student’s private desk.',
            flags: EPHEMERAL_FLAG,
          });
          return;
        }

        await interaction.showModal(service.buildCoachNoteModal(member));
      },
    },
  ];

  const modalHandlers = new Map([
    [
      'coach-note',
      async (interaction) => {
        const deferred = await safelyDeferInteraction(interaction);

        if (!deferred) {
          return;
        }

        if (!(await service.assertAdminOrCoach(interaction))) {
          return;
        }

        const studentUserId = interaction.customId.split(':')[1];
        const result = await service.submitCoachNote(interaction, studentUserId);

        await replyOrEdit(
          interaction,
          `Coach note posted in <#${result.deskChannel.id}> for <@${studentUserId}>.`,
        );
      },
    ],
  ]);

  return { commands, modalHandlers };
}