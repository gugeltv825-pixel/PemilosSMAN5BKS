# Pemilos SMAN 5 BKS

Website Pemilihan Ketua & Wakil Ketua OSIS dengan **halaman voting dan halaman hasil yang terpisah**, sehingga pemilih tidak melihat perolehan suara saat sedang memilih.

## Fitur

- **Beranda** (`/`) — profil singkat kandidat & status pemungutan suara.
- **Halaman Voting** (`/vote`) — pemilih memilih satu kandidat lalu mengonfirmasi dengan NISN & nama. Satu NISN hanya bisa memilih satu kali.
- **Halaman Hasil** (`/hasil`) — grafik batang hasil suara real-time (auto-refresh setiap 5 detik), terpisah total dari halaman voting.
- **Panel Admin** (`/admin`) — kelola kandidat, buka/tutup pemungutan suara, reset data, dilindungi token admin.
- Suara disimpan **anonim**: tabel pemilih hanya mencatat "NISN ini sudah memilih", tanpa menyimpan kandidat pilihannya — sehingga hasil tidak bisa ditelusuri balik ke pemilih tertentu.

## Struktur Proyek

```
├── server.js           # Server Express + semua route API & halaman
├── src/
│   ├── db.js            # Setup database SQLite (better-sqlite3)
│   └── seed.js           # Data kandidat contoh
├── public/
│   ├── index.html        # Beranda
│   ├── vote.html          # Halaman voting
│   ├── hasil.html         # Halaman hasil
│   ├── admin.html         # Panel admin
│   └── css/style.css
└── data/                 # File database SQLite (dibuat otomatis)
```

## Menjalankan di Lokal

1. Install dependency:
   ```bash
   npm install
   ```
2. Salin file environment lalu sesuaikan:
   ```bash
   cp .env.example .env
   ```
   Ubah `ADMIN_TOKEN` menjadi token rahasia milikmu.
3. (Opsional) isi data kandidat contoh:
   ```bash
   npm run seed
   ```
4. Jalankan server:
   ```bash
   npm start
   ```
5. Buka di browser:
   - Beranda: http://localhost:3000/
   - Voting: http://localhost:3000/vote
   - Hasil: http://localhost:3000/hasil
   - Admin: http://localhost:3000/admin (masukkan `ADMIN_TOKEN` dari `.env`)

## Mengelola Kandidat

Gunakan panel `/admin` untuk menambah/menghapus kandidat, atau edit langsung `src/seed.js` dan jalankan `npm run seed` untuk mengisi ulang data contoh.

## Catatan Keamanan untuk Pemilihan Sungguhan

Proyek ini dibuat sebagai fondasi sederhana. Untuk digunakan pada pemilihan resmi di sekolah, pertimbangkan tambahan berikut:
- Jalankan di belakang HTTPS.
- Ganti verifikasi NISN dengan daftar siswa terverifikasi (misalnya import dari data sekolah) agar tidak bisa diisi bebas.
- Batasi akses halaman voting hanya dari jaringan/perangkat sekolah saat hari pemungutan suara.
- Backup berkala file `data/pemilos.sqlite`.
