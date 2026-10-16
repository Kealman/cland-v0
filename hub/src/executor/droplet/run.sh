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
# A machine has its own locks. No host lease identity crosses the boundary.
seconds=@RUN_TIMEOUT@
if (( seconds <= 0 )); then exit 124; fi
timeout --kill-after=10s "${seconds}s" bash >>"$run/suite.log" 2>&1 <<'COMMANDS'
set -e
while ! mkdir /tmp/cland-suite.lock 2>/dev/null; do sleep 1; done
trap "rmdir /tmp/cland-suite.lock 2>/dev/null || true" EXIT
@COMMANDS@
COMMANDS
