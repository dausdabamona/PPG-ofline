// Pembungkus kriptografi: libsodium (Ed25519, X25519 sealed box, secretbox) + PBKDF2 (WebCrypto).
import sodium from 'libsodium-wrappers'
import { GalatPpg } from './galat'
import { sha256 } from './sha256'

/** Jumlah iterasi PBKDF2-SHA256 untuk kata sandi admin (T7). */
export const ITERASI_PBKDF2 = 210_000

let siap = false

/** Wajib dipanggil (await) sekali sebelum memakai fungsi kripto lain. Aman dipanggil berulang. */
export async function siapkanKripto(): Promise<void> {
  if (siap) return
  await sodium.ready
  siap = true
}

function pastikanSiap(): void {
  if (!siap) throw new GalatPpg('KRIPTO_BELUM_SIAP', 'Pustaka kripto belum disiapkan (panggil siapkanKripto).')
}

export interface PasanganKunci {
  publik: Uint8Array
  rahasia: Uint8Array
}

/** Buat pasangan kunci tanda tangan Ed25519. */
export function buatPasanganTandaTangan(): PasanganKunci {
  pastikanSiap()
  const k = sodium.crypto_sign_keypair()
  return { publik: k.publicKey, rahasia: k.privateKey }
}

/** Buat pasangan kunci kotak X25519. */
export function buatPasanganKotak(): PasanganKunci {
  pastikanSiap()
  const k = sodium.crypto_box_keypair()
  return { publik: k.publicKey, rahasia: k.privateKey }
}

/** Tanda tangan Ed25519 terpisah (64 byte). */
export function tandaTangani(pesan: Uint8Array, rahasia: Uint8Array): Uint8Array {
  pastikanSiap()
  return sodium.crypto_sign_detached(pesan, rahasia)
}

/** Periksa tanda tangan Ed25519 terpisah; tidak pernah melempar, mengembalikan boolean. */
export function periksaTandaTangan(pesan: Uint8Array, sig: Uint8Array, publik: Uint8Array): boolean {
  pastikanSiap()
  if (sig.length !== 64 || publik.length !== 32) return false
  try {
    return sodium.crypto_sign_verify_detached(sig, pesan, publik)
  } catch {
    return false
  }
}

/** Segel data untuk pemilik kunci publik X25519 (crypto_box_seal, pengirim anonim). */
export function segelKe(publikX25519: Uint8Array, data: Uint8Array): Uint8Array {
  pastikanSiap()
  return sodium.crypto_box_seal(data, publikX25519)
}

/** Buka data tersegel dengan pasangan kunci kotak; melempar TIDAK_BISA_DIBUKA bila gagal. */
export function bukaSegel(data: Uint8Array, pasangan: PasanganKunci): Uint8Array {
  pastikanSiap()
  try {
    return sodium.crypto_box_seal_open(data, pasangan.publik, pasangan.rahasia)
  } catch {
    throw new GalatPpg('TIDAK_BISA_DIBUKA', 'Data tidak bisa dibuka dengan kunci perangkat ini.')
  }
}

/** Enkripsi simetris secretbox; keluaran = nonce 24 byte | ciphertext. */
export function enkripsiRahasia(kunci32: Uint8Array, data: Uint8Array): Uint8Array {
  pastikanSiap()
  if (kunci32.length !== 32) throw new GalatPpg('KUNCI_TIDAK_SAH', 'Panjang kunci harus 32 byte.')
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const c = sodium.crypto_secretbox_easy(data, nonce, kunci32)
  const out = new Uint8Array(nonce.length + c.length)
  out.set(nonce, 0)
  out.set(c, nonce.length)
  return out
}

/** Dekripsi secretbox; melempar TIDAK_BISA_DIBUKA bila kunci salah/data rusak. */
export function dekripsiRahasia(kunci32: Uint8Array, data: Uint8Array): Uint8Array {
  pastikanSiap()
  const n = sodium.crypto_secretbox_NONCEBYTES
  if (kunci32.length !== 32 || data.length < n + sodium.crypto_secretbox_MACBYTES) {
    throw new GalatPpg('TIDAK_BISA_DIBUKA', 'Data terenkripsi rusak atau kunci tidak sah.')
  }
  try {
    return sodium.crypto_secretbox_open_easy(data.subarray(n), data.subarray(0, n), kunci32)
  } catch {
    throw new GalatPpg('TIDAK_BISA_DIBUKA', 'Data tidak bisa dibuka (kunci salah atau berkas rusak).')
  }
}

/** 32 byte acak kriptografis. */
export function kunciAcak32(): Uint8Array {
  return byteAcak(32)
}

/** n byte acak kriptografis (WebCrypto). */
export function byteAcak(n: number): Uint8Array {
  const b = new Uint8Array(n)
  globalThis.crypto.getRandomValues(b)
  return b
}

/** Turunkan kunci 32 byte dari kata sandi: PBKDF2-SHA256 (default 210.000 iterasi) via WebCrypto. */
export async function turunkanKunciSandi(
  sandi: string,
  garam: Uint8Array,
  iterasi: number = ITERASI_PBKDF2,
): Promise<Uint8Array> {
  const subtle = globalThis.crypto.subtle
  const bahan = await subtle.importKey('raw', keUtf8(sandi) as BufferSource, 'PBKDF2', false, ['deriveBits'])
  const bit = await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: garam as BufferSource, iterations: iterasi },
    bahan,
    256,
  )
  return new Uint8Array(bit)
}

/** SHA-256 dalam heksadesimal (sinkron). */
export function sha256Hex(data: Uint8Array | string): string {
  const b = typeof data === 'string' ? keUtf8(data) : data
  return keHex(sha256(b))
}

/** Perbandingan byte waktu-tetap. */
export function samaByte(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a[i]! ^ b[i]!
  return d === 0
}

// ---------- pengodean ----------

const enc = new TextEncoder()
const dec = new TextDecoder('utf-8', { fatal: true })

/** Teks → UTF-8. */
export function keUtf8(teks: string): Uint8Array {
  return enc.encode(teks)
}

/** UTF-8 → teks (melempar bila tidak sah). */
export function dariUtf8(b: Uint8Array): string {
  return dec.decode(b)
}

/** Byte → heksadesimal kecil. */
export function keHex(b: Uint8Array): string {
  let s = ''
  for (const x of b) s += x.toString(16).padStart(2, '0')
  return s
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const B64_BALIK = new Int16Array(128).fill(-1)
for (let i = 0; i < B64.length; i++) B64_BALIK[B64.charCodeAt(i)] = i
// terima juga alfabet base64 standar
B64_BALIK['+'.charCodeAt(0)] = 62
B64_BALIK['/'.charCodeAt(0)] = 63

/** Byte → base64url tanpa padding. */
export function keB64url(b: Uint8Array): string {
  let s = ''
  let i = 0
  for (; i + 2 < b.length; i += 3) {
    const n = (b[i]! << 16) | (b[i + 1]! << 8) | b[i + 2]!
    s += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]! + B64[n & 63]!
  }
  const sisa = b.length - i
  if (sisa === 1) {
    const n = b[i]! << 16
    s += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!
  } else if (sisa === 2) {
    const n = (b[i]! << 16) | (b[i + 1]! << 8)
    s += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]!
  }
  return s
}

/** base64url (atau base64 standar, padding opsional) → byte; melempar B64_TIDAK_SAH. */
export function dariB64url(s: string): Uint8Array {
  const t = s.replace(/=+$/, '')
  if (t.length % 4 === 1) throw new GalatPpg('B64_TIDAK_SAH', 'Teks base64 tidak sah.')
  const out = new Uint8Array(Math.floor((t.length * 3) / 4))
  let buf = 0
  let bit = 0
  let j = 0
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i)
    const v = c < 128 ? B64_BALIK[c]! : -1
    if (v < 0) throw new GalatPpg('B64_TIDAK_SAH', 'Teks base64 tidak sah.')
    buf = (buf << 6) | v
    bit += 6
    if (bit >= 8) {
      bit -= 8
      out[j++] = (buf >> bit) & 0xff
    }
    buf &= (1 << bit) - 1
  }
  return out
}
