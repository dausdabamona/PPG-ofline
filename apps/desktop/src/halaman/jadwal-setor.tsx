// v3 (V2): Jadwal Setor — admin daerah menetapkan tenggat kelompok → desa (mis. mingguan) dan desa → daerah (mis. bulanan).
// Jadwal ikut turun lewat Kirim Paket; EXE desa/kelompok dan HP menampilkan pengingat dan menandai yang terlambat.
import { useEffect, useState } from 'react'
import { aturJadwalSetor, hapusJadwalSetor, jadwalSetorUntuk, type TingkatAsalSetor } from '@ppg/core'
import { useApp, useData } from '../konteks'
import { Isian, KeadaanData, Kartu, KepalaHalaman, Konfirmasi, Lencana, Pilihan, Tombol } from '../komponen/ui'
import { NAMA_HARI, uraianJadwalSetor } from '../utils/label'

const OPSI_HARI = NAMA_HARI.map((h, i) => ({ nilai: String(i), teks: h }))
const OPSI_TANGGAL = Array.from({ length: 28 }, (_, i) => ({ nilai: String(i + 1), teks: `Tanggal ${i + 1}` }))

export function HalamanJadwalSetor() {
  return (
    <>
      <KepalaHalaman
        judul="Jadwal Setor"
        keterangan="Tenggat setor tiap tingkat. Setelah diubah, Kirim Paket ke desa agar jadwal sampai ke EXE desa, EXE kelompok, dan HP."
      />
      <FormJadwal tingkat="kelompok" judul="Kelompok → Desa" bawaan={{ pola: 'pekanan', hari: '0', tanggal: '1', jam: '21:00' }} />
      <FormJadwal tingkat="desa" judul="Desa → Daerah" bawaan={{ pola: 'bulanan', hari: '0', tanggal: '5', jam: '12:00' }} />
    </>
  )
}

function FormJadwal(p: { tingkat: TingkatAsalSetor; judul: string; bawaan: { pola: string; hari: string; tanggal: string; jam: string } }) {
  const { db, aksi } = useApp()
  const hasil = useData(() => jadwalSetorUntuk(db, p.tingkat) ?? null, [db, p.tingkat])
  const [pola, setPola] = useState(p.bawaan.pola)
  const [hari, setHari] = useState(p.bawaan.hari)
  const [tanggal, setTanggal] = useState(p.bawaan.tanggal)
  const [jam, setJam] = useState(p.bawaan.jam)
  const [hapus, setHapus] = useState(false)
  const j = hasil.data
  useEffect(() => {
    if (!j) return
    setPola(j.pola)
    if (j.hari !== null) setHari(String(j.hari))
    if (j.tanggal_bulan !== null) setTanggal(String(j.tanggal_bulan))
    if (j.jam) setJam(j.jam)
  }, [j?.id, j?.diubah_pada])
  const id = `jadwal-${p.tingkat}`
  return (
    <Kartu judul={p.judul}>
      <KeadaanData hasil={hasil}>
        {(x) => (
          <p>
            Sekarang: <b>{uraianJadwalSetor(x)}</b> {x ? <Lencana warna="hijau">Aktif</Lencana> : <Lencana warna="abu">Belum diatur — tidak ada yang ditandai terlambat</Lencana>}
          </p>
        )}
      </KeadaanData>
      <div className="formulir tiga-kolom" data-testid={id}>
        <Pilihan
          label={`Pola ${p.judul}`}
          nilai={pola}
          ubah={setPola}
          pilihan={[
            { nilai: 'pekanan', teks: 'Mingguan (tiap hari tertentu)' },
            { nilai: 'bulanan', teks: 'Bulanan (tiap tanggal tertentu)' },
          ]}
        />
        {pola === 'pekanan' ? (
          <Pilihan label={`Hari ${p.judul}`} nilai={hari} ubah={setHari} pilihan={OPSI_HARI} />
        ) : (
          <Pilihan label={`Tanggal ${p.judul}`} nilai={tanggal} ubah={setTanggal} pilihan={OPSI_TANGGAL} />
        )}
        <Isian label={`Batas jam ${p.judul}`} type="time" nilai={jam} ubah={setJam} />
      </div>
      <div className="aksi">
        {j ? (
          <Tombol varian="kedua" onClick={() => setHapus(true)}>
            Hapus jadwal
          </Tombol>
        ) : null}
        <Tombol
          onClick={() =>
            aksi(
              () =>
                aturJadwalSetor(db, {
                  tingkatAsal: p.tingkat,
                  pola: pola as 'pekanan' | 'bulanan',
                  hari: pola === 'pekanan' ? Number(hari) : null,
                  tanggal: pola === 'bulanan' ? Number(tanggal) : null,
                  jam: jam || null,
                }),
              (x) => `Jadwal ${p.judul} disimpan: ${uraianJadwalSetor(x)}.`,
            )
          }
        >
          Simpan jadwal {p.judul}
        </Tombol>
      </div>
      {hapus ? (
        <Konfirmasi
          judul="Hapus jadwal setor"
          pesan={`Hapus jadwal ${p.judul}? Tidak ada lagi yang ditandai terlambat untuk tingkat ini.`}
          ya="Hapus"
          bahaya
          batal={() => setHapus(false)}
          setuju={async () => {
            await aksi(() => hapusJadwalSetor(db, p.tingkat), 'Jadwal dihapus.')
            setHapus(false)
          }}
        />
      ) : null}
    </Kartu>
  )
}
