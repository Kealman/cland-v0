---
id: T-1963
kind: task
title: merge-batches.test.ts's boundedJoinedCase + joinedCase helpers fence fixture work only after caseDeadlines' pending-work join
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-18T08:00:17.305Z
updated: 2026-11-18T08:00:17.305Z
---

## Summary

Found by impl-1894 and its reviewer (2026-11-18) by reading the source; no runtime failure has been seen yet. In hub/test/merge-batches.test.ts, the existing `boundedJoinedCase` plus `joinedCase` helper pair captures its `fixtureWork.close` behind `caseDeadlines`' pending-work join. So fixture admission is fenced only after pending work has joined, not before teardown starts. T-1894 fixed the same ordering gap in its new `guardedMemberCase` (synchronous fence through `caseDeadlines.releaseOnClose` and TestContext abort before pending waits join), but left the existing callers unmigrated, per its review scope.

## What to build

Move the existing helper pair, or its callers, onto the same early-fence order as `guardedMemberCase`: fence fixture work synchronously at close or abort, then join pending work, then restore resources and guards. Keep every caller's assertions unchanged.

## Acceptance criteria

- [ ] C1. A held continuation started after teardown begins is rejected, never resolved, in each migrated helper caller (test with a positive control that fails on the old order).
- [ ] C2. Every caller of `boundedJoinedCase` and `joinedCase` is listed with its disposition (rule 41) and passes unchanged.
