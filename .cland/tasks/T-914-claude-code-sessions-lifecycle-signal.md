---
id: T-914
kind: task
title: claude-code-sessions-lifecycle 'signal order… a Stop whose hook process started slowly…' fails one load-gate repetition in five (stage cover ad5da9f3)
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
regression_of: T-897
found_by: cover
topic: topic-657
branch: t/T-914-claude-code-sessions-lifecycle-signal
created: 2026-10-19T22:34:27.917Z
updated: 2026-10-19T22:36:40.456Z
---

## Summary

Stage cover #1's Linux run ad5da9f3 at b62bf16c (A-6763, line ~57427) failed one of five load-gate repetitions of `hub/test/claude-code-sessions-lifecycle.test.ts::signal order is the order the harness fired them: a Stop whose hook process started slowly does not outrank the next turn start` with "coord present as busy: not within 5000 ms" at peak load ~9.8. T-897 moved the test into the lifecycle file, so the load gate saw it as new. The other tests in that file passed 5/5.

## What to build

Make the test wait on the observable signal order, not on a wall-clock window that load can exceed. Use the T1/T2 seams (FakeClock, scripted fake harness) if the ordering rule can be shown there, and keep one T3 lifecycle case. Never loosen what it asserts.

## Acceptance criteria

- [ ] C1. The cause is named in the task report with the failing repetition's evidence from A-6763.
- [ ] C2. A deterministic T2 signal-order regression passes the load gate's five repetitions in a mode-free droplet verify at the reviewed head, and the lifecycle file passes 20 serial local runs, with both receipts in the report; the T3 case's load-gate pass is landing evidence from the next stage cover, not a criterion.

## Comments

### impl-914 · 2026-10-19T22:36:40.456Z

A-6763 line 57427: load repetition 1 failed busy presence after 18.974s; base case passed in 4.466s. Fixture flaw: a 10-second real fallback poll was described as suppressed, but can overwrite manual busy with actual idle once 100-ms push trust expires; first clause busy/idle also did not prove final mod completion drained. No per-fixture trace distinguishes the exact interfering signal. Changed the real-hook T3 test to scripted in-process harness/FakeClock (presence and stale-drop assertions preserved) and added deterministic T2 timestamp-order coverage after 20s of fake time. No tests run while cover-quiet is active; receipts pending.
