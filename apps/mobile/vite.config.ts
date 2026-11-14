/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// CSP ketat hanya untuk hasil build (server dev Vite memerlukan skrip inline untuk HMR).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: mediastream:",
  "connect-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'none'",
].join('; ')

function pasangCsp(): Plugin {
  return {
    name: 'ppg-csp',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
  }
}

// APK (Capacitor) — hasil build di dist/, disalin ke proyek Android oleh `npx cap sync android`.
export default defineConfig({
  plugins: [react(), pasangCsp()],
  base: './',
  server: { port: 5174, strictPort: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // WebView Android 7+ yang diperbarui lewat Play Store; tetap konservatif untuk HP lama.
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['test/siapkan.ts'],
    testTimeout: 180_000,
    hookTimeout: 120_000,
  },
})
