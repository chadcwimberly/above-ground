#!/usr/bin/env bash
# Netlify "ignore" command for production deploys (each one costs 15 of the free plan's 300 monthly credits).
# Exit 0 = skip the build, anything else = build. Skips only when nothing the website is built from changed since
# the last production build: docs, CHANGELOG/README, CLAUDE.md, .github, supabase/ and the native ios/ android/
# folders don't affect the site. Builds whenever it can't tell (first build, forced redeploy, missing history).
WEB="index.html src public scripts package.json package-lock.json vite.config.js netlify.toml"
if [ -z "$CACHED_COMMIT_REF" ] || [ "$CACHED_COMMIT_REF" = "$COMMIT_REF" ]; then
  echo "No earlier build to compare with: building."; exit 1
fi
if ! git cat-file -e "$CACHED_COMMIT_REF^{commit}" 2>/dev/null; then
  echo "Last built commit isn't in this checkout: building."; exit 1
fi
if git diff --quiet "$CACHED_COMMIT_REF" "$COMMIT_REF" -- $WEB; then
  echo "Nothing the website is built from changed since $CACHED_COMMIT_REF: skipping this production deploy."; exit 0
fi
echo "Website files changed: building."; exit 1
