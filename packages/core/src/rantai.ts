// Pembantu rantai kepercayaan berjenjang (v3): opsi pemeriksaan token dari isi database lokal.
import type { Db } from './db'
import { GalatPpg } from './galat'
import { daftarPencabutan, tokenDikenal } from './repo/perangkat'
import { ambilMeta, peranInstalasi } from './repo/umum'
import { periksaToken, rantaiPenerbit, type HasilPeriksaToken, type OpsiPeriksaToken } from './token'

/**
 * Fungsi "wilayah atas mencakup wilayah bawah" dari pohon wilayah lokal (data master dari daerah).
 * `undefined` bila wilayah bawah tidak dikenal (pohon belum ada di perangkat ini).
 */
export function wilayahMencakupDb(db: Db): (atasId: string, bawahId: string) => boolean | undefined {
  const induk = new Map<string, string | null>()
  for (const w of db.kueri<{ id: string; induk_id: string | null }>('SELECT id, induk_id FROM wilayah')) induk.set(w.id, w.induk_id)
  return (atasId, bawahId) => {
    if (atasId === bawahId) return true
    if (!induk.has(bawahId)) return undefined
    const dilihat = new Set<string>()
    let kini: string | null | undefined = bawahId
    while (kini && !dilihat.has(kini)) {
      if (kini === atasId) return true
      dilihat.add(kini)
      kini = induk.get(kini)
    }
    return induk.has(atasId) ? false : undefined
  }
}

/** §21: tingkat wilayah dari pohon wilayah lokal (`undefined` bila tidak dikenal). */
export function tingkatWilayahDb(db: Db): (id: string) => string | undefined {
  const peta = new Map(db.kueri<{ id: string; tingkat: string }>('SELECT id, tingkat FROM wilayah WHERE dihapus = 0').map((w) => [w.id, w.tingkat]))
  return (id) => peta.get(id)
}

/**
 * Fase 8: apakah perangkat ini wajib menuntut `bukti_wilayah` pada token terbitan EXE desa. Hanya EXE daerah dan EXE desa
 * (dan Super Admin HP, Fase 9) yang pohon wilayahnya berasal langsung dari daerah; HP dan EXE kelompok (pohon dari paket desa, atau belum ada) wajib.
 */
export function wajibBuktiWilayahDb(db: Db): boolean {
  const peran = peranInstalasi(db)
  return peran !== 'daerah' && peran !== 'desa' && peran !== 'super_hp'
}

/** Opsi `periksaToken` dari database: kunci admin daerah terpasang, pencabutan, pohon wilayah, kewajiban bukti wilayah. */
export function opsiPeriksaDb(db: Db, tambahan: Partial<OpsiPeriksaToken> = {}): OpsiPeriksaToken {
  const adminSignPub = ambilMeta(db, 'admin_sign_pub')
  if (!adminSignPub) throw new GalatPpg('BELUM_AKTIVASI', 'Aplikasi ini belum diaktifkan.')
  return {
    adminSignPub,
    pencabutan: daftarPencabutan(db),
    wilayahMencakup: wilayahMencakupDb(db),
    wajibBuktiWilayah: wajibBuktiWilayahDb(db),
    tingkatWilayah: tingkatWilayahDb(db),
    ...tambahan,
  }
}

/** Periksa token memakai data lokal (pencabutan + pohon wilayah). `denganDikenal` → T12 berlaku di semua mata rantai. */
export function periksaTokenDb(db: Db, teks: string, o: Partial<OpsiPeriksaToken> & { denganDikenal?: boolean } = {}): HasilPeriksaToken {
  const { denganDikenal, ...sisa } = o
  return periksaToken(teks, opsiPeriksaDb(db, denganDikenal ? { tokenDikenal: tokenDikenal(db), ...sisa } : sisa))
}

/** Token_id seluruh penerbit di atas token (terdekat dulu). */
export function idRantaiPenerbit(teks: string): string[] {
  return rantaiPenerbit(teks).map((p) => p.token_id)
}

/** Wilayah seluruh penerbit di atas token (dipercaya karena tertanda rantai). */
export function wilayahRantaiPenerbit(teks: string): string[] {
  return rantaiPenerbit(teks).map((p) => p.wilayah_id)
}
