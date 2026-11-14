# PPG Sorong v2 — Offline-First

Kontrak teknis: `docs/RENCANA-IMPLEMENTASI.md` (wajib dibaca sebelum mengubah kode). Laporan fase: `docs/LAPORAN-TAHAP.md`.

## Stack
- `packages/core` — TypeScript, sql.js, libsodium-wrappers, fflate, vitest (semua logika bisnis)
- `apps/desktop` — EXE admin: Electron + React 19 + Vite
- `apps/mobile` — APK: React 19 + Vite + Capacitor 7
- Folder `desktop/` = aplikasi Python lama (arsip, jangan diubah)

## Konvensi
- Bahasa UI, pesan error, komentar logika bisnis: Bahasa Indonesia
- kebab-case file, PascalCase komponen, camelCase fungsi, snake_case tabel/kolom
- Tema terang teal–ivory; tombol ≥ 44 px; target Android low-end tanpa internet
- Jangan beri nama folder `lib` (diabaikan .gitignore)

## Perintah
- `npm install` (di lingkungan tanpa akses GitHub: `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install`)
- `npm test` — semua test workspace
- `npm run typecheck`, `npm run build`
