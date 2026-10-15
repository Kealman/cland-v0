---
id: T-507
kind: task
title: "subscriptions test: T-486 now keeps a completed first turn's idle, but the test expects only 'impl launched'"
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-486
topic: null
branch: null
created: 2026-10-15T15:16:16.512Z
updated: 2026-10-15T15:16:16.512Z
---

## Problem

`hub/test/subscriptions.test.ts:453/:472` expects only 'impl launched' in a terminal role-update case. On a head that carries T-486 (4db6ed9c), T-495's droplet verify d6e75622 (A-3101) also got 'impl idle'. T-486's fix keeps a completed first turn's idle instead of overwriting it with busy, so the idle event is now legitimate when the fake's first turn finishes quickly. The test's expectation predates that. It's rework of T-486; the watch item on E-482 at 13:09Z said to file it if it recurred after T-486.

## Acceptance criteria

- [ ] C1. The case expects the event set that T-486's launch ordering produces. It either accepts 'impl idle' after 'impl launched' when the first turn has completed, or it holds the fake's first turn so that idle can't arrive inside the window. Record which, and why, in the commit.
- [ ] C2. subscriptions.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
