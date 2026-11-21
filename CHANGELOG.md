# Changelog

All notable changes to Above Ground. Versions follow [Semantic Versioning](https://semver.org/):
MAJOR for changes that break saved data or flows, MINOR for new features, PATCH for fixes.
The exact time each version went live is shown in the app under Settings → Last Updated.

## 1.10.0 — 2026-11-18
- First-launch welcome: a one-time screen with the logo, what Above Ground is for, three promises with icons
  (no personal information gathered, data never sold, no ads) and a "Let's go" button that leads to the home
  screen and never shows again. People who already used the app skip it; a shortcut, widget or shared link on a
  brand-new install goes straight to the exercise and leaves the welcome for the next normal launch. Copy lives in
  `app_copy` (`intro_title`, `intro_body`, `intro_points` as "icon|text" lines, `intro_cta`).
- Reminder offer (iOS and Android apps): from the 4th session, the affirmation screen shows "Want a gentle reminder
  to come back?" under Done. It opens a small reminder setup (days, time, "Turn on reminders"). The offer stops
  for good once reminders are turned on, or after the 8th session if they never are. Copy lives in `app_copy`
  (`reminder_prompt`, `reminder_title`, `reminder_intro`, `reminder_turn_on`, `reminder_on`, `reminder_done`).
- Reminder day buttons fit on one row inside the modals.
- Privacy policy and support pages at `aboveground.app/privacy` and `aboveground.app/support` (both stores need
  them), linked from the bottom of Settings. On the website the links stay on the site being viewed (so a deploy
  preview opens its own pages); the apps open aboveground.app.
- Settings and "Need more help?" open as a centered modal with an X in the corner (no more bottom drawer or
  Close button). Buttons inside them use a smaller menu size, and every text button in the app now shares one
  corner radius (icon buttons stay round).
- Sync code: the 12 words sit in one box (shown read-only with a word count and copy button, or typed/pasted
  when linking, with a live count that flags words not in the list); the QR code uses round dots and rounded
  corners on a light tile so it scans in every theme.
- The sync code box fits its words with no empty space below. "Make a new code" and "Delete my data" ask for
  confirmation on their own screen in the modal (Cancel goes back) instead of adding text at the bottom.
- Text inside the modals uses one body size (1rem) instead of the larger full-screen size.
- "Support Above Ground" now speaks of contributions: new intro text, a "Leave a Tip" button, and matching card,
  thank-you and website wording. The running-costs table is gone from this screen. All of it lives in `app_copy` (`support_cta` and
  `tip_card_button` are new).
- Settings shows a contact line with hello@aboveground.app (text and address live in `app_copy`).
- Website tips: the live site uses the `web` tip rows, while deploy previews and local builds use new `web-test`
  rows holding Stripe test-mode links, so the tip flow can be tried without real payments.
- New logo: a layered sandstone worry stone. It's the app icon on iOS and Android (including Android's adaptive
  and round icons), the splash screen, the website favicon, the home-screen icon (Apple touch icon and PWA
  icons, with a maskable version) and the icon on the privacy and support pages. Replaces the placeholder circles.

## 1.9.0 — 2026-11-17
- Smooth motion throughout: screens slide forward and back (View Transitions where supported, a gentle rise
  elsewhere) while the header stays still; Settings and "Need more help?" slide up as sheets and back down;
  Settings pages slide in from the side they lead to; buttons give a little when pressed; votes pop; the welcome
  choices, help lines and tip card ease in; "Why this works" opens smoothly; theme changes fade.
- Everything turns off when the system's "reduce motion" setting is on.

## 1.8.0 — 2026-11-17
- Tip jar. Settings → Support Above Ground explains what running the app costs and offers $2, $5 and $10 tips:
  in-app purchases in the iOS and Android apps (prices shown in the person's currency), payment links on the
  website. Tips unlock nothing.
- After a completed session, a gentle card offers a tip: first at the 3rd completion, then at most once every 10
  completions and 30 days; never in a session where "Need more help?" was opened; "Not now" and "Don't show
  again" are saved to the synced profile.
- Database: `tip_options` (amounts, store product IDs, web links) and `app_copy` (support and thank-you text),
  migration `20261117224341_tip_jar`. Tips stay hidden until the store products or web links exist.

## 1.7.0 — 2026-11-17
- Sync across devices, with no account: Settings → Show my sync code gives 12 words and a QR code; another
  device links with Settings → I have a sync code (type, paste or scan). Linked devices share settings (theme,
  font, vibration, reminder time and days, crisis-line country) and history, so weighting learns from all of
  them. Linked devices are listed by name and can be removed; "Make a new code" replaces the code.
- Only a SHA-256 hash of the words reaches the server; joining is limited to 5 tries an hour.
- Settings → Download or delete my data: a JSON export, and deletion of this device's data or everything on all
  linked devices, including the anonymous sign-ins. The app then starts fresh.
- Sync links (`https://aboveground.app/sync#…`) open the link screen with the words filled in.
- Database: `profiles`, `devices.profile_id` and the sync/export/delete functions
  (migration `20261117223741_profiles_and_sync`).

## 1.6.0 — 2026-11-17
- Website: when a newer version goes live, a small "A new version of Above Ground is ready" bar offers
  Refresh or Later. It never reloads on its own, so nobody loses their place mid-exercise.

## 1.5.2 — 2026-11-17
- Developer previews: every pull request gets a comment with its website preview, an installable Android APK
  (with QR code) and a one-command iPhone Simulator preview (`npm run preview:ios -- <N>`); `main` publishes
  the latest development build as the `dev` prerelease

## 1.5.1 — 2026-11-17
- Website ready for aboveground.app: "Above Ground" as the installed web app's name (was "Ground"),
  a page description, and canonical and sharing tags pointing at https://aboveground.app/

## 1.5.0 — 2026-11-17
- Widgets: iOS home-screen (small and medium) and lock-screen widgets, and an Android home-screen widget,
  each opening straight into an exercise for how you're feeling
- Siri and Shortcuts (iOS 16+): "Ground me with Above Ground", "I'm anxious in Above Ground", and more
- Android: long-press the app icon for the three choices; Google Assistant can open them too (App Actions)
- Mindful minutes: optionally save each completed session to Apple Health, or to Health Connect on Android 16+
  (Settings, off by default; write-only, Above Ground never reads health data)
- Deep links: aboveground://start?feeling=anxiety|depression|grounding and aboveground://help;
  the website accepts ?start=anxiety and ?help

## 1.4.0 — 2026-11-17
- "Need more help?" is always in the header (and in Settings): the crisis line for your country with call,
  text and chat buttons, your local emergency number, and a country picker. Lines come from `crisis_resources`
- A note that Above Ground supports everyday moments and isn't a replacement for professional care
- Breathing guide: breathing exercises show a circle that grows and shrinks with each breath, with gentle taps
  on phones (Settings → Vibration). Paced by the `pacing` steps stored with each exercise
- "Why this works": exercises can show a plain-language research summary and its sources (`research_summary`, `sources`)
- Recorded guides: exercises with an `audio_url` get a play button
- Gentle reminders in the iOS and Android apps: off by default; pick a time and days in Settings.
  Local notifications only, worded from `reminder_messages`
- Starts instantly from saved content and refreshes in the background (first launch still waits for content)
- Accessibility: the apps follow the phone's text size; the timer announces its start, 10 seconds left and the end
  to screen readers; the breathing circle is hidden when reduced motion is on

## 1.3.1 — 2026-11-17
- Events from the end of a session (completing an exercise, the completion message) are sent right away
  instead of on the next launch; queued events are also sent when you switch away from or close the app

## 1.3.0 — 2026-11-17
- iOS and Android apps: the same app now builds as native apps with Capacitor (app ID `app.aboveground`),
  with icons, splash screen, status bar colors that follow the theme, and the Android back button
- The website keeps working as before at the same address; existing devices keep their identity and settings
- Fonts are now bundled with the app instead of loaded from Google Fonts (works offline, no third-party request)
- Built with Vite; Supabase client updated and bundled instead of loaded from a CDN
- In the native apps, saved settings, content and the sign-in are kept in native storage the OS won't clear
- Automatic Android and iOS test builds on every push (GitHub Actions)

## 1.2.0 — 2026-11-06
- Exercise picking learns tag taste: once a tag reaches 2 net votes, never-seen exercises that share up-voted
  tags are more likely (up to ×2) and not-yet-voted exercises that share down-voted tags are less likely (down to ×0.5)
- The effect grows with each additional vote (full strength at 6 net votes) and is scaled by tag rarity,
  so broad tags like "mental" or "low-effort" count very little
- A direct vote on an exercise always overrides its tag affinity; affirmations are unchanged

## 1.1.1 — 2026-11-04
- Settings: "Palette" is now "Theme"
- Theme swatches are true circles with an unclipped ring
- Lora is the default font and listed first; font names shortened to Alegreya and Source Sans
- Font buttons have equal left and right padding

## 1.1.0 — 2026-11-04
- Welcome screen with greetings chosen by time of day, weekend and visit history
- Three entry points: anxious, depressed, grounding; exercise and affirmation stay in that category
- Device-weighted picking: favors unseen and up-voted items, avoids down-voted and often-shuffled ones
- All content (exercises, affirmations, messages, greetings) comes only from Supabase
- Each device gets a permanent, human-readable name (e.g. "Kind Cookie Pony")
- Settings show the device name and the version with its release time

## 1.0.0 — 2026-10-29
- First release: grounding exercise → affirmation → completion message, votes, shuffle, palettes and fonts
