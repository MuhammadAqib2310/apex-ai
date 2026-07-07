/**
 * routes/journal.js
 * Trading Journal, Price Alerts, and AI Coach endpoints
 */

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { fetchQuote } = require('../utils/marketData');

const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const MODEL = process.env.MODEL || 'llama-3.3-70b-versatile';

// ============================================================
// TRADING JOURNAL
// ============================================================

// GET /api/journal/trades
router.get('/trades', requireAuth, (req, res) => {
  const trades = db.getTradesByUser(req.user.id);
  res.json({ trades });
});

// POST /api/journal/trades
router.post('/trades', requireAuth, (req, res) => {
  const { symbol, direction, entryPrice, exitPrice, stopLoss, takeProfit, lotSize, result, pnl, notes, date } = req.body;
  if (!symbol || !entryPrice) return res.status(400).json({ error: 'symbol and entryPrice are required' });
  const trade = db.addTrade(req.user.id, { symbol, direction, entryPrice, exitPrice, stopLoss, takeProfit, lotSize, result, pnl, notes, date });
  res.status(201).json({ trade });
});

// PATCH /api/journal/trades/:id
router.patch('/trades/:id', requireAuth, (req, res) => {
  const trade = db.updateTrade(req.params.id, req.user.id, req.body);
  if (!trade) return res.status(404).json({ error: 'Trade not found' });
  res.json({ trade });
});

// DELETE /api/journal/trades/:id
router.delete('/trades/:id', requireAuth, (req, res) => {
  const ok = db.deleteTrade(req.params.id, req.user.id);
  if (!ok) return res.status(404).json({ error: 'Trade not found' });
  res.json({ success: true });
});

// GET /api/journal/stats  — computed win rate, P&L, etc.
router.get('/stats', requireAuth, (req, res) => {
  const trades = db.getTradesByUser(req.user.id).filter(t => t.result !== 'open');
  const total  = trades.length;
  const wins   = trades.filter(t => t.result === 'win').length;
  const losses = trades.filter(t => t.result === 'loss').length;
  const be     = trades.filter(t => t.result === 'breakeven').length;
  const winRate = total ? ((wins / total) * 100).toFixed(1) : 0;
  const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
  const avgWin  = wins   ? (trades.filter(t => t.result === 'win').reduce((s,t)  => s + (t.pnl||0), 0) / wins).toFixed(2)   : 0;
  const avgLoss = losses ? (trades.filter(t => t.result === 'loss').reduce((s,t) => s + (t.pnl||0), 0) / losses).toFixed(2) : 0;
  const bestTrade  = trades.reduce((b, t) => (!b || (t.pnl||0) > (b.pnl||0)) ? t : b, null);
  const worstTrade = trades.reduce((w, t) => (!w || (t.pnl||0) < (w.pnl||0)) ? t : w, null);

  // Symbol breakdown
  const bySymbol = {};
  trades.forEach(t => {
    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { wins: 0, losses: 0, pnl: 0 };
    if (t.result === 'win')  bySymbol[t.symbol].wins++;
    if (t.result === 'loss') bySymbol[t.symbol].losses++;
    bySymbol[t.symbol].pnl += t.pnl || 0;
  });

  res.json({
    stats: {
      total, wins, losses, breakeven: be, winRate,
      totalPnl: totalPnl.toFixed(2),
      avgWin, avgLoss,
      bestTrade, worstTrade,
      bySymbol,
      openTrades: db.getTradesByUser(req.user.id).filter(t => t.result === 'open').length,
    }
  });
});

// ============================================================
// PRICE ALERTS
// ============================================================

// GET /api/journal/alerts
router.get('/alerts', requireAuth, (req, res) => {
  const alerts = db.getAlertsByUser(req.user.id);
  res.json({ alerts });
});

// POST /api/journal/alerts
router.post('/alerts', requireAuth, (req, res) => {
  const { symbol, targetPrice, condition, note } = req.body;
  if (!symbol || !targetPrice) return res.status(400).json({ error: 'symbol and targetPrice are required' });
  if (!['above', 'below'].includes(condition)) return res.status(400).json({ error: 'condition must be above or below' });
  const alert = db.addAlert(req.user.id, { symbol, targetPrice, condition, note });
  res.status(201).json({ alert });
});

// DELETE /api/journal/alerts/:id
router.delete('/alerts/:id', requireAuth, (req, res) => {
  const ok = db.deleteAlert(req.params.id, req.user.id);
  if (!ok) return res.status(404).json({ error: 'Alert not found' });
  res.json({ success: true });
});

// POST /api/journal/alerts/check  — frontend polls this to check prices
router.post('/alerts/check', requireAuth, async (req, res) => {
  const userAlerts = db.getAlertsByUser(req.user.id).filter(a => !a.triggered);
  if (!userAlerts.length) return res.json({ triggered: [] });

  // Get unique symbols
  const symbols = [...new Set(userAlerts.map(a => a.symbol))];
  const prices = {};
  await Promise.all(symbols.map(async sym => {
    try {
      const q = await fetchQuote(sym);
      if (q?.price) prices[sym] = parseFloat(q.price);
    } catch (_) {}
  }));

  const triggered = [];
  userAlerts.forEach(alert => {
    const price = prices[alert.symbol];
    if (price === undefined) return;
    const hit = alert.condition === 'above' ? price >= alert.targetPrice
                                            : price <= alert.targetPrice;
    if (hit) {
      db.triggerAlert(alert.id);
      triggered.push({ ...alert, currentPrice: price });
    }
  });

  res.json({ triggered, prices });
});

// ============================================================
// AI TRADING COACH
// ============================================================

// POST /api/journal/coach  — AI analyzes trade history and gives advice
router.post('/coach', requireAuth, async (req, res) => {
  if (!GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY not configured' });

  const trades = db.getTradesByUser(req.user.id).filter(t => t.result !== 'open');
  if (trades.length < 2) {
    return res.json({ advice: 'Log at least 2 completed trades to get personalized coaching from the AI.' });
  }

  // Build trade summary for AI
  const stats = {
    total: trades.length,
    wins: trades.filter(t => t.result === 'win').length,
    losses: trades.filter(t => t.result === 'loss').length,
    winRate: ((trades.filter(t => t.result === 'win').length / trades.length) * 100).toFixed(1),
    totalPnl: trades.reduce((s, t) => s + (t.pnl || 0), 0).toFixed(2),
  };

  const recentTrades = trades.slice(0, 10).map(t =>
    `${t.symbol} ${t.direction.toUpperCase()} | Entry:${t.entryPrice} Exit:${t.exitPrice || 'N/A'} | ${t.result.toUpperCase()} | P&L:$${t.pnl || 0} | Notes: ${t.notes || 'none'}`
  ).join('\n');

  const prompt = `You are an elite trading coach. Analyze this trader's journal and give personalized coaching.

TRADING STATS:
- Total trades: ${stats.total}
- Win rate: ${stats.winRate}%
- Wins: ${stats.wins} | Losses: ${stats.losses}
- Total P&L: $${stats.totalPnl}

RECENT TRADES:
${recentTrades}

Give a SHORT, actionable coaching report in this JSON format:
{
  "grade": "B+",
  "summary": "2-3 sentence overall assessment",
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "tips": [
    { "title": "Fix Your Risk Management", "detail": "Your average loss is 2x your average win. Set hard rules: SL = 1% max per trade." },
    { "title": "Best Asset", "detail": "You perform 70% win rate on BTC — focus here." }
  ],
  "weeklyGoal": "One specific goal for this week"
}`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        temperature: 0.4,
        stream: false,
        messages: [
          { role: 'system', content: 'You are an expert trading coach. Return only valid raw JSON with no markdown or code blocks.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.json();
      return res.status(502).json({ error: err?.error?.message || 'AI error' });
    }

    const data = await groqRes.json();
    const text = data.choices?.[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.json({ advice: text });

    const coaching = JSON.parse(jsonMatch[0]);
    res.json({ coaching, stats });
  } catch (err) {
    console.error('Coach error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
