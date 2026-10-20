---
id: T-804
kind: task
title: "init-next.test.ts (T2) records a report-only execFile trip: its initIn CLI helper lacks the scoped CLI-child exemption"
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
regression_of: T-640
found_by: review
topic: null
branch: t/T-804-init-next-test-ts-t2-records-a-report
created: 2026-10-18T13:33:40.432Z
updated: 2026-10-20T09:42:24.175Z
---

## Summary

Found by rev-30 (A-5327). hub/test/init-next.test.ts, the T2 file T-640 added, records one report-only `execFile` tier trip in A-5303, inherited in A-5325. That's its CLI subject through `initIn`, which is the intended T2 CLI boundary, but the helper isn't registered for the scoped CLI-child exemption. The zero-trip claim in A-5304 used the wrong filter prefix; behaviour counts are correct.

## Acceptance criteria

- [ ] C1. The init CLI helper runs under the existing scoped CLI-child exemption (or an equivalent boundary), keeping scratchMachine HOME and Git isolation, and init-next.test.ts shows zero trips with the tripwire enforced.
