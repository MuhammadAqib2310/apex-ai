/**
 * db.js
 * Persistence layer — uses /tmp on Vercel (serverless), local data/ folder otherwise.
 */

const path = require('path');
const fs   = require('fs');

// Vercel serverless: only /tmp is writable
const IS_VERCEL = process.env.VERCEL === '1';
const DATA_DIR  = IS_VERCEL
  ? '/tmp/apex-data'
  : path.join(__dirname, 'data');
const DB_FILE   = path.join(DATA_DIR, 'app.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadState() {
  if (!fs.existsSync(DB_FILE)) {
    return { users: [], conversations: [], messages: [], trades: [], alerts: [], nextIds: { user: 1, conversation: 1, message: 1, trade: 1, alert: 1 } };
  }
  try {
    const s = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    // Migrate: add missing arrays/ids for existing installs
    if (!s.trades)  s.trades  = [];
    if (!s.alerts)  s.alerts  = [];
    if (!s.nextIds.trade) s.nextIds.trade = 1;
    if (!s.nextIds.alert) s.nextIds.alert = 1;
    return s;
  } catch (err) {
    console.error('Failed to parse app.json, starting fresh:', err.message);
    return { users: [], conversations: [], messages: [], trades: [], alerts: [], nextIds: { user: 1, conversation: 1, message: 1, trade: 1, alert: 1 } };
  }
}

let state = loadState();

function persist() {
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

function nowISO() {
  return new Date().toISOString();
}

function getUserByEmail(email) {
  return state.users.find((u) => u.email === email) || null;
}

function getUserById(id) {
  return state.users.find((u) => u.id === Number(id)) || null;
}

function createUser({ name, email, passwordHash }) {
  const user = {
    id: state.nextIds.user++,
    name,
    email,
    password_hash: passwordHash,
    created_at: nowISO(),
  };
  state.users.push(user);
  persist();
  return user;
}

function updateUser(id, { name, email }) {
  const user = state.users.find((u) => u.id === Number(id));
  if (!user) return null;
  user.name  = name;
  user.email = email;
  persist();
  return user;
}

function updateUserPassword(id, passwordHash) {
  const user = state.users.find((u) => u.id === Number(id));
  if (!user) return;
  user.password_hash = passwordHash;
  persist();
}

function deleteUser(id) {
  const idNum = Number(id);
  state.users         = state.users.filter((u) => u.id !== idNum);
  // Delete all conversations and messages for this user
  const convIds = state.conversations.filter((c) => c.user_id === idNum).map((c) => c.id);
  state.conversations = state.conversations.filter((c) => c.user_id !== idNum);
  state.messages      = state.messages.filter((m) => !convIds.includes(m.conversation_id));
  persist();
}

function getConversationsByUser(userId) {
  return state.conversations
    .filter((c) => c.user_id === Number(userId))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(({ id, title, created_at }) => ({ id, title, created_at }));
}

function getConversation(id, userId) {
  return state.conversations.find((c) => c.id === Number(id) && c.user_id === Number(userId)) || null;
}

function createConversation(userId, title) {
  const convo = {
    id: state.nextIds.conversation++,
    user_id: Number(userId),
    title: title || 'New Conversation',
    created_at: nowISO(),
  };
  state.conversations.push(convo);
  persist();
  return convo;
}

function deleteConversation(id) {
  const idNum = Number(id);
  state.conversations = state.conversations.filter((c) => c.id !== idNum);
  state.messages = state.messages.filter((m) => m.conversation_id !== idNum);
  persist();
}

function renameConversation(id, title) {
  const convo = state.conversations.find((c) => c.id === Number(id));
  if (!convo) return;
  convo.title = title;
  persist();
}

function getMessages(conversationId) {
  return state.messages
    .filter((m) => m.conversation_id === Number(conversationId))
    .sort((a, b) => a.id - b.id)
    .map(({ id, role, content, created_at }) => ({ id, role, content, created_at }));
}

function addMessage(conversationId, role, content) {
  const message = {
    id: state.nextIds.message++,
    conversation_id: Number(conversationId),
    role,
    content,
    created_at: nowISO(),
  };
  state.messages.push(message);
  persist();
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
    return state.trades
      .filter(t => t.user_id === Number(userId))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },
  addTrade(userId, { symbol, direction, entryPrice, exitPrice, stopLoss, takeProfit, lotSize, result, pnl, notes, date }) {
    const trade = {
      id: state.nextIds.trade++,
      user_id: Number(userId),
      symbol: symbol || '',
      direction: direction || 'long',
      entryPrice: Number(entryPrice) || 0,
      exitPrice: exitPrice !== undefined ? Number(exitPrice) : null,
      stopLoss: stopLoss !== undefined ? Number(stopLoss) : null,
      takeProfit: takeProfit !== undefined ? Number(takeProfit) : null,
      lotSize: Number(lotSize) || 1,
      result: result || 'open',   // open | win | loss | breakeven
      pnl: pnl !== undefined ? Number(pnl) : null,
      notes: notes || '',
      date: date || nowISO(),
      created_at: nowISO(),
    };
    state.trades.push(trade);
    persist();
    return trade;
  },
  updateTrade(id, userId, updates) {
    const trade = state.trades.find(t => t.id === Number(id) && t.user_id === Number(userId));
    if (!trade) return null;
    Object.assign(trade, updates, { updated_at: nowISO() });
    persist();
    return trade;
  },
  deleteTrade(id, userId) {
    const before = state.trades.length;
    state.trades = state.trades.filter(t => !(t.id === Number(id) && t.user_id === Number(userId)));
    if (state.trades.length < before) { persist(); return true; }
    return false;
  },

  // ── Price Alerts ─────────────────────────────────────────
  getAlertsByUser(userId) {
    return state.alerts.filter(a => a.user_id === Number(userId));
  },
  addAlert(userId, { symbol, targetPrice, condition, note }) {
    const alert = {
      id: state.nextIds.alert++,
      user_id: Number(userId),
      symbol: symbol || '',
      targetPrice: Number(targetPrice),
      condition: condition || 'above',   // above | below
      note: note || '',
      triggered: false,
      created_at: nowISO(),
    };
    state.alerts.push(alert);
    persist();
    return alert;
  },
  triggerAlert(id) {
    const alert = state.alerts.find(a => a.id === Number(id));
    if (!alert) return null;
    alert.triggered = true;
    alert.triggered_at = nowISO();
    persist();
    return alert;
  },
  deleteAlert(id, userId) {
    const before = state.alerts.length;
    state.alerts = state.alerts.filter(a => !(a.id === Number(id) && a.user_id === Number(userId)));
    if (state.alerts.length < before) { persist(); return true; }
    return false;
  },
  getAllActiveAlerts() {
    return state.alerts.filter(a => !a.triggered);
  },
};
