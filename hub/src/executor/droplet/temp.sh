#!/usr/bin/env bash
# One dedicated machine serves one run. Mount /tmp before any runner/fixture
# starts, preserving the suite lock/reaper's existing /tmp ownership contract.
# The machine's release destroys the mount; code and coverage artifacts stay on disk.
set -eu
run="$(dirname "$0")"
cap_kib=$(node -p 'Math.max(1, Math.min(4194304, Math.floor(require("os").totalmem()/2048)))')
if timeout --kill-after=1s 5s mount -t tmpfs -o "size=${cap_kib}k,mode=1777,nosuid,nodev" cland-suite /tmp >/dev/null 2>&1; then
  kind=tmpfs
  fallback=null
else
  kind=disk
  fallback='"tmpfs mount unavailable"'
fi
printf '{"root":"/tmp","kind":"%s","capBytes":%s,"fallback":%s}\n' "$kind" "$((cap_kib*1024))" "$fallback" >"$run/temp.json.tmp"
chmod 644 "$run/temp.json.tmp"
mv "$run/temp.json.tmp" "$run/temp.json"
