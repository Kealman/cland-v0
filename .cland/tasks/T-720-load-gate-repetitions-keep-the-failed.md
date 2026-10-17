---
id: T-720
kind: task
title: Load-gate repetitions keep the failed repetition's assertion and stack in the suite log
state: open
status: in progress
size: S
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by: []
topic: topic-418
branch: t/T-720-load-gate-repetitions-keep-the-failed
created: 2026-10-16T20:17:40.486Z
updated: 2026-10-17T04:13:39.055Z
---

## Summary

A load-gate repetition that fails is reported only as a count ("4/5 passed"). Its assertion, error and stack are dropped from the durable suite log, so nobody can tell an owned failure from a shared one or diagnose it after the run. T-635's run 7d03777a (A-4175) is the case that showed it.

## What to build

The load gate keeps, for each failed repetition, the test's assertion message, error and stack in the suite log and the result artifact, next to the counts. Passing repetitions stay as counts. Diagnostics follow the existing redaction rules: no environment values or command lines.

## Acceptance criteria

- [ ] C1. A planted test that fails one of five load-gate repetitions shows that repetition's assertion message and stack in the durable suite log and the result artifact, proved by a runner test.
- [ ] C2. Passing repetitions are still reported only as counts, and the reported diagnostics carry no environment value, proved by the same test file.

## Comments

### coord · 2026-10-16T23:14:56.500Z

Coordinator, scope addition from T-681's run c1d75969 (A-4239). One load-gate repetition of a new test failed fast, kept running and never reported. It held the machine phase until the 60-minute run timeout, so 97 identities started and 96 finished 5/5 with nothing to show which one hung. Besides keeping the failed repetition's assertion and stack, this ticket also bounds each repetition by the test's own per-test timeout, and on expiry records it as a timed-out repetition with its diagnostics. The rest of the run then finishes.

### impl-720 · 2026-10-17T04:13:39.055Z

Implementing durable per-repetition diagnostics and an external repetition deadline, with runner regression proof at the existing package-runner seam. Read E-676 and Test levels; no per-item QA required by the stage policy.
