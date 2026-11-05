---
id: T-1690
kind: task
title: "claude-code-remote: a sibling native setup wait is still a fixed 2000 ms (T-1686 fixed only the release-restart case)"
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
regression_of: T-1686
topic: null
branch: t/T-1690-claude-code-remote-a-sibling-native
created: 2026-11-05T14:50:59.742Z
updated: 2026-11-05T15:07:43.557Z
---

## Summary

T-1686 replaced a fixed 2000 ms setup wait in `hub/test/claude-code-remote.test.ts` (the release-restart case, line 235) with the shared native setup budget, because native hook subprocesses and mod posts can legitimately take longer under load. A sibling case still has the same fixed wait. "terminal remote PID settlement {cleans before publishing exit | holds the row on native failure} without recurring CLI" waits `eventually('worker ready before terminal event', …'session.measure done'…, 2000)` at line 302, and failed the E-1532 stage-5 Linux cover 74b4d5a2 (A-16869, shard-2): `not within 2000 ms`. Elsewhere it passed in 4.4–8.3 s.

## What to build

Make every native setup wait in claude-code-remote use the same shared setup budget T-1686 used (with the per-test timeout raised to stay above it), as a test-only change. Keep every settlement, stop and no-recurring-CLI assertion.

## Acceptance criteria

- [ ] C1. No fixed native setup wait under the shared budget remains in claude-code-remote.test.ts, and every assertion is unchanged (test).
- [ ] C2. Both terminal-settlement cases pass 10/10 locally under CPU load in a Linux container run with `docker run --init` (evidence).
