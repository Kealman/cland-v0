---
id: T-914
kind: task
title: claude-code-sessions-lifecycle 'signal order… a Stop whose hook process started slowly…' fails one load-gate repetition in five (stage cover ad5da9f3)
state: closed
status: done
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
updated: 2026-10-19T22:53:27.569Z
closed: 2026-10-19T22:53:27.569Z
---

## Summary

Stage cover #1's Linux run ad5da9f3 at b62bf16c (A-6763, line ~57427) failed one of five load-gate repetitions of `hub/test/claude-code-sessions-lifecycle.test.ts::signal order is the order the harness fired them: a Stop whose hook process started slowly does not outrank the next turn start` with "coord present as busy: not within 5000 ms" at peak load ~9.8. T-897 moved the test into the lifecycle file, so the load gate saw it as new. The other tests in that file passed 5/5.

## What to build

Make the test wait on the observable signal order, not on a wall-clock window that load can exceed. Use the T1/T2 seams (FakeClock, scripted fake harness) if the ordering rule can be shown there, and keep one T3 lifecycle case. Never loosen what it asserts.

## Acceptance criteria

- [x] C1. The cause is named in the task report with the failing repetition's evidence from A-6763.
  - done: impl-914 · 2026-10-19T22:44:25.571Z
  - verified: rev-30 [reviewer] · run rev-20261019-914-source · 2026-10-19T22:45:32.825Z · commit 9309887e24f9327bc16570040d00e72b6a15d053
  - verified: rev-30 [reviewer] · run rev-20261019-914-final · 2026-10-19T22:48:40.121Z · commit 9309887e24f9327bc16570040d00e72b6a15d053
- [x] C2. A deterministic T2 signal-order regression passes the load gate's five repetitions in a mode-free droplet verify at the reviewed head, and the lifecycle file passes 20 serial local runs, with both receipts in the report; the T3 case's load-gate pass is landing evidence from the next stage cover, not a criterion.
  - done: impl-914 · 2026-10-19T22:48:38.489Z
  - verified: rev-30 [reviewer] · run rev-20261019-914-final · 2026-10-19T22:48:40.122Z · commit 9309887e24f9327bc16570040d00e72b6a15d053

## Comments

### impl-914 · 2026-10-19T22:36:40.456Z

A-6763 line 57427: load repetition 1 failed busy presence after 18.974s; base case passed in 4.466s. Fixture flaw: a 10-second real fallback poll was described as suppressed, but can overwrite manual busy with actual idle once 100-ms push trust expires; first clause busy/idle also did not prove final mod completion drained. No per-fixture trace distinguishes the exact interfering signal. Changed the real-hook T3 test to scripted in-process harness/FakeClock (presence and stale-drop assertions preserved) and added deterministic T2 timestamp-order coverage after 20s of fake time. No tests run while cover-quiet is active; receipts pending.

### rev-30 · 2026-10-19T22:45:32.825Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-914-source
commit: 9309887e24f9327bc16570040d00e72b6a15d053
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, A-6773. T3 retains real held CLI hook ordering with observed start/busy before release and Stop completion before final assertions; unrelated polling/clause producers replaced by scripted adapter/spoke and FakeClock. New T2 tests production timestamp ordering after 20 s fake time, stale rejection and current completion. C1 raw failure/report checked with exact interference qualified, not over-attributed. Independently audited local 20/20 lifecycle runs:120/120, zero fail/cancel/skip/TODO; both mutation receipts detect intended regressions. Direct Coordinator revised C2/lifted quiet confirmed. C2 awaits exact-head mode-free overall green and actual new T2 5/5 without owned resource/budget failure; T3 load is next-stage landing evidence. QA none; no Reviewer tests.

Criteria: C1 verified.

### rev-30 · 2026-10-19T22:48:40.122Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-914-final
commit: 9309887e24f9327bc16570040d00e72b6a15d053
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear, A-6780. Independently audited A-6779/edd4e598:566/566, zero fail/cancel/skip/TODO, zero tier/resource mismatch or budget-overrun rows. New deterministic T2 ordinary .231109817 s plus five distinct positive repetitions (max .209720510 s), explicit 5/5 line43034. Combined with A-6770's audited20/20 local lifecycle runs (120/120), this establishes revised C2; T3 load gate remains next-stage landing evidence per Coordinator, no Linux T3 claim. Source A-6773/C1 diagnosis retained with exact interfering signal qualified. QA none; no Reviewer tests.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T22:53:27.569Z

Merged 489054a05a54d7f019fd18015774e217f6da5242 onto dev.
