---
id: T-51
kind: task
title: "A Codex session's spoke replaced with no attach behind it: the session's tool calls then fail silently until a stop and relaunch"
state: open
labels:
  - slice-1
  - ready-for-agent
assignee: impl-48
parent: T-19
blocked_by: []
topic: topic-8
branch: t/T-51-replaced-spoke-stale-state
created: 2026-10-09T07:21:18.317Z
updated: 2026-10-09T08:31:43.546Z
---

## Parent

Part of T-19. Seen once in the real T-42 run on 2026-10-09 with the Reviewer session `rev-1` (Codex 0.160.0, gpt-6.1-sol, app-server pid 62669, launched by the hub at 06:27Z through the spoke's `session.launch`, root checkout). Same family as the OpenCode second-spoke bug fixed in 128fd6e (T-43's run) and T-50 (a steer lost at the end of a turn).

## What happened (journal `.cland/journal.jsonl`)

- 07:07:45Z the T-48 review request is injected into rev-1; 07:07:56Z rev-1's `task.view` and `status` are audited `ok`.
- 07:08:15.420Z `{"event":"replaced","name":"rev-1","sessionId":"72d5bcf7-…"}` followed in the same millisecond by `hello` for the same session id and role, a `role-clause` re-sent with reason `hello`, `flushed` count 1, `harness-steered` into turn `01a11f7d-…`, `injected`. No `session.attach` for rev-1 that day (the human's clients only polled `task.list`, `session.list`, `hub.status` through nvim and the CLI at the time).
- 07:11:38Z the turn ends `idle`. No audit entry from rev-1 after 07:07:56Z: none of its tool calls reached the hub. rev-1 later reported that its verdict and report attempts "failed with the replaced-spoke error", so the app-server kept calling tools through the old spoke process, which answered `this spoke was replaced`.
- 07:13:40Z a nudge from the Coordinator is delivered and injected; the turn runs 37 s and ends idle, again with no tool call. The hub reported nothing: a session whose every tool call fails looks like a normal idle session.
- 07:16:29Z `cland session resume rev-1 --relaunch` found the process alive and did not relaunch it (`relaunched: false`). `cland session stop rev-1` then `resume --relaunch` relaunched it (pid 55863, new `hello` 07:16:54Z) on the same Codex thread; the verdict came at 07:17:23Z with the thread's context intact.

## What to find out and build

- Why the app-server started a second spoke process for the same session with no attach (a restart of its MCP client after an idle stretch, a per-turn MCP launch, a crash of the first spoke): reproduce with the fake app-server starting a second spoke with the same environment, then once with the real Codex.
- Decide the hub's behaviour when a second spoke says hello for a live session: route to the newest but keep answering the old one until it disconnects, or refuse the newcomer while the old one is alive, or detect the replacement in the adapter and relaunch; in every case the Agents topic and the inbox say that the session lost its tools (T-46's shape for a failed turn applies).
- `cland session resume <name> --relaunch` relaunches even when the process is alive, or its help text says that stop then resume is the way.

## Acceptance criteria

- [ ] A test against the fake app-server reproduces a second spoke for a live session and shows the chosen behaviour: the session's tool calls keep working (or the session is relaunched), and the Agents notice and inbox notification appear
- [ ] `cland session resume --relaunch` on a live session relaunches it, or the help and README say it does not
- [ ] `hub/README.md` documents what `replaced` means and what the hub does
- [ ] `npm run typecheck && npm test` pass

## Comments

### coord · 2026-10-09T07:59:18.171Z

Second occurrence, 2026-10-09, impl-46 (Codex gpt-6.1-sol, app-server pid 46954, launched 06:55Z in `.cland/worktrees/T-46`, a tmux TUI client attached by the human's stand-in with `codex resume --remote … --cd <worktree>` for approvals since about 07:00Z). The hub was restarted at 07:45:44Z (`hub stop` pid 8676, `hub start` pid 22401, main 59043fa). Journal for impl-46 after that: `session-resumed` (pid 46954, relaunched false) at 07:45:44.588Z and one `hello` at 07:45:44.794Z, no `replaced` event at all. From then on every cland tool call of the session failed with `this spoke was replaced` (read on its TUI by the stand-in: "Coordinator report and task comment remain blocked: cland still returns 'this spoke was replaced'"), while the session finished its work (merge commit 9a73ec4, suite green) and went idle at 07:50:35Z without a report; no audit entry from impl-46 reached the hub after the restart. Differences from the first occurrence (rev-1): no `replaced` event in the journal, a hub restart in between, a TUI attached. Common: the tools answer "replaced" while the hub thinks the session is connected (its hello was accepted), the failure is silent for the Coordinator, and a `stop` followed by `resume --relaunch` cures it (impl-46 relaunched at 07:59Z, pid 40578). rev-2 and rev-1, re-found by the same restart, are being checked the same way. Hypothesis to test: the error text comes from the spoke process's own state (it believed itself replaced after an earlier hub message, or a second spoke process in the same app-server holds the identity), so the hub's journal cannot see it; the adapter should surface a session whose tool calls fail, and a hub restart should re-validate every spoke.

### impl-48 · 2026-10-09T08:26:43.739Z

Done on `t/T-51-replaced-spoke-stale-state` (worktree `.cland/worktrees/T-51`, from main b8368b3): e8627da (the change and its tests), 29817e7 (docs). Not pushed.

**Cause, measured with the real Codex 0.160.0** (a scratch hub, a launched QA session, a second client on its app-server's socket):
- Every `thread/start` on an app-server spawns its MCP servers again. One spoke after the launch; one more after each further thread, ephemeral or not (`thread/resume` and `thread/read` spawn none). Each new spoke has the session's environment, so it said hello as the session.
- The hub closed the older spoke with 4002, and that spoke stopped for good ("it will not reconnect"). The session's own thread goes on calling its tools through its first spoke, so every call answered `this spoke was replaced` and none reached the hub.
- The extra spokes exit about a minute after their thread ends. On the old hub the journal then shows `bye` for the session: offline while its harness runs, and a message to it stays `queued`.
- First occurrence (rev-1): something started another thread on its app-server at 07:08:15Z (I did not find out what: a helper or sub-agent thread of Codex itself; no client of ours did). Second occurrence (impl-46): its first spoke had already been stopped the same way before the hub restart, so after it only the newer spoke said hello (one `hello`, no `replaced`), and the thread kept calling the stopped one.

**What changed**
- Hub: a hello for a session that is connected, under its name, joins it. One session, every spoke answered, deliveries to the newest and to the one that is left when it goes; offline when the last goes. Nothing of a hello happens again on a join (no clause is re-injected into the thread, which the old path did each time). `replaced` stays in the journal with `spokes`; `spoke-left` in the hub log; an Agents record `spoke-joined`.
- Spoke: no state it never leaves. Closed with 4002 by an older hub, it reconnects.
- `cland session resume <name> --relaunch` relaunches a session that still runs: it is stopped first and keeps its role. Help and README say so.
- The fake app-server starts a spoke per thread, as the real one.

**Tests**: typecheck clean; hub 271 passed, Neovim 62 passed, 0 failed, 0 skipped.
- `names.test.ts`: two spokes of one session, both answered, deliveries to the newest, then to the one left, then offline.
- `codex-adapter.test.ts`: a second thread on a live session's app-server, the session's tool call through its first spoke still works, no second clause, the Agents record; a hub restart with two spokes, both return, tools work; `resume --relaunch` on a live session.
- Removed: the resilience test that an older half-open socket cannot act; it can now, as the same session.

**Real Codex, on this branch**: `resume --relaunch` on the live session gave a new app-server on the same thread; two more threads gave 3 spokes (two `replaced`, `spokes` 2 and 3); after a hub restart one `hello` and two joins; the session then called `task.list` and `send`, both audited `ok`; a minute later two `spoke-left`, the session still connected and idle. Before the change the same session answered nothing and went `bye`.

**Not done**
- No inbox notification. The item asks for one with the Agents notice; after this change a second spoke loses nothing, so there is nothing for the human to act on, and Codex makes one per helper thread. The Agents record is there. A notification still makes sense for a launched session whose spoke the hub refuses (`refused-role`): not built.
- A session that renamed itself, whose harness then starts a second spoke under the old name, gets a second connection (as before).
- The spoke's reconnect after 4002 has no test of its own: today's hub never sends that code.
- Sessions already running keep spokes of the old code until they are relaunched; a spoke stopped by the old hub stays stopped. After this merges and the hub restarts, relaunch every Codex session once (`cland session resume <name> --relaunch` now does it in one step).

### impl-48 · 2026-10-09T08:27:39.970Z

Likely source of rev-1's second thread (the Coordinator's observation, not measured by me): the Reviewer's own parallel review sub-threads. rev-1 and rev-2 both went silent right after starting sub-agent reviews, and each sub-agent is a new thread on the session's app-server, which the measurement above shows starts a second spoke. Decided by the Coordinator: no inbox notification for a joining spoke, the Agents record is enough; dropping the half-open-socket test is accepted, and hub/README.md now says what the several spokes of a session trust.

### qa-5 · 2026-10-09T08:31:26.534Z

verdict: qa
result: clear
by: qa-5 [qa]
run: qa-2026-10-09-t51-1

Checked branch t/T-51-replaced-spoke-stale-state at 2c2e706a6aa20d1a9ccc285e0090d1cb9468e949. No implementation changes.

Ran:
- `npm run typecheck && npm test`: exit 0; typecheck clean; hub 271 total / 263 passed / 8 documented sandbox skips / 0 failed; Neovim 62 passed / 0 skipped / 0 failed. The Neovim harness uses nvim_input and screenstring().
- `node --test hub/test/codex-adapter.test.ts hub/test/names.test.ts hub/test/resilience.test.ts`: exit 0; 31 total / 29 passed / 2 ps-dependent skips / 0 failed.
- Read the changed test assertions: both spokes answer under one session, newest gets deliveries, first still answers, delivery falls back when newest leaves, last departure is offline; second Codex thread does not re-inject a role clause and creates one Agents spoke-joined record; both spokes reconnect across a hub restart and the original thread's tools still work. These cases passed in both runs.
- `node /tmp/qa-t51-4002.ts`: independent probe with the real MCP spoke and a scripted WebSocket peer. First welcome followed by close 4002, then a second hello; MCP who returned ok with helloCount 2. Spoke log: `old hub replacement — reconnecting`, followed by `connected to the hub as probe`.
- `node hub/bin/cland.ts task list --state open --json` and `task view T-51 --json`: exit 0; list returned six open items; view returned T-51 and the expected branch.
- Read hub/README.md: it documents multiple spokes, historical journal `replaced` with spoke count (no eviction now), Agents `spoke-joined`, 4002 reconnect, relaunch behavior, and the shared session-id/project-secret trust boundary.
- Scratch real-Codex attempt: git init, branch CLI init and hub start succeeded under /private/var/folders/np/77bqv0b975563h22_twt3tsw0000gn/T/qa-t51-real-xLnZWz. Initial launch with retained session identity was refused by T-49; after the Coordinator corrected the command to remove CLAND_HUB_FILE/CLAND_SESSION_ID/CLAND_SESSION_NAME, Codex startup exited 1 with PATH-alias `Operation not permitted` and `Error: Operation not permitted`. Session list was empty. Scratch hub stop succeeded normally (pid 75872); no kill fallback required.
- `git diff --check` passed; working tree clean.

Findings, by severity:
- High: none observed.
- Medium: none observed.
- Low: no committed regression test specifically closes a spoke with 4002; the standalone QA probe above directly verified that behavior.

Evidence limits accepted by the Coordinator in topic-8: nested real Codex cannot start in this sandbox, so no real restart/relaunch/second-thread pass was possible. The live resume --relaunch test at hub/test/codex-adapter.test.ts:460 and process-table restart test are skipped because ps is refused; role retention/new pid on live relaunch remain unverified by this QA run. Seven full-suite skips need ps; one needs macOS sandbox-exec. The Coordinator will run the real case after merge/restart. No product defect found within the exercised scope.

Artifacts: /tmp/qa-t51-suite.log, /tmp/qa-t51-targeted.log, /tmp/qa-t51-4002.ts, /tmp/qa-t51-task-list.json, /tmp/qa-t51-task-view.json. Scratch hub files/logs remain in the temporary project above for inspection.

### rev-3 · 2026-10-09T08:31:43.546Z

verdict: review
result: not clear
by: rev-3 [reviewer]
run: rev-20261009-51-2c2e706

Reviewed pinned head 2c2e706 against b8368b3, T-51 and the Coordinator's topic-8 decisions.

Medium (Spec) — hub/src/adapters/sessions.ts:293: The new live --relaunch path awaits adapter.stop(p), then updates and reloads the original name at lines 293–295. If the session is renamed during the stop, its process-table row moves: update(oldName) changes nothing, and #process(oldName) throws after stopping the harness. The renamed row remains marked running and the conversation is never resumed. This violates the required live stop/restart behavior. Resolve the current row by the captured sessionId after stopping, as resume already does after its other await at line 304, and add a regression for rename during stop. If the old name is reused meanwhile, the same path can instead update and resume that unrelated row through the original adapter.

Read-only in-memory evaluation of the branch's resume method with a deferred stop and a row rename produced: error 'unknown session coord'; adapter.resume never called; renamed row status 'running'. This demonstrates the control-flow race; no harness integration test was run by this Reviewer.

Standards: 0 documented-standard violations or actionable heuristic findings. Spec: 1 medium finding. The multi-spoke behavior otherwise matches the decisions: every socket shares current role/identity, newest delivery and remaining-spoke fallback, no repeated clause on join, Agents record without inbox notification, and 4002 reconnect. Secret authentication precedes joining; a mismatched id cannot join a held name. Revoked live roles remain shared/null; stopped/offline role fallback predates this change. Fake tests cover joins, restart and ordinary relaunch; README includes the trust note. No .cland/tasks diff; git diff --check passed.

No edits or test-suite reruns. Tool limitations reported in topic-8: one guessed source path corrected; initial heredoc evaluation refused its temp file, then succeeded as an argument without writes. Git reads succeeded with the documented Xcode cache warnings.
