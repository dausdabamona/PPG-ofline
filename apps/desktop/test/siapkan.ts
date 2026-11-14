// Persiapan uji renderer (jsdom).
// Lingkungan jsdom vitest mengganti Uint8Array/ArrayBuffer global dengan milik jendela jsdom, sedangkan libsodium
// (dimuat Node) memeriksa `instanceof` terhadap konstruktor asli → "unsupported input type". Di peramban/Electron
// hanya ada satu realm, jadi di uji konstruktor asli Node dipasang kembali.
import { Buffer } from 'node:buffer'
import { TextDecoder as TD, TextEncoder as TE } from 'node:util'

function pasang(nama: string, nilai: unknown): void {
  Object.defineProperty(globalThis, nama, { value: nilai, writable: true, configurable: true, enumerable: false })
}
pasang('Uint8Array', Object.getPrototypeOf(Buffer.prototype).constructor)
pasang('ArrayBuffer', Buffer.alloc(1).buffer.constructor)
pasang('TextEncoder', TE)
pasang('TextDecoder', TD)
