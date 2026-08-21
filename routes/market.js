/**
 * routes/market.js
 * Direct live-quote lookup endpoint (used by the frontend ticker / quick lookup,
 * independent of the chat/AI flow).
 */

const express = require('express');
const { fetchQuote, SYMBOL_MAP } = require('../utils/marketData');

const router = express.Router();

// GET /api/market/quote?symbol=BTC/USD  (or alias like "btc", "gold", "eurusd")
router.get('/quote', async (req, res) => {
  const raw = (req.query.symbol || '').toString().trim().toLowerCase();
  if (!raw) return res.status(400).json({ error: 'symbol query param is required' });

  const symbol = SYMBOL_MAP[raw] || req.query.symbol.toString().toUpperCase();
  const quote = await fetchQuote(symbol);

  if (!quote) {
    return res.status(502).json({
      error: 'Could not fetch live quote. Check TWELVE_DATA_API_KEY is set and the symbol is valid.',
    });
  }

  res.json({ quote });
});

// GET /api/market/symbols  — list of supported aliases for the frontend quick-buttons
router.get('/symbols', (req, res) => {
  res.json({ symbols: SYMBOL_MAP });
});

module.exports = router;
