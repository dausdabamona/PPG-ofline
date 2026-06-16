# PPG — Pembinaan Generasi Penerus (Web/Android)

Aplikasi **offline-first** untuk mubaligh: mengelola data **jamaah, presensi,
penilaian, dan hafalan**, dengan data terpusat di tingkat daerah.

> Catatan: dokumen ini adalah panduan arsitektur untuk Claude Code & developer.
> Skema database (lihat P0.2) adalah **kontrak** semua modul — jangan diubah
> tanpa koordinasi.

## Stack (dikunci)

| Lapisan                  | Teknologi                                          |
| ------------------------ | -------------------------------------------------- |
| Frontend                 | React 19 + Vite + TypeScript + Tailwind (v4)       |
| Database lokal (offline) | Dexie.js (IndexedDB)                               |
| Backend / pusat          | Supabase (PostgreSQL + Auth + Storage + RLS)       |
| Sinkronisasi             | Custom sync engine (push/pull, Last-Write-Wins)    |
| Rilis Android            | Capacitor (APK)                                    |

## Keputusan arsitektur

- **Offline-first.** Semua operasi UI berjalan di atas IndexedDB (Dexie).
  Supabase hanya dipakai saat sinkronisasi, bukan pada setiap interaksi.
- **Sinkronisasi LWW (Last-Write-Wins).** Konflik antar perangkat diselesaikan
  berdasarkan timestamp `updated_at` terbaru. Setiap entitas membawa metadata
  sinkronisasi (mis. `updated_at`, penanda dirty/terkirim).
- **Data terpusat per daerah.** Server Supabase menjadi sumber kebenaran
  terpusat; tiap mubaligh menyinkronkan datanya ke pusat daerah.
- **Target perangkat: Android low-end (Sorong).** Mobile-first, hemat memori &
  data, harus tetap berfungsi tanpa koneksi internet.
- **RLS aktif.** Akses data dibatasi per pengguna/daerah melalui Row Level
  Security di Supabase (ikuti pola supabase-operations).

## Konvensi

- **Bahasa Indonesia** untuk UI, komentar, dan pesan error yang dilihat
  pengguna.
- **Mobile-first** di setiap komponen Tailwind.
- Penamaan & pola error mengikuti konvensi `firdaus-dev`.
- Operasi Supabase (CRUD, Auth, Storage, Realtime, RLS, filter query)
  mengikuti `supabase-operations` — jangan menebak API Supabase.

## Struktur folder

```
src/
├── components/
│   ├── ui/         # komponen UI generik (tombol, input, dll.)
│   └── jamaah/     # komponen per-fitur (contoh: jamaah)
├── hooks/          # custom React hooks
├── lib/            # integrasi & util (supabase.ts, dexie, sync)
├── pages/          # halaman/route
└── types/          # tipe data bersama
```

## Menjalankan

Lihat `README.md`. Singkatnya: `npm install` → salin `.env.example` ke `.env`
→ `npm run dev`.
