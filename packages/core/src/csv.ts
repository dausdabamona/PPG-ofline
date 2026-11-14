// Pengurai & penyusun CSV sederhana (RFC 4180; pemisah koma atau titik koma terdeteksi otomatis).

/** Urai teks CSV menjadi baris-baris sel. Mendukung tanda kutip ganda, "" di dalam kutip, CRLF, BOM. */
export function uraiCsv(teks: string, pemisah?: ',' | ';' | '\t'): string[][] {
  let t = teks.replace(/^﻿/, '')
  if (!pemisah) {
    const barisPertama = t.split(/\r?\n/, 1)[0] ?? ''
    const hitung = (c: string) => barisPertama.split(c).length - 1
    pemisah = hitung(';') > hitung(',') ? ';' : hitung('\t') > hitung(',') ? '\t' : ','
  }
  const baris: string[][] = []
  let sel = ''
  let kini: string[] = []
  let dalamKutip = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!
    if (dalamKutip) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          sel += '"'
          i++
        } else dalamKutip = false
      } else sel += c
    } else if (c === '"' && sel === '') {
      dalamKutip = true
    } else if (c === pemisah) {
      kini.push(sel)
      sel = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      kini.push(sel)
      baris.push(kini)
      kini = []
      sel = ''
    } else sel += c
  }
  if (sel !== '' || kini.length > 0) {
    kini.push(sel)
    baris.push(kini)
  }
  return baris.filter((b) => b.some((x) => x.trim() !== ''))
}

/** Urai CSV berkepala menjadi objek per baris (nama kolom huruf kecil, spasi → _). */
export function uraiCsvObjek(teks: string): { kolom: string[]; baris: Record<string, string>[] } {
  const semua = uraiCsv(teks)
  if (semua.length === 0) return { kolom: [], baris: [] }
  const kolom = semua[0]!.map((k) => k.trim().toLowerCase().replace(/\s+/g, '_'))
  const baris = semua.slice(1).map((b) => {
    const o: Record<string, string> = {}
    kolom.forEach((k, i) => (o[k] = (b[i] ?? '').trim()))
    return o
  })
  return { kolom, baris }
}

function selCsv(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",;\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Susun CSV dari kolom dan baris objek. */
export function buatCsv(kolom: string[], baris: Record<string, unknown>[], pemisah: ',' | ';' = ','): string {
  const out = [kolom.map(selCsv).join(pemisah)]
  for (const b of baris) out.push(kolom.map((k) => selCsv(b[k])).join(pemisah))
  return out.join('\r\n') + '\r\n'
}
