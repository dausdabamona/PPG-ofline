// Layar 7: Perangkat & Token — terbitkan token dari Kode Perangkat (teks + QR + salin), daftar perangkat,
// cabut/bekukan/cairkan, ganti kunci kelompok, serah terima mubaligh.
import { useEffect, useMemo, useState } from 'react'
import {
  HAK_BAWAAN,
  ambilWilayah,
  bacaKodePerangkat,
  bekukanPerangkat,
  cabutPerangkat,
  cairkanPerangkat,
  daftarPerangkatRinci,
  gantiKunciKelompok,
  serahTerimaMubaligh,
  slug,
  statusSetorAkhir,
  terbitkanToken,
  type Hak,
  type PerangkatRinci,
  type StatusPerangkat,
} from '@ppg/core'
import { useApp, useData } from '../konteks'
import { AreaTeks, Isian, KeadaanData, Kartu, KepalaHalaman, Konfirmasi, KotakGalat, Lencana, Memuat, Modal, Pilihan, Tombol } from '../komponen/ui'
import { PilihWilayah } from '../komponen/wilayah'
import { QrBerseri } from '../komponen/qr'
import { LABEL_HAK, LABEL_ROLE, LABEL_STATUS_PERANGKAT, label, pesanGalat, waktuLokal } from '../utils/label'

const HAK_ROLE: Record<'pengurus' | 'mubaligh', Hak[]> = {
  pengurus: ['catat', 'lihat'],
  mubaligh: ['catat', 'lihat', 'sahkan', 'terbit_generus'],
}

export function HalamanPerangkat() {
  const [token, setToken] = useState<{ teks: string; nama: string } | null>(null)
  return (
    <>
      <KepalaHalaman judul="Perangkat & Token" keterangan="Token pengurus/mubaligh ditandatangani admin; token generus/wali diterbitkan mubaligh." />
      <FormTerbit hasil={(teks, nama) => setToken({ teks, nama })} />
      <DaftarPerangkat />
      <KunciKelompok />
      {token ? <ModalToken token={token.teks} nama={token.nama} tutup={() => setToken(null)} /> : null}
    </>
  )
}

function FormTerbit(p: { hasil: (token: string, nama: string) => void }) {
  const { db, kunci, aksi } = useApp()
  const [kode, setKode] = useState('')
  const [role, setRole] = useState<'pengurus' | 'mubaligh'>('mubaligh')
  const [wilayah, setWilayah] = useState('')
  const [nama, setNama] = useState('')
  const [hak, setHak] = useState<Hak[]>(HAK_BAWAAN.mubaligh)
  const [hari, setHari] = useState('365')
  const infoKode = useMemo(() => {
    if (!kode.trim()) return null
    try {
      return { ok: true as const, d: bacaKodePerangkat(kode) }
    } catch (e) {
      return { ok: false as const, pesan: pesanGalat(e) }
    }
  }, [kode])
  useEffect(() => {
    setHak(HAK_BAWAAN[role])
    if (role === 'mubaligh' && wilayah && ambilWilayah(db, wilayah)?.tingkat !== 'kelompok') setWilayah('')
  }, [role])

  const terbit = async () => {
    const t = await aksi(
      () => terbitkanToken(db, kunci, { kodePerangkat: kode, role, nama, wilayahId: wilayah, hak, berlakuHari: Number(hari) }),
      `Token ${LABEL_ROLE[role]} untuk ${nama} diterbitkan.`,
    )
    if (t) {
      p.hasil(t, nama)
      setKode('')
      setNama('')
    }
  }

  return (
    <Kartu judul="Terbitkan token pengurus / mubaligh">
      <div className="formulir dua-kolom">
        <AreaTeks
          label="Kode Perangkat"
          nilai={kode}
          ubah={setKode}
          baris={3}
          placeholder="Tempel Kode Perangkat (PPGD1.…) yang dikirim dari HP lewat WA"
          bantuan={infoKode?.ok ? `HP: ${infoKode.d.label} · id ${infoKode.d.perangkat_id}` : undefined}
        />
        {infoKode && !infoKode.ok ? <KotakGalat pesan={infoKode.pesan} /> : null}
        <Pilihan
          label="Peran"
          nilai={role}
          ubah={(v) => setRole(v as 'pengurus' | 'mubaligh')}
          pilihan={[
            { nilai: 'mubaligh', teks: 'Mubaligh (satu kelompok)' },
            { nilai: 'pengurus', teks: 'Pengurus (kelompok/desa/daerah)' },
          ]}
        />
        <PilihWilayah
          db={db}
          label="Wilayah tugas"
          nilai={wilayah}
          ubah={setWilayah}
          tingkat={role === 'mubaligh' ? 'kelompok' : undefined}
          kosong="— pilih wilayah —"
        />
        <Isian label="Nama pemegang" nilai={nama} ubah={setNama} wajib placeholder="mis. Ust. Hasan" />
        <Isian label="Masa berlaku (hari)" type="number" nilai={hari} ubah={setHari} min={1} max={3650} />
        <fieldset className="kolom kolom-lebar">
          <legend>Hak</legend>
          <div className="baris-centang">
            {HAK_ROLE[role].map((h) => (
              <label key={h} className="centang">
                <input type="checkbox" checked={hak.includes(h)} onChange={(e) => setHak((x) => (e.target.checked ? [...x, h] : x.filter((y) => y !== h)))} />
                {LABEL_HAK[h]}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="aksi">
        <Tombol onClick={terbit} disabled={!infoKode?.ok || !wilayah || !nama.trim()}>
          Terbitkan token
        </Tombol>
      </div>
    </Kartu>
  )
}

/** Tampilan token: teks + QR + salin + simpan. */
export function ModalToken(p: { token: string; nama: string; tutup: () => void }) {
  const { platform, toast, aksi } = useApp()
  return (
    <Modal
      judul={`Token untuk ${p.nama}`}
      tutup={p.tutup}
      lebar
      aksi={
        <>
          <Tombol
            varian="kedua"
            onClick={async () => {
              const r = await aksi(() => platform.simpanBerkas(`PPG_TOKEN_${slug(p.nama)}.txt`, new TextEncoder().encode(p.token)))
              if (r) toast('sukses', 'Token disimpan sebagai berkas teks.')
            }}
          >
            Simpan ke berkas
          </Tombol>
          <Tombol
            onClick={async () => {
              await aksi(() => platform.salinTeks(p.token), 'Token disalin. Tempel di WA ke pemegang HP.')
            }}
          >
            Salin token
          </Tombol>
        </>
      }
    >
      <div className="tampil-token">
        <div className="qr">
          <QrBerseri teks={p.token} label="QR token" />
        </div>
        <div className="teks-token">
          <p>Pindai QR ini dari HP penerima (menu “Pindai QR Token”; token panjang tampil sebagai beberapa QR bergantian), atau salin teks token dan kirim lewat WA. Token hanya bisa dipakai di HP pemilik Kode Perangkat.</p>
          <textarea readOnly rows={10} value={p.token} aria-label="Teks token" data-testid="teks-token" />
        </div>
      </div>
    </Modal>
  )
}

function warnaStatus(s: StatusPerangkat): 'hijau' | 'kuning' | 'merah' | 'abu' {
  return s === 'aktif' ? 'hijau' : s === 'dibekukan' ? 'kuning' : s === 'dicabut' ? 'merah' : 'abu'
}

function DaftarPerangkat() {
  const { db, aksi } = useApp()
  const [wilayah, setWilayah] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [konfirmasi, setKonfirmasi] = useState<{ p: PerangkatRinci; jenis: 'cabut' | 'beku' | 'cair' } | null>(null)
  const [lihat, setLihat] = useState<PerangkatRinci | null>(null)
  const hasil = useData(
    () =>
      daftarPerangkatRinci(db, {
        wilayahId: wilayah || undefined,
        role: (role || undefined) as PerangkatRinci['role'] | undefined,
        status: (status || undefined) as StatusPerangkat | undefined,
      }),
    [db, wilayah, role, status],
  )
  const teksAksi = { cabut: 'Cabut', beku: 'Bekukan', cair: 'Cairkan' }
  return (
    <Kartu judul="Daftar perangkat (token)">
      <div className="filter">
        <PilihWilayah db={db} label="Wilayah" nilai={wilayah} ubah={setWilayah} kosong="Semua wilayah" />
        <Pilihan label="Peran" nilai={role} ubah={setRole} pilihan={Object.entries(LABEL_ROLE).map(([n, t]) => ({ nilai: n, teks: t }))} kosong="Semua peran" />
        <Pilihan
          label="Status"
          nilai={status}
          ubah={setStatus}
          pilihan={Object.entries(LABEL_STATUS_PERANGKAT).map(([n, t]) => ({ nilai: n, teks: t }))}
          kosong="Semua status"
        />
      </div>
      <KeadaanData hasil={hasil} kosong={(d) => d.length === 0} teksKosong="Belum ada token yang diterbitkan.">
        {(daftar) => (
          <div className="gulir">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Peran</th>
                  <th>Wilayah</th>
                  <th>HP</th>
                  <th>Status</th>
                  <th>Berlaku s.d.</th>
                  <th>Setor terakhir</th>
                  <th aria-label="Aksi" />
                </tr>
              </thead>
              <tbody>
                {daftar.map((x) => (
                  <tr key={x.id}>
                    <td>{x.nama}</td>
                    <td>{label(LABEL_ROLE, x.role)}</td>
                    <td>{x.wilayah_nama}</td>
                    <td>{x.label ?? x.perangkat_id.slice(-6)}</td>
                    <td>
                      <Lencana warna={warnaStatus(x.status)}>{LABEL_STATUS_PERANGKAT[x.status]}</Lencana>
                    </td>
                    <td>{waktuLokal(x.berlaku_sampai)}</td>
                    <td>{waktuLokal(x.terakhir_setor)}</td>
                    <td className="sel-aksi">
                      {x.diterbitkan_oleh === 'ADMIN' ? (
                        <Tombol kecil varian="tipis" onClick={() => setLihat(x)}>
                          Token
                        </Tombol>
                      ) : null}
                      {x.status !== 'dicabut' && !x.dibekukan ? (
                        <Tombol kecil varian="tipis" onClick={() => setKonfirmasi({ p: x, jenis: 'beku' })}>
                          Bekukan
                        </Tombol>
                      ) : null}
                      {x.status !== 'dicabut' && x.dibekukan ? (
                        <Tombol kecil varian="tipis" onClick={() => setKonfirmasi({ p: x, jenis: 'cair' })}>
                          Cairkan
                        </Tombol>
                      ) : null}
                      {x.status !== 'dicabut' ? (
                        <Tombol kecil varian="tipis" onClick={() => setKonfirmasi({ p: x, jenis: 'cabut' })}>
                          Cabut
                        </Tombol>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </KeadaanData>
      {konfirmasi ? (
        <Konfirmasi
          judul={`${teksAksi[konfirmasi.jenis]} token`}
          pesan={
            konfirmasi.jenis === 'cabut'
              ? `Cabut token ${konfirmasi.p.nama} secara permanen? Pencabutan tersebar lewat Kirim Paket berikutnya.`
              : `${teksAksi[konfirmasi.jenis]} token ${konfirmasi.p.nama}? Perubahan tersebar lewat Kirim Paket berikutnya.`
          }
          ya={teksAksi[konfirmasi.jenis]}
          bahaya={konfirmasi.jenis === 'cabut'}
          batal={() => setKonfirmasi(null)}
          setuju={async () => {
            const { p: x, jenis } = konfirmasi
            await aksi(() => {
              if (jenis === 'cabut') cabutPerangkat(db, x.id)
              else if (jenis === 'beku') bekukanPerangkat(db, x.id)
              else cairkanPerangkat(db, x.id)
            }, `Token ${x.nama}: ${teksAksi[jenis].toLowerCase()} berhasil.`)
            setKonfirmasi(null)
          }}
        />
      ) : null}
      {lihat ? <ModalToken token={lihat.token} nama={lihat.nama} tutup={() => setLihat(null)} /> : null}
    </Kartu>
  )
}

function KunciKelompok() {
  const { db, kunci, aksi, toast } = useApp()
  const [kelompok, setKelompok] = useState('')
  const [ganti, setGanti] = useState(false)
  const [serah, setSerah] = useState(false)
  return (
    <Kartu judul="Kunci kelompok & serah terima mubaligh">
      <p className="keterangan">
        Ganti kunci kelompok bila HP mubaligh/pengurus hilang. Serah terima: mubaligh lama mengirim <em>Setor Akhir</em>, impor di sini, lalu jalankan serah terima
        — token lama dicabut dan kunci kelompok diganti.
      </p>
      <div className="filter">
        <PilihWilayah db={db} label="Kelompok" nilai={kelompok} ubah={setKelompok} tingkat="kelompok" kosong="— pilih kelompok —" />
        <div className="aksi-filter">
          <Tombol varian="kedua" disabled={!kelompok} onClick={() => setGanti(true)}>
            Ganti kunci kelompok
          </Tombol>
          <Tombol disabled={!kelompok} onClick={() => setSerah(true)}>
            Serah terima mubaligh
          </Tombol>
        </div>
      </div>
      {ganti ? (
        <Konfirmasi
          judul="Ganti kunci kelompok"
          pesan="Buat versi kunci setor & kunci umum kelompok yang baru? Sesudahnya kirim paket ke kelompok ini dan minta mubaligh mengirim BALASAN ke semua HP generus/wali."
          ya="Ganti kunci"
          batal={() => setGanti(false)}
          setuju={async () => {
            const v = await aksi(() => gantiKunciKelompok(db, kunci, kelompok))
            if (v) toast('sukses', `Kunci kelompok diganti ke versi ${v}. Kirim paket ke kelompok ini.`)
            setGanti(false)
          }}
        />
      ) : null}
      {serah ? <ModalSerahTerima kelompokId={kelompok} tutup={() => setSerah(false)} /> : null}
    </Kartu>
  )
}

function ModalSerahTerima(p: { kelompokId: string; tutup: () => void }) {
  const { db, kunci, aksi, toast } = useApp()
  const mubaligh = useData(() => daftarPerangkatRinci(db, { wilayahId: p.kelompokId, role: 'mubaligh' }).filter((x) => x.status !== 'dicabut'), [db, p.kelompokId])
  const [pilih, setPilih] = useState('')
  const [paksa, setPaksa] = useState(false)
  const st = useData(() => (pilih ? statusSetorAkhir(db, pilih) : null), [db, pilih])
  return (
    <Modal
      judul={`Serah terima mubaligh — ${ambilWilayah(db, p.kelompokId)?.nama ?? ''}`}
      tutup={p.tutup}
      aksi={
        <>
          <Tombol varian="kedua" onClick={p.tutup}>
            Batal
          </Tombol>
          <Tombol
            varian="bahaya"
            disabled={!pilih || (!paksa && !st.data?.lengkap)}
            onClick={async () => {
              const h = await aksi(() => serahTerimaMubaligh(db, kunci, { kelompokId: p.kelompokId, perangkatLamaId: pilih, paksa }))
              if (h) {
                toast('sukses', `Serah terima selesai: ${h.tokenDicabut.length} token dicabut, kunci kelompok versi ${h.versiKunciBaru}. Terbitkan token mubaligh baru lalu kirim paket. Hari itu juga, mubaligh baru WAJIB mengirim Balasan ke semua HP generus dan wali.`)
                p.tutup()
              }
            }}
          >
            Jalankan serah terima
          </Tombol>
        </>
      }
    >
      <KeadaanData hasil={mubaligh} kosong={(d) => d.length === 0} teksKosong="Tidak ada token mubaligh aktif di kelompok ini.">
        {(daftar) => (
          <div className="formulir">
            <Pilihan
              label="Mubaligh lama"
              nilai={pilih}
              ubah={setPilih}
              kosong="— pilih —"
              pilihan={daftar.map((x) => ({ nilai: x.id, teks: `${x.nama} (${x.label ?? x.perangkat_id.slice(-6)})` }))}
            />
            {st.galat ? <KotakGalat pesan={st.galat} /> : null}
            {st.data ? (
              <p>
                Setor Akhir:{' '}
                {st.data.adaSetorAkhir ? (
                  st.data.lengkap ? (
                    <Lencana warna="hijau">Sudah diterima lengkap</Lencana>
                  ) : (
                    <Lencana warna="kuning">Belum lengkap (urut {st.data.urutSetorAkhir}, diterima {st.data.seqDiterima})</Lencana>
                  )
                ) : (
                  <Lencana warna="merah">Belum ada</Lencana>
                )}
              </p>
            ) : null}
            <label className="centang">
              <input type="checkbox" checked={paksa} onChange={(e) => setPaksa(e.target.checked)} />
              Paksa tanpa Setor Akhir (HP hilang/rusak) — data yang belum disetor akan hilang
            </label>
          </div>
        )}
      </KeadaanData>
    </Modal>
  )
}
