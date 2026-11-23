import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../../sakukampus.db');

export const db = new Database(dbPath);

// Enable foreign keys and WAL mode for performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  // 1. users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_sub TEXT UNIQUE NOT NULL,
      email TEXT,
      name TEXT,
      picture_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. categories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      type TEXT CHECK(type IN ('income', 'expense')) NOT NULL
    );
  `);

  // 3. transactions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      amount INTEGER NOT NULL,
      description TEXT,
      raw_text TEXT,
      source TEXT CHECK(source IN ('chat', 'voice')) DEFAULT 'chat',
      parsed_by TEXT CHECK(parsed_by IN ('rule', 'llm')) DEFAULT 'rule',
      occurred_on TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 4. chat_usage table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_usage (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      usage_date TEXT NOT NULL,
      request_count INTEGER DEFAULT 0,
      llm_count INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, usage_date)
    );
  `);

  // Seed default 12 categories per T8-1
  const existingCategories = db.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (existingCategories.count === 0) {
    const insertCategory = db.prepare('INSERT INTO categories (name, type) VALUES (?, ?)');
    const initialCategories = [
      // Pengeluaran (Expense)
      { name: 'Makan', type: 'expense' },
      { name: 'Transportasi', type: 'expense' },
      { name: 'Belanja', type: 'expense' },
      { name: 'Tagihan', type: 'expense' },
      { name: 'Hiburan', type: 'expense' },
      { name: 'Kesehatan', type: 'expense' },
      { name: 'Pendidikan', type: 'expense' },
      { name: 'Lain-lain pengeluaran', type: 'expense' },
      // Pemasukan (Income)
      { name: 'Gaji', type: 'income' },
      { name: 'Uang saku', type: 'income' },
      { name: 'Bonus', type: 'income' },
      { name: 'Lain-lain pemasukan', type: 'income' }
    ];

    const insertMany = db.transaction((cats) => {
      for (const cat of cats) {
        insertCategory.run(cat.name, cat.type);
      }
    });
    insertMany(initialCategories);
    console.log('✅ Initial 12 categories seeded successfully per T8-1 specifications.');
  }

  // Ensure default demo user exists for instant testing
  const demoUser = db.prepare('SELECT id FROM users WHERE google_sub = ?').get('demo-mahasiswa-108');
  if (!demoUser) {
    db.prepare(`
      INSERT INTO users (google_sub, email, name, picture_url)
      VALUES (?, ?, ?, ?)
    `).run(
      'demo-mahasiswa-108',
      'dimas.pratama@student.umy.ac.id',
      'Dimas Pratama (Demo Mahasiswa)',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Dimas'
    );

    const newDemoUser = db.prepare('SELECT id FROM users WHERE google_sub = ?').get('demo-mahasiswa-108');
    // Add some sample initial transactions for the demo user
    const catMap = {};
    db.prepare('SELECT id, name FROM categories').all().forEach(c => { catMap[c.name] = c.id; });

    const sampleTransactions = [
      { amount: 1500000, cat: 'Uang saku', desc: 'Kiriman uang saku bulanan ortu', raw: 'dapat kiriman uang saku 1,5 juta', src: 'chat', parsed: 'rule', date: getRelativeDate(5) },
      { amount: 15000, cat: 'Makan', desc: 'Makan siang ayam geprek', raw: 'makan siang 15rb', src: 'chat', parsed: 'rule', date: getRelativeDate(4) },
      { amount: 25000, cat: 'Transportasi', desc: 'Beli bensin pertalite', raw: 'beli bensin 25.000', src: 'chat', parsed: 'rule', date: getRelativeDate(3) },
      { amount: 35000, cat: 'Hiburan', desc: 'Nongkrong ngopi bareng teman', raw: 'kopi dua puluh ribu tambah snack lima belas ribu', src: 'voice', parsed: 'rule', date: getRelativeDate(2) },
      { amount: 50000, cat: 'Pendidikan', desc: 'Fotokopi modul praktikum dan print tugas', raw: 'bayar print dan fotokopi modul 50k', src: 'chat', parsed: 'rule', date: getRelativeDate(1) },
      { amount: 20000, cat: 'Makan', desc: 'Makan malam nasi goreng', raw: 'makan malam 20rb', src: 'voice', parsed: 'rule', date: getRelativeDate(0) }
    ];

    const insertTx = db.prepare(`
      INSERT INTO transactions (user_id, category_id, amount, description, raw_text, source, parsed_by, occurred_on)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const st of sampleTransactions) {
      if (catMap[st.cat]) {
        insertTx.run(newDemoUser.id, catMap[st.cat], st.amount, st.desc, st.raw, st.src, st.parsed, st.date);
      }
    }
    console.log('✅ Demo account & sample transactions seeded for instant evaluation.');
  }
}

function getRelativeDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}
