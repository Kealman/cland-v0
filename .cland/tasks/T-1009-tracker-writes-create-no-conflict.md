---
id: T-1009
kind: task
title: Tracker writes create no .conflict capture without a real concurrent edit
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1006
blocked_by: []
topic: topic-757
branch: t/T-1009-tracker-writes-create-no-conflict
created: 2026-10-20T17:01:25.119Z
updated: 2026-10-20T17:02:03.275Z
---

## Summary

Tracker writes create a `.conflict` capture almost every time, including a plain `task create` or `task edit` with no concurrent change. `.cland/tasks` now holds 5,026 captures, and new ones are written every minute. The churn feeds the file-watch and indexing load behind the P1 slow start. A capture must mean a real concurrent edit.

## What to build

Find why a write with no concurrent edit takes the conflict path (the capture is written in `hub/src/tracker/tracker.ts`). Candidates: the hub's own write seen back through the watcher, the CLI and the hub writing the same file, or a comparison that differs only in serialisation. Fix it so only a real concurrent change, a byte change made by another writer between read and write, creates a capture. Name the cause in the item topic.

## Acceptance criteria

- [ ] C1. The cause of the false captures is named in the item topic with a reproduction in a scratch project (local evidence).
- [ ] C2. `task create`, `task edit`, `task comment` and `task criterion` from the CLI and from the hub, with no concurrent edit, create no `.conflict` file (test per path).
- [ ] C3. A real concurrent edit, where another writer changes the file between read and write, still creates a capture (test).
- [ ] C4. The tracker's file watcher does not emit a `task` event for a `.conflict` file (test).
