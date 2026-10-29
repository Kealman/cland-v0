---
id: T-1351
kind: task
title: A hub start that fails in openDatabase leaks a FileHandle closed only on garbage collection
state: open
status: review
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
updated: 2026-10-29T16:03:30.251Z
---

## Summary

When `projectHub` startup fails because the injected `openDatabase` throws, a FileHandle opened earlier in startup is never closed. Node later warns `Closing file descriptor 23 on garbage collection` and `[DEP0137] … Please close FileHandle objects explicitly`. Found by impl-1347 during T-1347's rejected-startup control (2026-10-27 02:21Z), in a green pacing run on macOS.

## What to build

Find which handle the partial start opens before `openDatabase` and make the failed-start path close every handle it opened, in reverse order, before the start rejects. Add a regression that fails startup at `openDatabase` and asserts no handle is left open (or no DEP0137 warning is emitted).

## Acceptance criteria

- [x] C1. A hub start that fails at `openDatabase` closes every FileHandle it opened before rejecting, and a regression fails on today's code with the DEP0137 warning or an open-handle check (test).
  - done: impl-1351 · 2026-10-29T16:03:11.832Z

## Comments

### impl-1351 · 2026-10-29T16:00:57.240Z

Investigating current dev 6a24facf8. Planned regression seam: projectHub startup with injected openDatabase failure and journalOpen capturing real FileHandles; check descriptors are closed before rejection, not eventual GC. No wire/schema/authority contract changes planned.

### impl-1351 · 2026-10-29T16:01:43.477Z

Confirmed live on dev 6a24facf8: node --test hub/test/startup-cleanup.test.ts failed with 'startup rejection must join journal closure', actual descriptor [15], expected [-1] (macOS local, 1 T2 case, 42 ms). Tracker constructor throws outside startup catch; journal was already opening. Regression uses real descriptor observation, with explicit test cleanup to avoid GC dependency.
