// Vite builds the app into dist/. Netlify publishes dist/ (the website); Capacitor copies dist/ into the
// iOS and Android apps. Files in public/ (manifest, icon, service worker, version.json) are copied as-is.
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2022' } // es2022: top-level await (Safari 15+, Chrome 89+)
});
