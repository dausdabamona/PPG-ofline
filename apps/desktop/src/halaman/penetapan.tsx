// §18 — EXE: daftar "Perlu Ditetapkan Kurikulum" (K01–K15). EXE Kurikulum menetapkan / mengubah lalu menetapkan; EXE Daerah
// hanya melihat (penetapan diserahkan ke role Kurikulum). Nilai sementara = data yang sedang dipakai hitungan.
import { useState } from 'react'
import { daftarButirKurikulum, formatTanggal, LABEL_STATUS_BUTIR, tetapkanButirKurikulum, type BarisButirKurikulum, type StatusButir } from '@ppg/core'
import { useApp, useData } from '../konteks'
import { AreaTeks, Isian, KeadaanData, Kartu, KepalaHalaman, Lencana, Modal, Pilihan, Tombol } from '../komponen/ui'
import type { KunciMenu } from '../menu'

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
export const WARNA_STATUS_BUTIR: Record<StatusButir, 'hijau' | 'kuning' | 'merah'> = { ditetapkan: 'hijau', sementara: 'kuning', belum: 'merah' }

export function HalamanPenetapan(p: { pilih?: (k: KunciMenu) => void }) {
  const { db, peran } = useApp()
  const bolehUbah = peran === 'kurikulum'
  const [saring, setSaring] = useState<'semua' | 'perlu'>('semua')
  const r = useData(() => daftarButirKurikulum(db), [db])
  return (
    <>
      <KepalaHalaman
        judul="Perlu Ditetapkan Kurikulum"
        keterangan={
          bolehUbah
            ? 'Butir materi & penilaian juknis yang diserahkan ke Kurikulum. Nilai sementara = yang sedang dipakai hitungan. Setelah ditetapkan, kirim lewat Buat berkas Kurikulum.'
            : 'Penetapan diserahkan ke Bidang Kurikulum (EXE Kurikulum / HP jabatan Kurikulum). Daerah meneruskan hasilnya lewat Berkas Materi & Kirim Paket.'
        }
      />
      <div className="tab tidak-cetak" role="tablist">
        {(['semua', 'perlu'] as const).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={saring === s} className={saring === s ? 'aktif' : ''} onClick={() => setSaring(s)}>
            {s === 'semua' ? 'Semua butir' : 'Belum ditetapkan'}
          </button>
        ))}
      </div>
      <KeadaanData hasil={r} kosong={(d) => d.length === 0} teksKosong="Daftar butir belum ada.">
        {(d) => (
          <>
            <p className="keterangan">
              {d.filter((b) => b.status === 'ditetapkan').length} dari {d.length} butir sudah Ditetapkan Kurikulum.
            </p>
            {d
              .filter((b) => saring === 'semua' || b.status !== 'ditetapkan')
              .map((b) => (
                <KartuButir key={b.kode} b={b} bolehUbah={bolehUbah} keMateri={p.pilih ? () => p.pilih!('materiEvaluasi') : undefined} />
              ))}
          </>
        )}
      </KeadaanData>
    </>
  )
}

function KartuButir(p: { b: BarisButirKurikulum; bolehUbah: boolean; keMateri?: () => void }) {
  const { b } = p
  const [ubah, setUbah] = useState(false)
  const [riwayat, setRiwayat] = useState(false)
  return (
    <Kartu
      judul={`${b.kode} · ${b.judul}`}
      aksi={
        <span className="aksi-baris">
          <Lencana warna={WARNA_STATUS_BUTIR[b.status]}>{LABEL_STATUS_BUTIR[b.status]}</Lencana>
          {b.berubah ? <Lencana warna="kuning">Berubah sesudah ditetapkan</Lencana> : null}
        </span>
      }
    >
      <p className="keterangan">Sumber/alasan: {b.sumber}</p>
      <p>
        <b>{b.status === 'ditetapkan' ? 'Nilai yang ditetapkan' : 'Nilai sementara yang dipakai'}:</b> {b.ringkas}
      </p>
      {b.penetapan ? (
        <p className="keterangan">
          Terakhir ditetapkan {formatTanggal(b.penetapan.pada.slice(0, 10))} oleh {b.penetapan.oleh}
          {b.penetapan.catatan ? ` — ${b.penetapan.catatan}` : ''}.
        </p>
      ) : null}
      <div className="aksi aksi-kiri">
        {p.bolehUbah ? (
          <Tombol varian={ubah ? 'kedua' : 'utama'} onClick={() => setUbah(!ubah)}>
            {ubah ? 'Tutup' : b.status === 'belum' ? 'Isi & tetapkan' : 'Tetapkan / ubah'}
          </Tombol>
        ) : null}
        {b.ubahDiMateri && p.keMateri ? (
          <Tombol varian="kedua" onClick={p.keMateri}>
            Ubah daftar butir di Materi Evaluasi
          </Tombol>
        ) : null}
        {b.penetapan?.riwayat.length ? (
          <Tombol varian="tipis" onClick={() => setRiwayat(true)}>
            Riwayat ({b.penetapan.riwayat.length})
          </Tombol>
        ) : null}
      </div>
      {ubah ? <FormButir b={b} selesai={() => setUbah(false)} /> : null}
      {riwayat && b.penetapan ? (
        <Modal judul={`Riwayat ${b.kode}`} tutup={() => setRiwayat(false)}>
          <ol>
            {[...b.penetapan.riwayat].reverse().map((r, i) => (
              <li key={i}>
                {formatTanggal(r.pada.slice(0, 10))} — {r.oleh}
                {r.catatan ? `: ${r.catatan}` : ''}
                <br />
                <small>{JSON.stringify(r.nilai)}</small>
              </li>
            ))}
          </ol>
        </Modal>
      ) : null}
    </Kartu>
  )
}

/** Formulir per bentuk butir; nilai awal = nilai sementara. */
function FormButir(p: { b: BarisButirKurikulum; selesai: () => void }) {
  const { db, aksi } = useApp()
  const { b } = p
  const awal = b.nilai as Record<string, unknown> | string
  const [pilih, setPilih] = useState(typeof awal === 'string' ? awal : '')
  const [bulan, setBulan] = useState({ S1: String((awal as { S1?: number }).S1 ?? 11), S2: String((awal as { S2?: number }).S2 ?? 5) })
  const [isian, setIsian] = useState<Record<string, string>>(Object.fromEntries(b.isian.map((i) => [i.kunci, i.nilai === null ? '' : String(i.nilai)])))
  const [catatan, setCatatan] = useState('')
  const nilai = (): unknown => {
    switch (b.bentuk) {
      case 'bulan':
        return { S1: Number(bulan.S1), S2: Number(bulan.S2) }
      case 'pilihan':
        return pilih
      case 'angka':
        return Object.fromEntries(Object.entries(isian).map(([k, v]) => [k, v.trim() === '' ? null : Number(v)]))
      case 'teks':
        return Object.fromEntries(Object.entries(isian).map(([k, v]) => [k, v]))
      default:
        return undefined
    }
  }
  const simpan = () =>
    aksi(
      () => tetapkanButirKurikulum(db, b.kode, { nilai: nilai(), catatan }),
      (h) => (h.status === 'ditetapkan' ? `${b.kode} Ditetapkan Kurikulum. Kirim lewat Buat berkas Kurikulum.` : `${b.kode} tersimpan — masih ada isian kosong, belum bisa ditetapkan.`),
    ).then((h) => h && p.selesai())
  return (
    <div className="formulir">
      {b.bentuk === 'bulan' ? (
        <div className="baris-kolom">
          <Pilihan label="Semester 1 (Juli–Desember)" nilai={bulan.S1} ubah={(v) => setBulan({ ...bulan, S1: v })} pilihan={[7, 8, 9, 10, 11, 12].map((m) => ({ nilai: String(m), teks: NAMA_BULAN[m - 1]! }))} />
          <Pilihan label="Semester 2 (Januari–Juni)" nilai={bulan.S2} ubah={(v) => setBulan({ ...bulan, S2: v })} pilihan={[1, 2, 3, 4, 5, 6].map((m) => ({ nilai: String(m), teks: NAMA_BULAN[m - 1]! }))} />
        </div>
      ) : null}
      {b.bentuk === 'pilihan' ? <Pilihan label="Pilihan" nilai={pilih} ubah={setPilih} pilihan={b.opsi.map(([n, t]) => ({ nilai: n, teks: t }))} lebar /> : null}
      {b.bentuk === 'angka' || b.bentuk === 'teks'
        ? b.isian.map((i) => (
            <Isian
              key={i.kunci}
              label={i.label}
              type={b.bentuk === 'angka' ? 'number' : 'text'}
              min={b.bentuk === 'angka' ? 1 : undefined}
              nilai={isian[i.kunci] ?? ''}
              ubah={(v) => setIsian({ ...isian, [i.kunci]: v })}
              bantuan={b.bentuk === 'angka' && !isian[i.kunci] ? 'Kosong = belum ditetapkan (tidak ikut TOTAL).' : undefined}
            />
          ))
        : null}
      {b.bentuk === 'konfirmasi' ? (
        <ul>
          {b.isian.map((i) => (
            <li key={i.kunci}>
              <b>{i.label}</b>: {String(i.nilai)}
            </li>
          ))}
        </ul>
      ) : null}
      <AreaTeks label="Catatan penetapan (opsional)" nilai={catatan} ubah={setCatatan} baris={2} />
      <div className="aksi aksi-kiri">
        <Tombol onClick={simpan}>{b.bentuk === 'konfirmasi' ? 'Tetapkan nilai ini' : 'Simpan & tetapkan'}</Tombol>
      </div>
    </div>
  )
}
