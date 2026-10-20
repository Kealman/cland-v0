---
id: T-1009
kind: task
title: Tracker writes create no .conflict capture without a real concurrent edit
state: open
status: in progress
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1006
blocked_by: []
topic: topic-757
branch: t/T-1009-tracker-writes-create-no-conflict
created: 2026-10-20T17:01:25.119Z
updated: 2026-10-20T17:06:51.571Z
---

## Summary

Tracker writes create a `.conflict` capture almost every time, including a plain `task create` or `task edit` with no concurrent change. `.cland/tasks` now holds 5,026 captures, and new ones are written every minute. The churn feeds the file-watch and indexing load behind the P1 slow start. A capture must mean a real concurrent edit.

## What to build

Find why a write with no concurrent edit takes the conflict path (the capture is written in `hub/src/tracker/tracker.ts`). Candidates: the hub's own write seen back through the watcher, the CLI and the hub writing the same file, or a comparison that differs only in serialisation. Fix it so only a real concurrent change, a byte change made by another writer between read and write, creates a capture. Name the cause in the item topic.

## Acceptance criteria

- [x] C1. The cause of the false captures is named in the item topic with a reproduction in a scratch project (local evidence).
  - done: impl-1009 · 2026-10-20T17:06:49.649Z
- [x] C2. `task create`, `task edit`, `task comment` and `task criterion` from the CLI and from the hub, with no concurrent edit, create no `.conflict` file (test per path).
  - done: impl-1009 · 2026-10-20T17:06:50.205Z
- [x] C3. A real concurrent edit, where another writer changes the file between read and write, still creates a capture (test).
  - done: impl-1009 · 2026-10-20T17:06:51.020Z
- [x] C4. The tracker's file watcher does not emit a `task` event for a `.conflict` file (test).
  - done: impl-1009 · 2026-10-20T17:06:51.571Z

## Comments

### impl-1009 · 2026-10-20T17:06:49.639Z

Root cause reproduced in a scratch tempProject/projectHub fixture with isolated HOME/XDG/Git/provider environment: an uncontested CLI criterion write left T-1-cli-writes.md.<uuid>.conflict. #replaceCriterion deliberately retained every captured source on success; automatic backlog→planned writes share it. The fix uses temporary capture sources, cleans successful sources after final original-handle validation, and promotes observed racing sources to .conflict. Concurrent editor-save protection and legacy crash-recovery intents remain. No existing captures are pruned (T-452). Targeted local macOS tests cover CLI/hub create/edit/comment/criterion, real byte races, automatic planned updates, watcher filtering, and a SIGKILL recovery boundary.
