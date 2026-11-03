#!/bin/sh
# Start with: setsid nohup sh supervisor.sh RUN_DIR COMMAND [ARG ...] </dev/null >>supervisor.log 2>&1 &
# COMMAND and its arguments contain no credentials; supply secrets through the environment.
set -eu
[ "$#" -ge 2 ] || { echo 'usage: supervisor.sh RUN_DIR COMMAND [ARG ...]' >&2; exit 2; }
run_dir=$1
shift
umask 077
mkdir -p "$run_dir"
chmod 700 "$run_dir"
lock=$run_dir/supervisor.lock
if ! mkdir "$lock" 2>/dev/null; then
    # A PID alone proves nothing: compare its native birth as well. Never signal it.
    pid=$(cat "$lock/pid" 2>/dev/null || true)
    birth=$(cat "$lock/birth" 2>/dev/null || true)
    case "$pid" in ''|*[!0-9]*) current='' ;; *) current=$(LC_ALL=C TZ=UTC ps -p "$pid" -o lstart= 2>/dev/null || true) ;; esac
    if [ -n "$birth" ] && [ "$current" = "$birth" ] && kill -0 "$pid" 2>/dev/null; then
        echo 'supervisor already running' >&2
    else
        echo 'supervisor lock stale or incomplete; verify owner absence before removing lock' >&2
    fi
    exit 1
fi
trap '' HUP
# Remove only our own lock on normal exit; never infer signal authority from disk.
trap 'rm -f "$lock/pid" "$lock/birth"; rmdir "$lock"' 0
LC_ALL=C TZ=UTC ps -p "$$" -o lstart= > "$lock/birth"
printf '%s\n' "$$" > "$lock/pid"
while :; do
    "$@" </dev/null &
    agent=$!
    # wait reaps only our direct child; harnesses are in independent sessions.
    wait "$agent" || true
    sleep 1
done
