#!/usr/bin/env bash
# PROTOTYPE, throwaway: wayfinder ticket #11 (Neovim as host). Never merge.
#
# Downloads the official Neovim v0.12.5 macOS arm64 build into ./.nvim (once,
# checksum verified) and starts the cland host prototype with it, isolated from
# the user's own Neovim config. Run it from the directory the sessions should
# work in (the repo root); extra arguments go to nvim after the -u file.
set -euo pipefail

VERSION=v0.12.5
ASSET=nvim-macos-arm64.tar.gz
# The v0.12.5 release publishes no shasum.txt. Its only checksum is the sha256
# "digest" GitHub records for each release asset (release API). run.sh checks
# the download against that digest and against this pinned copy of it.
PINNED_SHA256=65fb000099e47ca1b762584c484cc833f40e30851a0ec450d4174e16317c1f9b

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NVIM_DIR="$HERE/.nvim"
NVIM_BIN="$NVIM_DIR/nvim-macos-arm64/bin/nvim"

if [[ "$(uname -s)/$(uname -m)" != "Darwin/arm64" ]]; then
  echo "run.sh: this prototype pins the macOS arm64 build; found $(uname -s)/$(uname -m)" >&2
  exit 1
fi

if [[ ! -x "$NVIM_BIN" ]]; then
  mkdir -p "$NVIM_DIR"
  url="https://github.com/neovim/neovim/releases/download/$VERSION/$ASSET"
  echo "run.sh: downloading $url"
  curl -fL# --retry 3 -o "$NVIM_DIR/$ASSET" "$url"

  api="https://api.github.com/repos/neovim/neovim/releases/tags/$VERSION"
  published=""
  if command -v jq >/dev/null; then
    published="$(curl -fsSL "$api" | jq -r --arg n "$ASSET" '.assets[] | select(.name == $n) | .digest' | sed 's/^sha256://')" || published=""
  fi
  if [[ -z "$published" ]]; then
    echo "run.sh: release API unreachable or jq missing; checking against the pinned digest only"
    published="$PINNED_SHA256"
  elif [[ "$published" != "$PINNED_SHA256" ]]; then
    echo "run.sh: the release digest ($published) differs from the pinned one ($PINNED_SHA256)" >&2
    exit 1
  fi
  actual="$(shasum -a 256 "$NVIM_DIR/$ASSET" | cut -d' ' -f1)"
  if [[ "$actual" != "$published" ]]; then
    echo "run.sh: checksum mismatch: got $actual, expected $published" >&2
    rm -f "$NVIM_DIR/$ASSET"
    exit 1
  fi
  echo "run.sh: sha256 ok ($actual), matches the release asset digest"
  # The release notes ask macOS users to clear extended attributes first.
  xattr -c "$NVIM_DIR/$ASSET" 2>/dev/null || true
  tar -xzf "$NVIM_DIR/$ASSET" -C "$NVIM_DIR"
fi

# NVIM_APPNAME renames every stdpath() and the $XDG_*_DIRS entries on
# 'runtimepath'; --clean then -u (this order) skips the user's init, plugin/
# and pack/ dirs and still sources our init.lua.
cmd=(env NVIM_APPNAME=cland-proto "$NVIM_BIN" --clean -u "$HERE/init.lua" "$@")
printf '+'
printf ' %q' "${cmd[@]}"
printf '\n'
exec "${cmd[@]}"
