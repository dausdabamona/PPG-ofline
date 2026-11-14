// Pembantu bersama untuk tabel kegiatan.
import type { Db } from '../db'
import type { Hak, Role } from '../token'
import { cariProfilPencatat, type Profil } from './profil'
import { adalahAdmin } from './umum'

/** Di HP: pastikan ada profil berwenang untuk kelompok; di admin selalu boleh (kembalikan null). */
export function pastikanPencatat(db: Db, kelompokId: string, role: Role[], hak: Hak = 'catat'): Profil | null {
  if (adalahAdmin(db)) return null
  return cariProfilPencatat(db, kelompokId, role, hak)
}

/** Pilih rekaman pemenang per kunci alami: diubah_pada terbesar, seri → perangkat_id terbesar. Yang dihapus dibuang. */
export function pemenangPerKunci<T extends { diubah_pada: string; perangkat_id: string; dihapus: number }>(
  baris: T[],
  kunci: (b: T) => string,
): T[] {
  const peta = new Map<string, T>()
  for (const b of baris) {
    const k = kunci(b)
    const ada = peta.get(k)
    if (!ada || b.diubah_pada > ada.diubah_pada || (b.diubah_pada === ada.diubah_pada && b.perangkat_id > ada.perangkat_id)) {
      peta.set(k, b)
    }
  }
  return [...peta.values()].filter((b) => !b.dihapus)
}
