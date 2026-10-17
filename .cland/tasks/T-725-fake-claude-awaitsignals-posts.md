---
id: T-725
kind: task
title: fake-claude awaitSignals posts PermissionRequest before arming its approval resolver, so an immediate SIGUSR1 can be lost
state: open
status: planned
size: S
labels:
  - v0.1.4
  - flaky
  - hub
assignee: null
parent: E-677
blocked_by:
  - T-691
topic: null
branch: null
created: 2026-10-17T06:33:35.124Z
updated: 2026-10-17T06:33:44.144Z
---

## Summary

In hub/test/fakes/claude-code/fake-claude.ts, `awaitSignals: true` posts PermissionRequest before it installs its approve resolver. A SIGUSR1 sent right after the UI's waiting-for-approval frame can therefore be lost, and the harness waits forever. T-691 found it while trying a faster frame fixture, and it kept the existing one-second turn instead.

## What to build

The fake installs its approval barrier (the signal handler and resolver) before it posts PermissionRequest, so an approval sent the moment the waiting frame appears is never lost. The permission-contract case can then drop its one-second turn and wait on the signal.

## Acceptance criteria

- [ ] C1. With awaitSignals, an approval signal sent immediately after the waiting-for-approval frame is received, proved by a fake-harness test that signals with no delay, 20/20.
- [ ] C2. The Claude Code permission contract case uses the barrier instead of its one-second turn, with its assertions unchanged in meaning.
