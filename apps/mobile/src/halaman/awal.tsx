// Layar sebelum masuk: beri nama HP, Kode Perangkat (QR + kirim WA), aktifkan token (tempel/pindai), pilih profil (PIN).
import { useMemo, useState } from 'react'
import {
  adalahGalatPpg,
  adalahTokenSuperHp,
  aktifkanProfil,
  daftarProfil,
  inisialisasiPerangkat,
  kodePerangkatSaya,
  pilihProfil,
  statusProfil,
  uraiToken,
  type Db,
} from '@ppg/core'
import type { JenisToast } from '../konteks'
import type { BerkasMasuk, Platform } from '../platform'
import { PemindaiQr, QrBerseri } from '../komponen/qr'
import { AreaTeks, Isian, Kartu, Lencana, Modal, Spanduk, Tombol } from '../komponen/ui'
import { label, LABEL_ROLE, pesanGalat } from '../utils/label'

/** Pesan bila kode aktivasi untuk EXE (admin desa/kelompok, kurikulum) ditempel/dipindai di HP. */
export const PESAN_TOKEN_EXE = 'Kode ini untuk aplikasi laptop (EXE), bukan untuk HP.'
/** Fase 9: token Super Admin HP ditempel di aktivasi profil biasa. */
export const PESAN_TOKEN_SUPER = 'Kode ini untuk Super Admin HP.'

/** Apakah teks token adalah token Super Admin HP (tanpa memeriksa tanda tangan). */
function tokenSuper(teks: string): boolean {
  try {
    return adalahTokenSuperHp(uraiToken(teks).payload)
  } catch {
    return false
  }
}

type FnToast = (j: JenisToast, p: string) => void

export function LayarSambut(p: { db: Db; selesai: () => void; toast: FnToast; superAdmin?: () => void }) {
  const [nama, setNama] = useState('')
  return (
    <main className="layar-awal">
      <img className="logo" src="./logo.svg" alt="" aria-hidden="true" />
      <h1>Selamat datang di PPG Sorong</h1>
      <p className="keterangan">Aplikasi catatan pengajian untuk pengurus, mubaligh, generus, dan orang tua. Bisa dipakai tanpa internet.</p>
      <Kartu>
        <Isian label="Nama HP ini" nilai={nama} ubah={setNama} placeholder="mis. HP Bu Aminah" bantuan="Supaya admin/mubaligh tahu HP siapa ini." />
        <Tombol
          penuh
          disabled={!nama.trim()}
          onClick={async () => {
            try {
              await inisialisasiPerangkat(p.db, nama.trim())
              p.selesai()
            } catch (e) {
              p.toast('galat', pesanGalat(e))
            }
          }}
        >
          Lanjut
        </Tombol>
      </Kartu>
      {p.superAdmin ? (
        <Tombol penuh varian="tipis" onClick={p.superAdmin}>
          Aktifkan sebagai Super Admin HP
        </Tombol>
      ) : null}
    </main>
  )
}

export function LayarAwal(p: {
  db: Db
  platform: Platform
  toast: FnToast
  bukaBerkas: (d: BerkasMasuk[]) => Promise<unknown>
  batal?: () => void
  selesai: () => void
  /** Fase 9: masuk/aktifkan mode Super Admin HP. */
  superAdmin?: () => void
  adaSuper?: boolean
}) {
  const kode = useMemo(() => kodePerangkatSaya(p.db), [p.db])
  const [mode, setMode] = useState<'kode' | 'pindai' | 'tempel'>('kode')
  const [token, setToken] = useState('')
  const [pin, setPin] = useState('')
  const [untukExe, setUntukExe] = useState(false)
  const [untukSuper, setUntukSuper] = useState(false)

  const aktifkan = async () => {
    const t = token.trim()
    if (pin && !/^\d{4}$/.test(pin)) return p.toast('galat', 'PIN harus 4 angka.')
    setUntukExe(false)
    setUntukSuper(false)
    if (tokenSuper(t)) {
      setUntukSuper(true)
      p.toast('galat', PESAN_TOKEN_SUPER)
      return
    }
    try {
      const prof = await aktifkanProfil(p.db, t, pin ? { pin } : {})
      pilihProfil(p.db, prof.id, pin || undefined)
      p.toast('sukses', `Profil ${prof.nama} (${label(LABEL_ROLE, prof.role)}) siap dipakai.`)
      p.selesai()
    } catch (e) {
      if (adalahGalatPpg(e) && e.kode === 'TOKEN_UNTUK_EXE') {
        setUntukExe(true)
        p.toast('galat', PESAN_TOKEN_EXE)
        return
      }
      p.toast('galat', pesanGalat(e))
    }
  }

  return (
    <main className="layar-awal">
      <header className="judul-halaman">
        {p.batal ? (
          <button type="button" className="tombol-kembali" aria-label="Kembali" onClick={p.batal}>
            ‹
          </button>
        ) : null}
        <div>
          <h1>{p.batal ? 'Tambah Profil' : 'Kode Perangkat'}</h1>
          <p className="keterangan">Langkah 1: kirim kode HP ini. Langkah 2: masukkan token yang Anda terima.</p>
        </div>
      </header>

      <Kartu judul="1. Kode HP ini">
        <p>
          Pengurus & mubaligh: kirim ke <b>admin</b>. Generus & orang tua: tunjukkan atau kirim ke <b>mubaligh</b>.
        </p>
        <div className="kotak-qr">
          <QrBerseri teks={kode} label="QR Kode Perangkat" />
        </div>
        <details className="teks-kode">
          <summary>Lihat teks kode</summary>
          <code data-testid="kode-perangkat">{kode}</code>
        </details>
        <div className="baris-tombol">
          <Tombol varian="wa" onClick={() => p.platform.bagikanTeks(kode, 'Kode Perangkat PPG')}>
            Kirim lewat WA
          </Tombol>
          <Tombol
            varian="kedua"
            onClick={async () => {
              await p.platform.salinTeks(kode)
              p.toast('sukses', 'Kode disalin.')
            }}
          >
            Salin
          </Tombol>
        </div>
      </Kartu>

      <Kartu judul="2. Masukkan token">
        {untukExe ? (
          <Spanduk jenis="peringatan">
            <b>{PESAN_TOKEN_EXE}</b> Kode aktivasi Admin Desa, Admin Kelompok, dan Kurikulum ditempel di aplikasi PPG Sorong di laptop
            (menu “Aktifkan dengan kode”). Untuk HP, mintalah token pengurus/mubaligh dari admin desa, atau token generus/orang tua dari
            mubaligh.
          </Spanduk>
        ) : null}
        {untukSuper ? (
          <Spanduk jenis="peringatan">
            <b>{PESAN_TOKEN_SUPER}</b> Tekan “Aktifkan sebagai Super Admin HP” di bawah, lalu tempel token itu di sana (Kode Perangkat Super Admin
            berbeda dengan kode HP di atas).
          </Spanduk>
        ) : null}
        {mode === 'pindai' ? (
          <PemindaiQr
            awalan="PPGT1."
            pemindai={p.platform.pemindai}
            labelTempel="Atau tempel token di sini"
            batal={() => setMode('kode')}
            dapat={(t) => {
              setToken(t)
              setMode('tempel')
            }}
          />
        ) : mode === 'tempel' ? (
          <>
            <AreaTeks label="Token" nilai={token} ubah={setToken} baris={4} placeholder="PPGT1.…" />
            <Isian label="PIN 4 angka (boleh kosong)" nilai={pin} ubah={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))} type="password" inputMode="numeric" maxLength={4} bantuan="PIN menjaga profil ini bila HP dipakai bersama." />
            <div className="baris-tombol">
              <Tombol varian="kedua" onClick={() => setMode('kode')}>
                Batal
              </Tombol>
              <Tombol disabled={!token.trim()} onClick={aktifkan}>
                Aktifkan
              </Tombol>
            </div>
          </>
        ) : (
          <div className="tumpuk">
            <Tombol penuh onClick={() => setMode('pindai')}>
              Pindai QR Token
            </Tombol>
            <Tombol penuh varian="kedua" onClick={() => setMode('tempel')}>
              Tempel Token
            </Tombol>
            <Tombol
              penuh
              varian="tipis"
              onClick={async () => {
                const d = await p.platform.pilihBerkas({ banyak: true })
                await p.bukaBerkas(d)
              }}
            >
              Buka Berkas
            </Tombol>
          </div>
        )}
      </Kartu>

      {p.superAdmin ? (
        <Kartu judul="Super Admin HP">
          <p>Untuk petugas pendaftaran seluruh daerah (atas izin Admin Daerah). Data Super Admin terpisah dan dikunci kata sandi.</p>
          <Tombol penuh varian="kedua" onClick={p.superAdmin}>
            {p.adaSuper ? 'Masuk Super Admin HP' : 'Aktifkan sebagai Super Admin HP'}
          </Tombol>
        </Kartu>
      ) : null}
    </main>
  )
}

export function LayarPilihProfil(p: { db: Db; toast: FnToast; pilih: () => void; tambah: () => void; adaSuper?: boolean; bukaSuper?: () => void }) {
  const daftar = daftarProfil(p.db)
  const [minta, setMinta] = useState<{ id: string; nama: string } | null>(null)
  const [pin, setPin] = useState('')

  const masuk = (id: string, pinIsi?: string) => {
    try {
      pilihProfil(p.db, id, pinIsi)
      p.pilih()
    } catch (e) {
      p.toast('galat', pesanGalat(e))
    }
  }

  return (
    <main className="layar-awal">
      <header className="judul-halaman">
        <div>
          <h1>Pilih Profil</h1>
          <p className="keterangan">Siapa yang memakai HP sekarang?</p>
        </div>
      </header>
      <ul className="daftar-profil">
        {daftar.map((x) => {
          const st = statusProfil(x)
          return (
            <li key={x.id}>
              <button
                type="button"
                className="kartu-profil"
                onClick={() => {
                  if (x.ada_pin) {
                    setPin('')
                    setMinta({ id: x.id, nama: x.nama })
                  } else masuk(x.id)
                }}
              >
                <span className="avatar" aria-hidden="true">{x.nama.slice(0, 1).toUpperCase()}</span>
                <span className="teks">
                  <strong>{x.nama}</strong>
                  <small>{label(LABEL_ROLE, x.role)}</small>
                </span>
                {x.ada_pin ? <Lencana>PIN</Lencana> : null}
                {st.kode === 'DIBEKUKAN' ? <Lencana warna="kuning">Mondok</Lencana> : null}
                {st.kode === 'DICABUT' ? <Lencana warna="merah">Tidak berlaku</Lencana> : null}
                {st.kode === 'KEDALUWARSA' ? <Lencana warna="merah">Habis masa</Lencana> : null}
              </button>
            </li>
          )
        })}
        {p.adaSuper && p.bukaSuper ? (
          <li>
            <button type="button" className="kartu-profil" onClick={p.bukaSuper}>
              <span className="avatar" aria-hidden="true">★</span>
              <span className="teks">
                <strong>Super Admin HP</strong>
                <small>Pendaftaran seluruh daerah</small>
              </span>
              <Lencana warna="teal">Sandi</Lencana>
            </button>
          </li>
        ) : null}
      </ul>
      <Tombol penuh varian="kedua" onClick={p.tambah}>
        + Tambah Profil
      </Tombol>
      {minta ? (
        <Modal
          judul={`PIN ${minta.nama}`}
          tutup={() => setMinta(null)}
          aksi={
            <Tombol disabled={pin.length !== 4} onClick={() => masuk(minta.id, pin)}>
              Masuk
            </Tombol>
          }
        >
          <Isian label="PIN" nilai={pin} ubah={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))} type="password" inputMode="numeric" maxLength={4} />
        </Modal>
      ) : null}
    </main>
  )
}
