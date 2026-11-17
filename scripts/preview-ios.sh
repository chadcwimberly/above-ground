#!/usr/bin/env bash
# Opens a preview build of the iOS app in the iPhone Simulator on this Mac.
#
#   npm run preview:ios            the latest development build (main)
#   npm run preview:ios -- 12      the build for pull request #12
#
# Needs Xcode (for the Simulator) and the GitHub CLI, signed in once: brew install gh && gh auth login
set -euo pipefail
REPO=chadcwimberly/above-ground

command -v xcrun >/dev/null || { echo "Install Xcode from the App Store first."; exit 1; }
command -v gh >/dev/null || { echo "Install the GitHub CLI first: brew install gh && gh auth login"; exit 1; }

if [ -n "${1:-}" ]; then
  BRANCH=$(gh pr view "$1" -R "$REPO" --json headRefName -q .headRefName)
  echo "Pull request #$1 (branch $BRANCH)"
else
  BRANCH=main
  echo "Latest development build (main)"
fi

RUN=$(gh run list -R "$REPO" --workflow "Native builds" --branch "$BRANCH" --status success --limit 1 \
  --json databaseId -q '.[0].databaseId')
[ -n "$RUN" ] || { echo "No finished build yet for $BRANCH. Try again in a few minutes."; exit 1; }

DIR=$(mktemp -d)
echo "Downloading build $RUN…"
gh run download "$RUN" -R "$REPO" -n above-ground-ios-simulator -D "$DIR"
unzip -q "$DIR/AboveGround-simulator.zip" -d "$DIR"

# Use a simulator that's already running, otherwise the first available iPhone.
DEVICE=$(xcrun simctl list devices booted | grep -m1 -oE '[0-9A-F-]{36}' || true)
if [ -z "$DEVICE" ]; then
  DEVICE=$(xcrun simctl list devices available | grep -m1 'iPhone' | grep -oE '[0-9A-F-]{36}')
  xcrun simctl boot "$DEVICE"
fi
open -a Simulator
xcrun simctl install "$DEVICE" "$DIR/App.app"
xcrun simctl launch "$DEVICE" app.aboveground >/dev/null
echo "Above Ground is open in the Simulator."
