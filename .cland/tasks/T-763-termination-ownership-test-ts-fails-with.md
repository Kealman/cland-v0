---
id: T-763
kind: task
title: termination-ownership.test.ts fails with "database is locked" on a slow droplet
state: open
status: review
size: S
criterion_seq: 1
labels:
  - v0.1.4
  - verification
  - hub
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-469
branch: t/T-763-termination-ownership-test-ts-fails-with
created: 2026-10-17T22:57:38.301Z
updated: 2026-10-18T03:18:57.879Z
---

## Summary

In droplet run 4458319f (T-752 at 9096e2b4, A-4824, 2026-10-17 at 22:53Z), on a very slow disk, hub/test/termination-ownership.test.ts:11, "session stop and doctor share one termination owner and report the tree once", failed at line 21 with `Error: database is locked`. It passes 5/5 serially on the Mac at the same head (A-4833). T-752 doesn't touch it. The doctor and the hub open the same SQLite store concurrently without a busy timeout, or with one shorter than a slow disk needs.

## What to build

Every SQLite connection the test reaches (hub store, doctor reader) uses a busy timeout or retries on SQLITE_BUSY, so a slow disk delays the test but doesn't fail it. T-755's tmpfs temp root lowers the odds, but this fixes the cause.

## Acceptance criteria

- [x] C1. A T2 test holds a write lock on the store for longer than the old failure window while doctor reads it; doctor completes, and the test fails before the fix.
  - done: impl-763 · 2026-10-18T03:11:58.850Z

## Comments

### impl-763 · 2026-10-18T03:09:22.093Z

Diagnosis: reported termination-ownership line 21 and T-723 stale Claude identity UPDATE create raw zero-timeout handles while live hub Store/ProcessTable/IndexDb write the same hub.db. Doctor's orphan reader also had no busy timeout; ProcessTable/IndexDb enabled WAL before configuring it. Added shared 5000ms initializer used before schema/WAL access by these live-store handles and by both lifecycle fixtures. T2 regression reproduced real SQLITE_BUSY with an exclusive writer, returning null on old doctor reader (red), then the exact ownership snapshot after fix (green). No lifecycle assertion meanings changed.

### rev-30 · 2026-10-18T03:18:57.879Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-763-source
commit: 503b2a28c80e43c5d228c4cb29b8bfcc97b294a4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no findings on Standards or Spec. A-4914 records the nine-file review, shared 5000ms busy policy before WAL/schema access, read-only doctor seam, observed SQLITE_BUSY regression and 15/15 serial Mac file receipts (30 test passes, no failures/cancellations/skips). Lifecycle assertions and conservative doctor failure behavior are retained; no allowance/baseline changes. C1 remains unverified pending reviewed-head task verification. The same zero-timeout fixture pattern in T-723 is corrected, but its separate 10/10 Mac-at-load-above-8 criterion is neither established nor closed here.
