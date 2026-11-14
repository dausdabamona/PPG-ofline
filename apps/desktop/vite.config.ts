/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Renderer (React). Hasil build di dist/, dimuat Electron lewat protokol app:// (lihat electron/main.ts).
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, strictPort: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome130',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['test/siapkan.ts'],
    testTimeout: 120_000,
    hookTimeout: 60_000,
  },
})
