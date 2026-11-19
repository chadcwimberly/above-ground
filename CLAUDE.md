# Above Ground — working notes for Claude

**Start here:** step-by-step processes (shipping a change, content, native projects, previews, DNS/email,
sandbox workarounds, open work) are in `docs/processes.md`. Follow them, and update that file in the same
pull request whenever a process changes or an open-work item closes.

## Netlify credits (read before merging)
The site is on Netlify's free plan: 300 credits a month, and **every production deploy (a merge or push to `main`
that changes the website) costs 15**. Deploy Previews, branch deploys and GitHub Actions builds are free.
- **Batch releases: merge to `main` at most once per working session.** Put a session's features on one branch
  (or merge feature PRs into a `release` branch) and test them on the free previews. Then merge once, with one
  version bump covering everything (SemVer: the biggest change wins) and one CHANGELOG entry.
- **Never merge docs-only or housekeeping changes on their own.** Commit them to the next release branch.
- `netlify.toml` skips production builds when no website files changed (`scripts/netlify-skip-build.sh`); keep
  its file list current if the build starts reading new files.
- Roll back a bad release from Netlify's Deploys page (free), not with a new deploy.

## Releases (owner's standing instruction)
Claude owns versioning, building and scripting. The owner never bumps versions manually.
- Every commit pushed to `main` that changes the app (`index.html`, `src/`, `public/`, `scripts/`, `ios/`, `android/`,
  `capacitor.config.json`, `vite.config.js`, `netlify.toml`, database behavior the app uses)
  gets a version bump in `package.json`, using Semantic Versioning: PATCH for fixes, MINOR for new features,
  MAJOR for changes that break saved data or flows.
- Docs-only or repo-housekeeping commits don't need a bump.
- Add a matching entry to `CHANGELOG.md` in the same commit.
- Always tell the owner the version change (old → new) when reporting a commit.

## Content
Supabase is the single source of truth for content (exercises, affirmations, completion messages, greetings).
Never hard-code content in the app. Schema changes go in `supabase/migrations/` (named with the applied version);
content rows live only in the database.

## Platforms
One codebase: the website (Netlify, publishes `dist/`) and the iOS/Android apps (Capacitor, app ID `app.aboveground`).
- Keep web behavior unchanged unless asked; put web/native differences in `src/platform.js`.
- After changing app code or the version, run `npm run native` so the native projects get the new build and version,
  and restore `public/sw.js` (the build stamps its cache name) before committing.
- Don't commit `dist/` or the web copies inside the native projects (gitignored).

## Previews
Make changes on a branch and open a pull request; don't push app changes straight to `main`. The PR gets an automatic
preview comment (website, Android APK, iOS Simulator command). Check the deploy preview before merging, and merge
as part of a batched release (see Netlify credits).
