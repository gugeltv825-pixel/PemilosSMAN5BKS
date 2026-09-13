require('dotenv').config();
const path = require('path');
const express = require('express');
const { getSupabase } = require('./src/supabase');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'ubah-token-ini';
const ELECTION_TITLE =
  process.env.ELECTION_TITLE || 'Pemilihan Ketua & Wakil Ketua OSIS SMAN 5 BKS';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Middleware: pastikan Supabase sudah dikonfigurasi ----------
function requireDb(req, res, next) {
  const db = getSupabase();
  if (!db) {
    return res.status(500).json({
      error:
        'Server belum terhubung ke database (SUPABASE_URL / SUPABASE_KEY belum diset).'
    });
  }
  req.db = db;
  next();
}

// ---------- Halaman (clean URLs) ----------
app.get(['/', '/index'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/vote', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'vote.html'));
});
app.get('/hasil', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'hasil.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ---------- Middleware admin ----------
function requireAdmin(req, res, next) {
  const token = req.get('x-admin-token') || req.query.token;
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Token admin tidak valid.' });
  }
  next();
}

// ---------- API publik: info pemilihan ----------
app.get('/api/status', requireDb, async (req, res) => {
  try {
    const [{ data: setting, error: settingErr }, { count: totalVoters, error: voterErr }] =
      await Promise.all([
        req.db.from('settings').select('value').eq('key', 'voting_open').maybeSingle(),
        req.db.from('voters').select('*', { count: 'exact', head: true })
      ]);
    if (settingErr) throw settingErr;
    if (voterErr) throw voterErr;

    res.json({
      title: ELECTION_TITLE,
      votingOpen: setting ? setting.value === '1' : true,
      totalVoters: totalVoters || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

// ---------- API publik: daftar kandidat (untuk halaman voting) ----------
app.get('/api/candidates', requireDb, async (req, res) => {
  const { data, error } = await req.db
    .from('candidates')
    .select('id, nomor_urut, nama_ketua, nama_wakil, kelas, visi, misi, foto_url, warna')
    .order('nomor_urut', { ascending: true });

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
  res.json(data);
});

// ---------- API publik: kirim suara ----------
app.post('/api/vote', requireDb, async (req, res) => {
  const db = req.db;

  const { data: setting, error: settingErr } = await db
    .from('settings')
    .select('value')
    .eq('key', 'voting_open')
    .maybeSingle();
  if (settingErr) {
    console.error(settingErr);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
  const votingOpen = setting ? setting.value === '1' : true;
  if (!votingOpen) {
    return res.status(403).json({ error: 'Pemungutan suara sedang ditutup.' });
  }

  const { nisn, nama, kelas, candidateId } = req.body || {};

  if (!nisn || !String(nisn).trim()) {
    return res.status(400).json({ error: 'NISN wajib diisi.' });
  }
  if (!nama || !String(nama).trim()) {
    return res.status(400).json({ error: 'Nama wajib diisi.' });
  }
  if (!candidateId) {
    return res.status(400).json({ error: 'Pilih salah satu kandidat.' });
  }

  const nisnClean = String(nisn).trim();

  const { data: candidate, error: candidateErr } = await db
    .from('candidates')
    .select('id')
    .eq('id', candidateId)
    .maybeSingle();
  if (candidateErr) {
    console.error(candidateErr);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
  if (!candidate) {
    return res.status(400).json({ error: 'Kandidat tidak ditemukan.' });
  }

  // Coba catat pemilih dulu (NISN unik) — kalau sudah ada, ditolak (409).
  const { error: voterInsertErr } = await db
    .from('voters')
    .insert({ nisn: nisnClean, nama: String(nama).trim(), kelas: kelas ? String(kelas).trim() : null });

  if (voterInsertErr) {
    if (voterInsertErr.code === '23505') {
      return res.status(409).json({ error: 'NISN ini sudah digunakan untuk memilih.' });
    }
    console.error(voterInsertErr);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }

  const { error: voteInsertErr } = await db.from('votes').insert({ candidate_id: candidate.id });
  if (voteInsertErr) {
    console.error(voteInsertErr);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }

  res.status(201).json({ success: true });
});

// ---------- API publik: hasil (halaman hasil terpisah dari halaman voting) ----------
app.get('/api/results', requireDb, async (req, res) => {
  const db = req.db;

  const [{ data: rows, error: resultsErr }, { data: setting, error: settingErr }, { count: totalVoters, error: voterErr }] =
    await Promise.all([
      db.from('results_view').select('*'),
      db.from('settings').select('value').eq('key', 'voting_open').maybeSingle(),
      db.from('voters').select('*', { count: 'exact', head: true })
    ]);

  if (resultsErr || settingErr || voterErr) {
    console.error(resultsErr || settingErr || voterErr);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }

  const totalSuara = rows.reduce((sum, r) => sum + Number(r.suara), 0);

  res.json({
    title: ELECTION_TITLE,
    votingOpen: setting ? setting.value === '1' : true,
    totalSuara,
    totalVoters: totalVoters || 0,
    kandidat: rows
  });
});

// ---------- API admin ----------
app.get('/api/admin/check', requireAdmin, (req, res) => {
  res.json({ ok: true });
});

app.get('/api/admin/summary', requireDb, requireAdmin, async (req, res) => {
  const db = req.db;
  const [{ count: totalVoters, error: voterErr }, { count: totalVotes, error: voteErr }, { data: setting, error: settingErr }] =
    await Promise.all([
      db.from('voters').select('*', { count: 'exact', head: true }),
      db.from('votes').select('*', { count: 'exact', head: true }),
      db.from('settings').select('value').eq('key', 'voting_open').maybeSingle()
    ]);

  if (voterErr || voteErr || settingErr) {
    console.error(voterErr || voteErr || settingErr);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }

  res.json({
    votingOpen: setting ? setting.value === '1' : true,
    totalVoters: totalVoters || 0,
    totalVotes: totalVotes || 0
  });
});

app.post('/api/admin/voting-status', requireDb, requireAdmin, async (req, res) => {
  const { open } = req.body || {};
  const { error } = await req.db
    .from('settings')
    .upsert({ key: 'voting_open', value: open ? '1' : '0' }, { onConflict: 'key' });

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
  res.json({ votingOpen: !!open });
});

app.post('/api/admin/candidates', requireDb, requireAdmin, async (req, res) => {
  const {
    nomor_urut,
    nama_ketua,
    nama_wakil,
    kelas,
    visi,
    misi,
    foto_url,
    warna
  } = req.body || {};

  if (!nomor_urut || !nama_ketua || !nama_wakil) {
    return res
      .status(400)
      .json({ error: 'Nomor urut, nama ketua, dan nama wakil wajib diisi.' });
  }

  const { data, error } = await req.db
    .from('candidates')
    .insert({
      nomor_urut,
      nama_ketua,
      nama_wakil,
      kelas: kelas || null,
      visi: visi || null,
      misi: misi || null,
      foto_url: foto_url || null,
      warna: warna || '#2563eb'
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Nomor urut sudah digunakan.' });
    }
    console.error(error);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
  res.status(201).json({ id: data.id });
});

app.put('/api/admin/candidates/:id', requireDb, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { data: existing, error: findErr } = await req.db
    .from('candidates')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (findErr) {
    console.error(findErr);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
  if (!existing) return res.status(404).json({ error: 'Kandidat tidak ditemukan.' });

  const merged = { ...existing, ...req.body };
  const { error: updateErr } = await req.db
    .from('candidates')
    .update({
      nomor_urut: merged.nomor_urut,
      nama_ketua: merged.nama_ketua,
      nama_wakil: merged.nama_wakil,
      kelas: merged.kelas,
      visi: merged.visi,
      misi: merged.misi,
      foto_url: merged.foto_url,
      warna: merged.warna
    })
    .eq('id', id);

  if (updateErr) {
    console.error(updateErr);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
  res.json({ success: true });
});

app.delete('/api/admin/candidates/:id', requireDb, requireAdmin, async (req, res) => {
  const { error } = await req.db.from('candidates').delete().eq('id', req.params.id);
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
  res.json({ success: true });
});

// Reset total (hapus semua suara & daftar pemilih) - dipakai sebelum pemilihan resmi dimulai
app.post('/api/admin/reset', requireDb, requireAdmin, async (req, res) => {
  const db = req.db;
  const [{ error: votesErr }, { error: votersErr }] = await Promise.all([
    db.from('votes').delete().gt('id', 0),
    db.from('voters').delete().neq('nisn', '')
  ]);

  if (votesErr || votersErr) {
    console.error(votesErr || votersErr);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
  res.json({ success: true });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server Pemilos berjalan di http://localhost:${PORT}`);
  });
}

module.exports = app;
