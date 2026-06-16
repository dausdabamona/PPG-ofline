import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Konfigurasi Vite untuk aplikasi PPG (offline-first).
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
