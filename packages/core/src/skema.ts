// Skema database (DDL) + migrasi. Sama untuk EXE admin dan APK.
import type { Db } from './db'
import { GalatPpg } from './galat'
import { sekarangIso, tanggalHariIni, tanggalSah, umurPada } from './waktu'
import { SEED_JUKNIS_2025 } from './data/juknis-2025'

/** Kolom sinkron wajib pada setiap tabel tersinkron (§6). `seq_lokal` tidak pernah dikirim. */
export const KOLOM_SINKRON = ['perangkat_id', 'dibuat_pada', 'diubah_pada', 'dihapus', 'versi', 'seq_lokal'] as const

const SINKRON_SQL = `
  perangkat_id TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL,
  diubah_pada TEXT NOT NULL,
  dihapus INTEGER NOT NULL DEFAULT 0,
  versi INTEGER NOT NULL DEFAULT 1,
  seq_lokal INTEGER NOT NULL DEFAULT 0`

export type JenisTabel = 'master' | 'kegiatan'

export interface InfoTabel {
  jenis: JenisTabel
  /** Kolom isi (selain id & kolom sinkron). */
  kolom: readonly string[]
  /** Kolom kelompok untuk pemeriksaan wewenang (tabel kegiatan). */
  kolomKelompok?: string
}

/** Daftar tabel tersinkron beserta kolom isinya. Urutan = urutan penerapan. */
export const TABEL_SINKRON = {
  wilayah: { jenis: 'master', kolom: ['tingkat', 'nama', 'kode', 'induk_id'] },
  jamaah: { jenis: 'master', kolom: ['kelompok_id', 'nama', 'jenis_kelamin', 'tanggal_lahir', 'no_hp', 'status'] },
  generus: {
    jenis: 'master',
    // v4 (§16): kategori_saran = 1 bila jenjang hasil saran umur (perlu dicek)
    kolom: ['kelompok_id', 'nama', 'jenis_kelamin', 'tanggal_lahir', 'kategori', 'status', 'wali_nama', 'wali_no_hp', 'kategori_saran'],
  },
  riwayat_keanggotaan: { jenis: 'master', kolom: ['generus_id', 'kelompok_id', 'mulai', 'selesai'] },
  riwayat_status: { jenis: 'master', kolom: ['generus_id', 'status', 'mulai', 'selesai', 'keterangan'] },
  // v3: kategori_generus (csv, NULL = semua) → pengajian rutin = kelas
  pengajian: { jenis: 'master', kolom: ['wilayah_id', 'nama', 'jenis', 'hari', 'jam', 'tempat', 'kategori_generus'] },
  bidang_materi: { jenis: 'master', kolom: ['nama', 'urutan'] },
  kategori_materi: { jenis: 'master', kolom: ['bidang_id', 'kode', 'nama', 'urutan', 'tipe'] },
  materi: {
    jenis: 'master',
    kolom: ['kategori_id', 'nomor', 'nama', 'tipe', 'kategori_generus', 'isi_teks', 'lampiran_pdf_b64', 'lampiran_nama'],
  },
  penugasan_mubaligh: { jenis: 'master', kolom: ['perangkat_mubaligh_id', 'kelompok_id', 'mulai', 'selesai'] },
  koreksi: { jenis: 'master', kolom: ['tabel', 'rekaman_id', 'untuk_perangkat_id', 'catatan', 'tanggal'] },
  // v3 — master milik daerah (target_capaian & pengaturan juga boleh dikelola EXE kurikulum)
  jadwal_setor: { jenis: 'master', kolom: ['tingkat_asal', 'pola', 'hari', 'tanggal_bulan', 'jam'] },
  target_capaian: { jenis: 'master', kolom: ['periode', 'kategori_generus', 'materi_id', 'urutan'] },
  pengaturan: { jenis: 'master', kolom: ['isi'] },
  // v4 (§16) — daftar materi evaluasi semester per jenjang (juknis), milik daerah/kurikulum
  materi_evaluasi: { jenis: 'master', kolom: ['jenjang', 'urutan', 'kode', 'nama', 'cara', 'target', 'satuan', 'rincian_json'] },
  // v3 — pertemuan (kegiatan milik pencatat): materi yang diajarkan pada satu pertemuan kelas
  pertemuan: {
    jenis: 'kegiatan',
    kolom: ['kelompok_id', 'pengajian_id', 'jadwal_tambahan_id', 'tanggal', 'materi_ids_json', 'catatan'],
    kolomKelompok: 'kelompok_id',
  },
  presensi: {
    jenis: 'kegiatan',
    kolom: ['kelompok_id', 'pengajian_id', 'jadwal_tambahan_id', 'tanggal', 'generus_id', 'status', 'pertemuan_id'],
    kolomKelompok: 'kelompok_id',
  },
  kemajuan_belajar: {
    jenis: 'kegiatan',
    kolom: [
      'generus_id', 'kelompok_id', 'materi_id', 'status', 'nilai', 'level', 'tanggal', 'sumber', 'status_sah',
      'disahkan_oleh', 'disahkan_pada', 'catatan_generus', 'catatan_mubaligh',
    ],
    kolomKelompok: 'kelompok_id',
  },
  penilaian_akhlaq: {
    jenis: 'kegiatan',
    kolom: ['generus_id', 'kelompok_id', 'periode', 'aspek', 'nilai'],
    kolomKelompok: 'kelompok_id',
  },
  jadwal_tambahan: {
    jenis: 'kegiatan',
    kolom: ['kelompok_id', 'tanggal', 'jam', 'judul', 'keterangan', 'dibatalkan'],
    kolomKelompok: 'kelompok_id',
  },
  // v4 (§16) — lembar kontrol keaktifan, hasil evaluasi semester, laporan bulanan kelompok
  keaktifan: {
    jenis: 'kegiatan',
    kolom: ['generus_id', 'kelompok_id', 'tanggal', 'kode', 'sumber', 'status_sah', 'disahkan_oleh', 'disahkan_pada', 'keterangan'],
    kolomKelompok: 'kelompok_id',
  },
  evaluasi_semester: {
    jenis: 'kegiatan',
    kolom: ['generus_id', 'kelompok_id', 'periode', 'jenjang', 'materi_evaluasi_id', 'dikuasai', 'nilai', 'rincian_json', 'tanggal', 'penguji'],
    kolomKelompok: 'kelompok_id',
  },
  laporan_bulanan: {
    jenis: 'kegiatan',
    kolom: ['kelompok_id', 'bulan', 'isi_json'],
    kolomKelompok: 'kelompok_id',
  },
  // v5 (§17) — catatan bidang kepengurusan PPG (notulen, kas, inventaris, agenda, konseling, …); isi rahasia terenkripsi
  catatan_bidang: {
    jenis: 'kegiatan',
    kolom: ['wilayah_id', 'bidang', 'jenis', 'tanggal', 'judul', 'isi_json', 'isi_rahasia', 'versi_kunci', 'rujukan_id'],
    kolomKelompok: 'wilayah_id',
  },
  usulan: {
    jenis: 'kegiatan',
    kolom: ['jenis', 'data_json', 'status', 'alasan', 'kelompok_id'],
    kolomKelompok: 'kelompok_id',
  },
} as const satisfies Record<string, InfoTabel>

export type NamaTabelSinkron = keyof typeof TABEL_SINKRON
export const DAFTAR_TABEL_SINKRON = Object.keys(TABEL_SINKRON) as NamaTabelSinkron[]

/** Info tabel tersinkron, atau undefined bila bukan tabel tersinkron. */
export function infoTabel(tabel: string): InfoTabel | undefined {
  return (TABEL_SINKRON as Record<string, InfoTabel>)[tabel]
}

/** Semua kolom (id + isi + sinkron) sebuah tabel tersinkron. */
export function kolomLengkap(tabel: NamaTabelSinkron): string[] {
  return ['id', ...TABEL_SINKRON[tabel].kolom, ...KOLOM_SINKRON]
}

const TIPE_KOLOM: Record<string, string> = {
  hari: 'INTEGER',
  urutan: 'INTEGER',
  nomor: 'INTEGER',
  nilai: 'INTEGER',
  level: 'INTEGER',
  dibatalkan: 'INTEGER NOT NULL DEFAULT 0',
  tanggal_bulan: 'INTEGER',
  target: 'INTEGER',
  dikuasai: 'INTEGER',
  kategori_saran: 'INTEGER',
  versi_kunci: 'INTEGER',
}

/** Bentuk kolom untuk ALTER TABLE (tanpa NOT NULL tanpa default). */
function tipeKolom(k: string): string {
  return TIPE_KOLOM[k] ?? 'TEXT'
}

/**
 * Kolom yang ditambahkan v3 ke tabel lama: diletakkan SETELAH kolom sinkron, agar urutan kolom database baru
 * sama dengan database v2 yang dimigrasikan (ALTER TABLE menambah kolom di akhir).
 */
const KOLOM_AKHIR: Record<string, readonly string[]> = {
  pengajian: ['kategori_generus'],
  presensi: ['pertemuan_id'],
  generus: ['kategori_saran'],
}

function ddlTabelSinkron(nama: string, info: InfoTabel): string {
  const akhir = KOLOM_AKHIR[nama] ?? []
  const kolom = info.kolom.filter((k) => !akhir.includes(k)).map((k) => `  ${k} ${tipeKolom(k)}`).join(',\n')
  const tambahan = akhir.map((k) => `,\n  ${k} ${tipeKolom(k)}`).join('')
  return `CREATE TABLE IF NOT EXISTS ${nama} (\n  id TEXT PRIMARY KEY,\n${kolom},${SINKRON_SQL}${tambahan}\n);`
}

const DDL_LOKAL = `
CREATE TABLE IF NOT EXISTS meta (kunci TEXT PRIMARY KEY, nilai TEXT);
CREATE TABLE IF NOT EXISTS identitas_perangkat (
  id TEXT PRIMARY KEY, sign_pub TEXT NOT NULL, sign_rahasia TEXT NOT NULL,
  box_pub TEXT NOT NULL, box_rahasia TEXT NOT NULL, label TEXT, dibuat_pada TEXT
);
CREATE TABLE IF NOT EXISTS profil (
  id TEXT PRIMARY KEY, token_id TEXT NOT NULL, token TEXT NOT NULL, role TEXT NOT NULL, nama TEXT NOT NULL,
  wilayah_id TEXT NOT NULL, tingkat TEXT NOT NULL, generus_ids_json TEXT NOT NULL DEFAULT '[]',
  pin_hash TEXT, pin_garam TEXT, rahasia_json TEXT NOT NULL DEFAULT '{}',
  dibekukan INTEGER NOT NULL DEFAULT 0, dicabut_pada TEXT, aktif INTEGER NOT NULL DEFAULT 0,
  berlaku_sampai TEXT NOT NULL, dibuat_pada TEXT NOT NULL
);
-- Satu baris per TOKEN (bukan per HP): satu HP bisa memegang beberapa token (multi-profil).
CREATE TABLE IF NOT EXISTS perangkat (
  id TEXT PRIMARY KEY, perangkat_id TEXT NOT NULL, label TEXT, role TEXT NOT NULL, tingkat TEXT NOT NULL,
  wilayah_id TEXT NOT NULL, nama TEXT NOT NULL, token_id TEXT NOT NULL, token TEXT NOT NULL,
  sign_pub TEXT NOT NULL, box_pub TEXT NOT NULL, generus_ids_json TEXT NOT NULL DEFAULT '[]',
  seq_diterima INTEGER NOT NULL DEFAULT 0, dicabut_pada TEXT, dibekukan INTEGER NOT NULL DEFAULT 0,
  diterbitkan_oleh TEXT, berlaku_sampai TEXT, setor_akhir_urut INTEGER, terakhir_setor TEXT,
  dibuat_pada TEXT NOT NULL, terakhir_lapor TEXT
);
CREATE INDEX IF NOT EXISTS idx_perangkat_hp ON perangkat(perangkat_id);
CREATE TABLE IF NOT EXISTS pencabutan (
  id TEXT PRIMARY KEY, token_id TEXT NOT NULL, perangkat_id TEXT NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('cabut','beku','cair')), tanggal TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pencabutan_token ON pencabutan(token_id);
CREATE TABLE IF NOT EXISTS kunci_kelompok (
  kelompok_id TEXT NOT NULL, versi INTEGER NOT NULL, publik TEXT NOT NULL, rahasia_terenkripsi TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL, PRIMARY KEY (kelompok_id, versi)
);
CREATE TABLE IF NOT EXISTS kunci_umum_kelompok (kelompok_id TEXT PRIMARY KEY, kunci_terenkripsi TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS log_bentrok (
  id TEXT PRIMARY KEY, tabel TEXT NOT NULL, rekaman_id TEXT NOT NULL, lama_json TEXT, baru_json TEXT, tanggal TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS riwayat_impor (
  id TEXT PRIMARY KEY, jenis TEXT NOT NULL, nama_berkas TEXT, pengirim TEXT, tanggal TEXT NOT NULL,
  ringkasan_json TEXT, sidik TEXT
);
CREATE INDEX IF NOT EXISTS idx_riwayat_impor_sidik ON riwayat_impor(sidik);
`

const INDEKS = `
CREATE INDEX IF NOT EXISTS idx_wilayah_induk ON wilayah(induk_id);
CREATE INDEX IF NOT EXISTS idx_generus_kelompok ON generus(kelompok_id);
CREATE INDEX IF NOT EXISTS idx_rk_generus ON riwayat_keanggotaan(generus_id);
CREATE INDEX IF NOT EXISTS idx_rs_generus ON riwayat_status(generus_id);
CREATE INDEX IF NOT EXISTS idx_materi_kategori ON materi(kategori_id);
CREATE INDEX IF NOT EXISTS idx_presensi_generus ON presensi(generus_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_presensi_kelompok ON presensi(kelompok_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_kemajuan_generus ON kemajuan_belajar(generus_id);
CREATE INDEX IF NOT EXISTS idx_kemajuan_kelompok ON kemajuan_belajar(kelompok_id);
CREATE INDEX IF NOT EXISTS idx_penilaian_generus ON penilaian_akhlaq(generus_id);
`

const DDL_LOKAL_V3 = `
-- v3: jejak setoran yang diimpor EXE (untuk konfirmasi bertahap "sudah sampai daerah")
CREATE TABLE IF NOT EXISTS jejak_setor (
  perangkat_id TEXT NOT NULL, urut INTEGER NOT NULL, seq_lokal INTEGER NOT NULL, PRIMARY KEY (perangkat_id, urut)
);
-- v3: kunci kelompok setor & kunci umum yang dititipkan daerah ke EXE desa/kelompok (dienkripsi kunci induk EXE)
CREATE TABLE IF NOT EXISTS kunci_titipan (kelompok_id TEXT PRIMARY KEY, isi_terenkripsi TEXT NOT NULL);
`

const DDL_LOKAL_V4 = `
-- v4 (§16, J-T17): catatan sholat 5 waktu di lembar kontrol — lokal HP, tidak tersinkron, tidak masuk nilai
CREATE TABLE IF NOT EXISTS catatan_sholat (generus_id TEXT NOT NULL, tanggal TEXT NOT NULL, sholat TEXT NOT NULL, PRIMARY KEY (generus_id, tanggal));
`

const DDL_LOKAL_V5 = `
-- v5 (§17): kunci bidang rahasia (keuangan/konseling) — daerah, dienkripsi kunci induk
CREATE TABLE IF NOT EXISTS kunci_bidang (
  bidang TEXT NOT NULL, versi INTEGER NOT NULL, publik TEXT NOT NULL, rahasia_terenkripsi TEXT NOT NULL, dibuat_pada TEXT NOT NULL,
  PRIMARY KEY (bidang, versi)
);
`

/** Versi skema saat ini. */
export const VERSI_SKEMA = 5

function adaKolom(db: Db, tabel: string, kolom: string): boolean {
  return db.kueri<{ name: string }>(`PRAGMA table_info(${tabel})`).some((k) => k.name === kolom)
}

/** Daftar migrasi berurutan; indeks 0 = menuju versi 1. */
const MIGRASI: ((db: Db) => void)[] = [
  (db) => {
    const ddl = Object.entries(TABEL_SINKRON)
      .map(([n, i]) => ddlTabelSinkron(n, i))
      .join('\n')
    db.jalankanSkrip(ddl + DDL_LOKAL + INDEKS)
    for (const n of DAFTAR_TABEL_SINKRON) {
      db.jalankanSkrip(`CREATE INDEX IF NOT EXISTS idx_${n}_seq ON ${n}(seq_lokal);`)
    }
  },
  // v2 (Fase 1b): kunci umum kelompok berversi — diganti saat serah terima / ganti kunci kelompok.
  (db) => {
    db.jalankanSkrip('ALTER TABLE kunci_umum_kelompok ADD COLUMN versi INTEGER NOT NULL DEFAULT 1;')
  },
  // v3: pelaporan berjenjang, kurikulum, pertemuan. Database v2 lama (admin) = EXE daerah.
  (db) => {
    for (const [n, i] of Object.entries(TABEL_SINKRON)) {
      db.jalankanSkrip(ddlTabelSinkron(n, i))
      db.jalankanSkrip(`CREATE INDEX IF NOT EXISTS idx_${n}_seq ON ${n}(seq_lokal);`)
      for (const k of i.kolom) if (!adaKolom(db, n, k)) db.jalankanSkrip(`ALTER TABLE ${n} ADD COLUMN ${k} ${tipeKolom(k)};`)
    }
    if (!adaKolom(db, 'perangkat', 'terakhir_lapor')) db.jalankanSkrip('ALTER TABLE perangkat ADD COLUMN terakhir_lapor TEXT;')
    db.jalankanSkrip(DDL_LOKAL_V3)
    db.jalankanSkrip(`
      CREATE INDEX IF NOT EXISTS idx_pertemuan_kelompok ON pertemuan(kelompok_id, tanggal);
      CREATE INDEX IF NOT EXISTS idx_target_periode ON target_capaian(periode, kategori_generus);
      CREATE INDEX IF NOT EXISTS idx_presensi_pertemuan ON presensi(pertemuan_id);`)
    const peran = db.nilai<string>(`SELECT nilai FROM meta WHERE kunci = 'peran_db'`)
    if (peran === 'admin') db.jalankan(`INSERT OR IGNORE INTO meta (kunci, nilai) VALUES ('peran_instalasi', 'daerah')`)
  },
  // v4 (§16): juknis pembinaan — tabel keaktifan/evaluasi/laporan bulanan, materi evaluasi, jenjang caberawit A/B/C
  (db) => {
    tambahTabelDanKolom(db)
    db.jalankanSkrip(DDL_LOKAL_V4)
    db.jalankanSkrip(`
      CREATE INDEX IF NOT EXISTS idx_keaktifan_generus ON keaktifan(generus_id, tanggal);
      CREATE INDEX IF NOT EXISTS idx_keaktifan_kelompok ON keaktifan(kelompok_id, tanggal);
      CREATE INDEX IF NOT EXISTS idx_evaluasi_generus ON evaluasi_semester(generus_id, periode);
      CREATE INDEX IF NOT EXISTS idx_evaluasi_kelompok ON evaluasi_semester(kelompok_id, periode);`)
    // J-T2: hanya database daerah (pemilik master) yang memecah caberawit lama → turun lewat PAKET
    if (db.nilai<string>(`SELECT nilai FROM meta WHERE kunci = 'peran_db'`) === 'admin') {
      pecahCaberawitLama(db)
      seedMateriEvaluasi(db)
    }
  },
  // v5 (§17): kepengurusan PPG per jabatan — catatan bidang & kunci bidang rahasia
  (db) => {
    tambahTabelDanKolom(db)
    db.jalankanSkrip(DDL_LOKAL_V5)
    db.jalankanSkrip(`CREATE INDEX IF NOT EXISTS idx_catatan_bidang ON catatan_bidang(bidang, jenis, wilayah_id);`)
  },
]

/** Id tetap materi evaluasi (§16). */
export const idMateriEvaluasi = (jenjang: string, kode: string) => `EVL-${jenjang}-${kode}`

/**
 * Seed daftar materi evaluasi juknis 2025 (daerah). Idempoten: materi yang sudah ada (mungkin sudah disunting Kurikulum)
 * tidak ditimpa. Kembalikan jumlah yang ditambahkan.
 */
export function seedMateriEvaluasi(db: Db): number {
  const kini = sekarangIso()
  let n = 0
  for (const [jenjang, daftar] of Object.entries(SEED_JUKNIS_2025)) {
    daftar.forEach((m, i) => {
      const id = idMateriEvaluasi(jenjang, m.kode)
      if (db.nilai<string>('SELECT id FROM materi_evaluasi WHERE id = ?', [id])) return
      db.jalankan(
        `INSERT INTO materi_evaluasi (id, jenjang, urutan, kode, nama, cara, target, satuan, rincian_json, perangkat_id, dibuat_pada, diubah_pada, dihapus, versi, seq_lokal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ADMIN', ?, ?, 0, 1, 0)`,
        [id, jenjang, i + 1, m.kode, m.nama, m.cara, m.target, m.satuan, m.rincian ? JSON.stringify(m.rincian) : null, kini, kini],
      )
      n++
    })
  }
  return n
}

function tambahTabelDanKolom(db: Db): void {
  for (const [n, i] of Object.entries(TABEL_SINKRON)) {
    db.jalankanSkrip(ddlTabelSinkron(n, i))
    db.jalankanSkrip(`CREATE INDEX IF NOT EXISTS idx_${n}_seq ON ${n}(seq_lokal);`)
    for (const k of i.kolom) if (!adaKolom(db, n, k)) db.jalankanSkrip(`ALTER TABLE ${n} ADD COLUMN ${k} ${tipeKolom(k)};`)
  }
}

/**
 * J-T2: generus berkategori lama `caberawit` → saran umur (≤ 9 th Caberawit A, selain itu Caberawit B; tanpa tanggal lahir A),
 * ditandai `kategori_saran = 1`, versi naik & diubah_pada baru agar menang di semua perangkat.
 */
export function pecahCaberawitLama(db: Db, acuan: string = tanggalHariIni()): number {
  const kini = sekarangIso()
  const seq = Number(db.nilai<string>(`SELECT nilai FROM meta WHERE kunci = 'seq'`) ?? 0) + 1
  const rows = db.kueri<{ id: string; tanggal_lahir: string | null; diubah_pada: string }>(
    `SELECT id, tanggal_lahir, diubah_pada FROM generus WHERE kategori = 'caberawit'`,
  )
  for (const g of rows) {
    const umur = g.tanggal_lahir && tanggalSah(g.tanggal_lahir) ? umurPada(g.tanggal_lahir, acuan) : null
    const baru = umur !== null && umur > 9 ? 'caberawit_b' : 'caberawit_a'
    const ubah = kini > g.diubah_pada ? kini : new Date(new Date(g.diubah_pada).getTime() + 1).toISOString()
    db.jalankan(
      `UPDATE generus SET kategori = ?, kategori_saran = 1, versi = versi + 1, diubah_pada = ?, seq_lokal = ? WHERE id = ?`,
      [baru, ubah, seq, g.id],
    )
  }
  if (rows.length) db.jalankan(`INSERT OR REPLACE INTO meta (kunci, nilai) VALUES ('seq', ?)`, [String(seq)])
  return rows.length
}

/** Buat/migrasikan skema hingga VERSI_SKEMA. Idempoten. */
export function migrasi(db: Db): void {
  db.jalankanSkrip('CREATE TABLE IF NOT EXISTS meta (kunci TEXT PRIMARY KEY, nilai TEXT);')
  const v = Number(db.nilai<string>(`SELECT nilai FROM meta WHERE kunci = 'versi_skema'`) ?? 0)
  if (v > VERSI_SKEMA) {
    throw new GalatPpg('SKEMA_LEBIH_BARU', `Database dibuat oleh versi aplikasi yang lebih baru (skema ${v}). Perbarui aplikasi.`)
  }
  db.transaksi(() => {
    for (let i = v; i < VERSI_SKEMA; i++) MIGRASI[i]!(db)
    db.jalankan(`INSERT OR REPLACE INTO meta (kunci, nilai) VALUES ('versi_skema', ?)`, [String(VERSI_SKEMA)])
  })
}
