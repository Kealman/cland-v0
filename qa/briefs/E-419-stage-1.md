# Stage QA brief: E-419 stage 1 — bottom bar and inbox home

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` or `$B:h` as a modifier, and aborts the sealed subshell's `env` count). The run is local, on macOS (BSD tools; Chrome Headless Shell from the installed `playwright-core`).

## Stage

- Epic: E-419 (The phone and notifications, under R-377).
- Exact stage name: bottom bar and inbox home.
- Items, in plan order: one serial lane, T-1165, then T-1166, then T-1167. The run reads the stage's members, counts and state from `task plan show E-419` (E419S1-00 and E419S1-14), never from a number written here. Findings fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- **The run starts only once T-1167 is on dev.** At writing T-1165 had landed as `dc6c6762` and T-1166 as `0e1b26d4`; T-1167 (the inbox as home on the phone) was claimed by impl-1167 on `t/T-1167-the-inbox-as-home-on-the-phone` with no commit yet. E419S1-00 checks the landing through `task plan show E-419` and the first-parent log; a missing T-1167 landing is BLOCKED, reported to the requester, with nothing else run.
- **Where the expectations come from.** Every expectation for T-1165 and T-1166 below was read at dev `26a24ca7` (the tracker commit after T-1166's landing), and the probe's T-1165/T-1166 facts were observed there. T-1167 had no code at writing: its rows are written from its six acceptance criteria and its "What to build", and every T-1167 name, label, selector, test name and count in this brief must be grep-checked at the tested build (E419S1-02 prints them; the rows say how a changed name is judged).
- Scope: the combined changed behaviour of the three items at the tested build. T-1165 and T-1166 change only the web bundle, its tests and docs (`web/`, `docs/agents/tests.md`, `hub/test/tiers.json`, `hub/test/durations.json`): no hub, shared wire or Neovim source changed. T-1167 is expected to stay inside the same paths; E419S1-00 lists any path outside `web/` and `docs/`.
  - T-1165, the phone frame (§3.6, P24, P26; choices "The phone width" and "Touch"): `web/src/phone.ts` is the one width seam (`isPhone()`, `usePhone()`, `(width < 640px)`), read by the shell and the Sessions narrow row tap and Enter (the scattered `max-width: 639px` checks are gone). Below 640 px the rail is not rendered and a bottom bar (`nav` `Phone areas`) holds Inbox, Topics, Sessions, Events and More, each with its icon, name and count (`[data-count]`), the current one `aria-current="page"`; Events counts every event since the human's shared last look, as the Inbox events line does; More has no count (an approved cut). The header keeps the project, the release chip, Search (`Palette`) and the needs-you pill with the hub dot; Coordinator and `?` leave it. At phone width ⌘\ opens no split and a selected row opens no drawer; a split saved on the desktop stays saved and returns on widening; a first load with no saved area opens Inbox. More opens a sheet (`nav` `More areas`, key context `more`: `Escape: 'dismiss'` in `keymap.ts`) above the bar without a scrim, listing Items, Artifacts and Accounts; choosing one, Escape or a tap outside closes it. The Web harness gains the phone context: `fixture.pageCase(t, body, beforeNavigate, { phone: true })`, 390×844 with touch and the mobile flag, readiness on the bar's five slots.
  - T-1166, More's three areas read-only (§3.6 More, P26): at phone width Items shows the explorer tree only (no `Items view` switcher; Board, Graph and Plan stay desktop first); a tapped row opens `ReadOnlyItemCard` full screen with a 44 px **Back to Items** control (browser Back does the same) and no action control; the Items keys for done, archive, message and criteria edit, and the plan actions, are inert at this width through keys, help and palette (`actionAtWidth` in `keymap.ts`). Artifacts keeps its list and opens the viewer full screen with **Back to Artifacts**, without Keep, Archive or compose. Accounts shows the registry, windows and limits as facts with no control that changes an account, and no notification switches at phone width. The bar marks More current in all three. At 640 px and wider every desktop action, the saved planning views and the Profile switches remain.
  - T-1167, the inbox as home on the phone (§3.6, P40, P42; from its criteria): the title reads Inbox with "N need you", or "Nothing needs you" in green with its check when every section is at 0; the four sections Asks and approvals, Plan approvals, Requests to you and Messages to you in that order, each header a full-width fold button at least 44 px tall with its name and count, folds remembered per browser, an empty section keeping its header with 0; rows two lines at 390 px with no drawer; a tapped message or request row unfolds in place with its text and a one-line reply to the sender in the row's topic (the per-topic draft that survives a reload), with Open topic and Mark read or Decline; a waiting plan shows as a row with its stage, lane and item counts and no approve control and no Open Plan (the tooltip says plan approval needs the desktop's Plan view); ask and approval rows keep the desktop's in-place unfolding; the events line and the archive line close the list as 44 px controls, the events line opening Events and the archive line opening the archive in place.
- Affected regression: the Web files of the shell, split, area slots, key contexts, palette, Sessions (narrow row and drawer), Inbox, folds, Events, Items (tree, actions, criteria, card, Plan), Artifacts, Accounts and notifications (the stage changed `Shell.tsx`, `Shell.module.css`, `InboxArea.tsx`, `keymap.ts`, `use-event-summary.ts`, `sessions/SessionGroups.tsx`, `sessions/SessionRow.tsx`, `ItemCard.tsx`, `ItemCriteria.tsx`, `ItemsTree.tsx`, `ItemsView.tsx`, `artifacts/ArtifactsArea.tsx`, `accounts/AccountsArea.tsx`, `accounts/Profile.tsx` and `web/test/harness.ts`, with T-1167's files on top); the desktop at 640 and 1440 px (no lost action, the split survives); the T1 keymap file; the typecheck with colour, contrast, HTML and hooks guards; the tier classifications.

Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

Criteria map (the stage verdict carries no item or epic marks; this tells the run which check proves what):

| criterion | proven by |
| --- | --- |
| T-1165 C1 (at 390×844 no rail; the bar shows Inbox, Topics, Sessions, Events and More with their counts; a tap on each of the four areas opens it) | E419S1-06, E419S1-12 (`frame`), E419S1-02 (the seam and the harness's phone context) |
| T-1165 C2 (640 px: collapsed rail, no bar; 639 px swaps the rail for the bar without a reload) | E419S1-06, E419S1-12 (`widths`: `at640`, `at639`, `documentLoads`) |
| T-1165 C3 (at 390×844 ⌘\ opens no split and a selected row no drawer; a split saved at 1440 px returns on widening) | E419S1-06, E419S1-12 (`widths`), E419S1-12 (`askInline`, `messageReply`, `requestRow`: no drawer in the phone Inbox) |
| T-1165 C4 (More: a sheet above the bar, no scrim, Items, Artifacts and Accounts; Escape or choosing one closes it) | E419S1-06, E419S1-12 (`more`), E419S1-02 (the `more` key context), E419S1-03 (no component-local key listener) |
| T-1165 C5 (every visible control of the header, the bar and the More sheet at 390×844 at least 44 px tall) | E419S1-06, E419S1-12 (`more.controls`) |
| T-1165 C6 (`web/README.md` Phone section: the seam, the bar, More, the phone test context) | E419S1-04 |
| T-1166 C1 (More then Items: the tree, no view switcher; a tapped row opens its card full screen with a back control and no action control) | E419S1-07, E419S1-12 (`items`) |
| T-1166 C2 (at 390×844 the Items keys for done, archive, message and criteria edit change nothing, as `cland task view` reads; at 1440 px the same keys act) | E419S1-07, E419S1-12 (`items.keys`, `cardKeys`, `palettePhone`, `desktop1440`), E419S1-02 (`actionAtWidth`) |
| T-1166 C3 (More then Artifacts: an artifact full screen with a back control, no Keep, Archive or compose) | E419S1-07, E419S1-12 (`artifacts`) |
| T-1166 C4 (More then Accounts: each account's facts, no control that changes an account; More current in all three areas) | E419S1-07, E419S1-12 (`accounts`, `more.choose`, `items.card.moreCurrent`, `artifacts.moreCurrent`) |
| T-1166 C5 (`web/README.md` lists what More opens on the phone and what stays desktop only) | E419S1-04 |
| T-1167 C1 (four sections in order, each header a fold button ≥44 px with its count; an empty section keeps its header with 0) | E419S1-08, E419S1-12 (`emptyHome`, `sectionsFilled`, `listClose.foldAfterReload`) |
| T-1167 C2 (every section at 0: "Nothing needs you" with its check; a new ask from a fake session brings back the count) | E419S1-08, E419S1-12 (`emptyHome.title`, `askReturns`) |
| T-1167 C3 (a tapped message row unfolds in place with a reply to its sender in the row's topic; a draft typed there survives a reload) | E419S1-08, E419S1-12 (`messageReply`) |
| T-1167 C4 (a waiting plan row with its counts and no approve or Open Plan control at 390×844) | E419S1-08, E419S1-12 (`planRow`) |
| T-1167 C5 (the events and archive lines close the list as controls ≥44 px; the events line opens Events) | E419S1-08, E419S1-12 (`listClose`) |
| T-1167 C6 (`web/README.md` describes the inbox as home on the phone) | E419S1-04 |
| Desktop regression at 640 and 1440 px (no lost action; the split survives) | E419S1-06 (the 640 and saved-split cases), E419S1-07 (desktop keys at 1440, Graph and the criterion editor at 640, the switches at 640), E419S1-09, E419S1-10, E419S1-11, E419S1-12 (`widths`, `items.desktop1440`, `items.desktop640`, `artifacts.desktop640`, `accounts.desktop640`, `desktopInbox`) |

Definition-of-done pointer (no marks): E-419's bottom-bar, More and inbox-home sentences (§3.6) are exercised by E419S1-06 to E419S1-08 and E419S1-12. The epic's Definition of done and its demo are a separate run.

## Build

Use a clean detached worktree at dev at the SHA in the request (the full 40-hex SHA), created below. HEAD must equal that SHA and refs/heads/dev before and after running. All listed items must have merged onto dev: for every member that `task plan show E-419` lists in stage `bottom bar and inbox home`, `git log --first-parent --oneline --grep "Item: <id>" dev` prints exactly one commit. At writing T-1165 had landed as `dc6c6762` and T-1166 as `0e1b26d4`; T-1167 had not landed (see "Stage"). Expectations for T-1165 and T-1166 were read at dev `26a24ca7`; T-1167's names and counts must be grep-checked at the tested build, and its rows were written from its criteria. Dev may also carry work landed after these items that is outside this stage; it is not judged here beyond the regression files named. A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no commit or run id of its own on purpose: committing a brief changes the tested tree.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step (the setup below does; the clean-tree checks ignore that one entry). Run E419S1-01's build before any Web file or the probe, or the shell never renders. The browser is the suite's Chrome Headless Shell under `node_modules/playwright-core/.local-browsers`: each named Web test file and the QA probe start and close their own through the Web harness (`web/test/harness.ts`, `webFixture`); every phone check uses T-1165's phone context (`pageCase(…, { phone: true })`: 390×844, `hasTouch`, `isMobile`). No real browser, phone or other GUI process starts. The live hub is touched only by `quiet`, the Web harness's own read-only admission check and the plan reads of E419S1-00 and E419S1-14. Every ask, message, request, plan, item, artifact and account comes from sealed scratch hubs started from `$W`'s own source with in-process fake spokes as senders and a fake account reader, never a real session, account or provider binary (see "Out of scope").

**The local test slot (cover-quiet).** No test may run while another session holds the live hub's local verify slot. The Coordinator's macOS stage cover for this stage (`verify all --occasion stage`, local) holds that slot for about 20 minutes, and it may still be running when this run starts. A wait for it is not BLOCKED: run the checks that need no slot first (E419S1-00 to E419S1-05: reads, greps, docs, the brief lint and the bundle build), then wait for the slot with `quiet` (it waits up to 45 minutes and prints the holder every 5 minutes) before E419S1-06. Only a slot still held after those 45 minutes with no change of holder is BLOCKED, reported to the requester with the holder line.

## Setup (once, before E419S1-00)

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree, runs `quiet`, the plan reads, reads the captures and records every check with `qa-record.sh`. **Every other command runs sealed** (rule 15) inside a subshell that sources `$Q/env.sh`: the full `fixtureEnvironment` result (`test-support/fixture-environment.ts`) after the scratch overlays (its synthesized HOME, XDG, Git, account and fake-harness paths included), which drops every `CLAND_*`, `GIT_*`, `XDG_*`, `CLAUDE_*`, `CODEX_*`, `FAKE_*`, provider and account variable while keeping `PATH`, `SHELL`, `TERM` and `TMPDIR`. Leave `TMPDIR` at the system default (on macOS `/var/folders/...`; never `/tmp`, T-1030). Never use `env -i`. The scratch root lives under `/private/tmp/qa-e419s1-` (its realpath). Never the live project's hub for anything but the reads named above and `quiet`; never the human's HOME, `~/.cland`, `~/.claude`, `~/.codex` or `~/.local/state`. Fixtures are fake only: the Web harness's sealed scratch projects and hubs, fake spokes as senders (a fake Coordinator asking, sending messages and requests), seeded tracker items, a fake account reader and the harness's stubbed `Notification`; no real session, account or provider binary.

In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<the full dev SHA from the request>
STAGE="bottom bar and inbox home"
RUN=qa-s1-$(date +%F)-1                        # unique run id for E-419; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e419s1-$RUN           # the clean detached build
EV=$R/.cland/qa/E-419/$RUN                     # captures (qa-record.sh keeps its evidence here too)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
Q=$(cd "$(mktemp -d /tmp/qa-e419s1-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/qa-e419s1-…
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

The QA probe. `$Q/probe.test.mjs` is a one-test `node --test` file, independent of the items' own tests: one sealed scratch project and hub through the Web harness (`webFixture`: `tempProject` under the system `TMPDIR`, `projectHub`, the production socket and web edge serving `$W/web/dist`), with a fake account reader (one `5h` window at 41%) and, before the hub starts, seeded tracker items (`T-1` `QA phone card` with a summary and criterion C1; `R-900000`, epic `E-900010` and its task `T-900100` under `[plan] approval = "human"`) and a Codex account `qa-account` in the sealed `XDG_CONFIG_HOME`; then, through public frames, a topic `QA phone topic`, a General note `QA phone note`, and a fake Coordinator spoke `coord`. It drives six Headless Shell contexts, each signed in through a minted link:
- **Context 1** (phone; T-1167): `emptyHome` reads the first load's area, the four sections (id, header name, count, empty mark), the fold buttons' heights and widths, the title ("Nothing needs you", its text, check and colour beside the header pill's clear colour) with every section at 0; `askReturns` has the fake Coordinator ask and reads the title and the bar's Inbox count again; then the fake sends a decision message in `QA phone topic`, a request in General, and the hub sets a one-stage plan on `E-900010` (a waiting plan); `sectionsFilled` reads each section's rows, the title and the message row's line count and overflow at 390 px; `askInline` taps the ask (inline options, no drawer); `messageReply` taps the message, reads its unfolded text, buttons, reply field and address, types `QA phone draft`, reads the per-topic draft key, reloads, taps the row again, reads the field and sends it with the reply's Send button, reading the fake's delivery (`reply_to`, topic, text); `requestRow` taps the request (text, buttons, reply field, no drawer); `planRow` taps the plan (counts, approve and Open Plan controls, tooltips); `listClose` reads the order of sections, events line and archive line and their heights, folds Requests, reloads and reads the fold, then taps the archive line (archive in place) and the events line (Events opens).
- **Context 2** (phone; T-1165 C1, C4, C5): `frame` reads the viewport and touch, the rail, the bar's labels and counts, the header pill, taps Topics, Sessions, Events and Inbox and reads the area and `aria-current`, and the header controls; `more` opens More, reads the sheet, scrim and position and every visible header, bar and sheet control's height, closes it by a physical Escape (key value `ж`), chooses each of Items, Artifacts and Accounts, and closes it by a tap outside.
- **Context 3** (desktop 1440×900; T-1165 C2, C3 and the desktop regression): `widths` opens a split (Items | Accounts) and reads rail, rail width, bar, panes and drawer at 1440, 640, 639 and 390 px, presses ⌘\ and selects `T-1` at 390, reloads at 390, widens to 1440 and reads the split and its ratio, counting document loads.
- **Context 4** (phone, then 1440 and 640; T-1166 C1, C2): `items` opens More then Items, reads the view switcher, presses `Shift+D`, `Shift+A`, `m`, `Shift+M`, `e`, `a`, `d` on the row and compares the filters and `cland task view T-1 --json` before and after, opens the card and reads it, presses `e`, `m`, `Shift+M` in it, searches the palette for the Items actions, leaves by Back and by browser Back, then at 1440 presses `Shift+D` and `m` and searches the palette, and at 640 reads the switcher and the palette.
- **Context 5** (phone, then 640; T-1166 C3): `artifacts` presses `k`, `d`, `s` on the note's row, opens it, reads the viewer, controls, sent frames and `artifact.list`, the palette, both back paths, then at 640 the palette's Keep and Archive actions. **Context 5b** (phone, then 640; T-1166 C4): `accounts` reads the account's facts, switches and account-changing controls, then the switches at 640.
- **Context 6** (desktop 1440): `desktopInbox` selects an Inbox row and reads the drawer.

It asserts nothing about the product: every fact goes to `$QA_OUT` as one JSON line; a step that throws writes `{"step":{name,error}}` and the probe goes on. The Web fixture's own cleanup writes the census line. **T-1167's steps were written from its criteria before its code existed**: they find things by role, visible text and data attributes that exist at writing (`data-inbox-section`, `data-fold-toggle`, `data-object-id`, `aria-pressed`, `data-inbox-events`, `data-inbox-archive-toggle`, the row's `listitem`, its `textbox` and a button whose name starts `Send`). E419S1-02 greps these at the build. If T-1167 names a control differently, correct only that selector in `$Q/probe.test.mjs`, keep the uncorrected capture and its log, label the correction in the record, and rerun the probe once; a selector correction is not a product finding.

```sh
cat > "$Q/probe.test.mjs" <<'JS'
// QA probe for E-419 stage 1 (node --test, sealed, cwd $QA_W): one sealed scratch hub through the Web harness, phone
// contexts (390x844, touch, mobile flag: T-1165's `{ phone: true }`) and desktop contexts (1440x900, resized to 640),
// fake spokes as senders, a fake account reader. It asserts nothing about the product: every fact goes to $QA_OUT as
// one JSON line {"fact": value}; a step that throws writes {"step": {name, error}} and the probe goes on.
import test from 'node:test';
import { appendFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const W = process.env.QA_W, OUT = process.env.QA_OUT;
const { webFixture } = await import(`${W}/web/test/harness.ts`);
const { seedItem } = await import(`${W}/web/test/items-fixture.ts`);
const { cland, connectUi, inProcessSpoke } = await import(`${W}/hub/test/harness.ts`);
const out = (key, value) => appendFileSync(OUT, `${JSON.stringify({ [key]: value })}\n`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function step(name, body) { try { await body(); } catch (error) { out('step', { name, error: String(error?.message ?? error).slice(0, 400) }); } }
async function poll(read, done, ms = 3000) { let value = await read(); for (let i = 0; i < ms / 100 && !done(value); i++) { await sleep(100); value = await read(); } return value; }
const PHONE = { phone: true };
const physical = (page, code) => page.evaluate(code => (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { code, key: 'ж', bubbles: true, cancelable: true })), code);
const heights = locator => locator.evaluateAll(nodes => nodes.filter(node => node.getClientRects().length).map(node => { const box = node.getBoundingClientRect(); return { name: (node.getAttribute('aria-label') ?? node.textContent ?? '').trim().slice(0, 40), height: Math.round(box.height * 10) / 10, fits: box.left >= 0 && box.right <= innerWidth }; }));
const short = list => ({ count: list.length, under44: list.filter(c => c.height < 44).map(c => `${c.name}: ${c.height}`), outside: list.filter(c => !c.fits).map(c => c.name) });
const current = page => page.locator('main').getAttribute('aria-label');
async function more(page, area) {
  await page.getByRole('button', { name: 'More', exact: true }).tap();
  await page.getByRole('navigation', { name: 'More areas', exact: true }).getByRole('button', { name: area, exact: true }).tap();
  await poll(() => current(page), v => v === area);
}
const paletteHas = async (page, labels) => {
  await page.getByRole('button', { name: 'Palette', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Palette', exact: true });
  await dialog.waitFor();
  const result = {};
  for (const label of labels) result[label] = await dialog.getByRole('option').filter({ hasText: label }).count();
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  return result;
};
const ITEM_ACTIONS = ['Hide done items', 'Show archived roots', 'Message General', 'Message item topic', 'Edit criteria block'];
const ARTIFACT_ACTIONS = ['Keep artifact', 'Archive artifact'];
test('E-419 stage 1 QA probe', { timeout: 300000 }, async t => {
  const fixture = await webFixture(t, {
    accountReader: async () => [{ id: '5h', label: '5h', usedPercent: 41, resetsAt: '2026-10-24T15:10:00Z' }],
    prepare: async root => {
      await seedItem(root, 'T-1', 'task', 'QA phone card', {}, '## Summary\n\nQA phone summary\n\n## Acceptance criteria\n\n- [ ] C1. QA criterion');
      await seedItem(root, 'R-900000', 'release', 'QA release', { version: '9.0.0' });
      await seedItem(root, 'E-900010', 'epic', 'QA planned epic', { parent: 'R-900000' });
      await seedItem(root, 'T-900100', 'task', 'QA planned task', { parent: 'E-900010' });
      await writeFile(join(root, '.cland/config.toml'), '[plan]\napproval = "human"\n');
      await mkdir(join(root, 'qa-account'));
      await writeFile(join(process.env.XDG_CONFIG_HOME, 'cland/accounts.toml'), `[accounts.qa-account]\nharness = "codex"\nhome = ${JSON.stringify(join(root, 'qa-account'))}\n`);
    },
  });
  const ui = await connectUi(t, fixture.hub.discovery);
  const coord = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', role: 'coordinator', sessionId: 'qa-e419s1-coord' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const made = await ui.request({ type: 'topic.create', title: 'QA phone topic' });
  const topic = made.value?.topic?.id;
  const note = (await ui.request({ type: 'artifact.create', kind: 'note', title: 'QA phone note', topic: 'general', content: '# QA phone artifact\n\nRead this note' })).value?.artifact;
  out('seeded', { topic: !!topic, note: !!note });
  const inboxRows = async () => (await ui.request({ type: 'inbox.list' })).value;
  // Context 1 (phone): the inbox as home, from all four sections empty to one row of each kind.
  await fixture.pageCase(t, async page => {
    const inbox = page.getByRole('list', { name: 'Inbox objects', exact: true });
    // The title: "Nothing needs you" (with its check, in the needs-you pill's clear colour) or "N need you"; pill: the header's needs-you pill.
    const title = async () => {
      const nothing = page.locator('main').getByText('Nothing needs you', { exact: false });
      const found = await nothing.count();
      const detail = found ? await nothing.first().evaluate(node => { const holder = node.closest('h1, h2, header, [role="heading"]') ?? node.parentElement ?? node;
        return { text: holder.textContent.replace(/\s+/g, ' ').trim(), svgs: holder.querySelectorAll('svg').length, colour: getComputedStyle(node).color }; }) : null;
      const pill = page.getByRole('button', { name: 'Needs you', exact: true });
      return { nothing: found, detail, needYou: (await page.locator('main').getByText(/\d+ needs? you/).allTextContents()).map(s => s.replace(/\s+/g, ' ').trim()),
        pill: (await pill.innerText()).replace(/\s+/g, ' ').trim(), pillClearColour: await pill.locator('span').last().evaluate(node => getComputedStyle(node).color) };
    };
    await step('emptyHome', async () => {
      await inbox.waitFor();
      const sections = await inbox.locator('[data-inbox-section]').evaluateAll(ns => ns.map(n => ({ id: n.getAttribute('data-inbox-section'), name: n.querySelector('[data-fold-toggle]')?.textContent?.trim() ?? null,
        count: n.querySelector('[data-fold-toggle]')?.closest('header')?.textContent?.replace(n.querySelector('[data-fold-toggle]')?.textContent ?? '', '').trim() ?? null, empty: n.hasAttribute('data-inbox-empty') })));
      out('emptyHome', { area: await current(page), sections, listWidth: Math.round((await inbox.boundingBox()).width), folds: short(await heights(inbox.locator('[data-fold-toggle]'))), foldWidths: await inbox.locator('[data-fold-toggle]').evaluateAll(ns => ns.map(n => Math.round(n.getBoundingClientRect().width))),
        title: await title(), drawer: await page.getByRole('complementary', { name: 'Drawer', exact: true }).count() });
    });
    let ask;
    await step('askReturns', async () => {
      const asked = await coord.call('ask', { topic: 'general', question: 'QA phone choice?', options: ['One', 'Two'] });
      ask = asked.ask;
      await inbox.locator(`[data-object-id="${ask}"]`).waitFor();
      const after = await poll(title, v => v.nothing === 0);
      out('askReturns', { title: after, inboxBadge: await page.locator('nav[aria-label="Phone areas"] [data-area="Inbox"] [data-count]').textContent(), askSection: await inbox.locator(`[data-inbox-section="asks"] [data-object-id="${ask}"]`).count() });
    });
    const sent = await coord.call('send', { topic, kind: 'decision', text: 'QA phone message\nQA phone body' });
    const requested = await coord.call('send', { topic: 'general', kind: 'request', request: 'handover', subject: 'coord', text: 'QA phone request\nQA request body' });
    const planned = await ui.request({ type: 'task.plan', item: 'E-900010', op: 'set', yaml: 'stages:\n  - name: QA build\n    qa: { scope: none, when: after-stage }\n    lanes:\n      - [T-900100]\n' });
    const rows = await poll(inboxRows, v => v?.messages?.length && v?.requests?.length && v?.plans?.length);
    const messageId = rows?.messages?.find(r => r.text.startsWith('QA phone message'))?.id, requestId = rows?.requests?.find(r => r.text.startsWith('QA phone request'))?.id;
    out('seededInbox', { message: sent.ok && !!messageId, request: requested.ok && !!requestId, plan: planned.ok && !!rows?.plans?.length });
    await step('sectionsFilled', async () => {
      await inbox.locator('[data-object-id="E-900010"]').waitFor();
      const ids = await inbox.locator('[data-inbox-section]').evaluateAll(ns => ns.map(n => [n.getAttribute('data-inbox-section'), n.querySelectorAll('[data-object-id]').length]));
      const lines = await inbox.locator(`[data-object-id="${messageId}"]`).evaluate(n => { const range = document.createRange(); range.selectNodeContents(n);
        const middles = [...range.getClientRects()].filter(b => b.width > 0 && b.height > 0).map(b => b.top + b.height / 2).sort((x, y) => x - y);
        const lines = middles.filter((m, i) => i === 0 || m - middles[i - 1] > 10).length; // text boxes whose middles lie within 10 px share a line
        return { lines, height: Math.round(n.getBoundingClientRect().height), overflow: n.scrollWidth > n.clientWidth, text: n.innerText.split('\n').map(s => s.trim()).filter(Boolean) }; });
      out('sectionsFilled', { counts: ids, title: await title(), messageRow: lines });
    });
    await step('askInline', async () => {
      await inbox.locator(`[data-object-id="${ask}"]`).tap();
      const card = inbox.locator(`[data-ask-id="${ask}"]`);
      await card.locator('[data-ask-option="1"]').waitFor();
      out('askInline', { options: await card.locator('[data-ask-option]').count(), drawer: await page.getByRole('complementary', { name: 'Drawer', exact: true }).count() });
    });
    await step('messageReply', async () => {
      const row = inbox.locator(`[data-object-id="${messageId}"]`);
      await row.tap();
      await page.locator(`[data-object-id="${messageId}"][aria-pressed="true"]`).waitFor();
      const item = row.locator('xpath=ancestor::*[@role="listitem"][1]');
      const field = item.getByRole('textbox');
      await field.first().waitFor({ timeout: 3000 }).catch(() => {});
      const result = { body: (await item.innerText()).includes('QA phone body'), buttons: (await item.getByRole('button').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()),
        fields: await field.count(), recipient: (await item.locator('[data-composer-recipient], [data-composer-address]').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()), drawer: await page.getByRole('complementary', { name: 'Drawer', exact: true }).count() };
      if (result.fields) {
        await field.first().fill('QA phone draft');
        await sleep(300);
        result.storedBeforeReload = await page.evaluate(key => localStorage.getItem(key), `cland.ui.draft.${topic}.v1`);
        await page.reload();
        await page.locator('nav[aria-label="Phone areas"]').waitFor();
        await poll(() => current(page), v => v === 'Inbox');
        await inbox.locator(`[data-object-id="${messageId}"]`).tap();
        const again = inbox.locator(`[data-object-id="${messageId}"]`).locator('xpath=ancestor::*[@role="listitem"][1]').getByRole('textbox').first();
        await again.waitFor();
        result.afterReload = await again.inputValue();
        const delivered = coord.waitForEvent(event => event.params.meta?.reply_to === messageId, 5000);
        await inbox.locator(`[data-object-id="${messageId}"]`).locator('xpath=ancestor::*[@role="listitem"][1]').getByRole('button', { name: /^Send/ }).first().tap();
        const event = await delivered;
        result.delivered = { content: event.params.content, topic: event.params.meta?.topic === topic ? 'row topic' : event.params.meta?.topic ?? null, replyTo: event.params.meta?.reply_to === messageId };
      }
      out('messageReply', result);
    });
    await step('requestRow', async () => {
      const row = inbox.locator(`[data-object-id="${requestId}"]`);
      await row.tap();
      await page.locator(`[data-object-id="${requestId}"][aria-pressed="true"]`).waitFor();
      const item = row.locator('xpath=ancestor::*[@role="listitem"][1]');
      out('requestRow', { body: (await item.innerText()).includes('QA request body'), buttons: (await item.getByRole('button').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()), fields: await item.getByRole('textbox').count(), drawer: await page.getByRole('complementary', { name: 'Drawer', exact: true }).count() });
    });
    await step('planRow', async () => {
      const row = inbox.locator('[data-object-id="E-900010"]');
      await row.tap();
      const item = row.locator('xpath=ancestor::*[@role="listitem"][1]');
      const text = (await item.innerText()).replace(/\s+/g, ' ');
      out('planRow', { counts: /1 stages? · 1 lanes? · 1 items?/.test(text), approve: await item.getByRole('button', { name: /approve/i }).count(), openPlan: await item.getByRole('button', { name: /open plan|plan view/i }).count(),
        buttons: (await item.getByRole('button').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()), titles: await item.evaluate(n => [n, ...n.querySelectorAll('[title]')].map(e => e.getAttribute('title')).filter(Boolean)), area: await current(page) });
    });
    await step('listClose', async () => {
      const events = inbox.locator('[data-inbox-events]'), archive = inbox.locator('[data-inbox-archive-toggle]');
      const order = await inbox.evaluate(list => { const all = [...list.querySelectorAll('[data-inbox-section], [data-inbox-events], [data-inbox-archive-toggle]')]; return all.map(n => n.hasAttribute('data-inbox-events') ? 'events' : n.hasAttribute('data-inbox-archive-toggle') ? 'archive' : 'section'); });
      const result = { order, events: short(await heights(events)), archive: short(await heights(archive)) };
      await inbox.getByRole('button', { name: 'Fold Requests to you', exact: true }).or(inbox.getByRole('button', { name: 'Fold Requests', exact: true })).tap();
      await page.reload();
      await inbox.waitFor();
      const fold = inbox.locator('[data-inbox-section="requests"] [data-fold-toggle]');
      result.foldAfterReload = await fold.getAttribute('aria-expanded');
      await fold.tap();
      await archive.tap();
      await inbox.getByRole('list', { name: 'Inbox archive', exact: true }).waitFor();
      result.archiveInPlace = { area: await current(page), list: await inbox.getByRole('list', { name: 'Inbox archive', exact: true }).count() };
      await events.tap();
      result.eventsOpens = await poll(() => current(page), v => v === 'Events');
      out('listClose', result);
    });
  }, undefined, PHONE);
  // Context 2 (phone): the frame, the bar's counts, More and touch sizes (T-1165 C1, C4, C5).
  await fixture.pageCase(t, async page => {
    await step('frame', async () => {
      const bar = page.getByRole('navigation', { name: 'Phone areas', exact: true });
      const counts = await bar.locator('button').evaluateAll(ns => ns.map(n => [n.getAttribute('aria-label'), n.querySelector('[data-count]')?.textContent ?? null]));
      const taps = {};
      for (const area of ['Topics', 'Sessions', 'Events', 'Inbox']) {
        await bar.getByRole('button', { name: area, exact: true }).tap();
        taps[area] = [await poll(() => current(page), v => v === area), await bar.getByRole('button', { name: area, exact: true }).getAttribute('aria-current')];
      }
      out('frame', { viewport: page.viewportSize(), touch: await page.evaluate(() => navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches),
        rail: await page.locator('nav[aria-label="Areas"]').count(), counts, pill: (await page.getByRole('button', { name: 'Needs you', exact: true }).innerText()).replace(/\s+/g, ' ').trim(), taps,
        header: { coordinator: await page.getByRole('button', { name: 'Coordinator', exact: true }).count(), help: await page.getByRole('button', { name: 'Help', exact: true }).count(), palette: await page.getByRole('button', { name: 'Palette', exact: true }).count(),
          needsYou: await page.getByRole('button', { name: 'Needs you', exact: true }).count(), hubDot: await page.getByRole('status', { name: 'Hub connection', exact: true }).count(), project: await page.getByLabel('Project', { exact: true }).count() } });
    });
    await step('more', async () => {
      const moreButton = page.getByRole('button', { name: 'More', exact: true });
      const sheet = page.getByRole('navigation', { name: 'More areas', exact: true });
      await moreButton.tap();
      await sheet.waitFor();
      const sheetBox = await sheet.boundingBox(), barBox = await page.getByRole('navigation', { name: 'Phone areas', exact: true }).boundingBox();
      const result = { items: await sheet.locator('button').allTextContents(), scrim: await page.locator('[aria-modal="true"], [data-scrim]').count(), above: sheetBox.y + sheetBox.height <= barBox.y,
        controls: short(await heights(page.locator('[data-phone] > header button, [data-phone] > header select, nav[aria-label="Phone areas"] button, nav[aria-label="More areas"] button'))) };
      await physical(page, 'Escape');
      await sheet.waitFor({ state: 'detached' });
      result.escape = { closed: await sheet.count() === 0, focusOnMore: await moreButton.evaluate(n => n === document.activeElement) };
      result.choose = {};
      for (const area of ['Items', 'Artifacts', 'Accounts']) {
        await more(page, area);
        result.choose[area] = { area: await current(page), sheet: await sheet.count(), moreCurrent: await moreButton.getAttribute('aria-current') };
      }
      await moreButton.tap();
      await sheet.waitFor();
      await page.getByLabel('Project', { exact: true }).tap();
      result.outside = await poll(() => sheet.count(), v => v === 0);
      out('more', result);
    });
  }, undefined, PHONE);
  // Context 3 (desktop, 1440 then 640, 639, 390, 1440): the seam, the split and no drawer (T-1165 C2, C3; desktop regression).
  await fixture.pageCase(t, async page => {
    await step('widths', async () => {
      let loads = 0;
      page.on('load', () => { loads++; });
      const facts = async () => ({ rail: await page.locator('nav[aria-label="Areas"]').count(), railWidth: Math.round((await page.locator('aside').first().boundingBox().catch(() => null))?.width ?? 0), bar: await page.locator('nav[aria-label="Phone areas"]').count(),
        panes: await page.locator('[data-pane]').count(), drawer: await page.getByRole('complementary', { name: 'Drawer', exact: true }).count() });
      await page.getByRole('button', { name: 'Items', exact: true }).click();
      await page.keyboard.press('Meta+Backslash');
      const other = page.locator('[data-pane="secondary"]');
      await other.waitFor();
      await other.click();
      await page.getByRole('button', { name: 'Accounts', exact: true }).click();
      await other.getByRole('heading', { name: 'Accounts', exact: true }).waitFor();
      const result = { at1440: await facts() };
      await page.setViewportSize({ width: 640, height: 900 });
      await page.locator('nav[aria-label="Areas"]').waitFor();
      result.at640 = await facts();
      await page.setViewportSize({ width: 639, height: 900 });
      await page.locator('nav[aria-label="Phone areas"]').waitFor();
      result.at639 = await facts();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.keyboard.press('Meta+Backslash');
      await page.locator('[data-tree-key=":unscheduled"]').click();
      await page.locator('[data-object-id="T-1"]').first().click();
      const card = page.getByRole('region', { name: 'Item card', exact: true });
      await card.waitFor();
      await card.press('Meta+Backslash');
      result.at390 = { ...(await facts()), card: await card.getAttribute('data-item-id'), saved: await page.evaluate(() => JSON.parse(localStorage.getItem('cland.ui.shell.v1') ?? 'null')?.secondary ?? null) };
      await page.reload();
      await page.locator('nav[aria-label="Phone areas"]').waitFor();
      result.afterPhoneReload = await facts();
      await page.setViewportSize({ width: 1440, height: 900 });
      await other.getByRole('heading', { name: 'Accounts', exact: true }).waitFor();
      result.back1440 = { ...(await facts()), ratio: Math.round(((await page.locator('[data-pane="primary"]').boundingBox()).width / (await other.boundingBox()).width) * 100) / 100 };
      result.documentLoads = loads; // the one explicit phone reload; resizing never reloads
      out('widths', result);
    });
  });
  // Context 4 (phone): More then Items read-only, inert keys; then the same page at 1440 and 640 (T-1166 C1, C2; desktop regression).
  await fixture.pageCase(t, async page => {
    const view = async () => { const reply = await cland(fixture.root, 'task', 'view', 'T-1', '--json'); const item = JSON.parse(reply.stdout).item; return JSON.stringify({ criteria: item.criteria, state: item.state, status: item.status, topic: item.topic }); };
    await step('items', async () => {
      await more(page, 'Items');
      const tree = page.getByRole('tree', { name: 'Items tree' });
      await tree.waitFor();
      const result = { switcher: await page.getByRole('group', { name: 'Items view', exact: true }).count() };
      await tree.locator('[data-tree-key=":unscheduled"]').tap();
      const row = tree.locator('[data-object-id="T-1"]');
      const before = await view();
      await row.focus();
      const filters = async () => JSON.stringify(await page.locator('[aria-pressed]').evaluateAll(ns => ns.map(n => [n.textContent, n.getAttribute('aria-pressed')])));
      const filtersBefore = await filters();
      for (const key of ['Shift+D', 'Shift+A', 'm', 'Shift+M', 'e', 'a', 'd']) await page.keyboard.press(key);
      await sleep(300);
      result.keys = { filtersUnchanged: await filters() === filtersBefore, cliUnchanged: await view() === before, quickMessage: await page.getByRole('textbox', { name: 'Quick message', exact: true }).count() };
      await row.tap();
      const card = page.getByRole('region', { name: 'Item card', exact: true });
      await card.waitFor();
      await card.getByRole('button', { name: 'Criteria', exact: true }).tap();
      await card.getByText('QA criterion', { exact: false }).waitFor();
      result.card = { id: await card.getAttribute('data-item-id'), width: Math.round((await card.boundingBox()).width), tree: await tree.count(), moreCurrent: await page.getByRole('button', { name: 'More', exact: true }).getAttribute('aria-current'),
        inputs: await card.locator('input, textarea, form').count(), actions: await card.getByRole('button', { name: /Save|Remove|Mark.*done|Message|Approve|Archive|Add criterion|Done/ }).count(),
        drawer: await page.getByRole('complementary', { name: 'Drawer', exact: true }).count(), back: short(await heights(page.getByRole('button', { name: 'Back to Items', exact: true }))) };
      await card.getByRole('button', { name: 'Criteria', exact: true }).focus();
      for (const key of ['e', 'm', 'Shift+M']) await page.keyboard.press(key);
      result.cardKeys = { inputs: await card.locator('input, form').count(), cliUnchanged: await view() === before };
      result.palettePhone = await paletteHas(page, ITEM_ACTIONS);
      await page.getByRole('button', { name: 'Back to Items', exact: true }).tap();
      await row.waitFor();
      await row.tap();
      await card.waitFor();
      await page.goBack();
      await row.waitFor();
      result.browserBack = { card: await card.count(), row: await row.count() };
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByRole('group', { name: 'Items view', exact: true }).waitFor();
      await row.focus();
      await page.keyboard.press('Shift+D');
      result.desktop1440 = { switcher: await page.getByRole('group', { name: 'Items view', exact: true }).count(), doneHidden: await page.getByRole('button', { name: 'D · Done hidden', exact: true }).count() };
      await page.keyboard.press('Shift+D');
      await row.focus();
      await page.keyboard.press('m');
      result.desktop1440.quickMessage = await poll(() => page.getByRole('textbox', { name: 'Quick message', exact: true }).count(), v => v > 0);
      await page.keyboard.press('Escape');
      result.desktop1440.palette = await paletteHas(page, ITEM_ACTIONS);
      await page.setViewportSize({ width: 640, height: 900 });
      await page.getByRole('group', { name: 'Items view', exact: true }).waitFor();
      result.desktop640 = { switcher: await page.getByRole('group', { name: 'Items view', exact: true }).count(), palette: await paletteHas(page, ITEM_ACTIONS) };
      out('items', result);
    });
  }, undefined, PHONE);
  // Context 5 (phone): More then Artifacts and Accounts read-only; then 640 (T-1166 C3, C4; desktop regression).
  const frames = [];
  await fixture.pageCase(t, async page => {
    await step('artifacts', async () => {
      await more(page, 'Artifacts');
      const row = page.locator(`[data-artifact-section="mine"] [data-object-id="${note.id}"]`);
      await row.focus();
      for (const key of ['k', 'd', 's']) await page.keyboard.press(key);
      await row.tap();
      const viewer = page.locator('[data-area-surface="page"] [data-artifact-viewer]');
      await viewer.getByRole('heading', { name: 'QA phone artifact', exact: true }).waitFor();
      const listed = (await ui.request({ type: 'artifact.list', artifact: note.id })).value?.artifact;
      const result = { viewerWidth: Math.round((await viewer.boundingBox()).width), moreCurrent: await page.getByRole('button', { name: 'More', exact: true }).getAttribute('aria-current'),
        pane: await page.locator('[data-area-surface="pane"][data-area-module="Artifacts"]').count(), drawer: await page.getByRole('complementary', { name: 'Drawer', exact: true }).count(),
        controls: await page.getByRole('button', { name: /^(Keep|Archive|Compose|Attach)/ }).count(), writes: frames.filter(f => ['artifact.keep', 'artifact.archive'].includes(f.type)).length,
        unchanged: listed?.status === note.status && listed?.kept === note.kept, back: short(await heights(page.getByRole('button', { name: 'Back to Artifacts', exact: true }))),
        palettePhone: await paletteHas(page, [...ARTIFACT_ACTIONS, 'Attach to composer']) };
      await page.getByRole('button', { name: 'Back to Artifacts', exact: true }).tap();
      await row.waitFor();
      await row.tap();
      await viewer.waitFor();
      await page.goBack();
      await row.waitFor();
      result.browserBack = { viewer: await viewer.count(), row: await row.count() };
      await page.setViewportSize({ width: 640, height: 900 });
      await page.locator('nav[aria-label="Areas"]').waitFor();
      await row.click();
      result.desktop640 = { palette: await paletteHas(page, ARTIFACT_ACTIONS) };
      out('artifacts', result);
    });
  }, page => { page.on('websocket', socket => socket.on('framesent', event => frames.push(JSON.parse(String(event.payload))))); }, PHONE);
  await fixture.pageCase(t, async page => {
    await step('accounts', async () => {
      await more(page, 'Accounts');
      const account = page.locator('[data-account-id="codex/qa-account"]');
      await account.getByText('41%', { exact: true }).waitFor();
      const text = await account.textContent();
      const result = { facts: ['qa-account', 'Codex', '5h', '41%'].filter(f => text.includes(f)), path: text.includes(join(fixture.root, 'qa-account')), moreCurrent: await page.getByRole('button', { name: 'More', exact: true }).getAttribute('aria-current'),
        switches: await page.getByRole('switch').count(), changing: await page.locator('main').getByRole('button', { name: /clear|remove|edit|revoke|delete|add|rename/i }).count(),
        inputs: await page.locator('main input, main select, main textarea').count() };
      await page.setViewportSize({ width: 640, height: 900 });
      await page.getByRole('switch', { name: 'Needs you', exact: true }).waitFor();
      result.desktop640 = { switches: await page.getByRole('switch').count() };
      out('accounts', result);
    });
  }, undefined, PHONE);
  // Context 6 (desktop 1440): the desktop Inbox keeps its drawer.
  await fixture.pageCase(t, async page => {
    await step('desktopInbox', async () => {
      await page.getByRole('button', { name: 'Inbox', exact: true }).click();
      const rows = await inboxRows();
      const id = rows?.requests?.[0]?.id ?? rows?.messages?.[0]?.id;
      await page.getByRole('list', { name: 'Inbox objects', exact: true }).locator(`[data-object-id="${id}"]`).click();
      out('desktopInbox', { drawer: await poll(() => page.getByRole('complementary', { name: 'Drawer', exact: true }).count(), v => v === 1), bar: await page.locator('nav[aria-label="Phone areas"]').count() });
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
  (cd "$W" && node hub/bin/cland.ts task plan show E-419 --json) > "$EV/E419S1-00-plan.json"
  node -e 'const [f,n]=process.argv.slice(1);const v=JSON.parse(require("fs").readFileSync(f,"utf8"));const s=v.stages.find(x=>x.name===n);console.log(JSON.stringify({stages: v.stages.map(x=>x.name), state: s.state, qa: s.qa, merged: s.merged, total: s.total, items: s.items}))' "$EV/E419S1-00-plan.json" "$STAGE" | tee "$EV/E419S1-00-stage.txt"
  for i in $(node -e 'const [f,n]=process.argv.slice(1);console.log(JSON.parse(require("fs").readFileSync(f,"utf8")).stages.find(x=>x.name===n).items.join(" "))' "$EV/E419S1-00-plan.json" "$STAGE"); do echo "== $i"; git -C "$W" log --first-parent --oneline --grep "Item: $i" dev; done
  ls "$W/web/src/phone.ts" "$W/web/test/phone.test.ts" "$W/web/test/phone-more.test.ts" "$W/web/src/InboxArea.tsx" "$W/web/test/harness.ts"
  for i in T-1165 T-1166 T-1167; do c=$(landed "$i"); echo "== $i paths outside web/ and docs/"; [ -n "$c" ] && git -C "$W" show --format= --name-only "$c" | grep -v -E '^(web/|docs/)'; done
  echo "== T-1167 files"; c=$(landed T-1167); [ -n "$c" ] && git -C "$W" show --format= --name-only "$c"
  echo "TMPDIR=$TMPDIR Q=$Q"
}
k02() {   # QA shell: the width seam, the key map, the harness's phone context, the frame, the width gate, T-1167's names and the probe's selectors
  echo "-- width seam"; grep -c -F "const query = '(width < 640px)';" "$W/web/src/phone.ts"
  git -C "$W" grep -n -E "max-width: ?6[34][09]px|width <=? ?6[34][09]px|innerWidth *[<>]=? *6[34][09]" -- web/src ':!web/src/phone.ts'
  git -C "$W" grep -l -w -E "isPhone|usePhone" -- web/src | sort | tr '\n' ' '; echo
  git -C "$W" grep -l -F "matchMedia(" -- web/src | sort | tr '\n' ' '; echo
  echo "-- key map"; for l in "  more: { Escape: 'dismiss' }," "export function actionAtWidth(action: Shortcut, phone: boolean): boolean {" "'tree-done', 'tree-archive', 'tree-message', 'tree-topic-message', 'tree-edit-criteria'," "'plan-approve', 'plan-discuss', 'artifact-compose', 'artifact-keep', 'artifact-archive',"; do printf '%s ' "$(grep -c -F -- "$l" "$W/web/src/keymap.ts")"; echo "$l"; done
  echo "-- harness phone context"; for l in "device.phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }" "'five rendered phone slots'"; do printf '%s ' "$(grep -c -F -- "$l" "$W/web/test/harness.ts")"; echo "$l"; done
  echo "-- frame"; for l in 'aria-label="Phone areas"' 'aria-label="More areas" data-key-context="more"' 'ReadOnlyItemCard' 'Back to {paneArea}'; do printf '%s ' "$(grep -c -F -- "$l" "$W/web/src/Shell.tsx")"; echo "$l"; done
  echo "-- T-1167 names (read at the build)"; git -C "$W" grep -n -E "Nothing needs you|need you|Requests to you|Open Plan" -- web/src | cut -c1-220
  grep -c -E "\b(usePhone|isPhone)\b" "$W/web/src/InboxArea.tsx"
  echo "-- probe selectors (each count at least 1)"; for a in data-inbox-section data-fold-toggle data-inbox-events data-inbox-archive-toggle aria-pressed data-composer-recipient; do printf '%s %s\n' "$(git -C "$W" grep -c -F -- "$a" -- web/src | awk -F: '{n+=$2} END {print n+0}')" "$a"; done
  c=$(landed T-1167); echo "-- T-1167 test files and names"; [ -n "$c" ] && for f in $(git -C "$W" show --format= --name-only "$c" -- 'web/test/*.test.ts'); do echo "== $f"; grep -o -E "(^test|t\.test)\('[^']+'" "$W/$f" | sed -E "s/^(test|t\.test)\('//; s/'$//"; done
}
k03() {   # QA shell: AGENTS.md web/ rules at the build
  git -C "$W" grep -n -E "keydown|keyup|keypress|onKey(Down|Up|Press)" -- web/src
  git -C "$W" grep -n -E "localStorage|sessionStorage" -- web/src
  git -C "$W" grep -n -E "dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML" -- web/src
  for i in T-1165 T-1166 T-1167; do c=$(landed "$i"); echo "== $i"; [ -n "$c" ] && git -C "$W" show --format= "$c" -- package.json package-lock.json web/package.json hub/package.json nvim/package.json | grep -E '^[+-] '; done
}
k04() {   # docs, in QA's own shell
  ( cd "$W" || exit 1
    chk() { printf '%s present %s: %s\n' "$(grep -c -F -- "$2" "$1")" "$1" "$2"; }
    printf '%s heading %s\n' "$(grep -c -x -F '## Phone' web/README.md)" '## Phone'
    echo "-- T-1165 C6"
    chk web/README.md '`src/phone.ts` owns the below-640-CSS-px width check: `isPhone()` for event'
    chk web/README.md 'On a phone the rail gives way to Inbox, Topics, Sessions, Events and More in a'
    chk web/README.md 'with the hub dot. Coordinator and Help leave the header; help remains available'
    chk web/README.md 'in the palette. Header, bar and More controls are at least 44 px tall. More opens'
    chk web/README.md 'Items, Artifacts and Accounts in a sheet above the bar without a scrim. Selection,'
    chk web/README.md 'The phone renders one pane and no drawer. Split shortcuts do nothing; the saved'
    chk web/README.md '`fixture.pageCase(t, body, beforeNavigate, { phone: true })` (use `undefined` for'
    chk web/README.md 'an unused setup callback). It creates a fresh 390×844 Headless Shell context with'
    chk web/README.md '`node --test web/test/phone.test.ts` and'
    chk docs/agents/tests.md '`web/test/phone.test.ts` owns the phone-frame seam through sealed `webFixture`'
    echo "-- T-1166 C5"
    chk web/README.md 'More keeps its current mark while Items, Artifacts or Accounts is open:'
    chk web/README.md '`ReadOnlyItemCard` full screen, with its summary, facts, progress, verdict,'
    chk web/README.md 'Plan and the view switcher stay desktop only. Physical D/A, m/M, e and the'
    chk web/README.md '- Artifacts keeps its list, folders and full-screen viewer. Keep, Archive and'
    chk web/README.md 'attach-to-composer actions are absent from phone help/palette and inert on'
    chk web/README.md '- Accounts keeps the registry paths, windows, limits and this browser'
    chk web/README.md 'Item cards and artifact viewers have a 44 px back control; browser Back returns'
    chk web/README.md 'to the list too. At 640 px and wider the desktop views and actions remain,'
    chk web/README.md '`node --test web/test/phone-more.test.ts` after building the bundle.'
    chk docs/agents/tests.md '`web/test/phone-more.test.ts` uses that same phone context and sealed public'
    echo "-- T-1167 C6 (names at the build; then read)"
    chk web/README.md 'Nothing needs you'
    chk web/README.md 'need you'
    grep -n -i -E "inbox.{0,40}(home|phone)|(home|phone).{0,40}inbox" web/README.md | cut -c1-200
    c=$(landed T-1167); [ -n "$c" ] && git show --format= "$c" -- web/README.md docs/agents/tests.md hub/README.md | grep -E '^[+-][^+-]' | cut -c1-200
    echo "-- statements to read against the implementation (candidates for low findings)"
    grep -n -F -e "belongs to More's notification controls" -e 'opens its card in the drawer' -e '**Requests**' -e 'The selected row' web/README.md | cut -c1-200
    grep -n -i -E 'stand-in|not yet|until (E-41[0-9]|T-11[0-9][0-9]) lands|next ticket|later ticket' web/README.md | cut -c1-200 )
}
k12() {   # sealed, in $W: the QA probe (one Headless Shell scratch hub; facts to $EV/E419S1-12.jsonl)
  : > "$EV/E419S1-12.jsonl"                    # start the fact file empty
  ( cd "$QA_W" && QA_OUT="$EV/E419S1-12.jsonl" node --test --test-reporter=tap "$QA_Q/probe.test.mjs" > "$EV/E419S1-12.log" 2>&1; echo "exit $?" >> "$EV/E419S1-12.log" )
  tail -n 1 "$EV/E419S1-12.log"; grep -E '^# (tests|pass|fail) |Web fixture census' "$EV/E419S1-12.log"
  cat "$EV/E419S1-12.jsonl"
}
k13() {   # sealed, in $W: the full typecheck with the web guards, the tier lint and the stage's classifications
  ( cd "$QA_W" && npm run typecheck > "$EV/E419S1-13.log" 2>&1; echo "typecheck exit $?"; node hub/test/lint-tiers.ts > "$EV/E419S1-13-tiers.log" 2>&1; echo "tiers exit $?" )
  grep -F -e 'web HTML: raw-HTML sinks refused; seeded fixtures passed' -e 'web colours: token-only sources; colour fixtures passed' -e 'web tokens:' -e 'web hooks: conditional-hook fixture rejected by configured oxlint' "$EV/E419S1-13.log"
  grep -F -e '"web/test/phone.test.ts": "Web"' -e '"web/test/phone-more.test.ts": "Web"' -e '"web/test/inbox.test.ts": "Web"' "$QA_W/hub/test/tiers.json"
  c=$(landed T-1167); [ -n "$c" ] && for f in $(git -C "$QA_W" show --format= --name-only "$c" -- 'web/test/*.test.ts'); do grep -F "\"$f\": \"Web\"" "$QA_W/hub/test/tiers.json"; done
}
k15() {   # QA shell: cleanup of the fixture-owned processes and the scratch root
  for f in "$EV"/E419S1-0[6-9]*.log "$EV"/E419S1-1[0-2]*.log; do [ -e "$f" ] || continue; printf '%s ' "$(basename "$f")"; census "$(basename "$f" .log)" | tr '\n' ' '; echo; done
  git -C "$W" status --porcelain | grep -v -x -F '?? node_modules' | wc -l
  echo "$Q"
}
```

Cleanup after the evidence is recorded: print `$Q`, check it begins with `/private/tmp/qa-e419s1-`, and remove it by that literal path with a non-force `rm -r`. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). A failed Web case writes a Playwright trace under `$W/web/test-results/`; name it as evidence before removing the worktree. Sign-in links and cookies are never printed or posted.

## Cases

none. No headless-grid case covers the web phone frame, More or the phone Inbox; every check below is a manual check through named test files, the QA probe's Headless Shell pages, git greps, the CLI or the docs, recorded with `qa-record.sh note`.

### Web cases (when in scope)

none: no `real-browser` case in this run (see "Out of scope"). Every stage criterion is proven in Chrome Headless Shell's phone context (390×844, touch, mobile flag) and desktop contexts against signed-in sealed scratch hubs with fake senders (E419S1-06 to E419S1-12).

## Manual checks

Record each with `sh .agents/skills/qa/qa-record.sh note E-419 "$RUN" <id> hub-api "<command>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence-file…>` from `$W` in QA's own shell, naming where it ran at the start of the command text (`[QA shell]`, `[test $W]`, `[sealed $W]`, `[docs]`). The recorder takes `hub-api` for every check here; the probe's page steps are Headless Shell observations recorded the same way. Save each check's printed output as `$EV/<id>.txt` (pipe the row's command through `tee`) and name it, with the captures the row wrote, as evidence.

How to run a row, by its `where`:
- **sealed $W**: `( . "$Q/env.sh"; cd "$W" && <command> )`, after `quiet` when the row runs a test, the probe or the typecheck (E419S1-12, E419S1-13).
- **test $W**: in QA's own shell; `nt` runs `quiet` first and seals the test run itself.
- **docs** and **QA shell**: in QA's own shell, as QA; the plan reads of E419S1-00 and E419S1-14 are the only checks that touch the live hub, and only to read.

Order: the setup and E419S1-00; then E419S1-01 to E419S1-05, which need no test slot (run them while a stage cover may still hold it); then `quiet` and E419S1-06 to E419S1-13 in id order (E419S1-01's bundle serves every Web file and the probe); then E419S1-14 and E419S1-15.

**How a test row is judged.** Two separate things, never one:
1. **Clean**: the log shows `exit 0`, `# fail 0`, `# cancelled 0`, `# skipped 0`, `# todo 0`, `# pass` equal to `# tests`, no `not ok` and no `# SKIP`; every Web log's `census` prints a first count of at least `1` and a second count of `0`.
2. **Required names**: every test named in the row's "required" list appears in `oks` (a name that appears on no `ok` line proves nothing; a name pattern matching zero tests passes with exit 0 and `# tests 0`).

TAP totals are not judged: they move with unrelated landings. The row gives the totals at writing for orientation only; a different `# tests` count is fine when the log is clean and every required name passes. A required T-1165 or T-1166 name missing at the build is judged by the file's own names at the build: renamed with the same body is PASS with the rename recorded; removed is FAIL for the criterion it carried.

| id | surface | where | covers | command | expected |
| --- | --- | --- | --- | --- | --- |
| E419S1-00 | hub-api | QA shell | build, plan, merges, sealing | `k00 \| tee "$EV/E419S1-00.txt"` | Both SHAs equal `$S`; `0` changed paths; the symlink reads `/Users/evgeniyivanov/Projects/cland/v0/node_modules`. The plan lists the stages `bottom bar and inbox home`, `asks, threads, the composer and install`, `sessions and disconnected`, `notifications and the guide`; this stage has `qa` `{scope: "affected", when: "after-stage"}`, `state` not `closed` (it closes only after this verdict and the covers), `items` T-1165, T-1166, T-1167 plus any findings fixes the request names (nothing else), `total` equal to the number of printed items and `merged` equal to `total`; record the printed line as printed. Under every `== <id>` line exactly one commit line (T-1165 `dc6c6762`, T-1166 `0e1b26d4` at writing; T-1167 the commit that landed it); a missing line is BLOCKED "<id> not on dev". All five files listed. Paths outside `web/` and `docs/`: under T-1165 `hub/test/durations.json` and `hub/test/tiers.json`; under T-1166 `hub/test/tiers.json`; under T-1167 at most `hub/test/tiers.json` and `hub/test/durations.json` (a new Web file's tier, a dated allowance: no finding). No `hub/src/`, `shared/` or `nvim/` path under any id (one is a scope finding to report, not judged here). Record T-1167's file list. `TMPDIR` is the system default (not `/tmp`) and `Q` begins `/private/tmp/qa-e419s1-`. Also record the setup's two counts (the first at least `1`, the second `0`) and `probe parses`. Repeat the first two commands after E419S1-15: unchanged (dev not moved) |
| E419S1-01 | hub-api | sealed $W | build | `npm run build --workspace web > "$EV/E419S1-01.log" 2>&1; echo "build exit $?"; ls web/dist/index.html web/dist/assets; git status --porcelain \| grep -v -x -F '?? node_modules' \| wc -l` | `build exit 0`; `web/dist/index.html` and the `assets` directory listed; `0` changed paths (`web/dist` is ignored). Needs no test slot |
| E419S1-02 | hub-api | QA shell | the width seam (T-1165), the `more` context (T-1165 C4), `actionAtWidth` (T-1166 C2), the harness's phone context, T-1167's names and the probe's selectors | `k02 \| tee "$EV/E419S1-02.txt"` | After `-- width seam`: `1`; the scattered-breakpoint grep prints nothing (no `max-width: 639px`, `width < 640px` or `innerWidth` comparison anywhere in `web/src` outside `phone.ts`, which the grep excludes); the seam's readers include `web/src/Shell.tsx`, `web/src/sessions/SessionGroups.tsx`, `web/src/sessions/SessionRow.tsx` and `web/src/phone.ts` (at writing also `InboxArea.tsx`, `ItemsTree.tsx`, `ItemsView.tsx`, `accounts/AccountsArea.tsx`, `accounts/Profile.tsx`, `artifacts/ArtifactsArea.tsx`); the `matchMedia(` files are exactly `web/src/Composer.tsx` (pointer coarse), `web/src/desktop.ts` and `web/src/phone.ts` (a new width query elsewhere is a T-1165 C1/C2 finding: one seam). After `-- key map` four lines whose count is `1`. After `-- harness phone context` two `1` lines. After `-- frame` four lines with counts of at least `1`. After `-- T-1167 names`: at least one `web/src` line with `Nothing needs you` and one with `need you` (none is FAIL for T-1167 C2); record the third section's name (`Requests to you` per T-1167, `Requests` at writing) and whether `Open Plan` survives only outside the phone path; the `InboxArea.tsx` count is at least `1`. Every probe selector count is at least `1` (a `0` means a renamed attribute: correct the probe as "QA probe" says before E419S1-12). Record T-1167's test files and the names in them: E419S1-08 runs those files |
| E419S1-03 | hub-api | QA shell | AGENTS.md `web/` rules | `k03 \| tee "$EV/E419S1-03.txt"` | The key-listener grep lists only `web/src/keyboard.ts` (one `document.addEventListener('keydown', …)`, its handler and its removal): no component-local key listener in `Shell.tsx`, `InboxArea.tsx`, the More sheet or the read-only Items, Artifacts and Accounts paths (More's Escape is the `more` context). Storage appears only in `web/src/interface-state.ts` under `cland.ui.<area>.v1` and in `web/src/connection.ts`'s `cland-reload-build` guard (the phone frame, folds and drafts reach storage through `interface-state.ts`). The raw-HTML grep prints nothing. Under the three ids nothing: no dependency, devDependency or lockfile change |
| E419S1-04 | hub-api | docs | T-1165 C6, T-1166 C5, T-1167 C6 | `k04 \| tee "$EV/E419S1-04.txt"` | The `## Phone` heading line starts with `1 `. Every `present` line under `-- T-1165 C6` and `-- T-1166 C5` starts with `1 ` (or more): a `0` is FAIL for that criterion unless the same statement moved with T-1167's docs change (read it in place and record the new wording). Under `-- T-1167 C6`: `Nothing needs you` present at least once, and T-1167's docs diff prints added lines; then read `web/README.md`'s `## Phone` and `## Inbox` sections at the build and confirm they describe the inbox as home on the phone: the four sections in order with 44 px fold headers and counts, an empty section kept at 0, "N need you" and "Nothing needs you", two-line rows with no drawer, a tapped message or request unfolding in place with a reply to its sender in the row's topic and the draft that survives a reload, a waiting plan as a row without approve or Open Plan, ask and approval rows unchanged, and the events and archive lines as 44 px controls (events opens Events, archive opens in place). No such description is FAIL for T-1167 C6; a missing detail is a **low** finding. Then read `web/README.md`'s Phone, Inbox, Split and drawer, Palette and keys, Items views, Artifacts, "Accounts strip and Accounts area" and "Browser tests" sections and the `docs/agents/tests.md` paragraphs for `phone.test.ts`, `phone-more.test.ts` and T-1167's test file, and record any statement that contradicts E419S1-02 or E419S1-06 to E419S1-12 as a **low** finding with file and line (the row stays PASS when the only contradictions are docs ones). Candidates at writing, to confirm or dismiss at the build: the Phone section's "their phone home belongs to More's notification controls" while More lists only Items, Artifacts and Accounts in this stage (probe `more.items`); "Selecting an item by click or keyboard focus opens its card in the drawer" in "Split and drawer" without the phone's full-screen card; the Inbox section's "**Requests**" if T-1167 renamed the section `Requests to you`; the Inbox section's drawer and reply paragraphs ("The selected row's drawer …") without the phone's in-place reply |
| E419S1-05 | hub-api | sealed $W | brief | `cland qa lint qa/briefs/E-419-stage-1.md; echo "exit $?"` | `qa/briefs/E-419-stage-1.md: qa lint passes at the build` and `exit 0` (this brief, committed at the build). Needs no test slot |
| E419S1-06 | hub-api | test $W | T-1165 C1–C5 | `nt E419S1-06 web/test/phone.test.ts; oks E419S1-06; census E419S1-06` | Clean. Required names: "five touch slots open the four areas and Inbox is home" (C1: viewport `{width: 390, height: 844}`, touch and coarse pointer, `main` is Inbox, no `Areas` rail, the bar's labels `Inbox`, `Topics`, `Sessions`, `Events`, `More`, each of the four taps makes its area current), "More has no scrim, closes on Escape, selection and outside taps, and frame controls fit touch" (C4 and C5: no Coordinator or Help button, the sheet lists `Items`, `Artifacts`, `Accounts`, no `aria-modal` or scrim, every header, bar and sheet control at least 44 px and inside 390 px, the sheet above the bar, a physical Escape closes it and focuses More, choosing each area opens it with More current, a tap on Project closes it), "640 px keeps the collapsed rail and 639 px swaps to the bar without reload" (C2: the 60 px rail and no bar at 640, the bar and no rail at 639, no navigation), "phone selection and split chords leave the saved desktop split intact" (C3: the 1440 split collapses at 390, a row opens its exact full-screen card with no drawer, ⌘Enter and ⌘\ open no pane, `secondary` stays `Accounts`, after a phone reload no pane, at 1440 the split returns at 2:1), "the phone frame replaces the rail without losing desktop state" (the parent), "phone Inbox selection keeps its cards inline without a drawer" (C3 in the Inbox; T-1167 may replace or rename it: then T-1167's own no-drawer test in E419S1-08 carries it) and "phone badges share attention facts and count every event since the shared last look" (C1's counts: Inbox `1`, Topics and Sessions `0`, Events equal to every event since the shared last look across pages, More without a count, a later last look clears Events). Totals at writing (not judged): `# tests 7` (3 top-level, 4 subtests), census `3` and `0` |
| E419S1-07 | hub-api | test $W | T-1166 C1–C4; the desktop at 1440 and 640 | `nt E419S1-07 web/test/phone-more.test.ts; oks E419S1-07; census E419S1-07` | Clean. Required names: "phone Items opens a reusable read-only full-screen card and returns by either back control" (C1: no `Items view` group, the card's blocks `Summary`, `Facts`, `Progress`, `Latest verdict`, `Relations`, `Branch and suite`, `Dates`, criteria readable with no input, textarea, form or action button, More current, no drawer, **Back to Items** at least 44 px, Back and browser Back return to the row; at 640 the saved Graph view returns), "phone item action keys are inert and desktop keys still filter, compose and edit" (C2: `Shift+D`, `Shift+A`, `m`, `Shift+M`, `e`, `a`, `d` change no filter and nothing `cland task view T-1 --json` reads; the palette offers none of `Hide done items`, `Show archived roots`, `Message General`, `Message item topic`, `Edit criteria block`, `Approve plan`, `Discuss plan with Lead`; at 1440 `Shift+D` and `Shift+A` toggle, `m` opens Quick message, `Shift+M` the item topic, `e` and **Mark C1 done** record C1 done as the CLI reads; at 640 the switcher and the criterion editor remain), "phone Artifacts opens the full-screen viewer without Keep, Archive or compose" (C3: the viewer in the page surface, More current, no Artifacts pane or drawer, no `Keep`, `Archive`, `Compose` or `Attach` button, no `artifact.keep` or `artifact.archive` frame, no such palette action, both back paths, the artifact's status and kept flag unchanged), "phone Accounts retains registry and window facts while notification switches stay desktop only" (C4: `phone-account`, `Codex`, its home path, `5h`, `38%`, `poll`; no switch, no clear, remove, edit or revoke button; two switches at 640) and "phone Back wins over an earlier held item-link read" (C1's back paths against a held item-link read). Totals at writing (not judged): `# tests 5`, census `5` and `0` |
| E419S1-08 | hub-api | test $W | T-1167 C1–C5 (the item's own Web tests) | `for f in $(git -C "$W" show --format= --name-only "$(landed T-1167)" -- 'web/test/*.test.ts'); do b=$(basename "$f" .test.ts); nt "E419S1-08-$b" "$f"; oks "E419S1-08-$b"; census "E419S1-08-$b"; done` | The files are those T-1167's landing adds or changes under `web/test/` (E419S1-02 printed them and their test names; none is FAIL for C1–C5: T-1167 names a Web test for each). Each file clean. Required names: read at the build, not at writing. For each of C1–C5 at least one passing test in these files whose body (read at the build) asserts that criterion at 390×844 through the phone context (`{ phone: true }`): C1 the four sections in order with fold buttons at least 44 px and counts, an empty section at 0; C2 "Nothing needs you" with its check, then a fake ask restoring the count; C3 a tapped message row unfolding with a reply to its sender in the row's topic and the draft surviving a reload; C4 a waiting plan row with counts and no approve or Open Plan; C5 the events and archive lines at least 44 px, the events line opening Events. Record the mapping test name → criterion in `$EV/E419S1-08-map.txt`. A criterion with no such test is FAIL for it, even when E419S1-12 shows the behaviour (the criterion says Web test). A file also run by another row must be clean in both runs |
| E419S1-09 | hub-api | test $W | Inbox, folds and Events regression (desktop Inbox drawer and reply, the events line and its shared count) | `nt E419S1-09a web/test/inbox.test.ts; oks E419S1-09a; census E419S1-09a; nt E419S1-09b web/test/folds.test.ts; census E419S1-09b; nt E419S1-09c web/test/events.test.ts; oks E419S1-09c; census E419S1-09c` | Each clean. Required names in `oks E419S1-09a`: "Inbox keeps four ordered sections, newest five rows, oldest wait, live ages and saved folds" (its section headings may follow T-1167's rename: the test as changed at the build), "selected request and message unfold, physical d declines to the sender or reads exactly that row" (the desktop drawer remains at 1440), "Enter opens an Inbox message at its anchored thread row and a waiting plan in Plan" (the desktop keeps Open Plan), "Inbox drawer follows the selected message and physical r replies to its fake sender", "A opens seven days of Inbox departures with outcomes and an archive line below empty sections", "the events footer survives four empty sections and follows shared last-look marks and warnings", "the events footer counts all unread pages including a warning older than the newest 200". Required in `oks E419S1-09c`: "opening Events shares the last look, marks newer rows for the visit and clears the Inbox events line", "an Inbox alongside filtered Events still counts new events outside that filter". Folds: clean. Totals at writing (not judged): inbox `# tests 23`, folds `6` (1 top-level, 5 subtests), events `11`; censuses at least `1` and `0` |
| E419S1-10 | hub-api | test $W | desktop regression at 1440 and 640: no lost Items, Plan, Artifacts, Accounts or notification action | `nt E419S1-10a web/test/plan.test.ts; oks E419S1-10a; census E419S1-10a; nt E419S1-10b web/test/items.test.ts; census E419S1-10b; nt E419S1-10c web/test/items-actions.test.ts; oks E419S1-10c; census E419S1-10c; nt E419S1-10d web/test/item-criteria.test.ts; oks E419S1-10d; census E419S1-10d; nt E419S1-10e web/test/item-card.test.ts; census E419S1-10e; nt E419S1-10f web/test/artifacts.test.ts; oks E419S1-10f; census E419S1-10f; nt E419S1-10g web/test/accounts.test.ts; census E419S1-10g; nt E419S1-10h web/test/notifications.test.ts; oks E419S1-10h; census E419S1-10h` | Each clean. Required names: plan "C1 a approves a waiting plan as the human and the CLI reads the receipt" and "C3 approval is absent and inert below desktop width and on a live resize" (T-1166 changed it: at 390 the tree replaces the Plan view, `a` sends no approve frame, approval stays `pending`); items-actions "three selected items send one General message to the fake Coordinator" and "M creates a missing item topic and sends the quick message there"; item-criteria "C1 add edit and remove preserve other ids and never reuse an id" and "C2 done is recorded as the human" (T-1166 gave `ItemCriteria` a read-only mode: the desktop editor stays); artifacts "k keeps and unkeeps an agent artifact while the up arrow navigates", "d archives without deleting human bytes and Enter requests folder files" and "This topic follows the last opened thread and s adds its artifact to the retained composer draft and sent history" (Keep, Archive and compose remain on the desktop); notifications "profile switches persist Finished off across reload and request permission only on first enable" (the Profile switches remain on the desktop). Totals at writing (not judged): plan `4` (1 top-level, 3 subtests), items `8`, items-actions `7`, item-criteria `4`, item-card `6`, artifacts `11`, accounts `6`, notifications `8` |
| E419S1-11 | hub-api | test $W | shell, split, area slots, keys, palette and Sessions regression (the split survives; the Sessions narrow row now reads the seam) | `nt E419S1-11a web/test/shell.test.ts; oks E419S1-11a; census E419S1-11a; nt E419S1-11b web/test/area-slots.test.ts; census E419S1-11b; nt E419S1-11c web/test/key-contexts.test.ts; census E419S1-11c; nt E419S1-11d web/test/palette.test.ts; census E419S1-11d; nt E419S1-11e web/test/sessions.test.ts; oks E419S1-11e; census E419S1-11e; nt E419S1-11f web/test/session-actions.test.ts; oks E419S1-11f; census E419S1-11f; nt E419S1-11g web/test/session-drawer.test.ts; oks E419S1-11g; census E419S1-11g; nt E419S1-11h hub/test/web-keymap.test.ts; oks E419S1-11h` | Each clean. Required names: shell "split panes start at 2:1, drag, swap and close while restoring the rail choice", "selected hub rows open the drawer; close and Esc persist until selection moves; Split and command Enter open the other pane" and "the rail collapses to stroke icons at 60 px and remembers the button choice"; sessions "Sessions rows render merged facts, holds, waiting detail and physical selection keys" (its 600 px narrow rows, now through the seam); session-actions "At narrow width a tap or Enter opens the session page"; session-drawer "desktop Enter and Open thread focus the selected session log with shared physical thread keys"; T1 web-keymap "focused contexts resolve before shell keys without changing Items or Plan chords" and "browser tab/window chords remain unbound and area shortcuts require exact modifiers" (census prints `0 0`, expected for T1). Totals at writing (not judged): shell `9` (1 top-level, 8 subtests), area-slots `4`, key-contexts `3`, palette `11` (its viewport loop), sessions `5`, session-actions `9`, session-drawer `7`, web-keymap `2` |
| E419S1-12 | hub-api | sealed $W | T-1165 C1–C5, T-1166 C1–C4, T-1167 C1–C5, the desktop at 640 and 1440 (independent probe) | `k12` | **The TAP pass and the facts are judged separately.** TAP: `exit 0`, `# tests 1`, `# pass 1`, `# fail 0`, one `Web fixture census: browser group <pid>; before <n>; after 0; scratch hub stopped` line: this proves only that the probe ran to its end and cleaned up, nothing about the product. Facts, each judged on its own; a `step` line means that step's facts are missing: FAIL for the criterion it carries when the product lacks the thing, or a probe correction (see "QA probe") when only a selector changed. `seeded` `{topic: true, note: true}`; `seededInbox` `{message: true, request: true, plan: true}`. **T-1167** (written from its criteria): `emptyHome` (C1, C2): `area: "Inbox"` (first load is home), `sections` ids `asks`, `plans`, `requests`, `messages` in that order named `Asks and approvals`, `Plan approvals`, `Requests to you` (`Requests` at writing: a remaining `Requests` is a **low** finding against "What to build", not a C1 failure), `Messages to you`, each `count: "0"` and `empty: true`; `folds` `{count: 4, under44: [], outside: []}`; `foldWidths` each at least 90% of `listWidth` (full-width fold buttons: "What to build"; a narrower button is a **low** finding); `title.nothing` at least `1`, `title.detail.text` contains `Nothing needs you` and a check (a `✓` in the text or `svgs` at least `1`), `title.detail.colour` equal to `title.pillClearColour` (the needs-you pill's clear green; a different colour is a **low** finding); `drawer: 0`. `askReturns` (C2): `title.nothing: 0`, `title.needYou` contains an entry with `1 need you`, `inboxBadge: "1"`, `askSection: 1`. `sectionsFilled` (C1, rows): `counts` `[["asks",1],["plans",1],["requests",1],["messages",1]]`; `title.needYou` contains `<n> need you` where `<n>` is the number in `title.pill` (`Needs you 4` at writing); `messageRow.lines: 2` and `overflow: false` (two lines at 390 px: "What to build"; one line or overflow is a **low** finding). `askInline`: `options: 2`, `drawer: 0` (ask rows keep in-place unfolding). `messageReply` (C3): `body: true`; `buttons` include one containing `Open topic` and one containing `Mark read`; `fields: 1`; `recipient` names `coord` (the sender); `drawer: 0`; `storedBeforeReload` a JSON value whose `text` is `QA phone draft`; `afterReload: "QA phone draft"`; `delivered` `{content: "QA phone draft", topic: "row topic", replyTo: true}`. `requestRow`: `body: true`, `buttons` include `Open topic` and `Decline`, `drawer: 0`; `fields: 1` ("What to build" gives requests the same reply; `0` is a **low** finding). `planRow` (C4): `counts: true` (`1 stages · 1 lanes · 1 items`), `approve: 0`, `openPlan: 0` (`1` at writing: the desktop's **Enter · Open Plan**), `area: "Inbox"`; one of `titles` says plan approval needs the desktop's Plan view (absent: **low**). `listClose` (C1 folds, C5): `order` four `section` then `events` then `archive`; `events` and `archive` each `{count: 1, under44: [], outside: []}`; `foldAfterReload: "false"` (the fold remembered per browser); `archiveInPlace` `{area: "Inbox", list: 1}`; `eventsOpens: "Events"`. **T-1165** (as at writing): `frame` (C1): `viewport` `{width: 390, height: 844}`, `touch: true`, `rail: 0`, `counts` labels `Inbox`, `Topics`, `Sessions`, `Events`, `More` in that order with More `null` and Inbox equal to the number in `pill` (`4` at writing; `3` if the reply settled the message), the others numbers (`0` at writing); every `taps` entry `[<area>, "page"]`; `header` `{coordinator: 0, help: 0, palette: 1, needsYou: 1, hubDot: 1, project: 1}`. `more` (C4, C5): `items` `["Items", "Artifacts", "Accounts"]`, `scrim: 0`, `above: true`, `controls` `{count: 11, under44: [], outside: []}` (count at writing; judged by `under44` and `outside`), `escape` `{closed: true, focusOnMore: true}`, each `choose` entry `{area: <that area>, sheet: 0, moreCurrent: "page"}`, `outside: 0`. `widths` (C2, C3 and the desktop): `at1440` `{rail: 1, railWidth: 60, bar: 0, panes: 2, drawer: 0}` (the split collapses the rail); `at640` the same (collapsed rail, no bar, the split survives); `at639` `{rail: 0, railWidth: 0, bar: 1, panes: 1, drawer: 0}`; `at390` the same plus `card: "T-1"` and `saved: "Accounts"`; `afterPhoneReload` as `at639`; `back1440` `{rail: 1, railWidth: 60, bar: 0, panes: 2, drawer: 0, ratio: 2}`; `documentLoads: 1` (only the explicit reload: resizing never reloads). **T-1166** (as at writing): `items` (C1, C2, desktop): `switcher: 0`; `keys` `{filtersUnchanged: true, cliUnchanged: true, quickMessage: 0}`; `card` `{id: "T-1", width: 390, tree: 0, moreCurrent: "page", inputs: 0, actions: 0, drawer: 0, back: {count: 1, under44: [], outside: []}}`; `cardKeys` `{inputs: 0, cliUnchanged: true}`; every `palettePhone` value `0`; `browserBack` `{card: 0, row: 1}`; `desktop1440` `{switcher: 1, doneHidden: 1, quickMessage: 1}` with every palette value `1`; `desktop640` `{switcher: 1}` with every palette value `1`. `artifacts` (C3, desktop): `viewerWidth: 390`, `moreCurrent: "page"`, `pane: 0`, `drawer: 0`, `controls: 0`, `writes: 0`, `unchanged: true`, `back` `{count: 1, under44: [], outside: []}`, every `palettePhone` value `0`, `browserBack` `{viewer: 0, row: 1}`, `desktop640.palette` `{"Keep artifact": 1, "Archive artifact": 1}`. `accounts` (C4, desktop): `facts` `["qa-account", "Codex", "5h", "41%"]`, `path: true`, `moreCurrent: "page"`, `switches: 0`, `changing: 0`, `inputs: 0`, `desktop640` `{switches: 2}`. `desktopInbox` (desktop): `{drawer: 1, bar: 0}` |
| E419S1-13 | hub-api | sealed $W | typecheck, colour and HTML guards, tiers | `k13` | `typecheck exit 0` with no diagnostic in the log (hub, Neovim, shared wire and web typechecks; the colour, token, HTML and hooks guards: `Shell.module.css`, `InboxArea.module.css`, `ItemsTree.module.css` and the Sessions styles hold no colour value; secondary text keeps 4.5:1 on ground and selection); the four guard lines appear (`web HTML: raw-HTML sinks refused; seeded fixtures passed`, `web colours: token-only sources; colour fixtures passed`, `web tokens: <n> text tokens ≥4.5:1 on ground and selection; role colours match hl.lua`, `web hooks: conditional-hook fixture rejected by configured oxlint`); `tiers exit 0`; the three `"Web"` classifications print, and one `"Web"` line for every test file T-1167 added (none added: nothing more) |
| E419S1-14 | hub-api | QA shell; the Coordinator's stage covers | stage covers | `(cd "$W" && node hub/bin/cland.ts task plan show E-419) \| tee "$EV/E419S1-14.txt"` and the cover results the request names | QA runs no full suite. The Coordinator owns the stage covers (`cland verify all --occasion stage`): full integrated suites at the tested SHA on Linux (the droplet) and macOS (local), which add T3 and the Web phase on both platforms and are cited evidence this run does not run. Record the plan's line for this stage exactly as printed; Linux and macOS covers green at the tested SHA, each with its Web phase run (not "Web unavailable"); record each cover's run id, artifact, executor, platform, tiers and phases, wall time and cost as cited evidence. Any red cover is FAIL naming its failing tests. A cover still running when every other check is done: wait for its result in the epic topic (the macOS cover takes about 20 minutes; a wait is not BLOCKED); none queued or running at the tested SHA by then: BLOCKED "no stage cover at the tested SHA", reported to the requester |
| E419S1-15 | hub-api | QA shell | cleanup | `k15 \| tee "$EV/E419S1-15.txt"` | Every Web log line prints a first census count of at least `1` and a second of `0` (E419S1-06 to E419S1-11g, E419S1-12; the T1 log E419S1-11h prints `0 0`, which is expected); `0` changed paths; `$Q` begins `/private/tmp/qa-e419s1-`. Then remove `$Q` and the worktree as "Setup" says |

Re-check helper, file and test names with grep at the tested build: renames happen. The named Web tests and the probe ask the live hub's verify slot for admission themselves (`suite.slot` check): an admission refusal or timeout while a cover holds the slot is not a product failure; run `quiet` and retry that row once.

Before requesting QA, run `cland qa lint <brief>` with this filled brief at the build under test. The brief is complete only when qa lint passes at the build.

## Probes that mislead

- Process cleanup probes use a fixture-owned pid/process-group census, registered at launch and checked through exit; a machine-wide `pgrep` counts other sessions too (A-9063 R2; E-413 stage 1/T-1093). Here: each Web fixture's `Web fixture census: browser group <pid>; before <n>; after 0; scratch hub stopped` line, the probe's included.
- Edit existing keys in initialized configs, list standalone-test build prerequisites, enumerate regular files only for file probes, and identify events by seq/id. A second-client check allows only defaults the new client writes itself (A-8634 R12; E-412 stage 2, E-415 stage 3/DoD, E-1006). Here: the probe writes `.cland/config.toml` and the sealed `accounts.toml` before the hub starts, as the items' own tests do; its frame client and fake spoke only read and send through public frames; the pages write their own preferences and drafts.
- Transcript assertions identify stable item/topic/frame ids, with intervals starting at the result frame of the state-changing request. Preserve unaltered captures when correcting a probe and label the correction separately from product failures (A-8634 R13; E-412/E-415/E-1006; A-9063 R2; E-413 stage 1/T-1093). The probe finds asks, messages, requests, items and artifacts by the ids their creating requests or `inbox.list` returned, never by position; the reply's delivery is matched by `reply_to` equal to the message id.
- Exact tracker copies replace the initialized tracker directory after its writers stop; apply the full `fixtureEnvironment` result after overlays, check zero credential-prefix names before launching scratch processes and report names/counts only (A-9063 R2; E-413 stage 1/T-1093). This run needs no tracker copy: every scratch project is a fresh Web harness project seeded before its hub starts.
- An accessibility-tree count does not prove visible reachability (A-9063 R6; T-1095, T-1097). Touch sizes and fit are judged from each visible control's bounding box (`under44`, `outside`), never from a count; the line count of a row clusters its text boxes' vertical middles (10 px), not its height.
- A probe's TAP pass is not a product verdict: the probe asserts nothing about the product, so `# pass 1` with a `step` line or a wrong fact is still a finding. Judge each fact; the TAP lines only prove the run ended and cleaned up.
- T-1167's probe steps and E419S1-08's required names were written before T-1167 had code: grep its names at the build (E419S1-02), correct a renamed selector as "QA probe" says, and judge a criterion by its words, not by a guessed label.
- Touch is Headless Shell's emulation (`hasTouch`, `isMobile`, coarse pointer, `tap()`), as the items' tests use; a real phone is out of scope. On a coarse pointer the composer's Enter inserts a newline, so the probe sends the reply with its Send button.
- Physical keys are dispatched as `KeyboardEvent`s with the code and a Cyrillic key value (`ж`), as the items' tests do, to prove the physical-code map; Playwright's `press` would send the Latin key value too. The probe's Items, Artifacts and palette keys use `press`, which the shared map also resolves by code.
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file.
- A "ran" marker grep excludes the configuration echo line.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log: not applicable, QA runs nothing on a droplet. Speed criteria use measured wall times, never projections: this stage has none; duration lines and T-1165's dated allowance for the `phone.test.ts` parent are report-only here.
- Slots due or queued before the build count even when their results arrive later.
- "No skip": the Web files and the probe need Chrome Headless Shell (local on macOS); a skipped or "Web unavailable" result is BLOCKED, never PASS. Linux runs of the same files are cited from E419S1-14, not run by QA.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

Real Chrome, a real phone and computer use: out of scope for this run, not BLOCKED, as in E-418's stages: every stage criterion is proven in Chrome Headless Shell's phone context (390×844, touch, the mobile flag) against signed-in sealed scratch hubs, and an anonymous real browser at the live edge would show only the offline shell with nothing to act on. Also out of scope: the ask and approval sheets, threads, the phone composer and install (stage 2), the Sessions page and the disconnected state on the phone (stage 3), notifications, the service worker and More's notification controls (stage 4), beyond regression; the live hub and real Codex, OpenCode or Claude Code sessions (every sender is a fake spoke of a sealed scratch hub); E-417's and E-418's Inbox, thread, composer, Items, Artifacts and Accounts behaviour beyond the named regression files (their own stages judged them); Neovim; work landed on dev after the stage's items, beyond the regression files named here; running a full suite, T3 or a stage cover (E419S1-14 cites the Coordinator's); T4; duration budget lines (report-only); the epic's Definition of done and its demo, a separate run; the live project's tracker, hub, crew, `ui.json` and HOME. Stage QA carries no criterion marks.

Nothing else in scope needs an authorization this brief does not give: a check that cannot run for lack of one is BLOCKED, not out of scope.

## Grants

none. No computer use, no real browser, no sign-in, no real notification permission. The Headless Shell instances of the Web files and the probe open only their own sealed scratch edges, under the crew browser rule (rule 18). Every other check uses the rule 15 sealed environment with credentials filtered; nothing reads or writes the human's real `~/.cland`, `~/.claude`, `~/.codex` or `~/.local/state`.

## Verdict

Fix nothing. Clear only when every check E419S1-00 to E419S1-15 passes (docs contradictions in E419S1-04 beyond the items' own criterion lines, and the facts this brief marks **low**, are low findings and do not block clear). Otherwise not clear, naming the failing, blocked or inconclusive ids and findings. On the epic record one QA verdict with `--stage "bottom bar and inbox home"`, the full tested dev SHA, the unique run id and the case table. Stage QA carries no epic criterion marks. Report `qa clear E-419 stage bottom bar and inbox home` or `qa not clear E-419 stage bottom bar and inbox home` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
