import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, 'sakukampus.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('--- Seeding Realistic Dummy Data for SakuKampus ---');

// 1. Ensure Categories Map
const categories = db.prepare('SELECT id, name, type FROM categories').all();
const catMap = {};
for (const cat of categories) {
  catMap[cat.name] = cat.id;
}

// 2. Clean up old 'Faid' user accounts and create/update Dimas Pratama
db.prepare('DELETE FROM chat_usage WHERE user_id IN (SELECT id FROM users WHERE email LIKE ? OR name LIKE ?)').run('%faid%', '%Faid%');
db.prepare('DELETE FROM transactions WHERE user_id IN (SELECT id FROM users WHERE email LIKE ? OR name LIKE ?)').run('%faid%', '%Faid%');
db.prepare('DELETE FROM users WHERE email LIKE ? OR name LIKE ?').run('%faid%', '%Faid%');

// Clean up any existing Dimas Pratama to avoid duplicate runs
db.prepare('DELETE FROM chat_usage WHERE user_id IN (SELECT id FROM users WHERE email = ? OR google_sub = ?)').run('dimas.pratama@student.umy.ac.id', 'demo-mahasiswa-108');
db.prepare('DELETE FROM transactions WHERE user_id IN (SELECT id FROM users WHERE email = ? OR google_sub = ?)').run('dimas.pratama@student.umy.ac.id', 'demo-mahasiswa-108');
db.prepare('DELETE FROM users WHERE email = ? OR google_sub = ?').run('dimas.pratama@student.umy.ac.id', 'demo-mahasiswa-108');

// Insert Dimas Pratama as the primary demo/student user
const insertUser = db.prepare(`
  INSERT INTO users (google_sub, email, name, picture_url)
  VALUES (?, ?, ?, ?)
`);

const userRes = insertUser.run(
  'demo-mahasiswa-108',
  'dimas.pratama@student.umy.ac.id',
  'Dimas Pratama',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Dimas'
);
const userId = userRes.lastInsertRowid;
console.log(`✅ User Dimas Pratama created with ID ${userId}`);

// 3. Prepare Dummy Transactions
const transactions = [
  // ─── 6 BULAN TERAKHIR (Monthly Trend: Juni - Oktober 2026) ───
  // Juni 2026
  { cat: 'Uang saku', amount: 1800000, desc: 'Uang saku bulanan dari orang tua', raw: 'uang saku bulanan 1.8 juta', src: 'chat', parsed: 'rule', date: '2026-06-01' },
  { cat: 'Gaji', amount: 650000, desc: 'Honor project freelance website kampus', raw: 'honor freelance web 650rb', src: 'chat', parsed: 'rule', date: '2026-06-12' },
  { cat: 'Tagihan', amount: 650000, desc: 'Bayar uang sewa kos bulan Juni', raw: 'bayar kosan 650k', src: 'chat', parsed: 'rule', date: '2026-06-02' },
  { cat: 'Makan', amount: 480000, desc: 'Total makan dan minum mingguan', raw: 'makan dan minum 480rb', src: 'voice', parsed: 'rule', date: '2026-06-15' },
  { cat: 'Pendidikan', amount: 220000, desc: 'Fotokopi modul dan cetak laporan UAS', raw: 'print dan fotokopi modul 220rb', src: 'chat', parsed: 'rule', date: '2026-06-20' },
  { cat: 'Transportasi', amount: 160000, desc: 'Bensin motor dan service oli', raw: 'bensin dan ganti oli 160k', src: 'chat', parsed: 'rule', date: '2026-06-24' },
  { cat: 'Hiburan', amount: 120000, desc: 'Nonton bioskop & ngopi bareng teman', raw: 'nonton dan ngopi 120rb', src: 'voice', parsed: 'rule', date: '2026-06-28' },

  // Juli 2026
  { cat: 'Uang saku', amount: 1800000, desc: 'Uang saku bulanan Juli dari ortu', raw: 'uang saku 1.8jt', src: 'chat', parsed: 'rule', date: '2026-07-01' },
  { cat: 'Gaji', amount: 850000, desc: 'Honor asisten magang riset laboratorium', raw: 'honor asisten lab 850rb', src: 'chat', parsed: 'rule', date: '2026-07-15' },
  { cat: 'Tagihan', amount: 650000, desc: 'Sewa kos bulanan Juli', raw: 'sewa kos 650rb', src: 'chat', parsed: 'rule', date: '2026-07-02' },
  { cat: 'Belanja', amount: 280000, desc: 'Belanja perlengkapan kos & baju kuliah', raw: 'belanja baju dan perlengkapan 280rb', src: 'chat', parsed: 'rule', date: '2026-07-10' },
  { cat: 'Makan', amount: 520000, desc: 'Konsumsi bulanan kantin & warteg', raw: 'makan warteg dan kantin 520k', src: 'voice', parsed: 'rule', date: '2026-07-18' },
  { cat: 'Transportasi', amount: 180000, desc: 'Tiket kereta prameks & bensin', raw: 'tiket kereta dan bensin 180rb', src: 'chat', parsed: 'rule', date: '2026-07-22' },
  { cat: 'Hiburan', amount: 150000, desc: 'Liburan singkat pantai bareng teman', raw: 'liburan pantai 150k', src: 'voice', parsed: 'rule', date: '2026-07-27' },

  // Agustus 2026
  { cat: 'Uang saku', amount: 1800000, desc: 'Uang saku bulanan Agustus', raw: 'uang saku ortu 1.8 juta', src: 'chat', parsed: 'rule', date: '2026-08-01' },
  { cat: 'Bonus', amount: 750000, desc: 'Hadiah juara lomba desain 17 Agustus', raw: 'juara lomba 17an 750k', src: 'chat', parsed: 'rule', date: '2026-08-17' },
  { cat: 'Tagihan', amount: 700000, desc: 'Sewa kos & iuran kebersihan kosan', raw: 'kos dan kas kebersihan 700rb', src: 'chat', parsed: 'rule', date: '2026-08-02' },
  { cat: 'Makan', amount: 550000, desc: 'Akumulasi makan siang & malam mahasiswa', raw: 'makan bulanan 550rb', src: 'voice', parsed: 'rule', date: '2026-08-14' },
  { cat: 'Transportasi', amount: 190000, desc: 'Bensin Pertalite harian kampus', raw: 'bensin motor 190k', src: 'chat', parsed: 'rule', date: '2026-08-20' },
  { cat: 'Belanja', amount: 240000, desc: 'Belanja sabun, shampo, deterjen di minimarket', raw: 'belanja sabun dan kebutuhan 240rb', src: 'chat', parsed: 'rule', date: '2026-08-25' },
  { cat: 'Kesehatan', amount: 110000, desc: 'Beli obat flu, vitamin C, dan koyo apotek', raw: 'beli obat dan vitamin 110rb', src: 'voice', parsed: 'rule', date: '2026-08-29' },

  // September 2026
  { cat: 'Uang saku', amount: 1800000, desc: 'Uang saku bulanan September', raw: 'kiriman ortu 1.8jt', src: 'chat', parsed: 'rule', date: '2026-09-01' },
  { cat: 'Bonus', amount: 1400000, desc: 'Beasiswa prestasi akademik semester', raw: 'beasiswa prestasi akademik 1.4 juta', src: 'chat', parsed: 'rule', date: '2026-09-10' },
  { cat: 'Pendidikan', amount: 550000, desc: 'Daftar praktikum lab & sertifikasi kompetensi', raw: 'bayar sertifikasi dan modul 550rb', src: 'chat', parsed: 'rule', date: '2026-09-05' },
  { cat: 'Tagihan', amount: 650000, desc: 'Sewa kos bulanan September', raw: 'bayar kos 650k', src: 'chat', parsed: 'rule', date: '2026-09-02' },
  { cat: 'Makan', amount: 580000, desc: 'Konsumsi warteg & kantin kampus', raw: 'makan dan kopi 580rb', src: 'voice', parsed: 'rule', date: '2026-09-18' },
  { cat: 'Transportasi', amount: 210000, desc: 'Bensin & perpanjangan SIM motor', raw: 'bensin dan sim 210k', src: 'chat', parsed: 'rule', date: '2026-09-22' },
  { cat: 'Hiburan', amount: 160000, desc: 'Mabar & game tournament pendaftaran', raw: 'turnamen game dan snack 160rb', src: 'voice', parsed: 'rule', date: '2026-09-26' },

  // Oktober 2026
  { cat: 'Uang saku', amount: 1800000, desc: 'Uang saku bulanan Oktober', raw: 'uang saku bulanan 1.8jt', src: 'chat', parsed: 'rule', date: '2026-10-01' },
  { cat: 'Gaji', amount: 950000, desc: 'Jasa pembuatan landing page UMKM Jogja', raw: 'projek landing page umkm 950rb', src: 'chat', parsed: 'rule', date: '2026-10-15' },
  { cat: 'Tagihan', amount: 700000, desc: 'Sewa kos & langganan internet wifi', raw: 'kos dan wifi 700k', src: 'chat', parsed: 'rule', date: '2026-10-02' },
  { cat: 'Makan', amount: 590000, desc: 'Makan harian warteg, ayam geprek, burjo', raw: 'makan harian 590rb', src: 'voice', parsed: 'rule', date: '2026-10-16' },
  { cat: 'Belanja', amount: 260000, desc: 'Beli sepatu olahraga & kaos kaki', raw: 'sepatu olahraga 260rb', src: 'chat', parsed: 'rule', date: '2026-10-20' },
  { cat: 'Transportasi', amount: 190000, desc: 'Bensin motor Beat harian', raw: 'bensin bulanan 190k', src: 'chat', parsed: 'rule', date: '2026-10-24' },
  { cat: 'Lain-lain pengeluaran', amount: 95000, desc: 'Laundry kiloan baju kuliah dan cuci motor', raw: 'laundry dan cuci motor 95rb', src: 'voice', parsed: 'rule', date: '2026-10-28' },

  // ─── BULAN INI (November 2026: 30 Hari Terakhir) ───
  // Awal Bulan November (1 - 16 Nov)
  { cat: 'Uang saku', amount: 1750000, desc: 'Uang saku bulanan dari orang tua', raw: 'uang saku bulanan 1.750.000', src: 'chat', parsed: 'rule', date: '2026-11-01' },
  { cat: 'Tagihan', amount: 650000, desc: 'Sewa kamar kos bulan November', raw: 'bayar kos 650k', src: 'chat', parsed: 'rule', date: '2026-11-01' },
  { cat: 'Tagihan', amount: 50000, desc: 'Iuran kas kebersihan & keamanan kos', raw: 'kas kebersihan 50rb', src: 'voice', parsed: 'rule', date: '2026-11-01' },

  { cat: 'Makan', amount: 35000, desc: 'Makan siang nasi padang komplit rendang', raw: 'nasi padang 35k', src: 'chat', parsed: 'rule', date: '2026-11-03' },
  { cat: 'Transportasi', amount: 25000, desc: 'Isi bensin Pertalite motor', raw: 'bensin 25.000', src: 'chat', parsed: 'rule', date: '2026-11-03' },

  { cat: 'Gaji', amount: 350000, desc: 'Honor desain logo komunitas kampus', raw: 'honor desain logo 350rb', src: 'chat', parsed: 'rule', date: '2026-11-05' },
  { cat: 'Pendidikan', amount: 120000, desc: 'Buku teks algoritma dan struktur data', raw: 'beli buku algoritma 120rb', src: 'chat', parsed: 'rule', date: '2026-11-05' },
  { cat: 'Tagihan', amount: 45000, desc: 'Langganan Spotify Family & YouTube Student', raw: 'spotify dan youtube 45k', src: 'voice', parsed: 'rule', date: '2026-11-05' },

  { cat: 'Belanja', amount: 115000, desc: 'Belanja sabun, shampo, dan stok mie instan kos', raw: 'belanja indomaret 115rb', src: 'chat', parsed: 'rule', date: '2026-11-07' },
  { cat: 'Makan', amount: 22000, desc: 'Makan malam mie ayam bakso Pak Min', raw: 'mie ayam bakso 22rb', src: 'voice', parsed: 'rule', date: '2026-11-07' },

  { cat: 'Gaji', amount: 450000, desc: 'Insentif asisten praktikum pemrograman web', raw: 'insentif asisten praktikum 450k', src: 'chat', parsed: 'rule', date: '2026-11-09' },
  { cat: 'Makan', amount: 28000, desc: 'Makan siang warteg sayur lodeh + ayam goreng', raw: 'makan warteg 28rb', src: 'chat', parsed: 'rule', date: '2026-11-09' },
  { cat: 'Lain-lain pengeluaran', amount: 25000, desc: 'Laundry kiloan baju kuliah', raw: 'laundry baju 25k', src: 'voice', parsed: 'rule', date: '2026-11-09' },

  { cat: 'Makan', amount: 30000, desc: 'Makan malam nasi goreng kambing', raw: 'nasgor kambing 30rb', src: 'chat', parsed: 'rule', date: '2026-11-11' },
  { cat: 'Transportasi', amount: 25000, desc: 'Isi bensin Pertalite', raw: 'bensin 25k', src: 'chat', parsed: 'rule', date: '2026-11-11' },
  { cat: 'Hiburan', amount: 35000, desc: 'Ngopi nugas di Bento Kopi bareng kelompok', raw: 'ngopi bento 35rb', src: 'voice', parsed: 'rule', date: '2026-11-11' },

  { cat: 'Lain-lain pemasukan', amount: 150000, desc: 'Jasa instalasi software laptop teman', raw: 'jasa install laptop 150k', src: 'chat', parsed: 'rule', date: '2026-11-13' },
  { cat: 'Makan', amount: 22000, desc: 'Makan siang ayam geprek Bu Rum level 3', raw: 'ayam geprek 22rb', src: 'chat', parsed: 'rule', date: '2026-11-13' },
  { cat: 'Pendidikan', amount: 35000, desc: 'Fotokopi modul praktikum sistem operasi', raw: 'fotokopi modul os 35k', src: 'voice', parsed: 'rule', date: '2026-11-13' },

  { cat: 'Makan', amount: 24000, desc: 'Makan siang soto ayam kuah bening', raw: 'soto ayam 24rb', src: 'chat', parsed: 'rule', date: '2026-11-15' },
  { cat: 'Kesehatan', amount: 45000, desc: 'Beli vitamin C dan minyak kayu putih di Apotek K-24', raw: 'vitamin dan minyak kayu putih 45rb', src: 'voice', parsed: 'rule', date: '2026-11-15' },
  { cat: 'Hiburan', amount: 35000, desc: 'Futsal malam bareng teman seangkatan', raw: 'futsal angkatan 35k', src: 'chat', parsed: 'rule', date: '2026-11-15' },

  // ─── 7 HARI TERAKHIR (17 - 23 November 2026: DUA GRAFIK TAMPIL PENUH & DINAMIS!) ───
  // 17 Nov
  { cat: 'Gaji', amount: 450000, desc: 'Honor asistensi lab basis data', raw: 'honor lab basis data 450k', src: 'chat', parsed: 'rule', date: '2026-11-17' },
  { cat: 'Makan', amount: 35000, desc: 'Makan siang ayam bakar madu & teh es', raw: 'ayam bakar 35k', src: 'chat', parsed: 'rule', date: '2026-11-17' },
  { cat: 'Transportasi', amount: 25000, desc: 'Isi bensin Pertalite motor', raw: 'bensin 25rb', src: 'chat', parsed: 'rule', date: '2026-11-17' },
  { cat: 'Belanja', amount: 80000, desc: 'Belanja bulanan sabun cuci, pasta gigi, snack', raw: 'belanja sabun dan snack 80k', src: 'chat', parsed: 'rule', date: '2026-11-17' },
  { cat: 'Pendidikan', amount: 45000, desc: 'Cetak proposal proyek akhir & jilid mika', raw: 'print proposal jilid 45rb', src: 'voice', parsed: 'rule', date: '2026-11-17' },

  // 18 Nov
  { cat: 'Lain-lain pemasukan', amount: 150000, desc: 'Pelunasan patungan sewa server project web', raw: 'patungan server web 150k', src: 'chat', parsed: 'rule', date: '2026-11-18' },
  { cat: 'Makan', amount: 28000, desc: 'Makan siang nasi padang telur dadar rendang', raw: 'makan nasi padang 28rb', src: 'voice', parsed: 'rule', date: '2026-11-18' },
  { cat: 'Transportasi', amount: 15000, desc: 'Parkir harian kampus & bensin motor', raw: 'parkir dan bensin 15k', src: 'chat', parsed: 'rule', date: '2026-11-18' },
  { cat: 'Pendidikan', amount: 30000, desc: 'Beli binder perkuliahan & loose leaf', raw: 'binder dan loose leaf 30rb', src: 'chat', parsed: 'rule', date: '2026-11-18' },

  // 19 Nov
  { cat: 'Bonus', amount: 200000, desc: 'Hadiah juara 3 coding challenge kampus', raw: 'juara coding 200k', src: 'chat', parsed: 'rule', date: '2026-11-19' },
  { cat: 'Makan', amount: 32000, desc: 'Makan siang warteg sayur krecek telur', raw: 'makan warteg 32rb', src: 'chat', parsed: 'rule', date: '2026-11-19' },
  { cat: 'Makan', amount: 25000, desc: 'Kopi americano dan roti bakar sore', raw: 'kopi dan roti 25k', src: 'voice', parsed: 'rule', date: '2026-11-19' },
  { cat: 'Transportasi', amount: 35000, desc: 'Topup kartu KRL Prameks & e-money', raw: 'topup krl 35k', src: 'chat', parsed: 'rule', date: '2026-11-19' },

  // 20 Nov
  { cat: 'Uang saku', amount: 300000, desc: 'Uang saku tambahan dari keluarga', raw: 'tambahan uang saku 300k', src: 'chat', parsed: 'rule', date: '2026-11-20' },
  { cat: 'Makan', amount: 22000, desc: 'Makan malam soto ayam Lamongan', raw: 'soto ayam 22rb', src: 'chat', parsed: 'rule', date: '2026-11-20' },
  { cat: 'Tagihan', amount: 55000, desc: 'Beli paket data kuota internet Telkomsel', raw: 'kuota internet 55k', src: 'voice', parsed: 'rule', date: '2026-11-20' },
  { cat: 'Kesehatan', amount: 40000, desc: 'Beli vitamin C dan tolak angin sachet', raw: 'vitamin dan tolak angin 40rb', src: 'chat', parsed: 'rule', date: '2026-11-20' },

  // 21 Nov
  { cat: 'Lain-lain pemasukan', amount: 100000, desc: 'Cashback belanja elektronik marketplace', raw: 'cashback belanja 100k', src: 'chat', parsed: 'rule', date: '2026-11-21' },
  { cat: 'Makan', amount: 25000, desc: 'Sarapan lontong sayur padang & teh hangat', raw: 'lontong sayur 25rb', src: 'voice', parsed: 'rule', date: '2026-11-21' },
  { cat: 'Hiburan', amount: 50000, desc: 'Nonton bioskop promo student XXI weekend', raw: 'nonton bioskop xxi 50k', src: 'chat', parsed: 'rule', date: '2026-11-21' },
  { cat: 'Hiburan', amount: 25000, desc: 'Snack popcorn dan air mineral bioskop', raw: 'popcorn dan air 25k', src: 'chat', parsed: 'rule', date: '2026-11-21' },
  { cat: 'Lain-lain pengeluaran', amount: 18000, desc: 'Laundry kiloan kilat baju kuliah', raw: 'laundry kilat 18rb', src: 'voice', parsed: 'rule', date: '2026-11-21' },

  // 22 Nov
  { cat: 'Gaji', amount: 250000, desc: 'Jasa pembuatan desain poster seminar himpunan', raw: 'jasa poster himpunan 250k', src: 'chat', parsed: 'rule', date: '2026-11-22' },
  { cat: 'Makan', amount: 30000, desc: 'Makan siang bebek goreng sambal korek', raw: 'bebek goreng 30k', src: 'chat', parsed: 'rule', date: '2026-11-22' },
  { cat: 'Hiburan', amount: 35000, desc: 'Sewa lapangan futsal bareng teman kelas TI', raw: 'futsal ti 35k', src: 'voice', parsed: 'rule', date: '2026-11-22' },
  { cat: 'Transportasi', amount: 20000, desc: 'Isi bensin motor Beat', raw: 'bensin motor 20rb', src: 'chat', parsed: 'rule', date: '2026-11-22' },

  // 23 Nov (HARI INI)
  { cat: 'Uang saku', amount: 350000, desc: 'Transferan uang saku tambahan orang tua', raw: 'transferan orang tua 350k', src: 'chat', parsed: 'rule', date: '2026-11-23' },
  { cat: 'Makan', amount: 18000, desc: 'Sarapan bubur ayam Cianjur komplit', raw: 'sarapan bubur ayam 18rb', src: 'voice', parsed: 'rule', date: '2026-11-23' },
  { cat: 'Makan', amount: 25000, desc: 'Makan siang ayam geprek sambal bawang', raw: 'makan siang geprek 25k', src: 'chat', parsed: 'rule', date: '2026-11-23' },
  { cat: 'Pendidikan', amount: 25000, desc: 'Beli pulpen & modul praktikum basis data', raw: 'pulpen dan modul 25rb', src: 'chat', parsed: 'rule', date: '2026-11-23' }
];

const insertTx = db.prepare(`
  INSERT INTO transactions (user_id, category_id, amount, description, raw_text, source, parsed_by, occurred_on)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMany = db.transaction((txs) => {
  for (const t of txs) {
    const catId = catMap[t.cat];
    if (!catId) {
      console.warn(`Category not found: ${t.cat}`);
      continue;
    }
    insertTx.run(userId, catId, t.amount, t.desc, t.raw, t.src, t.parsed, t.date);
  }
});

insertMany(transactions);

console.log(`✅ ${transactions.length} dummy transactions inserted successfully!`);

// Print check summary
const summary = db.prepare(`
  SELECT 
    COUNT(*) as total_tx,
    SUM(CASE WHEN c.type = 'income' THEN t.amount ELSE 0 END) as total_income,
    SUM(CASE WHEN c.type = 'expense' THEN t.amount ELSE 0 END) as total_expense
  FROM transactions t
  JOIN categories c ON t.category_id = c.id
  WHERE t.user_id = ?
`).get(userId);

console.log('SUMMARY:', summary);
console.log('NET BALANCE:', summary.total_income - summary.total_expense);
