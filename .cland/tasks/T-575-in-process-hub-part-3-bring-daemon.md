---
id: T-575
kind: task
title: "In-process hub, part 3: bring daemon starts per full run from 743 to under 600"
state: open
status: backlog
size: M
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-387
blocked_by: []
topic: null
branch: null
created: 2026-10-16T06:12:55.788Z
updated: 2026-10-16T06:12:55.788Z
---

## Summary
T-466's full Mac census at 88a3630e (A-3775) measured 743 daemon starts per full run, 742 of them canonical. The E-387 target is under 600, so at least 144 more net removals are needed. A-3775's per-file table ranks the remaining files and marks the lifecycle cautions. Its biggest contributors include remote-fixture-lifecycle (60, mostly load-gate repetitions of new tests, which the next durations refresh removes), daemon (26) and planned-stage (17). Each migrated file needs the lifecycle audit T-393 and T-466 used.

## Acceptance criteria
- [ ] C1. The next files from A-3775's ranking move to the in-process hub, with their lifecycle tests kept spawned and their assertions unchanged, and an audit posted.
- [ ] C2. A full-run spawn census after a durations refresh shows daemon starts under 600, with the per-file table recorded.
