# Stage QA brief: E-418 stage 2 — acting, the queue, accounts and artifacts

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` or `$B:h` as a modifier). The run is local, on macOS (BSD tools; Chrome Headless Shell from the installed `playwright-core`).

## Stage

- Epic: E-418 (Sessions, artifacts and accounts in the web, under R-377).
- Exact stage name: acting, the queue, accounts and artifacts.
- Items, in plan order: lane 1 T-1136, then T-1137, then T-1138; lane 2 T-1133; lane 3 T-1134, then T-1135; lane 4 T-1139, then T-1140. The run reads the stage's members from `task plan show E-418` (E418S2-00) and never from a number written here. Findings fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- **The run starts only once T-1138 is on dev.** At writing every other item had landed and T-1138 (the launch forms) was still in a merge cycle on `t/T-1138-launch-a-session-and-new-aide-from-the`; this brief's T-1138 expectations were read from that branch's head `b0afcf85` merged with dev `15d97e15` in a scratch tree. E418S2-00 checks the landing through `task plan show E-418` and the first-parent log; a missing T-1138 landing is BLOCKED, reported to the requester, with nothing else run.
- Scope: the combined changed behaviour of the eight items at the tested build.
  - T-1136, acting on a session: the selected row and the session's page carry Stop (`x`), Resume (`r`), Archive (`d`) and Capabilities (`c`) where they apply; Stop and Archive ask once in place (`Confirm Stop <name>` / `Confirm Archive <name>`: Enter or Confirm runs it, Esc or Cancel leaves it); Resume keeps the name, role and session id; a resume the harness cannot perform shows the hub's reason and offers **Launch fresh** with the same brief; Capabilities is the adapter's read-only table, or `No adapter for <name>`; the page (⌘Enter in the other pane) shows model, account, usage and capabilities with the same actions.
  - T-1137, below 640 px: 52 px two-line rows (glyph, name, coloured role, state and age at the right; then harness, item and any pending command), model, account and usage only on the page, no row actions, no unfolding; a tap or Enter opens the page in the current pane; Esc cancels a confirmation first, then returns to the list with focus on the same row. At 1440 px the rows stay P22's one line.
  - T-1138, the launch forms: the header's **Launch a session** and **New Aide**, `l` and `a`, and two palette actions open an inline form (Name, Role, Harness, Model, Account, Effort, Item, Brief) with the role's `roles.toml` launch defaults; a harness change clears the defaults meant for the other harness; no directory field and no `cwd` in the frame; hub refusals (a limited account with its reset) under the form, the draft kept; the new Aide under Yours.
  - T-1133, the verify line and the queue view: `verify: <holder> <time> · remote <used>/<budget> · <n> waiting · next <eta>`; Enter or a click toggles the queue view in place (local slot, remote slots with their droplets, waiters with executor, wait and ETA, last-20 metrics, today's droplet spend read once with `executor.status` per opening); times age on the client from the frame's receipt; a `verification.queue` frame replaces the view; the open state survives a reload.
  - T-1134, the account model, the Accounts area and the strip: one pure model (worst window, amber from 75 and red from 90 percent or the source's severity, the limited mark with reset, since, reason and session, a dash and never 0 percent without data); the Accounts area lists the registry (harness and path, every window with share and reset, the reading's age and source, the limited mark) and sends one `account.poll` per entry; the Sessions strip has a cell per account with its worst window, meter and reset, the limited account red with its reset and the session that hit it, the rest in the tooltip, and a link to Accounts.
  - T-1135, the profile: the **Profile** block above the registry shows **This browser** (Created, Last used, Cookie expires 30 days after creation) from the socket's own `web.session`; it is not an account (coordinator decision: no `data-account-id`, no account count, not in the strip), names no other browser and offers no revoke.
  - T-1139, the Artifacts tree: Mine (the human's and Aides' artifacts, folders first), Kept, By role (Coordinator, Implementers, Reviewers, QA, Other; folded) and Archived (folded; `A`), folds remembered in this browser; `k` toggles keep (↑ moves up), `d` archives (a layer for the human's and Aides' artifacts, files kept), Enter on a folder lists its files on request.
  - T-1140, opening pages and files: Enter opens a page in the drawer (⌘Enter in the other pane) in an iframe whose `sandbox` is exactly `allow-scripts`, loaded from a capability URL minted with `artifact.url`; a page script cannot read the workbench document or cookie; text files open as literal text with a named download link, binary files as a named download; folder children open the same way; a missing file says **Artifact file not found**. Coordinator decision (topic-878): HTML and SVG diagrams open in the sandboxed viewer, a raw Mermaid `.mmd` opens as text with a download link (rendered Mermaid is T-1158, out of scope).
- Affected regression: the Web files of the area slots, key contexts, palette and help, folds and shell (the stage changed `AreaSlot.tsx`, `Shell.tsx`, `Shell.module.css`, `Fold.tsx`, `keyboard.ts`, `keymap.ts`, `connection.ts`, `web/test/harness.ts`, `key-contexts.test.ts`, `palette.test.ts` and `area-slots.test.ts`); the T1 area-state and keymap files; the typecheck with colour, contrast and hooks guards; the tier classifications.

Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

Criteria map (the stage verdict carries no item marks; this tells the run which check proves what):

| criterion | proven by |
| --- | --- |
| T-1133 C1 (hand holder, one waiter, Enter opens the view with executor, wait and ETA) | E418S2-06, E418S2-16 |
| T-1133 C2 (queue model: remote slots with droplet, ordered waiters, last 20, spend; T1) | E418S2-02 |
| T-1133 C3 (ageing from receipt without a frame; a queue frame replaces the view) | E418S2-06, E418S2-16 |
| T-1133 C4 (open state survives a reload) | E418S2-06, E418S2-16 |
| T-1133 C5 (README verify line and queue view) | E418S2-12 |
| T-1134 C1 (worst window, 75/90 thresholds, limited mark, dash never 0 percent; T1) | E418S2-02, E418S2-14 |
| T-1134 C2 (Accounts area: registry order, harness, path, every window, age, source, limited mark) | E418S2-07, E418S2-15 |
| T-1134 C3 (one `account.poll` per entry) | E418S2-07, E418S2-15 |
| T-1134 C4 (strip cells, worst window, limited red with reset and session, tooltip, link) | E418S2-07, E418S2-14 |
| T-1134 C5 (README Accounts area and strip) | E418S2-12 |
| T-1135 C1 (profile sign-in, creation, expiry 30 days later, matching the hub's record) | E418S2-07, E418S2-15 |
| T-1135 C2 (a second browser context's sign-in absent from the first profile) | E418S2-07, E418S2-15 |
| T-1135 C3 (README profile block) | E418S2-12 |
| T-1136 C1 (`x` confirms in place, Esc keeps it running, Enter stops it; CLI readback) | E418S2-03, E418S2-17 |
| T-1136 C2 (`r` resumes with name and role; CLI readback) | E418S2-03, E418S2-17 |
| T-1136 C3 (`d` confirms and archives out of Stopped) | E418S2-03, E418S2-17 |
| T-1136 C4 (`c` read-only capability table; no adapter says so) | E418S2-03, E418S2-17 |
| T-1136 C5 (the page: model, account, usage, capabilities, same actions and confirmations) | E418S2-03, E418S2-18 |
| T-1136 C6 (unavailable resume: hub reason and Launch fresh with the same brief) | E418S2-03, E418S2-17 |
| T-1136 C7 (README actions, confirmations, page) | E418S2-12 |
| T-1137 C1 (600 px: two-line P27 rows, waiting command, no row actions) | E418S2-04, E418S2-19 |
| T-1137 C2 (600 px tap opens the page, Stop confirms, Esc returns to the same row) | E418S2-03, E418S2-19 |
| T-1137 C3 (1440 px: P22 rows) | E418S2-04, E418S2-19 |
| T-1137 C4 (README narrow rows and page entry) | E418S2-12 |
| T-1138 C1 (`a`: Aide defaults, Enter launches, under Yours, project root in `cland session list`) | E418S2-05, E418S2-20 |
| T-1138 C2 (role fills defaults from `roles.toml`; harness change clears model and effort) | E418S2-05, E418S2-20 |
| T-1138 C3 (limited account: hub refusal with reset under the form, nothing launched) | E418S2-05, E418S2-20 |
| T-1138 C4 (no directory field; no directory in the `session.launch` frame) | E418S2-05, E418S2-11, E418S2-20 |
| T-1138 C5 (README launch form and keys) | E418S2-12 |
| T-1139 C1 (sections Mine, Kept, By role, Archived; By role and Archived folded) | E418S2-08, E418S2-21 |
| T-1139 C2 (`k` keeps and unkeeps, as the hub's list reads) | E418S2-08, E418S2-21 |
| T-1139 C3 (`d` archives; Enter on a folder lists its files) | E418S2-08, E418S2-21 |
| T-1139 C4 (a fold survives a reload; ↑ moves while `k` keeps) | E418S2-08, E418S2-21 |
| T-1139 C5 (README Artifacts section and keys) | E418S2-12 |
| T-1140 C1 (page iframe `sandbox` exactly `allow-scripts`, capability URL) | E418S2-08, E418S2-11, E418S2-21 |
| T-1140 C2 (the page's script cannot read the workbench document or cookie) | E418S2-08, E418S2-21 |
| T-1140 C3 (text as text, binary as a named download, both from capability URLs) | E418S2-08, E418S2-21 |
| T-1140 C4 (README opening pages and files, the sandbox rule) | E418S2-12 |

Epic Definition-of-done mapping (no marks; the demo is a separate run): E-418 C2 (verify line and queue view) is exercised by E418S2-16; C3 (strip and Accounts area) by E418S2-14 and E418S2-15; C4 (Stop, Resume, Archive, Capabilities from the row and the page; Launch and New Aide in the project's directory) by E418S2-17, E418S2-18 and E418S2-20; C6 only its sign-in half by E418S2-15 (the switches are stage 3); C7 except `s` and This topic (stage 3) by E418S2-21; C8 partly by E418S2-12 and E418S2-22; the DoD's 600 px sentence by E418S2-19. C1 was stage 1; C5 is stage 3.

## Build

Use a clean detached worktree at dev at the SHA in the request (the full 40-hex SHA), created below. HEAD must equal that SHA and refs/heads/dev before and after running. All listed items must have merged onto dev: for every member that `task plan show E-418` lists in stage `acting, the queue, accounts and artifacts`, `git log --first-parent --oneline --grep "Item: <id>" dev` prints exactly one commit. At writing T-1139 landed as `adde2c7c`, T-1136 as `ac26b027`, T-1134 as `740d6f0f`, T-1137 as `ab8d5d6b`, T-1140 as `1850b943`, T-1133 as `a43ae84c` and T-1135 as `15d97e15`; T-1138 had not landed (see "Stage"). A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester. Dev also carries work landed after these items that is outside this stage (T-1114, T-1152, the Mermaid follow-up's tracker commit `24a7220c`); it is not judged here. The brief names no commit or run id of its own on purpose: committing a brief changes the tested tree. Re-check every test name, label, count and docs string with grep at the tested build.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step (the setup below does; the clean-tree checks ignore that one entry). Run E418S2-01's `npm run build --workspace web` before any Web file or the rig, or the shell never renders. The browser is the suite's Chrome Headless Shell under `node_modules/playwright-core/.local-browsers`: each named Web test file starts and closes its own, and the QA rig starts one through the Web test harness (`web/test/harness.ts`, `webFixture`). No real browser and no other GUI process starts. The live hub is touched only by `quiet`, the Web harness's own read-only admission check and E418S2-00's plan read; no live-edge, rebuilt root bundle or hub restart is needed.

## Setup (once, before E418S2-00)

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree, runs `quiet`, the plan read and the rig commands, reads the captures, and records every check with `qa-record.sh`. **Every other command runs sealed** (rule 15) inside a subshell that sources `$Q/env.sh`: the full result of the shared credential filter `test-support/fixture-environment.ts` after the scratch overlays (its synthesized HOME, XDG, Git and account paths included), which drops every `CLAND_*`, `GIT_*`, `XDG_*`, provider and account variable while keeping `PATH`, `SHELL`, `TERM` and `TMPDIR`. Leave `TMPDIR` at the system default (on macOS `/var/folders/...`; never `/tmp`, T-1030). The scratch root lives under `/private/tmp/qa-e418s2-` (its realpath). Never the human's HOME, `~/.cland`, `~/.claude`, `~/.codex` or `~/.local/state`. Fixtures are fake only: the in-process fake harnesses of `projectHub`, a fake account registry whose directories are created inside the scratch project, a fake account reader, and no real session launch, account directory or provider binary. Record the setup as part of E418S2-00.

The scratch project. The QA rig (`$Q/rig.test.mjs`, a `node --test` file) builds one sealed scratch project and hub through the Web harness (`webFixture`: `tempProject` under the system `TMPDIR`, `projectHub` with the in-process fake adapters and a fake hub clock started at the real time, the production socket and web edge serving `$W/web/dist`, a Headless Shell context at 1440×900 in timezone UTC signed in through a minted link). It seeds, in this order: a fake account registry `qa-main` and `qa-limited` (claude-code, `config_dir` in the scratch project), `qa-codex` (codex, `home` in the scratch project) and `qa-open` (opencode, `db` in the scratch project), and a fake account reader that answers every poll with `5h 12%` and `wk 19%`; a config with a scratch `lock_path` and raised hygiene limits (the T2 test's pattern); a `roles.toml` with `[aide.launch]` codex / `gpt-fake-1` / `qa-codex` / `high` and `[reviewer.launch]` claude-code / `fake-sonnet` / `qa-main` / `low`; one `account.poll`; sessions `qa-reading` (claude-code on `qa-main`) and `qa-limiter` (claude-code on `qa-limited`) with readings `5h 38%`/`wk 81%` and `5h 100%`/`wk 88%`, reset 2 h ahead on a whole minute (`resetsAt`), then `qa-limiter`'s `StopFailure` `rate_limit` (the limited mark); the sessions `qa-aide` (Aide, claude-code), `qa-wait` (implementer, claude-code, model `opus`, account `qa-main`), `qa-busy` (implementer, codex), `qa-idle` (reviewer, codex), `qa-page` (codex, model `gpt-fake-1`, account `qa-codex`, usage 125 tokens and `$0.25`), `qa-old` (codex, stopped), `qa-gone` (implementer, codex, brief artifact `QA brief`, stopped, its next resume scripted `gone`), and the unmanaged spoke `qa-spoke` (no adapter); `qa-wait` signalled `permission` with the waiting command below, `qa-busy` busy, `qa-idle` idle; a hand run holding the local verify slot and, 5 s later on the hub clock, a second hand run waiting (two `cli` connections the rig keeps open); artifacts `QA human note`, the folder `QA folder` (`index.md`), `QA aide note` (by `qa-aide`), `QA coordinator report` (by `qa-coord`, role coordinator), `QA archived note` (archived), the page `QA isolated page` (a script that tries the parent document and cookies), the file `QA text file` (`# QA text file` and a literal `<script>` line), the file `QA binary file` (five bytes), the diagram `QA Mermaid source` (`graph TD; QA-->Stage2`, a `.mmd`) and the diagram `QA SVG diagram` (an `.svg`). It then writes `$Q/rig/ready` and keeps the hub and one signed-in page up, running the page steps it finds as command files, until `$Q/rig/stop` exists (or 45 min).

The waiting command (exact text): `printf 'QA stage 2 waiting command, shown in full' && echo END-OF-QA-COMMAND`.

In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<the full dev SHA from the request>
RUN=qa-s2-$(date +%F)-1                        # unique run id for E-418; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e418s2-$RUN           # the clean detached build
EV=$R/.cland/qa/E-418/$RUN                     # captures (qa-record.sh keeps its evidence here too)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
Q=$(cd "$(mktemp -d /tmp/qa-e418s2-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/qa-e418s2-…
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data" "$Q/xdg/cache" "$Q/rig/cmd"
: > "$Q/pids"                                  # the fixture-owned process census
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
# rc <name> <op>: hand one op to the rig (with a screenshot $EV/<check id>.png named by the caller) and wait for its log line
rc() { printf '{"op":"%s","shot":"%s"}\n' "$2" "$3" > "$Q/rig/cmd/$1.tmp" && mv "$Q/rig/cmd/$1.tmp" "$Q/rig/cmd/$1.json" && { seen "$Q/rig/log.jsonl" "\"n\":\"$1.json\"" || { alive "$Q/rig.pid" && echo "rig alive" || echo "rig NOT alive: see $EV/rig.log"; return 1; }; }; }
# fact <name> <check id>: save the rig's log line for that op (ok, facts or error) as $EV/<check id>.json; print ok or the error
fact() { node -e 'const [f,n,o]=process.argv.slice(1);const l=require("fs").readFileSync(f,"utf8").split("\n").filter(Boolean).map(x=>JSON.parse(x)).find(x=>x.n===n);require("fs").writeFileSync(o,JSON.stringify(l,null,1)+"\n");console.log(l?.ok?"ok":"error: "+(l?.error??"no log line"))' "$Q/rig/log.jsonl" "$1.json" "$EV/$2.json"; }
# q <capture> '<expression>' [args…]: a judged summary of a capture (see q.cjs)
q() { node "$Q/q.cjs" "$@"; }
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
ENV
: > "$Q/home/.gitconfig"
grep -c '^unset ' "$Q/env.sh"; ( . "$Q/env.sh"; prefix_count=$(env | cut -d= -f1 | grep -c -E '^(CLAND_|DIGITALOCEAN_|ANTHROPIC_|OPENAI_|GH_|GITHUB_)'); echo "$prefix_count"; test "$prefix_count" -eq 0 ) || echo "BLOCKED: credential-prefix names remain in the sealed environment"   # 0 before any scratch process starts
```

The helpers. `bg.cjs` starts a long-lived helper detached (a runner that ends a row's process group when the row returns cannot end it; never start one with `&`); `q.cjs` reads captures; `rig.test.mjs` is the rig.

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
cat > "$Q/q.cjs" <<'JS'
'use strict';
// node "$Q/q.cjs" <capture> '<expression>' [args…]: evaluates the expression and prints the value as JSON. In scope:
// V (the capture parsed), F (V.facts), R (the rig's ready file next to this script), A (extra args), fs,
// canon(value) (JSON with sorted keys), has(text, ...parts) (a string holding every part).
const fs = require('node:fs');
const path = require('node:path');
const [file, expr, ...A] = process.argv.slice(2);
const V = JSON.parse(fs.readFileSync(file, 'utf8'));
const F = V?.facts ?? {};
const R = JSON.parse(fs.readFileSync(path.join(__dirname, 'rig/ready'), 'utf8'));
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(key => [key, x[key]])) : x);
const has = (text, ...parts) => typeof text === 'string' && parts.every(part => text.includes(part));
console.log(JSON.stringify(eval(expr)));
JS
```

The rig. It prints nothing it judges; every op's facts go to `$Q/rig/log.jsonl` as `{"n","op","ok","facts"|"error","at"}`. A command with `"shot":"<png path>"` also saves a full-page screenshot. It never focuses the launch form's Model field: that field's `models.list` asks the harness for its catalogue, which only `web/test/session-launch.test.ts` scripts at the WebSocket boundary (E418S2-05); the rig counts the frame and expects none.

```sh
cat > "$Q/rig.test.mjs" <<'JS'
// node --test "$QA_Q/rig.test.mjs" (sealed, cwd $QA_W): the QA rig of E-418 stage "acting, the queue, accounts and artifacts".
import test from 'node:test';
import { appendFileSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
const W = process.env.QA_W, Q = process.env.QA_Q, dir = `${Q}/rig`;
const { webFixture } = await import(`${W}/web/test/harness.ts`);
const { cland, connectUi, inProcessSpoke } = await import(`${W}/hub/test/harness.ts`);
const { askHubFrame } = await import(`${W}/hub/src/cli/socket-client.ts`);
const { defaultConfig, renderConfig } = await import(`${W}/hub/src/init/config.ts`);
const { FakeClock } = await import(`${W}/hub/test/fake-clock.ts`);
const COMMAND = "printf 'QA stage 2 waiting command, shown in full' && echo END-OF-QA-COMMAND";
const PAGE = `<!doctype html><title>QA page</title><body><pre id="result"></pre><script>
  const r = {};
  try { r.document = parent.document.title; } catch (e) { r.document = e.name; }
  try { r.cookie = parent.document.cookie; } catch (e) { r.cookie = e.name; }
  try { r.ownCookie = document.cookie; } catch (e) { r.ownCookie = e.name; }
  document.getElementById('result').textContent = JSON.stringify(r);
</script>`;
const TEXT = '# QA text file\n<script>never runs</script>';
const BYTES = Buffer.from([0, 255, 1, 2, 3]);
const MERMAID = 'graph TD; QA-->Stage2';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const log = row => appendFileSync(`${dir}/log.jsonl`, `${JSON.stringify({ ...row, at: new Date().toISOString() })}\n`);
const must = async (promise, what) => { const r = await promise; if (!r?.ok) throw new Error(`${what}: ${r?.error ?? 'no result'}`); return r.value; };
// The hub runs on a fake clock started at the real time (hand-run reservations would expire after 10 s of real time).
// The reset is 2 h ahead on a whole minute; its label as Neovim's accounts.lua writes it is computed here in UTC.
const clock = new FakeClock(new Date());
const resetsAt = new Date(Math.ceil((clock.now().getTime() + 2 * 3600_000) / 60_000) * 60_000).toISOString();
const two = n => String(n).padStart(2, '0');
const resetLabel = (() => { const r = new Date(resetsAt), now = new Date(); const hm = `${two(r.getUTCHours())}:${two(r.getUTCMinutes())}`;
  return r.toISOString().slice(0, 10) === now.toISOString().slice(0, 10) ? hm : `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][r.getUTCDay()]} ${hm}`; })();
test('QA rig, E-418 stage acting, the queue, accounts and artifacts', { timeout: 50 * 60_000 }, async t => {
  appendFileSync(`${Q}/pids`, `${process.pid}\n`);
  const fixture = await webFixture(t, { clock, timezoneId: 'UTC', accountReader: async () => [
    { id: '5h', label: '5h', usedPercent: 12, resetsAt }, { id: 'wk', label: 'wk', usedPercent: 19, resetsAt },
  ], prepare: async root => {
    for (const name of ['qa-main', 'qa-limited', 'qa-codex']) await mkdir(join(root, name));
    await writeFile(join(process.env.XDG_CONFIG_HOME, 'cland/accounts.toml'), [
      `[accounts.qa-main]\nharness = "claude-code"\nconfig_dir = ${JSON.stringify(join(root, 'qa-main'))}`,
      `[accounts.qa-limited]\nharness = "claude-code"\nconfig_dir = ${JSON.stringify(join(root, 'qa-limited'))}`,
      `[accounts.qa-codex]\nharness = "codex"\nhome = ${JSON.stringify(join(root, 'qa-codex'))}`,
      `[accounts.qa-open]\nharness = "opencode"\ndb = ${JSON.stringify(join(root, 'qa-open.db'))}`,
    ].join('\n') + '\n');
    const config = defaultConfig('QA E-418 stage 2');
    config.verification.lockPath = join(root, 'suite.lock');
    config.hygiene.loopBreaker.max = 200; config.hygiene.rateLimit.max = 200;
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
    await writeFile(join(root, '.cland/roles.toml'), '[aide.launch]\nharness = "codex"\nmodel = "gpt-fake-1"\naccount = "qa-codex"\neffort = "high"\n[reviewer.launch]\nharness = "claude-code"\nmodel = "fake-sonnet"\naccount = "qa-main"\neffort = "low"\n');
  } });
  const root = fixture.root;
  const ui = await connectUi(t, fixture.hub.discovery);
  const req = (frame, what = frame.type) => must(ui.request(frame), what);
  const cli = async (...args) => { const r = await cland(root, 'session', 'list', '--json', ...args); return r.code === 0 ? JSON.parse(r.stdout) : { error: r.stderr, code: r.code }; };
  const proc = (list, name) => { const p = list.processes?.find(x => x.name === name); return p ? { status: p.status, role: p.role ?? null, sessionId: p.sessionId, cwd: p.cwd, model: p.model ?? null, account: p.account ?? null, archivedAt: p.archivedAt ?? null } : null; };
  // Accounts: a poll reading for qa-codex, session readings for qa-main (38/81) and qa-limited (100/88), then qa-limited's limit.
  await req({ type: 'account.poll' });
  const launch = async (name, extra) => (await req({ type: 'session.launch', name, ...extra }, `launch ${name}`)).process;
  await launch('qa-reading', { harness: 'claude-code', account: 'qa-main' });
  await launch('qa-limiter', { harness: 'claude-code', account: 'qa-limited' });
  for (const [name, shares] of [['qa-reading', [38, 81]], ['qa-limiter', [100, 88]]]) await req({ type: 'session.signal', session: name, event: 'mod-measure', at: clock.now().getTime(), payload: { rateLimits: [
    { kind: 'five_hour', percentUsed: shares[0], resetsAt }, { kind: 'seven_day', percentUsed: shares[1], resetsAt }] } });
  await clock.advance(1000); // publishes the coalesced readings, as web/test/accounts.test.ts does
  await req({ type: 'session.signal', session: 'qa-limiter', event: 'turn-end', payload: { hook_event_name: 'StopFailure', error: 'rate_limit' } });
  // Sessions.
  await launch('qa-aide', { role: 'aide', harness: 'claude-code' });
  await launch('qa-wait', { role: 'implementer', harness: 'claude-code', model: 'opus', account: 'qa-main' });
  const busy = await launch('qa-busy', { role: 'implementer', harness: 'codex' });
  await launch('qa-idle', { role: 'reviewer', harness: 'codex' });
  await launch('qa-page', { harness: 'codex', model: 'gpt-fake-1', account: 'qa-codex' });
  await launch('qa-old', { harness: 'codex' }); await req({ type: 'session.stop', session: 'qa-old' });
  const brief = (await req({ type: 'artifact.create', kind: 'prompt', title: 'QA brief', topic: 'general', content: 'QA brief text for the fresh launch.' })).artifact.id;
  await launch('qa-gone', { role: 'implementer', harness: 'codex', brief }); await req({ type: 'session.stop', session: 'qa-gone' });
  fixture.fakes.codex.scriptResume('qa-gone', 'gone');
  const spoke = await inProcessSpoke(t, { discover: true, cwd: root, name: 'qa-spoke' });
  await spoke.waitForPresence(['qa-spoke']);
  fixture.fakes.codex.feedUsage('qa-page', { total: { inputTokens: 100, outputTokens: 25, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 125, cost: 0.25 } });
  await req({ type: 'session.signal', session: 'qa-wait', event: 'permission', payload: { tool_name: 'Bash', approvalCommand: COMMAND } });
  fixture.fakes.codex.busy('qa-busy'); fixture.fakes.codex.idle('qa-idle');
  // The verification queue: a hand run holds the local slot, a second one waits.
  const holder = await connectUi(t, fixture.hub.discovery, 'cli');
  let waiter = await connectUi(t, fixture.hub.discovery, 'cli');
  const slot = { type: 'suite.slot', mode: 'hub-only', cwd: root, head: 'qa-head', pid: process.pid };
  await must(holder.request({ ...slot, token: 'qa-holder' }), 'holder slot');
  for (let i = 0; i < 50; i++) { const q = await holder.request({ type: 'suite.queue' }); if (q.value?.holder?.kind === 'hand run') break; await sleep(100); }
  await clock.advance(5000);
  await must(waiter.request({ ...slot, token: 'qa-waiter' }), 'waiter slot');
  // Artifacts.
  const files = join(root, 'qa-files'), diagrams = join(root, 'qa-diagrams');
  await mkdir(files); await mkdir(diagrams);
  await writeFile(join(files, 'notes.txt'), TEXT); await writeFile(join(files, 'data.bin'), BYTES);
  await writeFile(join(diagrams, 'drawing.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><text y="20">QA SVG diagram</text></svg>');
  const art = async fields => (await req({ type: 'artifact.create', topic: 'general', ...fields }, `artifact ${fields.title}`)).artifact;
  const a = {};
  a.human = await art({ kind: 'note', title: 'QA human note', content: 'Human note' });
  a.folder = await art({ kind: 'note', title: 'QA folder', folder: true, entry: 'index.md', content: 'Folder bytes' });
  a.aide = await art({ kind: 'note', title: 'QA aide note', content: 'Aide note', as: { name: 'qa-aide' } });
  await req({ type: 'role.set', session: 'qa-coord', role: 'coordinator' });
  a.coord = await art({ kind: 'note', title: 'QA coordinator report', content: 'Report', as: { name: 'qa-coord' } });
  a.archived = await art({ kind: 'note', title: 'QA archived note', content: 'Archived' });
  await req({ type: 'artifact.archive', artifact: a.archived.id });
  a.page = await art({ kind: 'page', title: 'QA isolated page', content: PAGE });
  a.text = await art({ kind: 'file', title: 'QA text file', path: join(files, 'notes.txt') });
  a.binary = await art({ kind: 'file', title: 'QA binary file', path: join(files, 'data.bin') });
  a.mermaid = await art({ kind: 'diagram', title: 'QA Mermaid source', content: MERMAID });
  a.svg = await art({ kind: 'diagram', title: 'QA SVG diagram', path: join(diagrams, 'drawing.svg') });
  const ids = { ...Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v.id])), brief };
  const sent = [], received = [];
  await fixture.pageCase(t, async page => {
    const live = (want, ms) => page.waitForFunction(w => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === w, want, { timeout: ms });
    const area = async name => { await page.getByRole('button', { name, exact: true }).click(); await page.locator(`[data-pane="primary"] [data-area-module="${name}"][data-area-surface="pane"]`).waitFor({ timeout: 10000 }); };
    const region = name => page.getByRole('region', { name, exact: true });
    const token = name => page.evaluate(v => { const p = document.createElement('span'); p.style.color = `var(${v})`; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; }, name);
    const text = locator => locator.evaluate(n => n.textContent);
    const sentSince = (n, type) => sent.slice(n).filter(f => f.type === type);
    const ops = {
      async strip() {
        await area('Sessions'); await live('Live', 10000);
        const strip = page.locator('[data-session-slot="accounts"]');
        await strip.locator('[data-account-cell="claude-code/qa-limited"]').waitFor({ timeout: 10000 });
        const cells = await strip.locator('[data-account-cell]').evaluateAll(ns => ns.map(n => ({ id: n.getAttribute('data-account-cell'), tone: n.getAttribute('data-tone'), text: n.textContent, title: n.getAttribute('title'),
          meter: n.querySelector('[role="meter"]')?.getAttribute('aria-valuenow') ?? null, shareColor: getComputedStyle(n.querySelector('[data-account-share]')).color, color: getComputedStyle(n).color })));
        const tokens = { warning: await token('--needs-human'), critical: await token('--failed'), text: await token('--text') };
        const polls = sentSince(0, 'account.poll').length;
        await strip.getByRole('link', { name: 'Accounts', exact: true }).click();
        await page.locator('[data-pane="primary"] [data-area-module="Accounts"][data-area-surface="pane"]').waitFor({ timeout: 5000 });
        const hubOrder = (await req({ type: 'account.list' })).accounts.map(x => `${x.harness}/${x.name}`);
        return { resetsAt, resetLabel, hubOrder, cells, tokens, pollsBeforeAccounts: polls, linkOpensAccounts: true };
      },
      async accounts() {
        await area('Sessions');
        const s0 = sent.length;
        await area('Accounts');
        await page.locator('[data-account-id="claude-code/qa-main"]').waitFor({ timeout: 10000 });
        await sleep(1000);
        const polls = sentSince(s0, 'account.poll').length;
        const blocks = await page.locator('[data-account-id]').evaluateAll(ns => ns.map(n => ({ id: n.getAttribute('data-account-id'), text: n.textContent })));
        const profile = region('Profile');
        await profile.locator('time').nth(2).waitFor({ timeout: 5000 });
        const times = () => profile.locator('time').evaluateAll(ns => ns.map(n => n.getAttribute('datetime')));
        const first = { times: await times(), text: await text(profile), accountIds: await profile.locator('[data-account-id]').count(), revoke: await profile.getByRole('button', { name: /revoke/i }).count() };
        const before = (await askHubFrame(fixture.hub.discovery, { type: 'web.sessions' }, 3000, {})).sessions.map(s => ({ createdAt: s.createdAt, lastUsedAt: s.lastUsedAt }));
        await clock.advance(2000); // the second sign-in 2 s later on the hub clock, which otherwise stands still
        const second = await fixture.browser.newContext({ timezoneId: 'UTC', serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
        second.setDefaultTimeout(5000);
        let other;
        try {
          const { url } = await askHubFrame(fixture.hub.discovery, { type: 'web.link' }, 3000, {});
          const p2 = await second.newPage();
          await p2.goto(url);
          await p2.getByRole('button', { name: 'Accounts', exact: true }).click();
          const pr2 = p2.getByRole('region', { name: 'Profile', exact: true });
          await pr2.locator('time').nth(2).waitFor();
          other = { times: await pr2.locator('time').evaluateAll(ns => ns.map(n => n.getAttribute('datetime'))) };
        } finally { await second.close(); }
        const after = (await askHubFrame(fixture.hub.discovery, { type: 'web.sessions' }, 3000, {})).sessions.map(s => ({ createdAt: s.createdAt, lastUsedAt: s.lastUsedAt }));
        await area('Sessions'); await area('Accounts');
        await profile.locator('time').nth(2).waitFor({ timeout: 5000 });
        await sleep(500);
        const reentered = { times: await times(), text: await text(profile) };
        return { polls, order: blocks.map(b => b.id), blocks, root, first, hubBefore: before, other, hubAfter: after, reentered, browserFrames: { webSessions: sentSince(0, 'web.sessions').length, webRevoke: sentSince(0, 'web.revoke').length, webSession: sentSince(0, 'web.session').length } };
      },
      async queue() {
        await area('Sessions');
        const line = page.locator('[data-session-slot="verification"] [data-fold-toggle]');
        await line.waitFor({ timeout: 5000 });
        if (await line.getAttribute('aria-expanded') === 'true') await line.click();
        await page.waitForFunction(() => document.querySelector('[data-session-slot="verification"] [data-fold-toggle]')?.textContent?.includes('1 waiting'), null, { timeout: 10000 });
        const closedSummary = await text(line);
        const s0 = sent.length, r0 = received.length;
        const table = page.getByRole('table', { name: 'Verification queue', exact: true });
        await line.focus(); await line.press('Enter');
        await table.waitFor({ timeout: 5000 });
        await page.waitForFunction(() => document.querySelectorAll('[data-verification-row]').length === 2, null, { timeout: 5000 });
        const rows = () => page.locator('[data-verification-row]').evaluateAll(ns => ns.map(n => [...n.children].map(c => c.textContent)));
        await page.waitForFunction(() => !!document.querySelector('[data-verification-spend]')?.textContent?.startsWith('droplets today $'), null, { timeout: 5000 }).catch(() => {});
        const opened = { expanded: await line.getAttribute('aria-expanded'), summary: await text(line), rows: await rows(), spend: await text(page.locator('[data-verification-spend]')), metrics: await text(page.locator('[data-verification-spend]').locator('xpath=..')) };
        const executorReads = sentSince(s0, 'executor.status').length;
        await sleep(4000);
        const aged = { summary: await text(line), rows: await rows(), queueFrames: received.slice(r0).filter(f => f.type === 'verification.queue').length };
        waiter.close();
        await page.waitForFunction(() => document.querySelectorAll('[data-verification-row]').length === 1, null, { timeout: 10000 });
        const replaced = { summary: await text(line), rows: await rows(), queueFrames: received.slice(r0).filter(f => f.type === 'verification.queue').length, hubRunMs: (await holder.request({ type: 'suite.queue' })).value?.holder?.runMs ?? null };
        await page.reload({ waitUntil: 'load' }); await live('Live', 15000); await area('Sessions');
        await table.waitFor({ timeout: 10000 });
        const reloadOpen = await line.getAttribute('aria-expanded');
        await line.focus(); await line.press('Enter');
        await table.waitFor({ state: 'detached', timeout: 5000 });
        await page.reload({ waitUntil: 'load' }); await live('Live', 15000); await area('Sessions');
        await line.waitFor({ timeout: 5000 }); await sleep(500);
        return { closedSummary, opened, executorReads, aged, replaced, reloadOpen, reloadClosed: await line.getAttribute('aria-expanded'), tableAfterClosedReload: await table.count() };
      },
      async act() {
        await area('Sessions');
        const out = {};
        const row = page.locator('[data-object-id="qa-busy"]');
        await row.click(); await row.press('x');
        const stop = page.getByRole('group', { name: 'Confirm Stop qa-busy', exact: true });
        await stop.waitFor({ timeout: 5000 });
        out.confirmText = await text(stop);
        out.stopButtonWhileConfirming = await page.locator('[data-session-actions="qa-busy"]').getByRole('button', { name: 'Stop', exact: true }).count();
        await page.keyboard.press('Escape');
        out.afterEscape = { confirm: await stop.count(), cli: proc(await cli(), 'qa-busy') };
        await row.press('x'); await stop.waitFor({ timeout: 5000 });
        const stopped = region('Stopped').locator('[data-object-id="qa-busy"]').waitFor({ timeout: 10000 });
        await page.keyboard.press('Enter'); await stopped;
        out.afterEnter = { inStopped: await region('Stopped').locator('[data-object-id="qa-busy"]').count(), cli: proc(await cli(), 'qa-busy') };
        const again = page.locator('[data-object-id="qa-busy"]');
        await again.click();
        const resumed = page.locator('[data-session-detail="qa-busy"]').getByRole('button', { name: 'Stop', exact: true }).waitFor({ timeout: 10000 });
        await again.press('r'); await resumed;
        out.afterResume = { before: { sessionId: busy.sessionId, role: busy.role ?? null }, cli: proc(await cli(), 'qa-busy'), inStopped: await region('Stopped').locator('[data-object-id="qa-busy"]').count() };
        const old = page.locator('[data-object-id="qa-old"]');
        await old.click(); await old.press('d');
        const archive = page.getByRole('group', { name: 'Confirm Archive qa-old', exact: true });
        await archive.waitFor({ timeout: 5000 });
        await archive.getByRole('button', { name: 'Cancel', exact: true }).click();
        out.archiveCancel = { confirm: await archive.count(), inStopped: await region('Stopped').locator('[data-object-id="qa-old"]').count(), cli: proc(await cli(), 'qa-old') };
        await page.locator('[data-session-detail="qa-old"]').getByRole('button', { name: 'Archive', exact: true }).click();
        await archive.waitFor({ timeout: 5000 });
        const gone = old.waitFor({ state: 'detached', timeout: 10000 });
        await archive.getByRole('button', { name: 'Confirm', exact: true }).click(); await gone;
        await page.getByRole('button', { name: 'Show archived sessions', exact: true }).click();
        await region('Archived').locator('[data-object-id="qa-old"]').waitFor({ timeout: 10000 });
        out.archived = { inArchived: await region('Archived').locator('[data-object-id="qa-old"]').count(), inStopped: await region('Stopped').locator('[data-object-id="qa-old"]').count(), cli: proc(await cli('--archived'), 'qa-old') };
        await page.getByRole('button', { name: 'Show archived sessions', exact: true }).click();
        const idle = page.locator('[data-object-id="qa-idle"]');
        await idle.click(); await idle.press('c');
        const caps = page.getByRole('table', { name: 'qa-idle capabilities', exact: true });
        await caps.waitFor({ timeout: 5000 });
        out.capabilities = { rows: await caps.locator('tr').allTextContents(), controls: await caps.locator('button, input, select, textarea').count() };
        await page.keyboard.press('Escape');
        out.capabilities.afterEscape = await caps.count();
        await page.locator('[data-object-id="qa-spoke"]').click(); await page.keyboard.press('c');
        await page.getByText('No adapter for qa-spoke', { exact: true }).waitFor({ timeout: 5000 });
        out.noAdapter = { text: 'No adapter for qa-spoke', tables: await page.locator('[data-session-slot="groups"]').getByRole('table').count() };
        await page.keyboard.press('Escape');
        await page.locator('[data-object-id="qa-gone"]').click();
        const actions = page.locator('[data-session-actions="qa-gone"]');
        const spawns = fixture.fakes.codex.spawns.length;
        await actions.getByRole('button', { name: 'Resume', exact: true }).click();
        await actions.getByRole('alert').waitFor({ timeout: 5000 });
        const fresh = actions.getByRole('button', { name: 'Launch fresh', exact: true });
        await fresh.waitFor({ timeout: 5000 });
        out.unavailable = { alert: await text(actions.getByRole('alert')), freshTitle: await fresh.getAttribute('title'), brief };
        const started = actions.getByRole('button', { name: 'Stop', exact: true }).waitFor({ timeout: 10000 });
        await fresh.click(); await started;
        const last = fixture.fakes.codex.spawns.at(-1);
        out.fresh = { cli: proc(await cli(), 'qa-gone'), newSpawns: fixture.fakes.codex.spawns.length - spawns, briefCarried: !!last?.brief?.text?.includes('QA brief text for the fresh launch.'), resumeConversation: last?.resumeConversation ?? null };
        out.mutations = sent.filter(f => ['session.stop', 'session.resume', 'session.archive'].includes(f.type)).map(f => [f.type, f.session, f.fresh ?? null]);
        return out;
      },
      async page() {
        await area('Sessions');
        const row = page.locator('[data-object-id="qa-page"]');
        await row.click(); await row.press('Meta+Enter');
        const detail = page.locator('[data-pane="secondary"] [data-area-module="Sessions"][data-area-surface="page"]');
        await detail.getByRole('table', { name: 'qa-page capabilities', exact: true }).waitFor({ timeout: 5000 });
        const out = { facts: await detail.locator('dl').evaluate(n => [...n.querySelectorAll('dt')].map(dt => `${dt.textContent}=${dt.nextElementSibling?.textContent}`)) };
        await detail.getByRole('button', { name: 'Stop', exact: true }).click();
        const stop = detail.getByRole('group', { name: 'Confirm Stop qa-page', exact: true });
        await stop.waitFor({ timeout: 5000 });
        await page.keyboard.press('Escape');
        out.escape = { confirm: await stop.count(), cli: proc(await cli(), 'qa-page') };
        await page.keyboard.press('x'); await stop.waitFor({ timeout: 5000 });
        const stopped = detail.getByRole('button', { name: 'Resume', exact: true }).waitFor({ timeout: 10000 });
        await page.keyboard.press('Enter'); await stopped;
        out.stopped = proc(await cli(), 'qa-page');
        const resumed = detail.getByRole('button', { name: 'Stop', exact: true }).waitFor({ timeout: 10000 });
        await page.keyboard.press('r'); await resumed;
        out.resumed = proc(await cli(), 'qa-page');
        await page.keyboard.press('x'); await stop.waitFor({ timeout: 5000 });
        await stop.getByRole('button', { name: 'Confirm', exact: true }).click();
        await detail.getByRole('button', { name: 'Resume', exact: true }).waitFor({ timeout: 10000 });
        await page.keyboard.press('d');
        const archive = detail.getByRole('group', { name: 'Confirm Archive qa-page', exact: true });
        await archive.waitFor({ timeout: 5000 });
        out.archiveConfirm = await text(archive);
        await archive.getByRole('button', { name: 'Confirm', exact: true }).click();
        await page.locator('[data-pane="primary"] [data-object-id="qa-page"]').waitFor({ state: 'detached', timeout: 10000 });
        out.archived = proc(await cli('--archived'), 'qa-page');
        const other = page.locator('[data-pane="secondary"]');
        if (await other.count()) { await other.getByRole('button', { name: 'Close', exact: true }).click(); await other.waitFor({ state: 'detached', timeout: 5000 }); }
        return out;
      },
      async narrow() {
        await area('Sessions');
        await page.setViewportSize({ width: 600, height: 900 });
        const out = { narrowMedia: await page.evaluate(() => window.matchMedia('(max-width: 639px)').matches) };
        const geometry = name => page.locator(`[data-object-id="${name}"]`).evaluate(node => {
          const r = e => { const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), right: Math.round(b.right), height: Math.round(b.height) }; };
          const span = t => [...node.querySelectorAll('span')].find(s => s.textContent === t);
          const code = node.querySelector('code');
          const vis = t => { const s = span(t); return !!s && s.getClientRects().length > 0 && getComputedStyle(s).display !== 'none' && getComputedStyle(s).visibility !== 'hidden'; };
          return { row: r(node), name: r(span(node.getAttribute('data-object-id'))), role: r(node.querySelector('[data-session-role]')), state: r(node.querySelector('[data-session-age]').parentElement),
            harness: r(node.querySelector('[title]').firstElementChild), item: r(node.querySelector('[data-item-requested]')),
            code: code ? { text: code.textContent, visible: code.getClientRects().length > 0, ...r(code) } : null, opus: vis('opus'), account: vis('qa-main') };
        });
        out.wait = await geometry('qa-wait');
        out.idle = await geometry('qa-idle');
        out.visibleActions = await page.locator('[data-session-slot="groups"] [data-session-actions]:visible').count();
        const idle = page.locator('[data-object-id="qa-idle"]');
        await idle.click();
        const detail = page.locator('[data-pane="primary"] [data-area-module="Sessions"][data-area-surface="page"]');
        await detail.getByRole('button', { name: 'Stop', exact: true }).waitFor({ timeout: 5000 });
        out.tap = { pageHasName: (await text(detail))?.includes('qa-idle'), secondary: await page.locator('[data-pane="secondary"]').count() };
        await detail.getByRole('button', { name: 'Stop', exact: true }).click();
        const confirm = detail.getByRole('group', { name: 'Confirm Stop qa-idle', exact: true });
        await confirm.waitFor({ timeout: 5000 });
        out.stopConfirm = await text(confirm);
        await page.keyboard.press('Escape');
        out.afterFirstEscape = { confirm: await confirm.count(), pageOpen: await detail.count() };
        await page.keyboard.press('Escape');
        await idle.waitFor({ timeout: 5000 });
        await page.waitForFunction(() => document.activeElement?.getAttribute('data-object-id') === 'qa-idle', null, { timeout: 5000 }).catch(() => {});
        out.afterSecondEscape = { focused: await page.evaluate(() => document.activeElement?.getAttribute('data-object-id') ?? null), pressed: await idle.getAttribute('aria-pressed'), cli: proc(await cli(), 'qa-idle') };
        for (const key of ['x', 'd']) await idle.press(key);
        out.listKeys = { confirms: await page.getByRole('group', { name: /^Confirm /, exact: false }).count() };
        await page.setViewportSize({ width: 1440, height: 900 });
        await sleep(300);
        out.desktop = await geometry('qa-wait');
        await page.locator('[data-object-id="qa-wait"]').click();
        out.desktopDetail = await page.locator('[data-session-detail="qa-wait"] code').textContent({ timeout: 5000 });
        out.command = COMMAND;
        return out;
      },
      async launch() {
        await area('Sessions');
        const s0 = sent.length;
        await page.waitForFunction(() => { const b = document.querySelector('[data-session-slot="header"] button[title="New Aide (a)"]'); return !!b && !b.disabled; }, null, { timeout: 10000 });
        const header = await page.locator('[data-session-slot="header"] button').allTextContents();
        const aide = page.getByRole('form', { name: 'New Aide', exact: true });
        const opened = aide.waitFor({ timeout: 5000 });
        await page.keyboard.press('a'); await opened;
        const values = async form => Object.fromEntries(await Promise.all(['Name', 'Role', 'Harness', 'Model', 'Account', 'Effort', 'Item', 'Brief'].map(async f => [f, await form.getByLabel(f, { exact: true }).inputValue()])));
        const out = { header, aideDefaults: await values(aide), directoryFields: await aide.getByLabel(/directory|cwd|folder|path/i).count(), aideFields: await aide.locator('input, select, textarea').evaluateAll(ns => ns.map(n => n.getAttribute('aria-label'))) };
        await aide.getByLabel('Brief', { exact: true }).fill('QA Aide brief');
        const appeared = region('Yours').locator('[data-object-id="aide-1"]').waitFor({ timeout: 10000 });
        await page.keyboard.press('Enter'); await appeared;
        await aide.waitFor({ state: 'detached', timeout: 5000 });
        out.launchFrames = sentSince(s0, 'session.launch').map(({ id: _id, ...f }) => f);
        out.aideCli = proc(await cli(), 'aide-1');
        out.root = root;
        const form = page.getByRole('form', { name: 'Launch a session', exact: true });
        const opened2 = form.waitFor({ timeout: 5000 });
        await page.keyboard.press('l'); await opened2;
        out.launchEmpty = await values(form);
        await form.getByLabel('Role', { exact: true }).selectOption('reviewer');
        out.reviewerDefaults = await values(form);
        await form.getByLabel('Harness', { exact: true }).fill('opencode');
        out.otherHarness = await values(form);
        await form.getByLabel('Harness', { exact: true }).fill('claude-code');
        out.backToHarness = await values(form);
        await form.getByLabel('Name', { exact: true }).fill('qa-refused');
        await form.getByLabel('Account', { exact: true }).selectOption('qa-limited');
        await form.getByRole('button', { name: 'Launch', exact: true }).click();
        await form.getByRole('alert').waitFor({ timeout: 5000 });
        out.refusal = { alert: await text(form.getByRole('alert')), name: await form.getByLabel('Name', { exact: true }).inputValue(), cli: proc(await cli(), 'qa-refused'), resetsAt };
        await page.keyboard.press('Escape');
        await form.waitFor({ state: 'detached', timeout: 5000 });
        out.modelsList = sentSince(s0, 'models.list').length;
        out.launchFramesAll = sentSince(s0, 'session.launch').map(f => ({ name: f.name, cwd: Object.hasOwn(f, 'cwd') }));
        return out;
      },
      async artifacts() {
        await area('Artifacts');
        const list = page.getByRole('list', { name: 'Artifacts objects', exact: true });
        await list.getByRole('button', { name: 'Fold Mine', exact: true }).waitFor({ timeout: 10000 });
        const header = name => list.getByRole('region', { name, exact: true }).locator('header').first().evaluate(n => n.textContent);
        const out = { ids, headers: { Mine: await header('Mine'), Kept: await header('Kept'), 'By role': await header('By role'), Archived: await header('Archived') },
          folded: { 'By role': await list.getByRole('button', { name: 'Fold By role', exact: true }).getAttribute('aria-expanded'), Archived: await list.getByRole('button', { name: 'Fold Archived', exact: true }).getAttribute('aria-expanded') },
          mine: await list.getByRole('region', { name: 'Mine', exact: true }).locator('[data-object-id]').evaluateAll(ns => ns.map(n => n.getAttribute('data-object-id'))) };
        await list.getByRole('button', { name: 'Fold By role', exact: true }).click();
        await list.getByRole('button', { name: 'Fold Coordinator', exact: true }).click();
        const coord = list.getByRole('region', { name: 'Coordinator', exact: true }).locator(`[data-object-id="${ids.coord}"]`);
        await coord.waitFor({ timeout: 5000 });
        out.coordRow = await text(coord);
        const inventory = async () => (await req({ type: 'artifact.list' })).artifacts;
        await coord.click();
        const kept = region('Kept').locator(`[data-object-id="${ids.coord}"]`);
        const appeared = kept.waitFor({ timeout: 5000 });
        await coord.evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK', key: 'л', bubbles: true, cancelable: true })));
        await appeared;
        out.keep = { keptRow: await text(kept), hubKept: (await inventory()).find(x => x.id === ids.coord)?.kept };
        await kept.click(); await kept.press('ArrowUp');
        out.keep.upFocus = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.getAttribute('data-object-id') ?? null);
        out.keep.afterUp = (await inventory()).find(x => x.id === ids.coord)?.kept;
        await kept.click();
        const removed = kept.waitFor({ state: 'detached', timeout: 5000 });
        await kept.press('k'); await removed;
        out.keep.unkept = (await inventory()).find(x => x.id === ids.coord)?.kept;
        out.keep.backInRole = await list.getByRole('region', { name: 'Coordinator', exact: true }).locator(`[data-object-id="${ids.coord}"]`).count();
        const human = region('Mine').locator(`[data-object-id="${ids.human}"]`);
        await human.click();
        const left = human.waitFor({ state: 'detached', timeout: 5000 });
        await human.press('d'); await left;
        await page.keyboard.press('Shift+a');
        await region('Archived').locator(`[data-object-id="${ids.human}"]`).waitFor({ timeout: 5000 });
        const listed = await req({ type: 'artifact.list', artifact: ids.human });
        out.archive = { layer: listed.artifact.layer, fileDeleted: listed.artifact.fileDeleted ?? null, fileKept: existsSync(a.human.path), inArchived: await region('Archived').locator(`[data-object-id="${ids.human}"]`).count() };
        const folder = region('Mine').locator(`[data-object-id="${ids.folder}"]`);
        await folder.click();
        const child = region('Mine').locator('[data-artifact-file="index.md"]');
        const shown = child.waitFor({ timeout: 5000 });
        await folder.press('Enter'); await shown;
        out.folder = { child: await text(child), listRequests: sent.filter(f => f.type === 'artifact.list' && f.artifact === ids.folder).length };
        const drawer = page.getByRole('complementary', { name: 'Drawer', exact: true });
        const open = async (id, receipt) => { const row = region('Mine').locator(`[data-object-id="${id}"]`); await row.click(); await row.press('Enter'); await receipt; };
        await page.evaluate(() => { document.cookie = 'qa_workbench_probe=private; SameSite=Strict; Path=/'; });
        const s0 = sent.length;
        await open(ids.page, drawer.locator('iframe').waitFor({ timeout: 10000 }));
        const frame = drawer.locator('iframe');
        const src = await frame.getAttribute('src');
        await page.frameLocator('[aria-label="Drawer"] iframe').locator('#result').getByText('SecurityError', { exact: false }).waitFor({ timeout: 10000 });
        const box = await frame.boundingBox(), drawerBox = await drawer.boundingBox();
        out.page = { sandbox: await frame.getAttribute('sandbox'), srcOrigin: new URL(src).origin, pageOrigin: new URL(page.url()).origin, srcPath: new URL(src).pathname,
          urlRequests: sentSince(s0, 'artifact.url').filter(f => f.artifact === ids.page).length, script: JSON.parse(await page.frameLocator('[aria-label="Drawer"] iframe').locator('#result').textContent()),
          workbenchCookie: (await page.evaluate(() => document.cookie)).includes('qa_workbench_probe=private'), frameHeight: Math.round(box?.height ?? 0), drawerHeight: Math.round(drawerBox?.height ?? 0) };
        const plain = drawer.getByRole('region', { name: 'File text', exact: true });
        await open(ids.text, plain.getByText('# QA text file', { exact: false }).waitFor({ timeout: 10000 }));
        out.text = { text: await plain.textContent(), expected: TEXT, scripts: await plain.locator('script').count(), download: await drawer.locator('a[download]').getAttribute('download'), iframes: await drawer.locator('iframe').count() };
        const name = basename(a.binary.path);
        const link = drawer.getByRole('link', { name: `Download ${name}`, exact: true });
        await open(ids.binary, link.waitFor({ timeout: 10000 }));
        const got = page.waitForEvent('download');
        await link.click();
        const saved = await got;
        const savedPath = join(root, 'qa-downloaded.bin');
        await saved.saveAs(savedPath);
        out.binary = { name, download: await link.getAttribute('download'), hrefPath: new URL(await link.getAttribute('href')).pathname, suggested: saved.suggestedFilename(), bytesEqual: Buffer.compare(await readFile(savedPath), BYTES) === 0, texts: await plain.count(), iframes: await drawer.locator('iframe').count() };
        await open(ids.mermaid, plain.getByText(MERMAID, { exact: true }).waitFor({ timeout: 10000 }));
        out.mermaid = { text: await plain.textContent(), download: await drawer.locator('a[download]').getAttribute('download'), path: basename(a.mermaid.path), iframes: await drawer.locator('iframe').count() };
        await open(ids.svg, page.frameLocator('[aria-label="Drawer"] iframe').getByText('QA SVG diagram', { exact: true }).waitFor({ timeout: 10000 }));
        out.svg = { sandbox: await drawer.locator('iframe').getAttribute('sandbox'), texts: await plain.count() };
        out.frames = { read: sent.filter(f => f.type === 'artifact.read').length };
        await list.getByRole('button', { name: 'Fold Mine', exact: true }).click();
        await page.reload({ waitUntil: 'load' }); await live('Live', 15000); await area('Artifacts');
        await list.getByRole('button', { name: 'Fold Mine', exact: true }).waitFor({ timeout: 5000 });
        out.foldReload = { mine: await list.getByRole('button', { name: 'Fold Mine', exact: true }).getAttribute('aria-expanded'), byRole: await list.getByRole('button', { name: 'Fold By role', exact: true }).getAttribute('aria-expanded') };
        await list.getByRole('button', { name: 'Fold Mine', exact: true }).click();
        return out;
      },
      async help() {
        const out = {};
        for (const [name, id] of [['Sessions', 'qa-idle'], ['Artifacts', ids.folder], ['Accounts', 'claude-code/qa-main']]) {
          await area(name);
          await page.locator(`[data-pane="primary"] [data-object-id="${id}"]`).click();
          await page.keyboard.press('Shift+/');
          const dialog = page.getByRole('dialog', { name: `${name} keys`, exact: true });
          await dialog.waitFor({ timeout: 5000 });
          const rows = await dialog.locator('[data-key-action]').evaluateAll(ns => ns.map(n => `${n.querySelector('dt')?.textContent}=${n.querySelector('dd')?.textContent}`));
          const last = dialog.locator('[data-key-action]').last();
          await last.scrollIntoViewIfNeeded();
          const x = await last.boundingBox(), y = await dialog.boundingBox();
          out[name] = { rows, kbd: await dialog.locator('kbd').count(), lastVisible: !!x && !!y && x.y >= y.y && x.y + x.height <= y.y + y.height };
          await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden', timeout: 5000 });
        }
        return out;
      },
    };
    const deadline = Date.now() + 45 * 60_000;
    writeFileSync(`${dir}/ready`, `${JSON.stringify({ root, pid: process.pid, ids, resetsAt, resetLabel, command: COMMAND })}\n`);
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
    holder.close(); waiter.close();
  }, page => {
    page.on('websocket', socket => {
      socket.on('framesent', event => { try { sent.push(JSON.parse(String(event.payload))); } catch {} });
      socket.on('framereceived', event => { for (const line of String(event.payload).split('\n')) if (line.trim()) { try { received.push(JSON.parse(line)); } catch {} } });
    });
  });
});
JS
node --check "$Q/bg.cjs" && node --check "$Q/q.cjs" && node --check "$Q/rig.test.mjs" && echo "helpers parse"
```

The check functions. Paste the block once in QA's own shell. Each writes its captures under `$EV` and prints the facts its row judges.

```sh
k00() {
  git -C "$W" rev-parse HEAD refs/heads/dev; git -C "$W" status --porcelain | grep -v -x '?? node_modules' | wc -l
  (cd "$W" && node hub/bin/cland.ts task plan show E-418 --json) > "$EV/E418S2-00-plan.json"
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=v.stages.find(x=>x.name==="acting, the queue, accounts and artifacts");console.log(JSON.stringify({stages: v.stages.map(x=>x.name), state: s?.state, qa: s?.qa, merged: s?.merged, total: s?.total, items: s?.items ?? s?.lanes}))' "$EV/E418S2-00-plan.json" | tee "$EV/E418S2-00-stage.txt"
  for i in T-1136 T-1137 T-1138 T-1133 T-1134 T-1135 T-1139 T-1140; do echo "== $i"; git -C "$W" log --first-parent --oneline --grep "Item: $i" dev; done
  ls "$W/web/test/session-actions.test.ts" "$W/web/test/session-launch.test.ts" "$W/web/test/verification.test.ts" "$W/web/test/accounts.test.ts" "$W/web/test/artifacts.test.ts" "$W/hub/test/web-verification-model.test.ts" "$W/hub/test/web-accounts.test.ts" "$W/web/src/sessions/SessionLaunch.tsx" "$W/web/src/accounts/Profile.tsx" "$W/web/src/artifacts/SandboxedArtifactFrame.tsx"
  grep -c -F 'sandbox="allow-scripts"' "$W/web/src/artifacts/SandboxedArtifactFrame.tsx"; grep -c -F "launch: { Enter: 'accept', Escape: 'dismiss' }" "$W/web/src/keymap.ts"; grep -c -F "type: 'web.session'" "$W/web/src/accounts/Profile.tsx"
  echo "TMPDIR=$TMPDIR Q=$Q"
}
k10() {
  quiet || return 1
  ( . "$Q/env.sh"; cd "$W" && npm run typecheck > "$EV/E418S2-10.log" 2>&1; echo "typecheck exit $?"; node hub/test/lint-tiers.ts > "$EV/E418S2-10-tiers.log" 2>&1; echo "tiers exit $?" )
  grep -F -e 'web colours: token-only sources; colour fixtures passed' -e 'web tokens:' -e 'web hooks: conditional-hook fixture rejected by configured oxlint' "$EV/E418S2-10.log"
  grep -n -E '"(web/test/(session-actions|sessions|session-launch|verification|accounts|artifacts|area-slots)\.test\.ts|hub/test/web-(verification-model|accounts|area-state)\.test\.ts)"' "$W/hub/test/tiers.json"
}
k11() {
  git -C "$W" grep -n -E "keydown|keyup|keypress|onKey(Down|Up|Press)" -- web/src
  git -C "$W" grep -n -E "localStorage|sessionStorage" -- web/src
  git -C "$W" grep -n -E "<iframe|allow-same-origin|sandbox=" -- web/src
  git -C "$W" grep -n -E "#[0-9a-fA-F]{3,8}\b" -- web/src/sessions web/src/accounts web/src/artifacts
  printf 'launch directory sources: '; git -C "$W" grep -n -i -E "cwd|directory" -- web/src/sessions/SessionLaunch.tsx | wc -l
  printf 'browser list or revoke sources: '; git -C "$W" grep -n -E "'web\.(sessions|revoke)'" -- web/src | wc -l
  for c in $(for t in T-1136 T-1137 T-1138 T-1133 T-1134 T-1135 T-1139 T-1140; do git -C "$W" log --first-parent --format=%H --grep "Item: $t" dev; done); do git -C "$W" show --stat --format= "$c" -- package.json package-lock.json web/package.json hub/package.json; done
}
k12() {
  ( cd "$W" || exit 1
    chk() { printf '%s present %s: %s\n' "$(grep -c -F -- "$2" "$1")" "$1" "$2"; }
    nochk() { printf '%s absent %s: %s\n' "$(grep -c -F -- "$2" "$1")" "$1" "$2"; }
    chk web/README.md '## Verification in Sessions'
    chk web/README.md 'Enter on it to toggle the queue in place.'
    chk web/README.md 'admission ETA. It includes the last 20 runs'
    chk web/README.md 'view reads `executor.status` once'
    chk web/README.md 'clock advances running and waiting durations without network reads.'
    chk web/README.md '### Accounts strip and Accounts area'
    chk web/README.md 'from 75 percent and red from 90'
    chk web/README.md 'they never become zero percent or an empty meter.'
    chk web/README.md 'Entering Accounts requests one `account.poll` once connected.'
    chk web/README.md 'Accounts opens with the human'
    chk web/README.md 'the cookie expires 30 days after creation'
    chk web/README.md 'The profile is not a harness account'
    chk web/README.md 'Stop and Archive replace the'
    chk web/README.md 'Launch fresh'
    chk web/README.md 'Capabilities is a read-only table'
    chk web/README.md 'Below 640 px, rows are 52 px tall with two lines'
    chk web/README.md 'opens that page in the current pane'
    chk web/README.md '### Launching'
    chk web/README.md '| `l` | Launch a session |'
    chk web/README.md '| `a` | New Aide |'
    chk web/README.md 'Hub refusals, including a'
    chk web/README.md 'There is no directory field and no `cwd` in the launch frame.'
    chk web/README.md 'There is no Attach in Sessions.'
    nochk web/README.md 'The launch and thread drawer arrive in following slices.'
    chk web/README.md '## Artifacts'
    chk web/README.md '`k` toggles keep, `d` archives, and `A` toggles Archived.'
    chk web/README.md 'its `sandbox` attribute is exactly `allow-scripts`, never `allow-same-origin`.'
    chk web/README.md 'Scripts cannot read the workbench document or'
    chk web/README.md 'binary files offer a named download.'
    chk web/README.md 'raw Mermaid `.mmd` stays source text with a download link, without rendering.'
    chk docs/agents/tests.md '`web/test/session-actions.test.ts` owns Stop confirmation/cancellation, Resume'
    chk docs/agents/tests.md 'The merged-facts case checks P22 geometry at 1440 px and P27'
    chk docs/agents/tests.md '`web/test/session-launch.test.ts` owns the inline launcher seam through the'
    chk docs/agents/tests.md '`hub/test/web-verification-model.test.ts` is the pure T1 queue presentation seam,'
    chk docs/agents/tests.md '`web/test/artifacts.test.ts` uses the same sealed hub/Headless Shell seam for'
    chk docs/agents/tests.md 'Its opening cases assert the capability iframe'
    printf '%s key rows\n' "$(sed -n '/^## Sessions/,/^### Launching/p' web/README.md | grep -c '^| `')" )
}
k13() {
  quiet || return 1
  ( . "$Q/env.sh"; cd "$W" && node "$Q/bg.cjs" "$Q/rig.pid" "$EV/rig.out" - sh -c 'node --test --test-reporter=tap "$0" > "$1" 2>&1; echo "exit $?" >> "$1"' "$Q/rig.test.mjs" "$EV/rig.log" )
  seen "$Q/rig/ready" '"root"' 1200 || { echo "rig not ready"; tail -n 40 "$EV/rig.log"; return 1; }
  cp "$Q/rig/ready" "$EV/E418S2-13-ready.json"
  P=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).root)' "$Q/rig/ready"); echo "P=$P"
  ( . "$Q/env.sh"; cd "$P" && cland session list --json > "$EV/E418S2-13-list.json"; echo "list exit $?" )
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(JSON.stringify(v.processes.map(p=>[p.name,p.role??null,p.harness,p.status])))' "$EV/E418S2-13-list.json"
  q "$Q/rig/ready" '({ids: R.ids, resetsAt: R.resetsAt, resetLabel: R.resetLabel})'
}
k14() {
  rc 14-strip strip "$EV/E418S2-14.png" && fact 14-strip E418S2-14
  q "$EV/E418S2-14.json" '(()=>{const L=F.resetLabel,c=id=>F.cells?.find(x=>x.id===id)??{},m=c("claude-code/qa-main"),l=c("claude-code/qa-limited"),x=c("codex/qa-codex"),o=c("opencode/qa-open");return {ok:V.ok,error:V.error??null,order:F.cells?.map(x=>x.id),orderIsHub:canon(F.cells?.map(x=>x.id))===canon(F.hubOrder),resetLabel:L,
    main:{tone:m.tone,meter:m.meter,amber:m.shareColor===F.tokens?.warning,text:has(m.text,"qa-main","Claude Code","wk 81%","↻"+L),tip:has(m.title,"5h 38% ↻"+L,"wk 81% ↻"+L,"from qa-reading")},
    limited:{tone:l.tone,meter:l.meter,red:l.color===F.tokens?.critical&&l.shareColor===F.tokens?.critical,text:has(l.text,"✗ limited "+L,"hit by qa-limiter"),tip:has(l.title,"5h 100% ↻"+L,"wk 88% ↻"+L,"limited "+L,"hit by qa-limiter: rate_limit")},
    codex:{tone:x.tone,meter:x.meter,plain:x.shareColor===F.tokens?.text,text:has(x.text,"qa-codex","Codex","wk 19%","↻"+L),tip:has(x.title,"5h 12% ↻"+L,"poll")},
    open:{meter:o.meter,dash:has(o.text,"qa-open","OpenCode","—"),zero:o.text?.includes("0%")??null,tip:has(o.title,"no limit data")},
    pollsBeforeAccounts:F.pollsBeforeAccounts,linkOpensAccounts:F.linkOpensAccounts};})()' | tee "$EV/E418S2-14.txt"
}
k15() {
  rc 15-accounts accounts "$EV/E418S2-15.png" && fact 15-accounts E418S2-15
  q "$EV/E418S2-15.json" '(()=>{const b=id=>F.blocks?.find(x=>x.id===id)?.text??"",L=R.resetLabel,P=F.root,day=2592000000,t=F.first?.times??[],h=F.hubBefore??[],o=F.other?.times??[],hub=JSON.parse(fs.readFileSync(A[0],"utf8")).facts?.hubOrder;return {ok:V.ok,error:V.error??null,polls:F.polls,order:F.order,orderIsHub:canon(F.order)===canon(hub),
    main:has(b("claude-code/qa-main"),"Claude Code",P+"/qa-main","5h","38%","wk","81%","↻"+L,"from qa-reading"),
    limited:has(b("claude-code/qa-limited"),"Claude Code",P+"/qa-limited","100%","88%","✗ limited","since ","hit by qa-limiter","rate_limit"),
    codex:has(b("codex/qa-codex"),"Codex",P+"/qa-codex","12%","19%","↻"+L,"poll"),
    open:has(b("opencode/qa-open"),"OpenCode",P+"/qa-open.db","no limit data"),
    profile:{hubRecords:h.length,createdMatches:t[0]===h[0]?.createdAt,lastUsedMatches:t[1]===h[0]?.lastUsedAt,thirtyDays:Date.parse(t[2])-Date.parse(t[0])===day,labels:has(F.first?.text,"This browser","Created","Last used","Cookie expires"),accountRows:F.first?.accountIds,revoke:F.first?.revoke},
    second:{hubRecords:F.hubAfter?.length,otherIsNewRecord:F.hubAfter?.some(r=>r.createdAt===o[0])&&o[0]!==t[0],otherThirtyDays:Date.parse(o[2])-Date.parse(o[0])===day,firstUnchanged:canon(F.reentered?.times)===canon(t),otherAbsentFromFirst:!(F.reentered?.times??[]).some(x=>o.includes(x))},
    frames:F.browserFrames};})()' "$EV/E418S2-14.json" | tee "$EV/E418S2-15.txt"
}
k16() {
  rc 16-queue queue "$EV/E418S2-16.png" && fact 16-queue E418S2-16
  q "$EV/E418S2-16.json" '(()=>{const sec=s=>/^[0-9]+s$/.test(s)?Number(s.slice(0,-1)):/^[0-9]+m$/.test(s)?60*Number(s.slice(0,-1)):NaN,o=F.opened??{},r=o.rows??[],a=F.aged?.rows??[];return {ok:V.ok,error:V.error??null,closed:F.closedSummary,closedForm:/^verify: human [0-9]+s · remote 0\/[0-9]+ · 1 waiting · next /.test(F.closedSummary),expanded:o.expanded,rows:r.length,
    holder:[r[0]?.[0],r[0]?.[1],has(r[0]?.[3],"hub-only",R.root,"since ")],waiter:[r[1]?.[0],r[1]?.[1],has(r[1]?.[3],"hub-only","executor local","since ")],times:r.map(x=>x[4]),etas:r.map(x=>x[5]),
    spend:o.spend,metrics:has(o.metrics,"/20 runs","run median","wait median"),executorReads:F.executorReads,
    aged:{summary:F.aged?.summary,times:a.map(x=>x[4]),advanced:a.length===2&&a.every((x,i)=>sec(x[4])>=sec(r[i][4])+3),queueFrames:F.aged?.queueFrames},
    replaced:{rows:F.replaced?.rows.length,time:F.replaced?.rows[0]?.[4],hubTime:F.replaced?.hubRunMs==null?null:Math.floor(F.replaced.hubRunMs/1000)+"s",summary:F.replaced?.summary,queueFrames:F.replaced?.queueFrames},reloadOpen:F.reloadOpen,reloadClosed:F.reloadClosed,tableAfterClosedReload:F.tableAfterClosedReload};})()' | tee "$EV/E418S2-16.txt"
}
k17() {
  rc 17-act act "$EV/E418S2-17.png" && fact 17-act E418S2-17
  q "$EV/E418S2-17.json" '(()=>{const c=x=>x?[x.status,x.role]:null;return {ok:V.ok,error:V.error??null,confirm:F.confirmText,stopHiddenWhileConfirming:F.stopButtonWhileConfirming,escape:[F.afterEscape?.confirm,c(F.afterEscape?.cli)],stop:[F.afterEnter?.inStopped,c(F.afterEnter?.cli)],
    resume:{cli:c(F.afterResume?.cli),sameSession:F.afterResume?.cli?.sessionId===F.afterResume?.before.sessionId,sameRole:F.afterResume?.cli?.role===F.afterResume?.before.role,inStopped:F.afterResume?.inStopped},
    archiveCancel:[F.archiveCancel?.confirm,F.archiveCancel?.inStopped,F.archiveCancel?.cli?.archivedAt],archived:[F.archived?.inArchived,F.archived?.inStopped,!!F.archived?.cli?.archivedAt],
    capabilities:F.capabilities,noAdapter:F.noAdapter,unavailable:{alert:F.unavailable?.alert,freshTitle:F.unavailable?.freshTitle,sameBrief:F.unavailable?.freshTitle==="Same brief: "+R.ids.brief},
    fresh:{cli:c(F.fresh?.cli),newSpawns:F.fresh?.newSpawns,briefCarried:F.fresh?.briefCarried,resumeConversation:F.fresh?.resumeConversation},mutations:F.mutations};})()' | tee "$EV/E418S2-17.txt"
}
k18() {
  rc 18-page page "$EV/E418S2-18.png" && fact 18-page E418S2-18
  q "$EV/E418S2-18.json" '(()=>{const c=x=>x?[x.status,x.sessionId===F.escape?.cli?.sessionId,!!x.archivedAt]:null;return {ok:V.ok,error:V.error??null,facts:F.facts,escape:[F.escape?.confirm,F.escape?.cli?.status],stopped:c(F.stopped),resumed:c(F.resumed),archiveConfirm:F.archiveConfirm,archived:c(F.archived)};})()' | tee "$EV/E418S2-18.txt"
}
k19() {
  rc 19-narrow narrow "$EV/E418S2-19.png" && fact 19-narrow E418S2-19
  q "$EV/E418S2-19.json" '(()=>{const w=F.wait??{},i=F.idle??{},d=F.desktop??{};return {ok:V.ok,error:V.error??null,media:F.narrowMedia,
    wait:{height:w.row?.height,fits:w.row?.right<=600,line1:w.name?.y===w.role?.y&&w.name?.y===w.state?.y&&w.state?.x>w.role?.right,line2:w.harness?.y>w.name?.y&&w.harness?.y===w.item?.y,command:w.code?.text===F.command&&w.code?.visible,commandFits:!!w.code&&w.code.right<=600,modelAccountShown:[w.opus,w.account]},
    idle:{height:i.row?.height,line2:i.harness?.y>i.name?.y,command:i.code},visibleActions:F.visibleActions,tap:F.tap,stopConfirm:F.stopConfirm,afterFirstEscape:F.afterFirstEscape,
    afterSecondEscape:{focused:F.afterSecondEscape?.focused,pressed:F.afterSecondEscape?.pressed,status:F.afterSecondEscape?.cli?.status},listKeys:F.listKeys,
    desktop:{oneLine:[d.role,d.harness,d.item,d.state].every(x=>x?.y===d.name?.y),height:d.row?.height,modelAccountShown:[d.opus,d.account]},desktopDetail:F.desktopDetail===F.command};})()' | tee "$EV/E418S2-19.txt"
}
k20() {
  rc 20-launch launch "$EV/E418S2-20.png" && fact 20-launch E418S2-20
  q "$EV/E418S2-20.json" '(()=>({ok:V.ok,error:V.error??null,header:F.header,aide:F.aideDefaults,fields:F.aideFields,directoryFields:F.directoryFields,frames:F.launchFrames,
    aideCli:F.aideCli?[F.aideCli.status,F.aideCli.role,F.aideCli.cwd===F.root,F.aideCli.model,F.aideCli.account]:null,
    empty:F.launchEmpty,reviewer:F.reviewerDefaults,otherHarness:F.otherHarness,backToHarness:F.backToHarness,
    refusal:F.refusal?{limited:F.refusal.alert.startsWith("account qa-limited is limited until"),reset:F.refusal.alert.includes(R.resetsAt),name:F.refusal.name,launched:F.refusal.cli}:null,
    modelsList:F.modelsList,cwdInFrames:F.launchFramesAll}))()' | tee "$EV/E418S2-20.txt"
}
k21() {
  rc 21-artifacts artifacts "$EV/E418S2-21.png" && fact 21-artifacts E418S2-21
  q "$EV/E418S2-21.json" '(()=>{const I=R.ids,cap=p=>/^\/a\/[a-f0-9]{64}\//.test(p??""),p=F.page??{},b=F.binary??{},m=F.mermaid??{};return {ok:V.ok,error:V.error??null,headers:F.headers,folded:F.folded,
    mineFolderFirst:F.mine?.[0]===I.folder,mineIsHumanAndAide:canon([...(F.mine??[])].sort())===canon([I.folder,I.mermaid,I.svg,I.aide,I.binary,I.brief,I.human,I.page,I.text].sort()),
    coordRow:has(F.coordRow,"note",I.coord,"QA coordinator report","qa-coord"),keep:F.keep,archive:F.archive,folder:F.folder,
    page:{sandbox:p.sandbox,sameOrigin:p.srcOrigin===p.pageOrigin,capability:cap(p.srcPath),urlRequests:p.urlRequests,script:p.script,workbenchCookie:p.workbenchCookie,frameHeight:p.frameHeight,fullHeight:p.frameHeight>740},
    text:{exact:F.text?.text===F.text?.expected,scripts:F.text?.scripts,download:F.text?.download,iframes:F.text?.iframes},
    binary:{download:b.download===b.name,suggested:b.suggested===b.name,capability:cap(b.hrefPath),bytesEqual:b.bytesEqual,texts:b.texts,iframes:b.iframes},
    mermaid:{text:m.text,download:m.download===m.path,mmd:m.path?.endsWith(".mmd"),iframes:m.iframes},svg:F.svg,artifactRead:F.frames?.read,foldReload:F.foldReload};})()' | tee "$EV/E418S2-21.txt"
}
k22() {
  rc 22-help help "$EV/E418S2-22.png" && fact 22-help E418S2-22
  q "$EV/E418S2-22.json" '(()=>{const own=a=>(F[a]?.rows??[]).slice(14);return {ok:V.ok,error:V.error??null,shared:canon(F.Sessions?.rows.slice(0,14))===canon(F.Accounts?.rows)&&canon(F.Artifacts?.rows.slice(0,14))===canon(F.Accounts?.rows),
    Sessions:{kbd:F.Sessions?.kbd,own:own("Sessions"),lastVisible:F.Sessions?.lastVisible},Artifacts:{kbd:F.Artifacts?.kbd,own:own("Artifacts"),lastVisible:F.Artifacts?.lastVisible},Accounts:{kbd:F.Accounts?.kbd,rows:F.Accounts?.rows.length,lastVisible:F.Accounts?.lastVisible},
    attach:[...(F.Sessions?.rows??[])].some(r=>/attach/i.test(r))};})()' | tee "$EV/E418S2-22.txt"
  grep -n -F "area === 'Sessions' ?" "$W/web/test/palette.test.ts"
}
k25() {
  touch "$Q/rig/stop"
  seen "$EV/rig.log" 'exit ' 240; tail -n 1 "$EV/rig.log"; grep -E '^# (tests|pass|fail) ' "$EV/rig.log"; grep -F 'Web fixture census' "$EV/rig.log"
  sleep 2
  sort -u "$Q/pids" | while read -r p; do [ -n "$p" ] && kill -0 "$p" 2>/dev/null && echo "alive $p $(ps -o command= -p "$p")"; done
  echo "census of $(sort -u "$Q/pids" | grep -c .) fixture pids done"
  git -C "$W" status --porcelain | grep -v -x '?? node_modules' | wc -l
}
```

Cleanup after the evidence is recorded: print `$Q`, check it begins with `/private/tmp/qa-e418s2-`, and remove it by that literal path with a non-force `rm -r`. The rig's scratch project under the system `TMPDIR` is owned by the Web harness and removed when the rig ends. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). The scratch hub's secret, the sign-in links and the cookies are never printed or posted.

## Cases

none. No headless-grid case covers the web Sessions, Accounts or Artifacts areas; every check below is a manual check through named test files, the QA rig's Headless Shell page, the CLI or the docs, recorded with `qa-record.sh note`.

### Web cases (when in scope)

none. No `real-browser` case: every stage criterion is provable in Chrome Headless Shell with physical key codes and a test-set 600 px viewport against a signed-in sealed scratch hub (E418S2-03 to E418S2-09 and E418S2-14 to E418S2-22). An anonymous real Chrome on the live edge could show only the offline shell, with no sessions, accounts, queue or artifacts to act on, and narrow layouts would need a resized window, which a real-Chrome run never does. See "Out of scope".

## Manual checks

Record each with `sh .agents/skills/qa/qa-record.sh note E-418 "$RUN" <id> hub-api "<command>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence-file…>` from `$W` in QA's own shell, naming where it ran at the start of the command text (`[QA shell]`, `[test $W]`, `[rig page]`, `[rig hub]`, `[docs]`). The recorder takes `hub-api` for every check here; the rig's page steps are Headless Shell observations recorded the same way. Save each check's printed output as `$EV/<id>.txt` (the rig rows' functions already `tee` it; pipe the other rows' commands through `tee`) and name it, with the captures and screenshots the row wrote, as evidence.

Order: E418S2-00 and the setup; E418S2-01 before any Web file or the rig (every Web file and the rig's web edge serve the bundle it builds); then the rows in id order. E418S2-13 starts the rig detached through `bg.cjs`; it runs until E418S2-25 stops it. The rig rows E418S2-14 to E418S2-22 run once each, in id order, on the one rig: later rows read state earlier rows made (E418S2-16 releases the waiter, E418S2-17 and E418S2-18 stop, resume and archive, E418S2-20 adds `aide-1`, E418S2-22 expects the launch keys). When `rc` prints `rig NOT alive`, record that row and every later rig row BLOCKED with the tail of `$EV/rig.log` (a fixture finding, not a product failure) and go on to E418S2-23. A rig row that answers `error:` is FAIL unless its error names a fixture step (record the full error from `$EV/<id>.json`); never rerun a rig row on the same rig.

Every named test log (`nt`) must show `exit 0`, `# fail 0`, `# cancelled 0`, `# skipped 0`, `# todo 0`, `# pass` equal to `# tests`, no `not ok` and no `# SKIP`; every Web log's `census` prints a first count of at least `1` and a second count of `0`. A `# tests` count that differs from the number at writing must equal the file's own count of `test(` and `t.test(` calls at the build (renames and additions happen); every test named below must appear in `oks`.

| id | surface | where | covers | command | expected |
| --- | --- | --- | --- | --- | --- |
| E418S2-00 | hub-api | QA shell | build, plan, T-1138 landed, sealing | `k00` | Both SHAs equal the requested SHA; `0` changed paths. The plan lists the stages `seams and the session list`, `acting, the queue, accounts and artifacts`, `on E-417's thread, composer and notifications`; this stage has `qa` `{scope: "affected", when: "after-stage"}`, is not closed, and its members are T-1136, T-1137, T-1138, T-1133, T-1134, T-1135, T-1139 and T-1140 plus any findings fixes the request names (nothing else), all merged; record the printed member list and counts as printed. Under every `== <id>` line exactly one commit (T-1139 `adde2c7c`, T-1136 `ac26b027`, T-1134 `740d6f0f`, T-1137 `ab8d5d6b`, T-1140 `1850b943`, T-1133 `a43ae84c`, T-1135 `15d97e15` at writing; T-1138's own landing). **No commit under `== T-1138`, or the plan not reporting T-1138 merged: BLOCKED "T-1138 not on dev"; stop the run and report to the requester.** The ten files exist; the three greps print `1` each. `TMPDIR` is the system default (not `/tmp`) and `Q` begins `/private/tmp/qa-e418s2-`. Also record the setup's two counts (the first at least `1`, the second `0`) and `helpers parse`. Repeat the first two commands after E418S2-25: unchanged (dev not moved) |
| E418S2-01 | hub-api | sealed | build | `quiet && ( . "$Q/env.sh"; cd "$W" && npm run build --workspace web > "$EV/E418S2-01.log" 2>&1; echo "build exit $?"; ls web/dist/index.html web/dist/assets ); git -C "$W" status --porcelain \| grep -v -x '?? node_modules' \| wc -l` | `build exit 0`; `web/dist/index.html` and one `index-*.js` and one `index-*.css` under `web/dist/assets`; `0` changed paths (`web/dist` is ignored) |
| E418S2-02 | hub-api | test $W | T-1133 C2, T-1134 C1; regression of the area state and keymap | `nt E418S2-02 hub/test/web-verification-model.test.ts hub/test/web-accounts.test.ts hub/test/web-area-state.test.ts hub/test/web-keymap.test.ts; oks E418S2-02` | T1, clean (`# tests 16` at writing: 2, 3, 9 and 2). `oks` lists "recorded queue renders local and remote slots, ordered waiters, last twenty metrics and daily spend", "remote-only summary estimates admission and ageing preserves estimates and unknowns", "account projection preserves every window and selects the highest share with source severity", "missing readings stay a dash and limited marks retain reset, reason, since and session", "account order keeps registry order with synthetic defaults last and resets follow local calendar", "visibility reprojects artifacts by id without dropping the rest or rereading inventories", "new artifact deltas preserve the newest-first inventory order from artifact.list" and "artifact inventory pages retain live replacements and discard replies from an old connection" |
| E418S2-03 | hub-api | test $W | T-1136 C1 to C6, T-1137 C2 | `nt E418S2-03 web/test/session-actions.test.ts; oks E418S2-03; census E418S2-03` | Web, clean (`# tests 9` at writing), census `9` and `0` at writing. `oks` lists "Stop confirms in place, Escape keeps the busy session, and Enter stops it", "Offline session actions are disabled and do not replay after reconnect", "A failed Stop shows the hub reason and a pending confirmation sends only once", "At narrow width a tap or Enter opens the session page", "The session page shows facts and capabilities and shares all four actions", "Unavailable resume shows its reason and offers a fresh launch with the same brief", "Capabilities shows the read-only adapter table or the missing adapter", "Archive confirms once and moves the stopped session into the archive", "Resume relaunches the stopped session with its name, role and claim" |
| E418S2-04 | hub-api | test $W | T-1137 C1, C3; stage 1's Sessions list unchanged | `nt E418S2-04 web/test/sessions.test.ts; oks E418S2-04; census E418S2-04` | Web, clean (`# tests 5` at writing), census `5` and `0`. `oks` lists "Sessions rows render merged facts, holds, waiting detail and physical selection keys" (the 1440 px one-line and 600 px 52 px two-line geometry, the pending command and page-only facts) and the four other stage 1 names: "Sessions groups count fake sessions and remember folds without hub requests", "Sessions selected human wait names its topic and usage falls back to tokens", "Sessions caps stopped rows at the latest twenty and reads merged archives with A", "gs from an item reveals its claimed session inside a folded group" |
| E418S2-05 | hub-api | test $W | T-1138 C1 to C4 | `nt E418S2-05 web/test/session-launch.test.ts; oks E418S2-05; census E418S2-05` | Web, clean (`# tests 9` at writing, on T-1138's branch head merged with dev), census `9` and `0`. `oks` lists "New Aide uses role defaults and Enter launches under Yours in the project root without a directory frame", "Role selection fills its launch defaults and a different harness clears model and effort", "Focusing Model fetches the selected harness and account catalog and ignores a late old visit", "A limited fake account shows the hub reset refusal under the retained form and launches nothing", "Launch actions use physical keys and palette dispatch while form typing and Cancel stay native", "An item and artifact brief launch once while the request is pending with no client directory", "Offline launch is disabled and reconnect never replays the draft", "Session page launch actions open the same form in the active pane", "Launch waits for role defaults when the initial sessions snapshot is delayed". Model catalogues here are scripted at the WebSocket boundary; no provider binary runs |
| E418S2-06 | hub-api | test $W | T-1133 C1, C3, C4 | `nt E418S2-06 web/test/verification.test.ts; oks E418S2-06; census E418S2-06` | Web, clean (`# tests 4` at writing: the parent and three subtests), census `1` and `0`. `oks` lists "Sessions verification queue shows hand runs, ages receipts and remembers its fold", "C1 hand holder and waiter open in place with Enter and executor status is read once per opening", "C3 elapsed running and wait times advance without a frame and a replacement resets their receipt", "C4 queue open and closed preferences survive reload" |
| E418S2-07 | hub-api | test $W | T-1134 C2 to C4, T-1135 C1, C2 | `nt E418S2-07 web/test/accounts.test.ts; oks E418S2-07; census E418S2-07` | Web, clean (`# tests 6` at writing), census `6` and `0`. `oks` lists "Accounts profile shows this browser sign-in, last use and fixed 30-day cookie expiry", "Accounts profile excludes a second browser context sign-in on the same hub", "Accounts lists the fake registry with every window, path, source and limited mark", "entering Accounts polls once and ordinary account updates never repeat it", "Sessions account strip shows worst windows, limited reset, tooltips and a folding Accounts link", "accounts without readings show dashes and a failed registry poll exposes no file values" |
| E418S2-08 | hub-api | test $W | T-1139 C1 to C4, T-1140 C1 to C3 and the diagram decision | `nt E418S2-08 web/test/artifacts.test.ts; oks E418S2-08; census E418S2-08` | Web, clean (`# tests 7` at writing), census `7` and `0`. `oks` lists "Artifacts groups human, Aide and crew records with remembered section folds", "k keeps and unkeeps an agent artifact while the up arrow navigates", "d archives without deleting human bytes and Enter requests folder files", "More artifacts traverses bounded inventory pages without duplicate rows", "Enter opens a capability page full height and its script cannot read the workbench document or cookie", "files and folder children open capability text or a named binary download and report missing bytes", "diagram HTML and SVG use the sandboxed viewer while Mermaid source stays text with a download" |
| E418S2-09 | hub-api | test $W | regression: area slots, key contexts, palette and help, folds, shell | `nt E418S2-09a web/test/area-slots.test.ts; oks E418S2-09a; census E418S2-09a; nt E418S2-09b web/test/key-contexts.test.ts; oks E418S2-09b; census E418S2-09b; nt E418S2-09c web/test/palette.test.ts; census E418S2-09c; nt E418S2-09d web/test/folds.test.ts; census E418S2-09d; nt E418S2-09e web/test/shell.test.ts; census E418S2-09e` | Each file clean (`# tests` 4, 3, 11, 6 and 9 at writing), census at least `1` and `0`. Area slots: `oks` lists "Sessions, Accounts and Artifacts own pane, page and drawer slots" (now holding the artifact viewer's identity while capability reads are held), "pushed queue, account and artifact frames require no inventory rereads", "a restarted hub replaces Sessions and Accounts without reloading the page". Key contexts: `oks` lists "area modules keep selection and drawers and session launch actions appear in help and palette" (T-1138's rename of stage 1's "… while unimplemented session actions stay absent …"; Sessions help lists `Launch a session` and `New Aide` among ten session rows and counts 24 key labels; `>Launch a session` finds one palette option) |
| E418S2-10 | hub-api | sealed | typecheck, guards, tiers | `k10` | `typecheck exit 0` with no diagnostic (hub, Neovim, shared wire with its conformance file, web typechecks, the colour guard, the token contrast check and oxlint's hooks rules: the new `SessionLaunch.module.css`, `VerifyLine.module.css`, `AccountsStrip.module.css`, `Accounts.module.css`, `Profile.module.css` and `Artifacts.module.css` hold no colour value); the three guard lines appear; `tiers exit 0`; ten tier lines print: the three `hub/test/web-*` files `T1`, the seven `web/test/*` files `Web` |
| E418S2-11 | hub-api | QA shell | AGENTS.md `web/` rules; T-1138 C4, T-1140 C1 sources | `k11 \| tee "$EV/E418S2-11.txt"` | The key-listener grep lists only `web/src/keyboard.ts` (no component-local listener in `web/src/sessions/`, `web/src/accounts/` or `web/src/artifacts/`). Storage appears only in `web/src/interface-state.ts` and `web/src/connection.ts`'s reload guard. The iframe grep prints exactly one line, `web/src/artifacts/SandboxedArtifactFrame.tsx` with `sandbox="allow-scripts"`, and no `allow-same-origin` anywhere in `web/src`. The hex grep prints nothing. `launch directory sources: 0`; `browser list or revoke sources: 0` (the profile reads only `web.session`). The loop prints nothing (no landing changed a package manifest or lockfile) |
| E418S2-12 | hub-api | docs | T-1133 C5, T-1134 C5, T-1135 C3, T-1136 C7, T-1137 C4, T-1138 C5, T-1139 C5, T-1140 C4 | `k12 \| tee "$EV/E418S2-12.txt"` | Every `present` line starts with `1 `; the `absent` line starts with `0 ` (the stand-in "launch … in following slices" sentence is gone); the last line reads `14 key rows` (`l`, `a`, `j`/`↓`, `k`/`↑`, `x`, `r`, `d`, `c`, `Enter`, `⌘Enter`, `Esc`, `←`/`→`, `A`, `?`). Read `web/README.md`'s "Area modules and live state", "Verification in Sessions", "Artifacts", "Sessions" with "Launching" and "Accounts strip and Accounts area" sections, and record any statement that contradicts E418S2-14 to E418S2-22 as a finding |
| E418S2-13 | hub-api | rig hub (QA shell starts it) | the scratch project | `k13` | The rig is ready within 600 s (otherwise BLOCKED with the log tail); `P=` names a directory under the system `TMPDIR` whose name starts `w-`. `list exit 0`; the processes (name, role, harness, status) are exactly `qa-limiter` and `qa-reading` (no role, claude-code), `qa-aide` (aide, claude-code), `qa-busy` (implementer, codex), `qa-gone` (implementer, codex, `stopped`), `qa-idle` (reviewer, codex), `qa-old` (no role, codex, `stopped`), `qa-page` (no role, codex), `qa-wait` (implementer, claude-code), every one not marked `stopped` `running`; the unmanaged `qa-spoke` is no process. `ids` maps `brief` `A-1`, `human` `A-2`, `folder` `A-3`, `aide` `A-4`, `coord` `A-5`, `archived` `A-6`, `page` `A-7`, `text` `A-8`, `binary` `A-9`, `mermaid` `A-10`, `svg` `A-11` at writing (a fresh scratch tracker numbers them in creation order; later rows read the ids from `ready`, never from this text); `resetLabel` is `resetsAt`'s UTC `HH:MM` (with a weekday when it falls on the next UTC day). A seeding failure (`ready` missing, an error in the log) is a fixture finding: BLOCKED with the log |
| E418S2-14 | hub-api | rig page | T-1134 C4, C1 | `k14` | `ok: true`; `orderIsHub: true` (the cells follow the hub's `account.list` order; `codex/qa-codex`, `claude-code/qa-limited`, `claude-code/qa-main`, `opencode/qa-open` at writing). `main`: `tone` `warning`, `meter` `"81"`, `amber`, `text` and `tip` `true` (worst window `wk 81%` with its reset; the tooltip carries both windows and `from qa-reading`). `limited`: `tone` `critical`, `meter` `"100"`, `red`, `text` and `tip` `true` (`✗ limited <reset>` and `hit by qa-limiter` in the cell; `rate_limit` in the tooltip). `codex`: `tone` `normal`, `meter` `"19"`, `plain`, `text` and `tip` `true` (`poll` source). `open`: `meter: null`, `dash: true`, `zero: false`, `tip: true` (no reading reads a dash, never `0%`). `pollsBeforeAccounts: 0` (the strip never polls); `linkOpensAccounts: true`. The screenshot shows the strip above the verify line |
| E418S2-15 | hub-api | rig page, rig hub, a second browser context | T-1134 C2, C3; T-1135 C1, C2 | `k15` | `ok: true`; `polls: 1` (one `account.poll` on entering Accounts); `orderIsHub: true`; `main`, `limited`, `codex` and `open` `true` (each block names its harness and its scratch path, every window with its share and reset, the reading's age and source, the limited block its mark with `since`, the session and `rate_limit`; the OpenCode block `no limit data`). `profile`: `hubRecords: 1`, `createdMatches`, `lastUsedMatches`, `thirtyDays` and `labels` `true`, `accountRows: 0` (the profile is not an account), `revoke: 0`. `second`: `hubRecords: 2`, `otherIsNewRecord`, `otherThirtyDays`, `firstUnchanged` and `otherAbsentFromFirst` `true`. `frames`: `webSessions: 0`, `webRevoke: 0`, `webSession` at least `1` |
| E418S2-16 | hub-api | rig page and rig hub | T-1133 C1, C3, C4 | `k16` | `ok: true`; `closedForm: true` (e.g. `verify: human 6s · remote 0/4 · 1 waiting · next ?`); `expanded: "true"` after Enter on the line; `rows: 2`; `holder` `["local 1/1","human",true]` (its mode, the project root and its start); `waiter` `["waiting 1","human",true]` (executor `local`); `times` each `^[0-9]+s$` (the holder's at least 5 s more than the waiter's), `etas` `["?","?"]` (no estimate without history); `spend` `droplets today $0.00 of the $<cap> cap`; `metrics: true` (`last 0/20 runs`); `executorReads: 1`. `aged`: `advanced: true` (both times at least 3 s later after 4 s), `queueFrames: 0` (no frame arrived), the summary's holder time advanced too. `replaced`: `rows: 1`, `time` equal to `hubTime` (the new frame's holder time on the hub's fake clock, `7s` at writing: the receipt reset, nothing aged on the client yet), a summary without `waiting`, `queueFrames` at least `1`. `reloadOpen: "true"`, `reloadClosed: "false"`, `tableAfterClosedReload: 0` |
| E418S2-17 | hub-api | rig page, rig hub, CLI | T-1136 C1, C2, C3, C4, C6 | `k17` | `ok: true`; `confirm: "Stop qa-busy?ConfirmCancel"`, `stopHiddenWhileConfirming: 0`; `escape` `[0,["running","implementer"]]`; `stop` `[1,["stopped","implementer"]]` (Enter stopped it; `cland session list --json` reads it); `resume`: `cli` `["running","implementer"]`, `sameSession` and `sameRole` `true`, `inStopped: 0`; `archiveCancel` `[0,1,null]` (Cancel leaves it in Stopped); `archived` `[1,0,true]` (Confirm moved it to Archived; `--archived` reads `archivedAt`). `capabilities.rows` exactly `busyreliable`, `idlereliable`, `waiting for approvalreliable`, `waiting for humanreliable`, `unknownalways`, `Historynone`, `Usagereliable`, `Model changenone`, `Approval relayreliable`, `Terminalnone` (Codex's table at writing; re-read the adapter's capabilities if this differs), `controls: 0`, `afterEscape: 0`; `noAdapter` `{text: "No adapter for qa-spoke", tables: 0}`. `unavailable.alert: "fake conversation gone"`, `sameBrief: true`; `fresh`: `cli` `["running","implementer"]`, `newSpawns: 1`, `briefCarried: true`, `resumeConversation: null`. `mutations` exactly `session.stop qa-busy`, `session.resume qa-busy false`, `session.archive qa-old`, `session.resume qa-gone false`, `session.resume qa-gone true` (one frame per confirmed action) |
| E418S2-18 | hub-api | rig page (other pane), CLI | T-1136 C5 | `k18` | `ok: true`; `facts` include `Model=gpt-fake-1`, `Account=qa-codex`, `Harness=codex` and `Usage=125 tok · $0.25` (the capability table rendered beside them); `escape` `[0,"running"]`; `stopped` `["stopped",true,false]`; `resumed` `["running",true,false]` (same session id); `archiveConfirm: "Archive qa-page?ConfirmCancel"`; `archived` `["stopped",true,true]` and the row left the list |
| E418S2-19 | hub-api | rig page at 600 px then 1440 px | T-1137 C1, C2, C3 | `k19` | `ok: true`; `media: true`. `wait`: `height: 52`, `fits`, `line1`, `line2`, `command` and `commandFits` `true`, `modelAccountShown` `[false,false]`. `idle`: `height: 52`, `line2: true`, `command: null`. `visibleActions: 0`. `tap` `{pageHasName: true, secondary: 0}` (the page opened in the current pane); `stopConfirm: "Stop qa-idle?ConfirmCancel"`; `afterFirstEscape` `{confirm: 0, pageOpen: 1}`; `afterSecondEscape` `{focused: "qa-idle", pressed: "true", status: "running"}`; `listKeys.confirms: 0` (`x` and `d` on the narrow list do nothing). `desktop`: `oneLine: true`, `height` below `52`, `modelAccountShown` `[true,true]`; `desktopDetail: true` (the selected row unfolds with the whole command at 1440 px) |
| E418S2-20 | hub-api | rig page, rig hub, CLI | T-1138 C1, C2, C3, C4 | `k20` | `ok: true`; `header` `["Launch a session","New Aide","Archive <n>"]`; `aide` `{Name: "aide-1", Role: "aide", Harness: "codex", Model: "gpt-fake-1", Account: "qa-codex", Effort: "high", Item: "", Brief: ""}`; `fields` exactly `Name`, `Role`, `Harness`, `Model`, `Account`, `Effort`, `Item`, `Brief`; `directoryFields: 0`; `frames` exactly one `{type: "session.launch", name: "aide-1", role: "aide", harness: "codex", model: "gpt-fake-1", account: "qa-codex", effort: "high", brief: "QA Aide brief"}` (no `cwd`); `aideCli` `["running","aide",true,"gpt-fake-1","qa-codex"]` (the project root). `empty` all `""`; `reviewer` Role `reviewer`, Harness `claude-code`, Model `fake-sonnet`, Account `qa-main`, Effort `low`; `otherHarness` Harness `opencode` with Model, Account and Effort `""`; `backToHarness` equal to `reviewer`. `refusal` `{limited: true, reset: true, name: "qa-refused", launched: null}`. `modelsList: 0`; `cwdInFrames` `[{name: "aide-1", cwd: false}, {name: "qa-refused", cwd: false}]`. The screenshot shows `aide-1` under Yours |
| E418S2-21 | hub-api | rig page, rig hub | T-1139 C1 to C4; T-1140 C1 to C3; the diagram decision | `k21` | `ok: true`; `headers` `{Mine: "Mine9", Kept: "Kept0", "By role": "By role1", Archived: "Archived1"}`; `folded` `{"By role": "false", Archived: "false"}` (`aria-expanded`: both folded); `mineFolderFirst` and `mineIsHumanAndAide` `true` (the human's artifacts, the human's brief and `QA aide note`; `QA coordinator report` only under By role › Coordinator); `coordRow: true`. `keep` `{keptRow: "…· kept", hubKept: true, upFocus: "Fold Kept", afterUp: true, unkept: false, backInRole: 1}` (physical `KeyK` with key value `л` keeps; ↑ moves without unkeeping). `archive` `{layer: "archive", fileDeleted: null, fileKept: true, inArchived: 1}`. `folder` `{child: "index.md", listRequests: 1}`. `page`: `sandbox: "allow-scripts"`, `sameOrigin`, `capability` and `workbenchCookie` `true`, `urlRequests: 1`, `script` `{document: "SecurityError", cookie: "SecurityError", ownCookie: "SecurityError"}`, `fullHeight: true`. `text`: `exact: true`, `scripts: 0`, a `download` name ending `.txt`, `iframes: 0`. `binary`: `download`, `suggested`, `capability` and `bytesEqual` `true`, `texts: 0`, `iframes: 0`. `mermaid`: `text: "graph TD; QA-->Stage2"`, `download` and `mmd` `true`, `iframes: 0` (raw source as text with a download, not rendered). `svg` `{sandbox: "allow-scripts", texts: 0}`. `artifactRead: 0`. `foldReload` `{mine: "false", byRole: "true"}` (Mine folded and By role unfolded survive the reload) |
| E418S2-22 | hub-api | rig page | `?` for Sessions, Artifacts and Accounts (E-418 C8 partly) | `k22` | `ok: true`; `shared: true` (the 14 shell rows first in each). `Sessions`: `kbd: 24`, `own` exactly `Next session=j / ↓`, `Previous session=k / ↑`, `Open session or queue=Enter`, `Launch a session=l`, `New Aide=a`, `Stop session=x`, `Resume session=r`, `Archive session=d`, `Capabilities=c`, `Show archived sessions=A`; `Artifacts`: `kbd: 20`, `own` exactly `Next artifact=j / ↓`, `Previous artifact=↑`, `Open artifact=Enter`, `Keep artifact=k`, `Archive artifact=d`, `Show archived artifacts=A`; `Accounts`: `kbd: 14`, `rows: 14`; every `lastVisible: true`; `attach: false`. The grep prints the palette test's per-area count line, whose Sessions and Artifacts counts equal these `kbd` values (24 and 20 at writing) |
| E418S2-23 | hub-api | droplet (Linux) and local macOS, the Coordinator's stage covers | stage covers | from QA's own shell: `(cd "$W" && node hub/bin/cland.ts task plan show E-418) \| tee "$EV/E418S2-23.txt"` and the cover results the request names | QA runs no full suite. The Coordinator owns the stage covers (`cland verify all --occasion stage`) at the tested SHA; they add T3 and the Web phase on both platforms and are cited evidence this run does not run. Record the plan's line for this stage exactly as printed; Linux and macOS covers green at the tested SHA, each with its Web phase run (not "Web unavailable"); record each cover's run id, artifact, executor, platform, tiers and phases, wall time and cost as cited evidence. A red cover is FAIL naming its failing tests; a cover not finished when every other check is done: wait for its result in the epic topic; none queued or running at the tested SHA by then: BLOCKED "no stage cover at the tested SHA", reported to the requester |
| E418S2-24 | hub-api | sealed | brief | `( . "$Q/env.sh"; cd "$W" && cland qa lint qa/briefs/E-418-stage-2.md; echo "exit $?" ) \| tee "$EV/E418S2-24.txt"` | `qa/briefs/E-418-stage-2.md: qa lint passes at the build` and `exit 0` |
| E418S2-25 | hub-api | QA shell; rig | cleanup | `k25` | The rig log ends `exit 0` with `# tests 1`, `# pass 1`, `# fail 0` and one `Web fixture census: browser group <pid>; before <n>; after 0; scratch hub stopped` line; no `alive` line names a fixture process (`rig.test.mjs`, `hub serve`, `chrome-headless-shell`); the census line counts the pids this run recorded; `0` changed paths. An `alive` line whose command is unrelated is pid reuse: record it, not a failure. Then remove `$Q` and the worktree as "Setup" says |

Re-check helper, file, test and label names with grep at the tested build, renames happen. A test name pattern matching zero tests passes with exit 0 and "tests 0": read the counts and `oks`, never the exit code alone. The named Web and hub tests and the rig ask the live hub's verify slot for admission themselves (`suite.slot` check): an admission timeout is BLOCKED; retry after `quiet`.

Before requesting QA, run `cland qa lint <brief>` with this filled brief at the build under test. The brief is complete only when qa lint passes at the build.

## Probes that mislead

- Process cleanup probes use a fixture-owned pid/process-group census, registered at launch and checked through exit; a machine-wide `pgrep` counts other sessions too (A-9063 R2; E-413 stage 1/T-1093). Here: `$Q/pids` and the rig's own `Web fixture census` line; a machine-wide count of Headless Shell processes is not evidence either way.
- Edit existing keys in initialized configs, list standalone-test build prerequisites, enumerate regular files only for file probes, and identify events by seq/id. A second-client check allows only defaults the new client writes itself (A-8634 R12; E-412 stage 2, E-415 stage 3/DoD, E-1006). Here: the rig writes its config, registry and `roles.toml` before the hub's first start, and E418S2-01 builds the bundle every Web step reads.
- Transcript assertions identify stable item/topic/frame ids, with intervals starting at the result frame of the state-changing request. Preserve unaltered captures when correcting a probe and label the correction separately from product failures (A-8634 R13; E-412/E-415/E-1006; A-9063 R2; E-413 stage 1/T-1093). Here: the rig counts sent and received frames from the start of each op; artifacts are judged by the ids in `ready`, never by position.
- Exact tracker copies replace the initialized tracker directory after its writers stop; copy the committed directory whole, dotfiles included, and compare that same file set. Apply the full `fixtureEnvironment` result after overlays, including synthesized values; under rule 15, check zero credential-prefix names before launching scratch processes and report names/counts only (A-9063 R2; E-413 stage 1/T-1093). This run copies no tracker: the rig's project is a fresh scratch project.
- An accessibility-tree count does not prove visible reachability: a real-browser check scrolls the final row into view and checks its viewport containment (A-9063 R6; T-1095, T-1097). Here E418S2-22's `lastVisible` does that for each help's last row in Headless Shell.
- A command runner can end a row's whole process group when the row returns, which silently kills a helper started with `&` (E-414 stage 1's first run). The rig therefore starts through `bg.cjs` in a session of its own, and every rig row says whether the rig still runs when its command times out.
- The hub's hand-run reservation expires 10 s after admission unless the holder takes the suite lock (`HUMAN_GRACE_MS`): on a real hub clock the queue empties before the page opens (the first draft of this rig read `verify: idle`). The rig's hub runs on a fake clock started at the real time, as `web/test/verification.test.ts` does; the browser keeps the real clock, so client ageing is real and the hub's own times stand still. An account age of `<1m` or a few minutes is expected.
- Account readings publish after the hub's one-second coalescing on its clock; the rig advances the fake clock 1 s for that, as `web/test/accounts.test.ts` does.
- The registry order is the hub's `account.list` order, not the order of the lines the rig wrote: judge `orderIsHub`, never the file's order.
- The launch form's Model field asks the harness for its model catalogue on focus. The rig fills fields by label and never focuses Model; `modelsList: 0` records that no `models.list` left the page. The catalogue behaviour is proven by E418S2-05 with scripted replies.
- The limited-account refusal formats its reset in the hub process's timezone (`limitUntil`), followed by the ISO time in parentheses: judge the ISO `resetsAt`, not the local words.
- The fake adapters start every session in state `unknown`, which the area groups as Idle with the glyph `?`; the rig sets the states it judges explicitly.
- Narrow layouts come only from `page.setViewportSize` in Headless Shell (600×900, then back to 1440×900), as the item tests do; nothing resizes or zooms a real window.
- `nt` runs Node's TAP reporter so the `# tests`/`# pass` counters exist; the default spec reporter prints none.
- "No skip": the Web files and the rig need Chrome Headless Shell, local on macOS; a skipped or "Web unavailable" result here is BLOCKED, never PASS. The Linux runs of the same files are cited from E418S2-23.
- Duration lines are report-only: the Web budget and any test's wall time are not timing claims of this stage.
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file.
- A "ran" marker grep excludes the configuration echo line.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log.
- Speed criteria use measured wall times, never projections.
- Slots due or queued before the build count even when their results arrive later.
- "No skip" names platform-only cases and where they are covered.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

Real Chrome and computer use: out of scope for this run, not BLOCKED. Every stage criterion is proven in Chrome Headless Shell against a signed-in sealed scratch hub, and an anonymous real Chrome at the live edge would show only the offline shell with nothing to act on; narrow layouts would need a resized window; no sign-in grant exists. So no live-edge build stamp or hub-code gate applies, and the live hub is neither restarted nor rebuilt for this run. Also out of scope: the session's drawer thread, pending-approval card and composer, `s` attaching an artifact to the composer, the This topic section and the notification switches beside the profile (stage 3, on E-417's thread, composer and notifications); rendered Mermaid (T-1158; the coordinator's decision keeps raw `.mmd` as text with a download here); the phone layouts of E-419 beyond the 600 px rows and page entry; a launch with an `item` starting in the item's task worktree (needs a Git territory; `session-launch.test.ts` proves the frame forwards the item without `cwd`, and the hub's worktree seam is covered by existing hub tests); the model catalogue through a real harness (E418S2-05 scripts it); real droplets in the queue view (the remote slot rows are proven from recorded frames at T1, E418S2-02); a limited mark's clearing (stays in `cland account clear`); Neovim; any write to the live tracker or hub; running a full suite or a stage cover (E418S2-23 cites the Coordinator's); T4; duration budgets (report-only); the epic's Definition-of-done demo, a separate run; work landed on dev after the stage's items. Stage QA carries no criterion marks.

Nothing in scope needs an authorization this brief does not give: a check that cannot run for lack of one is BLOCKED, not out of scope.

## Grants

none. Every check uses the rule 15 sealed environment with credentials filtered; the Web files and the rig run their own sealed scratch hubs, projects, fake account registries and Headless Shell profiles; nothing reads or writes the human's real `~/.cland`, `~/.claude`, `~/.codex` or `~/.local/state`, no real session or provider binary starts, and no GUI starts.

## Verdict

Fix nothing. Clear only when every check E418S2-00 to E418S2-25 passes. Otherwise not clear, naming the failing, blocked or inconclusive ids and findings. On the epic record one QA verdict with `--stage "acting, the queue, accounts and artifacts"`, the full tested dev SHA, the unique run id and the case table. Stage QA carries no epic criterion marks. Report `qa clear E-418 stage acting, the queue, accounts and artifacts` or `qa not clear E-418 stage acting, the queue, accounts and artifacts` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
