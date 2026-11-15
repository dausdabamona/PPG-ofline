// Layar 2: Beranda — sesuai peran instalasi.
// Daerah: ringkasan + status setor tiap desa (+ setoran per kelompok); Desa: status setor tiap kelompok + Setor ke Daerah;
// Kelompok: status setor tiap HP + Setor ke Desa; Kurikulum: periode aktif, target, berkas Kurikulum.
import { buatKurikulum, ringkasanBerandaExe, type RingkasanBerandaExe } from '@ppg/core'
import { useApp, useData } from '../konteks'
import { KeadaanData, Kartu, KepalaHalaman, Lencana, Tombol } from '../komponen/ui'
import { KartuSetorKeAtas, TabelStatusSetor } from '../komponen/setor'
import type { KunciMenu } from '../menu'
import { labelPeriode, waktuLokal } from '../utils/label'

export function HalamanBeranda(p: { pilih: (k: KunciMenu) => void }) {
  const { db, peran, wilayahNama } = useApp()
  const hasil = useData(() => ringkasanBerandaExe(db), [db])
  const judul = peran === 'kurikulum' ? 'Ringkasan kurikulum' : `Ringkasan ${wilayahNama ?? 'wilayah'}`
  return (
    <>
      <KepalaHalaman judul="Beranda" keterangan={judul} />
      <KeadaanData hasil={hasil}>
        {(r) =>
          peran === 'daerah' ? (
            <BerandaDaerah r={r} pilih={p.pilih} />
          ) : peran === 'kurikulum' ? (
            <BerandaKurikulum r={r} pilih={p.pilih} />
          ) : (
            <BerandaBawah r={r} pilih={p.pilih} />
          )
        }
      </KeadaanData>
    </>
  )
}

function BerandaDaerah(p: { r: RingkasanBerandaExe; pilih: (k: KunciMenu) => void }) {
  const a = p.r.admin!
  const terlambat = p.r.statusSetorBawahan.filter((s) => s.terlambat).length
  return (
    <>
      <div className="grid-angka">
        <Angka judul="Generus aktif" nilai={a.generus.aktif} />
        <Angka judul="Generus mondok" nilai={a.generus.mondok} />
        <Angka
          judul="Perangkat aktif"
          nilai={a.perangkatAktif.total}
          catatan={`${a.perangkatAktif.pengurus} pengurus · ${a.perangkatAktif.mubaligh} mubaligh · ${a.perangkatAktif.generus + a.perangkatAktif.wali} generus/wali`}
        />
        <Angka
          judul="Usulan menunggu"
          nilai={a.usulanMenunggu}
          sorot={a.usulanMenunggu > 0}
          aksi={a.usulanMenunggu > 0 ? <Tombol kecil varian="tipis" onClick={() => p.pilih('usulan')}>Tinjau usulan</Tombol> : null}
        />
        <Angka judul="Desa terlambat setor" nilai={terlambat} sorot={terlambat > 0} />
      </div>
      <Kartu
        judul="Status setor tiap desa"
        aksi={
          <>
            <Tombol varian="kedua" onClick={() => p.pilih('jadwal')}>
              Atur jadwal setor
            </Tombol>
            <Tombol varian="kedua" onClick={() => p.pilih('impor')}>
              Impor setoran
            </Tombol>
          </>
        }
      >
        <TabelStatusSetor daftar={p.r.statusSetorBawahan} kolomNama="Desa" teksKosong="Belum ada desa. Mulai dengan menambah wilayah." />
      </Kartu>
      <Kartu judul="Setoran terakhir per kelompok">
        {a.setoranPerKelompok.length === 0 ? (
          <div className="keadaan keadaan-kosong">
            <p>Belum ada kelompok. Mulai dengan menambah wilayah.</p>
            <Tombol onClick={() => p.pilih('wilayah')}>Buka Wilayah</Tombol>
          </div>
        ) : (
          <table className="tabel">
            <thead>
              <tr>
                <th>Kelompok</th>
                <th>Setoran terakhir</th>
                <th>Hari sejak</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {a.setoranPerKelompok.map((s) => (
                <tr key={s.kelompok_id} className={s.terlambat ? 'baris-merah' : ''}>
                  <td>{s.nama}</td>
                  <td>{s.terakhir_setor ? waktuLokal(s.terakhir_setor) : 'Belum pernah'}</td>
                  <td>{s.hari_sejak ?? '—'}</td>
                  <td>
                    {s.terlambat ? (
                      <Lencana warna="merah">Terlambat</Lencana>
                    ) : s.belumAdaSetoran ? (
                      <Lencana warna="kuning">Belum ada setoran</Lencana>
                    ) : (
                      <Lencana warna="hijau">Lancar</Lencana>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Kartu>
    </>
  )
}

function BerandaBawah(p: { r: RingkasanBerandaExe; pilih: (k: KunciMenu) => void }) {
  const { peran } = useApp()
  const r = p.r
  const desa = peran === 'desa'
  const terlambat = r.statusSetorBawahan.filter((s) => s.terlambat).length
  return (
    <>
      <div className="grid-angka">
        <Angka judul="Generus aktif" nilai={r.generus.aktif} />
        <Angka judul="Generus mondok" nilai={r.generus.mondok} />
        <Angka judul="Perangkat aktif" nilai={r.perangkatAktif} />
        <Angka judul="Belum sampai daerah" nilai={r.belumSampaiDaerah} catatan="Data yang belum dipastikan diterima daerah" />
        <Angka judul={desa ? 'Kelompok terlambat setor' : 'HP terlambat setor'} nilai={terlambat} sorot={terlambat > 0} />
      </div>
      <KartuSetorKeAtas ringkas />
      <Kartu
        judul={desa ? 'Status setor tiap kelompok' : 'Status setor tiap HP pengurus/mubaligh'}
        aksi={
          <>
            {!desa ? (
              <Tombol varian="kedua" onClick={() => p.pilih('absen')}>
                Absen pertemuan
              </Tombol>
            ) : null}
            <Tombol varian="kedua" onClick={() => p.pilih('impor')}>
              Impor setoran
            </Tombol>
          </>
        }
      >
        <TabelStatusSetor
          daftar={r.statusSetorBawahan}
          kolomNama={desa ? 'Kelompok' : 'HP'}
          teksKosong={desa ? 'Belum ada kelompok. Buka paket dari daerah terlebih dahulu.' : 'Belum ada HP pengurus/mubaligh di kelompok ini.'}
        />
        <p className="keterangan">Paket terakhir dari tingkat atas: {r.terakhirPaket ? waktuLokal(r.terakhirPaket) : 'belum pernah dibuka'}.</p>
      </Kartu>
    </>
  )
}

function BerandaKurikulum(p: { r: RingkasanBerandaExe; pilih: (k: KunciMenu) => void }) {
  const { db, platform, aksi, toast } = useApp()
  const k = p.r.kurikulum!
  return (
    <>
      <div className="grid-angka">
        <Angka judul="Periode aktif" nilai={k.periode} catatan={labelPeriode(k.periode).replace(`${k.periode} `, '')} />
        <Angka judul="Materi target periode ini" nilai={k.jumlahTarget} />
        <Angka judul="Suntingan belum dikirim" nilai={k.suntinganBelumDikirim} sorot={k.suntinganBelumDikirim > 0} />
      </div>
      <Kartu judul="Kirim kurikulum ke daerah">
        <p>
          Berkas Kurikulum memuat materi, target capaian, dan periode aktif yang disunting di sini. Kirim ke Admin Daerah lewat WA; daerah mengimpornya di menu
          Impor Setoran lalu meneruskan lewat Berkas Materi.
        </p>
        <p className="keterangan">Terakhir dibuat: {k.terakhirKirim ? waktuLokal(k.terakhirKirim) : 'belum pernah'}.</p>
        <div className="aksi aksi-kiri">
          <button
            type="button"
            className="tombol tombol-utama tombol-besar"
            onClick={async () => {
              const b = await aksi(() => buatKurikulum(db))
              if (!b) return
              const lok = await aksi(() => platform.simpanBerkas(b.nama, b.bytes))
              if (lok) toast('sukses', `Berkas ${b.nama} (${b.jumlah} data) disimpan. Kirim ke Admin Daerah lewat WA.`)
            }}
          >
            Buat berkas Kurikulum
          </button>
          <Tombol varian="kedua" onClick={() => p.pilih('target')}>
            Atur target capaian
          </Tombol>
          <Tombol varian="kedua" onClick={() => p.pilih('bukaPaket')}>
            Buka berkas materi dari daerah
          </Tombol>
        </div>
      </Kartu>
    </>
  )
}

function Angka(p: { judul: string; nilai: number | string; catatan?: string; sorot?: boolean; aksi?: React.ReactNode }) {
  return (
    <div className={`kartu-angka${p.sorot ? ' sorot' : ''}`}>
      <span className="judul-angka">{p.judul}</span>
      <strong className="nilai-angka">{p.nilai}</strong>
      {p.catatan ? <small>{p.catatan}</small> : null}
      {p.aksi}
    </div>
  )
}
