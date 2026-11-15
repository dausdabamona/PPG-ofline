// Layar 7: Perangkat & Token — terbitkan token dari Kode Perangkat (teks + QR + salin), daftar perangkat,
// cabut/bekukan/cairkan, ganti kunci kelompok, serah terima mubaligh.
// v3: daerah juga mengaktifkan EXE desa / EXE kelompok / EXE kurikulum; EXE desa menerbitkan token pengurus/mubaligh/EXE
// kelompok di wilayahnya (terbitkanTokenBawah) dan hanya mencabut token terbitannya sendiri.
import { useEffect, useMemo, useState } from 'react'
import {
  JABATAN_TINGKAT,
  LABEL_JABATAN,
  type Jabatan,
  HAK_BAWAAN,
  ambilWilayah,
  bacaKodePerangkat,
  bekukanPerangkat,
  cabutPerangkat,
  cairkanPerangkat,
  daftarPerangkatRinci,
  idRantaiPenerbit,
  profilExe,
  terbitkanTokenBawah,
  type KunciExe,
  type Tingkat,
  gantiKunciKelompok,
  serahTerimaMubaligh,
  slug,
  statusSetorAkhir,
  terbitkanToken,
  type Hak,
  type PerangkatRinci,
  type StatusPerangkat,
} from '@ppg/core'
import { kunciDaerah, useApp, useData } from '../konteks'
import { AreaTeks, Isian, KeadaanData, Kartu, KepalaHalaman, Konfirmasi, KotakGalat, Lencana, Memuat, Modal, Pilihan, Tombol } from '../komponen/ui'
import { PilihWilayah } from '../komponen/wilayah'
import { QrBerseri } from '../komponen/qr'
import { LABEL_HAK, LABEL_STATUS_PERANGKAT, labelRole, pesanGalat, waktuLokal } from '../utils/label'

const HAK_ROLE: Record<'pengurus' | 'mubaligh', Hak[]> = {
  pengurus: ['catat', 'lihat'],
  mubaligh: ['catat', 'lihat', 'sahkan', 'terbit_generus'],
}

type JenisTerbit = 'mubaligh' | 'pengurus' | 'exe_desa' | 'exe_kelompok' | 'kurikulum' | 'super_hp'

const JENIS: Record<JenisTerbit, { teks: string; role: 'pengurus' | 'mubaligh' | 'admin' | 'kurikulum'; tingkat?: Tingkat }> = {
  mubaligh: { teks: 'Mubaligh (HP, satu kelompok)', role: 'mubaligh', tingkat: 'kelompok' },
  pengurus: { teks: 'Pengurus (HP, kelompok/desa/daerah)', role: 'pengurus' },
  exe_desa: { teks: 'EXE Desa (aplikasi laptop desa)', role: 'admin', tingkat: 'desa' },
  exe_kelompok: { teks: 'EXE Kelompok (aplikasi laptop kelompok)', role: 'admin', tingkat: 'kelompok' },
  kurikulum: { teks: 'EXE Kurikulum (tim kurikulum)', role: 'kurikulum', tingkat: 'daerah' },
  // Fase 9: HP petugas pendaftaran seluruh daerah (token admin tingkat daerah, hak terbit_bawah)
  super_hp: { teks: 'Super Admin HP (pendaftaran seluruh daerah)', role: 'admin', tingkat: 'daerah' },
}

export function HalamanPerangkat() {
  const { peran } = useApp()
  const [token, setToken] = useState<{ teks: string; nama: string } | null>(null)
  return (
    <>
      <KepalaHalaman
        judul="Perangkat & Token"
        keterangan={
          peran === 'daerah'
            ? 'Terbitkan kode aktivasi HP pengurus/mubaligh dan EXE desa/kelompok/kurikulum. Daerah melihat dan bisa mencabut semua perangkat.'
            : 'Terbitkan kode aktivasi HP pengurus/mubaligh dan EXE kelompok di desa ini. Token generus/wali diterbitkan mubaligh.'
        }
      />
      <FormTerbit hasil={(teks, nama) => setToken({ teks, nama })} />
      <DaftarPerangkat />
      {peran === 'daerah' ? <KunciKelompok /> : null}
      {token ? <ModalToken token={token.teks} nama={token.nama} tutup={() => setToken(null)} /> : null}
    </>
  )
}

function FormTerbit(p: { hasil: (token: string, nama: string) => void }) {
  const { db, kunci, peran, wilayahId, aksi } = useApp()
  const [kode, setKode] = useState('')
  const [jenis, setJenis] = useState<JenisTerbit>('mubaligh')
  const role = jenis === 'pengurus' ? 'pengurus' : 'mubaligh'
  const hakTampil = jenis === 'mubaligh' || jenis === 'pengurus'
  const [wilayah, setWilayah] = useState('')
  const [nama, setNama] = useState('')
  const [hak, setHak] = useState<Hak[]>(HAK_BAWAAN.mubaligh)
  const [hari, setHari] = useState('365')
  // §17: jabatan/bidang PPG untuk pengurus (hanya EXE Daerah)
  const [jabatan, setJabatan] = useState<Jabatan[]>([])
  const tingkatWilayah = wilayah ? ambilWilayah(db, wilayah)?.tingkat : undefined
  const pilihanJabatan = jenis === 'pengurus' && peran === 'daerah' && tingkatWilayah ? JABATAN_TINGKAT[tingkatWilayah] : []
  const infoKode = useMemo(() => {
    if (!kode.trim()) return null
    try {
      return { ok: true as const, d: bacaKodePerangkat(kode) }
    } catch (e) {
      return { ok: false as const, pesan: pesanGalat(e) }
    }
  }, [kode])
  const tingkatJenis = JENIS[jenis].tingkat
  useEffect(() => {
    setHak(HAK_BAWAAN[role])
    if (tingkatJenis && wilayah && ambilWilayah(db, wilayah)?.tingkat !== tingkatJenis) setWilayah('')
  }, [jenis])
  const pilihanJenis: JenisTerbit[] = peran === 'daerah' ? ['mubaligh', 'pengurus', 'exe_desa', 'exe_kelompok', 'kurikulum', 'super_hp'] : ['mubaligh', 'pengurus', 'exe_kelompok']

  const terbit = async () => {
    const j = JENIS[jenis]
    const t = await aksi(
      () => {
        const o = { kodePerangkat: kode, nama, wilayahId: wilayah, hak: hakTampil ? hak : undefined, berlakuHari: Number(hari) }
        const jb = jabatan.filter((x) => pilihanJabatan.includes(x))
        if (peran === 'daerah') return terbitkanToken(db, kunciDaerah(kunci), { ...o, role: j.role, ...(jb.length ? { jabatan: jb } : {}) })
        if (j.role === 'kurikulum') throw new Error('Token kurikulum diterbitkan daerah.')
        return terbitkanTokenBawah(db, kunci as KunciExe, { ...o, role: j.role })
      },
      `Kode aktivasi ${labelRole(j.role, j.tingkat)} untuk ${nama} diterbitkan.`,
    )
    if (t) {
      p.hasil(t, nama)
      setKode('')
      setNama('')
      setJabatan([])
    }
  }

  return (
    <Kartu judul={peran === 'daerah' ? 'Terbitkan token / kode aktivasi' : 'Terbitkan kode aktivasi di desa ini'}>
      <div className="formulir dua-kolom">
        <AreaTeks
          label="Kode Perangkat"
          nilai={kode}
          ubah={setKode}
          baris={3}
          placeholder="Tempel Kode Perangkat (PPGD1.…) yang dikirim dari HP atau EXE lewat WA"
          bantuan={infoKode?.ok ? `HP: ${infoKode.d.label} · id ${infoKode.d.perangkat_id}` : undefined}
        />
        {infoKode && !infoKode.ok ? <KotakGalat pesan={infoKode.pesan} /> : null}
        <Pilihan label="Untuk" nilai={jenis} ubah={(v) => setJenis(v as JenisTerbit)} pilihan={pilihanJenis.map((x) => ({ nilai: x, teks: JENIS[x].teks }))} />
        <PilihWilayah
          db={db}
          label="Wilayah tugas"
          nilai={wilayah}
          ubah={setWilayah}
          tingkat={tingkatJenis}
          akar={peran === 'daerah' ? null : wilayahId}
          kosong="— pilih wilayah —"
        />
        <Isian label="Nama pemegang" nilai={nama} ubah={setNama} wajib placeholder="mis. Ust. Hasan" />
        <Isian label="Masa berlaku (hari)" type="number" nilai={hari} ubah={setHari} min={1} max={3650} />
        {hakTampil ? <fieldset className="kolom kolom-lebar">
          <legend>Hak</legend>
          <div className="baris-centang">
            {HAK_ROLE[role].map((h) => (
              <label key={h} className="centang">
                <input type="checkbox" checked={hak.includes(h)} onChange={(e) => setHak((x) => (e.target.checked ? [...x, h] : x.filter((y) => y !== h)))} />
                {LABEL_HAK[h]}
              </label>
            ))}
          </div>
        </fieldset> : jenis === 'super_hp' ? <p className="keterangan kolom-lebar">Super Admin HP menerbitkan token semua peran (pengurus, mubaligh, orang tua, murid, EXE desa/kelompok/kurikulum) di seluruh daerah, menambah data sebagai usulan yang disetujui otomatis saat setorannya diimpor, dan menyetor ke daerah. Tidak bisa menerbitkan Super Admin HP lain. Cabut di daftar perangkat bila HP hilang.</p> : <p className="keterangan kolom-lebar">Hak EXE mengikuti tingkatnya (EXE desa boleh menerbitkan kode aktivasi di desanya; EXE kelompok mencatat & mengesahkan; kurikulum mengelola materi & target).</p>}
      </div>
      {pilihanJabatan.length ? (
        <fieldset className="kolom kolom-lebar">
          <legend>Jabatan / bidang PPG (boleh lebih dari satu)</legend>
          <div className="baris-centang">
            {pilihanJabatan.map((x) => (
              <label key={x} className="centang">
                <input type="checkbox" checked={jabatan.includes(x)} onChange={(e) => setJabatan((l) => (e.target.checked ? [...l, x] : l.filter((y) => y !== x)))} />
                {LABEL_JABATAN[x]}
              </label>
            ))}
          </div>
          <p className="keterangan">HP pengurus hanya menampilkan menu bidangnya. Ketua/Wakil/Bendahara/Penggalang Dana menerima kunci baca keuangan; BK menerima kunci konseling.</p>
        </fieldset>
      ) : null}
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
  const { db, peran, wilayahId, aksi } = useApp()
  const sayaToken = peran === 'daerah' ? 'ADMIN' : profilExe(db).token_id
  // EXE desa hanya mengendalikan token yang rantai penerbitnya melewati EXE ini (V-T16); daerah semua.
  const bolehKendali = (x: PerangkatRinci) => peran === 'daerah' || idRantaiPenerbit(x.token).includes(sayaToken)
  const [wilayah, setWilayah] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [konfirmasi, setKonfirmasi] = useState<{ p: PerangkatRinci; jenis: 'cabut' | 'beku' | 'cair' } | null>(null)
  const [lihat, setLihat] = useState<PerangkatRinci | null>(null)
  const hasil = useData(
    () =>
      daftarPerangkatRinci(db, {
        wilayahId: wilayah || (peran === 'daerah' ? undefined : (wilayahId ?? undefined)),
        role: (role || undefined) as PerangkatRinci['role'] | undefined,
        status: (status || undefined) as StatusPerangkat | undefined,
      }),
    [db, wilayah, role, status],
  )
  const teksAksi = { cabut: 'Cabut', beku: 'Bekukan', cair: 'Cairkan' }
  return (
    <Kartu judul="Daftar perangkat (token)">
      <div className="filter">
        <PilihWilayah db={db} label="Wilayah" nilai={wilayah} ubah={setWilayah} kosong="Semua wilayah" akar={peran === 'daerah' ? null : wilayahId} />
        <Pilihan
          label="Peran"
          nilai={role}
          ubah={setRole}
          pilihan={['pengurus', 'mubaligh', 'generus', 'wali', 'admin', 'kurikulum'].map((n) => ({ nilai: n, teks: n === 'admin' ? 'EXE Desa/Kelompok' : labelRole(n) }))}
          kosong="Semua peran"
        />
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
                    <td>{labelRole(x.role, x.tingkat)}</td>
                    <td>{x.wilayah_nama}</td>
                    <td>{x.label ?? x.perangkat_id.slice(-6)}</td>
                    <td>
                      <Lencana warna={warnaStatus(x.status)}>{LABEL_STATUS_PERANGKAT[x.status]}</Lencana>
                    </td>
                    <td>{waktuLokal(x.berlaku_sampai)}</td>
                    <td>{waktuLokal(x.terakhir_setor)}</td>
                    <td className="sel-aksi">
                      {x.diterbitkan_oleh === sayaToken ? (
                        <Tombol kecil varian="tipis" onClick={() => setLihat(x)}>
                          Token
                        </Tombol>
                      ) : null}
                      {x.status !== 'dicabut' && !x.dibekukan && bolehKendali(x) ? (
                        <Tombol kecil varian="tipis" onClick={() => setKonfirmasi({ p: x, jenis: 'beku' })}>
                          Bekukan
                        </Tombol>
                      ) : null}
                      {x.status !== 'dicabut' && x.dibekukan && bolehKendali(x) ? (
                        <Tombol kecil varian="tipis" onClick={() => setKonfirmasi({ p: x, jenis: 'cair' })}>
                          Cairkan
                        </Tombol>
                      ) : null}
                      {x.status !== 'dicabut' && bolehKendali(x) ? (
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
            const v = await aksi(() => gantiKunciKelompok(db, kunciDaerah(kunci), kelompok))
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
              const h = await aksi(() => serahTerimaMubaligh(db, kunciDaerah(kunci), { kelompokId: p.kelompokId, perangkatLamaId: pilih, paksa }))
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
