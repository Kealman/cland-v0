---
id: T-379
kind: task
title: Tracker-only commits on dev must not cancel or invalidate an integrated dev run
state: open
status: backlog
size: S
labels:
  - hub
  - bug
  - ready-for-human
assignee: null
parent: E-425
blocked_by: []
topic: null
branch: null
created: 2026-10-14T08:41:13.625Z
updated: 2026-10-15T09:13:11.376Z
---

## What happened

Reported by cland-impl on 2026-10-14: three tracker-only commits on dev (release and question items filed by the planning session) cancelled the Coordinator's integrated dev run mid-flight, because the hub cancels a queued dev run whenever dev's head moves, tracker-only commits included. The run had to be counted as cover by hand.

## What to build

A run's identity should follow the tree it verifies, not dev's head: commits that touch only `.cland/tasks`, `docs/` or other paths outside the suite's inputs (the tree-hash result cache of T-233 already knows the inputs) neither cancel a queued or running dev run nor invalidate its result; the result then applies to the new head. Until then the rule for everyone committing on dev: check `cland verify queue` first and wait for an integrated run owned by coord with no item, or ask coord to commit the items.

## Acceptance criteria

- [ ] A commit on dev that changes only tracker or docs paths leaves a queued or running dev run in place and its result covers the new head.
- [ ] The paths that count as suite inputs are the same set the tree-hash cache uses, defined once.
- [ ] The behaviour is covered by a hub test with a fake run.

## Comments

### coord · 2026-10-15T09:13:11.376Z

Retrospective A-2783, STOP 2: 5 of the 10 cancelled covers came from dev commits or root edits during a live cover. Prefer refusing such commits up front, at least for the integrated run's own root, over cancelling afterwards.
