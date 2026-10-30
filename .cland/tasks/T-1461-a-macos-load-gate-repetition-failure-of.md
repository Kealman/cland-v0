---
id: T-1461
kind: task
title: A macOS load-gate repetition failure of a test green in recent covers gets one automatic rerun
state: open
status: review
size: M
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by:
  - T-1476
  - T-1460
topic: topic-1250
branch: t/T-1461-a-macos-load-gate-repetition-failure-of
created: 2026-10-30T05:44:58.258Z
updated: 2026-10-30T19:14:04.462Z
---

## Summary

In v0.3.0, macOS local covers went red 20 times in 34 runs, against 5 in 28 on Linux, costing about 10.9 h (retro A-14149). When a test that passed in recent covers fails only in a macOS load-gate repetition, the cover reruns that identity once automatically; the finding is still filed under the flaky-rerun rule. Retro v0.3.0 change 1.

## Acceptance criteria

- [x] C1. A cover whose only failure is one load-gate repetition of a previously green identity reruns it once and records both receipts.
  - done: impl-1461 · 2026-10-30T19:12:38.768Z

## Comments

### impl-1461 · 2026-10-30T19:08:19.450Z

Contract consumer inventory before edits: SuiteSelection is produced by hub suites admission; carried by verification plan, executor manifests/local worker, tierSuiteSelection and shard spreads; read by run-suite/load-gate, CLI dry-run/describeSelection, cache sameSuiteSelection, web/nvim wire views and persisted suite summaries/full records. Add optional loadGateRerun context only; old selection shapes remain valid. Load-gate result is consumed only by run-suite and durations runner fixtures; additive report fields do not change failed status. Logs consumed by suite report/loadProofIdentities/retainedLoadProofs, duration parser, provenance and stage proofs; use new prefix so no rerun counts as original green. Searches include docs, skills, QA, hub/web/nvim tests across tiers. Confirmed Coordinator policy and runner seams; report-only, last five completed covers within seven days.
