// Rule-based Natural Language Processing Parser for Indonesian Financial Queries
// Compliant with SakuKampus UMY Desain Pertemuan 8 (T8-3)

const NUMBER_WORDS = {
  'nol': 0, 'satu': 1, 'sepasang': 2, 'dua': 2, 'tiga': 3, 'empat': 4,
  'lima': 5, 'enam': 6, 'tujuh': 7, 'delapan': 8, 'sembilan': 9,
  'sepuluh': 10, 'sebelas': 11, 'dua belas': 12, 'tiga belas': 13,
  'empat belas': 14, 'lima belas': 15, 'enam belas': 16, 'tujuh belas': 17,
  'delapan belas': 18, 'sembilan belas': 19, 'dua puluh': 20, 'tiga puluh': 30,
  'empat puluh': 40, 'lima puluh': 50, 'enam puluh': 60, 'tujuh puluh': 70,
  'delapan puluh': 80, 'sembilan puluh': 90, 'seratus': 100, 'dua ratus': 200,
  'seribu': 1000, 'sejuta': 1000000
};

// Keyword mapping for 12 categories
const CATEGORY_KEYWORDS = {
  // Expense Categories
  'Makan': [
    'makan', 'minum', 'sarapan', 'siang', 'malam', 'kopi', 'ngopi', 'es teh',
    'nasi', 'ayam', 'geprek', 'warteg', 'padang', 'bakso', 'mie', 'indomie',
    'snack', 'jajan', 'jajanan', 'cemilan', 'roti', 'jus', 'boba', 'cafe',
    'kafe', 'resto', 'kuliner', 'kantin', 'mcd', 'kfc', 'burger'
  ],
  'Transportasi': [
    'bensin', 'pertalite', 'pertamax', 'solar', 'ojol', 'gojek', 'grab', 'maxim',
    'parkir', 'krl', 'kereta', 'bus', 'transjogja', 'angkot', 'tol', 'servis',
    'tambal ban', 'cuci motor', 'oli', 'helm', 'bengkel', 'stnk'
  ],
  'Belanja': [
    'belanja', 'indomaret', 'alfamart', 'supermarket', 'shopee', 'tokopedia',
    'lazada', 'tiktok shop', 'sabun', 'sampo', 'shampoo', 'odol', 'skincare',
    'baju', 'celana', 'kaos', 'sepatu', 'tas', 'sandal', 'jaket', 'beli barang'
  ],
  'Tagihan': [
    'kos', 'kost', 'kontrakan', 'listrik', 'pln', 'air', 'pdam', 'wifi',
    'indihome', 'pulsa', 'kuota', 'paket data', 'iuran', 'spp', 'cicilan',
    'netflix', 'spotify', 'youtube premium', 'bpjs', 'tagihan',
    'utang', 'hutang', 'pinjam', 'minjam', 'meminjam', 'pinjaman', 'kasbon',
    'ngutang', 'berutang'
  ],
  'Hiburan': [
    'nonton', 'bioskop', 'cinema', 'xxi', 'cgv', 'game', 'top up', 'steam',
    'playstation', 'ps', 'jalan-jalan', 'liburan', 'wisata', 'karaoke',
    'biliard', 'staycation', 'party', 'nongkrong'
  ],
  'Kesehatan': [
    'obat', 'apotek', 'dokter', 'klinik', 'puskesmas', 'rumah sakit', 'rs',
    'vitamin', 'masker', 'periksa', 'tambal gigi', 'minyak kayu putih', 'flu'
  ],
  'Pendidikan': [
    'buku', 'modul', 'print', 'ngeprint', 'fotokopi', 'fotocopy', 'atk',
    'alat tulis', 'pulpen', 'pensil', 'kertas', 'skripsi', 'praktikum',
    'seminar', 'kursus', 'ujian', 'pendadaran', 'kuliah', 'diktat'
  ],
  'Lain-lain pengeluaran': [
    'sedekah', 'infak', 'infaq', 'donasi', 'zakat', 'kas', 'sumbangan',
    'hilang', 'rusak', 'pengeluaran', 'keluar', 'tf', 'transfer keluar'
  ],

  // Income Categories
  'Gaji': [
    'gaji', 'gajian', 'salary', 'upah', 'honor', 'freelance', 'part time',
    'lembur', 'proyek', 'side job'
  ],
  'Uang saku': [
    'uang saku', 'sangu', 'kiriman', 'transferan ortu', 'transfer ortu',
    'orang tua', 'ibu', 'ayah', 'bapak', 'jatah', 'beasiswa'
  ],
  'Bonus': [
    'bonus', 'thr', 'hadiah', 'reward', 'giveaway', 'cashback', 'tips',
    'insentif', 'komisi', 'menang'
  ],
  'Lain-lain pemasukan': [
    'jual', 'jualan', 'laku', 'refund', 'kembalian', 'kembali', 'dapat uang',
    'pemasukan', 'masuk'
  ]
};

// Expense trigger keywords
const EXPENSE_TRIGGERS = [
  'beli', 'bayar', 'makan', 'minum', 'isi', 'jajan', 'nongkrong', 'ngopi',
  'pesan', 'checkout', 'sewa', 'ongkos', 'parkir', 'service', 'servis',
  'transfer ke', 'tf ke', 'kirim ke', 'keluar', 'belanja', 'habis',
  'utang', 'hutang', 'pinjam', 'minjam', 'meminjam', 'ngutang', 'berutang',
  'kasbon', 'punya utang', 'ada utang'
];

// Income trigger keywords
const INCOME_TRIGGERS = [
  'gaji', 'gajian', 'dapat', 'terima', 'dapet', 'kiriman', 'transferan dari',
  'tf dari', 'masuk', 'uang saku', 'sangu', 'bonus', 'thr', 'upah', 'honor',
  'beasiswa', 'jual', 'jualan', 'laku', 'cashback'
];

/**
 * Parse Indonesian text into nominal value (integer)
 */
export function extractNominal(text) {
  const clean = text.toLowerCase();

  // Pattern 1: Number with juta/jt (e.g., 1.5 juta, 1,5 jt, 3juta, 2 jt)
  const jutaMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:jt|juta)\b/);
  if (jutaMatch) {
    const val = parseFloat(jutaMatch[1].replace(',', '.'));
    return Math.round(val * 1000000);
  }

  // Pattern 2: Number with ribu/rb/k (e.g., 15rb, 25k, 50 ribu, 1.5rb, 100 k)
  const ribuMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:rb|k|ribu)\b/);
  if (ribuMatch) {
    const val = parseFloat(ribuMatch[1].replace(',', '.'));
    return Math.round(val * 1000);
  }

  // Pattern 3: Number with currency/dot notation (e.g., Rp 25.000, 25.000, 1500000, 50000)
  // Match standard Indonesian rupiah formatted numbers
  const standardMatch = clean.match(/(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})+)/);
  if (standardMatch) {
    const num = parseInt(standardMatch[1].replace(/\./g, ''), 10);
    if (!isNaN(num) && num > 0) return num;
  }

  // Pattern 4: Bare digits (e.g., 15000, 25000)
  const bareDigitsMatch = clean.match(/(?:rp\.?\s*)?(\b\d{4,9}\b)/);
  if (bareDigitsMatch) {
    const num = parseInt(bareDigitsMatch[1], 10);
    if (!isNaN(num) && num >= 500) return num;
  }

  // Pattern 5: Indonesian words (e.g., dua puluh ribu, lima puluh ribu)
  if (clean.includes('juta')) {
    for (const [w, n] of Object.entries(NUMBER_WORDS)) {
      if (clean.includes(`${w} juta`)) return n * 1000000;
    }
  }
  if (clean.includes('ribu')) {
    // Check two-word prefixes like "dua puluh ribu"
    for (const [w1, n1] of Object.entries(NUMBER_WORDS)) {
      if (clean.includes(`${w1} ribu`)) return n1 * 1000;
    }
    const wordCombo = clean.match(/(dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)?\s*(belas|puluh|ratus)?\s*ribu/);
    if (wordCombo) {
      if (clean.includes('dua puluh ribu')) return 20000;
      if (clean.includes('tiga puluh ribu')) return 30000;
      if (clean.includes('empat puluh ribu')) return 40000;
      if (clean.includes('lima puluh ribu')) return 50000;
      if (clean.includes('sepuluh ribu')) return 10000;
      if (clean.includes('seratus ribu')) return 100000;
    }
  }

  return null;
}

/**
 * Determine transaction date from natural text
 */
export function extractDate(text) {
  const clean = text.toLowerCase();
  const d = new Date();

  if (clean.includes('kemarin')) {
    d.setDate(d.getDate() - 1);
  } else if (clean.includes('lusa') || clean.includes('2 hari lalu') || clean.includes('dua hari lalu')) {
    d.setDate(d.getDate() - 2);
  } else if (clean.includes('3 hari lalu') || clean.includes('tiga hari lalu')) {
    d.setDate(d.getDate() - 3);
  }

  return d.toISOString().split('T')[0];
}

/**
 * Match sentence with categories & determine type
 */
export function extractCategoryAndType(text) {
  const clean = text.toLowerCase();

  // If text mentions debt or loan obligation, classify as expense (Tagihan/kewajiban yang mengurangi saldo)
  const isDebtOrLoan = /\b(utang|hutang|pinjam|minjam|meminjam|ngutang|berutang|kasbon)\b/i.test(clean);
  if (isDebtOrLoan) {
    return {
      category: 'Tagihan',
      type: 'expense'
    };
  }

  let detectedType = null;
  // Check Income triggers first
  for (const trig of INCOME_TRIGGERS) {
    if (clean.includes(trig)) {
      detectedType = 'income';
      break;
    }
  }
  // Check Expense triggers
  if (!detectedType) {
    for (const trig of EXPENSE_TRIGGERS) {
      if (clean.includes(trig)) {
        detectedType = 'expense';
        break;
      }
    }
  }

  // Score categories based on keyword matches
  let bestCategory = null;
  let maxScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    // Extra boost if category name itself is mentioned
    if (clean.includes(category.toLowerCase())) {
      score += 50;
    }
    for (const kw of keywords) {
      if (clean.includes(kw)) {
        score += kw.length * 2;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestCategory = category;
    }
  }

  // Fallback category if type is known
  if (!bestCategory) {
    if (detectedType === 'income') {
      bestCategory = 'Lain-lain pemasukan';
    } else if (detectedType === 'expense') {
      bestCategory = 'Lain-lain pengeluaran';
    }
  } else {
    // If bestCategory is found, determine type by category
    const isIncomeCat = ['Gaji', 'Uang saku', 'Bonus', 'Lain-lain pemasukan'].includes(bestCategory);
    detectedType = isIncomeCat ? 'income' : 'expense';
  }

  return {
    category: bestCategory,
    type: detectedType || 'expense'
  };
}

/**
 * Generate a friendly description from raw input
 */
export function generateDescription(rawText, category, type, nominal) {
  // Strip out nominal numbers and triggers to keep clean title
  let cleaned = rawText
    .replace(/(?:rp\.?\s*)?\d+(?:[.,]\d+)?\s*(?:jt|juta|rb|k|ribu)?/gi, '')
    .replace(/\b(kemarin|hari ini|tadi|lusa)\b/gi, '')
    .replace(/^(aku|saya)\s+/i, '')
    .trim();

  cleaned = cleaned.replace(/\s+/g, ' ');

  if (cleaned.length < 3) {
    return `${type === 'income' ? 'Pemasukan' : 'Pengeluaran'} ${category}`;
  }

  // Capitalize first letter
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Main Rule-based parse function
 * Returns { success: boolean, data?: TransactionData, reason?: string }
 */
export function parseSentenceWithRules(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { success: false, reason: 'Teks kosong' };
  }

  const rawText = text.trim();
  const nominal = extractNominal(rawText);

  // If nominal is not found or invalid
  if (!nominal || nominal <= 0) {
    return {
      success: false,
      reason: 'Nominal tidak ditemukan'
    };
  }

  const { category, type } = extractCategoryAndType(rawText);
  if (!category) {
    return {
      success: false,
      reason: 'Kategori tidak dapat ditentukan'
    };
  }

  const occurredOn = extractDate(rawText);
  const description = generateDescription(rawText, category, type, nominal);

  return {
    success: true,
    data: {
      amount: nominal,
      type,
      category,
      description,
      occurred_on: occurredOn,
      raw_text: rawText,
      parsed_by: 'rule'
    }
  };
}
