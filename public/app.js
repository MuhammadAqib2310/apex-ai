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
    const res = await fetch(`${API}/chat`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ message: prompt }),
    });

    if (!res.ok) throw new Error('API error');

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText  = '';
    let buffer    = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        try {
          const json = JSON.parse(trimmed.slice(6));
          if (json.type === 'delta') fullText += json.delta;
        } catch (_) {}
      }
    }

    // Parse JSON from AI response
    const jsonMatch = fullText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const items = JSON.parse(jsonMatch[0]);
    renderScannerResults(items);

  } catch (err) {
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
    const res = await fetch(`${API}/chat`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ message: prompt }),
    });

    if (!res.ok) throw new Error('API error');

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText  = '';
    let buffer    = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        try {
          const json = JSON.parse(trimmed.slice(6));
          if (json.type === 'delta') fullText += json.delta;
        } catch (_) {}
      }
    }

    // Parse JSON
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const data = JSON.parse(jsonMatch[0]);
    renderDebateResults(data);

  } catch (err) {
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
