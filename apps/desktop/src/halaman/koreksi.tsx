// Layar 10: Koreksi — catatan admin atas rekaman kegiatan (K5: koreksi = catatan, bukan timpa).
import { useState } from 'react'
import {
  buatKoreksi,
  daftarGenerus,
  daftarKemajuan,
  daftarKoreksi,
  daftarMateri,
  daftarPenilaianAkhlaq,
  daftarPerangkat,
  daftarPresensi,
  tambahHari,
  tanggalHariIni,
  type NamaTabelSinkron,
} from '@ppg/core'
import { useApp, useData } from '../konteks'
import { AreaTeks, Isian, KeadaanData, Kartu, KepalaHalaman, Kosong, Modal, Pilihan, Tombol } from '../komponen/ui'
import { PilihWilayah } from '../komponen/wilayah'
import { LABEL_PRESENSI, LABEL_TABEL, label, tanggalLokal } from '../utils/label'

type JenisData = 'presensi' | 'kemajuan_belajar' | 'penilaian_akhlaq'

interface BarisKegiatan {
  id: string
  tanggal: string
  generus: string
  isi: string
  pencatat: string
}

export function HalamanKoreksi() {
  const { db } = useApp()
  const [kelompok, setKelompok] = useState('')
  const [jenis, setJenis] = useState<JenisData>('presensi')
  const [mulai, setMulai] = useState(tambahHari(tanggalHariIni(), -30))
  const [selesai, setSelesai] = useState(tanggalHariIni())
  const [koreksi, setKoreksi] = useState<BarisKegiatan | null>(null)

  const rekaman = useData((): BarisKegiatan[] => {
    if (!kelompok) return []
    const namaP = new Map(daftarPerangkat(db).map((p) => [p.perangkat_id, p.nama]))
    const gen = daftarGenerus(db, {})
    const namaG = new Map(gen.map((g) => [g.id, g.nama]))
    const pencatat = (id: string) => namaP.get(id) ?? id.slice(-6)
    if (jenis === 'presensi') {
      return daftarPresensi(db, { kelompokIds: [kelompok], mulai, selesai }).map((p) => ({
        id: p.id,
        tanggal: p.tanggal,
        generus: namaG.get(p.generus_id) ?? '?',
        isi: label(LABEL_PRESENSI, p.status),
        pencatat: pencatat(p.perangkat_id),
      }))
    }
    if (jenis === 'kemajuan_belajar') {
      const namaM = new Map(daftarMateri(db).map((m) => [m.id, m.nama]))
      return daftarKemajuan(db, { kelompokId: kelompok })
        .filter((k) => k.tanggal >= mulai && k.tanggal <= selesai)
        .map((k) => ({
          id: k.id,
          tanggal: k.tanggal,
          generus: namaG.get(k.generus_id) ?? '?',
          isi: `${namaM.get(k.materi_id) ?? k.materi_id}: ${k.status}${k.nilai !== null ? `, nilai ${k.nilai}` : ''}${k.level !== null ? `, level ${k.level}` : ''} (${k.status_sah})`,
          pencatat: pencatat(k.perangkat_id),
        }))
    }
    const ids = gen.map((g) => g.id)
    return daftarPenilaianAkhlaq(db, { generusIds: ids })
      .filter((p) => p.kelompok_id === kelompok && p.periode >= mulai.slice(0, 7) && p.periode <= selesai.slice(0, 7))
      .map((p) => ({ id: p.id, tanggal: p.periode, generus: namaG.get(p.generus_id) ?? '?', isi: `${p.aspek.replace(/_/g, ' ')}: ${p.nilai}`, pencatat: pencatat(p.perangkat_id) }))
  }, [db, kelompok, jenis, mulai, selesai])

  const terkirim = useData(() => {
    const namaP = new Map(daftarPerangkat(db).map((p) => [p.perangkat_id, p.nama]))
    return daftarKoreksi(db).map((k) => ({ ...k, untuk: namaP.get(k.untuk_perangkat_id) ?? k.untuk_perangkat_id.slice(-6) }))
  }, [db])

  return (
    <>
      <KepalaHalaman judul="Koreksi" keterangan="Catatan koreksi dikirim ke HP pencatat lewat paket berikutnya; data aslinya tidak ditimpa." />
      <Kartu judul="Pilih rekaman kegiatan">
        <div className="filter">
          <PilihWilayah db={db} label="Kelompok" nilai={kelompok} ubah={setKelompok} tingkat="kelompok" kosong="— pilih kelompok —" />
          <Pilihan
            label="Jenis data"
            nilai={jenis}
            ubah={(v) => setJenis(v as JenisData)}
            pilihan={(['presensi', 'kemajuan_belajar', 'penilaian_akhlaq'] as const).map((j) => ({ nilai: j, teks: LABEL_TABEL[j]! }))}
          />
          <Isian label="Dari" type="date" nilai={mulai} ubah={setMulai} />
          <Isian label="Sampai" type="date" nilai={selesai} ubah={setSelesai} />
        </div>
        {!kelompok ? (
          <Kosong teks="Pilih kelompok untuk melihat rekaman kegiatannya." />
        ) : (
          <KeadaanData hasil={rekaman} kosong={(d) => d.length === 0} teksKosong="Tidak ada rekaman pada rentang ini.">
            {(daftar) => (
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Generus</th>
                    <th>Isi</th>
                    <th>Pencatat</th>
                    <th aria-label="Aksi" />
                  </tr>
                </thead>
                <tbody>
                  {daftar.map((r) => (
                    <tr key={r.id}>
                      <td>{r.tanggal.length === 10 ? tanggalLokal(r.tanggal) : r.tanggal}</td>
                      <td>{r.generus}</td>
                      <td>{r.isi}</td>
                      <td>{r.pencatat}</td>
                      <td className="sel-aksi">
                        <Tombol kecil varian="tipis" onClick={() => setKoreksi(r)}>
                          Koreksi
                        </Tombol>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </KeadaanData>
        )}
      </Kartu>
      <Kartu judul="Koreksi yang sudah dibuat">
        <KeadaanData hasil={terkirim} kosong={(d) => d.length === 0} teksKosong="Belum ada koreksi.">
          {(daftar) => (
            <table className="tabel">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Data</th>
                  <th>Untuk</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {daftar.map((k) => (
                  <tr key={k.id}>
                    <td>{tanggalLokal(k.tanggal)}</td>
                    <td>{label(LABEL_TABEL, k.tabel)}</td>
                    <td>{k.untuk}</td>
                    <td>{k.catatan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </KeadaanData>
      </Kartu>
      {koreksi ? <ModalKoreksi tabel={jenis} r={koreksi} tutup={() => setKoreksi(null)} /> : null}
    </>
  )
}

function ModalKoreksi(p: { tabel: NamaTabelSinkron; r: BarisKegiatan; tutup: () => void }) {
  const { db, aksi } = useApp()
  const [catatan, setCatatan] = useState('')
  return (
    <Modal
      judul="Buat koreksi"
      tutup={p.tutup}
      aksi={
        <>
          <Tombol varian="kedua" onClick={p.tutup}>
            Batal
          </Tombol>
          <Tombol
            onClick={async () => {
              const h = await aksi(() => buatKoreksi(db, { tabel: p.tabel, rekamanId: p.r.id, catatan }), 'Koreksi dibuat. Ikut terkirim pada Kirim Paket berikutnya.')
              if (h) p.tutup()
            }}
          >
            Simpan koreksi
          </Tombol>
        </>
      }
    >
      <div className="formulir">
        <p>
          {p.r.generus} · {p.r.tanggal} · {p.r.isi} (pencatat: {p.r.pencatat})
        </p>
        <AreaTeks label="Catatan koreksi" nilai={catatan} ubah={setCatatan} baris={4} placeholder="mis. Ahmad hadir, bukan alpa — mohon diperbaiki." />
      </div>
    </Modal>
  )
}
