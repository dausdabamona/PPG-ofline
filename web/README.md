# PPG — Web/Android (offline-first)

Aplikasi PPG (Pembinaan Generasi Penerus) untuk mubaligh: data jamaah,
presensi, penilaian, dan hafalan. Bekerja **offline** (Dexie/IndexedDB) dan
menyinkronkan data ke server pusat daerah (Supabase).

Detail stack & arsitektur ada di [`CLAUDE.md`](./CLAUDE.md).

## Prasyarat

- Node.js 18+ (diuji pada Node 22)
- Project Supabase (untuk fitur sinkronisasi — opsional saat pengembangan awal)

## Menjalankan (pengembangan)

```bash
# 1. Pasang dependensi
npm install

# 2. Siapkan variabel lingkungan
cp .env.example .env
# lalu isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY

# 3. Jalankan dev server
npm run dev
```

Aplikasi terbuka di alamat yang ditampilkan Vite (default
`http://localhost:5173`).

## Skrip

| Perintah          | Fungsi                                  |
| ----------------- | --------------------------------------- |
| `npm run dev`     | Menjalankan dev server (HMR)            |
| `npm run build`   | Type-check + build produksi ke `dist/`  |
| `npm run preview` | Pratinjau hasil build                   |
| `npm run lint`    | Menjalankan ESLint                      |

## Catatan

- Aplikasi tetap berjalan tanpa kredensial Supabase; sinkronisasi dinonaktifkan
  sampai `.env` terisi.
- `.env` berisi kredensial dan **tidak** ikut ter-commit (lihat `.gitignore`).
