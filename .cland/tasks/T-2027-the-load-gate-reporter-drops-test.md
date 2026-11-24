---
id: T-2027
kind: task
title: The load-gate reporter drops test:diagnostic facts, so failing repetitions lose their recorded diagnostics
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1739
branch: t/T-2027-the-load-gate-reporter-drops-test
created: 2026-11-20T06:18:28.067Z
updated: 2026-11-24T11:03:38.682Z
---

## Summary

The suite's load-gate reporter (`load-gate-reporter.ts:12`) discards `test:diagnostic` events and serializes only assertion errors. So the explicit `t.diagnostic` facts a test records about a failure, such as lifecycle or remaining-owner state, are lost from the retained load-gate output, exactly when the repetition failed. Found by impl-1856 during T-1856's load-gate reproduction on 2026-11-20.

## What to build

Keep each repetition's `test:diagnostic` lines in the load-gate receipt, bounded and line-redacted like the other retained output, and attached to the repetition and identity they came from.

## Acceptance criteria

- [ ] C1. A load-gate repetition whose test calls `t.diagnostic` before failing retains that diagnostic in the gate's output and log (test, red on the current reporter).
- [ ] C2. The retained diagnostics are size-bounded and pass the same redaction as other suite output (test).

## Comments

### impl-2027 · 2026-11-24T10:56:06.004Z

Consumer census: LoadGateEvent read by load-gate.ts discovery, results, admission, rerun and failure output; suite-load-rerun.ts serializes native receipt; hub/src/hub/suites.ts retains complete load gate failure lines; durations-runner.test.ts and quarantine-runner.test.ts parse failure lines; suite-load-diagnostics.test.ts covers reporter; suite-selection.ts treats reporter as full trigger. No protocol/help/QA fixture consumer found. Additive diagnosticLines keeps previous error and passed fields; old receipts with field absent remain supported.

### impl-2027 · 2026-11-24T11:03:38.682Z

Implemented diagnosticLine receipts and shared failure-log formatting. Red-first T1 failed with 1 !== 2 before fix; diagnostic tests now 12/12 passing, rerun 4/4. A-22863 contains initial focused evidence. Companion T3 completed with Coordinator permission to finish, not native-slot evidence. Reachable T1 result 762/762 passed, start load 9.23; Coordinator clarified this start exceeded the required <8 threshold and further broad local tests must wait for mode-free verify. Awaiting Coordinator lint slot for required typecheck then full test:lint before source review.
