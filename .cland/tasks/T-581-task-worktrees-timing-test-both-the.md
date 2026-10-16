---
id: T-581
kind: task
title: 'task-worktrees timing test: "both the initial snapshot and the post-I/O snapshot must run" fails under droplet load'
state: open
status: backlog
size: XS
labels:
  - bug
  - hub
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-16T07:01:00.231Z
updated: 2026-10-16T13:57:35.472Z
---

## Summary
In T-470's droplet run 0b939cc1 at 311933f1 (A-3815, lines 4490–4495), hub/test/task-worktrees.test.ts:379, in the case "worktree.list: its work after the Git reads is timed as phase resumed (a slow one is logged once)", failed: "both the initial snapshot and the post-I/O snapshot must run". T-470 doesn't touch worktrees. The file passed 9/9 alone on dev ac20175b on the Mac.

## Acceptance criteria
- [ ] C1. Find why one of the two snapshots doesn't run under load (a timer or ordering assumption), fix the test or the timing seam, and record the cause on this item.
- [ ] C2. task-worktrees.test.ts passes 10/10 serially as a whole file on the Mac and once on a droplet.

## Comments

### coord · 2026-10-16T13:57:35.472Z

Recurred in the v0.1.3 macOS release run 1ed3dbd6 at 098e6f5a (A-3922, darwin arm64, peak load 15.5): task-worktrees.test.ts:356 "worktree.list: its work after the Git reads is timed as phase resumed (a slow one is logged once)", with "both the initial snapshot and the post-I/O snapshot must run" 3 !== 2. Flaky-rule resubmit c7e3ba4e.
