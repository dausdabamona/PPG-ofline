// Komponen dasar antarmuka: tombol, kolom isian, modal, keadaan data (memuat/kosong/galat), tabel.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

type Varian = 'utama' | 'kedua' | 'bahaya' | 'tipis'

export function Tombol(p: {
  children: ReactNode
  onClick?: () => unknown | Promise<unknown>
  varian?: Varian
  type?: 'button' | 'submit'
  disabled?: boolean
  sibuk?: boolean
  judul?: string
  kecil?: boolean
}) {
  const [sibukLokal, setSibuk] = useState(false)
  const sibuk = p.sibuk || sibukLokal
  return (
    <button
      type={p.type ?? 'button'}
      className={`tombol tombol-${p.varian ?? 'utama'}${p.kecil ? ' tombol-kecil' : ''}`}
      disabled={p.disabled || sibuk}
      aria-busy={sibuk || undefined}
      title={p.judul}
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

export function Kolom(p: { label: string; children: (id: string) => ReactNode; bantuan?: string; lebar?: boolean }) {
  const id = useId()
  return (
    <div className={`kolom${p.lebar ? ' kolom-lebar' : ''}`}>
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
  wajib?: boolean
  placeholder?: string
  bantuan?: string
  lebar?: boolean
  min?: number
  max?: number
}) {
  return (
    <Kolom label={p.label} bantuan={p.bantuan} lebar={p.lebar}>
      {(id) => (
        <input
          id={id}
          type={p.type ?? 'text'}
          value={p.nilai}
          required={p.wajib}
          placeholder={p.placeholder}
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
  lebar?: boolean
}) {
  return (
    <Kolom label={p.label} bantuan={p.bantuan} lebar={p.lebar}>
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
    <Kolom label={p.label} bantuan={p.bantuan} lebar>
      {(id) => (
        <textarea
          id={id}
          rows={p.baris ?? 4}
          value={p.nilai}
          readOnly={p.hanyaBaca}
          placeholder={p.placeholder}
          onChange={(e) => p.ubah(e.target.value)}
        />
      )}
    </Kolom>
  )
}

export function Modal(p: { judul: string; tutup: () => void; children: ReactNode; aksi?: ReactNode; lebar?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const tutupRef = useRef(p.tutup)
  tutupRef.current = p.tutup
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tutupRef.current()
    }
    window.addEventListener('keydown', f)
    ref.current?.querySelector<HTMLElement>('.modal-isi input, .modal-isi select, .modal-isi textarea')?.focus()
    return () => window.removeEventListener('keydown', f)
  }, [])
  return (
    <div className="latar-modal" onMouseDown={(e) => e.target === e.currentTarget && p.tutup()}>
      <div className={`modal${p.lebar ? ' modal-lebar' : ''}`} role="dialog" aria-modal="true" aria-label={p.judul} ref={ref}>
        <header className="modal-kepala">
          <h2>{p.judul}</h2>
          <button type="button" className="tutup-modal" aria-label="Tutup jendela" onClick={p.tutup}>
            ×
          </button>
        </header>
        <div className="modal-isi">{p.children}</div>
        {p.aksi ? <footer className="modal-kaki">{p.aksi}</footer> : null}
      </div>
    </div>
  )
}

/** Dialog konfirmasi sederhana. */
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
      <span className="putar" aria-hidden="true" /> {p.teks ?? 'Memuat…'}
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
      <strong>Terjadi galat:</strong> {p.pesan}
    </div>
  )
}

/** Tampilkan galat / kosong / isi sesuai hasil pemuatan data. */
export function KeadaanData<T>(p: {
  hasil: { data?: T; galat?: string; memuat?: boolean }
  kosong?: (d: T) => boolean
  teksKosong?: string
  children: (d: T) => ReactNode
}) {
  if (p.hasil.memuat) return <Memuat />
  if (p.hasil.galat) return <KotakGalat pesan={p.hasil.galat} />
  if (p.hasil.data === undefined) return <Memuat />
  if (p.kosong?.(p.hasil.data)) return <Kosong teks={p.teksKosong ?? 'Belum ada data.'} />
  return <>{p.children(p.hasil.data)}</>
}

export function Kartu(p: { judul?: string; children: ReactNode; aksi?: ReactNode }) {
  return (
    <section className="kartu">
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

export function Lencana(p: { children: ReactNode; warna?: 'hijau' | 'merah' | 'kuning' | 'abu' | 'teal' }) {
  return <span className={`lencana lencana-${p.warna ?? 'abu'}`}>{p.children}</span>
}

export function KepalaHalaman(p: { judul: string; keterangan?: string; aksi?: ReactNode }) {
  return (
    <header className="kepala-halaman">
      <div>
        <h1>{p.judul}</h1>
        {p.keterangan ? <p className="keterangan">{p.keterangan}</p> : null}
      </div>
      {p.aksi ? <div className="aksi">{p.aksi}</div> : null}
    </header>
  )
}
