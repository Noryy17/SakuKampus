import { db } from '../config/database.js';

function formatRupiah(num) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(num || 0);
}

/**
 * Check if the input message is an advisory / inquiry question rather than a transaction to record
 */
export function isConsultationQuery(text) {
  const clean = text.toLowerCase().trim();

  const hasNominal = /\d+/.test(clean) || /(ribu|juta|rb|jt)\b/.test(clean);

  // Explicit question markers
  const isExplicitQuestion = clean.includes('?') ||
    /\b(berapa|apakah|adakah|gimana|bagaimana|apa saja|cek)\b/i.test(clean);

  // If the sentence mentions a nominal and is NOT an explicit question,
  // prioritize transaction recording! (e.g. "aku punya utang 50rb", "minjam uang 100rb", "makan siang 15rb")
  if (hasNominal && !isExplicitQuestion) {
    return false;
  }

  const queryKeywords = [
    'uang saku', 'sangu', 'sisa saku', 'sisa uang',
    'tagihan', 'bill', 'listrik', 'wifi', 'pdam', 'kos', 'kost',
    'utang', 'hutang', 'piutang', 'pinjam', 'pinjaman', 'kasbon',
    'jadwal', 'dijadwalkan', 'di jadwalkan', 'bayar apa', 'harus dibayar', 'rencana bayar',
    'saldo', 'uang saya', 'keuangan', 'kondisi uang',
    'boros', 'pengeluaran terbesar', 'paling banyak', 'analisis',
    'tips', 'hemat', 'saran', 'rekomendasi',
    'budget', 'budgeting', 'anggaran', 'nabung', 'menabung', 'tabungan',
    'investasi', 'dana darurat', 'alokasi', 'evaluasi', 'sehat', 'rekening',
    'gaya hidup', 'strategi', 'konsultasi', 'bantu'
  ];

  const matchesKeyword = queryKeywords.some(kw => clean.includes(kw));

  // If user asks about financial terms without a price/nominal, it's a consultation
  if (!hasNominal && matchesKeyword) {
    return true;
  }

  // Pure questions without nominal
  if (!hasNominal && (clean.includes('?') || isExplicitQuestion)) {
    return true;
  }

  // Question that includes nominal and matches financial keyword (e.g., "apakah utang 50rb kemarin sudah lunas?")
  if (hasNominal && isExplicitQuestion && matchesKeyword) {
    return true;
  }

  return false;
}

/**
 * Gather financial metrics for the current user
 */
export function getUserFinancialContext(userId) {
  const now = new Date();
  const currentYM = now.toISOString().slice(0, 7);

  // Overall Balances
  const incTotal = db.prepare(`
    SELECT COALESCE(SUM(t.amount), 0) as total
    FROM transactions t JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND c.type = 'income'
  `).get(userId).total;

  const expTotal = db.prepare(`
    SELECT COALESCE(SUM(t.amount), 0) as total
    FROM transactions t JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND c.type = 'expense'
  `).get(userId).total;

  const currentBalance = incTotal - expTotal;

  // Monthly Income & Expenses
  const monthlyInc = db.prepare(`
    SELECT COALESCE(SUM(t.amount), 0) as total
    FROM transactions t JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND c.type = 'income' AND t.occurred_on LIKE ?
  `).get(userId, `${currentYM}%`).total;

  const monthlyExp = db.prepare(`
    SELECT COALESCE(SUM(t.amount), 0) as total
    FROM transactions t JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND c.type = 'expense' AND t.occurred_on LIKE ?
  `).get(userId, `${currentYM}%`).total;

  // Monthly Uang Saku
  const uangSakuIncome = db.prepare(`
    SELECT COALESCE(SUM(t.amount), 0) as total
    FROM transactions t JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND c.name = 'Uang saku' AND t.occurred_on LIKE ?
  `).get(userId, `${currentYM}%`).total;

  // Tagihan List (Recent 5 Tagihan)
  const tagihanList = db.prepare(`
    SELECT t.amount, t.description, t.occurred_on
    FROM transactions t JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND (c.name = 'Tagihan' OR t.description LIKE '%kos%' OR t.description LIKE '%wifi%' OR t.description LIKE '%listrik%' OR t.description LIKE '%pulsa%')
    ORDER BY t.occurred_on DESC LIMIT 5
  `).all(userId);

  // Debts (Transactions mentioning utang/pinjam)
  const debtList = db.prepare(`
    SELECT t.amount, t.description, t.occurred_on
    FROM transactions t
    WHERE t.user_id = ? AND (t.description LIKE '%utang%' OR t.description LIKE '%hutang%' OR t.description LIKE '%pinjam%' OR t.raw_text LIKE '%utang%')
    ORDER BY t.occurred_on DESC LIMIT 5
  `).all(userId);

  // Top 3 Expense Categories
  const topExpenses = db.prepare(`
    SELECT c.name, SUM(t.amount) as total
    FROM transactions t JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND c.type = 'expense' AND t.occurred_on LIKE ?
    GROUP BY c.id, c.name
    ORDER BY total DESC LIMIT 3
  `).all(userId, `${currentYM}%`);

  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const currentDay = now.getDate();
  const remainingDays = Math.max(1, daysInMonth - currentDay + 1);
  const safeDailyBudget = Math.max(0, Math.round(currentBalance / remainingDays));
  const netCashFlow = monthlyInc - monthlyExp;

  return {
    currentBalance,
    monthlyInc,
    monthlyExp,
    netCashFlow,
    uangSakuIncome,
    tagihanList,
    debtList,
    topExpenses,
    daysInMonth,
    currentDay,
    remainingDays,
    safeDailyBudget
  };
}

/**
 * Handle consultation question with rule-based expert system
 * (Or fallback if Gemini is offline)
 */
export function handleRuleBasedAdvice(text, context) {
  const clean = text.toLowerCase();
  const safeDaily = formatRupiah(context.safeDailyBudget || 0);
  const sisaHari = context.remainingDays || 1;

  // 1. SISA UANG SAKU
  if (clean.includes('uang saku') || clean.includes('sangu') || clean.includes('sisa saku')) {
    const sisaSaku = Math.max(0, context.uangSakuIncome - context.monthlyExp);
    const uangSakuFormatted = formatRupiah(context.uangSakuIncome);
    const expFormatted = formatRupiah(context.monthlyExp);
    const sisaFormatted = formatRupiah(sisaSaku);
    const balanceFormatted = formatRupiah(context.currentBalance);

    let adviceStatus = '🟢 Aman & Terkendali';
    let warningNote = 'Arus pengeluaran Anda masih dalam batas aman.';
    if (context.uangSakuIncome > 0 && (context.monthlyExp / context.uangSakuIncome) > 0.8) {
      adviceStatus = '🟠 Perlu Berhemat (Sudah terpakai > 80%)';
      warningNote = `Pengeluaran sudah mendekati total uang saku masuk. Disarankan rem pengeluaran non-primer selama ${sisaHari} hari ke depan!`;
    } else if (context.monthlyExp > context.uangSakuIncome && context.uangSakuIncome > 0) {
      adviceStatus = '🔴 Defisit (Pengeluaran melebihi uang saku)';
      warningNote = 'Pengeluaran bulan ini sudah melebihi uang saku masuk. Gunakan cadangan saldo dengan bijak!';
    }

    return `💰 **Informasi Sisa Uang Saku & Analisis Proaktif (Bulan Ini):**\n\n` +
      `• **Total Uang Saku Masuk**: ${uangSakuFormatted}\n` +
      `• **Total Pengeluaran Bulan Ini**: ${expFormatted}\n` +
      `• **Estimasi Sisa Uang Saku**: ${sisaFormatted}\n` +
      `• **Total Saldo Riil di Rekening**: ${balanceFormatted}\n` +
      `• **Sisa Hari Bulan Ini**: ${sisaHari} hari\n` +
      `• **Batas Aman Pengeluaran Harian**: **${safeDaily}/hari**\n` +
      `• **Status Keuangan**: ${adviceStatus}\n\n` +
      `💡 **Catatan SakuBot**: ${warningNote}\n\n` +
      `🎯 **Langkah Proaktif Berikutnya:**\n` +
      `Mau SakuBot bantu cek pos yang paling boros atau tips alokasi hemat mingguan? Coba ketik *"pengeluaran terbesar"* atau *"tips hemat"*! 😊`;
  }

  // 2. CEK TAGIHAN TERBARU
  if (clean.includes('tagihan') || clean.includes('bill')) {
    if (!context.tagihanList || context.tagihanList.length === 0) {
      return `📄 **Status Tagihan Terbaru & Pengingat Proaktif:**\n\n` +
        `Belum ada catatan tagihan (seperti Kos, Wifi, Listrik, atau SPP) yang tercatat di sistem SakuKampus.\n\n` +
        `💡 *Anda bisa langsung mencatat tagihan kapan saja, contohnya:*\n` +
        `• *"bayar kos 600rb"*\n` +
        `• *"bayar wifi indihome 150k"*\n` +
        `• *"isi token listrik 50rb"*\n\n` +
        `🔔 **Saran SakuBot**: Segera catat begitu Anda membayar tagihan agar grafik pengeluaran tetap akurat dan tidak ada kewajiban yang terlupa!`;
    }

    const listText = context.tagihanList.map(t =>
      `• **${t.description}**: ${formatRupiah(t.amount)} *(pada ${t.occurred_on})*`
    ).join('\n');

    const totalTagihan = context.tagihanList.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    return `📄 **Catatan Tagihan Anda:**\n\n${listText}\n\n` +
      `• **Total Tagihan Terdata**: ${formatRupiah(totalTagihan)}\n\n` +
      `💡 **Pengingat Proaktif SakuBot**:\n` +
      `Pastikan komitmen tagihan rutin bulanan (Kos, Kuota/Wifi, Listrik) sudah disisihkan di awal bulan agar tidak terpakai untuk jajan impulsif!\n\n` +
      `Mau cek jadwal bayar lainnya? Ketik *"jadwal bayar"*!`;
  }

  // 3. CEK UTANG / PIUTANG
  if (clean.includes('utang') || clean.includes('hutang') || clean.includes('pinjam')) {
    if (!context.debtList || context.debtList.length === 0) {
      return `🎉 **Status Utang & Pinjaman:**\n\n` +
        `Hebat! Anda **tidak memiliki catatan utang aktif** di sistem SakuKampus. Bebas utang membuat arus kas Anda tenang dan jauh lebih leluasa! 👏\n\n` +
        `💡 *Tips SakuBot*: Pertahankan kebiasaan hidup sesuai kemampuan finansial dan hindari godaan paylater/pinjol konsumtif.\n\n` +
        `Jika ingin mencatat pinjaman ke teman, cukup ketik misal: *"pinjam uang 50rb"* atau *"bayar utang 50rb"*.`;
    }

    const debtItems = context.debtList.map(d =>
      `• **${d.description}**: ${formatRupiah(d.amount)} *(tanggal ${d.occurred_on})*`
    ).join('\n');

    const totalUtang = context.debtList.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    return `⚠️ **Catatan Utang / Pinjaman Anda:**\n\n${debtItems}\n\n` +
      `• **Total Pinjaman**: ${formatRupiah(totalUtang)}\n\n` +
      `💡 **Strategi Pelunasan Cepat dari SakuBot**:\n` +
      `1. Prioritaskan lunasi utang ke teman sesegera mungkin untuk menjaga silaturahmi & kepercayaan.\n` +
      `2. Sisihkan sebagian dari uang saku atau pemasukan berikutnya sebelum dialokasikan ke pos hiburan.\n\n` +
      `Ada pinjaman yang sudah lunas? Segera catat agar daftar ini diperbarui!`;
  }

  // 4. JADWAL BAYAR / SUDAH DIJADWALKAN
  if (clean.includes('jadwal') || clean.includes('dijadwalkan') || clean.includes('rutin') || clean.includes('komitmen')) {
    const hasKos = (context.tagihanList || []).some(t => t.description.toLowerCase().includes('kos'));
    const hasWifi = (context.tagihanList || []).some(t => t.description.toLowerCase().includes('wifi') || t.description.toLowerCase().includes('kuota') || t.description.toLowerCase().includes('internet'));
    const hasListrik = (context.tagihanList || []).some(t => t.description.toLowerCase().includes('listrik') || t.description.toLowerCase().includes('pln'));

    return `🗓️ **Jadwal & Komitmen Pembayaran Rutin Mahasiswa Bulan Ini:**\n\n` +
      `1. **Uang Kos / Kontrakan**: ${hasKos ? '✅ Sudah tercatat dibayar' : '⏳ Belum tercatat bulan ini (biasanya tgl 1 - 10)'}\n` +
      `2. **Paket Data / Internet Wifi**: ${hasWifi ? '✅ Sudah tercatat dibayar' : '⏳ Belum tercatat bulan ini'}\n` +
      `3. **Listrik / Token PLN**: ${hasListrik ? '✅ Sudah tercatat dibayar' : '⏳ Belum tercatat bulan ini'}\n` +
      `4. **Iuran / UKT Kuliah UMY**: ⏳ Pantau kalender akademik & portal KRS UMY\n\n` +
      `💡 **Saran Proaktif**: Ketik misal *"kemarin bayar kos 650rb"* atau *"isi pulsa 50k"* begitu Anda membayar agar status checklist ini langsung terupdate!`;
  }

  // 5. CEK SALDO TOTAL & ARUS KAS
  if (clean.includes('saldo') || clean.includes('uang saya') || clean.includes('keuangan')) {
    const netFlow = context.monthlyInc - context.monthlyExp;
    const flowText = netFlow >= 0 ? `Surplus +${formatRupiah(netFlow)} 🟢` : `Defisit -${formatRupiah(Math.abs(netFlow))} 🔴`;

    return `💳 **Ringkasan Saldo & Arus Kas Keuangan Anda:**\n\n` +
      `• **Total Saldo Saat Ini**: **${formatRupiah(context.currentBalance)}**\n` +
      `• **Pemasukan Bulan Ini**: ${formatRupiah(context.monthlyInc)}\n` +
      `• **Pengeluaran Bulan Ini**: ${formatRupiah(context.monthlyExp)}\n` +
      `• **Arus Kas Bersih (Net)**: ${flowText}\n` +
      `• **Batas Pengeluaran Aman**: **${safeDaily}/hari** *(selama sisa ${sisaHari} hari)*\n\n` +
      `📊 Grafik tren dan donat kategori selengkapnya dapat dilihat di menu **Dashboard**.\n\n` +
      `Ingin tahu kategori apa yang paling menyerap anggaranmu? Ketik *"pengeluaran terbesar"*!`;
  }

  // 6. PENGELUARAN TERBESAR / BOROS DI MANA
  if (clean.includes('boros') || clean.includes('terbesar') || clean.includes('paling banyak')) {
    if (!context.topExpenses || context.topExpenses.length === 0) {
      return `📊 Belum ada data pengeluaran yang tercatat bulan ini untuk dianalisis. Mulai catat pengeluaranmu yuk, misal: *"makan siang 15rb"*!`;
    }

    const topList = context.topExpenses.map((e, idx) =>
      `${idx + 1}. **${e.name}**: ${formatRupiah(e.total)}`
    ).join('\n');

    const topCategory = context.topExpenses[0]?.name || 'Makan';
    let specificTip = 'Coba evaluasi pos nomor 1 ini agar arus kas tetap seimbang.';
    if (topCategory === 'Makan') {
      specificTip = 'Pos Makan adalah pengeluaran terbesar. Manfaatkan warung makan ramah mahasiswa di sekitar kampus UMY (seperti Tamantirto) dan bawa tumbler air minum untuk memangkas jajan es teh/kopi!';
    } else if (topCategory === 'Belanja') {
      specificTip = 'Pos Belanja dominan. Terapkan aturan tunggu 48 jam sebelum checkout online untuk menghindari belanja impulsif!';
    } else if (topCategory === 'Transportasi') {
      specificTip = 'Pos Transportasi dominan. Coba bareng teman searah atau manfaatkan TransJogja untuk perjalanan jarak menengah.';
    }

    return `📊 **Analisis Kategori Pengeluaran Terbesar Bulan Ini:**\n\n${topList}\n\n` +
      `💡 **Tips Khusus SakuBot**: ${specificTip}\n\n` +
      `Mau tips budgeting menyeluruh? Ketik *"budgeting"* atau *"tips hemat"*!`;
  }

  // 7. BUDGETING & ALOKASI ANGGARAN
  if (clean.includes('budget') || clean.includes('anggaran') || clean.includes('alokasi')) {
    const totalInc = context.monthlyInc || context.uangSakuIncome || 1000000;
    const kebutuhan = formatRupiah(Math.round(totalInc * 0.5));
    const keinginan = formatRupiah(Math.round(totalInc * 0.3));
    const tabungan = formatRupiah(Math.round(totalInc * 0.2));

    return `📐 **Panduan Formula Budgeting 50/30/20 Mahasiswa (Simulasi):**\n\n` +
      `Berdasarkan total pemasukan Anda (${formatRupiah(totalInc)}), alokasi idealnya adalah:\n` +
      `1. **50% Kebutuhan Primer (${kebutuhan})**: Makan harian, kos, wifi/kuota, listrik, bensin.\n` +
      `2. **30% Keinginan & Rekreasi (${keinginan})**: Nongkrong, ngopi, jajan santai, langganan hiburan.\n` +
      `3. **20% Tabungan & Cadangan (${tabungan})**: Dana darurat, tabungan wisuda/laptop, atau modal masa depan.\n\n` +
      `💡 **Saran Proaktif**: Jika saat ini belum bisa 20% untuk tabungan, mulai dari 5-10% dulu secara konsisten setiap awal kiriman datang!`;
  }

  // 8. MENABUNG, DANA DARURAT & INVESTASI
  if (clean.includes('nabung') || clean.includes('menabung') || clean.includes('tabungan') || clean.includes('investasi') || clean.includes('darurat')) {
    return `🎯 **Strategi Menabung & Dana Darurat Cerdas Mahasiswa:**\n\n` +
      `1. **Prinsip *Pay Yourself First***: Begitu uang saku masuk, langsung pisahkan minimal Rp 50.000 - Rp 100.000 ke rekening terpisah atau dompet digital khusus tabungan.\n` +
      `2. **Target Dana Darurat Mahasiswa**: Kumpulkan minimal Rp 500.000 - Rp 1.000.000 sebagai benteng jika motor butuh servis mendadak atau sakit.\n` +
      `3. **Tantangan Menabung Harian**: Sisihkan sisa uang kembalian atau jatah hemat harian (misal Rp 10.000/hari = Rp 300.000/bulan!).\n\n` +
      `Mau cek berapa batas belanja aman harianmu sekarang? Cek *"sisa uang saku"*!`;
  }

  // 9. EVALUASI & KESEHATAN KEUANGAN
  if (clean.includes('evaluasi') || clean.includes('sehat') || clean.includes('kondisi')) {
    const ratio = context.monthlyInc > 0 ? (context.monthlyExp / context.monthlyInc) * 100 : 0;
    let score = '🟢 Sangat Sehat (Pengeluaran < 70% pemasukan)';
    if (ratio > 100) {
      score = '🔴 Perlu Evaluasi Serius (Defisit, pengeluaran melampaui pemasukan)';
    } else if (ratio > 80) {
      score = '🟠 Waspada (Pengeluaran menyerap > 80% pemasukan)';
    }

    return `🩺 **Health Check Keuangan Anda Bulan Ini:**\n\n` +
      `• **Rasio Pengeluaran vs Pemasukan**: ${ratio.toFixed(1)}%\n` +
      `• **Status Kesehatan**: ${score}\n` +
      `• **Cadangan Saldo Riil**: ${formatRupiah(context.currentBalance)}\n` +
      `• **Batas Aman Belanja**: **${safeDaily}/hari**\n\n` +
      `💡 **Rekomendasi SakuBot**: Jaga agar rasio pengeluaran tidak melebihi 80% agar Anda memiliki ruang napas untuk menabung.`;
  }

  // 10. TIPS HEMAT & KONSULTASI UMUM
  return `🎓 **Tips Finansial Proaktif Mahasiswa UMY ala SakuBot:**\n\n` +
    `1. **Strategi Makan Hemat**: Eksplor warung prasmanan atau kantin sekitar kampus UMY (Tamantirto/Kasihan), serta manfaatkan dispenser air isi ulang kampus.\n` +
    `2. **Audit Langganan Digital**: Nonaktifkan aplikasi berbayar yang jarang dipakai (streaming musik/film) atau gunakan paket *student/family plan*.\n` +
    `3. **Catat Transaksi Mikro**: Pengeluaran kecil seperti parkir Rp 2.000 dan jajan kopi cepat menumpuk jika tidak dipantau!\n` +
    `4. **Batas Belanja Hari Ini**: Saldo aman yang bisa Anda belanjakan saat ini adalah sekitar **${safeDaily}/hari**.\n\n` +
    `💬 **Mau berdiskusi tentang apa lagi?**\n` +
    `Anda bisa tanyakan: *"sisa uang saku"*, *"cek tagihan"*, *"pengeluaran terbesar"*, *"jadwal bayar"*, atau *"budgeting"*! 😊`;
}

/**
 * Handle consultation with Gemini AI (if available) with real live database context
 */
export async function getGeminiConsultationResponse(userQuestion, context) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return handleRuleBasedAdvice(userQuestion, context);
  }

  const customInstructions = process.env.SAKUBOT_CUSTOM_INSTRUCTIONS || '';
  const now = new Date();
  const safeDaily = formatRupiah(context.safeDailyBudget || 0);

  const prompt = `Anda adalah SakuBot, asisten dan konsultan finansial cerdas, proaktif, dan serba bisa untuk mahasiswa Universitas Muhammadiyah Yogyakarta (UMY).

[IDENTITAS & KARAKTER SAKUBOT]
- Nama: SakuBot (Asisten Finansial Cerdas Mahasiswa UMY).
- Karakter: Ramah, santun, cerdas, energik, solutif, empatik, suportif, dan tidak kaku (seperti senior/mentor finansial sebaya yang suportif).
- Format: Bahasa Indonesia yang komunikatif, semi-kasual namun tetap santun dan profesional. Gunakan format Markdown (bold, bullet points, numbered lists, dan emoji relevan).

[INSTRUKSI UTAMA: LEBIH AKTIF & PROAKTIF]
1. Analisis Mandiri & Peringatan Dini:
   - Jangan hanya menjawab "ya/tidak" atau memberikan angka mentah.
   - Analisis rasio pengeluaran terhadap pemasukan pengguna, sisa hari dalam bulan berjalan, dan ingatkan estimasi batas aman belanja per hari.
   - Jika pengguna boros atau saldo menipis, beri peringatan dini dengan nada positif dan suportif.
2. Rekomendasi Solutif & Konkret:
   - Berikan tips aksi nyata yang aplikatif bagi mahasiswa di lingkungan kampus UMY/Jogja (misalnya: makan di warung ramah kantong sekitar Tamantirto/Kasihan, manfaatkan wifi dan air minum gratis kampus, tips belanja hemat mingguan, alternatif transportasi).
   - Berikan simulasi perhitungan konkret (misalnya penghematan harian atau alokasi anggaran).
3. Interaksi Dua Arah (Proactive Call-to-Action):
   - Selalu akhiri setiap jawaban dengan 1-2 pertanyaan pemantik atau tawaran bantuan proaktif untuk melanjutkan obrolan (Contoh: "Mau aku buatkan simulasi jatah belanja harian sampai akhir bulan?", "Apakah mau tips memangkas pos pengeluaran terbesar kamu?").

[INSTRUKSI UTAMA: TIDAK TERBATAS & FLEKSIBEL]
1. Bebas Diskusi Segala Topik Finansial Mahasiswa:
   - Anda TIDAK TERBATAS hanya pada data database. Anda bebas diajak berdiskusi tentang:
     * Perencanaan anggaran (budgeting 50/30/20, amplop digital).
     * Tips mencari pemasukan tambahan / freelance / part-time untuk mahasiswa.
     * Tips menabung untuk impian tertentu (laptop, bayar UKT/wisuda, liburan).
     * Literasi finansial dasar (investasi reksadana/emas untuk pemula, bahaya pinjol ilegal, manajemen utang).
     * Komparasi biaya hidup dan keputusan belanja (kos ber-AC vs non-AC, masak sendiri vs beli di luar).
2. Penjelasan Lengkap & Berbobot:
   - Jangan membatasi jawaban hanya beberapa patah kata pendek. Jelaskan langkah-langkah secara runtut, mendalam, dan edukatif sesuai kebutuhan pengguna.
3. Kepatuhan Data Pengguna:
   - Jika menjawab kondisi keuangan riil akun pengguna, gunakan angka dari ringkasan data di bawah secara akurat. Jangan memanipulasi angka saldo riil mereka.

${customInstructions ? `[INSTRUKSI TAMBAHAN KHUSUS DARI PENGGUNA]\n${customInstructions}\n` : ''}
[RINGKASAN DATA KEUANGAN PENGGUNA SAAT INI]
- Tanggal Hari Ini: ${now.toISOString().split('T')[0]} (Hari ke-${context.currentDay} dari ${context.daysInMonth} hari)
- Sisa Hari Bulan Ini: ${context.remainingDays} hari
- Total Saldo Riil Saat Ini: ${formatRupiah(context.currentBalance)}
- Pemasukan Bulan Ini: ${formatRupiah(context.monthlyInc)}
- Pengeluaran Bulan Ini: ${formatRupiah(context.monthlyExp)}
- Arus Kas Bersih (Net): ${formatRupiah(context.netCashFlow)}
- Pemasukan dari Uang Saku: ${formatRupiah(context.uangSakuIncome)}
- Estimasi Jatah Belanja Aman Harian: ${safeDaily}/hari
- Catatan Tagihan Terakhir: ${JSON.stringify(context.tagihanList)}
- Catatan Utang/Pinjaman: ${JSON.stringify(context.debtList)}
- Top Pengeluaran Bulan Ini: ${JSON.stringify(context.topExpenses)}

Pertanyaan Pengguna:
"${userQuestion}"

Jawablah sesuai seluruh panduan di atas dengan gaya SakuBot yang aktif, bersahabat, dan solutif!`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1500
        }
      })
    });

    if (!response.ok) {
      console.warn('Gemini consultation API returned status:', response.status);
      return handleRuleBasedAdvice(userQuestion, context);
    }

    const resData = await response.json();
    const answer = resData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (answer) {
      return answer.trim();
    }
    return handleRuleBasedAdvice(userQuestion, context);
  } catch (err) {
    console.warn('Gemini consultation fallback due to:', err.message);
    return handleRuleBasedAdvice(userQuestion, context);
  }
}
