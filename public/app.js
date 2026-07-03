/**
 * app.js — Apex AI Frontend
 * Auth + Chat + TradingView Charts + Live Ticker + Copy + Mobile Sidebar
 */

const API = '/api';
let token = localStorage.getItem('apex_token') || null;
let currentUser = JSON.parse(localStorage.getItem('apex_user') || 'null');
let currentConversationId = null;

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------
const authScreen   = document.getElementById('authScreen');
const appScreen    = document.getElementById('appScreen');
const tabLogin     = document.getElementById('tabLogin');
const tabSignup    = document.getElementById('tabSignup');
const loginForm    = document.getElementById('loginForm');
const signupForm   = document.getElementById('signupForm');
const loginError   = document.getElementById('loginError');
const signupError  = document.getElementById('signupError');
const userNameEl   = document.getElementById('userName');
const userAvatar   = document.getElementById('userAvatar');
const logoutBtn    = document.getElementById('logoutBtn');
const statusDot    = document.getElementById('statusDot');
const statusText   = document.getElementById('statusText');
const messagesEl   = document.getElementById('messages');
const inputEl      = document.getElementById('input');
const sendBtn      = document.getElementById('sendBtn');
const newChatBtn   = document.getElementById('newChatBtn');
const convListEl   = document.getElementById('conversationList');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const sidebar      = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const chartModal   = document.getElementById('chartModal');
const chartClose   = document.getElementById('chartClose');
const chartContainer = document.getElementById('chartContainer');
const chartModalTitle = document.getElementById('chartModalTitle');

// ---------------------------------------------------------------------------
// Password strength checker
// ---------------------------------------------------------------------------
const signupPwd = document.getElementById('signupPassword');
if (signupPwd) {
  signupPwd.addEventListener('input', () => {
    const val = signupPwd.value;
    const el = document.getElementById('pwStrength');
    const fill = document.getElementById('strengthFill');
    const txt = document.getElementById('strengthText');
    if (!val) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^a-zA-Z0-9]/.test(val)) score++;
    const colors = ['#ef4444','#f97316','#eab308','#22c55e','#22c55e'];
    const labels = ['Very Weak','Weak','Fair','Strong','Very Strong'];
    fill.style.width = (score * 20) + '%';
    fill.style.background = colors[score - 1] || '#ef4444';
    txt.textContent = labels[score - 1] || '';
    txt.style.color = colors[score - 1] || '#ef4444';
  });
}

// ---------------------------------------------------------------------------
// Toggle password visibility
// ---------------------------------------------------------------------------
function togglePass(id, btn) {
  const inp = document.getElementById(id);
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
  } else {
    inp.type = 'password';
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  }
}

// ---------------------------------------------------------------------------
// Auth tab switching
// ---------------------------------------------------------------------------
tabLogin.addEventListener('click', () => {
  tabLogin.classList.add('active');
  tabSignup.classList.remove('active');
  loginForm.style.display = 'flex';
  signupForm.style.display = 'none';
  hideError(loginError);
  hideError(signupError);
});
tabSignup.addEventListener('click', () => {
  tabSignup.classList.add('active');
  tabLogin.classList.remove('active');
  signupForm.style.display = 'flex';
  loginForm.style.display = 'none';
  hideError(loginError);
  hideError(signupError);
});

function showError(el, msg) {
  el.textContent = msg;
  el.classList.add('visible');
}
function hideError(el) {
  el.textContent = '';
  el.classList.remove('visible');
}
function setLoading(btn, loading) {
  const txt = btn.querySelector('.btn-text');
  const ldr = btn.querySelector('.btn-loader');
  btn.disabled = loading;
  if (txt) txt.style.display = loading ? 'none' : '';
  if (ldr) ldr.style.display = loading ? '' : 'none';
}

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(loginError);
  const btn = document.getElementById('loginBtn');
  setLoading(btn, true);
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  try {
    const res  = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    setSession(data.token, data.user);
    enterApp();
  } catch (err) {
    showError(loginError, err.message);
  } finally {
    setLoading(btn, false);
  }
});

// Signup
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(signupError);
  const btn      = document.getElementById('signupBtn');
  const name     = document.getElementById('signupName').value.trim();
  const email    = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  if (password.length < 6) {
    showError(signupError, 'Password must be at least 6 characters');
    return;
  }
  setLoading(btn, true);
  try {
    const res  = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Signup failed');
    setSession(data.token, data.user);
    enterApp();
  } catch (err) {
    showError(signupError, err.message);
  } finally {
    setLoading(btn, false);
  }
});

function setSession(t, user) {
  token = t; currentUser = user;
  localStorage.setItem('apex_token', t);
  localStorage.setItem('apex_user', JSON.stringify(user));
}
function clearSession() {
  token = null; currentUser = null; currentConversationId = null;
  localStorage.removeItem('apex_token');
  localStorage.removeItem('apex_user');
}

logoutBtn.addEventListener('click', () => {
  clearSession();
  appScreen.style.display = 'none';
  authScreen.style.display = 'flex';
});

// ---------------------------------------------------------------------------
// Mobile Sidebar
// ---------------------------------------------------------------------------
hamburgerBtn.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  sidebarOverlay.classList.toggle('active');
});
sidebarOverlay.addEventListener('click', closeSidebar);
function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('active');
}

// ---------------------------------------------------------------------------
// Enter App
// ---------------------------------------------------------------------------
function enterApp() {
  authScreen.style.display = 'none';
  appScreen.style.display  = 'flex';
  const name = currentUser?.name || 'User';
  userNameEl.textContent   = name;
  userAvatar.textContent   = name.charAt(0).toUpperCase();
  checkHealth();
  loadConversations();
  loadTicker();
}

async function checkHealth() {
  try {
    const res = await fetch(`${API}/health`);
    const d   = await res.json();
    if (d.groqConfigured) {
      statusDot.classList.remove('off');
      statusText.textContent = d.marketDataConfigured ? 'AI · Live Data' : 'AI Connected';
    } else {
      statusText.textContent = 'AI key missing';
    }
  } catch {
    statusText.textContent = 'Offline';
  }
}

// ---------------------------------------------------------------------------
// Live Price Ticker (uses /api/market/quote)
// ---------------------------------------------------------------------------
const TICKER_SYMBOLS = [
  { id: 't-btc',  symbol: 'BTC/USD', label: 'BTC/USD' },
  { id: 't-eth',  symbol: 'ETH/USD', label: 'ETH/USD' },
  { id: 't-eur',  symbol: 'EUR/USD', label: 'EUR/USD' },
  { id: 't-gold', symbol: 'XAU/USD', label: 'Gold'    },
];

async function loadTicker() {
  for (const item of TICKER_SYMBOLS) {
    fetchTickerPrice(item);
  }
  // Refresh every 60 seconds
  setInterval(() => { TICKER_SYMBOLS.forEach(fetchTickerPrice); }, 60000);
}

async function fetchTickerPrice({ id, symbol }) {
  try {
    const el = document.getElementById(id);
    if (!el) return;
    const res = await fetch(`${API}/market/quote?symbol=${encodeURIComponent(symbol)}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return;
    const data = await res.json();
    const q    = data.quote;
    if (!q || !q.price) return;
    const price   = parseFloat(q.price);
    const change  = parseFloat(q.percentChange || 0);
    const isUp    = change >= 0;
    el.textContent = formatPrice(symbol, price) + (change ? ` (${isUp ? '+' : ''}${change.toFixed(2)}%)` : '');
    el.className   = 't-price ' + (isUp ? 'up' : 'down');
  } catch (_) {}
}

function formatPrice(symbol, price) {
  if (symbol.includes('BTC') || symbol.includes('XAU')) return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (symbol.includes('ETH')) return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toFixed(5);
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------
async function loadConversations() {
  try {
    const res = await fetch(`${API}/conversations`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    renderConversations(data.conversations);
  } catch (_) {}
}

function renderConversations(list) {
  convListEl.innerHTML = '';
  if (!list.length) {
    convListEl.innerHTML = '<div class="empty-hint">No conversations yet</div>';
    return;
  }
  list.forEach((c) => {
    const item = document.createElement('div');
    item.className = 'convo-item' + (c.id === currentConversationId ? ' active' : '');

    const nameSpan = document.createElement('span');
    nameSpan.textContent = c.title || 'Untitled';
    nameSpan.title = 'Click to open · Double-click to rename';

    // Single click → open
    nameSpan.addEventListener('click', () => { openConversation(c.id); closeSidebar(); });

    // Double click → rename inline
    nameSpan.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      startRename(item, nameSpan, c);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'del';
    delBtn.title = 'Delete';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteConversation(c.id); });

    item.appendChild(nameSpan);
    item.appendChild(delBtn);
    convListEl.appendChild(item);
  });
}

function startRename(item, nameSpan, convo) {
  const oldName = convo.title || 'Untitled';
  const input   = document.createElement('input');
  input.type    = 'text';
  input.value   = oldName;
  input.className = 'rename-input';
  input.maxLength = 80;

  item.replaceChild(input, nameSpan);
  input.focus();
  input.select();

  async function commitRename() {
    const newName = input.value.trim() || oldName;
    // Restore span
    nameSpan.textContent = newName;
    item.replaceChild(nameSpan, input);
    if (newName !== oldName) {
      try {
        await fetch(`${API}/conversations/${convo.id}/rename`, {
          method: 'PATCH',
          headers: authHeaders(true),
          body: JSON.stringify({ title: newName }),
        });
        loadConversations();
      } catch (_) {}
    }
  }

  input.addEventListener('blur', commitRename);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  { input.blur(); }
    if (e.key === 'Escape') { input.value = oldName; input.blur(); }
  });
}

async function openConversation(id) {
  currentConversationId = id;
  messagesEl.innerHTML = '';
  try {
    const res  = await fetch(`${API}/conversations/${id}/messages`, { headers: authHeaders() });
    const data = await res.json();
    data.messages.forEach((m) => addMessage(m.role, m.content));
  } catch (_) {}
  loadConversations();
}

async function deleteConversation(id) {
  try {
    await fetch(`${API}/conversations/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (currentConversationId === id) { currentConversationId = null; resetToWelcome(); }
    loadConversations();
  } catch (_) {}
}

newChatBtn.addEventListener('click', () => {
  currentConversationId = null;
  resetToWelcome();
  loadConversations();
  closeSidebar();
});

function resetToWelcome() {
  messagesEl.innerHTML = `
    <div class="welcome" id="welcome">
      <div class="welcome-logo">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
          <polyline points="16 7 22 7 22 13"></polyline>
        </svg>
      </div>
      <h2>Welcome to Apex AI</h2>
      <p>Ask about any Forex pair, crypto, stock, commodity, or index. I break down trend, technicals, SMC/ICT structure, entries, and targets — with proper risk management.</p>
      <div class="welcome-chips">
        <button class="chip" onclick="setInput('Analyze BTC/USD')">₿ BTC Analysis</button>
        <button class="chip" onclick="setInput('EUR/USD trend today')">EUR/USD Trend</button>
        <button class="chip" onclick="setInput('Gold outlook this week')">🥇 Gold Outlook</button>
        <button class="chip" onclick="setInput('Best crypto to trade today')">🔥 Hot Cryptos</button>
      </div>
    </div>`;
}

function setInput(text) {
  inputEl.value = text;
  inputEl.focus();
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px';
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px';
});
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
sendBtn.addEventListener('click', sendMessage);

document.querySelectorAll('.quick-btn').forEach((btn) => {
  btn.addEventListener('click', () => { setInput(btn.dataset.prompt); sendMessage(); closeSidebar(); });
});

let isSending = false;

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text && attachedFiles.length === 0) return;
  if (isSending) return;

  isSending = true;
  sendBtn.disabled = true;

  // Build message with file context
  let fullMessage = text;
  const filesSnapshot = [...attachedFiles];
  attachedFiles = [];
  renderFilePreviews();

  // Add file context to message
  if (filesSnapshot.length > 0) {
    const fileContext = await buildFileContext(filesSnapshot);
    fullMessage = (text ? text + '\n\n' : '') + fileContext;
  }

  inputEl.value = '';
  inputEl.style.height = 'auto';

  // Show user message with file badges
  addMessageWithFiles(text || 'Analyze attached file(s)', filesSnapshot);

  // Create empty assistant bubble for streaming
  const { div: streamDiv, bubble: streamBubble } = createStreamingBubble();
  messagesEl.appendChild(streamDiv);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  let fullText = '';
  let metaData = null;

  try {
    const res = await fetch(`${API}/chat`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ conversationId: currentConversationId, message: fullMessage }),
    });

    if (!res.ok) {
      const data = await res.json();
      streamDiv.remove();
      addMessage('assistant', `⚠️ Error: ${data.error || 'Something went wrong.'}`);
      return;
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer    = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));

          if (json.type === 'meta') {
            metaData = json;
            currentConversationId = json.conversationId;
          } else if (json.type === 'delta') {
            fullText += json.delta;
            streamBubble.innerHTML = renderMarkdown(fullText) + '<span class="cursor-blink">▌</span>';
            messagesEl.scrollTop   = messagesEl.scrollHeight;
          } else if (json.type === 'done') {
            streamDiv.remove();
            addMessage('assistant', fullText, metaData?.liveDataUsed, text);
            playReplySound();
            loadConversations();
          } else if (json.type === 'error') {
            streamDiv.remove();
            addMessage('assistant', `⚠️ Error: ${json.error}`);
          }
        } catch (_) {}
      }
    }

  } catch (err) {
    streamDiv.remove();
    addMessage('assistant', '⚠️ Could not reach the server. Please check your connection.');
  } finally {
    isSending = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

function createStreamingBubble() {
  const div    = document.createElement('div');
  div.className = 'msg assistant';
  const bubble = document.createElement('div');
  bubble.className = 'bubble streaming';
  bubble.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
  div.appendChild(bubble);
  return { div, bubble };
}

function addMessage(role, text, liveDataUsed, originalQuery) {
  const welcome = document.getElementById('welcome');
  if (welcome) welcome.remove();

  const div    = document.createElement('div');
  div.className = 'msg ' + role;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  if (role === 'assistant') {
    let html = '';
    if (liveDataUsed) html += '<div class="live-badge"><span class="dot"></span> Live market data</div><br>';
    html += renderMarkdown(text);

    // Chart button — detect if a known symbol was mentioned
    const sym = detectChartSymbol(originalQuery || text);
    if (sym) {
      html += `<button class="chart-btn" onclick="openChart('${sym}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
        View ${sym} Chart
      </button>`;
    }

    bubble.innerHTML = html;

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.innerHTML = '✓ Copied';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
          copyBtn.classList.remove('copied');
        }, 2000);
      });
    });
    bubble.appendChild(copyBtn);
  } else {
    bubble.textContent = text;
  }

  div.appendChild(bubble);
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addTyping() {
  const div = document.createElement('div');
  div.className = 'msg assistant'; div.id = 'typingIndicator';
  div.innerHTML = '<div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>';
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function removeTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

// ---------------------------------------------------------------------------
// Profile Modal
// ---------------------------------------------------------------------------
const profileModal = document.getElementById('profileModal');
const profileClose = document.getElementById('profileClose');

function openProfile() {
  if (!currentUser) return;
  // Fill current values
  document.getElementById('profileName').value  = currentUser.name  || '';
  document.getElementById('profileEmail').value = currentUser.email || '';
  document.getElementById('profileNameDisplay').textContent  = currentUser.name  || 'User';
  document.getElementById('profileEmailDisplay').textContent = currentUser.email || '';
  document.getElementById('profileAvatarLg').textContent     = (currentUser.name || 'U').charAt(0).toUpperCase();

  // Fetch joined date
  fetch(`${API}/auth/me`, { headers: authHeaders() })
    .then(r => r.json())
    .then(d => {
      if (d.user?.created_at) {
        const date = new Date(d.user.created_at).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
        document.getElementById('profileJoined').textContent = 'Member since ' + date;
      }
    }).catch(() => {});

  // Reset forms
  hideError(document.getElementById('profileError'));
  hideError(document.getElementById('passwordError'));
  hideError(document.getElementById('deleteError'));
  document.getElementById('profileSuccess').style.display  = 'none';
  document.getElementById('passwordSuccess').style.display = 'none';
  document.getElementById('passwordForm').reset();
  document.getElementById('deleteForm').reset();
  switchPTab('info');

  profileModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

profileClose.addEventListener('click', closeProfile);
profileModal.addEventListener('click', (e) => { if (e.target === profileModal) closeProfile(); });
function closeProfile() {
  profileModal.style.display = 'none';
  document.body.style.overflow = '';
}

function switchPTab(tab) {
  ['info','password','delete'].forEach(t => {
    const btn     = document.getElementById('ptab' + t.charAt(0).toUpperCase() + t.slice(1));
    const content = document.getElementById('pTab'  + t.charAt(0).toUpperCase() + t.slice(1));
    if (btn)     btn.classList.toggle('active', t === tab);
    if (content) content.style.display = (t === tab) ? 'block' : 'none';
  });
}

// Save profile
document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('profileSaveBtn');
  const errEl = document.getElementById('profileError');
  const sucEl = document.getElementById('profileSuccess');
  hideError(errEl); sucEl.style.display = 'none';
  setLoading(btn, true);

  const name  = document.getElementById('profileName').value.trim();
  const email = document.getElementById('profileEmail').value.trim();

  try {
    const res  = await fetch(`${API}/auth/profile`, {
      method: 'PATCH',
      headers: authHeaders(true),
      body: JSON.stringify({ name, email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Update failed');

    // Update session
    setSession(data.token, data.user);
    userNameEl.textContent  = data.user.name;
    userAvatar.textContent  = data.user.name.charAt(0).toUpperCase();
    document.getElementById('profileNameDisplay').textContent  = data.user.name;
    document.getElementById('profileEmailDisplay').textContent = data.user.email;
    document.getElementById('profileAvatarLg').textContent     = data.user.name.charAt(0).toUpperCase();

    sucEl.textContent   = '✓ Profile updated successfully!';
    sucEl.style.display = 'block';
    sucEl.classList.add('visible');
    setTimeout(() => { sucEl.style.display = 'none'; }, 3000);
  } catch (err) {
    showError(errEl, err.message);
  } finally {
    setLoading(btn, false);
  }
});

// Change password
document.getElementById('passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn    = document.getElementById('passwordSaveBtn');
  const errEl  = document.getElementById('passwordError');
  const sucEl  = document.getElementById('passwordSuccess');
  hideError(errEl); sucEl.style.display = 'none';

  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword     = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (newPassword !== confirmPassword) {
    showError(errEl, 'New passwords do not match');
    return;
  }
  setLoading(btn, true);
  try {
    const res  = await fetch(`${API}/auth/password`, {
      method: 'PATCH',
      headers: authHeaders(true),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Password update failed');

    document.getElementById('passwordForm').reset();
    sucEl.textContent   = '✓ Password updated successfully!';
    sucEl.style.display = 'block';
    setTimeout(() => { sucEl.style.display = 'none'; }, 3000);
  } catch (err) {
    showError(errEl, err.message);
  } finally {
    setLoading(btn, false);
  }
});

// Delete account
document.getElementById('deleteForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn    = document.getElementById('deleteBtn');
  const errEl  = document.getElementById('deleteError');
  hideError(errEl);

  const confirmed = window.confirm('Are you sure? This will permanently delete your account and all data. This cannot be undone!');
  if (!confirmed) return;

  setLoading(btn, true);
  const password = document.getElementById('deletePassword').value;
  try {
    const res  = await fetch(`${API}/auth/account`, {
      method: 'DELETE',
      headers: authHeaders(true),
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Delete failed');

    closeProfile();
    clearSession();
    appScreen.style.display = 'none';
    authScreen.style.display = 'flex';
  } catch (err) {
    showError(errEl, err.message);
    setLoading(btn, false);
  }
});
// ---------------------------------------------------------------------------
// File Upload
// ---------------------------------------------------------------------------
const fileBtn         = document.getElementById('fileBtn');
const fileInput       = document.getElementById('fileInput');
const filePreviewArea = document.getElementById('filePreviewArea');
const filePreviewList = document.getElementById('filePreviewList');

let attachedFiles = []; // { file, dataUrl, type }

fileBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  const files = Array.from(fileInput.files);
  files.forEach(file => {
    if (attachedFiles.length >= 3) { alert('Max 3 files at a time.'); return; }
    const allowed = ['image/png','image/jpeg','image/gif','image/webp','application/pdf','text/csv','text/plain'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(csv|txt|pdf)$/i)) {
      alert(`${file.name}: Unsupported file type.`); return;
    }
    if (file.size > 5 * 1024 * 1024) { alert(`${file.name}: File too large (max 5MB).`); return; }

    const reader = new FileReader();
    reader.onload = (e) => {
      attachedFiles.push({ file, dataUrl: e.target.result, type: file.type, name: file.name });
      renderFilePreviews();
    };
    reader.readAsDataURL(file);
  });
  fileInput.value = '';
});

function renderFilePreviews() {
  filePreviewList.innerHTML = '';
  if (!attachedFiles.length) { filePreviewArea.style.display = 'none'; return; }
  filePreviewArea.style.display = 'block';
  attachedFiles.forEach((f, i) => {
    const chip = document.createElement('div');
    chip.className = 'file-chip';
    const icon = f.type.startsWith('image/') ? '🖼️' : f.type === 'application/pdf' ? '📄' : '📊';
    chip.innerHTML = `
      <span>${icon}</span>
      <span class="file-chip-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
      <button class="file-chip-remove" onclick="removeFile(${i})">✕</button>`;
    filePreviewList.appendChild(chip);
  });
}

function removeFile(i) {
  attachedFiles.splice(i, 1);
  renderFilePreviews();
}

// ---------------------------------------------------------------------------
// Voice Input (Web Speech API)
// ---------------------------------------------------------------------------
const voiceBtn  = document.getElementById('voiceBtn');
const voiceIcon = document.getElementById('voiceIcon');
let recognition = null;
let isRecording = false;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  voiceBtn.title = 'Voice not supported in this browser';
  voiceBtn.style.opacity = '0.4';
  voiceBtn.disabled = true;
} else {
  recognition = new SpeechRecognition();
  recognition.continuous      = false;
  recognition.interimResults  = true;
  recognition.lang            = 'en-US';
  recognition.maxAlternatives = 1;

  let interimText = '';
  let finalText   = '';

  recognition.onstart = () => {
    isRecording = true;
    voiceBtn.classList.add('recording');
    voiceBtn.title = 'Listening… click to stop';
    // Show pulsing status
    showVoiceStatus();
  };

  recognition.onresult = (e) => {
    interimText = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) { finalText += t + ' '; }
      else { interimText += t; }
    }
    inputEl.value = finalText + interimText;
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px';
  };

  recognition.onend = () => {
    isRecording = false;
    voiceBtn.classList.remove('recording');
    voiceBtn.title = 'Voice input';
    hideVoiceStatus();
    interimText = '';
    finalText   = '';
    inputEl.focus();
  };

  recognition.onerror = (e) => {
    isRecording = false;
    voiceBtn.classList.remove('recording');
    hideVoiceStatus();
    if (e.error === 'not-allowed') {
      alert('Microphone access denied. Please allow microphone in browser settings.');
    }
  };

  voiceBtn.addEventListener('click', () => {
    if (isRecording) {
      recognition.stop();
    } else {
      inputEl.value = '';
      recognition.start();
    }
  });
}

function showVoiceStatus() {
  let bar = document.getElementById('voiceStatusBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'voiceStatusBar';
    bar.className = 'voice-status';
    bar.innerHTML = '<div class="voice-dot"></div><span>Listening… speak now</span>';
    const inputBar = document.querySelector('.input-bar');
    inputBar.insertBefore(bar, inputBar.firstChild);
  }
}
function hideVoiceStatus() {
  const bar = document.getElementById('voiceStatusBar');
  if (bar) bar.remove();
}

// Build text context from attached files
async function buildFileContext(files) {
  const parts = [];
  for (const f of files) {
    if (f.type.startsWith('image/')) {
      parts.push(`[USER ATTACHED IMAGE: ${f.name} — Please analyze this chart/image if relevant to trading]`);
    } else if (f.type === 'application/pdf') {
      parts.push(`[USER ATTACHED PDF: ${f.name} — Analyze contents if trading/financial related]`);
    } else if (f.type === 'text/csv' || f.name.endsWith('.csv')) {
      const text = await readFileAsText(f.file);
      const preview = text.slice(0, 1500);
      parts.push(`[CSV DATA from ${f.name}]:\n${preview}${text.length > 1500 ? '\n...(truncated)' : ''}`);
    } else if (f.type === 'text/plain' || f.name.endsWith('.txt')) {
      const text = await readFileAsText(f.file);
      const preview = text.slice(0, 1500);
      parts.push(`[TEXT FILE ${f.name}]:\n${preview}${text.length > 1500 ? '\n...(truncated)' : ''}`);
    }
  }
  return parts.join('\n\n');
}

function readFileAsText(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload  = (e) => resolve(e.target.result || '');
    r.onerror = () => resolve('');
    r.readAsText(file);
  });
}

function addMessageWithFiles(text, files) {
  const welcome = document.getElementById('welcome');
  if (welcome) welcome.remove();

  const div    = document.createElement('div');
  div.className = 'msg user';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  files.forEach(f => {
    if (f.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = f.dataUrl;
      img.className = 'msg-image';
      bubble.appendChild(img);
      bubble.appendChild(document.createElement('br'));
    }
    const badge = document.createElement('div');
    badge.className = 'msg-file-badge';
    const icon = f.type.startsWith('image/') ? '🖼️' : f.type === 'application/pdf' ? '📄' : '📊';
    badge.innerHTML = `${icon} <span>${escapeHtml(f.name)}</span>`;
    bubble.appendChild(badge);
  });

  if (text) {
    const t = document.createElement('div');
    t.style.marginTop = files.length ? '8px' : '0';
    t.textContent = text;
    bubble.appendChild(t);
  }

  div.appendChild(bubble);
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ---------------------------------------------------------------------------
// TradingView Chart Modal
// ---------------------------------------------------------------------------
const CHART_MAP = {
  'btc': 'BINANCE:BTCUSDT', 'btcusd': 'BINANCE:BTCUSDT', 'btc/usd': 'BINANCE:BTCUSDT',
  'eth': 'BINANCE:ETHUSDT', 'ethusd': 'BINANCE:ETHUSDT', 'eth/usd': 'BINANCE:ETHUSDT',
  'sol': 'BINANCE:SOLUSDT', 'solusd': 'BINANCE:SOLUSDT', 'sol/usd': 'BINANCE:SOLUSDT',
  'xrp': 'BINANCE:XRPUSDT', 'bnb': 'BINANCE:BNBUSDT', 'doge': 'BINANCE:DOGEUSDT',
  'eurusd': 'FX:EURUSD', 'eur/usd': 'FX:EURUSD',
  'gbpusd': 'FX:GBPUSD', 'gbp/usd': 'FX:GBPUSD',
  'usdjpy': 'FX:USDJPY', 'usd/jpy': 'FX:USDJPY',
  'gold': 'TVC:GOLD', 'xauusd': 'TVC:GOLD', 'xau/usd': 'TVC:GOLD',
  'silver': 'TVC:SILVER', 'oil': 'TVC:USOIL',
  'nasdaq': 'NASDAQ:NDX', 'nas100': 'NASDAQ:NDX',
  'us30': 'DJ:DJI', 'dow': 'DJ:DJI',
  'sp500': 'SP:SPX', 's&p500': 'SP:SPX',
};

function detectChartSymbol(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [alias] of Object.entries(CHART_MAP)) {
    if (lower.includes(alias)) return alias.toUpperCase().replace('/', '');
  }
  return null;
}

function openChart(rawAlias) {
  const key = rawAlias.toLowerCase().replace('usd', '/usd').replace('eur/usd','eurusd').replace('/usd','usd');
  // Try a few key variants
  const tvSymbol = CHART_MAP[rawAlias.toLowerCase()] ||
                   CHART_MAP[rawAlias.toLowerCase().replace('usd','/usd')] ||
                   CHART_MAP[rawAlias.toLowerCase() + 'usd'] ||
                   'BINANCE:BTCUSDT';
  chartModalTitle.textContent = rawAlias + ' — Live Chart';
  chartContainer.innerHTML = '';
  const script = document.createElement('script');
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  script.async = true;
  script.innerHTML = JSON.stringify({
    "autosize": true,
    "symbol": tvSymbol,
    "interval": "1H",
    "timezone": "Etc/UTC",
    "theme": "dark",
    "style": "1",
    "locale": "en",
    "backgroundColor": "#0e0c1a",
    "gridColor": "rgba(255,255,255,0.04)",
    "hide_top_toolbar": false,
    "hide_legend": false,
    "save_image": false,
    "calendar": false,
    "hide_volume": false,
    "support_host": "https://www.tradingview.com"
  });
  const wrap = document.createElement('div');
  wrap.className = 'tradingview-widget-container';
  wrap.style.height = '480px';
  wrap.style.width = '100%';
  const inner = document.createElement('div');
  inner.className = 'tradingview-widget-container__widget';
  inner.style.height = '100%';
  wrap.appendChild(inner);
  wrap.appendChild(script);
  chartContainer.appendChild(wrap);
  chartModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

chartClose.addEventListener('click', () => {
  chartModal.style.display = 'none';
  chartContainer.innerHTML = '';
  document.body.style.overflow = '';
});
chartModal.addEventListener('click', (e) => {
  if (e.target === chartModal) {
    chartModal.style.display = 'none';
    chartContainer.innerHTML = '';
    document.body.style.overflow = '';
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function authHeaders(json) {
  const h = { Authorization: `Bearer ${token}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderMarkdown(text) {
  let html = escapeHtml(text);

  // Tables
  html = html.replace(/((?:^\|.*\|$\n?)+)/gm, (block) => {
    const rows = block.trim().split('\n').filter(r => r.trim().length);
    if (rows.length < 2) return block;
    const isSep = /^\|?\s*[-:]+\s*(\|\s*[-:]+\s*)+\|?$/.test(rows[1]);
    if (!isSep) return block;
    const toCells = r => r.trim().replace(/^\||\|$/g,'').split('|').map(c => c.trim());
    const head = toCells(rows[0]);
    const body = rows.slice(2).map(toCells);
    let t = '<table><thead><tr>' + head.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';
    body.forEach(r => { t += '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>'; });
    return t + '</tbody></table>';
  });

  // Headings → bold with size
  html = html
    .replace(/^### (.*$)/gm, '<p><strong style="font-size:14.5px;color:#c4b5fd">$1</strong></p>')
    .replace(/^## (.*$)/gm,  '<p><strong style="font-size:15.5px;color:#a78bfa">$1</strong></p>')
    .replace(/^# (.*$)/gm,   '<p><strong style="font-size:17px;color:#a78bfa">$1</strong></p>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^[-•] (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>');

  return `<p>${html}</p>`;
}

// ---------------------------------------------------------------------------
// Theme Toggle (Dark / Light)
// ---------------------------------------------------------------------------
const themeBtn       = document.getElementById('themeBtn');
const themeIconDark  = document.getElementById('themeIconDark');
const themeIconLight = document.getElementById('themeIconLight');

function applyTheme(mode) {
  if (mode === 'light') {
    document.body.classList.add('light');
    themeIconDark.style.display  = 'none';
    themeIconLight.style.display = '';
  } else {
    document.body.classList.remove('light');
    themeIconDark.style.display  = '';
    themeIconLight.style.display = 'none';
  }
  localStorage.setItem('apex_theme', mode);
}

themeBtn.addEventListener('click', () => {
  const current = localStorage.getItem('apex_theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// Apply saved theme on load
applyTheme(localStorage.getItem('apex_theme') || 'dark');

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
if (token && currentUser) {
  enterApp();
} else {
  authScreen.style.display = 'flex';
}

// ---------------------------------------------------------------------------
// Keyboard Shortcuts
// ---------------------------------------------------------------------------
document.addEventListener('keydown', (e) => {
  // Only when app is visible
  if (appScreen.style.display === 'none') return;

  // Ctrl+N = New Chat
  if (e.ctrlKey && e.key === 'n') {
    e.preventDefault();
    currentConversationId = null;
    resetToWelcome();
    loadConversations();
    inputEl.focus();
  }

  // Ctrl+/ = Focus input
  if (e.ctrlKey && e.key === '/') {
    e.preventDefault();
    inputEl.focus();
  }

  // Escape = close any open modal
  if (e.key === 'Escape') {
    if (chartModal.style.display  !== 'none') { chartModal.style.display = 'none'; chartContainer.innerHTML = ''; document.body.style.overflow = ''; }
    if (profileModal.style.display !== 'none') closeProfile();
  }
});

// ---------------------------------------------------------------------------
// Sound on AI Reply
// ---------------------------------------------------------------------------
function playReplySound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// Market Dashboard
// ---------------------------------------------------------------------------
const dashboardModal = document.getElementById('dashboardModal');
const dashboardClose = document.getElementById('dashboardClose');
const dashboardGrid  = document.getElementById('dashboardGrid');
const dashboardBtn   = document.getElementById('dashboardBtn');

const DASHBOARD_SYMBOLS = [
  { symbol: 'BTC/USD',  name: 'Bitcoin',    icon: '₿'  },
  { symbol: 'ETH/USD',  name: 'Ethereum',   icon: '⟠'  },
  { symbol: 'SOL/USD',  name: 'Solana',     icon: '◎'  },
  { symbol: 'XRP/USD',  name: 'XRP/Ripple', icon: '✕'  },
  { symbol: 'EUR/USD',  name: 'Euro/Dollar',icon: '🇪🇺' },
  { symbol: 'GBP/USD',  name: 'Pound/Dollar',icon:'🇬🇧' },
  { symbol: 'USD/JPY',  name: 'Dollar/Yen', icon: '🇯🇵' },
  { symbol: 'XAU/USD',  name: 'Gold',       icon: '🥇' },
  { symbol: 'XAG/USD',  name: 'Silver',     icon: '🥈' },
  { symbol: 'NDX',      name: 'NASDAQ 100', icon: '📊' },
  { symbol: 'DJI',      name: 'Dow Jones',  icon: '🏛️' },
  { symbol: 'BNB/USD',  name: 'BNB',        icon: '🔶' },
];

dashboardBtn.addEventListener('click', () => { openDashboard(); closeSidebar(); });
dashboardClose.addEventListener('click', () => { dashboardModal.style.display = 'none'; document.body.style.overflow = ''; });
dashboardModal.addEventListener('click', (e) => { if (e.target === dashboardModal) { dashboardModal.style.display = 'none'; document.body.style.overflow = ''; } });

async function openDashboard() {
  dashboardModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  dashboardGrid.innerHTML = '<div class="dash-loading">⏳ Loading live prices…</div>';

  const results = await Promise.all(
    DASHBOARD_SYMBOLS.map(async (item) => {
      try {
        const res = await fetch(`${API}/market/quote?symbol=${encodeURIComponent(item.symbol)}`, { headers: authHeaders() });
        if (!res.ok) return { ...item, price: null };
        const data = await res.json();
        return { ...item, ...data.quote };
      } catch (_) {
        return { ...item, price: null };
      }
    })
  );

  dashboardGrid.innerHTML = '';
  results.forEach((q) => {
    const card = document.createElement('div');
    card.className = 'dash-card';

    const price   = q.price   ? parseFloat(q.price)   : null;
    const change  = q.percentChange ? parseFloat(q.percentChange) : 0;
    const isUp    = change >= 0;
    const priceStr = price
      ? (q.symbol?.includes('USD') && !q.symbol?.startsWith('USD')
          ? '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 })
          : price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 }))
      : '—';

    card.innerHTML = `
      <div class="dash-card-symbol">${q.icon} ${q.symbol}</div>
      <div class="dash-card-name">${q.name}</div>
      <div class="dash-card-price ${price ? (isUp ? 'up' : 'down') : ''}">${priceStr}</div>
      ${price ? `<div class="dash-card-change ${isUp ? 'up' : 'down'}">${isUp ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}% today</div>` : '<div class="dash-card-change" style="color:var(--text-dim)">No API key</div>'}
    `;

    // Click card → ask AI about it
    card.addEventListener('click', () => {
      dashboardModal.style.display = 'none';
      document.body.style.overflow = '';
      setInput(`Analyze ${q.symbol}`);
      inputEl.focus();
    });

    dashboardGrid.appendChild(card);
  });
}
