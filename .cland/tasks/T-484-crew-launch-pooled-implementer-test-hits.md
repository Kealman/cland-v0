---
id: T-484
kind: task
title: crew-launch pooled Implementer test hits 'pool size 1 reached' before the previous member is idle (Linux)
state: open
status: in progress
size: XS
labels:
  - v0.1.3
  - hub
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-287
branch: t/T-484-crew-launch-pooled-implementer-test-hits
created: 2026-10-15T09:54:30.252Z
updated: 2026-10-15T09:55:32.821Z
---

## Summary

`hub/test/crew-launch.test.ts:145` ('an Implementer pool moves to the next task worktree after merge (opencode, keep_context=true)') expected /unknown or unavailable brief/ and got 'crew.implementer: pool size 1 reached (pooled-impl)'. This was in T-461's Linux run a506e23a (A-2843), 2026-10-15. The next launch arrives before the pool member is observed idle, which is the same class T-434 fixed for accounts. Wait for the member's idle or release before the next launch.

## Acceptance criteria

- [ ] C1. The test waits on the pool member's observed release before the next launch, keeps its assertions, and the file passes 5/5 beside a local full run and once on a droplet.

## Comments

### impl-484 · 2026-10-15T09:55:32.821Z

Baseline targeted repro command: node --test --test-name-pattern='an Implementer pool moves.*opencode, keep_context=true' hub/test/crew-launch.test.ts passed locally (1/1, 5.56 s test). Existing wait checks idle only; T-434's accounts fixture additionally requires completed first-turn usage and released holds. Investigating the same initial-idle-before-spoke/clause boundary here; no production changes intended.
