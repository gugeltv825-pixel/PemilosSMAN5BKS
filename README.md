# Pemilos SMAN 5 BKS

Website Pemilihan Ketua & Wakil Ketua OSIS dengan **halaman voting dan halaman hasil yang terpisah**, sehingga pemilih tidak melihat perolehan suara saat sedang memilih.

## Fitur

- **Beranda** (`/`) — profil singkat kandidat & status pemungutan suara.
- **Halaman Voting** (`/vote`) — pemilih memilih satu kandidat lalu mengonfirmasi dengan NISN & nama. Satu NISN hanya bisa memilih satu kali.
- **Halaman Hasil** (`/hasil`) — grafik batang hasil suara real-time (auto-refresh setiap 5 detik), terpisah total dari halaman voting.
- **Panel Admin** (`/admin`) — kelola kandidat, buka/tutup pemungutan suara, reset data, dilindungi token admin.
- Suara disimpan **anonim**: tabel pemilih hanya mencatat "NISN ini sudah memilih", tanpa menyimpan kandidat pilihannya — sehingga hasil tidak bisa ditelusuri balik ke pemilih tertentu.
- Database memakai **Supabase (Postgres)** supaya data suara tetap tersimpan permanen walau dijalankan di hosting serverless seperti Vercel.

## Struktur Proyek

```
├── server.js           # Aplikasi Express + semua route API & halaman (diekspor, tidak listen sendiri)
├── api/
│   └── index.js          # Entry point untuk Vercel Serverless Function (re-export server.js)
├── vercel.json           # Konfigurasi deploy ke Vercel
├── src/
│   ├── supabase.js       # Klien Supabase (dibaca dari env var)
│   └── seed.js           # Skrip untuk isi data kandidat contoh
├── public/
│   ├── index.html        # Beranda
│   ├── vote.html          # Halaman voting
│   ├── hasil.html         # Halaman hasil
│   ├── admin.html         # Panel admin
│   └── css/style.css
└── .env.example
```

## Menjalankan di Lokal

1. Install dependency:
   ```bash
   npm install
   ```
2. Buat project di [supabase.com](https://supabase.com) (gratis), lalu buka **SQL Editor** dan jalankan skema di bawah ini (lihat bagian "Skema Database").
3. Salin file environment lalu sesuaikan:
   ```bash
   cp .env.example .env
   ```
   Isi `SUPABASE_URL` dan `SUPABASE_KEY` (publishable/anon key) dari **Project Settings > API** di dashboard Supabase, dan ganti `ADMIN_TOKEN` menjadi token rahasia milikmu.
4. (Opsional) isi data kandidat contoh:
   ```bash
   npm run seed
   ```
5. Jalankan server:
   ```bash
   npm start
   ```
6. Buka di browser:
   - Beranda: http://localhost:3000/
   - Voting: http://localhost:3000/vote
   - Hasil: http://localhost:3000/hasil
   - Admin: http://localhost:3000/admin (masukkan `ADMIN_TOKEN` dari `.env`)

## Skema Database (Supabase / Postgres)

Jalankan SQL ini sekali di **SQL Editor** project Supabase kamu:

```sql
create table if not exists candidates (
  id bigint generated always as identity primary key,
  nomor_urut integer not null unique,
  nama_ketua text not null,
  nama_wakil text not null,
  kelas text,
  visi text,
  misi text,
  foto_url text,
  warna text default '#2563eb',
  created_at timestamptz default now()
);

create table if not exists votes (
  id bigint generated always as identity primary key,
  candidate_id bigint not null references candidates(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists voters (
  nisn text primary key,
  nama text,
  kelas text,
  voted_at timestamptz default now()
);

create table if not exists settings (
  key text primary key,
  value text
);

insert into settings (key, value) values ('voting_open', '1')
on conflict (key) do nothing;

create or replace view results_view as
  select c.id, c.nomor_urut, c.nama_ketua, c.nama_wakil, c.warna, count(v.id) as suara
  from candidates c
  left join votes v on v.candidate_id = c.id
  group by c.id
  order by c.nomor_urut asc;

grant select on results_view to anon, authenticated;
```

## Deploy ke Vercel (supaya ada link publik)

Proyek ini sudah disiapkan untuk Vercel (lihat `vercel.json` + `api/index.js`):

1. Import repo ini di [vercel.com](https://vercel.com/new) (hubungkan akun GitHub-mu).
2. Di pengaturan project, tambahkan **Environment Variables** berikut (Project Settings → Environment Variables):
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `ADMIN_TOKEN`
   - `ELECTION_TITLE` (opsional)
3. Deploy. Setiap push ke branch produksi akan otomatis re-deploy.

> GitHub sendiri (termasuk GitHub Pages) **tidak bisa** menjalankan proyek ini karena hanya melayani file statis, sedangkan website ini butuh server backend yang jalan terus untuk memvalidasi NISN dan menyimpan suara.

## Mengelola Kandidat

Gunakan panel `/admin` untuk menambah/menghapus kandidat, atau jalankan `npm run seed` untuk mengisi data kandidat contoh (lihat/ubah di `src/seed.js`).

## Catatan Keamanan

- Kunci `SUPABASE_KEY` yang dipakai adalah publishable/anon key, tapi **hanya dipakai dari sisi server** (disimpan sebagai environment variable), tidak pernah dikirim ke browser.
- Tabel di Supabase **tidak mengaktifkan Row Level Security**, karena alur publik (voting) dan alur admin sama-sama lewat backend yang sama. Kontrol akses admin dilakukan di level aplikasi lewat header `x-admin-token`, bukan di level database. Untuk pemilihan berskala besar/lebih formal, pertimbangkan menambahkan RLS + Postgres function khusus admin.
- Jalankan di belakang HTTPS (otomatis kalau pakai Vercel).
- Ganti verifikasi NISN dengan daftar siswa terverifikasi (misalnya import dari data sekolah) agar tidak bisa diisi bebas.
- Batasi akses halaman voting hanya dari jaringan/perangkat sekolah saat hari pemungutan suara, bila perlu.
