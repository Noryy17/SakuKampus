import express from 'express';
import { db } from '../config/database.js';
import { authMiddleware } from '../middlewares/auth.js';

export const dashboardRouter = express.Router();

function toLocalDateStr(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toLocalYearMonthStr(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * GET /api/dashboard/summary
 * Balance, monthly income, monthly expenses, recent transactions (F-06, F-08)
 */
dashboardRouter.get('/summary', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const now = new Date();
  const currentYearMonth = toLocalYearMonthStr(now); // 'YYYY-MM'

  // Total Lifetime Balance
  const incomeTotal = db.prepare(`
    SELECT COALESCE(SUM(t.amount), 0) as total
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND c.type = 'income'
  `).get(userId).total;

  const expenseTotal = db.prepare(`
    SELECT COALESCE(SUM(t.amount), 0) as total
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND c.type = 'expense'
  `).get(userId).total;

  const totalBalance = incomeTotal - expenseTotal;

  // Current Month Totals
  const monthlyIncome = db.prepare(`
    SELECT COALESCE(SUM(t.amount), 0) as total
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND c.type = 'income' AND t.occurred_on LIKE ?
  `).get(userId, `${currentYearMonth}%`).total;

  const monthlyExpense = db.prepare(`
    SELECT COALESCE(SUM(t.amount), 0) as total
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND c.type = 'expense' AND t.occurred_on LIKE ?
  `).get(userId, `${currentYearMonth}%`).total;

  // Count total transactions
  const txCount = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE user_id = ?').get(userId).count;

  // Recent 5 transactions
  const recentTransactions = db.prepare(`
    SELECT t.*, c.name as category_name, c.type as category_type
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ?
    ORDER BY t.occurred_on DESC, t.id DESC
    LIMIT 5
  `).all(userId);

  // Today's Chat Usage
  const todayDate = toLocalDateStr(now);
  const usage = db.prepare('SELECT request_count, llm_count FROM chat_usage WHERE user_id = ? AND usage_date = ?').get(userId, todayDate) || { request_count: 0, llm_count: 0 };
  const dailyLimit = parseInt(process.env.DAILY_CHAT_LIMIT || '50', 10);

  res.json({
    success: true,
    data: {
      total_balance: totalBalance,
      lifetime_income: incomeTotal,
      lifetime_expense: expenseTotal,
      monthly_income: monthlyIncome,
      monthly_expense: monthlyExpense,
      monthly_net: monthlyIncome - monthlyExpense,
      transaction_count: txCount,
      recent_transactions: recentTransactions,
      chat_quota: {
        used: usage.request_count,
        limit: dailyLimit,
        remaining: Math.max(0, dailyLimit - usage.request_count)
      }
    }
  });
});

/**
 * GET /api/dashboard/charts
 * Category distribution & monthly trend data for Chart.js (F-07, F-08)
 */
dashboardRouter.get('/charts', authMiddleware, (req, res) => {
  const userId = req.user.id;

  // 1. Expense Breakdown by Category
  const categoryBreakdown = db.prepare(`
    SELECT c.name, COALESCE(SUM(t.amount), 0) as total
    FROM categories c
    LEFT JOIN transactions t ON c.id = t.category_id AND t.user_id = ?
    WHERE c.type = 'expense'
    GROUP BY c.id, c.name
    HAVING total > 0
    ORDER BY total DESC
  `).all(userId);

  // 2. Monthly Trend (last 6 months)
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = toLocalYearMonthStr(d); // YYYY-MM
    const monthName = d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
    months.push({ ym, name: monthName });
  }

  const monthlyTrend = months.map(m => {
    const income = db.prepare(`
      SELECT COALESCE(SUM(t.amount), 0) as total
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND c.type = 'income' AND t.occurred_on LIKE ?
    `).get(userId, `${m.ym}%`).total;

    const expense = db.prepare(`
      SELECT COALESCE(SUM(t.amount), 0) as total
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND c.type = 'expense' AND t.occurred_on LIKE ?
    `).get(userId, `${m.ym}%`).total;

    return {
      month: m.name,
      year_month: m.ym,
      income,
      expense,
      net: income - expense
    };
  });

  // 3. Daily Trend Helper (Last 7 and 30 days)
  function getDailyTrend(numDays) {
    const result = [];
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = toLocalDateStr(d);
      const dayLabel = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

      const income = db.prepare(`
        SELECT COALESCE(SUM(t.amount), 0) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.user_id = ? AND c.type = 'income' AND t.occurred_on = ?
      `).get(userId, dateStr).total;

      const expense = db.prepare(`
        SELECT COALESCE(SUM(t.amount), 0) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.user_id = ? AND c.type = 'expense' AND t.occurred_on = ?
      `).get(userId, dateStr).total;

      result.push({
        date: dateStr,
        label: dayLabel,
        income,
        expense,
        net: income - expense
      });
    }
    return result;
  }

  res.json({
    success: true,
    data: {
      category_breakdown: categoryBreakdown,
      monthly_trend: monthlyTrend,
      daily_trend_7d: getDailyTrend(7),
      daily_trend_30d: getDailyTrend(30)
    }
  });
});
