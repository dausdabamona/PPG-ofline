// Aturan penggabungan rekaman tersinkron (§7).
import type { Db, NilaiSql } from './db'
import { ulid } from './ids'
import { tulisBaris, type Rekaman } from './repo/umum'
import { DAFTAR_TABEL_SINKRON, KOLOM_SINKRON, kolomLengkap, TABEL_SINKRON, type NamaTabelSinkron } from './skema'
import { sekarangIso } from './waktu'

export interface HasilGabung {
  ditambah: number
  diperbarui: number
  diabaikan: number
  bentrok: number
  ditolak: { id: string; alasan: string }[]
}

export interface OpsiGabung {
  /** 'admin' = sumber berwenang (PAKET/BALASAN/JADWAL/MATERI); 'perangkat' = SETOR/BELAJAR. */
  sumber: 'admin' | 'perangkat'
  /** Nilai seq_lokal untuk rekaman yang diterima (0 = tidak perlu diteruskan). */
  seqLokalBaru?: number
  /** Pemeriksaan wewenang tambahan; kembalikan alasan penolakan atau null. */
  periksa?: (rek: Rekaman, lama: Rekaman | undefined) => string | null
  /** Rekaman berasal dari perangkat generus (aturan kemajuan_belajar lebih ketat). */
  dariGenerus?: boolean
}

export function hasilKosong(): HasilGabung {
  return { ditambah: 0, diperbarui: 0, diabaikan: 0, bentrok: 0, ditolak: [] }
}

/** Jumlahkan hasil b ke a. */
export function tambahkanHasil(a: HasilGabung, b: HasilGabung): HasilGabung {
  a.ditambah += b.ditambah
  a.diperbarui += b.diperbarui
  a.diabaikan += b.diabaikan
  a.bentrok += b.bentrok
  a.ditolak.push(...b.ditolak)
  return a
}

const PANJANG_MAKS_TEKS = 8 * 1024 * 1024

/** Normalisasi rekaman masuk ke kolom tabel; null bila bentuknya tidak sah. */
function normalkan(tabel: NamaTabelSinkron, masuk: unknown): Rekaman | null {
  if (!masuk || typeof masuk !== 'object') return null
  const m = masuk as Record<string, unknown>
  const rek: Record<string, NilaiSql> = {}
  for (const k of kolomLengkap(tabel)) {
    if (k === 'seq_lokal') continue
    const v = m[k]
    if (v === undefined || v === null) rek[k] = null
    else if (typeof v === 'string') {
      if (v.length > PANJANG_MAKS_TEKS) return null
      rek[k] = v
    } else if (typeof v === 'number' && Number.isFinite(v)) rek[k] = v
    else if (typeof v === 'boolean') rek[k] = v ? 1 : 0
    else return null
  }
  if (typeof rek.id !== 'string' || !rek.id || rek.id.length > 64) return null
  if (typeof rek.perangkat_id !== 'string' || !rek.perangkat_id) return null
  if (typeof rek.dibuat_pada !== 'string' || typeof rek.diubah_pada !== 'string') return null
  rek.dihapus = rek.dihapus ? 1 : 0
  const versi = Number(rek.versi ?? 1)
  if (!Number.isInteger(versi) || versi < 1) return null
  rek.versi = versi
  return rek as Rekaman
}

function samaIsi(a: Rekaman, b: Rekaman, tabel: NamaTabelSinkron): boolean {
  for (const k of kolomLengkap(tabel)) {
    if (k === 'seq_lokal') continue
    if ((a[k] ?? null) !== (b[k] ?? null)) return false
  }
  return true
}

/** true bila a lebih baru dari b (last-writer-wins: diubah_pada, seri → perangkat_id leksikografis). */
function lebihBaru(a: Rekaman, b: Rekaman): boolean {
  const da = String(a.diubah_pada)
  const dbb = String(b.diubah_pada)
  if (da !== dbb) return da > dbb
  return String(a.perangkat_id) > String(b.perangkat_id)
}

function peringkatSah(r: Rekaman): number {
  return r.status_sah === 'disahkan' || r.status_sah === 'ditolak' ? 1 : 0
}

function catatBentrok(db: Db, tabel: string, lama: Rekaman, baru: Rekaman): void {
  db.jalankan('INSERT INTO log_bentrok (id, tabel, rekaman_id, lama_json, baru_json, tanggal) VALUES (?, ?, ?, ?, ?, ?)', [
    ulid(),
    tabel,
    lama.id,
    JSON.stringify(lama),
    JSON.stringify(baru),
    sekarangIso(),
  ])
}

/**
 * Gabungkan rekaman masuk ke satu tabel menurut §7:
 * - master: hanya dari sumber admin, menang bila versi ≥ lokal atau diubah_pada lebih baru;
 * - kegiatan: last-writer-wins; bentrok dicatat bila isi berbeda, lokal pernah ditulis di sini (seq_lokal > 0),
 *   dan pemenang tidak memiliki versi lebih tinggi (suntingan bersamaan, bukan gema data lama);
 * - kemajuan_belajar: hasil pengesahan tidak bisa ditimpa versi `diajukan`; generus hanya mengubah miliknya yang masih diajukan.
 */
export function gabungRekaman(db: Db, tabel: NamaTabelSinkron, rekamanMasuk: readonly unknown[], opsi: OpsiGabung): HasilGabung {
  const hasil = hasilKosong()
  const info = TABEL_SINKRON[tabel]
  const seqBaru = opsi.seqLokalBaru ?? 0
  for (const masuk of rekamanMasuk) {
    const rek = normalkan(tabel, masuk)
    const idTampil = String((masuk as { id?: unknown } | null)?.id ?? '?')
    if (!rek) {
      hasil.ditolak.push({ id: idTampil, alasan: 'Bentuk rekaman tidak sah.' })
      continue
    }
    if (info.jenis === 'master' && opsi.sumber === 'perangkat') {
      hasil.ditolak.push({ id: rek.id, alasan: 'Data master hanya boleh diubah admin (ajukan lewat usulan).' })
      continue
    }
    const lama = db.satu<Rekaman>(`SELECT * FROM ${tabel} WHERE id = ?`, [rek.id])
    if (opsi.periksa) {
      const alasan = opsi.periksa(rek, lama)
      if (alasan) {
        hasil.ditolak.push({ id: rek.id, alasan })
        continue
      }
    }
    if (!lama) {
      tulisBaris(db, tabel, { ...rek, seq_lokal: seqBaru })
      hasil.ditambah++
      continue
    }
    if (samaIsi(lama, rek, tabel)) {
      hasil.diabaikan++
      continue
    }
    if (info.jenis === 'master') {
      // Penulis master hanya admin: versi ≥ lokal, atau suntingan admin yang lebih baru setelah database admin
      // dipulihkan dari cadangan (versi mundur, diubah_pada maju) — Fase 1b.
      if (Number(rek.versi) >= Number(lama.versi) || String(rek.diubah_pada) > String(lama.diubah_pada)) {
        tulisBaris(db, tabel, { ...rek, seq_lokal: seqBaru })
        hasil.diperbarui++
      } else hasil.diabaikan++
      continue
    }
    // --- kegiatan ---
    let masukMenang: boolean
    if (tabel === 'kemajuan_belajar') {
      if (opsi.dariGenerus && lama.perangkat_id !== rek.perangkat_id) {
        hasil.ditolak.push({ id: rek.id, alasan: 'Generus hanya boleh mengubah catatannya sendiri.' })
        continue
      }
      const pl = peringkatSah(lama)
      const pm = peringkatSah(rek)
      if (pl > pm) {
        hasil.diabaikan++
        continue
      }
      masukMenang = pm > pl ? true : lebihBaru(rek, lama)
    } else {
      masukMenang = lebihBaru(rek, lama)
    }
    const pemenang = masukMenang ? rek : lama
    const kalah = masukMenang ? lama : rek
    if (Number(lama.seq_lokal) > 0 && Number(pemenang.versi) <= Number(kalah.versi)) {
      catatBentrok(db, tabel, lama, rek)
      hasil.bentrok++
    }
    if (masukMenang) {
      tulisBaris(db, tabel, { ...rek, seq_lokal: seqBaru })
      hasil.diperbarui++
    } else hasil.diabaikan++
  }
  return hasil
}

export type RekamanPerTabel = Partial<Record<NamaTabelSinkron, unknown[]>>

/** Gabungkan banyak tabel sekaligus (urutan TABEL_SINKRON). Tabel tak dikenal diabaikan. */
export function gabungSemua(
  db: Db,
  data: RekamanPerTabel,
  opsi: OpsiGabung | ((tabel: NamaTabelSinkron) => OpsiGabung),
): { perTabel: Partial<Record<NamaTabelSinkron, HasilGabung>>; total: HasilGabung } {
  const perTabel: Partial<Record<NamaTabelSinkron, HasilGabung>> = {}
  const total = hasilKosong()
  for (const t of DAFTAR_TABEL_SINKRON) {
    const daftar = data[t]
    if (!Array.isArray(daftar) || daftar.length === 0) continue
    const h = gabungRekaman(db, t, daftar, typeof opsi === 'function' ? opsi(t) : opsi)
    perTabel[t] = h
    tambahkanHasil(total, h)
  }
  return { perTabel, total }
}

/** Ambil rekaman untuk dikirim (tanpa seq_lokal). */
export function rekamanKirim(rows: Rekaman[]): Record<string, NilaiSql>[] {
  return rows.map((r) => {
    const o: Record<string, NilaiSql> = {}
    for (const [k, v] of Object.entries(r)) if (k !== 'seq_lokal') o[k] = v
    return o
  })
}

export { KOLOM_SINKRON }
