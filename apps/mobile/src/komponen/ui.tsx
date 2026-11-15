// Komponen dasar antarmuka HP: tombol besar, isian, lembar bawah (modal), keadaan data, kartu, lencana, spanduk.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

type Varian = 'utama' | 'kedua' | 'bahaya' | 'tipis' | 'wa'

export function Tombol(p: {
  children: ReactNode
  onClick?: () => unknown | Promise<unknown>
  varian?: Varian
  type?: 'button' | 'submit'
  disabled?: boolean
  penuh?: boolean
  kecil?: boolean
  label?: string
}) {
  const [sibuk, setSibuk] = useState(false)
  return (
    <button
      type={p.type ?? 'button'}
      className={`tombol tombol-${p.varian ?? 'utama'}${p.penuh ? ' tombol-penuh' : ''}${p.kecil ? ' tombol-kecil' : ''}`}
      disabled={p.disabled || sibuk}
      aria-busy={sibuk || undefined}
      aria-label={p.label}
      onClick={async () => {
        if (!p.onClick) return
        const r = p.onClick()
        if (r && typeof (r as Promise<unknown>).then === 'function') {
          setSibuk(true)
          try {
            await r
          } finally {
            setSibuk(false)
          }
        }
      }}
    >
      {sibuk ? <span className="putar" aria-hidden="true" /> : null}
      {p.children}
    </button>
  )
}

export function Kolom(p: { label: string; children: (id: string) => ReactNode; bantuan?: string }) {
  const id = useId()
  return (
    <div className="kolom">
      <label htmlFor={id}>{p.label}</label>
      {p.children(id)}
      {p.bantuan ? <small className="bantuan">{p.bantuan}</small> : null}
    </div>
  )
}

export function Isian(p: {
  label: string
  nilai: string
  ubah: (v: string) => void
  type?: string
  placeholder?: string
  bantuan?: string
  inputMode?: 'numeric' | 'text' | 'tel'
  maxLength?: number
  min?: number
  max?: number
}) {
  return (
    <Kolom label={p.label} bantuan={p.bantuan}>
      {(id) => (
        <input
          id={id}
          type={p.type ?? 'text'}
          value={p.nilai}
          placeholder={p.placeholder}
          inputMode={p.inputMode}
          maxLength={p.maxLength}
          min={p.min}
          max={p.max}
          onChange={(e) => p.ubah(e.target.value)}
        />
      )}
    </Kolom>
  )
}

export function Pilihan(p: {
  label: string
  nilai: string
  ubah: (v: string) => void
  pilihan: { nilai: string; teks: string }[]
  kosong?: string
  bantuan?: string
}) {
  return (
    <Kolom label={p.label} bantuan={p.bantuan}>
      {(id) => (
        <select id={id} value={p.nilai} onChange={(e) => p.ubah(e.target.value)}>
          {p.kosong !== undefined ? <option value="">{p.kosong}</option> : null}
          {p.pilihan.map((o) => (
            <option key={o.nilai} value={o.nilai}>
              {o.teks}
            </option>
          ))}
        </select>
      )}
    </Kolom>
  )
}

export function AreaTeks(p: { label: string; nilai: string; ubah: (v: string) => void; baris?: number; placeholder?: string; bantuan?: string; hanyaBaca?: boolean }) {
  return (
    <Kolom label={p.label} bantuan={p.bantuan}>
      {(id) => (
        <textarea
          id={id}
          rows={p.baris ?? 3}
          value={p.nilai}
          readOnly={p.hanyaBaca}
          placeholder={p.placeholder}
          onChange={(e) => p.ubah(e.target.value)}
        />
      )}
    </Kolom>
  )
}

/** Pilihan tombol besar (segmen), mis. Hadir/Izin/Sakit/Alpa. */
export function Segmen<T extends string>(p: { label: string; nilai: T | null; ubah: (v: T) => void; pilihan: { nilai: T; teks: string }[]; kecil?: boolean }) {
  return (
    <div className={`segmen${p.kecil ? ' segmen-kecil' : ''}`} role="radiogroup" aria-label={p.label}>
      {p.pilihan.map((o) => (
        <button
          key={o.nilai}
          type="button"
          role="radio"
          aria-checked={p.nilai === o.nilai}
          className={`segmen-${o.nilai}${p.nilai === o.nilai ? ' terpilih' : ''}`}
          onClick={() => p.ubah(o.nilai)}
        >
          {o.teks}
        </button>
      ))}
    </div>
  )
}

/** Lembar bawah (modal) untuk HP. */
export function Modal(p: { judul: string; tutup: () => void; children: ReactNode; aksi?: ReactNode }) {
  const tutupRef = useRef(p.tutup)
  tutupRef.current = p.tutup
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tutupRef.current()
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])
  return (
    <div className="latar-modal" onMouseDown={(e) => e.target === e.currentTarget && p.tutup()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={p.judul}>
        <header className="modal-kepala">
          <h2>{p.judul}</h2>
          <button type="button" className="tutup-modal" aria-label="Tutup" onClick={p.tutup}>
            ×
          </button>
        </header>
        <div className="modal-isi">{p.children}</div>
        {p.aksi ? <footer className="modal-kaki">{p.aksi}</footer> : null}
      </div>
    </div>
  )
}

export function Konfirmasi(p: { judul: string; pesan: ReactNode; ya: string; bahaya?: boolean; setuju: () => unknown; batal: () => void }) {
  return (
    <Modal
      judul={p.judul}
      tutup={p.batal}
      aksi={
        <>
          <Tombol varian="kedua" onClick={p.batal}>
            Batal
          </Tombol>
          <Tombol varian={p.bahaya ? 'bahaya' : 'utama'} onClick={p.setuju}>
            {p.ya}
          </Tombol>
        </>
      }
    >
      <p>{p.pesan}</p>
    </Modal>
  )
}

export function Memuat(p: { teks?: string }) {
  return (
    <div className="keadaan keadaan-memuat" role="status">
      <span className="putar" aria-hidden="true" /> {p.teks ?? 'Sebentar…'}
    </div>
  )
}

export function Kosong(p: { teks: string; children?: ReactNode }) {
  return (
    <div className="keadaan keadaan-kosong">
      <p>{p.teks}</p>
      {p.children}
    </div>
  )
}

export function KotakGalat(p: { pesan: string }) {
  return (
    <div className="keadaan keadaan-galat" role="alert">
      <strong>Ada masalah:</strong> {p.pesan}
    </div>
  )
}

/** Tampilkan galat / kosong / isi sesuai hasil pemuatan data. */
export function KeadaanData<T>(p: {
  hasil: { data?: T; galat?: string }
  kosong?: (d: T) => boolean
  teksKosong?: string
  children: (d: T) => ReactNode
}) {
  if (p.hasil.galat) return <KotakGalat pesan={p.hasil.galat} />
  if (p.hasil.data === undefined) return <Memuat />
  if (p.kosong?.(p.hasil.data)) return <Kosong teks={p.teksKosong ?? 'Belum ada data.'} />
  return <>{p.children(p.hasil.data)}</>
}

export function Kartu(p: { judul?: string; children: ReactNode; aksi?: ReactNode; kelas?: string }) {
  return (
    <section className={`kartu${p.kelas ? ` ${p.kelas}` : ''}`}>
      {p.judul || p.aksi ? (
        <header className="kartu-kepala">
          {p.judul ? <h2>{p.judul}</h2> : <span />}
          {p.aksi ? <div className="aksi">{p.aksi}</div> : null}
        </header>
      ) : null}
      {p.children}
    </section>
  )
}

export type WarnaLencana = 'hijau' | 'merah' | 'kuning' | 'abu' | 'teal'
export function Lencana(p: { children: ReactNode; warna?: WarnaLencana }) {
  return <span className={`lencana lencana-${p.warna ?? 'abu'}`}>{p.children}</span>
}

export function JudulHalaman(p: { judul: string; keterangan?: string; kembali?: () => void }) {
  return (
    <header className="judul-halaman">
      {p.kembali ? (
        <button type="button" className="tombol-kembali" aria-label="Kembali" onClick={p.kembali}>
          ‹
        </button>
      ) : null}
      <div>
        <h1>{p.judul}</h1>
        {p.keterangan ? <p className="keterangan">{p.keterangan}</p> : null}
      </div>
    </header>
  )
}

export function Spanduk(p: { jenis: 'info' | 'peringatan' | 'bahaya'; children: ReactNode }) {
  return (
    <div className={`spanduk spanduk-${p.jenis}`} role={p.jenis === 'bahaya' ? 'alert' : 'status'}>
      {p.children}
    </div>
  )
}

/** Angka ringkasan besar. */
export function Angka(p: { nilai: number | string; teks: string; warna?: WarnaLencana }) {
  return (
    <div className={`angka angka-${p.warna ?? 'teal'}`}>
      <strong>{p.nilai}</strong>
      <span>{p.teks}</span>
    </div>
  )
}

/** Daftar menu tombol besar. */
export function MenuDaftar(p: { item: { teks: string; ket?: string; ikon?: string; buka: () => void }[] }) {
  return (
    <ul className="menu-daftar">
      {p.item.map((i) => (
        <li key={i.teks}>
          <button type="button" onClick={i.buka}>
            {i.ikon ? <span className="ikon" aria-hidden="true">{i.ikon}</span> : null}
            <span className="teks">
              <strong>{i.teks}</strong>
              {i.ket ? <small>{i.ket}</small> : null}
            </span>
            <span aria-hidden="true">›</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Bilah persentase capaian (mis. materi tuntas). */
export function BilahPersen(p: { persen: number; label: string; kecil?: boolean }) {
  const n = Math.max(0, Math.min(100, p.persen))
  return (
    <div
      className={`bilah-persen${p.kecil ? ' bilah-kecil' : ''}`}
      role="progressbar"
      aria-label={p.label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(n)}
    >
      <span style={{ width: `${n}%` }} />
    </div>
  )
}
