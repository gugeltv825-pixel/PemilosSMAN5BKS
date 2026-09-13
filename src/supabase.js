// Klien Supabase untuk backend. Kunci yang dipakai adalah publishable/anon key,
// TAPI hanya dipakai dari sisi server (Express) dan tersimpan sebagai environment
// variable di server/Vercel — tidak pernah dikirim ke browser.
//
// Catatan keamanan: tabel di Supabase project ini TIDAK mengaktifkan Row Level
// Security, karena baik alur publik (voting) maupun alur admin (kelola kandidat,
// buka/tutup voting) sama-sama lewat backend ini dengan kunci yang sama. Kontrol
// akses admin dilakukan di level aplikasi lewat header x-admin-token (lihat
// server.js), bukan di level database. Untuk pemilihan berskala besar, lapisan ini
// sebaiknya diperkuat dengan RLS + Postgres function khusus admin.
const { createClient } = require('@supabase/supabase-js');

let client = null;
let warned = false;

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;

  if (!url || !key) {
    if (!warned) {
      console.error(
        'SUPABASE_URL / SUPABASE_KEY belum diset. Isi file .env (lihat .env.example).'
      );
      warned = true;
    }
    return null;
  }

  if (!client) {
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

module.exports = { getSupabase };
