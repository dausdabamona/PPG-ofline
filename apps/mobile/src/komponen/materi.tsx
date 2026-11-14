// Pemilih materi (per bidang/kategori, dengan status) + isian kemajuan (status, nilai, level, catatan) + tampilan materi.
import { useMemo, useState } from 'react'
import { ambilMateri, dariB64url, materiGenerus, type MateriGenerus, type MateriGenerusPerBidang, type StatusKemajuan } from '@ppg/core'
import { useApp, useData } from '../konteks'
import { AreaTeks, Isian, KeadaanData, Lencana, Modal, Segmen, Tombol } from './ui'
import { label, LABEL_STATUS_MATERI, LABEL_TIPE_MATERI, WARNA_STATUS_MATERI } from '../utils/label'

export function cariMateri(d: MateriGenerusPerBidang | undefined, id: string): MateriGenerus | undefined {
  for (const b of d?.bidang ?? []) for (const k of b.kategori) for (const m of k.materi) if (m.id === id) return m
  return undefined
}

/** Select materi berkelompok bidang → kategori; target berikutnya ditandai ★. */
export function PemilihMateri(p: { data: MateriGenerusPerBidang; nilai: string; ubah: (id: string) => void; label?: string }) {
  return (
    <div className="kolom">
      <label htmlFor="pilih-materi">{p.label ?? 'Materi'}</label>
      <select id="pilih-materi" value={p.nilai} onChange={(e) => p.ubah(e.target.value)}>
        <option value="">Pilih materi…</option>
        {p.data.bidang.map((b) =>
          b.kategori.map((k) => (
            <optgroup key={k.id} label={`${b.nama} · ${k.nama}`}>
              {k.materi.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.target ? '★ ' : ''}
                  {m.nomor}. {m.nama}
                  {m.status !== 'belum' ? ` (${label(LABEL_STATUS_MATERI, m.status)})` : ''}
                </option>
              ))}
            </optgroup>
          )),
        )}
      </select>
    </div>
  )
}

export interface IsianKemajuan {
  status: StatusKemajuan
  nilai: string
  level: string
  catatan: string
}

export const KEMAJUAN_KOSONG: IsianKemajuan = { status: 'selesai', nilai: '', level: '', catatan: '' }

/** Ubah isian ke data core (nilai/level angka atau null). */
export function keDataKemajuan(materiId: string, i: IsianKemajuan) {
  return {
    materiId,
    status: i.status,
    nilai: i.nilai.trim() === '' ? null : Number(i.nilai),
    level: i.level === '' ? null : Number(i.level),
    catatan: i.catatan.trim() || null,
  }
}

export function FormKemajuan(p: { tipe: string | undefined; nilai: IsianKemajuan; ubah: (v: IsianKemajuan) => void; labelCatatan?: string }) {
  const i = p.nilai
  return (
    <>
      <Segmen
        label="Status belajar"
        nilai={i.status}
        ubah={(v) => p.ubah({ ...i, status: v })}
        pilihan={[
          { nilai: 'sedang', teks: 'Sedang belajar' },
          { nilai: 'selesai', teks: 'Sudah selesai' },
        ]}
      />
      {p.tipe === 'level' ? (
        <Segmen
          label="Tingkat"
          nilai={i.level || null}
          ubah={(v) => p.ubah({ ...i, level: v })}
          pilihan={['1', '2', '3', '4', '5'].map((n) => ({ nilai: n, teks: n }))}
        />
      ) : null}
      <Isian label="Nilai 0–100 (boleh kosong)" type="number" inputMode="numeric" min={0} max={100} nilai={i.nilai} ubah={(v) => p.ubah({ ...i, nilai: v })} />
      <AreaTeks label={p.labelCatatan ?? 'Catatan (boleh kosong)'} nilai={i.catatan} ubah={(v) => p.ubah({ ...i, catatan: v })} baris={2} />
    </>
  )
}

/** Hook materi seorang generus. */
export function useMateriGenerus(generusId: string | undefined) {
  const { db } = useApp()
  return useData(() => (generusId ? materiGenerus(db, generusId) : undefined), [generusId])
}

/** Daftar materi per bidang/kategori dengan status (Materiku & Kemajuan wali). */
export function DaftarMateri(p: { data: MateriGenerusPerBidang; buka?: (m: MateriGenerus) => void }) {
  const [hanyaTarget, setHanyaTarget] = useState(false)
  const target = useMemo(() => p.data.bidang.flatMap((b) => b.kategori.flatMap((k) => k.materi.filter((m) => m.target))), [p.data])
  const r = p.data.ringkasan
  return (
    <>
      <div className="kemajuan-ringkas">
        <div className="batang" role="progressbar" aria-valuenow={r.persen} aria-valuemin={0} aria-valuemax={100} aria-label="Materi selesai">
          <span style={{ width: `${Math.min(100, r.persen)}%` }} />
        </div>
        <p>
          <b>{r.selesai}</b> dari {r.total} materi selesai ({r.persen}%)
        </p>
      </div>
      {target.length ? (
        <section className="kartu kartu-target">
          <h2>★ Target berikutnya</h2>
          <ul className="daftar-materi">
            {target.map((m) => (
              <BarisMateri key={m.id} m={m} buka={p.buka} />
            ))}
          </ul>
        </section>
      ) : null}
      <label className="saklar">
        <input type="checkbox" checked={hanyaTarget} onChange={(e) => setHanyaTarget(e.target.checked)} /> Sembunyikan yang sudah selesai
      </label>
      {p.data.bidang.map((b) => (
        <details key={b.id} className="bidang">
          <summary>{b.nama}</summary>
          {b.kategori.map((k) => {
            const isi = hanyaTarget ? k.materi.filter((m) => m.status !== 'selesai') : k.materi
            if (!isi.length) return null
            const sel = k.materi.filter((m) => m.status === 'selesai').length
            return (
              <div key={k.id} className="kategori">
                <h3>
                  {k.nama} <small>{sel}/{k.materi.length}</small>
                </h3>
                <ul className="daftar-materi">
                  {isi.map((m) => (
                    <BarisMateri key={m.id} m={m} buka={p.buka} />
                  ))}
                </ul>
              </div>
            )
          })}
        </details>
      ))}
    </>
  )
}

function BarisMateri(p: { m: MateriGenerus; buka?: (m: MateriGenerus) => void }) {
  const m = p.m
  return (
    <li>
      <button type="button" onClick={() => p.buka?.(m)} disabled={!p.buka}>
        <span className="teks">
          <strong>
            {m.nomor}. {m.nama}
          </strong>
          <small>
            {m.kategori_nama}
            {m.isi_teks || m.ada_lampiran ? ' · ada bacaan' : ''}
          </small>
        </span>
        <Lencana warna={WARNA_STATUS_MATERI[m.status]}>{label(LABEL_STATUS_MATERI, m.status)}</Lencana>
      </button>
    </li>
  )
}

/** Lembar rincian materi: isi teks, PDF, catatan mubaligh, tombol catat. */
export function RincianMateri(p: { m: MateriGenerus; tutup: () => void; catat?: () => void }) {
  const { db, platform, toast } = useApp()
  const lengkap = useData(() => ambilMateri(db, p.m.id), [p.m.id])
  const k = p.m.kemajuan
  return (
    <Modal
      judul={p.m.nama}
      tutup={p.tutup}
      aksi={p.catat ? <Tombol onClick={p.catat}>Catat kemajuan</Tombol> : undefined}
    >
      <p>
        <Lencana warna={WARNA_STATUS_MATERI[p.m.status]}>{label(LABEL_STATUS_MATERI, p.m.status)}</Lencana>{' '}
        <small>
          {p.m.bidang_nama} · {p.m.kategori_nama} · {label(LABEL_TIPE_MATERI, p.m.tipe)}
        </small>
      </p>
      {k?.catatan_mubaligh ? (
        <p className="catatan-mubaligh">
          <b>Catatan mubaligh:</b> {k.catatan_mubaligh}
        </p>
      ) : null}
      <KeadaanData hasil={lengkap}>
        {(m) => (
          <>
            {m?.isi_teks ? <div className="isi-materi">{m.isi_teks}</div> : <p className="keterangan">Belum ada bacaan untuk materi ini.</p>}
            {m?.lampiran_pdf_b64 ? (
              <Tombol
                penuh
                varian="kedua"
                onClick={async () => {
                  try {
                    await platform.bukaPdf(m.lampiran_nama ?? `${m.nama}.pdf`, dariB64url(m.lampiran_pdf_b64!))
                  } catch (e) {
                    toast('galat', `PDF tidak bisa dibuka: ${String((e as Error).message ?? e)}`)
                  }
                }}
              >
                Buka PDF {m.lampiran_nama ? `(${m.lampiran_nama})` : ''}
              </Tombol>
            ) : null}
          </>
        )}
      </KeadaanData>
    </Modal>
  )
}
