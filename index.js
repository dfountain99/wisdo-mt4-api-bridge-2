import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
} from 'discord.js';

import { config, getMissingRuntimeEnv } from './config.js';
import { createCommandRegistry } from './commands/index.js';
import { logger } from './logger.js';
import { OperatorDeskService } from './services/operatorDeskService.js';
import { Mt4SyncService } from './services/mt4SyncService.js';
import { Mt4CommandService } from './services/mt4CommandService.js';
import { BotRegistryService } from './services/botRegistryService.js';
import { CopyTradingService } from './services/copyTradingService.js';
import { WisdoSpeechService } from './services/wisdoSpeechService.js';
import { ChartRenderService } from './services/chartRenderService.js';
import { RankService } from './services/rankService.js';
import { AnnouncementService } from './services/announcementService.js';
import { DeskDashboardService } from './services/deskDashboardService.js';
import { WisdoRulesEngine } from './services/wisdoRulesEngine.js';
import { WisdoToneService } from './services/wisdoToneService.js';
import { WisdoAnalysisService } from './services/wisdoAnalysisService.js';
import { BotCatalogService } from './services/botCatalogService.js';
import { BotPricingService } from './services/botPricingService.js';
import { BotStoreService } from './services/botStoreService.js';
import { PaymentService } from './services/paymentService.js';
import { TradeSignalService } from './services/tradeSignalService.js';
import { createWisdoPhase1Repository } from './services/repositories/wisdoPhase1Repository.js';
import { DiscordRoleSyncService } from './services/discordRoleSyncService.js';
import { SignalGridService } from './services/signalGridService.js';
import { SignalCopyService } from './services/signalCopyService.js';
import { DiscordSignalGridService } from './services/discordSignalGridService.js';
import { WisdoMemoryService } from './services/wisdoMemoryService.js';
import { startApiServer } from './server/apiServer.js';

// Production source of truth: Render runs `npm start`, which runs this root
// entrypoint. Keep runtime imports on root config/commands/services plus
// server/apiServer.js; src/ and nested copied trees are archive candidates.
const missingEnv = getMissingRuntimeEnv();

function isTransientDiscordTransportError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  const stack = String(error?.stack || '').toLowerCase();
  return [
    'socket hang up',
    'client network socket disconnected before secure tls connection was established',
    'this operation was aborted',
    'opening handshake has timed out',
    "cannot read properties of null (reading 'setheader')",
  ].some((value) => message.includes(value) || stack.includes(value));
}

function logDiscordTransportFailure(message, error, meta = {}) {
  const payload = { ...meta, message: error?.message || String(error || ''), code: error?.code };
  if (isTransientDiscordTransportError(error)) logger.warn(message, payload);
  else logger.error(message, { ...payload, stack: error?.stack });
}

if (missingEnv.length > 0) {
  logger.error('Bot startup halted because required environment variables are missing.', {
    keys: missingEnv,
  });
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const service = new OperatorDeskService(config);
await service.initialize();

const mt4CommandService = new Mt4CommandService(config);
const botRegistryService = new BotRegistryService(config);
const copyTradingService = new CopyTradingService(config);
const wisdoPhase1Repository = createWisdoPhase1Repository(config);
const roleSyncService = new DiscordRoleSyncService({ config, client, repository: wisdoPhase1Repository, logger });
const signalGridService = new SignalGridService({ config, repository: wisdoPhase1Repository, logger });
const signalCopyService = new SignalCopyService({ repository: wisdoPhase1Repository, signalGridService, mt4SyncService: null, mt4CommandService, roleSyncService, logger });
const discordSignalGridService = new DiscordSignalGridService({ client, signalGridService, signalCopyService, logger });
copyTradingService.attachDiscordDeliveryContext?.({
  client,
  operatorDeskService: service,
  logger,
});
const mt4SyncService = new Mt4SyncService(config, service.repository, copyTradingService);
const wisdoMemoryService = new WisdoMemoryService(config, service.repository);
mt4SyncService.attachWisdoMemoryService?.(wisdoMemoryService);
signalCopyService.mt4SyncService = mt4SyncService;
service.attachMt4SyncService(mt4SyncService);
const tradeSignalService = new TradeSignalService({
  config,
  client,
  repository: service.repository,
  mt4CommandService,
  copyTradingService,
  operatorDeskService: service,
  signalGridService,
  discordSignalGridService,
  logger,
});
mt4SyncService.attachTradeSignalService?.(tradeSignalService);
mt4SyncService.attachBotRegistryService?.(botRegistryService);

const wisdoSpeechService = new WisdoSpeechService(config);
const chartRenderService = new ChartRenderService(config);

const rankService = new RankService({
  config,
  mt4SyncService,
  logger,
});

const announcementService = new AnnouncementService({
  config,
  client,
  operatorDeskService: service,
  logger,
});
const wisdoRulesEngine = new WisdoRulesEngine(config);
const wisdoToneService = new WisdoToneService(config);
const wisdoAnalysisService = new WisdoAnalysisService({
  config,
  repository: service.repository,
  operatorDeskService: service,
  mt4SyncService,
  rulesEngine: wisdoRulesEngine,
  toneService: wisdoToneService,
});

const botCatalogService = new BotCatalogService(config, service.repository);
const botPricingService = new BotPricingService(config);
const paymentService = new PaymentService(config, service.repository);
const botStoreService = new BotStoreService({
  config,
  repository: service.repository,
  operatorDeskService: service,
  botCatalogService,
  botPricingService,
  paymentService,
  client,
});

paymentService.setBotStoreService(botStoreService);
await botStoreService.initialize();
const deskDashboardService = new DeskDashboardService({
  config,
  client,
  operatorDeskService: service,
  mt4SyncService,
  chartRenderService,
  logger,
});

const registry = createCommandRegistry({
  service,
  config,
  mt4SyncService,
  wisdoAnalysisService,
  mt4CommandService,
  copyTradingService,
  tradeSignalService,
  signalGridService,
  signalCopyService,
  discordSignalGridService,
  botStoreService,
  botRegistryService,
  wisdoMemoryService,
  logger,
});

logger.info('Discord command registry built.', registry.audit);

const apiServer = await startApiServer({
  config,
  mt4SyncService,
  mt4CommandService,
  copyTradingService,
  tradeSignalService,
  deskDashboardService,
  rankService,
  announcementService,
  paymentService,
  botRegistryService,
  signalGridService,
  signalCopyService,
  discordSignalGridService,
  operatorDeskService: service,
  commandRegistryAudit: registry.audit,
  client,
  logger,
});

let commandRegistrationPromise = null;

async function registerDiscordCommandsOnStart({ force = false } = {}) {
  const enabled = String(process.env.AUTO_REGISTER_COMMANDS_ON_START || 'true').toLowerCase() !== 'false';
  if (!enabled) return { skipped: true, reason: 'AUTO_REGISTER_COMMANDS_ON_START=false' };
  if (!config.discordToken || !config.clientId || !config.guildId) {
    return { skipped: true, reason: 'missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID' };
  }
  if (commandRegistrationPromise && !force) return commandRegistrationPromise;

  commandRegistrationPromise = (async () => {
    const body = registry.commands.map((command) => command.data.toJSON());
    const rest = new REST({ version: '10' }).setToken(config.discordToken);
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body });
    return {
      skipped: false,
      commandCount: body.length,
      guildId: config.guildId,
      names: body.map((command) => command.name),
    };
  })();

  try {
    return await commandRegistrationPromise;
  } catch (error) {
    commandRegistrationPromise = null;
    throw error;
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  logger.info('Discord bot is ready.', {
    user: readyClient.user.tag,
    guilds: readyClient.guilds.cache.size,
    wisdoSpeechEnabled: wisdoSpeechService.isReady(),
  });

  try {
    const registration = await registerDiscordCommandsOnStart();
    logger.info('Discord slash-command startup registration checked.', registration);
  } catch (error) {
    logger.error('Discord slash-command startup registration failed.', {
      message: error.message,
      stack: error.stack,
    });
  }

  setInterval(() => {
    tradeSignalService.refreshSignalBoard?.().catch((error) => {
      logger.warn('Active Signal Board scheduled refresh failed.', { message: error.message });
    });
  }, 30000).unref?.();
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = registry.commandMap.get(interaction.commandName);

      if (!command) {
        await interaction.reply({
          content: 'That slash command is not loaded in this WISDO build. Command registration is being refreshed; try again after the bot restarts.',
          ephemeral: true,
        }).catch(() => null);
        return;
      }

      // CEM HOTFIX 2026-05-06:
      // Discord invalidates slash-command interactions if they are not acknowledged fast enough.
      // Pairing commands are the first step in MT4 sync, so acknowledge them at the router level
      // before desk lookup, file I/O, attachment checks, or service work can delay the reply.
      if ((interaction.commandName === 'connect-mt4' || interaction.commandName === 'connect') && !interaction.deferred && !interaction.replied) {
        try {
          await interaction.deferReply({ ephemeral: true });
        } catch (ackError) {
          logger.warn('Discord interaction expired before connect command could be acknowledged.', {
            command: interaction.commandName,
            code: ackError?.code,
            message: ackError?.message,
          });
          return;
        }
      }

      await command.execute(interaction);
      return;
    }

    if (
      interaction.isButton?.() &&
      (
        interaction.customId?.startsWith('signal_grid_') ||
        interaction.customId?.startsWith('take_signal') ||
        interaction.customId?.startsWith('signal_') ||
        interaction.customId?.startsWith('copy_all_signals')
      )
    ) {
      if (interaction.customId?.startsWith('signal_grid_')) {
        await discordSignalGridService.handleCopyButtonInteraction(interaction);
        return;
      }
      await tradeSignalService.handleButton(interaction);
      return;
    }

    if (interaction.isStringSelectMenu?.() && interaction.customId?.startsWith('signal_grid_select')) {
      await discordSignalGridService.handleGridSelectInteraction(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      const key = interaction.customId.split(':')[0];
      const handler = registry.modalMap.get(key);

      if (!handler) {
        return;
      }

      await handler(interaction);
    }
  } catch (error) {
    logger.error('Interaction handler failure', {
      command: interaction.isChatInputCommand() ? interaction.commandName : undefined,
      customId: interaction.isModalSubmit() ? interaction.customId : undefined,
      message: error.message,
      stack: error.stack,
    });

    const payload = {
      content:
        error?.expose === true
          ? error.message
          : 'Something went wrong while handling that request. Please try again or check the bot logs.',
      ephemeral: true,
    };

    if (interaction.isRepliable()) {
      if (interaction.deferred && !interaction.replied) {
        const { ephemeral: _ephemeral, ...editPayload } = payload;
        await interaction.editReply(editPayload).catch(() => null);
      } else if (interaction.replied) {
        await interaction.followUp(payload).catch(() => null);
      } else {
        await interaction.reply(payload).catch(() => null);
      }
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;

    const raw = message.content?.trim();

    if (!raw) return;

    const wakeResult = extractWisdoWakeCommand(raw);

    if (!wakeResult) return;

    const { wakeWord, ask } = wakeResult;

    if (!ask) {
      await replyWithWisdoTextAndSpeech({
        message,
        wisdoSpeechService,
        response: {
          content: [
            '🧠 **WISDO is listening.**',
            '',
            `Wake phrase detected: **${wakeWord}**`,
            '',
            'You can talk naturally after the wake phrase.',
            '',
            'Try saying:',
            '`Hey Wisdom, can you show me all the bots available?`',
            '`Hey Coach, how does my account look?`',
            '`Hey Coach, pause my MT4.`',
            '`Hey Wisdom, resume trading.`',
            '`Hey Coach, put my account in Guard Mode.`',
            '`Hey Coach, only allow buys.`',
            '`Operator, set max trades to 3.`',
            '`Hey Wisdom, set equity floor to 25 dollars.`',
            '`Hey Coach, emergency stop.`',
          ].join('\n'),
          speechText:
            'WISDO is listening. You can talk naturally after the wake phrase. Try saying, Hey Coach, how does my account look, or Hey Coach, pause my MT4.',
        },
      });
      return;
    }

   const response = await buildWisdoVoiceResponse({
  ask,
  message,
  botStoreService,
  mt4SyncService,
  mt4CommandService,
  copyTradingService,
  wisdoSpeechService,
  service,
  registry,
  botRegistryService,
});

    if (response) {
      await replyWithWisdoTextAndSpeech({
        message,
        response,
        wisdoSpeechService,
      });
    }
  } catch (error) {
    logger.error('WISDO message listener failure', {
      userId: message.author?.id,
      channelId: message.channel?.id,
      message: error.message,
      stack: error.stack,
    });

    await message.reply({
      content: 'WISDO heard you, but something broke while processing the request. Check the bot logs.',
    }).catch(() => null);
  }
});

client.on(Events.Error, (error) => {
  logDiscordTransportFailure('Discord client transport error', error);
});

client.on(Events.ShardError, (error, shardId) => {
  logDiscordTransportFailure('Discord shard transport error', error, { shardId });
});

client.on(Events.ShardDisconnect, (event, shardId) => {
  logger.warn('Discord shard disconnected; automatic reconnect is expected.', { shardId, code: event?.code, reason: event?.reason || '' });
});

client.on(Events.ShardReconnecting, (shardId) => {
  logger.warn('Discord shard reconnecting.', { shardId });
});

client.on(Events.ShardResume, (shardId, replayedEvents) => {
  logger.info('Discord shard resumed.', { shardId, replayedEvents });
});

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    await botStoreService.handleGuildMemberJoin(member);
  } catch (error) {
    logger.error('Guild member welcome handler failure', {
      userId: member.id,
      message: error.message,
    });
  }
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  try {
    const cultureCoinRole = service.getCultureCoinRole(newMember.guild);

    if (!cultureCoinRole) {
      return;
    }

    const hadRole = oldMember.roles.cache.has(cultureCoinRole.id);
    const hasRole = newMember.roles.cache.has(cultureCoinRole.id);

    if (!hadRole && hasRole) {
      await botStoreService.handleCultureCoinRoleActivated(newMember);
    }
  } catch (error) {
    logger.error('Guild member role update handler failure', {
      userId: newMember.id,
      message: error.message,
    });
  }
});

process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logDiscordTransportFailure('Unhandled promise rejection', error);
});

process.on('uncaughtException', (error) => {
  logDiscordTransportFailure('Uncaught exception', error);
});

function extractWisdoWakeCommand(raw) {
  const text = String(raw || '').trim();

  if (!text) return null;

  const wakeWords = [
    'hey wisdom',
    'hey wisdo',
    'hey coach',
    'hey operator',
    'hey trading assistant',
    'trading assistant',
    'operator',
    'coach',
    'wisdom',
    'wisdo',
    'yo wisdom',
    'yo wisdo',
    'wizzo',
    'wiz do',
    'wizdo',
    'wise doe',
    'wise do',
  ];

  for (const wakeWord of wakeWords) {
    const escaped = escapeRegExp(wakeWord);
    const pattern = new RegExp(`^${escaped}(\\b|[\\s,.:;!?-]+)`, 'i');
    const match = text.match(pattern);

    if (!match) continue;

    const ask = text
      .slice(match[0].length)
      .replace(/^[\s,.:;!?-]+/, '')
      .trim();

    return {
      wakeWord,
      ask,
    };
  }

  return null;
}

function normalizeVoiceInput(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreIntent(input, rules) {
  let score = 0;

  for (const word of rules.any || []) {
    if (input.includes(word)) score += 1;
  }

  for (const word of rules.strong || []) {
    if (input.includes(word)) score += 3;
  }

  for (const group of rules.groups || []) {
    if (group.some((word) => input.includes(word))) score += 2;
  }

  for (const phrase of rules.phrases || []) {
    if (input.includes(phrase)) score += 4;
  }

  return score;
}

function detectWisdoIntent(ask) {
  const input = normalizeVoiceInput(ask);

  const intentScores = [
    {
      intent: 'help',
      score: scoreIntent(input, {
        strong: ['help', 'commands', 'what can you do', 'how do i use'],
      }),
    },
    {
      intent: 'bot_catalog',
      score: scoreIntent(input, {
        phrases: [
          'show me the bots',
          'show bots',
          'list bots',
          'bot list',
          'available bots',
          'bot catalog',
          'bot store',
          'what bots are available',
          'what bots do you have',
          'what trading bots are available',
          'show me what trading bots are available',
        ],
        groups: [
          ['show', 'list', 'see', 'view', 'display', 'browse', 'open', 'available'],
          ['bots', 'bot', 'catalog', 'store'],
        ],
        strong: ['available bots', 'bot catalog', 'bot store'],
      }),
    },
    {
      intent: 'bot_info',
      score: scoreIntent(input, {
        phrases: [
          'bot info',
          'tell me about bot',
          'tell me about the bot',
          'explain bot',
          'explain the bot',
          'what is this bot',
          'what does this bot do',
          'what does the bot do',
          'information on bot',
          'details on bot',
        ],
        groups: [
          ['info', 'information', 'explain', 'describe', 'details', 'about'],
          ['bot', 'bots', 'ea', 'expert advisor'],
        ],
      }),
    },
    {
      intent: 'buy_bot',
      score: scoreIntent(input, {
        phrases: [
          'buy bot',
          'purchase bot',
          'checkout',
          'create a purchase',
          'i want to buy',
          'i want to purchase',
          'how much is',
          'price for',
          'get a quote',
        ],
        groups: [
          ['buy', 'purchase', 'checkout', 'pay', 'price', 'quote', 'order'],
          ['bot', 'bots', 'ea', 'expert advisor'],
        ],
        strong: ['buy', 'purchase', 'checkout'],
      }),
    },
    {
      intent: 'claim_free_bot',
      score: scoreIntent(input, {
        phrases: [
          'claim free bot',
          'free bot',
          'use my free claim',
          'claim my bot',
          'culture coin free bot',
          'redeem my free bot',
        ],
        groups: [
          ['claim', 'free', 'redeem'],
          ['bot', 'bots', 'claim'],
        ],
        strong: ['free bot', 'claim'],
      }),
    },
    {
      intent: 'my_bots',
      score: scoreIntent(input, {
        phrases: [
          'my bots',
          'owned bots',
          'bots i own',
          'what bots do i own',
          'what bots do i have',
          'delivered bots',
          'my purchases',
          'my downloads',
        ],
        groups: [
          ['my', 'own', 'owned', 'delivered', 'purchased', 'have', 'downloads'],
          ['bots', 'bot', 'licenses', 'downloads'],
        ],
      }),
    },
    {
      intent: 'culture_coin_info',
      score: scoreIntent(input, {
        phrases: [
          'culture coin',
          'membership',
          'member perks',
          'culture coin info',
          'how do i join',
          'what comes with culture coin',
          'culture coin membership',
          'what is culture coin',
        ],
        strong: ['culture coin', 'membership', 'perks'],
      }),
    },
    {
      intent: 'mt4_guard_mode',
      score: scoreIntent(input, {
        phrases: [
          'guard mode',
          'safe mode',
          'protect my account',
          'protect the account',
          'put my mt4 in safe mode',
          'put my account in safe mode',
          'put my account in guard mode',
          'lower risk',
          'lower my risk',
          'defensive mode',
          'stop new trades for today',
          'protect my mt4',
          'protect my trading account',
        ],
        groups: [
          ['guard', 'safe', 'protect', 'defensive'],
          ['mt4', 'account', 'trading', 'bot', 'ea', 'risk'],
        ],
        strong: ['guard mode', 'safe mode', 'protect', 'defensive mode'],
      }),
    },
    {
      intent: 'mt4_emergency_stop',
      score: scoreIntent(input, {
        phrases: [
          'emergency stop',
          'kill switch',
          'panic stop',
          'shut everything down',
          'stop everything',
          'close everything',
          'panic button',
          'emergency shutdown',
        ],
        strong: ['emergency stop', 'kill switch', 'panic stop', 'close everything'],
      }),
    },
    {
      intent: 'mt4_set_max_trades',
      score: scoreIntent(input, {
        phrases: [
          'set max trades',
          'set maximum trades',
          'max trades to',
          'maximum trades to',
          'limit trades to',
          'only allow trades',
        ],
        groups: [
          ['set', 'limit', 'max', 'maximum', 'allow'],
          ['trades', 'trade'],
        ],
        strong: ['max trades', 'maximum trades'],
      }),
    },
    {
      intent: 'mt4_set_equity_floor',
      score: scoreIntent(input, {
        phrases: [
          'set equity floor',
          'equity floor to',
          'set account floor',
          'account floor to',
          'do not let my account go below',
          'do not let equity go below',
          'protect below',
        ],
        groups: [
          ['floor', 'below', 'protect'],
          ['equity', 'account', 'balance'],
        ],
        strong: ['equity floor', 'account floor'],
      }),
    },
    {
      intent: 'mt4_set_risk_percent',
      score: scoreIntent(input, {
        phrases: [
          'set risk',
          'risk percent',
          'risk percentage',
          'set risk percent',
          'set risk to',
          'risk to',
        ],
        groups: [
          ['risk'],
          ['percent', 'percentage'],
        ],
        strong: ['risk percent', 'risk percentage'],
      }),
    },
    {
         
      intent: 'mt4_take_winners',
      score: scoreIntent(input, {
        phrases: [
          'close profits',
          'close profit',
          'take profits',
          'take profit',
          'take winners',
          'close winners',
          'secure profits',
          'secure profit',
          'collect profits',
          'collect profit',
          'bank profits',
          'bank profit',
        ],
        groups: [
          ['close', 'take', 'secure', 'collect', 'bank'],
          ['profit', 'profits', 'winner', 'winners'],
        ],
        strong: ['close profits', 'take profits', 'secure profits', 'close winners'],
      }),
    },
    {
      intent: 'mt4_cut_losers',
      score: scoreIntent(input, {
        phrases: [
          'cut losses',
          'cut losers',
          'cut half my losses',
          'close losses',
          'close losers',
          'trim losses',
          'trim losers',
          'reduce losses',
        ],
        groups: [
          ['cut', 'close', 'trim', 'reduce'],
          ['loss', 'losses', 'loser', 'losers'],
        ],
        strong: ['cut losses', 'cut losers', 'cut half my losses'],
      }),
    },
    {
      intent: 'mt4_set_daily_gain',
      score: scoreIntent(input, {
        phrases: [
          'set daily gain',
          'daily gain to',
          'set daily goal',
          'daily goal to',
          'set daily profit goal',
          'daily profit goal to',
        ],
        groups: [
          ['daily', 'day'],
          ['gain', 'goal', 'profit', 'target'],
        ],
        strong: ['daily gain', 'daily goal', 'daily profit goal'],
      }),
    },
{
  intent: 'mt4_reset_my_account',
  score: scoreIntent(input, {
    phrases: [
      'reset my account',
      'reset my mt4 account',
      'disconnect my account',
      'disconnect my mt4',
      'unlink my account',
      'unlink my mt4',
      'clear my account',
      'clear my mt4 account',
      'remove my demo account',
      'forget my account',
      'forget my mt4',
    ],
    groups: [
      ['reset', 'disconnect', 'unlink', 'clear', 'remove', 'forget'],
      ['account', 'mt4', 'demo', 'live'],
    ],
    strong: ['reset my account', 'disconnect my account', 'unlink my account'],
  }),
},    
{
      intent: 'mt4_ladder_increment',
      score: scoreIntent(input, {
        phrases: [
          'first ladder',
          'ladder increment',
          'first ladder 0.01',
          'rest 0.04',
          'next ladder',
        ],
        groups: [
          ['ladder', 'increment', 'next', 'first', 'rest'],
          ['0.01', '0.04'],
        ],
        strong: ['ladder increment', 'first ladder'],
      }),
    },
    {
      intent: 'mt4_hedge_on',
      score: scoreIntent(input, {
        phrases: [
          'hedge on',
          'allow hedge',
          'allow hedge trading',
          'turn hedge on',
          'enable hedge',
        ],
        groups: [
          ['hedge'],
          ['on', 'allow', 'enable'],
        ],
        strong: ['hedge on', 'allow hedge'],
      }),
    },
    {
      intent: 'mt4_hedge_now',
      score: scoreIntent(input, {
        phrases: [
          'hedge now',
          'open hedge',
          'hedge this trade',
          'hedge my basket',
        ],
        groups: [
          ['hedge'],
          ['now', 'open', 'basket', 'trade'],
        ],
        strong: ['hedge now'],
      }),
    },
    {
      intent: 'mt4_another_anchor',
      score: scoreIntent(input, {
        phrases: [
          'allow another anchor',
          'another anchor',
          'allow anchor trade',
          'allow another anchor trade',
          'let it anchor again',
        ],
        groups: [
          ['anchor'],
          ['allow', 'another', 'again'],
        ],
        strong: ['another anchor', 'allow another anchor'],
      }),
    },
    
  
    {
      intent: 'mt4_buy_only',
      score: scoreIntent(input, {
        phrases: [
          'buy only',
          'only buy',
          'allow buys only',
          'only allow buys',
          'long only',
          'turn on buy only',
          'buys only',
        ],
        groups: [
          ['buy', 'buys', 'long'],
          ['only', 'allow'],
        ],
        strong: ['buy only', 'long only'],
      }),
    },
    {
      intent: 'mt4_sell_only',
      score: scoreIntent(input, {
        phrases: [
          'sell only',
          'only sell',
          'allow sells only',
          'only allow sells',
          'short only',
          'turn on sell only',
          'sells only',
        ],
        groups: [
          ['sell', 'sells', 'short'],
          ['only', 'allow'],
        ],
        strong: ['sell only', 'short only'],
      }),
    },
    {
      intent: 'mt4_both_directions',
      score: scoreIntent(input, {
        phrases: [
          'allow buys and sells',
          'both directions',
          'turn off buy only',
          'turn off sell only',
          'normal direction',
          'normal trading direction',
          'allow both directions',
          'go back to normal trading',
        ],
        groups: [
          ['both', 'normal'],
          ['direction', 'directions', 'trading', 'buys', 'sells'],
        ],
      }),
    },
    {
      intent: 'mt4_pause',
      score: scoreIntent(input, {
        phrases: [
          'pause mt4',
          'pause my mt4',
          'stop mt4',
          'stop my mt4',
          'pause trading',
          'stop trading',
          'pause my trading account',
          'stop my trading account',
          'disable trading',
          'turn trading off',
          'shut trading down',
          'stop the bot from trading',
          'pause the bot',
          'pause my bot',
          'pause my ea',
          'stop my ea',
          'disable my ea',
          'turn off my ea',
          'turn off the bot',
          'turn off trading',
          'freeze trading',
          'halt trading',
        ],
        groups: [
          ['pause', 'stop', 'disable', 'halt', 'freeze', 'shut', 'off'],
          ['mt4', 'trading', 'account', 'bot', 'ea'],
        ],
        strong: ['pause', 'stop', 'disable', 'halt', 'freeze'],
      }),
    },
    {
      intent: 'mt4_resume',
      score: scoreIntent(input, {
        phrases: [
          'resume mt4',
          'resume my mt4',
          'resume trading',
          'turn trading on',
          'enable trading',
          'start trading again',
          'unpause mt4',
          'unpause trading',
          'let the bot trade',
          'turn the bot back on',
          'turn my ea back on',
          'enable my ea',
          'enable the bot',
          'continue trading',
          'allow trading',
        ],
        groups: [
          ['resume', 'enable', 'unpause', 'start', 'continue', 'allow', 'on'],
          ['mt4', 'trading', 'account', 'bot', 'ea'],
        ],
        strong: ['resume', 'enable', 'unpause', 'allow'],
      }),
    },
    {
      intent: 'mt4_connect',
      score: scoreIntent(input, {
        phrases: [
          'connect mt4',
          'pair mt4',
          'link mt4',
          'connect my trading account',
          'pair my account',
          'link my account',
          'connect my mt4',
        ],
        groups: [
          ['connect', 'pair', 'link', 'setup', 'sync'],
          ['mt4', 'account', 'trading account', 'reporter'],
        ],
      }),
    },
    {
      intent: 'mt4_status',
      score: scoreIntent(input, {
        phrases: [
          'mt4 status',
          'account status',
          'check mt4',
          'check my mt4',
          'check my account',
          'check the account',
          'trading account status',
          'is my mt4 connected',
          'latest snapshot',
          'how is my account',
          'how does my account look',
          'how my account looks',
          'how does the account look',
          'how is the account looking',
          'how are we looking',
          'how am i looking',
          'how is my trading account looking',
          'what does my account look like',
          'what is my balance',
          'what is my equity',
          'show my balance',
          'show my equity',
        ],
        groups: [
          ['status', 'check', 'snapshot', 'connected', 'sync', 'balance', 'equity', 'look', 'looking'],
          ['mt4', 'account', 'trading account', 'balance', 'equity'],
        ],
        strong: ['account', 'mt4', 'balance', 'equity'],
      }),
    },
    {
      intent: 'wisdo_review',
      score: scoreIntent(input, {
        phrases: [
          'review today',
          'analyze today',
          'review my day',
          'analyze my account',
          'how did i do today',
          'weekly review',
          'review this week',
          'how did i do this week',
        ],
        strong: ['review', 'analyze'],
        groups: [
          ['review', 'analyze', 'break down', 'explain'],
          ['today', 'week', 'account', 'trading', 'performance'],
        ],
      }),
    },
    {
      intent: 'clock_in',
      score: scoreIntent(input, {
        phrases: [
          'clock in',
          'start trading',
          'begin trading',
          'start my session',
          'open my session',
        ],
        strong: ['clock in'],
      }),
    },
    {
      intent: 'clock_out',
      score: scoreIntent(input, {
        phrases: [
          'clock out',
          'end trading',
          'finish trading',
          'close my session',
          'end my session',
        ],
        strong: ['clock out'],
      }),
    },
    {
      intent: 'log_ea',
      score: scoreIntent(input, {
        phrases: [
          'log ea',
          'log bot',
          'ea log',
          'record my ea',
          'record bot session',
        ],
        groups: [
          ['log', 'record', 'save'],
          ['ea', 'bot', 'session'],
        ],
      }),
    },
{
  intent: 'mt4_set_daily_loss_limit',
  score: scoreIntent(input, {
    phrases: [
      'set daily loss limit',
      'daily loss limit to',
      'set max daily loss',
      'max daily loss to',
      'do not lose more than',
      'stop me after losing',
    ],
    groups: [
      ['daily', 'day', 'max'],
      ['loss', 'lose', 'losing'],
      ['limit', 'stop'],
    ],
    strong: ['daily loss limit', 'max daily loss'],
  }),
},
 {
  intent: 'mt4_scenario_control',
  score: scoreIntent(input, {
    phrases: [
      'main entry',
      'allow ladders',
      'allow ladder',
      'collect at',
      'close all if drawdown',
      'if i go into drawdown',
      'if account drawdown',
      'take over',
      'walk away',
      'protect my account',
      'do not let account drawdown',
      'do not let my account draw down',
      'guardian scenario',
      'scenario mode',
    ],
    groups: [
      ['main', 'entry', 'anchor', 'start'],
      ['ladder', 'ladders', 'adds'],
      ['collect', 'profit', 'gain', 'target'],
      ['drawdown', 'loss', 'close', 'protect'],
    ],
    strong: [
      'main entry',
      'collect at',
      'close all if drawdown',
      'take over',
      'walk away',
      'protect my account',
    ],
  }),
},  
 {
      intent: 'profile',
      score: scoreIntent(input, {
        phrases: [
          'setup profile',
          'edit profile',
          'show profile',
          'my profile',
        ],
        strong: ['profile'],
      }),
    },
  ];

  intentScores.sort((a, b) => b.score - a.score);

  // WISDO_TRADING_INTENT_ROUTER_V1: protect trading verbs from being routed into the store.
  if (/\b(close|flatten|exit|liquidate)\b/.test(input) && /\b(trade|trades|position|positions|basket|account|my)\b/.test(input)) {
    return {
      intent: input.includes('profit') || input.includes('winner') ? 'mt4_take_winners' : 'mt4_emergency_stop',
      confidence: 100,
      secondIntent: intentScores[0]?.intent,
      secondScore: intentScores[0]?.score || 0,
      input,
    };
  }

  if (/\b(trim|partial|secure|collect|bank|take)\b/.test(input) && /\b(profit|profits|winner|winners|gain|gains)\b/.test(input)) {
    return {
      intent: 'mt4_take_winners',
      confidence: 100,
      secondIntent: intentScores[0]?.intent,
      secondScore: intentScores[0]?.score || 0,
      input,
    };
  }

  if (/\b(cut|close|trim|reduce)\b/.test(input) && /\b(loss|losses|loser|losers)\b/.test(input)) {
    return {
      intent: 'mt4_cut_losers',
      confidence: 100,
      secondIntent: intentScores[0]?.intent,
      secondScore: intentScores[0]?.score || 0,
      input,
    };
  }

  if (/\b(protect|guard|walk away|take over)\b/.test(input) && /\b(account|trade|trading|mt4|drawdown)\b/.test(input)) {
    return {
      intent: 'mt4_guard_mode',
      confidence: 100,
      secondIntent: intentScores[0]?.intent,
      secondScore: intentScores[0]?.score || 0,
      input,
    };
  }

  if (
    input.includes('account') &&
    (
      input.includes('look') ||
      input.includes('looking') ||
      input.includes('status') ||
      input.includes('balance') ||
      input.includes('equity') ||
      input.includes('connected')
    )
  ) {
    return {
      intent: 'mt4_status',
      confidence: 99,
      secondIntent: intentScores[0]?.intent,
      secondScore: intentScores[0]?.score || 0,
      input,
    };
  }

  const top = intentScores[0];

  if (!top || top.score <= 0) {
    return {
      intent: 'unknown',
      confidence: 0,
      input,
    };
  }

  const second = intentScores[1];

  return {
    intent: top.intent,
    confidence: top.score,
    secondIntent: second?.intent,
    secondScore: second?.score || 0,
    input,
  };
}

function getPeriodFromVoice(ask) {
  const input = normalizeVoiceInput(ask);

  if (
    input.includes('week') ||
    input.includes('weekly') ||
    input.includes('this week')
  ) {
    return 'week';
  }

  return 'today';
}

function extractScenarioFromVoice(ask) {
  const input = normalizeVoiceInput(ask);
  const raw = String(ask || '').toLowerCase();

  const scenario = {
    situationCode: 1001,
    direction: 0,
    mainEntryNow: input.includes('main entry') || input.includes('anchor') || input.includes('start'),
    maxLadders: null,
    collectGainPct: null,
    drawdownClosePct: null,
    autoTrimPct: null,
    trailGivebackPct: null,
    maxBasketLossMoney: null,
    maxFloatingDDPct: null,
    pauseNewEntries: false,
    pauseAfterClose: true,
    lockDayAfterClose: true,
  };

  if (
    input.includes('walk away') ||
    input.includes('take over') ||
    input.includes('protect my account') ||
    input.includes('do not let account drawdown') ||
    input.includes('do not let my account draw down')
  ) {
    scenario.situationCode = 1002;
    scenario.pauseNewEntries = true;
  }

  if (input.includes('buy only') || input.includes('buys only') || input.includes('long only')) {
    scenario.direction = 1;
  }

  if (input.includes('sell only') || input.includes('sells only') || input.includes('short only')) {
    scenario.direction = -1;
  }

  const ladderMatch = raw.match(/(?:allow\s*)?(\d+)\s*(?:ladder|ladders|adds|add ons|add-ons)/i);
  if (ladderMatch) {
    scenario.maxLadders = Number(ladderMatch[1]);
  }

  const collectMatch = raw.match(/(?:collect|gain|profit|target)\s*(?:at|to|is|=)?\s*(\d+(\.\d+)?)\s*%?/i);
  if (collectMatch) {
    scenario.collectGainPct = Number(collectMatch[1]);
  }

  const ddMatch = raw.match(/(?:drawdown|draw down|dd|loss)\s*(?:by|hits|hit|at|to|is|=)?\s*(\d+(\.\d+)?)\s*%?/i);
  if (ddMatch) {
    scenario.drawdownClosePct = Number(ddMatch[1]);
  }

  const trimMatch = raw.match(/(?:auto trim|trim profits|secure profits)\s*(\d+(\.\d+)?)\s*%?/i);
  if (trimMatch) {
    scenario.autoTrimPct = Number(trimMatch[1]);
  }

  const trailMatch = raw.match(/(?:trail giveback|giveback|give back)\s*(\d+(\.\d+)?)\s*%?/i);
  if (trailMatch) {
    scenario.trailGivebackPct = Number(trailMatch[1]);
  }

  const basketLossMatch = raw.match(/(?:basket loss|floating loss|max loss)\s*(?:at|to|is|=)?\s*\$?(\d+(\.\d+)?)/i);
  if (basketLossMatch) {
    scenario.maxBasketLossMoney = Number(basketLossMatch[1]);
  }

  return scenario;
}
function extractNumberFromVoice(ask) {
  const match = String(ask || '').match(/(\d+(\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function extractBotNameFromVoice(ask, intent) {
  let cleaned = String(ask || '');

  const remove = [
    'wisdo',
    'wisdom',
    'hey wisdom',
    'hey wisdo',
    'yo wisdom',
    'yo wisdo',
    'wizzo',
    'wiz do',
    'wizdo',
    'wise doe',
    'wise do',
    'trading assistant',
    'hey trading assistant',
    'coach',
    'hey coach',
    'operator',
    'hey operator',
    'please',
    'can you',
    'could you',
    'would you',
    'for me',
    'i want to',
    'i need to',
    'let me',
    'show me',
    'tell me',
    'about',
    'the',
    'a',
    'an',
  ];

  const intentRemove = {
    bot_info: [
      'bot info',
      'explain bot',
      'explain',
      'info',
      'information',
      'details',
      'what does',
      'what is',
      'do',
    ],
    buy_bot: [
      'buy',
      'purchase',
      'checkout',
      'pay for',
      'quote',
      'price',
      'order',
      'bot',
    ],
    claim_free_bot: [
      'claim',
      'free bot',
      'free',
      'redeem',
      'use my free claim',
      'bot',
    ],
  };

  for (const phrase of [...remove, ...(intentRemove[intent] || [])]) {
    const regex = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'ig');
    cleaned = cleaned.replace(regex, ' ');
  }

  cleaned = cleaned
    .replace(/[^\w\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || null;
}

function createVoiceCommandInteraction(message, commandName, optionValues = {}) {
  let repliedMessage = null;

  const options = {
    getString(name, required = false) {
      const value = optionValues[name];

      if ((value === undefined || value === null || value === '') && required) {
        throw new Error(`Missing voice option: ${name}`);
      }

      return value ?? null;
    },

    getNumber(name, required = false) {
      const value = optionValues[name];

      if ((value === undefined || value === null || value === '') && required) {
        throw new Error(`Missing voice option: ${name}`);
      }

      if (value === undefined || value === null || value === '') {
        return null;
      }

      return Number(value);
    },

    getInteger(name, required = false) {
      const value = optionValues[name];

      if ((value === undefined || value === null || value === '') && required) {
        throw new Error(`Missing voice option: ${name}`);
      }

      if (value === undefined || value === null || value === '') {
        return null;
      }

      return parseInt(value, 10);
    },

    getBoolean(name, required = false) {
      const value = optionValues[name];

      if ((value === undefined || value === null || value === '') && required) {
        throw new Error(`Missing voice option: ${name}`);
      }

      if (value === undefined || value === null || value === '') {
        return null;
      }

      return Boolean(value);
    },

    getUser(name, required = false) {
      const value = optionValues[name];

      if (!value && required) {
        throw new Error(`Missing voice user option: ${name}`);
      }

      return value ?? null;
    },

    getMember(name, required = false) {
      const value = optionValues[name];

      if (!value && required) {
        throw new Error(`Missing voice member option: ${name}`);
      }

      return value ?? null;
    },

    getSubcommand(required = false) {
      const value = optionValues.subcommand;

      if (!value && required) {
        throw new Error('Missing voice subcommand');
      }

      return value ?? null;
    },
  };

  return {
    commandName,
    user: message.author,
    member: message.member,
    guild: message.guild,
    guildId: message.guildId,
    channel: message.channel,
    channelId: message.channelId,
    client: message.client,
    options,
    deferred: false,
    replied: false,

    isChatInputCommand() {
      return true;
    },

    isModalSubmit() {
      return false;
    },

    isRepliable() {
      return true;
    },

    async deferReply() {
      this.deferred = true;
      await message.channel.sendTyping().catch(() => null);
    },

    async reply(payload) {
      this.replied = true;
      repliedMessage = await message.reply(stripEphemeral(payload));
      return repliedMessage;
    },

    async editReply(payload) {
      this.replied = true;

      if (repliedMessage) {
        await repliedMessage.edit(stripEphemeral(payload));
        return repliedMessage;
      }

      repliedMessage = await message.reply(stripEphemeral(payload));
      return repliedMessage;
    },

    async followUp(payload) {
      this.replied = true;
      return message.reply(stripEphemeral(payload));
    },

    async showModal() {
      this.replied = true;
      await message.reply({
        content: 'WISDO understood the request, but this action needs a Discord form. Open the slash command once so Discord can show the form.',
      });
    },
  };
}

function stripEphemeral(payload) {
  if (typeof payload === 'string') return payload;

  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const { ephemeral, ...rest } = payload;

  return rest;
}

async function runSlashCommandFromVoice({
  message,
  registry,
  commandName,
  optionValues = {},
}) {
  const command = registry.commandMap.get(commandName);

  if (!command) {
    return {
      content: `WISDO understood the request, but **/${commandName}** is not loaded in the command registry.`,
      speechText: `WISDO understood the request, but the command ${commandName} is not loaded in the command registry.`,
    };
  }

  const voiceInteraction = createVoiceCommandInteraction(
    message,
    commandName,
    optionValues,
  );

  await command.execute(voiceInteraction);

  return null;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


function normalizeVoiceAlias(value = '') {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function voiceLaneTitle(lane) {
  const name = lane.botNickname || lane.botLabel || lane.botKey || 'Bot';
  return `${name} — ${lane.symbol} — Magic ${lane.magicNumber}`;
}

function voiceClosePayloadFromLane(lane, mode = 'all', percent = 100) {
  // Nickname/voice closes must always be lane-specific.
  // Do not send broad commands like CLOSE_ALL_WINNERS here, because they can reach MT4 without the lane filter.
  const command = 'CLOSE_BY_MAGIC';
  return {
    source: 'wisdo_voice_nickname_registry',
    commandName: command,
    command,
    accountId: lane.accountId || null,
    accountNumber: lane.accountNumber,
    bot: lane.botKey,
    botNickname: lane.botNickname || '',
    symbol: lane.symbol,
    magicNumber: lane.magicNumber,
    targetMagic: lane.magicNumber,
    targetSymbol: lane.symbol,
    percent,
    closeMode: mode,
    targetMode: mode,
    laneKey: lane.laneKey,
    lanePrefix: lane.lanePrefix,
    strictLane: true,
    note: `Voice command resolved from CEM bot registry lane ${lane.laneKey}`,
  };
}

async function buildBotNicknameCloseVoiceResponse({
  ask,
  message,
  botRegistryService,
  mt4CommandService,
}) {
  const lower = String(ask || '').toLowerCase();
  const closeIntent = /\b(close|flatten|exit|liquidate)\b/.test(lower) && /\b(trade|trades|position|positions|basket)\b/.test(lower);
  if (!closeIntent || !botRegistryService || !mt4CommandService) return null;

  const lanes = await botRegistryService.listLanes(message.author.id, { includeStale: true }).catch(() => []);
  if (!lanes?.length) {
    const namedClose = /\b(close|flatten|exit|liquidate)\b\s+(?:all\s+)?([a-z0-9 _-]{2,40})\s+(?:trade|trades|position|positions)\b/i.exec(ask || '');
    if (namedClose && !['all', 'my', 'open', 'the', 'everything'].includes(normalizeVoiceAlias(namedClose[2]))) {
      return {
        content: [
          '🧠 **WISDO heard a bot-close command, but no bot lanes are registered yet.**',
          '',
          'Run `/wisdo-bot-lanes` first. If nothing shows, let the upgraded MT4 Reporter sync once.',
        ].join('\n'),
        speechText: 'I heard a bot close command, but no bot lanes are registered yet. Run wisdo bot lanes first.',
      };
    }
    return null;
  }

  const normalizedAsk = normalizeVoiceAlias(ask);
  const matches = [];
  const seen = new Set();

  for (const lane of lanes) {
    const aliases = [lane.botNickname, lane.botKey, lane.botLabel]
      .filter(Boolean)
      .map(normalizeVoiceAlias)
      .filter((alias) => alias.length >= 2);

    const matched = aliases.some((alias) => normalizedAsk.includes(alias));
    if (!matched) continue;

    const mentionsGold = /\b(gold|xau|xauusd)\b/.test(normalizedAsk);
    if (mentionsGold && String(lane.symbol || '').toUpperCase().indexOf('XAU') < 0) continue;

    if (!seen.has(lane.laneKey)) {
      seen.add(lane.laneKey);
      matches.push(lane);
    }
  }

  if (!matches.length) {
    const namedClose = /\b(close|flatten|exit|liquidate)\b\s+(?:all\s+)?([a-z0-9 _-]{2,40})\s+(?:trade|trades|position|positions)\b/i.exec(ask || '');
    if (namedClose && !['all', 'my', 'open', 'the', 'everything'].includes(normalizeVoiceAlias(namedClose[2]))) {
      return {
        content: [
          '🧠 **WISDO heard the close request, but I could not match that nickname to a connected bot lane.**',
          '',
          `Phrase heard: \`${ask}\``,
          '',
          'Run `/wisdo-bot-lanes` to see current lanes, then `/wisdo-nickname-bot` to save names like **Deadpool**.',
        ].join('\n'),
        speechText: 'I heard the close request, but I could not match that nickname to a connected bot lane.',
      };
    }
    return null;
  }

  const mode = /\b(winner|winners|profit|profits|green)\b/.test(lower)
    ? 'winners'
    : /\b(loser|losers|loss|losses|red)\b/.test(lower)
      ? 'losers'
      : 'all';

  const queued = [];
  for (const lane of matches) {
    const payload = voiceClosePayloadFromLane(lane, mode, 100);
    const record = await mt4CommandService.queueCommandForAccount(
      message.author.id,
      lane.accountId || payload.accountId || null,
      payload.command,
      {
        requestedBy: message.author.id,
        guildId: message.guildId,
        channelId: message.channelId,
        ...payload,
      },
    );
    queued.push({ lane, record });
  }

  return {
    content: [
      '🧠 **WISDO resolved your voice command through the bot nickname registry.**',
      '',
      `Heard: \`${ask}\``,
      `Action: **Close ${mode === 'all' ? 'all matching' : mode} trades**`,
      '',
      ...queued.slice(0, 10).map(({ lane, record }) => `• **${voiceLaneTitle(lane)}** → Command ID: \`${record.id}\``),
      queued.length > 10 ? `\nQueued ${queued.length} lanes total.` : '',
      '',
      'The MT4 Reporter will close by **symbol + magic number**, not by a broad account-wide emergency stop.',
    ].filter(Boolean).join('\n'),
    speechText: `WISDO resolved ${ask} through the bot nickname registry and queued the close command for ${queued.length} bot lane${queued.length === 1 ? '' : 's'}.`,
  };
}

async function queueMt4ControlCommand({
  message,
  mt4CommandService,
  command,
  payload = {},
}) {
  return mt4CommandService.queueCommand(
    message.author.id,
    command,
    {
      source: 'wisdo_voice',
      requestedBy: message.author.id,
      guildId: message.guildId,
      channelId: message.channelId,
      ...payload,
    },
  );
}

async function replyWithWisdoTextAndSpeech({
  message,
  response,
  wisdoSpeechService,
}) {
  const payload = typeof response === 'string'
    ? { content: response }
    : { ...response };

  const speechText =
    payload.speechText ||
    payload.content ||
    'WISDO completed the request.';

  if (!wisdoSpeechService?.isReady()) {
    delete payload.speechText;
    await message.reply(payload);
    return;
  }

  try {
    const audio = await wisdoSpeechService.createSpeechFile(
      speechText,
      'wisdo-reply',
    );

    if (audio?.filePath) {
      payload.files = [
        ...(payload.files || []),
        {
          attachment: audio.filePath,
          name: audio.fileName,
        },
      ];
    }
  } catch (error) {
    logger.error('WISDO speech reply failed', {
      message: error.message,
      stack: error.stack,
    });
  }

  delete payload.speechText;

  await message.reply(payload);
}

async function buildWisdoVoiceResponse({
  ask,
  message,
  botStoreService,
  mt4SyncService,
  mt4CommandService,
  copyTradingService,
  wisdoSpeechService,
  service,
  registry,
  botRegistryService,
}) {
  const botNicknameCloseResponse = await buildBotNicknameCloseVoiceResponse({
    ask,
    message,
    botRegistryService,
    mt4CommandService,
  });

  if (botNicknameCloseResponse) {
    return botNicknameCloseResponse;
  }

  const detected = detectWisdoIntent(ask);
  const intent = detected.intent;

  if (intent === 'help') {
    return {
      content: [
        '🧠 **WISDO Voice Help**',
        '',
        'You can talk naturally. You do not have to say the exact slash command.',
        '',
        '**Examples:**',
        '`Hey Wisdom, what bots are available?`',
        '`Hey Wisdom, tell me about the Handsfree bot.`',
        '`Hey Wisdom, I want to buy Handsfree.`',
        '`Hey Wisdom, what is Culture Coin?`',
        '`Hey Coach, how does my account look?`',
        '`Hey Coach, pause my MT4.`',
        '`Hey Coach, put my account in Guard Mode.`',
        '`Hey Coach, only allow buys.`',
        '`Hey Coach, only allow sells.`',
        '`Hey Coach, set max trades to 3.`',
        '`Hey Wisdom, set equity floor to 25 dollars.`',
        '`Hey Coach, set risk to 1 percent.`',
        '`Hey Coach, emergency stop.`',
        '',
        'WISDO deciphers the sentence, replies with text, and can attach a voice response when speech is enabled.',
      ].join('\n'),
      speechText:
        'WISDO voice help. You can talk naturally. Try saying, Hey Coach, how does my account look, Hey Coach, pause my MT4, or Hey Coach, put my account in guard mode.',
    };
  }

  if (intent === 'bot_catalog') {
    return runSlashCommandFromVoice({
      message,
      registry,
      commandName: 'bots',
    });
  }

  if (intent === 'culture_coin_info') {
    return runSlashCommandFromVoice({
      message,
      registry,
      commandName: 'culture-coin-info',
    });
  }

  if (intent === 'my_bots') {
    return runSlashCommandFromVoice({
      message,
      registry,
      commandName: 'my-bots',
    });
  }

  if (intent === 'bot_info') {
    const botName = extractBotNameFromVoice(ask, intent);

    if (!botName) {
      return {
        content: [
          '📘 **WISDO understood: bot info.**',
          '',
          'Tell me which bot you want information on.',
          '',
          'Example:',
          '`Hey Wisdom, tell me about Handsfree.`',
        ].join('\n'),
        speechText:
          'WISDO understood bot information. Tell me which bot you want information on. For example, Hey Wisdom, tell me about Handsfree.',
      };
    }

    return runSlashCommandFromVoice({
      message,
      registry,
      commandName: 'bot-info',
      optionValues: {
        bot: botName,
      },
    });
  }

  if (intent === 'buy_bot') {
    const botName = extractBotNameFromVoice(ask, intent);

    if (!botName) {
      return {
        content: [
          '💳 **WISDO understood: buy bot / create quote.**',
          '',
          'Tell me which bot you want.',
          '',
          'Example:',
          '`Operator, I want to buy Handsfree.`',
        ].join('\n'),
        speechText:
          'WISDO understood buy bot. Tell me which bot you want. For example, Operator, I want to buy Handsfree.',
      };
    }

    return runSlashCommandFromVoice({
      message,
      registry,
      commandName: 'buy-bot',
      optionValues: {
        bots: botName,
      },
    });
  }

  if (intent === 'claim_free_bot') {
    const botName = extractBotNameFromVoice(ask, intent);

    if (!botName) {
      return {
        content: [
          '🎁 **WISDO understood: claim free bot.**',
          '',
          'Tell me which bot you want to claim.',
          '',
          'Example:',
          '`Hey Wisdom, claim my free Handsfree bot.`',
        ].join('\n'),
        speechText:
          'WISDO understood free bot claim. Tell me which bot you want to claim.',
      };
    }

    return runSlashCommandFromVoice({
      message,
      registry,
      commandName: 'claim-free-bot',
      optionValues: {
        bot: botName,
      },
    });
  }

  if (intent === 'mt4_guard_mode') {
    const command = await queueMt4ControlCommand({
      message,
      mt4CommandService,
      command: 'SET_CONTROL_MODE',
      payload: {
        mode: 'GUARD',
        allowNewTrades: false,
        guardMode: true,
        maxTrades: 1,
        riskPercent: 0.25,
        note: 'Guard mode from WISDO voice command.',
      },
    });

    return {
      content: [
        '🛡️ **WISDO queued Guard Mode.**',
        '',
        `Command ID: \`${command.id}\``,
        '',
        'Guard Mode means:',
        '• No aggressive trading',
        '• New trades paused or heavily restricted',
        '• Risk reduced',
        '• Account protection takes priority',
        '',
        'Existing trades are not closed unless your MT4 control EA is programmed to do that.',
      ].join('\n'),
      speechText:
        'WISDO queued Guard Mode. New trades are paused or heavily restricted, risk is reduced, and account protection takes priority. Existing trades are not closed.',
    };
  }

  if (intent === 'mt4_emergency_stop') {
    const command = await queueMt4ControlCommand({
      message,
      mt4CommandService,
      command: 'EMERGENCY_STOP',
      payload: {
        closeTrades: false,
        pauseTrading: true,
        allowNewTrades: false,
        requiresMt4Confirmation: true,
        note: 'Safe emergency stop from WISDO voice command.',
      },
    });

    return {
      content: [
        '🚨 **WISDO queued Emergency Stop.**',
        '',
        `Command ID: \`${command.id}\``,
        '',
        'Safe default:',
        '• New trades paused',
        '• Existing trades are **not closed** by this command',
        '• MT4 must confirm once the command is applied',
        '',
        'Later we can add a separate confirmed command for closing trades.',
      ].join('\n'),
      speechText:
        'WISDO queued Emergency Stop. New trades are paused. Existing trades are not closed by this command. MT4 must confirm once the command is applied.',
    };
  }

  if (intent === 'mt4_set_max_trades') {
    const value = extractNumberFromVoice(ask);

    if (value === null || value < 0) {
      return {
        content: [
          '⚙️ **WISDO understood: set max trades.**',
          '',
          'Tell me the number.',
          '',
          'Example:',
          '`Hey Coach, set max trades to 3.`',
        ].join('\n'),
        speechText:
          'WISDO understood set max trades. Tell me the number. For example, Hey Coach, set max trades to three.',
      };
    }

    const command = await queueMt4ControlCommand({
      message,
      mt4CommandService,
      command: 'SET_RISK_LIMIT',
      payload: {
        key: 'MAX_TRADES',
        value,
      },
    });

    return {
      content: [
        '⚙️ **WISDO queued Max Trades limit.**',
        '',
        `Command ID: \`${command.id}\``,
        `Max trades: **${value}**`,
      ].join('\n'),
      speechText: `WISDO queued max trades limit. Max trades is now set to ${value}.`,
    };
  }

  if (intent === 'mt4_set_equity_floor') {
    const value = extractNumberFromVoice(ask);

    if (value === null || value < 0) {
      return {
        content: [
          '🧱 **WISDO understood: set equity floor.**',
          '',
          'Tell me the dollar amount.',
          '',
          'Example:',
          '`Hey Wisdom, set equity floor to 25 dollars.`',
        ].join('\n'),
        speechText:
          'WISDO understood set equity floor. Tell me the dollar amount. For example, Hey Wisdom, set equity floor to twenty five dollars.',
      };
    }

    const command = await queueMt4ControlCommand({
      message,
      mt4CommandService,
      command: 'SET_RISK_LIMIT',
      payload: {
        key: 'EQUITY_FLOOR',
        value,
      },
    });

    return {
      content: [
        '🧱 **WISDO queued Equity Floor.**',
        '',
        `Command ID: \`${command.id}\``,
        `Equity floor: **$${value}**`,
        '',
        'MT4 should protect against opening new trades below this floor once it receives the command.',
      ].join('\n'),
      speechText:
        `WISDO queued equity floor. Your equity floor is set to ${value} dollars. MT4 should protect against opening new trades below this floor.`,
    };
  }

  if (intent === 'mt4_set_risk_percent') {
    const value = extractNumberFromVoice(ask);

    if (value === null || value < 0) {
      return {
        content: [
          '📉 **WISDO understood: set risk percent.**',
          '',
          'Tell me the percentage.',
          '',
          'Example:',
          '`Hey Coach, set risk to 1 percent.`',
        ].join('\n'),
        speechText:
          'WISDO understood set risk percent. Tell me the percentage. For example, Hey Coach, set risk to one percent.',
      };
    }

    const command = await queueMt4ControlCommand({
      message,
      mt4CommandService,
      command: 'SET_RISK_LIMIT',
      payload: {
        key: 'RISK_PERCENT',
        value,
      },
    });

    return {
      content: [
        '📉 **WISDO queued Risk Percent.**',
        '',
        `Command ID: \`${command.id}\``,
        `Risk percent: **${value}%**`,
      ].join('\n'),
      speechText: `WISDO queued risk percent. Risk is set to ${value} percent.`,
    };
  }
  if (intent === 'mt4_take_winners') {
    const value = extractNumberFromVoice(ask) ?? 40;

    const command = await queueMt4ControlCommand({
      message,
      mt4CommandService,
      command: 'TAKE_WINNERS',
      payload: {
        percent: value,
        globals: {
          WISDO_COMMAND_ID: Date.now(),
          WISDO_LAST_COMMAND: 'TAKE_WINNERS',
          WISDO_TAKE_WINNERS_PERCENT: value,
          WISDO_CLOSE_WINNERS_PERCENT: value,
        },
      },
    });

    return {
      content: [
        '💰 **WISDO queued Close Profits.**',
        '',
        `Command ID: \`${command.id}\``,
        `Close winners: **${value}%**`,
        '',
        'MT4 Global Variables:',
        '```',
        `WISDO_TAKE_WINNERS_PERCENT = ${value}`,
        `WISDO_CLOSE_WINNERS_PERCENT = ${value}`,
        '```',
      ].join('\n'),
      speechText: `WISDO queued close profits. It will close ${value} percent of winning trades.`,
    };
  }

  if (intent === 'mt4_cut_losers') {
    const value = extractNumberFromVoice(ask) ?? 50;

    const command = await queueMt4ControlCommand({
      message,
      mt4CommandService,
      command: 'CUT_LOSERS',
      payload: {
        percent: value,
        globals: {
          WISDO_COMMAND_ID: Date.now(),
          WISDO_LAST_COMMAND: 'CUT_LOSERS',
          WISDO_CUT_LOSERS_PERCENT: value,
          WISDO_CLOSE_LOSERS_PERCENT: value,
        },
      },
    });

    return {
      content: [
        '🪓 **WISDO queued Cut Losers.**',
        '',
        `Command ID: \`${command.id}\``,
        `Close losers: **${value}%**`,
        '',
        'MT4 Global Variables:',
        '```',
        `WISDO_CUT_LOSERS_PERCENT = ${value}`,
        `WISDO_CLOSE_LOSERS_PERCENT = ${value}`,
        '```',
      ].join('\n'),
      speechText: `WISDO queued cut losers. It will close ${value} percent of losing trades.`,
    };
  }

  if (intent === 'mt4_set_daily_gain') {
    const value = extractNumberFromVoice(ask);

    if (value === null || value < 0) {
      return {
        content: [
          '🎯 **WISDO understood: set daily gain.**',
          '',
          'Tell me the percent.',
          '',
          'Example:',
          '`Hey Coach, set daily gain to 40 percent.`',
        ].join('\n'),
        speechText:
          'WISDO understood set daily gain. Tell me the percent. For example, Hey Coach, set daily gain to forty percent.',
      };
    }

    const command = await queueMt4ControlCommand({
      message,
      mt4CommandService,
      command: 'SET_DAILY_GAIN',
      payload: {
        percent: value,
        globals: {
          WISDO_COMMAND_ID: Date.now(),
          WISDO_LAST_COMMAND: 'SET_DAILY_GAIN',
          WISDO_DAILY_GOAL_PERCENT: value,
          WISDO_OVERRIDE_DAILY_GOAL_PERCENT: value,
        },
      },
    });

    return {
      content: [
        '🎯 **WISDO queued Daily Gain.**',
        '',
        `Command ID: \`${command.id}\``,
        `Daily gain: **${value}%**`,
        '',
        'MT4 Global Variables:',
        '```',
        `WISDO_DAILY_GOAL_PERCENT = ${value}`,
        `WISDO_OVERRIDE_DAILY_GOAL_PERCENT = ${value}`,
        '```',
      ].join('\n'),
      speechText: `WISDO queued daily gain. Daily goal is now ${value} percent.`,
    };
  }

  if (intent === 'mt4_ladder_increment') {
    const numbers = String(ask || '').match(/(\d+(\.\d+)?)/g) || [];
    const next = numbers[0] ? Number(numbers[0]) : 0.01;
    const rest = numbers[1] ? Number(numbers[1]) : 0.04;

    const command = await queueMt4ControlCommand({
      message,
      mt4CommandService,
      command: 'SET_LADDER_INCREMENT',
      payload: {
        next,
        rest,
        globals: {
          WISDO_COMMAND_ID: Date.now(),
          WISDO_LAST_COMMAND: 'SET_LADDER_INCREMENT',
          WISDO_NEXT_LADDER_INCREMENT: next,
          WISDO_REST_LADDER_INCREMENT: rest,
          WISDO_FIRST_LADDER_INCREMENT: next,
          WISDO_DEFAULT_LADDER_INCREMENT: rest,
        },
      },
    });

    return {
      content: [
        '🪜 **WISDO queued Ladder Increment.**',
        '',
        `Command ID: \`${command.id}\``,
        `Next ladder increment: **${next}**`,
        `Rest ladder increment: **${rest}**`,
        '',
        'MT4 Global Variables:',
        '```',
        `WISDO_NEXT_LADDER_INCREMENT = ${next}`,
        `WISDO_REST_LADDER_INCREMENT = ${rest}`,
        `WISDO_FIRST_LADDER_INCREMENT = ${next}`,
        `WISDO_DEFAULT_LADDER_INCREMENT = ${rest}`,
        '```',
      ].join('\n'),
      speechText: `WISDO queued ladder increment. Next ladder is ${next}, rest is ${rest}.`,
    };
  }

  if (intent === 'mt4_hedge_on') {
    const command = await queueMt4ControlCommand({
      message,
      mt4CommandService,
      command: 'HEDGE_ON',
      payload: {
        globals: {
          WISDO_COMMAND_ID: Date.now(),
          WISDO_LAST_COMMAND: 'HEDGE_ON',
          WISDO_HEDGE_ALLOWED: 1,
          WISDO_HEDGE_MODE: 1,
        },
      },
    });

    return {
      content: [
        '🧬 **WISDO queued Hedge Mode ON.**',
        '',
        `Command ID: \`${command.id}\``,
        '',
        'MT4 Global Variables:',
        '```',
        'WISDO_HEDGE_ALLOWED = 1',
        'WISDO_HEDGE_MODE = 1',
        '```',
      ].join('\n'),
      speechText: 'WISDO queued hedge mode on.',
    };
  }

  if (intent === 'mt4_hedge_now') {
    const value = extractNumberFromVoice(ask) ?? 50;

    const command = await queueMt4ControlCommand({
      message,
      mt4CommandService,
      command: 'HEDGE_NOW',
      payload: {
        percent: value,
        globals: {
          WISDO_COMMAND_ID: Date.now(),
          WISDO_LAST_COMMAND: 'HEDGE_NOW',
          WISDO_HEDGE_NOW: 1,
          WISDO_HEDGE_PERCENT: value,
        },
      },
    });

    return {
      content: [
        '⚖️ **WISDO queued Hedge Now.**',
        '',
        `Command ID: \`${command.id}\``,
        `Hedge percent: **${value}%**`,
        '',
        'MT4 Global Variables:',
        '```',
        'WISDO_HEDGE_NOW = 1',
        `WISDO_HEDGE_PERCENT = ${value}`,
        '```',
      ].join('\n'),
      speechText: `WISDO queued hedge now at ${value} percent.`,
    };
  }

  if (intent === 'mt4_another_anchor') {
    const command = await queueMt4ControlCommand({
      message,
      mt4CommandService,
      command: 'ALLOW_ANOTHER_ANCHOR',
      payload: {
        globals: {
          WISDO_COMMAND_ID: Date.now(),
          WISDO_LAST_COMMAND: 'ALLOW_ANOTHER_ANCHOR',
          WISDO_ALLOW_ANOTHER_ANCHOR: 1,
          WISDO_PAUSE_NEW_ANCHOR: 0,
          WISDO_RESUME_TRADING: 1,
        },
      },
    });

    return {
      content: [
        '🟢 **WISDO queued Another Anchor Allowed.**',
        '',
        `Command ID: \`${command.id}\``,
        '',
        'MT4 Global Variables:',
        '```',
        'WISDO_ALLOW_ANOTHER_ANCHOR = 1',
        'WISDO_PAUSE_NEW_ANCHOR = 0',
        'WISDO_RESUME_TRADING = 1',
        '```',
      ].join('\n'),
      speechText: 'WISDO queued another anchor allowed.',
    };
  }
  if (intent === 'mt4_set_daily_loss_limit') {
    const value = extractNumberFromVoice(ask);

    if (value === null || value < 0) {
      return {
        content: [
          '🧯 **WISDO understood: set daily loss limit.**',
          '',
          'Tell me the amount.',
          '',
          'Example:',
          '`Hey Coach, set daily loss limit to 50 dollars.`',
        ].join('\n'),
        speechText:
          'WISDO understood set daily loss limit. Tell me the amount. For example, Hey Coach, set daily loss limit to fifty dollars.',
      };
    }

    const command = await queueMt4ControlCommand({
      message,
      mt4CommandService,
      command: 'SET_RISK_LIMIT',
      payload: {
        key: 'DAILY_LOSS_LIMIT',
        value,
      },
    });

    return {
      content: [
        '🧯 **WISDO queued Daily Loss Limit.**',
        '',
        `Command ID: \`${command.id}\``,
        `Daily loss limit: **$${value}**`,
      ].join('\n'),
      speechText: `WISDO queued daily loss limit. Daily loss limit is set to ${value} dollars.`,
    };
  }

  if (intent === 'mt4_buy_only') {
    const command = await queueMt4ControlCommand({
      message,
      mt4CommandService,
      command: 'SET_DIRECTION_MODE',
      payload: {
        direction: 'BUY_ONLY',
      },
    });

    return {
      content: [
        '🟢 **WISDO queued Buy-Only Mode.**',
        '',
        `Command ID: \`${command.id}\``,
        '',
        'MT4 should block new sell entries after it receives this command.',
      ].join('\n'),
      speechText:
        'WISDO queued Buy Only Mode. MT4 should block new sell entries after it receives this command.',
    };
  }

  if (intent === 'mt4_sell_only') {
    const command = await queueMt4ControlCommand({
      message,
      mt4CommandService,
      command: 'SET_DIRECTION_MODE',
      payload: {
        direction: 'SELL_ONLY',
      },
    });

    return {
      content: [
        '🔴 **WISDO queued Sell-Only Mode.**',
        '',
        `Command ID: \`${command.id}\``,
        '',
        'MT4 should block new buy entries after it receives this command.',
      ].join('\n'),
      speechText:
        'WISDO queued Sell Only Mode. MT4 should block new buy entries after it receives this command.',
    };
  }

  if (intent === 'mt4_both_directions') {
    const command = await queueMt4ControlCommand({
      message,
      mt4CommandService,
      command: 'SET_DIRECTION_MODE',
      payload: {
        direction: 'BOTH',
      },
    });

    return {
      content: [
        '⚖️ **WISDO queued Both-Directions Mode.**',
        '',
        `Command ID: \`${command.id}\``,
        '',
        'MT4 may allow both buy and sell entries again after it receives this command.',
      ].join('\n'),
      speechText:
        'WISDO queued both directions mode. MT4 may allow both buy and sell entries again after it receives this command.',
    };
  }

  if (intent === 'mt4_pause') {
    const command = await queueMt4ControlCommand({
      message,
      mt4CommandService,
      command: 'PAUSE_TRADING',
      payload: {
        allowNewTrades: false,
      },
    });

    return {
      content: [
        '🛑 **WISDO queued MT4 pause.**',
        '',
        `Command ID: \`${command.id}\``,
        '',
        '**Safe meaning:** connected MT4 should stop opening new trades once it receives this command.',
        '',
        'Existing trades are not closed by this command.',
      ].join('\n'),
      speechText:
        'WISDO queued MT4 pause. Your connected MT4 should stop opening new trades once it receives this command. Existing trades are not closed.',
    };
  }

  if (intent === 'mt4_resume') {
    const command = await queueMt4ControlCommand({
      message,
      mt4CommandService,
      command: 'RESUME_TRADING',
      payload: {
        allowNewTrades: true,
      },
    });

    return {
      content: [
        '🟢 **WISDO queued MT4 resume.**',
        '',
        `Command ID: \`${command.id}\``,
        '',
        '**Safe meaning:** connected MT4 may allow new trades again once it receives this command.',
      ].join('\n'),
      speechText:
        'WISDO queued MT4 resume. Your connected MT4 may allow new trades again once it receives this command.',
    };
  }
if (intent === 'mt4_scenario_control') {
  const scenario = extractScenarioFromVoice(ask);

  const globals = {
    COMMAND_ID: Date.now(),
    LAST_COMMAND: 'SCENARIO_CONTROL',
    SITUATION_CODE: scenario.situationCode,
    SCENARIO_DIRECTION: scenario.direction,
    SCENARIO_START_NOW: 1,
    SCENARIO_PAUSE_NEW_ENTRIES: scenario.pauseNewEntries ? 1 : 0,
    SCENARIO_PAUSE_AFTER_CLOSE: scenario.pauseAfterClose ? 1 : 0,
    SCENARIO_LOCK_DAY_AFTER_CLOSE: scenario.lockDayAfterClose ? 1 : 0,
  };

  if (scenario.mainEntryNow) {
    globals.SCENARIO_MAIN_ENTRY_NOW = 1;
  }

  if (scenario.maxLadders !== null) {
    globals.SCENARIO_MAX_LADDERS = scenario.maxLadders;
  }

  if (scenario.collectGainPct !== null) {
    globals.SCENARIO_COLLECT_GAIN_PCT = scenario.collectGainPct;
  }

  if (scenario.drawdownClosePct !== null) {
    globals.SCENARIO_DRAWDOWN_CLOSE_PCT = scenario.drawdownClosePct;
  }

  if (scenario.autoTrimPct !== null) {
    globals.SCENARIO_AUTO_TRIM_PCT = scenario.autoTrimPct;
  }

  if (scenario.trailGivebackPct !== null) {
    globals.SCENARIO_TRAIL_GIVEBACK_PCT = scenario.trailGivebackPct;
  }

  if (scenario.maxBasketLossMoney !== null) {
    globals.SCENARIO_MAX_BASKET_LOSS_MONEY = scenario.maxBasketLossMoney;
  }

  const command = await queueMt4ControlCommand({
    message,
    mt4CommandService,
    command: 'SCENARIO_CONTROL',
    payload: {
      ...scenario,
      globals,
    },
  });

  return {
    content: [
      '🧠🛡️ **WISDO queued Guardian Scenario.**',
      '',
      `Command ID: \`${command.id}\``,
      `Situation code: **${scenario.situationCode}**`,
      `Direction: **${scenario.direction === 1 ? 'BUY' : scenario.direction === -1 ? 'SELL' : 'AUTO'}**`,
      scenario.mainEntryNow ? 'Main entry: **YES**' : 'Main entry: **NO / manage existing**',
      scenario.maxLadders !== null ? `Ladders allowed: **${scenario.maxLadders}**` : 'Ladders: **default**',
      scenario.collectGainPct !== null ? `Collect target: **${scenario.collectGainPct}%**` : 'Collect target: **default**',
      scenario.drawdownClosePct !== null ? `Drawdown close: **${scenario.drawdownClosePct}%**` : 'Drawdown close: **default**',
      scenario.pauseNewEntries ? 'New entries: **PAUSED / WALKAWAY**' : 'New entries: **SCENARIO CONTROLLED**',
      '',
      'MT4 Global Variable suffixes:',
      '```',
      ...Object.entries(globals).map(([key, value]) => `${key} = ${value}`),
      '```',
    ].join('\n'),
    speechText:
      `WISDO queued Guardian Scenario ${scenario.situationCode}. It will apply the ladder, collect, drawdown, and protection settings to MT4.`,
  };
}
  if (intent === 'mt4_reset_my_account') {
  const discordUserId = message.author.id;

  let resetResult = null;

  if (typeof mt4SyncService.resetUserAccount === 'function') {
    resetResult = await mt4SyncService.resetUserAccount(discordUserId);
  } else if (typeof mt4SyncService.disconnectUser === 'function') {
    resetResult = await mt4SyncService.disconnectUser(discordUserId);
  } else if (typeof mt4SyncService.clearUser === 'function') {
    resetResult = await mt4SyncService.clearUser(discordUserId);
  } else {
    return {
      content: [
        '⚠️ **WISDO understood: reset my MT4 account.**',
        '',
        `Your Discord ID: \`${discordUserId}\``,
        '',
        'But the MT4 sync service does not have a reset method yet.',
        '',
        'Add a method named `resetUserAccount(discordUserId)` inside `Mt4SyncService` so WISDO can safely clear only your linked MT4 account records.',
      ].join('\n'),
      speechText:
        'WISDO understood reset my MT4 account, but the MT4 sync service does not have a reset method yet.',
    };
  }

  return {
    content: [
      '🧹 **WISDO reset your MT4 account link.**',
      '',
      `Discord ID reset: \`${discordUserId}\``,
      '',
      'Safe scope:',
      '• Only your account records were cleared',
      '• Other deployed users were not touched',
      '• Your old MT4/demo connection should no longer be treated as active',
      '',
      'Next step:',
      '`Hey Coach, connect my MT4`',
      '',
      resetResult
        ? `Result: \`${JSON.stringify(resetResult).slice(0, 800)}\``
        : '',
    ].join('\n'),
    speechText:
      'WISDO reset your MT4 account link. Only your records were cleared. Other deployed users were not touched. Now connect your MT4 again.',
  };
}
  if (intent === 'mt4_connect') {
    return runSlashCommandFromVoice({
      message,
      registry,
      commandName: 'connect-mt4',
    });
  }

  if (intent === 'mt4_status') {
    return runSlashCommandFromVoice({
      message,
      registry,
      commandName: 'mt4-status',
    });
  }

  if (intent === 'wisdo_review') {
    const period = getPeriodFromVoice(ask);

    return runSlashCommandFromVoice({
      message,
      registry,
      commandName: 'wisdo-review',
      optionValues: {
        period,
      },
    });
  }

  if (intent === 'clock_in') {
    return runSlashCommandFromVoice({
      message,
      registry,
      commandName: 'clock-in',
    });
  }

  if (intent === 'clock_out') {
    return runSlashCommandFromVoice({
      message,
      registry,
      commandName: 'clock-out',
    });
  }

  if (intent === 'log_ea') {
    return runSlashCommandFromVoice({
      message,
      registry,
      commandName: 'log-ea',
    });
  }

  if (intent === 'profile') {
    const normalized = normalizeVoiceInput(ask);

    if (normalized.includes('edit')) {
      return runSlashCommandFromVoice({
        message,
        registry,
        commandName: 'edit-profile',
      });
    }

    if (
      normalized.includes('show') ||
      normalized.includes('view') ||
      normalized.includes('my profile')
    ) {
      return runSlashCommandFromVoice({
        message,
        registry,
        commandName: 'profile',
      });
    }

    return runSlashCommandFromVoice({
      message,
      registry,
      commandName: 'setup-profile',
    });
  }

  return {
    content: [
      '🧠 **WISDO heard you:**',
      `> ${ask}`,
      '',
      'I could not confidently decode that yet.',
      '',
      'Try saying it like:',
      '`Hey Wisdom, show me the bots.`',
      '`Hey Wisdom, what is Culture Coin?`',
      '`Hey Coach, how does my account look?`',
      '`Hey Coach, pause my MT4.`',
      '`Hey Coach, put my account in Guard Mode.`',
      '`Hey Coach, set max trades to 3.`',
      '`Hey Wisdom, set equity floor to 25 dollars.`',
      '',
      `Debug intent confidence: ${detected.confidence}`,
    ].join('\n'),
    speechText:
      'WISDO heard you, but I could not confidently decode that yet. Try saying, Hey Coach, how does my account look, or Hey Coach, pause my MT4.',
  };
}

async function shutdown(signal) {
  logger.info('Shutdown requested', { signal });

  await Promise.allSettled([
    new Promise((resolve) => {
      apiServer.close(() => resolve());
    }),
    client.destroy(),
  ]);

  process.exit(0);
}

process.on('SIGINT', () => {
  shutdown('SIGINT').catch(() => process.exit(1));
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch(() => process.exit(1));
});

try {
  const registration = await registerDiscordCommandsOnStart();
  logger.info('Discord slash commands registered before gateway login.', registration);
} catch (error) {
  logger.error('Discord slash-command pre-login registration failed.', {
    message: error.message,
    stack: error.stack,
    details: error.details,
  });
}

await client.login(config.discordToken);
