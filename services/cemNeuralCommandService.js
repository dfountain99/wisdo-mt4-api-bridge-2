import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { randomUUID } from 'node:crypto';
import { WisdoPresenceLearningService, WISDO_PRESENCE_MODES } from './wisdoPresenceLearningService.js';

const COLORS = Object.freeze({ gold: 0xD6B65A, cyan: 0x39D6D6, purple: 0x9B6DFF, red: 0xE05252, graphite: 0x11151C });
const PREFIX = 'cem_neural';

const NETWORK_LAYOUT = Object.freeze([
  { category: '◈ NEURAL GATEWAY', channels: [['welcome', 'The front door to CEM Culture.'], ['announcements', 'Official transmissions from CEM leadership.'], ['start-here', 'Identity, roles, rules, and first mission.']] },
  { category: '◈ TRADING FLOOR', channels: [['live-market', 'Live market conversation and session presence.'], ['trade-ideas', 'Educational trade ideas and structured reasoning.'], ['wins-and-lessons', 'Documented wins, losses, and lessons without hype.'], ['risk-management', 'Account protection and discipline.']], voice: ['live-trading-floor'] },
  { category: '◈ WISDO CORE', channels: [['wisdo-core', 'Speak naturally with WISDO and inspect operator context.'], ['market-intelligence', 'Market conditions, alerts, and system observations.']] },
  { category: '◈ CULTURE PULSE', channels: [['culture-pulse', 'Network activity, milestones, and collective discipline.'], ['member-wins', 'Recognized operator growth and accomplishments.']] },
  { category: '◈ ACADEMY', channels: [['courses', 'CEM Culture education and guided pathways.'], ['resources', 'Approved reference material.'], ['questions', 'Structured learning questions and Coach responses.'], ['course-proposals', 'Voice-built curricula awaiting Coach approval.'], ['student-wins', 'Approved learning milestones and transformations.']], voice: ['live-classroom', 'office-hours'] },
  { category: '◈ CREATOR STUDIO', channels: [['creator-studio', 'Turn approved conversations into courses, procedures, and campaigns.'], ['promotion-review', 'Review announcements, events, highlights, and campaign drafts before publishing.'], ['session-recaps', 'Consent-led recaps, decisions, assignments, and next steps.']], voice: ['wisdo-coaching-room', 'content-lab'] },
  { category: '◈ BOT CHAMBER', channels: [['cem-bot', 'Bot identities, capabilities, versions, and deployment guidance.'], ['bot-commands', 'Bot setup and control guidance.'], ['system-status', 'Reporter, bridge, and platform health.']] },
]);

const ROLE_BLUEPRINT = Object.freeze([
  ['Commander', COLORS.gold],
  ['Coach', COLORS.purple],
  ['Signal Architect', COLORS.cyan],
  ['Neural Operator', 0xE6E7EA],
  ['Observer', 0x6B7280],
]);

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '—';
}

function truncate(value, max = 100) {
  const text = String(value || '').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function sessionCountdown(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  const current = hour * 60 + minute;
  const open = 9 * 60 + 30;
  if (current >= open && current < 16 * 60) return 'NEW YORK SESSION ACTIVE';
  const remaining = current < open ? open - current : (24 * 60 - current) + open;
  return `NEW YORK OPENS IN ${Math.floor(remaining / 60)}H ${remaining % 60}M`;
}

function mainButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${PREFIX}:capsule`).setLabel('ENTER CAPSULE').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${PREFIX}:mission`).setLabel('BEGIN MISSION').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`${PREFIX}:wisdo`).setLabel('CONSULT WISDO').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${PREFIX}:pulse`).setLabel('CULTURE PULSE').setStyle(ButtonStyle.Secondary),
  );
}

function secondaryButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${PREFIX}:account`).setLabel('ACCOUNT CORE').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${PREFIX}:memory`).setLabel('MEMORY VAULT').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${PREFIX}:refresh`).setLabel('REFRESH LINK').setStyle(ButtonStyle.Success),
  );
}

function presenceButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${PREFIX}:presence`).setLabel('VOICE PRESENCE').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`${PREFIX}:course`).setLabel('BUILD A COURSE').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`${PREFIX}:screen`).setLabel('SCREEN GUIDE').setStyle(ButtonStyle.Secondary),
  );
}

function adminButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${PREFIX}:admin`).setLabel('NEURAL ADMIN').setEmoji('⚙️').setStyle(ButtonStyle.Danger),
  );
}

export class CemNeuralCommandService {
  constructor({ config, operatorDeskService, mt4SyncService, presenceLearningService, logger = console } = {}) {
    this.config = config || {};
    this.operatorDeskService = operatorDeskService;
    this.mt4SyncService = mt4SyncService;
    this.logger = logger;
    this.presenceLearningService = presenceLearningService || new WisdoPresenceLearningService({ repository: operatorDeskService?.repository, logger });
  }

  buildGatewayPayload(guild) {
    const online = guild?.members?.cache?.filter((member) => member.presence?.status && member.presence.status !== 'offline').size || 0;
    const members = guild?.memberCount || guild?.members?.cache?.size || 0;
    const embed = new EmbedBuilder()
      .setColor(COLORS.gold)
      .setAuthor({ name: 'CEM CULTURE  •  NEURAL COMMAND NETWORK' })
      .setTitle('WISDO CORE // OPERATIONAL')
      .setDescription([
        '**PEOPLE  •  DISCIPLINE  •  PROGRESS**',
        '',
        'Welcome to the command layer of CEM Culture. Connect your identity, activate your private Operator Capsule, begin a disciplined mission, or consult WISDO.',
        '',
        '> *Clarity compounds.*',
      ].join('\n'))
      .addFields(
        { name: '◈ NETWORK', value: '**ONLINE**\nAuthenticated systems ready', inline: true },
        { name: '◉ CULTURE', value: `**${members} MEMBERS**\n${online} currently online`, inline: true },
        { name: '◎ SESSION', value: `**${sessionCountdown()}**\nEastern market clock`, inline: true },
        { name: 'ENTER CAPSULE', value: 'Open your private desk, live account state, mission, and memory.', inline: true },
        { name: 'BEGIN MISSION', value: 'Declare today\'s objective, risk boundary, and operating focus.', inline: true },
        { name: 'CONSULT WISDO', value: 'Receive account-aware guidance without exposing private information.', inline: true },
      )
      .setFooter({ text: 'CEM CULTURE • TRADE • DEVELOP • BELONG' })
      .setTimestamp();
    return { embeds: [embed], components: [mainButtons(), presenceButtons()] };
  }

  buildHelpControls(isStaff = false) {
    return isStaff ? [mainButtons(), presenceButtons(), adminButtons()] : [mainButtons(), presenceButtons()];
  }

  async operatorState(userId) {
    const [profile, desk, latest, logs] = await Promise.all([
      this.operatorDeskService?.repository?.getProfile?.(userId).catch(() => null) || null,
      this.operatorDeskService?.repository?.getDesk?.(userId).catch(() => null) || null,
      this.mt4SyncService?.getLatestSnapshot?.(userId).catch(() => null) || null,
      this.operatorDeskService?.repository?.getAllLogs?.().catch(() => []) || [],
    ]);
    const ownLogs = (logs || []).filter((row) => String(row.discordUserId) === String(userId));
    const today = new Date().toISOString().slice(0, 10);
    const todayLogs = ownLogs.filter((row) => row.date === today);
    const clockIn = todayLogs.find((row) => row.logType === 'clock-in') || null;
    const clockOut = todayLogs.find((row) => row.logType === 'clock-out') || null;
    const mission = ownLogs.find((row) => row.logType === 'neural-mission' && row.date === today) || null;
    return { profile, desk, latest, ownLogs, todayLogs, clockIn, clockOut, mission };
  }

  async buildOperatorPayload(interaction) {
    const state = await this.operatorState(interaction.user.id);
    const snapshot = state.latest?.snapshot || null;
    const freshness = state.latest ? this.mt4SyncService?.getFreshnessInfo?.(state.latest) : null;
    const linkState = snapshot ? (freshness?.isFresh === false ? 'STALE' : 'ONLINE') : 'AWAITING CONNECTION';
    const botName = snapshot?.eaName || state.profile?.botEaUsed || 'NO BOT DETECTED';
    const discipline = this.disciplineScore(state);
    const capsuleState = state.clockIn && !state.clockOut ? 'ACTIVE' : 'STANDBY';
    const deskLink = state.desk?.channelId ? `<#${state.desk.channelId}>` : 'Run `/create-desk` with a Coach';
    const embed = new EmbedBuilder()
      .setColor(linkState === 'ONLINE' ? COLORS.cyan : COLORS.gold)
      .setAuthor({ name: 'CEM NEURAL NETWORK • PRIVATE OPERATOR LINK' })
      .setTitle(`WELCOME BACK, OPERATOR ${truncate(interaction.user.globalName || interaction.user.username, 40).toUpperCase()}`)
      .setDescription(`**CAPSULE ${capsuleState}**\nYour financial data is visible only to you inside this response and your authorized private desk.`)
      .addFields(
        { name: 'MT4 LINK', value: `**${linkState}**\n${snapshot ? `Account ••••${String(snapshot.accountNumber || '').slice(-4)}` : 'Use `/connect-mt4`'}`, inline: true },
        { name: 'BOT CONSCIOUSNESS', value: `**${truncate(botName, 40).toUpperCase()}**\n${snapshot?.openTradeCount || 0} open positions`, inline: true },
        { name: 'DISCIPLINE INTEGRITY', value: `**${discipline}%**\n${state.clockIn ? 'Clock-in detected' : 'Clock-in required'}`, inline: true },
        { name: 'BALANCE', value: `**${money(snapshot?.balance)}**`, inline: true },
        { name: 'EQUITY', value: `**${money(snapshot?.equity)}**`, inline: true },
        { name: 'FLOATING P/L', value: `**${money(snapshot?.floatingPL)}**`, inline: true },
        { name: 'ACTIVE MISSION', value: state.mission ? `**${truncate(state.mission.focus, 120)}**\nTarget: ${truncate(state.mission.target, 80) || 'Not specified'}\nBoundary: ${truncate(state.mission.riskBoundary, 80) || 'Not specified'}` : 'No mission initialized today. Select **BEGIN MISSION**.', inline: false },
        { name: 'OPERATOR CAPSULE', value: deskLink, inline: true },
        { name: 'NEURAL ECHOES', value: `**${state.ownLogs.length}** stored memories`, inline: true },
        { name: 'SESSION CLOCK', value: `**${sessionCountdown()}**`, inline: true },
      )
      .setFooter({ text: 'PRIVATE RESPONSE • CEM CULTURE • CLARITY COMPOUNDS' })
      .setTimestamp();
    return { embeds: [embed], components: [mainButtons(), secondaryButtons()], ephemeral: true };
  }

  disciplineScore(state) {
    let score = 45;
    if (state.profile) score += 10;
    if (state.clockIn) score += 20;
    if (state.mission) score += 15;
    if (state.clockOut) score += 10;
    return Math.min(100, score);
  }

  missionModal() {
    return new ModalBuilder()
      .setCustomId(`${PREFIX}:mission_submit`)
      .setTitle('INITIALIZE OPERATOR MISSION')
      .addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('focus').setLabel('PRIMARY FOCUS').setPlaceholder('What must you execute with discipline today?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('target').setLabel('MISSION TARGET').setPlaceholder('Compound target, study target, or session objective').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('risk_boundary').setLabel('RISK BOUNDARY').setPlaceholder('Maximum loss, exposure, or behavior boundary').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('confirmation').setLabel('CONFIRMATION STANDARD').setPlaceholder('What must be true before you act?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)),
      );
  }

  courseModal() {
    return new ModalBuilder().setCustomId(`${PREFIX}:course_submit`).setTitle('VOICE-TO-COURSE FORGE').addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('COURSE TITLE OR TOPIC').setPlaceholder('Risk Mastery for Beginners').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('outcome').setLabel('WHAT WILL THE STUDENT BE ABLE TO DO?').setPlaceholder('Control risk and calculate position size').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('audience').setLabel('WHO IS THIS FOR?').setPlaceholder('New CEM Culture operators').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(160)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('source').setLabel('SOURCE OR SESSION CONTEXT').setPlaceholder('Tonight\'s coaching conversation, uploaded notes, or original instruction').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)),
    );
  }

  async saveCourseDraft(interaction) {
    const draft = this.presenceLearningService.createCourseDraft({
      ownerId: interaction.user.id, guildId: interaction.guildId,
      title: interaction.fields.getTextInputValue('title'), outcome: interaction.fields.getTextInputValue('outcome'),
      audience: interaction.fields.getTextInputValue('audience'), source: interaction.fields.getTextInputValue('source'),
    });
    await this.presenceLearningService.persist({ id: draft.courseId, discordUserId: interaction.user.id, username: interaction.user.username, channelId: interaction.channelId, date: draft.createdAt.slice(0, 10), timestamp: draft.createdAt, logType: 'course-draft', courseId: draft.courseId, title: draft.title, outcome: draft.outcome, audience: draft.audience, source: draft.source });
    const lines = draft.modules.map((module) => `**${module.number}. ${module.title}** — ${module.objective}`).join('\n');
    const staff = this.operatorDeskService?.isStaff?.(interaction.member);
    const components = staff ? [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${PREFIX}:publish_course:${draft.courseId}`).setLabel('CREATE COURSE CHANNELS').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`${PREFIX}:cancel`).setLabel('KEEP AS DRAFT').setStyle(ButtonStyle.Secondary),
    )] : [];
    await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setColor(COLORS.purple).setTitle(`COURSE FORGE // ${draft.title.toUpperCase()}`).setDescription(lines).addFields(
      { name: 'OUTCOME', value: draft.outcome }, { name: 'AUDIENCE', value: draft.audience, inline: true },
      { name: 'PLACEMENT PLAN', value: `${draft.channels.length} text channels • ${draft.voiceChannels.length} voice rooms`, inline: true },
      { name: 'PROMOTION', value: `Approval required • ${draft.promotion.sequence.length} planned transmissions` },
      { name: 'STATUS', value: staff ? '**Ready for staff publication.**' : '**Draft saved. A Coach/Admin must approve channel creation and promotion.**' },
    ).setFooter({ text: `Course ID • ${draft.courseId}` }).setTimestamp()], components });
  }

  async publishCourse(interaction, courseId) {
    if (!this.operatorDeskService?.isStaff?.(interaction.member)) throw new Error('Coach/Admin authority required to publish a course.');
    const draft = this.presenceLearningService.drafts.get(courseId);
    if (!draft) throw new Error('This course draft expired from active memory. Rebuild it from the Course Forge.');
    const me = interaction.guild.members.me || await interaction.guild.members.fetchMe();
    if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) throw new Error('WISDO needs Manage Channels to publish the course.');
    await interaction.guild.channels.fetch();
    const categoryName = `ACADEMY • ${draft.title}`.slice(0, 100);
    let category = interaction.guild.channels.cache.find((channel) => channel.type === ChannelType.GuildCategory && channel.name === categoryName);
    if (!category) category = await interaction.guild.channels.create({ name: categoryName, type: ChannelType.GuildCategory, reason: `WISDO course ${draft.courseId}` });
    const created = [];
    for (const [name, topic] of draft.channels) {
      let channel = interaction.guild.channels.cache.find((item) => item.parentId === category.id && item.name === name);
      if (!channel) { channel = await interaction.guild.channels.create({ name, topic, parent: category.id, type: ChannelType.GuildText, reason: `WISDO course ${draft.courseId}` }); created.push(channel.id); }
      if (name === 'curriculum') await channel.send({ embeds: [new EmbedBuilder().setColor(COLORS.gold).setTitle(draft.title).setDescription(draft.modules.map((module) => `**${module.number}. ${module.title}**\n${module.objective}`).join('\n\n')).addFields({ name: 'COURSE OUTCOME', value: draft.outcome }, { name: 'SOURCE', value: draft.source }).setFooter({ text: 'WISDO Course Forge • Sources retained • Instructor review required' })] }).catch(() => null);
    }
    for (const name of draft.voiceChannels) {
      if (!interaction.guild.channels.cache.some((item) => item.parentId === category.id && item.name === name)) { const channel = await interaction.guild.channels.create({ name, parent: category.id, type: ChannelType.GuildVoice, reason: `WISDO course ${draft.courseId}` }); created.push(channel.id); }
    }
    draft.status = 'published'; draft.categoryId = category.id; draft.publishedAt = new Date().toISOString();
    await interaction.update({ content: `Course published in <#${category.id}>. Created **${created.length}** channels. Promotion remains a draft until separately approved.`, embeds: [], components: [] });
  }

  async saveMission(interaction) {
    const now = new Date();
    const record = {
      id: randomUUID(), discordUserId: interaction.user.id, username: interaction.user.username,
      channelId: interaction.channelId, date: now.toISOString().slice(0, 10), timestamp: now.toISOString(),
      logType: 'neural-mission', focus: interaction.fields.getTextInputValue('focus').trim(),
      target: interaction.fields.getTextInputValue('target').trim(), riskBoundary: interaction.fields.getTextInputValue('risk_boundary').trim(),
      confirmationStandard: interaction.fields.getTextInputValue('confirmation').trim(), source: 'cem-neural-command-deck',
    };
    await this.operatorDeskService?.repository?.addLog?.(record);
    const embed = new EmbedBuilder().setColor(COLORS.gold).setTitle('MISSION INITIALIZED').setDescription(`**${record.focus}**`).addFields(
      { name: 'TARGET', value: record.target, inline: true }, { name: 'RISK BOUNDARY', value: record.riskBoundary, inline: true },
      { name: 'CONFIRMATION STANDARD', value: record.confirmationStandard },
    ).setFooter({ text: 'WISDO will preserve this mission as a Neural Echo.' }).setTimestamp();
    await interaction.reply({ embeds: [embed], components: [secondaryButtons()], ephemeral: true });
  }

  async culturePulse(interaction) {
    const guild = interaction.guild;
    const members = guild?.memberCount || guild?.members?.cache?.size || 0;
    const desks = this.operatorDeskService?.getDeskTextChannels?.(guild) || [];
    const logs = await this.operatorDeskService?.repository?.getAllLogs?.().catch(() => []) || [];
    const today = new Date().toISOString().slice(0, 10);
    const todayLogs = logs.filter((row) => row.date === today);
    const active = new Set(todayLogs.filter((row) => row.logType === 'clock-in').map((row) => row.discordUserId));
    for (const row of todayLogs.filter((item) => item.logType === 'clock-out')) active.delete(row.discordUserId);
    const embed = new EmbedBuilder().setColor(COLORS.purple).setTitle('CULTURE PULSE // LIVE NETWORK').setDescription('Collective operating signals without exposing private financial data.').addFields(
      { name: 'NETWORK POPULATION', value: `**${members}** members`, inline: true },
      { name: 'OPERATOR CAPSULES', value: `**${desks.length}** provisioned`, inline: true },
      { name: 'ACTIVE OPERATORS', value: `**${active.size}** clocked in`, inline: true },
      { name: 'TODAY\'S NEURAL ECHOES', value: `**${todayLogs.length}** recorded events`, inline: true },
      { name: 'NETWORK CONDITION', value: active.size ? '**OBSERVATION / ACTIVE**' : '**CALM / STANDBY**', inline: true },
      { name: 'CULTURE PRINCIPLE', value: '**PROCESS OVER EMOTION**', inline: true },
    ).setFooter({ text: 'People • Discipline • Progress' }).setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  async handleInteraction(interaction) {
    if (!String(interaction.customId || '').startsWith(`${PREFIX}:`)) return false;
    const action = interaction.customId.split(':')[1];
    if (action === 'mission') { await interaction.showModal(this.missionModal()); return true; }
    if (action === 'mission_submit') { await this.saveMission(interaction); return true; }
    if (action === 'course') { await interaction.showModal(this.courseModal()); return true; }
    if (action === 'course_submit') { await this.saveCourseDraft(interaction); return true; }
    if (action === 'publish_course') { await this.publishCourse(interaction, interaction.customId.split(':')[2]); return true; }
    if (action === 'presence') {
      const modes = Object.values(WISDO_PRESENCE_MODES).map((mode) => `**${mode.label}** — ${mode.outputs.join(', ')}`).join('\n');
      await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setColor(COLORS.cyan).setTitle('WISDO IN THE ROOM // PRESENCE MODES').setDescription(modes).addFields(
        { name: 'VOICE SESSION FLOW', value: 'Choose mode → announce listening state → collect consent → coach or observe → create approved recap and next actions.' },
        { name: 'TRADING AUTHORITY', value: 'Explanation and simulation are immediate. Financial actions remain scoped, confirmed, and verified by an execution receipt.' },
      ).setFooter({ text: 'Recording is OFF by default • Stop listening is always available' })] }); return true;
    }
    if (action === 'screen') {
      const contract = this.presenceLearningService.screenCompanionContract({ ownerId: interaction.user.id });
      await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setColor(COLORS.cyan).setTitle('SCREEN GUIDE // EXPLICIT SHARE REQUIRED').setDescription('Discord does not hand a normal bot the pixels from another member\'s stream. WISDO prepares a companion session for a user-selected window or deliberate screenshots.').addFields(
        { name: 'AVAILABLE OUTPUTS', value: 'Step-by-step coaching • procedure capture • course chapters • approved screenshots • automation proposal' },
        { name: 'PRIVACY CONTROLS', value: contract.controls.join(' • ') },
        { name: 'STATE', value: `**${contract.state.toUpperCase()}**\nNo background capture. No credential storage.` },
      )] }); return true;
    }
    if (action === 'pulse') { await this.culturePulse(interaction); return true; }
    if (action === 'admin') {
      if (!this.operatorDeskService?.isStaff?.(interaction.member)) {
        await interaction.reply({ content: 'Neural administration is limited to Coach/Admin.', ephemeral: true });
        return true;
      }
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${PREFIX}:install_confirm`).setLabel('INSTALL FULL NETWORK').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`${PREFIX}:deploy_here`).setLabel('DEPLOY PANEL HERE').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`${PREFIX}:cancel`).setLabel('CANCEL').setStyle(ButtonStyle.Secondary),
      );
      await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setColor(COLORS.red).setTitle('NEURAL ADMIN // CONFIRM AUTHORITY').setDescription('**INSTALL FULL NETWORK** creates the CEM categories, channels, optional rank roles, and a pinned Gateway.\n\n**DEPLOY PANEL HERE** only posts and pins the Gateway in the current channel.')], components: [row] });
      return true;
    }
    if (action === 'cancel') { await interaction.update({ content: 'Neural administration closed. Nothing was changed.', embeds: [], components: [] }); return true; }
    if (action === 'install_confirm') {
      if (!this.operatorDeskService?.isStaff?.(interaction.member)) { await interaction.reply({ content: 'Coach/Admin authority required.', ephemeral: true }); return true; }
      await interaction.deferUpdate();
      const result = await this.installNetwork(interaction.guild, { createRoles: true });
      await interaction.editReply({ content: `CEM Neural Network installed. Gateway: <#${result.gatewayChannelId}>\nCreated ${result.categories.length} categories, ${result.channels.length} channels, and ${result.roles.length} roles.`, embeds: [], components: [] });
      return true;
    }
    if (action === 'deploy_here') {
      if (!this.operatorDeskService?.isStaff?.(interaction.member)) { await interaction.reply({ content: 'Coach/Admin authority required.', ephemeral: true }); return true; }
      const message = await interaction.channel.send(this.buildGatewayPayload(interaction.guild));
      await message.pin().catch(() => null);
      await interaction.update({ content: `Neural Gateway deployed: ${message.url}`, embeds: [], components: [] });
      return true;
    }
    if (action === 'wisdo') {
      await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setColor(COLORS.gold).setTitle('WISDO CORE // LINK ESTABLISHED').setDescription('Speak naturally in **#wisdo-core** or address me with `Hey Coach` followed by your question.\n\nTry: **“Hey Coach, examine my account and today\'s mission.”**')] });
      return true;
    }
    if (action === 'memory') {
      const state = await this.operatorState(interaction.user.id);
      const recent = state.ownLogs.slice().sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)).slice(0, 8);
      const description = recent.length ? recent.map((row) => `◈ <t:${Math.floor(new Date(row.timestamp || Date.now()).getTime() / 1000)}:R> • **${String(row.logType || 'event').toUpperCase()}**`).join('\n') : 'No Neural Echoes recorded yet.';
      await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setColor(COLORS.purple).setTitle('MEMORY VAULT // RECENT NEURAL ECHOES').setDescription(description)] });
      return true;
    }
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await this.buildOperatorPayload(interaction));
    return true;
  }

  async installNetwork(guild, { createRoles = true } = {}) {
    const me = guild.members.me || await guild.members.fetchMe();
    if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) throw new Error('WISDO requires Manage Channels to install the Neural Network.');
    await guild.channels.fetch();
    const created = { categories: [], channels: [], roles: [] };
    let gateway = null;
    for (const section of NETWORK_LAYOUT) {
      let category = guild.channels.cache.find((channel) => channel.type === ChannelType.GuildCategory && channel.name === section.category);
      if (!category) { category = await guild.channels.create({ name: section.category, type: ChannelType.GuildCategory }); created.categories.push(category.id); }
      for (const [name, topic] of section.channels) {
        let channel = guild.channels.cache.find((item) => item.parentId === category.id && item.name === name);
        if (!channel) { channel = await guild.channels.create({ name, type: ChannelType.GuildText, parent: category.id, topic }); created.channels.push(channel.id); }
        if (name === 'welcome') gateway = channel;
      }
      for (const name of section.voice || []) {
        let channel = guild.channels.cache.find((item) => item.parentId === category.id && item.name === name);
        if (!channel) { channel = await guild.channels.create({ name, type: ChannelType.GuildVoice, parent: category.id }); created.channels.push(channel.id); }
      }
    }
    if (createRoles && me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      for (const [name, color] of ROLE_BLUEPRINT) {
        if (!guild.roles.cache.some((role) => role.name === name)) { const role = await guild.roles.create({ name, color, mentionable: false, hoist: true, reason: 'CEM Neural Network installation' }); created.roles.push(role.id); }
      }
    }
    if (!gateway?.isTextBased()) throw new Error('Neural Gateway channel could not be resolved.');
    const panel = await gateway.send(this.buildGatewayPayload(guild));
    await panel.pin().catch(() => null);
    return { ...created, gatewayChannelId: gateway.id, panelMessageId: panel.id };
  }
}

export { COLORS as CEM_NEURAL_COLORS, NETWORK_LAYOUT as CEM_NEURAL_LAYOUT };
