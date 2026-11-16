// §18 (Fase 12) — Daftar "Perlu Ditetapkan Kurikulum": butir materi/penilaian juknis yang dahulu "perlu dikonfirmasi"
// (§16.4) kini diserahkan ke role Kurikulum. Nilai sementara = data yang sedang dipakai hitungan (J-KR1); penetapan disimpan
// di master `pengaturan` id `kur:<kode>` (J-KR2). Penetap: EXE Kurikulum, atau HP pengurus jabatan Bidang Kurikulum lewat
// usulan `tetapkan_kurikulum` yang disetujui otomatis di daerah (J-KR3).
import { SURAT_45, SURAT_51, WUDHU_SHOLAT } from './data/juknis-2025'
import type { Db } from './db'
import { GalatPpg } from './galat'
import {
  ambilMateriEvaluasi,
  aturBulanEvaluasi,
  bulanEvaluasi,
  ID_RUMUS_TOTAL,
  LABEL_JENJANG,
  ubahMateriEvaluasi,
  type MateriEvaluasi,
  type RumusTotal,
} from './juknis'
import { AWALAN_KEBIJAKAN, jsonKanonik, samaNilai } from './kebijakan'
import { KATEGORI_GENERUS } from './repo/generus'
import { daftarPerangkat } from './repo/perangkat'
import { daftarProfil, statusProfil } from './repo/profil'
import { adalahAdmin, ambilMeta, ambilRekaman, pastikanPengelolaKurikulum, sisipkanRekaman, ubahRekaman, uraiJson } from './repo/umum'
import { ajukanUsulan, ambilUsulan, daftarUsulan } from './repo/usulan'
import { idMateriEvaluasi } from './skema'
import { uraiToken } from './token'
import { sekarangIso } from './waktu'

export const AWALAN_KURIKULUM = 'kur:'
export const idPenetapan = (kode: string) => `${AWALAN_KURIKULUM}${kode}`

/** Id pengaturan register (kebijakan musyawarah / penetapan kurikulum) — hanya diterima dari daerah (J-KR6). */
export function adalahIdRegister(id: unknown): boolean {
  return typeof id === 'string' && (id.startsWith(AWALAN_KEBIJAKAN) || id.startsWith(AWALAN_KURIKULUM))
}

export type BentukButir = 'bulan' | 'pilihan' | 'angka' | 'teks' | 'konfirmasi'

/** Satu isian butir (bentuk angka/teks): kunci = id materi / nama kitab / nomor dalil. */
export interface IsianButir {
  kunci: string
  label: string
  nilai: number | string | null
}

interface DefButir {
  kode: string
  judul: string
  sumber: string
  bentuk: BentukButir
  opsi?: readonly (readonly [string, string])[]
  /** Isian (bentuk angka/teks/konfirmasi). */
  isian?: (db: Db) => IsianButir[]
  baca: (db: Db) => unknown
  /** Terapkan nilai ke data yang dipakai (tidak ada = nilai hanya disimpan di penetapan). */
  terapkan?: (db: Db, nilai: unknown) => void
  alasan: (db: Db, nilai: unknown) => string | null
  kosong?: (nilai: unknown) => boolean
  ringkas: (db: Db, nilai: unknown) => string
  /** Perubahan isi dilakukan di layar Materi Evaluasi EXE (daftar butir). */
  ubahDiMateri?: boolean
}

// ---------------- pembantu ----------------

const objek = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const angkaSah = (v: unknown) => v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 10000)
const NAMA_BULAN = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function materi(db: Db, jenjang: string, kode: string): MateriEvaluasi | undefined {
  return ambilMateriEvaluasi(db, idMateriEvaluasi(jenjang, kode))
}
function labelMateri(m: MateriEvaluasi): string {
  return `${LABEL_JENJANG[m.jenjang] ?? m.jenjang} — ${m.nama}`
}
/** Materi yang ada (tidak dihapus) untuk daftar (jenjang, kode). */
function daftarAda(db: Db, pasangan: readonly (readonly [string, string])[]): MateriEvaluasi[] {
  return pasangan.map(([j, k]) => materi(db, j, k)).filter((m): m is MateriEvaluasi => !!m)
}
const semuaJenjang = (kode: string) => KATEGORI_GENERUS.map((j) => [j, kode] as const)

/** Butir bentuk "angka per materi" (target). */
function butirTarget(kode: string, judul: string, sumber: string, pasangan: readonly (readonly [string, string])[]): DefButir {
  return {
    kode,
    judul,
    sumber,
    bentuk: 'angka',
    isian: (db) => daftarAda(db, pasangan).map((m) => ({ kunci: m.id, label: `${labelMateri(m)} (${m.satuan ?? 'materi'})`, nilai: m.target })),
    baca: (db) => Object.fromEntries(daftarAda(db, pasangan).map((m) => [m.id, m.target])),
    terapkan: (db, v) => {
      for (const m of daftarAda(db, pasangan)) {
        const t = (v as Record<string, number | null>)[m.id]
        if (t !== undefined && t !== m.target) ubahMateriEvaluasi(db, m.id, { target: t })
      }
    },
    alasan: (_db, v) => (objek(v) && Object.values(v).every(angkaSah) ? null : 'Target harus bilangan bulat 1–10000 (atau kosong).'),
    kosong: (v) => objek(v) && Object.values(v).some((x) => x === null),
    ringkas: (db, v) =>
      daftarAda(db, pasangan)
        .map((m) => `${LABEL_JENJANG[m.jenjang] ?? m.jenjang}: ${(v as Record<string, unknown>)[m.id] ?? 'kosong'}`)
        .join(' · '),
  }
}

/** Butir "konfirmasi daftar butir" (surat/doa): isi diubah di Materi Evaluasi, di sini hanya ditetapkan. */
function butirDaftar(kode: string, judul: string, sumber: string, pasangan: readonly (readonly [string, string])[]): DefButir {
  return {
    kode,
    judul,
    sumber,
    bentuk: 'konfirmasi',
    ubahDiMateri: true,
    isian: (db) => daftarAda(db, pasangan).map((m) => ({ kunci: m.id, label: labelMateri(m), nilai: (m.rincian.butir ?? []).join(', ') || String(m.target ?? '') })),
    baca: (db) => Object.fromEntries(daftarAda(db, pasangan).map((m) => [m.id, { target: m.target, butir: m.rincian.butir ?? [] }])),
    alasan: () => null,
    kosong: (v) => objek(v) && Object.values(v).some((x) => (x as { target: unknown }).target === null),
    ringkas: (db, v) =>
      daftarAda(db, pasangan)
        .map((m) => `${LABEL_JENJANG[m.jenjang] ?? m.jenjang}: ${(v as Record<string, { target: number | null }>)[m.id]?.target ?? 'kosong'} ${m.satuan ?? ''}`.trim())
        .join(' · '),
  }
}

/** Semua kitab hadits (nama unik, urut kemunculan) & halamannya. */
function kitabHadits(db: Db): { nama: string; halaman: number | null }[] {
  const peta = new Map<string, number | null>()
  for (const j of KATEGORI_GENERUS) {
    for (const k of materi(db, j, 'hadits')?.rincian.kitab ?? []) {
      if (!peta.has(k.nama) || (peta.get(k.nama) === null && k.halaman !== null)) peta.set(k.nama, k.halaman)
    }
  }
  return [...peta.entries()].map(([nama, halaman]) => ({ nama, halaman }))
}

function dalilSorong(db: Db): MateriEvaluasi[] {
  return KATEGORI_GENERUS.map((j) => materi(db, j, 'dalil_sorong')).filter((m): m is MateriEvaluasi => !!m && (m.rincian.butir?.length ?? 0) >= 28)
}

const KECIL_WUDHU = ['paud', 'caberawit_a', 'caberawit_b']

function aturCaraWudhu(db: Db, m: MateriEvaluasi, cara: 'hitungan' | 'subjektif'): void {
  if (m.cara === cara) return
  const isi =
    cara === 'hitungan'
      ? { cara, target: WUDHU_SHOLAT.length, satuan: 'butir', rincian_json: JSON.stringify({ butir: WUDHU_SHOLAT }) }
      : { cara, target: 75, satuan: '%', rincian_json: JSON.stringify({}) }
  ubahRekaman(db, 'materi_evaluasi', m.id, isi)
}

function aturAda(db: Db, id: string, ada: boolean): void {
  const r = ambilRekaman<{ dihapus: number }>(db, 'materi_evaluasi', id)
  if (r && Boolean(r.dihapus) === ada) ubahRekaman(db, 'materi_evaluasi', id, { dihapus: ada ? 0 : 1 })
}

// ---------------- katalog ----------------

/** Katalog butir "Perlu Ditetapkan Kurikulum" (§18.2). */
export const BUTIR_KURIKULUM: readonly DefButir[] = [
  {
    kode: 'K01',
    judul: 'Bulan evaluasi semester',
    sumber: 'Juknis menulis periode berbeda-beda (Mei & November 2026 / November–Desember 2025 / November 2024); sementara Mei & November (J-T14).',
    bentuk: 'bulan',
    baca: (db) => bulanEvaluasi(db),
    terapkan: (db, v) => aturBulanEvaluasi(db, v as { S1: number; S2: number }),
    alasan: (_db, v) => {
      if (!objek(v)) return 'Bulan evaluasi tidak sah.'
      const s1 = Number(v.S1)
      const s2 = Number(v.S2)
      if (!Number.isInteger(s1) || s1 < 7 || s1 > 12) return 'Bulan evaluasi semester 1 harus Juli–Desember.'
      return Number.isInteger(s2) && s2 >= 1 && s2 <= 6 ? null : 'Bulan evaluasi semester 2 harus Januari–Juni.'
    },
    ringkas: (_db, v) => `Semester 1: ${NAMA_BULAN[(v as { S1: number }).S1]} · Semester 2: ${NAMA_BULAN[(v as { S2: number }).S2]}`,
  },
  {
    kode: 'K02',
    judul: 'Definisi Caberawit A',
    sumber: 'Juknis menulis "SD kelas 1–3" dan di bagian lain "PAUD s.d. SD kelas 3"; sementara SD kelas 1–3.',
    bentuk: 'pilihan',
    opsi: [
      ['sd_1_3', 'SD kelas 1–3'],
      ['paud_sd_3', 'PAUD s.d. SD kelas 3'],
    ],
    baca: (db) => bacaPenetapan(db, 'K02')?.nilai ?? 'sd_1_3',
    alasan: (_db, v) => (v === 'sd_1_3' || v === 'paud_sd_3' ? null : 'Pilihan tidak dikenal.'),
    ringkas: (_db, v) => (v === 'paud_sd_3' ? 'PAUD s.d. SD kelas 3' : 'SD kelas 1–3'),
  },
  butirTarget('K03', 'Pembagi Keilmuan PAUD', 'Teks juknis "6 materi" tetapi contoh hitungan 3 ÷ 4; sementara 4 (jumlah di Lembar Evaluasi).', [['paud', 'keilmuan']]),
  butirTarget('K04', 'Pembagi Adab / Tatakrama PAUD & Caberawit A', 'Contoh adab anak SD kelas 2 dibagi target PAUD (35); sementara tiap jenjang memakai targetnya sendiri (PAUD 35, Caberawit A 55).', [['paud', 'adab'], ['caberawit_a', 'adab']]),
  butirDaftar('K05', "Do'a Generus Sorong PAUD", "Teks juknis 24 do'a, contoh hitungan ÷ 12, Lembar Evaluasi 12 butir; sementara 12 butir lembar.", [['paud', 'doa_sorong']]),
  butirDaftar('K06', 'Hafalan surat PAUD', 'Teks juknis 6 surat, Lembar Evaluasi memuat 7 surat (nomor 5 kosong); sementara 7 surat lembar.', [['paud', 'surat']]),
  butirDaftar('K07', 'Hafalan surat Caberawit B', 'Teks juknis 24 surat, contoh hitungan ÷ 16; sementara 24 (Lembar Evaluasi).', [['caberawit_b', 'surat']]),
  {
    kode: 'K08',
    judul: 'Nama jurus ASAD per jenjang',
    sumber: 'Lembar vs rekap berbeda: PAUD jurus 1 vs 1 & 2; Caberawit B "1 & 3" vs "1–3"; Caberawit C "1 & 7" vs "1–4"; sementara ikut Lembar Evaluasi.',
    bentuk: 'teks',
    isian: (db) => daftarAda(db, semuaJenjang('asad')).map((m) => ({ kunci: m.id, label: LABEL_JENJANG[m.jenjang] ?? m.jenjang, nilai: m.nama })),
    baca: (db) => Object.fromEntries(daftarAda(db, semuaJenjang('asad')).map((m) => [m.id, m.nama])),
    terapkan: (db, v) => {
      for (const m of daftarAda(db, semuaJenjang('asad'))) {
        const n = (v as Record<string, string>)[m.id]
        if (typeof n === 'string' && n.trim() && n.trim() !== m.nama) ubahMateriEvaluasi(db, m.id, { nama: n.trim() })
      }
    },
    alasan: (_db, v) => (objek(v) && Object.values(v).every((x) => typeof x === 'string' && !!x.trim() && x.length <= 200) ? null : 'Nama jurus wajib diisi (maks. 200 huruf).'),
    ringkas: (db, v) =>
      daftarAda(db, semuaJenjang('asad'))
        .map((m) => `${LABEL_JENJANG[m.jenjang] ?? m.jenjang}: ${String((v as Record<string, string>)[m.id] ?? m.nama).replace(/^ASAD Beladiri /, '')}`)
        .join(' · '),
  },
  {
    kode: 'K09',
    judul: 'Rumus TOTAL penguasaan materi',
    sumber: 'Juknis tidak menetapkan rumus TOTAL; sementara rata-rata semua materi tanpa bobot (J-T11). Materi belum ditetapkan tidak ikut dihitung.',
    bentuk: 'pilihan',
    opsi: [
      ['rata_rata', 'Rata-rata semua materi (termasuk keaktifan)'],
      ['tanpa_keaktifan', 'Rata-rata semua materi tanpa keaktifan'],
    ],
    baca: (db) => bacaPenetapan(db, 'K09')?.nilai ?? 'rata_rata',
    alasan: (_db, v) => (v === 'rata_rata' || v === 'tanpa_keaktifan' ? null : 'Pilihan tidak dikenal.'),
    ringkas: (_db, v) => (v === 'tanpa_keaktifan' ? 'Rata-rata tanpa keaktifan' : 'Rata-rata semua materi'),
  },
  {
    kode: 'K10',
    judul: 'Hafalan surat Generus 2 & 3',
    sumber: 'Lembar Evaluasi memuat 51 surat, teks juknis 45 surat; sementara 51 (lembar).',
    bentuk: 'pilihan',
    opsi: [
      ['51', '51 surat (Lembar Evaluasi)'],
      ['45', '45 surat (teks juknis)'],
    ],
    baca: (db) => {
      const n = materi(db, 'remaja', 'surat')?.rincian.butir?.length ?? 0
      return n === 51 || n === 45 ? String(n) : `${n}`
    },
    terapkan: (db, v) => {
      const butir = v === '45' ? SURAT_45 : SURAT_51
      for (const m of daftarAda(db, [['remaja', 'surat'], ['pranikah', 'surat']])) ubahMateriEvaluasi(db, m.id, { rincian: { ...m.rincian, butir: [...butir] }, target: butir.length })
    },
    alasan: (_db, v) => (v === '51' || v === '45' ? null : 'Pilih 51 atau 45 surat.'),
    ringkas: (_db, v) => `${v} surat`,
  },
  butirTarget(
    'K11',
    'Target GBMTPG Generus 2 & 3',
    'Juknis tidak menulis jumlah target GBMTPG (dalil, keilmuan, kefahaman, praktik ibadah, akhlak, adab, kemandirian) untuk Remaja & Pra Nikah — kosong sampai ditetapkan; materi kosong tidak ikut TOTAL.',
    ['remaja', 'pranikah'].flatMap((j) => ['dalil_gbmtpg', 'keilmuan', 'kefahaman', 'praktik_ibadah', 'akhlak', 'adab', 'kemandirian'].map((k) => [j, k] as const)),
  ),
  {
    kode: 'K12',
    judul: 'Halaman terakhir kitab hadits',
    sumber: 'Juknis hanya menulis K. Sholah (151), K. Nawafil (98), Materi Pegon (19), Materi Bacaan (37); kitab lain kosong — materi hadits tidak ikut TOTAL sampai semua halaman ditetapkan.',
    bentuk: 'angka',
    isian: (db) => kitabHadits(db).map((k) => ({ kunci: k.nama, label: k.nama, nilai: k.halaman })),
    baca: (db) => Object.fromEntries(kitabHadits(db).map((k) => [k.nama, k.halaman])),
    terapkan: (db, v) => {
      const peta = v as Record<string, number | null>
      for (const j of KATEGORI_GENERUS) {
        const m = materi(db, j, 'hadits')
        if (!m?.rincian.kitab) continue
        const kitab = m.rincian.kitab.map((k) => (k.nama in peta ? { ...k, halaman: peta[k.nama] ?? null } : k))
        if (jsonKanonik(kitab) !== jsonKanonik(m.rincian.kitab)) ubahMateriEvaluasi(db, m.id, { rincian: { ...m.rincian, kitab } })
      }
    },
    alasan: (_db, v) => (objek(v) && Object.values(v).every(angkaSah) ? null : 'Halaman harus bilangan bulat ≥ 1 (atau kosong).'),
    kosong: (v) => objek(v) && Object.values(v).some((x) => x === null),
    ringkas: (_db, v) => {
      const l = Object.entries(v as Record<string, number | null>)
      const isi = l.filter(([, h]) => h !== null).length
      return `${isi} dari ${l.length} kitab sudah ada halamannya`
    },
  },
  {
    kode: 'K13',
    judul: 'Dalil Generus Sorong nomor 26 & 28',
    sumber: 'Nomor 26 dan 28 tertulis sama ("yang kuat membantu yang lemah"); sementara dicatat apa adanya.',
    bentuk: 'teks',
    isian: (db) => {
      const b = dalilSorong(db)[0]?.rincian.butir ?? []
      return [
        { kunci: '26', label: 'Dalil nomor 26', nilai: b[25] ?? null },
        { kunci: '28', label: 'Dalil nomor 28', nilai: b[27] ?? null },
      ]
    },
    baca: (db) => {
      const b = dalilSorong(db)[0]?.rincian.butir ?? []
      return { '26': b[25] ?? null, '28': b[27] ?? null }
    },
    terapkan: (db, v) => {
      const x = v as { '26': string; '28': string }
      for (const m of dalilSorong(db)) {
        const butir = [...(m.rincian.butir ?? [])]
        butir[25] = x['26'].trim()
        butir[27] = x['28'].trim()
        if (jsonKanonik(butir) !== jsonKanonik(m.rincian.butir)) ubahMateriEvaluasi(db, m.id, { rincian: { ...m.rincian, butir } })
      }
    },
    alasan: (_db, v) =>
      objek(v) && ['26', '28'].every((k) => typeof v[k] === 'string' && !!(v[k] as string).trim() && (v[k] as string).length <= 200) ? null : 'Nama dalil wajib diisi (maks. 200 huruf).',
    ringkas: (_db, v) => `26: ${(v as Record<string, string>)['26'] ?? '—'} · 28: ${(v as Record<string, string>)['28'] ?? '—'}`,
  },
  {
    kode: 'K14',
    judul: 'Butir evaluasi Caberawit C',
    sumber: 'Lembar Evaluasi tanpa "Hafalan Do\'a sesuai GBMTPG", Rekap tanpa "Nasehat Bernomor BPI"; sementara keduanya dipakai (22 butir).',
    bentuk: 'pilihan',
    opsi: [
      ['22', '22 butir (gabungan lembar & rekap)'],
      ['tanpa_doa', "21 butir — tanpa Hafalan Do'a sesuai GBMTPG (ikut Lembar)"],
      ['tanpa_bpi', '21 butir — tanpa Nasehat Bernomor BPI (ikut Rekap)'],
    ],
    baca: (db) => {
      const doa = !!materi(db, 'caberawit_c', 'doa_gbmtpg')
      const bpi = !!materi(db, 'caberawit_c', 'nasehat_bpi')
      return doa && bpi ? '22' : !doa && bpi ? 'tanpa_doa' : doa && !bpi ? 'tanpa_bpi' : 'lain'
    },
    terapkan: (db, v) => {
      aturAda(db, idMateriEvaluasi('caberawit_c', 'doa_gbmtpg'), v !== 'tanpa_doa')
      aturAda(db, idMateriEvaluasi('caberawit_c', 'nasehat_bpi'), v !== 'tanpa_bpi')
    },
    alasan: (_db, v) => (v === '22' || v === 'tanpa_doa' || v === 'tanpa_bpi' ? null : 'Pilihan tidak dikenal.'),
    ringkas: (_db, v) => (v === 'tanpa_doa' ? "21 butir (tanpa Do'a GBMTPG)" : v === 'tanpa_bpi' ? '21 butir (tanpa Nasehat BPI)' : v === '22' ? '22 butir' : 'Susunan lain'),
  },
  {
    kode: 'K15',
    judul: "Cara nilai praktik wudhu' & sholat",
    sumber: 'Sesuai teks juknis: PAUD–Caberawit B per butir (8 butir), Caberawit C–Generus 3 nilai penguji (maks. 75).',
    bentuk: 'pilihan',
    opsi: [
      ['teks', 'Sesuai teks: PAUD–Caberawit B per butir, Caberawit C–Generus 3 nilai penguji'],
      ['butir', 'Semua jenjang per butir (8 butir)'],
      ['subjektif', 'Semua jenjang nilai penguji (maks. 75)'],
    ],
    baca: (db) => {
      const ms = daftarAda(db, semuaJenjang('wudhu_sholat'))
      if (ms.every((m) => m.cara === 'hitungan')) return 'butir'
      if (ms.every((m) => m.cara === 'subjektif')) return 'subjektif'
      return ms.every((m) => (KECIL_WUDHU.includes(m.jenjang) ? m.cara === 'hitungan' : m.cara === 'subjektif')) ? 'teks' : 'campuran'
    },
    terapkan: (db, v) => {
      for (const m of daftarAda(db, semuaJenjang('wudhu_sholat'))) {
        aturCaraWudhu(db, m, v === 'butir' || (v === 'teks' && KECIL_WUDHU.includes(m.jenjang)) ? 'hitungan' : 'subjektif')
      }
    },
    alasan: (_db, v) => (v === 'teks' || v === 'butir' || v === 'subjektif' ? null : 'Pilihan tidak dikenal.'),
    ringkas: (_db, v) => (v === 'butir' ? 'Semua per butir' : v === 'subjektif' ? 'Semua nilai penguji' : v === 'teks' ? 'Sesuai teks juknis' : 'Campuran (disunting manual)'),
  },
]

export function defButirKurikulum(kode: string): DefButir | undefined {
  return BUTIR_KURIKULUM.find((b) => b.kode === kode)
}

// =====================================================================================================================
// Penetapan
// =====================================================================================================================

export interface EntriRiwayatPenetapan {
  nilai: unknown
  sebelumnya: unknown
  oleh: string
  pada: string
  catatan: string | null
}

export interface IsiPenetapan {
  kode: string
  nilai: unknown
  oleh: string
  pada: string
  catatan: string | null
  riwayat: EntriRiwayatPenetapan[]
}

export type StatusButir = 'belum' | 'sementara' | 'ditetapkan'
export const LABEL_STATUS_BUTIR: Record<StatusButir, string> = {
  belum: 'Belum ditetapkan',
  sementara: 'Sementara',
  ditetapkan: 'Ditetapkan Kurikulum',
}

export function bacaPenetapan(db: Db, kode: string): IsiPenetapan | null {
  const r = ambilRekaman<{ isi: string | null; dihapus: number }>(db, 'pengaturan', idPenetapan(kode))
  if (!r || r.dihapus) return null
  const isi = uraiJson<IsiPenetapan | null>(r.isi, null)
  return isi && isi.kode === kode ? isi : null
}

export interface BarisButirKurikulum {
  kode: string
  judul: string
  sumber: string
  bentuk: BentukButir
  opsi: readonly (readonly [string, string])[]
  isian: IsianButir[]
  nilai: unknown
  ringkas: string
  status: StatusButir
  /** Nilai berubah sesudah ditetapkan (mis. disunting di Materi Evaluasi). */
  berubah: boolean
  ubahDiMateri: boolean
  penetapan: IsiPenetapan | null
  /** HP: usulan penetapan yang masih menunggu diterapkan daerah. */
  diajukan: boolean
}

/** Daftar "Perlu Ditetapkan Kurikulum" dengan nilai sementara & status. */
export function daftarButirKurikulum(db: Db): BarisButirKurikulum[] {
  const menunggu = new Set(
    daftarUsulan(db, { status: 'menunggu' })
      .filter((u) => u.jenis === 'tetapkan_kurikulum')
      .map((u) => String(u.data.kode)),
  )
  return BUTIR_KURIKULUM.map((d) => {
    const nilai = d.baca(db)
    const pen = bacaPenetapan(db, d.kode)
    const kosong = d.kosong?.(nilai) ?? false
    const sama = !!pen && samaNilai(pen.nilai, nilai)
    return {
      kode: d.kode,
      judul: d.judul,
      sumber: d.sumber,
      bentuk: d.bentuk,
      opsi: d.opsi ?? [],
      isian: d.isian?.(db) ?? [],
      nilai,
      ringkas: d.ringkas(db, nilai),
      status: kosong ? 'belum' : sama ? 'ditetapkan' : 'sementara',
      berubah: !!pen && !kosong && !sama,
      ubahDiMateri: !!d.ubahDiMateri,
      penetapan: pen,
      diajukan: menunggu.has(d.kode),
    }
  })
}

/** Jumlah butir yang belum Ditetapkan Kurikulum. */
export function jumlahButirBelumDitetapkan(db: Db): number {
  return daftarButirKurikulum(db).filter((b) => b.status !== 'ditetapkan').length
}

export interface HasilPenetapan {
  /** ditetapkan = tersimpan & ditetapkan; tersimpan = nilai diterapkan tetapi masih ada isian kosong; diajukan = HP → daerah. */
  status: 'ditetapkan' | 'tersimpan' | 'diajukan'
}

function terapkanPenetapan(db: Db, d: DefButir, nilai: unknown, oleh: string, catatan: string | null): HasilPenetapan {
  return db.transaksi(() => {
    const sebelumnya = d.baca(db)
    if (nilai !== undefined) {
      const a = d.alasan(db, nilai)
      if (a) throw new GalatPpg('NILAI_TIDAK_SAH', a)
      if (d.terapkan) d.terapkan(db, nilai)
    }
    // nilai yang hanya tersimpan di penetapan (mis. K02, K09) = nilai masukan; selain itu dibaca ulang dari data
    const akhir = !d.terapkan && nilai !== undefined ? nilai : d.baca(db)
    if (d.kosong?.(akhir)) return { status: 'tersimpan' as const }
    const lama = bacaPenetapan(db, d.kode)
    const pada = sekarangIso()
    const isi: IsiPenetapan = {
      kode: d.kode,
      nilai: akhir,
      oleh,
      pada,
      catatan,
      riwayat: [...(lama?.riwayat ?? []), { nilai: akhir, sebelumnya, oleh, pada, catatan }].slice(-50),
    }
    const id = idPenetapan(d.kode)
    if (ambilRekaman(db, 'pengaturan', id)) ubahRekaman(db, 'pengaturan', id, { isi: JSON.stringify(isi), dihapus: 0 })
    else sisipkanRekaman(db, 'pengaturan', { isi: JSON.stringify(isi) }, { id })
    return { status: 'ditetapkan' as const }
  })
}

/**
 * Tetapkan / ubah lalu tetapkan satu butir (J-KR3). EXE Kurikulum: langsung. HP pengurus jabatan Bidang Kurikulum:
 * usulan `tetapkan_kurikulum` (ikut Setor ke Daerah, diterapkan daerah). EXE Daerah dan perangkat lain ditolak.
 * `nilai` tidak diisi = tetapkan nilai yang sedang dipakai.
 */
export function tetapkanButirKurikulum(db: Db, kode: string, o: { nilai?: unknown; catatan?: string | null } = {}): HasilPenetapan {
  const d = defButirKurikulum(kode)
  if (!d) throw new GalatPpg('BUTIR_TIDAK_DIKENAL', 'Butir kurikulum tidak dikenal.')
  const catatan = o.catatan?.trim() ? o.catatan.trim().slice(0, 1000) : null
  if (o.nilai !== undefined) {
    const a = d.alasan(db, o.nilai)
    if (a) throw new GalatPpg('NILAI_TIDAK_SAH', a)
  }
  if (ambilMeta(db, 'peran_db') === 'exe' && ambilMeta(db, 'peran_instalasi') === 'kurikulum') {
    const p = daftarProfil(db, 'kurikulum')[0]
    if (!p || !statusProfil(p).bolehMencatat) throw new GalatPpg('TIDAK_BERWENANG', 'EXE Kurikulum belum aktif atau tokennya tidak berlaku.')
    pastikanPengelolaKurikulum(db)
    return terapkanPenetapan(db, d, o.nilai, p.nama, catatan)
  }
  if (!adalahAdmin(db) && ambilMeta(db, 'peran_db') !== 'exe') {
    const p = daftarProfil(db, 'pengurus').find((x) => statusProfil(x).bolehMencatat && jabatanDari(x.token).includes('kurikulum'))
    if (p) {
      ajukanUsulan(db, { jenis: 'tetapkan_kurikulum', kelompokId: p.wilayah_id, data: { kode, ...(o.nilai !== undefined ? { nilai: o.nilai } : {}), catatan, oleh: p.nama } })
      return { status: 'diajukan' }
    }
  }
  throw new GalatPpg('HANYA_KURIKULUM', 'Penetapan kurikulum dilakukan Bidang Kurikulum (EXE Kurikulum atau HP jabatan Bidang Kurikulum).')
}

function jabatanDari(token: string): string[] {
  try {
    return uraiToken(token).payload.jabatan ?? []
  } catch {
    return []
  }
}

/** Nama pemegang token jabatan Bidang Kurikulum (pengurus, tidak dicabut) di perangkat itu, atau null. */
function penulisKurikulum(db: Db, perangkatId: string): string | null {
  for (const t of daftarPerangkat(db, { perangkatId })) {
    if (t.role !== 'pengurus' || t.dicabut_pada) continue
    if (jabatanDari(t.token).includes('kurikulum')) return t.nama
  }
  return null
}

/**
 * Daerah: terapkan usulan `tetapkan_kurikulum` dari HP jabatan Bidang Kurikulum (dipanggil otomatis saat impor SETOR dan
 * dari `setujuiUsulan`). Penulis usulan wajib memegang token jabatan kurikulum yang tidak dicabut.
 */
export function setujuiPenetapanKurikulum(db: Db, usulanId: string): HasilPenetapan {
  if (!adalahAdmin(db)) throw new GalatPpg('HANYA_ADMIN', 'Usulan penetapan kurikulum diterapkan di EXE Daerah.')
  const u = ambilUsulan(db, usulanId)
  if (!u || u.jenis !== 'tetapkan_kurikulum') throw new GalatPpg('TIDAK_DITEMUKAN', 'Usulan penetapan kurikulum tidak ditemukan.')
  if (u.status !== 'menunggu') throw new GalatPpg('SUDAH_DIPUTUSKAN', 'Usulan ini sudah diputuskan.')
  const oleh = penulisKurikulum(db, u.perangkat_id)
  if (!oleh) throw new GalatPpg('TIDAK_BERWENANG', 'Pengusul tidak memegang jabatan Bidang Kurikulum yang berlaku.')
  const d = defButirKurikulum(String(u.data.kode ?? ''))
  if (!d) throw new GalatPpg('BUTIR_TIDAK_DIKENAL', 'Butir kurikulum tidak dikenal.')
  return db.transaksi(() => {
    const h = terapkanPenetapan(db, d, u.data.nilai, oleh, typeof u.data.catatan === 'string' ? u.data.catatan.slice(0, 1000) : null)
    ubahRekaman(db, 'usulan', u.id, { status: 'disetujui', alasan: null })
    return h
  })
}

/** Rumus TOTAL yang berlaku (K09) — diekspor ulang untuk UI. */
export function rumusTotalBerlaku(db: Db): RumusTotal {
  const p = bacaPenetapan(db, 'K09')?.nilai
  return p === 'tanpa_keaktifan' ? 'tanpa_keaktifan' : 'rata_rata'
}
export { ID_RUMUS_TOTAL }
