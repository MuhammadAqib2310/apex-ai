/**
 * db.js
 * Smart persistence layer:
 * - If MONGODB_URI is set → uses MongoDB Atlas (persistent, production-ready)
 * - Otherwise → falls back to JSON file (local dev / Vercel tmp)
 */

// ── MongoDB mode ──────────────────────────────────────────────────────────
if (process.env.MONGODB_URI) {
  console.log('🍃 Using MongoDB Atlas for persistence');
  module.exports = require('./db-mongo');
  return;
}

console.log('📁 Using JSON file for persistence (set MONGODB_URI for persistent storage)');

const path = require('path');
const fs   = require('fs');

// Vercel serverless: only /tmp is writable
const IS_VERCEL = process.env.VERCEL === '1';
const DATA_DIR  = IS_VERCEL
  ? '/tmp/apex-data'
  : path.join(__dirname, 'data');
const DB_FILE   = path.join(DATA_DIR, 'app.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function emptyState() {
  return { users: [], conversations: [], messages: [], trades: [], alerts: [], nextIds: { user: 1, conversation: 1, message: 1, trade: 1, alert: 1 } };
}

// Always read fresh from disk (important for Vercel serverless)
function loadState() {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) return emptyState();
  try {
    const s = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    if (!s.trades)  s.trades  = [];
    if (!s.alerts)  s.alerts  = [];
    if (!s.nextIds.trade) s.nextIds.trade = 1;
    if (!s.nextIds.alert) s.nextIds.alert = 1;
    return s;
  } catch (err) {
    console.error('Failed to parse app.json, starting fresh:', err.message);
    return emptyState();
  }
}

function persist(state) {
  ensureDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

function nowISO() {
  return new Date().toISOString();
}

function getUserByEmail(email) {
  const state = loadState();
  return state.users.find((u) => u.email === email) || null;
}

function getUserById(id) {
  const state = loadState();
  return state.users.find((u) => u.id === Number(id)) || null;
}

function createUser({ name, email, passwordHash }) {
  const state = loadState();
  const user = {
    id: state.nextIds.user++,
    name,
    email,
    password_hash: passwordHash,
    created_at: nowISO(),
  };
  state.users.push(user);
  persist(state);
  return user;
}

function updateUser(id, { name, email }) {
  const state = loadState();
  const user = state.users.find((u) => u.id === Number(id));
  if (!user) return null;
  user.name  = name;
  user.email = email;
  persist(state);
  return user;
}

function updateUserPassword(id, passwordHash) {
  const state = loadState();
  const user = state.users.find((u) => u.id === Number(id));
  if (!user) return;
  user.password_hash = passwordHash;
  persist(state);
}

function deleteUser(id) {
  const state = loadState();
  const idNum = Number(id);
  const convIds = state.conversations.filter((c) => c.user_id === idNum).map((c) => c.id);
  state.users         = state.users.filter((u) => u.id !== idNum);
  state.conversations = state.conversations.filter((c) => c.user_id !== idNum);
  state.messages      = state.messages.filter((m) => !convIds.includes(m.conversation_id));
  persist(state);
}

function getConversationsByUser(userId) {
  const state = loadState();
  return state.conversations
    .filter((c) => c.user_id === Number(userId))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(({ id, title, created_at }) => ({ id, title, created_at }));
}

function getConversation(id, userId) {
  const state = loadState();
  return state.conversations.find((c) => c.id === Number(id) && c.user_id === Number(userId)) || null;
}

function createConversation(userId, title) {
  const state = loadState();
  const convo = {
    id: state.nextIds.conversation++,
    user_id: Number(userId),
    title: title || 'New Conversation',
    created_at: nowISO(),
  };
  state.conversations.push(convo);
  persist(state);
  return convo;
}

function deleteConversation(id) {
  const state = loadState();
  const idNum = Number(id);
  state.conversations = state.conversations.filter((c) => c.id !== idNum);
  state.messages = state.messages.filter((m) => m.conversation_id !== idNum);
  persist(state);
}

function renameConversation(id, title) {
  const state = loadState();
  const convo = state.conversations.find((c) => c.id === Number(id));
  if (!convo) return;
  convo.title = title;
  persist(state);
}

function getMessages(conversationId) {
  const state = loadState();
  return state.messages
    .filter((m) => m.conversation_id === Number(conversationId))
    .sort((a, b) => a.id - b.id)
    .map(({ id, role, content, created_at }) => ({ id, role, content, created_at }));
}

function addMessage(conversationId, role, content) {
  const state = loadState();
  const message = {
    id: state.nextIds.message++,
    conversation_id: Number(conversationId),
    role,
    content,
    created_at: nowISO(),
  };
  state.messages.push(message);
  persist(state);
  return message;
}

module.exports = {
  getUserByEmail,
  getUserById,
  createUser,
  updateUser,
  updateUserPassword,
  deleteUser,
  getConversationsByUser,
  getConversation,
  createConversation,
  deleteConversation,
  renameConversation,
  getMessages,
  addMessage,

  // ── Trading Journal ──────────────────────────────────────
  getTradesByUser(userId) {
    const state = loadState();
    return state.trades
      .filter(t => t.user_id === Number(userId))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },
  addTrade(userId, { symbol, direction, entryPrice, exitPrice, stopLoss, takeProfit, lotSize, result, pnl, notes, date }) {
    const state = loadState();
    const trade = {
      id: state.nextIds.trade++,
      user_id: Number(userId),
      symbol: symbol || '',
      direction: direction || 'long',
      entryPrice: Number(entryPrice) || 0,
      exitPrice: exitPrice !== undefined && exitPrice !== null && exitPrice !== '' ? Number(exitPrice) : null,
      stopLoss: stopLoss !== undefined && stopLoss !== null && stopLoss !== '' ? Number(stopLoss) : null,
      takeProfit: takeProfit !== undefined && takeProfit !== null && takeProfit !== '' ? Number(takeProfit) : null,
      lotSize: Number(lotSize) || 1,
      result: result || 'open',
      pnl: pnl !== undefined && pnl !== null && pnl !== '' ? Number(pnl) : null,
      notes: notes || '',
      date: date || nowISO(),
      created_at: nowISO(),
    };
    state.trades.push(trade);
    persist(state);
    return trade;
  },
  updateTrade(id, userId, updates) {
    const state = loadState();
    const trade = state.trades.find(t => t.id === Number(id) && t.user_id === Number(userId));
    if (!trade) return null;
    Object.assign(trade, updates, { updated_at: nowISO() });
    persist(state);
    return trade;
  },
  deleteTrade(id, userId) {
    const state = loadState();
    const before = state.trades.length;
    state.trades = state.trades.filter(t => !(t.id === Number(id) && t.user_id === Number(userId)));
    if (state.trades.length < before) { persist(state); return true; }
    return false;
  },

  // ── Price Alerts ─────────────────────────────────────────
  getAlertsByUser(userId) {
    const state = loadState();
    return state.alerts.filter(a => a.user_id === Number(userId));
  },
  addAlert(userId, { symbol, targetPrice, condition, note }) {
    const state = loadState();
    const alert = {
      id: state.nextIds.alert++,
      user_id: Number(userId),
      symbol: symbol || '',
      targetPrice: Number(targetPrice),
      condition: condition || 'above',
      note: note || '',
      triggered: false,
      created_at: nowISO(),
    };
    state.alerts.push(alert);
    persist(state);
    return alert;
  },
  triggerAlert(id) {
    const state = loadState();
    const alert = state.alerts.find(a => a.id === Number(id));
    if (!alert) return null;
    alert.triggered = true;
    alert.triggered_at = nowISO();
    persist(state);
    return alert;
  },
  deleteAlert(id, userId) {
    const state = loadState();
    const before = state.alerts.length;
    state.alerts = state.alerts.filter(a => !(a.id === Number(id) && a.user_id === Number(userId)));
    if (state.alerts.length < before) { persist(state); return true; }
    return false;
  },
  getAllActiveAlerts() {
    const state = loadState();
    return state.alerts.filter(a => !a.triggered);
  },
};
