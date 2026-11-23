# SakuKampus UMY - Finance Tracker Chatbot

> **Manajemen Proyek TI · Metode Waterfall**  
> **Kelompok Team 7 · Universitas Muhammadiyah Yogyakarta (UMY)**

SakuKampus UMY adalah aplikasi web pencatat keuangan cerdas yang memudahkan mahasiswa mencatat pemasukan dan pengeluaran melalui percakapan alami (chat) dan suara (voice) tanpa harus mengisi formulir manual yang panjang, dengan ringkasan visual otomatis pada dashboard.

---

## 👥 Tim Pengembang (Team 7)

| No | Nama Anggota | NIM | Peran (Role) |
|---|---|---|---|
| 1 | **Faid Arya Pamungkas** | 20240140108 | **Project Manager (PM)** |
| 2 | **Argy Tata Maulana** | 20240140128 | **Backend Developer (BE)** |
| 3 | **Muhammad Fawwaz Naufal Dzulfikar** | 20240140122 | **Backend Developer (BE)** |
| 4 | **Isna Habibah Ramadhani** | 20240140054 | **Frontend Developer (FE)** |
| 5 | **Keisha Shendy Fadhillah Arrafli** | 20240140281 | **Frontend Developer (FE)** |
| 6 | **Chintya Nuryaman** | 20240140195 | **QC / Testing (QA)** |
| 7 | **Randi Rozikin** | 20240140140 | **QC / Testing (QA)** |

---

## 🎯 10 Fitur In-Scope (F-01 s.d. F-10)

| Kode | Fitur | Prioritas | Deskripsi & Implementasi |
|---|---|---|---|
| **F-01** | **Login & Logout Google** | Tinggi | OAuth 2.0 Authorization Code flow di backend, sesi cookie `httpOnly` bertanda tangan, identitas berbasis `google_sub`. Dilengkapi tombol demo 1-klik untuk pengujian instan. |
| **F-02** | **Catat Transaksi lewat Chat & Suara** | Tinggi | Input teks chatbot dan pengenalan suara berbahasa Indonesia (`id-ID`) menggunakan browser Web Speech API. |
| **F-03** | **Kategori Transaksi Otomatis** | Tinggi | Pembaca berbasis aturan (*rule-based parser*) untuk mendeteksi nominal, jenis (pemasukan/pengeluaran), tanggal, dan 12 kategori standar. Dilengkapi fallback Gemini API untuk kalimat kompleks. |
| **F-04** | **Tangani Kalimat Tidak Dikenali** | Tinggi | Bila nominal atau makna transaksi tidak dipahami, sistem berhenti lebih awal (*break*), tidak menyimpan data sampah ke database, dan mengembalikan pesan bantuan ramah beserta contoh format. |
| **F-05** | **Riwayat Transaksi** | Tinggi | Tabel interaktif riwayat transaksi lengkap dengan filter tipe, kategori, rentang tanggal, dan pencarian teks. |
| **F-06** | **Dashboard Saldo & Ringkasan** | Tinggi | Kartu ringkasan total saldo, pemasukan bulanan, pengeluaran bulanan, dan status kuota pemakaian chat. |
| **F-07** | **Grafik Kategori & Tren Bulanan** | Tinggi | Visualisasi Chart.js berupa grafik Donat (distribusi kategori pengeluaran) dan grafik Garis (tren bulanan pemasukan vs pengeluaran). |
| **F-08** | **Keamanan Data Antar Pengguna** | Tinggi | Isolasi data ketat berbasis `user_id` dari sesi cookie terverifikasi, bukan dari input URL/body pengguna. |
| **F-09** | **Pembatasan Pemakaian (Rate Limiting)** | Tinggi | Pemantauan kuota harian (maks. 50 chat/hari) di tabel `chat_usage` untuk mitigasi biaya API. |
| **F-10** | **Ubah & Hapus Transaksi** | Sedang | Modal interaktif untuk mengedit nominal, kategori, keterangan, atau tanggal transaksi, serta konfirmasi penghapusan aman. |

---

## 🗄️ Skema Database (ERD T8-1)

Aplikasi memiliki 4 tabel relasional:
1. **`users`**: `id`, `google_sub`, `email`, `name`, `picture_url`, `created_at`, `last_login_at`
2. **`categories`**: `id`, `name`, `type` (`income` atau `expense`)
   - **Pengeluaran (8)**: *Makan, Transportasi, Belanja, Tagihan, Hiburan, Kesehatan, Pendidikan, Lain-lain pengeluaran*
   - **Pemasukan (4)**: *Gaji, Uang saku, Bonus, Lain-lain pemasukan*
3. **`transactions`**: `id`, `user_id`, `category_id`, `amount`, `description`, `raw_text`, `source` (`chat`/`voice`), `parsed_by` (`rule`/`llm`), `occurred_on`, `created_at`, `updated_at`
4. **`chat_usage`**: `user_id`, `usage_date`, `request_count`, `llm_count` *(Composite PK: user_id, usage_date)*

---

## 🚀 Cara Menjalankan Aplikasi

### 1. Prasyarat
- Node.js versi 18 atau lebih baru.

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Konfigurasi Lingkungan (`.env`)
Salin file `.env.example` ke `.env`:
```env
PORT=3000
NODE_ENV=development
JWT_SECRET=sakukampus-team7-secret-key-2026
COOKIE_SECRET=sakukampus-cookie-secret-2026
DAILY_CHAT_LIMIT=50

# Opsional: Jika ingin menghubungkan Google Cloud Console & Gemini AI
# GOOGLE_CLIENT_ID=...
# GOOGLE_CLIENT_SECRET=...
# GEMINI_API_KEY=...
```

### 4. Menjalankan Server
```bash
npm start
```
Buka peramban di: **`http://localhost:3000`**

- Anda dapat langsung masuk dengan menekan tombol **"Masuk Mode Demo (1-Klik)"** atau menggunakan **"Masuk dengan Akun Google"**.
