---
id: T-452
kind: task
title: "Tracker conflict captures pile up: 1,661 .conflict files in .cland/tasks with no pruning"
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-15T05:56:39.354Z
updated: 2026-10-15T05:56:39.354Z
---

## Summary

`.cland/tasks/` holds 1,661 `<item>.md.<uuid>.conflict` captures (2026-10-15 06:00Z), written at hub/src/tracker/tracker.ts:1825 when a tracker write finds a concurrent change. They are gitignored, so nothing prunes them and nobody sees them. Several are from this build's own body and criterion edits, for example E-386 at 03:45Z and 04:01Z. Decide on a retention policy (age or count), surface captures that differ from the committed file in `cland doctor` or `hub status`, and prune the rest.

## Acceptance criteria

- [ ] C1. Captures older than the retention bound are pruned automatically, and the bound is documented.
- [ ] C2. `cland doctor` reports the number of live captures, and names those whose content differs from the item's current file.
