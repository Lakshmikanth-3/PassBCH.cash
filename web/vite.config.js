import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here('.'),
  plugins: [react()],
  // libauth (pulled in by WizardConnect) uses top-level await for its WASM crypto.
  build: { target: 'es2022', outDir: here('dist'), emptyOutDir: true },
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
  // Local dev/preview talk to the live API so the UI can be tried without a database.
  server: { proxy: { '/api': { target: 'https://passbch-cash.vercel.app', changeOrigin: true } } },
  preview: { proxy: { '/api': { target: 'https://passbch-cash.vercel.app', changeOrigin: true } } },
  test: {
    root: here('..'),
    include: ['web/test/**/*.test.{js,jsx}', 'server/test/**/*.test.mjs', 'panel/*.test.mjs'],
    environment: 'jsdom',
    environmentMatchGlobs: [['server/**', 'node'], ['panel/**', 'node']],
    setupFiles: [here('test/setup.js')],
    globals: true,
  },
});
