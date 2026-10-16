---
id: E-578
kind: epic
title: "Test speed: structural, part 2"
state: open
labels:
  - v0.1.4
assignee: null
parent: R-577
blocked_by: []
topic: null
branch: null
created: 2026-10-16T06:35:58.703Z
updated: 2026-10-16T06:35:58.703Z
---

## Summary
Carried over from E-387 in v0.1.3 by the human's decision on 2026-10-16 (ask 396ec11a). E-387 closed on a measured 743 daemon starts per full run (census A-3775). This epic takes the remaining structural test-speed targets: under 600 daemon starts (T-575) and the two-shard stage-run wall time (T-520).

## Definition of done
- [ ] D1. A full-run spawn census shows daemon starts under 600 (T-575).
- [ ] D2. A two-shard stage run's wall time meets T-520's target.
