// Penilaian akhlaq bulanan (kegiatan).
import type { Db } from '../db'
import { GalatPpg } from '../galat'
import { pastikanPencatat, pemenangPerKunci } from './kegiatan-umum'
import { idPerangkatLokal, sisipkanRekaman, tandaTanya, ubahRekaman, type RekamanDasar } from './umum'

export const ASPEK_AKHLAQ = [
  'sholat_wajib', 'sholat_jamaah', 'puasa', 'tilawah', 'birrul_walidain', 'adab_makan',
  'adab_tidur', 'adab_berbicara', 'kebersihan', 'kedisiplinan', 'kejujuran', 'tanggung_jawab',
] as const
export type AspekAkhlaq = (typeof ASPEK_AKHLAQ)[number]

export interface PenilaianAkhlaq extends RekamanDasar {
  generus_id: string
  kelompok_id: string
  periode: string
  aspek: AspekAkhlaq
  nilai: number
  perangkat_id: string
  diubah_pada: string
  dihapus: number
}

/** Catat penilaian akhlaq satu aspek (periode 'YYYY-MM', nilai 1–5). */
export function catatPenilaianAkhlaq(
  db: Db,
  d: { generusId: string; kelompokId: string; periode: string; aspek: AspekAkhlaq; nilai: number },
): PenilaianAkhlaq {
  if (!ASPEK_AKHLAQ.includes(d.aspek)) throw new GalatPpg('ASPEK_TIDAK_SAH', 'Aspek akhlaq tidak dikenal.')
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(d.periode)) throw new GalatPpg('PERIODE_TIDAK_SAH', 'Periode harus berformat YYYY-MM.')
  if (!(Number.isInteger(d.nilai) && d.nilai >= 1 && d.nilai <= 5)) throw new GalatPpg('NILAI_TIDAK_SAH', 'Nilai akhlaq harus 1–5.')
  pastikanPencatat(db, d.kelompokId, ['mubaligh', 'pengurus', 'admin'])
  const ada = db.satu<PenilaianAkhlaq>(
    'SELECT * FROM penilaian_akhlaq WHERE perangkat_id = ? AND generus_id = ? AND periode = ? AND aspek = ?',
    [idPerangkatLokal(db), d.generusId, d.periode, d.aspek],
  )
  if (ada) return ubahRekaman<PenilaianAkhlaq>(db, 'penilaian_akhlaq', ada.id, { nilai: d.nilai, dihapus: 0 })
  return sisipkanRekaman<PenilaianAkhlaq>(db, 'penilaian_akhlaq', {
    generus_id: d.generusId,
    kelompok_id: d.kelompokId,
    periode: d.periode,
    aspek: d.aspek,
    nilai: d.nilai,
  })
}

/** Daftar penilaian akhlaq (dideduplikasi per generus+periode+aspek). */
export function daftarPenilaianAkhlaq(db: Db, f: { generusIds?: string[]; periode?: string } = {}): PenilaianAkhlaq[] {
  const s: string[] = []
  const p: string[] = []
  if (f.generusIds) {
    if (!f.generusIds.length) return []
    s.push(`generus_id IN (${tandaTanya(f.generusIds.length)})`)
    p.push(...f.generusIds)
  }
  if (f.periode) {
    s.push('periode = ?')
    p.push(f.periode)
  }
  const baris = db.kueri<PenilaianAkhlaq>(`SELECT * FROM penilaian_akhlaq ${s.length ? 'WHERE ' + s.join(' AND ') : ''}`, p)
  return pemenangPerKunci(baris, (b) => `${b.generus_id}|${b.periode}|${b.aspek}`)
}
