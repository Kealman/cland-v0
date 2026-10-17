---
id: T-732
kind: task
title: "codex-adapter: relaunch-during-rename case loses the race when the rename lands before session.resume (load)"
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-17T09:52:08.212Z
updated: 2026-10-17T09:52:08.212Z
---

## Summary

In integrated cover c91c6e1e (A-4440, droplet c-8) `session resume --relaunch on a live session that renames itself while it is being stopped relaunches it under its new name` failed at its session.resume with "no session \"coord\" was launched by this hub". The fake's turn renames the session 300 ms after injection, and under load that happened before the test's resume request reached the hub. It passes 5/5 alone on the Mac. The case means to prove a rename *during* the stop, so the rename must be ordered after the resume request, not after a wall-clock delay.

## What to build

Order the case's rename after the hub has started the relaunch's stop (for example, have the fake rename on a signal or hub event instead of a 300 ms timer). Keep the assertions: same thread, new name, old pid gone. If T-692's Codex contract migration rewrites this case, fold this fix into it and close this ticket as covered.

## Acceptance criteria

- [ ] C1. The rename is ordered by an event, not a timer, and the case passes 5/5 on the Mac and in the task's droplet verify.
