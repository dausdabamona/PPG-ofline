// §17 — Struktur kepengurusan PPG Daerah: jabatan/bidang pengurus dan hak datanya (konstanta murni, tanpa impor modul lain).

export type Jabatan =
  | 'ketua'
  | 'wakil_ketua'
  | 'sekretaris'
  | 'bendahara'
  | 'kurikulum'
  | 'tenaga_pendidik'
  | 'penggalang_dana'
  | 'sarpras'
  | 'muda_mudi'
  | 'olahraga_seni'
  | 'kemandirian'
  | 'keputrian'
  | 'bk'
  | 'tahfidz'
  | 'pj_desa'
  | 'pj_kelompok'

export const LABEL_JABATAN: Record<Jabatan, string> = {
  ketua: 'Ketua (KIDA)',
  wakil_ketua: 'Wakil Ketua',
  sekretaris: 'Sekretaris',
  bendahara: 'Bendahara',
  kurikulum: 'Bidang Kurikulum',
  tenaga_pendidik: 'Bidang Tenaga Pendidik',
  penggalang_dana: 'Bidang Penggalang Dana',
  sarpras: 'Bidang Sarana & Prasarana',
  muda_mudi: 'Bidang Kegiatan Muda/i & Kepramukaan',
  olahraga_seni: 'Bidang Olahraga & Seni',
  kemandirian: 'Bidang Kemandirian',
  keputrian: 'Bidang Keputrian',
  bk: 'Bidang Bimbingan Konseling',
  tahfidz: "Bidang Tahfidz Qur'an",
  pj_desa: 'Penanggung Jawab Program Desa',
  pj_kelompok: 'Penanggung Jawab Program Kelompok',
}

/** §21: jabatan yang hanya ada di daerah (di desa/kelompok sekretariat dipegang PJ Desa/PJ Kelompok). */
export const JABATAN_HANYA_DAERAH: readonly Jabatan[] = ['ketua', 'wakil_ketua', 'sekretaris', 'bendahara', 'kurikulum']

/** §21.1: bidang perwakilan daerah yang juga ada di desa & kelompok. */
export const BIDANG_PERWAKILAN: readonly Jabatan[] = ['tenaga_pendidik', 'penggalang_dana', 'sarpras', 'muda_mudi', 'olahraga_seni', 'kemandirian', 'keputrian', 'bk', 'tahfidz']

/** Jabatan menurut tingkat wilayah penugasan (§21.1: desa/kelompok = PJ + bidang perwakilan). */
export const JABATAN_TINGKAT: Record<'daerah' | 'desa' | 'kelompok', readonly Jabatan[]> = {
  daerah: ['ketua', 'wakil_ketua', 'sekretaris', 'bendahara', 'kurikulum', 'tenaga_pendidik', 'penggalang_dana', 'sarpras', 'muda_mudi', 'olahraga_seni', 'kemandirian', 'keputrian', 'bk', 'tahfidz'],
  desa: ['pj_desa', ...BIDANG_PERWAKILAN],
  kelompok: ['pj_kelompok', ...BIDANG_PERWAKILAN],
}

/** §21.1: satu penugasan jabatan pada satu wilayah (token pengurus membawa daftar penugasan). */
export interface Penugasan {
  jabatan: Jabatan
  wilayah_id: string
}

/** §21.1 (J-BJ1): penugasan token — `penugasan[]` baru, atau `jabatan[]` lama dibaca sebagai penugasan pada wilayah token. */
export function penugasanDari(p: { penugasan?: readonly Penugasan[]; jabatan?: readonly Jabatan[]; wilayah_id: string }): Penugasan[] {
  if (Array.isArray(p.penugasan)) return p.penugasan.map((x) => ({ jabatan: x.jabatan, wilayah_id: x.wilayah_id }))
  if (Array.isArray(p.jabatan)) return p.jabatan.map((j) => ({ jabatan: j, wilayah_id: p.wilayah_id }))
  return []
}

/** Daftar jabatan unik dari penugasan (urut kemunculan). */
export function jabatanDariPenugasan(pn: readonly Penugasan[]): Jabatan[] {
  return [...new Set(pn.map((x) => x.jabatan))]
}

/**
 * §21.1 (J-BJ2): apakah penugasan `pen` boleh menulis catatan `jenis` untuk wilayah `target`.
 * - notulen: sekretaris (daerah) semua wilayah di bawahnya; PJ desa/kelompok hanya wilayahnya;
 * - catatan konseling rahasia (konseling, rujukan oleh BK): hanya wilayah penugasan itu (BK atas tidak membaca/menulis kasus bawah);
 * - lainnya (bidang terbuka & keuangan): wilayah penugasan atau di bawahnya.
 * `mencakup` = pohon wilayah tepercaya (undefined = tidak diketahui → dianggap tidak mencakup).
 */
export function penugasanCocokWilayah(jenis: string, pen: Penugasan, target: string, mencakup: (atas: string, bawah: string) => boolean | undefined): boolean {
  if (pen.wilayah_id === target) return true
  if (jenis === 'notulen') return pen.jabatan === 'sekretaris' && mencakup(pen.wilayah_id, target) === true
  if (JENIS_CATATAN[jenis]?.rahasia === 'konseling') return false
  return mencakup(pen.wilayah_id, target) === true
}

/** §21.1: profil pengurus yang memegang jabatan ini wajib memasang PIN (HP bersama orang tua–anak). */
export const JABATAN_PIN_WAJIB: readonly Jabatan[] = ['bk', 'bendahara', 'penggalang_dana']

/**
 * Validasi daftar penugasan token. `tingkatWilayah` (bila diketahui) memberi tingkat tiap wilayah; `mencakup` (bila diketahui)
 * memastikan penugasan berada di dalam wilayah token. Tanpa pohon wilayah hanya bentuk & aturan yang bisa dipastikan dari
 * token sendiri yang diperiksa. Kembalikan alasan atau null.
 */
export function alasanPenugasanTidakSah(
  penugasan: unknown,
  t: { role: string; tingkat: string; wilayah_id: string; jabatan?: unknown },
  o: { tingkatWilayah?: (id: string) => string | undefined; mencakup?: (atas: string, bawah: string) => boolean | undefined } = {},
): string | null {
  if (penugasan === undefined) return null
  if (t.jabatan !== undefined) return 'Token memakai penugasan atau jabatan, tidak keduanya.'
  if (!Array.isArray(penugasan) || !penugasan.length || penugasan.length > 50) return 'Daftar penugasan tidak sah.'
  if (t.role !== 'pengurus') return 'Penugasan jabatan hanya untuk token pengurus.'
  const dilihat = new Set<string>()
  for (const x of penugasan as unknown[]) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return 'Penugasan tidak sah.'
    const { jabatan, wilayah_id } = x as Record<string, unknown>
    if (typeof jabatan !== 'string' || !(jabatan in LABEL_JABATAN)) return `Jabatan "${String(jabatan)}" tidak dikenal.`
    if (typeof wilayah_id !== 'string' || !wilayah_id || wilayah_id.length > 64) return 'Wilayah penugasan tidak sah.'
    const kunci = `${jabatan}|${wilayah_id}`
    if (dilihat.has(kunci)) return 'Penugasan ganda.'
    dilihat.add(kunci)
    const j = jabatan as Jabatan
    const sama = wilayah_id === t.wilayah_id
    // tingkat penugasan: dari pohon wilayah bila ada; wilayah token = tingkat token
    const tingkat = sama ? t.tingkat : o.tingkatWilayah?.(wilayah_id)
    if (JABATAN_HANYA_DAERAH.includes(j) && !(sama && t.tingkat === 'daerah')) return `${LABEL_JABATAN[j]} hanya di daerah.`
    if (tingkat) {
      const boleh = JABATAN_TINGKAT[tingkat as 'daerah'] ?? []
      if (!boleh.includes(j)) return `Jabatan "${LABEL_JABATAN[j]}" tidak berlaku untuk tingkat ${tingkat}.`
    } else if (t.tingkat === 'kelompok') return 'Penugasan token kelompok harus di kelompok itu.'
    else if (t.tingkat === 'desa' && j === 'pj_desa') return 'PJ Desa ditugaskan di desa itu.'
    if (!sama && o.mencakup && o.mencakup(t.wilayah_id, wilayah_id) === false) return 'Penugasan di luar wilayah token.'
  }
  return null
}

export const DAFTAR_JABATAN = Object.keys(LABEL_JABATAN) as Jabatan[]

/** Bidang data rahasia (kunci bidang per penerima). */
export type BidangRahasia = 'keuangan' | 'konseling'
export const BIDANG_RAHASIA: readonly BidangRahasia[] = ['keuangan', 'konseling']

/** Jabatan pemegang kunci baca bidang rahasia (J-K4). */
export const PEMBACA_RAHASIA: Record<BidangRahasia, readonly Jabatan[]> = {
  keuangan: ['ketua', 'wakil_ketua', 'bendahara', 'penggalang_dana'],
  konseling: ['bk'],
}

/** Bidang catatan (kolom `catatan_bidang.bidang`). */
export type BidangCatatan =
  | 'sekretariat'
  | 'keuangan'
  | 'konseling'
  | 'tenaga_pendidik'
  | 'sarpras'
  | 'muda_mudi'
  | 'olahraga_seni'
  | 'kemandirian'
  | 'keputrian'
  | 'tahfidz'
  | 'umum'

/** Jenis catatan per bidang, siapa yang boleh menulis, dan apakah isinya rahasia. */
export const JENIS_CATATAN: Record<string, { bidang: BidangCatatan; penulis: readonly Jabatan[] | 'mubaligh' | 'semua'; rahasia?: BidangRahasia; nama: string }> = {
  // §18 (J-M2): notulen hanya sekretaris (semua wilayah), PJ desa (desanya), PJ kelompok (kelompoknya)
  notulen: { bidang: 'sekretariat', penulis: ['sekretaris', 'pj_desa', 'pj_kelompok'], nama: 'Notulen musyawarah' },
  // §18 (J-M3/J-M4): pengesahan keputusan oleh ketua (wakil hanya dengan mandat), mandat oleh ketua
  pengesahan: { bidang: 'sekretariat', penulis: ['ketua', 'wakil_ketua'], nama: 'Pengesahan keputusan musyawarah' },
  mandat: { bidang: 'sekretariat', penulis: ['ketua'], nama: 'Mandat pengesahan untuk wakil ketua' },
  kas: { bidang: 'keuangan', penulis: ['bendahara'], rahasia: 'keuangan', nama: 'Buku kas' },
  target_tabungan: { bidang: 'keuangan', penulis: ['bendahara'], rahasia: 'keuangan', nama: 'Target tabungan desa' },
  dana_masuk: { bidang: 'keuangan', penulis: ['penggalang_dana'], rahasia: 'keuangan', nama: 'Dana masuk (penggalangan)' },
  konseling: { bidang: 'konseling', penulis: ['bk'], rahasia: 'konseling', nama: 'Catatan konseling' },
  // §21.3: rujukan ke BK — ditulis mubaligh & pengurus mana pun, disegel ke kunci konseling wilayah tujuan
  rujukan: { bidang: 'konseling', penulis: 'semua', rahasia: 'konseling', nama: 'Rujukan ke BK' },
  // §21.3: status rujukan (terbuka, tanpa isi) — turun ke perujuk lewat paket
  status_rujukan: { bidang: 'konseling', penulis: ['bk'], nama: 'Status rujukan BK' },
  mubaligh: { bidang: 'tenaga_pendidik', penulis: ['tenaga_pendidik', 'sekretaris'], nama: 'Data mubaligh/mubalighot' },
  kebutuhan_pengajar: { bidang: 'tenaga_pendidik', penulis: ['tenaga_pendidik'], nama: 'Kebutuhan pengajar' },
  program_sdm: { bidang: 'tenaga_pendidik', penulis: ['tenaga_pendidik'], nama: 'Program peningkatan SDM' },
  kontrol_mt: { bidang: 'tenaga_pendidik', penulis: 'mubaligh', nama: 'Kontrol Keaktifan & Keteladanan MT' },
  inventaris: { bidang: 'sarpras', penulis: ['sarpras'], nama: 'Inventaris sarpras' },
  usulan_pengadaan: { bidang: 'sarpras', penulis: ['sarpras'], nama: 'Usulan pengadaan' },
  group_pembinaan: { bidang: 'muda_mudi', penulis: ['muda_mudi'], nama: 'Group pembinaan muda/i' },
  agenda_muda_mudi: { bidang: 'muda_mudi', penulis: ['muda_mudi'], nama: 'Agenda muda/i & kepramukaan' },
  agenda_olahraga: { bidang: 'olahraga_seni', penulis: ['olahraga_seni'], nama: 'Agenda olahraga & seni' },
  agenda_kemandirian: { bidang: 'kemandirian', penulis: ['kemandirian'], nama: 'Agenda pelatihan kemandirian' },
  data_kemandirian: { bidang: 'kemandirian', penulis: ['kemandirian'], nama: 'Data pendidikan, bakat & minat generus' },
  info_kerja: { bidang: 'kemandirian', penulis: ['kemandirian'], nama: 'Info peluang kerja' },
  agenda_keputrian: { bidang: 'keputrian', penulis: ['keputrian'], nama: 'Agenda pelatihan putri' },
  peserta_tahfidz: { bidang: 'tahfidz', penulis: ['tahfidz'], nama: 'Peserta tahfidz' },
  ujian_tahfidz: { bidang: 'tahfidz', penulis: ['tahfidz'], nama: 'Ujian tahfidz' },
  nunggoni: { bidang: 'umum', penulis: 'semua', nama: 'NUNGGONI (Semua Pengurus & Mubaligh Peduli)' },
}
export type JenisCatatan = keyof typeof JENIS_CATATAN

/** §21.3: kategori rujukan ke BK. */
export const KATEGORI_RUJUKAN = ['belajar', 'keaktifan', 'perilaku', 'pergaulan', 'keluarga', 'lainnya'] as const
export type KategoriRujukan = (typeof KATEGORI_RUJUKAN)[number]
export const LABEL_KATEGORI_RUJUKAN: Record<KategoriRujukan, string> = {
  belajar: 'Belajar',
  keaktifan: 'Keaktifan',
  perilaku: 'Perilaku',
  pergaulan: 'Pergaulan',
  keluarga: 'Keluarga',
  lainnya: 'Lainnya',
}
/** §21.3: status rujukan (J-BJ8: `dinaikkan` = diteruskan BK ke tingkat atas). */
export const STATUS_RUJUKAN = ['diterima', 'ditangani', 'selesai', 'dinaikkan'] as const
export type StatusRujukan = (typeof STATUS_RUJUKAN)[number]
export const LABEL_STATUS_RUJUKAN: Record<StatusRujukan | 'terkirim', string> = {
  terkirim: 'Terkirim — belum diterima BK',
  diterima: 'Diterima BK',
  ditangani: 'Sedang ditangani BK',
  selesai: 'Selesai',
  dinaikkan: 'Diteruskan ke BK tingkat atas',
}

/** Nama 10 group pembinaan muda/i (proker Bidang Muda/i & Kepramukaan). */
export const GROUP_PEMBINAAN = [
  'Abu Bakar As Siddiq',
  'Umar bin Khotob',
  'Usman bin Affan',
  'Ali bin Abi Tholib',
  'Umar bin Abdul Aziz',
  'Khadijah',
  'Aisyah',
  'Shofiyah',
  'Hafshoh',
  'Zainab',
] as const

/** Jabatan yang boleh mencatat keaktifan kegiatan daerah untuk generus (agenda → MR/DR/AA/AS). */
export const JABATAN_PENCATAT_AGENDA: readonly Jabatan[] = ['muda_mudi', 'olahraga_seni', 'tahfidz', 'keputrian', 'kemandirian', 'ketua', 'wakil_ketua']

/** Apakah jabatan-jabatan ini boleh menulis jenis catatan (tanpa memeriksa role mubaligh/semua). */
export function jabatanBolehMenulis(jabatan: readonly string[], jenis: string): boolean {
  const j = JENIS_CATATAN[jenis]
  if (!j || typeof j.penulis === 'string') return false
  return j.penulis.some((x) => jabatan.includes(x))
}

/**
 * Jabatan yang memegang kunci baca bidang rahasia. `pembaca` = daftar pembaca menurut kebijakan musyawarah (§18 M04);
 * bawaan = {@link PEMBACA_RAHASIA}.
 */
export function bidangRahasiaUntuk(jabatan: readonly string[], pembaca: Record<BidangRahasia, readonly string[]> = PEMBACA_RAHASIA): BidangRahasia[] {
  return BIDANG_RAHASIA.filter((b) => pembaca[b].some((x) => jabatan.includes(x)))
}

/** Bidang rahasia yang DITULIS jabatan ini (kunci publik dibutuhkan walau bukan pembaca, J-M7). */
export function bidangRahasiaDitulis(jabatan: readonly string[]): BidangRahasia[] {
  return BIDANG_RAHASIA.filter((b) => Object.values(JENIS_CATATAN).some((j) => j.rahasia === b && typeof j.penulis !== 'string' && j.penulis.some((x) => jabatan.includes(x))))
}

/** Jabatan yang mungkin menjadi pembaca bidang rahasia (semua pilihan kebijakan) — HP menerima kunci dari paket daerah. */
export const CALON_PEMBACA_RAHASIA: Record<BidangRahasia, readonly Jabatan[]> = {
  keuangan: ['ketua', 'wakil_ketua', 'bendahara', 'penggalang_dana', 'sekretaris'],
  konseling: ['bk'],
}

/** Validasi daftar jabatan untuk tingkat wilayah token. Kembalikan alasan atau null. */
export function alasanJabatanTidakSah(jabatan: unknown, role: string, tingkat: string): string | null {
  if (jabatan === undefined) return null
  if (!Array.isArray(jabatan) || !jabatan.length) return 'Daftar jabatan tidak sah.'
  if (role !== 'pengurus') return 'Jabatan hanya untuk token pengurus.'
  const boleh = JABATAN_TINGKAT[tingkat as 'daerah'] ?? []
  for (const x of jabatan) if (!boleh.includes(x as Jabatan)) return `Jabatan "${String(x)}" tidak berlaku untuk tingkat ${tingkat}.`
  if (new Set(jabatan).size !== jabatan.length) return 'Jabatan ganda.'
  return null
}
