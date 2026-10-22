# Stage QA brief: E-413 stage 2 — marks and threads

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` or `$B:h` as a modifier).

## Stage

- Epic: E-413 (hub-computed fields and read marks, under R-377).
- Exact stage name: marks and threads.
- Items: T-1054 (lane one); T-1056 (lane two); T-1057, T-1059 (lane three, in that order). The run reads the stage's members from `task plan show E-413` (E413S2-00) and never from a number written here. Further findings fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: the combined changed behaviour of the stage's items at the tested build. T-1054: the human's events last look, each plan's last look (an opaque plan-history receipt keyed by canonical `T-<number>`) and the topics' read positions (`Topic.readSeq`) live in the hub per human, not per client; `marks.get` and `marks.set` are human-only frames; a mark only moves forward and the latest from any client wins; the `topics` snapshot carries `marks` and a changed mark arrives as a `marks` delta; marks persist in the hub's SQLite store across a restart; Neovim reads and sets its marks through the hub and imports `events.last_look` and `plan_seen` from `.cland/ui.json` once (`marks.set {import: true}`), then removes those keys. T-1056: consecutive agent-to-agent messages in one topic and one local day form a run; `topic.history` pages carry `runs: ThreadRun[]` with each member's `runId`, including the complete run when a page starts mid-run; a live `message` delta carries the message's `runId` and the run's full replacement with the same id each time it grows; the fold line (first three participants and `+N`, message count, latest kind and first words, age) is built by the hub from stored facts; an ask, a verdict, an answer, a request, or a message to or from the human or an Aide ends a run. T-1057: an answered ask's card carries `outcome` `{status: "answered", text, option?, by, at}` in the live `ask` event and on later history reads; the inbox's coalesced `inbox` event carries `departures` with `reason: "answered"` and the same outcome once, and the seven-day archive keeps it. T-1059: `topic.answer {ask, declined: true, reason}` answers with `declined: <reason>` delivered to the asker, refuses a missing or blank reason and an option or text beside it, leaves the topic open for the next ask, and carries `{status: "declined", reason, by, at}` through the thread, the departure (`reason: "declined"`) and the archive; a lead returning the unchanged answer with `ask.answer` keeps the upstream declined outcome on the original ask; Neovim folds a declined ask to one dimmed row with its reason; every shipped role clause says a declined ask is a decision and never consent, within the clause byte reserve.

## Build

Use a clean detached worktree at dev at the SHA in the request (the full 40-hex SHA), created below. HEAD must equal that SHA and refs/heads/dev before and after running. All listed items must have merged onto dev: for every member that `task plan show E-413` lists in stage `marks and threads`, `git log --first-parent --oneline --grep "Item: <id>" dev` prints exactly one commit (at writing T-1054 `c6396710`, T-1057 `55465447`, T-1059 `826445ad`). T-1056 had not landed when this brief was written: it lands after writing from its branch `t/T-1056-fold-lines-for-runs-of-agent-messages` with one more cherry-picked commit (a Web palette test fix). If its merge check prints nothing, or `hub/src/hub/thread-runs.ts` and `hub/test/thread-runs.test.ts` are missing at the build, the run is BLOCKED. Dev also carries work landed after these items that is outside this stage (for example E-416's Web fixes); it is not judged here. A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no commit of its own or run id on purpose: committing a brief changes the tested tree.

The worktree lives under the project's `.cland/worktrees/`. Setup gives it the root's `node_modules` as a symlink before any other step (the clean-tree check ignores that one entry); this run has no Web or Playwright step, and the symlink keeps every tool on the same packages. The pinned Neovim comes from the main worktree's `.cache/nvim/` (a linked worktree with no cache of its own uses it); never download it into the root. No GUI process and no browser starts in this run.

"A copy of the live tracker" in this brief is the tracker committed at the tested SHA: the whole `$W/.cland/tasks` directory, dotfiles included, copied exactly into the scratch project p1 with no `cland init` categories on top. Nothing reads or writes the live tracker files.

## Setup (once, before E413S2-00)

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree, runs `quiet` and the one live read (`task plan show E-413` in E413S2-00), and records every check with `qa-record.sh`. **Every other command runs sealed** (rule 15) inside a subshell that sources `$Q/env.sh`: the full `fixtureEnvironment` result (`test-support/fixture-environment.ts`) with a scratch HOME, XDG and Git config, which drops every `CLAND_*`, `GIT_*`, `XDG_*`, provider and account variable while keeping `PATH`, `SHELL`, `TERM` and `TMPDIR`. Leave `TMPDIR` at the system default (on macOS `/var/folders/...`): Neovim frame fixtures break under `/tmp` (T-1030). The scratch root itself lives under `/tmp/qa-e413s2-` (a short path for the scratch hubs' sockets). Never the live project's hub for anything but E413S2-00's plan read and `quiet`, never the human's HOME, `~/.cland` or `~/.local/state`. Record the setup as the first note (check id `E413S2-00`).

In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<the full dev SHA from the request>
RUN=qa-s2-$(date +%F)-1                        # unique run id for E-413; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e413s2-$RUN           # the clean detached build
EV=$R/.cland/qa/E-413/$RUN                     # captures (qa-record.sh keeps its evidence here too)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
Q=$(mktemp -d /tmp/qa-e413s2-XXXXXX)           # scratch root: HOME, XDG, Git config, projects p1 and p2, helpers
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data" "$Q/xdg/cache" "$Q/steps"
: > "$Q/pids"                                  # the fixture-owned process census: every scratch pid is appended here
holder() { (cd "$W" && node hub/bin/cland.ts verify queue --json) | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);console.log((v.holder?.session??v.holder?.kind??"none")+" waiters "+(v.waiters??[]).length)})'; }
quiet() { for i in $(seq 1 10); do h=$(holder) && case "$h" in "none "*) echo quiet; return 0;; esac; sleep 60; done; echo "BLOCKED: the verify slot is not free after 10 minutes: ${h:-queue read failed}"; return 1; }
# nt <id> <test files…>: named test files from $W, sealed, one file at a time, TAP output, after quiet; the log is $EV/<id>.log
nt() { id=$1; shift; quiet || return 1; ( . "$Q/env.sh"; cd "$W" && node --test --test-concurrency=1 --test-reporter=tap "$@" > "$EV/$id.log" 2>&1; echo "exit $?" >> "$EV/$id.log" ); tail -n 1 "$EV/$id.log"; grep -E '^# (tests|pass|fail|cancelled|skipped|todo) ' "$EV/$id.log"; grep -E '^ *not ok|# SKIP' "$EV/$id.log" | head -20; }
```

The sealed environment. Apply the full `fixtureEnvironment` result after the scratch overlays, including its synthesized HOME, Git and account paths; do not merely unset keys absent from it. Remove the broader credential prefixes last (including `GH_PAGER` and the fixture's synthetic `CLAND_EXECUTOR_STATE`). The generated shell first unsets dropped inherited names and then exports every retained value; never print or post those exports.

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
console.log(`FX='["snapshot","numbered-deltas","slim-frames"]'`);
JS
cat >> "$Q/env.sh" <<'ENV'
cland() { node "$QA_W/hub/bin/cland.ts" "$@"; }
# hp: the pid in this project's .cland/hub.json (the secret is never read out)
hp() { node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(".cland/hub.json","utf8")).pid)+"\n")'; }
# ready <capture>: wait up to 60 s for a backgrounded featured client's snapshot.end line
ready() { for i in $(seq 1 120); do grep -q '"type":"snapshot.end"' "$1" 2>/dev/null && return 0; sleep 0.5; done; echo "BLOCKED: no snapshot.end in $1"; return 1; }
# seen <file> <text>: wait up to 60 s for a literal text in a file
seen() { for i in $(seq 1 120); do grep -q -F -- "$2" "$1" 2>/dev/null && return 0; sleep 0.5; done; echo "timeout waiting for $2 in $1"; return 1; }
# qv <capture> <expression> [args…]: one value of q.cjs without JSON quotes (for ids)
qv() { node "$QA_Q/q.cjs" "$@" | tr -d '"'; }
ENV
: > "$Q/home/.gitconfig"
grep -c '^unset ' "$Q/env.sh"; ( . "$Q/env.sh"; prefix_count=$(env | cut -d= -f1 | grep -c -E '^(CLAND_|DIGITALOCEAN_|ANTHROPIC_|OPENAI_|GH_|GITHUB_)'); echo "$prefix_count"; test "$prefix_count" -eq 0 ) || exit 1   # confirm 0 before any scratch process starts
```

Two scratch projects: p1 holds an exact copy of the tracker at the tested SHA, for the marks checks; p2 is empty, for the thread-run, ask and decline checks. `cland init` may start a scratch hub: record its pid, stop it and observe exit before replacing the tracker. The init tracker directory moves out of `.cland` whole; the committed directory is copied whole, dotfiles included.

```sh
( . "$Q/env.sh"; for p in p1 p2; do mkdir -p "$Q/$p" && cd "$Q/$p" && git init -q -b dev && git commit -q --allow-empty -m init && cland init . || exit 1; [ -f .cland/hub.json ] && hp >> "$Q/pids"; cland hub stop; done )
mv "$Q/p1/.cland/tasks" "$Q/p1-init-tasks" && cp -R "$W/.cland/tasks" "$Q/p1/.cland/tasks" || exit 1
diff -qr "$W/.cland/tasks" "$Q/p1/.cland/tasks" && echo "copy exact"
git -C "$W" ls-files .cland/tasks | wc -l; ls -A "$Q/p1/.cland/tasks" | wc -l     # the two counts are equal
( . "$Q/env.sh"; cd "$Q/p1" && cland hub start && hp >> "$Q/pids" && cd "$Q/p2" && cland hub start && hp >> "$Q/pids" )
```

The helpers. `fc.cjs` is a frame client on a scratch hub's Unix socket; `q.cjs` reads its captures and the drivers' output; `drv.mjs` is a driver session (a real spoke started through the test harness) that calls the session tools a frame client cannot and prints the channel events it receives; `clause-bytes.mjs` measures the shipped clauses the way `hub/test/roles-clauses.test.ts` does.

```sh
cat > "$Q/fc.cjs" <<'JS'
'use strict';
// QA frame client (E-413 stage marks and threads). It prints what a scratch hub sends and asserts nothing.
// node "$Q/fc.cjs" ['<features JSON array>'] < frames.jsonl     (run in the scratch project directory)
// Connects to ./.cland/hub.json's Unix socket as the human UI (the secret is never printed) with those features
// and waits for snapshot.end when "snapshot" is among them. Then sends each stdin line in order and waits up to 20 s
// for its result; ids q1, q2, ... are added when missing. Pseudo-frames:
//   {"qa":"wait","ms":N}                          pause N ms
//   {"qa":"pages","id":"x","req":{…},"hold":N}    task.list pages x1, x2, … each with the previous page's next as
//                                                 cursor, until next is null (at most 50); with hold, pause N ms
//                                                 after the first page
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
  try { return await waitFor(f => (f.type === 'result' && f.id === sent.id) || f.type === 'qa-closed', 20000); }
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
      else if (step.qa === 'pages') {
        let cursor = null;
        for (let page = 1; page <= 50; page++) {
          const reply = await request({ ...step.req, type: 'task.list', id: `${step.id}${page}`, ...(cursor ? { cursor } : {}) });
          if (page === 1 && step.hold) await sleep(step.hold);
          cursor = reply && reply.ok ? reply.value.next : null;
          if (!cursor) break;
        }
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
// node "$Q/q.cjs" <capture> '<expression>' [args…]: evaluates the expression over a JSON-lines capture, prints JSON.
// In scope: F (every line of the capture), A (the extra args), fs, snap(domain) (that snapshot frame), items() (the
// items snapshot's rows), res(id) (the result frame with that id), tools() (a driver's [tool, ok, ask or error]
// rows), events() (a driver's [content, answer_to] channel events).
const fs = require('node:fs');
const [file, expr, ...A] = process.argv.slice(2);
const F = fs.readFileSync(file, 'utf8').split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
const snap = d => F.find(f => f.type === 'snapshot' && f.domain === d);
const items = () => snap('items').value.items;
const res = id => F.find(f => f.type === 'result' && f.id === id);
const tools = () => F.filter(f => 'tool' in f).map(f => [f.tool, f.result?.ok ?? null, f.result?.ask ?? f.result?.error ?? null]);
const events = () => F.filter(f => 'event' in f).map(f => [f.event.content, f.event.meta?.answer_to ?? null]);
console.log(JSON.stringify(eval(expr)));
JS
cat > "$Q/drv.mjs" <<'JS'
// node "$Q/drv.mjs" <scratch project> <name> <role> <stay ms> [stop file] < steps.jsonl   (run sealed, in that project)
// A driver session of a scratch hub: a real spoke started through the test harness, which first assigns the role on
// the project's socket as the human would. It appends its own pid and the spoke's to $QA_Q/pids, prints every
// channel event it receives as {"event":{content,meta}}, and runs each step in order, 300 ms apart:
//   {"tool":T,"args":{…}}               call a tool; a string arg "@file:<name>" is replaced by that file's
//                                       trimmed text ($QA_Q/<name>); prints {"tool","args","result","at"}
//   {"qa":"presence","names":[…]}       wait up to 60 s until those sessions are present
//   {"qa":"event","contains":"<text>"}  wait up to 60 s for a received channel event whose content contains it
//   {"qa":"file","path":"<name>"}       wait up to 60 s until $QA_Q/<name> exists
// It then stays connected up to <stay ms>, ending early once $QA_Q/<stop file> exists, and disconnects.
// A failed step prints {"step","error"} and the driver goes on. Errors go to stderr only.
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
const [cwd, name, role, stay = '0', stop] = process.argv.slice(2);
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
  try {
    if (step.qa === 'presence') { await session.waitForPresence(step.names, 60000); console.log(JSON.stringify({ qa: 'presence', names: step.names })); }
    else if (step.qa === 'event') { const e = await session.waitForEvent(x => x.params.content.includes(step.contains), 60000); flush(); console.log(JSON.stringify({ qa: 'event', contains: step.contains, answer_to: e.params.meta?.answer_to ?? null })); }
    else if (step.qa === 'file') { const until = Date.now() + 60000; while (!existsSync(`${QQ}/${step.path}`) && Date.now() < until) await sleep(100); console.log(JSON.stringify({ qa: 'file', path: step.path, found: existsSync(`${QQ}/${step.path}`) })); }
    else { const args = fill(step.args ?? {}); console.log(JSON.stringify({ tool: step.tool, args, result: await session.call(step.tool, args), at: new Date().toISOString() })); }
  } catch (error) { flush(); console.log(JSON.stringify({ step, error: String(error) })); }
  await sleep(300);
}
const until = Date.now() + Number(stay);
while (Date.now() < until && !(stop && existsSync(`${QQ}/${stop}`))) await sleep(200);
flush(); clearInterval(pump);
await session.close();
console.log(JSON.stringify({ closed: name }));
process.exit(0);
JS
cat > "$Q/clause-bytes.mjs" <<'JS'
// node "$Q/clause-bytes.mjs" (sealed, in $W): one line per shipped role clause, as hub/test/roles-clauses.test.ts
// measures it: <source> <role> <reply bytes> <growth ceiling> <declined sentence present>
import { readFileSync } from 'node:fs';
const W = process.env.QA_W;
const { parseRoles } = await import(`${W}/hub/src/roles/config.ts`);
const { DEFAULT_ROLES_TOML } = await import(`${W}/hub/src/roles/default-roles.ts`);
const { clauseText, roleClauseSections, staffingClause } = await import(`${W}/hub/src/roles/clause.ts`);
const { defaultCrew } = await import(`${W}/hub/src/crew.ts`);
const { MAX_TEXT_BYTES } = await import(`${W}/hub/src/hub/hygiene.ts`);
const reserve = MAX_TEXT_BYTES - 512, ceiling = Math.floor(reserve * 0.85);
for (const [source, roles] of [['defaults', parseRoles(DEFAULT_ROLES_TOML)], ['project', parseRoles(readFileSync(`${W}/.cland/roles.toml`, 'utf8'))]]) {
  for (const [role, definition] of roles) {
    const { base } = roleClauseSections(definition.clause);
    const rendered = clauseText(`queue-${role}`, role, { ...definition, skills: [], clause: `${base}\n\n${staffingClause(role, defaultCrew())}` });
    console.log(source, role, Buffer.byteLength(`pong: ${rendered}`, 'utf8'), ceiling, definition.clause.includes('a declined ask is a decision and never consent'));
  }
}
JS
node --check "$Q/fc.cjs" && node --check "$Q/q.cjs" && node --check "$Q/drv.mjs" && node --check "$Q/clause-bytes.mjs"
```

The driver steps. Paths in `file` steps and `@file:` arguments are relative to `$Q`.

```sh
cat > "$Q/steps/08-impl.jsonl" <<'STEPS'
{"qa":"presence","names":["implqa","revqa"]}
{"tool":"send","args":{"topic":"general","to":["revqa"],"text":"Step 1 checks complete"}}
{"qa":"event","contains":"Step 2 checks complete"}
{"tool":"send","args":{"topic":"general","to":["revqa"],"text":"Step 3 checks complete"}}
{"qa":"event","contains":"Step 4 checks complete"}
{"qa":"file","path":"go08"}
{"tool":"send","args":{"topic":"general","to":["revqa"],"text":"Step 5 checks complete"}}
{"qa":"event","contains":"review clear · run probe complete"}
{"tool":"send","args":{"topic":"general","to":["revqa"],"text":"After verdict one"}}
{"qa":"event","contains":"Human @implqa boundary"}
{"tool":"send","args":{"topic":"general","to":["revqa"],"text":"After human one"}}
STEPS
cat > "$Q/steps/08-rev.jsonl" <<'STEPS'
{"qa":"presence","names":["implqa","revqa"]}
{"qa":"event","contains":"Step 1 checks complete"}
{"tool":"send","args":{"topic":"general","to":["implqa"],"text":"Step 2 checks complete"}}
{"qa":"event","contains":"Step 3 checks complete"}
{"tool":"send","args":{"topic":"general","to":["implqa"],"text":"Step 4 checks complete"}}
{"qa":"event","contains":"Step 5 checks complete"}
{"tool":"send","args":{"topic":"general","to":["implqa"],"text":"review clear · run probe complete"}}
{"qa":"event","contains":"After human one"}
STEPS
cat > "$Q/steps/12-coord.jsonl" <<'STEPS'
{"tool":"ask","args":{"topic":"general","question":"QA which port?","options":["fixed","allocated"]}}
{"tool":"ask","args":{"topic":"general","question":"QA what next?","options":[],"free":true}}
{"qa":"event","contains":"allocated"}
{"qa":"event","contains":"Then ship."}
STEPS
cat > "$Q/steps/16-coord.jsonl" <<'STEPS'
{"qa":"file","path":"orig16"}
{"tool":"ask.forward","args":{"ask":"@file:orig16"}}
{"qa":"event","contains":"declined: QA is pending."}
{"tool":"ask.answer","args":{"ask":"@file:orig16","text":"declined: QA is pending."}}
STEPS
cat > "$Q/steps/16-impl.jsonl" <<'STEPS'
{"qa":"presence","names":["coordqa","implqa"]}
{"tool":"send","args":{"topic":"general","to":"coordinator","kind":"question","text":"QA may I ship?"}}
{"qa":"event","contains":"declined: QA is pending."}
{"tool":"send","args":{"topic":"general","to":"coordinator","kind":"question","text":"QA may I run QA?"}}
STEPS
```

Cleanup at the end is E413S2-21: it stops both scratch hubs and judges the fixture-owned process census in `$Q/pids` only (scratch hub pids, every `fc.cjs` and `drv.mjs` process and every driver's spoke). After the evidence is recorded, print `$Q` and remove it by its literal path with a non-force `rm -r` after checking it begins with `/tmp/qa-e413s2-`. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). The scratch hubs' secrets in `$Q/p1/.cland/hub.json` and `$Q/p2/.cland/hub.json` are never printed or posted.

## Cases

none. No headless-grid case in `qa/cases/` covers the hub's marks, thread runs or ask outcomes; every check below is a manual check against a scratch hub, a named test file or the docs. Neovim's side (the marks import, the declined fold) runs through its named headless tests, not through `qa-record.sh run`.

## Manual checks

Record each with `sh .agents/skills/qa/qa-record.sh note E-413 "$RUN" <id> hub-api "<command>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence-file…>`, run from `$W` in QA's own shell; name where it ran at the start of the command text (`[p1]`, `[p2]`, `[test $W]`, `[docs]`, `[QA shell]`). The recorder takes `hub-api` for every check here; the `via` column says which client the check speaks through.

How to run a row, by its `where`:
- **p1** or **p2**: run the command as one block inside `( . "$Q/env.sh"; cd "$Q/p1" && { <command>; } )` (or `p2`). `$Q`, `$W`, `$EV` and `$FX` come from the shells above.
- **test $W**: run it in QA's own shell; `nt` runs `quiet` first and seals the test run itself. Judge each by its `exit` line, the TAP summary counts and the named tests appearing on `ok` lines (a name pattern that matches nothing proves nothing).
- **docs**: in QA's own shell; it only reads files of `$W`.
- **QA shell**: in QA's own shell, as QA; E413S2-00's plan read is the only check that touches the live hub, and only to read.

Order: E413S2-00, then the rows in id order. E413S2-03 continues E413S2-02 on p1 and reuses its captures; E413S2-09 reads E413S2-08's captures, E413S2-13 reads E413S2-12's and E413S2-17 reads E413S2-16's. Values that later checks reuse live in `$EV` captures named after the check.

| id | surface | via | where | command | expected |
| --- | --- | --- | --- | --- | --- |
| E413S2-00 | hub-api | git, CLI (one live read), frame client | QA shell; p1 and p2 | `git -C "$W" rev-parse HEAD refs/heads/dev; git -C "$W" status --porcelain \| grep -v -x '?? node_modules' \| wc -l; (cd "$W" && node hub/bin/cland.ts task plan show E-413 --json) > "$EV/E413S2-00-plan.json"; node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=v.stages.find(x=>x.name==="marks and threads");console.log(JSON.stringify({stages: v.stages.map(x=>x.name), state: s.state, qa: s.qa, merged: s.merged, total: s.total, items: s.items}))' "$EV/E413S2-00-plan.json" \| tee "$EV/E413S2-00-stage.txt"; for i in $(node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(v.stages.find(x=>x.name==="marks and threads").items.join(" "))' "$EV/E413S2-00-plan.json"); do echo "== $i"; git -C "$W" log --first-parent --oneline --grep "Item: $i" dev; done; ls "$W/hub/src/hub/thread-runs.ts" "$W/hub/test/thread-runs.test.ts" "$W/hub/test/thread-runs-store.test.ts" "$W/hub/test/human-marks.test.ts" "$W/nvim/test/human-marks-component.test.ts" "$W/hub/test/ask-outcomes.test.ts" "$W/nvim/test/declined-ask-component.test.ts"; git -C "$W" ls-files .cland/tasks \| wc -l; ls -A "$Q/p1/.cland/tasks" \| wc -l; diff -qr "$W/.cland/tasks" "$Q/p1/.cland/tasks" \| wc -l; echo "TMPDIR=$TMPDIR Q=$Q"; wc -l < "$Q/pids"; ( . "$Q/env.sh"; cd "$Q/p1" && cland hub status && node "$Q/fc.cjs" "$FX" < /dev/null > "$EV/E413S2-00-p1.jsonl"; cd "$Q/p2" && cland hub status ); node "$Q/q.cjs" "$EV/E413S2-00-p1.jsonl" '({refused: F.filter(f=>f.type==="snapshot.refused").length, rows: items().length, notInCopy: items().filter(r=>!fs.readdirSync(A[0]).some(n=>n.startsWith(r.id+"-"))).map(r=>r.id)})' "$W/.cland/tasks"` | Build, merges, tracker copy and sealing. Both SHAs equal `$S`; `0` changed paths. The plan lists the stages `fields` then `marks and threads`; stage `marks and threads` has `qa` `{scope: "affected", when: "after-stage"}`, `state: "open"` (it closes only after this verdict and the covers), `items` T-1054, T-1056, T-1057, T-1059 plus any findings fixes the request names (nothing else), `total` equal to the number of printed `items` and `merged` equal to `total`. Under every `== <id>` line exactly one commit line (a missing T-1056 line is BLOCKED). The seven files exist. The two tracker counts are equal and the diff prints `0` lines: p1 holds the exact committed tracker, dotfiles included. `TMPDIR` is the system default (not `/tmp`) and `$Q` begins `/tmp/qa-e413s2-`; the census file holds at least `2` pids (the two scratch hubs). Both scratch hubs report running for their own scratch project. p1's snapshot: `refused: 0`, `rows` above `0`, `notInCopy: []` (no `cland init` category on top of the copy). Also record the two counts the sealed-environment block printed before any scratch process started: the first at least `1`, the second `0` |
| E413S2-01 | hub-api | named test (two real frame clients, an in-process project hub) | test $W | `nt E413S2-01 hub/test/human-marks.test.ts` | T-1054 C1 and C4 at the test seam. `exit 0`; `# tests 2`, `# pass 2`, `# fail 0`, `# skipped 0`; "C1: clients share monotonic events, plan receipts and topic read positions" and "C4: human marks survive reopening the hub with their topic positions and import receipt" are on `ok` lines |
| E413S2-02 | hub-api | frame clients, featured; one streaming, one fresh | p1 | `printf '{"type":"task.create","kind":"epic","title":"QA marked plan"}\n' \| node "$Q/fc.cjs" > "$EV/E413S2-02-epic.jsonl"; EP=$(qv "$EV/E413S2-02-epic.jsonl" 'res("q1").value.item.id'); printf '{"type":"task.create","title":"QA marked work","size":"S","parent":"%s"}\n' "$EP" \| node "$Q/fc.cjs" > "$EV/E413S2-02-task.jsonl"; TK=$(qv "$EV/E413S2-02-task.jsonl" 'res("q1").value.item.id'); echo "EP=$EP TK=$TK"; for n in First Second; do printf '{"type":"task.plan","op":"set","item":"%s","yaml":"stages:\\n  - name: %s\\n    qa: { scope: none, when: per-item }\\n    lanes:\\n      - - %s\\n"}\n{"type":"task.plan","op":"show","item":"%s"}\n' "$EP" "$n" "$TK" "$EP"; done \| node "$Q/fc.cjs" > "$EV/E413S2-02-plan.jsonl"; R1=$(qv "$EV/E413S2-02-plan.jsonl" 'res("q2").value.history.at(-1).id'); R2=$(qv "$EV/E413S2-02-plan.jsonl" 'res("q4").value.history.at(-1).id'); echo "R1=$R1 R2=$R2"; QA_STREAM=1 QA_HOLD_MS=60000 QA_STOP="$Q/stop02" node "$Q/fc.cjs" "$FX" < /dev/null > "$EV/E413S2-02-b.jsonl" & B=$!; ready "$EV/E413S2-02-b.jsonl"; printf '{"type":"marks.set","events":"2026-10-22T12:00:00.000Z","plans":{"%s":"%s"}}\n{"type":"marks.set","events":"2026-10-21T12:00:00.000Z","plans":{"%s":"%s"}}\n{"type":"marks.get"}\n{"type":"marks.set","plans":{"%s":"qa-unknown-receipt"}}\n{"type":"topic.send","topic":"general","text":"QA read one"}\n{"type":"topic.send","topic":"general","text":"QA read two"}\n' "$EP" "$R2" "$EP" "$R1" "$EP" \| node "$Q/fc.cjs" > "$EV/E413S2-02-a.jsonl"; M1=$(qv "$EV/E413S2-02-a.jsonl" 'res("q5").value.message.id'); M2=$(qv "$EV/E413S2-02-a.jsonl" 'res("q6").value.message.id'); printf '{"type":"topic.read","topic":"general","upTo":"%s"}\n' "$M2" \| node "$Q/fc.cjs" > "$EV/E413S2-02-read2.jsonl"; printf '{"type":"topic.read","topic":"general","upTo":"%s"}\n' "$M1" \| node "$Q/fc.cjs" > "$EV/E413S2-02-read1.jsonl"; sleep 2; touch "$Q/stop02"; wait $B; node "$Q/fc.cjs" "$FX" < /dev/null > "$EV/E413S2-02-c.jsonl"; node "$Q/q.cjs" "$EV/E413S2-02-a.jsonl" '({key: "T-"+A[0].split("-")[1], set: res("q1").value, older: res("q2").value, get: res("q3").value, unknown: [res("q4").ok, res("q4").error]})' "$EP"; node "$Q/q.cjs" "$EV/E413S2-02-b.jsonl" '({sent: F.filter(f=>f.type==="qa-send").length, marks: F.filter(f=>f.type==="marks").map(f=>f.marks)})'; node "$Q/q.cjs" "$EV/E413S2-02-c.jsonl" 'snap("topics").value.marks'; node "$Q/q.cjs" "$EV/E413S2-02-read2.jsonl" 'res("q1").value.topic.readSeq'; node "$Q/q.cjs" "$EV/E413S2-02-read1.jsonl" 'res("q1").value.topic.readSeq'` | T-1054 C1, live on a CLI-started hub over the copied tracker. `EP` is a new epic id, `TK` a new task id, `R1` and `R2` two different plan-history receipt ids. `set` is `{marks: {events: "2026-10-22T12:00:00.000Z", plans: {<key>: R2}, imported: false}}` with `<key>` the printed `key` (`T-` and EP's number: plan marks use canonical keys); `older` (an older look and an older receipt sent later by the same client) and `get` both equal `set` exactly: the mark did not move back. `unknown` is `[false, <error containing "unknown plan receipt qa-unknown-receipt">]`. The streaming second client sent nothing (`sent: 0`) and received exactly one `marks` frame, equal to `set.marks` (an unchanged write publishes nothing, and no frame carries the older values). The fresh client's `topics` snapshot `marks` equals `set.marks`. Topic read positions: the first `readSeq` (read up to `QA read two`) is a positive integer `P`, and the later read up to the older `QA read one` from another client still returns `P` (it cannot decrease) |
| E413S2-03 | hub-api | frame clients; CLI hub restart | p1 | `EP=$(qv "$EV/E413S2-02-epic.jsonl" 'res("q1").value.item.id'); R1=$(qv "$EV/E413S2-02-plan.jsonl" 'res("q2").value.history.at(-1).id'); printf '{"type":"marks.set","import":true,"events":"2026-10-20T00:00:00.000Z","plans":{"%s":"%s"}}\n{"type":"marks.set","import":true,"events":"2099-01-01T00:00:00.000Z"}\n' "$EP" "$R1" \| node "$Q/fc.cjs" > "$EV/E413S2-03-import.jsonl"; OLD=$(hp); cland hub stop; kill -0 "$OLD" 2>/dev/null && echo "old hub $OLD alive" \|\| echo "old hub $OLD exited"; cland hub start; NEW=$(hp); echo "$NEW" >> "$Q/pids"; echo "OLD=$OLD NEW=$NEW"; printf '{"type":"marks.get"}\n' \| node "$Q/fc.cjs" "$FX" > "$EV/E413S2-03-after.jsonl"; node "$Q/q.cjs" "$EV/E413S2-03-import.jsonl" '({import1: res("q1").value, import2: res("q2").value})'; node "$Q/q.cjs" "$EV/E413S2-03-after.jsonl" '({snapshot: snap("topics").value.marks, get: res("q1").value, generalReadSeq: snap("topics").value.topics.find(t=>t.id==="general").readSeq})'; node "$Q/q.cjs" "$EV/E413S2-02-read2.jsonl" 'res("q1").value.topic.readSeq'` | T-1054 C4 live (and the hub side of C3's import). `import1.marks` keeps the newer values (`events: "2026-10-22T12:00:00.000Z"`, `plans` with R2 under the same key as E413S2-02) and has `imported: true`: an import merges forward and never replaces newer marks. `import2` equals `import1` exactly: only the first import applies, even with a later time. The old hub exited (`old hub <pid> exited`) and `NEW` differs from `OLD`. After the restart the `topics` snapshot `marks` and `marks.get`'s `marks` both equal `import1.marks`, and `generalReadSeq` equals the `P` printed last (E413S2-02's read position): marks and read positions survive a hub restart |
| E413S2-04 | hub-api | named tests (headless Neovim against the stub hub's recorded frames) | test $W | `nt E413S2-04 nvim/test/human-marks-component.test.ts` | T-1054 C2 and C3. `exit 0`; `# tests 3`, `# pass 3`, `# fail 0`, `# skipped 0` (a skip means no pinned Neovim: BLOCKED, not PASS). On `ok` lines: "C2: visiting events publishes the shared last look; a peer reading a topic clears its Neovim row" (opening the events view sends `marks.set` with an events look that a peer's `marks.get` reads; a peer's `topic.read` clears the Neovim row's unread count), "C3: legacy marks import once before their ui.json keys are removed" (the import is acknowledged with the legacy values, `plan_seen` and `events.last_look` leave `ui.json` while other preferences stay, and a cold start with a stale copy sends no second import) and "marks.get replays a peer delta received before its held older response". That the stub's recorded marks frames match a real hub is E413S2-05's fixture test |
| E413S2-05 | hub-api | named tests (headless Neovim; hub snapshot framing; recorded frames against an in-process real hub) | test $W | `nt E413S2-05 nvim/test/events-quiet.test.ts nvim/test/panel-placement-component.test.ts nvim/test/plan-component.test.ts nvim/test/plan.test.ts hub/test/snapshot-framing.test.ts; nt E413S2-05-fixtures --test-name-pattern='recorded protocol fixtures match the live hub attach frames' nvim/test/scenarios/workbench.test.ts` | Regression for T-1054's move of Neovim off `ui.json` marks and the `topics` snapshot change. First run: `exit 0`, `# fail 0`, `# cancelled 0`, `# skipped 0`, `# pass` equal to `# tests`; on `ok` lines: "events keys, warning/dim presentation, independent mutes, last look and cold persistence", "version-2 panel homes round-trip while shared marks stay out of preferences", "equal-time plan history keeps later moves after the saved receipt", "a moved item keeps watch marks and its reason until the next plan visit, with a saved last-look receipt" and ":restart of a plan with unseen changes records its restored visit". Second run: `exit 0`; `# tests 1`, `# pass 1`, `# fail 0`, `# skipped 0`; "recorded protocol fixtures match the live hub attach frames" `ok`: every recorded Neovim protocol frame (the marks and declined-ask recordings included) is what a real hub produces at this build |
| E413S2-06 | hub-api | docs | docs | `for s in '## Human last looks and read marks' 'never gets its own copy.' 'An events timestamp only increases.' 'SQLite store and survive reopening it.' 'Neovim first reads the shared marks, then imports legacy' 'merges forward and records' 'import may preserve a receipt whose history has already been retained away,'; do printf 'hub %s: ' "$s"; grep -c -F -- "$s" "$W/hub/README.md"; done; for s in "the hub stores the human's events last look shared with every browser" 'remain readable in the same version for a one-time hub import.' 'only after the durable acknowledgement.' 'Marks survive a hub restart;'; do printf 'nvim %s: ' "$s"; grep -c -F -- "$s" "$W/nvim/README.md"; done` | T-1054 C5. Every count is at least `1`: `hub/README.md` describes the per-human marks, the frames, forward-only marks, persistence and the one-time import; `nvim/README.md` describes the shared last look, the import and the removal of the legacy keys. Read the sections around each hit and record any statement that contradicts E413S2-02 to -05 as a finding |
| E413S2-07 | hub-api | named tests (in-process project hub with Implementer, Reviewer, Coordinator and Aide peers; store) | test $W | `nt E413S2-07 hub/test/thread-runs.test.ts hub/test/thread-runs-store.test.ts` | T-1056 C1 to C4 at the test seam. `exit 0`, `# fail 0`, `# cancelled 0`, `# skipped 0`, `# pass` equal to `# tests` (8 at writing: 5 and 3). On `ok` lines: "four Implementer–Reviewer messages share one factual fold line" (C1), "a fifth message updates the same run by delta without another history read" (C2), "never-fold messages and day changes end a run" (C3: a verdict, a tracked ask, its answer, a human message, an unaddressed report to the human, a message to and from an Aide, and the local day change each end the run; a peer question does not), "history pages beginning mid-run carry its full identity and fold line" (C4), "queued verifier assignment refreshes participants in its same-id run delta", "run identity survives reopen with recipient role boundaries preserved", "an older store lazily restores full runs across multiple backfill pages" and "history byte pages include run metadata without gaps". Re-check the names with grep at the build: T-1056 landed after writing |
| E413S2-08 | hub-api | frame clients (one streaming, featured; one reading history); two driver sessions (Implementer, Reviewer) | p2 | `QA_STREAM=1 QA_HOLD_MS=240000 QA_STOP="$Q/stop08" node "$Q/fc.cjs" "$FX" < /dev/null > "$EV/E413S2-08.jsonl" & A=$!; ready "$EV/E413S2-08.jsonl"; node "$Q/drv.mjs" "$Q/p2" revqa reviewer 120000 stop08r < "$Q/steps/08-rev.jsonl" > "$EV/E413S2-08-rev.txt" 2> "$EV/E413S2-08-rev.err" & V=$!; node "$Q/drv.mjs" "$Q/p2" implqa implementer 120000 stop08i < "$Q/steps/08-impl.jsonl" > "$EV/E413S2-08-impl.txt" 2> "$EV/E413S2-08-impl.err" & I=$!; seen "$EV/E413S2-08-rev.txt" '"text":"Step 4 checks complete"'; sleep 3; printf '{"type":"topic.history","topic":"general"}\n{"type":"topic.history","topic":"general","limit":2}\n' \| node "$Q/fc.cjs" > "$EV/E413S2-08-hist.jsonl"; touch "$Q/go08"; seen "$EV/E413S2-08-impl.txt" '"text":"After verdict one"'; printf '{"type":"topic.send","topic":"general","text":"Human @implqa boundary"}\n' \| node "$Q/fc.cjs" > "$EV/E413S2-08-human.jsonl"; seen "$EV/E413S2-08-rev.txt" 'After human one'; sleep 2; touch "$Q/stop08r" "$Q/stop08i"; wait $V $I; sleep 1; touch "$Q/stop08"; wait $A; printf '{"type":"topic.history","topic":"general"}\n' \| node "$Q/fc.cjs" > "$EV/E413S2-08-final.jsonl"; grep -c '"error"' "$EV/E413S2-08-rev.txt" "$EV/E413S2-08-impl.txt"; grep -c '"ok":true' "$EV/E413S2-08-human.jsonl"; node "$Q/q.cjs" "$EV/E413S2-08-hist.jsonl" '(()=>{const full=res("q1").value, page=res("q2").value;const probe=full.messages.filter(m=>/^Step [1-4] checks complete$/.test(m.text));const run=full.runs.find(r=>r.id===probe[0].runId);const seqs=probe.map(m=>m.seq);const lo=Math.min(...seqs), hi=Math.max(...seqs);const strip=r=>JSON.stringify({...r, ageMs: 0, foldLine: r.foldLine.replace(/ · [0-9]+[smhd]$/,"")});return {probe: probe.map(m=>[m.text, m.from, m.runId===run.id]), intruders: full.messages.filter(m=>m.seq>lo&&m.seq<hi&&!probe.includes(m)).map(m=>[m.seq, m.from, m.text.slice(0,60)]), run, idIsFirst: run.id==="run:"+probe[0].id, firstSeqIsFirst: run.firstSeq===lo, latestAtIsStep4: run.latest.at===probe[3].ts, ageSuffix: run.foldLine.endsWith(" · "+Math.floor(run.ageMs/1000)+"s"), page: {texts: page.messages.map(m=>m.text), inRun: page.messages.every(m=>m.runId===run.id), afterFirst: page.messages.every(m=>m.seq>run.firstSeq), runs: page.runs.length, same: page.runs.length===1&&strip(page.runs[0])===strip(run)}};})()' \| tee "$EV/E413S2-08-hist.txt"; RUNID=$(qv "$EV/E413S2-08-hist.jsonl" 'res("q1").value.messages.find(m=>m.text==="Step 1 checks complete").runId'); node "$Q/q.cjs" "$EV/E413S2-08.jsonl" '(()=>{const m=F.filter(f=>f.type==="message"&&/^Step [1-5] checks complete$/.test(f.message.text));const fifth=m.filter(f=>f.message.text==="Step 5 checks complete");const r=fifth[0]?.run;return {sent: F.filter(f=>f.type==="qa-send").length, frames: m.map(f=>[f.message.text, f.message.runId===A[0], f.run?.id===A[0], f.run?.messageCount]), fifthFrames: fifth.length, run: r, latestAtIsMessage: r?.latest.at===fifth[0]?.message.ts, ageSuffix: Boolean(r)&&r.foldLine.endsWith(" · "+Math.floor(r.ageMs/1000)+"s")};})()' "$RUNID"` | T-1056 C1, C2 and C4, live. Both driver files print `0` error lines; the human send prints `1`. History after four messages: `probe` is the four step messages from `implqa`, `revqa`, `implqa`, `revqa`, each `true` (one run); `intruders: []` (if any message lies between them, such as a hub notice in General, the row is INCONCLUSIVE with that message named, not FAIL); the `run` has `participants: ["implqa","revqa"]`, `otherParticipants: 0`, `messageCount: 4`, `latest` `{kind: "report", preview: "Step 4 checks complete", at}`, `ageMs` from `2000` to below `60000`, and `foldLine` `implqa → revqa · 4 messages · report: Step 4 checks complete · <N>s`; `idIsFirst`, `firstSeqIsFirst`, `latestAtIsStep4` and `ageSuffix` are `true`: the hub built the line from the stored facts and its clock (C1). The `limit: 2` page (C4): `texts` `["Step 3 checks complete","Step 4 checks complete"]`, `inRun: true`, `afterFirst: true` (the page starts after the run's first message), `runs: 1`, `same: true` (the page carries the complete run, equal apart from its age). The streaming client (C2): `sent: 0` (it never read history); `frames` lists the five steps in order, each `[<text>, true, true, n]` with `n` = 1, 2, 3, 4, 5 (every delta carries the same run id and the grown count); `fifthFrames: 1`; the fifth `run` has the same `id`, `firstSeq` and `participants` as the history run, `messageCount: 5`, `latest.preview` `Step 5 checks complete`, `latestAtIsMessage: true`, `ageSuffix: true`, and `foldLine` `implqa → revqa · 5 messages · report: Step 5 checks complete · 0s` with `ageMs` below `1000` (a value of `1000` or more with a matching suffix is INCONCLUSIVE under load, not FAIL) |
| E413S2-09 | hub-api | frame clients (E413S2-08's captures) | p2 | `node "$Q/q.cjs" "$EV/E413S2-08.jsonl" '(()=>{const one=t=>F.filter(f=>f.type==="message"&&f.message.text===t).map(f=>({runId: f.message.runId ?? null, run: f.run ? [f.run.id, f.run.messageCount, f.run.participants] : null}));return {verdict: one("review clear · run probe complete"), afterVerdict: one("After verdict one"), human: one("Human @implqa boundary"), afterHuman: one("After human one")};})()'; node "$Q/q.cjs" "$EV/E413S2-08-final.jsonl" '(()=>{const h=res("q1").value;const by=t=>h.messages.filter(x=>x.text===t).map(x=>x.runId ?? null);return {steps: [1,2,3,4,5].map(i=>by("Step "+i+" checks complete")), verdict: by("review clear · run probe complete"), afterVerdict: by("After verdict one"), human: by("Human @implqa boundary"), afterHuman: by("After human one"), runs: h.runs.map(r=>[r.id, r.messageCount, r.foldLine])};})()'; grep -F 'never-fold messages and day changes end a run' "$EV/E413S2-07.log"` | T-1056 C3, live for a verdict and a human message. Stream: `verdict` and `human` are each one frame with `runId: null` and `run: null` (boundaries carry neither); `afterVerdict` is one frame whose `runId` X equals its run's id, differs from E413S2-08's run id, with `messageCount 1` and participants `["implqa","revqa"]` (the next agent message starts a new run); `afterHuman` likewise with a new id Y different from X and from E413S2-08's run id, `messageCount 1`. Final history: every `steps` entry is the one E413S2-08 run id; `verdict` and `human` are `[null]`; `afterVerdict` `[X]`, `afterHuman` `[Y]`; `runs` holds that run with `5` and a fold line starting `implqa → revqa · 5 messages · report: Step 5 checks complete · `, and X and Y with `1`. The ask, answer and Aide boundaries are proven by the named test, `ok` in E413S2-07's run; E413S2-17 adds that the live asks and answers of E413S2-16 carry no run id |
| E413S2-10 | hub-api | docs | docs | `for s in '## Thread runs and fold lines' 'even when its first message is outside the page or an Agents filter selects only' 'Counts and the latest step describe the whole retained run, not' 'A run consists of consecutive agent-to-agent messages in one topic and one' 'end it; the next eligible message starts a new run.' 'The hub builds this line entirely from stored facts and its clock; no model' 'replace by id without re-reading history.'; do printf '%s: ' "$s"; grep -c -F -- "$s" "$W/hub/README.md"; done` | T-1056 C5 (statements checked against its branch at writing). Every count is at least `1`: `hub/README.md` describes runs, their boundaries, the `ThreadRun` fields and fold line, the history pages and the live delta. Record any statement that contradicts E413S2-07 to -09 as a finding |
| E413S2-11 | hub-api | named tests (public socket frames with in-process spokes; store) | test $W | `nt E413S2-11 hub/test/ask-outcomes.test.ts hub/src/hub/store.test.ts hub/test/asks.test.ts` | T-1057 C1 to C3 at the test seam (the same run serves T-1059 in E413S2-15). `exit 0`, `# fail 0`, `# cancelled 0`, `# skipped 0`, `# pass` equal to `# tests`. On `ok` lines: "C1: an option outcome stays on the thread entry in live cards and later history", "C2: the inbox publishes an answered departure with the thread outcome and keeps it in the archive", "C3: a free answer retains its full text and answerer in the thread and departure before the first inbox tick", "ask outcomes and inbox departures preserve option and free-text decisions across Store reopen", and asks.test.ts's "answering with option 2 posts the option as a message with answer_to, delivers it to the asker, clears the wait and the inbox row; the card shows the answer" |
| E413S2-12 | hub-api | frame clients (one streaming, featured); driver session (Coordinator role) | p2 | `QA_STREAM=1 QA_HOLD_MS=120000 QA_STOP="$Q/stop12" node "$Q/fc.cjs" "$FX" < /dev/null > "$EV/E413S2-12.jsonl" & A=$!; ready "$EV/E413S2-12.jsonl"; node "$Q/drv.mjs" "$Q/p2" coordqa coordinator 90000 stop12c < "$Q/steps/12-coord.jsonl" > "$EV/E413S2-12-coord.txt" 2> "$EV/E413S2-12-coord.err" & C=$!; seen "$EV/E413S2-12-coord.txt" 'QA what next?'; A1=$(qv "$EV/E413S2-12-coord.txt" 'F.find(f=>f.tool==="ask"&&f.args.question==="QA which port?").result.ask'); A2=$(qv "$EV/E413S2-12-coord.txt" 'F.find(f=>f.tool==="ask"&&f.args.question==="QA what next?").result.ask'); echo "A1=$A1 A2=$A2"; printf '{"type":"topic.answer","ask":"%s","option":2}\n{"type":"topic.answer","ask":"%s","text":"  Wait for QA.\\nThen ship.  ","as":{"name":"qa-standin"}}\n' "$A1" "$A2" \| node "$Q/fc.cjs" > "$EV/E413S2-12-answer.jsonl"; seen "$EV/E413S2-12-coord.txt" '"contains":"Then ship."'; sleep 2; printf '{"type":"topic.history","topic":"general"}\n{"type":"inbox.list"}\n{"type":"inbox.list","archive":true}\n' \| node "$Q/fc.cjs" > "$EV/E413S2-12-read.jsonl"; touch "$Q/stop12c"; wait $C; touch "$Q/stop12"; wait $A; node "$Q/q.cjs" "$EV/E413S2-12-coord.txt" '({tools: tools(), events: events(), errors: F.filter(f=>"error" in f).length})'; node "$Q/q.cjs" "$EV/E413S2-12-answer.jsonl" '[res("q1").ok, res("q1").value.message.text, res("q1").value.message.id, res("q2").ok, res("q2").value.message.text, res("q2").value.message.id]'; node "$Q/q.cjs" "$EV/E413S2-12.jsonl" 'A.map(id=>({id, cards: F.filter(f=>f.type==="ask"&&f.ask===id&&f.card.state==="answered").map(f=>({outcome: f.card.outcome, answer: f.card.answer}))}))' "$A1" "$A2"; node "$Q/q.cjs" "$EV/E413S2-12-read.jsonl" 'A.map(id=>({id, outcome: res("q1").value.messages.find(m=>m.id===id).ask.outcome}))' "$A1" "$A2"` | T-1057 C1 and C3 in the thread, live. The driver: `tools` two `["ask", true, <id>]` rows (A1, A2), `errors: 0`, and `events` include `["allocated", A1]` and `["Wait for QA.\nThen ship.", A2]` (each asker receives its answer with `answer_to`). The answers: `[true, "allocated", <answer 1 id>, true, "Wait for QA.\nThen ship.", <answer 2 id>]` (the free text trimmed, every line kept). Stream: for A1 at least one answered card, and every one carries `outcome` `{status: "answered", text: "allocated", option: 2, by: "human", at: T1}` (T1 an ISO time) and `answer` = answer 1's id; for A2 every answered card carries `{status: "answered", text: "Wait for QA.\nThen ship.", by: "qa-standin", at: T2}` with no `option` (C3: the self-declared stand-in is the answerer) and `answer` = answer 2's id. The later history read: each ask's `outcome` equals its card's exactly (C1 "also on a later history read") |
| E413S2-13 | hub-api | frame clients (E413S2-12's captures) | p2 | `A1=$(qv "$EV/E413S2-12-coord.txt" 'F.find(f=>f.tool==="ask"&&f.args.question==="QA which port?").result.ask'); A2=$(qv "$EV/E413S2-12-coord.txt" 'F.find(f=>f.tool==="ask"&&f.args.question==="QA what next?").result.ask'); node "$Q/q.cjs" "$EV/E413S2-12.jsonl" 'A.map(id=>({id, frames: F.filter(f=>f.type==="inbox"&&(f.inbox.departures ?? []).some(d=>d.id===id)).length, rows: F.filter(f=>f.type==="inbox").flatMap(f=>(f.inbox.departures ?? []).filter(d=>d.id===id)).map(d=>[d.kind, d.reason, d.outcome])}))' "$A1" "$A2"; node "$Q/q.cjs" "$EV/E413S2-12-read.jsonl" '({waiting: res("q2").value.asks.filter(a=>A.includes(a.id)).length, listDepartures: "departures" in res("q2").value, archive: A.map(id=>res("q3").value.archive.filter(d=>d.id===id).map(d=>[d.kind, d.reason, d.outcome]))})' "$A1" "$A2"` | T-1057 C2 and C3 in the inbox, live. Each ask's departure arrives in exactly one `inbox` frame (`frames: 1`; later frames omit it) as one row `["ask", "answered", <outcome>]` whose outcome equals that ask's E413S2-12 card outcome exactly (option, text, answerer and time; the free text with its stand-in for A2). The explicit read: `waiting: 0`, `listDepartures: false` (an `inbox.list` reply carries current rows, not departures); `archive` holds one row per ask, `["ask", "answered", <the same outcome>]` |
| E413S2-14 | hub-api | docs | docs | `for s in '### Answered ask outcomes' 'The outcome is stored on' 'the ask, independently of the reply message, and survives hub restarts.' 'A human ask records its inbox wait atomically at creation,' 'the rows settled since the preceding publication,' 'retrieves the durable outcomes'; do printf '%s: ' "$s"; grep -c -F -- "$s" "$W/hub/README.md"; done` | T-1057 C4. Every count is at least `1`: `hub/README.md` describes the outcome fields, their durability, the inbox departure with `departures` and the archive. Record any statement that contradicts E413S2-11 to -13 as a finding |
| E413S2-15 | hub-api | named tests (E413S2-11's run) | test $W | `grep -F -e 'declining C1: an Implementer receives the declined answer through its lead and the topic takes its next ask' -e 'declining C2: missing or blank reasons are refused without settling the ask' -e 'declining C3: thread and inbox departure retain the reason, answerer and time' "$EV/E413S2-11.log"` | T-1059 C1 to C3 at the test seam. Three lines, each an `ok` line (none `not ok`): the forwarded decline reaches the Implementer through its lead and the topic takes the next ask; a missing or blank reason is refused and the ask stays open and listed; the thread, the departure and the archive keep `declined` with the reason, the answerer and the time |
| E413S2-16 | hub-api | frame clients (one streaming, featured); driver sessions (Coordinator, Implementer) | p2 | `QA_STREAM=1 QA_HOLD_MS=180000 QA_STOP="$Q/stop16" node "$Q/fc.cjs" "$FX" < /dev/null > "$EV/E413S2-16.jsonl" & A=$!; ready "$EV/E413S2-16.jsonl"; node "$Q/drv.mjs" "$Q/p2" coordqa coordinator 120000 stop16c < "$Q/steps/16-coord.jsonl" > "$EV/E413S2-16-coord.txt" 2> "$EV/E413S2-16-coord.err" & C=$!; node "$Q/drv.mjs" "$Q/p2" implqa implementer 120000 stop16i < "$Q/steps/16-impl.jsonl" > "$EV/E413S2-16-impl.txt" 2> "$EV/E413S2-16-impl.err" & I=$!; seen "$EV/E413S2-16-impl.txt" 'QA may I ship?'; printf '{"type":"topic.history","topic":"general"}\n' \| node "$Q/fc.cjs" > "$EV/E413S2-16-orig.jsonl"; O=$(qv "$EV/E413S2-16-orig.jsonl" 'res("q1").value.messages.filter(m=>m.text==="QA may I ship?").at(-1).id'); printf '%s\n' "$O" > "$Q/orig16"; seen "$EV/E413S2-16-coord.txt" '"tool":"ask.forward"'; FW=$(qv "$EV/E413S2-16-coord.txt" 'F.find(f=>f.tool==="ask.forward").result.ask'); echo "O=$O FW=$FW"; printf '{"type":"topic.answer","ask":"%s","declined":true}\n{"type":"topic.answer","ask":"%s","declined":true,"reason":"  \\n  "}\n{"type":"topic.answer","ask":"%s","declined":true,"reason":"QA is pending.","option":1}\n{"type":"inbox.list"}\n{"type":"topic.answer","ask":"%s","declined":true,"reason":"  QA is pending.  "}\n' "$FW" "$FW" "$FW" "$FW" \| node "$Q/fc.cjs" > "$EV/E413S2-16-answer.jsonl"; seen "$EV/E413S2-16-impl.txt" 'QA may I run QA?'; sleep 2; printf '{"type":"topic.history","topic":"general"}\n{"type":"topic.list"}\n{"type":"inbox.list","archive":true}\n' \| node "$Q/fc.cjs" > "$EV/E413S2-16-read.jsonl"; touch "$Q/stop16c" "$Q/stop16i"; wait $C $I; touch "$Q/stop16"; wait $A; node "$Q/q.cjs" "$EV/E413S2-16-coord.txt" '({tools: tools(), events: events(), errors: F.filter(f=>"error" in f).length})'; node "$Q/q.cjs" "$EV/E413S2-16-impl.txt" '({tools: tools(), events: events(), errors: F.filter(f=>"error" in f).length})'; node "$Q/q.cjs" "$EV/E413S2-16-answer.jsonl" '[1,2,3,4,5].map(i=>{const r=res("q"+i);return !r.ok ? [false, r.error] : i===4 ? ["listed", r.value.asks.some(a=>a.id===A[0])] : [true, r.value.message.text, r.value.message.answerTo];})' "$FW"; node "$Q/q.cjs" "$EV/E413S2-16-read.jsonl" '(()=>{const h=res("q1").value.messages;const o=id=>h.find(m=>m.id===id).ask.outcome;return {orig: o(A[0]), forwarded: o(A[1]), same: JSON.stringify(o(A[0]))===JSON.stringify(o(A[1])), next: h.filter(m=>m.text==="QA may I run QA?").map(m=>m.ask ? m.ask.state : null), general: res("q2").value.topics.find(t=>t.id==="general").status};})()' "$O" "$FW"` | T-1059 C1 and C2, live through a forward chain. `O` is the Implementer's agent ask, `FW` the Coordinator's forwarded human ask (`FW` differs from `O`). Coordinator driver: `tools` `["ask.forward", true, FW]` then `["ask.answer", true, …]`, `errors: 0`, and `events` include `["declined: QA is pending.", FW]` (the asker of the human ask receives `declined: <reason>`). Implementer driver: two `["send", true, …]` rows, `errors: 0`, and `events` include `["declined: QA is pending.", O]` (the original asker receives it through its lead). The answers (C2): `q1` (no reason) and `q2` (a blank reason) are `[false, <error containing "declining an ask needs a reason">]`; `q3` (a reason with an option) is `[false, <error containing "a declined answer takes a reason, not an option or text">]`; `q4` is `["listed", true]` (after the refusals FW still waits in the inbox); `q5` is `[true, "declined: QA is pending.", FW]` (the reason trimmed). The read: `orig` is `{status: "declined", reason: "QA is pending.", by: "human", at: <ISO>}`, `forwarded` the same and `same: true` (the lead's unchanged relay keeps the upstream declined outcome); `next` is `["open"]` (the topic took the Implementer's next ask) and `general` is not `closed` |
| E413S2-17 | hub-api | frame clients (E413S2-16's captures) | p2 | `O=$(qv "$EV/E413S2-16-orig.jsonl" 'res("q1").value.messages.filter(m=>m.text==="QA may I ship?").at(-1).id'); FW=$(qv "$EV/E413S2-16-coord.txt" 'F.find(f=>f.tool==="ask.forward").result.ask'); node "$Q/q.cjs" "$EV/E413S2-16.jsonl" '({cards: F.filter(f=>f.type==="ask"&&f.ask===A[0]&&f.card.state==="answered").map(f=>f.card.outcome), departures: F.filter(f=>f.type==="inbox").flatMap(f=>(f.inbox.departures ?? []).filter(d=>d.id===A[0])).map(d=>[d.kind, d.reason, d.outcome])})' "$FW"; node "$Q/q.cjs" "$EV/E413S2-16-read.jsonl" '({archive: res("q3").value.archive.filter(d=>d.id===A[0]).map(d=>[d.kind, d.reason, d.outcome]), unfolded: res("q1").value.messages.filter(m=>(m.ask ? true : Boolean(m.answerTo))&&m.text.startsWith("QA ")).map(m=>[m.text.slice(0,30), m.runId ?? null]), answers: res("q1").value.messages.filter(m=>Boolean(m.answerTo)).map(m=>[m.text, m.runId ?? null])})' "$FW"` | T-1059 C3, live. Let D be E413S2-16's `forwarded` outcome. `cards`: at least one, every one equal to D (the thread's live `ask` event carries `declined` with the reason, `by: "human"` and the time). `departures`: exactly one row, `["ask", "declined", D]` (the inbox departure says `declined` with the same outcome). `archive`: exactly one row, `["ask", "declined", D]`. Supporting T-1056 C3: every `unfolded` entry and every `answers` entry has run id `null` (asks and answers never join a run) |
| E413S2-18 | hub-api | named test (headless Neovim against the stub hub's recorded frames) | test $W | `nt E413S2-18 nvim/test/declined-ask-component.test.ts; grep -F 'recorded protocol fixtures match the live hub attach frames' "$EV/E413S2-05-fixtures.log"` | T-1059 C4. `exit 0`; `# tests 1`, `# pass 1`, `# fail 0`, `# skipped 0` (a skip means no pinned Neovim: BLOCKED, not PASS); "declining C4: a declined ask folds in place with its reason on history and live updates" `ok`: on a history read and on a live `ask` event the declined ask is one folded row reading `declined: QA pending. Wait for its report.` (a multiline reason on one line) that takes no answer key, and the delivered answer joins that block without a second row. The grep shows the fixture-drift test `ok` in E413S2-05's run, so the recorded frames this test consumes are a real hub's |
| E413S2-19 | hub-api | named test; clause measurement script; docs | test $W; docs | `nt E413S2-19 hub/test/roles-clauses.test.ts; ( . "$Q/env.sh"; cd "$W" && node "$Q/clause-bytes.mjs" ) \| tee "$EV/E413S2-19-bytes.txt"; grep -c -F 'a declined ask is a decision and never consent' "$W/.cland/roles.toml" "$W/hub/src/roles/default-roles.ts"; for s in 'A declined ask is a decision and never consent;' 'The trimmed reason must be non-empty;' 'Declining also works for options-only asks.' 'and the topic stays open for another ask.' 'for a declined outcome)'; do printf 'hub %s: ' "$s"; grep -c -F -- "$s" "$W/hub/README.md"; done; for s in 'fold in place to one dimmed row showing' 'Declining an ask from Neovim is not part of 0.2.0;'; do printf 'nvim %s: ' "$s"; grep -c -F -- "$s" "$W/nvim/README.md"; done` | T-1059 C5. The test run: `exit 0`, `# fail 0`, `# cancelled 0`, `# skipped 0`, `# pass` equal to `# tests` (27 at writing); for both sources `defaults` and `project` and each role `coordinator`, `lead`, `implementer`, `reviewer`, `qa` and `aide`, "<source> <role>: clause reply keeps the byte reserve" and "<source> <role>: shipped clause wording" (which asserts the sentence) are on `ok` lines. The script prints one line per source and role: every byte figure at most the ceiling `6528` (8192 bytes less the 512-byte reply headroom, less 15% growth headroom) and the last field `true`. At writing: defaults coordinator 6380, implementer 6514, reviewer 5563, qa 6441, aide 2868, lead 5567; project coordinator 6526, implementer 6071, reviewer 5436, qa 6080, aide 2894, lead 5337. The sentence count is `6` in each file (one per role clause). Every docs count is at least `1`: `hub/README.md` describes the decline frame, its refusals, the open topic and the declined outcome and departure, and states that a declined ask is a decision and never consent; `nvim/README.md` describes the folded declined ask and that Neovim does not decline in 0.2.0 |
| E413S2-20 | hub-api | static checks | test $W | `quiet && ( . "$Q/env.sh"; cd "$W" && node hub/test/lint-wire-imports.ts; echo "lint exit $?"; npm run typecheck > "$EV/E413S2-20.log" 2>&1; echo "typecheck exit $?" )` | Regression for the stage's shared wire changes (`shared/wire/index.ts` changed in T-1054, T-1057, T-1059 and T-1056; `hub/test/wire-conformance.ts` in T-1054, T-1057 and T-1056). `lint exit 0` and `typecheck exit 0` with no diagnostics in the log; the typecheck includes `hub/test/wire-conformance.ts` and the DOM-only wire typecheck |
| E413S2-21 | hub-api | CLI; process census | p1 and p2; QA shell | `( . "$Q/env.sh"; cd "$Q/p1" && cland hub stop; cd "$Q/p2" && cland hub stop ); sleep 2; sort -u "$Q/pids" \| while read -r p; do [ -n "$p" ] && kill -0 "$p" 2>/dev/null && echo "alive $p $(ps -o command= -p "$p")"; done; echo "census of $(sort -u "$Q/pids" \| grep -c .) fixture pids done"` | Cleanup, judged by the fixture-owned census only (never a machine-wide `pgrep`). Both hub stops succeed; no `alive` line names a fixture process (a `cland` hub, `hub serve`, `fc.cjs`, `drv.mjs` or `cland-spoke` command); the census line counts every pid this run recorded. An `alive` line whose command is unrelated is pid reuse: record it, it is not a failure. Then remove `$Q` and the worktree as Setup says |

Re-check helper, test and file names with grep at the tested build: renames happen, and T-1056 landed after writing.

## Probes that mislead

- Process probes exclude their own shell. Here cleanup judges only the pids this run recorded in `$Q/pids` (hubs, frame clients, drivers and their spokes); another session's fixtures on this shared machine are never evidence either way.
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file. Nothing here reads the live tracker or `ui.json`: the copy in p1 and the Neovim tests' own projects are the only trackers touched.
- Never treat the live project's `hub status` as evidence: the scratch hubs are the ones whose `.cland/hub.json` sits under `$Q/p1` and `$Q/p2`. `fc.cjs`, `drv.mjs` and `hp` read `.cland/hub.json` from the current directory; confirm `pwd` before each scratch row. After E413S2-03's restart, p1's hub has a new pid (recorded in the census).
- Model frames (`marks`, `message`, `ask`, `inbox`, `topic`, `session.row`) interleave with the frames a check causes and carry shared sequence numbers: identify rows by item id, ask id, message text, run id or result id, never by position or by "the last" frame. An action's effective interval ends at its own `result` frame, not at its `qa-send` line; an asynchronous effect (the inbox departure, published with the next coalesced `inbox` frame about 250 ms later) arrives after that result and is found by ask id.
- An unchanged `marks.set` publishes no `marks` frame: absence of a frame with the older values is the evidence that a mark did not move back, together with the unchanged reply.
- Run ages depend on the hub's wall clock: compare a run seen at two times without `ageMs` and the age suffix of `foldLine`, and derive the suffix from `ageMs`. A hub notice in General between probe messages (for example the Coordinator-vacancy notice ten minutes after p2's start without a Coordinator) splits a run by design: E413S2-08 names such intruders and is INCONCLUSIVE, not FAIL.
- An outcome's `at` is the hub's clock at the answer: compare it across the card, the history, the departure and the archive, not with the answer message's `ts`.
- Driver output is one JSON line per step or event; a `tool` line is printed after the call returns, and `event` lines interleave with it. Stderr goes to the `.err` file, never into a capture `q.cjs` reads.
- A frame that names `as: {name: "qa-standin"}` for a name no session ever had is the scratch human's self-declared stand-in: intended in E413S2-12.
- The driver sessions are unmanaged spokes; the Coordinator driver is the same name `coordqa` in E413S2-12 and -16 so the exclusive role passes between them. Each driver ends on its own stop file.
- `QA_STREAM=1` captures are complete only after `wait`; the `qa-end` line marks the end. Without `QA_STREAM` a client prints everything at the end.
- `nt` runs Node's TAP reporter so the `# tests`/`# pass` counters exist; the default spec reporter prints none.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log: not applicable, nothing here runs on a droplet. Speed criteria use measured wall times, never projections: this stage has none.
- Slots due or queued before the build count even when their results arrive later.
- "No skip": the hub test files here are platform-independent; the Neovim files (E413S2-04, -05, -18) need the pinned Neovim and are BLOCKED, not PASS, without it. The named tests check the live hub's cover slot themselves before running (`suite.slot` check): an admission timeout is BLOCKED; retry after `quiet`.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

Any real browser or GUI: this stage has no Web surface, so no `real-browser` case and no Web test runs. The Web clients' use of these fields (marks in `web-authority.ts`, runs, outcomes and declines in Web views) belongs to E-416 and later Web epics; the Web palette test fix carried with T-1056's landing (`web/test/palette.test.ts`) is E-416's. Declining an ask from Neovim (not part of 0.2.0) and any change to Neovim's own thread folds (T-1056 adds hub facts only). Neovim against a real scratch hub for marks and declines (named stub-hub tests plus the recorded-fixture drift test only). The review and criterion marks on the items (including T-1056 C1's earlier failed review mark), the merge gate and duration budgets. The Linux and macOS stage covers (the Coordinator's `cland verify all --occasion stage`; QA runs no full suite). The epic's Definition-of-done demo, which is a separate run. Stage `fields` and work landed after the stage's items. The live project's tracker, hub, `ui.json` and HOME.

## Grants

none.

## Verdict

Fix nothing. Clear only when every check E413S2-00 to E413S2-21 passes. Otherwise not clear, naming the failing, blocked or inconclusive ids and findings. On the epic record one QA verdict with `--stage "marks and threads"`, the full tested dev SHA, the unique run id and the case table. Stage QA carries no epic criterion marks. Report `qa clear E-413 stage marks and threads` or `qa not clear E-413 stage marks and threads` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
