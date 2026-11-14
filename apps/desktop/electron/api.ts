// Kontrak IPC antara proses utama dan renderer (diekspos preload sebagai `window.ppgAdmin`).

export interface FilterBerkas {
  nama: string
  ekstensi: string[]
}

export interface BerkasDibuka {
  nama: string
  bytes: Uint8Array
}

export interface BerkasDisimpan {
  nama: string
  bytes: Uint8Array
}

export interface ApiDesktop {
  /** db:muat — isi berkas `userData/ppg-admin.db`, atau null bila belum ada. */
  muatDb(): Promise<Uint8Array | null>
  /** db:simpan — simpan atomik + cadangan harian `userData/cadangan/`. */
  simpanDb(bytes: Uint8Array): Promise<void>
  /** berkas:bukaBanyak — dialog buka (boleh banyak berkas). Kosong bila dibatalkan. */
  bukaBanyak(filter: FilterBerkas[], banyak?: boolean): Promise<BerkasDibuka[]>
  /** berkas:simpan — dialog simpan; mengembalikan path, atau null bila dibatalkan. */
  simpanBerkas(namaSaran: string, bytes: Uint8Array): Promise<string | null>
  /** berkas:simpanKeFolder — pilih satu folder lalu tulis semua berkas; mengembalikan folder atau null. */
  simpanKeFolder(daftar: BerkasDisimpan[]): Promise<string | null>
  /** Daftarkan fungsi yang dipanggil saat jendela akan ditutup (simpan terakhir). */
  saatAkanTutup(fn: () => Promise<void>): void
  /** Folder data aplikasi (userData), untuk ditampilkan di Pengaturan. */
  folderData(): Promise<string>
}

export const KANAL = {
  muatDb: 'db:muat',
  simpanDb: 'db:simpan',
  bukaBanyak: 'berkas:bukaBanyak',
  simpanBerkas: 'berkas:simpan',
  simpanKeFolder: 'berkas:simpanKeFolder',
  folderData: 'aplikasi:folderData',
  akanTutup: 'aplikasi:akanTutup',
  siapTutup: 'aplikasi:siapTutup',
} as const
