---
id: T-1351
kind: task
title: A hub start that fails in openDatabase leaks a FileHandle closed only on garbage collection
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-27T02:21:59.306Z
updated: 2026-10-27T02:21:59.306Z
---

## Summary

When `projectHub` startup fails because the injected `openDatabase` throws, a FileHandle opened earlier in startup is never closed. Node later warns `Closing file descriptor 23 on garbage collection` and `[DEP0137] … Please close FileHandle objects explicitly`. Found by impl-1347 during T-1347's rejected-startup control (2026-10-27 02:21Z), in a green pacing run on macOS.

## What to build

Find which handle the partial start opens before `openDatabase` and make the failed-start path close every handle it opened, in reverse order, before the start rejects. Add a regression that fails startup at `openDatabase` and asserts no handle is left open (or no DEP0137 warning is emitted).

## Acceptance criteria

- [ ] C1. A hub start that fails at `openDatabase` closes every FileHandle it opened before rejecting, and a regression fails on today's code with the DEP0137 warning or an open-handle check (test).
