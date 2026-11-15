// Bagian yang dipakai beberapa peran: Buka Berkas, pilih kelompok, Setor ke tingkat atas, usulan (generus baru, ubah status, pindah).
import { useEffect, useMemo, useState } from 'react'
import {
  ajukanUsulan,
  ambilWilayah,
  buatSetor,
  daftarUsulan,
  daftarWilayah,
  infoSinkronHp,
  kelompokDalamWilayah,
  setorAkhir,
  tanggalHariIni,
  tujuanSetor,
  KATEGORI_GENERUS,
  type Generus,
} from '@ppg/core'
import { useApp, useData } from '../konteks'
import { Isian, KeadaanData, Kartu, Konfirmasi, Lencana, Modal, Pilihan, Segmen, Tombol, AreaTeks } from '../komponen/ui'
import { label, LABEL_JENIS_USULAN, LABEL_KATEGORI, LABEL_STATUS_GENERUS, LABEL_STATUS_USULAN, waktuTeks } from '../utils/label'

/** Kartu "Buka Berkas" universal (PAKET, BALASAN, JADWAL, MATERI, BELAJAR). */
export function KartuBukaBerkas(p: { keterangan?: string }) {
  const { platform, bukaBerkas } = useApp()
  return (
    <Kartu judul="Buka Berkas">
      <p>{p.keterangan ?? 'Buka berkas PPG yang Anda terima lewat WA (bisa beberapa sekaligus).'}</p>
      <Tombol
        penuh
        varian="kedua"
        onClick={async () => {
          const d = await platform.pilihBerkas({ banyak: true })
          await bukaBerkas(d)
        }}
      >
        Buka Berkas
      </Tombol>
    </Kartu>
  )
}

/** Kelompok yang dijangkau profil aktif (pengurus desa/daerah → banyak kelompok). */
export function useKelompokSaya(): { id: string; nama: string }[] {
  const { db, profil } = useApp()
  return useData(
    () => kelompokDalamWilayah(db, profil.wilayah_id).map((id) => ({ id, nama: ambilWilayah(db, id)?.nama ?? id })),
    [profil.id],
  ).data ?? []
}

export function PilihKelompok(p: { nilai: string; ubah: (v: string) => void }) {
  const kel = useKelompokSaya()
  useEffect(() => {
    if (!p.nilai && kel[0]) p.ubah(kel[0].id)
  }, [kel, p])
  if (kel.length <= 1) return null
  return <Pilihan label="Kelompok" nilai={p.nilai} ubah={p.ubah} pilihan={kel.map((k) => ({ nilai: k.id, teks: k.nama }))} />
}

/** Setor ke tingkat atas (desa/kelompok/daerah sesuai token, `tujuanSetor`) + Setor Akhir (mubaligh). */
export function KartuSetorData(p: { setorAkhir?: boolean }) {
  const { db, kirimBerkas, aksi } = useApp()
  const info = useData(() => infoSinkronHp(db), [])
  const tujuan = useData(() => tujuanSetor(db)?.nama ?? 'Daerah', []).data ?? 'Daerah'
  const [tanyaAkhir, setTanyaAkhir] = useState(false)
  return (
    <Kartu judul={`Setor ke ${tujuan}`}>
      <KeadaanData hasil={info}>
        {(i) => (
          <>
            <p>
              {i.belumDisetor ? (
                <>
                  Ada <b>{i.belumDisetor}</b> data belum disetor.
                </>
              ) : (
                'Semua data sudah disetor.'
              )}
              <br />
              <small>Setor terakhir: {waktuTeks(i.terakhirSetor)} · Data dari atas terakhir: {waktuTeks(i.terakhirPaket)}</small>
              {i.belumSampaiDaerah ? (
                <>
                  <br />
                  <small>{i.belumSampaiDaerah} data sudah disetor tetapi belum dipastikan sampai daerah.</small>
                </>
              ) : null}
            </p>
            <Tombol
              penuh
              onClick={async () => {
                const b = await aksi(() => buatSetor(db))
                if (b) await kirimBerkas(b, `Berkas setoran siap. Kirim ke ${tujuan} lewat WA.`)
              }}
            >
              Setor ke {tujuan}
            </Tombol>
            <details className="lanjutan">
              <summary>Pilihan lain</summary>
              <p>Bila admin {tujuan} meminta, kirim ulang semua data yang pernah dicatat di HP ini.</p>
              <Tombol
                penuh
                varian="kedua"
                onClick={async () => {
                  const b = await aksi(() => buatSetor(db, { semua: true }))
                  if (b) await kirimBerkas(b, `Berkas berisi semua data siap dikirim ke ${tujuan}.`)
                }}
              >
                Kirim ulang semua data
              </Tombol>
              {p.setorAkhir ? (
                <>
                  <p>Setor Akhir dipakai saat tugas di kelompok ini selesai (serah terima ke mubaligh baru).</p>
                  <Tombol penuh varian="bahaya" onClick={() => setTanyaAkhir(true)}>
                    Setor Akhir
                  </Tombol>
                </>
              ) : null}
            </details>
          </>
        )}
      </KeadaanData>
      {tanyaAkhir ? (
        <Konfirmasi
          judul="Setor Akhir"
          pesan={`Berkas ini menandai semua data Anda sudah diserahkan ke ${tujuan} sebelum serah terima. Lanjutkan?`}
          ya="Buat Setor Akhir"
          bahaya
          batal={() => setTanyaAkhir(false)}
          setuju={async () => {
            setTanyaAkhir(false)
            const b = await aksi(() => setorAkhir(db))
            if (b) await kirimBerkas(b, `Berkas Setor Akhir siap. Kirim ke ${tujuan} lewat WA.`)
          }}
        />
      ) : null}
    </Kartu>
  )
}

/** Formulir usulan generus baru. */
export function FormGenerusBaru(p: { kelompokId: string; tutup: () => void }) {
  const { db, aksi } = useApp()
  const [nama, setNama] = useState('')
  const [jk, setJk] = useState<'L' | 'P' | null>(null)
  const [lahir, setLahir] = useState('')
  const [kategori, setKategori] = useState('')
  const [waliNama, setWaliNama] = useState('')
  const [waliHp, setWaliHp] = useState('')
  return (
    <Modal
      judul="Usulkan generus baru"
      tutup={p.tutup}
      aksi={
        <Tombol
          disabled={!nama.trim() || !jk}
          onClick={async () => {
            const r = await aksi(
              () =>
                ajukanUsulan(db, {
                  jenis: 'tambah_generus',
                  kelompokId: p.kelompokId,
                  data: {
                    nama: nama.trim(),
                    jenis_kelamin: jk,
                    tanggal_lahir: lahir || null,
                    kategori: kategori || null,
                    wali_nama: waliNama.trim() || null,
                    wali_no_hp: waliHp.trim() || null,
                  },
                }),
              'Usulan tersimpan. Akan dikirim ke admin saat Setor Data.',
            )
            if (r) p.tutup()
          }}
        >
          Simpan usulan
        </Tombol>
      }
    >
      <Isian label="Nama lengkap" nilai={nama} ubah={setNama} />
      <Segmen label="Jenis kelamin" nilai={jk} ubah={setJk} pilihan={[{ nilai: 'L', teks: 'Laki-laki' }, { nilai: 'P', teks: 'Perempuan' }]} />
      <Isian label="Tanggal lahir" type="date" nilai={lahir} ubah={setLahir} />
      <Pilihan label="Kategori" nilai={kategori} ubah={setKategori} kosong="Hitung dari umur" pilihan={KATEGORI_GENERUS.map((k) => ({ nilai: k, teks: LABEL_KATEGORI[k]! }))} />
      <Isian label="Nama orang tua/wali" nilai={waliNama} ubah={setWaliNama} />
      <Isian label="No. HP orang tua/wali" nilai={waliHp} ubah={setWaliHp} type="tel" inputMode="tel" placeholder="08…" />
    </Modal>
  )
}

/** Formulir usulan ubah status (mondok/aktif/…) atau pindah kelompok untuk satu generus. */
export function FormUsulanGenerus(p: { generus: Generus; jenis: 'ubah_status' | 'pindah_kelompok'; tutup: () => void }) {
  const { db, aksi } = useApp()
  const [status, setStatus] = useState(p.generus.status === 'aktif' ? 'mondok' : 'aktif')
  const [tujuan, setTujuan] = useState('')
  const [tanggal, setTanggal] = useState(tanggalHariIni())
  const [ket, setKet] = useState('')
  const kelompokLain = useMemo(
    () => daftarWilayah(db, { tingkat: 'kelompok' }).filter((w) => w.id !== p.generus.kelompok_id),
    [db, p.generus.kelompok_id],
  )
  const pindah = p.jenis === 'pindah_kelompok'
  return (
    <Modal
      judul={pindah ? `Pindah kelompok: ${p.generus.nama}` : `Ubah status: ${p.generus.nama}`}
      tutup={p.tutup}
      aksi={
        <Tombol
          disabled={pindah ? !tujuan : status === p.generus.status}
          onClick={async () => {
            const r = await aksi(
              () =>
                ajukanUsulan(db, {
                  jenis: p.jenis,
                  kelompokId: p.generus.kelompok_id,
                  data: pindah
                    ? { generus_id: p.generus.id, kelompok_tujuan_id: tujuan, tanggal, keterangan: ket.trim() || null }
                    : { generus_id: p.generus.id, status, tanggal, keterangan: ket.trim() || null },
                }),
              'Usulan tersimpan. Akan dikirim ke admin saat Setor Data.',
            )
            if (r) p.tutup()
          }}
        >
          Simpan usulan
        </Tombol>
      }
    >
      {pindah ? (
        kelompokLain.length ? (
          <Pilihan label="Kelompok tujuan" nilai={tujuan} ubah={setTujuan} kosong="Pilih kelompok" pilihan={kelompokLain.map((w) => ({ nilai: w.id, teks: w.nama }))} />
        ) : (
          <p>Daftar kelompok lain belum ada di HP ini. Buka berkas data terbaru dari admin dulu.</p>
        )
      ) : (
        <Pilihan
          label="Status baru"
          nilai={status}
          ubah={(v) => setStatus(v as Generus['status'])}
          pilihan={(['aktif', 'mondok', 'lulus_menikah', 'keluar'] as const).map((s) => ({ nilai: s, teks: LABEL_STATUS_GENERUS[s]! }))}
        />
      )}
      <Isian label="Mulai tanggal" type="date" nilai={tanggal} ubah={(v) => v && setTanggal(v)} />
      <AreaTeks label="Keterangan (boleh kosong)" nilai={ket} ubah={setKet} baris={2} placeholder={pindah ? 'mis. ikut orang tua pindah' : 'mis. mondok di Pesantren …'} />
    </Modal>
  )
}

/** Daftar usulan yang pernah diajukan dari HP ini untuk kelompok-kelompok tersebut. */
export function DaftarUsulan(p: { kelompokIds: string[] }) {
  const { db } = useApp()
  const usulan = useData(() => daftarUsulan(db, { kelompokIds: p.kelompokIds }), [p.kelompokIds.join(',')])
  return (
    <Kartu judul="Usulan ke admin">
      <KeadaanData hasil={usulan} kosong={(d) => d.length === 0} teksKosong="Belum ada usulan.">
        {(d) => (
          <ul className="daftar-sederhana">
            {d
              .slice()
              .reverse()
              .map((u) => (
                <li key={u.id}>
                  <span>
                    <b>{label(LABEL_JENIS_USULAN, u.jenis)}</b>
                    {typeof u.data.nama === 'string' ? `: ${u.data.nama}` : ''}
                    {u.alasan ? <small> — {u.alasan}</small> : null}
                  </span>
                  <Lencana warna={u.status === 'disetujui' ? 'hijau' : u.status === 'ditolak' ? 'merah' : 'kuning'}>{label(LABEL_STATUS_USULAN, u.status)}</Lencana>
                </li>
              ))}
          </ul>
        )}
      </KeadaanData>
    </Kartu>
  )
}

