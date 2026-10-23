# Stage QA brief: E-417 stage 2 — message block, runs and asks

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` or `$B:h` as a modifier). The run is local, on macOS (BSD tools; Chrome Headless Shell from the installed `playwright-core`).

## Stage

- Epic: E-417 (Topics, threads and the inbox, under R-377).
- Exact stage name: message block, runs and asks.
- Items, in plan order: one serial lane T-1119, then T-1120, then T-1121, then T-1122. The run reads the stage's members, counts and state from `task plan show E-417` (E417S2-00 and E417S2-13), never from a number written here. Findings fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: the combined changed behaviour of the four items at the tested build. All four change only the web bundle, its tests and docs (`web/`, `docs/agents/tests.md`, `hub/test/tiers.json`, `hub/test/web-keymap.test.ts`): no hub, shared wire or Neovim source changed.
  - T-1119, the message block (P12): `web/src/MessageBlock.tsx` renders the header (sender, role in its colour, addressees, kind, time, delivery stage or waiting state) over the body, the role colour as a 3 px bar in its own gutter, the human's and an Aide's band (an Aide's bar dashed), watch-layer messages dimmed, verdicts with result colour, criterion marks and a failed criterion's note, a clear verdict on one row, local-day separators; `web/src/MarkdownBody.tsx` renders T-1116's parser tokens as React elements (headings, lists, quotes, code with its language label, underlined links opening with `target="_blank"` and `rel="noopener noreferrer"`, whole item ids that open the item and never wrap at the hyphen); raw HTML in a message stays text; posted and attached artifacts, files and folders are chips naming id, kind and title.
  - T-1120, folded runs (P13): messages carrying the hub's `runId` show as one row with the hub's `ThreadRun.foldLine` verbatim; a click, Enter or `za` (thread context `KeyZ KeyA`) opens the run in place with the anchor at its viewport position, pinned at the top while scrolling the open run; the same keys close it; the hub decides membership, so asks, answers, verdicts and human/Aide traffic never fold; message deltas update a closed line and grow an open run; expansion sends no hub command and opens no drawer.
  - T-1121, HTML artifacts inline (P15): a page artifact in a thread renders at 240 px in `web/src/artifacts/SandboxedArtifactFrame.tsx`, `src` the `artifact.url` capability address of the authenticated connection, `sandbox` exactly `allow-scripts` (never `allow-same-origin`, top navigation, popups or forms); the header names it and offers Open full (the address in a new page without an opener) and Open in a pane (full height in the other pane); an unservable page stays a chip with the reason in its tooltip; files and folders stay chips.
  - T-1122, ask cards (P14, P37, P38): `web/src/AskCard.tsx` shows one hub ask as a card in its thread and a row in the Inbox's asks and approvals section; with the card or its thread row focused, physical `1`–`9` answer at once, `i`/`r` focus the free answer, `d` turns it into a required reason with a red Decline (disabled until a reason is typed), Answer instead turns it back; Escape never answers or declines; pending until the hub's receipt; a failure keeps the draft; an answer from any client folds both views to the hub's outcome (option or text, who, when); a refused competing answer folds to the winner; answering marks the topic read through the ask in the hub; a declined ask leaves its topic open; the thread's In Inbox link opens the Inbox row. The other Inbox kinds keep their stand-in rows (stage 3).
- Decision governing E-417 (Coordinator, ask 9a81a158, comment on E-417 at 15:17Z 2026-10-22, per spec §3.4): only a human Question leaves the topic waiting for its addressee; a human Message or Decision does not. In this stage it bears on the header's waiting state and on T-1122 C4 (a decline leaves the topic open).

Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

Criteria map (the stage verdict carries no item or epic marks; this tells the run which check proves what):

| criterion | proven by |
| --- | --- |
| T-1119 C1 (P12 header over the body; role colour as a 3 px bar in its own gutter) | E417S2-02 |
| T-1119 C2 (human band, watch layer dimmed, not-clear verdict with marks and the failed criterion's note) | E417S2-02 |
| T-1119 C3 (Markdown elements; links open outside the page; HTML in a message is text, no element from it in the DOM) | E417S2-02, E417S2-08 (`markdown`), E417S2-10 |
| T-1119 C4 (item ids are links that open the item and stay on one line; artifact, file and folder chips) | E417S2-02, E417S2-08 (`markdown`) |
| T-1120 C1 (the hub's fold line; Enter, click or `za` opens in place with the anchor kept) | E417S2-03, E417S2-07 |
| T-1120 C2 (open run's anchor pinned at the top; the same keys close it) | E417S2-03 |
| T-1120 C3 (ask, verdict, answer and message to the human stay unfolded; a new run message updates the fold line) | E417S2-03 |
| T-1121 C1 (240 px iframe, `sandbox` exactly `allow-scripts`, source the hub's artifact address) | E417S2-04, E417S2-08 (`sandbox`), E417S2-10 |
| T-1121 C2 (the artifact's script cannot read the workbench page or navigate the top window) | E417S2-04, E417S2-08 (`sandbox`) |
| T-1121 C3 (Open full in a new page; Open in a pane in the other pane) | E417S2-04 |
| T-1122 C1 (card in the thread and row in the Inbox with the same question and options; `2` answers with option 2 as the fake asker receives it) | E417S2-05, E417S2-08 (`ask`) |
| T-1122 C2 (answered in one browser context, folds to one line with option, who and when in a second context's thread and Inbox within a second) | E417S2-05, E417S2-08 (`ask`, the thread half) |
| T-1122 C3 (Escape leaves it open; `d` makes a reason field with Decline disabled until a reason; Answer instead turns it back) | E417S2-05, E417S2-08 (`ask`) |
| T-1122 C4 (a decline with a reason reaches the fake asker as `declined` with that reason; the topic stays open) | E417S2-05 |
| T-1122 C5 (a refused competing answer folds to the winner's outcome; an answer marks the topic read up to the ask) | E417S2-05, E417S2-08 (`ask`, the hub's refusal) |

Docs (no criterion of its own in these items): the `web/README.md` sections of the four items and `docs/agents/tests.md` are read by E417S2-11, which records contradictions with the implementation as low findings.

Definition-of-done pointer (no marks): E-417 C1 (the message block of P12 with Markdown, role colours, the human's band, verdicts and artifact chips) is exercised by E417S2-02 and E417S2-08; C2 (folded runs) by E417S2-03; C3 (asks in two places with one state) by E417S2-05 and E417S2-08 as far as this stage builds it (the full inbox is stage 3); C7 (HTML artifacts inline, sandboxed; files and folders chips) by E417S2-04 and E417S2-08. C4, C5, C6 and C8 are later stages.

## Build

Use a clean detached worktree at dev at the SHA in the request (the full 40-hex SHA), created below. HEAD must equal that SHA and refs/heads/dev before and after running. All listed items must have merged onto dev: for every member that `task plan show E-417` lists in stage `message block, runs and asks`, `git log --first-parent --oneline --grep "Item: <id>" dev` prints exactly one commit. At writing they landed as T-1119 `d1534f1f`, T-1120 `535012cf`, T-1121 `b1be9c1c` and T-1122 `269ea26f`; every expectation below was read from dev at `269ea26f`. Dev may carry work landed after these items that is outside this stage; it is not judged here. A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no commit of its own or run id on purpose: committing a brief changes the tested tree. Re-check test names, labels and docs strings with grep at the tested build.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step (the setup below does; the clean-tree checks ignore that one entry). Run E417S2-01's web build before any Web file or the probe, or the shell never renders. The browser is the suite's Chrome Headless Shell under `node_modules/playwright-core/.local-browsers`: each named Web test file and the QA probe start and close their own through the Web harness (`web/test/harness.ts`, `webFixture`). No real browser and no other GUI process starts. The live hub is touched only by `quiet`, the Web harness's own read-only admission check and the plan reads of E417S2-00 and E417S2-13; no live-edge bundle, root rebuild or hub restart is needed (the stage changed no hub code, and real Chrome is out of scope, see "Out of scope").

## Setup (once, before E417S2-00)

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree, runs `quiet`, the plan reads, reads the captures and records every check with `qa-record.sh`. **Every other command runs sealed** (rule 15) inside a subshell that sources `$Q/env.sh`: the full `fixtureEnvironment` result (`test-support/fixture-environment.ts`) after the scratch overlays (its synthesized HOME, XDG, Git, account and fake-harness paths included), which drops every `CLAND_*`, `GIT_*`, `XDG_*`, `CLAUDE_*`, `CODEX_*`, `FAKE_*`, provider and account variable while keeping `PATH`, `SHELL`, `TERM` and `TMPDIR`. Leave `TMPDIR` at the system default (on macOS `/var/folders/...`; never `/tmp`, T-1030). Never use `env -i`. The scratch root lives under `/private/tmp/qa-e417s2-` (its realpath). Never the live project's hub for anything but the reads named above and `quiet`; never the human's HOME, `~/.cland`, `~/.claude`, `~/.codex` or `~/.local/state`. Fixtures are fake only: the Web harness's sealed scratch projects and hubs with in-process fake adapters, fake spokes as senders and the fake Coordinator asker; no real session, account or provider binary.

In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<the full dev SHA from the request>
RUN=qa-s2-$(date +%F)-1                        # unique run id for E-417; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e417s2-$RUN           # the clean detached build
EV=$R/.cland/qa/E-417/$RUN                     # captures (qa-record.sh keeps its evidence here too)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
Q=$(cd "$(mktemp -d /tmp/qa-e417s2-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/qa-e417s2-…
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

The QA probe. `$Q/probe.test.mjs` is a one-test `node --test` file, independent of the items' own tests: one sealed scratch project and hub through the Web harness (`webFixture`: `tempProject` under the system `TMPDIR`, `projectHub` with in-process fake adapters, the production socket and web edge serving `$W/web/dist`, a Headless Shell context at 1440×900 signed in through a minted link), a fake Coordinator asker (`inProcessSpoke`, role coordinator, name `qa-coord`) and the local human frame client. It seeds one hostile Markdown message from the human, one page artifact whose script tries the workbench and the top window, and one ask from `qa-coord` (options `Left`, `Right`, `Stay`, free answer allowed); then context A reads the message and the frame, and a second context B (its own minted link) watches the ask while A answers it with physical keys. It asserts nothing about the product: every fact goes to `$QA_OUT` as one JSON line; a step that throws writes `{"step":{name,error}}` and the probe goes on. The Web fixture's own cleanup writes the census line.

```sh
cat > "$Q/probe.test.mjs" <<'JS'
// QA probe for E-417 stage 2 (node --test, sealed, cwd $QA_W): one sealed scratch hub through the Web harness, Headless
// Shell contexts signed in by minted links, a fake Coordinator asker. It asserts nothing about the product: every fact
// goes to $QA_OUT as one JSON line {"fact": value}; a step that throws writes {"step": {name, error}} and the probe goes on.
import test from 'node:test';
import { appendFileSync } from 'node:fs';
const W = process.env.QA_W, OUT = process.env.QA_OUT;
const { webFixture } = await import(`${W}/web/test/harness.ts`);
const { connectUi, inProcessSpoke } = await import(`${W}/hub/test/harness.ts`);
const { askHubFrame } = await import(`${W}/hub/src/cli/socket-client.ts`);
const out = (key, value) => appendFileSync(OUT, `${JSON.stringify({ [key]: value })}\n`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function step(name, body) { try { await body(); } catch (error) { out('step', { name, error: String(error?.message ?? error).slice(0, 400) }); } }
async function general(page) {
  if (!(await page.getByRole('log', { name: 'General thread', exact: true }).count())) {
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    await page.locator('[data-object-id="general"]').click();
  }
  const thread = page.getByRole('log', { name: 'General thread', exact: true });
  await thread.locator('[data-message-id]').first().waitFor();
  return thread;
}
const HOSTILE = '## QA heading\n\n- one\n- two\n\n```sh\necho "<b>kept</b>"\n```\n\nSee [QA docs](https://example.invalid/qa) and T-1\n\nQA raw: <img src=x onerror="document.title=1"> <script>window.qaRan=1</script> <iframe src="https://example.invalid/f"></iframe> <a href="https://example.invalid/raw">raw anchor</a> [run](javascript:document.title=3) ![i](https://example.invalid/i.png)';
const PAGE = `<p id="r">pending</p><script>
  const r = {};
  try { r.read = String(parent.document.title); } catch (e) { r.read = e.name; }
  try { r.cookie = String(parent.document.cookie); } catch (e) { r.cookie = e.name; }
  try { top.location.href = '/qa-escaped'; r.navigate = 'no error'; } catch (e) { r.navigate = e.name; }
  try { r.popup = String(window.open('/qa-popup') === null); } catch (e) { r.popup = e.name; }
  document.getElementById('r').textContent = JSON.stringify(r);
</script>`;
test('E-417 stage 2 QA probe', { timeout: 240000 }, async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const coord = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'qa-coord', role: 'coordinator', sessionId: 'qa-e417s2-coord' });
  await coord.waitForPresence(['qa-coord']);
  const sent = await ui.request({ type: 'topic.send', topic: 'general', text: HOSTILE });
  const hostile = sent.value?.message?.id;
  const made = await ui.request({ type: 'artifact.create', topic: 'general', kind: 'page', title: 'QA hostile page', content: PAGE });
  const page = made.value?.artifact?.id;
  const asked = await coord.call('ask', { topic: 'general', question: 'QA which way?', options: ['Left', 'Right', 'Stay'], free: true });
  const ask = asked.ask;
  out('seeded', { sent: sent.ok, artifact: made.ok, ask: asked.ok });
  await fixture.pageCase(t, async (A, origin) => {
    let dialogs = 0, popups = 0;
    A.on('dialog', d => { dialogs++; void d.dismiss(); });
    A.context().on('page', () => { popups++; });
    const title0 = await A.title();
    await step('markdown', async () => {
      const thread = await general(A);
      const m = thread.locator(`[data-message-id="${hostile}"]`);
      await m.waitFor();
      const text = await m.innerText();
      out('markdown', {
        heading: await m.getByRole('heading', { name: 'QA heading', exact: true }).count(),
        items: await m.locator('ul li').allTextContents(),
        code: await m.locator('pre code').innerText(), language: await m.locator('[data-code-language]').innerText(),
        links: await m.locator('a').evaluateAll(ns => ns.map(n => [n.textContent, n.getAttribute('href'), n.getAttribute('target'), n.getAttribute('rel')])),
        literal: ['<img src=x onerror="document.title=1">', '<script>window.qaRan=1</script>', '<iframe src="https://example.invalid/f"></iframe>', '<a href="https://example.invalid/raw">raw anchor</a>', '[run](javascript:document.title=3)', '![i](https://example.invalid/i.png)'].map(s => text.includes(s)),
        elements: await m.locator('img, script, iframe, object, embed, b').count(),
        ran: await A.evaluate(() => 'qaRan' in window), titleUnchanged: (await A.title()) === title0,
      });
    });
    await step('sandbox', async () => {
      const thread = await general(A);
      const box = thread.locator(`[data-artifact-id="${page}"]`);
      const frame = box.locator('iframe');
      await frame.waitFor();
      const before = A.url();
      const receipt = frame.contentFrame().locator('#r');
      for (let i = 0; i < 50 && (await receipt.innerText()) === 'pending'; i++) await sleep(100);
      await sleep(500);
      const src = await frame.getAttribute('src');
      out('sandbox', {
        sandbox: await frame.getAttribute('sandbox'), srcdoc: await frame.getAttribute('srcdoc'), sameOrigin: new URL(src).origin === origin,
        path: /^\/a\/[a-f0-9]{64}\//.test(new URL(src).pathname), height: await frame.evaluate(n => n.getBoundingClientRect().height),
        header: await box.locator('header').innerText(), receipt: JSON.parse(await receipt.innerText()),
        topUnchanged: A.url() === before, popups, dialogs,
      });
    });
    await step('ask', async () => {
      const context = await fixture.browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
      context.setDefaultTimeout(5000);
      try {
        const { url } = await askHubFrame(fixture.hub.discovery, { type: 'web.link' }, 3000, {});
        const B = await context.newPage();
        await B.goto(url);
        const bCard = (await general(B)).locator(`[data-ask-id="${ask}"]`);
        await bCard.waitFor();
        const card = (await general(A)).locator(`[data-ask-id="${ask}"]`);
        await card.waitFor();
        const options = await card.locator('[data-ask-option]').allTextContents();
        await card.focus();
        await A.keyboard.press('Escape');
        await sleep(500);
        const afterEscape = await card.getAttribute('data-ask-state');
        await card.focus();
        await A.keyboard.press('KeyD');
        const decline = card.getByRole('button', { name: 'Decline', exact: true });
        await decline.waitFor();
        const declineDisabled = await decline.isDisabled();
        await card.getByRole('button', { name: 'Answer instead', exact: true }).click();
        const declineAfterBack = await decline.count();
        await card.focus();
        const pressedAt = Date.now();
        await A.keyboard.press('Digit2');
        await bCard.locator('[data-ask-outcome]').waitFor();
        const bMs = Date.now() - pressedAt;
        await sleep(1000);
        const events = (coord.events ?? []).map(e => e.params?.content).filter(Boolean);
        out('ask', {
          options, afterEscape, declineDisabled, declineAfterBack, bMs,
          a: { state: await card.getAttribute('data-ask-state'), outcome: await card.locator('[data-ask-outcome]').innerText(), text: await card.innerText(), controls: await card.locator('button, input, textarea').count() },
          b: { state: await bCard.getAttribute('data-ask-state'), outcome: await bCard.locator('[data-ask-outcome]').innerText(), text: await bCard.innerText(), time: await bCard.locator('time').getAttribute('datetime'), controls: await bCard.locator('button, input, textarea').count() },
          askerReceived: events.filter(c => c.includes('Right')),
          competing: await ui.request({ type: 'topic.answer', ask, option: 3 }).then(r => [r.ok, r.error ?? null]),
        });
      } finally { await context.close(); }
    });
  });
});
JS
node --check "$Q/probe.test.mjs" && echo "probe parses"
```

The check functions. Define them in QA's own shell (paste the block once). Each runs where its table row says, writes its captures under `$EV` and prints the facts the `expected` column judges.

```sh
k00() {   # QA shell: build, merges, plan, the stage's files, no hub code, sealing
  git -C "$W" rev-parse HEAD refs/heads/dev
  git -C "$W" status --porcelain | grep -v -x -F '?? node_modules' | wc -l
  readlink "$W/node_modules"
  (cd "$W" && node hub/bin/cland.ts task plan show E-417 --json) > "$EV/E417S2-00-plan.json"
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=v.stages.find(x=>x.name==="message block, runs and asks");console.log(JSON.stringify({stages: v.stages.map(x=>x.name), state: s.state, qa: s.qa, merged: s.merged, total: s.total, items: s.items}))' "$EV/E417S2-00-plan.json" | tee "$EV/E417S2-00-stage.txt"
  for i in $(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).stages.find(x=>x.name==="message block, runs and asks").items.join(" "))' "$EV/E417S2-00-plan.json"); do echo "== $i"; git -C "$W" log --first-parent --oneline --grep "Item: $i" dev; done
  ls "$W/web/src/MessageBlock.tsx" "$W/web/src/MarkdownBody.tsx" "$W/web/src/AskCard.tsx" "$W/web/src/InboxArea.tsx" "$W/web/src/artifacts/InlineArtifact.tsx" "$W/web/src/artifacts/SandboxedArtifactFrame.tsx" "$W/web/test/messages.test.ts" "$W/web/test/thread-runs.test.ts" "$W/web/test/thread-artifacts.test.ts" "$W/web/test/asks.test.ts"
  for i in T-1119 T-1120 T-1121 T-1122; do c=$(git -C "$W" log --first-parent --format=%H --grep "Item: $i" dev); echo "== $i paths outside web/ and docs/"; git -C "$W" show --format= --name-only "$c" | grep -v -E '^(web/|docs/)'; done
  echo "TMPDIR=$TMPDIR Q=$Q"
}
k07() {   # QA shell: the key map of runs and asks at the build
  grep -n -F "'KeyZ KeyA': 'thread-toggle'" "$W/web/src/keymap.ts"
  grep -n -F "KeyD: 'ask-decline', KeyI: 'ask-free', KeyR: 'ask-free', Digit1: 'ask-1'" "$W/web/src/keymap.ts"
  grep -c -E "Escape: '(ask-|thread-toggle)" "$W/web/src/keymap.ts"
  grep -n -F "{ action: 'thread-toggle', label: 'Toggle agent run' }" "$W/web/src/keymap.ts"
  grep -n -F "{ action: 'ask-decline', label: 'Decline with a reason' }" "$W/web/src/keymap.ts"
}
k08() {   # sealed, in $W: the QA probe (one Headless Shell scratch hub; facts to $EV/E417S2-08.jsonl)
  : > "$EV/E417S2-08.jsonl"                    # start the fact file empty
  ( cd "$QA_W" && QA_OUT="$EV/E417S2-08.jsonl" node --test --test-reporter=tap "$QA_Q/probe.test.mjs" > "$EV/E417S2-08.log" 2>&1; echo "exit $?" >> "$EV/E417S2-08.log" )
  tail -n 1 "$EV/E417S2-08.log"; grep -E '^# (tests|pass|fail) |Web fixture census' "$EV/E417S2-08.log"
  cat "$EV/E417S2-08.jsonl"
}
k09() {   # sealed, in $W: the full typecheck with the web guards, the tier lint and the stage's classifications
  ( cd "$QA_W" && npm run typecheck > "$EV/E417S2-09.log" 2>&1; echo "typecheck exit $?"; node hub/test/lint-tiers.ts > "$EV/E417S2-09-tiers.log" 2>&1; echo "tiers exit $?" )
  grep -F -e 'web HTML: raw-HTML sinks refused; seeded fixtures passed' -e 'web colours: token-only sources; colour fixtures passed' -e 'web tokens:' -e 'web hooks: conditional-hook fixture rejected by configured oxlint' "$EV/E417S2-09.log"
  grep -F -e '"web/test/messages.test.ts": "Web"' -e '"web/test/thread-runs.test.ts": "Web"' -e '"web/test/thread-artifacts.test.ts": "Web"' -e '"web/test/asks.test.ts": "Web"' "$QA_W/hub/test/tiers.json"
}
k10() {   # QA shell: AGENTS.md web/ rules and the sandbox at the build
  git -C "$W" grep -n -E "keydown|keyup|keypress|onKey(Down|Up|Press)" -- web/src
  git -C "$W" grep -n -E "localStorage|sessionStorage" -- web/src
  git -C "$W" grep -n -E "dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML" -- web/src
  echo "-- sandbox attributes"; git -C "$W" grep -n -E "sandbox=" -- web/src
  echo "-- forbidden sandbox tokens and srcdoc"; git -C "$W" grep -n -i -E "allow-same-origin|allow-top-navigation|allow-popups|allow-forms|srcdoc" -- web/src
  echo "-- new-tab links"; git -C "$W" grep -n -F 'target="_blank"' -- web/src
  for i in T-1119 T-1120 T-1121 T-1122; do c=$(git -C "$W" log --first-parent --format=%H --grep "Item: $i" dev); echo "== $i"; git -C "$W" show --format= "$c" -- package.json package-lock.json web/package.json hub/package.json nvim/package.json | grep -E '^[+-] '; done
}
k11() {   # docs, in QA's own shell
  ( cd "$W" || exit 1
    chk() { printf '%s present %s: %s\n' "$(grep -c -F -- "$2" "$1")" "$1" "$2"; }
    chk web/README.md '`MessageBlock.tsx` renders the P12 message header, the 3 px role gutter, the'
    chk web/README.md 'links underlined and opened using `_blank` and `noopener noreferrer`. Whole item'
    chk web/README.md 'tokens use the shared item navigation and never wrap at the hyphen; code stays'
    chk web/README.md 'The thread groups only messages carrying the hub'
    chk web/README.md '`ThreadRun.foldLine` verbatim. A click, Enter or `za` opens or closes the run in'
    chk web/README.md 'and human/Aide traffic; the browser does not infer membership.'
    chk web/README.md '`sandbox="allow-scripts"` alone. Its header names the artifact; Open full follows'
    chk web/README.md 'page remains a chip with the serving reason in its tooltip.'
    chk web/README.md '`AskCard.tsx` renders the same hub ask in a thread and in the Inbox'
    chk web/README.md 'never answers or declines.'
    chk web/README.md 'Answers use the human `topic.answer` frame, whose durable hub record supplies the'
    chk web/README.md 'already marks the topic read in the hub; the browser sends no extra broad read.'
    chk docs/agents/tests.md '`web/test/messages.test.ts` owns the authenticated history/delta'
    chk docs/agents/tests.md '`web/test/thread-runs.test.ts` owns the hub-history/delta'
    chk docs/agents/tests.md '`web/test/thread-artifacts.test.ts` owns the authenticated thread'
    chk docs/agents/tests.md '`web/test/asks.test.ts` owns the shared ask-card seam through the sealed'
    echo "-- statements to read against the implementation (candidates for low findings)"
    chk web/README.md 'including folder and HTML artifacts until the inline-artifact slice.'
    chk web/README.md 'Messages are plain sender/time/text blocks with item links in this slice.'
    chk web/README.md 'Inbox and Events keep their existing stand-ins.'
    grep -n -E "Toggle agent run|Decline with a reason|Answer with option" web/README.md )
}
k14() {   # QA shell: cleanup of the fixture-owned processes and the scratch root
  for f in "$EV"/E417S2-0[2-8]*.log; do printf '%s ' "$(basename "$f")"; census "$(basename "$f" .log)" | tr '\n' ' '; echo; done
  git -C "$W" status --porcelain | grep -v -x -F '?? node_modules' | wc -l
  echo "$Q"
}
```

Cleanup after the evidence is recorded: print `$Q`, check it begins with `/private/tmp/qa-e417s2-`, and remove it by that literal path with a non-force `rm -r`. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). Sign-in links and cookies are never printed or posted.

## Cases

none. No headless-grid case covers the web thread; every check below is a manual check through named test files, the QA probe's Headless Shell page, git greps, the CLI or the docs, recorded with `qa-record.sh note`.

### Web cases (when in scope)

none: no `real-browser` case in this run (see "Out of scope"). Every stage criterion is proven in Chrome Headless Shell against signed-in sealed scratch hubs (E417S2-02 to E417S2-08).

## Manual checks

Record each with `sh .agents/skills/qa/qa-record.sh note E-417 "$RUN" <id> hub-api "<command>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence-file…>` from `$W` in QA's own shell, naming where it ran at the start of the command text (`[QA shell]`, `[test $W]`, `[sealed $W]`, `[docs]`). The recorder takes `hub-api` for every check here; the probe's page steps are Headless Shell observations recorded the same way. Save each check's printed output as `$EV/<id>.txt` (pipe the row's command through `tee`) and name it, with the captures the row wrote, as evidence.

How to run a row, by its `where`:
- **sealed $W**: `quiet && ( . "$Q/env.sh"; cd "$W" && <command> )`.
- **test $W**: in QA's own shell; `nt` runs `quiet` first and seals the test run itself. Judge each by its `exit` line, the TAP summary counts and the named tests on `ok` lines (`oks <id>` lists them; a name that appears on no `ok` line proves nothing).
- **docs** and **QA shell**: in QA's own shell, as QA; the plan reads of E417S2-00 and E417S2-13 are the only checks that touch the live hub, and only to read.

Order: E417S2-00 and the setup; E417S2-01 before any Web file or the probe (every Web file and the probe's web edge serve the bundle it builds); then the rows in id order. Every named test log (`nt`) must show `exit 0`, `# fail 0`, `# cancelled 0`, `# skipped 0`, `# todo 0`, `# pass` equal to `# tests`, no `not ok` and no `# SKIP`; every Web log's `census` prints a first count of at least `1` and a second count of `0`. A `# tests` count that differs from the number at writing must equal the file's own count of `test(` and `t.test(` calls at the build (renames and additions happen); every test named below must appear in `oks`.

| id | surface | where | covers | command | expected |
| --- | --- | --- | --- | --- | --- |
| E417S2-00 | hub-api | QA shell | build, plan, merges, sealing | `k00 \| tee "$EV/E417S2-00.txt"` | Both SHAs equal `$S`; `0` changed paths; the symlink reads `/Users/evgeniyivanov/Projects/cland/v0/node_modules`. The plan lists the stages `thread groundwork`, `message block, runs and asks`, `inbox and composer`, `events, notifications and approvals`; stage `message block, runs and asks` has `qa` `{scope: "affected", when: "after-stage"}`, `state` not `closed` (it closes only after this verdict and the covers), `items` T-1119, T-1120, T-1121, T-1122 plus any findings fixes the request names (nothing else), `total` equal to the number of printed items and `merged` equal to `total`; record the printed line as printed. Under every `== <id>` line exactly one commit line (T-1119 `d1534f1f`, T-1120 `535012cf`, T-1121 `b1be9c1c`, T-1122 `269ea26f` at writing; a missing line is BLOCKED). All ten files listed. Under each `paths outside web/ and docs/` line only `hub/test/tiers.json` and, under T-1120, `hub/test/web-keymap.test.ts` (no hub, shared or Neovim source). `TMPDIR` is the system default (not `/tmp`) and `Q` begins `/private/tmp/qa-e417s2-`. Also record the setup's two counts (the first at least `1`, the second `0`) and `probe parses`. Repeat the first two commands after E417S2-14: unchanged (dev not moved) |
| E417S2-01 | hub-api | sealed $W | build | `npm run build --workspace web > "$EV/E417S2-01.log" 2>&1; echo "build exit $?"; ls web/dist/index.html web/dist/assets; git status --porcelain \| grep -v -x -F '?? node_modules' \| wc -l` | `build exit 0`; `web/dist/index.html` and the `assets` directory listed; `0` changed paths (`web/dist` is ignored) |
| E417S2-02 | hub-api | test $W | T-1119 C1–C4 | `nt E417S2-02 web/test/messages.test.ts; oks E417S2-02; census E417S2-02` | Web, clean (`# tests 5` at writing), census `5` and `0` at writing. `oks` lists "P12 headers show sender role addressees kinds time and delivery in a separate colour gutter" (C1), "P12 bands and watch verdicts preserve durable criterion facts" (C2: human and Aide band, dashed Aide gutter, watch layer `data-layer="watch"` in `--text-soft`, `review not clear` in red with `✗ C2 failed` and its note, a clear verdict green on one row), "message Markdown renders safe elements with message-local fences and literal HTML" (C3: heading, lists, quote, fenced code with `ts` label, links `_blank` / `noopener noreferrer` underlined, `<script>`, `<img>`, `<button>` as text with no such element, `messageExecuted` never set, no request to the linked host), "whole item links navigate without wrapping and posted or attached files and folders stay chips" and "agent clear reports retain target navigation in their one-row summary" (C4) |
| E417S2-03 | hub-api | test $W | T-1120 C1–C3 | `nt E417S2-03 web/test/thread-runs.test.ts; oks E417S2-03; census E417S2-03` | Web, clean (`# tests 5` at writing), census `5` and `0` at writing. `oks` lists "hub fold lines open and close in place by click Enter and za" (C1, C2's close), "an open run keeps its anchor pinned while scrolling its messages" (C2), "a paged run keeps its full hub count and the first open message anchored on prepend" (C1's anchor across paging), "protected messages stay unfolded and live growth replaces the hub fold line" (C3), "expanding and collapsing reschedule visible read marks for the displayed run" |
| E417S2-04 | hub-api | test $W | T-1121 C1–C3 | `nt E417S2-04 web/test/thread-artifacts.test.ts; oks E417S2-04; census E417S2-04` | Web, clean (`# tests 5` at writing), census `5` and `0` at writing. `oks` lists "HTML artifacts render their hub address inline at 240 px while files and folders stay chips" (C1: `src` an `artifact.url` reply of this connection under `/a/<64 hex>/`, `sandbox` `allow-scripts`, no `srcdoc`, 240 px, file and folder chips with no iframe), "artifact scripts cannot read the workbench document or navigate its top window" (C2: `{"read":"SecurityError","navigate":"SecurityError"}`, the page URL unchanged), "Open full opens the artifact address in a new page and Open in a pane keeps the thread beside it" (C3: same address, `window.opener` null, the other pane's frame sandboxed and taller than 240 px, the thread kept), "an unservable HTML artifact remains a chip with the serving reason in its tooltip", "moving a thread-opened page into a folder does not resurrect a top-level artifact" |
| E417S2-05 | hub-api | test $W | T-1122 C1–C5 | `nt E417S2-05 web/test/asks.test.ts; oks E417S2-05; census E417S2-05` | Web, clean (`# tests 9` at writing), census `9` and `0` at writing. `oks` lists "an ask shares its question and options in thread and Inbox and physical 2 delivers option 2" (C1), "an answer in one browser context folds a second context thread and Inbox to the hub outcome within one second" (C2: two independently signed-in contexts, both views folded to `2 Change` with who and time, no controls, one line, under 1 s after the receipt), "Escape leaves an ask open and d requires a reason, allows Answer instead and delivers a decline" (C3, C4: `declined: Wait for QA` at the fake asker; the topic not closed), "a refused competing answer recovers the winner and answering from Inbox marks the topic read through the ask" (C5), and "a failed free answer keeps its draft, stays pending until receipt and can be retried", "the thread ask links to its Inbox row and thread-row focus answers with physical keys", "offline asks disable writes and a fresh snapshot recovers an answer without replaying a draft", "a refused answer recovers its durable outcome beyond the seven-day archive without replacing newer Inbox rows", "In Inbox from a secondary thread opens and focuses that pane list while the primary thread keeps its ask" |
| E417S2-06 | hub-api | test $W | regression of the files the four items changed or share | `nt E417S2-06a web/test/topics.test.ts; oks E417S2-06a; census E417S2-06a; nt E417S2-06b web/test/folds.test.ts; census E417S2-06b; nt E417S2-06c web/test/area-slots.test.ts; census E417S2-06c; nt E417S2-06d web/test/key-contexts.test.ts; census E417S2-06d; nt E417S2-06e web/test/palette.test.ts; oks E417S2-06e; census E417S2-06e; nt E417S2-06f web/test/shell.test.ts; census E417S2-06f; nt E417S2-06g web/test/connection.test.ts; census E417S2-06g; nt E417S2-06h web/test/artifacts.test.ts; census E417S2-06h` | Each file clean with the counts above (`Thread.tsx`, `TopicsArea.tsx`, `use-topic-read.ts`, `Shell.tsx`, `AreaSlot.tsx`, `AreaObjects.tsx`, `InboxArea.tsx`, `connection.ts`, `keyboard.ts`, `keymap.ts` and the shared artifact viewer changed). Topics (`# tests 9` at writing): `oks` lists "live messages and ask outcomes replace thread facts without another history or topic-list read" and "held history pages retain live messages, newer ask state and the scrolling anchor" (both now read the card's `data-ask-state` attribute and `data-ask-outcome` `2 Second` / `2 Two`), "300 messages open at the end and page backwards without gaps, repeats or a moving anchor" and "read marks wait one visible second and never include offscreen messages or a hidden page". **Known flake T-1157** (Topics Retry wait, "a rejected earlier page retries with its old top message anchored", `locator.waitFor: Timeout 3000ms` on the Retry button): if that one case fails, rerun `nt E417S2-06a-rerun web/test/topics.test.ts` once; if the rerun is clean, record the first failure against T-1157 in the row's note (not a finding) and judge the rerun; any other failure, or a second failure, is FAIL. Palette: `oks` lists "area help and every displayed shell chord work by physical code with Cyrillic key values" |
| E417S2-07 | hub-api | test $W; QA shell | T-1120 C1 (`za`, Enter), T-1122 (ask keys), the one key map | `nt E417S2-07 hub/test/web-keymap.test.ts hub/test/web-markdown.test.ts hub/test/web-area-state.test.ts; oks E417S2-07; k07` | T1, clean. `oks` lists "focused contexts resolve before shell keys without changing Items or Plan chords" (it now asserts thread `Enter` and `KeyZ` then `KeyA` resolve to `thread-toggle`, `⌘Enter` to `open-other`, and `za` does nothing in Topics), "browser tab/window chords remain unbound and area shortcuts require exact modifiers", and the seven parser tests, among them "HTML, images and unsafe or unsupported link destinations remain literal text". `k07`: one line each for the thread `'KeyZ KeyA': 'thread-toggle'` binding, the ask context's `KeyD`/`KeyI`/`KeyR`/`Digit1` bindings, then `0` (no Escape binding to an ask action or the run toggle: Escape never answers or declines), then one line each for the help labels `Toggle agent run` and `Decline with a reason` |
| E417S2-08 | hub-api | sealed $W | T-1119 C3, C4; T-1121 C1, C2; T-1122 C1, C2, C3, C5 (independent probe) | `k08` | `exit 0`, `# tests 1`, `# pass 1`, `# fail 0`, one `Web fixture census: browser group <pid>; before <n>; after 0; scratch hub stopped` line, no `step` line. `seeded` `{sent: true, artifact: true, ask: true}`. `markdown`: `heading: 1`, `items` `["one","two"]`, `code` `echo "<b>kept</b>"` with `language` `sh`; `links` exactly `[["QA docs","https://example.invalid/qa","_blank","noopener noreferrer"],["T-1","#item/T-1",null,null]]` (the raw `<a>` is not a link, the `javascript:` destination is no link); `literal` six `true` (the `<img onerror>`, `<script>`, `<iframe>`, raw `<a>`, `javascript:` link and image syntax all shown as text); `elements: 0`; `ran: false`; `titleUnchanged: true`. `sandbox`: `sandbox` `"allow-scripts"`, `srcdoc: null`, `sameOrigin: true`, `path: true`, `height: 240`, `header` naming `QA hostile page` with `Open full` and `Open in a pane`; `receipt` `{read: "SecurityError", cookie: "SecurityError", navigate: "SecurityError", popup: "true"}` (the script cannot read the workbench document or its cookie, cannot navigate the top window, and `window.open` returns null: no popup); `topUnchanged: true`, `popups: 0`, `dialogs: 0`. `ask`: `options` `["1 Left","2 Right","3 Stay"]`; `afterEscape: "open"`; `declineDisabled: true`; `declineAfterBack: 0` (Answer instead restores answer mode); `bMs` under `1000` (report the value; context B's thread folded without a reload); `a` and `b` each `state: "answered"`, `outcome: "2 Right"`, `text` naming `2 Right`, `human` and a time, `controls: 0`; `b.time` an ISO time; `askerReceived` `["Right"]` (the fake asker got option 2's text once); `competing` `[false, <error naming the ask as answered>]` (the first answer won; a second answer from another client is refused by the hub) |
| E417S2-09 | hub-api | sealed $W | typecheck, colour and HTML guards, tiers | `k09` | `typecheck exit 0` with no diagnostic in the log (hub, Neovim, shared wire and web typechecks; the colour, token, HTML and hooks guards: `MessageBlock.module.css`, `MarkdownBody.module.css`, `AskCard.module.css`, `InlineArtifact.module.css` and `Thread.module.css` hold no colour value; secondary text keeps 4.5:1); the four guard lines appear (`web HTML: raw-HTML sinks refused; seeded fixtures passed`, `web colours: token-only sources; colour fixtures passed`, `web tokens: <n> text tokens ≥4.5:1 on ground and selection; role colours match hl.lua`, `web hooks: conditional-hook fixture rejected by configured oxlint`); `tiers exit 0`; the four `"Web"` classifications print |
| E417S2-10 | hub-api | QA shell | AGENTS.md `web/` rules; T-1121's sandbox; T-1119's links | `k10 \| tee "$EV/E417S2-10.txt"` | The key-listener grep lists only `web/src/keyboard.ts` (one `document.addEventListener('keydown', …)`, its handler and its removal): no component-local listener in `AskCard.tsx`, `MessageBlock.tsx`, `Thread.tsx` or `InboxArea.tsx`. Storage appears only in `web/src/interface-state.ts` under `cland.ui.<area>.v1` and in `web/src/connection.ts`'s `cland-reload-build` guard (no ask draft or run state in browser storage). The raw-HTML grep prints nothing. Sandbox attributes: exactly one line, `web/src/artifacts/SandboxedArtifactFrame.tsx` with `sandbox="allow-scripts"`; the forbidden-token grep prints nothing. New-tab links: exactly `web/src/MarkdownBody.tsx` and `web/src/artifacts/InlineArtifact.tsx`, each with `rel="noopener noreferrer"` on the same line. Under the four ids nothing: no dependency, devDependency or lockfile change |
| E417S2-11 | hub-api | docs | docs of the four items | `k11 \| tee "$EV/E417S2-11.txt"` | Every line above the `-- statements to read` marker starts with `1 ` (or more). Then read `web/README.md`'s sections around each hit ("Components and colours", "Message Markdown", "Topics and threads", "Area modules and live state", and the paragraphs on runs, inline artifacts and ask cards) and `docs/agents/tests.md`'s four paragraphs, and record any statement that contradicts E417S2-02 to E417S2-10 as a **low** finding with file and line (the row stays PASS when the only contradictions are docs ones). Candidates at writing, to confirm or dismiss at the build: `web/README.md` still says artifacts, folder and HTML ones included, are chips "until the inline-artifact slice" (T-1121 landed); "Messages are plain sender/time/text blocks with item links in this slice." (T-1119 renders the P12 block); "Inbox and Events keep their existing stand-ins." (T-1122 renders ask rows in the Inbox); and whether the key tables list the thread's `za`/Enter run toggle and the ask keys (`1`–`9`, `i`/`r`, `d`) that `?` shows (the last grep prints the README lines naming `Toggle agent run`, `Decline with a reason` or `Answer with option`, if any) |
| E417S2-12 | hub-api | sealed $W | brief | `cland qa lint qa/briefs/E-417-stage-2.md; echo "exit $?"` | `qa/briefs/E-417-stage-2.md: qa lint passes at the build` and `exit 0` (this brief, committed at the build) |
| E417S2-13 | hub-api | QA shell; the Coordinator's stage covers | stage covers | `(cd "$W" && node hub/bin/cland.ts task plan show E-417) \| tee "$EV/E417S2-13.txt"` and the cover results the request names | QA runs no full suite. The Coordinator owns the stage covers (`cland verify all --occasion stage`): full integrated suites at the tested SHA on Linux (droplet) and macOS (local), which add T3 and the Web phase on both platforms and are cited evidence this run does not run. Record the plan's line for this stage exactly as printed; Linux and macOS covers green at the tested SHA, each with its Web phase run (not "Web unavailable"); record each cover's run id, artifact, executor, platform, tiers and phases, wall time and cost as cited evidence. A cover red only on the T-1157 Retry case, with that case passing in E417S2-06, is recorded against T-1157 and judged by the Coordinator's rerun receipt the request names. Any other red cover is FAIL naming its failing tests; a cover not finished when every other check is done: wait for its result in the epic topic; none queued or running at the tested SHA by then: BLOCKED "no stage cover at the tested SHA", reported to the requester |
| E417S2-14 | hub-api | QA shell | cleanup | `k14 \| tee "$EV/E417S2-14.txt"` | Every Web log line prints a first census count of at least `1` and a second of `0` (E417S2-02 to E417S2-06h, E417S2-08; the T1 log E417S2-07 prints `0 0`, which is expected); `0` changed paths; `$Q` begins `/private/tmp/qa-e417s2-`. Then remove `$Q` and the worktree as "Setup" says |

Re-check helper, file and test names with grep at the tested build: renames happen. A test name pattern matching zero tests passes with exit 0 and "tests 0": read the counts and `oks`, never the exit code alone. The named Web tests and the probe ask the live hub's verify slot for admission themselves (`suite.slot` check): an admission timeout is BLOCKED; retry after `quiet`.

Before requesting QA, run `cland qa lint <brief>` with this filled brief at the build under test. The brief is complete only when qa lint passes at the build.

## Probes that mislead

- Process cleanup probes use a fixture-owned pid/process-group census, registered at launch and checked through exit; a machine-wide `pgrep` counts other sessions too (A-9063 R2; E-413 stage 1/T-1093). Here: each Web fixture's `Web fixture census: browser group <pid>; before <n>; after 0; scratch hub stopped` line, the probe's included.
- Edit existing keys in initialized configs, list standalone-test build prerequisites, enumerate regular files only for file probes, and identify events by seq/id. A second-client check allows only defaults the new client writes itself (A-8634 R12; E-412 stage 2, E-415 stage 3/DoD, E-1006). Here: the probe's context B is a fresh browser context signed in through its own minted link; it writes nothing.
- Transcript assertions identify stable item/topic/frame ids, with intervals starting at the result frame of the state-changing request. Preserve unaltered captures when correcting a probe and label the correction separately from product failures (A-8634 R13; E-412/E-415/E-1006; A-9063 R2; E-413 stage 1/T-1093). The probe finds the message, the frame and the ask by the ids their creating requests returned, never by position.
- Exact tracker copies replace the initialized tracker directory after its writers stop; copy the committed directory whole, dotfiles included, and compare that same file set. Apply the full `fixtureEnvironment` result after overlays, including synthesized values; under rule 15, check zero credential-prefix names before launching scratch processes and report names/counts only (A-9063 R2; E-413 stage 1/T-1093). This run needs no tracker copy: every scratch project is a fresh Web harness project.
- An accessibility-tree count does not prove visible reachability: a real-browser check scrolls the final row into view and checks its viewport containment (A-9063 R6; T-1095, T-1097). No help-dialog geometry is judged here; the palette file of E417S2-06 keeps its own containment cases.
- The probe's `bMs` is wall time seen from Node between the key press and B's fold: report it; the bounded proof of "within a second after the hub's receipt" is asks.test.ts's case in E417S2-05 on the fake clock. Likewise the probe watches context B's thread only; the Inbox half of C2 is E417S2-05's two-pane case.
- The sandbox receipt is written by the artifact's own script inside the frame; `SecurityError` for `parent.document` proves the opaque origin (no `allow-same-origin`), and `popup: "true"` means `window.open` returned null under a sandbox without `allow-popups`. `topUnchanged` and `popups: 0` are the workbench's own view of the same attempts.
- The probe's `T-1` is an item id that need not exist in the scratch project: the token is judged (`#item/T-1`, no wrap), not the item.
- Run membership is the hub's decision (T-1056); the web only renders `runId` and `foldLine`. A fold line's exact words are the hub's: judge them only through E417S2-03's verbatim assertions.
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file.
- A "ran" marker grep excludes the configuration echo line.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log: not applicable, QA runs nothing on a droplet. Speed criteria use measured wall times, never projections: this stage has none.
- Slots due or queued before the build count even when their results arrive later.
- "No skip": the Web files and the probe need Chrome Headless Shell (local on macOS); a skipped or "Web unavailable" result is BLOCKED, never PASS. Linux runs of the same files are cited from E417S2-13, not run by QA.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

Real Chrome and computer use: out of scope for this run, not BLOCKED. Every stage criterion is proven in Chrome Headless Shell against signed-in sealed scratch hubs; an anonymous real Chrome at the live edge shows only the offline shell with no topics, messages, artifacts or asks, and no sign-in grant exists. So no live-edge build stamp or hub-code gate applies, and the live hub is neither restarted nor rebuilt for this run. Also out of scope: the composer, its Withdraw button, kinds chooser and drafts, and the full Inbox with its other sections, ages, `r`, archive and drawer (stage `inbox and composer`); events, notifications and approval cards (stage `events, notifications and approvals`); the hub's run grouping itself (T-1056, already landed and covered by `hub/test/thread-runs.test.ts`), the hub's ask outcome record (T-1057) and the hub's `artifact.url` capability serving, beyond what the web shows of them; Neovim; the epic's Definition of done and its demo, a separate run; work landed on dev after the stage's items, beyond the regression files named here; the T-1157 Retry flake itself (recorded against T-1157 as E417S2-06 says, never a finding of this stage); running a full suite or a stage cover (E417S2-13 cites the Coordinator's); T4; duration budget lines (report-only); the live project's tracker, hub, crew, `ui.json` and HOME. Stage QA carries no criterion marks.

Nothing else in scope needs an authorization this brief does not give: a check that cannot run for lack of one is BLOCKED, not out of scope.

## Grants

none. No computer use, no real browser, no sign-in. The Headless Shell instances of the Web files and the probe open only their own sealed scratch edges, under the crew browser rule (rule 18). Every other check uses the rule 15 sealed environment with credentials filtered; nothing reads or writes the human's real `~/.cland` or `~/.local/state`.

## Verdict

Fix nothing. Clear only when every check E417S2-00 to E417S2-14 passes (docs contradictions in E417S2-11 are low findings and do not block clear; a T-1157 flake handled as E417S2-06 says is no finding). Otherwise not clear, naming the failing, blocked or inconclusive ids and findings. On the epic record one QA verdict with `--stage "message block, runs and asks"`, the full tested dev SHA, the unique run id and the case table. Stage QA carries no epic criterion marks. Report `qa clear E-417 stage message block, runs and asks` or `qa not clear E-417 stage message block, runs and asks` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
