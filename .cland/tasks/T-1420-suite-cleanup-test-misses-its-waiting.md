---
id: T-1420
kind: task
title: suite cleanup test misses its 'waiting for a verified worker identity' log line once under load
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: null
branch: null
created: 2026-10-28T09:24:24.815Z
updated: 2026-10-29T15:59:37.177Z
---

## Summary

`hub/test/suite.test.ts::failure cleanup preserves a live worker whose recorded start identity is unavailable` failed once in coord's full verify e2311197 for T-1394 (Linux droplet c-8 lon1, head cad60172, log A-13169): the expected log line `suite cleanup waiting for a verified worker identity; process preserved` was absent (empty input) at suite.test.ts:268 after 4.07 s. It passed in every earlier run checked (A-13086–A-13114) and 5/5 alone on dev 95e764b1 (macOS, ~3.6 s). T-1394 does not touch suite cleanup.

## What to build

Find why the cleanup's log line can be missing when the assertion reads it under load (log flush ordering, the assertion reading before the cleanup reached that branch, or a timing-dependent identity probe) and make the test wait on the cleanup's own receipt rather than an immediate log read.

## Acceptance criteria

- [ ] C1. The cause is attributed with the failing output and a reproduction under load.
- [ ] C2. The identity passes 10/10 at two workers plus owned CPU load.
