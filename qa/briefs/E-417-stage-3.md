# Stage QA brief: E-417 stage 3 — inbox and composer

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` or `$B:h` as a modifier). The run is local, on macOS (BSD tools; Chrome Headless Shell from the installed `playwright-core`).

## Stage

- Epic: E-417 (Topics, threads and the inbox, under R-377).
- Exact stage name: inbox and composer.
- Items, in plan order: one serial lane T-1123, then T-1124, then T-1125, then T-1126; a second lane T-1161. The run reads the stage's members, counts and state from `task plan show E-417` (E417S3-00 and E417S3-13), never from a number written here. Findings fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: the combined changed behaviour of the five items at the tested build. Unlike stage 2, this stage changed hub and shared wire code (T-1125 only: `hub/src/hub/core.ts`, `hub/src/protocol.ts`, `hub/src/adapters/sessions.ts`, `shared/wire/index.ts`); everything else is the web bundle, its tests and docs. No Neovim source changed.
  - T-1123, the Inbox's four sections (P17, P18): `web/src/InboxArea.tsx` shows **Asks and approvals**, **Plan approvals**, **Requests** and **Messages to you** in that order, each newest first with a name-and-count header; five rows per section, the rest folded into one More line naming the hidden count and the oldest wait; an empty section is one muted line (`data-inbox-empty`); ages update locally; section folds persist. The selected row unfolds in place (ask card, request/message full text with buttons, plan stage/lane/item counts); `d` declines a request (its sender is told) or marks a message read and the row leaves; Enter opens the row's topic at its message, or a waiting plan's Plan view; the events footer (`data-inbox-events`) counts events and warnings newer than the human's shared last look, stays when every section is empty and opens Events. Keys in the `inbox` and `inbox-answer` contexts.
  - T-1124, the composer (P16): `web/src/Composer.tsx` at the foot of every writable thread; Message, Decision, Question as a segmented control sent as the hub's kind; the addressee chip (Coordinator by default in an item's topic, `@` picks a session through the palette, no chip means the hub's own addressing); `~` attaches an available topic artifact as a chip; Enter sends a one-line draft, Shift+Enter breaks the line, `⌘Enter` always sends, Enter in a multi-line draft breaks the line; `⌘K` opens the palette keeping the draft; per-topic drafts (`web/src/composer-drafts.ts`, browser storage through `interface-state.ts`) survive navigation, disconnection and reload; Send and the send keys are disabled offline with nothing queued in the browser; pending until the hub's receipt, a refusal restores the text; a send marks the topic read up to it (the hub's own read-through).
  - T-1125, queued messages and Withdraw: a human message whose hub fact `withdrawable` is true (or, from a hub without that field, whose aggregate stage is `queued`) offers Withdraw in its `web/src/MessageBlock.tsx` header; Withdraw sends `topic.withdraw`, shows **Withdrawing** pending, and on the receipt marks the message `withdrawn` and restores its text ahead of anything typed since (`web/src/message-withdrawal.ts`, `composer-drafts.ts`); once the hub reports it injected, or any recipient of a broadcast was injected (`withdrawable: false` while the aggregate stays `queued`), Withdraw is gone; a refusal keeps the message with the hub's reason in its tooltip. Hub/wire: optional `TopicMessage.withdrawable` and `delivery.withdrawable`, computed from the same per-recipient check as `topic.withdraw`'s refusal (Coordinator decision in T-1125's topic, 2026-10-23 05:12Z: the hub computes an optional `withdrawable` from a message's deliveries with the same rule as its refusal; the web uses it when present and falls back to aggregate `stage === "queued"`, letting the hub refuse).
  - T-1126, the drawer, reply, leave rule and archive (P19, P38): with an Inbox row selected the drawer shows its topic's thread scrolled to the row's message, with a one-line reply composer (`reply` key context) addressed to the row's sender through `topic.send.replyTo`; `r` focuses it, also in a split; Split and Close as elsewhere. Rows that leave because they were answered, approved, replied or read stay folded to their outcome for the active Inbox visit (`web/src/inbox-visit.tsx`); moving among Inbox rows, its drawer and Inbox panes keeps the visit; navigating to another area or focusing a non-Inbox pane clears completed rows and the selection, matching Neovim's `leave_visit` (`nvim/lua/cland/inbox.lua`). `A` (Shift+KeyA) toggles the archive (`web/src/InboxArchive.tsx`): seven days of departures with kind, subject, leave time, reason and outcome; the archive line follows the events line and stays when every section is empty.
  - T-1161, docs: `web/README.md` no longer describes messages, inline HTML artifacts or ask cards as future or stand-in work, and its key tables list Toggle agent run and the ask keys with their contexts.
- Decision governing E-417 (Coordinator, ask 9a81a158, comment on E-417 at 15:17Z 2026-10-22, per spec §3.4): only a human Question leaves the topic waiting for its addressee; a human Message or Decision does not. In this stage it bears on the composer's kinds (T-1124 C1) and is probed in E417S3-08 (`kinds`).

Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

Criteria map (the stage verdict carries no item or epic marks; this tells the run which check proves what):

| criterion | proven by |
| --- | --- |
| T-1123 C1 (four sections in order, newest first, ages, name-and-count headers, an empty section one muted line) | E417S3-02 |
| T-1123 C2 (seven rows show five and fold two into a line naming the count and the oldest wait) | E417S3-02 |
| T-1123 C3 (the selected row unfolds with its buttons; `d` declines a request as the fake sender receives it, or reads a message; the row leaves) | E417S3-02 |
| T-1123 C4 (Enter on a message row opens its topic at that message; on a waiting plan opens its Plan view) | E417S3-02 |
| T-1123 C5 (the events line counts events and warnings since the last look and stays when every section is empty) | E417S3-02, E417S3-08 (`archive`, the four empty sections) |
| T-1124 C1 (Message, Decision, Question sent with their kinds, read so by the thread and a frame client) | E417S3-03, E417S3-08 (`kinds`) |
| T-1124 C2 (an item topic's chip names the Coordinator who receives it; `@` replaces the chip with a session who receives the next one) | E417S3-03, E417S3-08 (`kinds`, the chip) |
| T-1124 C3 (Enter sends one line, Shift+Enter breaks, `⌘Enter` sends a multi-line draft, `⌘K` opens the palette keeping the draft) | E417S3-03, E417S3-07 |
| T-1124 C4 (`~` attaches a chosen artifact and the received message carries it) | E417S3-03 |
| T-1124 C5 (drafts survive reload and disconnection per topic; Send disabled offline; writing marks the topic read up to the sent message) | E417S3-03 |
| T-1125 C1 (a message to a busy fake session shows queued with Withdraw; Withdraw marks it withdrawn and restores its text) | E417S3-04, E417S3-05, E417S3-08 (`withdraw`) |
| T-1125 C2 (the fake session's turn takes it: injected and Withdraw gone; one injected recipient of a broadcast removes Withdraw while the aggregate stays queued) | E417S3-04, E417S3-05, E417S3-08 (`partial`) |
| T-1125 C3 (a refused withdraw leaves the message as it was with the refusal shown) | E417S3-04, E417S3-05, E417S3-08 (`partial`, the hub's refusal) |
| T-1126 C1 (selecting a row shows its thread in the drawer scrolled to the row's message; `r` sends a one-line reply the fake sender receives) | E417S3-02 |
| T-1126 C2 (an ask answered from the Inbox stays folded while the Inbox is shown; after leaving and returning it is gone) | E417S3-02, E417S3-08 (`leaveArea`, `leavePane`), E417S3-07 (Neovim's leave rule) |
| T-1126 C3 (`A` lists the answered ask in the archive with why it left; the archive line stays when every section is empty) | E417S3-02, E417S3-08 (`archive`) |
| T-1161 C1 (README has no sentence describing messages, inline HTML artifacts or ask cards as future or stand-in work) | E417S3-11 |
| T-1161 C2 (README key tables list Toggle agent run and the ask keys with their contexts) | E417S3-11 |

Docs beyond T-1161: the `web/README.md` sections of the items (Inbox, Composer, the Withdraw paragraphs, the key tables), `hub/README.md`'s `withdrawable` paragraph and `docs/agents/tests.md`'s paragraphs for the new test files are read by E417S3-11, which records contradictions with the implementation as low findings.

Definition-of-done pointer (no marks): E-417 C5 (the composer's kinds, chip, keys, Withdraw, drafts and offline Send) is exercised by E417S3-03, E417S3-04 and E417S3-08; C6 (the four sections, ages, the selected row, `r`, `d`, the archive and the drawer) by E417S3-02 and E417S3-08 as far as this stage builds it (the events view is stage 4); C3's "in the inbox until the human leaves it" by E417S3-02 and E417S3-08. C4 and C8 are stage 4.

## Build

Use a clean detached worktree at dev at the SHA in the request (the full 40-hex SHA), created below. HEAD must equal that SHA and refs/heads/dev before and after running. All listed items must have merged onto dev: for every member that `task plan show E-417` lists in stage `inbox and composer`, `git log --first-parent --oneline --grep "Item: <id>" dev` prints exactly one commit. At writing T-1161 landed as `930712ed`, T-1123 `ac6f75a8`, T-1124 `aecd057d` and T-1125 `a1a62e03`; **T-1126 had not landed**: it was in the merge queue at its reviewed head `5f0058f3` (branch `t/T-1126-the-inbox-drawer-the-reply-the-leave`). Every expectation below was read from dev at `1abf4501` for the first four items and from `5f0058f3` for T-1126 (whose branch already contains T-1125). The run starts only once T-1126 is on dev; E417S3-00 checks it through the plan, and a missing T-1126 landing is BLOCKED. Dev may carry work landed after these items that is outside this stage; it is not judged here. A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no commit of its own or run id on purpose: committing a brief changes the tested tree. Re-check test names, labels and docs strings with grep at the tested build.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step (the setup below does; the clean-tree checks ignore that one entry). Run E417S3-01's build before any Web file or the probe, or the shell never renders. The browser is the suite's Chrome Headless Shell under `node_modules/playwright-core/.local-browsers`: each named Web test file and the QA probe start and close their own through the Web harness (`web/test/harness.ts`, `webFixture`). No real browser and no other GUI process starts. The live hub is touched only by `quiet`, the Web harness's own read-only admission check and the plan reads of E417S3-00 and E417S3-13. Every hub fact this run judges, `withdrawable` included, comes from sealed scratch hubs started from `$W`'s own source; the live hub's code is not tested, so no live-edge bundle, root rebuild or hub restart is needed (see "Out of scope").

## Setup (once, before E417S3-00)

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree, runs `quiet`, the plan reads, reads the captures and records every check with `qa-record.sh`. **Every other command runs sealed** (rule 15) inside a subshell that sources `$Q/env.sh`: the full `fixtureEnvironment` result (`test-support/fixture-environment.ts`) after the scratch overlays (its synthesized HOME, XDG, Git, account and fake-harness paths included), which drops every `CLAND_*`, `GIT_*`, `XDG_*`, `CLAUDE_*`, `CODEX_*`, `FAKE_*`, provider and account variable while keeping `PATH`, `SHELL`, `TERM` and `TMPDIR`. Leave `TMPDIR` at the system default (on macOS `/var/folders/...`; never `/tmp`, T-1030). Never use `env -i`. The scratch root lives under `/private/tmp/qa-e417s3-` (its realpath). Never the live project's hub for anything but the reads named above and `quiet`; never the human's HOME, `~/.cland`, `~/.claude`, `~/.codex` or `~/.local/state`. Fixtures are fake only: the Web harness's sealed scratch projects and hubs with in-process fake adapters, the fake Claude Code harness's busy/idle sessions, fake spokes as senders and the fake Coordinator asker; no real session, account or provider binary.

In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<the full dev SHA from the request>
RUN=qa-s3-$(date +%F)-1                        # unique run id for E-417; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e417s3-$RUN           # the clean detached build
EV=$R/.cland/qa/E-417/$RUN                     # captures (qa-record.sh keeps its evidence here too)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
Q=$(cd "$(mktemp -d /tmp/qa-e417s3-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/qa-e417s3-…
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

The QA probe. `$Q/probe.test.mjs` is a one-test `node --test` file, independent of the items' own tests: one sealed scratch project and hub through the Web harness (`webFixture` with a `FakeClock`: `tempProject` under the system `TMPDIR`, `projectHub` with in-process fake adapters, the production socket and web edge serving `$W/web/dist`, a Headless Shell page at 1440×900 signed in through a minted link), a fake Coordinator (`inProcessSpoke`, role coordinator, name `qa-coord`), two fake Claude Code implementers launched through `session.launch` and held busy (`qa-worker`, `qa-other`), and the local human frame client. Steps: `kinds` sends a Message, a Decision and a Question from the composer of an item's topic and reads the hub's topic status after each, then the Coordinator replies; `withdraw` sends `@qa-worker …` from General's composer, types newer text and withdraws; `partial` sends one message to both busy sessions, lets `qa-other` take its turn and reads Withdraw, the hub's frame, history and refusal, then lets `qa-worker` take a single queued message; `leaveArea` answers an Inbox ask with physical `2`, focuses the events line, then goes to Topics and back; `leavePane` answers a second ask in the primary Inbox pane with physical `1` while a split shows Topics, then focuses a topic row in the split; `archive` presses Shift+`A` (physical `KeyA`, key value `я`) on the events line and again to close. It asserts nothing about the product: every fact goes to `$QA_OUT` as one JSON line; a step that throws writes `{"step":{name,error}}` and the probe goes on. The Web fixture's own cleanup writes the census line.

```sh
cat > "$Q/probe.test.mjs" <<'JS'
// QA probe for E-417 stage 3 (node --test, sealed, cwd $QA_W): one sealed scratch hub through the Web harness, a
// Headless Shell page signed in by a minted link, a fake Coordinator and two fake busy Claude Code sessions. It asserts
// nothing about the product: every fact goes to $QA_OUT as one JSON line {"fact": value}; a step that throws writes
// {"step": {name, error}} and the probe goes on.
import test from 'node:test';
import { appendFileSync } from 'node:fs';
const W = process.env.QA_W, OUT = process.env.QA_OUT;
const { webFixture } = await import(`${W}/web/test/harness.ts`);
const { connectUi, inProcessSpoke } = await import(`${W}/hub/test/harness.ts`);
const { FakeClock } = await import(`${W}/hub/test/fake-clock.ts`);
const out = (key, value) => appendFileSync(OUT, `${JSON.stringify({ [key]: value })}\n`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function step(name, body) { try { await body(); } catch (error) { out('step', { name, error: String(error?.message ?? error).slice(0, 400) }); } }
async function poll(read, done, ms = 3000) { let value = await read(); for (let i = 0; i < ms / 100 && !done(value); i++) { await sleep(100); value = await read(); } return value; }
async function thread(page, id) {
  await page.getByRole('button', { name: 'Topics', exact: true }).click();
  await page.locator(`[data-object-id="${id}"]`).click();
  return page.getByRole('form', { name: 'Composer', exact: true });
}
const key = (locator, code, extra = {}) => locator.evaluate((node, [code, extra]) => node.dispatchEvent(new KeyboardEvent('keydown', { code, key: 'я', bubbles: true, cancelable: true, ...extra })), [code, extra]);
test('E-417 stage 3 QA probe', { timeout: 300000 }, async t => {
  const clock = new FakeClock();
  const fixture = await webFixture(t, { clock });
  const ui = await connectUi(t, fixture.hub.discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'qa-coord', role: 'coordinator', sessionId: 'qa-e417s3-coord' });
  await coord.waitForPresence(['qa-coord']);
  const fake = fixture.fakes['claude-code'];
  const launch = async name => {
    const launched = await ui.request({ type: 'session.launch', name, role: 'implementer', harness: 'claude-code' });
    const peer = await inProcessSpoke(t, { clock, discover: true, cwd: fixture.root, name, sessionId: launched.value.process.sessionId, launchToken: fake.spawns.at(-1).launchToken });
    await peer.waitForPresence([name]);
    fake.busy(name);
    return launched.ok;
  };
  const made = await ui.request({ type: 'task.create', title: 'QA composer kinds', size: 'XS' });
  const item = made.value?.item?.id;
  const opened = await ui.request({ type: 'topic.create', title: 'QA kinds', item });
  const topic = opened.value?.topic?.id;
  out('seeded', { item: made.ok, topic: opened.ok, worker: await launch('qa-worker'), other: await launch('qa-other') });
  const status = async () => { const row = (await ui.request({ type: 'topic.list' })).value.topics.find(row => row.id === topic); return { status: row?.status, waitingFor: row?.waitingFor ?? [] }; };
  await fixture.pageCase(t, async page => {
    await step('kinds', async () => {
      const form = await thread(page, topic);
      const chip = await form.locator('[data-composer-recipient]').innerText();
      const field = form.getByRole('textbox', { name: 'Message text' });
      const result = { chip, sends: [] };
      for (const label of ['Message', 'Decision', 'Question']) {
        await form.getByRole('button', { name: label, exact: true }).click();
        await field.fill(`QA ${label} kind`);
        const delivered = coord.waitForEvent(event => event.params.content === `QA ${label} kind`);
        await form.getByRole('button', { name: 'Send', exact: true }).click();
        await delivered;
        await form.locator('[data-pending-message]').waitFor({ state: 'detached' });
        const row = page.getByRole('log', { name: 'QA kinds thread', exact: true }).locator('article').filter({ hasText: `QA ${label} kind` });
        await row.waitFor();
        result.sends.push({ label, header: (await row.locator('header').innerText()).includes(label), ...await status() });
      }
      const reply = await coord.call('send', { topic, text: 'QA coordinator answers' });
      result.afterReply = { sent: reply.ok, ...await poll(status, value => value.status !== 'waiting for agent') };
      out('kinds', result);
    });
    await step('withdraw', async () => {
      const form = await thread(page, 'general');
      const field = form.getByRole('textbox', { name: 'Message text' });
      await field.fill('@qa-worker QA queued original');
      const posted = ui.waitFor(f => f.type === 'message' && f.message.text === '@qa-worker QA queued original');
      await form.getByRole('button', { name: 'Send', exact: true }).click();
      const message = (await posted).message;
      await form.locator('[data-pending-message]').waitFor({ state: 'detached' });
      const row = page.locator(`[data-message-id="${message.id}"]`);
      await row.getByRole('button', { name: 'Withdraw', exact: true }).waitFor();
      const queued = await row.locator('[data-delivery-stage]').innerText();
      await field.fill('QA newer typing');
      const withdrawn = ui.waitFor(f => f.type === 'delivery' && f.message === message.id && f.stage === 'withdrawn');
      await row.getByRole('button', { name: 'Withdraw', exact: true }).click();
      await withdrawn;
      const restored = await poll(() => field.inputValue(), value => value !== 'QA newer typing');
      out('withdraw', { sentWithdrawable: message.withdrawable ?? null, queued, stage: await poll(() => row.locator('[data-delivery-stage]').innerText(), v => v === 'withdrawn'),
        buttons: await row.getByRole('button').count(), restored, injected: fake.injections.some(i => i.message.id === message.id) });
      await field.fill('');
    });
    await step('partial', async () => {
      await thread(page, 'general');
      const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['qa-worker', 'qa-other'], text: 'QA broadcast waiting' });
      const message = sent.value.message;
      const row = page.locator(`[data-message-id="${message.id}"]`);
      await row.getByRole('button', { name: 'Withdraw', exact: true }).waitFor();
      const before = await row.getByRole('button', { name: 'Withdraw', exact: true }).count();
      const excluded = ui.waitFor(f => f.type === 'delivery' && f.message === message.id && f.withdrawable === false);
      fake.idle('qa-other');
      const frame = await excluded;
      const after = await poll(() => row.getByRole('button', { name: 'Withdraw', exact: true }).count(), v => v === 0);
      const stage = await row.locator('[data-delivery-stage]').innerText();
      const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value.messages.find(m => m.id === message.id);
      const refused = await ui.request({ type: 'topic.withdraw', topic: 'general', message: message.id });
      const single = (await ui.request({ type: 'topic.send', topic: 'general', to: ['qa-worker'], text: 'QA single waiting' })).value.message;
      const singleRow = page.locator(`[data-message-id="${single.id}"]`);
      await singleRow.getByRole('button', { name: 'Withdraw', exact: true }).waitFor();
      const injected = ui.waitFor(f => f.type === 'delivery' && f.message === single.id && f.stage === 'injected');
      fake.idle('qa-worker');
      await injected;
      out('partial', { sentWithdrawable: message.withdrawable ?? null, before, frame: { stage: frame.stage, withdrawable: frame.withdrawable }, after,
        stage, history: { stage: history?.stage, withdrawable: history?.withdrawable },
        refused: [refused.ok, refused.error ?? null],
        single: { stage: await poll(() => singleRow.locator('[data-delivery-stage]').innerText(), v => v === 'injected'), withdraw: await singleRow.getByRole('button', { name: 'Withdraw', exact: true }).count() } });
    });
    const ask = async question => { const r = await coord.call('ask', { topic: 'general', question, options: ['Keep', 'Change'], free: true }); await clock.advance(250); return r.ask; };
    const inbox = page.getByRole('list', { name: 'Inbox objects', exact: true });
    const answer = async (scope, id, code) => {
      const departure = ui.waitFor(f => f.type === 'inbox' && !!f.inbox.departures?.some(d => d.id === id));
      const delivered = coord.waitForEvent(event => event.params.meta?.answer_to === id);
      await key(scope.locator(`[data-object-id="${id}"]`), code);
      const content = (await delivered).params.content;
      await clock.advance(250); await departure;
      await scope.locator(`[data-ask-id="${id}"] [data-ask-outcome]`).waitFor();
      return content;
    };
    await step('leave-area', async () => {
      const id = await ask('QA leave by area');
      await page.getByRole('button', { name: 'Inbox', exact: true }).click();
      await inbox.locator(`[data-object-id="${id}"]`).click();
      const received = await answer(inbox, id, 'Digit2');
      const folded = await inbox.locator(`[data-ask-id="${id}"]`).innerText();
      await inbox.locator('[data-inbox-events]').focus();
      const keptInVisit = await inbox.locator(`[data-ask-id="${id}"]`).count();
      await page.getByRole('button', { name: 'Topics', exact: true }).click();
      await page.getByRole('button', { name: 'Inbox', exact: true }).click();
      await inbox.waitFor();
      out('leaveArea', { id, received, folded, keptInVisit, afterReturn: await inbox.locator(`[data-ask-id="${id}"]`).count(), selected: await inbox.locator('[aria-pressed="true"]').count() });
    });
    await step('leave-pane', async () => {
      const id = await ask('QA leave by pane focus');
      await inbox.locator(`[data-object-id="${id}"]`).click();
      await page.keyboard.press('Meta+Backslash');
      await page.locator('[data-pane="secondary"]').focus();
      await page.getByRole('button', { name: 'Topics', exact: true }).click();
      const primary = page.locator('[data-pane="primary"]');
      await primary.locator(`[data-object-id="${id}"]`).click();
      const received = await answer(primary, id, 'Digit1');
      const before = await primary.locator(`[data-ask-id="${id}"]`).count();
      await page.locator('[data-pane="secondary"] [data-object-id="general"]').focus();
      const after = await poll(() => primary.locator(`[data-ask-id="${id}"]`).count(), v => v === 0);
      out('leavePane', { id, received, before, after, selected: await primary.locator('[aria-pressed="true"]').count(), primaryInbox: await primary.getByRole('list', { name: 'Inbox objects', exact: true }).count() });
      await page.keyboard.press('Meta+Backslash');
    });
    await step('archive', async () => {
      await page.getByRole('button', { name: 'Topics', exact: true }).click();
      await page.getByRole('button', { name: 'Inbox', exact: true }).click();
      const footer = inbox.locator('[data-inbox-events]');
      await footer.focus();
      await key(footer, 'KeyA', { shiftKey: true });
      const archive = inbox.getByRole('list', { name: 'Inbox archive', exact: true });
      await archive.waitFor({ timeout: 3000 });
      await sleep(500);
      const rows = await archive.locator('[data-inbox-archive-id]').evaluateAll(ns => ns.map(n => [n.getAttribute('data-inbox-archive-id'), n.innerText.replace(/\s+/g, ' ')]));
      const line = inbox.locator('[data-inbox-archive-toggle]');
      out('archive', { rows, empty: await inbox.locator('[data-inbox-empty]').count(), lineVisible: await line.isVisible(), lineAfterEvents: await line.evaluate(n => !!n.previousElementSibling?.hasAttribute('data-inbox-events')) });
      await key(footer, 'KeyA', { shiftKey: true });
      out('archiveClosed', await poll(() => inbox.getByRole('list', { name: 'Inbox archive', exact: true }).count(), v => v === 0));
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
  (cd "$W" && node hub/bin/cland.ts task plan show E-417 --json) > "$EV/E417S3-00-plan.json"
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=v.stages.find(x=>x.name==="inbox and composer");console.log(JSON.stringify({stages: v.stages.map(x=>x.name), state: s.state, qa: s.qa, merged: s.merged, total: s.total, items: s.items}))' "$EV/E417S3-00-plan.json" | tee "$EV/E417S3-00-stage.txt"
  for i in $(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).stages.find(x=>x.name==="inbox and composer").items.join(" "))' "$EV/E417S3-00-plan.json"); do echo "== $i"; git -C "$W" log --first-parent --oneline --grep "Item: $i" dev; done
  ls "$W/web/src/InboxArea.tsx" "$W/web/src/InboxArchive.tsx" "$W/web/src/inbox-visit.tsx" "$W/web/src/Composer.tsx" "$W/web/src/composer-drafts.ts" "$W/web/src/message-withdrawal.ts" "$W/web/src/use-event-summary.ts" "$W/web/test/inbox.test.ts" "$W/web/test/composer.test.ts" "$W/web/test/withdraw.test.ts" "$W/hub/test/topic-withdraw.test.ts"
  for i in T-1123 T-1124 T-1125 T-1126 T-1161; do c=$(git -C "$W" log --first-parent --format=%H --grep "Item: $i" dev); echo "== $i paths outside web/ and docs/"; [ -n "$c" ] && git -C "$W" show --format= --name-only "$c" | grep -v -E '^(web/|docs/)'; done
  echo "TMPDIR=$TMPDIR Q=$Q"
}
k07() {   # QA shell: the key map of the Inbox, the reply and the composer; Neovim's leave rule; the withdrawable fallback
  grep -n -F "inbox: { 'Shift+KeyA': 'inbox-archive', KeyR: 'inbox-reply'," "$W/web/src/keymap.ts"
  grep -n -F "'inbox-answer': { 'Shift+KeyA': 'inbox-archive', Digit1: 'inbox-1'," "$W/web/src/keymap.ts"
  grep -n -F "reply: { Enter: 'composer-send', 'Shift+Enter': 'composer-newline', 'Meta+Enter': 'composer-send-always' }," "$W/web/src/keymap.ts"
  grep -n -F "composer: { Enter: 'composer-send', 'Shift+Enter': 'composer-newline', 'Meta+Enter': 'composer-send-always', 'Shift+Digit2': 'composer-session', 'Shift+Backquote': 'composer-artifact' }," "$W/web/src/keymap.ts"
  grep -c -E "Escape: '(inbox-|composer-)" "$W/web/src/keymap.ts"
  for l in "{ action: 'inbox-archive', label: 'Show Inbox archive' }" "{ action: 'inbox-reply', label: 'Reply to Inbox sender' }" "{ action: 'inbox-remove', label: 'Decline request or read message' }" "{ action: 'composer-send-always', label: 'Send message' }"; do printf '%s ' "$(grep -c -F -- "$l" "$W/web/src/keymap.ts")"; echo "$l"; done
  echo "-- Neovim leave rule"; grep -n -A4 -F 'local function leave_visit()' "$W/nvim/lua/cland/inbox.lua"
  echo "-- withdrawable fallback"; grep -n -F "(message.withdrawable ?? message.stage === 'queued')" "$W/web/src/MessageBlock.tsx"
}
k08() {   # sealed, in $W: the QA probe (one Headless Shell scratch hub; facts to $EV/E417S3-08.jsonl)
  : > "$EV/E417S3-08.jsonl"                    # start the fact file empty
  ( cd "$QA_W" && QA_OUT="$EV/E417S3-08.jsonl" node --test --test-reporter=tap "$QA_Q/probe.test.mjs" > "$EV/E417S3-08.log" 2>&1; echo "exit $?" >> "$EV/E417S3-08.log" )
  tail -n 1 "$EV/E417S3-08.log"; grep -E '^# (tests|pass|fail) |Web fixture census' "$EV/E417S3-08.log"
  cat "$EV/E417S3-08.jsonl"
}
k09() {   # sealed, in $W: the full typecheck with the web guards, the tier lint and the stage's classifications
  ( cd "$QA_W" && npm run typecheck > "$EV/E417S3-09.log" 2>&1; echo "typecheck exit $?"; node hub/test/lint-tiers.ts > "$EV/E417S3-09-tiers.log" 2>&1; echo "tiers exit $?" )
  grep -F -e 'web HTML: raw-HTML sinks refused; seeded fixtures passed' -e 'web colours: token-only sources; colour fixtures passed' -e 'web tokens:' -e 'web hooks: conditional-hook fixture rejected by configured oxlint' "$EV/E417S3-09.log"
  grep -F -e '"web/test/inbox.test.ts": "Web"' -e '"web/test/composer.test.ts": "Web"' -e '"web/test/withdraw.test.ts": "Web"' -e '"hub/test/topic-withdraw.test.ts": "T2"' "$QA_W/hub/test/tiers.json"
}
k10() {   # QA shell: AGENTS.md web/ rules at the build
  git -C "$W" grep -n -E "keydown|keyup|keypress|onKey(Down|Up|Press)" -- web/src
  git -C "$W" grep -n -E "localStorage|sessionStorage" -- web/src
  git -C "$W" grep -n -E "readInterfaceState|writeInterfaceState" -- web/src/composer-drafts.ts
  git -C "$W" grep -n -E "dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML" -- web/src
  for i in T-1123 T-1124 T-1125 T-1126 T-1161; do c=$(git -C "$W" log --first-parent --format=%H --grep "Item: $i" dev); echo "== $i"; [ -n "$c" ] && git -C "$W" show --format= "$c" -- package.json package-lock.json web/package.json hub/package.json nvim/package.json | grep -E '^[+-] '; done
}
k11() {   # docs, in QA's own shell
  ( cd "$W" || exit 1
    chk() { printf '%s present %s: %s\n' "$(grep -c -F -- "$2" "$1")" "$1" "$2"; }
    chk web/README.md "Inbox shows the hub's Now rows in **Asks and approvals**, **Plan approvals**,"
    chk web/README.md '| `r` on a request or message | Focus the drawer reply to its sender |'
    chk web/README.md '| `A` | Show or hide seven days of departures |'
    chk web/README.md "rows and Inbox selection, matching Neovim's leave rule. Returning starts from live"
    chk web/README.md 'The Archive line follows Events even when every section is empty. `A` toggles the'
    chk web/README.md 'Every writable thread has the P16 composer, including drawer and split threads.'
    chk web/README.md 'through `topic.send`; only Question starts a wait. An item'
    chk web/README.md '`withdrawable` fact is true. The hub checks every recipient and adapter submission;'
    chk web/README.md 'one injected recipient removes the action even while others remain queued.'
    chk web/README.md "An older hub without that fact falls back to queued messages and the hub's refusal."
    chk web/README.md '| `Enter`, `za` | Thread, on a run anchor or message in that run | Toggle agent run in place;'
    chk web/README.md '| `1`–`9` | Human-directed ask card or its thread row, outside fields | Answer with the corresponding option immediately |'
    chk web/README.md '| `i`, `r` | Human-directed ask card or its thread row, outside fields | Focus the free-answer field when available |'
    chk web/README.md '| `d` | Human-directed ask card or its thread row, outside fields | Switch to decline mode with a required reason;'
    chk hub/README.md '`TopicMessage.withdrawable` and `delivery.withdrawable` are optional additive'
    chk docs/agents/tests.md '`web/test/withdraw.test.ts` owns the authenticated thread → `topic.withdraw`'
    chk docs/agents/tests.md '`web/test/composer.test.ts` owns the authenticated composer → `topic.send` seam:'
    chk docs/agents/tests.md '`web/test/inbox.test.ts` owns the four Now sections through the sealed'
    echo "-- T-1161 C1: stale statements (each must print 0)"
    chk web/README.md 'until the inline-artifact slice'
    chk web/README.md 'Messages are plain sender/time/text blocks'
    chk web/README.md 'Inbox and Events keep their existing stand-ins.'
    echo "-- statements to read against the implementation (candidates for low findings)"
    chk web/README.md 'stand-in lists of remaining hub objects;'
    chk web/README.md 'hub lists supply objects until the snapshot client lands'
    chk web/README.md 'stand-in drawer/pane opens the chosen object.'
    chk web/README.md 'Reply to Inbox sender'
    grep -n -F 'stand-in' web/README.md )
}
k14() {   # QA shell: cleanup of the fixture-owned processes and the scratch root
  for f in "$EV"/E417S3-0[2-8]*.log; do printf '%s ' "$(basename "$f")"; census "$(basename "$f" .log)" | tr '\n' ' '; echo; done
  git -C "$W" status --porcelain | grep -v -x -F '?? node_modules' | wc -l
  echo "$Q"
}
```

Cleanup after the evidence is recorded: print `$Q`, check it begins with `/private/tmp/qa-e417s3-`, and remove it by that literal path with a non-force `rm -r`. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). Sign-in links and cookies are never printed or posted.

## Cases

none. No headless-grid case covers the web Inbox or composer; every check below is a manual check through named test files, the QA probe's Headless Shell page, git greps, the CLI or the docs, recorded with `qa-record.sh note`.

### Web cases (when in scope)

none: no `real-browser` case in this run (see "Out of scope"). Every stage criterion is proven in Chrome Headless Shell against signed-in sealed scratch hubs (E417S3-02 to E417S3-08).

## Manual checks

Record each with `sh .agents/skills/qa/qa-record.sh note E-417 "$RUN" <id> hub-api "<command>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence-file…>` from `$W` in QA's own shell, naming where it ran at the start of the command text (`[QA shell]`, `[test $W]`, `[sealed $W]`, `[docs]`). The recorder takes `hub-api` for every check here; the probe's page steps are Headless Shell observations recorded the same way. Save each check's printed output as `$EV/<id>.txt` (pipe the row's command through `tee`) and name it, with the captures the row wrote, as evidence.

How to run a row, by its `where`:
- **sealed $W**: `quiet && ( . "$Q/env.sh"; cd "$W" && <command> )`.
- **test $W**: in QA's own shell; `nt` runs `quiet` first and seals the test run itself. Judge each by its `exit` line, the TAP summary counts and the named tests on `ok` lines (`oks <id>` lists them; a name that appears on no `ok` line proves nothing).
- **docs** and **QA shell**: in QA's own shell, as QA; the plan reads of E417S3-00 and E417S3-13 are the only checks that touch the live hub, and only to read.

Order: E417S3-00 and the setup; E417S3-01 before any Web file or the probe (every Web file and the probe's web edge serve the bundle it builds); then the rows in id order. Every named test log (`nt`) must show `exit 0`, `# fail 0`, `# cancelled 0`, `# skipped 0`, `# todo 0`, `# pass` equal to `# tests`, no `not ok` and no `# SKIP`; every Web log's `census` prints a first count of at least `1` and a second count of `0`. A `# tests` count that differs from the number at writing must equal the file's own count of `test(` and `t.test(` calls at the build (renames and additions happen; the palette file's viewport loop is the exception, judged by its names); every test named below must appear in `oks`.

| id | surface | where | covers | command | expected |
| --- | --- | --- | --- | --- | --- |
| E417S3-00 | hub-api | QA shell | build, plan, merges, sealing | `k00 \| tee "$EV/E417S3-00.txt"` | Both SHAs equal `$S`; `0` changed paths; the symlink reads `/Users/evgeniyivanov/Projects/cland/v0/node_modules`. The plan lists the stages `thread groundwork`, `message block, runs and asks`, `inbox and composer`, `events, notifications and approvals`; stage `inbox and composer` has `qa` `{scope: "affected", when: "after-stage"}`, `state` not `closed` (it closes only after this verdict and the covers), `items` T-1123, T-1124, T-1125, T-1126, T-1161 plus any findings fixes the request names (nothing else), `total` equal to the number of printed items and `merged` equal to `total`; record the printed line as printed. Under every `== <id>` line exactly one commit line (T-1123 `ac6f75a8`, T-1124 `aecd057d`, T-1125 `a1a62e03`, T-1161 `930712ed` at writing; T-1126 landed after writing, its line names `(T-1126)`); a missing line, T-1126's included, is BLOCKED "T-1126 not on dev". All eleven files listed. Paths outside `web/` and `docs/`: under T-1123 `hub/test/durations.json` and `hub/test/tiers.json`; under T-1124 `.agents/skills/implement/CHANGES`, `.agents/skills/implement/SKILL.md`, `hub/README.md`, `hub/test/tiers.json`, `hub/test/web-keymap.test.ts`; under T-1125 the two skill files, `hub/README.md`, `hub/src/adapters/sessions.ts`, `hub/src/hub/core.ts`, `hub/src/hub/store.test.ts`, `hub/src/protocol.ts`, `hub/test/claude-code-adapter.test.ts`, `hub/test/codex-adapter.test.ts`, `hub/test/human-routing.test.ts`, `hub/test/opencode-adapter.test.ts`, `hub/test/tiers.json`, `hub/test/topic-withdraw.test.ts`, `hub/test/topics-component.test.ts`, `hub/test/topics.test.ts`, `shared/wire/index.ts`; under T-1126 the two skill files, `hub/README.md`, `hub/test/web-keymap.test.ts` (a `hub/test/durations.json` line added by its landing is accepted; record it); under T-1161 nothing. No `nvim/` path under any id; hub or shared source only under T-1125. `TMPDIR` is the system default (not `/tmp`) and `Q` begins `/private/tmp/qa-e417s3-`. Also record the setup's two counts (the first at least `1`, the second `0`) and `probe parses`. Repeat the first two commands after E417S3-14: unchanged (dev not moved) |
| E417S3-01 | hub-api | sealed $W | build | `npm run build > "$EV/E417S3-01.log" 2>&1; echo "build exit $?"; ls web/dist/index.html web/dist/assets; git status --porcelain \| grep -v -x -F '?? node_modules' \| wc -l` | `build exit 0`; `web/dist/index.html` and the `assets` directory listed; `0` changed paths (`web/dist` is ignored) |
| E417S3-02 | hub-api | test $W | T-1123 C1–C5, T-1126 C1–C3 | `nt E417S3-02 web/test/inbox.test.ts; oks E417S3-02; census E417S3-02` | Web, clean (`# tests 16` at writing), census `16` and `0` at writing. `oks` lists "Inbox keeps four ordered sections, newest five rows, oldest wait, live ages and saved folds" (T-1123 C1, C2: headings `Asks and approvals`, `Plan approvals`, `Requests`, `Messages to you`; seven messages show five, `2 more … oldest 7 m`; ages tick locally; three empty sections), "selected request and message unfold, physical d declines to the sender or reads exactly that row" (T-1123 C3: the fake sender receives `human declined`; outcomes `declined` and `read`), "Enter opens an Inbox message at its anchored thread row and a waiting plan in Plan" (T-1123 C4), "the events footer survives four empty sections and follows shared last-look marks and warnings" and "the events footer counts all unread pages including a warning older than the newest 200" (T-1123 C5), "Inbox drawer follows the selected message and physical r replies to its fake sender" (T-1126 C1: the drawer's log shows the row's message inside its viewport while the row keeps focus; `r` focuses the one-line reply (`rows` `1`) addressed to `coord`, also with Split open; the fake sender receives `One line reply receipt` with `reply_to` the row's message), "answered Inbox asks fold until leaving, and a non-Inbox pane focus clears the visit and selection" (T-1126 C2), "A opens seven days of Inbox departures with outcomes and an archive line below empty sections" (T-1126 C3: the answered ask with `answered`, `2 Change`, `human`; an eight-day-old departure absent; four empty sections and the archive line right after the events line), and "asks and approvals share newest-first rows and the selected approval answers with Neovim keys", "Inbox answer keys remain visible through a complete native keyboard scroll in a small viewport", "In Inbox reveals an older-than-five ask through a saved fold and focuses its secondary-pane card", "split approval detail follows revalidation and peer closure after leaving the Inbox visit", "a refused approval race recovers only its exact archived winner and preserves a newer Inbox row", "a fresh epoch recovers an approval answered by a peer while this browser was offline", "held successful read and decline replies preserve newer pushed Inbox rows and counts", "a held approval recovery cannot overwrite a newer same-id TUI authorization delta". The navigation identity "Enter opens an Inbox message …" carries a dated 9.6 s duration allowance (owner E-417, expires 2026-10-30); duration lines are report-only here |
| E417S3-03 | hub-api | test $W | T-1124 C1–C5 | `nt E417S3-03 web/test/composer.test.ts; oks E417S3-03; census E417S3-03` | Web, clean (`# tests 8` at writing), census `8` and `0` at writing. `oks` lists "the composer sends Message, Decision and Question with their kinds in the thread and peer history" (C1), "an item composer addresses the Coordinator by default and @ selects another session from the palette" (C2: the chip reads `coord` and `Coordinator`, the fake Coordinator receives; `@` (physical `Shift+Digit2`) picks `peer`, who receives the next one and the Coordinator does not; removing the chip leaves the hub's addressing), "composer physical Enter, Shift+Enter and Meta+Enter send or break lines and Meta+K keeps the draft" (C3), "tilde attaches an artifact chip and the received message carries the selected artifact" (C4: foreign-topic and archived artifacts not offered), "per-topic drafts survive reload and hub disconnection without replay and writing marks the sent message read" (C5: `readSeq` equals the sent message's `seq`; Send disabled while `Offline`; no `topic.send` frame while offline or on reconnect), and "a pending send survives topic navigation and a real refusal restores text and artifacts before the newer draft", "a held successful receipt keeps newer typing and reload recovers uncertain text without sending it again", "the artifact picker loads older inventory pages before selecting an available topic artifact" |
| E417S3-04 | hub-api | test $W | T-1125 C1–C3 (web) | `nt E417S3-04 web/test/withdraw.test.ts; oks E417S3-04; census E417S3-04` | Web, clean (`# tests 8` at writing: five tests, one with three subtests), census `5` and `0` at writing. `oks` lists "Withdraw restores a queued message before newer typing only after its receipt" (C1: stage `queued`, **Withdrawing** disabled while the receipt is held, one `topic.withdraw` frame, the composer reads `@worker Queued original\nTyped while withdrawing`, stage `withdrawn`, no button, never injected, the next turn intact, the restored text survives reload), "a queued message loses Withdraw when the fake session takes its next turn" (C2: `injected`, no Withdraw, one injection), "one injected recipient removes Withdraw while the broadcast remains queued" (C2: `withdrawable` true at send, then a `delivery` frame `queued` with `withdrawable: false`, Withdraw gone while the stage reads `queued`, a held visibility refresh cannot restore it, reload keeps it gone), "a real withdrawal refusal retains the message with the hub reason in its tooltip" (C3), "withdrawn text stays ahead of a newer pending send on receipt or reload" with its subtests `refused`, `success`, `reload` |
| E417S3-05 | hub-api | test $W | T-1125 hub and wire (`withdrawable`) | `nt E417S3-05a hub/test/topic-withdraw.test.ts; oks E417S3-05a; nt E417S3-05b hub/test/topics-component.test.ts hub/test/human-routing.test.ts hub/src/hub/store.test.ts; oks E417S3-05b` | T2/T1, clean (`# tests 6` and `# tests 41` at writing). `oks E417S3-05a` lists "withdraw removes a busy session message and leaves the next turn intact" (the sent message and its `message` delta carry `withdrawable: true`), "withdraw refuses an injected message, an agent caller and an agent message", "withdraw cannot claim success after an unconfirmed adapter submission" (history `withdrawable: false` and a `delivered` delivery frame with `withdrawable: false` before the refusal) and "a broadcast withdrawal is atomic when one addressee was injected" (the multi-recipient case: history `stage` `queued` with `withdrawable: false`, a `queued` delivery frame with `withdrawable: false`, the refusal names `injected`). `oks E417S3-05b` lists "only a human Question sets the wait, and later Messages do not change its addressee", "the human's kinds survive history and reach a second frame client", "a message from the UI is queued while no session holds the coordinator role, reaches the coordinator as a deliver with the topic, and turns delivered on the ack" (its delivery frame now carries `withdrawable: false`), "a delivery dropped past the TTL moves the stage, and the UI hears it" (a `queued` delivery frame with `withdrawable: true` for the waiting recipient, no non-queued frame), "a human message held for a vacant role goes to the session that takes the role, and its stage follows the ack" and "a withdrawn Question preserves its cleared wait across Store reopen without replay". The T3 files T-1125 changed (`hub/test/topics.test.ts`, the adapter contract parts) are cited from E417S3-13's covers, not run here |
| E417S3-06 | hub-api | test $W | regression of the files the five items changed or share | `nt E417S3-06a web/test/asks.test.ts; oks E417S3-06a; census E417S3-06a; nt E417S3-06b web/test/messages.test.ts; census E417S3-06b; nt E417S3-06c web/test/area-slots.test.ts; census E417S3-06c; nt E417S3-06d web/test/key-contexts.test.ts; oks E417S3-06d; census E417S3-06d; nt E417S3-06e web/test/palette.test.ts; oks E417S3-06e; census E417S3-06e; nt E417S3-06f web/test/topics.test.ts; census E417S3-06f; nt E417S3-06g web/test/folds.test.ts; census E417S3-06g; nt E417S3-06h web/test/shell.test.ts; census E417S3-06h; nt E417S3-06i web/test/connection.test.ts; census E417S3-06i; nt E417S3-06j web/test/thread-runs.test.ts; census E417S3-06j` | Each file clean (`InboxArea.tsx`, `AskCard.tsx`, `ApprovalCard.tsx`, `MessageBlock.tsx`, `Thread.tsx`, `TopicsArea.tsx`, `topic-threads.ts`, `Shell.tsx`, `AreaSlot.tsx`, `Fold.tsx`, `Palette.tsx`, `connection.ts`, `keyboard.ts` and `keymap.ts` changed). At writing: asks `# tests 9` (`oks` lists "an answer in one browser context folds a second context thread and Inbox to the hub outcome within one second" and "a refused competing answer recovers the winner and answering from Inbox marks the topic read through the ask", both now select the Inbox row before acting), messages `5`, area-slots `4`, key-contexts `3` (`oks` lists "declared composer fields own their keys while ordinary fields retain native input"), topics `9`, folds `6`, shell `9`, connection `4`, thread-runs `5`; palette judged by names: `oks` lists "area help and every displayed shell chord work by physical code with Cyrillic key values" (Inbox help now shows `A` and `r`, 20 key labels). **Known flake T-1157** (Topics Retry wait, "a rejected earlier page retries with its old top message anchored", `locator.waitFor: Timeout 3000ms` on the Retry button): if that one case fails, rerun `nt E417S3-06f-rerun web/test/topics.test.ts` once; if the rerun is clean, record the first failure against T-1157 in the row's note (not a finding) and judge the rerun; any other failure, or a second failure, is FAIL |
| E417S3-07 | hub-api | test $W; QA shell | T-1124 C3 keys, T-1126 `r`/`A` keys and the leave rule's Neovim parity, the one key map, the web fallback | `nt E417S3-07 hub/test/web-keymap.test.ts; oks E417S3-07; k07` | T1, clean (`# tests 2` at writing). `oks` lists "focused contexts resolve before shell keys without changing Items or Plan chords" (it asserts composer `⌘Enter` resolves to `composer-send-always` and the `reply` context's Enter to `composer-send` while `@` and `~` resolve to nothing there) and "browser tab/window chords remain unbound and area shortcuts require exact modifiers". `k07`: one line each for the `inbox` (`Shift+KeyA` archive, `KeyR` reply), `inbox-answer`, `reply` and `composer` bindings; then `0` (no Escape binding to an Inbox or composer action); then four lines whose leading count is at least `1` (`2` at writing: each label is declared in two contexts) for the help labels `Show Inbox archive`, `Reply to Inbox sender`, `Decline request or read message`, `Send message`. Neovim: `leave_visit` returns early when the buffer role is `inbox` or `inbox_full`, and otherwise clears `completed` and `M.selected`; the web rule in E417S3-02/E417S3-08 matches it (moving among Inbox rows, drawer and Inbox panes keeps the visit; another area or a non-Inbox pane clears completed rows and the selection). Fallback: one `MessageBlock.tsx` line using `message.withdrawable ?? message.stage === 'queued'` (the old-hub fallback of the 05:12Z decision; the hub's refusal stays authoritative, E417S3-05) |
| E417S3-08 | hub-api | sealed $W | T-1124 C1, C2; T-1125 C1–C3; T-1126 C2, C3; T-1123 C5 (independent probe) | `k08` | `exit 0`, `# tests 1`, `# pass 1`, `# fail 0`, one `Web fixture census: browser group <pid>; before <n>; after 0; scratch hub stopped` line, no `step` line. `seeded` `{item: true, topic: true, worker: true, other: true}`. `kinds`: `chip` naming `qa-coord` and `Coordinator`; `sends` in order `Message`, `Decision`, `Question`, each `header: true`; after Message and after Decision `status: "open"`, `waitingFor: []`; after Question `status: "waiting for agent"`, `waitingFor: ["qa-coord"]` (only the Question makes the topic wait, ask 9a81a158); `afterReply` `{sent: true, status: "open", waitingFor: []}`. `withdraw`: `sentWithdrawable: true`, `queued: "queued"`, `stage: "withdrawn"`, `buttons: 0`, `restored` exactly `"@qa-worker QA queued original\nQA newer typing"` (the withdrawn text back in the composer ahead of the newer typing), `injected: false`. `partial`: `sentWithdrawable: true`, `before: 1`, `frame` `{stage: "queued", withdrawable: false}` (the hub's delta after `qa-other` took its turn), `after: 0` (Withdraw gone), `stage: "queued"` (the aggregate still queued), `history` `{stage: "queued", withdrawable: false}`, `refused` `[false, <error naming qa-other and injected>]`; `single` `{stage: "injected", withdraw: 0}`. `leaveArea`: `received: "Change"` (physical `2` answered option 2), `folded` naming `2 Change` and `human`, `keptInVisit: 1` (still folded with focus on the events line inside the Inbox), `afterReturn: 0`, `selected: 0`. `leavePane`: `received: "Keep"`, `before: 1`, `after: 0` (focusing the Topics pane cleared the primary Inbox pane's folded row), `selected: 0`, `primaryInbox: 1` (the Inbox pane stayed mounted). `archive`: `rows` holding both asks' ids from `leaveArea` and `leavePane`, each text naming the question, `answered`, its outcome (`2 Change` or `1 Keep`) and `human`; `empty: 4` at writing (the four sections empty; any other number: record the sections' rows and judge only that the archive line still shows); `lineVisible: true`; `lineAfterEvents: true`; `archiveClosed: 0` (a second `A` hides it) |
| E417S3-09 | hub-api | sealed $W | typecheck, colour and HTML guards, tiers | `k09` | `typecheck exit 0` with no diagnostic in the log (hub, Neovim, shared wire and web typechecks; the colour, token, HTML and hooks guards: `InboxArea.module.css`, `Composer.module.css`, `MessageBlock.module.css` and `AskCard.module.css` hold no colour value; secondary text keeps 4.5:1); the four guard lines appear (`web HTML: raw-HTML sinks refused; seeded fixtures passed`, `web colours: token-only sources; colour fixtures passed`, `web tokens: <n> text tokens ≥4.5:1 on ground and selection; role colours match hl.lua`, `web hooks: conditional-hook fixture rejected by configured oxlint`); `tiers exit 0`; the three `"Web"` classifications and `"hub/test/topic-withdraw.test.ts": "T2"` print |
| E417S3-10 | hub-api | QA shell | AGENTS.md `web/` rules | `k10 \| tee "$EV/E417S3-10.txt"` | The key-listener grep lists only `web/src/keyboard.ts` (one `document.addEventListener('keydown', …)`, its handler and its removal): no component-local listener in `InboxArea.tsx`, `InboxArchive.tsx`, `Composer.tsx`, `MessageBlock.tsx` or `Thread.tsx`. Storage appears only in `web/src/interface-state.ts` under `cland.ui.<area>.v1` and in `web/src/connection.ts`'s `cland-reload-build` guard; `composer-drafts.ts` reaches storage only through `readInterfaceState`/`writeInterfaceState` (drafts as `cland.ui.draft.<topic>.v1`; no queued send or withdrawal in storage). The raw-HTML grep prints nothing. Under the five ids nothing: no dependency, devDependency or lockfile change |
| E417S3-11 | hub-api | docs | T-1161 C1, C2; docs of the five items | `k11 \| tee "$EV/E417S3-11.txt"` | Every line above the `-- T-1161 C1` marker starts with `1 ` (or more): the Inbox, Composer and Withdraw paragraphs, the `r` and `A` Inbox rows, the four thread/ask key-table rows (T-1161 C2: `Enter`, `za` Toggle agent run; `1`–`9`; `i`, `r`; `d`, each with its context), `hub/README.md`'s `withdrawable` paragraph and the three `docs/agents/tests.md` paragraphs. The three T-1161 C1 lines each start with `0 ` (any `1` is FAIL for T-1161 C1). Then read `web/README.md`'s Inbox, Composer, "Topics and threads", "Area modules and live state", "Split and drawer" and "Palette and keys" sections, `hub/README.md`'s `topic.withdraw` paragraph and the three tests.md paragraphs, and record any statement that contradicts E417S3-02 to E417S3-10 as a **low** finding with file and line (the row stays PASS when the only contradictions are docs ones). Candidates at writing, to confirm or dismiss at the build: the shell paragraph's "stand-in lists of remaining hub objects; E-416 to E-418 replace the remaining lists" (only Events remains a stand-in, named as pending in E-417 stage 4: dismiss if so); the palette paragraph's "until the snapshot client lands" and "The shell’s stand-in drawer/pane opens the chosen object."; and the thread key table, which lists no `r` row although the `thread` context binds `KeyR` to `inbox-reply` with the help label `Reply to Inbox sender` (`Reply to Inbox sender` prints `0`; the Inbox prose names `r` reaching the split reply from the thread) |
| E417S3-12 | hub-api | sealed $W | brief | `cland qa lint qa/briefs/E-417-stage-3.md; echo "exit $?"` | `qa/briefs/E-417-stage-3.md: qa lint passes at the build` and `exit 0` (this brief, committed at the build) |
| E417S3-13 | hub-api | QA shell; the Coordinator's stage covers | stage covers | `(cd "$W" && node hub/bin/cland.ts task plan show E-417) \| tee "$EV/E417S3-13.txt"` and the cover results the request names | QA runs no full suite. The Coordinator owns the stage covers (`cland verify all --occasion stage`): full integrated suites at the tested SHA on Linux (droplet) and macOS (local), which add T3 (among them `hub/test/topics.test.ts` and the adapter contract expectations T-1125 changed) and the Web phase on both platforms and are cited evidence this run does not run. Record the plan's line for this stage exactly as printed; Linux and macOS covers green at the tested SHA, each with its Web phase run (not "Web unavailable"); record each cover's run id, artifact, executor, platform, tiers and phases, wall time and cost as cited evidence. A cover red only on the T-1157 Retry case, with that case passing in E417S3-06, is recorded against T-1157 and judged by the Coordinator's rerun receipt the request names. Any other red cover is FAIL naming its failing tests; a cover not finished when every other check is done: wait for its result in the epic topic; none queued or running at the tested SHA by then: BLOCKED "no stage cover at the tested SHA", reported to the requester |
| E417S3-14 | hub-api | QA shell | cleanup | `k14 \| tee "$EV/E417S3-14.txt"` | Every Web log line prints a first census count of at least `1` and a second of `0` (E417S3-02 to E417S3-04, E417S3-06a to E417S3-06j, E417S3-08; the T1/T2 logs E417S3-05a, E417S3-05b and E417S3-07 print `0 0`, which is expected); `0` changed paths; `$Q` begins `/private/tmp/qa-e417s3-`. Then remove `$Q` and the worktree as "Setup" says |

Re-check helper, file and test names with grep at the tested build: renames happen. A test name pattern matching zero tests passes with exit 0 and "tests 0": read the counts and `oks`, never the exit code alone. The named Web tests and the probe ask the live hub's verify slot for admission themselves (`suite.slot` check): an admission timeout is BLOCKED; retry after `quiet`.

Before requesting QA, run `cland qa lint <brief>` with this filled brief at the build under test. The brief is complete only when qa lint passes at the build.

## Probes that mislead

- Process cleanup probes use a fixture-owned pid/process-group census, registered at launch and checked through exit; a machine-wide `pgrep` counts other sessions too (A-9063 R2; E-413 stage 1/T-1093). Here: each Web fixture's `Web fixture census: browser group <pid>; before <n>; after 0; scratch hub stopped` line, the probe's included.
- Edit existing keys in initialized configs, list standalone-test build prerequisites, enumerate regular files only for file probes, and identify events by seq/id. A second-client check allows only defaults the new client writes itself (A-8634 R12; E-412 stage 2, E-415 stage 3/DoD, E-1006). Here: the probe's frame client and fake spokes only read and send through public frames; the page writes its own drafts.
- Transcript assertions identify stable item/topic/frame ids, with intervals starting at the result frame of the state-changing request. Preserve unaltered captures when correcting a probe and label the correction separately from product failures (A-8634 R13; E-412/E-415/E-1006; A-9063 R2; E-413 stage 1/T-1093). The probe finds messages, asks and frames by the ids their creating requests or frames returned, never by position; its `partial` frame is the first `delivery` for that message with `withdrawable: false`.
- Exact tracker copies replace the initialized tracker directory after its writers stop; copy the committed directory whole, dotfiles included, and compare that same file set. Apply the full `fixtureEnvironment` result after overlays, including synthesized values; under rule 15, check zero credential-prefix names before launching scratch processes and report names/counts only (A-9063 R2; E-413 stage 1/T-1093). This run needs no tracker copy: every scratch project is a fresh Web harness project.
- An accessibility-tree count does not prove visible reachability: a real-browser check scrolls the final row into view and checks its viewport containment (A-9063 R6; T-1095, T-1097). The drawer's "scrolled to the row's message" is judged by E417S3-02's viewport-containment assertion, not by a count; the Inbox small-viewport keyboard case keeps its own containment checks.
- "Busy" is the fake Claude Code harness's state (`fake.busy`/`fake.idle`), not a real turn: a message stays `queued` while its recipient is busy and is injected when the fake goes idle. The aggregate `stage` and `withdrawable` are different facts: after one recipient of a broadcast is injected the stage stays `queued` and `withdrawable` turns false (T-1125's decision); judge Withdraw by the button and the hub's `withdrawable`, never by the stage text alone.
- The leave rule is per Inbox visit: focusing the events line, another Inbox row, the drawer or another Inbox pane keeps the visit, so a folded row still showing there is expected; only another area or a non-Inbox pane ends it. The probe's `afterReturn`/`after` counts are read after the leave, `keptInVisit`/`before` inside it.
- Physical keys are dispatched as `KeyboardEvent`s with the code and a Cyrillic key value (`я`), as the items' tests do, to prove the physical-code map; Playwright's `press` would send the Latin key value too.
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file.
- A "ran" marker grep excludes the configuration echo line.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log: not applicable, QA runs nothing on a droplet. Speed criteria use measured wall times, never projections: this stage has none; the navigation identity's allowance (E417S3-02) is a duration line, report-only here.
- Slots due or queued before the build count even when their results arrive later.
- "No skip": the Web files and the probe need Chrome Headless Shell (local on macOS); a skipped or "Web unavailable" result is BLOCKED, never PASS. Linux runs of the same files are cited from E417S3-13, not run by QA.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

Real Chrome and computer use: out of scope for this run, not BLOCKED, as in stage 2. Every stage criterion is proven in Chrome Headless Shell against signed-in sealed scratch hubs; an anonymous real Chrome at the live edge shows only the offline shell with no Inbox rows, threads or composer, and no sign-in grant exists. The live hub also lacks T-1125's `withdrawable` field until its next restart onto a build containing T-1125; that restart is the Coordinator's under the restart rules and is not part of this run, and no check here reads `withdrawable` from the live hub. So no live-edge build stamp or hub-code gate applies, and the live hub is neither restarted nor rebuilt for this run. Also out of scope: the events view, notifications and approval cards' remaining behaviour (stage `events, notifications and approvals`; this stage's approval rows are judged only through the named Inbox tests); Neovim beyond reading `leave_visit` (E417S3-07); the hub's ask outcome record and departures themselves beyond what the web and the named hub tests show; the epic's Definition of done and its demo, a separate run; work landed on dev after the stage's items, beyond the regression files named here; the T-1157 Retry flake itself (recorded against T-1157 as E417S3-06 says, never a finding of this stage); running a full suite, T3 or a stage cover (E417S3-13 cites the Coordinator's); T4; duration budget lines (report-only); the live project's tracker, hub, crew, `ui.json` and HOME. Stage QA carries no criterion marks.

Nothing else in scope needs an authorization this brief does not give: a check that cannot run for lack of one is BLOCKED, not out of scope.

## Grants

none. No computer use, no real browser, no sign-in. The Headless Shell instances of the Web files and the probe open only their own sealed scratch edges, under the crew browser rule (rule 18). Every other check uses the rule 15 sealed environment with credentials filtered; nothing reads or writes the human's real `~/.cland` or `~/.local/state`.

## Verdict

Fix nothing. Clear only when every check E417S3-00 to E417S3-14 passes (docs contradictions in E417S3-11 beyond T-1161's own C1/C2 lines are low findings and do not block clear; a T-1157 flake handled as E417S3-06 says is no finding). Otherwise not clear, naming the failing, blocked or inconclusive ids and findings. On the epic record one QA verdict with `--stage "inbox and composer"`, the full tested dev SHA, the unique run id and the case table. Stage QA carries no epic criterion marks. Report `qa clear E-417 stage inbox and composer` or `qa not clear E-417 stage inbox and composer` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
