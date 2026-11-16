// §21.1 (Fase 15) — Struktur & Kursi Kosong: tabel wilayah × jabatan dari token pengurus aktif berpenugasan. Pemegang
// rangkapan dari tingkat atas diberi tanda perwakilan daerah/desa; kursi tanpa pemegang = "Perlu ditunjuk". Rangkap tidak
// diperingatkan (keputusan pemilik: orang terbatas, rangkap boleh di semua tingkat).
import type { Db } from './db'
import { JABATAN_TINGKAT, LABEL_JABATAN, type Jabatan } from './kepengurusan'
import { adalahAdmin, uraiJson } from './repo/umum'
import { ambilWilayah, daftarWilayah, leluhurWilayah, turunanWilayah, type Wilayah } from './repo/wilayah'
import { pengurusBidangAktif, type PengurusBidang } from './sinkron/paket'

export interface PemegangKursi {
  token_id: string
  nama: string
  /** Pemegang juga memegang penugasan di tingkat atas wilayah ini → "perwakilan daerah/desa". */
  perwakilan: 'daerah' | 'desa' | null
}

export interface KursiStruktur {
  wilayah_id: string
  wilayah: string
  tingkat: 'daerah' | 'desa' | 'kelompok'
  jabatan: Jabatan
  label: string
  pemegang: PemegangKursi[]
  kosong: boolean
}

export interface StrukturKepengurusan {
  wilayah: Pick<Wilayah, 'id' | 'nama' | 'tingkat' | 'induk_id'>[]
  kursi: KursiStruktur[]
  /** Jumlah kursi kosong (Perlu ditunjuk). */
  kosong: number
}

/** Sumber pengurus berpenugasan: EXE Daerah = tabel perangkat; EXE desa = ringkasan dari paket daerah. */
function sumberPengurus(db: Db): PengurusBidang[] {
  if (adalahAdmin(db)) return pengurusBidangAktif(db)
  const peta = new Map<string, PengurusBidang>()
  for (const r of db.kueri<{ nilai: string }>(`SELECT nilai FROM meta WHERE kunci LIKE 'pengurus_bidang:%'`)) {
    for (const p of uraiJson<PengurusBidang[]>(r.nilai, [])) if (p?.token_id && Array.isArray(p.penugasan)) peta.set(p.token_id, p)
  }
  return [...peta.values()]
}

/** Struktur wilayah (bawaan: seluruh daerah) × jabatan menurut tingkat, dengan pemegang & kursi kosong. */
export function strukturKepengurusan(db: Db, wilayahId?: string): StrukturKepengurusan {
  const akar = wilayahId ?? daftarWilayah(db, { tingkat: 'daerah' })[0]?.id
  if (!akar) return { wilayah: [], kursi: [], kosong: 0 }
  const ids = turunanWilayah(db, akar)
  const wilayah = ids
    .map((id) => ambilWilayah(db, id))
    .filter((w): w is Wilayah => !!w && !w.dihapus)
    .sort((a, b) => urutTingkat(a.tingkat) - urutTingkat(b.tingkat) || a.nama.localeCompare(b.nama))
  const pengurus = sumberPengurus(db)
  const kursi: KursiStruktur[] = []
  for (const w of wilayah) {
    const leluhur = leluhurWilayah(db, w.id)
    for (const j of JABATAN_TINGKAT[w.tingkat]) {
      const pemegang: PemegangKursi[] = []
      for (const p of pengurus) {
        if (!p.penugasan.some((x) => x.jabatan === j && x.wilayah_id === w.id)) continue
        const atas = p.penugasan.map((x) => ambilWilayah(db, x.wilayah_id)).filter((x): x is Wilayah => !!x && leluhur.includes(x.id))
        const perwakilan = atas.some((x) => x.tingkat === 'daerah') ? 'daerah' : atas.some((x) => x.tingkat === 'desa') ? 'desa' : null
        pemegang.push({ token_id: p.token_id, nama: p.nama, perwakilan })
      }
      pemegang.sort((a, b) => a.nama.localeCompare(b.nama))
      kursi.push({ wilayah_id: w.id, wilayah: w.nama, tingkat: w.tingkat, jabatan: j, label: LABEL_JABATAN[j], pemegang, kosong: !pemegang.length })
    }
  }
  return {
    wilayah: wilayah.map((w) => ({ id: w.id, nama: w.nama, tingkat: w.tingkat, induk_id: w.induk_id })),
    kursi,
    kosong: kursi.filter((k) => k.kosong).length,
  }
}

function urutTingkat(t: string): number {
  return t === 'daerah' ? 0 : t === 'desa' ? 1 : 2
}
