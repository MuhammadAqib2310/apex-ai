# Apex AI — Trading & Market Analysis Assistant (Production Build)

A real, full-stack trading analysis app:

- **Backend:** Node.js + Express + SQLite (better-sqlite3)
- **Auth:** JWT-based signup/login, bcrypt password hashing
- **Live market data:** Twelve Data API (Forex, Crypto, Stocks, Indices, Metals)
- **AI analysis:** Anthropic API with an elite trading-analyst system prompt (technicals, SMC/ICT, entries/targets, risk management)
- **Persistence:** every conversation & message is saved per user in SQLite
- **Frontend:** vanilla HTML/CSS/JS SPA — login/signup screen + chat app, dark glassmorphism UI
- **Rate limiting** on all API routes to control cost/abuse

## Project Structure
```
trading-ai/
├── server.js                # App entry point
├── db.js                    # SQLite schema + connection
├── middleware/
│   └── auth.js              # JWT verification middleware
├── routes/
│   ├── auth.js               # /api/auth/register, /login, /me
│   ├── chat.js                # /api/chat, /api/conversations...
│   └── market.js              # /api/market/quote, /symbols
├── utils/
│   └── marketData.js         # Symbol alias map + Twelve Data quote fetcher
├── public/
│   ├── index.html            # SPA shell (auth + chat screens)
│   ├── style.css
│   └── app.js                 # Frontend logic
├── data/                      # SQLite DB file created here at runtime
├── package.json
└── .env.example
```

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx     # https://console.anthropic.com/
   TWELVE_DATA_API_KEY=xxxxxxxxxxxxxxxx           # https://twelvedata.com/pricing (free tier: 800 req/day)
   JWT_SECRET=some-long-random-string
   ```

3. **Run**
   ```bash
   npm start
   ```
   Open `http://localhost:5000`

4. **Create an account** on the signup tab, then start chatting — try "BTC/USD" or "Gold" to see live-data-grounded analysis.

## How live data works

When you mention a known asset (BTC, EUR/USD, Gold, NASDAQ, etc.), the backend detects it (`utils/marketData.js`), fetches a live quote from Twelve Data, and injects it into the message sent to Claude as a `[LIVE MARKET DATA]` block. The model is instructed to base its analysis on those real numbers. If no live data key is configured or the asset isn't recognized, the AI falls back to its standard disclaimer about not having real-time prices.

To add more assets, add entries to `SYMBOL_MAP` in `utils/marketData.js`.

## Auth & data

- Passwords are hashed with bcrypt (never stored in plain text).
- JWTs expire after 7 days; the frontend stores the token in `localStorage`.
- Every conversation and message is scoped to the logged-in user (`user_id` foreign key) — users can only see their own history.
- SQLite database file lives at `data/app.db` (WAL mode). Back this up if you care about the data.

## Deploying

This is a standard Node/Express app — deploy it to any Node host (Render, Railway, a VPS, etc.):

1. Set the same environment variables (`ANTHROPIC_API_KEY`, `TWELVE_DATA_API_KEY`, `JWT_SECRET`, `PORT`) in your host's dashboard.
2. `npm install && npm start` as the build/start commands.
3. Because SQLite is a local file, use a host with persistent disk (Render/Railway support this) — don't use a purely ephemeral filesystem, or switch `db.js` to Postgres for larger scale.

## Notes / things to harden further for a public launch

- Add email verification and password-reset flows if opening to the public.
- Move from SQLite to PostgreSQL if you expect concurrent write-heavy traffic.
- Add stricter per-user rate limits (current limiter is per-IP, 30 req/min across all `/api/*`).
- Consider streaming responses (SSE) for a nicer "typing" experience on long analyses.
- Add HTTPS/reverse proxy (nginx/Caddy) in front of Node in production.

This tool is educational — it never guarantees outcomes and always reminds users to manage risk (1–2% per trade) and verify live prices before trading.
