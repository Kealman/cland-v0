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
updated: 2026-11-24T10:55:10.764Z
---

## Summary

The suite's load-gate reporter (`load-gate-reporter.ts:12`) discards `test:diagnostic` events and serializes only assertion errors. So the explicit `t.diagnostic` facts a test records about a failure, such as lifecycle or remaining-owner state, are lost from the retained load-gate output, exactly when the repetition failed. Found by impl-1856 during T-1856's load-gate reproduction on 2026-11-20.

## What to build

Keep each repetition's `test:diagnostic` lines in the load-gate receipt, bounded and line-redacted like the other retained output, and attached to the repetition and identity they came from.

## Acceptance criteria

- [ ] C1. A load-gate repetition whose test calls `t.diagnostic` before failing retains that diagnostic in the gate's output and log (test, red on the current reporter).
- [ ] C2. The retained diagnostics are size-bounded and pass the same redaction as other suite output (test).
