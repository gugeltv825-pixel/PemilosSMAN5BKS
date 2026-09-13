// Menambahkan data kandidat contoh ke Supabase. Jalankan dengan: npm run seed
require('dotenv').config();
const { getSupabase } = require('./supabase');

const kandidat = [
  {
    nomor_urut: 1,
    nama_ketua: 'Ahmad Fauzi',
    nama_wakil: 'Siti Nurhaliza',
    kelas: 'XI IPA 1 & XI IPA 2',
    visi: 'Mewujudkan OSIS yang aktif, kreatif, dan mendengarkan aspirasi seluruh siswa.',
    misi: 'Mengadakan program mentoring antar angkatan; Mengoptimalkan media sosial OSIS untuk transparansi kegiatan; Menghidupkan kembali ekstrakurikuler yang vakum.',
    warna: '#2563eb'
  },
  {
    nomor_urut: 2,
    nama_ketua: 'Budi Santoso',
    nama_wakil: 'Dewi Lestari',
    kelas: 'XI IPS 1 & XI IPA 3',
    visi: 'OSIS sebagai wadah pemersatu siswa lintas jurusan yang solid dan inovatif.',
    misi: 'Membentuk forum diskusi bulanan antar kelas; Mengadakan bazar kreativitas siswa setiap semester; Meningkatkan fasilitas kegiatan ekstrakurikuler.',
    warna: '#16a34a'
  },
  {
    nomor_urut: 3,
    nama_ketua: 'Citra Ayu',
    nama_wakil: 'Rian Hidayat',
    kelas: 'XI IPA 4 & XI IPS 2',
    visi: 'Membangun budaya sekolah yang peduli lingkungan dan berprestasi.',
    misi: 'Program sekolah ramah lingkungan (Jumat bersih & minim sampah plastik); Pelatihan kepemimpinan rutin untuk pengurus kelas; Apresiasi prestasi siswa setiap bulan.',
    warna: '#d97706'
  }
];

async function main() {
  const db = getSupabase();
  if (!db) {
    console.error('SUPABASE_URL / SUPABASE_KEY belum diset di .env');
    process.exit(1);
  }

  const { error } = await db.from('candidates').upsert(kandidat, { onConflict: 'nomor_urut' });
  if (error) {
    console.error('Gagal seed data:', error.message);
    process.exit(1);
  }

  console.log(`Berhasil menambahkan/memperbarui ${kandidat.length} kandidat contoh.`);
}

main();
