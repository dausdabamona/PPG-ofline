// Kerangka setelah masuk: kepala (profil), spanduk status, indikator setor, isi halaman, navigasi bawah sesuai peran.
import { useEffect, useState, type ReactNode } from 'react'
import { infoSinkronHp, statusProfil, type Role } from '@ppg/core'
import { useApp, useData } from './konteks'
import { Spanduk, Tombol } from './komponen/ui'
import { label, LABEL_ROLE } from './utils/label'
import { HalamanAkun } from './halaman/akun'
import { BerandaPengurus, DataPengurus, RekapPengurus, SinkronPengurus } from './halaman/pengurus'
import { JadwalMubaligh, LainnyaMubaligh, MateriKelas } from './halaman/mubaligh'
import { CatatKemajuan, JadwalGenerus, Materiku, SetorGenerus, TargetGenerus } from './halaman/generus'
import { BerkasWali, KehadiranWali, KemajuanWali, LaporanWali, TargetWali } from './halaman/wali'
import { HalamanAbsen } from './halaman/absen'
import { PESAN_TOKEN_EXE } from './halaman/awal'

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
    { kunci: 'absen', teks: 'Absen', ikon: '✓', isi: () => <HalamanAbsen /> },
    { kunci: 'data', teks: 'Data', ikon: '☺', isi: () => <DataPengurus /> },
    { kunci: 'rekap', teks: 'Rekap', ikon: '▤', isi: () => <RekapPengurus /> },
    { kunci: 'sinkron', teks: 'Sinkron', ikon: '⇅', isi: () => <SinkronPengurus /> },
  ],
  // v3: mubaligh disederhanakan menjadi 4 menu (§14)
  mubaligh: [
    { kunci: 'absen', teks: 'Absen', ikon: '✓', isi: () => <SapaanAbsen /> },
    { kunci: 'jadwal', teks: 'Jadwal', ikon: '◷', isi: () => <JadwalMubaligh /> },
    { kunci: 'materi', teks: 'Materi', ikon: '❖', isi: () => <MateriKelas /> },
    { kunci: 'lainnya', teks: 'Lainnya', ikon: '≡', isi: () => <LainnyaMubaligh /> },
  ],
  // v3: layar pertama murid & orang tua = "Materi yang perlu dituntaskan"
  generus: [
    { kunci: 'target', teks: 'Target', ikon: '★', isi: (p) => <TargetGenerus {...p} /> },
    { kunci: 'materi', teks: 'Materiku', ikon: '❖', isi: (p) => <Materiku {...p} /> },
    { kunci: 'catat', teks: 'Catat', ikon: '✎', isi: () => <CatatKemajuan /> },
    { kunci: 'jadwal', teks: 'Jadwal', ikon: '◷', isi: () => <JadwalGenerus /> },
    { kunci: 'setor', teks: 'Setor', ikon: '⇧', isi: () => <SetorGenerus /> },
  ],
  wali: [
    { kunci: 'target', teks: 'Target', ikon: '★', isi: () => <TargetWali /> },
    { kunci: 'laporan', teks: 'Laporan', ikon: '▤', isi: () => <LaporanWali /> },
    { kunci: 'kemajuan', teks: 'Kemajuan', ikon: '❖', isi: () => <KemajuanWali /> },
    { kunci: 'hadir', teks: 'Kehadiran', ikon: '✓', isi: () => <KehadiranWali /> },
    { kunci: 'berkas', teks: 'Berkas', ikon: '⇅', isi: () => <BerkasWali /> },
  ],
  // v3: peran EXE (desa/kelompok/kurikulum) tidak bisa diaktifkan di HP (ditolak core); bila ada, tampil pesan saja
  admin: [{ kunci: 'exe', teks: 'Info', ikon: 'ⓘ', isi: () => <PesanPeranExe /> }],
  kurikulum: [{ kunci: 'exe', teks: 'Info', ikon: 'ⓘ', isi: () => <PesanPeranExe /> }],
}

/** Tab tujuan setor per peran (untuk tombol pengingat); mubaligh → Absen (kartu "Setor sekarang"). */
const TAB_SETOR: Record<Role, string> = { pengurus: 'sinkron', mubaligh: 'absen', generus: 'setor', wali: 'berkas', admin: 'exe', kurikulum: 'exe' }

function SapaanAbsen() {
  const { profil } = useApp()
  return <HalamanAbsen sapaan={`Assalamu'alaikum, ${profil.nama}`} />
}

function PesanPeranExe() {
  return (
    <div className="pesan-exe">
      <Spanduk jenis="peringatan">
        <b>{PESAN_TOKEN_EXE}</b> Profil ini hanya bisa dipakai di aplikasi PPG Sorong di laptop. Hapus profil ini di menu Profil & HP.
      </Spanduk>
    </div>
  )
}

function IndikatorSetor(p: { pergi: (tab: string) => void; tab: string }) {
  const { db, profil } = useApp()
  const info = useData(() => infoSinkronHp(db), [db])
  // di tab Absen (dan Beranda pengurus) sudah ada kartu pengingat setor
  if (!info.data || profil.role === 'wali' || profil.role === 'admin' || profil.role === 'kurikulum' || p.tab === 'absen' || (profil.role === 'pengurus' && p.tab === 'beranda')) return null
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
  // ketuk ulang menu yang sedang aktif → kembali ke tampilan awal menu itu
  const [ulang, setUlang] = useState(0)
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
            <IndikatorSetor pergi={setTab} tab={aktif.kunci} />
            <div className="isi-tab" key={`${aktif.kunci}-${ulang}`}>
              {aktif.isi({ pergi: setTab })}
            </div>
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
              if (!p.akun && t.kunci === aktif.kunci) setUlang((x) => x + 1)
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
