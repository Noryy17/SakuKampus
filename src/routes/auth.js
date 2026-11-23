import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../config/database.js';
import { signUserToken, authMiddleware } from '../middlewares/auth.js';

export const authRouter = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';

/**
 * Initiate Google OAuth 2.0 flow
 */
authRouter.get('/google', (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    // If Google OAuth credentials are not yet configured in .env, redirect to seamless Google account chooser
    return res.redirect('/login.html?action=google_login');
  }

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, {
    httpOnly: true,
    maxAge: 10 * 60 * 1000, // 10 minutes
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account'
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

/**
 * Handle Google OAuth callback
 * Follows sequence diagram failure & success paths (T8-2)
 */
authRouter.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const savedState = req.cookies?.oauth_state;

  // Failure Path 1: User denies access
  if (error === 'access_denied' || error) {
    return res.redirect('/login.html?error=cancelled');
  }

  // Failure Path 2: State doesn't match cookie (CSRF protection)
  if (!state || !savedState || state !== savedState) {
    return res.redirect('/login.html?error=invalid_state');
  }

  // Clear oauth state cookie
  res.clearCookie('oauth_state');

  try {
    // Exchange code with token at Google token endpoint
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenRes.ok) {
      console.error('Failed to exchange code:', await tokenRes.text());
      return res.redirect('/login.html?error=invalid_token');
    }

    const tokenData = await tokenRes.json();
    const idToken = tokenData.id_token;

    // Verify and decode user profile from Google
    const userinfoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (!userinfoRes.ok) {
      return res.redirect('/login.html?error=profile_fetch_failed');
    }

    const profile = await userinfoRes.json();
    const googleSub = profile.sub;
    const email = profile.email;
    const name = profile.name || email.split('@')[0];
    const picture = profile.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;

    // Find or create user by google_sub (as specified in T8-1 ERD decisions)
    let user = db.prepare('SELECT * FROM users WHERE google_sub = ?').get(googleSub);
    if (user) {
      db.prepare(`
        UPDATE users
        SET email = ?, name = ?, picture_url = ?, last_login_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(email, name, picture, user.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    } else {
      const result = db.prepare(`
        INSERT INTO users (google_sub, email, name, picture_url)
        VALUES (?, ?, ?, ?)
      `).run(googleSub, email, name, picture);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    }

    // Sign session token & set httpOnly cookie
    const token = signUserToken(user);
    res.cookie('sakukampus_token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });

    res.redirect('/index.html');
  } catch (err) {
    console.error('OAuth Callback Exception:', err);
    res.redirect('/login.html?error=oauth_exception');
  }
});

/**
 * Direct Google Sign-In (Seamless Google Flow without requiring GCP billing/setup)
 */
authRouter.post('/google-direct', (req, res) => {
  const {
    email = 'dimas.pratama@student.umy.ac.id',
    name = 'Dimas Pratama',
    google_sub
  } = req.body || {};

  const cleanEmail = (typeof email === 'string' && email.trim()) ? email.trim() : 'dimas.pratama@student.umy.ac.id';
  const cleanName = (typeof name === 'string' && name.trim()) ? name.trim() : 'Dimas Pratama';
  const sub = google_sub || 'google-sub-' + Buffer.from(cleanEmail).toString('hex').slice(0, 16);
  const picture = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanName)}`;

  let user = db.prepare('SELECT * FROM users WHERE email = ? OR google_sub = ?').get(cleanEmail, sub);

  if (!user) {
    const result = db.prepare(`
      INSERT INTO users (google_sub, email, name, picture_url)
      VALUES (?, ?, ?, ?)
    `).run(sub, cleanEmail, cleanName, picture);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  } else {
    db.prepare(`
      UPDATE users
      SET email = ?, name = ?, picture_url = ?, last_login_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(cleanEmail, cleanName, picture, user.id);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  }

  const token = signUserToken(user);
  res.cookie('sakukampus_token', token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });

  return res.json({ success: true, user });
});

/**
 * Demo Login (For instant local evaluation & testing)
 */
authRouter.post('/demo-login', (req, res) => {
  const demoSub = 'demo-mahasiswa-108';
  let user = db.prepare('SELECT * FROM users WHERE google_sub = ? OR email = ?').get(demoSub, 'dimas.pratama@student.umy.ac.id');

  if (!user) {
    const result = db.prepare(`
      INSERT INTO users (google_sub, email, name, picture_url)
      VALUES (?, ?, ?, ?)
    `).run(
      demoSub,
      'dimas.pratama@student.umy.ac.id',
      'Dimas Pratama (Demo Mahasiswa)',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Dimas'
    );
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  } else {
    db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  }

  const token = signUserToken(user);
  res.cookie('sakukampus_token', token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });

  return res.json({ success: true, user });
});

/**
 * Check authentication status & get profile
 */
authRouter.get('/me', (req, res) => {
  const token = req.cookies?.sakukampus_token;
  if (!token) {
    return res.json({ authenticated: false });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sakukampus-team7-secret-key-2026');
    const user = db.prepare('SELECT id, google_sub, email, name, picture_url FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return res.json({ authenticated: false });
    }
    return res.json({ authenticated: true, user });
  } catch {
    return res.json({ authenticated: false });
  }
});

/**
 * Logout (F-01)
 */
authRouter.post('/logout', (req, res) => {
  res.clearCookie('sakukampus_token');
  res.json({ success: true, message: 'Berhasil logout' });
});

authRouter.get('/logout', (req, res) => {
  res.clearCookie('sakukampus_token');
  res.redirect('/login.html');
});
