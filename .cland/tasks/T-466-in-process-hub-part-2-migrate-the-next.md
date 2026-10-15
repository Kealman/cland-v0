---
id: T-466
kind: task
title: "In-process hub, part 2: migrate the next files to bring daemon starts per full run under 600"
state: open
status: planned
size: M
labels:
  - v0.1.3
  - hub
  - needs-triage
assignee: null
parent: E-387
blocked_by: []
topic: null
branch: null
created: 2026-10-15T09:03:10.279Z
updated: 2026-10-15T19:05:29.774Z
---

## Summary

After T-393 moved its top 20 files in-process, the projected daemon starts per full run are 772 (A-2804, against A-2737's 1047). The E-387 target is under 600, so at least 173 more net removals are needed. A-2761 ranks the next candidates: tracker-levels 24, subscriptions 20, artifacts 18, tracker 16, visibility 15, epic-close and tracker-rank 14 each. Each needs the lifecycle audit T-393 used.

## Acceptance criteria

- [ ] C1. The next files move to the in-process hub with their lifecycle tests kept spawned and their assertions unchanged, with an audit posted.
- [ ] C2. A full-run census shows daemon starts under 600.
