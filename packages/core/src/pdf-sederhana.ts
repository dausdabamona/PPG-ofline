// §19 (Fase 13) — penulis PDF sederhana (tanpa pustaka luar, berjalan offline di HP & EXE): halaman, teks Helvetica /
// Helvetica-Bold (WinAnsi), garis, kotak, dan lintasan Bezier. Cukup untuk raport & lembar resmi; satuan = poin (1/72 inci).
import { zlibSync } from 'fflate'

const LEBAR_HELV: number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667,
  611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833,
  556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
]
const LEBAR_HELV_TEBAL: number[] = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667,
  611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889,
  611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
]

/** Karakter Unicode → kode WinAnsi (yang di luar ASCII dan sering dipakai). */
const WIN_ANSI: Record<string, number> = { '–': 0x96, '—': 0x97, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '…': 0x85, '·': 0xb7, '×': 0xd7, '÷': 0xf7, 'é': 0xe9, '°': 0xb0 }

function kodeWinAnsi(c: string): number {
  const n = c.charCodeAt(0)
  if (n >= 32 && n <= 126) return n
  return WIN_ANSI[c] ?? 63 // '?'
}

export type Huruf = 'biasa' | 'tebal'
export type Warna = readonly [number, number, number]

/** Lebar teks dalam poin. */
export function lebarTeks(teks: string, ukuran: number, huruf: Huruf = 'biasa'): number {
  const tabel = huruf === 'tebal' ? LEBAR_HELV_TEBAL : LEBAR_HELV
  let w = 0
  for (const c of teks) {
    const k = kodeWinAnsi(c)
    w += k >= 32 && k <= 126 ? tabel[k - 32]! : k === 0xb7 || k === 0x95 ? 278 : 556
  }
  return (w * ukuran) / 1000
}

/** Pecah teks menjadi baris-baris yang muat dalam `lebar`. */
export function bungkusTeks(teks: string, ukuran: number, lebar: number, huruf: Huruf = 'biasa'): string[] {
  const hasil: string[] = []
  for (const paragraf of teks.split('\n')) {
    let baris = ''
    for (const kata of paragraf.split(/\s+/).filter(Boolean)) {
      const coba = baris ? `${baris} ${kata}` : kata
      if (lebarTeks(coba, ukuran, huruf) <= lebar || !baris) baris = coba
      else {
        hasil.push(baris)
        baris = kata
      }
    }
    hasil.push(baris)
  }
  return hasil
}

function escPdf(teks: string): string {
  let s = ''
  for (const c of teks) {
    const k = kodeWinAnsi(c)
    if (k === 40 || k === 41 || k === 92) s += `\\${c}`
    else if (k > 126) s += `\\${k.toString(8).padStart(3, '0')}`
    else s += String.fromCharCode(k)
  }
  return s
}

const f = (n: number) => (Math.round(n * 100) / 100).toString()
const warna = (w: Warna) => w.map((x) => f(x / 255)).join(' ')

/** Satu halaman PDF; koordinat asal di kiri-atas (y ke bawah) agar mudah ditata. */
export class HalamanPdf {
  readonly ops: string[] = []
  constructor(
    readonly lebar: number,
    readonly tinggi: number,
  ) {}

  private y(y: number): number {
    return this.tinggi - y
  }

  teks(x: number, y: number, isi: string, o: { ukuran?: number; huruf?: Huruf; warna?: Warna; rata?: 'kiri' | 'tengah' | 'kanan' } = {}): void {
    const u = o.ukuran ?? 10
    const h = o.huruf ?? 'biasa'
    const w = lebarTeks(isi, u, h)
    const x0 = o.rata === 'tengah' ? x - w / 2 : o.rata === 'kanan' ? x - w : x
    this.ops.push(`BT ${warna(o.warna ?? [0, 0, 0])} rg /${h === 'tebal' ? 'F2' : 'F1'} ${f(u)} Tf ${f(x0)} ${f(this.y(y))} Td (${escPdf(isi)}) Tj ET`)
  }

  garis(x1: number, y1: number, x2: number, y2: number, o: { tebal?: number; warna?: Warna; putus?: boolean } = {}): void {
    this.ops.push(`${f(o.tebal ?? 0.6)} w ${warna(o.warna ?? [0, 0, 0])} RG ${o.putus ? '[2 2] 0 d' : '[] 0 d'} ${f(x1)} ${f(this.y(y1))} m ${f(x2)} ${f(this.y(y2))} l S`)
  }

  kotak(x: number, y: number, l: number, t: number, o: { isi?: Warna; garis?: Warna | null; tebal?: number } = {}): void {
    const r = `${f(x)} ${f(this.y(y + t))} ${f(l)} ${f(t)} re`
    if (o.isi && o.garis !== null) this.ops.push(`${f(o.tebal ?? 0.6)} w ${warna(o.isi)} rg ${warna(o.garis ?? [0, 0, 0])} RG [] 0 d ${r} B`)
    else if (o.isi) this.ops.push(`${warna(o.isi)} rg ${r} f`)
    else this.ops.push(`${f(o.tebal ?? 0.6)} w ${warna(o.garis ?? [0, 0, 0])} RG [] 0 d ${r} S`)
  }

  /**
   * Lintasan SVG sederhana (M, L, C, Z — koordinat mutlak, dipisah spasi/koma) diskalakan `skala` dan digeser ke (x, y),
   * diisi warna. Dipakai menggambar logo aplikasi.
   */
  lintasan(d: string, x: number, y: number, skala: number, o: { isi?: Warna; garis?: Warna; tebal?: number }): void {
    const tok = d.match(/[MLCZ]|-?\d*\.?\d+/gi) ?? []
    const out: string[] = []
    let i = 0
    let cmd = ''
    const ambil = () => {
      const px = x + Number(tok[i++]) * skala
      const py = this.y(y + Number(tok[i++]) * skala)
      return `${f(px)} ${f(py)}`
    }
    while (i < tok.length) {
      const t = tok[i]!
      if (/[MLCZ]/i.test(t)) {
        cmd = t.toUpperCase()
        i++
        if (cmd === 'Z') out.push('h')
        continue
      }
      if (cmd === 'M') {
        out.push(`${ambil()} m`)
        cmd = 'L'
      } else if (cmd === 'L') out.push(`${ambil()} l`)
      else if (cmd === 'C') out.push(`${ambil()} ${ambil()} ${ambil()} c`)
      else i++
    }
    const isi = o.isi ? `${warna(o.isi)} rg ` : ''
    const gr = o.garis ? `${f(o.tebal ?? 1)} w ${warna(o.garis)} RG 1 J [] 0 d ` : ''
    this.ops.push(`${isi}${gr}${out.join(' ')} ${o.isi && o.garis ? 'B' : o.isi ? 'f' : 'S'}`)
  }
}

/** Dokumen PDF: kumpulan halaman → bytes. */
export class DokumenPdf {
  readonly halaman: HalamanPdf[] = []
  constructor(readonly judul = 'Dokumen PPG') {}

  /** Halaman baru; bawaan A4 tegak (595 × 842 pt). */
  tambahHalaman(lanskap = false): HalamanPdf {
    const h = lanskap ? new HalamanPdf(842, 595) : new HalamanPdf(595, 842)
    this.halaman.push(h)
    return h
  }

  bytes(): Uint8Array {
    const enc = new TextEncoder()
    const potongan: Uint8Array[] = []
    const offset: number[] = []
    let panjang = 0
    const tulis = (b: Uint8Array | string) => {
      const u = typeof b === 'string' ? enc.encode(b) : b
      potongan.push(u)
      panjang += u.length
    }
    tulis('%PDF-1.4\n')
    const n = this.halaman.length
    // nomor objek: 1 katalog, 2 pages, 3 F1, 4 F2, 5 info, lalu per halaman: halaman, isi
    const objek = (no: number, isi: string | Uint8Array[]) => {
      offset[no] = panjang
      tulis(`${no} 0 obj\n`)
      if (typeof isi === 'string') tulis(isi)
      else for (const b of isi) tulis(b)
      tulis('\nendobj\n')
    }
    const kids = Array.from({ length: n }, (_, i) => `${6 + i * 2} 0 R`).join(' ')
    objek(1, '<< /Type /Catalog /Pages 2 0 R >>')
    objek(2, `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`)
    objek(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
    objek(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
    objek(5, `<< /Title (${escPdf(this.judul)}) /Producer (PPG Sorong) >>`)
    this.halaman.forEach((h, i) => {
      const noH = 6 + i * 2
      objek(noH, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${h.lebar} ${h.tinggi}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${noH + 1} 0 R >>`)
      const isi = zlibSync(enc.encode(h.ops.join('\n')))
      objek(noH + 1, [enc.encode(`<< /Length ${isi.length} /Filter /FlateDecode >>\nstream\n`), isi, enc.encode('\nendstream')])
    })
    const total = 6 + n * 2
    const xref = panjang
    let x = `xref\n0 ${total}\n0000000000 65535 f \n`
    for (let i = 1; i < total; i++) x += `${String(offset[i]).padStart(10, '0')} 00000 n \n`
    tulis(x)
    tulis(`trailer\n<< /Size ${total} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
    const out = new Uint8Array(panjang)
    let p = 0
    for (const b of potongan) {
      out.set(b, p)
      p += b.length
    }
    return out
  }
}
