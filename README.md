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
