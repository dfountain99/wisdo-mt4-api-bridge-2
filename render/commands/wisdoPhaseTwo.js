import { SlashCommandBuilder } from 'discord.js';
import { WisdoGlobalsService } from '../services/wisdoGlobalsService.js';
import { CommandSafetyService } from '../services/commandSafetyService.js';
import { AccountHealthService } from '../services/accountHealthService.js';
import { BotAllocationService } from '../services/botAllocationService.js';
import { HistoryProofService } from '../services/historyProofService.js';
import { LearningManualService } from '../services/learningManualService.js';
import { PlatformBusinessService } from '../services/platformBusinessService.js';

function moduleResult(commands = []) { return { commands, modalHandlers: new Map() }; }
function money(v){const n=Number(v||0);return `$${n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
async function reply(interaction, content){ if(interaction.deferred||interaction.replied) return interaction.editReply({content}); return interaction.reply({content, ephemeral:true}); }
async function defer(interaction){ if(!interaction.deferred&&!interaction.replied) await interaction.deferReply({ephemeral:true}).catch(()=>null); }
async function getActiveAccount(ctx, userId){
  if(ctx.wisdoMemoryService?.resolveActiveAccount){ const a=await ctx.wisdoMemoryService.resolveActiveAccount(userId); if(a) return a; }
  if(ctx.mt4SyncService?.repository?.getPrimaryMt4Connection) return ctx.mt4SyncService.repository.getPrimaryMt4Connection(userId);
  return null;
}
async function queueWithSafety({ctx, interaction, command, payload, account, label}){
  const safety=new CommandSafetyService(ctx.config);
  const userId=interaction.user.id;
  if(safety.requiresConfirmation(command, payload)){
    const pending=await safety.createConfirmation({userId,accountId:account?.accountId||payload?.accountId||null,accountLabel:label||account?.nickname||account?.accountNumber||'',command,payload,reason:'Red-level WISDO command requires user confirmation.'});
    return reply(interaction,[`⚠️ **Confirmation required.**`,`Command: **${command}**`,`Account: **${pending.accountLabel||pending.accountId||'active'}**`,`Reply with:`, `\`${pending.phrase}\``, `or run \`/confirm phrase:${pending.phrase}\``, `Expires: <t:${Math.floor(new Date(pending.expiresAt).getTime()/1000)}:R>`].join('\n'));
  }
  const rec=ctx.mt4CommandService.queueCommandForAccount&&account?.accountId
    ? await ctx.mt4CommandService.queueCommandForAccount(userId,account.accountId,command,{...payload,accountId:account.accountId,accountNumber:account.accountNumber,pairingCode:account.pairingCode})
    : await ctx.mt4CommandService.queueCommand(userId,command,payload);
  await ctx.wisdoMemoryService?.rememberCommand?.({discordUserId:userId,accountId:account?.accountId||payload?.accountId||null,command,payload,status:'queued',commandId:rec.id});
  return reply(interaction,`✅ **${command} queued.**\nCommand ID: \`${rec.id}\``);
}

export function buildWisdoPhaseTwoCommands(ctx) {
  const globalsService=new WisdoGlobalsService();
  const commands=[];

  commands.push({
    data:new SlashCommandBuilder().setName('global-status').setDescription('Show the WISDO global variable doctrine dictionary.'),
    async execute(interaction){ await defer(interaction); const rows=globalsService.list().slice(0,25).map(x=>`• **${x.key}** — ${x.description}`); await reply(interaction,[`🧬 **WISDO Global Variable Doctrine**`,`Every EA/reporter should understand this common language.`, '', ...rows, '', `Total globals: ${globalsService.list().length}`].join('\n')); }
  });

  commands.push({
    data:new SlashCommandBuilder().setName('health').setDescription('Show WISDO account health for your active MT4 account.'),
    async execute(interaction){ await defer(interaction); const svc=new AccountHealthService({mt4SyncService:ctx.mt4SyncService,wisdoMemoryService:ctx.wisdoMemoryService}); const result=await svc.summarizeUser(interaction.user.id); if(!result.ok) return reply(interaction,`⚠️ ${result.message}`); const a=result.account,h=result.health; await reply(interaction,[`${h.color} **Account Health: ${h.score}/100 — ${h.state.toUpperCase()}**`,`Account: **${a.nickname||a.accountNumber||'Active'}**`,`Balance: **${money(h.balance)}** | Equity: **${money(h.equity)}** | Floating: **${money(h.floating)}**`,`Open trades: **${h.openTrades}** | Drawdown: **${h.drawdownPercent.toFixed(2)}%**`,`Bot: **${a.eaName||'unknown'} ${a.eaVersion||''}**`.trim(),'',`**Coach Read:** ${h.coachRead}`,'','Why:',...h.reasons.map(r=>`• ${r}`)].join('\n')); }
  });

  commands.push({
    data:new SlashCommandBuilder().setName('confirm').setDescription('Confirm a red-level WISDO command.').addStringOption(o=>o.setName('phrase').setDescription('Example: CONFIRM CLOSE LIVE').setRequired(true)),
    async execute(interaction){ await defer(interaction); const safety=new CommandSafetyService(ctx.config); const confirmed=await safety.confirm({userId:interaction.user.id,phraseOrId:interaction.options.getString('phrase')}); if(!confirmed) return reply(interaction,'⚠️ No matching pending confirmation found, or it expired. No action was taken.'); const account=confirmed.accountId? await getActiveAccount(ctx,interaction.user.id):null; const rec=ctx.mt4CommandService.queueCommandForAccount&&confirmed.accountId ? await ctx.mt4CommandService.queueCommandForAccount(interaction.user.id,confirmed.accountId,confirmed.command,confirmed.payload||{}) : await ctx.mt4CommandService.queueCommand(interaction.user.id,confirmed.command,confirmed.payload||{}); await reply(interaction,`✅ Confirmed and queued **${confirmed.command}**.\nCommand ID: \`${rec.id}\``); }
  });

  commands.push({
    data:new SlashCommandBuilder().setName('protect-profit').setDescription('Queue WISDO protect-profit globals on your active account.'),
    async execute(interaction){ await defer(interaction); const account=await getActiveAccount(ctx,interaction.user.id); const built=globalsService.fromIntent('protect_profit'); return queueWithSafety({ctx,interaction,account,command:built.command,payload:built.payload,label:'active account'}); }
  });

  commands.push({
    data:new SlashCommandBuilder().setName('close-all-safe').setDescription('Stage a close-all request that requires confirmation.'),
    async execute(interaction){ await defer(interaction); const account=await getActiveAccount(ctx,interaction.user.id); const built=globalsService.fromIntent('close_all'); return queueWithSafety({ctx,interaction,account,command:built.command,payload:built.payload,label:account?.nickname||account?.accountNumber||'active'}); }
  });

  commands.push({
    data:new SlashCommandBuilder().setName('signal-settings').setDescription('Show message-signal settings. Dashboard stays untouched.'),
    async execute(interaction){ await defer(interaction); await reply(interaction,[`📣 **Message Signal Settings**`,`Dashboard layout: **unchanged**`,`Signal channel configured: **${process.env.SIGNAL_CHANNEL_ID||process.env.TRADE_SIGNAL_CHANNEL_ID?'yes':'no'}**`,`Button TTL: **${Number(process.env.SIGNAL_BUTTON_TTL_SECONDS||60)} sec**`,`Signal V2 buttons: **Take Same Trade / Copy Future Trades / Close My Copy / Ask WISDO / Mute Updates**`,`Update rule: only meaningful message-card updates, not every tick.`].join('\n')); }
  });

  commands.push({
    data:new SlashCommandBuilder().setName('mute-signal-updates').setDescription('Mute future noisy updates for message signals on this account.'),
    async execute(interaction){ await defer(interaction); const account=await getActiveAccount(ctx,interaction.user.id); const built=globalsService.fromIntent('copy_mode',{mode:'muted'}); return queueWithSafety({ctx,interaction,account,command:'SET_SIGNAL_PREFERENCES',payload:{muteSignalUpdates:true,...built.payload},label:account?.nickname||'active'}); }
  });

  commands.push({
    data:new SlashCommandBuilder().setName('copy-settings').setDescription('Set Copy Trading V2 guardrails.').addIntegerOption(o=>o.setName('max_trades').setDescription('Max copied trades').setRequired(false)).addNumberOption(o=>o.setName('fixed_lot').setDescription('Fixed copy lot').setRequired(false)).addStringOption(o=>o.setName('symbols').setDescription('Comma list, example XAUUSD,EURUSD').setRequired(false)),
    async execute(interaction){ await defer(interaction); const account=await getActiveAccount(ctx,interaction.user.id); const settings={maxCopiedTrades:interaction.options.getInteger('max_trades')||10,fixedLot:interaction.options.getNumber('fixed_lot')||0.01,symbolFilter:String(interaction.options.getString('symbols')||'XAUUSD').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean),copyStops:true,copyTakeProfits:true,copyPartialCloses:true,copyLeaderClose:true}; const built=globalsService.fromIntent('copy_mode',{mode:'smart'}); return queueWithSafety({ctx,interaction,account,command:'SET_COPY_SETTINGS',payload:{...settings,...built.payload},label:account?.nickname||'active'}); }
  });

  commands.push({
    data:new SlashCommandBuilder().setName('bot-assign').setDescription('Assign a daily ecosystem bot to an account/symbol.').addStringOption(o=>o.setName('bot').setDescription('DEADSHOT, DFSAUCE FINAL AI, DF HANDSFREE').setRequired(true).addChoices({name:'DEADSHOT',value:'DEADSHOT'},{name:'DFSAUCE FINAL AI',value:'DFSAUCE FINAL AI'},{name:'DF HANDSFREE',value:'DF HANDSFREE'})).addStringOption(o=>o.setName('symbol').setDescription('Symbol/group').setRequired(false)).addStringOption(o=>o.setName('mode').setDescription('both, buy-only, sell-only').setRequired(false)).addStringOption(o=>o.setName('risk').setDescription('safe, medium, aggressive').setRequired(false)),
    async execute(interaction){ await defer(interaction); const account=await getActiveAccount(ctx,interaction.user.id); const svc=new BotAllocationService(ctx.config); const alloc=await svc.assign({userId:interaction.user.id,accountId:account?.accountId||null,bot:interaction.options.getString('bot'),symbol:interaction.options.getString('symbol')||'XAUUSD',mode:interaction.options.getString('mode')||'both',risk:interaction.options.getString('risk')||'medium'}); await reply(interaction,[`🤖 **Bot assignment saved.**`,`Bot: **${alloc.bot}**`,`Symbol: **${alloc.symbol}**`,`Mode: **${alloc.mode}**`,`Risk: **${alloc.risk}**`,`Account: **${account?.nickname||account?.accountNumber||'default'}**`].join('\n')); }
  });

  commands.push({
    data:new SlashCommandBuilder().setName('bot-health').setDescription('Show bot allocation status for your WISDO account.'),
    async execute(interaction){ await defer(interaction); const svc=new BotAllocationService(ctx.config); const rows=await svc.status(interaction.user.id); if(!rows.length) return reply(interaction,'No bot allocation saved yet. Use `/bot-assign`.'); await reply(interaction,['🤖 **Bot Allocation Health**',...rows.map(a=>`• ${a.bot} on ${a.symbol} — ${a.mode}/${a.risk}`)].join('\n')); }
  });

  commands.push({
    data:new SlashCommandBuilder().setName('history-proof').setDescription('Build a proof/report card from stored history snapshots.'),
    async execute(interaction){ await defer(interaction); const account=await getActiveAccount(ctx,interaction.user.id); const svc=new HistoryProofService(ctx.config); const rep=await svc.buildReport({userId:interaction.user.id,accountId:account?.accountId||null,period:'today'}); await reply(interaction,`📈 **History + Proof Engine**\n\n${rep.card}`); }
  });

  commands.push({
    data:new SlashCommandBuilder().setName('manual-log').setDescription('Log an optimization/backtest result into the learning manual.').addStringOption(o=>o.setName('bot').setDescription('Bot tested').setRequired(true)).addStringOption(o=>o.setName('symbol').setDescription('Symbol tested').setRequired(true)).addNumberOption(o=>o.setName('starting').setDescription('Starting balance').setRequired(true)).addNumberOption(o=>o.setName('ending').setDescription('Ending balance').setRequired(true)).addNumberOption(o=>o.setName('drawdown').setDescription('Max drawdown percent').setRequired(true)).addStringOption(o=>o.setName('notes').setDescription('What did you see happen?').setRequired(false)),
    async execute(interaction){ await defer(interaction); const svc=new LearningManualService(ctx.config); const test=await svc.logTest({userId:interaction.user.id,bot:interaction.options.getString('bot'),symbol:interaction.options.getString('symbol'),startingBalance:interaction.options.getNumber('starting'),endingBalance:interaction.options.getNumber('ending'),drawdown:interaction.options.getNumber('drawdown'),notes:interaction.options.getString('notes')||''}); await reply(interaction,[`🧪 **Manual result logged.**`,`Gain: **${money(test.gain)}**`,`Recommendations:`,...test.recommendations.map(r=>`• ${r}`)].join('\n')); }
  });

  commands.push({
    data:new SlashCommandBuilder().setName('marketplace-status').setDescription('Show marketplace/payment/commission foundation status.'),
    async execute(interaction){ await defer(interaction); const svc=new PlatformBusinessService(ctx.config); const market=await svc.marketplace(); await reply(interaction,['🛒 **Live Marketplace Engine**',...market.products.map(p=>`• ${p.name} — ${money(p.priceUsd)} (${p.type})`),'','Live pricing is loaded from the marketplace file. Orders stay pending until Square or admin payment confirmation activates access.'].join('\n')); }
  });

  commands.push({
    data:new SlashCommandBuilder().setName('academy').setDescription('Show WISDO Academy modules and current rank.'),
    async execute(interaction){ await defer(interaction); const svc=new PlatformBusinessService(ctx.config); const a=await svc.academy(interaction.user.id); await reply(interaction,[`🎓 **WISDO Academy Rank: ${a.rank}**`,...a.modules.map(m=>`${m.done?'✅':'⬜'} ${m.title}`)].join('\n')); }
  });

  commands.push({
    data:new SlashCommandBuilder().setName('alerts').setDescription('Show latest WISDO alerts for your account.'),
    async execute(interaction){ await defer(interaction); const svc=new PlatformBusinessService(ctx.config); const rows=await svc.alerts(interaction.user.id); await reply(interaction,rows.length?['🚨 **Latest Alerts**',...rows.slice(0,10).map(a=>`• ${a.level||'info'} — ${a.message||a.type||'Alert'} (<t:${Math.floor(new Date(a.createdAt).getTime()/1000)}:R>)`)].join('\n'):'No alerts yet.'); }
  });

  return moduleResult(commands);
}
