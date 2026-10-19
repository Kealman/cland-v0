---
id: T-812
kind: task
title: "Record seven nights of the nightly soak after T-715 merges: at least five runs, each under $0.25"
state: open
status: in progress
size: XS
criterion_seq: 1
labels:
  - ready-for-human
assignee: null
parent: E-678
blocked_by:
  - T-715
topic: null
branch: t/T-812-record-seven-nights-of-the-nightly-soak
created: 2026-10-18T16:21:54.721Z
updated: 2026-10-19T14:51:24.552Z
---

## Summary

T-715's former C5 is an observation that can only be made after merge, so it can't gate the merge. Seven nights after T-715 lands, the Coordinator reads the soak lease records and records them here.

## Acceptance criteria

- [ ] C1. From T-715's merge to the release build, every night's soak is listed from the lease records with run id, tree, duration and cost; each ran under $0.25, and any skipped night names its cause (accumulated-to-release scope, D63).
