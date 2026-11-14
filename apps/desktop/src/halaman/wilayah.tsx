// Layar 3: Wilayah — pohon daerah → desa → kelompok (tambah / ubah / hapus lunak).
import { useState } from 'react'
import { hapusWilayah, pohonWilayah, tambahWilayah, ubahWilayah, type SimpulWilayah, type Tingkat } from '@ppg/core'
import { useApp, useData } from '../konteks'
import { Isian, KeadaanData, Kartu, KepalaHalaman, Konfirmasi, Lencana, Modal, Tombol } from '../komponen/ui'
import { LABEL_TINGKAT } from '../utils/label'

const ANAK: Record<Tingkat, Tingkat | null> = { daerah: 'desa', desa: 'kelompok', kelompok: null }

type Form = { mode: 'tambah'; tingkat: Tingkat; induk: SimpulWilayah | null } | { mode: 'ubah'; simpul: SimpulWilayah }

export function HalamanWilayah() {
  const { db, aksi } = useApp()
  const hasil = useData(() => pohonWilayah(db), [db])
  const [form, setForm] = useState<Form | null>(null)
  const [hapus, setHapus] = useState<SimpulWilayah | null>(null)

  return (
    <>
      <KepalaHalaman
        judul="Wilayah"
        keterangan="Susunan daerah → desa → kelompok. Kode kelompok dipakai di berkas CSV generus."
        aksi={<Tombol onClick={() => setForm({ mode: 'tambah', tingkat: 'daerah', induk: null })}>+ Tambah daerah</Tombol>}
      />
      <Kartu>
        <KeadaanData hasil={hasil} kosong={(d) => d.length === 0} teksKosong="Belum ada wilayah. Tambahkan daerah terlebih dahulu.">
          {(pohon) => (
            <ul className="pohon">
              {pohon.map((s) => (
                <Simpul key={s.id} s={s} tambah={(t, induk) => setForm({ mode: 'tambah', tingkat: t, induk })} ubah={(x) => setForm({ mode: 'ubah', simpul: x })} hapus={setHapus} />
              ))}
            </ul>
          )}
        </KeadaanData>
      </Kartu>
      {form ? <FormWilayah form={form} tutup={() => setForm(null)} /> : null}
      {hapus ? (
        <Konfirmasi
          judul="Hapus wilayah"
          pesan={`Hapus ${LABEL_TINGKAT[hapus.tingkat]} "${hapus.nama}"? Data lama tetap tersimpan (hapus lunak).`}
          ya="Hapus"
          bahaya
          batal={() => setHapus(null)}
          setuju={async () => {
            await aksi(() => hapusWilayah(db, hapus.id), `${hapus.nama} dihapus.`)
            setHapus(null)
          }}
        />
      ) : null}
    </>
  )
}

function Simpul(p: { s: SimpulWilayah; tambah: (t: Tingkat, induk: SimpulWilayah) => void; ubah: (s: SimpulWilayah) => void; hapus: (s: SimpulWilayah) => void }) {
  const anak = ANAK[p.s.tingkat]
  return (
    <li>
      <div className={`simpul simpul-${p.s.tingkat}`}>
        <Lencana warna="teal">{LABEL_TINGKAT[p.s.tingkat]}</Lencana>
        <strong>{p.s.nama}</strong>
        {p.s.kode ? <code>{p.s.kode}</code> : null}
        <span className="pengisi" />
        {anak ? (
          <Tombol kecil varian="tipis" onClick={() => p.tambah(anak, p.s)}>
            + {LABEL_TINGKAT[anak]}
          </Tombol>
        ) : null}
        <Tombol kecil varian="tipis" onClick={() => p.ubah(p.s)}>
          Ubah
        </Tombol>
        <Tombol kecil varian="tipis" onClick={() => p.hapus(p.s)}>
          Hapus
        </Tombol>
      </div>
      {p.s.anak.length ? (
        <ul>
          {p.s.anak.map((a) => (
            <Simpul key={a.id} s={a} tambah={p.tambah} ubah={p.ubah} hapus={p.hapus} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function FormWilayah(p: { form: Form; tutup: () => void }) {
  const { db, aksi } = useApp()
  const awal = p.form.mode === 'ubah' ? p.form.simpul : null
  const [nama, setNama] = useState(awal?.nama ?? '')
  const [kode, setKode] = useState(awal?.kode ?? '')
  const tingkat = p.form.mode === 'ubah' ? p.form.simpul.tingkat : p.form.tingkat
  const judul =
    p.form.mode === 'ubah'
      ? `Ubah ${LABEL_TINGKAT[tingkat]}`
      : `Tambah ${LABEL_TINGKAT[tingkat]}${p.form.induk ? ` di ${p.form.induk.nama}` : ''}`
  const simpan = async () => {
    const f = p.form
    const h = await aksi(
      () =>
        f.mode === 'ubah'
          ? ubahWilayah(db, f.simpul.id, { nama, kode: kode || null })
          : tambahWilayah(db, { tingkat: f.tingkat, nama, kode: kode || null, indukId: f.induk?.id ?? null }),
      (w) => `${LABEL_TINGKAT[w.tingkat]} "${w.nama}" disimpan.`,
    )
    if (h) p.tutup()
  }
  return (
    <Modal
      judul={judul}
      tutup={p.tutup}
      aksi={
        <>
          <Tombol varian="kedua" onClick={p.tutup}>
            Batal
          </Tombol>
          <Tombol onClick={simpan}>Simpan</Tombol>
        </>
      }
    >
      <form
        className="formulir"
        onSubmit={(e) => {
          e.preventDefault()
          void simpan()
        }}
      >
        <Isian label={`Nama ${(LABEL_TINGKAT[tingkat] ?? tingkat).toLowerCase()}`} nilai={nama} ubah={setNama} wajib />
        <Isian
          label="Kode"
          nilai={kode}
          ubah={setKode}
          bantuan={tingkat === 'kelompok' ? 'Wajib untuk impor CSV generus (kolom kelompok_kode), mis. K1.' : 'Opsional, harus unik.'}
        />
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
