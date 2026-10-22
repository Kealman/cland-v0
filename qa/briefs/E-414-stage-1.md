# Stage QA brief: E-414 stage 1 — record and gate

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` or `$B:h` as a modifier). The run is local, on macOS (BSD `sed -i ''`, the pinned Neovim of the main worktree).

## Stage

- Epic: E-414 (the approvals relay, under R-377).
- Exact stage name: record and gate.
- Items: T-1109, then T-1110 (one lane, in that order). The run reads the stage's members from `task plan show E-414` (E414S1-00) and never from a number written here. Findings fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: the combined changed behaviour of the two items at the tested build.
  - T-1109, one approval record: every pending harness request is one `ApprovalRecord` in the hub (`id`, `session`, `sessionId`, `role`, `label`, `harness`, `kind`, `subject`, `choices`, `answerIn`, `attach`, `since`, `topic`, `state`, `outcome`, plus the old top-level `command`), carried in the `inbox` snapshot section, in `inbox.list` and as an `approval {approval}` delta on every change beside the coalesced `inbox` delta. A native request's id is `<sessionId>:<nativeRequestId>`; a state-only adapter (Claude Code always) gets one record per waiting episode, `answerIn: tui`, no choices, id `<sessionId>:<episode>`. Repeated reports are idempotent; two requests of one session are two records, each counted once in `needsYou`. The subject is an allowlist (`command`, `cwd`, `reason`, `files`, `change`) capped at 64 KiB of UTF-8 JSON; no other tool input reaches a frame. A closed record carries `outcome {choice, note?, by, via, at}` and leaves the inbox for the seven-day archive with it; a state-only episode that ends closes as `answered in the harness` by `harness` (never consent). `cland inbox` prints each approval's state and choices or `answer in Neovim`; `cland inbox --archive` prints a closed one's outcome. Neovim's approval row keeps Enter to attach; the inbox recordings were refreshed.
  - T-1110, the answer gate: the human's `approval.answer {approval, choice, note?}` frame (`once`, `always`, `deny`; note optional) from Neovim's local connection or the authenticated web edge. The first valid answer reserves the record (`answering`, with the intended outcome `by: human`, `via: neovim|web`, `at`) in the same turn; any competing or later answer is refused with `approval already answered by <by> via <via> at <at>`. The hub hands the answer to the adapter's optional `answerApproval`; on confirmation the record closes and every client gets one closed delta; on failure it returns to `pending`, the client is refused with the reason and `approval-answer-failed` is journaled at warn level. A choice the record does not offer, a closed record and a TUI-only record are refused unchanged. Only the human answers: every agent session, Aides included, is refused; the web edge allows the frame from the cookie human and refuses `as`. A note the native protocol cannot carry becomes the human's message to the session in its item's topic, else General, after a byte-cap preflight. Nothing answers on a timer or by default.
- Decision governing the scope (Coordinator, ask 9a81a158, comment on E-414 at 15:17Z 2026-10-22): the record carries the command, its cwd and the reason, plus the file paths and change as the harness reports them, capped at 64 KB, and no other tool input; only the human answers, agent sessions and Aides are refused; the deny note is optional; the record id is `<sessionId>:<nativeRequestId>`.

Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

Criteria map (the stage verdict carries no item marks; this tells the run which check proves what):

| criterion | proven by |
| --- | --- |
| T-1109 C1 (one TUI record in the snapshot) | E414S1-06, E414S1-01 |
| T-1109 C2 (one `approval` delta and inbox row; close delta with outcome) | E414S1-12, E414S1-01 |
| T-1109 C3 (two requests of one session, counted once each) | E414S1-13, E414S1-01 |
| T-1109 C4 (closed record in the archive with outcome, who, when) | E414S1-09, E414S1-10, E414S1-12, E414S1-01 |
| T-1109 C5 (no private tool input; 64 KiB) | E414S1-07, E414S1-12, E414S1-14, E414S1-23, E414S1-01 |
| T-1109 C6 (`cland inbox` and `--archive`) | E414S1-07, E414S1-09, E414S1-15, E414S1-01 |
| T-1109 C7 (Neovim Enter attaches a Claude Code row) | E414S1-03 |
| T-1109 C8 (refreshed Neovim recordings) | E414S1-03 |
| T-1109 C9 (docs) | E414S1-24 |
| T-1110 C1 (Approve once reaches the adapter once; both clients read the outcome) | E414S1-16, E414S1-01 |
| T-1110 C2 (two clients, one winner, loser refused naming who and when) | E414S1-17, E414S1-01 |
| T-1110 C3 (unoffered, closed and TUI-only refused unchanged) | E414S1-08, E414S1-09, E414S1-18, E414S1-01 |
| T-1110 C4 (agent sessions refused; the web cookie answers) | E414S1-19, E414S1-20, E414S1-02, E414S1-01 |
| T-1110 C5 (delivery failure: pending, refusal, warn journal) | E414S1-21, E414S1-01 |
| T-1110 C6 (Deny note without native note support: human message) | E414S1-22, E414S1-01 |
| T-1110 C7 (no answer on a timer) | E414S1-09, E414S1-23, E414S1-01, E414S1-04 |
| T-1110 C8 (docs) | E414S1-24 |

## Build

Use a clean detached worktree at dev at the SHA in the request (the full 40-hex SHA), created below. HEAD must equal that SHA and refs/heads/dev before and after running. All listed items must have merged onto dev: for every member that `task plan show E-414` lists in stage `record and gate`, `git log --first-parent --oneline --grep "Item: <id>" dev` prints exactly one commit. At writing T-1109 landed as `4ce407b9`; T-1110 had not landed: it lands after writing from branch `t/T-1110-the-answer-gate-one-answer-per-approval` (head `fd6434b5` at writing, a later head if review asks for one), so no commit is named for it. If its merge check prints nothing, or the build lacks `'approval.answer': true` in `hub/src/hub/web-authority.ts`, `scriptApproval` in `hub/test/fakes/harness.ts` or `answerApproval` in `hub/src/hub/inbox.ts`, the run is BLOCKED. Dev also carries work landed after these items that is outside this stage; it is not judged here. A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no commit of its own or run id on purpose: committing a brief changes the tested tree. Every expectation below was read from dev at `8ee2aaa8` and T-1110's branch at `fd6434b5`: re-check test names, messages and docs strings with grep at the tested build.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step (the setup below does; the clean-tree check ignores that one entry). The pinned Neovim comes from the main worktree's `.cache/nvim/`; never download it into the root. This stage has no Web bundle or browser step: the web edge is exercised as a WebSocket client holding the sign-in cookie (`ws` from the installed dependencies), never a browser, and `web/dist` is not needed.

## Setup (once, before E414S1-00)

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree, runs `quiet` and the one live read (`task plan show E-414` in E414S1-00), and records every check with `qa-record.sh`. **Every other command runs sealed** (rule 15) inside a subshell that sources `$Q/env.sh`: the full `fixtureEnvironment` result (`test-support/fixture-environment.ts`) with a scratch HOME, XDG, Git config and fake-harness homes, which drops every `CLAND_*`, `GIT_*`, `XDG_*`, `CLAUDE_*`, `CODEX_*`, `FAKE_*`, provider and account variable while keeping `PATH`, `SHELL`, `TERM` and `TMPDIR`. Leave `TMPDIR` at the system default (on macOS `/var/folders/...`): Neovim frame fixtures break under `/tmp` (T-1030). The scratch root lives under `/private/tmp/qa-e414s1-` (its realpath, so every scratch path compares as written; short enough for the scratch hubs' sockets). Never the live project's hub for anything but E414S1-00's plan read and `quiet`; never the human's HOME, `~/.cland`, `~/.claude`, `~/.codex` or `~/.local/state`.

Two scratch projects:

- **p1**, a CLI-started hub (`cland hub start`) with the fake `claude`, `codex` and `opencode` binaries of `hub/test/fakes/` first on its `PATH`, so the production Claude Code adapter launches the fake as it would the real one. Its fake Claude Code session raises a real `PermissionRequest` hook (`tool_input: {command: "touch approved", content: "PRIVATE-TOOL-INPUT"}`) when a prompt contains `needs approval`, and waits until it receives `SIGUSR1` (the human approving in its TUI). p1 proves the Claude Code record, the CLI and the TUI path end to end.
- **p2, the rig**: a real hub (the production `serveProject` through the test harness's `projectHub`, as the items' own tests use) with the in-process fake adapters, run by one `node --test` file that stays up until a stop file and takes commands from files. It is the only way at this build to have records answered in the hub: the Codex and OpenCode relays land in stage 2. The hub, its Unix socket and its web edge are real; every client (frame clients, the cookie client, the driver sessions, the CLI) is a separate process. The rig raises, closes and scripts requests through the fakes' `raiseApproval`, `closeApproval`, `waitingForApproval`, `scriptApproval('accept'|'fail'|'hold')`, `settleApproval` and `approvalNotes`, and logs every answer each fake adapter received.

In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<the full dev SHA from the request>
RUN=qa-s1-$(date +%F)-1                        # unique run id for E-414; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e414s1-$RUN           # the clean detached build
EV=$R/.cland/qa/E-414/$RUN                     # captures (qa-record.sh keeps its evidence here too)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
Q=$(cd "$(mktemp -d /tmp/qa-e414s1-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/qa-e414s1-…
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data" "$Q/xdg/cache" "$Q/steps" "$Q/rig/cmd" "$Q/p1"
: > "$Q/pids"                                  # the fixture-owned process census: every scratch pid is appended here
holder() { (cd "$W" && node hub/bin/cland.ts verify queue --json) | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);console.log((v.holder?.session??v.holder?.kind??"none")+" waiters "+(v.waiters??[]).length)})'; }
quiet() { for i in $(seq 1 10); do h=$(holder) && case "$h" in "none "*) echo quiet; return 0;; esac; sleep 60; done; echo "BLOCKED: the verify slot is not free after 10 minutes: ${h:-queue read failed}"; return 1; }
# nt <id> <test files…>: named test files from $W, sealed, one file at a time, TAP output, after quiet; the log is $EV/<id>.log
nt() { id=$1; shift; quiet || return 1; ( . "$Q/env.sh"; cd "$W" && node --test --test-concurrency=1 --test-reporter=tap "$@" > "$EV/$id.log" 2>&1; echo "exit $?" >> "$EV/$id.log" ); tail -n 1 "$EV/$id.log"; grep -E '^# (tests|pass|fail|cancelled|skipped|todo) ' "$EV/$id.log"; grep -E '^ *not ok|# SKIP' "$EV/$id.log" | head -20; }
# oks <id>: the names on the passing (sub)test lines of $EV/<id>.log
oks() { grep -E '^ *ok [0-9]+ - ' "$EV/$1.log" | sed -E 's/^ *ok [0-9]+ - //'; }
```

The sealed environment. Apply the full `fixtureEnvironment` result after the scratch overlays, including its synthesized HOME, Git, account and fake-harness paths; do not merely unset keys absent from it. Remove the broader credential prefixes last (including `GH_PAGER` and the fixture's synthetic `CLAND_EXECUTOR_STATE`). The generated shell first unsets dropped inherited names and then exports every retained value; never print or post those exports.

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
FCC=$QA_W/hub/test/fakes/claude-code; FCX=$QA_W/hub/test/fakes/codex; FOC=$QA_W/hub/test/fakes/opencode
cland() { node "$QA_W/hub/bin/cland.ts" "$@"; }
fc() { node "$QA_Q/fc.cjs" "$@"; }
q() { node "$QA_Q/q.cjs" "$@"; }
qv() { node "$QA_Q/q.cjs" "$@" | tr -d '"'; }
now() { node -e 'console.log(new Date().toISOString())'; }
# hp: the pid in this project's .cland/hub.json (the secret is never read out)
hp() { node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(".cland/hub.json","utf8")).pid)+"\n")'; }
# seen <file> <text>: wait up to 120 s for a literal text in a file
seen() { for i in $(seq 1 240); do grep -q -F -- "$2" "$1" 2>/dev/null && return 0; sleep 0.5; done; echo "timeout waiting for $2 in $1"; return 1; }
# hubstart: start this project's hub with the fake harnesses first on its PATH, no machine-wide orphan sweep; census its pid
hubstart() { env PATH="$FCC:$FCX:$FOC:$PATH" CLAND_OPENCODE_BIN="$FOC/opencode" CLAND_CLAUDE_AGENTS_MS=500 CLAND_ADAPTER_POLL_MS=200 CLAND_TEST_SKIP_ORPHAN_SWEEP=1 node "$QA_W/hub/bin/cland.ts" hub start && hp >> "$QA_Q/pids"; }
# st <name>: a launched session's state; waitst <name> <state>: wait up to 120 s for it
st() { cland session list --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).processes.find(x=>x.name===process.argv[1]);console.log(p?p.state:"absent")})' "$1"; }
waitst() { for i in $(seq 1 240); do [ "$(st "$1")" = "$2" ] && return 0; sleep 0.5; done; echo "timeout: $1 is $(st "$1"), not $2"; return 1; }
# rc <name> < command.json: hand one command to the rig and wait for its log line
rc() { cat > "$QA_Q/rig/cmd/$1.tmp" && mv "$QA_Q/rig/cmd/$1.tmp" "$QA_Q/rig/cmd/$1.json" && seen "$QA_Q/rig/log.jsonl" "\"n\":\"$1.json\""; }
ENV
: > "$Q/home/.gitconfig"
printf '{"type":"subscribe"}\n' > "$Q/steps/subscribe.jsonl"
grep -c '^unset ' "$Q/env.sh"; ( . "$Q/env.sh"; prefix_count=$(env | cut -d= -f1 | grep -c -E '^(CLAND_|DIGITALOCEAN_|ANTHROPIC_|OPENAI_|GH_|GITHUB_)'); echo "$prefix_count"; test "$prefix_count" -eq 0 ) || exit 1   # confirm 0 before any scratch process starts
```

The helpers. `fc.cjs` is a frame client on a scratch hub's Unix socket (the local human, so the hub records its answers `via: neovim`); `q.cjs` reads captures; `drv.mjs` is a driver session (a real spoke started through the test harness, with a role) that calls session tools; `wc.mjs` is the browser's edge without a browser: it mints a sign-in link on the Unix socket, takes the cookie and speaks on `/ws`; `rig.test.mjs` is the rig.

```sh
cat > "$Q/fc.cjs" <<'JS'
'use strict';
// QA frame client (E-414 stage record and gate). It prints what a scratch hub sends and asserts nothing.
// node "$QA_Q/fc.cjs" ['<features JSON array>'] < frames.jsonl     (run in the scratch project's directory)
// Connects to ./.cland/hub.json's Unix socket as the local human UI (the secret is never printed) with those
// features, and waits for snapshot.end when "snapshot" is among them. Then sends each stdin line in order and waits
// up to QA_RESULT_MS (default 20000) for its result; ids q1, q2, … are added when missing. Pseudo-frames:
//   {"qa":"wait","ms":N}            pause N ms
//   {"qa":"file","path":"<abs>"}    wait up to 120 s until that file exists (one start line for racing clients)
// Output: every frame whole, one JSON line each, in arrival order, with {"type":"qa-send","frame":…} before each
// request and {"type":"qa-end"} last. QA_STREAM=1 prints frames as they arrive (needed for a backgrounded client);
// otherwise all at the end. QA_SETTLE (default 700) ms after the last answer; QA_HOLD_MS=N then keeps listening up to
// N ms, ending early once the file named by QA_STOP exists. Its pid is appended to $QA_Q/pids (the census).
const fs = require('node:fs');
const net = require('node:net');
const features = process.argv[2] ? JSON.parse(process.argv[2]) : [];
const input = fs.readFileSync(0, 'utf8').split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
const discovery = JSON.parse(fs.readFileSync('.cland/hub.json', 'utf8'));
const env = process.env;
if (env.QA_Q) fs.appendFileSync(`${env.QA_Q}/pids`, `${process.pid}\n`);
const resultMs = Number(env.QA_RESULT_MS ?? 20000);
const frames = [];
let waiters = [];
let next = 0;
let done = false;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function emit(frame) {
  if (done) return;
  frames.push(frame);
  if (env.QA_STREAM) process.stdout.write(`${JSON.stringify(frame)}\n`);
  for (const w of [...waiters]) if (w.test(frame)) { waiters = waiters.filter(x => x !== w); w.resolve(frame); }
}
function waitFor(test, ms) {
  const seen = frames.find(test);
  if (seen) return Promise.resolve(seen);
  return new Promise((resolve, reject) => {
    const w = { test, resolve: frame => { clearTimeout(timer); resolve(frame); } };
    const timer = setTimeout(() => { waiters = waiters.filter(x => x !== w); reject(new Error('timeout')); }, ms);
    waiters.push(w);
  });
}
const socket = net.createConnection(discovery.socket);
let buffer = '';
socket.setEncoding('utf8');
socket.on('data', chunk => {
  buffer += chunk;
  for (let nl = buffer.indexOf('\n'); nl >= 0; nl = buffer.indexOf('\n')) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (line) emit(JSON.parse(line));
  }
});
socket.on('close', () => emit({ type: 'qa-closed' }));
async function request(frame) {
  const sent = frame.id === undefined ? { ...frame, id: `q${++next}` } : frame;
  emit({ type: 'qa-send', frame: sent });
  socket.write(`${JSON.stringify(sent)}\n`);
  try { return await waitFor(f => (f.type === 'result' && f.id === sent.id) || f.type === 'qa-closed', resultMs); }
  catch { emit({ type: 'qa-timeout', id: sent.id }); return null; }
}
(async () => {
  try {
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); });
    socket.write(`${JSON.stringify({ type: 'hello', protocol: 2, client: 'ui', secret: discovery.secret, features })}\n`);
    const hello = await waitFor(f => ['welcome', 'error', 'qa-closed'].includes(f.type), 20000);
    if (hello.type === 'welcome' && features.includes('snapshot')) await waitFor(f => ['snapshot.end', 'snapshot.refused', 'qa-closed'].includes(f.type), 60000);
    for (const step of hello.type === 'welcome' ? input : []) {
      if (step.qa === 'wait') await sleep(step.ms);
      else if (step.qa === 'file') {
        const until = Date.now() + 120000;
        while (!fs.existsSync(step.path) && Date.now() < until) await sleep(20);
        emit({ type: 'qa-file', path: step.path, found: fs.existsSync(step.path), at: new Date().toISOString() });
      } else await request(step);
    }
    await sleep(Number(env.QA_SETTLE ?? 700));
    const until = Date.now() + Number(env.QA_HOLD_MS ?? 0);
    while (Date.now() < until && !(env.QA_STOP && fs.existsSync(env.QA_STOP))) await sleep(200);
  } catch (error) {
    emit({ type: 'qa-error', message: error.message });
    process.exitCode = 1;
  }
  emit({ type: 'qa-end' });
  done = true;
  if (!env.QA_STREAM) process.stdout.write(frames.map(f => JSON.stringify(f)).join('\n') + '\n');
  socket.destroy();
  setTimeout(() => process.exit(), 500).unref();
})();
JS
cat > "$Q/q.cjs" <<'JS'
'use strict';
// node "$QA_Q/q.cjs" <capture> '<expression>' [args…]: evaluates the expression over a JSON-lines capture and prints
// the value as JSON. In scope: F (every frame; an unfinished last line of a capture still being written is left
// out), A (the extra args), fs, snap(domain) (that snapshot frame), res(id) (the result frame with that id), ap(id)
// (the records of every `approval` delta for that record id, in arrival order), rows(id) (for each `inbox` delta, how
// many approval rows carry that id), rig() (the rig's log lines), answers(harness, requestId) (that native request's
// adapter answers in the rig's latest log line).
const fs = require('node:fs');
const [file, expr, ...A] = process.argv.slice(2);
const lines = fs.readFileSync(file, 'utf8').split('\n').filter(line => line.trim());
const F = lines.flatMap((line, i) => { try { return [JSON.parse(line)]; } catch (error) { if (i === lines.length - 1) return []; throw error; } });
const snap = d => F.find(f => f.type === 'snapshot' && f.domain === d);
const res = id => F.find(f => f.type === 'result' && f.id === id);
const ap = id => F.filter(f => f.type === 'approval' && f.approval.id === id).map(f => f.approval);
const rows = id => F.filter(f => f.type === 'inbox').map(f => f.inbox.approvals.filter(a => a.id === id).length);
const rig = () => fs.readFileSync(`${process.env.QA_Q}/rig/log.jsonl`, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
const answers = (harness, requestId) => (rig().at(-1).answers[harness] ?? []).filter(a => a.requestId === requestId);
console.log(JSON.stringify(eval(expr)));
JS
cat > "$Q/drv.mjs" <<'JS'
// node "$QA_Q/drv.mjs" <scratch project> <name> <role> <stay ms> < steps.jsonl   (run sealed, in that project)
// A driver session of a scratch hub: a real spoke started through the test harness, which first assigns the role on
// the project's socket as the human would. It appends its own pid and the spoke's to $QA_Q/pids, prints every
// channel event it receives as {"event":{content,meta}}, and runs each step in order, 300 ms apart:
//   {"tool":T,"args":{…}}   call a tool; a string arg "@file:<name>" is replaced by that file's trimmed text
//                           ($QA_Q/<name>); prints {"tool","args","result","at"}
// It then stays connected up to <stay ms> and disconnects. A failed step prints {"step","error"} and the driver goes
// on. Errors go to stderr only.
import { readFileSync, appendFileSync } from 'node:fs';
const [cwd, name, role, stay = '0'] = process.argv.slice(2);
const QQ = process.env.QA_Q;
if (!cwd || !QQ || !cwd.startsWith(`${QQ}/`)) { console.log(JSON.stringify({ refused: 'not a scratch project' })); process.exit(2); }
const steps = readFileSync(0, 'utf8').split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const { spawnSpoke } = await import(`${process.env.QA_W}/hub/test/harness.ts`);
const session = await spawnSpoke({ discover: true, cwd, name, role, sessionId: `qa-${name}` });
appendFileSync(`${QQ}/pids`, `${process.pid}\n${session.pid}\n`);
let printed = 0;
const flush = () => { for (; printed < session.events.length; printed++) console.log(JSON.stringify({ event: session.events[printed].params })); };
const pump = setInterval(flush, 100);
await session.waitForPresence([name]);
console.log(JSON.stringify({ ready: name, pid: session.pid, at: new Date().toISOString() }));
const fill = v => typeof v === 'string' && v.startsWith('@file:') ? readFileSync(`${QQ}/${v.slice(6)}`, 'utf8').trim()
  : Array.isArray(v) ? v.map(fill) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)])) : v;
for (const step of steps) {
  try { const args = fill(step.args ?? {}); console.log(JSON.stringify({ tool: step.tool, args, result: await session.call(step.tool, args), at: new Date().toISOString() })); }
  catch (error) { flush(); console.log(JSON.stringify({ step, error: String(error) })); }
  await sleep(300);
}
await sleep(Number(stay));
flush(); clearInterval(pump);
await session.close();
console.log(JSON.stringify({ closed: name }));
process.exit(0);
JS
cat > "$Q/wc.mjs" <<'JS'
// node "$QA_Q/wc.mjs" <scratch project> < frames.jsonl   (run sealed): the browser's edge as a cookie client, no browser.
// Mints a sign-in link through the project's Unix socket (web.link, as the local human), follows it once for the
// cookie, opens /ws with that cookie and origin, says hello as client "pretend-session" (the edge names it human),
// then sends each stdin frame (ids w1, w2, … when missing) and waits up to 20 s for its result. Prints every frame it
// receives, one JSON line each, with {"type":"qa-send","frame"} before each request, {"type":"qa-signed-in","origin"}
// once the socket opens and {"type":"qa-end"} last. The link and the cookie are never printed.
import { createRequire } from 'node:module';
import { appendFileSync, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { get } from 'node:http';
const [root] = process.argv.slice(2);
const Q = process.env.QA_Q;
if (!root || !Q || !root.startsWith(`${Q}/`)) { console.log(JSON.stringify({ refused: 'not a scratch project' })); process.exit(2); }
appendFileSync(`${Q}/pids`, `${process.pid}\n`);
const { WebSocket } = createRequire(`${process.env.QA_W}/hub/package.json`)('ws');
const d = JSON.parse(readFileSync(`${root}/.cland/hub.json`, 'utf8'));
const link = await new Promise((resolve, reject) => {
  const s = createConnection(d.socket);
  let buf = '';
  s.setEncoding('utf8');
  s.on('error', reject);
  s.on('connect', () => s.write(`${JSON.stringify({ type: 'hello', protocol: 2, client: 'ui', secret: d.secret })}\n`));
  s.on('data', chunk => {
    buf += chunk;
    for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
      const f = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
      if (f.type === 'welcome') s.write(`${JSON.stringify({ type: 'web.link', id: 'link' })}\n`);
      else if (f.type === 'error') { s.destroy(); reject(new Error(`hello refused: ${f.error ?? f.type}`)); }
      else if (f.type === 'result' && f.id === 'link') { s.destroy(); if (f.ok) resolve(f.value.url); else reject(new Error(f.error)); }
    }
  });
});
const cookie = await new Promise((resolve, reject) => {
  const req = get(link, { agent: false }, response => {
    response.resume();
    response.on('end', () => { const c = response.headers['set-cookie']?.[0]?.split(';')[0]; if (c) resolve(c); else reject(new Error('the sign-in link set no cookie')); });
    response.on('error', reject);
  });
  req.setTimeout(5000, () => req.destroy(new Error('sign-in timed out')));
  req.on('error', reject);
});
const origin = new URL(link).origin;
const ws = new WebSocket(`${origin.replace('http:', 'ws:')}/ws`, { origin, headers: { Cookie: cookie } });
const frames = [];
let waiters = [];
const emit = f => { frames.push(f); console.log(JSON.stringify(f)); for (const w of [...waiters]) if (w.test(f)) { waiters = waiters.filter(x => x !== w); w.resolve(f); } };
const waitFor = (test, ms) => new Promise((resolve, reject) => {
  const hit = frames.find(test);
  if (hit) return resolve(hit);
  const w = { test, resolve: f => { clearTimeout(timer); resolve(f); } };
  const timer = setTimeout(() => { waiters = waiters.filter(x => x !== w); reject(new Error('timeout')); }, ms);
  waiters.push(w);
});
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
console.log(JSON.stringify({ type: 'qa-end' }));
ws.terminate();
process.exit(0);
JS
cat > "$Q/rig.test.mjs" <<'JS'
// node --test "$QA_Q/rig.test.mjs" (sealed, cwd $QA_W): the QA rig of E-414 stage record and gate. One real hub (the
// production serveProject through the test harness's projectHub) with the in-process fake adapters, in a scratch
// project $QA_Q/p2-…; every client connects from outside. It appends its pid to $QA_Q/pids and writes
// $QA_Q/rig/ready ({"root","pid"}) once serving. Then it runs each command file $QA_Q/rig/cmd/<name>.json in name
// order, on the fake adapter named by `harness` (claude-code, codex or opencode):
//   {"op":"raise","harness":H,"session":N,"request":{…}}                 raiseApproval(N, request)
//   {"op":"close","harness":H,"session":N,"request":ID,"outcome":{…}}    closeApproval(N, ID, outcome)
//   {"op":"waiting","harness":H,"session":N}                             waitingForApproval(N) (state only)
//   {"op":"script","harness":H,"outcomes":["accept"|"fail"|"hold",…]}    scriptApproval(...outcomes)
//   {"op":"settle","harness":H,"session":N,"request":ID,"outcome":"accept"|"fail"}   settleApproval(N, ID, outcome)
//   {"op":"notes","harness":H,"value":true|false}                        approvalNotes = value
//   {"op":"answers"}                                                     nothing; only logs the answers
// After each it appends {"n","op","ok","error"?,"at","answers":{<harness>:[every answer that adapter received]}} to
// $QA_Q/rig/log.jsonl and renames the file to <name>.json.done. It ends when $QA_Q/rig/stop exists, or after 45 min.
import test from 'node:test';
import { appendFileSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
const W = process.env.QA_W, Q = process.env.QA_Q;
const { projectHub, tempProject } = await import(`${W}/hub/test/harness.ts`);
const dir = `${Q}/rig`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
test('QA rig, E-414 stage record and gate', { timeout: 46 * 60_000 }, async t => {
  const root = await tempProject(t, 'p2-', Q);
  const { fakes } = await projectHub(t, root);
  appendFileSync(`${Q}/pids`, `${process.pid}\n`);
  writeFileSync(`${dir}/ready`, `${JSON.stringify({ root, pid: process.pid })}\n`);
  const answers = () => Object.fromEntries(Object.entries(fakes).map(([harness, fake]) => [harness, fake.approvalAnswers]));
  const until = Date.now() + 45 * 60_000;
  while (!existsSync(`${dir}/stop`) && Date.now() < until) {
    for (const name of readdirSync(`${dir}/cmd`).filter(n => n.endsWith('.json')).sort()) {
      const path = `${dir}/cmd/${name}`;
      let c = {}, row;
      try {
        c = JSON.parse(readFileSync(path, 'utf8'));
        const fake = fakes[c.harness];
        if (c.op !== 'answers' && !fake) throw new Error(`no fake adapter ${c.harness}`);
        if (c.op === 'raise') fake.raiseApproval(c.session, c.request);
        else if (c.op === 'close') fake.closeApproval(c.session, c.request, c.outcome);
        else if (c.op === 'waiting') fake.waitingForApproval(c.session);
        else if (c.op === 'script') fake.scriptApproval(...c.outcomes);
        else if (c.op === 'settle') fake.settleApproval(c.session, c.request, c.outcome ?? 'accept');
        else if (c.op === 'notes') fake.approvalNotes = c.value;
        else if (c.op !== 'answers') throw new Error(`unknown op ${c.op}`);
        row = { n: name, op: c.op, ok: true };
      } catch (error) { row = { n: name, op: c.op ?? null, ok: false, error: String(error) }; }
      appendFileSync(`${dir}/log.jsonl`, `${JSON.stringify({ ...row, at: new Date().toISOString(), answers: answers() })}\n`);
      renameSync(path, `${path}.done`);
    }
    await sleep(100);
  }
});
JS
node --check "$Q/fc.cjs" && node --check "$Q/q.cjs" && node --check "$Q/drv.mjs" && node --check "$Q/wc.mjs" && node --check "$Q/rig.test.mjs" && echo "helpers parse"
```

Project p1. `cland init` may start a scratch hub: record its pid and stop it before editing the config. Point the existing `lock_path` and `executor` keys at a scratch lock and the local executor (edit the keys init wrote; never add a second table), then start p1's hub with the fakes.

```sh
( . "$Q/env.sh"; cd "$Q/p1" && git init -q -b dev && git commit -q --allow-empty -m init && cland init . > "$EV/E414S1-00-init.txt" 2>&1 || exit 1
  [ -f .cland/hub.json ] && hp >> "$Q/pids"; cland hub stop > /dev/null 2>&1
  sed -i '' -e "s|^lock_path = .*|lock_path = \"$QA_Q/p1-suite.lock\"|" -e 's|^executor = .*|executor = "local"|' .cland/config.toml
  grep -c -x "lock_path = \"$QA_Q/p1-suite.lock\"" .cland/config.toml; grep -c -x 'executor = "local"' .cland/config.toml
  hubstart > "$EV/E414S1-00-p1-start.txt" 2>&1; echo "p1 hub start exit $?"; cland hub status )
```

The check functions. Define them in QA's own shell (paste the block once). Each runs where its table row says, inside a sealed subshell, writes its captures under `$EV` and prints the facts the `expected` column judges. `P2` (the rig's project directory) is set in QA's shell by E414S1-11.

```sh
k06() {   # p1: a fake Claude Code session waits for approval; one record in a fresh snapshot
  cland session launch qa-cc --role implementer --harness claude-code > "$EV/E414S1-06-launch.txt" 2>&1; echo "launch exit $?"
  waitst qa-cc idle || return 1
  QA_STREAM=1 QA_HOLD_MS=1800000 QA_STOP="$Q/stop-s1" fc < "$Q/steps/subscribe.jsonl" > "$EV/E414S1-S1.jsonl" &   # S1 streams until E414S1-10
  seen "$EV/E414S1-S1.jsonl" '"type":"result","id":"q1"' || return 1
  printf '{"type":"topic.send","topic":"general","text":"QA needs approval","to":["qa-cc"]}\n' | fc > "$EV/E414S1-06-send.jsonl"
  waitst qa-cc 'waiting for approval' || return 1
  sleep 2
  cland session list --json > "$EV/E414S1-06-sessions.json"
  fc '["snapshot","numbered-deltas"]' < /dev/null > "$EV/E414S1-06-snap.jsonl"
  qv "$EV/E414S1-06-snap.jsonl" 'snap("inbox").value.approvals.find(a=>a.session==="qa-cc").id' > "$Q/rec-cc1"
  q "$EV/E414S1-06-snap.jsonl" '(()=>{const s=snap("inbox").value, p=JSON.parse(fs.readFileSync(A[0],"utf8")).processes.find(x=>x.name==="qa-cc"), m=s.approvals.filter(a=>a.session==="qa-cc"), a=m[0]??{};return {rows: m.length, sessionId: a.sessionId===p.sessionId, idScoped: String(a.id).startsWith(p.sessionId+":"), harness: a.harness, kind: a.kind, command: a.command, subject: a.subject, answerIn: a.answerIn, choices: a.choices, state: a.state, outcome: a.outcome ?? null, attach: a.attach, harnessId: p.harnessId, needsYou: s.needsYou};})()' "$EV/E414S1-06-sessions.json" | tee "$EV/E414S1-06.txt"
}
k07() {   # p1: the record shows once over time; cland inbox
  ID=$(cat "$Q/rec-cc1"); sleep 5
  cland inbox > "$EV/E414S1-07-inbox.txt"; cland inbox --json > "$EV/E414S1-07-inbox.json"
  printf 'row lines: '; grep -c -F "approval $ID  qa-cc  touch approved  pending  answer in Neovim  from " "$EV/E414S1-07-inbox.txt"
  printf 'id mentions: '; grep -c -F "$ID" "$EV/E414S1-07-inbox.txt"
  tail -n 1 "$EV/E414S1-07-inbox.txt"
  node -e 'console.log("json needsYou "+JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).needsYou)' "$EV/E414S1-07-inbox.json"
  q "$EV/E414S1-S1.jsonl" '(()=>{const mine=F.filter(f=>f.type==="approval"&&f.approval.session==="qa-cc").map(f=>f.approval);const pend=mine.filter(a=>a.state==="pending").map(a=>JSON.stringify(a));const per=F.filter(f=>f.type==="inbox").map(f=>f.inbox.approvals.filter(a=>a.session==="qa-cc").length);return {ids: [...new Set(mine.map(a=>a.id))], pending: pend.length, identical: new Set(pend).size===1, inboxFrames: per.length, maxRows: Math.max(0,...per)};})()'
  printf 'private: '; cat "$EV"/E414S1-06* "$EV"/E414S1-07* "$EV/E414S1-S1.jsonl" | grep -c -F 'PRIVATE-TOOL-INPUT'
}
k08() {   # p1: answers to a TUI-only record, an unknown record and a malformed choice are refused
  ID=$(cat "$Q/rec-cc1")
  printf '{"type":"inbox.list"}\n{"type":"approval.answer","approval":"%s","choice":"once"}\n{"type":"approval.answer","approval":"%s","choice":"deny","note":"QA no"}\n{"type":"approval.answer","approval":"qa-no-such:1","choice":"once"}\n{"type":"approval.answer","approval":"%s","choice":"maybe"}\n{"type":"inbox.list"}\n' "$ID" "$ID" "$ID" | fc > "$EV/E414S1-08.jsonl"
  q "$EV/E414S1-08.jsonl" '({once: [res("q2").ok, res("q2").error], deny: [res("q3").ok, res("q3").error], unknown: [res("q4").ok, res("q4").error], malformed: [res("q5").ok, res("q5").error], unchanged: JSON.stringify(res("q1").value.approvals)===JSON.stringify(res("q6").value.approvals), state: res("q6").value.approvals.find(a=>a.id===A[0])?.state})' "$ID"
}
k09() {   # p1: nothing answers by itself; the TUI answer closes the record; a later answer is refused; a new episode
  ID=$(cat "$Q/rec-cc1")
  printf '{"type":"inbox.list"}\n' | fc > "$EV/E414S1-09-before.jsonl"
  AGE=$(qv "$EV/E414S1-09-before.jsonl" 'Math.floor((Date.now()-Date.parse(res("q1").value.approvals.find(a=>a.id===A[0]).since))/1000)' "$ID")
  [ "$AGE" -ge 180 ] || sleep $((180 - AGE))
  printf '{"type":"inbox.list"}\n' | fc > "$EV/E414S1-09-waited.jsonl"
  HID=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).processes.find(p=>p.name==="qa-cc").harnessId)' "$EV/E414S1-06-sessions.json")
  PID=$(node -e 'const fs=require("fs"),d=process.env.FAKE_CLAUDE_HOME+"/sessions";const m=fs.readdirSync(d).filter(n=>n.endsWith(".json")).map(n=>JSON.parse(fs.readFileSync(d+"/"+n,"utf8"))).find(s=>s.id===process.argv[1]||s.sessionId===process.argv[1]);console.log(m?m.pid:"")' "$HID")
  [ -n "$PID" ] || { echo "BLOCKED: no fake Claude Code session file for $HID"; return 1; }
  echo "$PID" >> "$Q/pids"; echo "fake session pid $PID"
  kill -USR1 "$PID"                                                            # the human approves in the harness's TUI
  seen "$EV/E414S1-S1.jsonl" '"text":"pong: QA needs approval"'; waitst qa-cc idle; sleep 2
  printf '{"type":"approval.answer","approval":"%s","choice":"once"}\n{"type":"inbox.list","archive":true}\n' "$ID" | fc > "$EV/E414S1-09-late.jsonl"
  cland inbox --archive > "$EV/E414S1-09-archive.txt"
  printf '{"type":"topic.send","topic":"general","text":"QA needs approval again","to":["qa-cc"]}\n' | fc > "$EV/E414S1-09-send2.jsonl"
  waitst qa-cc 'waiting for approval'; sleep 2
  printf '{"type":"inbox.list"}\n' | fc > "$EV/E414S1-09-second.jsonl"
  kill -USR1 "$PID"; seen "$EV/E414S1-S1.jsonl" '"text":"pong: QA needs approval again"'; waitst qa-cc idle
  q "$EV/E414S1-09-waited.jsonl" '(()=>{const b=fs.readFileSync(A[1],"utf8").split("\n").filter(Boolean).map(l=>JSON.parse(l)).find(f=>f.type==="result"&&f.id==="q1").value.approvals.find(x=>x.id===A[0]);const a=res("q1").value.approvals.find(x=>x.id===A[0]);return {state: a?.state, outcome: a?.outcome ?? null, waitedS: Math.floor((Date.now()-Date.parse(a.since))/1000), sameAsBefore: JSON.stringify(a)===JSON.stringify(b)};})()' "$ID" "$EV/E414S1-09-before.jsonl"
  q "$EV/E414S1-S1.jsonl" '({states: ap(A[0]).map(a=>a.state), closed: ap(A[0]).filter(a=>a.state==="closed").map(a=>a.outcome)})' "$ID"
  q "$EV/E414S1-09-late.jsonl" '({late: [res("q1").ok, res("q1").error], listed: res("q2").value.approvals.some(a=>a.id===A[0]), archive: res("q2").value.archive.filter(r=>r.id===A[0]).map(r=>[r.kind, r.reason, r.outcome])})' "$ID"
  printf 'archive lines: '; grep -c -F "  approval $ID  qa-cc  touch approved  · closed  answered in the harness by harness via harness at " "$EV/E414S1-09-archive.txt"
  q "$EV/E414S1-09-second.jsonl" '(()=>{const m=res("q1").value.approvals.filter(a=>a.session==="qa-cc");return {rows: m.length, newId: m[0]?.id!==A[0], sameSession: String(m[0]?.id).startsWith(A[0].slice(0, A[0].lastIndexOf(":")+1)), state: m[0]?.state, answerIn: m[0]?.answerIn};})()' "$ID"
}
k10() {   # p1: the archived approvals survive a hub restart
  touch "$Q/stop-s1"
  cland inbox --archive > "$EV/E414S1-10-before.txt"
  cland session stop qa-cc > "$EV/E414S1-10-stop.txt" 2>&1; echo "session stop exit $?"
  OLD=$(hp); cland hub stop > "$EV/E414S1-10-hubstop.txt" 2>&1
  for i in $(seq 1 60); do kill -0 "$OLD" 2>/dev/null || break; sleep 0.5; done
  kill -0 "$OLD" 2>/dev/null && echo "old hub $OLD alive" || echo "old hub $OLD exited"
  hubstart > "$EV/E414S1-10-hubstart.txt" 2>&1; echo "hub start exit $?"; echo "OLD=$OLD NEW=$(hp)"
  cland inbox --archive > "$EV/E414S1-10-after.txt"
  grep -F '  approval ' "$EV/E414S1-10-before.txt" > "$Q/k10-before"; grep -F '  approval ' "$EV/E414S1-10-after.txt" > "$Q/k10-after"
  printf 'approval lines: '; wc -l < "$Q/k10-before"
  cmp -s "$Q/k10-before" "$Q/k10-after" && echo "approval archive unchanged across the restart" || diff "$Q/k10-before" "$Q/k10-after"
}
rigstart() {   # sealed, in $W: start the rig in the background and wait for it to serve
  ( node --test --test-reporter=tap "$Q/rig.test.mjs" > "$EV/rig.log" 2>&1; echo "exit $?" >> "$EV/rig.log" ) &
  seen "$Q/rig/ready" '"root"'
}
k11() {   # p2: the second streaming client, three fake sessions, and a request left alone for E414S1-23
  QA_STREAM=1 QA_HOLD_MS=2700000 QA_STOP="$Q/stop-r1" fc < "$Q/steps/subscribe.jsonl" > "$EV/E414S1-R1.jsonl" &   # R1 streams until E414S1-25
  seen "$EV/E414S1-R1.jsonl" '"type":"result","id":"q1"' || return 1
  printf '%s\n' '{"type":"inbox.list"}' '{"type":"session.launch","name":"qa-codex","harness":"codex","role":"implementer"}' '{"type":"session.launch","name":"qa-codex2","harness":"codex","role":"implementer"}' '{"type":"session.launch","name":"qa-oc","harness":"opencode","role":"implementer"}' | fc > "$EV/E414S1-11-launch.jsonl"
  for n in 2:qa-codex 3:qa-codex2 4:qa-oc; do qv "$EV/E414S1-11-launch.jsonl" "res(\"q${n%%:*}\").value.process.sessionId" > "$Q/sid-${n#*:}"; done
  printf '{"op":"raise","harness":"codex","session":"qa-codex2","request":{"id":"idle-1","kind":"command","subject":{"command":"echo idle"},"choices":["once","deny"]}}\n' | rc 11-idle
  date -u +%s > "$Q/idle-raised"; sleep 1
  printf '{"type":"inbox.list"}\n' | fc > "$EV/E414S1-11-idle.jsonl"
  q "$EV/E414S1-11-launch.jsonl" '({launched: ["q2","q3","q4"].map(i=>[res(i).ok, res(i).value?.process?.name, res(i).value?.process?.harness]), needsYou0: res("q1").value.needsYou})'
  q "$EV/E414S1-11-idle.jsonl" '({record: res("q1").value.approvals.find(x=>x.id===A[0]+":idle-1"), needsYou: res("q1").value.needsYou})' "$(cat "$Q/sid-qa-codex2")"
  tail -n 1 "$Q/rig/log.jsonl"
}
k12() {   # p2: a native request arrives as one delta and one inbox row; its close arrives with the outcome
  SID=$(cat "$Q/sid-qa-codex")
  printf '{"op":"raise","harness":"codex","session":"qa-codex","request":{"id":"rec-1","kind":"command","subject":{"command":"git status\\nprintf done","cwd":"%s","reason":"QA read worktree","privateInput":"PRIVATE-QA-SUBJECT"},"choices":["once","always","deny"],"topic":"general","privateInput":"PRIVATE-QA-INPUT"}}\n' "$PWD" | rc 12-raise
  sleep 2; AT=$(now); echo "$AT" > "$Q/at-rec1"
  printf '{"op":"close","harness":"codex","session":"qa-codex","request":"rec-1","outcome":{"choice":"deny","note":"Keep the tree","by":"human","via":"harness","at":"%s"}}\n' "$AT" | rc 12-close
  sleep 2; printf '{"type":"inbox.list","archive":true}\n' | fc > "$EV/E414S1-12-after.jsonl"
  echo "AT=$AT"
  q "$EV/E414S1-R1.jsonl" '({states: ap(A[0]).map(a=>a.state), first: ap(A[0])[0], closed: ap(A[0]).filter(a=>a.state==="closed").map(a=>a.outcome), inboxWithRow: rows(A[0]).filter(n=>n===1).length, inboxWithMore: rows(A[0]).filter(n=>n>1).length})' "$SID:rec-1"
  q "$EV/E414S1-12-after.jsonl" '({listed: res("q1").value.approvals.some(a=>a.id===A[0]), archive: res("q1").value.archive.filter(r=>r.id===A[0]).map(r=>[r.kind, r.subject, r.text, r.reason, r.outcome])})' "$SID:rec-1"
}
k13() {   # p2: two requests of one session are two records; replay adds none; needsYou counts each once
  for c in a b; do printf '{"op":"raise","harness":"opencode","session":"qa-oc","request":{"id":"dup","kind":"command","subject":{"command":"echo one"},"choices":["once","deny"]}}\n' | rc "13-$c"; done
  printf '{"type":"inbox.list"}\n{"type":"hub.status"}\n' | fc > "$EV/E414S1-13-base.jsonl"
  printf '{"op":"raise","harness":"opencode","session":"qa-oc","request":{"id":"fc-1","kind":"file change","subject":{"files":["a.txt"],"change":"+hello\\n-world"},"choices":["once","deny"]}}\n' | rc 13-c
  printf '{"op":"waiting","harness":"opencode","session":"qa-oc"}\n' | rc 13-d
  sleep 1; printf '{"type":"inbox.list"}\n{"type":"hub.status"}\n' | fc > "$EV/E414S1-13-two.jsonl"
  printf '{"op":"raise","harness":"codex","session":"qa-codex","request":{"id":"dup","kind":"command","subject":{"command":"echo one"},"choices":["once","deny"]}}\n' | rc 13-e
  sleep 1; printf '{"type":"inbox.list"}\n{"type":"hub.status"}\n' | fc > "$EV/E414S1-13-three.jsonl"
  printf '{"op":"close","harness":"opencode","session":"qa-oc","request":"dup","outcome":{"choice":"once","by":"human","via":"harness","at":"%s"}}\n' "$(now)" | rc 13-f
  sleep 1; printf '{"type":"inbox.list"}\n{"type":"hub.status"}\n' | fc > "$EV/E414S1-13-after.jsonl"
  for c in base two three after; do q "$EV/E414S1-13-$c.jsonl" '({stage: A[0], needsYou: res("q1").value.needsYou, status: res("q2").value.needsYou, ocRows: res("q1").value.approvals.filter(a=>a.session==="qa-oc").map(a=>[a.id, a.kind, a.subject]), dupIds: res("q1").value.approvals.filter(a=>a.id.endsWith(":dup")).map(a=>a.id)})' "$c"; done
  echo "qa-oc $(cat "$Q/sid-qa-oc")  qa-codex $(cat "$Q/sid-qa-codex")"
}
k14() {   # p2: the 64 KiB subject cap and the allowlist
  SID=$(cat "$Q/sid-qa-codex")
  node -e 'const root=process.argv[1];process.stdout.write(JSON.stringify({op:"raise",harness:"codex",session:"qa-codex",request:{id:"huge",kind:"command",subject:{command:"echo 🚀".repeat(14000),cwd:root,reason:"Long approval",files:["one.ts","two.ts"],change:"+new\n-old",privateInput:"PRIVATE-NATIVE-BODY"},choices:["once"],privateInput:"PRIVATE-TOOL-BODY"}})+"\n")' "$PWD" | rc 14-huge
  printf '{"op":"raise","harness":"codex","session":"qa-codex","request":{"id":"patch","kind":"file change","subject":{"cwd":"%s","files":["one.ts","two.ts"],"change":"+new\\n-old","reason":"Review patch","input":"PRIVATE-FILE-BODY"},"choices":["once","deny"]}}\n' "$PWD" | rc 14-patch
  sleep 1; fc '["snapshot","numbered-deltas"]' < /dev/null > "$EV/E414S1-14-snap.jsonl"
  q "$EV/E414S1-14-snap.jsonl" '(()=>{const s=snap("inbox").value, h=s.approvals.find(a=>a.id===A[0]+":huge"), p=s.approvals.find(a=>a.id===A[0]+":patch"), orig="echo 🚀".repeat(14000), bytes=Buffer.byteLength(JSON.stringify(h.subject));return {hugeBytes: bytes, underCap: bytes<=65536, prefix: orig.startsWith(h.command), cut: h.command.length<orig.length, topEqualsSubject: h.command===h.subject.command, loneHighSurrogateAtEnd: /[\uD800-\uDBFF]$/.test(h.command), hugeKeys: Object.keys(h.subject).sort(), patch: p.subject, privateInSnapshot: JSON.stringify(F).includes("PRIVATE-")};})()' "$SID"
}
k15() {   # p2: cland inbox and cland inbox --archive against the rig
  S2=$(cat "$Q/sid-qa-codex2"); SOC=$(cat "$Q/sid-qa-oc"); SID=$(cat "$Q/sid-qa-codex"); AT=$(cat "$Q/at-rec1")
  cland inbox > "$EV/E414S1-15-inbox.txt"; cland inbox --json > "$EV/E414S1-15-inbox.json"; cland inbox --archive > "$EV/E414S1-15-archive.txt"
  printf 'idle row: '; grep -c -F "approval $S2:idle-1  qa-codex2  echo idle  pending  once, deny  from " "$EV/E414S1-15-inbox.txt"
  printf 'file change row: '; grep -c -F "approval $SOC:fc-1  qa-oc  +hello  pending  once, deny  from " "$EV/E414S1-15-inbox.txt"
  printf 'archived rec-1: '; grep -c -F "  approval $SID:rec-1  qa-codex  git status  · closed  deny by human via harness at $AT: Keep the tree" "$EV/E414S1-15-archive.txt"
  tail -n 1 "$EV/E414S1-15-inbox.txt"
  node -e 'console.log("json needsYou "+JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).needsYou)' "$EV/E414S1-15-inbox.json"
}
k16() {   # p2: Approve once reaches the adapter once; the answering client and R1 read the same closed outcome
  SID=$(cat "$Q/sid-qa-codex")
  printf '{"op":"raise","harness":"codex","session":"qa-codex","request":{"id":"once-1","kind":"command","subject":{"command":"echo safe"},"choices":["once","deny"]}}\n' | rc 16-raise
  printf '{"type":"approval.answer","approval":"%s","choice":"once"}\n{"type":"inbox.list"}\n' "$SID:once-1" | fc > "$EV/E414S1-16.jsonl"
  sleep 2; printf '{"op":"answers"}\n' | rc 16-answers
  q "$EV/E414S1-16.jsonl" '({result: [res("q1").ok, res("q1").value?.approval?.id===A[0], res("q1").value?.approval?.state, res("q1").value?.approval?.outcome], listed: res("q2").value.approvals.some(a=>a.id===A[0])})' "$SID:once-1"
  q "$EV/E414S1-R1.jsonl" '({states: ap(A[0]).map(a=>a.state), outcomes: ap(A[0]).filter(a=>a.state!=="pending").map(a=>a.outcome)})' "$SID:once-1"
  q "$EV/E414S1-R1.jsonl" 'answers("codex","once-1")'
}
k17() {   # p2: two clients answer one request on one start line; the adapter holds; exactly one wins
  SID=$(cat "$Q/sid-qa-codex"); RID="$SID:race-1"
  printf '{"op":"raise","harness":"codex","session":"qa-codex","request":{"id":"race-1","kind":"command","subject":{"command":"echo race"},"choices":["once","always","deny"]}}\n' | rc 17-raise
  printf '{"op":"script","harness":"codex","outcomes":["hold"]}\n' | rc 17-hold
  for c in A:once B:deny; do printf '{"type":"subscribe"}\n{"qa":"file","path":"%s"}\n{"type":"approval.answer","approval":"%s","choice":"%s"}\n' "$Q/go17" "$RID" "${c#*:}" | QA_STREAM=1 QA_RESULT_MS=90000 fc > "$EV/E414S1-17-${c%%:*}.jsonl" & done
  seen "$EV/E414S1-17-A.jsonl" '"type":"result","id":"q1"' && seen "$EV/E414S1-17-B.jsonl" '"type":"result","id":"q1"' || return 1
  touch "$Q/go17"
  for i in $(seq 1 120); do grep -q -F 'approval already answered by' "$EV/E414S1-17-A.jsonl" "$EV/E414S1-17-B.jsonl" && break; sleep 0.5; done
  sleep 1; printf '{"op":"answers"}\n' | rc 17-before-settle
  printf '{"op":"settle","harness":"codex","session":"qa-codex","request":"race-1","outcome":"accept"}\n' | rc 17-settle
  wait
  printf '{"type":"approval.answer","approval":"%s","choice":"always"}\n{"type":"inbox.list","archive":true}\n' "$RID" | fc > "$EV/E414S1-17-late.jsonl"
  for c in A B; do q "$EV/E414S1-17-$c.jsonl" '[A[0], res("q2")?.ok ?? null, res("q2")?.error ?? null, res("q2")?.value?.approval?.outcome ?? null, F.find(f=>f.type==="qa-file")?.at]' "$c"; done
  q "$EV/E414S1-R1.jsonl" '({states: ap(A[0]).map(a=>a.state), outcomes: ap(A[0]).filter(a=>a.state!=="pending").map(a=>a.outcome)})' "$RID"
  q "$EV/E414S1-17-late.jsonl" '({late: [res("q1").ok, res("q1").error], archive: res("q2").value.archive.filter(r=>r.id===A[0]).map(r=>r.outcome)})' "$RID"
  q "$EV/E414S1-R1.jsonl" 'rig().filter(r=>["17-before-settle.json","17-settle.json"].includes(r.n)).map(r=>[r.n, (r.answers.codex??[]).filter(a=>a.requestId==="race-1").map(a=>a.choice)])'
}
k18() {   # p2: an unoffered choice and a closed record are refused; nothing changes; nothing reaches the adapter
  SID=$(cat "$Q/sid-qa-codex")
  printf '{"op":"raise","harness":"codex","session":"qa-codex","request":{"id":"limited-1","kind":"command","subject":{"command":"echo limited"},"choices":["once","deny"]}}\n' | rc 18-raise
  printf '{"type":"inbox.list"}\n{"type":"approval.answer","approval":"%s","choice":"always"}\n{"type":"inbox.list"}\n{"type":"approval.answer","approval":"%s","choice":"deny"}\n' "$SID:limited-1" "$SID:once-1" | fc > "$EV/E414S1-18.jsonl"
  printf '{"op":"answers"}\n' | rc 18-answers
  q "$EV/E414S1-18.jsonl" '({unoffered: [res("q2").ok, res("q2").error], unchanged: JSON.stringify(res("q1").value.approvals)===JSON.stringify(res("q3").value.approvals), limitedState: res("q3").value.approvals.find(a=>a.id===A[0])?.state, closed: [res("q4").ok, res("q4").error]})' "$SID:limited-1"
  q "$EV/E414S1-R1.jsonl" '[answers("codex","limited-1").length, answers("codex","once-1").length]'
}
k19() {   # p2: every agent role is refused, on the socket (as) and through two real spokes (Implementer, Aide)
  SID=$(cat "$Q/sid-qa-codex"); RID="$SID:agent-1"; echo "$RID" > "$Q/rec19"
  printf '{"op":"raise","harness":"codex","session":"qa-codex","request":{"id":"agent-1","kind":"command","subject":{"command":"echo agents"},"choices":["once","deny"]}}\n' | rc 19-raise
  printf '{"type":"task.create","kind":"epic","title":"QA fixture epic"}\n' | fc > "$EV/E414S1-19-epic.jsonl"
  EPIC=$(qv "$EV/E414S1-19-epic.jsonl" 'res("q1").value.item.id')
  printf '{"type":"session.launch","name":"agent-%s","harness":"opencode","role":"%s"}\n' coordinator coordinator reviewer reviewer qa qa aide aide > "$Q/steps/19-launch.jsonl"
  printf '{"type":"session.launch","name":"agent-lead","harness":"opencode","role":"lead","item":"%s"}\n{"type":"session.list"}\n' "$EPIC" >> "$Q/steps/19-launch.jsonl"
  fc < "$Q/steps/19-launch.jsonl" > "$EV/E414S1-19-launch.jsonl"
  node -e 'const fs=require("fs");const F=fs.readFileSync(process.argv[1],"utf8").split("\n").filter(Boolean).map(l=>JSON.parse(l));const ps=F.find(f=>f.type==="result"&&f.id==="q6").value.processes;const out=[{type:"inbox.list"},...ps.map(p=>({type:"approval.answer",approval:process.argv[2],choice:"once",as:{name:p.name,sessionId:p.sessionId,shell:true}})),{type:"inbox.list"}];process.stdout.write(out.map(o=>JSON.stringify(o)).join("\n")+"\n")' "$EV/E414S1-19-launch.jsonl" "$RID" > "$Q/steps/19-as.jsonl"
  fc < "$Q/steps/19-as.jsonl" > "$EV/E414S1-19-as.jsonl"
  printf '{"tool":"approval.answer","args":{"approval":"@file:rec19","choice":"once"}}\n' > "$Q/steps/19-drv.jsonl"
  for r in implementer aide; do node "$Q/drv.mjs" "$PWD" "qa-$r" "$r" 0 < "$Q/steps/19-drv.jsonl" > "$EV/E414S1-19-drv-$r.txt" 2> "$EV/E414S1-19-drv-$r.err"; done
  printf '{"type":"inbox.list"}\n' | fc > "$EV/E414S1-19-after.jsonl"
  printf '{"op":"answers"}\n' | rc 19-answers
  q "$EV/E414S1-19-launch.jsonl" '[1,2,3,4,5].map(i=>[res("q"+i).ok, res("q"+i).value?.process?.name ?? res("q"+i).error])'
  q "$EV/E414S1-19-as.jsonl" '(()=>{const n=F.filter(f=>f.type==="qa-send").length, out=[];for(let i=2;i<n;i++){const r=res("q"+i), fr=F.find(f=>f.type==="qa-send"&&f.frame.id==="q"+i).frame;out.push([fr.as.name, r.ok, r.error])}return {answers: out, unchanged: JSON.stringify(res("q1").value.approvals)===JSON.stringify(res("q"+n).value.approvals)};})()'
  for r in implementer aide; do q "$EV/E414S1-19-drv-$r.txt" '[A[0], F.some(f=>f.ready), F.filter(f=>f.tool==="approval.answer"||f.step).map(f=>f.tool ? ["tool", f.result?.ok ?? null, f.result?.error ?? null] : ["error", f.error])]' "$r"; done
  q "$EV/E414S1-19-after.jsonl" 'res("q1").value.approvals.find(a=>a.id===A[0])?.state' "$RID"
  q "$EV/E414S1-R1.jsonl" 'answers("codex","agent-1").length'
}
k20() {   # p2: the web edge's cookie client answers as the human; `as` on the web edge is refused
  SID=$(cat "$Q/sid-qa-codex")
  for r in web-1 web-2; do printf '{"op":"raise","harness":"codex","session":"qa-codex","request":{"id":"%s","kind":"command","subject":{"command":"echo web"},"choices":["once","always","deny"]}}\n' "$r" | rc "20-$r"; done
  printf '{"type":"approval.answer","approval":"%s","choice":"always","note":"QA web"}\n{"type":"approval.answer","approval":"%s","choice":"once","as":{"name":"human"}}\n' "$SID:web-1" "$SID:web-2" | node "$Q/wc.mjs" "$PWD" > "$EV/E414S1-20-web.jsonl" 2> "$EV/E414S1-20-web.err"
  printf '{"type":"approval.answer","approval":"%s","choice":"deny"}\n{"type":"inbox.list"}\n' "$SID:web-1" | fc > "$EV/E414S1-20-local.jsonl"
  printf '{"op":"answers"}\n' | rc 20-answers
  q "$EV/E414S1-20-web.jsonl" '({signedIn: F.some(f=>f.type==="qa-signed-in"), welcome: F.find(f=>f.type==="welcome")?.name, w1: [res("w1")?.ok, res("w1")?.value?.approval?.state, res("w1")?.value?.approval?.outcome], w2: [res("w2")?.ok, res("w2")?.code, res("w2")?.error]})'
  q "$EV/E414S1-20-local.jsonl" '({late: [res("q1").ok, res("q1").error], web2: res("q2").value.approvals.find(a=>a.id===A[0])?.state})' "$SID:web-2"
  q "$EV/E414S1-R1.jsonl" '[answers("codex","web-1").map(a=>[a.choice, a.note]), answers("codex","web-2").length]'
}
k21() {   # p2: a failed delivery returns the record to pending, refuses with the reason and journals a warning
  SID=$(cat "$Q/sid-qa-codex"); RID="$SID:fail-1"
  printf '{"op":"raise","harness":"codex","session":"qa-codex","request":{"id":"fail-1","kind":"command","subject":{"command":"echo retry"},"choices":["once","deny"]}}\n' | rc 21-raise
  printf '{"op":"script","harness":"codex","outcomes":["fail"]}\n' | rc 21-fail
  printf '{"type":"inbox.list"}\n{"type":"approval.answer","approval":"%s","choice":"deny","note":"Keep it local"}\n{"type":"inbox.list"}\n{"type":"events.list"}\n{"type":"approval.answer","approval":"%s","choice":"deny"}\n{"type":"inbox.list","archive":true}\n' "$RID" "$RID" | fc > "$EV/E414S1-21.jsonl"
  sleep 1; printf '{"op":"answers"}\n' | rc 21-answers
  q "$EV/E414S1-21.jsonl" '(()=>{const before=res("q1").value.approvals.find(a=>a.id===A[0]), after=res("q3").value.approvals.find(a=>a.id===A[0]), warn=res("q4").value.rows.filter(r=>String(r.text).includes("approval answer failed: fake approval delivery failed"));return {refused: [res("q2").ok, res("q2").error], restored: JSON.stringify(before)===JSON.stringify(after), state: after?.state, outcome: after?.outcome ?? null, warnRows: warn.map(r=>[r.id, r.warning]), retry: [res("q5").ok, res("q5").value?.approval?.outcome], archive: res("q6").value.archive.filter(r=>r.id===A[0]).map(r=>r.outcome)};})()' "$RID"
  q "$EV/E414S1-R1.jsonl" '({states: ap(A[0]).map(a=>[a.state, a.outcome?.choice ?? null, a.outcome?.note ?? null]), events: F.filter(f=>f.type==="event"&&String(f.row?.text).includes("approval answer failed")).map(f=>[f.row.id, f.row.warning, f.row.text])})' "$RID"
  q "$EV/E414S1-R1.jsonl" 'answers("codex","fail-1").map(a=>[a.choice, a.note ?? null])'
}
k22() {   # p2: a Deny note the native protocol cannot carry becomes the human's message; the byte cap is checked first
  SOC=$(cat "$Q/sid-qa-oc")
  printf '{"op":"notes","harness":"opencode","value":false}\n' | rc 22-nonotes
  printf '{"op":"raise","harness":"opencode","session":"qa-oc","request":{"id":"note-1","kind":"command","subject":{"command":"rm important"},"choices":["once","deny"]}}\n' | rc 22-raise1
  node -e 'const id=process.argv[1];const out=[{type:"inbox.list"},{type:"approval.answer",approval:id,choice:"deny",note:"🚀".repeat(2049)},{type:"inbox.list"},{type:"approval.answer",approval:id,choice:"deny",note:"QA keep this file"},{type:"topic.history",topic:"general"}];process.stdout.write(out.map(o=>JSON.stringify(o)).join("\n")+"\n")' "$SOC:note-1" > "$Q/steps/22.jsonl"
  fc < "$Q/steps/22.jsonl" > "$EV/E414S1-22-a.jsonl"
  printf '{"op":"answers"}\n' | rc 22-mid
  printf '{"op":"notes","harness":"opencode","value":true}\n' | rc 22-notes
  printf '{"op":"raise","harness":"opencode","session":"qa-oc","request":{"id":"note-2","kind":"command","subject":{"command":"rm other"},"choices":["once","deny"]}}\n' | rc 22-raise2
  printf '{"type":"approval.answer","approval":"%s","choice":"deny","note":"QA native note"}\n{"type":"topic.history","topic":"general"}\n' "$SOC:note-2" | fc > "$EV/E414S1-22-b.jsonl"
  printf '{"op":"answers"}\n' | rc 22-answers
  q "$EV/E414S1-22-a.jsonl" '({oversize: [res("q2").ok, res("q2").error], unchanged: JSON.stringify(res("q1").value.approvals)===JSON.stringify(res("q3").value.approvals), corrected: [res("q4").ok, res("q4").value?.approval?.outcome], notes: res("q5").value.messages.filter(m=>m.text==="QA keep this file").map(m=>({from: m.from, fromKind: m.fromKind, to: m.to}))})'
  q "$EV/E414S1-22-b.jsonl" '({native: [res("q1").ok, res("q1").value?.approval?.outcome?.note], posted: res("q2").value.messages.filter(m=>m.text==="QA native note").length})'
  q "$EV/E414S1-R1.jsonl" '({mid: (rig().find(r=>r.n==="22-mid.json").answers.opencode??[]).filter(a=>a.requestId==="note-1").map(a=>[a.choice, a.note]), note1: answers("opencode","note-1").map(a=>[a.choice, a.note]), note2: answers("opencode","note-2").map(a=>[a.choice, a.note])})'
}
k23() {   # p2: ten minutes later the untouched request is still pending, unanswered; no private input anywhere
  S2=$(cat "$Q/sid-qa-codex2"); T0=$(cat "$Q/idle-raised"); NOW=$(date -u +%s)
  [ $((NOW - T0)) -ge 600 ] || sleep $((600 - NOW + T0))
  printf '{"type":"inbox.list"}\n' | fc > "$EV/E414S1-23.jsonl"
  printf '{"op":"answers"}\n' | rc 23-answers
  q "$EV/E414S1-23.jsonl" '(()=>{const a=res("q1").value.approvals.find(x=>x.id===A[0]), b=fs.readFileSync(A[1],"utf8").split("\n").filter(Boolean).map(l=>JSON.parse(l)).find(f=>f.type==="result"&&f.id==="q1").value.approvals.find(x=>x.id===A[0]), core=r=>JSON.stringify([r.id,r.sessionId,r.harness,r.kind,r.subject,r.choices,r.answerIn,r.since,r.state,r.outcome??null]);return {waitedS: Math.floor((Date.now()-Date.parse(a.since))/1000), state: a.state, outcome: a.outcome ?? null, sameAsRaised: JSON.stringify(a)===JSON.stringify(b), sameCore: core(a)===core(b)};})()' "$S2:idle-1" "$EV/E414S1-11-idle.jsonl"
  q "$EV/E414S1-R1.jsonl" '[answers("codex","idle-1").length, ap(A[0]).map(a=>a.state)]' "$S2:idle-1"
  printf 'private in captures: '; cat "$EV"/E414S1-* | grep -c -E 'PRIVATE-(QA|NATIVE|TOOL|FILE)'
}
k24() {   # docs, in QA's own shell
  dc() { printf '%s | %s: ' "$1" "$2"; grep -c -F -- "$2" "$W/$1"; }
  dc hub/README.md 'Native record ids are `<sessionId>:<nativeRequestId>`'
  dc hub/README.md 'Claude Code always uses `answerIn: tui` with no choices.'
  dc hub/README.md 'limiting the UTF-8 JSON subject to 64 KiB; no other tool input is carried.'
  dc hub/README.md 'approval {approval: ApprovalRecord}'
  dc hub/README.md 'A closed record carries `outcome: {choice, note?, by, via, at}`'
  dc hub/README.md '| approvalRelay | none: approvals stay in the TUI; their records carry `answerIn: tui`, shown as `answer in Neovim` |'
  dc hub/README.md '`approval.answer {id, approval, choice, note?}` is a human-only client frame'
  dc hub/README.md 'Every agent session, Aides included, is refused'
  dc hub/README.md 'The gate reserves the first valid answer synchronously'
  dc hub/README.md 'A competing or later answer is refused with `approval already answered by <by> via <via> at <at>`'
  dc hub/README.md 'Nothing answers an approval on a timer or by default'
  dc hub/README.md 'journals `approval-answer-failed` at warn level'
  dc hub/README.md "the hub posts it as a human message addressed to the session in its item's topic, otherwise General"
  dc nvim/README.md 'Claude Code records have `answerIn: tui` and no choices: Enter on their inbox row still attaches that session.'
  dc hub/src/cli/usage.ts 'closed approvals include outcome, who answered and when'
  dc hub/src/cli/usage.ts 'approvals are answered by the human in Neovim or the web'
}
k25() {   # cleanup: stop the clients, the rig and p1's hub; judge the fixture-owned census only
  touch "$Q/stop-s1" "$Q/stop-r1"; sleep 2; touch "$Q/rig/stop"
  seen "$EV/rig.log" 'exit '; tail -n 1 "$EV/rig.log"; grep -E '^# (tests|pass|fail) ' "$EV/rig.log"
  ( cd "$Q/p1" && cland hub stop ); sleep 2
  sort -u "$Q/pids" | while read -r p; do [ -n "$p" ] && kill -0 "$p" 2>/dev/null && echo "alive $p $(ps -o command= -p "$p")"; done
  echo "census of $(sort -u "$Q/pids" | grep -c .) fixture pids done"
}
```

Cleanup after the evidence is recorded: print `$Q`, check it begins with `/private/tmp/qa-e414s1-`, and remove it by that literal path with a non-force `rm -r`. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). The scratch hubs' secrets in `$Q/p1/.cland/hub.json` and the rig's `.cland/hub.json`, the sign-in link and the cookie are never printed or posted.

## Cases

none. No headless-grid case in `qa/cases/` covers approval records or answers; every check below is a manual check against a scratch hub, a named test file or the docs. Neovim's side (Enter on a recorded Claude Code approval row, the recordings) runs through its named headless tests, not through `qa-record.sh run`.

### Web cases (when in scope)

none. This stage has no web UI; the web edge is checked as a protocol client in E414S1-20 and the named web authority tests.

## Manual checks

Record each with `sh .agents/skills/qa/qa-record.sh note E-414 "$RUN" <id> hub-api "<command>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence-file…>`, run from `$W` in QA's own shell; name where it ran at the start of the command text (`[p1]`, `[p2]`, `[test $W]`, `[docs]`, `[QA shell]`). The recorder takes `hub-api` for every check here; the `via` column says which client the check speaks through. Save each check's printed output as `$EV/<id>.txt` (pipe the row's command through `tee`) and name it, with the captures the function wrote, as evidence.

How to run a row, by its `where`:
- **p1**: `( . "$Q/env.sh"; cd "$Q/p1" && <command> )`.
- **p2**: `( . "$Q/env.sh"; cd "$P2" && <command> )`, after E414S1-11 set `P2`.
- **test $W**: in QA's own shell; `nt` runs `quiet` first and seals the test run itself. Judge each by its `exit` line, the TAP summary counts and the named tests on `ok` lines (`oks <id>` lists them; a name that appears on no `ok` line proves nothing).
- **docs** and **QA shell**: in QA's own shell, as QA; E414S1-00's plan read is the only check that touches the live hub, and only to read.

Order: E414S1-00, then the rows in id order. Values later rows reuse live in `$Q` (record and session ids) and `$EV` captures. E414S1-06 starts the streaming client S1 (p1) and E414S1-11 the streaming client R1 (p2); they run until E414S1-10 and E414S1-25 stop them. E414S1-09 waits until p1's record has waited 180 s; E414S1-23 waits until 600 s after E414S1-11 raised `idle-1`.

| id | surface | via | where | command | expected |
| --- | --- | --- | --- | --- | --- |
| E414S1-00 | hub-api | git, CLI (one live read), scratch CLI | QA shell; p1 | `git -C "$W" rev-parse HEAD refs/heads/dev; git -C "$W" status --porcelain \| grep -v -x '?? node_modules' \| wc -l; (cd "$W" && node hub/bin/cland.ts task plan show E-414 --json) > "$EV/E414S1-00-plan.json"; node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=v.stages.find(x=>x.name==="record and gate");console.log(JSON.stringify({stages: v.stages.map(x=>x.name), state: s.state, qa: s.qa, merged: s.merged, total: s.total, items: s.items}))' "$EV/E414S1-00-plan.json" \| tee "$EV/E414S1-00-stage.txt"; for i in $(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).stages.find(x=>x.name==="record and gate").items.join(" "))' "$EV/E414S1-00-plan.json"); do echo "== $i"; git -C "$W" log --first-parent --oneline --grep "Item: $i" dev; done; grep -c -F "'approval.answer': true" "$W/hub/src/hub/web-authority.ts"; grep -c -F 'scriptApproval' "$W/hub/test/fakes/harness.ts"; grep -c -F 'answerApproval' "$W/hub/src/hub/inbox.ts"; ls "$W/hub/test/approval-records.test.ts" "$W/hub/src/hub/approval-subject.ts" "$W/nvim/test/fixtures/protocol-frames/inbox-actions.json"; echo "TMPDIR=$TMPDIR Q=$Q"; cat "$EV/E414S1-00-p1-start.txt"; wc -l < "$Q/pids"; ( . "$Q/env.sh"; cd "$Q/p1" && cland hub status )` | Build, merges and sealing. Both SHAs equal `$S`; `0` changed paths. The plan lists the stages `record and gate`, `relays and Neovim`, `races and restarts`; stage `record and gate` has `qa` `{scope: "affected", when: "after-stage"}`, `state: "open"` (it closes only after this verdict and the covers), `items` T-1109, T-1110 plus any findings fixes the request names (nothing else), `total` equal to the number of printed items and `merged` equal to `total`. Under every `== <id>` line exactly one commit line (T-1109 `4ce407b9`; a missing T-1110 line is BLOCKED). The three greps print at least `1` each; the three files exist. `TMPDIR` is the system default (not `/tmp`) and `$Q` begins `/private/tmp/qa-e414s1-`. p1's init exited 0; the two config greps in the p1 block printed `1` and `1`; `p1 hub start exit 0`; the census holds at least `1` pid; `hub status` reports a running hub for `$Q/p1`. Also record the two counts the sealed-environment block printed before any scratch process started: the first at least `1`, the second `0`, and `helpers parse` |
| E414S1-01 | hub-api | named tests (sealed `projectHub`, real frame clients, in-process fake adapters, the CLI) | test $W | `nt E414S1-01 hub/test/approval-records.test.ts; oks E414S1-01` | Both items at the test seam. `exit 0`; `# fail 0`, `# cancelled 0`, `# skipped 0`, `# pass` equal to `# tests` (18 at writing). On `ok` lines: "Claude Code waiting episode is one stable TUI approval record in the snapshot", "adapter requests publish one approval delta and inbox row, then archive the harness outcome", "two pending requests of one session count once each, and native ids are scoped to the session", "TUI waiting episodes close without claiming consent and a later wait gets its own record", "public approval subjects cap UTF-8 at 64 KiB, preserve small changes and exclude private tool input", "inbox CLI prints approval states, choices, TUI routing and archived outcome attribution", "a native approval keeps its identity and attachment while the owning session is renamed", "a human answer reaches the adapter once and both clients observe the attributed closed record", "two clients in one tick reserve one winner before adapter confirmation and refuse the loser with attribution", "unoffered choices and TUI-only approvals refuse answers without changing their records", "only the human may answer: every agent role including Aides is refused on socket and spoke", "failed adapter delivery returns to pending, refuses with the reason and journals a warning before a human retry", "deny remains deny and a note the native protocol cannot carry is a human message to the session in General", "a pending request has no default answer after 24 hours of fake time", "a deny note follows the session claim to its item topic and native note support avoids a duplicate message", "adapter close confirmation during delivery preserves the reserved human outcome and publishes one close", and "an oversized fallback note is refused before delivering deny and can be corrected (cap 8192)" and "(cap 1024)" |
| E414S1-02 | hub-api | named tests (authenticated web cookie and Unix socket against an in-process hub; pure policy) | test $W | `nt E414S1-02 hub/test/web-authority.test.ts hub/test/web-authority-unit.test.ts; oks E414S1-02` | T-1110 C4 at the test seam. `exit 0`; `# fail 0`, `# cancelled 0`, `# skipped 0`, `# pass` equal to `# tests` (37 at writing: 33 and 4). On `ok` lines: "the authenticated web cookie answers an approval as the human through the common gate", "web refuses as on the initial hello and still requires a valid human hello" and "the web allows human workbench reads, writes, queued verification and merge" |
| E414S1-03 | hub-api | named tests (headless Neovim against the stub hub's recorded frames; recorded frames against an in-process real hub); git | test $W | `nt E414S1-03 nvim/test/inbox-actions.test.ts; oks E414S1-03; nt E414S1-03-drift --test-name-pattern='recorded protocol fixtures match the live hub attach frames' nvim/test/scenarios/workbench.test.ts; oks E414S1-03-drift; git -C "$W" show --stat --format=%H $(git -C "$W" log --first-parent --format=%H --grep 'Item: T-1109' dev) -- nvim/test/fixtures nvim/test/inbox-actions.test.ts` | T-1109 C7 and C8. First run: `exit 0`; `# fail 0`, `# cancelled 0`, `# skipped 0` (a skip means no pinned Neovim: BLOCKED, not PASS), `# pass` equal to `# tests`; "Enter on a recorded Claude Code approval requests attachment of that session" `ok` (Enter on a recorded `answerIn: tui` row with `command: echo review me` sends `session.attach` for `worker` and the centre view becomes that session). Second run: `exit 0`; `# tests 1`, `# pass 1`, `# fail 0`, `# skipped 0`; "recorded protocol fixtures match the live hub attach frames" `ok`: every recorded Neovim protocol frame, the refreshed inbox recordings included, is what a real hub produces at this build. The `git show --stat` of T-1109's landing commit lists `nvim/test/fixtures/protocol-frames.json`, `nvim/test/fixtures/protocol-frames/inbox-actions.json` and `nvim/test/inbox-actions.test.ts`: the recordings were refreshed with the item |
| E414S1-04 | hub-api | named tests (regression for the changed fake clock, fake adapter, inbox and needs-you) | test $W | `nt E414S1-04 hub/test/clock.test.ts hub/test/project-clock.test.ts hub/test/fake-harness.test.ts hub/test/inbox-requests.test.ts hub/test/inbox-requests-component.test.ts nvim/test/needs-you.test.ts nvim/test/inbox-requests.test.ts; oks E414S1-04 \| grep -F 'FakeClock delivers a blocked interval once'` | Regression. `exit 0`; `# fail 0`, `# cancelled 0`, `# skipped 0` (a Neovim skip is BLOCKED), `# pass` equal to `# tests`. "FakeClock delivers a blocked interval once at wakeup and schedules its next tick in the future" is on an `ok` line (T-1110 changed `FakeClock` so an overdue interval fires once; the 24-hour no-default test in E414S1-01 relies on it). `hub/test/inbox-requests.test.ts` (changed by T-1109) passes with approval departures journaled as `approval:answered` |
| E414S1-05 | hub-api | static checks | test $W | `quiet && ( . "$Q/env.sh"; cd "$W" && node hub/test/lint-wire-imports.ts; echo "lint exit $?"; npm run typecheck > "$EV/E414S1-05.log" 2>&1; echo "typecheck exit $?" )` | Regression for the shared wire changes (`shared/wire/index.ts` and `hub/test/wire-conformance.ts` changed in T-1109; `shared/wire/index.ts` in T-1110). `lint exit 0` and `typecheck exit 0` with no diagnostics in the log |
| E414S1-06 | hub-api | CLI; frame clients (S1 streaming, one fresh featured); the production Claude Code adapter with the fake `claude` | p1 | `k06` | T-1109 C1, live. `launch exit 0`; no `timeout` line. The fresh snapshot's `inbox` section: `rows: 1`; `sessionId: true` and `idScoped: true` (the record's `sessionId` is the launched session's, its id is `<sessionId>:<episode>`); `harness: "claude-code"`, `kind: "command"`, `command: "touch approved"`, `subject: {command: "touch approved"}` (nothing else: no `content`), `answerIn: "tui"`, `choices: []`, `state: "pending"`, `outcome: null`; `attach` a non-empty string ending ` attach <harnessId>` with the printed `harnessId`; `needsYou` at least `1` |
| E414S1-07 | hub-api | CLI; frame client S1's stream | p1 | `k07` | The Claude Code approval shows once, marked to answer in Neovim (T-1109 C1, C5, C6). `row lines: 1`, `id mentions: 1`: `cland inbox` prints one row `approval <id>  qa-cc  touch approved  pending  answer in Neovim  from <label>  · <age>` under `Asks and approvals (n)`; its last line `needs you: N` with N equal to the printed `json needsYou`. S1: `ids` is exactly `[<the E414S1-06 id>]`, `pending` at least `1` and `identical: true` (every pending `approval` delta for it carries the same record), `inboxFrames` at least `1` and `maxRows: 1` (no inbox delta lists it twice). `private: 0`: the fake's `PRIVATE-TOOL-INPUT` (its `tool_input.content`) is in no frame |
| E414S1-08 | hub-api | frame client (the local human) | p1 | `k08` | T-1110 C3 for a TUI-only record, live. `once` and `deny` are each `[false, "this approval stays in the harness TUI; answer in Neovim"]`; `unknown` is `[false, "no pending approval"]`; `malformed` (choice `maybe`) is `[false, "unknown request type \"approval.answer\""]` (the frame fails validation); `unchanged: true`; `state: "pending"` |
| E414S1-09 | hub-api | frame clients; CLI; a TUI answer by `SIGUSR1` to the fake session | p1 | `k09` | T-1110 C7 (live wait), T-1109 C4 and C6, T-1110 C3 for a closed record, live. Waited: `state: "pending"`, `outcome: null`, `waitedS` at least `180`, `sameAsBefore: true` (nothing answered the record by itself). A `fake session pid` line, no `BLOCKED` line. S1: `states` ends `"pending"` then `"closed"` (pending deltas may repeat, all identical per E414S1-07), and `closed` is one outcome `{choice: "answered in the harness", by: "harness", via: "harness", at: T}`. Late: `[false, "approval already answered by harness via harness at T"]` with the same T; `listed: false`; `archive` one row `["approval", "answered", <that outcome>]`. `archive lines: 1` (`cland inbox --archive` prints `… approval <id>  qa-cc  touch approved  · closed  answered in the harness by harness via harness at T`). Second episode: `rows: 1`, `newId: true`, `sameSession: true`, `state: "pending"`, `answerIn: "tui"` (a later wait gets its own record) |
| E414S1-10 | hub-api | CLI; hub restart | p1 | `k10` | T-1109 C4 durability. `session stop exit 0`; `old hub <pid> exited`; `hub start exit 0` and `NEW` differs from `OLD`; `approval lines: 2` (the two episodes of E414S1-09) and `approval archive unchanged across the restart` |
| E414S1-11 | hub-api | the rig; frame clients (R1 streaming; launches) | QA shell; p2 | `quiet && ( . "$Q/env.sh"; cd "$W" && rigstart ) && P2=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).root)' "$Q/rig/ready") && case "$P2" in "$Q"/p2-*) echo "P2=$P2";; *) echo "BLOCKED: rig root $P2"; false;; esac && ( . "$Q/env.sh"; cd "$P2" && k11 )` | The rig serves (`P2=` under `$Q/p2-`) and takes commands. `launched`: three rows `[true, "qa-codex", "codex"]`, `[true, "qa-codex2", "codex"]`, `[true, "qa-oc", "opencode"]`. The `idle-1` record: id `<qa-codex2 sessionId>:idle-1`, `session: "qa-codex2"`, `harness: "codex"`, `kind: "command"`, `subject: {command: "echo idle"}`, `choices: ["once","deny"]`, `answerIn: "hub"`, `state: "pending"`, no outcome; `needsYou` equals `needsYou0 + 1`. The rig log's last line has `"ok":true` |
| E414S1-12 | hub-api | rig commands; frame clients (R1 stream, a fresh reader) | p2 | `k12` | T-1109 C2, C4 and C5, live. R1 for `<qa-codex sessionId>:rec-1`: `states` `["pending","closed"]`; `first` is the pending record with `sessionId` = qa-codex's, `session: "qa-codex"`, `harness: "codex"`, `kind: "command"`, `subject` exactly `{command: "git status\nprintf done", cwd: $P2, reason: "QA read worktree"}` (no `privateInput`), `command: "git status\nprintf done"`, `choices: ["once","always","deny"]`, `answerIn: "hub"`, `topic: "general"`; `closed` one outcome `{choice: "deny", note: "Keep the tree", by: "human", via: "harness", at: AT}` with the printed AT; `inboxWithRow` at least `1`, `inboxWithMore: 0`. After: `listed: false`; `archive` one row `["approval", "qa-codex", "git status", "answered", <that outcome>]` |
| E414S1-13 | hub-api | rig commands; frame client | p2 | `k13` | T-1109 C3, live. With N = base `needsYou` (two reports of `dup` already in: a replay adds no row, so base `ocRows` is one row `<qa-oc>:dup`): `two` has `needsYou` N+1 and `ocRows` two rows, `[<qa-oc>:dup, "command", {command: "echo one"}]` and `[<qa-oc>:fc-1, "file change", {files: ["a.txt"], change: "+hello\n-world"}]` (the state-only `waiting` signal adds no third row); `three` has N+2 and `dupIds` two different ids, `<qa-oc sessionId>:dup` and `<qa-codex sessionId>:dup` (native ids are scoped to their session); `after` (qa-oc's `dup` closed) has N+1 and `ocRows` only `fc-1`. In every stage `status` equals `needsYou` (`hub.status` agrees) |
| E414S1-14 | hub-api | rig commands; a fresh featured frame client | p2 | `k14` | T-1109 C5, the decision's 64 KB cap. `underCap: true` (`hugeBytes` at most `65536`), `prefix: true`, `cut: true`, `topEqualsSubject: true`, `loneHighSurrogateAtEnd: false`; `hugeKeys` includes `command` and only names from `command`, `cwd`, `files`, `reason`, `change`; `patch` exactly `{cwd: $P2, files: ["one.ts","two.ts"], change: "+new\n-old", reason: "Review patch"}`; `privateInSnapshot: false` |
| E414S1-15 | hub-api | CLI | p2 | `k15` | T-1109 C6 for records answered in the hub. `idle row: 1` (`approval <id>  qa-codex2  echo idle  pending  once, deny  from …`), `file change row: 1` (a file change shows its change's first line), `archived rec-1: 1` (`… approval <id>  qa-codex  git status  · closed  deny by human via harness at AT: Keep the tree`); the last inbox line is `needs you: N` with N equal to `json needsYou` |
| E414S1-16 | hub-api | frame client A (the local human); R1; the rig's adapter log | p2 | `k16` | T-1110 C1, live. `result` `[true, true, "closed", O]` with O = `{choice: "once", by: "human", via: "neovim", at: T}` (where: Neovim's local connection; when: T); `listed: false`. R1 (the second client): `states` `["pending","answering","closed"]` and `outcomes` `[O, O]`. The adapter got exactly one answer: `[{sessionId: <qa-codex>, requestId: "once-1", choice: "once"}]` |
| E414S1-17 | hub-api | two frame clients released by one file; R1; rig hold and settle | p2 | `k17` | T-1110 C2, live (the same-tick case is E414S1-01's). Of the two `[client, ok, error, outcome, released at]` rows, exactly one is `[_, true, null, O]` and the other `[_, false, "approval already answered by human via neovim at <O.at>", null]`, where O = `{choice: <the winner's choice: once for A, deny for B>, by: "human", via: "neovim", at}`; the two `released at` times are within 1 s. R1: `states` `["pending","answering","closed"]`, `outcomes` `[O, O]`. Late answer: `[false, "approval already answered by human via neovim at <O.at>"]`; `archive` `[O]`. The adapter: before settle and after, exactly one answer for `race-1`, `[O.choice]` (the loser never reached it) |
| E414S1-18 | hub-api | frame client; rig log | p2 | `k18` | T-1110 C3, live. `unoffered` `[false, "choice always is not offered by this approval"]`; `unchanged: true`; `limitedState: "pending"`; `closed` `[false, "approval already answered by human via neovim at <E414S1-16's T>"]`; adapter answers `[0, 1]` (none for `limited-1`; still only E414S1-16's for `once-1`) |
| E414S1-19 | hub-api | frame clients acting `as` every launched session; two driver sessions (Implementer, Aide) | p2 | `k19` | T-1110 C4 (agents), live, per the decision (only the human answers; Aides refused). Launches: five `[true, "agent-…"]` rows (coordinator, reviewer, qa, aide, lead). `answers`: one row per session in `session.list` (qa-codex, qa-codex2, qa-oc and the five agents), each `[<name>, false, <error matching /human\|permission\|forbidden/i>]`; `unchanged: true`. Each driver: `[<role>, true, [<one entry>]]` whose entry is `["tool", false or null, …]` or `["error", …]` (there is no agent tool for answering: an unknown-tool error is the expected refusal), never `["tool", true, …]`; a driver that never printed `ready` (second field `false`) makes the row INCONCLUSIVE with its `.err` file, not FAIL. The record's state is `"pending"`; adapter answers for `agent-1`: `0` |
| E414S1-20 | hub-api | cookie client on the web edge (no browser); frame client; rig log | p2 | `k20` | T-1110 C4 (web), live. `signedIn: true`, `welcome: "human"`; `w1` `[true, "closed", O]` with O = `{choice: "always", note: "QA web", by: "human", via: "web", at: T}`; `w2` `[false, "cli-neovim-only", "approval.answer lives in the CLI and Neovim: acts as another identity"]`. Local late answer: `[false, "approval already answered by human via web at T"]`; `web2: "pending"` (the refused `as` frame changed nothing). Adapter: `[[["always","QA web"]], 0]` |
| E414S1-21 | hub-api | frame client; R1 (events and deltas); rig script `fail` | p2 | `k21` | T-1110 C5, live. `refused` `[false, "fake approval delivery failed"]`; `restored: true`, `state: "pending"`, `outcome: null`; `warnRows` at least one `[<row id>, true]`; `retry` `[true, {choice: "deny", by: "human", via: "neovim", at}]` (no note); `archive` that outcome once. R1 `states`: `["pending",null,null]`, `["answering","deny","Keep it local"]`, `["pending",null,null]`, `["answering","deny",null]`, `["closed","deny",null]` in that order; `events` at least one `[<a warnRows id>, true, "approval answer failed: fake approval delivery failed"]`. Adapter: `[["deny","Keep it local"],["deny",null]]` (a Deny stayed a Deny) |
| E414S1-22 | hub-api | frame client; rig notes switch | p2 | `k22` | T-1110 C6, live. `oversize` `[false, <error containing "8196 bytes; the cap is 8192">]`; `unchanged: true`; `corrected` `[true, {choice: "deny", note: "QA keep this file", by: "human", via: "neovim", at}]`; `notes` exactly one `{from: "human", fromKind: "human", to: ["qa-oc"]}` (qa-oc has no item: General). `native` `[true, "QA native note"]` and `posted: 0` (a note the protocol carries is not repeated as a message). Adapter: `mid` `[["deny","QA keep this file"]]` (the oversized note never reached it), `note1` the same, `note2` `[["deny","QA native note"]]` |
| E414S1-23 | hub-api | frame client; R1; rig log | p2 | `k23` | T-1110 C7 (live wait) and T-1109 C5 (sweep). `waitedS` at least `600`, `state: "pending"`, `outcome: null`, `sameCore: true` (`sameAsRaised: false` is not a failure when only `label`, `role` or `attach` changed). Adapter answers for `idle-1`: `0`, and its R1 states are only `"pending"`. `private in captures: 0` (no `PRIVATE-QA-*`, `PRIVATE-NATIVE-*`, `PRIVATE-TOOL-*` or `PRIVATE-FILE-*` text in any capture of this run) |
| E414S1-24 | hub-api | docs | docs | `k24` | T-1109 C9 and T-1110 C8. Every count is at least `1`: `hub/README.md` describes the record, its id, the 64 KiB allowlist, the `approval` delta, the outcome, the Claude Code capability row, `approval.answer`, the human-only rule, the synchronous reservation and the refusal naming the winner, no default answer, the warn journal and the note fallback; `nvim/README.md` the TUI row and Enter; the CLI usage the archive outcome and who answers. Read the sections around each hit and record any statement that contradicts E414S1-06 to E414S1-23 as a finding |
| E414S1-25 | hub-api | process census | QA shell; p1; p2 | `( . "$Q/env.sh"; cd "$Q/p1" && k25 )` | Cleanup, judged by the fixture-owned census only (never a machine-wide `pgrep`). The rig's log ends `exit 0` with `# tests 1`, `# pass 1`, `# fail 0`; p1's hub stops; no `alive` line names a fixture process (a `cland` hub, `hub serve`, `fc.cjs`, `wc.mjs`, `drv.mjs`, `rig.test.mjs`, `cland-spoke` or `fake-claude` command); the census line counts every pid this run recorded. An `alive` line whose command is unrelated is pid reuse: record it, it is not a failure. Then remove `$Q` and the worktree as Setup says |

Re-check helper, test and file names with grep at the tested build: renames happen, and T-1110 landed after writing.

Before requesting QA, run `cland qa lint <brief>` with this filled brief at the build under test. The brief is complete only when qa lint passes at the build.

## Probes that mislead

- Process probes judge only the pids this run recorded in `$Q/pids` (hubs, the rig, frame and cookie clients, drivers and their spokes, the fake Claude Code session); another session's fixtures on this shared machine are never evidence either way.
- Edit existing keys in initialized configs (p1's `lock_path` and `executor`); never add a second `[verification]` table.
- Never treat the live project's `hub status` as evidence: the scratch hubs are the ones whose `.cland/hub.json` sits under `$Q/p1` and `$P2`. `fc.cjs`, `wc.mjs`, `hp` and `cland` read `.cland/hub.json` from the current directory; confirm `pwd` before each scratch row. After E414S1-10's restart, p1's hub has a new pid (recorded in the census).
- Model frames (`approval`, `inbox`, `message`, `event`, `session.*`) interleave with the frames a check causes: identify rows by record id, native request id, session name or result id, never by position or by "the last" frame. An action's interval ends at its own `result` frame; the coalesced `inbox` delta (about 250 ms later) and the rig's log line arrive after it and are found by id.
- Every frame client here is the local human on the Unix socket, which the hub records as `via: "neovim"`; only the cookie client on the web edge is `via: "web"`. That is the design, not a mislabel.
- E414S1-17's two clients run in separate processes, so their answers arrive milliseconds apart, not in one event-loop tick; the rig holds the winner's delivery so the outcome does not depend on which arrives first. The literal one-tick race is E414S1-01's "two clients in one tick …" test.
- The rig's fake adapters run inside the rig's process by design (the items' own seam, `docs/agents/tests.md`, "Approval record changes"); the native Codex and OpenCode relays are stage 2. A finding about the fakes themselves is outside this stage.
- An `outcome.at` is the hub's clock (or, for E414S1-12's harness close, the time QA passed in): compare it across the delta, the result, the refusal text, the archive and the CLI line, never with a message's `ts`.
- `QA_STREAM=1` captures are complete only after their client ends (`qa-end`); `q.cjs` leaves out an unfinished last line of a capture still being written. Without `QA_STREAM` a client prints everything at the end.
- A `sameAsRaised: false` in E414S1-23 can come from a presence refresh of `label`, `role` or `attach`; `sameCore` is the judgement.
- `nt` runs Node's TAP reporter so the `# tests`/`# pass` counters exist; the default spec reporter prints none. The named tests check the live hub's cover slot (`suite.slot` check) before running: an admission timeout is BLOCKED; retry after `quiet`. The rig is a `node --test` file and runs that same read-only check once at its start.
- "No skip": the hub test files here are platform-independent; the Neovim files (E414S1-03, and the two `nvim/test` files in E414S1-04) need the pinned Neovim and are BLOCKED, not PASS, without it.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log: not applicable, nothing here runs on a droplet. Speed criteria use measured wall times, never projections: this stage has none.
- Slots due or queued before the build count even when their results arrive later.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

Any real browser or GUI: this stage has no web UI (the approval cards are E-417's and E-418's), so no `real-browser` case and no Web test phase; the web edge is checked only as a protocol client. The native relays: Codex app-server and OpenCode permission answers, `serverRequest/resolved` and `permission.replied` (T-1111, T-1112, stage `relays and Neovim`); Neovim's choice keys and folded outcomes for relayed approvals and the capability table's relay rows (T-1114); answers given in a relayed harness's own TUI, concurrent answers against real harnesses, and records rebuilt after a hub restart while a request is pending (T-1113, stage `races and restarts`; E414S1-10 restarts p1 only after its records closed). A live Neovim workbench against a scratch hub (the items' Neovim seam is the recorded-client test and the fixture drift test). T-1109 C8's frame-count post in the item topic (a tracker record checked at review; QA checks the recordings themselves). The review and criterion marks on the items, the merge gate and duration budgets. The Linux and macOS stage covers (the Coordinator's `cland verify all --occasion stage`; QA runs no full suite). The epic's Definition-of-done demo, a separate run. Work landed on dev after the stage's items. The live project's tracker, hub, crew, `ui.json` and HOME.

Nothing in scope needs an authorization this brief does not give: a check that cannot run for lack of one is BLOCKED, not out of scope.

## Grants

none.

## Verdict

Fix nothing. Clear only when every check E414S1-00 to E414S1-25 passes. Otherwise not clear, naming the failing, blocked or inconclusive ids and findings. On the epic record one QA verdict with `--stage "record and gate"`, the full tested dev SHA, the unique run id and the case table. Stage QA carries no epic criterion marks. Report `qa clear E-414 stage record and gate` or `qa not clear E-414 stage record and gate` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
