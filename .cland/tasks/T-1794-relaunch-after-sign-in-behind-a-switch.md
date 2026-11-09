---
id: T-1794
kind: task
title: Relaunch after sign-in, behind a switch
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1790
topic: null
branch: null
created: 2026-11-09T12:44:12.839Z
updated: 2026-11-09T12:44:21.928Z
---

## Summary

If a live harness does not pick up re-signed tokens, `cland login signin` must relaunch that host's sessions of the harness in their worktrees. This ships behind `[hosts] relaunch_after_signin`, which defaults to false and which the live run of E-1539 sets. With the switch on, a sign-in in place or from a card ends with those sessions relaunched, their conversations resumed.

## What to build

The config key, parsed with the other `[hosts]` keys and hot-reloaded, and a success hook on the sign-in runner. When the switch is on, the hook relaunches each session of the harness on that host through the existing relaunch path, resuming its conversation, and leaves sessions of other harnesses alone. `cland init` does not write the key; its default is false.

## Acceptance criteria

- [ ] C1. `[hosts] relaunch_after_signin` parses as a boolean defaulting to false, is refused otherwise naming the key, and applies on hot reload (test).
- [ ] C2. With it false, a sign-in in place relaunches nothing (test).
- [ ] C3. With it true, each session of that harness on the host is relaunched in its worktree with its conversation resumed, and sessions of other harnesses are untouched (test).

## Blocked by

- T-1790

## Notes

- Hot files: `hub/src/host/pools.ts` (the key), `hub/src/host/login-signin.ts` (the success hook), `hub/src/adapters/sessions.ts` (the relaunch call).
- Tests: `hub/test/host-pools-config.test.ts` (T1, new cases); new `hub/test/login-relaunch.test.ts` (T2).
- Serves the open point of the Contents bullet "Reconciliation and the open point". Key name and default: question 15.
