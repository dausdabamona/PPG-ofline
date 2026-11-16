// Layar peran Wali (orang tua): Target (Materi yang perlu dituntaskan) · Laporan Pekanan tiap anak · Kemajuan · Kehadiran · Buka Berkas.
import { KartuHubungiBk } from './rujukan'
import { useState, type ReactNode } from 'react'
import { daftarPresensi, generusProfil, laporanPekanan, tambahHari, tanggalHariIni, type MateriGenerus } from '@ppg/core'
import { useApp, useData } from '../konteks'
import { DaftarMateri, RincianMateri, useMateriGenerus } from '../komponen/materi'
import { Angka, JudulHalaman, KeadaanData, Kartu, Kosong, Lencana, Segmen, Tombol } from '../komponen/ui'
import { label, LABEL_PRESENSI, tanggalTeks } from '../utils/label'
import { MateriPerluDituntaskan } from '../komponen/tuntas'
import { KartuKejarTarget, KartuKeaktifan, TombolRapor } from '../komponen/juknis'
import { KartuBukaBerkas } from './bersama'

/** Pilih anak (bila wali punya lebih dari satu anak). */
function useAnak(): { anak: { id: string; nama: string }[]; gid: string; setGid: (v: string) => void; pemilih: ReactNode } {
  const { db, profil } = useApp()
  const anak = useData(() => generusProfil(db, profil.id).map((g) => ({ id: g.id, nama: g.nama })), [profil.id]).data ?? []
  const [pilih, setGid] = useState('')
  const gid = anak.some((a) => a.id === pilih) ? pilih : anak[0]?.id ?? ''
  const pemilih =
    anak.length > 1 ? <Segmen label="Pilih anak" nilai={gid} ubah={setGid} pilihan={anak.map((a) => ({ nilai: a.id, teks: a.nama }))} /> : null
  return { anak, gid, setGid, pemilih }
}

const BELUM_ADA = 'Data anak belum ada di HP ini. Buka berkas balasan dari mubaligh di menu Berkas.'

/** Layar pertama orang tua: materi yang perlu dituntaskan anak (pilih anak bila lebih dari satu). */
export function TargetWali() {
  const { anak, gid, pemilih } = useAnak()
  return (
    <>
      <JudulHalaman judul="Materi yang perlu dituntaskan" />
      {!anak.length ? <Kosong teks={BELUM_ADA} /> : null}
      {pemilih}
      {gid ? <KartuKejarTarget key={`k${gid}`} generusId={gid} nama={anak.find((a) => a.id === gid)?.nama} /> : null}
      {gid ? <KartuKeaktifan key={`a${gid}`} generusId={gid} bolehIsi={false} /> : null}
      {gid ? <MateriPerluDituntaskan key={gid} generusId={gid} teksKosong={BELUM_ADA} anak /> : null}
      {gid ? (
        <div className="tumpuk">
          <TombolRapor generusId={gid} nama={anak.find((a) => a.id === gid)?.nama ?? ''} />
        </div>
      ) : null}
      {/* §21.4: orang tua menghubungi BK lewat WA langsung (tanpa rekaman di aplikasi) */}
      <KartuHubungiBk />
    </>
  )
}

export function LaporanWali() {
  const { db } = useApp()
  const { anak, gid, pemilih } = useAnak()
  const [acuan, setAcuan] = useState(tanggalHariIni())
  const lap = useData(() => (gid ? laporanPekanan(db, gid, acuan) : null), [gid, acuan])
  return (
    <>
      <JudulHalaman judul="Laporan Pekanan" />
      {!anak.length ? <Kosong teks={BELUM_ADA} /> : null}
      {pemilih}
      {gid ? (
        <>
          <div className="nav-pekan">
            <Tombol kecil varian="kedua" onClick={() => setAcuan(tambahHari(acuan, -7))} label="Pekan sebelumnya">
              ‹
            </Tombol>
            <span>{lap.data ? `${tanggalTeks(lap.data.pekan.mulai)} – ${tanggalTeks(lap.data.pekan.selesai)}` : ''}</span>
            <Tombol kecil varian="kedua" onClick={() => setAcuan(tambahHari(acuan, 7))} label="Pekan berikutnya">
              ›
            </Tombol>
          </div>
          <KeadaanData hasil={lap} kosong={(d) => !d} teksKosong={BELUM_ADA}>
            {(l) =>
              l!.mondok ? (
                <Kartu judul={l!.generus.nama}>
                  <p>
                    <Lencana warna="kuning">Mondok</Lencana> Ananda sedang mondok. Laporan dilanjutkan setelah kembali aktif.
                  </p>
                </Kartu>
              ) : (
                <>
                  <Kartu judul={`Laporan ${l!.generus.nama}`}>
                    <div className="baris-angka">
                      <Angka nilai={l!.presensi.hadir} teks="Hadir" warna="hijau" />
                      <Angka nilai={l!.presensi.izin + l!.presensi.sakit} teks="Izin/Sakit" warna="kuning" />
                      <Angka nilai={l!.presensi.alpa} teks="Alpa" warna="merah" />
                      <Angka nilai={l!.materiDisahkan.length} teks="Materi disahkan" />
                    </div>
                    {l!.presensi.total === 0 ? <p className="keterangan">Belum ada catatan kehadiran pekan ini.</p> : null}
                  </Kartu>
                  <Kartu judul="Materi disahkan pekan ini">
                    {l!.materiDisahkan.length ? (
                      <ul className="daftar-sederhana">
                        {l!.materiDisahkan.map((m) => (
                          <li key={m.kemajuan_id}>
                            <span>
                              {m.materi}
                              <small> · {m.kategori}</small>
                            </span>
                            <Lencana warna={m.status === 'selesai' ? 'hijau' : 'teal'}>
                              {m.status === 'selesai' ? 'Selesai' : 'Sedang'}
                              {m.nilai !== null ? ` · ${m.nilai}` : ''}
                            </Lencana>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="keterangan">Belum ada pekan ini.</p>
                    )}
                  </Kartu>
                  {l!.materiDiajukan.length ? (
                    <Kartu judul="Menunggu disimak mubaligh">
                      <ul className="daftar-sederhana">
                        {l!.materiDiajukan.map((m) => (
                          <li key={m.kemajuan_id}>{m.materi}</li>
                        ))}
                      </ul>
                    </Kartu>
                  ) : null}
                  {l!.catatanMubaligh.length ? (
                    <Kartu judul="Catatan mubaligh">
                      <ul className="daftar-sederhana">
                        {l!.catatanMubaligh.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </Kartu>
                  ) : null}
                  {l!.targetBerikutnya.length ? (
                    <Kartu judul="★ Target berikutnya">
                      <ul className="daftar-sederhana">
                        {l!.targetBerikutnya.map((t) => (
                          <li key={t.materi_id}>
                            {t.materi}
                            <small> · {t.kategori}</small>
                          </li>
                        ))}
                      </ul>
                    </Kartu>
                  ) : null}
                </>
              )
            }
          </KeadaanData>
        </>
      ) : null}
    </>
  )
}

export function KemajuanWali() {
  const { anak, gid, pemilih } = useAnak()
  const materi = useMateriGenerus(gid || undefined)
  const [buka, setBuka] = useState<MateriGenerus | null>(null)
  return (
    <>
      <JudulHalaman judul="Kemajuan" />
      {!anak.length ? <Kosong teks={BELUM_ADA} /> : null}
      {pemilih}
      {gid ? (
        <KeadaanData hasil={materi} kosong={(d) => !d || d.ringkasan.total === 0} teksKosong="Daftar materi belum ada.">
          {(d) => <DaftarMateri data={d!} buka={setBuka} />}
        </KeadaanData>
      ) : null}
      {buka ? <RincianMateri m={buka} tutup={() => setBuka(null)} /> : null}
    </>
  )
}

export function KehadiranWali() {
  const { db } = useApp()
  const { anak, gid, pemilih } = useAnak()
  const hariIni = tanggalHariIni()
  const data = useData(() => {
    if (!gid) return []
    return daftarPresensi(db, { generusIds: [gid], mulai: tambahHari(hariIni, -60), selesai: hariIni }).sort((a, b) => b.tanggal.localeCompare(a.tanggal))
  }, [gid])
  const hit = (s: string) => (data.data ?? []).filter((p) => p.status === s).length
  return (
    <>
      <JudulHalaman judul="Kehadiran" keterangan="60 hari terakhir" />
      {!anak.length ? <Kosong teks={BELUM_ADA} /> : null}
      {pemilih}
      {gid ? (
        <KeadaanData hasil={data} kosong={(d) => d.length === 0} teksKosong="Belum ada catatan kehadiran.">
          {(d) => (
            <>
              <Kartu>
                <div className="baris-angka">
                  <Angka nilai={hit('hadir')} teks="Hadir" warna="hijau" />
                  <Angka nilai={hit('izin')} teks="Izin" warna="kuning" />
                  <Angka nilai={hit('sakit')} teks="Sakit" warna="kuning" />
                  <Angka nilai={hit('alpa')} teks="Alpa" warna="merah" />
                </div>
              </Kartu>
              <Kartu judul="Rincian">
                <ul className="daftar-sederhana">
                  {d.map((p) => (
                    <li key={p.id}>
                      <span>{tanggalTeks(p.tanggal)}</span>
                      <Lencana warna={p.status === 'hadir' ? 'hijau' : p.status === 'alpa' ? 'merah' : 'kuning'}>{label(LABEL_PRESENSI, p.status)}</Lencana>
                    </li>
                  ))}
                </ul>
              </Kartu>
            </>
          )}
        </KeadaanData>
      ) : null}
    </>
  )
}

export function BerkasWali() {
  return (
    <>
      <JudulHalaman judul="Berkas" keterangan="Buka berkas balasan atau jadwal yang dikirim mubaligh lewat WA." />
      <KartuBukaBerkas />
    </>
  )
}
