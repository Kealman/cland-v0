# Stage QA brief: E-414 stage 2 — relays and Neovim

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash: start `bash` first and paste every block there (zsh reads `$S:q` or `$B:h` as a modifier, and sourcing the sealed `env.sh` from zsh aborts). The run is local, on macOS (BSD `sed -i ''`, the pinned Neovim of the main worktree).

## Stage

- Epic: E-414 (the approvals relay, under R-377).
- Exact stage name: relays and Neovim.
- Items: T-1111, T-1112 and T-1114, each in its own lane (three parallel lanes; no order between them). The run reads the stage's members from `task plan show E-414` (E414S2-00) and never from a number written here. Findings fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: the combined changed behaviour of the three items at the tested build, on top of stage 1's record and gate (E414S1, clear at `4411dcc9`).
  - T-1111, the Codex relay: each `item/commandExecution/requestApproval` and `item/fileChange/requestApproval` the Codex adapter receives from its session's app-server becomes one record answered in the hub, keyed `<sessionId>:<nativeRequestId>`. A command subject carries `command`, `cwd` and `reason`; a file-change subject carries the paths and diff of the matching turn/item read back with `thread/read {includeTurns: true}`. The choices are Approve once → `accept`, Always for this command → `acceptForSession`, Deny → `decline` (the turn continues; a Deny never reaches Codex as anything else), sent as the response to that request's id. Codex carries no note, so a deny note becomes the human's message to the session in its item topic, else General. `serverRequest/resolved` for a request no hub client answered closes the record as answered in the harness for every client. Replayed pending requests after a reconnect keep the same record id and stay answerable once their subject is validated. A request missing or malforming a field the adapter relies on is a TUI-only record (no choices) with a warn-level `harness-approval-unsupported` event. The capability table reads `approvalRelay: reliable` for Codex. The fake Codex sends one request id to every subscriber (late ones included), reads the client's decision (the command runs and logs `command ran: touch approved` only on accept or acceptForSession), and its own TUI path (the `approve` file) answers as another client would. The Neovim shell recordings carrying the capability table were refreshed.
  - T-1112, the OpenCode relay: each `permission.asked` (of the session or of a child session) becomes a record of the parent cland session, with the full shell command read from the referenced tool part (or the action and resources) and no private permission metadata. The choices are Approve once → `once`, Always for this command → `always`, Deny → `reject`, posted to `POST /api/session/{id}/permission/{requestID}/reply` on the native session that asked, the note travelling as the reply's `message`. `permission.replied` closes the record; a reply from another client (an attached TUI) becomes the harness's outcome. Reconnect snapshots keep pending ids and close permissions answered while the stream was down. Missing fields are TUI-only with a warn-level `opencode-approval-shape` log; native reply failures expose only a safe status/category. The capability table reads `approvalRelay: reliable` for OpenCode. The fake OpenCode logs each reply's decision and message as a `permission-reply` line. The Neovim shell-component recordings were refreshed.
  - T-1114, Neovim's inbox keys: in the panel and the full-width inbox a relayed approval row shows the session, the command or file change and its choices; `1` approves once, `2` approves always when offered, `d` opens **Denial note (optional)** and Enter sends `deny` with the typed note. The row folds in place to its outcome (who, where, when) and leaves by the inbox's visit rule; a refused answer folds to the winner's outcome and says who answered and when. A row answered in the TUI (Claude Code, or a relay that fell back) keeps Enter to attach; `1`, `2` and `d` there say where to answer and send nothing. Footer hint, help line and action groups list the keys; `nvim/README.md` and `GLOSSARY.md` ("Approval") describe them. The inbox recordings were refreshed.
- Decisions governing the scope:
  - Coordinator, ask 9a81a158 (comment on E-414 at 15:17Z 2026-10-22): the record carries the command, its cwd and the reason, plus the file paths and change as the harness reports them, capped at 64 KB, and no other tool input; only the human answers, agent sessions and Aides are refused; the deny note is optional.
  - Coordinator decision of 2026-10-22 23:30Z on E-414 (from rev-32's review of T-1112; it refines the 64 KB cap): an approval whose complete authorization subject (command, or file paths and change) does not fit the public payload cap is a record answered in the TUI. It is not answerable in the hub and directs the human to the harness; truncated text is informational only. This applies to the Codex and OpenCode relays alike. Error paths use the same public-field allowlist as success paths. E414S2-05 is this decision's own case.

Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

Criteria map (the stage verdict carries no item marks; this tells the run which check proves what):

| criterion | proven by |
| --- | --- |
| T-1111 C1 (a scripted command request is one hub record with command, cwd, three choices, `pending`) | E414S2-01, E414S2-11 |
| T-1111 C2 (once/always/deny reach the app-server as `accept`/`acceptForSession`/`decline` to that id; Deny never anything else) | E414S2-01, E414S2-12, E414S2-13 |
| T-1111 C3 (file-change request is a `file change` record answered the same way) | E414S2-01, E414S2-14 |
| T-1111 C4 (`serverRequest/resolved` closes as answered in the harness for every client) | E414S2-01, E414S2-15 |
| T-1111 C5 (missing field: TUI record with a warn-level event) | E414S2-01, E414S2-05 |
| T-1111 C6 (replayed request after reconnect keeps its id and accepts an answer) | E414S2-01 |
| T-1111 C7 (`approvalRelay: reliable` for Codex) | E414S2-01, E414S2-02, E414S2-07, E414S2-10 |
| T-1111 C8 (Codex contract through the fake binary: once runs the command, deny does not) | E414S2-02, E414S2-12, E414S2-13 |
| T-1111 C9 (hub/README.md Codex row) | E414S2-19 |
| T-1112 C1 (shell `permission.asked` is one hub record with the full command, three choices, `pending`) | E414S2-03, E414S2-16 |
| T-1112 C2 (once/always/deny with a note reach the reply endpoint as `once`/`always`/`reject` with the message) | E414S2-03, E414S2-16 |
| T-1112 C3 (`permission.replied` from another client closes with that reply as the harness's outcome, every client reads it) | E414S2-03, E414S2-17 |
| T-1112 C4 (child permission is a parent record answered on the child's endpoint) | E414S2-03 |
| T-1112 C5 (reconnect keeps the pending id; answered-while-down reads closed) | E414S2-03 |
| T-1112 C6 (missing field: TUI record with warning; private metadata never in a frame) | E414S2-03, E414S2-05, E414S2-18 |
| T-1112 C7 (`approvalRelay: reliable` for OpenCode) | E414S2-03, E414S2-04, E414S2-07, E414S2-10 |
| T-1112 C8 (OpenCode contract through the fake binary: Deny with a note reaches it as `reject` with the note) | E414S2-04, E414S2-16 |
| T-1112 C9 (hub/README.md OpenCode row) | E414S2-19 |
| T-1114 C1 (`1` sends one `once` answer and folds to "approved once by the human" with its time) | E414S2-06 |
| T-1114 C2 (`d` opens the note field; Enter sends `deny` with the note) | E414S2-06 |
| T-1114 C3 (refused answer folds to the winner's outcome, naming who and when) | E414S2-06 |
| T-1114 C4 (TUI row: Enter attaches; `1`, `2`, `d` send nothing and say where to answer) | E414S2-06 |
| T-1114 C5 (nvim/README.md keys, fold, TUI row; GLOSSARY Approval) | E414S2-19 |
| Decision 2026-10-22 23:30Z (oversized subject is TUI-only with no choices; error paths allowlisted), both relays | E414S2-05, E414S2-01, E414S2-03 |
| Decision 9a81a158 (allowlist, human-only gate) after the relays changed the inbox | E414S2-08, E414S2-18 |
| Refreshed Neovim recordings (shell, shell-component, inbox-actions) match a live hub | E414S2-07 |

## Build

Use a clean detached worktree at dev at the SHA in the request (the full 40-hex SHA), created below. HEAD must equal that SHA and refs/heads/dev before and after running. All listed items must have merged onto dev: for every member that `task plan show E-414` lists in stage `relays and Neovim`, `git log --first-parent --oneline --grep "Item: <id>" dev` prints exactly one commit. At writing T-1112 landed as `ee1421c7`, T-1111 as `ac3dcf15` and T-1114 as `315081cb`; the shared fix `29c9a46c` (web session-actions expectation after T-1111) and the T-1114 docs follow-up `48ffceb6` carry no `Item:` trailer and are not stage members. If a member's merge check prints nothing, or the build lacks `approvalRelay: 'reliable'` in `hub/src/adapters/codex.ts` or `hub/src/adapters/opencode.ts`, `respond(` in `hub/src/adapters/codex/app-server.ts`, `permission-reply` in `hub/test/fakes/opencode/fake-opencode.ts` or `Denial note (optional)` in `nvim/lua/cland/inbox.lua`, the run is BLOCKED. Dev also carries work landed after these items that is outside this stage; it is not judged here. A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no commit of its own or run id on purpose: committing a brief changes the tested tree. Every expectation below was read from dev at `a43ae84c` (the live p1 rows were dry-run there against a scratch hub): re-check test names, messages and docs strings with grep at the tested build.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step (the setup below does; the clean-tree check ignores that one entry). The pinned Neovim comes from the main worktree's `.cache/nvim/`; never download it into the root. This stage has no Web bundle or browser step and `web/dist` is not needed.

## Setup (once, before E414S2-00)

Two shells, never mixed. **QA's own shell** (bash) keeps QA's session identity: it creates the worktree, runs `quiet` and the one live read (`task plan show E-414` in E414S2-00), and records every check with `qa-record.sh`. **Every other command runs sealed** (rule 15) inside a subshell that sources `$Q/env.sh`: the full `fixtureEnvironment` result (`test-support/fixture-environment.ts`) with a scratch HOME, XDG, Git config and fake-harness homes (`FAKE_CLAUDE_HOME`, `FAKE_CODEX_HOME`, `FAKE_OPENCODE_HOME` under `$Q`), which drops every `CLAND_*`, `GIT_*`, `XDG_*`, `CLAUDE_*`, `CODEX_*`, `OPENCODE_*`, `FAKE_*`, provider and account variable while keeping `PATH`, `SHELL`, `TERM` and `TMPDIR`. Leave `TMPDIR` at the system default (on macOS `/var/folders/...`): Neovim frame fixtures break under `/tmp` (T-1030). The scratch root lives under `/private/tmp/qa-e414s2-` (its realpath, so every scratch path compares as written; short enough for the scratch hub's sockets). Never the live project's hub for anything but E414S2-00's plan read and `quiet`; never the human's HOME, `~/.cland`, `~/.claude`, `~/.codex`, `~/.local/state` or any real Codex or OpenCode account: every harness here is the fake binary of `hub/test/fakes/` or a scripted in-process double.

One scratch project, **p1**: a CLI-started hub (`cland hub start`) with the fake `claude`, `codex` and `opencode` binaries of `hub/test/fakes/` first on its `PATH`, so the production Codex and OpenCode adapters launch the fakes as they would the real harnesses. The fake Codex app-server raises `item/commandExecution/requestApproval` (`command: "touch approved"`, `cwd`, `reason: "Write a file"`) when a prompt contains `needs approval`, and `item/fileChange/requestApproval` (with `content: "PRIVATE-TOOL-INPUT"` in its params) for `needs approval for fileChange`; on accept it creates `approved` in the session's cwd and logs `command ran: touch approved` in `$FAKE_CODEX_HOME/log/<app-server pid>.log`, with one `approval <request id>: <decision>` line per decision. The fake OpenCode server raises `permission.asked` (with `metadata.secret: "private-permission-metadata"`) for `needs approval`, referencing a shell tool part (`touch approved && echo done`, plus private `workdir`, `patchText` and `secret` inputs) when the text also contains `shell approval`, and logs every reply it receives as `permission-reply {session, request, decision, message?}` in `$FAKE_OPENCODE_HOME/prompts/<native session>.log`. p1 proves both relays live end to end, through the CLI and frame clients. Everything else (reconnects, malformed shapes, children, the payload cap, races at the native seam, Neovim's keys) runs through the items' named test files.

In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<the full dev SHA from the request>
RUN=qa-s2-$(date +%F)-1                        # unique run id for E-414; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e414s2-$RUN           # the clean detached build
EV=$R/.cland/qa/E-414/$RUN                     # captures (qa-record.sh keeps its evidence here too)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
Q=$(cd "$(mktemp -d /tmp/qa-e414s2-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/qa-e414s2-…
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data" "$Q/xdg/cache" "$Q/steps" "$Q/p1"
: > "$Q/pids"                                  # the fixture-owned process census: every scratch pid is appended here
holder() { (cd "$W" && node hub/bin/cland.ts verify queue --json) | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);console.log((v.holder?.session??v.holder?.kind??"none")+" waiters "+(v.waiters??[]).length)})'; }
quiet() { for i in $(seq 1 10); do h=$(holder) && case "$h" in "none "*) echo quiet; return 0;; esac; sleep 60; done; echo "BLOCKED: the verify slot is not free after 10 minutes: ${h:-queue read failed}"; return 1; }
# nt <id> <node --test args…>: named test files from $W, sealed, one file at a time, TAP output, after quiet; the log is $EV/<id>.log
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
# alive <pidfile>: the process named in the file still runs
alive() { [ -s "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null; }
# The long-lived streaming client S1 starts detached through bg.cjs, in a session of its own:
# a command runner that ends a row's process group when the row returns cannot end it. Never start one with `&`.
# cap <name>: the current capture file of streaming client <name> (s1)
cap() { cat "$QA_Q/$1.cap"; }
# stream <name> <capture> <hold ms>: (re)start streaming client <name>: subscribed, detached, until $QA_Q/stop-<name> exists
stream() { echo "$2" > "$QA_Q/$1.cap"; env QA_STREAM=1 QA_HOLD_MS="$3" QA_STOP="$QA_Q/stop-$1" node "$QA_Q/bg.cjs" "$QA_Q/$1.pid" "$2" "$QA_Q/steps/subscribe.jsonl" node "$QA_Q/fc.cjs" && seen "$2" '"type":"result","id":"q1"'; }
# live <name> <tag>: say whether streaming client <name> still runs; if not, record what its capture and stderr end with
# and start a replacement capture <capture>-<tag>.jsonl (the row judges deltas from `cap <name>` after this call)
live() { if alive "$QA_Q/$1.pid"; then echo "$1 alive at $2 (pid $(cat "$QA_Q/$1.pid"), $(grep -c . "$(cap "$1")") lines)"; else c=$(cap "$1"); echo "$1 NOT alive at $2: $(grep -c . "$c") lines, last $(tail -n 1 "$c" | cut -c1-80); stderr $(tail -n 3 "$c.err" 2>/dev/null | tr '\n' ' '); restarting as ${c%.jsonl}-$2.jsonl"; stream "$1" "${c%.jsonl}-$2.jsonl" 1800000; fi; }
# closed <record id> <capture>: poll a fresh frame client's archive every second, up to 60 s, until the record is archived;
# the last poll is kept in <capture>
closed() { for i in $(seq 1 60); do printf '{"type":"inbox.list","archive":true}\n' | fc > "$2"; q "$2" 'res("q1").value.archive.some(r=>r.id===A[0])' "$1" | grep -q true && return 0; sleep 1; done; echo "timeout: $1 not archived after 60 s"; return 1; }
# ask <session> <text> <capture prefix>: the human writes <text> in General to <session>; wait until it waits for approval;
# a fresh inbox.list goes to <prefix>-list.jsonl and that session's one pending record id is printed
ask() { printf '{"type":"topic.send","topic":"general","text":"%s","to":["%s"]}\n' "$2" "$1" | fc > "$3-send.jsonl"; waitst "$1" 'waiting for approval' || return 1; sleep 2; printf '{"type":"inbox.list"}\n' | fc > "$3-list.jsonl"; qv "$3-list.jsonl" 'res("q1").value.approvals.find(a=>a.session===A[0]&&a.state==="pending")?.id ?? ""' "$1"; }
# answer <record id> <choice> [note] <capture>: one approval.answer from a fresh frame client (the local human)
answer() { if [ $# -eq 4 ]; then printf '{"type":"approval.answer","approval":"%s","choice":"%s","note":"%s"}\n' "$1" "$2" "$3" | fc > "$4"; else printf '{"type":"approval.answer","approval":"%s","choice":"%s"}\n' "$1" "$2" | fc > "$3"; fi; }
# cxlog: the fake Codex app-server's decision and command lines for qa-cx (its pid recorded by E414S2-10)
cxlog() { grep -E 'approval approval-[^ ]+: |command ran: ' "$FAKE_CODEX_HOME/log/$(cat "$QA_Q/pid-cx").log"; }
# oclog: the fake OpenCode server's reply lines for qa-oc's native session (recorded by E414S2-10)
oclog() { grep -F 'permission-reply ' "$FAKE_OPENCODE_HOME/prompts/$(cat "$QA_Q/ses-oc").log"; }
ENV
: > "$Q/home/.gitconfig"
printf '{"type":"subscribe"}\n' > "$Q/steps/subscribe.jsonl"
grep -c '^unset ' "$Q/env.sh"; ( . "$Q/env.sh"; prefix_count=$(env | cut -d= -f1 | grep -c -E '^(CLAND_|DIGITALOCEAN_|ANTHROPIC_|OPENAI_|GH_|GITHUB_)'); echo "$prefix_count"; test "$prefix_count" -eq 0 ) || exit 1   # confirm 0 before any scratch process starts
```

The helpers. `fc.cjs` is a frame client on the scratch hub's Unix socket (the local human, so the hub records its answers `via: neovim`); `q.cjs` reads captures; `bg.cjs` starts a long-lived helper detached; `tuireply.cjs` is the attached OpenCode TUI's answer without a TUI: another client of the session's own OpenCode server replying on its permission endpoint.

```sh
cat > "$Q/bg.cjs" <<'JS'
'use strict';
// node "$QA_Q/bg.cjs" <pidfile> <out> <stdin file | -> <command> [args…]: starts the command detached, as the leader of
// a session and process group of its own, so that a runner which ends a row's process group when the row returns
// cannot end it. Stdin from the file (nothing for -), stdout to <out>, stderr to <out>.err (both appended), the
// current directory and environment inherited. Writes the pid to <pidfile>, appends it to $QA_Q/pids (the census),
// prints "started <pid>" and returns at once.
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
// QA frame client (E-414 stage relays and Neovim). It prints what a scratch hub sends and asserts nothing.
// node "$QA_Q/fc.cjs" ['<features JSON array>'] < frames.jsonl     (run in the scratch project's directory)
// Connects to ./.cland/hub.json's Unix socket as the local human UI (the secret is never printed) with those
// features, and waits for snapshot.end when "snapshot" is among them. Then sends each stdin line in order and waits
// up to QA_RESULT_MS (default 20000) for its result; ids q1, q2, … are added when missing. Pseudo-frames:
//   {"qa":"wait","ms":N}            pause N ms
//   {"qa":"file","path":"<abs>"}    wait up to 120 s until that file exists
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
// many approval rows carry that id).
const fs = require('node:fs');
const [file, expr, ...A] = process.argv.slice(2);
const lines = fs.readFileSync(file, 'utf8').split('\n').filter(line => line.trim());
const F = lines.flatMap((line, i) => { try { return [JSON.parse(line)]; } catch (error) { if (i === lines.length - 1) return []; throw error; } });
const snap = d => F.find(f => f.type === 'snapshot' && f.domain === d);
const res = id => F.find(f => f.type === 'result' && f.id === id);
const ap = id => F.filter(f => f.type === 'approval' && f.approval.id === id).map(f => f.approval);
const rows = id => F.filter(f => f.type === 'inbox').map(f => f.inbox.approvals.filter(a => a.id === id).length);
console.log(JSON.stringify(eval(expr)));
JS
cat > "$Q/tuireply.cjs" <<'JS'
'use strict';
// node "$QA_Q/tuireply.cjs" <scratch project> <session name> <native permission id> <once|always|reject>   (run sealed)
// Replies to a pending OpenCode permission as another client of that session's own server would (an attached TUI):
// POST /api/session/{native session}/permission/{id}/reply {decision} with HTTP Basic (user opencode, the password
// file cland keeps for the session). Prints the HTTP status only; the password is read from its file, never printed.
const fs = require('node:fs');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const [root, name, per, decision] = process.argv.slice(2);
const Q = process.env.QA_Q;
if (!root || !Q || !root.startsWith(`${Q}/`)) { console.log('refused: not a scratch project'); process.exit(2); }
const list = JSON.parse(execFileSync(process.execPath, [`${process.env.QA_W}/hub/bin/cland.ts`, 'session', 'list', '--json'], { cwd: root, encoding: 'utf8' }));
const p = list.processes.find(x => x.name === name);
const password = fs.readFileSync(`${root}/.cland/opencode/${name}/password`, 'utf8').trim();
const body = JSON.stringify({ decision });
const req = http.request(`${p.harnessId}/api/session/${encodeURIComponent(p.harnessSessionId)}/permission/${encodeURIComponent(per)}/reply`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), authorization: `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}` },
}, res => { res.resume(); res.on('end', () => console.log(`tui reply ${per} ${decision}: HTTP ${res.statusCode}`)); });
req.on('error', e => { console.log(`tui reply error ${e.code ?? e.message}`); process.exitCode = 1; });
req.end(body);
JS
node --check "$Q/bg.cjs" && node --check "$Q/fc.cjs" && node --check "$Q/q.cjs" && node --check "$Q/tuireply.cjs" && echo "helpers parse"
```

Project p1. `cland init` may start a scratch hub: record its pid and stop it before editing the config. Point the existing `lock_path` and `executor` keys at a scratch lock and the local executor (edit the keys init wrote; never add a second table), then start p1's hub with the fakes.

```sh
( . "$Q/env.sh"; cd "$Q/p1" && git init -q -b dev && git commit -q --allow-empty -m init && cland init . > "$EV/E414S2-00-init.txt" 2>&1 || exit 1
  [ -f .cland/hub.json ] && hp >> "$Q/pids"; cland hub stop > /dev/null 2>&1
  sed -i '' -e "s|^lock_path = .*|lock_path = \"$QA_Q/p1-suite.lock\"|" -e 's|^executor = .*|executor = "local"|' .cland/config.toml
  grep -c -x "lock_path = \"$QA_Q/p1-suite.lock\"" .cland/config.toml; grep -c -x 'executor = "local"' .cland/config.toml
  hubstart > "$EV/E414S2-00-p1-start.txt" 2>&1; echo "p1 hub start exit $?"; cland hub status )
```

The check functions. Define them in QA's own shell (paste the block once). Each runs where its table row says; the p1 ones inside a sealed subshell. Each writes its captures under `$EV` and prints the facts the `expected` column judges.

```sh
k00() {   # QA shell: build, merges, plan, sealing
  git -C "$W" rev-parse HEAD refs/heads/dev
  git -C "$W" status --porcelain | grep -v -x '?? node_modules' | wc -l
  (cd "$W" && node hub/bin/cland.ts task plan show E-414 --json) > "$EV/E414S2-00-plan.json"
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=v.stages.find(x=>x.name==="relays and Neovim");console.log(JSON.stringify({stages: v.stages.map(x=>x.name), state: s.state, qa: s.qa, merged: s.merged, total: s.total, items: s.items}))' "$EV/E414S2-00-plan.json" | tee "$EV/E414S2-00-stage.txt"
  for i in $(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).stages.find(x=>x.name==="relays and Neovim").items.join(" "))' "$EV/E414S2-00-plan.json"); do echo "== $i"; git -C "$W" log --first-parent --oneline --grep "Item: $i" dev; done
  grep -c -F "approvalRelay: 'reliable'" "$W/hub/src/adapters/codex.ts" "$W/hub/src/adapters/opencode.ts"
  grep -c -F 'respond(' "$W/hub/src/adapters/codex/app-server.ts"
  grep -c -F 'permission-reply' "$W/hub/test/fakes/opencode/fake-opencode.ts"
  grep -c -F 'Denial note (optional)' "$W/nvim/lua/cland/inbox.lua"
  ls "$W/hub/test/codex-native.test.ts" "$W/hub/test/opencode-native.test.ts" "$W/nvim/test/inbox-actions.test.ts" "$W/nvim/test/fixtures/protocol-frames/inbox-actions.json"
  echo "TMPDIR=$TMPDIR Q=$Q"
  cat "$EV/E414S2-00-p1-start.txt"; wc -l < "$Q/pids"
  ( . "$Q/env.sh"; cd "$Q/p1" && cland hub status )
}
k05() {   # test $W: the payload-cap decision and the error-path allowlist, both relays, by name
  nt E414S2-05a --test-name-pattern='exact serialized UTF-8 cap|malformed Codex command requests fall back to the TUI' hub/test/codex-native.test.ts; oks E414S2-05a
  nt E414S2-05b --test-name-pattern='within the UTF-8 subject cap offer native relay choices|a not-found reply waits for the native outcome|permission shape drift stays in the TUI' hub/test/opencode-native.test.ts; oks E414S2-05b
}
k07() {   # test $W: the capability rows on the refreshed Neovim recordings, the drift check, and the recordings in each landing
  nt E414S2-07a --test-name-pattern='the sessions panel: c shows the capability table' nvim/test/shell.test.ts; oks E414S2-07a
  nt E414S2-07b --test-name-pattern='the OpenCode capability table shows the reliable approval relay' nvim/test/shell-component.test.ts; oks E414S2-07b
  nt E414S2-07c --test-name-pattern='recorded protocol fixtures match the live hub attach frames' nvim/test/scenarios/workbench.test.ts; oks E414S2-07c
  for i in T-1111 T-1112 T-1114; do echo "== $i"; git -C "$W" show --name-only --format= $(git -C "$W" log --first-parent --format=%H --grep "Item: $i" dev) -- nvim/test; done
}
k10() {   # p1: S1 streams; a Codex and an OpenCode session through the production adapters and the fake binaries
  stream s1 "$EV/E414S2-S1.jsonl" 1800000 || return 1   # S1, detached, streams until E414S2-21
  cland session launch qa-cx --role implementer --harness codex > "$EV/E414S2-10-cx.txt" 2>&1; echo "cx launch exit $?"
  cland session launch qa-oc --role implementer --harness opencode > "$EV/E414S2-10-oc.txt" 2>&1; echo "oc launch exit $?"
  waitst qa-cx idle && waitst qa-oc idle || return 1
  cland session list --json > "$EV/E414S2-10-sessions.json"
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));for(const p of v.processes)if(p.pid)console.log(p.pid)' "$EV/E414S2-10-sessions.json" >> "$Q/pids"
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const p=n=>v.processes.find(x=>x.name===n);require("fs").writeFileSync(process.argv[2]+"/pid-cx",String(p("qa-cx").pid));require("fs").writeFileSync(process.argv[2]+"/ses-oc",String(p("qa-oc").harnessSessionId));console.log(JSON.stringify({relay: Object.fromEntries(Object.entries(v.adapters).map(([k,a])=>[k,a.approvalRelay])), procs: ["qa-cx","qa-oc"].map(n=>[n,p(n).harness,p(n).status,p(n).cwd===process.argv[3]])}))' "$EV/E414S2-10-sessions.json" "$Q" "$PWD" | tee "$EV/E414S2-10.txt"
}
k11() {   # p1: a Codex command approval is one record answered in the hub; cland inbox shows it with its choices
  ID=$(ask qa-cx 'QA needs approval' "$EV/E414S2-11") || return 1; echo "$ID" > "$Q/rec-cx1"
  SID=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).processes.find(p=>p.name==="qa-cx").sessionId)' "$EV/E414S2-10-sessions.json")
  q "$EV/E414S2-11-list.jsonl" '(()=>{const m=res("q1").value.approvals.filter(a=>a.session==="qa-cx"), a=m[0]??{};return {rows: m.length, idScoped: String(a.id).startsWith(A[0]+":approval-"), harness: a.harness, kind: a.kind, subject: a.subject, cwdIsP1: a.subject?.cwd===A[1], command: a.command, choices: a.choices, answerIn: a.answerIn, state: a.state, outcome: a.outcome ?? null, attach: String(a.attach).startsWith("codex resume --remote unix://")};})()' "$SID" "$PWD" | tee "$EV/E414S2-11.txt"
  cland inbox > "$EV/E414S2-11-inbox.txt"
  printf 'row lines: '; grep -c -F "approval $ID  qa-cx  touch approved  pending  once, always, deny  from qa-cx [Implementer]  · " "$EV/E414S2-11-inbox.txt"
  [ -e approved ] && echo "approved present before the answer" || echo "approved absent before the answer"
}
k12() {   # p1: Approve once reaches the fake app-server as accept; the fake runs the command; S1 and the archive read the outcome
  ID=$(cat "$Q/rec-cx1")
  answer "$ID" once "$EV/E414S2-12-answer.jsonl"
  waitst qa-cx idle; sleep 1
  q "$EV/E414S2-12-answer.jsonl" '[res("q1").ok, res("q1").error ?? null, res("q1").value?.approval?.state, res("q1").value?.approval?.outcome]' | tee "$EV/E414S2-12.txt"
  T=$(qv "$EV/E414S2-12-answer.jsonl" 'res("q1").value.approval.outcome.at')
  printf 'approved file: '; [ -e approved ] && echo present || echo absent
  cxlog > "$EV/E414S2-12-fake.log"; printf 'accept lines: '; grep -c -F "approval ${ID#*:}: accept" "$EV/E414S2-12-fake.log"; printf 'command ran lines: '; grep -c -F 'command ran: touch approved' "$EV/E414S2-12-fake.log"
  printf '{"type":"topic.history","topic":"general"}\n' | fc > "$EV/E414S2-12-history.jsonl"
  printf 'reply in General: '; q "$EV/E414S2-12-history.jsonl" 'res("q1").value.messages.filter(m=>m.from==="qa-cx"&&m.text==="pong: QA needs approval").length'
  live s1 12
  q "$(cap s1)" '({states: ap(A[0]).map(a=>a.state), outcomes: ap(A[0]).filter(a=>a.state!=="pending").map(a=>a.outcome)})' "$ID"
  closed "$ID" "$EV/E414S2-12-archive.jsonl"
  cland inbox --archive > "$EV/E414S2-12-archive.txt"
  printf 'archive lines: '; grep -c -F "  approval $ID  qa-cx  touch approved  · closed  once by human via neovim at $T" "$EV/E414S2-12-archive.txt"
  rm approved
}
k13() {   # p1: Always reaches Codex as acceptForSession; Deny with a note as decline, the command not run, the note a human message
  ID=$(ask qa-cx 'QA needs approval always' "$EV/E414S2-13a") || return 1
  answer "$ID" always "$EV/E414S2-13a-answer.jsonl"; waitst qa-cx idle; sleep 1
  printf 'always: '; q "$EV/E414S2-13a-answer.jsonl" '[res("q1").ok, res("q1").value?.approval?.outcome]'
  printf 'approved after always: '; [ -e approved ] && echo present || echo absent
  cxlog > "$EV/E414S2-13a-fake.log"; printf 'acceptForSession lines: '; grep -c -F "approval ${ID#*:}: acceptForSession" "$EV/E414S2-13a-fake.log"
  rm -f approved
  ID=$(ask qa-cx 'QA needs approval, deny it' "$EV/E414S2-13b") || return 1
  answer "$ID" deny 'QA keep the tree' "$EV/E414S2-13b-answer.jsonl"; waitst qa-cx idle; sleep 1
  printf 'deny: '; q "$EV/E414S2-13b-answer.jsonl" '[res("q1").ok, res("q1").value?.approval?.outcome]'
  printf 'approved after deny: '; [ -e approved ] && echo present || echo absent
  cxlog > "$EV/E414S2-13b-fake.log"; printf 'decline lines: '; grep -c -F "approval ${ID#*:}: decline" "$EV/E414S2-13b-fake.log"
  printf 'decisions for the denied request: '; grep -c -F "approval ${ID#*:}: " "$EV/E414S2-13b-fake.log"
  printf 'command ran lines: '; grep -c -F 'command ran: touch approved' "$EV/E414S2-13b-fake.log"
  printf '{"type":"topic.history","topic":"general"}\n' | fc > "$EV/E414S2-13-history.jsonl"
  q "$EV/E414S2-13-history.jsonl" '({note: res("q1").value.messages.filter(m=>m.text==="QA keep the tree").map(m=>({from: m.from, fromKind: m.fromKind, to: m.to})), turnContinued: res("q1").value.messages.filter(m=>m.from==="qa-cx"&&m.text==="pong: QA needs approval, deny it").length})'
}
k14() {   # p1: a Codex file-change approval is a file change record with the item's paths and diff; Deny reaches it as decline
  ID=$(ask qa-cx 'QA needs approval for fileChange' "$EV/E414S2-14") || return 1
  q "$EV/E414S2-14-list.jsonl" '(()=>{const a=res("q1").value.approvals.find(x=>x.id===A[0]);return {kind: a.kind, subject: a.subject, filesInP1: JSON.stringify(a.subject.files)===JSON.stringify([A[1]+"/approved"]), command: a.command ?? null, choices: a.choices, answerIn: a.answerIn, state: a.state};})()' "$ID" "$PWD" | tee "$EV/E414S2-14.txt"
  cland inbox > "$EV/E414S2-14-inbox.txt"
  printf 'row lines: '; grep -c -F "approval $ID  qa-cx  @@  pending  once, always, deny  from qa-cx [Implementer]  · " "$EV/E414S2-14-inbox.txt"
  answer "$ID" deny "$EV/E414S2-14-answer.jsonl"; waitst qa-cx idle; sleep 1
  printf 'deny: '; q "$EV/E414S2-14-answer.jsonl" '[res("q1").ok, res("q1").value?.approval?.outcome]'
  printf 'approved file: '; [ -e approved ] && echo present || echo absent
  cxlog > "$EV/E414S2-14-fake.log"; printf 'decline lines: '; grep -c -F "approval ${ID#*:}: decline" "$EV/E414S2-14-fake.log"; printf 'command ran lines: '; grep -c -F 'command ran: touch approved' "$EV/E414S2-14-fake.log"
}
k15() {   # p1: the fake's own TUI path answers; serverRequest/resolved closes the record as answered in the harness; a later answer is refused
  ID=$(ask qa-cx 'QA needs approval in the TUI' "$EV/E414S2-15") || return 1
  live s1 15a; CAP=$(cap s1)
  touch "$FAKE_CODEX_HOME/approve"   # the human approves in the attached Codex TUI
  waitst qa-cx idle
  closed "$ID" "$EV/E414S2-15-closed.jsonl" || return 1
  answer "$ID" deny "$EV/E414S2-15-late.jsonl"
  printf '{"type":"inbox.list","archive":true}\n' | fc > "$EV/E414S2-15-archive.jsonl"
  q "$EV/E414S2-15-late.jsonl" '[res("q1").ok, res("q1").error]'
  q "$EV/E414S2-15-archive.jsonl" '({listed: res("q1").value.approvals.some(a=>a.id===A[0]), archive: res("q1").value.archive.filter(r=>r.id===A[0]).map(r=>[r.kind, r.reason, r.outcome])})' "$ID" | tee "$EV/E414S2-15.txt"
  T=$(qv "$EV/E414S2-15-archive.jsonl" 'res("q1").value.archive.find(r=>r.id===A[0]).outcome.at' "$ID")
  live s1 15b
  q "$CAP" '({states: ap(A[0]).map(a=>a.state), outcomes: ap(A[0]).filter(a=>a.state!=="pending").map(a=>a.outcome)})' "$ID"
  cxlog > "$EV/E414S2-15-fake.log"; printf 'decisions for this request: '; grep -F "approval ${ID#*:}: " "$EV/E414S2-15-fake.log" | sed -E 's/^[^ ]+ //'
  cland inbox --archive > "$EV/E414S2-15-archive.txt"
  printf 'archive lines: '; grep -c -F "  approval $ID  qa-cx  touch approved  · closed  answered in the harness by harness via harness at $T" "$EV/E414S2-15-archive.txt"
  rm -f approved
}
k16() {   # p1: OpenCode shell permissions: once, always and deny with notes reach the fake's reply endpoint as once, always, reject with the message
  : > "$Q/oc-ids"
  for c in once always deny; do
    ID=$(ask qa-oc "QA $c needs approval: shell approval" "$EV/E414S2-16-$c") || return 1; echo "$c $ID" >> "$Q/oc-ids"
    printf '%s record: ' "$c"; q "$EV/E414S2-16-$c-list.jsonl" '(()=>{const m=res("q1").value.approvals.filter(a=>a.session==="qa-oc");const a=m[0]??{};return {rows: m.length, kind: a.kind, subject: a.subject, command: a.command, choices: a.choices, answerIn: a.answerIn, state: a.state};})()'
    cland inbox > "$EV/E414S2-16-$c-inbox.txt"
    printf '%s row lines: ' "$c"; grep -c -F "approval $ID  qa-oc  touch approved && echo done  pending  once, always, deny  from qa-oc [Implementer]  · " "$EV/E414S2-16-$c-inbox.txt"
    if [ "$c" = deny ]; then N='QA do not touch it'; else N="QA note for $c"; fi
    answer "$ID" "$c" "$N" "$EV/E414S2-16-$c-answer.jsonl"
    printf '%s answer: ' "$c"; q "$EV/E414S2-16-$c-answer.jsonl" '[res("q1").ok, res("q1").error ?? null, res("q1").value?.approval?.state, res("q1").value?.approval?.outcome]'
    waitst qa-oc idle; sleep 1
  done
  oclog > "$EV/E414S2-16-fake.log"
  node -e 'const fs=require("fs");const ids=Object.fromEntries(fs.readFileSync(process.argv[2],"utf8").trim().split("\n").map(l=>l.split(" ")));const ses=fs.readFileSync(process.argv[3],"utf8").trim();const L=fs.readFileSync(process.argv[1],"utf8").trim().split("\n").filter(Boolean).map(l=>JSON.parse(l.slice("permission-reply ".length)));console.log(JSON.stringify({lines: L.length, replies: ["once","always","deny"].map(c=>{const r=L.filter(x=>x.request===ids[c].slice(ids[c].indexOf(":")+1));return [c, r.length, r[0]?.session===ses, r[0]?.decision, r[0]?.message];})}))' "$EV/E414S2-16-fake.log" "$Q/oc-ids" "$Q/ses-oc" | tee "$EV/E414S2-16.txt"
  printf '{"type":"topic.history","topic":"general"}\n' | fc > "$EV/E414S2-16-history.jsonl"
  printf 'notes posted as messages: '; q "$EV/E414S2-16-history.jsonl" 'res("q1").value.messages.filter(m=>["QA note for once","QA note for always","QA do not touch it"].includes(m.text)).length'
}
k17() {   # p1: an attached OpenCode client replies; permission.replied closes the record with the harness's reply for every client
  ID=$(ask qa-oc 'QA needs approval: shell approval, answered in the TUI' "$EV/E414S2-17") || return 1
  live s1 17a; CAP=$(cap s1)
  node "$Q/tuireply.cjs" "$PWD" qa-oc "${ID#*:}" always | tee "$EV/E414S2-17-tui.txt"
  waitst qa-oc idle
  closed "$ID" "$EV/E414S2-17-closed.jsonl" || return 1
  answer "$ID" deny "$EV/E414S2-17-late.jsonl"
  printf '{"type":"inbox.list","archive":true}\n' | fc > "$EV/E414S2-17-archive.jsonl"
  q "$EV/E414S2-17-late.jsonl" '[res("q1").ok, res("q1").error]'
  q "$EV/E414S2-17-archive.jsonl" '({listed: res("q1").value.approvals.some(a=>a.id===A[0]), archive: res("q1").value.archive.filter(r=>r.id===A[0]).map(r=>[r.kind, r.reason, r.outcome])})' "$ID" | tee "$EV/E414S2-17.txt"
  T=$(qv "$EV/E414S2-17-archive.jsonl" 'res("q1").value.archive.find(r=>r.id===A[0]).outcome.at' "$ID")
  live s1 17b
  q "$CAP" '({states: ap(A[0]).map(a=>a.state), outcomes: ap(A[0]).filter(a=>a.state!=="pending").map(a=>a.outcome)})' "$ID"
  oclog > "$EV/E414S2-17-fake.log"; printf 'reply lines: '; grep -c . "$EV/E414S2-17-fake.log"; printf 'replies for this request: '; grep -F "\"request\":\"${ID#*:}\"" "$EV/E414S2-17-fake.log" | sed -E 's/.*"decision":"([a-z]+)".*/\1/'
  cland inbox --archive > "$EV/E414S2-17-archive.txt"
  printf 'archive lines: '; grep -c -F "  approval $ID  qa-oc  touch approved && echo done  · closed  always by harness via harness at $T" "$EV/E414S2-17-archive.txt"
}
k18() {   # p1: no private tool input or permission metadata anywhere; no fallback or failure warnings for well-formed requests
  printf 'private in captures: '; cat "$EV"/E414S2-1*.jsonl "$EV"/E414S2-S1*.jsonl | grep -c -E 'PRIVATE-TOOL-INPUT|private-(permission-metadata|tool-input|workdir|patch)|wrong command'
  printf 'private in hub logs: '; cat .cland/log/*.log | grep -c -E 'PRIVATE-TOOL-INPUT|private-(permission-metadata|tool-input|workdir|patch)|wrong command'
  printf 'fallback or failure events: '; grep -c -E '"event":"(harness-approval-unsupported|opencode-approval-shape|approval-answer-failed)"' .cland/log/hub.log
  printf '{"type":"inbox.list"}\n{"type":"hub.status"}\n' | fc > "$EV/E414S2-18-inbox.jsonl"
  q "$EV/E414S2-18-inbox.jsonl" '({pending: res("q1").value.approvals.filter(a=>a.session==="qa-cx"||a.session==="qa-oc").length, needsYou: res("q1").value.needsYou, status: res("q2").value.needsYou})'
}
k19() {   # docs, in QA's own shell
  dc() { printf '%s | %s: ' "$1" "$2"; grep -c -F -- "$2" "$W/$1"; }
  dc hub/README.md '| approvalRelay | reliable: command and file-change requests become records keyed by `<sessionId>:<nativeRequestId>`'
  dc hub/README.md 'Approve once → `accept`, Always for this command → `acceptForSession`'
  dc hub/README.md 'Deny → `decline` (the turn continues)'
  dc hub/README.md "Codex has no note field, so an optional deny note goes to the session's item topic or General as the human's message."
  dc hub/README.md 'oversized subjects are TUI-only, and any clipped text is informational, never authorization to answer from the hub.'
  dc hub/README.md '`serverRequest/resolved` closes an externally answered record as answered in the harness'
  dc hub/README.md 'pending-request replays rebuild the same ids on reconnect'
  dc hub/README.md 'Missing or malformed required fields fall back to `answerIn: tui` with no choices and a warn-level `harness-approval-unsupported` event'
  dc hub/README.md '| approvalRelay | reliable: parent and child `permission.asked` requests become records of the parent cland session.'
  dc hub/README.md 'Approve once → `once`, Always for this command'
  dc hub/README.md 'Deny → `reject`'
  dc hub/README.md 'the optional note travels as the reply'
  dc hub/README.md '`permission.replied` closes the record with the native outcome, including replies from an attached TUI.'
  dc hub/README.md 'Reply failures expose only a safe status/category; a not-found reply does not infer an outcome.'
  dc hub/README.md 'private permission metadata never enters a frame'
  dc hub/README.md 'Missing required fields or a subject exceeding the serialized 64 KiB UTF-8 cap keep that request TUI-only and log a warning; a truncated command never offers relay choices.'
  dc hub/README.md '`1` approves once, `2` approves always when offered, and `d` opens an optional denial note (Enter sends, Esc cancels). TUI-only rows keep Enter to attach.'
  dc hub/README.md '| approvalRelay | none: approvals stay in the TUI'
  dc nvim/README.md '- **Approval keys** (T-1114), in both inbox views: `1` approves once and `2` chooses Always for this command, only when the harness offers it.'
  dc nvim/README.md '`d` opens **Denial note (optional)**; Enter sends `deny` with that note, including an empty note, and Esc cancels.'
  dc nvim/README.md 'A completed selected row folds in place to its outcome'
  dc nvim/README.md 'A refused race reads the archived outcome and folds to the winner, naming who answered and when'
  dc nvim/README.md 'are marked **answer in the session TUI**: Enter still attaches, and `1`, `2` and `d` explain where to answer without sending anything.'
  dc nvim/README.md '| `1` / `2` | a relayed approval in either inbox view | Approve once / Always for this command (`approval.answer`), when offered. |'
  dc nvim/README.md '| `d` | inbox | Deny a relayed approval with an optional note, decline a request or mark one message read.'
  dc GLOSSARY.md '**Approval**:'
  dc GLOSSARY.md "A harness's request for the human to permit a command or file change, with its offered choices and the outcome of the first answer."
  dc nvim/lua/cland/bars.lua '1 once · 2 always · d deny (optional note) · ↵ attach · A archive'
  dc nvim/lua/cland/actions.lua 'Decline request, deny approval or mark message read'
  dc nvim/lua/cland/actions.lua "' or always for this command'"
}
k21() {   # cleanup: stop S1, the two sessions and p1's hub; judge the fixture-owned census only
  touch "$Q/stop-s1"; sleep 2
  cland session stop qa-cx > "$EV/E414S2-21-stop-cx.txt" 2>&1; echo "stop qa-cx exit $?"
  cland session stop qa-oc > "$EV/E414S2-21-stop-oc.txt" 2>&1; echo "stop qa-oc exit $?"
  cland hub stop; sleep 2
  sort -u "$Q/pids" | while read -r p; do [ -n "$p" ] && kill -0 "$p" 2>/dev/null && echo "alive $p $(ps -o command= -p "$p")"; done
  echo "census of $(sort -u "$Q/pids" | grep -c .) fixture pids done"
}
```

Cleanup after the evidence is recorded: print `$Q`, check it begins with `/private/tmp/qa-e414s2-`, and remove it by that literal path with a non-force `rm -r`. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). The scratch hub's secret in `$Q/p1/.cland/hub.json` and the OpenCode session's password file are never printed or posted.

## Cases

none. No headless-grid case in `qa/cases/` covers approval relays or Neovim's approval keys; every check below is a manual check against the scratch hub, a named test file or the docs. Neovim's side (the approval keys, the folds, the capability rows, the recordings) runs through its named headless tests, not through `qa-record.sh run`.

### Web cases (when in scope)

none. This stage has no web UI; the web's approval cards are E-417's and E-418's.

## Manual checks

Record each with `sh .agents/skills/qa/qa-record.sh note E-414 "$RUN" <id> hub-api "<command>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence-file…>`, run from `$W` in QA's own shell; name where it ran at the start of the command text (`[p1]`, `[test $W]`, `[docs]`, `[QA shell]`). The recorder takes `hub-api` for every check here; the `via` column says which client the check speaks through. Save each check's printed output as `$EV/<id>.txt` (pipe the row's command through `tee`) and name it, with the captures the function wrote, as evidence.

How to run a row, by its `where`:
- **p1**: `( . "$Q/env.sh"; cd "$Q/p1" && <command> )`.
- **test $W**: in QA's own shell; `nt` runs `quiet` first and seals the test run itself. Judge each by its `exit` line, the TAP summary counts and the named tests on `ok` lines (`oks <id>` lists them; a name that appears on no `ok` line proves nothing).
- **docs** and **QA shell**: in QA's own shell, as QA; E414S2-00's plan read is the only check that touches the live hub, and only to read.

Order: E414S2-00, then the rows in id order. The test rows (01 to 09) and the p1 rows (10 to 18) do not depend on each other; the p1 rows depend on each other in order, and values later rows reuse live in `$Q` (record ids, the fake Codex pid, the OpenCode native session) and `$EV` captures. E414S2-10 starts the streaming client S1, detached through `bg.cjs`; it runs until E414S2-21 stops it.

| id | surface | via | where | command | expected |
| --- | --- | --- | --- | --- | --- |
| E414S2-00 | hub-api | git, CLI (one live read), scratch CLI | QA shell; p1 | `k00` | Build, merges and sealing. Both SHAs equal `$S`; `0` changed paths. The plan lists the stages `record and gate`, `relays and Neovim`, `races and restarts`; stage `relays and Neovim` has `qa` `{scope: "affected", when: "after-stage"}`, `state: "open"` (it closes only after this verdict and the covers), `items` T-1111, T-1112 and T-1114 in any order plus any findings fixes the request names (nothing else), `total` equal to the number of printed items and `merged` equal to `total`. Under every `== <id>` line exactly one commit line (at writing T-1111 `ac3dcf15`, T-1112 `ee1421c7`, T-1114 `315081cb`; a missing line is BLOCKED). The greps print `1` for each adapter file, at least `1` for `respond(`, `permission-reply` and `Denial note (optional)`; the four files exist. `TMPDIR` is the system default (not `/tmp`) and `$Q` begins `/private/tmp/qa-e414s2-`. p1's init exited 0; the two config greps in the p1 block printed `1` and `1`; `p1 hub start exit 0`; the census holds at least `1` pid; `hub status` reports a running hub for `$Q/p1`. Also record the two counts the sealed-environment block printed before any scratch process started: the first at least `1`, the second `0`, and `helpers parse` |
| E414S2-01 | hub-api | named tests (production Codex adapter on the scripted app-server double, real hub, real frame clients) | test $W | `nt E414S2-01 hub/test/codex-native.test.ts; oks E414S2-01` | T-1111 C1 to C7 at the native seam. `exit 0`; `# fail 0`, `# cancelled 0`, `# skipped 0`, `# pass` equal to `# tests` (27 at writing). On `ok` lines: "a Codex command approval is one allowlisted record and Approve once responds to its native id" (C1, C2: record `<sessionId>:71`, subject exactly command/cwd/reason, three choices, `pending`, a replay adds no row, response `{id: 71, result: {decision: "accept"}}`), "Codex Always and Deny preserve the human outcome when resolved arrives during the response" (C2: `acceptForSession`, `decline`, the note in General), "a Codex request resolved by another client closes for every subscribed client" (C4), "a replayed Codex request after reconnect keeps its record id and accepts an answer" (C6), "the Codex capability table advertises a reliable approval relay" (C7), "a Codex file-change approval reads only the matching item paths and diff, then sends decline" (C3), "malformed Codex command requests fall back to the TUI with a warning and never send a decision" and "Codex validates every routing field and rejects missing or malformed file patches" (C5), "a replayed Codex file approval cannot answer until its subject is validated" (C6), "a Codex file request resolved during its first lookup publishes only the closed harness outcome", "an observed Codex file closure survives native disconnect before its first lookup settles", "a known stopped Codex session admits closed-first history but no new pending approval", "Codex watch replays a first-turn closure observed before its process row was published" (C4 lifecycle) and "Codex relays only complete command and file subjects within the exact serialized UTF-8 cap" (the cap decision) |
| E414S2-02 | hub-api | named tests (T3 contract: the production Codex adapter launching the fake `codex` binary) | test $W | `nt E414S2-02 hub/test/codex-adapter.test.ts; oks E414S2-02` | T-1111 C8 and C7 through the fake binary. `exit 0`; `# fail 0`, `# cancelled 0`, `# skipped 0` (two tests carry `skip: NO_PS`; on macOS `ps` works, so a skip there is BLOCKED with its reason, not PASS), `# pass` equal to `# tests` (12 at writing). On an `ok` line: "a launched Codex session: the app-server runs with the spoke, a UI message goes queued → delivered → injected, the reply comes back, and the state follows thread/status/changed" (a late `AppServerClient` subscriber sees the same request id; Approve once through `approval.answer` makes the fake log `command ran: touch approved` and create `approved`; Deny with a note completes the turn with `approved` absent (ENOENT) and still one `command ran` line; the capability object has `approvalRelay: "reliable"`). This run is the C8 receipt QA cites; it is separate from task verification's T0 to T2 selection |
| E414S2-03 | hub-api | named tests (production OpenCode adapter on the scripted HTTP/SSE transport, real hub, real frame clients) | test $W | `nt E414S2-03 hub/test/opencode-native.test.ts; oks E414S2-03` | T-1112 C1 to C7 at the native seam. `exit 0`; `# fail 0`, `# cancelled 0`, `# skipped 0`, `# pass` equal to `# tests` (26 at writing). On `ok` lines: "a shell permission becomes one answerable record with its full command and no private metadata" (C1, C7), "human permission choices and notes reach the requesting native session through the gate" (C2: `once`, `always`, `reject`, each with its note as `message`), "an attached client permission reply closes the record for every hub client" (C3), "a child permission belongs to the parent record and answers the child endpoint" (C4), "reconnect keeps the same pending permission id and closes an off-stream answer" (C5), "permission shape drift stays in the TUI with a warning and no private frame fields" and "a permission without a native id is visible only as a TUI fallback" (C6), "a native reply during command lookup retains the request and its exact closed outcome", "a not-found reply waits for the native outcome and never records attempted consent" and "only complete commands within the UTF-8 subject cap offer native relay choices" (the cap decision) |
| E414S2-04 | hub-api | named tests (T3 contract: the production OpenCode adapter launching the fake `opencode` binary) | test $W | `nt E414S2-04 hub/test/opencode-adapter.test.ts; oks E414S2-04; grep -F '# permission-reply ' "$EV/E414S2-04.log"` | T-1112 C8 and C7 through the fake binary. `exit 0`; `# fail 0`, `# cancelled 0`, `# skipped 0` (tests carrying `skip: NO_PS` must not skip on macOS: a skip is BLOCKED), `# pass` equal to `# tests` (14 at writing). On `ok` lines: "a pending permission is waiting for approval within one event, and the reply brings the turn back; a form is waiting for human" and "a launched OpenCode session: its own server, the spoke connects, a UI message goes queued → delivered → injected, the reply comes back, the state follows the event stream" (capability `approvalRelay: "reliable"`). The grep prints exactly one diagnostic line `# permission-reply {"session":"ses_…","request":"per_…","decision":"reject","message":"Do not change the workspace."}`: the fake binary received the Deny as `reject` with the note. This run is the C8 receipt QA cites |
| E414S2-05 | hub-api | named tests, by name (both relays' native seams) | test $W | `k05` | The Coordinator decision of 2026-10-22 23:30Z, for Codex and OpenCode alike. First run: `exit 0`; `# tests 2`, `# pass 2`, `# fail 0`, `# skipped 0`; `ok` on "Codex relays only complete command and file subjects within the exact serialized UTF-8 cap" (a command and a file-change subject of exactly 65536 serialized UTF-8 bytes are answerable in the hub with three choices and reach the app-server; one beyond the cap with a trailing distinct operation is `answerIn: tui`, no choices, its subject at most 64 KiB without `HIDDEN-OPERATION`, and `approval.answer` is refused with no native response) and "malformed Codex command requests fall back to the TUI with a warning and never send a decision" (error path: a TUI record, `harness-approval-unsupported` at warn, no `PRIVATE-TOOL-INPUT` in any frame). Second run: `exit 0`; `# tests 3`, `# pass 3`, `# fail 0`, `# skipped 0`; `ok` on "only complete commands within the UTF-8 subject cap offer native relay choices" (ASCII and multibyte commands at exactly 65536 bytes keep the full command and three choices; one byte beyond is TUI-only, no choices, no endpoint call, two `opencode-approval-shape` warnings), "a not-found reply waits for the native outcome and never records attempted consent" (error path: `HTTP 404 … not found`, the planted native body in no result, frame or log, the record still pending with no outcome) and "permission shape drift stays in the TUI with a warning and no private frame fields" |
| E414S2-06 | hub-api | named tests (headless Neovim against the stub hub's recorded frames) | test $W | `nt E414S2-06 nvim/test/inbox-actions.test.ts; oks E414S2-06` | T-1114 C1 to C4. `exit 0`; `# fail 0`, `# cancelled 0`, `# skipped 0` (a skip means no pinned Neovim: BLOCKED, not PASS), `# pass` equal to `# tests` (22 at writing). On `ok` lines: "panel: 1 approves once and folds the recorded approval to its attributed outcome" and "full: 1 approves once …" (C1: one `approval.answer` with `once` and no note; the row folds to "approved once by the human" with its time, full width with `neovim` and the ISO time), "panel: d opens an optional denial note and Enter sends that note" and "full: d …", and "denial note cancellation sends nothing, and Enter with no note still denies" (C2), "panel: a refused answer folds to the durable winner, including who and when" and "full: …", and "a held race archive reply folds its winner without replacing newer live rows or counts" (C3: the status says `approval already answered by human via web at <time>`, the row folds to "approved always by the human"), "panel: TUI-only claude-code rows refuse 1, 2 and d and keep Enter to attach", "full: TUI-only opencode rows refuse 1, 2 and d and keep Enter to attach" and "Enter on a recorded Claude Code approval requests attachment of that session" (C4: no `approval.answer` is sent; each key says `in its session TUI: ↵ attaches`; Enter sends one `session.attach`). Also on `ok` lines: "live approval deltas show answering, restore a failed delivery and fold another client outcome", "file changes show their paths and change; 2 always answers only when offered", "an in-flight approval answer is sent once and failure permits an explicit retry", "panel: folded outcomes stay for the inbox visit and retire when it is left" and "full: …", and "panel: r replies to the selected row, d declines or reads one row, A toggles the seven-day archive" and "full: …" (the action titles and the help line follow the registry) |
| E414S2-07 | hub-api | named tests, by name (headless Neovim shell on recorded frames; recorded frames against an in-process real hub); git | test $W | `k07` | Capability rows and refreshed recordings (T-1111 C7, T-1112 C7). Each of the three runs: `exit 0`; `# tests 1`, `# pass 1`, `# fail 0`, `# skipped 0` (a Neovim skip is BLOCKED); `ok` on "the sessions panel: c shows the capability table, C-v attaches in a vertical split, l opens the launcher" (a Codex session's table shows `approvalRelay   reliable`, the Claude Code one `approvalRelay   none`), "the OpenCode capability table shows the reliable approval relay" and "recorded protocol fixtures match the live hub attach frames" (every recorded Neovim protocol frame, the refreshed shell, shell-component and inbox-actions recordings included, is what a real hub produces at this build). The `git show --name-only` lists: for T-1111 `nvim/test/fixtures/protocol-frames.json`, `nvim/test/fixtures/protocol-frames/shell.json` and `nvim/test/shell.test.ts`; for T-1112 `nvim/test/fixtures/protocol-frames.json`, `nvim/test/fixtures/protocol-frames/shell-component.json` and `nvim/test/shell-component.test.ts`; for T-1114 `nvim/test/fixtures/protocol-frames.json`, `nvim/test/fixtures/protocol-frames/inbox-actions.json`, `nvim/test/inbox-actions.test.ts`, `nvim/test/shell-component.test.ts` and `nvim/test/stub-hub.ts` |
| E414S2-08 | hub-api | named tests (regression of stage 1's record and gate after T-1111 changed `hub/src/hub/inbox.ts`) | test $W | `nt E414S2-08 hub/test/approval-records.test.ts; oks E414S2-08` | Regression. `exit 0`; `# fail 0`, `# cancelled 0`, `# skipped 0`, `# pass` equal to `# tests` (18 at writing). On `ok` lines: "only the human may answer: every agent role including Aides is refused on socket and spoke", "public approval subjects cap UTF-8 at 64 KiB, preserve small changes and exclude private tool input", "two clients in one tick reserve one winner before adapter confirmation and refuse the loser with attribution" and "a pending request has no default answer after 24 hours of fake time" (decision 9a81a158 still holds with the relays' closed-first admission) |
| E414S2-09 | hub-api | static checks | test $W | `quiet && ( . "$Q/env.sh"; cd "$W" && node hub/test/lint-wire-imports.ts; echo "lint exit $?"; npm run typecheck > "$EV/E414S2-09.log" 2>&1; echo "typecheck exit $?" )` | Regression for the changed adapter contract (`hub/src/adapters/contract.ts`: `approvalRequested` returns a boolean, `ApprovalRequest` gains `since` and `outcome`) and the Neovim stub. `lint exit 0` and `typecheck exit 0` with no diagnostics in the log |
| E414S2-10 | hub-api | CLI; frame client S1 (streaming); the production Codex and OpenCode adapters with the fake binaries | p1 | `k10` | Live setup and capabilities (T-1111 C7, T-1112 C7). A `started <pid>` line (S1 runs detached); `cx launch exit 0`, `oc launch exit 0`; no `timeout` line. `relay` is exactly `{"claude-code": "none", "opencode": "reliable", "codex": "reliable"}` (key order aside); `procs` `[["qa-cx","codex","running",true],["qa-oc","opencode","running",true]]` (both run in `$Q/p1`; their state is not judged here: an OpenCode first-turn clause can still be `busy` after the first `idle`, and the later rows wait for the state they need) |
| E414S2-11 | hub-api | CLI (`cland inbox`); frame client; the fake Codex app-server | p1 | `k11` | T-1111 C1, live. The record: `rows: 1`, `idScoped: true` (id `<qa-cx sessionId>:approval-<item uuid>`), `harness: "codex"`, `kind: "command"`, `subject` exactly `{command: "touch approved", cwd: <$Q/p1>, reason: "Write a file"}` with `cwdIsP1: true`, `command: "touch approved"`, `choices: ["once","always","deny"]`, `answerIn: "hub"`, `state: "pending"`, `outcome: null`, `attach: true`. `row lines: 1` (`cland inbox` prints `approval <id>  qa-cx  touch approved  pending  once, always, deny  from qa-cx [Implementer]  · <age>`); `approved absent before the answer` |
| E414S2-12 | hub-api | frame clients (answer, history, archive, S1); CLI; the fake's log and filesystem | p1 | `k12` | T-1111 C2 and C8, live (the epic's tracer demo 2). The answer: `[true, null, "closed", O]` with O = `{choice: "once", by: "human", via: "neovim", at: T}`. `approved file: present`; `accept lines: 1` (the fake logged `approval <native id>: accept`); `command ran lines: 1`; `reply in General: 1` (`pong: QA needs approval`: the turn went on). S1: `states` `["pending","answering","closed"]`, `outcomes` `[O, O]`. No `timeout` line from `closed`; `archive lines: 1` (`… approval <id>  qa-cx  touch approved  · closed  once by human via neovim at T`). The row prints `s1 alive at 12`; a `s1 NOT alive` line is a fixture finding (record it with the line), not a product failure, and S1's judgement then comes from the replacement capture |
| E414S2-13 | hub-api | frame clients; the fake's log and filesystem | p1 | `k13` | T-1111 C2 (Always, Deny) and C8, live. `always:` `[true, {choice: "always", by: "human", via: "neovim", at}]`; `approved after always: present`; `acceptForSession lines: 1`. `deny:` `[true, {choice: "deny", by: "human", via: "neovim", at, note: "QA keep the tree"}]`; `approved after deny: absent`; `decline lines: 1` and `decisions for the denied request: 1` (a Deny reached Codex as `decline` and nothing else); `command ran lines: 2` (once and always only; the denied command never ran). History: `note` exactly one `{from: "human", fromKind: "human", to: ["qa-cx"]}` (Codex carries no note, so the note is the human's message in General: qa-cx has no item); `turnContinued: 1`. A later `pong: QA keep the tree` reply from qa-cx is the fake answering that message, not a failure |
| E414S2-14 | hub-api | frame clients; CLI; the fake's log | p1 | `k14` | T-1111 C3, live. The record: `kind: "file change"`, `subject` exactly `{change: "@@\n-old\n+new", files: [<$Q/p1>/approved]}` with `filesInP1: true` (the matching item's paths and diff from `thread/read`; the request's own `content` is not carried), `command: null`, `choices: ["once","always","deny"]`, `answerIn: "hub"`, `state: "pending"`. `row lines: 1` (`approval <id>  qa-cx  @@  pending  once, always, deny  from …`: a file change shows its change's first line). `deny:` `[true, {choice: "deny", by: "human", via: "neovim", at}]`; `approved file: absent`; `decline lines: 1`; `command ran lines: 2` (unchanged) |
| E414S2-15 | hub-api | the fake's TUI path (its `approve` file); frame clients; S1; CLI | p1 | `k15` | T-1111 C4, live: an answer given outside the hub closes the record for every client. No `timeout` line. Late answer `[false, "approval already answered by harness via harness at T"]`; `listed: false`; `archive` one row `["approval", "answered", H]` with H = `{choice: "answered in the harness", by: "harness", via: "harness", at: T}`. S1 (the second client): `states` `["pending","closed"]` (no `answering`: the hub answered nothing), `outcomes` `[H]`; a replacement capture started after the record was raised may lack the `pending` entry. `decisions for this request:` exactly one line `approval <native id>: accept` (the fake's own TUI path; the late Deny never reached it). `archive lines: 1` (`… approval <id>  qa-cx  touch approved  · closed  answered in the harness by harness via harness at T`). The `s1 … at 15a`/`15b` lines say `alive` or record a replacement (a fixture finding, not a product failure) |
| E414S2-16 | hub-api | frame clients; CLI; the fake OpenCode server's reply log | p1 | `k16` | T-1112 C1, C2 and C8, live (the epic's tracer demo 3). For each of `once`, `always`, `deny`: `record` `{rows: 1, kind: "command", subject: {command: "touch approved && echo done"}, command: "touch approved && echo done", choices: ["once","always","deny"], answerIn: "hub", state: "pending"}` (the full command from the tool part; no workdir, patch, secret or `private-resource`); `row lines: 1`; `answer` `[true, null, "closed", {choice: <c>, by: "human", via: "neovim", at, note: <its note>}]`. The fake's log: `lines: 3`, `replies` `[["once",1,true,"once","QA note for once"],["always",1,true,"always","QA note for always"],["deny",1,true,"reject","QA do not touch it"]]` (each reply went to qa-oc's own native session, the Deny as `reject` with the note as its message). `notes posted as messages: 0` (a note the protocol carries is not repeated in a topic) |
| E414S2-17 | hub-api | an attached-client reply on the session's own OpenCode server (`tuireply.cjs`); frame clients; S1; CLI | p1 | `k17` | T-1112 C3, live. `tui reply per_… always: HTTP 200`; no `timeout` line. Late answer `[false, "approval already answered by harness via harness at T"]`; `listed: false`; `archive` one row `["approval", "answered", H]` with H = `{choice: "always", by: "harness", via: "harness", at: T}` (the harness's reply is the outcome). S1: `states` `["pending","closed"]`, `outcomes` `[H]` (a replacement capture may lack `pending`). `reply lines: 4` (the fake logs every reply it receives: E414S2-16's three and this one) and `replies for this request:` exactly `always` (the late Deny never reached the fake). `archive lines: 1` (`… approval <id>  qa-oc  touch approved && echo done  · closed  always by harness via harness at T`). The `s1 … at 17a`/`17b` lines say `alive` or record a replacement (a fixture finding) |
| E414S2-18 | hub-api | captures; p1's hub logs; frame client | p1 | `k18` | T-1112 C6 and decision 9a81a158 live: `private in captures: 0` and `private in hub logs: 0` (no `PRIVATE-TOOL-INPUT` from the fake Codex's file request, no `private-permission-metadata`, `private-tool-input`, `private-workdir`, `private-patch` or `wrong command` from the fake OpenCode); `fallback or failure events: 0` (every live request was well-formed and every answer delivered); `pending: 0`, `needsYou` equal to `status` |
| E414S2-19 | hub-api | docs | docs | `k19` | T-1111 C9, T-1112 C9 and T-1114 C5. Every count is at least `1`: `hub/README.md`'s Codex row (record id, the three choices and their Codex decisions, the note to the topic, the cap and TUI-only oversize, `serverRequest/resolved`, replays, the fallback warning), its OpenCode row (records of the parent session, the three replies, the note as `message`, `permission.replied`, safe reply failures, no private metadata, the cap) and the inbox section's keys, with the Claude Code row still `none`; `nvim/README.md`'s approval keys, the note field, the fold, the race, the TUI row and both key-table rows; `GLOSSARY.md`'s Approval entry; the footer hint in `bars.lua` and the action titles in `actions.lua`. Read the sections around each hit and record any statement that contradicts E414S2-01 to E414S2-18 as a finding |
| E414S2-20 | hub-api | evidence citation (no run) | QA shell | `(cd "$W" && node hub/bin/cland.ts task plan show E-414 --json) > "$EV/E414S2-20-plan.json"` | The stage covers. The Coordinator runs the two stage covers, full integrated suites on Linux and macOS at the tested SHA (`cland verify all --occasion stage`); QA runs no full suite. The verdict cites both runs (run ids, commit, exit, pass/fail/skip counts, artifacts) as the request or the epic topic gives them, and the fresh plan read shows the stage's cover complete on both platforms at `$S`. Covers absent, red or at another SHA when the verdict is due: report BLOCKED on this row (the cases' evidence is kept), not FAIL |
| E414S2-21 | hub-api | process census | p1 | `k21` | Cleanup, judged by the fixture-owned census only (never a machine-wide `pgrep`). `stop qa-cx exit 0`, `stop qa-oc exit 0`; p1's hub stops; no `alive` line names a fixture process (a `cland` hub, `hub serve`, `fc.cjs`, `fake-codex`, `fake-opencode` or `cland-spoke` command); the census line counts every pid this run recorded. An `alive` line whose command is unrelated is pid reuse: record it, it is not a failure. Then remove `$Q` and the worktree as Setup says. Any `s1 NOT alive` line recorded by earlier rows is listed in the verdict as a fixture finding |

Re-check helper, test and file names with grep at the tested build: renames happen.

Before requesting QA, run `cland qa lint <brief>` with this filled brief at the build under test. The brief is complete only when qa lint passes at the build.

## Probes that mislead

- Process probes judge only the pids this run recorded in `$Q/pids` (the hub, the launched sessions' app-server and OpenCode server, frame clients, S1); another session's fixtures on this shared machine are never evidence either way. The fake Codex app-server and OpenCode server are the sessions' own processes: `cland session stop` ends them.
- Edit existing keys in initialized configs (p1's `lock_path` and `executor`); never add a second `[verification]` table.
- Never treat the live project's `hub status` as evidence: the scratch hub is the one whose `.cland/hub.json` sits under `$Q/p1`. `fc.cjs`, `hp` and `cland` read `.cland/hub.json` from the current directory; confirm `pwd` before each p1 row.
- Model frames (`approval`, `inbox`, `message`, `event`, `session.*`) interleave with the frames a check causes: identify rows by record id, native request id, session name or result id, never by position or by "the last" frame. An action's interval ends at its own `result` frame; the coalesced `inbox` delta (about 250 ms later) arrives after it and is found by id.
- Every frame client here is the local human on the Unix socket, which the hub records as `via: "neovim"`. That is the design, not a mislabel.
- The fake Codex's TUI path (the `approve` file) and the OpenCode attached-client reply are answers from outside the hub: their outcome is `by: "harness"`, `via: "harness"`. The Codex one reads `answered in the harness` (Codex's `serverRequest/resolved` does not say which decision); the OpenCode one carries the reply (`always`).
- The fake Codex logs every approval decision it reads as `approval <request id>: <decision>`; a message text such as `QA needs approval always` is logged too, so `cxlog` matches only `approval approval-…: ` lines. The fake OpenCode logs every reply it receives, from the hub or from another client, as `permission-reply`; count per request id.
- After a Deny, the fake OpenCode interrupts its turn (it reproduces upstream #54180, reason `shutdown`): the session returns to `idle` without a reply message. That is the fake's design, not a failure.
- A Codex Deny note reaches qa-cx as a human message, and the fake answers it (`pong: QA keep the tree`); only the note's own message is judged.
- An `outcome.at` is the hub's clock: compare it across the result, the refusal text, the archive and the CLI line, never with a message's `ts`.
- A command runner can end a row's whole process group when the row returns, which silently kills a helper started with `&`. S1 therefore starts through `bg.cjs` in a session of its own, and every row that judges its stream after a wait checks it with `live` first; closure is judged from fresh reads (`closed`).
- `QA_STREAM=1` captures are complete only after their client ends (`qa-end`); `q.cjs` leaves out an unfinished last line of a capture still being written.
- `nt` runs Node's TAP reporter so the `# tests`/`# pass` counters exist; the default spec reporter prints none. With `--test-name-pattern`, Node reports only the matching tests, so `# tests` counts those. The named tests check the live hub's cover slot (`suite.slot` check) before running: an admission timeout is BLOCKED; retry after `quiet`.
- "No skip": the hub test files here are platform-independent except the `skip: NO_PS` tests in the two contract files, which run wherever `ps` works (macOS included); the Neovim files (E414S2-06, E414S2-07) need the pinned Neovim and are BLOCKED, not PASS, without it.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log: not applicable, nothing here runs on a droplet. Speed criteria use measured wall times, never projections: this stage has none.
- Slots due or queued before the build count even when their results arrive later.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

Any real browser or GUI, and the Web tier: this stage has no web UI (the approval cards are E-417's and E-418's); the shared fix `29c9a46c` (`web/test/session-actions.test.ts` expecting the Codex relay `reliable`) is a Web test proved by the stage covers, not by a case here. Real harnesses: no case uses a real Codex or OpenCode binary or account (the epic's Tests constraint; the relays are proved against the fakes and the scripted doubles). Concurrent answers against the real-hub relays in one tick, answers given in a relayed harness's own TUI while a hub answer is in flight, and records rebuilt after a hub restart while a request is pending (T-1113, stage `races and restarts`). A live Neovim workbench against the scratch hub, approving on its key (the epic's Definition-of-done demo; the items' Neovim seam is the recorded-frame headless test and the fixture drift test). The epic's Definition-of-done demo itself, a separate run. The C8 receipts posted in the items' topics (tracker records checked at review; QA reruns the contract files itself in E414S2-02 and E414S2-04). The review and criterion marks on the items, the merge gate and duration budgets. Running the Linux and macOS stage covers (the Coordinator's; QA only cites them, E414S2-20). Work landed on dev after the stage's items. The live project's tracker, hub, crew, `ui.json` and HOME.

Nothing in scope needs an authorization this brief does not give: a check that cannot run for lack of one is BLOCKED, not out of scope.

## Grants

none. Stage 1 granted nothing, and nothing here needs a grant.

## Verdict

Fix nothing. Clear only when every check E414S2-00 to E414S2-21 passes, the two stage covers cited in E414S2-20 included. Otherwise not clear, naming the failing, blocked or inconclusive ids and findings. On the epic record one QA verdict with `--stage "relays and Neovim"`, the full tested dev SHA, the unique run id and the case table, with the two stage covers' receipts (run ids, commit, exit, counts, artifacts) as evidence the run cites, exactly as stage 1's verdict did. Stage QA carries no epic criterion marks. Report `qa clear E-414 stage relays and Neovim` or `qa not clear E-414 stage relays and Neovim` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
