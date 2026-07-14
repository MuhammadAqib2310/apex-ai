/**
 * utils/marketData.js
 * Multi-source free market data:
 * - Crypto: CoinGecko (free, no key)
 * - Forex + Gold: ExchangeRate API (free, no key) + Twelve Data (if key set)
 */

const TWELVE_DATA_KEY  = process.env.TWELVE_DATA_API_KEY || '';
const TWELVE_DATA_BASE = 'https://api.twelvedata.com';

// CoinGecko coin id map
const COINGECKO_IDS = {
  'BTC/USD': 'bitcoin',
  'ETH/USD': 'ethereum',
  'SOL/USD': 'solana',
  'XRP/USD': 'ripple',
  'BNB/USD': 'binancecoin',
  'DOGE/USD': 'dogecoin',
  'ADA/USD': 'cardano',
  'AVAX/USD': 'avalanche-2',
  'DOT/USD': 'polkadot',
  'MATIC/USD': 'matic-network',
  'LINK/USD': 'chainlink',
  'LTC/USD': 'litecoin',
};

// Forex symbol map (base/quote)
const FOREX_SYMBOLS = {
  'EUR/USD': { base: 'EUR', quote: 'USD' },
  'GBP/USD': { base: 'GBP', quote: 'USD' },
  'USD/JPY': { base: 'USD', quote: 'JPY' },
  'USD/CHF': { base: 'USD', quote: 'CHF' },
  'AUD/USD': { base: 'AUD', quote: 'USD' },
  'USD/CAD': { base: 'USD', quote: 'CAD' },
  'NZD/USD': { base: 'NZD', quote: 'USD' },
  'USD/CNY': { base: 'USD', quote: 'CNY' },
  'USD/INR': { base: 'USD', quote: 'INR' },
  'USD/PKR': { base: 'USD', quote: 'PKR' },
};

// Alias -> canonical symbol. Extend freely.
const SYMBOL_MAP = {
  // Forex
  'eurusd': 'EUR/USD', 'eur/usd': 'EUR/USD', 'eur usd': 'EUR/USD', 'euro': 'EUR/USD',
  'gbpusd': 'GBP/USD', 'gbp/usd': 'GBP/USD', 'gbp usd': 'GBP/USD', 'pound': 'GBP/USD',
  'usdjpy': 'USD/JPY', 'usd/jpy': 'USD/JPY', 'usd jpy': 'USD/JPY',
  'usdchf': 'USD/CHF', 'usd/chf': 'USD/CHF',
  'audusd': 'AUD/USD', 'aud/usd': 'AUD/USD',
  'usdcad': 'USD/CAD', 'usd/cad': 'USD/CAD',
  'nzdusd': 'NZD/USD', 'nzd/usd': 'NZD/USD',

  // Crypto
  'btc': 'BTC/USD', 'btcusd': 'BTC/USD', 'btc/usd': 'BTC/USD', 'bitcoin': 'BTC/USD',
  'eth': 'ETH/USD', 'ethusd': 'ETH/USD', 'eth/usd': 'ETH/USD', 'ethereum': 'ETH/USD',
  'sol': 'SOL/USD', 'solusd': 'SOL/USD', 'sol/usd': 'SOL/USD', 'solana': 'SOL/USD',
  'xrp': 'XRP/USD', 'xrpusd': 'XRP/USD', 'xrp/usd': 'XRP/USD', 'ripple': 'XRP/USD',
  'bnb': 'BNB/USD', 'bnbusd': 'BNB/USD', 'bnb/usd': 'BNB/USD',
  'doge': 'DOGE/USD', 'dogeusd': 'DOGE/USD', 'dogecoin': 'DOGE/USD',
  'ada': 'ADA/USD', 'cardano': 'ADA/USD',
  'avax': 'AVAX/USD', 'avalanche': 'AVAX/USD',
  'dot': 'DOT/USD', 'polkadot': 'DOT/USD',
  'matic': 'MATIC/USD', 'polygon': 'MATIC/USD',
  'link': 'LINK/USD', 'chainlink': 'LINK/USD',
  'ltc': 'LTC/USD', 'litecoin': 'LTC/USD',

  // Metals
  'gold': 'XAU/USD', 'xauusd': 'XAU/USD', 'xau/usd': 'XAU/USD', 'xau': 'XAU/USD',
  'silver': 'XAG/USD', 'xagusd': 'XAG/USD', 'xag/usd': 'XAG/USD', 'xag': 'XAG/USD',
};

// ─── CoinGecko fetch (crypto) ─────────────────────────────────────────────
async function fetchCoinGecko(symbol) {
  const geckoId = COINGECKO_IDS[symbol];
  if (!geckoId) return null;
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_high_low=true`;
    const res  = await fetch(url);
    const data = await res.json();
    const coin = data[geckoId];
    if (!coin) return null;
    const price = coin.usd;
    const change = coin.usd_24h_change || 0;
    return {
      symbol,
      name: geckoId.charAt(0).toUpperCase() + geckoId.slice(1),
      price: price.toString(),
      open: null,
      high: null,
      low: null,
      previousClose: null,
      change: ((price * change) / (100 + change)).toFixed(4),
      percentChange: change.toFixed(4),
      volume: null,
      timestamp: Math.floor(Date.now() / 1000),
      source: 'CoinGecko',
    };
  } catch (err) {
    console.error('CoinGecko error:', err.message);
    return null;
  }
}

// ─── ExchangeRate API fetch (forex) ──────────────────────────────────────
let forexCache = null;
let forexCacheTime = 0;

async function fetchForex(symbol) {
  const pair = FOREX_SYMBOLS[symbol];
  if (!pair) return null;
  try {
    // Cache rates for 5 minutes
    if (!forexCache || Date.now() - forexCacheTime > 5 * 60 * 1000) {
      const res  = await fetch('https://open.er-api.com/v6/latest/USD');
      const data = await res.json();
      forexCache     = data.rates;
      forexCacheTime = Date.now();
    }
    const rates = forexCache;
    let price;
    if (pair.base === 'USD') {
      price = rates[pair.quote];
    } else if (pair.quote === 'USD') {
      price = 1 / rates[pair.base];
    } else {
      price = rates[pair.quote] / rates[pair.base];
    }
    if (!price) return null;
    return {
      symbol,
      name: symbol,
      price: price.toFixed(5),
      open: null,
      high: null,
      low: null,
      previousClose: null,
      change: null,
      percentChange: null,
      volume: null,
      timestamp: Math.floor(Date.now() / 1000),
      source: 'ExchangeRate-API',
    };
  } catch (err) {
    console.error('Forex fetch error:', err.message);
    return null;
  }
}

// ─── Twelve Data fetch (gold/metals, fallback for others) ─────────────────
async function fetchTwelveData(symbol) {
  if (!TWELVE_DATA_KEY) return null;
  try {
    const url  = `${TWELVE_DATA_BASE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${TWELVE_DATA_KEY}`;
    const res  = await fetch(url);
    const data = await res.json();
    if (data.status === 'error' || data.code) return null;
    return {
      symbol: data.symbol || symbol,
      name: data.name || symbol,
      price: data.close,
      open: data.open,
      high: data.high,
      low: data.low,
      previousClose: data.previous_close,
      change: data.change,
      percentChange: data.percent_change,
      volume: data.volume,
      timestamp: data.timestamp,
      fiftyTwoWeekHigh: data.fifty_two_week?.high,
      fiftyTwoWeekLow:  data.fifty_two_week?.low,
      source: 'TwelveData',
    };
  } catch (err) {
    console.error('TwelveData error:', err.message);
    return null;
  }
}

// ─── Main fetchQuote — tries best source per symbol type ─────────────────
async function fetchQuote(symbol) {
  const sym = symbol.toUpperCase();

  // Crypto → CoinGecko first
  if (COINGECKO_IDS[sym]) {
    const q = await fetchCoinGecko(sym);
    if (q) return q;
  }

  // Gold/Silver → Twelve Data first, fallback forex rates
  if (sym === 'XAU/USD' || sym === 'XAG/USD') {
    const q = await fetchTwelveData(sym);
    if (q) return q;
    // Fallback: try forex cache
    return await fetchForex(sym);
  }

  // Forex → ExchangeRate API first
  if (FOREX_SYMBOLS[sym]) {
    const q = await fetchForex(sym);
    if (q) return q;
    return await fetchTwelveData(sym);
  }

  // Fallback: try Twelve Data
  return await fetchTwelveData(sym);
}

// ─── Symbol detection in free text ───────────────────────────────────────
function detectSymbols(text) {
  const lower = text.toLowerCase();
  const found = new Set();
  for (const alias of Object.keys(SYMBOL_MAP)) {
    const escaped = alias.replace(/[/&]/g, '\\$&');
    const pattern = new RegExp(`(?:^|[^a-z])${escaped}(?:[^a-z]|$)`, 'i');
    if (pattern.test(lower)) {
      found.add(SYMBOL_MAP[alias]);
    }
  }
  return Array.from(found);
}

// ─── Build live context string for AI prompt ─────────────────────────────
async function buildLiveMarketContext(userMessage) {
  const symbols = detectSymbols(userMessage);
  if (symbols.length === 0) return '';

  const quotes = await Promise.all(symbols.slice(0, 3).map(fetchQuote));
  const valid  = quotes.filter(Boolean);

  if (valid.length === 0) return '';

  let context = '\n\n[LIVE MARKET DATA — use these real, current figures as the factual basis for your analysis]\n';
  valid.forEach((q) => {
    context += `\n${q.symbol} (${q.name})
- Current Price: ${q.price}
${q.open         ? `- Open: ${q.open} | High: ${q.high} | Low: ${q.low}` : ''}
${q.previousClose ? `- Previous Close: ${q.previousClose}` : ''}
${q.percentChange ? `- Change: ${q.change} (${parseFloat(q.percentChange).toFixed(2)}%)` : ''}
${q.volume        ? `- Volume: ${q.volume}` : ''}
- As of: ${q.timestamp ? new Date(q.timestamp * 1000).toUTCString() : new Date().toUTCString()}
- Source: ${q.source || 'Live API'}\n`;
  });
  context += '\nBase your technical analysis, levels, and bias on these real figures.\n';
  return context;
}

module.exports = { detectSymbols, fetchQuote, buildLiveMarketContext, SYMBOL_MAP };
