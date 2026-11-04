# above-ground
A mental health app to help you stay above ground. Helps with anxiety, depression, grounding exercises, and more.

## Structure
- `public/` — the PWA (plain HTML/JS, no build step). Netlify publishes this folder (see `netlify.toml`).
- `supabase/migrations/` — database schema and functions for Supabase project `ahamlyfqmwfpggntigjy`.

## Content
All content — exercises, affirmations, completion messages and welcome greetings — lives only in Supabase.
The app ships none of its own; it keeps a copy of the last content it loaded so it keeps working offline.
To add or change content, edit the rows in Supabase (set `is_active` false to retire one).

## How content is picked
Exercises and affirmations come from the `pick_content` database function. It weights choices using
only the current device's history: unseen ×3, up-voted ×2.5, down-voted ×0.2, and items shuffled often
relative to views are picked less. The app falls back to a plain random pick when offline.

## Versioning
Versions follow [Semantic Versioning](https://semver.org/) and live in `package.json`. To release:
1. Bump the version: `npm version patch|minor|major --no-git-tag-version` (or edit `package.json`).
2. Add an entry to `CHANGELOG.md`, commit, and push to `main`.

On each deploy Netlify runs `npm run build`, which writes `public/version.json` (version, release time, commit)
and gives the service worker a per-release cache name. Settings → Last Updated shows that release time.

## Device names
Each device (an anonymous Supabase user) gets a permanent name such as "Kind Cookie Pony", assigned by the
database on first sign-in (`devices.name`). The optional `devices.nickname` is for an admin-set label.
