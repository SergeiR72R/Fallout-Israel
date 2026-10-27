import { defineConfig } from 'vite';

// base: './' — чтобы сборка работала и на GitHub Pages, и из любой папки.
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
