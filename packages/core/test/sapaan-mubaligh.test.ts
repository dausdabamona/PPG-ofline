import { describe, expect, it } from 'vitest'
import { namaMubalighSampul } from '../src'

describe('namaMubalighSampul', () => {
  it('menambah "Ust." pada nama tanpa sapaan', () => {
    expect(namaMubalighSampul('Abdullah')).toBe('Ust. Abdullah')
  })
  it('tidak menggandakan sapaan yang sudah ada', () => {
    expect(namaMubalighSampul('Ust. Abdullah')).toBe('Ust. Abdullah')
    expect(namaMubalighSampul('Ustadz Abdullah')).toBe('Ustadz Abdullah')
    expect(namaMubalighSampul('ust.Abdullah')).toBe('ust.Abdullah')
  })
  it('nama yang kebetulan berawalan "Ust" tidak dianggap sapaan', () => {
    expect(namaMubalighSampul('Ustman')).toBe('Ust. Ustman')
  })
  it('kosong menjadi garis isian', () => {
    expect(namaMubalighSampul(null)).toBe('Ust. .......................................')
  })
})
