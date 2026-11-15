// v3 — Absen pertemuan (mubaligh & pengurus) dan pengingat tenggat setor ke tingkat atas.
// Alur Absen: pilih pertemuan/kelas → "Materi hari ini" (saran + target kurikulum) → daftar generus kelas itu
// (Hadir/Izin/Sakit/Alpa, Semua hadir, centang Tuntas per materi) → Simpan.
import { useEffect, useMemo, useState } from 'react'
import {
  absenPertemuan,
  ambilWilayah,
  bukaPertemuan,
  buatSetor,
  cariGenerus,
  daftarPengajian,
  daftarPertemuan,
  daftarTarget,
  idPerangkatLokal,
  infoSinkronHp,
  jadwalPekan,
  kategoriKelas,
  lembarAbsenPertemuan,
  namaHari,
  pengingatSetor,
  periodeAktif,
  saranMateriPertemuan,
  tanggalDariIso,
  tanggalHariIni,
  tujuanSetor,
  type StatusPresensi,
} from '@ppg/core'
import { useApp, useData } from '../konteks'
import { Isian, JudulHalaman, KeadaanData, Kartu, Kosong, Lencana, Segmen, Spanduk, Tombol } from '../komponen/ui'
import { label, LABEL_KATEGORI, labelPeriode, tanggalTeks, waktuTeks } from '../utils/label'
import { PilihKelompok, useKelompokSaya } from './bersama'

/** Nama tujuan setor HP ini (mis. "Desa Klasaman"); token lama tanpa tujuan → "Daerah". */
export function useTujuanSetor(): string {
  const { db } = useApp()
  return useData(() => tujuanSetor(db)?.nama ?? 'Daerah', []).data ?? 'Daerah'
}

/** Tenggat ISO → "Ahad, 16 November 2026 pukul 21.00". */
function tenggatTeks(iso: string): string {
  const t = tanggalDariIso(iso)
  return `${namaHari(t)}, ${waktuTeks(iso)}`
}

/**
 * Pengingat tenggat setor (V2) di atas Absen/Beranda: tenggat berikutnya, terlambat/mendekat, data belum disetor,
 * dan tombol besar "Setor sekarang" bila mendekati/lewat tenggat (atau belum pernah setor padahal ada data).
 */
export function KartuPengingatSetor() {
  const { db, aksi, kirimBerkas } = useApp()
  const r = useData(() => ({ p: pengingatSetor(db), info: infoSinkronHp(db) }), [])
  if (!r.data?.p) return null
  const { p: x, info } = r.data
  const tujuan = x.tujuan?.nama ?? 'Daerah'
  const tujuh = !x.tenggatBerikutnya && info.perluPengingat && x.belumDisetor > 0
  const tombolBesar = x.tampilkanTombol || tujuh
  const setor = async () => {
    const b = await aksi(() => buatSetor(db))
    if (b) await kirimBerkas(b, `Berkas setoran siap. Kirim ke ${tujuan} lewat WA.`)
  }
  return (
    <Kartu judul={`Setor ke ${tujuan}`} kelas={x.terlambat ? 'pengingat-terlambat' : x.mendekat ? 'pengingat-dekat' : undefined}>
      {x.terlambat ? (
        <Spanduk jenis="bahaya">Setoran terlambat. Segera setor ke {tujuan}.</Spanduk>
      ) : x.mendekat ? (
        <Spanduk jenis="peringatan">Tenggat setor kurang dari 24 jam lagi.</Spanduk>
      ) : null}
      <p>
        {x.tenggatBerikutnya ? (
          <>
            Tenggat berikutnya: <b>{tenggatTeks(x.tenggatBerikutnya)}</b>
          </>
        ) : (
          'Jadwal setor belum ditetapkan.'
        )}
        <br />
        {x.belumDisetor ? (
          <>
            Ada <b>{x.belumDisetor}</b> data belum disetor.
          </>
        ) : (
          'Semua data sudah disetor.'
        )}{' '}
        <small>Setor terakhir: {waktuTeks(x.terakhirSetor)}</small>
      </p>
      {tombolBesar ? (
        <Tombol penuh onClick={setor}>
          Setor sekarang
        </Tombol>
      ) : x.belumDisetor ? (
        <Tombol kecil varian="kedua" onClick={setor}>
          Setor ke {tujuan}
        </Tombol>
      ) : null}
    </Kartu>
  )
}

interface OpsiPertemuan {
  kunci: string
  judul: string
  ket: string
  pengajianId: string | null
  jadwalTambahanId: string | null
  /** Kategori kelas (null = semua kategori). */
  kategori: string[] | null
}

const PILIHAN_PRESENSI: { nilai: StatusPresensi; teks: string }[] = [
  { nilai: 'hadir', teks: 'Hadir' },
  { nilai: 'izin', teks: 'Izin' },
  { nilai: 'sakit', teks: 'Sakit' },
  { nilai: 'alpa', teks: 'Alpa' },
]

function teksKelas(kat: string[] | null): string {
  return kat ? kat.map((k) => label(LABEL_KATEGORI, k)).join(', ') : 'Semua kategori'
}

/** Pilih materi hari ini: saran (paling banyak belum tuntas) + seluruh target kurikulum kelas ini. */
function PilihMateriHariIni(p: { kelompokId: string; tanggal: string; opsi: OpsiPertemuan; nilai: string[]; ubah: (v: string[]) => void }) {
  const { db } = useApp()
  const data = useData(() => {
    const periode = periodeAktif(db, p.tanggal)
    const saran = saranMateriPertemuan(db, p.kelompokId, p.opsi.kategori, { tanggal: p.tanggal, pengajianId: p.opsi.pengajianId, batas: 3 })
    let kat = p.opsi.kategori
    if (!kat) kat = [...new Set(cariGenerus(db, { kelompokId: p.kelompokId, status: 'aktif' }).map((g) => g.kategori as string))]
    const target = daftarTarget(db, { periode, kategoriGenerus: kat })
    return { periode, saran, target }
  }, [p.kelompokId, p.tanggal, p.opsi.kunci])
  const pilih = (id: string, ya: boolean) => p.ubah(ya ? [...p.nilai.filter((x) => x !== id), id] : p.nilai.filter((x) => x !== id))
  return (
    <KeadaanData hasil={data}>
      {(d) => (
        <>
          <p className="keterangan">Target {labelPeriode(d.periode)}</p>
          {d.saran.length ? (
            <>
              <h3>Saran materi</h3>
              <ul className="daftar-centang">
                {d.saran.map((s) => (
                  <li key={s.materi_id}>
                    <label className="centang">
                      <input type="checkbox" checked={p.nilai.includes(s.materi_id)} onChange={(e) => pilih(s.materi_id, e.target.checked)} />
                      <span>
                        {s.nama}
                        <small>
                          {s.belumTuntas} dari {s.jumlahGenerus} generus belum tuntas · {s.kategori_nama}
                        </small>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {!p.nilai.length ? (
                <Tombol kecil varian="kedua" onClick={() => p.ubah([d.saran[0]!.materi_id])}>
                  Pakai saran pertama
                </Tombol>
              ) : null}
            </>
          ) : d.target.length ? (
            <p>Semua target kelas ini sudah tuntas. Masyaa Allah!</p>
          ) : (
            <p>Target kurikulum untuk kelas ini belum ada. Buka paket terbaru dari desa — berkas materi ikut di dalamnya (Lainnya → Buka Berkas).</p>
          )}
          {d.target.length ? (
            <details className="lanjutan">
              <summary>Pilih dari target kurikulum ({d.target.length})</summary>
              <ul className="daftar-centang">
                {d.target.map((m) => (
                  <li key={`${m.kategori_target}-${m.id}`}>
                    <label className="centang">
                      <input type="checkbox" checked={p.nilai.includes(m.id)} onChange={(e) => pilih(m.id, e.target.checked)} />
                      <span>
                        {m.urutan_target}. {m.nama}
                        <small>
                          {label(LABEL_KATEGORI, m.kategori_target)} · {m.bidang_nama}
                        </small>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </KeadaanData>
  )
}

/** Daftar hadir pertemuan + centang tuntas per materi (hanya bila profil berhak mengesahkan). */
function LembarAbsen(p: { pertemuanId: string; ubahMateri: () => void }) {
  const { db, profil, aksi } = useApp()
  const lembar = useData(() => lembarAbsenPertemuan(db, p.pertemuanId), [p.pertemuanId])
  const [isian, setIsian] = useState<Record<string, StatusPresensi>>({})
  const [tuntas, setTuntas] = useState<Record<string, string[]>>({})
  const bisaTuntas = profil.hak.includes('sahkan')
  useEffect(() => {
    const awal: Record<string, StatusPresensi> = {}
    for (const b of lembar.data?.baris ?? []) if (b.status) awal[b.generus_id] = b.status as StatusPresensi
    setIsian(awal)
    setTuntas({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.pertemuanId])
  const terisi = Object.keys(isian).length
  return (
    <KeadaanData hasil={lembar} kosong={(d) => !d} teksKosong="Pertemuan tidak ditemukan.">
      {(d) => (
        <>
          <Kartu judul="Materi hari ini" aksi={<Tombol kecil varian="tipis" onClick={p.ubahMateri}>Ubah materi</Tombol>}>
            {d!.materi.length ? (
              <ul className="daftar-sederhana">
                {d!.materi.map((m) => (
                  <li key={m.id}>{m.nama}</li>
                ))}
              </ul>
            ) : (
              <p className="keterangan">Tanpa materi (hanya kehadiran).</p>
            )}
          </Kartu>
          {!d!.baris.length ? (
            <Kosong teks="Belum ada generus aktif di kelas ini. Buka berkas data dari desa/daerah dulu." />
          ) : (
            <Kartu
              judul={`${d!.baris.length} generus`}
              aksi={
                <Tombol kecil varian="kedua" onClick={() => setIsian(Object.fromEntries(d!.baris.map((b) => [b.generus_id, 'hadir' as StatusPresensi])))}>
                  Semua hadir
                </Tombol>
              }
            >
              <ul className="daftar-absen">
                {d!.baris.map((b) => {
                  const hadir = isian[b.generus_id] === 'hadir'
                  const dipilih = tuntas[b.generus_id] ?? []
                  return (
                    <li key={b.generus_id}>
                      <span className="nama">
                        {b.nama} <small>· {label(LABEL_KATEGORI, b.kategori)}</small>
                      </span>
                      <Segmen
                        kecil
                        label={`Kehadiran ${b.nama}`}
                        nilai={isian[b.generus_id] ?? null}
                        ubah={(v) => setIsian((s) => ({ ...s, [b.generus_id]: v }))}
                        pilihan={PILIHAN_PRESENSI}
                      />
                      {bisaTuntas && d!.materi.length ? (
                        <div className="tuntas-generus">
                          {d!.materi.map((m) =>
                            b.tuntas[m.id] ? (
                              <span key={m.id} className="centang sudah">
                                ✓ {d!.materi.length > 1 ? m.nama : 'Sudah tuntas'}
                              </span>
                            ) : (
                              <label key={m.id} className="centang">
                                <input
                                  type="checkbox"
                                  aria-label={`Tuntas ${m.nama} ${b.nama}`}
                                  disabled={!hadir}
                                  checked={hadir && dipilih.includes(m.id)}
                                  onChange={(e) =>
                                    setTuntas((s) => ({
                                      ...s,
                                      [b.generus_id]: e.target.checked ? [...dipilih, m.id] : dipilih.filter((x) => x !== m.id),
                                    }))
                                  }
                                />
                                Tuntas{d!.materi.length > 1 ? `: ${m.nama}` : ''}
                              </label>
                            ),
                          )}
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
              {bisaTuntas && d!.materi.length ? (
                <p className="keterangan">Centang “Tuntas” untuk generus yang hadir dan sudah menuntaskan materi hari ini (langsung disahkan).</p>
              ) : null}
              <Tombol
                penuh
                disabled={!terisi}
                onClick={async () => {
                  const r = await aksi(
                    () =>
                      absenPertemuan(
                        db,
                        p.pertemuanId,
                        Object.entries(isian).map(([generusId, status]) => ({
                          generusId,
                          status,
                          tuntas: status === 'hadir' && bisaTuntas ? tuntas[generusId] ?? [] : [],
                        })),
                      ),
                    (h) => `Absen tersimpan: ${h.presensi} generus${h.tuntas ? `, ${h.tuntas} materi tuntas` : ''}.`,
                  )
                  if (r) setTuntas({})
                }}
              >
                Simpan absen ({terisi})
              </Tombol>
            </Kartu>
          )}
        </>
      )}
    </KeadaanData>
  )
}

/** Layar Absen (mubaligh & pengurus). */
export function HalamanAbsen(p: { sapaan?: string }) {
  const { db, profil, aksi } = useApp()
  const kelSaya = useKelompokSaya()
  const [kelompokId, setKelompokId] = useState(profil.tingkat === 'kelompok' ? profil.wilayah_id : '')
  const kel = kelompokId || kelSaya[0]?.id || ''
  const [tanggal, setTanggal] = useState(tanggalHariIni())
  const [kunci, setKunci] = useState('')
  const [materiIds, setMateriIds] = useState<string[]>([])
  const [pertemuanId, setPertemuanId] = useState<string | null>(null)

  const opsi = useData((): OpsiPertemuan[] => {
    if (!kel) return []
    const pengajian = new Map(daftarPengajian(db).map((x) => [x.id, x]))
    const acara = jadwalPekan(db, kel, tanggal).acara.filter((a) => a.tanggal === tanggal && !a.dibatalkan)
    const l: OpsiPertemuan[] = acara.map((a) => {
      const kat = a.pengajian_id ? kategoriKelas(pengajian.get(a.pengajian_id)) : null
      return {
        kunci: a.jenis === 'rutin' ? `r:${a.pengajian_id}` : `t:${a.jadwal_tambahan_id}`,
        judul: a.judul,
        ket: `${a.jam ? `${a.jam} · ` : ''}${a.jenis === 'tambahan' ? 'Jadwal tambahan' : teksKelas(kat)}`,
        pengajianId: a.pengajian_id,
        jadwalTambahanId: a.jadwal_tambahan_id,
        kategori: kat,
      }
    })
    l.push({ kunci: 'lain', judul: 'Pertemuan lain', ket: 'Di luar jadwal · semua kategori', pengajianId: null, jadwalTambahanId: null, kategori: null })
    return l
  }, [kel, tanggal])
  const dipilih = opsi.data?.find((o) => o.kunci === kunci)

  // pilih pertemuan → isi materi dari pertemuan yang sudah pernah dibuka di HP ini
  const pilihPertemuan = (o: OpsiPertemuan) => {
    setKunci(o.kunci)
    setPertemuanId(null)
    const saya = idPerangkatLokal(db)
    const ada = daftarPertemuan(db, kel, { mulai: tanggal, selesai: tanggal }).find(
      (x) => x.perangkat_id === saya && (x.pengajian_id ?? null) === o.pengajianId && (x.jadwal_tambahan_id ?? null) === o.jadwalTambahanId,
    )
    setMateriIds(ada?.materi_ids ?? [])
  }
  const gantiKonteks = () => {
    setKunci('')
    setPertemuanId(null)
    setMateriIds([])
  }

  const namaKelompok = useMemo(() => (kel ? ambilWilayah(db, kel)?.nama ?? '' : ''), [db, kel])

  return (
    <>
      <JudulHalaman judul="Absen" keterangan={p.sapaan} />
      {pertemuanId && dipilih ? (
        <>
          <Kartu>
            <div className="ringkas-pertemuan">
              <span>
                <b>{dipilih.judul}</b>
                <small>
                  {' '}
                  · {namaHari(tanggal)}, {tanggalTeks(tanggal)}
                  {namaKelompok && kelSaya.length > 1 ? ` · ${namaKelompok}` : ''}
                </small>
              </span>
              <Tombol kecil varian="tipis" onClick={gantiKonteks}>
                Ganti
              </Tombol>
            </div>
          </Kartu>
          <LembarAbsen pertemuanId={pertemuanId} ubahMateri={() => setPertemuanId(null)} />
        </>
      ) : (
        <>
          <KartuPengingatSetor />
          <Kartu judul="1. Pilih pertemuan">
            <PilihKelompok
              nilai={kel}
              ubah={(v) => {
                setKelompokId(v)
                gantiKonteks()
              }}
            />
            <Isian
              label="Tanggal"
              type="date"
              nilai={tanggal}
              ubah={(v) => {
                if (!v) return
                setTanggal(v)
                gantiKonteks()
              }}
            />
            <KeadaanData hasil={opsi}>
              {(d) => (
                <div className="pilih-pertemuan" role="radiogroup" aria-label="Pertemuan">
                  {d.map((o) => (
                    <button key={o.kunci} type="button" role="radio" aria-checked={o.kunci === kunci} onClick={() => pilihPertemuan(o)}>
                      {o.judul}
                      <small>{o.ket}</small>
                    </button>
                  ))}
                </div>
              )}
            </KeadaanData>
          </Kartu>
          {dipilih ? (
            <Kartu judul="2. Materi hari ini">
              <PilihMateriHariIni kelompokId={kel} tanggal={tanggal} opsi={dipilih} nilai={materiIds} ubah={setMateriIds} />
              {materiIds.length ? (
                <p>
                  Dipilih: <Lencana warna="teal">{materiIds.length} materi</Lencana>
                </p>
              ) : null}
              <Tombol
                penuh
                onClick={async () => {
                  const pt = await aksi(() =>
                    bukaPertemuan(db, { kelompokId: kel, tanggal, pengajianId: dipilih.pengajianId, jadwalTambahanId: dipilih.jadwalTambahanId, materiIds }),
                  )
                  if (pt) setPertemuanId(pt.id)
                }}
              >
                {materiIds.length ? 'Lanjut: isi kehadiran' : 'Lanjut tanpa materi'}
              </Tombol>
            </Kartu>
          ) : null}
        </>
      )}
    </>
  )
}
