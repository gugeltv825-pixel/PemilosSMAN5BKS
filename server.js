require('dotenv').config();
const path = require('path');
const express = require('express');
const { db, getSetting, setSetting } = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'ubah-token-ini';
const ELECTION_TITLE =
  process.env.ELECTION_TITLE || 'Pemilihan Ketua & Wakil Ketua OSIS SMAN 5 BKS';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
app.get('/api/status', (req, res) => {
  const totalVoters = db.prepare('SELECT COUNT(*) AS n FROM voters').get().n;
  res.json({
    title: ELECTION_TITLE,
    votingOpen: getSetting('voting_open') === '1',
    totalVoters
  });
});

// ---------- API publik: daftar kandidat (untuk halaman voting) ----------
app.get('/api/candidates', (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, nomor_urut, nama_ketua, nama_wakil, kelas, visi, misi, foto_url, warna
       FROM candidates ORDER BY nomor_urut ASC`
    )
    .all();
  res.json(rows);
});

// ---------- API publik: kirim suara ----------
app.post('/api/vote', (req, res) => {
  const votingOpen = getSetting('voting_open') === '1';
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

  const candidate = db
    .prepare('SELECT id FROM candidates WHERE id = ?')
    .get(candidateId);
  if (!candidate) {
    return res.status(400).json({ error: 'Kandidat tidak ditemukan.' });
  }

  const alreadyVoted = db
    .prepare('SELECT nisn FROM voters WHERE nisn = ?')
    .get(nisnClean);
  if (alreadyVoted) {
    return res
      .status(409)
      .json({ error: 'NISN ini sudah digunakan untuk memilih.' });
  }

  const castVote = db.transaction(() => {
    db.prepare(
      'INSERT INTO voters (nisn, nama, kelas) VALUES (?, ?, ?)'
    ).run(nisnClean, String(nama).trim(), kelas ? String(kelas).trim() : null);
    db.prepare('INSERT INTO votes (candidate_id) VALUES (?)').run(candidate.id);
  });

  try {
    castVote();
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res
        .status(409)
        .json({ error: 'NISN ini sudah digunakan untuk memilih.' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }

  res.status(201).json({ success: true });
});

// ---------- API publik: hasil (halaman hasil terpisah dari halaman voting) ----------
app.get('/api/results', (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id, c.nomor_urut, c.nama_ketua, c.nama_wakil, c.warna,
              COUNT(v.id) AS suara
       FROM candidates c
       LEFT JOIN votes v ON v.candidate_id = c.id
       GROUP BY c.id
       ORDER BY c.nomor_urut ASC`
    )
    .all();

  const totalSuara = rows.reduce((sum, r) => sum + r.suara, 0);
  const totalVoters = db.prepare('SELECT COUNT(*) AS n FROM voters').get().n;

  res.json({
    title: ELECTION_TITLE,
    votingOpen: getSetting('voting_open') === '1',
    totalSuara,
    totalVoters,
    kandidat: rows
  });
});

// ---------- API admin ----------
app.get('/api/admin/check', requireAdmin, (req, res) => {
  res.json({ ok: true });
});

app.get('/api/admin/summary', requireAdmin, (req, res) => {
  const totalVoters = db.prepare('SELECT COUNT(*) AS n FROM voters').get().n;
  const totalVotes = db.prepare('SELECT COUNT(*) AS n FROM votes').get().n;
  res.json({
    votingOpen: getSetting('voting_open') === '1',
    totalVoters,
    totalVotes
  });
});

app.post('/api/admin/voting-status', requireAdmin, (req, res) => {
  const { open } = req.body || {};
  setSetting('voting_open', open ? '1' : '0');
  res.json({ votingOpen: open ? true : false });
});

app.post('/api/admin/candidates', requireAdmin, (req, res) => {
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

  try {
    const info = db
      .prepare(
        `INSERT INTO candidates (nomor_urut, nama_ketua, nama_wakil, kelas, visi, misi, foto_url, warna)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        nomor_urut,
        nama_ketua,
        nama_wakil,
        kelas || null,
        visi || null,
        misi || null,
        foto_url || null,
        warna || '#2563eb'
      );
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Nomor urut sudah digunakan.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

app.put('/api/admin/candidates/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Kandidat tidak ditemukan.' });

  const merged = { ...existing, ...req.body };
  db.prepare(
    `UPDATE candidates SET nomor_urut = ?, nama_ketua = ?, nama_wakil = ?, kelas = ?,
     visi = ?, misi = ?, foto_url = ?, warna = ? WHERE id = ?`
  ).run(
    merged.nomor_urut,
    merged.nama_ketua,
    merged.nama_wakil,
    merged.kelas,
    merged.visi,
    merged.misi,
    merged.foto_url,
    merged.warna,
    id
  );
  res.json({ success: true });
});

app.delete('/api/admin/candidates/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM candidates WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Reset total (hapus semua suara & daftar pemilih) - dipakai sebelum pemilihan resmi dimulai
app.post('/api/admin/reset', requireAdmin, (req, res) => {
  const doReset = db.transaction(() => {
    db.prepare('DELETE FROM votes').run();
    db.prepare('DELETE FROM voters').run();
  });
  doReset();
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server Pemilos berjalan di http://localhost:${PORT}`);
});
