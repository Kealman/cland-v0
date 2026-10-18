---
id: T-772
kind: task
title: Tracker and merge T3 files move their rule tests to T2 under the same titles (A-4961 group, ~133 s)
state: open
status: in progress
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - tests
  - ready-for-agent
assignee: null
parent: E-677
blocked_by: []
topic: null
branch: t/T-772-tracker-and-merge-t3-files-move-their
created: 2026-10-18T04:49:20.866Z
updated: 2026-10-18T04:50:01.388Z
---

## Summary

This is a split of T-708, from its C1 inventory A-4961. It covers the 40 "Tracker and merge" T3 files (545.6 s): tracker schema, status, criteria, rank and plan rules move to T2 under the same test titles. Native Git and crash/recovery regressions stay in their T3 files. The proposed removal from T3 is 132.9 s.

## What to build

Apply the "Tracker and merge" rows of A-4961 exactly: same-title moves to the listed T2 destinations, splits as listed, and native files left alone. Run the lint's shrink tool after T-684 lands, if it has.

## Acceptance criteria

- [ ] C1. Every "Tracker and merge" row in A-4961 is applied or explicitly kept, with each moved test's title and assertion meaning unchanged, recorded as an audit artifact.
- [ ] C2. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
