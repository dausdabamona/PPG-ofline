/**
 * Galat standar @ppg/core. Selalu punya `kode` (SCREAMING_SNAKE, stabil untuk logika UI)
 * dan `pesan` Bahasa Indonesia yang siap ditampilkan ke pengguna.
 */
export class GalatPpg extends Error {
  readonly kode: string
  readonly pesan: string
  readonly rincian?: unknown

  constructor(kode: string, pesan: string, rincian?: unknown) {
    super(`${kode}: ${pesan}`)
    this.name = 'GalatPpg'
    this.kode = kode
    this.pesan = pesan
    this.rincian = rincian
  }
}

/** Lempar GalatPpg bila kondisi salah. */
export function pastikan(kondisi: unknown, kode: string, pesan: string): asserts kondisi {
  if (!kondisi) throw new GalatPpg(kode, pesan)
}

/** Apakah nilai adalah GalatPpg (opsional dengan kode tertentu). */
export function adalahGalatPpg(e: unknown, kode?: string): e is GalatPpg {
  return e instanceof GalatPpg && (kode === undefined || e.kode === kode)
}
