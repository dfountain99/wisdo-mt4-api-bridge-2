import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

function money(value) {
  const n = Number(value || 0);
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function price(value) { return value === null || value === undefined ? 'market' : String(value); }

export class SignalCardService {
  buildSignalEmbed(signal, { copiedBy = 0, muted = false } = {}) {
    const status = String(signal.status || 'active').toUpperCase();
    return new EmbedBuilder()
      .setTitle(`⚡ Culture Signal Card · ${signal.side} ${signal.symbol}`)
      .setDescription([
        `**Status:** ${status}${muted ? ' · muted' : ''}`,
        `**Culture Lead:** ${signal.leaderAccountNumber || 'Unknown'}${signal.leaderServer ? ` · ${signal.leaderServer}` : ''}`,
        `**Bot:** ${signal.eaName || 'EA'}${signal.eaVersion ? ` ${signal.eaVersion}` : ''}`,
        '',
        `**Entry:** ${price(signal.openPrice)}`,
        `**SL:** ${price(signal.stopLoss)}  |  **TP:** ${price(signal.takeProfit)}`,
        `**Signal lot:** ${Number(signal.lots || 0.01).toFixed(2)}`,
        `**Leader equity:** ${signal.equity !== null && signal.equity !== undefined ? money(signal.equity) : 'Unknown'}`,
        `**Daily P/L:** ${signal.dailyClosedPL !== null && signal.dailyClosedPL !== undefined ? money(signal.dailyClosedPL) : 'Unknown'}`,
        `**Mirrored by:** ${copiedBy}`,
        '',
        `Expires <t:${Math.floor(new Date(signal.expiresAt).getTime() / 1000)}:R>`,
      ].join('\n'))
      .setColor(signal.side === 'BUY' ? 0x46d17b : 0xff6767)
      .setFooter({ text: 'CEM Culture Signal · Use Culture Risk for TraderConnect-style copier control.' })
      .setTimestamp(new Date(signal.updatedAt || signal.createdAt || Date.now()));
  }

  buildSignalRows(signal) {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`take_signal:${signal.signalId}`).setLabel('Mirror This Trade').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`signal_future:${signal.signalId}`).setLabel('Create Culture Lane').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`signal_close_copy:${signal.signalId}`).setLabel('Close My Mirror').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`signal_info:${signal.signalId}`).setLabel('Signal Info').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`signal_mute:${signal.signalId}`).setLabel('Mute Updates').setStyle(ButtonStyle.Secondary),
      ),
    ];
  }

  shouldPostUpdate(previous = {}, next = {}) {
    if (!previous.status || previous.status !== next.status) return true;
    if (previous.stopLoss !== next.stopLoss || previous.takeProfit !== next.takeProfit) return true;
    if (Number(previous.copiedBy || 0) !== Number(next.copiedBy || 0)) return true;
    const prevPL = Number(previous.floatingPL || 0);
    const nextPL = Number(next.floatingPL || 0);
    return Math.abs(nextPL - prevPL) >= Number(process.env.SIGNAL_UPDATE_PL_THRESHOLD || 25);
  }
}
