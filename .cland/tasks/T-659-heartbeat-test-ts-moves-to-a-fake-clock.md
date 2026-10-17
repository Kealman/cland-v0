---
id: T-659
kind: task
title: heartbeat.test.ts moves to a fake clock in one sweep
state: open
status: review
size: M
criterion_seq: 3
labels:
  - v0.1.4
  - flaky
  - hub
assignee: null
parent: E-676
blocked_by:
  - T-685
topic: topic-415
branch: t/T-659-heartbeat-test-ts-moves-to-a-fake-clock
created: 2026-10-16T16:29:56.765Z
updated: 2026-10-16T23:42:01.446Z
---

## Summary

heartbeat.test.ts collected five flake tickets in a row (T-506, T-508, T-514, T-530, T-568): each fixed one wall-clock wait and the next one broke (A-4004, recommendation 3). Move the whole file to an injected clock in one sweep, so no case depends on real elapsed time.

## What to build

The heartbeat scheduler takes T-685's Clock (moved into E-676 under D53) and timer source, with the real one as the production default. heartbeat.test.ts drives digests, intervals, folding into busy turns and staleness by advancing the fake clock, and asserts on events, not elapsed milliseconds. Every existing assertion's meaning is kept.

## Acceptance criteria

- [ ] C1. Every heartbeat.test.ts case runs on T-685's FakeClock through projectHub or createHubBase, with no real-time sleep or elapsed-ms assertion left in the file, and an audit shows its test declarations and assertion meanings unchanged.
  - verified: rev-31 [reviewer] · run rev-20261016-659-source · 2026-10-16T23:42:01.446Z · commit 2d6641d31f97336939d6ea061ca636e0632fe33b
- [ ] C2. heartbeat.test.ts is tagged T2 (or T1 where no socket remains) in tiers.json, passes the tier lint, and its manifest seconds fall from 25.7 s to 5 s or less, with its startDaemon and spawnSpoke call sites (5 and 8 at f63afbac) at zero.
- [ ] C3. heartbeat.test.ts passes 20/20 serially on the Mac under the current crew load, and in the task's droplet verify.

## Comments

### impl-659 · 2026-10-16T23:36:24.102Z

Read amended C1–C3, E-676 and Test levels. Existing claim confirmed. Migrating all nine heartbeat cases to FakeClock with in-process peers/adapters; audit will accompany review.

### impl-659 · 2026-10-16T23:40:48.398Z

Source committed/pushed 2d6641d31f97336939d6ea061ca636e0632fe33b; review requested from Reviewer in topic-415. Audit A-4254; Mac 20/20 logs A-4253, each run 9/9, whole-file wall median 1.005105 s/max 1.336251 s under load 5.37–5.66. Typecheck, test:tiers, fake-harness 4/4 and diff check pass. C2 duration manifest deferred to Coordinator's integrated stage-close refresh per db496368-1f97-476a-b5f5-c997c97cdda0. Droplet verification waits for source clear and hold lifted.

### rev-31 · 2026-10-16T23:42:01.446Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-659-source
commit: 2d6641d31f97336939d6ea061ca636e0632fe33b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards0/Spec0 findings, A-4256. Read all3changed paths and independently compared all9 original declarations/assertion meanings with A-4254. FakeClock plus projectHub/createHubBase replaces real scheduling and child harnesses; exact delivery/watcher receipts remain, durable Store reopening preserves overdue/no-replay boundaries, typed run/lease facts preserve digest inputs, and rename/revocation/aging/caps assertions remain. Adapter waitingForApproval uses existing signal path. Process-launch/sleep/elapsed assertion callsites zero; T2 entry correct; diffcheck clean/typecheck+tierlint reported green. A-4253 Mac20/20 all9/9, max1.336251s supports source. C1 verified; C2 awaits Linux file<=5s, C3 exact-head task droplet. Coordinator db496368 independently read: duration manifest refresh deferred to integrated stage close, not local evidence. No verify until hold lifted; source clear is not final execution clear. No Reviewer edits/tests.

Criteria: C1 verified.
