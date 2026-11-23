#!/usr/bin/env bash
# Uploaded with only the host's suite selection, worker policy and colour variables.
set -u
run="$HOME/runs/@RUN_ID@"
# The open descriptor retains admission through shell/child lifetime. A marker
# with no launched process is repairable after a disconnected start command.
exec 9>"$run/start.lock"
flock -n 9 || exit 0
if test -f "$run/done" || test -f "$run/pgid"; then exit 0; fi
: >"$run/started"
echo $$ >"$run/pgid"
cat "$run/delivery.log" >"$run/suite.log"
export CLAND_SUITE_CAUSE_FILE="$run/cause"
: >"$CLAND_SUITE_CAUSE_FILE"
# Advisory timing receipt: both boundaries use this machine's UTC clock.
# Missing evidence leaves calibration unchanged; it must never block a run.
printf '\n' >>"$run/suite.log" || true
date -u +'suite runner started %Y-%m-%dT%H:%M:%SZ' >>"$run/suite.log" || true
finish() {
  code=$?
  trap - EXIT TERM INT
  # Keep the native status receipt for existing readers. Completion still
  # requires done, and an incomplete package remains fenced until release.
  echo "$code" >"$run/exit"
  if test -f "$run/package-pending" && ! test -f "$run/package-closed"; then
    # The producer records the native foreground exit, not inferred log text.
    # No done marker: the lease owner must confirm machine deletion first.
    printf '%s\n' "$code" >"$run/package-incomplete.tmp"
    mv "$run/package-incomplete.tmp" "$run/package-incomplete"
    printf '\nsuite package closure {"state":"incomplete","nativeExit":%s}\n' "$code" >>"$run/suite.log"
    return
  fi
  # The foreground timeout has closed the sole metrics writer. Keep command
  # output (even without a newline) separate from complete metric records.
  timeout --kill-after=1s 3s node "$run/health.ts" append "$run" >>"$run/suite.log" 2>&1 || {
    append_exit=$?
    printf '\nsuite machine metrics-incomplete {"version":1,"stage":"append","exit":%s}\n' "$append_exit" >>"$run/suite.log"
  }
  timeout --kill-after=1s 3s node "$run/health.ts" finish "$run" >>"$run/suite.log" 2>&1 || echo 'suite machine health unavailable: final sample failed' >>"$run/suite.log"
  # The package owner writes cause directly. Older runners leave it empty.
  echo "Finished: exit $code" >>"$run/suite.log"
  date -u +%Y-%m-%dT%H:%M:%SZ >"$run/done.tmp" && mv "$run/done.tmp" "$run/done"
}
trap finish EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
cd "$HOME/cland" || exit 1
node -e 'const os=require("os"),fs=require("fs"); let nvim="none";try{nvim=fs.readFileSync("nvim/NVIM_VERSION","utf8").trim()}catch{};console.log(JSON.stringify({os:os.platform(),arch:os.arch(),release:os.release(),node:process.version,nvim}))' >"$run/platform.tmp" || exit 1
mv "$run/platform.tmp" "$run/platform" || exit 1
source "$run/env"
export TMPDIR=/tmp TMP=/tmp TEMP=/tmp
# Probe the disk-backed receipt directory and the suite filesystem separately.
# Its bound is independent of the package timeout and cannot redden the suite.
timeout --kill-after=1s 10s node "$run/health.ts" start "$run" >>"$run/suite.log" 2>&1 || echo 'suite machine health unavailable: startup probe failed or exceeded 10s' >>"$run/suite.log"
# A machine has its own locks. No host lease identity crosses the boundary.
seconds=@RUN_TIMEOUT@
if (( seconds <= 0 )); then exit 124; fi
: >"$run/package-pending"
# The sampler lives inside the existing foreground package timeout. There is
# no independent sampler child or unbounded shutdown wait. The supervisor
# observes TERM/INT before launch; uncertainty hands closure to the machine.
# The supervisor owns the admitted deadline. This outer bound is a shutdown
# backstop, leaving its two-second handoff time before native forced cleanup.
timeout --kill-after=10s "$(( ${seconds%.*} + 6 ))s" node "$run/health.ts" supervise "$run" "$seconds" >>"$run/suite.log" 2>&1 <<'COMMANDS'
set -e
while ! mkdir /tmp/cland-suite.lock 2>/dev/null; do sleep 1; done
trap "rmdir /tmp/cland-suite.lock 2>/dev/null || true" EXIT
@COMMANDS@
COMMANDS
