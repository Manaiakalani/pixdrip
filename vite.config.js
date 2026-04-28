import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2022',
    cssCodeSplit: true,
    // Target is es2022 — every supported browser handles <link rel="modulepreload">
    // natively, so we can drop Vite's polyfill (~2KB inline script).
    modulePreload: { polyfill: false },
  },
  server: {
    open: true,
  },
})
