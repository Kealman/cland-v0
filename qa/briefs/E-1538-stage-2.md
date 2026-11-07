# Stage QA brief: E-1538 stage 2 — secure cookie and the transport contract

> Historical build scope (T-1738): this completed epic's brief records the pre-pool-configuration build identified in its Build section and evidence. Its host-template counts and append-hosts snippets apply only to that historical build, not current dev. Current init writes one [hosts] table; edit that existing table, require provider on every pool, and specify slots for custom sizes such as fake/c-8. Current pool config coverage and after-stage QA use docs/agents/tests/hub-test-host-pools-config.test.ts.md and E-1534's stage brief. Do not replay this brief against a post-T-1738 build without migrating its setup and expectations.


Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` or `$B:h` as a modifier). The run is local, on macOS (BSD `sed -i ''`, Node 24 with `node:sqlite`, the pinned Neovim of `node nvim/bin/nvim-path.ts`). It starts real scratch hubs of the tested build on this machine with the fake `claude`, `codex` and `opencode` of `hub/test/fakes/` as their only harnesses (no session is launched), a scratch HTTPS tunnel on 127.0.0.1 with a run-made test certificate, and isolated Chrome Headless Shell instances. No real browser, no GUI, no computer use, no remote host, no droplet, no real ssh.

## Changes since the last run

The stage ran clear at 3b391058 (A-16255) with two Coordinator-authorised expectation corrections, folded in here; no command or assertion of the product changed:

- E1538S2-11: the Node test runner reports one top-level wrapper per helper file, so the helper check now passes only when the entries are exactly the two helper files' own wrappers, with no nested subtest and no contract case name (5b44c783). It replaces the old "registered 0" expectation; `hm` prints those facts.
- E1538S2-13: the serving hub's lock record keys are exactly `heartbeat`, `hostIdentity`, `pid`, `started`, `token`, read from their producer, the synchronous `acquireLock` (`hub/src/hub/lock.ts:352–356`, called from `daemon.ts:96`); the `startedUtc` expectation is dropped (19930a8d).

The first version folded in the run corrections of today's briefs (E-1532 stage 2 and E-1536 stage 3 and 4, commits 0dfcf8a62 and ac0e41124): every launch is sealed through `seal.mjs`, Neovim comes from the pinned release, prose and patterns pass the publication scanner, the root census leaves out `.claude/settings.local.json`, socket paths are measured against the suite's TMPDIR length, census probes exclude themselves, and every refusal check asserts its precondition first.

## Stage

- Epic: E-1538 (Shape-B readiness, under R-1530).
- Exact stage name: secure cookie and the transport contract.
- Items, in plan order by lane: lane 1 T-1624 (The session cookie is Secure under the configured origin); lane 2 T-1625 (The transport contract test on the ssh carrier and the fake transport). The run reads the stage's members, state and landings from `task plan show E-1538` (E1538S2-00), never from a number written here. Findings fixes added to this stage after writing are listed in the request; none at writing.
- Policy: full/after-stage.
- Scope: the epic's complete user-facing behaviour at the tested build, which is
  - (a) stage 2 in depth: the session cookie's `Secure` attribute under an `https` `[web] origin` over HTTP and through a scratch HTTPS tunnel in Headless Shell, with no origin, with loopback, other and forwarded hosts, for link, invite and password cookies, and the unchanged admission of WebSocket upgrades, uploads and the sign-in APIs (T-1624); the shared transport contract on both entry files, their runnable identities (T-1658 attribution), and negative controls that prove its assertions are not vacuous (T-1625);
  - (b) a regression pass over stage 1 ("lock, deletion and paths", T-1615 to T-1623): every named test row of the committed stage-1 brief rerun by reference, plus live scratch checks of what changed under stage 1's sources since its clear verdict (the lock and its foreign holder, the doctor `ps` row, the transport kind at start and reload).
- Expected duration: about 1.5 to 2 hours of wall time on a quiet machine (setup and bundle build 10 min; the source rows 5 min; the cookie rows 25 min; the named files and the contract rows 25 min; the stage-1 live rows 10 min; the stage-1 named rows 10 min; cleanup and scans 10 min; plus admission and load waits).

Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

Criteria map (the stage verdict carries no item or epic marks; this tells the run which check proves what):

| criterion | proven by |
| --- | --- |
| T-1624 C1 (origin set, Host equal: `/auth` GET without Origin sets `Secure`) | E1538S2-05 (HTTP, Host only, also upper case); E1538S2-06 (Headless Shell through the tunnel: plain navigation, no Origin sent, jar `secure` true); E1538S2-09 |
| T-1624 C2 (no origin, or loopback, LAN or other Host: no `Secure`) | E1538S2-03 (no origin); E1538S2-04 (Headless Shell, no origin); E1538S2-05 (loopback, `localhost`, other host and port-less host); E1538S2-09 (the unit matrix with a LAN Host) |
| T-1624 C3 (forwarded headers never confer `Secure`) | E1538S2-03; E1538S2-05; E1538S2-09 |
| T-1624 C4 (one helper; invite and sign-in cookies follow it) | E1538S2-01 (every `Set-Cookie` writer goes through `webSessionCookie`); E1538S2-08 (invite registration and password sign-in, live); E1538S2-09 |
| T-1624 C5 (admission unchanged; one assertion changed in `web-auth.test.ts`) | E1538S2-01 (no admission source changed; numstat of the test); E1538S2-07 (WebSocket and upload); E1538S2-08 (invite, sign-in and upload refusals); E1538S2-09 |
| T-1624 C6 (ADR 0003 dated amendment) | E1538S2-01 |
| T-1625 C1 (one exported list of the four endpoints) | E1538S2-01; E1538S2-10; E1538S2-12 (baseline) |
| T-1625 C2 (Unix sockets in the agent-owned 0700 run directory) | E1538S2-01 (the assertions in source); E1538S2-10; E1538S2-12 (baseline) |
| T-1625 C3 (bytes both ways on each endpoint) | E1538S2-10; E1538S2-12 (baseline) |
| T-1625 C4 (all four answer after a drop and reconnect) | E1538S2-10; E1538S2-12 (the no-drop control fails) |
| T-1625 C5 (no TCP listener on either side) | E1538S2-10; E1538S2-12 (the planted-listener control fails) |
| T-1625 C6 (kind through the transport kind type) | E1538S2-01; E1538S2-10; E1538S2-12 (the `outbound` control fails) |
| T-1625 C7 (passes on the ssh carrier with the fake sshd and on the fake transport, no network) | E1538S2-10 (both entries and the unchanged carrier files); E1538S2-11 (each entry's identity rerun alone); E1538S2-01 (no production, fake or carrier file edited) |
| T-1625 C8 (the guide names what a second carrier must pass, `outbound` for 0.4.x) | E1538S2-01 (the ssh entry's guide in `docs/agents/tests/`, named after `hub/test/transport-ssh-contract.test.ts` with `.md`, not the path in the item body) |
| Stage 1, T-1615 and T-1616 (lock record, heartbeat) | E1538S2-13 (native record, heartbeat advancing); E1538S2-15 and E1538S2-16 (rows E1538S1-17 and E1538S1-18 by reference) |
| Stage 1, T-1617 (readers of a foreign holder) | E1538S2-13 (fresh refuses start and stop, lapsed is taken whole); E1538S2-17 (row E1538S1-19 by reference) |
| Stage 1, T-1618, T-1619 and T-1620 (deletion confirmed by a GET) | E1538S2-18 and E1538S2-19 (rows E1538S1-20 and E1538S1-21 by reference); E1538S2-02 (no source change since the stage-1 verdict) |
| Stage 1, T-1621 (per-user state paths) | E1538S2-20 (row E1538S1-22 by reference); E1538S2-02 |
| Stage 1, T-1622 (`ps` dependency) | E1538S2-14 (doctor `ps` row, with a `ps` that cannot report); E1538S2-21 (row E1538S1-23 by reference) |
| Stage 1, T-1623 (transport kind, `outbound` refused) | E1538S2-14 (start and reload); E1538S2-21 (row E1538S1-23 by reference) |
| Negative: the live hub, its lock and `.cland` are never read or touched | E1538S2-22; E1538S2-00 (the only live reads are named there) |

## Build

Use a clean detached worktree at the full dev SHA named in the request: `<dev SHA>` (40 hex). HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt: for every member that `task plan show E-1538` lists in stage `secure cookie and the transport contract`, `git log --first-parent --format=%H --grep "^Item: <id>$" <dev SHA>` prints exactly one commit. At writing, dev was `30dfeeede28800b45195ee93b3d123a4d90fc410` and both had landed: T-1624 at `20c4f9511fc19922efc14c023763d454993a694d` (reviewed head `a75b03fb9ebdc34bb83dd552bde2d730dd053799`) and T-1625 at `30dfeeede28800b45195ee93b3d123a4d90fc410` (reviewed head `4b50ce3ad6528bd4180c2bf55ad7114d816e8234`). Each landing's item files equal its reviewed head (no diff). A dev SHA without either landing is BLOCKED (E1538S2-00). Re-check every string with grep at the tested build. A dirty build, missing required merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no run id on purpose.

The stage cover pair is the Coordinator's occasion and is not judged here (at writing `task plan show` listed it missing on both platforms).

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step (the setup below does; the clean-tree checks ignore that one entry). S0 builds `$W/web/dist` (ignored by Git): the scratch edges serve it, the Web files load it, and `hub/test/doctor-cli.test.ts` (row E1538S1-19, rerun as E1538S2-17) needs its build stamp.

**Where things live.** All scratch state is outside the project root: the scratch root `$Q` is `/private/tmp/q38s2-…` (its realpath, 25 bytes), holding the scratch projects p1, p2 and p3, the scratch HOME and XDG directories, the tunnel's test certificate and every helper file. `TMPDIR` of every sealed command is `T=/private/tmp/qa-e1538s2-<uuid>`, the suite's own root shape (`/private/tmp/cland-suite-<uuid>`) and no longer than it, so every fixture socket keeps the budget the suite keeps (macOS allows 104 bytes for a Unix socket path, NUL included; T-1653). It is not under a `cland-suite-` prefix, which the suite reaper owns. Only the browser mode uses `$Q/b`. The only paths under the repository are the ones the QA tooling prescribes, both ignored by `.cland/.gitignore`: the detached build `$W` in `.cland/worktrees/` and the evidence tree `$EV` in `.cland/qa/E-1538/`. Nothing is written to `.cland/tasks/`. E1538S2-00 and E1538S2-23 print the root's status outside `.cland/tasks/` with the harness-local `.claude/settings.local.json` left out; it must not change.

**Isolation (rule 15).** Every scratch check runs in a disposable project with its own HOME, XDG directories and Git config, with provider and account variables removed. Never the live project at `/Users/evgeniyivanov/Projects/cland/v0`, its hub, its lock, its `hub.db` or the human's HOME (`~/.cland`, `~/.claude`, `~/.codex`, `~/.ssh`, `~/.local/state`, `~/.config/cland`). Never read or print `.cland/secrets.toml`, the live `hub.json` or `~/.config/cland/sandbox-remote.secrets.toml`. The live hub is read only by QA's own shell for E1538S2-00's plan read and `quiet` (cover-quiet admission: the live verify queue is read, nothing is submitted). **Harnesses:** only the fakes in `$W/hub/test/fakes/` (`CLAND_CLAUDE_BIN`, `CLAND_CODEX_BIN`, `CLAND_OPENCODE_BIN`, first on the scratch hubs' `PATH`); no session is launched. **Browser (rule 18):** the only browsers are Chrome Headless Shell instances started by the probe's `browse` mode (its own scratch profile under `$Q/b`, the tunnel's host name mapped to 127.0.0.1 inside that browser only, certificate errors ignored for the run's own test certificate) and by the Web test files (their own fixtures); no real browser, no GUI, no computer use. **Network:** loopback only. The tunnel listens on 127.0.0.1 and forwards to the scratch hub's loopback web edge; the host name `qa1538.example.invalid` exists only in the browser's resolver map and in Host headers. **Preconditions (rule 22):** every check function prints a `PRE:` line before acting, and every refusal check runs after a positive control that makes the refusal meaningful (named in its row); when a `PRE:` line or a control differs from the row's stated expectation, record the row `BLOCKED` with the line and stop the dependent rows. Strings are marked verified or inferred under "Source provenance"; an inferred string is never a pass condition on its own. **Secrets:** the scratch hubs' secrets, sign-in links, invite links, cookies, the password and the tunnel's private key are never printed, posted or written under `$EV`. The probe prints lengths, attribute lists and shapes only, keeps the values the scan needs in `$Q/secrets.json` (mode 600) and redacts every captured output through them; E1538S2-23 scans for them, and runs the publication scanner, each with a positive control.

**No overlay after the seal.** Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree and the scratch roots, runs `quiet`, the plan read and the read-only source rows, runs the named test files through `nt` (which seals each run) and records every check with `qa-record.sh`. **Every other command runs sealed** inside a subshell that sources `$Q/env.sh`. `env.sh` begins with the output of `seal.mjs env`: the full `fixtureEnvironment` result (`test-support/fixture-environment.ts`) with this run's inputs given to it as overlays (the pinned Neovim first on `PATH`, `TMPDIR=$T`, XDG, the synthetic Git identity, the `QA_*` paths), then `scratchGitEnvironment` with a scratch `core.excludesFile`, then the broader credential prefixes removed. The hub start, the doctor run and the browser mode need further inputs (the fakes first on `PATH`, `CLAND_*_BIN`, the sweep and poll settings; a `ps` directory first on `PATH`; `TMPDIR=$Q/b`). They get them only through `seal.mjs hub`, `seal.mjs doctor` and `seal.mjs browser`, which pass those inputs through the same two builders before spawning. No `env NAME=…` or `NAME=… command` prefix, no `export` after sourcing `env.sh`, no `TMPDIR` export and no spread or assignment of `process.env` ever adds a variable after the seal. Never use `env -i`. Processes started from a sealed subshell (the tunnel, the decoy, `openssl`, the probe's own `cland` calls) inherit the sealed environment unchanged.

Three scratch projects, each a fresh `cland init` project with its own local Git config:
- **p1** (`user.name` `Jane Q. Doe`): the cookie rows E1538S2-03 to E1538S2-08. First no `[web] origin`, then the origin `https://qa1538.example.invalid:<tunnel port>` with the scratch tunnel in front of its loopback edge, then users mode.
- **p2** (`QA Two`): the lock regression E1538S2-13.
- **p3** (`QA Three`): the doctor `ps` row and the transport kind, E1538S2-14.

Their actors: the local human (the CLI), HTTP and WebSocket clients of the probe speaking to the loopback edge with chosen Host and Origin headers (what a tunnel delivers), a Headless Shell page, the scratch tunnel, and a decoy process (a detached `sleep` of this run whose pid stands in for a foreign holder's pid that happens to exist here: if anything signalled it, it would die).

### Environment

Put Node from `/Users/evgeniyivanov/.nvm/versions/node/v24.21.0/bin` first on `PATH` and check `node --version` against the qa skill's `node-engines.json`. In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<dev SHA>                                    # the full dev SHA from the request
RUN=qa-s2-$(date +%F)-1                        # unique run id for E-1538; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e1538s2-$RUN          # the clean detached build (ignored by Git)
EV=$R/.cland/qa/E-1538/$RUN                    # captures (qa-record.sh keeps its evidence here too; ignored by Git)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
NV=$(cd "$W" && node nvim/bin/nvim-path.ts); NVD=$(dirname "$NV")   # the pinned Neovim of nvim/NVIM_VERSION; never a Homebrew nvim
T=/private/tmp/qa-e1538s2-$(uuidgen | tr 'A-Z' 'a-z'); mkdir -m 700 "$T"   # TMPDIR of every sealed command: the suite's root shape
Q=$(cd "$(mktemp -d /tmp/q38s2-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/q38s2-…
chmod 700 "$Q"
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data" "$Q/xdg/cache" "$Q/b" "$Q/p1" "$Q/p2" "$Q/p3" "$Q/psfail" "$Q/fake-claude" "$Q/fake-codex" "$Q/fake-opencode" "$Q/claude" "$Q/codex"
: > "$Q/pids"                                  # the fixture-owned process census: every scratch pid is appended here
: > "$Q/home/.gitconfig"; : > "$Q/home/.gitignore-global"
printf '#!/bin/sh\nexit 1\n' > "$Q/psfail/ps"; chmod 755 "$Q/psfail/ps"   # a ps that cannot report anything
holder() { (cd "$W" && node hub/bin/cland.ts verify queue --json) | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);console.log((v.holder?.session??v.holder?.kind??"none")+" waiters "+(v.waiters??[]).length)})'; }
quiet() { for i in $(seq 1 10); do h=$(holder) && case "$h" in "none "*) echo quiet; return 0;; esac; sleep 60; done; echo "BLOCKED: the verify slot is not free after 10 minutes: ${h:-queue read failed}"; return 1; }
# ld: the one-minute load must be 10 or below before each test file (docs/agents/tests.md load rule); prints free disk space too
ld() { for i in $(seq 1 10); do l=$(sysctl -n vm.loadavg | awk '{print $2}'); if awk -v l="$l" 'BEGIN{exit !(l<=10)}'; then echo "load $l; free kB $(df -k "$T" | awk 'NR==2{print $4}')"; return 0; fi; sleep 60; done; echo "BLOCKED: one-minute load not at or below 10 after 10 minutes: $l"; return 1; }
# nt <id> <files…>: named files from $W, sealed by $Q/env.sh (TMPDIR=$T), one file at a time, TAP output, after quiet and ld; the log is $EV/<id>.log
nt() { id=$1; shift; quiet || return 1; : > "$EV/$id.log"; for f in "$@"; do ld >> "$EV/$id.log" || { tail -n 1 "$EV/$id.log"; return 1; }; ( . "$Q/env.sh"; cd "$W" && node --test --test-concurrency=1 --test-reporter=tap "$f" >> "$EV/$id.log" 2>&1; echo "exit $? $f" >> "$EV/$id.log" ); done; grep -E '^exit ' "$EV/$id.log"; grep -E '^ *not ok|# SKIP' "$EV/$id.log" | head -20; }
# oks <id>: the names on the passing (sub)test lines of $EV/<id>.log
oks() { grep -E '^ *ok [0-9]+ - ' "$EV/$1.log" | sed -E 's/^ *ok [0-9]+ - //'; }
# rp <id> <entry file> <repetitions> <name-pattern flag>: that entry's own test identity alone, repeated (the load gate replays by file and name); appends to $EV/<id>.log; its own local loop variable
rp() { local rep; quiet || return 1; for rep in $(seq 1 "$3"); do ld >> "$EV/$1.log" || return 1; ( . "$Q/env.sh"; cd "$W" && node --test --test-concurrency=1 --test-reporter=tap "$4" "$2" > "$Q/rp.tap" 2>&1; x=$?; cat "$Q/rp.tap" >> "$EV/$1.log"; echo "replay $2 run $rep: exit $x matched $(sed -n 's/^# tests //p' "$Q/rp.tap") passed $(sed -n 's/^# pass //p' "$Q/rp.tap") failed $(sed -n 's/^# fail //p' "$Q/rp.tap")" >> "$EV/$1.log" ); done; grep -E '^replay ' "$EV/$1.log"; }
```

The seal. `seal.mjs` is this run's only launcher, the E-1536 DoD brief's seal (folded run correction a54f9472 and 76c6412f) made specific to this run's roots and given a `doctor` mode.

```sh
cat > "$Q/seal.mjs" <<'JS'
// node "$Q/seal.mjs" env <W> <Q> <EV> <T> <nvim dir> <R>   QA's own shell: the sealed env.sh core (unset and export lines)
// node "$QA_Q/seal.mjs" hub                          sealed, in a scratch project: cland hub start with the fakes first on PATH and authoritative
// node "$QA_Q/seal.mjs" doctor <ps dir or "">        sealed, in a scratch project: cland doctor . --json with that directory first on PATH
// node "$QA_Q/seal.mjs" browser <probe mode> [args…] sealed: a probe.mjs browser mode, cwd $QA_W, TMPDIR $QA_Q/b
// Every environment it makes is fixtureEnvironment(Q, base, overlays), then scratchGitEnvironment: nothing is added after the seal.
import { spawn } from 'node:child_process';
const [mode, ...args] = process.argv.slice(2);
const base = process.env;
const [W, Q, EV, T, NV, R] = mode === 'env' ? args : [base.QA_W, base.QA_Q, base.QA_EV, base.QA_T, base.QA_NVIM, base.QA_R];
if (!W || !EV || !NV || !R || !/^\/private\/tmp\/q38s2-[A-Za-z0-9]+$/.test(Q ?? '') || !/^\/private\/tmp\/qa-e1538s2-[0-9a-f-]{36}$/.test(T ?? '')) {
  console.error('seal: refused: not this run\'s scratch roots'); process.exit(2);
}
const { fixtureEnvironment, scratchGitEnvironment } = await import(`${W}/test-support/fixture-environment.ts`);
const F = `${W}/hub/test/fakes`;
const fakes = [`${F}/claude-code`, `${F}/codex`, `${F}/opencode`];
const harness = mode === 'hub' || mode === 'doctor';
const psDir = mode === 'doctor' && args[0] ? [args[0]] : [];
const rest = String(base.PATH ?? '').split(':').filter(p => p && p !== NV && !fakes.includes(p) && !p.startsWith(`${Q}/`));
const overlays = {
  PATH: [...psDir, ...(harness ? fakes : []), NV, ...rest].join(':'),
  TMPDIR: mode === 'browser' ? `${Q}/b` : T,
  XDG_CONFIG_HOME: `${Q}/xdg/config`, XDG_STATE_HOME: `${Q}/xdg/state`, XDG_DATA_HOME: `${Q}/xdg/data`, XDG_CACHE_HOME: `${Q}/xdg/cache`,
  GIT_AUTHOR_NAME: 'qa', GIT_AUTHOR_EMAIL: 'qa@example.invalid', GIT_COMMITTER_NAME: 'qa', GIT_COMMITTER_EMAIL: 'qa@example.invalid',
  QA_W: W, QA_Q: Q, QA_EV: EV, QA_T: T, QA_NVIM: NV, QA_R: R,
  ...(harness ? { CLAND_CLAUDE_BIN: `${F}/claude-code/claude`, CLAND_CODEX_BIN: `${F}/codex/codex`, CLAND_OPENCODE_BIN: `${F}/opencode/opencode`,
    CLAND_TEST_SKIP_ORPHAN_SWEEP: '1', CLAND_ADAPTER_POLL_MS: '200', CLAND_CLAUDE_AGENTS_MS: '500' } : {}),
};
const env = scratchGitEnvironment(Q, fixtureEnvironment(Q, base, overlays), { excludesFile: `${Q}/home/.gitignore-global` });
for (const k of Object.keys(env)) if (/^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)/.test(k)) delete env[k];
const named = /^[A-Za-z_][A-Za-z0-9_]*$/;
if (mode === 'env') {
  const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";
  for (const k of Object.keys(base).sort()) if (!(k in env) && named.test(k)) console.log(`unset ${k}`);
  for (const [k, v] of Object.entries(env)) if (named.test(k)) console.log(`export ${k}=${quote(v)}`);
} else if (mode === 'hub' || mode === 'doctor' || mode === 'browser') {
  const argv = mode === 'hub' ? [`${W}/hub/bin/cland.ts`, 'hub', 'start']
    : mode === 'doctor' ? [`${W}/hub/bin/cland.ts`, 'doctor', '.', '--json'] : [`${Q}/probe.mjs`, ...args];
  const child = spawn(process.execPath, argv, { cwd: mode === 'browser' ? W : process.cwd(), env, stdio: 'inherit' });
  child.on('error', error => { console.error(`seal: ${error.message}`); process.exitCode = 1; });
  child.on('close', code => { process.exitCode = code ?? 1; });
} else { console.error(`seal: unknown mode ${mode}`); process.exit(2); }
JS
node --check "$Q/seal.mjs" && echo "seal checked"
node "$Q/seal.mjs" env "$W" "$Q" "$EV" "$T" "$NVD" "$R" > "$Q/env.sh" || echo "BLOCKED: seal env failed"
cat >> "$Q/env.sh" <<'ENV'
FCC=$QA_W/hub/test/fakes/claude-code; FCX=$QA_W/hub/test/fakes/codex; FOC=$QA_W/hub/test/fakes/opencode
cland() { node "$QA_W/hub/bin/cland.ts" "$@"; }
# probe <mode> [args…]: the HTTP, lock, doctor-row, census and scan probe (probe.mjs); bprobe: its browser mode through the seal (cwd $QA_W, TMPDIR $QA_Q/b)
probe() { node "$QA_Q/probe.mjs" "$@"; }
bprobe() { node "$QA_Q/seal.mjs" browser "$@"; }
# hp: the pid in this project's .cland/hub.json (the secret is never printed)
hp() { node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(".cland/hub.json","utf8")).pid)+"\n")'; }
# hubstart: cland hub start through the seal (fakes first on PATH and authoritative, no machine-wide orphan sweep); census its pid; keep its secret for the scan
hubstart() { node "$QA_Q/seal.mjs" hub && hp >> "$QA_Q/pids" && probe keepsecret; }
up() { cland hub status > /dev/null 2>&1 && echo up || echo down; }
amode() { sed -n '/^\[auth\]/,/^\[/p' .cland/config.toml | grep -E '^mode = '; }
alive() { kill -0 "$1" 2> /dev/null && echo yes || echo no; }
# run <label> <command…>: exit status, then the first lines of stdout and stderr, redacted by the probe
run() { l=$1; shift; "$@" > "$QA_Q/r.out" 2> "$QA_Q/r.err"; x=$?; echo "$l exit $x"; probe redact < "$QA_Q/r.out" | head -n 30 | sed 's/^/  out: /'; probe redact < "$QA_Q/r.err" | head -n 30 | sed 's/^/  err: /'; }
# has <text>: lines of the last run's output holding the text; hasl <text>: lines of this project's hub log holding it
has() { cat "$QA_Q/r.out" "$QA_Q/r.err" 2> /dev/null | grep -c -F -- "$1"; }
hasl() { grep -c -F -- "$1" .cland/log/hub.log 2> /dev/null; }
# decoy: a detached sleep (its own session, not a child of any row's shell) whose pid stands in for a foreign holder's pid that exists here
decoy() { node -e 'const c=require("node:child_process").spawn("/bin/sleep",["900"],{detached:true,stdio:"ignore"});c.unref();console.log(c.pid)' > "$QA_Q/decoy.pid" && cat "$QA_Q/decoy.pid" >> "$QA_Q/pids"; }
ENV
( . "$Q/env.sh"; env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)' )
( . "$Q/env.sh"; env | cut -d= -f1 | grep -E '^CLAND_' | sort | tr '\n' ' '; echo )
( . "$Q/env.sh"; echo "sealed nvim: $(command -v nvim); $(nvim --version 2> /dev/null | head -n 1)"; echo "sealed TMPDIR is T: $([ "$TMPDIR" = "$QA_T" ] && echo yes || echo no)" )
```

Socket budget, printed for S0 (bytes with the terminating NUL; each must be below 104):

```sh
echo "Q bytes $(printf '%s' "$Q" | wc -c | tr -d ' '); T bytes $(printf '%s' "$T" | wc -c | tr -d ' '); a suite root for comparison $(printf '%s' "/private/tmp/cland-suite-$(uuidgen | tr 'A-Z' 'a-z')" | wc -c | tr -d ' ')"
for p in p1 p2 p3; do echo "$p hub.sock $(( $(printf '%s' "$Q/$p/.cland/hub.sock" | wc -c) + 1 )); spoke.sock $(( $(printf '%s' "$Q/$p/.cland/run/spoke.sock" | wc -c) + 1 ))"; done
echo "TMPDIR fallback hub socket $(( $(printf '%s' "$T/cland-0123456789abcdef.sock" | wc -c) + 1 )); browser TMPDIR bytes $(printf '%s' "$Q/b" | wc -c | tr -d ' ')"
```

The contract's own sockets live under its fixture's `/tmp/tc-*` roots and the shared short-socket aliases; `transport-contract.ts` and `transport-contract-fixture.ts` assert each of them below 104 bytes with its NUL inside the test, so E1538S2-10 and E1538S2-12 judge them.

The scratch tunnel. A TLS server on 127.0.0.1 with the run's test certificate that passes raw bytes to the scratch hub's loopback web edge (the port saved in `$Q/edge.port`, read per connection), so Host and Origin reach the edge unchanged, as `docs/hub/web-edge.md` requires of a tunnel. It is the stand-in for the human-managed tunnel; the last hop is plain HTTP, as in production.

```sh
cat > "$Q/tunnel.mjs" <<'JS'
// node "$QA_Q/tunnel.mjs"   (sealed) TLS on 127.0.0.1 with the run's test certificate, then raw bytes to the loopback web edge in $QA_Q/edge.port
import { createServer } from 'node:tls';
import { connect } from 'node:net';
import { readFileSync, writeFileSync } from 'node:fs';
const Q = process.env.QA_Q;
if (!/^\/private\/tmp\/q38s2-[A-Za-z0-9]+$/.test(Q ?? '')) { console.log('refused: not this run'); process.exit(2); }
let connections = 0;
const server = createServer({ key: readFileSync(`${Q}/tls/k.pem`), cert: readFileSync(`${Q}/tls/c.pem`) }, client => {
  connections++;
  const edge = connect(Number(readFileSync(`${Q}/edge.port`, 'utf8').trim()), '127.0.0.1');
  client.pipe(edge).pipe(client);
  const close = () => { client.destroy(); edge.destroy(); };
  client.on('error', close); edge.on('error', close); client.on('close', close); edge.on('close', close);
});
server.listen(0, '127.0.0.1', () => { writeFileSync(`${Q}/tunnel.port`, `${server.address().port}\n`); console.log(JSON.stringify({ listening: true })); });
const stop = () => { console.log(JSON.stringify({ connections })); server.close(); process.exit(0); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
JS
node --check "$Q/tunnel.mjs" && echo "tunnel checked"
```

The probe. It prints one JSON line per fact and never prints a link, an invite, a cookie value, the password, a hub secret or a lock's nonce; it keeps the values the scan needs in `$Q/secrets.json` and the files `link-*`, `cookie-*`, `users.out`, `pw` (all mode 600). Header arguments are JSON objects whose values may name `@TP` (the tunnel port), `@EP` (the edge port), `@ORIGIN` (`https://qa1538.example.invalid:<tunnel port>`), `@LOCAL` (`http://127.0.0.1:<edge port>`) and `@cookie:<label>` (the name and value a row saved under that label). Body values `@invite`, `@pw` and `@name` become the switch's invite secret, the generated password and the first user's name, read from `users.out` (rule 22: names and ids come from the CLI's own output, never assumed). Modes:

- `edgeport`, `keepsecret`, `redact`, `sha <files…>`, `roots`, `census [project]`: the edge port from `cland hub status --json`, the hub secret kept for the scan, the redaction filter, file digests, project-root resolution, the fixture-owned process census (excluding the probe's own pid);
- `auth <label> <headers>`: mint a link with `cland web --no-open` and GET its `/auth` path on the loopback edge with those headers;
- `tunnelpre`, `ws <label> <headers>`, `post <label> <path> <headers> <body>`: a link-less GET through the tunnel, a WebSocket upgrade of `/ws`, a JSON POST;
- `linkshape <file>`, `users`: shapes of a printed link and of `cland auth mode users`;
- `browse <label> <link file> <png>`: one Headless Shell, a plain navigation of the link;
- `lockfacts`, `plant <fresh|lapsed> <pid>`, `rows <doctor json> <names…>`, `cfgsha <status json>`: the lock, a planted foreign holder (identity-negative), doctor rows, the configuration digest;
- `scan`: the secrets kept, then the publication scanner, over every file under `$EV`, each with a positive control.

```sh
cat > "$Q/probe.mjs" <<'JS'
// node "$QA_Q/probe.mjs" <mode> [args…]   (sealed; browse runs through seal.mjs browser: cwd $QA_W, TMPDIR $QA_Q/b)
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { once } from 'node:events';
import { createHash, randomBytes } from 'node:crypto';
import { hostname } from 'node:os';
import { join, relative } from 'node:path';
const [mode, a1, a2, a3, a4] = process.argv.slice(2);
const W = process.env.QA_W, Q = process.env.QA_Q, EV = process.env.QA_EV, T = process.env.QA_T;
if (!W || !EV || !/^\/private\/tmp\/q38s2-[A-Za-z0-9]+$/.test(Q ?? '')) { console.log(JSON.stringify({ refused: 'not this run' })); process.exit(2); }
appendFileSync(`${Q}/pids`, `${process.pid}\n`);
const req = createRequire(`${W}/package.json`);
const HOST = 'qa1538.example.invalid';
const SECRETS = `${Q}/secrets.json`;
const known = () => existsSync(SECRETS) ? JSON.parse(readFileSync(SECRETS, 'utf8')) : [];
const keep = (kind, value) => { if (typeof value !== 'string' || value.length < 8) return; const k = known(); if (!k.some(x => x.value === value)) { k.push({ kind, value }); writeFileSync(SECRETS, JSON.stringify(k), { mode: 0o600 }); } };
const redact = text => {
  const native = hostname();
  let t = native.length >= 3 ? String(text).split(native).join('<native>') : String(text);
  for (const k of known()) t = t.split(k.value).join(`<${k.kind}>`);
  return t.replace(/[0-9a-f]{64}/gi, '<hex64>').split(Q).join('<Q>');
};
const out = (key, value) => console.log(redact(JSON.stringify({ [key]: value })));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const portOf = name => existsSync(`${Q}/${name}.port`) ? Number(readFileSync(`${Q}/${name}.port`, 'utf8').trim()) : 0;
const cland = (...args) => execFileSync(process.execPath, [`${W}/hub/bin/cland.ts`, ...args], { encoding: 'utf8' });
const sha12 = file => existsSync(file) ? createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 12) : 'absent';
const subst = value => String(value)
  .replaceAll('@ORIGIN', `https://${HOST}:${portOf('tunnel')}`).replaceAll('@LOCAL', `http://127.0.0.1:${portOf('edge')}`)
  .replaceAll('@TP', String(portOf('tunnel'))).replaceAll('@EP', String(portOf('edge')))
  .replace(/@cookie:([a-z0-9-]+)/g, (_, label) => readFileSync(`${Q}/cookie-${label}`, 'utf8').trim());
const headersOf = json => Object.fromEntries(Object.entries(JSON.parse(json)).map(([k, v]) => [k, subst(v)]));
const usersOut = () => readFileSync(`${Q}/users.out`, 'utf8').split('\n');
const password = () => { const f = `${Q}/pw`; if (!existsSync(f)) writeFileSync(f, randomBytes(12).toString('hex'), { mode: 0o600 }); const p = readFileSync(f, 'utf8'); keep('password', p); return p; };
const bodyOf = json => {
  const b = JSON.parse(json);
  for (const [k, v] of Object.entries(b)) {
    if (v === '@invite') b[k] = new URL(usersOut()[1].trim()).searchParams.get('token');
    if (v === '@pw') b[k] = password();
    if (v === '@name') b[k] = usersOut()[0].trim().split(/\s+/)[0];
  }
  return b;
};
const http1 = (method, path, headers, body) => new Promise((resolve, reject) => {
  const data = body === undefined ? undefined : JSON.stringify(body);
  const r = httpRequest({ host: '127.0.0.1', port: portOf('edge'), path, method, agent: false, headers: { ...headers, ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}) } }, res => {
    let text = ''; res.setEncoding('utf8');
    res.on('data', d => { text += d; });
    res.on('end', () => resolve({ status: res.statusCode, cookies: res.headers['set-cookie'] ?? [], location: res.headers.location ?? null, text }));
  });
  r.setTimeout(5000, () => r.destroy(new Error('edge HTTP timeout'))); r.on('error', reject); r.end(data);
});
// a Set-Cookie line as facts: the name's shape, the value's length and the attributes after the value; the value is kept for the scan only
const cookieFacts = (label, lines) => lines.map((line, i) => {
  const cut = line.indexOf(';'), pair = cut < 0 ? line : line.slice(0, cut), name = pair.slice(0, pair.indexOf('='));
  keep('cookie', pair.slice(name.length + 1));
  if (label && i === 0) writeFileSync(`${Q}/cookie-${label}`, pair, { mode: 0o600 });
  return { nameShape: /^cland_[0-9a-f]{12}$/.test(name), valueLength: pair.length - name.length - 1, attrs: cut < 0 ? '' : line.slice(cut + 2) };
});
switch (mode) {
  case 'redact': { let s = ''; process.stdin.on('data', d => { s += d; }).on('end', () => process.stdout.write(redact(s))); break; }
  case 'keepsecret': { keep('hub-secret', JSON.parse(readFileSync('.cland/hub.json', 'utf8')).secret); out('secretKept', true); break; }
  case 'sha': console.log(process.argv.slice(3).map(sha12).join('+')); break;
  case 'edgeport': {   // the running hub's web edge port, from cland hub status --json, saved to $QA_Q/edge.port
    const s = JSON.parse(cland('hub', 'status', '--json'));
    writeFileSync(`${Q}/edge.port`, `${s.web?.port}\n`);
    out('edge', { port: s.web?.port, available: s.web?.available, bind: s.web?.bind ?? null });
    break;
  }
  case 'auth': {   // <label> <headers>: mint a link with cland web --no-open, then GET its /auth path on the loopback edge with these headers
    const link = new URL(cland('web', '--no-open').trim()), secret = link.searchParams.get('token');
    keep('link', secret);
    out('minted', { loopbackEdge: link.origin === `http://127.0.0.1:${portOf('edge')}`, path: link.pathname, secretLength: secret?.length ?? 0 });
    const r = await http1('GET', `${link.pathname}${link.search}`, headersOf(a2));
    out(a1, { status: r.status, location: r.location, cookies: cookieFacts(a1, r.cookies), body: r.text.slice(0, 80) });
    break;
  }
  case 'tunnelpre': {   // through the tunnel with the origin's Host: a link-less /auth must reach the edge and be answered there (401)
    const r = await new Promise((resolve, reject) => {
      const q = httpsRequest({ host: '127.0.0.1', port: portOf('tunnel'), servername: HOST, rejectUnauthorized: false, path: '/auth', agent: false, headers: { Host: `${HOST}:${portOf('tunnel')}` } }, res => {
        let t = ''; res.on('data', d => { t += d; }); res.on('end', () => resolve({ status: res.statusCode, text: t }));
      });
      q.setTimeout(5000, () => q.destroy(new Error('tunnel timeout'))); q.on('error', reject); q.end();
    });
    out('tunnel', { status: r.status, body: r.text.slice(0, 80) });
    break;
  }
  case 'ws': {   // <label> <headers>: a WebSocket upgrade of /ws on the loopback edge; 101 is admission
    const status = await new Promise(resolve => {
      const q = httpRequest({ host: '127.0.0.1', port: portOf('edge'), path: '/ws', agent: false, headers: { ...headersOf(a2), Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': randomBytes(16).toString('base64') } });
      q.on('upgrade', (_res, socket) => { socket.destroy(); resolve(101); });
      q.on('response', res => { res.resume(); resolve(res.statusCode); });
      q.on('error', e => resolve(`error ${e.code ?? e.message}`));
      q.setTimeout(5000, () => { q.destroy(); resolve('timeout'); });
      q.end();
    });
    out(a1, { status });
    break;
  }
  case 'post': {   // <label> <path> <headers> <body>
    const r = await http1('POST', a2, headersOf(a3), bodyOf(a4));
    out(a1, { status: r.status, cookies: cookieFacts(a1, r.cookies), body: r.text.slice(0, 80) });
    break;
  }
  case 'linkshape': {   // <file in $QA_Q>: its first line is a sign-in link; its origin, path and secret length only; the link alone goes to <file>.link
    const u = new URL(readFileSync(`${Q}/${a1}`, 'utf8').split('\n')[0].trim()), secret = u.searchParams.get('token');
    keep('link', secret);
    writeFileSync(`${Q}/${a1}.link`, u.href, { mode: 0o600 });
    out('link', { origin: u.origin, path: u.pathname, secretLength: secret?.length ?? 0, secretHex: /^[0-9a-f]+$/.test(secret ?? '') });
    break;
  }
  case 'users': {   // the saved output of cland auth mode users: the first user's line and the invite's shape
    const [line, url] = usersOut(), u = new URL(url.trim()), secret = u.searchParams.get('token');
    keep('invite', secret);
    out('users', { line: line.trim(), inviteOrigin: u.origin, invitePath: u.pathname, secretLength: secret?.length ?? 0 });
    break;
  }
  case 'browse': {   // <label> <link file> <png>: one Headless Shell with its own profile under TMPDIR ($QA_Q/b); a plain navigation of the link
    const link = readFileSync(`${Q}/${a2}`, 'utf8').trim();
    const { webPrerequisite } = await import(`${W}/web/test/prerequisite.ts`);
    const pre = await webPrerequisite();
    if (!pre.available) { out('unavailable', pre.reason); process.exit(3); }
    const { chromium } = req('playwright-core');
    const server = await chromium.launchServer({ executablePath: pre.executablePath, headless: true, timeout: 15000, args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`, '--ignore-certificate-errors'] });
    const child = server.process(), group = child.pid, exited = once(child, 'exit');
    appendFileSync(`${Q}/pids`, `${group}\n`);
    out('browser', { headlessShell: /(?:chrome-headless-shell|headless_shell)/.test(child.spawnfile), profileInScratch: (child.spawnargs.find(a => a.startsWith('--user-data-dir=')) ?? '').startsWith(`--user-data-dir=${process.env.TMPDIR}/`) });
    try {
      const browser = await chromium.connect(server.wsEndpoint(), { timeout: 15000 });
      const context = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
      context.setDefaultTimeout(15000);
      const page = await context.newPage();
      const auths = [];
      page.on('response', r => { if (new URL(r.url()).pathname === '/auth') auths.push(r); });
      const final = await page.goto(link, { waitUntil: 'load' });
      const r = auths[0] ?? await final?.request().redirectedFrom()?.response();
      if (!r) out('navigation', { authResponses: 0 });
      else {
        const sent = await r.request().allHeaders();
        const lines = (await r.headersArray()).filter(h => h.name.toLowerCase() === 'set-cookie').map(h => h.value);
        out('navigation', { authResponses: Math.max(auths.length, 1), status: r.status(), method: r.request().method(), scheme: new URL(r.url()).protocol, originHeaderSent: Object.keys(sent).some(k => k.toLowerCase() === 'origin'), fetchMode: sent['sec-fetch-mode'] ?? null, cookies: cookieFacts('', lines) });
      }
      const jar = await context.cookies();
      for (const c of jar) keep('cookie', c.value);
      out('jar', jar.map(c => ({ nameShape: /^cland_[0-9a-f]{12}$/.test(c.name), domain: c.domain, path: c.path, secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite })));
      out('page', { origin: new URL(page.url()).origin, path: new URL(page.url()).pathname });
      let live = false; const until = Date.now() + 15000;
      while (Date.now() < until && !(live = await page.evaluate(() => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live'))) await sleep(250);
      out('live', live);
      await page.screenshot({ path: `${EV}/${a3}` });
      await browser.close();
    } catch (error) { out('step', String(error?.message ?? error).split('\n')[0]); }
    finally { await server.close(); await exited; }
    out('browserGroupAfter', execFileSync('ps', ['-e', '-o', 'pid=,pgid='], { encoding: 'utf8' }).split('\n').map(l => l.trim().split(/\s+/).map(Number)).filter(([, g]) => g === group).length);
    break;
  }
  case 'lockfacts': {   // this project's .cland/hub.lock: its field names, native identity, holder pid, heartbeat (never its nonce)
    const { lockHostIdentity } = await import(`${W}/hub/src/hub/lock-identity.ts`);
    const id = lockHostIdentity(), rec = JSON.parse(readFileSync('.cland/hub.lock', 'utf8')), h = rec.hostIdentity ?? {};
    const hubPid = existsSync('.cland/hub.json') ? JSON.parse(readFileSync('.cland/hub.json', 'utf8')).pid : null;
    out('lock', { keys: Object.keys(rec).sort(), pidIsHub: rec.pid === hubPid, hostIdentityIsNative: h.hostname === id.hostname && h.bootId === id.bootId && h.pidNamespace === id.pidNamespace, heartbeat: rec.heartbeat, heartbeatAgeMs: Date.now() - Date.parse(rec.heartbeat), nonceLength: String(rec.token ?? '').length, plantedHolder: rec.token === 'qa-foreign-nonce' });
    break;
  }
  case 'plant': {   // <fresh|lapsed> <pid>: a whole lock record of a synthetic foreign host (identity-negative) and a hub.json naming that pid
    const age = a1 === 'fresh' ? 5 : a1 === 'lapsed' ? 120 : NaN, pid = Number(a2);
    if (!process.cwd().startsWith(`${Q}/`) || !Number.isFinite(age) || !pid) { out('refused', 'plant needs a scratch project, fresh or lapsed, and a pid'); process.exit(2); }
    const rec = { pid, started: null, token: 'qa-foreign-nonce', hostIdentity: { hostname: 'qa-foreign.invalid', bootId: '00000000-0000-4000-8000-000000001538', pidNamespace: 'pid:[4026531838]' }, heartbeat: new Date(Date.now() - age * 1000).toISOString() };
    writeFileSync('.cland/hub.lock.qa-tmp', `${JSON.stringify(rec)}\n`, { mode: 0o600 }); renameSync('.cland/hub.lock.qa-tmp', '.cland/hub.lock');
    writeFileSync('.cland/hub.json', JSON.stringify({ root: process.cwd(), socket: `${process.cwd()}/.cland/absent.sock`, port: 1, secret: 'qa-planted-not-a-secret', pid, version: 'qa' }), { mode: 0o600 });
    out('planted', { variant: a1, ageSec: age, pid });
    break;
  }
  case 'rows': {
    const j = JSON.parse(readFileSync(a1, 'utf8'));
    for (const name of process.argv.slice(4)) for (const c of j.checks.filter(x => x.name === name)) out(`row ${name}`, { verdict: c.verdict, detail: c.detail, fix: c.fix ?? null });
    break;
  }
  case 'cfgsha': {
    const v = JSON.parse(readFileSync(a1, 'utf8'));
    out('config', { present: v.config !== undefined, sha12: createHash('sha256').update(JSON.stringify(v.config ?? null)).digest('hex').slice(0, 12) });
    break;
  }
  case 'roots': {
    const { hubDiscovery, projectRoot } = await import(`${W}/hub/src/project.ts`);
    for (const p of ['p1', 'p2', 'p3']) out(`root ${p}`, { discovery: hubDiscovery(`${Q}/${p}`), root: projectRoot(`${Q}/${p}`) });
    break;
  }
  case 'census': {   // [project]: processes whose command line names $QA_Q/<project> (or, with no argument, $QA_Q or $QA_T), never this probe itself; count on stdout, rows on stderr; the unfiltered listing stays in $QA_Q
    const all = execFileSync('ps', ['-Ao', 'pid=,command='], { encoding: 'utf8' });
    writeFileSync(`${Q}/ps-all.txt`, all, { mode: 0o600 });
    const needle = a1 ? `${Q}/${a1}` : Q;
    const rows = all.split('\n').map(l => l.trim()).filter(Boolean)
      .filter(l => Number(l.split(/\s+/)[0]) !== process.pid && (l.includes(needle) || (!a1 && T && l.includes(T))));
    console.log(rows.length);
    for (const row of rows) console.error(redact(row).slice(0, 160));
    break;
  }
  case 'scan': {   // the secrets kept, in every regular file under $QA_EV; then the publication scanner over the same files; each with a positive control
    const { assertPublishable } = await import(`${W}/.agents/skills/qa/qa-demo-policy.ts`);
    const files = [];
    const walk = d => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (e.isFile()) files.push(p); } };
    walk(EV);
    const k = known(), control = `${Q}/scan-control.txt`;
    writeFileSync(control, k.map(x => x.value).join('\n'), { mode: 0o600 });
    for (const f of [...files, control]) { const t = readFileSync(f, 'latin1'); for (const x of k) if (t.includes(x.value)) out('hit', { kind: x.kind, file: f === control ? 'control' : relative(EV, f) }); }
    out('kinds', [...new Set(k.map(x => x.kind))].sort());
    const publishControl = `${Q}/publish-control.txt`;
    writeFileSync(publishControl, ['to', 'ken', '=', 'a'.repeat(24)].join(''));   // made at run time: the brief's own text never carries the pattern
    let scanned = 0, images = 0;
    for (const f of [...files, publishControl]) {
      if (/\.png$/i.test(f)) { images++; continue; }
      scanned++;
      try { assertPublishable(readFileSync(f, 'utf8')); } catch { out('publishRefused', f === publishControl ? 'control' : relative(EV, f)); }
    }
    out('publishScan', { scanned, images });
    unlinkSync(control); unlinkSync(publishControl);
    out('controlsRemoved', !existsSync(control) && !existsSync(publishControl));
    break;
  }
  default: out('refused', `unknown mode ${mode}`); process.exit(2);
}
JS
node --check "$Q/probe.mjs" && echo "probe checked"
```

The contract controls (E1538S2-12). A QA module outside the build that imports the build's shared contract and its fixture unchanged. The baseline must pass, so a failing control means the contract caught the mutation, not that the fixture is broken (rule 22).

```sh
cat > "$Q/contract-controls.mjs" <<'JS'
// node --test "$QA_Q/contract-controls.mjs"   (sealed, cwd $QA_W) the shared transport contract against its own fixture, then three mutations
import test from 'node:test';
import net from 'node:net';
const W = process.env.QA_W;
const { transportContract } = await import(`${W}/hub/test/transport-contract.ts`);
const { sshContractFixture } = await import(`${W}/hub/test/transport-contract-fixture.ts`);
test('qa control baseline: the unmodified fixture', { timeout: 30000 }, t => transportContract(t, sshContractFixture));
test('qa control no-drop: the carrier is never dropped', { timeout: 30000 }, t => transportContract(t, async c => ({ ...(await sshContractFixture(c)), drop: async () => {} })));
test('qa control tcp: a loopback TCP listener in the worker', { timeout: 30000 }, t => transportContract(t, async c => {
  const f = await sshContractFixture(c);   // the fixture's own pre-start scan has run; the listener is planted after it
  const listener = net.createServer();
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  c.after(() => new Promise(resolve => listener.close(() => resolve())));
  return f;
}));
test('qa control kind: the carrier reports outbound', { timeout: 30000 }, t => transportContract(t, async c => {
  const f = await sshContractFixture(c);
  return { ...f, transport: new Proxy(f.transport, { get: (o, k) => k === 'kind' ? 'outbound' : (typeof o[k] === 'function' ? o[k].bind(o) : o[k]) }) };
}));
JS
node --check "$Q/contract-controls.mjs" && echo "controls checked"
```

The stage-1 rows by reference (E1538S2-15 to E1538S2-21). `s1row.mjs` reads a row of the committed stage-1 brief at the build: its named files (the command cell), and the literal titles its expected column lists after "`oks` lists Tests:" (up to its generated-case note). The stage-1 brief's expected column for that row is the one the rerun is judged against.

```sh
cat > "$Q/s1row.mjs" <<'JS'
// node s1row.mjs files <stage-1 brief> <row> | titles <stage-1 brief> <row> <oks file>
import { readFileSync } from 'node:fs';
const [mode, brief, row, oksFile] = process.argv.slice(2);
const line = readFileSync(brief, 'utf8').split('\n').find(l => l.startsWith(`| E1538S1-${row} |`));
if (!line) { console.log(`BLOCKED: no row E1538S1-${row} in the stage-1 brief`); process.exit(2); }
if (mode === 'files') { console.log([...line.split(' | ')[3].matchAll(/hub\/test\/[\w.-]+\.test\.ts/g)].map(m => m[0]).join(' ')); process.exit(0); }
const marker = '`oks` lists Tests: ', at = line.indexOf(marker);
let rest = at < 0 ? '' : line.slice(at + marker.length);
const cuts = [rest.indexOf(', plus the generated'), rest.indexOf(' (T-1')].filter(x => x >= 0);
if (cuts.length) rest = rest.slice(0, Math.min(...cuts));
const titles = [...rest.matchAll(/`([^`]+)`/g)].map(m => m[1]);
const oks = new Set(readFileSync(oksFile, 'utf8').split('\n').map(s => s.trim()));
let missing = 0;
for (const title of titles) if (!oks.has(title)) { missing++; console.log(`MISSING: ${title}`); }
console.log(`stage-1 row E1538S1-${row}: titles listed ${titles.length}, missing ${missing}`);
JS
node --check "$Q/s1row.mjs" && echo "s1row checked"
B1="$W/qa/briefs/E-1538-stage-1.md"
echo "stage-1 brief: last change $(git -C "$W" log -1 --format=%H -- qa/briefs/E-1538-stage-1.md); sha256 $(shasum -a 256 "$B1" | cut -d' ' -f1)"
# s1 <stage-1 row> <this row id>: that row's files through nt, then its listed titles against the passing lines
s1() { F=$(node "$Q/s1row.mjs" files "$B1" "$1") || { echo "$F"; return 1; }; nt "$2" $F; oks "$2" > "$Q/oks-$2.txt"; node "$Q/s1row.mjs" titles "$B1" "$1" "$Q/oks-$2.txt"; }
```

At writing the stage-1 brief last changed at `3536669d515e64e225b69c7abdf4f46e69ba9c39` (the folded qa-life1 corrections for rows 01, 05, 06, 08 and 19) with SHA-256 `b11f991ddbe96b8905a41da33d7d6a924bae89dcd53dc888b08efc1e8d6029f7`. If either differs at the build, save `git -C "$W" diff 3536669d515e64e225b69c7abdf4f46e69ba9c39 HEAD -- qa/briefs/E-1538-stage-1.md` to `$EV/S0-stage1-brief.diff` and read it before running: the committed version at the build is the one used. Never copy the stage-1 brief, `env.sh`, `probe.mjs` or any helper under `$EV` (their static text trips the publication scanner, and they hold paths of the scratch secrets); record digests and line counts only.

**Web build (S0).** Build once in `$W` under the sealed environment, after `quiet` and `ld`, and check the stamp (stage-1 row 19 correction):

```sh
quiet && ld && ( . "$Q/env.sh"; cd "$W" && npm run build ) > "$EV/S0-build.txt" 2>&1; echo "build exit $?"
node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));if(s.version!==1||typeof s.sources!=="string"||!s.builtAt)process.exit(1);console.log("web build stamp ok")' "$W/web/dist/build-stamp.json" || echo "BLOCKED: web build stamp missing or invalid"
```

Record the setup as check `S0` with `qa-record.sh note`: the worktree, `$Q` and `$T`, `seal checked`, `tunnel checked`, `probe checked`, `controls checked`, `s1row checked`, the zero credential-name count, the `CLAND_` name list (it must hold no `CLAND_SESSION_*`, `CLAND_ROLE` or launch credential name from QA's own session), the `sealed nvim:` line (the binary under the build's pinned cache, `.cache/nvim/<tag>/` with the tag of `nvim/NVIM_VERSION`, `v0.12.5` at writing, printing `NVIM v0.12.5`; a Homebrew or other inherited `nvim`, or none, makes S0 BLOCKED), `sealed TMPDIR is T: yes`, the socket byte lengths (each below 104, `T` no longer than the suite root), the stage-1 brief digest line, `build exit 0` and `web build stamp ok`.

The check functions. Define them in QA's own shell (paste the block once). Rows on a scratch project call them as `( . "$Q/env.sh"; cd "$Q/pN" && <function> ) > "$EV/<id>.txt" 2>&1`; read the capture, then record it. Rows E1538S2-13 and E1538S2-14 need a command timeout of at least 600000 ms.

```sh
m00() {   # QA's own shell: build, plan, landings, the root's status
  echo "PRE: HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) want $S"
  echo "dirty entries $(git -C "$W" status --porcelain | grep -v -x '?? node_modules' | wc -l | tr -d ' ')"
  echo "root entries outside .cland/tasks, harness-local settings left out: $(git -C "$R" status --porcelain | grep -v -F '.cland/tasks/' | grep -v -x '?? .claude/settings.local.json' | wc -l | tr -d ' ')"
  (cd "$R" && node hub/bin/cland.ts task plan show E-1538 --json) > "$EV/E1538S2-00-plan.json"
  node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s2=p.stages.find(x=>x.name==="secure cookie and the transport contract"),s1=p.stages.find(x=>x.name==="lock, deletion and paths");console.log(JSON.stringify({stage2:{state:s2.state,qa:s2.qa,items:s2.items,merged:s2.merged,total:s2.total,statuses:s2.statuses},stage1:{state:s1.state,verdict:s1.verdict?.result,verdictCommit:s1.verdict?.commit,current:s1.verdict?.current}}))' "$EV/E1538S2-00-plan.json"
  for id in $(node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(p.stages.find(x=>x.name==="secure cookie and the transport contract").items.join(" "))' "$EV/E1538S2-00-plan.json"); do
    echo "$id landings: $(git -C "$R" log --first-parent --format=%H --grep "^Item: $id\$" "$S" | tr '\n' ' ')"; done
}
m01() {   # QA's own shell, read-only in $W: what each landing touched, and the source facts its criteria rest on
  echo "PRE: HEAD $(git -C "$W" rev-parse HEAD)"
  land() { git -C "$W" log --first-parent --format=%H --grep "^Item: $1\$" HEAD | head -n 1; }
  A=$(land T-1624); B=$(land T-1625); echo "landings: T-1624 $A; T-1625 $B"
  echo "T-1624 files: $(git -C "$W" diff --name-only "$A^1" "$A" | sort | tr '\n' ' ')"
  echo "T-1624 hub/src numstat: $(git -C "$W" diff --numstat "$A^1" "$A" -- hub/src | tr '\t\n' '  ')"
  echo "T-1624 admission sources changed (web-edge.ts, web-signin.ts, web-authority.ts): $(git -C "$W" diff --name-only "$A^1" "$A" -- hub/src/hub/web-edge.ts hub/src/hub/web-signin.ts hub/src/hub/web-authority.ts | wc -l | tr -d ' ')"
  echo "T-1624 web-auth.test.ts numstat: $(git -C "$W" diff --numstat "$A^1" "$A" -- hub/test/web-auth.test.ts | cut -f1,2 | tr '\t' ' ')"
  echo "T-1625 files: $(git -C "$W" diff --name-only "$B^1" "$B" | sort | tr '\n' ' ')"
  echo "T-1625 production, fake, test-support and shared files changed: $(git -C "$W" diff --name-only "$B^1" "$B" -- hub/src hub/test/fakes test-support shared | wc -l | tr -d ' ')"
  ( cd "$W"
    D=docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md; G=$(ls docs/agents/tests/hub-test-transport-ssh-contract.*.md)
    echo "cookie predicate on the configured origin and Host only: $(grep -c -F "origin && req.headers.host?.toLowerCase() === new URL(origin).host ? '; Secure' : ''" hub/src/hub/web-auth.ts)"
    echo "Set-Cookie writers in hub/src: $(git grep -n "setHeader('Set-Cookie'" -- hub/src | grep -v -c '\.test\.ts'); through webSessionCookie: $(git grep -n "setHeader('Set-Cookie', webSessionCookie(" -- hub/src | grep -v -c '\.test\.ts')"
    echo "ADR 0003 amendment heading: $(grep -c -F '## Amendment, 2026-11-03: Secure cookies follow the configured Host (T-1624)' "$D"); supersedes the 2026-10-21 condition: $(grep -c -F 'This supersedes the Secure condition in the 2026-10-21 amendment' "$D")"
    echo "web edge guide, Secure on a GET without Origin: $(grep -c -F 'including a top-level GET without Origin' docs/hub/web-edge.md)"
    echo "endpoint list exported: $(grep -c -F "export const TRANSPORT_ENDPOINTS = ['hub.sock', 'spoke.sock', 'git.sock', 'agent.sock'] as const;" hub/test/transport-contract.ts)"
    echo "entry registrations (ssh, fake): $(grep -c -E '^test\(' hub/test/transport-ssh-contract.test.ts) $(grep -c -E '^test\(' hub/test/transport-fake-contract.test.ts); entries calling the shared contract: $(grep -c -F 'transportContract(t, sshContractFixture)' hub/test/transport-ssh-contract.test.ts) $(grep -c -F 'transportContract(t, sshContractFixture)' hub/test/transport-fake-contract.test.ts)"
    echo "helper modules importing the runner's test function: $(cat hub/test/transport-contract.ts hub/test/transport-contract-fixture.ts | grep -c -E "^import test from 'node:test'")"
    echo "contract assertions (private run directory, socket node, byte budget, kind through the parser): $(grep -c -F "0o700, 'agent-owned run directory is private'" hub/test/transport-contract.ts) $(grep -c -F 'isSocket(), true, endpoint' hub/test/transport-contract.ts) $(grep -c -F 'Buffer.byteLength(path) + 1 < 104' hub/test/transport-contract.ts) $(grep -c -F 'parseTransportKind(f.transport.kind), f.transport.kind' hub/test/transport-contract.ts)"
    echo "native TCP scan with a planted positive control: $(grep -c -F "'native scan detects planted TCP listener'" hub/test/transport-contract-fixture.ts)"
    echo "tiers (contract ssh, contract fake, cookie): $(grep -c -F '"hub/test/transport-ssh-contract.test.ts": "T3"' hub/test/tiers.json) $(grep -c -F '"hub/test/transport-fake-contract.test.ts": "T3"' hub/test/tiers.json) $(grep -c -F '"hub/test/web-cookie-secure.test.ts": "T2"' hub/test/tiers.json)"
    echo "C8 guide at the decided path: $(basename "$G") $(test -f "$G" && echo present || echo absent); names outbound for 0.4.x: $(grep -c -F 'expected to be `outbound` in 0.4.x' "$G"); the carrier passes unchanged: $(grep -c -F 'passes its assertions unchanged' "$G")"
    echo "the item body's guide path (absent by Coordinator decision 3ef5f1e): $(test -e docs/agents/tests/hub-test-transport-contract.md && echo present || echo absent)"
    echo "test guide index rows (ssh, fake, cookie): $(grep -c -F '[`hub/test/transport-ssh-contract.test.ts`]' docs/agents/tests/index.md) $(grep -c -F '[`hub/test/transport-fake-contract.test.ts`]' docs/agents/tests/index.md) $(grep -c -F '[`hub/test/web-cookie-secure.test.ts`]' docs/agents/tests/index.md)" )
}
m02() {   # QA's own shell, read-only: what changed under stage 1's sources since its clear verdict
  V=986afe46b587899bcf9ebb3f51781d3491a904ca
  echo "PRE: the stage-1 verdict build is an ancestor of HEAD: $(git -C "$W" merge-base --is-ancestor "$V" HEAD && echo yes || echo no)"
  for p in hub/src/hub/lock.ts hub/src/hub/lock-identity.ts hub/src/process-identity.ts hub/src/hub/daemon.ts hub/src/cli/hub.ts hub/src/doctor hub/src/executor/droplet hub/src/state-paths.ts hub/src/host/transport-kind.ts hub/src/host/transport-config.ts hub/src/init/config.ts hub/test/fakes/digitalocean site/src/content/docs/docs/install.md; do
    echo "$p: $(git -C "$W" log --format=%H --no-merges "$V..HEAD" -- "$p" | tr '\n' ' ')"; done
}
m03() {   # p1: init, a hub with no [web] origin; the edge's cookies over HTTP (the no-origin baseline)
  echo "PRE: p1 entries $(ls -A | wc -l | tr -d ' '); fakes $(ls "$FCC/claude" "$FCX/codex" "$FOC/opencode" | wc -l | tr -d ' '); bundle $(ls "$QA_W/web/dist/index.html" | wc -l | tr -d ' '); credential-prefix names $(env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)')"
  git init -q -b dev && git config user.name 'Jane Q. Doe' && git commit -q --allow-empty -m init
  cland init . > "$QA_EV/E1538S2-03-init.txt" 2>&1; echo "init exit $?"
  [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; cland hub stop > /dev/null 2>&1; sleep 2
  sed -i '' -e "s|^lock_path = .*|lock_path = \"$QA_Q/p1-suite.lock\"|" -e 's|^executor = .*|executor = "local"|' .cland/config.toml
  echo "lock $(grep -c -x "lock_path = \"$QA_Q/p1-suite.lock\"" .cland/config.toml) executor $(grep -c -x 'executor = "local"' .cland/config.toml) empty origin in [web] $(sed -n '/^\[web\]/,/^\[/p' .cland/config.toml | grep -c -x 'origin = ""')"
  hubstart; echo "hub start exit $?"; probe edgeport
  probe auth local '{}'
  probe auth localhost '{"Host":"localhost:@EP"}'
  probe auth forwarded '{"X-Forwarded-Host":"qa1538.example.invalid:8443","X-Forwarded-Proto":"https","Forwarded":"host=qa1538.example.invalid:8443;proto=https"}'
  probe auth tunnelhost '{"Host":"qa1538.example.invalid:8443"}'
}
m04() {   # p1, the no-origin hub of m03: one Headless Shell opens the printed loopback link
  echo "PRE: hub $(up); empty origin in [web] $(sed -n '/^\[web\]/,/^\[/p' .cland/config.toml | grep -c -x 'origin = ""')"
  cland web --no-open > "$QA_Q/link-local" 2> "$QA_Q/r.err"; echo "web --no-open exit $?"; chmod 600 "$QA_Q/link-local"
  probe linkshape link-local
  bprobe browse local link-local.link E1538S2-04.png
}
m05() {   # p1: the scratch HTTPS tunnel (run-made test certificate, loopback only), [web] origin set to it, the hub restarted; the cookie matrix over HTTP
  echo "PRE: hub $(up); openssl $(command -v openssl)"
  cland hub stop > /dev/null 2>&1; sleep 2; echo "hub after stop: $(up)"
  mkdir -p "$QA_Q/tls" && chmod 700 "$QA_Q/tls"
  openssl req -x509 -newkey rsa:2048 -nodes -keyout "$QA_Q/tls/k.pem" -out "$QA_Q/tls/c.pem" -days 1 -subj '/CN=qa1538.example.invalid' > "$QA_Q/tls/openssl.out" 2>&1; echo "certificate exit $?"
  chmod 600 "$QA_Q/tls/k.pem"; openssl x509 -noout -subject -in "$QA_Q/tls/c.pem"
  : > "$QA_Q/tunnel.port"; ( node "$QA_Q/tunnel.mjs" > "$QA_Q/tunnel.out" 2>&1 & echo $! > "$QA_Q/tunnel.pid" ); cat "$QA_Q/tunnel.pid" >> "$QA_Q/pids"
  for i in $(seq 1 30); do [ -s "$QA_Q/tunnel.port" ] && break; sleep 1; done; TP=$(cat "$QA_Q/tunnel.port")
  echo "tunnel port read: $([ -n "$TP" ] && echo yes || echo no)"
  sed -i '' -e "/^\[web\]/,/^\[/s|^origin = \"\"$|origin = \"https://qa1538.example.invalid:$TP\"|" .cland/config.toml
  echo "origin line $(grep -c -x "origin = \"https://qa1538.example.invalid:$TP\"" .cland/config.toml)"
  hubstart; echo "hub start exit $?"; probe edgeport
  probe tunnelpre
  probe auth tunnel '{"Host":"qa1538.example.invalid:@TP"}'
  probe auth exact '{"Host":"qa1538.example.invalid:@TP","Origin":"@ORIGIN"}'
  probe auth foreignorigin '{"Host":"qa1538.example.invalid:@TP","Origin":"https://foreign.example.invalid"}'
  probe auth upper '{"Host":"QA1538.EXAMPLE.INVALID:@TP"}'
  probe auth local '{}'
  probe auth localhost '{"Host":"localhost:@EP"}'
  probe auth forwarded '{"X-Forwarded-Host":"qa1538.example.invalid:@TP","X-Forwarded-Proto":"https","Forwarded":"host=qa1538.example.invalid:@TP;proto=https","Origin":"@ORIGIN"}'
  probe auth otherhost '{"Host":"other.example.invalid:@TP"}'
  probe auth noport '{"Host":"qa1538.example.invalid"}'
}
m06() {   # p1, the origin hub of m05: cland web --qr prints the origin link; one Headless Shell opens it with a plain navigation through the tunnel
  echo "PRE: hub $(up); tunnel alive $(alive "$(cat "$QA_Q/tunnel.pid")")"
  cland web --qr > "$QA_Q/link-origin" 2> "$QA_Q/r.err"; echo "web --qr exit $?; QR lines after the link: $(tail -n +2 "$QA_Q/link-origin" | wc -l | tr -d ' ')"; chmod 600 "$QA_Q/link-origin"
  probe linkshape link-origin
  bprobe browse origin link-origin.link E1538S2-06.png
}
m07() {   # p1, the origin hub: WebSocket and upload admission keep Host and exact Origin; the session cookie of m05's tunnel row
  echo "PRE: hub $(up); session cookie kept $(test -s "$QA_Q/cookie-tunnel" && echo yes || echo no)"
  probe ws admitted '{"Host":"qa1538.example.invalid:@TP","Origin":"@ORIGIN","Cookie":"@cookie:tunnel"}'
  probe ws nocookie '{"Host":"qa1538.example.invalid:@TP","Origin":"@ORIGIN"}'
  probe ws hostonly '{"Host":"qa1538.example.invalid:@TP","Cookie":"@cookie:tunnel"}'
  probe ws foreignorigin '{"Host":"qa1538.example.invalid:@TP","Origin":"https://foreign.example.invalid","Cookie":"@cookie:tunnel"}'
  probe ws nullorigin '{"Host":"qa1538.example.invalid:@TP","Origin":"null","Cookie":"@cookie:tunnel"}'
  probe ws forwardedhost '{"Host":"foreign.example.invalid","X-Forwarded-Host":"qa1538.example.invalid:@TP","Origin":"@ORIGIN","Cookie":"@cookie:tunnel"}'
  probe post upload-hostonly /upload '{"Host":"qa1538.example.invalid:@TP","Cookie":"@cookie:tunnel"}' '{}'
  probe post upload-foreign /upload '{"Host":"qa1538.example.invalid:@TP","Origin":"https://foreign.example.invalid","Cookie":"@cookie:tunnel"}' '{}'
}
m08() {   # p1, the origin hub: users mode; the invite and password cookies follow the same helper; the sign-in APIs keep their admission
  echo "PRE: hub $(up); $(amode)"
  cland auth mode users > "$QA_Q/users.out" 2> "$QA_Q/r.err"; echo "auth mode users exit $?"; chmod 600 "$QA_Q/users.out"
  probe users
  probe post register /invite/register '{"Host":"qa1538.example.invalid:@TP","Origin":"@ORIGIN"}' '{"token":"@invite","password":"@pw"}'
  probe post signin-tunnel /signin/password '{"Host":"qa1538.example.invalid:@TP","Origin":"@ORIGIN"}' '{"name":"@name","password":"@pw"}'
  probe post signin-local /signin/password '{"Origin":"@LOCAL"}' '{"name":"@name","password":"@pw"}'
  for p in invite/register signin/password upload; do l=$(printf '%s' "$p" | tr / -)
    probe post "hostonly-$l" "/$p" '{"Host":"qa1538.example.invalid:@TP","Cookie":"@cookie:register"}' '{}'
    probe post "foreign-$l" "/$p" '{"Host":"qa1538.example.invalid:@TP","Origin":"https://foreign.example.invalid","Cookie":"@cookie:register"}' '{}'
  done
}
ctl() {   # QA's own shell, after the controls ran: the verdict lines and the expected messages in $EV/E1538S2-12.log
  grep -E '^ *(not )?ok [0-9]+ - qa control' "$EV/E1538S2-12.log"
  echo "no-drop message: $(grep -c -F 'replacement carrier and all four endpoints answer: not within 8000 ms' "$EV/E1538S2-12.log")"
  echo "tcp message: $(grep -c -F 'hub stubs and host/carrier processes bind no TCP listeners' "$EV/E1538S2-12.log")"
  echo "kind message: $(grep -c -F 'outbound transport requires 0.4.x' "$EV/E1538S2-12.log")"
}
hm() {   # QA's own shell: the shared helper modules alone hold no test of their own: node --test reports one top-level wrapper per file, named by the file, with nothing nested (their tests belong to the entry files)
  ( . "$Q/env.sh"; cd "$W" && node --test --test-concurrency=1 --test-reporter=tap hub/test/transport-contract.ts hub/test/transport-contract-fixture.ts > "$Q/hm.tap" 2>&1; x=$?
    echo "helper modules run: exit $x; top-level entries: $(grep -E '^(not )?ok [0-9]+ - ' "$Q/hm.tap" | sed -E 's/^(not )?ok [0-9]+ - //' | LC_ALL=C sort | paste -sd ' ' -); nested entries $(grep -c -E '^ +(not )?ok [0-9]+ - ' "$Q/hm.tap"); contract case names $(grep -c -E 'ssh carrier with fake sshd|fake transport pairing' "$Q/hm.tap")" ) >> "$EV/E1538S2-11.log"; tail -n 1 "$EV/E1538S2-11.log"
}
m13() {   # p2: native start, the lock record and its heartbeat; a fresh foreign holder refuses start and stop; a lapsed one is taken whole
  echo "PRE: p2 entries $(ls -A | wc -l | tr -d ' ')"
  git init -q -b dev && git config user.name 'QA Two' && git commit -q --allow-empty -m init
  cland init . > "$QA_EV/E1538S2-13-init.txt" 2>&1; echo "init exit $?"
  [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; cland hub stop > /dev/null 2>&1; sleep 2
  sed -i '' -e "s|^lock_path = .*|lock_path = \"$QA_Q/p2-suite.lock\"|" -e 's|^executor = .*|executor = "local"|' .cland/config.toml
  decoy; D=$(cat "$QA_Q/decoy.pid"); echo "decoy alive $(alive "$D")"
  hubstart; echo "hub start exit $?"
  probe lockfacts; sleep 25; probe lockfacts
  run "hub stop" cland hub stop; for i in $(seq 1 15); do [ -e .cland/hub.lock ] || break; sleep 1; done
  echo "lock after stop: $(test -e .cland/hub.lock && echo present || echo absent); hub $(up)"
  echo "-- a fresh foreign holder (synthetic identity: identity-negative)"
  probe plant fresh "$D"; S1=$(probe sha .cland/hub.lock .cland/hub.json)
  run "hub start" hubstart
  run "hub status" cland hub status
  run "hub status --json" cland hub status --json
  run "hub stop" cland hub stop
  echo "processes naming p2: $(probe census p2); lock and hub.json unchanged: $([ "$(probe sha .cland/hub.lock .cland/hub.json)" = "$S1" ] && echo yes || echo no); decoy alive $(alive "$D")"
  echo "-- a lapsed foreign holder"
  probe plant lapsed "$D"
  run "hub start" hubstart
  probe lockfacts
  echo "guard directory: $(test -e .cland/hub.lock.break && echo present || echo absent); decoy alive $(alive "$D")"
  run "hub stop" cland hub stop
}
m14() {   # p3: init; the doctor ps row with the real ps and with a ps that cannot report; then the transport kind at start and at reload
  echo "PRE: p3 entries $(ls -A | wc -l | tr -d ' ')"
  git init -q -b dev && git config user.name 'QA Three' && git commit -q --allow-empty -m init
  cland init . > "$QA_EV/E1538S2-14-init.txt" 2>&1; echo "init exit $?"
  [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; cland hub stop > /dev/null 2>&1; sleep 2
  sed -i '' -e "s|^lock_path = .*|lock_path = \"$QA_Q/p3-suite.lock\"|" -e 's|^executor = .*|executor = "local"|' .cland/config.toml
  node "$QA_Q/seal.mjs" doctor "" > "$QA_Q/doctor.json" 2> "$QA_Q/doctor.err"; echo "doctor with the real ps: exit $?"; probe rows "$QA_Q/doctor.json" ps
  node "$QA_Q/seal.mjs" doctor "$QA_Q/psfail" > "$QA_Q/doctor.json" 2> "$QA_Q/doctor.err"; echo "doctor with a ps that cannot report: exit $?"; probe rows "$QA_Q/doctor.json" ps
  echo "install docs procps lines: $(grep -c -F '`procps` (Linux)' "$QA_W/site/src/content/docs/docs/install.md")"
  C=.cland/config.toml; cp "$C" "$QA_Q/p3-config.orig"
  echo "PRE: hub $(up) (down expected); hosts tables in the initialised config: $(grep -c -F '[hosts' "$C")"
  bad() { cp "$QA_Q/p3-config.orig" "$C"; printf '\n[hosts.first]\ntransport = "ssh"\n[hosts.nopool]\n[hosts.second]\ntransport = %s\n' "$1" >> "$C"; }
  good() { cp "$QA_Q/p3-config.orig" "$C"; printf '\n[hosts.first]\ntransport = "ssh"\n[hosts.nopool]\n' >> "$C"; }
  good; run "hub start, ssh and no transport (control)" hubstart; echo "  hub $(up)"; run "hub stop (control)" cland hub stop; sleep 2
  for v in '"outbound"' '"tcp"'; do
    bad "$v"; mkdir -p .cland/log; : > .cland/log/hub.log; run "hub start, transport = $v" hubstart
    echo "  output / hub log: hosts.second.transport $(has 'hosts.second.transport') / $(hasl 'hosts.second.transport'); 0.4.x $(has '0.4.x') / $(hasl '0.4.x'); ssh-only rule $(has 'ssh is the only transport 0.4.0 accepts') / $(hasl 'ssh is the only transport 0.4.0 accepts'); hub $(up)"
  done
  good; run "hub start, ssh and no transport" hubstart; echo "  hub $(up)"
  cland hub status --json > "$QA_Q/status-before.json" 2>&1; probe cfgsha "$QA_Q/status-before.json"
  bad '"outbound"'; run "hub reload, transport = outbound" cland hub reload
  echo "  hosts.second.transport $(has 'hosts.second.transport'); 0.4.x $(has '0.4.x'); hub $(up)"
  cland hub status --json > "$QA_Q/status-after.json" 2>&1; probe cfgsha "$QA_Q/status-after.json"
  good; run "hub reload, valid again" cland hub reload
  run "hub stop" cland hub stop
}
m22() {   # sealed: the live project, its hub and lock are never reached
  echo "PRE: HOME is the scratch one: $([ "$HOME" = "$QA_Q/home" ] && echo yes || echo no); TMPDIR is the run's: $([ "$TMPDIR" = "$QA_T" ] && echo yes || echo no)"
  echo "CLAND_ names in the sealed environment: $(env | cut -d= -f1 | grep '^CLAND_' | sort | tr '\n' ' ')"
  echo "session, hub-file and delivery names: $(env | cut -d= -f1 | grep -c -E '^CLAND_(HUB_|SESSION_|ROLE|DELIVERY|LAUNCH|SUITE_LEASE|NODE|CLI|CHANNEL)')"
  echo "credential-prefix names: $(env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)')"
  probe roots
  printf '%s\n' "$QA_R/.cland/hub.lock" > "$QA_Q/live-control.txt"
  echo "files naming the live lock or hub (the control only): $(grep -l -F "$QA_R/.cland/hub" "$QA_Q/live-control.txt" "$QA_EV"/*.txt 2> /dev/null | sed "s|$QA_Q/||; s|$QA_EV/|<EV>/|" | tr '\n' ' ')"
}
m23() {   # sealed: stop the scratch hubs, the tunnel and the decoy; the fixture-owned census; the secret and publication scans with their controls
  for p in p1 p2 p3; do ( cd "$QA_Q/$p" && cland hub stop > /dev/null 2>&1 ); done; sleep 3
  kill "$(cat "$QA_Q/tunnel.pid")" 2> /dev/null; kill "$(cat "$QA_Q/decoy.pid")" 2> /dev/null; sleep 1
  echo "tunnel: $(tail -n 1 "$QA_Q/tunnel.out")"
  sort -u "$QA_Q/pids" | while read -r p; do [ -n "$p" ] && kill -0 "$p" 2> /dev/null && echo "alive $p $(ps -o comm= -p "$p")"; done
  echo "census of $(sort -u "$QA_Q/pids" | grep -c .) fixture pids done"
  echo "processes naming the scratch root or the run's TMPDIR, this probe excluded: $(probe census)"
  probe scan
}
m23b() {   # QA's own shell, after m23: the root, the build, dev
  echo "root entries outside .cland/tasks, harness-local settings left out: $(git -C "$R" status --porcelain | grep -v -F '.cland/tasks/' | grep -v -x '?? .claude/settings.local.json' | wc -l | tr -d ' ')"
  echo "HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) want $S"
  echo "CLAND_ names in QA's own shell (the control that the stripping in E1538S2-22 matters): $(env | cut -d= -f1 | grep -c '^CLAND_')"
}
```

Cleanup after the evidence and the verdict are recorded: print `$Q` and `$T`, check that they begin with `/private/tmp/q38s2-` and `/private/tmp/qa-e1538s2-`, and remove each by its literal path with a non-force `rm -r` (type the printed path; never a variable). Remove the worktree with `git -C "$R" worktree remove "$W"` (remove its `node_modules` symlink first if Git refuses). Everything in `$Q` is disposable: p1, p2 and p3, the scratch HOME, the tunnel's certificate and private key, `secrets.json`, the `link-*`, `cookie-*`, `users.out` and `pw` files, the planted records and the decoy's pid file.

## Cases

none. No headless-grid case covers this stage: nothing here is a Neovim grid surface. Every check below is a manual check recorded with `qa-record.sh note`.

### Web cases (when in scope)

none as `real-browser` rows. Under rule 18 the web surface this stage changed (the session cookie a browser receives) runs in Chrome Headless Shell, not in a real browser, in the `web-terminal` rows E1538S2-04 (no origin, screenshot `$EV/E1538S2-04.png`) and E1538S2-06 (the configured `https` origin through the scratch tunnel, screenshot `$EV/E1538S2-06.png`), and in the Web test files of E1538S2-09. No computer use and no GUI.

## Manual checks

The role column assigns each row: Human for rows that act in a sealed scratch project as its human, QA for the rest. Named-file rows wait for the cover-quiet admission (`quiet`, the live verify queue read) and the load gate (`ld`) before each file.

| id | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| S0 | hub-api | QA | the setup blocks above, in order, captured to `$EV/S0-env.txt` (QA's own shell) | `seal checked`, `tunnel checked`, `probe checked`, `controls checked`, `s1row checked`; credential-prefix count `0`; the `CLAND_` name list holds only synthesized scratch names (no `CLAND_SESSION_*`, `CLAND_ROLE` or launch credential name); `sealed nvim:` names the pinned cache binary and `NVIM v0.12.5`; `sealed TMPDIR is T: yes`; `T` bytes not above the suite root's; every socket length below 104; the stage-1 brief digest line; `build exit 0`; `web build stamp ok` |
| E1538S2-00 | hub-api | QA | `m00 > "$EV/E1538S2-00.txt" 2>&1` (QA's own shell) | PRE: HEAD, dev and the request's SHA are the same 40 hex; `dirty entries 0`; `root entries outside .cland/tasks, harness-local settings left out: 0`. `stage2` names `{"scope":"full","when":"after-stage"}` and the plan's members with `merged` equal to `total`; `stage1` reads `state` `closed`, `verdict` `clear`, `current` true. Each member's `landings:` line holds exactly one commit. A member with no landing makes the run BLOCKED, naming it |
| E1538S2-01 | hub-api | QA | `m01 > "$EV/E1538S2-01.txt" 2>&1` (QA's own shell, read-only) | T-1624: its hub/src numstat is `1 1 hub/src/hub/web-auth.ts` alone; `admission sources changed … 0`; `web-auth.test.ts numstat: 1 1` (C5); `cookie predicate … 1`; the `Set-Cookie` writer count equals the `through webSessionCookie` count (C4); ADR heading `1` and supersedes `1` (C6); web edge guide `1`. T-1625: `production, fake, test-support and shared files changed: 0` (C7: reads, never edits); endpoint list `1` (C1); entry registrations `1 1` and both call the shared contract (`1 1`); helper modules importing the runner's test function `0` (T-1658 attribution); the four contract assertion counts each `1` (C2, C6); the planted positive control `1` (C5); tiers `1 1 1`; the guide `present`, outbound `1`, unchanged `1` (C8); the item body's path `absent`; index rows `1 1 1` |
| E1538S2-02 | hub-api | QA | `m02 > "$EV/E1538S2-02.txt" 2>&1` (QA's own shell, read-only) | PRE `yes`. At writing exactly these were listed, and nothing else: `hub/src/hub/lock.ts` 33d24363e307fd4e42cc136bbb06b4cedf7dd3f6 (T-1654), `hub/src/hub/daemon.ts` 1fcc37db5702bacc22d63be1bcbc26362a48099d (T-1597), `hub/src/cli/hub.ts` e21b64bffa6ccec52b4457285cca27d9052fadf3 (T-1595), `hub/src/doctor` 53ecaf87343b3719a51f09f818871bcfb70272cf (T-1593); every other path prints nothing. A later commit on the lock, daemon, CLI or doctor paths is read with `git show --stat` and named in the verdict (E1538S2-13 and E1538S2-14 cover them live). A commit on `hub/src/executor/droplet`, `hub/src/state-paths.ts`, `hub/test/fakes/digitalocean`, the transport kind or config files, `lock-identity.ts`, `process-identity.ts` or the install docs voids the reason the stage-1 live provider and state-path rows are left out: record this row INCONCLUSIVE and report it to the requester for a brief revision |
| E1538S2-03 | hub-api | Human | `{ quiet && ( . "$Q/env.sh"; cd "$Q/p1" && m03 ); } > "$EV/E1538S2-03.txt" 2>&1` | PRE: p1 has no entries, `fakes 3`, `bundle 1`, credential-prefix names `0`. `init exit 0`; `lock 1 executor 1 empty origin in [web] 1`; `hub start exit 0`; `edge` with a port and `available` true. Every `minted` line has `loopbackEdge` true, path `/auth`, `secretLength` 64. `local`, `localhost` and `forwarded`: status 302, location `/`, one cookie with `nameShape` true and `attrs` exactly `Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000` (no `Secure`: T-1624 C2 with no origin, C3). `tunnelhost` (precondition for E1538S2-05: without an origin that Host is not admitted): status 403, no cookie, body `Host must name an allowed web address` |
| E1538S2-04 | web-terminal | Human | `{ quiet && ( . "$Q/env.sh"; cd "$Q/p1" && m04 ); } > "$EV/E1538S2-04.txt" 2>&1` | PRE: hub `up`, empty origin `1`. `web --no-open exit 0`; `link`: origin `http://127.0.0.1:<edge port>`, path `/auth`, `secretLength` 64, `secretHex` true. `browser`: `headlessShell` true, `profileInScratch` true. `navigation`: status 302, method `GET`, scheme `http:`, `originHeaderSent` false, the cookie's `attrs` without `Secure`. `jar`: one cookie, `nameShape` true, domain `127.0.0.1`, path `/`, `secure` false, `httpOnly` true, `sameSite` `Strict` (C2 in a browser). `page`: path `/`; `live` true (the positive control for E1538S2-06's Live line); no `step` line; `browserGroupAfter` 0. Screenshot `$EV/E1538S2-04.png` |
| E1538S2-05 | hub-api | Human | `{ quiet && ( . "$Q/env.sh"; cd "$Q/p1" && m05 ); } > "$EV/E1538S2-05.txt" 2>&1` | PRE: hub `up`, an openssl path. `hub after stop: down`; `certificate exit 0` and the subject names `qa1538.example.invalid`; `tunnel port read: yes`; `origin line 1`; `hub start exit 0`; `edge` available. `tunnel` (precondition: the tunnel reaches the edge with the origin's Host): status 401, body `Invalid or expired sign-in link`. `tunnel` (Host only, no Origin), `exact`, `foreignorigin` and `upper`: status 302, location `/`, one cookie with `attrs` exactly `Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000; Secure` (T-1624 C1; `foreignorigin` per Coordinator decision ba646380: `/auth` admission never read Origin, and the cookie now follows Host alone). `local`, `localhost` and `forwarded`: 302 and the same attributes without `Secure` (C2, C3). `otherhost` and `noport`: 403, no cookie, body `Host must name an allowed web address` |
| E1538S2-06 | web-terminal | Human | `{ quiet && ( . "$Q/env.sh"; cd "$Q/p1" && m06 ); } > "$EV/E1538S2-06.txt" 2>&1` | PRE: hub `up`, tunnel alive `yes`. `web --qr exit 0` with QR lines above 0; `link`: origin `https://qa1538.example.invalid:<tunnel port>`, path `/auth`, `secretLength` 64. `browser` as in E1538S2-04. `navigation`: status 302, method `GET`, scheme `https:`, `originHeaderSent` false (a plain navigation), `fetchMode` `navigate`, the cookie's `attrs` ending `; Secure`. `jar`: one cookie, domain `qa1538.example.invalid`, path `/`, `secure` true, `httpOnly` true, `sameSite` `Strict` (T-1624 C1 in a browser; the epic's Definition-of-done sentence for the cookie). `page`: origin `https://qa1538.example.invalid:<tunnel port>`, path `/`; `live` true (the workbench's WebSocket admitted through the tunnel with the cookie); no `step` line; `browserGroupAfter` 0. Screenshot `$EV/E1538S2-06.png`. A `step` line naming a resolver or certificate error, with E1538S2-05 passing, is a probe fault: record BLOCKED with the line, not FAIL |
| E1538S2-07 | hub-api | Human | `{ quiet && ( . "$Q/env.sh"; cd "$Q/p1" && m07 ); } > "$EV/E1538S2-07.txt" 2>&1` | PRE: hub `up`, cookie kept `yes`. `admitted`: 101 (the positive control: this cookie with the exact Host and Origin pair is accepted). `nocookie`: 401. `hostonly`, `foreignorigin`, `nullorigin` and `forwardedhost`: 403 (T-1624 C5: WebSocket admission unchanged; forwarded headers never admit). `upload-hostonly` and `upload-foreign`: status 403, no cookie, body `{"error":"Foreign Origin"}`; a 403 rather than 401 shows the cookie itself was accepted (C5 for `/upload`) |
| E1538S2-08 | hub-api | Human | `{ quiet && ( . "$Q/env.sh"; cd "$Q/p1" && m08 ); } > "$EV/E1538S2-08.txt" 2>&1` | PRE: hub `up`, `mode = "single"`. `auth mode users exit 0`; `users`: `line` is the first user and `admin` (at writing `jane-q-doe  admin`, from `user.name` `Jane Q. Doe`), `inviteOrigin` `https://qa1538.example.invalid:<tunnel port>`, `invitePath` `/invite`, `secretLength` 64. `register` and `signin-tunnel`: status 200 and one cookie whose `attrs` end `; Secure` (C4: invite and password cookies through the one helper); `signin-local`: 200 and no `Secure` (C2). These successes are the precondition for the refusals: each `hostonly-…` and `foreign-…` row (`invite-register`, `signin-password`, `upload`) is status 403 with no cookie (C5) |
| E1538S2-09 | hub-api | QA | `nt E1538S2-09 hub/test/web-cookie-secure.test.ts hub/test/web-auth-unit.test.ts hub/test/web-auth.test.ts hub/test/web-signin.test.ts hub/test/web-authority.test.ts hub/test/web-upload.test.ts hub/test/web-edge.test.ts hub/test/web-network-unit.test.ts hub/test/web-tunnel-guide.test.ts web/test/signin.test.ts web/test/passkeys.test.ts web/test/connection.test.ts` | clean: an `exit 0` line for each file, no `not ok`, no skip. `oks` lists Tests: `/auth navigation with configured tunnel Host sets Secure without Origin`, `invite and password sign-in cookies share tunnel and local Secure policy`, `the cookie policy uses only configured origin and Host, including port`, `tunnel Host and exact Origin admit a web client and set Secure without trusting forwarded headers`, `an invite registers a password and issues a user-bound cookie exactly once`, `invite admission refuses foreign origins, wrong methods, short passwords and unknown tokens without cookies`, `password sign-in hides credential failures and sign-out revokes only its browser`, `upload authenticates cookie, Origin and Host and caps declared and streamed bodies without publishing`, `the web edge accepts only a loopback Host with its exact port`, `the HTTPS tunnel guide config admits its Host and Origin and prints its QR sign-in link`, `the phone link prefers the tunnel, otherwise the concrete LAN interface`, `invite view shows the user and signs in with a password POST without sending a password frame`, `passkey invite registration and fresh-context sign-in consume the invite and persist only public credential facts`, `the printed web link connects the shell and reconnects with backoff after a hub restart`, plus the forwarded-claims cases that `web-cookie-secure.test.ts` generates for a configured origin false and true (read both names from the log) (T-1624 C1 to C5, with the LAN Host of C2 in the unit matrix) |
| E1538S2-10 | hub-api | QA | `nt E1538S2-10 hub/test/transport-ssh-contract.test.ts hub/test/transport-fake-contract.test.ts hub/test/transport-ssh.test.ts hub/test/fake-ssh.test.ts hub/test/transport-kind.test.ts hub/test/fixture-socket-path.test.ts` | clean. `oks` lists Tests: `ssh carrier with fake sshd: C1–C7 four Unix endpoints relay and recover without TCP`, `fake transport pairing: C1–C7 four Unix endpoints relay and recover without TCP`, `C1/C2/C4/C5/C6 fake master restores four forwards and probe after SIGKILL`, `rejects missing/wrong pins, occupied forwards and TCP listen; loopback destination uses Unix map`, `transport parser accepts ssh and reserves outbound for 0.4.x`, `fixture socket binds within the macOS byte budget under a deep multibyte TMPDIR` (T-1625 C1 to C7 on macOS with the `lsof` descriptor scan; the carrier, the stand-in and the parser unchanged and passing). The run's TMPDIR is the suite-length `$T` |
| E1538S2-11 | hub-api | QA | `: > "$EV/E1538S2-11.log"; rp E1538S2-11 hub/test/transport-ssh-contract.test.ts 5 --test-name-pattern='ssh carrier with fake sshd' && rp E1538S2-11 hub/test/transport-fake-contract.test.ts 5 --test-name-pattern='fake transport pairing' && hm` (QA's own shell) | A `replay` line for each repetition of each entry: `exit 0`, `matched` equal to `passed` and nonzero (the identity is runnable from its own entry file, as the load gate replays it: T-1658), `failed 0`. `helper modules run: exit 0; top-level entries: hub/test/transport-contract-fixture.ts hub/test/transport-contract.ts; nested entries 0; contract case names 0`: the Node test runner reports one top-level wrapper per file it is given, named by that file, so the entries must be exactly the two helper files' own wrappers, with no nested subtest and no contract case name (`ssh carrier with fake sshd`, `fake transport pairing`) under them; the shared modules carry assertions only (T-1625 C7 evidence attribution; run correction 5b44c783 of A-16255, where `# tests` read 2 for the two wrappers). Any other entry, a nested entry or a contract case name is a FAIL |
| E1538S2-12 | hub-api | QA | `quiet && ld && ( . "$Q/env.sh"; cd "$W" && node --test --test-concurrency=1 --test-reporter=tap "$Q/contract-controls.mjs" > "$EV/E1538S2-12.log" 2>&1; echo "controls exit $?" >> "$EV/E1538S2-12.log" ); ctl > "$EV/E1538S2-12.txt"` (QA's own shell) | The baseline line is `ok` (precondition: the unmodified fixture passes under this module). Each other control line is `not ok`, and its message is present: `no-drop message` at least 1 (C4: without an actual drop the reconnect wait fails), `tcp message` at least 1 (C5: a TCP listener is detected), `kind message` at least 1 (C6: a carrier reporting `outbound` fails the kind check); `controls exit 1`. A control that passes means the contract does not check what its criterion says: FAIL naming the criterion |
| E1538S2-13 | hub-api | Human | `{ quiet && ( . "$Q/env.sh"; cd "$Q/p2" && m13 ); } > "$EV/E1538S2-13.txt" 2>&1` (command timeout of at least 600000 ms) | PRE: p2 empty. `init exit 0`; decoy alive `yes`; `hub start exit 0`. The first `lock`: `keys` exactly `["heartbeat","hostIdentity","pid","started","token"]` (the serving hub's record: `daemon.ts:96` calls the synchronous `acquireLock`, whose record at `hub/src/hub/lock.ts:352–356` holds `pid`, `started`, `token`, `hostIdentity` and `heartbeat`; `startedUtc` is optional in the type at `lock.ts:34` and written only by the timezone-aware `acquireLockAsync` at `lock.ts:419–426`, not by this hub; run correction 19930a8d of A-16255), `pidIsHub` true, `hostIdentityIsNative` true, `heartbeatAgeMs` below 15000, `nonceLength` above 0, `plantedHolder` false; the second, 25 s later: a different `heartbeat` value, age below 15000 (T-1615 C1, T-1616 C1). `hub stop exit 0`, `lock after stop: absent`, hub `down` (T-1616 C5). Fresh holder: `hub start exit 1` with `cland: hub on another host qa-foreign.invalid (pid <decoy pid>, heartbeat age <n>s)` and no `heartbeat lapsed`; `hub status exit 0` with the same line; `hub status --json exit 0` with `running` true, `foreign` true, `hostname` `qa-foreign.invalid`, `pid` the decoy's, `heartbeatAgeMs` a number, `startable` false; `hub stop exit 1` with the line ending `; stop it on that host; no local process signalled` (T-1615 C2, T-1617 C1 to C3); `processes naming p2: 0`, `lock and hub.json unchanged: yes`, decoy alive `yes` (C4: nothing signalled it). Lapsed holder: `hub start exit 0`; `lock` with `hostIdentityIsNative` true, `pidIsHub` true, `plantedHolder` false; `guard directory: absent`; decoy alive `yes` (T-1615 C3); `hub stop exit 0` |
| E1538S2-14 | hub-api | Human | `{ quiet && ( . "$Q/env.sh"; cd "$Q/p3" && m14 ); } > "$EV/E1538S2-14.txt" 2>&1` (command timeout of at least 600000 ms) | PRE: p3 empty; `init exit 0`. Doctor with the real `ps` (the control): the `ps` row is `ok` and its detail begins `process start time:`. With the failing `ps`: the `ps` row is `fail`, detail `cannot read this process start time with ps -o lstart=`, fix `install procps on Linux (or repair ps on macOS); the hub lock needs process start times` (T-1622 C1; the doctor's runner moved to `hub/src/host/agent/command.ts` since stage 1); `install docs procps lines: 1` (C2). PRE: hub `down`, hosts tables `0`. The control start with `ssh` and no `transport` exits 0 and the hub is `up`, then stops (C4). With `"outbound"`: `hub start` exits 1, output or log names `hosts.second.transport` and `0.4.x`, hub `down` (T-1623 C2). With `"tcp"`: exits 1, names `hosts.second.transport` and the ssh-only rule, hub `down` (C3). The valid start exits 0, hub `up`; `hub reload` with `outbound` exits 1 naming `hosts.second.transport` and `0.4.x`, the hub stays `up`, and the `config` digest after equals the one before (the old configuration is kept); `hub reload, valid again` exits 0 printing `config reloaded`; `hub stop` exits 0 |
| E1538S2-15 | hub-api | QA | `s1 17 E1538S2-15` (QA's own shell) | Stage-1 row E1538S1-17 by reference: clean (an `exit 0` line for each file, no `not ok`, no skip) and `stage-1 row E1538S1-17: titles listed <n>, missing 0` with no `MISSING:` line (T-1615 C1 to C7, T-1616 C1 to C5, including the write failure of T-1616 C4 and the lost-lock stop) |
| E1538S2-16 | hub-api | QA | `s1 18 E1538S2-16` (QA's own shell) | As E1538S2-15 for row E1538S1-18 (no titles listed: `missing 0`): the preserved consumers of the hub lock and the other locks, with T-1654's change to `lock.ts` (T-1615 C5, C8, C9; T-1616 C6; T-1617 C5) |
| E1538S2-17 | hub-api | QA | `s1 19 E1538S2-17` (QA's own shell) | As E1538S2-15 for row E1538S1-19. PRE: S0 printed `web build stamp ok` (without it `doctor-cli.test.ts` fails on the stamp: BLOCKED, not FAIL); `doctor-cli.test.ts` also needs the pinned Neovim of S0 (T-1617 C1 to C6, including the orphan sweep of C4) |
| E1538S2-18 | hub-api | QA | `s1 20 E1538S2-18` (QA's own shell) | As E1538S2-15 for row E1538S1-20 (T-1618 C1 to C6, T-1619 C1 to C4 with the open lease, T-1620 C1 to C3) |
| E1538S2-19 | hub-api | QA | `s1 21 E1538S2-19` (QA's own shell) | As E1538S2-15 for row E1538S1-21 (no titles listed: `missing 0`; T-1618 C7, T-1620 C4) |
| E1538S2-20 | hub-api | QA | `s1 22 E1538S2-20` (QA's own shell) | As E1538S2-15 for row E1538S1-22, and that row's generated `state-inventory.test.ts` pair both `ok` (T-1621 C1 to C5) |
| E1538S2-21 | hub-api | QA | `s1 23 E1538S2-21` (QA's own shell) | As E1538S2-15 for row E1538S1-23 (T-1622 C1, T-1623 C1 to C4, and the frozen command usage, which T-1595 extended) |
| E1538S2-22 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q" && m22 ) > "$EV/E1538S2-22.txt" 2>&1` | PRE: `yes` and `yes`. The `CLAND_` names are only synthesized scratch ones; session, hub-file and delivery names `0`; credential-prefix names `0`. `root p1`, `root p2` and `root p3` resolve the discovery file to `<Q>/pN/.cland/hub.json` and the root to `<Q>/pN`. The files naming the live lock or hub are exactly `live-control.txt` (the positive control: without it the row is INCONCLUSIVE) and no `<EV>` capture |
| E1538S2-23 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q" && m23 ) > "$EV/E1538S2-23.txt" 2>&1` then `m23b > "$EV/E1538S2-23b.txt" 2>&1` (QA's own shell) | Cleanup judged by the fixture-owned census only (never a machine-wide `pgrep`): the tunnel line reports its `connections`; no `alive` line names a fixture executable (`node` of a hub, the tunnel or the probe, a Headless Shell, the decoy's `sleep`); an `alive` line for an unrelated executable is pid reuse, recorded, not a failure; `processes naming the scratch root or the run's TMPDIR, this probe excluded: 0`. Secret scan: every `hit` names `control` and no other file, and each kind in `kinds` (`cookie`, `hub-secret`, `invite`, `link`, `password`) has a control hit (a kind without one makes the row INCONCLUSIVE). Publication scan: `publishRefused` `control` is present (the positive control); any other `publishRefused` names a file that is withheld from the published evidence and redacted, a QA publication fault, not a product failure; `controlsRemoved` true. In `m23b`: root entries `0`, HEAD equals dev equals the request's SHA |

After the rows, recheck `git -C "$W" rev-parse HEAD` and `git -C "$R" rev-parse refs/heads/dev` against the request (`m23b`): a moved dev keeps the evidence and makes the run BLOCKED.

Before requesting QA, run `cland qa lint` on this brief at the build under test (`node hub/bin/cland.ts qa lint qa/briefs/E-1538-stage-2.md --commit <dev SHA>` from the root). The brief is complete only when qa lint passes at the build.

**Source provenance (rule 22).** Read at dev `30dfeeede28800b45195ee93b3d123a4d90fc410`. Re-check every string at the tested build.

- Verified in source:
  - The cookie (`hub/src/hub/web-auth.ts`): `webSessionCookie` returns `<name>=<token>; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000` and appends `; Secure` when `origin` is set and the lower-cased Host equals `new URL(origin).host` (port included), with no Origin or forwarded condition; the name is `cland_` and 12 hex; every `Set-Cookie` in `hub/src` goes through it (`web-edge.ts` `/auth`, `web-signin.ts` invite registration, password and passkey sign-in). The expected attribute strings are the ones `hub/test/web-auth-unit.test.ts` and `hub/test/web-cookie-secure.test.ts` assert.
  - The edge (`hub/src/hub/web-edge.ts`): Host admission accepts `127.0.0.1:<port>`, `localhost:<port>`, `[::1]:<port>` and the origin's host with port, else 403 `Host must name an allowed web address`; `/auth` answers 302 with Location `/`, or 401 `Invalid or expired sign-in link`; `/upload` answers 401 `Sign in required` without a session, then 403 `{"error":"Foreign Origin"}` unless Origin equals the page origin; a WebSocket upgrade is refused 403 unless Host is admitted and Origin equals the page origin, then 401 without a session. `cland web --no-open` prints the loopback link; `cland web --qr` prints the origin link first (`phoneOrigin` returns the configured origin), then the QR. `cland init` writes `origin = ""` in `[web]`.
  - Sign-in (`hub/test/web-cookie-secure.test.ts`, `hub/src/cli/auth.ts`): `cland auth mode users` prints `<name>  <role>` then the invite URL, whose base is the origin; `/invite/register` with the origin's Host and Origin and a password answers 200 with a `Secure` cookie; `/signin/password` answers 200 with `Secure` through the tunnel headers and without it for the loopback Origin; `/invite/register`, `/signin/password` and `/upload` with Host only or a foreign Origin answer 403 with no cookie. The `/auth` loop in `hub/test/web-auth.test.ts` expects `Secure` exactly when Host equals the tunnel's (Coordinator decision ba646380), so a foreign Origin with the origin's Host gets `Secure`.
  - The ADR and guide strings quoted in `m01`.
  - The contract (`hub/test/transport-contract.ts`, `transport-contract-fixture.ts`, both entry files): `TRANSPORT_ENDPOINTS`; the assertions quoted in `m01`; the reconnect wait `eventually('replacement carrier and all four endpoints answer', …, 8000)`, whose failure reads `<what>: not within 8000 ms` (`hub/test/harness.ts`); the no-TCP assertion message `hub stubs and host/carrier processes bind no TCP listeners`; `parseTransportKind` throws `outbound transport requires 0.4.x` (`hub/src/host/transport-kind.ts`); both entry titles; the fixture's own roots under `/tmp/tc-` and its socket-length assertions.
  - The lock and its readers (`hub/src/hub/lock.ts`, `hub/src/cli/hub.ts`): the serving hub's record fields, from their producer: `hub/src/hub/daemon.ts:96` calls the synchronous `acquireLock`, which builds `{ pid, started, token, hostIdentity, heartbeat }` at `lock.ts:352–356` (`startedUtc` comes only from `acquireLockAsync`, `lock.ts:419–426`; verified against the A-16255 capture); `hub on another host <hostname> (pid N, heartbeat age Ns)`, with `; heartbeat lapsed, startable` when lapsed; `hub start` exits 1 for a fresh foreign holder; `hub status` exits 0 for a fresh one; the `--json` fields `running`, `root`, `foreign`, `hostname`, `pid`, `heartbeatAgeMs`, `startable`; the stop suffix `; stop it on that host; no local process signalled`; `HUB_LOCK_HEARTBEAT_MS` 10 000 and `HUB_LOCK_LAPSE_MS` 60 000.
  - Doctor (`hub/src/doctor/toolchain.ts`): the `ps` row's fail detail and fix quoted in E1538S2-14. Transport: `hosts.<pool>.transport: ` prefix (`hub/src/host/transport-config.ts`), `ssh is the only transport 0.4.0 accepts`, and reload's `config reloaded:` (`hub/src/cli/hub.ts`).
  - `hub status --json` carries `web` with `port` and `available` (`WebEdgeStatus`, `hub/src/protocol.ts`). The selector `[aria-label="Hub connection"]` and the text `Live` (`web/src/Shell.tsx`).
  - Every literal test title in this brief is a literal title in its file at dev; the stage-1 titles were checked with `s1row.mjs`'s rule at dev (none missing).
  - The publication scanner is `assertPublishable` in `.agents/skills/qa/qa-demo-policy.ts` (the file `.claude/skills/qa/` links to).
- Inferred, not verified by a run:
  - **The browser path**: that the pinned Headless Shell honours `--host-resolver-rules` and `--ignore-certificate-errors`, that `ignoreHTTPSErrors` also covers the workbench's `wss:` connection, that Playwright reports the `/auth` redirect's `Set-Cookie` through `headersArray()` (or through `redirectedFrom()`), that a top-level navigation sends no Origin and `sec-fetch-mode: navigate`, and the jar's `domain` spelling. The cookie predicate does not read Origin, so an Origin header seen on the navigation is recorded as an observation and does not change the `Secure` expectation.
  - The `openssl` subject format; the first user's name `jane-q-doe` and the 64-hex invite secret (the probe reads both from the CLI's output); `cland init` leaving or not leaving a hub running (the functions handle both); the `config` object in `hub status --json` (present in the stage-1 run).
  - The TAP summary lines `rp` reads (the Node test runner with the TAP reporter). That running the two helper modules alone exits 0 with one top-level wrapper per file and nothing nested is verified by the A-16255 run (`E1538S2-11-helper-original.tap`), not by source.
  - **Timing**: the heartbeat beats every 10 s, so two samples 25 s apart differ on an unloaded machine; load changes it, hence the `ld` gate.

## Probes that mislead

- The live hub and workbench run the code of their last restart, not the tested SHA. Live cookies, live lock behaviour and live doctor output are not evidence for this stage; the scratch projects, the build's files and its tests are.
- Every `cland` here is `$W/hub/bin/cland.ts` (the `cland` function of `env.sh`). A `cland` on PATH, or the root's CLI, may be older.
- **No overlay after the seal** (E-1532 stage 2 and E-1536 stage 4 run corrections, 0dfcf8a62). The hub start, the doctor with a failing `ps` and the browser get their extra inputs only through `seal.mjs`; never `env NAME=…`, `NAME=… cmd`, `export TMPDIR=…` or an assignment to `process.env` in a probe. A launch made any other way is a probe fault: rerun the row as written.
- **Neovim comes only from the build's pinned release** (`node nvim/bin/nvim-path.ts`, first on the sealed `PATH`): the inherited `PATH` may have none or Homebrew's, and `doctor-cli.test.ts` (E1538S2-17) checks the pinned version.
- **Socket paths.** macOS allows 104 bytes for a Unix socket path, NUL included. `$T` is as long as the suite's root, not longer; the scratch projects sit in a 25-byte `$Q`. An `EINVAL` on connect with a long path is the socket limit (T-1653), not a network error.
- **The tunnel is a stand-in.** It is the human's HTTPS tunnel reduced to TLS plus a byte pipe on loopback, with a certificate the run made and the browser told to accept. It proves what the edge does with the headers a tunnel delivers; it says nothing about a real tunnel's TLS. `qa1538.example.invalid` resolves only inside the probe's browser.
- **HTTP is not a browser.** Chrome stores a `Secure` cookie only from a secure origin; the HTTP rows read the `Set-Cookie` line the edge writes, and E1538S2-06 shows the browser storing it over HTTPS. A `secure` false jar entry over plain HTTP (E1538S2-04) is the browser's rule and the expected control.
- **A foreign Origin on `/auth` gets `Secure`** under a matching Host (decision ba646380): `/auth` admission never read Origin, and the cookie attribute grants no admission. The WebSocket and upload refusals of E1538S2-07 are where Origin matters.
- **Credentials are secrets.** Never print a link, invite, cookie value, password, hub secret or the tunnel key; never put one in a screenshot, capture or topic. The probe prints lengths, attributes and shapes; screenshots are taken after the redirect, when the address is `/`. The planted `hub.json` secret `qa-planted-not-a-secret` and the lock nonce `qa-foreign-nonce` are fixture values.
- **Scanner-safe text** (0dfcf8a62, ac0e41124). The brief's own prose and patterns never spell a query key followed by its value; the probe reads the link's secret with `searchParams` and builds the publication control at run time. Never copy this brief, `env.sh`, `probe.mjs` or the stage-1 brief under `$EV`.
- **Census probes see themselves.** `probe census` lists processes naming `$Q` or `$T` and excludes its own pid exactly; the unfiltered listing stays in `$Q` (it can hold other sessions' command lines). The `alive` lines print the executable name only, so a reused pid never leaks another process's arguments.
- **The root census** leaves out `.claude/settings.local.json`: a pre-existing harness-local file, not run output (0dfcf8a62).
- A foreign pid that is alive here is the point of the decoy: if a reader signalled it, it would be gone. That does not prove `kill(pid, 0)` was never called; `hub-lock-readers.test.ts` and `hub-lock-identity.test.ts` mock `process.kill` for that (E1538S2-15, E1538S2-17).
- `hub status` exits 0 for a fresh foreign holder, so `up` reads `up` while E1538S2-13's fresh holder is planted; the row judges the lines, not `up`.
- The contract controls replace one fixture method each; the fixture's own setup, its pre-start TCP control and its cleanup are untouched. The `tcp` control plants its listener after the fixture's pre-start scan, so only the contract's own scans can see it.
- Exact tracker copies replace the initialized tracker directory after its writers stop; apply the full `fixtureEnvironment` result after overlays and add `scratchGitEnvironment` for Git; a hand-written shell `unset` filter keeps inherited `GIT_*` variables (E-1212 stage 1). `scratchGitEnvironment` requires its third argument; never hand-patch `env.sh`.
- Edit existing keys in initialized configs (`lock_path`, `executor`, `origin`); the `[hosts]` tables of E1538S2-14 are new tables `cland init` does not write (the row prints the count first), appended to a copy of the initialised file that is restored each time (A-8634 R12).
- Transcript assertions identify stable ids, with intervals starting at the result of the state-changing request. Preserve unaltered captures when correcting a probe and label the correction separately from product failures (A-8634 R13; A-9063 R2).
- Process cleanup probes use the fixture-owned census (`$Q/pids`: each hub pid, the tunnel, the decoy, each probe and each browser group; plus processes whose command line names `$Q` or `$T`), registered at launch and checked through exit (A-9063 R2; E-413 stage 1/T-1093).
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file.
- A "ran" marker grep excludes the configuration echo line.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log.
- Speed criteria use measured wall times, never projections.
- Slots due or queued before the build count even when their results arrive later.
- "No skip" names platform-only cases and where they are covered: the contract's Linux `/proc` scanner branch does not run here (the macOS `lsof` branch does); the Linux branch is covered by the stage cover's Linux run and T-1625's Linux evidence (A-16194). `kern.bootsessionuuid` is read on this macOS; the Linux boot-id reader is covered by E1538S2-15's unit tests.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

- From stage 1, by design of this regression pass (each covered as named): the heartbeat sampler and the 160-s foreign contender (E1538S1-02, E1538S1-03) and the lost-lock stop (E1538S1-05), which are real-time fixtures of code unchanged since the stage-1 verdict (E1538S2-02) and are proven by `hub-lock-heartbeat.test.ts` in E1538S2-15, with a two-sample heartbeat check live in E1538S2-13; the `ps` shim of E1538S1-06 (a logging `ps` first on `PATH` for every reader), the per-part identity and legacy-shape records of E1538S1-07 and the migrate checks of E1538S1-08 and E1538S1-09, proven by `hub-lock-identity.test.ts`, `hub-lock-readers.test.ts` and `task-migrate.test.ts` in E1538S2-15 and E1538S2-17, with the readers' only source change since the verdict being the hosts lines `hub status` prints; the fake DigitalOcean client, reap and per-user state rows (E1538S1-10 to E1538S1-12), whose sources and fake have no commit since the verdict (E1538S2-02) and which E1538S2-18 to E1538S2-20 prove through the named files (the epic's Definition-of-done run shows them live); the source counts of E1538S1-01, replaced by E1538S2-02 and the reruns.
- Real droplets, the real DigitalOcean API and token; remote hosts, a real `ssh` or `sshd`, and a second carrier implementation (`outbound` is 0.4.x).
- A real HTTPS tunnel and its certificate; LAN binds (`[web] bind` on a network address) live: the LAN Host of T-1624 C2 is the unit matrix's (E1538S2-09); passkey cookies under a configured origin live (the helper is single, E1538S2-01, and `passkeys.test.ts` passes in E1538S2-09).
- The machine-wide orphan sweep (off in the scratch hubs; `hub-lock-readers.test.ts` covers it), lock behaviour on a second machine.
- The T4 soak and load repetitions; the full T3 and T4 suites and the stage cover pair (the Coordinator's occasion); a live restart; any change to live sessions, holds or the tracker.
- A real browser, computer use and the human's profile.

Missing authorization does not apply: nothing here needs a grant, so no check is BLOCKED for lack of one.

## Grants

none. Headless Shell runs under rule 18 without a grant; the scratch hubs, the tunnel and the probes open only loopback and `$Q` or `$T` paths, under the rule 15 sealed environment with credentials filtered and only the fake harnesses.

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`--stage "secure cookie and the transport contract"`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Report `qa clear E-1538 stage secure cookie and the transport contract` or `qa not clear E-1538 stage secure cookie and the transport contract` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
