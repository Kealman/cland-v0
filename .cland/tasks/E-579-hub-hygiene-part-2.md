---
id: E-579
kind: epic
title: Hub hygiene, part 2
state: open
labels:
  - v0.1.4
assignee: null
parent: R-577
blocked_by: []
topic: null
branch: null
created: 2026-10-16T06:36:01.807Z
updated: 2026-10-16T06:36:01.807Z
---

## Summary
Carried over from E-425 in v0.1.3 by the human's decision on 2026-10-16 (ask 396ec11a). It takes the verify-queue hygiene stage: tracker-only commits on dev must not cancel or invalidate an integrated run (T-379), and cover-quiet enforced by the hub while the Coordinator's cover holds the slot (T-475). Both were mitigated during v0.1.3 by running covers from detached worktrees and by the posted cover-quiet rule.

## Definition of done
- [ ] D1. A tracker-only commit on dev during an integrated run leaves the run and its evidence valid (T-379).
- [ ] D2. While a Coordinator cover holds the slot, the hub refuses other test admissions on the machine (T-475).
