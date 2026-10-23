# Stage QA brief: E-419 stage 3 — sessions and disconnected

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` or `$B:h` as a modifier, and aborts the sealed subshell's `env` count). The run is local, on macOS (BSD tools; Chrome Headless Shell from the installed `playwright-core`). Binary formats are decoded with Node, never with `od` or `awk`.

## Stage

- Epic: E-419 (The phone and notifications, under R-377).
- Exact stage name: sessions and disconnected.
- Items, in plan order: two lanes. Lane 1: T-1172 (Sessions on the phone: the strip, the queue sheet and the page). Lane 2: T-1173 (the disconnected strip and nothing queued). The run reads the stage's members, counts and state from `task plan show E-419` (E419S3-00 and E419S3-14), never from a number written here. Findings fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- **The run starts only once both members are on dev.** At writing T-1173 had landed as `3b4e3be5` (its tree `ab510857` identical to its verified head `29222014`, whose mode-free run A-10199 passed every T1, T2 and Web file on Linux); dev was `d4d24ec8` (the tracker commit after that landing). T-1172 was in review at `89c0aed1` on `t/T-1172-sessions-on-the-phone-the-strip-the`, in a merge-with-dev round that resolves a `web/src/Shell.tsx` conflict with T-1173 (at writing the staged resolution kept both: the Disconnected strip and the Inbox "as of" beside T-1172's Sessions page and Back). E419S3-00 checks every landing through `task plan show E-419` and the first-parent log; a missing landing is BLOCKED, reported to the requester, with nothing else run.
- **Where the expectations come from.** Two kinds, kept apart in every row:
  - **Verified at writing** (T-1173, the desktop and the regression files): read at dev `d4d24ec8`. There `phone-disconnected.test.ts` and `connection.test.ts` ran clean in this brief's sealed setup, and the QA probe's T-1173, desktop and shared Sessions-page facts were observed. The other regression files were read there and passed in A-10199 at the same source tree.
  - **Read on the branch, grep at the build** (T-1172): written from its acceptance criteria and its branch head `89c0aed1` (plus the staged merge round at writing). That head can still change before landing. Every T-1172 name, label, selector, test name and count in this brief must be grep-checked at the tested build (E419S3-02 prints them; the rows say how a changed name is judged).
- Scope: the combined changed behaviour of the two items at the tested build.
  - T-1172, Sessions on the phone (§3.6, P27–P30; from the branch): below 640 px the Sessions header (`SessionsHeader.tsx`) shows only Waiting, Busy, Idle and Yours counts (`data-session-count`); the accounts strip (`AccountsStrip.tsx`/`.module.css`) is one row of 44 px cells (`data-account-cell`, `data-account-share`, a `meter`) in the registry's order, a dash without data, and a tap on a cell opens Accounts read-only; the verify line (`VerifyLine.tsx`) is a 44 px button with its one-line summary and a `›` chevron (`aria-haspopup="dialog"`) that opens the shared queue view in the shared `BottomSheet` (`BottomSheet.tsx`: new optional `fullHeight`, `data-full-height`) labelled **Verification queue**, full height, with **Close sheet**; Close or physical Escape returns focus to the summary. Rows stay T-1137's 52 px two-line rows with no row or swipe actions; groups fold as on the desktop. A tap opens the session page (`SessionPage.tsx`) full screen through the shell's phone page history (`Shell.tsx` `openPhonePage('Sessions', …)`), with model, account, usage and the complete command a waiting session waits on (`row.approvalCommand`), and Stop, Resume, Archive and Capabilities at least 44 px tall; Stop and Archive confirm in place; **Back to Sessions** and the browser's back return to the same row with its focus (`SessionRow.tsx`/`SessionGroups.tsx`: focus after a folded destination group commits open, the reviewer's M1). Escape on the page reaches the module (`phonePage.area !== 'Sessions'` in the shell's dismiss), so it cancels a pending confirmation before leaving. Desktop keeps its in-place queue, rows and drawer. Test-only: `hub/test/fakes/harness.ts` (`waitingForApproval(name, approvalCommand?)`). Files also: `Sessions.module.css`, `VerifyLine.module.css`, `BottomSheet.module.css`, `web/test/phone-sessions.test.ts`, `hub/test/tiers.json`, `web/README.md` (`### Phone Sessions`), `docs/agents/tests.md` (`### phone-sessions.test.ts`).
  - T-1173, the disconnected strip and nothing queued (§3.6, P41, P42; landed `3b4e3be5`): `connection.ts` exposes `disconnectedAt`, `nextAttemptAt`, `lastAppliedAt` and `retryNow` (a manual attempt that replaces the timer and any unfinished handshake and resets the backoff to 250 ms); below 640 px `Disconnected.tsx`/`.module.css` renders a strip under the header (`data-disconnected`): "Disconnected since 14:10 · retry in 8 s", counting down every 250 ms, with a 44 px **Retry** (Connecting during a handshake; Restart hub without Retry on a protocol refusal). The desktop keeps its hub dot. The last snapshot stays; the phone Inbox title adds "as of" with the time of the last applied frame; a reply's label row reads **unsent** (`data-reply-unsent`, `Composer.tsx`); ask options, the free answer, Decline, approval choices and both Send buttons are disabled. Nothing is queued: no command leaves the page while disconnected and none is replayed after reconnecting; drafts stay drafts. On reconnect the client resumes from its epoch and sequence (a fresh snapshot when refused), the strip goes and current rows show without a reload. Files: `Shell.tsx`, `web/test/phone-disconnected.test.ts`, `hub/test/tiers.json`, `web/README.md` (`### Phone disconnected`), `docs/agents/tests.md` (`### phone-disconnected.test.ts`).
- Affected regression: the desktop Sessions area at 1440 and 640 px (header, accounts strip, verify line in place, rows, actions, drawer, page); `connection.test.ts`'s reconnect and backoff (driven by `reconnectUntilLive`) and the desktop hub dot; E-419 stage 1–2 phone files (`phone`, `phone-more`, `phone-inbox`, `phone-asks`, `phone-approvals`, `phone-thread`, `phone-composer`, `phone-install`); the Inbox, asks, composer and Withdraw (T-1173 touched `Composer.tsx` and offline guards); the shell and key contexts (both items touched `Shell.tsx`); the hub T2 files that use the fake harness's `waitingForApproval` (T-1172 changed it); the typecheck with colour, contrast, HTML and hooks guards; the tier classifications.

Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

Criteria map (the stage verdict carries no item or epic marks; this tells the run which check proves what):

| criterion | proven by |
| --- | --- |
| T-1172 C1 (390×844: header counts, one accounts cell per account, two-line rows, no row action) | E419S3-07, E419S3-12 (`sessionsList`, `sessionsSwipe`), E419S3-02 |
| T-1172 C2 (the verify line opens the queue as a full-height sheet whose close returns to the list) | E419S3-07, E419S3-12 (`verifySheet`: the overlay and the visible sheet surface measured), E419S3-02 |
| T-1172 C3 (a waiting fake session's page full screen with its command; browser back returns to the same row) | E419S3-07, E419S3-12 (`waitingPage`) |
| T-1172 C4 (Stop on a busy fake session confirms, then stops it as `cland session list` reads; each action ≥44 px) | E419S3-07, E419S3-12 (`stopPage`, read back with `cland session list --json` against the scratch hub) |
| T-1172 C5 (a tap on an account cell opens Accounts read-only) | E419S3-07, E419S3-12 (`accountCell`) |
| T-1173 C1 (390×844 with the hub stopped: the strip shows when the socket dropped and a counting retry time; Retry starts an attempt at once) | E419S3-06, E419S3-12 (`strip`: the countdown and Retry's backoff reset), E419S3-02 |
| T-1173 C2 (the Inbox keeps its rows with "as of" and the time; ask options, approval buttons and Send disabled; the reply's label reads unsent) | E419S3-06, E419S3-12 (`offlineControls`, `offlineComposer`) |
| T-1173 C3 (a draft written while disconnected is not sent after the restart, as topic history reads, and stays in the composer) | E419S3-06, E419S3-12 (`offlineControls`, `offlineComposer`, `reconnect`: no queued or replayed command) |
| T-1173 C4 (after the restart the strip goes and an ask raised while disconnected shows without a reload) | E419S3-06, E419S3-12 (`reconnect`: document identity by `performance.timeOrigin` and a page marker, not navigation counts) |
| T-1173 C5 (`web/README.md` describes the disconnected state and why nothing is queued) | E419S3-04 |
| Desktop regression at 1440 and 640 px (Sessions area, actions, drawer and queue; the hub dot; reconnect and backoff) | E419S3-08, E419S3-09, E419S3-12 (`desktopSessions`, `desktopOffline`, `offlineWidths`) |
| Phone regression (E-419 stages 1–2) | E419S3-10 |

Not mapped to a check: T-1172's "red with the reset when limited" cell at phone width (no criterion names it and no phone test seeds a limit; the limited mark is desktop regression in `accounts.test.ts`, E419S3-09). Definition-of-done pointer (no marks): E-419's sessions and disconnected sentences (§3.6) are exercised by E419S3-06, E419S3-07 and E419S3-12; a real phone losing its network is the epic demo's job.

## Build

Use a clean detached worktree at dev at the SHA in the request (the full 40-hex SHA), created below. HEAD must equal that SHA and refs/heads/dev before and after running. All listed items must have merged onto dev: for every member that `task plan show E-419` lists in stage `sessions and disconnected`, `git log --first-parent --oneline --grep "Item: <id>" dev` prints exactly one commit. At writing T-1173 had landed as `3b4e3be5`; T-1172 had not (see "Stage"). Dev may also carry work landed after these items that is outside this stage; it is not judged here beyond the regression files named. A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no commit or run id of its own on purpose: committing a brief changes the tested tree.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step (the setup below does; the clean-tree checks ignore that one entry). Run E419S3-01's build before any Web file or the probe, or the shell never renders. The browser is the suite's Chrome Headless Shell under `node_modules/playwright-core/.local-browsers`: each named Web test file and the QA probe start and close their own through the Web harness (`web/test/harness.ts`, `webFixture`); every phone check uses the harness's phone context (`pageCase(…, { phone: true })`: 390×844, `hasTouch`, `isMobile`). No real browser, phone or other GUI process starts. The live hub is touched only by `quiet`, the Web harness's own read-only admission check and the plan reads of E419S3-00 and E419S3-14. Every session, ask, approval, message, verify holder and hub stop or restart comes from sealed scratch hubs started from `$W`'s own source, with fake Codex sessions (the hub's fake adapter), in-process fake spokes and a frame client as senders, never a real session, account or provider binary (see "Out of scope").

**The local test slot (cover-quiet).** No test may run while another session holds the live hub's local verify slot. The Coordinator's macOS stage cover for this stage (`verify all --occasion stage`, local) holds that slot for about 20 minutes, and it may still be running when this run starts. A wait for it is not BLOCKED: run the checks that need no slot first (E419S3-00 to E419S3-05: reads, greps, docs, the brief lint and the bundle build), then wait for the slot with `quiet` (it waits up to 45 minutes and prints the holder every 5 minutes) before E419S3-06. Only a slot still held after those 45 minutes with no change of holder is BLOCKED, reported to the requester with the holder line.

## Setup (once, before E419S3-00)

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree, runs `quiet`, the plan reads, reads the captures and records every check with `qa-record.sh`. **Every other command runs sealed** (rule 15) inside a subshell that sources `$Q/env.sh`: the full `fixtureEnvironment` result (`test-support/fixture-environment.ts`) after the scratch overlays (its synthesized HOME, XDG, Git, account and fake-harness paths included), which drops every `CLAND_*`, `GIT_*`, `XDG_*`, `CLAUDE_*`, `CODEX_*`, `FAKE_*`, provider and account variable while keeping `PATH`, `SHELL`, `TERM` and `TMPDIR`. Leave `TMPDIR` at the system default (on macOS `/var/folders/...`; never `/tmp`, T-1030). Never use `env -i`. The scratch root lives under `/private/tmp/qa-e419s3-` (its realpath). Never the live project's hub for anything but the reads named above and `quiet`; never the human's HOME, `~/.cland`, `~/.claude`, `~/.codex` or `~/.local/state`. Fixtures are fake only: the Web harness's sealed scratch projects and hubs, a scratch account registry with three fake Codex accounts read by a stub `accountReader`, fake Codex sessions launched through public frames, a fake Coordinator spoke asking and sending, a frame client holding a hand-run verify slot on the scratch hub, and the harness's stubbed `Notification`; no real session, account or provider binary.

In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<the full dev SHA from the request>
STAGE="sessions and disconnected"
RUN=qa-s3-$(date +%F)-1                        # unique run id for E-419; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e419s3-$RUN           # the clean detached build
EV=$R/.cland/qa/E-419/$RUN                     # captures (qa-record.sh keeps its evidence here too)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
Q=$(cd "$(mktemp -d /tmp/qa-e419s3-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/qa-e419s3-…
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data" "$Q/xdg/cache"
holder() { (cd "$W" && node hub/bin/cland.ts verify queue --json) | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);const h=v.holder;console.log(h?`${h.session??h.kind} ${h.occasion??"-"} ${h.executor??"-"} since ${h.since??"-"} waiters ${(v.waiters??[]).length}`:"none waiters "+(v.waiters??[]).length)})'; }
# quiet: wait (up to 45 minutes, a line every 5) until no session holds the local verify slot; a stage cover holds it ~20 minutes
quiet() { for i in $(seq 1 45); do h=$(holder) && case "$h" in "none "*) echo quiet; return 0;; esac; [ $((i % 5)) -eq 1 ] && echo "waiting for the local slot ($i min): $h"; sleep 60; done; echo "BLOCKED: the local verify slot is still held after 45 minutes: ${h:-queue read failed}"; return 1; }
# nt <id> <test files or node --test flags…>: named tests from $W, sealed, one file at a time, TAP output, after quiet; the log is $EV/<id>.log
nt() { id=$1; shift; quiet || return 1; ( . "$Q/env.sh"; cd "$W" && node --test --test-concurrency=1 --test-reporter=tap "$@" > "$EV/$id.log" 2>&1; echo "exit $?" >> "$EV/$id.log" ); tail -n 1 "$EV/$id.log"; grep -E '^# (tests|pass|fail|cancelled|skipped|todo) ' "$EV/$id.log"; grep -E '^ *not ok|# SKIP' "$EV/$id.log" | head -20; }
# oks <id>: the names on the passing (sub)test lines of $EV/<id>.log
oks() { grep -E '^ *ok [0-9]+ - ' "$EV/$1.log" | sed -E 's/^ *ok [0-9]+ - //'; }
# census <id>: the number of Web fixture census lines, then how many of them do not end cleanly
census() { grep -c -F 'Web fixture census' "$EV/$1.log"; grep -F 'Web fixture census' "$EV/$1.log" | grep -c -v 'after 0; scratch hub stopped'; }
# landed <id>: the full SHA of the commit that landed the item on dev (empty when it has not landed)
landed() { git -C "$W" log --first-parent --format=%H --grep "Item: $1" dev; }
# names <file>: the test and subtest names declared in a test file at the build
names() { grep -o -E "(^|[^.a-zA-Z])(test|t\.test)\((['\"\`])[^'\"\`]+" "$W/$1" | sed -E "s/^.*(test|t\.test)\(['\"\`]//"; }
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
grep -c '^unset ' "$Q/env.sh"; ( . "$Q/env.sh"; prefix_count=$(env | cut -d= -f1 | grep -c -E '^(CLAND_|DIGITALOCEAN_|ANTHROPIC_|OPENAI_|GH_|GITHUB_)'); echo "$prefix_count"; test "$prefix_count" -eq 0 ) || exit 1   # confirm 0 before any scratch process starts
```

The QA probe. `$Q/probe.test.mjs` is a one-test `node --test` file, independent of the items' own tests: one sealed scratch project and hub through the Web harness (`webFixture` with `timezoneId: 'UTC'`, a stub `accountReader` and a scratch `accounts.toml` of three Codex accounts `qa-main`, `qa-other` and `qa-empty`, the last without readings; `projectHub` with its fake adapters; the production socket and web edge serving `$W/web/dist`). It launches four fake Codex sessions through a frame client (`qa-mine` as an Aide, `qa-waiting` waiting on a 400-character command with model `gpt-qa-phone` and usage 125 tokens and $0.25, `qa-busy` busy, `qa-idle` idle; all on `qa-main`) and takes a hand-run verify slot on the scratch hub. Session lifecycle facts are read back with `cland session list --json` (and `--archived`) run against that scratch hub (`cland(fixture.root, …)` from `hub/test/harness.ts`), never the live one. Contexts, in order:
- **A** (phone; T-1172 C1–C5): `sessionsList` (counts, cells against the registry order from `account.list`, cell boxes, rows), `sessionsSwipe` (a CDP touch swipe across `qa-busy` opens nothing; Fold Idle hides and restores its row), `verifySheet` (taps the verify line; measures the dialog overlay **and** the visible sheet surface, the dialog's `section`, and its content block; Close, then physical Escape), `waitingPage` (both Back paths), `stopPage` (Stop, physical Escape cancels the confirmation, Stop and Confirm, Archive Cancel, Archive Confirm; the CLI status after each), `accountCell`. A `recover` helper returns to the Sessions list (Back to Sessions, else physical Escape, else the bar) so one missing control does not hide later facts; a recovery is recorded as `fallback` or `recovered`.
- **B** (desktop 1440, then 640): `desktopSessions` (header, cells, the verify line opening in place, the selected row's actions, the drawer, no page, the hub dot), then `desktopOffline` (stops the scratch hub: the dot offline, no strip, no "as of" at 640 and 1440; restarts it: live again with real timers).
- Then, on the restarted scratch hub: a fake Coordinator `coord` asks `QA offline ask?` in General and sends the decision `QA offline report`; a fake Codex session `qa-codex-off` raises the relayed approval `qa-offline-native`.
- **C** (phone; T-1173 C1–C4): `offlinePrep` (opens General once, returns to Inbox, types the reply draft `QA offline draft`, installs and pauses the page clock at 14:09 UTC, lets one frame apply, then sets the clock to 14:10 without running timers), `strip` (stops the scratch hub; the strip's place and text after each failed real attempt at 250, 500, 1000 and 2000 ms and one more second; Retry: an attempt at once, then none by 249 ms and one at 250 ms), `offlineControls` (the title's "as of", rows, the reply's unsent label, Send and draft, a forced reply `submit`, every ask and approval control, the "as of" again two seconds later), `offlineComposer` (General's composer while disconnected: a draft, Send, a forced `submit`), `offlineWidths` (640 and 1440: no strip, the desktop dot offline; back to 390), `reconnect` (restarts the scratch hub, raises `QA raised while offline?` before the page reconnects, `reconnectUntilLive`, then the strip, the draft, Send, the resume cursor, the new epoch, topic history, the new ask, the "as of" and document identity). Every `topic.send`, `topic.answer` and `approval.answer` frame the page sends in context C is collected as `mutations`.

It asserts nothing about the product: every fact goes to `$QA_OUT` as one JSON line; a step that throws writes `{"step":{name,error}}` and the probe goes on. The Web fixture's own cleanup writes the census line. **No reload is judged by document identity**: `performance.timeOrigin` read after the page clock is installed (Playwright's clock fakes it, so it is read under the same clock both times) and a `window.qaDocument` marker set on the same document, never by the navigation count (the phone's history entries count as navigations; `navigations` is printed for information only). **T-1172's steps were written from its criteria and branch head before it landed**: they find things by role, label, visible text and data attributes read on that branch (`Verification queue`, `aria-haspopup`, `›`, `Back to Sessions`, `history.state.clandPhonePage`, `data-session-count`, `data-account-cell`, `Confirm Stop qa-busy`, `Confirm Archive qa-busy`). E419S3-02 greps these at the build. If T-1172 names a control differently, correct only that selector in `$Q/probe.test.mjs`, keep the uncorrected capture and its log, label the correction in the record, and rerun the probe once; a selector correction is not a product finding.

```sh
cat > "$Q/probe.test.mjs" <<'JS'
// QA probe for E-419 stage 3 (node --test, sealed, cwd $QA_W): one sealed scratch hub through the Web harness, phone
// contexts (390x844, touch, mobile flag: `{ phone: true }`) and a desktop context (1440x900, resized to 640), fake Codex
// sessions and fake spokes as senders. It asserts nothing about the product: every fact goes to $QA_OUT as one JSON line
// {"fact": value}; a step that throws writes {"step": {name, error}} and the probe goes on.
import test from 'node:test';
import { appendFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const W = process.env.QA_W, OUT = process.env.QA_OUT;
const { webFixture, reconnectUntilLive } = await import(`${W}/web/test/harness.ts`);
const { cland, connectUi, inProcessSpoke } = await import(`${W}/hub/test/harness.ts`);
const out = (key, value) => appendFileSync(OUT, `${JSON.stringify({ [key]: value })}\n`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function step(name, body) { try { await body(); } catch (error) { out('step', { name, error: String(error?.message ?? error).slice(0, 400) }); } }
async function poll(read, done, ms = 3000) { let value = await read(); for (let i = 0; i < ms / 100 && !done(value); i++) { await sleep(100); value = await read(); } return value; }
const PHONE = { phone: true };
const physical = (page, code, modifiers = {}) => page.evaluate(({ code, modifiers }) => (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { code, key: 'ж', bubbles: true, cancelable: true, ...modifiers })), { code, modifiers });
const box = async locator => { if (!(await locator.count())) return null; const b = await locator.first().boundingBox(); return b && { x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10, width: Math.round(b.width * 10) / 10, height: Math.round(b.height * 10) / 10 }; };
const current = page => page.locator('main').getAttribute('aria-label');
const bar = page => page.getByRole('navigation', { name: 'Phone areas', exact: true });
const hubText = page => page.locator('[aria-label="Hub connection"]').first().textContent().then(text => text?.trim() ?? null);
const hubDot = page => page.locator('[aria-label="Hub connection"] [data-live]').first().getAttribute('data-live');
const phoneAttr = page => page.evaluate(() => document.querySelector('[data-phone]')?.getAttribute('data-phone') ?? null);
const width = page => page.evaluate(() => document.documentElement.scrollWidth);
const sessionPage = page => page.locator('[data-area-module="Sessions"][data-area-surface="page"]');
const inboxList = page => page.getByRole('list', { name: 'Inbox objects', exact: true });
const tokenColour = (locator, token) => locator.evaluate((node, token) => { const probe = document.createElement('span'); probe.style.color = `var(${token})`; node.append(probe); const colour = getComputedStyle(probe).color; probe.remove(); return colour; }, token);
async function recover(page) {
  const list = page.getByRole('list', { name: 'Sessions objects', exact: true });
  const back = page.getByRole('button', { name: 'Back to Sessions', exact: true });
  if (await back.count()) { await back.tap(); if (await poll(() => list.count(), v => v > 0)) return 'back'; }
  await physical(page, 'Escape');
  if (await poll(() => list.count(), v => v > 0)) return 'escape';
  await bar(page).getByRole('button', { name: 'Sessions', exact: true }).tap();
  return (await poll(() => list.count(), v => v > 0)) ? 'bar' : 'none';
}
const COMMAND = 'printf "' + 'the complete QA pending command '.repeat(12) + 'final argument"';
test('E-419 stage 3 QA probe', { timeout: 420000 }, async t => {
  const fixture = await webFixture(t, {
    timezoneId: 'UTC',
    accountReader: async account => account.name === 'qa-empty' ? [] : [
      { id: '5h', label: '5h', usedPercent: 38, resetsAt: '2026-10-24T22:00:00Z' },
      { id: 'wk', label: 'wk', usedPercent: 81, resetsAt: '2026-10-24T22:00:00Z' },
    ],
    prepare: async root => {
      for (const name of ['qa-main', 'qa-other', 'qa-empty']) await mkdir(join(root, name));
      await writeFile(join(process.env.XDG_CONFIG_HOME, 'cland/accounts.toml'), ['qa-main', 'qa-other', 'qa-empty'].map(name =>
        `[accounts.${name}]\nharness = "codex"\nhome = ${JSON.stringify(join(root, name))}`).join('\n'));
    },
  });
  // Seeds for T-1172: three registry accounts, four fake Codex sessions (Yours, Waiting with a command, Busy, Idle), a hand-run verify holder.
  const ui = await connectUi(t, fixture.hub.discovery);
  const polled = await ui.request({ type: 'account.poll' });
  const registry = ((await ui.request({ type: 'account.list' })).value?.accounts ?? []).map(a => `${a.harness}/${a.name}`);
  const launched = {};
  for (const [name, role, model] of [['qa-mine', 'aide'], ['qa-waiting', 'implementer', 'gpt-qa-phone'], ['qa-busy', 'implementer'], ['qa-idle', 'reviewer']]) {
    launched[name] = (await ui.request({ type: 'session.launch', name, role, harness: 'codex', account: 'qa-main', ...(model ? { model } : {}) })).ok;
  }
  const codex = fixture.fakes.codex;
  codex.waitingForApproval('qa-waiting', COMMAND);
  codex.feedUsage('qa-waiting', { total: { inputTokens: 100, outputTokens: 25, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 125, cost: 0.25 } });
  codex.busy('qa-busy');
  codex.idle('qa-idle');
  const holder = await connectUi(t, fixture.hub.discovery, 'cli');
  const slot = await holder.request({ type: 'suite.slot', mode: 'hub-only', cwd: fixture.root, head: 'qa-phone-head', pid: process.pid, token: 'qa-phone-hand-run' });
  const listed = async (name, archived = false) => {
    const result = await cland(fixture.root, 'session', 'list', ...(archived ? ['--archived'] : []), '--json');
    if (result.code !== 0) return { code: result.code };
    const row = (JSON.parse(result.stdout).processes ?? []).find(p => p.name === name);
    return row ? { status: row.status, archived: !!row.archivedAt } : null;
  };
  out('seededSessions', { poll: polled.ok, registry, launched, slot: slot.ok, busyCli: await listed('qa-busy') });
  // Context A (phone; T-1172 C1-C5): the Sessions screen, the queue sheet, the session page, Stop and an account cell.
  await fixture.pageCase(t, async page => {
    await step('sessionsList', async () => {
      await bar(page).getByRole('button', { name: 'Sessions', exact: true }).tap();
      await page.locator('[data-object-id="qa-idle"]').waitFor();
      const cells = page.locator('[data-account-cell]');
      const cellBoxes = await cells.evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { y: Math.round(r.y), height: Math.round(r.height * 10) / 10, left: Math.round(r.left), right: Math.round(r.right) }; }));
      const main = page.locator('[data-account-cell="codex/qa-main"]'), empty = page.locator('[data-account-cell="codex/qa-empty"]');
      const rows = {};
      for (const name of ['qa-mine', 'qa-waiting', 'qa-busy', 'qa-idle']) {
        const row = page.locator(`[data-object-id="${name}"]`);
        const lines = await row.locator('[data-session-role], [data-item-requested]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().y));
        rows[name] = { height: (await box(row))?.height ?? null, twoLines: lines.length === 2 && lines[1] > lines[0] };
      }
      out('sessionsList', { area: await current(page), counts: await page.locator('[data-session-count]').allTextContents(),
        cells: await cells.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-account-cell'))), registry, cellBoxes,
        oneRow: new Set(cellBoxes.map(b => b.y)).size === 1, mainText: (await main.innerText()).replace(/\s+/g, ' ').trim(), mainMeter: await main.getByRole('meter').getAttribute('aria-valuenow').catch(() => null),
        emptyShare: (await empty.locator('[data-account-share]').textContent())?.trim() ?? null, emptyMeters: await empty.getByRole('meter').count(),
        rows, visibleActions: await page.locator('[data-session-slot="groups"] [data-session-actions]:visible').count(), document: await width(page) });
    });
    await step('sessionsSwipe', async () => {
      const busy = await box(page.locator('[data-object-id="qa-busy"]'));
      const touch = await page.context().newCDPSession(page);
      try {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: busy.x + 30, y: busy.y + 24 }] });
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: busy.x + 250, y: busy.y + 24 }] });
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } finally { await touch.detach(); }
      await sleep(300);
      const fold = page.getByRole('button', { name: 'Fold Idle', exact: true });
      await fold.tap();
      const idleHidden = !(await page.locator('[data-object-id="qa-idle"]').isVisible());
      await fold.tap();
      out('sessionsSwipe', { page: await sessionPage(page).count(), visibleActions: await page.locator('[data-session-slot="groups"] [data-session-actions]:visible').count(), cli: await listed('qa-busy'),
        idleHidden, idleBack: await poll(() => page.locator('[data-object-id="qa-idle"]').isVisible(), v => v) });
    });
    await step('verifySheet', async () => {
      const slotNode = page.locator('[data-session-slot="verification"]');
      const line = slotNode.locator('button').first();
      const summary = await poll(() => slotNode.innerText(), v => /verify: human/.test(v ?? ''));
      const result = { summary: summary.replace(/\s+/g, ' ').trim(), line: await box(line), chevron: (await line.innerText()).includes('›'), haspopup: await line.getAttribute('aria-haspopup') };
      await line.tap();
      const sheet = page.getByRole('dialog', { name: 'Verification queue', exact: true });
      result.dialog = await poll(() => sheet.count(), v => v > 0);
      result.inPlaceTable = await slotNode.getByRole('table', { name: 'Verification queue', exact: true }).count();
      if (result.dialog) {
        await sheet.getByRole('table', { name: 'Verification queue', exact: true }).waitFor();
        const surface = sheet.locator(':scope > section');
        result.overlay = await box(sheet);
        result.surface = await box(surface);
        result.content = await box(surface.locator(':scope > div'));
        result.surfacePanel = (await surface.evaluate(node => getComputedStyle(node).backgroundColor)) === await tokenColour(surface, '--panel');
        result.modal = await sheet.evaluate(node => node.matches(':modal'));
        result.row = (await sheet.locator('[data-verification-row]').first().textContent())?.replace(/\s+/g, ' ').trim() ?? null;
        const close = sheet.getByRole('button', { name: 'Close sheet', exact: true });
        result.closeHeight = (await box(close))?.height ?? null;
        await close.tap();
        result.closed = (await poll(() => sheet.count(), v => v === 0)) === 0;
        result.listVisible = await page.getByRole('list', { name: 'Sessions objects', exact: true }).isVisible();
        result.focusAfterClose = await line.evaluate(node => node === document.activeElement);
        await line.tap();
        await sheet.waitFor();
        await physical(page, 'Escape');
        result.escapeClosed = (await poll(() => sheet.count(), v => v === 0)) === 0;
        result.focusAfterEscape = await line.evaluate(node => node === document.activeElement);
      } else if (result.inPlaceTable) await line.tap();
      out('verifySheet', result);
    });
    await step('waitingPage', async () => {
      const row = page.locator('[data-object-id="qa-waiting"]');
      const detail = sessionPage(page);
      const result = {};
      for (const back of ['button', 'browser']) {
        await row.tap();
        const shown = await poll(() => detail.count(), v => v > 0);
        const facts = { page: shown };
        if (shown) {
          const text = await detail.innerText();
          facts.missing = ['gpt-qa-phone', 'qa-main', '125 tok', '$0.25', 'waiting for approval'].filter(fact => !text.includes(fact));
          facts.command = (await detail.locator('code').allTextContents()).includes(COMMAND);
          facts.commandFits = await detail.locator('code').evaluateAll((nodes, command) => nodes.filter(n => n.textContent === command).every(n => { const r = n.getBoundingClientRect(); return r.right <= 390.5 && n.scrollWidth <= n.clientWidth + 1; }), COMMAND);
          facts.box = await box(detail);
          facts.list = await page.getByRole('list', { name: 'Sessions objects', exact: true }).count();
          facts.secondary = await page.locator('[data-pane="secondary"]').count();
          facts.document = await width(page);
          const control = page.getByRole('button', { name: 'Back to Sessions', exact: true });
          facts.backHeight = (await box(control))?.height ?? null;
          facts.historyEntry = await page.evaluate(() => history.state?.clandPhonePage?.area ?? null);
          if (back === 'browser' && facts.historyEntry === 'Sessions') await page.goBack();
          else if (back === 'button' && facts.backHeight !== null) await control.tap();
          else facts.fallback = await recover(page);
          await row.waitFor();
          facts.focused = (await poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-object-id') ?? null), v => v === 'qa-waiting')) === 'qa-waiting';
          facts.pressed = await row.getAttribute('aria-pressed');
          facts.pageGone = await detail.count() === 0;
          facts.area = await current(page);
        }
        result[back] = facts;
      }
      out('waitingPage', result);
    });
    await step('stopPage', async () => {
      const detail = sessionPage(page);
      const height = async (scope, name) => (await box(scope.getByRole('button', { name, exact: true })))?.height ?? null;
      if (await sessionPage(page).count()) await recover(page);
      await page.locator('[data-object-id="qa-busy"]').tap();
      await detail.getByRole('button', { name: 'Stop', exact: true }).waitFor();
      const result = { before: await listed('qa-busy'), heights: { Stop: await height(detail, 'Stop'), Capabilities: await height(detail, 'Capabilities') } };
      await detail.getByRole('button', { name: 'Stop', exact: true }).tap();
      const confirm = detail.getByRole('group', { name: 'Confirm Stop qa-busy', exact: true });
      await confirm.waitFor();
      result.pending = await listed('qa-busy');
      result.heights.Confirm = await height(confirm, 'Confirm');
      result.heights.Cancel = await height(confirm, 'Cancel');
      await physical(page, 'Escape');
      result.escape = { confirm: await poll(() => confirm.count(), v => v === 0), page: await detail.isVisible(), cli: await listed('qa-busy') };
      await detail.getByRole('button', { name: 'Stop', exact: true }).tap();
      await confirm.waitFor();
      const resumed = detail.getByRole('button', { name: 'Resume', exact: true }).waitFor({ timeout: 5000 });
      await confirm.getByRole('button', { name: 'Confirm', exact: true }).tap();
      await resumed;
      result.after = await poll(() => listed('qa-busy'), v => v?.status === 'stopped');
      result.heights.Resume = await height(detail, 'Resume');
      result.heights.Archive = await height(detail, 'Archive');
      await detail.getByRole('button', { name: 'Archive', exact: true }).tap();
      const archive = detail.getByRole('group', { name: 'Confirm Archive qa-busy', exact: true });
      await archive.waitFor();
      await archive.getByRole('button', { name: 'Cancel', exact: true }).tap();
      result.archiveCancelled = await listed('qa-busy');
      await detail.getByRole('button', { name: 'Archive', exact: true }).tap();
      await archive.waitFor();
      const gone = detail.getByRole('button', { name: 'Archive', exact: true }).waitFor({ state: 'detached', timeout: 5000 });
      await archive.getByRole('button', { name: 'Confirm', exact: true }).tap();
      await gone;
      result.archived = await poll(() => listed('qa-busy', true), v => v?.archived === true);
      result.pageVisible = await detail.isVisible();
      out('stopPage', result);
    });
    await step('accountCell', async () => {
      const recovered = await sessionPage(page).count() ? await recover(page) : 'list';
      await page.locator('[data-object-id="qa-idle"]').waitFor();
      await page.locator('[data-account-cell="codex/qa-main"]').tap();
      const accounts = page.locator('[data-area-module="Accounts"]');
      await accounts.locator('[data-account-id="codex/qa-main"]').waitFor();
      out('accountCell', { recovered, area: await current(page), account: await accounts.locator('[data-account-id="codex/qa-main"]').count(),
        controls: await accounts.locator('input, select, textarea, [role="switch"]').count(), buttons: await page.getByRole('button', { name: /clear|edit|revoke/i }).count(), document: await width(page) });
    });
  }, undefined, PHONE);
  // Context B (desktop 1440, then 640): the Sessions area, actions, drawer and queue keep their desktop form; the hub dot offline.
  await fixture.pageCase(t, async page => {
    await step('desktopSessions', async () => {
      const result = {};
      await page.getByRole('button', { name: 'Sessions', exact: true }).click();
      for (const size of [1440, 640]) {
        if (size === 640) { await page.setViewportSize({ width: 640, height: 900 }); await poll(() => phoneAttr(page), v => v === 'false'); }
        await page.locator('[data-object-id="qa-idle"]').waitFor();
        const slotNode = page.locator('[data-session-slot="verification"]');
        const toggle = slotNode.locator('[data-fold-toggle]').first();
        const facts = { phone: await phoneAttr(page), rail: await page.locator('nav[aria-label="Areas"]').count(), bar: await bar(page).count(), counts: await page.locator('[data-session-count]').allTextContents(),
          cells: await page.locator('[data-account-cell]').count(), haspopup: await toggle.getAttribute('aria-haspopup') };
        await toggle.click();
        facts.inPlace = await poll(() => slotNode.getByRole('table', { name: 'Verification queue', exact: true }).count(), v => v > 0);
        facts.dialogs = await page.locator('dialog[open]').count();
        await toggle.click();
        facts.refolded = await poll(() => slotNode.getByRole('table', { name: 'Verification queue', exact: true }).count(), v => v === 0);
        await page.locator('[data-object-id="qa-idle"]').click();
        await page.locator('[data-session-detail="qa-idle"]').waitFor();
        facts.pressed = await page.locator('[data-object-id="qa-idle"]').getAttribute('aria-pressed');
        facts.actions = await page.locator('[data-session-detail="qa-idle"] [data-session-actions] button').allInnerTexts();
        facts.drawer = await page.getByRole('complementary', { name: 'Drawer', exact: true }).count();
        facts.drawerSession = await page.locator('[data-area-surface="drawer"]').first().getAttribute('data-session-thread').catch(() => null);
        facts.page = await sessionPage(page).count();
        facts.dot = await hubDot(page);
        facts.strip = await page.locator('[data-disconnected]').count();
        result[size] = facts;
      }
      out('desktopSessions', result);
    });
    await step('desktopOffline', async () => {
      await fixture.hub.stop(); await fixture.hub.stopped;
      const result = { text: await poll(() => hubText(page), v => v === 'Offline') };
      for (const size of [640, 1440]) {
        await page.setViewportSize({ width: size, height: 900 });
        await poll(() => phoneAttr(page), v => v === 'false');
        result[size] = { phone: await phoneAttr(page), dot: await hubDot(page), text: await hubText(page), strip: await page.locator('[data-disconnected]').count(), asOf: await page.getByText(/as of \d/).count() };
      }
      await fixture.restartHub();
      result.live = await poll(() => hubText(page), v => v === 'Live', 15000);
      result.dotAfter = await hubDot(page);
      result.stripAfter = await page.locator('[data-disconnected]').count();
      out('desktopOffline', result);
    });
  });
  // Seeds for T-1173 on the restarted scratch hub: an ask, a decision message and a relayed Codex approval in Inbox.
  const ui2 = await connectUi(t, fixture.hub.discovery);
  const coord = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', role: 'coordinator', sessionId: 'qa-e419s3-coord' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const askO = (await coord.call('ask', { topic: 'general', question: 'QA offline ask?', options: ['Keep', 'Wait'], free: true })).ask;
  const sentO = await coord.call('send', { topic: 'general', text: 'QA offline report', kind: 'decision' });
  const launchedO = await ui2.request({ type: 'session.launch', name: 'qa-codex-off', harness: 'codex' });
  fixture.fakes.codex.raiseApproval('qa-codex-off', { id: 'qa-offline-native', kind: 'command', subject: { command: 'echo qa-offline' }, choices: ['once', 'always', 'deny'], answerIn: 'hub' });
  const inbox = async () => (await ui2.request({ type: 'inbox.list' })).value;
  const seeded = await poll(inbox, v => v?.asks?.some(r => r.id === askO) && v?.approvals?.some(r => r.id.endsWith(':qa-offline-native')) && v?.messages?.some(m => m.text === 'QA offline report'));
  const approvalO = seeded?.approvals?.find(r => r.id.endsWith(':qa-offline-native'))?.id;
  const messageO = seeded?.messages?.find(m => m.text === 'QA offline report')?.id;
  out('seededOffline', { ask: !!askO, message: sentO.ok && !!messageO, launched: launchedO.ok, approval: !!approvalO });
  // Context C (phone; T-1173 C1-C4): the strip, the retained snapshot, disabled controls, no queue and the reconnect.
  const mutations = [], frames = [], sockets = [];
  let navigations = 0;
  await fixture.pageCase(t, async page => {
    const strip = page.locator('[data-disconnected]');
    const stripText = async () => (await strip.count()) ? (await strip.innerText()).replace(/\s+/g, ' ').trim() : null;
    const title = page.locator('[data-pane="primary"] > [data-fold-block] > header');
    const reply = page.locator('[data-inbox-reply]');
    const composer = page.getByRole('form', { name: 'Composer', exact: true });
    const failed = async count => { await poll(() => sockets.length > count && sockets[sockets.length - 1].closed, v => v); return sockets.length > count && sockets[sockets.length - 1].closed; };
    let documentTime = null, cursor = null, liveRows = null;
    await step('offlinePrep', async () => {
      await poll(() => hubText(page), v => v === 'Live');
      await bar(page).getByRole('button', { name: 'Topics', exact: true }).tap();
      await page.getByRole('list', { name: 'Topics objects', exact: true }).locator('[data-object-id="general"]').tap();
      await composer.waitFor();
      await page.getByRole('button', { name: 'Back to Topics', exact: true }).tap();
      await bar(page).getByRole('button', { name: 'Inbox', exact: true }).tap();
      await inboxList(page).locator(`[data-object-id="${askO}"]`).waitFor();
      await inboxList(page).locator(`[data-object-id="${messageO}"]`).tap();
      await reply.getByRole('textbox').fill('QA offline draft');
      await page.clock.install({ time: new Date('2026-10-23T14:09:00Z') });
      await page.clock.pauseAt(new Date('2026-10-23T14:09:00Z'));
      documentTime = await page.evaluate(() => { window.qaDocument = 'qa-e419s3'; return performance.timeOrigin; });
      const marker = frames.length;
      await coord.call('send', { topic: 'general', text: 'QA as-of marker' });
      await poll(() => frames.slice(marker).some(frame => JSON.stringify(frame).includes('QA as-of marker')), v => v);
      await sleep(300);
      liveRows = await inboxList(page).locator('[data-object-id]').count();
      await page.clock.setSystemTime(new Date('2026-10-23T14:10:00Z'));
      out('offlinePrep', { live: await hubText(page), liveRows, reply: await reply.getByRole('textbox').inputValue(), strip: await strip.count(), asOf: await title.getByText(/as of/).count() });
    });
    await step('strip', async () => {
      await fixture.hub.stop(); await fixture.hub.stopped;
      const result = { text: await poll(() => hubText(page), v => v === 'Offline'), dot: await hubDot(page) };
      cursor = frames.filter(frame => frame.dir === 'in' && frame.epoch !== undefined && frame.seq !== undefined && frame.type !== 'snapshot').at(-1) ?? null;
      const retry = strip.getByRole('button', { name: 'Retry', exact: true });
      const header = await box(page.locator('header').first()), s = await box(strip), r = await box(retry);
      Object.assign(result, { strip: await strip.count(), underHeader: !!(header && s) && Math.abs(s.y - (header.y + header.height)) < 1, width: s?.width ?? null, retry: r && { height: r.height, width: r.width },
        since: await strip.locator('time').textContent().catch(() => null), sinceIso: await strip.locator('time').getAttribute('datetime').catch(() => null) });
      const texts = [await stripText()];
      for (const delay of [250, 500, 1000, 2000]) {
        const count = sockets.length;
        await page.clock.runFor(delay);
        if (!(await failed(count))) texts.push(`no failed attempt after ${delay} ms`);
        texts.push(await stripText());
      }
      await page.clock.runFor(1000);
      texts.push(await stripText());
      result.texts = texts;
      const before = sockets.length;
      const opened = page.waitForEvent('websocket', { timeout: 3000 }).then(() => true, () => false);
      await retry.tap();
      result.immediate = await opened;
      result.retryFailed = await failed(before);
      result.afterRetry = await stripText();
      await page.clock.runFor(249);
      result.attemptsBy249 = sockets.length - before;
      await page.clock.runFor(1);
      result.attemptsBy250 = (await poll(() => sockets.length - before, v => v >= 2)) ;
      await failed(before + 1);
      out('strip', result);
    });
    await step('offlineControls', async () => {
      const header = (await title.innerText()).replace(/\s+/g, ' ').trim();
      const result = { title: header, asOf: header.match(/as of (\d\d:\d\d)/)?.[1] ?? null, asOfIso: await title.locator('time').getAttribute('datetime').catch(() => null),
        rows: await inboxList(page).locator('[data-object-id]').count(), liveRows,
        unsent: await reply.locator('[data-reply-unsent]').count(), replyText: /unsent/.test(await reply.innerText()), replySendDisabled: await reply.locator('[data-composer-send]').isDisabled(), replyDraft: await reply.getByRole('textbox').inputValue() };
      await reply.evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      await inboxList(page).locator(`[data-object-id="${askO}"]`).tap();
      const ask = page.getByRole('dialog', { name: 'Answer ask', exact: true });
      await ask.waitFor();
      const askControls = ask.locator('[data-ask-option], input, textarea, [data-ask-decline], [data-ask-send]');
      result.ask = { controls: await askControls.count(), disabled: (await askControls.evaluateAll(nodes => nodes.map(n => n.disabled))).filter(Boolean).length };
      await ask.getByRole('button', { name: 'Close sheet', exact: true }).tap();
      await ask.waitFor({ state: 'hidden' });
      await inboxList(page).locator(`[data-object-id="${approvalO}"]`).tap();
      const sheet = page.getByRole('dialog', { name: 'Command approval', exact: true });
      await sheet.waitFor();
      const approvalControls = sheet.locator('[data-approval-choice], [data-approval-deny], input, textarea');
      result.approval = { controls: await approvalControls.count(), disabled: (await approvalControls.evaluateAll(nodes => nodes.map(n => n.disabled))).filter(Boolean).length };
      await sheet.getByRole('button', { name: 'Close sheet', exact: true }).tap();
      await sheet.waitFor({ state: 'hidden' });
      await page.clock.runFor(2000);
      result.asOfLater = (await title.innerText()).match(/as of (\d\d:\d\d)/)?.[1] ?? null;
      result.since = await strip.locator('time').textContent().catch(() => null);
      result.mutations = [...mutations];
      out('offlineControls', result);
    });
    await step('offlineComposer', async () => {
      await bar(page).getByRole('button', { name: 'Topics', exact: true }).tap();
      await page.getByRole('list', { name: 'Topics objects', exact: true }).locator('[data-object-id="general"]').tap();
      await composer.waitFor();
      const field = composer.getByRole('textbox', { name: 'Message text', exact: true });
      const shared = await field.inputValue();
      await field.fill('QA offline composer draft');
      const result = { shared, sendDisabled: await composer.locator('[data-composer-send]').isDisabled(), strip: await strip.count() };
      await composer.evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      await sleep(200);
      result.mutations = [...mutations];
      out('offlineComposer', result);
    });
    await step('offlineWidths', async () => {
      const result = {};
      for (const size of [640, 1440, 390]) {
        await page.setViewportSize({ width: size, height: 844 });
        await poll(() => phoneAttr(page), v => v === String(size < 640));
        result[size] = { phone: await phoneAttr(page), strip: await strip.count(), dot: await hubDot(page), text: await hubText(page), rail: await page.locator('nav[aria-label="Areas"]').count() };
      }
      out('offlineWidths', result);
    });
    await step('reconnect', async () => {
      await fixture.restartHub();
      const ui3 = await connectUi(t, fixture.hub.discovery);
      const raiser = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', role: 'coordinator', sessionId: 'qa-e419s3-coord-2' });
      t.after(() => raiser.close());
      await raiser.waitForPresence(['coord']);
      const askNew = (await raiser.call('ask', { topic: 'general', question: 'QA raised while offline?', options: ['Now', 'Later'] })).ask;
      const stillOffline = await hubText(page);
      await reconnectUntilLive(page);
      const field = composer.getByRole('textbox', { name: 'Message text', exact: true });
      const hello = frames.filter(frame => frame.dir === 'out' && frame.type === 'hello').at(-1);
      const end = frames.filter(frame => frame.dir === 'in' && frame.type === 'snapshot.end').at(-1);
      const history = (await ui3.request({ type: 'topic.history', topic: 'general' })).value?.messages ?? [];
      const result = { stillOffline, live: await hubText(page), strip: await strip.count(), draft: await field.inputValue(), sendEnabled: !(await composer.locator('[data-composer-send]').isDisabled()),
        resume: hello?.resume && cursor ? hello.resume.epoch === cursor.epoch && hello.resume.seq === cursor.seq : null, newEpoch: end && cursor ? end.epoch !== cursor.epoch : null,
        historyDrafts: history.filter(m => /QA offline (composer )?draft/.test(m.text ?? '')).length, askOpen: history.find(m => m.id === askO)?.ask?.state ?? null };
      await page.clock.runFor(1000);
      await bar(page).getByRole('button', { name: 'Inbox', exact: true }).tap();
      const fresh = await poll(() => inboxList(page).locator(`[data-object-id="${askNew}"]`).count(), v => v > 0);
      Object.assign(result, { freshAsk: fresh, oldAsk: await inboxList(page).locator(`[data-object-id="${askO}"]`).count(), asOf: await title.getByText(/as of/).count(),
        mutations: [...mutations], sameDocument: await page.evaluate(() => performance.timeOrigin) === documentTime, marker: await page.evaluate(() => window.qaDocument ?? null), navigations });
      out('reconnect', result);
    });
  }, page => {
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
    page.on('websocket', socket => {
      const entry = { closed: false };
      sockets.push(entry);
      socket.once('close', () => { entry.closed = true; });
      socket.on('framesent', event => { const frame = JSON.parse(String(event.payload)); frames.push({ ...frame, dir: 'out' }); if (['topic.send', 'topic.answer', 'approval.answer'].includes(frame.type)) mutations.push(frame.type); });
      socket.on('framereceived', event => { try { frames.push({ ...JSON.parse(String(event.payload)), dir: 'in' }); } catch {} });
    });
  }, PHONE);
});
JS
node --check "$Q/probe.test.mjs" && echo "probe parses"
```

The check functions. Define them in QA's own shell (paste the block once). Each runs where its table row says, writes its captures under `$EV` and prints the facts the `expected` column judges.

```sh
k00() {   # QA shell: build, merges, plan, the stage's files, paths outside web/ and docs/, sealing
  git -C "$W" rev-parse HEAD refs/heads/dev
  git -C "$W" status --porcelain | grep -v -x -F '?? node_modules' | wc -l
  readlink "$W/node_modules"
  (cd "$W" && node hub/bin/cland.ts task plan show E-419 --json) > "$EV/E419S3-00-plan.json"
  node -e 'const [f,n]=process.argv.slice(1);const v=JSON.parse(require("fs").readFileSync(f,"utf8"));const s=v.stages.find(x=>x.name===n);console.log(JSON.stringify({stages: v.stages.map(x=>x.name), state: s.state, qa: s.qa, merged: s.merged, total: s.total, items: s.items}))' "$EV/E419S3-00-plan.json" "$STAGE" | tee "$EV/E419S3-00-stage.txt"
  for i in $(node -e 'const [f,n]=process.argv.slice(1);console.log(JSON.parse(require("fs").readFileSync(f,"utf8")).stages.find(x=>x.name===n).items.join(" "))' "$EV/E419S3-00-plan.json" "$STAGE"); do echo "== $i"; git -C "$W" log --first-parent --oneline --grep "Item: $i" dev; done
  ls "$W/web/src/Disconnected.tsx" "$W/web/src/Disconnected.module.css" "$W/web/test/phone-disconnected.test.ts" "$W/web/test/phone-sessions.test.ts" "$W/web/src/sessions/VerifyLine.tsx" "$W/web/src/BottomSheet.tsx" "$W/web/test/harness.ts"
  for i in T-1172 T-1173; do c=$(landed "$i"); echo "== $i paths outside web/ and docs/"; [ -n "$c" ] && git -C "$W" show --format= --name-only "$c" | grep -v -E '^(web/|docs/)'; done
  for i in T-1172 T-1173; do c=$(landed "$i"); echo "== $i files"; [ -n "$c" ] && git -C "$W" show --format= --name-only "$c"; done
  echo "TMPDIR=$TMPDIR Q=$Q"
}
k02() {   # QA shell: the connection and strip (T-1173), the merged Shell, Sessions on the phone (T-1172), the probe's selectors and test names
  c() { printf '%s %s: %s\n' "$(cat "$W/$1" 2>/dev/null | grep -c -F -- "$2")" "$1" "$2"; }   # 0 also when the file is missing
  echo "-- verified at writing (T-1173 and the harness at d4d24ec8)"
  c web/src/connection.ts 'function retryNow() {'
  c web/src/connection.ts 'state = { ...state, lastAppliedAt: Date.now() };'
  c web/src/connection.ts 'disconnectedAt: state.disconnectedAt ?? Date.now(), nextAttemptAt: stopped ? undefined : Date.now() + backoff'
  c web/src/Disconnected.tsx 'export function Disconnected({ connection, since }'
  c web/src/Disconnected.tsx '<div data-disconnected className={s.strip}>'
  c web/src/Disconnected.tsx 'retry in ${Math.max(0, Math.ceil((connection.nextAttemptAt - now) / 1000))} s'
  c web/src/Disconnected.tsx '<button onClick={connection.retryNow}>Retry</button>'
  c web/src/Disconnected.module.css 'min-height: 44px;'
  c web/src/Composer.tsx '{reply && !connection.live && <span data-reply-unsent>unsent</span>}'
  c web/src/Composer.tsx '<button data-composer-send disabled={!connection.live || !!pending || !text.trim()}>Send</button>'
  c web/src/Shell.tsx '{phone && !connection.live && connection.disconnectedAt !== undefined && <Disconnected connection={connection} since={connection.disconnectedAt} />}'
  c web/src/Shell.tsx "paneArea === 'Inbox' && connection.lastAppliedAt !== undefined && <span>as of <time"
  c web/test/harness.ts 'export async function reconnectUntilLive(page: Page): Promise<void> {'
  c web/test/connection.test.ts 'await reconnectUntilLive(page);'
  c web/test/phone-disconnected.test.ts 'await reconnectUntilLive(page);'
  c web/test/phone-disconnected.test.ts "await page.evaluate(() => performance.timeOrigin), documentTime, 'same document after reconnection and navigation'"
  echo "-- read on the branch (T-1172 at 89c0aed1): grep at the build"
  c web/src/sessions/SessionsHeader.tsx "['Waiting', 'Busy', 'Idle', 'Yours']"
  c web/src/sessions/VerifyLine.tsx '<BottomSheet label="Verification queue" header={<span>Verification queue</span>} close={() => setSheet(false)} fullHeight>'
  c web/src/sessions/VerifyLine.tsx 'aria-haspopup="dialog"'
  c web/src/sessions/VerifyLine.tsx '<span aria-hidden="true">›</span>'
  c web/src/BottomSheet.tsx 'fullHeight = false }'
  c web/src/BottomSheet.tsx 'data-full-height={fullHeight || undefined}'
  c web/src/BottomSheet.module.css '.sheet[data-full-height] { flex: 1; border: 0; border-radius: 0; }'
  c web/src/sessions/AccountsStrip.module.css '.strip { flex-wrap: nowrap; gap: 5px; padding: 6px 0; }'
  c web/src/sessions/SessionPage.tsx '{row.approvalCommand && <pre className={s.waitingCommand}><code>{row.approvalCommand}</code></pre>}'
  c web/src/sessions/SessionRow.tsx 'if (!selected || !groupOpen || !isPhone()) return;'
  c web/src/Shell.tsx "phonePage.area !== 'Sessions' && (action === 'dismiss' || action === 'tree-close')"
  c web/src/Shell.tsx "(paneArea === 'Items' || paneArea === 'Artifacts' || paneArea === 'Sessions')"
  c web/src/Shell.tsx "if (phone && (paneArea === 'Artifacts' || paneArea === 'Topics' || paneArea === 'Sessions')) { openPhonePage(paneArea, id); return; }"
  c hub/test/fakes/harness.ts 'waitingForApproval(name: string, approvalCommand?: string): void'
  echo "-- the merged Shell.tsx keeps both items"
  c web/src/Shell.tsx "import { Disconnected, connectionTime } from './Disconnected.tsx';"
  c web/src/Shell.tsx "{ area: 'Items' | 'Artifacts' | 'Topics' | 'Sessions'; id: string }"
  echo "-- colour values outside tokens.css in the stage's styles"
  git -C "$W" grep -n -E "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(" -- web/src/Disconnected.module.css web/src/BottomSheet.module.css web/src/sessions/AccountsStrip.module.css web/src/sessions/Sessions.module.css web/src/sessions/VerifyLine.module.css web/src/Composer.module.css
  echo "-- probe selectors (each count at least 1)"; for a in data-disconnected data-reply-unsent data-composer-send data-inbox-reply data-account-cell data-account-share data-session-count data-session-slot data-session-actions data-session-detail data-session-thread data-fold-toggle data-area-surface data-verification-row data-phone-composer data-full-height; do printf '%s %s\n' "$(git -C "$W" grep -c -F -- "$a" -- web/src | awk -F: '{n+=$2} END {print n+0}')" "$a"; done
  echo "-- test names at the build"; for f in web/test/phone-disconnected.test.ts web/test/phone-sessions.test.ts web/test/connection.test.ts; do echo "== $f"; names "$f"; done
}
k03() {   # QA shell: AGENTS.md web/ rules at the build
  git -C "$W" grep -n -E "keydown|keyup|keypress|onKey(Down|Up|Press)" -- web/src
  git -C "$W" grep -n -E "localStorage|sessionStorage" -- web/src
  git -C "$W" grep -n -E "dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML" -- web/src
  git -C "$W" grep -n -E "addEventListener\('(touch|pointer)(start|move|end)" -- web/src
  for i in T-1172 T-1173; do c=$(landed "$i"); echo "== $i"; [ -n "$c" ] && git -C "$W" show --format= "$c" -- package.json package-lock.json web/package.json hub/package.json nvim/package.json | grep -E '^[+-] '; done
}
k04() {   # docs, in QA's own shell
  ( cd "$W" || exit 1
    chk() { printf '%s present %s: %s\n' "$(grep -c -F -- "$2" "$1")" "$1" "$2"; }
    echo "-- web/README.md Phone headings, in file order"; grep -n -E '^#{2,3} ' web/README.md | sed -n '/## Phone$/,/## Components and colours/p'
    echo "-- docs/agents/tests.md phone headings, in file order"; grep -n -E '^#{2,3} ' docs/agents/tests.md | grep -E 'phone-|## Human marks fixtures'
    echo "-- T-1173 C5 (verified at writing)"
    chk web/README.md '### Phone disconnected'
    chk web/README.md 'When the socket drops, a strip under the header shows “Disconnected since'
    chk web/README.md 'and resets the backoff to 250 ms. During a handshake it reads Connecting.'
    chk web/README.md 'The desktop keeps its hub dot.'
    chk web/README.md 'local time of the last applied frame; a reply’s label row reads unsent. Ask'
    chk web/README.md 'Nothing is queued or replayed after reconnecting: another client may already'
    chk web/README.md 'snapshot when the hub cannot resume it. The strip disappears and current rows'
    chk docs/agents/tests.md '### phone-disconnected.test.ts'
    chk docs/agents/tests.md '`web/test/phone-disconnected.test.ts` uses the sealed 390×844 touch/mobile'
    echo "-- T-1172 (read on the branch; no docs criterion)"
    chk web/README.md '### Phone Sessions'
    chk web/README.md 'Sessions shows Waiting, Busy, Idle and Yours counts above one row of account'
    chk web/README.md 'The `verify:` summary opens the shared queue in a full-height `BottomSheet`.'
    chk web/README.md 'Tapping a session opens its page in the single pane, with model, account, usage'
    chk web/README.md 'place; Escape cancels the confirmation before leaving the page.'
    chk docs/agents/tests.md '### phone-sessions.test.ts'
    chk docs/agents/tests.md '`web/test/phone-sessions.test.ts` uses the sealed 390×844 touch/mobile'
    for i in T-1172 T-1173; do c=$(landed "$i"); echo "== $i docs diff"; [ -n "$c" ] && git show --format= "$c" -- web/README.md docs/agents/tests.md | grep -E '^[+-][^+-]' | cut -c1-200; done
    echo "-- statements to read against the implementation (candidates for low findings)"
    grep -n -F -e 'toggle the queue in place' -e 'in-place queue' -e 'hub dot' -e 'Offline, ' web/README.md | cut -c1-200
    grep -n -i -E 'not yet|until (E-41[0-9]|T-11[0-9][0-9]) lands|next ticket|later ticket|later E-419' web/README.md | cut -c1-200 )
}
k12() {   # sealed, in $W: the QA probe (one Headless Shell scratch hub; facts to $EV/E419S3-12.jsonl)
  : > "$EV/E419S3-12.jsonl"                    # start the fact file empty
  ( cd "$QA_W" && QA_OUT="$EV/E419S3-12.jsonl" node --test --test-reporter=tap "$QA_Q/probe.test.mjs" > "$EV/E419S3-12.log" 2>&1; echo "exit $?" >> "$EV/E419S3-12.log" )
  tail -n 1 "$EV/E419S3-12.log"; grep -E '^# (tests|pass|fail) |Web fixture census' "$EV/E419S3-12.log"
  cat "$EV/E419S3-12.jsonl"
}
k13() {   # sealed, in $W: the full typecheck with the web guards, the tier lint and the stage's classifications
  ( cd "$QA_W" && npm run typecheck > "$EV/E419S3-13.log" 2>&1; echo "typecheck exit $?"; node hub/test/lint-tiers.ts > "$EV/E419S3-13-tiers.log" 2>&1; echo "tiers exit $?" )
  grep -F -e 'web HTML: raw-HTML sinks refused; seeded fixtures passed' -e 'web colours: token-only sources; colour fixtures passed' -e 'web tokens:' -e 'web hooks: conditional-hook fixture rejected by configured oxlint' "$EV/E419S3-13.log"
  grep -F -e '"web/test/phone-disconnected.test.ts": "Web"' -e '"web/test/phone-sessions.test.ts": "Web"' -e '"web/test/connection.test.ts": "Web"' "$QA_W/hub/test/tiers.json"
}
k15() {   # QA shell: cleanup of the fixture-owned processes and the scratch root
  for f in "$EV"/E419S3-0[6-9]*.log "$EV"/E419S3-1[0-2]*.log; do [ -e "$f" ] || continue; printf '%s ' "$(basename "$f")"; census "$(basename "$f" .log)" | tr '\n' ' '; echo; done
  git -C "$W" status --porcelain | grep -v -x -F '?? node_modules' | wc -l
  echo "$Q"
}
```

Cleanup after the evidence is recorded: print `$Q`, check it begins with `/private/tmp/qa-e419s3-`, and remove it by that literal path with a non-force `rm -r`. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). A failed Web case writes a Playwright trace under `$W/web/test-results/` (ignored by Git; `phone-sessions.test.ts` also writes screenshots there); name a trace as evidence before removing the worktree.

## Cases

none. No headless-grid case covers the web phone Sessions screen or the disconnected strip; every check below is a manual check through named test files, the QA probe's Headless Shell pages, git greps, the CLI or the docs, recorded with `qa-record.sh note`.

### Web cases (when in scope)

none: no `real-browser` case in this run (see "Out of scope"). Every stage criterion is proven in Chrome Headless Shell's phone context (390×844, touch, mobile flag) and a desktop context against signed-in sealed scratch hubs with fake senders (E419S3-06 to E419S3-12).

## Manual checks

Record each with `sh .agents/skills/qa/qa-record.sh note E-419 "$RUN" <id> hub-api "<command>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence-file…>` from `$W` in QA's own shell, naming where it ran at the start of the command text (`[QA shell]`, `[test $W]`, `[sealed $W]`, `[docs]`). The recorder takes `hub-api` for every check here; the probe's page steps are Headless Shell observations recorded the same way. Save each check's printed output as `$EV/<id>.txt` (pipe the row's command through `tee`) and name it, with the captures the row wrote, as evidence.

How to run a row, by its `where`:
- **sealed $W**: `( . "$Q/env.sh"; cd "$W" && <command> )`, after `quiet` when the row runs a test, the probe or the typecheck (E419S3-12, E419S3-13).
- **test $W**: in QA's own shell; `nt` runs `quiet` first and seals the test run itself.
- **docs** and **QA shell**: in QA's own shell, as QA; the plan reads of E419S3-00 and E419S3-14 are the only checks that touch the live hub, and only to read.

Order: the setup and E419S3-00; then E419S3-01 to E419S3-05, which need no test slot (run them while a stage cover may still hold it); then `quiet` and E419S3-06 to E419S3-13 in id order (E419S3-01's bundle serves every Web file and the probe); then E419S3-14 and E419S3-15.

**How a test row is judged.** Two separate things, never one:
1. **Clean**: the log shows `exit 0`, `# fail 0`, `# cancelled 0`, `# skipped 0`, `# todo 0`, `# pass` equal to `# tests`, no `not ok` and no `# SKIP`; every Web log's `census` prints a first count of at least `1` and a second count of `0` (hub T2 logs print `0 0`, which is expected).
2. **Required names**: every test named in the row's "required" list appears in `oks` (a name that appears on no `ok` line proves nothing; a name pattern matching zero tests passes with exit 0 and `# tests 0`).

TAP totals are not judged: they move with unrelated landings. The row gives the totals at writing for orientation only; a different `# tests` count is fine when the log is clean and every required name passes. Required names come in two kinds: **verified** (read at `d4d24ec8`; `phone-disconnected.test.ts` and `connection.test.ts` also run clean there in this sealed setup; the rest passed in A-10199 at the same source tree) and **read on the branch** (T-1172 at `89c0aed1`: confirm each against `names` at the build in E419S3-02). A required name missing at the build is judged by the file's own names at the build: renamed with the same body is PASS with the rename recorded; removed is FAIL for the criterion it carried; for a read-on-the-branch name, a test at the build whose body (read there) asserts the same criterion at 390×844 replaces it, recorded as a mapping in `$EV/<id>-map.txt`.

| id | surface | where | covers | command | expected |
| --- | --- | --- | --- | --- | --- |
| E419S3-00 | hub-api | QA shell | build, plan, merges, sealing | `k00 \| tee "$EV/E419S3-00.txt"` | Both SHAs equal `$S`; `0` changed paths; the symlink reads `/Users/evgeniyivanov/Projects/cland/v0/node_modules`. The plan lists the stages `bottom bar and inbox home`, `asks, threads, the composer and install`, `sessions and disconnected`, `notifications and the guide`; this stage has `qa` `{scope: "affected", when: "after-stage"}`, `state` not `closed` (it closes only after this verdict and the covers), `items` T-1172 and T-1173 plus any findings fixes the request names (nothing else), `total` equal to the number of printed items and `merged` equal to `total`; record the printed line as printed. Under every `== <id>` line exactly one commit line (T-1173 `3b4e3be5` at writing; T-1172 the commit that landed it); a missing line is BLOCKED "<id> not on dev". All seven files listed. Paths outside `web/` and `docs/`: T-1173 `hub/test/tiers.json`; T-1172 at most `hub/test/fakes/harness.ts`, `hub/test/tiers.json`, `hub/test/durations.json` (no finding). Any `shared/`, `nvim/` or `hub/src/` path is a scope finding to report, not judged here. Record the two file lists. `TMPDIR` is the system default (not `/tmp`) and `Q` begins `/private/tmp/qa-e419s3-`. Also record the setup's two counts (the first at least `1`, the second `0`) and `probe parses`. Repeat the first two commands after E419S3-15: unchanged (dev not moved) |
| E419S3-01 | hub-api | sealed $W | build | `npm run build --workspace web > "$EV/E419S3-01.log" 2>&1; echo "build exit $?"; ls web/dist/index.html web/dist/assets; git status --porcelain \| grep -v -x -F '?? node_modules' \| wc -l` | `build exit 0`; `web/dist/index.html` and the `assets` directory listed; `0` changed paths (`web/dist` is ignored). Needs no test slot |
| E419S3-02 | hub-api | QA shell | the connection and strip (T-1173), the merged Shell, Sessions on the phone (T-1172), `reconnectUntilLive`, colours, the probe's selectors and the members' test names | `k02 \| tee "$EV/E419S3-02.txt"` | Under `-- verified at writing` every line starts with `1` or more. Under `-- read on the branch` every line starts with `1` or more; a `0` means T-1172 landed with different code: read the file at the build and record what replaced it (same behaviour: no finding; behaviour missing: FAIL for the criterion it carries: SessionsHeader C1, VerifyLine/BottomSheet C2, SessionPage/SessionRow/Shell C3, the fake harness's command C3). Under `-- the merged Shell.tsx keeps both items` both lines start with `1` or more (the merge round's resolution kept both items): a `0` on the strip import is FAIL for T-1173 C1; a `0` on the Sessions page type is judged as a read-on-the-branch line (T-1172 C3). The colour grep prints nothing (AGENTS.md: colour values live only in `tokens.css`). Every probe selector count is at least `1` (a `0` means a renamed attribute: correct the probe as "QA probe" says before E419S3-12). Record each file's test names: E419S3-06 to E419S3-08 judge them |
| E419S3-03 | hub-api | QA shell | AGENTS.md `web/` rules | `k03 \| tee "$EV/E419S3-03.txt"` | The key-listener grep lists only `web/src/keyboard.ts` (one `document.addEventListener('keydown', …)`, its handler and its removal): no component-local key listener in `Disconnected.tsx`, `VerifyLine.tsx`, `BottomSheet.tsx`, `SessionRow.tsx`, `SessionGroups.tsx`, `SessionPage.tsx` or `Shell.tsx` (the queue sheet's Escape is the `sheet` context; the session page's Escape is the module's `dismiss`). Storage appears only in `web/src/interface-state.ts` under `cland.ui.<area>.v1` and in `web/src/connection.ts`'s `cland-reload-build` guard (drafts reach storage through `interface-state.ts`; nothing queues commands in storage). The raw-HTML grep prints nothing. The touch-listener grep prints nothing (no swipe gesture on rows or sheets). Under both ids nothing: no dependency, devDependency or lockfile change |
| E419S3-04 | hub-api | docs | T-1173 C5; docs of T-1172; `docs/agents/tests.md` headings | `k04 \| tee "$EV/E419S3-04.txt"` | `web/README.md`'s Phone headings, in file order, hold `## Phone`, then (as `###`) `Phone Sessions`, `Phone topic thread`, `Phone composer`, `Phone disconnected`, then `## Installable app` (each `###` under `## Phone`, none under `## Installable app`). `docs/agents/tests.md`'s phone headings hold `### phone-sessions.test.ts` and `### phone-disconnected.test.ts` beside the earlier `### phone-*.test.ts` headings, before `## Human marks fixtures`. Every `present` line starts with `1 ` (or more). **T-1173 C5**: a `0` under `-- T-1173 C5` is FAIL unless the same statement landed in other words: then read `### Phone disconnected` at the build and confirm it describes the disconnected state (the strip with its time, countdown and Retry, the desktop dot, "as of", unsent and disabled controls) and why nothing is queued (another client may already have answered; nothing replayed after reconnecting; drafts stay); no such description is FAIL for C5, a missing detail a **low** finding. A `0` under `-- T-1172` is a **low** docs finding (its criteria name no docs), recorded with the wording found. Then read `web/README.md`'s Phone (with its subsections), Verification in Sessions, Sessions (with Accounts strip), Area modules and live state and Browser tests sections, and the `docs/agents/tests.md` paragraphs for `phone-sessions` and `phone-disconnected`, and record any statement that contradicts E419S3-02 or E419S3-06 to E419S3-12 as a **low** finding with file and line (the row stays PASS when the only contradictions are docs ones). Candidates at writing, to confirm or dismiss at the build: Verification in Sessions' "Click it or press Enter on it to toggle the queue in place" with no phone exception there (dismiss when it or `### Phone Sessions` states that the phone opens the full-height sheet; T-1172's branch text does, in `### Phone Sessions`); the Accounts bullet's "their phone home in More arrives in a later E-419 ticket" is stage 4's (not a finding in this stage) |
| E419S3-05 | hub-api | sealed $W | brief | `cland qa lint qa/briefs/E-419-stage-3.md; echo "exit $?"` | `qa/briefs/E-419-stage-3.md: qa lint passes at the build` and `exit 0` (this brief, committed at the build). Needs no test slot |
| E419S3-06 | hub-api | test $W | T-1173 C1–C4 | `nt E419S3-06 web/test/phone-disconnected.test.ts; oks E419S3-06; census E419S3-06` | Clean. Required names (verified; ran clean at `d4d24ec8`): "phone disconnect shows a counting backoff and immediate Retry resets it without reloading" (C1; the desktop boundary at 640), "phone keeps the last Inbox time and disables every answer and reply while disconnected" (C2), "phone reconnect keeps offline drafts unsent and refreshes a refused resume from the last sequence" (C3, C4: no replay, the same document by `performance.timeOrigin`). Totals at writing (not judged): `# tests 3`, census `3` and `0` |
| E419S3-07 | hub-api | test $W | T-1172 C1–C5 | `nt E419S3-07 web/test/phone-sessions.test.ts; oks E419S3-07; census E419S3-07` | Clean. Required names (read on the branch at `89c0aed1`; judge renames by the rule above): "phone Sessions shows counts, one account row and two-line sessions without row actions" (C1, C5), "phone verify line opens the shared queue in a full-height sheet and Close restores the list" (C2; its body measures the sheet's visible `section`, not only the dialog), "phone waiting session page shows its command and both Back paths focus the same row" (C3), "phone Back restores focus when Stop moves the session into a folded group" (C3, the reviewer's M1), "phone session page confirms 44 px Stop/Archive actions with scratch CLI receipts" (C4). Totals on the branch (not judged): `# tests 5` |
| E419S3-08 | hub-api | test $W | reconnect and backoff, the desktop hub dot | `nt E419S3-08 web/test/connection.test.ts; oks E419S3-08; census E419S3-08` | Clean. Required names (verified; ran clean at `d4d24ec8`): "the printed web link connects the shell and reconnects with backoff after a hub restart" and its subtest "printed link, secret confinement and reconnect backoff" (the desktop dot's `data-live` and colour offline and live; 250 then 500 ms backoff; `reconnectUntilLive` to Live without reload), "an older page reloads once when welcome names the current bundle build", "a protocol refusal displays Restart hub and stops retrying". Totals at writing (not judged): `# tests 4` (3 top-level, 1 subtest), census `1` and `0` |
| E419S3-09 | hub-api | test $W | the desktop Sessions area, actions, drawer and queue at 1440 and at narrow widths | `nt E419S3-09a web/test/sessions.test.ts; oks E419S3-09a; census E419S3-09a; nt E419S3-09b web/test/session-actions.test.ts; oks E419S3-09b; census E419S3-09b; nt E419S3-09c web/test/verification.test.ts; oks E419S3-09c; census E419S3-09c; nt E419S3-09d web/test/session-drawer.test.ts; oks E419S3-09d; census E419S3-09d; nt E419S3-09e web/test/accounts.test.ts; oks E419S3-09e; census E419S3-09e; nt E419S3-09f web/test/session-launch.test.ts; oks E419S3-09f; census E419S3-09f` | Each clean. Required names (verified): sessions "Sessions groups count fake sessions and remember folds without hub requests", "Sessions rows render merged facts, holds, waiting detail and physical selection keys", "gs from an item reveals its claimed session inside a folded group"; session-actions "Stop confirms in place, Escape keeps the busy session, and Enter stops it", "Offline session actions are disabled and do not replay after reconnect", "At narrow width a tap or Enter opens the session page", "The session page shows facts and capabilities and shares all four actions", "Archive confirms once and moves the stopped session into the archive"; verification "Sessions verification queue shows hand runs, ages receipts and remembers its fold", "C1 hand holder and waiter open in place with Enter and executor status is read once per opening", "C4 queue open and closed preferences survive reload"; session-drawer "the session drawer approves a fake Codex command and retains its folded outcome after Waiting", "desktop Enter and Open thread focus the selected session log with shared physical thread keys"; accounts "Sessions account strip shows worst windows, limited reset, tooltips and a folding Accounts link", "accounts without readings show dashes and a failed registry poll exposes no file values"; session-launch "Offline launch is disabled and reconnect never replays the draft". Totals at writing (not judged): sessions `5`, session-actions `9`, verification `4`, session-drawer `7`, accounts `6`, session-launch `9` |
| E419S3-10 | hub-api | test $W | E-419 stage 1–2 phone regression | `nt E419S3-10a web/test/phone.test.ts; oks E419S3-10a; census E419S3-10a; nt E419S3-10b web/test/phone-more.test.ts; oks E419S3-10b; census E419S3-10b; nt E419S3-10c web/test/phone-inbox.test.ts; oks E419S3-10c; census E419S3-10c; nt E419S3-10d web/test/phone-asks.test.ts; oks E419S3-10d; census E419S3-10d; nt E419S3-10e web/test/phone-approvals.test.ts; oks E419S3-10e; census E419S3-10e; nt E419S3-10f web/test/phone-thread.test.ts; oks E419S3-10f; census E419S3-10f; nt E419S3-10g web/test/phone-composer.test.ts; oks E419S3-10g; census E419S3-10g; nt E419S3-10h web/test/phone-install.test.ts; oks E419S3-10h; census E419S3-10h` | Each clean. Required names (verified): phone "five touch slots open the four areas and Inbox is home", "640 px keeps the collapsed rail and 639 px swaps to the bar without reload", "phone Inbox selection keeps asks in a sheet and replies inline without a drawer"; phone-more "phone Accounts retains registry and window facts while notification switches stay desktop only", "phone Back wins over an earlier held item-link read"; phone-inbox "phone message and request replies unfold inline, share topic drafts and reach the sender"; phone-asks "phone sheet Escape, close, scrim and a touch swipe never answer or decline an ask", "phone ask row opens a numbered touch sheet with header facts and a free answer" (the `BottomSheet` without `fullHeight`); phone-approvals "phone approval Escape, close, scrim and swipe leave the native request pending"; phone-thread "phone topic opens full screen with its facts and both Back paths return to Topics" (the phone page history T-1172 extends); phone-composer "phone per-topic drafts survive navigation and reload with their chosen kind"; phone-install "the installed start URL opens Inbox over a saved Sessions area and leaves a plain root URL". Totals at writing (not judged): phone `7`, phone-more `5`, phone-inbox `3`, phone-asks `6`, phone-approvals `6`, phone-thread `6`, phone-composer `6`, phone-install `4` |
| E419S3-11 | hub-api | test $W | the Inbox, asks, composer and Withdraw offline; the shell and key contexts; the fake harness's T2 users | `nt E419S3-11a web/test/inbox.test.ts; oks E419S3-11a; census E419S3-11a; nt E419S3-11b web/test/asks.test.ts; oks E419S3-11b; census E419S3-11b; nt E419S3-11c web/test/composer.test.ts; oks E419S3-11c; census E419S3-11c; nt E419S3-11d web/test/withdraw.test.ts; census E419S3-11d; nt E419S3-11e web/test/shell.test.ts; oks E419S3-11e; census E419S3-11e; nt E419S3-11f web/test/key-contexts.test.ts; oks E419S3-11f; census E419S3-11f; nt E419S3-11g hub/test/approval-records.test.ts; nt E419S3-11h hub/test/heartbeat.test.ts; nt E419S3-11i hub/test/inbox-requests-component.test.ts` | Each clean (11g to 11i are hub T2: no census). Required names (verified): inbox "a fresh epoch recovers an approval answered by a peer while this browser was offline", "approval card shows the complete command and session facts, then folds to the human once outcome"; asks "offline asks disable writes and a fresh snapshot recovers an answer without replaying a draft"; composer "per-topic drafts survive reload and hub disconnection without replay and writing marks the sent message read"; shell "selected hub rows open the drawer; close and Esc persist until selection moves; Split and command Enter open the other pane", "physical digit codes switch areas with Cyrillic key values and preserve field typing"; key-contexts "area modules keep selection and drawers and session launch actions appear in help and palette". The three hub logs are judged clean only (they use the fake's one-argument `waitingForApproval`, which T-1172 extended). Totals at writing (not judged): inbox `23`, asks `9`, composer `8`, withdraw `5`, shell `9` (1 top-level, 8 subtests), key-contexts `3`, approval-records `18`, heartbeat `9`, inbox-requests-component `10` |
| E419S3-12 | hub-api | sealed $W | T-1172 C1–C5, T-1173 C1–C4, the desktop at 1440 and 640 (independent probe) | `k12` | **The TAP pass and the facts are judged separately.** TAP: `exit 0`, `# tests 1`, `# pass 1`, `# fail 0`, one `Web fixture census: browser group <pid>; before <n>; after 0; scratch hub stopped` line: this proves only that the probe ran to its end and cleaned up, nothing about the product. Facts, each judged on its own; a `step` line means that step's facts are missing: FAIL for the criterion it carries when the product lacks the thing, or a probe correction (see "QA probe") when only a selector changed. `seededSessions` `{poll: true, registry: ["codex/qa-empty","codex/qa-main","codex/qa-other"], slot: true, busyCli: {status: "running", archived: false}}` with all four `launched` `true`. **T-1172** (read on the branch; the facts at `d4d24ec8`, before it, are given in brackets): `sessionsList` (C1) `area: "Sessions"`, `counts` `["Waiting 1","Busy 1","Idle 1","Yours 1"]` [five groups, Yours first, `Stopped 0`], `cells` equal to `registry`, `oneRow: true` [false: two rows], every `cellBoxes` entry `height` at least 44 with `left` at least 0 and `right` at most 390, `mainText` containing `wk 81%`, `mainMeter: "81"`, `emptyShare: "—"`, `emptyMeters: 0`, every `rows` entry `{height: 52, twoLines: true}`, `visibleActions: 0`, `document: 390`. `sessionsSwipe` (C1) `{page: 0, visibleActions: 0, cli: {status: "running", archived: false}, idleHidden: true, idleBack: true}` (so at `d4d24ec8` too). `verifySheet` (C2) `summary` starting `verify: human`, `line.height` at least 44, `chevron: true`, `haspopup: "dialog"`, `dialog: 1`, `inPlaceTable: 0` [`chevron: false`, `haspopup: null`, `dialog: 0`, `inPlaceTable: 1`: in place]; **the full height is judged on the visible surface as well as the overlay**: `overlay` `{x: 0, y: 0, width: 390, height: 844}` and `surface` (the sheet's visible `section`) `{x: 0, y: 0, width: 390, height: 844}`, `surfacePanel: true` (the surface paints `--panel`, so it is the visible sheet, not a transparent box), `content` inside the surface with `height` above 0 and `y + height` at most 844; a full-height overlay with a shorter surface is FAIL for C2. Also `modal: true`, `row` containing `human`, `closeHeight` at least 44, `closed: true`, `listVisible: true`, `focusAfterClose: true`, `escapeClosed: true`, `focusAfterEscape: true`. `waitingPage` (C3) for `button` and `browser` each `{page: 1, missing: [], command: true, commandFits: true, list: 0, secondary: 0, document: 390, historyEntry: "Sessions", focused: true, pressed: "true", pageGone: true, area: "Sessions"}` with `box.x` 0 and `box.width` 390, `backHeight` at least 44 and no `fallback` [`command: false`, `backHeight: null`, `historyEntry: null`, `fallback: "escape"`: no Back control, no history entry]. `stopPage` (C4) `before` and `pending` `{status: "running", archived: false}`, every `heights` value (Stop, Capabilities, Confirm, Cancel, Resume, Archive) at least 44, `escape` `{confirm: 0, page: true, cli: {status: "running", archived: false}}`, `after` `{status: "stopped", archived: false}`, `archiveCancelled` `{status: "stopped", archived: false}`, `archived` `{status: "stopped", archived: true}`, `pageVisible: true` (all so at `d4d24ec8`, the shared T-1136 page). `accountCell` (C5) `{area: "Accounts", account: 1, controls: 0, buttons: 0, document: 390}` (`recovered` not judged). **Desktop** (verified at `d4d24ec8`): `desktopSessions` for `1440` and `640` each `{phone: "false", rail: 1, bar: 0, counts: ["Yours 1","Waiting 1","Busy 0","Idle 1","Stopped 0"], cells: 3, haspopup: null, inPlace: 1, dialogs: 0, refolded: 0, pressed: "true", actions: ["Capabilities","Stop"], drawer: 1, drawerSession: "qa-idle", page: 0, dot: "true", strip: 0}` (`Busy 0` because context A archived `qa-busy`; `Busy 1` only when `stopPage` failed, judged there); `desktopOffline` `{text: "Offline", live: "Live", dotAfter: "true", stripAfter: 0}` with `640` and `1440` each `{phone: "false", dot: "false", text: "Offline", strip: 0, asOf: 0}`. `seededOffline` all `true`. **T-1173** (verified at `d4d24ec8`): `offlinePrep` `{live: "Live", liveRows: 3, reply: "QA offline draft", strip: 0, asOf: 0}`. `strip` (C1) `{text: "Offline", dot: "false", strip: 1, underHeader: true, width: 390, since: "14:10", sinceIso: "2026-10-23T14:10:00.000Z", immediate: true, retryFailed: true, attemptsBy249: 1, attemptsBy250: 2}`, `retry.height` at least 44, `texts` exactly `["Disconnected since 14:10 · retry in 1 s Retry", "… 1 s Retry", "… 1 s Retry", "… 2 s Retry", "… 4 s Retry", "… 3 s Retry"]` (each `…` is `Disconnected since 14:10 · retry in`; the strip counts down and the backoff doubles; a `no failed attempt` entry is INCONCLUSIVE for C1, rerun the probe once), `afterRetry` `"Disconnected since 14:10 · retry in 1 s Retry"` (Retry reset the backoff to 250 ms). `offlineControls` (C2, C3) `title` containing `as of`, `asOf` an `HH:MM` not later than `since` and equal to `asOfLater` (the last applied frame's time, not the clock: `14:10` at writing, `14:09` equally fine), `asOfIso` not later than `strip.sinceIso`, `rows` equal to `liveRows`, `unsent: 1`, `replyText: true`, `replySendDisabled: true`, `replyDraft: "QA offline draft"`, `ask` `{controls: 5, disabled: 5}`, `approval` `{controls: 4, disabled: 4}`, `since: "14:10"`, `mutations: []` (the forced reply `submit` sent nothing). `offlineComposer` (C2, C3) `{shared: "QA offline draft", sendDisabled: true, strip: 1, mutations: []}` (`shared` is the per-topic draft the reply and composer share; not judged). `offlineWidths` `390` `{phone: "true", strip: 1, dot: "false", text: "Offline", rail: 0}`; `640` and `1440` each `{phone: "false", strip: 0, dot: "false", text: "Offline", rail: 1}` (the desktop keeps its hub dot). `reconnect` (C3, C4) `{stillOffline: "Offline", live: "Live", strip: 0, draft: "QA offline composer draft", sendEnabled: true, resume: true, newEpoch: true, historyDrafts: 0, askOpen: "open", freshAsk: 1, oldAsk: 1, asOf: 0, mutations: [], sameDocument: true, marker: "qa-e419s3"}`: nothing queued or replayed (`mutations` empty across the whole context, no draft in durable history, the earlier ask still open), drafts stay, the fresh ask shows, and **no reload**: `sameDocument` and `marker` (document identity). `navigations` is printed and not judged (5 at writing: the load and its redirect plus same-document history entries) |
| E419S3-13 | hub-api | sealed $W | typecheck, colour, contrast, HTML and hooks guards; tiers | `k13` | `typecheck exit 0` with no diagnostic in the log (hub, Neovim, shared wire and web typechecks; the colour, token, HTML and hooks guards: `Disconnected.module.css`, `BottomSheet.module.css`, `AccountsStrip.module.css`, `Sessions.module.css` and `VerifyLine.module.css` hold no colour value; secondary text keeps 4.5:1 on ground and selection); the four guard lines appear (`web HTML: raw-HTML sinks refused; seeded fixtures passed`, `web colours: token-only sources; colour fixtures passed`, `web tokens: <n> text tokens ≥4.5:1 on ground and selection; role colours match hl.lua`, `web hooks: conditional-hook fixture rejected by configured oxlint`); `tiers exit 0`; the three classification lines print (all `"Web"`) |
| E419S3-14 | hub-api | QA shell; the Coordinator's stage covers | stage covers | `(cd "$W" && node hub/bin/cland.ts task plan show E-419) \| tee "$EV/E419S3-14.txt"` and the cover results the request names | QA runs no full suite. The Coordinator owns the stage covers (`cland verify all --occasion stage`): full integrated suites at the tested SHA on Linux (the droplet) and macOS (local), which add T3 and the Web phase on both platforms and are cited evidence this run does not run. Record the plan's line for this stage exactly as printed (at writing: `sessions and disconnected: open; stage cover missing Linux droplet, macOS`); Linux and macOS covers green at the tested SHA, each with its Web phase run (not "Web unavailable"); record each cover's run id, artifact, executor, platform, tiers and phases, wall time and cost as cited evidence. Any red cover is FAIL naming its failing tests. A cover still running when every other check is done: wait for its result in the epic topic (the macOS cover takes about 20 minutes; a wait is not BLOCKED); none queued or running at the tested SHA by then: BLOCKED "no stage cover at the tested SHA", reported to the requester |
| E419S3-15 | hub-api | QA shell | cleanup | `k15 \| tee "$EV/E419S3-15.txt"` | Every Web log line prints a first census count of at least `1` and a second of `0` (E419S3-06 to E419S3-10h, E419S3-11a to E419S3-11f, E419S3-12; the hub logs E419S3-11g to E419S3-11i print `0 0`, which is expected); `0` changed paths; `$Q` begins `/private/tmp/qa-e419s3-`. Then remove `$Q` and the worktree as "Setup" says |

Re-check helper, file and test names with grep at the tested build: renames happen. The named Web tests and the probe ask the live hub's verify slot for admission themselves (`suite.slot` check): an admission refusal or timeout while a cover holds the slot is not a product failure; run `quiet` and retry that row once.

Before requesting QA, run `cland qa lint <brief>` with this filled brief at the build under test. The brief is complete only when qa lint passes at the build.

## Probes that mislead

- Process cleanup probes use a fixture-owned pid/process-group census, registered at launch and checked through exit; a machine-wide `pgrep` counts other sessions too (A-9063 R2; E-413 stage 1/T-1093). Here: each Web fixture's `Web fixture census: browser group <pid>; before <n>; after 0; scratch hub stopped` line, the probe's included; the probe's hub stops and restarts are the fixture's own (`fixture.hub.stop()`, `fixture.restartHub()`), and the last scratch hub is stopped by the fixture's cleanup.
- Edit existing keys in initialized configs, list standalone-test build prerequisites, enumerate regular files only for file probes, and identify events by seq/id. A second-client check allows only defaults the new client writes itself (A-8634 R12; E-412 stage 2, E-415 stage 3/DoD, E-1006). Here: the probe writes the scratch `accounts.toml` before the hub starts, as the items' own tests do; its frame clients and fake spoke only read and send through public frames; the pages write their own preferences and drafts. The bundle is served from E419S3-01's `web/dist`: a stale bundle shows stale facts, so build first.
- Transcript assertions identify stable item/topic/frame ids, with intervals starting at the result frame of the state-changing request. Preserve unaltered captures when correcting a probe and label the correction separately from product failures (A-8634 R13; E-412/E-415/E-1006; A-9063 R2; E-413 stage 1/T-1093). The probe finds sessions by name, asks, approvals and messages by the ids their creating requests or `inbox.list` returned, and the resume cursor by the last received frame carrying `epoch` and `seq` before the stop.
- Exact tracker copies replace the initialized tracker directory after its writers stop; apply the full `fixtureEnvironment` result after overlays, check zero credential-prefix names before launching scratch processes and report names/counts only (A-9063 R2; E-413 stage 1/T-1093). This run needs no tracker copy.
- An accessibility-tree count does not prove visible reachability (A-9063 R6; T-1095, T-1097). Touch sizes, rows, the strip's place and the sheet's height are judged from each visible element's bounding box, never from a count. A full-height dialog overlay does not prove a full-height sheet: the visible `section` surface is measured separately, with its panel paint.
- A probe's TAP pass is not a product verdict: the probe asserts nothing about the product, so `# pass 1` with a `step` line or a wrong fact is still a finding. Judge each fact; the TAP lines only prove the run ended and cleaned up.
- "No reload" is document identity, never a navigation count: Playwright's `framenavigated` also fires for same-document history entries (the phone pages push them). `performance.timeOrigin` is faked by Playwright's clock, so both reads happen under the installed clock; the `window.qaDocument` marker survives only in the same document. The probe's first run while this brief was written read `timeOrigin` before installing the clock and saw a false "new document"; that capture was a probe error, corrected here.
- The countdown is driven by the page's paused clock and real socket attempts: each `runFor` waits for the failed real attempt's close before the next, as the item's test does; never advance past a pending real handshake. A missing attempt is INCONCLUSIVE, not a product failure.
- T-1172's probe steps and required names were read on its branch before it landed: grep its names at the build (E419S3-02), correct a renamed selector as "QA probe" says, and judge a criterion by its words, not by a guessed label.
- Touch is Headless Shell's emulation (`hasTouch`, `isMobile`, coarse pointer, `tap()`, a CDP touch swipe), as the items' tests use; a real phone and a real network loss are out of scope: the disconnection is the scratch hub stopping.
- Physical keys are dispatched as `KeyboardEvent`s with the code and a Cyrillic key value (`ж`), as the items' tests do, to prove the physical-code map; Playwright's `press` would send the Latin key value too.
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file.
- A "ran" marker grep excludes the configuration echo line.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log: not applicable, QA runs nothing on a droplet. Speed criteria use measured wall times, never projections: this stage has none; duration lines and E-880 allowances are report-only here.
- Slots due or queued before the build count even when their results arrive later.
- "No skip": the Web files and the probe need Chrome Headless Shell (local on macOS); a skipped or "Web unavailable" result is BLOCKED, never PASS. Linux runs of the same files are cited from E419S3-14, not run by QA.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

Real Chrome, a real phone and computer use: out of scope for this run, not BLOCKED, as in this epic's stages 1 and 2: every stage criterion is proven in Chrome Headless Shell's phone context (390×844, touch, the mobile flag) against signed-in sealed scratch hubs. A real network loss, a real tunnel or LAN phone, and the live hub stopping (the disconnection is always the scratch hub's). Also out of scope: notifications, the service worker, More's notification controls and the guide (stage 4); the phone accounts cell's limited (red) state, which no criterion names (the desktop limited mark is regression in E419S3-09); the live hub and real Codex, OpenCode or Claude Code sessions (every session is a fake Codex session of a sealed scratch hub, every sender a fake spoke or frame client); E-417's and E-418's Inbox, thread, composer, Items, Artifacts and Accounts behaviour beyond the named regression files (their own stages judged them); Neovim; work landed on dev after the stage's items, beyond the regression files named here; running a full suite, T3 or a stage cover (E419S3-14 cites the Coordinator's); T4; duration budget lines (report-only); the epic's Definition of done and its demo, a separate run; the live project's tracker, hub, crew, `ui.json` and HOME. Stage QA carries no criterion marks.

Nothing else in scope needs an authorization this brief does not give: a check that cannot run for lack of one is BLOCKED, not out of scope.

## Grants

none. No computer use, no real browser, no sign-in to the live hub, no tunnel. The Headless Shell instances of the Web files and the probe open only their own sealed scratch edges, under the crew browser rule (rule 18). Every other check uses the rule 15 sealed environment with credentials filtered; nothing reads or writes the human's real `~/.cland`, `~/.claude`, `~/.codex` or `~/.local/state`.

## Verdict

Fix nothing. Clear only when every check E419S3-00 to E419S3-15 passes (docs contradictions in E419S3-04 beyond T-1173 C5, and the facts this brief marks **low**, are low findings and do not block clear). Otherwise not clear, naming the failing, blocked or inconclusive ids and findings. On the epic record one QA verdict with `--stage "sessions and disconnected"`, the full tested dev SHA, the unique run id and the case table. Stage QA carries no epic criterion marks. Report `qa clear E-419 stage sessions and disconnected` or `qa not clear E-419 stage sessions and disconnected` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
