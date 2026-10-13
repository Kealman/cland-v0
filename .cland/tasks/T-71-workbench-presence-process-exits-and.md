---
id: T-71
kind: task
title: "Workbench: presence, process exits and token totals as hub events, so
  the sessions panel stops polling session.list"
state: closed
status: done
labels:
  - ready-for-agent
  - slice-2
  - hub
  - nvim
assignee: impl-71
parent: E-20
blocked_by:
  - T-67
topic: topic-24
branch: t/T-71-sessions-panel-events
created: 2026-10-09T10:46:33.920Z
updated: 2026-10-10T00:58:17.791Z
closed: 2026-10-09T14:26:56.305Z
---

## Parent

Part of T-20. Proposed by impl-67 from T-67 (artifact A-2, 2026-10-09 10:45Z); filed by the Coordinator. T-67 removed the items poll (`task` events carry every item change) and made the sessions refresh single-flight; this item removes the last timer.

## What was measured (nvim/lua/cland/init.lua before T-67)

- The items timer asked `task.list` every second while items were on screen; the 5 s timer asked it too. Removed in T-67 (c55de88).
- The 5 s timer runs `refresh_sessions`: `session.list`, `hub.status`, `role.list`, `inbox.list`, four requests. Still runs, single-flight since T-67. It also ran on `role.vacant`, `role.filled`, `session.role` and on every `session.state` of an unlisted session: a burst of N events asked 4N requests; since T-67 once, plus once after the first answer.
- On connect the workbench reads everything once.
- The journal of the 10:15Z incident shows about two `session.list` and two `task.list` per second from nvim, from more than one workbench.

## What still needs the poll, and why

- Presence: a spoke connecting or leaving emits no event; the panel learns it from `hub.status`.
- A launched process that ended: `session.state` goes `unknown`, but the row's status (exited, died, attach cleared) arrives only with `session.list`.
- Token and cost totals (`usage` on the process rows): no event.

## What to build

- Hub events for the three: presence changes, process-table changes (the row), and usage updates throttled per session.
- The workbench applies them and drops the sessions timer; it keeps the one read on connect.

## Acceptance criteria

- [ ] The workbench asks `session.list` and `hub.status` only on connect and after a launch or stop it made itself; a headless test counts the requests through the stub hub over several seconds
- [ ] Presence, a process exit and a usage change show without a poll (tests through the stub hub's `emit`)
- [ ] `npm run typecheck && npm test` pass; hub/README.md documents the new events in "The UI's frames"

## Notes

Size S. Blocked by T-67. Implementer: Codex gpt-6.1-sol or Claude Code.

## Comments

### coord · 2026-10-09T11:23:58.673Z

Three low findings from qa-cc2's QA of T-67 (qa-cc2-67-1). They are out of T-67's scope and belong here:
1. nvim/README.md:52 still describes the `task.list` polling that T-67 removed.
2. The workbench sends `inbox.list` twice per connect (init.lua:113 and topic_view.lua:62), so every connect logs a `too-fast` line.
3. The request budget times only the synchronous part of a handler (dispatch.ts:706), so a request stuck waiting on async git never shows as `slow-request`. Time each handler until its answer is sent, and record async waits as well.

### impl-71 · 2026-10-09T13:32:29.682Z

Claimed. Inspecting hub event boundaries and the headless request-count harness; will cover presence, process rows and throttled usage, remove timer-driven refreshes and duplicate inbox reads, and verify the async request timing already on main.

### impl-71 · 2026-10-09T13:41:52.195Z

First implementation milestone: presence snapshots and process-table row events reach subscribed clients; usage bursts coalesce per launch with a trailing 1 s snapshot. The sessions timer and event-triggered list refreshes are removed. Shell/topic views share one inbox read per connection. New transport tests pass for hello/status/role/rename/last-spoke departure, process launch/model/role/rename/exit/stop and per-session usage bursts. Async waits use a separate slow-answer event/counter with a 5 s threshold; existing slow-request blocking counters retain their meaning.

### impl-71 · 2026-10-09T13:54:03.242Z

Implemented and committed as f59914925afb943e1e4e41a941fd1211414aacb4 on t/T-71-sessions-panel-events (hash read back from git log -1). Worktree clean; no push/merge. Final npm run typecheck && npm test passed: 371 hub + 91 Neovim = 462 tests, 0 failed/skipped; full suite invoked once through the package lock. Headless counts prove one connect snapshot, zero timer/event refreshes over 5.5 s, reconnect reads once, and own launch/stop reads once more; presence, exit, usage, rename and roles update via emitted events. Shared inbox removes duplicate connect reads. Separate 5 s slow-answer latency event/counter preserves slow-request's blocking meaning. Final report: artifact A-64 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-64-t-71-completed-events-request-counts-and-test-results.md.

### qa-12 · 2026-10-09T13:58:28.312Z

verdict: qa
result: clear
by: qa-12 [qa]
run: qa-12-71-1
commit: f59914925afb943e1e4e41a941fd1211414aacb4

Read item/A-64; used git archive f599149 with T-71 node_modules. No source fixes or duplicate full suite.

Ran npm run typecheck (pass); node --test hub/test/session-events.test.ts hub/test/request-guard.test.ts (6/6); node --test nvim/test/shell.test.ts (50/50); independent node --test live.test.mjs (1/1), all zero failures/skips. Scratch cland task list/view passed.

Real scratch hub plus one headless Neovim using project's nvim_input/screenstring harness:
- Journal client=nvim audits: session.list/hub.status/role.list/inbox.list exactly1 each on connect, unchanged after30.001s idle.
- Presence-only spoke row appears and disappears without reads.
- External CLI launch appears; stop immediately shows unknown · stopped with attach cleared, counts unchanged. Per Coordinator clarification, stopped launched rows remain for resume.
- SIGKILL fake PID3168: panel shows unknown · died, attach cleared, no reads.
-20 usage reports coalesced to exactly1 session.usage event in1.258s; panel displayed$2.00 and outputTokens42 (40 added to baseline2). Counts still1.
- Restarted own hub with same Neovim alive: exactly one additional read each, total2; stable another5.5s, no burst.
- cland hub status displays distinct slow and slow answers counters; JSON exposes requests.slow and requests.slowAnswers independently. Targeted guard tests cover threshold separation.

Full-suite criterion per request: A-64 implementation report on this head gives371hub+91Neovim=462passes,0fail/skips; not rerun by QA.

Findings by severity: high none; medium none; low none. Own hubs60419/10814, Neovim60812, fake sessions/spoke stopped; fixture/fake home removed; final scan found no QA-export processes.

Evidence A-66: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-66-t-71-qa-f599149-real-hub-idle-audits-and-live-neovim-events.zip — runnable driver, journal/audits, event counts, screen grids, logs and cleanup.

### rev-65 · 2026-10-09T13:59:22.208Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-71-1
commit: f59914925afb943e1e4e41a941fd1211414aacb4

Medium — hub/src/adapters/sessions.ts:81: new process-row view/publication and synchronous subscriber fanout execute after lifecycle awaits (launch:269, stop:300, resume:332–334) outside the blocking-time guard. A >250ms publication can block the event loop without slow-request; five-second slow-answer latency is a separate metric. Thread resumed measurement through the new lifecycle publication work and cover delayed adapter completion plus slow publication.

Low — hub/README.md:347: still describes sessions polling because presence, exits and usage lack events, contradicting the new protocol and updated UI-frame section.

Standards: 1 low, no hard breach. Spec: 1 medium + 1 low (docs finding shared with Standards). No high. Presence/process/usage events, per-session one-second trailing coalescing, stable-ID usage handling, timer/event refresh removal, shared inbox, headless counts and separate slow-answer counters otherwise match the request.

A-64 records typecheck and one full suite passing: 462 tests (371 hub +91 Neovim), zero failures/skips. Reviewer ran no suite. An in-memory probe using actual Sessions/answerSession/RequestGuard with a fake adapter/table/core and clock advanced 300ms during the post-await publication: publication happened, but slow=0, slowAnswers=0 and no logs. No real delay/spawn/Git/socket/filesystem writes. git diff --check passes; no repository edits.

Full review: A-67, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-67-t-71-review-events-verified-post-await-publication-timing-gap.md

### impl-71 · 2026-10-09T14:00:02.291Z

Addressing rev-65-71-1: pass the existing resumed timing wrapper through ordinary/item-bound launch, stop and resume so process-row publication and other post-await synchronous lifecycle work stay inside the blocking budget. Add a 400 ms publication regression and correct the remaining README timer sentence. Per Coordinator, targeted checks only for this delta.

### impl-71 · 2026-10-09T14:05:05.003Z

rev-65-71-1 fixed in 66e0b5f1ab5192f845d5447e835e65ecc479ea23 (git log -1 read back), clean worktree. The existing resumed wrapper now propagates into ordinary/item-bound launch, stop, resume, live relaunch and item lost-claim cleanup, timing process-row publication and synchronous lifecycle work after awaits. A 400 ms subscriber reproduced the gap before the fix; now launch/item-launch/stop/resume/relaunch each log exactly one slow-request with phase=resumed and no slow-answer. Fixed the stale hub README timer sentence. Typecheck and 17 targeted tests pass (9 guard, 2 events, 4 worktree unit, 2 worktree timing), zero failures/skips. No full suite rerun, per Coordinator instruction. Artifact A-72: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-72-t-71-review-fixes-lifecycle-publication-timing.md.

### rev-65 · 2026-10-09T14:09:36.107Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-71-2
commit: 66e0b5f1ab5192f845d5447e835e65ecc479ea23

Medium — hub/src/adapters/sessions.ts:271 and :288: launch splits one continuous synchronous post-spawn continuation into two independent resumed measurements with no await between; 200 ms of publication plus 200 ms of watch/finalization blocks the loop for 400 ms but logs no slow-request. Ordinary and item-bound launch share this path. Measure the whole continuation once and cover aggregate sub-budget work, preserving cleanup/error behavior.

The original 300 ms publication probe now correctly logs exactly one slow-request/resumed (slow=1, slowAnswers=0). The extended in-memory fake-clock probe with publication=200 ms and watch=200 ms returns success, one publication, slow=0, slowAnswers=0 and no logs. Actual Sessions/answerSession/RequestGuard from verified 66e0b5f were used; no real delay/spawn/Git/socket/database/file writes or suite execution. The five new 400 ms single-publication regressions cannot detect the split-duration case.

Standards: 0 findings. Spec: 1 medium; high/low none. Stop/resume/live-relaunch/lost-claim cleanup wrappers otherwise cover the changed publications, and the stale README timer finding is fixed. git diff --check passes. A-72 reports typecheck and 17 targeted tests passing, zero failures/skips; these were not rerun. Earlier QA/full-suite evidence stands for unchanged feature code.

Evidence and runnable probe: A-75, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-75-t-71-delta-review-continuous-launch-timing-gap.md

### impl-71 · 2026-10-09T14:14:23.115Z

Review regression reproduced: two adjacent 200 ms segments emit no slow-request for launch/item-launch. The same test also exposes relaunch's post-stop publication followed immediately by adapter.resume's synchronous prefix. Stop and ordinary resume already aggregate correctly. Consolidating each continuous post-await stretch before rerunning targeted checks.

### impl-71 · 2026-10-09T14:15:44.667Z

Aggregate timing fixed: launch now wraps publication, cleanup, watch/replay and view in one resumed callback while retaining spawn-error rollback boundaries. Live relaunch includes adapter.resume's synchronous prefix in its post-stop callback. Regression was red for launch/item-launch/relaunch and now all five lifecycle paths pass. Typecheck and 23 targeted tests pass (14 request guard, 2 session events, 4 worktree unit, 2 timed worktree integration, 1 failed-launch role rollback). No full-suite rerun for this delta.

### impl-71 · 2026-10-09T14:16:19.697Z

Committed aggregate timing review fix at 94ef10dd289e1465fbd442605814b9d5b35652c8 (hash read back with git log -1). Clean worktree. A-79 contains changes, red/green evidence and 23 passing targeted checks: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-79-t-71-continuous-lifecycle-timing-review-fix.md. Ready for delta review.

### rev-65 · 2026-10-09T14:18:30.506Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-71-3
commit: 94ef10dd289e1465fbd442605814b9d5b35652c8

Findings by severity: high none; medium none; low none. Standards 0 (clear); Spec 0 (clear).

Reviewed git diff 66e0b5f 94ef10d against the item, earlier verdicts and project docs. Launch now measures its whole post-spawn continuation once, preserving rollback/cleanup boundaries. Relaunch includes policy lookup and adapter.resume's synchronous prefix in the post-stop stretch. The ten lifecycle regressions cover isolated400ms and aggregate200+200ms work, asserting exactly one resumed slow-request and no slow-answer.

Reran the same A-75 in-memory fake-clock probe on verified HEAD94ef10d: publication200ms plus adjacent watch200ms now logs exactly one slow-request (session.launch, review-probe, ms400, phase=resumed); slow=1, slowAnswers=0, result successful. This closes rev-65-71-2. No suite, real delay/spawn/Git/socket/database/file writes or repository edits. git diff --check passes.

A-79 reports typecheck and23 targeted tests passing with0failures/skips; read, not rerun. Earlier A-64 full-suite and A-66 QA evidence stand for unchanged feature code.

Evidence: A-80, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-80-t-71-second-delta-review-continuous-timing-verified.md

### coord · 2026-10-09T14:26:56.303Z

Merged into main as ac932bf (`git merge --no-ff`, by the Coordinator) at 14:19Z. Suite on main a13ae98, with T-59: hub 421/421, Neovim 91/91.
Verdicts: review rev-65-71-1 and -2 not clear, both about untimed lifecycle publication after an await, the second time split across two scopes; rev-65-71-3 clear on 94ef10d. QA qa-12-71-1 clear on f599149: after 30 s idle the workbench had sent each of its four reads once, on connect. Launch, stop, kill and usage reached the panel without a poll, and 20 usage reports became one event. The two commits after f599149 add only timing wrappers and their tests.
What it does:
- The hub emits presence, process-table row and per-session throttled usage events.
- The workbench drops its 5 s sessions timer and reads once on connect.
- One shared inbox read removes the double `inbox.list`.
- `slow-answer` counts total request time with its own counter, apart from `slow-request`, which counts event-loop blocking only.
- Each continuous synchronous stretch after an await is timed as one scope.
Implementer: impl-71 (Codex), launched 13:31Z.
