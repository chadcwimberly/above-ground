# Above Ground — processes and recurring tasks

The runbook for anyone (usually Claude) working on Above Ground. `CLAUDE.md` holds the standing rules; this file
holds the step-by-step how. **When a process changes, update this file in the same pull request.**

Owner: Chad. He wants as much automated as possible and never handles versions, builds or scripts himself.
He'll do steps only he can do (account sign-ups, payments, DNS, store consoles, pasting secrets). For those,
give him exact values and short numbered steps.

---

## 1. Ship a change to the app

1. Branch from the latest `main`: `git fetch origin main && git checkout -B <short-name> origin/main`.
2. Make the change. Put web vs native differences in `src/platform.js`. Don't hard-code content (see section 2).
3. Bump the version with `npm version <x.y.z> --no-git-tag-version` (SemVer rules are in `CLAUDE.md`). Add a
   `CHANGELOG.md` entry with today's date at the top.
4. Run `npm run native`. This builds, copies the build into iOS/Android, and writes the version and build number
   into both native projects.
5. Restore the service worker with `git checkout -- public/sw.js`, because the build stamps it.
6. Commit with the attribution lines the session asks for, then push the branch.
7. Open the pull request with the REST API. `gh pr create` uses GraphQL, which is blocked in Claude sessions:
   ```sh
   gh api repos/chadcwimberly/above-ground/pulls -f title="…" -f head=<branch> -f base=main -F body=@body.md --jq .number
   ```
8. Wait for checks: `gh run list -R chadcwimberly/above-ground --branch <branch>`. **Native builds** (Android,
   iOS, preview comment) and the Netlify deploy preview must both pass.
9. Check the deploy preview with real data (section 4). Confirm the new version shows and the change works.
10. Squash-merge:
    `gh api -X PUT repos/chadcwimberly/above-ground/pulls/<N>/merge -f merge_method=squash`.
11. Report the result to Chad: what changed, the version change (old → new), and anything he needs to do.

Docs-only or repo-housekeeping changes skip steps 3–5 and need no version bump.

## 2. Change content (exercises, affirmations, messages, greetings, crisis resources, reminders)

- Supabase project `ahamlyfqmwfpggntigjy` is the single source of truth. Use the Supabase connector. The Claude
  sandbox can't reach Supabase directly.
- **Content rows:** insert or update them in the database with `execute_sql`. Don't add them to the repo or the app.
- **Schema changes:** `apply_migration`, then save the same SQL in `supabase/migrations/<version>_<name>.sql`
  using the version Supabase assigned (check with `list_migrations`). Run `get_advisors` (security) afterwards
  and fix anything new. Keep row-level security on every table.
- If the app needs to read a new column, update `loadContent()` in `src/main.js`. That counts as an app change,
  so follow section 1.
- **"Why this works" summaries** live in `exercises.research_summary` and `exercises.sources` (a jsonb list of
  `{title, year, url}`). The review copy is the Claude Doc at https://claude.ai/artifact/VvJuJX3nJsbYSvV8EY9EHm.
  For a new or changed exercise, draft it there, get Chad's OK, then write it to the database by slug.
  Style: describe what the research shows; when it's about the technique in general, say "similar exercises" or
  "tasks like this" rather than pointing out what hasn't been studied.

## 2a. Profiles, sync codes and data deletion

- Every install signs in anonymously and gets a `devices` row; a trigger gives each new device its own `profiles`
  row. Devices that share a sync code share one profile. Weighting (`device_content_weights`) reads events from
  every device in the profile.
- The app only talks to profiles through functions: `get_profile`, `save_profile`, `set_sync_code`,
  `join_profile` (5 tries/hour), `linked_devices`, `unlink_device`, `export_my_data`, `delete_my_data`.
  The tables have row-level security with no policies on purpose; the advisor's "no policy" notes are expected.
- Synced settings: theme, font, vibration, reminder time/days, crisis-line country (latest change wins).
  Reminders on/off and Health stay per device. Add a new synced setting to `SYNCED` in `src/main.js`.
- Sync words live only on devices (`syncWords`); the server keeps a SHA-256 hash. `src/sync.js` has the word
  list, hashing, QR and scanner.

## 3. Native projects (iOS / Android)

- Capacitor 8, app ID `app.aboveground`. iOS uses Swift Package Manager. Android uses Java 21.
- **Custom plugins:** iOS `HealthPlugin.swift` is registered in `ios/App/App/MainViewController.swift`. Android
  `HealthPlugin.java` is registered in `MainActivity.java`. Register any new native plugin the same way and call it
  from JS through `registerPlugin()` in `src/platform.js`.
- **Editing `project.pbxproj`:** use the npm `xcode` package in a Node script. Ruby gems (CocoaPods, the
  xcodeproj gem, fastlane installs) are blocked in the sandbox. Known quirks: `addTargetDependency` silently does
  nothing, so add the `PBXTargetDependency` by hand; `addPbxGroup` may reuse an existing file reference, so check
  that no build files are left orphaned.
- The sandbox has no Xcode or Android SDK. The GitHub Actions run is the build check, so read its logs to confirm
  native changes (embedded widget, App Intents metadata and so on).
- **Deep links:** `aboveground://start?feeling=anxiety|depression|grounding` and `aboveground://help`. The website
  equivalents are `?start=…` and `?help`. Keep shortcuts, widgets and App Intents pointing at these.

## 4. Previews and testing

- **Every pull request** gets a comment, updated on each push, with:
  - the Netlify preview `https://deploy-preview-<N>--above-ground.netlify.app`
  - an Android APK (prerelease `pr-<N>`) with a direct link and QR code
  - `npm run preview:ios -- <N>` (Mac only; opens the build in the iPhone Simulator)
- **Every push to `main`** republishes the prerelease `dev`, the latest development build.
  `preview-cleanup.yml` deletes `pr-<N>` when the pull request closes.
- **Checking a Netlify preview yourself:** the sandbox can't reach netlify.app, and previews are protected by
  Netlify team sign-in. Use the built-in browser. It keeps Chad's Netlify sign-in; if it's signed out, ask him to
  sign in there. Check the version label, the console, and that session events reach Supabase.
- **Local checks in the sandbox:** `npm run build`, then `npx vite preview` with Playwright and route-mocked
  Supabase responses (there's no network to Supabase).
- **Later:** once the developer accounts exist, add a signed release workflow (fastlane) that uploads to
  TestFlight and Google Play internal testing.

## 5. Store release (not set up yet)

Follow the publishing guide (https://claude.ai/artifact/Uov4eGeBoRhFziy9vH6qYk) and the implementation plan
(https://claude.ai/artifact/C9RGxUSLoxMoAkqc1u1cGV). Chad publishes as an individual developer; a nonprofit is
an optional later step. Build numbers come from `scripts/sync-native-version.mjs`
(`BUILD_NUMBER` env or major·10000 + minor·100 + patch).

## 6. Secrets and accounts

- Never ask Chad to paste keys, passwords or signing files into chat, and never commit them. He adds them himself
  under GitHub → Settings → Secrets and variables → Actions. Give him the exact secret names to use.
- Creating accounts, accepting terms and making payments are his to do. Prepare everything, then hand him the steps.

## 7. Domain, DNS and email (GoDaddy)

`aboveground.app` is registered at GoDaddy, and its DNS stays there. Records:

| Type | Name | Value | Purpose |
| --- | --- | --- | --- |
| A | @ | 75.2.60.5 | Website (Netlify) |
| CNAME | www | above-ground.netlify.app | Website (Netlify) |
| MX | @ | mx1.improvmx.com (priority 10) | Email forwarding |
| MX | @ | mx2.improvmx.com (priority 20) | Email forwarding |
| TXT | @ | v=spf1 include:spf.improvmx.com ~all | Email forwarding (SPF) |

- The domain must also be added under Netlify → Domain management for the site. Netlify then issues HTTPS.
- Email: ImprovMX free plan with a catch-all `*` forwarding to Chad's Gmail. It's receive-only; replies go from
  Gmail. Forward Email is the alternative if he wants to send as @aboveground.app.
- Once the domain is live, use https://aboveground.app in docs and links. The old netlify.app address keeps
  working, but saved settings don't carry over between the two addresses.

## 8. Sandbox limits (Claude sessions)

| Blocked | Use instead |
| --- | --- |
| GitHub GraphQL (`gh pr create`, `gh pr view`, `gh release view`) | `gh api repos/...` REST endpoints |
| Supabase over the network | the Supabase connector |
| netlify.app and other websites from the shell | the built-in browser, WebFetch for public pages |
| rubygems / CocoaPods / fastlane installs | npm tools, or GitHub Actions on macOS runners |

## 9. Open work (update as items close)

- [ ] Chad confirms the Netlify domain + GoDaddy DNS; then verify https://aboveground.app and switch the docs to it.
- [ ] Chad sets up ImprovMX; then send a test email to any@aboveground.app.
- [x] "Why this works" summaries approved and loaded for all 56 exercises (2026-11-17).
- [ ] Privacy and support pages for aboveground.app (needs Chad's contact email).
- [x] Sync code (12 words + QR) and delete-my-data (1.7.0).
- [ ] Tip jar ($2/$5/$10, shown after 3 completions + Settings screen).
- [ ] Signed release workflow → TestFlight / Play internal testing (needs developer accounts).
- [ ] Audio guides (someone Chad knows may record them; `exercises.audio_url` is ready).
