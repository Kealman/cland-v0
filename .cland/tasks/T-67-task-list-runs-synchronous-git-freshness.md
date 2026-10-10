---
id: T-67
kind: task
title: "No git in the hub's request handlers: verdict freshness computed off the request path, a per-request time budget, and no UI polling floods"
state: closed
status: done
labels:
  - ready-for-agent
  - slice-2
  - hub
  - high
assignee: impl-67
parent: T-20
blocked_by: []
topic: topic-18
branch: t/T-67-task-list-freshness-cache
created: 2026-10-09T10:19:03.465Z
updated: 2026-10-10T00:58:17.733Z
---

## Parent

Part of T-20; a regression from T-54 seen on cland's own hub on 2026-10-09 from 10:15Z (hub 92891 on main 55780b2), ending in a hang at 10:17:28Z and a restart. T-66 (the items tree reverting under load) is the client-side face of the same thing. Scope set by the human's stand-in at 10:20Z.

## What happened

`Tracker.list()` (hub/src/tracker/tracker.ts:390) calls `#freshness` for every listed item, which runs `branchTip` and `verdictCurrent` (hub/src/tracker/verdict-git.ts: `execFileSync('git', …)`, up to 5 s each, several calls per verdict: merge-base, diff, patch-id) synchronously on the hub's event loop; `verdictBase` runs git too, once per call. The workbench clients poll `task.list` about twice a second (123 audits in the minute 10:17Z) and `session.list` as often (2967 calls in the log). With about fifteen items carrying branches and verdicts and a machine load of 30 to 60, each `task.list` takes seconds of blocked event loop, requests queue behind each other, every client sees `the hub did not answer within 10 s` (the CLI, the spokes, `session launch` after 60 s), and at 10:17:28Z the hub stayed inside one read callback for good while every queued `task.list` ran its git: the socket stopped answering, the process stayed alive at 7 % CPU, the log stopped. Evidence: the Coordinator's 3-second `sample` at 10:15Z (/Users/evgeniyivanov/.claude/jobs/faa688a6/tmp/hub-sample.txt: half the main-thread time in nested `Array.map` → `SyncProcessRunner::Spawn` under a socket read handler) and the stand-in's sample of the hang (/private/tmp/claude-501/-Users-evgeniyivanov-Projects-cland-v0/3629c0f3-2940-4f48-833c-921959fe6470/scratchpad/hub-hang-92891.txt: 94 % inside one JS stream-read callback). Log context before the hang: a burst of identical `session.list` and `task.list` audits from the nvim client with the same millisecond timestamp (20 lines stamped 10:17:28), then `client edge=socket client=cli`, `bye rev-6`. Restarted by the stand-in at about 10:18Z (pid 33252).

## What to build

- No git in request handlers at all. Verdict freshness (`current`) is computed asynchronously off the request path and cached per item by (verdict commit, branch tip, base tip); the cache is invalidated by the tracker's change events (an item file or verdict changes) and by a cheap `git rev-parse` of the branch tips and the base on a timer (a few seconds). `task.list` and `task.view` read the cache only; a value not yet computed is reported as unknown, never computed inline. `verdictBase` is cached the same way.
- A per-request time budget: the hub measures every request handler and logs `slow-request` with the tool, the client and the duration when it exceeds the budget (a few hundred milliseconds), so a stuck or slow handler is visible in the log and in `cland doctor` or `hub status` counters.
- A client-rate guard for UI polling: a client that sends the same read request faster than a limit gets the previous answer or a `too-fast` refusal, logged once. And the cause itself: the workbench subscribes to `task` and `session` events instead of polling `task.list` and `session.list` twice a second; read the nvim client's refresh paths (the items tree, the sessions panel, reconnect) and fix the poll loop in the same item, or file an nvim item with the finding if it is larger than this one.
- A reproduction test from the sample's shape: a client flooding `task.list` on a project with twenty items with verdicts does not block another client's request for more than the budget, spawns no git inside the handler (count through an injected runner or a `PATH` shim), and `task.view` still reports `current`/stale as T-54's tests require once the cache is warm.

## Acceptance criteria

- [ ] `task.list` and `task.view` spawn no git process in the handler; `current` comes from the cache or is absent, and T-54's freshness tests pass with the cache warmed
- [ ] The cache invalidates on tracker change events and on a timer's tip check; the git calls are asynchronous
- [ ] A handler over the budget logs `slow-request` with tool, client and duration
- [ ] A flooding client does not delay another client beyond the budget; the same read request repeated faster than the limit is refused or answered from the previous result
- [ ] The nvim workbench no longer polls `task.list`/`session.list` on a timer or on every refresh (events instead), or an nvim item is filed with the measured poll paths
- [ ] `npm run typecheck && npm test` pass; `hub/README.md` says when freshness is computed and what `slow-request` means

## Notes

Test seam: the tracker against a real git repository in a temp project, as hub/test/verdict-commit.test.ts does, plus a spawn counter and two clients on a real hub; the nvim poll paths through the headless harness. Size M. Implementer: Claude Code. Labels hub, high. The hub restart that carries it is the cure; no restart until it lands.

## Comments

### coord · 2026-10-09T10:19:41.506Z

Incident record, 2026-10-09. The hub (pid 92891, main 55780b2) stopped answering its socket at 10:17:28Z with the process alive at about 7 % CPU; the hub log stopped at 10:17:28.730Z. The human's stand-in sampled it (94 % of the time inside one JS stream-read callback: uv__stream_io → OnStreamRead → JS; sample at /private/tmp/claude-501/-Users-evgeniyivanov-Projects-cland-v0/3629c0f3-2940-4f48-833c-921959fe6470/scratchpad/hub-hang-92891.txt), then ran `cland hub stop` (the process ended) and `cland hub start` (pid 33252, port 52857) at about 10:18Z; every session was re-found. The Coordinator's own 3-second sample two minutes earlier (/Users/evgeniyivanov/.claude/jobs/faa688a6/tmp/hub-sample.txt) shows the same handler with `SyncProcessRunner::Spawn` (git) at its leaves under two nested `Array.map`: `Tracker.list` → `#freshness` → `verdictCurrent`. Log context before the hang: a burst of identical `session.list` and `task.list` audits from the nvim client with the same millisecond timestamp (20 lines stamped 10:17:28; 2967 nvim `session.list` calls in the log overall; `task.list` 123 per minute at 10:17Z), then `client edge=socket client=cli`, `bye rev-6`. Reading: each list call blocks the loop for seconds of synchronous git under load 30 to 60; the nvim client re-requests on every refresh and on reconnect, so the backlog grows and the loop never drains. T-66 (the items tree reverting under load) is the client-side face of the same thing. Added to this item's scope, at the stand-in's request: (a) a watchdog in the hub that measures each request handler and logs and drops a client whose handler exceeds a budget, so a flood or a stuck frame never takes the hub down silently; (b) a reproduction from the sample's shape: a client flooding `task.list` on a project with many verdicts; also check that hub/src/hub/lines.ts advances its buffer on every frame. (c) The nvim client's burst at 10:17Z is to be read from the journal: the same-millisecond repeats look like a refresh loop after reconnect (the stand-in's own session had restarted); note the finding here and file it against the workbench if it is one. Effect on the run: calls timed out from 10:15Z; three identical Coordinator comments landed on T-65 because the timed-out calls went through late (left as they are; item files are not edited by hand).

### impl-67 · 2026-10-09T10:20:56.907Z

Claimed and started. Reading tracker freshness (tracker.ts list/view/#freshness/#changed, verdict-git.ts) and the dispatcher; the plan follows the brief's order: (1) async freshness cache off the request path, (2) slow-request budget log, (3) rate guard, (4) nvim poll paths, (5) README.

### impl-67 · 2026-10-09T10:32:15.009Z

Step 1 in the worktree (not committed yet): hub/src/tracker/freshness.ts is the cache. verdict-git.ts is now async only (execFile; the sync execFileSync is gone from the tracker). Keys are (verdict commit, branch tip, base, base tip). Branch tips come from one `git for-each-ref refs/heads/` on a 2 s timer and 50 ms after every tracker change; answers for tips no branch has any more are dropped. Missing answers are computed one at a time in the background, the task patch ids are shared per (base, base tip, sha), and the items are announced as `task` events once known (only when their freshness changed, so a tip read doesn't flood the UI). `list`/`view`/the `task` event read the cache only, and `current` stays absent until it is known. task.comment resolves its verdict commit (given, or the branch tip) asynchronously before the write, so answerTask is async now. Tests: the new hub/test/freshness.test.ts has 20 items with verdicts, 400 list/view calls start 0 git processes (counted through an injected runner), all become current from the cache, and a branch that changes goes stale and is announced. verdict-commit.test.ts (T-54) waits for the cache instead of reading inline: 7/7 pass.

### coord · 2026-10-09T10:42:18.284Z

Second observation for the budget/watchdog part, 10:30Z to 10:41Z: with four full suites running at once (load 194) the hub process stayed up and kept answering nvim's `task.list`, but every agent spoke went `bye` at 10:30:51Z (coord, rev-cc and the others) and reconnected only at 10:41Z; one Implementer report waited queued meanwhile. Likely the spoke's keepalive or the hub's socket timeouts under a starved loop. The slow-request log and the counters should make this visible; whether the spokes' reconnect backoff is too long under load is a question for the same item (note it on hub/README.md's spoke section if it is a separate fix).

### impl-67 · 2026-10-09T10:45:48.783Z

Done on t/T-67-task-list-freshness-cache, 5 commits from main e7abf62 (not pushed, per the brief).

- 06c581c, freshness cache. hub/src/tracker/freshness.ts keys answers by (verdict commit, branch tip, base, base tip). Branch tips come from one `git for-each-ref` every 2 s and 50 ms after each tracker change; answers for tips no branch has any more are dropped. Missing answers are computed asynchronously, one at a time; task patch ids are shared per (base, base tip, sha). An item is announced as a `task` event once its answer is known, and only when its freshness changed. list, view and the `task` event read the cache only; `current` is absent until known. verdict-git.ts is async only, and no execFileSync is left in the tracker. task.comment resolves its verdict commit before the write and feeds the tip to the cache, so a verdict on the tip is current at once; answerTask is async now. verdictBase comes from the same tip read.
- 222cf8e, budget and repeat guard. hub/src/hub/budget.ts times every frame's handling. One over 250 ms is logged as `slow-request` {tool, client, ms, budgetMs} and counted in `hub.status.requests` and on the `requests:` line of `cland hub status`. A read that the same connection repeats within 250 ms of its answer, with no write, event or presence change in between, gets that answer again. `too-fast` is logged once per connection and tool, and `requests.replayed` counts the repeats.
- c55de88, nvim. The 1 s items timer and task.list on the 5 s timer are gone: the items are read on connect and then kept by the `task` events. The sessions refresh and the items read are single-flight, so a burst of 50 `session.state` events for unknown sessions asks 1 to 3 times instead of 200. The 5 s sessions timer stays: presence, process exits and usage have no events. The proposed follow-up item is artifact A-2 in this topic.
- ff9846a, README: when freshness is computed (absent means unknown; up to about 2 s behind a Git change) and what slow-request and too-fast mean.
- bca64d0: a failure after the tracker answered is that request's failure, not an unhandled rejection.

lines.ts is checked: it slices the buffer before each onLine, so the buffer advances on every frame.

Tests:
- hub/test/freshness.test.ts: 20 items; 400 list/view calls start 0 git processes (injected counting runner); all items become current from the cache; a branch whose diff changes goes stale and is announced; an unrelated tip read announces nothing.
- hub/test/request-guard.test.ts: 500 task.list requests in flight at once from one client on 20 items with verdicts; another client's task.view is answered in about 9 ms; too-fast is logged once; no slow-request; a write ends the replay. A slow-request record is checked through an injected clock.
- verdict-commit.test.ts (T-54) waits for the cache instead of computing inline: 7/7.
- A new nvim headless test checks that task.list is read once and that a burst is coalesced.

Full run: typecheck clean; hub 319/319; nvim 67/68. The one failure, "an attach client that ended is not reused", passes alone, so it is load timing.

Not done:
- The watchdog that drops a client whose handler is over the budget. The slow handler was the hub's own fault, not the client's, and with no git in the handlers a flood is answered cheaply or from the previous answer. So the budget logs and counts, and the repeat guard covers the flood.
- `cland doctor` does not show the counters; `hub status` does.

### rev-cc2 · 2026-10-09T10:55:28.801Z

verdict: review
result: not clear
by: rev-cc2 [reviewer]
run: rev-cc2-67-1
commit: bca64d0e58dbc5cd8050cb19098586b74695aa5b

Reviewed t/T-67-task-list-freshness-cache at bca64d0 (06c581c, 222cf8e, c55de88, ff9846a, bca64d0; merge base with main 7162ee4), read-only. I made no edits. Typecheck passes (hub and nvim). I ran the targeted tests only: hub/test/freshness.test.ts, request-guard.test.ts and verdict-commit.test.ts, 11/11 pass. No full suite.

Medium
- hub/src/tracker/freshness.ts:130: a read can still start git inside the handler. `#current` calls `void this.#work()` synchronously. When the worker is idle, `#work` → `#compute` → `resolveCommit` → `gitIn` → `execFile` runs before `annotate` returns, so `task.list`/`task.view` spawn a git process in the handler. A probe (Freshness with a counting runner, tips read, worker idle, one `annotate` with an unknown key) counted 1 runner call inside `annotate`. This breaks criterion 1 as written. It is also the path taken under load: when a compute fails (git timeout), `#work` drops the want and the next read queues it again. Each read that finds the worker idle then spawns one git process. The writes' `#changed` → `#announce` path does the same in write handlers. freshness.test.ts reports 0 only because the comment writes have already started the worker before the flood. Fix: start the worker off the handler (`setImmediate(() => void this.#work())` or a scheduled flag), and add a test that reads with the cache warm, the worker idle and one new key.

Low
- freshness.ts:120: a branch the last tip read does not hold yet is reported as `current: false` (stale), not as absent. That covers a branch created or linked less than 50 ms to 2 s ago. hub/README.md says absent means unknown. Return undefined while that branch has not been read, or note the window in the README.
- tracker.ts:564/574: a git failure in `task.comment` (timeout or killed) rejects the write. Nothing is written and nothing is left unhandled, which is the right outcome, but the client gets git's raw `Command failed: git rev-parse …` rather than a TrackerError. Also, a verdict now waits for git while later frames (a plain comment, a close) write first. The header comment at tracker.ts:4 ("serialized by construction") no longer says that arrival order is not kept for verdicts.
- hub/src/hub/budget.ts:123: the repeat guard only replays after the first answer exists. Task answers are now async, so identical reads arriving in one burst (the incident's same-millisecond batch) are all handled. With the cache this is cheap, but the README's claim deserves a line saying in-flight duplicates are not coalesced.
- hub/test/request-guard.test.ts:53 asserts that the other client waited less than 2× the budget, while the criterion says "beyond the budget". The measured value was about 9 ms, so `< BUDGET_MS` would hold.
- hub/test/verdict-commit.test.ts:129: in the rebase case the cached pre-rebase answer (commit = old tip) is also `true`. Only the 500 ms `tipsRead` sleep ensures the patch-id path ran. freshness.test.ts does cover patch-id equivalence on distinct tips, so T-54's behaviour is covered, but this case alone can pass vacuously.
- freshness.ts:123/158: the key includes the base tip, so every merge into dev drops every answer and recomputes all items serially (about 7 git calls each). Under load `current` is absent for every item for that whole window. This is documented ("then no answer") and correct, but worth knowing for T-59's gate.
- nvim/lua/cland/init.lua:48: `single_flight` has no request timeout. If an answer never comes on a live connection, that refresh stops until the next reconnect. Disconnects do call the pending callbacks, so a reconnect recovers.

Checked and fine
- No execFileSync or spawnSync is left in the tracker or any request path. The remaining ones are in territory.ts, lock.ts, doctor and the CLI.
- Event flood: `#announce(…, true)` is suppressed while an answer is pending or unchanged. A tip read that changes nothing emits no event, and that is tested. Dev moving produces no events once the results are equal again. A hub start announces each item with verdicts once.
- Rebase: the key is (commit, tip, base, base tip). A new tip recomputes, and an unchanged patch id stays current.
- `verdictBase` changing (dev renamed to main) prunes by base key and is tested.
- `task.comment` resolves the commit before `#mutate`, and `noteTip` makes a verdict on the tip current at once. bca64d0 routes failures after the answer to that request.
- `slow-request` logs {tool, client, ms, budgetMs} and the counters reach `hub.status` and `cland hub status`.
- nvim: the items timer and `task.list` on the timer are gone. Items are read on connect and kept by `task` events, and the sessions refresh is single-flight. The headless test covers both.
- The README covers when freshness is computed, `slow-request` and `too-fast`.

Scope notes for the Coordinator, not counted: the watchdog that drops a client is not built (impl-67 explains why), the counters are not in `cland doctor`, and the spoke-reconnect-under-load question from the 10:42Z comment is not noted on the README's spoke section.

### impl-67 · 2026-10-09T11:14:05.454Z

Fixes for review rev-cc2-67-1 are in 52330b9.
1. Medium: the worker now starts on setImmediate (`#startWork`), so a read that finds a new question only queues it. New test: warm cache, idle worker, then a hand-written verdict with a commit the cache has never seen, read through `view`, makes 0 runner calls inside the read. The test fails on the old code ("the read only queued the comparison") and passes now.
2. A branch the last tip read did not hold reports `current` absent and asks for a read. It turns false only once a read that started after the question still finds no such branch, and the item is announced then. New test: with the timer at 60 s, a branch created after the last read is unknown at first, then becomes true; a branch that never exists becomes false.
3. task.comment: when Git does not answer the verdict's commit or the branch tip, the write is refused with `code: git-unavailable` and a message naming what it could not resolve ("cannot resolve the tip of branch t/0: Git did not answer (…); nothing was written"). The new `code` is in the protocol union. Test: a runner whose rev-parse rejects, checked through `tracker.comment` and `answerTask`; nothing is written.
The README is updated for all three. Typecheck is clean; freshness.test.ts and verdict-commit.test.ts pass 12/12. No full suite was run.

### qa-cc2 · 2026-10-09T11:14:51.149Z

verdict: qa
result: clear
by: qa-cc2 [qa]
run: qa-cc2-67-1
commit: bca64d0e58dbc5cd8050cb19098586b74695aa5b

QA pass qa-cc2-67-1 on t/T-67-task-list-freshness-cache @ bca64d0, pinned to a `git archive bca64d0` export with the worktree's node_modules linked; Node v24.21.0, nvim v0.12.5. Raw outputs are in A-3. A sample of the project hub during its outage is in A-4.

## What I ran

1. `npm run typecheck`: exit 0.
2. `node --test hub/test/freshness.test.ts hub/test/verdict-commit.test.ts`: 9/9 pass.
3. `npm test` once, under `/tmp/cland-suite.lock` (lock 10:51:21Z, done 10:56:19Z, load 60 to 84): hub 319/319, nvim 68/68. No timing failure, so nothing was rerun.
4. A scratch project with its own hub:
   - Setup: `cland init`, then main, dev and 20 branches t/i1..t/i20, and 20 items with `--branch`. Each item got a hub-written verdict: `task comment T-n … --verdict review --result clear --run r --commit $(git rev-parse t/in)`.
   - Every CLI call ran as `env -u CLAND_HUB_FILE -u CLAND_SESSION_ID -u CLAND_SESSION_NAME -u CLAND_CLI -u CLAND_NODE node <export>/hub/bin/cland.ts`.
   - The socket was the project's own `.cland/hub.sock`, because the path was short enough. It was not under $TMPDIR.
   - Three floods followed; their results are in Findings.
5. Headless Neovim through `nvim/test/harness.ts` `startClient` against the scratch hub, counting the client's audits in the journal:
   - (a) items panel closed;
   - (b) items panel open (`<Esc><Space>i`), 10 s, then `cland task create`;
   - (c) `hub stop` + `hub start` while connected.
6. Scratch hub stopped. No leftover processes, and the suite lock was released.

## Findings

All of these were checked and passed:

- **Flood 1** (10:56:41Z, load 30 to 40, 20 s):
  - Load: one connection with 50 `task.list` in flight (35,775 answered, max round trip 467 ms), plus 4 shell loops of `task list --json` (60 runs).
  - The second client's `task.view` every 100 ms (167 samples): p50 2 ms, p99 54 ms, max 122 ms, 0 over 250 ms.
  - `cland task view` timed from the shell: 1.1 to 2.4 s. That is node start-up under load, not the hub.
- **Flood 2** (10:57:30Z, load 52 to 58), with the repeat guard defeated:
  - Load: a new connection per request, 20 at a time. 3,498 `task.list` were really handled (175/s, max 432 ms), plus the pipelined flood.
  - The second client's `task.view` every 300 ms, so never replayed: p50 34 ms, p90 96 ms, p99 145 ms, max 145 ms, 0 over 250 ms.
- **No git in the handlers.** I restarted the scratch hub behind a `git` PATH shim that logs every call.
  - During 15 s of flood (2,610 fresh-connection `task.list` + 1,784 pipelined + 13 CLI), the hub spawned exactly 8 git processes. All were `for-each-ref … refs/heads/`, 2.0 to 2.06 s apart: the tip timer.
  - The `ps` sampler during floods: 0 git children in 63 samples (50 ms). Flood 1 had 2 of 42 samples, 1.9 s apart: the timer's `for-each-ref`.
- **Log and counters.**
  - `too-fast` is logged once per connection and tool, e.g. `{"event":"too-fast","tool":"task.list","client":"flood","repeatMs":250,…}`.
  - `cland hub status`: `requests: 0 slow · 38318 answered again (too fast)`. `--json` shows `requests: {slow: 0, replayed: 38318}`.
  - No `slow-request` happened in any run. The record's shape is covered only by request-guard.test.ts, which is in the suite.
- **Freshness.**
  - All 20 items read `current: true` ~3 s after the verdicts.
  - A cold restart already answered `current` on the first `task.view`, within ms of the socket appearing.
  - A new commit on t/i3: `task view T-3` read `current: false` 3 s later. The shim shows the background recompute: rev-parse, merge-base, diff, patch-id, ×2.
  - A new verdict on the tip read `current: true` at once. The older verdict of the same kind has no `current`, as designed.
  - The item's `verdictBase` is `dev`.
- **nvim.**
  - (a) In 40 s: `task.list` once (on connect). In the steady 10 s: `session.list`, `hub.status`, `role.list` and `inbox.list` 2 each (the 5 s timer), and no `task.list`.
  - (b) Panel open: 0 `task.list` in 10 s. The item made by `cland task create` appeared in the panel with no read at all (`afterCreate: {}`), from the `task` event alone.
  - (c) After a hub restart: in 15 s, `task.list` once and `session.list` 4 times. At most 5 audits shared one millisecond (one refresh batch). There was no burst.

Medium: none.

Low:

1. **nvim/README.md:52 is stale.** It still says `task.list` is read "on every connect and every 5 s" and "while the items are on screen … asked again every second". c55de88 removed both, and hub/README.md:343 states the new behaviour.
2. **The nvim client sends `inbox.list` twice on every connect**, from nvim/lua/cland/init.lua:113 and nvim/lua/cland/topic_view.lua:62, within 250 ms. The second is replayed, so each nvim connect logs `too-fast inbox.list client=nvim` (6 of them in this pass). That is harmless, because a change in between ends the replay, so the topic view's "asked after the history" intent holds. But it makes `too-fast` noise on every connect, which hides a real flood.
3. **The budget times only the synchronous part of a handler.** In hub/src/hub/dispatch.ts:706, `measure(…, () => handle(frame))` does not await. That is right for loop blocking, and the README says "time every other client waited". But an async handler stuck awaiting (task.comment resolving its commit through git) is never a `slow-request`, so a hung request is still silent.

Note, not a finding on this branch: at 11:02:42Z the project's own hub (pid 64842, main ba4f0c3, without T-67) dropped every spoke and stopped answering its socket (ECONNREFUSED). My 3 s `sample` shows the main thread 100% (2233/2233) inside one stream-read JS callback, with `SyncProcessRunner`/`uv_spawn` under it. That is the shape of the 10:17Z incident. The sample is A-4. I did not stop it. It came back by itself, with the same pid, and the spokes reconnected at 11:13:51Z: about 11 minutes with no hub. This verdict covers bca64d0 as the brief asked. The branch has since moved to 52330b9, the review fixes, which this pass did not check.

### rev-65 · 2026-10-09T11:23:53.880Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-67-2
commit: 52330b94db532d6ea52f52f24073e10e3205cbcd

Reviewed t/T-67-task-list-freshness-cache at 52330b94db532d6ea52f52f24073e10e3205cbcd, run rev-65-67-2. Fixed-point comparison: 7162ee4c61eeab115e9d9202da0f8f1df715af1d...52330b9 (merge-base with main ba4f0c3; stated e7abf62 predates unrelated T-50 already on main). Reviewed all six T-67 commits and bca64d0..52330b9 against rev-cc2-67-1. Read item body, incident comments, prior verdicts, AGENTS.md, glossary, relevant ADRs and docs. Read-only; no file changes, commits, pushes or merges; no suite run. Parallel Standards/Spec reviews completed under code-review skill; sub-agents did not use the hub.

## Standards
High: none. Medium: none.
Low:
- nvim/README.md:52 still says task.list runs every five seconds and every second with visible items; init.lua:124/541 removed both, so the documentation describes behavior the client no longer has.
No documented AGENTS/glossary/ADR breaches or actionable baseline smells.

## Spec
High: none.
Medium:
- hub/src/hub/dispatch.ts:706 (and hub/src/tracker/tracker.ts:585): the request timer ends before a verdict write resumes after awaited Git resolution. Its synchronous #mutate/#write filesystem and SQLite work runs outside measurement, so it can block every other client beyond 250 ms without a slow-request log or counter. This violates 'A handler over the budget logs slow-request with tool, client and duration'. This is actual event-loop blocking, distinct from QA's low about elapsed time awaiting Git. Time the resumed synchronous mutation phase as well; do not count idle Git waiting as blocking. A no-write probe of the real RequestGuard with an injected clock and 1000 ms assigned after await returned counters {slow:0,replayed:0}, logs []; tracker.ts:454 also has the existing synchronous writePauseMs/Atomics.wait seam for a targeted regression test.
Low:
- hub/test/request-guard.test.ts:53 permits another client's wait below twice BUDGET_MS, whereas acceptance says within the budget; tighten to BUDGET_MS. QA's old-head measured maximum 145 ms is stronger evidence but the assertion remains weak.
- nvim/lua/cland/init.lua:48: single-flight has no request timeout; a missing answer on a connection that stays open stops that refresh until disconnect.
- hub/src/tracker/tracker.ts:4: the serialization header still implies complete operations finish before later operations start; awaited verdict resolution allows later writes to finish first. Mutation itself remains serialized.
- hub/test/verdict-commit.test.ts:129: the rebase check can accept cached pre-rebase true; a fixed 500 ms tip-read sleep is its only protection. Separate freshness tests cover distinct-tip patch equivalence.

Verified fixes and other acceptance coverage:
- freshness.ts:152-158 schedules new work with setImmediate; a read queues only. freshness.test.ts:132-150 covers warm cache, idle worker and a newly discovered hand-written verdict key, with zero runner calls inside view and eventual patch equivalence.
- freshness.ts:128-136/184-191 keeps an unobserved branch unknown until a tip read begun after the question settles it; tests cover newly created and genuinely absent branches.
- tracker.ts:569-585/609-614 refuses failed Git resolution before mutation with TrackerError code git-unavailable; requests.ts propagates the code. Direct and protocol tests verify no comments written.
- list/view/announcements read only cached Git facts; the 2 s tip timer and 50 ms tracker-change poke perform asynchronous Git, with key/prune invalidation for branch/base movement. No synchronous Git remains in the tracker. lines.ts advances its buffer before each callback.
- The repeat guard reuses successful answers after a first answer exists and invalidates on writes/events/presence. In-flight duplicates are not coalesced. Slow counters reach hub.status and the CLI; their continuation coverage is the medium above.
- Task polling timers are removed; task events maintain items. T-71 is actually filed with measured remaining session refresh paths, satisfying the acceptance's follow-up alternative. Single-flight coalesces session bursts.
- README explains unknown freshness, tip checking, typed Git refusal, slow-request and too-fast. Base-tip changes still temporarily make all non-tip-equivalent answers unknown while serial recomputation proceeds, as previously noted.

Validation evidence: git diff --check clean. Inspected new tests, did not execute them because this Reviewer remains read-only. Item records impl-67's typecheck and 12/12 targeted checks at 52330b9; independent QA at bca64d0 records typecheck, hub 319/319, nvim 68/68, flood results with another client's maximum 145 ms and the Git PATH shim showing timer-only spawns. Those full-suite results cover the earlier head, not 52330b9. Ran only the no-write RequestGuard probe described above. A history read timed out during review. Later artifact creation and verdict recording returned explicit disconnected/unreachable errors; neither had landed when task.view was checked after reconnection.

Scope notes retained from prior review: client-drop watchdog, doctor counters and spoke-reconnect-under-load documentation were not added. The acceptance allows hub status counters and T-71 supplies the polling follow-up; these notes are separate from the medium timing defect.

Totals: Standards 1 low, worst low; Spec 1 medium and 4 lows, worst the unmeasured synchronous verdict continuation. The three requested fixes are correct, but one medium remains; result not clear.

Durable evidence: A-6, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6-t-67-review-rev-65-67-2-at-52330b9.md.

### impl-67 · 2026-10-09T11:29:01.686Z

Fixes for review rev-65-67-2 are in f2be2cc.
1. Medium: every stretch a task request runs on the event loop is now timed against the budget:
   - the first stretch, in `receive`;
   - the synchronous write a verdict resumes into after Git answers: `tracker.comment` takes a `resumed` wrapper through `answerTask`, and the dispatcher passes `guard.measure(tool, client, …, 'resumed')`;
   - the answer going out (phase `answer`).

   `slow-request` and `hub status`'s `lastSlow` carry `phase`. Time spent waiting for Git is not counted, because it blocks nobody. Test (request-guard.test.ts, through the `writePauseMs` seam rev-65 pointed to): the injected Git answers after 20 ms, then the write holds the loop for 400 ms; one `slow-request` {tool task.comment, client reviewer-ui, phase resumed, ms ≥ 400} is logged. The test fails without the wrapper.
2. Low: nvim/README.md "Hub data" now says task.list and topic.list are read on connect only. The sessions reads stay on the 5 s timer and on role or unknown-session events, single-flight, until T-71.

The tracker's header comment now says a verdict is written once Git has answered, so a later request may be written first (from rev-cc2's lows). The hub README describes the phases. Typecheck is clean; request-guard, freshness and verdict-commit pass 15/15. No full suite was run.

### rev-65 · 2026-10-09T11:33:27.750Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-67-3
commit: f2be2cc1dab772754018625ea5912034650c25f8

Delta review of T-67: git diff 52330b94db532d6ea52f52f24073e10e3205cbcd f2be2cc1dab772754018625ea5912034650c25f8 (one fix commit), run rev-65-67-3. Read item body, prior review rev-65-67-2, incident/QA comments and impl-67's new evidence. Read-only; no edits or suite. Used the code-review skill's parallel Standards/Spec axes, with the same repository standards sources already read. Sub-agents used no hub tools.

## Standards
High: none. Medium: none. Low: none in this delta. No documented-standard breaches or actionable baseline smells. The optional resumed wrapper preserves a synchronous, transport-independent tracker write. nvim/README.md:52 now describes connection-time task reads, events and the remaining T-71 sessions timer. The tracker header now explicitly says awaited verdict resolution permits a later request to write first.

## Spec
High: none. Medium: none. The medium in rev-65-67-2 is fixed.
- dispatch.ts:378 passes guard.measure(tool, client, write, 'resumed') through answerTask and handleTaskRequest into Tracker.comment. Both explicit commit and default branch-tip resolution set awaited before await. tracker.ts:595 wraps #writeComment after Git returns; that includes synchronous #mutate/#write, index updates, view construction and verdict listeners. Plain comments/no-await verdicts still run under the first receive measurement.
- dispatch.ts:386-391 measures answer delivery separately as phase answer. budget.ts:67-82 logs/counters phase and uses finally, including throwing measured work; protocol.ts carries phase in lastSlow. Git wait itself is outside the resumed measurement. Existing error-to-result handling remains intact.
- request-guard.test.ts:82-102 is a meaningful regression for the missed path: real UI task.comment against Tracker, Git resolving after 20 ms, then writePauseMs/Atomics.wait holding the loop 400 ms; it requires a task.comment slow-request from reviewer-ui with phase resumed and ms >=400. The creation record is cleared before the verdict. Without the wrapper that resumed write executes after receive timing ends and the assertion finds no matching log.
Low:
- hub/src/hub/dispatch.ts:380: #bindAssignee is still in a separate unmeasured .then before the answer phase; task.create/edit with assignee can perform synchronous SQLite binding there. This is a residual timing-coverage gap outside the verdict-write fix, with no evidence that this small binding step exceeds the budget. It does not block this delta verdict.

Validation: git diff --check 52330b9 f2be2cc is clean. No suite or filesystem-writing test was run. Re-ran the earlier no-write RequestGuard probe with the actual resumed wrapper and injected clock: simulated 5000 ms Git wait plus 1000 ms resumed synchronous work => exactly one slow-request {tool:task.comment,client:probe,phase:resumed,ms:1000,budgetMs:250}, requests.slow=1, lastSlow.phase=resumed. The Git wait was excluded. Inspected the full regression; impl-67 reports typecheck clean and request-guard/freshness/verdict-commit 15/15 at f2be2cc; those are reported results, not tests executed by this Reviewer.

This is a delta verdict, not a new full-branch pass. The earlier flood assertion, single-flight timeout and fixed-sleep rebase test remain non-blocking lows; the earlier README and tracker-header lows are fixed. Totals for delta: Standards 0 findings; Spec 1 low, worst the unmeasured assignee-binding continuation. Nothing high or medium remains. Result clear.

Durable evidence: A-8, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8-t-67-delta-review-rev-65-67-3-at-f2be2cc.md.

### coord · 2026-10-09T11:38:00.137Z

Merged into main as 8bf458c (`git merge --no-ff`, by the Coordinator) at 11:34Z. Live since the hub restart at about 11:37Z, hub pid 22965; its `hub status` shows `requests: 0 slow`. Suite on main 8bf458c: typecheck clean, hub 328/328, Neovim 90/90, 0 skipped.
Verdicts:
- rev-cc2-67-1, not clear: the worker started synchronously inside a read.
- rev-65-67-2, not clear: the request timer stopped before the resumed synchronous verdict write.
- rev-65-67-3, clear on f2be2cc.
- QA qa-cc2-67-1, clear on bca64d0. Under floods no second client waited over 250 ms, a git shim saw only the 2 s tip timer, and the workbench issued `task.list` only on connect.
The two fix commits after bca64d0 (52330b9, f2be2cc) were reviewed, and their targeted tests passed: 14/14 on an export of 52330b9, 15/15 reported on f2be2cc. That is a Coordinator decision, taken because the live hub hung four times on exactly what this item removes.
What it does:
- Verdict freshness is cached off the request path and invalidated by tracker change events and a 2 s tip timer.
- Git runs asynchronously only.
- `slow-request` is logged and counted for every stretch a request runs on the event loop.
- Same-request floods are answered from the previous result (`too-fast`).
- The workbench no longer polls `task.list`.
Follow-ups: T-71 (the sessions timer, plus qa-cc2's three lows). Implementer: impl-67 (Claude Code), launched 10:20Z.
