/**
 * routes/auth.js
 * Registration, login, and current-user endpoints.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// ── Admin credentials (hidden, not shown in UI) ───────────────────────────
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@apexai.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ApexAdmin@2024';
const ADMIN_NAME     = 'Admin';

// Auto-create admin user on first request if not exists
let adminCreated = false;
async function ensureAdmin() {
  if (adminCreated) return;
  adminCreated = true;
  const existing = db.getUserByEmail(ADMIN_EMAIL);
  if (!existing) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    db.createUser({ name: ADMIN_NAME, email: ADMIN_EMAIL, passwordHash });
    console.log('✅ Admin user created:', ADMIN_EMAIL);
  }
}
ensureAdmin();
// ──────────────────────────────────────────────────────────────────────────

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.toLowerCase();
    const existing = db.getUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const dbUser = db.createUser({ name: name.trim(), email: normalizedEmail, passwordHash });

    const user = { id: dbUser.id, name: dbUser.name, email: dbUser.email };
    const token = signToken(user);

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const row = db.getUserByEmail(email.toLowerCase());
    if (!row) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, row.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = { id: row.id, name: row.name, email: row.email };
    const token = signToken(user);

    res.json({ token, user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const row = db.getUserById(req.user.id);
  if (!row) return res.status(404).json({ error: 'User not found' });
  res.json({ user: { id: row.id, name: row.name, email: row.email, created_at: row.created_at } });
});

// PATCH /api/auth/profile — update name and/or email
router.patch('/profile', requireAuth, async (req, res) => {
  try {
    const { name, email } = req.body;
    const row = db.getUserById(req.user.id);
    if (!row) return res.status(404).json({ error: 'User not found' });

    const newName  = name  ? name.trim()          : row.name;
    const newEmail = email ? email.toLowerCase()  : row.email;

    if (email && !isValidEmail(newEmail)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (email && newEmail !== row.email) {
      const existing = db.getUserByEmail(newEmail);
      if (existing) return res.status(409).json({ error: 'Email already in use' });
    }

    const updated = db.updateUser(req.user.id, { name: newName, email: newEmail });
    const user    = { id: updated.id, name: updated.name, email: updated.email };
    const token   = signToken(user);
    res.json({ user, token });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/auth/password — change password
router.patch('/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const row = db.getUserById(req.user.id);
    if (!row) return res.status(404).json({ error: 'User not found' });

    const match = await bcrypt.compare(currentPassword, row.password_hash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    db.updateUserPassword(req.user.id, passwordHash);
    res.json({ success: true });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/auth/account — delete account + all data
router.delete('/account', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'password is required to confirm deletion' });

    const row = db.getUserById(req.user.id);
    if (!row) return res.status(404).json({ error: 'User not found' });

    const match = await bcrypt.compare(password, row.password_hash);
    if (!match) return res.status(401).json({ error: 'Incorrect password' });

    db.deleteUser(req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Account delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
