---
id: T-917
kind: task
title: "Duration allowances for five migrated or renamed T3 identities that failed stage cover #1's budget"
state: open
status: in progress
size: XS
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: topic-659
branch: t/T-917-duration-allowances-for-five-migrated-or
created: 2026-10-19T22:41:23.592Z
updated: 2026-10-19T22:41:45.708Z
---

## Summary

Stage cover #1 (Linux ad5da9f3 / A-6763 and macOS 781169bb / A-6767 at b62bf16c) has hard `duration budget:` failures for test identities that are new or renamed since the last durations refresh. Their timings come from the process-helper migration (T-896–T-903) and from T-668's rename. Each says "add to hub/test/durations.json with a reason".

## What to build

Add allowances to `hub/test/durations.json`, owner E-677, expiring in 7 days, each with a reason naming the migration or rename, at the larger observed value plus 20 %, for exactly:
- hub/test/executor-run.test.ts::host check failure creates no machine; remote typecheck stops tests and failed tests retain failures (13.132 s Linux, 13.73 s macOS; renamed by T-668)
- hub/test/merge-checkout-lifecycle.test.ts::a crash before the integration ref moves retains checkout recovery and can merge after restart (5.33 s Linux, 6.51 s macOS)
- hub/test/merge-recovery-native.test.ts::a close write failure reports merged follow-up failure; retry closes and prunes without a second commit (5.149 s macOS)
- hub/test/merge-recovery-native.test.ts::retrying a completed merge preserves staged deletion and reversion of its touched files (5.789 s macOS)
- hub/test/session-resume-lifecycle.test.ts::a stopped Claude Implementer resumes its conversation, role and item claim and receives its clause again (6.833 s Linux, 5.48 s macOS)
If an allowance for a renamed identity's old name still exists, remove it.

## Acceptance criteria

- [ ] C1. The five allowances exist with reason, owner and expiry, and the durations lint/test passes.
- [ ] C2. A replay of A-6763's and A-6767's budget checks against the new manifest shows no `duration budget:` line (a small script or the existing budget test over the logs), with the receipt in the report.
