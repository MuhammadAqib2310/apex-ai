/**
 * db.js
 * Lightweight, dependency-free persistence layer backed by a JSON file on disk.
 */

const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'app.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadState() {
  if (!fs.existsSync(DB_FILE)) {
    return { users: [], conversations: [], messages: [], nextIds: { user: 1, conversation: 1, message: 1 } };
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch (err) {
    console.error('Failed to parse app.json, starting fresh:', err.message);
    return { users: [], conversations: [], messages: [], nextIds: { user: 1, conversation: 1, message: 1 } };
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
};
