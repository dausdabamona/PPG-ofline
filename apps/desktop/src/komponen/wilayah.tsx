// Pembantu pilihan wilayah (urut pohon, berindentasi) untuk formulir dan filter.
import { pohonWilayah, turunanWilayah, type Db, type SimpulWilayah, type Tingkat } from '@ppg/core'
import { LABEL_TINGKAT } from '../utils/label'
import { Pilihan } from './ui'

export interface OpsiWilayah {
  nilai: string
  teks: string
  tingkat: Tingkat
  nama: string
}

/** Wilayah urut pohon; `tingkat` membatasi jenis yang bisa dipilih; `akar` membatasi ke wilayah itu + turunannya (EXE desa/kelompok). */
export function opsiWilayah(db: Db, tingkat?: Tingkat | Tingkat[], akar?: string | null): OpsiWilayah[] {
  const boleh = tingkat ? (Array.isArray(tingkat) ? tingkat : [tingkat]) : null
  const dalam = akar ? new Set(turunanWilayah(db, akar)) : null
  const hasil: OpsiWilayah[] = []
  const jalan = (l: SimpulWilayah[], kedalaman: number) => {
    for (const s of l) {
      if ((!boleh || boleh.includes(s.tingkat)) && (!dalam || dalam.has(s.id))) {
        hasil.push({
          nilai: s.id,
          nama: s.nama,
          tingkat: s.tingkat,
          teks: `${'   '.repeat(boleh && boleh.length === 1 ? 0 : kedalaman)}${s.nama} (${LABEL_TINGKAT[s.tingkat]}${s.kode ? ` · ${s.kode}` : ''})`,
        })
      }
      jalan(s.anak, kedalaman + 1)
    }
  }
  jalan(pohonWilayah(db), 0)
  return hasil
}

export function PilihWilayah(p: {
  db: Db
  label: string
  nilai: string
  ubah: (v: string) => void
  tingkat?: Tingkat | Tingkat[]
  kosong?: string
  bantuan?: string
  /** Batasi ke wilayah ini + turunannya. */
  akar?: string | null
}) {
  return <Pilihan label={p.label} nilai={p.nilai} ubah={p.ubah} pilihan={opsiWilayah(p.db, p.tingkat, p.akar)} kosong={p.kosong} bantuan={p.bantuan} />
}
