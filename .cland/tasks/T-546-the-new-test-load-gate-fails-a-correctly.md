---
id: T-546
kind: task
title: The new-test load gate fails a correctly platform-skipped new test
state: open
status: in progress
size: S
labels:
  - bug
  - hub
assignee: null
parent: E-482
blocked_by: []
regression_of: T-471
topic: topic-340
branch: t/T-546-the-new-test-load-gate-fails-a-correctly
created: 2026-10-15T22:56:05.665Z
updated: 2026-10-15T22:56:55.264Z
---

## Summary
Found by impl-296 on T-296 (2026-10-15 22:55Z). T-471's load gate (`hub/test/load-gate.ts:55`) repeats every test new to the manifest under load, and `hub/test/load-gate-reporter.ts:13` rejects a skipped receipt. A new test that skips by design where its platform prerequisite is absent therefore fails the gate on every machine without that prerequisite. T-296's P3 real-OpenCode test is one: E-424 requires it to skip without the real binary, and droplets don't carry it. It would block T-296's verify, and any other new real-binary test.

## Acceptance criteria
- [ ] C1. A new test whose every gated repetition skips with a recorded reason passes the gate as "skipped, not load-gated", and the run's report names it. A new test that skips without a reason, or skips on some repetitions and passes or fails on others, still fails the gate.
- [ ] C2. Tests cover both cases, and docs/agents/tests.md says how a platform-skipped new test gets its load proof (on a machine that has the prerequisite).

## Comments

### impl-546 · 2026-10-15T22:56:55.264Z

Implementation started: preserve reasoned skip receipts and distinguish unanimous prerequisite skips from five passes and mixed/unexplained outcomes. Regression coverage will exercise the actual reporter and gate.
