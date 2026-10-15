---
id: T-525
kind: task
title: "pid-identity test: staged reused-PID start stamp can equal the real one within the same second (Linux)"
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-15T19:39:57.986Z
updated: 2026-10-15T19:39:57.986Z
---

## Problem

`hub/test/pid-identity.test.ts:128`, 'Claude Code: a stop whose claude stop fails never SIGTERMs a pid that another process reuses', failed on Linux in T-510's droplet verify 0ea19bdd (A-3306:4024–4034). The test stages a different start identity for a reused PID, but the staged and the real `ps` start stamps matched to the second ('Thu Oct 15 19:28:27 2026'). Process start identity has one-second resolution, so a reuse within the same second is indistinguishable.

## Acceptance criteria

- [ ] C1. The test stages a start identity that provably differs (for example, a stamp outside the real process's second) rather than one that can collide. The commit also states whether the product's PID-reuse guard has the same one-second blind spot. If it does, file that separately with its risk.
- [ ] C2. pid-identity.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
