// Layar peran Pengurus: Beranda (pengingat setor) · Absen · Data · Rekap · Sinkron (Setor ke Desa/Kelompok, Buka Berkas).
import { useState } from 'react'
import { ambilWilayah, cariGenerus, labelIqro, periodeAktif, rekapKemajuan, rekapPresensi, tambahHari, tanggalHariIni, type GenerusRinci } from '@ppg/core'
import { LaporanBulananHp } from './juknis'
import { teksPeriode, TombolPdfRaport } from '../komponen/juknis'
import { useApp, useData } from '../konteks'
import type { PropHalaman } from '../kerangka'
import { Angka, Isian, JudulHalaman, KeadaanData, Kartu, Lencana, Modal, Tombol } from '../komponen/ui'
import { label, LABEL_KATEGORI, LABEL_STATUS_GENERUS, tanggalTeks } from '../utils/label'
import { DaftarUsulan, FormGenerusBaru, KartuBukaBerkas, KartuSetorData, PilihKelompok, useKelompokSaya } from './bersama'
import { KartuPengingatSetor } from './absen'

export function BerandaPengurus(p: PropHalaman) {
  const { db, profil } = useApp()
  const ringkas = useData(() => {
    const semua = cariGenerus(db, { wilayahId: profil.wilayah_id })
    return {
      wilayah: ambilWilayah(db, profil.wilayah_id)?.nama ?? 'Wilayah Anda',
      aktif: semua.filter((g) => g.status === 'aktif').length,
      mondok: semua.filter((g) => g.status === 'mondok').length,
    }
  }, [profil.id])
  const [bulanan, setBulanan] = useState(false)
  if (bulanan) return <LaporanBulananHp kembali={() => setBulanan(false)} />
  return (
    <>
      <JudulHalaman judul={`Assalamu'alaikum, ${profil.nama}`} keterangan="Pengurus" />
      <KartuPengingatSetor />
      <KeadaanData hasil={ringkas}>
        {(r) => (
          <Kartu judul={r.wilayah}>
            <div className="baris-angka">
              <Angka nilai={r.aktif} teks="Generus aktif" />
              <Angka nilai={r.mondok} teks="Sedang mondok" warna="kuning" />
            </div>
            {r.aktif + r.mondok === 0 ? <p>Data generus belum ada. Buka berkas data dari desa/daerah.</p> : null}
          </Kartu>
        )}
      </KeadaanData>
      <div className="tumpuk">
        <Tombol penuh onClick={() => p.pergi('absen')}>
          Isi Absen
        </Tombol>
        <Tombol penuh varian="kedua" onClick={() => p.pergi('sinkron')}>
          Setor / Buka Berkas
        </Tombol>
        {profil.tingkat === 'kelompok' ? (
          <Tombol penuh varian="kedua" onClick={() => setBulanan(true)}>
            Laporan Bulanan (Musyawaroh & NUNGGONI)
          </Tombol>
        ) : null}
      </div>
    </>
  )
}

export function KartuGenerus(p: { g: GenerusRinci; buka?: () => void }) {
  return (
    <button type="button" className="baris-generus" onClick={p.buka} disabled={!p.buka}>
      <span className="avatar kecil" aria-hidden="true">{p.g.nama.slice(0, 1).toUpperCase()}</span>
      <span className="teks">
        <strong>{p.g.nama}</strong>
        <small>
          {label(LABEL_KATEGORI, p.g.kategori)} · {p.g.kelompok_nama}
        </small>
      </span>
      {p.g.status !== 'aktif' ? <Lencana warna={p.g.status === 'mondok' ? 'kuning' : 'abu'}>{label(LABEL_STATUS_GENERUS, p.g.status)}</Lencana> : null}
    </button>
  )
}

export function DataPengurus() {
  const { db, profil } = useApp()
  const kel = useKelompokSaya()
  const [cari, setCari] = useState('')
  const [form, setForm] = useState(false)
  const [kelompokUsul, setKelompokUsul] = useState('')
  const [detail, setDetail] = useState<GenerusRinci | null>(null)
  const daftar = useData(() => cariGenerus(db, { wilayahId: profil.wilayah_id, cari }), [profil.id, cari])
  const periode = useData(() => periodeAktif(db), []).data ?? ''
  return (
    <>
      <JudulHalaman judul="Data Generus" keterangan="Data dari admin. Perubahan diajukan sebagai usulan." />
      <Kartu>
        <Isian label="Cari nama" nilai={cari} ubah={setCari} placeholder="Ketik nama…" />
        <Tombol penuh varian="kedua" onClick={() => setForm(true)}>
          + Usulkan generus baru
        </Tombol>
      </Kartu>
      <KeadaanData hasil={daftar} kosong={(d) => d.length === 0} teksKosong={cari ? 'Tidak ada nama yang cocok.' : 'Belum ada data generus. Buka berkas data dari admin.'}>
        {(d) => (
          <div className="daftar-kartu">
            {d.map((g) => (
              <KartuGenerus key={g.id} g={g} buka={() => setDetail(g)} />
            ))}
          </div>
        )}
      </KeadaanData>
      {profil.tingkat === 'kelompok' && periode && (daftar.data ?? []).some((g) => g.status === 'aktif') ? (
        <Kartu judul="Raport semua generus kelompok (PDF)">
          <p className="keterangan">{teksPeriode(periode)} · satu anak per halaman A4, untuk dicetak atau dikirim ke orang tua.</p>
          <TombolPdfRaport
            generusIds={(daftar.data ?? []).filter((g) => g.status === 'aktif').map((g) => g.id)}
            periode={periode}
            namaBerkas={kel[0]?.nama ?? 'kelompok'}
            teksCetak="PDF semua raport / Cetak"
          />
        </Kartu>
      ) : null}
      <DaftarUsulan kelompokIds={kel.map((k) => k.id)} />
      {form ? (
        kel.length > 1 && !kelompokUsul ? (
          <Modal judul="Pilih kelompok" tutup={() => setForm(false)}>
            <PilihKelompok nilai={kelompokUsul} ubah={setKelompokUsul} />
          </Modal>
        ) : (
          <FormGenerusBaru
            kelompokId={kelompokUsul || kel[0]?.id || profil.wilayah_id}
            tutup={() => {
              setForm(false)
              setKelompokUsul('')
            }}
          />
        )
      ) : null}
      {detail ? (
        <Modal judul={detail.nama} tutup={() => setDetail(null)}>
          <dl className="rincian">
            <dt>Kelompok</dt>
            <dd>{detail.kelompok_nama}</dd>
            <dt>Kategori</dt>
            <dd>{label(LABEL_KATEGORI, detail.kategori)}</dd>
            <dt>Status</dt>
            <dd>{label(LABEL_STATUS_GENERUS, detail.status)}</dd>
            <dt>Tanggal lahir</dt>
            <dd>{tanggalTeks(detail.tanggal_lahir)}</dd>
            <dt>Orang tua/wali</dt>
            <dd>
              {detail.wali_nama ?? '—'} {detail.wali_no_hp ? `(${detail.wali_no_hp})` : ''}
            </dd>
            <dt>Sekolah</dt>
            <dd>{[detail.sekolah, detail.kelas_sekolah ? `kelas ${detail.kelas_sekolah}` : ''].filter(Boolean).join(' ') || '—'}</dd>
            <dt>Iqro' / Al-Qur'an</dt>
            <dd>{labelIqro(detail.iqro) || '—'}</dd>
          </dl>
        </Modal>
      ) : null}
    </>
  )
}

export function RekapPengurus() {
  const { db, profil } = useApp()
  const hariIni = tanggalHariIni()
  const [mulai, setMulai] = useState(`${hariIni.slice(0, 8)}01`)
  const [selesai, setSelesai] = useState(hariIni)
  const [lihat, setLihat] = useState<'hadir' | 'kemajuan'>('hadir')
  const presensi = useData(() => rekapPresensi(db, { wilayahId: profil.wilayah_id, mulai, selesai }), [profil.id, mulai, selesai])
  const kemajuan = useData(() => (lihat === 'kemajuan' ? rekapKemajuan(db, { wilayahId: profil.wilayah_id }) : []), [profil.id, lihat])
  return (
    <>
      <JudulHalaman judul="Rekap" />
      <div className="tab-kecil" role="tablist">
        <button type="button" role="tab" aria-selected={lihat === 'hadir'} onClick={() => setLihat('hadir')}>
          Kehadiran
        </button>
        <button type="button" role="tab" aria-selected={lihat === 'kemajuan'} onClick={() => setLihat('kemajuan')}>
          Kemajuan
        </button>
      </div>
      {lihat === 'hadir' ? (
        <>
          <Kartu>
            <div className="baris-dua">
              <Isian label="Dari" type="date" nilai={mulai} ubah={(v) => v && setMulai(v)} />
              <Isian label="Sampai" type="date" nilai={selesai} ubah={(v) => v && setSelesai(v)} />
            </div>
            <Tombol kecil varian="tipis" onClick={() => { setMulai(tambahHari(hariIni, -6)); setSelesai(hariIni) }}>
              7 hari terakhir
            </Tombol>
          </Kartu>
          <KeadaanData hasil={presensi} kosong={(r) => r.perGenerus.length === 0} teksKosong="Belum ada catatan kehadiran pada rentang ini.">
            {(r) => (
              <>
                {r.perKelompok.map((k) => (
                  <Kartu key={k.kelompok_id} judul={k.nama}>
                    <div className="baris-angka">
                      <Angka nilai={`${k.persen_hadir}%`} teks="Kehadiran" />
                      <Angka nilai={k.hadir} teks="Hadir" warna="hijau" />
                      <Angka nilai={k.izin + k.sakit} teks="Izin/Sakit" warna="kuning" />
                      <Angka nilai={k.alpa} teks="Alpa" warna="merah" />
                    </div>
                  </Kartu>
                ))}
                <Kartu judul="Per generus">
                  <ul className="daftar-sederhana">
                    {r.perGenerus.map((g) => (
                      <li key={`${g.generus_id}|${g.kelompok_id}`}>
                        <span>{g.nama}</span>
                        <span>
                          {g.hadir}/{g.total} hadir · <b>{g.persen_hadir}%</b>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Kartu>
              </>
            )}
          </KeadaanData>
        </>
      ) : (
        <KeadaanData hasil={kemajuan} kosong={(d) => d.length === 0} teksKosong="Belum ada data generus.">
          {(d) => (
            <Kartu judul="Materi selesai (disahkan)">
              <ul className="daftar-sederhana">
                {d.map((g) => (
                  <li key={g.generus_id}>
                    <span>
                      {g.nama}
                      <small> · {label(LABEL_KATEGORI, g.kategori)}</small>
                    </span>
                    <span>
                      {g.disahkan}/{g.total} · <b>{g.persen}%</b>
                    </span>
                  </li>
                ))}
              </ul>
            </Kartu>
          )}
        </KeadaanData>
      )}
    </>
  )
}

export function SinkronPengurus() {
  return (
    <>
      <JudulHalaman judul="Sinkron" keterangan="Kirim catatan ke tingkat atas dan buka berkas yang diterima." />
      <KartuSetorData />
      <KartuBukaBerkas keterangan="Buka berkas data dari desa/daerah atau berkas materi." />
    </>
  )
}
