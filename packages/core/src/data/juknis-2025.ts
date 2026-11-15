// Seed bawaan "Panduan Pembinaan & Evaluasi Hasil Belajar Generus 2025" PPG Daerah Sorong (§16).
// Hanya nama materi + jumlah target dari Lembar Evaluasi Penguasaan Materi; dokumen aslinya tidak disalin ke repo.
// `target: null` = juknis tidak menyebut angkanya → diisi Kurikulum (J-T12).

export type CaraEvaluasi = 'keaktifan' | 'hitungan' | 'juz' | 'kitab' | 'subjektif'

export interface KitabTarget {
  nama: string
  /** Halaman terakhir kitab (pembagi); null = belum diisi Kurikulum (J-T13). */
  halaman: number | null
}

export interface RincianMateriEvaluasi {
  /** Butir bernama (bisa dicentang satu per satu; jumlahnya = target). */
  butir?: string[]
  /** Sub-target (keterangan saja, target tetap angka GBMTPG). */
  sub?: string[]
  /** Juz target (cara `juz`). */
  juz?: number[]
  /** Kitab target (cara `kitab`). */
  kitab?: KitabTarget[]
}

export interface SeedMateriEvaluasi {
  kode: string
  nama: string
  cara: CaraEvaluasi
  target: number | null
  satuan: string
  rincian?: RincianMateriEvaluasi
}

const SURAT_45 = [
  'An Naas', 'Al Falaq', 'Al Ikhlas', 'Al Lahab', 'An Nasr', 'Al Kafirun', 'Al Kautsar', "Al Ma'un", 'Al Quraisy', 'Al Fiil',
  'Al Humazah', 'Al Ashr', 'At Takasur', "Al Qori'ah", 'Al Adiyat', 'Az Zalzalah', 'Al Bayyinah', 'Al Qodr', 'Al Alaq', 'At Tiin',
  'As Syarh', 'Ad Dhuha', 'Al Lail', 'As Syams', 'Al Balad', 'Al Fajr', 'Al Ghosyiah', "Al A'la", 'At Toriq', 'Al Buruj',
  'Al Insyiqoq', 'Al Mutoffifin', 'Al Infitor', 'At Takwir', 'Abasa', 'An Naziat', 'An Naba', 'Ayat Kursi 255',
  'Akhir Al Baqoroh 284–286', 'Al Kahfi 1–10', 'Awal Al Mukminun 1–11', 'Akhir Al Mukminun 115–118', 'An Nuur ayat 35',
  'Akhir Al Hasyr', 'Akhir As Soof',
]
const SURAT_51 = [...SURAT_45, 'Al Mulk', 'Yasin', 'Ad Dukhon', 'As Sajdah', 'Ar Rohman', "Al Waqi'ah"]
const SURAT_PAUD = ['Al Fatihah', 'An Naas', 'Al Falaq', 'Al Ikhlas', 'Al Lahab', 'An Nasr', 'Al Kafirun']

const DOA_SORONG_PAUD = [
  'D. Kebaikan Dunia Akhirot', 'D. Untuk kedua Orang Tua', 'D. Makan & sesudah makan', 'D. Tidur & bangun tidur',
  'D. Masuk & keluar rumah', 'D. Masuk & keluar WC', 'D. Berpakaian', 'D. Berbuka puasa', 'D. Masuk & keluar masjid',
  'D. Sesudah azan', "D. Wudhu' & sesudah wudhu'", "Asma'ul Husna 1–20",
]
const DOA_SORONG_A = [
  'D. Kebaikan Dunia Akhirot', 'D. Untuk kedua Orang Tua', 'D. Makan & sesudah makan', 'D. Mencari ilmu', 'D. Tidur & bangun tidur',
  'D. Ketika mendengar petir', 'D. Masuk & keluar rumah', 'D. Masuk & keluar WC', 'D. Berpakaian', 'D. Berbuka puasa',
  'D. Ketetapan iman', 'D. Minta ilham yang baik', 'D. Kesabaran', 'D. Perlindungan dari amal jelek', 'D. Masuk & keluar masjid',
  'D. Sesudah azan', "D. Wudhu' & sesudah wudhu'", 'D. Ketika mendapat musibah', 'D. Melihat orang kena musibah',
  'Pekerjaan Rutin BPI 1–7', 'Pekerjaan Rutin BPI 8–13', "Asma'ul Husna 1–33", "Asma'ul Husna 34–66", "Asma'ul Husna 67–99",
]
const DOA_SORONG_B = [
  'D. Kebaikan Dunia Akhirot', 'D. Untuk kedua Orang Tua', 'D. Makan & sesudah makan', 'D. Mencari ilmu', 'D. Tidur & bangun tidur',
  'D. Ketika mendengar petir', 'D. Masuk & keluar rumah', 'D. Masuk & keluar WC', 'D. Berpakaian', 'D. Berbuka puasa',
  'D. Ketetapan iman', 'D. Masuk pasar', 'D. Minta ilham yang baik', 'D. Kesabaran', 'D. Perlindungan dari amal jelek',
  'D. Masuk & keluar masjid', 'D. Sesudah azan', "D. Wudhu' & sesudah wudhu'", "D. Ismul A'zhom", 'D. Ketika mendapat musibah',
  'D. Melihat orang kena musibah', "Do'a Maskumambang", "Do'a Pengayoman", "Do'a ketika takut pada orang kafir",
  'Pekerjaan Rutin BPI 1–7', 'Pekerjaan Rutin BPI 8–13', 'Raja Istighfar', "Asma'ul Husna 1–33", "Asma'ul Husna 34–66",
  "Asma'ul Husna 67–99",
]
const DOA_SORONG_39 = [
  'D. Kebaikan Dunia Akhirot', 'D. Untuk kedua Orang Tua', 'D. Makan & sesudah makan', 'D. Mencari ilmu', 'D. Tidur & bangun tidur',
  'D. Ketika mendengar petir', 'D. Masuk & keluar rumah', 'D. Masuk & keluar WC', 'D. Berpakaian', 'D. Berbuka puasa',
  'D. Ketetapan iman', 'D. Masuk pasar', 'D. Minta ilham yang baik', 'D. Kesabaran', 'D. Perlindungan dari amal jelek',
  'D. Masuk & keluar masjid', 'D. Sesudah azan', "D. Wudhu' & sesudah wudhu'", "D. Ismul A'zhom", 'Pekerjaan Rutin BPI',
  'D. Ketika mendapat musibah', 'D. Melihat orang kena musibah', 'Raja Istighfar', "Do'a Maskumambang", "Do'a Pengayoman",
  "Do'a ASAD", "Do'a Nabi Adam", "Do'a Nabi Nuh", "Do'a Nabi Ibrohim", "Do'a Nabi Daud", "Do'a Nabi Sulaiman", "Do'a Nabi Yusuf",
  "Do'a Nabi Ayub", "Do'a Nabi Musa", "Do'a Nabi Yunus", "Kumpulan Do'a Nabi Muhammad", 'D. Setelah membaca Al-Qur\'an',
  "D. Sujud Al-Qur'an", "Asma'ul Husna",
]
const DALIL_SORONG = [
  'Dalil Ngaji', 'Dalil Ngamal', 'Dalil Mbela', 'Dalil Sambung', "Dalil Tho'at", 'Dalil Akhlakul Karimah', 'Dalil Alim Faqih',
  'Dalil Mandiri', 'Dalil Rukun', 'Dalil Kompak', 'Dalil Kerjasama Baik', 'Dalil Jujur', 'Dalil Amanah', 'Dalil Mujhid Muzhid',
  'Dalil Syukur', 'Dalil Mempersungguh', 'Dalil Mengagungkan', 'Dalil Berdoa', 'Dalil Benar', 'Dalil Kurup', 'Dalil Janji',
  'Dalil Qodar Nikmat', 'Dalil Qodar Musibah', 'Dalil Qodar Cobaan', 'Dalil Qodar Salah', 'Dalil yang kuat membantu yang lemah',
  'Dalil yang bisa membantu yang tidak bisa', 'Dalil yang kuat membantu yang lemah (2)', 'Dalil yang ingat mengingatkan yang lupa',
  'Dalil Bicara yang baik', 'Dalil Jujur Amanah', 'Dalil Sabar kaporo ngalah', 'Dalil Tidak merusak sesama',
  'Dalil Saling memperhatikan & menjaga perasaan',
]
const WUDHU_SHOLAT = [
  "Do'a Iftitah", "Do'a Ruku', I'tidal, Sujud, Duduk", "Do'a Tasyahud", "Do'a Sholawat", "Do'a setelah Tasyahud",
  'Dzikir setelah sholat', 'Wirit 1 & Wirit 2', 'Praktik wudhu & sholat',
]
const TAJWID = [
  'Idzhar (Nun sukun/tanwin)', 'Idghom (Nun sukun/tanwin)', 'Iqlab (Nun sukun/tanwin)', "Ikhfa' (Nun sukun/tanwin)",
  'Idghom (Mim sukun)', "Ikhfa' (Mim sukun)", 'Idzhar (Mim sukun)', "Al Qomariyah (Al ma'rifat)", "Al Syamsiyah (Al ma'rifat)",
  'Idghom Mutamassilain', 'Idghom Mutaqorribain', 'Idghom Mutajanissain', "Mad Asli / Mad Thobi'i", 'Mad Wajib Muttasil',
  "Mad Ja'iz Munfasil", 'Mad Aridh Lissukun', 'Mad Badal', 'Mad Iwadh', 'Mad Lazim Mutsaqqol Kalimi', 'Mad Lazim Mukhoffaf Kalimi',
  "Mad Lazim Harfi Musyba'", 'Mad Lazim Mukhoffaf Harfi', 'Mad Layyin', 'Mad Shilah', 'Mad Farqy', 'Mad Tamkin',
  "Tafkhim (hukum Ro')", "Tarqiq (hukum Ro')", 'Qolqolah', 'Lam Jalalah',
]
const SUB_AKHLAK = ['Pribadi', 'Keluarga', 'Ulil Amri, Guru, Mubaligh', 'Masyarakat', 'Lingkungan & Alam Sekitar']
const SUB_ADAB_18 = [
  'Pada orang tua', 'Pada saudara', 'Pada guru, mubaligh', 'Pada teman', 'Dalam masjid', 'Dalam pengajian', 'Pada lingkungan',
  'Pada ulil amri', 'Bertamu / ketamuan', 'Ketika berpakaian', 'Ketika tidur', 'Ketika menguap', 'Ketika bersin', 'Pada kerabat',
  'Pada tetangga', 'Dalam bersepeda', 'Dalam makan bersama', 'Dalam mencari ilmu',
]
const SUB_ADAB_21 = [...SUB_ADAB_18, 'Dalam berumah tangga', 'Dalam bermasyarakat', 'Dalam lingkungan kerja']
const SUB_MANDIRI_3 = ['Pribadi', 'Keluarga', 'Lingkungan jamaah']
const SUB_MANDIRI_6 = ['Pribadi', 'Keluarga', 'Lingkungan jamaah', 'Lingkungan umum', 'Generus putra', 'Generus putri']

const KITAB_C: KitabTarget[] = [
  { nama: 'K. Sholah', halaman: 151 }, { nama: "K. Da'wat", halaman: null }, { nama: 'K. Nawafil', halaman: 98 },
  { nama: 'K. Adab', halaman: null }, { nama: 'K. Shoum', halaman: null }, { nama: 'Akhlakul Karimah', halaman: null },
  { nama: 'Akhlakul Karimah (baru)', halaman: null }, { nama: 'Materi Pegon', halaman: 19 }, { nama: 'Materi Bacaan', halaman: 37 },
]
const KITAB_G1: KitabTarget[] = [
  ...KITAB_C,
  ...['K. Thoharoh', 'Materi Lambatan', 'K. Ahkam', 'K. Janaiz', 'K. Jannah wan Nar', 'K. Jihad', 'K. Khotbah', 'Khotbah (baru)',
    'Mukhtarul Dakwat', "Buku Saku Do'a", 'K. Adillah', 'Materi Cepatan'].map((nama) => ({ nama, halaman: null })),
]
const KITAB_G2: KitabTarget[] = [
  ...KITAB_G1,
  ...['K. Nikah', 'K. Tholaq', 'K. Haji', 'K. Zakat', 'Materi Saringan', 'K. Imaroh'].map((nama) => ({ nama, halaman: null })),
]
const KITAB_G3: KitabTarget[] = [
  ...KITAB_G2,
  ...['K. Manasik Haji', "K. Kanzil 'Umal", "K. Faro'id"].map((nama) => ({ nama, halaman: null })),
]

const rentang = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

// ---------- penyusun ----------
const keaktifan = (target: number): SeedMateriEvaluasi => ({ kode: 'keaktifan', nama: 'Keaktifan', cara: 'keaktifan', target, satuan: 'kali/bulan' })
const iqro = (nama: string, halaman: number): SeedMateriEvaluasi => ({ kode: 'iqro', nama, cara: 'hitungan', target: halaman, satuan: 'halaman' })
const daftar = (kode: string, nama: string, butir: string[], satuan: string): SeedMateriEvaluasi => ({ kode, nama, cara: 'hitungan', target: butir.length, satuan, rincian: { butir } })
const gbmtpg = (kode: string, nama: string, target: number | null, sub?: string[]): SeedMateriEvaluasi => ({
  kode, nama, cara: 'hitungan', target, satuan: 'materi', ...(sub ? { rincian: { sub } } : {}),
})
const subjektif = (kode: string, nama: string): SeedMateriEvaluasi => ({ kode, nama, cara: 'subjektif', target: 75, satuan: '%' })
const makna = (juz: number[]): SeedMateriEvaluasi => ({
  kode: 'makna_quran', nama: juz.length === 1 ? `Makna Al-Qur'an Juz ${juz[0]}` : `Makna Al-Qur'an Juz ${juz[0]}–${juz[juz.length - 1]}`,
  cara: 'juz', target: juz.length, satuan: 'juz', rincian: { juz },
})
const hadits = (kitab: KitabTarget[]): SeedMateriEvaluasi => ({ kode: 'hadits', nama: `Makna Al-Hadits (${kitab.length} kitab)`, cara: 'kitab', target: kitab.length, satuan: 'kitab', rincian: { kitab } })
const tajwid = (): SeedMateriEvaluasi => daftar('tajwid', 'Tajwid (Materi Pegon Bacaan)', TAJWID, 'materi')
const bpi = (): SeedMateriEvaluasi => ({ kode: 'nasehat_bpi', nama: 'Nasehat Bernomor BPI', cara: 'hitungan', target: 95, satuan: 'nomor', rincian: { sub: ['55 Perintah', '22 Larangan', '18 Nasehat Muhajir'] } })
const tadarus = (): SeedMateriEvaluasi => ({ kode: 'tadarus', nama: "Tadarus Al-Qur'an", cara: 'hitungan', target: 30, satuan: 'juz' })

const wudhuButir = () => daftar('wudhu_sholat', "Praktik & Bacaan Wudhu' & Sholat Lengkap", WUDHU_SHOLAT, 'butir')

function caberawitAB(o: { iqro: SeedMateriEvaluasi; surat: string[]; doa: number; doaSorong: string[]; keilmuan: number; kefahaman: number; praktik: number; adab: number; mandiri: number; asad: string }): SeedMateriEvaluasi[] {
  return [
    keaktifan(20),
    o.iqro,
    daftar('surat', 'Hafalan Surat (Target Alim)', o.surat, 'surat'),
    gbmtpg('doa_gbmtpg', "Hafalan Do'a sesuai GBMTPG", o.doa),
    daftar('doa_sorong', "Hafalan Do'a Generus Sorong", o.doaSorong, "do'a"),
    gbmtpg('keilmuan', 'Keilmuan sesuai GBMTPG', o.keilmuan),
    gbmtpg('kefahaman', 'Kefahaman Agama sesuai GBMTPG', o.kefahaman),
    gbmtpg('praktik_ibadah', 'Praktik Ibadah sesuai GBMTPG', o.praktik),
    gbmtpg('akhlak', 'Akhlakul Karimah — A. Akhlak', 10, SUB_AKHLAK),
    gbmtpg('adab', 'Akhlakul Karimah — B. Adab / Tatakrama', o.adab, SUB_ADAB_18),
    gbmtpg('kemandirian', 'Kemandirian sesuai GBMTPG', o.mandiri, SUB_MANDIRI_3),
    wudhuButir(),
    subjektif('thoharoh', 'Praktik Thoharoh (BAK & BAB)'),
    subjektif('asad', o.asad),
  ]
}

function generus(o: {
  juz: number[]; kitab: KitabTarget[]; surat: string[]; doaGbmtpg?: number; dalil: number | null; keilmuan: number | null
  kefahaman: number | null; praktik: number | null; akhlak: number | null; adab: number | null; mandiri: number | null
  jenazah: boolean; target: number
}): SeedMateriEvaluasi[] {
  return [
    keaktifan(o.target),
    makna(o.juz),
    hadits(o.kitab),
    daftar('surat', 'Hafalan Surat (Target Alim)', o.surat, 'surat'),
    ...(o.doaGbmtpg !== undefined ? [gbmtpg('doa_gbmtpg', "Hafalan Do'a sesuai GBMTPG", o.doaGbmtpg)] : []),
    daftar('doa_sorong', "Hafalan Do'a Generus Sorong", DOA_SORONG_39, "do'a"),
    gbmtpg('dalil_gbmtpg', 'Hafalan Dalil sesuai GBMTPG', o.dalil),
    daftar('dalil_sorong', 'Hafalan Dalil Generus Sorong', DALIL_SORONG, 'dalil'),
    gbmtpg('keilmuan', 'Keilmuan sesuai GBMTPG', o.keilmuan),
    gbmtpg('kefahaman', 'Kefahaman Agama sesuai GBMTPG', o.kefahaman),
    gbmtpg('praktik_ibadah', 'Praktik Ibadah sesuai GBMTPG', o.praktik),
    gbmtpg('akhlak', 'Akhlakul Karimah — A. Akhlak', o.akhlak, SUB_AKHLAK),
    gbmtpg('adab', 'Akhlakul Karimah — B. Adab / Tatakrama', o.adab, SUB_ADAB_21),
    gbmtpg('kemandirian', 'Kemandirian sesuai GBMTPG', o.mandiri, SUB_MANDIRI_6),
    tajwid(),
    subjektif('kualitas_bacaan', 'Kualitas Bacaan'),
    subjektif('pegon', 'Praktik Pegon'),
    subjektif('wudhu_sholat', "Praktik & Bacaan Wudhu' & Sholat Lengkap"),
    subjektif('thoharoh', 'Praktik Thoharoh (BAK, BAB, mandi junub, mencuci & mensucikan tempat)'),
    ...(o.jenazah ? [subjektif('jenazah', 'Praktik Peramutan Jenazah')] : []),
    bpi(),
    subjektif('asad', 'ASAD Beladiri Jurus 1–7'),
    tadarus(),
  ]
}

/** Daftar materi evaluasi per jenjang (urutan = urutan kolom Rekap Penguasaan Materi). */
export const SEED_JUKNIS_2025: Record<string, SeedMateriEvaluasi[]> = {
  paud: [
    keaktifan(20),
    iqro("Iqro' 1", 35),
    daftar('surat', 'Hafalan Surat (Target Alim)', SURAT_PAUD, 'surat'),
    gbmtpg('doa_gbmtpg', "Hafalan Do'a sesuai GBMTPG", 6),
    daftar('doa_sorong', "Hafalan Do'a Generus Sorong", DOA_SORONG_PAUD, "do'a"),
    gbmtpg('keilmuan', 'Keilmuan sesuai GBMTPG', 4),
    gbmtpg('kefahaman', 'Kefahaman Agama sesuai GBMTPG', 10),
    gbmtpg('praktik_ibadah', 'Praktik Ibadah sesuai GBMTPG', 6),
    gbmtpg('akhlak', 'Akhlakul Karimah — A. Akhlak', 10, SUB_AKHLAK),
    gbmtpg('adab', 'Akhlakul Karimah — B. Adab / Tatakrama', 35, SUB_ADAB_18),
    gbmtpg('kemandirian', 'Kemandirian sesuai GBMTPG', 8, SUB_MANDIRI_3),
    wudhuButir(),
    subjektif('thoharoh', 'Praktik Thoharoh (BAK & BAB)'),
    subjektif('asad', 'ASAD Beladiri Jurus 1'),
  ],
  caberawit_a: caberawitAB({
    iqro: iqro("Iqro' 1–4", 131), surat: SURAT_45.slice(0, 18), doa: 11, doaSorong: DOA_SORONG_A, keilmuan: 7, kefahaman: 15,
    praktik: 9, adab: 55, mandiri: 16, asad: 'ASAD Beladiri Jurus 1–2',
  }),
  caberawit_b: caberawitAB({
    iqro: iqro("Iqro' 1–6", 195), surat: SURAT_45.slice(0, 24), doa: 8, doaSorong: DOA_SORONG_B, keilmuan: 15, kefahaman: 20,
    praktik: 14, adab: 108, mandiri: 19, asad: 'ASAD Beladiri Jurus 1–3',
  }),
  caberawit_c: generus({
    juz: [30], kitab: KITAB_C, surat: SURAT_45, doaGbmtpg: 8, dalil: 9, keilmuan: 15, kefahaman: 29, praktik: 15, akhlak: 12,
    adab: 110, mandiri: 21, jenazah: false, target: 20,
  }),
  praremaja: generus({
    juz: rentang(21, 30), kitab: KITAB_G1, surat: SURAT_45, dalil: 1, keilmuan: 15, kefahaman: 35, praktik: 20, akhlak: 13,
    adab: 110, mandiri: 39, jenazah: false, target: 20,
  }),
  remaja: generus({
    juz: rentang(11, 30), kitab: KITAB_G2, surat: SURAT_51, dalil: null, keilmuan: null, kefahaman: null, praktik: null,
    akhlak: null, adab: null, mandiri: null, jenazah: true, target: 20,
  }),
  pranikah: generus({
    juz: rentang(1, 30), kitab: KITAB_G3, surat: SURAT_51, dalil: null, keilmuan: null, kefahaman: null, praktik: null,
    akhlak: null, adab: null, mandiri: null, jenazah: true, target: 16,
  }),
}
