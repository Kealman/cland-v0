# Stage QA brief: E-1538 stage 1 — lock, deletion and paths

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` or `$B:h` as a modifier). The run is local, on macOS (BSD `sed -i ''`, Node 24 with `node:sqlite`). It starts real scratch hubs of the tested build on this machine, with the fake `claude`, `codex` and `opencode` of `hub/test/fakes/` as their only harnesses (no session is launched), and it uses DigitalOcean only through the repository's fake API (`hub/test/fakes/digitalocean/fake-api.ts`) on 127.0.0.1. No browser, no GUI, no computer use, no remote host, no real droplet.

## Stage

- Epic: E-1538 (Hub lifecycle safety and user-state paths, under R-1530).
- Exact stage name: lock, deletion and paths.
- Items, in plan order by lane: lane 1 T-1615 (The hub lock records its host identity and a heartbeat), then T-1616 (The hub keeps its heartbeat fresh and stops when it loses the lock), then T-1617 (Hub start, stop, status, doctor and the orphan sweep read a foreign holder); lane 2 T-1618 (Droplet and key deletion is confirmed by a GET on release and in the watchdog), then T-1619 (Reaping confirms by a GET and deletes again what it could not confirm), then T-1620 (Snapshot deletion is confirmed by a GET); lane 3 T-1621 (One resolver for the hub's per-user state, and an inventory of what the hub writes outside the project), then T-1622 (ps is a declared dependency of the hub), then T-1623 (The transport kind, and outbound refused). The run reads the stage's members, state and landings from `task plan show E-1538` (E1538S1-00), never from a number written here. Findings fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: the combined changed behaviour of the stage at the tested build, each exercised on scratch projects:
  - `cland hub start`, `stop`, `status`, `doctor` and `task migrate` against a planted fresh foreign lock and a lapsed one (T-1615, T-1617), with a `ps` shim that logs every `ps` call;
  - the heartbeat advancing while a scratch hub serves, a foreign contender refused across several lapse periods of real time, a normal stop, and the lost-lock stop (T-1615, T-1616);
  - the DigitalOcean client and `cland executor reap` against the fake API with its DELETE-404-while-GET-200 fault (T-1618, T-1619, T-1620), driven by a scratch hub whose provider endpoint is the loopback fake;
  - the per-user state resolver, the legacy ledger and an inventory scan with a positive control (T-1621);
  - the doctor `ps` row and the install docs (T-1622);
  - `transport = "outbound"` refusing hub start and `cland hub reload` (T-1623).
  What only a lease, a watchdog or `prepare` can reach (release, watchdog receipts, snapshot recovery, the inventory test with a lease and a harness session, the lint, lost-write injection) is proven by the named test files in the `nt` rows E1538S1-17 to E1538S1-23.

Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

Criteria map (the stage verdict carries no item or epic marks; this tells the run which check proves what):

| criterion | proven by |
| --- | --- |
| T-1615 C1 (lock record: host identity, heartbeat, pid, start time, token) | E1538S1-02 (live scratch hub, native identity); E1538S1-17 |
| T-1615 C2 (foreign, fresh heartbeat: HubLocked, pid not probed) | E1538S1-03 (real-time contender); E1538S1-06; E1538S1-07 (each identity part); E1538S1-17 |
| T-1615 C3 (foreign, lapsed: broken through the guard, taken whole) | E1538S1-08 (restart over a lapsed record); E1538S1-17 |
| T-1615 C4 (foreign pid never signalled or looked up with `ps`) | E1538S1-03 (throwing process table); E1538S1-06 (`ps` shim with a positive control); E1538S1-17 |
| T-1615 C5 (same-host rules unchanged) | E1538S1-07 (same-host control); E1538S1-17; E1538S1-18 |
| T-1615 C6 (older record shapes unchanged) | E1538S1-07 (pid alone, started, startedUtc, token); E1538S1-17 |
| T-1615 C7 (boot id readers) | E1538S1-01 (source); E1538S1-02 (`kern.bootsessionuuid` on this macOS); E1538S1-17 (Linux and Darwin readers) |
| T-1615 C8 (only the hub lock changed) | E1538S1-01 (files of the landing); E1538S1-18 |
| T-1615 C9 (named tests pass unedited) | E1538S1-01 (no edit); E1538S1-18 |
| T-1616 C1 (heartbeat replaced whole every interval) | E1538S1-02 (sampler: no absent, no partial read, advancing); E1538S1-17 |
| T-1616 C2 (foreign contender refused across several lapse periods) | E1538S1-03 (150 s of real time); E1538S1-17 |
| T-1616 C3 (lost lock: `hub-lock-lost`, normal shutdown, successor's lock kept) | E1538S1-05; E1538S1-17 |
| T-1616 C4 (failed write logged, retried, never stops the hub) | E1538S1-17 only (a write failure cannot be injected into a scratch hub without editing it) |
| T-1616 C5 (stop clears the timer and removes the lock) | E1538S1-04; E1538S1-17 |
| T-1616 C6 (named tests pass unedited) | E1538S1-01; E1538S1-18 |
| T-1617 C1 (`hub start` against a fresh foreign lock) | E1538S1-06; E1538S1-19 |
| T-1617 C2 (`hub stop` against a foreign holder) | E1538S1-06; E1538S1-08; E1538S1-19 |
| T-1617 C3 (status and doctor report fresh and lapsed) | E1538S1-06; E1538S1-08; E1538S1-19 |
| T-1617 C4 (orphan sweep never matches a foreign pid) | E1538S1-19 (the sweep is off in the scratch hubs by design); E1538S1-06 (`ps` shim for the readers) |
| T-1617 C5 (named tests pass unedited) | E1538S1-01; E1538S1-18; E1538S1-19 |
| T-1617 C6 (offline migrate refuses a fresh foreign holder) | E1538S1-09; E1538S1-08 (lapsed is taken and released); E1538S1-19 |
| T-1618 C1 (DELETE 404 never counts; GET 404 does) | E1538S1-10 (client against the fake); E1538S1-11 (reap); E1538S1-20 |
| T-1618 C2 (GET one SSH key by id; the fake answers) | E1538S1-10; E1538S1-20 |
| T-1618 C3 (fake: DELETE 404 while GET 200 for a set number of reads) | E1538S1-10; E1538S1-11; E1538S1-20 |
| T-1618 C4 (release keeps the lease `releasing`, spend not settled) | E1538S1-20 (a lease cannot be driven from a scratch project) |
| T-1618 C5 (watchdog receipt only after every GET answered 404) | E1538S1-20 |
| T-1618 C6 (next release confirms, settles, releases) | E1538S1-20 |
| T-1618 C7 (named tests pass unedited) | E1538S1-01; E1538S1-21 |
| T-1619 C1 (reap and sweep confirm droplets by GET, not by the tag listing) | E1538S1-11 (one listing per reap, a GET by id per deletion); E1538S1-20 |
| T-1619 C2 (keys confirmed by GET by id) | E1538S1-11; E1538S1-20 |
| T-1619 C3 (a live GET is unconfirmed, not counted, lease open) | E1538S1-11 (reported, not counted); E1538S1-20 (lease open) |
| T-1619 C4 (the next reap deletes and confirms) | E1538S1-11; E1538S1-20 |
| T-1620 C1 (GET one snapshot by id; same fault) | E1538S1-10; E1538S1-20 |
| T-1620 C2 (prepare and recovery count only a GET 404) | E1538S1-20 (a prepare cannot be driven from a scratch project); E1538S1-10 (client level) |
| T-1620 C3 (unconfirmed snapshot keeps its record; next recovery deletes) | E1538S1-20; E1538S1-10 (second delete confirms) |
| T-1620 C4 (named tests pass unedited) | E1538S1-01; E1538S1-21 |
| T-1621 C1 (one resolver; ledger, lock, migration record through it) | E1538S1-12 (`spend.path` under the scratch state directory); E1538S1-22; E1538S1-01 (source) |
| T-1621 C2 (legacy ledger still read and reconciled) | E1538S1-12 (planted legacy entry counted); E1538S1-21 |
| T-1621 C3 (every file outside the project lands in the state directory) | E1538S1-12 (scan with a positive control); E1538S1-22 (inventory test) |
| T-1621 C4 (lint on `homedir()`, HOME joins, `tmpdir()`, `/tmp`) | E1538S1-22 |
| T-1621 C5 (lint on macOS-only paths and commands) | E1538S1-22 |
| T-1622 C1 (doctor `ps` row fails naming `procps`) | E1538S1-13 (a failing `ps` shim, with a passing control); E1538S1-23 |
| T-1622 C2 (install docs list `procps`) | E1538S1-13; E1538S1-01 |
| T-1623 C1 (one transport kind module and parser) | E1538S1-01 (source); E1538S1-23 |
| T-1623 C2 (`outbound` refused at start and reload, naming 0.4.x) | E1538S1-14; E1538S1-23 |
| T-1623 C3 (any other value refused, naming `ssh`) | E1538S1-14; E1538S1-23 |
| T-1623 C4 (`ssh` or no `transport` accepted; rest of `[hosts]` as today) | E1538S1-14; E1538S1-23 |
| Negative: the live hub's lock and `.cland` are never read or touched | E1538S1-15; E1538S1-16; E1538S1-00 (the only live reads are named there) |

## Build

Use a clean detached worktree at the full dev SHA named in the request: `<dev SHA>` (40 hex). HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt: for every member that `task plan show E-1538` lists in stage `lock, deletion and paths`, `git log --first-parent --format=%H --grep "^Item: <id>$" <dev SHA>` prints exactly one commit. At writing, dev was `5c12b1b1f26a6989785eeb99c198906934801af3` and these had landed: T-1615 `b3d1cc0d39967baef89f71f85c12065b9b5e34be`, T-1616 `ae3444303cdb6b1cde142451d1ae58d8a0e37d5b`, T-1618 `31f90e6bae7262257595978a8da3d448e48b8f1a`, T-1619 `f1877262d4108fb28b2748f1527f5642de078539`, T-1620 `5c12b1b1f26a6989785eeb99c198906934801af3`, T-1621 `6d0c8efdaa171187f4b0c7a143fabe3ec7239ac3`, T-1622 `8bc02c5d8ee90e8691e74990e2da5b5a7196e8c7`, T-1623 `c3cb1eeb5830f74819a024988af5ce53ea3a52a6`. T-1617 had not landed: it was ready on branch `t/T-1617-hub-start-stop-status-doctor-and-the` (head `691042d964ca5487ae261a8429071c2b3118bbfa`), and every T-1617 expectation below (the wording of the foreign-holder lines, the `hub status --json` fields, the doctor `hub` row, the migrate refusal, `hub-lock-readers.test.ts`) was read from that head and is **inferred** until it lands. The request names a dev SHA that includes the T-1617 landing; a dev SHA without it is BLOCKED (E1538S1-00). Re-check every string with grep at the tested build, and re-read T-1617's landing (`git show --stat`) before judging, since review may still change it. A dirty build, missing required merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no run id on purpose.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step (the setup below does; the clean-tree checks ignore that one entry).

**Where things live.** All QA scratch and prep are outside the project root: the scratch root `$Q` is `/private/tmp/qa-e1538s1-…` (its realpath), and it holds the three scratch projects, the scratch HOMEs, the fakes' state and every helper file. The only two paths under the repository are the ones the QA tooling itself prescribes, both ignored by `.cland/.gitignore` (`worktrees/`, `qa/`): the detached build `$W` in `.cland/worktrees/` and the evidence tree `$EV` in `.cland/qa/E-1538/`. Nothing else is created in the root, and no file is written to `.cland/tasks/`; E1538S1-00 and E1538S1-16 print the root's non-tracker status (it must stay empty: an untracked file in the root blocks stage covers).

**Isolation (rule 15).** Every scratch check runs in a disposable project with its own HOME, XDG directories and Git config, with provider and account variables removed. Never the live project at `/Users/evgeniyivanov/Projects/cland/v0`, its hub, its lock, its `hub.db` or the human's HOME (`~/.cland`, `~/.claude`, `~/.codex`, `~/.local/state`, `~/.config/cland`). The live hub is read only by QA's own shell for E1538S1-00's plan read and `quiet` (cover-quiet admission: the live verify queue is read, nothing is submitted). Every scratch `cland` call runs sealed, with every inherited `CLAND_*` variable stripped, from a directory under `$Q`; E1538S1-15 proves it. **Harnesses:** only the fakes in `$W/hub/test/fakes/` (`CLAND_CLAUDE_BIN`, `CLAND_CODEX_BIN`, `CLAND_OPENCODE_BIN`, first on the scratch hub's `PATH`); no session is launched. **DigitalOcean:** only the fake API and the fake provider. The real API is never called, the real token is never read or printed, and no real droplet, snapshot or key is listed, created or deleted. The scratch hub that talks to the fake gets a sentinel token `cland-test-qa1538-<hex>` that the fake itself generated, and `CLAND_DIGITALOCEAN_API` set to the fake's loopback URL; `hubstart_do` refuses to start unless the URL is `http://127.0.0.1:<port>/v2` and the token carries the sentinel prefix. Its environment is built through the shared fixture, account-path, Git and synthetic-provider adapters, without later overlays. The ordinary sealed environment holds no `DIGITALOCEAN_*` or `DO_*` name (E1538S1-02 prints the count). **Lock identity:** every hub started here uses the native lock identity (since T-1615/T-1617 `projectHub` and the CLI default to the machine's real hostname, boot id and PID namespace). A synthetic foreign identity appears only in the identity-negative checks E1538S1-03 and E1538S1-05 to E1538S1-09, and each of those says so: the planted records name `qa-foreign.invalid`, `qa-successor.invalid` or `qa-contender.invalid`. **Browser (rule 18):** none. **Preconditions (rule 22):** every check function prints a `PRE:` line before acting; when that line differs from the row's stated precondition, record the row `BLOCKED` with the line and stop the dependent rows. Created ids (the fake's droplet and key ids) are read from the fake's state listing and saved one per file with a trailing newline (`drop.id`, `key.id`), never taken from a create reply. Messages and test titles are marked verified or inferred under "Source provenance" below. **Secrets (rule 15):** the sentinel token and the scratch hubs' secrets are never printed, posted or written under `$EV`; every error text and CLI output goes through `redact()` (`$Q/redact.mjs`, used by the probe and by the `rd` filter), which replaces known secrets by their kind and any `token=`, `password=`, `cookie=`, `secret=`, bearer or 64-hex value; E1538S1-16 scans for the secrets with a positive control.

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree, runs `quiet` and the plan read, runs the named test files through `nt` (which seals each run) and records every check with `qa-record.sh`. **Every other command runs sealed** inside a subshell that sources `$Q/env.sh`. That file holds the full `fixtureEnvironment` result (`test-support/fixture-environment.ts`) after the scratch overlays, then `scratchGitEnvironment` with a scratch `core.excludesFile`. It drops every inherited `CLAND_*`, `GIT_*`, `XDG_*`, `CLAUDE_*`, `CODEX_*`, `OPENCODE_*`, `FAKE_*`, provider and account variable, and keeps `PATH`, `SHELL`, `TERM` and `TMPDIR`. It synthesizes its own scratch values under `$Q`: HOME, XDG, `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, the `FAKE_*_HOME` directories, `CLAND_EXECUTOR_STATE`, the messenger sentinels and `CLAND_TEST_OWNED_ROOT`. Leave `TMPDIR` at the system default (on macOS `/var/folders/...`; never `/tmp`, T-1030). Never use `env -i`. The scratch root lives under `/private/tmp/qa-e1538s1-` (its realpath, short enough for the scratch hubs' sockets).

Three scratch projects, each a fresh `cland init` project with its own local Git config:
- **p1** (`QA One`): the lock, heartbeat, lost-lock and foreign-holder checks (E1538S1-02 to E1538S1-09), HOME `$Q/home`;
- **p2** (`QA Two`): the reap and per-user state checks (E1538S1-11, E1538S1-12), whose hub runs with HOME and `XDG_STATE_HOME` both `$Q/home2`, no `CLAND_EXECUTOR_STATE`, the sentinel token and the fake's endpoint;
- **p3** (`QA Three`): the doctor and transport checks (E1538S1-13, E1538S1-14), HOME `$Q/home`.

Their actors: the local human (the CLI), a decoy process (a `sleep` of this run whose pid stands in for "a foreign pid that happens to exist here": if any reader signalled it, it would die), and the fake DigitalOcean API with its control server (`fakedo.mjs`).

In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<dev SHA>                                    # the full dev SHA from the request
RUN=qa-s1-$(date +%F)-1                        # unique run id for E-1538; bump the suffix on a rerun
W=$R/.cland/worktrees/$RUN                     # the clean detached build (ignored by Git)
EV=$R/.cland/qa/E-1538/$RUN                    # captures (qa-record.sh keeps its evidence here too; ignored by Git)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
Q=$(cd "$(mktemp -d /tmp/qa-e1538s1-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/qa-e1538s1-…
chmod 700 "$Q"
mkdir -p "$Q/home" "$Q/home2" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data" "$Q/xdg/cache" "$Q/p1" "$Q/p2" "$Q/p3" "$Q/psshim" "$Q/psfail" "$Q/fake-claude" "$Q/fake-codex" "$Q/fake-opencode" "$Q/claude" "$Q/codex"
: > "$Q/pids"                                  # the fixture-owned process census: every scratch pid is appended here
: > "$Q/home/.gitconfig"; : > "$Q/home/.gitignore-global"; : > "$Q/marker"
REALPS=$(command -v ps)
printf '#!/bin/sh\necho "$PPID $*" >> "$PS_LOG"\nexec %s "$@"\n' "$REALPS" > "$Q/psshim/ps"; chmod 755 "$Q/psshim/ps"   # logs the caller's pid and argv of every ps call, then runs the real ps
printf '#!/bin/sh\nexit 1\n' > "$Q/psfail/ps"; chmod 755 "$Q/psfail/ps"                                         # a ps that cannot report anything
holder() { (cd "$W" && node hub/bin/cland.ts verify queue --json) | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);console.log((v.holder?.session??v.holder?.kind??"none")+" waiters "+(v.waiters??[]).length)})'; }
quiet() { for i in $(seq 1 10); do h=$(holder) && case "$h" in "none "*) echo quiet; return 0;; esac; sleep 60; done; echo "BLOCKED: the verify slot is not free after 10 minutes: ${h:-queue read failed}"; return 1; }
# ld: the one-minute load must be 10 or below before each test file and each timed row (docs/agents/tests.md load rule); prints free disk space too
ld() { for i in $(seq 1 10); do l=$(sysctl -n vm.loadavg | awk '{print $2}'); if awk -v l="$l" 'BEGIN{exit !(l<=10)}'; then echo "load $l; free kB $(df -k "${TMPDIR:-/var/tmp}" | awk 'NR==2{print $4}')"; return 0; fi; sleep 60; done; echo "BLOCKED: one-minute load not at or below 10 after 10 minutes: $l"; return 1; }
# nt <id> <test files…>: named test files from $W, sealed, one file at a time, TAP output, after quiet and ld; the log is $EV/<id>.log
nt() { id=$1; shift; quiet || return 1; : > "$EV/$id.log"; for f in "$@"; do ld >> "$EV/$id.log" || { tail -n 1 "$EV/$id.log"; return 1; }; ( . "$Q/env.sh"; cd "$W" && node --test --test-concurrency=1 --test-reporter=tap "$f" >> "$EV/$id.log" 2>&1; echo "exit $? $f" >> "$EV/$id.log" ); done; grep -E '^exit ' "$EV/$id.log"; grep -E '^ *not ok|# SKIP' "$EV/$id.log" | head -20; }
# oks <id>: the names on the passing (sub)test lines of $EV/<id>.log
oks() { grep -E '^ *ok [0-9]+ - ' "$EV/$1.log" | sed -E 's/^ *ok [0-9]+ - //'; }
```

The sealed environment. Apply the full `fixtureEnvironment` result after the scratch overlays, including its synthesized HOME, Git, account and fake-harness paths; do not merely unset keys absent from it. Then apply `scratchGitEnvironment`, and remove the broader credential prefixes last. The generated shell first unsets dropped inherited names and then exports every retained value; never print or post those exports. Under rule 15, check zero credential-prefix names before launching any scratch process (the last lines below print a count and variable names only, never values).

```sh
node --input-type=module - "$W/test-support/fixture-environment.ts" "$Q" "$W" "$EV" "$R" > "$Q/env.sh" <<'JS'
const [m,root,worktree,ev,live]=process.argv.slice(2);
const {fixtureEnvironment,scratchGitEnvironment}=await import(m);
let env=fixtureEnvironment(root,process.env,{
  XDG_CONFIG_HOME: `${root}/xdg/config`, XDG_STATE_HOME: `${root}/xdg/state`,
  XDG_DATA_HOME: `${root}/xdg/data`, XDG_CACHE_HOME: `${root}/xdg/cache`,
  GIT_AUTHOR_NAME: 'qa', GIT_AUTHOR_EMAIL: 'qa@example.invalid',
  GIT_COMMITTER_NAME: 'qa', GIT_COMMITTER_EMAIL: 'qa@example.invalid',
  QA_W: worktree, QA_Q: root, QA_EV: ev, QA_R: live,
});
env=scratchGitEnvironment(root,env,{excludesFile:`${root}/home/.gitignore-global`});
for(const k of Object.keys(env))if(/^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)/.test(k))delete env[k];
const quote=value=>"'"+value.replaceAll("'", "'\\''")+"'";
for(const k of Object.keys(process.env).sort())if(!(k in env)&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(k))console.log(`unset ${k}`);
for(const [k,v] of Object.entries(env))if(/^[A-Za-z_][A-Za-z0-9_]*$/.test(k))console.log(`export ${k}=${quote(v)}`);
JS
cat >> "$Q/env.sh" <<'ENV'
FCC=$QA_W/hub/test/fakes/claude-code; FCX=$QA_W/hub/test/fakes/codex; FOC=$QA_W/hub/test/fakes/opencode
cland() { node "$QA_W/hub/bin/cland.ts" "$@"; }
# probe <mode> [args…]: the lock, CLI-reading, fake-provider and scan probe (see probe.mjs); rd: the redaction filter
probe() { node "$QA_Q/probe.mjs" "$@"; }
rd() { node "$QA_Q/redact.mjs"; }
ld() { for i in $(seq 1 10); do l=$(sysctl -n vm.loadavg | awk '{print $2}'); if awk -v l="$l" 'BEGIN{exit !(l<=10)}'; then echo "load $l"; return 0; fi; sleep 60; done; echo "BLOCKED: one-minute load not at or below 10: $l"; return 1; }
# hp: the pid in this project's .cland/hub.json (the secret is never read out)
hp() { node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(".cland/hub.json","utf8")).pid)+"\n")'; }
# hubstart: start this project's hub with the fakes authoritative and first on its PATH, no machine-wide orphan sweep, native lock identity; census its pid
hubstart() { env PATH="$FCC:$FCX:$FOC:$PATH" CLAND_CLAUDE_BIN="$FCC/claude" CLAND_CODEX_BIN="$FCX/codex" CLAND_OPENCODE_BIN="$FOC/opencode" CLAND_TEST_SKIP_ORPHAN_SWEEP=1 CLAND_ADAPTER_POLL_MS=200 CLAND_CLAUDE_AGENTS_MS=500 node "$QA_W/hub/bin/cland.ts" hub start && hp >> "$QA_Q/pids"; }
# hubstart_do: hubstart for p2 only: the fake's loopback endpoint, its sentinel token, HOME and XDG_STATE_HOME on $Q/home2, no CLAND_EXECUTOR_STATE
hubstart_do() {
  node "$QA_Q/launch-p2.mjs" && hp >> "$QA_Q/pids"
}

amode() { sed -n '/^\[auth\]/,/^\[/p' .cland/config.toml | grep -E '^mode = '; }
up() { cland hub status > /dev/null 2>&1 && echo up || echo down; }
# run <label> <command…>: exit status, then the first lines of stdout and stderr, both redacted
run() { l=$1; shift; "$@" > "$QA_Q/r.out" 2> "$QA_Q/r.err"; x=$?; echo "$l exit $x"; rd < "$QA_Q/r.out" | head -n 30 | sed 's/^/  out: /'; rd < "$QA_Q/r.err" | head -n 30 | sed 's/^/  err: /'; }
# psrun <command…>: the command with every ps call logged to $Q/ps-calls.log
psrun() { PS_LOG="$QA_Q/ps-calls.log" PATH="$QA_Q/psshim:$PATH" "$@"; }
# has <text>: how many times the text is in the last run's output; hasl <text>: in this project's hub log (truncated before each start attempt that reads it)
has() { cat "$QA_Q/r.out" "$QA_Q/r.err" 2> /dev/null | grep -c -F -- "$1"; }
hasl() { grep -c -F -- "$1" .cland/log/hub.log 2> /dev/null; }
# decoy: a detached sleep (own session, not a child of any row's shell; node spawn with detached and unref) whose pid stands in for a foreign pid that exists on this machine; alive <pid>
decoy() { node -e 'const c=require("node:child_process").spawn("/bin/sleep",["900"],{detached:true,stdio:"ignore"});c.unref();console.log(c.pid)' > "$QA_Q/decoy.pid" && cat "$QA_Q/decoy.pid" >> "$QA_Q/pids"; }
alive() { kill -0 "$1" 2> /dev/null && echo yes || echo no; }
# census <project>: processes whose command line names that scratch project (the fixture-owned census, never a machine-wide pgrep)
census() { ps -Ao pid=,command= > "$QA_Q/ps.txt"; grep -F "$QA_Q/$1" "$QA_Q/ps.txt" | grep -v -E 'probe\.mjs|ps -Ao|grep ' | wc -l | tr -d ' '; }
# dostart / dostop: the fake DigitalOcean API and its control server (fakedo.mjs), one process, census its pid
dostart() { : > "$QA_Q/do.ctl"; : > "$QA_Q/do.url"; ( node "$QA_Q/fakedo.mjs" > "$QA_Q/fakedo.out" 2>&1 & echo $! > "$QA_Q/fakedo.pid" ); cat "$QA_Q/fakedo.pid" >> "$QA_Q/pids"; for i in $(seq 1 60); do [ -s "$QA_Q/do.ctl" ] && return 0; sleep 1; done; echo "BLOCKED: the fake provider did not start"; return 1; }
dostop() { [ -s "$QA_Q/fakedo.pid" ] || return 0; p=$(cat "$QA_Q/fakedo.pid"); kill "$p" 2> /dev/null; for i in $(seq 1 30); do kill -0 "$p" 2> /dev/null || return 0; sleep 1; done; echo "fakedo $p still alive after 30 s"; }
ENV
( . "$Q/env.sh"; env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)' )
( . "$Q/env.sh"; env | cut -d= -f1 | grep -E '^CLAND_' | sort | tr '\n' ' '; echo )
```

The p2 launcher uses the shared environment boundaries in this order: `fixtureEnvironment` with all ordinary overlays (including `XDG_STATE_HOME` and an absent executor override), `scratchAccountEnvironment` for the deliberate scratch HOME, `scratchGitEnvironment`, then `syntheticProviderEnvironment` for the validated sentinel and loopback endpoint. No shell or object overlay follows these boundaries. `fixtureEnvironment` cannot run after the deliberate account/provider adapters: it would reset HOME and remove the sentinel token. The launcher prints only path-equality facts and redacted child output.

```sh
cat > "$Q/launch-p2.mjs" <<'JS'
// brief correction (shared-builder launcher), coord-authorised 3af43250
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { redact } from './redact.mjs';
const Q = process.env.QA_Q, W = process.env.QA_W;
if (!Q?.startsWith('/private/tmp/qa-e1538s1-') || !W || process.cwd() !== `${Q}/p2`) throw new Error('p2 launcher requires its scratch project');
try {
  const { fixtureEnvironment, scratchAccountEnvironment, scratchGitEnvironment } = await import(`${W}/test-support/fixture-environment.ts`);
  const { syntheticProviderEnvironment } = await import(`${W}/hub/test/synthetic-provider.ts`);
  const token = readFileSync(`${Q}/do.token`, 'utf8').trim();
  const endpoint = readFileSync(`${Q}/do.url`, 'utf8').trim();
  if (!/^cland-test-qa1538-[a-z0-9]+$/.test(token) || !/^http:\/\/127\.0\.0\.1:[0-9]+\/v2$/.test(endpoint)) throw new Error('p2 launcher requires the explicit loopback fake');
  const fakes = `${W}/hub/test/fakes`;
  let env = fixtureEnvironment(Q, process.env, {
    QA_Q: Q, QA_W: W, QA_EV: process.env.QA_EV, QA_R: process.env.QA_R,
    XDG_STATE_HOME: `${Q}/home2`, CLAND_EXECUTOR_STATE: undefined,
    PATH: `${fakes}/claude-code:${fakes}/codex:${fakes}/opencode:${process.env.PATH}`,
    CLAND_CLAUDE_BIN: `${fakes}/claude-code/claude`,
    CLAND_CODEX_BIN: `${fakes}/codex/codex`, CLAND_OPENCODE_BIN: `${fakes}/opencode/opencode`,
    CLAND_TEST_SKIP_ORPHAN_SWEEP: '1', CLAND_ADAPTER_POLL_MS: '200', CLAND_CLAUDE_AGENTS_MS: '500',
  });
  env = scratchAccountEnvironment(Q, env, { home: `${Q}/home2` });
  env = scratchGitEnvironment(Q, env, { excludesFile: `${Q}/home/.gitignore-global` });
  env = syntheticProviderEnvironment(env, { token, endpoint });
  console.log(JSON.stringify({ p2Environment: { homeMatches: env.HOME === `${Q}/home2`, stateMatches: env.XDG_STATE_HOME === `${Q}/home2`, executorOverrideAbsent: env.CLAND_EXECUTOR_STATE === undefined, provider: 'validated loopback synthetic' } }));
  const child = spawnSync(process.execPath, [`${W}/hub/bin/cland.ts`, 'hub', 'start'], { cwd: `${Q}/p2`, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  process.stdout.write(redact(child.stdout ?? ''));
  process.stderr.write(redact(child.stderr ?? ''));
  if (child.error) process.stderr.write(redact(String(child.error)) + '\n');
  process.exit(child.status ?? 1);
} catch (error) {
  process.stderr.write(redact(String(error)) + '\n');
  process.exit(2);
}
JS
node --check "$Q/launch-p2.mjs" && echo "p2 launcher checked"
```

The redaction filter. `redact()` is shared by the probe, the fake's driver and the `rd` shell filter, so no error text reaches a capture unredacted (rule 15). `$Q/secrets1538.json` is a list of `{kind, value}`; the fake's driver adds the sentinel token to it when it starts.

```sh
cat > "$Q/redact.mjs" <<'JS'
// redact(text): replace every known secret by its kind, then token/secret/password/cookie parameters, bearer values, JSON secret fields, any 64-hex run and any sentinel token
import { existsSync, readFileSync } from 'node:fs';
import { hostname } from 'node:os';
export const redact = (text, q = process.env.QA_Q) => {
  let t = String(text).split(hostname()).join('<native>');
  const file = `${q}/secrets1538.json`, known = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  for (const k of known) if (typeof k.value === 'string' && k.value.length >= 8) t = t.split(k.value).join(`<${k.kind}>`);
  return t
    .replace(/\b(token|cookie|password|secret|authorization|credential|challenge)=([^&\s"'<>]+)/gi, '$1=<redacted>')
    .replace(/("(?:token|secret|password|cookie|authorization)"\s*:\s*")[^"]*(")/gi, '$1<redacted>$2')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer <redacted>')
    .replace(/[0-9a-f]{64}/gi, '<hex64>')
    .replace(/cland-test-[a-z0-9-]+/g, '<do-sentinel>');
};
if (process.argv[1]?.endsWith('redact.mjs')) { let s = ''; process.stdin.on('data', d => { s += d; }).on('end', () => process.stdout.write(redact(s))); }
JS
node --check "$Q/redact.mjs" && echo "redact checked"
```

The fake provider's driver. It runs the repository's `fakeDigitalOcean` (an HTTP server on 127.0.0.1, token generated here with the `cland-test-` sentinel prefix) and a second loopback server for control. The control server answers only requests whose Host is 127.0.0.1. Ids of seeded droplets and keys are not returned by `/seed`; the probe reads them from `/state` (rule 22).

```sh
cat > "$Q/fakedo.mjs" <<'JS'
// node "$QA_Q/fakedo.mjs"   (sealed) the fake DigitalOcean API + a control server; /state /seed /snapshot /faults /requests
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const W = process.env.QA_W, Q = process.env.QA_Q;
if (!W || !Q?.startsWith('/private/tmp/qa-e1538s1-')) { console.log(JSON.stringify({ refused: 'not a scratch run' })); process.exit(2); }
const { fakeDigitalOcean } = await import(`${W}/hub/test/fakes/digitalocean/fake-api.ts`);
const token = `cland-test-qa1538-${randomBytes(6).toString('hex')}`;
const api = await fakeDigitalOcean(token);
if (!/^http:\/\/127\.0\.0\.1:[0-9]+\/v2$/.test(api.url)) { console.log(JSON.stringify({ refused: 'the fake is not on loopback' })); await api.close(); process.exit(2); }
const sf = `${Q}/secrets1538.json`, known = existsSync(sf) ? JSON.parse(readFileSync(sf, 'utf8')) : [];
known.push({ kind: 'do-token', value: token }); writeFileSync(sf, JSON.stringify(known), { mode: 0o600 });
writeFileSync(`${Q}/do.token`, `${token}\n`, { mode: 0o600 }); writeFileSync(`${Q}/do.url`, `${api.url}\n`);
const send = (res, value) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); };
const ctl = createServer(async (req, res) => {
  try {
    if (!/^127\.0\.0\.1:/.test(req.headers.host ?? '')) { res.writeHead(403); res.end(); return; }
    let body = ''; for await (const chunk of req) body += chunk;
    const j = body ? JSON.parse(body) : {};
    const path = new URL(req.url, 'http://x').pathname;
    if (path === '/state') return send(res, { droplets: api.droplets.map(d => ({ id: d.id, name: d.name, tags: d.tags })), keys: api.keys.map(k => ({ id: k.id, name: k.name })), images: api.images.map(i => ({ id: i.id, name: i.name })), requests: api.requests.length });
    if (path === '/seed') { const key = await api.provider.importKey(j.keyName, 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIQAA1538'); await api.provider.create({ name: j.dropletName, tags: j.tags, size: 'c-8', region: 'lon1', image: 1, ssh_keys: [key.id] }); return send(res, { seeded: true }); }
    if (path === '/snapshot') { api.images.push({ id: j.id, name: j.name, regions: ['lon1'], size_gigabytes: 1, min_disk_size: 25, created_at: new Date().toISOString() }); return send(res, { seeded: true }); }
    if (path === '/faults') { Object.assign(api.faults, j); return send(res, { set: Object.keys(j) }); }
    if (path === '/requests') return send(res, api.requests.slice(j.from ?? 0).map(r => ({ method: r.method, path: r.path })));
    res.writeHead(404); res.end();
  } catch (error) { res.writeHead(500); res.end(JSON.stringify({ error: String(error?.message ?? error).split(token).join('<do-token>') })); }
});
await new Promise(resolve => ctl.listen(0, '127.0.0.1', resolve));
writeFileSync(`${Q}/do.ctl`, `http://127.0.0.1:${ctl.address().port}\n`);
console.log(JSON.stringify({ ready: true }));
const stop = async () => { ctl.close(); await api.close().catch(() => {}); process.exit(0); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
await new Promise(() => {});
JS
node --check "$Q/fakedo.mjs" && echo "fakedo checked"
```

The probe. It prints one JSON line per fact (or one plain value where a shell comparison needs it) and never prints a token, a secret or a lock's token. Modes:

- `foreignpre`: fixture-owned PID census and an authenticated p1 socket probe must show no local hub; capture the separately planted foreign holder's hostname, heartbeat age and fresh/lapsed state. This does not use `up()` as a local-liveness assertion.
- `nativehostfacts <status.json>`: assert `hostname` equals `os.hostname()` and print only `nativeHostnameMatches`; captured output masks the native hostname as `<native>` and preserves synthetic `.invalid` hostnames.
- `hostid`, `lockfacts <lock>`, `heartbeat <lock> <secs> <ms>`, `contend <lock> <attempts> <gapSec>`: the native identity, a lock record's facts, a sampler of the lock file, and a foreign contender calling `acquireLock` on the real lock with a process table that throws on any pid but its own;
- `plant <root> <variant> <ageSec> <pid> <hubjson 0|1|keep>`, `plantclear <root>`, `sha <files…>`: planted lock records (`all`, `hostname`, `bootId`, `pidNamespace`, `successor`, `same`, `same-live`, `legacy-pid`, `legacy-started`, `legacy-startedUtc`, `legacy-token`), their digests;
- `rows <doctor.json> <names…>`, `psused <log> <pid>`, `cfgsha <status.json>`, `statusfacts <status.json>`, `tag <root>`, `sockform`, `roots`: readers of CLI output;
- `legacy`, `ledgers`, `homelist`, `fsscan <control>`, `scan <control>`: the legacy ledger plant and the state-path and secret scans (each with its positive control);
- `ctl <cmd> [json]`, `ids <droplet name> <key name>`, `mark <name>`, `seg <name>`, `client`: the fake provider's control and the client probe.

```sh
cat > "$Q/probe.mjs" <<'JS'
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { basename, join, relative, sep } from 'node:path';
import { redact } from './redact.mjs';
const [mode, a1, a2, a3, a4, a5] = process.argv.slice(2);
const W = process.env.QA_W, Q = process.env.QA_Q, EV = process.env.QA_EV;
if (!W || !Q || !Q.startsWith('/private/tmp/qa-e1538s1-')) { console.log(JSON.stringify({ refused: 'not a scratch run' })); process.exit(2); }
appendFileSync(`${Q}/pids`, `${process.pid}\n`);
const out = (key, value) => console.log(redact(JSON.stringify({ [key]: value })));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha12 = file => existsSync(file) ? createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 12) : 'absent';
const inScratch = path => path.startsWith(`${Q}/`);
const identity = async () => (await import(`${W}/hub/src/hub/lock-identity.ts`)).lockHostIdentity();
const FOREIGN = { hostname: 'qa-foreign.invalid', bootId: '00000000-0000-4000-8000-000000001538', pidNamespace: 'pid:[4026531838]' };
const STARTED = 'Mon Nov  2 10:00:00 2026';
const ctl = async (cmd, body) => {
  const base = readFileSync(`${Q}/do.ctl`, 'utf8').trim();
  if (!/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(base)) throw new Error('the control endpoint is not loopback');
  return (await fetch(`${base}/${cmd}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) })).json();
};
switch (mode) {
  // brief correction (foreign-holder preconditions), coord-authorised 8634e86a
  case 'foreignpre': {
    const root = `${Q}/p1`;
    if (process.cwd() !== root) throw new Error('foreignpre requires p1');
    const pids = [...new Set(readFileSync(`${Q}/pids`, 'utf8').split(/\s+/).filter(Boolean).map(Number))];
    let localFixtureHubs = 0;
    for (const pid of pids) {
      try {
        const cmd = execFileSync('/bin/ps', ['-p', String(pid), '-o', 'command='], {encoding:'utf8', stdio:['ignore','pipe','ignore']});
        if (cmd.includes(`${W}/hub/bin/cland.ts`) && /\bhub serve\b/.test(cmd)) localFixtureHubs++;
      } catch (error) { if (error.status !== 1) throw error; }
    }
    const discoveryFile = `${root}/.cland/hub.json`;
    let socketAnswers = false;
    if (existsSync(discoveryFile)) {
      const d = JSON.parse(readFileSync(discoveryFile, 'utf8'));
      if (d.root !== root) throw new Error('foreignpre discovery root is not p1');
      const tmp = process.env.TMPDIR;
      if (!d.socket.startsWith(`${root}/.cland/`) && !(tmp && d.socket.startsWith(tmp) && /\/cland-[0-9a-f]{16}\.sock$/.test(d.socket))) throw new Error('foreignpre socket outside fixture paths');
      const { probe } = await import(`${W}/hub/src/cli/socket-client.ts`);
      socketAnswers = await probe(d, 1500);
    }
    const { readForeignHolder } = await import(`${W}/hub/src/hub/lock.ts`);
    const holder = readForeignHolder(`${root}/.cland/hub.lock`);
    out('PRE local fixture', {ownedPidsChecked:pids.length, localFixtureHubs, socketAnswers});
    out('PRE foreign holder', holder ? {hostname:holder.holder.hostIdentity.hostname, heartbeatAgeMs:holder.ageMs, state:holder.active?'fresh':'lapsed'} : {present:false});
    if (localFixtureHubs !== 0 || socketAnswers || !holder) process.exit(2);
    break;
  }
  // brief correction (native hostname capture), coord-authorised 8634e86a
  case 'nativehostfacts': {
    const v=JSON.parse(readFileSync(a1,'utf8'));
    const nativeHostnameMatches=v.hostname===hostname();
    out('nativeHostnameMatches',nativeHostnameMatches);
    if (!nativeHostnameMatches) process.exit(2);
    break;
  }

  case 'hostid': {
    const id = await identity();
    const sysctl = process.platform === 'darwin' ? execFileSync('/usr/sbin/sysctl', ['-n', 'kern.bootsessionuuid'], { encoding: 'utf8' }).trim() : null;
    out('identity', { platform: process.platform, hostnameIsOsHostname: id.hostname === hostname(), bootIdLength: id.bootId?.length ?? null, bootIdIsSysctl: sysctl === null ? null : id.bootId === sysctl, pidNamespace: id.pidNamespace });
    break;
  }
  case 'lockfacts': {
    const id = await identity(), rec = JSON.parse(readFileSync(a1, 'utf8'));
    const hubPid = existsSync('.cland/hub.json') ? JSON.parse(readFileSync('.cland/hub.json', 'utf8')).pid : null;
    const h = rec.hostIdentity ?? {};
    out('lock', { keys: Object.keys(rec).sort(), pidIsHub: rec.pid === hubPid, hostIdentityKeys: Object.keys(h).sort(), hostIdentityIsNative: h.hostname === id.hostname && h.bootId === id.bootId && h.pidNamespace === id.pidNamespace, heartbeatIso: /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(String(rec.heartbeat)), heartbeatAgeMs: Date.now() - Date.parse(rec.heartbeat), tokenLength: String(rec.token ?? '').length, startedType: typeof rec.started });
    break;
  }
  case 'heartbeat': {
    const end = Date.now() + Number(a2) * 1000, gap = Number(a3);
    let reads = 0, absent = 0, bad = 0, maxAge = 0; const beats = new Set(), tokens = new Set();
    while (Date.now() < end) {
      try { const rec = JSON.parse(readFileSync(a1, 'utf8')); reads++; beats.add(rec.heartbeat); tokens.add(rec.token); maxAge = Math.max(maxAge, Date.now() - Date.parse(rec.heartbeat)); }
      catch (error) { if (error.code === 'ENOENT') absent++; else bad++; }
      await sleep(gap);
    }
    out('heartbeat', { seconds: Number(a2), reads, absent, unparsable: bad, distinctHeartbeats: beats.size, distinctTokens: tokens.size, maxAgeMs: maxAge });
    break;
  }
  case 'contend': {
    const { acquireLock } = await import(`${W}/hub/src/hub/lock.ts`);
    const hostIdentity = { ...(await identity()), hostname: 'qa-contender.invalid' };   // a synthetic foreign identity: the identity-negative check
    const own = pid => { if (pid !== process.pid) throw new Error('a foreign pid was probed'); };
    const processes = { alive: pid => { own(pid); return true; }, started: pid => { own(pid); return 'qa-contender-start'; } };
    const t0 = Date.now();
    for (let i = 1; i <= Number(a2); i++) {
      const before = Date.now() - Date.parse(JSON.parse(readFileSync(a1, 'utf8')).heartbeat);
      let result;
      try { const lock = acquireLock(a1, processes, { hostIdentity }); lock.release(); result = 'ACQUIRED'; }
      catch (error) { result = error?.constructor?.name === 'HubLocked' ? 'HubLocked' : `error: ${redact(error?.message ?? error)}`; }
      out(`attempt ${i}`, { atSec: Math.round((Date.now() - t0) / 1000), heartbeatAgeMsBefore: before, result });
      if (result === 'ACQUIRED') break;
      if (i < Number(a2)) await sleep(Number(a3) * 1000);
    }
    break;
  }
  case 'plant': {
    const root = a1, ageSec = Number(a3), pid = Number(a4);
    if (!inScratch(root)) { out('refused', 'not a scratch project'); process.exit(2); }
    const local = await identity(), heartbeat = new Date(Date.now() - ageSec * 1000).toISOString();
    const rec = {
      all: { pid, started: null, token: 'qa-foreign-token', hostIdentity: FOREIGN, heartbeat },
      hostname: { pid, started: null, token: 'qa-foreign-token', hostIdentity: { ...local, hostname: FOREIGN.hostname }, heartbeat },
      bootId: { pid, started: null, token: 'qa-foreign-token', hostIdentity: { ...local, bootId: FOREIGN.bootId }, heartbeat },
      pidNamespace: { pid, started: null, token: 'qa-foreign-token', hostIdentity: { ...local, pidNamespace: FOREIGN.pidNamespace }, heartbeat },
      successor: { pid, started: null, token: 'qa-successor-token', hostIdentity: { ...FOREIGN, hostname: 'qa-successor.invalid' }, heartbeat },
      same: { pid, started: null, token: 'qa-same-host-token', hostIdentity: local, heartbeat },
      'same-live': { pid, started: STARTED, token: 'qa-same-host-token', hostIdentity: local, heartbeat },
      'legacy-pid': { pid },
      'legacy-started': { pid, started: STARTED },
      'legacy-startedUtc': { pid, started: STARTED, startedUtc: STARTED },
      'legacy-token': { pid, started: STARTED, startedUtc: STARTED, token: 'qa-legacy-token' },
    }[a2];
    if (!rec) { out('refused', `unknown variant ${a2}`); process.exit(2); }
    const lock = `${root}/.cland/hub.lock`;
    writeFileSync(`${lock}.qa-tmp`, `${JSON.stringify(rec)}\n`, { mode: 0o600 }); renameSync(`${lock}.qa-tmp`, lock);   // replaced whole, as the heartbeat does
    const hubJson = `${root}/.cland/hub.json`;
    if (a5 === 'keep') { /* the live hub's own hub.json stays */ }
    else if (a5 === '1') writeFileSync(hubJson, JSON.stringify({ root, socket: `${root}/.cland/absent.sock`, port: 1, secret: 'qa-planted-not-a-secret', pid, version: 'qa' }), { mode: 0o600 });
    else rmSync(hubJson, { force: true });
    out('planted', { variant: a2, ageSec, lockSha12: sha12(lock), hubJsonSha12: a5 === '1' ? sha12(hubJson) : null, hubJson: a5 });
    break;
  }
  case 'plantclear': {
    if (!inScratch(a1)) { out('refused', 'not a scratch project'); process.exit(2); }
    rmSync(`${a1}/.cland/hub.lock`, { force: true }); rmSync(`${a1}/.cland/hub.json`, { force: true }); out('cleared', true);
    break;
  }
  case 'sha': console.log(process.argv.slice(3).map(sha12).join('+')); break;
  case 'rows': {
    const j = JSON.parse(readFileSync(a1, 'utf8'));
    for (const name of process.argv.slice(4)) for (const c of j.checks.filter(x => x.name === name)) out(`row ${name}`, { verdict: c.verdict, detail: String(c.detail).replaceAll(Q, '<Q>'), fix: c.fix ? String(c.fix).replaceAll(Q, '<Q>') : null });
    break;
  }
  case 'psused': {
    // log lines are "<caller pid> <ps argv>"; a holder-specific call has a -p list that is just the foreign pid. Census batches (-p over all local pids, decoy included) are counted apart.
    const lines = existsSync(a1) ? readFileSync(a1, 'utf8').split('\n').filter(Boolean) : [];
    const rows = lines.map(l => { const [ppid, ...argv] = l.split(' '); const i = argv.findIndex(t => t === '-p'); return { ppid, pids: i >= 0 && argv[i + 1] ? argv[i + 1].split(',') : [] }; });
    const holder = rows.filter(r => r.pids.length === 1 && r.pids[0] === a2);
    out('psCalls', { total: lines.length, holderCalls: holder.length, censusBatchesNamingPid: rows.filter(r => r.pids.length > 1 && r.pids.includes(a2)).length, holderCallParents: [...new Set(holder.map(r => r.ppid))] });
    break;
  }
  case 'cfgsha': {
    const v = JSON.parse(readFileSync(a1, 'utf8'));
    out('config', { present: v.config !== undefined, sha12: createHash('sha256').update(JSON.stringify(v.config ?? null)).digest('hex').slice(0, 12) });
    break;
  }
  case 'statusfacts': {
    const v = JSON.parse(readFileSync(a1, 'utf8'));
    out('status', { tokenPresent: v.token, spendPath: String(v.spend?.path).replaceAll(Q, '<Q>'), spent: v.spend?.spent, reserved: v.spend?.reserved, cap: v.spend?.cap, legacyRetirement: v.spend?.legacyRetirement ?? null });
    break;
  }
  case 'tag': {
    const { parseConfig } = await import(`${W}/hub/src/init/config.ts`), { projectTag } = await import(`${W}/hub/src/executor/droplet/droplet.ts`);
    process.stdout.write(projectTag(a1, parseConfig(readFileSync(`${a1}/.cland/config.toml`, 'utf8'), basename(a1)).name));
    break;
  }
  case 'sockform': {
    const socket = JSON.parse(readFileSync('.cland/hub.json', 'utf8')).socket, tmp = process.env.TMPDIR ?? '';
    out('socket', { insideProject: socket.startsWith(`${process.cwd()}/.cland/`), tmpdirFallback: socket.startsWith(tmp) && /\/cland-[0-9a-f]{16}\.sock$/.test(socket) });
    break;
  }
  case 'roots': {
    const { hubDiscovery, projectRoot } = await import(`${W}/hub/src/project.ts`);
    for (const p of ['p1', 'p2', 'p3']) out(`root ${p}`, { discovery: hubDiscovery(`${Q}/${p}`).replace(Q, '<Q>'), root: projectRoot(`${Q}/${p}`).replace(Q, '<Q>') });
    break;
  }
  case 'legacy': {   // a legacy ledger in the scratch HOME: one settled entry released today
    const dir = `${Q}/home2/.cland/executor`; mkdirSync(dir, { recursive: true });
    const now = new Date().toISOString();
    writeFileSync(`${dir}/spend.json`, JSON.stringify({ version: 1, entries: [{ project: '/qa/legacy-project', lease: 'qa-legacy-1', run: 'qa-run', size: 'c-8', reservation: 0.5, cost: 0.07, created: now, deadline: now, released: now }] }));
    out('legacy', { planted: true, sha12: sha12(`${dir}/spend.json`) });
    break;
  }
  case 'ledgers': {
    const has = file => { if (!existsSync(file)) return { exists: false }; const l = JSON.parse(readFileSync(file, 'utf8')); return { exists: true, legacyEntryKept: l.entries.some(e => e.lease === 'qa-legacy-1' && e.cost === 0.07), legacyRetired: l.legacyRetired ?? null }; };
    out('ledger new', has(`${Q}/home2/cland/spend.json`)); out('ledger legacy', has(`${Q}/home2/.cland/executor/spend.json`));
    break;
  }
  case 'homelist': {
    const files = []; const walk = d => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (e.isFile()) files.push(relative(`${Q}/home2`, p)); } };
    walk(`${Q}/home2`); out('home2 files', files.sort().slice(0, 40));
    break;
  }
  case 'fsscan': {   // regular files newer than the marker under $Q, outside the scratch projects, HOMEs and the sealed environment's own directories
    const control = a1 === '1', marker = statSync(`${Q}/marker`).mtimeMs;
    const allowed = new Set(['p1', 'p2', 'p3', 'home', 'home2', 'xdg', 'psshim', 'psfail', 'b']);
    for (const value of Object.values(process.env)) if (typeof value === 'string' && value.startsWith(`${Q}/`)) allowed.add(value.slice(Q.length + 1).split('/')[0]);
    if (control) { mkdirSync(`${Q}/stray`, { recursive: true }); writeFileSync(`${Q}/stray/control.txt`, 'control\n'); }
    const hits = [];
    const walk = d => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (e.isFile() && statSync(p).mtimeMs >= marker) hits.push(relative(Q, p)); } };
    for (const e of readdirSync(Q, { withFileTypes: true })) if (e.isDirectory() && !allowed.has(e.name)) walk(`${Q}/${e.name}`);
    if (control) { unlinkSync(`${Q}/stray/control.txt`); rmdirSync(`${Q}/stray`); }
    out('escapes', { control, allowedDirs: [...allowed].sort(), hits });
    break;
  }
  case 'scan': {   // secrets in the evidence and the logs; the positive control is a file holding every value, planted in p2's log directory
    const control = a1 === '1', ctlFile = `${Q}/p2/.cland/log/qa-scan-control.txt`;
    const secrets = [['do-token', 'fake', readFileSync(`${Q}/do.token`, 'utf8').trim()]];
    for (const p of ['p1', 'p2', 'p3']) { const f = `${Q}/${p}/.cland/secret`; if (existsSync(f)) secrets.push(['hub-secret', p, readFileSync(f, 'utf8').trim()]); }
    mkdirSync(`${Q}/p2/.cland/log`, { recursive: true });
    if (control) writeFileSync(ctlFile, `${secrets.map(s => s[2]).join('\n')}\n`, { mode: 0o600 });
    const skip = new Set(['secret', 'hub.json', 'territory.git', 'worktrees', '.git']);
    const collect = roots => { const files = []; const walk = p => { if (!existsSync(p)) return; const st = statSync(p); if (st.isDirectory()) { for (const e of readdirSync(p)) if (!skip.has(e)) walk(join(p, e)); } else if (st.isFile()) files.push(p); }; roots.forEach(walk); return files; };
    const sets = {
      'do-token': collect([`${Q}/p2/.cland`, `${Q}/home2`, EV, `${Q}/fakedo.out`]),
      'hub-secret': collect([`${Q}/p1/.cland/log`, `${Q}/p1/.cland/journal.jsonl`, `${Q}/p2/.cland/log`, `${Q}/p2/.cland/journal.jsonl`, `${Q}/p3/.cland/log`, `${Q}/p3/.cland/journal.jsonl`, EV, `${Q}/fakedo.out`]),
    };
    const kinds = {};
    for (const [kind, label, value] of secrets) {
      const k = kinds[kind] ??= { kind, sentinels: 0, tooShort: 0, hits: [] };
      if (value.length < 12) { k.tooShort += 1; continue; }
      k.sentinels += 1;
      for (const f of sets[kind]) if (readFileSync(f).includes(value)) k.hits.push(`${label}: ${f.replace(Q, '<Q>').replace(EV, '<EV>')}`);
    }
    for (const k of Object.values(kinds)) out('scan', { ...k, filesScanned: sets[k.kind].length });
    if (control) { unlinkSync(ctlFile); out('controlRemoved', !existsSync(ctlFile)); }
    break;
  }
  case 'ctl': out(a1, await ctl(a1, a2 ? JSON.parse(a2) : {})); break;
  case 'ids': {   // rule 22: ids come from the fake's state listing, one per file with a trailing newline
    const s = await ctl('state'), d = s.droplets.filter(x => x.name === a1), k = s.keys.filter(x => x.name === a2);
    if (d.length === 1) writeFileSync(`${Q}/drop.id`, `${d[0].id}\n`);
    if (k.length === 1) writeFileSync(`${Q}/key.id`, `${k[0].id}\n`);
    out('saved', { dropletMatches: d.length, keyMatches: k.length });
    break;
  }
  case 'mark': { const s = await ctl('state'); writeFileSync(`${Q}/mark-${a1}`, `${s.requests}\n`); out('mark', { name: a1, at: s.requests }); break; }
  case 'seg': {
    const rows = await ctl('requests', { from: Number(readFileSync(`${Q}/mark-${a1}`, 'utf8')) });
    const d = readFileSync(`${Q}/drop.id`, 'utf8').trim(), k = readFileSync(`${Q}/key.id`, 'utf8').trim();
    const seq = p => rows.filter(r => r.path === p).map(r => r.method).join(',');
    out('segment', { dropletSeq: seq(`/v2/droplets/${d}`), keySeq: seq(`/v2/account/keys/${k}`), dropletLists: rows.filter(r => r.method === 'GET' && r.path.startsWith('/v2/droplets?')).length, keyLists: rows.filter(r => r.method === 'GET' && r.path.startsWith('/v2/account/keys?')).length, deletes: rows.filter(r => r.method === 'DELETE').length });
    break;
  }
  case 'client': {   // the repository's DigitalOcean client against the fake: GET by id, the DELETE-404-while-GET-200 fault, the confirming second attempt
    const url = readFileSync(`${Q}/do.url`, 'utf8').trim();
    if (!/^http:\/\/127\.0\.0\.1:[0-9]+\/v2$/.test(url)) { out('refused', 'the endpoint is not the loopback fake'); process.exit(2); }
    const { DigitalOceanApi, DeletionUnconfirmed } = await import(`${W}/hub/src/executor/droplet/api.ts`);
    const api = new DigitalOceanApi({ DIGITALOCEAN_TOKEN: readFileSync(`${Q}/do.token`, 'utf8').trim(), CLAND_DIGITALOCEAN_API: url });
    for (const n of ['1', '2']) await ctl('seed', { keyName: `qa-c-key-${n}`, dropletName: `qa-c-drop-${n}`, tags: ['qa1538'] });
    await ctl('snapshot', { id: 9150, name: 'qa-c-snap-1' });
    const state = await ctl('state'), idOf = (list, name) => list.find(x => x.name === name)?.id ?? null;
    const D1 = idOf(state.droplets, 'qa-c-drop-1'), D2 = idOf(state.droplets, 'qa-c-drop-2'), K1 = idOf(state.keys, 'qa-c-key-1'), S1 = 9150;
    const present = async (list, id) => (await ctl('state'))[list].some(x => x.id === id);
    const attempt = async work => { try { await work(); return { outcome: 'resolved' }; } catch (error) { return { outcome: 'rejected', unconfirmed: error instanceof DeletionUnconfirmed, status: error?.status ?? null, accepted: error?.accepted ?? null }; } };
    out('get by id', { droplet: (await api.droplet(D1)).id === D1, key: (await api.key(K1)).id === K1, snapshot: (await api.snapshot(S1)).id === S1, absentKey: await attempt(() => api.key(99999)) });
    await ctl('faults', { dropletDelete404Reads: 1, keyDelete404Reads: 1, snapshotDelete404Reads: 1 });
    for (const [kind, list, id, del] of [['droplet', 'droplets', D1, i => api.deleteDroplet(i)], ['key', 'keys', K1, i => api.deleteKey(i)], ['snapshot', 'images', S1, i => api.deleteSnapshot(i)]]) {
      const first = await attempt(() => del(id)), stillPresent = await present(list, id);
      const second = await attempt(() => del(id)), goneAfter = !(await present(list, id));
      out(`fault ${kind}`, { first, stillPresentAfterFirst: stillPresent, second, goneAfterSecond: goneAfter });
    }
    await ctl('faults', { dropletDelete404Reads: 0, keyDelete404Reads: 0, snapshotDelete404Reads: 0 });
    out('control plain delete', { outcome: await attempt(() => api.deleteDroplet(D2)), gone: !(await present('droplets', D2)) });
    out('control absent id', await attempt(() => api.deleteKey(99999)));
    break;
  }
  default: out('refused', `unknown mode ${mode}`); process.exit(2);
}
process.exit(0);
JS
node --check "$Q/probe.mjs" && echo "probe checked"
```

**Web build precondition (E1538S1-19).** `hub/test/doctor-cli.test.ts` requires the web bundle stamp, and a fresh detached worktree has no `web/dist`. After `$Q/env.sh` exists and before any `nt` row, build once in `$W` under the sealed environment, after `quiet` and `ld`, and check the stamp:

```sh
quiet && ld && ( . "$Q/env.sh"; cd "$W" && npm run build ) > "$EV/S0-build.txt" 2>&1; echo "build exit $?"
node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));if(s.version!==1||typeof s.sources!=="string"||!s.builtAt)process.exit(1);console.log("web build stamp ok")' "$W/web/dist/build-stamp.json" || echo "BLOCKED: web build stamp missing or invalid"
```

The check functions. Define them in QA's own shell (paste the block once). Rows that run on a scratch project call them as `( . "$Q/env.sh"; cd "$Q/p1" && <function> ) > "$EV/<id>.txt" 2>&1`; read the capture, then record it. The rows with real-time waits (E1538S1-03, E1538S1-05, E1538S1-11, E1538S1-14) need a command timeout of at least 600000 ms.

```sh
m00() {   # QA's own shell: build, membership, landings, the root's status
  echo "PRE: HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) want $S"
  echo "dirty entries $(git -C "$W" status --porcelain | grep -v -x '?? node_modules' | wc -l | tr -d ' ')"
  echo "root entries outside .cland/tasks: $(git -C "$R" status --porcelain | grep -v -F '.cland/tasks/' | wc -l | tr -d ' ')"
  (cd "$R" && node hub/bin/cland.ts task plan show E-1538 --json) > "$EV/E1538S1-00-plan.json"
  node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=p.stages.find(x=>x.name==="lock, deletion and paths");console.log(JSON.stringify({state:s.state,qa:s.qa,items:s.items,merged:s.merged,total:s.total,statuses:s.statuses,cover:s.cover}))' "$EV/E1538S1-00-plan.json"
  for id in $(node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(p.stages.find(x=>x.name==="lock, deletion and paths").items.join(" "))' "$EV/E1538S1-00-plan.json"); do
    echo "$id landings: $(git -C "$R" log --first-parent --format=%H --grep "^Item: $id\$" "$S" | tr '\n' ' ')"; done
}
m01() {   # QA's own shell, read-only in $W: preserved tests, the files each landing touched, source strings
  echo "PRE: HEAD $(git -C "$W" rev-parse HEAD)"
  land() { git -C "$W" log --first-parent --format=%H --grep "^Item: $1\$" HEAD | head -n 1; }
  chk() { id=$1; shift; L=$(land "$id"); if [ -z "$L" ]; then echo "$id edited preserved files: NOT LANDED"; return; fi; echo "$id edited preserved files: $(git -C "$W" diff --name-only "$L^1" "$L" -- "$@" | wc -l | tr -d ' ')"; }
  chk T-1615 hub/test/daemon.test.ts hub/test/edges.test.ts hub/test/startup-cleanup.test.ts hub/test/territory-lock.test.ts hub/test/executor-spend.test.ts
  chk T-1616 hub/test/daemon.test.ts hub/test/startup-cleanup.test.ts
  chk T-1617 hub/test/edges.test.ts hub/test/orphan-servers.test.ts hub/test/doctor.test.ts hub/test/doctor-cli.test.ts
  chk T-1618 hub/test/executor-droplet.test.ts hub/test/executor-droplet-component.test.ts hub/test/executor-safety.test.ts
  chk T-1620 hub/test/executor-prepare.test.ts hub/test/executor-prepare-component.test.ts
  chk T-1621 hub/test/executor-spend.test.ts
  L=$(land T-1615); echo "T-1615 source files changed (only the hub lock, its identity reader and the daemon's acquire call): $(git -C "$W" diff --name-only "$L^1" "$L" -- hub/src | sort | tr '\n' ' ')"
  ( cd "$W"
    echo "lock constants (2): $(grep -c -E 'HUB_LOCK_HEARTBEAT_MS = 10_000|HUB_LOCK_LAPSE_MS = 60_000' hub/src/hub/lock.ts)"
    echo "hub-lock-lost event (1): $(grep -c -F "event: 'hub-lock-lost'" hub/src/hub/daemon.ts)"
    echo "Linux boot id reader import (1): $(grep -c -F "readLinuxBootIdSync } from '../process-identity.ts'" hub/src/hub/lock-identity.ts)"
    echo "macOS boot id key (1): $(grep -c -F 'kern.bootsessionuuid' hub/src/hub/lock-identity.ts)"
    echo "foreign holder wording (1 once T-1617 landed): $(grep -c -F 'hub on another host' hub/src/hub/lock.ts)"
    echo "unconfirmed reap event (1): $(grep -c -F "event: 'executor-reap-unconfirmed'" hub/src/executor/droplet/droplet.ts)"
    echo "client deletions through the GET confirmation (3 calls): $(grep -c -E 'return this.#confirmedDelete|await this.#confirmedDelete|#confirmedDelete\(`' hub/src/executor/droplet/api.ts)"
    echo "client GET by id for a key and a snapshot (2): $(grep -c -E 'async (key|snapshot)\(id: number' hub/src/executor/droplet/api.ts)"
    echo "spend path through the resolver (at least 1): $(grep -c -F 'userStateDirectory(env)' hub/src/executor/droplet/spend.ts)"
    echo "transport kind type declarations (1, `^export type TransportKind` only: records.ts has a type-only import): $(grep -rn '^export type TransportKind' hub/src | wc -l | tr -d ' ')"
    echo "transport parser call sites (at least 2): $(grep -rn 'parseTransportKind(' hub/src | grep -v 'export function' | wc -l | tr -d ' ')"
    echo "transport messages (1 1): $(grep -c -F 'outbound transport requires 0.4.x' hub/src/host/transport-kind.ts) $(grep -c -F 'ssh is the only transport 0.4.0 accepts' hub/src/host/transport-kind.ts)"
    echo "doctor ps row (at least 1): $(grep -c -F 'procps' hub/src/doctor/toolchain.ts)"
    echo "install docs procps line (1): $(grep -c -F '`procps` (Linux)' site/src/content/docs/docs/install.md)" )
}
m02() {   # p1: init, native hub start, the lock record, the heartbeat sampler
  echo "PRE: p1 entries $(ls -A | wc -l | tr -d ' '); fakes $(ls "$FCC/claude" "$FCX/codex" "$FOC/opencode" | wc -l | tr -d ' '); node $(node --version); credential-prefix names $(env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)')"
  ld || return 1
  : > "$QA_Q/marker"
  git init -q -b dev && git config user.name 'QA One' && git commit -q --allow-empty -m init
  cland init . > "$QA_EV/E1538S1-02-init.txt" 2>&1; echo "init exit $?"
  [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; cland hub stop > /dev/null 2>&1
  sed -i '' -e "s|^lock_path = .*|lock_path = \"$QA_Q/p1-suite.lock\"|" -e 's|^executor = .*|executor = "local"|' .cland/config.toml
  echo "lock $(grep -c -x "lock_path = \"$QA_Q/p1-suite.lock\"" .cland/config.toml) executor $(grep -c -x 'executor = "local"' .cland/config.toml)"
  decoy; echo "decoy alive $(alive "$(cat "$QA_Q/decoy.pid")")"
  probe hostid
  hubstart; echo "hub start exit $?"
  probe lockfacts .cland/hub.lock
  probe heartbeat .cland/hub.lock 35 50
}
m03() {   # p1, hub up from m02: a synthetic foreign contender (identity-negative) every 20 s for 160 s of real time
  echo "PRE: hub $(up); lock present $(test -f .cland/hub.lock && echo 1 || echo 0)"
  ld || return 1
  probe contend .cland/hub.lock 8 20
  probe lockfacts .cland/hub.lock
  echo "hub after the contender: $(up)"
}
m04() {   # p1: a normal stop clears the timer and removes the lock
  echo "PRE: hub $(up)"; P=$(hp)
  run "hub stop" cland hub stop; sleep 15
  echo "lock after stop: $(test -e .cland/hub.lock && echo present || echo absent); guard directory: $(test -e .cland/hub.lock.break && echo present || echo absent)"
  echo "hub pid alive: $(alive "$P")"
  echo "heartbeat failures logged: $(grep -c -F 'hub-lock-heartbeat-failed' .cland/log/hub.log); lost-lock events: $(grep -c -F 'hub-lock-lost' .cland/log/hub.log)"
  echo "stopping events logged: $(grep -c -E '"event": ?"stopping"' .cland/log/hub.log)"
}
m05() {   # p1: the lost-lock stop; the successor is a synthetic foreign record (identity-negative)
  ld || return 1
  decoy; D=$(cat "$QA_Q/decoy.pid")   # detached and started here: this row does not rely on a process left by an earlier row's shell
  hubstart; echo "hub start exit $?"; P=$(hp)
  echo "PRE: hub $(up); decoy alive $(alive "$D")"
  [ "$(alive "$D")" = yes ] || { echo "BLOCKED: decoy not alive before the action"; return 1; }
  probe plant "$PWD" successor 0 "$D" keep
  SHA=$(probe sha .cland/hub.lock)
  for i in $(seq 1 45); do kill -0 "$P" 2> /dev/null || break; sleep 1; done
  echo "hub pid alive after the wait: $(alive "$P") (waited $i s)"
  echo "lock still the successor's: $([ "$(probe sha .cland/hub.lock)" = "$SHA" ] && echo yes || echo no)"
  echo "hub-lock-lost lines: $(grep -c -E '"event": ?"hub-lock-lost"' .cland/log/hub.log)"
  echo "a stopping line follows the last hub-lock-lost line: $(awk '/"event": ?"hub-lock-lost"/{l=NR} /"event": ?"stopping"/{s=NR} END{print (l>0 && s>l) ? "yes" : "no"}' .cland/log/hub.log)"
  echo "decoy alive $(alive "$D")"
}
drows() {   # doctor --json for this project, the named rows only; no --fix, ever
  PS_LOG="$QA_Q/ps-calls.log" PATH="$QA_Q/psshim:$FCC:$FCX:$FOC:$PATH" cland doctor . --json > "$QA_Q/doctor.json" 2> "$QA_Q/doctor.err"; echo "doctor exit $?"
  probe rows "$QA_Q/doctor.json" "$@"
}
m06() {   # p1: a fresh foreign holder (synthetic identity: identity-negative), then the same readers; a ps shim logs every ps call
  D=$(cat "$QA_Q/decoy.pid")
  probe foreignpre || return 1
  echo "PRE: decoy alive $(alive "$D"); holder planted next"
  echo "-- control: a same-host record naming the decoy must make the readers ask ps about it (a holder-specific call)"
  : > "$QA_Q/ps-calls.log"; probe plant "$PWD" same-live 5 "$D" 1; psrun run "status, same-host record" cland hub status; probe psused "$QA_Q/ps-calls.log" "$D"
  echo "-- the fresh foreign holder"
  : > "$QA_Q/ps-calls.log"; probe plant "$PWD" all 5 "$D" 1; S1=$(probe sha .cland/hub.lock .cland/hub.json)
  psrun run "hub start" cland hub start; echo "second hub started: $(census p1) processes name p1"
  psrun run "hub status" cland hub status
  psrun run "hub status --json" cland hub status --json
  psrun run "hub stop" cland hub stop
  drows hub hub.json
  probe psused "$QA_Q/ps-calls.log" "$D"
  echo "lock and hub.json unchanged: $([ "$(probe sha .cland/hub.lock .cland/hub.json)" = "$S1" ] && echo yes || echo no)"
  echo "decoy alive $(alive "$D")"
}
m07() {   # p1: each identity part alone, the same-host control, the older record shapes; hub.json absent throughout
  D=$(cat "$QA_Q/decoy.pid"); DEAD=$(sh -c 'echo $$')
  probe foreignpre || return 1
  echo "PRE: dead pid alive $(alive "$DEAD")"
  for v in hostname bootId pidNamespace; do probe plant "$PWD" "$v" 5 "$D" 0; run "status --json, only $v differs" cland hub status --json; if [ "$v" != hostname ]; then probe nativehostfacts "$QA_Q/r.out" || return 1; fi; done
  probe plant "$PWD" same 5 "$DEAD" 0; run "status, same-host identity, dead pid" cland hub status
  for v in legacy-pid legacy-started legacy-startedUtc legacy-token; do probe plant "$PWD" "$v" 0 "$DEAD" 0; run "status, $v" cland hub status; done
  echo "decoy alive $(alive "$D")"
}
m08() {   # p1: a lapsed foreign holder (synthetic identity: identity-negative); the readers, a dry-run migrate that takes the lock, then a start that takes it whole
  D=$(cat "$QA_Q/decoy.pid")
  echo "PRE: hub $(up) (down expected); decoy alive $(alive "$D")"
  : > "$QA_Q/ps-calls.log"; probe plant "$PWD" all 120 "$D" 1; S1=$(probe sha .cland/hub.lock .cland/hub.json)
  psrun run "hub status" cland hub status
  psrun run "hub status --json" cland hub status --json
  psrun run "hub stop" cland hub stop
  drows hub hub.json
  echo "lock and hub.json unchanged by the readers: $([ "$(probe sha .cland/hub.lock .cland/hub.json)" = "$S1" ] && echo yes || echo no)"
  psrun run "task migrate --dry-run" cland task migrate --dry-run
  echo "lock after the dry run: $(test -e .cland/hub.lock && echo present || echo absent)"
  probe plant "$PWD" all 120 "$D" 1
  run "hub start" hubstart
  probe lockfacts .cland/hub.lock
  echo "planted token gone: $(grep -c -F 'qa-foreign-token' .cland/hub.lock); guard directory: $(test -e .cland/hub.lock.break && echo present || echo absent)"
  probe psused "$QA_Q/ps-calls.log" "$D"
  echo "decoy alive $(alive "$D")"
}
m09() {   # p1: offline migrate against a fresh foreign holder (synthetic identity: identity-negative)
  D=$(cat "$QA_Q/decoy.pid")
  cland hub stop > /dev/null 2>&1; sleep 2
  echo "PRE: hub $(up) (down expected); decoy alive $(alive "$D")"
  : > "$QA_Q/ps-calls.log"; probe plant "$PWD" all 5 "$D" 1; S1=$(probe sha .cland/hub.lock .cland/hub.json)
  psrun run "task migrate --dry-run" cland task migrate --dry-run
  psrun run "task migrate" cland task migrate
  probe psused "$QA_Q/ps-calls.log" "$D"
  echo "lock and hub.json unchanged: $([ "$(probe sha .cland/hub.lock .cland/hub.json)" = "$S1" ] && echo yes || echo no)"
  echo "decoy alive $(alive "$D")"
  probe plantclear "$PWD"
}
m10() {   # the client against the fake provider: GET by id, the fault, the confirming second attempt
  ld || return 1
  dostop; dostart || return 1
  echo "PRE: endpoint $(sed -E 's/:[0-9]+/:<port>/' "$QA_Q/do.url"); sentinel prefix $(cut -c1-17 "$QA_Q/do.token"); credential-prefix names $(env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_)')"
  probe ctl state
  probe client
  probe ctl state
}
m11() {   # p2: a fresh fake, a scratch project, a hub with the fake endpoint; reap against the DELETE-404-while-GET-200 fault
  ld || return 1
  dostop; dostart || return 1
  echo "PRE: p2 entries $(ls -A | wc -l | tr -d ' '); endpoint $(sed -E 's/:[0-9]+/:<port>/' "$QA_Q/do.url"); sentinel prefix $(cut -c1-17 "$QA_Q/do.token")"
  git init -q -b dev && git config user.name 'QA Two' && git commit -q --allow-empty -m init
  cland init . > "$QA_EV/E1538S1-11-init.txt" 2>&1; echo "init exit $?"
  [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; cland hub stop > /dev/null 2>&1
  sed -i '' -e "s|^lock_path = .*|lock_path = \"$QA_Q/p2-suite.lock\"|" -e 's|^executor = .*|executor = "local"|' .cland/config.toml
  mkdir -p "$QA_Q/home2"; probe legacy
  hubstart_do; echo "hub start exit $?"
  probe mark a; sleep 5; probe mark b
  TAG=$(probe tag "$PWD"); echo "project tag shape ok: $(echo "$TAG" | grep -c -E '^cland-p-[0-9a-f]{12}$')"
  run "reap, nothing at the provider" cland executor reap --json
  probe ctl seed "{\"keyName\":\"$TAG-qa-orphan\",\"dropletName\":\"qa-orphan\",\"tags\":[\"cland\",\"$TAG\"]}"
  probe ids qa-orphan "$TAG-qa-orphan"
  echo "saved ids: droplet $(wc -l < "$QA_Q/drop.id" | tr -d ' ') line, key $(wc -l < "$QA_Q/key.id" | tr -d ' ') line"
  probe ctl state
  probe ctl faults '{"deleteFailures":[404],"keyDeleteFailures":[404]}'
  for n in r1 r2 r3; do
    probe mark $n; run "reap $n" cland executor reap --json; probe seg $n; probe ctl state
  done
}
m12() {   # p2, hub still up from m11: the resolver's path, the legacy ledger, then stop and the scans
  echo "PRE: hub $(up); legacy ledger present $(test -f "$QA_Q/home2/.cland/executor/spend.json" && echo 1 || echo 0)"
  cland executor status --json > "$QA_Q/status.json" 2> "$QA_Q/status.err"; echo "status exit $?"
  probe statusfacts "$QA_Q/status.json"
  probe sockform
  run "hub stop" cland hub stop; sleep 3
  echo "p2 hub processes left: $(census p2)"
  echo "reap-unconfirmed log lines: $(grep -c -E '"event": ?"executor-reap-unconfirmed"' .cland/log/hub.log); reaped log lines: $(grep -c -E '"event": ?"executor-reaped"' .cland/log/hub.log)"
  probe ledgers
  probe homelist
  probe fsscan 1
  probe fsscan 0
}
m13() {   # p3: init; the doctor ps row passing and failing; the install docs
  echo "PRE: p3 entries $(ls -A | wc -l | tr -d ' ')"
  git init -q -b dev && git config user.name 'QA Three' && git commit -q --allow-empty -m init
  cland init . > "$QA_EV/E1538S1-13-init.txt" 2>&1; echo "init exit $?"
  [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; cland hub stop > /dev/null 2>&1
  sed -i '' -e "s|^lock_path = .*|lock_path = \"$QA_Q/p3-suite.lock\"|" -e 's|^executor = .*|executor = "local"|' .cland/config.toml
  echo "-- control: the real ps"
  drows ps
  echo "-- a ps that cannot report"
  PS_LOG="$QA_Q/ps-calls.log" PATH="$QA_Q/psfail:$FCC:$FCX:$FOC:$PATH" cland doctor . --json > "$QA_Q/doctor.json" 2> "$QA_Q/doctor.err"; echo "doctor exit $?"
  probe rows "$QA_Q/doctor.json" ps
  echo "install docs procps lines: $(grep -c -F '`procps` (Linux)' "$QA_W/site/src/content/docs/docs/install.md")"
  grep -F '`procps` (Linux)' "$QA_W/site/src/content/docs/docs/install.md" | cut -c1-200
}
m14() {   # p3: the transport kind at start and at reload
  C=.cland/config.toml; cp "$C" "$QA_Q/p3-config.orig"
  echo "PRE: hub $(up) (down expected); config copy kept; hosts table in the initialised config: $(grep -c -F '[hosts' "$C") (0 expected)"
  bad() { cp "$QA_Q/p3-config.orig" "$C"; printf '\n[hosts.first]\ntransport = "ssh"\n[hosts.nopool]\n[hosts.second]\ntransport = %s\n' "$1" >> "$C"; }
  for v in '"outbound"' '"tcp"' 'false'; do
    bad "$v"; mkdir -p .cland/log; : > .cland/log/hub.log; run "hub start, transport = $v" hubstart
    echo "  output / hub log names hosts.second.transport: $(has 'hosts.second.transport') / $(hasl 'hosts.second.transport'); 0.4.x: $(has '0.4.x') / $(hasl '0.4.x'); the ssh-only rule: $(has 'ssh is the only transport 0.4.0 accepts') / $(hasl 'ssh is the only transport 0.4.0 accepts'); hub $(up)"
  done
  cp "$QA_Q/p3-config.orig" "$C"; printf '\n[hosts.first]\ntransport = "ssh"\n[hosts.nopool]\n[hosts.third]\nsize = "c-8"\n' >> "$C"
  run "hub start, ssh and no transport" hubstart
  echo "  hub $(up)"
  cland hub status --json > "$QA_Q/status-before.json" 2>&1; probe cfgsha "$QA_Q/status-before.json"
  for v in '"outbound"' '"tcp"'; do
    bad "$v"; run "hub reload, transport = $v" cland hub reload
    echo "  names hosts.second.transport: $(has 'hosts.second.transport'); 0.4.x: $(has '0.4.x'); the ssh-only rule: $(has 'ssh is the only transport 0.4.0 accepts'); hub $(up)"
    cland hub status --json > "$QA_Q/status-after.json" 2>&1; probe cfgsha "$QA_Q/status-after.json"
  done
  cp "$QA_Q/p3-config.orig" "$C"; printf '\n[hosts.first]\ntransport = "ssh"\n[hosts.nopool]\n' >> "$C"
  run "hub reload, valid again" cland hub reload
  run "hub stop" cland hub stop
}
m15() {   # sealed: the live hub's lock and .cland are never reached
  echo "PRE: HOME $HOME (scratch HOME is $QA_Q/home: $([ "$HOME" = "$QA_Q/home" ] && echo yes || echo no))"
  echo "CLAND_ names in the sealed environment: $(env | cut -d= -f1 | grep '^CLAND_' | sort | tr '\n' ' ')"
  echo "session, hub-file and delivery names (0): $(env | cut -d= -f1 | grep -c -E '^CLAND_(HUB_|SESSION_|ROLE|DELIVERY|LAUNCH|SUITE_LEASE|NODE|CLI|CHANNEL)')"
  echo "credential-prefix names (0): $(env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)')"
  probe roots
  printf '%s\n' "$QA_R/.cland/hub.lock" > "$QA_Q/live-control.txt"
  echo "files naming the live lock or hub (the control only): $(grep -l -F "$QA_R/.cland/hub" "$QA_Q/live-control.txt" "$QA_EV"/*.txt 2> /dev/null | sed "s|$QA_Q/||; s|$QA_EV/|<EV>/|" | tr '\n' ' ')"
}
m16() {   # sealed: stop everything, the census, the scans with their positive controls; then (QA's own shell) the root and dev
  for p in p1 p2 p3; do ( cd "$QA_Q/$p" && cland hub stop > /dev/null 2>&1 ); done; sleep 3
  dostop
  kill "$(cat "$QA_Q/decoy.pid")" 2> /dev/null; sleep 1
  sort -u "$QA_Q/pids" | while read -r p; do [ -n "$p" ] && kill -0 "$p" 2> /dev/null && echo "alive $p $(ps -o command= -p "$p" | cut -c1-100)"; done
  echo "census of $(sort -u "$QA_Q/pids" | grep -c .) fixture pids done"
  ps -Ao pid=,command= > "$QA_Q/ps.txt"; echo "processes naming the scratch root: $(grep -c -F "$QA_Q" "$QA_Q/ps.txt")"; grep -F "$QA_Q" "$QA_Q/ps.txt" | cut -c1-140 | head -20
  cd "$QA_Q/p2" && probe scan 1
  probe fsscan 1
  probe fsscan 0
}
m16b() {   # QA's own shell, after m16: the root, the build, dev
  echo "root entries outside .cland/tasks: $(git -C "$R" status --porcelain | grep -v -F '.cland/tasks/' | wc -l | tr -d ' ')"
  echo "HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) want $S"
  echo "CLAND_ names in QA's own shell (control that the stripping matters; 0 only when run outside a crew session): $(env | cut -d= -f1 | grep -c '^CLAND_')"
}
```

Cleanup after the evidence is recorded: print `$Q`, check it begins with `/private/tmp/qa-e1538s1-`, and remove it by that literal path with a non-force `rm -r`. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). Everything in `$Q` is disposable: p1, p2 and p3, both scratch HOMEs, the fake provider's state, `redact.mjs`, `secrets1538.json`, `do.token`, `do.url`, the planted records and the decoy's pid file. The fake provider also keeps a `cland-fake-do-*` directory in the system temp directory until `dostop`'s clean shutdown removes it; if a run was killed, list `cland-fake-do-*` in `$TMPDIR` and remove only the one whose `addresses.json` is empty.

## Cases

none. No headless-grid case covers this stage: nothing here is a Neovim or grid surface. Every check below is a manual check recorded with `qa-record.sh note`.

### Web cases (when in scope)

none. No web surface changed in this stage; no browser, GUI or computer use is part of this run.

## Manual checks

The role column assigns each row: Human for rows that act in a sealed scratch project, QA for the rest. The `nt` rows run named test files one at a time through `nt`, which waits for the cover-quiet admission (`quiet`, the live verify queue read) and the load gate (`ld`) before each file.

| id | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1538S1-00 | hub-api | QA | `m00 > "$EV/E1538S1-00.txt" 2>&1` (QA's own shell) | PRE line: HEAD, dev and the request's SHA are the same 40 hex; `dirty entries 0`; `root entries outside .cland/tasks: 0`. The stage line names `lock, deletion and paths` with `qa` `{"scope":"affected","when":"after-stage"}` and lists every member of the plan; each member's `landings:` line holds exactly one commit (read from the plan at the run). A member with no landing (T-1617 at writing) makes the run BLOCKED, naming it |
| E1538S1-01 | hub-api | QA | `m01 > "$EV/E1538S1-01.txt" 2>&1` (QA's own shell, read-only) | Every `edited preserved files:` line ends `0` (T-1615 C9, T-1616 C6, T-1617 C5, T-1618 C7, T-1620 C4, T-1621 C2). T-1615's source files are exactly `hub/src/hub/daemon.ts hub/src/hub/lock-identity.ts hub/src/hub/lock.ts` (C8: the spend, territory, suite and termination locks are not touched). The counts in the labels hold: lock constants 2, hub-lock-lost 1, Linux import 1, macOS key 1, unconfirmed reap event 1, GET-by-id methods 2, resolver at least 1, one transport type declaration, at least two parser call sites, both messages `1 1`, doctor procps at least 1, install docs line 1. The foreign-holder wording line is `1` once T-1617 landed (a `0` with T-1617 landed is a FAIL; the confirmed-deletion line counts the three client deletions and must be at least 3) |
| E1538S1-02 | hub-api | Human | `{ quiet && ( . "$Q/env.sh"; cd "$Q/p1" && m02 ); } > "$EV/E1538S1-02.txt" 2>&1` | PRE: p1 has no entries, `fakes 3`, `credential-prefix names 0`. `init exit 0`; `lock 1 executor 1`; `decoy alive yes`. `identity`: `platform` darwin, `hostnameIsOsHostname` true, `bootIdIsSysctl` true (T-1615 C7 on macOS), `pidNamespace` null. `hub start exit 0`. `lock`: `keys` contain `heartbeat`, `hostIdentity`, `pid`, `started`, `token`; `pidIsHub` true; `hostIdentityKeys` `bootId,hostname,pidNamespace`; `hostIdentityIsNative` true; `heartbeatIso` true; `tokenLength` above 0 (T-1615 C1). The sampler over 35 s: `absent` 0, `unparsable` 0, `distinctTokens` 1, `distinctHeartbeats` at least 3, `maxAgeMs` under 25000 (T-1616 C1: replaced whole every interval, never absent or half written). A heartbeat that does not advance, or any absent or unparsable read, is a FAIL |
| E1538S1-03 | hub-api | Human | `{ quiet && ( . "$Q/env.sh"; cd "$Q/p1" && m03 ); } > "$EV/E1538S1-03.txt" 2>&1` (command timeout of at least 600000 ms) | PRE: hub `up`, lock present `1`. Eight `attempt` lines at about 20 s spacing (the last at about 140 s of real time, more than two lapse periods of 60 s), each `result` `HubLocked` and each `heartbeatAgeMsBefore` under 25000: the synthetic foreign contender is refused every time while the holder lives, and its process table (which throws on any pid but its own) is never asked about the holder's pid (T-1615 C2 and C4, T-1616 C2). An `ACQUIRED` or an `error:` result is a FAIL (the contender then took the lock; judge the hub by the next line). The closing `lock` line is the hub's own again (`hostIdentityIsNative` true) and `hub after the contender: up` |
| E1538S1-04 | hub-api | Human | `{ quiet && ( . "$Q/env.sh"; cd "$Q/p1" && m04 ); } > "$EV/E1538S1-04.txt" 2>&1` | PRE: hub `up`. `hub stop exit 0`. After 15 s: `lock after stop: absent`, `guard directory: absent`, `hub pid alive: no`, `heartbeat failures logged: 0` (a timer that outlived the stop would try to refresh an absent lock and log a failure), `lost-lock events: 0`, and at least one `stopping` event (T-1616 C5). The log is read after the stop, which has flushed it |
| E1538S1-05 | hub-api | Human | `{ quiet && ( . "$Q/env.sh"; cd "$Q/p1" && m05 ); } > "$EV/E1538S1-05.txt" 2>&1` (command timeout of at least 600000 ms) | `hub start exit 0`; PRE (printed right before the action): hub `up`, decoy alive `yes` (the row starts its own detached decoy, in its own session; a dead decoy at the PRE is BLOCKED, not a product result). A synthetic successor record (token `qa-successor-token`, host `qa-successor.invalid`, fresh heartbeat) replaces the lock whole. Within 45 s: `hub pid alive after the wait: no`; `lock still the successor's: yes` (the stopping hub removed no lock it does not own); `hub-lock-lost lines` 1; `a stopping line follows the last hub-lock-lost line: yes` (it stopped through its normal shutdown); `decoy alive yes` (T-1616 C3). A hub still alive after 45 s is a FAIL (the beat is 10 s) |
| E1538S1-06 | hub-api | Human | `{ quiet && ( . "$Q/env.sh"; cd "$Q/p1" && m06 ); } > "$EV/E1538S1-06.txt" 2>&1` | **Inferred until T-1617 lands.** PRE: `localFixtureHubs` 0 over fixture-owned pids, `socketAnswers` false for p1, decoy alive `yes`; a separately captured foreign holder is present with synthetic hostname `qa-successor.invalid`, numeric heartbeat age and `state` fresh or lapsed according to elapsed time. A fresh foreign holder may make `up()` return `up`; that is expected. The control first (rule 17): with a same-host record naming the decoy and a `hub.json` naming it, the readers' `ps` shim log has `holderCalls` (calls whose `-p` list is just the decoy pid) at least 1; with `holderCalls` 0 the shim proves nothing and the row is INCONCLUSIVE. Then the fresh foreign holder (host `qa-foreign.invalid`, heartbeat 5 s old, pid and `hub.json` naming the decoy): `hub start` exits 1 and its error line is `cland: hub on another host qa-foreign.invalid (pid <decoy pid>, heartbeat age <n>s)`, with no `heartbeat lapsed` suffix (T-1617 C1); `second hub started` `0 processes` (no hub is left running); `hub status` exits 0 and prints the same `hub on another host …` line; `hub status --json` exits 0 with `running` true, `foreign` true, `hostname` `qa-foreign.invalid`, `heartbeatAgeMs` a number and `startable` false (T-1617 C3); `hub stop` exits 1 with `cland: hub on another host qa-foreign.invalid (pid …, heartbeat age …s); stop it on that host; no local process signalled` (T-1617 C2). The doctor `hub` row is `warn` and names `qa-foreign.invalid` and `heartbeat age`, its fix is `manage the hub on its owning host`; the `hub.json` row is `ok` and says it is retained for the foreign holder. `psCalls` for the foreign pid: `holderCalls` 0 (T-1615 C4, T-1617 C4 for the readers). Only holder-specific calls count; the readers' local-process census batches (`-p` over every local pid, which include the live decoy) are reported as `censusBatchesNamingPid` and are not a failure. `holderCallParents` lists the caller pids (the shim logs `$PPID`) so a call can be attributed to its command. `lock and hub.json unchanged: yes`; `decoy alive yes` (nothing signalled it) |
| E1538S1-07 | hub-api | Human | `{ quiet && ( . "$Q/env.sh"; cd "$Q/p1" && m07 ); } > "$EV/E1538S1-07.txt" 2>&1` | **The three foreign rows are inferred until T-1617 lands.** PRE: `localFixtureHubs` 0 over fixture-owned pids, `socketAnswers` false for p1, dead pid alive `no`; the previously planted foreign holder is captured separately as `qa-foreign.invalid`, with numeric heartbeat age and fresh/lapsed state. Each of `hostname`, `bootId` and `pidNamespace` alone makes `hub status --json` exit 0 with `foreign` true and `startable` false (T-1615 C2: a difference in any part is foreign). The bootId-only and pidNamespace-only variants mask their native hostname as `<native>` and each prints `nativeHostnameMatches: true`, asserted against `os.hostname()` before masking; the hostname-only variant retains `qa-foreign.invalid`. The control (rule 17): the same-host identity with a dead pid prints `no hub running for <p1>` and exits 1, never `another host`. Each older shape (`legacy-pid`, `legacy-started`, `legacy-startedUtc`, `legacy-token`) also prints `no hub running for <p1>` and exits 1 (T-1615 C5 and C6: the same-host rules and the older shapes are unchanged). `decoy alive yes` |
| E1538S1-08 | hub-api | Human | `{ quiet && ( . "$Q/env.sh"; cd "$Q/p1" && m08 ); } > "$EV/E1538S1-08.txt" 2>&1` | **Inferred until T-1617 lands.** PRE: `hub down`, decoy alive `yes`. The lapsed holder (heartbeat 120 s old; synthetic foreign identity): `hub status` exits 1 and its line ends `; heartbeat lapsed, startable`; `hub status --json` exits 1 with `foreign` true, `startable` true, `running` false; `hub stop` exits 1 with the line ending `; stop it on that host; no local process signalled`, naming `heartbeat lapsed` too. The doctor `hub` row is `warn` with `lapsed, startable` and the fix `cland hub start`. `lock and hub.json unchanged by the readers: yes`. `task migrate --dry-run` exits 0 (a lapsed foreign holder does not block it; it takes the lock and releases it) and `lock after the dry run: absent`. After the lock is planted again, `hub start` exits 0 and `lock`: `hostIdentityIsNative` true, `pidIsHub` true, `planted token gone: 0`, `guard directory: absent` (T-1615 C3: broken through the guard, taken whole). `holderCalls` 0 (census batches are not counted) and `decoy alive yes` |
| E1538S1-09 | hub-api | Human | `{ quiet && ( . "$Q/env.sh"; cd "$Q/p1" && m09 ); } > "$EV/E1538S1-09.txt" 2>&1` | **Inferred until T-1617 lands.** PRE: `hub down`, decoy alive `yes`. With a fresh foreign holder (synthetic identity), both `task migrate --dry-run` and `task migrate` exit 1 with an error line `cland: hub on another host qa-foreign.invalid (pid …, heartbeat age …s)` and change nothing: `lock and hub.json unchanged: yes`, `holderCalls` 0, `decoy alive yes` (T-1617 C6). The prior wording `the hub or another migration is running` would be the old behaviour, a FAIL |
| E1538S1-10 | hub-api | Human | `{ quiet && ( . "$Q/env.sh"; cd "$Q/p1" && m10 ); } > "$EV/E1538S1-10.txt" 2>&1` | PRE: endpoint `http://127.0.0.1:<port>/v2`, a sentinel prefix `cland-test-qa1538`, credential-prefix names `0`. The first `state` is empty (no droplets, keys, images). `get by id`: `droplet`, `key` and `snapshot` true (the client reads one key and one snapshot by id, the fake answers: T-1618 C2, T-1620 C1) and `absentKey` `rejected` with `status` 404. For each of droplet, key and snapshot under the fake's DELETE-404-while-GET-200 fault: `first` is `rejected` with `unconfirmed` true and `accepted` false, `stillPresentAfterFirst` true (a DELETE 404 never counts as deletion while the GET still answers 200: T-1618 C1 and C3, T-1620 C1); `second` is `resolved` and `goneAfterSecond` true (the next attempt is confirmed by a GET 404: T-1620 C3 at the client). The controls: a plain delete of the second droplet is `resolved` and `gone`; a delete of an absent key id is `resolved` (confirmed absent by the GET 404). The closing `state` lists no seeded droplet, key or image of the faulted ids |
| E1538S1-11 | hub-api | Human | `{ quiet && ( . "$Q/env.sh"; cd "$Q/p2" && m11 ); } > "$EV/E1538S1-11.txt" 2>&1` (command timeout of at least 600000 ms) | PRE: a fresh fake (endpoint loopback, sentinel prefix), `init exit 0`. `hub start exit 0`; the two marks taken 5 s apart have the same `at` (the start sweep is done and idle); `project tag shape ok: 1`. `reap, nothing at the provider` exits 0 with `summary` `reaped: 0 droplets`. After the seed: `saved` has `dropletMatches` 1 and `keyMatches` 1, `saved ids` one line each, and `state` lists the orphan droplet (tags `cland` and the project tag) and its key. With the fake answering the first DELETE of each with 404: **reap r1** exits 0, its `unconfirmed` lists the droplet id and the key id, `deleted` and `deletedKeys` do not contain them, and the summary reads `reaped: 0 droplets; unconfirmed droplets: <id>; keys: <id>; run reap again` (T-1619 C3: reported, not counted); the `segment` shows `dropletSeq` and `keySeq` starting `DELETE,GET` (a GET by id after each DELETE: T-1618 C1, T-1619 C1 and C2), `dropletLists` 1 and `keyLists` 1 (one discovery listing, never the confirmation); `state` still lists both. **reap r2** exits 0, `deleted` holds the droplet id and `deletedKeys` the key id, summary `reaped: 1 droplets, 1 keys`; its sequences hold a `DELETE` followed by a `GET` and end in `GET` (deleted again and confirmed by a GET 404: T-1619 C4); `state` lists neither. **reap r3** reaps nothing (`reaped: 0 droplets`) and sends no `DELETE` (`deletes` 0). The lease-open and spend parts of T-1619 C3 are proven by E1538S1-20 |
| E1538S1-12 | hub-api | Human | `{ quiet && ( . "$Q/env.sh"; cd "$Q/p2" && m12 ); } > "$EV/E1538S1-12.txt" 2>&1` | PRE: hub `up`, legacy ledger present `1`. `status exit 0` and `status`: `tokenPresent` true, `spendPath` `<Q>/home2/cland/spend.json` (HOME and `XDG_STATE_HOME` both on `$Q/home2`, no `CLAND_EXECUTOR_STATE`: the resolver's path, T-1621 C1), `spent` 0.07 (the legacy ledger's settled entry is read and counted: T-1621 C2), `legacyRetirement` 1. `socket`: `insideProject` true or `tmpdirFallback` true (a per-machine runtime path, allow-listed). After `hub stop exit 0`: `p2 hub processes left: 0`; the log has `executor-reap-unconfirmed` lines for the droplet and the key from E1538S1-11 (2) and exactly one `executor-reaped` line (the droplet; T-1619). `ledger legacy` `exists` true with `legacyEntryKept` true and `legacyRetired` null; `ledger new`, when it exists, also has `legacyEntryKept` true. The scan with its control (rule 17): `escapes` with `control` true lists exactly `stray/control.txt` in `hits` (if it does not, the scan proves nothing: INCONCLUSIVE); with `control` false `hits` is `[]`: no file of the whole run (p1, p2, p3 and both HOMEs excepted by design, the sealed environment's own directories included) lies elsewhere under `$Q`, so every file the hubs wrote outside their projects is under the scratch HOME or state directory (T-1621 C3). A listing of the files under `$Q/home2` is printed for the record |
| E1538S1-13 | hub-api | Human | `{ quiet && ( . "$Q/env.sh"; cd "$Q/p3" && m13 ); } > "$EV/E1538S1-13.txt" 2>&1` | PRE: p3 empty, `init exit 0`. Control: with the real `ps`, the doctor `ps` row is `ok` and its detail begins `process start time:`. With a `ps` that exits 1, the `ps` row is `fail`, its detail is `cannot read this process start time with ps -o lstart=` and its fix names `procps` (`install procps on Linux (or repair ps on macOS); the hub lock needs process start times`: T-1622 C1). The install docs: `install docs procps lines: 1` and the printed line is the Linux requirements row naming `ps -o lstart=` and the hub lock (T-1622 C2) |
| E1538S1-14 | hub-api | Human | `{ quiet && ( . "$Q/env.sh"; cd "$Q/p3" && m14 ); } > "$EV/E1538S1-14.txt" 2>&1` (command timeout of at least 600000 ms) | PRE: hub down, no `[hosts` table in the initialised config. Start with `transport = "outbound"` in `[hosts.second]` (and `transport = "ssh"` in `[hosts.first]`): `hub start` exits 1, the output or the hub log names `hosts.second.transport` and `0.4.x`, and the hub is `down` (T-1623 C2). With `"tcp"` and with `false`: exits 1, names `hosts.second.transport` and `ssh is the only transport 0.4.0 accepts`, hub `down` (C3). With `ssh` on one pool and no `transport` on others (and an unrelated key in a third): `hub start` exits 0 and the hub is `up` (C4). With the hub up and the file changed to `outbound`, `hub reload` exits 1 naming `hosts.second.transport` and `0.4.x`; with `"tcp"` it names the ssh-only rule; after each refusal the hub is still `up` and the `config` digest equals the one before (the old configuration is kept); restoring a valid file, `hub reload` exits 0 (printing `config reloaded`) and `hub stop` exits 0 |
| E1538S1-15 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q" && m15 ) > "$EV/E1538S1-15.txt" 2>&1` | The live hub, lock and `.cland` are never read or touched. `HOME` is the scratch HOME (`yes`); the CLAND_ names are only the synthesized scratch ones (`CLAND_EXECUTOR_STATE`, `CLAND_TEST_OWNED_ROOT`, messenger sentinels and the like) and the session, hub-file and delivery names count `0`; credential-prefix names `0`. `root p1`, `root p2` and `root p3` each resolve the discovery file to `<Q>/pN/.cland/hub.json` and the project root to `<Q>/pN`. The files naming the live lock or hub are exactly `live-control.txt` (the positive control for the search, rule 17: a result without it makes the row INCONCLUSIVE) and no `<EV>` capture |
| E1538S1-16 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q" && m16 ) > "$EV/E1538S1-16.txt" 2>&1` then `m16b > "$EV/E1538S1-16b.txt" 2>&1` (QA's own shell) | Cleanup judged by the fixture-owned census only (never a machine-wide `pgrep`): no `alive` line names a fixture process (a `cland` hub or `hub serve`, `probe.mjs`, `fakedo.mjs`, the decoy); an `alive` line whose command is unrelated is pid reuse, recorded, not a failure; `processes naming the scratch root: 0`. The secret scan with its control (rule 17): the `scan` line of kind `do-token` reads `sentinels` 1, `tooShort` 0 and exactly one hit, `fake: <Q>/p2/.cland/log/qa-scan-control.txt`, and the kind `hub-secret` reads `sentinels` above 0, `tooShort` 0 and exactly the control hit (`p1`, `p2` and `p3` labels on the same file), then `controlRemoved` true; a control with no hit makes the row INCONCLUSIVE, never PASS. Any other hit is a FAIL naming the kind and file only (a hit under `<EV>` is a QA fault to fix before publication). `escapes` as in E1538S1-12. In `m16b`: `root entries outside .cland/tasks: 0`, HEAD equals dev equals the request's SHA, and the QA shell's CLAND_ name count (the control that the stripping in E1538S1-15 matters) |
| E1538S1-17 | hub-api | QA | `nt E1538S1-17 hub/test/hub-lock-identity.test.ts hub/test/hub-lock-heartbeat.test.ts` | clean (`exit 0` for each file, no `not ok`, no skip). `oks` lists Tests: `hub acquisition persists identity, heartbeat and the existing ownership fields whole`, `foreign break guard cannot probe pid and permits recovery only after lapse`, `generic synchronous and asynchronous acquisitions keep their prior record shapes`, `identity reads the shared Linux boot id and namespace, and the Darwin boot-session UUID`, `native-to-embedded fixture handoff reclaims a dead same-host holder and preserves foreign refusal`, `serving hub replaces whole heartbeat each interval and fences foreign contenders across lapses`, `replacement token logs lost lock and joins normal shutdown without removing successor`, `heartbeat write failure logs and retries next beat without stopping`, `unreadable ownership is not positive replacement proof`, plus the generated foreign-identity, legacy-shape and malformed-identity cases (read them from `oks` at the build). T-1615 C1 to C7 and T-1616 C1 to C5, including the write failure of T-1616 C4 |
| E1538S1-18 | hub-api | QA | `nt E1538S1-18 hub/test/daemon.test.ts hub/test/startup-cleanup.test.ts hub/test/territory-lock.test.ts hub/test/executor-spend.test.ts hub/test/edges.test.ts` | clean, with no test file edited (E1538S1-01). The preserved consumers of the hub lock and the other locks (T-1615 C5, C8 and C9; T-1616 C6; T-1617 C5) |
| E1538S1-19 | hub-api | QA | `nt E1538S1-19 hub/test/hub-lock-readers.test.ts hub/test/orphan-servers.test.ts hub/test/doctor.test.ts hub/test/doctor-cli.test.ts hub/test/task-migrate.test.ts` | **Inferred until T-1617 lands** (`hub-lock-readers.test.ts` is on its branch). PRE: the web build stamp check ("Web build precondition") printed `web build stamp ok`; without it `doctor-cli.test.ts` fails on `web/dist build stamp missing or invalid`, and the row is BLOCKED, not FAIL. clean. `oks` lists Tests: `start refuses fresh foreign holder before spawning; stop retains both files without local signals`, `foreign reader shares exact lapse boundary, unknown and future heartbeat rules with acquisition`, `orphan reader rejects foreign PID-table matches before looking at local rows; legacy remains local`, `start treats a lapsed foreign holder as eligible for the existing launch path`, `a failed held stop preserves a foreign successor with the same numeric PID`, `migration rechecks ownership after held temporary write before publishing item bytes`, plus the generated status, doctor, migration and held-migration cases (T-1617 C1 to C6, including the orphan sweep of C4 that the scratch hubs switch off) |
| E1538S1-20 | hub-api | QA | `nt E1538S1-20 hub/test/executor-deletion-confirmation.test.ts hub/test/executor-deletion-watchdog.test.ts hub/test/executor-recovery-collection.test.ts hub/test/executor-reap-confirmation.test.ts hub/test/executor-snapshot-confirmation.test.ts` | clean. `oks` lists Tests: `DELETE 404 never confirms a droplet or key still readable by id`, `fake split answers last for the requested GET reads and slow GET respects deadline`, `accepted DELETE is checkpointed before held failing confirmation GET and keeps its original bound`, `watchdog receipt follows GET 404 for both droplet and key after split DELETE answers`, `executor recovery publishes a completed shard group without another scheduler tick`, `prepare retains retirement record when replacement DELETE404 still has live GET`, plus the generated release, reap, sweep, hidden-identity and snapshot-phase cases (T-1618 C1 to C6, T-1619 C1 to C4 with the open lease, T-1620 C1 to C3) |
| E1538S1-21 | hub-api | QA | `nt E1538S1-21 hub/test/executor-droplet.test.ts hub/test/executor-droplet-component.test.ts hub/test/executor-safety.test.ts hub/test/executor-prepare.test.ts hub/test/executor-prepare-component.test.ts hub/test/executor-prepare-retry.test.ts hub/test/demo-release-component.test.ts` | clean, no test file edited (E1538S1-01): the preserved lease, safety, prepare and demo-release consumers of the deletion boundary (T-1618 C7, T-1620 C4) |
| E1538S1-22 | hub-api | QA | `nt E1538S1-22 hub/test/state-paths.test.ts hub/test/state-paths-lint.test.ts hub/test/state-inventory.test.ts` | clean. `oks` lists Tests: `per-user state precedence preserves executor override, XDG and HOME fallbacks`, `state inventory rejects newly introduced home and temporary paths`, `state inventory requires a macOS platform guard on native paths and commands`, `state inventory follows shell HOME, launcher aliases, command variables and split Library paths`, `per-host short socket exceptions accept only their registered expressions`, `hub source conforms to the named state path inventory` (T-1621 C1, C3, C4 and C5, with the lease and the fake harness session that a scratch project cannot start here). The `state-inventory.test.ts` cases are generated by a loop over `injectEscape` (one passing inventory case and one escape-rejection case, T-1636): read both names from the log, compare them with the source loop, and confirm each prints `ok` |
| E1538S1-23 | hub-api | QA | `nt E1538S1-23 hub/test/doctor-harness-probe.test.ts hub/test/transport-kind.test.ts hub/test/transport-config.test.ts hub/test/transport-records.test.ts hub/test/host-records.test.ts hub/test/cli-usage-compatibility.test.ts hub/test/cli-help.test.ts` | clean. `oks` lists Tests: `doctor ps row requires its own process start time and names procps as the fix`, `transport parser accepts ssh and reserves outbound for 0.4.x`, `ssh, omitted transport and malformed non-transport hosts keys preserve config behavior`, `quoted empty pool transport is refused at startup`, `host get and list reject invalid persisted transport kinds without changing ssh rows`, plus the generated host-transport start and reload cases (T-1622 C1, T-1623 C1 to C4, and the frozen command usage that three of the stage's landings changed) |

After the rows, recheck `git -C "$W" rev-parse HEAD` and `git -C "$R" rev-parse refs/heads/dev` against the request: a moved dev keeps the evidence and makes the run BLOCKED.

Before requesting QA, run `cland qa lint qa/briefs/E-1538-stage-1.md` with this filled brief at the build under test (`node hub/bin/cland.ts qa lint qa/briefs/E-1538-stage-1.md --commit <dev SHA>` from the root). The brief is complete only when qa lint passes at the build.

**Source provenance (rule 22).** Read at dev `5c12b1b1f26a6989785eeb99c198906934801af3`, and for T-1617 at its branch head `691042d964ca5487ae261a8429071c2b3118bbfa` (not landed). Re-check every string at the tested build.

- Verified in source:
  - The lock (`hub/src/hub/lock.ts`, `lock-identity.ts`): the record fields `pid`, `started`, `startedUtc`, `token`, `hostIdentity` (`hostname`, `bootId`, `pidNamespace`) and `heartbeat` (ISO); `HUB_LOCK_HEARTBEAT_MS` 10 000 and `HUB_LOCK_LAPSE_MS` 60 000 (exactly 60 000 ms stays held); `foreignLockHolder` compares every part; the heartbeat replaces the file by rename under `hub.lock.break` and returns false only on a different token; `acquireLock` asks its process table for its own pid only and, for a foreign record, never asks about the holder's pid; the macOS boot id is `kern.bootsessionuuid` and the namespace is null there; `HubLocked` says `another hub holds the project's lock (pid N)`.
  - The daemon (`hub/src/hub/daemon.ts`): the beat logs `hub-lock-heartbeat-failed` on a write error and retries, logs `hub-lock-lost` and calls `stop()` when the token differs; the stop logs `stopping`, clears the timer and releases only a lock whose holder matches; the process log is `.cland/log/hub.log`, written by an asynchronous queue and read here after a stop.
  - The CLI: `cland hub start|stop|status|reload` (`hub/src/cli/hub.ts`) and the start failure line `cland: the hub did not start (exited with N); …` followed by the log tail; `hub status --json` prints `{running:false,root}` when nothing runs; `cland doctor [dir] --json` prints `{root, version, checks:[{name, verdict, detail, fix}], summary}`; `cland executor status|reap [--json]` ask the hub and print `summary` (`reaped: N droplets[, M keys][; unconfirmed droplets: …; keys: …; run reap again]`); `cland task migrate [--dry-run]`.
  - The client (`hub/src/executor/droplet/api.ts`): `droplet(id)`, `key(id)` and `snapshot(id)` GET by id; `deleteDroplet`, `deleteKey` and `deleteSnapshot` go through `#confirmedDelete` (DELETE, then GET; only a GET 404 returns, anything else throws `DeletionUnconfirmed` with `accepted`); `CLAND_DIGITALOCEAN_API` replaces the base URL; the sentinel-token and loopback rules of `hub/test/synthetic-provider.ts`.
  - Reap (`hub/src/executor/droplet/droplet.ts`): one `droplets('cland')` and one `keys()` listing per reap; a GET by id confirms each deletion; `executor-reap-unconfirmed` and `executor-reaped` events; the project tag `cland-p-<12 hex>` of `projectTag(root, name)`; a droplet is reaped as `no live lease` when it carries the project tag and no live lease; a key when its name starts with `<tag>-`; pending identities persist in `.cland/run/executor/reap-pending.json`.
  - The fake (`hub/test/fakes/digitalocean/fake-api.ts`): an HTTP server on 127.0.0.1 behind `Authorization: Bearer <token>`; `faults.deleteFailures` and `keyDeleteFailures` (a list of statuses consumed by DELETEs), `dropletDelete404Reads`, `keyDelete404Reads` and `snapshotDelete404Reads` (DELETE 404 while GET answers 200 for that many reads, the resource then gone); the request log keeps `method` and `path` with the `/v2` prefix; `/snapshots/{id}` and `/account/keys/{id}` GETs.
  - State paths (`hub/src/state-paths.ts`, `executor/droplet/spend.ts`): `CLAND_EXECUTOR_STATE`, else `XDG_STATE_HOME/cland`, else `HOME/.local/state/cland`; the ledger is `spend.json` there, its lock `spend.json.lock`, its migration record `spend-migration.json`; the legacy ledger is `HOME/.cland/executor/spend.json` (not used with `CLAND_EXECUTOR_STATE`); `executor status` reads both without migrating and reports `spend.path`, `spent`, `reserved`, `cap`, `legacyRetirement`.
  - Doctor (`hub/src/doctor/toolchain.ts`): the `ps` row runs `ps -o lstart= -p <own pid>` through `PATH`; ok detail `process start time: <time>`; the failure detail and fix quoted in E1538S1-13; the install docs row in `site/src/content/docs/docs/install.md`.
  - Transport (`hub/src/host/transport-kind.ts`, `transport-config.ts`, `init/config.ts`, `daemon.ts`): `ssh` the only kind; `outbound transport requires 0.4.x`; `ssh is the only transport 0.4.0 accepts`; the refusal text is prefixed `hosts.<pool>.transport: `; the daemon makes that prefix fatal at start and reload makes it a refusal. The reload print is `cland: <message>` (exit 1) and `config reloaded: …` (exit 0).
  - Every literal test title above is a literal title in its file at dev (the T-1617 titles at its branch head).
- Inferred, not verified by a run:
  - **T-1617** (all of it): the wording `hub on another host <hostname> (pid N, heartbeat age Ns)` with the suffix `; heartbeat lapsed, startable` when lapsed; the `hub status --json` fields `running`, `root`, `foreign`, `hostname`, `pid`, `heartbeatAgeMs`, `startable` and the exit codes (0 for a fresh holder, 1 for a lapsed one); the stop suffix `; stop it on that host; no local process signalled`; the doctor `hub` row (`warn`, fixes `manage the hub on its owning host` and `cland hub start`) and the `hub.json` row; that a lapsed holder lets `task migrate --dry-run` and `hub start` proceed; that migrate refuses a fresh holder with the same line. Any change review makes after the head above.
  - **The scratch hubs**: that `cland hub start` shows the child's refusal for `hosts.second.transport` in its error tail or in `.cland/log/hub.log` (the test file asserts it in-process and through the CLI only for reload); that `hub status --json` carries a `config` object; that a hub with a token and the fake endpoint idles after its start sweep within 5 s; that `executor status` on that hub works with `executor = "local"`; that the sweep at start registers nothing that makes `ledger new` differ from the stated expectations (the row allows the file to be absent); the exact `dropletSeq` and `keySeq` sequences beyond their starts and ends (a retained identity check adds a GET before the second DELETE).
  - **Timing**: the 10 s beat means a hub that loses its lock stops within about 20 s and the sampler sees at least three distinct values in 35 s on an unloaded machine; both are load-sensitive, hence the `ld` gate.

## Probes that mislead

- The live hub and the live workbench run the code of their last restart, not the tested dev SHA. Live lock behaviour, the live `hub.lock` and live doctor output are not evidence for this stage; the scratch projects, the build's files and its tests are.
- Every `cland` here is `$W/hub/bin/cland.ts` (the `cland` function of `env.sh`). A `cland` on PATH, or the root's CLI, may be older.
- **Credentials are secrets.** Never print the sentinel token or a hub secret; the probe and `rd` redact; `do.token` and `secrets1538.json` stay in `$Q` (mode 600). The planted `hub.json` secret `qa-planted-not-a-secret` is a fixture value, not a credential. The scan proves the secrets are absent from the evidence too; a hit under `<EV>` is a QA fault to fix before publication, not a product failure.
- A foreign pid that is alive on this machine is the point of the decoy: if a reader signalled it, the decoy would be gone, and if a reader asked `ps` about it alone (a `-p` list of just that pid) the shim log would show a holder-specific call; a census batch over every local pid includes it by design and does not count. Neither proves `kill(pid, 0)` was never called (that is invisible from outside); the named test files mock `process.kill` for that (E1538S1-17, E1538S1-19).
- A same-host record and a foreign record are told apart by the three identity parts together; on macOS the PID namespace is null, so the `pidNamespace` variant differs by a string against null. Do not read a hostname into the evidence: only equality and lengths are printed, except the synthetic `*.invalid` names.
- **`up` is true for a fresh foreign holder** once T-1617 has landed (`hub status` exits 0), so `hub up` lines are meaningful only in rows that expect no planted holder. E1538S1-06 and E1538S1-07 prove no local hub with the fixture-owned PID census and authenticated p1 socket probe, then capture foreign-holder state separately. A foreign heartbeat may lapse between rows; do not mistake that elapsed-time state for local hub liveness.
- The heartbeat is a 10 s timer of real time; the sampler, the 160 s contender and the 45 s lost-lock wait are fixtures of real time, not evidence about other clocks. Load changes them: rerun a timing failure once on a quiet machine and record both.
- `hub.log` is written by an asynchronous queue: read it after the hub has stopped (the rows do), never from a running hub.
- The fake's split fault consumes its reads on **GET** by id; an extra GET (a probe, a retained-identity check) can finish the deletion before the confirming one. `deleteFailures` is one list shared by every droplet DELETE; the client probe seeds its own droplets and clears the faults before its controls.
- The fake's request paths carry the `/v2` prefix; the reap's listing is `GET /v2/droplets?tag_name=cland…`, the confirmation is `GET /v2/droplets/<id>`.
- The sweep at hub start and every ten minutes reaps tagged orphans by itself; E1538S1-11 seeds right after the start sweep is idle and finishes in minutes, so the periodic sweep does not fall between the seed and the fault. A hub left running through the fake's restart would sweep a stale endpoint: the rows stop each hub before the fake changes.
- `spent` is a float (0.07): compare with a tolerance. The ledger's day is UTC; a run across 00:00 UTC can move the planted entry out of today, record that as a probe fault and rerun.
- Edit existing keys in initialized configs (`lock_path`, `executor`); the `[hosts]` tables in E1538S1-14 are new tables that `cland init` does not write (the row prints the count first), appended after a copy of the initialised file that is restored each time (A-8634 R12).
- Created ids come from the fake's state listing or the project's history, never from a create reply (rule 22); saved ids are one per file with a trailing newline.
- Exact tracker copies replace the initialized tracker directory after its writers stop; apply the full `fixtureEnvironment` result after overlays and add `scratchGitEnvironment` for Git; a hand-written shell `unset` filter keeps inherited `GIT_*` variables (E-1212 stage 1). Under rule 15, check zero credential-prefix names before launching scratch processes and report names and counts only.
- Transcript assertions identify stable item/topic/frame ids, with intervals starting at the result frame of the state-changing request. Preserve unaltered captures when correcting a probe and label the correction separately from product failures (A-8634 R13; A-9063 R2).
- Process cleanup probes use the fixture-owned census (`$Q/pids`: each hub pid, the fake's pid, the decoy and each probe; plus processes whose command line names `$Q`), registered at launch and checked through exit; a machine-wide `pgrep` counts other sessions too (A-9063 R2; E-413 stage 1/T-1093).
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file (the scan compares against a marker inside `$Q` only).
- A "ran" marker grep excludes the configuration echo line.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log.
- Speed criteria use measured wall times, never projections.
- Slots due or queued before the build count even when their results arrive later.
- "No skip" names platform-only cases and where they are covered: `kern.bootsessionuuid` is read here on macOS (E1538S1-02) and the Linux reader by the unit test (E1538S1-17); a Linux-only skip in the named files is covered by the stage's Linux cover.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

- Stage 2 of E-1538 (T-1624, T-1625), the tunnel, the secure cookie and everything the full-scope run of that stage covers.
- Real droplets, the real DigitalOcean API and token, real snapshots and keys, and remote hosts of any kind; the lease, watchdog and `prepare` paths run only inside the named test files with the fake provider (E1538S1-20 to E1538S1-22).
- The machine-wide orphan sweep (switched off in the scratch hubs by `CLAND_TEST_SKIP_ORPHAN_SWEEP`; T-1617 C4 is proven by `hub-lock-readers.test.ts`), the Linux boot-id and PID-namespace readers on this macOS (unit test only), and lock behaviour on a second machine.
- The T4 soak and load repetitions; the full T3 and T4 suites and the stage cover pair (the Coordinator's occasion); a live restart; any change to live sessions, holds or the tracker.
- A real browser, computer use, the workbench and the web edge.

Missing authorization does not apply: nothing here needs a grant, so no check is BLOCKED for lack of one.

## Grants

none. This stage launches no browser and no harness; the scratch hubs and the fake provider open only loopback and `$Q` paths, under the rule 15 sealed environment with credentials filtered and only the fake harnesses and the fake DigitalOcean API.

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`--stage "lock, deletion and paths"`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Report `qa clear E-1538 stage lock, deletion and paths` or `qa not clear E-1538 stage lock, deletion and paths` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
