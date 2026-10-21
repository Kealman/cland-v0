---
id: T-1084
kind: task
title: The idle hub rescans every session row for archiving every 15 seconds
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1006
blocked_by: []
topic: topic-821
branch: t/T-1084-the-idle-hub-rescans-every-session-row
created: 2026-10-21T20:03:06.271Z
updated: 2026-10-21T20:37:46.927Z
---

## Summary

With the Neovim workbench idle, the hub still spends about 9–12% CPU, which keeps E-1006 C2 ("the hub's CPU stays near idle") unmet. In cland-impl's 10-minute quiet sample (2026-10-21 19:51–20:01Z, hub pid 63790), hub.log shows 41 `session-archive-sweep` events, one about every 15 s, each scanning `"rows":248`. The workbench sent zero requests. Two spikes (67.7% and 42%) lined up with an archive batch and the hourly verification-wait P90 computation.

## What to build

The session archive sweep runs only when something can have become archivable (a session stop or exit, a dated threshold reached), or at a much longer interval. It never rescans every row on a fixed 15 s timer. The hourly P90 computation stays bounded.

## Acceptance criteria

- [x] C1. In a scratch hub with about 250 session rows and no activity, the sweep runs at most once in 10 minutes, or only after a session state change (test).
  - done: impl-1084 · 2026-10-21T20:18:25.783Z
- [x] C2. A session that becomes archivable is still archived within the documented delay (test).
  - done: impl-1084 · 2026-10-21T20:24:24.931Z
- [x] C3. A 10-minute idle sample of a hub with the copied live tracker and about 250 session rows shows mean hub CPU under 2%, recorded in the item topic (local evidence; then E-1006 C2 is re-sampled).
  - done: impl-1084 · 2026-10-21T20:18:25.812Z
  - verified: rev-23 [reviewer] · run rev-20261021-1084-source-3 · 2026-10-21T20:28:49.961Z · commit b98af6303da5b975c93df76d5ac512d57f9cf9d5

## Comments

### impl-1084 · 2026-10-21T20:07:26.058Z

Implementation head 266d94a1ecbfef6e4b887f486c8358e26f65d49d (tree 90433ca9822ea735f4ed5a63476beed85eaa58f4). Test-first red receipts: the ten-fake-minute 250-row case failed `no full scan during ten idle minutes: 11 !== 1`; unrelated comments failed `unchanged eligibility does not rescan on item events: 8 !== 5`. Exact checkout had a one-minute timer cap; the live 15-second cadence also motivated ignoring unchanged item eligibility. Green targeted local Darwin arm64 evidence: session-archive.test.ts 11/11; inbox-workload.test.ts 8/8; suite-wait-metrics.test.ts 5/5. Hub typecheck exit 0, test lint report-only with zero refusals. No full suite submitted yet; source review precedes mode-free verification. C3 diagnostic started 20:07:10Z with 1,084 copied canonical tracker files, 250 stopped session rows, real hub clock and scratch HOME/XDG/Git/accounts; CPU result pending. No role clause edited; timing/guidance in hub/README.md and docs/agents/tests.md.

### impl-1084 · 2026-10-21T20:18:25.773Z

C3 completed on exact committed head 266d94a1ecbfef6e4b887f486c8358e26f65d49d, tree 90433ca9822ea735f4ed5a63476beed85eaa58f4, local Darwin arm64. `node hub/scripts/measure-idle.ts /Users/evgeniyivanov/Projects/cland/v0/.cland/tasks` ran an isolated embedded hub with 1,084 copied canonical live tracker files and 250 stopped synthetic session rows. Real idle window 2026-10-21 20:07:10.673–20:17:10.675Z, actual elapsed 600000.413 ms; mean process CPU 0.452055%, below enforced diagnostic 2% bound. All ten minute samples 0.325–0.674%; archive sweep count 1 including startup, none during sample. Scratch HOME/XDG/Git/accounts; no live source hub connection or native harness. This is local diagnostic evidence, not a verification suite pass or E-1006's live-workbench re-sample. Separate actual hourly P90 function on 10,000 scalar receipts: five samples 4.086, 3.071, 2.564, 2.571, 2.437 ms; excluded from idle CPU and no suite timing gate claimed. Existing once-per-hour durable checkpoint and percentile behavior remain unchanged and targeted tests pass. Scratch hub shutdown receipt recorded; process exited 0 and fixture cleanup completed.

### rev-23 · 2026-10-21T20:21:34.746Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-1084-source
commit: 266d94a1ecbfef6e4b887f486c8358e26f65d49d
scope: full
findings: [{"severity":"medium","text":"M1: No polling timer remains after a sweep skips the only pending-stop row. Failed resume/relaunch recovery can preserve that stopped row and settle later, after the normal lifecycle slot has released. #settleFailedLaunch clears pendingStops and emits session.cleanup but never schedules archiving; restoration's table observer is suppressed while pending. The now-eligible row may never archive without unrelated activity. Schedule a coalesced sweep after successful pending recovery and add a fake-clock/deferred cleanup regression proving overdue retained rows archive after settlement without another event.","file":"hub/src/adapters/sessions.ts","line":613}]
finding_counts: {"high":0,"medium":1,"low":0}

Full six-file audit against captured base341b671f; one medium Spec finding, no separate Standards finding. A-8691 original local10-minute CPU0.452055%/1084 copied tracker files/250 stopped rows meets the stated local diagnostic bound with embedded fixture probes/adapters; not live E-1006 or suite proof. New T2 idle/threshold tests and documentation otherwise align. Detailed path proof in source artifact. Preserve original targeted/red stdout/exit/command/source provenance without rerunning solely for transcription. Fresh corrected-head source review before mode-free verify; Coordinator full lifecycle cover remains separate; QA none.

Criteria: C2 failed (A stopped row retained through pending failed-launch recovery can become eligible after cleanup settles without any sweep/timer being scheduled, delaying archive indefinitely.).

### impl-1084 · 2026-10-21T20:24:24.947Z

Reviewer M1 fixed at pushed head fe844764ad088754f81ebabbf7eb2dbbfc59fd6c / tree 8a99d7e506e1a66162cb6f5a146afcf2b3f7d9c4. #settleFailedLaunch schedules a coalesced archive pass only after clearing the pending-stop fence. Two deferred file-rollback tests preserve the stopped row after lifecycle release, observe cleanup completion without unrelated events, then assert overdue archival or a future dated deadline. Original red: both fail `recovery settlement wakes the archive sweep: 2 !== 3`. Final full targeted archive file 13/13 passes locally on Darwin arm64, typecheck exit 0, test lint report-only zero refusals. Intermediate test teardown timer-mock failure and its fixture-only correction are retained transparently in recovery evidence. Original earlier targeted/red tool-output excerpts preserved in A-8694 without re-execution. C3 diagnostic A-8691 remains explicitly at parent 266d94a1; new recovery wake is inactive in its quiet fixture, no final-head CPU remeasurement claimed. No dev merge after first review. Fresh source review precedes configured verification.

### rev-23 · 2026-10-21T20:25:48.544Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-1084-source-2
commit: fe844764ad088754f81ebabbf7eb2dbbfc59fd6c
scope: full
findings: [{"severity":"medium","text":"M2 Standards: The new componentHub/projectHub scheduling test globally mocks setInterval and cancellation with t.mock.timers.enable/tick. docs/agents/tests.md:874–892 explicitly forbids global timers here and requires injected time while native socket/journal/I/O timers retain real time. The reset hook fixes teardown only. Use an owned retry Clock/scheduler seam or smaller injected Sessions fixture, preserving both recovery deadline cases, rollback/public receipts and final assertions; do not substitute sleeps or widen bounds.","file":"hub/test/session-archive.test.ts","line":165}]
finding_counts: {"high":0,"medium":1,"low":0}

M1 production fix resolved: after pending-stop fence clears, coalesced archive scheduling wakes preserved rows. Local red controls and13/13 green/source attribution preserved in A-8694/A-8695; global interval fixture still violates explicit scheduling policy, sole remaining medium finding. No new functional criterion failure fabricated. A-8691 stays parent-head CPU evidence, not current-head measurement/live workbench proof; changed recovery path inactive there. Fresh source review before mode-free verify; Coordinator full lifecycle cover separate, QA none. See corrected-source artifact for Standards/Spec details.

### impl-1084 · 2026-10-21T20:27:43.396Z

M2 corrected at b98af6303da5b975c93df76d5ac512d57f9cf9d5 / tree 0a57ce4298e6b0583939319aa97198387b9401f1. Sessions-local recoveryClock defaults to realClock; both recovery tests now use a smaller explicitly owned Sessions fixture sharing FakeClock with hub scheduling, without global timer mocks. Both deadline cases retain actual rollback completion and public cleanup/archive assertions. Full archive targeted file 13/13 green on Darwin arm64, hub typecheck 0, lint report-only zero refusals. Deliberate mutation control removing only settlement wake makes both revised cases fail 2 !== 3; source restored before commit. Original outputs/provenance in A-8699; no suites submitted before fresh source review, no dev merge.

### rev-23 · 2026-10-21T20:28:49.961Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1084-source-3
commit: b98af6303da5b975c93df76d5ac512d57f9cf9d5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

M1/M2 resolved; full source scope retained. Coalesced settlement wake handles preserved rows; smaller Sessions fixture uses one shared injected Clock for core/table/recovery, no global timer mocks; production recovery defaults realClock and both clear paths use the owner Clock. Overdue/future tests retain file rollback/public receipts/exact assertions; A-8699 mutation control fails both cases when wake removed,13/13 targeted green plus typecheck/lint provenance retained. C3 verified from A-8691 ancestor-head0.452055% ten-minute local sample plus unchanged quiet-path dependency reasoning (recovery inactive; default retry clock identical); no new-head CPU/live E-1006 claim. C1/C2 final runtime settlement awaits same-head configured mode-free and Coordinator full pre-merge lifecycle cover. QA none. Detailed audit in source-clear artifact.

Criteria: C3 verified.

### impl-1084 · 2026-10-21T20:37:29.049Z

Same-head mode-free verification edbdf7f5-03c5-4f58-a8ba-39397fce1d9f passed (exit 0), artifact A-8703, reviewed head b98af6303da5b975c93df76d5ac512d57f9cf9d5 / tree 0a57ce4298e6b0583939319aa97198387b9401f1. Executor droplet c-8 lon1, Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5, workers 2; lifetime 450 s, cost $0.0312. Actually completed host check/T0, T1, fallback all T2 in hub and Neovim, plus Web. 2,355 total executions passed; zero failures/cancellations/skips/todo. Duration budgets/test lint remain report-only; over-budget warnings are retained in A-8703 and do not represent enforcing budget passes. T3 did not run: deferred to periodic/integrated occasions and Coordinator's required full pre-merge lifecycle cover. No claim of full integration or fresh-head CPU measurement. Reviewer same-head final settlement and Coordinator full cover remain outstanding; no merge performed.

### rev-23 · 2026-10-21T20:37:46.927Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1084-task-evidence
commit: b98af6303da5b975c93df76d5ac512d57f9cf9d5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-8703 exact-head task receipt audited: exit0,2355 ordinary tests/361 files plus20 distinct load tests/files, all pass/no skips/failures/cancellations. Four owned new identities each5/5 with explicit summaries8463/8616/8700/8823; max load1.910082337s. All13 archive tests pass. Actual T1/all fallback hub+Neovim T2/Web pass; no T3/T4. Task evidence supports C1/C2, but final marks/verdict remain pending separately required Coordinator-owned full pre-merge lifecycle cover. C3 prior source/ancestor-measurement assessment retained, no new CPU/live E-1006 claim. Host gate reused; lint132/59, six missing baselines and budgets/resources/ratchet report-only. Detailed artifact preserves receipts and limits. QA none.
