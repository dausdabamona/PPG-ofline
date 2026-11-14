import { builtinModules } from 'node:module'
import { defineConfig } from 'vite'

// Proses utama & preload Electron → dist-electron/{main,preload}.cjs (CommonJS).
// Dibangun terpisah (--mode main / --mode preload) agar preload sandbox menjadi SATU berkas tanpa chunk bersama.
export default defineConfig(({ mode }) => {
  const entri = mode === 'preload' ? 'preload' : 'main'
  return {
    build: {
      outDir: 'dist-electron',
      emptyOutDir: entri === 'main',
      target: 'node22',
      ssr: true,
      minify: false,
      sourcemap: false,
      rollupOptions: {
        input: { [entri]: `electron/${entri}.ts` },
        external: ['electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  }
})
