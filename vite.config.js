// Vite builds the app into dist/. Netlify publishes dist/ (the website); Capacitor copies dist/ into the
// iOS and Android apps. Files in public/ (manifest, icon, service worker, version.json) are copied as-is.
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// The build this page belongs to, matching what scripts/stamp-version.mjs writes to version.json.
// The website compares the two to tell when a newer release has gone live (see checkForUpdate in main.js).
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));
const BUILD = `${version}-${(process.env.COMMIT_REF || 'local').slice(0, 7)}`;

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(BUILD) },
  build: { outDir: 'dist', target: 'es2022' } // es2022: top-level await (Safari 15+, Chrome 89+)
});
