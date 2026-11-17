---
id: T-1928
kind: task
title: Verify admission does ~40 s of repeated candidate lint and planning before acknowledging a submission
state: open
status: backlog
size: S
labels: []
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-16T23:36:00.713Z
updated: 2026-11-16T23:36:00.713Z
---

## Summary

Before a `cland verify` submission is durably admitted and acknowledged, the hub repeats the candidate tree and Git checks, test selection, the immutable and worktree lints, tier and duration planning, and command, limit, head, authority and cache validation, then persists the run. On 2026-11-16 that took about 40 s for local submissions (runs 2933ff09 and cea6eda4, A-20468), so the client's reply deadline was missed. T-1927 widens the client deadline; this item makes admission itself faster.

## Acceptance criteria

- [ ] C1. A profile of one local submission names the time of each substep before durable admission, from a scratch project under representative load.
- [ ] C2. Repeated candidate lint and planning work is cached or moved after the acknowledgement, while every candidate and authority check still gates admission. The time to acknowledge drops measurably against C1's baseline, and the item states the before and after figures (test plus measurement).
