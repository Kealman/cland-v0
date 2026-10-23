# Stage QA brief: E-417 stage 4 — events, notifications and approvals

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` or `$B:h` as a modifier). The run is local, on macOS (BSD tools; Chrome Headless Shell from the installed `playwright-core`).

## Stage

- Epic: E-417 (Topics, threads and the inbox, under R-377).
- Exact stage name: events, notifications and approvals.
- Items, in plan order: one serial lane T-1127, then T-1128, then T-1129; a second lane T-1164. The run reads the stage's members, counts and state from `task plan show E-417` (E417S4-00 and E417S4-13), never from a number written here. Findings fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: the combined changed behaviour of the four items at the tested build. All four change only the web bundle, its tests and docs (`web/`, `docs/agents/tests.md`, `hub/README.md`, `hub/test/tiers.json`, `hub/test/durations.json`, the new T1 file `hub/test/web-notifications.test.ts`, the implement skill's guidance): no hub, shared wire or Neovim source changed. The approval cards answer through E-414's approval records and gate, which are E-414's and are only exercised here.
  - T-1127, the Events view (§3.7, §3.6): `web/src/EventsArea.tsx` and `web/src/events-feed.ts` list the hub's journal rows newest first under local-day rules, at most 200 with `A` or a control loading 200 older ones; each row shows time, glyph, kind, subject and one line; bookkeeping rows dimmed, hub-coalesced rows `×N`; `za` folds a day; Enter opens the subject (card, session, topic, artifact). The filter (`1`–`8` by kind, `0` all, `w` warnings only, `s` a subject through the palette, `F` clears) goes to the hub on `subscribe {filter}` and every `events.list {filter}` through a separate cookie socket, and survives reload in `cland.ui.events.v1`. Opening the view sends `marks.set` once per visit; the previous look stays as a rule (`data-events-last-look`) with newer rows marked, and the Inbox events line (`data-inbox-events`) counts from the new look. `web/src/connection.ts`, `keyboard.ts` and `Shell.tsx` gained the filtered subscription and the rail's actual-target key routing (digits navigate from the rail, Sessions `l`/`a`/`A` stay local, focused Events rows filter).
  - T-1128, notifications while the page is open (§3.6): `web/src/notification-rules.ts` (pure eligibility, text and target), `web/src/notification-state.ts` (per-browser switches `cland.ui.notifications.v1`, shared across tabs) and `web/src/browser-notifications.ts` (the one `new Notification`). "Needs you" fires when a now-layer row enters the Inbox, "Finished" when a now-layer task reaches done (its layer before the transition); nothing fires while the page is visible and focused, for watch/background rows, or on a snapshot. A notification is titled `<session> · <item>`, its body the question (or command, plan, text, `Finished · <title>`), its tag the row id or item id; a click focuses the page and selects the exact Inbox row (secondary pane and open palette included, committed with `flushSync` without waiting for animation frames: the T-1128 race on a hidden page) or opens the finished item's card. T-1128 landed the two switches as palette actions; **T-1142 (E-418, landed `4624720e` after T-1128 and before T-1129, not a member of this stage) moved them** into the Accounts **Profile** block (`web/src/accounts/Profile.tsx`: a `Notifications` group holding two `role="switch"` buttons **Needs you** and **Finished** with `aria-checked`, the reason or description as tooltip) and removed the palette actions from `Palette.tsx`, `Shell.tsx` and `keymap.ts`; the store `notification-state.ts`, the permission rule and delivery are unchanged. Permission is requested only from the first enabling gesture; a denied or revoked permission turns both off with a site-settings tooltip. T-1128 C4's "palette actions" wording is superseded by E-418's placement choice (spec v0.2: the switches beside the profile); this stage judges C4's substance (two switches, kept per browser across reload, permission only on the first enabling) at their Profile placement, and the placement itself is E-418's to judge. No service worker, no push.
  - T-1129, approval cards (P23, §3.4, §3.8): `web/src/ApprovalCard.tsx` shows the session, harness, since, the complete public subject (command, cwd, reason, files, change) and only the record's offered choices: **1 · Approve once**, **2 · Always for this command**, **d · Deny** opening an optional **Denial note** (Enter or Deny sends, Escape or Cancel discards without answering); pending until the gate's receipt, a delivery failure keeps the note for a manual retry; a refused race reads that approval's archived winner and folds to it; a closed card folds to `<Approved once|Approved always|Denied> by the human · <via> · <time>` and follows the Inbox leave rule; a record with `answerIn: "tui"` (Claude Code, and E-414's adapter or payload-cap fallback) shows `Answer in Neovim` and no buttons. With an approval selected, the drawer shows the session's latest 20 messages through `session.history` (`web/src/SessionRecentThread.tsx`, keyed by approval since the M1 fix). Keys `approval` and `approval-note` contexts in `web/src/keymap.ts`, dispatched through the shell.
  - T-1164, docs (qa-found in stage 3): `web/README.md`'s thread key table lists `r` (Reply to Inbox sender) with its context, and no sentence calls the Inbox, drawer, pane or snapshot client a stand-in or not yet landed (Events, the only area then pending, has since landed as T-1127).
- Decisions governing this stage:
  - E-414, ask 9a81a158 (stand-in under D24, 15:17Z 2026-10-22, comment on E-414): the approval record carries the command, cwd and reason, plus file paths and change, capped at 64 KB; only the human answers approvals; **the deny note is optional**. T-1129 C2 was amended to it (Deny sends with or without a note). Probed in E417S4-08 (`denyBare`, `denyNote`).
  - E-414, Coordinator 2026-10-22 23:30Z (refining the 64 KB cap): an approval whose complete authorization subject does not fit the public payload cap is answered in the TUI, not in the hub; truncated text is informational. On the web it is a record with `answerIn: "tui"` and no choices, rendered like a Claude Code record: `Answer in Neovim`, no buttons. The adapter half is E-414's (`hub/test/codex-native.test.ts`, E417S4-05); the card half is T-1129's fallback case (E417S4-04) and the probe's `tui` step (E417S4-08).
  - E-417, ask 9a81a158 (15:17Z 2026-10-22): only a human Question makes a topic wait; not exercised by this stage beyond the regression files.

Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

Criteria map (the stage verdict carries no item or epic marks; this tells the run which check proves what):

| criterion | proven by |
| --- | --- |
| T-1127 C1 (rows newest first in day groups with day rules, at most 200, 200 older on demand) | E417S4-02 |
| T-1127 C2 (`w` warnings only and `2` task events through the hub's filter, `F` restores every row) | E417S4-02, E417S4-08 (`events`: the `subscribe` and `events.list` filter frames, rows equal the hub's filtered read) |
| T-1127 C3 (bookkeeping dimmed, merged events `×N`, a day folds, Enter opens the subject) | E417S4-02 |
| T-1127 C4 (opening the view sets the human's last look, a frame client reads it, the Inbox events line drops to 0) | E417S4-02, E417S4-04 (the two events-footer names), E417S4-08 (`events`) |
| T-1128 C1 (page hidden, "needs you" on: a new ask raises one notification naming session, item and question; its click opens the Inbox row) | E417S4-03, E417S4-08 (`notifyAsk`, animation time paused, secondary pane and open palette) |
| T-1128 C2 (visible and focused, or "needs you" off: none; a watch-layer event never) | E417S4-03, E417S4-08 (`notifyLooking`) |
| T-1128 C3 ("finished" on, page hidden: a now-layer task reaching done raises one notification whose click opens the card) | E417S4-03, E417S4-08 (`notifyFinished`, the notification only) |
| T-1128 C4 (switches kept per browser across reload; permission requested only on the first enabling; "palette actions" superseded: T-1142 moved them to the Accounts Profile block) | E417S4-03, E417S4-07 (the Profile switches and no palette action) |
| T-1129 C1 (a fake Codex approval card with the full command and the three buttons; Approve once folds to "approved once by the human", as a frame client reads it) | E417S4-04, E417S4-08 (`approveOnce`) |
| T-1129 C2 (Deny with or without a note; a typed note reaches the record; Escape never answers) | E417S4-04, E417S4-08 (`denyBare`, `denyNote`) |
| T-1129 C3 (a fake Claude Code approval shows "answer in Neovim" with no buttons) | E417S4-04, E417S4-08 (`tui`) |
| T-1129 C4 (an answer refused because another client answered first folds the card to the winner) | E417S4-04, E417S4-08 (`race`), E417S4-05 (the gate's one-winner rule) |
| T-1164 C1 (`web/README.md`'s thread key table lists `r` Reply to Inbox sender with its context, matching `keymap.ts`) | E417S4-11, E417S4-07 (the binding) |
| T-1164 C2 (no sentence calling the Inbox, drawer, pane or snapshot client a stand-in or not yet landed) | E417S4-11 |

Docs beyond T-1164: the items' sections of `web/README.md` (Inbox's approval paragraphs and key table, Events, Browser notifications, Area modules, Split and drawer, Palette and keys, Browser tests), `hub/README.md`'s notification and approval-card paragraphs and `docs/agents/tests.md`'s paragraphs for `events.test.ts`, `notifications.test.ts`, `web-notifications.test.ts` and the approval-card seam are read by E417S4-11, which records contradictions with the implementation as low findings.

Definition-of-done pointer (no marks): E-417 C4 (approval cards: Approve once, Always, Deny with a note, "answer in Neovim") is exercised by E417S4-04 and E417S4-08; C6's events half (filters, day groups, the 200 cap, the last look in the hub) by E417S4-02 and E417S4-08; C8 (open-page notifications, now layer only, never while looking, two switches, naming session, item and wait, click opens the row) by E417S4-03 and E417S4-08. The epic's Definition of done and its demo are a separate run.

## Build

Use a clean detached worktree at dev at the SHA in the request (the full 40-hex SHA), created below. HEAD must equal that SHA and refs/heads/dev before and after running. All listed items must have merged onto dev: for every member that `task plan show E-417` lists in stage `events, notifications and approvals`, `git log --first-parent --oneline --grep "Item: <id>" dev` prints exactly one commit. At writing every member had landed: T-1164 as `e196c1ac`, T-1127 `5d7c9082`, T-1128 `68209237` and T-1129 `720842c2` (the squash of its source-cleared head `599bb7e0`, the M1 fix after reviewed head `6fb2a98d`). Two non-members landed among them and are on the build: T-1178 (C-325) as `558262e4` after T-1128, with the shared fake-clock reconnect helper `reconnectUntilLive` in `web/test/harness.ts` that the Web files here use, and T-1142 (E-418) as `4624720e` just before T-1129, which moved the notification switches from the palette into the Accounts Profile block (see T-1128 above). Every expectation below was read from dev at `720842c2`. **The run starts only once T-1129 is on dev** (it is at writing); E417S4-00 checks it through the plan, and a missing landing is BLOCKED. Dev may carry work landed after these items that is outside this stage (T-1143 notes rendering and This topic, for example, landed between T-1127 and T-1128); it is not judged here beyond the regression files named. A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no commit of its own or run id on purpose: committing a brief changes the tested tree. Re-check test names, labels and docs strings with grep at the tested build.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step (the setup below does; the clean-tree checks ignore that one entry). Run E417S4-01's build before any Web file or the probe, or the shell never renders. The browser is the suite's Chrome Headless Shell under `node_modules/playwright-core/.local-browsers`: each named Web test file and the QA probe start and close their own through the Web harness (`web/test/harness.ts`, `webFixture`). No real browser and no other GUI process starts. The live hub is touched only by `quiet`, the Web harness's own read-only admission check and the plan reads of E417S4-00 and E417S4-13. The live hub has run E-414's approval relay since restart #49 (06:46Z 2026-10-23 at `ca038616`); this run does not use it: every approval, ask, notification and journal fact comes from sealed scratch hubs started from `$W`'s own source with in-process fake adapters (fake Codex and Claude Code harnesses raising approvals, a fake Coordinator spoke asking), never a real session, account or provider binary (see "Out of scope").

## Setup (once, before E417S4-00)

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree, runs `quiet`, the plan reads, reads the captures and records every check with `qa-record.sh`. **Every other command runs sealed** (rule 15) inside a subshell that sources `$Q/env.sh`: the full `fixtureEnvironment` result (`test-support/fixture-environment.ts`) after the scratch overlays (its synthesized HOME, XDG, Git, account and fake-harness paths included), which drops every `CLAND_*`, `GIT_*`, `XDG_*`, `CLAUDE_*`, `CODEX_*`, `FAKE_*`, provider and account variable while keeping `PATH`, `SHELL`, `TERM` and `TMPDIR`. Leave `TMPDIR` at the system default (on macOS `/var/folders/...`; never `/tmp`, T-1030). Never use `env -i`. The scratch root lives under `/private/tmp/qa-e417s4-` (its realpath). Never the live project's hub for anything but the reads named above and `quiet`; never the human's HOME, `~/.cland`, `~/.claude`, `~/.codex` or `~/.local/state`. Fixtures are fake only: the Web harness's sealed scratch projects and hubs with in-process fake adapters, the fake Codex and Claude Code harnesses (`raiseApproval`, `approvalAnswers`), fake spokes as senders and the fake Coordinator asker; no real session, account or provider binary.

In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<the full dev SHA from the request>
RUN=qa-s4-$(date +%F)-1                        # unique run id for E-417; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e417s4-$RUN           # the clean detached build
EV=$R/.cland/qa/E-417/$RUN                     # captures (qa-record.sh keeps its evidence here too)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
Q=$(cd "$(mktemp -d /tmp/qa-e417s4-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/qa-e417s4-…
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data" "$Q/xdg/cache"
holder() { (cd "$W" && node hub/bin/cland.ts verify queue --json) | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);console.log((v.holder?.session??v.holder?.kind??"none")+" waiters "+(v.waiters??[]).length)})'; }
quiet() { for i in $(seq 1 10); do h=$(holder) && case "$h" in "none "*) echo quiet; return 0;; esac; sleep 60; done; echo "BLOCKED: the verify slot is not free after 10 minutes: ${h:-queue read failed}"; return 1; }
# nt <id> <test files…>: named test files from $W, sealed, one file at a time, TAP output, after quiet; the log is $EV/<id>.log
nt() { id=$1; shift; quiet || return 1; ( . "$Q/env.sh"; cd "$W" && node --test --test-concurrency=1 --test-reporter=tap "$@" > "$EV/$id.log" 2>&1; echo "exit $?" >> "$EV/$id.log" ); tail -n 1 "$EV/$id.log"; grep -E '^# (tests|pass|fail|cancelled|skipped|todo) ' "$EV/$id.log"; grep -E '^ *not ok|# SKIP' "$EV/$id.log" | head -20; }
# oks <id>: the names on the passing (sub)test lines of $EV/<id>.log
oks() { grep -E '^ *ok [0-9]+ - ' "$EV/$1.log" | sed -E 's/^ *ok [0-9]+ - //'; }
# census <id>: the number of Web fixture census lines, then how many of them do not end cleanly
census() { grep -c -F 'Web fixture census' "$EV/$1.log"; grep -F 'Web fixture census' "$EV/$1.log" | grep -c -v 'after 0; scratch hub stopped'; }
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

The QA probe. `$Q/probe.test.mjs` is a one-test `node --test` file, independent of the items' own tests: one sealed scratch project and hub through the Web harness (`webFixture` with a `FakeClock` at `2026-10-23T12:00:00Z`, timezone `Europe/Belgrade`; `tempProject` under the system `TMPDIR`, `projectHub` with in-process fake adapters, the production socket and web edge serving `$W/web/dist`), seeded before the hub starts with a release `R-900000` (version 99.0.0) holding the in-progress task `T-900001` assigned to `qa-worker` (so both are Now work) and a 12-row journal (`2026-10-21T23:00Z` onward every 5 minutes; even rows `notification`, odd rows `task-claimed`; every third `not clear`). The local human frame client sets the shared last look to `2026-10-21T23:10:00.000Z` first. Three Headless Shell contexts at 1440×900, each signed in through a minted link:
- **Context 1** (browser time installed at the hub's fake now and running; frames the page sends are recorded): `events` reads the Inbox events line, opens Events from the rail, reads the `marks` push and `marks.get` from the frame client, the last-look rule and the rendered row ids against the hub's `events.list`, then on a focused row presses physical `w`, then `F` and `2`, then `F` (key value `я`), each time comparing the rendered ids with the hub's read under the same filter and the frames the page sent, then returns to the Inbox and reads its events line.
- **Context 2** (`Notification`, `document.visibilityState`, `document.hasFocus` and `window.focus` stubbed by an init script, the page hidden and unfocused, both switches saved on in `cland.ui.notifications.v1`, permission granted; browser animation time installed and **paused**, as in T-1128's race case): the fake Coordinator `qa-coord` asks in `T-900001`'s topic. `notify-ask` opens Sessions, splits, activates the secondary pane, asks, reads the notices, advances the hub clock, opens the palette and calls the notice's `onclick`, then reads the secondary pane's exact Inbox row and focus; `notify-looking` makes the page visible and focused and asks again; `notify-finished` hides the page and sets `T-900001` done through the frame client.
- **Context 3** (the page's WebSocket routed through Playwright: every frame passes, except that the page's first `approval.answer` for the race approval is held until released): a fake Codex session `qa-codex` and a fake Claude Code session `qa-claude` launched through `session.launch`. `approve-once` raises a long command (`printf "QA complete command …"`, 4 000 characters) with cwd and reason and clicks **1 · Approve once**; `deny-bare` opens **d · Deny**, types a note, presses Escape, reads the record, reopens Deny and sends it empty; `deny-note` sends Deny with `QA deny reason` by Enter; `tui` raises a Claude Code record with `answerIn: "tui"` and choices `once`, `deny`; `race` clicks Approve once, holds that frame, lets the frame client answer **always** first, releases the page's answer and reads the refusal, the card and the archive.

It asserts nothing about the product: every fact goes to `$QA_OUT` as one JSON line; a step that throws writes `{"step":{name,error}}` and the probe goes on. The Web fixture's own cleanup writes the census line.

```sh
cat > "$Q/probe.test.mjs" <<'JS'
// QA probe for E-417 stage 4 (node --test, sealed, cwd $QA_W): one sealed scratch hub through the Web harness, three
// Headless Shell contexts signed in by minted links, a fake Coordinator and fake Codex and Claude Code sessions. It
// asserts nothing about the product: every fact goes to $QA_OUT as one JSON line {"fact": value}; a step that throws
// writes {"step": {name, error}} and the probe goes on.
import test from 'node:test';
import { appendFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const W = process.env.QA_W, OUT = process.env.QA_OUT;
const { webFixture } = await import(`${W}/web/test/harness.ts`);
const { connectUi, inProcessSpoke } = await import(`${W}/hub/test/harness.ts`);
const { FakeClock } = await import(`${W}/hub/test/fake-clock.ts`);
const { seedItem } = await import(`${W}/web/test/items-fixture.ts`);
const out = (key, value) => appendFileSync(OUT, `${JSON.stringify({ [key]: value })}\n`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function step(name, body) { try { await body(); } catch (error) { out('step', { name, error: String(error?.message ?? error).slice(0, 400) }); } }
async function poll(read, done, ms = 3000) { let value = await read(); for (let i = 0; i < ms / 100 && !done(value); i++) { await sleep(100); value = await read(); } return value; }
const physical = (page, code, shiftKey = false) => page.evaluate(([code, shiftKey]) => document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { code, shiftKey, key: 'я', bubbles: true, cancelable: true })), [code, shiftKey]);
const ZERO = '△ 0 new events · ⚠ 0';
test('E-417 stage 4 QA probe', { timeout: 300000 }, async t => {
  const clock = new FakeClock(new Date('2026-10-23T12:00:00Z'));
  const fixture = await webFixture(t, { clock, timezoneId: 'Europe/Belgrade', prepare: async root => {
    await mkdir(join(root, '.cland'), { recursive: true });
    await seedItem(root, 'R-900000', 'release', 'QA release', { version: '99.0.0' });
    await seedItem(root, 'T-900001', 'task', 'QA notified task', { parent: 'R-900000', status: 'in progress', assignee: 'qa-worker' });
    const rows = Array.from({ length: 12 }, (_, n) => ({ ts: new Date(Date.parse('2026-10-21T23:00:00Z') + n * 300_000).toISOString(),
      event: n % 2 ? 'task-claimed' : 'notification', kind: 'verdict', item: `T-${n + 1}`, result: n % 3 === 0 ? 'not clear' : 'clear', text: `QA event ${n}` }));
    await writeFile(join(root, '.cland/journal.jsonl'), rows.map(row => JSON.stringify(row) + '\n').join(''));
  } });
  const ui = await connectUi(t, fixture.hub.discovery);
  await ui.request({ type: 'subscribe' });
  const previous = '2026-10-21T23:10:00.000Z';
  const ids = async filter => ((await ui.request({ type: 'events.list', limit: 200, ...(filter ? { filter } : {}) })).value.rows ?? []).map(row => row.id);
  out('seeded', { marks: (await ui.request({ type: 'marks.set', events: previous })).ok, now: clock.now().toISOString() });
  // Context 1: Events through the hub's filter and the shared last look.
  const sent = [];
  await fixture.pageCase(t, async page => {
    await step('events', async () => {
      const footer = page.locator('[data-inbox-events]');
      await footer.waitFor();
      const footerBefore = await footer.innerText();
      const marked = ui.waitFor(f => f.type === 'marks' && !!f.marks?.events && f.marks.events !== previous);
      await page.getByRole('button', { name: 'Events', exact: true }).click();
      const pushed = (await marked).marks.events;
      const marks = (await ui.request({ type: 'marks.get' })).value.marks.events;
      const list = page.getByRole('list', { name: 'Events objects', exact: true });
      await list.locator('[data-event-id]').first().waitFor();
      const shown = () => list.locator('[data-event-id]').evaluateAll(ns => ns.map(n => n.getAttribute('data-event-id')));
      const all = await ids();
      const boundary = await page.locator('[data-events-last-look]').getAttribute('data-events-last-look');
      const marksSet = sent.filter(f => f.type === 'marks.set').length;
      const result = { footerBefore, pushed, marks, notBeforeNow: Date.parse(marks) >= Date.parse(clock.now().toISOString()), boundary, marksSet, allCount: all.length, allEqual: JSON.stringify(await shown()) === JSON.stringify(all) };
      const settle = async text => { await poll(() => page.evaluate(() => [document.querySelector('[data-events-filter]')?.textContent ?? '', !!document.querySelector('[data-events-loading]')]), ([f, l]) => f.includes(text) && !l); };
      await list.locator('[data-event-id]').first().focus();
      await physical(page, 'KeyW');
      await settle('warnings only');
      const warnings = await ids({ warnings: true });
      result.warnings = { count: warnings.length, equal: JSON.stringify(await shown()) === JSON.stringify(warnings),
        subscribe: sent.some(f => f.type === 'subscribe' && JSON.stringify(f.filter) === '{"warnings":true}'), list: sent.some(f => f.type === 'events.list' && JSON.stringify(f.filter) === '{"warnings":true}') };
      await list.locator('[data-event-id]').first().focus();
      await physical(page, 'KeyF', true);
      await physical(page, 'Digit2');
      await settle('kind: task');
      const tasks = await ids({ kinds: ['task'] });
      result.task = { count: tasks.length, equal: JSON.stringify(await shown()) === JSON.stringify(tasks), list: sent.some(f => f.type === 'events.list' && JSON.stringify(f.filter) === '{"kinds":["task"]}') };
      await list.locator('[data-event-id]').first().focus();
      await physical(page, 'KeyF', true);
      result.cleared = { count: (await poll(shown, v => v.length === all.length)).length, filter: await page.locator('[data-events-filter]').innerText() };
      await page.getByRole('button', { name: 'Inbox', exact: true }).click();
      result.footerAfter = await poll(() => page.locator('[data-inbox-events]').innerText(), v => v === ZERO);
      result.marksSetAfter = sent.filter(f => f.type === 'marks.set').length;
      out('events', result);
    });
  }, async page => {
    await page.clock.install({ time: clock.now() });   // browser time starts at the hub's fake now and runs; nothing is paused here
    page.on('websocket', socket => socket.on('framesent', event => { try { sent.push(JSON.parse(String(event.payload))); } catch {} }));
  });
  // Context 2: open-page notifications with Notification, visibility and focus stubbed and animation time paused.
  const made = await ui.request({ type: 'topic.create', title: 'QA notify topic', item: 'T-900001' });
  const topic = made.value?.topic?.id;
  const coord = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'qa-coord', role: 'coordinator', sessionId: 'qa-e417s4-coord' });
  await coord.waitForPresence(['qa-coord']);
  const ask = async question => { const r = await coord.call('ask', { topic, question, options: ['Yes', 'Wait'], free: true }); await clock.advance(250); return r.ask; };
  out('seededTopic', { topic: made.ok });
  const notices = page => page.evaluate(() => globalThis.qaNotices.map(n => ({ title: n.title, body: n.options.body, tag: n.options.tag })));
  await fixture.pageCase(t, async page => {
    await step('notify-ask', async () => {
      await page.getByRole('button', { name: 'Sessions', exact: true }).click();
      await page.keyboard.press('Meta+Backslash');
      await page.locator('[data-pane="secondary"]').getByRole('heading', { name: 'Sessions', exact: true }).click();
      const id = await ask('QA ship it?');
      const first = await poll(() => notices(page), v => v.length >= 1);
      await clock.advance(250); await sleep(300);
      const again = (await notices(page)).length;
      await page.getByRole('button', { name: 'Palette', exact: true }).click();
      const paletteOpen = await page.getByRole('dialog', { name: 'Palette', exact: true }).count();
      await page.evaluate(() => globalThis.qaNotices[0].onclick());
      const row = page.locator(`[data-pane="secondary"] [aria-label="Inbox objects"] [data-object-id="${id}"]`);
      const focused = await poll(async () => await row.count() === 1 && await row.evaluate(n => n === document.activeElement), v => v === true);
      out('notifyAsk', { id, notices: first, countAfterAdvance: again, paletteOpen, mounted: await row.count(), focused, paletteAfter: await page.getByRole('dialog', { name: 'Palette', exact: true }).count(),
        focusCalls: await page.evaluate(() => globalThis.qaFocusCalls), question: await page.locator(`[data-ask-id="${id}"]`).first().getByRole('heading', { name: 'QA ship it?', exact: true }).count() });
    });
    await step('notify-looking', async () => {
      await page.evaluate(() => { globalThis.qaLooking = { visible: true, focused: true }; });
      const id = await ask('QA looking question');
      await page.locator(`[data-object-id="${id}"]`).first().waitFor();
      await sleep(300);
      out('notifyLooking', { id, notices: (await notices(page)).length });
    });
    await step('notify-finished', async () => {
      await page.evaluate(() => { globalThis.qaLooking = { visible: false, focused: false }; });
      const done = await ui.request({ type: 'task.edit', item: 'T-900001', status: 'done' });
      const all = await poll(() => notices(page), v => v.length >= 2);
      out('notifyFinished', { edited: done.ok, notices: all.slice(1) });
    });
  }, async page => {
    await page.clock.install({ time: clock.now() });
    await page.clock.pauseAt(clock.now());
    await page.addInitScript(() => {
      globalThis.qaNotices = []; globalThis.qaLooking = { visible: false, focused: false }; globalThis.qaFocusCalls = 0;
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => globalThis.qaLooking.visible ? 'visible' : 'hidden' });
      document.hasFocus = () => globalThis.qaLooking.focused;
      window.focus = () => { globalThis.qaFocusCalls++; globalThis.qaLooking = { visible: true, focused: true }; };
      class QaNotification {
        static permission = 'granted';
        static async requestPermission() { return 'granted'; }
        constructor(title, options) { this.title = title; this.options = options; globalThis.qaNotices.push(this); }
        close() {}
      }
      Object.defineProperty(globalThis, 'Notification', { configurable: true, value: QaNotification });
      localStorage.setItem('cland.ui.notifications.v1', JSON.stringify({ needsYou: true, finished: true }));
    });
  });
  // Context 3: approval cards answered through the hub's gate.
  const launched = { codex: (await ui.request({ type: 'session.launch', name: 'qa-codex', harness: 'codex' })).ok, claude: (await ui.request({ type: 'session.launch', name: 'qa-claude', harness: 'claude-code' })).ok };
  out('seededApprovals', launched);
  const codex = fixture.fakes.codex, claude = fixture.fakes['claude-code'];
  const raise = async (fake, session, id, subject, choices, answerIn) => {
    fake.raiseApproval(session, { id, kind: 'command', subject, choices, answerIn });
    await clock.advance(250);
    return (await ui.request({ type: 'inbox.list' })).value.approvals.find(row => row.session === session && row.id.endsWith(`:${id}`))?.id;
  };
  const archived = async id => (await ui.request({ type: 'inbox.list', archive: true })).value.archive?.find(row => row.id === id)?.outcome ?? null;
  const race = { id: '', answerId: '', release: undefined, result: undefined };
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Inbox', exact: true }).click();
    const open = async id => { const row = page.locator(`[data-object-id="${id}"]`); await row.click(); return { row, card: row.locator('..').getByRole('region', { name: 'Command approval', exact: true }) }; };
    await step('approve-once', async () => {
      const command = 'printf "' + 'QA complete command '.repeat(200) + '\\n"';
      const id = await raise(codex, 'qa-codex', 'qa-once', { command, cwd: '/scratch/qa', reason: 'QA check' }, ['once', 'always', 'deny'], 'hub');
      const { row, card } = await open(id);
      const full = (await card.locator('pre').textContent()) === command;
      const buttons = await card.getByRole('button').allInnerTexts();
      await card.getByRole('button', { name: '1 · Approve once', exact: true }).click();
      const outcome = row.locator('..').locator('[data-approval-outcome]');
      await outcome.waitFor();
      out('approveOnce', { id, full, buttons, outcome: (await outcome.innerText()).replace(/\s+/g, ' '), archive: await archived(id), answer: codex.approvalAnswers.at(-1) ?? null });
    });
    await step('deny-bare', async () => {
      const before = codex.approvalAnswers.length;
      const id = await raise(codex, 'qa-codex', 'qa-deny-bare', { command: 'echo QA deny bare' }, ['once', 'always', 'deny'], 'hub');
      const { row, card } = await open(id);
      await card.getByRole('button', { name: 'd · Deny', exact: true }).click();
      const note = card.getByRole('textbox', { name: 'Denial note', exact: true });
      await note.fill('QA discarded note');
      await note.press('Escape');
      await note.waitFor({ state: 'detached' });
      await sleep(300);
      const afterEscape = { answers: codex.approvalAnswers.length - before, state: (await ui.request({ type: 'inbox.list' })).value.approvals.find(r => r.id === id)?.state ?? null };
      await card.getByRole('button', { name: 'd · Deny', exact: true }).click();
      const reopened = await note.inputValue();
      const submitDisabled = await card.getByRole('button', { name: 'Deny', exact: true }).isDisabled();
      await card.getByRole('button', { name: 'Deny', exact: true }).click();
      const outcome = row.locator('..').locator('[data-approval-outcome]');
      await outcome.waitFor();
      out('denyBare', { id, afterEscape, reopened, submitDisabled, outcome: (await outcome.innerText()).replace(/\s+/g, ' '), archive: await archived(id), answers: codex.approvalAnswers.slice(before) });
    });
    await step('deny-note', async () => {
      const before = codex.approvalAnswers.length;
      const id = await raise(codex, 'qa-codex', 'qa-deny-note', { command: 'echo QA deny note' }, ['once', 'always', 'deny'], 'hub');
      const { row, card } = await open(id);
      await card.getByRole('button', { name: 'd · Deny', exact: true }).click();
      const note = card.getByRole('textbox', { name: 'Denial note', exact: true });
      await note.fill('QA deny reason');
      await note.press('Enter');
      const outcome = row.locator('..').locator('[data-approval-outcome]');
      await outcome.waitFor();
      out('denyNote', { id, outcome: (await outcome.innerText()).replace(/\s+/g, ' '), archive: await archived(id), answers: codex.approvalAnswers.slice(before) });
    });
    await step('tui', async () => {
      const id = await raise(claude, 'qa-claude', 'qa-tui', { command: 'echo QA TUI only' }, ['once', 'deny'], 'tui');
      const { card } = await open(id);
      await card.getByText('Answer in Neovim', { exact: true }).waitFor();
      const record = (await ui.request({ type: 'inbox.list' })).value.approvals.find(r => r.id === id);
      out('tui', { id, answerIn: record?.answerIn ?? null, harness: record?.harness ?? null, command: await card.locator('pre').textContent(), buttons: await card.getByRole('button').count() });
    });
    await step('race', async () => {
      const before = codex.approvalAnswers.length;
      race.id = await raise(codex, 'qa-codex', 'qa-race', { command: 'echo QA race' }, ['once', 'always', 'deny'], 'hub');
      const { row, card } = await open(race.id);
      await card.getByRole('button', { name: '1 · Approve once', exact: true }).click();
      await poll(() => !!race.release, v => v);
      const peer = await ui.request({ type: 'approval.answer', approval: race.id, choice: 'always' });
      race.release();
      const result = await poll(() => race.result, v => !!v);
      const outcome = row.locator('..').locator('[data-approval-outcome]');
      await outcome.waitFor();
      out('race', { id: race.id, held: !!race.answerId, peer: peer.ok, pageResult: result ?? null, outcome: (await outcome.innerText()).replace(/\s+/g, ' '), archive: await archived(race.id),
        answers: codex.approvalAnswers.slice(before).map(a => a.choice), alerts: await row.locator('..').getByRole('alert').count() });
    });
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      route.onMessage(message => {
        let frame; try { frame = JSON.parse(String(message)); } catch { server.send(message); return; }
        if (frame.type === 'approval.answer' && race.id && frame.approval === race.id && !race.answerId) { race.answerId = frame.id; race.release = () => server.send(message); }
        else server.send(message);
      });
      server.onMessage(message => {
        try { const frame = JSON.parse(String(message)); if (frame.type === 'result' && race.answerId && frame.id === race.answerId) race.result = { ok: frame.ok, error: frame.error ?? null }; } catch {}
        route.send(message);
      });
    });
  });
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
  (cd "$W" && node hub/bin/cland.ts task plan show E-417 --json) > "$EV/E417S4-00-plan.json"
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=v.stages.find(x=>x.name==="events, notifications and approvals");console.log(JSON.stringify({stages: v.stages.map(x=>x.name), state: s.state, qa: s.qa, merged: s.merged, total: s.total, items: s.items}))' "$EV/E417S4-00-plan.json" | tee "$EV/E417S4-00-stage.txt"
  for i in $(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).stages.find(x=>x.name==="events, notifications and approvals").items.join(" "))' "$EV/E417S4-00-plan.json"); do echo "== $i"; git -C "$W" log --first-parent --oneline --grep "Item: $i" dev; done
  ls "$W/web/src/EventsArea.tsx" "$W/web/src/events-feed.ts" "$W/web/src/notification-rules.ts" "$W/web/src/notification-state.ts" "$W/web/src/browser-notifications.ts" "$W/web/src/ApprovalCard.tsx" "$W/web/src/SessionRecentThread.tsx" "$W/web/test/events.test.ts" "$W/web/test/notifications.test.ts" "$W/web/test/inbox.test.ts" "$W/hub/test/web-notifications.test.ts"
  grep -c -F 'export async function reconnectUntilLive(page: Page)' "$W/web/test/harness.ts"
  for i in T-1127 T-1128 T-1129 T-1164; do c=$(git -C "$W" log --first-parent --format=%H --grep "Item: $i" dev); echo "== $i paths outside web/ and docs/"; [ -n "$c" ] && git -C "$W" show --format= --name-only "$c" | grep -v -E '^(web/|docs/)'; done
  echo "TMPDIR=$TMPDIR Q=$Q"
}
k07() {   # QA shell: the key map of Events and the approval card; the notification switches; the thread r binding
  grep -n -F "events: { KeyS: 'events-subject', Enter: 'events-open', KeyJ: 'events-next'," "$W/web/src/keymap.ts"
  grep -n -F "approval: { Digit1: 'approval-once', Digit2: 'approval-always', KeyD: 'approval-deny', Escape: 'approval-cancel' }," "$W/web/src/keymap.ts"
  grep -n -F "'approval-note': { Escape: 'approval-cancel' }," "$W/web/src/keymap.ts"
  grep -c -E "Escape: 'approval-(once|always|deny)'" "$W/web/src/keymap.ts"
  for l in "{ action: 'approval-once', label: 'Approve once' }" "{ action: 'approval-deny', label: 'Deny with optional note' }" "{ action: 'approval-cancel', label: 'Cancel denial' }" "{ action: 'events-warnings', label: 'Toggle warnings only' }" "{ action: 'events-clear', label: 'Clear Events filter' }" "{ action: 'events-older', label: 'Load 200 older events' }"; do printf '%s ' "$(grep -c -F -- "$l" "$W/web/src/keymap.ts")"; echo "$l"; done
  echo "-- notification switches (Profile, not the palette)"; grep -n -o -F -e "['needsYou', 'Needs you'," -e "['finished', 'Finished'," -e 'role="switch"' -e 'aria-label="Notifications"' "$W/web/src/accounts/Profile.tsx"
  grep -c -E "notifications-(needs-you|finished)|Notifications · " "$W/web/src/Palette.tsx" "$W/web/src/Shell.tsx" "$W/web/src/keymap.ts"
  echo "-- thread r"; grep -n -F -e "const threadKeys = { KeyR: 'inbox-reply'," -e "  thread: threadKeys," -e "  thread: [{ action: 'inbox-reply', label: 'Reply to Inbox sender' }," "$W/web/src/keymap.ts" | cut -c1-120
}
k08() {   # sealed, in $W: the QA probe (one Headless Shell scratch hub; facts to $EV/E417S4-08.jsonl)
  : > "$EV/E417S4-08.jsonl"                    # start the fact file empty
  ( cd "$QA_W" && QA_OUT="$EV/E417S4-08.jsonl" node --test --test-reporter=tap "$QA_Q/probe.test.mjs" > "$EV/E417S4-08.log" 2>&1; echo "exit $?" >> "$EV/E417S4-08.log" )
  tail -n 1 "$EV/E417S4-08.log"; grep -E '^# (tests|pass|fail) |Web fixture census' "$EV/E417S4-08.log"
  cat "$EV/E417S4-08.jsonl"
}
k09() {   # sealed, in $W: the full typecheck with the web guards, the tier lint and the stage's classifications
  ( cd "$QA_W" && npm run typecheck > "$EV/E417S4-09.log" 2>&1; echo "typecheck exit $?"; node hub/test/lint-tiers.ts > "$EV/E417S4-09-tiers.log" 2>&1; echo "tiers exit $?" )
  grep -F -e 'web HTML: raw-HTML sinks refused; seeded fixtures passed' -e 'web colours: token-only sources; colour fixtures passed' -e 'web tokens:' -e 'web hooks: conditional-hook fixture rejected by configured oxlint' "$EV/E417S4-09.log"
  grep -F -e '"web/test/events.test.ts": "Web"' -e '"web/test/notifications.test.ts": "Web"' -e '"web/test/inbox.test.ts": "Web"' -e '"hub/test/web-notifications.test.ts": "T1"' "$QA_W/hub/test/tiers.json"
}
k10() {   # QA shell: AGENTS.md web/ rules at the build
  git -C "$W" grep -n -E "keydown|keyup|keypress|onKey(Down|Up|Press)" -- web/src
  git -C "$W" grep -n -E "localStorage|sessionStorage" -- web/src
  git -C "$W" grep -n -E "dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML" -- web/src
  echo "-- notifications"; git -C "$W" grep -n -E "new Notification\(|serviceWorker|PushManager|addEventListener\('(storage|focus)'" -- web/src
  for i in T-1127 T-1128 T-1129 T-1164; do c=$(git -C "$W" log --first-parent --format=%H --grep "Item: $i" dev); echo "== $i"; [ -n "$c" ] && git -C "$W" show --format= "$c" -- package.json package-lock.json web/package.json hub/package.json nvim/package.json | grep -E '^[+-] '; done
}
k11() {   # docs, in QA's own shell
  ( cd "$W" || exit 1
    chk() { printf '%s present %s: %s\n' "$(grep -c -F -- "$2" "$1")" "$1" "$2"; }
    chk web/README.md '| `r` | Thread opened from an Inbox request or message, outside ask rows and fields | Reply to Inbox sender |'
    chk web/README.md 'Topics, Events, Artifacts and Accounts have their area views.'
    chk web/README.md "Events shows the newest 200 rows matching the hub's filter, newest first under"
    chk web/README.md '| `w` | Toggle warnings only |'
    chk web/README.md '| `F` | Clear the filter |'
    chk web/README.md 'Opening Events sends `marks.set` once per visit. The previous shared last look'
    chk web/README.md 'The **Profile** block in **Accounts** offers **Needs you** and **Finished**,'
    chk web/README.md 'independent on/off switches saved per browser and origin. They are absent from'
    chk web/README.md 'this sign-in has the **Needs you** and **Finished** switches. Turning either'
    chk web/README.md "Needs you considers a row when it enters the hub's Inbox: asks, approvals, plans,"
    chk web/README.md 'and archive work stays silent. Neither switch notifies while the page is both'
    chk web/README.md 'No service worker or closed-page push is installed here.'
    chk web/README.md 'The reusable `ApprovalCard` shows the session, harness, original start time and'
    chk web/README.md 'approval says **Answer in Neovim** and has no answer controls. Offline and pending'
    chk web/README.md 'optional note; Enter or Deny sends it, and Escape or Cancel discards the note'
    chk web/README.md '| `Esc` in an approval denial | Cancel without answering |'
    chk web/README.md '| `1`, `2` on an approval row or card | Approve once, always for this command |'
    chk web/README.md "record and the session's latest 20 messages across topics through \`session.history\`."
    chk hub/README.md "Open-page browser notifications use the hub's Inbox row layers and task transitions;"
    chk hub/README.md 'has no notification actions. Only Now work'
    chk hub/README.md "The Web Inbox's reusable approval card displays the full public subject and"
    chk docs/agents/tests.md '`hub/test/web-notifications.test.ts` owns the T1 pure notification eligibility,'
    chk docs/agents/tests.md '`web/test/events.test.ts` owns the authenticated Events journal seam through'
    chk docs/agents/tests.md '`web/test/inbox.test.ts` also owns the reusable approval-card seam (T-1129):'
    echo "-- T-1164 C2: stale statements (each must print 0)"
    chk web/README.md 'stand-in'
    chk web/README.md 'snapshot client'
    chk web/README.md 'until the snapshot client lands'
    chk web/README.md 'Inbox and Events keep their existing stand-ins.'
    echo "-- superseded by T-1142 (each must print 0)"
    chk web/README.md 'Notification switches join this block'
    chk web/README.md 'the palette offers **Notifications'
    chk hub/README.md "The browser's palette offers"
    echo "-- statements to read against the implementation (candidates for low findings)"
    grep -n -F 'Notifications ·' web/README.md hub/README.md docs/agents/tests.md
    grep -n -i -E 'not yet|pending area|until (E-41[0-9]|T-11[0-9][0-9]) lands' web/README.md )
}
k14() {   # QA shell: cleanup of the fixture-owned processes and the scratch root
  for f in "$EV"/E417S4-0[2-8]*.log; do printf '%s ' "$(basename "$f")"; census "$(basename "$f" .log)" | tr '\n' ' '; echo; done
  git -C "$W" status --porcelain | grep -v -x -F '?? node_modules' | wc -l
  echo "$Q"
}
```

Cleanup after the evidence is recorded: print `$Q`, check it begins with `/private/tmp/qa-e417s4-`, and remove it by that literal path with a non-force `rm -r`. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). A failed Web case writes a Playwright trace under `$W/web/test-results/`; name it as evidence before removing the worktree. Sign-in links and cookies are never printed or posted.

## Cases

none. No headless-grid case covers the web Events view, notifications or approval cards; every check below is a manual check through named test files, the QA probe's Headless Shell pages, git greps, the CLI or the docs, recorded with `qa-record.sh note`.

### Web cases (when in scope)

none: no `real-browser` case in this run (see "Out of scope"). Every stage criterion is proven in Chrome Headless Shell against signed-in sealed scratch hubs, with `Notification` and visibility stubbed (E417S4-02 to E417S4-08).

## Manual checks

Record each with `sh .agents/skills/qa/qa-record.sh note E-417 "$RUN" <id> hub-api "<command>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence-file…>` from `$W` in QA's own shell, naming where it ran at the start of the command text (`[QA shell]`, `[test $W]`, `[sealed $W]`, `[docs]`). The recorder takes `hub-api` for every check here; the probe's page steps are Headless Shell observations recorded the same way. Save each check's printed output as `$EV/<id>.txt` (pipe the row's command through `tee`) and name it, with the captures the row wrote, as evidence.

How to run a row, by its `where`:
- **sealed $W**: `quiet && ( . "$Q/env.sh"; cd "$W" && <command> )`.
- **test $W**: in QA's own shell; `nt` runs `quiet` first and seals the test run itself. Judge each by its `exit` line, the TAP summary counts and the named tests on `ok` lines (`oks <id>` lists them; a name that appears on no `ok` line proves nothing).
- **docs** and **QA shell**: in QA's own shell, as QA; the plan reads of E417S4-00 and E417S4-13 are the only checks that touch the live hub, and only to read.

Order: E417S4-00 and the setup; E417S4-01 before any Web file or the probe (every Web file and the probe's web edge serve the bundle it builds); then the rows in id order. Every named test log (`nt`) must show `exit 0`, `# fail 0`, `# cancelled 0`, `# skipped 0`, `# todo 0`, `# pass` equal to `# tests`, no `not ok` and no `# SKIP`; every Web log's `census` prints a first count of at least `1` and a second count of `0`. A `# tests` count that differs from the number at writing must equal the file's own count of `test(` and `t.test(` calls at the build (renames and additions happen; files with loops or subtests, such as palette's viewport loop, are judged by their names); every test named below must appear in `oks`.

| id | surface | where | covers | command | expected |
| --- | --- | --- | --- | --- | --- |
| E417S4-00 | hub-api | QA shell | build, plan, merges, sealing | `k00 \| tee "$EV/E417S4-00.txt"` | Both SHAs equal `$S`; `0` changed paths; the symlink reads `/Users/evgeniyivanov/Projects/cland/v0/node_modules`. The plan lists the stages `thread groundwork`, `message block, runs and asks`, `inbox and composer`, `events, notifications and approvals`; stage `events, notifications and approvals` has `qa` `{scope: "affected", when: "after-stage"}`, `state` not `closed` (it closes only after this verdict and the covers), `items` T-1127, T-1128, T-1129, T-1164 plus any findings fixes the request names (nothing else), `total` equal to the number of printed items and `merged` equal to `total`; record the printed line as printed. Under every `== <id>` line exactly one commit line (T-1127 `5d7c9082`, T-1128 `68209237`, T-1164 `e196c1ac`, T-1129 `720842c2` at writing); a missing line is BLOCKED "<id> not on dev". T-1142 (`4624720e`) is not a stage member and prints under no id. All eleven files listed and `1` (the shared reconnect helper of T-1178). Paths outside `web/` and `docs/`: under T-1127 `.agents/skills/implement/CHANGES`, `.agents/skills/implement/SKILL.md`, `hub/test/durations.json`, `hub/test/tiers.json`; under T-1128 the two skill files, `hub/README.md`, `hub/test/tiers.json`, `hub/test/web-notifications.test.ts`; under T-1129 the two skill files and `hub/README.md`; under T-1164 nothing. No `hub/src/`, `shared/` or `nvim/` path under any id. `TMPDIR` is the system default (not `/tmp`) and `Q` begins `/private/tmp/qa-e417s4-`. Also record the setup's two counts (the first at least `1`, the second `0`) and `probe parses`. Repeat the first two commands after E417S4-14: unchanged (dev not moved) |
| E417S4-01 | hub-api | sealed $W | build | `npm run build > "$EV/E417S4-01.log" 2>&1; echo "build exit $?"; ls web/dist/index.html web/dist/assets; git status --porcelain \| grep -v -x -F '?? node_modules' \| wc -l` | `build exit 0`; `web/dist/index.html` and the `assets` directory listed; `0` changed paths (`web/dist` is ignored) |
| E417S4-02 | hub-api | test $W | T-1127 C1–C4 | `nt E417S4-02 web/test/events.test.ts; oks E417S4-02; census E417S4-02` | Web, clean (`# tests 11` at writing), census `11` and `0` at writing. `oks` lists "Events groups newest 200 by local day and appends bounded older pages by button and physical A" (C1: the first 200 of 405 journal rows in the hub's order under a `Fri 23 Oct` day heading; the `A · 200 older events` button and physical `Shift+KeyA` append the next pages until the control is gone), "Events filters the subscription and pages in the hub, preserves filters on reload and clears with physical F" (C2: physical `w` shows exactly the hub's `{warnings:true}` rows, with a `subscribe` and an `events.list` frame carrying that filter; `F` then `2` shows exactly the hub's `{kinds:["task"]}` rows, kept after reload; `0` returns 200 rows), "Events dims bookkeeping, shows hub coalescing, folds a local day with za and opens an item with Enter" (C3), "physical s selects an Events subject in the palette and Enter opens topic, session and artifact subjects" (C3, Enter on a topic, session and artifact subject), "opening Events shares the last look, marks newer rows for the visit and clears the Inbox events line" (C4: the frame client receives the `marks` push and reads it with `marks.get`; the rule carries the previous look; the newer rows are marked; the Inbox events line reads `△ 0 new events · ⚠ 0`), and "live Events retain the 200-row cap, page without gaps and follow the selected coalescing identity", "held Events pages preserve newer coalescing pushes and obsolete filter replies cannot replace the current filter", "an Inbox alongside filtered Events still counts new events outside that filter", "Events help keeps every key reachable by native scrolling in a small viewport", "Events refreshes its filtered feed after a hub restart without replaying the last-look write", "rail digits navigate while its other keys keep the active area and focused Events rows keep kind filters". The subject-navigation identity carries a dated 6.8 s duration allowance (owner E-417, expires 2026-10-30); duration lines are report-only here |
| E417S4-03 | hub-api | test $W | T-1128 C1–C4 | `nt E417S4-03a web/test/notifications.test.ts; oks E417S4-03a; census E417S4-03a; nt E417S4-03b hub/test/web-notifications.test.ts; oks E417S4-03b` | Web, clean (`# tests 8` at writing), census `8` and `0` at writing. `oks E417S4-03a` lists "hidden now ask raises one named notification whose click focuses and opens its Inbox row" (C1: one notice `{title: "coord · T-900001", body: "Ship the plan?", tag: <ask id>}`, still one after the hub clock advances; with the secondary pane active, the palette open and browser animation time paused, the click focuses exactly the secondary pane's Inbox row with that id, closes the palette, shows the question and calls `window.focus` once), "looking, disabled and watch-layer asks stay silent without later replay" (C2: visible and focused, switched off, and a muted topic's `watch` ask raise none; a reload replays none), "hidden now task reaching done notifies once and its click opens the item card" (C3: `{title: "worker · T-900001", body: "Finished · Notification task", tag: "T-900001"}` once; the click opens the `Item card` region for `T-900001`, palette closed), "profile switches persist Finished off across reload and request permission only on first enable" (C4 at the Profile placement: the Accounts **Profile** region holds exactly two `switch`es **Needs you** and **Finished**, both off; physical Enter on Needs you turns it on with `permissionRequests` `1`; the palette searched for `>Notifications` offers no `Notifications · Needs you|Finished` action; Finished toggles on and off without a second request; after a reload Needs you stays on and Finished off; toggling again keeps `permissionRequests` `1`), "denied permission keeps both switches off with a browser-settings tooltip", "revoked browser permission disables saved switches on reload and explains why", "one browser shares switch changes between its open tabs", "a task moved out of Now by another item delta stays silent when it later finishes". T1, clean (`# tests 4` at writing): `oks E417S4-03b` lists "a now ask names its session, item and question with a stable row target", "notification policy suppresses looking, disabled, ungranted and non-now rows", "approval, plan, request and message notifications name the available session and work facts", "finished uses the task pre-transition layer and session, never a container or an already done row" |
| E417S4-04 | hub-api | test $W | T-1129 C1–C4; T-1127 C4 (the Inbox side); the stage-3 Inbox regression | `nt E417S4-04 web/test/inbox.test.ts; oks E417S4-04; census E417S4-04` | Web, clean (`# tests 22` at writing, at `720842c2`: stage 3's 16 plus T-1129's six), census `22` and `0` at writing. `oks` lists T-1129's "approval card shows the complete command and session facts, then folds to the human once outcome" (C1: the `pre` holds the full command (`printf "` plus `complete command ` 300 times); `race-worker` and `codex`; `since`; buttons `1 · Approve once`, `2 · Always for this command`, `d · Deny`; the fold reads `Approved once by the human … web`; the frame client's archive outcome `{choice: "once", by: "human", via: "web"}`; physical `2` answers `always`), "Escape cancels a denial without answering and Deny accepts an optional note" (C2: Escape in the note answers nothing, the record stays `pending`, focus returns to Deny; Deny without a note reaches the record with no `note`; a typed `Wait for review` reaches it), "approval cards retain the complete file change and TUI-only records have no answer buttons" (C3: the Claude Code record shows `Answer in Neovim` and `0` buttons; the same boundary covers E-414's adapter/payload-cap fallback, a Codex record revalidated to `answerIn: "tui"` with no choices loses its buttons), "selecting an approval shows the session recent thread in the drawer", "selecting another approval from one session refreshes recent messages and fences a held prior read" (the M1 fix), "approval delivery stays pending until its receipt and failure preserves the denial draft for a manual retry"; the earlier approval names "a refused approval race recovers only its exact archived winner and preserves a newer Inbox row" (C4: the page's held answer is refused, the card folds to `Approved always … human … neovim`, newer rows and the Inbox count kept, no alert), "a fresh epoch recovers an approval answered by a peer while this browser was offline", "asks and approvals share newest-first rows and the selected approval answers with Neovim keys", "split approval detail follows revalidation and peer closure after leaving the Inbox visit", "a held approval recovery cannot overwrite a newer same-id TUI authorization delta"; the events-footer names "the events footer survives four empty sections and follows shared last-look marks and warnings" and "the events footer counts all unread pages including a warning older than the newest 200" (T-1127 C4's Inbox side); and stage 3's "Inbox keeps four ordered sections, newest five rows, oldest wait, live ages and saved folds", "selected request and message unfold, physical d declines to the sender or reads exactly that row", "Enter opens an Inbox message at its anchored thread row and a waiting plan in Plan", "Inbox drawer follows the selected message and physical r replies to its fake sender", "answered Inbox asks fold until leaving, and a non-Inbox pane focus clears the visit and selection", "A opens seven days of Inbox departures with outcomes and an archive line below empty sections", "Inbox answer keys remain visible through a complete native keyboard scroll in a small viewport", "In Inbox reveals an older-than-five ask through a saved fold and focuses its secondary-pane card", "held successful read and decline replies preserve newer pushed Inbox rows and counts". The navigation identity "Enter opens an Inbox message …" carries a dated 9.6 s duration allowance (owner E-417, expires 2026-10-30); duration lines are report-only here. If T-1129 landed with a newer head, a renamed or added approval test is judged by the file's own count and its names at the build, and must still cover C1–C4 as above |
| E417S4-05 | hub-api | test $W | the gate the cards answer through (E-414, unchanged by this stage): one winner, human only, optional note, the payload-cap TUI fallback | `nt E417S4-05 hub/test/approval-records.test.ts hub/test/codex-native.test.ts; oks E417S4-05` | T2, clean (`# tests 47` at writing: 17 and 28 tests plus subtests). `oks` lists "two clients in one tick reserve one winner before adapter confirmation and refuse the loser with attribution" and "a human answer reaches the adapter once and both clients observe the attributed closed record" (T-1129 C4's hub side), "only the human may answer: every agent role including Aides is refused on socket and spoke", "unoffered choices and TUI-only approvals refuse answers without changing their records", "deny remains deny and a note the native protocol cannot carry is a human message to the session in General" (ask 9a81a158: the note optional), "public approval subjects cap UTF-8 at 64 KiB, preserve small changes and exclude private tool input", "Codex relays only complete command and file subjects within the exact serialized UTF-8 cap" and "malformed Codex command requests fall back to the TUI with a warning and never send a decision" (the 23:30Z decision: an incomplete or oversized subject becomes a TUI record without choices), "a Codex request resolved by another client closes for every subscribed client", "Claude Code waiting episode is one stable TUI approval record in the snapshot" |
| E417S4-06 | hub-api | test $W | regression of the files the four items changed or share | `nt E417S4-06a web/test/area-slots.test.ts; census E417S4-06a; nt E417S4-06b web/test/key-contexts.test.ts; oks E417S4-06b; census E417S4-06b; nt E417S4-06c web/test/palette.test.ts; oks E417S4-06c; census E417S4-06c; nt E417S4-06d web/test/shell.test.ts; census E417S4-06d; nt E417S4-06e web/test/session-launch.test.ts; census E417S4-06e; nt E417S4-06f web/test/sessions.test.ts; census E417S4-06f; nt E417S4-06g web/test/session-actions.test.ts; census E417S4-06g; nt E417S4-06h web/test/asks.test.ts; census E417S4-06h; nt E417S4-06i web/test/composer.test.ts; census E417S4-06i; nt E417S4-06j web/test/connection.test.ts; census E417S4-06j; nt E417S4-06k web/test/topics.test.ts; census E417S4-06k; nt E417S4-06l web/test/accounts.test.ts; oks E417S4-06l; census E417S4-06l` | Each file clean (`Shell.tsx`, `AreaSlot.tsx`, `Palette.tsx`, `connection.ts`, `keyboard.ts`, `keymap.ts`, `InboxArea.tsx`, `ComposerPicker.ts`, `use-event-summary.ts` changed, and on the build T-1142's `accounts/Profile.tsx`; T-1127 asks for session-launch, sessions and shell after shared context routing; T-1178's helper is used by area-slots, asks, composer, connection, session-actions, session-launch, topics). At writing by `test(` count: key-contexts `3` (`oks` lists "declared composer fields own their keys while ordinary fields retain native input", "area modules keep selection and drawers and session launch actions appear in help and palette"), session-launch `9`, sessions `5`, session-actions `9`, asks `9`, composer `8`, topics `9`, accounts `6` (`oks` lists "Accounts profile shows this browser sign-in, last use and fixed 30-day cookie expiry" and "Accounts profile excludes a second browser context sign-in on the same hub": the Profile block that now holds the switches still renders its sign-in facts); area-slots, shell and connection hold loops or subtests (stage 3 ran `4`, `9` and `4`): judge them clean with every `ok`; palette judged by names: `oks` lists "area help and every displayed shell chord work by physical code with Cyrillic key values" (help now holds 24 key labels for Events). **Known flake T-1157** (Topics Retry wait, "a rejected earlier page retries with its old top message anchored", `locator.waitFor: Timeout 3000ms` on the Retry button): if that one case fails, rerun `nt E417S4-06k-rerun web/test/topics.test.ts` once; if the rerun is clean, record the first failure against T-1157 in the row's note (not a finding) and judge the rerun; any other failure, or a second failure, is FAIL |
| E417S4-07 | hub-api | test $W; QA shell | the one key map: Events, approval and approval-note contexts; Escape never answers; the notification switches in the Profile block, none in the palette (T-1142); the thread `r` binding (T-1164 C1) | `nt E417S4-07 hub/test/web-keymap.test.ts; oks E417S4-07; k07` | T1, clean (`# tests 2` at writing): `oks` lists "focused contexts resolve before shell keys without changing Items or Plan chords" and "browser tab/window chords remain unbound and area shortcuts require exact modifiers". `k07`: one line each for the `events` binding (`KeyS` subject, `Enter` open, `KeyJ` next), the `approval` binding (`Digit1` once, `Digit2` always, `KeyD` deny, `Escape` cancel) and the `approval-note` binding (`Escape` cancel only); then `0` (no Escape bound to an answering approval action); then six lines whose leading count is at least `1` (`Cancel denial` is `2` at writing: declared in both contexts) for the help labels `Approve once`, `Deny with optional note`, `Cancel denial`, `Toggle warnings only`, `Clear Events filter`, `Load 200 older events`; after `-- notification switches` four `Profile.tsx` matches (`['needsYou', 'Needs you',`, `['finished', 'Finished',`, `role="switch"`, `aria-label="Notifications"`), then three lines ending `web/src/Palette.tsx:0`, `web/src/Shell.tsx:0` and `web/src/keymap.ts:0` (no notification palette action or shortcut remains); after `-- thread r` three lines: `threadKeys` beginning `KeyR: 'inbox-reply'`, the `thread` context using `threadKeys`, and the `thread` help beginning with `Reply to Inbox sender` (the binding T-1164's README row documents) |
| E417S4-08 | hub-api | sealed $W | T-1127 C2, C4; T-1128 C1–C3; T-1129 C1–C4 (independent probe) | `k08` | `exit 0`, `# tests 1`, `# pass 1`, `# fail 0`, one `Web fixture census: browser group <pid>; before <n>; after 0; scratch hub stopped` line, no `step` line. `seeded` `{marks: true, now: "2026-10-23T12:00:00.000Z"}`. `events`: `footerBefore` not `△ 0 new events · ⚠ 0` (`△ 9 new events · ⚠ 1` at writing); `pushed` equal to `marks` (the frame client's push and its `marks.get` agree) and `notBeforeNow: true` (the new look is the page's opening time, not older than the hub's fake now); `boundary: "2026-10-21T23:10:00.000Z"` (the previous look kept as the visit's rule); `marksSet: 1`; `allCount: 12`, `allEqual: true`; `warnings` `{count: <n>, equal: true, subscribe: true, list: true}` with `n` at least `1` and below `12` (`2` at writing); `task` `{count: <n>, equal: true, list: true}` with `n` at least `1` and below `12` (`6` at writing); `cleared` `{count: 12, filter: "kind: all · all levels · subject: any"}`; `footerAfter: "△ 0 new events · ⚠ 0"`; `marksSetAfter: 1` (one write per visit). `seededTopic` `{topic: true}`. `notifyAsk`: `notices` exactly `[{title: "qa-coord · T-900001", body: "QA ship it?", tag: <its id>}]` (session, item, question; the row id as tag), `countAfterAdvance: 1`, `paletteOpen: 1`, `mounted: 1`, `focused: true` (the exact secondary-pane Inbox row focused with animation time paused), `paletteAfter: 0`, `focusCalls: 1`, `question: 1`. `notifyLooking`: `notices: 1` (no new notice while visible and focused). `notifyFinished`: `edited: true`, `notices` exactly `[{title: "qa-worker · T-900001", body: "Finished · QA notified task", tag: "T-900001"}]`. `seededApprovals` `{codex: true, claude: true}`. `approveOnce`: `full: true`, `buttons` `["1 · Approve once", "2 · Always for this command", "d · Deny"]`, `outcome` beginning `Approved once by the human · web · `, `archive` `{choice: "once", by: "human", via: "web", at: …}` (no `note`), `answer` `{requestId: "qa-once", choice: "once"}`. `denyBare`: `afterEscape` `{answers: 0, state: "pending"}` (Escape answered nothing), `reopened: ""`, `submitDisabled: false` (Deny without a note is allowed), `outcome` beginning `Denied by the human · web · `, `archive` with `choice: "deny"` and no `note`, `answers` one `{requestId: "qa-deny-bare", choice: "deny"}` without `note`. `denyNote`: `outcome` beginning `Denied by the human · web · `, `archive` with `choice: "deny"` and `note: "QA deny reason"`, `answers` one with `note: "QA deny reason"`. `tui`: `answerIn: "tui"`, `harness: "claude-code"`, `command: "echo QA TUI only"`, `buttons: 0`. `race`: `held: true`, `peer: true`, `pageResult` `{ok: false, error: <names "already answered" by the human via neovim>}`, `outcome` beginning `Approved always by the human · neovim · ` (the card folded to the winner), `archive` `{choice: "always", by: "human", via: "neovim", …}`, `answers: ["always"]` (the harness received only the winner), `alerts: 0` |
| E417S4-09 | hub-api | sealed $W | typecheck, colour and HTML guards, tiers | `k09` | `typecheck exit 0` with no diagnostic in the log (hub, Neovim, shared wire and web typechecks; the colour, token, HTML and hooks guards: `EventsArea.module.css` and `ApprovalCard.module.css` hold no colour value; secondary text keeps 4.5:1); the four guard lines appear (`web HTML: raw-HTML sinks refused; seeded fixtures passed`, `web colours: token-only sources; colour fixtures passed`, `web tokens: <n> text tokens ≥4.5:1 on ground and selection; role colours match hl.lua`, `web hooks: conditional-hook fixture rejected by configured oxlint`); `tiers exit 0`; the three `"Web"` classifications and `"hub/test/web-notifications.test.ts": "T1"` print |
| E417S4-10 | hub-api | QA shell | AGENTS.md `web/` rules; open-page scope | `k10 \| tee "$EV/E417S4-10.txt"` | The key-listener grep lists only `web/src/keyboard.ts` (one `document.addEventListener('keydown', …)`, its handler and its removal): no component-local key listener in `EventsArea.tsx`, `ApprovalCard.tsx`, `SessionRecentThread.tsx`, `Palette.tsx`, `accounts/Profile.tsx` (the switches are native buttons) or the notification modules. Storage appears only in `web/src/interface-state.ts` under `cland.ui.<area>.v1` and in `web/src/connection.ts`'s `cland-reload-build` guard (the Events filter and the switches reach storage through `interface-state.ts`). The raw-HTML grep prints nothing. Notifications: exactly one `new Notification(` in `web/src/browser-notifications.ts`; `web/src/notification-state.ts`'s `storage` and `focus` window listeners (cross-tab switches and revoked permission; not key listeners); no `serviceWorker` or `PushManager`. Under the four ids nothing: no dependency, devDependency or lockfile change |
| E417S4-11 | hub-api | docs | T-1164 C1, C2; docs of the four items | `k11 \| tee "$EV/E417S4-11.txt"` | Every line above the `-- T-1164 C2` marker starts with `1 ` (or more): the thread `r` row (T-1164 C1, with its context "Thread opened from an Inbox request or message, outside ask rows and fields"), the seven-areas sentence, the Events paragraphs and its `w` and `F` rows, the Browser notifications paragraphs, the approval-card paragraphs and the two approval key rows, the recent-thread sentence, `hub/README.md`'s notification and approval-card paragraphs and the three `docs/agents/tests.md` paragraphs. The four T-1164 C2 lines each start with `0 ` (any other count is FAIL for T-1164 C2). Then read `web/README.md`'s "Topics and threads" key table, Inbox, Events, Browser notifications, "Area modules and live state", "Split and drawer", "Palette and keys", Accounts and "Browser tests" sections, `hub/README.md`'s two paragraphs and the tests.md paragraphs, and record any statement that contradicts E417S4-02 to E417S4-10 as a **low** finding with file and line (the row stays PASS when the only contradictions are docs ones). The three lines after `-- superseded by T-1142` each start with `0 ` (the "own slice" sentence and the palette wording are gone since `4624720e`; a `1` there is a **low** docs finding, not a FAIL). Candidates at writing, to confirm or dismiss at the build: any line the last grep prints (none at writing; a remaining `Notifications ·` palette label in the docs would contradict E417S4-07); the Browser notifications and Accounts paragraphs against E417S4-03's Profile switches |
| E417S4-12 | hub-api | sealed $W | brief | `cland qa lint qa/briefs/E-417-stage-4.md; echo "exit $?"` | `qa/briefs/E-417-stage-4.md: qa lint passes at the build` and `exit 0` (this brief, committed at the build) |
| E417S4-13 | hub-api | QA shell; the Coordinator's stage covers | stage covers | `(cd "$W" && node hub/bin/cland.ts task plan show E-417) \| tee "$EV/E417S4-13.txt"` and the cover results the request names | QA runs no full suite. The Coordinator owns the stage covers (`cland verify all --occasion stage`): full integrated suites at the tested SHA on Linux (droplet) and macOS (local), which add T3 and the Web phase on both platforms and are cited evidence this run does not run. Record the plan's line for this stage exactly as printed; Linux and macOS covers green at the tested SHA, each with its Web phase run (not "Web unavailable"); record each cover's run id, artifact, executor, platform, tiers and phases, wall time and cost as cited evidence. A cover red only on the T-1157 Retry case, with that case passing in E417S4-06, is recorded against T-1157 and judged by the Coordinator's rerun receipt the request names. Any other red cover is FAIL naming its failing tests; a cover not finished when every other check is done: wait for its result in the epic topic; none queued or running at the tested SHA by then: BLOCKED "no stage cover at the tested SHA", reported to the requester |
| E417S4-14 | hub-api | QA shell | cleanup | `k14 \| tee "$EV/E417S4-14.txt"` | Every Web log line prints a first census count of at least `1` and a second of `0` (E417S4-02, E417S4-03a, E417S4-04, E417S4-06a to E417S4-06l, E417S4-08; the T1/T2 logs E417S4-03b, E417S4-05 and E417S4-07 print `0 0`, which is expected); `0` changed paths; `$Q` begins `/private/tmp/qa-e417s4-`. Then remove `$Q` and the worktree as "Setup" says |

Re-check helper, file and test names with grep at the tested build: renames happen. A test name pattern matching zero tests passes with exit 0 and "tests 0": read the counts and `oks`, never the exit code alone. The named Web tests and the probe ask the live hub's verify slot for admission themselves (`suite.slot` check): an admission timeout is BLOCKED; retry after `quiet`.

Before requesting QA, run `cland qa lint <brief>` with this filled brief at the build under test. The brief is complete only when qa lint passes at the build.

## Probes that mislead

- Process cleanup probes use a fixture-owned pid/process-group census, registered at launch and checked through exit; a machine-wide `pgrep` counts other sessions too (A-9063 R2; E-413 stage 1/T-1093). Here: each Web fixture's `Web fixture census: browser group <pid>; before <n>; after 0; scratch hub stopped` line, the probe's included.
- Edit existing keys in initialized configs, list standalone-test build prerequisites, enumerate regular files only for file probes, and identify events by seq/id. A second-client check allows only defaults the new client writes itself (A-8634 R12; E-412 stage 2, E-415 stage 3/DoD, E-1006). Here: the probe's frame client and fake spokes only read and send through public frames; the pages write their own preferences, and the probe's init script writes only the notification switches the T-1128 tests also seed.
- Transcript assertions identify stable item/topic/frame ids, with intervals starting at the result frame of the state-changing request. Preserve unaltered captures when correcting a probe and label the correction separately from product failures (A-9063 R2; E-413 stage 1/T-1093). The probe finds asks, approvals, events and frames by the ids their creating requests or the hub's reads returned, never by position; its `race` result is the result frame for the page's own held `approval.answer` id.
- Exact tracker copies replace the initialized tracker directory after its writers stop; apply the full `fixtureEnvironment` result after overlays, check zero credential-prefix names before launching scratch processes and report names/counts only (A-9063 R2; E-413 stage 1/T-1093). This run needs no tracker copy: every scratch project is a fresh Web harness project seeded by `seedItem` and a written journal.
- An accessibility-tree count does not prove visible reachability (A-9063 R6; T-1095, T-1097). The notification click's "opens the row" is judged by the exact row's focus (`focused: true`, the tests' exact-id focus receipt), not by a row count.
- Notifications are stubbed: a notice is an entry the page constructed through the stubbed `Notification`, and "hidden" is the stubbed `document.visibilityState`/`hasFocus`. A real browser's permission prompt and OS notification are out of scope; a missing notice with `looking` hidden is a product fact, not a stub artefact, because the T-1128 tests use the same stub.
- Animation time: context 2 installs and pauses the page clock, so `requestAnimationFrame` never fires; a click that only focuses inside a frame callback would leave `mounted: 1` with `focused: false` (the T-1128 race, A-9938). Contexts 1 and 3 run browser time normally; context 1's last look is the page's own opening time, so the probe compares `pushed` with `marks.get` and with the hub's fake now instead of an exact instant.
- The race is staged by holding the page's own `approval.answer` frame in Playwright's WebSocket route; the frame client's answer wins at the hub, and the page's release meets the gate's refusal. Every other frame passes unaltered, so the card may learn the winner from the hub's push before or after the refusal: judge the folded outcome, the archive and `answers`, not the order.
- The fake Codex `raiseApproval` hands the hub a record directly, bypassing the native adapter's cap check; an oversized subject through the fake is not the 23:30Z path. That decision is judged by E417S4-05's adapter tests and the card's `answerIn: "tui"` rendering (E417S4-04, the probe's `tui` step), never by raising a large subject through the fake.
- Physical keys are dispatched as `KeyboardEvent`s with the code and a Cyrillic key value (`я`), as the items' tests do, to prove the physical-code map; Playwright's `press` would send the Latin key value too.
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file.
- A "ran" marker grep excludes the configuration echo line.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log: not applicable, QA runs nothing on a droplet. Speed criteria use measured wall times, never projections: this stage has none; the allowances in E417S4-02 and E417S4-04 are duration lines, report-only here.
- Slots due or queued before the build count even when their results arrive later.
- "No skip": the Web files and the probe need Chrome Headless Shell (local on macOS); a skipped or "Web unavailable" result is BLOCKED, never PASS. Linux runs of the same files are cited from E417S4-13, not run by QA.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

Real Chrome and computer use: out of scope for this run, not BLOCKED, as in stages 2 and 3. Real browser notifications, the OS permission prompt, the service worker and closed-page push are E-419's (phone and push); this stage's notifications are open-page only and are proven with the stubbed `Notification`. The live hub's approval relay (E-414, live since restart #49) and real Codex, OpenCode or Claude Code sessions are not used: every approval comes from the fake harnesses of sealed scratch hubs, so no live-edge build stamp, hub restart or real approval applies. Also out of scope: E-414's relay and gate beyond the named E417S4-05 files (E-414's own stages and demo judged them); judging where the notification switches live: T-1142 (E-418) is on the build and moved them into the Accounts Profile block, which is E-418's to judge, but every check of this stage must pass with it (E417S4-03, E417S4-07, E417S4-11 are written for it); the phone adapter's reuse of `notification-rules.ts` (T-1175); the session drawer of E-418 that reuses the approval card; Neovim; the epic's Definition of done and its demo, a separate run; work landed on dev after the stage's items, beyond the regression files named here; the T-1157 Retry flake itself (recorded against T-1157 as E417S4-06 says, never a finding of this stage); the 60 s versus 180 s Web hang-guard prose drift the T-1164 reviewer reported separately; running a full suite, T3 or a stage cover (E417S4-13 cites the Coordinator's); T4; duration budget lines (report-only); the live project's tracker, hub, crew, `ui.json` and HOME. Stage QA carries no criterion marks.

Nothing else in scope needs an authorization this brief does not give: a check that cannot run for lack of one is BLOCKED, not out of scope.

## Grants

none. No computer use, no real browser, no sign-in, no real notification permission. The Headless Shell instances of the Web files and the probe open only their own sealed scratch edges, under the crew browser rule (rule 18). Every other check uses the rule 15 sealed environment with credentials filtered; nothing reads or writes the human's real `~/.cland` or `~/.local/state`.

## Verdict

Fix nothing. Clear only when every check E417S4-00 to E417S4-14 passes (docs contradictions in E417S4-11 beyond T-1164's own C1/C2 lines are low findings and do not block clear; a T-1157 flake handled as E417S4-06 says is no finding). Otherwise not clear, naming the failing, blocked or inconclusive ids and findings. On the epic record one QA verdict with `--stage "events, notifications and approvals"`, the full tested dev SHA, the unique run id and the case table. Stage QA carries no epic criterion marks. Report `qa clear E-417 stage events, notifications and approvals` or `qa not clear E-417 stage events, notifications and approvals` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
