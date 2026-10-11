---
id: T-221
kind: task
title: "Cut the hub suite further: 40% shorter and under 5 minutes, measured back to back against dev"
state: open
status: backlog
labels:
  - ready-for-agent
assignee: null
parent: T-216
blocked_by:
  - T-214
topic: null
branch: null
created: 2026-10-11T10:13:17.213Z
updated: 2026-10-11T10:13:17.213Z
---

## Context

T-174 cut the hub phase from 999 s (A-1120, peak load 19.1) to 674 s at 80f356a (A-1177, peak load 15.6), 32.5% shorter. It merged on an amended ≥30% gate (cland-impl, 2026-10-11 10:20Z). The compile cache was dropped because of a Node 24 fault, now T-220. A-1156 assesses the three slowest test families. This item takes the rest of the gain. It is high priority, but it comes after T-214 (phases by diff).

## What to build

Fixture, setup and cleanup work on the slow families from A-1156 and T-174's C1 inventory. Keep the same seams and assertions, and skip no test.

## Acceptance criteria

- [ ] The slow families named in A-1156 and T-174's C1 inventory are shortened. Every test that stays above 5 s is listed with its reason.
- [ ] The hub phase is measured on this head and on a dev base run back to back, in the same load window. Both durations and their peak loads are recorded as an artifact. The head is at least 40% shorter than the A-1120 baseline (999 s), or at least 40% shorter than the paired dev run scaled to that baseline. Under 5 minutes is the target.
- [ ] No production defaults change. Test-only knobs are documented in hub/README.md.
- [ ] `npm run typecheck && npm test` pass.
