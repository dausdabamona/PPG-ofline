// Layar Profil & HP: ganti/tambah profil, PIN, hapus profil, Kode Perangkat, cadangkan & pulihkan data HP.
import { useMemo, useState } from 'react'
import { aturPin, buatCadanganHp, bukaCadanganHp, daftarProfil, hapusProfil, jenisCadanganHp, kodePerangkatSaya, PANJANG_SANDI_CADANGAN_MIN, statusProfil } from '@ppg/core'
import { useApp, useData } from '../konteks'
import type { BerkasMasuk } from '../platform'
import { QrBerseri } from '../komponen/qr'
import { Isian, JudulHalaman, KeadaanData, Kartu, Konfirmasi, Lencana, Modal, Tombol } from '../komponen/ui'
import { label, LABEL_ROLE, pesanGalat, tanggalTeks } from '../utils/label'

export function HalamanAkun() {
  const { db, profil, platform, aksi, ke, kirimBerkas, gantiDb, toast } = useApp()
  const semua = useData(() => daftarProfil(db), [])
  const kode = useMemo(() => kodePerangkatSaya(db), [db])
  const [pinForm, setPinForm] = useState(false)
  const [pinLama, setPinLama] = useState('')
  const [pinBaru, setPinBaru] = useState('')
  const [tanyaHapus, setTanyaHapus] = useState(false)
  const [pulih, setPulih] = useState<(BerkasMasuk & { terenkripsi: boolean }) | null>(null)
  const [formCadangan, setFormCadangan] = useState(false)
  const [sandi, setSandi] = useState('')
  const [ulang, setUlang] = useState('')
  const tutupCadangan = () => {
    setFormCadangan(false)
    setSandi('')
    setUlang('')
  }
  const st = statusProfil(profil)
  const angka = (v: string) => v.replace(/\D/g, '').slice(0, 4)

  return (
    <>
      <JudulHalaman judul="Profil & HP" kembali={() => ke('utama')} />
      <Kartu judul={profil.nama}>
        <p>
          {label(LABEL_ROLE, profil.role)} · berlaku sampai {tanggalTeks(profil.berlaku_sampai)}{' '}
          {st.kode ? <Lencana warna={st.kode === 'DIBEKUKAN' ? 'kuning' : 'merah'}>{st.alasan}</Lencana> : null}
        </p>
        <div className="tumpuk">
          <Tombol penuh varian="kedua" onClick={() => setPinForm(true)}>
            {profil.ada_pin ? 'Ubah / hapus PIN' : 'Pasang PIN'}
          </Tombol>
          <Tombol penuh varian="tipis" onClick={() => setTanyaHapus(true)}>
            Hapus profil ini dari HP
          </Tombol>
        </div>
      </Kartu>

      <Kartu judul="Profil di HP ini">
        <KeadaanData hasil={semua}>
          {(d) => (
            <ul className="daftar-sederhana">
              {d.map((x) => (
                <li key={x.id}>
                  <span>
                    <b>{x.nama}</b> <small>· {label(LABEL_ROLE, x.role)}</small>
                  </span>
                  {x.id === profil.id ? <Lencana warna="teal">Dipakai</Lencana> : null}
                </li>
              ))}
            </ul>
          )}
        </KeadaanData>
        <div className="baris-tombol">
          <Tombol varian="kedua" onClick={() => ke('pilih')} disabled={(semua.data?.length ?? 0) < 2}>
            Ganti profil
          </Tombol>
          <Tombol onClick={() => ke('tambah')}>+ Tambah Profil</Tombol>
        </div>
      </Kartu>

      <Kartu judul="Kode Perangkat">
        <p>Dipakai untuk meminta token baru (mis. untuk anak lain atau perpanjangan).</p>
        <div className="kotak-qr">
          <QrBerseri teks={kode} label="QR Kode Perangkat" />
        </div>
        <div className="baris-tombol">
          <Tombol varian="wa" onClick={() => platform.bagikanTeks(kode, 'Kode Perangkat PPG')}>
            Kirim lewat WA
          </Tombol>
          <Tombol
            varian="kedua"
            onClick={async () => {
              await platform.salinTeks(kode)
              toast('sukses', 'Kode disalin.')
            }}
          >
            Salin
          </Tombol>
        </div>
      </Kartu>

      <Kartu judul="Cadangan data HP">
        <p>
          Simpan salinan seluruh data HP ini (misalnya ke Google Drive atau WA “pesan untuk diri sendiri”) agar bisa dipulihkan bila HP rusak atau
          ganti HP. Cadangan dikunci dengan <b>kata sandi cadangan</b> — catat sandinya; tanpa sandi, cadangan tidak bisa dibuka.
        </p>
        <div className="tumpuk">
          <Tombol penuh onClick={() => setFormCadangan(true)}>
            Cadangkan data HP
          </Tombol>
          <Tombol
            penuh
            varian="kedua"
            onClick={async () => {
              const [b] = await platform.pilihBerkas({ banyak: false })
              if (!b) return
              const jenis = jenisCadanganHp(b.bytes)
              if (jenis === 'bukan') return toast('galat', `“${b.nama ?? 'Berkas'}” bukan cadangan data HP PPG Sorong.`)
              setSandi('')
              setPulih({ ...b, terenkripsi: jenis === 'terenkripsi' })
            }}
          >
            Pulihkan dari cadangan
          </Tombol>
        </div>
      </Kartu>

      {formCadangan ? (
        <Modal
          judul="Buat cadangan data HP"
          tutup={tutupCadangan}
          aksi={
            <Tombol
              disabled={sandi.length < PANJANG_SANDI_CADANGAN_MIN || sandi !== ulang}
              onClick={async () => {
                const c = await aksi(() => buatCadanganHp(db, sandi))
                if (!c) return
                tutupCadangan()
                await kirimBerkas(c, 'Berkas cadangan siap disimpan. Ingat kata sandinya.')
              }}
            >
              Buat cadangan
            </Tombol>
          }
        >
          <p>Kata sandi ini diminta saat memulihkan. Minimal {PANJANG_SANDI_CADANGAN_MIN} karakter.</p>
          <Isian label="Kata sandi cadangan" type="password" nilai={sandi} ubah={setSandi} />
          <Isian
            label="Ulangi kata sandi"
            type="password"
            nilai={ulang}
            ubah={setUlang}
            bantuan={ulang && sandi !== ulang ? 'Kata sandi belum sama.' : undefined}
          />
        </Modal>
      ) : null}

      {pinForm ? (
        <Modal
          judul="PIN profil"
          tutup={() => setPinForm(false)}
          aksi={
            <>
              {profil.ada_pin ? (
                <Tombol
                  varian="bahaya"
                  onClick={async () => {
                    const ok = await aksi(() => {
                      aturPin(db, profil.id, null, pinLama)
                      return true
                    }, 'PIN dihapus.')
                    if (ok) setPinForm(false)
                  }}
                >
                  Hapus PIN
                </Tombol>
              ) : null}
              <Tombol
                disabled={pinBaru.length !== 4}
                onClick={async () => {
                  const ok = await aksi(() => {
                    aturPin(db, profil.id, pinBaru, profil.ada_pin ? pinLama : undefined)
                    return true
                  }, 'PIN tersimpan.')
                  if (ok) {
                    setPinForm(false)
                    setPinBaru('')
                    setPinLama('')
                  }
                }}
              >
                Simpan PIN
              </Tombol>
            </>
          }
        >
          {profil.ada_pin ? <Isian label="PIN lama" type="password" inputMode="numeric" maxLength={4} nilai={pinLama} ubah={(v) => setPinLama(angka(v))} /> : null}
          <Isian label="PIN baru (4 angka)" type="password" inputMode="numeric" maxLength={4} nilai={pinBaru} ubah={(v) => setPinBaru(angka(v))} />
        </Modal>
      ) : null}

      {tanyaHapus ? (
        <Konfirmasi
          judul="Hapus profil"
          pesan={`Profil ${profil.nama} dihapus dari HP ini. Catatan yang belum disetor ikut hilang. Lanjutkan?`}
          ya="Hapus"
          bahaya
          batal={() => setTanyaHapus(false)}
          setuju={async () => {
            setTanyaHapus(false)
            const ok = await aksi(() => {
              hapusProfil(db, profil.id)
              return true
            }, 'Profil dihapus.')
            if (ok) ke(daftarProfil(db).length ? 'pilih' : 'tambah')
          }}
        />
      ) : null}

      {pulih ? (
        <Modal
          judul="Pulihkan data HP"
          tutup={() => setPulih(null)}
          aksi={
            <Tombol
              varian="bahaya"
              disabled={pulih.terenkripsi && !sandi}
              onClick={async () => {
                const b = pulih
                try {
                  const bytes = await bukaCadanganHp(b.bytes, sandi)
                  await gantiDb(bytes)
                  setPulih(null)
                  toast('sukses', 'Data HP berhasil dipulihkan.')
                } catch (e) {
                  toast('galat', `Cadangan tidak bisa dipulihkan: ${pesanGalat(e)}`)
                }
              }}
            >
              Pulihkan
            </Tombol>
          }
        >
          <p>Semua data di HP ini akan diganti dengan isi “{pulih.nama ?? 'cadangan'}”.</p>
          {pulih.terenkripsi ? (
            <Isian label="Kata sandi cadangan" type="password" nilai={sandi} ubah={setSandi} />
          ) : (
            <p className="keterangan">Cadangan lama ini tidak dikunci sandi. Setelah dipulihkan, buat cadangan baru yang dikunci sandi.</p>
          )}
        </Modal>
      ) : null}
    </>
  )
}
