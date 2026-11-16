// §18 (Fase 12) — Penetapan Kurikulum & kebijakan lewat musyawaroh: hak di core, pengesahan, penerapan hanya di EXE Daerah,
// penyebaran lewat paket, riwayat, rotasi kunci keuangan, TOTAL tanpa materi belum ditetapkan, DB lama aman.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  agendaMusyawarahBerikutnya,
  aktifkanExe,
  aktifkanProfil,
  ambilMateriEvaluasi,
  beriMandat,
  bukaDb,
  buatKurikulum,
  buatMateri,
  buatPaket,
  buatSetor,
  daftarButirKurikulum,
  daftarCatatan,
  daftarKebijakan,
  daftarMateriEvaluasi,
  daftarNotulen,
  daftarUsulan,
  idMateriEvaluasi,
  imporKurikulum,
  imporSetor,
  inisialisasiExe,
  jumlahKebijakanSementara,
  musyawarahBulan,
  nilaiKebijakan,
  raporGenerus,
  rewardHasilBelajar,
  ringkasanKas,
  ringkasanMusyawarah,
  rumusTotal,
  sahkanNotulen,
  simpanCatatan,
  simpanDb,
  simpanEvaluasi,
  simpanNotulen,
  tambahGenerus,
  tambahWilayah,
  teksWaHasil,
  teksWaUndangan,
  terapkanMateri,
  terapkanPaket,
  terbitkanToken,
  tetapkanButirKurikulum,
  ubahMateriEvaluasi,
  setujuiUsulan,
  type Db,
  type Jabatan,
  type KunciAdmin,
  type Profil,
  type Wilayah,
} from '../src/index'
import { buatAdmin, buatHp, lepasJam, maju, pasangJam, SANDI } from './bantu'

beforeAll(() => pasangJam('2026-11-20T01:00:00.000Z'))
afterAll(() => lepasJam())

interface Dunia {
  admin: { db: Db; kunci: KunciAdmin }
  daerah: Wilayah
  desa: Record<string, Wilayah>
  kel: Record<string, Wilayah>
}

async function dunia(): Promise<Dunia> {
  const admin = await buatAdmin()
  const daerah = tambahWilayah(admin.db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
  const desa: Record<string, Wilayah> = {}
  const kel: Record<string, Wilayah> = {}
  for (const [nd, kd, kk] of [['Sorong', 'SRG-SRG', 'SRG-RMU'], ['Aimas', 'SRG-AMS', 'AMS-JLA'], ['Fakfak', 'SRG-FFK', 'FFK-KTA'], ['Kaimana', 'SRG-KMN', 'KMN-BTM']] as const) {
    desa[nd] = tambahWilayah(admin.db, { tingkat: 'desa', nama: nd, kode: kd, indukId: daerah.id })
    kel[kk] = tambahWilayah(admin.db, { tingkat: 'kelompok', nama: `Kelompok ${kk}`, kode: kk, indukId: desa[nd]!.id })
  }
  return { admin, daerah, desa, kel }
}

type Hp = { db: Db; profil: Profil; id: string }
async function pengurus(w: Dunia, nama: string, jabatan: Jabatan[], wilayah?: Wilayah): Promise<Hp> {
  const hp = await buatHp(`HP ${nama}`)
  const profil = await aktifkanProfil(hp.db, terbitkanToken(w.admin.db, w.admin.kunci, { kodePerangkat: hp.kode, role: 'pengurus', nama, wilayahId: (wilayah ?? w.daerah).id, jabatan }))
  segarkan(w, hp, wilayah)
  return { db: hp.db, profil, id: hp.id }
}
function segarkan(w: Dunia, hp: { db: Db }, wilayah?: Wilayah) {
  terapkanPaket(hp.db, buatPaket(w.admin.db, (wilayah ?? w.daerah).id, w.admin.kunci).bytes)
}
function setor(w: Dunia, hp: { db: Db }) {
  maju(1)
  return imporSetor(w.admin.db, buatSetor(hp.db).bytes, w.admin.kunci)
}

describe('Register kebijakan & musyawaroh (§18.3)', () => {
  it('nilai sementara katalog: tabungan Sorong/Aimas terisi, Fakfak/Kaimana belum ditetapkan; DB lama tanpa register aman', async () => {
    const w = await dunia()
    const db2 = await bukaDb(simpanDb(w.admin.db))
    const reg = daftarKebijakan(db2)
    const tab = reg.filter((r) => r.kunci === 'tabungan_desa')
    expect(tab.map((t) => [t.lingkup_nama, t.status])).toEqual([
      ['Aimas', 'sementara'],
      ['Fakfak', 'belum'],
      ['Kaimana', 'belum'],
      ['Sorong', 'sementara'],
    ])
    expect(nilaiKebijakan(db2, 'tabungan_desa', w.desa.Sorong!.id)).toEqual({ nominal: 700_000, peruntukan: 'mumi_daerah' })
    expect(nilaiKebijakan(db2, 'hak_baca_keuangan')).toEqual(['ketua', 'wakil_ketua', 'bendahara', 'penggalang_dana'])
    expect(musyawarahBulan('2026-11', db2).jenis).toBe('bersama')
    expect(jumlahKebijakanSementara(db2)).toBe(reg.length)
  })

  it('hanya sekretaris menulis notulen; tanpa pengesahan tetap usulan; ketua mengesahkan → daerah menerapkan, riwayat, paket, rotasi kunci keuangan', async () => {
    const w = await dunia()
    const sek = await pengurus(w, 'Sekretaris', ['sekretaris'])
    const ketua = await pengurus(w, 'Ketua', ['ketua'])
    const bendahara = await pengurus(w, 'Bendahara', ['bendahara'])
    const penggalang = await pengurus(w, 'Penggalang', ['penggalang_dana'])
    // ketua / bendahara tidak boleh menulis notulen (core)
    expect(() => simpanNotulen(ketua.db, { jenis_musyawarah: 'bersama', hasil: 'x' })).toThrow(/Sekretaris/)
    expect(() => simpanCatatan(bendahara.db, { jenis: 'notulen', isi: { jenis_musyawarah: 'bersama', hasil: 'x' } })).toThrow(/berwenang/)
    // nilai kebijakan diperiksa saat menulis
    expect(() =>
      simpanNotulen(sek.db, { jenis_musyawarah: 'bersama', keputusan: [{ teks: 'Bendahara tidak baca', kunci: 'hak_baca_keuangan', lingkup_id: w.daerah.id, nilai: ['ketua'] }] }),
    ).toThrow(/Bendahara wajib/)
    const n = simpanNotulen(sek.db, {
      jenis_musyawarah: 'bersama',
      tanggal: '2026-11-15',
      peserta: 'Pengurus PPG Daerah',
      agenda: ['Tabungan desa', 'Hak baca keuangan'],
      uraian: 'Pembahasan tabungan & keuangan',
      keputusan: [
        { teks: 'Tabungan Fakfak Rp250.000', kunci: 'tabungan_desa', lingkup_id: w.desa.Fakfak!.id, nilai: { nominal: 250_000, peruntukan: 'dikembalikan_desa' } },
        { teks: 'Penggalang dana tidak membaca kas', kunci: 'hak_baca_keuangan', lingkup_id: w.daerah.id, nilai: ['ketua', 'wakil_ketua', 'bendahara'] },
        { teks: 'Juara 5 santri', kunci: 'reward_juara', lingkup_id: w.daerah.id, nilai: { santri: 5, kelompok: 2, desa: 1 } },
        { teks: 'Kegiatan berjalan seperti biasa' },
      ],
    })
    expect((n.judul ?? '').endsWith('/MUS/PPG/2026')).toBe(true)
    // belum disahkan → setor sekretaris: kebijakan tetap sementara
    setor(w, sek)
    expect(nilaiKebijakan(w.admin.db, 'tabungan_desa', w.desa.Fakfak!.id).nominal).toBeNull()
    expect(daftarNotulen(w.admin.db)[0]!.status).toBe('menunggu')
    // ketua menerima notulen lewat paket, mengesahkan
    segarkan(w, ketua)
    expect(daftarNotulen(ketua.db)).toHaveLength(1)
    sahkanNotulen(ketua.db, n.id)
    expect(daftarNotulen(ketua.db)[0]!.status).toBe('disahkan')
    const r = setor(w, ketua)
    expect(r.keputusanDiterapkan).toBe(3)
    expect(r.kunciKeuanganDiganti).toBe(true)
    const fak = daftarKebijakan(w.admin.db).find((k) => k.kunci === 'tabungan_desa' && k.lingkup_id === w.desa.Fakfak!.id)!
    expect(fak).toMatchObject({ status: 'ditetapkan', disahkan_oleh: 'Ketua', dasar: { nomor: n.judul, tanggal: '2026-11-15', jenis_musyawarah: 'bersama' } })
    expect(fak.riwayat).toHaveLength(1)
    expect(fak.riwayat[0]!.sebelumnya).toEqual({ nominal: null, peruntukan: 'dikembalikan_desa' })
    expect(daftarNotulen(w.admin.db)[0]!.status).toBe('diterapkan')
    // impor ulang tidak menerapkan dua kali
    expect(setor(w, ketua).keputusanDiterapkan).toBe(0)
    // konsumen kebijakan
    expect(rewardHasilBelajar(w.admin.db, { wilayahId: w.daerah.id, jenjang: 'praremaja' }).juara).toEqual({ santri: 5, kelompok: 2, desa: 1 })
    // tersebar lewat paket daerah
    for (const hp of [ketua, bendahara, penggalang]) segarkan(w, hp)
    expect(nilaiKebijakan(bendahara.db, 'tabungan_desa', w.desa.Fakfak!.id).nominal).toBe(250_000)
    expect(ringkasanKas(bendahara.db).tabungan.find((t) => t.desa === 'Fakfak')).toMatchObject({ target: 250_000, sumber: 'musyawarah' })
    // rotasi: catatan kas baru (kunci versi 2) terbaca bendahara, tidak terbaca penggalang dana; penggalang tetap bisa mencatat
    simpanCatatan(bendahara.db, { jenis: 'kas', isi: { arah: 'masuk', jumlah: 50_000, akun: 'lain', keterangan: 'infaq' } })
    expect(daftarCatatan(bendahara.db, { jenis: 'kas' })[0]).toMatchObject({ versi_kunci: 2, terkunci: false })
    setor(w, bendahara)
    segarkan(w, penggalang)
    const kasPenggalang = daftarCatatan(penggalang.db, { jenis: 'kas' })
    expect(kasPenggalang[0]).toMatchObject({ versi_kunci: 2, terkunci: true, isi: null })
    const dana = simpanCatatan(penggalang.db, { jenis: 'dana_masuk', isi: { sumber: 'aghniya', jumlah: 100_000 } })
    expect(dana.versi_kunci).toBe(2)
    setor(w, penggalang)
    segarkan(w, bendahara)
    expect(daftarCatatan(bendahara.db, { jenis: 'dana_masuk' })[0]!.isi).toMatchObject({ jumlah: 100_000 })
    // teks WA hasil memuat keputusan & status pengesahan
    const wa = teksWaHasil(w.admin.db, n.id)
    expect(wa).toMatch(/Tabungan Fakfak/)
    expect(wa).toMatch(/Disahkan Ketua/)
  })

  it('wakil ketua hanya mengesahkan dengan mandat; pemalsuan pengesahan & notulen diubah sesudah disahkan tidak diterapkan', async () => {
    const w = await dunia()
    const sek = await pengurus(w, 'Sekretaris', ['sekretaris'])
    const ketua = await pengurus(w, 'Ketua', ['ketua'])
    const wakil = await pengurus(w, 'Wakil', ['wakil_ketua'])
    const sarpras = await pengurus(w, 'Sarpras', ['sarpras'])
    const n = simpanNotulen(sek.db, { jenis_musyawarah: 'muda_mudi', tanggal: '2026-11-18', keputusan: [{ teks: 'Pengingat PJ desa mulai tgl 22', kunci: 'pengingat_laporan', lingkup_id: w.daerah.id, nilai: { awal_sampai: 5, akhir_mulai: 22 } }] })
    setor(w, sek)
    segarkan(w, wakil)
    segarkan(w, sarpras)
    expect(() => sahkanNotulen(wakil.db, n.id)).toThrow(/mandat/)
    expect(() => sahkanNotulen(sarpras.db, n.id)).toThrow(/Ketua/)
    // ketua mundur-tanggal pengesahan sebelum musyawarah → tidak diterapkan
    segarkan(w, ketua)
    const { simpanCatatan: sc, sidikNotulen, daftarCatatan: dc, idPengesahan } = await import('../src/index')
    const nn = dc(ketua.db, { jenis: 'notulen' }).find((c) => c.id === n.id)!
    sc(ketua.db, { jenis: 'pengesahan', id: idPengesahan(n.id, ketua.id), isi: { notulen_id: n.id, sidik: sidikNotulen(nn) }, rujukanId: n.id, tanggal: '2026-11-01', wilayahId: nn.wilayah_id })
    const mundur = setor(w, ketua)
    expect(mundur.keputusanDiterapkan).toBe(0)
    expect(mundur.keputusanTertunda).toBeGreaterThan(0)
    // sarpras merakit catatan pengesahan → ditolak saat impor (jabatan)
    expect(() => simpanCatatan(sarpras.db, { jenis: 'pengesahan', isi: { notulen_id: n.id, sidik: 'a'.repeat(64) } })).toThrow(/berwenang/)
    // ketua memberi mandat → wakil menerima lewat paket → mengesahkan
    beriMandat(ketua.db, { mulai: '2026-11-01', sampai: '2026-12-31', keterangan: 'Ketua safar' })
    setor(w, ketua)
    segarkan(w, wakil)
    sahkanNotulen(wakil.db, n.id)
    expect(setor(w, wakil).keputusanDiterapkan).toBe(1)
    expect(nilaiKebijakan(w.admin.db, 'pengingat_laporan')).toEqual({ awal_sampai: 5, akhir_mulai: 22 })
    expect(daftarKebijakan(w.admin.db).find((k) => k.kunci === 'pengingat_laporan')!.disahkan_oleh).toBe('Wakil')
    // notulen kedua disahkan lalu diubah sekretaris → tidak diterapkan (perlu disahkan ulang)
    const n2 = simpanNotulen(sek.db, { jenis_musyawarah: 'bersama', tanggal: '2026-11-19', keputusan: [{ teks: 'Bobot 70:30', kunci: 'reward_skor', lingkup_id: w.daerah.id, nilai: { bobot_keaktifan: 70, bobot_penguasaan: 30 } }] })
    setor(w, sek)
    segarkan(w, ketua)
    sahkanNotulen(ketua.db, n2.id)
    // sekretaris belum menerima pengesahan → masih bisa mengubah notulennya sendiri
    simpanNotulen(sek.db, { id: n2.id, jenis_musyawarah: 'bersama', tanggal: '2026-11-19', keputusan: [{ teks: 'Bobot 90:10', kunci: 'reward_skor', lingkup_id: w.daerah.id, nilai: { bobot_keaktifan: 90, bobot_penguasaan: 10 } }] })
    setor(w, sek)
    const r = setor(w, ketua)
    expect(r.keputusanDiterapkan).toBe(0)
    expect(r.keputusanTertunda).toBeGreaterThan(0)
    expect(nilaiKebijakan(w.admin.db, 'reward_skor')).toEqual({ bobot_keaktifan: 50, bobot_penguasaan: 50 })
    expect(daftarNotulen(w.admin.db).find((x) => x.catatan.id === n2.id)!.status).toBe('perlu_ulang')
    // setelah sekretaris menerima pengesahan, notulen tidak bisa diubah lagi
    segarkan(w, sek)
    segarkan(w, ketua)
    sahkanNotulen(ketua.db, n2.id)
    expect(setor(w, ketua).keputusanDiterapkan).toBe(1)
    expect(nilaiKebijakan(w.admin.db, 'reward_skor').bobot_keaktifan).toBe(90)
    segarkan(w, sek)
    expect(() => simpanNotulen(sek.db, { id: n2.id, jenis_musyawarah: 'bersama', hasil: 'ubah' })).toThrow(/sudah disahkan/)
  })

  it('musyawarah desa (PJ desa) hanya mengubah kebijakan lingkup desanya; EXE tidak menulis notulen; agenda & undangan WA', async () => {
    const w = await dunia()
    const pjAimas = await pengurus(w, 'PJ Aimas', ['pj_desa'], w.desa.Aimas)
    const ketua = await pengurus(w, 'Ketua', ['ketua'])
    expect(() => simpanNotulen(pjAimas.db, { jenis_musyawarah: 'desa', keputusan: [{ teks: 'x', kunci: 'tabungan_desa', lingkup_id: w.desa.Sorong!.id, nilai: { nominal: 1, peruntukan: 'mumi_daerah' } }] })).toThrow(/lingkup desanya/)
    expect(() => simpanNotulen(pjAimas.db, { jenis_musyawarah: 'desa', keputusan: [{ teks: 'x', kunci: 'reward_juara', lingkup_id: w.daerah.id, nilai: { santri: 1, kelompok: 1, desa: 1 } }] })).toThrow()
    expect(() => simpanNotulen(pjAimas.db, { jenis_musyawarah: 'desa', wilayahId: w.desa.Sorong!.id, hasil: 'x' })).toThrow(/wilayah Anda/)
    const n = simpanNotulen(pjAimas.db, { jenis_musyawarah: 'desa', tanggal: '2026-11-10', keputusan: [{ teks: 'Tabungan Aimas Rp650.000', kunci: 'tabungan_desa', lingkup_id: w.desa.Aimas!.id, nilai: { nominal: 650_000, peruntukan: 'mumi_daerah' } }] })
    expect(() => simpanNotulen(w.admin.db, { jenis_musyawarah: 'bersama', hasil: 'x' })).toThrow(/Sekretaris/)
    expect(() => simpanCatatan(w.admin.db, { jenis: 'notulen', isi: { jenis_musyawarah: 'bersama', hasil: 'x' } })).toThrow(/HP jabatannya/)
    setor(w, pjAimas)
    segarkan(w, ketua)
    sahkanNotulen(ketua.db, n.id)
    expect(setor(w, ketua).keputusanDiterapkan).toBe(1)
    expect(nilaiKebijakan(w.admin.db, 'tabungan_desa', w.desa.Aimas!.id).nominal).toBe(650_000)
    // agenda daerah memuat kebijakan sementara (Aimas sudah ditetapkan, Fakfak/Kaimana belum)
    const ag = agendaMusyawarahBerikutnya(w.admin.db, w.daerah.id, '2026-11-20')
    expect(ag).toMatchObject({ bulan: '2026-11', jenis: 'bersama' })
    expect(ag.kebijakanSementara.some((k) => k.lingkup_nama === 'Fakfak')).toBe(true)
    expect(ag.kebijakanSementara.some((k) => k.lingkup_nama === 'Aimas')).toBe(false)
    expect(agendaMusyawarahBerikutnya(w.admin.db, w.desa.Aimas!.id, '2026-11-20')).toMatchObject({ bulan: '2026-12', jenis: 'desa', kebijakanSementara: [] })
    const u = teksWaUndangan(w.admin.db, { wilayahId: w.daerah.id, tanggal: '2026-11-29', jam: '20.00', tempat: 'Masjid' })
    expect(u).toMatch(/Undangan Musyawarah rutin bersama/)
    expect(u).toMatch(/Penetapan Tabungan bulanan desa — Fakfak/)
    const rk = ringkasanMusyawarah(w.admin.db, w.daerah.id, '2026-11-20')
    expect(rk.terakhir).toMatchObject({ jenis: 'desa', status: 'diterapkan' })
    expect(rk.kebijakanSementara).toBe(jumlahKebijakanSementara(w.admin.db))
  })
})

describe('Penyebaran register hanya dari daerah (J-KR6)', () => {
  it('EXE desa menerima kebijakan dari daerah tetapi tidak meneruskannya di paket desa', async () => {
    const w = await dunia()
    const sek = await pengurus(w, 'Sekretaris', ['sekretaris'])
    const ketua = await pengurus(w, 'Ketua', ['ketua'])
    const n = simpanNotulen(sek.db, { jenis_musyawarah: 'bersama', keputusan: [{ teks: 'Tabungan Sorong 800 rb', kunci: 'tabungan_desa', lingkup_id: w.desa.Sorong!.id, nilai: { nominal: 800_000, peruntukan: 'mumi_daerah' } }] })
    setor(w, sek)
    segarkan(w, ketua)
    sahkanNotulen(ketua.db, n.id)
    setor(w, ketua)
    const exe = await bukaDb()
    const { kodePerangkat, kunci } = await inisialisasiExe(exe, { sandi: SANDI, label: 'EXE Desa Sorong' })
    await aktifkanExe(exe, kunci, terbitkanToken(w.admin.db, w.admin.kunci, { kodePerangkat, role: 'admin', nama: 'Admin Desa Sorong', wilayahId: w.desa.Sorong!.id }))
    terapkanPaket(exe, buatPaket(w.admin.db, w.desa.Sorong!.id, w.admin.kunci).bytes)
    expect(nilaiKebijakan(exe, 'tabungan_desa', w.desa.Sorong!.id).nominal).toBe(800_000)
    const { terbitkanTokenBawah } = await import('../src/index')
    const hp = await buatHp('HP PJ Remu')
    await aktifkanProfil(hp.db, terbitkanTokenBawah(exe, kunci, { kodePerangkat: hp.kode, role: 'pengurus', nama: 'Pengurus Remu', wilayahId: w.kel['SRG-RMU']!.id }))
    terapkanPaket(hp.db, buatPaket(exe, w.kel['SRG-RMU']!.id, kunci).bytes)
    expect(hp.db.nilai<number>("SELECT COUNT(*) FROM pengaturan WHERE id LIKE 'kbj:%'")).toBe(0)
    expect(nilaiKebijakan(hp.db, 'tabungan_desa', w.desa.Sorong!.id).nominal).toBe(700_000)
  })
})

describe('Perlu Ditetapkan Kurikulum (§18.2)', () => {
  async function exeKurikulum(w: Dunia) {
    const db = await bukaDb()
    const { kodePerangkat, kunci } = await inisialisasiExe(db, { sandi: SANDI, label: 'EXE Kurikulum' })
    await aktifkanExe(db, kunci, terbitkanToken(w.admin.db, w.admin.kunci, { kodePerangkat, role: 'kurikulum', nama: 'Tim Kurikulum', wilayahId: w.daerah.id }))
    terapkanMateri(db, buatMateri(w.admin.db, w.admin.kunci).bytes)
    return db
  }

  it('16 butir dengan nilai sementara; daerah tidak menetapkan; EXE Kurikulum menetapkan → KURIKULUM → daerah → MATERI', async () => {
    const w = await dunia()
    const awal = daftarButirKurikulum(w.admin.db)
    expect(awal).toHaveLength(16)
    expect(awal.filter((b) => b.status === 'belum').map((b) => b.kode)).toEqual(['K11', 'K12'])
    expect(awal.find((b) => b.kode === 'K01')!.ringkas).toBe('Semester 1: November · Semester 2: Mei')
    expect(() => tetapkanButirKurikulum(w.admin.db, 'K01')).toThrow(/Bidang Kurikulum/)
    const kur = await exeKurikulum(w)
    tetapkanButirKurikulum(kur, 'K01', { nilai: { S1: 12, S2: 6 }, catatan: 'Hasil rapat kurikulum' })
    tetapkanButirKurikulum(kur, 'K03', { nilai: { [idMateriEvaluasi('paud', 'keilmuan')]: 6 } })
    tetapkanButirKurikulum(kur, 'K10', { nilai: '45' })
    tetapkanButirKurikulum(kur, 'K14', { nilai: 'tanpa_doa' })
    tetapkanButirKurikulum(kur, 'K15', { nilai: 'butir' })
    // halaman kitab: sebagian diisi → tersimpan, masih belum ditetapkan
    const kitab = daftarButirKurikulum(kur).find((b) => b.kode === 'K12')!
    const sebagian = Object.fromEntries(kitab.isian.map((i) => [i.kunci, i.nilai ?? (i.kunci === "K. Da'wat" ? 120 : null)]))
    expect(tetapkanButirKurikulum(kur, 'K12', { nilai: sebagian }).status).toBe('tersimpan')
    expect(daftarButirKurikulum(kur).find((b) => b.kode === 'K12')!.status).toBe('belum')
    const b = daftarButirKurikulum(kur)
    expect(b.find((x) => x.kode === 'K01')).toMatchObject({ status: 'ditetapkan', penetapan: { oleh: 'Tim Kurikulum', catatan: 'Hasil rapat kurikulum' } })
    expect(ambilMateriEvaluasi(kur, idMateriEvaluasi('paud', 'keilmuan'))!.target).toBe(6)
    expect(ambilMateriEvaluasi(kur, idMateriEvaluasi('remaja', 'surat'))!.target).toBe(45)
    expect(daftarMateriEvaluasi(kur, 'caberawit_c')).toHaveLength(21)
    expect(ambilMateriEvaluasi(kur, idMateriEvaluasi('remaja', 'wudhu_sholat'))!.cara).toBe('hitungan')
    // ke daerah lewat KURIKULUM, lalu turun lewat MATERI
    imporKurikulum(w.admin.db, buatKurikulum(kur).bytes, w.admin.kunci)
    const d = daftarButirKurikulum(w.admin.db)
    expect(d.filter((x) => x.status === 'ditetapkan').map((x) => x.kode)).toEqual(['K01', 'K03', 'K10', 'K14', 'K15'])
    expect(d.find((x) => x.kode === 'K12')!.isian.find((i) => i.kunci === "K. Da'wat")!.nilai).toBe(120)
    const hp = await pengurus(w, 'Kurikulum HP', ['kurikulum'])
    terapkanMateri(hp.db, buatMateri(w.admin.db, w.admin.kunci).bytes)
    expect(daftarButirKurikulum(hp.db).find((x) => x.kode === 'K01')!.status).toBe('ditetapkan')
    // daerah menyunting materi sesudah ditetapkan → kembali Sementara (ditandai berubah)
    ubahMateriEvaluasi(w.admin.db, idMateriEvaluasi('paud', 'keilmuan'), { target: 5 })
    expect(daftarButirKurikulum(w.admin.db).find((x) => x.kode === 'K03')).toMatchObject({ status: 'sementara', berubah: true })
  })

  it('HP jabatan Bidang Kurikulum menetapkan lewat usulan (disetujui otomatis di daerah); jabatan lain ditolak; TOTAL tanpa materi belum ditetapkan & rumus TOTAL', async () => {
    const w = await dunia()
    const kur = await pengurus(w, 'Kurikulum HP', ['kurikulum'])
    const sarpras = await pengurus(w, 'Sarpras', ['sarpras'])
    expect(() => tetapkanButirKurikulum(sarpras.db, 'K09', { nilai: 'tanpa_keaktifan' })).toThrow(/Bidang Kurikulum/)
    expect(tetapkanButirKurikulum(kur.db, 'K09', { nilai: 'tanpa_keaktifan' }).status).toBe('diajukan')
    expect(daftarButirKurikulum(kur.db).find((b) => b.kode === 'K09')!.diajukan).toBe(true)
    // GBMTPG Generus 2 & 3 diisi dari HP
    const gb = daftarButirKurikulum(kur.db).find((b) => b.kode === 'K11')!
    tetapkanButirKurikulum(kur.db, 'K11', { nilai: Object.fromEntries(gb.isian.map((i) => [i.kunci, 10])) })
    const r = setor(w, kur)
    expect(r.usulanOtomatis).toBe(2)
    expect(rumusTotal(w.admin.db)).toBe('tanpa_keaktifan')
    expect(ambilMateriEvaluasi(w.admin.db, idMateriEvaluasi('remaja', 'keilmuan'))!.target).toBe(10)
    expect(daftarButirKurikulum(w.admin.db).find((b) => b.kode === 'K11')).toMatchObject({ status: 'ditetapkan', penetapan: { oleh: 'Kurikulum HP' } })
    segarkan(w, kur)
    expect(daftarButirKurikulum(kur.db).find((b) => b.kode === 'K09')).toMatchObject({ status: 'ditetapkan', diajukan: false })
    // usulan tetapkan_kurikulum dari HP tanpa jabatan kurikulum: daerah tidak menyetujui (juga lewat menu Usulan)
    const m = await pengurus(w, 'PJ Remu', ['pj_kelompok'], w.kel['SRG-RMU'])
    // dirakit langsung (UI tidak menawarkannya)
    const { ajukanUsulan } = await import('../src/repo/usulan')
    ajukanUsulan(m.db, { jenis: 'tetapkan_kurikulum', kelompokId: w.kel['SRG-RMU']!.id, data: { kode: 'K09', nilai: 'rata_rata' } })
    const r2 = setor(w, m)
    expect(r2.ditolak.some((d) => /Bidang Kurikulum/.test(d.alasan))).toBe(true)
    const u = daftarUsulan(w.admin.db, { status: 'menunggu' }).find((x) => x.jenis === 'tetapkan_kurikulum')!
    expect(() => setujuiUsulan(w.admin.db, u.id)).toThrow(/Bidang Kurikulum/)
    expect(rumusTotal(w.admin.db)).toBe('tanpa_keaktifan')
    // raport: materi belum ditetapkan (hadits) tidak ikut TOTAL; keaktifan tidak ikut (rumus K09)
    const g = tambahGenerus(w.admin.db, { kelompokId: w.kel['SRG-RMU']!.id, nama: 'Santri', jenisKelamin: 'L', kategori: 'caberawit_c', mulai: '2026-07-01' })
    simpanEvaluasi(w.admin.db, { generusId: g.id, materiEvaluasiId: idMateriEvaluasi('caberawit_c', 'surat'), dikuasai: 45, periode: '2026-S1' })
    const rp = raporGenerus(w.admin.db, g.id, { periode: '2026-S1' })!
    expect(rp.belumDitetapkan).toEqual(['Makna Al-Hadits (9 kitab)'])
    expect(rp.rumusTotal).toBe('tanpa_keaktifan')
    // 100 ÷ (22 materi − keaktifan − hadits) = 100 ÷ 20 = 5
    expect(rp.total).toBe(5)
  })
})
