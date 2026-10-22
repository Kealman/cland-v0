# Stage QA brief: E-417 stage 1 — thread groundwork

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` or `$B:h` as a modifier). The run is local, on macOS (BSD `sed -i ''`, the pinned Neovim of the main worktree, the suite's Chrome Headless Shell).

## Stage

- Epic: E-417 (Topics, threads and the inbox, under R-377).
- Exact stage name: thread groundwork.
- Items, in plan order: T-1115, then T-1118 (lane 1); T-1116 (lane 2); T-1117 (lane 3). The run reads the stage's members, counts and state from `task plan show E-417` (E417S1-00 and E417S1-17), never from a number written here. Findings fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: the combined changed behaviour of the four items at the tested build.
  - T-1115, key contexts and one area slot: the single physical-code key map (`web/src/keymap.ts`) is partitioned into contexts (shell, Items with Plan, Topics, thread, inbox, events, composer, Sessions, Artifacts, Accounts, modal); the focused context's table resolves first, then the shell's, with exact modifiers; a field takes context bindings only when it declares one (`data-key-context="composer"`), ordinary fields keep native keys and `⌘K`; an area opts in to its keys with `handledActions`, so a declared but unhandled key does nothing and is absent from `?` and the palette; every non-Items area renders through `web/src/AreaSlot.tsx`; one key listener (`web/src/keyboard.ts`). No visible change of its own.
  - T-1116, the safe message Markdown parser: `web/src/markdown.ts` exports the pure `parseMarkdown(message, { itemPrefixes })` (headings, paragraphs, lists, quotes, tables as text, fenced code with its language, inline code, bold, italic, http/https links and bare addresses, whole item ids; an unclosed fence ends at the message's end); raw HTML and image syntax stay text; a link token only for `http`/`https`; the web typecheck runs `web/check-html.ts`, which refuses `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML` and `insertAdjacentHTML` anywhere under `web/src`, with seeded fixtures. No renderer uses the parser yet (the message block is stage 2, T-1119).
  - T-1117, the human's kinds and Withdraw in the hub: `topic.send` takes `kind` `message` (default), `decision` or `question`, recorded on the message, its history and its `message` delta; `topic.withdraw {topic, message}` withdraws the human's own ordinary message while every delivery is still queued or accepted without an adapter submission: the deliveries move to the new stage `withdrawn`, the session never receives it, the result returns `{text, message}`; refused once injected (naming the stage), for an agent caller and for another sender's message; allowed on the authenticated web edge; Neovim draws `withdrawn` with the dropped glyph and colour (`✗`, red); the wire types carry the kind and the stage.
  - T-1118, the Topics area and the thread in pages with read marks: Topics lists its topics in four groups (`Waiting for you`, then `Project` with General and Agents set apart, then `Item topics`, then `Closed`, folded by default), each group a shared `Fold` remembered per browser; a row shows title, item, the hub's unread count and last activity; selecting a topic shows its thread beside the list, opening at its end with the latest 100 messages and loading earlier pages by numeric `before` as the reader scrolls up, keeping the top message in place; live `message`, `delivery`, `ask` and `topic` frames update the thread without another history or topic-list read; the web sends `topic.read` up to the last message on screen once it has been visible for one second with the page visible, never while the page is hidden; Topics keys `j`/`k`/arrows, Enter/`l`, `h`, and in the thread `j`/`k`, `h`/Escape. Messages are plain sender/time/text blocks with item links in this slice.
- Decision governing the scope (Coordinator, ask 9a81a158, comment on E-417 at 15:17Z 2026-10-22, per spec §3.4): only a human Question leaves the topic waiting for its addressee; a human Message or Decision does not.

Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

Criteria map (the stage verdict carries no item or epic marks; this tells the run which check proves what):

| criterion | proven by |
| --- | --- |
| T-1115 C1 (one physical key resolves per focused context; Items, Plan and `1`–`7` unchanged) | E417S1-02, E417S1-03, E417S1-14 (`keys`, `help`) |
| T-1115 C2 (a declared composer field takes its context; other fields only `⌘K`) | E417S1-02 |
| T-1115 C3 (declared but unhandled Sessions keys absent from `?`; Items `?` unchanged) | E417S1-02, E417S1-03, E417S1-14 (`help`), E417S1-21 |
| T-1115 C4 (areas through the slot; one key listener; existing Web tests pass) | E417S1-02, E417S1-03, E417S1-10 |
| T-1115 C5 (docs) | E417S1-15 |
| T-1116 C1 (tokens; an unclosed fence ends at the message's end) | E417S1-04 |
| T-1116 C2 (raw HTML stays text; links only for http/https) | E417S1-04, E417S1-14 (`hostile`, rendered as plain text by this slice's thread) |
| T-1116 C3 (typecheck refuses raw-HTML sinks, seeded fixture) | E417S1-05, E417S1-09 |
| T-1117 C1 (Decision and Question carry their kind: message, history, second client's delta) | E417S1-06, E417S1-12 |
| T-1117 C2 (a Question to a session leaves the topic waiting for it, as `cland` reads it; Message and Decision do not) | E417S1-06, E417S1-12 |
| T-1117 C3 (withdraw of a message queued for a busy fake session: `withdrawn`, text returned, never received, also after the turn) | E417S1-06, E417S1-13, E417S1-14 (`stages`) |
| T-1117 C4 (refused once injected, naming the stage; agent caller and another sender's message refused) | E417S1-06, E417S1-13 |
| T-1117 C5 (Neovim draws `withdrawn` with the dropped glyph and colour) | E417S1-07 |
| T-1117 C6 (docs) | E417S1-15 |
| T-1118 C1 (four groups, standing topics apart, closed folded, a fold survives a reload) | E417S1-08, E417S1-14 (`groups`, `folds`), E417S1-21 |
| T-1118 C2 (300 messages open at the end, page back by number with no gap or repeat) | E417S1-08, E417S1-14 (`paging`) |
| T-1118 C3 (a new message appears at the end without another history read) | E417S1-08, E417S1-14 (`liveTail`) |
| T-1118 C4 (one visible second marks read for a second client; a hidden page sends no mark) | E417S1-08, E417S1-14 (`readMarks`, `hiddenPage`) |

Definition-of-done pointer (no marks): E-417 C1 (the Topics area in its four groups, history in pages) is exercised by E417S1-08, E417S1-14 and E417S1-21 as far as this stage builds it; the message block of P12, Markdown rendered as elements, role colours, the human's band, verdicts and artifact chips are later stages.

## Build

Use a clean detached worktree at dev at the SHA in the request (the full 40-hex SHA), created below. HEAD must equal that SHA and refs/heads/dev before and after running. All listed items must have merged onto dev: for every member that `task plan show E-417` lists in stage `thread groundwork`, `git log --first-parent --oneline --grep "Item: <id>" dev` prints exactly one commit. At writing they landed as T-1115 `406844d8`, T-1116 `efb73153`, T-1117 `0c8c8c9a` and T-1118 `8bd5f778`; every expectation below was read from dev at `a4df8aa1`. Dev also carries work landed after these items that is outside this stage (E-414's and E-418's lanes, T-1130 and T-1131 among them); it is not judged here, except that E-418's T-1132 may add handled Sessions keys: the help counts are read from `web/test/palette.test.ts` at the tested build (E417S1-00), not from the numbers here. A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no commit of its own or run id on purpose: committing a brief changes the tested tree. Re-check test names, messages and docs strings with grep at the tested build.

T-1117 changed hub code and all four items change the web bundle or its sources. **Before requesting this run, the requester restarts the live hub at the tested SHA** (any commit whose `hub/src`, `hub/bin` and `shared` equal the tested SHA's) **and rebuilds the root's `web/dist` from the root's dev checkout at the tested SHA** (`npm run build --workspace web` in the root; `web/dist` is ignored, so no commit follows). The request names the commit the live hub runs (LIVE). Only E417S1-21 depends on that; QA never builds, restarts or edits anything in the root.

The worktree lives under the project's `.cland/worktrees/`. Give it a `node_modules` symlink to the root's installed dependencies before any other step (the setup below does; the clean-tree checks ignore that one entry): the Web prerequisite resolves `playwright-core` by a worktree-relative path. The pinned Neovim comes from the main worktree's `.cache/nvim/`; never download it into the root. The browsers are the suite's Chrome Headless Shell under `node_modules/playwright-core/.local-browsers` (each named Web test file starts and closes its own; the walkthrough of E417S1-14 starts one with its own scratch profile against the scratch hub p1) and, for E417S1-21 only, real Chrome. No other GUI process starts.

**The live edge must serve the tested build and the live hub must run its hub code** for E417S1-21. It opens the live hub's web edge at `http://127.0.0.1:56935/`, which serves the root checkout's `web/dist`, not the tested worktree's. Step 0 of "Web cases" compares the `sources` digest the edge serves with the digest E417S1-01 builds from the tested sources, and checks that `git diff --stat <LIVE> HEAD -- hub/src hub/bin shared` prints nothing. If either differs, E417S1-21 is recorded `BLOCKED` with the digests or the diff and reported to the requester, who must rebuild the root bundle or restart the hub at the tested SHA; it reruns under the same run id once the requester says so.

## Setup (once, before E417S1-00)

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree, runs `quiet`, the live reads (`task plan show E-417` in E417S1-00 and E417S1-17, step 0 of E417S1-21) and the real-browser session, and records every check with `qa-record.sh`. **Every other command runs sealed** (rule 15) inside a subshell that sources `$Q/env.sh`: the full `fixtureEnvironment` result (`test-support/fixture-environment.ts`) with a scratch HOME, XDG, Git config and fake-harness homes, which drops every `CLAND_*`, `GIT_*`, `XDG_*`, `CLAUDE_*`, `CODEX_*`, `FAKE_*`, provider and account variable while keeping `PATH`, `SHELL`, `TERM` and `TMPDIR`. Leave `TMPDIR` at the system default (on macOS `/var/folders/...`): Neovim frame fixtures break under `/tmp` (T-1030); only the walkthrough's own command points `TMPDIR` at `$Q/b`, so its browser profile lands there. Never use `env -i`. The scratch root lives under `/private/tmp/qa-e417s1-` (its realpath, so every scratch path compares as written; short enough for the scratch hub's sockets). Never the live project's hub for anything but the reads named above and `quiet`; never the human's HOME, `~/.cland`, `~/.claude`, `~/.codex` or `~/.local/state`.

One scratch project, **p1**: a CLI-started hub (`cland hub start`, run from the tested worktree, so its web edge serves `$W/web/dist` built by E417S1-01 on a free port) with the fake `claude`, `codex` and `opencode` binaries of `hub/test/fakes/` first on its `PATH`, so the production Claude Code adapter launches the fake as it would the real one. Its clients are separate processes: frame clients on its Unix socket (the local human), one driver session holding the Coordinator role (a real spoke started through the test harness, which asks and writes as an agent), the fake Claude Code session `qa-cc` (whose turn QA holds with the fake's `jobs/<id>.turn-hold` file to make it busy), the CLI, and the walkthrough's Headless Shell with two browser contexts signed in through one-time links minted on the socket.

In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<the full dev SHA from the request>
LIVE=<the commit the live hub runs, from the request>
RUN=qa-s1-$(date +%F)-1                        # unique run id for E-417; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e417s1-$RUN           # the clean detached build
EV=$R/.cland/qa/E-417/$RUN                     # captures (qa-record.sh keeps its evidence here too)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
Q=$(cd "$(mktemp -d /tmp/qa-e417s1-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/qa-e417s1-…
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data" "$Q/xdg/cache" "$Q/steps" "$Q/b" "$Q/p1" "$Q/moved"
: > "$Q/pids"                                  # the fixture-owned process census: every scratch pid is appended here
holder() { (cd "$W" && node hub/bin/cland.ts verify queue --json) | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);console.log((v.holder?.session??v.holder?.kind??"none")+" waiters "+(v.waiters??[]).length)})'; }
quiet() { for i in $(seq 1 10); do h=$(holder) && case "$h" in "none "*) echo quiet; return 0;; esac; sleep 60; done; echo "BLOCKED: the verify slot is not free after 10 minutes: ${h:-queue read failed}"; return 1; }
# nt <id> <test files…>: named test files from $W, sealed, one file at a time, TAP output, after quiet; the log is $EV/<id>.log
nt() { id=$1; shift; quiet || return 1; ( . "$Q/env.sh"; cd "$W" && node --test --test-concurrency=1 --test-reporter=tap "$@" > "$EV/$id.log" 2>&1; echo "exit $?" >> "$EV/$id.log" ); tail -n 1 "$EV/$id.log"; grep -E '^# (tests|pass|fail|cancelled|skipped|todo) ' "$EV/$id.log"; grep -E '^ *not ok|# SKIP' "$EV/$id.log" | head -20; }
# oks <id>: the names on the passing (sub)test lines of $EV/<id>.log
oks() { grep -E '^ *ok [0-9]+ - ' "$EV/$1.log" | sed -E 's/^ *ok [0-9]+ - //'; }
# census <id>: Web fixture cleanup only: the number of Web fixture census lines, then how many of them do not end cleanly
census() { grep -c -F 'Web fixture census' "$EV/$1.log"; grep -F 'Web fixture census' "$EV/$1.log" | grep -c -v 'after 0; scratch hub stopped'; }
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
# st <name>: a launched session's state; waitst <name> <state>: wait up to 120 s for it
st() { cland session list --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).processes.find(x=>x.name===process.argv[1]);console.log(p?p.state:"absent")})' "$1"; }
waitst() { for i in $(seq 1 240); do [ "$(st "$1")" = "$2" ] && return 0; sleep 0.5; done; echo "timeout: $1 is $(st "$1"), not $2"; return 1; }
# stageof <message id>: its delivery stage in a fresh General history read; waitstage <id> <stage>: wait up to about 2 min
stageof() { printf '{"type":"topic.history","topic":"general"}\n' | fc > "$QA_Q/hist.jsonl"; qv "$QA_Q/hist.jsonl" 'res("q1").value.messages.find(m=>m.id===A[0])?.stage ?? "absent"' "$1"; }
waitstage() { for i in $(seq 1 120); do [ "$(stageof "$1")" = "$2" ] && return 0; sleep 0.5; done; echo "timeout: $1 is $(stageof "$1"), not $2"; return 1; }
# submitted <log> <text>: how many of the fake session's submitted prompts contain the text (log entries span lines)
submitted() { node -e 'const [f,t]=process.argv.slice(1);const s=require("fs").readFileSync(f,"utf8");console.log(s.split(/\n(?=\d{4}-\d\d-\d\dT\S+ )/).filter(e=>/^\S+ submitted: /.test(e)&&e.includes(t)).length)' "$1" "$2"; }
# alive <pidfile>: the process named in the file still runs
alive() { [ -s "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null; }
# Long-lived helpers (the streaming client S1) start detached through bg.cjs, in a session of their own:
# a command runner that ends a row's process group when the row returns cannot end them. Never start one with `&`.
# cap <name>: the current capture file of streaming client <name>
cap() { cat "$QA_Q/$1.cap"; }
# stream <name> <capture> <hold ms>: (re)start streaming client <name>: subscribed, detached, until $QA_Q/stop-<name> exists
stream() { echo "$2" > "$QA_Q/$1.cap"; env QA_STREAM=1 QA_HOLD_MS="$3" QA_STOP="$QA_Q/stop-$1" node "$QA_Q/bg.cjs" "$QA_Q/$1.pid" "$2" "$QA_Q/steps/subscribe.jsonl" node "$QA_Q/fc.cjs" && seen "$2" '"type":"result","id":"q1"'; }
# live <name> <tag>: say whether streaming client <name> still runs; if not, record what its capture and stderr end with
# and start a replacement capture <capture>-<tag>.jsonl (the row judges deltas from `cap <name>` after this call)
live() { if alive "$QA_Q/$1.pid"; then echo "$1 alive at $2 (pid $(cat "$QA_Q/$1.pid"), $(grep -c . "$(cap "$1")") lines)"; else c=$(cap "$1"); echo "$1 NOT alive at $2: $(grep -c . "$c") lines, last $(tail -n 1 "$c" | cut -c1-80); stderr $(tail -n 3 "$c.err" 2>/dev/null | tr '\n' ' '); restarting as ${c%.jsonl}-$2.jsonl"; stream "$1" "${c%.jsonl}-$2.jsonl" 2700000; fi; }
ENV
: > "$Q/home/.gitconfig"
printf '{"type":"subscribe"}\n' > "$Q/steps/subscribe.jsonl"
cat > "$Q/steps/drv.jsonl" <<'JSON'
{"tool":"ask","args":{"topic":"@file:t-waiting","question":"QA: which direction?","options":["Continue","Wait"]}}
{"tool":"send","args":{"topic":"@file:t-read","text":"QA read check 1"}}
{"tool":"send","args":{"topic":"@file:t-read","text":"QA read check 2"}}
{"tool":"send","args":{"topic":"@file:t-read","text":"@file:hostile.txt"}}
{"tool":"send","args":{"topic":"@file:t-read","text":"QA read check 4"}}
{"tool":"send","args":{"topic":"@file:t-read","text":"QA read check 5"}}
{"tool":"send","args":{"topic":"@file:t-hidden","text":"QA hidden check 1"}}
{"tool":"send","args":{"topic":"@file:t-hidden","text":"QA hidden check 2"}}
{"tool":"send","args":{"topic":"@file:t-hidden","text":"QA hidden check 3"}}
JSON
grep -c '^unset ' "$Q/env.sh"; ( . "$Q/env.sh"; prefix_count=$(env | cut -d= -f1 | grep -c -E '^(CLAND_|DIGITALOCEAN_|ANTHROPIC_|OPENAI_|GH_|GITHUB_)'); echo "$prefix_count"; test "$prefix_count" -eq 0 ) || exit 1   # confirm 0 before any scratch process starts
```

The helpers. `bg.cjs` starts a long-lived helper detached; `fc.cjs` is a frame client on p1's Unix socket (the local human); `q.cjs` reads captures; `drv.mjs` is a driver session (a real spoke started through the test harness, with a role) that calls session tools; `walk.mjs` is the Headless Shell walkthrough. `bg.cjs`, `fc.cjs` and `drv.mjs` are E-414 stage 1's helpers, unchanged but for `fc.cjs`'s header comment.

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
// QA frame client (E-414 stage 1's, reused by E-417 stage thread groundwork). It prints what a scratch hub sends and asserts nothing.
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
cat > "$Q/q.cjs" <<'JS'
'use strict';
// node "$QA_Q/q.cjs" <capture> '<expression>' [args…]: evaluates the expression over a JSON-lines capture and prints
// the value as JSON. In scope: F (every line parsed; an unfinished last line of a capture still being written is left
// out), A (the extra args), fs, res(id) (the result frame with that id), deltas(type, id) (the `message` frames whose
// message.id is id, or the `delivery` frames whose message is id, in arrival order).
const fs = require('node:fs');
const [file, expr, ...A] = process.argv.slice(2);
const lines = fs.readFileSync(file, 'utf8').split('\n').filter(line => line.trim());
const F = lines.flatMap((line, i) => { try { return [JSON.parse(line)]; } catch (error) { if (i === lines.length - 1) return []; throw error; } });
const res = id => F.find(f => f.type === 'result' && f.id === id);
const deltas = (type, id) => F.filter(f => f.type === type && (type === 'message' ? f.message?.id === id : f.message === id));
console.log(JSON.stringify(eval(expr)));
JS
cat > "$Q/walk.mjs" <<'JS'
// node "$QA_Q/walk.mjs" <p1 root>   (sealed, cwd $QA_W, TMPDIR=$QA_Q/b): the Headless Shell walkthrough of E417S1-14.
// Two browser contexts, A and B, each signed in with its own one-time link minted on p1's Unix socket (never printed),
// at 1440x900. Facts about the hub come from fresh frame clients (fc.cjs). Prints one JSON line per fact; a step that
// throws prints {"step":{name,error}} and the walk goes on. Cleanup is judged by this browser's own process group only.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { once } from 'node:events';
const [root] = process.argv.slice(2);
const W = process.env.QA_W, Q = process.env.QA_Q;
if (!root || !Q || !root.startsWith(`${Q}/`)) { console.log(JSON.stringify({ refused: 'not a scratch project' })); process.exit(2); }
appendFileSync(`${Q}/pids`, `${process.pid}\n`);
const ids = JSON.parse(readFileSync(`${Q}/ids.json`, 'utf8'));
const { webPrerequisite, browserCache } = await import(`${W}/web/test/prerequisite.ts`);
process.env.PLAYWRIGHT_BROWSERS_PATH = browserCache;
const { chromium } = createRequire(`${W}/package.json`)('playwright-core');
const { askHubFrame } = await import(`${W}/hub/src/cli/socket-client.ts`);
const discovery = JSON.parse(readFileSync(`${root}/.cland/hub.json`, 'utf8'));
const out = (key, value) => console.log(JSON.stringify({ [key]: value }));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function poll(read, ok, ms) { const end = Date.now() + ms; let v = await read(); while (!ok(v) && Date.now() < end) { await sleep(200); v = await read(); } return v; }
const fc = frames => execFileSync('node', [`${Q}/fc.cjs`], { cwd: root, input: frames.map(f => JSON.stringify(f)).join('\n') + '\n', encoding: 'utf8' })
  .split('\n').filter(Boolean).map(line => JSON.parse(line));
const res = (frames, id) => frames.find(f => f.type === 'result' && f.id === id);
const unread = topic => res(fc([{ type: 'topic.list' }]), 'q1')?.value?.topics?.find(t => t.id === topic)?.unread;
async function step(name, body) { try { await body(); } catch (error) { out('step', { name, error: String(error?.message ?? error) }); } }
const pre = await webPrerequisite();
if (!pre.available) { out('unavailable', pre.reason); process.exit(3); }
const server = await chromium.launchServer({ executablePath: pre.executablePath, headless: true, timeout: 15000 });
const child = server.process();
const exited = once(child, 'exit');
const group = child.pid;
appendFileSync(`${Q}/pids`, `${group}\n`);
const census = () => execFileSync('ps', ['-e', '-o', 'pid=,pgid='], { encoding: 'utf8' }).split('\n')
  .map(line => line.trim().split(/\s+/).map(Number)).filter(([, g]) => g === group).length;
out('profileInScratch', (child.spawnargs.find(arg => arg.startsWith('--user-data-dir=')) ?? '').startsWith(`--user-data-dir=${process.env.TMPDIR}/`));
let before = 0;
try {
  const browser = await chromium.connect(server.wsEndpoint(), { timeout: 15000 });
  try {
    const open = async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
      context.setDefaultTimeout(10000);
      const page = await context.newPage();
      const url = (await askHubFrame(discovery, { type: 'web.link' }, 3000, {})).url;
      const origin = new URL(url).origin;
      const c = { context, page, sent: [], offOrigin: [], dialogs: 0 };
      page.on('request', request => { if (!request.url().startsWith(`${origin}/`)) c.offOrigin.push(request.url()); });
      page.on('dialog', dialog => { c.dialogs++; void dialog.dismiss(); });
      page.on('websocket', socket => socket.on('framesent', event => {
        for (const line of String(event.payload).split('\n')) { try { if (line.trim()) c.sent.push({ at: Date.now(), frame: JSON.parse(line) }); } catch {} }
      }));
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction(() => document.querySelector('nav[aria-label="Areas"]')?.children.length === 7);
      await page.waitForFunction(() => document.querySelector('[aria-label="Hub connection"]')?.textContent === 'Live');
      c.title0 = await page.title();
      return c;
    };
    const topicsArea = async page => {
      if (!(await page.getByRole('heading', { name: 'Topics', exact: true }).count())) await page.keyboard.press('Digit4');
      await page.getByRole('list', { name: 'Topics objects', exact: true }).waitFor();
    };
    const A = await open();
    const B = await open();
    out('visibility', { A: await A.page.evaluate(() => document.visibilityState), B: await B.page.evaluate(() => document.visibilityState) });
    await step('groups', async () => {
      const page = A.page;
      await topicsArea(page);
      out('groups', await page.locator('[data-topic-group]').evaluateAll(nodes => nodes.map(node => ({
        group: node.getAttribute('data-topic-group'),
        fold: node.querySelector('[data-fold-toggle]')?.getAttribute('aria-label'),
        expanded: node.querySelector('[data-fold-toggle]')?.getAttribute('aria-expanded'),
        rows: [...node.querySelectorAll('[data-object-id]')].map(row => row.getAttribute('data-object-id')),
        standing: [...node.querySelectorAll('[data-object-id]')].map(row => row.getAttribute('data-standing')),
      }))));
      out('itemRow', { hasItem: (await page.locator(`[data-object-id="${ids.topics.item}"]`).innerText()).includes(ids.item) });
      out('waitingUnread', await page.locator(`[data-object-id="${ids.topics.waiting}"] [aria-label="Unread"]`).innerText());
    });
    await step('keys', async () => {
      const page = A.page;
      await topicsArea(page);
      const active = () => page.evaluate(() => document.activeElement?.getAttribute('data-object-id') ?? document.activeElement?.getAttribute('role') ?? document.activeElement?.tagName);
      await page.locator('[data-object-id="general"]').focus();
      const seen = [await active()];
      for (const key of ['KeyJ', 'KeyK', 'Enter', 'Escape']) { await page.keyboard.press(key); await sleep(200); seen.push(`${key}:${await active()}`); }
      out('keys', seen);
    });
    await step('help', async () => {
      const page = A.page;
      const counts = {};
      let topicRows = [], lastVisible = null, fallback = [];
      for (const [index, area] of ['Inbox', 'Items', 'Sessions', 'Topics', 'Events', 'Artifacts', 'Accounts'].entries()) {
        await page.keyboard.press(`Digit${index + 1}`);
        await page.getByRole('heading', { name: area, exact: true }).waitFor();
        try { await page.keyboard.press('Shift+Slash'); } catch { fallback.push(area); await page.getByRole('button', { name: 'Help', exact: true }).click(); }
        const dialog = page.getByRole('dialog', { name: `${area} keys`, exact: true });
        await dialog.waitFor();
        counts[area] = await dialog.locator('kbd').count();
        if (area === 'Topics') {
          topicRows = await dialog.locator('[data-key-action]').evaluateAll(nodes => nodes.map(node => `${node.querySelector('dt')?.textContent ?? ''}=${node.querySelector('kbd')?.textContent ?? ''}`));
          const last = dialog.locator('[data-key-action]').last();
          await last.scrollIntoViewIfNeeded();
          lastVisible = await last.evaluate(node => { const r = node.getBoundingClientRect(), d = node.closest('dialog').getBoundingClientRect(); return r.top >= d.top && r.bottom <= d.bottom && r.bottom <= innerHeight; });
        }
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'detached' });
      }
      out('help', counts); out('topicsHelp', topicRows); out('topicsHelpLastRowVisible', lastVisible); out('helpButtonFallback', fallback);
    });
    await step('paging', async () => {
      const page = A.page;
      await topicsArea(page);
      const since = A.sent.length;
      await page.locator(`[data-object-id="${ids.topics.long}"]`).click();
      const thread = page.getByRole('log', { name: 'Long thread thread', exact: true });
      await thread.locator(`[data-message-id="${ids.long.at(-1)}"]`).waitFor();
      const opened = { atEnd: await thread.evaluate(n => Math.abs(n.scrollHeight - n.clientHeight - n.scrollTop) < 2), rows: await thread.locator('[data-message-id]').count() };
      const anchors = [];
      for (const total of [200, 300]) {
        const anchor = await thread.locator('[data-message-id]').first().getAttribute('data-message-id');
        await thread.evaluate(n => { n.scrollTop = 0; n.dispatchEvent(new Event('scroll')); });
        await thread.locator('[data-message-id]').nth(total - 1).waitFor();
        await sleep(300);
        anchors.push({ total, rows: await thread.locator('[data-message-id]').count(),
          anchorKept: await thread.locator(`[data-message-id="${anchor}"]`).evaluate(n => Math.abs(n.getBoundingClientRect().top - n.parentElement.getBoundingClientRect().top) < 3) });
      }
      const rows = await thread.locator('[data-message-id]').evaluateAll(nodes => nodes.map(n => [n.getAttribute('data-message-id'), Number(n.getAttribute('data-message-seq'))]));
      const history = A.sent.slice(since).map(s => s.frame).filter(f => f.type === 'topic.history' && f.topic === ids.topics.long);
      out('paging', { opened, anchors, sameOrder: JSON.stringify(rows.map(r => r[0])) === JSON.stringify(ids.long), unique: new Set(rows.map(r => r[0])).size,
        seqAscending: rows.every((r, i) => i === 0 || r[1] > rows[i - 1][1]), history: history.map(f => f.before ?? null),
        expectedBefore: [null, rows[200]?.[1], rows[100]?.[1]], itemLinks: await thread.locator('[data-item-link="T-999"]').count() });
    });
    await step('liveTail', async () => {
      const page = A.page;
      const thread = page.getByRole('log', { name: 'Long thread thread', exact: true });
      await thread.evaluate(n => { n.scrollTop = n.scrollHeight; n.dispatchEvent(new Event('scroll')); });
      await sleep(500);
      const since = A.sent.length;
      const sent = res(fc([{ type: 'topic.send', topic: ids.topics.long, text: 'QA live tail' }]), 'q1');
      const id = sent?.value?.message?.id;
      await thread.locator(`[data-message-id="${id}"]`).waitFor();
      await sleep(500);
      const types = A.sent.slice(since).map(s => s.frame.type);
      out('liveTail', { sent: sent?.ok, last: (await thread.locator('[data-message-id]').last().getAttribute('data-message-id')) === id,
        atEnd: await thread.evaluate(n => Math.abs(n.scrollHeight - n.clientHeight - n.scrollTop) < 2), rows: await thread.locator('[data-message-id]').count(),
        history: types.filter(t => t === 'topic.history').length, list: types.filter(t => t === 'topic.list').length });
    });
    await step('readMarks', async () => {
      const before = unread(ids.topics.read);
      await topicsArea(B.page);
      const bRow = B.page.locator(`[data-object-id="${ids.topics.read}"] [aria-label="Unread"]`);
      const bBefore = await bRow.innerText();
      const since = A.sent.length;
      await topicsArea(A.page);
      await A.page.locator(`[data-object-id="${ids.topics.read}"]`).click();
      const thread = A.page.getByRole('log', { name: 'Read check thread', exact: true });
      await thread.locator(`[data-message-id="${ids.readLast}"]`).waitFor();
      const shownAt = Date.now();
      const read = await poll(() => A.sent.slice(since).find(s => s.frame.type === 'topic.read' && s.frame.topic === ids.topics.read), Boolean, 6000);
      const after = await poll(() => unread(ids.topics.read), n => n === 0, 6000);
      const bAfter = await poll(() => bRow.innerText(), t => t === '0', 6000);
      out('readMarks', { before, bBefore, upToIsLast: read?.frame?.upTo === ids.readLast, readFrames: A.sent.slice(since).filter(s => s.frame.type === 'topic.read' && s.frame.topic === ids.topics.read).length,
        afterVisibleMs: read ? read.at - shownAt : null, after, bAfter });
    });
    await step('hiddenPage', async () => {
      const before = unread(ids.topics.hidden);
      await topicsArea(B.page);
      await B.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
      const since = B.sent.length;
      await B.page.locator(`[data-object-id="${ids.topics.hidden}"]`).click();
      const thread = B.page.getByRole('log', { name: 'Hidden check thread', exact: true });
      await thread.locator(`[data-message-id="${ids.hiddenLast}"]`).waitFor();
      await sleep(3000);
      const readsHidden = B.sent.slice(since).filter(s => s.frame.type === 'topic.read').length;
      const whileHidden = unread(ids.topics.hidden);
      await B.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
      const after = await poll(() => unread(ids.topics.hidden), n => n === 0, 6000);
      out('hiddenPage', { before, readsHidden, whileHidden, readsVisible: B.sent.slice(since).filter(s => s.frame.type === 'topic.read' && s.frame.topic === ids.topics.hidden).map(s => s.frame.upTo === ids.hiddenLast), after });
    });
    await step('hostile', async () => {
      const page = A.page;
      await topicsArea(page);
      await page.locator(`[data-object-id="${ids.topics.read}"]`).click();
      const thread = page.getByRole('log', { name: 'Read check thread', exact: true });
      const article = thread.locator(`[data-message-id="${ids.hostile}"]`);
      await article.waitFor();
      const text = await article.innerText();
      out('hostile', {
        literal: ['<img src=x onerror="document.title=1">', '<script>document.title=2</script>', '[run](javascript:document.title=3)', '![i](https://evil.test/i.png)'].map(s => text.includes(s)),
        elements: await thread.locator('img, script, iframe, object, embed, video, audio, svg image').count(),
        anchors: await article.locator('a').evaluateAll(nodes => nodes.map(n => [n.getAttribute('href'), n.getAttribute('data-item-link')])),
        javascriptLinks: await page.locator('a[href^="javascript:" i]').count(),
        titleUnchanged: (await page.title()) === A.title0, dialogs: A.dialogs, offOrigin: A.offOrigin.length,
      });
    });
    await step('stages', async () => {
      const page = A.page;
      await topicsArea(page);
      await page.locator('[data-object-id="general"]').click();
      const thread = page.getByRole('log', { name: 'General thread', exact: true });
      await thread.locator(`[data-message-id="${ids.withdrawn}"]`).waitFor();
      const stage = id => thread.locator(`[data-message-id="${id}"] [data-delivery-stage]`).innerText();
      out('stages', { withdrawn: await stage(ids.withdrawn), injected: await stage(ids.injected) });
    });
    await step('folds', async () => {
      const page = A.page;
      const toggle = p => p.locator('[data-topic-group="items"] [data-fold-toggle]');
      await topicsArea(page);
      await toggle(page).click();
      const folded = await toggle(page).getAttribute('aria-expanded');
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => document.querySelector('nav[aria-label="Areas"]')?.children.length === 7);
      await topicsArea(page);
      const afterReload = await toggle(page).getAttribute('aria-expanded');
      await topicsArea(B.page);
      const otherClient = await toggle(B.page).getAttribute('aria-expanded');
      await toggle(page).click();
      out('folds', { folded, afterReload, otherClient, restored: await toggle(page).getAttribute('aria-expanded'),
        recordA: await page.evaluate(() => localStorage.getItem('cland.ui.topics.v1')), recordB: await B.page.evaluate(() => localStorage.getItem('cland.ui.topics.v1')) });
    });
    out('offOrigin', { A: A.offOrigin.length, B: B.offOrigin.length });
    await A.context.close();
    await B.context.close();
  } finally { before = census(); await browser.close(); }
} finally {
  await server.close(); await exited;
  for (let i = 0; i < 50 && census(); i++) await sleep(100);
  out('census', { group, before, after: census() });
}
JS
for f in bg.cjs fc.cjs q.cjs; do node --check "$Q/$f" || echo "syntax error in $f"; done; for f in drv.mjs walk.mjs; do node --check "$Q/$f" || echo "syntax error in $f"; done; echo "helpers checked"
```

Project p1. `cland init` may start a scratch hub: record its pid and stop it before editing the config. Point the existing `lock_path` and `executor` keys at a scratch lock and the local executor (edit the keys init wrote; never add a second table). p1's hub starts in E417S1-11, after E417S1-01 has built `$W/web/dist` (the bundle its web edge serves).

```sh
( . "$Q/env.sh"; cd "$Q/p1" && git init -q -b dev && git commit -q --allow-empty -m init && cland init . > "$EV/E417S1-00-init.txt" 2>&1 || exit 1
  [ -f .cland/hub.json ] && hp >> "$Q/pids"; cland hub stop > /dev/null 2>&1
  sed -i '' -e "s|^lock_path = .*|lock_path = \"$QA_Q/p1-suite.lock\"|" -e 's|^executor = .*|executor = "local"|' .cland/config.toml
  grep -c -x "lock_path = \"$QA_Q/p1-suite.lock\"" .cland/config.toml; grep -c -x 'executor = "local"' .cland/config.toml; grep -c -x 'port = 0' .cland/config.toml )
```

The check functions. Define them in QA's own shell (paste the block once). Each runs where its table row says, writes its captures under `$EV` and prints the facts the `expected` column judges. Rows that run in p1 call them inside `( . "$Q/env.sh"; cd "$Q/p1" && <function> )`.

```sh
k00() {   # QA shell: build, merges, plan, the stage's files and markers, the help counts asserted at the build, sealing
  git -C "$W" rev-parse HEAD refs/heads/dev
  git -C "$W" status --porcelain | grep -v -x '?? node_modules' | wc -l
  readlink "$W/node_modules"
  (cd "$W" && node hub/bin/cland.ts task plan show E-417 --json) > "$EV/E417S1-00-plan.json"
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=v.stages.find(x=>x.name==="thread groundwork");console.log(JSON.stringify({stages: v.stages.map(x=>x.name), state: s.state, qa: s.qa, merged: s.merged, total: s.total, items: s.items}))' "$EV/E417S1-00-plan.json" | tee "$EV/E417S1-00-stage.txt"
  for i in $(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).stages.find(x=>x.name==="thread groundwork").items.join(" "))' "$EV/E417S1-00-plan.json"); do echo "== $i"; git -C "$W" log --first-parent --oneline --grep "Item: $i" dev; done
  ls "$W/web/src/AreaSlot.tsx" "$W/web/test/key-contexts.test.ts" "$W/hub/test/web-keymap.test.ts" "$W/web/src/markdown.ts" "$W/web/check-html.ts" "$W/hub/test/web-markdown.test.ts" "$W/hub/test/topic-withdraw.test.ts" "$W/web/src/TopicsArea.tsx" "$W/web/src/Thread.tsx" "$W/web/src/topic-threads.ts" "$W/web/src/use-topic-read.ts" "$W/web/test/topics.test.ts"
  grep -c -F "'topic.withdraw': true," "$W/hub/src/hub/web-authority.ts"
  grep -c -F "export type HumanMessageKind = 'message' | 'decision' | 'question';" "$W/shared/wire/index.ts"
  grep -c -F "export type DeliveryStage = 'queued' | 'delivered' | 'injected' | 'dropped' | 'withdrawn';" "$W/shared/wire/index.ts"
  grep -c -F "topics: { KeyJ: 'topic-next', ArrowDown: 'topic-next', KeyK: 'topic-previous', ArrowUp: 'topic-previous', Enter: 'topic-open', KeyL: 'topic-open', KeyH: 'topic-close' }," "$W/web/src/keymap.ts"
  grep -n -F "assert.equal(await localHelp.locator('kbd').count()," "$W/web/test/palette.test.ts"
  echo "TMPDIR=$TMPDIR Q=$Q"
  tail -n 3 "$EV/E417S1-00-init.txt"; wc -l < "$Q/pids"
}
k01() {   # sealed, in $W: build the bundle every Web file and p1's edge serve; its stamp for E417S1-21
  ( cd "$QA_W" && npm run build --workspace web > "$EV/E417S1-01.log" 2>&1; echo "build exit $?"; cat web/dist/build-stamp.json | tee "$EV/E417S1-01-stamp.json"; echo; ls web/dist/index.html web/dist/assets )
  git -C "$QA_W" status --porcelain | grep -v -x '?? node_modules' | wc -l
}
k04() {   # sealed, in $W: the parser on one hostile message (the same text the scratch thread renders in E417S1-14)
  ( cd "$QA_W" && node --input-type=module -e '
const { parseMarkdown } = await import(process.argv[1]);
const src = "QA hostile: <img src=x onerror=\"document.title=1\"> <script>document.title=2</script> [run](javascript:document.title=3) ![i](https://evil.test/i.png) see T-1";
const blocks = parseMarkdown(src, { itemPrefixes: ["T", "E"] });
const flat = blocks.flatMap(b => b.children ?? []);
console.log(JSON.stringify({ blocks: blocks.map(b => b.kind), kinds: flat.map(t => t.kind), links: flat.filter(t => t.kind === "link").length, items: flat.filter(t => t.kind === "item").map(t => t.id), joined: flat.map(t => t.text ?? t.id).join("") === src }));
const fence = parseMarkdown("```js\nconst a = 1;", {});
console.log(JSON.stringify({ unclosedFence: fence }));
' "$QA_W/web/src/markdown.ts" ) | tee "$EV/E417S1-04-probe.txt"
}
k05() {   # sealed, in $W/web: the raw-HTML guard clean, then with two planted sources, then clean again
  ( cd "$QA_W/web" && node check-html.ts; echo "clean exit $?"
    printf 'export function plant(node: HTMLElement, message: string) { node.innerHTML = message; }\n' > src/QaPlant.ts
    printf 'export const QaView = (props: { html: string }) => <div dangerouslySetInnerHTML={{ __html: props.html }} />;\n' > src/QaPlant2.tsx
    node check-html.ts > "$EV/E417S1-05-plant.txt" 2>&1; echo "plant exit $?"; cat "$EV/E417S1-05-plant.txt"
    mv src/QaPlant.ts src/QaPlant2.tsx "$QA_Q/moved/"; node check-html.ts; echo "after exit $?" )
  git -C "$QA_W" status --porcelain | grep -v -x '?? node_modules' | wc -l
}
k09() {   # sealed, in $W: the full typecheck with the web guards, the tier lint and the stage's classifications
  ( cd "$QA_W" && npm run typecheck > "$EV/E417S1-09.log" 2>&1; echo "typecheck exit $?"; node hub/test/lint-tiers.ts > "$EV/E417S1-09-tiers.log" 2>&1; echo "tiers exit $?" )
  grep -F -e 'web HTML: raw-HTML sinks refused; seeded fixtures passed' -e 'web colours: token-only sources; colour fixtures passed' -e 'web tokens:' -e 'web hooks: conditional-hook fixture rejected by configured oxlint' "$EV/E417S1-09.log"
  grep -F -e '"hub/test/web-keymap.test.ts": "T1"' -e '"web/test/key-contexts.test.ts": "Web"' -e '"hub/test/web-markdown.test.ts": "T1"' -e '"hub/test/topic-withdraw.test.ts": "T2"' -e '"hub/test/topics-component.test.ts": "T2"' -e '"web/test/topics.test.ts": "Web"' -e '"hub/test/web-area-state.test.ts": "T1"' "$QA_W/hub/test/tiers.json"
}
k10() {   # QA shell: the web/ rules of AGENTS.md at the build: one key listener, browser storage, no new dependency
  git -C "$W" grep -n -E "keydown|keyup|keypress|onKey(Down|Up|Press)" -- web/src
  git -C "$W" grep -n -E "localStorage|sessionStorage" -- web/src
  git -C "$W" grep -n -E "dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML" -- web/src
  for i in T-1115 T-1116 T-1117 T-1118; do c=$(git -C "$W" log --first-parent --format=%H --grep "Item: $i" dev); echo "== $i"; git -C "$W" show --format= "$c" -- package.json package-lock.json web/package.json hub/package.json nvim/package.json | grep -E '^[+-] '; done
}
k11() {   # p1: start the hub and S1; seed the item, the topics, the Coordinator's ask and messages, 300 human messages
  hubstart > "$EV/E417S1-11-start.txt" 2>&1; echo "p1 hub start exit $?"
  cland hub status > "$EV/E417S1-11-status.txt" 2>&1; echo "hub status exit $?"
  node -e 'const d=JSON.parse(require("fs").readFileSync(".cland/hub.json","utf8"));console.log("web port set "+(Number.isInteger(d.webPort)&&d.webPort>0))'
  stream s1 "$EV/E417S1-S1.jsonl" 2700000 || return 1   # S1, detached, streams until E417S1-13 stops it
  printf '{"type":"task.create","title":"Thread item","size":"S"}\n' | fc > "$EV/E417S1-11-task.jsonl"
  qv "$EV/E417S1-11-task.jsonl" 'res("q1").value.item.id' > "$Q/item"
  node -e 'const item=process.argv[1];const f=[{type:"topic.create",title:"Item discussion",item},{type:"topic.create",title:"Finished discussion"},{type:"topic.create",title:"Waiting discussion"},{type:"topic.create",title:"Long thread"},{type:"topic.create",title:"Read check"},{type:"topic.create",title:"Hidden check"},{type:"topic.create",title:"Kinds check"}];console.log(f.map(x=>JSON.stringify(x)).join("\n"))' "$(cat "$Q/item")" | fc > "$EV/E417S1-11-topics.jsonl"
  i=1; for n in item closed waiting long read hidden kinds; do qv "$EV/E417S1-11-topics.jsonl" "res(\"q$i\").value.topic.id" > "$Q/t-$n"; i=$((i + 1)); done
  printf '{"type":"topic.close","topic":"%s"}\n' "$(cat "$Q/t-closed")" | fc > "$EV/E417S1-11-close.jsonl"
  node -e 'require("fs").writeFileSync(process.argv[1], "QA hostile: <img src=x onerror=\"document.title=1\"> <script>document.title=2</script> [run](javascript:document.title=3) ![i](https://evil.test/i.png) see " + process.argv[2])' "$Q/hostile.txt" "$(cat "$Q/item")"
  node "$QA_Q/drv.mjs" "$QA_Q/p1" coord coordinator 2000 < "$Q/steps/drv.jsonl" > "$EV/E417S1-11-drv.jsonl" 2> "$EV/E417S1-11-drv.err"; echo "drv exit $?"
  node -e 'const t=process.argv[1];for(let n=1;n<=300;n++)console.log(JSON.stringify({type:"topic.send",topic:t,text:"Message "+n+" · T-999"}))' "$(cat "$Q/t-long")" > "$Q/steps/long.jsonl"
  fc < "$Q/steps/long.jsonl" > "$EV/E417S1-11-long.jsonl"
  printf '{"type":"topic.list"}\n' | fc > "$EV/E417S1-11-list.jsonl"
  q "$EV/E417S1-11-task.jsonl" '[res("q1").ok, res("q1").value?.item?.id]'
  q "$EV/E417S1-11-topics.jsonl" 'F.filter(f=>f.type==="result").map(f=>f.ok)'
  q "$EV/E417S1-11-close.jsonl" 'res("q1").ok'
  q "$EV/E417S1-11-drv.jsonl" '({ready: F.some(l=>l.ready==="coord"), calls: F.filter(l=>l.tool).map(l=>[l.tool, l.result?.ok ?? null]), errors: F.filter(l=>l.step).length, closed: F.some(l=>l.closed==="coord")})'
  q "$EV/E417S1-11-long.jsonl" '(()=>{const r=F.filter(f=>f.type==="result");return {results: r.length, ok: r.filter(f=>f.ok).length, unique: new Set(r.map(f=>f.value?.message?.id)).size};})()'
  q "$EV/E417S1-11-list.jsonl" 'A.map(n=>{const id=fs.readFileSync(process.env.QA_Q+"/t-"+n,"utf8").trim();const x=res("q1").value.topics.find(t=>t.id===id);return [n, x?.status, x?.unread, x?.item ?? null];})' item closed waiting long read hidden kinds
}
k12() {   # p1: the human's kinds on the message, in history and in S1's deltas; only a Question waits; the journal
  K=$(cat "$Q/t-kinds")
  node -e 'const K=process.argv[1];const f=[{type:"topic.list"}];for(const [text,kind] of [["QA kind message","message"],["QA kind decision","decision"],["QA kind default",null],["QA kind question","question"],["QA message after the question","message"]]){f.push({type:"topic.send",topic:K,to:["coord"],text,...(kind?{kind}:{})});f.push({type:"topic.list"});}f.push({type:"topic.history",topic:K});f.push({type:"topic.send",topic:K,to:["coord"],text:"QA kind order",kind:"order"});f.push({type:"topic.history",topic:K});console.log(f.map(x=>JSON.stringify(x)).join("\n"))' "$K" > "$Q/steps/12.jsonl"
  fc < "$Q/steps/12.jsonl" > "$EV/E417S1-12.jsonl"
  q "$EV/E417S1-12.jsonl" '(()=>{const st=i=>res(i).value.topics.find(t=>t.id===A[0]);const sends=["q2","q4","q6","q8","q10"];const hist=res("q12").value.messages;return {initial: st("q1").status, sent: sends.map(i=>[res(i).ok, res(i).value?.message?.kind]), status: ["q3","q5","q7","q9","q11"].map(i=>st(i).status), waitingFor: ["q3","q9","q11"].map(i=>st(i).waitingFor ?? null), history: sends.map(i=>hist.find(m=>m.id===res(i).value.message.id)?.kind), invalid: [res("q13").ok, res("q13").error], invalidRecorded: res("q14").value.messages.some(m=>m.text==="QA kind order")};})()' "$K"
  live s1 12
  q "$(cap s1)" 'A.map(id=>deltas("message",id).map(f=>f.message.kind))' $(qv "$EV/E417S1-12.jsonl" '["q2","q4","q6","q8","q10"].map(i=>res(i).value.message.id).join(" ")')
  cland hub journal --kind topic-status --json > "$EV/E417S1-12-journal.jsonl"; echo "journal exit $?"
  grep -F "\"topic\":\"$K\"" "$EV/E417S1-12-journal.jsonl" | tee "$EV/E417S1-12-journal-kinds.txt"
  printf 'status lines for the topic: '; grep -c . "$EV/E417S1-12-journal-kinds.txt"
}
k13() {   # p1: Withdraw a message queued for a busy fake session; the refusals; the session never receives it
  cland session launch qa-cc --role implementer --harness claude-code > "$EV/E417S1-13-launch.txt" 2>&1; echo "launch exit $?"
  waitst qa-cc idle || return 1
  cland session list --json > "$EV/E417S1-13-sessions.json"
  HID=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).processes.find(p=>p.name==="qa-cc").harnessId)' "$EV/E417S1-13-sessions.json")
  "$FCC/claude" agents --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s).find(x=>x.id===process.argv[1]);if(a)console.log(a.pid)})' "$HID" >> "$Q/pids"
  FLOG="$FAKE_CLAUDE_HOME/jobs/$HID.log"; HOLD="$FAKE_CLAUDE_HOME/jobs/$HID.turn-hold"
  live s1 13a
  touch "$HOLD"   # the fake holds its next turn until this file is gone: qa-cc stays busy
  printf '{"type":"topic.send","topic":"general","to":["qa-cc"],"text":"QA first turn"}\n' | fc > "$EV/E417S1-13-first.jsonl"
  W0=$(qv "$EV/E417S1-13-first.jsonl" 'res("q1").value.message.id')
  seen "$FLOG" 'turn held: ' || return 1
  waitst qa-cc busy || return 1
  waitstage "$W0" injected || return 1
  printf '{"type":"topic.send","topic":"general","to":["qa-cc"],"text":"QA put this back"}\n' | fc > "$EV/E417S1-13-queued.jsonl"
  W1=$(qv "$EV/E417S1-13-queued.jsonl" 'res("q1").value.message.id'); echo "$W1" > "$Q/m-withdrawn"
  node -e 'const [w0,w1]=process.argv.slice(1);const f=[{type:"topic.history",topic:"general"},{type:"topic.withdraw",topic:"general",message:w0},{type:"topic.withdraw",topic:"general",message:w1},{type:"topic.withdraw",topic:"general",message:w1},{type:"topic.withdraw",topic:"general",message:w1,as:{name:"qa-cc"}},{type:"topic.history",topic:"general"}];console.log(f.map(x=>JSON.stringify(x)).join("\n"))' "$W0" "$W1" > "$Q/steps/13.jsonl"
  fc < "$Q/steps/13.jsonl" > "$EV/E417S1-13-withdraw.jsonl"
  mv "$HOLD" "$Q/moved/"   # release the held turn
  seen "$FLOG" 'turn released: ' || return 1
  waitst qa-cc idle || return 1
  for i in $(seq 1 120); do printf '{"type":"topic.history","topic":"general"}\n' | fc > "$Q/hist.jsonl"; P=$(qv "$Q/hist.jsonl" 'res("q1").value.messages.find(m=>m.from==="qa-cc"&&m.text==="pong: QA first turn")?.id ?? ""'); [ -n "$P" ] && break; sleep 0.5; done
  printf '{"type":"topic.send","topic":"general","to":["qa-cc"],"text":"QA after the turn"}\n' | fc > "$EV/E417S1-13-after.jsonl"
  W2=$(qv "$EV/E417S1-13-after.jsonl" 'res("q1").value.message.id'); echo "$W2" > "$Q/m-injected"
  waitstage "$W2" injected || return 1
  waitst qa-cc idle; sleep 3
  node -e 'const [w2,p]=process.argv.slice(1);const f=[{type:"topic.withdraw",topic:"general",message:w2},{type:"topic.withdraw",topic:"general",message:p},{type:"topic.history",topic:"general"}];console.log(f.map(x=>JSON.stringify(x)).join("\n"))' "$W2" "$P" > "$Q/steps/13b.jsonl"
  fc < "$Q/steps/13b.jsonl" > "$EV/E417S1-13-late.jsonl"
  cp "$FLOG" "$EV/E417S1-13-fake.log"
  q "$EV/E417S1-13-queued.jsonl" '[res("q1").ok, res("q1").value.message.stage ?? null, res("q1").value.outcomes]'
  q "$EV/E417S1-13-withdraw.jsonl" '({before: res("q1").value.messages.find(m=>m.id===A[1])?.stage, injected: [res("q2").ok, res("q2").error], withdraw: [res("q3").ok, res("q3").value?.text, res("q3").value?.message?.stage], again: [res("q4").ok, res("q4").error], agent: [res("q5").ok, res("q5").error], after: res("q6").value.messages.find(m=>m.id===A[1])?.stage, firstStage: res("q6").value.messages.find(m=>m.id===A[0])?.stage})' "$W0" "$W1"
  q "$EV/E417S1-13-late.jsonl" '({pong: A[1] !== "", injectedAfter: [res("q1").ok, res("q1").error], otherSender: [res("q2").ok, res("q2").error], stages: [A[0], A[2]].map(id=>res("q3").value.messages.find(m=>m.id===id)?.stage)})' "$W2" "$P" "$W1"
  printf 'fake log: put back %s, first turn submitted %s, after the turn submitted %s\n' "$(grep -c -F 'QA put this back' "$FLOG")" "$(submitted "$FLOG" 'QA first turn')" "$(submitted "$FLOG" 'QA after the turn')"
  live s1 13b
  q "$(cap s1)" '({w1: deltas("delivery",A[0]).map(f=>f.stage), w2: deltas("delivery",A[1]).map(f=>f.stage)})' "$W1" "$W2"
  touch "$Q/stop-s1"
}
mkids() {   # p1: the ids the walkthrough needs, from the seeding captures, the topics' history and k13's files
  # A driver `send` to the human returns outcomes but no message id (run 1, A-9459): read the ids from history.
  printf '{"type":"topic.history","topic":"%s"}\n{"type":"topic.history","topic":"%s"}\n' "$(cat "$QA_Q/t-read")" "$(cat "$QA_Q/t-hidden")" | fc > "$EV/E417S1-14-history.jsonl"
  node -e '
const fs=require("fs"), Q=process.env.QA_Q, EV=process.argv[1];
const t=n=>fs.readFileSync(`${Q}/t-${n}`,"utf8").trim();
const lines=f=>fs.readFileSync(f,"utf8").split("\n").filter(Boolean).map(l=>JSON.parse(l));
const long=lines(`${EV}/E417S1-11-long.jsonl`).filter(f=>f.type==="result").map(f=>f.value.message.id);
const drv=lines(`${EV}/E417S1-11-drv.jsonl`).filter(l=>l.tool==="send");
const hres=lines(`${EV}/E417S1-14-history.jsonl`).filter(f=>f.type==="result");
const byId=id=>hres.find(f=>f.id===id)?.value?.messages ?? [];
const hist={[t("read")]:byId("q1"),[t("hidden")]:byId("q2")};
const idOf=(topic,text)=>{const m=(hist[topic]??[]).filter(x=>x.text===text).at(-1);if(!m)throw new Error(`no history message in ${topic} for ${text}`);return m.id;};
const sent=topic=>drv.filter(l=>l.args.topic===topic).map(l=>idOf(topic,l.args.text));
const read=sent(t("read")), hidden=sent(t("hidden"));
const hostileSend=drv.find(l=>String(l.args.text).startsWith("QA hostile:"));
const hostile=idOf(hostileSend.args.topic,hostileSend.args.text);
const ids={topics:{item:t("item"),closed:t("closed"),waiting:t("waiting"),long:t("long"),read:t("read"),hidden:t("hidden"),kinds:t("kinds")},item:fs.readFileSync(`${Q}/item`,"utf8").trim(),long,readLast:read.at(-1),hiddenLast:hidden.at(-1),hostile,withdrawn:fs.readFileSync(`${Q}/m-withdrawn`,"utf8").trim(),injected:fs.readFileSync(`${Q}/m-injected`,"utf8").trim()};
fs.writeFileSync(`${Q}/ids.json`, JSON.stringify(ids));
console.log(JSON.stringify({long: long.length, read: read.length, hidden: hidden.length, hostile: Boolean(hostile)}));
' "$EV"
}
k14() {   # p1: the walkthrough in Chrome Headless Shell (TMPDIR at $Q/b only for this command: the browser profile)
  mkids || return 1
  ( cd "$QA_W" && TMPDIR="$QA_Q/b" node "$QA_Q/walk.mjs" "$QA_Q/p1" ) > "$EV/E417S1-14.jsonl" 2> "$EV/E417S1-14.err"; echo "walk exit $?"
  cat "$EV/E417S1-14.jsonl"
}
k15() {   # docs, in QA's own shell
  dc() { printf '%s | %s: ' "$1" "$2"; grep -c -F -- "$2" "$W/$1"; }
  dc web/README.md 'The focused context resolves first, then the shell.'
  dc web/README.md 'Every non-Items area renders through `src/AreaSlot.tsx`.'
  dc web/README.md "Adding a key to an area's table reserves it but does not enable it"
  dc web/README.md '## Message Markdown'
  dc web/README.md 'Raw HTML and image syntax stay text'
  dc web/README.md 'Links allow only explicit http/https addresses'
  dc web/README.md '## Topics and threads'
  dc web/README.md 'Topics renders through `AreaSlot` with its own `topics` context. Waiting topics'
  dc web/README.md 'Threads open at their end with the latest 100 messages and request exclusive'
  dc web/README.md 'Messages are plain sender/time/text blocks with item links in this slice.'
  dc web/README.md 'second with the document visible, `topic.read` names that message explicitly.'
  dc web/README.md 'messages below the viewport stay unread.'
  dc hub/README.md 'Message Markdown uses the pure token parser in `web/src/markdown.ts`'
  dc hub/README.md 'a human Question makes the topic `waiting for agent`; Message and Decision start no wait'
  dc hub/README.md 'Only a Question starts a topic wait for its addressee'
  dc hub/README.md '`topic.withdraw {topic, message}` is human-only on the local and authenticated web edges.'
  dc nvim/README.md '`✗ withdrawn`'
  dc nvim/README.md 'Neovim observes this stage with the same `✗` glyph and red colour as `dropped`'
  dc docs/agents/tests.md '`web/test/key-contexts.test.ts` covers T-1115'
  dc docs/agents/tests.md 'Message Markdown has a lower-tier seam: `hub/test/web-markdown.test.ts` (T1)'
  dc docs/agents/tests.md '### Human kinds and queued withdrawal'
  dc docs/agents/tests.md '`web/test/topics.test.ts` uses the isolated Headless Shell'
}
k18() {   # p1: cleanup: stop S1, qa-cc and p1's hub; judge the fixture-owned census only
  touch "$Q/stop-s1"; sleep 2
  cland session stop qa-cc > "$EV/E417S1-18-stop.txt" 2>&1; echo "session stop exit $?"
  cland hub stop > "$EV/E417S1-18-hubstop.txt" 2>&1; echo "hub stop exit $?"; sleep 2
  sort -u "$Q/pids" | while read -r p; do [ -n "$p" ] && kill -0 "$p" 2>/dev/null && echo "alive $p $(ps -o command= -p "$p")"; done
  echo "census of $(sort -u "$Q/pids" | grep -c .) fixture pids done"
}
```

Cleanup after the evidence is recorded: print `$Q`, check it begins with `/private/tmp/qa-e417s1-`, and remove it by that literal path with a non-force `rm -r`. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). p1's secret in `$Q/p1/.cland/hub.json`, the sign-in links and the cookies are never printed or posted.

## Cases

| case | surface | where | covers | command and expected outcome |
| --- | --- | --- | --- | --- |
| E417S1-21 | real-browser | local macOS, real Chrome, profile cland QA | T-1118 C1 (the Topics surface in the shipped bundle), T-1115 C3 (help lists the handled Topics actions only), E-417 C1 | computer use, steps 0–6 below. The Topics area at the live edge, anonymous. Expected: step 0 prints `index 200`, two equal `sources` digests and an empty hub-code diff; after `4` the pane heading reads `Topics` and the hub connection reads `Offline` (no cookie); the list `Topics objects` shows exactly four group headers, in order `Waiting for you`, `Project`, `Item topics`, `Closed`, the first three unfolded and `Closed` folded (its chevron points right), each with the count `0` and no topic rows (offline there are no topics), and no thread beside the list; Shift and the slash key open `Topics keys` with as many key labels as E417S1-14's `help` printed for Topics (18 at writing): the 14 shared rows (`Go to Inbox` `1` … `Go to Accounts` `7`, `Open palette` `⌘K / Space p`, `Area keys` `?`, `Toggle split` `⌘\`, `Open in other pane` `⌘Enter`, `Close` `Esc`, `Fold group` `←`, `Unfold group` `→`) and the four Topics rows exactly as E417S1-14's `topicsHelp` printed them (labels `Next topic or group`, `Previous topic or group`, `Enter thread or unfold group`, `Fold topic group`, with the same key texts); no thread row (`Next message`, `Previous message`, `Return to topic list`) and no Items row; the last row fully in view in `$EV/E417S1-21-bottom.png` after scrolling the dialog; Esc closes it and the heading stays `Topics`; `j` then `k` move the focus ring between the group headers (`Fold Waiting for you`, `Fold Project`) without folding or unfolding any group, and no key lands in Chrome's own interface |

### Web cases (when in scope)

E417S1-21 runs in one computer-use session, after E417S1-14 (it compares the help it reads with the walkthrough's). QA uses Codex `gpt-6-astra` with computer use, the human's normal HOME and login keychain, and Chrome's existing dedicated profile `cland QA`. The Coordinator tells the human before requesting this run (qa skill, "Web briefs"); QA does not ask again.

The page is the live hub's web edge at `http://127.0.0.1:56935/`. Only that origin (with `http://localhost:56935`) is on Codex's browser origin allowlist (`qa/briefs/T-1011.md`, amendment); other ports and `file://` pages are blocked, so p1's own edge cannot be opened in real Chrome. The page needs no cookie: the edge serves the bundle to anyone on loopback and refuses the `/ws` upgrade without a cookie, so the shell shows itself `Offline` and Topics has no rows. QA never mints a `cland web` link against the live hub: spending one creates a cookie session in the live project's `hub.db`. **Every check that needs the profile signed in to the live hub is out of scope for this run, not BLOCKED: the human has granted no sign-in.** So the real browser proves the shipped Topics surface, its group headers and fold defaults, its keys help and the physical `j`/`k` keys; the groups with rows, the thread, paging, live updates and read marks need a signed-in hub and are proven in Chrome Headless Shell by E417S1-08 and E417S1-14 against scratch hubs.

The page state lives in the `cland QA` profile's storage for this origin. Interact only with the cland tab: keys go to the page only after a click on an empty part of the pane below its heading (never on a group header: a click there folds it). Never click a group header or press `h`, `l` or Enter in Topics: each changes a remembered fold. If a fold was changed by mistake, click that header again so it is as it was and note it. If a key lands in Chrome's own interface instead of the page, the case is FAIL with the screenshot: the shell's key is unusable in the real browser.

Steps:

0. From QA's own shell, after E417S1-01: `curl -s -m 5 -o "$EV/E417S1-21-index.html" -w 'index %{http_code}\n' http://127.0.0.1:56935/ | tee "$EV/E417S1-21-stamps.txt"; curl -s -m 5 -w '\nstamp %{http_code}\n' http://127.0.0.1:56935/build-stamp.json | tee -a "$EV/E417S1-21-stamps.txt"; cat "$R/web/dist/build-stamp.json" "$EV/E417S1-01-stamp.json" | tee -a "$EV/E417S1-21-stamps.txt"; git -C "$W" diff --stat "$LIVE" HEAD -- hub/src hub/bin shared | tee "$EV/E417S1-21-hubdiff.txt"; wc -c < "$EV/E417S1-21-hubdiff.txt"`. `index 200` goes on; `503` makes E417S1-21 INCONCLUSIVE ("live edge bundle missing"); `000` makes it BLOCKED ("live web edge not on port 56935"). The `sources` digest the live edge serves (the `stamp 200` body; the root's file if the edge answers `stamp 404`) must equal the `sources` digest of E417S1-01; if they differ, the live edge serves another build: record E417S1-21 `BLOCKED` with both digests, skip to step 6 and report to the requester ("live edge build stamp does not match the tested SHA; rebuild the root's web/dist at it"). The hub-code diff must be empty (`0` bytes); otherwise record E417S1-21 `BLOCKED` with the diff, skip to step 6 and report to the requester ("live hub code differs from the tested SHA; restart the hub at it"). Either rerun goes under the same run id once the requester says it is fixed.
1. Screenshot the screen as it is: `$EV/E417S1-21-before.png`. Open Chrome with the existing profile `cland QA`. If no such profile exists, do not create one and do not use the default profile or another browser: record E417S1-21 `BLOCKED` with "no dedicated cland QA profile in Chrome" and go to step 6.
2. In a new tab of that profile, open `http://127.0.0.1:56935/` and wait for the shell. If the pane is split from an earlier run, note it and close the second pane (Close). Click an empty part of the pane and press `4`. Screenshot `$EV/E417S1-21-topics.png`. If a group's fold differs from the expected defaults because of an earlier run, note it, do not change it, and judge the defaults from E417S1-14's `groups` instead (the remembered fold is the documented behaviour).
3. Click an empty part of the pane below the heading, press Shift and the slash key (if computer use rejects the slash key name, send the keysym `question`, as earlier runs did); screenshot `$EV/E417S1-21-help.png`; transcribe the dialog's rows into `$EV/E417S1-21-keys.txt` (label and key, one per line) and count the key labels; scroll the dialog to its end and screenshot `$EV/E417S1-21-bottom.png`. Press Esc; screenshot `$EV/E417S1-21-closed.png`.
4. Click an empty part of the pane below the heading, press `j`; screenshot `$EV/E417S1-21-j.png`; press `j` again, then `k`; screenshot `$EV/E417S1-21-k.png` (the ring is on a group header each time; no group changed its fold).
5. Restore: press `1`, make sure one pane shows `Inbox` and the rail is as step 2 found it. Close only the tab you opened; leave every other tab and window alone. Screenshot `$EV/E417S1-21-after.png`.
6. Record the case from `$W`:
   `sh .agents/skills/qa/qa-record.sh note E-417 "$RUN" E417S1-21 real-browser "computer use: Chrome profile cland QA, http://127.0.0.1:56935/, Topics area offline, keys help, j and k; observed <what>; stamps <equal|differ>; hub diff <empty|not empty>; tab closed" <PASS|INCONCLUSIVE|BLOCKED|FAIL> $EV/E417S1-21*.png $EV/E417S1-21-keys.txt $EV/E417S1-21-stamps.txt`

Stop at once and record `BLOCKED` on any prompt or refusal, with its exact text and a screenshot when the tools allow one: a macOS prompt for Screen Recording, Accessibility, Automation or the keychain; a harness refusal of computer use or a Browser Use URL policy refusal; a missing `cland QA` profile; a dialog that **Cancel** cannot dismiss. Never grant a permission, never change browser, profile, keychain or system settings, never change the page zoom, never switch the keyboard layout, never resize the window, and never press **Reset** or **Reset To Defaults**. Press only **Cancel** on unexpected dialogs. Post a blocker with its exact text to the requester in the epic topic. A cland page served by the edge that is not the shell is FAIL with the text shown.

## Manual checks

Record each with `sh .agents/skills/qa/qa-record.sh note E-417 "$RUN" <id> hub-api "<command>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence-file…>`, run from `$W` in QA's own shell; name where it ran at the start of the command text (`[p1]`, `[test $W]`, `[sealed $W]`, `[docs]`, `[QA shell]`). The recorder takes `hub-api` for every check here; the `via` column says which client the check speaks through. Save each check's printed output as `$EV/<id>.txt` (pipe the row's command through `tee`) and name it, with the captures the function wrote, as evidence.

How to run a row, by its `where`:
- **p1**: `( . "$Q/env.sh"; cd "$Q/p1" && <command> )`.
- **sealed $W**: `quiet && ( . "$Q/env.sh"; cd "$W" && <command> )`.
- **test $W**: in QA's own shell; `nt` runs `quiet` first and seals the test run itself. Judge each by its `exit` line, the TAP summary counts and the named tests on `ok` lines (`oks <id>` lists them; a name that appears on no `ok` line proves nothing).
- **docs** and **QA shell**: in QA's own shell, as QA; E417S1-00's and E417S1-17's plan reads are the only checks that touch the live hub, and only to read.

Order: E417S1-00, then the rows in id order (E417S1-01 before any Web file: every Web file and p1's edge read the bundle it builds), then E417S1-21. Values later rows reuse live in `$Q` (topic, item and message ids) and `$EV` captures. E417S1-11 starts the streaming client S1 detached through `bg.cjs`; E417S1-13 stops it (E417S1-18 again, harmlessly). Every Web log (`nt`) must show `exit 0`, `# fail 0`, `# cancelled 0`, `# skipped 0`, `# todo 0`, `# pass` equal to `# tests`, no `not ok` and no `# SKIP`, and `census` must print a first count of at least `1` and a second count of `0`. A `# tests` count is not fixed here: renames and additions happen; every test named below must appear in `oks`.

| id | surface | via | where | command | expected |
| --- | --- | --- | --- | --- | --- |
| E417S1-00 | hub-api | git, CLI (one live read), scratch CLI | QA shell; p1 init from Setup | `k00` | Build, merges and sealing. Both SHAs equal `$S`; `0` changed paths; the symlink reads `/Users/evgeniyivanov/Projects/cland/v0/node_modules`. The plan lists the stages `thread groundwork`, `message block, runs and asks`, `inbox and composer`, `events, notifications and approvals`; stage `thread groundwork` has `qa` `{scope: "affected", when: "after-stage"}`, `state` `open` (it closes only after this verdict and the covers), `items` T-1115, T-1118, T-1116, T-1117 plus any findings fixes the request names (nothing else), `total` equal to the number of printed items and `merged` equal to `total`. Under every `== <id>` line exactly one commit line (T-1115 `406844d8`, T-1116 `efb73153`, T-1117 `0c8c8c9a`, T-1118 `8bd5f778` at writing; a missing line is BLOCKED). All twelve files listed; the four greps print `1` each; the palette line prints the help counts the build asserts (at writing `area === 'Items' ? 33 : area === 'Topics' ? 18 : 14`): **those numbers are the expected help counts of E417S1-14 and E417S1-21**, whatever the line says at the build. `TMPDIR` is the system default (not `/tmp`) and `$Q` begins `/private/tmp/qa-e417s1-`. p1's init log ends without an error, the three config greps of the p1 block printed `1`, `1` and `1`. Also record the two counts the sealed-environment block printed before any scratch process started (the first at least `1`, the second `0`) and the `helpers checked` line with no `syntax error` line. Repeat the first two commands after the last check: unchanged (dev not moved) |
| E417S1-01 | hub-api | npm build | sealed $W | `k01` | `build exit 0`; the stamp is `{"version":1,"sources":"<64 hex>","builtAt":<ms>}` (step 0 of E417S1-21 compares its `sources`); `web/dist/index.html` and the `assets` directory listed; `0` changed paths (`web/dist` is ignored) |
| E417S1-02 | hub-api | named tests: pure key map (T1); production shell in Headless Shell against a sealed scratch hub (Web) | test $W | `nt E417S1-02a hub/test/web-keymap.test.ts; oks E417S1-02a; nt E417S1-02b web/test/key-contexts.test.ts; oks E417S1-02b; census E417S1-02b` | T-1115 C1–C4 at the test seams. Both `exit 0` with the counts above. On `ok` lines: "browser tab/window chords remain unbound and area shortcuts require exact modifiers", "focused contexts resolve before shell keys without changing Items or Plan chords" (C1); "declared composer fields own their keys while ordinary fields retain native input" (C2); "stand-in areas keep selection and drawers while unhandled session keys stay absent from help and palette" (C3, C4); "the palette lists and runs handled Items actions after restoring focus" |
| E417S1-03 | hub-api | named tests (Web regression of the shell, palette, folds, area slots, Items and Plan) | test $W | `nt E417S1-03a web/test/shell.test.ts; census E417S1-03a; nt E417S1-03b web/test/palette.test.ts; oks E417S1-03b; census E417S1-03b; nt E417S1-03c web/test/folds.test.ts; census E417S1-03c; nt E417S1-03d web/test/area-slots.test.ts; census E417S1-03d; nt E417S1-03e web/test/items.test.ts; census E417S1-03e; nt E417S1-03f web/test/plan.test.ts; census E417S1-03f` | T-1115 C1, C3, C4 (the existing shell, palette, fold, Items and Plan files pass with the key map split into contexts and the areas in one slot) and T-1118's palette change. Each file `exit 0` with the counts above. Palette: `oks` lists "the palette and area keys help" with its subtest "area help and every displayed shell chord work by physical code with Cyrillic key values" (it asserts the help counts E417S1-00 printed and, for Topics, the four labels `Next topic or group`, `Previous topic or group`, `Enter thread or unfold group`, `Fold topic group`) |
| E417S1-04 | hub-api | named tests (pure parser, T1); one parser probe | test $W; sealed $W | `nt E417S1-04 hub/test/web-markdown.test.ts; oks E417S1-04`, then sealed `k04` | T-1116 C1 and C2. `exit 0` with the counts above; on `ok` lines: "messages preserve heading levels and join paragraph lines", "lists retain text continuations, ordered starts, quotes and tables stay text", "fences retain their language and literal body and stop at each message end" (C1, the unclosed fence), "inline formatting and configured item ids become small renderer tokens", "HTML, images and unsafe or unsupported link destinations remain literal text" (C2), "tables without outer pipes keep their rows and unsupported syntax stays visible", "unsupported fence separators fall back to text and parsing advances". The probe prints `{"blocks":["paragraph"],"kinds":["text","item"],"links":0,"items":["T-1"],"joined":true}` (the `<img onerror>`, `<script>`, `javascript:` link and image stay literal text; only the item id is a token; nothing is lost) and `{"unclosedFence":[{"kind":"code","language":"js","text":"const a = 1;"}]}` |
| E417S1-05 | hub-api | the web HTML guard with planted sources | sealed $W | `k05` | T-1116 C3. `web HTML: raw-HTML sinks refused; seeded fixtures passed` and `clean exit 0`; with the two planted files `plant exit 1` and the capture names `QaPlant.ts:1: raw-HTML sink innerHTML is forbidden; render text or elements` and `QaPlant2.tsx:1: raw-HTML sink dangerouslySetInnerHTML is forbidden; render text or elements`; after moving them out, the clean line again and `after exit 0`; `0` changed paths. A dirty tree afterwards blocks every later row |
| E417S1-06 | hub-api | named tests (real hub through `projectHub`, frame clients, fake spoke and adapter, Store reopen, authenticated web edge) | test $W | `nt E417S1-06 hub/test/topics-component.test.ts hub/test/topic-withdraw.test.ts hub/src/hub/store.test.ts hub/test/web-authority.test.ts hub/test/handover.test.ts hub/test/asks.test.ts hub/test/inject-stalled.test.ts hub/test/topic-model.test.ts; oks E417S1-06` | T-1117 C1–C4 at the test seams, and the files T-1117 changed. `exit 0` with the counts above. On `ok` lines: "the human's kinds survive history and reach a second frame client" (C1); "only a human Question sets the wait, and later Messages do not change its addressee" (C2); "withdraw removes a busy session message and leaves the next turn intact", "withdraw before spoke acceptance fences late acks and preserves held progress", "withdraw after spoke acceptance fences late acks and preserves held progress", "a withdrawn Question preserves its cleared wait across Store reopen without replay" (C3); "withdraw refuses an injected message, an agent caller and an agent message", "withdraw cannot claim success after an unconfirmed adapter submission", "a broadcast withdrawal is atomic when one addressee was injected", "the authenticated web human can withdraw a queued message and receives its text" (C4 and the web edge) |
| E417S1-07 | hub-api | named tests (headless Neovim against recorded frames; recorded frames against an in-process real hub); git | test $W | `nt E417S1-07 nvim/test/thread.test.ts; oks E417S1-07; nt E417S1-07-drift --test-name-pattern='recorded protocol fixtures match the live hub attach frames' nvim/test/scenarios/workbench.test.ts; oks E417S1-07-drift; git -C "$W" show --stat --format=%H $(git -C "$W" log --first-parent --format=%H --grep 'Item: T-1117' dev) -- nvim` | T-1117 C5. First run: `exit 0` with `# fail 0`, `# cancelled 0`, `# skipped 0` (a skip means no pinned Neovim: BLOCKED, not PASS) and `# pass` equal to `# tests`; "a withdrawn human message uses the dropped glyph and colour and ignores older stages" on an `ok` line (a recorded `delivery` with stage `withdrawn` draws `✗ withdrawn`, `hl.STAGE.withdrawn` uses the glyph and highlight of `hl.STAGE.dropped`, and a later `delivered` frame leaves the stage `withdrawn`). Second run: `exit 0`; `# tests 1`, `# pass 1`; "recorded protocol fixtures match the live hub attach frames" `ok` (the refreshed recordings are what a real hub produces at this build). The `git show --stat` of T-1117's landing lists `nvim/lua/cland/hl.lua`, `nvim/test/fixtures/protocol-frames.json`, `nvim/test/fixtures/protocol-frames/thread.json`, `nvim/test/thread.test.ts` and `nvim/README.md` |
| E417S1-08 | hub-api | named tests (Topics in Headless Shell against sealed scratch hubs; pure area state, T1; the connection, Web) | test $W | `nt E417S1-08a web/test/topics.test.ts; oks E417S1-08a; census E417S1-08a; nt E417S1-08b hub/test/web-area-state.test.ts; nt E417S1-08c web/test/connection.test.ts; census E417S1-08c` | T-1118 C1–C4 at the test seams. Each `exit 0` with the counts above. On `ok` lines of E417S1-08a: "Topics groups separate waiting, standing, item and closed topics and remember folds" (C1); "300 messages open at the end and page backwards without gaps, repeats or a moving anchor", "a rejected earlier page retries with its old top message anchored", "a fresh snapshot replaces a pending initial history load and ignores its stale reply", "held history pages retain live messages, newer ask state and the scrolling anchor" (C2); "live messages and ask outcomes replace thread facts without another history or topic-list read", "reconnect resumes missed thread deltas and only rereads history after a fresh snapshot" (C3); "read marks wait one visible second and never include offscreen messages or a hidden page", "reading the top of a long thread marks only the last message on screen" (C4) |
| E417S1-09 | hub-api | typecheck and tier lint | sealed $W | `k09` | `typecheck exit 0` with no diagnostic in the log (hub, Neovim, shared wire and web typechecks, `tsconfig.markdown.json` included, the colour, token, HTML and hooks guards: `Thread.module.css` and `TopicsArea.module.css` hold no colour value); the four guard lines appear (`web HTML: raw-HTML sinks refused; seeded fixtures passed`, `web colours: token-only sources; colour fixtures passed`, `web tokens: <n> text tokens ≥4.5:1 on ground and selection; role colours match hl.lua`, `web hooks: conditional-hook fixture rejected by configured oxlint`); `tiers exit 0`; the seven classifications print |
| E417S1-10 | hub-api | git grep | QA shell | `k10` | AGENTS.md `web/` rules at the build. The key-listener grep lists only `web/src/keyboard.ts` (one `document.addEventListener('keydown', …)`, its handler and its removal): no component-local listener in `TopicsArea.tsx`, `Thread.tsx`, `AreaSlot.tsx` or `Shell.tsx` (T-1115 C4's one listener). Storage appears only in `web/src/interface-state.ts` under `cland.ui.<area>.v1` and in `web/src/connection.ts`'s `cland-reload-build` guard. The raw-HTML grep prints nothing. Under `== T-1116` only the two `typecheck` script lines of `web/package.json` (adding `tsconfig.markdown.json` and `node check-html.ts`); under the other three ids nothing: no dependency, devDependency or lockfile change |
| E417S1-11 | hub-api | CLI; frame clients (S1 streaming, seeding); a driver session holding the Coordinator role | p1 | `k11` | p1 serves and is seeded. `p1 hub start exit 0`, `hub status exit 0`, `web port set true`; a `started <pid>` line (S1 runs detached) and no `timeout` line. Task `[true, "<T-n>"]`; seven topic results `true`; close `true`. Driver: `ready: true`, `calls` `[["ask", true], ["send", true]` ×8`]`, `errors: 0`, `closed: true`. Long thread: `results: 300`, `ok: 300`, `unique: 300`. The list: `item` `["item", "open", 0, "<T-n>"]`, `closed` `["closed", "closed", 0, null]`, `waiting` `["waiting", "waiting for human", 1, null]` (the ask), `long` `["long", "open", 0, null]` (the human's own messages mark the topic read), `read` `["read", "open", 5, null]`, `hidden` `["hidden", "open", 3, null]`, `kinds` `["kinds", "open", 0, null]` |
| E417S1-12 | hub-api | frame client (the local human); S1 (a second client's deltas); `cland hub journal` | p1 | `k12` | T-1117 C1 and C2 live, and the decision (only a Question waits). `initial: "open"`; `sent` `[[true,"message"],[true,"decision"],[true,"message"],[true,"question"],[true,"message"]]` (the third had no kind: the default); `status` `["open","open","open","waiting for agent","waiting for agent"]` (a Message and a Decision leave the topic open; the Question makes it wait; a later Message keeps that wait); `waitingFor` `[null or [], ["coord"], ["coord"]]`; `history` the same five kinds in order; `invalid` `[false, <a validation error>]` and `invalidRecorded: false` (an unknown kind is refused and nothing is recorded). The `s1 alive at 12` line, then S1's deltas `[["message"],["decision"],["message"],["question"],["message"]]` (one `message` delta each, carrying its kind). `journal exit 0` and `status lines for the topic: 1`: the one line has `"from":"open"`, `"to":"waiting for agent"` and `"why":"a human question"` (`cland hub journal` reads that only the Question moved the topic). A `s1 NOT alive` line is a fixture finding (record it with the line), not a product failure; S1's judgement then comes from the replacement capture |
| E417S1-13 | hub-api | CLI; frame client; S1; the production Claude Code adapter with the fake `claude`, its turn held by `jobs/<id>.turn-hold` | p1 | `k13` | T-1117 C3 and C4 live. `launch exit 0`; no `timeout` line. The queued send: `[true, "queued" or "delivered", [{to: "qa-cc", outcome: "queued", reason: "qa-cc busy — queued"}]]` (human messages to a busy session wait). Withdraw: `before` `queued` or `delivered`; `injected` `[false, <error containing "cannot withdraw: delivery to qa-cc is injected">]` (the held turn's message is past submission); `withdraw` `[true, "QA put this back", "withdrawn"]` (the text comes back for the composer); `again` `[false, "cannot withdraw: delivery to qa-cc is withdrawn"]`; `agent` `[false, <error>]` (at writing `only the human may withdraw a message`); `after: "withdrawn"`; `firstStage: "injected"`. Late: `pong: true` (the held turn finished and answered); `injectedAfter` `[false, <error containing "is injected">]` (a message to the idle session went in; withdraw refused naming the stage); `otherSender` `[false, <error containing "own ordinary messages">]` (qa-cc's reply cannot be withdrawn by the human); `stages` `["injected", "withdrawn"]`. `fake log: put back 0, first turn submitted 1, after the turn submitted 1`: the withdrawn text never reached the session, also after the turn ended and the next turn ran. The `s1 alive at 13a`/`13b` lines, then S1: `w1` ends with `"withdrawn"` and contains no `"injected"`; `w2` ends with `"injected"` |
| E417S1-14 | hub-api | Chrome Headless Shell (two signed-in contexts at 1440×900, keys by physical code) against p1's edge; fresh frame clients | p1 | `k14` | T-1118 C1–C4, T-1115 C1 and C3, T-1116 C2 rendered, T-1117 C3 shown; judged from the printed lines only. First `{"long":300,"read":5,"hidden":3,"hostile":true}`, `walk exit 0`, no `step` line and no `unavailable` or `refused` line. `profileInScratch: true`; `visibility` `{A: "visible", B: "visible"}` (otherwise the read rows are INCONCLUSIVE). `groups`: four entries in order `waiting`, `standing`, `items`, `closed` with folds `Fold Waiting for you`, `Fold Project`, `Fold Item topics`, `Fold Closed`, `expanded` `"true"`, `"true"`, `"true"`, `"false"`; `waiting` rows exactly the Waiting discussion topic (`$Q/t-waiting`), `standing` rows exactly `["general","agents"]` with `standing` `["true","true"]`, `items` rows exactly the five topics `t-item`, `t-long`, `t-read`, `t-hidden`, `t-kinds` in any order, `closed` rows exactly `t-closed`; `itemRow` `{hasItem: true}`; `waitingUnread` `"1"`. `keys` `["general","KeyJ:agents","KeyK:general","Enter:log","Escape:general"]`. `help`: Topics, Items and every other area equal to the counts E417S1-00's palette line asserts (18, 33 and 14 at writing); `topicsHelp` has as many rows as the Topics count: the 14 shared rows of E417S1-21 and the four Topics rows `Next topic or group=…`, `Previous topic or group=…`, `Enter thread or unfold group=…`, `Fold topic group=…` (record the key texts: E417S1-21 compares them); `topicsHelpLastRowVisible: true`; `helpButtonFallback` `[]` (otherwise note it: the help was opened by its button, not the physical key). `paging`: `opened` `{atEnd: true, rows: 100}`; `anchors` `[{total: 200, rows: 200, anchorKept: true}, {total: 300, rows: 300, anchorKept: true}]`; `sameOrder: true`, `unique: 300`, `seqAscending: true` (no gap, no repeat, in send order); `history` equal to `expectedBefore`, `[null, <seq>, <seq>]` (three reads: the latest page, then two numeric `before` pages, each the seq of the then-first message); `itemLinks: 300`. `liveTail` `{sent: true, last: true, atEnd: true, rows: 301, history: 0, list: 0}`. `readMarks`: `before: 5`, `bBefore: "5"`, `upToIsLast: true`, `readFrames: 1`, `after: 0`, `bAfter: "0"` (B's row dropped to 0 without a reload); `afterVisibleMs` at least about `1000` is report-only (the timing proof is E417S1-08's fake-clock test). `hiddenPage` `{before: 3, readsHidden: 0, whileHidden: 3, readsVisible: [true], after: 0}`. `hostile`: `literal` `[true,true,true,true]`, `elements: 0`, `anchors` exactly `[["#item/<T-n>", "<T-n>"]]`, `javascriptLinks: 0`, `titleUnchanged: true`, `dialogs: 0`, `offOrigin: 0`. `stages` `{withdrawn: "withdrawn", injected: "injected"}`. `folds` `{folded: "false", afterReload: "false", otherClient: "true", restored: "true", recordA: <JSON with "group:items":false>, recordB: null}` (the fold is per browser and survives a reload). `offOrigin` `{A: 0, B: 0}`. `census` `{group: <pid>, before: <n>, after: 0}` |
| E417S1-15 | hub-api | docs | docs | `k15` | T-1115 C5, T-1117 C6, and the docs of T-1116 and T-1118. Every count is at least `1`: `web/README.md` describes the contexts, the area slot, declared-but-unhandled keys, Message Markdown (raw HTML and images stay text, only http/https links), Topics and threads (groups, 100-message pages, plain blocks in this slice, the visible-second read rule, offscreen messages stay unread); `hub/README.md` the parser pointer, the Question-only wait, the kinds and `topic.withdraw`; `nvim/README.md` `✗ withdrawn` drawn like `dropped`; `docs/agents/tests.md` the four items' seams. Read the sections around each hit and record any statement that contradicts E417S1-02 to E417S1-14 as a finding |
| E417S1-16 | hub-api | CLI | sealed $W | `cland qa lint qa/briefs/E-417-stage-1.md` | `qa/briefs/E-417-stage-1.md: qa lint passes at the build` and exit `0` (this brief, committed at the build) |
| E417S1-17 | hub-api | CLI (live read); the Coordinator's stage covers | QA shell | `(cd "$W" && node hub/bin/cland.ts task plan show E-417) \| tee "$EV/E417S1-17.txt"` and the cover results the request names | QA runs no full suite. The Coordinator owns the stage covers (`cland verify all --occasion stage`) at the tested SHA; they add T3 and the Web phase on both platforms. Expected: the plan lists stage `thread groundwork` with its members merged (record the member list and counts exactly as printed). Linux and macOS covers green at the tested SHA, each with its Web phase run (not "Web unavailable"). Record each cover's run id, artifact, executor, platform, tiers and phases completed, wall time and cost as cited evidence. A red cover is FAIL naming its failing tests; a cover not yet finished when every other check is done: wait for its result in the epic topic; none queued or running at the tested SHA by then: BLOCKED "no stage cover at the tested SHA", reported to the requester |
| E417S1-18 | hub-api | process census | p1 | `k18` | Cleanup, judged by the fixture-owned census only (never a machine-wide `pgrep`). `session stop exit 0`, `hub stop exit 0`; no `alive` line names a fixture process (a `cland` hub, `hub serve`, `fc.cjs`, `drv.mjs`, `walk.mjs`, `cland-spoke`, `fake-claude` or a Headless Shell command); the census line counts every pid this run recorded. An `alive` line whose command is unrelated is pid reuse: record it, it is not a failure. Then remove `$Q` and the worktree as Setup says. Any `s1 NOT alive` line recorded by earlier rows is listed in the verdict as a fixture finding |

Re-check helper, file and test names with grep at the tested build: renames happen. A test name pattern matching zero tests passes with exit 0 and "tests 0": read the counts and `oks`, never the exit code alone. The named Web and hub tests ask the live hub's verify slot for admission themselves (`suite.slot` check): an admission timeout is BLOCKED; retry after `quiet`.

Before requesting QA, run `cland qa lint <brief>` with this filled brief at the build under test. The brief is complete only when qa lint passes at the build.

## Probes that mislead

- Process cleanup probes use a fixture-owned pid/process-group census, registered at launch and checked through exit; a machine-wide `pgrep` counts other sessions too (A-9063 R2; E-413 stage 1/T-1093). Here: `$Q/pids` (p1's hub, S1, every frame client, the driver and its spoke, the fake Claude Code session, the walkthrough and its browser group), each Web fixture's `Web fixture census: browser group <pid>; before <n>; after 0; scratch hub stopped` line, and the walkthrough's `census … after: 0`.
- Edit existing keys in initialized configs, list standalone-test build prerequisites, enumerate regular files only for file probes, and identify events by seq/id. A second-client check allows only defaults the new client writes itself (A-8634 R12; E-412 stage 2, E-415 stage 3/DoD, E-1006). Here: p1's `lock_path` and `executor` are edited in place; context B's `cland.ui.topics.v1` is `null` because B never folded anything.
- Transcript assertions identify stable item/topic/frame ids, with intervals starting at the result frame of the state-changing request. Preserve unaltered captures when correcting a probe and label the correction separately from product failures (A-8634 R13; E-412/E-415/E-1006; A-9063 R2; E-413 stage 1/T-1093). Model frames (`message`, `delivery`, `topic`, `session.*`) interleave with the frames a check causes: find them by message id, topic id or result id, never by position.
- Exact tracker copies replace the initialized tracker directory after its writers stop; copy the committed directory whole, dotfiles included, and compare that same file set. Apply the full `fixtureEnvironment` result after overlays, including synthesized values; under rule 15, check zero credential-prefix names before launching scratch processes and report names/counts only (A-9063 R2; E-413 stage 1/T-1093). This run needs no tracker copy: p1 is a fresh `cland init` project and the Web tests seed their own.
- An accessibility-tree count does not prove visible reachability: a real-browser check scrolls the final row into view and checks its viewport containment (A-9063 R6; T-1095, T-1097). E417S1-21 needs the last help row fully visible in a screenshot; E417S1-14 checks the same containment in Headless Shell.
- A command runner can end a row's whole process group when the row returns, which silently kills a helper started with `&` (E-414 stage 1's first run lost its stream that way). S1 therefore starts through `bg.cjs` in a session of its own, and every row that judges its stream calls `live` first; closures and stages are also judged from fresh reads (`stageof`, `topic.history`, `topic.list`). The walkthrough is one foreground process per row and starts nothing that outlives it.
- The hidden-page probe in E417S1-14 overrides `document.visibilityState` and dispatches `visibilitychange`, exactly as the Web test does; Headless Shell has no real hidden tab. The fake-clock proof of the one-second threshold is E417S1-08's; the walkthrough's `afterVisibleMs` is wall time seen from Node and only report.
- Every frame client here is the local human on the Unix socket. The human's own messages mark their topic read, so the Long thread has no unread messages by design; unread counts come from the driver's agent messages (Read check, Hidden check) and the ask (Waiting discussion).
- This slice's thread renders each message as plain text with item links (`ItemText`), not through `parseMarkdown`: the hostile message proves that nothing in a message becomes markup in the page, and E417S1-04 proves the parser's tokens. Rendering tokens as elements is stage 2 (T-1119).
- A human message to a busy session waits as `queued` (or `delivered` if the spoke had accepted it before the turn began); both are withdrawable. `injected` means the adapter submitted the turn, which `turn held:` in the fake's log confirms for the first message.
- The fake's log interleaves tool results that quote message text: count submitted prompts with `submitted`, and the withdrawn text with a plain grep (it must appear nowhere).
- `cland hub journal` writes a `topic-status` line only when the status changes: a Message or Decision on an open topic writes none, which is the expected result, not a missing record.
- "No skip": the Web files need Chrome Headless Shell (local on macOS) and the Neovim files the pinned Neovim; a skipped or "Web unavailable" result is BLOCKED, never PASS. Linux runs of the same files are cited from E417S1-17, not run by QA.
- E417S1-05 plants two files in the worktree: moving them out and the `0` changed paths in the same row are part of the check; a dirty tree afterwards blocks every later row.
- The live edge serves the root's `web/dist`: E417S1-21 judges this stage only when step 0's `sources` digests are equal and the hub-code diff is empty. `Offline`, the empty groups and the `0` counts are expected without a cookie.
- Key events from computer use carry real physical codes in the human's current layout; never switch the layout. The Cyrillic path is proven by the palette test with key values like `ж`.
- A Browser Use policy page or a browser error page is not a cland page: record BLOCKED with its text, never PASS.
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file.
- A "ran" marker grep excludes the configuration echo line.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log: not applicable, nothing here runs on a droplet. Speed criteria use measured wall times, never projections: this stage has none.
- Slots due or queued before the build count even when their results arrive later.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

The message block of P12, Markdown rendered as elements, role colours, the human's band, verdicts, artifact chips and folded runs (stage `message block, runs and asks`, T-1119 onward); the composer and its Withdraw button, kinds chooser and drafts (stage `inbox and composer`): this stage proves the hub's kinds and withdraw and the thread's plain stage text only; the inbox, events and notifications; Neovim's live workbench against a scratch hub (Neovim's side is its recorded-client test and the fixture drift test); Neovim reading the web's read marks (the hub's unread count is shared by design, T-1054; the second client here is a frame client and a second browser context). Every real-browser check that needs the `cland QA` profile signed in to the live hub: out of scope for this run, not BLOCKED, since the human has granted no sign-in (groups with rows, threads, paging, live updates and read marks in real Chrome; E417S1-08 and E417S1-14 prove them in Headless Shell). Minting or spending a `cland web` link against the live hub; opening p1's edge in real Chrome (not on the browser allowlist); resizing the window or changing the zoom in the `cland QA` profile. The epic's Definition of done and its demo, a separate run (the pointer in "Stage" only names this stage's evidence). Work landed on dev after the stage's items, beyond the regression files named here. Running a full suite or a stage cover (E417S1-17 cites the Coordinator's); T4; duration budget lines (report-only). The live project's tracker, hub, crew, `ui.json` and HOME. Stage QA carries no criterion marks.

Nothing else in scope needs an authorization this brief does not give: a check that cannot run for lack of one is BLOCKED, not out of scope.

## Grants

- Computer use on the human's Mac for E417S1-21 only: the human's standing QA real-browser permission of 2026-10-21 at 06:38Z, relayed by the stand-in cland-impl answering ask a18af0f8 («…я разрешаю qa пользоваться моим компьютером, спрашивать не надо»), and the Codex browser allowlist for `http://127.0.0.1:56935` and `http://localhost:56935`, set by the Coordinator on the human's permission (General, 2026-10-21 09:49Z; `qa/briefs/T-1011.md`, amendment). It covers opening that one page in Chrome's existing `cland QA` profile anonymously, clicks and keys inside that tab, screenshots, and closing that tab. Never Reset; no system permission, no settings, profile, keychain or layout change; no window resize.
- No sign-in grant: the profile stays anonymous; nothing in this run signs it in.
- No other grant. The walkthrough's Chrome Headless Shell (scratch profile under `$Q/b`) opens only p1's scratch edge, under the crew browser rule (rule 18). Every other check uses the rule 15 sealed environment with credentials filtered; the Web and hub test files run their own sealed scratch hubs and projects; nothing reads or writes the human's real `~/.cland` or `~/.local/state`.

## Verdict

Fix nothing. Clear only when every manual check (E417S1-00 to E417S1-18) and the case E417S1-21 pass. Otherwise not clear, naming the failing, blocked or inconclusive ids and findings. On the epic record one QA verdict with `--stage "thread groundwork"`, the full tested dev SHA, the unique run id and the case table. Stage QA carries no epic criterion marks. Report `qa clear E-417 stage thread groundwork` or `qa not clear E-417 stage thread groundwork` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
