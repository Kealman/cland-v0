---
id: T-514
kind: task
title: "heartbeat test: missed-heartbeat-after-restart case asserts a wall-clock delta of at least 950 ms that load breaks (Mac)"
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by:
  - T-508
regression_of: T-454
topic: topic-318
branch: t/T-514-heartbeat-test-missed-heartbeat-after
created: 2026-10-15T16:40:31.606Z
updated: 2026-10-15T19:13:47.013Z
---

## Problem

`hub/test/heartbeat.test.ts:106`, 'a missed heartbeat survives hub restart and fires once rather than replaying missed intervals', failed on the Mac under load in T-485's verify 34841ef7 (A-3169): the assertion that the timestamp delta is at least 950 ms was false. The case measures wall-clock spacing across a hub restart, which load can compress or stretch. It's T-454's test, so it's rework of T-454. The same file also has T-506 (stale-observation aging) and T-508 (run-digest teardown).

## Acceptance criteria

- [x] C1. The case proves "fires once, no replay" with an injected or controlled clock and observed heartbeat events, rather than a wall-clock delta, and keeps the at-most-once assertion. The root cause is recorded in the commit.
  - done: impl-514 · 2026-10-15T19:11:17.355Z
  - verified: rev-30 [reviewer] · run rev-20261015-514-source · 2026-10-15T19:13:23.975Z · commit df6693869d0d2a9e76dffd847a15fae594a19a1a
- [ ] C2. heartbeat.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify. Coordinate with T-506 and T-508, which touch the same file: whichever lands second picks the first.

## Comments

### coord · 2026-10-15T19:06:42.952Z

Second signature of this case: heartbeat.test.ts:87 expected 2 firings and got 3 after a hub restart, on Linux in T-508's run c19b825b (A-3280:4028–4044). Same wall-clock restart race. C1's controlled clock must cover the firing count too.

### impl-514 · 2026-10-15T19:09:01.416Z

Using acceptance-defined seam: persistent hub store reopened by a fresh startHub, injected now and controlled scheduler ticks, assertions through heartbeat messages/topic history. Historical Mac A-3169 and Linux A-3280 supply both exact failing signatures; skip load amplification for this test-only race fix. Ranked causes: (1) extra ordinary firings between history observation and stop/restart under real time, predicts exact frozen-clock counts remove both failures; (2) missed intervals replayed on restart, predicts multiple firings even at frozen time; (3) schedule not persisted, predicts no immediate overdue firing after reopen. Will test (2)/(3) with controlled-clock boundaries without changing production.

### impl-514 · 2026-10-15T19:12:18.712Z

Implementation committed/pushed at df6693869d0d2a9e76dffd847a15fae594a19a1a; origin/dev freshly fetched and already merged. C1 done; root cause in commit and A-3283. A-3284 contains five serial quiet whole-file Mac passes, each 9/9 with natural exit, 15.184–16.995s; changed case 0.180–0.193s. All guards local:none/free/load<15 before each pass. Typecheck green; replay mutant fails 4 vs 2 and production restored. Source review request delivered to Reviewer; C2 droplet portion pending clear source verdict. T-506/T-508 are already ancestors.

### rev-30 · 2026-10-15T19:13:23.975Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-514-source
commit: df6693869d0d2a9e76dffd847a15fae594a19a1a
scope: full

Source review T-514 clear at df6693869d0d2a9e76dffd847a15fae594a19a1a, fixed point parent a59514aefb3e5effe1c49ce9f6a3829a943540a6. No high, medium or low findings. Standards and Spec reviewed directly under Reviewer no-delegation role.

Standards: only heartbeat.test.ts restart case/imports change. Real persistent Store is reopened by a new startHub instance on the same port; stable Coordinator spoke and WebSocket history remain public observation boundaries. Injected now controls deadlines, Node test-scoped setInterval ticks control scheduling, and real IPC/setTimeout progress remains available. HeartbeatTick writes notices/schedule synchronously within its store transaction, so ordered history requests observe completed ticks; no arbitrary negative sleep or widened timing budget is added. Shared onCleanup closes the spoke before beforeDirectories closes the current hub and fixture removal; manual first-hub close permits actual store reopen. Production source is unchanged.

Spec/C1 verified: frozen clock first establishes zero then one firing. After closing the first hub, logical time advances950ms (>three300ms intervals); reopening the real DB and ticking the new scheduler must yield exactly two total. Repeated ticks at frozen time and logical +299ms keep two; +300ms requires exactly one next ordinary firing (three total). This preserves at-most-once/no-replay and schedule-persistence proof while replacing the unreliable wall timestamp delta. Commit records the extra ordinary firings during wall-clock stop/start/IPC as the root cause of both historical signatures (A-3169 spacing, A-3280 count3!=2). The test would fail on a lost persisted schedule or replaying missed deadlines.

A-3283/A-3284 reviewed. A-3284 includes five quiet serial Mac whole-file logs:9/9 each,45/45 total, no failure/cancellation/skip, natural exits15.184–16.995s, changed case0.180–0.193s. Reported admission checks are local:none, free target slot and load1.75–2.39. Typecheck log is green; whitespace check is clear. The reported replay mutation changes next deadline from now+interval to previous schedule.next+interval and fails the exact two-firing assertion (4!=2); production was restored. Mutation execution was requester evidence, not a Reviewer run.

Coordination: parent heartbeat history includes merged T-506 and T-508; their source changes remain present. No duration entry or new test identity is needed for the replacement. C2 Mac portion is established, but C2 remains unverified until an acceptable actual-droplet receipt at the reviewed head. Source clear permits the directed no-mode/no-executor cland verify under current Coordinator admission rules; inspect actual Executor/platform because a local fallback cannot establish C2's Linux requirement. No per-item QA criteria.

No Reviewer tests, edits, commits, merges or provider calls.

Criteria: C1 verified.

### impl-514 · 2026-10-15T19:13:47.013Z

Source review clear at exact df669386, C1 verified (A-3285). Submitted no-mode/no-executor task verify c78c5594-f530-41e6-a407-621545de3e37 with report topic-318 to Reviewer and impl-514. Clean tree, unchanged reviewed head. C2 awaits actual droplet/platform receipt and final evidence review; retaining claim until merge.
