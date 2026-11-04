#!/bin/sh
# Start with: setsid nohup sh supervisor.sh RUN_DIR COMMAND [ARG ...] </dev/null >>supervisor.log 2>&1 &
# COMMAND and its arguments contain no credentials; supply secrets through the environment.
set -eu
# --check uses the same native PID/birth proof as singleton admission.
mode=start
if [ "${1:-}" = --check ]; then mode=check; shift; fi
[ "$#" -ge 1 ] || exit 2
run_dir=$1
shift
lock=$run_dir/supervisor.lock
live_supervisor() {
    pid=$(cat "$lock/pid" 2>/dev/null || true)
    birth=$(cat "$lock/birth" 2>/dev/null || true)
    case "$pid" in ''|*[!0-9]*) current='' ;; *) current=$(LC_ALL=C TZ=UTC ps -p "$pid" -o lstart= 2>/dev/null || true) ;; esac
    [ -n "$birth" ] && [ "$current" = "$birth" ] && kill -0 "$pid" 2>/dev/null
}
if [ "$mode" = check ]; then live_supervisor; exit $?; fi
[ "$#" -ge 1 ] || { echo 'usage: supervisor.sh RUN_DIR COMMAND [ARG ...]' >&2; exit 2; }
umask 077
mkdir -p "$run_dir"
chmod 700 "$run_dir"
if ! mkdir "$lock" 2>/dev/null; then
    if live_supervisor; then
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
verifier=$(dirname "$0")/package.ts
node=${CLAND_HOST_NODE:-node}
agent_birth() {
    "$1" --input-type=module -e 'const {pathToFileURL}=await import("node:url");const {observeProcesses}=await import(pathToFileURL(process.argv[1]).href);const row=(await observeProcesses([Number(process.argv[2])],process.env)).get(Number(process.argv[2]));if(row?.identity&&!row.ended)process.stdout.write(row.identity);' "$(dirname "$verifier")/native.ts" "$2"
}
selected_version=$("$node" -e 'try{const p=require("node:path"),f=process.argv[1];if(f.endsWith("/entry.ts"))process.stdout.write(JSON.parse(require("node:fs").readFileSync(p.resolve(p.dirname(f),"../../../../agent-manifest.json"),"utf8")).version);}catch{}' -- "${2:-}")
while :; do
    "$@" </dev/null &
    agent=$!
    birth=$(agent_birth "$node" "$agent" 2>/dev/null || true)
    code=$run_dir/../code
    # Requests contain a version, never a PID. Only this loop owns the child.
    while kill -0 "$agent" 2>/dev/null; do
        if [ -f "$code/restart" ]; then
            version=$(cat "$code/restart")
            case "$version" in ''|*[!a-zA-Z0-9._-]*|.*) version='' ;; esac
            if [ -n "$version" ] && [ "$version" = "$selected_version" ] && [ -n "$birth" ]; then
                "$node" --input-type=module -e 'const {pathToFileURL}=await import("node:url");const {checkpoint}=await import(pathToFileURL(process.argv[1]).href);await checkpoint(process.argv[2],{version:process.argv[3],pid:Number(process.argv[4]),identity:process.argv[5],outcome:"already-selected"});' "$(dirname "$verifier")/storage.ts" "$code/restart-result.json" "$version" "$agent" "$birth"
                rm -f "$code/restart"
                continue
            fi
            if [ -n "$version" ] && "$node" --input-type=module -e 'const {pathToFileURL}=await import("node:url");const {verifyAgentPackage}=await import(pathToFileURL(process.argv[1]).href);await verifyAgentPackage(process.argv[2],process.argv[3]);' "$verifier" "$code/$version" "$version"; then
                if ! "$node" --input-type=module -e 'const {pathToFileURL}=await import("node:url");const {signalAgentChild}=await import(pathToFileURL(process.argv[1]).href);if(!await signalAgentChild(Number(process.argv[2]),process.argv[3],process.env))process.exit(1);' "$(dirname "$verifier")/restart.ts" "$agent" "$birth"; then
                    echo 'agent restart birth unavailable or changed; nothing signalled' >&2
                    sleep 0.2
                    continue
                fi
                selected_version=$version
                verifier=$code/$version/hub/src/host/agent/package.ts
                set -- "$node" "$code/$version/hub/src/host/agent/entry.ts"
                rm -f "$code/restart"
                break
            fi
        fi
        state=$(ps -p "$agent" -o stat= 2>/dev/null || true)
        case "$state" in ''|*Z*) break ;; esac
        sleep 0.2
    done
    # wait reaps only our direct child; harnesses are in independent sessions.
    wait "$agent" || true
    sleep 1
done
