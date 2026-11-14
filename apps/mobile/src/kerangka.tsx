// Kerangka setelah masuk: kepala (profil), spanduk status, indikator setor, isi halaman, navigasi bawah sesuai peran.
import { useEffect, useState, type ReactNode } from 'react'
import { infoSinkronHp, statusProfil, type Role } from '@ppg/core'
import { useApp, useData } from './konteks'
import { Spanduk, Tombol } from './komponen/ui'
import { label, LABEL_ROLE } from './utils/label'
import { HalamanAkun } from './halaman/akun'
import { BerandaPengurus, DataPengurus, RekapPengurus, SinkronPengurus } from './halaman/pengurus'
import { BerandaMubaligh, GenerusMubaligh, LainnyaMubaligh, SetoranGenerus, SimakLangsung } from './halaman/mubaligh'
import { CatatKemajuan, JadwalGenerus, Materiku, SetorGenerus } from './halaman/generus'
import { BerkasWali, KehadiranWali, KemajuanWali, LaporanWali } from './halaman/wali'
import { HalamanPresensi } from './halaman/bersama'

export interface PropHalaman {
  pergi: (tab: string) => void
}

interface Tab {
  kunci: string
  teks: string
  ikon: string
  isi: (p: PropHalaman) => ReactNode
}

const TAB: Record<Role, Tab[]> = {
  pengurus: [
    { kunci: 'beranda', teks: 'Beranda', ikon: '⌂', isi: (p) => <BerandaPengurus {...p} /> },
    { kunci: 'presensi', teks: 'Presensi', ikon: '✓', isi: () => <HalamanPresensi /> },
    { kunci: 'data', teks: 'Data', ikon: '☺', isi: () => <DataPengurus /> },
    { kunci: 'rekap', teks: 'Rekap', ikon: '▤', isi: () => <RekapPengurus /> },
    { kunci: 'sinkron', teks: 'Sinkron', ikon: '⇅', isi: () => <SinkronPengurus /> },
  ],
  mubaligh: [
    { kunci: 'beranda', teks: 'Beranda', ikon: '⌂', isi: (p) => <BerandaMubaligh {...p} /> },
    { kunci: 'setoran', teks: 'Setoran', ikon: '⇩', isi: () => <SetoranGenerus /> },
    { kunci: 'simak', teks: 'Simak', ikon: '♪', isi: () => <SimakLangsung /> },
    { kunci: 'generus', teks: 'Generus', ikon: '☺', isi: () => <GenerusMubaligh /> },
    { kunci: 'lainnya', teks: 'Lainnya', ikon: '≡', isi: () => <LainnyaMubaligh /> },
  ],
  generus: [
    { kunci: 'materi', teks: 'Materiku', ikon: '❖', isi: (p) => <Materiku {...p} /> },
    { kunci: 'catat', teks: 'Catat', ikon: '✎', isi: () => <CatatKemajuan /> },
    { kunci: 'jadwal', teks: 'Jadwal', ikon: '◷', isi: () => <JadwalGenerus /> },
    { kunci: 'setor', teks: 'Setor', ikon: '⇧', isi: () => <SetorGenerus /> },
  ],
  wali: [
    { kunci: 'laporan', teks: 'Laporan', ikon: '▤', isi: () => <LaporanWali /> },
    { kunci: 'kemajuan', teks: 'Kemajuan', ikon: '❖', isi: () => <KemajuanWali /> },
    { kunci: 'hadir', teks: 'Kehadiran', ikon: '✓', isi: () => <KehadiranWali /> },
    { kunci: 'berkas', teks: 'Berkas', ikon: '⇅', isi: () => <BerkasWali /> },
  ],
}

/** Tab tujuan setor per peran (untuk tombol pengingat). */
const TAB_SETOR: Record<Role, string> = { pengurus: 'sinkron', mubaligh: 'lainnya', generus: 'setor', wali: 'berkas' }

function IndikatorSetor(p: { pergi: (tab: string) => void }) {
  const { db, profil } = useApp()
  const info = useData(() => infoSinkronHp(db), [db])
  if (!info.data || profil.role === 'wali') return null
  const generus = profil.role === 'generus'
  const n = generus ? info.data.belumDisetorBelajar : info.data.belumDisetor
  const ingat = generus ? info.data.perluPengingatBelajar : info.data.perluPengingat
  const hari = generus ? info.data.hariSejakBelajar : info.data.hariSejakSetor
  if (!n) return null
  return (
    <div className={`indikator-setor${ingat ? ' pengingat' : ''}`} role="status">
      <span>
        Ada <b>{n}</b> data belum disetor.
        {ingat ? (
          <>
            {' '}
            {hari === null ? 'Belum pernah setor.' : `Sudah ${hari} hari sejak setor terakhir.`} Yuk setor sekarang.
          </>
        ) : null}
      </span>
      <Tombol kecil varian={ingat ? 'utama' : 'kedua'} onClick={() => p.pergi(TAB_SETOR[profil.role])}>
        Setor
      </Tombol>
    </div>
  )
}

export function Kerangka(p: { akun: boolean }) {
  const { profil, ke } = useApp()
  const daftarTab = TAB[profil.role]
  const [tab, setTab] = useState(daftarTab[0]!.kunci)
  // ganti profil (peran lain) → kembali ke tab pertama
  useEffect(() => {
    setTab(TAB[profil.role][0]!.kunci)
  }, [profil.id, profil.role])
  const aktif = daftarTab.find((t) => t.kunci === tab) ?? daftarTab[0]!
  const st = statusProfil(profil)

  return (
    <div className="kerangka">
      <header className="kepala-app">
        <span className="merek"><img className="merek-ikon" src="./logo.svg" alt="" aria-hidden="true" />PPG Sorong</span>
        <button type="button" className="chip-profil" onClick={() => ke(p.akun ? 'utama' : 'akun')} aria-label={`Profil: ${profil.nama}`}>
          <span className="avatar kecil" aria-hidden="true">{profil.nama.slice(0, 1).toUpperCase()}</span>
          <span>
            {profil.nama}
            <small>{label(LABEL_ROLE, profil.role)}</small>
          </span>
        </button>
      </header>
      <main className="isi">
        {st.kode === 'DIBEKUKAN' ? (
          <Spanduk jenis="peringatan">
            {profil.role === 'generus' || profil.role === 'wali'
              ? 'Sedang mondok — pencatatan dihentikan sementara.'
              : 'Profil ini dibekukan admin — pencatatan dihentikan sementara.'}
          </Spanduk>
        ) : null}
        {st.kode === 'DICABUT' ? <Spanduk jenis="bahaya">Profil ini sudah tidak berlaku. Data lama tetap bisa dilihat.</Spanduk> : null}
        {st.kode === 'KEDALUWARSA' ? <Spanduk jenis="bahaya">Masa berlaku profil habis. Minta token baru untuk mencatat lagi.</Spanduk> : null}
        {p.akun ? (
          <HalamanAkun />
        ) : (
          <>
            <IndikatorSetor pergi={setTab} />
            {aktif.isi({ pergi: setTab })}
          </>
        )}
      </main>
      <nav className="nav-bawah" aria-label="Menu utama">
        {daftarTab.map((t) => (
          <button
            key={t.kunci}
            type="button"
            aria-current={!p.akun && t.kunci === aktif.kunci ? 'page' : undefined}
            onClick={() => {
              setTab(t.kunci)
              if (p.akun) ke('utama')
            }}
          >
            <span className="ikon" aria-hidden="true">{t.ikon}</span>
            <span>{t.teks}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
