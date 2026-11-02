# Stage QA brief: E-1531 stage 2 — adapters, worktrees, artifacts and the host column

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$B:h` or `$S:q` as a modifier). The run is local, on macOS (BSD `sed -i ''`, Node 24 with `node:sqlite`). No browser, no GUI and no real harness: the scratch hub runs the fake `claude`, `codex` and `opencode` of `hub/test/fakes/`.

## Stage

- Epic: E-1531 (The Host interface and the local host, under R-1530).
- Exact stage name: adapters, worktrees, artifacts and the host column.
- Items, in plan order by lane: lane 1 T-1545 (OpenCode sessions through the Host); lane 2 T-1546 (Codex spawn, liveness and stop through the Host), then T-1548 (Codex sandbox roots from the Host's realpath); lane 3 T-1547 (Claude Code sessions through the Host); lane 4 T-1549 (Task worktree add and remove through the Host), then T-1550 (Who stands inside a worktree, through the Host); lane 5 T-1551 (Artifact path reads through the session's Host); lane 6 T-1552 (The `host` column, the host registry and a test host), then T-1553 (The Coordinator and the Aide stay on the local host). The run reads the stage's members, counts and state from `task plan show E-1531` (E1531S2-00), never from a number written here. Findings fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: the combined changed behaviour of the stage at the tested build. This stage is a refactor: session spawn, liveness and stop of all three harnesses, task worktree add, remove and occupancy, and artifact path reads now go through the session's Host, and on the `local` host nothing a human sees changes. It adds two visible things: the `host` column of `harness_processes` (in `hub.db` only; `session list` and the session frames show no new field for a `local` row) and the placement refusal for the Coordinator and the Aide.
  - T-1545: `opencode serve` started by the Host's spawn with today's arguments, environment, cwd and log; poll, resume and stop through the Host's alive and stop; the adapter's own `process.kill` probe gone.
  - T-1546: the Codex app-server spawn, the `codex --version` check (Host run) and the cwd refusal (Host statDirectory); poll, resume and stop through the Host; no `process.kill` in `codex.ts`.
  - T-1548: `threadPolicy` and the linked-worktree git-dir lookup compute every sandbox path through the Host's realpath, statDirectory and readFile; on `local` the policy and `-c` overrides are byte-identical to before; `codex.ts` imports neither `realpath` nor `stat`.
  - T-1547: `claude --bg`, `claude agents --json` and `claude stop` through the Host's run; the worktree's `.claude` settings through its readFile; identities, liveness and stop through the Host; no `process.kill` in `claude-code.ts`.
  - T-1549: `ensureTaskWorktree` and `removeTaskWorktree` call the Host's worktreeAdd and worktreeRemove under the territory lock; the root `node_modules` link and the stale-install warning come from worktreeAdd.
  - T-1550: `cland worktree list` and prune decide who stands inside through the Host's occupants and statDirectory; `hub/src/hub/worktrees.ts` no longer imports from `node:fs`.
  - T-1551: `artifact.create` with a path reads type, bytes and folder listings through the caller's Host (`local` for the human and the hub); `artifact.upload` checks stored files through `local`.
  - T-1552: `harness_processes.host`, added in place with `local`; the host registry; `CLAND_TEST_HOSTS=t1` registers a test host that logs each operation to `hub.log` as `test-host-operation`, mints `linux:` identities and refuses native work; the orphan sweep and doctor ignore rows on another host.
  - T-1553: `session.launch` frames take an optional `host`, `local` by default; an unknown host is refused by name before anything is reserved; the Coordinator and the Aide are refused any host other than `local` at launch, relaunch, fresh resume, role set and handover with `Coordinator and Aide roles run only on the local host`. No CLI flag is added; the `session launch` help gains `Coordinator and Aide sessions run only on the local host;`.
- Decisions and references: `docs/spec/v0.4.md` §3.1; E-1531's Contents and Constraints ("Nothing changes for the human"); the T-1545 C4 exception (decided by the Coordinator 2026-11-01: only `opencode-launch-policy.test.ts`'s cp.spawn fake may change); `hub/README.md` "Local Host files, worktrees and polling"; `docs/agents/session-permissions.md` "Local-only role placement".

Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

Criteria map (the stage verdict carries no item or epic marks; this tells the run which check proves what):

| criterion | proven by |
| --- | --- |
| T-1545 C1, C3 | E1531S2-03; on a real hub E1531S2-13 (launch), E1531S2-14 (stop) |
| T-1545 C2 | E1531S2-01 (no `process.kill`), E1531S2-03 |
| T-1545 C4 | E1531S2-01 (preserved files unedited), E1531S2-03 |
| T-1546 C1 to C4 | E1531S2-04, E1531S2-02 (post-spawn close boundary); E1531S2-01 (no `process.kill`); E1531S2-13, E1531S2-14 |
| T-1546 C5 | E1531S2-01, E1531S2-04, E1531S2-05 |
| T-1548 C1 to C4 | E1531S2-06; E1531S2-15 (a Codex Implementer in a linked worktree runs on `local`) |
| T-1548 C5 | E1531S2-01 |
| T-1547 C1 to C4 | E1531S2-07; E1531S2-01 (no `process.kill`); E1531S2-13, E1531S2-14 |
| T-1547 C5 | E1531S2-01, E1531S2-07 |
| T-1549 C1, C3 | E1531S2-08; E1531S2-15 and E1531S2-16 (add and remove on a real hub) |
| T-1549 C2 | E1531S2-01, E1531S2-08, E1531S2-15 (the `node_modules` link) |
| T-1549 C4, T-1550 C4 | E1531S2-01, E1531S2-08 |
| T-1550 C1, C3 | E1531S2-08; E1531S2-15 and E1531S2-16 (list and prune with a session inside) |
| T-1550 C2 | E1531S2-01 |
| T-1551 C1, C2, C4 | E1531S2-09; E1531S2-17 (human path reads on `local`) |
| T-1551 C3 | E1531S2-09 only (the upload is a composer and remote path) |
| T-1551 C5 | E1531S2-01, E1531S2-09 |
| T-1552 C1 | E1531S2-10; E1531S2-12, E1531S2-13 (`hostColumn`, rows read `local`) |
| T-1552 C2 | E1531S2-10; E1531S2-13, E1531S2-19 (`host` absent from `session list --json`) |
| T-1552 C3 | E1531S2-10; E1531S2-18 (t1 logs its operations), E1531S2-19 (no t1 without the variable) |
| T-1552 C4, C5 | E1531S2-10; E1531S2-01 |
| T-1553 C1 | E1531S2-11; E1531S2-18 (`unknown host qa-nohost`, explicit `local` accepted), E1531S2-19 |
| T-1553 C2 | E1531S2-11; E1531S2-18 (launch); relaunch and fresh resume by E1531S2-11 only |
| T-1553 C3 | E1531S2-11 only (needs a stopped row on t1 planted in `hub.db`) |
| T-1553 C4 | E1531S2-11; E1531S2-18 (an Implementer on t1 reaches t1, nothing local) |
| T-1553 C5, C6 | E1531S2-01, E1531S2-11 |
| Every Host operation on `local` (stage-wide regression) | E1531S2-02 |

## Build

Use a clean detached worktree at the full dev SHA named in the request: `<dev SHA>` (40 hex). HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt: for every member that `task plan show E-1531` lists in stage `adapters, worktrees, artifacts and the host column`, `git log --first-parent --format=%H --grep "^Item: <id>$" <dev SHA>` prints exactly one commit. At writing, dev was `51db58a40eda20e901222bc3d4a6967fa63e137e` and these had landed: T-1545 `273687567fda30fc3b23fcd042e89c8c20a11047`, T-1546 `ae87ed2d67490213f9957ddab4b1a7ace70f3e20`, T-1547 `8e7252c6597ce060a93656e19b53373928c808d3`, T-1549 `89cefcfddd78d62891ae49cd7d8608135f1c79fc`, T-1550 `60c6e2d399a8d0fb56a84790dbbffe1733c621d5`, T-1551 `19b2d5c4a71804b2365241d9297802a169914b91`, T-1552 `cca4b422b055aba187fcb333864e18141ed2a7b0`. T-1548 (branch head `5015ac9b9eef71fb629617bda67d867fcb51b496` on `t/T-1548-codex-sandbox-roots-from-the-host-s`) and T-1553 (branch head `4ba2037ab4a50749045153745f82ea3185781cb4` on `t/T-1553-the-coordinator-and-the-aide-stay-on-the`) were in the merge queue and had not landed; their expectations below were read from those branch heads and must be re-checked with grep at the tested build. A dirty build, missing required merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no run id on purpose.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step (the setup below does; the clean-tree checks ignore that one entry). No row needs `web/dist`: no stage item changed `web/`.

**Isolation (rule 15).** Every scratch check runs in a disposable project with its own HOME, XDG directories and Git config, with provider and account variables removed. Never the live project at `/Users/evgeniyivanov/Projects/cland/v0`, its hub, its `hub.db` or the human's HOME (`~/.cland`, `~/.claude`, `~/.codex`, `~/.local/state`, `~/.config/cland`). The live hub is read only by QA's own shell for E1531S2-00's plan read and `quiet` (cover-quiet admission). **Harnesses:** only the fakes in `$W/hub/test/fakes/` run, named by `CLAND_CLAUDE_BIN`, `CLAND_CODEX_BIN` and `CLAND_OPENCODE_BIN` and first on the scratch hub's `PATH`; no real Claude Code, Codex or OpenCode, no login, no provider. **Browser (rule 18):** none. **Preconditions (rule 22):** every check function prints a `PRE:` line before acting; when that line differs from the row's stated precondition, record the row `BLOCKED` with the line and stop the dependent rows. Messages and test titles are marked verified or inferred under "Source provenance" below.

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree, runs `quiet` and the plan read, and records every check with `qa-record.sh`. **Every other command runs sealed** inside a subshell that sources `$Q/env.sh`: the full `fixtureEnvironment` result (`test-support/fixture-environment.ts`) after the scratch overlays. It drops every inherited `CLAND_*`, `GIT_*`, `XDG_*`, `CLAUDE_*`, `CODEX_*`, `OPENCODE_*`, `FAKE_*`, provider and account variable, keeps `PATH`, `SHELL`, `TERM` and `TMPDIR`, and synthesizes its own scratch values (HOME, XDG, `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, the `FAKE_*_HOME` directories, `CLAND_EXECUTOR_STATE`, the messenger sentinels and `CLAND_TEST_OWNED_ROOT`, all under `$Q`). Leave `TMPDIR` at the system default (on macOS `/var/folders/...`; never `/tmp`, T-1030). Never use `env -i`. The scratch root lives under `/private/tmp/qa-e1531s2-` (its realpath, short enough for the scratch hub's socket).

One scratch project, **p1**: a fresh `cland init` project on `dev`, with an empty `node_modules` directory at its root (excluded from Git through `.git/info/exclude`, so worktreeAdd has a root install to link), and a CLI-started hub run from the tested worktree with the fakes first on its `PATH`, the machine-wide orphan sweep off, and `CLAND_TEST_HOSTS=t1` until E1531S2-19 restarts it without the variable. Its clients are the CLI (the scratch human), and socket frame clients saying `client: "nvim"` (the human's Neovim connection) for the `session.launch` frames that carry `host`, since no CLI flag carries it.

In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<dev SHA>                                    # the full dev SHA from the request
RUN=qa-s2-$(date +%F)-1                        # unique run id for E-1531; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e1531s2-$RUN          # the clean detached build
EV=$R/.cland/qa/E-1531/$RUN                    # captures (qa-record.sh keeps its evidence here too)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
Q=$(cd "$(mktemp -d /tmp/qa-e1531s2-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/qa-e1531s2-…
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data" "$Q/xdg/cache" "$Q/p1" "$Q/art/folder/sub" "$Q/fake-claude" "$Q/fake-codex" "$Q/fake-opencode" "$Q/claude" "$Q/codex"
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
ENV
( . "$Q/env.sh"; env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)' )
( . "$Q/env.sh"; env | cut -d= -f1 | grep -E '^CLAND_' | sort | tr '\n' ' '; echo )
```

The probe. It prints one JSON line per fact and never prints the hub secret.

```sh
cat > "$Q/probe.mjs" <<'JS'
// node "$QA_Q/probe.mjs" <mode> <p1 root> [arg]   (sealed)
// frames <JSON array of frames> | rows | hostlog <byte offset>
import { readFileSync, appendFileSync } from 'node:fs';
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
          out(f.id, { name: fr.name, role: fr.role ?? null, host: fr.host ?? null, ok: f.ok, code: f.code ?? null, error: f.error ?? null, process: p ? { name: p.name, status: p.status, hostField: Object.hasOwn(p, 'host') } : null });
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
  default: out('refused', `unknown mode ${mode}`); process.exit(2);
}
JS
node --check "$Q/probe.mjs" && echo "probe checked"
```

The check functions. Define them in QA's own shell (paste the block once). Rows that run in p1 call them as `( . "$Q/env.sh"; cd "$Q/p1" && <function> ) > "$EV/<id>.txt" 2>&1`; read the capture, then record it.

```sh
m00() {   # QA's own shell: build, membership, landings
  echo "PRE: HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) want $S"
  echo "dirty entries $(git -C "$W" status --porcelain | grep -v -x '?? node_modules' | wc -l | tr -d ' ')"
  (cd "$R" && node hub/bin/cland.ts task plan show E-1531 --json) > "$EV/E1531S2-00-plan.json"
  node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=p.stages.find(x=>x.name==="adapters, worktrees, artifacts and the host column");console.log(JSON.stringify({state:s.state,qa:s.qa,items:s.items,merged:s.merged,total:s.total,statuses:s.statuses}))' "$EV/E1531S2-00-plan.json"
  for id in $(node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(p.stages.find(x=>x.name==="adapters, worktrees, artifacts and the host column").items.join(" "))' "$EV/E1531S2-00-plan.json"); do
    echo "$id landings: $(git -C "$R" log --first-parent --format=%H --grep "^Item: $id\$" "$S" | tr '\n' ' ')"; done
}
kept() {  # kept <id> <files…>: the item's landing edited none of the named preserved test files
  id=$1; shift; L=$(git -C "$W" log --first-parent --format=%H --grep "^Item: $id\$" HEAD)
  echo "$id ($L) edited preserved files: $(git -C "$W" diff --name-only "$L^1" "$L" -- "$@" | wc -l | tr -d ' ')"
}
m01() {   # QA's own shell, read-only in $W: preserved tests and source boundaries
  echo "PRE: HEAD $(git -C "$W" rev-parse HEAD)"
  kept T-1545 hub/test/opencode-adapter.test.ts hub/test/opencode-native.test.ts
  echo "T-1545 launch-policy change (allowed exception): $(git -C "$W" diff --stat "$(git -C "$W" log --first-parent --format=%H --grep '^Item: T-1545$' HEAD)^1" "$(git -C "$W" log --first-parent --format=%H --grep '^Item: T-1545$' HEAD)" -- hub/test/opencode-launch-policy.test.ts | tail -n 1)"
  kept T-1546 hub/test/codex-adapter.test.ts hub/test/codex-delivery.test.ts hub/test/codex-native.test.ts hub/test/codex-workspace-git.test.ts
  kept T-1547 hub/test/claude-code-adapter.test.ts hub/test/claude-code-sessions.test.ts hub/test/claude-code-schedule.test.ts hub/test/claude-code-accounts.test.ts hub/test/claude-code-environment.test.ts
  kept T-1549 hub/test/task-worktrees.test.ts hub/test/task-worktrees-lifecycle.test.ts hub/test/worktree-cli.test.ts hub/test/territory-lock.test.ts
  kept T-1550 hub/test/task-worktrees.test.ts hub/test/worktree-cli.test.ts
  kept T-1551 hub/test/artifacts.test.ts hub/test/artifact-create-unit.test.ts hub/test/artifact-folders.test.ts hub/test/artifact-upload.test.ts hub/test/artifact-cli.test.ts
  kept T-1552 hub/test/orphan-servers.test.ts hub/test/orphan-sweep-lock.test.ts hub/test/session-async-processes.test.ts
  kept T-1553 hub/test/role-launch.test.ts hub/test/roles-launch-permissions.test.ts hub/test/session-launch.test.ts
  ( cd "$W"
    echo "process.kill: $(grep -c 'process\.kill' hub/src/adapters/opencode.ts hub/src/adapters/opencode/server.ts hub/src/adapters/codex.ts hub/src/adapters/claude-code.ts | tr '\n' ' ')"
    echo "codex.ts fs imports: $(grep -E "^import .* from 'node:fs(/promises)?';" hub/src/adapters/codex.ts | tr '\n' ' ')"
    echo "worktrees.ts node:fs imports: $(grep -c "from 'node:fs" hub/src/hub/worktrees.ts)"
    echo "placement message in source: $(grep -c -F 'Coordinator and Aide roles run only on the local host' hub/src/host/role-placement.ts)"
    echo "test host refusal in source: $(grep -c -F 'refuses ${operation}' hub/src/host/test-host.ts)"
    echo "help line: $(node hub/bin/cland.ts --help | grep -c -F 'Coordinator and Aide sessions run only on the local host;')"
    echo "skill line: $(grep -c -F 'Production lookups resolve hosts through the registry (T-1552)' .agents/skills/implement/SKILL.md)"
    echo "permissions doc: $(grep -c -x '## Local-only role placement' docs/agents/session-permissions.md)" )
}
m12() {   # p1: init on dev, root node_modules, hub start with test host t1
  echo "PRE: p1 entries $(ls -A | wc -l | tr -d ' '); fakes $(ls "$FCC/claude" "$FCX/codex" "$FOC/opencode" | wc -l | tr -d ' ')"
  git init -q -b main && echo qa > README.md && git add README.md && git commit -q -m init
  cland init . > "$QA_EV/E1531S2-12-init.txt" 2>&1; echo "init exit $?"
  [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; cland hub stop > /dev/null 2>&1
  git switch -q dev; echo "branch $(git branch --show-current)"
  sed -i '' -e "s|^lock_path = .*|lock_path = \"$QA_Q/p1-suite.lock\"|" -e 's|^executor = .*|executor = "local"|' .cland/config.toml
  echo "lock $(grep -c -x "lock_path = \"$QA_Q/p1-suite.lock\"" .cland/config.toml) executor $(grep -c -x 'executor = "local"' .cland/config.toml)"
  git add -A && git commit -q -m "QA scratch config"
  mkdir node_modules && printf 'node_modules\n' >> .git/info/exclude
  echo "dirty entries $(git status --porcelain | wc -l | tr -d ' ')"
  hubstart CLAND_TEST_HOSTS=t1; echo "hub start exit $?"
  probe rows
}
m13() {   # p1: one session per harness on the local host, liveness through the Host
  echo "PRE: hub $(up); rows $(probe rows | grep -c '"row"')"
  o=$(off)
  for h in claude-code codex opencode; do
    cland session launch "qa-$h" --harness "$h" > "$QA_EV/E1531S2-13-$h.txt" 2>&1; echo "launch $h exit $?"
    waitrun "qa-$h" 120
  done
  cland session list --json > "$QA_EV/E1531S2-13-list.json"; echo "list exit $?; host keys $(grep -o '"host"' "$QA_EV/E1531S2-13-list.json" | wc -l | tr -d ' ')"
  probe rows
  probe hostlog "$o"
}
m14() {   # p1: stop each through the Host
  echo "PRE: $(for h in claude-code codex opencode; do printf 'qa-%s %s; ' "$h" "$(srow "qa-$h")"; done)"
  o=$(off)
  for h in claude-code codex opencode; do
    cland session stop "qa-$h" > "$QA_EV/E1531S2-14-$h.txt" 2>&1; echo "stop $h exit $?"
    waitstop "qa-$h" 30
  done
  probe rows
  probe hostlog "$o"
}
m15() {   # p1: an item launch adds its task worktree through the Host; who stands inside
  echo "PRE: hub $(up); worktrees: $(cland worktree list)"
  ID=$(cland task create "QA host item" --size S --json | pick 'v.item.id'); echo "item $ID"; echo "$ID" > "$QA_Q/item"
  o=$(off)
  cland session launch qa-wt --role implementer --harness codex --item "$ID" --json > "$QA_EV/E1531S2-15-launch.json" 2>&1; echo "launch exit $?"
  pick '({path: v.worktree?.path ?? null, branch: v.worktree?.branch ?? null, claim: v.claim?.session ?? null, reason: v.reason ?? null})' < "$QA_EV/E1531S2-15-launch.json"
  waitrun qa-wt 120
  echo "dir $(test -d ".cland/worktrees/$ID" && echo present || echo absent)"
  echo "node_modules link $(readlink ".cland/worktrees/$ID/node_modules")"
  echo "git worktrees naming it $(git worktree list --porcelain | grep -c -x "worktree $PWD/.cland/worktrees/$ID")"
  echo "branches $(git branch --list "t/$ID-*" --format='%(refname:short)' | tr '\n' ' ')"
  wrow "$ID"
  probe rows | grep '"qa-wt"'
  probe hostlog "$o"
}
m16() {   # p1: prune refuses while the session stands inside, removes after the stop
  ID=$(cat "$QA_Q/item"); echo "PRE: $ID qa-wt $(srow qa-wt); dir $(test -d ".cland/worktrees/$ID" && echo present || echo absent)"
  cland task close "$ID" > "$QA_EV/E1531S2-16-close.txt" 2>&1; echo "close exit $?"
  cland worktree prune --yes > "$QA_EV/E1531S2-16-prune1.txt" 2>&1; echo "prune (inside) exit $?"; cat "$QA_EV/E1531S2-16-prune1.txt"
  echo "dir $(test -d ".cland/worktrees/$ID" && echo present || echo absent)"
  cland session stop qa-wt > "$QA_EV/E1531S2-16-stop.txt" 2>&1; echo "stop exit $?"; waitstop qa-wt 30
  wrow "$ID"
  cland worktree prune --yes > "$QA_EV/E1531S2-16-prune2.txt" 2>&1; echo "prune exit $?"; cat "$QA_EV/E1531S2-16-prune2.txt"
  echo "dir $(test -d ".cland/worktrees/$ID" && echo present || echo absent)"
  echo "branches $(git branch --list "t/$ID-*" | wc -l | tr -d ' ')"
  echo "git worktrees naming it $(git worktree list --porcelain | grep -c -x "worktree $PWD/.cland/worktrees/$ID")"
}
m17() {   # p1: artifacts from a path, read back byte for byte (the human's calls use the local host)
  head -c 4096 /dev/urandom > "$QA_Q/art/blob.bin"; printf '<h1>qa</h1>\n' > "$QA_Q/art/folder/index.html"; printf 'nested\n' > "$QA_Q/art/folder/sub/n.txt"
  echo "PRE: hub $(up); sources $(find "$QA_Q/art" -type f | wc -l | tr -d ' ') regular"
  o=$(off)
  cland artifact new --kind file --title "QA host file" --topic general --path "$QA_Q/art/blob.bin" --json > "$QA_EV/E1531S2-17-file.json" 2>&1; echo "file exit $?"
  A=$(pick 'v.artifact.id' < "$QA_EV/E1531S2-17-file.json"); pick '({id:v.artifact.id,kind:v.artifact.kind,folder:v.artifact.folder??false,name:v.artifact.path.split("/").pop()})' < "$QA_EV/E1531S2-17-file.json"
  P=$(cland artifact open "$A" --json | pick 'v.path'); cmp "$QA_Q/art/blob.bin" "$P" && echo "file bytes same"
  cland artifact new --kind page --title "QA host folder" --topic general --path "$QA_Q/art/folder" --entry index.html --json > "$QA_EV/E1531S2-17-folder.json" 2>&1; echo "folder exit $?"
  B=$(pick 'v.artifact.id' < "$QA_EV/E1531S2-17-folder.json"); pick '({id:v.artifact.id,folder:v.artifact.folder??false,entry:v.artifact.entry??null})' < "$QA_EV/E1531S2-17-folder.json"
  P=$(cland artifact open "$B" --json | pick 'v.path'); diff -r "$QA_Q/art/folder" "$(dirname "$P")" && echo "folder same"
  cland artifact new --kind file --title "QA relative file" --topic general --path ../art/blob.bin --json > "$QA_EV/E1531S2-17-rel.json" 2>&1; echo "relative exit $?"
  P=$(cland artifact open "$(pick 'v.artifact.id' < "$QA_EV/E1531S2-17-rel.json")" --json | pick 'v.path'); cmp "$QA_Q/art/blob.bin" "$P" && echo "relative bytes same"
  cland artifact new --kind file --title "QA missing" --topic general --path "$QA_Q/art/missing.bin" > "$QA_EV/E1531S2-17-missing.txt" 2>&1; echo "missing exit $?"; cat "$QA_EV/E1531S2-17-missing.txt"
  probe hostlog "$o"
}
m18() {   # p1 (CLAND_TEST_HOSTS=t1): placement through session.launch frames
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
  cland session stop qa-coord-local > "$QA_EV/E1531S2-18-stop.txt" 2>&1; echo "stop exit $?"; waitstop qa-coord-local 30
  probe hostlog "$o"
}
m19() {   # p1: restart without CLAND_TEST_HOSTS; t1 is unknown; rows stay local
  echo "PRE: hub $(up); running rows $(cland session list --json | pick 'v.processes.filter(p=>p.status==="running").map(p=>p.name)')"
  cland hub stop; echo "stop exit $?"
  hubstart; echo "start (no test hosts) exit $?"
  o=$(off)
  probe frames '[{"type":"session.launch","name":"qa-impl-t1b","role":"implementer","harness":"codex","host":"t1"},{"type":"session.launch","name":"qa-coord-t1b","role":"coordinator","harness":"claude-code","host":"t1"}]'
  probe hostlog "$o"
  probe rows
  cland session list --json > "$QA_EV/E1531S2-19-list.json"; echo "list exit $?; host keys $(grep -o '"host"' "$QA_EV/E1531S2-19-list.json" | wc -l | tr -d ' ')"
}
m20() {   # p1: cleanup; judge the fixture-owned census only
  cland hub stop > "$QA_EV/E1531S2-20-hubstop.txt" 2>&1; echo "hub stop exit $?"; sleep 2
  sort -u "$QA_Q/pids" | while read -r p; do [ -n "$p" ] && kill -0 "$p" 2>/dev/null && echo "alive $p $(ps -o command= -p "$p")"; done
  echo "census of $(sort -u "$QA_Q/pids" | grep -c .) fixture pids done"
  ps -Ao pid=,command= > "$QA_Q/ps.txt"; echo "processes naming the scratch root: $(grep -c -F "$QA_Q" "$QA_Q/ps.txt")"; grep -F "$QA_Q" "$QA_Q/ps.txt" | head -20
}
```

Cleanup after the evidence is recorded: print `$Q`, check it begins with `/private/tmp/qa-e1531s2-`, and remove it by that literal path with a non-force `rm -r`. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). p1's secret in `$Q/p1/.cland/hub.json` is never printed or posted. Record the setup (worktree, `$Q`, the zero credential-name count, the `CLAND_` name list, `probe checked`) as check `S0` with `qa-record.sh note`; the name list must be exactly `CLAND_DISCORD_API_ROOT CLAND_ELEVENLABS_API_ROOT CLAND_EXECUTOR_STATE CLAND_TELEGRAM_API_ROOT CLAND_TEST_OWNED_ROOT` (no `CLAND_SESSION_*`, `CLAND_LAUNCH_TOKEN` or `CLAND_ROLE` from QA's own session).

## Cases

none. No headless-grid case covers this stage: no stage item changed Neovim or the web. Every check below is a manual check through named test files, the CLI, socket frames and read-only reads of the scratch `hub.db` and `hub.log`, recorded with `qa-record.sh note`.

### Web cases (when in scope)

none. No stage item changed `web/` (checked with `git show --stat` of every landing and both branch heads); no real browser, no Headless Shell, no computer use.

## Manual checks

Run in this order. Rows E1531S2-02 to E1531S2-11 run their test files serially from `$W` through `nt` (cover-quiet admission before each row, one-minute load below 10 and the free disk space printed before each file; targeted files take no suite lease), never in parallel with each other or with the scratch rows. Rows E1531S2-12 to E1531S2-20 depend on the p1 state the rows before them leave. Record each row with `sh .agents/skills/qa/qa-record.sh note E-1531 "$RUN" <id> <surface> "<command run>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <captures…>` from `$W`, putting the capture in `$EV/<id>.txt` (or the named log) first. For every `nt` row "clean" means: every `exit` line reads `exit 0 <file>`, no `not ok` line and no `# SKIP` line.

| id | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1531S2-00 | hub-api | QA | `m00 > "$EV/E1531S2-00.txt" 2>&1` (QA's own shell) | PRE line: HEAD, dev and the request's SHA are the same 40 hex; `dirty entries 0`; the stage line names `adapters, worktrees, artifacts and the host column` with `qa` affected/after-stage and every member merged; each member prints exactly one landing SHA (T-1548 and T-1553 included). Otherwise BLOCKED, reported to the requester, nothing else run |
| E1531S2-01 | hub-api | QA | `m01 > "$EV/E1531S2-01.txt" 2>&1` (QA's own shell, read-only) | Every `kept` line ends `edited preserved files: 0`; the T-1545 launch-policy line names only `hub/test/opencode-launch-policy.test.ts` (the approved exception, recorded not judged). `process.kill:` prints `:0` for each of the four adapter files. `codex.ts fs imports:` prints import lines that name neither `realpath` nor `stat` (at writing `import { access, readFile, rm } from 'node:fs/promises';`). `worktrees.ts node:fs imports: 0`. `placement message in source: 1`, `test host refusal in source: 1`. `help line:` at least `1`; `skill line: 1`; `permissions doc: 1` |
| E1531S2-02 | hub-api | QA | `nt E1531S2-02 hub/test/host-local-contract.test.ts hub/test/host-contract-coverage.test.ts hub/test/adapter-native-boundary.test.ts` | clean. `oks E1531S2-02` lists Tests: `Host contract exercises every interface member and detects an uncovered addition`, `CodexAdapter: post-spawn log close failure retains the normal live session and child`, `OpenCodeAdapter: post-spawn log close failure retains the normal live session and child`; the contract file's cases are generated by `hostContract` (read them from the log: every one prints `ok`) |
| E1531S2-03 | hub-api | QA | `nt E1531S2-03 hub/test/opencode-host.test.ts hub/test/opencode-adapter.test.ts hub/test/opencode-native.test.ts hub/test/opencode-launch-policy.test.ts` | clean. `oks` lists Tests: `OpenCode launches once through Host with unchanged serve arguments, environment, cwd and log`, `OpenCode poll, resume and stop use the row Host and preserve its birth identity`, `Host launch rollback retains files until its native completion receipt`, `OpenCode close reports incomplete launch cleanup and retains its durable owner` |
| E1531S2-04 | hub-api | QA | `nt E1531S2-04 hub/test/codex-host.test.ts hub/test/codex-adapter.test.ts hub/test/codex-delivery.test.ts hub/test/codex-native.test.ts hub/test/lead-permissions-component.test.ts hub/test/session-cwd.test.ts` | clean. `oks` lists Tests: `Codex launch refuses the Host directory refusal before running a command`, `Codex launches, resumes, polls and stops only through the selected Host`, `Codex version failure from the Host refuses spawn`, `a late Host liveness reply cannot retire a replacement Codex row` |
| E1531S2-05 | hub-api | QA | `nt E1531S2-05 hub/test/codex-workspace-git.test.ts` | clean on macOS (the T4 file is macOS-only and skips on Linux; this run is local on macOS, so a `# SKIP` is FAIL here, not a platform skip) |
| E1531S2-06 | hub-api | QA | `nt E1531S2-06 hub/test/codex-sandbox-host.test.ts` | clean. `oks` lists Tests: `local Codex policies retain the captured byte-identical overrides`, `Codex takes roots, linked git bytes and socket paths from the selected Host`, `spawn and relaunch serialize the captured session Host policy` |
| E1531S2-07 | hub-api | QA | `nt E1531S2-07 hub/test/claude-code-host.test.ts hub/test/host-local-liveness.test.ts hub/test/project-hub.test.ts hub/test/lead-routing-process.test.ts hub/test/claude-code-adapter.test.ts hub/test/claude-code-sessions.test.ts hub/test/claude-code-schedule.test.ts hub/test/claude-code-accounts.test.ts hub/test/claude-code-environment.test.ts` | clean. `oks` lists Tests: `Claude launch, directory discovery and settings reach the selected Host with unchanged command inputs`, `Claude identities, resume fallback, signed-out liveness and stop stay on the row Host`, `Claude close joins an in-flight Host liveness observation before releasing the adapter`, `local Host bare-PID liveness reads existence without identity subprocess work` |
| E1531S2-08 | hub-api | QA | `nt E1531S2-08 hub/test/worktree-host.test.ts hub/src/hub/worktrees.test.ts hub/test/task-worktrees.test.ts hub/test/task-worktrees-lifecycle.test.ts hub/test/worktree-cli.test.ts hub/test/territory-lock.test.ts` | clean. `oks` lists Tests: `territory add/remove use the supplied Host under lock and return its install warning`, `default local Host shares root modules and reports a stale install`, `claim, item launch and prune route each created/removed worktree through Host under lock`, `Host occupants govern list and prune even with a different recorded cwd`, `prune rechecks Host occupants at both locked admission and the last pre-Git boundary`, `prune retains a directory when the Host reports a changed worktree or session identity` |
| E1531S2-09 | hub-api | QA | `nt E1531S2-09 hub/test/artifact-host.test.ts hub/test/artifacts.test.ts hub/test/artifact-create-unit.test.ts hub/test/artifact-folders.test.ts hub/test/artifact-upload.test.ts hub/test/artifact-cli.test.ts` | clean. `oks` lists Tests: `artifact source type and binary bytes are read only on the supplied Host`, `folder source listing and nested files remain on its Host`, `session frames resolve relative paths through Sessions Host while human frames use local`, `upload checks stored attachment types on local Host while new bytes stay in the frame` |
| E1531S2-10 | hub-api | QA | `nt E1531S2-10 hub/test/host-registry.test.ts hub/test/host-orphans.test.ts hub/test/fixture-environment.test.ts hub/test/orphan-servers.test.ts hub/test/orphan-sweep-lock.test.ts hub/test/session-async-processes.test.ts` | clean. `oks` lists Tests: `legacy process database migrates host in place and persists named hosts`, `test Host logs every operation, returns synthetic Linux identities and refuses native work`, `real project hub registers only opted-in test hosts and keeps local session frames unchanged`, `without the test-host environment only local is registered; unknown rows stay unknown`, `remote rows neither protect nor authorize sweeping local matching PIDs` |
| E1531S2-11 | hub-api | QA | `nt E1531S2-11 hub/test/session-host-placement.test.ts hub/test/role-launch.test.ts hub/test/roles-launch-permissions.test.ts hub/test/session-launch.test.ts` | clean. `oks` lists Tests: `unknown launch Host is refused by name before reservation or spawn; legacy launch defaults local`, `another role reaches the selected test Host spawn and keeps its refusal`, `a successful registered Host launch persists placement and fresh resume keeps it`, `spoke launch forwards Host placement and Coordinator handover refuses its remote row`, `production OpenCode launch reaches the explicitly selected nonlocal Host spawn`; the file's generated per-role cases (launch, relaunch and fresh resume; set and move, for coordinator and aide; template-literal titles) also print `ok` — read them from the log and compare with the source loops |
| E1531S2-12 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m12 ) > "$EV/E1531S2-12.txt" 2>&1` | PRE: p1 has no entries; `fakes 3`. `init exit 0`; `branch dev`; `lock 1 executor 1`; `dirty entries 0` (the excluded `node_modules` not listed); `hub start exit 0`; `hostColumn` true and no `row` line |
| E1531S2-13 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m13 ) > "$EV/E1531S2-13.txt" 2>&1` | PRE: hub up, rows `0`. `launch claude-code exit 0`, `launch codex exit 0`, `launch opencode exit 0`; each `qa-<harness>: running <state> <pid>` within the wait (the state is recorded; `idle` is usual for the fakes, judged only through `running` and the pid); `list exit 0; host keys 0`; `hostColumn` true; each of the `qa-claude-code`, `qa-codex` and `qa-opencode` rows reads `host` `local`, its harness, `status` `running`, a numeric `pid`, `identity` `darwin` (a native birth identity) and `alive` true; `testHostOps` `[]` (no launch touched t1); `logCloseDiagnostics` recorded, not judged |
| E1531S2-14 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m14 ) > "$EV/E1531S2-14.txt" 2>&1` | PRE: the three rows running. For each harness `stop <harness> exit 0` and `qa-<harness>: stopped, process gone`; the three rows read `host` `local`, `status` `stopped`, `alive` false; `testHostOps` `[]` |
| E1531S2-15 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m15 ) > "$EV/E1531S2-15.txt" 2>&1` | PRE: hub up, `no task worktrees`. `item <ID>` printed; `launch exit 0`; the pick prints `path` `<p1>/.cland/worktrees/<ID>`, `branch` `t/<ID>-qa-host-item`, `claim` `qa-wt`, `reason` null; `qa-wt: running <state> <pid>`; `dir present`; `node_modules link <p1>/node_modules` (the root install linked by worktreeAdd); `git worktrees naming it 1`; `branches t/<ID>-qa-host-item`; `wrow`: `state` `open`, the same branch, `sessions` `["qa-wt"]`; the `qa-wt` row reads `host` `local`, `harness` `codex`, `role` `implementer`, `status` `running`, `identity` `darwin`, `alive` true; `testHostOps` `[]` |
| E1531S2-16 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m16 ) > "$EV/E1531S2-16.txt" 2>&1` | PRE: qa-wt running, dir present. `close exit 0`. `prune (inside) exit 0`, its output holds `<ID>  closed  t/<ID>-qa-host-item  .cland/worktrees/<ID>`, a line ending `sessions inside: qa-wt`, `    kept: a session stands inside` and `kept <ID>`; `dir present`. `stop exit 0`, `qa-wt: stopped, process gone`; `wrow`: `state` `closed`, `sessions` `[]`. `prune exit 0` printing `removed <ID>: .cland/worktrees/<ID> and t/<ID>-qa-host-item`; `dir absent`; `branches 0`; `git worktrees naming it 0`. If either prune prints `not removed <ID>:` with a Git refusal naming files, record `git -C .cland/worktrees/<ID> status --porcelain` and judge INCONCLUSIVE (a fixture file, not the Host path) |
| E1531S2-17 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m17 ) > "$EV/E1531S2-17.txt" 2>&1` | PRE: hub up; `sources 3 regular`. `file exit 0`; the pick shows an `A-<n>` id, `kind` `file`, `folder` false, a name `A-<n>-qa-host-file.bin`; `file bytes same`. `folder exit 0`; `folder` true, `entry` `index.html`; `folder same` (no `diff` output: the nested `sub/n.txt` is copied too). `relative exit 0`; `relative bytes same`. `missing exit` nonzero, and the capture contains `cannot read artifact source "<Q>/art/missing.bin"`. `testHostOps` `[]` |
| E1531S2-18 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m18 ) > "$EV/E1531S2-18.txt" 2>&1` | PRE: hub up, `coordinator none`. First frames: `welcome` recorded; `q1` (coordinator, host t1) and `q2` (aide, host t1) `ok` false with `error` containing `Coordinator and Aide roles run only on the local host`; `q3` (host `qa-nohost`) `ok` false with `error` containing `unknown host qa-nohost`; that window's `testHostOps` `[]` (refused before any Host operation). Second frame: `q1` (implementer, opencode, host t1) `ok` false, its `error` recorded (it names the test host's refusal of the first operation the launch reached, `test host t1 refuses <operation>`); that window's `testHostOps` is nonempty and every entry begins `t1:`. `refused names listed: []`. Third frame: `q1` (coordinator, host `local`) `ok` true, `process.status` `running`, `hostField` false; `qa-coord-local: running …`; `coordinator qa-coord-local`; its row reads `host` `local`, `identity` `darwin`, `alive` true; `stop exit 0`, `qa-coord-local: stopped, process gone`; that window's `testHostOps` `[]` |
| E1531S2-19 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m19 ) > "$EV/E1531S2-19.txt" 2>&1` | PRE: hub up, running rows `[]`. `stop exit 0`; `start (no test hosts) exit 0`; `q1` (implementer, host t1) and `q2` (coordinator, host t1) `ok` false with `error` containing `unknown host t1` (without `CLAND_TEST_HOSTS` only `local` exists, and the host is resolved before the role check); `testHostOps` `[]`; `hostColumn` true and every `row` reads `host` `local`; `list exit 0; host keys 0` |
| E1531S2-20 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m20 ) > "$EV/E1531S2-20.txt" 2>&1` | Cleanup, judged by the fixture-owned census only (never a machine-wide `pgrep`): `hub stop exit 0`; no `alive` line names a fixture process (a `cland` hub or `hub serve`, `probe.mjs`, a fake `claude`, `codex` app-server or `opencode serve`); an `alive` line whose command is unrelated is pid reuse, recorded, not a failure; `processes naming the scratch root: 0` (any listed process is a leftover finding). Then remove `$Q` and the worktree as Build says |

After the rows, recheck `git -C "$W" rev-parse HEAD` and `git -C "$R" rev-parse refs/heads/dev` against the request: a moved dev keeps the evidence and makes the run BLOCKED.

Before requesting QA, run `cland qa lint qa/briefs/E-1531-stage-2.md` with this filled brief at the build under test (`node hub/bin/cland.ts qa lint qa/briefs/E-1531-stage-2.md --commit <dev SHA>` from the root). The brief is complete only when qa lint passes at the build.

**Source provenance (rule 22).** Read at dev `51db58a40eda20e901222bc3d4a6967fa63e137e` and at the T-1548 and T-1553 branch heads named in Build; re-check every one at the tested build.

- Verified in source: `Coordinator and Aide roles run only on the local host` (`hub/src/host/role-placement.ts`, T-1553 branch); `unknown host ${name}` from `#hostForLaunch` and `#hostForProcess`, thrown before the role check in `validateLaunchHost` (`hub/src/adapters/sessions.ts`); the help line `Coordinator and Aide sessions run only on the local host;` (`hub/src/cli/usage/session.ts`, T-1553 branch); `test host ${name} refuses ${operation}` and the `test-host-operation` log event with `host` and `operation` (`hub/src/host/test-host.ts`); `CLAND_TEST_HOSTS` read as a comma list, `local` skipped (`hub/src/adapters/index.ts`); the `host text not null default 'local'` column and in-place migration (`hub/src/adapters/processes.ts`); no `host` field in `session list` for local rows (asserted in `hub/test/host-registry.test.ts`); the `darwin:` birth identity prefix (`hub/src/process-identity.ts`); the `host-spawn-log-close-failed` diagnostic (`hub/src/host/local.ts`); the worktree CLI texts `    kept: a session stands inside`, `kept <ids>`, `removed <item>: <path> and <branch>`, `not removed <item>: <error>` and the list line layout (`hub/src/cli/worktree.ts`); occupants counting running sessions, connected spokes with a cwd and pending stops (`hub/src/hub/dispatch.ts` `#sessionCwds`); the root `node_modules` link and no warning without a root `package.json` (`hub/src/host/worktree-install.ts`); artifact names `${id}-${slug}${extension}` and `cannot read artifact source "<path>"` (`hub/src/hub/artifacts.ts`); the CLI resolving `--path` against its own cwd (`hub/src/cli/artifact.ts`); `CLAND_CLAUDE_BIN`, `CLAND_CODEX_BIN`, `CLAND_OPENCODE_BIN`, `CLAND_TEST_SKIP_ORPHAN_SWEEP`, `CLAND_ADAPTER_POLL_MS`, `CLAND_CLAUDE_AGENTS_MS` (`hub/src/adapters/*.ts`, `hub/src/hub/daemon.ts`); `hub start` passing its environment to the serve child (`hub/src/cli/hub.ts`); the fixture environment's synthesized names (`test-support/fixture-environment.ts`, `shared/fixture-roots.ts`). Every test title named above is a literal title in its file (T-1548's and T-1553's at their branch heads).
- Inferred, not verified by a run: which Host operation the production OpenCode adapter reaches first on the real test host t1 in E1531S2-18 (the test stubs statDirectory; on a real hub the refused operation may be `statDirectory`, `realpath`, `fileType`, `readFile` or `spawn`, so the row judges only that t1 was reached and nothing local ran); that a refused t1 launch leaves no process row (asserted in the test with a stubbed Host); the task branch slug `qa-host-item` and the `nothing beyond dev` base wording; that `cland task close` on a task claimed by a running Implementer succeeds for the human (the tracker releases the claim with reason `closed`); that `cland init` on a `main` repository leaves a `dev` branch to switch to (E-611's walkthrough relied on it); that the fakes reach `running` with a pid within the waits; that a read-only `node:sqlite` open of the running hub's WAL database reads committed rows; the `general` topic id in a fresh project; the generated test titles (template literals and the `hostContract` cases).

## Probes that mislead

- The live hub and the live workbench run the code of their last restart, not the tested dev SHA. Live sessions, the live `hub.db` and live process rows are not evidence for this stage; p1, the build's files and its tests are.
- Every `cland` here is `$W/hub/bin/cland.ts` (the `cland` function of `env.sh`). A `cland` on PATH, or the root's CLI, may be older.
- `session list` and the `session.launch` result carry no `host` field for a `local` row by design (T-1552 C2); the column lives in `hub.db` (`probe rows`). A missing `host` key in the CLI is the expected result, not a missing column.
- A `test-host-operation` line is expected only in the windows that name `t1`; one in a local launch, stop, worktree or artifact window is a failure. Windows start at the byte offset `off` printed before the row's actions, never at a timestamp.
- After a launch is accepted, a log-handle close failure is diagnostic only (`host-spawn-log-close-failed`; the Host.spawn contract: an accepted native owner wins over cleanup observers). It does not fail E1531S2-13 or E1531S2-18 while the row is running and alive; record it.
- The real test host refuses every native operation, so an Implementer launch on t1 fails with whichever operation the adapter reaches first. Judge "t1 reached, nothing local, no row", not the operation's name.
- Process cleanup probes use the fixture-owned census (`$Q/pids`: hub pids from `hub.json`, every session row's pid after `waitrun`, the probe itself; plus processes whose command line names `$Q`), registered at launch and checked through exit. A machine-wide `pgrep claude`, `codex` or `opencode` counts the crew's real harnesses (A-9063 R2; E-413 stage 1/T-1093).
- The fake harnesses' `state` (idle, unknown, busy) is not this stage's behaviour: judge `status`, `pid`, the birth identity and `alive`.
- The epic's DoD demo (a row on a test host whose pid matches a live local process is never probed locally) needs stage 3's routing (T-1554). Do not plant such a row here; it would test unmerged behaviour.
- `codex-workspace-git.test.ts` skips on Linux; on this macOS run it must execute. "No skip" names it.
- `opencode-launch-policy.test.ts` was edited by T-1545 under the Coordinator's 2026-11-01 exception; E1531S2-01 records that diff and judges only the other preserved files.
- Exit 0 from the Node test runner with a name that matches nothing is not a pass: confirm the named tests appear on ok lines.
- Edit existing keys in initialized configs (`lock_path`, `executor`); never add a second table (A-8634 R12). The root `node_modules` exclusion goes in `.git/info/exclude`, never in a tracked file.
- Re-check helper, message and test names with grep at the tested build; renames happen, and T-1548 and T-1553 had not landed at writing.

## Out of scope

Real remote hosts, the SSH transport, the host agent and git through the tunnel, pools, placement and the scheduler, and logins (later epics E-1532 onward). The third stage's T-1554 to T-1557: remote liveness, stop and signals routed by host and Linux birth identity, the task branch created in the territory before the worktree, Claude Code found once on another host, and the adapters boundary lint (stage "routing by host, the territory branch and the boundary", QA scope full). The epic's Definition of done demo. The T4 soak and load repetitions, the full T3/T4 suites and the stage cover pair (the Coordinator's occasion). The `artifact.upload` path on a real hub (composer and remote surfaces; covered by `hub/test/artifact-host.test.ts` and `hub/test/artifact-upload.test.ts` only). Role set and handover onto a row on another host on a real hub (needs a planted `hub.db` row; covered by `hub/test/session-host-placement.test.ts` only). Real Claude Code, Codex and OpenCode, any provider or account, a real browser, computer use, the live hub, a live restart and any change to live sessions, holds or the tracker. Missing authorization does not apply: nothing here needs a grant, so no check is BLOCKED for lack of one.

## Grants

none. Every scratch check uses the rule 15 sealed environment with credentials filtered and only the fake harnesses; the test files run under the same environment.

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`--stage "adapters, worktrees, artifacts and the host column"`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Report `qa clear E-1531 stage adapters, worktrees, artifacts and the host column` or `qa not clear E-1531 stage adapters, worktrees, artifacts and the host column` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
