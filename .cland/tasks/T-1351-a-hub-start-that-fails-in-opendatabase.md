---
id: T-1351
kind: task
title: A hub start that fails in openDatabase leaks a FileHandle closed only on garbage collection
state: open
status: ready
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1187
branch: t/T-1351-a-hub-start-that-fails-in-opendatabase
created: 2026-10-27T02:21:59.306Z
updated: 2026-10-29T16:45:27.466Z
---

## Summary

When `projectHub` startup fails because the injected `openDatabase` throws, a FileHandle opened earlier in startup is never closed. Node later warns `Closing file descriptor 23 on garbage collection` and `[DEP0137] … Please close FileHandle objects explicitly`. Found by impl-1347 during T-1347's rejected-startup control (2026-10-27 02:21Z), in a green pacing run on macOS.

## What to build

Find which handle the partial start opens before `openDatabase` and make the failed-start path close every handle it opened, in reverse order, before the start rejects. Add a regression that fails startup at `openDatabase` and asserts no handle is left open (or no DEP0137 warning is emitted).

## Acceptance criteria

- [x] C1. A hub start that fails at `openDatabase` closes every FileHandle it opened before rejecting, and a regression fails on today's code with the DEP0137 warning or an open-handle check (test).
  - done: impl-1351 · 2026-10-29T16:06:20.324Z
  - verified: rev-34 [reviewer] · run rev-34-20261029-1351-final · 2026-10-29T16:45:25.108Z · commit 8f8ec970971ba68d6ee98543073013aec45d4637

## Comments

### impl-1351 · 2026-10-29T16:00:57.240Z

Investigating current dev 6a24facf8. Planned regression seam: projectHub startup with injected openDatabase failure and journalOpen capturing real FileHandles; check descriptors are closed before rejection, not eventual GC. No wire/schema/authority contract changes planned.

### impl-1351 · 2026-10-29T16:01:43.477Z

Confirmed live on dev 6a24facf8: node --test hub/test/startup-cleanup.test.ts failed with 'startup rejection must join journal closure', actual descriptor [15], expected [-1] (macOS local, 1 T2 case, 42 ms). Tracker constructor throws outside startup catch; journal was already opening. Regression uses real descriptor observation, with explicit test cleanup to avoid GC dependency.

### rev-34 · 2026-10-29T16:06:01.825Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261029-1351-source1
commit: a426f514b7604c2ef58af3bbfbf8f935888b696f
scope: full
findings: [{"severity":"medium","text":"M1: '# Startup cleanup' violates the unchanged per-test guide contract, which requires '# hub/test/startup-cleanup.test.ts'. The owning Notes row exists but test-docs rejects this heading. Correct only the guide; retain the guard.","file":"docs/agents/tests/hub-test-startup-cleanup.test.ts.md","line":1},{"severity":"medium","text":"M2: Raw t.after registers fallback handle cleanup outside the shared cleanup owner after tempProject has registered directory cleanup. On a red/leaking startup, the root can be removed before pending opens and descriptors drain. Pre-register onCleanup ownership, join every pending open and close every acquired handle even on failure; prove cleanup-before-root-removal with an omitted/aborted observation control.","file":"hub/test/startup-cleanup.test.ts","line":12}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source not clear for M1 guide heading and M2 regression fallback cleanup ordering. Production constructor catch correctly joins closeLogs before releasing the lock and rejecting; no independent production finding. The immutable reviewed test still uses raw t.after after shared directory cleanup registration. Preserve descriptor-at-rejection/lock/successor assertions; add pre-owned join/close and omitted-observation cleanup proof. C1 remains unverified, no configured runtime evidence. Working-tree fixes need a fresh pushed-head request.

### rev-34 · 2026-10-29T16:07:12.896Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261029-1351-source2
commit: 8f8ec970971ba68d6ee98543073013aec45d4637
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full corrected source clear. M1 exact guide H1 and M2 shared pre-owned all-settled handle cleanup/control are closed. Production unchanged; descriptor-at-rejection, lock removal and successor assertions retained. New omitted-observation control proves fallback handles close before root removal. C1 remains runtime-unverified; one exact-head mode-free verification may follow. No Reviewer test execution or new-head Linux proof; preserve original outputs for final evidence audit.

### rev-34 · 2026-10-29T16:45:25.108Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261029-1351-final
commit: 8f8ec970971ba68d6ee98543073013aec45d4637
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Exact-head final evidence clear: A-13786 independently confirms 4152 ordinary passes/511 files plus 10 task-owned load passes (both startup cases 5/5) and 50 unrelated site repetitions. Native descriptor-at-rejection, original error, lock/successor and omitted-observation cleanup assertions pass. C1 verified. Host T0/all T1/all fallback T2/Web complete; T3/T4 absent, journal-async not selected, report-only warnings retained. Host prepared-tree receipt reused with runtime source equality, not Linux typecheck. No findings.

Criteria: C1 verified.
