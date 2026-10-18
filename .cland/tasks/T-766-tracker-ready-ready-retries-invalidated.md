---
id: T-766
kind: task
title: tracker-ready "ready retries invalidated preparations with bounded backoff" hangs 15 s when the fake clock's pending timer isn't the retry
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
parent: E-677
blocked_by: []
regression_of: T-703
topic: topic-468
branch: t/T-766-tracker-ready-ready-retries-invalidated
created: 2026-10-18T01:59:29.077Z
updated: 2026-10-18T02:02:47.631Z
---

## Summary

Integrated cover fa686b80 (A-4887, dev 90fad254, 2026-10-18 01:59Z) is red on one test: hub/test/tracker-ready.test.ts:154, "ready retries invalidated preparations with bounded backoff", failing at line 237 with "ready retry completed: not within 15000 ms". T-703 moved this test to T2 on a FakeClock, and in T-703's run b888f346 it took 0.63 s. Its loop waits for `time.pending > 0`, advances a fixed step, then waits up to 15 s of wall time for the next attempt. When the pending timer is not the retry timer, the advance doesn't fire the retry and the loop hangs. This is a fix-forward on dev under rule 6.

## What to build

The retry loop drives the fake clock until each retry attempt is recorded: advance while the next attempt is missing and timers are pending, with no fixed single step. The bounded-retry and backoff assertions stay unchanged. If the hub exposes its retry timer, wait on that specifically.

## Acceptance criteria

- [x] C1. The case passes 50/50 serially on the Mac at a 1-minute load of 8–12 with the bounded-retry and backoff assertions unchanged, and a planted extra pending timer that reproduces the hang before the fix passes after it.
  - done: impl-766 · 2026-10-18T02:02:47.401Z

## Comments

### impl-766 · 2026-10-18T02:01:17.194Z

Merged origin/dev 43c00e1a. A-4888 captures deterministic red-before-green: an unrelated 100 ms FakeClock timer holds the first ready write, so the old single 50 ms advance cannot reach the retry timer and fails with the cover's exact 15 s timeout. The existing T2 test now drives time until each write attempt is observed; bounded-retry/backoff assertions remain unchanged. Initial green passes.
