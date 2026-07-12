const DEFAULT_OUTPUT_SIZE = 240;
const MAX_OUTPUT_SIZE = 5000;
const DEFAULT_TIMEOUT_MS = 12000;

function clean(value = '', max = 200) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function intervalToTwelveData(value = '15') {
  const normalized = clean(value, 20).toUpperCase();
  const map = {
    '1': '1min', '3': '3min', '5': '5min', '15': '15min', '30': '30min', '45': '45min',
    '60': '1h', '120': '2h', '180': '3h', '240': '4h', D: '1day', W: '1week', M: '1month',
  };
  return map[normalized] || '15min';
}

function intervalToCoinbaseGranularity(value = '15') {
  const normalized = clean(value, 20).toUpperCase();
  const map = {
    '1': 60,
    '5': 300,
    '15': 900,
    '60': 3600,
    '240': 21600,
    D: 86400,
  };
  return map[normalized] || null;
}

function normalizeTradingViewSymbol(value = '') {
  const raw = clean(value, 80).toUpperCase().replace(/\s+/g, '');
  return raw || 'OANDA:XAUUSD';
}

export function marketDataSymbol(value = '') {
  const tv = normalizeTradingViewSymbol(value);
  const [exchange = '', rawSymbol = tv] = tv.includes(':') ? tv.split(':', 2) : ['', tv];
  const compact = rawSymbol.replace(/[^A-Z0-9]/g, '');
  const aliases = {
    XAUUSD: 'XAU/USD',
    EURUSD: 'EUR/USD',
    GBPUSD: 'GBP/USD',
    USDJPY: 'USD/JPY',
    AUDUSD: 'AUD/USD',
    USDCAD: 'USD/CAD',
    USDCHF: 'USD/CHF',
    NZDUSD: 'NZD/USD',
    BTCUSD: 'BTC/USD',
    ETHUSD: 'ETH/USD',
    SOLUSD: 'SOL/USD',
    US30: 'DJI',
    NAS100USD: 'NDX',
    NAS100: 'NDX',
    SPX500USD: 'SPX',
    SPX500: 'SPX',
    NQ1: 'NQ',
    ES1: 'ES',
  };
  return aliases[compact] || (exchange === 'NASDAQ' || exchange === 'NYSE' ? compact : rawSymbol.replace('_', '/'));
}

function coinbaseProduct(value = '') {
  const symbol = marketDataSymbol(value).replace('/', '-');
  return ['BTC-USD', 'ETH-USD', 'SOL-USD', 'LTC-USD', 'BCH-USD', 'DOGE-USD'].includes(symbol) ? symbol : '';
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTime(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value > 10_000_000_000 ? value : value * 1000;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const text = clean(value, 80);
  if (!text) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text) ? `${text.replace(' ', 'T')}Z` : text;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeCandle(row = {}, index = 0) {
  const timeValue = row.datetime ?? row.time ?? row.timestamp ?? row.date ?? row.t;
  const date = parseTime(timeValue);
  const open = number(row.open ?? row.o);
  const high = number(row.high ?? row.h);
  const low = number(row.low ?? row.l);
  const close = number(row.close ?? row.c);
  const volume = number(row.volume ?? row.v);
  if (!date || [open, high, low, close].some((item) => item == null)) return null;
  if (high < Math.max(open, close) || low > Math.min(open, close) || low > high) return null;
  return {
    index,
    time: date.toISOString(),
    label: date.toISOString(),
    open,
    high,
    low,
    close,
    ...(volume == null ? {} : { volume }),
  };
}

export function normalizeHistoricalCandles(rows = []) {
  const normalized = (Array.isArray(rows) ? rows : [])
    .map((row, index) => normalizeCandle(row, index))
    .filter(Boolean)
    .sort((a, b) => new Date(a.time) - new Date(b.time));

  const deduped = [];
  let lastTime = '';
  for (const candle of normalized) {
    if (candle.time === lastTime) continue;
    lastTime = candle.time;
    deduped.push({ ...candle, index: deduped.length });
  }
  return deduped;
}

function providerError(message, provider, details = {}) {
  const error = new Error(message);
  error.provider = provider;
  error.details = details;
  error.expose = true;
  return error;
}

async function fetchJson(fetchImpl, url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const timeout = AbortSignal.timeout(clamp(timeoutMs, 1000, 60000, DEFAULT_TIMEOUT_MS));
  const response = await fetchImpl(url, { ...options, signal: timeout });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw providerError(body?.message || body?.error || `Market data request failed with HTTP ${response.status}.`, 'http', { status: response.status });
  }
  return body;
}

export class HistoricalMarketDataService {
  constructor(config = {}, options = {}) {
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.customUrl = clean(options.customUrl ?? process.env.WISDO_MARKET_DATA_URL, 2000).replace(/\/$/, '');
    this.customToken = clean(options.customToken ?? process.env.WISDO_MARKET_DATA_TOKEN, 2000);
    this.twelveDataKey = clean(options.twelveDataKey ?? process.env.TWELVE_DATA_API_KEY, 2000);
    this.providerPreference = clean(options.provider ?? process.env.WISDO_HISTORICAL_DATA_PROVIDER ?? 'auto', 40).toLowerCase();
    this.timeoutMs = clamp(options.timeoutMs ?? process.env.WISDO_MARKET_DATA_TIMEOUT_MS, 1000, 60000, DEFAULT_TIMEOUT_MS);
    this.logger = options.logger || config.logger || null;
  }

  configuredProviders(symbol, interval) {
    const providers = [];
    if (this.customUrl) providers.push('wisdo');
    if (this.twelveDataKey) providers.push('twelvedata');
    if (coinbaseProduct(symbol) && intervalToCoinbaseGranularity(interval)) providers.push('coinbase');
    if (this.providerPreference !== 'auto') {
      const preferred = providers.filter((item) => item === this.providerPreference);
      return preferred.length ? preferred : [];
    }
    return providers;
  }

  isConfigured(symbol = 'OANDA:XAUUSD', interval = '15') {
    return this.configuredProviders(symbol, interval).length > 0;
  }

  async getCandles({ symbol, interval = '15', outputSize = DEFAULT_OUTPUT_SIZE, startTime = '', endTime = '' } = {}) {
    if (!this.fetchImpl) throw providerError('No HTTP client is available for historical market data.', 'none');
    const requestedSymbol = normalizeTradingViewSymbol(symbol);
    const safeSize = Math.round(clamp(outputSize, 64, MAX_OUTPUT_SIZE, DEFAULT_OUTPUT_SIZE));
    const providers = this.configuredProviders(requestedSymbol, interval);
    if (!providers.length) {
      throw providerError(
        'Real historical market data is not configured for this symbol. Add TWELVE_DATA_API_KEY or WISDO_MARKET_DATA_URL. WISDO will not generate fake candles.',
        'unconfigured',
      );
    }

    const failures = [];
    for (const provider of providers) {
      try {
        const result = provider === 'wisdo'
          ? await this.fetchCustom({ symbol: requestedSymbol, interval, outputSize: safeSize, startTime, endTime })
          : provider === 'twelvedata'
            ? await this.fetchTwelveData({ symbol: requestedSymbol, interval, outputSize: safeSize, startTime, endTime })
            : await this.fetchCoinbase({ symbol: requestedSymbol, interval, outputSize: safeSize, startTime, endTime });
        if (result.candles.length < 32) throw providerError('Historical provider returned too few valid candles.', provider, { candleCount: result.candles.length });
        return result;
      } catch (error) {
        failures.push({ provider, message: error.message });
        this.logger?.warn?.('Historical market data provider failed', { provider, symbol: requestedSymbol, interval, message: error.message });
      }
    }
    throw providerError(
      `Real historical data could not be loaded. ${failures.map((item) => `${item.provider}: ${item.message}`).join(' | ')}`,
      'all_failed',
      { failures },
    );
  }

  async fetchCustom({ symbol, interval, outputSize, startTime, endTime }) {
    const url = new URL(this.customUrl);
    url.searchParams.set('symbol', marketDataSymbol(symbol));
    url.searchParams.set('tradingViewSymbol', symbol);
    url.searchParams.set('interval', intervalToTwelveData(interval));
    url.searchParams.set('outputsize', String(outputSize));
    if (startTime) url.searchParams.set('start_date', startTime);
    if (endTime) url.searchParams.set('end_date', endTime);
    const payload = await fetchJson(this.fetchImpl, url, {
      headers: this.customToken ? { Authorization: `Bearer ${this.customToken}` } : {},
    }, this.timeoutMs);
    const candles = normalizeHistoricalCandles(payload.candles || payload.values || payload.data || []);
    return {
      provider: 'wisdo',
      sourceName: clean(payload.sourceName || payload.provider || 'WISDO market-data bridge', 120),
      sourceUrl: this.customUrl,
      symbol,
      providerSymbol: clean(payload.symbol || marketDataSymbol(symbol), 80),
      interval,
      candles,
      fetchedAt: new Date().toISOString(),
    };
  }

  async fetchTwelveData({ symbol, interval, outputSize, startTime, endTime }) {
    const url = new URL('https://api.twelvedata.com/time_series');
    url.searchParams.set('symbol', marketDataSymbol(symbol));
    url.searchParams.set('interval', intervalToTwelveData(interval));
    url.searchParams.set('outputsize', String(outputSize));
    url.searchParams.set('format', 'JSON');
    url.searchParams.set('order', 'ASC');
    url.searchParams.set('apikey', this.twelveDataKey);
    if (startTime) url.searchParams.set('start_date', startTime);
    if (endTime) url.searchParams.set('end_date', endTime);
    const payload = await fetchJson(this.fetchImpl, url, {}, this.timeoutMs);
    if (payload.status === 'error' || payload.code) throw providerError(payload.message || 'Twelve Data returned an error.', 'twelvedata', payload);
    const candles = normalizeHistoricalCandles(payload.values || []);
    return {
      provider: 'twelvedata',
      sourceName: 'Twelve Data',
      sourceUrl: 'https://twelvedata.com',
      symbol,
      providerSymbol: clean(payload.meta?.symbol || marketDataSymbol(symbol), 80),
      interval,
      candles,
      fetchedAt: new Date().toISOString(),
      timezone: clean(payload.meta?.exchange_timezone || payload.meta?.timezone || '', 80),
      exchange: clean(payload.meta?.exchange || '', 80),
    };
  }

  async fetchCoinbase({ symbol, interval, outputSize, startTime, endTime }) {
    const product = coinbaseProduct(symbol);
    const granularity = intervalToCoinbaseGranularity(interval);
    if (!product || !granularity) throw providerError('Coinbase does not support this symbol or timeframe.', 'coinbase');
    const end = endTime ? parseTime(endTime) : new Date();
    const start = startTime ? parseTime(startTime) : new Date(end.getTime() - granularity * 1000 * Math.min(300, outputSize));
    const url = new URL(`https://api.exchange.coinbase.com/products/${encodeURIComponent(product)}/candles`);
    url.searchParams.set('granularity', String(granularity));
    url.searchParams.set('start', start.toISOString());
    url.searchParams.set('end', end.toISOString());
    const payload = await fetchJson(this.fetchImpl, url, { headers: { 'User-Agent': 'WISDO-Academy/1.0' } }, this.timeoutMs);
    const rows = Array.isArray(payload) ? payload.map((row) => ({ time: row[0], low: row[1], high: row[2], open: row[3], close: row[4], volume: row[5] })) : [];
    const candles = normalizeHistoricalCandles(rows).slice(-Math.min(300, outputSize));
    return {
      provider: 'coinbase',
      sourceName: 'Coinbase Exchange',
      sourceUrl: 'https://exchange.coinbase.com',
      symbol,
      providerSymbol: product,
      interval,
      candles,
      fetchedAt: new Date().toISOString(),
      timezone: 'UTC',
    };
  }
}
