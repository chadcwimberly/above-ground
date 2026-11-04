// Runs on every Netlify deploy (see netlify.toml). Writes public/version.json with the
// semantic version from package.json and the time this version was built and went live,
// and gives the service worker a cache name unique to this release so old files are dropped.
import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const releasedAt = new Date().toISOString();
const commit = (process.env.COMMIT_REF || 'local').slice(0, 7);
const info = { version: pkg.version, releasedAt, commit };

writeFileSync(new URL('../public/version.json', import.meta.url), JSON.stringify(info, null, 2) + '\n');

const swUrl = new URL('../public/sw.js', import.meta.url);
const sw = readFileSync(swUrl, 'utf8');
writeFileSync(swUrl, sw.replace(/const C = '[^']*';/, `const C = 'ground-${pkg.version}-${commit}';`));

console.log(`Stamped version ${info.version} (${commit}) at ${releasedAt}`);
