# Stage QA brief: E-1531 stage 3 — routing by host, the territory branch and the boundary

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$B:h` or `$S:q` as a modifier). The run is local, on macOS (BSD `sed -i ''`, Node 24 with `node:sqlite`). No browser, no GUI and no real harness: the scratch hub runs the fake `claude`, `codex` and `opencode` of `hub/test/fakes/`. This is the epic's last stage and its QA scope is `full`: the run checks this stage's items in depth, E-1531's combined behaviour over all three stages, and E-1531's Definition of done criterion by criterion where a stage run can check it.

## Stage

- Epic: E-1531 (The Host interface and the local host, under R-1530).
- Exact stage name: routing by host, the territory branch and the boundary.
- Items, in plan order by lane: lane 1 T-1554 (Liveness, stop and signals routed by the row's host), then T-1556 (Claude Code found once on another host); lane 2 T-1555 (The item's task branch in the territory before its worktree); lane 3 T-1557 (The adapters' boundary lint). The run reads the stage's members, counts and state from `task plan show E-1531` (E1531S3-00), never from a number written here. Findings fixes added to this stage after writing are listed in the request; none at writing.
- Policy: full/after-stage.
- Scope: E-1531's complete QA scope at the tested build. In depth, this stage's changed behaviour:
  - T-1554: a row's liveness, stop, signals and pending-stop recovery go only to the Host its `host` column names; a row on another host is alive or stoppable only when that Host reports the recorded `linux:<boot id>:<start ticks>` identity for its pid; a row naming an unregistered host is never probed or signalled on the hub's machine and shows `stateReason` `unknown host` with `state` `unknown`; no local pid is probed or signalled for a remote row even when it collides with a live local process; local rows keep today's checks, the legacy `pid_started` fallback included.
  - T-1556: a Claude Code row on a Host other than `local` runs one `claude agents --json` per launch and at most one per restart resume; its timers run only the Host's liveness and never a `claude` command; a relaunch drains a predecessor's query first; a missing launch pid stays supervised as `running` with `harness-pid-unknown`; local rows keep today's `agents --json` schedule. Two T-1554 poll cases of `hub/test/session-host-routing.test.ts` were migrated to the no-timer contract under Coordinator decision 77fb0104 (2026-11-02 03:22Z): their names changed and they assert no discovery.
  - T-1555: an item launch creates its task branch `t/<id>-<slug>` in the territory (`.cland/territory.git`) under the territory lock before the launch Host's worktreeAdd. Coordinator amendment of A-15078 (message 457bead1, 2026-11-02 02:00Z): on `local` the task base is the root's `dev` tip, unpublished commits included, pushed into the territory; on a nonlocal Host it is the territory's `dev` tip. An existing territory task branch supplies its tip on either Host. A failed worktreeAdd leaves no territory branch. The territory records a launch-created branch in `branch.<name>.clandLaunchBase`, and prune deletes such a branch only while it still equals that base. On `local` the root branch, its tip, the worktree path and the `task-worktree` journal record are as before.
  - T-1557: `hub/test/host-boundary.test.ts` is an ordinary enforcing T1 source-invariant test (Coordinator decision 24c7ee88; not a rule-27 gate). It passes on the build and fails, naming file, line and use, when an adapter value-imports `node:child_process`, calls `process.kill` outside the two `CLAND_TEST_CRASH_AT` self-kills, imports a native liveness/identity/cwd helper, or imports `stat`, `lstat` or `realpath` from `node:fs`.
  - Regression over stages 1 and 2 (T-1542 to T-1553): the Host contract suite on `local`; session launch, stop and resume of all three fake harnesses on `local`; task worktree add, remove and occupancy; artifact path reads; the `host` column; the test host `t1`; placement refusals for the Coordinator and the Aide (T-1553: refused at launch, relaunch, fresh resume, role set and handover with `Coordinator and Aide roles run only on the local host`).
- Decisions and references: `docs/spec/v0.4.md` §3.1; E-1531's Contents, Constraints and Definition of done; the coord decisions on T-1555 (457bead1), T-1556 (77fb0104) and T-1557 (24c7ee88) recorded in those item files; `hub/README.md` "Local Host files, worktrees and polling"; `docs/agents/claude-code-hooks.md` (nonlocal discovery); `docs/agents/issue-tracker.md` (task preparation); `docs/agents/session-permissions.md` "Local-only role placement". The previous stage's brief `qa/briefs/E-1531-stage-2.md` passed QA as run qa-s2-2026-11-02-qa678-1 at 6fe6289c98a43c2c1153414528b6821907ff84f6; this brief reuses its setup.

Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

### Criteria map

The stage verdict carries no item or epic marks; this tells the run which check proves what.

| criterion | proven by |
| --- | --- |
| T-1554 C1 | E1531S3-03 (startup, poll, resume and stop reach only the named Host); E1531S3-21 (real hub: every operation of the planted row's window is a `t1:` operation) |
| T-1554 C2 | E1531S3-03 (`hub/test/session-host.test.ts` Linux-birth cases, the generated per-harness stop cases) |
| T-1554 C3 | E1531S3-03 (`hub/test/host-registry.test.ts`); E1531S3-21 and E1531S3-22 (a row on an unregistered host reads `unknown host`, its stop is refused, the colliding local process is untouched) |
| T-1554 C4 | E1531S3-03 (in-process hub with a spy `local` host: startup, poll, `session stop`, `session resume` and the orphan sweep); E1531S3-21 (real hub: the colliding local process is never signalled) |
| T-1554 C5 | E1531S3-03 (projectHub frame stop); E1531S3-21 (the same through the CLI on a real scratch hub) |
| T-1554 C6 | E1531S3-01 (preserved files unedited); E1531S3-03; E1531S3-12 and E1531S3-13 (local rows) |
| T-1556 C1 | E1531S3-04 (one discovery per launch, relaunch drains its predecessor) |
| T-1556 C2 | E1531S3-04 (timers use only Host liveness; missing pid); E1531S3-03 (the migrated poll cases) |
| T-1556 C3 | E1531S3-04 (generated restart-resume cases) |
| T-1556 C4 | E1531S3-01 (`hub/test/claude-code-schedule.test.ts` unedited); E1531S3-04; E1531S3-12 (real hub: the local `agents` schedule keeps running) |
| T-1555 C1, C2 | E1531S3-05 (branch in the territory at the base before the Host's worktreeAdd, under the lock; the admitted Host is called); E1531S3-14 |
| T-1555 C3 | E1531S3-05 (local baseline); E1531S3-14 (same branch, tip and worktree path on a real hub) |
| T-1555 C4 | E1531S3-05; E1531S3-16 (a pre-existing territory branch supplies its tip on a real hub) |
| T-1555 C5 | E1531S3-05; E1531S3-18 (a refused worktreeAdd on `t1` leaves no territory or root branch) |
| T-1555 C6 | E1531S3-01, E1531S3-05 |
| T-1555 amendment (local root base, nonlocal territory base, prune only unchanged) | E1531S3-05 (`divergent dev tips` and prune cases); E1531S3-14 (local root base with an unpublished commit), E1531S3-15 (unchanged launch-created branch deleted), E1531S3-17 (pushed work kept) |
| T-1557 C1, C2 | E1531S3-09 (fixture sources of each kind); E1531S3-10 (planted bypasses in a scratch copy of the adapters) |
| T-1557 C3 | E1531S3-09 (passes on the build); E1531S3-10 (fails on the planted copy, naming file and use) |
| Stages 1 and 2 (T-1542 to T-1553) | E1531S3-01, E1531S3-02, E1531S3-06 to E1531S3-08; scratch rows E1531S3-11 to E1531S3-15, E1531S3-19 to E1531S3-22 |

### Definition of done, criterion by criterion

Stage QA records no epic criterion marks; the epic's Definition of done is a separate run (qa skill, "After-stage QA"). This table says what this run checks of each criterion, so the demo can rely on it.

| DoD criterion | checked here | not checked here, with reason |
| --- | --- | --- |
| C1. Every Host operation has a contract test; `local` passes them all | E1531S3-02 (the `hostContract` cases on `local`, the coverage test that fails on an uncovered member) | nothing |
| C2. Adapters, worktree code and artifact path reads act only through their Host; all three harnesses behave as before | E1531S3-09, E1531S3-10 (the boundary), E1531S3-02 to E1531S3-08 (named tests), E1531S3-12, E1531S3-13 (launch, liveness, restart resume and stop of all three on `local`), E1531S3-14, E1531S3-15 (worktree), E1531S3-19 (artifacts) | the "green full suite" of the DoD demo: QA runs no full suite; the stage covers and the epic occasion do |
| C3. `host` column; existing rows `local`; a remote row never probed or signalled locally | E1531S3-11 (`hostColumn`), E1531S3-12 (rows `local`), E1531S3-21, E1531S3-22 (a planted `t1` row whose pid is a live local process: never signalled; an unregistered host's row: `unknown`), E1531S3-03 (no local probe, by the spy `local` host) | a local signal-0 probe is not observable on a real hub; the in-process spy of E1531S3-03 is its only proof |
| C4. Codex sandbox roots and paths handed to a harness come from the Host's realpath | E1531S3-06 (`hub/test/codex-sandbox-host.test.ts`), E1531S3-07 (macOS native Seatbelt Git file); E1531S3-14 records the Codex item session's launch arguments (recorded, not judged) | the DoD demo's reading of a live session's sandbox roots: this brief has no verified probe of the fake Codex thread's permission profile, so it is left to the demo; the named tests cover the behaviour |
| C5. An item launch creates its task branch in the territory before its Host adds the worktree | E1531S3-05 (ordering and lock with a recording Host), E1531S3-14 (on a real hub the territory ref exists, equals the root branch, the worktree HEAD and its launch base) | the ordering itself is observable only with a recording Host (E1531S3-05); a real hub shows the end state |
| C6. The hub refuses a non-`local` placement for the Coordinator and the Aide | E1531S3-08 (named and generated cases), E1531S3-20 (frames: launch refused), E1531S3-21 (`role set` onto a `t1` row refused) | nothing |
| DoD preamble: "records a clear verdict on this epic with each checkbox verified; the epic then closes" | none | out of scope: a stage verdict carries no epic marks; the epic DoD run records them |

## Build

Use a clean detached worktree at the full dev SHA named in the request: `<dev SHA>` (40 hex). HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt: for every member that `task plan show E-1531` lists in stage `routing by host, the territory branch and the boundary`, `git log --first-parent --format=%H --grep "^Item: <id>$" <dev SHA>` prints exactly one commit; stages 1 and 2 must read `closed`. At writing, dev was `9423e6fd93c87ff501e3d66c4f453eaf86a2302b` and these had landed: T-1557 `e061c395520bce620bc70747ec894cc573da6ac5`, T-1554 `fa5e2b180e9f0ca831c02aac7964d311f7ac308d`, T-1555 `5eb24394b40357707aab85fe3c69a19c5080c373`. T-1556 was in review on `t/T-1556-claude-code-found-once-on-another-host` at head `dc7d07ac8e77509b503c898c1de2a42e547ceb02`; its expectations below were read from that head and must be re-checked with grep at the tested build. A dirty build, missing required merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no run id on purpose.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step (the setup below does; the clean-tree checks ignore that one entry). No row needs `web/dist`: no item of this epic changed `web/`.

**Isolation (rule 15).** Every scratch check runs in a disposable project with its own HOME, XDG directories and Git config, with provider and account variables removed. Never the live project at `/Users/evgeniyivanov/Projects/cland/v0`, its hub, its `hub.db`, its territory `.cland/territory.git`, or the human's HOME (`~/.cland`, `~/.claude`, `~/.codex`, `~/.local/state`, `~/.config/cland`). The live hub is read only by QA's own shell for E1531S3-00's plan read and `quiet` (cover-quiet admission); the live repository is read only by `git log`, `git diff` and `git archive`. **Harnesses:** only the fakes in `$W/hub/test/fakes/` run, named by `CLAND_CLAUDE_BIN`, `CLAND_CODEX_BIN` and `CLAND_OPENCODE_BIN` and first on the scratch hub's `PATH`; no real Claude Code, Codex or OpenCode, no login, no provider. **Browser (rule 18):** none. **Preconditions (rule 22):** every check function prints a `PRE:` line before acting; when that line differs from the row's stated precondition, record the row `BLOCKED` with the line and stop the dependent rows. Messages and test titles are marked verified or inferred under "Source provenance" below; an inferred string is never a pass condition.

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree, runs `quiet` and the plan read, and records every check with `qa-record.sh`. **Every other command runs sealed** inside a subshell that sources `$Q/env.sh`: the full `fixtureEnvironment` result (`test-support/fixture-environment.ts`) after the scratch overlays. It drops every inherited `CLAND_*`, `GIT_*`, `XDG_*`, `CLAUDE_*`, `CODEX_*`, `OPENCODE_*`, `FAKE_*`, provider and account variable, keeps `PATH`, `SHELL`, `TERM` and `TMPDIR`, and synthesizes its own scratch values (HOME, XDG, `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, the `FAKE_*_HOME` directories, `CLAND_EXECUTOR_STATE`, the messenger sentinels and `CLAND_TEST_OWNED_ROOT`, all under `$Q`). Leave `TMPDIR` at the system default (on macOS `/var/folders/...`; never `/tmp`, T-1030). Never use `env -i`. The scratch root lives under `/private/tmp/qa-e1531s3-` (its realpath, short enough for the scratch hub's socket).

One scratch project, **p1**: a fresh `cland init` project on `dev`, with an empty `node_modules` directory at its root (excluded from Git through `.git/info/exclude`, so worktreeAdd has a root install to link), its own territory at `p1/.cland/territory.git`, and a CLI-started hub run from the tested worktree with the fakes first on its `PATH`, the machine-wide orphan sweep off, and `CLAND_TEST_HOSTS=t1` until E1531S3-22 restarts it without the variable. Its clients are the CLI (the scratch human), and socket frame clients saying `client: "nvim"` (the human's Neovim connection) for the `session.launch` frames that carry `host`, since no CLI flag carries it. One scratch copy, **plant**: the adapters and the boundary test only, extracted from the tested SHA with `git archive`, where E1531S3-10 plants forbidden uses.

In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<dev SHA>                                    # the full dev SHA from the request
RUN=qa-s3-$(date +%F)-1                        # unique run id for E-1531; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e1531s3-$RUN          # the clean detached build
EV=$R/.cland/qa/E-1531/$RUN                    # captures (qa-record.sh keeps its evidence here too)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
Q=$(cd "$(mktemp -d /tmp/qa-e1531s3-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/qa-e1531s3-…
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data" "$Q/xdg/cache" "$Q/p1" "$Q/plant" "$Q/art/folder/sub" "$Q/fake-claude" "$Q/fake-codex" "$Q/fake-opencode" "$Q/claude" "$Q/codex"
: > "$Q/pids"                                  # the fixture-owned process census: every scratch pid is appended here
: > "$Q/home/.gitconfig"
holder() { (cd "$W" && node hub/bin/cland.ts verify queue --json) | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);console.log((v.holder?.session??v.holder?.kind??"none")+" waiters "+(v.waiters??[]).length)})'; }
quiet() { for i in $(seq 1 10); do h=$(holder) && case "$h" in "none "*) echo quiet; return 0;; esac; sleep 60; done; echo "BLOCKED: the verify slot is not free after 10 minutes: ${h:-queue read failed}"; return 1; }
# ld: the one-minute load must be below 10 before each test file (docs/agents/tests.md load rule); prints free disk space too
ld() { for i in $(seq 1 10); do l=$(sysctl -n vm.loadavg | awk '{print $2}'); if awk -v l="$l" 'BEGIN{exit !(l<10)}'; then echo "load $l; free kB $(df -k "${TMPDIR:-/var/tmp}" | awk 'NR==2{print $4}')"; return 0; fi; sleep 60; done; echo "BLOCKED: one-minute load not below 10 after 10 minutes: $l"; return 1; }
# nt <id> <test files…>: named test files from $W, sealed, one file at a time, TAP output, after quiet and ld; the log is $EV/<id>.log
nt() { id=$1; shift; quiet || return 1; : > "$EV/$id.log"; for f in "$@"; do ld >> "$EV/$id.log" || { tail -n 1 "$EV/$id.log"; return 1; }; ( . "$Q/env.sh"; cd "$W" && node --test --test-concurrency=1 --test-reporter=tap "$f" >> "$EV/$id.log" 2>&1; echo "exit $? $f" >> "$EV/$id.log" ); done; grep -E '^exit ' "$EV/$id.log"; grep -E '^ *not ok|# SKIP' "$EV/$id.log" | head -20; }
# oks <id>: the names on the passing (sub)test lines of $EV/<id>.log
oks() { grep -E '^ *ok [0-9]+ - ' "$EV/$1.log" | sed -E 's/^ *ok [0-9]+ - //'; }
```

The sealed environment. Apply the full `fixtureEnvironment` result after the scratch overlays, including its synthesized HOME, Git, account and fake-harness paths; do not merely unset keys absent from it. Remove the broader credential prefixes last. The generated shell first unsets dropped inherited names and then exports every retained value; never print or post those exports. Under rule 15, check zero credential-prefix names before launching any scratch process (the last lines below print a count and variable names only, never values).

```sh
node --input-type=module - "$W/test-support/fixture-environment.ts" "$Q" "$W" "$EV" > "$Q/env.sh" <<'JS'
const [m,root,worktree,ev]=process.argv.slice(2);
const {fixtureEnvironment}=await import(m);
const env=fixtureEnvironment(root,process.env,{
  XDG_CONFIG_HOME: `${root}/xdg/config`, XDG_STATE_HOME: `${root}/xdg/state`,
  XDG_DATA_HOME: `${root}/xdg/data`, XDG_CACHE_HOME: `${root}/xdg/cache`,
  GIT_AUTHOR_NAME: 'qa', GIT_AUTHOR_EMAIL: 'qa@example.invalid',
  GIT_COMMITTER_NAME: 'qa', GIT_COMMITTER_EMAIL: 'qa@example.invalid',
  QA_W: worktree, QA_Q: root, QA_EV: ev,
});
for(const k of Object.keys(env))if(/^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)/.test(k))delete env[k];
const quote=value=>"'"+value.replaceAll("'", "'\\''")+"'";
for(const k of Object.keys(process.env).sort())if(!(k in env)&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(k))console.log(`unset ${k}`);
for(const [k,v] of Object.entries(env))if(/^[A-Za-z_][A-Za-z0-9_]*$/.test(k))console.log(`export ${k}=${quote(v)}`);
JS
cat >> "$Q/env.sh" <<'ENV'
FCC=$QA_W/hub/test/fakes/claude-code; FCX=$QA_W/hub/test/fakes/codex; FOC=$QA_W/hub/test/fakes/opencode
cland() { node "$QA_W/hub/bin/cland.ts" "$@"; }
# probe <mode> [args…]: the frame/db/log probe against p1 (see probe.mjs)
probe() { node "$QA_Q/probe.mjs" "$1" "$QA_Q/p1" "${@:2}"; }
# pick <expr> [args…]: evaluate <expr> on the JSON read from stdin as v, with the extra args as A
pick() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);const A=process.argv.slice(2);const r=eval(process.argv[1]);console.log(typeof r==="string"?r:JSON.stringify(r))})' "$@"; }
# hp: the pid in this project's .cland/hub.json (the secret is never read out)
hp() { node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(".cland/hub.json","utf8")).pid)+"\n")'; }
# hubstart [NAME=value…]: start this project's hub with the fakes authoritative and first on its PATH, no machine-wide orphan sweep; census its pid
hubstart() { env PATH="$FCC:$FCX:$FOC:$PATH" CLAND_CLAUDE_BIN="$FCC/claude" CLAND_CODEX_BIN="$FCX/codex" CLAND_OPENCODE_BIN="$FOC/opencode" CLAND_TEST_SKIP_ORPHAN_SWEEP=1 CLAND_ADAPTER_POLL_MS=200 CLAND_CLAUDE_AGENTS_MS=500 "$@" node "$QA_W/hub/bin/cland.ts" hub start && hp >> "$QA_Q/pids"; }
# off: the current byte size of p1's hub log, the start of a log window
off() { wc -c < .cland/log/hub.log | tr -d ' '; }
up() { cland hub status > /dev/null 2>&1 && echo up || echo down; }
# srow <name>: "<status> <state> <pid|none>" of a session row, or "absent"
srow() { cland session list --json | pick 'const p=v.processes.find(p=>p.name===A[0]);p?[p.status,p.state,p.pid??"none"].join(" "):"absent"' "$1"; }
# waitrun <name> <seconds>: until the row is running with a pid; censuses the pid
waitrun() { n=0; while [ "$n" -lt "$2" ]; do r=$(srow "$1"); case "$r" in "running "*" none") ;; "running "*) echo "${r##* }" >> "$QA_Q/pids"; echo "$1: $r"; return 0;; esac; sleep 1; n=$((n+1)); done; echo "$1: timeout after $2 s, last $r"; return 1; }
# waitstop <name> <seconds>: until the row is stopped and its recorded pid no longer exists
waitstop() { n=0; while [ "$n" -lt "$2" ]; do r=$(srow "$1"); p=${r##* }; case "$r" in "stopped "*) if [ "$p" = none ] || ! kill -0 "$p" 2>/dev/null; then echo "$1: stopped, process gone"; return 0; fi;; esac; sleep 1; n=$((n+1)); done; echo "$1: not stopped after $2 s, last $r"; return 1; }
# wrow <item>: that item's row of cland worktree list
wrow() { cland worktree list --json | pick 'const w=v.worktrees.find(w=>w.item===A[0]);w?{state:w.state,branch:w.branch,sessions:w.sessions}:"absent"' "$1"; }
# tref / rref <branch>: the branch's tip in p1's territory / in p1's root, or none; lbase <branch>: its territory launch base, or none
tref() { git -C .cland/territory.git rev-parse --verify --quiet "refs/heads/$1" || echo none; }
rref() { git rev-parse --verify --quiet "refs/heads/$1" || echo none; }
lbase() { git -C .cland/territory.git config --get "branch.$1.clandLaunchBase" || echo none; }
# same <a> <b>: yes when both are the same non-none value
same() { [ "$1" != none ] && [ "$1" = "$2" ] && echo yes || echo no; }
# agents: the number of `claude agents` invocations the fake Claude Code recorded, or absent
agents() { f="$FAKE_CLAUDE_HOME/invocations.jsonl"; if [ -f "$f" ]; then grep -c '"subcommand":"agents"' "$f"; else echo absent; fi; }
# trapalive: the planted collision process (E1531S3-21) and the signals it caught
trapalive() { P=$(cat "$QA_Q/trap.pid"); echo "trap $P alive $(kill -0 "$P" 2>/dev/null && echo yes || echo no) command $(ps -o comm= -p "$P" 2>/dev/null || echo none); caught signals $( [ -f "$QA_Q/sig.log" ] && wc -l < "$QA_Q/sig.log" | tr -d ' ' || echo 0)"; }
ENV
( . "$Q/env.sh"; env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)' )
( . "$Q/env.sh"; env | cut -d= -f1 | grep -E '^CLAND_' | sort | tr '\n' ' '; echo )
```

The probe. It prints one JSON line per fact and never prints the hub secret. Mode `plant` writes rows into the scratch `hub.db` through the build's own `ProcessTable` (the same `put` that T-1554's routing file uses) and refuses while the scratch hub runs.

```sh
cat > "$Q/probe.mjs" <<'JS'
// node "$QA_Q/probe.mjs" <mode> <p1 root> [arg]   (sealed)
// frames <JSON array of frames> | rows | hostlog <byte offset> | plant <JSON array of rows>
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
const [mode, root, arg] = process.argv.slice(2);
const Q = process.env.QA_Q;
if (!Q || !root || !root.startsWith(`${Q}/`)) { console.log(JSON.stringify({ refused: 'not a scratch project' })); process.exit(2); }
appendFileSync(`${Q}/pids`, `${process.pid}\n`);
const out = (key, value) => console.log(JSON.stringify({ [key]: value }));
async function frames(list) {
  const d = JSON.parse(readFileSync(`${root}/.cland/hub.json`, 'utf8'));
  const s = createConnection(d.socket); s.setEncoding('utf8'); s.on('error', () => {});
  await once(s, 'connect');
  let buf = '', next = 0, welcome = null;
  const send = () => { const f = list[next]; s.write(`${JSON.stringify({ ...f, id: `q${next + 1}` })}\n`); };
  await new Promise(resolve => {
    const timer = setTimeout(() => { out('timeout', `after q${next}`); resolve(); }, 90000 * list.length);
    s.on('data', chunk => {
      buf += chunk; let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        let f; try { f = JSON.parse(line); } catch { continue; }
        if (f.type === 'welcome' && welcome === null) { welcome = f.name; out('welcome', welcome); send(); }
        else if (f.type === 'error') { out('error', String(f.message)); clearTimeout(timer); resolve(); }
        else if (f.type === 'result' && f.id === `q${next + 1}`) {
          const fr = list[next];
          const p = f.ok ? f.value?.process : null;
          out(f.id, { name: fr.name, role: fr.role ?? null, host: fr.host ?? null, item: fr.item ?? null, ok: f.ok, code: f.code ?? null, error: f.error ?? null, process: p ? { name: p.name, status: p.status, hostField: Object.hasOwn(p, 'host') } : null });
          next += 1;
          if (next === list.length) { clearTimeout(timer); resolve(); } else send();
        }
      }
    });
    s.write(`${JSON.stringify({ type: 'hello', protocol: 2, secret: d.secret, client: 'nvim' })}\n`);
  });
  s.end();
}
switch (mode) {
  case 'frames': await frames(JSON.parse(arg)); break;
  case 'rows': {
    const db = new DatabaseSync(`${root}/.cland/hub.db`, { readOnly: true });
    try {
      out('hostColumn', db.prepare('pragma table_info(harness_processes)').all().some(c => c.name === 'host'));
      for (const r of db.prepare('select name, host, harness, role, status, pid, pid_identity from harness_processes order by name').all()) {
        let alive = null;
        if (r.pid) { try { process.kill(r.pid, 0); alive = true; } catch (e) { alive = e.code === 'EPERM'; } }
        out('row', { name: r.name, host: r.host, harness: r.harness, role: r.role, status: r.status, pid: r.pid, identity: String(r.pid_identity ?? 'none').split(':')[0], alive });
      }
    } finally { db.close(); }
    break;
  }
  case 'hostlog': {
    await new Promise(r => setTimeout(r, 1000));
    const text = readFileSync(`${root}/.cland/log/hub.log`).subarray(Number(arg)).toString('utf8');
    const ops = [], closes = [];
    for (const line of text.split('\n')) {
      let e; try { e = JSON.parse(line); } catch { continue; }
      if (e.event === 'test-host-operation') ops.push(`${e.host}:${e.operation}`);
      if (e.event === 'host-spawn-log-close-failed') closes.push(e.pid);
    }
    out('testHostOps', ops); out('logCloseDiagnostics', closes);
    break;
  }
  case 'plant': {
    if (existsSync(`${root}/.cland/hub.json`)) {
      const pid = JSON.parse(readFileSync(`${root}/.cland/hub.json`, 'utf8')).pid;
      let running = false; try { process.kill(pid, 0); running = true; } catch {}
      if (running) { out('refused', 'the scratch hub is running'); process.exit(2); }
    }
    const { ProcessTable } = await import(`${process.env.QA_W}/hub/src/adapters/processes.ts`);
    const table = new ProcessTable(`${root}/.cland/hub.db`);
    try {
      for (const r of JSON.parse(arg)) {
        table.put({ role: null, model: null, cwd: root, harnessId: null, harnessSessionId: null, startedAt: new Date().toISOString(), status: 'running', pidStarted: null, ...r });
        out('planted', { name: r.name, host: r.host, pid: r.pid });
      }
    } finally { table.close(); }
    break;
  }
  default: out('refused', `unknown mode ${mode}`); process.exit(2);
}
JS
node --check "$Q/probe.mjs" && echo "probe checked"
```

The check functions. Define them in QA's own shell (paste the block once). Rows that run in p1 call them as `( . "$Q/env.sh"; cd "$Q/p1" && <function> ) > "$EV/<id>.txt" 2>&1`; read the capture, then record it.

```sh
STAGE3='routing by host, the territory branch and the boundary'
m00() {   # QA's own shell: build, membership, landings
  echo "PRE: HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) want $S"
  echo "dirty entries $(git -C "$W" status --porcelain | grep -v -x '?? node_modules' | wc -l | tr -d ' ')"
  (cd "$R" && node hub/bin/cland.ts task plan show E-1531 --json) > "$EV/E1531S3-00-plan.json"
  node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));for(const s of p.stages)console.log(JSON.stringify({name:s.name,state:s.state,qa:s.qa,items:s.items,merged:s.merged,total:s.total,statuses:s.statuses}))' "$EV/E1531S3-00-plan.json"
  for id in $(node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(p.stages.find(x=>x.name===process.argv[2]).items.join(" "))' "$EV/E1531S3-00-plan.json" "$STAGE3"); do
    echo "$id landings: $(git -C "$R" log --first-parent --format=%H --grep "^Item: $id\$" "$S" | tr '\n' ' ')"; done
}
kept() {  # kept <id> <files…>: the item's landing edited none of the named preserved test files
  id=$1; shift; L=$(git -C "$W" log --first-parent --format=%H --grep "^Item: $id\$" HEAD)
  echo "$id ($L) edited preserved files: $(git -C "$W" diff --name-only "$L^1" "$L" -- "$@" | wc -l | tr -d ' ')"
}
m01() {   # QA's own shell, read-only in $W: preserved tests and source boundaries
  echo "PRE: HEAD $(git -C "$W" rev-parse HEAD)"
  kept T-1554 hub/test/session-stop-races.test.ts hub/test/session-async-processes.test.ts
  kept T-1555 hub/test/task-worktrees.test.ts hub/test/task-worktrees-lifecycle.test.ts hub/test/territory-cli.test.ts hub/test/worktree-cli.test.ts
  kept T-1556 hub/test/claude-code-schedule.test.ts
  L=$(git -C "$W" log --first-parent --format=%H --grep '^Item: T-1556$' HEAD)
  echo "T-1556 migrated routing file (approved exception, recorded not judged): $(git -C "$W" diff --stat "$L^1" "$L" -- hub/test/session-host-routing.test.ts | tail -n 1)"
  kept T-1542 hub/test/process-identity.test.ts hub/test/system-processes.test.ts hub/test/session-async-processes.test.ts
  kept T-1543 hub/test/account-poller.test.ts hub/test/account-poller-clock.test.ts
  kept T-1544 hub/test/session-launch.test.ts hub/test/session-resume.test.ts hub/test/session-stop-races.test.ts hub/test/session-async-processes.test.ts hub/test/session-cwd.test.ts
  kept T-1545 hub/test/opencode-adapter.test.ts hub/test/opencode-native.test.ts
  kept T-1546 hub/test/codex-adapter.test.ts hub/test/codex-delivery.test.ts hub/test/codex-native.test.ts hub/test/codex-workspace-git.test.ts
  kept T-1547 hub/test/claude-code-adapter.test.ts hub/test/claude-code-sessions.test.ts hub/test/claude-code-schedule.test.ts hub/test/claude-code-accounts.test.ts hub/test/claude-code-environment.test.ts
  kept T-1549 hub/test/task-worktrees.test.ts hub/test/task-worktrees-lifecycle.test.ts hub/test/worktree-cli.test.ts hub/test/territory-lock.test.ts
  kept T-1550 hub/test/task-worktrees.test.ts hub/test/worktree-cli.test.ts
  kept T-1551 hub/test/artifacts.test.ts hub/test/artifact-create-unit.test.ts hub/test/artifact-folders.test.ts hub/test/artifact-upload.test.ts hub/test/artifact-cli.test.ts
  kept T-1552 hub/test/orphan-servers.test.ts hub/test/orphan-sweep-lock.test.ts hub/test/session-async-processes.test.ts
  kept T-1553 hub/test/role-launch.test.ts hub/test/roles-launch-permissions.test.ts hub/test/session-launch.test.ts
  ( cd "$W"
    echo "process.kill: $(grep -c 'process\.kill' hub/src/adapters/opencode.ts hub/src/adapters/opencode/server.ts hub/src/adapters/codex.ts hub/src/adapters/claude-code.ts | tr '\n' ' ')"
    echo "boundary tier: $(grep -c -F '"hub/test/host-boundary.test.ts": "T1"' hub/test/tiers.json)"
    echo "nonlocal timer guard: $(grep -c -F 'Subscription logins on other hosts must never run a CLI from a timer.' hub/src/adapters/claude-code.ts)"
    echo "territory launch base key: $(grep -c -F 'clandLaunchBase' hub/src/territory.ts)"
    echo "placement message in source: $(grep -c -F 'Coordinator and Aide roles run only on the local host' hub/src/host/role-placement.ts)"
    echo "unknown-host state in source: $(grep -c -F "unknownHost ? 'unknown host'" hub/src/adapters/sessions.ts)"
    echo "README T-1554: $(grep -c -F 'Remote liveness and stop use only that row' <(cat docs/hub/*.md))"
    echo "README T-1555: $(grep -c -F 'Task launch creates a missing task branch in the territory' <(cat docs/hub/*.md))"
    echo "README T-1556: $(grep -c -F 'Claude Code rows on a Host other than' <(cat docs/hub/*.md))"
    echo "README T-1557: $(grep -c -F 'lint recursively scans adapter source' <(cat docs/hub/*.md))"
    echo "hooks doc T-1556: $(grep -c -F 'On a nonlocal Host, launch discovers the worker once' docs/agents/claude-code-hooks.md)"
    echo "tracker doc T-1555: $(grep -c -F 'Task preparation creates a missing task branch in the territory' docs/agents/issue-tracker.md)"
    echo "web files changed by E-1531 landings: $(for id in T-1542 T-1543 T-1544 T-1545 T-1546 T-1547 T-1548 T-1549 T-1550 T-1551 T-1552 T-1553 T-1554 T-1555 T-1556 T-1557; do L=$(git log --first-parent --format=%H --grep "^Item: $id\$" HEAD); git diff --name-only "$L^1" "$L" -- web; done | wc -l | tr -d ' ')" )
}
m10() {   # QA's own shell for the copy, sealed for the test: the boundary test fails on planted bypasses
  echo "PRE: plant entries $(ls -A "$Q/plant" | wc -l | tr -d ' ')"
  git -C "$R" archive "$S" package.json hub/package.json hub/src/adapters hub/test/host-boundary.ts hub/test/host-boundary.test.ts | tar -x -C "$Q/plant"; echo "archive exit $?"
  ln -s "$R/node_modules" "$Q/plant/node_modules"
  A=$Q/plant/hub/src/adapters
  printf "\nimport { realpath as qaPlantedRealpath } from 'node:fs/promises';\n" >> "$A/codex.ts"
  printf "\nimport { spawn as qaPlantedSpawn } from 'node:child_process';\n" >> "$A/sessions.ts"
  printf "\nprocess.kill(12345, 0);\n" >> "$A/claude-code.ts"
  mkdir "$A/qa-planted"; printf "import { endProcess } from '../../system-processes.ts';\n" > "$A/qa-planted/future.ts"
  echo "planted lines: codex $(grep -c qaPlantedRealpath "$A/codex.ts") sessions $(grep -c qaPlantedSpawn "$A/sessions.ts") claude-code $(grep -c -F 'process.kill(12345, 0)' "$A/claude-code.ts") nested $(grep -c endProcess "$A/qa-planted/future.ts")"
  : > "$EV/E1531S3-10.log"; ld >> "$EV/E1531S3-10.log" || return 1
  ( . "$Q/env.sh"; cd "$Q/plant" && node --test --test-concurrency=1 --test-reporter=tap hub/test/host-boundary.test.ts >> "$EV/E1531S3-10.log" 2>&1; echo "test exit $?" )
  echo "not ok: $(grep -E '^ *not ok [0-9]+ - ' "$EV/E1531S3-10.log" | sed -E 's/^ *not ok [0-9]+ - //' | tr '\n' '|')"
  for p in 'codex\.ts:[0-9]+: realpath import bypasses Host' 'sessions\.ts:[0-9]+: child_process value import bypasses Host' 'claude-code\.ts:[0-9]+: process\.kill bypasses Host' 'qa-planted/future\.ts:1: endProcess import bypasses Host'; do echo "diagnostic [$p]: $(grep -c -E "$p" "$EV/E1531S3-10.log")"; done
}
m11() {   # p1: init on dev, root node_modules, hub start with test host t1
  echo "PRE: p1 entries $(ls -A | wc -l | tr -d ' '); fakes $(ls "$FCC/claude" "$FCX/codex" "$FOC/opencode" | wc -l | tr -d ' ')"
  git init -q -b main && echo qa > README.md && git add README.md && git commit -q -m init
  cland init . > "$QA_EV/E1531S3-11-init.txt" 2>&1; echo "init exit $?"
  [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; cland hub stop > /dev/null 2>&1
  git switch -q dev; echo "branch $(git branch --show-current)"
  sed -i '' -e "s|^lock_path = .*|lock_path = \"$QA_Q/p1-suite.lock\"|" -e 's|^executor = .*|executor = "local"|' .cland/config.toml
  echo "lock $(grep -c -x "lock_path = \"$QA_Q/p1-suite.lock\"" .cland/config.toml) executor $(grep -c -x 'executor = "local"' .cland/config.toml)"
  git add -A && git commit -q -m "QA scratch config"
  mkdir node_modules && printf 'node_modules\n' >> .git/info/exclude
  echo "dirty entries $(git status --porcelain | wc -l | tr -d ' ')"
  echo "territory $(test -d .cland/territory.git && echo present || echo absent); territory dev $(tref dev)"
  hubstart CLAND_TEST_HOSTS=t1; echo "hub start exit $?"
  probe rows
}
m12() {   # p1: one session per harness on local; liveness; the local Claude Code agents schedule; resume across a hub restart
  echo "PRE: hub $(up); rows $(probe rows | grep -c '"row"')"
  o=$(off)
  for h in claude-code codex opencode; do
    cland session launch "qa-$h" --harness "$h" > "$QA_EV/E1531S3-12-$h.txt" 2>&1; echo "launch $h exit $?"
    waitrun "qa-$h" 120
  done
  cland session list --json > "$QA_EV/E1531S3-12-list.json"; echo "list exit $?; host keys $(grep -o '"host"' "$QA_EV/E1531S3-12-list.json" | wc -l | tr -d ' ')"
  probe rows
  probe hostlog "$o"
  a1=$(agents); sleep 10; a2=$(agents); echo "local agents invocations: before $a1 after $a2"
  for h in claude-code codex opencode; do r=$(srow "qa-$h"); echo "$h ${r##* }"; done > "$QA_Q/before-restart"
  cland hub stop; echo "hub stop exit $?"
  echo "rows while the hub is down:"; probe rows
  o=$(off)
  hubstart CLAND_TEST_HOSTS=t1; echo "hub start exit $?"
  for h in claude-code codex opencode; do waitrun "qa-$h" 60; r=$(srow "qa-$h"); echo "qa-$h pid before $(awk -v h="$h" '$1==h{print $2}' "$QA_Q/before-restart") after ${r##* }"; done
  probe rows
  probe hostlog "$o"
}
m13() {   # p1: stop each through the Host
  echo "PRE: $(for h in claude-code codex opencode; do printf 'qa-%s %s; ' "$h" "$(srow "qa-$h")"; done)"
  o=$(off)
  for h in claude-code codex opencode; do
    cland session stop "qa-$h" > "$QA_EV/E1531S3-13-$h.txt" 2>&1; echo "stop $h exit $?"
    waitstop "qa-$h" 30
  done
  probe rows
  probe hostlog "$o"
}
m14() {   # p1: a local item launch makes its task branch in the territory from root dev (unpublished commit included)
  echo "PRE: hub $(up); worktrees: $(cland worktree list)"
  ID=$(cland task create "QA host item" --size S --json | pick 'v.item.id'); echo "item $ID"; echo "$ID" > "$QA_Q/item"
  BR="t/$ID-qa-host-item"
  git commit -q --allow-empty -m "QA unpublished root commit"; U=$(git rev-parse dev); TD=$(tref dev)
  echo "root dev $U; territory dev $TD; differ $([ "$U" != "$TD" ] && echo yes || echo no)"
  echo "before launch: territory $(tref "$BR"); root $(rref "$BR"); launch base $(lbase "$BR")"
  o=$(off)
  cland session launch qa-wt --role implementer --harness codex --item "$ID" --json > "$QA_EV/E1531S3-14-launch.json" 2>&1; echo "launch exit $?"
  pick '({path: v.worktree?.path ?? null, branch: v.worktree?.branch ?? null, claim: v.claim?.session ?? null, reason: v.reason ?? null})' < "$QA_EV/E1531S3-14-launch.json"
  waitrun qa-wt 120
  T=$(tref "$BR"); H=$(git -C ".cland/worktrees/$ID" rev-parse HEAD 2>/dev/null || echo none)
  echo "territory ref equals root branch $(same "$T" "$(rref "$BR")"); equals worktree HEAD $(same "$T" "$H"); equals launch base $(same "$T" "$(lbase "$BR")")"
  echo "territory ref contains the unpublished root commit $(git -C .cland/territory.git merge-base --is-ancestor "$U" "$T" 2>/dev/null && echo yes || echo no)"
  echo "territory ref is territory dev $(same "$T" "$TD"); territory dev unchanged $(same "$(tref dev)" "$TD")"
  echo "dir $(test -d ".cland/worktrees/$ID" && echo present || echo absent)"
  echo "node_modules link $(readlink ".cland/worktrees/$ID/node_modules")"
  echo "git worktrees naming it $(git worktree list --porcelain | grep -c -x "worktree $PWD/.cland/worktrees/$ID")"
  echo "branches $(git branch --list "t/$ID-*" --format='%(refname:short)' | tr '\n' ' ')"
  wrow "$ID"
  probe rows | grep '"qa-wt"'
  P=$(srow qa-wt); P=${P##* }; [ -f "$FAKE_CODEX_HOME/log/$P.log" ] && grep -E 'app-server|thread/start' "$FAKE_CODEX_HOME/log/$P.log" > "$QA_EV/E1531S3-14-codex-args.txt"; echo "codex launch arguments recorded $(test -s "$QA_EV/E1531S3-14-codex-args.txt" && echo yes || echo no)"
  probe hostlog "$o"
}
m15() {   # p1: prune refuses while the session stands inside; after the stop it removes the worktree and the unchanged launch-created territory branch
  ID=$(cat "$QA_Q/item"); BR="t/$ID-qa-host-item"; echo "PRE: $ID qa-wt $(srow qa-wt); dir $(test -d ".cland/worktrees/$ID" && echo present || echo absent); territory $( [ "$(tref "$BR")" = none ] && echo none || echo present)"
  cland task close "$ID" > "$QA_EV/E1531S3-15-close.txt" 2>&1; echo "close exit $?"
  cland worktree prune --yes > "$QA_EV/E1531S3-15-prune1.txt" 2>&1; echo "prune (inside) exit $?"; cat "$QA_EV/E1531S3-15-prune1.txt"
  echo "dir $(test -d ".cland/worktrees/$ID" && echo present || echo absent); territory $( [ "$(tref "$BR")" = none ] && echo none || echo present)"
  cland session stop qa-wt > "$QA_EV/E1531S3-15-stop.txt" 2>&1; echo "stop exit $?"; waitstop qa-wt 30
  wrow "$ID"
  cland worktree prune --yes > "$QA_EV/E1531S3-15-prune2.txt" 2>&1; echo "prune exit $?"; cat "$QA_EV/E1531S3-15-prune2.txt"
  echo "dir $(test -d ".cland/worktrees/$ID" && echo present || echo absent)"
  echo "root branches $(git branch --list "t/$ID-*" | wc -l | tr -d ' '); territory $(tref "$BR"); launch base $(lbase "$BR")"
  echo "git worktrees naming it $(git worktree list --porcelain | grep -c -x "worktree $PWD/.cland/worktrees/$ID")"
}
m16() {   # p1: a pre-existing territory task branch supplies the worktree's tip, gets no launch base, and survives prune
  ID2=$(cland task create "QA existing item" --size S --json | pick 'v.item.id'); echo "item $ID2"
  BR="t/$ID2-qa-existing-item"
  TT=$(git -C .cland/territory.git commit-tree "$(git -C .cland/territory.git rev-parse 'dev^{tree}')" -p dev -m "QA territory work")
  git -C .cland/territory.git branch "$BR" "$TT"
  echo "PRE: hub $(up); territory branch planted $(same "$(tref "$BR")" "$TT"); root $(rref "$BR"); launch base $(lbase "$BR")"
  o=$(off)
  cland session launch qa-wt2 --role implementer --harness codex --item "$ID2" --json > "$QA_EV/E1531S3-16-launch.json" 2>&1; echo "launch exit $?"
  echo "launched branch is the planted one $( [ "$(pick 'v.worktree?.branch ?? "none"' < "$QA_EV/E1531S3-16-launch.json")" = "$BR" ] && echo yes || echo no)"
  waitrun qa-wt2 120
  echo "worktree HEAD is the territory tip $(same "$(git -C ".cland/worktrees/$ID2" rev-parse HEAD 2>/dev/null || echo none)" "$TT"); root branch is the territory tip $(same "$(rref "$BR")" "$TT"); launch base $(lbase "$BR")"
  cland session stop qa-wt2 > "$QA_EV/E1531S3-16-stop.txt" 2>&1; echo "stop exit $?"; waitstop qa-wt2 30
  cland task close "$ID2" > "$QA_EV/E1531S3-16-close.txt" 2>&1; echo "close exit $?"
  cland worktree prune --yes > "$QA_EV/E1531S3-16-prune.txt" 2>&1; echo "prune exit $?"; cat "$QA_EV/E1531S3-16-prune.txt"
  echo "dir $(test -d ".cland/worktrees/$ID2" && echo present || echo absent); root branch $(rref "$BR"); territory kept at its tip $(same "$(tref "$BR")" "$TT")"
  probe hostlog "$o"
}
m17() {   # p1: work pushed to a launch-created territory branch is kept at prune
  ID3=$(cland task create "QA pushed item" --size S --json | pick 'v.item.id'); echo "item $ID3"
  BR="t/$ID3-qa-pushed-item"
  echo "PRE: hub $(up); territory $(tref "$BR"); root $(rref "$BR")"
  cland session launch qa-wt3 --role implementer --harness codex --item "$ID3" --json > "$QA_EV/E1531S3-17-launch.json" 2>&1; echo "launch exit $?"
  echo "launched branch is the expected one $( [ "$(pick 'v.worktree?.branch ?? "none"' < "$QA_EV/E1531S3-17-launch.json")" = "$BR" ] && echo yes || echo no)"
  waitrun qa-wt3 120
  L=$(lbase "$BR"); echo "launch base equals territory ref $(same "$L" "$(tref "$BR")")"
  git -C ".cland/worktrees/$ID3" commit -q --allow-empty -m "QA pushed work"; PW=$(git -C ".cland/worktrees/$ID3" rev-parse HEAD)
  git -C ".cland/worktrees/$ID3" push -q origin "$BR"; echo "push exit $?"
  echo "territory at the pushed work $(same "$(tref "$BR")" "$PW")"
  cland session stop qa-wt3 > "$QA_EV/E1531S3-17-stop.txt" 2>&1; echo "stop exit $?"; waitstop qa-wt3 30
  cland task close "$ID3" > "$QA_EV/E1531S3-17-close.txt" 2>&1; echo "close exit $?"
  cland worktree prune --yes > "$QA_EV/E1531S3-17-prune.txt" 2>&1; echo "prune exit $?"; cat "$QA_EV/E1531S3-17-prune.txt"
  echo "dir $(test -d ".cland/worktrees/$ID3" && echo present || echo absent); territory kept at the pushed work $(same "$(tref "$BR")" "$PW"); launch base after prune $(lbase "$BR")"
}
m18() {   # p1 (t1): an item launch on the test host reaches t1's worktreeAdd, is refused, and leaves no branch anywhere
  ID4=$(cland task create "QA remote item" --size S --json | pick 'v.item.id'); echo "item $ID4"
  RD=$(git rev-parse dev); TD=$(tref dev)
  echo "PRE: hub $(up); territory branches $(git -C .cland/territory.git branch --list "t/$ID4-*" | wc -l | tr -d ' '); root branches $(git branch --list "t/$ID4-*" | wc -l | tr -d ' ')"
  o=$(off)
  probe frames "$(printf '[{"type":"session.launch","name":"qa-impl-t1-item","role":"implementer","harness":"opencode","host":"t1","item":"%s"}]' "$ID4")"
  probe hostlog "$o"
  echo "territory branches $(git -C .cland/territory.git branch --list "t/$ID4-*" | wc -l | tr -d ' '); root branches $(git branch --list "t/$ID4-*" | wc -l | tr -d ' ')"
  echo "launch base keys $(git -C .cland/territory.git config --get-regexp '^branch\..*\.clandlaunchbase$' 2>/dev/null | grep -c -F "t/$ID4-")"
  echo "dir $(test -e ".cland/worktrees/$ID4" && echo present || echo absent); git worktrees naming it $(git worktree list --porcelain | grep -c -x "worktree $PWD/.cland/worktrees/$ID4")"
  echo "root dev unchanged $(same "$(git rev-parse dev)" "$RD"); territory dev unchanged $(same "$(tref dev)" "$TD")"
  echo "row: $(srow qa-impl-t1-item)"
  cland task view "$ID4" --json > "$QA_EV/E1531S3-18-item.json" 2>&1; echo "item view exit $? (claim recorded, not judged)"
}
m19() {   # p1: artifacts from a path, read back byte for byte (the human's calls use the local host)
  head -c 4096 /dev/urandom > "$QA_Q/art/blob.bin"; printf '<h1>qa</h1>\n' > "$QA_Q/art/folder/index.html"; printf 'nested\n' > "$QA_Q/art/folder/sub/n.txt"
  echo "PRE: hub $(up); sources $(find "$QA_Q/art" -type f | wc -l | tr -d ' ') regular"
  o=$(off)
  cland artifact new --kind file --title "QA host file" --topic general --path "$QA_Q/art/blob.bin" --json > "$QA_EV/E1531S3-19-file.json" 2>&1; echo "file exit $?"
  A=$(pick 'v.artifact.id' < "$QA_EV/E1531S3-19-file.json"); pick '({id:v.artifact.id,kind:v.artifact.kind,folder:v.artifact.folder??false,name:v.artifact.path.split("/").pop()})' < "$QA_EV/E1531S3-19-file.json"
  P=$(cland artifact open "$A" --json | pick 'v.path'); cmp "$QA_Q/art/blob.bin" "$P" && echo "file bytes same"
  cland artifact new --kind page --title "QA host folder" --topic general --path "$QA_Q/art/folder" --entry index.html --json > "$QA_EV/E1531S3-19-folder.json" 2>&1; echo "folder exit $?"
  B=$(pick 'v.artifact.id' < "$QA_EV/E1531S3-19-folder.json"); pick '({id:v.artifact.id,folder:v.artifact.folder??false,entry:v.artifact.entry??null})' < "$QA_EV/E1531S3-19-folder.json"
  P=$(cland artifact open "$B" --json | pick 'v.path'); diff -r "$QA_Q/art/folder" "$(dirname "$P")" && echo "folder same"
  cland artifact new --kind file --title "QA relative file" --topic general --path ../art/blob.bin --json > "$QA_EV/E1531S3-19-rel.json" 2>&1; echo "relative exit $?"
  P=$(cland artifact open "$(pick 'v.artifact.id' < "$QA_EV/E1531S3-19-rel.json")" --json | pick 'v.path'); cmp "$QA_Q/art/blob.bin" "$P" && echo "relative bytes same"
  cland artifact new --kind file --title "QA missing" --topic general --path "$QA_Q/art/missing.bin" > "$QA_EV/E1531S3-19-missing.txt" 2>&1; echo "missing exit $?"; cat "$QA_EV/E1531S3-19-missing.txt"
  probe hostlog "$o"
}
m20() {   # p1 (t1): placement through session.launch frames
  echo "PRE: hub $(up); coordinator $(cland session list --json | pick 'v.coordinator ?? "none"')"
  o=$(off)
  probe frames '[{"type":"session.launch","name":"qa-coord-t1","role":"coordinator","harness":"claude-code","host":"t1"},{"type":"session.launch","name":"qa-aide-t1","role":"aide","harness":"claude-code","host":"t1"},{"type":"session.launch","name":"qa-nohost","role":"implementer","harness":"codex","host":"qa-nohost"}]'
  probe hostlog "$o"
  o=$(off)
  probe frames '[{"type":"session.launch","name":"qa-impl-t1","role":"implementer","harness":"opencode","host":"t1"}]'
  probe hostlog "$o"
  echo "refused names listed: $(cland session list --json | pick '["qa-coord-t1","qa-aide-t1","qa-nohost","qa-impl-t1"].filter(n=>v.processes.some(p=>p.name===n))')"
  o=$(off)
  probe frames '[{"type":"session.launch","name":"qa-coord-local","role":"coordinator","harness":"claude-code","host":"local"}]'
  waitrun qa-coord-local 120
  echo "coordinator $(cland session list --json | pick 'v.coordinator ?? "none"')"
  probe rows | grep '"qa-coord-local"'
  cland session stop qa-coord-local > "$QA_EV/E1531S3-20-stop.txt" 2>&1; echo "stop exit $?"; waitstop qa-coord-local 30
  probe hostlog "$o"
}
m21() {   # p1 (t1): the DoD collision: rows on t1 and on an unregistered host whose pid is a live local process
  sh -c 'trap "echo TERM >> \"$0\"" TERM; trap "echo HUP >> \"$0\"" HUP; while :; do sleep 1; done' "$QA_Q/sig.log" > /dev/null 2>&1 &
  P=$!; echo "$P" > "$QA_Q/trap.pid"; echo "$P" >> "$QA_Q/pids"; sleep 1
  echo "PRE: hub $(up); coordinator $(cland session list --json | pick 'v.coordinator ?? "none"'); $(trapalive)"
  cland hub stop; echo "hub stop exit $?"
  probe plant "$(printf '[{"name":"qa-remote","host":"t1","harness":"opencode","sessionId":"qa-remote-session","pid":%s,"pidIdentity":"linux:test-t1:%s"},{"name":"qa-ghost","host":"qa-gone","harness":"opencode","sessionId":"qa-ghost-session","pid":%s,"pidIdentity":"linux:test-qa-gone:%s"}]' "$P" "$P" "$P" "$P")"
  probe rows | grep -E '"qa-(remote|ghost)"'
  o1=$(off)
  hubstart CLAND_TEST_HOSTS=t1; echo "hub start exit $?"
  sleep 5
  cland session list --json | pick 'v.processes.filter(p=>["qa-remote","qa-ghost"].includes(p.name)).map(p=>({name:p.name,status:p.status,state:p.state,stateReason:p.stateReason??null,pid:p.pid}))'
  echo "after start: $(trapalive)"
  probe hostlog "$o1"
  o2=$(off)
  cland session stop qa-remote > "$QA_EV/E1531S3-21-stop-remote.txt" 2>&1; echo "stop qa-remote exit $?"; cat "$QA_EV/E1531S3-21-stop-remote.txt"
  cland session stop qa-ghost > "$QA_EV/E1531S3-21-stop-ghost.txt" 2>&1; echo "stop qa-ghost exit $?"; cat "$QA_EV/E1531S3-21-stop-ghost.txt"
  cland role set qa-remote coordinator > "$QA_EV/E1531S3-21-role.txt" 2>&1; echo "role set exit $?"; cat "$QA_EV/E1531S3-21-role.txt"
  echo "coordinator $(cland session list --json | pick 'v.coordinator ?? "none"')"
  sleep 3
  echo "after stops: $(trapalive)"
  probe hostlog "$o2"
  echo "whole window since the restart:"; probe hostlog "$o1"
  probe rows | grep -E '"qa-(remote|ghost)"'
}
m22() {   # p1: restart without CLAND_TEST_HOSTS; t1 is unknown; local rows stay local; the trap's positive control
  echo "PRE: hub $(up); running local rows $(cland session list --json | pick 'v.processes.filter(p=>p.status==="running"&&!["qa-remote","qa-ghost"].includes(p.name)).map(p=>p.name)'); $(trapalive)"
  cland hub stop; echo "stop exit $?"
  hubstart; echo "start (no test hosts) exit $?"
  o=$(off)
  probe frames '[{"type":"session.launch","name":"qa-impl-t1b","role":"implementer","harness":"codex","host":"t1"},{"type":"session.launch","name":"qa-coord-t1b","role":"coordinator","harness":"claude-code","host":"t1"}]'
  sleep 3
  cland session list --json > "$QA_EV/E1531S3-22-list.json"; echo "list exit $?"
  pick 'v.processes.filter(p=>["qa-remote","qa-ghost"].includes(p.name)).map(p=>({name:p.name,state:p.state,stateReason:p.stateReason??null}))' < "$QA_EV/E1531S3-22-list.json"
  echo "host keys on local rows $(pick 'v.processes.filter(p=>!["qa-remote","qa-ghost"].includes(p.name)&&Object.hasOwn(p,"host")).length' < "$QA_EV/E1531S3-22-list.json")"
  echo "after restart: $(trapalive)"
  probe hostlog "$o"
  probe rows
  P=$(cat "$QA_Q/trap.pid"); kill -TERM "$P"; sleep 3; echo "positive control: TERM lines $(grep -c TERM "$QA_Q/sig.log" 2>/dev/null || echo 0)"
  kill -KILL "$P"; sleep 1; echo "positive control: $(trapalive)"
}
m23() {   # p1: cleanup; judge the fixture-owned census only
  cland hub stop > "$QA_EV/E1531S3-23-hubstop.txt" 2>&1; echo "hub stop exit $?"; sleep 2
  sort -u "$QA_Q/pids" | while read -r p; do [ -n "$p" ] && kill -0 "$p" 2>/dev/null && echo "alive $p $(ps -o command= -p "$p")"; done
  echo "census of $(sort -u "$QA_Q/pids" | grep -c .) fixture pids done"
  ps -Ao pid=,command= > "$QA_Q/ps.txt"; echo "processes naming the scratch root: $(grep -c -F "$QA_Q" "$QA_Q/ps.txt")"; grep -F "$QA_Q" "$QA_Q/ps.txt" | head -20
}
```

Cleanup after the evidence is recorded: print `$Q`, check it begins with `/private/tmp/qa-e1531s3-`, and remove it by that literal path with a non-force `rm -r` (this removes p1, its territory and the plant copy). Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). p1's secret in `$Q/p1/.cland/hub.json` is never printed or posted. Record the setup (worktree, `$Q`, the zero credential-name count, the `CLAND_` name list, `probe checked`) as check `S0` with `qa-record.sh note`; the name list must be exactly `CLAND_DISCORD_API_ROOT CLAND_ELEVENLABS_API_ROOT CLAND_EXECUTOR_STATE CLAND_TELEGRAM_API_ROOT CLAND_TEST_OWNED_ROOT` (no `CLAND_SESSION_*`, `CLAND_LAUNCH_TOKEN` or `CLAND_ROLE` from QA's own session).

## Cases

none. No headless-grid case covers this stage: no item of E-1531 changed Neovim or the web. Every check below is a manual check through named test files, the CLI, socket frames and read-only reads of the scratch `hub.db`, `hub.log` and territory, recorded with `qa-record.sh note`.

### Web cases (when in scope)

none. No item of E-1531 changed `web/` (E1531S3-01 counts the `web/` files of every landing; the T-1556 branch head changes none either); no real browser, no Headless Shell, no computer use.

## Manual checks

Run in this order. Rows E1531S3-02 to E1531S3-09 run their test files serially from `$W` through `nt` (cover-quiet admission before each row, one-minute load below 10 and the free disk space printed before each file; targeted files take no suite lease), never in parallel with each other or with the scratch rows; E1531S3-10 runs one file the same way from the plant copy. Rows E1531S3-11 to E1531S3-23 depend on the p1 state the rows before them leave. Record each row with `sh .agents/skills/qa/qa-record.sh note E-1531 "$RUN" <id> <surface> "<command run>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <captures…>` from `$W`, putting the capture in `$EV/<id>.txt` (or the named log) first. For every `nt` row "clean" means: every `exit` line reads `exit 0 <file>`, no `not ok` line and no `# SKIP` line. "Lists" means the named titles each appear in `oks <id>`. Every expected cell names its pass conditions; anything marked "recorded" is evidence, not a condition.

| id | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1531S3-00 | hub-api | QA | `m00 > "$EV/E1531S3-00.txt" 2>&1` (QA's own shell) | Pass when: the PRE line shows HEAD, dev and the request's SHA as the same 40 hex; `dirty entries 0`; the stage line named `routing by host, the territory branch and the boundary` has `qa` full/after-stage and every member merged; the stage lines `the Host interface and the sessions layer` and `adapters, worktrees, artifacts and the host column` read state `closed`; each member of this stage prints exactly one landing SHA (T-1556 included). Otherwise BLOCKED, reported to the requester, nothing else run |
| E1531S3-01 | hub-api | QA | `m01 > "$EV/E1531S3-01.txt" 2>&1` (QA's own shell, read-only) | Pass when: every `kept` line ends `edited preserved files: 0`; the T-1556 migrated-routing line names only `hub/test/session-host-routing.test.ts` (the approved exception, recorded not judged); `process.kill:` prints `:0` for each of the adapter files; `boundary tier: 1`; `nonlocal timer guard: 1`; `territory launch base key:` at least `1`; `placement message in source: 1`; `unknown-host state in source: 1`; each `README T-…` line, `hooks doc T-1556` and `tracker doc T-1555` at least `1`; `web files changed by E-1531 landings: 0` |
| E1531S3-02 | hub-api | QA | `nt E1531S3-02 hub/test/host-local-contract.test.ts hub/test/host-contract-coverage.test.ts hub/test/host-limit-poller.test.ts hub/test/process-identity.test.ts hub/test/system-processes.test.ts hub/test/session-launch.test.ts hub/test/session-resume.test.ts hub/test/session-cwd.test.ts hub/test/account-poller.test.ts hub/test/account-poller-clock.test.ts` | Pass when clean, and `oks` lists Tests: `Host contract exercises every interface member and detects an uncovered addition`, `Host spawn contract inventory includes logFile and exited with positive omission controls`, `idle poll checks the Host before every read and preserves admission when allowed`. The contract file's cases are generated by `hostContract` (DoD C1, the contract report for `local`): read them from the log; every one prints `ok`. Keep the log as the contract suite's report |
| E1531S3-03 | hub-api | QA | `nt E1531S3-03 hub/test/session-host-routing.test.ts hub/test/session-host.test.ts hub/test/host-registry.test.ts hub/test/host-orphans.test.ts hub/test/session-stop-races.test.ts hub/test/session-async-processes.test.ts hub/test/pid-identity.test.ts hub/test/termination-ownership.test.ts hub/test/launch-recovery.test.ts hub/test/session-resume-component.test.ts`, then `oks E1531S3-03 \| grep -c -F 'stop routes its Linux birth and signal only to the row Host'`, `oks E1531S3-03 \| grep -c -F 'PID Linux ownership without discovery'`, `oks E1531S3-03 \| grep -c -F 'remote Claude resume persists'`, `grep -c -F 'remote Claude poll persists' "$EV/E1531S3-03.log"`, `oks E1531S3-03 \| grep -c -F 'remote Claude replacement refuses'` | Pass when clean; `oks` lists Tests: `startup, poll, resume and stop reach only the named Host despite a live local PID collision`, `remote pending-stop recovery completes with Linux birth and no legacy timestamp`, `projectHub frame stop uses CLAND_TEST_HOSTS and leaves the colliding local process alive`, `remote Claude without a recorded PID cannot stop by native harness id alone`, `remote process liveness and signals require its matching Linux birth, never a local probe`, `remote legacy timestamps never acquire signal authority during stop or LaunchFiles recovery`, `AdapterHost resolves rows and launches to local and launch/relaunch use its directory refusals`, `deaf episodes use Host liveness both at startup and on the held-message timer`, `without the test-host environment only local is registered; unknown rows stay unknown`, `remote rows neither protect nor authorize sweeping local matching PIDs`, `legacy process database migrates host in place and persists named hosts`, `test Host logs every operation, returns synthetic Linux identities and refuses native work`; and the greps print `2` (the codex and claude-code generated stop cases), `2` (both migrated T-1556 poll cases), `2` (both resume cases), `0` (the old poll names are gone from the whole log) and `6` (the generated replacement controls) |
| E1531S3-04 | hub-api | QA | `nt E1531S3-04 hub/test/claude-code-host.test.ts hub/test/claude-code-schedule.test.ts hub/test/claude-code-adapter.test.ts hub/test/claude-code-sessions.test.ts hub/test/claude-code-accounts.test.ts hub/test/claude-code-environment.test.ts hub/test/host-local-liveness.test.ts hub/test/project-hub.test.ts hub/test/lead-routing-process.test.ts`, then `oks E1531S3-04 \| grep -c -F 'nonlocal Claude restart resume discovers at most once when'` and `oks E1531S3-04 \| grep -c -F 'nonlocal Claude abandoned discovery setup drains'` | Pass when clean; `oks` lists Tests: `nonlocal Claude discovers each launch exactly once even in the same directory interval`, `nonlocal Claude timers use only Host liveness and observe death without another command`, `nonlocal Claude missing launch PID stays supervised and reports unknown without timer discovery`, `local discovery keeps its schedule beside a nonlocal row with the same config directory`, `nonlocal Claude relaunch drains predecessor discovery and discovers its new PID once`, `Claude launch, directory discovery and settings reach the selected Host with unchanged command inputs`, `Claude identities, resume fallback, signed-out liveness and stop stay on the row Host`, `local Host bare-PID liveness reads existence without identity subprocess work`; both greps print `2` (the listed and missing restart-resume cases; the before and after abandonment cases) |
| E1531S3-05 | hub-api | QA | `nt E1531S3-05 hub/test/territory-task-branch.test.ts hub/test/worktree-host.test.ts hub/src/hub/worktrees.test.ts hub/test/task-worktrees.test.ts hub/test/task-worktrees-lifecycle.test.ts hub/test/territory-cli.test.ts hub/test/worktree-cli.test.ts hub/test/territory-lock.test.ts` | Pass when clean; `oks` lists Tests: `local baseline: root task branch, tip, worktree path and journal remain unchanged`, `territory branch exists at territory dev before the launch Host adds its worktree under lock`, `existing territory branch supplies its tip, including a root with a different tip`, `failed Host add rolls back the newly created territory ref and root branch`, `prune deletes only an unchanged launch-created territory branch`, `root-only branches keep their tip and do not create a territory ref`, `divergent dev tips: local starts at root and nonlocal starts at territory`, `item launch calls the admitted Host rather than the worktree service default`, `a concurrent territory ref is never adopted or assigned launch provenance`, `Host checkout uses its own fetched tip when another fetch replaces FETCH_HEAD`, `territory add/remove use the supplied Host under lock and return its install warning`, `Host occupants govern list and prune even with a different recorded cwd`; the subtests of the prune and divergent cases print `ok` too (read them from the log) |
| E1531S3-06 | hub-api | QA | `nt E1531S3-06 hub/test/opencode-host.test.ts hub/test/opencode-adapter.test.ts hub/test/opencode-native.test.ts hub/test/opencode-launch-policy.test.ts hub/test/codex-host.test.ts hub/test/codex-adapter.test.ts hub/test/codex-delivery.test.ts hub/test/codex-native.test.ts hub/test/codex-sandbox-host.test.ts hub/test/lead-permissions-component.test.ts hub/test/adapter-native-boundary.test.ts` | Pass when clean; `oks` lists Tests: `OpenCode launches once through Host with unchanged serve arguments, environment, cwd and log`, `OpenCode poll, resume and stop use the row Host and preserve its birth identity`, `Codex launches, resumes, polls and stops only through the selected Host`, `a late Host liveness reply cannot retire a replacement Codex row`, `local Codex policies retain the captured byte-identical overrides`, `Codex takes roots, linked git bytes and socket paths from the selected Host`, `CodexAdapter: post-spawn log close failure retains the normal live session and child` |
| E1531S3-07 | hub-api | QA | `nt E1531S3-07 hub/test/codex-workspace-git.test.ts` | Pass when clean on macOS (the file is macOS-only and skips on Linux; this run is local on macOS, so a `# SKIP` is FAIL here, not a platform skip) |
| E1531S3-08 | hub-api | QA | `nt E1531S3-08 hub/test/artifact-host.test.ts hub/test/artifacts.test.ts hub/test/artifact-create-unit.test.ts hub/test/artifact-folders.test.ts hub/test/artifact-upload.test.ts hub/test/artifact-cli.test.ts hub/test/session-host-placement.test.ts hub/test/role-launch.test.ts hub/test/roles-launch-permissions.test.ts hub/test/fixture-environment.test.ts hub/test/orphan-servers.test.ts hub/test/orphan-sweep-lock.test.ts` | Pass when clean; `oks` lists Tests: `artifact source type and binary bytes are read only on the supplied Host`, `session frames resolve relative paths through Sessions Host while human frames use local`, `upload checks stored attachment types on local Host while new bytes stay in the frame`, `unknown launch Host is refused by name before reservation or spawn; legacy launch defaults local`, `another role reaches the selected test Host spawn and keeps its refusal`, `spoke launch forwards Host placement and Coordinator handover refuses its remote row`; the placement file's generated per-role cases (launch, relaunch and fresh resume; set and move, for coordinator and aide) also print `ok`: read them from the log and compare with the source loops |
| E1531S3-09 | hub-api | QA | `nt E1531S3-09 hub/test/host-boundary.test.ts` | Pass when clean; `oks` lists Tests: `Host boundary rejects native process imports with file and use diagnostics`, `Host boundary rejects every native helper import, including aliases`, `Host boundary rejects filesystem metadata imports and namespace calls`, `Host boundary permits only the two guarded crash self-kills`, `Host boundary scopes named hub-file metadata exceptions to their existing calls`, `Host boundary rejects dynamic native imports and ignores type-only or textual mentions`, `Host boundary scans the current adapters recursively`, `Host boundary discovers a planted bypass in a new nested adapter`, `Host boundary follows the named fs promises namespace`, `Host boundary permits harmless clock namespaces and rejects native helper namespaces`, `Host boundary catches helper namespace accesses from actual exporters and reexports` |
| E1531S3-10 | hub-api | QA | `m10 > "$EV/E1531S3-10.txt" 2>&1` (QA's own shell; the test runs sealed in `$Q/plant`) | PRE: `plant entries 0`. Pass when: `archive exit 0`; `planted lines:` prints `1` for each of codex, sessions, claude-code and nested; `test exit` is nonzero; `not ok:` names `Host boundary scans the current adapters recursively` and no other test; every `diagnostic [...]` line prints at least `1` (the failing assertion's output names `codex.ts` with `realpath import bypasses Host`, `sessions.ts` with `child_process value import bypasses Host`, `claude-code.ts` with `process.kill bypasses Host` and `qa-planted/future.ts:1:` with `endProcess import bypasses Host`). The finding format `<file>:<line>: <use> bypasses Host` is verified in `hub/test/host-boundary.ts`; that the TAP failure output prints each finding string is inferred: if `not ok:` is right but a diagnostic line prints `0`, record the log and judge INCONCLUSIVE |
| E1531S3-11 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m11 ) > "$EV/E1531S3-11.txt" 2>&1` | PRE: p1 has no entries; `fakes 3`. Pass when: `init exit 0`; `branch dev`; `lock 1 executor 1`; `dirty entries 0` (the excluded `node_modules` not listed); `territory present` with a 40-hex `territory dev`; `hub start exit 0`; `hostColumn` true and no `row` line |
| E1531S3-12 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m12 ) > "$EV/E1531S3-12.txt" 2>&1` | PRE: hub up, rows `0`. Pass when: `launch <harness> exit 0` for all three, each `qa-<harness>: running <state> <pid>` within the wait (the state is recorded; judged only through `running` and the pid); `list exit 0; host keys 0`; the three rows read `host` `local`, their harness, `status` `running`, a numeric `pid`, `identity` `darwin`, `alive` true; the first `testHostOps` is `[]`. Local schedule (T-1556 C4): `local agents invocations: before <a> after <b>` with `b` at least `a + 2`; if either reads `absent`, record and judge this sub-check INCONCLUSIVE (the hub passing `FAKE_CLAUDE_HOME` to the fake is inferred). Restart resume: `hub stop exit 0`; the rows read while the hub is down are recorded; `hub start exit 0`; each `qa-<harness>: running …` again and each `qa-<harness> pid before <n> after <n>` with the same number; the rows read `host` `local`, `identity` `darwin`, `alive` true; the second `testHostOps` is `[]`. If the rows read while the hub is down already show `stopped`, the restart did not keep the sessions: record it and judge INCONCLUSIVE (that sessions outlive `cland hub stop` is inferred). `logCloseDiagnostics` recorded, not judged |
| E1531S3-13 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m13 ) > "$EV/E1531S3-13.txt" 2>&1` | PRE: the three rows running. Pass when: for each harness `stop <harness> exit 0` and `qa-<harness>: stopped, process gone`; the three rows read `host` `local`, `status` `stopped`, `alive` false; `testHostOps` `[]` |
| E1531S3-14 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m14 ) > "$EV/E1531S3-14.txt" 2>&1` | PRE: hub up, `no task worktrees`. Pass when: `item <ID>` printed; `differ yes` (root `dev` holds a commit the territory lacks); `before launch: territory none; root none; launch base none`; `launch exit 0`; the pick prints `path` `<p1>/.cland/worktrees/<ID>`, `branch` `t/<ID>-qa-host-item`, `claim` `qa-wt`, `reason` null; `qa-wt: running …`; `territory ref equals root branch yes; equals worktree HEAD yes; equals launch base yes`; `territory ref contains the unpublished root commit yes` (local base is root `dev`, the T-1555 amendment); `territory ref is territory dev no; territory dev unchanged yes`; `dir present`; `node_modules link <p1>/node_modules`; `git worktrees naming it 1`; `branches t/<ID>-qa-host-item`; `wrow`: `state` `open`, the same branch, `sessions` `["qa-wt"]`; the `qa-wt` row reads `host` `local`, `harness` `codex`, `role` `implementer`, `status` `running`, `identity` `darwin`, `alive` true; `testHostOps` `[]`. `codex launch arguments recorded` and the arguments file are recorded, not judged (DoD C4 evidence for the demo) |
| E1531S3-15 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m15 ) > "$EV/E1531S3-15.txt" 2>&1` | PRE: qa-wt running, dir present, territory present. Pass when: `close exit 0`; `prune (inside) exit 0`, its output holds a line ending `sessions inside: qa-wt`, `    kept: a session stands inside` and `kept <ID>`; then `dir present; territory present`. `stop exit 0`, `qa-wt: stopped, process gone`; `wrow`: `state` `closed`, `sessions` `[]`. `prune exit 0` printing `removed <ID>: .cland/worktrees/<ID> and t/<ID>-qa-host-item`; `dir absent`; `root branches 0; territory none; launch base none` (the unchanged launch-created territory branch and its record are deleted); `git worktrees naming it 0`. If either prune prints `not removed <ID>:` with a Git refusal naming files, record `git -C .cland/worktrees/<ID> status --porcelain` and judge INCONCLUSIVE (a fixture file, not the Host path) |
| E1531S3-16 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m16 ) > "$EV/E1531S3-16.txt" 2>&1` | PRE: hub up; `territory branch planted yes; root none; launch base none`. Pass when: `launch exit 0`; `launched branch is the planted one yes` (if `no`, the slug differs from the inferred `qa-existing-item`: record it and judge BLOCKED, not FAIL); `qa-wt2: running …`; `worktree HEAD is the territory tip yes; root branch is the territory tip yes; launch base none` (a pre-existing branch gets no launch provenance); `stop exit 0`, `qa-wt2: stopped, process gone`; `close exit 0`; `prune exit 0` with a line beginning `removed <ID2>:`; `dir absent; root branch none; territory kept at its tip yes`; `testHostOps` `[]` |
| E1531S3-17 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m17 ) > "$EV/E1531S3-17.txt" 2>&1` | PRE: hub up; territory and root `none`. Pass when: `launch exit 0`; `launched branch is the expected one yes` (if `no`, the slug differs from the inferred `qa-pushed-item`: record it and judge BLOCKED, not FAIL); `qa-wt3: running …`; `launch base equals territory ref yes`; `push exit 0`; `territory at the pushed work yes`; `stop exit 0`, `qa-wt3: stopped, process gone`; `close exit 0`; `prune exit 0` with a line beginning `removed <ID3>:`; `dir absent; territory kept at the pushed work yes`. `launch base after prune` is recorded, not judged |
| E1531S3-18 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m18 ) > "$EV/E1531S3-18.txt" 2>&1` | PRE: hub up; territory and root branches `0`. Pass when: `q1` (implementer, opencode, host t1, item `<ID4>`) has `ok` false (its `error` and `code` recorded; that the error names `no worktree for the launch` and `test host t1 refuses worktreeAdd` is inferred and not judged); the window's `testHostOps` is nonempty and every entry begins `t1:` (that it holds `t1:worktreeAdd` is inferred, recorded); afterwards `territory branches 0; root branches 0`; `launch base keys 0`; `dir absent; git worktrees naming it 0`; `root dev unchanged yes; territory dev unchanged yes`; `row: absent`. The item's claim in the item view is recorded, not judged |
| E1531S3-19 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m19 ) > "$EV/E1531S3-19.txt" 2>&1` | PRE: hub up; `sources 3 regular`. Pass when: `file exit 0`; the pick shows an `A-<n>` id, `kind` `file`, `folder` false, a name `A-<n>-qa-host-file.bin`; `file bytes same`. `folder exit 0`; `folder` true, `entry` `index.html`; `folder same` (no `diff` output). `relative exit 0`; `relative bytes same`. `missing exit` nonzero, and the capture contains `cannot read artifact source "<Q>/art/missing.bin"`. `testHostOps` `[]` |
| E1531S3-20 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m20 ) > "$EV/E1531S3-20.txt" 2>&1` | PRE: hub up, `coordinator none`. Pass when: first frames: `welcome` recorded; `q1` (coordinator, host t1) and `q2` (aide, host t1) `ok` false with `error` containing `Coordinator and Aide roles run only on the local host`; `q3` (host `qa-nohost`) `ok` false with `error` containing `unknown host qa-nohost`; that window's `testHostOps` `[]`. Second frame: `q1` (implementer, opencode, host t1) `ok` false (its `code` and `error` recorded, not judged: at stage 2 it read `invalid-cwd` with `launch cwd "<p1>" is not an accessible directory`); that window's `testHostOps` is nonempty and every entry begins `t1:`. `refused names listed: []`. Third frame: `q1` (coordinator, host `local`) `ok` true, `process.status` `running`, `hostField` false; `qa-coord-local: running …`; `coordinator qa-coord-local`; its row reads `host` `local`, `identity` `darwin`, `alive` true; `stop exit 0`, `qa-coord-local: stopped, process gone`; that window's `testHostOps` `[]` |
| E1531S3-21 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m21 ) > "$EV/E1531S3-21.txt" 2>&1` | The DoD collision demo. PRE: hub up, `coordinator none`, `trap <P> alive yes command sh; caught signals 0`. Pass when: `hub stop exit 0`; `planted` for `qa-remote` (host t1) and `qa-ghost` (host qa-gone) with pid `<P>`; their `row` lines read those hosts, `identity` `linux`, `alive` true; `hub start exit 0`. The `session list` pick shows `qa-ghost` with `stateReason` `unknown host` and `state` `unknown` (`qa-remote`'s status and state are recorded, not judged). `after start:`, `after stops:` both read `alive yes command sh; caught signals 0`. `stop qa-remote exit` nonzero (the test asserts `could not stop` on the frame error; the CLI's wording is recorded, not judged); `stop qa-ghost exit` nonzero (`unknown host qa-gone` expected from the source; the CLI's wording is recorded, not judged). `role set exit` nonzero and `coordinator none` (the capture is expected to contain `Coordinator and Aide roles run only on the local host`, verified in source and by the test's `role.set` frame on a stopped row; with this row's state the path is inferred, so a different refusal text is a recorded note, not a failure, while the role stays unassigned). Every `testHostOps` entry in every window begins `t1:`, and the whole window since the restart contains `t1:identity` and `t1:stop` (both asserted in `hub.log` by the projectHub frame-stop test for this row shape). The rows still read pid `<P>` |
| E1531S3-22 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m22 ) > "$EV/E1531S3-22.txt" 2>&1` | PRE: hub up, running local rows `[]`, the trap alive with `caught signals 0`. Pass when: `stop exit 0`; `start (no test hosts) exit 0`; `q1` (implementer, host t1) and `q2` (coordinator, host t1) `ok` false with `error` containing `unknown host t1`; `list exit 0`; both planted rows read `stateReason` `unknown host` and `state` `unknown`; `host keys on local rows 0`; `after restart:` reads `alive yes command sh; caught signals 0`; `testHostOps` `[]`; `hostColumn` true and every `row` other than `qa-remote` and `qa-ghost` reads `host` `local`. Positive control: `positive control: TERM lines 1` (the trap records a real signal, so `caught signals 0` above is meaningful), then `positive control: trap <P> alive no` |
| E1531S3-23 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m23 ) > "$EV/E1531S3-23.txt" 2>&1` | Cleanup, judged by the fixture-owned census only (never a machine-wide `pgrep`). Pass when: `hub stop exit 0`; no `alive` line names a fixture process (a `cland` hub or `hub serve`, `probe.mjs`, a fake `claude`, `codex` app-server or `opencode serve`, the trap `sh`); an `alive` line whose command is unrelated is pid reuse, recorded, not a failure; `processes naming the scratch root: 0` (any listed process is a leftover finding). Then remove `$Q` and the worktree as Build says |

After the rows, recheck `git -C "$W" rev-parse HEAD` and `git -C "$R" rev-parse refs/heads/dev` against the request: a moved dev keeps the evidence and makes the run BLOCKED.

Before requesting QA, run `cland qa lint qa/briefs/E-1531-stage-3.md` with this filled brief at the build under test (`node hub/bin/cland.ts qa lint qa/briefs/E-1531-stage-3.md --commit <dev SHA>` from the root). The brief is complete only when qa lint passes at the build.

**Source provenance (rule 22).** Read at dev `9423e6fd93c87ff501e3d66c4f453eaf86a2302b` and at the T-1556 branch head `dc7d07ac8e77509b503c898c1de2a42e547ceb02`; re-check every one at the tested build.

- Verified in source: `Coordinator and Aide roles run only on the local host` (`hub/src/host/role-placement.ts`); `unknown host ${name}` from `#hostForLaunch` and `#hostForProcess` (`hub/src/adapters/sessions.ts`); `stateReason` `unknown host` and `state` `unknown` for a row whose host is not registered (`Sessions.view`, `hub/src/adapters/sessions.ts`); `could not stop "<name>": its process identity cannot be verified; it is still watched` (`hub/src/adapters/opencode.ts`, `codex.ts`, `claude-code.ts`); remote liveness and stop require the recorded Linux identity before any Host signal (`processHost`, `hub/src/host/process-host.ts`); `test host ${name} refuses ${operation}`, the test host's `linux:test-<name>:<pid>` identities, `alive` false and `stop` false, and the `test-host-operation` log event with `host` and `operation` (`hub/src/host/test-host.ts`); the territory at `.cland/territory.git` (`territoryPath`), the local push of the root base into the territory, the nonlocal territory base, the `branch.<name>.clandLaunchBase` record, rollback on a failed worktreeAdd and prune deleting only a branch still at its launch base (`ensureTaskWorktree`, `removeTaskWorktree`, `hub/src/territory.ts`); `T-n: no worktree for the launch: <error>` wrapping (`TaskWorktrees.launch`, `hub/src/hub/worktrees.ts`); the territory update hook protecting only the default branch and `dev` (`TERRITORY_HOOK`); the root's `origin` remote naming the territory (`hub/src/territory.ts`, init); the boundary finding format `<file>:<line>: <use> bypasses Host` with the uses `child_process value import`, `process.kill`, `<name> import` (`hub/test/host-boundary.ts`), its recursive scan of `hub/src/adapters/` and its T1 tier (`hub/test/tiers.json`); the nonlocal Claude Code timer guard and the separate per-host discovery schedule (`hub/src/adapters/claude-code.ts`, T-1556 head); the fake Claude Code appending every invocation with its `subcommand` to `invocations.jsonl` under `FAKE_CLAUDE_HOME`, and the fake Codex logging `app-server` and `thread/start` lines to `log/<pid>.log` under `FAKE_CODEX_HOME` (`hub/test/fakes/`); `FAKE_CLAUDE_HOME` and `FAKE_CODEX_HOME` synthesized under `$Q` by `fixtureEnvironment` (`test-support/fixture-environment.ts`); `ProcessTable.put` writing `host` (`hub/src/adapters/processes.ts`). Every title the check rows list for `oks` is a literal title in its file (T-1556's at its branch head). From the stage-2 run qa-s2-2026-11-02-qa678-1 (verified by a run): the worktree CLI texts, the slug `qa-host-item` for the title `QA host item`, `cland init` on `main` leaving `dev`, the artifact names and the missing-source refusal, read-only `node:sqlite` reads of the running hub's database, and the `general` topic id.
- Inferred, not verified by a run: the slugs `qa-existing-item`, `qa-pushed-item` and `qa-remote-item` (same rule as `qa-host-item`; E1531S3-16 and E1531S3-17 turn a mismatch into BLOCKED); that sessions of all three fakes outlive `cland hub stop` and resume with the same pid (E1531S3-12 turns a mismatch into INCONCLUSIVE); that the hub passes `FAKE_CLAUDE_HOME` to the fake and that the local `agents` cadence under `CLAND_CLAUDE_AGENTS_MS=500` gives at least two invocations in ten seconds; the CLI's rendering of the stop refusals for `qa-remote` and `qa-ghost`; the `role set` refusal text for a row that is not `stopped`; the refused `t1` item launch's error text, its `t1:worktreeAdd` operation and the item's claim afterwards; `qa-remote`'s status and state after a startup where `t1` reports `alive` false; that the TAP failure output of E1531S3-10 prints every planted finding string; that an empty commit on p1's root `dev` while the hub runs stays the root's tip until the launch reads it (E1531S3-14 checks ancestry, not equality, for that reason); the generated test titles (template literals, the `hostContract` cases and the per-role placement cases).

## Probes that mislead

- The live hub and the live workbench run the code of their last restart, not the tested dev SHA. Live sessions, the live `hub.db`, the live territory and live process rows are not evidence for this stage; p1, the plant copy, the build's files and its tests are.
- Every `cland` here is `$W/hub/bin/cland.ts` (the `cland` function of `env.sh`). A `cland` on PATH, or the root's CLI, may be older.
- A local signal-0 probe leaves no trace. The real-hub collision rows (E1531S3-21, E1531S3-22) prove only that no signal reached the local process; "never probed locally" rests on the spy `local` host of the routing test in E1531S3-03. Do not read the absence of a `local` entry in `testHostOps` as proof: the local host does not log operations.
- `caught signals 0` means something only because the same trap records `TERM` in E1531S3-22's positive control; SIGKILL cannot be trapped, so the trap's `alive yes` is the check for it.
- `session list` and the `session.launch` result carry no `host` field for a `local` row by design (T-1552 C2); the column lives in `hub.db` (`probe rows`). A missing `host` key in the CLI is the expected result, not a missing column.
- A `test-host-operation` line is expected only in the windows that name `t1` or follow a restart with planted `t1` rows; one in a local launch, stop, worktree or artifact window is a failure. Windows start at the byte offset `off` printed before the row's actions, never at a timestamp.
- After a launch is accepted, a log-handle close failure is diagnostic only (`host-spawn-log-close-failed`). It does not fail a row while the session is running and alive; record it.
- The real test host refuses every native operation, so a launch on `t1` fails with whichever operation the adapter reaches first. Judge "t1 reached, nothing local, nothing left behind", not the operation's name (stage 2's E1531S2-18 lesson).
- The task-branch ordering (territory ref before the Host's worktreeAdd, under the lock) is visible only inside a recording Host (E1531S3-05). On a real hub, E1531S3-14 sees the end state; do not try to race the launch.
- The territory is a bare repository: read it with `git -C .cland/territory.git`, never through the root's `origin/*` remote-tracking refs, which are stale until fetched.
- Process cleanup probes use the fixture-owned census (`$Q/pids`: hub pids from `hub.json`, every session row's pid after `waitrun`, the probe itself, the trap; plus processes whose command line names `$Q`), registered at launch and checked through exit. A machine-wide `pgrep claude`, `codex` or `opencode` counts the crew's real harnesses (A-9063 R2; E-413 stage 1/T-1093).
- The fake harnesses' `state` (idle, unknown, busy) is not this stage's behaviour: judge `status`, `pid`, the birth identity and `alive`.
- `hub/test/codex-workspace-git.test.ts` skips on Linux; on this macOS run it must execute. "No skip" names it.
- `hub/test/session-host-routing.test.ts` was edited by T-1556 under the Coordinator's decision 77fb0104; E1531S3-01 records that diff and E1531S3-03 checks the migrated names, not "no test edited".
- Exit 0 from the Node test runner with a name that matches nothing is not a pass: confirm the named tests appear on ok lines.
- E1531S3-10's failing test run is the expected result; the plant copy is outside the repository and never committed, and `$W` stays clean.
- Edit existing keys in initialized configs (`lock_path`, `executor`); never add a second table (A-8634 R12). The root `node_modules` exclusion goes in `.git/info/exclude`, never in a tracked file.
- Re-check helper, message and test names with grep at the tested build; renames happen, and T-1556 had not landed at writing.

## Out of scope

Real remote hosts, the SSH transport, the host agent and git through the tunnel, pools, placement and the scheduler, and logins (later epics E-1532 onward); a nonlocal Claude Code launch on a real hub (the test host refuses `run`, so T-1556's nonlocal discovery is proven by `hub/test/claude-code-host.test.ts` and `hub/test/session-host-routing.test.ts` only); a nonlocal item launch that succeeds (the territory base on a nonlocal Host is proven by the recording-Host cases of `hub/test/territory-task-branch.test.ts`; on a real hub only the refusal and its rollback are checked); the orphan sweep on a real hub (the scratch hub runs with the machine-wide sweep off; the sweep's routing is proven by E1531S3-03); the epic's Definition-of-done run and its criterion marks; the full T3/T4 suites, the T4 soak and load repetitions, and the stage cover pair (the Coordinator's occasion); the `artifact.upload` path on a real hub (composer and remote surfaces; tests only); real Claude Code, Codex and OpenCode, any provider or account, a droplet, a real browser, computer use, the live hub, the live territory, a live restart and any change to live sessions, holds or the tracker. Missing authorization does not apply: nothing here needs a grant, so no check is BLOCKED for lack of one.

## Grants

none. Every scratch check uses the rule 15 sealed environment with credentials filtered and only the fake harnesses; the test files and the plant copy run under the same environment.

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`--stage "routing by host, the territory branch and the boundary"`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Report `qa clear E-1531 stage routing by host, the territory branch and the boundary` or `qa not clear E-1531 stage routing by host, the territory branch and the boundary` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
