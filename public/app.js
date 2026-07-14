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
  // Hide password strength bar when switching to login
  const pwStr = document.getElementById('pwStrength');
  if (pwStr) pwStr.style.display = 'none';
  document.getElementById('signupPassword').value = '';
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
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Server error. Please try again.');
    }
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
    // Check content type before parsing JSON
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Server error. Please try again.');
    }
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
  requestNotificationPermission();
  // Alert polling starts after a short delay so all vars are initialized
  setTimeout(() => startAlertPolling(), 500);
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
  // Only load ticker if market data is available
  try {
    const h = await fetch(`${API}/health`);
    const d = await h.json();
    if (!d.marketDataConfigured) {
      TICKER_SYMBOLS.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) { el.textContent = 'N/A'; el.style.opacity = '0.4'; }
      });
      return;
    }
  } catch (_) { return; }

  // Fetch sequentially with delay to avoid rate limit
  for (const item of TICKER_SYMBOLS) {
    await fetchTickerPrice(item);
    await new Promise(r => setTimeout(r, 300));
  }
  // Refresh every 90 seconds
  setInterval(async () => {
    for (const item of TICKER_SYMBOLS) {
      await fetchTickerPrice(item);
      await new Promise(r => setTimeout(r, 300));
    }
  }, 90000);
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
    convListEl.innerHTML = '<div class="empty-hint" style="text-align:center;padding:16px 4px;"><div style="font-size:22px;margin-bottom:6px;">💬</div><div>No conversations yet</div><div style="font-size:11px;margin-top:3px;color:var(--text-dim)">Ask anything to start</div></div>';
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

  // Show typing indicator
  const { div: streamDiv, bubble: streamBubble } = createStreamingBubble();
  messagesEl.appendChild(streamDiv);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    const res = await fetch(`${API}/chat`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ conversationId: currentConversationId, message: fullMessage }),
    });

    if (!res.ok) {
      let errMsg = 'Something went wrong.';
      try { const d = await res.json(); errMsg = d.error || errMsg; } catch(_) {}
      streamDiv.remove();
      addMessage('assistant', `⚠️ Error: ${errMsg}`);
      return;
    }

    const data = await res.json();

    streamDiv.remove();

    if (data.reply) {
      currentConversationId = data.conversationId;
      addMessage('assistant', data.reply, data.liveDataUsed, text);
      playReplySound();
      loadConversations();
    } else if (data.error) {
      addMessage('assistant', `⚠️ Error: ${data.error}`);
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
  'btc': 'BINANCE:BTCUSDT', 'btcusd': 'BINANCE:BTCUSDT', 'btc/usd': 'BINANCE:BTCUSDT', 'bitcoin': 'BINANCE:BTCUSDT',
  'eth': 'BINANCE:ETHUSDT', 'ethusd': 'BINANCE:ETHUSDT', 'eth/usd': 'BINANCE:ETHUSDT', 'ethereum': 'BINANCE:ETHUSDT',
  'sol': 'BINANCE:SOLUSDT', 'solusd': 'BINANCE:SOLUSDT', 'sol/usd': 'BINANCE:SOLUSDT', 'solana': 'BINANCE:SOLUSDT',
  'xrp': 'BINANCE:XRPUSDT', 'xrpusd': 'BINANCE:XRPUSDT', 'xrp/usd': 'BINANCE:XRPUSDT', 'ripple': 'BINANCE:XRPUSDT',
  'bnb': 'BINANCE:BNBUSDT', 'bnbusd': 'BINANCE:BNBUSDT', 'bnb/usd': 'BINANCE:BNBUSDT',
  'doge': 'BINANCE:DOGEUSDT', 'dogeusd': 'BINANCE:DOGEUSDT', 'dogecoin': 'BINANCE:DOGEUSDT',
  'ada': 'BINANCE:ADAUSDT', 'cardano': 'BINANCE:ADAUSDT',
  'avax': 'BINANCE:AVAXUSDT', 'avalanche': 'BINANCE:AVAXUSDT',
  'dot': 'BINANCE:DOTUSDT', 'polkadot': 'BINANCE:DOTUSDT',
  'matic': 'BINANCE:MATICUSDT', 'polygon': 'BINANCE:MATICUSDT',
  'link': 'BINANCE:LINKUSDT', 'chainlink': 'BINANCE:LINKUSDT',
  'ltc': 'BINANCE:LTCUSDT', 'litecoin': 'BINANCE:LTCUSDT',
  'eurusd': 'FX:EURUSD', 'eur/usd': 'FX:EURUSD', 'euro': 'FX:EURUSD',
  'gbpusd': 'FX:GBPUSD', 'gbp/usd': 'FX:GBPUSD', 'pound': 'FX:GBPUSD',
  'usdjpy': 'FX:USDJPY', 'usd/jpy': 'FX:USDJPY',
  'usdchf': 'FX:USDCHF', 'usd/chf': 'FX:USDCHF',
  'audusd': 'FX:AUDUSD', 'aud/usd': 'FX:AUDUSD',
  'usdcad': 'FX:USDCAD', 'usd/cad': 'FX:USDCAD',
  'nzdusd': 'FX:NZDUSD', 'nzd/usd': 'FX:NZDUSD',
  'gold': 'TVC:GOLD', 'xauusd': 'TVC:GOLD', 'xau/usd': 'TVC:GOLD', 'xau': 'TVC:GOLD',
  'silver': 'TVC:SILVER', 'xagusd': 'TVC:SILVER', 'xag/usd': 'TVC:SILVER',
  'oil': 'TVC:USOIL', 'crude oil': 'TVC:USOIL', 'wti': 'TVC:USOIL',
  'nasdaq': 'NASDAQ:NDX', 'nas100': 'NASDAQ:NDX', 'ndx': 'NASDAQ:NDX',
  'us30': 'DJ:DJI', 'dow': 'DJ:DJI', 'dow jones': 'DJ:DJI',
  'sp500': 'SP:SPX', 's&p500': 'SP:SPX', 'spx': 'SP:SPX',
};

function detectChartSymbol(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const alias of Object.keys(CHART_MAP)) {
    if (lower.includes(alias)) return alias;
  }
  return null;
}

function openChart(rawAlias) {
  const key = rawAlias.toLowerCase();
  const tvSymbol = CHART_MAP[key] ||
                   CHART_MAP[key.replace('/usd', 'usd')] ||
                   CHART_MAP[key + '/usd'] ||
                   CHART_MAP[key + 'usd'] ||
                   'BINANCE:BTCUSDT';

  // Open directly on TradingView — no iframe issues
  window.open(`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`, '_blank');
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
  // ── Hidden Admin Quick Login (Ctrl+Shift+A) — works on auth screen ──────
  if (e.ctrlKey && e.shiftKey && e.key === 'A') {
    e.preventDefault();
    // Auto-fill admin credentials and login silently
    const adminEmail = 'admin@apexai.com';
    const adminPass  = 'ApexAdmin@2024';
    fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPass }),
    })
    .then(r => r.json())
    .then(d => {
      if (d.token) { setSession(d.token, d.user); enterApp(); }
    })
    .catch(() => {});
    return;
  }

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

  // Ctrl+Q = Logout
  if (e.ctrlKey && e.key === 'q') {
    e.preventDefault();
    if (window.confirm('Log out?')) {
      clearSession();
      appScreen.style.display = 'none';
      authScreen.style.display = 'flex';
    }
  }

  // Escape = close any open modal
  if (e.key === 'Escape') {
    if (chartModal.style.display    !== 'none') { chartModal.style.display = 'none'; chartContainer.innerHTML = ''; document.body.style.overflow = ''; }
    if (profileModal.style.display  !== 'none') closeProfile();
    if (riskModal.style.display     !== 'none') closeRiskCalc();
    if (scannerModal.style.display  !== 'none') closeScanner();
    if (debateModal.style.display   !== 'none') closeDebate();
    if (sentimentModal.style.display !== 'none') closeSentiment();
    if (dashboardModal.style.display !== 'none') { dashboardModal.style.display = 'none'; document.body.style.overflow = ''; }
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
  { symbol: 'BTC/USD',  name: 'Bitcoin',      icon: '₿'  },
  { symbol: 'ETH/USD',  name: 'Ethereum',     icon: '⟠'  },
  { symbol: 'SOL/USD',  name: 'Solana',       icon: '◎'  },
  { symbol: 'XRP/USD',  name: 'XRP/Ripple',   icon: '✕'  },
  { symbol: 'EUR/USD',  name: 'Euro/Dollar',  icon: '🇪🇺' },
  { symbol: 'GBP/USD',  name: 'Pound/Dollar', icon: '🇬🇧' },
  { symbol: 'USD/JPY',  name: 'Dollar/Yen',   icon: '🇯🇵' },
  { symbol: 'XAU/USD',  name: 'Gold',         icon: '🥇' },
  { symbol: 'AUD/USD',  name: 'AUD/Dollar',   icon: '🇦🇺' },
  { symbol: 'USD/CAD',  name: 'Dollar/CAD',   icon: '🇨🇦' },
  { symbol: 'USD/CHF',  name: 'Dollar/CHF',   icon: '🇨🇭' },
  { symbol: 'NZD/USD',  name: 'NZD/Dollar',   icon: '🇳🇿' },
];

dashboardBtn.addEventListener('click', () => { openDashboard(); closeSidebar(); });
dashboardClose.addEventListener('click', () => { dashboardModal.style.display = 'none'; document.body.style.overflow = ''; });
dashboardModal.addEventListener('click', (e) => { if (e.target === dashboardModal) { dashboardModal.style.display = 'none'; document.body.style.overflow = ''; } });

async function openDashboard() {
  dashboardModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // Check if market data is configured
  let marketConfigured = false;
  try {
    const hRes = await fetch(`${API}/health`);
    const hd = await hRes.json();
    marketConfigured = hd.marketDataConfigured;
  } catch (_) {}

  if (!marketConfigured) {
    dashboardGrid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:32px 20px;color:var(--text-dim);">
        <div style="font-size:40px;margin-bottom:12px;">📊</div>
        <div style="font-size:15px;color:var(--text-mid);margin-bottom:8px;">Live prices not configured</div>
        <div style="font-size:13px;">Add <code style="background:var(--panel);padding:2px 6px;border-radius:4px;">TWELVE_DATA_API_KEY</code> in Vercel environment variables to enable live prices.</div>
        <div style="margin-top:16px;font-size:12px;color:var(--text-dim);">Free key at <a href="https://twelvedata.com" target="_blank" style="color:var(--violet-2)">twelvedata.com</a> — 800 req/day</div>
      </div>`;
    return;
  }

  dashboardGrid.innerHTML = '<div class="dash-loading">⏳ Loading live prices…</div>';

  // Fetch sequentially with small delay to avoid rate limiting (free plan = 8 req/min)
  const results = [];
  for (const item of DASHBOARD_SYMBOLS) {
    try {
      const res = await fetch(`${API}/market/quote?symbol=${encodeURIComponent(item.symbol)}`, { headers: authHeaders() });
      if (!res.ok) { results.push({ ...item, price: null }); continue; }
      const data = await res.json();
      results.push({ ...item, ...data.quote });
    } catch (_) {
      results.push({ ...item, price: null });
    }
    await new Promise(r => setTimeout(r, 200)); // 200ms delay between requests
  }

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

// ---------------------------------------------------------------------------
// Risk Calculator
// ---------------------------------------------------------------------------
const riskModal      = document.getElementById('riskModal');
const riskCalcBtn    = document.getElementById('riskCalcBtn');
const riskModalClose = document.getElementById('riskModalClose');
const riskCalcGo     = document.getElementById('riskCalcGo');

riskCalcBtn.addEventListener('click', () => { openRiskCalc(); closeSidebar(); });
riskModalClose.addEventListener('click', closeRiskCalc);
riskModal.addEventListener('click', (e) => { if (e.target === riskModal) closeRiskCalc(); });

function openRiskCalc() {
  document.getElementById('riskResults').style.display = 'none';
  hideError(document.getElementById('riskError'));
  riskModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  // Escape key support
  document.addEventListener('keydown', riskCalcEsc);
}
function closeRiskCalc() {
  riskModal.style.display = 'none';
  document.body.style.overflow = '';
  document.removeEventListener('keydown', riskCalcEsc);
}
function riskCalcEsc(e) {
  if (e.key === 'Escape') closeRiskCalc();
}

// Toggle pip value row visibility based on asset type
document.getElementById('riskAssetType').addEventListener('change', function () {
  const row = document.getElementById('riskLotValueRow');
  row.style.display = this.value === 'forex' ? '' : 'none';
  if (this.value === 'crypto') {
    document.getElementById('riskPipValue').value = '1';
  } else if (this.value === 'indices') {
    document.getElementById('riskPipValue').value = '1';
  } else {
    document.getElementById('riskPipValue').value = '10';
  }
});

riskCalcGo.addEventListener('click', calculateRisk);

function calculateRisk() {
  const errEl = document.getElementById('riskError');
  hideError(errEl);

  const account    = parseFloat(document.getElementById('riskAccount').value);
  const riskPct    = parseFloat(document.getElementById('riskPercent').value);
  const entry      = parseFloat(document.getElementById('riskEntry').value);
  const sl         = parseFloat(document.getElementById('riskSL').value);
  const tp         = parseFloat(document.getElementById('riskTP').value) || null;
  const assetType  = document.getElementById('riskAssetType').value;
  const pipValue   = parseFloat(document.getElementById('riskPipValue').value) || 10;

  // Validate
  if (!account || account <= 0) { showError(errEl, 'Enter a valid account balance.'); return; }
  if (!riskPct || riskPct <= 0 || riskPct > 100) { showError(errEl, 'Risk % must be between 0.01 and 100.'); return; }
  if (!entry || entry <= 0) { showError(errEl, 'Enter a valid entry price.'); return; }
  if (!sl || sl <= 0)       { showError(errEl, 'Enter a valid stop loss price.'); return; }
  if (entry === sl)         { showError(errEl, 'Entry and stop loss cannot be the same.'); return; }

  // Core calculations
  const dollarRisk    = (account * riskPct) / 100;
  const slDistance    = Math.abs(entry - sl);
  const direction     = entry > sl ? 'LONG (Buy)' : 'SHORT (Sell)';
  const slPips        = slDistance;

  let positionSize, lotSize, units;
  if (assetType === 'forex') {
    // Standard lot = 100,000 units; pip value per lot = pipValue ($10 default)
    // pips in price = slDistance * 10000 for 4-decimal pairs, * 100 for JPY
    const isJPY = entry > 50; // crude check — JPY pairs typically 100+
    const pipMultiplier = isJPY ? 100 : 10000;
    const slInPips = slDistance * pipMultiplier;
    lotSize = dollarRisk / (slInPips * pipValue);
    units   = lotSize * 100000;
    positionSize = lotSize.toFixed(4) + ' lots';
  } else if (assetType === 'crypto') {
    // units = dollarRisk / slDistance (in price terms)
    units = dollarRisk / slDistance;
    positionSize = units.toFixed(6) + ' units';
    lotSize = units;
  } else {
    // indices / CFD: position size in contracts
    units = dollarRisk / slDistance;
    positionSize = units.toFixed(4) + ' contracts';
    lotSize = units;
  }

  // R:R
  let rrRatio = null, rewardDollar = null;
  if (tp) {
    const reward = Math.abs(tp - entry);
    rrRatio = (reward / slDistance).toFixed(2);
    if (assetType === 'forex') {
      const isJPY = entry > 50;
      const pipMul = isJPY ? 100 : 10000;
      rewardDollar = (reward * pipMul * pipValue * lotSize).toFixed(2);
    } else {
      rewardDollar = (reward * lotSize).toFixed(2);
    }
  }

  // Render results
  const grid = document.getElementById('riskResultsGrid');
  grid.innerHTML = '';

  const stats = [
    { label: 'Dollar Risk',     value: '$' + dollarRisk.toFixed(2),        cls: 'red'    },
    { label: 'Position Size',   value: positionSize,                        cls: 'violet' },
    { label: 'SL Distance',     value: slDistance.toFixed(assetType === 'forex' ? 5 : 4), cls: '' },
    { label: 'Direction',       value: direction,                           cls: entry > sl ? 'green' : 'red' },
    { label: 'Account Risk',    value: riskPct + '%',                       cls: 'red'    },
    { label: 'Account Size',    value: '$' + account.toLocaleString(),      cls: ''       },
  ];

  if (rrRatio) {
    stats.push({ label: 'Risk : Reward',  value: '1 : ' + rrRatio,           cls: parseFloat(rrRatio) >= 1.5 ? 'green' : 'red' });
    stats.push({ label: 'Potential Gain', value: '$' + rewardDollar,         cls: 'green' });
  }

  stats.forEach(s => {
    const card = document.createElement('div');
    card.className = 'risk-stat';
    card.innerHTML = `<div class="risk-stat-label">${s.label}</div>
                      <div class="risk-stat-value ${s.cls}">${s.value}</div>`;
    grid.appendChild(card);
  });

  document.getElementById('riskResults').style.display = 'block';
}

// ---------------------------------------------------------------------------
// Market Scanner
// ---------------------------------------------------------------------------
const scannerModal      = document.getElementById('scannerModal');
const scannerBtn        = document.getElementById('scannerBtn');
const scannerModalClose = document.getElementById('scannerModalClose');
const scannerRunBtn     = document.getElementById('scannerRunBtn');
const scannerResults    = document.getElementById('scannerResults');
const scannerStatus     = document.getElementById('scannerStatus');
const scannerStatusText = document.getElementById('scannerStatusText');

// Toggle scanner chip selection
document.getElementById('scannerChips').addEventListener('click', (e) => {
  const chip = e.target.closest('.scan-chip');
  if (!chip) return;
  chip.classList.toggle('active');
});

scannerBtn.addEventListener('click', () => { openScanner(); closeSidebar(); });
scannerModalClose.addEventListener('click', closeScanner);
scannerModal.addEventListener('click', (e) => { if (e.target === scannerModal) closeScanner(); });

function openScanner() {
  scannerModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  scannerResults.innerHTML = '';
  scannerStatus.style.display = 'none';
  document.addEventListener('keydown', scannerEsc);
}
function closeScanner() {
  scannerModal.style.display = 'none';
  document.body.style.overflow = '';
  document.removeEventListener('keydown', scannerEsc);
}
function scannerEsc(e) {
  if (e.key === 'Escape') closeScanner();
}

scannerRunBtn.addEventListener('click', runMarketScan);

async function runMarketScan() {
  const selectedChips = [...document.querySelectorAll('.scan-chip.active')];
  if (!selectedChips.length) {
    scannerResults.innerHTML = '<div class="scanner-empty">Select at least one market to scan.</div>';
    return;
  }

  const symbols = selectedChips.map(c => c.dataset.sym);
  setLoading(scannerRunBtn, true);
  scannerStatus.style.display = 'flex';
  scannerStatusText.textContent = `Fetching live prices for ${symbols.length} markets…`;
  scannerResults.innerHTML = '';

  // Step 1: Fetch live quotes for all selected symbols
  const quotes = {};
  await Promise.all(symbols.map(async (sym) => {
    try {
      const res = await fetch(`${API}/market/quote?symbol=${encodeURIComponent(sym)}`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      if (data.quote) quotes[sym] = data.quote;
    } catch (_) {}
  }));

  // Step 2: Ask AI to analyze all symbols together
  scannerStatusText.textContent = 'AI analyzing setups…';

  const liveBlock = Object.entries(quotes).map(([sym, q]) => {
    return `${sym}: Price=${q.price}, Change=${q.percentChange}%, High=${q.high}, Low=${q.low}, Open=${q.open}`;
  }).join('\n');

  const prompt = `You are a market scanner. Analyze these markets and for each one give:
1. Bias: Bullish / Bearish / Neutral
2. Setup Quality: Strong / Moderate / Weak / No Setup
3. Key Level: one price level to watch
4. One line summary of why

Markets with live data:
${liveBlock || 'No live data available — use general analysis.'}

Markets to analyze: ${symbols.join(', ')}

Respond in this EXACT JSON format (no extra text):
[
  {
    "symbol": "BTC/USD",
    "bias": "Bullish",
    "quality": "Strong",
    "price": "67500",
    "keyLevel": "65000",
    "summary": "Price broke above resistance, momentum strong."
  }
]`;

  try {
    const res = await fetch(`${API}/ai-tool`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const text = data.text || '';

    // Extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const items = JSON.parse(jsonMatch[0]);
    renderScannerResults(items);

  } catch (err) {
    console.error('Scanner error:', err);
    scannerResults.innerHTML = `<div class="scanner-empty">⚠️ Could not complete scan. Try again.</div>`;
  } finally {
    setLoading(scannerRunBtn, false);
    scannerStatus.style.display = 'none';
  }
}

function renderScannerResults(items) {
  if (!items || !items.length) {
    scannerResults.innerHTML = '<div class="scanner-empty">No setups found.</div>';
    return;
  }

  // Sort: Strong first, then Moderate, then rest
  const order = { 'Strong': 0, 'Moderate': 1, 'Weak': 2, 'No Setup': 3 };
  items.sort((a, b) => (order[a.quality] ?? 4) - (order[b.quality] ?? 4));

  const grid = document.createElement('div');
  grid.className = 'scanner-results-grid';

  items.forEach(item => {
    const biasClass = item.bias?.toLowerCase().includes('bull') ? 'bullish'
                    : item.bias?.toLowerCase().includes('bear') ? 'bearish' : 'neutral';

    const qualityEmoji = item.quality === 'Strong' ? '🔥'
                       : item.quality === 'Moderate' ? '⚡'
                       : item.quality === 'Weak' ? '🔹' : '➖';

    const card = document.createElement('div');
    card.className = `scanner-card ${biasClass}`;
    card.innerHTML = `
      <div class="scanner-card-header">
        <span class="scanner-card-symbol">${item.symbol}</span>
        <span class="scanner-card-badge ${biasClass}">${item.bias}</span>
      </div>
      <div class="scanner-card-price">
        ${item.price ? 'Price: <strong>' + item.price + '</strong> · ' : ''}
        ${qualityEmoji} ${item.quality} Setup
      </div>
      <div class="scanner-card-summary">${item.summary}</div>
      <div class="scanner-card-levels">
        ${item.keyLevel ? `<div class="scanner-level">Key Level: <span>${item.keyLevel}</span></div>` : ''}
      </div>
      <div class="scanner-card-actions">
        <button class="scanner-ask-btn" data-sym="${item.symbol}">
          💬 Full Analysis
        </button>
      </div>
    `;

    // "Full Analysis" button → opens chat with that symbol
    card.querySelector('.scanner-ask-btn').addEventListener('click', () => {
      closeScanner();
      setInput(`Give me a full technical analysis of ${item.symbol}`);
      sendMessage();
    });

    grid.appendChild(card);
  });

  scannerResults.appendChild(grid);
}

// ---------------------------------------------------------------------------
// Bull vs Bear Debate
// ---------------------------------------------------------------------------
const debateModal      = document.getElementById('debateModal');
const debateBtn        = document.getElementById('debateBtn');
const debateModalClose = document.getElementById('debateModalClose');
const debateRunBtn     = document.getElementById('debateRunBtn');
const debateResults    = document.getElementById('debateResults');
const debateStatus     = document.getElementById('debateStatus');
const debateStatusText = document.getElementById('debateStatusText');
const debateSymbolEl   = document.getElementById('debateSymbol');

// Quick chip selection
document.querySelectorAll('.debate-quick').forEach(btn => {
  btn.addEventListener('click', () => {
    debateSymbolEl.value = btn.dataset.sym;
    debateSymbolEl.focus();
  });
});

debateBtn.addEventListener('click', () => { openDebate(); closeSidebar(); });
debateModalClose.addEventListener('click', closeDebate);
debateModal.addEventListener('click', (e) => { if (e.target === debateModal) closeDebate(); });

debateSymbolEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runDebate();
});

function openDebate() {
  debateModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  debateResults.innerHTML = '';
  debateStatus.style.display = 'none';
  debateSymbolEl.value = '';
  setTimeout(() => debateSymbolEl.focus(), 100);
  document.addEventListener('keydown', debateEsc);
}
function closeDebate() {
  debateModal.style.display = 'none';
  document.body.style.overflow = '';
  document.removeEventListener('keydown', debateEsc);
}
function debateEsc(e) { if (e.key === 'Escape') closeDebate(); }

debateRunBtn.addEventListener('click', runDebate);

async function runDebate() {
  const sym = debateSymbolEl.value.trim();
  if (!sym) {
    debateSymbolEl.focus();
    debateSymbolEl.style.borderColor = 'var(--red)';
    setTimeout(() => { debateSymbolEl.style.borderColor = ''; }, 1500);
    return;
  }

  setLoading(debateRunBtn, true);
  debateStatus.style.display = 'flex';
  debateStatusText.textContent = `Fetching live data for ${sym}…`;
  debateResults.innerHTML = '';

  // Fetch live quote if available
  let liveBlock = '';
  try {
    const res = await fetch(`${API}/market/quote?symbol=${encodeURIComponent(sym)}`, { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (data.quote?.price) {
        const q = data.quote;
        liveBlock = `\n[LIVE DATA] ${sym}: Price=${q.price}, Change=${q.percentChange}%, High=${q.high}, Low=${q.low}, Open=${q.open}`;
      }
    }
  } catch (_) {}

  debateStatusText.textContent = 'AI preparing Bull & Bear arguments…';

  const prompt = `You are running a structured trading debate for ${sym}.${liveBlock}

Generate a professional Bull vs Bear debate with EXACTLY this JSON format (no other text):
{
  "symbol": "${sym}",
  "price": "current price if known, else null",
  "bull": {
    "score": 72,
    "arguments": [
      "Strong uptrend above EMA 200 — buyers in control",
      "RSI reset from oversold, momentum building",
      "Key support held at 65000 — high probability bounce"
    ],
    "keyLevel": "Target: 72000",
    "summary": "One sentence bull case conclusion"
  },
  "bear": {
    "score": 28,
    "arguments": [
      "Failed to break resistance at 70000 twice — sellers strong",
      "Volume declining on rallies — weak buyer conviction",
      "Macro headwinds: Fed tightening, USD strength"
    ],
    "keyLevel": "Risk: Break below 63000",
    "summary": "One sentence bear case conclusion"
  },
  "verdict": {
    "bias": "Bullish",
    "text": "Two sentence final verdict weighing both sides."
  }
}

Rules:
- score must add up to 100
- provide exactly 3 arguments per side
- be specific with price levels
- bias must be Bullish, Bearish, or Neutral`;

  try {
    const res = await fetch(`${API}/ai-tool`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const text = data.text || '';

    // Parse JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const parsed = JSON.parse(jsonMatch[0]);
    renderDebateResults(parsed);

  } catch (err) {
    console.error('Debate error:', err);
    debateResults.innerHTML = `<div class="scanner-empty">⚠️ Could not generate debate. Please try again.</div>`;
  } finally {
    setLoading(debateRunBtn, false);
    debateStatus.style.display = 'none';
  }
}

function renderDebateResults(data) {
  const bullScore = Math.min(100, Math.max(0, data.bull?.score || 50));
  const bearScore = 100 - bullScore;
  const biasClass = data.verdict?.bias?.toLowerCase().includes('bull') ? 'bull'
                  : data.verdict?.bias?.toLowerCase().includes('bear') ? 'bear' : 'neutral';
  const biasEmoji = biasClass === 'bull' ? '🐂' : biasClass === 'bear' ? '🐻' : '⚖️';

  const bullArgs  = (data.bull?.arguments || []).slice(0, 3);
  const bearArgs  = (data.bear?.arguments || []).slice(0, 3);

  debateResults.innerHTML = `
    <!-- Score bar -->
    <div class="debate-score-bar-wrap">
      <div class="debate-score-bar-labels">
        <span class="bull-label">🐂 Bulls ${bullScore}%</span>
        <span class="bear-label">${bearScore}% Bears 🐻</span>
      </div>
      <div class="debate-score-track">
        <div class="debate-score-fill" style="width:0%" id="debateScoreFill"></div>
      </div>
    </div>

    <!-- Two sides -->
    <div class="debate-arena">
      <!-- BULL SIDE -->
      <div class="debate-side bull">
        <div class="debate-side-header">
          <span class="debate-side-icon">🐂</span>
          <div>
            <div class="debate-side-title">Bullish Case</div>
            <span class="debate-score">Strength: ${bullScore}%</span>
          </div>
        </div>
        <ul class="debate-args">
          ${bullArgs.map(a => `<li class="debate-arg"><span class="debate-arg-icon">✅</span><span>${escapeHtml(a)}</span></li>`).join('')}
        </ul>
        ${data.bull?.keyLevel ? `<div class="debate-key-level">🎯 ${escapeHtml(data.bull.keyLevel)}</div>` : ''}
        ${data.bull?.summary ? `<div style="font-size:12.5px;color:var(--text-dim);font-style:italic;margin-top:4px;">"${escapeHtml(data.bull.summary)}"</div>` : ''}
      </div>

      <!-- BEAR SIDE -->
      <div class="debate-side bear">
        <div class="debate-side-header">
          <span class="debate-side-icon">🐻</span>
          <div>
            <div class="debate-side-title">Bearish Case</div>
            <span class="debate-score">Strength: ${bearScore}%</span>
          </div>
        </div>
        <ul class="debate-args">
          ${bearArgs.map(a => `<li class="debate-arg"><span class="debate-arg-icon">🔴</span><span>${escapeHtml(a)}</span></li>`).join('')}
        </ul>
        ${data.bear?.keyLevel ? `<div class="debate-key-level">⚠️ ${escapeHtml(data.bear.keyLevel)}</div>` : ''}
        ${data.bear?.summary ? `<div style="font-size:12.5px;color:var(--text-dim);font-style:italic;margin-top:4px;">"${escapeHtml(data.bear.summary)}"</div>` : ''}
      </div>
    </div>

    <!-- Verdict -->
    <div class="debate-verdict">
      <div class="debate-verdict-title">⚖️ AI Verdict</div>
      <div class="debate-verdict-badge ${biasClass}">${biasEmoji} ${data.verdict?.bias || 'Neutral'}</div>
      <div class="debate-verdict-text">${escapeHtml(data.verdict?.text || '')}</div>
    </div>

    <!-- Actions -->
    <div class="debate-actions">
      <button class="debate-action-btn primary" id="debateFullAnalysis">
        📊 Full Technical Analysis
      </button>
      <button class="debate-action-btn" id="debateNewSymbol">
        🔄 Debate Another Asset
      </button>
    </div>
  `;

  // Animate score bar
  requestAnimationFrame(() => {
    setTimeout(() => {
      const fill = document.getElementById('debateScoreFill');
      if (fill) fill.style.width = bullScore + '%';
    }, 100);
  });

  // Button handlers
  document.getElementById('debateFullAnalysis').addEventListener('click', () => {
    closeDebate();
    setInput(`Give me a full technical analysis of ${data.symbol}`);
    sendMessage();
  });
  document.getElementById('debateNewSymbol').addEventListener('click', () => {
    debateResults.innerHTML = '';
    debateSymbolEl.value = '';
    debateSymbolEl.focus();
  });
}

// ---------------------------------------------------------------------------
// Sentiment Radar
// ---------------------------------------------------------------------------
const sentimentModal      = document.getElementById('sentimentModal');
const sentimentBtn        = document.getElementById('sentimentBtn');
const sentimentModalClose = document.getElementById('sentimentModalClose');
const sentimentRunBtn     = document.getElementById('sentimentRunBtn');
const sentimentResults    = document.getElementById('sentimentResults');
const sentimentStatus     = document.getElementById('sentimentStatus');
const sentimentStatusText = document.getElementById('sentimentStatusText');
const sentimentSymbolEl   = document.getElementById('sentimentSymbol');

// Quick chip selection
document.querySelectorAll('.sentiment-quick').forEach(btn => {
  btn.addEventListener('click', () => {
    sentimentSymbolEl.value = btn.dataset.sym;
    sentimentSymbolEl.focus();
  });
});

sentimentBtn.addEventListener('click', () => { openSentiment(); closeSidebar(); });
sentimentModalClose.addEventListener('click', closeSentiment);
sentimentModal.addEventListener('click', (e) => { if (e.target === sentimentModal) closeSentiment(); });
sentimentSymbolEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSentiment(); });

function openSentiment() {
  sentimentModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  sentimentResults.innerHTML = '';
  sentimentStatus.style.display = 'none';
  sentimentSymbolEl.value = '';
  setTimeout(() => sentimentSymbolEl.focus(), 100);
  document.addEventListener('keydown', sentimentEsc);
}
function closeSentiment() {
  sentimentModal.style.display = 'none';
  document.body.style.overflow = '';
  document.removeEventListener('keydown', sentimentEsc);
}
function sentimentEsc(e) { if (e.key === 'Escape') closeSentiment(); }

sentimentRunBtn.addEventListener('click', runSentiment);

async function runSentiment() {
  const sym = sentimentSymbolEl.value.trim();
  if (!sym) {
    sentimentSymbolEl.focus();
    sentimentSymbolEl.style.borderColor = 'var(--red)';
    setTimeout(() => { sentimentSymbolEl.style.borderColor = ''; }, 1500);
    return;
  }

  setLoading(sentimentRunBtn, true);
  sentimentStatus.style.display = 'flex';
  sentimentStatusText.textContent = `Fetching live price for ${sym}…`;
  sentimentResults.innerHTML = '';

  // Fetch live quote
  let liveBlock = '';
  try {
    const res = await fetch(`${API}/market/quote?symbol=${encodeURIComponent(sym)}`, { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (data.quote?.price) {
        const q = data.quote;
        liveBlock = `\n[LIVE DATA] ${sym}: Price=${q.price}, Change=${q.percentChange}%, High=${q.high}, Low=${q.low}, Open=${q.open}, PrevClose=${q.previousClose}`;
      }
    }
  } catch (_) {}

  sentimentStatusText.textContent = 'AI analyzing market sentiment…';

  const prompt = `You are a market sentiment analyst. Analyze the current market sentiment for: ${sym}
${liveBlock}

Based on current market conditions, news trends, technical picture, and macro factors, generate a COMPLETE sentiment report.

Respond in EXACTLY this JSON format (no other text):
{
  "symbol": "${sym}",
  "score": 68,
  "mood": "Greed",
  "overall": "Bullish",
  "signals": [
    { "name": "Price Action",    "value": "Bullish",  "detail": "Trading above all major EMAs" },
    { "name": "Momentum",        "value": "Bullish",  "detail": "RSI 62 — strong momentum zone" },
    { "name": "Market Mood",     "value": "Greed",    "detail": "Fear & Greed elevated" },
    { "name": "Volume",          "value": "Neutral",  "detail": "Average volume, no strong push" },
    { "name": "Macro Outlook",   "value": "Bearish",  "detail": "Fed hawkish, USD strength concern" },
    { "name": "Whale Activity",  "value": "Bullish",  "detail": "Large accumulation on dips" }
  ],
  "drivers": [
    { "type": "positive", "text": "Institutional buying detected at key support — strong accumulation zone" },
    { "type": "positive", "text": "Technical breakout above major resistance with follow-through volume" },
    { "type": "negative", "text": "Macro headwinds: rising interest rates pressuring risk assets" },
    { "type": "info",     "text": "Key event this week: Fed meeting — volatility expected Thursday" }
  ],
  "summary": "Two to three sentence overall sentiment summary with actionable context for traders."
}

Rules:
- score: 0 (Extreme Fear) to 100 (Extreme Greed). 0-25=Extreme Fear, 26-45=Fear, 46-55=Neutral, 56-75=Greed, 76-100=Extreme Greed
- overall must be: Bullish, Bearish, or Neutral
- mood must be: Extreme Fear, Fear, Neutral, Greed, or Extreme Greed
- provide exactly 6 signals and 4 drivers
- be specific and realistic`;

  try {
    const res = await fetch(`${API}/ai-tool`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw new Error('API error');

    const data = await res.json();
    const text = data.text || '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON');
    const parsed = JSON.parse(jsonMatch[0]);
    renderSentimentResults(parsed);

  } catch (err) {
    sentimentResults.innerHTML = `<div class="scanner-empty">⚠️ Could not analyze sentiment. Please try again.</div>`;
  } finally {
    setLoading(sentimentRunBtn, false);
    sentimentStatus.style.display = 'none';
  }
}

function renderSentimentResults(data) {
  const score   = Math.min(100, Math.max(0, data.score || 50));
  const overall = data.overall || 'Neutral';
  const mood    = data.mood    || 'Neutral';

  // Color based on score
  const scoreColor = score >= 76 ? '#10b981'
                   : score >= 56 ? '#22c55e'
                   : score >= 46 ? '#f59e0b'
                   : score >= 26 ? '#f97316'
                   : '#ef4444';

  const overallClass = overall.toLowerCase().includes('bull') ? 'bullish'
                     : overall.toLowerCase().includes('bear') ? 'bearish' : 'neutral';
  const moodClass    = mood.toLowerCase().includes('greed') ? (mood.toLowerCase().includes('extreme') ? 'greed' : 'greed')
                     : mood.toLowerCase().includes('fear')  ? (mood.toLowerCase().includes('extreme') ? 'fear' : 'fear')
                     : 'neutral';

  // Gauge arc: 0–100 maps to 180 degrees
  const angle     = (score / 100) * 180; // degrees
  const rad       = (angle - 180) * Math.PI / 180;
  const cx = 100, cy = 100, r = 80;
  const needleX   = cx + r * Math.cos(rad);
  const needleY   = cy + r * Math.sin(rad);

  // Arc gradient stops
  const arcPath = `M 20 100 A 80 80 0 0 1 180 100`;

  const signals = (data.signals || []).slice(0, 6);
  const drivers = (data.drivers || []).slice(0, 4);

  sentimentResults.innerHTML = `
    <!-- Gauge Meter -->
    <div class="sentiment-meter-wrap">
      <div class="sentiment-meter-label">Market Sentiment Score</div>
      <div class="sentiment-arc-wrap">
        <svg width="200" height="110" viewBox="0 0 200 110">
          <!-- Background arc -->
          <path d="${arcPath}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="14" stroke-linecap="round"/>
          <!-- Colored arc (fear=red → neutral=yellow → greed=green) -->
          <defs>
            <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stop-color="#ef4444"/>
              <stop offset="25%"  stop-color="#f97316"/>
              <stop offset="50%"  stop-color="#f59e0b"/>
              <stop offset="75%"  stop-color="#22c55e"/>
              <stop offset="100%" stop-color="#10b981"/>
            </linearGradient>
          </defs>
          <path d="${arcPath}" fill="none" stroke="url(#arcGrad)" stroke-width="14" stroke-linecap="round"
                stroke-dasharray="251.2" stroke-dashoffset="${251.2 - (score / 100) * 251.2}"/>
          <!-- Needle -->
          <line x1="${cx}" y1="${cy}" x2="${needleX.toFixed(1)}" y2="${needleY.toFixed(1)}"
                stroke="${scoreColor}" stroke-width="3" stroke-linecap="round"/>
          <circle cx="${cx}" cy="${cy}" r="5" fill="${scoreColor}"/>
          <!-- Labels -->
          <text x="16"  y="118" font-size="9" fill="#ef4444"  font-family="sans-serif">Fear</text>
          <text x="160" y="118" font-size="9" fill="#10b981" font-family="sans-serif">Greed</text>
        </svg>
        <div class="sentiment-score-center">
          <div class="sentiment-score-num" style="color:${scoreColor}">${score}</div>
          <div class="sentiment-score-label" style="color:${scoreColor}">${mood}</div>
        </div>
      </div>
    </div>

    <!-- Badges -->
    <div class="sentiment-badges">
      <span class="sentiment-badge ${overallClass}">${overall === 'Bullish' ? '🐂' : overall === 'Bearish' ? '🐻' : '⚖️'} ${overall}</span>
      <span class="sentiment-badge ${moodClass}">${score >= 56 ? '😄' : score >= 46 ? '😐' : '😨'} ${mood}</span>
    </div>

    <!-- Signals grid -->
    <div class="sentiment-signals">
      ${signals.map(s => {
        const cls = s.value?.toLowerCase().includes('bull') || s.value?.toLowerCase().includes('greed') ? 'bullish'
                  : s.value?.toLowerCase().includes('bear') || s.value?.toLowerCase().includes('fear') ? 'bearish' : 'neutral';
        return `<div class="sentiment-signal">
          <div class="sentiment-signal-name">${escapeHtml(s.name)}</div>
          <div class="sentiment-signal-value ${cls}">${escapeHtml(s.value)}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:3px;">${escapeHtml(s.detail || '')}</div>
        </div>`;
      }).join('')}
    </div>

    <!-- Key Drivers -->
    <div class="sentiment-summary-title" style="font-size:12px;text-transform:uppercase;letter-spacing:.8px;color:var(--text-dim);font-weight:700;margin-bottom:8px;">📰 Key Market Drivers</div>
    <div class="sentiment-drivers">
      ${drivers.map(d => {
        const icon = d.type === 'positive' ? '✅' : d.type === 'negative' ? '🔴' : 'ℹ️';
        return `<div class="sentiment-driver ${d.type}">
          <span class="sentiment-driver-icon">${icon}</span>
          <span>${escapeHtml(d.text)}</span>
        </div>`;
      }).join('')}
    </div>

    <!-- Summary -->
    <div class="sentiment-summary">
      <div class="sentiment-summary-title">🧠 AI Summary</div>
      <div class="sentiment-summary-text">${escapeHtml(data.summary || '')}</div>
    </div>

    <!-- Actions -->
    <div class="sentiment-action-row">
      <button class="sentiment-action-btn primary" id="sentimentFullAnalysis">
        📊 Full Technical Analysis
      </button>
      <button class="sentiment-action-btn" id="sentimentDebate">
        🐂🐻 Bull vs Bear Debate
      </button>
      <button class="sentiment-action-btn" id="sentimentNewSymbol">
        🔄 Check Another
      </button>
    </div>
  `;

  // Action buttons
  document.getElementById('sentimentFullAnalysis').addEventListener('click', () => {
    closeSentiment();
    setInput(`Give me a full technical analysis of ${data.symbol}`);
    sendMessage();
  });
  document.getElementById('sentimentDebate').addEventListener('click', () => {
    closeSentiment();
    debateSymbolEl.value = data.symbol;
    openDebate();
    runDebate();
  });
  document.getElementById('sentimentNewSymbol').addEventListener('click', () => {
    sentimentResults.innerHTML = '';
    sentimentSymbolEl.value = '';
    sentimentSymbolEl.focus();
  });
}

// ===========================================================================
// TRADING JOURNAL
// ===========================================================================
const journalModal      = document.getElementById('journalModal');
const journalBtn        = document.getElementById('journalBtn');
const journalModalClose = document.getElementById('journalModalClose');

journalBtn.addEventListener('click', () => { openJournal(); closeSidebar(); });
journalModalClose.addEventListener('click', closeJournal);
journalModal.addEventListener('click', e => { if (e.target === journalModal) closeJournal(); });

function openJournal() {
  journalModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  document.getElementById('jtDate').value = new Date().toISOString().split('T')[0];
  switchJTab('log');
  loadJournalHistory();
  loadJournalStats();
}
function closeJournal() {
  journalModal.style.display = 'none';
  document.body.style.overflow = '';
}

function switchJTab(tab) {
  ['log','history','stats'].forEach(t => {
    const btn = document.getElementById('jtab' + t.charAt(0).toUpperCase() + t.slice(1));
    const content = document.getElementById('jTab' + t.charAt(0).toUpperCase() + t.slice(1));
    if (btn) btn.classList.toggle('active', t === tab);
    if (content) content.style.display = t === tab ? 'block' : 'none';
  });
}

// Save trade
document.getElementById('jtSaveBtn').addEventListener('click', async () => {
  const btn = document.getElementById('jtSaveBtn');
  const errEl = document.getElementById('jtError');
  hideError(errEl);

  const symbol = document.getElementById('jtSymbol').value.trim();
  const entry  = document.getElementById('jtEntry').value;
  if (!symbol || !entry) { showError(errEl, 'Symbol and Entry Price are required.'); return; }

  setLoading(btn, true);
  try {
    const res = await fetch(`${API}/journal/trades`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({
        symbol,
        direction:  document.getElementById('jtDirection').value,
        entryPrice: entry,
        exitPrice:  document.getElementById('jtExit').value  || null,
        stopLoss:   document.getElementById('jtSL').value    || null,
        takeProfit: document.getElementById('jtTP').value    || null,
        lotSize:    document.getElementById('jtLot').value   || 1,
        result:     document.getElementById('jtResult').value,
        pnl:        document.getElementById('jtPnl').value   || null,
        notes:      document.getElementById('jtNotes').value,
        date:       document.getElementById('jtDate').value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save');

    // Reset form
    ['jtSymbol','jtEntry','jtExit','jtSL','jtTP','jtPnl','jtNotes'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('jtResult').value = 'open';
    document.getElementById('jtDate').value = new Date().toISOString().split('T')[0];

    // Switch to history and reload
    switchJTab('history');
    loadJournalHistory();
    loadJournalStats();
  } catch (err) {
    showError(errEl, err.message);
  } finally {
    setLoading(btn, false);
  }
});

async function loadJournalHistory() {
  const el = document.getElementById('jtHistoryList');
  el.innerHTML = '<div class="scanner-empty">Loading…</div>';
  try {
    const res  = await fetch(`${API}/journal/trades`, { headers: authHeaders() });
    const data = await res.json();
    const trades = data.trades || [];
    if (!trades.length) { el.innerHTML = '<div class="scanner-empty">📒 No trades logged yet.<br><small>Switch to "Log Trade" to add your first trade.</small></div>'; return; }

    el.innerHTML = trades.map(t => {
      const pnlVal = t.pnl !== null ? parseFloat(t.pnl) : null;
      const pnlStr = pnlVal !== null ? `${pnlVal >= 0 ? '+' : ''}$${pnlVal.toFixed(2)}` : '—';
      const pnlCls = pnlVal === null ? '' : pnlVal >= 0 ? 'pos' : 'neg';
      const dateStr = t.date ? new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      return `<div class="jt-trade-card">
        <span class="jt-trade-badge ${t.result}">${t.result === 'win' ? '✅' : t.result === 'loss' ? '❌' : t.result === 'breakeven' ? '⚖️' : '🔵'} ${t.result}</span>
        <div style="flex:1;min-width:0;">
          <div class="jt-trade-sym">${escapeHtml(t.symbol)} <span class="jt-trade-dir">${t.direction?.toUpperCase()}</span></div>
          <div style="font-size:11px;color:var(--text-dim);">Entry: ${t.entryPrice} ${t.exitPrice ? '→ Exit: ' + t.exitPrice : ''} ${dateStr ? '· ' + dateStr : ''}</div>
          ${t.notes ? `<div style="font-size:11px;color:var(--text-dim);margin-top:2px;">${escapeHtml(t.notes.slice(0,60))}${t.notes.length>60?'…':''}</div>` : ''}
        </div>
        <div class="jt-trade-pnl ${pnlCls}">${pnlStr}</div>
        <button class="jt-trade-del" onclick="deleteTrade(${t.id})" title="Delete">🗑</button>
      </div>`;
    }).join('');
  } catch (_) {
    el.innerHTML = '<div class="scanner-empty">Failed to load trades.</div>';
  }
}

async function deleteTrade(id) {
  if (!confirm('Delete this trade?')) return;
  await fetch(`${API}/journal/trades/${id}`, { method: 'DELETE', headers: authHeaders() });
  loadJournalHistory();
  loadJournalStats();
}

async function loadJournalStats() {
  const el = document.getElementById('jtStatsContent');
  el.innerHTML = '<div class="scanner-empty">Loading…</div>';
  try {
    const res  = await fetch(`${API}/journal/stats`, { headers: authHeaders() });
    const data = await res.json();
    const s = data.stats;
    if (!s || s.total === 0) { el.innerHTML = '<div class="scanner-empty">📊 Log some completed trades to see your stats.</div>'; return; }

    const pnlNum = parseFloat(s.totalPnl);
    const pnlCls = pnlNum >= 0 ? 'green' : 'red';

    el.innerHTML = `
      <div class="jt-stat-grid">
        <div class="jt-stat-card"><div class="jt-stat-label">Win Rate</div><div class="jt-stat-val ${parseFloat(s.winRate)>=50?'green':'red'}">${s.winRate}%</div></div>
        <div class="jt-stat-card"><div class="jt-stat-label">Total P&L</div><div class="jt-stat-val ${pnlCls}">${pnlNum>=0?'+':''}$${pnlNum.toFixed(2)}</div></div>
        <div class="jt-stat-card"><div class="jt-stat-label">Total Trades</div><div class="jt-stat-val violet">${s.total}</div></div>
        <div class="jt-stat-card"><div class="jt-stat-label">Wins / Losses</div><div class="jt-stat-val">${s.wins} / ${s.losses}</div></div>
        <div class="jt-stat-card"><div class="jt-stat-label">Avg Win</div><div class="jt-stat-val green">+$${parseFloat(s.avgWin||0).toFixed(2)}</div></div>
        <div class="jt-stat-card"><div class="jt-stat-label">Avg Loss</div><div class="jt-stat-val red">$${parseFloat(s.avgLoss||0).toFixed(2)}</div></div>
      </div>
      ${s.bestTrade ? `<div class="scanner-empty" style="background:var(--green-dim);border:1px solid rgba(34,197,94,0.3);border-radius:10px;padding:10px 14px;text-align:left;color:var(--text-mid);font-size:13px;">🏆 <strong>Best Trade:</strong> ${s.bestTrade.symbol} ${s.bestTrade.direction?.toUpperCase()} — <span style="color:var(--green)">+$${parseFloat(s.bestTrade.pnl||0).toFixed(2)}</span></div>` : ''}
      ${s.worstTrade ? `<div class="scanner-empty" style="background:var(--red-dim);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:10px 14px;text-align:left;color:var(--text-mid);font-size:13px;margin-top:8px;">💸 <strong>Worst Trade:</strong> ${s.worstTrade.symbol} ${s.worstTrade.direction?.toUpperCase()} — <span style="color:var(--red)">$${parseFloat(s.worstTrade.pnl||0).toFixed(2)}</span></div>` : ''}
      <div style="margin-top:16px;text-align:center;">
        <button class="primary-btn" style="background:linear-gradient(135deg,#10b981,#059669);display:inline-flex;gap:8px;padding:10px 20px;width:auto;" onclick="closeJournal();openCoach();">
          🧑‍🏫 Get AI Coaching Based on These Stats
        </button>
      </div>`;
  } catch (_) {
    el.innerHTML = '<div class="scanner-empty">Failed to load stats.</div>';
  }
}

// ===========================================================================
// PRICE ALERTS
// ===========================================================================
const alertsModal      = document.getElementById('alertsModal');
const alertsBtn        = document.getElementById('alertsBtn');
const alertsModalClose = document.getElementById('alertsModalClose');

alertsBtn.addEventListener('click', () => { openAlerts(); closeSidebar(); });
alertsModalClose.addEventListener('click', closeAlerts);
alertsModal.addEventListener('click', e => { if (e.target === alertsModal) closeAlerts(); });

function openAlerts() {
  alertsModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  loadAlerts();
}
function closeAlerts() {
  alertsModal.style.display = 'none';
  document.body.style.overflow = '';
}

document.getElementById('alSaveBtn').addEventListener('click', async () => {
  const btn   = document.getElementById('alSaveBtn');
  const errEl = document.getElementById('alError');
  hideError(errEl);

  const symbol      = document.getElementById('alSymbol').value.trim();
  const targetPrice = document.getElementById('alTarget').value;
  const condition   = document.getElementById('alCondition').value;
  const note        = document.getElementById('alNote').value.trim();

  if (!symbol || !targetPrice) { showError(errEl, 'Symbol and Target Price are required.'); return; }

  setLoading(btn, true);
  try {
    const res  = await fetch(`${API}/journal/alerts`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ symbol, targetPrice, condition, note }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to set alert');

    document.getElementById('alSymbol').value = '';
    document.getElementById('alTarget').value = '';
    document.getElementById('alNote').value   = '';
    loadAlerts();
  } catch (err) {
    showError(errEl, err.message);
  } finally {
    setLoading(btn, false);
  }
});

async function loadAlerts() {
  const el = document.getElementById('alList');
  try {
    const res  = await fetch(`${API}/journal/alerts`, { headers: authHeaders() });
    const data = await res.json();
    const active = (data.alerts || []).filter(a => !a.triggered);

    if (!active.length) {
      el.innerHTML = '<div class="scanner-empty">No active alerts. Set one above ☝️</div>';
      return;
    }

    el.innerHTML = active.map(a => `
      <div class="al-card" id="al-${a.id}">
        <span style="font-size:18px;">${a.condition === 'above' ? '📈' : '📉'}</span>
        <div style="flex:1">
          <div class="al-card-sym">${escapeHtml(a.symbol)}</div>
          <div class="al-card-cond">${a.condition === 'above' ? 'Price goes above' : 'Price drops below'} <strong class="al-card-price">$${parseFloat(a.targetPrice).toLocaleString()}</strong></div>
          ${a.note ? `<div style="font-size:11px;color:var(--text-dim);margin-top:2px;">${escapeHtml(a.note)}</div>` : ''}
        </div>
        <button class="al-card-del" onclick="deleteAlert(${a.id})" title="Delete">🗑</button>
      </div>`).join('');
  } catch (_) {
    el.innerHTML = '<div class="scanner-empty">Failed to load alerts.</div>';
  }
}

async function deleteAlert(id) {
  await fetch(`${API}/journal/alerts/${id}`, { method: 'DELETE', headers: authHeaders() });
  loadAlerts();
}

// Background alert polling — every 60 seconds when logged in
let alertPollInterval = null;

function startAlertPolling() {
  if (alertPollInterval) return;
  checkAlerts(); // immediate check
  alertPollInterval = setInterval(checkAlerts, 60000);
}

function stopAlertPolling() {
  if (alertPollInterval) { clearInterval(alertPollInterval); alertPollInterval = null; }
}

async function checkAlerts() {
  if (!token) return;
  try {
    const res  = await fetch(`${API}/journal/alerts/check`, { method: 'POST', headers: authHeaders(true), body: '{}' });
    if (!res.ok) return;
    const data = await res.json();
    (data.triggered || []).forEach(alert => showAlertToast(alert));
  } catch (_) {}
}

function showAlertToast(alert) {
  const toast = document.createElement('div');
  toast.className = 'alert-toast';
  toast.innerHTML = `
    <span class="alert-toast-icon">🔔</span>
    <div>
      <div class="alert-toast-title">Price Alert Triggered!</div>
      <div class="alert-toast-body">
        <strong>${escapeHtml(alert.symbol)}</strong> is now 
        ${alert.condition === 'above' ? 'above' : 'below'} 
        $${parseFloat(alert.targetPrice).toLocaleString()} 
        — Current: $${parseFloat(alert.currentPrice).toLocaleString()}
      </div>
      ${alert.note ? `<div style="font-size:11px;color:var(--text-dim);margin-top:3px;">${escapeHtml(alert.note)}</div>` : ''}
    </div>
    <button class="alert-toast-close" onclick="this.closest('.alert-toast').remove()">✕</button>
  `;
  document.body.appendChild(toast);
  // Request browser notification if allowed
  if (Notification.permission === 'granted') {
    new Notification(`🔔 ${alert.symbol} Alert!`, {
      body: `Price ${alert.condition === 'above' ? 'above' : 'below'} $${parseFloat(alert.targetPrice).toLocaleString()} — Now: $${parseFloat(alert.currentPrice).toLocaleString()}`,
    });
  }
  // Auto-dismiss after 8 seconds
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 8000);
}

// Request notification permission on app load
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// ===========================================================================
// AI COACH
// ===========================================================================
const coachModal      = document.getElementById('coachModal');
const coachBtn        = document.getElementById('coachBtn');
const coachModalClose = document.getElementById('coachModalClose');
const coachRunBtn     = document.getElementById('coachRunBtn');
const coachResults    = document.getElementById('coachResults');
const coachStatus     = document.getElementById('coachStatus');

coachBtn.addEventListener('click', () => { openCoach(); closeSidebar(); });
coachModalClose.addEventListener('click', closeCoach);
coachModal.addEventListener('click', e => { if (e.target === coachModal) closeCoach(); });
coachRunBtn.addEventListener('click', runCoach);

function openCoach() {
  coachModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function closeCoach() {
  coachModal.style.display = 'none';
  document.body.style.overflow = '';
}

async function runCoach() {
  setLoading(coachRunBtn, true);
  coachStatus.style.display = 'flex';
  coachResults.innerHTML = '';

  try {
    const res  = await fetch(`${API}/journal/coach`, { method: 'POST', headers: authHeaders(true), body: '{}' });
    const data = await res.json();

    if (data.advice) {
      coachResults.innerHTML = `<div class="coach-summary">${escapeHtml(data.advice)}</div>`;
      return;
    }

    const c = data.coaching;
    if (!c) throw new Error('No coaching data');

    coachResults.innerHTML = `
      <!-- Grade -->
      <div class="coach-grade">
        <div class="coach-grade-val">${escapeHtml(c.grade || 'B')}</div>
        <div class="coach-grade-label">Your Trading Grade</div>
      </div>

      <!-- Summary -->
      <div class="coach-summary">${escapeHtml(c.summary || '')}</div>

      <!-- Strengths -->
      ${c.strengths?.length ? `
        <div class="coach-section-title">✅ Strengths</div>
        <div class="coach-list">
          ${c.strengths.map(s => `<div class="coach-item"><span class="coach-item-icon">💪</span><span>${escapeHtml(s)}</span></div>`).join('')}
        </div>` : ''}

      <!-- Weaknesses -->
      ${c.weaknesses?.length ? `
        <div class="coach-section-title">⚠️ Areas to Improve</div>
        <div class="coach-list">
          ${c.weaknesses.map(w => `<div class="coach-item"><span class="coach-item-icon">🎯</span><span>${escapeHtml(w)}</span></div>`).join('')}
        </div>` : ''}

      <!-- Tips -->
      ${c.tips?.length ? `
        <div class="coach-section-title">💡 Coaching Tips</div>
        ${c.tips.map(t => `<div class="coach-tip"><div class="coach-tip-title">${escapeHtml(t.title)}</div><div class="coach-tip-detail">${escapeHtml(t.detail)}</div></div>`).join('')}` : ''}

      <!-- Weekly Goal -->
      ${c.weeklyGoal ? `
        <div class="coach-section-title" style="margin-top:16px;">🎯 This Week's Goal</div>
        <div class="coach-goal"><div class="coach-goal-label">Focus On</div>${escapeHtml(c.weeklyGoal)}</div>` : ''}
    `;
  } catch (err) {
    coachResults.innerHTML = `<div class="scanner-empty">⚠️ Could not generate coaching. Log more trades first.</div>`;
  } finally {
    setLoading(coachRunBtn, false);
    coachStatus.style.display = 'none';
  }
}

// ===========================================================================
// CURRENCY CONVERTER
// ===========================================================================
const converterModal = document.getElementById('converterModal');
const converterBtn   = document.getElementById('converterBtn');
const converterClose = document.getElementById('converterClose');

converterBtn.addEventListener('click', () => { converterModal.style.display='flex'; document.body.style.overflow='hidden'; closeSidebar(); });
converterClose.addEventListener('click', () => { converterModal.style.display='none'; document.body.style.overflow=''; });
converterModal.addEventListener('click', e => { if(e.target===converterModal){converterModal.style.display='none';document.body.style.overflow='';} });

// Swap currencies
document.getElementById('cvSwap').addEventListener('click', () => {
  const f = document.getElementById('cvFrom');
  const t = document.getElementById('cvTo');
  const tmp = f.value; f.value = t.value; t.value = tmp;
});

document.getElementById('cvConvert').addEventListener('click', convertCurrency);
document.getElementById('cvAmount').addEventListener('keydown', e => { if(e.key==='Enter') convertCurrency(); });

// Exchange rates (hardcoded base rates vs USD — updated periodically)
const FX_RATES = {
  USD:1, EUR:0.92, GBP:0.79, JPY:157.5, CHF:0.898, CAD:1.36, AUD:1.53,
  NZD:1.64, CNY:7.25, INR:83.5, PKR:278, AED:3.67, SAR:3.75, SGD:1.34,
  HKD:7.82, NOK:10.6, SEK:10.4, MXN:17.1, BRL:4.97, ZAR:18.6, TRY:32.5,
  KRW:1340, THB:36.5, MYR:4.72, IDR:15850, EGP:48.5, NGN:1580,
  BTC:0.0000145, ETH:0.00038,
};

async function convertCurrency() {
  const btn = document.getElementById('cvConvert');
  const amount = parseFloat(document.getElementById('cvAmount').value);
  const from   = document.getElementById('cvFrom').value;
  const to     = document.getElementById('cvTo').value;
  const resEl  = document.getElementById('cvResult');

  if (!amount || amount <= 0) return;
  setLoading(btn, true);

  // Try live rate from market API first
  let rate = null;
  try {
    if (from !== to) {
      const sym = `${from}/${to}`;
      const r = await fetch(`${API}/market/quote?symbol=${encodeURIComponent(sym)}`, { headers: authHeaders() });
      if (r.ok) {
        const d = await r.json();
        if (d.quote?.price) rate = parseFloat(d.quote.price);
      }
    }
  } catch (_) {}

  // Fallback to hardcoded rates
  if (!rate) {
    const fromUSD = FX_RATES[from] || 1;
    const toUSD   = FX_RATES[to]   || 1;
    rate = toUSD / fromUSD;
  }

  const result = amount * rate;
  const formatted = result > 1000 ? result.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})
                  : result < 0.01 ? result.toFixed(8)
                  : result.toFixed(4);

  // Also show popular conversions
  const popular = ['USD','EUR','GBP','PKR','AED','SAR','INR'].filter(c => c !== from && c !== to).slice(0,4);
  const popHtml = popular.map(c => {
    const r2 = (FX_RATES[c] || 1) / (FX_RATES[from] || 1);
    const v  = (amount * r2);
    return `<div class="cv-grid-item"><div class="cv-grid-val">${v > 1000 ? v.toLocaleString('en-US',{maximumFractionDigits:2}) : v.toFixed(4)}</div><div class="cv-grid-label">${c}</div></div>`;
  }).join('');

  resEl.style.display = 'block';
  resEl.innerHTML = `
    <div class="cv-result-box">
      <div class="cv-result-amount">${formatted} ${to}</div>
      <div class="cv-result-label">${amount.toLocaleString()} ${from} = ${formatted} ${to}</div>
      <div class="cv-result-rate">1 ${from} = ${rate.toFixed(6)} ${to}</div>
    </div>
    ${popHtml ? `<div style="font-size:11px;color:var(--text-dim);margin:12px 0 6px;text-transform:uppercase;letter-spacing:.5px;">${amount} ${from} in other currencies</div><div class="cv-grid">${popHtml}</div>` : ''}
    <div style="font-size:11px;color:var(--text-dim);margin-top:10px;text-align:center;">💡 Rates are approximate. Verify before trading.</div>
  `;
  setLoading(btn, false);
}

// ===========================================================================
// PROFIT / COMPOUND CALCULATOR
// ===========================================================================
const compoundModal = document.getElementById('compoundModal');
const compoundBtn   = document.getElementById('compoundBtn');
const compoundClose = document.getElementById('compoundClose');

compoundBtn.addEventListener('click', () => { compoundModal.style.display='flex'; document.body.style.overflow='hidden'; closeSidebar(); });
compoundClose.addEventListener('click', () => { compoundModal.style.display='none'; document.body.style.overflow=''; });
compoundModal.addEventListener('click', e => { if(e.target===compoundModal){compoundModal.style.display='none';document.body.style.overflow='';} });

function switchCTab(tab) {
  ['compound','target','daily'].forEach(t => {
    const btn = document.getElementById('ctab'+t.charAt(0).toUpperCase()+t.slice(1));
    const el  = document.getElementById('cTab'+t.charAt(0).toUpperCase()+t.slice(1));
    if(btn) btn.classList.toggle('active', t===tab);
    if(el)  el.style.display = t===tab ? 'block' : 'none';
  });
}

// Compound Growth
document.getElementById('cpCalc').addEventListener('click', () => {
  const capital  = parseFloat(document.getElementById('cpCapital').value) || 0;
  const monthly  = parseFloat(document.getElementById('cpMonthly').value) || 0;
  const months   = parseInt(document.getElementById('cpMonths').value)    || 12;
  const withdraw = parseFloat(document.getElementById('cpWithdraw').value) || 0;
  if (!capital || !monthly) return;

  let bal = capital;
  const rows = [];
  for (let m = 1; m <= months; m++) {
    const profit = bal * (monthly/100);
    bal = bal + profit - withdraw;
    if (bal < 0) bal = 0;
    if (m <= 6 || m === months || m % 3 === 0) {
      rows.push({m, bal, profit});
    }
  }

  const finalBal = bal;
  const totalProfit = finalBal - capital + (withdraw * months);
  const roi = ((finalBal - capital) / capital * 100).toFixed(1);

  document.getElementById('cpResult').innerHTML = `
    <div class="cp-result-highlight">
      <div class="cp-result-val">$${finalBal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      <div class="cp-result-label">Final Balance after ${months} months · ROI: ${roi}%</div>
    </div>
    <div style="overflow-x:auto;">
      <table class="cp-table">
        <tr><th>Month</th><th>Balance</th><th>Monthly Profit</th></tr>
        ${rows.map(r=>`<tr><td>Month ${r.m}</td><td class="pos">$${r.bal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td>$${r.profit.toFixed(2)}</td></tr>`).join('')}
      </table>
    </div>`;
});

// Target Planner
document.getElementById('tgCalc').addEventListener('click', () => {
  const capital = parseFloat(document.getElementById('tgCapital').value) || 0;
  const target  = parseFloat(document.getElementById('tgTarget').value)  || 0;
  const ret     = parseFloat(document.getElementById('tgReturn').value)  || 0;
  if (!capital || !target || !ret) return;

  const months = Math.ceil(Math.log(target/capital) / Math.log(1 + ret/100));
  const years  = Math.floor(months / 12);
  const remMo  = months % 12;
  const multiplier = (target/capital).toFixed(1);

  document.getElementById('tgResult').innerHTML = `
    <div class="cp-result-highlight">
      <div class="cp-result-val">${months} Months</div>
      <div class="cp-result-label">${years > 0 ? years+'y '+remMo+'m' : remMo+' months'} to reach $${target.toLocaleString()} (${multiplier}x your money)</div>
    </div>
    <div class="risk-stat" style="margin-top:10px;text-align:center;">
      <div class="risk-stat-label">To reach target faster, increase your monthly return %</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px;">
        ${[5,10,15,20,25,30].map(r => {
          const m = Math.ceil(Math.log(target/capital) / Math.log(1+r/100));
          return `<div class="cv-grid-item"><div class="cv-grid-val" style="font-size:13px;">${m}mo</div><div class="cv-grid-label">at ${r}%/mo</div></div>`;
        }).join('')}
      </div>
    </div>`;
});

// Daily Target
document.getElementById('dtCalc').addEventListener('click', () => {
  const account = parseFloat(document.getElementById('dtAccount').value) || 0;
  const goal    = parseFloat(document.getElementById('dtGoal').value)    || 0;
  const avgWin  = parseFloat(document.getElementById('dtAvgWin').value)  || 0;
  const winRate = parseFloat(document.getElementById('dtWinRate').value) || 60;
  if (!account || !goal || !avgWin) return;

  const tradesNeeded = Math.ceil(goal / (avgWin * (winRate/100)));
  const dailyRiskPct = ((goal / account) * 100).toFixed(2);
  const monthlyGoal  = (goal * 22).toFixed(0);
  const yearlyGoal   = (goal * 252).toFixed(0);

  document.getElementById('dtResult').innerHTML = `
    <div class="jt-stat-grid" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr));">
      <div class="jt-stat-card"><div class="jt-stat-label">Trades Needed/Day</div><div class="jt-stat-val violet">${tradesNeeded}</div></div>
      <div class="jt-stat-card"><div class="jt-stat-label">Daily Risk</div><div class="jt-stat-val red">${dailyRiskPct}%</div></div>
      <div class="jt-stat-card"><div class="jt-stat-label">Monthly (22 days)</div><div class="jt-stat-val green">$${parseFloat(monthlyGoal).toLocaleString()}</div></div>
      <div class="jt-stat-card"><div class="jt-stat-label">Yearly (252 days)</div><div class="jt-stat-val green">$${parseFloat(yearlyGoal).toLocaleString()}</div></div>
    </div>
    <div class="risk-disclaimer" style="margin-top:12px;">⚠️ ${parseFloat(dailyRiskPct)>5 ? 'High daily risk! Reduce goal or increase account size.' : 'Risk level looks manageable.'} Always stick to 1-2% per trade.</div>`;
});

// ===========================================================================
// TRADING DICTIONARY
// ===========================================================================
const dictionaryModal = document.getElementById('dictionaryModal');
const dictionaryBtn   = document.getElementById('dictionaryBtn');
const dictionaryClose = document.getElementById('dictionaryClose');

dictionaryBtn.addEventListener('click', () => { dictionaryModal.style.display='flex'; document.body.style.overflow='hidden'; closeSidebar(); setTimeout(()=>document.getElementById('dictSearch').focus(),100); });
dictionaryClose.addEventListener('click', () => { dictionaryModal.style.display='none'; document.body.style.overflow=''; });
dictionaryModal.addEventListener('click', e => { if(e.target===dictionaryModal){dictionaryModal.style.display='none';document.body.style.overflow='';} });

document.querySelectorAll('.dict-quick').forEach(b => b.addEventListener('click', () => { document.getElementById('dictSearch').value=b.dataset.term; lookupTerm(b.dataset.term); }));
document.getElementById('dictSearchBtn').addEventListener('click', () => lookupTerm(document.getElementById('dictSearch').value.trim()));
document.getElementById('dictSearch').addEventListener('keydown', e => { if(e.key==='Enter') lookupTerm(document.getElementById('dictSearch').value.trim()); });

async function lookupTerm(term) {
  if (!term) return;
  const btn    = document.getElementById('dictSearchBtn');
  const status = document.getElementById('dictStatus');
  const result = document.getElementById('dictResult');
  status.style.display = 'flex';
  result.innerHTML = '';
  setLoading(btn, true);

  const prompt = `You are a trading education expert. Explain the trading term: "${term}"

Return ONLY this exact JSON format:
{
  "term": "${term}",
  "category": "Technical Analysis",
  "definition": "Clear, simple 2-3 sentence definition a beginner can understand.",
  "example": "A real-world trading example showing how this is used.",
  "keyPoints": ["Point 1", "Point 2", "Point 3"],
  "relatedTerms": ["Term1", "Term2", "Term3"]
}`;

  try {
    const res = await fetch(`${API}/ai-tool`, { method:'POST', headers:authHeaders(true), body:JSON.stringify({prompt}) });
    const data = await res.json();
    const match = (data.text||'').match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no json');
    const d = JSON.parse(match[0]);

    result.innerHTML = `
      <div class="dict-card">
        <div class="dict-term">${escapeHtml(d.term)}</div>
        <div class="dict-cat">${escapeHtml(d.category || 'Trading')}</div>
        <div class="dict-def">${escapeHtml(d.definition)}</div>
        ${d.example ? `<div class="dict-example"><div class="dict-example-label">📌 Example</div>${escapeHtml(d.example)}</div>` : ''}
        ${d.keyPoints?.length ? `<ul style="padding-left:16px;color:var(--text-mid);font-size:13px;line-height:1.8;">${d.keyPoints.map(p=>`<li>${escapeHtml(p)}</li>`).join('')}</ul>` : ''}
        ${d.relatedTerms?.length ? `<div class="dict-related"><span class="dict-related-label">Related Terms</span>${d.relatedTerms.map(t=>`<button class="dict-related-chip" onclick="document.getElementById('dictSearch').value='${escapeHtml(t)}';lookupTerm('${escapeHtml(t)}')">${escapeHtml(t)}</button>`).join('')}</div>` : ''}
      </div>`;
  } catch(e) {
    result.innerHTML = `<div class="scanner-empty">⚠️ Could not find definition. Try again.</div>`;
  } finally {
    status.style.display = 'none';
    setLoading(btn, false);
  }
}

// ===========================================================================
// FEAR & GREED INDEX
// ===========================================================================
const fearGreedModal = document.getElementById('fearGreedModal');
const fearGreedBtn   = document.getElementById('fearGreedBtn');
const fearGreedClose = document.getElementById('fearGreedClose');

fearGreedBtn.addEventListener('click', () => { fearGreedModal.style.display='flex'; document.body.style.overflow='hidden'; closeSidebar(); });
fearGreedClose.addEventListener('click', () => { fearGreedModal.style.display='none'; document.body.style.overflow=''; });
fearGreedModal.addEventListener('click', e => { if(e.target===fearGreedModal){fearGreedModal.style.display='none';document.body.style.overflow='';} });
document.getElementById('fgRunBtn').addEventListener('click', runFearGreed);

async function runFearGreed() {
  const btn    = document.getElementById('fgRunBtn');
  const status = document.getElementById('fgStatus');
  const result = document.getElementById('fgResult');
  const market = document.getElementById('fgMarket').value;
  status.style.display = 'flex';
  result.innerHTML = '';
  setLoading(btn, true);

  const marketNames = { crypto:'Crypto (BTC/ETH)', stocks:'Stocks (S&P 500)', forex:'Forex (DXY)', gold:'Gold (XAU/USD)' };

  const prompt = `You are a market sentiment analyst. Analyze the current Fear & Greed Index for: ${marketNames[market]}

Return ONLY this exact JSON format:
{
  "score": 62,
  "label": "Greed",
  "emoji": "😄",
  "color": "#22c55e",
  "description": "2-3 sentence explanation of current market sentiment and what it means for traders.",
  "signals": [
    {"name": "Price Momentum", "value": "Bullish", "icon": "📈"},
    {"name": "Market Volatility", "value": "Low", "icon": "📊"},
    {"name": "Trading Volume", "value": "High", "icon": "🔊"},
    {"name": "Social Sentiment", "value": "Positive", "icon": "💬"},
    {"name": "Institutional Flow", "value": "Buying", "icon": "🏦"}
  ],
  "advice": "Short actionable advice for traders based on this sentiment level."
}

Score guide: 0-25=Extreme Fear, 26-45=Fear, 46-55=Neutral, 56-75=Greed, 76-100=Extreme Greed`;

  try {
    const res  = await fetch(`${API}/ai-tool`, { method:'POST', headers:authHeaders(true), body:JSON.stringify({prompt}) });
    const data = await res.json();
    const match = (data.text||'').match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no json');
    const d = JSON.parse(match[0]);

    result.innerHTML = `
      <div class="fg-result-box">
        <div class="fg-score-big" style="color:${escapeHtml(d.color)}">${d.emoji} ${d.score}</div>
        <div class="fg-label-big" style="color:${escapeHtml(d.color)}">${escapeHtml(d.label)}</div>
        <div class="fg-desc">${escapeHtml(d.description)}</div>
      </div>
      <div class="fg-signals">
        ${(d.signals||[]).map(s=>`<div class="fg-signal"><div class="fg-signal-name">${s.icon} ${escapeHtml(s.name)}</div><div class="fg-signal-val">${escapeHtml(s.value)}</div></div>`).join('')}
      </div>
      <div class="coach-goal" style="margin-top:0;">
        <div class="coach-goal-label">💡 Trader Advice</div>
        ${escapeHtml(d.advice)}
      </div>`;
  } catch(e) {
    result.innerHTML = `<div class="scanner-empty">⚠️ Could not fetch index. Try again.</div>`;
  } finally {
    status.style.display = 'none';
    setLoading(btn, false);
  }
}

// ===========================================================================
// QUICK AI OPINION
// ===========================================================================
const quickOpinionModal = document.getElementById('quickOpinionModal');
const quickOpinionBtn   = document.getElementById('quickOpinionBtn');
const quickOpinionClose = document.getElementById('quickOpinionClose');

quickOpinionBtn.addEventListener('click', () => { quickOpinionModal.style.display='flex'; document.body.style.overflow='hidden'; closeSidebar(); setTimeout(()=>document.getElementById('qoSymbol').focus(),100); });
quickOpinionClose.addEventListener('click', () => { quickOpinionModal.style.display='none'; document.body.style.overflow=''; });
quickOpinionModal.addEventListener('click', e => { if(e.target===quickOpinionModal){quickOpinionModal.style.display='none';document.body.style.overflow='';} });

document.querySelectorAll('.qo-quick').forEach(b => b.addEventListener('click', () => { document.getElementById('qoSymbol').value=b.dataset.sym; runQuickOpinion(); }));
document.getElementById('qoRunBtn').addEventListener('click', runQuickOpinion);
document.getElementById('qoSymbol').addEventListener('keydown', e => { if(e.key==='Enter') runQuickOpinion(); });

async function runQuickOpinion() {
  const sym = document.getElementById('qoSymbol').value.trim();
  if (!sym) { document.getElementById('qoSymbol').focus(); return; }
  const btn    = document.getElementById('qoRunBtn');
  const status = document.getElementById('qoStatus');
  const result = document.getElementById('qoResult');
  status.style.display = 'flex';
  result.innerHTML = '';
  setLoading(btn, true);

  // Try to get live price
  let liveData = '';
  try {
    const r = await fetch(`${API}/market/quote?symbol=${encodeURIComponent(sym)}`, { headers: authHeaders() });
    if (r.ok) { const d = await r.json(); if(d.quote?.price) liveData = `Current Price: ${d.quote.price}, Change: ${d.quote.percentChange}%`; }
  } catch(_) {}

  const prompt = `Give a QUICK trading opinion for: ${sym}${liveData ? '\n'+liveData : ''}

Return ONLY this exact JSON:
{
  "symbol": "${sym}",
  "verdict": "BUY",
  "emoji": "🚀",
  "confidence": 72,
  "timeframe": "Short-term (1-3 days)",
  "oneLiner": "One punchy sentence summarizing the verdict.",
  "reasons": [
    "Reason 1 — specific and factual",
    "Reason 2 — specific and factual",
    "Reason 3 — specific and factual"
  ],
  "risk": "Key risk that could invalidate this view",
  "keyLevel": "Most important price level to watch"
}

verdict must be: BUY, SELL, or WAIT`;

  try {
    const res  = await fetch(`${API}/ai-tool`, { method:'POST', headers:authHeaders(true), body:JSON.stringify({prompt}) });
    const data = await res.json();
    const match = (data.text||'').match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no json');
    const d = JSON.parse(match[0]);

    const vClass = d.verdict==='BUY' ? 'buy' : d.verdict==='SELL' ? 'sell' : 'wait';
    const vColor = d.verdict==='BUY' ? 'var(--green)' : d.verdict==='SELL' ? 'var(--red)' : '#f59e0b';
    const conf   = Math.min(100, Math.max(0, d.confidence||50));

    result.innerHTML = `
      <div class="qo-verdict-box ${vClass}">
        <div class="qo-verdict-emoji">${escapeHtml(d.emoji||'🤔')}</div>
        <div class="qo-verdict-text ${vClass}">${escapeHtml(d.verdict)}</div>
        <div class="qo-verdict-sub">${escapeHtml(d.symbol)} · ${escapeHtml(d.timeframe||'')}</div>
        <div style="margin-top:8px;font-size:14px;color:var(--text-mid);font-style:italic;">"${escapeHtml(d.oneLiner)}"</div>
      </div>

      <div class="qo-reasons">
        ${(d.reasons||[]).map((r,i)=>`<div class="qo-reason"><span style="font-size:16px;flex-shrink:0;">${i===0?'✅':i===1?'📌':'🔍'}</span><span>${escapeHtml(r)}</span></div>`).join('')}
      </div>

      <div class="qo-confidence">
        <div class="qo-conf-label">Confidence Score: ${conf}%</div>
        <div class="qo-conf-bar"><div class="qo-conf-fill" id="qoConfFill" style="width:0%;background:${vColor};"></div></div>
      </div>

      ${d.keyLevel ? `<div style="margin-top:10px;font-size:13px;color:var(--text-mid);padding:10px 14px;background:var(--panel);border:1px solid var(--panel-border);border-radius:10px;">📍 <strong>Key Level:</strong> ${escapeHtml(d.keyLevel)}</div>` : ''}
      ${d.risk ? `<div style="margin-top:8px;font-size:13px;color:var(--text-mid);padding:10px 14px;background:var(--red-dim);border:1px solid rgba(239,68,68,0.2);border-radius:10px;">⚠️ <strong>Risk:</strong> ${escapeHtml(d.risk)}</div>` : ''}

      <div style="margin-top:14px;display:flex;gap:8px;">
        <button class="debate-action-btn primary" onclick="closeQuickOpinion();setInput('Full technical analysis of ${escapeHtml(sym)}');sendMessage();">📊 Full Analysis</button>
        <button class="debate-action-btn" onclick="document.getElementById('qoResult').innerHTML='';document.getElementById('qoSymbol').value='';document.getElementById('qoSymbol').focus();">🔄 New Opinion</button>
      </div>
      <div style="font-size:11px;color:var(--text-dim);text-align:center;margin-top:8px;">*Not financial advice. Educational only.</div>
    `;

    requestAnimationFrame(() => setTimeout(() => {
      const fill = document.getElementById('qoConfFill');
      if (fill) fill.style.width = conf + '%';
    }, 100));
  } catch(e) {
    result.innerHTML = `<div class="scanner-empty">⚠️ Could not generate opinion. Try again.</div>`;
  } finally {
    status.style.display = 'none';
    setLoading(btn, false);
  }
}

function closeQuickOpinion() {
  quickOpinionModal.style.display = 'none';
  document.body.style.overflow = '';
}
