// Skema database (DDL) + migrasi. Sama untuk EXE admin dan APK.
import type { Db } from './db'
import { GalatPpg } from './galat'

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
    kolom: ['kelompok_id', 'nama', 'jenis_kelamin', 'tanggal_lahir', 'kategori', 'status', 'wali_nama', 'wali_no_hp'],
  },
  riwayat_keanggotaan: { jenis: 'master', kolom: ['generus_id', 'kelompok_id', 'mulai', 'selesai'] },
  riwayat_status: { jenis: 'master', kolom: ['generus_id', 'status', 'mulai', 'selesai', 'keterangan'] },
  pengajian: { jenis: 'master', kolom: ['wilayah_id', 'nama', 'jenis', 'hari', 'jam', 'tempat'] },
  bidang_materi: { jenis: 'master', kolom: ['nama', 'urutan'] },
  kategori_materi: { jenis: 'master', kolom: ['bidang_id', 'kode', 'nama', 'urutan', 'tipe'] },
  materi: {
    jenis: 'master',
    kolom: ['kategori_id', 'nomor', 'nama', 'tipe', 'kategori_generus', 'isi_teks', 'lampiran_pdf_b64', 'lampiran_nama'],
  },
  penugasan_mubaligh: { jenis: 'master', kolom: ['perangkat_mubaligh_id', 'kelompok_id', 'mulai', 'selesai'] },
  koreksi: { jenis: 'master', kolom: ['tabel', 'rekaman_id', 'untuk_perangkat_id', 'catatan', 'tanggal'] },
  presensi: {
    jenis: 'kegiatan',
    kolom: ['kelompok_id', 'pengajian_id', 'jadwal_tambahan_id', 'tanggal', 'generus_id', 'status'],
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
}

function ddlTabelSinkron(nama: string, info: InfoTabel): string {
  const kolom = info.kolom.map((k) => `  ${k} ${TIPE_KOLOM[k] ?? 'TEXT'}`).join(',\n')
  return `CREATE TABLE IF NOT EXISTS ${nama} (\n  id TEXT PRIMARY KEY,\n${kolom},${SINKRON_SQL}\n);`
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
  dibuat_pada TEXT NOT NULL
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

/** Versi skema saat ini. */
export const VERSI_SKEMA = 1

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
]

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
