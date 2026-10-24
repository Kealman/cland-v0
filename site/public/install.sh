#!/bin/sh
# Install cland from a stable release tag. No root privileges required.
set -eu

fail() { printf 'cland install: %s\n' "$*" >&2; exit 1; }
case "${1:-}" in
    -h|--help)
        cat <<'HELP'
Usage: sh install.sh
Install the latest stable cland tag on Linux or macOS. Requires Node >=24.13.0 <25,
npm, curl, tar and Git (for latest-tag discovery). Never runs sudo.
PREFIX: installation prefix (default: $HOME/.local).
CLAND_VERSION: install a specific released tag, e.g. v0.2.0.
CLAND_RELEASE_URL: use an HTTPS or file:// source tarball instead of tag discovery.
Paths: PREFIX/bin/cland -> PREFIX/lib/cland/hub/bin/cland.ts.
Rerun to update; a download or build failure keeps the current installation.
HELP
        exit 0 ;;
    '') ;;
    *) fail 'Unknown argument. Use --help.' ;;
esac
node_version=$(node --version 2>/dev/null || true)
case "$node_version" in
    v24.*) node_minor=${node_version#v24.}; node_minor=${node_minor%%.*} ;;
    *) node_minor=0 ;;
esac
case "$node_minor" in ''|*[!0-9]*) node_minor=0 ;; esac
[ "$node_minor" -ge 13 ] || fail 'Node >=24.13.0 <25 is required. Install Node 24 LTS from https://nodejs.org/en/download, put node and npm on PATH, then rerun this script.'

case "$(uname -s)" in Linux|Darwin) ;; *) fail 'Only Linux and macOS are supported.' ;; esac
for tool in npm curl tar mktemp readlink; do
    command -v "$tool" >/dev/null 2>&1 || fail "Required command missing: $tool"
done
prefix=${PREFIX:-"$HOME/.local"}
case "$prefix" in /*) ;; *) fail 'PREFIX must be an absolute path.' ;; esac
mkdir -p "$prefix/bin" "$prefix/lib"
prefix=$(cd "$prefix" && pwd -P)
if [ -e "$prefix/bin/cland" ] || [ -L "$prefix/bin/cland" ]; then
    [ -L "$prefix/bin/cland" ] && [ "$(readlink "$prefix/bin/cland")" = ../lib/cland/hub/bin/cland.ts ] || fail "$prefix/bin/cland already exists; move it first."
fi
if [ -e "$prefix/lib/cland" ] || [ -L "$prefix/lib/cland" ]; then
    [ ! -L "$prefix/lib/cland" ] && [ -f "$prefix/lib/cland/.cland-installer" ] || fail "$prefix/lib/cland is not managed by this installer; move it first."
fi
lock="$prefix/lib/.cland-install-lock"
mkdir "$lock" 2>/dev/null || fail "Another install may be running ($lock)."
stage=
published=0
interrupted=0
cleanup() {
    if [ -n "$stage" ]; then
        if [ "$published" = 0 ] && [ -e "$stage/previous" ]; then
            # The old installation stays recoverable until the command is published.
            if [ -e "$prefix/lib/cland" ]; then
                mv "$prefix/lib/cland" "$stage/source" || {
                    printf 'Previous installation preserved at: %s/previous\n' "$stage" >&2
                    rmdir "$lock" 2>/dev/null || true
                    return
                }
            fi
            mv "$stage/previous" "$prefix/lib/cland" || {
                printf 'Could not restore previous installation. Recover it from: %s/previous\n' "$stage" >&2
                rmdir "$lock" 2>/dev/null || true
                return
            }
        fi
        if [ "$interrupted" = 1 ]; then
            # A foreground npm/build child may still be unwinding. Do not remove
            # its directory; the next install uses an independent staging path.
            printf 'Interrupted install; staging retained at: %s\n' "$stage" >&2
        else
            (cd "$stage" && rm -rf source archive.tar.gz tags.txt build-package-lock.json previous) || true
            rmdir "$stage" 2>/dev/null || true
        fi
    fi
    rmdir "$lock" 2>/dev/null || true
}
trap cleanup 0
trap 'interrupted=1; exit 1' HUP INT TERM
stage=$(mktemp -d "$prefix/lib/.cland-install.XXXXXX")
cd "$stage"
url=${CLAND_RELEASE_URL:-}
if [ -z "$url" ]; then
    version=${CLAND_VERSION:-}
    if [ -z "$version" ]; then
        printf 'Finding the latest stable cland release tag...\n'
        command -v git >/dev/null 2>&1 || fail 'Git is required to find the latest release. Install Git or set CLAND_VERSION=vX.Y.Z to a known release.'
        GIT_TERMINAL_PROMPT=0 git ls-remote --tags --refs https://github.com/Kealman/cland-v0.git > tags.txt || fail 'Could not discover release tags. Check your connection or set CLAND_VERSION=vX.Y.Z to a known release.'
        version=$(node -e '
            const refs = require("node:fs").readFileSync("tags.txt", "utf8").trim().split(/\s+/);
            const versions = refs.filter(r => /^refs\/tags\/v\d+\.\d+\.\d+$/.test(r)).map(r => r.slice("refs/tags/".length));
            versions.sort((a,b) => { const x=a.slice(1).split(".").map(Number), y=b.slice(1).split(".").map(Number); return y[0]-x[0] || y[1]-x[1] || y[2]-x[2]; });
            if (!versions.length) { console.error("No stable cland release tag found; set CLAND_VERSION=vX.Y.Z to a known release"); process.exit(1); }
            console.log(versions[0]);
        ')
    fi
    printf '%s\n' "$version" | node -e '
        const v=require("node:fs").readFileSync(0,"utf8").trim();
        if (!/^v\d+\.\d+\.\d+$/.test(v)) { console.error("CLAND_VERSION must be vX.Y.Z"); process.exit(1); }
    '
    url="https://codeload.github.com/Kealman/cland-v0/tar.gz/refs/tags/$version"
fi
# file:// supports offline release mirrors and sealed installer tests.
case "$url" in https://*|file://*) ;; *) fail 'Release URL must use https:// or file://.' ;; esac
printf 'Downloading %s\n' "$url"
curl -q -fsSL --proto '=https,file' --proto-redir '=https' "$url" -o archive.tar.gz || fail "Could not download release archive: $url"
mkdir source
tar -xzf archive.tar.gz -C source --strip-components=1
cd source
[ -f package-lock.json ] && [ -f hub/bin/cland.ts ] || fail 'Release archive is missing cland sources or its lockfile.'
printf 'Building cland from locked dependencies...\n'
if [ -f packaging/build-install.sh ]; then
    sh packaging/build-install.sh
else
    # Published tags predating the shared helper keep their original build path.
    # In particular, CLAND_VERSION=v0.2.0 remains installable by this script.
    printf 'Using the legacy source-release build...\n'
    npm ci --include=dev --ignore-scripts --no-audit --no-fund
    cp -p package-lock.json ../build-package-lock.json
    npm run build
    npm prune --omit=dev --ignore-scripts --no-audit --no-fund
    cp -p ../build-package-lock.json package-lock.json
fi
: > .cland-installer
version=$(node -p 'require("./package.json").version')
cd "$stage"
printf 'Installing cland %s in %s/lib/cland\n' "$version" "$prefix"
if [ -e "$prefix/lib/cland" ]; then mv "$prefix/lib/cland" previous; fi
mv source "$prefix/lib/cland" || fail 'Could not move the new installation into place.'
ln -sf ../lib/cland/hub/bin/cland.ts "$prefix/bin/cland"
published=1
printf 'Installed cland %s: %s/bin/cland\n' "$version" "$prefix"
case ":$PATH:" in
    *":$prefix/bin:"*) ;;
    *) printf 'Add this directory to PATH: %s/bin\n' "$prefix" ;;
esac
printf 'Check with: %s/bin/cland --version\n' "$prefix"
