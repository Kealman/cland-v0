#!/bin/bash
# cland-auth mount|umount|freeze|thaw <volume-name> /cland/auth/<harness>-<login>
# /cland/auth must remain root-owned. No operation follows a symlink mount point.
set -eu
[[ "$#" = 3 ]] || { echo 'expected operation, volume and mount point' >&2; exit 2; }
op="$1"; vol="$2"; dir="$3"
case "$op" in mount|umount|freeze|thaw) ;; *) echo 'unknown operation' >&2; exit 2 ;; esac
[[ "$vol" =~ ^[a-z][a-z0-9-]{0,63}$ ]] || { echo 'bad volume name' >&2; exit 2; }
[[ "$dir" =~ ^/cland/auth/[a-z][a-z0-9]*-[a-z0-9][a-z0-9-]*$ ]] || { echo 'bad mount point' >&2; exit 2; }
[[ ! -L "$dir" ]] || { echo 'symlink mount point' >&2; exit 2; }
[[ ! -L /cland && ! -L /cland/auth ]] || { echo 'symlink mount ancestor' >&2; exit 2; }
dev="/dev/disk/by-id/scsi-0DO_Volume_$vol"
# All helper operations share one root-owned lock, including different aliases or volumes.
# No caller can detach/rebind a mount while another operation owns it.
lock=/cland/auth/.operation.lock
exec 9>"$lock"
flock -x -w 30 9 || { echo 'login-disk operation busy' >&2; exit 5; }
[[ ! -L "$dir" ]] || { echo 'symlink mount point' >&2; exit 2; }
identity=''
read_mount() {
  local row source
  row=$(findmnt -rn -M "$dir" -o ID,SOURCE) || { echo 'mount observation failed' >&2; return 3; }
  [[ "$row" =~ ^[0-9]+[[:space:]][^[:space:]]+$ ]] || { echo 'missing or ambiguous mount' >&2; return 3; }
  source=${row#* }
  [[ "$source" = "$dev" || "$source" = "$(readlink -f "$dev")" ]] || { echo 'wrong mounted volume' >&2; return 3; }
  printf '%s' "$row"
}
admit_mount() { identity=$(read_mount); }
check_source() {
  local current
  current=$(read_mount) || return 3
  [[ "$current" = "$identity" ]] || { echo 'mount identity changed' >&2; return 3; }
}
# Silent psmisc fuser: 0 is users, 1 with empty output is no users.
# Other statuses or any diagnostic are incomplete census, never absence.
probe_writers() {
  local status=0 message
  check_source || return 3
  # This shell holds fd 9 on the lock. A successful positive census must see it.
  message=$(fuser -s "$lock" 2>&1) || status=$?
  if [[ "$status" != 0 || -n "$message" ]]; then
    printf 'writer census control incomplete (exit %s): %.2000s\n' "$status" "$message" >&2
    return 6
  fi
  message=$(fuser -s -m -M "$dir" 2>&1) || status=$?
  if [[ -n "$message" || "$status" -gt 1 ]]; then
    printf 'writer census incomplete (exit %s): %.2000s\n' "$status" "$message" >&2
    return 6
  fi
  check_source || return 3
  [[ "$status" = 1 ]] && return 10
  return 0
}
signal_writers() {
  local status=0 message
  check_source || return 3
  message=$(fuser -k -"$1" -m -M "$dir" 2>&1) || status=$?
  if [[ "$status" != 0 && ( "$status" != 1 || -n "$message" ) ]]; then
    printf 'writer signal incomplete (exit %s): %.2000s\n' "$status" "$message" >&2
    return 6
  fi
}
drain() {
  local signal attempt status
  for signal in TERM KILL; do
    status=0; probe_writers || status=$?
    [[ "$status" = 10 ]] && return 0
    [[ "$status" = 0 ]] || return "$status"
    signal_writers "$signal" || return $?
    for ((attempt=0; attempt<20; attempt++)); do
      status=0; probe_writers || status=$?
      [[ "$status" = 10 ]] && return 0
      [[ "$status" = 0 ]] || return "$status"
      sleep 0.25
    done
  done
  echo 'writers remain on login disk' >&2; return 4
}
case "$op" in
  mount)
    for ((attempt=0; attempt<120; attempt++)); do [[ -e "$dev" ]] && break; sleep 0.25; done
    [[ -e "$dev" ]] || { echo 'volume device unavailable' >&2; exit 3; }
    # Provider images may automount the device at /mnt/<volume>. Drain every
    # observed mount through the same identity fence used by explicit umount.
    target="$dir"
    status=0
    others=$(findmnt -rn -S "$dev" -o TARGET) || status=$?
    [[ "$status" = 0 || ( "$status" = 1 && -z "$others" ) ]] || { echo 'device mount census failed' >&2; exit 3; }
    while IFS= read -r other; do
      [[ -n "$other" ]] || continue
      [[ "$other" = /* && "$other" != *\\* ]] || { echo 'ambiguous mount path' >&2; exit 3; }
      [[ "$other" != "$target" ]] || continue
      dir="$other"
      admit_mount
      drain
      sync
      check_source
      umount "$dir"
    done <<< "$others"
    dir="$target"
    mkdir -p "$dir"
    status=0; mountpoint -q "$dir" || status=$?
    case "$status" in
      0) admit_mount ;;
      32) mount -o defaults,noatime,discard "$dev" "$dir"; admit_mount ;;
      *) echo 'mountpoint observation failed' >&2; exit 3 ;;
    esac
    check_source
    chown runner:runner "$dir"
    check_source
    chmod 700 "$dir"
    ;;
  umount)
    admit_mount
    drain
    sync
    check_source
    umount "$dir"
    rmdir "$dir" 2>/dev/null || true
    ;;
  freeze) admit_mount; sync; check_source; fsfreeze -f "$dir" ;;
  thaw) admit_mount; check_source; fsfreeze -u "$dir" ;;
esac
