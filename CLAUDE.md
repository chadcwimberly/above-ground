# Above Ground — working notes for Claude

## Releases (owner's standing instruction)
Claude owns versioning, building and scripting. The owner never bumps versions manually.
- Every commit pushed to `main` that changes the app (`public/`, `scripts/`, `netlify.toml`, database behavior the app uses)
  gets a version bump in `package.json`, using Semantic Versioning: PATCH for fixes, MINOR for new features,
  MAJOR for changes that break saved data or flows.
- Docs-only or repo-housekeeping commits don't need a bump.
- Add a matching entry to `CHANGELOG.md` in the same commit.
- Always tell the owner the version change (old → new) when reporting a commit.

## Content
Supabase is the single source of truth for content (exercises, affirmations, completion messages, greetings).
Never hard-code content in the app. Schema changes go in `supabase/migrations/` (named with the applied version);
content rows live only in the database.
