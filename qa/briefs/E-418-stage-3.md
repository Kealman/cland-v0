# Stage QA brief: E-418 stage 3 — on E-417's thread, composer and notifications

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` or `$B:h` as a modifier). The run is local, on macOS (BSD tools; Chrome Headless Shell from the installed `playwright-core`).

## Stage

- Epic: E-418 (Sessions, artifacts and accounts in the web, under R-377).
- Exact stage name: on E-417's thread, composer and notifications.
- Items, in plan order: four one-item lanes, T-1141, T-1142, T-1143 and T-1160 (a qa-found docs fix from stage 2, added to this stage). The run reads the stage's members, counts and state from `task plan show E-418` (E418S3-00 and E418S3-14), never from a number written here. Findings fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- **The run starts only once T-1141 is on dev.** At writing T-1142, T-1143 and T-1160 had landed and T-1141 (the session's drawer) was ready at head `8c0c29c4` on `t/T-1141-the-session-s-drawer-its-recent-thread`, reviewed clear with C1–C5 verified; its expectations below were read from that head merged with dev `1f199894` in a scratch tree. E418S3-00 checks the landing through `task plan show E-418` and the first-parent log; a missing T-1141 landing is BLOCKED, reported to the requester, with nothing else run.
- Scope: the combined changed behaviour of the four items at the tested build. All four change only the web bundle, its tests and docs (`web/`, `docs/agents/tests.md`, `hub/README.md`, `hub/test/tiers.json`, the implement skill's guidance): no hub, shared wire or Neovim source changed. The drawer reuses E-417's thread, approval card and composer and answers through E-414's approval gate, which are exercised here, not judged anew.
  - T-1141, the session's drawer (§3.2, P23): selecting a session (`web/src/sessions/SessionDrawer.tsx`) opens the drawer with the session's recent thread, its pending approval and a composer. The thread is `web/src/SessionRecentThread.tsx` feeding E-417's shared `Thread` from `session.history`: 20 messages per page across every topic, sent by and delivered to that session, each naming its topic (`data-message-topic`), older pages by exclusive numeric `before` on scrolling to the top, live messages merged by identity, the log labelled `<session> recent thread`. The latest pending approval of that session is E-417's `ApprovalCard` (`1 · Approve once`, `2 · Always for this command`, `d · Deny` with an optional note), answered through `approval.answer`; the folded outcome stays after the session leaves Waiting; a TUI-only record shows **Answer in Neovim** and no buttons. The composer is E-417's with a fixed addressee (key context `session-composer`: no `@` chooser, `~` still attaches): `To <session> in <topic>`, the session's item topic when one exists, else General. Enter on a desktop row (key action `session-open`, help label `Open session thread, page or queue`) or **Open thread** in the unfolded row reveals the drawer and focuses its thread; `h`/Escape returns to the selected row (thread help label now `Return to list`); in a split, Open thread places the thread beside the list on the session's page. The Inbox approval drawer's existing `SessionRecentThread` now receives the shared thread controls (the reviewer's M1 at `2b406f07`, fixed at `8c0c29c4`: physical `j`/`k` reach its messages and Escape returns to the approval row). T-1141 also carries three Coordinator-authorized side fixes: **T-1157** (C-325; `Thread.tsx`'s automatic earlier-page loader had no error guard, so a scroll event about 9 ms after a rejected earlier page cleared the error before Retry showed; now automatic earlier loads stop while an error is set and explicit Retry keeps the boundary and anchor; the Topics Retry case was rewritten as a deterministic guard test), **T-1180** (C-326; `web/README.md` no longer says web-area-state covers "facts that do not yet have UI") and the Sessions test's exact `Attach` selector (`getByRole('button', { name: 'Attach', exact: true })`, no longer `/attach/i`).
  - T-1142, the notification switches beside the profile (§3.6): the Accounts **Profile** block (`web/src/accounts/Profile.tsx`) has a `Notifications` group with two `role="switch"` buttons **Needs you** and **Finished**, saved per browser and origin in `cland.ui.notifications.v1` through E-417's unchanged store `web/src/notification-state.ts`; permission is requested only from the first enabling gesture; the palette actions E-417 offered are gone from `Palette.tsx`, `Shell.tsx` and `keymap.ts`.
  - T-1143, notes rendered, This topic and `s` (§3.2): Enter on a note or prompt artifact opens it in the drawer rendered with E-417's `MarkdownBody` (headings, lists, code; HTML stays literal), with **Show source** / **Show rendered** toggling the raw text; the Artifacts tree gains **This topic** (`web/src/artifacts/TopicArtifacts.tsx`): the last topic thread opened in this browser, absent before one is opened; `s` (`artifact-compose`, `Attach to composer`) adds the selected artifact to that topic's composer draft, and refuses in place an archived artifact, one of another topic, or no writable topic; Coordinator decision 95aee0d4: in the web `s` always targets the topic composer and leaves an unfinished AskCard answer untouched.
  - T-1160, docs (qa-found in stage 2, E418S2-12): `web/README.md`'s "Area modules and live state" no longer says the Artifacts page or drawer shows `AreaObjects.tsx` stand-in details, and links each implemented area to its own section.
- Affected regression: the Web files of the shared thread, composer, Inbox, Sessions, area slots, key contexts, palette and help, accounts and shell (the stage changed `Thread.tsx`, `Composer.tsx`, `MessageBlock.tsx`, `InboxArea.tsx`, `AreaSlot.tsx`, `Shell.tsx`, `connection.ts`, `keyboard.ts`, `keymap.ts`, `topic-threads.ts`, `use-topic-read.ts`, `composer-drafts.ts`, `Palette.tsx` and the Sessions, Accounts and Artifacts modules); the T1 keymap file; the typecheck with colour, contrast, HTML and hooks guards; the tier classifications.

Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

Criteria map (the stage verdict carries no item or epic marks; this tells the run which check proves what):

| criterion | proven by |
| --- | --- |
| T-1141 C1 (a fake Codex session waiting for approval: its command in the drawer's card; Approve once folds with its outcome and the session leaves Waiting) | E418S3-06, E418S3-12 (`approve`) |
| T-1141 C2 (recent messages in both directions across topics, paging back without a gap) | E418S3-06, E418S3-12 (`thread`) |
| T-1141 C3 (the drawer's composer reaches the fake session in its item's topic, or in General without one, as the fake receives it; the line "To <session> in <topic>") | E418S3-06, E418S3-12 (`composer`), E418S3-02 (the `session-composer` context) |
| T-1141 C4 (Enter on a desktop row and Open thread move focus to the drawer's thread) | E418S3-06, E418S3-07 (the Inbox approval drawer's shared thread keys, the M1 fix), E418S3-12 (`focus`), E418S3-02 (the binding and help label) |
| T-1141 C5 (`web/README.md` describes the session's drawer) | E418S3-04 |
| T-1142 C1 ("finished" off in the profile block stays off after a reload) | E418S3-08, E418S3-12 (`switches`) |
| T-1142 C2 (both switches in the profile block, none in the palette, the first switch turned on asks for permission) | E418S3-08, E418S3-12 (`switches`, `otherBrowser`), E418S3-02 (no palette action in the sources) |
| T-1142 C3 (`web/README.md` describes the switches beside the profile) | E418S3-04 |
| T-1143 C1 (Enter on a note opens it rendered as Markdown; the toggle shows its raw source) | E418S3-09, E418S3-12 (`note`) |
| T-1143 C2 (after a topic's thread is opened, This topic lists that topic's artifacts) | E418S3-09, E418S3-12 (`note`, `attach`) |
| T-1143 C3 (`s` adds the artifact to that topic's composer draft; the sent message carries it as `topic.history` reads) | E418S3-09, E418S3-12 (`attach`), E418S3-02 (the binding) |
| T-1143 C4 (`s` on an archived or another topic's artifact says why and attaches nothing) | E418S3-09, E418S3-12 (`attach`, the other-topic refusal) |
| T-1143 C5 (`web/README.md` describes notes, This topic and `s`) | E418S3-04 |
| T-1160 C1 (no AreaObjects stand-in sentence for Artifacts; each implemented area refers to its own section) | E418S3-04 |
| T-1157 regression (carried by T-1141: a rejected earlier page keeps its Retry through further scroll events; the Retry case is deterministic) | E418S3-10, E418S3-04 (the README and tests.md sentences) |
| T-1180 regression (carried by T-1141: no "facts that do not yet have UI" for web-area-state) | E418S3-04 |

T-1157 and T-1180 are not stage members; they are open follow-ups the Coordinator closes against T-1141's landing. This run records their rows as regression evidence and carries no marks for them.

Definition-of-done pointer (no marks): E-418's drawer sentence (§3.2: the selected session's recent thread, pending approval and composer) is exercised by E418S3-06 and E418S3-12; the switches beside the profile by E418S3-08 and E418S3-12; notes, This topic and `s` by E418S3-09 and E418S3-12. The epic's Definition of done and its demo are a separate run.

## Build

Use a clean detached worktree at dev at the SHA in the request (the full 40-hex SHA), created below. HEAD must equal that SHA and refs/heads/dev before and after running. All listed items must have merged onto dev: for every member that `task plan show E-418` lists in stage `on E-417's thread, composer and notifications`, `git log --first-parent --oneline --grep "Item: <id>" dev` prints exactly one commit. At writing T-1160 had landed as `652470cb`, T-1143 as `f47545a2` and T-1142 as `4624720e`; T-1141 had not landed (see "Stage"). **Every expectation below was read at dev `1f199894` plus T-1141's head `8c0c29c4`** (merged without a commit in a scratch tree); T-1141's squash on dev may differ only by its merge with later dev, so re-check every test name, count, label and docs string with grep at the tested build (the rows say how a changed count is judged). Dev also carries work landed after or between these items that is outside this stage (E-417 stage 4's T-1127, T-1128, T-1129 and T-1164; T-1178; T-1179); it is not judged here beyond the regression files named. A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no commit or run id of its own on purpose: committing a brief changes the tested tree.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step (the setup below does; the clean-tree checks ignore that one entry). Run E418S3-01's build before any Web file or the probe, or the shell never renders. The browser is the suite's Chrome Headless Shell under `node_modules/playwright-core/.local-browsers`: each named Web test file and the QA probe start and close their own through the Web harness (`web/test/harness.ts`, `webFixture`). No real browser and no other GUI process starts. The live hub is touched only by `quiet`, the Web harness's own read-only admission check and the plan reads of E418S3-00 and E418S3-14. Every session, approval, message, artifact and notification switch comes from sealed scratch hubs started from `$W`'s own source with in-process fake adapters (fake Codex harnesses raising approvals and receiving injections, fake spokes as senders, a stubbed `Notification`), never a real session, account or provider binary (see "Out of scope").

**The local test slot (cover-quiet).** No test may run while another session holds the live hub's local verify slot. The Coordinator's macOS stage cover for this stage (`verify all --occasion stage`, local) holds that slot for about 20 minutes, and it may still be running when this run starts. A wait for it is not BLOCKED: run the checks that need no slot first (E418S3-00 to E418S3-05: reads, greps, docs, the brief lint and the bundle build), then wait for the slot with `quiet` (it waits up to 45 minutes and prints the holder every 5 minutes) before E418S3-06. Only a slot still held after those 45 minutes with no change of holder is BLOCKED, reported to the requester with the holder line.

## Setup (once, before E418S3-00)

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree, runs `quiet`, the plan reads, reads the captures and records every check with `qa-record.sh`. **Every other command runs sealed** (rule 15) inside a subshell that sources `$Q/env.sh`: the full `fixtureEnvironment` result (`test-support/fixture-environment.ts`) after the scratch overlays (its synthesized HOME, XDG, Git, account and fake-harness paths included), which drops every `CLAND_*`, `GIT_*`, `XDG_*`, `CLAUDE_*`, `CODEX_*`, `FAKE_*`, provider and account variable while keeping `PATH`, `SHELL`, `TERM` and `TMPDIR`. Leave `TMPDIR` at the system default (on macOS `/var/folders/...`; never `/tmp`, T-1030). Never use `env -i`. The scratch root lives under `/private/tmp/qa-e418s3-` (its realpath). Never the live project's hub for anything but the reads named above and `quiet`; never the human's HOME, `~/.cland`, `~/.claude`, `~/.codex` or `~/.local/state`. Fixtures are fake only: the Web harness's sealed scratch projects and hubs with in-process fake adapters, the fake Codex harness (`waitingForApproval`, `raiseApproval`, `busy`, `idle`, `approvalAnswers`, `injections`), fake spokes as senders and a stubbed `Notification`; no real session, account or provider binary.

In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<the full dev SHA from the request>
STAGE="on E-417's thread, composer and notifications"
RUN=qa-s3-$(date +%F)-1                        # unique run id for E-418; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e418s3-$RUN           # the clean detached build
EV=$R/.cland/qa/E-418/$RUN                     # captures (qa-record.sh keeps its evidence here too)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
Q=$(cd "$(mktemp -d /tmp/qa-e418s3-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/qa-e418s3-…
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

The QA probe. `$Q/probe.test.mjs` is a one-test `node --test` file, independent of the items' own tests: one sealed scratch project and hub through the Web harness (`webFixture`: `tempProject` under the system `TMPDIR`, `projectHub` with in-process fake adapters, the production socket and web edge serving `$W/web/dist`), seeded through public frames with a task `QA drawer item` assigned to `qa-item` and its topic `QA item topic`; three fake Codex sessions launched through `session.launch`: `qa-item` (implementer, claims the item, so its composer goes to the item's topic) and `qa-free` (implementer, no item: General), each with an in-process spoke and set idle, and `qa-wait` (no spoke); a fake peer spoke `qa-peer`; and 30 messages, alternately the human to `qa-item` in General (`topic.send`) and `qa-item` to `qa-peer` in the item's topic (the spoke's `send`), named `QA traffic 00` to `QA traffic 29`. Three Headless Shell contexts at 1440×900, each signed in through a minted link:
- **Context 1** (the session's drawer): `approve` sets `qa-wait` waiting for approval, raises `qa-once` (`printf "QA stage 3 drawer approval"`, cwd and reason) through the fake Codex, selects `qa-wait` in the Waiting group, reads the drawer's card, clicks **1 · Approve once**, reads the fold and the fake's answers, then drives the fake's post-answer state to busy and reads whether the row left Waiting, which group holds it, whether it is still selected, whether the fold remains and the hub's archive outcome; `thread` selects `qa-item`, compares the drawer log's message ids with the hub's `session.history` (20, then all 30 after one scroll to the top), the topic names on the messages, the order of `data-message-seq` and the directions in the hub's read; `composer` selects `qa-item` then `qa-free`, reads the composer's address line and the absence of the `@` chooser, sends a line by Enter and reads the fake's injection and the destination topic's `topic.history`; `focus` dispatches a physical Enter (key value `я`) on the `qa-item` row and reads whether its recent-thread log has focus, presses Escape and reads the focused row, closes the drawer and clicks **Open thread** in the unfolded row and reads the focus again.
- **Context 2** (browser A; `Notification` stubbed by an init script: permission `default` until granted, every `requestPermission` counted in session storage): `switches` opens Accounts, reads the Profile block's switches, turns **Finished** on first (the first enabling), then **Needs you** by focus and Enter, then Finished off, reloads, reads the switches, the request count and `cland.ui.notifications.v1`, and searches the palette for `>Notifications`.
- **Context 3** (browser B, a fresh context; two notes created through `artifact.create`: `QA rendered note` in General with a heading, a two-item list and a fenced code block, and `QA other topic note` in the item's topic): `otherBrowser` reads the Profile switches and the stored value in this second browser; `note` opens the General note with Enter, reads the rendered list and code, toggles **Show source** and **Show rendered**, and reads whether This topic is present yet; `attach` opens General's thread, types a draft, reads This topic, presses physical `s` on the other topic's note (the refusal), then on the General note in This topic, reads the draft and the chip, sends, and reads the message's artifacts in `topic.history`.

It asserts nothing about the product: every fact goes to `$QA_OUT` as one JSON line; a step that throws writes `{"step":{name,error}}` and the probe goes on. The Web fixture's own cleanup writes the census line.

```sh
cat > "$Q/probe.test.mjs" <<'JS'
// QA probe for E-418 stage 3 (node --test, sealed, cwd $QA_W): one sealed scratch hub through the Web harness, three
// Headless Shell contexts signed in by minted links, fake Codex sessions and fake spokes. It asserts nothing about the
// product: every fact goes to $QA_OUT as one JSON line {"fact": value}; a step that throws writes
// {"step": {name, error}} and the probe goes on.
import test from 'node:test';
import { appendFileSync } from 'node:fs';
const W = process.env.QA_W, OUT = process.env.QA_OUT;
const { webFixture } = await import(`${W}/web/test/harness.ts`);
const { connectUi, inProcessSpoke } = await import(`${W}/hub/test/harness.ts`);
const out = (key, value) => appendFileSync(OUT, `${JSON.stringify({ [key]: value })}\n`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function step(name, body) { try { await body(); } catch (error) { out('step', { name, error: String(error?.message ?? error).slice(0, 400) }); } }
async function poll(read, done, ms = 3000) { let value = await read(); for (let i = 0; i < ms / 100 && !done(value); i++) { await sleep(100); value = await read(); } return value; }
const physical = (locator, code) => locator.evaluate((node, code) => node.dispatchEvent(new KeyboardEvent('keydown', { code, key: 'я', bubbles: true, cancelable: true })), code);
test('E-418 stage 3 QA probe', { timeout: 300000 }, async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const codex = fixture.fakes.codex;
  // Seeds: an item with its topic, three fake Codex sessions (qa-item claims the item, qa-free has none, qa-wait waits
  // for approval), a fake peer spoke, and 30 messages: 15 human messages to qa-item in General, 15 from qa-item to the
  // peer in the item's topic.
  const made = await ui.request({ type: 'task.create', title: 'QA drawer item', size: 'S', assignee: 'qa-item' });
  const item = made.value?.item?.id;
  const created = await ui.request({ type: 'topic.create', title: 'QA item topic', item });
  const topic = created.value?.topic?.id;
  const spokes = {};
  for (const name of ['qa-item', 'qa-free']) {
    const launch = await ui.request({ type: 'session.launch', name, harness: 'codex', role: 'implementer' });
    spokes[name] = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name, sessionId: launch.value.process.sessionId, role: 'implementer' });
    await spokes[name].waitForPresence([name]);
    codex.idle(name);
  }
  const peer = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'qa-peer', sessionId: 'qa-e418s3-peer' });
  await peer.waitForPresence(['qa-item', 'qa-peer']);
  const claimed = await ui.request({ type: 'task.claim', item, as: { name: 'qa-item' } });
  const sends = [];
  for (let n = 0; n < 30; n++) {
    const text = `QA traffic ${String(n).padStart(2, '0')}`;
    const r = n % 2 ? await spokes['qa-item'].call('send', { to: 'qa-peer', topic, text }) : await ui.request({ type: 'topic.send', topic: 'general', to: ['qa-item'], text });
    sends.push(r.ok);
  }
  const waitLaunch = await ui.request({ type: 'session.launch', name: 'qa-wait', harness: 'codex' });
  out('seeded', { item: !!item, topic: !!topic, claimed: claimed.ok, sends: sends.filter(Boolean).length, waitLaunch: waitLaunch.ok });
  const history = async (session, limit = 100) => (await ui.request({ type: 'session.history', session, limit })).value;
  // Context 1: the session's drawer.
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const drawer = page.getByRole('complementary', { name: 'Drawer', exact: true });
    await step('approve', async () => {
      codex.waitingForApproval('qa-wait');
      codex.raiseApproval('qa-wait', { id: 'qa-once', kind: 'command', subject: { command: 'printf "QA stage 3 drawer approval"', cwd: '/scratch/qa', reason: 'QA check' }, choices: ['once', 'always', 'deny'], answerIn: 'hub' });
      const waiting = page.getByRole('region', { name: 'Waiting', exact: true });
      const row = waiting.locator('[data-object-id="qa-wait"]');
      await row.click();
      const card = drawer.getByRole('region', { name: 'Command approval', exact: true });
      await card.waitFor();
      const command = await card.locator('pre').textContent();
      const buttons = await card.getByRole('button').allInnerTexts();
      await card.getByRole('button', { name: '1 · Approve once', exact: true }).click();
      const outcome = drawer.locator('[data-approval-outcome]');
      await outcome.waitFor();
      const answered = await poll(() => codex.approvalAnswers.filter(a => a.requestId === 'qa-once'), v => v.length > 0);
      const waitingBefore = await row.count();
      codex.busy('qa-wait');
      const waitingAfter = await poll(() => row.count(), v => v === 0);
      const id = (await ui.request({ type: 'inbox.list', archive: true })).value.archive?.find(r => r.id.endsWith(':qa-once'));
      out('approve', { command, buttons, outcome: (await outcome.innerText()).replace(/\s+/g, ' '), answers: answered, waitingBefore, waitingAfter,
        outcomeAfterLeaving: (await drawer.locator('[data-approval-outcome]').count()), selected: await page.locator('[data-object-id="qa-wait"]').first().getAttribute('aria-pressed'),
        group: await page.locator('[data-session-slot="groups"] [data-object-id="qa-wait"]').evaluate(n => n.closest('section[aria-label]')?.getAttribute('aria-label') ?? null), archive: id?.outcome ?? null });
    });
    await step('thread', async () => {
      await page.locator('[data-object-id="qa-item"]').first().click();
      const log = page.getByRole('log', { name: 'qa-item recent thread', exact: true });
      const recent = await history('qa-item', 20);
      await log.locator(`[data-message-id="${recent.messages.at(-1).id}"]`).waitFor();
      const shown = () => log.locator('[data-message-id]').evaluateAll(ns => ns.map(n => n.getAttribute('data-message-id')));
      const first = await shown();
      const topics = await log.locator('[data-message-topic]').evaluateAll(ns => [...new Set(ns.map(n => n.textContent))].sort());
      await log.evaluate(node => { node.scrollTop = 0; node.dispatchEvent(new Event('scroll', { bubbles: true })); });
      await log.getByText('QA traffic 00', { exact: true }).waitFor();
      const all = await history('qa-item');
      const after = await shown();
      const seqs = await log.locator('[data-message-seq]').evaluateAll(ns => ns.map(n => Number(n.getAttribute('data-message-seq'))));
      out('thread', { recentCount: recent.messages.length, recentMore: recent.more, firstEqual: JSON.stringify(first) === JSON.stringify(recent.messages.map(m => m.id)), topics,
        allCount: all.messages.length, afterCount: after.length, afterEqual: JSON.stringify(after) === JSON.stringify(all.messages.map(m => m.id)), seqsAscendingUnique: seqs.every((v, i) => i === 0 || v > seqs[i - 1]),
        directions: [...new Set(all.messages.map(m => m.from === 'qa-item' ? 'sent' : (m.to ?? []).includes('qa-item') ? 'received' : 'other'))].sort() });
    });
    await step('composer', async () => {
      const result = {};
      for (const [name, destination] of [['qa-item', topic], ['qa-free', 'general']]) {
        await page.locator(`[data-object-id="${name}"]`).first().click();
        const form = drawer.getByRole('form', { name: 'Composer', exact: true });
        await form.locator('[data-composer-address]').waitFor();
        await poll(() => form.locator('[data-composer-address]').textContent(), v => v.includes(name));
        const address = await form.locator('[data-composer-address]').textContent();
        const text = `QA drawer message to ${name}`;
        await form.getByRole('textbox', { name: 'Message text' }).fill(text);
        await form.getByRole('textbox', { name: 'Message text' }).press('Enter');
        const injected = await poll(() => codex.injections.find(r => r.process.name === name && r.message.text === text), v => !!v);
        const stored = (await ui.request({ type: 'topic.history', topic: destination, limit: 50 })).value.messages.find(m => m.text === text);
        result[name] = { address, chooser: await form.getByRole('button', { name: 'Choose a session (@)', exact: true }).count(), injectedTo: injected?.message.to ?? null,
          injectedTopicIsDestination: injected?.message.topic === destination, outcome: injected?.outcome ?? null, storedStage: stored?.stage ?? null, sameId: !!stored && stored.id === injected?.message.id };
      }
      out('composer', result);
    });
    await step('focus', async () => {
      const row = page.locator('[data-session-slot="groups"] [data-object-id="qa-item"]');
      await row.click();
      const log = page.getByRole('log', { name: 'qa-item recent thread', exact: true });
      await log.locator('[data-message-id]').first().waitFor();
      const isLog = () => page.evaluate(() => document.activeElement?.getAttribute('role') === 'log' && document.activeElement.getAttribute('aria-label') === 'qa-item recent thread');
      await physical(row, 'Enter');
      const enter = await poll(isLog, v => v === true);
      await page.keyboard.press('Escape');
      const back = await poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-object-id')), v => v === 'qa-item');
      await drawer.getByRole('button', { name: 'Close', exact: true }).click();
      await page.locator('[data-session-detail="qa-item"]').getByRole('button', { name: 'Open thread', exact: true }).click();
      const openThread = await poll(isLog, v => v === true);
      out('focus', { enter, back, openThread });
    });
  });
  // Context 2: the notification switches in the Profile block (browser A), with Notification stubbed.
  await fixture.pageCase(t, async page => {
    await step('switches', async () => {
      await page.getByRole('button', { name: 'Accounts', exact: true }).click();
      const profile = page.getByRole('region', { name: 'Profile', exact: true });
      const sw = name => profile.getByRole('switch', { name, exact: true });
      await sw('Finished').waitFor();
      const state = async () => [await sw('Needs you').getAttribute('aria-checked'), await sw('Finished').getAttribute('aria-checked')];
      const requests = () => page.evaluate(() => Number(sessionStorage.getItem('qaRequests') ?? 0));
      const result = { count: await profile.getByRole('switch').count(), initial: await state(), requestsInitial: await requests() };
      await sw('Finished').click();
      await profile.getByRole('switch', { name: 'Finished', checked: true }).waitFor();
      result.afterFinishedOn = { state: await state(), requests: await requests() };
      await sw('Needs you').focus(); await page.keyboard.press('Enter');
      await profile.getByRole('switch', { name: 'Needs you', checked: true }).waitFor();
      result.afterNeedsOn = { state: await state(), requests: await requests() };
      await sw('Finished').click();
      await profile.getByRole('switch', { name: 'Finished', checked: false }).waitFor();
      await page.reload();
      await profile.getByRole('switch', { name: 'Needs you', checked: true }).waitFor();
      result.afterReload = { state: await state(), requests: await requests(), stored: await page.evaluate(() => localStorage.getItem('cland.ui.notifications.v1')) };
      await page.getByRole('button', { name: 'Palette', exact: true }).click();
      await page.getByRole('combobox', { name: 'Search palette', exact: true }).fill('>Notifications');
      await sleep(300);
      result.paletteOptions = await page.getByRole('option').filter({ hasText: /Needs you|Finished/ }).count();
      await page.keyboard.press('Escape');
      out('switches', result);
    });
  }, async page => {
    await page.addInitScript(() => {
      class QaNotification {
        static permission = sessionStorage.getItem('qaPermission') ?? 'default';
        static async requestPermission() { sessionStorage.setItem('qaRequests', String(Number(sessionStorage.getItem('qaRequests') ?? 0) + 1)); sessionStorage.setItem('qaPermission', 'granted'); this.permission = 'granted'; return 'granted'; }
        constructor() {}
        close() {}
      }
      Object.defineProperty(globalThis, 'Notification', { configurable: true, value: QaNotification });
    });
  });
  // Context 3 (browser B): the switches are this browser's own; then notes, This topic and s.
  const note = (await ui.request({ type: 'artifact.create', kind: 'note', title: 'QA rendered note', topic: 'general', content: '# QA heading\n\n- QA one\n- QA two\n\n```sh\necho QA\n```\n' })).value?.artifact?.id;
  const otherNote = (await ui.request({ type: 'artifact.create', kind: 'note', title: 'QA other topic note', topic, content: 'Other' })).value?.artifact?.id;
  out('seededArtifacts', { note: !!note, otherNote: !!otherNote });
  await fixture.pageCase(t, async page => {
    await step('otherBrowser', async () => {
      await page.getByRole('button', { name: 'Accounts', exact: true }).click();
      const profile = page.getByRole('region', { name: 'Profile', exact: true });
      await profile.getByRole('switch', { name: 'Finished', exact: true }).waitFor();
      out('otherBrowser', { state: [await profile.getByRole('switch', { name: 'Needs you', exact: true }).getAttribute('aria-checked'), await profile.getByRole('switch', { name: 'Finished', exact: true }).getAttribute('aria-checked')],
        stored: await page.evaluate(() => localStorage.getItem('cland.ui.notifications.v1')) });
    });
    await step('note', async () => {
      await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
      const drawer = page.getByRole('complementary', { name: 'Drawer', exact: true });
      const row = page.locator(`[data-artifact-section="mine"] [data-object-id="${note}"]`);
      await row.click();
      await row.press('Enter');
      await drawer.getByRole('heading', { name: 'QA heading', exact: true }).waitFor();
      const rendered = { items: await drawer.locator('li').allTextContents(), code: await drawer.locator('pre code').textContent() };
      await drawer.getByRole('button', { name: 'Show source', exact: true }).click();
      const source = await drawer.getByRole('region', { name: 'File text', exact: true }).textContent();
      const headingsInSource = await drawer.getByRole('heading', { name: 'QA heading', exact: true }).count();
      await drawer.getByRole('button', { name: 'Show rendered', exact: true }).click();
      await drawer.getByRole('heading', { name: 'QA heading', exact: true }).waitFor();
      out('note', { rendered, sourceStartsWithHash: source?.startsWith('# QA heading') ?? false, headingsInSource, thisTopicBefore: await page.locator('[data-artifact-section="topic"]').count() });
    });
    await step('attach', async () => {
      await page.getByRole('button', { name: 'Topics', exact: true }).click();
      await page.locator('[data-object-id="general"]').click();
      const form = page.getByRole('form', { name: 'Composer', exact: true });
      await form.getByRole('textbox', { name: 'Message text' }).fill('QA attach receipt');
      await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
      const section = page.locator('[data-artifact-section="topic"]');
      await section.locator(`[data-object-id="${note}"]`).waitFor();
      const listed = await section.locator('[data-object-id]').evaluateAll(ns => ns.map(n => n.getAttribute('data-object-id')));
      const other = page.locator(`[data-artifact-section="mine"] [data-object-id="${otherNote}"]`);
      await other.click();
      await physical(other, 'KeyS');
      const refusal = await poll(() => page.getByRole('alert').allInnerTexts(), v => v.length > 0);
      const row = section.locator(`[data-object-id="${note}"]`);
      await row.click();
      await physical(row, 'KeyS');
      await form.locator('[data-composer-artifact]').waitFor();
      const draft = await form.getByRole('textbox', { name: 'Message text' }).inputValue();
      const chips = await form.locator('[data-composer-artifact]').count();
      await form.getByRole('button', { name: 'Send', exact: true }).click();
      await form.locator('[data-pending-message]').waitFor({ state: 'detached' });
      const sent = (await ui.request({ type: 'topic.history', topic: 'general', limit: 100 })).value.messages.find(m => m.text === 'QA attach receipt');
      out('attach', { listed: JSON.stringify(listed) === JSON.stringify([note]), refusal, draft, chips, sentArtifacts: sent?.artifacts?.map(a => a.id === note ? 'note' : a.id) ?? null });
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
  (cd "$W" && node hub/bin/cland.ts task plan show E-418 --json) > "$EV/E418S3-00-plan.json"
  node -e 'const [f,n]=process.argv.slice(1);const v=JSON.parse(require("fs").readFileSync(f,"utf8"));const s=v.stages.find(x=>x.name===n);console.log(JSON.stringify({stages: v.stages.map(x=>x.name), state: s.state, qa: s.qa, merged: s.merged, total: s.total, items: s.items}))' "$EV/E418S3-00-plan.json" "$STAGE" | tee "$EV/E418S3-00-stage.txt"
  for i in $(node -e 'const [f,n]=process.argv.slice(1);console.log(JSON.parse(require("fs").readFileSync(f,"utf8")).stages.find(x=>x.name===n).items.join(" "))' "$EV/E418S3-00-plan.json" "$STAGE"); do echo "== $i"; git -C "$W" log --first-parent --oneline --grep "Item: $i" dev; done
  ls "$W/web/src/sessions/SessionDrawer.tsx" "$W/web/src/SessionRecentThread.tsx" "$W/web/src/accounts/Profile.tsx" "$W/web/src/artifacts/TopicArtifacts.tsx" "$W/web/test/session-drawer.test.ts" "$W/web/test/notifications.test.ts" "$W/web/test/artifacts.test.ts" "$W/web/test/topics.test.ts"
  for i in T-1141 T-1142 T-1143 T-1160; do c=$(git -C "$W" log --first-parent --format=%H --grep "Item: $i" dev); echo "== $i paths outside web/ and docs/"; [ -n "$c" ] && git -C "$W" show --format= --name-only "$c" | grep -v -E '^(web/|docs/)'; done
  echo "TMPDIR=$TMPDIR Q=$Q"
}
k02() {   # QA shell: the key map and sources of the drawer, the switches and s
  grep -n -F "  'session-composer': { ...composerKeys, 'Shift+Backquote': 'composer-artifact' }," "$W/web/src/keymap.ts"
  for l in "Enter: 'session-open'," "{ action: 'session-open', label: 'Open session thread, page or queue' }" "{ action: 'thread-back', label: 'Return to list' }" "KeyS: 'artifact-compose'," "{ action: 'artifact-compose', label: 'Attach to composer' }"; do printf '%s ' "$(grep -c -F -- "$l" "$W/web/src/keymap.ts")"; echo "$l"; done
  echo "-- drawer"; grep -c -F 'data-composer-address>To {session} in ' "$W/web/src/Composer.tsx"; grep -c -F '<SessionRecentThread key={selected} session={selected}' "$W/web/src/sessions/SessionDrawer.tsx"; grep -c -F '<ApprovalCard key={approval.id} record={approval}' "$W/web/src/sessions/SessionDrawer.tsx"
  echo "-- notification switches (Profile, not the palette)"; grep -n -o -F -e "['needsYou', 'Needs you'," -e "['finished', 'Finished'," -e 'role="switch"' -e 'aria-label="Notifications"' "$W/web/src/accounts/Profile.tsx"
  grep -c -E "notifications-(needs-you|finished)|Notifications · " "$W/web/src/Palette.tsx" "$W/web/src/Shell.tsx" "$W/web/src/keymap.ts"
  echo "-- T-1157 guard"; grep -c -F "state.error && !retry) return;" "$W/web/src/Thread.tsx"
}
k03() {   # QA shell: AGENTS.md web/ rules at the build
  git -C "$W" grep -n -E "keydown|keyup|keypress|onKey(Down|Up|Press)" -- web/src
  git -C "$W" grep -n -E "localStorage|sessionStorage" -- web/src
  git -C "$W" grep -n -E "dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML" -- web/src
  for i in T-1141 T-1142 T-1143 T-1160; do c=$(git -C "$W" log --first-parent --format=%H --grep "Item: $i" dev); echo "== $i"; [ -n "$c" ] && git -C "$W" show --format= "$c" -- package.json package-lock.json web/package.json hub/package.json nvim/package.json | grep -E '^[+-] '; done
}
k04() {   # docs, in QA's own shell
  ( cd "$W" || exit 1
    chk() { printf '%s present %s: %s\n' "$(grep -c -F -- "$2" "$1")" "$1" "$2"; }
    echo "-- T-1141 C5"
    chk web/README.md 'Selecting a session opens its drawer with the shared recent thread, approval card'
    chk web/README.md 'and composer. The thread reads `session.history` in pages of 20 across all topics,'
    chk web/README.md 'The latest pending approval uses `ApprovalCard`: Approve once and Always for this'
    chk web/README.md 'TUI-only approvals say **Answer in Neovim** and have no answer buttons.'
    chk web/README.md 'The shared composer says **To &lt;session&gt; in &lt;topic&gt;** and addresses that'
    chk web/README.md 'shared composer. Enter on a desktop row or Open thread in its unfolded detail'
    chk web/README.md '| `Enter` | Confirm the pending action, toggle the focused verification queue, focus the desktop session thread, or open the session page below 640 px |'
    chk web/README.md 'node --test web/test/session-drawer.test.ts # approval outcomes, cross-topic numeric pages/live races, composer routing and thread focus'
    chk docs/agents/tests.md '`web/test/session-drawer.test.ts` owns the selected session → thread/card/composer'
    echo "-- T-1142 C3"
    chk web/README.md 'The **Profile** block in **Accounts** offers **Needs you** and **Finished**,'
    chk web/README.md 'independent on/off switches saved per browser and origin. They are absent from'
    chk web/README.md 'the palette. Turning the first switch on requests browser permission directly from'
    chk web/README.md 'this sign-in has the **Needs you** and **Finished** switches. Turning either'
    chk web/README.md 'off stops that kind in this browser only; the choice survives a reload.'
    chk hub/README.md 'The Profile block in Accounts offers'
    chk hub/README.md 'has no notification actions. Only Now work'
    chk docs/agents/tests.md 'shared per-browser Profile switches in'
    echo "-- T-1143 C5"
    chk web/README.md 'The Artifacts tree has **Mine** (the human’s and Aides’ artifacts), **This topic**, **Kept**,'
    chk web/README.md 'This topic lists available artifacts from the last topic thread opened in this'
    chk web/README.md '`s` attaches the selected artifact'
    chk web/README.md 'artifact or an artifact belonging to another topic, the reason appears in place'
    chk web/README.md 'Notes and prompts with a Markdown file open rendered with the same `MarkdownBody`'
    chk web/README.md 'rendered** switches back; both controls support Enter.'
    echo "-- T-1160 C1"
    chk web/README.md '[Sessions](#sessions) owns its counts, grouped rows and unfolded'
    chk web/README.md '[Accounts](#accounts-strip-and-accounts-area) owns the registry,'
    chk web/README.md '`VerifyLine` owns the [verification summary and queue view](#verification-in-sessions).'
    chk web/README.md '[Artifacts](#artifacts) owns its grouped tree and sandboxed page/drawer viewer.'
    for h in '## Sessions' '### Accounts strip and Accounts area' '## Verification in Sessions' '## Artifacts' '## Topics and threads' '## Inbox' '## Events' '## Items tree' '## Items views'; do printf '%s heading %s\n' "$(grep -c -x -F -- "$h" web/README.md)" "$h"; done
    echo "-- T-1157 and T-1180 regression"
    chk web/README.md 'fetch or an earlier-page error is retried. An earlier-page error stays visible'
    chk web/README.md 'through further scroll events until explicit Retry; retrying preserves the'
    chk docs/agents/tests.md 'A rejected earlier page stays failed after another scroll event; a later live'
    chk web/README.md 'session rows and launch defaults, ordered account views, verification queue'
    echo "-- stale statements (each must print 0)"
    chk web/README.md "The Sessions drawer shows the selected session's identity"
    chk web/README.md 'Its drawer and Artifacts page/drawer retain the ID/title details'
    chk web/README.md 'AreaObjects'
    chk web/README.md 'facts that do not yet have UI'
    chk web/README.md 'the palette offers **Notifications'
    chk hub/README.md "The browser's palette offers"
    echo "-- statements to read against the implementation (candidates for low findings)"
    grep -n -F -e '| `h`, `Esc` | Thread | Return to the source list (Topics or Inbox) |' -e 'Notifications ·' web/README.md hub/README.md docs/agents/tests.md
    grep -n -i -E 'stand-in|not yet|until (E-41[0-9]|T-11[0-9][0-9]) lands' web/README.md )
}
k12() {   # sealed, in $W: the QA probe (one Headless Shell scratch hub; facts to $EV/E418S3-12.jsonl)
  : > "$EV/E418S3-12.jsonl"                    # start the fact file empty
  ( cd "$QA_W" && QA_OUT="$EV/E418S3-12.jsonl" node --test --test-reporter=tap "$QA_Q/probe.test.mjs" > "$EV/E418S3-12.log" 2>&1; echo "exit $?" >> "$EV/E418S3-12.log" )
  tail -n 1 "$EV/E418S3-12.log"; grep -E '^# (tests|pass|fail) |Web fixture census' "$EV/E418S3-12.log"
  cat "$EV/E418S3-12.jsonl"
}
k13() {   # sealed, in $W: the full typecheck with the web guards, the tier lint and the stage's classifications
  ( cd "$QA_W" && npm run typecheck > "$EV/E418S3-13.log" 2>&1; echo "typecheck exit $?"; node hub/test/lint-tiers.ts > "$EV/E418S3-13-tiers.log" 2>&1; echo "tiers exit $?" )
  grep -F -e 'web HTML: raw-HTML sinks refused; seeded fixtures passed' -e 'web colours: token-only sources; colour fixtures passed' -e 'web tokens:' -e 'web hooks: conditional-hook fixture rejected by configured oxlint' "$EV/E418S3-13.log"
  grep -F -e '"web/test/session-drawer.test.ts": "Web"' -e '"web/test/notifications.test.ts": "Web"' -e '"web/test/artifacts.test.ts": "Web"' -e '"web/test/topics.test.ts": "Web"' "$QA_W/hub/test/tiers.json"
}
k15() {   # QA shell: cleanup of the fixture-owned processes and the scratch root
  for f in "$EV"/E418S3-0[6-9]*.log "$EV"/E418S3-1[0-2]*.log; do [ -e "$f" ] || continue; printf '%s ' "$(basename "$f")"; census "$(basename "$f" .log)" | tr '\n' ' '; echo; done
  git -C "$W" status --porcelain | grep -v -x -F '?? node_modules' | wc -l
  echo "$Q"
}
```

Cleanup after the evidence is recorded: print `$Q`, check it begins with `/private/tmp/qa-e418s3-`, and remove it by that literal path with a non-force `rm -r`. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). A failed Web case writes a Playwright trace under `$W/web/test-results/`; name it as evidence before removing the worktree. Sign-in links and cookies are never printed or posted.

## Cases

none. No headless-grid case covers the web Sessions drawer, the Profile switches or the Artifacts notes; every check below is a manual check through named test files, the QA probe's Headless Shell pages, git greps, the CLI or the docs, recorded with `qa-record.sh note`.

### Web cases (when in scope)

none: no `real-browser` case in this run (see "Out of scope"). Every stage criterion is proven in Chrome Headless Shell against signed-in sealed scratch hubs with fake harnesses and a stubbed `Notification` (E418S3-06 to E418S3-12).

## Manual checks

Record each with `sh .agents/skills/qa/qa-record.sh note E-418 "$RUN" <id> hub-api "<command>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence-file…>` from `$W` in QA's own shell, naming where it ran at the start of the command text (`[QA shell]`, `[test $W]`, `[sealed $W]`, `[docs]`). The recorder takes `hub-api` for every check here; the probe's page steps are Headless Shell observations recorded the same way. Save each check's printed output as `$EV/<id>.txt` (pipe the row's command through `tee`) and name it, with the captures the row wrote, as evidence.

How to run a row, by its `where`:
- **sealed $W**: `( . "$Q/env.sh"; cd "$W" && <command> )`, after `quiet` when the row runs a test, the probe or the typecheck (E418S3-12, E418S3-13).
- **test $W**: in QA's own shell; `nt` runs `quiet` first and seals the test run itself. Judge each by its `exit` line, the TAP summary counts and the named tests on `ok` lines (`oks` lists them; a name that appears on no `ok` line proves nothing).
- **docs** and **QA shell**: in QA's own shell, as QA; the plan reads of E418S3-00 and E418S3-14 are the only checks that touch the live hub, and only to read.

Order: the setup and E418S3-00; then E418S3-01 to E418S3-05, which need no test slot (run them while a stage cover may still hold it); then `quiet` and E418S3-06 to E418S3-13 in id order (E418S3-01's bundle serves every Web file and the probe); then E418S3-14 and E418S3-15. Every named test log (`nt`) must show `exit 0`, `# fail 0`, `# cancelled 0`, `# skipped 0`, `# todo 0`, `# pass` equal to `# tests`, no `not ok` and no `# SKIP`; every Web log's `census` prints a first count of at least `1` and a second count of `0`. A `# tests` count that differs from the number at writing must equal the file's own count of `test(` and `t.test(` calls at the build (renames and additions happen; files with loops or subtests, such as palette's viewport loop or area-slots' and shell's subtests, are judged by their names); every test named below must appear in `oks`.

| id | surface | where | covers | command | expected |
| --- | --- | --- | --- | --- | --- |
| E418S3-00 | hub-api | QA shell | build, plan, merges, sealing | `k00 \| tee "$EV/E418S3-00.txt"` | Both SHAs equal `$S`; `0` changed paths; the symlink reads `/Users/evgeniyivanov/Projects/cland/v0/node_modules`. The plan lists the stages `seams and the session list`, `acting, the queue, accounts and artifacts`, `on E-417's thread, composer and notifications`; this stage has `qa` `{scope: "affected", when: "after-stage"}`, `state` not `closed` (it closes only after this verdict and the covers), `items` T-1141, T-1142, T-1143, T-1160 plus any findings fixes the request names (nothing else), `total` equal to the number of printed items and `merged` equal to `total`; record the printed line as printed. Under every `== <id>` line exactly one commit line (T-1160 `652470cb`, T-1143 `f47545a2`, T-1142 `4624720e` at writing; T-1141 the commit that landed it); a missing line is BLOCKED "<id> not on dev". All eight files listed. Paths outside `web/` and `docs/`: under T-1141 `hub/test/tiers.json` (at writing; `hub/test/durations.json` too if its landing added an allowance, which is no finding); under T-1142 `.agents/skills/implement/CHANGES`, `.agents/skills/implement/SKILL.md`, `hub/README.md`; under T-1143 and T-1160 nothing. No `hub/src/`, `shared/` or `nvim/` path under any id. `TMPDIR` is the system default (not `/tmp`) and `Q` begins `/private/tmp/qa-e418s3-`. Also record the setup's two counts (the first at least `1`, the second `0`) and `probe parses`. Repeat the first two commands after E418S3-15: unchanged (dev not moved) |
| E418S3-01 | hub-api | sealed $W | build | `npm run build --workspace web > "$EV/E418S3-01.log" 2>&1; echo "build exit $?"; ls web/dist/index.html web/dist/assets; git status --porcelain \| grep -v -x -F '?? node_modules' \| wc -l` | `build exit 0`; `web/dist/index.html` and the `assets` directory listed; `0` changed paths (`web/dist` is ignored). Needs no test slot |
| E418S3-02 | hub-api | QA shell | the one key map and the sources: T-1141's `session-composer` context, Enter and its help label, the drawer's parts; T-1142's switches in Profile, none in the palette; T-1143's `s`; the T-1157 guard | `k02 \| tee "$EV/E418S3-02.txt"` | One line for the `session-composer` binding (`composerKeys` plus `Shift+Backquote` only: no `Shift+Digit2` chooser); five lines whose leading count is `1` for `Enter: 'session-open',`, the help label `Open session thread, page or queue`, `Return to list`, `KeyS: 'artifact-compose',` and `Attach to composer`; after `-- drawer` three `1` lines (the composer's `To {session} in` address, the drawer's `SessionRecentThread` and its `ApprovalCard`); after `-- notification switches` four `Profile.tsx` matches (`aria-label="Notifications"`, `['needsYou', 'Needs you',`, `['finished', 'Finished',`, `role="switch"`), then three lines ending `web/src/Palette.tsx:0`, `web/src/Shell.tsx:0` and `web/src/keymap.ts:0`; after `-- T-1157 guard` `1` (automatic earlier loads stop while an error is set) |
| E418S3-03 | hub-api | QA shell | AGENTS.md `web/` rules | `k03 \| tee "$EV/E418S3-03.txt"` | The key-listener grep lists only `web/src/keyboard.ts` (one `document.addEventListener('keydown', …)`, its handler and its removal): no component-local key listener in `SessionDrawer.tsx`, `SessionRecentThread.tsx`, `Thread.tsx`, `Composer.tsx`, `accounts/Profile.tsx` (the switches are native buttons) or the Artifacts modules. Storage appears only in `web/src/interface-state.ts` under `cland.ui.<area>.v1` and in `web/src/connection.ts`'s `cland-reload-build` guard (switches, drafts and This topic reach storage through `interface-state.ts`). The raw-HTML grep prints nothing (notes render through `MarkdownBody`, HTML stays literal). Under the four ids nothing: no dependency, devDependency or lockfile change |
| E418S3-04 | hub-api | docs | T-1141 C5, T-1142 C3, T-1143 C5, T-1160 C1; the T-1157 and T-1180 wording | `k04 \| tee "$EV/E418S3-04.txt"` | Every `present` line above `-- stale statements` starts with `1 ` (or more), and every `heading` line starts with `1 ` (each section the T-1160 paragraph links exists). The six lines after `-- stale statements` each start with `0 `: the T-1141 replaced drawer sentence, the T-1160 stand-in sentence and any `AreaObjects` mention, the T-1180 "facts that do not yet have UI" wording, and the T-1142 palette wording in both READMEs; a `1` there is FAIL for the criterion it belongs to (T-1141 C5, T-1160 C1, T-1142 C3) or, for the T-1180 line, a **low** finding. Then read `web/README.md`'s Sessions (the drawer paragraphs and key table), Composer, Topics and threads (the thread key table and the earlier-page paragraph), Artifacts, Browser notifications, "Accounts strip and Accounts area", "Area modules and live state", "Split and drawer", "Palette and keys" and "Browser tests" sections, `hub/README.md`'s notification paragraph and the `docs/agents/tests.md` paragraphs for `session-drawer.test.ts`, `notifications.test.ts`, `artifacts.test.ts` and `topics.test.ts`, and record any statement that contradicts E418S3-02 or E418S3-06 to E418S3-12 as a **low** finding with file and line (the row stays PASS when the only contradictions are docs ones). Candidates at writing, to confirm or dismiss at the build: the thread key table's `h`, `Esc` row still says "Return to the source list (Topics or Inbox)" while the drawer's thread returns to the selected session row and the help label is now `Return to list`; any `Notifications ·` palette label the last grep prints (none at writing) |
| E418S3-05 | hub-api | sealed $W | brief | `cland qa lint qa/briefs/E-418-stage-3.md; echo "exit $?"` | `qa/briefs/E-418-stage-3.md: qa lint passes at the build` and `exit 0` (this brief, committed at the build). Needs no test slot |
| E418S3-06 | hub-api | test $W | T-1141 C1–C4 | `nt E418S3-06 web/test/session-drawer.test.ts; oks E418S3-06; census E418S3-06` | Web, clean (`# tests 7` at writing), census `7` and `0`. `oks` lists "the session drawer approves a fake Codex command and retains its folded outcome after Waiting" (C1: the drawer's `Command approval` card shows exactly `printf "drawer approval receipt"`; Approve once folds to `Approved once by the human`, the fake receives `once` for `drawer-once`, the row leaves the Waiting group after the fake turns busy and stays selected), "the session drawer pages both directions of cross-topic traffic by number and follows live messages" (C2: the first 20 ids equal the hub's `session.history`, the topics `General` and `Other traffic`, older pages by scrolling until `Cross-topic traffic 00`, live outgoing and incoming messages appear, an unrelated peer message does not, each of the 45 once, `data-message-seq` strictly ascending), "a held older session page preserves live traffic, numeric boundaries and the reading anchor" (C2: the held page's `before` equals the first page's boundary seq, the anchor moves at most 2 px, 33 rows), "the drawer composer delivers to the selected fake Codex session in its item topic or General" (C3: `To item-worker in Drawer item` and `To free-worker in General`, no `Choose a session (@)` button, `@` stays text, the fake's injection has `to` the session and the destination topic, outcome `accept`, the stored message `injected` with the same id), "desktop Enter and Open thread focus the selected session log with shared physical thread keys" (C4: physical Enter on the desktop row focuses `focus-worker recent thread`, `j` focuses the message, Escape returns to the row; Open thread after Close and in a split focuses the log, the split shows no drawer), "a session drawer keeps TUI-only approvals read-only and prefers a new pending card over a closed one" (`Answer in Neovim`, `0` buttons) and "Retry after a failed session selection refresh reads recent traffic even when older history is complete" |
| E418S3-07 | hub-api | test $W | T-1141 C4 in the Inbox approval drawer (the M1 fix); E-417's approval card and recent thread unchanged under the shared `SessionRecentThread` | `nt E418S3-07 web/test/inbox.test.ts; oks E418S3-07; census E418S3-07` | Web, clean (`# tests 23` at writing: E-417 stage 4's 22 plus T-1141's one), census `23` and `0`. `oks` lists T-1141's "an Inbox approval recent thread routes physical message navigation and returns to its selected row" (physical `j` then `k` with Cyrillic key values focus the exact latest and previous message ids in `race-worker recent thread`; Escape focuses the selected approval row, `aria-pressed` `true`), and E-417's "selecting an approval shows the session recent thread in the drawer", "selecting another approval from one session refreshes recent messages and fences a held prior read", "approval card shows the complete command and session facts, then folds to the human once outcome", "Escape cancels a denial without answering and Deny accepts an optional note", "approval cards retain the complete file change and TUI-only records have no answer buttons", "a refused approval race recovers only its exact archived winner and preserves a newer Inbox row", "Inbox drawer follows the selected message and physical r replies to its fake sender" |
| E418S3-08 | hub-api | test $W | T-1142 C1, C2 | `nt E418S3-08 web/test/notifications.test.ts; oks E418S3-08; census E418S3-08` | Web, clean (`# tests 8` at writing), census `8` and `0`. `oks` lists "profile switches persist Finished off across reload and request permission only on first enable" (C1 and C2: the Accounts **Profile** region holds exactly two `switch`es **Needs you** and **Finished**, both off, `permissionRequests` `0`; physical Enter on Needs you turns it on with `permissionRequests` `1`; the palette searched for `>Notifications` offers no `Notifications · Needs you\|Finished` option; Finished on then off without a second request; after a reload Needs you on and Finished off; later toggles keep `permissionRequests` `1`), "denied permission keeps both switches off with a browser-settings tooltip", "revoked browser permission disables saved switches on reload and explains why", "one browser shares switch changes between its open tabs", "hidden now ask raises one named notification whose click focuses and opens its Inbox row", "looking, disabled and watch-layer asks stay silent without later replay", "hidden now task reaching done notifies once and its click opens the item card", "a task moved out of Now by another item delta stays silent when it later finishes" |
| E418S3-09 | hub-api | test $W | T-1143 C1–C4 | `nt E418S3-09a web/test/artifacts.test.ts; oks E418S3-09a; census E418S3-09a; nt E418S3-09b web/test/thread-artifacts.test.ts; oks E418S3-09b; census E418S3-09b` | Both Web, clean: artifacts `# tests 11`, thread-artifacts `# tests 5` at writing; censuses `11`/`0` and `5`/`0`. `oks E418S3-09a` lists "notes and prompts open rendered Markdown with literal HTML and a raw source toggle" (C1: heading `Review notes`, list `First fact`, `Second fact`, code `const value = 7;`, the `<script>` line literal with no `script` or `iframe` element; **Show source** by Enter shows the exact source with no heading; **Show rendered** restores it), "This topic follows the last opened thread and s adds its artifact to the retained composer draft and sent history" (C2 and C3: This topic absent before a thread, then exactly General's note; physical `s` keeps the draft `Artifact attachment receipt` and adds the chip; the Coordinator spoke receives the message; `topic.history` carries the artifact id; after opening `Another topic` the section lists only its note, kept after reload), "s refuses without a writable topic and for archived or other-topic artifacts without changing the draft" (C4: `Open a writable topic to attach artifacts`, `Artifact belongs to <topic>; open that topic to attach`, `Artifact is archived; keep it to attach`, no chip, the draft `Keep this draft` kept), "s in a split pane adds one shared composer chip while an open ask answer draft stays unchanged" (decision 95aee0d4), and stage 2's "Artifacts groups human, Aide and crew records with remembered section folds", "Enter opens a capability page full height and its script cannot read the workbench document or cookie", "files and folder children open capability text or a named binary download and report missing bytes". `oks E418S3-09b` lists "moving a thread-opened page into a folder does not resurrect a top-level artifact" (the case T-1143 changed) and the other four |
| E418S3-10 | hub-api | test $W | T-1157 regression (carried by T-1141): the Topics Retry guard and its determinism | `nt E418S3-10 web/test/topics.test.ts; oks E418S3-10; census E418S3-10; for n in 1 2 3 4 5; do nt E418S3-10r$n --test-name-pattern='^a rejected earlier page retries with its old top message anchored$' web/test/topics.test.ts; done` | The file: Web, clean (`# tests 9` at writing), census `9` and `0`; `oks` lists "a rejected earlier page retries with its old top message anchored" (the rewritten case: the rejection is released only after the anchor is measured; the Retry button with title `Rejected earlier page` stays visible after a further scroll event fenced by a live `Retry guard receipt` row, and no second earlier-page request leaves; explicit Retry then loads with the old top message anchored and 151 rows in the hub's order) and the other eight. The five repetitions: each `exit 0`, `# tests 1`, `# pass 1`, `# fail 0`, `# skipped 0` (the name pattern selects that case only; Node 24 omits the filtered cases, as at writing), census `1` and `0`, and its one `ok` line is that case. Any failure of the case is FAIL (no flake rerun here: T-1141 made it deterministic) |
| E418S3-11 | hub-api | test $W | regression of the shared thread, composer, Sessions, area, key and Accounts files | `nt E418S3-11a web/test/sessions.test.ts; oks E418S3-11a; census E418S3-11a; nt E418S3-11b web/test/key-contexts.test.ts; oks E418S3-11b; census E418S3-11b; nt E418S3-11c web/test/palette.test.ts; oks E418S3-11c; census E418S3-11c; nt E418S3-11d web/test/area-slots.test.ts; census E418S3-11d; nt E418S3-11e web/test/shell.test.ts; census E418S3-11e; nt E418S3-11f web/test/composer.test.ts; census E418S3-11f; nt E418S3-11g web/test/thread-runs.test.ts; census E418S3-11g; nt E418S3-11h web/test/session-actions.test.ts; census E418S3-11h; nt E418S3-11i web/test/session-launch.test.ts; census E418S3-11i; nt E418S3-11j web/test/accounts.test.ts; oks E418S3-11j; census E418S3-11j; nt E418S3-11k hub/test/web-keymap.test.ts; oks E418S3-11k` | Each file clean. At writing by `test(` count: sessions `5` (`oks` lists "Sessions rows render merged facts, holds, waiting detail and physical selection keys", whose exact `Attach` assertion T-1141 corrected: Sessions has no terminal Attach action), key-contexts `3` (`oks` lists "area modules keep selection and drawers and session launch actions appear in help and palette": the Sessions help's `session-` rows include `Open session thread, page or queue`, 24 `kbd`), palette judged by names (`# tests 11` at writing, its viewport loop; `oks` lists "the palette and area keys help", which asserts the same Sessions labels), composer `8`, thread-runs `5`, session-actions `9`, session-launch `9`, accounts `6` (`oks` lists "Accounts profile shows this browser sign-in, last use and fixed 30-day cookie expiry" and "Accounts profile excludes a second browser context sign-in on the same hub": the Profile block that holds the switches still renders its sign-in facts); area-slots and shell hold subtests (`# tests 4` and `9` at writing): judge them clean with every `ok`. T1 web-keymap clean (`# tests 2` at writing; `oks` lists "focused contexts resolve before shell keys without changing Items or Plan chords" and "browser tab/window chords remain unbound and area shortcuts require exact modifiers"; census prints `0 0`, expected for T1) |
| E418S3-12 | hub-api | sealed $W | T-1141 C1–C4, T-1142 C1–C2, T-1143 C1–C4 (independent probe) | `k12` | `exit 0`, `# tests 1`, `# pass 1`, `# fail 0`, one `Web fixture census: browser group <pid>; before <n>; after 0; scratch hub stopped` line, no `step` line. `seeded` `{item: true, topic: true, claimed: true, sends: 30, waitLaunch: true}`. `approve` (T-1141 C1): `command: 'printf "QA stage 3 drawer approval"'` (the exact command in the drawer's card), `buttons` `["1 · Approve once", "2 · Always for this command", "d · Deny"]`, `outcome` beginning `Approved once by the human · web · `, `answers` one `{requestId: "qa-once", choice: "once"}` (with the session id), `waitingBefore: 1`, `waitingAfter: 0` (the row left Waiting), `group` a group other than `Waiting` (`Busy` at writing), `selected: "true"` (the session stays selected), `outcomeAfterLeaving: 1` (the fold remains after Waiting), `archive` `{choice: "once", by: "human", via: "web", at: …}`. `thread` (C2): `recentCount: 20`, `recentMore: true`, `firstEqual: true` (the drawer's first page is exactly the hub's latest 20), `topics` `["General", "QA item topic"]` (across topics, each message naming its topic), `allCount` at least `30` (`32` at writing: the hub also counts the session's own launch and claim traffic) and `afterCount` equal to it, `afterEqual: true` (after one scroll to the top the log holds exactly the hub's whole history in order: no gap, no repeat), `seqsAscendingUnique: true`, `directions` `["received", "sent"]` (both directions). `composer` (C3): `qa-item` `{address: "To qa-item in QA item topic", chooser: 0, injectedTo: ["qa-item"], injectedTopicIsDestination: true, outcome: "accept", storedStage: "injected", sameId: true}` (its item's topic) and `qa-free` the same with `address: "To qa-free in General"` and `injectedTo: ["qa-free"]` (General without an item). `focus` (C4): `{enter: true, back: "qa-item", openThread: true}` (physical Enter on the desktop row and Open thread each focus `qa-item recent thread`; Escape returns to the row). `switches` (T-1142 C1, C2): `count: 2`, `initial: ["false", "false"]`, `requestsInitial: 0`; `afterFinishedOn` `{state: ["false", "true"], requests: 1}` (the first enabling asks once, whichever switch it is); `afterNeedsOn` `{state: ["true", "true"], requests: 1}` (no second request); `afterReload` `{state: ["true", "false"], requests: 1, stored: '{"needsYou":true,"finished":false}'}` (Finished off survives the reload); `paletteOptions: 0`. `seededArtifacts` `{note: true, otherNote: true}`. `otherBrowser` `{state: ["false", "false"], stored: null}` (browser B keeps its own switches: per browser). `note` (T-1143 C1, C2): `rendered` `{items: ["QA one", "QA two"], code: "echo QA"}`, `sourceStartsWithHash: true`, `headingsInSource: 0` (Show source is the raw text), `thisTopicBefore: 0` (This topic absent before a thread is opened in this browser). `attach` (C2–C4): `listed: true` (This topic lists exactly General's note after General's thread was opened), `refusal` one alert `Artifact belongs to <the item topic's id>; open that topic to attach` (`topic-1` at writing), `draft: "QA attach receipt"` (kept), `chips: 1`, `sentArtifacts: ["note"]` (the sent message carries the note in `topic.history`) |
| E418S3-13 | hub-api | sealed $W | typecheck, colour and HTML guards, tiers | `k13` | `typecheck exit 0` with no diagnostic in the log (hub, Neovim, shared wire and web typechecks; the colour, token, HTML and hooks guards: `Sessions.module.css`, `Shell.module.css` and `accounts/Profile.module.css` hold no colour value; secondary text keeps 4.5:1); the four guard lines appear (`web HTML: raw-HTML sinks refused; seeded fixtures passed`, `web colours: token-only sources; colour fixtures passed`, `web tokens: <n> text tokens ≥4.5:1 on ground and selection; role colours match hl.lua`, `web hooks: conditional-hook fixture rejected by configured oxlint`); `tiers exit 0`; the four `"Web"` classifications print (`session-drawer.test.ts` added by T-1141) |
| E418S3-14 | hub-api | QA shell; the Coordinator's stage covers | stage covers | `(cd "$W" && node hub/bin/cland.ts task plan show E-418) \| tee "$EV/E418S3-14.txt"` and the cover results the request names | QA runs no full suite. The Coordinator owns the stage covers (`cland verify all --occasion stage`): full integrated suites at the tested SHA on Linux (droplet) and macOS (local), which add T3 and the Web phase on both platforms and are cited evidence this run does not run. Record the plan's line for this stage exactly as printed; Linux and macOS covers green at the tested SHA, each with its Web phase run (not "Web unavailable"); record each cover's run id, artifact, executor, platform, tiers and phases, wall time and cost as cited evidence. Any red cover is FAIL naming its failing tests. A cover still running when every other check is done: wait for its result in the epic topic (the macOS cover takes about 20 minutes; a wait is not BLOCKED); none queued or running at the tested SHA by then: BLOCKED "no stage cover at the tested SHA", reported to the requester |
| E418S3-15 | hub-api | QA shell | cleanup | `k15 \| tee "$EV/E418S3-15.txt"` | Every Web log line prints a first census count of at least `1` and a second of `0` (E418S3-06 to E418S3-10r5, E418S3-11a to E418S3-11j, E418S3-12; the T1 log E418S3-11k prints `0 0`, which is expected); `0` changed paths; `$Q` begins `/private/tmp/qa-e418s3-`. Then remove `$Q` and the worktree as "Setup" says |

Re-check helper, file and test names with grep at the tested build: renames happen. A test name pattern matching zero tests passes with exit 0 and "tests 0": read the counts and `oks`, never the exit code alone. The named Web tests and the probe ask the live hub's verify slot for admission themselves (`suite.slot` check): an admission refusal or timeout while a cover holds the slot is not a product failure; run `quiet` and retry that row once.

Before requesting QA, run `cland qa lint <brief>` with this filled brief at the build under test. The brief is complete only when qa lint passes at the build.

## Probes that mislead

- Process cleanup probes use a fixture-owned pid/process-group census, registered at launch and checked through exit; a machine-wide `pgrep` counts other sessions too (A-9063 R2; E-413 stage 1/T-1093). Here: each Web fixture's `Web fixture census: browser group <pid>; before <n>; after 0; scratch hub stopped` line, the probe's included.
- Edit existing keys in initialized configs, list standalone-test build prerequisites, enumerate regular files only for file probes, and identify events by seq/id. A second-client check allows only defaults the new client writes itself (A-8634 R12; E-412 stage 2, E-415 stage 3/DoD, E-1006). Here: the probe's frame client and fake spokes only read and send through public frames; the pages write their own preferences; the probe's init script stubs `Notification` and writes no switch value, so `stored` is what the page itself saved.
- Transcript assertions identify stable item/topic/frame ids, with intervals starting at the result frame of the state-changing request. Preserve unaltered captures when correcting a probe and label the correction separately from product failures (A-8634 R13; E-412/E-415/E-1006; A-9063 R2; E-413 stage 1/T-1093). The probe finds sessions, approvals, messages and artifacts by the names and ids their creating requests or the hub's reads returned, never by position.
- Exact tracker copies replace the initialized tracker directory after its writers stop; apply the full `fixtureEnvironment` result after overlays, check zero credential-prefix names before launching scratch processes and report names/counts only (A-9063 R2; E-413 stage 1/T-1093). This run needs no tracker copy: every scratch project is a fresh Web harness project seeded through public frames.
- An accessibility-tree count does not prove visible reachability (A-9063 R6; T-1095, T-1097). Focus is judged by `document.activeElement` (the log's role and exact label, the row's exact id), never by a count.
- "Leaves Waiting" needs the fake's post-answer state: the fake Codex adapter does not change state by itself when an approval is answered, so the probe (like T-1141's own test) calls `busy` after the fold and the answer receipt. `waitingBefore: 1` with `waitingAfter: 0` proves the row followed the hub's state change, and the fold must still be there after it.
- Notifications are stubbed: permission is the stub's, counted in session storage so a reload keeps the count; a real browser's permission prompt and OS notification are out of scope. "Per browser" is two Playwright contexts of one Headless Shell, each with its own storage, as the item tests use.
- Physical keys are dispatched as `KeyboardEvent`s with the code and a Cyrillic key value (`я`), as the items' tests do, to prove the physical-code map; Playwright's `press` would send the Latin key value too. The probe's Escape and the switch's Enter use `press`, which the shared map also resolves by code.
- The topic thread's earlier-page guard (T-1157) is a timing race; one green repetition proves little. E418S3-10 runs the rewritten deterministic case once in the file and five times alone; T-1141's ready report carries the 20-run macOS count at two workers (A-9989) as the item's evidence.
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file.
- A "ran" marker grep excludes the configuration echo line.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log: not applicable, QA runs nothing on a droplet. Speed criteria use measured wall times, never projections: this stage has none; duration lines are report-only here.
- Slots due or queued before the build count even when their results arrive later.
- "No skip": the Web files and the probe need Chrome Headless Shell (local on macOS); a skipped or "Web unavailable" result is BLOCKED, never PASS. Linux runs of the same files are cited from E418S3-14, not run by QA.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

Real Chrome and computer use: out of scope for this run, not BLOCKED, as in stages 1 and 2: every stage criterion is proven in Chrome Headless Shell against signed-in sealed scratch hubs, and an anonymous real Chrome at the live edge would show only the offline shell with no sessions, approvals or artifacts to act on. Real browser notifications, the OS permission prompt, the service worker and closed-page push are E-419's; the switches are proven with a stubbed `Notification`. The live hub's approval relay and real Codex, OpenCode or Claude Code sessions are not used: every approval and injection comes from the fake harnesses of sealed scratch hubs, so no live-edge build stamp, hub restart or real approval applies. Also out of scope: E-414's approval gate and E-417's thread, approval card, composer, notification rules and Markdown renderer beyond the named files (their own stages judged them); the phone layouts of E-419 (the narrow Sessions page has no drawer, stage 2 judged it); rendered Mermaid (T-1158); Neovim; T-1157's and T-1180's own closure (the Coordinator closes them against T-1141's landing; E418S3-10 and E418S3-04 are regression evidence only); work landed on dev after the stage's items, beyond the regression files named here; running a full suite, T3 or a stage cover (E418S3-14 cites the Coordinator's); T4; duration budget lines (report-only); the epic's Definition of done and its demo, a separate run; the live project's tracker, hub, crew, `ui.json` and HOME. Stage QA carries no criterion marks.

Nothing else in scope needs an authorization this brief does not give: a check that cannot run for lack of one is BLOCKED, not out of scope.

## Grants

none. No computer use, no real browser, no sign-in, no real notification permission. The Headless Shell instances of the Web files and the probe open only their own sealed scratch edges, under the crew browser rule (rule 18). Every other check uses the rule 15 sealed environment with credentials filtered; nothing reads or writes the human's real `~/.cland`, `~/.claude`, `~/.codex` or `~/.local/state`.

## Verdict

Fix nothing. Clear only when every check E418S3-00 to E418S3-15 passes (docs contradictions in E418S3-04 beyond the items' own criterion lines are low findings and do not block clear). Otherwise not clear, naming the failing, blocked or inconclusive ids and findings. On the epic record one QA verdict with `--stage "on E-417's thread, composer and notifications"`, the full tested dev SHA, the unique run id and the case table. Stage QA carries no epic criterion marks. Report `qa clear E-418 stage on E-417's thread, composer and notifications` or `qa not clear E-418 stage on E-417's thread, composer and notifications` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
