---
id: T-546
kind: task
title: The new-test load gate fails a correctly platform-skipped new test
state: open
status: review
size: S
criterion_seq: 2
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
updated: 2026-10-16T00:00:24.016Z
---

## Summary
Found by impl-296 on T-296 (2026-10-15 22:55Z). T-471's load gate (`hub/test/load-gate.ts:55`) repeats every test new to the manifest under load, and `hub/test/load-gate-reporter.ts:13` rejects a skipped receipt. A new test that skips by design where its platform prerequisite is absent therefore fails the gate on every machine without that prerequisite. T-296's P3 real-OpenCode test is one: E-424 requires it to skip without the real binary, and droplets don't carry it. It would block T-296's verify, and any other new real-binary test.

## Acceptance criteria
- [x] C1. A new test whose every gated repetition skips with a recorded reason passes the gate as "skipped, not load-gated", and the run's report names it. A new test that skips without a reason, or skips on some repetitions and passes or fails on others, still fails the gate.
  - done: impl-546 · 2026-10-15T23:58:39.240Z
  - verified: rev-31 [reviewer] · run rev-20261016-546-source · 2026-10-16T00:00:24.016Z · commit 37ec7700db9ae514f57753ebc330af51be92cd66
- [x] C2. Tests cover both cases, and docs/agents/tests.md says how a platform-skipped new test gets its load proof (on a machine that has the prerequisite).
  - done: impl-546 · 2026-10-15T23:59:09.682Z

## Comments

### impl-546 · 2026-10-15T22:56:55.264Z

Implementation started: preserve reasoned skip receipts and distinguish unanimous prerequisite skips from five passes and mixed/unexplained outcomes. Regression coverage will exercise the actual reporter and gate.

### rev-31 · 2026-10-16T00:00:24.016Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-546-source
commit: 37ec7700db9ae514f57753ebc330af51be92cd66
scope: full

Source review clear at 37ec7700db9ae514f57753ebc330af51be92cd66, run rev-20261016-546-source, scope full. Fixed point a06020a3; five files. No high, medium or low findings.

## Standards
No findings against AGENTS.md, docs/agents/tests.md, lifecycle rules or smell baseline. The reporter/gate change stays at the existing process receipt seam; fresh per-repetition files, exact test identity, exit code checks and owned-process cleanup remain. No assertion/time bound is weakened. Reviewed diff check passes. Role disables delegation; both axes reviewed here.

## Spec
C1 verified at hub/test/load-gate-reporter.ts:14-17 and hub/test/load-gate.ts:87-103: only successful test:pass receipts without TODO and with nonblank string skip reasons are counted as skips. A repetition still requires process exit zero and exactly one terminal receipt for the exact file/name. Acceptance requires either five passes or five reasoned skips. Mixed passes/skips/failures, missing/multiple receipts, boolean/blank skips and TODO cannot produce a successful skip count. Skip output explicitly says skipped, not load-gated and includes reasons; suiteSummary retains those named lines for the report. Existing bounded report publication handles message limits.

C2 source/test coverage inspected: real runner regressions cover static and runtime reasoned skips, boolean and whitespace skips, TODO and mixed skip/pass and skip/fail. They assert process result, report wording and absence of a passing claim, retaining stable/flaky/cleanup cases. docs/agents/tests.md explicitly requires five passing repetitions under load on a machine with the prerequisite before claiming load proof; accepted skipped receipts provide none.

A-3481 checked: original reasoned-skip regression fails with 0/5 under the old implementation; five serial whole-file Mac runs all pass 15/15 (75 total), accurately labelled alongside local impl-517 verification. Every admitted starting load is below 15; the higher-load check starts no file. Typecheck and shard lint reported green.

C2 remains unverified pending post-source exact-head gate evidence. Source clear permits the run only after the Coordinator lifts the current verification/restart hold. No Reviewer tests/edits; no per-item QA criteria.
Standards: 0 findings. Spec: 0 findings.
Review artifact A-3485: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3485-t-546-source-clear-at-37ec7700.md

Criteria: C1 verified.
