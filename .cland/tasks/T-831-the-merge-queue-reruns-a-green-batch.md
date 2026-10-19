---
id: T-831
kind: task
title: The merge queue reruns a green batch whenever dev moves, even by tracker-only commits
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-678
blocked_by: []
regression_of: T-711
topic: null
branch: null
created: 2026-10-19T06:28:57.845Z
updated: 2026-10-19T06:28:57.845Z
---

## Summary

On 2026-10-19 T-803 sat in the merge queue from 05:34Z and its single-member batch ran three times (e128f866 at d0eabd6c, 9b697596 at 3756d3b6, 955aa821 at 24ff4175), each green, without landing. Every time dev moved by a tracker- or brief-only commit (the Coordinator's pre-merge tracker commits, QA brief commits), the queue discarded the green batch and rebuilt it on the new base. That's about 20 droplet minutes and $0.08 per rerun, and the queue behind it stalls (T-739, T-818, T-494, T-664 waited over an hour).

## Acceptance criteria

- [ ] C1. When dev moves only by commits whose changed paths are outside the batch's test inputs (`.cland/**`, `qa/briefs/**`, docs-only paths the selection ignores), a green batch lands by rebasing onto the new dev without rerunning; a component test with the scripted provider and FakeClock shows one run and a landing after a tracker-only dev commit mid-run.
- [ ] C2. A dev move that touches code or test inputs still rebuilds the batch, and the queue's notice names the commit that forced the rebuild.
