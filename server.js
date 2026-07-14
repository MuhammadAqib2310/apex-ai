/**
 * server.js
 * Apex AI — Trading & Market Analysis Assistant
 * Production-style Express backend: JWT auth + SQLite persistence +
 * live market data (Twelve Data) + Anthropic-powered analysis.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const marketRoutes = require('./routes/market');
const journalRoutes = require('./routes/journal');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// CSP headers to allow TradingView iframes
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://s3.tradingview.com https://s.tradingview.com https://www.tradingview.com; " +
    "frame-src 'self' https://www.tradingview.com https://s.tradingview.com https://s3.tradingview.com; " +
    "connect-src 'self' https://api.groq.com https://api.coingecko.com https://open.er-api.com https://api.twelvedata.com https://www.tradingview.com; " +
    "img-src 'self' data: https:; " +
    "style-src 'self' 'unsafe-inline' https://s3.tradingview.com; " +
    "font-src 'self' data: https:;"
  );
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Basic rate limiting to protect the AI + market data endpoints from abuse
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again shortly.' },
});
app.use('/api/', apiLimiter);

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please wait a moment.' },
});
app.use('/api/chat', aiLimiter);
app.use('/api/ai-tool', aiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', chatRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/journal', journalRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
    marketDataConfigured: Boolean(process.env.TWELVE_DATA_API_KEY),
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Apex AI server running on http://localhost:${PORT}`);
  console.log(`🔑 Groq API key configured: ${Boolean(process.env.GROQ_API_KEY)}`);
  console.log(`📈 Twelve Data API key configured: ${Boolean(process.env.TWELVE_DATA_API_KEY)}`);
});
