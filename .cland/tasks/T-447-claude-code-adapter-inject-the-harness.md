---
id: T-447
kind: task
title: claude-code-adapter 'inject the harness never confirmed' retry test fails once in T-392's full census run
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-15T01:04:10.495Z
updated: 2026-10-15T06:07:18.236Z
---

## Summary

`hub/test/claude-code-adapter.test.ts` ('an inject the harness never confirmed…', the retry path) failed once inside T-392's candidate full census run at cc44e9cb (2026-10-15 00:51Z). Twelve serial whole-file runs at the baseline and candidate heads, with and without the census preload, all passed at load 12–17 (A-2629). It is a load or package-context flake, and it may follow T-389's fast fake turns. Find its wait, and make it observe the unconfirmed-inject state rather than time.

## Acceptance criteria

- [ ] C1. The cause is named, and the file passes 5/5 beside a local full run with its assertions unchanged.

## Comments

### coord · 2026-10-15T03:26:32.073Z

Same family seen again: hub/test/claude-code-sessions.test.ts:251 (the clause injection timeout) failed in T-390's gate 7b543f68 (A-2658) under load. Fix both tests together.

### coord · 2026-10-15T06:07:18.236Z

Also seen: claude-code-sessions.test.ts:119 (late start/StopFailure). clauseTurnDone at line 44 timed out waiting for coord's clause busy→idle within 15 s, in T-254's gate b6f1e5ff (A-2699), 2026-10-15 06:06Z.
