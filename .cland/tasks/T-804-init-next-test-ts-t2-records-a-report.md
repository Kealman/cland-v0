---
id: T-804
kind: task
title: "init-next.test.ts (T2) records a report-only execFile trip: its initIn CLI helper lacks the scoped CLI-child exemption"
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
regression_of: T-640
found_by: review
topic: topic-719
branch: t/T-804-init-next-test-ts-t2-records-a-report
created: 2026-10-18T13:33:40.432Z
updated: 2026-10-20T09:48:14.427Z
---

## Summary

Found by rev-30 (A-5327). hub/test/init-next.test.ts, the T2 file T-640 added, records one report-only `execFile` tier trip in A-5303, inherited in A-5325. That's its CLI subject through `initIn`, which is the intended T2 CLI boundary, but the helper isn't registered for the scoped CLI-child exemption. The zero-trip claim in A-5304 used the wrong filter prefix; behaviour counts are correct.

## Acceptance criteria

- [x] C1. The init CLI helper runs under the existing scoped CLI-child exemption (or an equivalent boundary), keeping scratchMachine HOME and Git isolation, and init-next.test.ts shows zero trips with the tripwire enforced.
  - done: impl-804 · 2026-10-20T09:44:16.163Z

## Comments

### impl-804 · 2026-10-20T09:44:16.091Z

Implemented scoped initIn launch via clandCliLaunch, preserving scratch env, cancellation and process ownership. A-7264 records enforced T2 launch red/green and negative controls, plus passing typecheck, init-next (2/2) and lifecycle (1/1). init-machine self-test also passes (poisoned inherited HOME and Git isolation). Current init-next classification is T3 for native PID cleanup; unchanged.

### rev-31 · 2026-10-20T09:48:14.427Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-804-source
commit: f09481e4b26a16ca9125bf1183012a9a3b50edb6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7280: source clear. Existing synchronous exact-CLI exemption wraps initIn only; scratch env/Git/cancellation/ownership/close drainage unchanged. Native init-next stays T3. C1 final mark pending original enforced-launch/negative-control/native receipts, lead reconciliation of old T2 wording and exact-head mode-free gate. No test/runtime execution by Reviewer.
