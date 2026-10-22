# Stage QA brief: E-418 stage 1 — seams and the session list

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` or `$B:h` as a modifier). The run is local, on macOS (BSD tools; Chrome Headless Shell from the installed `playwright-core`).

## Stage

- Epic: E-418 (Sessions, artifacts and accounts in the web, under R-377).
- Exact stage name: seams and the session list.
- Items: lane 1 T-1130, then T-1132; lane 2 T-1131, then T-1147. The run reads the stage's members from `task plan show E-418` (E418S1-00) and never from a number written here. Findings fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: the combined changed behaviour of the four items at the tested build.
  - T-1130, area modules and their hub state: Sessions, Accounts and Artifacts render through their own `AreaModule` (`Pane`, `Page`, `Drawer`, `data-area-module`, `data-area-surface`, `data-key-context`); the Sessions pane holds the slots `header`, `accounts`, `verification` and `groups` (`data-session-slot`); the connection keeps merged session rows, the archived count, roles, the verification queue with its receipt time, account views in registry order, adapter capabilities (one `session.list` per connection) and artifacts; an `account`, `verification.queue` or `artifact` frame replaces state in place with no `session.list`, `account.list` or `artifact.list` after it; a restarted hub's snapshot replaces Sessions and Accounts without a page reload.
  - T-1131, three hub requests: `session.history {session, limit?, before?}` for human clients on the Unix socket and the web edge (sent and received traffic across topics, at most 50 messages, below 256 KiB, oldest first/newest last, exclusive numeric `before` cursor, `more`); `web.session` on the web edge only, answering `{createdAt, lastUsedAt, expiresAt}` of the asking browser's own cookie session (no selector, no id, no cookie; expiry 30 days after creation); `session.launch` carrying any `cwd` field from the web edge refused with `cli-neovim-only` (`session.launch lives in the CLI and Neovim: sets a launch directory`), a web launch without it starting in the project root, the CLI keeping `--cwd`.
  - T-1147: `session.list` gains an additive `rows` field (the snapshot's merged `SessionRow` projection); `{archived: true}` returns only archived rows; the compatibility fields (`processes`, `archived`, `pendingStops`, `adapters`, `coordinator`) are unchanged; the web edge allows the read; `SessionListRows` in `shared/wire`.
  - T-1132, the Sessions area: groups Yours (live Aides), Waiting (approval and human waits), Busy, Idle and Stopped, each a `Fold` with its count, the header counts and the archive toggle (`Archive <n>`, `Show archived sessions (A)`); folds remembered in `cland.ui.sessions.v1` with no hub request; Stopped lists the latest 20, newest first, with `<n> archived`; `A` or the toggle reads `session.list {archived: true}` once and shows its `rows` (never a browser-side merge of processes and presence); a row shows glyph, name, role in its role colour, harness, model, account, item (claim or latest verifier hold with its role and `+N`; a requested item muted until a hold exists), state with its age and usage (cost, else tokens); `j`/`↓` and `k`/`↑` move the selection by physical code; the selected row unfolds in place with its pending approval command in full or the topic of its human ask; `gs` from an item lands on its session's row; no Attach anywhere in the area; `?` in Sessions lists `Next session`, `Previous session` and `Show archived sessions`.
- Affected regression: the Web files of the shell, palette, key contexts, folds, connection, Items tree and card (T-1130 and T-1132 changed `connection.ts`, `AreaSlot.tsx`, `Shell.tsx`, `web/test/harness.ts`, `key-contexts.test.ts` and `palette.test.ts`); the hub's snapshot, authority and inbox-workload tests (T-1131 and T-1147 changed `core.ts`, `dispatch.ts`, `store.ts`, `web-auth.ts`, `web-authority.ts`, `web-edge.ts`, `adapters/sessions.ts`, `adapters/requests.ts`); the typecheck with wire conformance, colour, contrast and hooks guards; the tier classifications.

Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

Criteria map (the stage verdict carries no item marks; this tells the run which check proves what):

| criterion | proven by |
| --- | --- |
| T-1130 C1 (own modules in pane, page and drawer; other areas as before) | E418S1-06, E418S1-07, E418S1-18 |
| T-1130 C2 (pushed queue, account, artifact frames; no list rereads) | E418S1-02, E418S1-06, E418S1-19 |
| T-1130 C3 (hub restart replaces Sessions and Accounts without reload) | E418S1-06, E418S1-26 |
| T-1130 C4 (README area modules and state) | E418S1-11 |
| T-1131 C1 (`session.history` both directions, bounded, paged; own `history` unchanged) | E418S1-03, E418S1-21, E418S1-22 |
| T-1131 C2 (`web.session` own record only) | E418S1-03, E418S1-23 |
| T-1131 C3 (web launch `cwd` refused; root launch) | E418S1-03, E418S1-24 |
| T-1131 C4 (authority table classifies both requests; T1 refuses `cwd`) | E418S1-02, E418S1-24 |
| T-1131 C5 (hub README) | E418S1-11 |
| T-1147 C1 (archived `rows` equal the snapshot shape; legacy fields unchanged) | E418S1-04, E418S1-25 |
| T-1147 C2 (web edge allows the read; wire types and conformance) | E418S1-02, E418S1-09, E418S1-25 |
| T-1132 C1 (groups and counts in group and header) | E418S1-05, E418S1-13 |
| T-1132 C2 (Idle folded survives a reload; no hub request) | E418S1-05, E418S1-17 |
| T-1132 C3 (row facts, hold `+N`, requested muted) | E418S1-05, E418S1-14 |
| T-1132 C4 (selected waiting row shows its full command; no Attach) | E418S1-05, E418S1-13, E418S1-15 |
| T-1132 C5 (latest 20, archived count, `A` listed in `?`, archive rows) | E418S1-05, E418S1-16, E418S1-20 |
| T-1132 C6 (README Sessions section) | E418S1-11 |

Epic Definition-of-done mapping (no marks; the demo is a separate run): E-418 C1 (groups, counts, folds per client, P22 rows from merged sessions, no Attach) is exercised by E418S1-13 to E418S1-20; C8 (`?` for Sessions) partly by E418S1-16. Nothing else of the DoD is in this stage.

## Build

Use a clean detached worktree at dev at the SHA in the request (the full 40-hex SHA), created below. HEAD must equal that SHA and refs/heads/dev before and after running. All listed items must have merged onto dev: for every member that `task plan show E-418` lists in stage `seams and the session list`, `git log --first-parent --oneline --grep "Item: <id>" dev` prints exactly one commit. At writing T-1130 landed as `4e727545`, T-1147 as `de40ac3c`, T-1131 as `f090f9a1` and T-1132 as `10c984ac` (reported by the Coordinator; this brief's expectations for T-1132 were read from its branch head `5d017507` before it merged dev). A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester. Dev also carries work landed after these items that is outside this stage; it is not judged here. The brief names no commit or run id of its own on purpose: committing a brief changes the tested tree. Re-check every test name, label, count and docs string with grep at the tested build.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step (the setup below does; the clean-tree checks ignore that one entry). The browser is the suite's Chrome Headless Shell under `node_modules/playwright-core/.local-browsers`: each named Web test file starts and closes its own, and the QA rig starts one through the Web test harness (`web/test/harness.ts`, `webFixture`). No real browser and no other GUI process starts. The live hub is touched only by `quiet`, the Web harness's own read-only admission check and E418S1-00's plan read; no live-edge, rebuilt root bundle or hub restart is needed.

## Setup (once, before E418S1-00)

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree, runs `quiet`, the plan read and the rig commands, and records every check with `qa-record.sh`. **Every other command runs sealed** (rule 15) inside a subshell that sources `$Q/env.sh`: the full result of the shared credential filter `test-support/fixture-environment.ts` after the scratch overlays (its synthesized HOME, XDG, Git and account paths included), which drops every `CLAND_*`, `GIT_*`, `XDG_*`, provider and account variable while keeping `PATH`, `SHELL`, `TERM` and `TMPDIR`. Leave `TMPDIR` at the system default (on macOS `/var/folders/...`; never `/tmp`, T-1030). The scratch root lives under `/private/tmp/qa-e418s1-` (its realpath). Never the human's HOME, `~/.cland`, `~/.claude`, `~/.codex` or `~/.local/state`. Record the setup as part of E418S1-00.

The scratch project. The QA rig (`$Q/rig.test.mjs`, a `node --test` file) builds one sealed scratch project and hub through the Web harness (`webFixture`: `tempProject` under the system `TMPDIR`, `projectHub` with the in-process fake adapters, the production socket and web edge serving `$W/web/dist`, and a Headless Shell signed in through a minted link). It seeds, in this order: a config with a scratch `lock_path` and raised hygiene limits (the T2 test's own pattern); an account registry `qa-claude` (claude-code) and `qa-codex` (codex); three tasks (`QA first work`, `QA latest work`, `QA requested work`, ids I1, I2, I3 in `ready.json`); the sessions `qa-aide` (Aide, claude-code), `qa-wait` (implementer, claude-code), `qa-busy` (implementer, codex, account `qa-codex`), `qa-review` (reviewer, claude-code, model `opus`, account `qa-claude`), `qa-request` (reviewer, codex), `qa-idle` (implementer, codex); 43 codex sessions `stopped-00` … `stopped-42`, each launched and stopped in order, then `qa-stopped-aide` (Aide, claude-code) launched and stopped last; `stopped-00` … `stopped-20` archived (21 archived). In-process reviewer spokes join `qa-review` and `qa-request`; `qa-review` holds I1 and, 1.1 s later, I2; the human sends `review request <I3>` to `qa-request`; usage `$0.25` for `qa-review` and 1234 tokens (no cost) for `qa-request`; traffic for `session.history`: `qa-review` sends `qa-hist-a1` … `qa-hist-a3` to `qa-request` in a new topic `QA history`, then the human sends `qa-hist-h01` … `qa-hist-h52` to `qa-review` in General and 36 messages of 8000 characters (`qa-big-<n>:xxx…`) to `qa-request`; an artifact note `QA slot note`; last the states: `qa-wait` signalled `permission` with the long command below, `qa-busy` busy, `qa-review`, `qa-request` and `qa-idle` idle. It then writes `$Q/rig/ready` and keeps the hub and one signed-in page (1440×900) up, running the page steps and fixture operations it finds as command files, until `$Q/rig/stop` exists (or 45 min).

The waiting command (exact text): `printf 'QA waiting command: the whole pending command is shown in full, including its final argument' && echo END-OF-QA-COMMAND`.

In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<the full dev SHA from the request>
RUN=qa-s1-$(date +%F)-1                        # unique run id for E-418; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e418s1-$RUN           # the clean detached build
EV=$R/.cland/qa/E-418/$RUN                     # captures (qa-record.sh keeps its evidence here too)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
Q=$(cd "$(mktemp -d /tmp/qa-e418s1-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/qa-e418s1-…
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data" "$Q/xdg/cache" "$Q/rig/cmd" "$Q/cli-dir" "$Q/web-dir"
: > "$Q/pids"                                  # the fixture-owned process census
P=""                                           # the rig's scratch project; E418S1-12 sets it
holder() { (cd "$W" && node hub/bin/cland.ts verify queue --json) | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);console.log((v.holder?.session??v.holder?.kind??"none")+" waiters "+(v.waiters??[]).length)})'; }
quiet() { for i in $(seq 1 10); do h=$(holder) && case "$h" in "none "*) echo quiet; return 0;; esac; sleep 60; done; echo "BLOCKED: the verify slot is not free after 10 minutes: ${h:-queue read failed}"; return 1; }
# nt <id> <test files…>: named test files from $W, sealed, one file at a time, TAP output, after quiet; the log is $EV/<id>.log
nt() { id=$1; shift; quiet || return 1; ( . "$Q/env.sh"; cd "$W" && node --test --test-reporter=tap --test-concurrency=1 "$@" > "$EV/$id.log" 2>&1; echo "exit $?" >> "$EV/$id.log" ); tail -n 1 "$EV/$id.log"; grep -E '^# (tests|pass|fail|cancelled|skipped|todo) ' "$EV/$id.log"; grep -E '^ *not ok|# SKIP' "$EV/$id.log" | head -20; }
# oks <id>: the names on the passing (sub)test lines of $EV/<id>.log
oks() { grep -E '^ *ok [0-9]+ - ' "$EV/$1.log" | sed -E 's/^ *ok [0-9]+ - //'; }
# census <id>: the number of Web fixture census lines, then how many of them do not end cleanly
census() { grep -c -F 'Web fixture census' "$EV/$1.log"; grep -F 'Web fixture census' "$EV/$1.log" | grep -c -v 'after 0; scratch hub stopped'; }
# seen <file> <text> [polls]: wait (0.5 s per poll, default 600 = 300 s) for a literal text in a file
seen() { n=${3:-600}; for i in $(seq 1 "$n"); do grep -q -F -- "$2" "$1" 2>/dev/null && return 0; sleep 0.5; done; echo "timeout waiting for $2 in $1"; return 1; }
# alive <pidfile>: the process named in the file still runs
alive() { [ -s "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null; }
# rc <name> <command JSON>: hand one command to the rig and wait for its log line; on a timeout say whether the rig still runs
rc() { printf '%s\n' "$2" > "$Q/rig/cmd/$1.tmp" && mv "$Q/rig/cmd/$1.tmp" "$Q/rig/cmd/$1.json" && { seen "$Q/rig/log.jsonl" "\"n\":\"$1.json\"" || { alive "$Q/rig.pid" && echo "rig alive" || echo "rig NOT alive: see $EV/rig.log"; return 1; }; }; }
# fact <name> <check id>: the rig's log line for that command (ok, facts or error), saved as $EV/<check id>.json
fact() { node -e 'const [f,n]=process.argv.slice(1);const l=require("fs").readFileSync(f,"utf8").split("\n").filter(Boolean).map(x=>JSON.parse(x)).find(x=>x.n===n);console.log(JSON.stringify(l,null,1))' "$Q/rig/log.jsonl" "$1.json" | tee "$EV/$2.json"; }
```

The sealed environment. Apply the full `fixtureEnvironment` result after the scratch overlays; do not merely unset keys absent from it. Remove the broader credential prefixes last (including `GH_PAGER` and the fixture's synthetic `CLAND_EXECUTOR_STATE`). The generated shell first unsets dropped inherited names and then exports every retained value; never print or post those exports.

```sh
node --input-type=module - "$W/test-support/fixture-environment.ts" "$Q" "$W" > "$Q/env.sh" <<'JS'
const [m,root,worktree]=process.argv.slice(2);
const {fixtureEnvironment}=await import(m);
const env=fixtureEnvironment(root,process.env,{
  XDG_CONFIG_HOME: `${root}/xdg/config`, XDG_STATE_HOME: `${root}/xdg/state`,
  XDG_DATA_HOME: `${root}/xdg/data`, XDG_CACHE_HOME: `${root}/xdg/cache`,
  GIT_AUTHOR_NAME: 'qa', GIT_AUTHOR_EMAIL: 'qa@example.invalid',
  GIT_COMMITTER_NAME: 'qa', GIT_COMMITTER_EMAIL: 'qa@example.invalid',
  QA_W: worktree, QA_Q: root,
});
for(const k of Object.keys(env))if(/^(CLAND_|DIGITALOCEAN_|ANTHROPIC_|OPENAI_|GH_|GITHUB_)/.test(k))delete env[k];
const quote=value=>"'"+value.replaceAll("'", "'\\''")+"'";
for(const k of Object.keys(process.env).sort())if(!(k in env)&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(k))console.log(`unset ${k}`);
for(const [k,v] of Object.entries(env))if(/^[A-Za-z_][A-Za-z0-9_]*$/.test(k))console.log(`export ${k}=${quote(v)}`);
JS
cat >> "$Q/env.sh" <<'ENV'
cland() { node "$QA_W/hub/bin/cland.ts" "$@"; }
fc() { node "$QA_Q/fc.cjs" "$@"; }
wcl() { node "$QA_Q/wc.mjs" "$PWD"; }
q() { node "$QA_Q/q.cjs" "$@"; }
ENV
: > "$Q/home/.gitconfig"
grep -c '^unset ' "$Q/env.sh"; ( . "$Q/env.sh"; prefix_count=$(env | cut -d= -f1 | grep -c -E '^(CLAND_|DIGITALOCEAN_|ANTHROPIC_|OPENAI_|GH_|GITHUB_)'); echo "$prefix_count"; test "$prefix_count" -eq 0 ) || echo "BLOCKED: credential-prefix names remain in the sealed environment"   # 0 before any scratch process starts
```

The helpers. `bg.cjs` starts a long-lived helper detached (a runner that ends a row's process group when the row returns cannot end it; never start one with `&`); `fc.cjs` is a frame client on the rig hub's Unix socket as the local human UI; `wc.mjs` is a cookie client on the rig hub's web edge (mints its own sign-in link on the Unix socket, no browser); `q.cjs` reads captures; `rig.test.mjs` is the rig.

```sh
cat > "$Q/bg.cjs" <<'JS'
'use strict';
// node "$QA_Q/bg.cjs" <pidfile> <out> <stdin file | -> <command> [args…]: starts the command detached, as the leader of a
// session and process group of its own. Stdout to <out>, stderr to <out>.err. Writes the pid to <pidfile> and $QA_Q/pids.
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const [pidfile, out, input, cmd, ...args] = process.argv.slice(2);
const child = spawn(cmd, args, { detached: true, stdio: [input === '-' ? 'ignore' : fs.openSync(input, 'r'), fs.openSync(out, 'a'), fs.openSync(`${out}.err`, 'a')] });
fs.writeFileSync(pidfile, `${child.pid}\n`);
if (process.env.QA_Q) fs.appendFileSync(`${process.env.QA_Q}/pids`, `${child.pid}\n`);
console.log(`started ${child.pid}`);
child.unref();
process.exit(0);
JS
cat > "$Q/fc.cjs" <<'JS'
'use strict';
// node "$QA_Q/fc.cjs" ['<features JSON array>'] < frames.jsonl   (sealed, in the rig's project directory)
// The local human UI on ./.cland/hub.json's Unix socket (the secret is never printed). Waits for snapshot.end when
// "snapshot" is negotiated, then sends each stdin frame (ids q1, q2, … when missing) and waits up to 20 s for its
// result. Prints every received frame, one JSON line each, with {"type":"qa-send","frame"} before each request and
// {"type":"qa-end"} last.
const fs = require('node:fs');
const net = require('node:net');
const features = process.argv[2] ? JSON.parse(process.argv[2]) : [];
const input = fs.readFileSync(0, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
const d = JSON.parse(fs.readFileSync('.cland/hub.json', 'utf8'));
if (process.env.QA_Q) fs.appendFileSync(`${process.env.QA_Q}/pids`, `${process.pid}\n`);
const frames = []; let waiters = []; let next = 0;
const emit = f => { frames.push(f); for (const w of [...waiters]) if (w.test(f)) { waiters = waiters.filter(x => x !== w); w.resolve(f); } };
const waitFor = (test, ms) => { const hit = frames.find(test); if (hit) return Promise.resolve(hit); return new Promise((resolve, reject) => { const w = { test, resolve: f => { clearTimeout(timer); resolve(f); } }; const timer = setTimeout(() => { waiters = waiters.filter(x => x !== w); reject(new Error('timeout')); }, ms); waiters.push(w); }); };
const socket = net.createConnection(d.socket);
let buffer = '';
socket.setEncoding('utf8');
socket.on('data', chunk => { buffer += chunk; for (let nl = buffer.indexOf('\n'); nl >= 0; nl = buffer.indexOf('\n')) { const line = buffer.slice(0, nl).trim(); buffer = buffer.slice(nl + 1); if (line) emit(JSON.parse(line)); } });
socket.on('close', () => emit({ type: 'qa-closed' }));
(async () => {
  try {
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); });
    socket.write(`${JSON.stringify({ type: 'hello', protocol: 2, client: 'ui', secret: d.secret, features })}\n`);
    const hello = await waitFor(f => ['welcome', 'error', 'qa-closed'].includes(f.type), 20000);
    if (hello.type === 'welcome' && features.includes('snapshot')) await waitFor(f => ['snapshot.end', 'snapshot.refused', 'qa-closed'].includes(f.type), 60000);
    for (const frame of hello.type === 'welcome' ? input : []) {
      const sent = frame.id === undefined ? { ...frame, id: `q${++next}` } : frame;
      emit({ type: 'qa-send', frame: sent });
      socket.write(`${JSON.stringify(sent)}\n`);
      try { await waitFor(f => (f.type === 'result' && f.id === sent.id) || f.type === 'qa-closed', 20000); } catch { emit({ type: 'qa-timeout', id: sent.id }); }
    }
    await new Promise(r => setTimeout(r, 300));
  } catch (error) { emit({ type: 'qa-error', message: error.message }); process.exitCode = 1; }
  emit({ type: 'qa-end' });
  process.stdout.write(frames.map(f => JSON.stringify(f)).join('\n') + '\n');
  socket.destroy();
  setTimeout(() => process.exit(), 300).unref();
})();
JS
cat > "$Q/wc.mjs" <<'JS'
// node "$QA_Q/wc.mjs" <rig project> < frames.jsonl   (sealed): a browser's cookie session without a browser. Refuses any
// directory but the rig's own project. Mints a sign-in link on the Unix socket (web.link, as the local human), follows it
// once for the cookie, opens /ws with that cookie and origin, says hello as client "pretend-session", sends each stdin
// frame (ids w1, w2, … when missing) and waits up to 20 s for its result. Prints every frame it receives, one JSON line
// each, {"type":"qa-send","frame"} before each request, {"type":"qa-signed-in","origin"} and last
// {"type":"qa-leak","secret":bool,"cookie":bool} (whether the hub secret or this cookie's value appear in any received
// frame) and {"type":"qa-end"}. The link, the cookie and the secret are never printed.
import { createRequire } from 'node:module';
import { appendFileSync, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { get } from 'node:http';
const [root] = process.argv.slice(2);
const Q = process.env.QA_Q;
const ready = JSON.parse(readFileSync(`${Q}/rig/ready`, 'utf8'));
if (!root || root !== ready.root) { console.log(JSON.stringify({ refused: 'not the rig project' })); process.exit(2); }
appendFileSync(`${Q}/pids`, `${process.pid}\n`);
const { WebSocket } = createRequire(`${process.env.QA_W}/hub/package.json`)('ws');
const d = JSON.parse(readFileSync(`${root}/.cland/hub.json`, 'utf8'));
const link = await new Promise((resolve, reject) => {
  const s = createConnection(d.socket); let buf = '';
  s.setEncoding('utf8'); s.on('error', reject);
  s.on('connect', () => s.write(`${JSON.stringify({ type: 'hello', protocol: 2, client: 'ui', secret: d.secret })}\n`));
  s.on('data', chunk => { buf += chunk; for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) { const f = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
    if (f.type === 'welcome') s.write(`${JSON.stringify({ type: 'web.link', id: 'link' })}\n`);
    else if (f.type === 'error') { s.destroy(); reject(new Error(`hello refused: ${f.error ?? f.type}`)); }
    else if (f.type === 'result' && f.id === 'link') { s.destroy(); if (f.ok) resolve(f.value.url); else reject(new Error(f.error)); } } });
});
const cookie = await new Promise((resolve, reject) => {
  const req = get(link, { agent: false }, response => { response.resume(); response.on('end', () => { const c = response.headers['set-cookie']?.[0]?.split(';')[0]; if (c) resolve(c); else reject(new Error('the sign-in link set no cookie')); }); response.on('error', reject); });
  req.setTimeout(5000, () => req.destroy(new Error('sign-in timed out'))); req.on('error', reject);
});
const origin = new URL(link).origin;
const ws = new WebSocket(`${origin.replace('http:', 'ws:')}/ws`, { origin, headers: { Cookie: cookie } });
const frames = []; let waiters = [];
const emit = f => { frames.push(f); console.log(JSON.stringify(f)); for (const w of [...waiters]) if (w.test(f)) { waiters = waiters.filter(x => x !== w); w.resolve(f); } };
const waitFor = (test, ms) => new Promise((resolve, reject) => { const hit = frames.find(test); if (hit) return resolve(hit); const w = { test, resolve: f => { clearTimeout(timer); resolve(f); } }; const timer = setTimeout(() => { waiters = waiters.filter(x => x !== w); reject(new Error('timeout')); }, ms); waiters.push(w); });
ws.on('message', data => { for (const line of String(data).split('\n')) if (line.trim()) emit(JSON.parse(line)); });
await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
console.log(JSON.stringify({ type: 'qa-signed-in', origin }));
ws.send(JSON.stringify({ type: 'hello', protocol: 2, client: 'pretend-session' }));
await waitFor(f => f.type === 'welcome' || f.type === 'error', 20000);
let n = 0;
for (const line of readFileSync(0, 'utf8').split('\n').filter(l => l.trim())) {
  const frame = JSON.parse(line);
  if (frame.id === undefined) frame.id = `w${++n}`;
  console.log(JSON.stringify({ type: 'qa-send', frame }));
  ws.send(JSON.stringify(frame));
  try { await waitFor(f => f.type === 'result' && f.id === frame.id, 20000); } catch { console.log(JSON.stringify({ type: 'qa-timeout', id: frame.id })); }
}
const all = JSON.stringify(frames);
console.log(JSON.stringify({ type: 'qa-leak', secret: all.includes(d.secret), cookie: all.includes(cookie.slice(cookie.indexOf('=') + 1)) }));
console.log(JSON.stringify({ type: 'qa-end' }));
ws.terminate();
process.exit(0);
JS
cat > "$Q/q.cjs" <<'JS'
'use strict';
// node "$QA_Q/q.cjs" <capture> '<expression>' [args…]: evaluates the expression and prints the value as JSON. In scope:
// F (the capture's JSON lines), V (the capture parsed as one JSON value, when it is one), A (extra args), fs,
// L(path) (another capture's lines), res(id, frames?) (a result frame), snap(domain) (a snapshot frame),
// canon(value) (JSON with sorted keys), pg(id, frames?) (a session.history page summary).
const fs = require('node:fs');
const [file, expr, ...A] = process.argv.slice(2);
const text = fs.readFileSync(file, 'utf8');
let V; try { V = JSON.parse(text); } catch {}
const L = p => fs.readFileSync(p, 'utf8').split('\n').filter(l => l.trim()).flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } });
const F = V === undefined ? L(file) : [];
const res = (id, G = F) => G.find(f => f.type === 'result' && f.id === id);
const snap = d => F.find(f => f.type === 'snapshot' && f.domain === d);
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(key => [key, x[key]])) : x);
const pg = (id, G = F) => { const r = res(id, G); if (!r) return null; if (!r.ok) return { ok: false, code: r.code ?? null, error: r.error };
  const m = r.value.messages; const t = x => String(x.text);
  return { ok: true, keys: Object.keys(r.value), n: m.length, more: r.value.more, beforeIsFirst: m.length ? r.value.before === m[0].seq : r.value.before === undefined,
    ascending: m.every((x, i) => !i || m[i - 1].seq < x.seq), hist: m.map(t).filter(x => x.startsWith('qa-hist-')), big: m.filter(x => t(x).startsWith('qa-big-')).map(x => t(x).length),
    other: m.filter(x => !t(x).startsWith('qa-hist-') && !t(x).startsWith('qa-big-')).map(x => `${x.kind ?? x.fromKind ?? '?'}: ${t(x).slice(0, 40)}`),
    ids: m.map(x => x.id), firstSeq: m[0]?.seq ?? null, lastSeq: m.at(-1)?.seq ?? null, before: r.value.before ?? null, bytes: Buffer.byteLength(JSON.stringify(r)) }; };
console.log(JSON.stringify(eval(expr)));
JS
```

The rig. It prints nothing it judges; every command's facts go to `$Q/rig/log.jsonl` as `{"n","op","ok","facts"|"error","at"}`. A command `{"op":…,"shot":"<png path>"}` also saves a full-page screenshot.

```sh
cat > "$Q/rig.test.mjs" <<'JS'
// node --test "$QA_Q/rig.test.mjs" (sealed, cwd $QA_W): the QA rig of E-418 stage "seams and the session list".
import test from 'node:test';
import { appendFileSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const W = process.env.QA_W, Q = process.env.QA_Q, dir = `${Q}/rig`;
const { webFixture } = await import(`${W}/web/test/harness.ts`);
const { connectUi, inProcessSpoke } = await import(`${W}/hub/test/harness.ts`);
const { defaultConfig, renderConfig } = await import(`${W}/hub/src/init/config.ts`);
const COMMAND = "printf 'QA waiting command: the whole pending command is shown in full, including its final argument' && echo END-OF-QA-COMMAND";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const log = row => appendFileSync(`${dir}/log.jsonl`, `${JSON.stringify({ ...row, at: new Date().toISOString() })}\n`);
const must = async (promise, what) => { const r = await promise; if (!r?.ok) throw new Error(`${what}: ${r?.error ?? 'no result'}`); return r.value; };
const pad = n => String(n).padStart(2, '0');
test('QA rig, E-418 stage seams and the session list', { timeout: 50 * 60_000 }, async t => {
  appendFileSync(`${Q}/pids`, `${process.pid}\n`);
  const fixture = await webFixture(t, { prepare: async root => {
    await writeFile(join(process.env.XDG_CONFIG_HOME, 'cland/accounts.toml'), `[accounts.qa-claude]\nharness = "claude-code"\n[accounts.qa-codex]\nharness = "codex"\nhome = "${root}/qa-codex"\n`);
    await mkdir(join(root, 'qa-codex'), { recursive: true }); // the registry refuses a launch on an account whose home does not exist (run 1, E418S1-12)
    const config = defaultConfig('QA E-418 stage 1');
    config.verification.lockPath = join(root, 'suite.lock');
    config.hygiene.loopBreaker.max = 200; config.hygiene.rateLimit.max = 200;
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  } });
  const root = fixture.root;
  let ui = await connectUi(t, fixture.hub.discovery);
  const req = (frame, what = frame.type) => must(ui.request(frame), what);
  const items = [];
  for (const title of ['QA first work', 'QA latest work', 'QA requested work']) items.push((await req({ type: 'task.create', title, size: 'S' })).item.id);
  const launch = async (name, extra) => (await req({ type: 'session.launch', name, ...extra }, `launch ${name}`)).process;
  await launch('qa-aide', { role: 'aide', harness: 'claude-code' });
  await launch('qa-wait', { role: 'implementer', harness: 'claude-code' });
  await launch('qa-busy', { role: 'implementer', harness: 'codex', account: 'qa-codex' });
  const review = await launch('qa-review', { role: 'reviewer', harness: 'claude-code', model: 'opus', account: 'qa-claude' });
  const request = await launch('qa-request', { role: 'reviewer', harness: 'codex' });
  await launch('qa-idle', { role: 'implementer', harness: 'codex' });
  for (let n = 0; n < 43; n++) { await launch(`stopped-${pad(n)}`, { harness: 'codex' }); await sleep(20); await req({ type: 'session.stop', session: `stopped-${pad(n)}` }); }
  await launch('qa-stopped-aide', { role: 'aide', harness: 'claude-code' }); await sleep(20);
  await req({ type: 'session.stop', session: 'qa-stopped-aide' });
  for (let n = 0; n <= 20; n++) await req({ type: 'session.archive', session: `stopped-${pad(n)}` });
  const spokes = {};
  for (const p of [review, request]) { spokes[p.name] = await inProcessSpoke(t, { discover: true, cwd: root, name: p.name, sessionId: p.sessionId, role: 'reviewer' }); await spokes[p.name].waitForPresence([p.name]); }
  await must(spokes['qa-review'].call('task.hold', { id: items[0] }), 'hold I1');
  await sleep(1100);
  await must(spokes['qa-review'].call('task.hold', { id: items[1] }), 'hold I2');
  await req({ type: 'topic.send', topic: 'general', to: ['qa-request'], text: `review request ${items[2]}` });
  const usage = (tokens, cost) => ({ total: { inputTokens: tokens - 23, outputTokens: 23, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: tokens, ...(cost ? { cost } : {}) } });
  fixture.fakes['claude-code'].feedUsage('qa-review', usage(123, 0.25));
  fixture.fakes.codex.feedUsage('qa-request', usage(1234));
  const topic = (await req({ type: 'topic.create', title: 'QA history' })).topic.id;
  for (const n of [1, 2, 3]) await must(spokes['qa-review'].call('send', { to: 'qa-request', topic, text: `qa-hist-a${n}` }), 'agent send');
  for (let n = 1; n <= 52; n++) await req({ type: 'topic.send', topic: 'general', to: ['qa-review'], text: `qa-hist-h${pad(n)}` });
  const big = [];
  for (let n = 0; n < 36; n++) big.push((await req({ type: 'topic.send', topic: 'general', to: ['qa-request'], text: `qa-big-${n}:`.padEnd(8000, 'x') })).message.id);
  const note = (await req({ type: 'artifact.create', kind: 'note', title: 'QA slot note', topic: 'general', content: 'A note' })).artifact.id;
  await req({ type: 'session.signal', session: 'qa-wait', event: 'permission', payload: { tool_name: 'Bash', approvalCommand: COMMAND } });
  fixture.fakes.codex.busy('qa-busy');
  fixture.fakes['claude-code'].idle('qa-review'); fixture.fakes.codex.idle('qa-request'); fixture.fakes.codex.idle('qa-idle');
  await sleep(1000);
  const sent = [], received = []; let navigations = 0;
  await fixture.pageCase(t, async page => {
    const live = (want, ms) => page.waitForFunction(w => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === w, want, { timeout: ms });
    const area = async name => { await page.getByRole('button', { name, exact: true }).click(); await page.locator(`[data-area-module="${name}"][data-area-surface="pane"]`).waitFor({ timeout: 10000 }); };
    const region = name => page.getByRole('region', { name, exact: true });
    const token = name => page.evaluate(v => { const p = document.createElement('span'); p.style.color = `var(${v})`; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; }, name);
    const selected = () => page.evaluate(() => document.querySelector('[data-session-slot="groups"] [aria-pressed="true"]')?.getAttribute('data-object-id') ?? null);
    const groupsNow = () => page.evaluate(() => {
      const out = { connection: document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim(), header: [...document.querySelectorAll('[data-session-count]')].map(n => n.textContent),
        archiveButton: document.querySelector('[aria-label="Show archived sessions"]')?.textContent, archivePressed: document.querySelector('[aria-label="Show archived sessions"]')?.getAttribute('aria-pressed'), groups: {} };
      for (const s of document.querySelectorAll('[data-session-slot="groups"] > section')) out.groups[s.getAttribute('aria-label')] = { heading: s.querySelector('header')?.textContent, rows: [...s.querySelectorAll('[data-object-id]')].map(n => n.getAttribute('data-object-id')) };
      out.attach = [...document.querySelectorAll('button, a, [role="button"], [role="menuitem"]')].filter(n => /attach/i.test(`${n.textContent} ${n.getAttribute('aria-label') ?? ''} ${n.getAttribute('title') ?? ''}`)).length;
      return out;
    });
    const ops = {
      async groups() { await area('Sessions'); await page.locator('[data-object-id="qa-wait"]').waitFor({ timeout: 10000 }); await live('Live', 10000); return { items, ...await groupsNow() }; },
      async rows() {
        await area('Sessions');
        const facts = { tokens: { reviewer: await token('--role-reviewer'), aide: await token('--role-aide'), implementer: await token('--role-implementer'), muted: await token('--muted'), active: await token('--active') } };
        for (const name of ['qa-aide', 'qa-wait', 'qa-busy', 'qa-review', 'qa-request', 'qa-idle', 'qa-stopped-aide']) {
          facts[name] = await page.locator(`[data-object-id="${name}"]`).evaluate(n => { const c = [...n.children]; const color = e => e ? getComputedStyle(e).color : null;
            return { cells: c.map(e => e.textContent), glyphLabel: c[0]?.getAttribute('aria-label'), roleAttr: c[2]?.getAttribute('data-session-role'), roleColor: color(c[2]), metaTitle: c[3]?.getAttribute('title'),
              item: c[4]?.textContent, itemRequested: c[4]?.getAttribute('data-item-requested'), itemTitle: c[4]?.getAttribute('title'), itemColor: color(c[4]), stateColor: color(c[5]), age: n.querySelector('[data-session-age]')?.textContent }; });
        }
        const before = await page.locator('[data-object-id="qa-idle"] [data-session-age]').textContent();
        await sleep(3000);
        facts.idleAge = [before, await page.locator('[data-object-id="qa-idle"] [data-session-age]').textContent()];
        return facts;
      },
      async select() {
        await area('Sessions');
        const wait = page.locator('[data-object-id="qa-wait"]');
        await wait.click();
        const detail = page.locator('[data-session-detail="qa-wait"]');
        await detail.waitFor({ timeout: 5000 });
        const out = { pressed: await wait.getAttribute('aria-pressed'), code: await detail.locator('code').textContent(), codeEqualsCommand: (await detail.locator('code').textContent()) === COMMAND, steps: [] };
        for (const key of ['j', 'ArrowDown', 'k', 'ArrowUp']) { await page.keyboard.press(key); await sleep(300);
          out.steps.push({ key, selected: await selected(), details: await page.locator('[data-session-detail]').evaluateAll(ns => ns.map(n => n.getAttribute('data-session-detail'))) }); }
        await wait.evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', key: 'о', bubbles: true, cancelable: true })));
        await sleep(300);
        out.cyrillicJ = await selected();
        await page.locator('[data-object-id="qa-wait"]').click();
        return out;
      },
      async help() {
        await area('Sessions');
        await page.locator('[data-object-id="qa-idle"]').click();
        await page.keyboard.press('Shift+/');
        const dialog = page.getByRole('dialog', { name: 'Sessions keys', exact: true });
        await dialog.waitFor({ timeout: 5000 });
        const rows = await dialog.locator('[data-key-action]').evaluateAll(ns => ns.map(n => `${n.querySelector('dt')?.textContent}=${n.querySelector('dd')?.textContent}`));
        const kbd = await dialog.locator('kbd').count();
        const last = dialog.locator('[data-key-action]').last();
        await last.scrollIntoViewIfNeeded();
        const a = await last.boundingBox(), b = await dialog.boundingBox();
        const lastVisible = !!a && !!b && a.y >= b.y && a.y + a.height <= b.y + b.height;
        await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden', timeout: 5000 });
        return { rows, kbd, lastVisible };
      },
      async fold() {
        await area('Sessions');
        sent.length = 0;
        await page.getByRole('button', { name: 'Fold Idle', exact: true }).click();
        await sleep(500);
        const out = { folded: { expanded: await page.getByRole('button', { name: 'Fold Idle', exact: true }).getAttribute('aria-expanded'), idleVisible: await page.locator('[data-object-id="qa-idle"]').isVisible(), sent: sent.map(f => f.type), storage: await page.evaluate(() => localStorage.getItem('cland.ui.sessions.v1')) } };
        await page.reload({ waitUntil: 'load' });
        await live('Live', 15000);
        await area('Sessions');
        await page.getByRole('button', { name: 'Fold Idle', exact: true }).waitFor({ timeout: 10000 });
        out.reloaded = { expanded: await page.getByRole('button', { name: 'Fold Idle', exact: true }).getAttribute('aria-expanded'), idleVisible: await page.locator('[data-object-id="qa-idle"]').isVisible(), header: (await groupsNow()).header };
        await page.getByRole('button', { name: 'Fold Idle', exact: true }).click();
        out.restored = { expanded: await page.getByRole('button', { name: 'Fold Idle', exact: true }).getAttribute('aria-expanded') };
        return out;
      },
      async slots() {
        const out = {};
        for (const [name, id] of [['Sessions', 'qa-idle'], ['Accounts', 'claude-code/qa-claude'], ['Artifacts', note]]) {
          await area(name);
          const pane = page.locator(`[data-pane="primary"] [data-area-module="${name}"][data-area-surface="pane"]`);
          const row = pane.locator(`[data-object-id="${id}"]`);
          await row.click();
          const drawer = page.getByRole('complementary', { name: 'Drawer', exact: true });
          await drawer.locator(`[data-area-module="${name}"][data-area-surface="drawer"]`).waitFor({ timeout: 5000 });
          await row.press('Meta+Enter');
          const other = page.locator('[data-pane="secondary"]');
          const detail = other.locator(`[data-area-module="${name}"][data-area-surface="page"]`);
          await detail.waitFor({ timeout: 5000 });
          out[name] = { paneContext: await pane.getAttribute('data-key-context'), drawerModule: true, pageHasId: (await detail.textContent())?.includes(id), drawerDuringSplit: await drawer.count() };
          await other.getByRole('button', { name: 'Close', exact: true }).click();
          await other.waitFor({ state: 'detached', timeout: 5000 });
        }
        if (Object.keys(out).length === 3) out.sessionSlots = await page.evaluate(() => [...document.querySelectorAll('[data-session-slot]')].map(n => n.getAttribute('data-session-slot')));
        for (const name of ['Inbox', 'Topics', 'Events']) { await page.getByRole('button', { name, exact: true }).click(); await page.getByRole('list', { name: `${name} objects`, exact: true }).waitFor({ timeout: 5000 }); out[name] = 'list'; }
        await page.getByRole('button', { name: 'Items', exact: true }).click();
        await page.getByRole('tree', { name: 'Items tree' }).waitFor({ timeout: 5000 }); out.Items = 'tree';
        await page.getByRole('button', { name: 'Sessions', exact: true }).click();
        out.sessionSlots ??= await page.evaluate(() => [...document.querySelectorAll('[data-session-slot]')].map(n => n.getAttribute('data-session-slot')));
        return out;
      },
      async push() {
        await area('Sessions');
        sent.length = 0; const r0 = received.length;
        const fresh = () => received.slice(r0);
        const until = async (test, what) => { for (let i = 0; i < 50; i++) { if (fresh().some(test)) return true; await sleep(100); } throw new Error(`no ${what} frame within 5 s`); };
        const local = await connectUi(t, fixture.hub.discovery, 'cli');
        await must(local.request({ type: 'suite.slot', mode: 'hub-only', cwd: root, head: 'qa-head', pid: process.pid, token: 'qa-queue' }), 'suite.slot');
        await until(f => f.type === 'verification.queue' && f.queue?.holder?.kind === 'hand run', 'queue');
        fixture.fakes.codex.feedUsage('qa-busy', { rateLimits: { primary: { usedPercent: 81, resetsAt: 4094678400, windowDurationMins: 300 } }, rateLimitsAt: new Date().toISOString() });
        await until(f => f.type === 'account' && f.account?.windows?.some(w => w.usedPercent === 81), 'account');
        const pushed = (await req({ type: 'artifact.create', kind: 'note', title: 'QA pushed note', topic: 'general', content: 'Push' })).artifact.id;
        await until(f => f.type === 'artifact' && JSON.stringify(f).includes(pushed), 'artifact');
        await area('Artifacts');
        await page.locator(`[data-object-id="${pushed}"]`).waitFor({ timeout: 5000 });
        fixture.fakes.codex.idle('qa-busy');
        await area('Sessions');
        await region('Idle').locator('[data-object-id="qa-busy"]').waitFor({ timeout: 10000 });
        await local.close();
        return { queue: fresh().filter(f => f.type === 'verification.queue').map(f => f.queue?.holder?.kind ?? null), account: fresh().filter(f => f.type === 'account').map(f => [f.account?.name, f.account?.harness, (f.account?.windows ?? []).map(w => w.usedPercent)]),
          artifact: fresh().filter(f => f.type === 'artifact').length, pushed, artifactRow: await page.locator(`[data-object-id="${pushed}"]`).count(), rowFrames: fresh().filter(f => f.type === 'session.row').map(f => [f.row?.name ?? f.key, f.row?.state ?? null]),
          sentTypes: sent.map(f => f.type), lists: sent.filter(f => ['session.list', 'account.list', 'artifact.list'].includes(f.type)).map(f => f.type), ...await groupsNow() };
      },
      async archive() {
        await area('Sessions');
        sent.length = 0; const r0 = received.length;
        await page.locator('[data-object-id="qa-idle"]').click();
        await page.keyboard.press('Shift+a');
        await region('Archived').locator('[data-object-id="stopped-00"]').waitFor({ timeout: 10000 });
        await sleep(500);
        const reads = () => sent.filter(f => f.type === 'session.list' && f.archived === true);
        const reply = id => received.slice(r0).find(f => f.type === 'result' && f.id === id);
        const first = reply(reads()[0]?.id);
        const out = { on: { ...await groupsNow(), reads: reads().length, replyKeys: first ? Object.keys(first.value ?? {}) : null, replyRows: first?.value?.rows?.map(r => r.name) ?? null, replyArchived: first?.value?.archived ?? null, replyRowsArchived: first?.value?.rows?.every(r => r.archived === true) ?? null } };
        await req({ type: 'session.archive', session: 'stopped-21' });
        await region('Archived').locator('[data-object-id="stopped-21"]').waitFor({ timeout: 10000 });
        await sleep(500);
        out.more = { ...await groupsNow(), reads: reads().length };
        await page.getByRole('button', { name: 'Show archived sessions', exact: true }).click();
        await sleep(500);
        out.off = { archivedRegion: await region('Archived').count(), stopped00: await page.locator('[data-object-id="stopped-00"]').count(), pressed: await page.getByRole('button', { name: 'Show archived sessions', exact: true }).getAttribute('aria-pressed') };
        return out;
      },
      async ownhistory() { const own = await spokes['qa-review'].call('history', { limit: 1000 }); return { ok: own.ok, ids: (own.messages ?? []).map(m => m.id), last: (own.messages ?? []).at(-1)?.text ?? null }; },
      async restart() {
        for (const s of Object.values(spokes)) await s.close?.();
        await ui.close?.();
        await area('Sessions');
        const nav0 = navigations;
        const before = (await groupsNow()).groups;
        await fixture.hub.stop(); await fixture.hub.stopped;
        await live('Offline', 30000);
        const offline = { rows: await page.locator('[data-session-slot="groups"] [data-object-id]').count() };
        // Fixture setup while every writer is stopped, as T-1130's own test does: the new hub has a different inventory.
        const db = new DatabaseSync(join(root, '.cland/hub.db'));
        try { db.exec('delete from harness_processes'); } finally { db.close(); }
        await writeFile(join(process.env.XDG_CONFIG_HOME, 'cland/accounts.toml'), '[accounts.qa-new-account]\nharness = "codex"\n');
        await fixture.restartHub();
        ui = await connectUi(t, fixture.hub.discovery);
        await req({ type: 'session.launch', name: 'qa-new', harness: 'codex' });
        await live('Live', 60000);
        await page.locator('[data-object-id="qa-new"]').waitFor({ timeout: 30000 });
        const after = await groupsNow();
        await area('Accounts');
        await page.locator('[data-object-id="codex/qa-new-account"]').waitFor({ timeout: 30000 });
        const accounts = await page.locator('[data-pane="primary"] [data-object-id]').evaluateAll(ns => ns.map(n => n.getAttribute('data-object-id')));
        await area('Sessions');
        return { beforeRows: Object.values(before).flatMap(g => g.rows).length, offline, after, sessionRows: Object.values(after.groups).flatMap(g => g.rows), accounts, reloads: navigations - nav0 };
      },
    };
    const deadline = Date.now() + 45 * 60_000;
    writeFileSync(`${dir}/ready`, `${JSON.stringify({ root, pid: process.pid, items, topic, big, note, command: COMMAND })}\n`);
    while (!existsSync(`${dir}/stop`) && Date.now() < deadline) {
      for (const name of readdirSync(`${dir}/cmd`).filter(n => n.endsWith('.json')).sort()) {
        const path = `${dir}/cmd/${name}`;
        let c = {}, row;
        try {
          c = JSON.parse(readFileSync(path, 'utf8'));
          if (!ops[c.op]) throw new Error(`unknown op ${c.op}`);
          row = { n: name, op: c.op, ok: true, facts: await ops[c.op](c) };
        } catch (error) { row = { n: name, op: c.op ?? null, ok: false, error: String(error?.stack ?? error).slice(0, 3000) }; }
        if (c.shot) { try { await page.screenshot({ path: c.shot, fullPage: true }); } catch (error) { row.shotError = String(error); } }
        log(row); renameSync(path, `${path}.done`);
      }
      await sleep(200);
    }
  }, page => {
    page.on('websocket', socket => {
      socket.on('framesent', event => { try { sent.push(JSON.parse(String(event.payload))); } catch {} });
      socket.on('framereceived', event => { for (const line of String(event.payload).split('\n')) if (line.trim()) { try { received.push(JSON.parse(line)); } catch {} } });
    });
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
  });
});
JS
node --check "$Q/bg.cjs" && node --check "$Q/fc.cjs" && node --check "$Q/wc.mjs" && node --check "$Q/q.cjs" && node --check "$Q/rig.test.mjs" && echo "helpers parse"
```

The check functions. Paste the block once in QA's own shell. Each writes its captures under `$EV` and prints the facts its row judges.

```sh
k00() {
  git -C "$W" rev-parse HEAD refs/heads/dev; git -C "$W" status --porcelain | grep -v -x '?? node_modules' | wc -l
  (cd "$W" && node hub/bin/cland.ts task plan show E-418 --json) > "$EV/E418S1-00-plan.json"
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=v.stages.find(x=>x.name==="seams and the session list");console.log(JSON.stringify({stages: v.stages.map(x=>x.name), state: s?.state, qa: s?.qa, merged: s?.merged, total: s?.total, items: s?.items ?? s?.lanes}))' "$EV/E418S1-00-plan.json" | tee "$EV/E418S1-00-stage.txt"
  for i in T-1130 T-1131 T-1147 T-1132; do echo "== $i"; git -C "$W" log --first-parent --oneline --grep "Item: $i" dev; done
  ls "$W/web/test/sessions.test.ts" "$W/web/test/area-slots.test.ts" "$W/hub/test/web-area-state.test.ts" "$W/web/src/sessions/SessionRow.tsx" "$W/web/src/sessions/Sessions.module.css"
  grep -c -F "'session.history': true," "$W/hub/src/hub/web-authority.ts"; grep -c -F "'web.session': true," "$W/hub/src/hub/web-authority.ts"
  grep -c -F "Object.hasOwn(frame, 'cwd') ? 'sets a launch directory' : null" "$W/hub/src/hub/web-authority.ts"
  grep -c -F 'export type SessionListRows' "$W/shared/wire/index.ts"; grep -c -F "'Shift+KeyA': 'session-archive-toggle'" "$W/web/src/keymap.ts"
  echo "TMPDIR=$TMPDIR Q=$Q"
}
k09() {
  quiet || return 1
  ( . "$Q/env.sh"; cd "$W" && npm run typecheck > "$EV/E418S1-09.log" 2>&1; echo "typecheck exit $?"; node hub/test/lint-tiers.ts > "$EV/E418S1-09-tiers.log" 2>&1; echo "tiers exit $?" )
  grep -F -e 'web colours: token-only sources; colour fixtures passed' -e 'web tokens:' -e 'web hooks: conditional-hook fixture rejected by configured oxlint' "$EV/E418S1-09.log"
  grep -n -F -e '"web/test/sessions.test.ts": "Web"' -e '"web/test/area-slots.test.ts": "Web"' -e '"hub/test/web-area-state.test.ts": "T1"' -e '"hub/test/web-authority.test.ts": "T2"' -e '"hub/test/connection-snapshot.test.ts": "T2"' "$W/hub/test/tiers.json"
  grep -n -E 'SessionListRows|SessionHistory|WebSessionRequest|WebSessionResult' "$W/hub/test/wire-conformance.ts"
}
k10() {
  git -C "$W" grep -n -E "keydown|keyup|keypress|onKey(Down|Up|Press)" -- web/src
  git -C "$W" grep -n -E "localStorage|sessionStorage" -- web/src
  printf 'browser-side merge sources: '; git -C "$W" grep -n -E "presence|processes" -- web/src/sessions web/src/connection.ts | wc -l
  git -C "$W" grep -n -F "{ type: 'session.list', archived: true }" -- web/src
  git -C "$W" grep -n -E "#[0-9a-fA-F]{3,8}\b" -- web/src/sessions
  for c in $(for t in T-1130 T-1131 T-1147 T-1132; do git -C "$W" log --first-parent --format=%H --grep "Item: $t" dev; done); do git -C "$W" show --stat --format= "$c" -- package.json package-lock.json web/package.json hub/package.json; done
}
k11() {
  ( . "$Q/env.sh"; cd "$QA_W" || exit 1
    chk() { printf '%s present %s: %s\n' "$(grep -c -F -- "$2" "$1")" "$1" "$2"; }
    nochk() { printf '%s absent %s: %s\n' "$(grep -c -F -- "$2" "$1")" "$1" "$2"; }
    chk web/README.md '## Area modules and live state'
    chk web/README.md '| Sessions | `sessions` (complete merged rows by stable key)'
    chk web/README.md '## Sessions'
    chk web/README.md "Sessions reads the hub's merged rows from the snapshot and \`session.row\` deltas."
    chk web/README.md 'Live Aides belong to Yours; stopped Aides belong to Stopped.'
    chk web/README.md 'both approval and human waits. Stopped shows the latest 20, newest first, and'
    chk web/README.md "the archived count. Each fold uses the browser's \`cland.ui.sessions.v1\` record;"
    chk web/README.md 'folding sends no hub request.'
    chk web/README.md '| `A` | Show or hide archived sessions |'
    chk web/README.md 'presence in the browser. There is no Attach in Sessions.'
    chk web/README.md 'node --test web/test/sessions.test.ts'
    nochk web/README.md 'Sessions and Artifacts already declare their future keys and'
    chk hub/README.md 'The web-only human request `{type: "web.session", id}` returns'
    chk hub/README.md '`{createdAt, lastUsedAt, expiresAt}` for the cookie session authenticated at'
    chk hub/README.md '- `session.launch` carrying a `cwd` field, even an empty or malformed value;'
    chk hub/README.md "\`session.history\` reads the named session's sent messages and deliveries across"
    chk hub/README.md 'It defaults to 50 messages and clamps larger limits to 50.'
    chk hub/README.md '`{messages: [], more: false}`. Whole-message pages stay below 256 KiB, with the'
    chk hub/README.md '`session.list` adds the same `rows` projection alongside its unchanged compatibility fields.'
    chk hub/README.md '`{archived: true}` returns only archived rows, excluding unrelated connected presence.'
    chk docs/agents/tests.md 'The same T2 file covers human `session.history` on Unix and web (both traffic'
    chk docs/agents/tests.md 'Archived merged session reads use the public `session.list`/snapshot seam in'
    chk docs/agents/tests.md '`web/test/sessions.test.ts` owns the Sessions list seams against fake harnesses:'
    printf '%s key rows\n' "$(sed -n '/^## Sessions/,/^## Folds/p' web/README.md | grep -c '^| `')" )
}
k12() {
  quiet || return 1
  ( . "$Q/env.sh"; cd "$W" && node "$Q/bg.cjs" "$Q/rig.pid" "$EV/rig.out" - sh -c 'node --test --test-reporter=tap "$0" > "$1" 2>&1; echo "exit $?" >> "$1"' "$Q/rig.test.mjs" "$EV/rig.log" )
  seen "$Q/rig/ready" '"root"' 1200 || { echo "rig not ready"; tail -n 40 "$EV/rig.log"; return 1; }
  P=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).root)' "$Q/rig/ready"); echo "P=$P"
  cp "$Q/rig/ready" "$EV/E418S1-12-ready.json"
  ( . "$Q/env.sh"; cd "$P" && cland session list --json > "$EV/E418S1-12-list.json"; echo "list exit $?"; cland session list > "$EV/E418S1-12-list.txt" 2>&1 )
  ( . "$Q/env.sh"; q "$EV/E418S1-12-list.json" '({keys: Object.keys(V), archived: V.archived, processes: V.processes.length, rows: V.rows?.length, qa: V.rows?.filter(r=>r.name.startsWith("qa-")).map(r=>[r.name, r.role, r.harness, r.live, r.state])})' )
}
k21() {
  ( . "$Q/env.sh"; cd "$P" && printf '%s\n' '{"type":"session.history","session":"qa-review"}' '{"type":"session.history","session":"qa-review","limit":1000}' '{"type":"session.history","session":"qa-review","limit":2}' '{"type":"session.history","session":"qa-request"}' '{"type":"session.history","session":"qa-absent"}' '{"type":"session.history","session":"qa-review","limit":0}' '{"type":"session.history","session":"qa-review","before":"x"}' | fc > "$EV/E418S1-21-a.jsonl"
    B1=$(q "$EV/E418S1-21-a.jsonl" 'res("q1").value.before'); B3=$(q "$EV/E418S1-21-a.jsonl" 'res("q3").value.before'); B4=$(q "$EV/E418S1-21-a.jsonl" 'res("q4").value.before')
    printf '{"type":"session.history","session":"qa-review","before":%s}\n{"type":"session.history","session":"qa-review","before":%s,"limit":2}\n{"type":"session.history","session":"qa-request","before":%s}\n' "$B1" "$B3" "$B4" | fc > "$EV/E418S1-21-b.jsonl"
    q "$EV/E418S1-21-a.jsonl" '({latest: pg("q1"), clampedSameIds: canon(pg("q2")?.ids)===canon(pg("q1")?.ids), two: pg("q3"), bytes: pg("q4"), absent: res("q5")?.value, absentKeys: Object.keys(res("q5")?.value ?? {}), limit0: pg("q6"), beforeX: pg("q7")})' | tee "$EV/E418S1-21-a.txt"
    q "$EV/E418S1-21-b.jsonl" '(()=>{const a=L(A[0]), r=JSON.parse(fs.readFileSync(A[1],"utf8")), older=pg("q1"), latest=pg("q1",a), big=[...(res("q3").value.messages), ...(res("q4",a).value.messages)].filter(m=>String(m.text).startsWith("qa-big-")).map(m=>m.id);return {older, olderBelowLatest: older.lastSeq < latest.firstSeq, prevTwo: pg("q2"), requestOlder: pg("q3"), bigInOrder: canon(big)===canon(r.big), bigCount: big.length};})()' "$EV/E418S1-21-a.jsonl" "$Q/rig/ready" | tee "$EV/E418S1-21-b.txt" )
}
k22() {
  ( . "$Q/env.sh"; cd "$P" && printf '%s\n' '{"type":"session.history","session":"qa-review"}' '{"type":"session.history","session":"qa-review","limit":2}' | wcl > "$EV/E418S1-22-web.jsonl" )
  rc 22-own '{"op":"ownhistory"}' && fact 22-own E418S1-22-own
  ( . "$Q/env.sh"; q "$EV/E418S1-22-web.jsonl" '(()=>{const u=L(A[0]), own=JSON.parse(fs.readFileSync(A[1],"utf8")).facts;return {webLatest: pg("w1"), sameAsUnix: canon(pg("w1")?.ids)===canon(pg("q1",u)?.ids), webTwoSame: canon(pg("w2")?.ids)===canon(pg("q3",u)?.ids), ownOk: own.ok, ownCount: own.ids.length, ownLast: own.last, ownEqualsPage: canon(own.ids)===canon(pg("q1",u)?.ids), leak: F.find(f=>f.type==="qa-leak")};})()' "$EV/E418S1-21-a.jsonl" "$EV/E418S1-22-own.json" | tee "$EV/E418S1-22.txt" )
}
k23() {
  ( . "$Q/env.sh"; cd "$P"
    printf '{"type":"web.session"}\n' | wcl > "$EV/E418S1-23-b.jsonl"
    printf '{"type":"web.sessions"}\n' | fc > "$EV/E418S1-23-list1.jsonl"
    q "$EV/E418S1-23-list1.jsonl" 'res("q1").value.sessions.map(s=>JSON.stringify({type:"web.session",session:s.id})).join("\n")' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{process.stdout.write("{\"type\":\"web.session\"}\n"+JSON.parse(s)+"\n{\"type\":\"web.sessions\"}\n{\"type\":\"web.revoke\",\"session\":\"qa-none\"}\n")})' > "$QA_Q/web-session-frames.jsonl"
    wcl < "$QA_Q/web-session-frames.jsonl" > "$EV/E418S1-23-a.jsonl"
    printf '{"type":"web.sessions"}\n{"type":"web.session"}\n' | fc > "$EV/E418S1-23-unix.jsonl"
    cland web --sessions > "$EV/E418S1-23-cli.txt" 2>&1; echo "cli web sessions exit $?"
    q "$EV/E418S1-23-a.jsonl" '(()=>{const b=L(A[0]), l1=res("q1",L(A[1])).value.sessions, u=L(A[2]), l2=res("q1",u).value.sessions;const replies=F.filter(f=>f.type==="result"&&F.some(s=>s.type==="qa-send"&&s.frame.id===f.id&&s.frame.type==="web.session"));const own=replies[0]?.value, bv=res("w1",b)?.value, added=l2.filter(s=>!l1.some(x=>x.id===s.id));const text=JSON.stringify(replies);return {ownKeys: Object.keys(own??{}), bKeys: Object.keys(bv??{}), replies: replies.length, allOk: replies.every(r=>r.ok), allSame: replies.every(r=>canon(r.value)===canon(own)), thirtyDays: Date.parse(own.expiresAt)-Date.parse(own.createdAt), bThirtyDays: Date.parse(bv.expiresAt)-Date.parse(bv.createdAt), lastUsedNotBeforeCreated: Date.parse(own.lastUsedAt)>=Date.parse(own.createdAt), ownIsNewRow: added.length===1&&added[0].createdAt===own.createdAt, ownDiffersFromB: own.createdAt!==bv.createdAt, bInFirstListing: l1.some(s=>s.createdAt===bv.createdAt), listedIdsInReplies: l2.filter(s=>text.includes(s.id)).length, webList: [res(`w${replies.length+1}`)?.ok, res(`w${replies.length+1}`)?.code], webRevoke: [res(`w${replies.length+2}`)?.ok, res(`w${replies.length+2}`)?.code], unixWebSession: [res("q2",u)?.ok, res("q2",u)?.error], leakA: F.find(f=>f.type==="qa-leak"), leakB: b.find(f=>f.type==="qa-leak"), listed: l2.length};})()' "$EV/E418S1-23-b.jsonl" "$EV/E418S1-23-list1.jsonl" "$EV/E418S1-23-unix.jsonl" | tee "$EV/E418S1-23.txt" )
}
k24() {
  ( . "$Q/env.sh"; cd "$P"
    printf '%s\n' "{\"type\":\"session.launch\",\"name\":\"qa-web-dir\",\"harness\":\"codex\",\"cwd\":\"$QA_Q/web-dir\"}" '{"type":"session.launch","name":"qa-web-empty","harness":"codex","cwd":""}' '{"type":"session.launch","name":"qa-web-null","harness":"codex","cwd":null}' '{"type":"session.launch","name":"qa-web-root","harness":"codex"}' | wcl > "$EV/E418S1-24-web.jsonl"
    cland session launch qa-cli-dir --harness codex --cwd "$QA_Q/cli-dir" > "$EV/E418S1-24-cli.txt" 2>&1; echo "cli launch exit $?"
    cland session list --json > "$EV/E418S1-24-list.json"
    q "$EV/E418S1-24-web.jsonl" '(()=>{const v=JSON.parse(fs.readFileSync(A[0],"utf8"));const by=n=>v.processes.find(p=>p.name===n)?.cwd ?? null;return {refused: ["w1","w2","w3"].map(i=>[res(i)?.ok, res(i)?.code, res(i)?.error]), root: [res("w4")?.ok, res("w4")?.value?.process?.cwd===A[1]], listed: {"qa-web-root": by("qa-web-root")===A[1], "qa-cli-dir": by("qa-cli-dir"), "qa-web-dir": by("qa-web-dir"), "qa-web-empty": by("qa-web-empty"), "qa-web-null": by("qa-web-null")}};})()' "$EV/E418S1-24-list.json" "$PWD" | tee "$EV/E418S1-24.txt" )
}
k25() {
  ( . "$Q/env.sh"; cd "$P"
    printf '{"type":"session.list","archived":true}\n{"type":"session.list"}\n' | fc '["snapshot"]' > "$EV/E418S1-25.jsonl"
    printf '{"type":"session.list","archived":true}\n' | wcl > "$EV/E418S1-25-web.jsonl"
    cland session list --archived --json > "$EV/E418S1-25-cli.json"; echo "cli json exit $?"
    cland session list --archived > "$EV/E418S1-25-cli.txt" 2>&1; echo "cli text exit $?"
    q "$EV/E418S1-25.jsonl" '(()=>{const a=res("q1").value, d=res("q2").value, s=snap("sessions").value, w=res("w1",L(A[0]))?.value, c=JSON.parse(fs.readFileSync(A[1],"utf8"));const names=x=>x.map(r=>r.name).sort();return {archivedKeys: Object.keys(a), archived: a.archived, processes: a.processes.length, rows: a.rows.length, sameNames: canon(names(a.rows))===canon(names(a.processes)), names: names(a.rows), sameIds: canon(a.rows.map(r=>r.sessionId).sort())===canon(a.processes.map(p=>p.sessionId).sort()), everyArchived: a.rows.every(r=>r.archived===true&&r.live===false), layers: [...new Set(a.rows.map(r=>r.layer))], processesHaveRowFields: a.processes.some(p=>"key" in p||"additionalHolds" in p), defaultKeys: Object.keys(d), defaultRowsEqualSnapshot: canon(d.rows)===canon(s.rows), defaultProcessesEqualSnapshot: canon(d.processes)===canon(s.processes), defaultHasArchived: d.rows.some(r=>r.archived), web: [res("w1",L(A[0]))?.ok, canon(names(w?.rows??[]))===canon(names(a.rows))], cliKeys: Object.keys(c), cliSameNames: canon(names(c.rows??[]))===canon(names(a.rows))};})()' "$EV/E418S1-25-web.jsonl" "$EV/E418S1-25-cli.json" | tee "$EV/E418S1-25.txt" )
  grep -c -E '^ *stopped-' "$EV/E418S1-25-cli.txt"
}
k29() {
  touch "$Q/rig/stop"
  seen "$EV/rig.log" 'exit ' 240; tail -n 1 "$EV/rig.log"; grep -E '^# (tests|pass|fail) ' "$EV/rig.log"; grep -F 'Web fixture census' "$EV/rig.log"
  sleep 2
  sort -u "$Q/pids" | while read -r p; do [ -n "$p" ] && kill -0 "$p" 2>/dev/null && echo "alive $p $(ps -o command= -p "$p")"; done
  echo "census of $(sort -u "$Q/pids" | grep -c .) fixture pids done"
  git -C "$W" status --porcelain | grep -v -x '?? node_modules' | wc -l
}
```

Cleanup after the evidence is recorded: print `$Q`, check it begins with `/private/tmp/qa-e418s1-`, and remove it by that literal path with a non-force `rm -r`. The rig's scratch project under the system `TMPDIR` is owned by the Web harness and removed when the rig ends. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). The scratch hub's secret, the sign-in links and the cookies are never printed or posted.

## Cases

none. No headless-grid case covers the web Sessions area; every check below is a manual check through named test files, the QA rig's Headless Shell page, frame clients, the CLI or the docs, recorded with `qa-record.sh note`.

### Web cases (when in scope)

none. No `real-browser` case: every stage criterion is provable in Chrome Headless Shell with physical key codes against a signed-in sealed scratch hub (E418S1-05 to E418S1-08 and E418S1-13 to E418S1-20, E418S1-26). An anonymous real Chrome on the live edge could show only the offline shell, where the Sessions area has no rows; its keys help is proven by E418S1-07 and E418S1-16. See "Out of scope".

## Manual checks

Record each with `sh .agents/skills/qa/qa-record.sh note E-418 "$RUN" <id> hub-api "<command>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence-file…>` from `$W` in QA's own shell, naming where it ran at the start of the command text (`[QA shell]`, `[test $W]`, `[rig page]`, `[rig hub]`, `[docs]`). The recorder takes `hub-api` for every check here; the rig's page steps are Headless Shell observations recorded the same way. Save each check's printed output as `$EV/<id>.txt` (pipe the row's command through `tee`) and name it, with the captures and screenshots the row wrote, as evidence.

Order: E418S1-00 and the setup, E418S1-01 before any Web file or the rig (every Web file and the rig's web edge serve the bundle it builds), then the rows in id order. E418S1-12 starts the rig detached through `bg.cjs`; it runs until E418S1-29 stops it. Rows E418S1-13 to E418S1-26 need the rig alive: when `rc` prints `rig NOT alive`, record that row and every later rig row BLOCKED with the tail of `$EV/rig.log` (a fixture finding, not a product failure) and go on to E418S1-27.

Every named test log (`nt`) must show `exit 0`, `# fail 0`, `# cancelled 0`, `# skipped 0`, `# todo 0`, `# pass` equal to `# tests`, no `not ok` and no `# SKIP`; every Web log's `census` prints a first count of at least `1` and a second count of `0`. A `# tests` count that differs from the number at writing must equal the file's own count of `test(` and `t.test(` calls at the build (renames and additions happen); every test named below must appear in `oks`.

| id | surface | where | covers | command | expected |
| --- | --- | --- | --- | --- | --- |
| E418S1-00 | hub-api | QA shell | build, plan, sealing | `k00` | Both SHAs equal the requested SHA; `0` changed paths. The plan lists the stages `seams and the session list`, `acting, the queue, accounts and artifacts`, `on E-417's thread, composer and notifications`; this stage has `qa` `{scope: "affected", when: "after-stage"}`, is not closed, and its members are T-1130, T-1132, T-1131 and T-1147 plus any findings fixes the request names (nothing else), all merged; record the printed member list and counts as printed. Under every `== <id>` line exactly one commit (T-1130 `4e727545`, T-1131 `f090f9a1`, T-1147 `de40ac3c`, T-1132 `10c984ac` at writing; none for an item is BLOCKED). The five files exist; the five greps print `1` each. `TMPDIR` is the system default (not `/tmp`) and `Q` begins `/private/tmp/qa-e418s1-`. Also record the setup's two counts (the first at least `1`, the second `0`) and `helpers parse`. Repeat the first two commands after E418S1-29: unchanged (dev not moved) |
| E418S1-01 | hub-api | sealed | build | `quiet && ( . "$Q/env.sh"; cd "$W" && npm run build --workspace web > "$EV/E418S1-01.log" 2>&1; echo "build exit $?"; ls web/dist/index.html web/dist/assets ); git -C "$W" status --porcelain \| grep -v -x '?? node_modules' \| wc -l` | `build exit 0`; `web/dist/index.html` and one `index-*.js` and one `index-*.css` under `web/dist/assets`; `0` changed paths (`web/dist` is ignored) |
| E418S1-02 | hub-api | test $W | T-1130 C2 (state model), T-1131 C4, T-1147 C2 (authority) | `nt E418S1-02a hub/test/web-area-state.test.ts; oks E418S1-02a; nt E418S1-02b hub/test/web-authority-unit.test.ts; oks E418S1-02b; nt E418S1-02c hub/test/web-keymap.test.ts` | T1, each file clean (`# tests` 8, 5 and 2 at writing). `oks E418S1-02a` lists "area snapshots retain merged sessions, launch defaults, queue arrival and ordered account views", "area deltas replace complete views without inventory requests and retain registry order", "merged session deltas update inventories by stable key without process or presence rereads", "adapter capabilities are read once per connection without replacing newer merged session rows", "reconnect and resync replace the areas from fresh hub snapshots and inventories", "moving an artifact removes its top-level inventory row and never adds an unseen moved child". `oks E418S1-02b` lists "the web allows human workbench reads, writes, queued verification and merge" (now including `session.history`, `web.session` and the archived `session.list`) and "web launch directories are refused before dispatch, including malformed fields" |
| E418S1-03 | hub-api | test $W | T-1131 C1, C2, C3 | `nt E418S1-03 hub/test/web-authority.test.ts; oks E418S1-03` | T2, clean (`# tests 16` at writing). `oks` lists "human clients page a session’s sent and received traffic across topics without changing its own history", "web.session exposes only the asking browser’s sign-in and its fixed expiry", "web launches in the project root and refuses a directory while Unix keeps that field", "session history pages keep whole messages under the byte cap and page back without gaps" and "session history remains a human-client read even from an Aide’s attributed shell" (typographic apostrophes as in the file) |
| E418S1-04 | hub-api | test $W | T-1147 C1 (and its workload bound) | `nt E418S1-04a hub/test/connection-snapshot.test.ts; oks E418S1-04a; nt E418S1-04b hub/test/inbox-workload.test.ts; oks E418S1-04b` | T2, both clean (`# tests` 13 and 7 at writing). `oks E418S1-04a` lists "session.list adds snapshot-shaped archived rows without changing compatibility fields"; `oks E418S1-04b` lists "delivered verifier requests and session.list bursts never scan retained message history" (the bound T-1147's first verification broke) |
| E418S1-05 | hub-api | test $W | T-1132 C1 to C5 | `nt E418S1-05 web/test/sessions.test.ts; oks E418S1-05; census E418S1-05` | Web, clean (`# tests 5` at writing), census `1` and `0`. `oks` lists "Sessions groups count fake sessions and remember folds without hub requests", "Sessions rows render merged facts, holds, waiting detail and physical selection keys", "Sessions selected human wait names its topic and usage falls back to tokens", "Sessions caps stopped rows at the latest twenty and reads merged archives with A", "gs from an item reveals its claimed session inside a folded group" |
| E418S1-06 | hub-api | test $W | T-1130 C1, C2, C3 | `nt E418S1-06 web/test/area-slots.test.ts; oks E418S1-06; census E418S1-06` | Web, clean (`# tests 4` at writing: the parent and three subtests), census `1` and `0`. `oks` lists "area modules keep their slots and live hub state across a restart", "Sessions, Accounts and Artifacts own pane, page and drawer slots", "pushed queue, account and artifact frames require no inventory rereads", "a restarted hub replaces Sessions and Accounts without reloading the page" |
| E418S1-07 | hub-api | test $W | regression: keys, help, folds, connection, shell | `nt E418S1-07a web/test/key-contexts.test.ts; oks E418S1-07a; census E418S1-07a; nt E418S1-07b web/test/palette.test.ts; census E418S1-07b; grep -c -F "area === 'Sessions' ? 17" "$W/web/test/palette.test.ts"; nt E418S1-07c web/test/folds.test.ts; census E418S1-07c; nt E418S1-07d web/test/connection.test.ts; census E418S1-07d; nt E418S1-07e web/test/shell.test.ts; census E418S1-07e` | Each file clean (`# tests` 3, 10, 6, 4 and 9 at writing), census at least `1` and `0`. Key contexts: `oks` lists "area modules keep selection and drawers while unimplemented session actions stay absent from help and palette" (Sessions help lists `Next session`, `Previous session`, `Show archived sessions` and 17 key labels; `l`, `a`, `x`, `r`, `d`, `c`, `Enter` change nothing). The palette grep prints `1` (Sessions help counts 17 key labels; the full per-area expression grows as areas activate their keys, so read the line at the tested build and record it) |
| E418S1-08 | hub-api | test $W | regression: Items tree and card over the changed connection | `nt E418S1-08a web/test/items.test.ts; census E418S1-08a; nt E418S1-08b web/test/item-card.test.ts; census E418S1-08b` | Each file clean (`# tests 8` and `6` at writing), census at least `1` and `0` |
| E418S1-09 | hub-api | sealed | typecheck, wire conformance (T-1131, T-1147 C2), tiers | `k09` | `typecheck exit 0` with no diagnostic (hub, Neovim, shared wire with its conformance file, web typechecks, the colour guard, the token contrast check and oxlint's hooks rules: `Sessions.module.css` holds no colour value); the three guard lines appear; `tiers exit 0`; the five tier lines print; the conformance grep names `SessionListRows`, `SessionHistory` (or its result) and `WebSessionRequest`/`WebSessionResult` at least once each |
| E418S1-10 | hub-api | QA shell | AGENTS.md `web/` rules; no browser-side merge | `k10` | The key-listener grep lists only `web/src/keyboard.ts` (no component-local listener in `web/src/sessions/`, `AreaSlot.tsx`, `AreaObjects.tsx` or the area modules). Storage appears only in `web/src/interface-state.ts` and `web/src/connection.ts`'s reload guard. `browser-side merge sources: 0` (no `presence` or `processes` in `web/src/sessions/` or `web/src/connection.ts`). The archived read appears once, in `web/src/connection.ts`. The hex grep prints nothing. The loop prints nothing (no landing changed a package manifest or lockfile) |
| E418S1-11 | hub-api | docs | T-1130 C4, T-1131 C5, T-1132 C6 | `k11 \| tee "$EV/E418S1-11.txt"` | Every `present` line starts with `1 `; the `absent` line starts with `0 ` (the stand-in sentence is gone); the last line reads `5 key rows` (`j`/`↓`, `k`/`↑`, `←`/`→`, `A`, `?`). Read `web/README.md`'s "Area modules and live state" and "Sessions" sections, `hub/README.md`'s `web.session`, `session.history`, authority-list and `session.list` paragraphs, and record any statement that contradicts E418S1-13 to E418S1-26 as a finding |
| E418S1-12 | hub-api | rig hub (QA shell starts it) | the scratch project | `k12` | The rig is ready within 600 s (otherwise BLOCKED with the log tail); `P=` names a directory under the system `TMPDIR` whose name starts `w-`. `list exit 0`; the CLI JSON has the keys `processes`, `archived`, `pendingStops`, `adapters`, `coordinator`, `rows`; `archived: 21`; the `qa-*` rows are `qa-aide` (aide, claude-code), `qa-wait` (`waiting for approval`), `qa-busy` (`busy`), `qa-review`, `qa-request`, `qa-idle` (`idle`) and `qa-stopped-aide` (`live: false`). A seeding failure (`ready` missing, an error in the log) is a fixture finding: BLOCKED with the log |
| E418S1-13 | hub-api | rig page | T-1132 C1, C4 (no Attach); T-1130 C1 (the slots) | `rc 13-groups "{\"op\":\"groups\",\"shot\":\"$EV/E418S1-13.png\"}" && fact 13-groups E418S1-13` | `ok: true`; `connection: "Live"`; `header` exactly `["Yours 1","Waiting 1","Busy 1","Idle 3","Stopped 23"]`; `archiveButton: "Archive 21"`, `archivePressed: "false"`; groups in this order: `Yours` rows `["qa-aide"]`, `Waiting` `["qa-wait"]`, `Busy` `["qa-busy"]`, `Idle` the three `qa-review`, `qa-request`, `qa-idle`, `Stopped` exactly 20 rows, first `qa-stopped-aide` then `stopped-42`, `stopped-41` … `stopped-24` (newest first; `stopped-23`, `stopped-22`, `stopped-21` absent); each group heading starts with its name and its count (`Stopped23…`), the Stopped heading includes `21 archived`; no `Archived` group; `attach: 0`. The screenshot shows the five groups; record any fact in it that contradicts these |
| E418S1-14 | hub-api | rig page | T-1132 C3 | `rc 14-rows "{\"op\":\"rows\",\"shot\":\"$EV/E418S1-14.png\"}" && fact 14-rows E418S1-14` | `ok: true`. Each row's `cells` are, in order, glyph, name, role, harness/model/account, item, state with age, usage. `qa-review`: glyph `○` (`glyphLabel` `idle`), role `Reviewer` with `roleColor` equal to `tokens.reviewer`, harness cell `Claude Code` `opus` `qa-claude` with `metaTitle` `claude-code · opus · qa-claude`, item `<I2> review +1` (I2 = `items[1]` of E418S1-13) with `itemRequested` `"false"`, `itemTitle` naming I2 then I1, `itemColor` equal to `tokens.active`, state `idle <age>`, usage `$0.25`. `qa-request`: glyph `○`, role `Reviewer`, harness `Codex`, item `<I3> review` with `itemRequested` `"true"` and `itemColor` equal to its `stateColor` and to `tokens.muted` and different from `tokens.active` (muted until a hold exists), usage `1.2k tok`. `qa-wait`: glyph `▲`, state `waiting for approval <age>`, item `free`. `qa-busy`: glyph `●`, account `qa-codex`, state `busy <age>`. `qa-idle`: glyph `○`, usage `—`. `qa-aide`: role `Aide` with `roleColor` equal to `tokens.aide`. `qa-stopped-aide`: glyph `×`, state `stopped <age>`. Every `age` matches `^[0-9]+[smhd]$`; `idleAge` shows two values where the second is later (the age ticks without a hub frame). Facts the hub left unknown show `—` (record which; not a failure) |
| E418S1-15 | hub-api | rig page | T-1132 C4 (full command, selection keys) | `rc 15-select "{\"op\":\"select\",\"shot\":\"$EV/E418S1-15.png\"}" && fact 15-select E418S1-15` | `pressed: "true"`; `code` is exactly the waiting command of "Setup" and `codeEqualsCommand: true` (in full, including `END-OF-QA-COMMAND`). Steps from `qa-wait`: `j` selects `qa-busy` with `details` `["qa-busy"]` (the `qa-wait` detail closed); `ArrowDown` selects the first Idle row of E418S1-13; `k` selects `qa-busy`; `ArrowUp` selects `qa-wait` with `details` `["qa-wait"]`. `cyrillicJ: "qa-busy"` (physical `KeyJ` with key value `о`). The screenshot (taken last, `qa-wait` reselected) shows the unfolded row with the whole command |
| E418S1-16 | hub-api | rig page | T-1132 C5 (`A` in `?`); help rows | `rc 16-help "{\"op\":\"help\",\"shot\":\"$EV/E418S1-16.png\"}" && fact 16-help E418S1-16` | `kbd: 17`; `rows` holds 17 entries: the 14 shared rows (`Go to Inbox` `1` … `Go to Accounts` `7`, `Open palette`, `Area keys` `?`, `Toggle split`, `Open in other pane`, `Close` `Esc`, `Fold group` `←`, `Unfold group` `→`) and `Next session`, `Previous session` and `Show archived sessions=A`; no row for Launch, New Aide, Stop, Resume, Archive session, Capabilities or Attach; `lastVisible: true`. Re-read at the tested build: if the count differs, it must equal the count `web/test/palette.test.ts` asserts for Sessions at the build and every named label above must still appear |
| E418S1-17 | hub-api | rig page | T-1132 C2 | `rc 17-fold "{\"op\":\"fold\",\"shot\":\"$EV/E418S1-17.png\"}" && fact 17-fold E418S1-17` | `folded`: `expanded: "false"`, `idleVisible: false`, `sent: []` (folding sent no frame), `storage` a JSON record with `"folds"` holding `"idle":true`. `reloaded`: `expanded: "false"`, `idleVisible: false`, `header` still lists `Idle 3`. `restored.expanded: "true"` |
| E418S1-18 | hub-api | rig page | T-1130 C1 | `rc 18-slots "{\"op\":\"slots\",\"shot\":\"$EV/E418S1-18.png\"}" && fact 18-slots E418S1-18` | For `Sessions` (`qa-idle`), `Accounts` (`claude-code/qa-claude`) and `Artifacts` (the `QA slot note` id): `paneContext` is the area in lower case, `drawerModule: true`, `pageHasId: true` (⌘Enter opened the `Page` surface in the other pane), `drawerDuringSplit: 0`. `Inbox`, `Topics`, `Events`: `"list"`; `Items`: `"tree"`. `sessionSlots` is exactly `["header","accounts","verification","groups"]` |
| E418S1-19 | hub-api | rig page and rig hub | T-1130 C2 | `rc 19-push "{\"op\":\"push\",\"shot\":\"$EV/E418S1-19.png\"}" && fact 19-push E418S1-19` | `ok: true` (each pushed frame reached the page within 5 s). `queue` contains `"hand run"`; `account` contains `["qa-codex","codex",[…81…]]`; `artifact` at least `1`, `artifactRow: 1` (the pushed note listed without a reread); `rowFrames` includes `["qa-busy","idle"]`; the header now reads `Busy 0` and `Idle 4` and `Idle` contains `qa-busy`. `lists: []`: no `session.list`, `account.list` or `artifact.list` was sent after any of these frames (`sentTypes` is recorded). The accounts strip and the verify line render in stage 2: here the account and queue frames are judged by receipt and by no reread |
| E418S1-20 | hub-api | rig page and rig hub | T-1132 C5; T-1147 used by the web | `rc 20-archive "{\"op\":\"archive\",\"shot\":\"$EV/E418S1-20.png\"}" && fact 20-archive E418S1-20` | `on`: `archivePressed: "true"`; an `Archived` group whose rows are exactly `stopped-00` … `stopped-20` (21; any order) and equal `replyRows` in the same order; `reads: 1` (one `session.list` with `archived: true`); `replyKeys` include `rows`; `replyArchived: 21`; `replyRowsArchived: true`; `Stopped` still 20 rows with the same first row. `more` (after the rig archived `stopped-21`): the `Archived` group also lists `stopped-21` (22 rows), `reads: 2`, the Stopped heading includes `22` and `22 archived`, `archiveButton: "Archive 22"`, Stopped still 20 rows. `off`: `archivedRegion: 0`, `stopped00: 0`, `pressed: "false"` |
| E418S1-21 | hub-api | rig hub, Unix frame client | T-1131 C1 | `k21` | `latest` (default): `ok`, `n: 50`, `more: true`, `beforeIsFirst: true`, `ascending: true`, `hist` `qa-hist-h03` … `qa-hist-h52` and `other: []`, `keys` `["messages","more","before"]`. `clampedSameIds: true` (limit 1000 answers the same 50). `two`: `hist` `["qa-hist-h51","qa-hist-h52"]`, `more: true`, `beforeIsFirst: true`. `bytes` (qa-request, the 36 messages of 8000 characters): `ok`, `bytes` below `262144`, `more: true`, every `big` entry `8000`, `n` below 40. `absent` exactly `{"messages":[],"more":false}` with `absentKeys` `["messages","more"]`. `limit0` and `beforeX`: `ok: false`. Second capture: `older` `hist` `["qa-hist-a1","qa-hist-a2","qa-hist-a3","qa-hist-h01","qa-hist-h02"]` (sent and received, across `QA history` and General), `more: false`; `olderBelowLatest: true`; `prevTwo` `hist` `["qa-hist-h49","qa-hist-h50"]`; `requestOlder.more: false`; `bigInOrder: true`, `bigCount: 36`. `other` may list `role` or hub messages older than the traffic: record them; if any appears in `latest`, `n` is still 50, the newest entry is `qa-hist-h52` and the two pages join without gaps (record, not a failure) |
| E418S1-22 | hub-api | rig hub, cookie client; rig spoke | T-1131 C1 (web, own history unchanged) | `k22` | `webLatest.ok`, `n: 50`; `sameAsUnix: true`, `webTwoSame: true`; `ownOk: true`, `ownLast: "qa-hist-h52"`, `ownEqualsPage: true` (the session's own `history` reads the same 50 messages); `leak` `{secret: false, cookie: false}` |
| E418S1-23 | hub-api | rig hub, two cookie clients, Unix frame client, CLI | T-1131 C2 | `k23` | `ownKeys` and `bKeys` exactly `["createdAt","lastUsedAt","expiresAt"]`; every `web.session` reply of client A (plain and with each listed session id as `session`) `ok` and `allSame: true` (an extra field selects nothing); `thirtyDays` and `bThirtyDays` `2592000000`; `lastUsedNotBeforeCreated: true`; `ownIsNewRow: true` (A's reply is the one cookie session that appeared after the first listing); `ownDiffersFromB: true`; `bInFirstListing: true`; `listedIdsInReplies: 0` (no session id in any reply); `webList` and `webRevoke` `[false, "cli-neovim-only"]`; `unixWebSession` `[false, "web.session requires the authenticated web edge"]`; `leakA` and `leakB` `{secret: false, cookie: false}`; `listed` at least `3` (the rig page, A and B). `cli web sessions exit 0` and the CLI listing holds the same ids (read `$EV/E418S1-23-cli.txt`) |
| E418S1-24 | hub-api | rig hub, cookie client, CLI | T-1131 C3, C4 | `k24` | `refused`: three rows `[false, "cli-neovim-only", "session.launch lives in the CLI and Neovim: sets a launch directory"]` (a directory, an empty string and `null`); `root` `[true, true]` (the web launch without `cwd` runs in the project root); `cli launch exit 0`; `listed`: `qa-web-root` `true`, `qa-cli-dir` `$Q/cli-dir` (the CLI keeps its directory), `qa-web-dir`, `qa-web-empty` and `qa-web-null` `null` (nothing was launched) |
| E418S1-25 | hub-api | rig hub, Unix and cookie clients, CLI | T-1147 C1, C2 | `k25` | `archivedKeys` exactly `["processes","archived","pendingStops","adapters","coordinator","rows"]`; `archived: 22`, `processes: 22`, `rows: 22`, `names` `stopped-00` … `stopped-21`, `sameNames` and `sameIds` `true`, `everyArchived: true`, `layers` `["archive"]`, `processesHaveRowFields: false` (the compatibility list is unchanged in shape). Default read: the same keys, `defaultRowsEqualSnapshot` and `defaultProcessesEqualSnapshot` `true`, `defaultHasArchived: false`. `web` `[true, true]` (the edge allows the archived read and answers the same rows). `cli json exit 0`, `cliKeys` as `archivedKeys`, `cliSameNames: true`; `cli text exit 0` and the text listing counts `22` `stopped-` lines (the CLI consumer still prints archived processes; if the text format puts names elsewhere, read the file and count the archived names) |
| E418S1-26 | hub-api | rig page and rig hub | T-1130 C3 | `rc 26-restart "{\"op\":\"restart\",\"shot\":\"$EV/E418S1-26.png\"}" && fact 26-restart E418S1-26` | `ok: true`; `beforeRows` at least `9`; `offline.rows` equal to `beforeRows` plus the launches of E418S1-24 visible in groups (the page keeps its last snapshot while offline: at least `1`); `after.connection: "Live"`; `sessionRows` exactly `["qa-new"]` (none from before the drop); `accounts` exactly `["codex/qa-new-account"]`; `reloads: 0` (the same document took the new hub's snapshot). The rig deleted the stopped hub's `harness_processes` rows and rewrote its account registry between stop and start, as T-1130's own test does: fixture setup while every writer is stopped, not a product action |
| E418S1-27 | hub-api | droplet (Linux) and local macOS, the Coordinator's stage covers | stage covers | from QA's own shell: `(cd "$W" && node hub/bin/cland.ts task plan show E-418) \| tee "$EV/E418S1-27.txt"` and the cover results the request names | QA runs no full suite. The Coordinator owns the stage covers (`cland verify all --occasion stage`) at the tested SHA; they add T3 and the Web phase on both platforms. Record the plan's line for this stage exactly as printed; Linux and macOS covers green at the tested SHA, each with its Web phase run (not "Web unavailable"); record each cover's run id, artifact, executor, platform, tiers and phases, wall time and cost as cited evidence. A red cover is FAIL naming its failing tests; a cover not finished when every other check is done: wait for its result in the epic topic; none queued or running at the tested SHA by then: BLOCKED "no stage cover at the tested SHA", reported to the requester |
| E418S1-28 | hub-api | sealed | brief | `( . "$Q/env.sh"; cd "$W" && cland qa lint qa/briefs/E-418-stage-1.md; echo "exit $?" ) \| tee "$EV/E418S1-28.txt"` | `qa/briefs/E-418-stage-1.md: qa lint passes at the build` and `exit 0` |
| E418S1-29 | hub-api | QA shell; rig | cleanup | `k29` | The rig log ends `exit 0` with `# tests 1`, `# pass 1`, `# fail 0` and one `Web fixture census: browser group <pid>; before <n>; after 0; scratch hub stopped` line; no `alive` line names a fixture process (`rig.test.mjs`, `hub serve`, `fc.cjs`, `wc.mjs`, `chrome-headless-shell`); the census line counts the pids this run recorded; `0` changed paths. An `alive` line whose command is unrelated is pid reuse: record it, not a failure. Then remove `$Q` and the worktree as "Setup" says |

Re-check helper, file, test and label names with grep at the tested build, renames happen. A test name pattern matching zero tests passes with exit 0 and "tests 0": read the counts and `oks`, never the exit code alone. The named Web and hub tests and the rig ask the live hub's verify slot for admission themselves (`suite.slot` check): an admission timeout is BLOCKED; retry after `quiet`.

Before requesting QA, run `cland qa lint <brief>` with this filled brief at the build under test. The brief is complete only when qa lint passes at the build.

## Probes that mislead

- Process cleanup probes use a fixture-owned pid/process-group census, registered at launch and checked through exit; a machine-wide `pgrep` counts other sessions too (A-9063 R2; E-413 stage 1/T-1093). Here: `$Q/pids` and the rig's own `Web fixture census` line; a machine-wide count of Headless Shell processes is not evidence either way.
- Edit existing keys in initialized configs, list standalone-test build prerequisites, enumerate regular files only for file probes, and identify events by seq/id. A second-client check allows only defaults the new client writes itself (A-8634 R12; E-412 stage 2, E-415 stage 3/DoD, E-1006). Here: the rig writes its config before the hub's first start (the T2 test's pattern) and E418S1-01 builds the bundle every Web step reads.
- Transcript assertions identify stable item/topic/frame ids, with intervals starting at the result frame of the state-changing request. Preserve unaltered captures when correcting a probe and label the correction separately from product failures (A-8634 R13; E-412/E-415/E-1006; A-9063 R2; E-413 stage 1/T-1093). Here: the rig's `sent`/`received` lists are cleared or sliced at the start of each step; history pages are judged by message text and id, never by position among other frames.
- Exact tracker copies replace the initialized tracker directory after its writers stop; copy the committed directory whole, dotfiles included, and compare that same file set. Apply the full `fixtureEnvironment` result after overlays, including synthesized values; under rule 15, check zero credential-prefix names before launching scratch processes and report names/counts only (A-9063 R2; E-413 stage 1/T-1093). This run copies no tracker: the rig's project is a fresh scratch project.
- An accessibility-tree count does not prove visible reachability: a real-browser check scrolls the final row into view and checks its viewport containment (A-9063 R6; T-1095, T-1097). Here E418S1-16's `lastVisible` does that for the help's last row in Headless Shell.
- A command runner can end a row's whole process group when the row returns, which silently kills a helper started with `&` (E-414 stage 1's first run). The rig therefore starts through `bg.cjs` in a session of its own, and every rig row says whether the rig still runs when its command times out.
- The fake adapters start every session in state `unknown`, which the area groups as Idle with the glyph `?`; the rig sets the states it judges explicitly and last. `qa-aide`'s state is recorded, not judged (Yours depends only on the live Aide role).
- Every frame client here is the local human on the Unix socket; only `wc.mjs` and the rig's page are the web edge. `web.session` from the Unix socket is refused by design.
- The accounts strip, the verify line and the session actions are later stages: in this stage the account and queue frames are judged by receipt and by the absence of list rereads, not by anything drawn.
- Stopped ordering compares `stoppedAt`; the rig spaces the stops 20 ms apart so the newest-first order is unambiguous.
- `nt` runs Node's TAP reporter so the `# tests`/`# pass` counters exist; the default spec reporter prints none.
- "No skip": the Web files and the rig need Chrome Headless Shell, local on macOS; a skipped or "Web unavailable" result here is BLOCKED, never PASS. The Linux runs of the same files are cited from E418S1-27.
- Duration lines are report-only: the Web budget and any test's wall time are not timing claims of this stage.
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file.
- A "ran" marker grep excludes the configuration echo line.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log.
- Speed criteria use measured wall times, never projections.
- Slots due or queued before the build count even when their results arrive later.
- "No skip" names platform-only cases and where they are covered.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

Real Chrome and computer use: out of scope for this run, not BLOCKED. Every stage criterion is proven in Chrome Headless Shell against a signed-in sealed scratch hub, and an anonymous real Chrome at the live edge would show only the offline shell with no session rows; no sign-in grant exists. So no live-edge build stamp or hub-code gate applies, and the live hub is neither restarted nor rebuilt for this run. Also out of scope: a web launch with an `item` starting in the item's task worktree (needs a Git territory; T-1131's T2 test covers the root launch only, and the hub README states the rule); the accounts strip, verify line and queue view, the session actions, launcher, two-line rows, session page and drawer contents, the Accounts and Artifacts areas beyond their module slots (stages 2 and 3); the human-ask waiting detail and `gs` in the walkthrough (proven by E418S1-05's named tests); the phone width; Neovim; any write to the live tracker or hub; running a full suite or a stage cover (E418S1-27 cites the Coordinator's); T4; duration budgets (report-only); the epic's Definition-of-done demo, a separate run; work landed on dev after the stage's items. Stage QA carries no criterion marks.

Nothing in scope needs an authorization this brief does not give: a check that cannot run for lack of one is BLOCKED, not out of scope.

## Grants

none. Every check uses the rule 15 sealed environment with credentials filtered; the Web files and the rig run their own sealed scratch hubs, projects and Headless Shell profiles; nothing reads or writes the human's real `~/.cland` or `~/.local/state`, and no GUI starts.

## Verdict

Fix nothing. Clear only when every check E418S1-00 to E418S1-29 passes. Otherwise not clear, naming the failing, blocked or inconclusive ids and findings. On the epic record one QA verdict with `--stage "seams and the session list"`, the full tested dev SHA, the unique run id and the case table. Stage QA carries no epic criterion marks. Report `qa clear E-418 stage seams and the session list` or `qa not clear E-418 stage seams and the session list` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
