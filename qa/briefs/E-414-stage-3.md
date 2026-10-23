# Stage QA brief: E-414 stage 3 — races and restarts

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash: start `bash` first and paste every block there (zsh reads `$S:q` or `$B:h` as a modifier, and sourcing the sealed `env.sh` from zsh aborts). The run is local, on macOS (BSD `sed -i ''`, the pinned Neovim of the main worktree).

This is E-414's last stage. The epic's Definition of done is a separate demo on a named dev commit (the qa skill's "Epic demos on a named dev commit"), not part of this run.

## Stage

- Epic: E-414 (the approvals relay, under R-377).
- Exact stage name: races and restarts.
- Items: T-1113 and T-1159, each in its own lane (two parallel lanes; no order between them). The run reads the stage's members from `task plan show E-414` (E414S3-00) and never from a number written here. Findings fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: the combined changed behaviour of the two items at the tested build, on top of stage 1's record and gate (E414S1, clear at `4411dcc9`) and stage 2's relays and Neovim keys (E414S2, clear at `d32c6a8f`, run `qa-s2-2026-10-23-1`, whose low docs finding is T-1159).
  - T-1113, the first answer wins against the harness and across hub restarts. A harness resolution seen while a hub answer is in flight wins: a Codex `serverRequest/resolved` observed before the adapter's response-write receipt, or an OpenCode reply refused as not found after an attached client answered, closes the record with the harness's outcome; the losing hub answer is refused naming who answered and when, and its choice and note never replace the winner (a losing Deny never becomes an approval, and its note is not posted). OpenCode's own HTTP reply receipt, not an equal choice in an event, confirms a hub answer. Pending records keep allowlisted metadata in `hub.db` (`inbox_waits.approval_json`): after a hub restart they come back with the same ids, subject and `since`; Codex's pending-request replay (after `thread/resume`) and OpenCode's parent and persisted child-owner snapshots reconcile them through `approvalsReconciled`; a request missing from a completed replay or snapshot closes as `answered in the harness`; an unfinished hub answer returns as pending. A restored record is not answerable until current native validation finishes (the journal's `approval-rebuilt` receipt); validation replaces subject, choices and routing, keeping id and `since`. Claude Code's state-only record keeps its id and command while its waiting state is recovered. Closed outcomes stay in the inbox archive across restarts. `hub/README.md` describes the race, the rebuild and Codex's protocol limitation; `docs/agents/tests.md` and `.agents/skills/implement/SKILL.md` describe the test seams. New test file `hub/test/approval-restart.test.ts` (T3).
  - T-1159, docs only: `hub/README.md`'s approval section says Codex and OpenCode native records keep their id across a reconnect (no "re-key"), names when a record is TUI-only (Claude Code, a request failing the adapter's checks, a subject over the payload cap) and has no "until those implementations land" wording.
- Decisions governing the scope:
  - Coordinator, ask 9a81a158 (comment on E-414 at 15:17Z 2026-10-22): the record carries the command, its cwd and the reason, plus the file paths and change, capped at 64 KB, and no other tool input; only the human answers, agent sessions and Aides are refused; the deny note is optional.
  - Coordinator decision of 2026-10-22 23:30Z on E-414: an approval whose complete authorization subject does not fit the public payload cap is a TUI-only record; truncated text is informational only; error paths use the same public-field allowlist. Both relays.
  - Coordinator decision of 2026-10-23 02:33Z in T-1113's topic (recorded in A-9775 as decision 9a8ec668): C1's scope is the observable boundary. A Codex resolution seen before the hub's write receipt is the harness's win; an echo after delivery is the hub's choice. A remote TUI answer whose resolution reaches the adapter only after the hub's successful socket write cannot be told from that echo: the record then reads the hub's choice. This residual case is a protocol limitation documented in `hub/README.md`, with follow-up T-1162 (reconcile from the item's later execution) out of scope here. The run treats it as documented behaviour, never as a failure, and checks only that the docs state it (E414S3-09).

Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

Criteria map (the stage verdict carries no item marks; this tells the run which check proves what):

| criterion | proven by |
| --- | --- |
| T-1113 C1 (another client resolves a Codex request while the hub's Deny is in flight: only the harness's outcome is recorded, the human's answer is refused naming the harness) | E414S3-01; boundary per decision 02:33Z: E414S3-01 (echo after delivery keeps the human outcome), E414S3-09 (the limitation documented) |
| T-1113 C2 (an OpenCode reply refused as not found after the TUI answered closes with the TUI's reply, never the hub's choice) | E414S3-02 |
| T-1113 C3 (restart with pending Codex, OpenCode and Claude Code requests serves the three records with their ids; Approve once after the restart reaches Codex) | E414S3-04 (all three harnesses, actual hub processes), E414S3-11 and E414S3-12 (Codex and OpenCode live in p1), E414S3-02 (child owner and revalidation), E414S3-03 (failed reserved answer keeps validated fields) |
| T-1113 C4 (a request answered in the harness while the hub was down reads closed with the harness's outcome) | E414S3-04, E414S3-13, E414S3-02 (reconnect closes an off-stream answer) |
| T-1113 C5 (a closed record's outcome is in the archive after a restart) | E414S3-04, E414S3-13 |
| T-1113 C6 (`hub/README.md` describes the race and the rebuild) | E414S3-09 |
| T-1159 C1 (records keep their id across a reconnect; no "re-key") | E414S3-09 |
| T-1159 C2 (TUI-only cases named; no "until those implementations land") | E414S3-09 |
| Decision 9a81a158 (allowlist, human-only) after T-1113 persisted records | E414S3-03, E414S3-14 |
| Decision 2026-10-22 23:30Z (oversized or malformed subject is TUI-only) after T-1113's revalidation | E414S3-02, E414S3-01 |
| Regression of stage 2's relays through the fake binaries after T-1113 changed both adapters | E414S3-05, E414S3-06, E414S3-07, E414S3-08 |

## Build

Use a clean detached worktree at dev at the SHA in the request (the full 40-hex SHA), created below. HEAD must equal that SHA and refs/heads/dev before and after running. All listed items must have merged onto dev: for every member that `task plan show E-414` lists in stage `races and restarts`, `git log --first-parent --oneline --grep "Item: <id>" dev` prints exactly one commit. At writing T-1159 landed as `fe3937b0`; T-1113 was reviewed clear at branch head `f9e3a8f5` (`t/T-1113-the-first-answer-wins-against-the`) and was landing through the merge queue. **The run starts only once T-1113 is on dev**: if E414S3-00's merge check prints nothing under `== T-1113`, the run is BLOCKED; report it to the requester and stop. The run is also BLOCKED if the build lacks `approvalsReconciled` in `hub/src/adapters/contract.ts`, `'approval-rebuilt'` in `hub/src/hub/journal.ts`, `pendingApprovals()` in `hub/src/hub/store.ts`, `"hub/test/approval-restart.test.ts": "T3"` in `hub/test/tiers.json`, or `A harness TUI can win while a hub answer is in flight.` in `hub/README.md`. Dev also carries work landed after these items that is outside this stage, including the Coordinator's duration-allowance update for the restart test (12.2 s raised to 22 s at stage close, Coordinator 544c1930); it is not judged here. A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no commit of its own or run id on purpose: committing a brief changes the tested tree. Every expectation below was read from T-1113's head `f9e3a8f5` (which contains T-1159) and dev `ed49f6fd`; the four test files of E414S3-01 to E414S3-04 were run there once (28, 30, 19 and 1 tests, all passing, the restart test in 7.5 s on Darwin arm64). The p1 rows were written from stage 2's rig and T-1113's T3 test, not dry-run: re-check test names, messages and docs strings with grep at the tested build.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step (the setup below does; the clean-tree check ignores that one entry). The pinned Neovim comes from the main worktree's `.cache/nvim/`; never download it into the root. This stage has no Web bundle or browser step and `web/dist` is not needed.

## Setup (once, before E414S3-00)

Two shells, never mixed. **QA's own shell** (bash) keeps QA's session identity: it creates the worktree, runs `quiet` and the one live read (`task plan show E-414` in E414S3-00 and E414S3-15), and records every check with `qa-record.sh`. **Every other command runs sealed** (rule 15) inside a subshell that sources `$Q/env.sh`: the full `fixtureEnvironment` result (`test-support/fixture-environment.ts`) with a scratch HOME, XDG, Git config and fake-harness homes (`FAKE_CLAUDE_HOME`, `FAKE_CODEX_HOME`, `FAKE_OPENCODE_HOME` under `$Q`), which drops every `CLAND_*`, `GIT_*`, `XDG_*`, `CLAUDE_*`, `CODEX_*`, `OPENCODE_*`, `FAKE_*`, provider and account variable while keeping `PATH`, `SHELL`, `TERM` and `TMPDIR`. Leave `TMPDIR` at the system default (on macOS `/var/folders/...`): Neovim frame fixtures break under `/tmp` (T-1030). The scratch root lives under `/private/tmp/qa-e414s3-` (its realpath, so every scratch path compares as written; short enough for the scratch hub's sockets). Never the live project's hub for anything but the plan reads and `quiet`; never the human's HOME, `~/.cland`, `~/.claude`, `~/.codex`, `~/.local/state` or any real Codex or OpenCode account: every harness here is the fake binary of `hub/test/fakes/` or a scripted in-process double.

One scratch project, **p1**: a CLI-started hub (`cland hub start`) with the fake `claude`, `codex` and `opencode` binaries of `hub/test/fakes/` first on its `PATH`, so the production Codex and OpenCode adapters launch the fakes as they would the real harnesses. The fake Codex app-server and the fake OpenCode server run detached from the hub and outlive it, so a hub stopped and started again finds them through the process table, as T-1113's T3 test does. The fake Codex raises `item/commandExecution/requestApproval` (`command: "touch approved"`, `cwd`, `reason: "Write a file"`) when a prompt contains `needs approval`, re-sends a pending request to every client that subscribes (the replay), answers it itself when the file `approve` appears in `$FAKE_CODEX_HOME` (its TUI path; the file is consumed), and logs `approval <request id>: <decision>` and, on accept, `command ran: touch approved` in `$FAKE_CODEX_HOME/log/<app-server pid>.log`, creating `approved` in the session's cwd. The fake OpenCode raises `permission.asked` for `needs approval`, referencing a shell tool part (`touch approved && echo done`, plus private `workdir`, `patchText` and `secret` inputs) when the text also contains `shell approval`, lists pending permissions in its snapshot, and logs every reply it receives, from the hub or from another client, as `permission-reply {session, request, decision, message?}` in `$FAKE_OPENCODE_HOME/prompts/<native session>.log`. p1 proves the restart rebuild and the off-stream close live, for Codex and OpenCode; Claude Code's restart path, the in-flight races, child permissions and revalidation run through the items' named test files. p1 launches no Claude Code session (the fake needs the test account fixture; E414S3-04 covers it).

In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<the full dev SHA from the request>
RUN=qa-s3-$(date +%F)-1                        # unique run id for E-414; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e414s3-$RUN           # the clean detached build
EV=$R/.cland/qa/E-414/$RUN                     # captures (qa-record.sh keeps its evidence here too)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
Q=$(cd "$(mktemp -d /tmp/qa-e414s3-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/qa-e414s3-…
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data" "$Q/xdg/cache" "$Q/p1"
: > "$Q/pids"                                  # the fixture-owned process census: every scratch pid is appended here
holder() { (cd "$W" && node hub/bin/cland.ts verify queue --json) | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);console.log((v.holder?.session??v.holder?.kind??"none")+" waiters "+(v.waiters??[]).length)})'; }
quiet() { for i in $(seq 1 10); do h=$(holder) && case "$h" in "none "*) echo quiet; return 0;; esac; sleep 60; done; echo "BLOCKED: the verify slot is not free after 10 minutes: ${h:-queue read failed}"; return 1; }
# nt <id> <node --test args…>: named test files from $W, sealed, one file at a time, TAP output, after quiet; the log is $EV/<id>.log
nt() { id=$1; shift; quiet || return 1; ( . "$Q/env.sh"; cd "$W" && node --test --test-concurrency=1 --test-reporter=tap "$@" > "$EV/$id.log" 2>&1; echo "exit $?" >> "$EV/$id.log" ); tail -n 1 "$EV/$id.log"; grep -E '^# (tests|pass|fail|cancelled|skipped|todo|duration_ms) ' "$EV/$id.log"; grep -E '^ *not ok|# SKIP' "$EV/$id.log" | head -20; }
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
# hp: the pid in this project's .cland/hub.json (the secret is never read out)
hp() { node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(".cland/hub.json","utf8")).pid)+"\n")'; }
# seen <file> <text>: wait up to 120 s for a literal text in a file
seen() { for i in $(seq 1 240); do grep -q -F -- "$2" "$1" 2>/dev/null && return 0; sleep 0.5; done; echo "timeout waiting for $2 in $1"; return 1; }
# hubstart: start this project's hub with the fake harnesses first on its PATH, no machine-wide orphan sweep; census its pid
hubstart() { env PATH="$FCC:$FCX:$FOC:$PATH" CLAND_OPENCODE_BIN="$FOC/opencode" CLAND_CLAUDE_AGENTS_MS=500 CLAND_ADAPTER_POLL_MS=200 CLAND_TEST_SKIP_ORPHAN_SWEEP=1 node "$QA_W/hub/bin/cland.ts" hub start && hp >> "$QA_Q/pids"; }
# hubstop: stop this project's hub and wait up to 10 s for its pid to exit; prints "hub <pid> gone" or "hub <pid> still alive"
hubstop() { h=$(hp); cland hub stop; echo "hub stop exit $?"; for i in $(seq 1 100); do kill -0 "$h" 2>/dev/null || break; sleep 0.1; done; if kill -0 "$h" 2>/dev/null; then echo "hub $h still alive"; else echo "hub $h gone"; fi; }
# st <name>: a launched session's state; waitst <name> <state>: wait up to 120 s for it
st() { cland session list --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).processes.find(x=>x.name===process.argv[1]);console.log(p?p.state:"absent")})' "$1"; }
waitst() { for i in $(seq 1 240); do [ "$(st "$1")" = "$2" ] && return 0; sleep 0.5; done; echo "timeout: $1 is $(st "$1"), not $2"; return 1; }
# closed <record id> <capture>: poll a fresh frame client's archive every second, up to 60 s, until the record is archived;
# the last poll is kept in <capture>
closed() { for i in $(seq 1 60); do printf '{"type":"inbox.list","archive":true}\n' | fc > "$2"; q "$2" 'res("q1").value.archive.some(r=>r.id===A[0])' "$1" | grep -q true && return 0; sleep 1; done; echo "timeout: $1 not archived after 60 s"; return 1; }
# ask <session> <text> <capture prefix>: the human writes <text> in General to <session>; wait until it waits for approval;
# a fresh inbox.list goes to <prefix>-list.jsonl and that session's one pending record id is printed
ask() { printf '{"type":"topic.send","topic":"general","text":"%s","to":["%s"]}\n' "$2" "$1" | fc > "$3-send.jsonl"; waitst "$1" 'waiting for approval' || return 1; sleep 2; printf '{"type":"inbox.list"}\n' | fc > "$3-list.jsonl"; qv "$3-list.jsonl" 'res("q1").value.approvals.find(a=>a.session===A[0]&&a.state==="pending")?.id ?? ""' "$1"; }
# answer <record id> <choice> [note] <capture>: one approval.answer from a fresh frame client (the local human)
answer() { if [ $# -eq 4 ]; then printf '{"type":"approval.answer","approval":"%s","choice":"%s","note":"%s"}\n' "$1" "$2" "$3" | fc > "$4"; else printf '{"type":"approval.answer","approval":"%s","choice":"%s"}\n' "$1" "$2" | fc > "$3"; fi; }
# rebuilt <record id>: flush the hub's logs, then print the answerIn of every approval-rebuilt journal entry for that record (JSON)
rebuilt() { printf '{"type":"hub.status","flushLogs":true}\n' | fc > /dev/null; node "$QA_Q/rb.cjs" .cland/journal.jsonl "$1"; }
# waitrb <record id>: wait up to 120 s for its approval-rebuilt receipt (native validation after a restart)
waitrb() { for i in $(seq 1 120); do [ "$(rebuilt "$1")" != "[]" ] && return 0; sleep 0.5; done; echo "timeout: no approval-rebuilt receipt for $1"; return 1; }
# cxlog: the fake Codex app-server's decision and command lines for qa-cx (its pid recorded by E414S3-10)
cxlog() { grep -E 'approval approval-[^ ]+: |command ran: ' "$FAKE_CODEX_HOME/log/$(cat "$QA_Q/pid-cx").log"; }
# ocreplies <native permission id>: the fake OpenCode server's replies to that permission on qa-oc's native session, as
# JSON [[decision, message|null, sameSession]]
ocreplies() { node -e 'const fs=require("fs");const ses=fs.readFileSync(process.argv[2],"utf8").trim();const L=fs.readFileSync(process.argv[1],"utf8").split("\n").filter(l=>l.startsWith("permission-reply ")).map(l=>JSON.parse(l.slice(17)));console.log(JSON.stringify(L.filter(r=>r.request===process.argv[3]).map(r=>[r.decision,r.message??null,r.session===ses])))' "$FAKE_OPENCODE_HOME/prompts/$(cat "$QA_Q/ses-oc").log" "$QA_Q/ses-oc" "$1"; }
ENV
: > "$Q/home/.gitconfig"
grep -c '^unset ' "$Q/env.sh"; ( . "$Q/env.sh"; prefix_count=$(env | cut -d= -f1 | grep -c -E '^(CLAND_|DIGITALOCEAN_|ANTHROPIC_|OPENAI_|GH_|GITHUB_)'); echo "$prefix_count"; test "$prefix_count" -eq 0 ) || exit 1   # confirm 0 before any scratch process starts
```

The helpers. `fc.cjs` is a frame client on the scratch hub's Unix socket (the local human, so the hub records its answers `via: neovim`); `q.cjs` reads captures; `rb.cjs` reads the scratch hub's journal; `tuireply.cjs` is the attached OpenCode TUI's answer without a TUI: another client of the session's own OpenCode server replying on its permission endpoint, which works while the hub is down because it reads the session's address from a saved session list.

```sh
cat > "$Q/fc.cjs" <<'JS'
'use strict';
// QA frame client (E-414 stage races and restarts). It prints what a scratch hub sends and asserts nothing.
// node "$QA_Q/fc.cjs" ['<features JSON array>'] < frames.jsonl     (run in the scratch project's directory)
// Connects to ./.cland/hub.json's Unix socket as the local human UI (the secret is never printed) with those
// features, and waits for snapshot.end when "snapshot" is among them. Then sends each stdin line in order and waits
// up to QA_RESULT_MS (default 20000) for its result; ids q1, q2, … are added when missing. Pseudo-frame:
//   {"qa":"wait","ms":N}            pause N ms
// Output: every frame whole, one JSON line each, in arrival order, with {"type":"qa-send","frame":…} before each
// request and {"type":"qa-end"} last, all at the end, QA_SETTLE (default 700) ms after the last answer.
// Its pid is appended to $QA_Q/pids (the census).
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
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function emit(frame) {
  frames.push(frame);
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
      else await request(step);
    }
    await sleep(Number(env.QA_SETTLE ?? 700));
  } catch (error) {
    emit({ type: 'qa-error', message: error.message });
    process.exitCode = 1;
  }
  emit({ type: 'qa-end' });
  process.stdout.write(frames.map(f => JSON.stringify(f)).join('\n') + '\n');
  socket.destroy();
  setTimeout(() => process.exit(), 500).unref();
})();
JS
cat > "$Q/q.cjs" <<'JS'
'use strict';
// node "$QA_Q/q.cjs" <capture> '<expression>' [args…]: evaluates the expression over a JSON-lines capture and prints
// the value as JSON. In scope: F (every frame), A (the extra args), fs, rd(file) (the frames of another capture),
// res(id) (the result frame with that id in this capture), resOf(frames, id) (the same in another capture's frames).
const fs = require('node:fs');
const [file, expr, ...A] = process.argv.slice(2);
const rd = f => fs.readFileSync(f, 'utf8').split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
const F = rd(file);
const resOf = (frames, id) => frames.find(f => f.type === 'result' && f.id === id);
const res = id => resOf(F, id);
console.log(JSON.stringify(eval(expr)));
JS
cat > "$Q/rb.cjs" <<'JS'
'use strict';
// node "$QA_Q/rb.cjs" <journal.jsonl> <record id>: the answerIn of every `approval-rebuilt` journal entry for that record,
// as a JSON array, in journal order. An unfinished last line is skipped. Prints [] when the journal is absent.
const fs = require('node:fs');
const [file, id] = process.argv.slice(2);
let text = '';
try { text = fs.readFileSync(file, 'utf8'); } catch {}
const out = [];
for (const line of text.split('\n')) {
  if (!line.trim()) continue;
  let entry;
  try { entry = JSON.parse(line); } catch { continue; }
  if (entry.event === 'approval-rebuilt' && entry.approval === id) out.push(entry.answerIn);
}
console.log(JSON.stringify(out));
JS
cat > "$Q/tuireply.cjs" <<'JS'
'use strict';
// node "$QA_Q/tuireply.cjs" <scratch project> <session list JSON> <session name> <native permission id> <once|always|reject>
// (run sealed). Replies to a pending OpenCode permission as another client of that session's own server would (an
// attached TUI): POST /api/session/{native session}/permission/{id}/reply {decision} with HTTP Basic (user opencode,
// the password file cland keeps for the session). The server's address and native session come from a session list
// saved while the hub was up, so this works with the hub stopped. Prints the HTTP status only; the password is read
// from its file, never printed.
const fs = require('node:fs');
const http = require('node:http');
const [root, list, name, per, decision] = process.argv.slice(2);
const Q = process.env.QA_Q;
if (!root || !Q || !root.startsWith(`${Q}/`)) { console.log('refused: not a scratch project'); process.exit(2); }
const p = JSON.parse(fs.readFileSync(list, 'utf8')).processes.find(x => x.name === name);
const password = fs.readFileSync(`${root}/.cland/opencode/${name}/password`, 'utf8').trim();
const body = JSON.stringify({ decision });
const req = http.request(`${p.harnessId}/api/session/${encodeURIComponent(p.harnessSessionId)}/permission/${encodeURIComponent(per)}/reply`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), authorization: `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}` },
}, res => { res.resume(); res.on('end', () => console.log(`tui reply ${per} ${decision}: HTTP ${res.statusCode}`)); });
req.on('error', e => { console.log(`tui reply error ${e.code ?? e.message}`); process.exitCode = 1; });
req.end(body);
JS
node --check "$Q/fc.cjs" && node --check "$Q/q.cjs" && node --check "$Q/rb.cjs" && node --check "$Q/tuireply.cjs" && echo "helpers parse"
```

Project p1. `cland init` may start a scratch hub: record its pid and stop it before editing the config. Point the existing `lock_path` and `executor` keys at a scratch lock and the local executor (edit the keys init wrote; never add a second table), then start p1's hub with the fakes.

```sh
( . "$Q/env.sh"; cd "$Q/p1" && git init -q -b dev && git commit -q --allow-empty -m init && cland init . > "$EV/E414S3-00-init.txt" 2>&1 || exit 1
  [ -f .cland/hub.json ] && hp >> "$Q/pids"; cland hub stop > /dev/null 2>&1
  sed -i '' -e "s|^lock_path = .*|lock_path = \"$QA_Q/p1-suite.lock\"|" -e 's|^executor = .*|executor = "local"|' .cland/config.toml
  grep -c -x "lock_path = \"$QA_Q/p1-suite.lock\"" .cland/config.toml; grep -c -x 'executor = "local"' .cland/config.toml
  hubstart > "$EV/E414S3-00-p1-start.txt" 2>&1; echo "p1 hub start exit $?"; cland hub status )
```

The check functions. Define them in QA's own shell (paste the block once). Each runs where its table row says; the p1 ones inside a sealed subshell. Each writes its captures under `$EV` and prints the facts the `expected` column judges.

```sh
k00() {   # QA shell: build, merges, plan, sealing
  git -C "$W" rev-parse HEAD refs/heads/dev
  git -C "$W" status --porcelain | grep -v -x '?? node_modules' | wc -l
  (cd "$W" && node hub/bin/cland.ts task plan show E-414 --json) > "$EV/E414S3-00-plan.json"
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=v.stages.find(x=>x.name==="races and restarts");console.log(JSON.stringify({stages: v.stages.map(x=>x.name), state: s.state, qa: s.qa, merged: s.merged, total: s.total, items: s.items}))' "$EV/E414S3-00-plan.json" | tee "$EV/E414S3-00-stage.txt"
  for i in $(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).stages.find(x=>x.name==="races and restarts").items.join(" "))' "$EV/E414S3-00-plan.json"); do echo "== $i"; git -C "$W" log --first-parent --oneline --grep "Item: $i" dev; done
  grep -c -F 'approvalsReconciled' "$W/hub/src/adapters/contract.ts"
  grep -c -F "'approval-rebuilt'" "$W/hub/src/hub/journal.ts"
  grep -c -F 'pendingApprovals()' "$W/hub/src/hub/store.ts"
  grep -c -F '"hub/test/approval-restart.test.ts": "T3"' "$W/hub/test/tiers.json"
  grep -c -F 'A harness TUI can win while a hub answer is in flight.' "$W/hub/README.md"
  ls "$W/hub/test/approval-restart.test.ts" "$W/hub/test/codex-native.test.ts" "$W/hub/test/opencode-native.test.ts" "$W/hub/test/approval-records.test.ts"
  echo "TMPDIR=$TMPDIR Q=$Q"
  cat "$EV/E414S3-00-p1-start.txt"; wc -l < "$Q/pids"
  ( . "$Q/env.sh"; cd "$Q/p1" && cland hub status )
}
k07() {   # test $W: the Neovim protocol recordings still match a real hub after T-1113 changed the inbox's approval deltas
  nt E414S3-07 --test-name-pattern='recorded protocol fixtures match the live hub attach frames' nvim/test/scenarios/workbench.test.ts; oks E414S3-07
}
k09() {   # docs, in QA's own shell
  dc() { printf '%s | %s: ' "$1" "$2"; grep -c -F -- "$2" "$W/$1"; }
  dc hub/README.md 'Codex and OpenCode native records keep their id across a reconnect.'
  dc hub/README.md 'reconnects may re-key'
  dc hub/README.md 'until those implementations land'
  dc hub/README.md 'Claude Code always uses `answerIn: tui` with no choices.'
  dc hub/README.md "Codex and OpenCode requests are also TUI-only with no choices when they fail the adapter's checks or their complete authorization subject exceeds the serialized 64 KiB UTF-8 cap; any truncated text is informational only."
  dc hub/README.md 'A harness TUI can win while a hub answer is in flight.'
  dc hub/README.md "A native resolution observed before Codex's response-write receipt, or an OpenCode reply refused as not found after an attached client answered, closes the record with the harness's outcome."
  dc hub/README.md 'The losing hub answer is refused with who answered and when; its attempted choice and note do not replace the winner.'
  dc hub/README.md "Codex's protocol has a limitation: \`serverRequest/resolved\` carries the request id, without the winning decision or client."
  dc hub/README.md "that event cannot be distinguished from the hub answer's echo. The record then reads the hub's choice."
  dc hub/README.md 'Pending allowlisted record metadata is retained in `hub.db`'
  dc hub/README.md "After a hub restart, Codex's pending-request replay and OpenCode's parent and pending child-owner permission snapshots reconcile those records"
  dc hub/README.md "Claude Code's state-only record keeps its id and command while its waiting state is recovered"
  dc hub/README.md 'A request missing from a completed native replay/snapshot closes as `answered in the harness`'
  dc hub/README.md 'An unfinished hub answer returns as pending, never as an approval.'
  dc hub/README.md "The journal's \`approval-rebuilt\` receipt identifies a restored request admitted after native replay and subject validation"
  dc hub/README.md 'Already closed outcomes and their attribution remain in the inbox archive across restarts.'
  dc hub/README.md 'A rejection restores `pending` and clears the attempted outcome unless a native winner has already closed the record'
  dc docs/agents/tests.md 'Approval races use those same T2 scripted native/frame seams'
  dc docs/agents/tests.md '`hub/test/approval-restart.test.ts` is T3 because it restarts actual scratch hub processes'
  dc .agents/skills/implement/SKILL.md 'For approval race/restart changes'
  awk '/^An `ApprovalRecord` adds/{f=1} /^Rows leave by these rules/{f=0} f' "$W/hub/README.md" > "$EV/E414S3-09-section.md"
  printf 'section lines: '; grep -c . "$EV/E414S3-09-section.md"
  printf 'future or re-key wording in the section: '; grep -c -i -E 're-key|until [^.]*land|yet to land|not yet|will land' "$EV/E414S3-09-section.md"
}
k10() {   # p1: a Codex and an OpenCode session through the production adapters and the fake binaries
  cland session launch qa-cx --role implementer --harness codex > "$EV/E414S3-10-cx.txt" 2>&1; echo "cx launch exit $?"
  cland session launch qa-oc --role implementer --harness opencode > "$EV/E414S3-10-oc.txt" 2>&1; echo "oc launch exit $?"
  waitst qa-cx idle && waitst qa-oc idle || return 1
  cland session list --json > "$EV/E414S3-10-sessions.json"
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));for(const p of v.processes)if(p.pid)console.log(p.pid)' "$EV/E414S3-10-sessions.json" >> "$Q/pids"
  node -e 'const fs=require("fs");const v=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const p=n=>v.processes.find(x=>x.name===n);fs.writeFileSync(process.argv[2]+"/pid-cx",String(p("qa-cx").pid));fs.writeFileSync(process.argv[2]+"/pid-oc",String(p("qa-oc").pid));fs.writeFileSync(process.argv[2]+"/ses-oc",String(p("qa-oc").harnessSessionId));console.log(JSON.stringify({relay: Object.fromEntries(Object.entries(v.adapters).map(([k,a])=>[k,a.approvalRelay])), procs: ["qa-cx","qa-oc"].map(n=>[n,p(n).harness,p(n).status,p(n).cwd===process.argv[3]])}))' "$EV/E414S3-10-sessions.json" "$Q" "$PWD" | tee "$EV/E414S3-10.txt"
}
k11() {   # p1: a pending Codex request and a pending OpenCode permission survive a hub restart with their ids, subjects and since
  CX=$(ask qa-cx 'QA needs approval across a restart' "$EV/E414S3-11cx") || return 1; echo "$CX" > "$Q/rec-cx1"
  OC=$(ask qa-oc 'QA needs approval across a restart: shell approval' "$EV/E414S3-11oc") || return 1; echo "$OC" > "$Q/rec-oc1"
  printf '{"type":"inbox.list"}\n' | fc > "$EV/E414S3-11-before.jsonl"
  hubstop > "$EV/E414S3-11-stop.txt" 2>&1; cat "$EV/E414S3-11-stop.txt"
  for f in pid-cx pid-oc; do if kill -0 "$(cat "$Q/$f")" 2>/dev/null; then echo "$f alive while the hub is down"; else echo "$f NOT alive"; fi; done
  hubstart > "$EV/E414S3-11-start.txt" 2>&1; echo "restart exit $?"; tail -n 1 "$Q/pids" | sed 's/^/new hub pid /'
  waitrb "$CX" && waitrb "$OC" || return 1
  printf 'rebuilt receipts: '; echo "[$(rebuilt "$CX"),$(rebuilt "$OC")]"
  printf '{"type":"inbox.list","archive":true}\n' | fc > "$EV/E414S3-11-after.jsonl"
  q "$EV/E414S3-11-after.jsonl" '(()=>{const before=resOf(rd(A[0]),"q1").value.approvals, now=res("q1").value;return A.slice(1).map(id=>{const b=before.find(a=>a.id===id)??{}, a=now.approvals.find(x=>x.id===id)??{};return {session: a.session, before: b.state, after: a.state, sameSubject: JSON.stringify(a.subject)===JSON.stringify(b.subject), subject: a.subject, sameSince: a.since===b.since, answerIn: a.answerIn, choices: a.choices, outcome: a.outcome ?? null, archived: (now.archive??[]).some(r=>r.id===id)};});})()' "$EV/E414S3-11-before.jsonl" "$CX" "$OC" | tee "$EV/E414S3-11.txt"
  [ -e approved ] && echo "approved present before any answer" || echo "approved absent before any answer"
}
k12() {   # p1: answers given after the restart reach the reconnected native requests
  CX=$(cat "$Q/rec-cx1"); OC=$(cat "$Q/rec-oc1")
  answer "$CX" once "$EV/E414S3-12-cx.jsonl"; waitst qa-cx idle; sleep 1
  printf 'cx answer: '; q "$EV/E414S3-12-cx.jsonl" '[res("q1").ok, res("q1").error ?? null, res("q1").value?.approval?.state, res("q1").value?.approval?.outcome]'
  printf 'approved file: '; [ -e approved ] && echo present || echo absent
  cxlog > "$EV/E414S3-12-cx-fake.log"; printf 'decisions for this request: '; grep -F "approval ${CX#*:}: " "$EV/E414S3-12-cx-fake.log" | sed -E 's/^.*: //' | tr '\n' ' '; echo
  printf 'command ran lines: '; grep -c -F 'command ran: touch approved' "$EV/E414S3-12-cx-fake.log"
  answer "$OC" deny 'QA keep it after the restart' "$EV/E414S3-12-oc.jsonl"; waitst qa-oc idle; sleep 1
  printf 'oc answer: '; q "$EV/E414S3-12-oc.jsonl" '[res("q1").ok, res("q1").error ?? null, res("q1").value?.approval?.state, res("q1").value?.approval?.outcome]'
  printf 'oc replies for this request: '; ocreplies "${OC#*:}" | tee "$EV/E414S3-12-oc-fake.txt"
  printf '{"type":"inbox.list","archive":true}\n' | fc > "$EV/E414S3-12-archive.jsonl"
  q "$EV/E414S3-12-archive.jsonl" '({listed: A.map(id=>res("q1").value.approvals.some(a=>a.id===id)), archive: A.map(id=>res("q1").value.archive.filter(r=>r.id===id).map(r=>[r.kind, r.reason, r.outcome]))})' "$CX" "$OC" | tee "$EV/E414S3-12.txt"
  T=$(qv "$EV/E414S3-12-cx.jsonl" 'res("q1").value.approval.outcome.at')
  cland inbox --archive > "$EV/E414S3-12-archive.txt"
  printf 'cx archive lines: '; grep -c -F "  approval $CX  qa-cx  touch approved  · closed  once by human via neovim at $T" "$EV/E414S3-12-archive.txt"
  rm -f approved
}
k13() {   # p1: requests answered in the harness while the hub is down close as answered in the harness; earlier outcomes stay archived
  waitst qa-cx idle && waitst qa-oc idle || return 1
  CX=$(ask qa-cx 'QA needs approval, answered while the hub is down' "$EV/E414S3-13cx") || return 1; echo "$CX" > "$Q/rec-cx2"
  OC=$(ask qa-oc 'QA needs approval: shell approval, answered while the hub is down' "$EV/E414S3-13oc") || return 1; echo "$OC" > "$Q/rec-oc2"
  cland session list --json > "$EV/E414S3-13-sessions.json"
  hubstop > "$EV/E414S3-13-stop.txt" 2>&1; cat "$EV/E414S3-13-stop.txt"
  touch "$FAKE_CODEX_HOME/approve"   # the human approves in the attached Codex TUI while the hub is down
  seen "$FAKE_CODEX_HOME/log/$(cat "$Q/pid-cx").log" "approval ${CX#*:}: accept" && echo "codex TUI answer logged"
  node "$Q/tuireply.cjs" "$PWD" "$EV/E414S3-13-sessions.json" qa-oc "${OC#*:}" reject | tee "$EV/E414S3-13-tui.txt"
  seen "$FAKE_OPENCODE_HOME/prompts/$(cat "$Q/ses-oc").log" "\"request\":\"${OC#*:}\"" && echo "opencode TUI reply logged"
  hubstart > "$EV/E414S3-13-start.txt" 2>&1; echo "restart exit $?"; tail -n 1 "$Q/pids" | sed 's/^/new hub pid /'
  closed "$CX" "$EV/E414S3-13-closed-cx.jsonl" && closed "$OC" "$EV/E414S3-13-closed-oc.jsonl" || return 1
  answer "$CX" deny "$EV/E414S3-13-late-cx.jsonl"; answer "$OC" once "$EV/E414S3-13-late-oc.jsonl"
  printf 'late cx: '; q "$EV/E414S3-13-late-cx.jsonl" '[res("q1").ok, res("q1").error]'
  printf 'late oc: '; q "$EV/E414S3-13-late-oc.jsonl" '[res("q1").ok, res("q1").error]'
  printf '{"type":"inbox.list","archive":true}\n' | fc > "$EV/E414S3-13-archive.jsonl"
  q "$EV/E414S3-13-archive.jsonl" '(()=>{const v=res("q1").value, earlier=resOf(rd(A[2]),"q1").value.archive;return {listed: [A[0],A[1]].map(id=>v.approvals.some(a=>a.id===id)), offStream: [A[0],A[1]].map(id=>v.archive.filter(r=>r.id===id).map(r=>[r.kind, r.reason, r.outcome])), kept: [A[3],A[4]].map(id=>JSON.stringify(v.archive.find(r=>r.id===id)?.outcome)===JSON.stringify(earlier.find(r=>r.id===id)?.outcome) && v.archive.some(r=>r.id===id))};})()' "$CX" "$OC" "$EV/E414S3-12-archive.jsonl" "$(cat "$Q/rec-cx1")" "$(cat "$Q/rec-oc1")" | tee "$EV/E414S3-13.txt"
  cxlog > "$EV/E414S3-13-cx-fake.log"; printf 'cx decisions for this request: '; grep -F "approval ${CX#*:}: " "$EV/E414S3-13-cx-fake.log" | sed -E 's/^.*: //' | tr '\n' ' '; echo
  printf 'oc replies for this request: '; ocreplies "${OC#*:}"
  T=$(qv "$EV/E414S3-13-archive.jsonl" 'res("q1").value.archive.find(r=>r.id===A[0]).outcome.at' "$CX")
  cland inbox --archive > "$EV/E414S3-13-archive.txt"
  printf 'cx archive lines: '; grep -c -F "  approval $CX  qa-cx  touch approved  · closed  answered in the harness by harness via harness at $T" "$EV/E414S3-13-archive.txt"
  rm -f approved
}
k14() {   # p1: no private tool input in captures, logs, journal or hub.db; no fallback or failure events; nothing pending
  printf 'private in captures: '; cat "$EV"/E414S3-1*.jsonl | grep -c -E 'PRIVATE-TOOL-INPUT|private-(permission-metadata|tool-input|workdir|patch)|wrong command'
  printf 'private in hub logs and journal: '; cat .cland/log/*.log .cland/journal.jsonl | grep -c -E 'PRIVATE-TOOL-INPUT|private-(permission-metadata|tool-input|workdir|patch)|wrong command'
  printf 'private in hub.db: '; cat .cland/hub.db* | grep -a -c -E 'PRIVATE-TOOL-INPUT|private-(permission-metadata|tool-input|workdir|patch)|wrong command'
  printf 'fallback or failure events: '; cat .cland/log/*.log .cland/journal.jsonl | grep -c -E '"event":"(harness-approval-unsupported|opencode-approval-shape|approval-answer-failed)"'
  printf '{"type":"inbox.list"}\n{"type":"hub.status"}\n' | fc > "$EV/E414S3-14-inbox.jsonl"
  q "$EV/E414S3-14-inbox.jsonl" '({pending: res("q1").value.approvals.filter(a=>a.session==="qa-cx"||a.session==="qa-oc").length, needsYou: res("q1").value.needsYou, status: res("q2").value.needsYou})'
}
k16() {   # cleanup: stop the two sessions and p1's hub; judge the fixture-owned census only
  cland session stop qa-cx > "$EV/E414S3-16-stop-cx.txt" 2>&1; echo "stop qa-cx exit $?"
  cland session stop qa-oc > "$EV/E414S3-16-stop-oc.txt" 2>&1; echo "stop qa-oc exit $?"
  cland hub stop; sleep 2
  sort -u "$Q/pids" | while read -r p; do [ -n "$p" ] && kill -0 "$p" 2>/dev/null && echo "alive $p $(ps -o command= -p "$p")"; done
  echo "census of $(sort -u "$Q/pids" | grep -c .) fixture pids done"
}
```

Cleanup after the evidence is recorded: print `$Q`, check it begins with `/private/tmp/qa-e414s3-`, and remove it by that literal path with a non-force `rm -r`. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). The scratch hub's secret in `$Q/p1/.cland/hub.json` and the OpenCode session's password file are never printed or posted.

## Cases

none. No headless-grid case in `qa/cases/` covers approval races or restarts; every check below is a manual check against the scratch hub, a named test file or the docs.

### Web cases (when in scope)

none. This stage has no web UI; the web's approval cards are E-417's and E-418's.

## Manual checks

Record each with `sh .agents/skills/qa/qa-record.sh note E-414 "$RUN" <id> hub-api "<command>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence-file…>`, run from `$W` in QA's own shell; name where it ran at the start of the command text (`[p1]`, `[test $W]`, `[docs]`, `[QA shell]`). The recorder takes `hub-api` for every check here; the `via` column says which client the check speaks through. Save each check's printed output as `$EV/<id>.txt` (pipe the row's command through `tee`) and name it, with the captures the function wrote, as evidence.

How to run a row, by its `where`:
- **p1**: `( . "$Q/env.sh"; cd "$Q/p1" && <command> )`.
- **test $W**: in QA's own shell; `nt` runs `quiet` first and seals the test run itself. Judge each by its `exit` line, the TAP summary counts and the named tests on `ok` lines (`oks <id>` lists them; a name that appears on no `ok` line proves nothing).
- **docs** and **QA shell**: in QA's own shell, as QA; the plan reads in E414S3-00 and E414S3-15 are the only checks that touch the live hub, and only to read.

Order: E414S3-00, then the rows in id order. The test rows (01 to 08), the docs row (09) and the p1 rows (10 to 14) do not depend on each other; the p1 rows depend on each other in order, and values later rows reuse live in `$Q` (record ids, the fake Codex and OpenCode pids, the OpenCode native session) and `$EV` captures. E414S3-16 runs last, after E414S3-15.

| id | surface | via | where | command | expected |
| --- | --- | --- | --- | --- | --- |
| E414S3-00 | hub-api | git, CLI (one live read), scratch CLI | QA shell; p1 | `k00` | Build, merges and sealing. Both SHAs equal `$S`; `0` changed paths. The plan lists the stages `record and gate`, `relays and Neovim`, `races and restarts`; stage `races and restarts` has `qa` `{scope: "affected", when: "after-stage"}`, `state: "open"` (it closes only after this verdict and the covers), `items` T-1113 and T-1159 in any order plus any findings fixes the request names (nothing else), `total` equal to the number of printed items and `merged` equal to `total`. Under every `== <id>` line exactly one commit line (T-1159 `fe3937b0`; T-1113's landing commit, unknown at writing). Nothing under `== T-1113` means T-1113 has not landed: BLOCKED, stop the run and report to the requester. The five greps print `1` or more each; the four test files exist. `TMPDIR` is the system default (not `/tmp`) and `$Q` begins `/private/tmp/qa-e414s3-`. p1's init exited 0; the two config greps in the p1 block printed `1` and `1`; `p1 hub start exit 0`; the census holds at least `1` pid; `hub status` reports a running hub for `$Q/p1`. Also record the two counts the sealed-environment block printed before any scratch process started: the first at least `1`, the second `0`, and `helpers parse` |
| E414S3-01 | hub-api | named tests (production Codex adapter on the scripted app-server double, real hub, real frame clients) | test $W | `nt E414S3-01 hub/test/codex-native.test.ts; oks E414S3-01` | T-1113 C1 and the 02:33Z boundary. `exit 0`; `# fail 0`, `# cancelled 0`, `# skipped 0`, `# pass` equal to `# tests` (28 at writing). On `ok` lines: "a harness answer wins while a hub Codex Deny is in flight" (C1: the response write is held, `serverRequest/resolved` arrives before its receipt; the Deny is refused with `already answered by harness via harness at`, both clients read exactly one closed delta with `{choice: "answered in the harness", by: "harness", via: "harness"}`, the archive holds it, the Deny note `Do not run` is not posted in General) and "Codex Always and Deny preserve the human outcome when the resolution echo follows delivery" (the decided boundary: an echo after delivery keeps the human outcome, `acceptForSession` and `decline`). Stage 2's relay checks still on `ok` lines: "a Codex command approval is one allowlisted record and Approve once responds to its native id", "a Codex request resolved by another client closes for every subscribed client", "a replayed Codex request after reconnect keeps its record id and accepts an answer", "a replayed Codex file approval cannot answer until its subject is validated", "malformed Codex command requests fall back to the TUI with a warning and never send a decision", "deferred reconnect snapshots preserve newer approval events in either arrival order" and "Codex relays only complete command and file subjects within the exact serialized UTF-8 cap" |
| E414S3-02 | hub-api | named tests (production OpenCode adapter on the scripted HTTP/SSE transport, real hub, real frame clients) | test $W | `nt E414S3-02 hub/test/opencode-native.test.ts; oks E414S3-02` | T-1113 C2, and C3/C4 for OpenCode at the native seam. `exit 0`; `# fail 0`, `# cancelled 0`, `# skipped 0`, `# pass` equal to `# tests` (30 at writing). On `ok` lines: "an OpenCode not-found reply preserves the attached TUI once winner during a hub Deny" and "… reject winner during a hub Deny" (C2: the hub's Deny reply is held, an attached client replies, then the hub's reply fails 404; the record closes with the TUI's reply, `once` or `deny` by `harness` via `harness`, never the hub's choice, even when both chose Deny; the losing answer is refused naming the harness; one closed delta on each of two clients; the planted `private-permission-metadata` in no frame), "hub restart discovers a pre-existing OpenCode child permission and preserves its answer routing" (C3: same id and subject after a restarted hub, not archived, a Deny reaches the child's endpoint as `reject`), "OpenCode restart revalidates persisted authorization before answering and replaces stale public fields" (C3: an answer during the held replay lookup is refused with no endpoint call; a malformed lookup makes it TUI-only with the same id and `since`; a later valid replay refreshes the command and offers three choices; one native `once` reply), "reconnect keeps the same pending permission id and closes an off-stream answer" (C4), "a not-found reply waits for the native outcome and never records attempted consent", "an attached client permission reply closes the record for every hub client" and "only complete commands within the UTF-8 subject cap offer native relay choices" |
| E414S3-03 | hub-api | named tests (the gate with the in-process fake adapters) | test $W | `nt E414S3-03 hub/test/approval-records.test.ts; oks E414S3-03` | The gate after T-1113 changed `hub/src/hub/inbox.ts`. `exit 0`; `# fail 0`, `# cancelled 0`, `# skipped 0`, `# pass` equal to `# tests` (19 at writing). On `ok` lines: "current native authorization survives a failed answer that was reserved before replay validation" (C3: a revalidation to TUI-only during an answering attempt keeps the reservation; after the attempt fails the record is pending with the same id and `since`, `answerIn: "tui"`, no choices, an empty subject, and a second answer is refused with no second adapter call), "adapter close confirmation during delivery preserves the reserved human outcome and publishes one close", "two clients in one tick reserve one winner before adapter confirmation and refuse the loser with attribution", "failed adapter delivery returns to pending, refuses with the reason and journals a warning before a human retry", "only the human may answer: every agent role including Aides is refused on socket and spoke", "public approval subjects cap UTF-8 at 64 KiB, preserve small changes and exclude private tool input" and "a pending request has no default answer after 24 hours of fake time" (decision 9a81a158 still holds) |
| E414S3-04 | hub-api | named tests (T3: actual scratch hub processes restarted while the fake `codex`, `opencode` and `claude` binaries stay alive) | test $W | `nt E414S3-04 hub/test/approval-restart.test.ts; oks E414S3-04` | T-1113 C3, C4 and C5 across real restarts, Claude Code included. `exit 0`; `# tests 1`, `# pass 1`, `# fail 0`, `# cancelled 0`, `# skipped 0`; `ok` on "hub restarts retain three pending approval ids, deliver a replayed answer and archive off-stream outcomes" (three pending records, Codex, OpenCode and Claude Code, return with the same ids and subjects after the hub's pid is reaped and a new hub starts; Codex's resume is held and the `approval-rebuilt` receipt follows its release; Approve once then runs the replayed command (`approved` appears); with the hub down again the fake Codex TUI accepts and an attached OpenCode client rejects; after a third hub both read `answered in the harness` via `harness`, the earlier `once` outcome is unchanged in the archive, and only the Claude Code record stays pending). Record the `# duration_ms` line (about 6 to 8 s on macOS at writing): duration budgets are report-only and judged by nobody here (the allowance is the Coordinator's, 12.2 s raised to 22 s at stage close) |
| E414S3-05 | hub-api | named tests (T3 contract: the production Codex adapter launching the fake `codex` binary) | test $W | `nt E414S3-05 hub/test/codex-adapter.test.ts; oks E414S3-05` | Regression after T-1113 changed `hub/src/adapters/codex.ts` (`thread/resume` now reports the pending inventory). `exit 0`; `# fail 0`, `# cancelled 0`, `# skipped 0` (three tests carry `skip: NO_PS`; on macOS `ps` works, so a skip there is BLOCKED with its reason, not PASS), `# pass` equal to `# tests` (12 at T-1113's receipts). On `ok` lines: "after a hub restart, resume re-finds the app-server and its thread through the process table; state and inject continue" and "a launched Codex session: the app-server runs with the spoke, a UI message goes queued → delivered → injected, the reply comes back, and the state follows thread/status/changed" (stage 2's C8 receipt: Approve once runs the command, a Deny does not) |
| E414S3-06 | hub-api | named tests (T3 contract: the production OpenCode adapter launching the fake `opencode` binary) | test $W | `nt E414S3-06 hub/test/opencode-adapter.test.ts; oks E414S3-06; grep -F '# permission-reply ' "$EV/E414S3-06.log"` | Regression after T-1113 changed `hub/src/adapters/opencode.ts` (persisted child owners, revalidation, reply receipts). `exit 0`; `# fail 0`, `# cancelled 0`, `# skipped 0` (`skip: NO_PS` tests must not skip on macOS: a skip is BLOCKED), `# pass` equal to `# tests` (14 at T-1113's receipts). On `ok` lines: "after a hub restart, resume re-finds the OpenCode server and session through the process table and the event stream goes on", "a pending permission is waiting for approval within one event, and the reply brings the turn back; a form is waiting for human" and "a launched OpenCode session: its own server, the spoke connects, a UI message goes queued → delivered → injected, the reply comes back, the state follows the event stream". The grep prints exactly one diagnostic line `# permission-reply {"session":"ses_…","request":"per_…","decision":"reject","message":"Do not change the workspace."}` |
| E414S3-07 | hub-api | named test, by name (recorded Neovim protocol frames against an in-process real hub) | test $W | `k07` | The inbox's approval deltas still match the recordings Neovim's tests replay. `exit 0`; `# tests 1`, `# pass 1`, `# fail 0`, `# skipped 0` (a skip means no pinned Neovim: BLOCKED, not PASS); `ok` on "recorded protocol fixtures match the live hub attach frames" |
| E414S3-08 | hub-api | static checks | test $W | `quiet && ( . "$Q/env.sh"; cd "$W" && node hub/test/lint-wire-imports.ts; echo "lint exit $?"; npm run typecheck > "$EV/E414S3-08.log" 2>&1; echo "typecheck exit $?" )` | Regression for the changed adapter contract (`hub/src/adapters/contract.ts` gains `approvalsReconciled`), the store (`pendingApprovals`, `saveApproval`) and the scripted fakes. `lint exit 0` and `typecheck exit 0` with no diagnostics in the log |
| E414S3-09 | hub-api | docs | docs | `k09` | T-1113 C6, T-1159 C1 and C2, decision 02:33Z's documented limitation. Counts: `reconnects may re-key` `0`, `until those implementations land` `0`, every other quoted string at least `1` (T-1159: records keep their id across a reconnect; Claude Code always TUI-only; Codex and OpenCode TUI-only on failed checks or over the serialized 64 KiB cap. T-1113: the race with a harness TUI, the losing answer refused, the Codex protocol limitation (`serverRequest/resolved` without the winner; after the hub's write receipt the record reads the hub's choice), persisted metadata in `hub.db`, the restart reconciliation, Claude Code's state-only record, `answered in the harness` for a request missing after a restart, an unfinished answer returning as pending, the `approval-rebuilt` receipt, archived outcomes across restarts, the failed-answer rule; `docs/agents/tests.md`'s race and restart paragraphs; the implement skill's line). `section lines` at least `10`; `future or re-key wording in the section: 0`. Read the approval section whole (`$EV/E414S3-09-section.md`), both `approvalRelay` capability rows (Codex, OpenCode) and the `Rows leave by these rules` list after it, and record any statement that contradicts E414S3-01 to E414S3-14 (for example a row or sentence still saying records are re-keyed, lost or left pending after a restart, or a relay described as future work) as a low finding with file and line. The documented Codex limitation itself is not a finding (decision 02:33Z, T-1162) |
| E414S3-10 | hub-api | CLI; the production Codex and OpenCode adapters with the fake binaries | p1 | `k10` | Live setup. `cx launch exit 0`, `oc launch exit 0`; no `timeout` line. `relay` is exactly `{"claude-code": "none", "opencode": "reliable", "codex": "reliable"}` (key order aside); `procs` `[["qa-cx","codex","running",true],["qa-oc","opencode","running",true]]` (both run in `$Q/p1`) |
| E414S3-11 | hub-api | frame clients; CLI (`cland hub stop`/`start`); p1's journal; process table | p1 | `k11` | T-1113 C3, live, for Codex and OpenCode. No `timeout` line. `hub stop exit 0` and `hub <pid> gone`; `pid-cx alive while the hub is down` and `pid-oc alive while the hub is down` (the harnesses outlive the hub); `restart exit 0` and a `new hub pid` line. `rebuilt receipts: [["hub"],["hub"]]` (one `approval-rebuilt` receipt per record, after native validation, answerable in the hub). The comparison prints two entries, qa-cx then qa-oc, each with `before: "pending"`, `after: "pending"`, `sameSubject: true`, `sameSince: true`, `answerIn: "hub"`, `choices: ["once","always","deny"]`, `outcome: null`, `archived: false`; the subjects are `{command: "touch approved", cwd: <$Q/p1>, reason: "Write a file"}` and `{command: "touch approved && echo done"}`. `approved absent before any answer` |
| E414S3-12 | hub-api | frame clients; CLI (`cland inbox --archive`); the fakes' logs and filesystem | p1 | `k12` | T-1113 C3 (an answer after the restart reaches the harness), live. `cx answer:` `[true, null, "closed", {choice: "once", by: "human", via: "neovim", at: T}]`; `approved file: present`; `decisions for this request: accept` (exactly one decision); `command ran lines: 1`. `oc answer:` `[true, null, "closed", {choice: "deny", by: "human", via: "neovim", at, note: "QA keep it after the restart"}]`; `oc replies for this request: [["reject","QA keep it after the restart",true]]` (the restored OpenCode record answered on qa-oc's own native session, the Deny as `reject` with the note). The archive: `listed` `[false,false]`; `archive` one `["approval","answered",<outcome>]` row per record with the two outcomes above. `cx archive lines: 1` |
| E414S3-13 | hub-api | the fake Codex TUI path; an attached-client OpenCode reply (`tuireply.cjs`); frame clients; CLI | p1 | `k13` | T-1113 C4 and C5, live. No `timeout` line. `hub stop exit 0`, `hub <pid> gone`; `codex TUI answer logged`; `tui reply per_… reject: HTTP 200`; `opencode TUI reply logged`; `restart exit 0`. Late answers: `late cx:` and `late oc:` each `[false, "approval already answered by harness via harness at T"]`. The archive: `listed` `[false,false]`; `offStream` one `["approval","answered",H]` row per record with H = `{choice: "answered in the harness", by: "harness", via: "harness", at: T}` (the disconnected hub did not observe which choice won and infers none); `kept` `[true,true]` (E414S3-12's two outcomes are unchanged in the archive after this restart). `cx decisions for this request: accept` only (the late Deny never reached Codex); `oc replies for this request: [["reject",null,true]]` only (the late Approve never reached OpenCode). `cx archive lines: 1` |
| E414S3-14 | hub-api | captures; p1's logs, journal and `hub.db`; frame client | p1 | `k14` | Decision 9a81a158 after T-1113 persisted records. `private in captures: 0`, `private in hub logs and journal: 0`, `private in hub.db: 0` (the persisted `approval_json` carries only allowlisted fields); `fallback or failure events: 0` (every live request was well-formed, every rebuilt request validated, every answer delivered or refused at the gate); `pending: 0`, `needsYou` equal to `status` |
| E414S3-15 | hub-api | evidence citation (no run) | QA shell | `(cd "$W" && node hub/bin/cland.ts task plan show E-414 --json) > "$EV/E414S3-15-plan.json"` | The stage covers. The Coordinator runs the two stage covers, full integrated suites on Linux and macOS at the tested SHA (`cland verify all --occasion stage`); QA runs no full suite. The verdict cites both runs (run ids, commit, exit, pass/fail/skip counts, artifacts) as the request or the epic topic gives them, and the fresh plan read shows the stage's cover complete on both platforms at `$S`. Covers absent, red or at another SHA when the verdict is due: report BLOCKED on this row (the cases' evidence is kept), not FAIL |
| E414S3-16 | hub-api | process census | p1 | `k16` | Cleanup, judged by the fixture-owned census only (never a machine-wide `pgrep`). `stop qa-cx exit 0`, `stop qa-oc exit 0`; p1's hub stops; no `alive` line names a fixture process (a `cland` hub, `hub serve`, `fc.cjs`, `fake-codex`, `fake-opencode` or `cland-spoke` command), including the hubs stopped by E414S3-11 and E414S3-13; the census line counts every pid this run recorded. An `alive` line whose command is unrelated is pid reuse: record it, it is not a failure. Then remove `$Q` and the worktree as Setup says |

Re-check helper, test and file names with grep at the tested build: renames happen.

Before requesting QA, run `cland qa lint <brief>` with this filled brief at the build under test. The brief is complete only when qa lint passes at the build.

## Probes that mislead

- Process probes judge only the pids this run recorded in `$Q/pids` (each hub started, the launched sessions' app-server and OpenCode server, frame clients); another session's fixtures on this shared machine are never evidence either way. The fake Codex app-server and OpenCode server are the sessions' own processes: they outlive a hub stop by design, and `cland session stop` ends them.
- Edit existing keys in initialized configs (p1's `lock_path` and `executor`); never add a second `[verification]` table.
- Never treat the live project's `hub status` as evidence: the scratch hub is the one whose `.cland/hub.json` sits under `$Q/p1`. `fc.cjs`, `hp` and `cland` read `.cland/hub.json` from the current directory; confirm `pwd` before each p1 row.
- Right after a restart the hub serves restored records from `hub.db` before the adapters reconnect. Their presence alone does not prove the rebuild: E414S3-11 judges ids only after each record's `approval-rebuilt` journal receipt (native replay or snapshot and subject validation). `rebuilt` flushes the hub's logs first; an unflushed journal reads `[]`.
- Model frames (`approval`, `inbox`, `message`, `event`, `session.*`) interleave with the frames a check causes: identify rows by record id, native request id, session name or result id, never by position or by "the last" frame.
- Every frame client here is the local human on the Unix socket, which the hub records as `via: "neovim"`. That is the design, not a mislabel.
- An answer given outside the hub while it is down is unobserved: after the restart the record reads `answered in the harness` by `harness` via `harness`, even though the fake logs the actual `accept` or `reject`. That is the design (the hub never infers an unobserved choice), not a lost outcome.
- Decision 02:33Z: a Codex resolution arriving after the hub's successful write is indistinguishable from the hub's own echo and reads the hub's choice. No check here provokes that timing; a run that sees it is reading the documented limitation (T-1162), not a failure.
- The fake Codex logs every approval decision it reads as `approval <request id>: <decision>`; a message text such as `QA needs approval across a restart` is logged too, so `cxlog` matches only `approval approval-…: ` lines. The fake OpenCode logs every reply it receives, from the hub or from another client; `ocreplies` counts per request id.
- After a Deny, the fake OpenCode interrupts its turn (it reproduces upstream #54180, reason `shutdown`): the session returns to `idle` without a reply message. That is the fake's design, not a failure.
- An `outcome.at` is the hub's clock: compare it across the result, the refusal text, the archive and the CLI line, never with a message's `ts`.
- `nt` runs Node's TAP reporter so the `# tests`/`# pass` counters exist; the default spec reporter prints none. With `--test-name-pattern`, Node reports only the matching tests, so `# tests` counts those. The named tests check the live hub's cover slot (`suite.slot` check) before running: an admission timeout is BLOCKED; retry after `quiet`.
- "No skip": the hub test files here are platform-independent except the `skip: NO_PS` tests in the two contract files, which run wherever `ps` works (macOS included); E414S3-07 needs the pinned Neovim and is BLOCKED, not PASS, without it. `approval-restart.test.ts` (T3) has no skip condition.
- Duration: `approval-restart.test.ts` took about 6 s on Darwin arm64 and about 15 s on Linux in T-1113's receipts, over its 12.2 s allowance on Linux; budgets are report-only and the Coordinator owns that allowance. A wall time is never a pass or fail criterion here.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log: not applicable, nothing here runs on a droplet. Speed criteria use measured wall times, never projections: this stage has none.
- Slots due or queued before the build count even when their results arrive later.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

Any real browser or GUI, and the Web tier: this stage has no web UI (the approval cards are E-417's and E-418's). Real harnesses: no case uses a real Codex or OpenCode binary or account (the epic's Tests constraint). A live Claude Code session in p1: the fake Claude needs the test account fixture, so Claude Code's restart path is proved by E414S3-04 only. A live reproduction of the in-flight races (the held response write, the held OpenCode reply): their timing needs the scripted seams of E414S3-01 to E414S3-03. Codex's residual race, a remote TUI answer whose resolution arrives after the hub's successful write, and reconciling a record from the item's later execution: a documented protocol limitation, follow-up T-1162 under C-326 (Coordinator decision 02:33Z); E414S3-09 checks only that `hub/README.md` states it. Two frame clients answering in one tick (stage 1's gate; the epic's Definition-of-done demo). The epic's Definition-of-done demo itself: this is E-414's last stage, and the demo is a separate run on a named dev commit. The review and criterion marks on the items, the merge gate, T-1113's targeted contract receipts in its topic (QA reruns the contract files itself in E414S3-05 and E414S3-06) and duration budgets, including the Coordinator's allowance update for the restart test. Running the Linux and macOS stage covers (the Coordinator's; QA only cites them, E414S3-15). Work landed on dev after the stage's items. The live project's tracker, hub, crew, `ui.json` and HOME.

Nothing in scope needs an authorization this brief does not give: a check that cannot run for lack of one is BLOCKED, not out of scope.

## Grants

none. Stages 1 and 2 granted nothing, and nothing here needs a grant: every hub stop and start in this run targets p1's scratch hub only.

## Verdict

Fix nothing. Clear only when every check E414S3-00 to E414S3-16 passes, the two stage covers cited in E414S3-15 included. Otherwise not clear, naming the failing, blocked or inconclusive ids and findings; low docs findings from E414S3-09 are listed with file and line for the Coordinator's disposition, as in stage 2. On the epic record one QA verdict with `--stage "races and restarts"`, the full tested dev SHA, the unique run id and the case table, with the two stage covers' receipts (run ids, commit, exit, counts, artifacts) as evidence the run cites, exactly as stages 1 and 2 did. Stage QA carries no epic criterion marks. Report `qa clear E-414 stage races and restarts` or `qa not clear E-414 stage races and restarts` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
