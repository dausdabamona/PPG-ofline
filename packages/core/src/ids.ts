// ULID (Crockford base32): 48 bit waktu (ms) + 80 bit acak, monoton dalam milidetik yang sama.
const ABJAD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

let waktuTerakhir = -1
let acakTerakhir: number[] = []

function acak80(): number[] {
  const b = new Uint8Array(10)
  globalThis.crypto.getRandomValues(b)
  // 16 karakter × 5 bit = 80 bit
  const hasil: number[] = []
  let buffer = 0
  let bit = 0
  for (const byte of b) {
    buffer = (buffer << 8) | byte
    bit += 8
    while (bit >= 5) {
      bit -= 5
      hasil.push((buffer >> bit) & 31)
    }
    buffer &= (1 << bit) - 1
  }
  return hasil
}

function naikkan(digit: number[]): number[] {
  const d = [...digit]
  for (let i = d.length - 1; i >= 0; i--) {
    if (d[i]! < 31) {
      d[i] = d[i]! + 1
      return d
    }
    d[i] = 0
  }
  return d
}

/** Buat ULID baru (26 karakter, urut menurut waktu). */
export function ulid(waktuMs: number = Date.now()): string {
  let acak: number[]
  if (waktuMs <= waktuTerakhir) {
    waktuMs = waktuTerakhir
    acak = naikkan(acakTerakhir)
  } else {
    acak = acak80()
  }
  waktuTerakhir = waktuMs
  acakTerakhir = acak
  let t = waktuMs
  let bagianWaktu = ''
  for (let i = 0; i < 10; i++) {
    bagianWaktu = ABJAD[t % 32]! + bagianWaktu
    t = Math.floor(t / 32)
  }
  return bagianWaktu + acak.map((x) => ABJAD[x]).join('')
}
