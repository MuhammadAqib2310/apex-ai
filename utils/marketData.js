/**
 * utils/marketData.js
 * Maps common user-typed asset names/aliases to Twelve Data symbols,
 * and fetches a live quote so the AI analysis is grounded in real numbers.
 */

const TWELVE_DATA_KEY = process.env.TWELVE_DATA_API_KEY || '';
const TWELVE_DATA_BASE = 'https://api.twelvedata.com';

// Alias -> Twelve Data symbol. Extend this list any time.
const SYMBOL_MAP = {
  // Forex majors
  'eurusd': 'EUR/USD', 'eur/usd': 'EUR/USD', 'eur usd': 'EUR/USD',
  'gbpusd': 'GBP/USD', 'gbp/usd': 'GBP/USD', 'gbp usd': 'GBP/USD',
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

  // Metals & commodities
  'gold': 'XAU/USD', 'xauusd': 'XAU/USD', 'xau/usd': 'XAU/USD', 'xau': 'XAU/USD',
  'silver': 'XAG/USD', 'xagusd': 'XAG/USD', 'xag/usd': 'XAG/USD', 'xag': 'XAG/USD',
  'oil': 'WTI/USD', 'crude oil': 'WTI/USD', 'wti': 'WTI/USD',

  // Indices
  'nasdaq': 'NDX', 'nas100': 'NDX', 'ndx': 'NDX',
  's&p500': 'SPX', 'sp500': 'SPX', 'spx': 'SPX', 's&p 500': 'SPX',
  'us30': 'DJI', 'dow jones': 'DJI', 'dji': 'DJI', 'dow': 'DJI',
};

/**
 * Try to find one or more known symbols mentioned in free text.
 * Returns an array of Twelve Data symbols (deduped).
 */
function detectSymbols(text) {
  const lower = text.toLowerCase();
  const found = new Set();

  for (const alias of Object.keys(SYMBOL_MAP)) {
    // word-boundary-ish match so "eth" doesn't match inside "another"
    const escaped = alias.replace(/[/&]/g, '\\$&');
    const pattern = new RegExp(`(?:^|[^a-z])${escaped}(?:[^a-z]|$)`, 'i');
    if (pattern.test(lower)) {
      found.add(SYMBOL_MAP[alias]);
    }
  }

  return Array.from(found);
}

/**
 * Fetch a live quote for a single Twelve Data symbol.
 * Returns null on failure (caller should degrade gracefully).
 */
async function fetchQuote(symbol) {
  if (!TWELVE_DATA_KEY) return null;

  try {
    const url = `${TWELVE_DATA_BASE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${TWELVE_DATA_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'error' || data.code) {
      console.warn(`Twelve Data error for ${symbol}:`, data.message || data);
      return null;
    }

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
      fiftyTwoWeekLow: data.fifty_two_week?.low,
    };
  } catch (err) {
    console.error(`Failed to fetch quote for ${symbol}:`, err.message);
    return null;
  }
}

/**
 * Given a user message, detect mentioned assets and fetch live quotes for them.
 * Returns a formatted context string to inject into the AI prompt, or '' if none found.
 */
async function buildLiveMarketContext(userMessage) {
  const symbols = detectSymbols(userMessage);
  if (symbols.length === 0) return '';

  const quotes = await Promise.all(symbols.slice(0, 3).map(fetchQuote));
  const valid = quotes.filter(Boolean);

  if (valid.length === 0) {
    return TWELVE_DATA_KEY
      ? ''
      : '\n\n[SYSTEM NOTE: Live market data API key is not configured on the server, so no real-time price feed is available for this request.]';
  }

  let context = '\n\n[LIVE MARKET DATA — use these real, current figures as the factual basis for your analysis]\n';
  valid.forEach((q) => {
    context += `\n${q.symbol} (${q.name})
- Current Price: ${q.price}
- Open: ${q.open} | High: ${q.high} | Low: ${q.low}
- Previous Close: ${q.previousClose}
- Change: ${q.change} (${q.percentChange}%)
- Volume: ${q.volume || 'N/A'}
- 52-Week High/Low: ${q.fiftyTwoWeekHigh || 'N/A'} / ${q.fiftyTwoWeekLow || 'N/A'}
- As of: ${q.timestamp ? new Date(q.timestamp * 1000).toISOString() : 'N/A'}\n`;
  });
  context += '\nBase your technical analysis, levels, and bias on these real figures. Do not claim you lack live data — you have it above.\n';

  return context;
}

module.exports = { detectSymbols, fetchQuote, buildLiveMarketContext, SYMBOL_MAP };
