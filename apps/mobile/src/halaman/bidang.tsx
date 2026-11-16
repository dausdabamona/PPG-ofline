// §17 — HP pengurus berjabatan: Beranda bidang (ringkasan & pengingat) dan menu Bidang yang hanya menampilkan fitur
// jabatannya (ketua, sekretaris, bendahara, kurikulum, tenaga pendidik, penggalang dana, sarpras, muda/i, olahraga & seni,
// kemandirian, keputrian, BK, tahfidz, PJ desa/kelompok) + NUNGGONI; kontrol keaktifan MT untuk mubaligh.
import { useState, type ReactNode } from 'react'
import {
  AKUN_KAS,
  catatKeaktifan,
  cariGenerus,
  daftarCatatan,
  daftarWilayah,
  GROUP_PEMBINAAN,
  hapusCatatan,
  isiKontrolMt,
  daftarRujukanMasuk,
  jabatanProfil,
  JENIS_CATATAN,
  penugasanProfil,
  pengingatRujukanSegera,
  turunanWilayah,
  KATEGORI_GENERUS,
  KODE_KEAKTIFAN,
  KONDISI_SARPRAS,
  konfirmasiDanaMasuk,
  LABEL_JABATAN,
  LABEL_JENJANG,
  PENDIDIKAN,
  PERUNTUKAN_TABUNGAN,
  pengingatLaporan,
  periodeAktif,
  rekapKeaktifanBulan,
  rekapKontrolMt,
  rekapTahfidz,
  rewardHasilBelajar,
  ringkasanKas,
  ringkasanKetua,
  simpanCatatan,
  SURAT_TAHFIDZ,
  tanggalHariIni,
  teksWaRekapKeaktifan,
  UNSUR_NUNGGONI,
  JENIS_MUSYAWARAH,
  type CatatanTerbaca,
  type Jabatan,
  type JenisCatatan,
  type KategoriGenerus,
  type Penugasan,
} from '@ppg/core'
import { useApp, useData } from '../konteks'
import type { PropHalaman } from '../kerangka'
import { AreaTeks, Angka, Isian, JudulHalaman, KeadaanData, Kartu, Kosong, Lencana, MenuDaftar, Modal, Pilihan, Spanduk, Tombol } from '../komponen/ui'
import { KartuPengingatSetor } from './absen'
import { LaporanBulananHp } from './juknis'
import { KartuMusyawarahHp, MusyawarahHp, PerluDitetapkanHp } from './musyawarah'
import { label, LABEL_KATEGORI, tanggalTeks } from '../utils/label'
import { HalamanRujukBk, KunciPinWajib, RujukanMasukBk } from './rujukan'

const rp = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `Rp${n.toLocaleString('id-ID')}`)
const persen = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${String(n).replace('.', ',')}%`)

// =====================================================================================================================
// Formulir catatan generik (skema isian per jenis)
// =====================================================================================================================

type Isian =
  | { k: 'teks' | 'panjang' | 'tanggal'; key: string; label: string; wajib?: boolean }
  | { k: 'angka'; key: string; label: string; rupiah?: boolean }
  | { k: 'pilih'; key: string; label: string; opsi: readonly (readonly [string, string])[]; kosong?: string }
  | { k: 'kelompok' | 'desa'; key: string; label: string }
  | { k: 'generus'; key: string; label: string; putri?: boolean }
  | { k: 'peserta'; key: string; label: string; putri?: boolean }
  | { k: 'daftar'; key: string; label: string }
  | { k: 'centang'; key: string; label: string; opsi: readonly string[] }

const ops = (l: readonly string[], lbl?: Record<string, string>) => l.map((x) => [x, lbl?.[x] ?? x.replace(/_/g, ' ')] as const)
const KODE_AGENDA = ops(['MR', 'DR', 'AA', 'AS', 'MS', 'DS', 'TH'], Object.fromEntries(Object.entries(KODE_KEAKTIFAN).map(([k, v]) => [k, `${k} — ${v.nama}`])))
const AGENDA: Isian[] = [
  { k: 'teks', key: 'judul', label: 'Judul kegiatan', wajib: true },
  { k: 'tanggal', key: 'tanggal', label: 'Tanggal' },
  { k: 'teks', key: 'tempat', label: 'Tempat' },
  { k: 'panjang', key: 'catatan', label: 'Keterangan / hasil' },
]

const FORM: Record<string, Isian[]> = {
  notulen: [
    { k: 'pilih', key: 'jenis_musyawarah', label: 'Musyawarah', opsi: ops(JENIS_MUSYAWARAH, { bersama: 'Musyawarah bersama (bulan ganjil)', muda_mudi: 'PPG unsur muda/i (bulan genap)' }) },
    { k: 'teks', key: 'peserta', label: 'Peserta' },
    { k: 'panjang', key: 'hasil', label: 'Hasil musyawarah', wajib: true },
    { k: 'panjang', key: 'tindak_lanjut', label: 'Tindak lanjut' },
  ],
  kas: [
    { k: 'pilih', key: 'arah', label: 'Arah', opsi: [['masuk', 'Pemasukan'], ['keluar', 'Pengeluaran']] },
    { k: 'angka', key: 'jumlah', label: 'Jumlah (Rp)', rupiah: true },
    { k: 'pilih', key: 'akun', label: 'Akun', opsi: ops(AKUN_KAS, { tabungan_desa: 'Tabungan desa', dana_masuk: 'Dana masuk (penggalangan)', ckm: 'Pemberangkatan CKM' }) },
    { k: 'desa', key: 'desa_id', label: 'Desa (untuk tabungan desa)' },
    { k: 'pilih', key: 'peruntukan', label: 'Peruntukan tabungan', opsi: ops(PERUNTUKAN_TABUNGAN, { mumi_daerah: 'Konsumsi Mumi Daerah', ppg_ckm: 'Kegiatan PPG & CKM', dikembalikan_desa: 'Dikembalikan ke desa' }), kosong: '—' },
    { k: 'teks', key: 'keterangan', label: 'Keterangan' },
  ],
  target_tabungan: [
    { k: 'desa', key: 'desa_id', label: 'Desa' },
    { k: 'angka', key: 'nominal', label: 'Nominal per bulan (Rp)', rupiah: true },
    { k: 'pilih', key: 'peruntukan', label: 'Peruntukan', opsi: ops(PERUNTUKAN_TABUNGAN, { mumi_daerah: 'Konsumsi Mumi Daerah', ppg_ckm: 'Kegiatan PPG & CKM', dikembalikan_desa: 'Dikembalikan ke desa' }) },
  ],
  dana_masuk: [
    { k: 'pilih', key: 'sumber', label: 'Sumber', opsi: [['wali', 'Orang tua / wali'], ['aghniya', 'Aghniya'], ['lain', 'Pihak lain']] },
    { k: 'teks', key: 'dari', label: 'Dari (boleh dikosongkan)' },
    { k: 'angka', key: 'jumlah', label: 'Jumlah (Rp)', rupiah: true },
    { k: 'teks', key: 'keterangan', label: 'Keterangan' },
  ],
  konseling: [
    { k: 'pilih', key: 'sasaran', label: 'Sasaran', opsi: [['generus', 'Generus'], ['pendidik', 'Pendidik / MT'], ['orang_tua', 'Orang tua']] },
    { k: 'teks', key: 'nama', label: 'Nama / inisial' },
    { k: 'teks', key: 'kategori', label: 'Kategori masalah (mis. ketertiban, berpakaian)' },
    { k: 'panjang', key: 'masalah', label: 'Masalah', wajib: true },
    { k: 'panjang', key: 'tindak_lanjut', label: 'Bimbingan / tindak lanjut' },
  ],
  mubaligh: [
    { k: 'teks', key: 'nama', label: 'Nama mubaligh/mubalighot', wajib: true },
    { k: 'pilih', key: 'jenis', label: 'Jenis', opsi: [['tugasan', 'Tugasan'], ['setempat', 'Setempat']] },
    { k: 'pilih', key: 'jenis_kelamin', label: 'Jenis kelamin', opsi: [['L', 'Laki-laki'], ['P', 'Perempuan']] },
    { k: 'kelompok', key: 'kelompok_id', label: 'Kelompok penugasan' },
    { k: 'tanggal', key: 'mulai', label: 'Mulai bertugas' },
    { k: 'teks', key: 'no_hp', label: 'No. HP' },
    { k: 'panjang', key: 'catatan', label: 'Catatan (kesejahteraan, kamar, makan…)' },
  ],
  kebutuhan_pengajar: [
    { k: 'kelompok', key: 'kelompok_id', label: 'Kelompok' },
    { k: 'angka', key: 'kebutuhan', label: 'Tambahan pengajar dibutuhkan (orang)' },
    { k: 'panjang', key: 'catatan', label: 'Catatan' },
  ],
  program_sdm: AGENDA,
  inventaris: [
    { k: 'kelompok', key: 'kelompok_id', label: 'Kelompok' },
    { k: 'teks', key: 'barang', label: 'Barang (mis. Iqro\' & Al-Qur\'an, bangku ngaji, papan tulis)', wajib: true },
    { k: 'angka', key: 'jumlah', label: 'Jumlah' },
    { k: 'pilih', key: 'kondisi', label: 'Kondisi', opsi: ops(KONDISI_SARPRAS) },
    { k: 'tanggal', key: 'dicek_pada', label: 'Dicek pada' },
    { k: 'teks', key: 'catatan', label: 'Catatan (standar: Iqro\'/Qur\'an min. ⅓ santri, bangku sejumlah santri, 1 set papan tulis)' },
  ],
  usulan_pengadaan: [
    { k: 'kelompok', key: 'kelompok_id', label: 'Kelompok' },
    { k: 'teks', key: 'barang', label: 'Barang', wajib: true },
    { k: 'angka', key: 'jumlah', label: 'Jumlah' },
    { k: 'angka', key: 'perkiraan_biaya', label: 'Perkiraan biaya (Rp)', rupiah: true },
    { k: 'teks', key: 'alasan', label: 'Alasan' },
  ],
  group_pembinaan: [
    { k: 'pilih', key: 'group', label: 'Group', opsi: GROUP_PEMBINAAN.map((g) => [g, g] as const) },
    { k: 'teks', key: 'pembina1', label: 'Pembina 1' },
    { k: 'teks', key: 'pembina2', label: 'Pembina 2' },
    { k: 'teks', key: 'ketua', label: 'Ketua' },
    { k: 'teks', key: 'wakil', label: 'Wakil (unsur mumi)' },
    { k: 'teks', key: 'wakil_mt', label: 'Wakil (unsur MT)' },
    { k: 'daftar', key: 'anggota', label: 'Anggota (pisahkan dengan koma)' },
  ],
  agenda_muda_mudi: [...AGENDA, { k: 'pilih', key: 'kode_keaktifan', label: 'Kode keaktifan peserta', opsi: KODE_AGENDA, kosong: '— tanpa —' }, { k: 'peserta', key: 'peserta', label: 'Peserta (generus)' }],
  agenda_olahraga: [...AGENDA, { k: 'pilih', key: 'kode_keaktifan', label: 'Kode keaktifan peserta', opsi: KODE_AGENDA, kosong: '— tanpa —' }, { k: 'peserta', key: 'peserta', label: 'Peserta (generus)' }],
  agenda_kemandirian: [...AGENDA, { k: 'peserta', key: 'peserta', label: 'Peserta (generus)' }],
  agenda_keputrian: [...AGENDA, { k: 'peserta', key: 'peserta', label: 'Peserta (generus putri)', putri: true }],
  data_kemandirian: [
    { k: 'generus', key: 'generus_id', label: 'Generus' },
    { k: 'pilih', key: 'pendidikan', label: 'Pendidikan / status', opsi: ops(PENDIDIKAN, { lulus_smp: 'Lulus SMP', lulus_sma: 'Lulus SMA', tidak_sekolah: 'Tidak sekolah', dropout: 'Putus sekolah (dropout)' }) },
    { k: 'teks', key: 'bakat', label: 'Bakat' },
    { k: 'teks', key: 'minat', label: 'Minat' },
  ],
  info_kerja: [
    { k: 'teks', key: 'judul', label: 'Judul', wajib: true },
    { k: 'panjang', key: 'isi', label: 'Isi informasi (pastikan valid)', wajib: true },
    { k: 'teks', key: 'kontak', label: 'Kontak' },
  ],
  peserta_tahfidz: [
    { k: 'generus', key: 'generus_id', label: 'Generus' },
    { k: 'teks', key: 'target', label: 'Target hafalan' },
  ],
  ujian_tahfidz: [
    { k: 'generus', key: 'generus_id', label: 'Generus' },
    { k: 'teks', key: 'penguji1', label: 'Penguji 1' },
    { k: 'teks', key: 'penguji2', label: 'Penguji 2' },
    { k: 'centang', key: 'lulus', label: 'Surat yang LULUS (dinilai 2 penguji)', opsi: SURAT_TAHFIDZ.map((s) => `${s.nama} (${s.poin} poin)`) },
  ],
  nunggoni: [
    { k: 'kelompok', key: 'kelompok_id', label: 'Kelompok yang ditunggui' },
    { k: 'pilih', key: 'unsur', label: 'Unsur', opsi: UNSUR_NUNGGONI.map((u) => [u, u] as const) },
    { k: 'teks', key: 'kelas', label: 'Kelas' },
    { k: 'panjang', key: 'temuan', label: 'Temuan / saran' },
  ],
}

/** Ringkasan satu baris isi catatan. */
function ringkas(c: CatatanTerbaca, namaGenerus: (id: string) => string, namaWilayah: (id: string) => string): ReactNode {
  if (c.terkunci) return <Lencana warna="abu">Terkunci (bukan bidang Anda)</Lencana>
  const x = (c.isi ?? {}) as Record<string, unknown>
  switch (c.jenis) {
    case 'kas':
      return `${x.arah === 'masuk' ? '+' : '−'} ${rp(x.jumlah as number)} · ${String(x.akun).replace(/_/g, ' ')}${x.desa_id ? ` · ${namaWilayah(String(x.desa_id))}` : ''}${x.keterangan ? ` · ${x.keterangan}` : ''}`
    case 'target_tabungan':
      return `${namaWilayah(String(x.desa_id))}: ${rp(x.nominal as number)}/bulan · ${String(x.peruntukan).replace(/_/g, ' ')}`
    case 'dana_masuk':
      return `${rp(x.jumlah as number)} dari ${x.dari || x.sumber}`
    case 'ujian_tahfidz':
      return `${namaGenerus(String(x.generus_id))}: ${(x.lulus as number[]).length} surat lulus`
    case 'data_kemandirian':
    case 'peserta_tahfidz':
      return `${namaGenerus(String(x.generus_id))} · ${String(x.pendidikan ?? x.target ?? '').replace(/_/g, ' ')}${x.bakat ? ` · bakat ${x.bakat}` : ''}${x.minat ? ` · minat ${x.minat}` : ''}`
    case 'inventaris':
      return `${namaWilayah(String(x.kelompok_id))}: ${x.barang} × ${x.jumlah} · ${String(x.kondisi).replace(/_/g, ' ')}`
    case 'usulan_pengadaan':
      return `${namaWilayah(String(x.kelompok_id))}: ${x.barang} × ${x.jumlah}${x.perkiraan_biaya ? ` · ${rp(x.perkiraan_biaya as number)}` : ''}`
    case 'mubaligh':
      return `${x.nama} (${x.jenis}) · ${namaWilayah(String(x.kelompok_id))}`
    case 'kebutuhan_pengajar':
      return `${namaWilayah(String(x.kelompok_id))}: butuh ${x.kebutuhan} pengajar`
    case 'group_pembinaan':
      return `${x.group} · ketua ${x.ketua || '—'} · ${(x.anggota as string[]).length} anggota`
    case 'nunggoni':
      return `${namaWilayah(String(x.kelompok_id))}${x.unsur ? ` · ${x.unsur}` : ''}${x.temuan ? ` · ${x.temuan}` : ''}`
    case 'konseling':
      return `${String(x.sasaran).replace('_', ' ')} · ${x.kategori || ''} · ${String(x.masalah).slice(0, 60)}`
    case 'notulen':
      return `${String(x.jenis_musyawarah).replace('_', ' ')} · ${String(x.hasil).slice(0, 80)}`
    default:
      return String(x.judul ?? c.judul ?? '').slice(0, 80) + (x.tanggal ? ` · ${tanggalTeks(String(x.tanggal))}` : '')
  }
}

function useNama() {
  const { db } = useApp()
  const w = useData(() => new Map(daftarWilayah(db).map((x) => [x.id, x.nama])), []).data ?? new Map<string, string>()
  const g = useData(() => new Map(cariGenerus(db, {}).map((x) => [x.id, x.nama])), []).data ?? new Map<string, string>()
  return { namaWilayah: (id: string) => w.get(id) ?? '—', namaGenerus: (id: string) => g.get(id) ?? '—' }
}

/** Formulir catatan generik. §21: `wilayahId` = wilayah penugasan (kelompok/desa yang dipilih dibatasi di dalamnya). */
function FormCatatan(p: { jenis: JenisCatatan; awal?: CatatanTerbaca; tutup: () => void; wilayahId?: string }) {
  const { db, aksi } = useApp()
  const kolom = FORM[p.jenis] ?? []
  const [isi, setIsi] = useState<Record<string, unknown>>(() => {
    if (p.awal?.isi) return { ...p.awal.isi }
    const o: Record<string, unknown> = {}
    for (const k of kolom) if (k.k === 'pilih' && !k.kosong) o[k.key] = k.opsi[0]![0]
    return o
  })
  const [tanggal, setTanggal] = useState(p.awal?.tanggal ?? tanggalHariIni())
  const dalam = useData(() => (p.wilayahId ? new Set(turunanWilayah(db, p.wilayahId)) : null), [p.wilayahId]).data ?? null
  const kelompok = (useData(() => daftarWilayah(db, { tingkat: 'kelompok' }), []).data ?? []).filter((w) => !dalam || dalam.has(w.id))
  const desa = (useData(() => daftarWilayah(db, { tingkat: 'desa' }), []).data ?? []).filter((w) => !dalam || dalam.has(w.id))
  const generus = (useData(() => cariGenerus(db, { status: 'aktif' }), []).data ?? []).filter((g) => !dalam || dalam.has(g.kelompok_id))
  const ubah = (k: string, v: unknown) => setIsi((x) => ({ ...x, [k]: v === '' ? undefined : v }))
  const simpan = async () => {
    const bersih = Object.fromEntries(Object.entries(isi).filter(([, v]) => v !== undefined && v !== ''))
    const wilayahId = typeof bersih.kelompok_id === 'string' ? undefined : (p.awal?.wilayah_id ?? p.wilayahId)
    const r = await aksi(() => simpanCatatan(db, { jenis: p.jenis, isi: bersih, tanggal, id: p.awal?.id, wilayahId }), 'Tersimpan. Jangan lupa Setor.')
    if (r) p.tutup()
  }
  return (
    <Modal judul={JENIS_CATATAN[p.jenis]!.nama} tutup={p.tutup} aksi={<Tombol onClick={simpan}>Simpan</Tombol>}>
      <Isian label="Tanggal catatan" type="date" nilai={tanggal} ubah={setTanggal} />
      {kolom.map((k) => {
        const v = isi[k.key]
        switch (k.k) {
          case 'teks':
          case 'tanggal':
            return <Isian key={k.key} label={k.label} type={k.k === 'tanggal' ? 'date' : 'text'} nilai={(v as string) ?? ''} ubah={(x) => ubah(k.key, x)} />
          case 'panjang':
            return <AreaTeks key={k.key} label={k.label} nilai={(v as string) ?? ''} ubah={(x) => ubah(k.key, x)} />
          case 'angka':
            return <Isian key={k.key} label={k.label} type="number" inputMode="numeric" min={0} nilai={v === undefined ? '' : String(v)} ubah={(x) => ubah(k.key, x === '' ? '' : Math.round(Number(x)))} />
          case 'pilih':
            return <Pilihan key={k.key} label={k.label} nilai={(v as string) ?? ''} ubah={(x) => ubah(k.key, x)} kosong={k.kosong} pilihan={k.opsi.map(([n, t]) => ({ nilai: n, teks: t }))} />
          case 'kelompok':
          case 'desa':
            return (
              <Pilihan
                key={k.key}
                label={k.label}
                nilai={(v as string) ?? ''}
                ubah={(x) => ubah(k.key, x)}
                kosong="— pilih —"
                pilihan={(k.k === 'kelompok' ? kelompok : desa).map((w) => ({ nilai: w.id, teks: w.nama }))}
              />
            )
          case 'generus':
            return (
              <Pilihan
                key={k.key}
                label={k.label}
                nilai={(v as string) ?? ''}
                ubah={(x) => ubah(k.key, x)}
                kosong="— pilih —"
                pilihan={generus.filter((g) => !k.putri || g.jenis_kelamin === 'P').map((g) => ({ nilai: g.id, teks: `${g.nama} · ${g.kelompok_nama} · ${label(LABEL_KATEGORI, g.kategori)}` }))}
              />
            )
          case 'daftar':
            return <Isian key={k.key} label={k.label} nilai={((v as string[]) ?? []).join(', ')} ubah={(x) => ubah(k.key, x.split(',').map((s) => s.trim()).filter(Boolean))} />
          case 'peserta':
          case 'centang': {
            const pilihan = k.k === 'centang' ? k.opsi.map((t, i) => ({ id: i as number | string, t })) : generus.filter((g) => !k.putri || g.jenis_kelamin === 'P').map((g) => ({ id: g.id as number | string, t: `${g.nama} · ${g.kelompok_nama}` }))
            const sel = ((v as (string | number)[]) ?? []) as (string | number)[]
            return (
              <div key={k.key}>
                <p className="keterangan">
                  {k.label}: <b>{sel.length}</b> dipilih
                </p>
                <ul className="daftar-centang">
                  {pilihan.map((o) => (
                    <li key={String(o.id)}>
                      <label>
                        <input type="checkbox" checked={sel.includes(o.id)} onChange={(e) => ubah(k.key, e.target.checked ? [...sel, o.id] : sel.filter((s) => s !== o.id))} />
                        {o.t}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )
          }
        }
      })}
    </Modal>
  )
}

/**
 * Daftar + tambah catatan satu atau beberapa jenis. §21: `wilayahId` = wilayah penugasan — catatan wilayah itu dan di bawahnya
 * (`hanyaWilayah`: wilayah itu saja, mis. konseling BK).
 */
function DaftarCatatan(p: { judul: string; jenis: JenisCatatan[]; bolehTambah?: boolean; ket?: string; aksiBaris?: (c: CatatanTerbaca) => ReactNode; wilayahId?: string; hanyaWilayah?: boolean }) {
  const { db, aksi } = useApp()
  const data = useData(
    () => daftarCatatan(db, { jenis: p.jenis, ...(p.wilayahId ? { wilayahIds: p.hanyaWilayah ? [p.wilayahId] : turunanWilayah(db, p.wilayahId) } : {}) }),
    [p.jenis.join(), p.wilayahId, p.hanyaWilayah],
  )
  const { namaGenerus, namaWilayah } = useNama()
  const [form, setForm] = useState<{ jenis: JenisCatatan; awal?: CatatanTerbaca } | null>(null)
  return (
    <Kartu judul={p.judul}>
      {p.ket ? <p className="keterangan">{p.ket}</p> : null}
      {p.bolehTambah !== false
        ? p.jenis.map((j) => (
            <Tombol key={j} penuh varian="kedua" onClick={() => setForm({ jenis: j })}>
              + {JENIS_CATATAN[j]!.nama}
            </Tombol>
          ))
        : null}
      <KeadaanData hasil={data} kosong={(d) => d.length === 0} teksKosong="Belum ada catatan.">
        {(d) => (
          <ul className="daftar-sederhana">
            {d.slice(0, 100).map((c) => (
              <li key={c.id}>
                <span>
                  <small>{tanggalTeks(c.tanggal)}</small> {ringkas(c, namaGenerus, namaWilayah)}
                </span>
                <span className="aksi-baris">
                  {p.aksiBaris?.(c)}
                  {!c.terkunci && p.bolehTambah !== false ? (
                    <>
                      <Tombol kecil varian="kedua" onClick={() => setForm({ jenis: c.jenis, awal: c })}>
                        Ubah
                      </Tombol>
                      <Tombol kecil varian="bahaya" onClick={() => void aksi(() => hapusCatatan(db, c.id), 'Dihapus.')}>
                        Hapus
                      </Tombol>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </KeadaanData>
      {form ? <FormCatatan jenis={form.jenis} awal={form.awal} tutup={() => setForm(null)} wilayahId={p.wilayahId} /> : null}
    </Kartu>
  )
}

// =====================================================================================================================
// Layar khusus
// =====================================================================================================================

function KartuKas(p: { bolehUbah: boolean; penggalang?: boolean }) {
  const { db, aksi } = useApp()
  const k = useData(() => ringkasanKas(db), [])
  return (
    <KeadaanData hasil={k}>
      {(x) => (
        <>
          <Kartu judul="Buku kas PPG Daerah">
            {x.terkunci && !x.masuk && !x.keluar ? <Spanduk jenis="peringatan">Isi keuangan terkunci di HP ini.</Spanduk> : null}
            <div className="baris-angka">
              <Angka nilai={rp(x.masuk)} teks="Pemasukan" warna="hijau" />
              <Angka nilai={rp(x.keluar)} teks="Pengeluaran" warna="merah" />
            </div>
            <p>
              Saldo: <b>{rp(x.saldo)}</b>
            </p>
          </Kartu>
          {x.tabungan.length ? (
            <Kartu judul="Tabungan desa bulan ini">
              <ul className="daftar-sederhana">
                {x.tabungan.map((t) => (
                  <li key={`${t.desa_id}-${t.peruntukan}`}>
                    <span>
                      {t.desa} · {t.peruntukan.replace(/_/g, ' ')}: {rp(t.disetor)} / {rp(t.target)}
                      <br />
                      <small>{t.sumber === 'musyawarah' ? 'Target ditetapkan musyawarah' : t.sumber === 'bendahara' ? 'Target dari bendahara' : 'Target sementara (belum ditetapkan musyawarah)'}</small>
                    </span>
                    <Lencana warna={t.disetor >= t.target ? 'hijau' : 'kuning'}>{t.disetor >= t.target ? 'Lunas' : 'Belum'}</Lencana>
                  </li>
                ))}
              </ul>
            </Kartu>
          ) : null}
          {x.kebutuhanDana.length ? (
            <Kartu judul="Kebutuhan dana kegiatan (kebijakan musyawarah)">
              <ul className="daftar-sederhana">
                {x.kebutuhanDana.map((d) => (
                  <li key={d.nama}>
                    <span>{d.nama}</span>
                    <b>{rp(d.nominal)}</b>
                  </li>
                ))}
              </ul>
            </Kartu>
          ) : null}
          {x.danaMenunggu.length ? (
            <Kartu judul="Dana masuk menunggu konfirmasi bendahara">
              <ul className="daftar-sederhana">
                {x.danaMenunggu.map((d) => (
                  <li key={d.id}>
                    <span>
                      {tanggalTeks(d.tanggal)} · {rp((d.isi as { jumlah: number }).jumlah)} · {String((d.isi as { dari?: string; sumber: string }).dari || (d.isi as { sumber: string }).sumber)}
                    </span>
                    {p.bolehUbah ? (
                      <Tombol kecil onClick={() => void aksi(() => konfirmasiDanaMasuk(db, d.id), 'Dana masuk dicatat di kas.')}>
                        Konfirmasi
                      </Tombol>
                    ) : (
                      <Lencana warna="kuning">Menunggu</Lencana>
                    )}
                  </li>
                ))}
              </ul>
            </Kartu>
          ) : null}
        </>
      )}
    </KeadaanData>
  )
}

function KartuRingkasanKetua() {
  const { db, profil } = useApp()
  const r = useData(() => ringkasanKetua(db, { wilayahId: profil.wilayah_id }), [profil.id])
  return (
    <KeadaanData hasil={r}>
      {(x) => (
        <Kartu judul={`Ringkasan PPG ${x.bulan}`}>
          <Spanduk jenis="info">Bulan ini: {x.musyawarah.teks}.</Spanduk>
          <div className="baris-angka">
            <Angka nilai={persen(x.keaktifanRata)} teks="Rata-rata keaktifan" />
            <Angka nilai={x.kelompokBelumLapor} teks="Kelompok belum lapor" warna={x.kelompokBelumLapor ? 'kuning' : 'hijau'} />
          </div>
          <div className="baris-angka">
            <Angka nilai={x.nunggoni.laporan + x.nunggoni.mandiri} teks="NUNGGONI bulan ini" />
            <Angka nilai={x.kasusBk.bulanIni} teks="Kasus BK (jumlah saja)" warna="abu" />
          </div>
          <div className="baris-angka">
            <Angka nilai={x.kasusBk.rujukanBulanIni} teks="Rujukan BK bulan ini (se-daerah)" warna="abu" />
            <Angka nilai={x.kasusBk.rujukanBelumDitanggapi} teks="Rujukan belum ditanggapi" warna={x.kasusBk.rujukanBelumDitanggapi ? 'kuning' : 'abu'} />
          </div>
          <p className="keterangan">Jumlah rujukan & kasus hanya se-daerah ({x.kasusBk.rujukanTotal} rujukan, {x.kasusBk.total} catatan konseling) — isi hanya dibaca BK.</p>
          <p>
            Saldo kas: <b>{x.kas.saldo === null ? 'terkunci' : rp(x.kas.saldo)}</b>
          </p>
        </Kartu>
      )}
    </KeadaanData>
  )
}

function RekapKeaktifanBidang(p: { kirimWa?: boolean }) {
  const { db, profil, platform } = useApp()
  const [bulan, setBulan] = useState(tanggalHariIni().slice(0, 7))
  const r = useData(() => rekapKeaktifanBulan(db, { wilayahId: profil.wilayah_id, bulan }), [profil.id, bulan])
  return (
    <Kartu judul="Rekap keaktifan bulanan">
      <Isian label="Bulan" type="month" nilai={bulan} ubah={(v) => v && setBulan(v)} />
      <KeadaanData hasil={r} kosong={(d) => d.perKelompok.length === 0} teksKosong="Belum ada data generus.">
        {(x) => (
          <>
            <ul className="daftar-sederhana">
              {x.perKelompok.map((k) => (
                <li key={k.kelompok_id}>
                  <span>{k.nama}</span>
                  <span>
                    {persen(k.rataPersen)} · {k.tercapai}/{k.jumlah} capai target
                  </span>
                </li>
              ))}
            </ul>
            <p className="keterangan">Perlu perhatian (&lt; 50%): {x.perluPerhatian.length} anak — bahan musyawarah.</p>
          </>
        )}
      </KeadaanData>
      {p.kirimWa ? (
        <Tombol penuh varian="wa" onClick={() => platform.bukaTautan(`https://wa.me/?text=${encodeURIComponent(teksWaRekapKeaktifan(db, { wilayahId: profil.wilayah_id, bulan }))}`)}>
          Bagikan ke grup WA
        </Tombol>
      ) : null}
    </Kartu>
  )
}

function KartuPengingatLaporan() {
  const { db, profil } = useApp()
  const r = useData(() => pengingatLaporan(db, profil.wilayah_id), [profil.id]).data
  if (!r) return null
  return (
    <Spanduk jenis="peringatan">
      <b>{r.pesan}</b> {r.kelompok.map((k) => k.nama).join(', ')}
    </Spanduk>
  )
}

function RewardBidang() {
  const { db, profil } = useApp()
  const [jenjang, setJenjang] = useState<KategoriGenerus>('praremaja')
  const r = useData(() => rewardHasilBelajar(db, { wilayahId: profil.wilayah_id, jenjang, periode: periodeAktif(db) }), [profil.id, jenjang])
  return (
    <Kartu judul="Reward hasil belajar terbaik">
      <Pilihan label="Jenjang" nilai={jenjang} ubah={(v) => setJenjang(v as KategoriGenerus)} pilihan={KATEGORI_GENERUS.map((k) => ({ nilai: k, teks: LABEL_JENJANG[k]! }))} />
      <p className="keterangan">Skor = rata-rata keaktifan semester & Nilai Akhir (Tri Sukses Generus).</p>
      <KeadaanData hasil={r} kosong={(d) => d.daerah.length === 0} teksKosong="Belum ada generus berjenjang ini.">
        {(x) => (
          <>
            <h3>Santri terbaik se-daerah</h3>
            <ol>
              {x.daerah.map((s) => (
                <li key={s.generus_id}>
                  {s.nama} ({s.kelompok}) — skor {persen(s.skor)}
                </li>
              ))}
            </ol>
            <h3>Kelompok terbaik</h3>
            <ol>
              {x.kelompokTerbaik.slice(0, 3).map((k) => (
                <li key={k.kelompok_id}>
                  {k.nama} ({k.desa}) — {persen(k.skor)}
                </li>
              ))}
            </ol>
            <h3>Desa terbaik</h3>
            <ol>
              {x.desaTerbaik.slice(0, 3).map((d) => (
                <li key={d.desa_id}>
                  {d.nama} — {persen(d.skor)}
                </li>
              ))}
            </ol>
          </>
        )}
      </KeadaanData>
    </Kartu>
  )
}

function RekapKontrolMtBidang() {
  const { db } = useApp()
  const [bulan, setBulan] = useState(tanggalHariIni().slice(0, 7))
  const r = useData(() => rekapKontrolMt(db, bulan), [bulan])
  return (
    <Kartu judul="Kontrol Keaktifan & Keteladanan MT">
      <Isian label="Bulan" type="month" nilai={bulan} ubah={(v) => v && setBulan(v)} />
      <KeadaanData hasil={r} kosong={(d) => d.length === 0} teksKosong="Belum ada lembar kontrol MT bulan ini.">
        {(d) => (
          <ul className="daftar-sederhana">
            {d.map((m) => (
              <li key={m.catatan_id}>
                <span>
                  <b>{m.nama}</b> · {m.kelompok}
                </span>
                <small>
                  {m.hariTerisi} hari · Subuh {m.subuh} · Tahajud {m.tahajud} · Dhuha {m.dhuha} · Hafalan {m.hafalan} kolom · Tadarus {m.tadarus}
                </small>
              </li>
            ))}
          </ul>
        )}
      </KeadaanData>
    </Kartu>
  )
}

function RekapTahfidzBidang() {
  const { db } = useApp()
  const r = useData(() => rekapTahfidz(db), [])
  return (
    <Kartu judul="Peringkat tahfidz (poin)">
      <KeadaanData hasil={r} kosong={(d) => d.length === 0} teksKosong="Belum ada ujian tahfidz.">
        {(d) => (
          <ol>
            {d.map((t) => (
              <li key={t.generus_id}>
                {t.nama} ({label(LABEL_KATEGORI, t.jenjang)}, {t.kelompok}) — {t.poin} poin, {t.surat} surat
              </li>
            ))}
          </ol>
        )}
      </KeadaanData>
    </Kartu>
  )
}

/** Agenda: catat kehadiran peserta sebagai keaktifan (kode agenda). */
function AksiAgenda(p: { c: CatatanTerbaca }) {
  const { db, aksi } = useApp()
  const x = (p.c.isi ?? {}) as { kode_keaktifan?: string; peserta?: string[]; tanggal?: string }
  if (!x.kode_keaktifan || !x.peserta?.length) return null
  return (
    <Tombol
      kecil
      onClick={() =>
        void aksi(() => {
          let n = 0
          for (const id of x.peserta!) {
            catatKeaktifan(db, { generusId: id, tanggal: x.tanggal || p.c.tanggal, kode: x.kode_keaktifan as never, keterangan: `Agenda: ${p.c.judul ?? ''}`, sebagai: 'pencatat' })
            n++
          }
          return n
        }, (n) => `${n} peserta tercatat keaktifan ${x.kode_keaktifan}.`)
      }
    >
      Catat hadir
    </Tombol>
  )
}

function DataGenerusJenjang(p: { putri?: boolean; jenjang?: KategoriGenerus[] }) {
  const { db } = useApp()
  const g = useData(() => cariGenerus(db, { status: 'aktif' }).filter((x) => (!p.putri || x.jenis_kelamin === 'P') && (!p.jenjang || p.jenjang.includes(x.kategori))), [])
  return (
    <Kartu judul={p.putri ? 'Generus putri' : 'Database generus per jenjang'}>
      <KeadaanData hasil={g} kosong={(d) => d.length === 0} teksKosong="Belum ada data.">
        {(d) => (
          <ul className="daftar-sederhana">
            {[...KATEGORI_GENERUS, 'caberawit'].map((k) => {
              const n = d.filter((x) => x.kategori === k).length
              return n ? (
                <li key={k}>
                  <span>{label(LABEL_KATEGORI, k)}</span>
                  <b>{n}</b>
                </li>
              ) : null
            })}
          </ul>
        )}
      </KeadaanData>
    </Kartu>
  )
}

// =====================================================================================================================
// Menu per jabatan
// =====================================================================================================================

/** §21.1: penugasan yang sedang dibuka (wilayah catatan yang diolah). */
interface KonteksPenugasan {
  jabatan: Jabatan
  wilayahId: string
}

interface ItemBidang {
  kunci: string
  teks: string
  ket: string
  ikon: string
  jabatan: readonly Jabatan[] | 'semua'
  /** §21.1: menu bidang perwakilan — satu entri per penugasan (mengolah catatan wilayah penugasan itu). */
  perWilayah?: boolean
  isi: (w: KonteksPenugasan | null) => ReactNode
}

const ITEM: ItemBidang[] = [
  { kunci: 'ringkasan', teks: 'Ringkasan PPG', ket: 'Semua bidang, musyawarah, setor', ikon: '◎', jabatan: ['ketua', 'wakil_ketua'], isi: () => <><KartuRingkasanKetua /><RekapKeaktifanBidang /></> },
  // §18: musyawarah — notulen (sekretaris, PJ desa/kelompok), pengesahan & mandat (ketua/wakil), register kebijakan
  { kunci: 'musyawarah', teks: 'Musyawarah & Kebijakan', ket: 'Notulen, pengesahan, agenda & undangan WA', ikon: '⚖', jabatan: ['ketua', 'wakil_ketua', 'sekretaris', 'pj_desa', 'pj_kelompok'], isi: () => <MusyawarahHp /> },
  { kunci: 'sekretariat', teks: 'Sekretariat', ket: 'Rekap → WA grup, database', ikon: '✎', jabatan: ['sekretaris'], isi: () => <><KartuPengingatLaporan /><RekapKeaktifanBidang kirimWa /><DataGenerusJenjang /><DaftarCatatan judul="Database mubaligh/mubalighot" jenis={['mubaligh']} /></> },
  { kunci: 'kas', teks: 'Keuangan', ket: 'Buku kas, tabungan desa, dana masuk', ikon: 'Rp', jabatan: ['bendahara'], isi: () => <><KartuKas bolehUbah /><DaftarCatatan judul="Catatan kas" jenis={['kas', 'target_tabungan']} /></> },
  { kunci: 'kas_lihat', teks: 'Keuangan (lihat)', ket: 'Saldo & laporan bendahara', ikon: 'Rp', jabatan: ['ketua', 'wakil_ketua'], isi: () => <><KartuKas bolehUbah={false} /><DaftarCatatan judul="Catatan kas" jenis={['kas']} bolehTambah={false} /></> },
  { kunci: 'dana', teks: 'Penggalangan Dana', ket: 'Dana masuk → konfirmasi bendahara daerah', ikon: '♥', jabatan: ['penggalang_dana'], perWilayah: true, isi: (w) => <><KartuKas bolehUbah={false} penggalang /><DaftarCatatan judul="Dana masuk" jenis={['dana_masuk']} wilayahId={w?.wilayahId} hanyaWilayah ket="Tercatat di kas setelah dikonfirmasi bendahara daerah." /></> },
  // §18: butir materi/penilaian yang diserahkan ke Bidang Kurikulum
  { kunci: 'penetapan', teks: 'Perlu Ditetapkan Kurikulum', ket: 'Target, halaman kitab, rumus Nilai Akhir, pemetaan aspek, …', ikon: '✔', jabatan: ['kurikulum'], isi: () => <PerluDitetapkanHp /> },
  { kunci: 'reward', teks: 'Reward Hasil Belajar', ket: 'Santri, kelompok & desa terbaik', ikon: '★', jabatan: ['kurikulum', 'ketua', 'wakil_ketua'], isi: () => <RewardBidang /> },
  { kunci: 'pendidik', teks: 'Tenaga Pendidik', ket: 'Data & kebutuhan MT, SDM, kontrol MT', ikon: '☺', jabatan: ['tenaga_pendidik'], perWilayah: true, isi: (w) => <><RekapKontrolMtBidang /><DaftarCatatan judul="Data mubaligh/mubalighot" jenis={['mubaligh']} wilayahId={w?.wilayahId} /><DaftarCatatan judul="Kebutuhan pengajar" jenis={['kebutuhan_pengajar']} wilayahId={w?.wilayahId} /><DaftarCatatan judul="Program peningkatan SDM" jenis={['program_sdm']} wilayahId={w?.wilayahId} /></> },
  { kunci: 'sarpras', teks: 'Sarana & Prasarana', ket: 'Inventaris & usulan pengadaan', ikon: '▦', jabatan: ['sarpras'], perWilayah: true, isi: (w) => <><DaftarCatatan judul="Inventaris per kelompok" jenis={['inventaris']} wilayahId={w?.wilayahId} /><DaftarCatatan judul="Usulan pengadaan ke bendahara" jenis={['usulan_pengadaan']} wilayahId={w?.wilayahId} /></> },
  { kunci: 'mumi', teks: 'Muda/i & Kepramukaan', ket: '10 group, agenda → keaktifan', ikon: '⚑', jabatan: ['muda_mudi'], perWilayah: true, isi: (w) => <><DataGenerusJenjang jenjang={['praremaja', 'remaja', 'pranikah']} /><DaftarCatatan judul="Group pembinaan" jenis={['group_pembinaan']} wilayahId={w?.wilayahId} /><DaftarCatatan judul="Agenda muda/i" jenis={['agenda_muda_mudi']} wilayahId={w?.wilayahId} aksiBaris={(c) => <AksiAgenda c={c} />} /></> },
  { kunci: 'olahraga', teks: 'Olahraga & Seni', ket: 'Agenda FORSGI / PERSINAS ASAD', ikon: '⚽', jabatan: ['olahraga_seni'], perWilayah: true, isi: (w) => <DaftarCatatan judul="Agenda olahraga & seni" jenis={['agenda_olahraga']} wilayahId={w?.wilayahId} aksiBaris={(c) => <AksiAgenda c={c} />} /> },
  { kunci: 'mandiri', teks: 'Kemandirian', ket: 'Data pendidikan/bakat, pelatihan, info kerja', ikon: '⚒', jabatan: ['kemandirian'], perWilayah: true, isi: (w) => <><DaftarCatatan judul="Data generus (lulus/dropout, bakat & minat)" jenis={['data_kemandirian']} wilayahId={w?.wilayahId} /><DaftarCatatan judul="Agenda pelatihan" jenis={['agenda_kemandirian']} wilayahId={w?.wilayahId} /><DaftarCatatan judul="Info peluang kerja" jenis={['info_kerja']} wilayahId={w?.wilayahId} /></> },
  { kunci: 'putri', teks: 'Keputrian', ket: 'Pelatihan & penyuluhan putri', ikon: '✿', jabatan: ['keputrian'], perWilayah: true, isi: (w) => <><DataGenerusJenjang putri /><DaftarCatatan judul="Agenda keputrian" jenis={['agenda_keputrian']} wilayahId={w?.wilayahId} /></> },
  { kunci: 'bk', teks: 'Bimbingan Konseling', ket: 'Rujukan masuk & catatan rahasia (hanya BK wilayah ini)', ikon: '☂', jabatan: ['bk'], perWilayah: true, isi: (w) => <><RujukanMasukBk /><DaftarCatatan judul="Catatan konseling" jenis={['konseling']} wilayahId={w?.wilayahId} hanyaWilayah ket="Terenkripsi: hanya BK wilayah ini yang bisa membaca. BK tingkat atas tidak membaca kasus di bawahnya." /></> },
  { kunci: 'tahfidz', teks: "Tahfidz Qur'an", ket: 'Peserta, ujian berpoin, peringkat', ikon: '۞', jabatan: ['tahfidz'], perWilayah: true, isi: (w) => <><RekapTahfidzBidang /><DaftarCatatan judul="Peserta tahfidz" jenis={['peserta_tahfidz']} wilayahId={w?.wilayahId} /><DaftarCatatan judul="Ujian tahfidz" jenis={['ujian_tahfidz']} wilayahId={w?.wilayahId} /></> },
  { kunci: 'pjdesa', teks: 'Program Desa', ket: 'Kejar absensi & laporan, temuan', ikon: '⌂', jabatan: ['pj_desa'], perWilayah: true, isi: () => <><KartuPengingatLaporan /><RekapKeaktifanBidang /></> },
  { kunci: 'kbm', teks: 'Laporan KBM Kelompok', ket: 'Laporan bulanan ke desa', ikon: '✉', jabatan: ['pj_kelompok'], perWilayah: true, isi: () => null },
  // §21.3: semua pengurus (berjabatan atau tidak) boleh merujuk generus ke BK
  { kunci: 'rujuk', teks: 'Rujuk ke BK', ket: 'Generus perlu bimbingan — isi singkat, terkirim ke BK', ikon: '✚', jabatan: 'semua', isi: () => null },
  { kunci: 'nunggoni', teks: 'NUNGGONI', ket: 'Semua Pengurus & Mubaligh Peduli', ikon: '⚐', jabatan: 'semua', isi: () => <DaftarCatatan judul="NUNGGONI saya" jenis={['nunggoni']} ket="Sebulan sekali menunggui 1 KBM: bantu ketertiban/mengajar, catat temuan." /> },
]

/** Daftar menu untuk jabatan (tanpa memperhatikan wilayah) — dipakai uji & beranda. */
export function itemBidangUntuk(jabatan: readonly Jabatan[]): ItemBidang[] {
  const l = ITEM.filter((i) => i.jabatan === 'semua' || i.jabatan.some((j) => jabatan.includes(j)))
  // bendahara sudah punya menu Keuangan lengkap → "Keuangan (lihat)" disembunyikan
  return l.some((i) => i.kunci === 'kas') ? l.filter((i) => i.kunci !== 'kas_lihat') : l
}

interface KelompokMenu {
  judul: string
  item: (ItemBidang & { w: KonteksPenugasan | null })[]
}

/** §21.1: menu Bidang dikelompokkan per penugasan ("Sarana & Prasarana · Desa Sorong"), lalu menu umum. */
function menuPerPenugasan(penugasan: readonly Penugasan[], namaWilayah: (id: string) => string): KelompokMenu[] {
  const out: KelompokMenu[] = []
  const sudah = new Set<string>()
  const adaBendahara = penugasan.some((x) => x.jabatan === 'bendahara')
  for (const pn of penugasan) {
    const item = ITEM.filter((i) => i.jabatan !== 'semua' && i.jabatan.includes(pn.jabatan) && !(adaBendahara && i.kunci === 'kas_lihat'))
      .filter((i) => (i.perWilayah ? true : !sudah.has(i.kunci)))
      .map((i) => ({ ...i, w: { jabatan: pn.jabatan, wilayahId: pn.wilayah_id } }))
    for (const i of item) sudah.add(i.kunci)
    if (item.length) out.push({ judul: `${LABEL_JABATAN[pn.jabatan]} · ${namaWilayah(pn.wilayah_id)}`, item })
  }
  out.push({ judul: 'Semua pengurus', item: ITEM.filter((i) => i.jabatan === 'semua').map((i) => ({ ...i, w: null })) })
  return out
}

export function HalamanBidang() {
  const { db, profil } = useApp()
  const penugasan = penugasanProfil(profil)
  const nama = useData(() => new Map(daftarWilayah(db).map((w) => [w.id, `${label(LABEL_TINGKAT, w.tingkat)} ${w.nama}`])), []).data ?? new Map<string, string>()
  const [sub, setSub] = useState<{ kunci: string; wilayah: string | null } | null>(null)
  const kelompok = menuPerPenugasan(penugasan, (id) => nama.get(id) ?? '—')
  const aktif = sub ? kelompok.flatMap((k) => k.item).find((i) => i.kunci === sub.kunci && (i.w?.wilayahId ?? null) === sub.wilayah) : undefined
  if (aktif?.kunci === 'kbm') return <KunciPinWajib><LaporanBulananHp kembali={() => setSub(null)} /></KunciPinWajib>
  if (aktif?.kunci === 'rujuk') return <HalamanRujukBk kembali={() => setSub(null)} />
  if (aktif)
    return (
      <KunciPinWajib>
        <JudulHalaman judul={aktif.teks} keterangan={aktif.w ? nama.get(aktif.w.wilayahId) : undefined} kembali={() => setSub(null)} />
        {aktif.isi(aktif.w)}
      </KunciPinWajib>
    )
  return (
    <KunciPinWajib>
      <JudulHalaman judul="Bidang" keterangan={jabatanProfil(profil).map((j) => LABEL_JABATAN[j]).join(' · ')} />
      {kelompok.map((k) => (
        <section key={k.judul} className="kelompok-menu">
          <h3 className="judul-kelompok-menu">{k.judul}</h3>
          <MenuDaftar item={k.item.map((i) => ({ teks: i.teks, ket: i.ket, ikon: i.ikon, buka: () => setSub({ kunci: i.kunci, wilayah: i.w?.wilayahId ?? null }) }))} />
        </section>
      ))}
    </KunciPinWajib>
  )
}

const LABEL_TINGKAT: Record<string, string> = { daerah: 'Daerah', desa: 'Desa', kelompok: 'Kelompok' }

/** Pengingat BK: rujukan Segera yang belum Diterima ≥ 3 hari. */
function KartuPengingatRujukan(p: { buka: () => void }) {
  const { db } = useApp()
  const n = useData(() => pengingatRujukanSegera(db).length, []).data ?? 0
  const baru = useData(() => daftarRujukanMasuk(db).filter((r) => r.status === 'baru').length, []).data ?? 0
  if (!n && !baru) return null
  return (
    <Kartu judul="Rujukan BK">
      {n ? <Spanduk jenis="bahaya">{n} rujukan Segera belum diterima ≥ 3 hari.</Spanduk> : null}
      {baru ? <p>{baru} rujukan baru menunggu diterima.</p> : null}
      <Tombol penuh onClick={p.buka}>
        Buka rujukan
      </Tombol>
    </Kartu>
  )
}

export function BerandaBidang(p: PropHalaman) {
  const { profil } = useApp()
  const jabatan = jabatanProfil(profil)
  return (
    <>
      <JudulHalaman judul={`Assalamu'alaikum, ${profil.nama}`} keterangan={jabatan.map((j) => LABEL_JABATAN[j]).join(' · ')} />
      <KartuPengingatSetor />
      {jabatan.some((j) => j === 'sekretaris' || j === 'pj_desa' || j === 'ketua' || j === 'wakil_ketua') ? <KartuPengingatLaporan /> : null}
      {jabatan.some((j) => j === 'ketua' || j === 'wakil_ketua') ? <KartuRingkasanKetua /> : null}
      {jabatan.includes('bk') ? <KartuPengingatRujukan buka={() => p.pergi('bidang')} /> : null}
      {jabatan.some((j) => j === 'ketua' || j === 'wakil_ketua' || j === 'sekretaris') ? <KartuMusyawarahHp buka={() => p.pergi('bidang')} /> : null}
      <div className="tumpuk">
        <Tombol penuh onClick={() => p.pergi('bidang')}>
          Buka menu bidang
        </Tombol>
        <Tombol penuh varian="kedua" onClick={() => p.pergi('sinkron')}>
          Setor / Buka Berkas
        </Tombol>
      </div>
    </>
  )
}

// =====================================================================================================================
// Mubaligh: Kontrol Keaktifan & Keteladanan MT
// =====================================================================================================================

export function KontrolMtHp(p: { kembali: () => void }) {
  const { db, aksi } = useApp()
  const [tanggal, setTanggal] = useState(tanggalHariIni())
  const bulan = tanggal.slice(0, 7)
  const data = useData(() => daftarCatatan(db, { jenis: 'kontrol_mt', mulai: `${bulan}-01`, selesai: `${bulan}-31` }), [bulan])
  const lembar = (data.data ?? []).find((c) => c.isi) ?? null
  const hari = ((lembar?.isi as { hari?: Record<string, { subuh?: boolean; tahajud?: boolean; dhuha?: boolean; hafalan?: number; tadarus?: string }> } | null)?.hari ?? {})[tanggal.slice(8, 10)] ?? {}
  const [h, setH] = useState(hari)
  const simpan = () => aksi(() => isiKontrolMt(db, tanggal, h), 'Tersimpan. Ikut terkirim saat Setor.')
  return (
    <>
      <JudulHalaman judul="Kontrol Keaktifan MT" keterangan="Keaktifan & keteladanan MT — diperiksa pengajian MT minggu pertama." kembali={p.kembali} />
      <Kartu>
        <Isian label="Tanggal" type="date" nilai={tanggal} ubah={(v) => { setTanggal(v); setH({}) }} />
        <ul className="daftar-centang">
          {(['subuh', 'tahajud', 'dhuha'] as const).map((k) => (
            <li key={k}>
              <label>
                <input type="checkbox" checked={!!h[k]} onChange={(e) => setH({ ...h, [k]: e.target.checked })} />
                Sholat {k === 'subuh' ? 'Subuh' : k === 'tahajud' ? 'Tahajud' : 'Dhuha'}
              </label>
            </li>
          ))}
        </ul>
        <Isian label="Kolom hafalan (mengulang membaca kode B / mendengarkan kode D)" type="number" inputMode="numeric" min={0} max={20} nilai={h.hafalan === undefined ? '' : String(h.hafalan)} ubah={(v) => setH({ ...h, hafalan: v === '' ? undefined : Number(v) })} />
        <Isian label="Tadarus (dari surat … ayat … s.d. …)" nilai={h.tadarus ?? ''} ubah={(v) => setH({ ...h, tadarus: v })} />
        <Tombol penuh onClick={simpan}>
          Simpan hari ini
        </Tombol>
      </Kartu>
      <Kartu judul={`Bulan ini`}>
        {lembar ? <p>{Object.keys((lembar.isi as { hari: object }).hari).length} hari terisi.</p> : <Kosong teks="Belum ada isian bulan ini." />}
      </Kartu>
    </>
  )
}

export { DaftarCatatan as DaftarCatatanBidang }
