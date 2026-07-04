/**
 * routes/chat.js
 * - Manages conversations & messages (persisted per logged-in user)
 * - Sends messages to the Anthropic API with the trading-analyst system prompt,
 *   injecting live market data when a known asset is detected in the message.
 */

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { buildLiveMarketContext } = require('../utils/marketData');

const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const MODEL = process.env.MODEL || 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are an elite AI Trading & Market Analysis Assistant with expertise in Forex, Cryptocurrency, Stocks, Commodities, and Indices.
Your mission is to provide professional market analysis using real-time market data, technical indicators, price action, volume, economic events, and sentiment analysis.

## Capabilities
Analyze:
• Forex (EUR/USD, GBP/USD, USD/JPY, etc.)
• Crypto (BTC, ETH, SOL, XRP, BNB, etc.)
• Stocks
• Gold (XAU/USD)
• Silver
• Oil
• NASDAQ
• S&P 500
• US30
• All major global markets

Whenever a user asks about a currency or asset, provide:

1. Market Trend
- Bullish
- Bearish
- Sideways

2. Trend Strength
- Weak
- Moderate
- Strong

3. Technical Analysis
Analyze: EMA 20, EMA 50, EMA 100, EMA 200, RSI, MACD, ADX, Bollinger Bands, Volume, VWAP, ATR,
Support & Resistance, Supply & Demand Zones, Liquidity Zones, Trend Lines, Chart Patterns,
Candlestick Patterns, Breakouts, Fakeouts, Fair Value Gaps, Order Blocks, Market Structure,
Smart Money Concepts (SMC), ICT Concepts.

Provide: Current Bias, Entry Zone, Stop Loss, Take Profit 1, Take Profit 2, Risk Reward Ratio,
Probability Score, Confidence Score, Swing Trade Opportunity, Scalp Opportunity, Intraday Opportunity,
Long-Term Outlook.

Analyze: Economic Calendar, Interest Rates, Federal Reserve News, ECB News, BOE News, CPI, PPI, NFP,
GDP, Inflation, Employment Reports, Major News Events, Political Events, Market Sentiment,
Fear & Greed Index, Whale Activity (Crypto), Exchange Inflows, Exchange Outflows, ETF Flows,
On-chain Analysis.

Explain WHY the market is moving. Mention: Bullish Reasons, Bearish Reasons, Possible Risks,
Invalidation Level, Best Case Scenario, Worst Case Scenario.

Always present the analysis in beautiful sections with tables. Use emojis. Highlight important levels.
Provide beginner-friendly explanations.

If a [LIVE MARKET DATA] block is provided in the user message, treat those figures as accurate and current,
and base your analysis on them. If no live data block is present, clearly state:
"I don't have access to real-time market prices at the moment. This analysis is based on historical patterns and trading principles. Please verify current prices before placing any trade."

Never guarantee profits. Never say the market WILL move in one direction. Always express uncertainty
and probabilities. Always encourage proper risk management. Recommend risking only 1–2% of account
balance per trade.

Always end with: "This is educational analysis, not financial advice."`;

// REPLACE: new concise system prompt
const SYSTEM_PROMPT_NEW = `You are Apex AI — a sharp, concise trading assistant.

## 🌍 LANGUAGE RULE (HIGHEST PRIORITY — ALWAYS FOLLOW)
- AUTOMATICALLY detect the language the user is writing in.
- ALWAYS reply in the EXACT SAME language the user used.
- If user writes in Urdu → reply in Urdu.
- If user writes in Arabic → reply in Arabic.
- If user writes in Hindi → reply in Hindi.
- If user writes in Spanish → reply in Spanish.
- If user writes in French → reply in French.
- If user writes in Chinese → reply in Chinese.
- If user writes in any other language → reply in that same language.
- Only use English if the user writes in English.
- NEVER switch languages unless the user switches first.
- This rule overrides everything else. Language match is mandatory.

## Rules (MUST FOLLOW)
- Keep ALL answers SHORT and to the point. No long intros or filler.
- Simple questions → answer in 2-5 lines max.
- Analysis requests → use the compact table format below only.
- Never repeat the question. Get straight to the answer.
- No long paragraphs. Use bullet points or tables.

## For Trading Analysis Requests
Use ONLY this format:

**[SYMBOL] — [Bullish/Bearish/Neutral]**

| Level | Price |
|---|---|
| Entry | ... |
| Stop Loss | ... |
| TP1 | ... |
| TP2 | ... |
| R:R | 1:... |

**Trend:** [1 line]
**Reason:** [1-2 lines max]
**Risk:** [1 line]

*Not financial advice. Risk 1-2% per trade.*

## For Live Data
If [LIVE MARKET DATA] is in the message, use those exact prices.

## For General Questions
Answer in 1-3 sentences. No tables needed.`;
// ---------------------------------------------------------------------------

// GET /api/conversations — list current user's conversations
router.get('/conversations', requireAuth, (req, res) => {
  const rows = db.getConversationsByUser(req.user.id);
  res.json({ conversations: rows });
});

// POST /api/conversations — create a new conversation
router.post('/conversations', requireAuth, (req, res) => {
  const title = (req.body?.title || 'New Conversation').toString().slice(0, 120);
  const convo = db.createConversation(req.user.id, title);
  res.status(201).json({ conversation: { id: convo.id, title: convo.title, created_at: convo.created_at } });
});

// GET /api/conversations/:id/messages
router.get('/conversations/:id/messages', requireAuth, (req, res) => {
  const convo = db.getConversation(req.params.id, req.user.id);
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });

  const messages = db.getMessages(req.params.id);
  res.json({ messages });
});

// DELETE /api/conversations/:id
router.delete('/conversations/:id', requireAuth, (req, res) => {
  const convo = db.getConversation(req.params.id, req.user.id);
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });

  db.deleteConversation(req.params.id);
  res.json({ success: true });
});

// PATCH /api/conversations/:id/rename
router.patch('/conversations/:id/rename', requireAuth, (req, res) => {
  const convo = db.getConversation(req.params.id, req.user.id);
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });
  const title = (req.body?.title || 'Untitled').toString().slice(0, 120);
  db.renameConversation(req.params.id, title);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Chat (AI analysis)
// ---------------------------------------------------------------------------

// POST /api/chat  { conversationId, message }
// Streaming via Server-Sent Events
router.post('/chat', requireAuth, async (req, res) => {
  try {
    const { conversationId, message } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }
    if (message.length > 8000) {
      return res.status(400).json({ error: 'Message too long. Please keep it under 8000 characters.' });
    }
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'Server missing GROQ_API_KEY. Add it to your .env file.' });
    }

    // Resolve or create conversation
    let convoId = conversationId;
    if (convoId) {
      const convo = db.getConversation(convoId, req.user.id);
      if (!convo) return res.status(404).json({ error: 'Conversation not found' });
    } else {
      const title = message.trim().slice(0, 60);
      const convo = db.createConversation(req.user.id, title);
      convoId = convo.id;
    }

    // Save user message
    db.addMessage(convoId, 'user', message);

    // Build full history
    const history = db.getMessages(convoId);

    // Inject live market data
    const liveContext = await buildLiveMarketContext(message);
    const apiMessages = history.map((m, idx) => {
      if (idx === history.length - 1 && m.role === 'user' && liveContext) {
        return { role: m.role, content: m.content + liveContext };
      }
      return { role: m.role, content: m.content };
    });

    // --- SSE headers ---
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send conversation ID and live flag immediately
    res.write(`data: ${JSON.stringify({ type: 'meta', conversationId: convoId, liveDataUsed: Boolean(liveContext) })}\n\n`);

    // Call Groq with stream: true
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        stream: true,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_NEW },
          ...apiMessages,
        ],
      }),
    });

    if (!groqRes.ok) {
      const errData = await groqRes.json();
      res.write(`data: ${JSON.stringify({ type: 'error', error: errData?.error?.message || 'Upstream API error' })}\n\n`);
      res.end();
      return;
    }

    let fullReply = '';
    const reader = groqRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            fullReply += delta;
            res.write(`data: ${JSON.stringify({ type: 'delta', delta })}\n\n`);
          }
        } catch (_) {}
      }
    }

    // Save full reply to DB
    db.addMessage(convoId, 'assistant', fullReply);

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

  } catch (err) {
    console.error('Chat endpoint error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Internal server error' })}\n\n`);
      res.end();
    }
  }
});

// ---------------------------------------------------------------------------
// AI Tool Endpoint — for internal features (Scanner, Debate, Sentiment)
// No conversation saving, higher token limit, raw JSON system prompt
// POST /api/ai-tool  { prompt }
// ---------------------------------------------------------------------------
router.post('/ai-tool', requireAuth, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'prompt is required' });
    }
    if (prompt.length > 6000) {
      return res.status(400).json({ error: 'Prompt too long.' });
    }
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'Server missing GROQ_API_KEY.' });
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        stream: false,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: `You are Apex AI — an expert trading analyst. 
When asked to return JSON, return ONLY valid raw JSON with no markdown, no code blocks, no explanation. 
Just the pure JSON object or array starting with { or [.`,
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!groqRes.ok) {
      const errData = await groqRes.json();
      return res.status(502).json({ error: errData?.error?.message || 'Upstream API error' });
    }

    const data = await groqRes.json();
    const text = data.choices?.[0]?.message?.content || '';
    res.json({ text });

  } catch (err) {
    console.error('AI tool endpoint error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
