#!/bin/sh
# Shared source-release build for the curl installer and Homebrew formula.
# Run from an unpacked release root. Lifecycle scripts stay disabled.
set -eu
[ ! -e .cland-build-package-lock ] || { echo 'An unfinished cland build backup exists.' >&2; exit 1; }
npm ci --include=dev --ignore-scripts --no-audit --no-fund
cp -p package-lock.json .cland-build-package-lock
restore_lock() {
    cp -p .cland-build-package-lock package-lock.json
    rm -f .cland-build-package-lock
}
trap restore_lock 0
npm run build
npm prune --omit=dev --ignore-scripts --no-audit --no-fund
