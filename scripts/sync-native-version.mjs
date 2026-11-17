// Copies the app version from package.json into the iOS and Android projects, so all three platforms
// always show the same version. Runs as part of `npm run native`.
//
// Version name (shown in the stores): the semantic version, e.g. 1.3.0.
// Build number (must only ever go up): BUILD_NUMBER from CI if set, otherwise derived from the version
// as major*10000 + minor*100 + patch (1.3.0 -> 10300), which also always increases between releases.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const { version } = JSON.parse(readFileSync(new URL('package.json', root)));
const [major, minor, patch] = version.split(/[.-]/).map(Number);
const build = Number(process.env.BUILD_NUMBER) || major * 10000 + minor * 100 + patch;

function edit(path, changes) {
  const url = new URL(path, root);
  if (!existsSync(url)) return console.log(`skip ${path} (platform not added)`);
  let text = readFileSync(url, 'utf8');
  for (const [pattern, replacement] of changes) {
    if (!pattern.test(text)) throw new Error(`${path}: could not find ${pattern}`);
    text = text.replace(pattern, replacement);
  }
  writeFileSync(url, text);
  console.log(`${path}: ${version} (build ${build})`);
}

edit('android/app/build.gradle', [
  [/versionCode \d+/, `versionCode ${build}`],
  [/versionName "[^"]*"/, `versionName "${version}"`]
]);
edit('ios/App/App.xcodeproj/project.pbxproj', [
  [/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`],
  [/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`]
]);
