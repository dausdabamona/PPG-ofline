// §18 — EXE Daerah/Desa: Musyawarah & Register Kebijakan. Notulen ditulis Sekretaris di HP, disahkan Ketua (atau Wakil
// bermandat), lalu diterapkan otomatis oleh EXE Daerah saat Impor Setoran. Di sini: ringkasan, agenda berikutnya + undangan
// WA, register kebijakan (status, dasar, riwayat), daftar notulen + teks WA hasil.
import { useState } from 'react'
import {
  agendaMusyawarahBerikutnya,
  daftarKebijakan,
  daftarNotulen,
  formatTanggal,
  LABEL_MUSYAWARAH,
  LABEL_STATUS_KEBIJAKAN,
  LABEL_STATUS_NOTULEN,
  ringkasanMusyawarah,
  tambahHari,
  tanggalHariIni,
  teksWaHasil,
  teksWaUndangan,
  type BarisKebijakan,
  type NotulenTerbaca,
  type StatusKebijakan,
  type StatusNotulen,
} from '@ppg/core'
import { useApp, useData } from '../konteks'
import { AreaTeks, Isian, KeadaanData, Kartu, KepalaHalaman, Kosong, Lencana, Modal, Tombol } from '../komponen/ui'

const WARNA_KEBIJAKAN: Record<StatusKebijakan, 'hijau' | 'kuning' | 'merah'> = { ditetapkan: 'hijau', sementara: 'kuning', belum: 'merah' }
const WARNA_NOTULEN: Record<StatusNotulen, 'hijau' | 'kuning' | 'merah' | 'teal'> = { diterapkan: 'hijau', disahkan: 'teal', menunggu: 'kuning', perlu_ulang: 'merah' }

export function HalamanMusyawarah() {
  const { db, peran, wilayahId } = useApp()
  const wilayah = wilayahId ?? ''
  const desa = peran === 'desa'
  const ring = useData(() => (wilayah ? ringkasanMusyawarah(db, wilayah) : null), [db, wilayah])
  const reg = useData(() => daftarKebijakan(db, desa ? { wilayahId: wilayah } : {}), [db, wilayah])
  const notulen = useData(() => daftarNotulen(db, desa ? { wilayahIds: [wilayah] } : {}), [db, wilayah])
  return (
    <>
      <KepalaHalaman
        judul="Musyawarah & Kebijakan"
        keterangan="Sekretaris menulis notulen di HP → Ketua (atau Wakil bermandat) mengesahkan → EXE Daerah menerapkan otomatis saat Impor Setoran → kebijakan turun lewat Kirim Paket. Tanpa pengesahan, keputusan tetap usulan."
      />
      <KeadaanData hasil={ring}>{(r) => (r ? <RingkasanMusyawarahExe r={r} /> : null)}</KeadaanData>
      {wilayah ? <KartuUndangan wilayahId={wilayah} /> : null}
      <Kartu judul="Register Kebijakan">
        <KeadaanData hasil={reg} kosong={(d) => d.length === 0} teksKosong="Belum ada wilayah daerah/desa.">
          {(d) => <TabelKebijakan daftar={d} />}
        </KeadaanData>
      </Kartu>
      <Kartu judul="Notulen musyawarah">
        <KeadaanData hasil={notulen} kosong={(d) => d.length === 0} teksKosong="Belum ada notulen. Notulen ditulis Sekretaris (atau PJ desa) di HP lalu ikut Setor ke Daerah.">
          {(d) => <TabelNotulen daftar={d} />}
        </KeadaanData>
      </Kartu>
    </>
  )
}

export function RingkasanMusyawarahExe(p: { r: NonNullable<ReturnType<typeof ringkasanMusyawarah>>; aksi?: React.ReactNode }) {
  const { r } = p
  return (
    <div className="grid-angka">
      <div className={`kartu-angka${r.kebijakanSementara ? ' sorot' : ''}`}>
        <span className="judul-angka">Kebijakan masih sementara</span>
        <strong className="nilai-angka">{r.kebijakanSementara}</strong>
        <small>Dibahas di musyawarah berikutnya</small>
      </div>
      <div className={`kartu-angka${r.menungguPengesahan ? ' sorot' : ''}`}>
        <span className="judul-angka">Notulen menunggu pengesahan</span>
        <strong className="nilai-angka">{r.menungguPengesahan}</strong>
        {r.perluDisahkanUlang ? <small>{r.perluDisahkanUlang} perlu disahkan ulang</small> : null}
      </div>
      <div className="kartu-angka">
        <span className="judul-angka">Musyawarah terakhir</span>
        <strong className="nilai-angka">{r.terakhir ? formatTanggal(r.terakhir.tanggal) : '—'}</strong>
        {r.terakhir ? <small>{`${LABEL_MUSYAWARAH[r.terakhir.jenis]} · ${r.terakhir.nomor ?? ''}`}</small> : <small>Belum ada notulen</small>}
      </div>
      <div className="kartu-angka">
        <span className="judul-angka">Musyawarah berikutnya</span>
        <strong className="nilai-angka">{r.berikutnya ? r.berikutnya.judul.replace(/^Musyawarah /, '') : '—'}</strong>
        {p.aksi}
      </div>
    </div>
  )
}

function KartuUndangan(p: { wilayahId: string }) {
  const { db, platform, aksi } = useApp()
  const [tanggal, setTanggal] = useState(tambahHari(tanggalHariIni(), 7))
  const [jam, setJam] = useState('20.00')
  const [tempat, setTempat] = useState('')
  const ag = useData(() => agendaMusyawarahBerikutnya(db, p.wilayahId), [db, p.wilayahId])
  const teks = useData(() => teksWaUndangan(db, { wilayahId: p.wilayahId, tanggal, jam, tempat }), [db, p.wilayahId, tanggal, jam, tempat])
  return (
    <Kartu judul="Agenda musyawarah berikutnya & undangan WA">
      <KeadaanData hasil={ag}>
        {(a) => (
          <>
            <p>
              <b>{a.judul}</b> — {a.kebijakanSementara.length} kebijakan masih sementara otomatis masuk usulan agenda.
            </p>
            <div className="baris-kolom">
              <Isian label="Tanggal" type="date" nilai={tanggal} ubah={setTanggal} />
              <Isian label="Jam" nilai={jam} ubah={setJam} />
              <Isian label="Tempat" nilai={tempat} ubah={setTempat} />
            </div>
            <AreaTeks label="Teks undangan + agenda (WA)" nilai={teks.data ?? teks.galat ?? ''} ubah={() => undefined} baris={10} hanyaBaca />
            <div className="aksi aksi-kiri">
              <Tombol onClick={() => aksi(() => platform.salinTeks(teks.data ?? ''), 'Undangan disalin. Tempel di grup WA pengurus.')}>Salin undangan WA</Tombol>
            </div>
          </>
        )}
      </KeadaanData>
    </Kartu>
  )
}

function TabelKebijakan(p: { daftar: BarisKebijakan[] }) {
  const [riwayat, setRiwayat] = useState<BarisKebijakan | null>(null)
  return (
    <>
      <table className="tabel" aria-label="Register kebijakan">
        <thead>
          <tr>
            <th>Kode</th>
            <th>Kebijakan</th>
            <th>Lingkup</th>
            <th>Nilai berlaku</th>
            <th>Status</th>
            <th>Dasar</th>
          </tr>
        </thead>
        <tbody>
          {p.daftar.map((k) => (
            <tr key={`${k.kunci}-${k.lingkup_id}`}>
              <td>{k.kode}</td>
              <td>
                {k.judul}
                <br />
                <small className="keterangan">{k.sumber}</small>
              </td>
              <td>{k.lingkup === 'desa' ? `Desa ${k.lingkup_nama}` : 'Daerah'}</td>
              <td>{k.ringkas}</td>
              <td>
                <Lencana warna={WARNA_KEBIJAKAN[k.status]}>{LABEL_STATUS_KEBIJAKAN[k.status]}</Lencana>
              </td>
              <td>
                {k.dasar ? (
                  <>
                    No. {k.dasar.nomor ?? '—'} · {formatTanggal(k.dasar.tanggal)}
                    <br />
                    <small>Disahkan {k.disahkan_oleh}</small>
                    <br />
                    <Tombol kecil varian="tipis" onClick={() => setRiwayat(k)}>
                      Riwayat ({k.riwayat.length})
                    </Tombol>
                  </>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {riwayat ? (
        <Modal judul={`Riwayat ${riwayat.judul}${riwayat.lingkup === 'desa' ? ` — ${riwayat.lingkup_nama}` : ''}`} tutup={() => setRiwayat(null)}>
          <ol>
            {[...riwayat.riwayat].reverse().map((r, i) => (
              <li key={i}>
                Musyawarah No. {r.dasar.nomor ?? '—'} ({formatTanggal(r.dasar.tanggal)}), disahkan {r.disahkan_oleh}: <code>{JSON.stringify(r.nilai)}</code> (sebelumnya{' '}
                <code>{JSON.stringify(r.sebelumnya)}</code>)
              </li>
            ))}
          </ol>
        </Modal>
      ) : null}
    </>
  )
}

function TabelNotulen(p: { daftar: NotulenTerbaca[] }) {
  const { db, platform, aksi } = useApp()
  const [lihat, setLihat] = useState<NotulenTerbaca | null>(null)
  if (!p.daftar.length) return <Kosong teks="Belum ada notulen." />
  return (
    <>
      <table className="tabel" aria-label="Notulen musyawarah">
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Nomor</th>
            <th>Musyawarah</th>
            <th>Keputusan</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {p.daftar.map((n) => (
            <tr key={n.catatan.id}>
              <td>{formatTanggal(n.catatan.tanggal)}</td>
              <td>{n.isi.nomor ?? '—'}</td>
              <td>{LABEL_MUSYAWARAH[n.isi.jenis_musyawarah] ?? n.isi.jenis_musyawarah}</td>
              <td>
                {(n.isi.keputusan ?? []).length} butir{n.kebijakan.length ? ` · ${n.kebijakan.length} kebijakan` : ''}
              </td>
              <td>
                <Lencana warna={WARNA_NOTULEN[n.status]}>{LABEL_STATUS_NOTULEN[n.status]}</Lencana>
              </td>
              <td className="aksi-baris">
                <Tombol kecil varian="kedua" onClick={() => setLihat(n)}>
                  Lihat
                </Tombol>
                <Tombol kecil varian="tipis" onClick={() => aksi(() => platform.salinTeks(teksWaHasil(db, n.catatan.id)), 'Teks hasil musyawarah disalin.')}>
                  Salin hasil WA
                </Tombol>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {lihat ? (
        <Modal judul={`Notulen ${lihat.isi.nomor ?? ''}`} tutup={() => setLihat(null)} lebar>
          <AreaTeks label="Hasil musyawarah (teks WA)" nilai={teksWaHasil(db, lihat.catatan.id)} ubah={() => undefined} baris={14} hanyaBaca />
          {lihat.isi.uraian ? <p>Uraian: {lihat.isi.uraian}</p> : null}
        </Modal>
      ) : null}
    </>
  )
}
