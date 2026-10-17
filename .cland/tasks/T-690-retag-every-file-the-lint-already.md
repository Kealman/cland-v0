---
id: T-690
kind: task
title: Retag every file the lint already qualifies as T1 or T2, and record the tier share baseline
state: open
status: in progress
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-676
blocked_by:
  - T-682
topic: topic-450
branch: t/T-690-retag-every-file-the-lint-already
created: 2026-10-16T19:59:28.837Z
updated: 2026-10-17T16:00:30.903Z
---

## Summary

T-679 tags everything T3 except the seven free files, for safety. T-682's lint reports, per file, the lowest tier a file already qualifies for: a grep estimate puts about 15 hub files (~10 s) in T1 and 42 (~436 s) in T2 at today's `dev`, plus the Neovim files that use only the stub hub. Tagging them is the first measurable move of the tier share, and the share recorded here is the baseline E-677's exit and E-578 read (T-662 C3).

## What to build

Retag every hub file T-682 reports as T1- or T2-qualifying, and every Neovim stub-hub-only file as T2, in one manifest change. T1 files join the hermetic phase; T2 files stay in the machine phase, so no run loses coverage. Record the tier share of a full run at the head on this item and on the epic.

## Acceptance criteria

- [ ] C1. Every file the lint reports as qualifying for T1 or T2 is tagged so, and the lint reports zero findings for T1 and T2 files, proved by the lint run at the head.
- [ ] C2. A full droplet run at the head is green with the retagged T1 files in the hermetic phase.
- [ ] C3. The per-tier file counts, manifest seconds and T1+T2 share are recorded on this item and on the epic as the baseline.

## Comments

### impl-690 · 2026-10-17T16:00:30.903Z

Baseline dev b5cd8b4f merged. Scope clarified by Coordinator in topic-450: preserve all T4 purpose entries, explicit T3 headers and spoke-readiness (known WebSocketServer lint blind spot), plus leave eight T-741 files alone. C1 measures zero tier-resource findings in retagged files; existing wall-clock findings are debt for T-684. 46 files retagged (24 to T1, 22 to T2); local checks in progress. Test code remains unchanged.
