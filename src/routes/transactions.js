import express from 'express';
import { db } from '../config/database.js';
import { authMiddleware } from '../middlewares/auth.js';

export const transactionsRouter = express.Router();

/**
 * GET /api/transactions
 * Retrieve transaction history with filtering & search (F-05, F-08)
 */
transactionsRouter.get('/', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { type, category_id, start_date, end_date, search, limit = 100 } = req.query;

  let query = `
    SELECT t.*, c.name as category_name, c.type as category_type
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ?
  `;
  const params = [userId];

  if (type && (type === 'income' || type === 'expense')) {
    query += ` AND c.type = ?`;
    params.push(type);
  }

  if (category_id) {
    query += ` AND t.category_id = ?`;
    params.push(category_id);
  }

  if (start_date) {
    query += ` AND t.occurred_on >= ?`;
    params.push(start_date);
  }

  if (end_date) {
    query += ` AND t.occurred_on <= ?`;
    params.push(end_date);
  }

  if (search) {
    query += ` AND (t.description LIKE ? OR t.raw_text LIKE ? OR c.name LIKE ?)`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  query += ` ORDER BY t.occurred_on DESC, t.id DESC LIMIT ?`;
  params.push(parseInt(limit, 10));

  const rows = db.prepare(query).all(...params);
  res.json({ success: true, count: rows.length, data: rows });
});

/**
 * POST /api/transactions
 * Create a new transaction manually (F-08, F-10)
 */
transactionsRouter.post('/', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { amount, category_id, description, occurred_on } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Nominal transaksi harus lebih dari 0.' });
  }

  const category = db.prepare('SELECT id, name, type FROM categories WHERE id = ?').get(category_id);
  if (!category) {
    return res.status(400).json({ error: 'Kategori tidak valid.' });
  }

  const result = db.prepare(`
    INSERT INTO transactions (
      user_id, category_id, amount, description, raw_text, source, parsed_by, occurred_on
    ) VALUES (?, ?, ?, ?, ?, 'chat', 'rule', ?)
  `).run(
    userId,
    category.id,
    Math.round(Number(amount)),
    description ? description.trim() : `Transaksi ${category.name}`,
    `Manual: ${category.name} ${amount}`,
    occurred_on || new Date().toISOString().split('T')[0]
  );

  const newTx = db.prepare(`
    SELECT t.*, c.name as category_name, c.type as category_type
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  res.json({ success: true, message: 'Transaksi berhasil ditambahkan.', data: newTx });
});

/**
 * GET /api/transactions/:id
 * Get single transaction
 */
transactionsRouter.get('/:id', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const tx = db.prepare(`
    SELECT t.*, c.name as category_name, c.type as category_type
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.id = ? AND t.user_id = ?
  `).get(req.params.id, userId);

  if (!tx) {
    return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
  }

  res.json({ success: true, data: tx });
});

/**
 * PUT /api/transactions/:id
 * Edit transaction (F-10, F-08)
 */
transactionsRouter.put('/:id', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const txId = req.params.id;
  const { amount, category_id, description, occurred_on } = req.body;

  // Verify ownership (F-08)
  const existing = db.prepare('SELECT id FROM transactions WHERE id = ? AND user_id = ?').get(txId, userId);
  if (!existing) {
    return res.status(404).json({ error: 'Transaksi tidak ditemukan atau Anda tidak memiliki akses.' });
  }

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Nominal transaksi harus lebih dari 0.' });
  }

  // Verify category exists
  const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(category_id);
  if (!category) {
    return res.status(400).json({ error: 'Kategori tidak valid.' });
  }

  db.prepare(`
    UPDATE transactions
    SET amount = ?,
        category_id = ?,
        description = ?,
        occurred_on = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(
    Math.round(Number(amount)),
    category_id,
    description ? description.trim() : 'Transaksi',
    occurred_on || new Date().toISOString().split('T')[0],
    txId,
    userId
  );

  const updatedTx = db.prepare(`
    SELECT t.*, c.name as category_name, c.type as category_type
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.id = ?
  `).get(txId);

  res.json({ success: true, message: 'Transaksi berhasil diperbarui.', data: updatedTx });
});

/**
 * DELETE /api/transactions/:id
 * Delete transaction (F-10, F-08)
 */
transactionsRouter.delete('/:id', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const txId = req.params.id;

  const result = db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(txId, userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Transaksi tidak ditemukan atau Anda tidak memiliki akses.' });
  }

  res.json({ success: true, message: 'Transaksi berhasil dihapus.' });
});

/**
 * GET /api/categories
 * List all 12 categories
 */
transactionsRouter.get('/meta/categories', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY type DESC, id ASC').all();
  res.json({ success: true, data: categories });
});
