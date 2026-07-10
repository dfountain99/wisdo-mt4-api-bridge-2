import { randomUUID } from 'node:crypto';

import { formatUsd } from '../utils/store.js';

export class BotPricingService {
  constructor(config) {
    this.config = config;
  }

  getPerBotPrice(isCultureCoinMember) {
    return isCultureCoinMember
      ? this.config.store.cultureCoinPriceUsd
      : this.config.store.basePriceUsd;
  }

  getNegotiationFloor() {
    return this.config.store.negotiationFloorUsd;
  }

  calculateBundleBillingCount(count) {
    if (!this.config.store.buyThreeGetThreeEnabled || count < 3) {
      return count;
    }

    const fullBlocks = Math.floor(count / 6);
    const remainder = count % 6;
    return fullBlocks * 3 + Math.min(remainder, 3);
  }

  createQuote({
    discordUserId,
    bots,
    isCultureCoinMember,
    freeClaimAvailable = false,
    requestedOfferUsd = null,
    negotiationMessage = '',
    forceFreeClaim = false,
  }) {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setHours(expiresAt.getHours() + this.config.store.quoteTtlHours);

    const uniqueBots = [...new Map(bots.map((bot) => [bot.id, bot])).values()];
    const paidUnitPrice = this.getPerBotPrice(isCultureCoinMember);
    const bundleEligibleBots = uniqueBots.filter((bot) => bot.bundleEligible !== false);
    const nonBundleBots = uniqueBots.filter((bot) => bot.bundleEligible === false);
    const billedBundleCount = this.calculateBundleBillingCount(bundleEligibleBots.length);
    const bundleFreeCount = bundleEligibleBots.length - billedBundleCount;
    const subtotalUsd = billedBundleCount * paidUnitPrice + nonBundleBots.length * paidUnitPrice;

    let freeClaimApplied = false;
    let freeClaimBotId = null;
    let adjustedTotalUsd = subtotalUsd;

    if (
      forceFreeClaim &&
      freeClaimAvailable &&
      this.config.store.cultureCoinFreeBotEnabled &&
      uniqueBots.length === 1 &&
      uniqueBots[0].freeClaimEligible !== false
    ) {
      freeClaimApplied = true;
      freeClaimBotId = uniqueBots[0].id;
      adjustedTotalUsd = 0;
    }

    const paidBotCount = adjustedTotalUsd === 0 ? 0 : billedBundleCount + nonBundleBots.length;
    const floorTotalUsd = paidBotCount * this.getNegotiationFloor();

    let finalPriceUsd = adjustedTotalUsd;
    let negotiationStatus = 'standard';
    let counterOfferUsd = null;

    if (
      requestedOfferUsd !== null &&
      Number.isFinite(requestedOfferUsd) &&
      adjustedTotalUsd > 0
    ) {
      if (requestedOfferUsd >= adjustedTotalUsd) {
        finalPriceUsd = requestedOfferUsd;
        negotiationStatus = 'accepted-request';
      } else if (requestedOfferUsd >= floorTotalUsd) {
        finalPriceUsd = requestedOfferUsd;
        negotiationStatus = 'accepted-discount';
      } else {
        finalPriceUsd = floorTotalUsd;
        counterOfferUsd = floorTotalUsd;
        negotiationStatus = 'countered';
      }
    }

    const savingsUsd = uniqueBots.length * this.config.store.basePriceUsd - finalPriceUsd;

    return {
      quoteId: randomUUID(),
      discordUserId,
      botIds: uniqueBots.map((bot) => bot.id),
      botNames: uniqueBots.map((bot) => bot.name),
      isCultureCoinMember,
      freeClaimAvailable,
      freeClaimApplied,
      freeClaimBotId,
      bundleFreeCount,
      paidBotCount,
      paidUnitPriceUsd: adjustedTotalUsd === 0 ? 0 : paidUnitPrice,
      subtotalUsd,
      finalPriceUsd,
      floorTotalUsd,
      savingsUsd,
      requestedOfferUsd,
      counterOfferUsd,
      negotiationStatus,
      negotiationMessage,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'open',
    };
  }

  buildWisdoNegotiationMessage(quote) {
    if (quote.freeClaimApplied) {
      return `Alright, this one is covered. You're Culture Coin, so that free-bot slot just handled **${quote.botNames[0]}**. No payment needed on this claim.`;
    }

    if (quote.negotiationStatus === 'accepted-discount') {
      return `I can work with that. I locked the quote at **${formatUsd(quote.finalPriceUsd)}** for ${quote.botNames.length} ${quote.botNames.length === 1 ? 'bot' : 'bots'}.`;
    }

    if (quote.negotiationStatus === 'countered') {
      return `I can't take it all the way there, but I can meet you at **${formatUsd(quote.counterOfferUsd)}**. That's the clean floor without disrespecting the product.`;
    }

    if (quote.bundleFreeCount > 0) {
      return `Now we're talking. The bundle kicked in, so you're getting **${quote.bundleFreeCount} free** and paying **${formatUsd(quote.finalPriceUsd)}** total.`;
    }

    if (quote.isCultureCoinMember) {
      return `Culture Coin gets the better number by default. Your member price is sitting at **${formatUsd(quote.finalPriceUsd)}** right now.`;
    }

    return `The standard number on this setup is **${formatUsd(quote.finalPriceUsd)}**. If you want the better lane, Culture Coin gets the deeper pricing plus a free-bot claim.`;
  }

  buildQuoteSummaryLines(quote) {
    return [
      `Bots: ${quote.botNames.join(', ')}`,
      `Paid bots: ${quote.paidBotCount}`,
      `Bundle free bots: ${quote.bundleFreeCount}`,
      `Member pricing: ${quote.isCultureCoinMember ? 'Yes' : 'No'}`,
      `Free claim applied: ${quote.freeClaimApplied ? 'Yes' : 'No'}`,
      `Final total: ${formatUsd(quote.finalPriceUsd)}`,
      `Savings vs base price: ${formatUsd(Math.max(quote.savingsUsd, 0))}`,
      `Quote expires: ${new Date(quote.expiresAt).toLocaleString('en-US')}`,
    ];
  }
}
