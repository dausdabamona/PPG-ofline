// Layar 6: Materi — bidang / kategori / materi, isi teks, lampiran PDF; tombol "Buat Berkas Materi".
import { useEffect, useState } from 'react'
import {
  KATEGORI_GENERUS,
  TIPE_MATERI,
  aturLampiranMateri,
  buatKurikulum,
  buatMateri,
  daftarBidang,
  daftarKategoriMateri,
  daftarMateri,
  tambahBidang,
  tambahKategori,
  tambahMateri,
  ubahMateri,
  type KategoriGenerus,
  type MateriLengkap,
  type TipeMateri,
} from '@ppg/core'
import { kunciDaerah, useApp, useData } from '../konteks'
import { AreaTeks, Isian, KeadaanData, Kartu, KepalaHalaman, Konfirmasi, Lencana, Modal, Pilihan, Tombol } from '../komponen/ui'
import { LABEL_KATEGORI, LABEL_TIPE_MATERI, label } from '../utils/label'

const OPSI_TIPE = TIPE_MATERI.map((t) => ({ nilai: t, teks: LABEL_TIPE_MATERI[t] ?? t }))

export function HalamanMateri() {
  const { db, kunci, peran, aksi, platform, toast } = useApp()
  const bidang = useData(() => daftarBidang(db), [db])
  const [bidangId, setBidangId] = useState('')
  const [kategoriId, setKategoriId] = useState('')
  const kategori = useData(() => (bidangId ? daftarKategoriMateri(db, bidangId) : []), [db, bidangId])
  const materi = useData(() => (kategoriId ? daftarMateri(db, { kategoriId }) : []), [db, kategoriId])
  const [form, setForm] = useState<{ m: MateriLengkap | null } | null>(null)
  const [hapus, setHapus] = useState<MateriLengkap | null>(null)
  const [formBidang, setFormBidang] = useState(false)
  const [formKategori, setFormKategori] = useState(false)

  useEffect(() => {
    if (!bidangId && bidang.data?.[0]) setBidangId(bidang.data[0].id)
  }, [bidang.data, bidangId])
  useEffect(() => {
    const ks = kategori.data ?? []
    if (!ks.some((k) => k.id === kategoriId)) setKategoriId(ks[0]?.id ?? '')
  }, [kategori.data, kategoriId])

  const unggahPdf = async (m: MateriLengkap) => {
    const b = (await platform.bukaBanyak([{ nama: 'PDF', ekstensi: ['pdf'] }], false))[0]
    if (!b) return
    await aksi(() => aturLampiranMateri(db, m.id, { nama: b.nama, bytes: b.bytes }), `Lampiran ${b.nama} dipasang pada "${m.nama}".`)
  }

  const buatBerkas = async () => {
    if (peran === 'kurikulum') {
      const b = await aksi(() => buatKurikulum(db))
      if (!b) return
      const lok = await aksi(() => platform.simpanBerkas(b.nama, b.bytes))
      if (lok) toast('sukses', `Berkas ${b.nama} (${b.jumlah} data) disimpan. Kirim ke Admin Daerah lewat WA.`)
      return
    }
    const berkas = await aksi(() => buatMateri(db, kunciDaerah(kunci)))
    if (!berkas) return
    const path = await aksi(() => platform.simpanBerkas(berkas.nama, berkas.bytes))
    if (path) toast('sukses', `Berkas materi v${berkas.versi} disimpan: ${berkas.nama}. Kirim ke grup WA (desa meneruskannya apa adanya).`)
  }

  return (
    <>
      <KepalaHalaman
        judul="Materi"
        keterangan={
          peran === 'kurikulum'
            ? 'Sunting bidang, kategori, dan materi (teks + PDF). Kirim hasilnya ke daerah dengan berkas Kurikulum.'
            : 'Kurikulum baku yang tampil di HP generus (teks + PDF). Berkas Materi juga membawa target capaian & periode aktif.'
        }
        aksi={<Tombol onClick={buatBerkas}>{peran === 'kurikulum' ? 'Buat berkas Kurikulum' : 'Buat Berkas Materi'}</Tombol>}
      />
      <Kartu>
        <KeadaanData hasil={bidang} kosong={(d) => d.length === 0} teksKosong="Belum ada bidang materi.">
          {(daftarB) => (
            <div className="filter">
              <Pilihan label="Bidang" nilai={bidangId} ubah={setBidangId} pilihan={daftarB.map((b) => ({ nilai: b.id, teks: b.nama }))} />
              <KeadaanData hasil={kategori}>
                {(daftarK) => (
                  <Pilihan
                    label="Kategori materi"
                    nilai={kategoriId}
                    ubah={setKategoriId}
                    pilihan={daftarK.map((k) => ({ nilai: k.id, teks: `${k.kode} — ${k.nama}` }))}
                    kosong={daftarK.length ? undefined : '(belum ada kategori)'}
                  />
                )}
              </KeadaanData>
              <div className="aksi-filter">
                <Tombol varian="kedua" kecil onClick={() => setFormBidang(true)}>
                  + Bidang
                </Tombol>
                <Tombol varian="kedua" kecil onClick={() => setFormKategori(true)} disabled={!bidangId}>
                  + Kategori
                </Tombol>
                <Tombol kecil onClick={() => setForm({ m: null })} disabled={!kategoriId}>
                  + Materi
                </Tombol>
              </div>
            </div>
          )}
        </KeadaanData>
        <KeadaanData hasil={materi} kosong={(d) => d.length === 0} teksKosong="Belum ada materi di kategori ini.">
          {(daftar) => (
            <table className="tabel">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama materi</th>
                  <th>Tipe</th>
                  <th>Untuk</th>
                  <th>Isi</th>
                  <th aria-label="Aksi" />
                </tr>
              </thead>
              <tbody>
                {daftar.map((m) => (
                  <tr key={m.id}>
                    <td>{m.nomor}</td>
                    <td>{m.nama}</td>
                    <td>{label(LABEL_TIPE_MATERI, m.tipe)}</td>
                    <td>{m.kategori_generus ? m.kategori_generus.split(',').map((k) => LABEL_KATEGORI[k] ?? k).join(', ') : 'Semua'}</td>
                    <td>
                      {m.isi_teks ? <Lencana warna="teal">Teks</Lencana> : null} {m.lampiran_nama ? <Lencana warna="hijau">PDF: {m.lampiran_nama}</Lencana> : null}
                    </td>
                    <td className="sel-aksi">
                      <Tombol kecil varian="tipis" onClick={() => setForm({ m })}>
                        Ubah
                      </Tombol>
                      <Tombol kecil varian="tipis" onClick={() => unggahPdf(m)}>
                        {m.lampiran_nama ? 'Ganti PDF' : 'Unggah PDF'}
                      </Tombol>
                      {m.lampiran_nama ? (
                        <Tombol kecil varian="tipis" onClick={() => aksi(() => aturLampiranMateri(db, m.id, null), 'Lampiran dilepas.')}>
                          Lepas PDF
                        </Tombol>
                      ) : null}
                      <Tombol kecil varian="tipis" onClick={() => setHapus(m)}>
                        Hapus
                      </Tombol>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </KeadaanData>
      </Kartu>
      {form ? <FormMateri m={form.m} kategoriId={kategoriId} jumlah={materi.data?.length ?? 0} tutup={() => setForm(null)} /> : null}
      {formBidang ? <FormBidang jumlah={bidang.data?.length ?? 0} tutup={() => setFormBidang(false)} pilih={setBidangId} /> : null}
      {formKategori ? <FormKategori bidangId={bidangId} jumlah={kategori.data?.length ?? 0} tutup={() => setFormKategori(false)} pilih={setKategoriId} /> : null}
      {hapus ? (
        <Konfirmasi
          judul="Hapus materi"
          pesan={`Hapus materi "${hapus.nama}"? Kemajuan generus yang sudah tercatat tetap tersimpan.`}
          ya="Hapus"
          bahaya
          batal={() => setHapus(null)}
          setuju={async () => {
            await aksi(() => ubahMateri(db, hapus.id, { dihapus: true }), 'Materi dihapus.')
            setHapus(null)
          }}
        />
      ) : null}
    </>
  )
}

function FormMateri(p: { m: MateriLengkap | null; kategoriId: string; jumlah: number; tutup: () => void }) {
  const { db, aksi } = useApp()
  const m = p.m
  const [nama, setNama] = useState(m?.nama ?? '')
  const [nomor, setNomor] = useState(String(m?.nomor ?? p.jumlah + 1))
  const [tipe, setTipe] = useState<string>(m?.tipe ?? 'checklist')
  const [isi, setIsi] = useState(m?.isi_teks ?? '')
  const [untuk, setUntuk] = useState<KategoriGenerus[]>((m?.kategori_generus?.split(',') as KategoriGenerus[] | undefined) ?? [])
  return (
    <Modal
      judul={m ? `Ubah materi: ${m.nama}` : 'Tambah materi'}
      tutup={p.tutup}
      lebar
      aksi={
        <>
          <Tombol varian="kedua" onClick={p.tutup}>
            Batal
          </Tombol>
          <Tombol
            onClick={async () => {
              const h = await aksi(() => {
                if (!nama.trim()) throw new Error('Nama materi wajib diisi.')
                const d = { nama: nama.trim(), nomor: Number(nomor) || 1, tipe: tipe as TipeMateri, kategoriGenerus: untuk.length ? untuk : null, isiTeks: isi || null }
                return m ? ubahMateri(db, m.id, d) : tambahMateri(db, { kategoriId: p.kategoriId, ...d })
              }, 'Materi disimpan.')
              if (h) p.tutup()
            }}
          >
            Simpan
          </Tombol>
        </>
      }
    >
      <div className="formulir dua-kolom">
        <Isian label="Nama materi" nilai={nama} ubah={setNama} wajib />
        <Isian label="Nomor urut" type="number" nilai={nomor} ubah={setNomor} min={1} />
        <Pilihan label="Tipe" nilai={tipe} ubah={setTipe} pilihan={OPSI_TIPE} />
        <fieldset className="kolom kolom-lebar">
          <legend>Berlaku untuk kategori generus (kosong = semua)</legend>
          <div className="baris-centang">
            {KATEGORI_GENERUS.map((k) => (
              <label key={k} className="centang">
                <input type="checkbox" checked={untuk.includes(k)} onChange={(e) => setUntuk((u) => (e.target.checked ? [...u, k] : u.filter((x) => x !== k)))} />
                {LABEL_KATEGORI[k]}
              </label>
            ))}
          </div>
        </fieldset>
        <AreaTeks label="Isi teks (opsional)" nilai={isi} ubah={setIsi} baris={8} placeholder="Teks materi, lafaz, atau petunjuk…" />
      </div>
    </Modal>
  )
}

function FormBidang(p: { jumlah: number; tutup: () => void; pilih: (id: string) => void }) {
  const { db, aksi } = useApp()
  const [nama, setNama] = useState('')
  return (
    <Modal
      judul="Tambah bidang materi"
      tutup={p.tutup}
      aksi={
        <Tombol
          onClick={async () => {
            const h = await aksi(() => {
              if (!nama.trim()) throw new Error('Nama bidang wajib diisi.')
              return tambahBidang(db, { nama: nama.trim(), urutan: p.jumlah + 1 })
            }, 'Bidang ditambahkan.')
            if (h) {
              p.pilih(h.id)
              p.tutup()
            }
          }}
        >
          Simpan
        </Tombol>
      }
    >
      <div className="formulir">
        <Isian label="Nama bidang" nilai={nama} ubah={setNama} wajib />
      </div>
    </Modal>
  )
}

function FormKategori(p: { bidangId: string; jumlah: number; tutup: () => void; pilih: (id: string) => void }) {
  const { db, aksi } = useApp()
  const [kode, setKode] = useState('')
  const [nama, setNama] = useState('')
  const [tipe, setTipe] = useState('checklist')
  return (
    <Modal
      judul="Tambah kategori materi"
      tutup={p.tutup}
      aksi={
        <Tombol
          onClick={async () => {
            const h = await aksi(() => {
              if (!kode.trim() || !nama.trim()) throw new Error('Kode dan nama kategori wajib diisi.')
              return tambahKategori(db, { bidangId: p.bidangId, kode: kode.trim().toUpperCase(), nama: nama.trim(), urutan: p.jumlah + 1, tipe: tipe as TipeMateri })
            }, 'Kategori ditambahkan.')
            if (h) {
              p.pilih(h.id)
              p.tutup()
            }
          }}
        >
          Simpan
        </Tombol>
      }
    >
      <div className="formulir">
        <Isian label="Kode" nilai={kode} ubah={setKode} wajib placeholder="mis. DOA" />
        <Isian label="Nama kategori" nilai={nama} ubah={setNama} wajib />
        <Pilihan label="Tipe materi" nilai={tipe} ubah={setTipe} pilihan={OPSI_TIPE} />
      </div>
    </Modal>
  )
}
