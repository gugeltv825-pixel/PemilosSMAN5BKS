const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'pemilos.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nomor_urut INTEGER NOT NULL UNIQUE,
    nama_ketua TEXT NOT NULL,
    nama_wakil TEXT NOT NULL,
    kelas TEXT,
    visi TEXT,
    misi TEXT,
    foto_url TEXT,
    warna TEXT DEFAULT '#2563eb',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Tabel pemilih hanya menyimpan bukti "sudah memilih" (NISN + waktu),
  -- TIDAK menyimpan kandidat pilihannya, supaya suara tetap rahasia.
  CREATE TABLE IF NOT EXISTS voters (
    nisn TEXT PRIMARY KEY,
    nama TEXT,
    kelas TEXT,
    voted_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, String(value));
}

// Default: voting dibuka
if (getSetting('voting_open') === null) {
  setSetting('voting_open', '1');
}

module.exports = { db, getSetting, setSetting };
