---
id: T-1556
kind: task
title: Claude Code found once on another host
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1547
  - T-1554
topic: null
branch: null
created: 2026-10-31T23:47:43.786Z
updated: 2026-10-31T23:47:48.566Z
---

## Summary

For a Claude Code row on a host other than `local`, one `claude agents --json` at launch finds the worker, and a claimed warm spare keeps its pid. After that no short-lived `claude` command runs on a timer for that row, and liveness is by pid through its Host.

Hot files: `hub/src/adapters/claude-code.ts`

## Acceptance criteria

- [ ] C1. A contract test with a recording host other than `local` counts exactly one `claude agents --json` per launch (test).
- [ ] C2. Over several poll intervals, no short-lived `claude` command runs through that host for a running row, and its liveness comes from the Host's alive (test).
- [ ] C3. A resume of such a row after a hub restart runs at most one discovery (test).
- [ ] C4. Rows on `local` keep today's `agents --json` schedule, and `claude-code-schedule.test.ts` passes with no test edited.
