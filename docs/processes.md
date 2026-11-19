# Above Ground — processes and recurring tasks

The runbook for anyone (usually Claude) working on Above Ground. `CLAUDE.md` holds the standing rules; this file
holds the step-by-step how. **When a process changes, update this file in the same pull request.**

Owner: Chad. He wants as much automated as possible and never handles versions, builds or scripts himself.
He'll do steps only he can do (account sign-ups, payments, DNS, store consoles, pasting secrets). For those,
give him exact values and short numbered steps.

---

## 0. Netlify credits

Free plan: 300 credits a month; a production deploy costs 15 (about 20 a month). Previews and GitHub Actions
are free. If credits run out, every site on the team pauses until the cycle resets, so batch releases (step 1)
and never merge docs-only work by itself. Usage: Netlify → Team → Usage & Billing.

## 1. Ship a change to the app

1. Branch from the latest `main`: `git fetch origin main && git checkout -B <short-name> origin/main`. Use one
   branch (one pull request) for everything shipped in a working session, or merge several feature pull requests
   into a `release` branch and open one pull request from it to `main`.
2. Make the change. Put web vs native differences in `src/platform.js`. Don't hard-code content (see section 2).
3. Bump the version once for the whole release with `npm version <x.y.z> --no-git-tag-version` (SemVer rules
   are in `CLAUDE.md`; with several changes, the biggest one decides). Add one `CHANGELOG.md` entry with today's
   date at the top. If you add more to the release later, update that same version and entry instead of bumping again.
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

Docs-only or repo-housekeeping changes skip steps 3–5 and need no version bump. Don't merge them on their own:
commit them to the next release branch. (If one must go alone, `scripts/netlify-skip-build.sh` keeps it from
costing a production deploy.)

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

## 2b. Tip jar

- `tip_options` rows: iOS/Android name the consumable product IDs `app.aboveground.tip.small|medium|large`;
  the web rows hold Stripe Payment Links. A row shows only when `is_active` is true and, on the web, has a `url`;
  in the apps, only when the store returns the product.
- Copy (`support_intro`, `support_cta` (the "Leave a Tip" label), `tip_card`, `tip_card_button`,
  `tip_thanks`, `tips_unavailable`, `contact_email`, `contact_line`) lives in `app_copy`.
- **Wording: buttons say "Leave a Tip"; body text says "contribution(s)"; never "donate"/"donation".** Chad is an individual, not a charity: Stripe
  allows donations only for a charitable purpose, Apple only for approved nonprofits, and the money covers hosting.
  Don't promise how funds are used beyond that. (Code and table names keep the internal word "tip".) (`support_costs` is no longer shown in the app.)
- Card rules are in `tipCardDue()` in `src/main.js`. Purchases use `@capgo/native-purchases` (StoreKit 2 /
  Play Billing, no receipt server; tips are consumed right away).

### Stripe links: sandbox vs live

| | Sandbox (test mode) | Live |
| --- | --- | --- |
| `tip_options.platform` | `web-test` | `web` |
| Links | `donate.stripe.com/test_…` / `buy.stripe.com/test_…` | `donate.stripe.com/…` (no `test_`) |
| Used on | Deploy previews, branch deploys, local builds (any host that isn't the live site) | Only `aboveground.app` and `above-ground.netlify.app` (see `loadTips()`) |
| `is_active` | `true` | `false` until launch |
| Payments | Fake; test card 4242 4242 4242 4242, any future date, any CVC | Real money to Chad's Stripe account |

- **When to turn live links on:** only when Chad says the app is ready to go live in the app stores. Until then
  the live rows stay `is_active = false`, so the live site shows "Tips aren't available here yet."
- **How to turn them on (database only, no app release needed):**
  `update public.tip_options set is_active = true where platform = 'web';`
  To turn them off again: the same with `false`. Then open aboveground.app → Settings → Support Above Ground and
  check the three buttons open the live Stripe pages (don't complete a payment).
- **Never** put a `test_` link in a `web` row or a live link in a `web-test` row, and never show any Stripe link
  in the iOS or Android apps: Apple and Google require their own in-app purchase for tips, and the app code only
  uses store products there.
- If Chad replaces a link in Stripe, update that row's `url`; keep amounts matching the in-app tips ($2, $5, $10).
- Stripe setup: the links are **tips** with tax code **Optional Gratuity (`txcd_90020001`)**, not donations.
  Stripe only allows tips for a good or service provided, while donations must be tied to a charitable purpose.
  Above Ground (a free app) is the service. The tax code only changes anything if Stripe Tax is turned on.

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
- The domain is live: use https://aboveground.app in docs and links. The old netlify.app address keeps
  working, but saved settings don't carry over between the two addresses (sync codes bridge them).
- Email: ImprovMX forwards every address @aboveground.app to Chad's Gmail; the public address is
  hello@aboveground.app (`app_copy.contact_email`, privacy and support pages).

## 8. Sandbox limits (Claude sessions)

| Blocked | Use instead |
| --- | --- |
| GitHub GraphQL (`gh pr create`, `gh pr view`, `gh release view`) | `gh api repos/...` REST endpoints |
| Supabase over the network | the Supabase connector |
| netlify.app and other websites from the shell | the built-in browser, WebFetch for public pages |
| rubygems / CocoaPods / fastlane installs | npm tools, or GitHub Actions on macOS runners |

## 9. Open work (update as items close)

Chad's own steps (accounts, DNS, store setup, secrets) are numbered in the "All Tasks" section of the Remaining
Human Tasks doc: https://claude.ai/artifact/Uov4eGeBoRhFziy9vH6qYk. Keep it in step with this list.


- [x] aboveground.app live on Netlify with HTTPS.
- [x] Email forwarding (ImprovMX).
- [x] "Why this works" summaries approved and loaded for all 56 exercises (2026-11-17).
- [x] Smooth animations (1.9.0). Motion lives in the "Motion" block of `index.html` and `swap()` in `src/main.js`;
  everything must stay off under reduced motion.
- [x] Privacy and support pages (`public/privacy/`, `public/support/`, styled by `public/pages.css`), contact
  hello@aboveground.app (1.10.0). Update the privacy policy whenever what the app stores changes.
- [ ] At store launch (Chad's call): turn on the live web tip links (section 2b).
- [ ] Universal Links / App Links for `aboveground.app/sync` (needs the Apple Team ID and the Play app-signing SHA-256).
- [x] Sync code (12 words + QR) and delete-my-data (1.7.0).
- [x] Tip jar (1.8.0). Goes live per platform once the store products / web payment links exist (see below).
- [ ] Signed release workflow → TestFlight / Play internal testing (needs developer accounts).
- [ ] Audio guides (someone Chad knows may record them; `exercises.audio_url` is ready).
