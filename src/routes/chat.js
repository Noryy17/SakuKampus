import express from 'express';
import { db } from '../config/database.js';
import { authMiddleware } from '../middlewares/auth.js';
import { parseSentenceWithRules } from '../services/ruleParser.js';
import { parseSentenceWithLLM } from '../services/llmService.js';
import {
  isConsultationQuery,
  getUserFinancialContext,
  getGeminiConsultationResponse,
  handleRuleBasedAdvice
} from '../services/financialAdvisor.js';

export const chatRouter = express.Router();

const rawLimit = process.env.DAILY_CHAT_LIMIT;
const isUnlimited = rawLimit === '0' || rawLimit === '-1' || rawLimit === 'unlimited';
const parsedLimit = parseInt(rawLimit || '50', 10);
const DAILY_LIMIT = isUnlimited ? Infinity : parsedLimit;

function formatUsagePayload(usedCount) {
  return {
    used: usedCount,
    limit: isUnlimited ? 'Unlimited' : DAILY_LIMIT,
    remaining: isUnlimited ? 'Unlimited' : Math.max(0, DAILY_LIMIT - usedCount)
  };
}

/**
 * Helper to get or create chat usage for today
 */
function getTodayUsage(userId, todayDate) {
  let usage = db.prepare('SELECT * FROM chat_usage WHERE user_id = ? AND usage_date = ?').get(userId, todayDate);
  if (!usage) {
    db.prepare('INSERT INTO chat_usage (user_id, usage_date, request_count, llm_count) VALUES (?, ?, 0, 0)').run(userId, todayDate);
    usage = { user_id: userId, usage_date: todayDate, request_count: 0, llm_count: 0 };
  }
  return usage;
}

/**
 * POST /api/chat
 * Versatile Financial Assistant Endpoint
 * - Handles financial questions (sisa uang saku, cek tagihan, utang, jadwal bayar)
 * - Handles transaction recording via chat & voice
 */
chatRouter.post('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { message, source = 'chat' } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
  }

  const cleanMessage = message.trim();
  const todayDate = new Date().toISOString().split('T')[0];

  // 1. Check Rate Limit / Pembatasan Pemakaian (F-09)
  const usage = getTodayUsage(userId, todayDate);
  if (usage.request_count >= DAILY_LIMIT) {
    return res.json({
      success: false,
      is_rate_limited: true,
      message: `⚠️ Batas pemakaian harian tercapai (${DAILY_LIMIT}/${DAILY_LIMIT} pesan). Kuota akan direset besok. Anda tetap dapat mengakses dashboard dan riwayat transaksi.`,
      usage: {
        used: usage.request_count,
        limit: DAILY_LIMIT,
        remaining: 0
      }
    });
  }

  // Increment request_count in chat_usage
  db.prepare(`
    UPDATE chat_usage
    SET request_count = request_count + 1
    WHERE user_id = ? AND usage_date = ?
  `).run(userId, todayDate);

  const updatedUsage = db.prepare('SELECT request_count, llm_count FROM chat_usage WHERE user_id = ? AND usage_date = ?').get(userId, todayDate);

  // 2. CHECK IF THIS IS A FINANCIAL QUERY / CONSULTATION
  // (e.g., "sisa uang saku berapa?", "cek tagihan terbaru", "ada utang?", "jadwal bayar apa saja?")
  if (isConsultationQuery(cleanMessage)) {
    const context = getUserFinancialContext(userId);
    const reply = await getGeminiConsultationResponse(cleanMessage, context);

    return res.json({
      success: true,
      is_consultation: true,
      bot_reply: reply,
      usage: formatUsagePayload(updatedUsage.request_count)
    });
  }

  // 3. Otherwise, treat as Transaction Recording:
  // Parse sentence with Rule-based Parser first (Cost mitigation strategy T8-3)
  let parseResult = parseSentenceWithRules(cleanMessage);
  let parsedBy = 'rule';

  // Fallback to LLM if rule parsing fails (and Gemini key exists)
  if (!parseResult.success && process.env.GEMINI_API_KEY) {
    db.prepare(`
      UPDATE chat_usage
      SET llm_count = llm_count + 1
      WHERE user_id = ? AND usage_date = ?
    `).run(userId, todayDate);

    const llmResult = await parseSentenceWithLLM(cleanMessage);
    if (llmResult.success) {
      parseResult = llmResult;
      parsedBy = 'llm';
    }
  }

  // 4. Handle Unrecognized Sentence (F-04) - Break early, do not write to database
  if (!parseResult.success) {
    // If not a transaction and not recognized, offer friendly consultation advice or examples
    const finContext = getUserFinancialContext(userId);
    const fallbackAdvice = handleRuleBasedAdvice(cleanMessage, finContext);

    return res.json({
      success: false,
      is_unrecognized: true,
      bot_reply: `Maaf, SakuBot belum memahami kalimat tersebut 🤔.\n\n` +
        `Anda bisa **mencatat transaksi** dengan contoh format:\n` +
        `• "makan siang 15rb"\n` +
        `• "kemarin beli bensin 25.000"\n` +
        `• "gajian 3 juta"\n` +
        `• "dapat uang saku 500rb"\n\n` +
        `Atau **menanyakan kondisi keuangan** Anda, contohnya:\n` +
        `• "Sisa uang saku saya berapa?"\n` +
        `• "Cek adakah tagihan terbaru?"\n` +
        `• "Apakah saya punya catatan utang?"\n` +
        `• "Apa saja jadwal bayar bulan ini?"`,
      usage: formatUsagePayload(updatedUsage.request_count)
    });
  }

  // 5. Look up Category ID from categories table
  const txData = parseResult.data;
  let categoryRow = db.prepare('SELECT id, name, type FROM categories WHERE name = ?').get(txData.category);

  if (!categoryRow) {
    const defaultCatName = txData.type === 'income' ? 'Lain-lain pemasukan' : 'Lain-lain pengeluaran';
    categoryRow = db.prepare('SELECT id, name, type FROM categories WHERE name = ?').get(defaultCatName);
  }

  // 6. Save Transaction to database (F-08: Strictly per req.user.id)
  const insertStmt = db.prepare(`
    INSERT INTO transactions (
      user_id, category_id, amount, description, raw_text, source, parsed_by, occurred_on
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const txSource = source === 'voice' ? 'voice' : 'chat';
  const insertResult = insertStmt.run(
    userId,
    categoryRow.id,
    txData.amount,
    txData.description,
    cleanMessage,
    txSource,
    parsedBy,
    txData.occurred_on
  );

  const createdTx = db.prepare(`
    SELECT t.*, c.name as category_name, c.type as category_type
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.id = ?
  `).get(insertResult.lastInsertRowid);

  // 7. Format success confirmation message
  const formattedNominal = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(createdTx.amount);
  const typeText = createdTx.category_type === 'income' ? 'Pemasukan' : 'Pengeluaran';
  const parserBadge = parsedBy === 'rule' ? '⚡ Aturan Cepat' : '🤖 AI Gemini';
  const sourceBadge = txSource === 'voice' ? '🎙️ Suara' : '💬 Teks';

  const isDebt = /\b(utang|hutang|pinjam|minjam|meminjam|ngutang|berutang|kasbon)\b/i.test(createdTx.description) ||
    /\b(utang|hutang|pinjam|minjam|meminjam|ngutang|berutang|kasbon)\b/i.test(cleanMessage);
  const debtNote = isDebt ? `\n• *💡 Dicatat sebagai pengeluaran (kewajiban utang/pinjaman) sehingga saldo berkurang.*` : '';

  const botReply = `✅ Berhasil mencatat ${typeText.toLowerCase()}!\n` +
    `• **Kategori**: ${createdTx.category_name}\n` +
    `• **Nominal**: ${formattedNominal}\n` +
    `• **Keterangan**: ${createdTx.description}\n` +
    `• **Tanggal**: ${createdTx.occurred_on}${debtNote}\n` +
    `• *(${parserBadge} via ${sourceBadge})*`;

  return res.json({
    success: true,
    bot_reply: botReply,
    transaction: createdTx,
    usage: formatUsagePayload(updatedUsage.request_count)
  });
});

/**
 * GET /api/chat/usage
 * Get current user's usage status for today
 */
chatRouter.get('/usage', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const todayDate = new Date().toISOString().split('T')[0];
  const usage = getTodayUsage(userId, todayDate);

  const payload = formatUsagePayload(usage.request_count);
  res.json({
    date: todayDate,
    request_count: usage.request_count,
    llm_count: usage.llm_count,
    daily_limit: payload.limit,
    remaining: payload.remaining
  });
});
