---
id: T-474
kind: task
title: Merge override is limited to tracker and docs changes; a code diff needs review
state: open
status: backlog
size: S
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-423
blocked_by: []
topic: null
branch: null
created: 2026-10-15T09:13:18.127Z
updated: 2026-10-15T09:13:18.127Z
---

## Summary

Retrospective A-2783, STOP 3: T-289 merged code by human override without review, and it was the run's one dev break. The override remains for tracker and docs diffs only.

## What to build

`cland merge --override` refuses when the branch's diff against dev touches a path outside `.cland/`, `docs/` and `*.md`, naming the paths. Tracker and docs diffs still merge by override.

## Acceptance criteria

- [ ] C1. An override merge of a branch that changes hub/src is refused, naming the files.
- [ ] C2. An override merge of a docs-only or tracker-only branch succeeds.
- [ ] C3. The merge skill and hub/README.md describe the scope.
