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
finish() {
  code=$?
  trap - EXIT TERM INT
  timeout --kill-after=1s 3s node "$run/health.ts" finish "$run" >>"$run/suite.log" 2>&1 || echo 'suite machine health unavailable: final sample failed' >>"$run/suite.log"
  echo "$code" >"$run/exit"
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
timeout --kill-after=10s "${seconds}s" bash >>"$run/suite.log" 2>&1 <<'COMMANDS'
set -e
while ! mkdir /tmp/cland-suite.lock 2>/dev/null; do sleep 1; done
trap "rmdir /tmp/cland-suite.lock 2>/dev/null || true" EXIT
@COMMANDS@
COMMANDS
