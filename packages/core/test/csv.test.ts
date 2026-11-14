import { describe, expect, it } from 'vitest'
import { buatCsv, uraiCsv, uraiCsvObjek } from '../src/index'

describe('csv', () => {
  it('kutip, koma di dalam sel, kutip ganda, CRLF, BOM, baris kosong', () => {
    const t = '﻿a,b,c\r\n"x, y","he said ""hi""",3\r\n\r\n4,,\n'
    expect(uraiCsv(t)).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'he said "hi"', '3'],
      ['4', '', ''],
    ])
  })
  it('deteksi pemisah titik koma (Excel Indonesia) & baris multi-garis', () => {
    expect(uraiCsv('nama;umur\n"Ali\nBin";7')).toEqual([
      ['nama', 'umur'],
      ['Ali\nBin', '7'],
    ])
    expect(uraiCsv('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
  it('objek berkepala & penyusunan bolak-balik', () => {
    const { kolom, baris } = uraiCsvObjek('Nama Lengkap,Kelompok Kode\nAli , K1\nBudi')
    expect(kolom).toEqual(['nama_lengkap', 'kelompok_kode'])
    expect(baris).toEqual([
      { nama_lengkap: 'Ali', kelompok_kode: 'K1' },
      { nama_lengkap: 'Budi', kelompok_kode: '' },
    ])
    const teks = buatCsv(['a', 'b'], [{ a: 'x,y', b: null }, { a: 'k"q', b: 2 }])
    expect(uraiCsvObjek(teks).baris).toEqual([
      { a: 'x,y', b: '' },
      { a: 'k"q', b: '2' },
    ])
    expect(uraiCsvObjek('').kolom).toEqual([])
    expect(buatCsv(['a'], [{ a: 'x' }], ';')).toBe('a\r\nx\r\n')
  })
})
