# Changelog

All notable changes to Above Ground. Versions follow [Semantic Versioning](https://semver.org/):
MAJOR for changes that break saved data or flows, MINOR for new features, PATCH for fixes.
The exact time each version went live is shown in the app under Settings → Last Updated.

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
