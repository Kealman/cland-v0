#!/bin/sh
# qa-record.sh: run one QA case, or record one manual check, as one line of .cland/qa/runs.jsonl.
#
#   sh qa-record.sh run  <item> <run> <case-id>
#       headless-grid: runs qa/cases/<case-id>.lua with `cland --headless --qa`, evidence in .cland/qa/<item>/<run>/
#   sh qa-record.sh note <item> <run> <case-id> <surface> <method> <PASS|FAIL|INCONCLUSIVE|BLOCKED> [evidence-file...]
#       surfaces: headless-grid, tmux, web-terminal, hub-api, real-browser; records what you ran and saw
#       real-browser: computer-use method and screenshot paths; note never launches a browser
#   sh qa-record.sh recover <item> <run> <temp-dir> <lines-file>
#       the Coordinator's, for a rescue run: copies the captures its lines name from <temp-dir> into
#       .cland/qa/<item>/<run>/ and appends each line with its evidence paths rewritten there, but only a line whose
#       captures were all copied and verified; a line that cannot be recovered is reported, never appended
#
# Run it from the item's worktree. The line goes to stdout and is appended to <project>/.cland/qa/runs.jsonl;
# where that file cannot be written (a rescue run), the line is still on stdout and the last line says so.
# QA_SESSION names who ran it in the line (default $CLAND_SESSION_NAME, else rescue): a rescue run sets it to rescue-<job id>.
# Evidence goes to .cland/qa/<item>/<run>/, or, where that cannot be written, to $TMPDIR/cland-qa-evidence/<item>/<run>/.
#
# Partial failure (the script appends nothing twice and never edits a line): a case that ran but whose line could
# not be appended still prints it, with "NOT recorded" on the last stderr line: append it by hand, do not rerun.
# A rerun appends new lines, so use a new run id for it. Evidence files without a line are harmless leftovers.
# Exit code: 0 PASS, 1 FAIL, 2 INCONCLUSIVE or BLOCKED; 64 a bad argument; 70 the line could not be serialized (nothing
# is appended; the outcome and the captures' directory are on stderr); recover: 71 the evidence directory cannot be made
# (nothing appended), 73 some lines were not recovered (the rest were; stderr names each loss). recover never deletes a source.
# CLAND is the path of the cland executable (default: cland).
# An item has one uppercase kind prefix and digits (T-12, E-423, or a configured planning kind); run and case ids are one safe path component: letters, digits, . _ - and not starting with . or -.
set -u

die() { echo "qa-record: $*" >&2; exit 64; }
command -v jq >/dev/null 2>&1 || die "jq is needed"

mode=${1:-}; item=${2:-}; run=${3:-}; case_id=${4:-}
[ -n "$case_id" ] || die "usage: qa-record.sh run <item> <run> <case-id> | note <item> <run> <case-id> <surface> <method> <result> [evidence...] | recover <item> <run> <temp-dir> <lines-file>"
# the ids become path components of the evidence tree: nothing that could leave it
case $item in [A-Z]-[0-9]*) case ${item#*-} in *[!0-9]*) die "the item is a kind prefix and digits, not $item";; esac;; *) die "the item is a kind prefix and digits, not $item";; esac
safe_id() { case $2 in ''|[!A-Za-z0-9]*|*[!A-Za-z0-9._-]*) die "$1 must be one safe path component (letters, digits, . _ -, starting with a letter or digit), not '$2'";; esac; }
safe_id run "$run"
[ "$mode" = recover ] || safe_id case "$case_id"

# the project's .cland: where the hub is, or where Git's common directory says the main worktree is
if [ -n "${CLAND_HUB_FILE:-}" ]; then
  cland_dir=$(dirname "$CLAND_HUB_FILE")
else
  common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || die "not in a Git worktree and no CLAND_HUB_FILE"
  cland_dir=$(dirname "$common")/.cland
fi
cland_dir=$(cd "$cland_dir" 2>/dev/null && pwd -P) || die "no .cland directory at $cland_dir"
root=$(dirname "$cland_dir")
evidence_dir=$cland_dir/qa/$item/$run
build=$(git rev-parse HEAD 2>/dev/null || echo unknown)
session=${QA_SESSION:-${CLAND_SESSION_NAME:-rescue}}
ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
executor=local
lifetime=null
cost=null
diagnostics='{}'
if [ -n "${QA_DEMO_EPIC:-}" ]; then
  demo=$("${CLAND:-cland}" demo status "$QA_DEMO_EPIC" --json) || die "cannot read demo lease"
  build=$(printf '%s\n' "$demo" | jq -er '.commit') || die "demo has no commit"
  executor=droplet
  lifetime=$(printf '%s\n' "$demo" | jq -c '.lifetimeMs')
  cost=$(printf '%s\n' "$demo" | jq -c '.costUsd')
fi

if [ "$mode" = recover ]; then
  temp_dir=$case_id; lines_file=${5:-}
  [ -d "$temp_dir" ] || die "recover: $temp_dir is not a directory"
  [ -n "$lines_file" ] && [ -r "$lines_file" ] || die "recover: cannot read the lines file '$lines_file'"
  dest=$evidence_dir
  reldir=${dest#"$root"/}
  if ! mkdir -p "$dest" 2>/dev/null || [ ! -d "$dest" ] || [ ! -w "$dest" ]; then
    echo "qa-record: recover: cannot make $dest; nothing appended, nothing copied. The captures stay in $temp_dir and the lines in $lines_file" >&2
    exit 71
  fi
  lost=0; appended=0; n=0
  while IFS= read -r raw || [ -n "$raw" ]; do
    n=$((n + 1))
    [ -n "$raw" ] || continue
    if ! rline=$(printf '%s\n' "$raw" | jq -ce --arg item "$item" --arg run "$run" 'select(type == "object" and .item == $item and .run == $run)' 2>/dev/null) || [ -z "$rline" ]; then
      echo "qa-record: recover: line $n is not a runs line of $item $run, not appended: $raw" >&2; lost=$((lost + 1)); continue
    fi
    # an extraction that fails is a lost line, never an empty list: empty output would read as "nothing to copy"
    if ! label=$(printf '%s\n' "$rline" | jq -r '.case' 2>/dev/null) || [ -z "$label" ]; then
      echo "qa-record: recover: line $n: could not read its case, not appended: $raw" >&2; lost=$((lost + 1)); continue
    fi
    if ! paths=$(printf '%s\n' "$rline" | jq -r '(.evidence // [])[]' 2>/dev/null); then
      echo "qa-record: recover: $label: could not read its evidence list, line not appended; its captures stay in $temp_dir" >&2; lost=$((lost + 1)); continue
    fi
    line_ok=1; seen=""
    while IFS= read -r p; do
      [ -n "$p" ] || continue
      b=${p##*/}
      case $b in ''|.|..) echo "qa-record: recover: $label: bad capture path '$p'" >&2; line_ok=0; continue;; esac
      case " $seen " in *" $b "*) echo "qa-record: recover: $label: two captures are named $b" >&2; line_ok=0; continue;; esac
      seen="$seen $b"
      src=$temp_dir/$b
      if [ ! -f "$src" ]; then echo "qa-record: recover: $label: capture missing: $src" >&2; line_ok=0; continue; fi
      if [ -d "$dest/$b" ] || { [ -e "$dest/$b" ] && ! cmp -s "$src" "$dest/$b"; }; then echo "qa-record: recover: $label: $dest/$b already exists with other content" >&2; line_ok=0; continue; fi
      if [ "$src" -ef "$dest/$b" ]; then continue; fi
      if ! cp -- "$src" "$dest/$b" 2>/dev/null || ! cmp -s "$src" "$dest/$b"; then echo "qa-record: recover: $label: could not copy $src to $dest/$b" >&2; line_ok=0; continue; fi
    done <<EOF_PATHS
$paths
EOF_PATHS
    if [ "$line_ok" != 1 ]; then echo "qa-record: recover: $label: line not appended; its captures stay in $temp_dir" >&2; lost=$((lost + 1)); continue; fi
    if ! out_line=$(printf '%s\n' "$rline" | jq -c --arg dir "$reldir" '.evidence |= ((. // []) | map($dir + "/" + (split("/") | last)))' 2>/dev/null) || [ -z "$out_line" ] || ! mkdir -p "$cland_dir/qa" 2>/dev/null || ! printf '%s\n' "$out_line" >> "$cland_dir/qa/runs.jsonl" 2>/dev/null; then
      echo "qa-record: recover: $label: could not rewrite or append the line to $cland_dir/qa/runs.jsonl; the copied captures are in $dest, the original line is in $lines_file" >&2; lost=$((lost + 1)); continue
    fi
    appended=$((appended + 1))
  done < "$lines_file"
  echo "qa-record: recover: $appended line(s) appended, $lost not appended (sources in $temp_dir are untouched)" >&2
  if [ "$lost" -gt 0 ]; then exit 73; fi
  exit 0
fi

case $mode in
  run)
    surface=headless-grid
    method="cland --headless --qa qa/cases/$case_id.lua"
    if ! { mkdir -p "$evidence_dir" 2>/dev/null && [ -w "$evidence_dir" ]; }; then
      evidence_dir=${TMPDIR:-/tmp}/cland-qa-evidence/$item/$run
      mkdir -p "$evidence_dir" 2>/dev/null && [ -w "$evidence_dir" ] || evidence_dir=""
    fi
    # the case's own flags and the directory are separate arguments, so a path with spaces or globs stays one
    if [ -n "${QA_DEMO_EPIC:-}" ]; then
      [ -n "$evidence_dir" ] || die "demo captures need a writable local evidence directory"
      printed=$(node "$(dirname "$0")/qa-demo-record.ts" "${CLAND:-cland}" "$QA_DEMO_EPIC" "$case_id" "$evidence_dir"); code=$?
      method="cland demo exec $QA_DEMO_EPIC -- cland --headless --qa qa/cases/$case_id.lua"
    elif [ -n "$evidence_dir" ]; then
      printed=$("${CLAND:-cland}" --headless --qa "qa/cases/$case_id.lua" --out "$evidence_dir"); code=$?
    else
      printed=$("${CLAND:-cland}" --headless --qa "qa/cases/$case_id.lua"); code=$?
      echo "qa-record: no evidence directory could be made: the case's inline captures follow, and the line has none:" >&2
      printf '%s\n' "$printed" >&2
    fi
    result=$(printf '%s\n' "$printed" | tail -n 1 | jq -r '.result // empty' 2>/dev/null)
    if [ -z "$result" ]; then result=BLOCKED; [ "$code" -ge 2 ] || code=2; printed='{"evidence":[]}'; fi
    evidence=$(printf '%s\n' "$printed" | tail -n 1 | jq -c '(.evidence // []) | if type == "array" then . else [] end' 2>/dev/null)
    if [ -n "${QA_DEMO_EPIC:-}" ]; then
      diagnostics=$(printf '%s\n' "$printed" | tail -n 1 | jq -c '{message, stderr, remote_output} | with_entries(select(.value != null))' 2>/dev/null) || diagnostics='{}'
    fi
    ;;
  note)
    surface=${5:-}; method=${6:-}; result=${7:-}
    [ -n "$method" ] || die "note needs <surface> <method> <result>"
    case $surface in headless-grid|tmux|web-terminal|hub-api|real-browser) ;; *) die "surface is headless-grid, tmux, web-terminal, hub-api or real-browser";; esac
    case $result in PASS) code=0;; FAIL) code=1;; INCONCLUSIVE|BLOCKED) code=2;; *) die "result is PASS, FAIL, INCONCLUSIVE or BLOCKED";; esac
    shift 7 2>/dev/null || shift $#
    evidence=$(printf '%s\n' "$@" | jq -R -s -c 'split("\n") | map(select(length > 0))')
    ;;
  *) die "the first argument is run or note" ;;
esac

line=$(jq -cn --arg ts "$ts" --arg item "$item" --arg run "$run" --arg case "$case_id" --arg build "$build" \
  --arg surface "$surface" --arg method "$method" --arg result "$result" --argjson code "$code" \
  --arg executor "$executor" --argjson lifetime "$lifetime" --argjson cost "$cost" \
  --argjson evidence "${evidence:-null}" --argjson diagnostics "$diagnostics" --arg root "$root/" --arg session "$session" \
  '{ts: $ts, item: $item, run: $run, case: $case, build: $build, surface: $surface, method: $method, result: $result,
    exit_code: $code, executor: $executor, lifetime_ms: $lifetime, cost_usd: $cost, evidence: ($evidence | map(ltrimstr($root))), session: $session} + $diagnostics' 2>/dev/null)
# never append what is not one JSON object: keep the outcome and the captures, say where, and stop
if [ -z "$line" ] || ! printf '%s\n' "$line" | jq -e 'type == "object"' >/dev/null 2>&1; then
  echo "qa-record: could not serialize the runs.jsonl line, nothing appended. Outcome: $item $run $case_id $result (exit $code); captures: ${evidence_dir:-none}" >&2
  exit 70
fi

printf '%s\n' "$line"
if mkdir -p "$cland_dir/qa" 2>/dev/null && printf '%s\n' "$line" >> "$cland_dir/qa/runs.jsonl" 2>/dev/null; then
  echo "qa-record: recorded in $cland_dir/qa/runs.jsonl" >&2
else
  echo "qa-record: NOT recorded (cannot write $cland_dir/qa/runs.jsonl): the Coordinator appends the line above" >&2
fi
exit "$code"
