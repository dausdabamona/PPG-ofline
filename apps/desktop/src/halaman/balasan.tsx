// Fase 8: Kirim Balasan dari EXE desa/kelompok ke HP generus/wali di wilayahnya (V-T9). Balasan membawa kemajuan,
// kehadiran, jadwal, target capaian, dan pencabutan terbaru — memakai kunci kelompok titipan daerah.
import { useState } from 'react'
import { ambilWilayah, buatBalasan, daftarPenerimaBalasan, daftarPerangkat } from '@ppg/core'
import { useApp, useData } from '../konteks'
import { KeadaanData, Kartu, KepalaHalaman, Tombol } from '../komponen/ui'

const LABEL_ROLE: Record<string, string> = { generus: 'Murid', wali: 'Orang tua' }

export function HalamanBalasan() {
  const { db, platform, aksi, toast } = useApp()
  const [tersimpan, setTersimpan] = useState<string | null>(null)

  const penerima = useData(
    () =>
      daftarPenerimaBalasan(db).map((p) => {
        const kel = daftarPerangkat(db, { perangkatId: p.perangkatId, role: ['generus', 'wali'] })[0]?.wilayah_id
        return { ...p, kelompok: kel ? (ambilWilayah(db, kel)?.nama ?? '-') : '-' }
      }),
    [db],
  )

  const satu = async (perangkatId: string, nama: string) => {
    const b = await aksi(() => buatBalasan(db, perangkatId))
    if (!b) return
    const lokasi = await aksi(() => platform.simpanBerkas(b.nama, b.bytes))
    if (lokasi) {
      setTersimpan(lokasi)
      toast('sukses', `Balasan untuk ${nama} disimpan. Kirim berkasnya lewat WA ke HP itu.`)
    }
  }

  const semua = async (daftar: { perangkatId: string }[]) => {
    const berkas = await aksi(() => daftar.map((p) => buatBalasan(db, p.perangkatId)))
    if (!berkas) return
    const lokasi = await aksi(() => platform.simpanKeFolder(berkas.map((b) => ({ nama: b.nama, bytes: b.bytes }))))
    if (lokasi) {
      setTersimpan(lokasi)
      toast('sukses', `${berkas.length} berkas balasan disimpan di ${lokasi}.`)
    }
  }

  return (
    <>
      <KepalaHalaman
        judul="Kirim Balasan"
        keterangan="Balasan untuk HP murid dan orang tua di wilayah ini: kemajuan yang sudah disahkan, kehadiran, jadwal, materi yang perlu dituntaskan, dan pencabutan token terbaru. Pakai bila mubaligh kelompok berhalangan atau sesudah token mubaligh dicabut."
      />
      <Kartu judul="HP murid & orang tua">
        <KeadaanData
          hasil={penerima}
          kosong={(d) => d.length === 0}
          teksKosong="Belum ada HP murid/orang tua yang dikenal. Token mereka tercatat di sini setelah setoran mubaligh diimpor."
        >
          {(daftar) => (
            <>
              <div className="aksi-filter">
                <Tombol varian="kedua" onClick={() => semua(daftar)}>
                  Buat balasan semua HP
                </Tombol>
              </div>
              <table className="tabel">
                <thead>
                  <tr>
                    <th>HP</th>
                    <th>Profil</th>
                    <th>Kelompok</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {daftar.map((p) => (
                    <tr key={p.perangkatId}>
                      <td>{p.label || 'HP tanpa nama'}</td>
                      <td>{p.nama.map((n, i) => `${n} (${LABEL_ROLE[p.role[i] ?? ''] ?? p.role[i]})`).join(', ')}</td>
                      <td>{p.kelompok}</td>
                      <td>
                        <Tombol kecil onClick={() => satu(p.perangkatId, p.label || p.nama[0] || 'HP')}>
                          Buat Balasan
                        </Tombol>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </KeadaanData>
        {tersimpan ? <p className="keterangan">Berkas terakhir disimpan di: {tersimpan}</p> : null}
      </Kartu>
    </>
  )
}
