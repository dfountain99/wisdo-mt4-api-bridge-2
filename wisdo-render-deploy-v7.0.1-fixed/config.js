import 'dotenv/config';

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function list(value) {
  return String(value || '').split(/[;,]/).map((x) => x.trim()).filter(Boolean);
}

function first(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function routePath(value, fallback) {
  const clean = String(value || '').trim();
  if (!clean) return fallback;
  return clean.startsWith('/') ? clean : `/${clean}`;
}

const configuredPersistenceMode = first('WISDO_PERSISTENCE_MODE').toLowerCase();
const hasDatabaseUrl = Boolean(first('DATABASE_URL'));
const isProductionRuntime = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
const productionPersistenceMode = hasDatabaseUrl
  ? 'postgres'
  : (isProductionRuntime ? 'postgres' : (configuredPersistenceMode === 'memory' ? 'memory' : 'memory'));
const databaseRequired = isProductionRuntime;

export const config = {
  discordToken: first('DISCORD_TOKEN'),
  clientId: first('CLIENT_ID'),
  guildId: first('GUILD_ID'),
  cultureCoinRoleId: first('CULTURE_COIN_ROLE_ID'),
  cultureCoinRoleName: first('CULTURE_COIN_ROLE_NAME') || 'Culture Coin',
  coachRoleId: first('COACH_ROLE_ID'),
  coachRoleName: first('COACH_ROLE_NAME') || 'Coach',
  ownerUserId: first('OWNER_USER_ID'),
  categoryName: first('OPERATOR_DESK_CATEGORY_NAME', 'CATEGORY_NAME') || '\u{1F512} CULTURE COIN OPERATOR DESKS',
  archiveCategoryName: first('OPERATOR_DESK_ARCHIVE_CATEGORY_NAME', 'ARCHIVE_CATEGORY_NAME') || '\u{1F4E6} CULTURE COIN ARCHIVED DESKS',
  dataDir: first('WISDO_STORAGE_PATH', 'DATA_DIR') || './data/operator-desks',
  persistence: {
    mode: productionPersistenceMode.toLowerCase(),
    databaseRequired,
    databaseUrl: first('DATABASE_URL'),
    storagePath: first('WISDO_STORAGE_PATH', 'DATA_DIR') || './data/operator-desks',
    dbSsl: bool(first('WISDO_DB_SSL'), false),
  },
  redis: {
    enabled: bool(first('REDIS_ENABLED'), true),
    url: first('REDIS_URL'),
    prefix: first('REDIS_PREFIX') || 'wisdo',
    healthTtlSeconds: num(first('REDIS_HEALTH_TTL_SECONDS'), 90),
    recoveryIntervalMs: num(first('REDIS_RECOVERY_INTERVAL_MS'), 15000),
    visibilityTimeoutMs: num(first('REDIS_VISIBILITY_TIMEOUT_MS'), 30000),
    maxDeliveryAttempts: num(first('REDIS_MAX_DELIVERY_ATTEMPTS'), 5),
  },
  createPrivateVoiceChannels: bool(first('CREATE_PRIVATE_VOICE_CHANNELS'), false),
  api: {
    port: num(first('PORT', 'API_PORT'), 3000),
    publicBaseUrl: first('PUBLIC_BASE_URL').replace(/\/+$/, ''),
    mt4SyncPath: routePath(first('MT4_SYNC_PATH'), '/mt4-sync'),
    mt4SyncApiKey: first('MT4_SYNC_API_KEY'),
    mt4PairingCodeTtlHours: num(first('MT4_PAIRING_CODE_TTL_HOURS'), 24),
    mt4RequireKnownPairing: bool(first('MT4_REQUIRE_KNOWN_PAIRING'), true),
    mt4MaxPayloadKb: num(first('MT4_MAX_PAYLOAD_KB'), 256),
  },
  wisdo: {
    enabled: bool(first('WISDO_ENABLED'), true),
    tone: first('WISDO_TONE') || 'old_head_wizard',
    autoAnalyzeClockIn: bool(first('WISDO_AUTO_ANALYZE_CLOCK_IN'), true),
    autoAnalyzeEaLog: bool(first('WISDO_AUTO_ANALYZE_EA_LOG'), true),
    autoAnalyzeClockOut: bool(first('WISDO_AUTO_ANALYZE_CLOCK_OUT'), true),
    autoAnalyzeWeeklyReview: bool(first('WISDO_AUTO_ANALYZE_WEEKLY_REVIEW'), true),
    mt4StaleMinutes: num(first('WISDO_MT4_STALE_MINUTES'), 5),
    maxSafeOpenTrades: num(first('WISDO_MAX_SAFE_OPEN_TRADES'), 5),
    drawdownWarnPercent: num(first('WISDO_DRAWDOWN_WARN_PERCENT'), 10),
    drawdownDangerPercent: num(first('WISDO_DRAWDOWN_DANGER_PERCENT'), 20),
    profitProtectPercent: num(first('WISDO_PROFIT_PROTECT_PERCENT'), 5),
    strongWarningsEnabled: bool(first('WISDO_ENABLE_STRONG_WARNINGS'), true),
  },
  affiliate: {
    activationFeeAmount: num(first('WISDO_ACTIVATION_FEE_AMOUNT'), 125),
    defaultCommissionPercent: num(first('WISDO_AFFILIATE_DEFAULT_PERCENT'), 30),
    minimumPayoutAmount: num(first('WISDO_AFFILIATE_MIN_PAYOUT'), 25),
    holdDays: num(first('WISDO_AFFILIATE_HOLD_DAYS'), 7),
    autoApprove: bool(first('WISDO_AFFILIATE_AUTO_APPROVE'), false),
    allowSelfReferral: bool(first('WISDO_AFFILIATE_ALLOW_SELF_REFERRAL'), false),
    clawBackRefundedActivationFees: bool(first('WISDO_AFFILIATE_CLAWBACK_REFUNDS'), true),
  },
  signalGrid: {
    percentMode: first('SIGNAL_GRID_PERCENT_MODE') || 'balance',
    updateFrequencySeconds: num(first('SIGNAL_GRID_REFRESH_SECONDS'), 20),
    expirationMinutes: num(first('SIGNAL_GRID_EXPIRATION_MINUTES'), 45),
    upperProfitPercent: num(first('SIGNAL_GRID_UPPER_PROFIT_PERCENT'), 3),
    protectedProfitPercent: num(first('SIGNAL_GRID_PROTECTED_PERCENT'), 1.5),
    discordEnabled: bool(first('SIGNAL_GRID_DISCORD_ENABLED'), true),
    websiteEnabled: bool(first('SIGNAL_GRID_WEBSITE_ENABLED'), true),
    copyButtonsEnabled: bool(first('SIGNAL_GRID_COPY_ENABLED'), true),
  },
  store: {
    enabled: bool(first('STORE_ENABLED', 'BOT_STORE_ENABLED'), true),
    autoSyncOnStart: bool(first('STORE_AUTO_SYNC_ON_START', 'BOT_AUTO_SYNC_ON_START'), false),
    sourceDirs: list(first('BOT_STORE_SOURCE_DIRS', 'BOT_SOURCE_DIRS') || './bots,./mql4'),
    deliveryDir: first('BOT_STORE_DELIVERY_DIR', 'BOT_DELIVERY_DIR') || './data/operator-desks/bot-deliveries',
    basePriceUsd: num(first('BOT_BASE_PRICE_USD', 'BOT_BASE_PRICE'), 497),
    cultureCoinPriceUsd: num(first('BOT_CULTURE_COIN_PRICE_USD', 'CULTURE_COIN_BOT_PRICE'), 197),
    negotiationFloorUsd: num(first('BOT_NEGOTIATION_FLOOR_USD', 'BOT_NEGOTIATION_FLOOR'), 97),
    buyThreeGetThreeEnabled: bool(first('BOT_BUY_THREE_GET_THREE_ENABLED', 'BOT_BUY_3_GET_3_FREE'), true),
    quoteTtlHours: num(first('BOT_QUOTE_TTL_HOURS'), 24),
    cultureCoinFreeBotEnabled: bool(first('CULTURE_COIN_FREE_BOT_ENABLED'), true),
    welcomeDmEnabled: bool(first('STORE_WELCOME_DM_ENABLED', 'WELCOME_DM_ENABLED'), false),
    welcomeChannelId: first('STORE_WELCOME_CHANNEL_ID', 'WELCOME_CHANNEL_ID'),
    supportContact: first('STORE_SUPPORT_CONTACT', 'CULTURE_COIN_SUPPORT_CONTACT'),
    joinCultureCoinUrl: first('JOIN_CULTURE_COIN_URL', 'CULTURE_COIN_JOIN_URL'),
    squareAccessToken: first('SQUARE_ACCESS_TOKEN'),
    squareApplicationId: first('SQUARE_APPLICATION_ID'),
    squareLocationId: first('SQUARE_LOCATION_ID'),
    squareEnvironment: first('SQUARE_ENVIRONMENT') || 'sandbox',
    squareApiVersion: first('SQUARE_API_VERSION') || '2026-05-20',
    squareWebhookSignatureKey: first('SQUARE_WEBHOOK_SIGNATURE_KEY'),
    squareWebhookNotificationUrl: first('SQUARE_WEBHOOK_NOTIFICATION_URL'),
    squareWebhookPath: routePath(first('SQUARE_WEBHOOK_PATH'), '/api/public/webhooks/square'),
    squareSubscriptionPlanId: first('SQUARE_SUBSCRIPTION_PLAN_ID'),
    squareSubscriptionPlanMonthlyId: first('SQUARE_SUBSCRIPTION_PLAN_MONTHLY_ID'),
    squareSubscriptionPlanQuarterlyId: first('SQUARE_SUBSCRIPTION_PLAN_QUARTERLY_ID'),
    squareSubscriptionPlanSemiannualId: first('SQUARE_SUBSCRIPTION_PLAN_SEMIANNUAL_ID'),
    squareSubscriptionPlanAnnualId: first('SQUARE_SUBSCRIPTION_PLAN_ANNUAL_ID'),
    squareSuccessPath: routePath(first('SQUARE_SUCCESS_PATH'), '/store/success'),
    squareCancelPath: routePath(first('SQUARE_CANCEL_PATH'), '/store/cancel'),
    currency: first('STORE_CURRENCY', 'BOT_STORE_CURRENCY') || 'usd',
  },
};

export function getMissingRuntimeEnv() {
  return ['DISCORD_TOKEN'].filter((key) => !process.env[key]);
}
