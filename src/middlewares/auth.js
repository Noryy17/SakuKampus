import jwt from 'jsonwebtoken';
import { db } from '../config/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'sakukampus-team7-secret-key-2026';

export function signUserToken(user) {
  return jwt.sign(
    {
      id: user.id,
      google_sub: user.google_sub,
      email: user.email,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authMiddleware(req, res, next) {
  const token = req.cookies?.sakukampus_token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Sesi tidak ditemukan. Silakan login terlebih dahulu.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Verify user exists in database
    const user = db.prepare('SELECT id, google_sub, email, name, picture_url FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      res.clearCookie('sakukampus_token');
      return res.status(401).json({ error: 'Pengguna tidak valid.' });
    }

    req.user = user;
    next();
  } catch (err) {
    res.clearCookie('sakukampus_token');
    return res.status(401).json({ error: 'Sesi kedaluwarsa atau tidak valid.' });
  }
}
