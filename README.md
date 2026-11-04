# above-ground
A mental health app to help you stay above ground. Helps with anxiety, depression, grounding exercises, and more.

## Structure
- `public/` — the PWA (plain HTML/JS, no build step). Netlify publishes this folder (see `netlify.toml`).
- `supabase/migrations/` — database schema and functions for Supabase project `ahamlyfqmwfpggntigjy`.

## How content is picked
Exercises and affirmations come from the `pick_content` database function. It weights choices using
only the current device's history: unseen ×3, up-voted ×2.5, down-voted ×0.2, and items shuffled often
relative to views are picked less. The app falls back to a plain random pick when offline.
