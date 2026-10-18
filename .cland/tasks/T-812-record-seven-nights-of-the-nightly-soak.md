---
id: T-812
kind: task
title: "Record seven nights of the nightly soak after T-715 merges: at least five runs, each under $0.25"
state: open
status: backlog
size: XS
labels:
  - ready-for-human
assignee: null
parent: E-678
blocked_by:
  - T-715
topic: null
branch: null
created: 2026-10-18T16:21:54.721Z
updated: 2026-10-18T16:21:54.721Z
---

## Summary

T-715's former C5 is an observation that can only be made after merge, so it can't gate the merge. Seven nights after T-715 lands, the Coordinator reads the soak lease records and records them here.

## Acceptance criteria

- [ ] C1. Seven nights after T-715's merge, at least five soaks ran, each under $0.25, listed here from the lease records with run id, tree, duration and cost; any skipped night names its cause.
