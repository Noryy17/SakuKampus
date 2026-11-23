import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { chatRouter } from './routes/chat.js';
import { transactionsRouter } from './routes/transactions.js';
import { dashboardRouter } from './routes/dashboard.js';
import { initDatabase } from './config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.resolve(__dirname, '../public');

// Initialize database schema and initial categories
initDatabase();

export const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'sakukampus-cookie-secret'));

// Static files
app.use(express.static(publicPath));

// API Routes
app.use('/auth', authRouter);
app.use('/api/chat', chatRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/dashboard', dashboardRouter);

// Clean URL routing to frontend
app.get('/login', (req, res) => {
  res.sendFile(path.join(publicPath, 'login.html'));
});

app.get(['/', '/dashboard', '/chat', '/transactions', '/about'], (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Fallback error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server internal.' });
});
