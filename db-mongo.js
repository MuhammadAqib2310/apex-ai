/**
 * db-mongo.js
 * MongoDB persistence layer using Mongoose.
 * Used when MONGODB_URI env var is set, otherwise falls back to db.js (JSON file).
 */

const mongoose = require('mongoose');

let connected = false;

async function connect() {
  if (connected) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  connected = true;
  console.log('✅ MongoDB connected');
}

// ── Schemas ───────────────────────────────────────────────────────────────

const UserSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  email:         { type: String, required: true, unique: true, lowercase: true },
  password_hash: { type: String, required: true },
  created_at:    { type: Date, default: Date.now },
});

const ConversationSchema = new mongoose.Schema({
  user_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:      { type: String, default: 'New Conversation' },
  created_at: { type: Date, default: Date.now },
});

const MessageSchema = new mongoose.Schema({
  conversation_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  role:            { type: String, enum: ['user', 'assistant'], required: true },
  content:         { type: String, required: true },
  created_at:      { type: Date, default: Date.now },
});

const TradeSchema = new mongoose.Schema({
  user_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  symbol:     { type: String, default: '' },
  direction:  { type: String, default: 'long' },
  entryPrice: { type: Number, default: 0 },
  exitPrice:  { type: Number, default: null },
  stopLoss:   { type: Number, default: null },
  takeProfit: { type: Number, default: null },
  lotSize:    { type: Number, default: 1 },
  result:     { type: String, default: 'open' },
  pnl:        { type: Number, default: null },
  notes:      { type: String, default: '' },
  date:       { type: Date, default: Date.now },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: null },
});

const AlertSchema = new mongoose.Schema({
  user_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  symbol:       { type: String, default: '' },
  targetPrice:  { type: Number, required: true },
  condition:    { type: String, default: 'above' },
  note:         { type: String, default: '' },
  triggered:    { type: Boolean, default: false },
  triggered_at: { type: Date, default: null },
  created_at:   { type: Date, default: Date.now },
});

const User         = mongoose.models.User         || mongoose.model('User', UserSchema);
const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', ConversationSchema);
const Message      = mongoose.models.Message      || mongoose.model('Message', MessageSchema);
const Trade        = mongoose.models.Trade        || mongoose.model('Trade', TradeSchema);
const Alert        = mongoose.models.Alert        || mongoose.model('Alert', AlertSchema);

// ── Helper: convert Mongoose doc to plain object ──────────────────────────
function plain(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : doc;
  if (o._id) { o.id = o._id.toString(); delete o._id; }
  if (o.__v !== undefined) delete o.__v;
  return o;
}

// ── User functions ────────────────────────────────────────────────────────
async function getUserByEmail(email) {
  await connect();
  const doc = await User.findOne({ email: email.toLowerCase() });
  return plain(doc);
}

async function getUserById(id) {
  await connect();
  try {
    const doc = await User.findById(id);
    return plain(doc);
  } catch { return null; }
}

async function createUser({ name, email, passwordHash }) {
  await connect();
  const doc = await User.create({ name, email: email.toLowerCase(), password_hash: passwordHash });
  return plain(doc);
}

async function updateUser(id, { name, email }) {
  await connect();
  const doc = await User.findByIdAndUpdate(id, { name, email: email.toLowerCase() }, { new: true });
  return plain(doc);
}

async function updateUserPassword(id, passwordHash) {
  await connect();
  await User.findByIdAndUpdate(id, { password_hash: passwordHash });
}

async function deleteUser(id) {
  await connect();
  const convIds = (await Conversation.find({ user_id: id }).select('_id')).map(c => c._id);
  await Message.deleteMany({ conversation_id: { $in: convIds } });
  await Conversation.deleteMany({ user_id: id });
  await Trade.deleteMany({ user_id: id });
  await Alert.deleteMany({ user_id: id });
  await User.findByIdAndDelete(id);
}

// ── Conversation functions ────────────────────────────────────────────────
async function getConversationsByUser(userId) {
  await connect();
  const docs = await Conversation.find({ user_id: userId }).sort({ created_at: -1 });
  return docs.map(d => { const o = plain(d); return { id: o.id, title: o.title, created_at: o.created_at }; });
}

async function getConversation(id, userId) {
  await connect();
  try {
    const doc = await Conversation.findOne({ _id: id, user_id: userId });
    return plain(doc);
  } catch { return null; }
}

async function createConversation(userId, title) {
  await connect();
  const doc = await Conversation.create({ user_id: userId, title: title || 'New Conversation' });
  return plain(doc);
}

async function deleteConversation(id) {
  await connect();
  await Message.deleteMany({ conversation_id: id });
  await Conversation.findByIdAndDelete(id);
}

async function renameConversation(id, title) {
  await connect();
  await Conversation.findByIdAndUpdate(id, { title });
}

// ── Message functions ─────────────────────────────────────────────────────
async function getMessages(conversationId) {
  await connect();
  const docs = await Message.find({ conversation_id: conversationId }).sort({ created_at: 1 });
  return docs.map(d => { const o = plain(d); return { id: o.id, role: o.role, content: o.content, created_at: o.created_at }; });
}

async function addMessage(conversationId, role, content) {
  await connect();
  const doc = await Message.create({ conversation_id: conversationId, role, content });
  return plain(doc);
}

// ── Trade functions ───────────────────────────────────────────────────────
async function getTradesByUser(userId) {
  await connect();
  const docs = await Trade.find({ user_id: userId }).sort({ created_at: -1 });
  return docs.map(plain);
}

async function addTrade(userId, data) {
  await connect();
  const doc = await Trade.create({ user_id: userId, ...data });
  return plain(doc);
}

async function updateTrade(id, userId, updates) {
  await connect();
  try {
    const doc = await Trade.findOneAndUpdate(
      { _id: id, user_id: userId },
      { ...updates, updated_at: new Date() },
      { new: true }
    );
    return plain(doc);
  } catch { return null; }
}

async function deleteTrade(id, userId) {
  await connect();
  try {
    const res = await Trade.deleteOne({ _id: id, user_id: userId });
    return res.deletedCount > 0;
  } catch { return false; }
}

// ── Alert functions ───────────────────────────────────────────────────────
async function getAlertsByUser(userId) {
  await connect();
  const docs = await Alert.find({ user_id: userId });
  return docs.map(plain);
}

async function addAlert(userId, data) {
  await connect();
  const doc = await Alert.create({ user_id: userId, ...data });
  return plain(doc);
}

async function triggerAlert(id) {
  await connect();
  try {
    const doc = await Alert.findByIdAndUpdate(id, { triggered: true, triggered_at: new Date() }, { new: true });
    return plain(doc);
  } catch { return null; }
}

async function deleteAlert(id, userId) {
  await connect();
  try {
    const res = await Alert.deleteOne({ _id: id, user_id: userId });
    return res.deletedCount > 0;
  } catch { return false; }
}

async function getAllActiveAlerts() {
  await connect();
  const docs = await Alert.find({ triggered: false });
  return docs.map(plain);
}

module.exports = {
  getUserByEmail, getUserById, createUser, updateUser, updateUserPassword, deleteUser,
  getConversationsByUser, getConversation, createConversation, deleteConversation, renameConversation,
  getMessages, addMessage,
  getTradesByUser, addTrade, updateTrade, deleteTrade,
  getAlertsByUser, addAlert, triggerAlert, deleteAlert, getAllActiveAlerts,
};
