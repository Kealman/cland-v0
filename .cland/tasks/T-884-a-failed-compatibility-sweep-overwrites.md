---
id: T-884
kind: task
title: A failed compatibility sweep overwrites the suite worker's primary failure cause
state: open
status: ready
size: XS
criterion_seq: 1
labels:
  - needs-triage
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: topic-618
branch: t/T-884-a-failed-compatibility-sweep-overwrites
created: 2026-10-19T15:59:36.589Z
updated: 2026-10-19T16:22:01.095Z
---

## Summary

When the compatibility sweep fails, hub/src/suite-worker.ts's finally block replaces the primary command cause with "compatibility cleanup failed". In T-881's reproduction (2026-10-19, impl-881) that erased the inherited-pipe cleanup cause, so the symptom showed up as a missing warning instead of the real cause.

## Acceptance criteria

- [x] C1. When both the command and the compatibility sweep fail, the worker receipt keeps both causes, the primary one first. A T1 or T2 test over the worker's cause reporting shows that an inherited-pipe cleanup cause survives a failed sweep.
  - done: impl-884 · 2026-10-19T16:21:30.310Z
  - verified: rev-30 [reviewer] · run rev-20261019-884-final · 2026-10-19T16:22:00.297Z · commit d09f75734f5b47be09fb29145136b2d5d4ec7d60

## Comments

### impl-884 · 2026-10-19T16:00:53.400Z

Implemented worker cause composition: retain the primary cause first, append compatibility cleanup failure. Added hub/test/suite-worker-cause.test.ts at T1, covering inherited-pipe warning preservation and cleanup-only reporting. Red reproduction dropped the primary cause; green targeted file: 2/2, 0.176 s. npm run typecheck and npm run test:tiers pass. No change to suite-command.ts or T-881's ps shim. qaPolicy scope none; no QA criteria.

### rev-30 · 2026-10-19T16:01:39.860Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-884-source
commit: d09f75734f5b47be09fb29145136b2d5d4ec7d60
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-6190. Worker finally appends cleanup failure after existing primary cause, still forces exit1 and passes identical combined cause to printed/durable receipt. Empty-primary wording unchanged. Pure T1 test pins full inherited-pipe diagnostic before cleanup Error plus cleanup-only Error/string cases, no process/wait. A-6189 reports red-green2/2 .176s, typecheck/tiers green. C1 complete verification awaits exact-head mode-free receipt; signal-specific behavior unchanged. No Reviewer execution.

### rev-30 · 2026-10-19T16:22:00.297Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-884-final
commit: d09f75734f5b47be09fb29145136b2d5d4ec7d60
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, C1 verified. A-6204 audits exact-head A-6203/c28f73f1: 1577/1577 ordinary, 497 groups 5/5, both owned cause-reporting controls pass ordinarily and five repetitions. Four inherited T-856 Git reports covered by T-877; T3 remains landing evidence.

Criteria: C1 verified.
