import { SlashCommandBuilder } from 'discord.js';

export function buildStoreCommands({ service, botStoreService }) {
  const commands = [
    {
      data: new SlashCommandBuilder()
        .setName('bots')
        .setDescription('Browse the Culture Coin MT4 bot catalog.'),
      async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const bots = await botStoreService.getCatalog();

        if (bots.length === 0) {
          await interaction.editReply(
            'No bot catalog is loaded yet. Ask staff to run /refresh-bot-catalog.',
          );
          return;
        }

        await interaction.editReply({
          embeds: [botStoreService.buildCatalogEmbed(interaction.member, bots)],
        });
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('bot-info')
        .setDescription('Get a high-level read on one bot without exposing source code.')
        .addStringOption((option) =>
          option.setName('bot').setDescription('Exact bot name or a unique keyword').setRequired(true),
        ),
      async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const input = interaction.options.getString('bot', true);
        const bots = await botStoreService.resolveBotSelection(input);

        if (bots.length !== 1) {
          await interaction.editReply('Pick one bot at a time for /bot-info.');
          return;
        }

        const freeClaimAvailable = await botStoreService.hasFreeClaimAvailable(interaction.member);
        await interaction.editReply({
          embeds: [botStoreService.buildBotInfoEmbed(bots[0], interaction.member, freeClaimAvailable)],
        });
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('claim-free-bot')
        .setDescription('Use your one free Culture Coin bot claim.')
        .addStringOption((option) =>
          option.setName('bot').setDescription('The bot you want to claim').setRequired(true),
        ),
      async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const selection = interaction.options.getString('bot', true);
        const result = await botStoreService.claimFreeBot(interaction.member, selection);

        await interaction.editReply({
          content: `Your free Culture Coin bot is locked in: **${result.bot.name}**. Delivery has been sent.`,
          embeds: [botStoreService.buildQuoteEmbed('Free Bot Claim', result.quote, 'WISDO locked this one in for the member lane.')],
        });
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('negotiate-bot')
        .setDescription('Have WISDO work a bot deal inside the approved pricing guardrails.')
        .addStringOption((option) =>
          option
            .setName('bots')
            .setDescription('One bot or a comma-separated list of bots')
            .setRequired(true),
        )
        .addNumberOption((option) =>
          option
            .setName('offer')
            .setDescription('Your total offer in USD')
            .setMinValue(1)
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('Optional note for WISDO')
            .setRequired(false),
        ),
      async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const selection = interaction.options.getString('bots', true);
        const offer = interaction.options.getNumber('offer');
        const message = interaction.options.getString('message') || '';
        const result = await botStoreService.negotiate(interaction.member, selection, offer, message);

        await interaction.editReply({
          content: result.message,
          embeds: [botStoreService.buildQuoteEmbed('WISDO Bot Quote', result.quote, 'Advisory price lane locked inside the store rules.')],
        });
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('buy-bot')
        .setDescription('Create a purchase link for one bot or a bot bundle.')
        .addStringOption((option) =>
          option
            .setName('bots')
            .setDescription('One bot or a comma-separated list of bots')
            .setRequired(true),
        ),
      async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const selection = interaction.options.getString('bots', true);
        const result = await botStoreService.createPurchase(interaction.member, selection);
        const freeClaimAvailable = await botStoreService.hasFreeClaimAvailable(interaction.member);
        const contentLines = [];

        if (result.checkoutSession?.url) {
          contentLines.push(`Checkout link: ${result.checkoutSession.url}`);
        } else {
          contentLines.push(
            'Checkout is not configured yet, so WISDO locked the quote but could not generate a payment link.',
          );
        }

        if (freeClaimAvailable && result.quote.botIds.length === 1) {
          contentLines.push(
            'You still have a free Culture Coin bot claim available. If you want to use that instead, run /claim-free-bot.',
          );
        }

        await interaction.editReply({
          content: contentLines.join('\n\n'),
          embeds: [botStoreService.buildQuoteEmbed('Bot Purchase Quote', result.quote, 'This quote is ready for checkout.')],
        });
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('my-bots')
        .setDescription('See the bots already delivered to you.'),
      async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        await interaction.editReply({
          embeds: [await botStoreService.buildMyBotsEmbed(interaction.user.id)],
        });
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('culture-coin-info')
        .setDescription('See the Culture Coin membership perks and bot pricing lane.'),
      async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const freeClaimAvailable = await botStoreService.hasFreeClaimAvailable(interaction.member);
        await interaction.editReply({
          embeds: [botStoreService.buildCultureCoinInfoEmbed(interaction.member, freeClaimAvailable)],
        });
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('refresh-bot-catalog')
        .setDescription('Admin: rescan local MT4 bots and refresh the store vault.'),
      async execute(interaction) {
        if (!(await service.assertAdminOrCoach(interaction))) {
          return;
        }

        await interaction.deferReply({ ephemeral: true });
        const result = await botStoreService.syncCatalog();
        await interaction.editReply(
          `Bot catalog refreshed. Discovered ${result.discovered} bots and synced ${result.synced} delivery files.`,
        );
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('store-status')
        .setDescription('Admin: view bot store, quote, payment, and license status.'),
      async execute(interaction) {
        if (!(await service.assertAdminOrCoach(interaction))) {
          return;
        }

        await interaction.deferReply({ ephemeral: true });
        await interaction.editReply({
          embeds: [await botStoreService.buildStoreStatus()],
        });
      },
    },
  ];

  return {
    commands,
    modalHandlers: new Map(),
  };
}
