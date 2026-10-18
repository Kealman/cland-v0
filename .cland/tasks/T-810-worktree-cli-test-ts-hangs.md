---
id: T-810
kind: task
title: "worktree-cli.test.ts hangs intermittently: four full runs today stalled with it as the last started file"
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-18T16:14:16.762Z
updated: 2026-10-18T16:14:16.762Z
---

## Summary

Four full runs today ended in a machine-phase stall or a 75 min timeout with hub/test/worktree-cli.test.ts as the last file started: T-759 7efa2911 (A-5076), T-709 2119e998 (A-5221) and T-645 2b7bf0f0 (A-5301), all on droplets, and E-678's macOS stage run b50559f3 (A-5411, "stalled: no output for 10 min", the last starts being all four worktree-cli cases). The file runs last in the alphabetical machine order, so earlier this looked like run order. But b50559f3's stall detector shows nothing completing for 10 min after its four cases started, which points at the file itself. Its cases start a parent hub and child projects, stop through stale discovery and select hubs by CLAND_HUB_FILE. A wait on a hub that never answers, or a stop that never returns, would hang without a deadline.

## Acceptance criteria

- [ ] C1. The hanging case and its cause are named, from a reproduction (loop the file 50× on macOS and Linux) or from T-799's hung-test receipt.
- [ ] C2. Every wait in the file has a bounded deadline that fails with the case named, and the cause is fixed, keeping every assertion. The file passes 50/50 serially on macOS and 20/20 on Linux.
