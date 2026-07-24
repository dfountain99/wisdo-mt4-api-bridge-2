import { randomUUID } from 'node:crypto';

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

function moneyNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString();
}

function slugCode(value = '') {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}

export class AffiliateService {
  constructor({ config = {}, repository }) {
    this.config = config;
    this.repository = repository;
  }

  settings(state = {}) {
    const saved = state.affiliateSettings || {};
    const cfg = this.config.affiliate || {};
    return {
      activationFeeAmount: moneyNumber(saved.activationFeeAmount, moneyNumber(cfg.activationFeeAmount, 125)),
      defaultCommissionPercent: moneyNumber(saved.defaultCommissionPercent, moneyNumber(cfg.defaultCommissionPercent, 30)),
      minimumPayoutAmount: moneyNumber(saved.minimumPayoutAmount, moneyNumber(cfg.minimumPayoutAmount, 25)),
      holdDays: moneyNumber(saved.holdDays, moneyNumber(cfg.holdDays, 7)),
      autoApprove: saved.autoApprove !== undefined ? Boolean(saved.autoApprove) : Boolean(cfg.autoApprove),
      allowSelfReferral: saved.allowSelfReferral !== undefined ? Boolean(saved.allowSelfReferral) : Boolean(cfg.allowSelfReferral),
      clawBackRefundedActivationFees: saved.clawBackRefundedActivationFees !== undefined
        ? Boolean(saved.clawBackRefundedActivationFees)
        : cfg.clawBackRefundedActivationFees !== false,
    };
  }

  audit(state, adminId, action, targetType, targetId, data = {}) {
    return this.repository.addAuditToState(state, {
      adminId: adminId || 'system',
      action,
      targetType,
      targetId,
      data,
    });
  }

  async updateSettings(adminId, patch = {}) {
    let settings;
    await this.repository.updateState((state) => {
      state.affiliateSettings = {
        ...this.settings(state),
        ...patch,
        updatedAt: nowIso(),
      };
      settings = state.affiliateSettings;
      this.audit(state, adminId, 'affiliate_settings.updated', 'AffiliateSettings', 'global', patch);
      return state;
    });
    return settings;
  }

  async createAffiliate(adminId, payload = {}) {
    let affiliate;
    await this.repository.updateState((state) => {
      const referralCode = slugCode(payload.referralCode || payload.code || payload.displayName || payload.userId || makeId('AFF'));
      const duplicate = Object.values(state.affiliatesById || {}).find((item) =>
        String(item.referralCode || '').toUpperCase() === referralCode &&
        !['banned', 'suspended'].includes(String(item.status || 'active')),
      );
      if (duplicate) throw new Error('Referral code is already in use.');

      const affiliateId = String(payload.affiliateId || payload.id || makeId('aff'));
      const settings = this.settings(state);
      affiliate = {
        id: affiliateId,
        affiliateId,
        userId: String(payload.userId || ''),
        displayName: String(payload.displayName || payload.name || payload.userId || 'Wisdo Affiliate'),
        referralCode,
        status: String(payload.status || 'active'),
        defaultCommissionPercent: moneyNumber(payload.defaultCommissionPercent, settings.defaultCommissionPercent),
        payoutMethod: String(payload.payoutMethod || 'manual'),
        payoutDetailsJson: payload.payoutDetailsJson || payload.payoutDetails || {},
        metadataJson: payload.metadataJson || payload.metadata || {},
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      state.affiliatesById[affiliateId] = affiliate;
      state.referralCodesByUserId[affiliate.userId] = referralCode;
      this.audit(state, adminId, 'affiliate.created', 'Affiliate', affiliateId, { referralCode });
      return state;
    });
    return affiliate;
  }

  async updateAffiliate(adminId, affiliateId, patch = {}) {
    let affiliate;
    await this.repository.updateState((state) => {
      affiliate = state.affiliatesById?.[affiliateId];
      if (!affiliate) throw new Error('Affiliate not found.');
      const nextCode = patch.referralCode ? slugCode(patch.referralCode) : affiliate.referralCode;
      if (nextCode !== affiliate.referralCode) {
        const duplicate = Object.values(state.affiliatesById || {}).find((item) =>
          item.affiliateId !== affiliateId && String(item.referralCode || '').toUpperCase() === nextCode,
        );
        if (duplicate) throw new Error('Referral code is already in use.');
      }
      affiliate = {
        ...affiliate,
        ...patch,
        referralCode: nextCode,
        defaultCommissionPercent: patch.defaultCommissionPercent !== undefined
          ? moneyNumber(patch.defaultCommissionPercent, affiliate.defaultCommissionPercent)
          : affiliate.defaultCommissionPercent,
        payoutDetailsJson: patch.payoutDetailsJson || patch.payoutDetails || affiliate.payoutDetailsJson || {},
        metadataJson: patch.metadataJson || patch.metadata || affiliate.metadataJson || {},
        updatedAt: nowIso(),
      };
      state.affiliatesById[affiliateId] = affiliate;
      if (affiliate.userId) state.referralCodesByUserId[affiliate.userId] = affiliate.referralCode;
      this.audit(state, adminId, 'affiliate.updated', 'Affiliate', affiliateId, { fields: Object.keys(patch) });
      return state;
    });
    return affiliate;
  }

  async getAffiliate(affiliateId) {
    const state = await this.repository.loadState();
    return state.affiliatesById?.[affiliateId] || null;
  }

  async getAffiliateByReferralCode(referralCode) {
    const state = await this.repository.loadState();
    const code = slugCode(referralCode);
    return Object.values(state.affiliatesById || {}).find((affiliate) =>
      String(affiliate.referralCode || '').toUpperCase() === code,
    ) || null;
  }

  async getAffiliateByUserId(userId) {
    const state = await this.repository.loadState();
    return Object.values(state.affiliatesById || {}).find((affiliate) =>
      String(affiliate.userId || '') === String(userId || ''),
    ) || null;
  }

  async createReferral(affiliateIdOrCode, referredUserPayload = {}) {
    let referral;
    await this.repository.updateState((state) => {
      const affiliate = state.affiliatesById?.[affiliateIdOrCode] || Object.values(state.affiliatesById || {}).find((item) =>
        String(item.referralCode || '').toUpperCase() === slugCode(affiliateIdOrCode),
      );
      if (!affiliate) throw new Error('Affiliate not found.');
      if (affiliate.status !== 'active') throw new Error('Affiliate is not active.');
      const settings = this.settings(state);
      const referredUserId = String(referredUserPayload.userId || referredUserPayload.referredUserId || '');
      if (!settings.allowSelfReferral && referredUserId && referredUserId === String(affiliate.userId || '')) {
        throw new Error('Self-referrals are not allowed.');
      }
      const duplicate = Object.values(state.affiliateReferralsById || {}).find((item) =>
        String(item.affiliateId) === String(affiliate.affiliateId) &&
        (
          (referredUserId && String(item.referredUserId || '') === referredUserId) ||
          (referredUserPayload.email && String(item.referredEmail || '').toLowerCase() === String(referredUserPayload.email).toLowerCase())
        ) &&
        !['cancelled', 'refunded', 'disqualified'].includes(String(item.status || ''))
      );
      if (duplicate) throw new Error('Duplicate active referral exists for this affiliate.');

      const referralId = makeId('affref');
      referral = {
        id: referralId,
        referralId,
        affiliateId: affiliate.affiliateId,
        referredUserId,
        referredEmail: String(referredUserPayload.email || referredUserPayload.referredEmail || ''),
        referralCode: affiliate.referralCode,
        campaignId: String(referredUserPayload.campaignId || ''),
        status: 'invited',
        activationFeeAmount: moneyNumber(referredUserPayload.activationFeeAmount, this.campaignActivationFee(state, referredUserPayload.campaignId)),
        currency: String(referredUserPayload.currency || 'usd').toLowerCase(),
        paymentRef: '',
        source: String(referredUserPayload.source || 'affiliate_api'),
        metadataJson: referredUserPayload.metadataJson || referredUserPayload.metadata || {},
        createdAt: nowIso(),
        activatedAt: null,
        paidAt: null,
        updatedAt: nowIso(),
      };
      state.affiliateReferralsById[referralId] = referral;
      this.audit(state, affiliate.userId || 'system', 'affiliate_referral.created', 'AffiliateReferral', referralId, { affiliateId: affiliate.affiliateId });
      return state;
    });
    return referral;
  }

  campaignActivationFee(state, campaignId = '') {
    const settings = this.settings(state);
    const campaign = campaignId ? state.affiliateCampaignsById?.[campaignId] : null;
    return moneyNumber(campaign?.activationFeeAmount, settings.activationFeeAmount);
  }

  commissionPercent(state, affiliate, referral) {
    const campaign = referral?.campaignId ? state.affiliateCampaignsById?.[referral.campaignId] : null;
    return moneyNumber(campaign?.commissionPercent, moneyNumber(affiliate?.defaultCommissionPercent, this.settings(state).defaultCommissionPercent));
  }

  async markReferralSignedUp(referralId, userId) {
    let referral;
    await this.repository.updateState((state) => {
      referral = state.affiliateReferralsById?.[referralId];
      if (!referral) throw new Error('Referral not found.');
      referral.referredUserId = String(userId || referral.referredUserId || '');
      referral.status = 'signed_up';
      referral.updatedAt = nowIso();
      this.audit(state, referral.referredUserId || 'system', 'affiliate_referral.signed_up', 'AffiliateReferral', referralId, { userId });
      return state;
    });
    return referral;
  }

  async recordActivationPayment(referralId, paymentRef, amount = null, currency = 'usd') {
    let result;
    await this.repository.updateState((state) => {
      const referral = state.affiliateReferralsById?.[referralId];
      if (!referral) throw new Error('Referral not found.');
      if (['cancelled', 'refunded', 'disqualified'].includes(referral.status)) {
        throw new Error('Cannot record activation payment for inactive referral.');
      }
      referral.activationFeeAmount = moneyNumber(amount, moneyNumber(referral.activationFeeAmount, this.settings(state).activationFeeAmount));
      referral.currency = String(currency || referral.currency || 'usd').toLowerCase();
      referral.paymentRef = String(paymentRef || '');
      referral.status = 'paid';
      referral.activatedAt ||= nowIso();
      referral.paidAt = nowIso();
      referral.updatedAt = nowIso();
      const commission = this.calculateActivationCommissionInState(state, referralId);
      this.audit(state, referral.referredUserId || 'system', 'affiliate_activation_payment.recorded', 'AffiliateReferral', referralId, { paymentRef, amount: referral.activationFeeAmount });
      result = { referral, commission };
      return state;
    });
    return result;
  }

  calculateActivationCommissionInState(state, referralId) {
    const referral = state.affiliateReferralsById?.[referralId];
    if (!referral) throw new Error('Referral not found.');
    const affiliate = state.affiliatesById?.[referral.affiliateId];
    if (!affiliate) throw new Error('Affiliate not found.');
    if (affiliate.status !== 'active') throw new Error('Affiliate is not active.');
    const existing = Object.values(state.affiliateCommissionsById || {}).find((item) =>
      String(item.referralId) === String(referralId) && item.sourceType === 'activation_fee',
    );
    if (existing) return existing;
    const settings = this.settings(state);
    const percent = this.commissionPercent(state, affiliate, referral);
    const gross = moneyNumber(referral.activationFeeAmount, settings.activationFeeAmount);
    const commissionAmount = Number((gross * (percent / 100)).toFixed(2));
    const commissionId = makeId('affcomm');
    const commission = {
      id: commissionId,
      commissionId,
      affiliateId: affiliate.affiliateId,
      referralId,
      referredUserId: referral.referredUserId || '',
      sourceType: 'activation_fee',
      sourceId: referral.paymentRef || referralId,
      grossAmount: gross,
      commissionPercent: percent,
      commissionAmount,
      currency: referral.currency || 'usd',
      status: settings.autoApprove ? 'approved' : 'pending',
      holdUntil: addDays(settings.holdDays),
      payoutId: null,
      paymentRef: referral.paymentRef || '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.affiliateCommissionsById[commissionId] = commission;
    this.audit(state, affiliate.userId || 'system', 'affiliate_commission.calculated', 'AffiliateCommission', commissionId, { referralId, gross, percent, commissionAmount });
    return commission;
  }

  async calculateActivationCommission(referralId) {
    let commission;
    await this.repository.updateState((state) => {
      commission = this.calculateActivationCommissionInState(state, referralId);
      return state;
    });
    return commission;
  }

  async approveCommission(adminId, commissionId) {
    return this.updateCommissionStatus(adminId, commissionId, 'approved', 'affiliate_commission.approved');
  }

  async holdCommission(adminId, commissionId, reason = '') {
    return this.updateCommissionStatus(adminId, commissionId, 'held', 'affiliate_commission.held', { reason });
  }

  async markCommissionPayable(adminId, commissionId) {
    return this.updateCommissionStatus(adminId, commissionId, 'payable', 'affiliate_commission.payable');
  }

  async updateCommissionStatus(adminId, commissionId, status, action, patch = {}) {
    let commission;
    await this.repository.updateState((state) => {
      commission = state.affiliateCommissionsById?.[commissionId];
      if (!commission) throw new Error('Commission not found.');
      commission.status = status;
      commission.updatedAt = nowIso();
      Object.assign(commission, patch);
      this.audit(state, adminId, action, 'AffiliateCommission', commissionId, patch);
      return state;
    });
    return commission;
  }

  async cancelOrClawBackCommission(adminId, commissionId, reason = 'payment_reversed') {
    let commission;
    await this.repository.updateState((state) => {
      commission = state.affiliateCommissionsById?.[commissionId];
      if (!commission) throw new Error('Commission not found.');
      commission.status = commission.status === 'paid' ? 'clawed_back' : 'cancelled';
      commission.reason = reason;
      commission.updatedAt = nowIso();
      this.audit(state, adminId, commission.status === 'clawed_back' ? 'affiliate_commission.clawed_back' : 'affiliate_commission.cancelled', 'AffiliateCommission', commissionId, { reason });
      return state;
    });
    return commission;
  }

  async createAffiliatePayout(adminId, affiliateId, commissionIds = []) {
    let payout;
    await this.repository.updateState((state) => {
      const affiliate = state.affiliatesById?.[affiliateId];
      if (!affiliate) throw new Error('Affiliate not found.');
      const settings = this.settings(state);
      const commissions = commissionIds
        .map((id) => state.affiliateCommissionsById?.[id])
        .filter(Boolean)
        .filter((commission) => commission.affiliateId === affiliateId);
      if (!commissions.length) throw new Error('No valid commissions selected for payout.');
      const invalid = commissions.find((commission) => !['approved', 'payable'].includes(commission.status));
      if (invalid) throw new Error('Only approved or payable commissions can be included in a payout.');
      const amount = Number(commissions.reduce((sum, item) => sum + moneyNumber(item.commissionAmount), 0).toFixed(2));
      if (amount < settings.minimumPayoutAmount) throw new Error(`Minimum payout threshold is ${settings.minimumPayoutAmount}.`);
      const payoutId = makeId('affpay');
      payout = {
        id: payoutId,
        payoutId,
        affiliateId,
        amount,
        currency: commissions[0]?.currency || 'usd',
        status: 'pending',
        payoutMethod: affiliate.payoutMethod || 'manual',
        payoutReference: '',
        includedCommissionIdsJson: commissions.map((commission) => commission.commissionId),
        createdAt: nowIso(),
        paidAt: null,
        updatedAt: nowIso(),
      };
      state.affiliatePayoutsById[payoutId] = payout;
      for (const commission of commissions) {
        commission.status = 'payable';
        commission.payoutId = payoutId;
        commission.updatedAt = nowIso();
      }
      this.audit(state, adminId, 'affiliate_payout.created', 'AffiliatePayout', payoutId, { affiliateId, amount, commissionIds: payout.includedCommissionIdsJson });
      return state;
    });
    return payout;
  }

  async createCampaign(adminId, payload = {}) {
    let campaign;
    await this.repository.updateState((state) => {
      const campaignId = String(payload.campaignId || payload.id || makeId('affcamp'));
      campaign = {
        id: campaignId,
        campaignId,
        name: String(payload.name || 'Affiliate campaign'),
        description: String(payload.description || ''),
        status: String(payload.status || 'active'),
        activationFeeAmount: moneyNumber(payload.activationFeeAmount, this.settings(state).activationFeeAmount),
        commissionPercent: moneyNumber(payload.commissionPercent, this.settings(state).defaultCommissionPercent),
        startsAt: payload.startsAt || null,
        endsAt: payload.endsAt || null,
        metadataJson: payload.metadataJson || payload.metadata || {},
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      state.affiliateCampaignsById[campaignId] = campaign;
      this.audit(state, adminId, 'affiliate_campaign.created', 'AffiliateCampaign', campaignId, { name: campaign.name });
      return state;
    });
    return campaign;
  }

  async updateCampaign(adminId, campaignId, patch = {}) {
    let campaign;
    await this.repository.updateState((state) => {
      campaign = state.affiliateCampaignsById?.[campaignId];
      if (!campaign) throw new Error('Campaign not found.');
      campaign = {
        ...campaign,
        ...patch,
        activationFeeAmount: patch.activationFeeAmount !== undefined ? moneyNumber(patch.activationFeeAmount, campaign.activationFeeAmount) : campaign.activationFeeAmount,
        commissionPercent: patch.commissionPercent !== undefined ? moneyNumber(patch.commissionPercent, campaign.commissionPercent) : campaign.commissionPercent,
        metadataJson: patch.metadataJson || patch.metadata || campaign.metadataJson || {},
        updatedAt: nowIso(),
      };
      state.affiliateCampaignsById[campaignId] = campaign;
      this.audit(state, adminId, 'affiliate_campaign.updated', 'AffiliateCampaign', campaignId, { fields: Object.keys(patch) });
      return state;
    });
    return campaign;
  }

  async markPayoutPaid(adminId, payoutId, payoutReference = '') {
    let payout;
    await this.repository.updateState((state) => {
      payout = state.affiliatePayoutsById?.[payoutId];
      if (!payout) throw new Error('Payout not found.');
      payout.status = 'paid';
      payout.payoutReference = String(payoutReference || payout.payoutReference || '');
      payout.paidAt = nowIso();
      payout.updatedAt = nowIso();
      for (const commissionId of payout.includedCommissionIdsJson || []) {
        const commission = state.affiliateCommissionsById?.[commissionId];
        if (!commission) continue;
        commission.status = 'paid';
        commission.payoutId = payoutId;
        commission.updatedAt = nowIso();
      }
      this.audit(state, adminId, 'affiliate_payout.paid', 'AffiliatePayout', payoutId, { payoutReference });
      return state;
    });
    return payout;
  }

  async listAffiliateReferrals(affiliateId) {
    const state = await this.repository.loadState();
    return Object.values(state.affiliateReferralsById || {})
      .filter((referral) => String(referral.affiliateId) === String(affiliateId))
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }

  async listAffiliateCommissions(affiliateId) {
    const state = await this.repository.loadState();
    return Object.values(state.affiliateCommissionsById || {})
      .filter((commission) => String(commission.affiliateId) === String(affiliateId))
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }

  async getAffiliateDashboard(affiliateId) {
    const state = await this.repository.loadState();
    const affiliate = state.affiliatesById?.[affiliateId] || await this.getAffiliateByUserId(affiliateId);
    if (!affiliate) return null;
    const referrals = Object.values(state.affiliateReferralsById || {}).filter((item) => item.affiliateId === affiliate.affiliateId);
    const commissions = Object.values(state.affiliateCommissionsById || {}).filter((item) => item.affiliateId === affiliate.affiliateId);
    const payouts = Object.values(state.affiliatePayoutsById || {}).filter((item) => item.affiliateId === affiliate.affiliateId);
    const totalActivationFees = referrals.reduce((sum, item) => sum + moneyNumber(item.activationFeeAmount), 0);
    const byStatus = (status) => commissions.filter((item) => item.status === status).reduce((sum, item) => sum + moneyNumber(item.commissionAmount), 0);
    return {
      affiliate: this.publicAffiliate(affiliate),
      referralLink: `/join/${affiliate.referralCode}`,
      referrals,
      commissions,
      payouts,
      stats: {
        peopleSignedUp: referrals.filter((item) => ['signed_up', 'activated', 'paid'].includes(item.status)).length,
        peopleActivated: referrals.filter((item) => ['activated', 'paid'].includes(item.status)).length,
        pendingCommission: byStatus('pending'),
        approvedCommission: byStatus('approved') + byStatus('payable'),
        paidCommission: byStatus('paid'),
        totalActivationFees,
        conversionRate: referrals.length ? Number(((referrals.filter((item) => ['activated', 'paid'].includes(item.status)).length / referrals.length) * 100).toFixed(2)) : 0,
      },
    };
  }

  publicAffiliate(affiliate = {}) {
    const { payoutDetailsJson, ...safe } = affiliate;
    return safe;
  }
}
