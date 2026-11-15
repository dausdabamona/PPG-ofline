// Layar peran Generus: Target (Materi yang perlu dituntaskan) · Materiku · Catat Kemajuan · Jadwal · Setor (Setor Belajar, Buka Berkas).
import { useState } from 'react'
import { buatBelajar, catatKemajuan, infoSinkronHp, jadwalPekan, jumlahBelumDisetorBelajar, statusProfil, tambahHari, tanggalHariIni, type MateriGenerus } from '@ppg/core'
import { useApp, useData } from '../konteks'
import type { PropHalaman } from '../kerangka'
import { cariMateri, DaftarMateri, FormKemajuan, keDataKemajuan, KEMAJUAN_KOSONG, PemilihMateri, RincianMateri, useMateriGenerus, type IsianKemajuan } from '../komponen/materi'
import { JudulHalaman, KeadaanData, Kartu, Kosong, Lencana, Modal, Tombol } from '../komponen/ui'
import { tanggalTeks, waktuTeks } from '../utils/label'
import { MateriPerluDituntaskan } from '../komponen/tuntas'
import { KartuBukaBerkas } from './bersama'

function useGenerusSaya(): string | undefined {
  const { profil } = useApp()
  return profil.generus_ids[0]
}

/** Isian catat kemajuan untuk satu materi (dipakai di tab Catat & dari rincian materi). */
function IsiCatat(p: { materiId: string; tipe: string | undefined; selesai?: () => void }) {
  const { db, profil, aksi } = useApp()
  const [isian, setIsian] = useState<IsianKemajuan>(KEMAJUAN_KOSONG)
  const boleh = statusProfil(profil).bolehMencatat
  return (
    <>
      <FormKemajuan tipe={p.tipe} nilai={isian} ubah={setIsian} labelCatatan="Pesan untuk mubaligh (boleh kosong)" />
      <Tombol
        penuh
        disabled={!boleh}
        onClick={async () => {
          const r = await aksi(() => catatKemajuan(db, profil.id, keDataKemajuan(p.materiId, isian)), 'Catatan tersimpan. Jangan lupa Setor ke mubaligh.')
          if (r) {
            setIsian(KEMAJUAN_KOSONG)
            p.selesai?.()
          }
        }}
      >
        Simpan catatan
      </Tombol>
    </>
  )
}

/** Layar pertama murid: materi yang perlu dituntaskan semester ini. */
export function TargetGenerus(p: PropHalaman) {
  const { profil } = useApp()
  const gid = useGenerusSaya()
  return (
    <>
      <JudulHalaman judul="Materi yang perlu dituntaskan" keterangan={profil.nama} />
      {gid ? (
        <MateriPerluDituntaskan generusId={gid} teksKosong="Data belum ada. Buka berkas balasan atau materi dari mubaligh di menu Setor." />
      ) : null}
      <div className="tumpuk">
        <Tombol penuh varian="kedua" onClick={() => p.pergi('catat')}>
          Catat yang sudah kupelajari
        </Tombol>
      </div>
    </>
  )
}

export function Materiku(_p: PropHalaman) {
  const { profil } = useApp()
  const gid = useGenerusSaya()
  const materi = useMateriGenerus(gid)
  const [buka, setBuka] = useState<MateriGenerus | null>(null)
  const [catat, setCatat] = useState<MateriGenerus | null>(null)
  return (
    <>
      <JudulHalaman judul="Materiku" keterangan={profil.nama} />
      <KeadaanData hasil={materi} kosong={(d) => !d || d.ringkasan.total === 0} teksKosong="Daftar materi belum ada. Buka berkas balasan atau materi dari mubaligh di menu Setor.">
        {(d) => <DaftarMateri data={d!} buka={setBuka} />}
      </KeadaanData>
      {buka ? (
        <RincianMateri
          m={buka}
          tutup={() => setBuka(null)}
          catat={
            statusProfil(profil).bolehMencatat && buka.status !== 'selesai'
              ? () => {
                  setCatat(buka)
                  setBuka(null)
                }
              : undefined
          }
        />
      ) : null}
      {catat ? (
        <Modal judul={`Catat: ${catat.nama}`} tutup={() => setCatat(null)}>
          <IsiCatat materiId={catat.id} tipe={catat.tipe} selesai={() => setCatat(null)} />
        </Modal>
      ) : null}
    </>
  )
}

export function CatatKemajuan() {
  const { profil } = useApp()
  const gid = useGenerusSaya()
  const materi = useMateriGenerus(gid)
  const target = materi.data?.bidang.flatMap((b) => b.kategori.flatMap((k) => k.materi.filter((m) => m.target)))[0]
  const [pilih, setPilih] = useState('')
  const materiId = pilih || target?.id || ''
  const m = cariMateri(materi.data, materiId)
  const menunggu = materi.data?.bidang.flatMap((b) => b.kategori.flatMap((k) => k.materi.filter((x) => x.status === 'diajukan'))) ?? []
  const boleh = statusProfil(profil).bolehMencatat
  return (
    <>
      <JudulHalaman judul="Catat Kemajuan" keterangan="Tulis materi yang sudah kamu pelajari, lalu setor ke mubaligh." />
      <KeadaanData hasil={materi} kosong={(d) => !d || d.ringkasan.total === 0} teksKosong="Daftar materi belum ada.">
        {(d) => (
          <Kartu>
            {!boleh ? <p className="keterangan">Pencatatan sedang dihentikan untuk profil ini.</p> : null}
            <PemilihMateri data={d!} nilai={materiId} ubah={setPilih} />
            {m ? <IsiCatat key={m.id} materiId={m.id} tipe={m.tipe} /> : <Kosong teks="Pilih materi dulu." />}
          </Kartu>
        )}
      </KeadaanData>
      <Kartu judul="Menunggu disimak mubaligh">
        {menunggu.length ? (
          <ul className="daftar-sederhana">
            {menunggu.map((x) => (
              <li key={x.id}>
                <span>{x.nama}</span>
                <Lencana warna="kuning">{tanggalTeks(x.kemajuan?.tanggal)}</Lencana>
              </li>
            ))}
          </ul>
        ) : (
          <p className="keterangan">Belum ada.</p>
        )}
      </Kartu>
    </>
  )
}

export function JadwalGenerus() {
  const { db, profil } = useApp()
  const [acuan, setAcuan] = useState(tanggalHariIni())
  const j = useData(() => jadwalPekan(db, profil.wilayah_id, acuan), [profil.id, acuan])
  const hariIni = tanggalHariIni()
  return (
    <>
      <JudulHalaman judul="Jadwal" keterangan="Jadwal pengajian pekan ini." />
      <div className="nav-pekan">
        <Tombol kecil varian="kedua" onClick={() => setAcuan(tambahHari(acuan, -7))} label="Pekan sebelumnya">
          ‹
        </Tombol>
        <span>{j.data ? `${tanggalTeks(j.data.mulai)} – ${tanggalTeks(j.data.selesai)}` : ''}</span>
        <Tombol kecil varian="kedua" onClick={() => setAcuan(tambahHari(acuan, 7))} label="Pekan berikutnya">
          ›
        </Tombol>
      </div>
      <KeadaanData hasil={j} kosong={(d) => d.acara.length === 0} teksKosong="Belum ada jadwal pekan ini.">
        {(d) => (
          <ul className="daftar-jadwal">
            {d.acara.map((a, i) => (
              <li key={`${a.tanggal}-${i}`} className={`${a.dibatalkan ? 'batal' : ''}${a.tanggal === hariIni ? ' hari-ini' : ''}`}>
                <div className="tgl">
                  <b>{a.hari}</b>
                  <small>{tanggalTeks(a.tanggal)}</small>
                </div>
                <div>
                  <strong>{a.judul}</strong>
                  <small>
                    {a.jam ?? ''}
                    {a.tempat ? ` · ${a.tempat}` : ''}
                    {a.keterangan && a.jenis === 'tambahan' ? ` · ${a.keterangan}` : ''}
                  </small>
                </div>
                {a.dibatalkan ? <Lencana warna="merah">Batal</Lencana> : a.jenis === 'tambahan' ? <Lencana warna="teal">Tambahan</Lencana> : null}
              </li>
            ))}
          </ul>
        )}
      </KeadaanData>
    </>
  )
}

export function SetorGenerus() {
  const { db, profil, aksi, kirimBerkas } = useApp()
  const n = useData(() => jumlahBelumDisetorBelajar(db, profil.wilayah_id), [profil.id])
  const info = useData(() => infoSinkronHp(db), [])
  return (
    <>
      <JudulHalaman judul="Setor" keterangan="Kirim catatan belajar ke mubaligh, dan buka balasannya." />
      <Kartu judul="Setor Belajar">
        <KeadaanData hasil={n}>
          {(x) => (
            <p>
              {x ? (
                <>
                  Ada <b>{x}</b> catatan belum disetor.
                </>
              ) : (
                'Semua catatan sudah disetor.'
              )}
              <br />
              <small>Setor terakhir: {waktuTeks(info.data?.terakhirBelajar)} · Balasan terakhir: {waktuTeks(info.data?.terakhirBalasan)}</small>
            </p>
          )}
        </KeadaanData>
        <Tombol
          penuh
          onClick={async () => {
            const b = await aksi(() => buatBelajar(db, { kelompokId: profil.wilayah_id }))
            if (b) await kirimBerkas(b, 'Berkas setoran siap. Kirim ke mubaligh lewat WA.')
          }}
        >
          Setor Belajar
        </Tombol>
      </Kartu>
      <KartuBukaBerkas keterangan="Buka berkas balasan atau jadwal dari mubaligh, atau berkas materi." />
    </>
  )
}
