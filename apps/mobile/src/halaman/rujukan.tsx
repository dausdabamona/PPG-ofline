// §21.3–21.4 (Fase 15) — HP: formulir Rujuk ke BK (mubaligh & pengurus), rujukan saya (status saja), kartu saran keaktifan
// < 50 % dua bulan (mubaligh), daftar rujukan masuk BK (Terima/Tangani/Selesai, Jadikan catatan konseling, Naikkan),
// tombol Hubungi BK (orang tua & generus Remaja/Pra Nikah, tanpa rekaman), dan kunci PIN wajib profil BK/keuangan.
import { useState, type ReactNode } from 'react'
import {
  aturPin,
  bolehHubungiBk,
  daftarRujukanMasuk,
  daftarRujukanSaya,
  generusBolehDirujuk,
  jadikanCatatanKonseling,
  KATEGORI_RUJUKAN,
  kontakBkUntuk,
  LABEL_KATEGORI_RUJUKAN,
  naikkanRujukan,
  perluPinWajib,
  saranRujukKeaktifan,
  simpanRujukan,
  tautanHubungiBk,
  tujuanRujukan,
  tutupSaranRujuk,
  ubahStatusRujukan,
  type BerkasKeluar,
  type KategoriRujukan,
  type RujukanMasuk,
} from '@ppg/core'
import { useApp, useData } from '../konteks'
import { AreaTeks, Isian, JudulHalaman, KeadaanData, Kartu, Lencana, Modal, Pilihan, Segmen, Spanduk, Tombol } from '../komponen/ui'
import { label, LABEL_KATEGORI, tanggalTeks } from '../utils/label'

const NAMA_TINGKAT: Record<string, string> = { kelompok: 'BK Kelompok', desa: 'BK Desa', daerah: 'BK Daerah' }

// ---------------------------------------------------------------------------------------------------------------------
// Perujuk (mubaligh & pengurus)
// ---------------------------------------------------------------------------------------------------------------------

/** Formulir Rujuk ke BK (1 layar) + daftar rujukan saya. */
export function HalamanRujukBk(p: { kembali: () => void; generusAwal?: string }) {
  const { db, aksi, kirimBerkas } = useApp()
  const generus = useData(() => generusBolehDirujuk(db), [])
  const [gid, setGid] = useState(p.generusAwal ?? '')
  const [kategori, setKategori] = useState<KategoriRujukan | null>(p.generusAwal ? 'keaktifan' : null)
  const [uraian, setUraian] = useState('')
  const [segera, setSegera] = useState(false)
  const [langsung, setLangsung] = useState(false)
  const [hasil, setHasil] = useState<{ berkas: BerkasKeluar | null; pesanSegera: string | null; tujuan: string } | null>(null)
  const tujuan = useData(() => (gid ? tujuanRujukan(db, gid, { langsungDaerah: segera && langsung }) : null), [gid, segera, langsung])
  const kirim = async () => {
    const r = await aksi(
      () => simpanRujukan(db, { generusId: gid, kategori: kategori!, uraian, segera, langsungDaerah: segera && langsung }),
      'Rujukan tersimpan. Ikut terkirim saat Setor.',
    )
    if (!r) return
    setHasil({ berkas: r.berkas, pesanSegera: r.pesanSegera, tujuan: `${NAMA_TINGKAT[r.tujuan.tingkat]} ${r.tujuan.nama}` })
    setUraian('')
    setSegera(false)
    setLangsung(false)
    setKategori(null)
    setGid('')
  }
  return (
    <>
      <JudulHalaman judul="Rujuk ke BK" keterangan="Isi singkat. Hanya BK tujuan yang bisa membaca isinya." kembali={p.kembali} />
      {hasil ? (
        <Kartu judul="Rujukan terkirim">
          {hasil.pesanSegera ? <Spanduk jenis="bahaya">{hasil.pesanSegera}</Spanduk> : null}
          <p>
            Tujuan: <b>{hasil.tujuan}</b>. Rujukan juga ikut Setor berikutnya.
          </p>
          {hasil.berkas ? (
            <Tombol penuh varian="wa" onClick={() => void kirimBerkas({ nama: hasil.berkas!.nama, bytes: hasil.berkas!.bytes }, 'Berkas rujukan dibagikan.')}>
              Kirim berkas rujukan ke BK (WA)
            </Tombol>
          ) : (
            <p className="keterangan">HP BK tujuan belum dikenal di HP ini — rujukan sampai lewat Setor.</p>
          )}
          <Tombol penuh varian="kedua" onClick={() => setHasil(null)}>
            Buat rujukan lain
          </Tombol>
        </Kartu>
      ) : (
        <Kartu>
          <KeadaanData hasil={generus} kosong={(d) => !d.length} teksKosong="Belum ada data generus di HP ini. Buka paket terbaru dulu.">
            {(d) => (
              <Pilihan
                label="Generus"
                nilai={gid}
                ubah={setGid}
                kosong="— pilih generus —"
                pilihan={d.map((g) => ({ nilai: g.id, teks: `${g.nama} · ${g.kelompok} · ${label(LABEL_KATEGORI, g.kategori)}` }))}
              />
            )}
          </KeadaanData>
          <div className="pilih-kategori-rujukan">
            <Segmen label="Kategori" nilai={kategori} ubah={setKategori} pilihan={KATEGORI_RUJUKAN.map((k) => ({ nilai: k, teks: LABEL_KATEGORI_RUJUKAN[k] }))} />
          </div>
          <AreaTeks label="Uraian singkat" nilai={uraian} ubah={setUraian} baris={4} placeholder="Apa yang terlihat, sejak kapan, sudah dicoba apa." />
          <ul className="daftar-centang">
            <li>
              <label>
                <input type="checkbox" checked={segera} onChange={(e) => { setSegera(e.target.checked); if (!e.target.checked) setLangsung(false) }} />
                <b>Segera</b> (perlu ditangani cepat)
              </label>
            </li>
            {segera ? (
              <li>
                <label>
                  <input type="checkbox" checked={langsung} onChange={(e) => setLangsung(e.target.checked)} />
                  Kirim langsung ke BK Daerah
                </label>
              </li>
            ) : null}
          </ul>
          {gid ? (
            <KeadaanData hasil={tujuan}>
              {(t) =>
                t ? (
                  <p className="keterangan">
                    Akan diterima: <b>{NAMA_TINGKAT[t.tingkat]} {t.nama}</b>
                    {t.dilewati.some((x) => x.alasan === 'tidak_ada_bk') ? ' (BK tingkat bawah belum ada)' : ''}
                    {t.dilewati.some((x) => x.alasan === 'kerabat') ? ' (diteruskan ke tingkat atas)' : ''}
                  </p>
                ) : null
              }
            </KeadaanData>
          ) : null}
          <Tombol penuh disabled={!gid || !kategori || !uraian.trim()} onClick={() => void kirim()}>
            Kirim rujukan
          </Tombol>
        </Kartu>
      )}
      <DaftarRujukanSaya />
    </>
  )
}

/** "Rujukan ke BK — tanggal — status" (tanpa isi). */
export function DaftarRujukanSaya() {
  const { db } = useApp()
  const d = useData(() => daftarRujukanSaya(db), [])
  return (
    <Kartu judul="Rujukan saya">
      <KeadaanData hasil={d} kosong={(x) => !x.length} teksKosong="Belum ada rujukan.">
        {(x) => (
          <ul className="daftar-sederhana">
            {x.map((r) => (
              <li key={r.id}>
                <span>
                  Rujukan ke {r.tujuan} <small>{tanggalTeks(r.tanggal)}</small>
                </span>
                <Lencana warna={r.status === 'selesai' ? 'hijau' : r.status === 'terkirim' ? 'abu' : 'teal'}>{r.label}</Lencana>
              </li>
            ))}
          </ul>
        )}
      </KeadaanData>
    </Kartu>
  )
}

/** Kartu saran "Rujuk ke BK?" (keaktifan < 50 % dua bulan berturut-turut) di HP mubaligh. */
export function KartuSaranRujuk(p: { rujuk: (generusId: string) => void }) {
  const { db, profil, aksi } = useApp()
  const d = useData(() => (profil.role === 'mubaligh' ? saranRujukKeaktifan(db, profil.wilayah_id) : []), [profil.id])
  const l = d.data ?? []
  if (!l.length) return null
  return (
    <Kartu judul="Rujuk ke BK?">
      <p className="keterangan">Keaktifan di bawah 50 % dua bulan berturut-turut.</p>
      <ul className="daftar-sederhana">
        {l.map((s) => (
          <li key={s.generus_id}>
            <span>
              {s.nama}
              <br />
              <small>
                {s.bulan[0]}: {s.persen[0]}% · {s.bulan[1]}: {s.persen[1]}%
              </small>
            </span>
            <span className="aksi-baris">
              <Tombol kecil onClick={() => p.rujuk(s.generus_id)}>Rujuk</Tombol>
              <Tombol kecil varian="kedua" onClick={() => void aksi(() => tutupSaranRujuk(db, s.generus_id))}>
                Tutup
              </Tombol>
            </span>
          </li>
        ))}
      </ul>
    </Kartu>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// BK: rujukan masuk
// ---------------------------------------------------------------------------------------------------------------------

const LABEL_STATUS_MASUK: Record<RujukanMasuk['status'], string> = {
  baru: 'Baru',
  diterima: 'Diterima',
  ditangani: 'Ditangani',
  selesai: 'Selesai',
  dinaikkan: 'Diteruskan',
}

export function RujukanMasukBk() {
  const { db, aksi, kirimBerkas } = useApp()
  const [semua, setSemua] = useState(false)
  const d = useData(() => daftarRujukanMasuk(db, { semua }), [semua])
  const [naik, setNaik] = useState<RujukanMasuk | null>(null)
  return (
    <Kartu judul="Rujukan masuk">
      <p className="keterangan">Dari mubaligh & pengurus (berkas WA atau paket). Buka berkas PPG_RUJUKAN di menu Sinkron → Buka Berkas.</p>
      <KeadaanData hasil={d} kosong={(x) => !x.length} teksKosong={semua ? 'Belum ada rujukan.' : 'Tidak ada rujukan yang perlu ditangani.'}>
        {(x) => (
          <ul className="daftar-sederhana">
            {x.map((r) => (
              <li key={r.id} className="baris-rujukan">
                <span>
                  {r.isi.segera ? <Lencana warna="merah">Segera</Lencana> : null} <b>{r.isi.nama ?? '—'}</b> · {LABEL_KATEGORI_RUJUKAN[r.isi.kategori] ?? r.isi.kategori}{' '}
                  <small>{tanggalTeks(r.tanggal)}</small>
                  {r.dariBawah ? <small> · diteruskan BK bawah</small> : null}
                  <br />
                  {r.isi.uraian}
                  <br />
                  <small>Perujuk: {r.isi.perujuk ?? '—'}</small>
                  {r.perluPengingat ? <Spanduk jenis="peringatan">Rujukan Segera belum diterima ≥ 3 hari.</Spanduk> : null}
                </span>
                <span className="aksi-baris">
                  <Lencana warna={r.status === 'selesai' ? 'hijau' : r.status === 'baru' ? 'kuning' : 'teal'}>{LABEL_STATUS_MASUK[r.status]}</Lencana>
                  {r.status === 'baru' ? <Tombol kecil onClick={() => void aksi(() => ubahStatusRujukan(db, r.id, 'diterima'), 'Diterima.')}>Terima</Tombol> : null}
                  {r.status === 'baru' || r.status === 'diterima' ? (
                    <Tombol kecil varian="kedua" onClick={() => void aksi(() => ubahStatusRujukan(db, r.id, 'ditangani'), 'Ditandai ditangani.')}>
                      Tangani
                    </Tombol>
                  ) : null}
                  {r.status !== 'selesai' && r.status !== 'dinaikkan' ? (
                    <>
                      {!r.catatanKonselingId ? (
                        <Tombol kecil varian="kedua" onClick={() => void aksi(() => jadikanCatatanKonseling(db, r.id), 'Catatan konseling dibuat.')}>
                          Jadikan catatan konseling
                        </Tombol>
                      ) : null}
                      <Tombol kecil varian="kedua" onClick={() => setNaik(r)}>
                        Naikkan
                      </Tombol>
                      <Tombol kecil varian="kedua" onClick={() => void aksi(() => ubahStatusRujukan(db, r.id, 'selesai'), 'Rujukan selesai.')}>
                        Selesai
                      </Tombol>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </KeadaanData>
      <Tombol kecil varian="kedua" onClick={() => setSemua((x) => !x)}>
        {semua ? 'Sembunyikan yang selesai' : 'Tampilkan semua (termasuk selesai)'}
      </Tombol>
      {naik ? <FormNaikkan r={naik} tutup={() => setNaik(null)} kirim={(b) => void kirimBerkas({ nama: b.nama, bytes: b.bytes }, 'Berkas rujukan dibagikan.')} /> : null}
    </Kartu>
  )
}

function FormNaikkan(p: { r: RujukanMasuk; tutup: () => void; kirim: (b: BerkasKeluar) => void }) {
  const { db, aksi } = useApp()
  const [ke, setKe] = useState<'desa' | 'daerah' | null>(null)
  const [uraian, setUraian] = useState('')
  const simpan = async () => {
    const h = await aksi(() => naikkanRujukan(db, p.r.id, { ke: ke!, uraian }), 'Rujukan diteruskan ke BK tingkat atas.')
    if (!h) return
    if (h.berkas) p.kirim(h.berkas)
    p.tutup()
  }
  return (
    <Modal
      judul="Naikkan rujukan"
      tutup={p.tutup}
      aksi={
        <Tombol disabled={!ke || !uraian.trim()} onClick={() => void simpan()}>
          Naikkan
        </Tombol>
      }
    >
      <Segmen label="Ke" nilai={ke} ubah={setKe} pilihan={[{ nilai: 'desa', teks: 'BK Desa' }, { nilai: 'daerah', teks: 'BK Daerah' }]} />
      <AreaTeks label="Tulis ulang uraian untuk BK atas (isi asli tidak ikut terbuka)" nilai={uraian} ubah={setUraian} baris={4} />
    </Modal>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// Hubungi BK — orang tua & generus Remaja/Pra Nikah
// ---------------------------------------------------------------------------------------------------------------------

export function KartuHubungiBk() {
  const { db, profil, platform } = useApp()
  const boleh = useData(() => bolehHubungiBk(db, profil), [profil.id]).data
  const kontak = useData(() => kontakBkUntuk(db, profil.wilayah_id), [profil.id])
  const [buka, setBuka] = useState(false)
  if (!boleh) return null
  const peran = profil.role === 'wali' ? 'wali' : 'generus'
  return (
    <Kartu judul="Hubungi BK">
      <p className="keterangan">Ingin bercerita atau berkonsultasi? Pesan langsung lewat WA ke BK — tidak tercatat di aplikasi.</p>
      {!buka ? (
        <Tombol penuh varian="wa" onClick={() => setBuka(true)}>
          Hubungi BK
        </Tombol>
      ) : (
        <KeadaanData hasil={kontak} kosong={(x) => !x.length} teksKosong="Nomor BK belum tersedia. Tanyakan ke mubaligh kelompok.">
          {(x) => (
            <div className="tumpuk">
              {x.map((k) => (
                <Tombol key={k.wilayah_id} penuh varian="wa" onClick={() => platform.bukaTautan(tautanHubungiBk(k.nomor, peran))}>
                  {NAMA_TINGKAT[k.tingkat]} · {k.nama}
                </Tombol>
              ))}
            </div>
          )}
        </KeadaanData>
      )}
    </Kartu>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// PIN wajib (profil pengurus ber-BK/bendahara/penggalang dana)
// ---------------------------------------------------------------------------------------------------------------------

export function KunciPinWajib(p: { children: ReactNode }) {
  const { db, profil, aksi } = useApp()
  const [pin, setPin] = useState('')
  const [ulang, setUlang] = useState('')
  if (!perluPinWajib(profil) || profil.ada_pin) return <>{p.children}</>
  return (
    <>
      <JudulHalaman judul="Pasang PIN dulu" />
      <Spanduk jenis="peringatan">Profil ini memegang data rahasia (BK/keuangan). Menu Bidang terkunci sampai PIN dipasang. PIN diminta setiap membuka profil ini.</Spanduk>
      <Kartu>
        <Isian label="PIN baru (4 angka)" type="password" inputMode="numeric" maxLength={4} nilai={pin} ubah={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))} />
        <Isian label="Ulangi PIN" type="password" inputMode="numeric" maxLength={4} nilai={ulang} ubah={(v) => setUlang(v.replace(/\D/g, '').slice(0, 4))} />
        {ulang.length === 4 && ulang !== pin ? <p className="keterangan">PIN tidak sama.</p> : null}
        <Tombol penuh disabled={pin.length !== 4 || pin !== ulang} onClick={() => void aksi(() => aturPin(db, profil.id, pin), 'PIN terpasang.')}>
          Pasang PIN
        </Tombol>
      </Kartu>
    </>
  )
}

