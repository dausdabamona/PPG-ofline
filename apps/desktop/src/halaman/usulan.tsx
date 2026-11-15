// Layar 9: Usulan — perubahan master dari HP (K6): setujui / tolak dengan alasan.
import { useState } from 'react'
import { ambilGenerus, ambilWilayah, daftarPerangkat, daftarUsulan, setujuiUsulan, tolakUsulan, type Db, type StatusUsulan, type Usulan } from '@ppg/core'
import { useApp, useData } from '../konteks'
import { Isian, KeadaanData, Kartu, KepalaHalaman, Lencana, Modal, Pilihan, Tombol } from '../komponen/ui'
import { LABEL_JENIS_USULAN, LABEL_KATEGORI, LABEL_STATUS_GENERUS, LABEL_STATUS_USULAN, label, tanggalLokal, waktuLokal } from '../utils/label'

type UsulanData = Usulan & { data: Record<string, unknown> }

const s = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))

/** Uraian isi usulan yang mudah dibaca. */
function uraian(db: Db, u: UsulanData): string {
  const d = u.data
  const namaG = (id: unknown) => ambilGenerus(db, String(id))?.nama ?? `(generus ${String(id).slice(-6)})`
  switch (u.jenis) {
    case 'tambah_generus':
      return `${s(d.nama)} (${s(d.jenis_kelamin)}), lahir ${tanggalLokal(d.tanggal_lahir as string)}, ${label(LABEL_KATEGORI, d.kategori as string)}, wali ${s(d.wali_nama)} ${d.wali_no_hp ? `(${s(d.wali_no_hp)})` : ''}`
    case 'tambah_jamaah':
      return `${s(d.nama)} (${s(d.jenis_kelamin)}), lahir ${tanggalLokal(d.tanggal_lahir as string)}, HP ${s(d.no_hp)}`
    case 'ubah_generus': {
      const p = (d.perubahan ?? {}) as Record<string, unknown>
      return `${namaG(d.generus_id)}: ${Object.entries(p).map(([k, v]) => `${k.replace(/_/g, ' ')} → ${s(v)}`).join('; ')}`
    }
    case 'pindah_kelompok':
      return `${namaG(d.generus_id)} pindah ke ${ambilWilayah(db, String(d.kelompok_tujuan_id))?.nama ?? '?'} mulai ${tanggalLokal(String(d.tanggal))}`
    case 'ubah_status':
      return `${namaG(d.generus_id)} → ${label(LABEL_STATUS_GENERUS, String(d.status))} mulai ${tanggalLokal(String(d.tanggal))}${d.keterangan ? ` (${s(d.keterangan)})` : ''}`
    case 'tambah_wilayah':
      return `${d.tingkat === 'desa' ? 'Desa' : 'Kelompok'} ${s(d.nama)}${d.kode ? ` (kode ${s(d.kode)})` : ''} di ${ambilWilayah(db, u.kelompok_id)?.nama ?? '?'}`
    case 'tambah_pengajian':
      return `${s(d.nama)} di ${ambilWilayah(db, u.kelompok_id)?.nama ?? '?'}${typeof d.hari === 'number' ? `, hari ke-${d.hari}` : ''}${d.jam ? ` pukul ${s(d.jam)}` : ''}`
  }
}

export function HalamanUsulan() {
  const { db, aksi } = useApp()
  const [status, setStatus] = useState<string>('menunggu')
  const [tolak, setTolak] = useState<UsulanData | null>(null)
  const hasil = useData(() => {
    const pengaju = new Map(daftarPerangkat(db).map((p) => [p.perangkat_id, p.nama]))
    return daftarUsulan(db, status ? { status: status as StatusUsulan } : {}).map((u) => ({
      ...u,
      uraian: uraian(db, u),
      kelompok_nama: ambilWilayah(db, u.kelompok_id)?.nama ?? '?',
      pengaju: pengaju.get(u.perangkat_id) ?? u.perangkat_id.slice(-6),
    }))
  }, [db, status])
  return (
    <>
      <KepalaHalaman judul="Usulan" keterangan="Data master baru/berubah dari HP pengurus/mubaligh menunggu keputusan admin." />
      <Kartu>
        <div className="filter">
          <Pilihan label="Status" nilai={status} ubah={setStatus} pilihan={Object.entries(LABEL_STATUS_USULAN).map(([n, t]) => ({ nilai: n, teks: t }))} kosong="Semua" />
        </div>
        <KeadaanData hasil={hasil} kosong={(d) => d.length === 0} teksKosong={status === 'menunggu' ? 'Tidak ada usulan yang menunggu.' : 'Tidak ada usulan.'}>
          {(daftar) => (
            <table className="tabel">
              <thead>
                <tr>
                  <th>Diajukan</th>
                  <th>Jenis</th>
                  <th>Kelompok</th>
                  <th>Pengaju</th>
                  <th>Isi</th>
                  <th>Status</th>
                  <th aria-label="Aksi" />
                </tr>
              </thead>
              <tbody>
                {daftar.map((u) => (
                  <tr key={u.id}>
                    <td>{waktuLokal(u.dibuat_pada)}</td>
                    <td>{label(LABEL_JENIS_USULAN, u.jenis)}</td>
                    <td>{u.kelompok_nama}</td>
                    <td>{u.pengaju}</td>
                    <td>{u.uraian}</td>
                    <td>
                      <Lencana warna={u.status === 'menunggu' ? 'kuning' : u.status === 'disetujui' ? 'hijau' : 'merah'}>{label(LABEL_STATUS_USULAN, u.status)}</Lencana>
                      {u.alasan ? <small className="blok">{u.alasan}</small> : null}
                    </td>
                    <td className="sel-aksi">
                      {u.status === 'menunggu' ? (
                        <>
                          <Tombol kecil onClick={() => aksi(() => setujuiUsulan(db, u.id), `Usulan "${label(LABEL_JENIS_USULAN, u.jenis)}" disetujui.`)}>
                            Setujui
                          </Tombol>
                          <Tombol kecil varian="kedua" onClick={() => setTolak(u)}>
                            Tolak
                          </Tombol>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </KeadaanData>
      </Kartu>
      {tolak ? <ModalTolak u={tolak} tutup={() => setTolak(null)} /> : null}
    </>
  )
}

function ModalTolak(p: { u: UsulanData; tutup: () => void }) {
  const { db, aksi } = useApp()
  const [alasan, setAlasan] = useState('')
  return (
    <Modal
      judul="Tolak usulan"
      tutup={p.tutup}
      aksi={
        <>
          <Tombol varian="kedua" onClick={p.tutup}>
            Batal
          </Tombol>
          <Tombol
            varian="bahaya"
            onClick={async () => {
              const ok = await aksi(() => {
                tolakUsulan(db, p.u.id, alasan)
                return true
              }, 'Usulan ditolak. Alasan dikirim lewat paket berikutnya.')
              if (ok) p.tutup()
            }}
          >
            Tolak usulan
          </Tombol>
        </>
      }
    >
      <div className="formulir">
        <p>{uraian(db, p.u)}</p>
        <Isian label="Alasan penolakan" nilai={alasan} ubah={setAlasan} wajib lebar />
      </div>
    </Modal>
  )
}
