---
id: T-581
kind: task
title: 'task-worktrees timing test: "both the initial snapshot and the post-I/O snapshot must run" fails under droplet load'
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - bug
  - hub
  - flaky
assignee: null
parent: E-482
blocked_by: []
topic: topic-386
branch: t/T-581-task-worktrees-timing-test-both-the
created: 2026-10-16T07:01:00.231Z
updated: 2026-10-16T16:06:18.671Z
---

## Summary
In T-470's droplet run 0b939cc1 at 311933f1 (A-3815, lines 4490–4495), hub/test/task-worktrees.test.ts:379, in the case "worktree.list: its work after the Git reads is timed as phase resumed (a slow one is logged once)", failed: "both the initial snapshot and the post-I/O snapshot must run". T-470 doesn't touch worktrees. The file passed 9/9 alone on dev ac20175b on the Mac.

## Acceptance criteria
- [x] C1. Find why one of the two snapshots doesn't run under load (a timer or ordering assumption), fix the test or the timing seam, and record the cause on this item.
  - done: impl-581 · 2026-10-16T16:02:57.201Z
- [ ] C2. task-worktrees.test.ts passes 10/10 serially as a whole file on the Mac and once on a droplet.

## Comments

### coord · 2026-10-16T13:57:35.472Z

Recurred in the v0.1.3 macOS release run 1ed3dbd6 at 098e6f5a (A-3922, darwin arm64, peak load 15.5): task-worktrees.test.ts:356 "worktree.list: its work after the Git reads is timed as phase resumed (a slow one is logged once)", with "both the initial snapshot and the post-I/O snapshot must run" 3 !== 2. Flaky-rule resubmit c7e3ba4e.

### impl-581 · 2026-10-16T16:01:22.873Z

Reproduced the reported 3 !== 2 deterministically by delaying Tracker.viewAsync 350 ms during worktree.list and scheduling InboxBoard.refresh(). Stack traces show the third call is InboxBoard's 250 ms publication timer → list() → Dispatcher.useSessions callback → the test's shared sessionsList stub, not a third TaskWorktrees snapshot. Dispatcher also has a setImmediate process/hold projection using the same stub. The global counter/one-shot 400 ms injection therefore measures unrelated consumers and can charge the wrong caller under load. Fix will scope both to synchronous worktree.list resumed measurements using the existing RequestGuard injection seam; keep exact two snapshots and the single resumed slow-request assertions.

### impl-581 · 2026-10-16T16:06:10.089Z

Head a14eced08b961307d2721ee4714e60c8b6ee3af7 pushed to origin. npm run typecheck at that committed head: exit 0. Mac whole-file node --test hub/test/task-worktrees.test.ts passed 10/10 serial invocations, each 9/9 tests (90 passing tests, zero failed/skipped). Run 1: 21763.722125 ms; runs 2–10 retained as artifact. No new or renamed tests, no duration allowance needed. C1 cause/red-green proof: A-3959. C2 awaits once-on-droplet verification after source review. qaPolicy is none/after-stage; no per-item QA requested.
